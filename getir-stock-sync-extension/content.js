// Getir Stok Senkronizasyonu - Chrome Extension Content Script
// Sadece franchise token yakalama - API çağrıları counting.js'de yapılacak

(function() {
    'use strict';

    console.log('✅ Getir Stok Senkronizasyonu extension yüklendi (Franchise Token & Warehouse ID Yakalama)');
    console.log('🔧 Extension ayarları:');
    console.log('  - Content Script Timing: document_start');
    console.log('  - Token yakalama: Aktif');
    console.log('  - Warehouse ID yakalama: Aktif');
    console.log('  - Debug logging: Aktif');
    console.log('  - Sayfa URL:', window.location.href);
    console.log('  - Extension ID:', typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : 'N/A (normal sayfa)');

    // API endpoint'lerini ve token'ları yakala
    let apiEndpoints = {
        stock: 'https://franchise-api-gateway.getirapi.com/stocks', // Sabit endpoint
        token: null,
        warehouseId: null, // Warehouse ID'yi response'dan yakalayacağız
        warehouseName: null, // Warehouse name'i DOM'dan veya API'den yakalayacağız
        headers: {},
        baseUrl: 'https://franchise-api-gateway.getirapi.com',
        captured: false,
        tokenExpiry: null // Token'ın expire zamanı (JWT'den çıkarılacak)
    };
    
    // Console log optimizasyonu için debounce mekanizması
    const logDebounce = {
        timers: {},
        lastLogs: {},
        log(message, data = null, key = null) {
            // Eğer key verilmişse, aynı mesajı tekrar yazdırma
            if (key) {
                const logKey = `${message}_${key}`;
                const now = Date.now();
                
                // Son log'dan 2 saniye geçmediyse atla
                if (this.lastLogs[logKey] && (now - this.lastLogs[logKey] < 2000)) {
                    return; // Aynı mesajı tekrar yazdırma
                }
                
                this.lastLogs[logKey] = now;
            }
            
            if (data) {
                console.log(message, data);
            } else {
                console.log(message);
            }
        }
    };

    // DOM'dan warehouse name'i yakala
    function extractWarehouseNameFromDOM() {
        try {
            // Franchise sayfasında depo adını bulabileceğimiz yerler
            const selectors = [
                'h1', 'h2', 'h3', // Başlıklar
                '[class*="warehouse"]', '[class*="depo"]', // Warehouse/depo class'ları
                '[data-warehouse]', '[data-depo]', // Data attribute'ları
                'nav', 'header', 'aside', // Navigation, header, sidebar
                '.sidebar', '.header', '.nav', // Yaygın class'lar
            ];
            
            // Önce data attribute'lardan dene
            const dataWarehouse = document.querySelector('[data-warehouse-name], [data-warehouse], [data-depo-name]');
            if (dataWarehouse) {
                const name = dataWarehouse.getAttribute('data-warehouse-name') || 
                           dataWarehouse.getAttribute('data-warehouse') ||
                           dataWarehouse.getAttribute('data-depo-name') ||
                           dataWarehouse.textContent?.trim();
                if (name && name.length > 0 && name.length < 100) {
                    return name;
                }
            }
            
            // Başlıklardan dene
            const headings = document.querySelectorAll('h1, h2, h3');
            for (const heading of headings) {
                const text = heading.textContent?.trim();
                if (text && text.length > 0 && text.length < 100 && 
                    !text.includes('Getir') && !text.includes('Franchise') &&
                    !text.includes('Stok') && !text.includes('Stock')) {
                    // Muhtemelen depo adı
                    return text;
                }
            }
            
            // Meta tag'lerden dene
            const metaWarehouse = document.querySelector('meta[name="warehouse-name"], meta[property="warehouse-name"]');
            if (metaWarehouse) {
                const name = metaWarehouse.getAttribute('content');
                if (name && name.length > 0 && name.length < 100) {
                    return name;
                }
            }
            
            return null;
        } catch (error) {
            console.warn('⚠️ DOM\'dan warehouse name çıkarılamadı:', error);
            return null;
        }
    }
    
    // JWT token'dan expiry zamanını çıkar
    function getTokenExpiry(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            const payload = parts[1];
            // Base64 padding ekle
            const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
            const decoded = JSON.parse(atob(padded));
            
            if (decoded.exp) {
                return decoded.exp * 1000; // Unix timestamp'i ms'ye çevir
            }
        } catch (e) {
            console.warn('⚠️ Token expiry çıkarılamadı:', e);
        }
        return null;
    }

    // Token'ın geçerli olup olmadığını kontrol et
    function isTokenValid() {
        if (!apiEndpoints.token || !apiEndpoints.tokenExpiry) return false;
        const now = Date.now();
        // 5 dakika önceden expire olmuş say (güvenlik için)
        return now < (apiEndpoints.tokenExpiry - 5 * 60 * 1000);
    }

    // Headers'dan değer oku - hem Headers instance hem object için çalışır
    function getHeaderValue(headers, key) {
        if (!headers) return null;
        
        // Headers instance ise
        if (headers instanceof Headers) {
            return headers.get(key) || headers.get(key.toLowerCase());
        }
        
        // Normal object ise
        if (typeof headers === 'object') {
            return headers[key] || headers[key.toLowerCase()] || 
                   headers[Object.keys(headers).find(k => k.toLowerCase() === key.toLowerCase())];
        }
        
        return null;
    }

    // Headers'ı string'e çevir (debug için)
    function headersToString(headers) {
        if (!headers) return 'null';
        
        if (headers instanceof Headers) {
            const obj = {};
            headers.forEach((value, key) => {
                obj[key] = value;
            });
            return JSON.stringify(obj, null, 2);
        }
        
        if (typeof headers === 'object') {
            return JSON.stringify(headers, null, 2);
        }
        
        return String(headers);
    }

    // Önceki API bilgilerini sakla (değişiklik tespiti için)
    let previousAPIInfo = null;
    
    // Supabase'e API bilgilerini kaydet
    async function saveAPIInfoToSupabase(apiInfo) {
        try {
            // Supabase ve kullanıcı kontrolü
            if (typeof window === 'undefined' || !window.supabase) {
                // Supabase yoksa (franchise sayfasında olabilir), sadece log
                return;
            }
            
            // Kullanıcı bilgisi al (auth.js'den)
            let username = null;
            if (window.authUtils && window.authUtils.checkAuth) {
                const session = window.authUtils.checkAuth();
                if (session && session.username) {
                    username = session.username;
                }
            }
            
            if (!username) {
                // Kullanıcı giriş yapmamış, Supabase'e kaydetme
                return;
            }
            
            // Mevcut counting_data'yı al
            const { data: userData, error: fetchError } = await window.supabase
                .from('users')
                .select('counting_data')
                .eq('username', username)
                .single();
            
            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.warn('⚠️ Supabase counting_data okuma hatası:', fetchError);
                return;
            }
            
            // counting_data'yı parse et veya yeni oluştur
            let countingData = {};
            if (userData && userData.counting_data) {
                try {
                    countingData = typeof userData.counting_data === 'string' 
                        ? JSON.parse(userData.counting_data) 
                        : userData.counting_data;
                } catch (e) {
                    console.warn('⚠️ counting_data parse hatası:', e);
                    countingData = {};
                }
            }
            
            // API bilgilerini _api_info key'ine kaydet
            countingData._api_info = {
                token: apiInfo.token,
                warehouseId: apiInfo.warehouseId,
                warehouseName: apiInfo.warehouseName || null,
                tokenExpiry: apiInfo.tokenExpiry,
                baseUrl: apiInfo.baseUrl,
                stockEndpoint: apiInfo.stockEndpoint,
                lastUpdated: new Date().toISOString(),
                timestamp: apiInfo.timestamp
            };
            
            // Supabase'e kaydet
            const { error: updateError } = await window.supabase
                .from('users')
                .update({ counting_data: countingData })
                .eq('username', username);
            
            if (updateError) {
                console.warn('⚠️ Supabase API bilgileri kayıt hatası:', updateError);
            } else {
                logDebounce.log('✅ API bilgileri Supabase\'e kaydedildi', {
                    warehouseId: apiInfo.warehouseId,
                    tokenLength: apiInfo.token ? apiInfo.token.substring(7).trim().length : 0,
                    tokenExpiry: apiInfo.tokenExpiry ? new Date(apiInfo.tokenExpiry).toLocaleString('tr-TR') : 'N/A'
                }, 'supabase_save');
            }
        } catch (error) {
            console.warn('⚠️ Supabase API bilgileri kayıt hatası:', error);
        }
    }

    // API bilgilerini counting.html'e bildir
    function sendAPIInfoToCountingPage() {
        if (!apiEndpoints.token) return; // Token yoksa gönderme
        
        // Token geçerliliğini kontrol et (sadece uyarı ver, token'ı silme)
        if (!isTokenValid()) {
            logDebounce.log('⚠️ Token süresi dolmuş, yeni token bekleniyor...', null, 'token_expired');
            // Token süresi dolmuşsa bile kaydet, çünkü yeni token yakalanana kadar kullanılabilir
            // Ayrıca counting.js tarafında da kontrol yapılacak
        }
        
        // DOM'dan warehouse name'i yakala (eğer henüz yakalanmadıysa)
        if (!apiEndpoints.warehouseName && document.readyState === 'complete') {
            const warehouseName = extractWarehouseNameFromDOM();
            if (warehouseName) {
                apiEndpoints.warehouseName = warehouseName;
                console.log('🏭 ✅ Warehouse name DOM\'dan yakalandı:', warehouseName);
            }
        }
        
        const tokenValue = apiEndpoints.token.startsWith('Bearer ') ? apiEndpoints.token.substring(7).trim() : apiEndpoints.token;
        
        const apiInfo = {
            baseUrl: apiEndpoints.baseUrl,
            stockEndpoint: apiEndpoints.stock,
            token: apiEndpoints.token, // Bearer token olarak
            warehouseId: apiEndpoints.warehouseId || '5dcafe6ae2c61b1e52cf1704', // Default warehouse ID
            warehouseName: apiEndpoints.warehouseName || null, // Warehouse name
            headers: apiEndpoints.headers,
            timestamp: Date.now(),
            tokenExpiry: apiEndpoints.tokenExpiry
        };
        
        // Değişiklik tespiti: Token, warehouse ID, warehouse name veya expiry değişti mi?
        let hasChanged = false;
        if (!previousAPIInfo) {
            hasChanged = true; // İlk kayıt
        } else {
            const prevToken = previousAPIInfo.token ? previousAPIInfo.token.substring(7).trim() : '';
            const currToken = apiInfo.token ? apiInfo.token.substring(7).trim() : '';
            
            if (prevToken !== currToken || 
                previousAPIInfo.warehouseId !== apiInfo.warehouseId ||
                previousAPIInfo.warehouseName !== apiInfo.warehouseName ||
                previousAPIInfo.tokenExpiry !== apiInfo.tokenExpiry) {
                hasChanged = true;
            }
        }
        
        // Hem localStorage'a hem chrome.storage'a kaydet (tüm sayfalardan erişilebilir)
        // Bu ESKİ token'ları override edecek
        localStorage.setItem('getir_api_info', JSON.stringify(apiInfo));
        
        // Console log'larını optimize et (debounce ile)
        if (hasChanged) {
            logDebounce.log('📤 Franchise API bilgileri kaydedildi', {
            baseUrl: apiInfo.baseUrl,
            stockEndpoint: apiInfo.stockEndpoint,
                warehouseId: apiInfo.warehouseId,
            hasToken: !!apiInfo.token,
                tokenLength: tokenValue.length,
                tokenExpiry: apiInfo.tokenExpiry ? new Date(apiInfo.tokenExpiry).toLocaleString('tr-TR') : 'N/A',
                changed: hasChanged ? 'Token/Warehouse/Expiry değişti' : 'Değişiklik yok'
            }, 'api_info_saved');
        }
        
        // chrome.storage'a kaydet (tüm sayfalardan erişilebilir)
        chrome.storage.local.set({ 'getir_api_info': apiInfo }, () => {
            if (chrome.runtime.lastError) {
                logDebounce.log('⚠️ chrome.storage kayıt hatası:', chrome.runtime.lastError, 'chrome_storage_error');
            } else if (hasChanged) {
                // Sadece değişiklik varsa log yaz
                logDebounce.log('📤 Franchise API bilgileri kaydedildi (chrome.storage)', {
                    warehouseId: apiInfo.warehouseId,
                    tokenLength: tokenValue.length,
                    tokenExpiry: apiInfo.tokenExpiry ? new Date(apiInfo.tokenExpiry).toLocaleString('tr-TR') : 'N/A'
                }, 'chrome_storage_saved');
            }
        });
        
        // Değişiklik varsa Supabase'e kaydet
        if (hasChanged) {
            saveAPIInfoToSupabase(apiInfo);
            previousAPIInfo = { ...apiInfo }; // Deep copy
        }
    }

    // Network isteklerini intercept et ve API endpoint'lerini bul
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0];
        const fetchOptions = args[1] || {};
        
        // Getir API çağrılarını yakala ve detaylı log'la
        if (typeof url === 'string') {
                    // Tüm Getir API domain'lerini kontrol et
                    const isAPIRequest = url.includes('getirapi.com') || 
                                        url.includes('getir.com') ||
                                        url.includes('api') || 
                                        url.includes('stock') || 
                                        url.includes('product') || 
                                        url.includes('franchise');
            
            if (isAPIRequest) {
                console.log('🌐 ========== API ÇAĞRISI YAKALANDI ==========');
                console.log('📍 URL:', url);
                console.log('📤 Method:', fetchOptions.method || 'GET');
                        console.log('📋 Headers:', headersToString(fetchOptions.headers));
                if (fetchOptions.body) {
                    try {
                        const bodyObj = typeof fetchOptions.body === 'string' ? JSON.parse(fetchOptions.body) : fetchOptions.body;
                        console.log('📦 Request Body:', JSON.stringify(bodyObj, null, 2));
                        
                        // Request body'den warehouse ID'yi yakala (warehouseIds array'inden veya warehouse field'ından)
                        if (bodyObj) {
                            // warehouseIds array'inden yakala
                            if (bodyObj.warehouseIds && Array.isArray(bodyObj.warehouseIds) && bodyObj.warehouseIds.length > 0) {
                                const newWarehouseId = bodyObj.warehouseIds[0];
                                if (newWarehouseId && newWarehouseId !== apiEndpoints.warehouseId) {
                                    apiEndpoints.warehouseId = newWarehouseId;
                                    console.log('🏭 Warehouse ID yakalandı (request body - warehouseIds):', apiEndpoints.warehouseId);
                                    sendAPIInfoToCountingPage();
                                }
                            }
                            // warehouse field'ından yakala
                            else if (bodyObj.warehouse && bodyObj.warehouse !== apiEndpoints.warehouseId) {
                                apiEndpoints.warehouseId = bodyObj.warehouse;
                                console.log('🏭 Warehouse ID yakalandı (request body - warehouse):', apiEndpoints.warehouseId);
                                sendAPIInfoToCountingPage();
                            }
                            // warehouseId field'ından yakala
                            else if (bodyObj.warehouseId && bodyObj.warehouseId !== apiEndpoints.warehouseId) {
                                apiEndpoints.warehouseId = bodyObj.warehouseId;
                                console.log('🏭 Warehouse ID yakalandı (request body - warehouseId):', apiEndpoints.warehouseId);
                                sendAPIInfoToCountingPage();
                            }
                        }
                    } catch (e) {
                        console.log('📦 Request Body:', fetchOptions.body);
                    }
                }
                
                // Response'u da yakala
                try {
                    const response = await originalFetch.apply(this, args);
                    const responseClone = response.clone();
                    
                    // Response'u log'la (async) ve warehouse ID'yi yakala
                    responseClone.json().then(data => {
                        console.log('📥 Response Status:', response.status, response.statusText);
                        console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
                        console.log('📥 Response Body (ilk 500 karakter):', JSON.stringify(data, null, 2).substring(0, 500) + '...');
                        
                        // Token ve warehouse ID durumunu logla
                        console.log('📊 Mevcut durum:');
                        console.log('  - Token:', apiEndpoints.token ? '✅ Mevcut (' + apiEndpoints.token.substring(7, 37) + '...)' : '❌ Yok');
                        console.log('  - Warehouse ID:', apiEndpoints.warehouseId || '❌ Yok');
                        
                        // Warehouse ID ve name'i response'dan çıkar (her response'da güncelle)
                        if (data && response.status === 200) {
                            let foundWarehouseId = null;
                            let foundWarehouseName = null;
                            
                            // Eğer data array ise, ilk elemandan warehouse ID'yi al
                            if (Array.isArray(data) && data.length > 0) {
                                if (data[0].warehouse) {
                                    foundWarehouseId = data[0].warehouse;
                                }
                                // Warehouse name'i de kontrol et
                                if (data[0].warehouseName || data[0].warehouse?.name) {
                                    foundWarehouseName = data[0].warehouseName || data[0].warehouse?.name;
                                }
                            } 
                            // Eğer data.data array ise
                            else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                                if (data.data[0].warehouse) {
                                    foundWarehouseId = data.data[0].warehouse;
                                }
                                // Warehouse name'i de kontrol et
                                if (data.data[0].warehouseName || data.data[0].warehouse?.name) {
                                    foundWarehouseName = data.data[0].warehouseName || data.data[0].warehouse?.name;
                                }
                            }
                            // Eğer direkt warehouse field'ı varsa
                            else if (data.warehouse) {
                                foundWarehouseId = typeof data.warehouse === 'string' ? data.warehouse : data.warehouse._id || data.warehouse.id;
                                foundWarehouseName = typeof data.warehouse === 'object' ? (data.warehouse.name || data.warehouse.warehouseName) : null;
                            }
                            
                            // Warehouse ID bulunduysa ve değiştiyse güncelle
                            if (foundWarehouseId && foundWarehouseId !== apiEndpoints.warehouseId) {
                                apiEndpoints.warehouseId = foundWarehouseId;
                                console.log('🏭 ✅ Warehouse ID güncellendi (response\'dan):', apiEndpoints.warehouseId);
                                sendAPIInfoToCountingPage();
                            } else if (foundWarehouseId && !apiEndpoints.warehouseId) {
                                // İlk kez bulunuyorsa
                                apiEndpoints.warehouseId = foundWarehouseId;
                                console.log('🏭 ✅ Warehouse ID yakalandı (response\'dan):', apiEndpoints.warehouseId);
                                sendAPIInfoToCountingPage();
                            }
                            
                            // Warehouse name bulunduysa güncelle
                            if (foundWarehouseName && foundWarehouseName !== apiEndpoints.warehouseName) {
                                apiEndpoints.warehouseName = foundWarehouseName;
                                console.log('🏭 ✅ Warehouse name yakalandı (response\'dan):', apiEndpoints.warehouseName);
                                sendAPIInfoToCountingPage();
                            }
                        }
                        
                        console.log('🌐 ===========================================');
                    }).catch((error) => {
                        console.warn('⚠️ Response JSON parse edilemedi:', error);
                        responseClone.text().then(text => {
                            console.log('📥 Response Status:', response.status, response.statusText);
                            console.log('📥 Response Body (text, ilk 500 karakter):', text.substring(0, 500) + '...');
                            console.log('🌐 ===========================================');
                        }).catch(err => {
                            console.error('❌ Response text okunamadı:', err);
                        });
                    });
                    
                    // Token'ı yakala - Tüm Getir API çağrılarında kontrol et
                    if (fetchOptions.headers && isAPIRequest) {
                        const authHeader = getHeaderValue(fetchOptions.headers, 'Authorization') || 
                                         getHeaderValue(fetchOptions.headers, 'authorization');
                        
                        if (authHeader) {
                            console.log('🔍 Authorization header bulundu:', authHeader.substring(0, 30) + '...');
                            
                            if (authHeader.startsWith('Bearer ')) {
                            const token = authHeader.substring(7).trim();
                            // JWT token kontrolü (eyJ ile başlamalı)
                            if (token.startsWith('eyJ') && token.length > 100) {
                                    const tokenExpiry = getTokenExpiry(token);
                                    
                                    // Token değiştiyse veya ilk kez yakalanıyorsa güncelle
                                    if (!apiEndpoints.token || apiEndpoints.token !== authHeader) {
                                apiEndpoints.token = authHeader; // Bearer token olarak sakla
                                        apiEndpoints.tokenExpiry = tokenExpiry; // Expiry zamanını çıkar
                                apiEndpoints.headers = { 
                                    'Content-Type': 'application/json',
                                    'Accept': '*/*',
                                    'Origin': 'https://franchise.getir.com',
                                    'Referer': 'https://franchise.getir.com/'
                                };
                                apiEndpoints.captured = true;
                                console.log('🔑 ✅ Franchise token yakalandı:', token.substring(0, 30) + '... (uzunluk: ' + token.length + ')');
                                        if (apiEndpoints.tokenExpiry) {
                                            console.log('⏰ Token expiry:', new Date(apiEndpoints.tokenExpiry).toLocaleString('tr-TR'));
                                        }
                                sendAPIInfoToCountingPage();
                                    } else {
                                        console.log('ℹ️ Token zaten mevcut, güncelleme gerekmiyor');
                                    }
                                } else {
                                    console.warn('⚠️ Token JWT formatında değil veya çok kısa:', token.substring(0, 20) + '...');
                                }
                            } else {
                                console.warn('⚠️ Authorization header Bearer ile başlamıyor:', authHeader.substring(0, 20) + '...');
                            }
                        } else {
                            console.log('ℹ️ Authorization header bulunamadı');
                        }
                    } else if (isAPIRequest) {
                        console.warn('⚠️ API çağrısı yakalandı ama headers yok');
                    }
                    
                    // Base URL'i kaydet
                    if (!apiEndpoints.baseUrl) {
                        try {
                            const urlObj = new URL(url);
                            apiEndpoints.baseUrl = urlObj.origin;
                            apiEndpoints.captured = true;
                            console.log('🌐 Base URL kaydedildi:', apiEndpoints.baseUrl);
                            sendAPIInfoToCountingPage();
                        } catch (e) {
                            apiEndpoints.baseUrl = window.location.origin;
                            apiEndpoints.captured = true;
                            sendAPIInfoToCountingPage();
                        }
                    }
                    
                    // Stock endpoint'ini kaydet (franchise-api-gateway.getirapi.com/stocks öncelikli)
                    if (url.includes('stock') || url.includes('franchise-api-gateway')) {
                        // franchise-api-gateway endpoint'ini öncelikli olarak kaydet
                        if (url.includes('franchise-api-gateway.getirapi.com/stocks')) {
                            apiEndpoints.stock = 'https://franchise-api-gateway.getirapi.com/stocks';
                            apiEndpoints.captured = true;
                            console.log('📦 Stock endpoint kaydedildi (API Gateway):', apiEndpoints.stock);
                            sendAPIInfoToCountingPage();
                        } else if (!apiEndpoints.stock) {
                            apiEndpoints.stock = url.split('?')[0]; // Query string'i temizle
                            apiEndpoints.captured = true;
                            console.log('📦 Stock endpoint kaydedildi:', apiEndpoints.stock);
                            sendAPIInfoToCountingPage();
                        }
                    }
                    
                    // Search/Product endpoint'ini kaydet
                    if ((url.includes('search') || url.includes('product')) && !apiEndpoints.search) {
                        apiEndpoints.search = url.split('?')[0];
                        apiEndpoints.captured = true;
                        console.log('🔍 Search endpoint kaydedildi:', apiEndpoints.search);
                        sendAPIInfoToCountingPage();
                    }
                    
                    return response;
                } catch (error) {
                    console.error('❌ Fetch hatası:', error);
                    throw error;
                }
            }
        }
        
        return originalFetch.apply(this, args);
    };

    // XMLHttpRequest'i de intercept et (daha detaylı)
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._url = url;
        this._method = method;
        this._headers = {};
        return originalXHROpen.apply(this, [method, url, ...args]);
    };
    
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        this._headers = this._headers || {};
        this._headers[header] = value;
        return originalXHRSetRequestHeader.apply(this, [header, value]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        const url = this._url;
        const method = this._method || 'GET';
        const headers = this._headers || {};
        const body = args[0] || null;
        
        // Getir API çağrılarını yakala - Tüm Getir API domain'lerini kontrol et
        const isXHRAPIRequest = url && (url.includes('getirapi.com') || 
                                       url.includes('getir.com') ||
                                       url.includes('api') || 
                                       url.includes('stock') || 
                                       url.includes('product') || 
                                       url.includes('franchise'));
        
        if (isXHRAPIRequest) {
            console.log('🌐 ========== XHR API ÇAĞRISI YAKALANDI ==========');
            console.log('📍 URL:', url);
            console.log('📤 Method:', method);
            console.log('📋 Headers:', headersToString(headers));
            if (body) {
                try {
                    const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
                    console.log('📦 Request Body:', JSON.stringify(bodyObj, null, 2));
                    
                    // Request body'den warehouse ID'yi yakala (XHR için)
                    if (bodyObj) {
                        // warehouseIds array'inden yakala
                        if (bodyObj.warehouseIds && Array.isArray(bodyObj.warehouseIds) && bodyObj.warehouseIds.length > 0) {
                            const newWarehouseId = bodyObj.warehouseIds[0];
                            if (newWarehouseId && newWarehouseId !== apiEndpoints.warehouseId) {
                                apiEndpoints.warehouseId = newWarehouseId;
                                console.log('🏭 Warehouse ID yakalandı (XHR request body - warehouseIds):', apiEndpoints.warehouseId);
                                sendAPIInfoToCountingPage();
                            }
                        }
                        // warehouse field'ından yakala
                        else if (bodyObj.warehouse && bodyObj.warehouse !== apiEndpoints.warehouseId) {
                            apiEndpoints.warehouseId = bodyObj.warehouse;
                            console.log('🏭 Warehouse ID yakalandı (XHR request body - warehouse):', apiEndpoints.warehouseId);
                            sendAPIInfoToCountingPage();
                        }
                        // warehouseId field'ından yakala
                        else if (bodyObj.warehouseId && bodyObj.warehouseId !== apiEndpoints.warehouseId) {
                            apiEndpoints.warehouseId = bodyObj.warehouseId;
                            console.log('🏭 Warehouse ID yakalandı (XHR request body - warehouseId):', apiEndpoints.warehouseId);
                            sendAPIInfoToCountingPage();
                        }
                    }
                } catch (e) {
                    console.log('📦 Request Body:', body);
                }
            }
            
            // Response'u yakala (bu kısım yukarıda warehouse ID yakalama ile birleştirildi)
            
            // Token'ı yakala - Tüm Getir API çağrılarında kontrol et
            if (isXHRAPIRequest) {
                const authHeader = getHeaderValue(headers, 'Authorization') || 
                                 getHeaderValue(headers, 'authorization') ||
                                 this.getRequestHeader?.('Authorization') || 
                                 this.getRequestHeader?.('authorization');
                
                if (authHeader) {
                    console.log('🔍 Authorization header bulundu (XHR):', authHeader.substring(0, 30) + '...');
                    
                    if (authHeader.startsWith('Bearer ')) {
                    const token = authHeader.substring(7).trim();
                    // JWT token kontrolü (eyJ ile başlamalı)
                    if (token.startsWith('eyJ') && token.length > 100) {
                            const tokenExpiry = getTokenExpiry(token);
                            
                            // Token değiştiyse veya ilk kez yakalanıyorsa güncelle
                            if (!apiEndpoints.token || apiEndpoints.token !== authHeader) {
                        apiEndpoints.token = authHeader; // Bearer token olarak sakla
                                apiEndpoints.tokenExpiry = tokenExpiry; // Expiry zamanını çıkar
                        apiEndpoints.headers = { 
                            'Content-Type': 'application/json',
                            'Accept': '*/*',
                            'Origin': 'https://franchise.getir.com',
                            'Referer': 'https://franchise.getir.com/'
                        };
                        apiEndpoints.captured = true;
                        console.log('🔑 ✅ Franchise token yakalandı (XHR):', token.substring(0, 30) + '... (uzunluk: ' + token.length + ')');
                                if (apiEndpoints.tokenExpiry) {
                                    console.log('⏰ Token expiry:', new Date(apiEndpoints.tokenExpiry).toLocaleString('tr-TR'));
                                }
                        sendAPIInfoToCountingPage();
                            } else {
                                console.log('ℹ️ Token zaten mevcut (XHR), güncelleme gerekmiyor');
                            }
                        } else {
                            console.warn('⚠️ Token JWT formatında değil veya çok kısa (XHR):', token.substring(0, 20) + '...');
                        }
                    } else {
                        console.warn('⚠️ Authorization header Bearer ile başlamıyor (XHR):', authHeader.substring(0, 20) + '...');
                    }
                } else {
                    console.log('ℹ️ Authorization header bulunamadı (XHR)');
                }
            }
            
            // Response'dan warehouse ID'yi yakala
            this.addEventListener('load', function() {
                if (this.status === 200) {
                    try {
                        const responseText = this.responseText;
                        console.log('📥 XHR Response Status:', this.status, this.statusText);
                        console.log('📥 XHR Response Body (ilk 500 karakter):', responseText.substring(0, 500) + '...');
                        
                        const responseData = JSON.parse(responseText);
                        
                        // Warehouse ID'yi response'dan çıkar (XHR için)
                        if (responseData && this.status === 200) {
                            let foundWarehouseId = null;
                            
                            if (Array.isArray(responseData) && responseData.length > 0) {
                                if (responseData[0].warehouse) {
                                    foundWarehouseId = responseData[0].warehouse;
                                }
                            } else if (responseData.data && Array.isArray(responseData.data) && responseData.data.length > 0) {
                                if (responseData.data[0].warehouse) {
                                    foundWarehouseId = responseData.data[0].warehouse;
                                }
                            } else if (responseData.warehouse) {
                                foundWarehouseId = responseData.warehouse;
                            }
                            
                            // Warehouse ID bulunduysa ve değiştiyse güncelle
                            if (foundWarehouseId && foundWarehouseId !== apiEndpoints.warehouseId) {
                                apiEndpoints.warehouseId = foundWarehouseId;
                                console.log('🏭 ✅ Warehouse ID güncellendi (XHR response\'dan):', apiEndpoints.warehouseId);
                                sendAPIInfoToCountingPage();
                            } else if (foundWarehouseId && !apiEndpoints.warehouseId) {
                                // İlk kez bulunuyorsa
                                apiEndpoints.warehouseId = foundWarehouseId;
                                console.log('🏭 ✅ Warehouse ID yakalandı (XHR response\'dan):', apiEndpoints.warehouseId);
                                sendAPIInfoToCountingPage();
                            } else if (!foundWarehouseId) {
                                console.log('ℹ️ XHR Response\'da warehouse ID bulunamadı');
                            }
                            
                            // Mevcut durumu logla
                            console.log('📊 XHR Mevcut durum:');
                            console.log('  - Token:', apiEndpoints.token ? '✅ Mevcut' : '❌ Yok');
                            console.log('  - Warehouse ID:', apiEndpoints.warehouseId || '❌ Yok');
                        }
                    } catch (e) {
                        console.warn('⚠️ XHR Response parse edilemedi:', e);
                    }
                } else {
                    console.warn('⚠️ XHR Response başarısız:', this.status, this.statusText);
                }
                console.log('🌐 ===========================================');
            });
            
            // Base URL'i kaydet
            if (!apiEndpoints.baseUrl && url) {
                try {
                    const urlObj = new URL(url);
                    apiEndpoints.baseUrl = urlObj.origin;
                    apiEndpoints.captured = true;
                    console.log('🌐 Base URL kaydedildi (XHR):', apiEndpoints.baseUrl);
                    sendAPIInfoToCountingPage();
                } catch (e) {
                    // Relative URL
                }
            }
            
            // Stock endpoint'ini kaydet
            if ((url.includes('stock') || url.includes('franchise-api-gateway') || url.includes('getirapi.com')) && !apiEndpoints.stock) {
                if (url.includes('franchise-api-gateway.getirapi.com/stocks') || url.includes('getirapi.com/stocks')) {
                    const baseUrl = url.split('?')[0];
                    apiEndpoints.stock = baseUrl;
                    apiEndpoints.captured = true;
                    console.log('📦 Stock endpoint kaydedildi (XHR - API Gateway):', apiEndpoints.stock);
                    sendAPIInfoToCountingPage();
                } else if (url.includes('stock')) {
                    apiEndpoints.stock = url.split('?')[0];
                    apiEndpoints.captured = true;
                    console.log('📦 Stock endpoint kaydedildi (XHR):', apiEndpoints.stock);
                    sendAPIInfoToCountingPage();
                }
            }
        }
        
        return originalXHRSend.apply(this, args);
    };

    // Test localStorage erişimi
    try {
        const testKey = 'getir_extension_test';
        localStorage.setItem(testKey, 'test');
        const testValue = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        console.log('✅ localStorage erişimi test edildi:', testValue === 'test' ? 'BAŞARILI' : 'BAŞARISIZ');
    } catch (error) {
        console.error('❌ localStorage erişim hatası:', error);
    }

    // Token kontrolü (sayfa yüklendiğinde) - ÖNCE chrome.storage, SONRA localStorage
    function checkLocalStorageForToken() {
        // ÖNCE chrome.storage.local'dan oku (tüm origin'lerden erişilebilir)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['getir_api_info'], (result) => {
                if (chrome.runtime.lastError) {
                    console.warn('⚠️ chrome.storage okuma hatası:', chrome.runtime.lastError);
                    // Hata varsa localStorage'a fallback yap
                    checkLocalStorageFallback();
                } else if (result && result.getir_api_info) {
                    const apiInfo = result.getir_api_info;
                    if (apiInfo.token) {
                        const tokenValue = apiInfo.token.startsWith('Bearer ') ? apiInfo.token.substring(7).trim() : apiInfo.token;
                        const tokenExpiry = apiInfo.tokenExpiry || getTokenExpiry(tokenValue);
                        
                        // Token geçerliliğini kontrol et
                        if (tokenExpiry && Date.now() >= (tokenExpiry - 5 * 60 * 1000)) {
                            console.warn('⚠️ chrome.storage\'daki token süresi dolmuş, atlanıyor');
                            checkLocalStorageFallback();
                            return;
                        }
                        
                        const bearerToken = apiInfo.token.startsWith('Bearer ') ? apiInfo.token : 'Bearer ' + apiInfo.token;
                        
                        // Token uzunluğunu kontrol et - yeni token daha uzun olmalı (244 karakter)
                        const currentTokenValue = apiEndpoints.token ? apiEndpoints.token.substring(7).trim() : '';
                        
                        if (tokenValue.length > currentTokenValue.length || tokenValue !== currentTokenValue) {
                            apiEndpoints.token = bearerToken;
                            apiEndpoints.tokenExpiry = tokenExpiry;
                            apiEndpoints.warehouseId = apiInfo.warehouseId || apiEndpoints.warehouseId;
                            apiEndpoints.captured = true;
                            logDebounce.log('🔑 ✅ chrome.storage\'dan franchise token bulundu', {
                                tokenLength: tokenValue.length,
                                tokenExpiry: tokenExpiry ? new Date(tokenExpiry).toLocaleString('tr-TR') : 'N/A'
                            }, 'chrome_storage_token');
                            sendAPIInfoToCountingPage();
                        }
                        // Token zaten mevcut, log yazma (tekrar önleme)
                        return; // chrome.storage'dan bulduk, localStorage'a bakma
                    }
                }
                
                // chrome.storage'da yoksa localStorage'a fallback
                checkLocalStorageFallback();
            });
        } else {
            // chrome.storage yoksa direkt localStorage'a bak
            checkLocalStorageFallback();
        }
    }
    
    // localStorage fallback fonksiyonu
    function checkLocalStorageFallback() {
        try {
            // ÖNCE getir_api_info'dan oku (en güncel token burada)
            const apiInfoStr = localStorage.getItem('getir_api_info');
            if (apiInfoStr) {
                try {
                    const apiInfo = JSON.parse(apiInfoStr);
                    if (apiInfo.token) {
                        const tokenValue = apiInfo.token.startsWith('Bearer ') ? apiInfo.token.substring(7).trim() : apiInfo.token;
                        const tokenExpiry = apiInfo.tokenExpiry || getTokenExpiry(tokenValue);
                        
                        // Token geçerliliğini kontrol et
                        if (tokenExpiry && Date.now() >= (tokenExpiry - 5 * 60 * 1000)) {
                            console.warn('⚠️ localStorage\'daki getir_api_info token süresi dolmuş, atlanıyor');
                            return;
                        }
                        
                        const bearerToken = apiInfo.token.startsWith('Bearer ') ? apiInfo.token : 'Bearer ' + apiInfo.token;
                        const currentTokenValue = apiEndpoints.token ? apiEndpoints.token.substring(7).trim() : '';
                        
                        // Sadece yeni token daha uzunsa veya farklıysa güncelle
                        if (tokenValue.length > currentTokenValue.length || tokenValue !== currentTokenValue) {
                            apiEndpoints.token = bearerToken;
                            apiEndpoints.tokenExpiry = tokenExpiry;
                            apiEndpoints.warehouseId = apiInfo.warehouseId || apiEndpoints.warehouseId;
                            apiEndpoints.captured = true;
                            console.log('🔑 ✅ localStorage\'dan getir_api_info token bulundu:', tokenValue.substring(0, 30) + '... (uzunluk: ' + tokenValue.length + ')');
                            if (tokenExpiry) {
                                console.log('⏰ Token expiry:', new Date(tokenExpiry).toLocaleString('tr-TR'));
                            }
                            sendAPIInfoToCountingPage();
                            return; // getir_api_info'dan bulduk, diğerlerini kontrol etme
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ localStorage getir_api_info parse hatası:', e);
                }
            }
            
            // Fallback: localStorage'dan token ara (eski yöntem - sadece getir_api_info yoksa)
            // NOT: Bu sadece aynı origin'de çalışır, farklı origin'lerde çalışmaz
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || key === 'getir_api_info') continue; // getir_api_info'yu zaten kontrol ettik
                
                const value = localStorage.getItem(key);
                if (value && typeof value === 'string' && value.startsWith('eyJ') && value.length > 100) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('access') || lowerKey.includes('token')) {
                        const bearerToken = 'Bearer ' + value;
                        const tokenExpiry = getTokenExpiry(value);
                        
                        // Token geçerliliğini kontrol et
                        if (tokenExpiry && Date.now() >= (tokenExpiry - 5 * 60 * 1000)) {
                            console.warn('⚠️ localStorage\'daki eski token süresi dolmuş, atlanıyor:', key);
                            continue;
                        }
                        
                        // Sadece token yoksa veya farklıysa güncelle
                        const currentTokenValue = apiEndpoints.token ? apiEndpoints.token.substring(7).trim() : '';
                        if (value.length > currentTokenValue.length || value !== currentTokenValue) {
                            apiEndpoints.token = bearerToken;
                            apiEndpoints.tokenExpiry = tokenExpiry;
                            apiEndpoints.captured = true;
                            console.log('🔑 ✅ localStorage\'dan franchise token bulundu (fallback):', value.substring(0, 30) + '... (uzunluk: ' + value.length + ')');
                            if (tokenExpiry) {
                                console.log('⏰ Token expiry:', new Date(tokenExpiry).toLocaleString('tr-TR'));
                            }
                            sendAPIInfoToCountingPage();
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ localStorage kontrolü yapılamadı:', error);
        }
    }

    // localStorage setItem'i patch et (token kaydedildiğinde yakala)
    try {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            originalSetItem.apply(this, arguments);
            if (typeof value === 'string' && value.startsWith('eyJ') && value.length > 100) {
                const lowerKey = (key || '').toLowerCase();
                if (lowerKey.includes('access') || lowerKey.includes('token')) {
                    const bearerToken = 'Bearer ' + value;
                    const tokenExpiry = getTokenExpiry(value);
                    
                    // Token geçerliliğini kontrol et
                    if (tokenExpiry && Date.now() >= (tokenExpiry - 5 * 60 * 1000)) {
                        console.warn('⚠️ Kaydedilen token süresi dolmuş, atlanıyor');
                        return;
                    }
                    
                    if (!apiEndpoints.token || apiEndpoints.token !== bearerToken) {
                        apiEndpoints.token = bearerToken;
                        apiEndpoints.tokenExpiry = tokenExpiry;
                        apiEndpoints.captured = true;
                        console.log('🔑 ✅ localStorage\'a franchise token kaydedildi:', value.substring(0, 30) + '... (uzunluk: ' + value.length + ')');
                        if (tokenExpiry) {
                            console.log('⏰ Token expiry:', new Date(tokenExpiry).toLocaleString('tr-TR'));
                        }
                        sendAPIInfoToCountingPage();
                    }
                }
            }
        };
    } catch (error) {
        console.warn('⚠️ localStorage patch edilemedi:', error);
    }

    // Sayfa yüklendiğinde localStorage'dan token kontrol et
    // ÖNCE getir_api_info'dan oku (en güncel token), sonra diğerlerini kontrol et
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        checkLocalStorageForToken();
        console.log('✅ Sayfa hazır, franchise token yakalama aktif');
    } else {
        window.addEventListener('load', () => {
            checkLocalStorageForToken();
            console.log('✅ Sayfa yüklendi, franchise token yakalama aktif');
        });
        document.addEventListener('DOMContentLoaded', () => {
            checkLocalStorageForToken();
            console.log('✅ DOM hazır, franchise token yakalama aktif');
        });
    }

    // WebRequest'ten token yakalandığında, eski token'ları override et
    // Bu sayede yeni token her zaman öncelikli olur

    // Periyodik olarak localStorage'dan token kontrol et (her 2 saniyede bir - fallback)
    setInterval(() => {
        checkLocalStorageForToken();
        if (apiEndpoints.captured && apiEndpoints.token) {
            sendAPIInfoToCountingPage();
        }
        // Token yoksa log yazma (tekrar önleme)
    }, 2000); // 2 saniyede bir kontrol et
    
    // Sayfa yüklendikten sonra da API çağrılarını dinle (fallback)
    // Eğer sayfa yüklenirken API çağrıları kaçırıldıysa, sayfa yüklendikten sonra da dinle
    window.addEventListener('load', () => {
        logDebounce.log('📄 Sayfa yüklendi, fallback mekanizması aktif', null, 'page_loaded');
        
        // Mevcut durumu kontrol et
        if (!apiEndpoints.token) {
            logDebounce.log('⚠️ Sayfa yüklendi ama token henüz yakalanmadı', null, 'token_missing');
        } else {
            sendAPIInfoToCountingPage();
        }
    });
    
    // MutationObserver ile dinamik script'leri yakala (fallback)
    try {
        const observer = new MutationObserver((mutations) => {
            // Script tag'leri eklendiğinde kontrol et
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === 'SCRIPT' && node.src) {
                        const src = node.src;
                        if (src.includes('getirapi.com') || src.includes('getir.com')) {
                            console.log('🔍 Yeni Getir script yüklendi:', src);
                        }
                    }
                });
            });
        });
        
        // DOM'a observer ekle
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            console.log('👁️ MutationObserver aktif (dinamik scriptler için)');
        } else {
            // Body henüz yoksa, DOMContentLoaded'da ekle
            document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                console.log('👁️ MutationObserver aktif (DOMContentLoaded sonrası)');
            });
        }
    } catch (error) {
        console.warn('⚠️ MutationObserver eklenemedi:', error);
    }

    // Artık kullanılmıyor - API çağrıları counting.js'de yapılacak
    // Bu fonksiyonlar kaldırıldı çünkü manuel arama yapmayacağız
    // Tüm manuel arama fonksiyonları kaldırıldı - sadece token yakalama yapılıyor

    // Message handler - background script veya diğer script'lerden API bilgilerini isteyebilir
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'GET_API_INFO') {
            const apiInfo = {
                baseUrl: apiEndpoints.baseUrl,
                stockEndpoint: apiEndpoints.stock,
                token: apiEndpoints.token,
                warehouseId: apiEndpoints.warehouseId || '5dcafe6ae2c61b1e52cf1704', // Default warehouse ID
                headers: apiEndpoints.headers,
                timestamp: Date.now(),
                tokenExpiry: apiEndpoints.tokenExpiry
            };
            
            sendResponse({
                success: true,
                apiInfo: apiInfo
            });
            return true; // Async response
        }
        
        // Background script'ten token yakalama mesajı
        if (request.type === 'TOKEN_CAPTURED') {
            if (request.token) {
                const token = request.token.startsWith('Bearer ') ? request.token : 'Bearer ' + request.token;
                const tokenValue = token.substring(7).trim();
                
                // Mevcut token ile karşılaştır - eğer yeni token daha uzunsa veya farklıysa güncelle
                const currentTokenValue = apiEndpoints.token ? apiEndpoints.token.substring(7).trim() : '';
                
                if (tokenValue.length > currentTokenValue.length || tokenValue !== currentTokenValue) {
                    // Token'ı kaydet
                    apiEndpoints.token = token;
                    apiEndpoints.tokenExpiry = request.tokenExpiry || getTokenExpiry(tokenValue);
                    apiEndpoints.captured = true;
                    
                    logDebounce.log('🔑 ✅ Token webRequest API ile yakalandı ve güncellendi', {
                        tokenLength: tokenValue.length,
                        tokenExpiry: apiEndpoints.tokenExpiry ? new Date(apiEndpoints.tokenExpiry).toLocaleString('tr-TR') : 'N/A'
                    }, 'token_captured');
                    
                    // Warehouse ID varsa kaydet
                    if (request.warehouseId) {
                        apiEndpoints.warehouseId = request.warehouseId;
                        logDebounce.log('🏭 Warehouse ID kaydedildi', { warehouseId: apiEndpoints.warehouseId }, 'warehouse_captured');
                    }
                    
                    // API bilgilerini localStorage'a kaydet (ESKİ TOKEN'LARI OVERRIDE EDECEK)
                    sendAPIInfoToCountingPage();
                }
                // Token zaten mevcut, log yazma (tekrar önleme)
                
                sendResponse({ success: true });
                return true;
            }
            
            sendResponse({ success: false, error: 'Token bulunamadı' });
            return true;
        }
        
        // Background script'ten warehouse ID yakalama mesajı
        if (request.type === 'WAREHOUSE_ID_CAPTURED') {
            if (request.warehouseId) {
                if (!apiEndpoints.warehouseId || apiEndpoints.warehouseId !== request.warehouseId) {
                    apiEndpoints.warehouseId = request.warehouseId;
                    logDebounce.log('🏭 ✅ Warehouse ID webRequest API ile yakalandı', { warehouseId: apiEndpoints.warehouseId }, 'warehouse_captured');
                    
                    // API bilgilerini localStorage'a kaydet
                    sendAPIInfoToCountingPage();
                }
                // Warehouse ID zaten mevcut, log yazma (tekrar önleme)
                
                sendResponse({ success: true });
                return true;
            }
            
            sendResponse({ success: false, error: 'Warehouse ID bulunamadı' });
            return true;
        }
        
        return false;
    });

    // Window'a extension helper fonksiyonları ekle (counting.html için)
    // Bu sayede counting.html extension'a erişebilir
    if (typeof window !== 'undefined') {
        window.getirExtensionHelper = {
            getAPIInfo: function() {
                return new Promise((resolve, reject) => {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage(
                            { type: 'GET_API_INFO' },
                            (response) => {
                                if (chrome.runtime.lastError) {
                                    reject(new Error(chrome.runtime.lastError.message));
                                } else if (response && response.success) {
                                    resolve(response.apiInfo);
                                } else {
                                    reject(new Error(response?.error || 'API bilgileri alınamadı'));
                                }
                            }
                        );
                    } else {
                        // Fallback: localStorage'dan oku
                        const apiInfoStr = localStorage.getItem('getir_api_info');
                        if (apiInfoStr) {
                            try {
                                resolve(JSON.parse(apiInfoStr));
                            } catch (e) {
                                reject(new Error('localStorage parse hatası'));
                            }
                        } else {
                            reject(new Error('API bilgileri bulunamadı'));
                        }
                    }
                });
            },
            isAvailable: function() {
                return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
            }
        };
        console.log('✅ Extension helper fonksiyonları window.getirExtensionHelper olarak eklendi');
    }

    console.log('✅ Getir Stok Senkronizasyonu extension hazır (Franchise Token & Warehouse ID Yakalama)');
    console.log('💡 Token ve Warehouse ID yakalandığında localStorage\'a kaydedilecek ve counting.js tarafından kullanılacak');
    console.log('🏭 Warehouse ID otomatik olarak request body ve response\'dan yakalanacak');
    console.log('🔧 Extension helper: window.getirExtensionHelper.getAPIInfo() ile API bilgilerine erişebilirsiniz');
})();
