/**
 * Modül: Ürün Çekici (yönetici aracı)
 * ============================================================================
 *
 * Kaynağı `getir-product-fetcher/content.js`. Gövde birebir kopyalandı,
 * yalnız çakışan mesaj adları `JBA_URUN_` önekine alındı. Gerekçesi
 * `arka-plan/raf-etiketi.js` başlığında.
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
  
          const LOG_PREFIX = '🔵';
  
          console.log(`${LOG_PREFIX} Getir Product Fetcher - Content script yüklendi`);
  
          // Token'ları extension içinde saklamak için (ürün çekme işlemi için gerekli)
          // Bot'a gönderme YOK - sadece extension içinde kullanım için
  
          function isTokenLike(value) {
            // Franchise token'ları genellikle 200-300 karakter arası
            return typeof value === 'string' && value.startsWith('eyJ') && value.length >= 150;
          }
  
          // Token'ları background script'e ilet (sadece extension içinde kullanım için)
          function sendTokenToBackground(token, tokenType) {
            try {
              chrome.runtime.sendMessage({
                type: 'JBA_URUN_JETON',
                token: token,
                tokenType: tokenType,
                timestamp: Date.now()
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.warn(`${LOG_PREFIX} Token gönderilemedi:`, chrome.runtime.lastError.message);
                  // Service worker uyuyor olabilir - alarm'ı tetikle
                  if (chrome.runtime.lastError.message.includes('message port closed') || 
                      chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
                    console.warn(`${LOG_PREFIX} Service worker uyuyor, uyandırılmaya çalışılıyor...`);
                    // Service worker'ı uyandırmak için bir mesaj daha gönder
                    setTimeout(() => {
                      chrome.runtime.sendMessage({ type: 'JBA_URUN_UYAN' }, () => {});
                    }, 100);
                  }
                  return;
                }
                if (response && response.success) {
                  console.log(`${LOG_PREFIX} Token background'a aktarıldı (${tokenType})`);
                }
              });
            } catch (error) {
              console.error(`${LOG_PREFIX} Token gönderimi hata verdi`, error);
            }
          }
  
          // localStorage fallback (token'ları kontrol et)
          function checkStorageForTokens() {
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) {
                  continue;
                }
                const value = localStorage.getItem(key);
                if (!isTokenLike(value)) {
                  continue;
                }
        
                const lowerKey = key.toLowerCase();
                const tokenType = lowerKey.includes('refresh') ? 'refresh' : 'access';
        
                console.log(`${LOG_PREFIX} localStorage token bulundu (key=${key}, type=${tokenType}), uzunluk: ${value.length}`);
                sendTokenToBackground(value, tokenType);
              }
            } catch (error) {
              console.warn(`${LOG_PREFIX} localStorage taraması yapılamadı`, error);
            }
          }
  
          // localStorage API'lerini patch et (token değişikliklerini yakala)
          function patchStorageAPIs() {
            try {
              const originalSetItem = localStorage.setItem;
              localStorage.setItem = function patchedSetItem(key, value) {
                originalSetItem.apply(this, arguments);
                if (typeof value === 'string' && isTokenLike(value)) {
                  const meta = { origin: `localStorage-set:${key}`, timestamp: Date.now() };
                  const lowerKey = (key || '').toLowerCase();
          
                  const tokenType = lowerKey.includes('refresh') ? 'refresh' : 'access';
                  console.log(`${LOG_PREFIX} localStorage'a token kaydedildi (key=${key}, type=${tokenType}), uzunluk: ${value.length}`);
                  sendTokenToBackground(value, tokenType);
                }
              };
            } catch (error) {
              console.warn(`${LOG_PREFIX} localStorage patch edilemedi`, error);
            }
          }
  
          // İlk yüklemede çalıştır
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
              checkStorageForTokens();
              patchStorageAPIs();
            });
          } else {
            checkStorageForTokens();
            patchStorageAPIs();
          }
  
          // Periyodik kontrol (her 30 saniyede bir)
          setInterval(() => {
            checkStorageForTokens();
          }, 30000);
    }

    JBA.kayit({
        kimlik: 'urunCekici',
        ad: 'Ürün Çekici',
        ozet: 'Franchise ürün kataloğunu yönetici paneline aktarır. Yönetici aracı.',
        hostlar: ['franchise.getir.com'],

        baslat: function () { calistir(); },

        durdur: function () {
            JBA.bildir('Ürün Çekici için sayfayı yenile.', null);
        }
    });
})(window);
