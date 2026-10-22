/**
 * Satıştan Kaldırma: kayıt, Telegram bildirimi ve görsel rapor
 * ============================================================================
 *
 * AKIŞ
 * 1. Jet Barkod Asistan depo panelinin "Satıştan Kaldırma Listesi"ni saatte
 *    bir okur (son 14 gün, fırın çıkışları hariç) ve POST /api/kaldirma/yaz
 *    ile buraya bırakır. Satırlar hesap + Getir kayıt kimliğiyle tutulur.
 * 2. Durumu değişen kayıt, hesabın anlık bildirim ayarına göre (Telegram
 *    Raporları sayfası: iptal, red, tamamlanan; varsayılan yalnız iptal)
 *    bağlı Telegram hesaplarına anında bildirilir. Her durum bir kez.
 *    Hesabın İLK eşitlemesinde geçmiş kayıtlar bildirilmez (eski iptaller
 *    yığılmasın), yalnız işaretlenir.
 * 3. Site sayfası (/kaldirma/) GET /api/kaldirma/liste ile okur. "Rapor"
 *    düğmesi kare olmayan uzun bir PNG üretip Telegram'a yollar ya da
 *    indirir (galeriye kaydetmek için).
 *
 * Telegram botu ve hesap bağlama sayım raporununki (vps-api/sayim-raporu):
 * kullanıcı bir kez bağladıysa burada da geçerli.
 *
 * HASAR FOTOĞRAFLARI (foto-depo.js)
 *   Panelin linkleri ~15 dk geçerli. Asistan taze linkleri yazınca sunucu
 *   saklanmamış fotoğrafları bir kez indirir (HASAR_DIZIN, herkese açık
 *   değil); sayfa ve raporlar sonra hep buradan, imzalı süreli adresle.
 *
 * SINIRLAR (kullanıcı başına)
 * - yaz: dakikada 6 (Asistan saatte bir yazar; elle tazeleme de buraya düşer)
 * - rapor/görsel: iki istek arası 15 sn, saatte 40
 * ============================================================================
 */
'use strict';

const telegram = require('../sayim-raporu/telegram');
const gorsel = require('../sayim-raporu/gorsel');
const { kartUret, DURUMLAR, SONUC_TIPLERI, araclar } = require('./kart');
// Kayıt kartları ve albüm gönderimi gece raporuyla ortak
const geceKart = require('../gece-raporu/kart');
const { hasarFotosu, albumGonder, kucult } = require('../gece-raporu/paylas');

const ta = require('../telegram-ayar');
const fotoDepo = require('./foto-depo');

const BILINEN = new Set(Object.keys(DURUMLAR).map(Number));
const BITMIS_DURUM = new Set([210, 350, 500, 600]);

/** Anlık bildirim sınıfı: iptal | red | tamam | bilinmeyen (panelde listede olmayan kod) | null */
function bildirimSinifi(durum) {
    if (durum === 700) return 'iptal';
    if (durum === 160) return 'red';
    if (BITMIS_DURUM.has(durum)) return 'tamam';
    if (!BILINEN.has(durum)) return 'bilinmeyen';
    return null;
}

const saatYaz = (iso) => new Date(iso).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});

