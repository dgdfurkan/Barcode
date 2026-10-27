/**
 * Telegram raporlarının ayarı (Telegram Raporları sayfası, /telegram/)
 * ============================================================================
 *
 * Hesap başına tek nesne, gece.ayar.ayrinti (jsonb). Eski kolonlar (acik,
 * bekleyen, foto) Asistan penceresinin anahtarları; iki yönlü eşitlenir:
 *   - Pencere bekleyen/foto değiştirince ayrıntıdaki karşılıkları değişir.
 *   - Sayfa kaydedince eski kolonlar ayrıntıdan yeniden yazılır.
 * Böylece eski Asistan sürümleri de doğru çalışır.
 *
 * Satıştan kaldırma ve itirazlar kendi raporlarında (kaldirmaRapor,
 * itirazRapor: ayrı saat, ayrı mesaj). Eskiden gece raporunun bölümleriydi;
 * kayıtlı ayarda yoksa gece raporundaki eski seçimden türetilir (gecedenTuret).
 *
 * Tarayıcıdan gelen hiçbir alana güvenilmez: bilinmeyen alan atılır, her
 * değer izinli listeden ya da tipine göre düzeltilir (duzelt).
 * ============================================================================
 */
'use strict';

/* Gönderim saatleri: gün içinde dakika (60 = 01:00), 30 dakikalık adımlar */
const SAAT_ADIM = 30;
const EN_COK_SAAT = 4;

const VARSAYILAN = Object.freeze({
    gece: {
        acik: true,
        saatler: [60],
        bolumler: { ozet: true, sayim: true },
        sayim: { gunluk: true, diger: true, saatler: true, liste: 'fark', esik: 0, farksiz: true },
    },
    /* Satıştan kaldırma raporu: grup başına göster/fotoğraf */
    kaldirmaRapor: {
        acik: true,
        saatler: [60],
        red: { goster: true, foto: false },
        bekleyen: { goster: false, foto: false },
        tamam: { goster: false, foto: false },
        yenidenGizle: false,
        sebepler: null,          // null: hepsi
        sinir: 20,
        tamKalite: false,
    },
    /* İtiraz raporu: bekleyenler ve sonuçlananlar; siparişin içeriği ve kişileri */
    itirazRapor: {
        acik: true,
        saatler: [60],
        bekleyen: 'hepsi',
        sonuc: true,
        not: true,
        metin: true,
        siparis: true,
        kurye: true,
        toplayici: true,
        tamKalite: false,
    },
    anlik: { iptal: true, red: false, tamam: false, gorsel: true, olusturan: true },
    kaldirmaGonder: { ozet: true, red: true, bekleyen: true, tamam: false, foto: false },
    /* Performans raporları: DPS ve Kurye CDI ayrı ayrı (ayrı saat, ayrı mesaj).
       Veri kontrolü ortak: dünün sipariş toplamı eşiğin altındaysa ertelenir. */
    performans: {
        kontrol: { esik: 150, erteleme: { dakika: 30, kez: 4 }, ertelemeBildir: true, sonDenemedeGonder: true },
        dps: { acik: false, saatler: [600], kurye: true, depocu: true, denetim: true, tamKalite: true },
        kurye: { acik: false, saatler: [600], baslik: '', siralama: 'not', enAzSiparis: 1, foto: true, tamKalite: true, sutunlar: null, ozet: null },
    },
});

const SINIRLAR = new Set([0, 10, 20, 40]);   // 0: hepsi
const ESIK = new Set([0, 50, 100, 150, 200, 250]);
const ERTELEME_DK = new Set([15, 30, 60]);
const ERTELEME_KEZ = new Set([0, 1, 2, 3, 4, 6, 8]);
const KURYE_SIRA = new Set(['not', 'cdi', 'siparis', 'ad']);
const EN_AZ_SIPARIS = new Set([0, 1, 5, 10]);
const { sutunlariDuzelt, ozetDuzelt } = require('./performans/sutunlar');
const ESIKLER = new Set([0, 1, 2, 5, 10]);
const BEKLEYEN_ITIRAZ = new Set(['hepsi', 'acil', 'yok']);
const LISTE = new Set(['fark', 'hepsi']);

