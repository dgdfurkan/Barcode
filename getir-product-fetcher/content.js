// Franchise (franchise.getir.com) sayfasında çalışan content script
// Token'ları yakalar (sadece extension içinde kullanım için, bot'a gönderme yok)

(function () {
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
        type: 'TOKEN_UPDATE',
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
              chrome.runtime.sendMessage({ type: 'WAKE_UP' }, () => {});
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
})();

