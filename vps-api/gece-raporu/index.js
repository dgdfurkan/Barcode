/**
 * Zamanlı Telegram raporları: gece raporu, satıştan kaldırma, itirazlar
 * ============================================================================
 *
 * AYAR (vps-api/telegram-ayar.js, Telegram Raporları sayfası /telegram/)
 *   Her rapor kendi saatlerinde (gün içinde en çok 4) ve kendi seçenekleriyle.
 *
 * RAPORLAR (pencere: aynı raporun bir önceki gönderiminden bu yana, en çok 24 saat)
 *   Gece raporu      Özet kartı ve sayımlar (farklı ya da bütün ürünler,
 *                    başlama/bitiş saati, günlük sayımın paneldeki durumu)
 *   Satıştan kaldırma  Reddedilen/iptal, onay bekleyen, tamamlanan; hasar
 *                    fotoğrafı grup başına (yatay kart, yatay.js)
 *   İtirazlar        Bekleyenler ve pencerede sonuçlananlar; siparişin
 *                    içeriği, kurye ve toplayıcı (yatay kart)
 * Telegram'da albüm (sendMediaGroup); tek kart varsa sendPhoto; istenirse
 * tam kalite dosya. İçerik yoksa o rapor gitmez.
 *
 * VERİ TAZELİĞİ (Asistan)
 *   Satıştan kaldırma 10 dakikada bir, itirazlar 2 saatte bir ve itiraz
 *   raporundan önce (siparişin özeti de o sırada okunur), sayım sonuçları ve
 *   günlük sayım durumu gece raporundan 30 dk önce.
 *
 * ZAMANLAYICI
 *   Dakikada bir bakar; seçili saatten sonraki 30 dakika içinde o saatin
 *   raporu gitmemiş hesaplara gönderir (gece.gonderim: username, gun,
 *   dakika + kayma). Dakika kolonu yoksa eskisi gibi tek rapor, 01:00.
 *
 * UÇLAR
 *   GET  /api/gece-raporu/ayar        Asistan: { acik, bekleyen, foto, saatler, itirazSaatler, hesap, son }
 *   POST /api/gece-raporu/ayar        Eski Asistan penceresi: { acik?, bekleyen?, foto? }
 *   POST /api/gece-raporu/simdi       Eski Asistan penceresi: şimdi gönder (2 dk arayla, günde 10)
 *   POST /api/gece-raporu/gunluk-durum  Asistan: günlük sayımın paneldeki durumu
 *   GET  /api/telegram-ayar           Sayfa: ayar, hesaplar, sebepler, son gönderimler
 *   POST /api/telegram-ayar           Sayfa: kısmi güncelleme
 *   POST /api/telegram-ayar/onizleme  Sayfa: { rapor: gece|anlik|kaldirma|itiraz } kartların aynısı
 *   POST /api/telegram-ayar/test      Sayfa: kendine deneme gönderimi
 *   POST /api/sayim-gecmisi/yaz       Asistan'ın okuduğu sayım sonuçları
 * ============================================================================
 */
'use strict';

const telegram = require('../sayim-raporu/telegram');
const gorsel = require('../sayim-raporu/gorsel');
const kart = require('./kart');

const { S3, hasarFotosu, albumGonder, belgeGonder, kucult } = require('./paylas');
const yatay = require('./yatay');
const performansKart = require('../performans/kart');
const { siparisDuzelt } = require('../itiraz/siparis');
const siparisOku = (v) => siparisDuzelt(v);

const HAKLAR = ['satistanKaldirma', 'itirazYazici', 'stokSayimi', 'jetBarkodAsistan'];
const BEKLEYEN = new Set([100, 150, 200, 300]);
const RED_OLAY = new Set([160, 700]);
const TAMAM_OLAY = new Set([210, 350, 500, 600]);
const ta = require('../telegram-ayar');
const kaldirmaModul = require('../kaldirma');

/* Jet Barkod'un kendi ürün kataloğu (herkese açık): ürün kimliği ve adıyla görsel */
const { katalogAl, sadeAd } = require('../katalog');

const GUN_MS = 24 * 3600 * 1000;
/* gece.gonderim.dakika kayması (performans: 10000 / 12000) */
const KAYMA = { kaldirma: 14000, itiraz: 16000 };
const RAPOR_TURU = new Set(['gece', 'anlik', 'kaldirma', 'itiraz']);
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

