// Background service worker
// Token'ı yönetir ve Python bot'a gönderir

console.log('🤖 🚀 Background service worker başlatıldı!');

const BOT_SERVER_URL = 'http://localhost:8765';
let currentToken = null;
let lastTokenUpdate = 0;
let currentKeycloakToken = null;
let lastKeycloakTokenUpdate = 0;
let currentRefreshToken = null;
let lastRefreshTokenUpdate = 0;
let currentFranchiseRefreshToken = null;
let lastFranchiseRefreshTokenUpdate = 0;

// Service worker'ı aktif tutmak için periyodik ping
// Manifest v3'te service worker'lar uzun süre kullanılmadığında uykuya dalıyor
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') {
    console.log('🤖 💓 Service worker keep-alive ping');
    // Service worker'ı aktif tutmak için basit bir işlem yap
    chrome.storage.local.get(['keepAlive'], () => {
      // Storage işlemi service worker'ı aktif tutar
    });
  }
});

// Keep-alive alarm'ını kur (her 20 saniyede bir)
chrome.alarms.create('keep-alive', { periodInMinutes: 0.33 }); // 20 saniye

// Extension yüklendiğinde alarm'ı başlat
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('keep-alive', { periodInMinutes: 0.33 });
  console.log('🤖 ✅ Keep-alive alarm kuruldu');
});

// Extension başlatıldığında alarm'ı başlat
chrome.alarms.create('keep-alive', { periodInMinutes: 0.33 });

// Content script'ten gelen mesajları dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🤖 📥 Background script\'e mesaj alındı:', message.type);
  console.log('🤖 📋 Sender:', sender.tab ? `Tab ${sender.tab.id}` : 'Unknown');
  
  if (message.type === 'TOKEN_UPDATE') {
    console.log('🤖 🔄 TOKEN_UPDATE mesajı işleniyor...');
    handleTokenUpdate(message.token, message.timestamp);
    sendResponse({ success: true });
  } else if (message.type === 'KEYCLOAK_TOKEN_UPDATE') {
    console.log('🤖 🔄 KEYCLOAK_TOKEN_UPDATE mesajı işleniyor...');
    console.log('🤖 📋 Token uzunluğu:', message.token ? message.token.length : 'null');
    handleKeycloakTokenUpdate(message.token, message.timestamp);
    sendResponse({ success: true });
  } else if (message.type === 'KEYCLOAK_REFRESH_TOKEN_UPDATE') {
    console.log('🤖 🔄 KEYCLOAK_REFRESH_TOKEN_UPDATE mesajı işleniyor...');
    console.log('🤖 📋 Refresh token uzunluğu:', message.refreshToken ? message.refreshToken.length : 'null');
    handleKeycloakRefreshTokenUpdate(message.refreshToken, message.timestamp);
    sendResponse({ success: true });
  } else if (message.type === 'FRANCHISE_REFRESH_TOKEN_UPDATE') {
    console.log('🤖 🔄 FRANCHISE_REFRESH_TOKEN_UPDATE mesajı işleniyor...');
    console.log('🤖 📋 Franchise refresh token uzunluğu:', message.refreshToken ? message.refreshToken.length : 'null');
    handleFranchiseRefreshTokenUpdate(message.refreshToken, message.timestamp);
    sendResponse({ success: true });
  } else if (message.type === 'INJECT_MAIN_WORLD') {
    if (sender.tab && sender.tab.id !== undefined) {
      console.log('🤖 📤 Main world script enjeksiyon isteği alındı, tab:', sender.tab.id);
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: ['warehouse_injected.js'],
        world: 'MAIN'
      }).then(() => {
        console.log('🤖 ✅ Main world script başarıyla enjekte edildi');
        sendResponse({ success: true });
      }).catch((error) => {
        console.error('🤖 ❌ Main world script enjekte edilemedi:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    } else {
      console.error('🤖 ❌ Main world enjeksiyonu için geçerli tab bulunamadı');
      sendResponse({ success: false, error: 'Tab bilgisi yok' });
    }
  } else if (message.type === 'EXPORT_ALL_PRODUCTS') {
    // Admin panelden gelen ürün çekme isteği
    console.log('🤖 📦 Tüm ürünleri çekme isteği alındı');
    handleExportAllProducts(sendResponse);
    return true; // Async response için
  } else if (message.type === 'GET_EXTENSION_ID') {
    // Admin panelden gelen extension ID isteği
    console.log('🤖 🔍 Extension ID isteği alındı');
    sendResponse({ 
      success: true, 
      extensionId: chrome.runtime.id,
      extensionName: 'Getir Stock Bot Token Provider'
    });
    return true;
  } else if (message.type === 'FORWARD_PROGRESS') {
    // Getir sitesinden gelen ilerleme mesajını admin panele ilet
    console.log('🤖 📊 İlerleme mesajı iletiliyor:', message.message);
    
    // Tüm admin panel tab'larına gönder
    chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*', 'https://*/*'] }).then(tabs => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'GETIR_PROGRESS',
          step: message.step,
          message: message.message
        }).catch(() => {});
      }
    }).catch(() => {});
    
    sendResponse({ success: true });
    return true;
  } else {
    console.log('🤖 ⚠️ Bilinmeyen mesaj tipi:', message.type);
  }
  return true;
});

