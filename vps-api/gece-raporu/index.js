/**
 * Gece raporu: her gece 01:00'de son 24 saat Telegram'a, kartlar hâlinde
 * ============================================================================
 *
 * İÇERİK (pencere: gönderim anından geriye 24 saat)
 *   1. Özet kartı
 *   2. Reddedilen / iptal edilen satıştan kaldırmalar (kaldirma.kayitlar;
 *      geçmişinde 160 ya da 700 bu pencerede olanlar), red sebebiyle
 *   3. İtirazlar: süresi dolmamış bekleyenler ve bu pencerede sonuçlananlar
 *      (itiraz.kayitlar)
 *   4. Sayım farkları: bu pencerede tamamlanan sayımlar (public.sayim_gecmisi)
 * Telegram'da albüm (sendMediaGroup); tek kart varsa sendPhoto. Bölümde
 * içerik yoksa o kart gitmez; hepsi boşsa özet "Temiz gece" der.
 *
 * VERİ TAZELİĞİ (Asistan)
 *   Satıştan kaldırma 10 dakikada bir, itirazlar 2 saatte bir ve 00:40'ta,
 *   sayım sonuçları 00:30'da (POST /api/sayim-gecmisi/yaz) yazılıyor.
 *
 * ZAMANLAYICI
 *   Dakikada bir bakar; İstanbul saatiyle 01:00-01:29 arasında, o gece
 *   raporu gitmemiş hesaplara sırayla gönderir (gece.gonderim). Hesap
 *   ayarı kapalıysa (gece.ayar) gitmez.
 *
 * UÇLAR
 *   GET  /api/gece-raporu/ayar        { acik, hesap, son }
 *   POST /api/gece-raporu/ayar        { acik }
 *   POST /api/gece-raporu/simdi       Şimdi gönder (deneme): 2 dk arayla, günde 10
 *   POST /api/sayim-gecmisi/yaz       Asistan'ın gece okuduğu sayım sonuçları
 * ============================================================================
 */
'use strict';

const telegram = require('../sayim-raporu/telegram');
const gorsel = require('../sayim-raporu/gorsel');
const kart = require('./kart');

const { Resvg } = require('@resvg/resvg-js');

