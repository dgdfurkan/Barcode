/**
 * Franchise oturumu: Asistan'ın yakaladığı jetonu hesaba yazar
 * ============================================================================
 *
 * Önceden jeton veritabanına yalnız sayım sayfası açıkken yazılıyordu; telefon
 * da oradan okuduğu için bilgisayarda sayım sayfasını açmak gerekiyordu.
 * Artık franchise panelinin herhangi bir sayfası (Mevcut Stok dahil) açıkken
 * Asistan jetonu buraya bırakır.
 *
 * POST /api/franchise-jeton  { token, tokenExpiry?, warehouseId? }
 *   users.counting_data._api_info yalnız bu anahtar değişecek şekilde
 *   (jsonb_set) güncellenir; sayım tabloları okunmaz, ezilmez. Yeni jetonun
 *   bitişi kayıtlıdan sonra değilse yazılmaz.
 *
 * SINIR: kullanıcı başına dakikada 4.
 * ============================================================================
 */
'use strict';

function jwtBitisMs(jeton) {
    try {
        const parca = String(jeton).replace(/^Bearer\s+/i, '').split('.')[1];
        if (!parca) return 0;
        const yuk = JSON.parse(Buffer.from(parca.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
        return Number.isFinite(yuk.exp) ? yuk.exp * 1000 : 0;
    } catch (e) {
        return 0;
    }
}

function alanBitisMs(v) {
    if (v == null || v === '') return 0;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
    const t = Date.parse(String(v));
    return Number.isFinite(t) ? t : 0;
}

function bitisMs(bilgi) {
    if (!bilgi || !bilgi.token) return 0;
    return Math.max(alanBitisMs(bilgi.tokenExpiry), jwtBitisMs(bilgi.token));
}

function kur(app, { pool, verifyToken, bearerOf }) {
    const sayac = new Map();

    function izin(kim) {
        const simdi = Date.now();
        const liste = (sayac.get(kim) || []).filter((t) => simdi - t < 60000);
        if (liste.length >= 4) { sayac.set(kim, liste); return false; }
        liste.push(simdi);
        sayac.set(kim, liste);
        if (sayac.size > 20000) sayac.clear();
        return true;
    }

    app.post('/api/franchise-jeton', async (req, res) => {
        const c = verifyToken(bearerOf(req));
        if (!c || !c.username || (c.role !== 'web_user' && c.role !== 'web_admin')) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
        if (!izin(c.username)) return res.status(429).json({ ok: false, error: 'cok_istek' });

        const b = req.body || {};
        let jeton = typeof b.token === 'string' ? b.token.trim() : '';
        if (!/^(Bearer\s+)?[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jeton) || jeton.length > 4096) {
            return res.status(400).json({ ok: false, error: 'gecersiz_jeton' });
        }
        if (!/^Bearer /.test(jeton)) jeton = 'Bearer ' + jeton;
        const depo = typeof b.warehouseId === 'string' && /^[0-9a-f]{24}$/i.test(b.warehouseId) ? b.warehouseId : null;
        const yeniBitis = bitisMs({ token: jeton, tokenExpiry: b.tokenExpiry });
        if (!yeniBitis || yeniBitis <= Date.now()) return res.status(400).json({ ok: false, error: 'suresi_dolmus' });

        try {
            const r = await pool.query(
                `SELECT is_active, trial_end, counting_data->'_api_info' AS bilgi
                   FROM users WHERE username = $1 LIMIT 1`,
                [c.username]
            );
            const u = r.rows[0];
            if (!u || !u.is_active || (u.trial_end && new Date() > new Date(u.trial_end))) {
                return res.status(403).json({ ok: false, error: 'hesap_kapali' });
            }
            const eski = u.bilgi && typeof u.bilgi === 'object' ? u.bilgi : {};
            if (eski.token === jeton || bitisMs(eski) >= yeniBitis) {
                return res.json({ ok: true, yazildi: false });
            }
            const yeni = Object.assign({}, eski, {
                token: jeton,
                tokenExpiry: yeniBitis,
                timestamp: Date.now(),
                baseUrl: 'https://franchise-api-gateway.getirapi.com',
                stockEndpoint: 'https://franchise-api-gateway.getirapi.com/stocks'
            });
            if (depo) yeni.warehouseId = depo;
            await pool.query(
                `UPDATE users
                    SET counting_data = jsonb_set(COALESCE(counting_data, '{}'::jsonb), '{_api_info}', $2::jsonb, true)
                  WHERE username = $1
                    AND (counting_data IS NULL OR jsonb_typeof(counting_data) = 'object')`,
                [c.username, JSON.stringify(yeni)]
            );
            res.json({ ok: true, yazildi: true });
        } catch (e) {
            console.error('franchise-jeton:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });
}

module.exports = { kur };