// FRANCHISE token güncellemesini işle (franchise.getir.com için)
async function handleTokenUpdate(token, timestamp) {
  console.log('🤖 📥 🏪 FRANCHISE token güncelleme işlemi başlatıldı');
  console.log('🤖 📋 FRANCHISE token uzunluğu:', token.length);
  console.log('🤖 📋 FRANCHISE token başlangıcı:', token.substring(0, 50));
  
  // Token uzunluk kontrolü - Franchise API 176 karakterlik token kullanıyor (normal)
  // Browser Network sekmesinde görüldü: 176 karakterlik token API'ye gönderiliyor ve 200 OK dönüyor
  if (token.length < 100) {
    console.warn('🤖 ⚠️ FRANCHISE token çok kısa, gönderilmiyor:', token.length, 'karakter (beklenen: 100+)');
    console.warn('🤖 ⚠️ Token başlangıcı:', token.substring(0, 50));
    return;
  }
  
  // Token format kontrolü
  if (!token.startsWith('eyJ')) {
    console.warn('🤖 ⚠️ FRANCHISE token geçersiz format, gönderilmiyor:', token.substring(0, 50));
    return;
  }
  
  if (token === currentToken && Date.now() - lastTokenUpdate < 5000) {
    // Aynı token ve çok yakın zamanda güncellendi, gönderme
    console.log('🤖 ⏭️ FRANCHISE token aynı ve çok yakın zamanda güncellendi, gönderme atlanıyor');
    return;
  }
  
  currentToken = token;
  lastTokenUpdate = timestamp || Date.now();
  
  console.log('🤖 ✅ ✅ ✅ FRANCHISE token güncellendi:', token.substring(0, 50) + '...');
  console.log('🤖 📤 FRANCHISE token bot\'a gönderiliyor:', BOT_SERVER_URL);
  
  // Python bot'a FRANCHISE token gönder (franchise API için)
  try {
    const response = await fetch(`${BOT_SERVER_URL}/update-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: token,
        timestamp: lastTokenUpdate
      })
    });
    
    console.log('🤖 📥 🏪 FRANCHISE token response alındı:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('🤖 ✅ ✅ ✅ ✅ ✅ FRANCHISE token bot\'a başarıyla gönderildi:', data);
    } else {
      const errorText = await response.text();
      console.error('🤖 ❌ FRANCHISE token gönderme hatası:', response.status, response.statusText);
      console.error('🤖 ❌ Error response:', errorText);
    }
  } catch (error) {
    console.error('🤖 ❌ FRANCHISE token gönderme hatası:', error);
    // Bot çalışmıyor olabilir, hata mesajı gösterme (normal)
  }
}

// FRANCHISE refresh token güncellemesini işle
async function handleFranchiseRefreshTokenUpdate(refreshToken, timestamp) {
  console.log('🤖 📥 🔄 🏪 FRANCHISE refresh token güncelleme işlemi başlatıldı');
  console.log('🤖 📋 FRANCHISE refresh token uzunluğu:', refreshToken.length);
  console.log('🤖 📋 Mevcut FRANCHISE refresh token:', currentFranchiseRefreshToken ? currentFranchiseRefreshToken.substring(0, 50) + '...' : 'null');
  console.log('🤖 📋 Yeni FRANCHISE refresh token:', refreshToken.substring(0, 50) + '...');
  
  if (refreshToken === currentFranchiseRefreshToken && Date.now() - lastFranchiseRefreshTokenUpdate < 5000) {
    // Aynı refresh token ve çok yakın zamanda güncellendi, gönderme
    console.log('🤖 ⏭️ FRANCHISE refresh token aynı ve çok yakın zamanda güncellendi, gönderme atlanıyor');
    return;
  }
  
  currentFranchiseRefreshToken = refreshToken;
  lastFranchiseRefreshTokenUpdate = timestamp || Date.now();
  
  console.log('🤖 ✅ ✅ ✅ FRANCHISE refresh token güncellendi:', refreshToken.substring(0, 50) + '...');
  console.log('🤖 📤 FRANCHISE refresh token bot\'a gönderiliyor:', BOT_SERVER_URL);
  
  // Python bot'a FRANCHISE refresh token gönder
  try {
    const requestBody = {
      refreshToken: refreshToken,
      timestamp: lastFranchiseRefreshTokenUpdate
    };
    
    console.log('🤖 📤 🔄 🏪 FRANCHISE refresh token request body hazırlandı (token uzunluğu:', refreshToken.length, ')');
    
    const response = await fetch(`${BOT_SERVER_URL}/update-franchise-refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('🤖 📥 🔄 🏪 FRANCHISE refresh token response alındı:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('🤖 ✅ ✅ ✅ ✅ ✅ FRANCHISE refresh token bot\'a başarıyla gönderildi:', data);
    } else {
      const errorText = await response.text();
      console.error('🤖 ❌ FRANCHISE refresh token gönderme hatası:', response.status, response.statusText);
      console.error('🤖 ❌ Error response:', errorText);
    }
  } catch (error) {
    console.error('🤖 ❌ FRANCHISE refresh token gönderme hatası (catch):', error);
    console.error('🤖 ❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    // Bot çalışmıyor olabilir, hata mesajı gösterme (normal)
  }
}

// Extension açıldığında mevcut token'ı kontrol et
chrome.runtime.onInstalled.addListener(() => {
  console.log('🤖 ' + 'Getir Stock Bot Extension yüklendi');
});

// WebRequest API ile network request'lerini dinle
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      const url = details.url || '';
      const method = details.method || 'GET';
      const urlLower = url.toLowerCase();
      
      // Permission, filter, picker request'lerini özellikle vurgula (case-insensitive)
      const isPermissionRequest = urlLower.includes('/permission') || urlLower.includes('permission');
      const isFilterRequest = urlLower.includes('/filter') || urlLower.includes('filter');
      const isPickerRequest = urlLower.includes('/picker') || urlLower.includes('picker');
      
      if (isPermissionRequest || isFilterRequest || isPickerRequest) {
        console.log(`🤖 🎯🎯🎯 PERMISSION/FILTER/PICKER REQUEST YAKALANDI (onBeforeRequest): ${method} ${url}`);
        console.log('🤖 📋 Request ID:', details.requestId);
        console.log('🤖 📋 Tab ID:', details.tabId);
        console.log('🤖 📋 Type:', details.type);
      }
      
      // TÜM warehouse/getirapi request'lerini logla (debug için)
      if (urlLower.includes('warehouse') || urlLower.includes('getirapi.com') || urlLower.includes('stockid')) {
        console.log(`🤖 🌐 WebRequest yakalandı: ${method} ${url.substring(0, 150)}...`);
      }
      
      // WebSocket connection'larını yakala (URL'de token var)
      if (urlLower.includes('socket.io') && urlLower.includes('token=')) {
        console.log('🤖 🔌 WebSocket connection yakalandı!');
        const tokenMatch = url.match(/token=([^&]+)/i);
        if (tokenMatch && tokenMatch[1]) {
          const token = decodeURIComponent(tokenMatch[1]);
          if (token.startsWith('eyJ') && token.length > 100) {
            console.log(`🤖 ✅ ✅ ✅ WebRequest API ile WebSocket'ten Keycloak token bulundu: ${token.substring(0, 50)}...`);
            handleKeycloakTokenUpdate(token, Date.now());
          }
        }
      }
      
      // Keycloak token endpoint'ini yakala
      if (urlLower.includes('/protocol/openid-connect/token')) {
        console.log(`🤖 🎯 Keycloak token endpoint request yakalandı (webRequest API): ${url}`);
      }
    } catch (error) {
      console.error('🤖 ❌ onBeforeRequest hatası:', error);
    }
  },
  {
    urls: [
      'https://warehouse-panel-api-gateway.getirapi.com/*',
      'wss://warehouse-panel-api-gateway.getirapi.com/*',
      'https://stockid.getirapi.com/*',
      'https://warehouse.getir.com/*',
      'https://*.getirapi.com/*',
      'https://*.getir.com/*',
      'http://warehouse-panel-api-gateway.getirapi.com/*',
      'http://warehouse.getir.com/*',
      'http://*.getirapi.com/*',
      'http://*.getir.com/*'
    ]
  }
);

