/**
 * Performans raporu: franchise panelinden gelen veriyi temizler
 * ============================================================================
 *
 * Veri sunucuya Getir'den değil, kullanıcının tarayıcısından gelir (site ya da
 * Asistan franchise panelinin kendi isteklerini atar, yanıtı buraya bırakır).
 * Hiçbir alana güvenilmez: yalnız bilinen alanlar, tipine göre düzeltilerek.
 *
 *   dpsDuzelt(ham)    GET /wps/criteria yanıtı (dizi; ilk depo)
 *   kuryeDuzelt(ham)  POST /courier/v2/metrics yanıtlarının data dizileri
 * ============================================================================
 */
'use strict';

const { SUTUNLAR } = require('./sutunlar');

/* Panelin "Depo Performans Sistemi" sayfasındaki adlar */
const KRITER_AD = {
    RED_BASKET: 'Kırmızı Sepet',
    PICKER_ASSIGN_DURATION: 'Toplayıcı Bekliyor',
    PROBLEMATIC_ORDER: 'Sorunsuz Teslimat',
    COUNTING_PERFORMANCE: 'Sayım Performansı',
    BAKERY_PERFORMANCE: 'Fırın Bulunurluk',
    NEW_IN_WH_DURATION: 'Depo İçi Süre',
    COURIER_DISCIPLINE_INDEX: 'Kurye Disiplin İndeksi',
    ACCEPTANCE_OF_GOODS: 'Mal Kabul',
    FLEET_AUDITS: 'Filo Denetimi',
    QA_AUDITS: 'Kalite Denetimi',
};

const metin = (v, azami) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, azami) : '');
const sayi = (v) => {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace('%', '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
const tam = (v) => { const n = sayi(v); return n == null ? null : Math.max(0, Math.min(100000, Math.round(n))); };
const harfMi = (v) => (typeof v === 'string' && /^[A-F][+-]{0,2}$/.test(v.trim()) ? v.trim() : null);
const kriterAdi = (k) => KRITER_AD[k] || String(k || '').toLowerCase().replace(/_/g, ' ').replace(/(^|\s)\S/g, (x) => x.toLocaleUpperCase('tr'));

function altKriterler(grup) {
    const ana = grup && Array.isArray(grup.criterionPoints) ? grup.criterionPoints.find((c) => Array.isArray(c && c.subCriterionPoints)) : null;
    const m = new Map();
    (ana ? ana.subCriterionPoints : []).slice(0, 30).forEach((s) => {
        if (!s || typeof s !== 'object') return;
        const al = (ad) => s[ad + '_75'] !== undefined ? s[ad + '_75'] : s[ad];
        const anahtar = metin(al('subCriterionTranslationKey'), 60);
        if (!/^[A-Z0-9_]{2,60}$/.test(anahtar)) return;
        m.set(anahtar, { puan: sayi(al('subCriterionPoint')), perf: sayi(al('subCriterionPerformancePercentage')), agirlik: sayi(al('subCriterionWeight')) });
    });
    return m;
}

function denetimPuani(grup, anahtar) {
    const c = grup && Array.isArray(grup.criterionPoints) ? grup.criterionPoints.find((x) => x && x.criterionTranslationKey === anahtar) : null;
    return c ? sayi(c.criterionPoint) : null;
}

/** /wps/criteria yanıtı → rapor verisi; tanınmazsa null */
function dpsDuzelt(ham) {
    const o = Array.isArray(ham) ? ham[0] : ham;
    if (!o || typeof o !== 'object') return null;
    const depo = o.warehouseDpsPoints || {};
    const kurye = o.courierDpsPoints || {};
    const depocu = o.pickerDpsPoints || {};
    const ozet = (g) => ({ puan: sayi(g.point), harf: harfMi(g.letterGrade) });
    const bayi = altKriterler(depo);
    const ky = altKriterler(kurye);
    const dp = altKriterler(depocu);
    const kriterler = [...bayi.keys()].map((k) => ({
        anahtar: k,
        ad: kriterAdi(k),
        agirlik: bayi.get(k).agirlik,
        bayiPuan: bayi.get(k).puan,
        kurye: ky.has(k) ? { perf: ky.get(k).perf, puan: ky.get(k).puan } : null,
        depocu: dp.has(k) ? { perf: dp.get(k).perf, puan: dp.get(k).puan } : null,
    }));
    const sonuc = {
        depoAd: metin(o.warehouseName, 80),
        bayi: ozet(depo.point != null ? depo : { point: o.totalWPSPoint_75, letterGrade: o.letterGrade_75 }),
        kurye: ozet(kurye),
        depocu: ozet(depocu),
        kriterler,
        denetim: {
            bayi: denetimPuani(depo, 'FLEET_AUDITS') != null || denetimPuani(depo, 'QA_AUDITS') != null
                ? (denetimPuani(depo, 'FLEET_AUDITS') || 0) + (denetimPuani(depo, 'QA_AUDITS') || 0) : null,
            filo: denetimPuani(kurye, 'FLEET_AUDITS'),
            kalite: denetimPuani(depocu, 'QA_AUDITS'),
        },
    };
    if (sonuc.bayi.puan == null && !kriterler.length) return null;
    return sonuc;
}

const KURYE_FOTO = /^https:\/\/cdn\.getir\.com\/person\/[A-Za-z0-9._-]+\.(?:png|jpe?g)(?:\?[0-9]+)?$/;

/** /courier/v2/metrics data dizisi → kurye listesi (en çok 80). Ölçüler sütun kataloğundan (d). */
function kuryeDuzelt(ham) {
    const liste = Array.isArray(ham) ? ham : [];
    const gorulen = new Set();
    const sonuc = [];
    for (const k of liste) {
        if (!k || typeof k !== 'object') continue;
        const id = metin(k.id, 40);
        if (!/^[a-f0-9]{24}$/.test(id) || gorulen.has(id)) continue;
        gorulen.add(id);
        const d = {};
        for (const t of SUTUNLAR) {
            const v = k[t.alan];
            d[t.anahtar] = t.bicim === 'harf' ? harfMi(v) : t.bicim === 'sayi' ? tam(v) : sayi(v);
        }
        sonuc.push({
            id,
            ad: metin(k.name, 80) || 'Kurye',
            foto: typeof k.image_url === 'string' && KURYE_FOTO.test(k.image_url) ? k.image_url : '',
            siparis: d.siparis || 0,
            toplamSiparis: d.toplamSiparis || 0,
            d,
        });
        if (sonuc.length >= 80) break;
    }
    return sonuc;
}

const tarih = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Gövdeden rapor verisi: { bas, son, dps|null, kurye|null } ; geçersizse null */
function veriDuzelt(v) {
    if (!v || typeof v !== 'object') return null;
    const bas = tarih(v.bas);
    const son = tarih(v.son) || bas;
    if (!bas || !son || son < bas) return null;
    if (Date.parse(son) - Date.parse(bas) > 62 * 864e5) return null;
    const dps = v.dps != null ? dpsDuzelt(v.dps) : null;
    const kurye = v.kurye != null ? kuryeDuzelt(v.kurye) : null;
    if (!dps && !kurye) return null;
    return { bas, son, dps, kurye };
}

module.exports = { dpsDuzelt, kuryeDuzelt, veriDuzelt, KRITER_AD };
