// Warehouse (warehouse.getir.com) sayfasında çalışan content script
// Token'ları yakalar (sadece extension içinde kullanım için)

(function () {
  'use strict';
  
  const LOG_PREFIX = '🟢';
  
  console.log(`${LOG_PREFIX} Getir Warehouse Shelf Label Fetcher - Content script yüklendi`);
  
  // Service worker'ı uyandırmak için ping gönder
  function wakeServiceWorker() {
    try {
      chrome.runtime.sendMessage({ type: 'WAKE_UP' }, (response) => {
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
      chrome.runtime.sendMessage({ type: 'WAKE_UP' }, () => {});
    } catch (e) {
      // Sessizce devam et
    }
  }, 10000); // 10 saniye
})();

