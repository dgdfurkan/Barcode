/**
 * Hesaplama kilidi: sayfanın açılış şifresi hesapta (cihazda değil)
 * ============================================================================
 *
 * Şifrenin kendisi saklanmaz, bcrypt özeti saklanır. Unutulursa şifre
 * belirlenirken seçilen hafıza kartı (9 resimden biri) sorulur; doğru kart
 * 10 dakikalık tek kullanımlık bir jeton verir, jetonla yeni şifre yazılır.
 * Kart hiçbir yanıtta geri dönmez.
 *
 * YANLIŞ DENEME
 *   şifre  5 yanlışta 60 sn bekleme
 *   kart   3 yanlışta 60 sn bekleme
 *
 *   GET  /api/hesaplama/kilit          { kurulu, bekleSn }
 *   POST /api/hesaplama/kilit/kur      { sifre, kart }    yalnız ilk kez
 *   POST /api/hesaplama/kilit/ac       { sifre }
 *   POST /api/hesaplama/kilit/kart     { kart }           → { jeton }
 *   POST /api/hesaplama/kilit/yeni     { jeton, sifre }
 *   POST /api/hesaplama/kilit/degis    { eski, sifre, kart? }
 *
 * SINIR: kullanıcı başına dakikada 30 istek.
 * ============================================================================
 */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const KARTLAR = ['motor', 'kahve', 'yildiz', 'ev', 'kalp', 'anahtar', 'agac', 'balik', 'ay'];
const EN_AZ = 4;
const EN_COK = 64;
const SIFRE_SINIRI = 5;
const KART_SINIRI = 3;
const BEKLEME_MS = 60 * 1000;
const JETON_MS = 10 * 60 * 1000;

function hakAcik(pf) {
    if (!pf || typeof pf !== 'object') return false;
    const f = pf.hesaplama;
    return f === true || (f && typeof f === 'object' && f.enabled === true);
}

const sifreGecerli = (v) => typeof v === 'string' && v.length >= EN_AZ && v.length <= EN_COK;

