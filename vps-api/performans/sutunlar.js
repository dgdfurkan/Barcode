/**
 * Kurye CDI kartının sütun kataloğu (tek kaynak)
 * ============================================================================
 *
 * Kartın sütunları, ayarlar sayfasındaki seçim listesi ve ayar doğrulaması
 * buradan beslenir. Yeni ölçü eklemek için bir satır yeter:
 *   anahtar   ayarda saklanan ad
 *   ad        kartta ve sayfada görünen ad (panelin adı, kısaltılmış)
 *   grup      üstteki renkli bant: siparis | surec | sure | problem | cdi
 *   alan      /courier/v2/metrics yanıtındaki alan
 *   bicim     sayi | dk | yuzde | harf
 *   renk      puan (yeşil/kırmızı eşikli) | problem | yok
 *
 * Varsayılan sıra ve seçim, kullanıcının elle kullandığı CDI tablosunun
 * sırası: Siparişler → Süreç puanları → Problemli → CDI ve Not.
 * ============================================================================
 */
'use strict';

const GRUPLAR = {
    siparis: { ad: 'SİPARİŞLER', kisa: 'SİPARİŞ', renk: '#1d4ed8', zemin: '#dbeafe', hucre: '#f3f8ff' },
    surec: { ad: 'SÜREÇ PUANLARI', kisa: 'SÜREÇ', renk: '#047857', zemin: '#d1fae5', hucre: '#f2fcf7' },
    sure: { ad: 'SÜRELER (DK)', kisa: 'SÜRE', renk: '#b45309', zemin: '#fef3c7', hucre: '#fffbf0' },
    problem: { ad: 'PROBLEMLİ', kisa: 'PROB.', renk: '#be123c', zemin: '#ffe4e6', hucre: '#fff5f6' },
    cdi: { ad: 'CDİ SKORU', kisa: 'CDİ', renk: '#5b21b6', zemin: '#ede9fe', hucre: '#f8f6ff' },
};

const SUTUNLAR = [
    { anahtar: 'siparis', ad: 'Sipariş', grup: 'siparis', alan: 'order_count', bicim: 'sayi', renk: 'yok' },
    { anahtar: 'ilk', ad: 'İlk Sipariş', grup: 'siparis', alan: 'first_order_count', bicim: 'sayi', renk: 'yok' },
    { anahtar: 'birlesen', ad: 'Birleşen', grup: 'siparis', alan: 'batched_order_count', bicim: 'sayi', renk: 'yok' },
    { anahtar: 'toplamSiparis', ad: 'Toplam Sipariş', grup: 'siparis', alan: 'total_order_count', bicim: 'sayi', renk: 'yok' },
    { anahtar: 'carsi', ad: 'Çarşı Sipariş', grup: 'siparis', alan: 'artisan_order_count', bicim: 'sayi', renk: 'yok' },
    { anahtar: 'finans', ad: 'Finans Sipariş', grup: 'siparis', alan: 'getir_finance_order_count', bicim: 'sayi', renk: 'yok' },
    { anahtar: 'yoldaPuan', ad: 'Yolda Puanı', grup: 'surec', alan: 'onway_score', bicim: 'yuzde', renk: 'yok' },
    { anahtar: 'teslimatPuan', ad: 'Teslimat Puanı', grup: 'surec', alan: 'deliver_score', bicim: 'yuzde', renk: 'puan' },
    { anahtar: 'donusPuan', ad: 'Dönüş Puanı', grup: 'surec', alan: 'return_score', bicim: 'yuzde', renk: 'puan' },
    { anahtar: 'ortTeslimat', ad: 'Ort. Teslimat', grup: 'sure', alan: 'avg_delivery_duration', bicim: 'dk', renk: 'yok' },
    { anahtar: 'yoldaSure', ad: 'Yolda Geçen', grup: 'sure', alan: 'onway_to_reach_duration', bicim: 'dk', renk: 'yok' },
    { anahtar: 'ulasmaTeslim', ad: 'Ulaşma Teslim', grup: 'sure', alan: 'reach_to_deliver_duration', bicim: 'dk', renk: 'yok' },
    { anahtar: 'donusSure', ad: 'Depoya Dönüş', grup: 'sure', alan: 'return_duration', bicim: 'dk', renk: 'yok' },
    { anahtar: 'toplama', ad: 'Toplama', grup: 'sure', alan: 'picker_assign_to_prepare_duration', bicim: 'dk', renk: 'yok' },
    { anahtar: 'bekleme', ad: 'Kurye Bekliyor', grup: 'sure', alan: 'waste_time_in_preparation_min', bicim: 'dk', renk: 'yok' },
    { anahtar: 'cdiElDegistirme', ad: 'CDI El Değiştirme', grup: 'sure', alan: 'cdi_realized_handover_to_depart_duration', bicim: 'dk', renk: 'yok' },
    { anahtar: 'cdiYoldaUlasma', ad: 'CDI Yolda Ulaşma', grup: 'sure', alan: 'cdi_realized_onway_to_reach_duration', bicim: 'dk', renk: 'yok' },
    { anahtar: 'cdiUlasmaTeslim', ad: 'CDI Ulaşma Teslimat', grup: 'sure', alan: 'cdi_realized_reach_to_deliver_duration_in_minute', bicim: 'dk', renk: 'yok' },
    { anahtar: 'cdiTeslimatDonus', ad: 'CDI Teslimat Dönüş', grup: 'sure', alan: 'cdi_realized_deliver_to_return_duration', bicim: 'dk', renk: 'yok' },
    { anahtar: 'problemli', ad: 'Problemli', grup: 'problem', alan: 'problematic_order_count', bicim: 'sayi', renk: 'problem' },
    { anahtar: 'cdiPuan', ad: 'CDI', grup: 'cdi', alan: 'cdi_order_score', bicim: 'yuzde', renk: 'puan' },
    { anahtar: 'harf', ad: 'Not', grup: 'cdi', alan: 'cdi_letter_grade', bicim: 'harf', renk: 'yok' },
];

