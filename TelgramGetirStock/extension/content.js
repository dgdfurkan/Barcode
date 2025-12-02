// Franchise (franchise.getir.com) sayfasında çalışan content script
// - Main world'a script enjekte ederek fetch/XHR token'larını yakalar
// - localStorage fallback'i ile token'ları kontrol eder

(function () {
  'use strict';
  
  const LOG_PREFIX = '🤖';
  const EVENT_SOURCE = 'getir-stock-bot';
  const TOKEN_EVENT = 'GETIR_FRANCHISE_ACCESS_TOKEN';
  const REFRESH_TOKEN_EVENT = 'GETIR_FRANCHISE_REFRESH_TOKEN';
  const HANDSHAKE_EVENT = 'GETIR_FRANCHISE_INJECTED_READY';
  const INJECTED_SCRIPT_ID = '__getir_stock_franchise_injected__';
  let handshakeReceived = false;
  let lastAccessToken = null;
  let lastRefreshToken = null;

  console.log(`${LOG_PREFIX} Franchise content script yüklendi`);

  function isTokenLike(value) {
    // Franchise token'ları genellikle 200-300 karakter arası
    return typeof value === 'string' && value.startsWith('eyJ') && value.length >= 150;
  }

  function injectMainWorldScript() {
    if (document.getElementById(INJECTED_SCRIPT_ID)) {
      return;
    }

    try {
      const script = document.createElement('script');
      script.id = INJECTED_SCRIPT_ID;
      script.src = chrome.runtime.getURL('franchise_injected.js');
      script.type = 'text/javascript';
      script.onload = () => {
        script.remove();
        console.log(`${LOG_PREFIX} Franchise main world script yüklendi`);
      };
      (document.documentElement || document.head || document.body).appendChild(script);
      console.log(`${LOG_PREFIX} Franchise main world script enjeksiyonu istendi`);
    } catch (error) {
      console.error(`${LOG_PREFIX} Franchise main world script enjekte edilemedi`, error);
    }
  }

  function ensureInjectionReady() {
    injectMainWorldScript();
    if (!handshakeReceived) {
      setTimeout(() => {
        if (!handshakeReceived) {
          console.warn(`${LOG_PREFIX} Franchise main world handshake alınamadı, yeniden denenecek`);
          injectMainWorldScript();
        }
      }, 2000);
    }
  }

  function sendMessageToBackground(payload, logPrefix) {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
          if (chrome.runtime.lastError) {
          console.warn(`${LOG_PREFIX} ${logPrefix} gönderilemedi`, chrome.runtime.lastError.message);
          return;
        }
        if (response && response.success) {
          console.log(`${LOG_PREFIX} ${logPrefix} background'a aktarıldı`);
          } else {
          console.warn(`${LOG_PREFIX} ${logPrefix} yanıtı alınamadı`, response);
        }
      });
    } catch (error) {
      console.error(`${LOG_PREFIX} ${logPrefix} gönderimi hata verdi`, error);
    }
  }

  function forwardFranchiseAccessToken(token, meta = {}) {
    if (!isTokenLike(token)) {
      return;
    }
    if (token === lastAccessToken && Date.now() - (meta.timestamp || 0) < 2000) {
      return;
    }
    lastAccessToken = token;
    sendMessageToBackground(
      {
        type: 'TOKEN_UPDATE',
        token,
        timestamp: meta.timestamp || Date.now(),
        origin: meta.origin || 'main-world'
      },
      'Franchise access token'
    );
  }

  function forwardFranchiseRefreshToken(refreshToken, meta = {}) {
    if (!isTokenLike(refreshToken)) {
      return;
    }
    if (refreshToken === lastRefreshToken && Date.now() - (meta.timestamp || 0) < 2000) {
      return;
    }
    lastRefreshToken = refreshToken;
    sendMessageToBackground(
      {
        type: 'FRANCHISE_REFRESH_TOKEN_UPDATE',
        refreshToken,
        timestamp: meta.timestamp || Date.now(),
        origin: meta.origin || 'main-world'
      },
      'Franchise refresh token'
    );
          }

  window.addEventListener(
    'message',
    (event) => {
      if (event.source !== window) {
        return;
      }

      const data = event.data;
      if (!data || data.source !== EVENT_SOURCE) {
        return;
      }

      if (data.type === HANDSHAKE_EVENT) {
        handshakeReceived = true;
        console.log(`${LOG_PREFIX} Franchise main world token interceptor hazır (ts=${data.timestamp})`);
        return;
      }

      if (data.type === TOKEN_EVENT) {
        forwardFranchiseAccessToken(data.token, data.meta || {});
      }

      if (data.type === REFRESH_TOKEN_EVENT) {
        forwardFranchiseRefreshToken(data.refreshToken, data.meta || {});
      }
    },
    false
  );

  // localStorage fallback (hem access hem refresh token taraması)
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
        const meta = { origin: `localStorage:${key}`, timestamp: Date.now() };

        // Key'e göre access/refresh token ayırımı yap
        // "refresh" içeren key'ler -> refresh token
        // "access" içeren key'ler -> access token
        // Sadece "token" içeren key'ler -> access token (varsayılan)
        if (lowerKey.includes('refresh')) {
          console.log(`${LOG_PREFIX} localStorage refresh token bulundu (key=${key}), uzunluk: ${value.length}`);
          forwardFranchiseRefreshToken(value, meta);
        } else if (lowerKey.includes('access') || lowerKey.includes('token')) {
          console.log(`${LOG_PREFIX} localStorage access token bulundu (key=${key}), uzunluk: ${value.length}`);
          forwardFranchiseAccessToken(value, meta);
        }
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} localStorage taraması yapılamadı`, error);
    }
  }

  function patchStorageAPIs() {
    try {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function patchedSetItem(key, value) {
        originalSetItem.apply(this, arguments);
        if (typeof value === 'string' && isTokenLike(value)) {
          const meta = { origin: `localStorage-set:${key}`, timestamp: Date.now() };
          const lowerKey = (key || '').toLowerCase();
          
          // Key'e göre access/refresh token ayırımı yap
          if (lowerKey.includes('refresh')) {
            console.log(`${LOG_PREFIX} localStorage'a refresh token kaydedildi (key=${key}), uzunluk: ${value.length}`);
            forwardFranchiseRefreshToken(value, meta);
          } else if (lowerKey.includes('access') || lowerKey.includes('token')) {
            console.log(`${LOG_PREFIX} localStorage'a access token kaydedildi (key=${key}), uzunluk: ${value.length}`);
            forwardFranchiseAccessToken(value, meta);
          }
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
      ensureInjectionReady();
    });
  } else {
    checkStorageForTokens();
    ensureInjectionReady();
  }

  patchStorageAPIs();
  
  // Periyodik kontrol (her 20 saniyede bir)
  setInterval(() => {
    checkStorageForTokens();
    ensureInjectionReady();
  }, 20000);
  
  // Getir sitesinden gelen ilerleme mesajlarını admin panele ilet
  window.addEventListener('message', function(event) {
    // Sadece aynı window'dan gelen mesajları kabul et
    if (event.source === window && event.data && event.data.type === 'GETIR_PROGRESS') {
      console.log('📊 Getir sitesinden ilerleme mesajı:', event.data.message);
      
      // Admin panele ilet (tüm origin'lere gönder)
      window.postMessage({
        type: 'GETIR_PROGRESS',
        step: event.data.step,
        message: event.data.message
      }, '*');
      
      // Background script'e de ilet (admin panel tab'ına göndermek için)
      chrome.runtime.sendMessage({
        type: 'FORWARD_PROGRESS',
        step: event.data.step,
        message: event.data.message
      }).catch(() => {});
    }
  });
  
  // Background script'ten gelen mesajları dinle
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GETIR_PROGRESS') {
      console.log('📊 Background\'dan ilerleme mesajı:', message.message);
      
      // Admin panele ilet
      window.postMessage({
        type: 'GETIR_PROGRESS',
        step: message.step,
        message: message.message
      }, '*');
      sendResponse({ success: true });
    }
    return true;
  });
})();

