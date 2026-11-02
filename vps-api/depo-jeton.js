/**
 * Depo paneli oturumu: Asistan'ın yakaladığı jetonu hesaba yazar
 * ============================================================================
 *
 * Depo panelinin (warehouse.getir.com) jetonu 15 dakikada bir yenileniyor.
 * Panel bir bilgisayarda açık durdukça Asistan her yeni jetonu buraya bırakır;
 * telefon dahil her cihaz Ürün Hareketi penceresinde depo paneli isteğini bu
 * jetonla, panelin attığı başlıklarla atar.
 *
 * POST /api/depo-jeton  { token, warehouseId }
 *   users.counting_data._depo_info = { token, bitis, depo, zaman }
 *   Yalnız bu anahtar değişir (jsonb_set). Bitişi kayıtlıdan sonra olmayan
 *   jeton yazılmaz. Jeton yalnız depo panelinin istemcisine ait olabilir.
 *
 * SINIR: kullanıcı başına dakikada 6.
 * ============================================================================
 */
'use strict';

const KIMLIK = /^[0-9a-f]{24}$/i;
const JWT = /^(Bearer\s+)?[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function jwtYuk(jeton) {
    try {
        const parca = String(jeton).replace(/^Bearer\s+/i, '').split('.')[1];
        return JSON.parse(Buffer.from(parca.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    } catch (e) {
        return null;
    }
}

function kur(app, { pool, verifyToken, bearerOf }) {
    const sayac = new Map();

    function izin(kim) {
        const simdi = Date.now();
        const liste = (sayac.get(kim) || []).filter((t) => simdi - t < 60000);
        if (liste.length >= 6) { sayac.set(kim, liste); return false; }
        liste.push(simdi);
        sayac.set(kim, liste);
        if (sayac.size > 20000) sayac.clear();
        return true;
    }

    app.post('/api/depo-jeton', async (req, res) => {
        const c = verifyToken(bearerOf(req));
        if (!c || !c.username || (c.role !== 'web_user' && c.role !== 'web_admin')) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
        if (!izin(c.username)) return res.status(429).json({ ok: false, error: 'cok_istek' });

        const b = req.body || {};
        let jeton = typeof b.token === 'string' ? b.token.trim() : '';
        if (!JWT.test(jeton) || jeton.length > 4096) return res.status(400).json({ ok: false, error: 'gecersiz_jeton' });
        if (!/^Bearer /.test(jeton)) jeton = 'Bearer ' + jeton;
        const depo = typeof b.warehouseId === 'string' && KIMLIK.test(b.warehouseId) ? b.warehouseId.toLowerCase() : null;
        if (!depo) return res.status(400).json({ ok: false, error: 'depo_yok' });

        const yuk = jwtYuk(jeton);
        // Yalnız depo panelinin jetonu; franchise ya da başka istemcininki değil
        if (!yuk || yuk.azp !== 'warehouse-panel-frontend-client' || !/^https:\/\/stockid\.getirapi\.com\//.test(String(yuk.iss || ''))) {
            return res.status(400).json({ ok: false, error: 'gecersiz_jeton' });
        }
        const bitis = Number.isFinite(yuk.exp) ? yuk.exp * 1000 : 0;
        if (!bitis || bitis <= Date.now()) return res.status(400).json({ ok: false, error: 'suresi_dolmus' });

        try {
            const r = await pool.query(
                `SELECT is_active, trial_end, counting_data->'_depo_info' AS bilgi
                   FROM users WHERE username = $1 LIMIT 1`,
                [c.username]
            );
            const u = r.rows[0];
            if (!u || !u.is_active || (u.trial_end && new Date() > new Date(u.trial_end))) {
                return res.status(403).json({ ok: false, error: 'hesap_kapali' });
            }
            const eski = u.bilgi && typeof u.bilgi === 'object' ? u.bilgi : {};
            if (eski.token === jeton || (Number(eski.bitis) || 0) >= bitis) {
                return res.json({ ok: true, yazildi: false });
            }
            const yeni = { token: jeton, bitis, depo, zaman: Date.now() };
            await pool.query(
                `UPDATE users
                    SET counting_data = jsonb_set(COALESCE(counting_data, '{}'::jsonb), '{_depo_info}', $2::jsonb, true)
                  WHERE username = $1
                    AND (counting_data IS NULL OR jsonb_typeof(counting_data) = 'object')`,
                [c.username, JSON.stringify(yeni)]
            );
            res.json({ ok: true, yazildi: true });
        } catch (e) {
            console.error('depo-jeton:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });
}

module.exports = { kur };
