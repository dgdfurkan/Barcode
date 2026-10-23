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
 *   GET  /api/performans/ayar       Asistan: zamanlama ayarı (+ sütun kataloğu)
 *   POST /api/performans/onizleme   { rapor: dps|kurye, veri | ornek, ayar? } → kart (1600 px)
 *   POST /api/performans/gonder     { rapor, veri, ayar?, otomatik?: { gun, dakika, eksik } }
 *                                   Fotoğraf + istenirse tam kalite dosya (3840 px)
 *   POST /api/performans/ertele     Asistan: "veri gelmedi, X dk sonra" bildirimi
 * ============================================================================
 */
'use strict';

const telegram = require('../sayim-raporu/telegram');
const ta = require('../telegram-ayar');
const { albumGonder, belgeGonder, kucult } = require('../gece-raporu/paylas');
const { veriDuzelt } = require('./veri');
const { katalog } = require('./sutunlar');
const kart = require('./kart');

const HAKLAR = ['satistanKaldirma', 'itirazYazici', 'stokSayimi', 'jetBarkodAsistan'];
const GUN_MS = 24 * 3600 * 1000;
// gece.gonderim'de zamanlı rapor saatleriyle çakışmasın: DPS dakika + 10000, Kurye dakika + 12000
const GONDERIM_KAYMA = { dps: 10000, kurye: 12000 };
const RAPORLAR = new Set(['dps', 'kurye']);

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

    /** Tek raporun kartı ve Telegram yazısı. pf: ayar.performans, rapor: dps | kurye */
    async function raporHazirla(v, pf, rapor, ek = {}) {
        const uyari = ek.eksik != null ? 'Veri eksik olabilir: bu tarihte yalnız ' + ek.eksik + ' sipariş görünüyor.' : null;
        const tarih = kart.tarihAraligi(v.bas, v.son);
        if (rapor === 'dps') {
            if (!v.dps) return { kartlar: [], baslik: '' };
            const d = v.dps;
            const f = (o) => kart.ondalik(o.puan) + (o.harf ? ' (' + o.harf + ')' : '');
            return {
                kartlar: [kart.dpsKarti(d, { ...pf.dps, bas: v.bas, son: v.son, uyari })],
                baslik: ['🏬 DPS · ' + tarih, 'Bayi ' + f(d.bayi) + ' · Kurye ' + f(d.kurye) + ' · Picker ' + f(d.depocu), uyari ? '⚠️ ' + uyari : null].filter(Boolean).join('\n'),
                tamKalite: pf.dps.tamKalite, ad: 'dps-' + v.bas + (v.son !== v.bas ? '_' + v.son : ''),
            };
        }
        if (!v.kurye) return { kartlar: [], baslik: '' };
        const ka = pf.kurye;
        const fotolar = ka.foto ? await kart.kuryeFotolari(v.kurye, ek.onizleme ? 6000 : 10000) : new Map();
        const aktif = v.kurye.filter((k) => k.siparis >= Math.max(1, ka.enAzSiparis));
        return {
            kartlar: [kart.kuryeKarti(v.kurye, { ...ka, bas: v.bas, son: v.son, fotolar, uyari })],
            baslik: ['🛵 Kurye CDI · ' + tarih, aktif.length + ' kurye · ' + aktif.reduce((t, k) => t + k.siparis, 0) + ' sipariş', uyari ? '⚠️ ' + uyari : null].filter(Boolean).join('\n'),
            tamKalite: ka.tamKalite, ad: 'kurye-cdi-' + v.bas + (v.son !== v.bas ? '_' + v.son : ''),
        };
    }

    /** Önizleme için kurgusal veri (adlar ve sayılar uydurma), panel yanıtı biçiminde */
    function ornekVeri() {
        const dun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - GUN_MS));
        const alt = (k, p, perf, w) => ({ subCriterionPoint_75: p, subCriterionPerformancePercentage_75: perf, subCriterionTranslationKey_75: k, subCriterionWeight_75: w });
        const dps = [{
            warehouseName: 'Örnek Depo',
            warehouseDpsPoints: { point: 94.62, letterGrade: 'A', criterionPoints: [{ subCriterionPoints: [
                alt('RED_BASKET', 100, 0, 25), alt('PICKER_ASSIGN_DURATION', 82.4, 21.3, 3), alt('PROBLEMATIC_ORDER', 88.1, 0.62, 25), alt('COUNTING_PERFORMANCE', 100, null, 7.5),
                alt('BAKERY_PERFORMANCE', 91.2, null, 10), alt('NEW_IN_WH_DURATION', 100, 0.84, 7), alt('COURIER_DISCIPLINE_INDEX', 100, null, 15), alt('ACCEPTANCE_OF_GOODS', 100, 100, 7.5)] },
            { criterionPoint: 0, criterionTranslationKey: 'FLEET_AUDITS' }, { criterionPoint: 0, criterionTranslationKey: 'QA_AUDITS' }] },
            courierDpsPoints: { point: 95.8, letterGrade: 'A+', criterionPoints: [{ subCriterionPoints: [alt('RED_BASKET', 100, 0, 44.44), alt('PROBLEMATIC_ORDER', 88.1, 0.62, 28.89), alt('COURIER_DISCIPLINE_INDEX', 100, null, 26.67)] }, { criterionPoint: 0, criterionTranslationKey: 'FLEET_AUDITS' }] },
            pickerDpsPoints: { point: 93.41, letterGrade: 'A', criterionPoints: [{ subCriterionPoints: [alt('PICKER_ASSIGN_DURATION', 82.4, 21.3, 6.86), alt('PROBLEMATIC_ORDER', 88.1, 0.62, 20), alt('COUNTING_PERFORMANCE', 100, null, 17.14), alt('BAKERY_PERFORMANCE', 91.2, null, 22.86), alt('NEW_IN_WH_DURATION', 100, 0.84, 16), alt('ACCEPTANCE_OF_GOODS', 100, 100, 17.14)] }, { criterionPoint: 0, criterionTranslationKey: 'QA_AUDITS' }] },
        }];
        const k = (i, ad, sip, harf, cdi, teslim, donus, prob, sure) => ({
            id: String(i).repeat(24).slice(0, 24), name: ad, image_url: '', order_count: sip, total_order_count: sip + (i % 3), first_order_count: Math.round(sip * 0.72),
            batched_order_count: Math.round(sip * 0.26), artisan_order_count: i % 4 === 0 ? 1 : 0, getir_finance_order_count: 0,
            onway_score: (4 + i * 1.7).toFixed(1) + '%', deliver_score: teslim, return_score: donus, cdi_order_score: cdi, problematic_order_count: prob,
            avg_delivery_duration: sure, onway_to_reach_duration: '4.6', reach_to_deliver_duration: '2.3', return_duration: '5.4',
            picker_assign_to_prepare_duration: '1.0', waste_time_in_preparation_min: '0.3', cdi_letter_grade: harf,
            cdi_realized_handover_to_depart_duration: '1.0', cdi_realized_onway_to_reach_duration: '3.0', cdi_realized_reach_to_deliver_duration_in_minute: '3.0', cdi_realized_deliver_to_return_duration: '2.8',
        });
        const kurye = [
            k(1, 'Ali Yılmaz', 54, 'A++', '97.3%', '99.4%', '51.6%', 0, '15.3'), k(2, 'Can Demir', 33, 'A+', '91.5%', '99.7%', '63.3%', 0, '13.3'),
            k(3, 'Ece Kaya', 32, 'A++', null, '96.7%', '65.5%', 0, '16.9'), k(4, 'Mert Şahin', 29, 'A+', '94.6%', '99.8%', '53.6%', 1, '16.3'),
            k(5, 'Selin Arslan', 28, 'A++', '96.4%', '98.8%', '72.3%', 0, '13.2'), k(6, 'Deniz Koç', 21, 'A++', '95.1%', '72.5%', '60.1%', 0, '15.7'),
            k(7, 'Ozan Çelik', 17, 'A', '93.9%', '98.0%', '51.2%', 0, '15.1'), k(8, 'Burak Aydın', 14, 'A++', '100.0%', '97.4%', '93.0%', 0, '11.1'),
            k(9, 'Gizem Öztürk', 4, 'F', '39.9%', '55.5%', '21.6%', 0, '21.3'),
        ];
        return veriDuzelt({ bas: dun, son: dun, dps, kurye });
    }

    app.get('/api/performans/ayar', uye, async (req, res) => {
        try {
            const pf = await ayarAl(req.auth.username);
            res.setHeader('Cache-Control', 'no-store');
            res.json({ ok: true, performans: pf, hesap: (await alicilar(req.auth.username)).length, katalog: katalog() });
        } catch (e) {
            console.error('performans ayar:', e.message);
            res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    app.post('/api/performans/onizleme', uye, async (req, res) => {
        const u = req.auth.username;
        const b = req.body || {};
        if (!pencere('onizleme:' + u, 15, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
        const rapor = RAPORLAR.has(b.rapor) ? b.rapor : null;
        if (!rapor) return res.status(400).json({ ok: false, error: 'rapor' });
        const v = b.ornek ? ornekVeri() : veriDuzelt(b.veri);
        if (!v) return res.status(400).json({ ok: false, error: 'veri' });
        try {
            const pf = await ayarAl(u, b.ayar && { performans: b.ayar });
            const r = await raporHazirla(v, pf, rapor, { onizleme: true });
            // Önizleme 1600 px: yakınlaştırınca da okunur
            res.json({ ok: true, baslik: r.baslik, kartlar: r.kartlar.map((k) => 'data:image/png;base64,' + kucult(k, 1600).toString('base64')) });
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
                [u, gun, dakika]
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
        if (!RAPORLAR.has(b.rapor)) return res.status(400).json({ ok: false, error: 'rapor' });
        if (!oto) {
            if (!pencere('gonder-ara:' + u, 1, 30000)) return res.status(429).json({ ok: false, error: 'cok_sik', bekleSn: 30 });
            if (!pencere('gonder-gun:' + u, 30, GUN_MS)) return res.status(429).json({ ok: false, error: 'gunluk_sinir' });
        }
        const rapor = RAPORLAR.has(b.rapor) ? b.rapor : null;
        if (!rapor) return res.status(400).json({ ok: false, error: 'rapor' });
        const v = veriDuzelt(b.veri);
        if (!v) return res.status(400).json({ ok: false, error: 'veri' });
        try {
            const hedefler = await alicilar(u);
            if (!hedefler.length) return res.status(409).json({ ok: false, error: 'baglanti_yok' });
            const pf = await ayarAl(u, oto ? null : b.ayar && { performans: b.ayar });
            if (oto) {
                const gun = typeof oto.gun === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(oto.gun) ? oto.gun : null;
                const dakika = Number.isInteger(oto.dakika) && oto.dakika >= 0 && oto.dakika < 1440 ? oto.dakika : null;
                if (!gun || dakika == null || !pf[rapor].saatler.includes(dakika)) return res.status(400).json({ ok: false, error: 'zaman' });
                if (!(await isaretle(u, gun, GONDERIM_KAYMA[rapor] + dakika))) return res.json({ ok: true, zatenGitti: true });
            }
            const eksik = oto && Number.isInteger(oto.eksik) && oto.eksik >= 0 ? oto.eksik : null;
            const r = await raporHazirla(v, pf, rapor, { eksik });
            if (!r.kartlar.length) return res.status(409).json({ ok: false, error: 'bos' });
            const s = await albumGonder(pool, hedefler, r.kartlar, r.baslik, r.ad);
            if (!s.giden) return res.status(502).json({ ok: false, error: 'gonderilemedi' });
            // Tam kalite: aynı kart dosya olarak (Telegram fotoğrafı küçültüyor)
            if (r.tamKalite) await belgeGonder(pool, hedefler, r.kartlar, r.ad).catch(() => null);
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
            if (!pf.kontrol.ertelemeBildir || !telegram.hazirMi()) return res.json({ ok: true, bildirildi: false });
            const raporAd = b.rapor === 'dps' ? 'DPS raporu' : b.rapor === 'kurye' ? 'Kurye CDI raporu' : b.rapor === 'ikisi' ? 'DPS ve Kurye CDI raporları' : 'Performans raporu';
            const hedefler = await alicilar(u);
            const n = (x, alt, ust) => (Number.isInteger(x) && x >= alt && x <= ust ? x : null);
            const deneme = n(b.deneme, 1, 20);
            const kez = n(b.kez, 0, 20);
            const siparis = n(b.siparis, 0, 100000);
            const sonraki = n(b.sonrakiDk, 1, 240);
            const sebep = b.sebep === 'oturum' ? 'Franchise oturumu bulunamadı; franchise panelini bir kez aç.'
                : 'Dünün verisi henüz tamamlanmadı' + (siparis != null ? ' (' + siparis + ' sipariş görünüyor)' : '') + '.';
            const metin = b.vazgecildi
                ? '⏹️ ' + raporAd + ' bugün gönderilmedi.\n' + sebep
                : '⏳ ' + raporAd + ' ertelendi.\n' + sebep + (sonraki ? '\n' + sonraki + ' dk sonra tekrar denenecek' : '') + (deneme && kez ? ' (' + deneme + '/' + kez + ').' : '.');
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