/** Anlık bildirimin yazısı. an: ayar.anlik (olusturan gösterilsin mi) */
function bildirimMetni(k, an = {}) {
    const ad = DURUMLAR[k.durum] || ('Bilinmeyen durum (' + k.durum + ')');
    const u = (k.veri && k.veri.urun) || {};
    const adet = Number(k.adet) || 0;
    const satirlar = [
        (BITMIS_DURUM.has(k.durum) ? '✅' : '⚠️') + ' Satıştan kaldırma: ' + ad.toLocaleUpperCase('tr-TR'),
        '',
        u.ad || 'Ürün',
        'Adet: ' + (Number.isInteger(adet) ? adet : adet.toFixed(2)) + (k.sebep ? ' · ' + k.sebep : ''),
    ];
    if (k.veri && k.veri.altNeden) satirlar.push('Alt neden: ' + k.veri.altNeden);
    if (k.veri && k.veri.red && k.veri.red.baslik) satirlar.push('Red sebebi: ' + k.veri.red.baslik);
    if (an.olusturan !== false && k.veri && k.veri.olusturan) satirlar.push('Oluşturan: ' + k.veri.olusturan);
    if (k.olusturma) satirlar.push('Oluşturulma: ' + saatYaz(k.olusturma));
    return satirlar.join('\n');
}
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

    async function bildir(username, kayitlar, an) {
        if (!kayitlar.length || !telegram.hazirMi()) return;
        const hedefler = await alicilar(username);
        if (!hedefler.length) return;
        for (const k of kayitlar) {
            const yazi = bildirimMetni(k, an);
            for (const h of hedefler) {
                try {
                    if (an.gorsel !== false && k.veri.urun.gorsel) {
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

    /** Bu durum değişikliği hesabın anlık bildirim ayarına göre bildirilir mi */
    function bildirilmeliMi(durum, onceki, an) {
        const sinif = bildirimSinifi(durum);
        if (!sinif) return false;
        // Tamamlanan bir kayıt 210'dan 600'e geçerse ikinci kez bildirilmez
        if (sinif === 'tamam' && BITMIS_DURUM.has(onceki)) return false;
        if (sinif === 'bilinmeyen') return an.red || an.iptal;
        return an[sinif] === true;
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
        // Anlık bildirim ayarı (Telegram Raporları sayfası); okunamazsa yalnız iptaller
        let an = { iptal: true, red: false, tamam: false, gorsel: true, olusturan: true };
        try { an = (await ta.ayarOku(pool, u)).ayar.anlik; } catch (e) { /* varsayılan */ }

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
                if (bildirilen !== k.durum && bildirilmeliMi(k.durum, bildirilen, an)) {
                    // İlk eşitlemede geçmiş bildirilmez. Sonrasında yalnız son 2 günde durumu
                    // değişen kayıt: ayar sonradan açılırsa eski kayıtlar topluca gelmesin.
                    const degisme = Date.parse(k.guncelleme) || Date.parse(k.olusturma);
                    const taze = Number.isFinite(degisme) ? Date.now() - degisme < 2 * GUN_MS
                        : Date.now() - Date.parse(k.olusturma) < 3 * GUN_MS || eski !== undefined;
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
        // Hasar fotoğrafları: linkler şu an taze; saklanmamış olanlar bir kez indirilir
        fotoDepo.sirayaAl(kayitlar.flatMap((k) => (k.veri && Array.isArray(k.veri.fotolar) ? k.veri.fotolar : [])));
        // Yanıt döndükten sonra; Telegram yavaşsa Asistan beklemesin
        bildir(u, bildirilecek, an).catch((e) => console.warn('kaldirma bildir:', e && e.message));
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
            // Saklanan fotoğraf Jet Barkod'dan (süreli imzalı, 6 saat); saklanmamışsa panelin linki
            const adresler = liste.map((u) => {
                const a = fotoDepo.anahtar(u);
                return a && fotoDepo.varMi(a) ? fotoDepo.imzaliAdres(a, '') : u;
            });
            // Panel linki tazeyse ve saklanmamışsa hemen indir (bir sonraki bakışta buradan)
            fotoDepo.sirayaAl(liste);
            res.setHeader('Cache-Control', 'no-store');
            res.json({ ok: true, adresler });
        } catch (e) {
            console.error('kaldirma fotolar:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /* Saklanan hasar fotoğrafı: oturumsuz (img etiketi başlık taşıyamaz), ama
       yalnız imzalı ve süresi geçmemiş adresle. İmzayı yalnız kaydın sahibi alır. */
    app.get('/api/kaldirma/hasar/:anahtar', async (req, res) => {
        const a = String(req.params.anahtar || '');
        if (!fotoDepo.imzaDogru(a, req.query.Expires, req.query.imza)) return res.status(403).end();
        const b = await fotoDepo.oku(a);
        const tur = fotoDepo.tur(b);
        if (!b || !tur) return res.status(404).end();
        res.setHeader('Content-Type', tur);
        res.setHeader('Cache-Control', 'private, max-age=21600, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.end(b);
    });

    // -----------------------------------------------------------------
    // Uzaktan fotoğraf tazeleme
    // Panelin hasar fotoğrafı linkleri ~15 dk geçerli; yenisi yalnız panelin
    // kendi oturumuyla alınabiliyor. Telefon (ya da paneli kapalı cihaz)
    // süresi geçmiş fotoğrafı burada ister; depo paneli açık bilgisayardaki
    // Asistan 30 sn'de bir sorar, panelin kendi isteğiyle taze linki alıp
    // yazar. Sayfa yeni linki GET /fotolar/:id ile okur.
    // İstekler bellekte, 90 sn yaşar; hesap başına en çok 20.
    // -----------------------------------------------------------------

    const fotoIstekleri = new Map(); // username -> Map(kayit_id -> zaman)
    const FOTO_ISTEK_MS = 90 * 1000;

    function fotoIstekListesi(u) {
        const m = fotoIstekleri.get(u);
        if (!m) return [];
        const sinir = Date.now() - FOTO_ISTEK_MS;
        for (const [id, t] of m) if (t < sinir) m.delete(id);
        if (!m.size) { fotoIstekleri.delete(u); return []; }
        return [...m.keys()];
    }

    app.post('/api/kaldirma/foto-iste', uye, async (req, res) => {
        const u = req.auth.username;
        const id = String((req.body && req.body.id) || '');
        if (!/^[a-f0-9]{24}$/.test(id)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        if (!pencere('foto-iste:' + u, 30, 60000)) return res.status(429).json({ ok: false, error: 'cok_sik' });
        try {
            const r = await pool.query('SELECT 1 FROM kaldirma.kayitlar WHERE username = $1 AND kayit_id = $2', [u, id]);
            if (!r.rows.length) return res.status(404).json({ ok: false, error: 'kayit_yok' });
            let m = fotoIstekleri.get(u);
            if (!m) { m = new Map(); fotoIstekleri.set(u, m); }
            if (m.size >= 20 && !m.has(id)) fotoIstekListesi(u);
            if (m.size < 20 || m.has(id)) m.set(id, Date.now());
            if (fotoIstekleri.size > 5000) fotoIstekleri.clear();
            res.json({ ok: true });
        } catch (e) {
            console.error('kaldirma foto iste:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Asistan: bekleyen fotoğraf istekleri (en çok 10) */
    app.get('/api/kaldirma/foto-istekleri', uye, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, idler: fotoIstekListesi(req.auth.username).slice(0, 10) });
    });

    /** Asistan: panelden alınan taze linkler */
    app.post('/api/kaldirma/fotolar/:id', uye, async (req, res) => {
        const u = req.auth.username;
        const id = String(req.params.id || '');
        if (!/^[a-f0-9]{24}$/.test(id)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        const adresler = (Array.isArray(req.body && req.body.adresler) ? req.body.adresler : []).filter(s3Mi).slice(0, 4);
        const m = fotoIstekleri.get(u);
        if (m) m.delete(id);
        if (!adresler.length) return res.json({ ok: true, yazilan: 0 });
        try {
            const r = await pool.query(
                `UPDATE kaldirma.kayitlar SET veri = jsonb_set(COALESCE(veri, '{}'::jsonb), '{fotolar}', $3::jsonb, true)
                  WHERE username = $1 AND kayit_id = $2`,
                [u, id, JSON.stringify(adresler)]
            );
            // Sayfa beklerken okuyacak: önce saklansın (en çok 4 dosya)
            if (r.rowCount) await Promise.all(adresler.map((x) => fotoDepo.indir(x).catch(() => null)));
            res.json({ ok: true, yazilan: r.rowCount });
        } catch (e) {
            console.error('kaldirma foto yaz:', e.message);
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

    async function kayitlarOku(username, a, tam) {
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
            // Liste hafif kalsın: süreli linkler yalnız rapor için (tam)
            fotolar: tam ? (Array.isArray(x.veri && x.veri.fotolar) ? x.veri.fotolar : []) : undefined,
            foto: Array.isArray(x.veri && x.veri.fotolar) ? x.veri.fotolar.length : 0,
        }));
    }

    // -----------------------------------------------------------------
    // Seçimli Telegram raporu (sayfadaki "Telegram'a Gönder" paneli)
    // -----------------------------------------------------------------

    const RED = new Set([160, 700]);
    const TAMAM = new Set([210, 350, 500, 600]);

    /** Gövdedeki seçim; yoksa eski davranış (yalnız özet kartı) */
    function secimOku(v) {
        if (!v || typeof v !== 'object') return { ozet: true, red: false, bekleyen: false, tamam: false, foto: false, sebepler: null };
        const b = (x, varsayilan) => (typeof x === 'boolean' ? x : varsayilan);
        return {
            ozet: b(v.ozet, true), red: b(v.red, true), bekleyen: b(v.bekleyen, true), tamam: b(v.tamam, false), foto: b(v.foto, false),
            sebepler: Array.isArray(v.sebepler) ? v.sebepler.slice(0, 40).map((x) => metin(x, 200)) : null,
        };
    }

    async function seciliRapor(username, a, secim) {
        const tum = (await kayitlarOku(username, a, true))
            .filter((k) => !secim.sebepler || secim.sebepler.includes(k.sebep || 'Sebep yok'));
        // Yeniden girilen iptal: depo kendisi düzeltmiş (sayfadaki kuralın aynısı)
        const urunAnahtar = (k) => (k.urun && (k.urun.id || k.urun.ad)) || k.id;
        tum.forEach((k) => {
            k._yeniden = k.durum === 700 && tum.some((x) => x !== k && x.durum !== 700 && urunAnahtar(x) === urunAnahtar(k) &&
                Date.parse(x.olusturma) > Date.parse(k.olusturma) && Date.parse(x.olusturma) - Date.parse(k.olusturma) < 7 * GUN_MS);
        });
        const satir = (k, ek) => ({
            urun: { id: k.urun && k.urun.id, ad: k.urun && k.urun.ad, gorsel: k.urun && k.urun.gorsel },
            adet: Number(k.adet) || 0, sebep: k.sebep || '', altNeden: k.altNeden || '', red: k.red || null,
            durum: k.durum, zaman: k.olusturma, fotoAdres: secim.foto ? (k.fotolar || []).slice(0, 3) : [], ...ek,
        });
        const gruplar = {
            red: secim.red ? tum.filter((k) => RED.has(k.durum)).map((k) => satir(k, { yeniden: k._yeniden })) : [],
            bekleyen: secim.bekleyen ? tum.filter((k) => !RED.has(k.durum) && !TAMAM.has(k.durum)).map((k) => satir(k, { bekliyor: true })) : [],
            tamam: secim.tamam ? tum.filter((k) => TAMAM.has(k.durum)).map((k) => satir(k, { tamam: true })) : [],
        };
        // Reddedilenlerde gerçek redler önce; her grupta en fazla 40 kayıt
        gruplar.red.sort((x, y) => (x.yeniden - y.yeniden) || (Date.parse(y.zaman) - Date.parse(x.zaman)));
        Object.keys(gruplar).forEach((g) => { gruplar[g] = gruplar[g].slice(0, 40); });
        const listeVar = gruplar.red.length + gruplar.bekleyen.length + gruplar.tamam.length > 0;

        // Özet kartı seçilen gruplardaki kayıtlarla; grup seçilmediyse aralığın tamamı
        const grupSecili = secim.red || secim.bekleyen || secim.tamam;
        const ozetKayit = grupSecili
            ? tum.filter((k) => (secim.red && RED.has(k.durum)) || (secim.tamam && TAMAM.has(k.durum)) || (secim.bekleyen && !RED.has(k.durum) && !TAMAM.has(k.durum)))
            : tum;

        const urunler = [];
        const gorulen = new Set();
        ozetKayit.concat(...Object.values(gruplar)).forEach((k) => {
            const u = k.urun || {};
            if (u.id && u.gorsel && !gorulen.has(u.id)) { gorulen.add(u.id); urunler.push({ id: u.id, gorsel: u.gorsel }); }
        });
        const gorseller = urunler.length ? await gorsel.topluGetir(urunler.slice(0, 80), 25000) : new Map();

        if (secim.foto) {
            const bitis = Date.now() + 25000;
            let sayi = 0;
            for (const k of [...gruplar.red, ...gruplar.bekleyen, ...gruplar.tamam]) {
                k.fotolar = [];
                for (const adres of k.fotoAdres) {
                    if (sayi >= 30 || Date.now() > bitis) break;
                    const f = await hasarFotosu(adres);
                    if (f) { k.fotolar.push(f); sayi++; }
                }
            }
        }

        const kartlar = [];
        if (secim.ozet && ozetKayit.length) kartlar.push(kartUret(ozetKayit, a, gorseller));
        if (listeVar) {
            kartlar.push(...geceKart.kaldirmaKartlari(gruplar.red, gorseller, a.son, gruplar.bekleyen, {
                tamam: gruplar.tamam, etiket: araclar.tarihEtiketi(a), altBaslik: 'Seçilen kayıtlar',
            }));
        }
        return { kartlar, gruplar, ozetSayi: ozetKayit.length };
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

    /* Telegram Raporları sayfası: "Telegram'a Gönder" varsayılanlarının önizlemesi.
       Son 7 günün kayıtlarıyla, gönderilecek kartların aynısı (720 px). */
    app.post('/api/kaldirma/onizleme', uye, async (req, res) => {
        const u = req.auth.username;
        if (!pencere('onizleme:' + u, 10, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
        const gun = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(t));
        const a = aralik({ bas: gun(Date.now() - 6 * GUN_MS), son: gun(Date.now()) });
        const b = req.body || {};
        const secim = secimOku({ ...(b.secim && typeof b.secim === 'object' ? b.secim : {}), sebepler: null });
        try {
            const r = await seciliRapor(u, a, secim);
            res.json({
                ok: true,
                kartlar: r.kartlar.slice(0, 10).map((k) => 'data:image/png;base64,' + kucult(k).toString('base64')),
                gruplar: { red: r.gruplar.red.length, bekleyen: r.gruplar.bekleyen.length, tamam: r.gruplar.tamam.length },
            });
        } catch (e) {
            const tabloYok = /does not exist/.test(e.message);
            if (!tabloYok) console.error('kaldirma onizleme:', e.message);
            res.status(tabloYok ? 503 : 500).json({ ok: false, error: tabloYok ? 'kurulum_bekleniyor' : 'server_error' });
        }
    });

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
        const secim = secimOku(req.body && req.body.secim);
        try {
            const r = await seciliRapor(req.auth.username, a, secim);
            if (!r.kartlar.length) return res.status(400).json({ ok: false, error: 'bos' });
            const tarih = a.bas === a.son ? a.bas.split('-').reverse().join('.')
                : a.bas.split('-').reverse().join('.') + ' - ' + a.son.split('-').reverse().join('.');
            const satirlar = ['Satıştan Kaldırma · ' + tarih];
            if (r.gruplar.red.length) satirlar.push(r.gruplar.red.length + ' reddedilen / iptal');
            if (r.gruplar.bekleyen.length) satirlar.push(r.gruplar.bekleyen.length + ' onay bekleyen');
            if (r.gruplar.tamam.length) satirlar.push(r.gruplar.tamam.length + ' tamamlanan');
            if (satirlar.length === 1) satirlar.push(r.ozetSayi + ' kayıt');
            if (r.kartlar.length > 10) satirlar.push('İlk 10 kart gönderildi; aralığı daraltabilirsin.');
            const s = await albumGonder(pool, hedefler, r.kartlar, satirlar.join('\n'), 'satistan-kaldirma');
            if (!s.giden) return res.status(502).json({ ok: false, error: 'gonderilemedi' });
            res.json({ ok: true, giden: s.giden, kart: Math.min(10, r.kartlar.length) });
        } catch (e) {
            const tabloYok = /does not exist/.test(e.message);
            if (!tabloYok) console.error('kaldirma rapor:', e.message);
            res.status(tabloYok ? 503 : 500).json({ ok: false, error: tabloYok ? 'kurulum_bekleniyor' : 'server_error' });
        }
    });
}

module.exports = { kur, bildirimMetni };
