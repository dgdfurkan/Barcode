/**
 * Sayım farkı / sıfırlanan ürünler (rapor)
 * ============================================================================
 * Veri KAYNAĞI: public.sayim_gecmisi. Bu tabloyu Sayım Geçmişi / gece raporu
 * akışı dolduruyor (Asistan panelden sistem/fiziksel stoğu okuyup
 * /api/sayim-gecmisi/yaz ile bırakıyor; artımlı, her gece). Burada yalnız O
 * veriden ürün başına son fark ve sıfırlananlar derlenip rapora dönüyor.
 * Yeni tarama, yeni tablo ya da eklenti değişikliği yok.
 *
 *   GET /api/sayim-fark/rapor[?sifir=1]
 *     { ok, ozet:{urun,sifir,eksik,fazla}, satirlar:[{urunId, ad, sistem,
 *       fiziksel, fark, sifir, otomatik, sifirKez, sayimKez, sayimAt}] }
 *
 * Tablo yoksa (sayim_gecmisi_paylasim.sql çalışmadıysa) 503 kurulum_bekleniyor.
 * SINIR: kullanıcı başına dakikada 30 istek.
 * ============================================================================
 */
'use strict';

const HAKLAR = ['stokSayimi', 'jetBarkodAsistan'];

function hakAcik(pf) {
    if (!pf || typeof pf !== 'object') return false;
    return HAKLAR.some((h) => {
        const f = pf[h];
        return f === true || (f && typeof f === 'object' && f.enabled === true);
    });
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

    // Ürün başına son fark; fark olan ya da sıfırlanan ürünler, sıfır önce
    app.get('/api/sayim-fark/rapor', uye, async (req, res) => {
        const sadeceSifir = req.query.sifir === '1';
        try {
            const r = await pool.query(
                `SELECT s.product_id, s.urun_adi, s.sistem, s.fiziksel, s.otomatik, s.sayim_at,
                        (s.fiziksel - s.sistem) AS fark,
                        (s.fiziksel = 0 AND s.sistem > 0) AS sifir,
                        a.sifir_kez, a.sayim_kez
                   FROM (
                        SELECT DISTINCT ON (product_id)
                               product_id, urun_adi, sistem, fiziksel, otomatik, sayim_at
                          FROM public.sayim_gecmisi
                         WHERE username = $1
                         ORDER BY product_id, sayim_at DESC
                   ) s
                   JOIN (
                        SELECT product_id,
                               count(*) FILTER (WHERE fiziksel = 0 AND sistem > 0) AS sifir_kez,
                               count(*) AS sayim_kez
                          FROM public.sayim_gecmisi
                         WHERE username = $1
                         GROUP BY product_id
                   ) a ON a.product_id = s.product_id
                  WHERE (s.fiziksel - s.sistem) <> 0 OR (s.fiziksel = 0 AND s.sistem > 0)`,
                [req.auth.username]
            );
            let satirlar = r.rows.map((x) => ({
                urunId: x.product_id,
                ad: x.urun_adi,
                sistem: Number(x.sistem),
                fiziksel: Number(x.fiziksel),
                fark: Number(x.fark),
                sifir: x.sifir === true,
                otomatik: x.otomatik === true,
                sifirKez: Number(x.sifir_kez) || 0,
                sayimKez: Number(x.sayim_kez) || 0,
                sayimAt: x.sayim_at,
            }));
            if (sadeceSifir) satirlar = satirlar.filter((s) => s.sifir);
            satirlar.sort((a, b) =>
                (b.sifir - a.sifir) || (Math.abs(b.fark) - Math.abs(a.fark))
            );
            const ozet = {
                urun: satirlar.length,
                sifir: satirlar.filter((s) => s.sifir).length,
                eksik: satirlar.filter((s) => s.fark < 0).length,
                fazla: satirlar.filter((s) => s.fark > 0).length,
            };
            res.json({ ok: true, ozet, satirlar: satirlar.slice(0, 5000) });
        } catch (e) { hata(res, e, 'rapor'); }
    });
}

module.exports = { kur };
