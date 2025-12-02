(function () {
  const FLAG_KEY = '__GETIR_STOCK_INJECTED__';
  const EVENT_SOURCE = 'getir-stock-bot';
  const TOKEN_EVENT = 'GETIR_STOCK_KEYCLOAK_TOKEN';
  const REFRESH_TOKEN_EVENT = 'GETIR_STOCK_KEYCLOAK_REFRESH_TOKEN';
  const HANDSHAKE_EVENT = 'GETIR_STOCK_INJECTED_READY';
  const MIN_TOKEN_LENGTH = 100;
  const LOG_PREFIX = '🤖';
  const WAREHOUSE_PATTERNS = [
    /https:\/\/(?:[^/]+\.)?warehouse-panel-api-gateway\.getirapi\.com/i,
    /https:\/\/warehouse\.getir\.com/i,
    /https:\/\/stockid\.getirapi\.com/i
  ];
  
  const TOKEN_ENDPOINT_PATTERNS = [
    /\/protocol\/openid-connect\/token/i,
    /stockid\.getirapi\.com.*\/token/i
  ];

  if (window[FLAG_KEY]) {
    return;
  }
  window[FLAG_KEY] = true;

  function sendMessage(payload) {
    try {
      window.postMessage(
        {
          source: EVENT_SOURCE,
          timestamp: Date.now(),
          ...payload
        },
        '*'
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} Token postMessage başarısız`, error);
    }
  }

  function announceReady() {
    sendMessage({ type: HANDSHAKE_EVENT });
  }

  function postToken(token, meta) {
    console.log(
      `${LOG_PREFIX} Token yakalandı (kaynak: ${meta?.origin || 'bilinmiyor'}) uzunluk: ${
        token?.length || 0
      }`
    );
    sendMessage({
      type: TOKEN_EVENT,
      token,
      meta
    });
  }

  function postRefreshToken(refreshToken, meta) {
    console.log(
      `${LOG_PREFIX} Refresh token yakalandı (kaynak: ${meta?.origin || 'bilinmiyor'}) uzunluk: ${
        refreshToken?.length || 0
      }`
    );
    sendMessage({
      type: REFRESH_TOKEN_EVENT,
      refreshToken,
      meta
    });
  }

  function isTokenLike(value) {
    return typeof value === 'string' && value.startsWith('eyJ') && value.length > MIN_TOKEN_LENGTH;
  }

  function sanitizeBearer(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }
    if (value.startsWith('Bearer ')) {
      return value.substring(7).trim();
    }
    return value.trim();
  }

  function handleTokenCandidate(rawToken, meta) {
    const token = sanitizeBearer(rawToken);
    if (isTokenLike(token)) {
      postToken(token, meta);
    }
  }

  function readAuthHeader(headers) {
    if (!headers) {
      return null;
    }

    if (typeof headers.get === 'function') {
      return headers.get('Authorization') || headers.get('authorization') || null;
    }

    if (Array.isArray(headers)) {
      const entry = headers.find(
        ([name]) => name && typeof name === 'string' && name.toLowerCase() === 'authorization'
      );
      return entry ? entry[1] : null;
    }

    if (typeof headers === 'object') {
      return headers.Authorization || headers.authorization || null;
    }

    return null;
  }

  function isWarehouseUrl(url) {
    if (typeof url !== 'string' || url.length === 0) {
      return false;
    }
    return WAREHOUSE_PATTERNS.some((pattern) => pattern.test(url));
  }

  function shouldInspectUrl(url) {
    return isWarehouseUrl(url) || isTokenEndpoint(url);
  }

  function isTokenEndpoint(url) {
    if (typeof url !== 'string') {
      return false;
    }
    // Sadece stockid.getirapi.com domain'indeki token endpoint'lerini yakala
    if (!url.includes('stockid.getirapi.com')) {
      return false;
    }
    // Token endpoint pattern'lerini kontrol et
    const matchesPattern = TOKEN_ENDPOINT_PATTERNS.some(pattern => pattern.test(url));
    const hasTokenPath = url.includes('/protocol/openid-connect/token');
    const result = matchesPattern || hasTokenPath;
    
    if (result) {
      console.log(`${LOG_PREFIX} ✅ isTokenEndpoint TRUE: ${url}, matchesPattern: ${matchesPattern}, hasTokenPath: ${hasTokenPath}`);
    }
    
    return result;
  }

  // Fetch hook - EN ERKEN KURULMALI
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    console.log(`${LOG_PREFIX} 🔧 Fetch hook kuruluyor...`);
    window.fetch = function patchedFetch(input, init) {
      const args = Array.from(arguments);
      const requestUrl = typeof input === 'string' ? input : input && input.url ? input.url : '';
      
      // TÜM fetch isteklerini logla (debug için)
      if (requestUrl && requestUrl.includes('stockid.getirapi.com')) {
        console.log(`${LOG_PREFIX} 🔍 stockid.getirapi.com fetch isteği: ${requestUrl}`);
      }
      
      // Token endpoint kontrolü - request URL'den kontrol et
      if (isTokenEndpoint(requestUrl)) {
        console.log(`${LOG_PREFIX} 🔄🔄🔄 TOKEN ENDPOINT FETCH REQUEST YAKALANDI! URL: ${requestUrl}`);
      }
      
      const options = init || args[1] || {};
      const shouldInspectRequest = shouldInspectUrl(requestUrl);

      if (shouldInspectRequest) {
        const requestAuth = readAuthHeader(options.headers);
        if (requestAuth) {
          handleTokenCandidate(requestAuth, { origin: 'fetch-request', url: requestUrl });
        }
      }

      return originalFetch.apply(this, args).then((response) => {
        try {
          const responseUrl = response.url || requestUrl;
          
          // Token endpoint kontrolü - request URL'den de kontrol et
          const isTokenEndpointRequest = isTokenEndpoint(requestUrl) || isTokenEndpoint(responseUrl);
          
          if (isTokenEndpointRequest) {
            console.log(
              `${LOG_PREFIX} 🔄🔄🔄 TOKEN ENDPOINT FETCH YAKALANDI! Request: ${requestUrl}, Response: ${responseUrl}`
            );
          }
          
          const shouldInspectResponse = shouldInspectUrl(responseUrl);

          // Token endpoint kontrolü - shouldInspectResponse'dan bağımsız yap
          if (isTokenEndpointRequest) {
              console.log(
                `${LOG_PREFIX} ✅ Token endpoint fetch yanıtı yakalandı: ${responseUrl}, content-type=${
                  response.headers ? response.headers.get('Content-Type') : 'unknown'
                }, status=${response.status}`
              );
              response
                .clone()
                .text()
                .then((bodyText) => {
                  console.log(`${LOG_PREFIX} 📦 Token endpoint response body uzunluğu: ${bodyText ? bodyText.length : 0}`);
                  if (!bodyText) {
                    console.warn(`${LOG_PREFIX} ⚠️ Token endpoint boş gövde döndürdü: ${responseUrl}`);
                    return;
                  }
                  console.log(`${LOG_PREFIX} 📦 Token endpoint response body (ilk 200 karakter): ${bodyText.substring(0, 200)}`);
                  
                  try {
                    const data = JSON.parse(bodyText);
                    console.log(`${LOG_PREFIX} ✅ JSON parse başarılı, keys: ${Object.keys(data).join(', ')}`);
                    if (data && isTokenLike(data.access_token)) {
                      console.log(`${LOG_PREFIX} ✅ Access token bulundu (JSON)`);
                      postToken(data.access_token, { origin: 'fetch-body', url: responseUrl });
                    }
                    if (data && data.refresh_token && isTokenLike(data.refresh_token)) {
                      console.log(`${LOG_PREFIX} ✅✅✅ JSON parse ile refresh token bulundu (fetch), uzunluk: ${data.refresh_token.length}`);
                      postRefreshToken(data.refresh_token, { origin: 'fetch-body', url: responseUrl });
                    } else {
                      console.warn(`${LOG_PREFIX} ⚠️ JSON'da refresh_token yok veya geçersiz: ${data.refresh_token ? 'var ama geçersiz' : 'yok'}`);
                    }
                    return;
                  } catch (error) {
                    // JSON parse edilemezse regex'e düş
                    console.warn(`${LOG_PREFIX} ⚠️ Token endpoint JSON parse edilemedi, regex'e düşülüyor`, error);
                  }
                  const accessMatch = bodyText.match(/"access_token"\s*:\s*"([^"]+)"/);
                  if (accessMatch && isTokenLike(accessMatch[1])) {
                    console.log(`${LOG_PREFIX} ✅ Access token bulundu (regex)`);
                    postToken(accessMatch[1], { origin: 'fetch-body-regex', url: responseUrl });
                  }
                  const refreshMatch = bodyText.match(/"refresh_token"\s*:\s*"([^"]+)"/);
                  if (refreshMatch && isTokenLike(refreshMatch[1])) {
                    console.log(`${LOG_PREFIX} ✅✅✅ Regex ile refresh token bulundu (fetch), uzunluk: ${refreshMatch[1].length}`);
                    postRefreshToken(refreshMatch[1], { origin: 'fetch-body-regex', url: responseUrl });
                  } else {
                    console.warn(`${LOG_PREFIX} ⚠️ Regex ile refresh token bulunamadı`);
                  }
                })
                .catch((err) => {
                  console.warn(`${LOG_PREFIX} ❌ Fetch response body okunamadı`, err);
                });
          }

          if (shouldInspectResponse) {
            const authHeader = response.headers ? response.headers.get('Authorization') : null;
            if (authHeader) {
              handleTokenCandidate(authHeader, { origin: 'fetch-response', url: responseUrl });
            }
          }
        } catch (error) {
          console.warn(`${LOG_PREFIX} Fetch response işlenemedi`, error);
        }

        return response;
      });
    };
  }

  // XMLHttpRequest hook
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const originalSend = XMLHttpRequest.prototype.send;

  console.log(`${LOG_PREFIX} 🔧 XMLHttpRequest hook kuruluyor...`);

  XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
    this.__getir_url = url;
    this.__should_intercept_getir = shouldInspectUrl(url);
    
    // TÜM XHR isteklerini logla (debug için)
    if (url && url.includes('stockid.getirapi.com')) {
      console.log(`${LOG_PREFIX} 🔍 stockid.getirapi.com XHR isteği: ${method} ${url}`);
    }
    
    // Token endpoint kontrolü
    if (isTokenEndpoint(url)) {
      console.log(`${LOG_PREFIX} 🔄🔄🔄 TOKEN ENDPOINT XHR REQUEST YAKALANDI! ${method} ${url}`);
    }
    
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(header, value) {
    if (this.__should_intercept_getir && header && header.toLowerCase() === 'authorization') {
      handleTokenCandidate(value, { origin: 'xhr-request', url: this.__getir_url });
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function patchedSend() {
    this.addEventListener('load', () => {
      try {
        if (this.__should_intercept_getir && isWarehouseUrl(this.__getir_url || '')) {
          // Sadece gerçekten aynı origin isteklerinde Authorization header'ını okumaya çalış
          // Cross-origin isteklerde "Refused to get unsafe header" hatası alınır
          // Bu hataları önlemek için sadece aynı origin kontrolü yapıyoruz
          const url = this.__getir_url || '';
          try {
            const urlObj = new URL(url, window.location.href);
            const isSameOrigin = urlObj.origin === window.location.origin;
            
            // Sadece aynı origin isteklerinde getResponseHeader çağrısı yap
            // Cross-origin isteklerde "Refused to get unsafe header" hatası alınır
            if (isSameOrigin && this.getResponseHeader) {
              try {
                const authHeader = this.getResponseHeader('Authorization');
                if (authHeader) {
                  handleTokenCandidate(authHeader, { origin: 'xhr-response', url: url });
                }
              } catch (headerError) {
                // CORS hatası normal, tamamen sessizce yakala (hata mesajı gösterme)
                // "Refused to get unsafe header" hatası cross-origin isteklerde normal
              }
            }
          } catch (urlError) {
            // URL parse hatası, sessizce yakala
          }
        }
      } catch (error) {
        // Genel hataları da sessizce yakala
      }

      try {
        const url = this.__getir_url || '';
        if (isTokenEndpoint(url)) {
          console.log(`${LOG_PREFIX} 🔄🔄🔄 TOKEN ENDPOINT XHR RESPONSE YAKALANDI! URL: ${url}, status: ${this.status}, responseText uzunluğu: ${this.responseText ? this.responseText.length : 0}`);
        }
        
        if (this.__should_intercept_getir && isTokenEndpoint(url) && typeof this.responseText === 'string') {
          console.log(`${LOG_PREFIX} ✅ Token endpoint XHR yanıtı yakalandı: ${url}`);
          const text = this.responseText;
          console.log(`${LOG_PREFIX} 📦 Token endpoint XHR response body (ilk 200 karakter): ${text.substring(0, 200)}`);
          
          // JSON parse dene
          try {
            const data = JSON.parse(text);
            console.log(`${LOG_PREFIX} ✅ JSON parse başarılı (XHR), keys: ${Object.keys(data).join(', ')}`);
            if (data && data.access_token && isTokenLike(data.access_token)) {
              console.log(`${LOG_PREFIX} ✅ Access token bulundu (XHR JSON)`);
              postToken(data.access_token, { origin: 'xhr-body', url: url });
            }
            if (data && data.refresh_token && isTokenLike(data.refresh_token)) {
              console.log(`${LOG_PREFIX} ✅✅✅ JSON parse ile refresh token bulundu (XHR), uzunluk: ${data.refresh_token.length}`);
              postRefreshToken(data.refresh_token, { origin: 'xhr-body', url: url });
            } else {
              console.warn(`${LOG_PREFIX} ⚠️ JSON'da refresh_token yok veya geçersiz: ${data.refresh_token ? 'var ama geçersiz' : 'yok'}`);
            }
          } catch (jsonError) {
            console.warn(`${LOG_PREFIX} ⚠️ XHR JSON parse edilemedi, regex'e düşülüyor`, jsonError);
          }
          
          // Access token yakala (regex fallback)
          const accessTokenMatch = text.match(/"access_token"\s*:\s*"([^"]+)"/);
          if (accessTokenMatch && isTokenLike(accessTokenMatch[1])) {
            console.log(`${LOG_PREFIX} ✅ Access token bulundu (XHR regex)`);
            postToken(accessTokenMatch[1], { origin: 'xhr-body-regex', url: url });
          }
          
          // Refresh token yakala (regex fallback)
          const refreshTokenMatch = text.match(/"refresh_token"\s*:\s*"([^"]+)"/);
          if (refreshTokenMatch && isTokenLike(refreshTokenMatch[1])) {
            console.log(`${LOG_PREFIX} ✅✅✅ Regex ile refresh token bulundu (XHR), uzunluk: ${refreshTokenMatch[1].length}`);
            postRefreshToken(refreshTokenMatch[1], { origin: 'xhr-body-regex', url: url });
          } else {
            console.warn(`${LOG_PREFIX} ⚠️ Regex ile refresh token bulunamadı (XHR)`);
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} XHR response body işlenemedi`, error);
      }
    });

    return originalSend.apply(this, arguments);
  };

  announceReady();
  console.log(`${LOG_PREFIX} Main world token interceptor aktif`);
})();