// Keycloak token endpoint response body yakala (warehouse refresh token için)
// Manifest V3'te filterResponseData sadece onHeadersReceived içinde çalışır
console.log('🤖 🧵 Token endpoint filter listener kaydediliyor (onHeadersReceived)...');
try {
  chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
      try {
        const url = details.url || '';
        console.log('🤖 🧵 onHeadersReceived çağrıldı:', url, 'method:', details.method, 'statusCode:', details.statusCode);
        
        if (details.method !== 'POST') {
          console.log('🤖 🧵 Method POST değil, atlanıyor');
          return {};
        }
        // Warehouse Keycloak token endpoint'ini ve Franchise /auth/token/refresh endpoint'ini dinle
        const isWarehouseTokenEndpoint = url.includes('stockid.getirapi.com') && url.includes('/protocol/openid-connect/token');
        const isFranchiseRefreshEndpoint = url.includes('franchise-api-gateway.getirapi.com') && url.includes('/auth/token/refresh');
        
        if (!isWarehouseTokenEndpoint && !isFranchiseRefreshEndpoint) {
          console.log('🤖 🧵 URL token endpoint değil, atlanıyor');
          return {};
        }
        if (details.statusCode !== 200) {
          console.log('🤖 🧵 Status code 200 değil, atlanıyor:', details.statusCode);
          return {};
        }
        
        console.log('🤖 🧵 ✅ Token endpoint response filter başlatıldı:', url);
        console.log('🤖 🧵 Request ID:', details.requestId);
        
        let filter;
        try {
          filter = chrome.webRequest.filterResponseData(details.requestId);
          console.log('🤖 🧵 ✅ filterResponseData başarıyla oluşturuldu');
        } catch (filterError) {
          console.error('🤖 ❌ filterResponseData oluşturulamadı:', filterError);
          return {};
        }
        
        const decoder = new TextDecoder('utf-8');
        let responseBody = '';

        filter.ondata = (event) => {
          try {
            responseBody += decoder.decode(event.data, { stream: true });
          } catch (error) {
            console.warn('🤖 ⚠️ Token endpoint response decode hata', error);
          }
          filter.write(event.data);
        };

        filter.onstop = () => {
          try {
            responseBody += decoder.decode();
          } catch (error) {
            console.warn('🤖 ⚠️ Token endpoint response final decode hata', error);
          }

          console.log('🤖 🧵 Filter onstop çağrıldı, response body uzunluğu:', responseBody.length);

          try {
            if (responseBody) {
              console.log('🤖 🧵 Response body (ilk 200 karakter):', responseBody.substring(0, 200));
              
              let parsed = null;
              try {
                parsed = JSON.parse(responseBody);
                console.log('🤖 🧵 JSON parse başarılı, parsed keys:', Object.keys(parsed));
              } catch (jsonError) {
                console.warn('🤖 ⚠️ Token endpoint JSON parse edilemedi, regex denenecek', jsonError);
              }

              let refreshToken = null;
              let accessToken = null;
              
              // Token'ın hangi API için olduğunu belirle (bir kez tanımla, her yerde kullan)
              const isFranchiseRefreshEndpoint = url.includes('franchise-api-gateway.getirapi.com') && url.includes('/auth/token/refresh');
              const isWarehouseTokenEndpoint = url.includes('stockid.getirapi.com') && url.includes('/protocol/openid-connect/token');

              if (parsed) {
                // Franchise /auth/token/refresh endpoint'i camelCase kullanıyor
                if (isFranchiseRefreshEndpoint) {
                  accessToken = parsed.accessToken;  // camelCase
                  refreshToken = parsed.refreshToken;  // camelCase
                  console.log('🤖 🧵 Parsed\'dan accessToken var mı (camelCase):', !!accessToken);
                  console.log('🤖 🧵 Parsed\'dan refreshToken var mı (camelCase):', !!refreshToken);
                } else {
                  // Warehouse Keycloak endpoint'i snake_case kullanıyor
                  accessToken = parsed.access_token;  // snake_case
                  refreshToken = parsed.refresh_token;  // snake_case
                  console.log('🤖 🧵 Parsed\'dan access_token var mı (snake_case):', !!accessToken);
                  console.log('🤖 🧵 Parsed\'dan refresh_token var mı (snake_case):', !!refreshToken);
                }
                
                if (refreshToken) {
                  console.log('🤖 🧵 Refresh token uzunluğu (parsed):', refreshToken.length);
                  console.log('🤖 🧵 Refresh token başlangıcı (parsed):', refreshToken.substring(0, 50));
                }
              } else {
                console.log('🤖 🧵 Regex ile token aranıyor...');
                // Hem camelCase hem snake_case için regex
                const accessTokenMatch = responseBody.match(/"accessToken"\s*:\s*"([^"]+)"/) || responseBody.match(/"access_token"\s*:\s*"([^"]+)"/);
                if (accessTokenMatch && accessTokenMatch[1]) {
                  accessToken = accessTokenMatch[1];
                  console.log('🤖 🧵 Regex ile access token bulundu');
                }
                const refreshTokenMatch = responseBody.match(/"refreshToken"\s*:\s*"([^"]+)"/) || responseBody.match(/"refresh_token"\s*:\s*"([^"]+)"/);
                if (refreshTokenMatch && refreshTokenMatch[1]) {
                  refreshToken = refreshTokenMatch[1];
                  console.log('🤖 🧵 Regex ile refresh token bulundu, uzunluk:', refreshToken.length);
                } else {
                  console.warn('🤖 ⚠️ Regex ile refresh token bulunamadı');
                }
              }
              
              if (accessToken && accessToken.startsWith('eyJ')) {
                console.log('🤖 🧵 ✅ Filter ile access token yakalandı (ilk 50):', accessToken.substring(0, 50));
                console.log('🤖 🧵 Access token uzunluğu:', accessToken.length);
                
                // Franchise /auth/token/refresh endpoint'inden geliyorsa franchise token olarak işle
                if (isFranchiseRefreshEndpoint) {
                  console.log('🤖 🏪 Franchise /auth/token/refresh\'den access token yakalandı!');
                  handleTokenUpdate(accessToken, Date.now()); // Franchise token handler
                } else if (isWarehouseTokenEndpoint) {
                  console.log('🤖 🏭 Warehouse Keycloak access token yakalandı!');
                  handleKeycloakTokenUpdate(accessToken, Date.now()); // Warehouse token handler
                }
              } else {
                console.warn('🤖 ⚠️ Access token bulunamadı veya geçersiz format');
              }

              if (refreshToken && refreshToken.startsWith('eyJ')) {
                console.log('🤖 🧵 ✅ ✅ ✅ Filter ile refresh token yakalandı (ilk 50):', refreshToken.substring(0, 50));
                console.log('🤖 🧵 Refresh token uzunluğu:', refreshToken.length);
                
                // Franchise /auth/token/refresh endpoint'inden geliyorsa franchise refresh token olarak işle
                if (isFranchiseRefreshEndpoint) {
                  console.log('🤖 🏪 Franchise /auth/token/refresh\'den refresh token yakalandı!');
                  handleFranchiseRefreshTokenUpdate(refreshToken, Date.now()); // Franchise refresh token handler
                } else if (isWarehouseTokenEndpoint) {
                  console.log('🤖 🏭 Warehouse Keycloak refresh token yakalandı!');
                  handleKeycloakRefreshTokenUpdate(refreshToken, Date.now()); // Warehouse refresh token handler
                }
              } else {
                console.warn('🤖 ⚠️ Filter refresh token bulamadı');
                console.warn('🤖 ⚠️ Refresh token değeri:', refreshToken ? refreshToken.substring(0, 50) : 'null');
                console.warn('🤖 ⚠️ Response body (ilk 1000 karakter):', responseBody.substring(0, 1000));
                if (parsed) {
                  console.warn('🤖 ⚠️ Parsed keys:', Object.keys(parsed));
                  console.warn('🤖 ⚠️ Parsed içeriği:', JSON.stringify(parsed).substring(0, 500));
                }
              }
            } else {
              console.warn('🤖 ⚠️ Token endpoint response body boş');
            }
          } catch (processingError) {
            console.error('🤖 ❌ Token endpoint response işlenemedi:', processingError);
            console.error('🤖 ❌ Error stack:', processingError.stack);
          }

          filter.close();
        };

        filter.onerror = (event) => {
          console.error('🤖 ❌ Token endpoint filter hatası:', event && event.error);
          filter.close();
        };
        
        return {};
      } catch (error) {
        console.error('🤖 ❌ Token endpoint filter kurulamadı:', error);
        console.error('🤖 ❌ Error stack:', error.stack);
        return {};
    }
  },
  {
    urls: [
        'https://stockid.getirapi.com/*',
        'https://franchise-api-gateway.getirapi.com/*'
    ]
    },
    ['responseHeaders', 'blocking']
);
  console.log('🤖 🧵 ✅ Token endpoint filter listener başarıyla kaydedildi (onHeadersReceived)');
} catch (registrationError) {
  console.error('🤖 ❌ Token endpoint filter listener kaydedilemedi:', registrationError);
  console.error('🤖 ❌ Error stack:', registrationError.stack);
}

