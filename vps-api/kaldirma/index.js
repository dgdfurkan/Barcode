/**
 * Satıştan Kaldırma: kayıt, Telegram bildirimi ve görsel rapor
 * ============================================================================
 *
 * AKIŞ
 * 1. Jet Barkod Asistan depo panelinin "Satıştan Kaldırma Listesi"ni saatte
 *    bir okur (son 14 gün, fırın çıkışları hariç) ve POST /api/kaldirma/yaz
 *    ile buraya bırakır. Satırlar hesap + Getir kayıt kimliğiyle tutulur.
 * 2. Durumu İptal Edildi'ye (700) ya da bilinmeyen bir koda (panelin
 *    "reddedildi" gibi listede olmayan durumları) dönen kayıt, kullanıcının
 *    bağladığı Telegram hesaplarına anında bildirilir. Her durum bir kez.
 *    Hesabın İLK eşitlemesinde geçmiş kayıtlar bildirilmez (eski iptaller
 *    yığılmasın), yalnız işaretlenir.
 * 3. Site sayfası (/kaldirma/) GET /api/kaldirma/liste ile okur. "Rapor"
 *    düğmesi kare olmayan uzun bir PNG üretip Telegram'a yollar ya da
 *    indirir (galeriye kaydetmek için).
 *
 * Telegram botu ve hesap bağlama sayım raporununki (vps-api/sayim-raporu):
 * kullanıcı bir kez bağladıysa burada da geçerli.
 *
 * SINIRLAR (kullanıcı başına)
 * - yaz: dakikada 6 (Asistan saatte bir yazar; elle tazeleme de buraya düşer)
 * - rapor/görsel: iki istek arası 15 sn, saatte 40
 * ============================================================================
 */
'use strict';

const telegram = require('../sayim-raporu/telegram');
const gorsel = require('../sayim-raporu/gorsel');
const { kartUret, DURUMLAR, SONUC_TIPLERI } = require('./kart');

const BILINEN = new Set(Object.keys(DURUMLAR).map(Number));
const BILDIRILEN = new Set([700]);
const AZAMI_KAYIT = 3000;
const GUN_MS = 24 * 3600 * 1000;

