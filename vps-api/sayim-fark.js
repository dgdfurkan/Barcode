/**
 * Sayım farkı / sıfırlanan ürünler
 * ============================================================================
 * Jet Barkod Asistan, depo panelinin sayımlarını (gstore-inventory-checks)
 * API ile tarar; her sayımın ürünlerinde sistem vs fiziksel stok farkını ve
 * sıfırlananları hesaplayıp buraya bırakır. Ayda bir tam tarama, sonra yalnız
 * yeni günler: imleç (son_check_at) resume noktasını tutar.
 *
 * Uçlar (hepsi imzalı jeton, kullanıcı adı jetondan):
 *   GET  /api/sayim-fark/imlec   Asistan kaldığı yeri sorar
 *   POST /api/sayim-fark         Asistan taradığı farkları + yeni imleci yazar
 *   GET  /api/sayim-fark/rapor   UI raporu okur (ürün başına son fark, sıfır vurgulu)
 *
 * Getir'e buradan istek gitmez; tarama tarayıcı tarafında yapılır.
 * SINIR: kullanıcı başına dakikada 30 istek.
 * ============================================================================
 */
'use strict';

const KIMLIK = /^[a-f0-9]{24}$/;
const HAKLAR = ['stokSayimi', 'jetBarkodAsistan'];
const AZAMI_SATIR = 500; // tek POST'ta en çok fark satırı

function hakAcik(pf) {
    if (!pf || typeof pf !== 'object') return false;
    return HAKLAR.some((h) => {
        const f = pf[h];
        return f === true || (f && typeof f === 'object' && f.enabled === true);
    });
}

const metin = (v, azami) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, azami) : '');