const HAKLAR = ['satistanKaldirma', 'itirazYazici', 'stokSayimi', 'jetBarkodAsistan'];
const KATALOG = 'https://jetbarkod.com.tr/products.json';
const S3 = /^https:\/\/getir-stock\.s3\.[a-z0-9-]+\.amazonaws\.com\/blocked-stock\/[^\s"'<>]+$/;
const BEKLEYEN = new Set([100, 150, 200, 300]);

const sadeAd = (s) => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

/* Jet Barkod'un kendi ürün kataloğu (herkese açık): ürün kimliği ve adıyla görsel.
   12 saatte bir tazelenir; alınamazsa bir saat sonra yeniden denenir. */
let katalog = { zaman: 0, id: new Map(), ad: new Map() };
async function katalogAl() {
    if (Date.now() - katalog.zaman < 12 * 3600 * 1000) return katalog;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
        const r = await fetch(KATALOG, { signal: ctrl.signal });
        if (!r.ok) throw new Error('http ' + r.status);
        const j = await r.json();
        const liste = Array.isArray(j && j.products) ? j.products : [];
        const id = new Map();
        const ad = new Map();
        liste.forEach((u) => {
            if (!u || typeof u.image !== 'string' || !/^https:\/\//.test(u.image)) return;
            if (KIMLIK.test(String(u.id || ''))) id.set(String(u.id), u.image);
            if (u.name) ad.set(sadeAd(u.name), { id: String(u.id || ''), image: u.image });
        });
        katalog = { zaman: Date.now(), id, ad };
    } catch (e) {
        katalog.zaman = Date.now() - 11 * 3600 * 1000;
    } finally {
        clearTimeout(t);
    }
    return katalog;
}

/* Hasar fotoğrafı: panelin süreli linki; yalnız karta çizmek için indirilir,
   diske yazılmaz. 360 px'e küçültülür. */
async function hasarFotosu(adres) {
    if (!S3.test(adres || '')) return null;
    try {
        const bitis = Number(new URL(adres).searchParams.get('Expires'));
        if (bitis && bitis * 1000 < Date.now() + 5000) return null;
    } catch (e) { return null; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
        const r = await fetch(adres, { signal: ctrl.signal, redirect: 'error' });
        if (!r.ok) return null;
        const b = Buffer.from(await r.arrayBuffer());
        if (!b.length || b.length > 8 * 1024 * 1024) return null;
        const tur = b[0] === 0xff && b[1] === 0xd8 ? 'jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'png' : null;
        if (!tur) return null;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><rect width="360" height="360" fill="#fff"/>` +
            `<image href="data:image/${tur};base64,${b.toString('base64')}" width="360" height="360" preserveAspectRatio="xMidYMid slice"/></svg>`;
        return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
    } catch (e) {
        return null;
    } finally {
        clearTimeout(t);
    }
}
const GUN_MS = 24 * 3600 * 1000;
const KIMLIK = /^[0-9a-f]{24}$/;

function hakAcik(pf) {
    if (!pf || typeof pf !== 'object') return false;
    return HAKLAR.some((h) => {
        const f = pf[h];
        return f === true || (f && typeof f === 'object' && f.enabled === true);
    });
}

function istanbul(t = Date.now()) {
    const p = {};
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
    return { gun: `${p.year}-${p.month}-${p.day}`, saat: Number(p.hour), dakika: Number(p.minute) };
}

const semaYok = (e) => e && (e.code === '3F000' || e.code === '42P01' || e.code === '42703');

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
        if (!pencere('istek:' + c.username, 30, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
        try {
            const r = await pool.query(
                'SELECT is_active, is_admin, trial_end, premium_features FROM users WHERE username = $1 LIMIT 1',
                [c.username]
            );
            const u = r.rows[0];
            if (!u || !u.is_active || (u.trial_end && new Date() > new Date(u.trial_end))) {
                return res.status(403).json({ ok: false, error: 'hesap_kapali' });
            }
            if (!u.is_admin && !hakAcik(u.premium_features)) return res.status(403).json({ ok: false, error: 'hak_yok' });
        } catch (e) {
            console.error('gece-raporu uye:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
        req.auth = c;
        next();
    }

    async function alicilar(username) {
        try {
            const r = await pool.query(
                `SELECT id, chat_id FROM rapor.telegram_baglantilari WHERE username = $1 AND durum = 'aktif' ORDER BY baglandi_at`,
                [username]
            );
            return r.rows;
        } catch (e) { return []; }
    }

    /** Hesabın rapor seçimleri; kolonlar yoksa (eski kurulum) varsayılanlar */
    async function ayarOku(u) {
        try {
            const r = await pool.query('SELECT acik, bekleyen, foto FROM gece.ayar WHERE username = $1', [u]);
            const a = r.rows[0];
            return { acik: a ? a.acik : true, bekleyen: !!(a && a.bekleyen), foto: !!(a && a.foto) };
        } catch (e) {
            if (!semaYok(e)) throw e;
            try {
                const r = await pool.query('SELECT acik FROM gece.ayar WHERE username = $1', [u]);
                return { acik: r.rows[0] ? r.rows[0].acik : true, bekleyen: false, foto: false };
            } catch (x) { return { acik: true, bekleyen: false, foto: false }; }
        }
    }

    // -----------------------------------------------------------------
    // Veri
    // -----------------------------------------------------------------

    async function kaldirmaVerisi(u, bas, son, ayar = {}) {
        let r;
        try {
            r = await pool.query(
                `SELECT kayit_id, olusturma, durum, sebep, adet, veri FROM kaldirma.kayitlar
                  WHERE username = $1 AND olusturma > $2::timestamptz - interval '30 days'
                  ORDER BY olusturma`,
                [u, bas]
            );
        } catch (e) { if (semaYok(e)) return []; throw e; }
        const tum = r.rows;
        const sonuc = [];
        const bekleyen = [];
        for (const k of tum) {
            const fotolar = ayar.foto && Array.isArray(k.veri && k.veri.fotolar) ? k.veri.fotolar.filter((x) => S3.test(x)).slice(0, 3) : [];
            if (ayar.bekleyen && BEKLEYEN.has(k.durum)) {
                bekleyen.push({
                    urun: { id: k.veri.urun && k.veri.urun.id, ad: k.veri.urun && k.veri.urun.ad, gorsel: k.veri.urun && k.veri.urun.gorsel },
                    adet: Number(k.adet) || 0, sebep: k.sebep || '', altNeden: k.veri.altNeden || '',
                    durum: k.durum, bekliyor: true, zaman: k.olusturma, fotoAdres: fotolar,
                });
            }
            const gecmis = Array.isArray(k.veri && k.veri.gecmis) ? k.veri.gecmis : [];
            const olay = gecmis.filter((g) => g && (g.durum === 160 || g.durum === 700) && g.zaman &&
                Date.parse(g.zaman) > bas.getTime() && Date.parse(g.zaman) <= son.getTime()).pop();
            if (!olay) continue;
            const pid = k.veri && k.veri.urun && (k.veri.urun.id || k.veri.urun.ad);
            const t = Date.parse(k.olusturma);
            // İptalden sonra aynı ürün yeniden girildiyse (depo kendisi düzeltti)
            const yeniden = k.durum === 700 && tum.some((x) => x !== k && x.durum !== 700 &&
                ((x.veri && x.veri.urun && (x.veri.urun.id || x.veri.urun.ad)) === pid) &&
                Date.parse(x.olusturma) > t && Date.parse(x.olusturma) - t < 7 * GUN_MS);
            sonuc.push({
                urun: { id: k.veri.urun && k.veri.urun.id, ad: k.veri.urun && k.veri.urun.ad, gorsel: k.veri.urun && k.veri.urun.gorsel },
                adet: Number(k.adet) || 0,
                sebep: k.sebep || '',
                altNeden: k.veri.altNeden || '',
                red: k.veri.red || null,
                durum: k.durum,
                yeniden,
                zaman: olay.zaman,
                fotoAdres: fotolar,
            });
        }
        // Önce gerçek redler, sonra yeniden girilenler; her grupta en yeni üstte
        sonuc.sort((a, b) => (a.yeniden - b.yeniden) || (Date.parse(b.zaman) - Date.parse(a.zaman)));
        bekleyen.sort((a, b) => Date.parse(b.zaman) - Date.parse(a.zaman));
        return { red: sonuc, bekleyen };
    }

    async function itirazVerisi(u, bas, son) {
        const bos = { bekleyen: [], sonuc: [] };
        let b;
        try {
            b = await pool.query(
                `SELECT urun, sikayet, musteri_notu, son_tarih, (secilen_metin IS NOT NULL) AS taslak, to_jsonb(itiraz.kayitlar)->>'urun_id' AS urun_id
                   FROM itiraz.kayitlar
                  WHERE username = $1 AND durum = 100 AND son_tarih > now()
                  ORDER BY son_tarih LIMIT 30`,
                [u]
            );
        } catch (e) { if (semaYok(e)) return bos; throw e; }
        let s = { rows: [] };
        try {
            s = await pool.query(
                `SELECT urun, sikayet, durum, itiraz_metni, to_jsonb(itiraz.kayitlar)->>'urun_id' AS urun_id FROM itiraz.kayitlar
                  WHERE username = $1 AND durum IN (300, 400) AND durum_degisti_at > $2 AND durum_degisti_at <= $3
                  ORDER BY durum_degisti_at DESC LIMIT 30`,
                [u, bas, son]
            );
        } catch (e) { if (!semaYok(e)) throw e; }
        return {
            bekleyen: b.rows.map((x) => ({ urun: x.urun, urunId: x.urun_id, sikayet: x.sikayet, musteriNotu: x.musteri_notu, sonTarih: x.son_tarih, taslak: x.taslak })),
            sonuc: s.rows.map((x) => ({ urun: x.urun, urunId: x.urun_id, sikayet: x.sikayet, durum: x.durum, itirazMetni: x.itiraz_metni })),
        };
    }

    async function sayimVerisi(u, bas, son) {
        let r;
        try {
            r = await pool.query(
                `SELECT sayim_id, otomatik, sayim_at, urun_adi, sistem, fiziksel
                   FROM public.sayim_gecmisi
                  WHERE username = $1 AND COALESCE(tamamlandi_at, sayim_at) > $2 AND COALESCE(tamamlandi_at, sayim_at) <= $3
                  ORDER BY sayim_at, urun_adi`,
                [u, bas, son]
            );
        } catch (e) { if (semaYok(e)) return []; throw e; }
        const gruplar = new Map();
        for (const x of r.rows) {
            let g = gruplar.get(x.sayim_id);
            if (!g) {
                const saat = new Date(x.sayim_at).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
                g = { ad: (x.otomatik ? 'Günlük Sayım · ' : 'Sayım · ') + saat, otomatik: !!x.otomatik, urun: 0, farklar: [], at: x.sayim_at };
                gruplar.set(x.sayim_id, g);
            }
            g.urun++;
            const fark = Math.round((Number(x.fiziksel) - Number(x.sistem)) * 1000) / 1000;
            if (fark) g.farklar.push({ ad: x.urun_adi, sistem: Number(x.sistem), fiziksel: Number(x.fiziksel), fark });
        }
        // Günlük sayım önce; farklar büyükten küçüğe
        return [...gruplar.values()]
            .map((g) => ({ ...g, farklar: g.farklar.sort((a, b) => Math.abs(b.fark) - Math.abs(a.fark)) }))
            .sort((a, b) => (b.otomatik - a.otomatik) || (Date.parse(a.at) - Date.parse(b.at)));
    }

    /** Raporun bütün kartları (PNG listesi) ve başlık */
    async function raporHazirla(u, son = new Date()) {
        const bas = new Date(son.getTime() - GUN_MS);
        const ayar = await ayarOku(u);
        const [kd, itiraz, sayim] = await Promise.all([
            kaldirmaVerisi(u, bas, son, ayar),
            itirazVerisi(u, bas, son),
            sayimVerisi(u, bas, son),
        ]);
        const kaldirma = kd.red;
        const gun = istanbul(son.getTime()).gun;
        const gercekRed = kaldirma.filter((k) => !k.yeniden).length;
        const farkUrun = sayim.reduce((t, g) => t + g.farklar.length, 0);
        const gunluk = sayim.filter((g) => g.otomatik);
        const kartlar = [kart.ozetKarti({
            gun,
            pencere: { bas: bas.toISOString(), son: son.toISOString() },
            kaldirmaRed: gercekRed,
            itirazBekleyen: itiraz.bekleyen.length,
            itirazKabul: itiraz.sonuc.filter((x) => x.durum === 300).length,
            itirazRed: itiraz.sonuc.filter((x) => x.durum === 400).length,
            sayimSayisi: sayim.length,
            sayimUrun: sayim.reduce((t, g) => t + g.urun, 0),
            farkUrun,
            gunluk: gunluk.length ? { urun: gunluk.reduce((t, g) => t + g.urun, 0), fark: gunluk.reduce((t, g) => t + g.farklar.length, 0) } : null,
        })];
        // Ürün görselleri: kaldırmada kaydın kendi görseli, itirazda katalogdan (kimlik ya da ad)
        const urunler = [];
        const gorulen = new Set();
        const ekle = (id, adres) => {
            if (id && KIMLIK.test(id) && /^https:\/\//.test(adres || '') && !gorulen.has(id)) { gorulen.add(id); urunler.push({ id, gorsel: adres }); }
        };
        kaldirma.concat(kd.bekleyen).forEach((k) => ekle(k.urun.id, k.urun.gorsel));
        const itirazlar = itiraz.bekleyen.concat(itiraz.sonuc);
        if (itirazlar.length) {
            const kt = await katalogAl();
            itirazlar.forEach((k) => {
                let id = KIMLIK.test(String(k.urunId || '')) ? k.urunId : '';
                let adres = id ? kt.id.get(id) : '';
                if (!adres) { const x = kt.ad.get(sadeAd(k.urun)); if (x) { id = x.id; adres = x.image; } }
                k.gorselId = id;
                ekle(id, adres);
            });
        }
        const gorseller = urunler.length ? await gorsel.topluGetir(urunler.slice(0, 60), 25000) : new Map();

        // Hasar fotoğrafları (seçiliyse): en çok 24, 25 sn içinde
        if (ayar.foto) {
            const bitis = Date.now() + 25000;
            let sayi = 0;
            for (const k of kaldirma.concat(kd.bekleyen)) {
                k.fotolar = [];
                for (const adres of k.fotoAdres || []) {
                    if (sayi >= 24 || Date.now() > bitis) break;
                    const f = await hasarFotosu(adres);
                    if (f) { k.fotolar.push(f); sayi++; }
                }
            }
        }

        if (kaldirma.length || kd.bekleyen.length) kartlar.push(...kart.kaldirmaKartlari(kaldirma, gorseller, gun, kd.bekleyen));
        if (itirazlar.length) kartlar.push(...kart.itirazKartlari(itiraz.bekleyen, itiraz.sonuc, gun, gorseller));
        if (sayim.length) kartlar.push(...kart.sayimKartlari(sayim, gun));

        const satir = [];
        satir.push('🌙 Gece Raporu · ' + new Date(son).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' }));
        if (gercekRed) satir.push(gercekRed + ' satıştan kaldırma reddedildi');
        if (kd.bekleyen.length) satir.push(kd.bekleyen.length + ' satıştan kaldırma bekliyor');
        if (itiraz.bekleyen.length) satir.push(itiraz.bekleyen.length + ' kayıt itiraz bekliyor');
        if (itiraz.sonuc.length) satir.push(itiraz.sonuc.length + ' itiraz sonuçlandı');
        if (farkUrun) satir.push(farkUrun + ' üründe sayım farkı');
        if (satir.length === 1) satir.push('Temiz gece.');
        return { kartlar: kartlar.slice(0, 10), baslik: satir.join('\n') };
    }

    /** Albüm (2-10 kart) ya da tek fotoğraf; ilk alıcıdan sonra file_id ile */
    async function gonder(u, rapor) {
        const hedefler = await alicilar(u);
        if (!hedefler.length) return { giden: 0, hata: 'baglanti_yok' };
        let giden = 0;
        let kimlikler = null;
        for (const h of hedefler) {
            try {
                if (rapor.kartlar.length === 1) {
                    if (kimlikler) {
                        await telegram.cagir('sendPhoto', { chat_id: h.chat_id, photo: kimlikler[0], caption: rapor.baslik });
                    } else {
                        const form = new FormData();
                        form.append('chat_id', String(h.chat_id));
                        form.append('caption', rapor.baslik);
                        form.append('photo', new Blob([rapor.kartlar[0]], { type: 'image/png' }), 'gece-raporu.png');
                        const s = await telegram.cagir('sendPhoto', form, 60000);
                        const f = Array.isArray(s && s.photo) ? s.photo[s.photo.length - 1] : null;
                        if (f && f.file_id) kimlikler = [f.file_id];
                    }
                } else if (kimlikler) {
                    await telegram.cagir('sendMediaGroup', {
                        chat_id: h.chat_id,
                        media: kimlikler.map((id, i) => ({ type: 'photo', media: id, ...(i === 0 ? { caption: rapor.baslik } : {}) })),
                    }, 60000);
                } else {
                    const form = new FormData();
                    form.append('chat_id', String(h.chat_id));
                    form.append('media', JSON.stringify(rapor.kartlar.map((_, i) => ({
                        type: 'photo', media: 'attach://kart' + i, ...(i === 0 ? { caption: rapor.baslik } : {}),
                    }))));
                    rapor.kartlar.forEach((png, i) => form.append('kart' + i, new Blob([png], { type: 'image/png' }), 'kart' + i + '.png'));
                    const s = await telegram.cagir('sendMediaGroup', form, 90000);
                    if (Array.isArray(s) && s.length === rapor.kartlar.length) {
                        const ids = s.map((m) => Array.isArray(m.photo) && m.photo.length ? m.photo[m.photo.length - 1].file_id : null);
                        if (ids.every(Boolean)) kimlikler = ids;
                    }
                }
                giden++;
            } catch (e) {
                console.warn('gece-raporu gonder:', telegram.temizle(e && e.message));
                if (e instanceof telegram.TelegramHatasi && e.kod === 403) {
                    await pool.query(`UPDATE rapor.telegram_baglantilari SET durum = 'engelli' WHERE id = $1`, [h.id]).catch(() => {});
                }
            }
            await new Promise((r) => setTimeout(r, 500));
        }
        return { giden };
    }

    // -----------------------------------------------------------------
    // Zamanlayıcı: 01:00-01:29
    // -----------------------------------------------------------------

    let calisiyor = false;
    async function geceTuru() {
        if (calisiyor || !telegram.hazirMi()) return;
        const z = istanbul();
        if (z.saat !== 1 || z.dakika >= 30) return;
        calisiyor = true;
        try {
            let r;
            try {
                r = await pool.query(
                    `SELECT DISTINCT u.username, u.is_admin, u.premium_features
                       FROM users u
                       JOIN rapor.telegram_baglantilari t ON t.username = u.username AND t.durum = 'aktif'
                       LEFT JOIN gece.ayar a ON a.username = u.username
                      WHERE u.is_active AND (u.trial_end IS NULL OR u.trial_end > now())
                        AND COALESCE(a.acik, true)
                        AND NOT EXISTS (SELECT 1 FROM gece.gonderim g WHERE g.username = u.username AND g.gun = $1)`,
                    [z.gun]
                );
            } catch (e) {
                if (!semaYok(e)) console.error('gece-raporu tur:', e.message);
                return;
            }
            for (const u of r.rows) {
                if (!u.is_admin && !hakAcik(u.premium_features)) continue;
                try {
                    // Önce işaretle: sunucu yarıda düşse de aynı gece ikinci kez gitmesin
                    const isaret = await pool.query(
                        `INSERT INTO gece.gonderim (username, gun) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1`,
                        [u.username, z.gun]
                    );
                    if (!isaret.rows.length) continue;
                    const rapor = await raporHazirla(u.username);
                    const s = await gonder(u.username, rapor);
                    await pool.query('UPDATE gece.gonderim SET kart = $3 WHERE username = $1 AND gun = $2', [u.username, z.gun, s.giden ? rapor.kartlar.length : 0]);
                } catch (e) {
                    console.error('gece-raporu ' + u.username + ':', e.message);
                }
                await new Promise((res) => setTimeout(res, 1500));
            }
        } finally {
            calisiyor = false;
        }
    }
    setInterval(() => { geceTuru().catch((e) => console.error('gece-raporu:', e.message)); }, 60000).unref();

    // -----------------------------------------------------------------
    // Uçlar
    // -----------------------------------------------------------------

    app.get('/api/gece-raporu/ayar', uye, async (req, res) => {
        const u = req.auth.username;
        try {
            const [a, g, h] = await Promise.all([
                ayarOku(u),
                pool.query('SELECT gun::text AS gun, gonderildi, kart FROM gece.gonderim WHERE username = $1 ORDER BY gun DESC LIMIT 1', [u]),
                alicilar(u),
            ]);
            res.json({ ok: true, acik: a.acik, bekleyen: a.bekleyen, foto: a.foto, hesap: h.length, son: g.rows[0] || null });
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('gece-raporu ayar:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    app.post('/api/gece-raporu/ayar', uye, async (req, res) => {
        const b = req.body || {};
        const u = req.auth.username;
        try {
            // Yalnız gönderilen alanlar değişir
            const eski = await ayarOku(u);
            const yeni = {
                acik: typeof b.acik === 'boolean' ? b.acik : eski.acik,
                bekleyen: typeof b.bekleyen === 'boolean' ? b.bekleyen : eski.bekleyen,
                foto: typeof b.foto === 'boolean' ? b.foto : eski.foto,
            };
            try {
                await pool.query(
                    `INSERT INTO gece.ayar (username, acik, bekleyen, foto) VALUES ($1, $2, $3, $4)
                     ON CONFLICT (username) DO UPDATE SET acik = EXCLUDED.acik, bekleyen = EXCLUDED.bekleyen,
                         foto = EXCLUDED.foto, guncelleme = now()`,
                    [u, yeni.acik, yeni.bekleyen, yeni.foto]
                );
            } catch (e) {
                if (e.code !== '42703') throw e;
                if (typeof b.bekleyen === 'boolean' || typeof b.foto === 'boolean') return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
                await pool.query(
                    `INSERT INTO gece.ayar (username, acik) VALUES ($1, $2)
                     ON CONFLICT (username) DO UPDATE SET acik = EXCLUDED.acik, guncelleme = now()`,
                    [u, yeni.acik]
                );
            }
            res.json({ ok: true, ...yeni });
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('gece-raporu ayar yaz:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Deneme: raporu şimdi gönder (son 24 saat) */
    app.post('/api/gece-raporu/simdi', uye, async (req, res) => {
        const u = req.auth.username;
        if (!telegram.hazirMi()) return res.status(503).json({ ok: false, error: 'bot_hazir_degil' });
        if (!pencere('simdi-ara:' + u, 1, 120000)) return res.status(429).json({ ok: false, error: 'cok_sik', bekleSn: 120 });
        if (!pencere('simdi-gun:' + u, 10, GUN_MS)) return res.status(429).json({ ok: false, error: 'gunluk_sinir' });
        try {
            const rapor = await raporHazirla(u);
            const s = await gonder(u, rapor);
            if (s.hata === 'baglanti_yok') return res.status(409).json({ ok: false, error: 'baglanti_yok' });
            if (!s.giden) return res.status(502).json({ ok: false, error: 'gonderilemedi' });
            res.json({ ok: true, kart: rapor.kartlar.length, giden: s.giden });
        } catch (e) {
            console.error('gece-raporu simdi:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Asistan'ın gece okuduğu sayım sonuçları (Sayım Geçmişi biçimi) */
    app.post('/api/sayim-gecmisi/yaz', uye, async (req, res) => {
        const ham = Array.isArray(req.body && req.body.kayitlar) ? req.body.kayitlar.slice(0, 2000) : [];
        const sayi = (v, alt, ust) => (Number.isFinite(Number(v)) && Number(v) >= alt && Number(v) <= ust ? Number(v) : null);
        const tarih = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
        const satirlar = ham.map((k) => k && KIMLIK.test(String(k.g)) && KIMLIK.test(String(k.s)) && KIMLIK.test(String(k.p)) && tarih(k.sa) && sayi(k.sis, -1e6, 1e6) !== null && sayi(k.fiz, -1e6, 1e6) !== null ? {
            g: String(k.g), s: String(k.s), p: String(k.p),
            ad: typeof k.ad === 'string' ? k.ad.slice(0, 200) : null,
            sis: sayi(k.sis, -1e6, 1e6), fiz: sayi(k.fiz, -1e6, 1e6),
            b: sayi(k.b, 0, 100), o: k.o === true, n: sayi(k.n, 0, 5000),
            sa: tarih(k.sa), ta: tarih(k.ta),
        } : null).filter(Boolean);
        if (!satirlar.length) return res.json({ ok: true, yazilan: 0 });
        try {
            const r = await pool.query(
                `INSERT INTO public.sayim_gecmisi (username, gorev_id, sayim_id, product_id, urun_adi, sistem, fiziksel,
                                                   birim, otomatik, sayim_gorev_sayisi, sayim_at, tamamlandi_at, guncellendi_at)
                 SELECT $1, x.g, x.s, x.p, x.ad, x.sis, x.fiz, x.b, x.o, x.n, x.sa::timestamptz, x.ta::timestamptz, now()
                   FROM jsonb_to_recordset($2::jsonb) AS x(g text, s text, p text, ad text, sis numeric, fiz numeric,
                                                          b smallint, o boolean, n int, sa text, ta text)
                 ON CONFLICT (username, gorev_id) DO UPDATE SET
                    sistem = EXCLUDED.sistem, fiziksel = EXCLUDED.fiziksel, urun_adi = EXCLUDED.urun_adi,
                    tamamlandi_at = EXCLUDED.tamamlandi_at, guncellendi_at = now()`,
                [req.auth.username, JSON.stringify(satirlar)]
            );
            res.json({ ok: true, yazilan: r.rowCount });
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('sayim-gecmisi yaz:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });
}

module.exports = { kur };
