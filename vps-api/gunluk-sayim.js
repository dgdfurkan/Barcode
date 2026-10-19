/**
 * Günlük sayım: depo panelinin 50'lik otomatik sayımı kendiliğinden
 * ============================================================================
 *
 * AKIŞ
 * 1. Jet Barkod Asistan 06:00'da depo panelinden günün otomatik sayımını okur,
 *    POST /api/gunluk-sayim ile ürün listesini bırakır.
 * 2. Sayım sayfası açılınca GET /api/gunluk-sayim?gun= ile listeyi görür;
 *    POST /api/gunluk-sayim/al ile kilidi alan TEK cihaz `Günlük|<gün>`
 *    tablosunu kurar, POST /api/gunluk-sayim/tamam ile bitirir. Kilit 3
 *    dakikada düşer (cihaz yarıda kapandıysa başkası kurar).
 * 3. Gece 00:00-01:00 Asistan GET /api/gunluk-sayim/durum?gun= ile kalan
 *    ürünü sorar: tablodaki adedi boş satırlar; tablo hiç kurulmadıysa
 *    listenin tamamı.
 *
 * Getir'e buradan istek gitmez.
 *
 * SINIR: kullanıcı başına dakikada 30 istek.
 * ============================================================================
 */
'use strict';

const GUN = /^\d{4}-\d{2}-\d{2}$/;
const KIMLIK = /^[a-f0-9]{24}$/;
const KILIT_MS = 3 * 60 * 1000;
const HAKLAR = ['stokSayimi', 'jetBarkodAsistan'];

function hakAcik(pf) {
    if (!pf || typeof pf !== 'object') return false;
    return HAKLAR.some((h) => {
        const f = pf[h];
        return f === true || (f && typeof f === 'object' && f.enabled === true);
    });
}

