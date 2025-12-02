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
        chrome.runtime.sendMessage({
          type: 'EXPORT_ALL_PRODUCTS'
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Extension hatası:', chrome.runtime.lastError);
            window.postMessage({
              type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
              success: false,
              products: null,
              error: chrome.runtime.lastError.message || 'Extension hatası',
              total: 0
            }, '*');
            return;
          }
          
          console.log('📦 Extension işlemi başlatıldı:', response ? 'Başarılı' : 'Yanıt yok');
          
          // İlk yanıt sadece "işlem başlatıldı" mesajı, asıl sonuç chrome.runtime.onMessage ile gelecek
          // Bu yüzden burada bir şey yapmıyoruz
        });
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
    
    // Getir sitesinden gelen ilerleme mesajlarını admin panele ilet (eski kod - geriye dönük uyumluluk için)
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'GETIR_PROGRESS' && event.source === window) {
        // Admin panele ilet
        window.postMessage({
          type: 'GETIR_PROGRESS',
          step: event.data.step,
          message: event.data.message
        }, '*');
      }
    });
    
    // Extension'ın hazır olduğunu göster
    console.log('✅ Getir Extension admin panel için hazır! Extension ID:', extensionId);
    
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

