(function () {
  const FLAG_KEY = '__GETIR_STOCK_FRANCHISE_INJECTED__';
  const EVENT_SOURCE = 'getir-stock-bot';
  const TOKEN_EVENT = 'GETIR_FRANCHISE_ACCESS_TOKEN';
  const REFRESH_TOKEN_EVENT = 'GETIR_FRANCHISE_REFRESH_TOKEN';
  const HANDSHAKE_EVENT = 'GETIR_FRANCHISE_INJECTED_READY';
  const LOG_PREFIX = '🤖';
  const MIN_TOKEN_LENGTH = 150; // Franchise token'ları genellikle 200-300 karakter arası
  const FRANCHISE_PATTERNS = [
    /https:\/\/(?:[^/]+\.)?franchise\.getir\.com/i,
    /https:\/\/franchise-api-gateway\.getirapi\.com/i,
    /https:\/\/stockid\.getirapi\.com/i
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
      console.error(`${LOG_PREFIX} Franchise message gönderilemedi`, error);
    }
  }

  function announceReady() {
    sendMessage({ type: HANDSHAKE_EVENT });
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

  function postAccessToken(token, meta) {
    if (!isTokenLike(token)) {
      return;
    }
    console.log(
      `${LOG_PREFIX} Franchise token yakalandı (kaynak: ${meta?.origin || 'bilinmiyor'}) uzunluk: ${token.length}`
    );
    sendMessage({
      type: TOKEN_EVENT,
      token,
      meta
    });
  }

  function postRefreshToken(refreshToken, meta) {
    if (!isTokenLike(refreshToken)) {
      return;
    }
    console.log(
      `${LOG_PREFIX} Franchise refresh token yakalandı (kaynak: ${meta?.origin || 'bilinmiyor'}) uzunluk: ${refreshToken.length}`
    );
    sendMessage({
      type: REFRESH_TOKEN_EVENT,
      refreshToken,
      meta
    });
  }

  function isFranchiseUrl(url) {
    if (typeof url !== 'string' || url.length === 0) {
      return false;
    }
    return FRANCHISE_PATTERNS.some((pattern) => pattern.test(url));
  }

  function isTokenEndpoint(url) {
    if (typeof url !== 'string') {
      return false;
    }
    return url.includes('/protocol/openid-connect/token') || url.includes('/access-token');
  }

  function shouldInspectUrl(url) {
    return isFranchiseUrl(url) || isTokenEndpoint(url);
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

  function scanStorageForTokens(storage, storageName) {
    if (!storage) {
      return;
    }
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) {
          continue;
        }
        const value = storage.getItem(key);
        if (!isTokenLike(value)) {
          continue;
        }
        const lowerKey = key.toLowerCase();
        const meta = { origin: `${storageName}:${key}` };
        
        // Key'e göre access/refresh token ayırımı yap
        // "refresh" içeren key'ler -> refresh token
        // "access" içeren key'ler -> access token
        // Sadece "token" içeren key'ler -> access token (varsayılan)
        if (lowerKey.includes('refresh')) {
          console.log(`${LOG_PREFIX} ${storageName}'dan refresh token bulundu (key: ${key}), uzunluk: ${value.length}`);
          postRefreshToken(value, meta);
        } else if (lowerKey.includes('access') || lowerKey.includes('token')) {
          console.log(`${LOG_PREFIX} ${storageName}'dan access token bulundu (key: ${key}), uzunluk: ${value.length}`);
          postAccessToken(value, meta);
        }
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} ${storageName} token taraması yapılamadı`, error);
    }
  }

  function patchStorage(storage, storageName) {
    if (!storage) {
      return;
    }
    try {
      const originalSetItem = storage.setItem;
      storage.setItem = function patchedSetItem(key, value) {
        originalSetItem.apply(this, arguments);
        if (typeof value === 'string' && isTokenLike(value)) {
          const lowerKey = (key || '').toLowerCase();
          const meta = { origin: `${storageName}-set:${key}` };
          
          // Key'e göre access/refresh token ayırımı yap
          if (lowerKey.includes('refresh')) {
            console.log(`${LOG_PREFIX} ${storageName}'a refresh token kaydedildi (key: ${key}), uzunluk: ${value.length}`);
            postRefreshToken(value, meta);
          } else if (lowerKey.includes('access') || lowerKey.includes('token')) {
            console.log(`${LOG_PREFIX} ${storageName}'a access token kaydedildi (key: ${key}), uzunluk: ${value.length}`);
            postAccessToken(value, meta);
          }
        }
      };
    } catch (error) {
      console.warn(`${LOG_PREFIX} ${storageName} patch edilemedi`, error);
    }
  }

  function handleResponseBody(response, url, origin) {
    if (!response || typeof response.clone !== 'function') {
      return;
    }
    response
      .clone()
      .text()
      .then((text) => {
        if (!text) {
          return;
        }

        try {
          const json = JSON.parse(text);
          
          // Franchise API /auth/token/refresh endpoint'i accessToken ve refreshToken döndürüyor (camelCase)
          if (json && json.accessToken && isTokenLike(json.accessToken)) {
            console.log(`${LOG_PREFIX} ✅ Franchise /auth/token/refresh'den accessToken yakalandı (uzunluk: ${json.accessToken.length})`);
            postAccessToken(json.accessToken, { origin, url });
          }
          if (json && json.refreshToken && isTokenLike(json.refreshToken)) {
            console.log(`${LOG_PREFIX} ✅✅✅ Franchise /auth/token/refresh'den refreshToken yakalandı (uzunluk: ${json.refreshToken.length})`);
            postRefreshToken(json.refreshToken, { origin, url });
          }
          
          // Standart Keycloak formatı (snake_case)
          if (json && isTokenLike(json.access_token)) {
            postAccessToken(json.access_token, { origin, url });
          }
          if (json && isTokenLike(json.refresh_token)) {
            postRefreshToken(json.refresh_token, { origin, url });
          }
          return;
        } catch (error) {
          // JSON parse edilemezse regex ile ara
        }

        // Regex fallback - hem camelCase hem snake_case
        const accessTokenMatch = text.match(/"accessToken"\s*:\s*"([^"]+)"/) || text.match(/"access_token"\s*:\s*"([^"]+)"/);
        if (accessTokenMatch && isTokenLike(accessTokenMatch[1])) {
          postAccessToken(accessTokenMatch[1], { origin, url });
        }
        const refreshTokenMatch = text.match(/"refreshToken"\s*:\s*"([^"]+)"/) || text.match(/"refresh_token"\s*:\s*"([^"]+)"/);
        if (refreshTokenMatch && isTokenLike(refreshTokenMatch[1])) {
          postRefreshToken(refreshTokenMatch[1], { origin, url });
        }
      })
      .catch((error) => {
        console.warn(`${LOG_PREFIX} Franchise response okunamadı (${url})`, error);
      });
  }

  // Fetch hook
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function patchedFetch(input, init) {
      const args = Array.from(arguments);
      const requestUrl = typeof input === 'string' ? input : input && input.url ? input.url : '';
      const options = init || args[1] || {};
      const shouldInspectRequest = shouldInspectUrl(requestUrl);

      if (shouldInspectRequest) {
        const authHeader = readAuthHeader(options.headers);
        if (authHeader) {
          const token = sanitizeBearer(authHeader);
          postAccessToken(token, { origin: 'fetch-request', url: requestUrl });
        }
      }

      return originalFetch.apply(this, args).then((response) => {
        try {
          const responseUrl = response.url || requestUrl;
          const shouldInspectResponse = shouldInspectUrl(responseUrl);

          if (shouldInspectResponse) {
            const authHeader = response.headers ? response.headers.get('Authorization') : null;
            if (authHeader) {
              const token = sanitizeBearer(authHeader);
              postAccessToken(token, { origin: 'fetch-response', url: responseUrl });
            }
          }

          // Franchise API /auth/token/refresh endpoint'ini de yakala
          if (isTokenEndpoint(responseUrl) || responseUrl.includes('/auth/token/refresh')) {
            handleResponseBody(response, responseUrl, 'fetch-body');
          }
        } catch (error) {
          console.warn(`${LOG_PREFIX} Franchise fetch response işlenemedi`, error);
        }

        return response;
      });
    };
  }

  // XMLHttpRequest hook
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
    this.__franchise_url = url;
    this.__should_intercept_franchise = shouldInspectUrl(url);
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(header, value) {
    if (this.__should_intercept_franchise && header && header.toLowerCase() === 'authorization') {
      const token = sanitizeBearer(value);
      postAccessToken(token, { origin: 'xhr-request', url: this.__franchise_url });
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function patchedSend() {
    this.addEventListener('load', () => {
      try {
        if (this.__should_intercept_franchise) {
          const authHeader = this.getResponseHeader && this.getResponseHeader('Authorization');
          if (authHeader) {
            const token = sanitizeBearer(authHeader);
            postAccessToken(token, { origin: 'xhr-response', url: this.__franchise_url });
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} Franchise XHR header okunamadı`, error);
      }

      try {
        const url = this.__franchise_url || '';
        if ((isTokenEndpoint(url) || url.includes('/auth/token/refresh')) && typeof this.responseText === 'string') {
          const text = this.responseText;
          
          // JSON parse dene
          try {
            const json = JSON.parse(text);
            // Franchise API /auth/token/refresh endpoint'i accessToken ve refreshToken döndürüyor (camelCase)
            if (json && json.accessToken && isTokenLike(json.accessToken)) {
              console.log(`${LOG_PREFIX} ✅ Franchise /auth/token/refresh'den accessToken yakalandı (XHR, uzunluk: ${json.accessToken.length})`);
              postAccessToken(json.accessToken, { origin: 'xhr-body', url: url });
            }
            if (json && json.refreshToken && isTokenLike(json.refreshToken)) {
              console.log(`${LOG_PREFIX} ✅✅✅ Franchise /auth/token/refresh'den refreshToken yakalandı (XHR, uzunluk: ${json.refreshToken.length})`);
              postRefreshToken(json.refreshToken, { origin: 'xhr-body', url: url });
            }
            // Standart Keycloak formatı (snake_case)
            if (json && json.access_token && isTokenLike(json.access_token)) {
              postAccessToken(json.access_token, { origin: 'xhr-body', url: url });
            }
            if (json && json.refresh_token && isTokenLike(json.refresh_token)) {
              postRefreshToken(json.refresh_token, { origin: 'xhr-body', url: url });
            }
          } catch (jsonError) {
            // JSON parse edilemezse regex ile ara
          }
          
          // Regex fallback - hem camelCase hem snake_case
          const accessTokenMatch = text.match(/"accessToken"\s*:\s*"([^"]+)"/) || text.match(/"access_token"\s*:\s*"([^"]+)"/);
          if (accessTokenMatch && isTokenLike(accessTokenMatch[1])) {
            postAccessToken(accessTokenMatch[1], { origin: 'xhr-body', url: url });
          }
          const refreshTokenMatch = text.match(/"refreshToken"\s*:\s*"([^"]+)"/) || text.match(/"refresh_token"\s*:\s*"([^"]+)"/);
          if (refreshTokenMatch && isTokenLike(refreshTokenMatch[1])) {
            postRefreshToken(refreshTokenMatch[1], { origin: 'xhr-body', url: url });
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} Franchise XHR body işlenemedi`, error);
      }
    });

    return originalSend.apply(this, arguments);
  };

  // İlk yüklemede localStorage ve sessionStorage tara
  scanStorageForTokens(localStorage, 'localStorage');
  scanStorageForTokens(sessionStorage, 'sessionStorage');

  patchStorage(localStorage, 'localStorage');
  patchStorage(sessionStorage, 'sessionStorage');

  // Periyodik tekrar
  setInterval(() => {
    scanStorageForTokens(localStorage, 'localStorage');
    scanStorageForTokens(sessionStorage, 'sessionStorage');
  }, 15000);

  announceReady();
  console.log(`${LOG_PREFIX} Franchise main world token interceptor aktif`);
})();


