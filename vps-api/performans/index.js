/**
 * Performans raporu: DPS (Depo Performans Sistemi) ve Kurye Performansı Telegram'a
 * ============================================================================
 *
 * VERİ NEREDEN
 *   Sunucu Getir'e istek atmaz. Franchise panelinin kendi istekleri
 *   kullanıcının tarafında atılır, yanıt buraya bırakılır:
 *     - Zamanlı: Jet Barkod Asistan (arka-plan/performans.js) seçilen
 *       saatlerde dünün verisini okur. Dünkü sipariş toplamı eşiğin
 *       altındaysa (veri henüz tamamlanmamış) erteler.
 *     - Elle: Telegram Raporları sayfası, tarayıcıdaki franchise oturumuyla.
 *   Gelen veri performans/veri.js ile temizlenir.
 *
 * AYAR
 *   telegram-ayar.js içinde `performans` (saatler, eşik, erteleme, bölümler).
 *
 * UÇLAR
 *   GET  /api/performans/ayar       Asistan: zamanlama ayarı
 *   POST /api/performans/onizleme   { veri | ornek, ayar? } → kartlar (720 px)
 *   POST /api/performans/gonder     { veri, ayar?, otomatik?: { gun, dakika, eksik } }
 *   POST /api/performans/ertele     Asistan: "veri gelmedi, X dk sonra" bildirimi
 * ============================================================================
 */
'use strict';

const telegram = require('../sayim-raporu/telegram');
const ta = require('../telegram-ayar');
const { albumGonder, kucult } = require('../gece-raporu/paylas');
const { veriDuzelt } = require('./veri');
const kart = require('./kart');

const HAKLAR = ['satistanKaldirma', 'itirazYazici', 'stokSayimi', 'jetBarkodAsistan'];
const GUN_MS = 24 * 3600 * 1000;
// gece.gonderim'de zamanlı rapor saatleriyle çakışmasın: dakika + 10000
const GONDERIM_KAYMA = 10000;

function hakAcik(pf) {
    if (!pf || typeof pf !== 'object') return false;
    return HAKLAR.some((h) => {
        const f = pf[h];
        return f === true || (f && typeof f === 'object' && f.enabled === true);
    });
}