const kopya = (o) => JSON.parse(JSON.stringify(o));
const mantik = (v, varsayilan) => (typeof v === 'boolean' ? v : varsayilan);
const nesne = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function saatleriDuzelt(v, varsayilan) {
    if (!Array.isArray(v)) return varsayilan.slice();
    const l = [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 1440 && n % SAAT_ADIM === 0))]
        .sort((a, b) => a - b)
        .slice(0, EN_COK_SAAT);
    return l.length ? l : varsayilan.slice();
}

function grup(v, d) {
    const g = nesne(v);
    return { goster: mantik(g.goster, d.goster), foto: mantik(g.foto, d.foto) };
}

function sebeplerDuzelt(v) {
    return Array.isArray(v)
        ? [...new Set(v.filter((x) => typeof x === 'string').map((x) => x.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200)).filter(Boolean))].slice(0, 40)
        : null;
}

/**
 * Eski kayıtta kaldirmaRapor / itirazRapor yok: gece raporundaki bölüm
 * seçiminden, saatlerinden ve alt seçeneklerinden türetilir. Böylece
 * güncellemeden sonra rapor aynı saatte, aynı içerikle gitmeye devam eder.
 */
function gecedenTuret(h) {
    const g = nesne(h.gece);
    const gb = nesne(g.bolumler);
    const geceAcik = mantik(g.acik, true);
    const sonuc = {};
    if (!h.kaldirmaRapor) {
        sonuc.kaldirmaRapor = { ...nesne(g.kaldirma), acik: geceAcik && mantik(gb.kaldirma, true), saatler: g.saatler };
    }
    if (!h.itirazRapor) {
        sonuc.itirazRapor = { ...nesne(g.itiraz), acik: geceAcik && mantik(gb.itiraz, true), saatler: g.saatler };
    }
    return sonuc;
}

