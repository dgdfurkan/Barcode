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
 *
 * POST /api/depo-panel  { islem, veri }
 *   Depo paneli ağ geçidi başka sitelerden gelen tarayıcı isteğini 503'le
 *   kesiyor; bu yüzden soru buradan, hesaptaki jetonla ve panelin
 *   başlıklarıyla sorulur. Genel vekil DEĞİL: yalnız üç işlem, gövdeyi
 *   sunucu kurar.
 *     hareket  POST /stock-movement-logs/filter (yalnız transfer ve satış açıklaması)
 *     paletler POST /warehouse/<depo>/inbound/transfer
 *     palet    GET  /warehouse/<depo>/inbound/transfer/<id>
 *   Cevaptan yalnız ürün kimliği, zaman, adet ve durum döner; kişi adı dönmez.
 *   Kullanıcı başına istekler arası en az 350 ms, dakikada 60.
 *   Jeton yok ya da süresi geçmişse 409 { error: 'oturum' }.
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

const PANEL = 'https://warehouse-panel-api-gateway.getirapi.com';
const ACIKLAMALAR = ['IncomingTransferAcceptance-IncreaseStock', 'PickingBasketDeliver'];
const GUN_MS = 86400000;

function tarih(v) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
}

/* Gelen soruyu denetleyip isteği kurar. Geçersizse null. */
function istekKur(islem, v, depo) {
    v = v && typeof v === 'object' ? v : {};
    if (islem === 'hareket') {
        const urunler = Array.isArray(v.urunler) ? v.urunler.map(String).filter((i) => KIMLIK.test(i)).map((i) => i.toLowerCase()).slice(0, 100) : [];
        const bas = tarih(v.bas);
        const bit = tarih(v.bit);
        const limit = Math.min(100, Math.max(1, Number(v.limit) || 20));
        const offset = Math.min(500, Math.max(0, Number(v.offset) || 0));
        if (!urunler.length || !ACIKLAMALAR.includes(v.aciklama) || !bas || !bit || bit < bas || bit - bas > 31 * GUN_MS) return null;
        return {
            yol: `/stock-movement-logs/filter?offset=${offset}&limit=${limit}`,
            yontem: 'POST',
            govde: { startDate: new Date(bas).toISOString(), endDate: new Date(bit).toISOString(), warehouses: [depo], products: urunler, descriptions: [v.aciklama] }
        };
    }
    if (islem === 'paletler') {
        const bas = tarih(v.bas);
        const bit = tarih(v.bit);
        if (!bas || !bit || bit < bas || bit - bas > 3 * GUN_MS) return null;
        return {
            yol: `/warehouse/${depo}/inbound/transfer?offset=0&limit=50`,
            yontem: 'POST',
            govde: { createdAt: { startDate: new Date(bas).toISOString(), endDate: new Date(bit).toISOString() } }
        };
    }
    if (islem === 'palet') {
        if (!KIMLIK.test(String(v.id || ''))) return null;
        return { yol: `/warehouse/${depo}/inbound/transfer/${String(v.id).toLowerCase()}`, yontem: 'GET' };
    }
    return null;
}

function sade(islem, j) {
    const data = j && j.data;
    if (islem === 'hareket') {
        const k = data && data.stockMovementLogs;
        return {
            devam: !!(k && k.hasNext),
            liste: (k && Array.isArray(k.data) ? k.data : [])
                .map((x) => ({ id: String((x && x.product && x.product.id) || '').toLowerCase(), z: x && x.createdAt, q: Number(x && x.quantity) || 0 }))
                .filter((x) => KIMLIK.test(x.id))
        };
    }
    if (islem === 'paletler') {
        return {
            liste: (data && Array.isArray(data.deliveries) ? data.deliveries : [])
                .map((t) => ({ id: String((t && t.id) || '').toLowerCase(), durum: String((t && t.status) || ''), z: t && t.createdAt }))
                .filter((t) => KIMLIK.test(t.id))
        };
    }
    const urunler = {};
    (data && Array.isArray(data.goods) ? data.goods : []).forEach((g) => {
        const id = String((g && g.id) || '').toLowerCase();
        if (KIMLIK.test(id)) urunler[id] = [Number(g.orderedCount) || 0, g.receivedCount == null ? null : Number(g.receivedCount) || 0];
    });
    return { durum: String((data && data.status) || ''), urunler };
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

    // ------------------------------------------------------------------
    // Depo paneline soru (Ürün Hareketi)
    // ------------------------------------------------------------------
    const panelSayac = new Map();
    const panelSira = new Map();

    function panelIzin(kim) {
        const simdi = Date.now();
        const liste = (panelSayac.get(kim) || []).filter((t) => simdi - t < 60000);
        if (liste.length >= 60) { panelSayac.set(kim, liste); return false; }
        liste.push(simdi);
        panelSayac.set(kim, liste);
        if (panelSayac.size > 20000) panelSayac.clear();
        return true;
    }

    /* Aynı kullanıcının istekleri sırayla, aralarında en az 350 ms */
    function sirala(kim, is) {
        const once = panelSira.get(kim) || Promise.resolve();
        const sonraki = once.catch(() => {}).then(async () => {
            try { return await is(); } finally { await new Promise((c) => setTimeout(c, 350)); }
        });
        panelSira.set(kim, sonraki);
        sonraki.finally(() => { if (panelSira.get(kim) === sonraki) panelSira.delete(kim); }).catch(() => {});
        return sonraki;
    }

    app.post('/api/depo-panel', async (req, res) => {
        const c = verifyToken(bearerOf(req));
        if (!c || !c.username || (c.role !== 'web_user' && c.role !== 'web_admin')) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
        if (!panelIzin(c.username)) return res.status(429).json({ ok: false, error: 'cok_istek' });
        const islem = String((req.body && req.body.islem) || '');

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
            const b = u.bilgi && typeof u.bilgi === 'object' ? u.bilgi : null;
            if (!b || typeof b.token !== 'string' || !KIMLIK.test(String(b.depo || '')) || (Number(b.bitis) || 0) < Date.now() + 15000) {
                return res.status(409).json({ ok: false, error: 'oturum', son: b && Number(b.zaman) || null });
            }
            const is = istekKur(islem, req.body && req.body.veri, String(b.depo).toLowerCase());
            if (!is) return res.status(400).json({ ok: false, error: 'gecersiz' });

            const cevap = await sirala(c.username, async () => {
                const ctrl = new AbortController();
                const zaman = setTimeout(() => ctrl.abort(), 15000);
                try {
                    return await fetch(PANEL + is.yol, {
                        method: is.yontem,
                        headers: {
                            accept: 'application/json',
                            authorization: b.token,
                            'content-type': 'application/json',
                            countrycode: 'TR',
                            language: 'tr',
                            'x-requester-client': 'warehouse-panel-frontend'
                        },
                        body: is.govde ? JSON.stringify(is.govde) : undefined,
                        signal: ctrl.signal
                    });
                } finally {
                    clearTimeout(zaman);
                }
            });
            if (cevap.status === 401 || cevap.status === 403) return res.status(409).json({ ok: false, error: 'oturum' });
            if (!cevap.ok) return res.status(502).json({ ok: false, error: 'panel', durum: cevap.status });
            const j = await cevap.json().catch(() => null);
            res.json({ ok: true, veri: sade(islem, j) });
        } catch (e) {
            console.error('depo-panel:', e.message);
            res.status(502).json({ ok: false, error: 'ag' });
        }
    });
}

module.exports = { kur };
