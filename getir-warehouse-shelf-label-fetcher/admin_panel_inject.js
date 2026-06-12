// Admin panel sayfasına extension ID'sini inject eden script
// Bu sayede admin panel extension'ı bulabilir ve mesaj gönderebilir

(function() {
  'use strict';
  
  try {
    // Extension'ın kendi ID'sini al ve window'a ekle
    const extensionId = chrome.runtime.id;
    
    // Window'a extension ID'sini ekle (hemen)
    window.getirWarehouseExtensionId = extensionId;
    window.getirWarehouseExtensionAvailable = true;
    
    console.log('✅ Getir Warehouse Extension ID admin paneline eklendi:', extensionId);
    
    // Mesaj gönderme fonksiyonunu window'a ekle
    window.getirWarehouseExtensionSendMessage = function(message, callback) {
      try {
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
      const event = new CustomEvent('getirWarehouseExtensionReady', {
        detail: { extensionId: extensionId }
      });
      window.dispatchEvent(event);
      console.log('✅ getirWarehouseExtensionReady event gönderildi');
    } catch (e) {
      console.warn('Event gönderilemedi:', e);
    }
    
    // Window'dan gelen mesajları dinle (admin panelden)
    window.addEventListener('message', function(event) {
      // Sadece aynı origin'den gelen mesajları kabul et
      if (event.data && event.data.type === 'WAREHOUSE_FETCH_EXPIRY_PRODUCTS') {
        console.log('📅 Admin panelden SKT çekme isteği alındı');
        window.postMessage({
          type: 'WAREHOUSE_EXPIRY_PROGRESS',
          message: '✅ Extension\'a bağlandı, SKT isteği gönderiliyor…'
        }, '*');

        const sendFetch = () => {
          chrome.runtime.sendMessage({
            type: 'FETCH_EXPIRY_PRODUCTS',
            productIds: event.data.productIds || [],
            warehouseId: event.data.warehouseId,
            endDate: event.data.endDate
          }, (response) => {
            if (chrome.runtime.lastError) {
              window.postMessage({
                type: 'WAREHOUSE_EXPIRY_RESPONSE',
                success: false,
                byProductId: {},
                error: chrome.runtime.lastError.message || 'Extension hatası'
              }, '*');
            }
          });
        };

        chrome.runtime.sendMessage({ type: 'WAKE_UP' }, () => {
          sendFetch();
        });
      } else if (event.data && event.data.type === 'WAREHOUSE_EXPORT_SHELF_LABELS') {
        console.log('📋 Admin panelden raf etiketi çekme isteği alındı');
        
        // İlerleme mesajı gönder
        window.postMessage({
          type: 'WAREHOUSE_SHELF_LABEL_PROGRESS',
          step: 'extension_connected',
          message: '✅ Extension\'a bağlandı'
        }, '*');
        
        // Extension'a mesaj gönder (slowMode / slowModeDelay admin panelden gelir)
        chrome.runtime.sendMessage({
          type: 'EXPORT_SHELF_LABELS',
          slowMode: !!event.data.slowMode,
          slowModeDelay: typeof event.data.slowModeDelay === 'number' ? event.data.slowModeDelay : 2000
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Extension hatası:', chrome.runtime.lastError);
            window.postMessage({
              type: 'WAREHOUSE_SHELF_LABEL_RESPONSE',
              success: false,
              data: null,
              error: chrome.runtime.lastError.message || 'Extension hatası',
              total: 0
            }, '*');
            return;
          }
          
          console.log('📋 Extension işlemi başlatıldı:', response ? JSON.stringify(response) : 'Yanıt yok');
          window.postMessage({
            type: 'WAREHOUSE_SHELF_LABEL_PROGRESS',
            step: 'started',
            message: `✅ İşlem başlatıldı: ${response.message}`
          }, '*');
        });
      }
    });
    
    // Background script'ten gelen mesajları dinle (chrome.runtime.onMessage)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'WAREHOUSE_SHELF_LABEL_PROGRESS') {
        // İlerleme mesajını admin panele ilet
        window.postMessage({
          type: 'WAREHOUSE_SHELF_LABEL_PROGRESS',
          step: message.step,
          message: message.message
        }, '*');
        sendResponse({ success: true });
        return true;
      } else if (message.type === 'WAREHOUSE_SHELF_LABEL_RESPONSE') {
        // Sonuç mesajını admin panele ilet
        window.postMessage({
          type: 'WAREHOUSE_SHELF_LABEL_RESPONSE',
          success: message.success,
          data: message.data,
          error: message.error,
          total: message.total,
          message: message.message
        }, '*');
        sendResponse({ success: true });
        return true;
      } else if (message.type === 'WAREHOUSE_EXPIRY_PROGRESS') {
        window.postMessage({
          type: 'WAREHOUSE_EXPIRY_PROGRESS',
          message: message.message
        }, '*');
        sendResponse({ success: true });
        return true;
      } else if (message.type === 'WAREHOUSE_EXPIRY_RESPONSE') {
        window.postMessage({
          type: 'WAREHOUSE_EXPIRY_RESPONSE',
          success: message.success,
          byProductId: message.byProductId,
          error: message.error,
          total: message.total,
          withData: message.withData
        }, '*');
        sendResponse({ success: true });
        return true;
      }
      return false;
    });
    
    // Extension'ın hazır olduğunu göster
    console.log('✅ Getir Warehouse Extension admin panel için hazır! Extension ID:', extensionId);
    
    // Service worker'ı uyandırmak için ping gönder (hemen)
    function wakeServiceWorker() {
      try {
        chrome.runtime.sendMessage({ type: 'WAKE_UP' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('⚠️ Service worker uyandırılamadı:', chrome.runtime.lastError.message);
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
    
    // Her 10 saniyede bir service worker'ı uyandır (admin panel açıkken)
    setInterval(() => {
      try {
        chrome.runtime.sendMessage({ type: 'WAKE_UP' }, () => {});
      } catch (e) {
        // Sessizce devam et
      }
    }, 10000); // 10 saniye
    
    // localStorage'a da kaydet (backup)
    try {
      localStorage.setItem('getir_warehouse_extension_id', extensionId);
      console.log('✅ Extension ID localStorage\'a kaydedildi');
    } catch (e) {
      console.warn('localStorage\'a kaydedilemedi:', e);
    }
    
  } catch (error) {
    console.error('❌ Admin panel inject hatası:', error);
  }
})();

