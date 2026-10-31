/**
 * Sayım farkı ve sıfırlanan ürünler
 * ============================================================================
 * Veri: public.sayim_gecmisi. Sayım Geçmişi, gece raporundan önceki okuma ve
 * Sayım Farkı sayfasının "Panelden Güncelle"si (Asistan, panelin kendi
 * istekleriyle) her görevin sistem ve sayılan adedini oraya yazıyor. Burada
 * yalnız o tablodan derleniyor; depo paneline istek yok.
 *
 * Her sayım görevi ayrı bir olay: bir ürün ay içinde sıfırlanıp sonra
 * yeniden sayılsa da sıfırlanma kaydı kaybolmaz.
 *
 *   GET /api/sayim-fark/rapor?bas=YYYY-MM-DD&son=YYYY-MM-DD&tur=hepsi|gunluk|elle
 *     { ok, aralik, olaylar:[{ g, s, p, ad, sis, fiz, fark, durum, o, z, sa }],
 *       sayimlar:[{ s, o, sa, bit, urun, sifir, eksik, fazla, n }],
 *       tam:[sayım kimliği] (eksiksiz okunmuş, yeniden okunmaz),
 *       veri:{ ilk, son } (tablodaki en eski sayım, en son yazım) }
 *     durum: 'sifir' (sistemde vardı, 0 sayıldı) | 'eksik' | 'fazla'
 *
 * Zamanlı Telegram raporu (gece-raporu/index.js) raporVerisi ve
 * raporlandi'yı kullanır; gönderilen görevler sayim_fark.raporlanan'a
 * yazılır (sql_files/sayim_fark.sql). Tablo yoksa sayımın bitiş saatine
 * göre seçilir.
 *
 * Tablo yoksa (sayim_gecmisi_paylasim.sql çalışmadıysa) 503 kurulum_bekleniyor.
 * SINIR: kullanıcı başına dakikada 30 istek; aralık en çok 93 gün.
 * ============================================================================
 */
'use strict';

const HAKLAR = ['stokSayimi', 'jetBarkodAsistan'];
const GUN_MS = 24 * 3600 * 1000;
const EN_COK_GUN = 93;
const EN_COK_OLAY = 8000;
const TURLER = new Set(['hepsi', 'gunluk', 'elle']);

function hakAcik(pf) {
    if (!pf || typeof pf !== 'object') return false;
    return HAKLAR.some((h) => {
        const f = pf[h];
        return f === true || (f && typeof f === 'object' && f.enabled === true);
    });
}

const yuvarla = (n) => Math.round(Number(n) * 1000) / 1000;

function durumu(sis, fiz) {
    if (fiz === 0 && sis > 0) return 'sifir';
    return fiz < sis ? 'eksik' : 'fazla';
}

/** Sayım türü süzgeci (SQL parçası): hepsi | gunluk (otomatik 50'lik) | elle */
function turKosulu(tur) {
    return tur === 'gunluk' ? ' AND otomatik' : tur === 'elle' ? ' AND NOT otomatik' : '';
}

function olayYap(x) {
    const sis = Number(x.sistem);
    const fiz = Number(x.fiziksel);
    return {
        g: x.gorev_id, s: x.sayim_id, p: x.product_id, ad: x.urun_adi || '',
        sis, fiz, fark: yuvarla(fiz - sis), durum: durumu(sis, fiz),
        o: x.otomatik === true, z: x.zaman, sa: x.sayim_at,
    };
}

/**
 * Telegram raporu için farklar.
 * secenek: { bas: Date, son: Date, tur, yeni: true (raporlanmamış görevler, bas'tan bağımsız
 *            son 'geriGun' gün), geriGun }
 * Dönüş: { olaylar (fark olan bütün görevler), sayim (oturum sayısı), urun (sayılan görev), yeniMod }
 */
async function raporVerisi(pool, u, secenek) {
    const tur = TURLER.has(secenek.tur) ? secenek.tur : 'hepsi';
    const kosul = turKosulu(tur);
    const zaman = 'COALESCE(tamamlandi_at, sayim_at)';
    let r;
    let yeniMod = false;
    if (secenek.yeni) {
        const alt = new Date(secenek.son.getTime() - (secenek.geriGun || 4) * GUN_MS);
        try {
            r = await pool.query(
                `SELECT g.gorev_id, g.sayim_id, g.product_id, g.urun_adi, g.sistem, g.fiziksel, g.otomatik, g.sayim_at,
                        ${zaman} AS zaman
                   FROM public.sayim_gecmisi g
                  WHERE g.username = $1 AND ${zaman} > $2 AND ${zaman} <= $3${kosul}
                    AND NOT EXISTS (SELECT 1 FROM sayim_fark.raporlanan x WHERE x.username = g.username AND x.gorev_id = g.gorev_id)`,
                [u, alt, secenek.son]
            );
            yeniMod = true;
        } catch (e) {
            // sayim_fark.sql çalışmadı: pencere, sayımın bitiş saatine göre
            if (!(e && (e.code === '3F000' || e.code === '42P01')) || !/raporlanan|sayim_fark/.test(String(e.message))) throw e;
        }
    }
    if (!r) {
        r = await pool.query(
            `SELECT gorev_id, sayim_id, product_id, urun_adi, sistem, fiziksel, otomatik, sayim_at, ${zaman} AS zaman
               FROM public.sayim_gecmisi
              WHERE username = $1 AND ${zaman} > $2 AND ${zaman} <= $3${kosul}`,
            [u, secenek.bas, secenek.son]
        );
    }
    const oturum = new Set();
    const olaylar = [];
    for (const x of r.rows) {
        oturum.add(x.sayim_id);
        if (Number(x.fiziksel) !== Number(x.sistem)) olaylar.push(olayYap(x));
    }
    return { olaylar, sayim: oturum.size, urun: r.rows.length, yeniMod, gorevler: r.rows.map((x) => x.gorev_id) };
}

