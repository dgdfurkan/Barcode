/**
 * Canlı kanal: veritabanı değişikliğini bekleyen cihazlara anında iletir.
 * ============================================================================
 *
 * NASIL
 * Veritabanındaki tetikleyiciler (sql_files/siparis_canli_v2.sql) bir sipariş,
 * ürün satırı ya da sayım satırı değişince `jb_canli` kanalına kısa bir haber
 * atıyor: tablo, kullanıcı adı, sipariş ya da sayım tablosu kimliği. Veri yok.
 *
 * Cihaz `GET /api/canli?son=<sıra>` ile soruyor. Yeni haber varsa hemen,
 * yoksa haber gelene kadar (en fazla 25 sn) bekleyip cevap veriyor. Cihaz
 * cevabı alınca değişeni kendi yetkisiyle çekiyor ve aynı isteği yeniden
 * açıyor. Bu "uzun yoklama": Apache gibi vekil sunucular tamponlamadığı için
 * sürekli akıştan (SSE) daha güvenilir; gecikme bir ağ gidiş-dönüşü.
 *
 * GÜVENLİK
 *   - İstek imzalı oturum jetonu ister; herkes yalnız kendi kullanıcı adının
 *     haberini alır. Haberde veri yok, cihaz veriyi RLS'li yoldan okur.
 *   - Kullanıcı başına aynı anda en fazla 24 bekleyen istek.
 *   - Haberler bellekte, kullanıcı başına son 200 tane.
 * ============================================================================
 */
'use strict';

const { Client } = require('pg');

const BEKLEME_MS = 25000;
const TAMPON = 200;
const KISI_BASI_BEKLEYEN = 24;
const BIRLESTIRME_MS = 30;     // aynı anda gelen haberler tek cevapta gitsin
const TABLOLAR = new Set(['orders', 'order_items', 'counting_items', 'users']);

function kur(app, { dbAyar, verifyToken, bearerOf }) {
    /** kullanıcı adı -> { sira, haberler, bekleyenler, zaman, sonDokunus } */
    const kanallar = new Map();

    function kanal(kim) {
        let k = kanallar.get(kim);
        if (!k) {
            k = { sira: 0, haberler: [], bekleyenler: new Set(), zaman: null, sonDokunus: Date.now() };
            kanallar.set(kim, k);
        }
        k.sonDokunus = Date.now();
        return k;
    }

    function yay(kim, haber) {
        const k = kanal(kim);
        k.sira += 1;
        haber.s = k.sira;
        k.haberler.push(haber);
        if (k.haberler.length > TAMPON) k.haberler.splice(0, k.haberler.length - TAMPON);
        if (k.zaman || !k.bekleyenler.size) return;
        k.zaman = setTimeout(() => {
            k.zaman = null;
            for (const b of Array.from(k.bekleyenler)) b.gonder();
        }, BIRLESTIRME_MS);
    }

    // ------------------------------------------------------------------
    // Veritabanını dinle (kopunca kendini yeniden bağlar)
    // ------------------------------------------------------------------
    let istemci = null;
    let gecikme = 1000;
    let bagli = false;

    function yenidenBaglan() {
        bagli = false;
        if (istemci) {
            try { istemci.removeAllListeners(); istemci.end().catch(() => {}); } catch (e) { /* kapalı */ }
            istemci = null;
        }
        setTimeout(baglan, gecikme);
        gecikme = Math.min(gecikme * 2, 30000);
    }

    async function baglan() {
        try {
            const c = new Client(dbAyar);
            istemci = c;
            c.on('notification', (m) => {
                if (m.channel !== 'jb_canli') return;
                let v = null;
                try { v = JSON.parse(m.payload); } catch (e) { return; }
                if (!v || typeof v.u !== 'string' || !TABLOLAR.has(v.t)) return;
                yay(v.u, { t: v.t, k: v.k == null ? null : String(v.k).slice(0, 120) });
            });
            c.on('error', () => yenidenBaglan());
            c.on('end', () => { if (istemci === c) yenidenBaglan(); });
            await c.connect();
            await c.query('LISTEN jb_canli');
            bagli = true;
            gecikme = 1000;
            // Kopukken kaçan haber olabilir: bekleyen herkes tam tazeleme yapsın
            for (const k of kanallar.values()) {
                k.sira += 1;
                k.haberler.push({ s: k.sira, t: '*', k: null });
                for (const b of Array.from(k.bekleyenler)) b.gonder();
            }
        } catch (e) {
            yenidenBaglan();
        }
    }
    baglan();

    // Uzun süre sessiz kalan kanallar bellekten düşsün
    setInterval(() => {
        const sinir = Date.now() - 60 * 60 * 1000;
        for (const [kim, k] of kanallar) {
            if (!k.bekleyenler.size && k.sonDokunus < sinir) kanallar.delete(kim);
        }
    }, 10 * 60 * 1000).unref();

    // ------------------------------------------------------------------
    // GET /api/canli?son=<sıra>
    // ------------------------------------------------------------------
    app.get('/api/canli', (req, res) => {
        const claims = verifyToken(bearerOf(req));
        if (!claims || !claims.username) return res.status(401).json({ ok: false, error: 'unauthorized' });
        res.setHeader('Cache-Control', 'no-store');

        const k = kanal(String(claims.username));
        const son = Number.parseInt(String(req.query.son ?? ''), 10);
        let bitti = false;
        const cevap = (govde) => {
            if (bitti || res.headersSent) return;
            bitti = true;
            res.json(Object.assign({ ok: true, seq: k.sira, bagli }, govde));
        };

        // Sıra bilinmiyor ya da sunucu yeniden başladı: cihaz sırayı öğrensin, tam tazelesin
        if (!Number.isFinite(son) || son < 0 || son > k.sira) return cevap({ sifirla: true, olaylar: [] });

        if (son < k.sira) {
            const yeni = k.haberler.filter((h) => h.s > son);
            // Aradaki haberler tampondan düştüyse eksiksiz değil: tam tazeleme
            if (!yeni.length || yeni[0].s !== son + 1) return cevap({ sifirla: true, olaylar: [] });
            return cevap({ olaylar: yeni });
        }

        if (k.bekleyenler.size >= KISI_BASI_BEKLEYEN) return cevap({ olaylar: [], dolu: true });

        const b = {
            gonder() {
                temizle();
                cevap({ olaylar: k.haberler.filter((h) => h.s > son) });
            },
        };
        const zaman = setTimeout(() => { temizle(); cevap({ olaylar: [] }); }, BEKLEME_MS);
        function temizle() {
            clearTimeout(zaman);
            k.bekleyenler.delete(b);
        }
        k.bekleyenler.add(b);
        req.on('close', temizle);
    });
}

module.exports = { kur };