const semaYok = (e) => !!(e && (e.code === '3F000' || e.code === '42P01' || e.code === '42703'));

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

    async function uye(req, res, next) {
        const c = verifyToken(bearerOf(req));
        if (!c || !c.username || (c.role !== 'web_user' && c.role !== 'web_admin')) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
        if (!pencere('istek:' + c.username, 40, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
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
            console.error('performans uye:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
        req.auth = c;
        next();
    }

    async function alicilar(u) {
        try {
            const r = await pool.query(
                `SELECT id, chat_id FROM rapor.telegram_baglantilari WHERE username = $1 AND durum = 'aktif' ORDER BY baglandi_at`,
                [u]
            );
            return r.rows;
        } catch (e) { return []; }
    }

    async function ayarAl(u, gelen) {
        const o = await ta.ayarOku(pool, u);
        const A = gelen && typeof gelen === 'object' && !Array.isArray(gelen) ? ta.duzelt(ta.birlestir(o.ayar, gelen)) : o.ayar;
        return A.performans;
    }

    /** Kartlar ve Telegram yazısı. pf: ayar.performans */
    async function raporHazirla(v, pf, ek = {}) {
        const kartlar = [];
        const uyari = ek.eksik ? 'Veri eksik olabilir: bu tarihte yalnız ' + ek.eksik + ' sipariş görünüyor.' : null;
        if (pf.dps && v.dps) {
            kartlar.push(kart.dpsKarti(v.dps, { ...pf.dpsAyrinti, bas: v.bas, son: v.son, uyari }));
        }
        if (pf.kurye && v.kurye) {
            const ka = pf.kuryeAyrinti;
            const fotolar = ka.foto ? await kart.kuryeFotolari(v.kurye, ek.onizleme ? 6000 : 10000) : new Map();
            kartlar.push(...kart.kuryeKartlari(v.kurye, { ...ka, bas: v.bas, son: v.son, fotolar, uyari: pf.dps && v.dps ? null : uyari }));
        }
        const satir = ['📊 Performans · ' + kart.tarihAraligi(v.bas, v.son)];
        if (v.dps && pf.dps) {
            const f = (o) => kart.ondalik(o.puan) + (o.harf ? ' (' + o.harf + ')' : '');
            satir.push('Bayi DPS ' + f(v.dps.bayi) + ' · Kurye ' + f(v.dps.kurye) + ' · Picker ' + f(v.dps.depocu));
        }
        if (v.kurye && pf.kurye) {
            const aktif = v.kurye.filter((k) => k.siparis > 0);
            satir.push(aktif.length + ' kurye · ' + aktif.reduce((t, k) => t + k.siparis, 0) + ' sipariş');
        }
        if (uyari) satir.push('⚠️ ' + uyari);
        return { kartlar: kartlar.slice(0, 10), baslik: satir.join('\n') };
    }

    /** Önizleme için kurgusal veri (adlar ve sayılar uydurma) */
    function ornekVeri() {
        const dun = new Date(Date.now() - GUN_MS);
        const gun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(dun);
        const k = (ad, siparis, harf, teslim, cdi, ek = {}) => ({
            id: Math.random().toString(16).slice(2).padEnd(24, '0').slice(0, 24), ad, foto: '', siparis, toplamSiparis: siparis, ilk: Math.round(siparis * 0.7),
            birlesen: Math.round(siparis * 0.25), ortTeslimat: teslim, yoldaSure: teslim * 0.35, ulasmaTeslim: 2.4, donusSure: 5.2,
            yoldaPuan: 8.4, teslimatPuan: 97.6, donusPuan: 61.2, cdiPuan: cdi, problemli: 0, harf, ...ek,
        });
        const kriter = (anahtar, ad, agirlik, bayiPuan, kurye, depocu) => ({ anahtar, ad, agirlik, bayiPuan, kurye, depocu });
        return {
            bas: gun, son: gun,
            dps: {
                depoAd: 'Örnek Depo',
                bayi: { puan: 94.62, harf: 'A' }, kurye: { puan: 95.8, harf: 'A+' }, depocu: { puan: 93.41, harf: 'A' },
                kriterler: [
                    kriter('RED_BASKET', 'Kırmızı Sepet', 25, 100, { perf: 0, puan: 100 }, null),
                    kriter('PICKER_ASSIGN_DURATION', 'Toplayıcı Bekliyor', 3, 82.4, null, { perf: 21.3, puan: 82.4 }),
                    kriter('PROBLEMATIC_ORDER', 'Sorunsuz Teslimat', 25, 88.1, { perf: 0.62, puan: 88.1 }, { perf: 0.62, puan: 88.1 }),
                    kriter('COUNTING_PERFORMANCE', 'Sayım Performansı', 7.5, 100, null, { perf: null, puan: 100 }),
                    kriter('BAKERY_PERFORMANCE', 'Fırın Bulunurluk', 10, 91.2, null, { perf: null, puan: 91.2 }),
                    kriter('NEW_IN_WH_DURATION', 'Depo İçi Süre', 7, 100, null, { perf: 0.84, puan: 100 }),
                    kriter('COURIER_DISCIPLINE_INDEX', 'Kurye Disiplin İndeksi', 15, 100, { perf: null, puan: 100 }, null),
                    kriter('ACCEPTANCE_OF_GOODS', 'Mal Kabul', 7.5, 100, null, { perf: 100, puan: 100 }),
                ],
                denetim: { bayi: 0, filo: 0, kalite: 0 },
            },
            kurye: [
                k('Ali Yılmaz', 48, 'A++', 13.2, 98.1), k('Can Demir', 41, 'A+', 14.6, 95.4, { problemli: 1 }),
                k('Ece Kaya', 36, 'A++', 12.8, 99.0), k('Mert Şahin', 29, 'A', 16.9, 91.7, { donusPuan: 44.8 }),
                k('Selin Arslan', 22, 'B', 18.4, 84.2, { teslimatPuan: 81.5 }), k('Deniz Koç', 6, 'F', 21.3, 39.9, { teslimatPuan: 55.5, donusPuan: 21.6 }),
            ],
        };
    }

    app.get('/api/performans/ayar', uye, async (req, res) => {
        try {
            const pf = await ayarAl(req.auth.username);
            res.setHeader('Cache-Control', 'no-store');
            res.json({ ok: true, performans: pf, hesap: (await alicilar(req.auth.username)).length });
        } catch (e) {
            console.error('performans ayar:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    app.post('/api/performans/onizleme', uye, async (req, res) => {
        const u = req.auth.username;
        const b = req.body || {};
        if (!pencere('onizleme:' + u, 15, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
        const v = b.ornek ? ornekVeri() : veriDuzelt(b.veri);
        if (!v) return res.status(400).json({ ok: false, error: 'veri' });
        try {
            const pf = await ayarAl(u, b.ayar && { performans: b.ayar });
            const r = await raporHazirla(v, pf, { onizleme: true });
            res.json({ ok: true, baslik: r.baslik, kartlar: r.kartlar.map((k) => 'data:image/png;base64,' + kucult(k).toString('base64')) });
        } catch (e) {
            console.error('performans onizleme:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /* Zamanlı gönderim aynı gün ve saat için bir kez (iki bilgisayar açıksa da).
       gece.gonderim'e dakika + 10000 ile yazılır; kolon yoksa bellekte tutulur. */
    const bellekteGiden = new Set();
    async function isaretle(u, gun, dakika) {
        try {
            const r = await pool.query(
                'INSERT INTO gece.gonderim (username, gun, dakika) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1',
                [u, gun, GONDERIM_KAYMA + dakika]
            );
            return r.rows.length > 0;
        } catch (e) {
            if (!semaYok(e)) throw e;
            const anahtar = u + '|' + gun + '|' + dakika;
            if (bellekteGiden.has(anahtar)) return false;
            if (bellekteGiden.size > 5000) bellekteGiden.clear();
            bellekteGiden.add(anahtar);
            return true;
        }
    }

    app.post('/api/performans/gonder', uye, async (req, res) => {
        const u = req.auth.username;
        const b = req.body || {};
        if (!telegram.hazirMi()) return res.status(503).json({ ok: false, error: 'bot_hazir_degil' });
        const oto = b.otomatik && typeof b.otomatik === 'object' ? b.otomatik : null;
        if (!oto) {
            if (!pencere('gonder-ara:' + u, 1, 30000)) return res.status(429).json({ ok: false, error: 'cok_sik', bekleSn: 30 });
            if (!pencere('gonder-gun:' + u, 30, GUN_MS)) return res.status(429).json({ ok: false, error: 'gunluk_sinir' });
        }
        const v = veriDuzelt(b.veri);
        if (!v) return res.status(400).json({ ok: false, error: 'veri' });
        try {
            const hedefler = await alicilar(u);
            if (!hedefler.length) return res.status(409).json({ ok: false, error: 'baglanti_yok' });
            const pf = await ayarAl(u, oto ? null : b.ayar && { performans: b.ayar });
            if (oto) {
                const gun = typeof oto.gun === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(oto.gun) ? oto.gun : null;
                const dakika = Number.isInteger(oto.dakika) && oto.dakika >= 0 && oto.dakika < 1440 ? oto.dakika : null;
                if (!gun || dakika == null || !pf.saatler.includes(dakika)) return res.status(400).json({ ok: false, error: 'zaman' });
                if (!(await isaretle(u, gun, dakika))) return res.json({ ok: true, zatenGitti: true });
            }
            const eksik = oto && Number.isInteger(oto.eksik) && oto.eksik >= 0 ? oto.eksik : null;
            const r = await raporHazirla(v, pf, { eksik });
            if (!r.kartlar.length) return res.status(409).json({ ok: false, error: 'bos' });
            const s = await albumGonder(pool, hedefler, r.kartlar, r.baslik, 'performans');
            if (!s.giden) return res.status(502).json({ ok: false, error: 'gonderilemedi' });
            res.json({ ok: true, kart: r.kartlar.length, giden: s.giden });
        } catch (e) {
            console.error('performans gonder:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    /** Asistan: veri henüz tamamlanmadı; ayar açıksa Telegram'a kısa not */
    app.post('/api/performans/ertele', uye, async (req, res) => {
        const u = req.auth.username;
        const b = req.body || {};
        if (!pencere('ertele:' + u, 12, 3600 * 1000)) return res.status(429).json({ ok: false, error: 'cok_sik' });
        try {
            const pf = await ayarAl(u);
            if (!pf.ertelemeBildir || !telegram.hazirMi()) return res.json({ ok: true, bildirildi: false });
            const hedefler = await alicilar(u);
            const n = (x, alt, ust) => (Number.isInteger(x) && x >= alt && x <= ust ? x : null);
            const deneme = n(b.deneme, 1, 20);
            const kez = n(b.kez, 0, 20);
            const siparis = n(b.siparis, 0, 100000);
            const sonraki = n(b.sonrakiDk, 1, 240);
            const sebep = b.sebep === 'oturum' ? 'Franchise oturumu bulunamadı; franchise panelini bir kez aç.'
                : 'Dünün verisi henüz tamamlanmadı' + (siparis != null ? ' (' + siparis + ' sipariş görünüyor)' : '') + '.';
            const metin = b.vazgecildi
                ? '⏹️ Performans raporu bugün gönderilmedi.\n' + sebep
                : '⏳ Performans raporu ertelendi.\n' + sebep + (sonraki ? '\n' + sonraki + ' dk sonra tekrar denenecek' : '') + (deneme && kez ? ' (' + deneme + '/' + kez + ').' : '.');
            let giden = 0;
            for (const h of hedefler) {
                try { await telegram.mesaj(h.chat_id, metin); giden++; } catch (e) { /* sessiz */ }
                await new Promise((r) => setTimeout(r, 400));
            }
            res.json({ ok: true, bildirildi: giden > 0 });
        } catch (e) {
            console.error('performans ertele:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });
}

module.exports = { kur };