function kur(app, { pool, verifyToken, bearerOf }) {
    const sayac = new Map();
    const jetonlar = new Map();   // username → { jeton, bitis }

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
        console.error('hesaplama-kilit ' + yer + ':', e.message);
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
            console.error('hesaplama-kilit uye:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
        req.auth = c;
        next();
    }

    async function oku(username) {
        const r = await pool.query(
            `SELECT ozet, kart, yanlis_sifre, yanlis_kart,
                    GREATEST(0, ceil(extract(epoch FROM (bekle_kadar - now()))))::int AS bekle_sn
               FROM hesaplama.kilit WHERE username = $1`,
            [username]
        );
        return r.rows[0] || null;
    }

    const beklemede = (k, res) => {
        if (k && k.bekle_sn > 0) { res.status(429).json({ ok: false, error: 'bekle', bekleSn: k.bekle_sn }); return true; }
        return false;
    };

    /** Yanlış denemeyi say; sınıra gelince sayaç sıfırlanır ve 60 sn bekleme başlar */
    async function yanlisYaz(username, alan, sinir) {
        const r = await pool.query(
            `UPDATE hesaplama.kilit SET
                ${alan} = CASE WHEN ${alan} + 1 >= $2 THEN 0 ELSE ${alan} + 1 END,
                bekle_kadar = CASE WHEN ${alan} + 1 >= $2 THEN now() + ($3 || ' milliseconds')::interval ELSE bekle_kadar END
              WHERE username = $1
              RETURNING ${alan} AS yanlis, GREATEST(0, ceil(extract(epoch FROM (bekle_kadar - now()))))::int AS bekle_sn`,
            [username, sinir, String(BEKLEME_MS)]
        );
        const x = r.rows[0] || { yanlis: 0, bekle_sn: 0 };
        return { kalan: x.bekle_sn > 0 ? 0 : sinir - x.yanlis, bekleSn: x.bekle_sn };
    }

    async function sifreYaz(username, sifre, kart) {
        const ozet = await bcrypt.hash(sifre, 10);
        await pool.query(
            `UPDATE hesaplama.kilit SET ozet = $2, kart = COALESCE($3, kart), yanlis_sifre = 0, yanlis_kart = 0,
                    bekle_kadar = NULL, guncelleme = now()
              WHERE username = $1`,
            [username, ozet, kart || null]
        );
    }

    app.get('/api/hesaplama/kilit', uye, async (req, res) => {
        try {
            const k = await oku(req.auth.username);
            res.json({ ok: true, kurulu: !!k, bekleSn: k ? k.bekle_sn : 0 });
        } catch (e) { hata(res, e, 'durum'); }
    });

    app.post('/api/hesaplama/kilit/kur', uye, async (req, res) => {
        const b = req.body || {};
        if (!sifreGecerli(b.sifre) || KARTLAR.indexOf(b.kart) === -1) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            const ozet = await bcrypt.hash(b.sifre, 10);
            const r = await pool.query(
                `INSERT INTO hesaplama.kilit (username, ozet, kart) VALUES ($1, $2, $3)
                 ON CONFLICT (username) DO NOTHING RETURNING username`,
                [req.auth.username, ozet, b.kart]
            );
            if (!r.rowCount) return res.status(409).json({ ok: false, error: 'kurulu' });
            res.json({ ok: true });
        } catch (e) { hata(res, e, 'kur'); }
    });

    app.post('/api/hesaplama/kilit/ac', uye, async (req, res) => {
        const sifre = (req.body || {}).sifre;
        if (typeof sifre !== 'string' || !sifre || sifre.length > EN_COK) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            const k = await oku(req.auth.username);
            if (!k) return res.status(404).json({ ok: false, error: 'kurulu_degil' });
            if (beklemede(k, res)) return;
            if (await bcrypt.compare(sifre, k.ozet)) {
                if (k.yanlis_sifre) await pool.query('UPDATE hesaplama.kilit SET yanlis_sifre = 0 WHERE username = $1', [req.auth.username]);
                return res.json({ ok: true });
            }
            const y = await yanlisYaz(req.auth.username, 'yanlis_sifre', SIFRE_SINIRI);
            res.status(403).json({ ok: false, error: 'yanlis', kalan: y.kalan, bekleSn: y.bekleSn });
        } catch (e) { hata(res, e, 'ac'); }
    });

    app.post('/api/hesaplama/kilit/kart', uye, async (req, res) => {
        const kart = (req.body || {}).kart;
        if (KARTLAR.indexOf(kart) === -1) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            const k = await oku(req.auth.username);
            if (!k) return res.status(404).json({ ok: false, error: 'kurulu_degil' });
            if (beklemede(k, res)) return;
            if (kart === k.kart) {
                const jeton = crypto.randomBytes(24).toString('hex');
                jetonlar.set(req.auth.username, { jeton, bitis: Date.now() + JETON_MS });
                await pool.query('UPDATE hesaplama.kilit SET yanlis_kart = 0 WHERE username = $1', [req.auth.username]);
                return res.json({ ok: true, jeton });
            }
            const y = await yanlisYaz(req.auth.username, 'yanlis_kart', KART_SINIRI);
            res.status(403).json({ ok: false, error: 'yanlis', kalan: y.kalan, bekleSn: y.bekleSn });
        } catch (e) { hata(res, e, 'kart'); }
    });

    app.post('/api/hesaplama/kilit/yeni', uye, async (req, res) => {
        const b = req.body || {};
        const j = jetonlar.get(req.auth.username);
        if (!sifreGecerli(b.sifre)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        const dogru = j && j.bitis > Date.now() && typeof b.jeton === 'string' && b.jeton.length === j.jeton.length &&
            crypto.timingSafeEqual(Buffer.from(b.jeton), Buffer.from(j.jeton));
        if (!dogru) return res.status(403).json({ ok: false, error: 'jeton' });
        try {
            jetonlar.delete(req.auth.username);
            await sifreYaz(req.auth.username, b.sifre, null);
            res.json({ ok: true });
        } catch (e) { hata(res, e, 'yeni'); }
    });

    app.post('/api/hesaplama/kilit/degis', uye, async (req, res) => {
        const b = req.body || {};
        if (typeof b.eski !== 'string' || !b.eski || b.eski.length > EN_COK || !sifreGecerli(b.sifre)) {
            return res.status(400).json({ ok: false, error: 'gecersiz' });
        }
        if (b.kart != null && b.kart !== '' && KARTLAR.indexOf(b.kart) === -1) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            const k = await oku(req.auth.username);
            if (!k) return res.status(404).json({ ok: false, error: 'kurulu_degil' });
            if (beklemede(k, res)) return;
            if (!(await bcrypt.compare(b.eski, k.ozet))) {
                const y = await yanlisYaz(req.auth.username, 'yanlis_sifre', SIFRE_SINIRI);
                return res.status(403).json({ ok: false, error: 'yanlis', kalan: y.kalan, bekleSn: y.bekleSn });
            }
            await sifreYaz(req.auth.username, b.sifre, b.kart || null);
            res.json({ ok: true });
        } catch (e) { hata(res, e, 'degis'); }
    });
}

module.exports = { kur };