const VARSAYILAN_SUTUNLAR = ['siparis', 'ilk', 'birlesen', 'toplamSiparis', 'carsi', 'finans', 'yoldaPuan', 'teslimatPuan', 'donusPuan', 'problemli', 'cdiPuan', 'harf'];

/* Kartın üstündeki özet kutuları (en çok 6, seçilen sırayla). Hesapları kart.js'te. */
const OZETLER = [
    { anahtar: 'toplamSiparis', ad: 'Toplam Sipariş' },
    { anahtar: 'kurye', ad: 'Kurye' },
    { anahtar: 'ortTeslimat', ad: 'Ort. Teslimat' },
    { anahtar: 'ortCdi', ad: 'Ort. CDI' },
    { anahtar: 'genelCdi', ad: 'Genel CDI' },
    { anahtar: 'app', ad: 'A++ Kurye' },
    { anahtar: 'problemli', ad: 'Problemli' },
    { anahtar: 'ilk', ad: 'İlk Sipariş' },
    { anahtar: 'birlesen', ad: 'Birleşen Sipariş' },
    { anahtar: 'carsi', ad: 'Çarşı Sipariş' },
    { anahtar: 'finans', ad: 'Finans Sipariş' },
    { anahtar: 'teslimatPuan', ad: 'Ort. Teslimat Puanı' },
    { anahtar: 'donusPuan', ad: 'Ort. Dönüş Puanı' },
];
const VARSAYILAN_OZET = ['toplamSiparis', 'kurye', 'ortTeslimat', 'ortCdi', 'app', 'problemli'];
const EN_COK_OZET = 6;
const OZET_ANAHTAR = new Set(OZETLER.map((o) => o.anahtar));

function ozetDuzelt(v) {
    if (!Array.isArray(v)) return VARSAYILAN_OZET.slice();
    const l = [...new Set(v.filter((k) => typeof k === 'string' && OZET_ANAHTAR.has(k)))].slice(0, EN_COK_OZET);
    return l.length ? l : VARSAYILAN_OZET.slice();
}

const ANAHTARLAR = new Set(SUTUNLAR.map((s) => s.anahtar));
const SUTUN = new Map(SUTUNLAR.map((s) => [s.anahtar, s]));

/** Ayardaki sütun listesi: bilinmeyenler atılır, tekrarlar silinir; boşsa varsayılan */
function sutunlariDuzelt(v) {
    if (!Array.isArray(v)) return VARSAYILAN_SUTUNLAR.slice();
    const l = [...new Set(v.filter((k) => typeof k === 'string' && ANAHTARLAR.has(k)))];
    return l.length ? l : VARSAYILAN_SUTUNLAR.slice();
}

/** Sayfaya giden sade katalog */
function katalog() {
    return {
        gruplar: Object.fromEntries(Object.entries(GRUPLAR).map(([k, g]) => [k, { ad: g.ad, renk: g.renk, zemin: g.zemin }])),
        sutunlar: SUTUNLAR.map((s) => ({ anahtar: s.anahtar, ad: s.ad, grup: s.grup })),
        varsayilan: VARSAYILAN_SUTUNLAR.slice(),
        ozetler: OZETLER.map((o) => ({ ...o })),
        ozetVarsayilan: VARSAYILAN_OZET.slice(),
        enCokOzet: EN_COK_OZET,
    };
}

module.exports = { GRUPLAR, SUTUNLAR, SUTUN, VARSAYILAN_SUTUNLAR, sutunlariDuzelt, OZETLER, VARSAYILAN_OZET, ozetDuzelt, katalog };
