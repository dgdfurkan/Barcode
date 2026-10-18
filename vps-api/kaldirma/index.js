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

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
        /^https:\/\/getir-stock\.s3\.[a-z0-9-]+\.amazonaws\.com\/blocked-stock\/[^\s"'<>]+$/.test(v);

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
            fotoKaynak: (Array.isArray(k.fotoKaynak) ? k.fotoKaynak : []).filter(s3Mi).slice(0, 4),
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
        const fotoIsleri = [];
        try {
            await istemci.query('BEGIN');
            const es = await istemci.query('SELECT 1 FROM kaldirma.esitleme WHERE username = $1 FOR UPDATE', [u]);
            const ilk = !es.rows.length;
            const onceki = new Map();
            const fotoluKayit = new Set();
            if (kayitlar.length) {
                const r = await istemci.query(
                    `SELECT kayit_id, bildirilen_durum, veri ? 'foto' AS foto_var FROM kaldirma.kayitlar
                      WHERE username = $1 AND kayit_id = ANY($2)`,
                    [u, kayitlar.map((k) => k.id)]
                );
                r.rows.forEach((x) => { onceki.set(x.kayit_id, x.bildirilen_durum); if (x.foto_var) fotoluKayit.add(x.kayit_id); });
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
                if (k.fotoKaynak.length && !fotoluKayit.has(k.id)) fotoIsleri.push({ u, id: k.id, adresler: k.fotoKaynak });
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
        if (fotoIsleri.length) console.log('kaldirma foto sirasi:', u, fotoIsleri.length);
        fotoIsleri.forEach(fotoSirayaKoy);
    });

    // -----------------------------------------------------------------
    // Hasar fotoğrafları
    //
    // Panelin verdiği adresler bir saat geçerli. Asistan kaydı yazınca
    // fotoğraflar sırayla (tek tek) indirilip sunucuda saklanır; site
    // yalnız oturumlu uçtan (GET /api/kaldirma/foto/:id/:n) okur.
    // Klasör nokta ile başlıyor: genel depolama (/storage) noktalı yolu
    // sunmuyor. Hesap klasörü adı HMAC; tahmin edilemez. 90 günde silinir.
    // -----------------------------------------------------------------

    const FOTO_KOK = path.resolve(process.env.STORAGE_ROOT || '/var/www/jetbarkod-storage', '.kaldirma-foto');
    const FOTO_AZAMI = 6 * 1024 * 1024;
    const FOTO_UZANTILAR = ['.jpg', '.png', '.webp'];
    const fotoKuyrugu = [];
    const kuyruktaki = new Set();
    let fotoCalisiyor = false;

    function hesapKlasoru(u) {
        const h = crypto.createHmac('sha256', process.env.JWT_SECRET || 'jetbarkod').update('kaldirma-foto:' + u).digest('hex');
        return path.join(FOTO_KOK, h.slice(0, 32));
    }

    function adresGecerliMi(adres) {
        try {
            const bitis = Number(new URL(adres).searchParams.get('Expires'));
            return !bitis || bitis * 1000 > Date.now() + 15000;
        } catch (e) { return false; }
    }

    function fotoSirayaKoy(is) {
        const anahtar = is.u + ':' + is.id;
        if (kuyruktaki.has(anahtar) || fotoKuyrugu.length > 2000) return;
        kuyruktaki.add(anahtar);
        fotoKuyrugu.push(is);
        fotoIsle();
    }

    /* Tür başlığa değil dosyanın ilk baytlarına göre: S3 çoğu zaman
       "binary/octet-stream" gönderiyor. Yalnız JPEG, PNG, WEBP kabul. */
    function fotoTuru(b) {
        if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
        if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return '.png';
        if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return '.webp';
        return null;
    }

    let fotoHataSayisi = 0;
    function fotoHata(neden) {
        if (fotoHataSayisi++ < 20) console.warn('kaldirma foto indirilemedi:', neden);
    }

    async function fotoIndir(adres) {
        const ctrl = new AbortController();
        const zaman = setTimeout(() => ctrl.abort(), 20000);
        try {
            const r = await fetch(adres, { signal: ctrl.signal, redirect: 'error' });
            if (!r.ok) { fotoHata('http ' + r.status); return null; }
            const boy = Number(r.headers.get('content-length') || 0);
            if (boy > FOTO_AZAMI) { fotoHata('cok buyuk ' + boy); return null; }
            const veri = Buffer.from(await r.arrayBuffer());
            if (!veri.length || veri.length > FOTO_AZAMI) { fotoHata('boyut ' + veri.length); return null; }
            const uzanti = fotoTuru(veri);
            if (!uzanti) { fotoHata('tur ' + String(r.headers.get('content-type') || '-').slice(0, 40)); return null; }
            return { veri, uzanti };
        } catch (e) {
            fotoHata(e && e.name === 'AbortError' ? 'zaman asimi' : String(e && e.message).slice(0, 80));
            return null;
        } finally {
            clearTimeout(zaman);
        }
    }

    async function fotoIsle() {
        if (fotoCalisiyor) return;
        fotoCalisiyor = true;
        try {
            while (fotoKuyrugu.length) {
                const is = fotoKuyrugu.shift();
                kuyruktaki.delete(is.u + ':' + is.id);
                const klasor = hesapKlasoru(is.u);
                let sayi = 0;
                for (let i = 0; i < is.adresler.length; i++) {
                    if (!adresGecerliMi(is.adresler[i])) { fotoHata('adres suresi dolmus'); continue; }
                    const f = await fotoIndir(is.adresler[i]);
                    if (!f) continue;
                    try {
                        fs.mkdirSync(klasor, { recursive: true, mode: 0o750 });
                        FOTO_UZANTILAR.forEach((uz) => { try { fs.unlinkSync(path.join(klasor, is.id + '-' + (sayi + 1) + uz)); } catch (e) { /* yok */ } });
                        fs.writeFileSync(path.join(klasor, is.id + '-' + (sayi + 1) + f.uzanti), f.veri, { mode: 0o640 });
                        sayi++;
                    } catch (e) {
                        console.warn('kaldirma foto yaz:', e.message);
                    }
                    await new Promise((r) => setTimeout(r, 250));
                }
                if (sayi) {
                    await pool.query(
                        `UPDATE kaldirma.kayitlar SET veri = veri || jsonb_build_object('foto', $3::int)
                          WHERE username = $1 AND kayit_id = $2`,
                        [is.u, is.id, sayi]
                    ).catch((e) => console.warn('kaldirma foto kayit:', e.message));
                }
            }
        } finally {
            fotoCalisiyor = false;
        }
    }

    function eskiFotolariSil() {
        const sinir = Date.now() - 90 * GUN_MS;
        let klasorler = [];
        try { klasorler = fs.readdirSync(FOTO_KOK); } catch (e) { return; }
        klasorler.forEach((k) => {
            const yol = path.join(FOTO_KOK, k);
            let dosyalar = [];
            try { dosyalar = fs.readdirSync(yol); } catch (e) { return; }
            dosyalar.forEach((f) => {
                try { if (fs.statSync(path.join(yol, f)).mtimeMs < sinir) fs.unlinkSync(path.join(yol, f)); } catch (e) { /* geç */ }
            });
        });
    }
    setInterval(eskiFotolariSil, 12 * 3600 * 1000).unref();

    app.get('/api/kaldirma/foto/:id/:n', uye, (req, res) => {
        const id = String(req.params.id || '');
        const n = Number(req.params.n);
        if (!/^[a-f0-9]{24}$/.test(id) || !Number.isInteger(n) || n < 1 || n > 4) return res.status(400).json({ ok: false, error: 'gecersiz' });
        const klasor = hesapKlasoru(req.auth.username);
        for (const uz of FOTO_UZANTILAR) {
            const dosya = path.join(klasor, id + '-' + n + uz);
            if (fs.existsSync(dosya)) {
                res.setHeader('Cache-Control', 'private, max-age=86400');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                return res.sendFile(dosya);
            }
        }
        res.status(404).json({ ok: false, error: 'yok' });
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
