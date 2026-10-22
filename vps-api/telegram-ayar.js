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
        bolumler: { ozet: true, kaldirma: true, itiraz: true, sayim: true },
        kaldirma: {
            red: { goster: true, foto: false },
            bekleyen: { goster: false, foto: false },
            tamam: { goster: false, foto: false },
            yenidenGizle: false,
            sebepler: null,          // null: hepsi
            sinir: 20,
        },
        itiraz: { bekleyen: 'hepsi', sonuc: true, not: true, metin: true },
        sayim: { gunluk: true, diger: true, saatler: true, liste: 'fark', esik: 0, farksiz: true },
    },
    anlik: { iptal: true, red: false, tamam: false, gorsel: true, olusturan: true },
    kaldirmaGonder: { ozet: true, red: true, bekleyen: true, tamam: false, foto: false },
});

const SINIRLAR = new Set([10, 20, 40]);
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

/** Ham nesneyi izinli biçime çevirir; eksik alanlar varsayılandan */
function duzelt(ham) {
    const h = nesne(ham);
    const V = VARSAYILAN;
    const g = nesne(h.gece);
    const gk = nesne(g.kaldirma);
    const gi = nesne(g.itiraz);
    const gs = nesne(g.sayim);
    const gb = nesne(g.bolumler);
    const a = nesne(h.anlik);
    const kg = nesne(h.kaldirmaGonder);
    const sonuc = {
        gece: {
            acik: mantik(g.acik, V.gece.acik),
            saatler: saatleriDuzelt(g.saatler, V.gece.saatler),
            bolumler: {
                ozet: mantik(gb.ozet, true), kaldirma: mantik(gb.kaldirma, true),
                itiraz: mantik(gb.itiraz, true), sayim: mantik(gb.sayim, true),
            },
            kaldirma: {
                red: grup(gk.red, V.gece.kaldirma.red),
                bekleyen: grup(gk.bekleyen, V.gece.kaldirma.bekleyen),
                tamam: grup(gk.tamam, V.gece.kaldirma.tamam),
                yenidenGizle: mantik(gk.yenidenGizle, false),
                sebepler: Array.isArray(gk.sebepler)
                    ? [...new Set(gk.sebepler.filter((x) => typeof x === 'string').map((x) => x.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200)).filter(Boolean))].slice(0, 40)
                    : null,
                sinir: SINIRLAR.has(Number(gk.sinir)) ? Number(gk.sinir) : V.gece.kaldirma.sinir,
            },
            itiraz: {
                bekleyen: BEKLEYEN_ITIRAZ.has(gi.bekleyen) ? gi.bekleyen : 'hepsi',
                sonuc: mantik(gi.sonuc, true), not: mantik(gi.not, true), metin: mantik(gi.metin, true),
            },
            sayim: {
                gunluk: mantik(gs.gunluk, true), diger: mantik(gs.diger, true), saatler: mantik(gs.saatler, true),
                liste: LISTE.has(gs.liste) ? gs.liste : 'fark',
                esik: ESIKLER.has(Number(gs.esik)) ? Number(gs.esik) : 0,
                farksiz: mantik(gs.farksiz, true),
            },
        },
        anlik: {
            iptal: mantik(a.iptal, true), red: mantik(a.red, false), tamam: mantik(a.tamam, false),
            gorsel: mantik(a.gorsel, true), olusturan: mantik(a.olusturan, true),
        },
        kaldirmaGonder: {
            ozet: mantik(kg.ozet, true), red: mantik(kg.red, true), bekleyen: mantik(kg.bekleyen, true),
            tamam: mantik(kg.tamam, false), foto: mantik(kg.foto, false),
        },
    };
    // Boş rapor olmasın: hiçbir bölüm seçilmediyse özet açık
    const b = sonuc.gece.bolumler;
    if (!b.ozet && !b.kaldirma && !b.itiraz && !b.sayim) b.ozet = true;
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
    if (s.bekleyen === true) a.gece.kaldirma.bekleyen.goster = true;
    if (s.foto === true) { a.gece.kaldirma.red.foto = true; a.gece.kaldirma.bekleyen.foto = true; }
    return a;
}

/** Ayrıntıdan eski kolonlar (Asistan penceresi bunları gösteriyor) */
function eskiKolonlar(a) {
    const k = a.gece.kaldirma;
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
    if (typeof b.bekleyen === 'boolean') a.gece.kaldirma.bekleyen.goster = b.bekleyen;
    if (typeof b.foto === 'boolean') { a.gece.kaldirma.red.foto = b.foto; a.gece.kaldirma.bekleyen.foto = b.foto; }
    return a;
}

const saatYazi = (dk) => String(Math.floor(dk / 60)).padStart(2, '0') + ':' + String(dk % 60).padStart(2, '0');

module.exports = { VARSAYILAN, duzelt, birlestir, ayarOku, ayarYaz, pencereden, eskiKolonlar, saatYazi, SAAT_ADIM, EN_COK_SAAT };