/** Ham nesneyi izinli biçime çevirir; eksik alanlar varsayılandan */
function duzelt(ham) {
    const h = nesne(ham);
    const V = VARSAYILAN;
    const g = nesne(h.gece);
    const turev = gecedenTuret(h);
    const gk = nesne(h.kaldirmaRapor || turev.kaldirmaRapor);
    const gi = nesne(h.itirazRapor || turev.itirazRapor);
    const gs = nesne(g.sayim);
    const gb = nesne(g.bolumler);
    const a = nesne(h.anlik);
    const kg = nesne(h.kaldirmaGonder);
    const pf = nesne(h.performans);
    const pk = nesne(pf.kontrol);
    const pe = nesne(pk.erteleme);
    const pd = nesne(pf.dps);
    const pc = nesne(pf.kurye);
    const VP = V.performans;
    const sonuc = {
        gece: {
            acik: mantik(g.acik, V.gece.acik),
            saatler: saatleriDuzelt(g.saatler, V.gece.saatler),
            bolumler: { ozet: mantik(gb.ozet, true), sayim: mantik(gb.sayim, true) },
            sayim: {
                gunluk: mantik(gs.gunluk, true), diger: mantik(gs.diger, true), saatler: mantik(gs.saatler, true),
                liste: LISTE.has(gs.liste) ? gs.liste : 'fark',
                esik: ESIKLER.has(Number(gs.esik)) ? Number(gs.esik) : 0,
                farksiz: mantik(gs.farksiz, true),
            },
        },
        kaldirmaRapor: {
            acik: mantik(gk.acik, V.kaldirmaRapor.acik),
            saatler: saatleriDuzelt(gk.saatler, V.kaldirmaRapor.saatler),
            red: grup(gk.red, V.kaldirmaRapor.red),
            bekleyen: grup(gk.bekleyen, V.kaldirmaRapor.bekleyen),
            tamam: grup(gk.tamam, V.kaldirmaRapor.tamam),
            yenidenGizle: mantik(gk.yenidenGizle, false),
            sebepler: sebeplerDuzelt(gk.sebepler),
            sinir: SINIRLAR.has(Number(gk.sinir)) ? Number(gk.sinir) : V.kaldirmaRapor.sinir,
            tamKalite: mantik(gk.tamKalite, false),
        },
        itirazRapor: {
            acik: mantik(gi.acik, V.itirazRapor.acik),
            saatler: saatleriDuzelt(gi.saatler, V.itirazRapor.saatler),
            bekleyen: BEKLEYEN_ITIRAZ.has(gi.bekleyen) ? gi.bekleyen : 'hepsi',
            sonuc: mantik(gi.sonuc, true), not: mantik(gi.not, true), metin: mantik(gi.metin, true),
            siparis: mantik(gi.siparis, true), kurye: mantik(gi.kurye, true), toplayici: mantik(gi.toplayici, true),
            tamKalite: mantik(gi.tamKalite, false),
        },
        anlik: {
            iptal: mantik(a.iptal, true), red: mantik(a.red, false), tamam: mantik(a.tamam, false),
            gorsel: mantik(a.gorsel, true), olusturan: mantik(a.olusturan, true),
        },
        kaldirmaGonder: {
            ozet: mantik(kg.ozet, true), red: mantik(kg.red, true), bekleyen: mantik(kg.bekleyen, true),
            tamam: mantik(kg.tamam, false), foto: mantik(kg.foto, false),
        },
        performans: {
            kontrol: {
                esik: ESIK.has(Number(pk.esik)) ? Number(pk.esik) : VP.kontrol.esik,
                erteleme: {
                    dakika: ERTELEME_DK.has(Number(pe.dakika)) ? Number(pe.dakika) : VP.kontrol.erteleme.dakika,
                    kez: ERTELEME_KEZ.has(Number(pe.kez)) ? Number(pe.kez) : VP.kontrol.erteleme.kez,
                },
                ertelemeBildir: mantik(pk.ertelemeBildir, true),
                sonDenemedeGonder: mantik(pk.sonDenemedeGonder, true),
            },
            dps: {
                acik: mantik(pd.acik, false),
                saatler: saatleriDuzelt(pd.saatler, VP.dps.saatler),
                kurye: mantik(pd.kurye, true), depocu: mantik(pd.depocu, true), denetim: mantik(pd.denetim, true),
                tamKalite: mantik(pd.tamKalite, true),
            },
            kurye: {
                acik: mantik(pc.acik, false),
                saatler: saatleriDuzelt(pc.saatler, VP.kurye.saatler),
                baslik: typeof pc.baslik === 'string' ? pc.baslik.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '',
                siralama: KURYE_SIRA.has(pc.siralama) ? pc.siralama : 'not',
                enAzSiparis: EN_AZ_SIPARIS.has(Number(pc.enAzSiparis)) ? Number(pc.enAzSiparis) : 1,
                foto: mantik(pc.foto, true),
                tamKalite: mantik(pc.tamKalite, true),
                sutunlar: sutunlariDuzelt(pc.sutunlar),
                ozet: ozetDuzelt(pc.ozet),
            },
        },
    };
    // Boş rapor olmasın: hiçbir bölüm seçilmediyse özet açık
    const b = sonuc.gece.bolumler;
    if (!b.ozet && !b.sayim) b.ozet = true;
    // Kaldırma raporunda en az bir grup
    const k = sonuc.kaldirmaRapor;
    if (!k.red.goster && !k.bekleyen.goster && !k.tamam.goster) k.red.goster = true;
    return sonuc;
}

/** Derin birleştirme: kısmi güncelleme (yalnız gönderilen alanlar değişir) */
function birlestir(eski, yeni) {
    if (!yeni || typeof yeni !== 'object' || Array.isArray(yeni)) return eski;
    const s = Array.isArray(eski) ? eski.slice() : { ...nesne(eski) };
    for (const [k, v] of Object.entries(yeni)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        s[k] = v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])
            ? birlestir(s[k], v) : v;
    }
    return s;
}

/** Eski kolonlar ayrıntının üstüne: Asistan penceresi en son onları değiştirmiş olabilir */
function eskiKolonlarla(ayar, satir) {
    const a = kopya(ayar);
    if (!satir) return a;
    if (typeof satir.acik === 'boolean') a.gece.acik = satir.acik;
    return a;
}

const semaEksik = (e) => e && (e.code === '3F000' || e.code === '42P01' || e.code === '42703');

/**
 * Hesabın ayarı. Dönüş: { ayar, kurulum } kurulum: ayrıntı kolonu var mı
 * Kolon yoksa (SQL çalışmadı) eski kolonlardan kurulur.
 */