/** Gönderilen görevleri işaretler (tablo yoksa sessiz) */
async function raporlandi(pool, u, gorevler) {
    if (!gorevler.length) return;
    try {
        for (let i = 0; i < gorevler.length; i += 2000) {
            await pool.query(
                `INSERT INTO sayim_fark.raporlanan (username, gorev_id)
                 SELECT $1, x FROM unnest($2::text[]) AS x ON CONFLICT DO NOTHING`,
                [u, gorevler.slice(i, i + 2000)]
            );
        }
    } catch (e) {
        if (!(e && (e.code === '3F000' || e.code === '42P01'))) throw e;
    }
}

/** Sayfadan gelen gün aralığı (İstanbul) → { basGun, sonGun, bas, son } | null */
function aralikOku(q) {
    const g = (x) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
    const basGun = g(q.bas);
    const sonGun = g(q.son) || basGun;
    if (!basGun || !sonGun || sonGun < basGun) return null;
    const bas = new Date(basGun + 'T00:00:00.000+03:00');
    const son = new Date(sonGun + 'T23:59:59.999+03:00');
    if (!(bas < son) || son - bas > EN_COK_GUN * GUN_MS) return null;
    return { basGun, sonGun, bas, son };
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

    const semaYok = (e) => e && (e.code === '3F000' || e.code === '42P01');

    function hata(res, e, yer) {
        if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
        console.error('sayim-fark ' + yer + ':', e.message);
        return res.status(500).json({ ok: false, error: 'server_error' });
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
            if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            console.error('sayim-fark uye:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
        req.auth = c;
        next();
    }

    app.get('/api/sayim-fark/rapor', uye, async (req, res) => {
        const u = req.auth.username;
        const ar = aralikOku(req.query || {});
        if (!ar) return res.status(400).json({ ok: false, error: 'gecersiz_aralik' });
        const tur = TURLER.has(req.query.tur) ? req.query.tur : 'hepsi';
        const kosul = turKosulu(tur);
        const zaman = 'COALESCE(tamamlandi_at, sayim_at)';
        try {
            const [o, s, v] = await Promise.all([
                pool.query(
                    `SELECT gorev_id, sayim_id, product_id, urun_adi, sistem, fiziksel, otomatik, sayim_at, ${zaman} AS zaman
                       FROM public.sayim_gecmisi
                      WHERE username = $1 AND ${zaman} >= $2 AND ${zaman} <= $3 AND fiziksel <> sistem${kosul}
                      ORDER BY ${zaman} DESC
                      LIMIT ${EN_COK_OLAY + 1}`,
                    [u, ar.bas, ar.son]
                ),
                pool.query(
                    `SELECT sayim_id, bool_or(otomatik) AS otomatik, min(sayim_at) AS sayim_at, max(${zaman}) AS bit,
                            count(*)::int AS urun, max(sayim_gorev_sayisi) AS n,
                            count(*) FILTER (WHERE fiziksel = 0 AND sistem > 0)::int AS sifir,
                            count(*) FILTER (WHERE fiziksel < sistem AND NOT (fiziksel = 0 AND sistem > 0))::int AS eksik,
                            count(*) FILTER (WHERE fiziksel > sistem)::int AS fazla
                       FROM public.sayim_gecmisi
                      WHERE username = $1 AND ${zaman} >= $2 AND ${zaman} <= $3${kosul}
                      GROUP BY sayim_id
                      ORDER BY min(sayim_at) DESC
                      LIMIT 2000`,
                    [u, ar.bas, ar.son]
                ),
                pool.query(
                    'SELECT min(sayim_at) AS ilk, max(guncellendi_at) AS son FROM public.sayim_gecmisi WHERE username = $1',
                    [u]
                ),
            ]);
            const kesildi = o.rows.length > EN_COK_OLAY;
            const sayimlar = s.rows.map((x) => ({
                s: x.sayim_id, o: x.otomatik === true, sa: x.sayim_at, bit: x.bit,
                urun: x.urun, n: x.n != null ? Number(x.n) : null, sifir: x.sifir, eksik: x.eksik, fazla: x.fazla,
            }));
            res.json({
                ok: true,
                aralik: { bas: ar.basGun, son: ar.sonGun, tur },
                olaylar: o.rows.slice(0, EN_COK_OLAY).map(olayYap),
                kesildi,
                sayimlar,
                // Görev sayısı kadar kaydı olan sayım tamdır; panelden yeniden okunmaz
                tam: sayimlar.filter((x) => x.n && x.urun >= x.n).map((x) => x.s),
                veri: { ilk: v.rows[0] ? v.rows[0].ilk : null, son: v.rows[0] ? v.rows[0].son : null },
            });
        } catch (e) { hata(res, e, 'rapor'); }
    });
}

module.exports = { kur, raporVerisi, raporlandi, durumu };
