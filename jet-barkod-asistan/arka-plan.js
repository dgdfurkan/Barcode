/**
 * Jet Barkod Asistan. Arka plan.
 *
 * Modüllerin arka plan gerektiren parçaları `arka-plan/` altında ayrı
 * dosyalarda duruyor ve buradan içeri alınıyor. Böylece bir modülün arka
 * plan kodu diğerininkiyle karışmıyor.
 */
import './arka-plan/dusuk-stok.js';
import './arka-plan/sayim-hazirligi.js';
import './arka-plan/raf-etiketi.js';
import './arka-plan/urun-cekici.js';
import './arka-plan/siparis-kopru.js';

/**
 * Güncelleme sonrası açık panel sekmelerini tazele.
 *
 * NEDEN
 * Chrome eklentiyi güncellediğinde eski sekmelerdeki içerik betikleri
 * YETİM kalıyor: `chrome.runtime.id` tanımsız oluyor, `sendMessage`
 * sessizce düşüyor. Sayfa görsel olarak normal görünmeye devam ediyor,
 * ama veri akışı durmuş oluyor. Depoda açık duran panel bu yüzden
 * saatlerce ölü kalıp veritabanını donduruyordu.
 *
 * Yalnız sipariş panosu yenileniyor. Orası salt okunur bir ekran,
 * yenilemek veri kaybettirmiyor. Franchise sayfalarına dokunulmuyor;
 * orada sayım gibi yarım kalabilecek işler var, onlar için içerik
 * betiğindeki yetim bağlam uyarısı devrede.
 */
const PANO_ADRESI = 'https://warehouse.getir.com/r/*/dashboard/orders*';

chrome.runtime.onInstalled.addListener(function (ayrinti) {
    if (ayrinti.reason !== 'update' && ayrinti.reason !== 'install') return;
    try {
        chrome.tabs.query({ url: PANO_ADRESI }, function (sekmeler) {
            if (chrome.runtime.lastError) return;
            (sekmeler || []).forEach(function (t) {
                try { chrome.tabs.reload(t.id, { bypassCache: false }); } catch (e) { /* sekme gitmiş */ }
            });
        });
    } catch (e) { /* sessiz */ }
});