// Request header'larını dinle (Authorization header'ı yakala)
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    try {
      const url = details.url || '';
      const headers = details.requestHeaders || [];
      const method = details.method || 'GET';
      
      // Permission, filter, picker request'lerini özellikle vurgula
      // URL'de bu kelimelerin geçip geçmediğini kontrol et (case-insensitive)
      const urlLower = url.toLowerCase();
      const isPermissionRequest = urlLower.includes('/permission') || urlLower.includes('permission');
      const isFilterRequest = urlLower.includes('/filter') || urlLower.includes('filter');
      const isPickerRequest = urlLower.includes('/picker') || urlLower.includes('picker');
      
      // Özel endpoint'leri de kontrol et
      const isSpecialRequest = isPermissionRequest || isFilterRequest || isPickerRequest;
      
      if (isSpecialRequest) {
        const logMessage = `🤖 🎯🎯🎯 PERMISSION/FILTER/PICKER REQUEST YAKALANDI: ${method} ${url}`;
        console.log(logMessage);
        console.log('🤖 📋 Request headers sayısı:', headers.length);
        console.log('🤖 📋 Request headers:', headers.map(h => h.name).join(', '));
        
        // Content script'e de gönder (sayfa console'unda görünsün)
        if (details.tabId && details.tabId > 0) {
          chrome.tabs.sendMessage(details.tabId, {
            type: 'LOG_TO_CONSOLE',
            message: logMessage
          }).catch(() => {
            // Content script yüklenmemiş olabilir, sorun değil
          });
        }
      }
      
      // TÜM Authorization header'larını logla (debug için)
      let foundAuthHeader = false;
      for (const header of headers) {
        const headerName = header.name || '';
        const headerValue = header.value || '';
        
        // Authorization header'ını kontrol et (case-insensitive)
        if (headerName.toLowerCase() === 'authorization') {
          foundAuthHeader = true;
          
          // Bearer token kontrolü
          if (headerValue && headerValue.startsWith('Bearer ')) {
            const token = headerValue.substring(7).trim();
            
            // Permission, filter, picker request'lerinden gelen token'ı özellikle vurgula
            let logMessage = '';
            if (isPermissionRequest) {
              logMessage = `🤖 🔑 Authorization header bulundu (PERMISSION): ${url.substring(0, 150)}... Token: ${token.substring(0, 30)}...`;
            } else if (isFilterRequest) {
              logMessage = `🤖 🔑 Authorization header bulundu (FILTER): ${url.substring(0, 150)}... Token: ${token.substring(0, 30)}...`;
            } else if (isPickerRequest) {
              logMessage = `🤖 🔑 Authorization header bulundu (PICKER): ${url.substring(0, 150)}... Token: ${token.substring(0, 30)}...`;
            } else {
              logMessage = `🤖 🔑 Authorization header bulundu: ${url.substring(0, 150)}... Token: ${token.substring(0, 30)}...`;
            }
            console.log(logMessage);
            console.log('🤖 📋 Token uzunluğu:', token.length);
            console.log('🤖 📋 Token başlangıcı:', token.substring(0, 50));
            
            // Content script'e de gönder
            if (details.tabId && details.tabId > 0) {
              chrome.tabs.sendMessage(details.tabId, {
                type: 'LOG_TO_CONSOLE',
                message: logMessage
              }).catch(() => {});
            }
            
            // Token formatını kontrol et (JWT token'lar eyJ ile başlar)
            const tokenFormatCheck = {
              startsWithEyJ: token.startsWith('eyJ'),
              length: token.length,
              firstChars: token.substring(0, 20)
            };
            console.log('🤖 🔍 Token format kontrolü:', tokenFormatCheck);
            
            // Content script'e de gönder
            if (details.tabId && details.tabId > 0) {
              chrome.tabs.sendMessage(details.tabId, {
                type: 'LOG_TO_CONSOLE',
                message: `🤖 🔍 Token format kontrolü: ${JSON.stringify(tokenFormatCheck)}`
              }).catch(() => {});
            }
            
            // Sadece warehouse API'den gelen token'ları kabul et
            // Franchise API token'larını filtrele
            const isWarehouseDomain = urlLower.includes('warehouse-panel-api-gateway.getirapi.com') || 
                                     urlLower.includes('warehouse.getir.com') ||
                                     urlLower.includes('stockid.getirapi.com');
            
            const isFranchiseDomain = urlLower.includes('franchise-api-gateway.getirapi.com') || 
                                     urlLower.includes('franchise.getir.com');
            
            // Warehouse token'ları genellikle 1000+ karakter uzunluğunda
            // Franchise token'ları genellikle 200 karakterden kısa
            const isWarehouseToken = token.length > 500; // Warehouse token'ları genellikle çok daha uzun
            
            // Franchise domain'inden gelen token'ları anında işle (franchise API için)
            // Browser Network sekmesinde görüldü: franchise-api-gateway 176 karakterlik token kullanıyor ve çalışıyor
            if (isFranchiseDomain && token.startsWith('eyJ') && token.length > 100) {
              console.log('🤖 🏪 Franchise API Gateway token yakalandı (uzunluk:', token.length, '), bot\'a gönderiliyor...');
              handleTokenUpdate(token, Date.now());
              return;
            }
            
            if (token.startsWith('eyJ') && token.length > 100 && (isWarehouseDomain || isWarehouseToken)) {
              let successMessage = '';
              if (isPermissionRequest) {
                successMessage = `🤖 ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ PERMISSION REQUEST'DEN Keycloak token bulundu: ${token.substring(0, 50)}...`;
              } else if (isFilterRequest) {
                successMessage = `🤖 ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ FILTER REQUEST'DEN Keycloak token bulundu: ${token.substring(0, 50)}...`;
              } else if (isPickerRequest) {
                successMessage = `🤖 ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ PICKER REQUEST'DEN Keycloak token bulundu: ${token.substring(0, 50)}...`;
              } else {
                successMessage = `🤖 ✅ ✅ ✅ WebRequest API ile Authorization header'dan Keycloak token bulundu: ${token.substring(0, 50)}...`;
              }
              console.log(successMessage);
              console.log('🤖 📤 handleKeycloakTokenUpdate çağrılıyor...');
              console.log('🤖 📋 Token uzunluğu:', token.length);
              
              // Content script'e de gönder
              if (details.tabId && details.tabId > 0) {
                chrome.tabs.sendMessage(details.tabId, {
                  type: 'LOG_TO_CONSOLE',
                  message: successMessage
                }).catch(() => {});
                chrome.tabs.sendMessage(details.tabId, {
                  type: 'LOG_TO_CONSOLE',
                  message: `🤖 📤 handleKeycloakTokenUpdate çağrılıyor... Token uzunluğu: ${token.length}`
                }).catch(() => {});
              }
              
              try {
                console.log('🤖 🔄 handleKeycloakTokenUpdate fonksiyonu çağrılıyor...');
                handleKeycloakTokenUpdate(token, Date.now());
                console.log('🤖 ✅ handleKeycloakTokenUpdate çağrıldı (başarılı)');
                
                // Content script'e de gönder
                if (details.tabId && details.tabId > 0) {
                  chrome.tabs.sendMessage(details.tabId, {
                    type: 'LOG_TO_CONSOLE',
                    message: '🤖 ✅ handleKeycloakTokenUpdate çağrıldı (başarılı)'
                  }).catch(() => {});
                }
              } catch (error) {
                console.error('🤖 ❌ handleKeycloakTokenUpdate hatası:', error);
                
                // Content script'e de gönder
                if (details.tabId && details.tabId > 0) {
                  chrome.tabs.sendMessage(details.tabId, {
                    type: 'LOG_TO_CONSOLE',
                    message: `🤖 ❌ handleKeycloakTokenUpdate hatası: ${error.message}`
                  }).catch(() => {});
                }
              }
            } else {
              console.log('🤖 ⚠️ Token formatı geçersiz veya çok kısa:', {
                startsWithEyJ: token.startsWith('eyJ'),
                length: token.length,
                firstChars: token.substring(0, 20)
              });
            }
          } else {
            console.log('🤖 ⚠️ Authorization header Bearer ile başlamıyor:', headerValue.substring(0, 50));
          }
        }
      }
      
      // Eğer özel request'te Authorization header yoksa uyar
      if (isSpecialRequest && !foundAuthHeader) {
        console.log('🤖 ⚠️ ⚠️ ⚠️ PERMISSION/FILTER/PICKER REQUEST\'TE AUTHORIZATION HEADER BULUNAMADI!');
        console.log('🤖 📋 Mevcut header\'lar:', headers.map(h => h.name).join(', '));
        
        // Content script'e de gönder
        if (details.tabId && details.tabId > 0) {
          chrome.tabs.sendMessage(details.tabId, {
            type: 'LOG_TO_CONSOLE',
            message: '🤖 ⚠️ ⚠️ ⚠️ PERMISSION/FILTER/PICKER REQUEST\'TE AUTHORIZATION HEADER BULUNAMADI!'
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('🤖 ❌ onBeforeSendHeaders hatası:', error);
    }
  },
  {
    urls: [
      'https://warehouse-panel-api-gateway.getirapi.com/*',
      'https://warehouse.getir.com/*',
      'https://stockid.getirapi.com/*',
      'https://*.getirapi.com/*',
      'https://*.getir.com/*',
      'http://warehouse-panel-api-gateway.getirapi.com/*',
      'http://warehouse.getir.com/*',
      'http://*.getirapi.com/*',
      'http://*.getir.com/*'
    ]
  },
  ['requestHeaders']
);

// WAREHOUSE Keycloak refresh token güncellemesini işle
async function handleKeycloakRefreshTokenUpdate(refreshToken, timestamp) {
  console.log('🤖 📥 🔄 WAREHOUSE Keycloak refresh token güncelleme işlemi başlatıldı');
  console.log('🤖 📋 WAREHOUSE refresh token uzunluğu:', refreshToken.length);
  console.log('🤖 📋 Mevcut WAREHOUSE refresh token:', currentRefreshToken ? currentRefreshToken.substring(0, 50) + '...' : 'null');
  console.log('🤖 📋 Yeni WAREHOUSE refresh token:', refreshToken.substring(0, 50) + '...');
  
  if (refreshToken === currentRefreshToken && Date.now() - lastRefreshTokenUpdate < 5000) {
    // Aynı refresh token ve çok yakın zamanda güncellendi, gönderme
    console.log('🤖 ⏭️ WAREHOUSE refresh token aynı ve çok yakın zamanda güncellendi, gönderme atlanıyor');
    return;
  }
  
  currentRefreshToken = refreshToken;
  lastRefreshTokenUpdate = timestamp || Date.now();
  
  console.log('🤖 ✅ ✅ ✅ WAREHOUSE Keycloak refresh token güncellendi:', refreshToken.substring(0, 50) + '...');
  console.log('🤖 📤 WAREHOUSE refresh token bot\'a gönderiliyor:', BOT_SERVER_URL);
  
  // Python bot'a WAREHOUSE Keycloak refresh token gönder
  try {
    const requestBody = {
      refreshToken: refreshToken,
      timestamp: lastRefreshTokenUpdate
    };
    
    console.log('🤖 📤 🔄 WAREHOUSE refresh token request body hazırlandı (token uzunluğu:', refreshToken.length, ')');
    
    const response = await fetch(`${BOT_SERVER_URL}/update-keycloak-refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('🤖 📥 🔄 WAREHOUSE refresh token response alındı:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('🤖 ✅ ✅ ✅ ✅ ✅ WAREHOUSE Keycloak refresh token bot\'a başarıyla gönderildi:', data);
    } else {
      const errorText = await response.text();
      console.error('🤖 ❌ WAREHOUSE Keycloak refresh token gönderme hatası:', response.status, response.statusText);
      console.error('🤖 ❌ Error response:', errorText);
    }
  } catch (error) {
    console.error('🤖 ❌ WAREHOUSE Keycloak refresh token gönderme hatası (catch):', error);
    console.error('🤖 ❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    // Bot çalışmıyor olabilir, hata mesajı gösterme (normal)
  }
}

// WAREHOUSE Keycloak token güncellemesini işle (warehouse.getir.com için)
async function handleKeycloakTokenUpdate(token, timestamp) {
  console.log('🤖 📥 🏭 WAREHOUSE Keycloak token güncelleme işlemi başlatıldı');
  console.log('🤖 📋 WAREHOUSE token uzunluğu:', token.length);
  console.log('🤖 📋 Mevcut WAREHOUSE token:', currentKeycloakToken ? currentKeycloakToken.substring(0, 50) + '...' : 'null');
  console.log('🤖 📋 Yeni WAREHOUSE token:', token.substring(0, 50) + '...');
  
  if (token === currentKeycloakToken && Date.now() - lastKeycloakTokenUpdate < 5000) {
    // Aynı token ve çok yakın zamanda güncellendi, gönderme
    console.log('🤖 ⏭️ WAREHOUSE token aynı ve çok yakın zamanda güncellendi, gönderme atlanıyor');
    return;
  }
  
  currentKeycloakToken = token;
  lastKeycloakTokenUpdate = timestamp || Date.now();
  
  console.log('🤖 ✅ ✅ ✅ WAREHOUSE Keycloak token güncellendi:', token.substring(0, 50) + '...');
  console.log('🤖 📤 WAREHOUSE token bot\'a gönderiliyor:', BOT_SERVER_URL);
  
  // Python bot'a WAREHOUSE Keycloak token gönder (warehouse API için)
  try {
    const requestBody = {
      token: token,
      timestamp: lastKeycloakTokenUpdate
    };
    
    console.log('🤖 📤 🏭 WAREHOUSE token request body hazırlandı (token uzunluğu:', token.length, ')');
    
    const response = await fetch(`${BOT_SERVER_URL}/update-keycloak-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('🤖 📥 🏭 WAREHOUSE token response alındı:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('🤖 ✅ ✅ ✅ ✅ ✅ WAREHOUSE Keycloak token bot\'a başarıyla gönderildi:', data);
    } else {
      const errorText = await response.text();
      console.error('🤖 ❌ WAREHOUSE Keycloak token gönderme hatası:', response.status, response.statusText);
      console.error('🤖 ❌ Error response:', errorText);
    }
  } catch (error) {
    console.error('🤖 ❌ WAREHOUSE Keycloak token gönderme hatası (catch):', error);
    console.error('🤖 ❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    // Bot çalışmıyor olabilir, hata mesajı gösterme (normal)
  }
}

// Admin panelden gelen ürün çekme isteğini işle
async function handleExportAllProducts(sendResponse) {
  // sendResponse'u hemen çağır (async işlem başladığını belirt)
  // Ama asıl sonucu chrome.tabs.sendMessage ile göndereceğiz
  sendResponse({ success: true, message: 'İşlem başlatıldı' });
  
  try {
    console.log('🤖 📦 Tüm ürünleri çekme işlemi başlatılıyor...');
    
    // Admin panel tab'ını bul (ilerleme mesajları için)
    let adminTabs = [];
    try {
      adminTabs = await chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*', 'https://*/*'] });
    } catch (e) {
      console.error('Admin tab bulunamadı:', e);
    }
    
    const sendProgressToAdmin = (message) => {
      for (const adminTab of adminTabs) {
        chrome.tabs.sendMessage(adminTab.id, {
          type: 'GETIR_PROGRESS',
          step: 'fetching',
          message: message
        }).catch(() => {});
      }
    };
    
    sendProgressToAdmin('🔍 Getir sitesi kontrol ediliyor...');
    
    // Getir franchise sitesinde açık tab'ı bul
    const franchiseTabs = await chrome.tabs.query({ url: 'https://franchise.getir.com/*' });
    
    if (!franchiseTabs || franchiseTabs.length === 0) {
      console.error('🤖 ❌ Getir franchise sitesi açık değil!');
      sendProgressToAdmin('❌ Getir franchise sitesi açık değil. Lütfen https://franchise.getir.com adresini açın.');
      
      // Hata mesajını admin panele gönder
      for (const adminTab of adminTabs) {
        chrome.tabs.sendMessage(adminTab.id, {
          type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
          success: false,
          products: null,
          error: 'Getir franchise sitesi açık değil. Lütfen https://franchise.getir.com adresini açın.',
          total: 0
        }).catch(() => {});
      }
      return;
    }
    
    // İlk açık tab'ı kullan
    const tab = franchiseTabs[0];
    console.log('🤖 ✅ Getir franchise tab bulundu:', tab.id, tab.url);
    
    sendProgressToAdmin('✅ Getir sitesi bulundu, ürünler çekiliyor...');
    
    console.log('🤖 Script çalıştırılıyor, tab ID:', tab.id);
    
    // Script çalıştırma işlemine timeout ekle (5 dakika)
    const scriptTimeout = setTimeout(() => {
      sendProgressToAdmin('⏱️ İşlem çok uzun sürüyor, lütfen bekleyin...');
    }, 180000); // 3 dakika
    
    // Tab'da script çalıştır ve ürünleri çek
    // Tüm fonksiyonları inject et (fetchAllProductsFromGetirAPI ve convertGetirProductToJSONFormat)
    let results;
    try {
      results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        // Tüm fonksiyonları buraya kopyala
        return (async function() {
          // İlerleme mesajı gönder fonksiyonu
          // Not: window.postMessage Getir sitesinde çalışıyor ama admin panele ulaşmıyor
          // Bu yüzden sadece console'a yazıyoruz, asıl mesajlar background script'ten gönderilecek
          function sendProgressMessage(message) {
            try {
              // Console'a yaz (debug için)
              console.log('📊 İlerleme:', message);
              
              // window.postMessage kaldırıldı - background script ilerleme mesajlarını gönderecek
              // Background script'te sendProgressToAdmin fonksiyonu var
            } catch (e) {
              console.error('İlerleme mesajı gönderilemedi:', e);
            }
          }
          
          // convertGetirProductToJSONFormat fonksiyonu
          function convertGetirProductToJSONFormat(stockData) {
            try {
              let product = stockData.product || stockData;
              if (!product || typeof product !== 'object') return null;
              
              const productId = product._id || product.id || stockData._id || stockData.id;
              if (!productId) return null;
              
              let name = null;
              if (product.fullName) {
                if (typeof product.fullName === 'object') {
                  name = product.fullName.tr || product.fullName.en || '';
                } else if (typeof product.fullName === 'string') {
                  name = product.fullName;
                }
              }
              if (!name && product.name) {
                if (typeof product.name === 'object') {
                  name = product.name.tr || product.name.en || '';
                } else if (typeof product.name === 'string') {
                  name = product.name;
                }
              }
              if (!name) name = 'Bilinmeyen Ürün';
              
              let category = 'Genel';
              if (product.masterCategoryName) {
                if (typeof product.masterCategoryName === 'object') {
                  category = product.masterCategoryName.tr || product.masterCategoryName.en || 'Genel';
                } else if (typeof product.masterCategoryName === 'string') {
                  category = product.masterCategoryName;
                }
              }
              
              let subcategory = null;
              if (product.categoryName) {
                if (typeof product.categoryName === 'object') {
                  subcategory = product.categoryName.tr || product.categoryName.en;
                } else if (typeof product.categoryName === 'string') {
                  subcategory = product.categoryName;
                }
              }
              
              let brand = '';
              if (product.brandName) {
                if (typeof product.brandName === 'object') {
                  brand = product.brandName.tr || product.brandName.en || '';
                } else if (typeof product.brandName === 'string') {
                  brand = product.brandName;
                }
              }
              
              let image = null;
              if (product.picURL) {
                image = product.picURL;
              } else if (product.picURLs && Array.isArray(product.picURLs) && product.picURLs.length > 0) {
                image = product.picURLs[0];
              } else if (product.imageUrl) {
                image = product.imageUrl;
              } else if (product.image) {
                image = product.image;
              } else if (product.images && Array.isArray(product.images) && product.images.length > 0) {
                image = product.images[0];
              }
              
              if (image && !image.startsWith('http')) {
                if (image.startsWith('/')) {
                  image = `https://cdn.getir.com${image}`;
                } else {
                  image = `https://cdn.getir.com/${image}`;
                }
              }
              
              const barcodes = [];
              const packagingInfo = product.packagingInfo || {};
              
              if (packagingInfo && typeof packagingInfo === 'object') {
                for (const pkgType in packagingInfo) {
                  const pkgData = packagingInfo[pkgType];
                  if (pkgData && typeof pkgData === 'object' && pkgData.barcodes && Array.isArray(pkgData.barcodes)) {
                    for (const barcode of pkgData.barcodes) {
                      if (barcode && String(barcode).trim()) {
                        barcodes.push({
                          code: String(barcode).trim(),
                          type: 'EAN-13',
                          size: pkgData.size || pkgData.unit || '',
                          variant: pkgData.variant || ''
                        });
                      }
                    }
                  }
                }
              }
              
              if (barcodes.length === 0 && product.barcodes && Array.isArray(product.barcodes)) {
                for (const barcode of product.barcodes) {
                  if (typeof barcode === 'object') {
                    barcodes.push({
                      code: String(barcode.code || barcode.barcode || '').trim(),
                      type: barcode.type || 'EAN-13',
                      size: String(barcode.size || ''),
                      variant: String(barcode.variant || '')
                    });
                  } else if (barcode) {
                    barcodes.push({
                      code: String(barcode).trim(),
                      type: 'EAN-13',
                      size: '',
                      variant: ''
                    });
                  }
                }
              }
              
              const result = {
                id: String(productId),
                name: String(name),
                category: String(category),
                brand: String(brand),
                description: String(name),
                image: image ? String(image) : '',
                barcodes: barcodes,
                shelf: '-',
                price: null,
                stock: null
              };
              
              if (subcategory) {
                result.subcategory = String(subcategory);
              }
              
              return result;
            } catch (error) {
              console.error('Ürün dönüştürme hatası:', error);
              return null;
            }
          }
          
          // Ana fonksiyon
          try {
            sendProgressMessage('🔄 Token aranıyor...');
            
            let token = null;
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (!key) continue;
              const value = localStorage.getItem(key);
              if (value && typeof value === 'string' && value.startsWith('eyJ') && value.length > 150) {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('access') || lowerKey.includes('token')) {
                  token = value;
                  break;
                }
              }
            }
            
            if (!token) {
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (!key) continue;
                const value = sessionStorage.getItem(key);
                if (value && typeof value === 'string' && value.startsWith('eyJ') && value.length > 150) {
                  const lowerKey = key.toLowerCase();
                  if (lowerKey.includes('access') || lowerKey.includes('token')) {
                    token = value;
                    break;
                  }
                }
              }
            }
            
            if (!token) {
              return { 
                success: false, 
                error: 'Token bulunamadı. Lütfen Getir sitesine giriş yapın.' 
              };
            }
            
            sendProgressMessage('✅ Token bulundu, API\'ye bağlanılıyor...');
            
            const API_BASE_URL = 'https://franchise-api-gateway.getirapi.com';
            const WAREHOUSE_ID = '5dcafe6ae2c61b1e52cf1704';
            
            sendProgressMessage('📊 Toplam ürün sayısı kontrol ediliyor...');
            
            let allProducts = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            let pageCount = 0;
            const maxPages = 200;
            
            while (hasMore && pageCount < maxPages) {
              // İlerleme mesajını background script'e gönder (admin panele iletilecek)
              const progressMsg = `📥 Sayfa ${pageCount + 1} çekiliyor... (Şu ana kadar: ${allProducts.length} ürün)`;
              sendProgressMessage(progressMsg);
              
              // Background script'e de bildir (eğer mümkünse)
              // Not: Bu script Getir sitesinde çalışıyor, background script'e direkt erişemiyor
              // Ama background script periyodik olarak kontrol edebilir veya başka bir yöntem kullanabiliriz
              
              const response = await fetch(`${API_BASE_URL}/stocks?limit=${limit}&offset=${offset}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': '*/*',
                  'Authorization': `Bearer ${token}`,
                  'Origin': 'https://franchise.getir.com',
                  'Referer': 'https://franchise.getir.com/'
                },
                body: JSON.stringify({
                  warehouseIds: [WAREHOUSE_ID],
                  sort: { available: 1 }
                })
              });
              
              if (!response.ok) {
                if (response.status === 401) {
                  return { 
                    success: false, 
                    error: 'Token geçersiz. Lütfen sayfayı yenileyin ve tekrar deneyin.' 
                  };
                }
                const errorText = await response.text();
                return { 
                  success: false, 
                  error: `API hatası: ${response.status} - ${errorText.substring(0, 200)}` 
                };
              }
              
              const data = await response.json();
              
              let stocks = null;
              if (Array.isArray(data)) {
                stocks = data;
              } else if (data.data) {
                if (Array.isArray(data.data)) {
                  stocks = data.data;
                } else if (data.data.data && Array.isArray(data.data.data)) {
                  stocks = data.data.data;
                } else if (data.data.items && Array.isArray(data.data.items)) {
                  stocks = data.data.items;
                }
              }
              
              if (!stocks || stocks.length === 0) {
                hasMore = false;
                break;
              }
              
              allProducts = allProducts.concat(stocks);
              pageCount++;
              
              if (stocks.length < limit) {
                hasMore = false;
              } else {
                offset += limit;
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
            
            if (pageCount >= maxPages) {
              console.warn(`⚠️ Maksimum sayfa sayısına ulaşıldı (${maxPages})`);
            }
            
            sendProgressMessage(`✅ ${allProducts.length} ürün çekildi, dönüştürülüyor...`);
            
            const convertedProducts = [];
            let convertedCount = 0;
            for (const stock of allProducts) {
              try {
                const product = convertGetirProductToJSONFormat(stock);
                if (product) {
                  convertedProducts.push(product);
                  convertedCount++;
                  
                  if (convertedCount % 100 === 0) {
                    sendProgressMessage(`🔄 ${convertedCount}/${allProducts.length} ürün dönüştürüldü...`);
                  }
                }
              } catch (error) {
                console.warn('Ürün dönüştürme hatası:', error);
                continue;
              }
            }
            
            sendProgressMessage(`✅ ${convertedProducts.length} ürün başarıyla dönüştürüldü!`);
            
            // Sonucu return et (background script admin panele gönderecek)
            // window.postMessage kaldırıldı çünkü Getir sitesinde çalışıyor, admin panele ulaşmıyor
            return {
              success: true,
              products: convertedProducts,
              total: convertedProducts.length,
              message: `${convertedProducts.length} ürün başarıyla çekildi`
            };
          } catch (error) {
            console.error('❌ Ürün çekme hatası:', error);
            
            // Hata durumunu return et (background script admin panele gönderecek)
            return {
              success: false,
              error: error.message || 'Bilinmeyen hata'
            };
          }
        })();
      }
    });
    
    console.log('🤖 Script sonucu alındı:', results ? 'Var' : 'Yok');
    
    if (results && results[0] && results[0].result) {
      const result = results[0].result;
      if (result.success) {
        console.log(`🤖 ✅ ${result.products.length} ürün başarıyla çekildi`);
        
        // İlerleme mesajı gönder
        try {
          chrome.tabs.sendMessage(tab.id, {
            type: 'GETIR_PROGRESS',
            step: 'completed',
            message: `✅ ${result.products.length} ürün başarıyla çekildi!`
          }).catch(() => {});
        } catch (e) {}
        
        sendResponse({ 
          success: true, 
          products: result.products,
          total: result.total,
          message: result.message
        });
      } else {
        console.error('🤖 ❌ Ürün çekme hatası:', result.error);
        sendResponse({ 
          success: false, 
          error: result.error 
        });
      }
    } else {
      console.error('🤖 ❌ Script sonucu alınamadı');
      sendResponse({ 
        success: false, 
        error: 'Script çalıştırılamadı veya sonuç alınamadı' 
      });
    }
    
    return true; // Async response için
  } catch (error) {
    console.error('🤖 ❌ Ürün çekme işlemi hatası:', error);
    sendResponse({ 
      success: false, 
      error: error.message || 'Bilinmeyen hata' 
    });
    return true;
  }
}

// Getir API'den tüm ürünleri çeken fonksiyon (Getir sitesinde çalışacak)
async function fetchAllProductsFromGetirAPI() {
  // İlerleme mesajı gönder fonksiyonu (Getir sitesinde çalışacak)
  function sendProgressMessage(message) {
    try {
      window.postMessage({
        type: 'GETIR_PROGRESS',
        step: 'fetching',
        message: message
      }, '*');
    } catch (e) {
      // Hata olursa sessizce devam et
    }
  }
  
  try {
    // İlerleme mesajı gönder
    sendProgressMessage('🔄 Token aranıyor...');
    
    // Token'ı localStorage'dan al
    let token = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key);
      if (value && typeof value === 'string' && value.startsWith('eyJ') && value.length > 150) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('access') || lowerKey.includes('token')) {
          token = value;
          break;
        }
      }
    }
    
    if (!token) {
      // SessionStorage'dan da dene
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        const value = sessionStorage.getItem(key);
        if (value && typeof value === 'string' && value.startsWith('eyJ') && value.length > 150) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('access') || lowerKey.includes('token')) {
            token = value;
            break;
          }
        }
      }
    }
    
    if (!token) {
      return { 
        success: false, 
        error: 'Token bulunamadı. Lütfen Getir sitesine giriş yapın.' 
      };
    }
    
    sendProgressMessage('✅ Token bulundu, API\'ye bağlanılıyor...');
    
    const API_BASE_URL = 'https://franchise-api-gateway.getirapi.com';
    const WAREHOUSE_ID = '5dcafe6ae2c61b1e52cf1704'; // Varsayılan, environment'tan alınabilir
    
    // İlk isteği at ve toplam sayıyı öğren
    sendProgressMessage('📊 Toplam ürün sayısı kontrol ediliyor...');
    
    // Tüm ürünleri çek (pagination ile)
    let allProducts = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 200; // 20000 ürün için yeterli
    
    while (hasMore && pageCount < maxPages) {
      sendProgressMessage(`📥 Sayfa ${pageCount + 1} çekiliyor... (Şu ana kadar: ${allProducts.length} ürün)`);
      
      const response = await fetch(`${API_BASE_URL}/stocks?limit=${limit}&offset=${offset}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://franchise.getir.com',
          'Referer': 'https://franchise.getir.com/'
        },
        body: JSON.stringify({
          warehouseIds: [WAREHOUSE_ID],
          sort: { available: 1 }
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return { 
            success: false, 
            error: 'Token geçersiz. Lütfen sayfayı yenileyin ve tekrar deneyin.' 
          };
        }
        const errorText = await response.text();
        return { 
          success: false, 
          error: `API hatası: ${response.status} - ${errorText.substring(0, 200)}` 
        };
      }
      
      const data = await response.json();
      
      // Response formatını kontrol et
      let stocks = null;
      if (Array.isArray(data)) {
        stocks = data;
      } else if (data.data) {
        if (Array.isArray(data.data)) {
          stocks = data.data;
        } else if (data.data.data && Array.isArray(data.data.data)) {
          stocks = data.data.data;
        } else if (data.data.items && Array.isArray(data.data.items)) {
          stocks = data.data.items;
        }
      }
      
      if (!stocks || stocks.length === 0) {
        hasMore = false;
        break;
      }
      
      allProducts = allProducts.concat(stocks);
      pageCount++;
      
      // Eğer dönen veri limit'ten azsa, son sayfadayız
      if (stocks.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
        // Rate limiting için kısa bekleme
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (pageCount >= maxPages) {
      console.warn(`⚠️ Maksimum sayfa sayısına ulaşıldı (${maxPages})`);
    }
    
    sendProgressMessage(`✅ ${allProducts.length} ürün çekildi, dönüştürülüyor...`);
    
    // Ürünleri products.json formatına dönüştür
    const convertedProducts = [];
    let convertedCount = 0;
    for (const stock of allProducts) {
      try {
        const product = convertGetirProductToJSONFormat(stock);
        if (product) {
          convertedProducts.push(product);
          convertedCount++;
          
          // Her 100 üründe bir ilerleme mesajı gönder
          if (convertedCount % 100 === 0) {
            sendProgressMessage(`🔄 ${convertedCount}/${allProducts.length} ürün dönüştürüldü...`);
          }
        }
      } catch (error) {
        console.warn('Ürün dönüştürme hatası:', error);
        continue;
      }
    }
    
    sendProgressMessage(`✅ ${convertedProducts.length} ürün başarıyla dönüştürüldü!`);
    
    return {
      success: true,
      products: convertedProducts,
      total: convertedProducts.length,
      message: `${convertedProducts.length} ürün başarıyla çekildi`
    };
    
  } catch (error) {
    console.error('❌ Ürün çekme hatası:', error);
    return {
      success: false,
      error: error.message || 'Bilinmeyen hata'
    };
  }
}

// İlerleme mesajı gönder (admin panele) - Bu fonksiyon Getir sitesinde çalışacak
// Not: Bu fonksiyon fetchAllProductsFromGetirAPI içinde kullanılacak

// Getir API formatını products.json formatına dönüştür (stok bilgisi hariç)
function convertGetirProductToJSONFormat(stockData) {
  try {
    // Ürün bilgilerini çıkar
    let product = stockData.product || stockData;
    if (!product || typeof product !== 'object') {
      return null;
    }
    
    // ID
    const productId = product._id || product.id || stockData._id || stockData.id;
    if (!productId) {
      return null;
    }
    
    // Ürün adı
    let name = null;
    if (product.fullName) {
      if (typeof product.fullName === 'object') {
        name = product.fullName.tr || product.fullName.en || '';
      } else if (typeof product.fullName === 'string') {
        name = product.fullName;
      }
    }
    if (!name && product.name) {
      if (typeof product.name === 'object') {
        name = product.name.tr || product.name.en || '';
      } else if (typeof product.name === 'string') {
        name = product.name;
      }
    }
    if (!name) {
      name = 'Bilinmeyen Ürün';
    }
    
    // Kategori
    let category = 'Genel';
    if (product.masterCategoryName) {
      if (typeof product.masterCategoryName === 'object') {
        category = product.masterCategoryName.tr || product.masterCategoryName.en || 'Genel';
      } else if (typeof product.masterCategoryName === 'string') {
        category = product.masterCategoryName;
      }
    }
    
    // Alt kategori
    let subcategory = null;
    if (product.categoryName) {
      if (typeof product.categoryName === 'object') {
        subcategory = product.categoryName.tr || product.categoryName.en;
      } else if (typeof product.categoryName === 'string') {
        subcategory = product.categoryName;
      }
    }
    
    // Marka
    let brand = '';
    if (product.brandName) {
      if (typeof product.brandName === 'object') {
        brand = product.brandName.tr || product.brandName.en || '';
      } else if (typeof product.brandName === 'string') {
        brand = product.brandName;
      }
    }
    
    // Açıklama
    const description = name;
    
    // Görsel
    let image = null;
    if (product.picURL) {
      image = product.picURL;
    } else if (product.picURLs && Array.isArray(product.picURLs) && product.picURLs.length > 0) {
      image = product.picURLs[0];
    } else if (product.imageUrl) {
      image = product.imageUrl;
    } else if (product.image) {
      image = product.image;
    } else if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      image = product.images[0];
    }
    
    // Görsel URL'sini tamamla
    if (image && !image.startsWith('http')) {
      if (image.startsWith('/')) {
        image = `https://cdn.getir.com${image}`;
      } else {
        image = `https://cdn.getir.com/${image}`;
      }
    }
    
    // Barkodlar
    const barcodes = [];
    const packagingInfo = product.packagingInfo || {};
    
    if (packagingInfo && typeof packagingInfo === 'object') {
      for (const pkgType in packagingInfo) {
        const pkgData = packagingInfo[pkgType];
        if (pkgData && typeof pkgData === 'object' && pkgData.barcodes && Array.isArray(pkgData.barcodes)) {
          for (const barcode of pkgData.barcodes) {
            if (barcode && String(barcode).trim()) {
              barcodes.push({
                code: String(barcode).trim(),
                type: 'EAN-13',
                size: pkgData.size || pkgData.unit || '',
                variant: pkgData.variant || ''
              });
            }
          }
        }
      }
    }
    
    // Eğer barcodes yoksa, product içindeki barcodes'u kontrol et
    if (barcodes.length === 0 && product.barcodes && Array.isArray(product.barcodes)) {
      for (const barcode of product.barcodes) {
        if (typeof barcode === 'object') {
          barcodes.push({
            code: String(barcode.code || barcode.barcode || '').trim(),
            type: barcode.type || 'EAN-13',
            size: String(barcode.size || ''),
            variant: String(barcode.variant || '')
          });
        } else if (barcode) {
          barcodes.push({
            code: String(barcode).trim(),
            type: 'EAN-13',
            size: '',
            variant: ''
          });
        }
      }
    }
    
    // Sonuç objesi (stok bilgisi YOK)
    const result = {
      id: String(productId),
      name: String(name),
      category: String(category),
      brand: String(brand),
      description: String(description),
      image: image ? String(image) : '',
      barcodes: barcodes,
      shelf: '-',
      price: null,
      stock: null
    };
    
    // Alt kategori varsa ekle
    if (subcategory) {
      result.subcategory = String(subcategory);
    }
    
    return result;
    
  } catch (error) {
    console.error('Ürün dönüştürme hatası:', error);
    return null;
  }
}

// Periyodik olarak token'ı kontrol et (her 60 saniyede bir)
setInterval(async () => {
  try {
    const franchiseTabs = await chrome.tabs.query({ url: 'https://franchise.getir.com/*' });
    const warehouseTabs = await chrome.tabs.query({ url: 'https://warehouse.getir.com/*' });
    
    if (franchiseTabs.length > 0) {
      console.log('🤖 ' + 'Franchise sitesi açık, token kontrol ediliyor...');
    }
    if (warehouseTabs.length > 0) {
      console.log('🤖 ' + 'Warehouse sitesi açık, Keycloak token kontrol ediliyor...');
    }
  } catch (error) {
    console.error('🤖 ' + 'Tab kontrol hatası:', error);
  }
}, 60000);

