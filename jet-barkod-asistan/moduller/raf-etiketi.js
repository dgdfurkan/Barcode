/**
 * Modül: Raf Etiketi Çekici (yönetici aracı)
 * ============================================================================
 *
 * Kaynağı `getir-warehouse-shelf-label-fetcher/content.js`. Gövde birebir
 * kopyalandı, yalnız çakışan mesaj adları `JBA_RAF_` önekine alındı.
 * Gerekçesi `arka-plan/raf-etiketi.js` başlığında.
 *
 * Bu araç yönetici paneli içindir, günlük kullanıcıya bir şey göstermez.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var kuruldu = false;

    function calistir() {
        if (kuruldu) return;
        kuruldu = true;

          'use strict';
  
          const LOG_PREFIX = '🟢';
  
          console.log(`${LOG_PREFIX} Getir Warehouse Shelf Label Fetcher - Content script yüklendi`);
  
          // Service worker'ı uyandırmak için ping gönder
          function wakeServiceWorker() {
            try {
              chrome.runtime.sendMessage({ type: 'JBA_RAF_UYAN' }, (response) => {
                if (chrome.runtime.lastError) {
                  console.warn(`${LOG_PREFIX} Service worker uyandırılamadı:`, chrome.runtime.lastError.message);
                  setTimeout(wakeServiceWorker, 1000);
                } else {
                  console.log(`${LOG_PREFIX} Service worker uyandırıldı`);
                }
              });
            } catch (e) {
              console.warn('Service worker uyandırma hatası:', e);
              setTimeout(wakeServiceWorker, 1000);
            }
          }
  
          // Hemen uyandır
          wakeServiceWorker();
  
          // Her 10 saniyede bir service worker'ı uyandır
          setInterval(() => {
            try {
              chrome.runtime.sendMessage({ type: 'JBA_RAF_UYAN' }, () => {});
            } catch (e) {
              // Sessizce devam et
            }
          }, 10000); // 10 saniye
    }

    JBA.kayit({
        kimlik: 'rafEtiketi',
        ad: 'Raf Etiketi Çekici',
        ozet: 'Warehouse raf etiketlerini yönetici paneline aktarır. Yönetici aracı.',
        hostlar: ['warehouse.getir.com'],

        baslat: function () { calistir(); },

        durdur: function () {
            JBA.bildir('Raf Etiketi Çekici için sayfayı yenile.', null);
        }
    });
})(window);