const metin = (v, azami) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, azami) : '');

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
        console.error('gunluk-sayim ' + yer + ':', e.message);
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
            console.error('gunluk-sayim uye:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
        req.auth = c;
        next();
    }

    /** Asistan yazar: { gun, sayimId, urunler: [{id, ad}] } */
    app.post('/api/gunluk-sayim', uye, async (req, res) => {
        const b = req.body || {};
        const gun = metin(b.gun, 10);
        const sayimId = metin(b.sayimId, 40);
        if (!GUN.test(gun) || !KIMLIK.test(sayimId)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        const gorulen = new Set();
        const urunler = (Array.isArray(b.urunler) ? b.urunler : []).slice(0, 300).map((u) => ({
            id: metin(u && u.id, 40),
            ad: metin(u && u.ad, 200),
        })).filter((u) => KIMLIK.test(u.id) && !gorulen.has(u.id) && gorulen.add(u.id));
        if (!urunler.length) return res.status(400).json({ ok: false, error: 'urun_yok' });
        try {
            // Aynı sayım yeniden gelirse kurulum bilgisi korunur; başka bir sayım gelirse sıfırlanır
            await pool.query(
                `INSERT INTO gunluk.sayimlar (username, gun, sayim_id, urunler) VALUES ($1, $2, $3, $4::jsonb)
                 ON CONFLICT (username, gun) DO UPDATE SET
                    urunler = EXCLUDED.urunler,
                    eklendi_at = CASE WHEN gunluk.sayimlar.sayim_id = EXCLUDED.sayim_id THEN gunluk.sayimlar.eklendi_at ELSE now() END,
                    alindi_at = CASE WHEN gunluk.sayimlar.sayim_id = EXCLUDED.sayim_id THEN gunluk.sayimlar.alindi_at ELSE NULL END,
                    alan_cihaz = CASE WHEN gunluk.sayimlar.sayim_id = EXCLUDED.sayim_id THEN gunluk.sayimlar.alan_cihaz ELSE NULL END,
                    uygulandi_at = CASE WHEN gunluk.sayimlar.sayim_id = EXCLUDED.sayim_id THEN gunluk.sayimlar.uygulandi_at ELSE NULL END,
                    sayim_id = EXCLUDED.sayim_id`,
                [req.auth.username, gun, sayimId, JSON.stringify(urunler)]
            );
            res.json({ ok: true, adet: urunler.length });
        } catch (e) { hata(res, e, 'yaz'); }
    });

    /** Sayım sayfası ve Asistan okur */
    app.get('/api/gunluk-sayim', uye, async (req, res) => {
        const gun = metin(req.query.gun, 10);
        if (!GUN.test(gun)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            const r = await pool.query(
                `SELECT gun::text AS gun, sayim_id, urunler, eklendi_at, uygulandi_at, eklenen, atlanan
                   FROM gunluk.sayimlar WHERE username = $1 AND gun = $2`,
                [req.auth.username, gun]
            );
            const k = r.rows[0];
            res.json({ ok: true, kayit: k ? {
                gun: k.gun, sayimId: k.sayim_id, urunler: k.urunler || [], eklendi: k.eklendi_at,
                uygulandi: k.uygulandi_at, eklenen: k.eklenen, atlanan: k.atlanan,
            } : null });
        } catch (e) { hata(res, e, 'oku'); }
    });

    /** Tabloyu kurma kilidi: yalnız bir cihaz alır */
    app.post('/api/gunluk-sayim/al', uye, async (req, res) => {
        const gun = metin((req.body || {}).gun, 10);
        const cihaz = metin((req.body || {}).cihaz, 80) || null;
        if (!GUN.test(gun)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            const r = await pool.query(
                `UPDATE gunluk.sayimlar SET alindi_at = now(), alan_cihaz = $3
                  WHERE username = $1 AND gun = $2 AND uygulandi_at IS NULL
                    AND (alindi_at IS NULL OR alindi_at < now() - ($4 || ' milliseconds')::interval)
                  RETURNING urunler`,
                [req.auth.username, gun, cihaz, String(KILIT_MS)]
            );
            res.json({ ok: true, alindi: !!r.rows[0], urunler: r.rows[0] ? r.rows[0].urunler : [] });
        } catch (e) { hata(res, e, 'al'); }
    });

    app.post('/api/gunluk-sayim/tamam', uye, async (req, res) => {
        const b = req.body || {};
        const gun = metin(b.gun, 10);
        if (!GUN.test(gun)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        const sayi = (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < 1000 ? Number(v) : null);
        try {
            await pool.query(
                `UPDATE gunluk.sayimlar SET uygulandi_at = now(), eklenen = $3, atlanan = $4
                  WHERE username = $1 AND gun = $2`,
                [req.auth.username, gun, sayi(b.eklenen), sayi(b.atlanan)]
            );
            res.json({ ok: true });
        } catch (e) { hata(res, e, 'tamam'); }
    });

    /** Gece uyarısı: o günün tablosunda sayılmamış ürün sayısı */
    app.get('/api/gunluk-sayim/durum', uye, async (req, res) => {
        const gun = metin(req.query.gun, 10);
        if (!GUN.test(gun)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        const u = req.auth.username;
        try {
            const [k, t] = await Promise.all([
                pool.query('SELECT jsonb_array_length(urunler) AS adet FROM gunluk.sayimlar WHERE username = $1 AND gun = $2', [u, gun]),
                pool.query(
                    `SELECT count(*)::int AS toplam, count(*) FILTER (WHERE warehouse_stock IS NULL)::int AS kalan
                       FROM counting_items WHERE username = $1 AND table_name = $2`,
                    [u, 'Günlük|' + gun]
                ),
            ]);
            const liste = k.rows[0] ? Number(k.rows[0].adet) || 0 : 0;
            const toplam = t.rows[0].toplam;
            if (toplam) return res.json({ ok: true, var: true, tablo: true, toplam, kalan: t.rows[0].kalan });
            // Tablo hiç kurulmadı: liste varsa hepsi kaldı
            res.json({ ok: true, var: liste > 0, tablo: false, toplam: liste, kalan: liste });
        } catch (e) { hata(res, e, 'durum'); }
    });
}

module.exports = { kur };
