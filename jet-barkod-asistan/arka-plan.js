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

chrome.runtime.onInstalled.addListener(function (ayrinti) {
    if (ayrinti.reason === 'install') {
        console.log('[Jet Barkod] Asistan kuruldu.');
    }
});