function semaYok(e) {
    const yok = !!(e && (e.code === '3F000' || e.code === '42P01' || e.code === '42703'));
    // Kurulum eksikliği beklenen bir durum ama sorgu hatası da aynı kodu verebiliyor: günlüğe yaz
    if (yok) console.warn('gece-raporu sorgu atlandı:', e.code, String(e.message || '').slice(0, 160));
    return yok;
}

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
                `SELECT id, chat_id, tg_ad, tg_kullanici_adi FROM rapor.telegram_baglantilari WHERE username = $1 AND durum = 'aktif' ORDER BY baglandi_at`,
                [username]
            );
            return r.rows;
        } catch (e) { return []; }
    }

    /** Hesabın bütün Telegram ayarı (telegram-ayar.js); kurulum yoksa eski kolonlardan */
    async function ayarOku(u) {
        return (await ta.ayarOku(pool, u)).ayar;
    }

    // -----------------------------------------------------------------
    // Veri
    // -----------------------------------------------------------------

    /**
     * Satıştan kaldırma grupları. gk: ayar.kaldirmaRapor
     *   red      pencerede reddedilen (160) ya da iptal edilen (700)
     *   bekleyen şu an onay bekleyenler
     *   tamam    pencerede tamamlanan (210, 350, 500, 600)
     * Fotoğraf yalnız fotoğrafı seçili grupta taşınır.
     */
    async function kaldirmaVerisi(u, bas, son, gk) {
        const bos = { red: [], bekleyen: [], tamam: [] };
        if (!gk.red.goster && !gk.bekleyen.goster && !gk.tamam.goster) return bos;
        let r;
        try {
            r = await pool.query(
                `SELECT kayit_id, olusturma, durum, sebep, adet, veri FROM kaldirma.kayitlar
                  WHERE username = $1 AND olusturma > $2::timestamptz - interval '30 days'
                  ORDER BY olusturma`,
                [u, bas]
            );
        } catch (e) { if (semaYok(e)) return bos; throw e; }
        const tum = r.rows;
        const sebepUygun = (k) => !gk.sebepler || gk.sebepler.includes(k.sebep || 'Sebep yok');
        const fotoAl = (k, acik) => (acik && Array.isArray(k.veri && k.veri.fotolar) ? k.veri.fotolar.filter((x) => S3.test(x)).slice(0, 3) : []);
        const urunOf = (k) => ({ id: k.veri.urun && k.veri.urun.id, ad: k.veri.urun && k.veri.urun.ad, gorsel: k.veri.urun && k.veri.urun.gorsel });
        const pencereOlayi = (k, kumeler) => (Array.isArray(k.veri && k.veri.gecmis) ? k.veri.gecmis : [])
            .filter((g) => g && kumeler.has(g.durum) && g.zaman && Date.parse(g.zaman) > bas.getTime() && Date.parse(g.zaman) <= son.getTime()).pop();
        const sonuc = { red: [], bekleyen: [], tamam: [] };
        for (const k of tum) {
            if (!k.veri || !sebepUygun(k)) continue;
            const ortak = { urun: urunOf(k), adet: Number(k.adet) || 0, sebep: k.sebep || '', altNeden: k.veri.altNeden || '', durum: k.durum };
            if (gk.bekleyen.goster && BEKLEYEN.has(k.durum)) {
                sonuc.bekleyen.push({ ...ortak, bekliyor: true, zaman: k.olusturma, fotoAdres: fotoAl(k, gk.bekleyen.foto) });
            }
            if (gk.red.goster) {
                const olay = pencereOlayi(k, RED_OLAY);
                if (olay) {
                    const pid = k.veri.urun && (k.veri.urun.id || k.veri.urun.ad);
                    const t = Date.parse(k.olusturma);
                    // İptalden sonra aynı ürün yeniden girildiyse (depo kendisi düzeltti)
                    const yeniden = k.durum === 700 && tum.some((x) => x !== k && x.durum !== 700 &&
                        ((x.veri && x.veri.urun && (x.veri.urun.id || x.veri.urun.ad)) === pid) &&
                        Date.parse(x.olusturma) > t && Date.parse(x.olusturma) - t < 7 * GUN_MS);
                    if (!(yeniden && gk.yenidenGizle)) {
                        sonuc.red.push({ ...ortak, red: k.veri.red || null, yeniden, zaman: olay.zaman, fotoAdres: fotoAl(k, gk.red.foto) });
                    }
                }
            }
            if (gk.tamam.goster) {
                const olay = pencereOlayi(k, TAMAM_OLAY);
                if (olay && TAMAM_OLAY.has(k.durum)) sonuc.tamam.push({ ...ortak, tamam: true, zaman: olay.zaman, fotoAdres: fotoAl(k, gk.tamam.foto) });
            }
        }
        // Önce gerçek redler, sonra yeniden girilenler; her grupta en yeni üstte
        sonuc.red.sort((a, b) => (a.yeniden - b.yeniden) || (Date.parse(b.zaman) - Date.parse(a.zaman)));
        sonuc.bekleyen.sort((a, b) => Date.parse(b.zaman) - Date.parse(a.zaman));
        sonuc.tamam.sort((a, b) => Date.parse(b.zaman) - Date.parse(a.zaman));
        Object.keys(sonuc).forEach((g) => { sonuc[g] = sonuc[g].slice(0, gk.sinir); });
        return sonuc;
    }

    /** gi: ayar.itirazRapor. Sipariş özeti (itiraz_rapor.sql) yoksa null gelir */
    async function itirazVerisi(u, bas, son, gi) {
        const bos = { bekleyen: [], sonuc: [] };
        let b = { rows: [] };
        if (gi.bekleyen !== 'yok') {
            try {
                b = await pool.query(
                    `SELECT k.kayit_id, k.urun, k.sikayet, k.musteri_notu, k.son_tarih, (k.secilen_metin IS NOT NULL) AS taslak,
                            to_jsonb(k)->>'urun_id' AS urun_id, to_jsonb(k)->'siparis' AS siparis
                       FROM itiraz.kayitlar k
                      WHERE k.username = $1 AND k.durum = 100 AND k.son_tarih > now()
                        AND ($2::boolean OR k.son_tarih < now() + interval '24 hours')
                      ORDER BY son_tarih LIMIT 30`,
                    [u, gi.bekleyen === 'hepsi']
                );
            } catch (e) { if (semaYok(e)) return bos; throw e; }
        }
        let s = { rows: [] };
        if (gi.sonuc) {
            try {
                s = await pool.query(
                    `SELECT k.kayit_id, k.urun, k.sikayet, k.durum, k.itiraz_metni, to_jsonb(k)->>'urun_id' AS urun_id,
                            k.durum_degisti_at AS zaman, to_jsonb(k)->'siparis' AS siparis
                       FROM itiraz.kayitlar k
                      WHERE k.username = $1 AND k.durum IN (300, 400) AND k.durum_degisti_at > $2 AND k.durum_degisti_at <= $3
                      ORDER BY durum_degisti_at DESC LIMIT 30`,
                    [u, bas, son]
                );
            } catch (e) { if (!semaYok(e)) throw e; }
        }
        return {
            bekleyen: b.rows.map((x) => ({ id: x.kayit_id, urun: x.urun, urunId: x.urun_id, sikayet: x.sikayet, musteriNotu: x.musteri_notu, sonTarih: x.son_tarih, taslak: x.taslak, siparis: siparisOku(x.siparis) })),
            sonuc: s.rows.map((x) => ({ id: x.kayit_id, urun: x.urun, urunId: x.urun_id, sikayet: x.sikayet, durum: x.durum, itirazMetni: x.itiraz_metni, zaman: x.zaman, siparis: siparisOku(x.siparis) })),
        };
    }

    /**
     * Pencerede tamamlanan sayımlar. gs: ayar.gece.sayim
     * Grup: { ad, otomatik, urun, bas, bit, farklar, satirlar, panel: {toplam, tamam, bitti} | null }
     */
    async function sayimVerisi(u, bas, son, gs) {
        if (!gs.gunluk && !gs.diger) return [];
        let r;
        try {
            r = await pool.query(
                `SELECT sayim_id, otomatik, sayim_at, tamamlandi_at, urun_adi, sistem, fiziksel
                   FROM public.sayim_gecmisi
                  WHERE username = $1 AND COALESCE(tamamlandi_at, sayim_at) > $2 AND COALESCE(tamamlandi_at, sayim_at) <= $3
                  ORDER BY sayim_at, urun_adi`,
                [u, bas, son]
            );
        } catch (e) { if (semaYok(e)) return []; throw e; }
        const gruplar = new Map();
        for (const x of r.rows) {
            if (x.otomatik ? !gs.gunluk : !gs.diger) continue;
            let g = gruplar.get(x.sayim_id);
            if (!g) {
                const saat = new Date(x.sayim_at).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
                g = { ad: (x.otomatik ? 'Günlük Sayım · ' : 'Sayım · ') + saat, otomatik: !!x.otomatik, urun: 0, farklar: [], satirlar: [], at: x.sayim_at, bas: x.sayim_at, bit: null, panel: null };
                gruplar.set(x.sayim_id, g);
            }
            g.urun++;
            if (x.tamamlandi_at && (!g.bit || Date.parse(x.tamamlandi_at) > Date.parse(g.bit))) g.bit = x.tamamlandi_at;
            const fark = Math.round((Number(x.fiziksel) - Number(x.sistem)) * 1000) / 1000;
            const satir = { ad: x.urun_adi, sistem: Number(x.sistem), fiziksel: Number(x.fiziksel), fark };
            g.satirlar.push(satir);
            if (fark && Math.abs(fark) >= Math.max(gs.esik, 0.001)) g.farklar.push(satir);
        }
        let liste = [...gruplar.values()];
        // Günlük sayımın depo panelindeki durumu (Asistan rapordan önce yazar)
        const otoGunler = [...new Set(liste.filter((g) => g.otomatik).map((g) => istanbul(Date.parse(g.at)).gun))];
        if (otoGunler.length) {
            try {
                const d = await pool.query('SELECT gun::text AS gun, toplam, tamam, bitti FROM gece.gunluk_durum WHERE username = $1 AND gun = ANY($2::date[])', [u, otoGunler]);
                const m = new Map(d.rows.map((x) => [x.gun, x]));
                liste.forEach((g) => { if (g.otomatik) g.panel = m.get(istanbul(Date.parse(g.at)).gun) || null; });
            } catch (e) { if (!semaYok(e)) throw e; }
        }
        if (!gs.farksiz) liste = liste.filter((g) => g.farklar.length);
        // Günlük sayım önce; farklar büyükten küçüğe
        return liste
            .map((g) => ({
                ...g,
                farklar: g.farklar.sort((a, b) => Math.abs(b.fark) - Math.abs(a.fark)),
                satirlar: g.satirlar.sort((a, b) => (Math.abs(b.fark) - Math.abs(a.fark)) || String(a.ad).localeCompare(String(b.ad), 'tr')),
            }))
            .sort((a, b) => (b.otomatik - a.otomatik) || (Date.parse(a.at) - Date.parse(b.at)));
    }

    const kucukSaat = (dk) => ta.saatYazi(dk);
    const bosKaldirma = () => ({ red: [], bekleyen: [], tamam: [] });
    const bosItiraz = () => ({ bekleyen: [], sonuc: [] });
    const pencereMetni = (bas, son) => 'Son ' + Math.max(1, Math.round((son.getTime() - bas.getTime()) / 3600000)) + ' saat';
    const uzunGun = (t) => new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });
    const kisaGun = (t) => new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' });

    /** Satıştan kaldırma kartları (yatay). o: { onizleme, ornek, gorseller, tarih, alt } */
    async function kaldirmaCiz(kd, K, o) {
        const hepsi = kd.red.concat(kd.bekleyen, kd.tamam);
        let gorseller = o.gorseller;
        if (!gorseller) {
            const urunler = [];
            const gorulen = new Set();
            hepsi.forEach((k) => {
                const id = k.urun && k.urun.id;
                if (id && KIMLIK.test(id) && /^https:\/\//.test(k.urun.gorsel || '') && !gorulen.has(id)) { gorulen.add(id); urunler.push({ id, gorsel: k.urun.gorsel }); }
            });
            gorseller = urunler.length ? await gorsel.topluGetir(urunler.slice(0, 60), o.onizleme ? 12000 : 25000) : new Map();
        }
        // Hasar fotoğrafları: yalnız fotoğrafı seçili gruplarda, bellekte
        if (!o.ornek) {
            const bitis = Date.now() + (o.onizleme ? 10000 : 25000);
            const azami = o.onizleme ? 9 : 30;
            let sayi = 0;
            for (const k of hepsi) {
                k.fotolar = [];
                for (const adres of k.fotoAdres || []) {
                    if (sayi >= azami || Date.now() > bitis) break;
                    const f = await hasarFotosu(adres);
                    if (f) { k.fotolar.push(f); sayi++; }
                }
            }
        }
        return yatay.kaldirmaKartlari(kd, {
            tarih: o.tarih, alt: o.alt, gorseller,
            gruplar: { red: K.red.goster, bekleyen: K.bekleyen.goster, tamam: K.tamam.goster },
        });
    }

    /** İtiraz kartları (yatay): ürün ve sipariş görselleri katalogdan, kişi fotoğrafları bellekte */
    async function itirazCiz(it, I, o) {
        const kayitlar = it.bekleyen.concat(it.sonuc);
        let gorseller = o.gorseller;
        const kt = await katalogAl();
        const urunler = [];
        const gorulen = new Set();
        const ekle = (id, adres) => {
            if (id && KIMLIK.test(id) && /^https:\/\//.test(adres || '') && !gorulen.has(id)) { gorulen.add(id); urunler.push({ id, gorsel: adres }); }
        };
        kayitlar.forEach((k) => {
            if (!k.gorselId) {
                let id = KIMLIK.test(String(k.urunId || '')) ? k.urunId : '';
                let adres = id ? kt.id.get(id) : '';
                if (!adres) { const x = kt.ad.get(sadeAd(k.urun)); if (x) { id = x.id; adres = x.image; } }
                k.gorselId = id;
                ekle(id, adres);
            }
            if (I.siparis && k.siparis) {
                k.siparis.urunler.forEach((u) => {
                    if (!u.id) { const x = kt.ad.get(sadeAd(u.ad)); if (x) u.id = x.id; }
                    ekle(u.id, u.gorsel || kt.id.get(u.id) || '');
                });
            }
        });
        if (!gorseller) gorseller = urunler.length ? await gorsel.topluGetir(urunler.slice(0, 160), o.onizleme ? 12000 : 25000) : new Map();
        let kisiFoto = o.kisiFoto;
        if (!kisiFoto) {
            const liste = [];
            kayitlar.forEach((k) => {
                const sp = k.siparis;
                if (!sp) return;
                if (I.kurye && sp.kurye && sp.kurye.foto) liste.push({ id: k.id + ':k', foto: sp.kurye.foto });
                if (I.toplayici && sp.toplayici && sp.toplayici.foto) liste.push({ id: k.id + ':t', foto: sp.toplayici.foto });
            });
            kisiFoto = liste.length ? await performansKart.kuryeFotolari(liste, o.onizleme ? 6000 : 10000) : new Map();
        }
        return yatay.itirazKartlari(it.bekleyen, it.sonuc, {
            not: I.not, metin: I.metin, siparis: I.siparis, kurye: I.kurye, toplayici: I.toplayici, sonucAcik: I.sonuc,
            gorseller, kisiFoto, tarih: o.tarih, alt: o.alt, sonucBaslik: o.sonucBaslik,
        });
    }

    /**
     * Satıştan kaldırma raporu. secenek: { ayar, bas, dakika, onizleme, ornek }
     * Dönüş: { kartlar, baslik, tamKalite, ad }; içerik yoksa kartlar boş.
     */
    async function kaldirmaRaporu(u, son = new Date(), secenek = {}) {
        const A = secenek.ayar || await ayarOku(u);
        const K = A.kaldirmaRapor;
        const bas = secenek.bas || new Date(son.getTime() - GUN_MS);
        const o = secenek.ornek ? await ornekVeri(A) : null;
        const kd = o ? o.kd : await kaldirmaVerisi(u, bas, son, K);
        if (!kd.red.length && !kd.bekleyen.length && !kd.tamam.length) return { kartlar: [], baslik: '' };
        const alt = pencereMetni(bas, son);
        const kartlar = await kaldirmaCiz(kd, K, { onizleme: secenek.onizleme, ornek: !!o, gorseller: o && o.gorseller, tarih: uzunGun(son), alt });
        const red = kd.red.filter((k) => !k.yeniden);
        const r = red.filter((k) => k.durum !== 700).length;
        const parca = [];
        if (r) parca.push(r + ' reddedildi');
        if (red.length - r) parca.push((red.length - r) + ' iptal edildi');
        if (kd.bekleyen.length) parca.push(kd.bekleyen.length + ' onay bekliyor');
        if (kd.tamam.length) parca.push(kd.tamam.length + ' tamamlandı');
        return {
            kartlar: kartlar.slice(0, 10),
            baslik: ['🗑️ Satıştan Kaldırma · ' + kisaGun(son) + ' · ' + alt.toLocaleLowerCase('tr'), parca.join(' · ')].filter(Boolean).join('\n'),
            tamKalite: K.tamKalite, ad: 'satistan-kaldirma-' + istanbul(son.getTime()).gun,
        };
    }

    /** İtiraz raporu: bekleyenler ve pencerede sonuçlananlar, siparişleriyle */
    async function itirazRaporu(u, son = new Date(), secenek = {}) {
        const A = secenek.ayar || await ayarOku(u);
        const I = A.itirazRapor;
        const bas = secenek.bas || new Date(son.getTime() - GUN_MS);
        const o = secenek.ornek ? await ornekVeri(A) : null;
        const it = o ? o.itiraz : await itirazVerisi(u, bas, son, I);
        if (!it.bekleyen.length && !it.sonuc.length) return { kartlar: [], baslik: '' };
        const alt = pencereMetni(bas, son);
        const kartlar = await itirazCiz(it, I, {
            onizleme: secenek.onizleme, gorseller: o && o.gorseller, kisiFoto: o ? new Map() : null,
            tarih: uzunGun(son), alt, sonucBaslik: alt.toLocaleUpperCase('tr') + 'TE SONUÇLANAN',
        });
        const acil = it.bekleyen.filter((k) => Date.parse(k.sonTarih) - Date.now() < 12 * 3600000).length;
        const kabul = it.sonuc.filter((k) => k.durum === 300).length;
        const satir = ['⚖️ İtirazlar · ' + kisaGun(son) + ' · ' + alt.toLocaleLowerCase('tr')];
        if (it.bekleyen.length) satir.push(it.bekleyen.length + ' kayıt itiraz bekliyor' + (acil ? ' (' + acil + ' kaydın süresi 12 saatten az)' : ''));
        if (it.sonuc.length) satir.push(it.sonuc.length + ' itiraz sonuçlandı: ' + kabul + ' kabul, ' + (it.sonuc.length - kabul) + ' red');
        return {
            kartlar: kartlar.slice(0, 10), baslik: satir.join('\n'),
            tamKalite: I.tamKalite, ad: 'itirazlar-' + istanbul(son.getTime()).gun,
        };
    }

    /**
     * Gece raporu: özet ve sayımlar. Satıştan kaldırma ve itirazlar kendi
     * raporlarında; özet kartı yine onların sayılarını gösterir.
     * secenek: { ayar, bas, dakika (rapor saati), onizleme, ornek,
     *            birlesik: kaldırma ve itiraz kartları da (eski kurulum, tek rapor) }
     */
    async function raporHazirla(u, son = new Date(), secenek = {}) {
        const A = secenek.ayar || await ayarOku(u);
        const G = A.gece;
        const bas = secenek.bas || new Date(son.getTime() - GUN_MS);
        const ozetGerek = G.bolumler.ozet || secenek.birlesik;
        const veri = secenek.ornek ? await ornekVeri(A) : await (async () => {
            const [kd, itiraz, sayim] = await Promise.all([
                ozetGerek ? kaldirmaVerisi(u, bas, son, A.kaldirmaRapor) : bosKaldirma(),
                ozetGerek ? itirazVerisi(u, bas, son, A.itirazRapor) : bosItiraz(),
                G.bolumler.sayim || G.bolumler.ozet ? sayimVerisi(u, bas, son, G.sayim) : [],
            ]);
            let itirazSon = null;
            try {
                const r = await pool.query('SELECT max(son_gorulme) AS son FROM itiraz.kayitlar WHERE username = $1', [u]);
                itirazSon = r.rows[0] && r.rows[0].son;
            } catch (e) { /* şema yok */ }
            return { kd, itiraz, sayim, itirazSon, gorseller: null };
        })();
        const { kd, itiraz, sayim } = veri;
        const kaldirma = kd.red;
        const gun = istanbul(son.getTime()).gun;
        const saatFark = Math.max(1, Math.round((son.getTime() - bas.getTime()) / 3600000));
        const raporSaati = Number.isInteger(secenek.dakika) ? secenek.dakika : null;
        const gece = raporSaati == null || raporSaati < 6 * 60;
        const ad = gece ? 'Gece Raporu' : 'Rapor · ' + kucukSaat(raporSaati);
        const pencereYazi = 'Son ' + saatFark + ' saat';
        const gercekRed = kaldirma.filter((k) => !k.yeniden).length;
        const farkUrun = sayim.reduce((t, g) => t + g.farklar.length, 0);
        const gunluk = sayim.filter((g) => g.otomatik);

        const kartlar = [];
        if (G.bolumler.ozet) {
            kartlar.push(kart.ozetKarti({
                gun, baslik: ad, gece,
                pencere: { bas: bas.toISOString(), son: son.toISOString() },
                pencereYazi,
                kaldirmaRed: gercekRed,
                itirazBekleyen: itiraz.bekleyen.length,
                itirazKabul: itiraz.sonuc.filter((x) => x.durum === 300).length,
                itirazRed: itiraz.sonuc.filter((x) => x.durum === 400).length,
                itirazSon: veri.itirazSon,
                sayimSayisi: sayim.length,
                sayimUrun: sayim.reduce((t, g) => t + g.urun, 0),
                farkUrun,
                gunluk: gunluk.length ? {
                    urun: gunluk.reduce((t, g) => t + g.urun, 0), fark: gunluk.reduce((t, g) => t + g.farklar.length, 0),
                    panel: gunluk.find((g) => g.panel) ? gunluk.find((g) => g.panel).panel : null,
                } : null,
            }));
        }
        if (secenek.birlesik) {
            const alt = pencereMetni(bas, son);
            if (kd.red.length + kd.bekleyen.length + kd.tamam.length) {
                kartlar.push(...await kaldirmaCiz(kd, A.kaldirmaRapor, { onizleme: secenek.onizleme, ornek: !!secenek.ornek, gorseller: veri.gorseller, tarih: uzunGun(son), alt }));
            }
            if (itiraz.bekleyen.length + itiraz.sonuc.length) {
                kartlar.push(...await itirazCiz(itiraz, A.itirazRapor, {
                    onizleme: secenek.onizleme, gorseller: veri.gorseller, kisiFoto: secenek.ornek ? new Map() : null,
                    tarih: uzunGun(son), alt, sonucBaslik: 'SON ' + saatFark + ' SAATTE SONUÇLANAN',
                }));
            }
        }
        if (G.bolumler.sayim && sayim.length) {
            kartlar.push(...kart.sayimKartlari(sayim, gun, {
                saatler: G.sayim.saatler, liste: G.sayim.liste, altBaslik: pencereYazi + ' · tamamlanan sayımlar', altEtiket: ad,
            }));
        }

        const satir = [];
        satir.push((gece ? '🌙 ' : '📋 ') + ad + ' · ' + kisaGun(son));
        if (G.bolumler.ozet || secenek.birlesik) {
            if (gercekRed) satir.push(gercekRed + ' satıştan kaldırma reddedildi');
            if (kd.bekleyen.length) satir.push(kd.bekleyen.length + ' satıştan kaldırma bekliyor');
            if (kd.tamam.length) satir.push(kd.tamam.length + ' satıştan kaldırma tamamlandı');
            if (itiraz.bekleyen.length) satir.push(itiraz.bekleyen.length + ' kayıt itiraz bekliyor');
            if (itiraz.sonuc.length) satir.push(itiraz.sonuc.length + ' itiraz sonuçlandı');
        }
        if (farkUrun) satir.push(farkUrun + ' üründe sayım farkı');
        if (satir.length === 1) satir.push(gece ? 'Temiz gece.' : 'Her şey yolunda.');
        return { kartlar: kartlar.slice(0, 10), baslik: satir.join('\n') };
    }

    /**
     * Önizleme için kurgusal veri. Ürün adları ve görselleri Jet Barkod'un
     * herkese açık kataloğundan; kayıtlar, kişiler, adetler ve saatler uydurma.
     */
    async function ornekVeri(A) {
        const kt = await katalogAl();
        const adaylar = [];
        // Önizlemede yadırganacak ürünler (kişisel bakım, alkol, tütün) seçilmez
        const UYGUNSUZ = /prezervatif|kondom|okey|durex|ped\b|tampon|sigara|tütün|bira|şarap|rakı|votka|viski|cin\b|likör|jel/i;
        for (const x of kt.ad.values()) {
            if (x && KIMLIK.test(x.id) && x.ad && !UYGUNSUZ.test(x.ad)) adaylar.push({ id: x.id, ad: x.ad, gorsel: x.image });
            if (adaylar.length >= 400) break;
        }
        const sec = (i) => adaylar.length ? adaylar[(i * 37) % adaylar.length] : { id: '', ad: 'Örnek ürün ' + (i + 1), gorsel: '' };
        const urunler = [];
        for (let i = 0; i < 20; i++) { const x = sec(i); urunler.push({ id: x.id, ad: x.ad, gorsel: x.gorsel }); }
        const gorseller = urunler.length ? await gorsel.topluGetir(urunler.filter((x) => x.id && x.gorsel).map((x) => ({ id: x.id, gorsel: x.gorsel })), 12000) : new Map();
        const simdi = Date.now();
        const once = (sa) => new Date(simdi - sa * 3600000).toISOString();
        const foto = (u) => (gorseller.get(u.id) ? [gorseller.get(u.id)] : []);
        const k = A.kaldirmaRapor;
        const sebepUygun = (s) => !k.sebepler || k.sebepler.includes(s);
        const kd = bosKaldirma();
        if (k.red.goster) {
            [[0, 'Ürün Bozuk', 700, false, null], [1, 'Son Kullanma Tarihi Geçti', 160, false, { baslik: 'Fotoğraf yetersiz', aciklama: 'Ürünün bozukluğu fotoğrafta görülmüyor.' }],
                [2, 'Ürün Bozuk', 700, true, null]].forEach(([i, sebep, durum, yeniden, red]) => {
                if (!sebepUygun(sebep) || (yeniden && k.yenidenGizle)) return;
                kd.red.push({ urun: urunler[i], adet: i + 1, sebep, altNeden: '', red, durum, yeniden, zaman: once(3 + i * 4), fotolar: k.red.foto ? foto(urunler[i]) : [] });
            });
        }
        if (k.bekleyen.goster) {
            [[3, 'Merkez Depodan Hasarlı Gelen Ürün'], [4, 'Son Kullanma Tarihi Geçti']].forEach(([i, sebep]) => {
                if (!sebepUygun(sebep)) return;
                kd.bekleyen.push({ urun: urunler[i], adet: 2, sebep, altNeden: '', durum: 200, bekliyor: true, zaman: once(6 + i), fotolar: k.bekleyen.foto ? foto(urunler[i]) : [] });
            });
        }
        if (k.tamam.goster) {
            [[5, 'Ürün Bozuk']].forEach(([i, sebep]) => {
                if (!sebepUygun(sebep)) return;
                kd.tamam.push({ urun: urunler[i], adet: 1, sebep, altNeden: '', durum: 600, tamam: true, zaman: once(9), fotolar: k.tamam.foto ? foto(urunler[i]) : [] });
            });
        }
        const it = A.itirazRapor;
        // Siparişler: hedef ürün içinde, diğerleri katalogdan; kişiler uydurma
        const siparis = (hedef, digerler, kurye, toplayici, dk) => ({
            urunler: [{ ad: urunler[hedef].ad, adet: 1, id: urunler[hedef].id }].concat(digerler.map((i, j) => ({ ad: urunler[i].ad, adet: j % 3 === 0 ? 2 : 1, id: urunler[i].id }))),
            kalem: digerler.length + 1, adet: digerler.length + 1 + Math.ceil(digerler.length / 3), teslimDk: dk, tarih: once(20),
            kurye: { ad: kurye, foto: '' }, toplayici: { ad: toplayici, foto: '' },
        });
        const itiraz = {
            bekleyen: it.bekleyen === 'yok' ? [] : [
                { id: 'ornek1', urun: urunler[6].ad, gorselId: urunler[6].id, sikayet: 'Eksik Ürün', musteriNotu: 'Siparişte bu ürün yoktu.', sonTarih: new Date(simdi + 9 * 3600000).toISOString(), taslak: true, siparis: siparis(6, [10, 11, 12, 13, 14, 15, 16, 17], 'Ali Yılmaz', 'Can Demir', 14) },
                { id: 'ornek2', urun: urunler[7].ad, gorselId: urunler[7].id, sikayet: 'Bayat/Bozuk Ürün', musteriNotu: '', sonTarih: new Date(simdi + 40 * 3600000).toISOString(), taslak: false, siparis: siparis(7, [18, 19, 9], 'Mert Şahin', 'Ece Kaya', 21) },
            ].filter((x) => it.bekleyen === 'hepsi' || Date.parse(x.sonTarih) - simdi < GUN_MS),
            sonuc: it.sonuc ? [
                { id: 'ornek3', urun: urunler[8].ad, gorselId: urunler[8].id, sikayet: 'Eksik Ürün', durum: 300, zaman: once(4), siparis: siparis(8, [12, 15, 18, 1], 'Deniz Koç', 'Can Demir', 16), itirazMetni: 'Ürünler bayi sahibi tarafından eksiksiz kontrol edilerek ve sayılarak hazırlanmıştır. Gereğinin yapılmasını talep ederiz. İyi çalışmalar dileriz.' },
            ] : [],
        };
        const s = A.gece.sayim;
        const satirlar = [
            { ad: urunler[9].ad, sistem: 12, fiziksel: 10, fark: -2 }, { ad: urunler[10].ad, sistem: 4, fiziksel: 5, fark: 1 },
            { ad: urunler[11].ad, sistem: 8, fiziksel: 8, fark: 0 }, { ad: urunler[0].ad, sistem: 3, fiziksel: 3, fark: 0 },
        ];
        const farklar = satirlar.filter((x) => x.fark && Math.abs(x.fark) >= Math.max(s.esik, 0.001));
        let sayim = [];
        const saatAd = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
        if (s.gunluk) sayim.push({ ad: 'Günlük Sayım · ' + saatAd(once(14)), otomatik: true, urun: 50, farklar, satirlar, at: once(14), bas: once(14), bit: once(11), panel: { toplam: 50, tamam: 50, bitti: true } });
        if (s.diger) sayim.push({ ad: 'Sayım · ' + saatAd(once(5)), otomatik: false, urun: 3, farklar: [], satirlar: satirlar.slice(2), at: once(5), bas: once(5), bit: once(4.5), panel: null });
        if (!s.farksiz) sayim = sayim.filter((g) => g.farklar.length);
        return { kd, itiraz, sayim, itirazSon: new Date(simdi).toISOString(), gorseller };
    }

    /** Albüm (2-10 kart) ya da tek fotoğraf; istenirse ardından tam kalite dosya */
    async function gonder(u, rapor) {
        if (!rapor.kartlar.length) return { giden: 0, bos: true };
        const hedefler = await alicilar(u);
        if (!hedefler.length) return { giden: 0, hata: 'baglanti_yok' };
        const s = await albumGonder(pool, hedefler, rapor.kartlar, rapor.baslik, rapor.ad || 'gece-raporu');
        if (s.giden && rapor.tamKalite) await belgeGonder(pool, hedefler, rapor.kartlar, rapor.ad || 'rapor').catch(() => null);
        return s;
    }

    // -----------------------------------------------------------------
    // Zamanlayıcı: üç rapor, her biri kendi saatlerinde (30 dk pencere).
    // gece.gonderim'de dakika + kayma: gece 0, kaldırma 14000, itiraz 16000
    // (performans 10000 ve 12000). Rapor penceresi: aynı raporun bir önceki
    // gönderiminden bu yana, en çok 24 saat.
    // -----------------------------------------------------------------

    const RAPORLAR = {
        gece: { kayma: 0, bolum: (A) => A.gece, hazirla: (u, son, s) => raporHazirla(u, son, s) },
        kaldirma: { kayma: KAYMA.kaldirma, bolum: (A) => A.kaldirmaRapor, hazirla: (u, son, s) => kaldirmaRaporu(u, son, s) },
        itiraz: { kayma: KAYMA.itiraz, bolum: (A) => A.itirazRapor, hazirla: (u, son, s) => itirazRaporu(u, son, s) },
    };

    let calisiyor = false;
    let dakikaKolonu = true;
    async function geceTuru() {
        if (calisiyor || !telegram.hazirMi()) return;
        const z = istanbul();
        const simdiDk = z.saat * 60 + z.dakika;
        calisiyor = true;
        try {
            let r;
            try {
                r = await pool.query(
                    `SELECT DISTINCT u.username, u.is_admin, u.premium_features, a.acik, a.ayrinti
                       FROM users u
                       JOIN rapor.telegram_baglantilari t ON t.username = u.username AND t.durum = 'aktif'
                       LEFT JOIN gece.ayar a ON a.username = u.username
                      WHERE u.is_active AND (u.trial_end IS NULL OR u.trial_end > now())`
                );
            } catch (e) {
                if (e.code !== '42703') { if (!semaYok(e)) console.error('gece-raporu tur:', e.message); return; }
                // ayrıntı kolonu yok (telegram_ayar.sql çalışmadı): eski davranış, yalnız 01:00
                r = await pool.query(
                    `SELECT DISTINCT u.username, u.is_admin, u.premium_features, a.acik, NULL::jsonb AS ayrinti
                       FROM users u
                       JOIN rapor.telegram_baglantilari t ON t.username = u.username AND t.durum = 'aktif'
                       LEFT JOIN gece.ayar a ON a.username = u.username
                      WHERE u.is_active AND (u.trial_end IS NULL OR u.trial_end > now())`
                ).catch(() => ({ rows: [] }));
            }
            for (const u of r.rows) {
                if (!u.is_admin && !hakAcik(u.premium_features)) continue;
                let A = u.ayrinti ? ta.duzelt(u.ayrinti) : ta.duzelt({});
                if (typeof u.acik === 'boolean') A.gece.acik = u.acik;
                if (!u.ayrinti && u.acik === false) { A.kaldirmaRapor.acik = false; A.itirazRapor.acik = false; }
                for (const [tur, T] of Object.entries(RAPORLAR)) {
                    const B = T.bolum(A);
                    // Dakika kolonu yoksa üç rapor ayrı işaretlenemez: eskisi gibi tek rapor, 01:00
                    if (!dakikaKolonu && tur !== 'gece') continue;
                    if (!B.acik && !(tur === 'gece' && !dakikaKolonu)) continue;
                    const saatler = u.ayrinti ? B.saatler : [60];
                    const dakika = saatler.find((s) => simdiDk >= s && simdiDk < s + 30);
                    if (dakika == null) continue;
                    try {
                        // Önce işaretle: sunucu yarıda düşse de aynı rapor ikinci kez gitmesin
                        let isaret;
                        if (dakikaKolonu) {
                            try {
                                isaret = await pool.query(
                                    `INSERT INTO gece.gonderim (username, gun, dakika) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1`,
                                    [u.username, z.gun, T.kayma + dakika]
                                );
                            } catch (e) {
                                if (e.code !== '42703') throw e;
                                dakikaKolonu = false;
                                if (tur !== 'gece') continue;
                            }
                        }
                        if (!dakikaKolonu) {
                            if (dakika !== 60 || !A.gece.acik) continue;
                            isaret = await pool.query(
                                `INSERT INTO gece.gonderim (username, gun) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1`,
                                [u.username, z.gun]
                            );
                        }
                        if (!isaret.rows.length) continue;
                        const son = new Date();
                        let bas = new Date(son.getTime() - GUN_MS);
                        if (dakikaKolonu) {
                            const o = await pool.query(
                                `SELECT max(gonderildi) AS t FROM gece.gonderim
                                  WHERE username = $1 AND dakika >= $4 AND dakika < $4 + 1440
                                    AND NOT (gun = $2 AND dakika = $3) AND kart > 0`,
                                [u.username, z.gun, T.kayma + dakika, T.kayma]
                            );
                            const t = o.rows[0] && o.rows[0].t ? new Date(o.rows[0].t) : null;
                            if (t && t.getTime() > bas.getTime() && t.getTime() < son.getTime() - 10 * 60000) bas = t;
                        }
                        const rapor = await T.hazirla(u.username, son, { ayar: A, bas, dakika, birlesik: !dakikaKolonu });
                        const s = await gonder(u.username, rapor);
                        await pool.query(
                            dakikaKolonu ? 'UPDATE gece.gonderim SET kart = $4 WHERE username = $1 AND gun = $2 AND dakika = $3'
                                : 'UPDATE gece.gonderim SET kart = $3 WHERE username = $1 AND gun = $2',
                            dakikaKolonu ? [u.username, z.gun, T.kayma + dakika, s.giden ? rapor.kartlar.length : 0] : [u.username, z.gun, s.giden ? rapor.kartlar.length : 0]
                        );
                    } catch (e) {
                        console.error('gece-raporu ' + tur + ' ' + u.username + ':', e.message);
                    }
                    await new Promise((res) => setTimeout(res, 1500));
                }
            }
        } finally {
            calisiyor = false;
        }
    }
    setInterval(() => { geceTuru().catch((e) => console.error('gece-raporu:', e.message)); }, 60000).unref();

    // -----------------------------------------------------------------
    // Uçlar
    // -----------------------------------------------------------------

    /** Asistan penceresinin gösterdiği durum: eski anahtarlar, saatler, bağlı hesaplar, son gönderim */
    async function durumOku(u) {
        const [o, g, h] = await Promise.all([
            ta.ayarOku(pool, u),
            sonGonderimler(u),
            alicilar(u),
        ]);
        const e = ta.eskiKolonlar(o.ayar);
        const it = o.ayar.itirazRapor;
        return {
            ok: true, acik: e.acik, bekleyen: e.bekleyen, foto: e.foto, hesap: h.length,
            // saatler: gece raporu (sayım sonuçları ondan önce okunur); itirazSaatler: itirazlar ondan önce eşitlenir
            saatler: o.ayar.gece.saatler,
            itirazSaatler: it.acik ? it.saatler : [],
            hesaplar: h.map((x) => ({ ad: x.tg_ad || '', kullanici: x.tg_kullanici_adi || '' })),
            son: g.gece || null,
        };
    }

    /** Her raporun son gönderimi: { gece, kaldirma, itiraz } (dakika kolonu yoksa yalnız gece) */
    async function sonGonderimler(u) {
        try {
            const r = await pool.query(
                `SELECT gun::text AS gun, gonderildi, kart, dakika FROM gece.gonderim
                  WHERE username = $1 AND kart IS NOT NULL ORDER BY gonderildi DESC LIMIT 60`,
                [u]
            );
            const sonuc = {};
            r.rows.forEach((x) => {
                const d = Number(x.dakika);
                const tur = d >= KAYMA.itiraz ? 'itiraz' : d >= KAYMA.kaldirma ? 'kaldirma' : d < 1440 ? 'gece' : null;
                if (tur && !sonuc[tur]) sonuc[tur] = { gun: x.gun, gonderildi: x.gonderildi, kart: x.kart };
            });
            return sonuc;
        } catch (e) {
            if (e.code !== '42703') return {};
            const r = await pool.query('SELECT gun::text AS gun, gonderildi, kart FROM gece.gonderim WHERE username = $1 AND kart IS NOT NULL ORDER BY gonderildi DESC LIMIT 1', [u])
                .catch(() => ({ rows: [] }));
            return { gece: r.rows[0] || null };
        }
    }

    app.get('/api/gece-raporu/ayar', uye, async (req, res) => {
        const u = req.auth.username;
        try {
            res.json(await durumOku(u));
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('gece-raporu ayar:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Asistan penceresi: yalnız gönderilen eski anahtarlar değişir, ayrıntı da eşitlenir */
    app.post('/api/gece-raporu/ayar', uye, async (req, res) => {
        const b = req.body || {};
        const u = req.auth.username;
        try {
            const o = await ta.ayarOku(pool, u);
            const yazildi = await ta.ayarYaz(pool, u, ta.pencereden(o.ayar, b));
            if (!yazildi && (typeof b.bekleyen === 'boolean' || typeof b.foto === 'boolean')) {
                // Eski kurulumda bekleyen/foto kolonları da yoksa
                const kontrol = await ta.ayarOku(pool, u);
                const e = ta.eskiKolonlar(kontrol.ayar);
                if ((typeof b.bekleyen === 'boolean' && e.bekleyen !== b.bekleyen) || (typeof b.foto === 'boolean' && e.foto !== b.foto)) {
                    return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
                }
            }
            res.json(await durumOku(u));
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('gece-raporu ayar yaz:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Deneme: raporu şimdi gönder (son 24 saat, kayıtlı ayarla) */
    app.post('/api/gece-raporu/simdi', uye, async (req, res) => {
        const u = req.auth.username;
        if (!telegram.hazirMi()) return res.status(503).json({ ok: false, error: 'bot_hazir_degil' });
        if (!pencere('simdi-ara:' + u, 1, 120000)) return res.status(429).json({ ok: false, error: 'cok_sik', bekleSn: 120 });
        if (!pencere('simdi-gun:' + u, 10, GUN_MS)) return res.status(429).json({ ok: false, error: 'gunluk_sinir' });
        try {
            // Eski Asistan penceresinin "Test Gönder" düğmesi: bütün içerik tek albümde
            const rapor = await raporHazirla(u, new Date(), { birlesik: true });
            const s = await gonder(u, rapor);
            if (s.bos) return res.status(409).json({ ok: false, error: 'bos' });
            if (s.hata === 'baglanti_yok') return res.status(409).json({ ok: false, error: 'baglanti_yok' });
            if (!s.giden) return res.status(502).json({ ok: false, error: 'gonderilemedi' });
            res.json({ ok: true, kart: rapor.kartlar.length, giden: s.giden });
        } catch (e) {
            console.error('gece-raporu simdi:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    // -----------------------------------------------------------------
    // Telegram Raporları sayfası (/telegram/)
    // -----------------------------------------------------------------

    /** Ayar + sayfanın ihtiyaç duyduğu bilgiler */
    app.get('/api/telegram-ayar', uye, async (req, res) => {
        const u = req.auth.username;
        try {
            const [o, h, g, sb] = await Promise.all([
                ta.ayarOku(pool, u),
                alicilar(u),
                sonGonderimler(u),
                pool.query(
                    `SELECT COALESCE(NULLIF(sebep, ''), 'Sebep yok') AS sebep, count(*)::int AS adet FROM kaldirma.kayitlar
                      WHERE username = $1 AND olusturma > now() - interval '60 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 40`,
                    [u]
                ).catch(() => ({ rows: [] })),
            ]);
            res.json({
                ok: true, ayar: o.ayar, kurulum: o.kurulum, varsayilan: ta.duzelt({}),
                performansKatalog: require('../performans/sutunlar').katalog(),
                hesaplar: h.map((x) => ({ ad: x.tg_ad || '', kullanici: x.tg_kullanici_adi || '' })),
                son: g.gece || null,
                sonlar: g,
                sebepler: sb.rows.map((x) => ({ ad: x.sebep, adet: x.adet })),
                bot: telegram.hazirMi(),
            });
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('telegram-ayar oku:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Kısmi güncelleme: gönderilen alanlar kayıtlı ayarın üstüne birleştirilir */
    app.post('/api/telegram-ayar', uye, async (req, res) => {
        const u = req.auth.username;
        const b = req.body || {};
        if (!b.ayar || typeof b.ayar !== 'object' || Array.isArray(b.ayar)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        if (!pencere('ayar-yaz:' + u, 20, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
        try {
            const o = await ta.ayarOku(pool, u);
            const yeni = ta.duzelt(ta.birlestir(o.ayar, b.ayar));
            const kurulum = await ta.ayarYaz(pool, u, yeni);
            onizlemeOnbellek.clear();
            res.json({ ok: true, ayar: yeni, kurulum });
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('telegram-ayar yaz:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /* Önizleme: Telegram'a gidecek kartların aynısı, 720 px'e küçültülmüş.
       Aynı ayar ve veri için 2 dk önbellekte; dakikada en çok 15. */
    const onizlemeOnbellek = new Map();
    const ONIZLEME_MS = 2 * 60 * 1000;

    app.post('/api/telegram-ayar/onizleme', uye, async (req, res) => {
        const u = req.auth.username;
        const b = req.body || {};
        const tur = RAPOR_TURU.has(b.rapor) ? b.rapor : 'gece';
        const ornek = b.veri === 'ornek';
        try {
            const o = await ta.ayarOku(pool, u);
            const A = b.ayar && typeof b.ayar === 'object' ? ta.duzelt(ta.birlestir(o.ayar, b.ayar)) : o.ayar;
            const bolum = { anlik: A.anlik, kaldirma: A.kaldirmaRapor, itiraz: A.itirazRapor, gece: A.gece }[tur];
            const anahtar = u + '|' + tur + '|' + (ornek ? 'o' : 'g') + '|' + JSON.stringify(bolum);
            const eski = onizlemeOnbellek.get(anahtar);
            if (eski && Date.now() - eski.zaman < ONIZLEME_MS) return res.json(eski.sonuc);
            if (!pencere('onizleme:' + u, 15, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });

            let sonuc;
            if (tur === 'anlik') {
                sonuc = { ok: true, tur, mesajlar: await anlikOrnek(u, A.anlik, ornek) };
            } else {
                const dakika = bolum.saatler[0];
                const hazirla = tur === 'kaldirma' ? kaldirmaRaporu : tur === 'itiraz' ? itirazRaporu : raporHazirla;
                const rapor = await hazirla(u, new Date(), { ayar: A, onizleme: true, ornek, dakika });
                // Yatay kartlar geniş: önizlemede 1600 px (yazılar okunsun)
                const en = tur === 'gece' ? 720 : 1600;
                sonuc = {
                    ok: true, tur, baslik: rapor.baslik,
                    kartlar: rapor.kartlar.map((k) => 'data:image/png;base64,' + kucult(k, en).toString('base64')),
                };
            }
            if (onizlemeOnbellek.size > 300) onizlemeOnbellek.clear();
            onizlemeOnbellek.set(anahtar, { zaman: Date.now(), sonuc });
            res.json(sonuc);
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('telegram-ayar onizleme:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /**
     * Anlık bildirim örnekleri: seçili durumlar için birer mesaj.
     * Gerçek veride son 30 günün o durumdaki en yeni kaydı; yoksa kurgusal.
     */
    async function anlikOrnek(u, an, ornek) {
        const durumlar = [];
        if (an.iptal) durumlar.push(700);
        if (an.red) durumlar.push(160);
        if (an.tamam) durumlar.push(600);
        const sonuc = [];
        for (const durum of durumlar) {
            let k = null;
            if (!ornek) {
                try {
                    const r = await pool.query(
                        `SELECT durum, sebep, adet, olusturma, veri FROM kaldirma.kayitlar
                          WHERE username = $1 AND durum = $2 AND olusturma > now() - interval '30 days'
                          ORDER BY olusturma DESC LIMIT 1`,
                        [u, durum]
                    );
                    if (r.rows[0]) k = { ...r.rows[0], adet: Number(r.rows[0].adet) || 0 };
                } catch (e) { if (!semaYok(e)) throw e; }
            }
            if (!k) {
                const kt = await katalogAl();
                const x = [...kt.ad.values()][durum % 97] || null;
                k = {
                    durum, sebep: durum === 160 ? 'Son Kullanma Tarihi Geçti' : 'Ürün Bozuk', adet: 2,
                    olusturma: new Date(Date.now() - 3 * 3600000).toISOString(),
                    veri: {
                        urun: { ad: x ? x.ad : 'Örnek ürün', gorsel: x ? x.image : '' },
                        altNeden: '', olusturan: 'Örnek Kişi',
                        red: durum === 160 ? { baslik: 'Fotoğraf yetersiz', aciklama: '' } : null,
                    },
                    ornek: true,
                };
            }
            sonuc.push({
                durum,
                gorsel: an.gorsel && k.veri && k.veri.urun && /^https:\/\//.test(k.veri.urun.gorsel || '') ? k.veri.urun.gorsel : null,
                metin: kaldirmaModul.bildirimMetni(k, an),
                ornek: !!k.ornek,
            });
        }
        return sonuc;
    }

    /** Deneme gönderimi: sayfadaki (kaydedilmemiş olabilir) ayarla, kendi Telegram'ına */
    app.post('/api/telegram-ayar/test', uye, async (req, res) => {
        const u = req.auth.username;
        const b = req.body || {};
        const tur = RAPOR_TURU.has(b.rapor) ? b.rapor : 'gece';
        if (!telegram.hazirMi()) return res.status(503).json({ ok: false, error: 'bot_hazir_degil' });
        if (!pencere('simdi-ara:' + u, 1, 120000)) return res.status(429).json({ ok: false, error: 'cok_sik', bekleSn: 120 });
        if (!pencere('simdi-gun:' + u, 10, GUN_MS)) return res.status(429).json({ ok: false, error: 'gunluk_sinir' });
        try {
            const o = await ta.ayarOku(pool, u);
            const A = b.ayar && typeof b.ayar === 'object' ? ta.duzelt(ta.birlestir(o.ayar, b.ayar)) : o.ayar;
            const hedefler = await alicilar(u);
            if (!hedefler.length) return res.status(409).json({ ok: false, error: 'baglanti_yok' });
            if (tur === 'anlik') {
                const mesajlar = await anlikOrnek(u, A.anlik, false);
                if (!mesajlar.length) return res.status(409).json({ ok: false, error: 'bos' });
                let giden = 0;
                for (const m of mesajlar) {
                    for (const h of hedefler) {
                        try {
                            if (m.gorsel) await telegram.cagir('sendPhoto', { chat_id: h.chat_id, photo: m.gorsel, caption: '🧪 Deneme\n' + m.metin });
                            else await telegram.mesaj(h.chat_id, '🧪 Deneme\n' + m.metin);
                            giden++;
                        } catch (e) {
                            try { await telegram.mesaj(h.chat_id, '🧪 Deneme\n' + m.metin); giden++; } catch (x) { /* sessiz */ }
                        }
                        await new Promise((r) => setTimeout(r, 400));
                    }
                }
                return res.json({ ok: true, giden, kart: mesajlar.length });
            }
            const hazirla = tur === 'kaldirma' ? kaldirmaRaporu : tur === 'itiraz' ? itirazRaporu : raporHazirla;
            const bolum = { kaldirma: A.kaldirmaRapor, itiraz: A.itirazRapor, gece: A.gece }[tur];
            const rapor = await hazirla(u, new Date(), { ayar: A, dakika: bolum.saatler[0] });
            rapor.baslik = '🧪 Deneme\n' + rapor.baslik;
            const s = await gonder(u, rapor);
            if (s.bos) return res.status(409).json({ ok: false, error: 'bos' });
            if (!s.giden) return res.status(502).json({ ok: false, error: 'gonderilemedi' });
            res.json({ ok: true, kart: rapor.kartlar.length, giden: s.giden });
        } catch (e) {
            console.error('telegram-ayar test:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Asistan: günlük sayımın depo panelindeki durumu (rapordan önce) */
    app.post('/api/gece-raporu/gunluk-durum', uye, async (req, res) => {
        const b = req.body || {};
        const gun = typeof b.gun === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.gun) ? b.gun : null;
        const sayi = (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 5000 ? Number(v) : null);
        const toplam = sayi(b.toplam);
        const tamam = sayi(b.tamam);
        if (!gun || toplam == null || tamam == null) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            await pool.query(
                `INSERT INTO gece.gunluk_durum (username, gun, toplam, tamam, bitti) VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (username, gun) DO UPDATE SET toplam = EXCLUDED.toplam, tamam = EXCLUDED.tamam,
                     bitti = EXCLUDED.bitti, guncelleme = now()`,
                [req.auth.username, gun, toplam, Math.min(tamam, toplam), b.bitti === true]
            );
            res.json({ ok: true });
        } catch (e) {
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('gunluk-durum:', e.message);
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
