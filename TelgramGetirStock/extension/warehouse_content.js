// Warehouse domaininde çalışan content script.
// Görevi: main world'e script enjekte etmek ve oradan gelen token'ı background'a iletmek.

(function () {
  const LOG_PREFIX = '🤖';
  const INJECTED_SCRIPT_ID = '__getir_stock_injected__';
  const TOKEN_EVENT = 'GETIR_STOCK_KEYCLOAK_TOKEN';
  const REFRESH_TOKEN_EVENT = 'GETIR_STOCK_KEYCLOAK_REFRESH_TOKEN';
  const HANDSHAKE_EVENT = 'GETIR_STOCK_INJECTED_READY';
  const EVENT_SOURCE = 'getir-stock-bot';
  let injectionRequested = false;
  let handshakeReceived = false;
  let handshakeRetryTimer = null;

  console.log(`${LOG_PREFIX} Warehouse content script yüklendi`);

  function injectMainWorldScript() {
    if (injectionRequested) {
      return;
    }
    injectionRequested = true;
    console.log(`${LOG_PREFIX} Main world script enjeksiyonu isteniyor...`);

    chrome.runtime.sendMessage({ type: 'INJECT_MAIN_WORLD' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`${LOG_PREFIX} Main world script isteği başarısız:`, chrome.runtime.lastError.message);
        injectionRequested = false;
        scheduleInjectionRetry();
              return;
            }

      if (response && response.success) {
        console.log(`${LOG_PREFIX} Main world script executeScript ile çağrıldı`);
        startHandshakeWatchdog();
      } else {
        console.error(`${LOG_PREFIX} Main world script enjeksiyonu reddedildi`, response?.error);
        injectionRequested = false;
        scheduleInjectionRetry();
          }
    });
  }

  function startHandshakeWatchdog() {
    if (handshakeRetryTimer) {
      clearTimeout(handshakeRetryTimer);
      }
    handshakeRetryTimer = setTimeout(() => {
      if (!handshakeReceived) {
        console.warn(`${LOG_PREFIX} Main world handshake gelmedi, yeniden denenecek`);
        injectionRequested = false;
        safeIdleCallback(() => injectMainWorldScript(), 1000);
      }
    }, 3000);
        }
        
  function scheduleInjectionRetry() {
    setTimeout(() => {
      if (!handshakeReceived) {
        injectMainWorldScript();
            }
    }, 2000);
  }

  function safeIdleCallback(fn, timeout = 0) {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(fn, { timeout });
    } else {
      setTimeout(fn, timeout || 0);
        }
      }
      
  function forwardTokenToBackground(token, meta = {}) {
    if (!token || typeof token !== 'string') {
          return;
        }
        
    if (!token.startsWith('eyJ') || token.length < 100) {
      return;
                  }

    try {
      console.log(
        `${LOG_PREFIX} Token alındı (kaynak: ${meta.origin || 'bilinmiyor'}), uzunluk: ${token.length}`
      );
      chrome.runtime.sendMessage(
        {
      type: 'KEYCLOAK_TOKEN_UPDATE',
          token,
          timestamp: Date.now(),
          origin: meta.origin || 'main-world'
        },
        (response) => {
        if (chrome.runtime.lastError) {
            console.warn(`${LOG_PREFIX} Token gönderimi başarısız`, chrome.runtime.lastError.message);
            return;
        }

          if (response && response.success) {
            console.log(`${LOG_PREFIX} Keycloak token background'a aktarıldı`);
          } else {
            console.warn(`${LOG_PREFIX} Background yanıtı alınamadı veya başarısız`, response);
          }
        }
      );
      } catch (error) {
      console.error(`${LOG_PREFIX} Token background'a gönderilemedi`, error);
        }
  }

  function forwardRefreshTokenToBackground(refreshToken, meta = {}) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      return;
                }
                
    if (!refreshToken.startsWith('eyJ') || refreshToken.length < 100) {
      return;
                }

    try {
      console.log(
        `${LOG_PREFIX} Refresh token alındı (kaynak: ${meta.origin || 'bilinmiyor'}), uzunluk: ${refreshToken.length}`
      );
      chrome.runtime.sendMessage(
        {
          type: 'KEYCLOAK_REFRESH_TOKEN_UPDATE',
          refreshToken,
          timestamp: Date.now(),
          origin: meta.origin || 'main-world'
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(`${LOG_PREFIX} Refresh token gönderimi başarısız`, chrome.runtime.lastError.message);
            return;
        }
        
          if (response && response.success) {
            console.log(`${LOG_PREFIX} Keycloak refresh token background'a aktarıldı`);
          } else {
            console.warn(`${LOG_PREFIX} Background yanıtı alınamadı veya başarısız`, response);
            }
          }
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} Refresh token background'a gönderilemedi`, error);
    }
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
        injectionRequested = false;
        if (handshakeRetryTimer) {
          clearTimeout(handshakeRetryTimer);
          handshakeRetryTimer = null;
                }
        console.log(`${LOG_PREFIX} Main world token interceptor hazır (ts=${data.timestamp})`);
        return;
      }

      if (data.type === TOKEN_EVENT) {
        forwardTokenToBackground(data.token, data.meta || {});
      }

      if (data.type === REFRESH_TOKEN_EVENT) {
        forwardRefreshTokenToBackground(data.refreshToken, data.meta || {});
                }
    },
    false
  );

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOG_TO_CONSOLE') {
      console.log(message.message);
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'GET_RESPONSE_BODY') {
      // Artık response gövdesini main world script'i yakalıyor.
      sendResponse({ success: false, reason: 'handled-injected-script' });
      return true;
    }
    
    return false;
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMainWorldScript);
  } else {
    injectMainWorldScript();
    }
})();