function sayi(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function zaman(v) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
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

    // Asistan kaldığı yeri sorar
    app.get('/api/sayim-fark/imlec', uye, async (req, res) => {
        try {
            const r = await pool.query(
                'SELECT son_check_at, ilk_tarama_at FROM sayim_fark.imlec WHERE username = $1',
                [req.auth.username]
            );
            const row = r.rows[0] || {};
            res.json({ ok: true, sonCheckAt: row.son_check_at || null, ilkTarama: row.ilk_tarama_at || null });
        } catch (e) { hata(res, e, 'imlec'); }
    });

    // Asistan taradığı farkları + yeni imleci yazar
    // body: { farklar: [{checkId, urunId, urunAd, barkod, sistem, fiziksel, reasonTur, reasonAd, altKategori, sayimAt}], sonCheckAt, ilkTarama }
    app.post('/api/sayim-fark', uye, async (req, res) => {
        const b = req.body || {};
        const gelen = Array.isArray(b.farklar) ? b.farklar : [];
        if (gelen.length > AZAMI_SATIR) return res.status(400).json({ ok: false, error: 'cok_satir' });

        const checkId = [], urunId = [], urunAd = [], barkod = [], sistem = [], fiziksel = [],
            fark = [], sifir = [], reasonTur = [], reasonAd = [], altKat = [], sayimAt = [];
        const gorulen = new Set();
        for (const f of gelen) {
            if (!f || typeof f !== 'object') continue;
            const ci = metin(f.checkId, 40);
            const ui = metin(f.urunId, 40);
            if (!KIMLIK.test(ci) || !KIMLIK.test(ui)) continue;
            const anahtar = ci + '|' + ui;
            if (gorulen.has(anahtar)) continue;
            gorulen.add(anahtar);
            const sis = sayi(f.sistem);
            const fiz = sayi(f.fiziksel);
            const frk = sis !== null && fiz !== null ? fiz - sis : null;
            checkId.push(ci);
            urunId.push(ui);
            urunAd.push(metin(f.urunAd, 200) || null);
            barkod.push(metin(f.barkod, 32) || null);
            sistem.push(sis);
            fiziksel.push(fiz);
            fark.push(frk);
            sifir.push(fiz === 0 && sis !== null && sis > 0);
            const rt = Number(f.reasonTur);
            reasonTur.push(Number.isInteger(rt) && rt >= 0 && rt < 10000 ? rt : null);
            reasonAd.push(metin(f.reasonAd, 120) || null);
            altKat.push(metin(f.altKategori, 120) || null);
            sayimAt.push(zaman(f.sayimAt));
        }

        const sonCheckAt = zaman(b.sonCheckAt);
        const ilkTarama = b.ilkTarama === true;

        const istemci = await pool.connect();
        try {
            await istemci.query('BEGIN');
            if (urunId.length) {
                await istemci.query(
                    `INSERT INTO sayim_fark.farklar
                        (username, check_id, urun_id, urun_ad, barkod, sistem, fiziksel, fark, sifir, reason_tur, reason_ad, alt_kategori, sayim_at)
                     SELECT $1, * FROM unnest(
                        $2::text[], $3::text[], $4::text[], $5::text[], $6::numeric[], $7::numeric[],
                        $8::numeric[], $9::boolean[], $10::int[], $11::text[], $12::text[], $13::timestamptz[]
                     ) AS t(check_id, urun_id, urun_ad, barkod, sistem, fiziksel, fark, sifir, reason_tur, reason_ad, alt_kategori, sayim_at)
                     ON CONFLICT (username, check_id, urun_id) DO UPDATE SET
                        urun_ad = EXCLUDED.urun_ad, barkod = EXCLUDED.barkod,
                        sistem = EXCLUDED.sistem, fiziksel = EXCLUDED.fiziksel, fark = EXCLUDED.fark,
                        sifir = EXCLUDED.sifir, reason_tur = EXCLUDED.reason_tur, reason_ad = EXCLUDED.reason_ad,
                        alt_kategori = COALESCE(EXCLUDED.alt_kategori, sayim_fark.farklar.alt_kategori),
                        sayim_at = EXCLUDED.sayim_at`,
                    [req.auth.username, checkId, urunId, urunAd, barkod, sistem, fiziksel, fark, sifir, reasonTur, reasonAd, altKat, sayimAt]
                );
            }
            // İmleç: yalnız ileri taşınır (geriye yazma, eşzamanlı tarama korunur)
            await istemci.query(
                `INSERT INTO sayim_fark.imlec (username, son_check_at, ilk_tarama_at, guncellendi_at)
                 VALUES ($1, $2, CASE WHEN $3::boolean THEN now() ELSE NULL END, now())
                 ON CONFLICT (username) DO UPDATE SET
                    son_check_at = GREATEST(COALESCE(sayim_fark.imlec.son_check_at, 'epoch'::timestamptz), COALESCE(EXCLUDED.son_check_at, 'epoch'::timestamptz)),
                    ilk_tarama_at = COALESCE(sayim_fark.imlec.ilk_tarama_at, EXCLUDED.ilk_tarama_at),
                    guncellendi_at = now()`,
                [req.auth.username, sonCheckAt, ilkTarama]
            );
            await istemci.query('COMMIT');
            res.json({ ok: true, yazilan: urunId.length });
        } catch (e) {
            try { await istemci.query('ROLLBACK'); } catch (_) {}
            hata(res, e, 'yaz');
        } finally {
            istemci.release();
        }
    });

    // UI raporu: ürün başına son fark; fark olan ya da sıfırlanan ürünler
    app.get('/api/sayim-fark/rapor', uye, async (req, res) => {
        const sadeceSifir = req.query.sifir === '1';
        try {
            const r = await pool.query(
                `SELECT DISTINCT ON (urun_id)
                    urun_id, urun_ad, barkod, sistem, fiziksel, fark, sifir, alt_kategori, reason_ad, sayim_at
                 FROM sayim_fark.farklar
                 WHERE username = $1 AND (sifir OR (fark IS NOT NULL AND fark <> 0))
                 ORDER BY urun_id, sayim_at DESC NULLS LAST`,
                [req.auth.username]
            );
            let satirlar = r.rows.map((x) => ({
                urunId: x.urun_id,
                ad: x.urun_ad,
                barkod: x.barkod,
                sistem: x.sistem === null ? null : Number(x.sistem),
                fiziksel: x.fiziksel === null ? null : Number(x.fiziksel),
                fark: x.fark === null ? null : Number(x.fark),
                sifir: x.sifir === true,
                altKategori: x.alt_kategori,
                reason: x.reason_ad,
                sayimAt: x.sayim_at,
            }));
            if (sadeceSifir) satirlar = satirlar.filter((s) => s.sifir);
            // Sıfırlananlar önce, sonra farkı büyükten küçüğe
            satirlar.sort((a, b) =>
                (b.sifir - a.sifir) || (Math.abs(b.fark || 0) - Math.abs(a.fark || 0))
            );
            const ozet = {
                urun: satirlar.length,
                sifir: satirlar.filter((s) => s.sifir).length,
                eksik: satirlar.filter((s) => (s.fark || 0) < 0).length,
                fazla: satirlar.filter((s) => (s.fark || 0) > 0).length,
            };
            res.json({ ok: true, ozet, satirlar: satirlar.slice(0, 5000) });
        } catch (e) { hata(res, e, 'rapor'); }
    });
}

module.exports = { kur };