function kur(app, { pool, verifyToken, bearerOf }) {
    const sayac = new Map();

    function pencere(anahtar, sinir, ms) {
        const simdi = Date.now();
        const liste = (sayac.get(anahtar) || []).filter((t) => simdi - t < ms);
        if (liste.length >= sinir) { sayac.set(anahtar, liste); return false; }
        liste.push(simdi);
        sayac.set(anahtar, liste);
        if (sayac.size > 20000) sayac.clear();
        return true;
    }

    async function uye(req, res, next) {
        const c = verifyToken(bearerOf(req));
        if (!c || !c.username || (c.role !== 'web_user' && c.role !== 'web_admin')) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
        if (!pencere('istek:' + c.username, 120, 60000)) {
            return res.status(429).json({ ok: false, error: 'cok_istek' });
        }
        try {
            const r = await pool.query('SELECT is_active, trial_end FROM users WHERE username = $1 LIMIT 1', [c.username]);
            const u = r.rows[0];
            if (!u || !u.is_active || (u.trial_end && new Date() > new Date(u.trial_end))) {
                return res.status(403).json({ ok: false, error: 'hesap_kapali' });
            }
        } catch (e) {
            console.error('kaldirma uye kontrolu:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
        req.auth = c;
        next();
    }

    // -----------------------------------------------------------------
    // Girdi denetimi: Asistan'dan gelen her alan kırpılıyor, tip zorlanıyor
    // -----------------------------------------------------------------

    const metin = (v, azami) => (typeof v === 'string' ? v.slice(0, azami) : '');
    const tarih = (v) => {
        const t = typeof v === 'string' ? Date.parse(v) : NaN;
        return Number.isFinite(t) ? new Date(t).toISOString() : null;
    };
    const tamsayi = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
    const httpsMi = (v) => typeof v === 'string' && /^https:\/\/[^\s"'<>]{4,1900}$/.test(v);
    /* Hasar fotoğrafı: panelin verdiği süreli imzalı S3 adresi. Yalnız bu kova. */
    const s3Mi = (v) => typeof v === 'string' && v.length < 3000 &&
        /^https:\/\/getir-stock\.s3\.[a-z0-9-]+\.amazonaws\.com\/(?:blocked-stock|transfer)\/[^\s"'<>]+$/.test(v);

    function kayitDuzelt(k) {
        if (!k || typeof k !== 'object') return null;
        const id = metin(k.id, 40);
        if (!/^[a-f0-9]{24}$/.test(id)) return null;
        const olusturma = tarih(k.olusturma);
        const durum = tamsayi(k.durum);
        if (!olusturma || durum === null) return null;
        const u = k.urun && typeof k.urun === 'object' ? k.urun : {};
        const gecmis = Array.isArray(k.gecmis) ? k.gecmis.slice(0, 20).map((g) => ({
            durum: tamsayi(g && g.durum),
            zaman: tarih(g && g.zaman),
            kisi: metin(g && g.kisi, 80),
            sonucTipi: tamsayi(g && g.sonucTipi),
        })).filter((g) => g.durum !== null) : [];
        return {
            id,
            olusturma,
            guncelleme: tarih(k.guncelleme),
            durum,
            sonucTipi: tamsayi(k.sonucTipi),
            sebep: metin(k.sebep, 200),
            adet: Math.max(0, Number(k.adet) || 0),
            veri: {
                urun: {
                    id: metin(u.id, 40),
                    ad: metin(u.ad, 200),
                    gorsel: httpsMi(u.gorsel) ? u.gorsel : '',
                    barkod: metin(u.barkod, 40),
                },
                birim: tamsayi(k.birim),
                skt: tarih(k.skt),
                olusturan: metin(k.olusturan, 80),
                gecmis,
                ...ekAlanlar(k),
            },
        };
    }

    /* İsteğe bağlı alanlar: yalnız dolu gelirse yazılır. Upsert `veri || yeni`
       birleştirdiği için detaydan bir kez gelen red sebebi sonraki saatlik
       aktarımlarda (detay okunmadığında) silinmez. */
    function ekAlanlar(k) {
        const e = {};
        const alt = metin(k.altNeden, 160);
        if (alt) e.altNeden = alt;
        const nereden = metin(k.nereden, 60);
        if (nereden) e.nereden = nereden;
        const nereye = metin(k.nereye, 60);
        if (nereye) e.nereye = nereye;
        const olu = k.oluGun == null ? null : tamsayi(k.oluGun);
        if (olu !== null && olu >= 0 && olu < 3650) e.oluGun = olu;
        // Hasar fotoğrafı: panelin süreli linkleri, her aktarımda tazelenir. Boş gelirse
        // yazılmaz; fotoğraf linki göndermeyen eski Asistan var olanı silmesin.
        const fotolar = (Array.isArray(k.fotoKaynak) ? k.fotoKaynak : []).filter(s3Mi).slice(0, 4);
        if (fotolar.length) e.fotolar = fotolar;
        if (k.red && typeof k.red === 'object') {
            const baslik = metin(k.red.baslik, 160);
            const aciklama = metin(k.red.aciklama, 400);
            if (baslik || aciklama) e.red = { baslik, aciklama };
        }
        return e;
    }

    // -----------------------------------------------------------------
    // Telegram
    // -----------------------------------------------------------------

    async function alicilar(username) {
        try {
            const r = await pool.query(
                `SELECT id, chat_id FROM rapor.telegram_baglantilari
                 WHERE username = $1 AND durum = 'aktif' ORDER BY baglandi_at`,
                [username]
            );
            return r.rows;
        } catch (e) {
            return []; // rapor şeması yoksa bildirim yok
        }
    }

    const saat = (iso) => new Date(iso).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });

    function bildirimMetni(k) {
        const ad = DURUMLAR[k.durum] || ('Bilinmeyen durum (' + k.durum + ')');
        const u = k.veri.urun;
        const satirlar = [
            '⚠️ Satıştan kaldırma: ' + ad.toLocaleUpperCase('tr-TR'),
            '',
            u.ad || 'Ürün',
            'Adet: ' + (Number.isInteger(k.adet) ? k.adet : k.adet.toFixed(2)) + (k.sebep ? ' · ' + k.sebep : ''),
        ];
        if (k.veri.altNeden) satirlar.push('Alt neden: ' + k.veri.altNeden);
        if (k.veri.red && k.veri.red.baslik) satirlar.push('Red sebebi: ' + k.veri.red.baslik);
        if (k.veri.olusturan) satirlar.push('Oluşturan: ' + k.veri.olusturan);
        satirlar.push('Oluşturulma: ' + saat(k.olusturma));
        return satirlar.join('\n');
    }

    async function bildir(username, kayitlar) {
        if (!kayitlar.length || !telegram.hazirMi()) return;
        const hedefler = await alicilar(username);
        if (!hedefler.length) return;
        for (const k of kayitlar) {
            const yazi = bildirimMetni(k);
            for (const h of hedefler) {
                try {
                    if (k.veri.urun.gorsel) {
                        try {
                            await telegram.cagir('sendPhoto', { chat_id: h.chat_id, photo: k.veri.urun.gorsel, caption: yazi });
                            continue;
                        } catch (e) {
                            if (e instanceof telegram.TelegramHatasi && e.kod === 403) throw e;
                            // Görsel alınamadıysa yalnız yazı
                        }
                    }
                    await telegram.mesaj(h.chat_id, yazi);
                } catch (e) {
                    console.warn('kaldirma bildirimi:', telegram.temizle(e && e.message));
                    if (e instanceof telegram.TelegramHatasi && e.kod === 403) {
                        await pool.query(`UPDATE rapor.telegram_baglantilari SET durum = 'engelli' WHERE id = $1`, [h.id]).catch(() => {});
                    }
                }
                await new Promise((r) => setTimeout(r, 400)); // Telegram sohbet başına hız sınırı
            }
        }
    }

    function bildirilmeliMi(durum) {
        return BILDIRILEN.has(durum) || !BILINEN.has(durum);
    }

    // -----------------------------------------------------------------
    // Uçlar
    // -----------------------------------------------------------------

    /** Asistan yazar. Gövde: { kayitlar: [...] } */
    app.post('/api/kaldirma/yaz', uye, async (req, res) => {
        const u = req.auth.username;
        if (!pencere('yaz:' + u, 6, 60000)) return res.status(429).json({ ok: false, error: 'cok_sik' });
        const ham = Array.isArray(req.body && req.body.kayitlar) ? req.body.kayitlar : null;
        if (!ham) return res.status(400).json({ ok: false, error: 'gecersiz' });
        if (ham.length > AZAMI_KAYIT) return res.status(413).json({ ok: false, error: 'cok_buyuk' });
        const kayitlar = ham.map(kayitDuzelt).filter(Boolean);

        const istemci = await pool.connect();
        const bildirilecek = [];
        try {
            await istemci.query('BEGIN');
            const es = await istemci.query('SELECT 1 FROM kaldirma.esitleme WHERE username = $1 FOR UPDATE', [u]);
            const ilk = !es.rows.length;
            const onceki = new Map();
            if (kayitlar.length) {
                const r = await istemci.query(
                    'SELECT kayit_id, bildirilen_durum FROM kaldirma.kayitlar WHERE username = $1 AND kayit_id = ANY($2)',
                    [u, kayitlar.map((k) => k.id)]
                );
                r.rows.forEach((x) => onceki.set(x.kayit_id, x.bildirilen_durum));
            }
            for (const k of kayitlar) {
                const eski = onceki.has(k.id) ? onceki.get(k.id) : undefined;
                let bildirilen = eski === undefined ? null : eski;
                if (bildirilmeliMi(k.durum) && bildirilen !== k.durum) {
                    // İlk eşitlemede geçmiş bildirilmez; sonrasında 3 günden eski yeni kayıt da
                    const taze = Date.now() - Date.parse(k.olusturma) < 3 * GUN_MS || eski !== undefined;
                    if (!ilk && taze) bildirilecek.push(k);
                    bildirilen = k.durum;
                }
                await istemci.query(
                    `INSERT INTO kaldirma.kayitlar
                        (username, kayit_id, olusturma, guncelleme, durum, sonuc_tipi, sebep, adet, veri, bildirilen_durum, son_gorulme)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
                     ON CONFLICT (username, kayit_id) DO UPDATE SET
                        guncelleme = EXCLUDED.guncelleme, durum = EXCLUDED.durum, sonuc_tipi = EXCLUDED.sonuc_tipi,
                        sebep = EXCLUDED.sebep, adet = EXCLUDED.adet, veri = kaldirma.kayitlar.veri || EXCLUDED.veri,
                        bildirilen_durum = EXCLUDED.bildirilen_durum, son_gorulme = now()`,
                    [u, k.id, k.olusturma, k.guncelleme, k.durum, k.sonucTipi, k.sebep, k.adet, k.veri, bildirilen]
                );
            }
            await istemci.query(
                `INSERT INTO kaldirma.esitleme (username, son_sayi) VALUES ($1, $2)
                 ON CONFLICT (username) DO UPDATE SET son_at = now(), son_sayi = EXCLUDED.son_sayi`,
                [u, kayitlar.length]
            );
            await istemci.query('COMMIT');
        } catch (e) {
            await istemci.query('ROLLBACK').catch(() => {});
            console.error('kaldirma yaz:', e.message);
            const tabloYok = /does not exist/.test(e.message);
            return res.status(tabloYok ? 503 : 500).json({ ok: false, error: tabloYok ? 'kurulum_bekleniyor' : 'server_error' });
        } finally {
            istemci.release();
        }
        res.json({ ok: true, yazilan: kayitlar.length, bildirilecek: bildirilecek.length });
        // Yanıt döndükten sonra; Telegram yavaşsa Asistan beklemesin
        bildir(u, bildirilecek).catch((e) => console.warn('kaldirma bildir:', e && e.message));
    });

    // -----------------------------------------------------------------
    // Hasar fotoğrafları: panelin linkleri. Liste hafif kalsın diye linkler
    // listede yok (yalnız adet); detay açılınca bu uçtan alınır.
    // -----------------------------------------------------------------

    app.get('/api/kaldirma/fotolar/:id', uye, async (req, res) => {
        const id = String(req.params.id || '');
        if (!/^[a-f0-9]{24}$/.test(id)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            const r = await pool.query(
                `SELECT veri->'fotolar' AS fotolar FROM kaldirma.kayitlar WHERE username = $1 AND kayit_id = $2`,
                [req.auth.username, id]
            );
            const liste = r.rows[0] && Array.isArray(r.rows[0].fotolar) ? r.rows[0].fotolar.filter(s3Mi) : [];
            res.setHeader('Cache-Control', 'no-store');
            res.json({ ok: true, adresler: liste });
        } catch (e) {
            console.error('kaldirma fotolar:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Tarih aralığı: YYYY-MM-DD, İstanbul günü. Azami 62 gün. */
    function aralik(q) {
        const g = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null);
        const bas = g(q.bas);
        const son = g(q.son) || bas;
        if (!bas || !son) return null;
        const b = Date.parse(bas + 'T00:00:00+03:00');
        const s = Date.parse(son + 'T23:59:59.999+03:00');
        if (!Number.isFinite(b) || !Number.isFinite(s) || s < b || s - b > 62 * GUN_MS) return null;
        return { b: new Date(b).toISOString(), s: new Date(s).toISOString(), bas, son };
    }

    async function kayitlarOku(username, a) {
        const r = await pool.query(
            `SELECT kayit_id, olusturma, guncelleme, durum, sonuc_tipi, sebep, adet, veri
             FROM kaldirma.kayitlar
             WHERE username = $1 AND olusturma BETWEEN $2 AND $3
             ORDER BY olusturma DESC LIMIT ${AZAMI_KAYIT}`,
            [username, a.b, a.s]
        );
        return r.rows.map((x) => ({
            id: x.kayit_id,
            olusturma: x.olusturma,
            guncelleme: x.guncelleme,
            durum: x.durum,
            sonucTipi: x.sonuc_tipi,
            sebep: x.sebep || '',
            adet: Number(x.adet) || 0,
            ...x.veri,
            fotolar: undefined,
            foto: Array.isArray(x.veri && x.veri.fotolar) ? x.veri.fotolar.length : 0,
        }));
    }

    app.get('/api/kaldirma/liste', uye, async (req, res) => {
        const a = aralik(req.query || {});
        if (!a) return res.status(400).json({ ok: false, error: 'tarih' });
        try {
            const [kayitlar, es] = await Promise.all([
                kayitlarOku(req.auth.username, a),
                pool.query('SELECT son_at FROM kaldirma.esitleme WHERE username = $1', [req.auth.username]),
            ]);
            const hedefler = await alicilar(req.auth.username);
            res.json({
                ok: true,
                kayitlar,
                sonEsitleme: es.rows[0] ? es.rows[0].son_at : null,
                telegram: { hazir: telegram.hazirMi(), hesap: hedefler.length },
                durumlar: DURUMLAR,
                sonucTipleri: SONUC_TIPLERI,
            });
        } catch (e) {
            const tabloYok = /does not exist/.test(e.message);
            if (!tabloYok) console.error('kaldirma liste:', e.message);
            res.status(tabloYok ? 503 : 500).json({ ok: false, error: tabloYok ? 'kurulum_bekleniyor' : 'server_error' });
        }
    });

    async function kartHazirla(username, a) {
        const kayitlar = await kayitlarOku(username, a);
        const urunler = [];
        const gorulen = new Set();
        kayitlar.forEach((k) => {
            const u = k.urun || {};
            if (u.id && u.gorsel && !gorulen.has(u.id)) { gorulen.add(u.id); urunler.push({ id: u.id, gorsel: u.gorsel }); }
        });
        const gorseller = urunler.length ? await gorsel.topluGetir(urunler.slice(0, 60), 20000) : new Map();
        return { png: kartUret(kayitlar, a, gorseller), kayitlar };
    }

    function raporSiniri(u, res) {
        if (!pencere('rapor-ara:' + u, 1, 15000)) { res.status(429).json({ ok: false, error: 'cok_sik', bekleSn: 15 }); return false; }
        if (!pencere('rapor-saat:' + u, 40, 3600000)) { res.status(429).json({ ok: false, error: 'saatlik_sinir' }); return false; }
        return true;
    }

    /** PNG indir (galeriye kaydetmek için) */
    app.get('/api/kaldirma/kart', uye, async (req, res) => {
        const a = aralik(req.query || {});
        if (!a) return res.status(400).json({ ok: false, error: 'tarih' });
        if (!raporSiniri(req.auth.username, res)) return;
        try {
            const { png } = await kartHazirla(req.auth.username, a);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-store');
            res.send(png);
        } catch (e) {
            console.error('kaldirma kart:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Telegram'a gönder */
    app.post('/api/kaldirma/rapor', uye, async (req, res) => {
        const a = aralik(req.body || {});
        if (!a) return res.status(400).json({ ok: false, error: 'tarih' });
        if (!telegram.hazirMi()) return res.status(503).json({ ok: false, error: 'bot_hazir_degil' });
        const hedefler = await alicilar(req.auth.username);
        if (!hedefler.length) return res.status(409).json({ ok: false, error: 'baglanti_yok' });
        if (!raporSiniri(req.auth.username, res)) return;
        try {
            const { png, kayitlar } = await kartHazirla(req.auth.username, a);
            const adetToplam = kayitlar.reduce((t, k) => t + (Number(k.adet) || 0), 0);
            const baslik = 'Satıştan Kaldırma · ' + (a.bas === a.son ? a.bas.split('-').reverse().join('.') :
                a.bas.split('-').reverse().join('.') + ' - ' + a.son.split('-').reverse().join('.')) +
                '\n' + kayitlar.length + ' kayıt · ' + (Number.isInteger(adetToplam) ? adetToplam : adetToplam.toFixed(2)) + ' adet';
            let giden = 0;
            let fotoId = '';
            for (const h of hedefler) {
                try {
                    if (fotoId) {
                        await telegram.cagir('sendPhoto', { chat_id: h.chat_id, photo: fotoId, caption: baslik });
                    } else {
                        const form = new FormData();
                        form.append('chat_id', String(h.chat_id));
                        form.append('caption', baslik);
                        form.append('photo', new Blob([png], { type: 'image/png' }), 'satistan-kaldirma.png');
                        const s = await telegram.cagir('sendPhoto', form, 60000);
                        const foto = Array.isArray(s && s.photo) ? s.photo[s.photo.length - 1] : null;
                        if (foto && foto.file_id) fotoId = foto.file_id;
                    }
                    giden++;
                } catch (e) {
                    console.warn('kaldirma rapor:', telegram.temizle(e && e.message));
                    if (e instanceof telegram.TelegramHatasi && e.kod === 403) {
                        await pool.query(`UPDATE rapor.telegram_baglantilari SET durum = 'engelli' WHERE id = $1`, [h.id]).catch(() => {});
                    }
                }
            }
            if (!giden) return res.status(502).json({ ok: false, error: 'gonderilemedi' });
            res.json({ ok: true, giden });
        } catch (e) {
            const tabloYok = /does not exist/.test(e.message);
            if (!tabloYok) console.error('kaldirma rapor:', e.message);
            res.status(tabloYok ? 503 : 500).json({ ok: false, error: tabloYok ? 'kurulum_bekleniyor' : 'server_error' });
        }
    });
}

module.exports = { kur };