async function ayarOku(pool, username) {
    try {
        const r = await pool.query('SELECT acik, bekleyen, foto, ayrinti FROM gece.ayar WHERE username = $1', [username]);
        const s = r.rows[0];
        if (!s) return { ayar: duzelt({}), kurulum: true };
        let ayar = s.ayrinti ? duzelt(s.ayrinti) : eskidenKur(s);
        ayar = eskiKolonlarla(ayar, s);
        return { ayar, kurulum: true };
    } catch (e) {
        if (!semaEksik(e)) throw e;
        try {
            const r = await pool.query('SELECT acik, bekleyen, foto FROM gece.ayar WHERE username = $1', [username]);
            return { ayar: eskidenKur(r.rows[0] || {}), kurulum: false };
        } catch (x) {
            if (!semaEksik(x)) throw x;
            try {
                const r = await pool.query('SELECT acik FROM gece.ayar WHERE username = $1', [username]);
                return { ayar: eskidenKur(r.rows[0] || {}), kurulum: false };
            } catch (y) {
                if (!semaEksik(y)) throw y;
                return { ayar: duzelt({}), kurulum: false };
            }
        }
    }
}

/** Ayrıntı yokken eski üç kolondan */
function eskidenKur(s) {
    const a = duzelt({});
    if (typeof s.acik === 'boolean') a.gece.acik = s.acik;
    if (typeof s.acik === 'boolean') { a.kaldirmaRapor.acik = s.acik; a.itirazRapor.acik = s.acik; }
    if (s.bekleyen === true) a.kaldirmaRapor.bekleyen.goster = true;
    if (s.foto === true) { a.kaldirmaRapor.red.foto = true; a.kaldirmaRapor.bekleyen.foto = true; }
    return a;
}

/** Ayrıntıdan eski kolonlar (Asistan penceresi bunları gösteriyor) */
function eskiKolonlar(a) {
    const k = a.kaldirmaRapor;
    return { acik: a.gece.acik, bekleyen: k.bekleyen.goster, foto: !!(k.red.foto || k.bekleyen.foto) };
}

/** Yazar; ayrıntı kolonu yoksa yalnız eski kolonlar. Dönüş: kurulum var mı */
async function ayarYaz(pool, username, ayar) {
    const a = duzelt(ayar);
    const e = eskiKolonlar(a);
    try {
        await pool.query(
            `INSERT INTO gece.ayar (username, acik, bekleyen, foto, ayrinti) VALUES ($1, $2, $3, $4, $5::jsonb)
             ON CONFLICT (username) DO UPDATE SET acik = EXCLUDED.acik, bekleyen = EXCLUDED.bekleyen, foto = EXCLUDED.foto,
                 ayrinti = EXCLUDED.ayrinti, guncelleme = now()`,
            [username, e.acik, e.bekleyen, e.foto, JSON.stringify(a)]
        );
        return true;
    } catch (x) {
        if (!semaEksik(x)) throw x;
        await pool.query(
            `INSERT INTO gece.ayar (username, acik, bekleyen, foto) VALUES ($1, $2, $3, $4)
             ON CONFLICT (username) DO UPDATE SET acik = EXCLUDED.acik, bekleyen = EXCLUDED.bekleyen, foto = EXCLUDED.foto, guncelleme = now()`,
            [username, e.acik, e.bekleyen, e.foto]
        ).catch(async (y) => {
            if (y.code !== '42703') throw y;
            await pool.query(
                `INSERT INTO gece.ayar (username, acik) VALUES ($1, $2)
                 ON CONFLICT (username) DO UPDATE SET acik = EXCLUDED.acik, guncelleme = now()`,
                [username, e.acik]
            );
        });
        return false;
    }
}

/** Asistan penceresinin eski anahtarları (acik, bekleyen, foto) ayrıntıya işlenir */
function pencereden(ayar, b) {
    const a = kopya(ayar);
    if (typeof b.acik === 'boolean') a.gece.acik = b.acik;
    if (typeof b.bekleyen === 'boolean') a.kaldirmaRapor.bekleyen.goster = b.bekleyen;
    if (typeof b.foto === 'boolean') { a.kaldirmaRapor.red.foto = b.foto; a.kaldirmaRapor.bekleyen.foto = b.foto; }
    return a;
}

const saatYazi = (dk) => String(Math.floor(dk / 60)).padStart(2, '0') + ':' + String(dk % 60).padStart(2, '0');

module.exports = { VARSAYILAN, duzelt, birlestir, ayarOku, ayarYaz, pencereden, eskiKolonlar, saatYazi, SAAT_ADIM, EN_COK_SAAT };
