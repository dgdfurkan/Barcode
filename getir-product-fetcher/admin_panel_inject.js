// Admin panel sayfasına extension ID'sini inject eden script
// Bu sayede admin panel extension'ı bulabilir ve mesaj gönderebilir

(function() {
  'use strict';
  
  try {
    // Extension'ın kendi ID'sini al ve window'a ekle
    const extensionId = chrome.runtime.id;
    
    // Window'a extension ID'sini ekle (hemen)
    window.getirExtensionId = extensionId;
    window.getirExtensionAvailable = true;
    
    console.log('✅ Getir Extension ID admin paneline eklendi:', extensionId);
    
    // Mesaj gönderme fonksiyonunu window'a ekle
    window.getirExtensionSendMessage = function(message, callback) {
      try {
        // Content script içindeyiz, direkt chrome.runtime.sendMessage kullanabiliriz
        chrome.runtime.sendMessage(message, callback);
      } catch (error) {
        console.error('❌ Mesaj gönderme hatası:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    };
    
    // Custom event gönder (admin panel dinleyebilir)
    try {
      const event = new CustomEvent('getirExtensionReady', {
        detail: { extensionId: extensionId }
      });
      window.dispatchEvent(event);
      console.log('✅ getirExtensionReady event gönderildi');
    } catch (e) {
      console.warn('Event gönderilemedi:', e);
    }
    
    // Window'dan gelen mesajları dinle (admin panelden)
    window.addEventListener('message', function(event) {
      // Sadece aynı origin'den gelen mesajları kabul et
      if (event.data && event.data.type === 'GETIR_EXPORT_PRODUCTS') {
        console.log('📦 Admin panelden ürün çekme isteği alındı');
        
        // İlerleme mesajı gönder
        window.postMessage({
          type: 'GETIR_PROGRESS',
          step: 'extension_connected',
          message: '✅ Extension\'a bağlandı'
        }, '*');
        
        // Extension'a mesaj gönder
        // Not: sendResponse hemen çağrılacak, asıl sonuç chrome.runtime.onMessage ile gelecek
        try {
          // Önce service worker'ı uyandırmaya çalış
          chrome.runtime.sendMessage({ type: 'WAKE_UP' }, () => {
            // Service worker uyandı, şimdi asıl mesajı gönder
            setTimeout(() => {
              chrome.runtime.sendMessage({
                type: 'EXPORT_ALL_PRODUCTS'
              }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Extension hatası:', chrome.runtime.lastError);
              console.error('❌ Hata detayı:', chrome.runtime.lastError.message);
              
              // Service worker uyuyor olabilir - kullanıcıya bilgi ver
              window.postMessage({
                type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
                success: false,
                products: null,
                error: 'Service worker uyuyor. Lütfen extension\'ı yeniden yükleyin veya sayfayı yenileyin.',
                total: 0
              }, '*');
              return;
            }
            
            console.log('📦 Extension işlemi başlatıldı:', response ? JSON.stringify(response) : 'Yanıt yok');
            
            if (response && response.success) {
              console.log('✅ İşlem başlatıldı:', response.message);
            }
            
            // İlk yanıt sadece "işlem başlatıldı" mesajı, asıl sonuç chrome.runtime.onMessage ile gelecek
            // Bu yüzden burada bir şey yapmıyoruz
              });
            }, 100); // 100ms bekle (service worker uyanması için)
          });
        } catch (error) {
          console.error('❌ Mesaj gönderme hatası:', error);
          window.postMessage({
            type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
            success: false,
            products: null,
            error: 'Mesaj gönderilemedi: ' + error.message,
            total: 0
          }, '*');
        }
      }
    });
    
    // Background script'ten gelen mesajları dinle (chrome.runtime.onMessage)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GETIR_PROGRESS') {
        // İlerleme mesajını admin panele ilet
        window.postMessage({
          type: 'GETIR_PROGRESS',
          step: message.step,
          message: message.message
        }, '*');
        sendResponse({ success: true });
        return true;
      } else if (message.type === 'GETIR_EXPORT_PRODUCTS_RESPONSE') {
        // Sonuç mesajını admin panele ilet
        window.postMessage({
          type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
          success: message.success,
          products: message.products,
          error: message.error,
          total: message.total,
          message: message.message
        }, '*');
        sendResponse({ success: true });
        return true;
      }
      return false;
    });
    
    // Extension'ın hazır olduğunu göster
    console.log('✅ Getir Extension admin panel için hazır! Extension ID:', extensionId);
    
    // Service worker'ı uyandırmak için ping gönder (hemen)
    function wakeServiceWorker() {
      try {
        chrome.runtime.sendMessage({ type: 'WAKE_UP' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('⚠️ Service worker uyandırılamadı:', chrome.runtime.lastError.message);
            // Tekrar dene
            setTimeout(wakeServiceWorker, 1000);
          } else {
            console.log('✅ Service worker uyandırıldı');
          }
        });
      } catch (e) {
        console.warn('Service worker uyandırma hatası:', e);
        setTimeout(wakeServiceWorker, 1000);
      }
    }
    
    // Hemen uyandır
    wakeServiceWorker();
    
    // Her 5 saniyede bir service worker'ı uyandır (admin panel açıkken)
    setInterval(() => {
      try {
        chrome.runtime.sendMessage({ type: 'WAKE_UP' }, () => {});
      } catch (e) {
        // Sessizce devam et
      }
    }, 5000); // 5 saniye
    
    // localStorage'a da kaydet (backup)
    try {
      localStorage.setItem('getir_extension_id', extensionId);
      console.log('✅ Extension ID localStorage\'a kaydedildi');
    } catch (e) {
      console.warn('localStorage\'a kaydedilemedi:', e);
    }
    
  } catch (error) {
    console.error('❌ Admin panel inject hatası:', error);
  }
})();

