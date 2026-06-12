// Background script for Getir Stock Sync Extension
// Supabase'den stok isteklerini dinler ve content script'e yönlendirir

import { handleFetchExpiryProducts } from './expiry-fetch.js';

console.log('✅ Background script yüklendi');

// Token ve warehouse ID yakalama için webRequest listener
// Bu browser seviyesinde çalışır, sayfa script'lerinden bağımsız
// OPTİMİZE EDİLDİ: Sadece token yoksa veya geçersizse aktif çalışır
let backgroundTokenState = {
    token: null,
    tokenExpiry: null,
    passiveMode: false
};

// Token geçerliliğini kontrol et
function isTokenValidInBackground(tokenExpiry) {
    if (!tokenExpiry) return false;
    const now = Date.now();
    // 5 dakika önceden expire olmuş say (güvenlik için)
    return now < (tokenExpiry - 5 * 60 * 1000);
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // SADECE franchise.getir.com'dan gelen istekleri işle (warehouse.getir.com vb. hariç)
        const initiator = details.initiator || '';
        if (!initiator.startsWith('https://franchise.getir.com')) {
            return; // franchise.getir.com dışındaki sayfalardan gelen istekleri yoksay
        }
        
        // Pasif modda ve token geçerliyse, sessizce çalış (log yazma)
        if (backgroundTokenState.passiveMode && backgroundTokenState.token && isTokenValidInBackground(backgroundTokenState.tokenExpiry)) {
            return; // Pasif modda, sadece sessizce dinle
        }
        
        // Sadece Getir franchise API çağrılarını dinle
        if (details.url.includes('getirapi.com') || details.url.includes('franchise-api-gateway.getirapi.com')) {
            const headers = details.requestHeaders || [];
            
            // Authorization header'ını bul
            const authHeader = headers.find(h => 
                h.name && h.name.toLowerCase() === 'authorization'
            );
            
            if (authHeader && authHeader.value && authHeader.value.startsWith('Bearer ')) {
                const token = authHeader.value.substring(7).trim();
                
                // JWT token kontrolü
                if (token.startsWith('eyJ') && token.length > 100) {
                    // Token değiştiyse veya ilk kez yakalanıyorsa
                    if (!backgroundTokenState.token || backgroundTokenState.token !== authHeader.value) {
                        // Token expiry'yi hesapla
                        let tokenExpiry = null;
                        try {
                            const parts = token.split('.');
                            if (parts.length === 3) {
                                const payload = parts[1];
                                const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
                                const decoded = JSON.parse(atob(padded));
                                if (decoded.exp) {
                                    tokenExpiry = decoded.exp * 1000;
                                }
                            }
                        } catch (e) {
                            // Silent fail
                        }
                        
                        // Token'ı kaydet ve pasif moda geç
                        backgroundTokenState.token = authHeader.value;
                        backgroundTokenState.tokenExpiry = tokenExpiry;
                        backgroundTokenState.passiveMode = true;
                    
                        // Warehouse ID'yi request body'den çıkarmaya çalış (POST ise)
                        let warehouseId = null;
                        if (details.method === 'POST' && details.requestBody) {
                            try {
                                const body = details.requestBody.formData || details.requestBody.raw;
                                if (body) {
                                    // Request body'yi parse etmek için content script'e göndermemiz gerekebilir
                                    // Şimdilik sadece token'ı gönderelim
                                }
                            } catch (e) {
                                // Request body parse edilemedi
                            }
                        }
                        
                        // Franchise sayfasına token'ı gönder (sadece token değiştiyse)
                        chrome.tabs.query({ url: 'https://franchise.getir.com/*' }, (tabs) => {
                            if (tabs && tabs.length > 0) {
                                tabs.forEach(tab => {
                                    chrome.tabs.sendMessage(tab.id, {
                                        type: 'TOKEN_CAPTURED',
                                        token: authHeader.value, // Bearer token olarak
                                        tokenExpiry: tokenExpiry,
                                        url: details.url,
                                        warehouseId: warehouseId
                                    }).catch(err => {
                                        // Content script henüz yüklenmemiş olabilir, retry yap
                                        setTimeout(() => {
                                            chrome.tabs.sendMessage(tab.id, {
                                                type: 'TOKEN_CAPTURED',
                                                token: authHeader.value,
                                                tokenExpiry: tokenExpiry,
                                                url: details.url,
                                                warehouseId: warehouseId
                                            }).catch(() => {
                                                // Silent fail - content script yüklenene kadar bekleyecek
                                            });
                                        }, 1000);
                                    });
                                });
                            }
                        });
                        
                        // chrome.storage'a da kaydet (hemen erişilebilir olsun)
                        chrome.storage.local.set({
                            'getir_api_info': {
                                token: authHeader.value,
                                tokenExpiry: tokenExpiry,
                                warehouseId: warehouseId,
                                timestamp: Date.now(),
                                baseUrl: 'https://franchise-api-gateway.getirapi.com',
                                stockEndpoint: 'https://franchise-api-gateway.getirapi.com/stocks'
                            }
                        });
                    } else {
                        // Token zaten mevcut, pasif moda geç
                        if (!backgroundTokenState.passiveMode) {
                            backgroundTokenState.passiveMode = true;
                        }
                    }
                }
            }
        }
    },
    {
        urls: [
            'https://franchise-api-gateway.getirapi.com/*',
            'https://*.getirapi.com/*'
        ]
    },
    ['requestHeaders']
);

// Response'dan warehouse ID yakalama için onCompleted listener
// OPTİMİZE EDİLDİ: Pasif modda sadece sessizce çalışır
// SADECE franchise.getir.com'dan gelen istekler işlenir
chrome.webRequest.onCompleted.addListener(
    (details) => {
        // SADECE franchise.getir.com'dan gelen istekleri işle
        const initiator = details.initiator || '';
        if (!initiator.startsWith('https://franchise.getir.com')) {
            return;
        }
        
        // Pasif modda ve token geçerliyse, sessizce çalış (log yazma)
        if (backgroundTokenState.passiveMode && backgroundTokenState.token && isTokenValidInBackground(backgroundTokenState.tokenExpiry)) {
            return; // Pasif modda, sadece sessizce dinle
        }
        
        // Sadece Getir franchise API çağrılarını dinle ve başarılı response'ları yakala
        if ((details.url.includes('getirapi.com') || details.url.includes('franchise-api-gateway.getirapi.com')) 
            && details.statusCode === 200) {
            
            // Response body'yi almak için fetch yap (CORS sorunu olmayacak çünkü extension'dan)
            fetch(details.url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            }).then(response => {
                if (response.ok) {
                    return response.json();
                }
                return null;
            }).then(data => {
                if (data) {
                    let warehouseId = null;
                    
                    // Warehouse ID'yi response'dan çıkar
                    if (Array.isArray(data) && data.length > 0 && data[0].warehouse) {
                        warehouseId = data[0].warehouse;
                    } else if (data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].warehouse) {
                        warehouseId = data.data[0].warehouse;
                    } else if (data.warehouse) {
                        warehouseId = data.warehouse;
                    }
                    
                    if (warehouseId) {
                        // Pasif modda log yazma
                        if (!backgroundTokenState.passiveMode) {
                            console.log('🏭 ✅ Warehouse ID yakalandı (webRequest response):', warehouseId);
                        }
                        
                        // Franchise sayfasına warehouse ID'yi gönder
                        chrome.tabs.query({ url: 'https://franchise.getir.com/*' }, (tabs) => {
                            if (tabs && tabs.length > 0) {
                                tabs.forEach(tab => {
                                    chrome.tabs.sendMessage(tab.id, {
                                        type: 'WAREHOUSE_ID_CAPTURED',
                                        warehouseId: warehouseId
                                    }).catch(err => {
                                        // Content script henüz yüklenmemiş olabilir
                                    });
                                });
                            }
                        });
                    }
                }
            }).catch(err => {
                // Response okunamadı, sorun değil
            });
        }
    },
    {
        urls: [
            'https://franchise-api-gateway.getirapi.com/*',
            'https://*.getirapi.com/*'
        ]
    }
);

console.log('✅ webRequest listener eklendi (token ve warehouse ID yakalama için)');

// Supabase client (extension içinde kullanmak için)
let supabaseClient = null;

// Supabase configuration
const SUPABASE_URL = 'https://ytekbbxvfdheiexsojpx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZWtiYnh2ZmRoZWlleHNvanB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMTgzMDcsImV4cCI6MjA3Mzg5NDMwN30.J4jvfRg2j6UOumDSqOyvYs3Iza8VX0SnNU_7wE41Tdg';

// Supabase REST API helper functions
async function supabaseQuery(table, method = 'GET', body = null, filters = {}, queryOptions = {}) {
    try {
        let url = `${SUPABASE_URL}/rest/v1/${table}`;
        
        const queryParams = [];
        
        // Add filters to URL
        if (Object.keys(filters).length > 0) {
            Object.entries(filters).forEach(([key, value]) => {
                queryParams.push(`${key}=eq.${encodeURIComponent(value)}`);
            });
        }
        
        // Add order
        if (queryOptions.orderBy) {
            queryParams.push(`order=${queryOptions.orderBy}.${queryOptions.orderAsc ? 'asc' : 'desc'}`);
        }
        
        // Add limit
        if (queryOptions.limit) {
            queryParams.push(`limit=${queryOptions.limit}`);
        }
        
        if (queryParams.length > 0) {
            url += `?${queryParams.join('&')}`;
        }
        
        const fetchOptions = {
            method: method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };
        
        if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            fetchOptions.body = JSON.stringify(body);
        }
        
        console.log(`🌐 Supabase ${method} isteği:`, url, body ? JSON.stringify(body) : '');
        
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            const errorText = await response.text();
            let error;
            try {
                error = JSON.parse(errorText);
            } catch {
                error = { message: errorText };
            }
            console.error(`❌ Supabase ${method} hatası:`, response.status, error);
            throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        if (method === 'DELETE') {
            return null;
        }
        
        const result = await response.json();
        console.log(`✅ Supabase ${method} başarılı:`, Array.isArray(result) ? `${result.length} kayıt` : '1 kayıt');
        return result;
    } catch (error) {
        console.error('❌ Supabase query error:', error);
        throw error;
    }
}

// Supabase helper functions
const supabase = {
    from: (table) => ({
        select: (columns = '*') => ({
            eq: (column, value) => ({
                maybeSingle: async () => {
                    const filters = {};
                    filters[column] = value;
                    const result = await supabaseQuery(table, 'GET', null, filters);
                    return result && result.length > 0 ? result[0] : null;
                },
                single: async () => {
                    const filters = {};
                    filters[column] = value;
                    const result = await supabaseQuery(table, 'GET', null, filters);
                    if (!result || result.length === 0) {
                        throw new Error('No rows found');
                    }
                    return result[0];
                },
                order: (column, options = {}) => ({
                    limit: async (count) => {
                        const filters = {};
                        filters[column] = value;
                        // Note: Order and limit would need to be added to URL
                        const result = await supabaseQuery(table, 'GET', null, filters);
                        return result || [];
                    }
                })
            }),
            maybeSingle: async () => {
                const result = await supabaseQuery(table, 'GET');
                return result && result.length > 0 ? result[0] : null;
            }
        }),
        insert: async (data) => {
            const result = await supabaseQuery(table, 'POST', Array.isArray(data) ? data : [data]);
            return { data: result, error: null };
        },
        update: (data) => ({
            eq: (column, value) => ({
                then: async (callback) => {
                    const filters = {};
                    filters[column] = value;
                    const result = await supabaseQuery(table, 'PATCH', data, filters);
                    if (callback) {
                        return callback({ data: result, error: null });
                    }
                    return { data: result, error: null };
                }
            })
        })
    })
};

supabaseClient = supabase;
console.log('✅ Supabase REST API helper initialized');

// chrome.storage değişikliklerini dinle
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        // Stok isteği geldi mi kontrol et
        if (changes.getir_stock_request) {
            const request = changes.getir_stock_request.newValue;
            if (request) {
                console.log('📦 Stok isteği alındı (background):', request);
                handleStockRequest(request.barcode, request.productName, request.requestId)
                    .catch(error => {
                        console.error('❌ Stok isteği işlenirken hata:', error);
                    });
            }
        }
        
        // API isteği geldi mi kontrol et
        if (changes.getir_api_request) {
            const request = changes.getir_api_request.newValue;
            if (request) {
                console.log('🌐 API isteği alındı (background):', request);
                handleAPIRequest(request.apiInfo, request.barcode, request.productName, request.requestId)
                    .catch(error => {
                        console.error('❌ API isteği işlenirken hata:', error);
                    });
            }
        }
    }
});

// Supabase'den pending istekleri kontrol et - SADECE SAYFA YÜKLENDİĞİNDE BİRKAÇ KERE
// setInterval KALDIRILDI - Güvenlik nedeniyle sürekli polling yapılmıyor
let pollingActive = false;
let pollingAttempts = 0;
const maxPollingAttempts = 3; // İlk yüklemede sadece 3 kere çalış

async function checkSupabaseRequests() {
    if (pollingActive) return; // Prevent overlapping polls
    if (pollingAttempts >= maxPollingAttempts) return; // Maksimum deneme sayısına ulaşıldı
    
    pollingActive = true;
    pollingAttempts++;
    
    try {
        if (!supabaseClient) {
            // Supabase yoksa chrome.storage'ı kontrol et (fallback)
            const storage = await chrome.storage.local.get(['getir_stock_request', 'getir_api_request']);
            
            if (storage.getir_stock_request && !storage.getir_stock_request._processing) {
                const request = storage.getir_stock_request;
                storage.getir_stock_request._processing = true;
                await chrome.storage.local.set({ getir_stock_request: storage.getir_stock_request });
                
                // Sadece hata durumunda log yaz
                handleStockRequest(request.barcode, request.productName, request.requestId)
                    .catch(error => {
                        console.error('❌ Stok isteği işlenirken hata:', error);
                    });
            }
            pollingActive = false;
            return;
        }

        // Supabase'den tüm kullanıcıların pending isteklerini al
        const allUsersData = await supabaseQuery('stock_requests', 'GET', null, {}, {
            orderBy: 'updated_at',
            orderAsc: true
        });

        if (!allUsersData || !Array.isArray(allUsersData)) {
            pollingActive = false;
            return;
        }

        // Tüm kullanıcıların pending isteklerini topla
        const allPendingRequests = [];
        for (const userData of allUsersData) {
            if (userData.requests && Array.isArray(userData.requests.pending) && userData.requests.pending.length > 0) {
                for (const request of userData.requests.pending) {
                    allPendingRequests.push({
                        ...request,
                        username: userData.username
                    });
                }
            }
        }

        if (allPendingRequests.length > 0) {
            // Sadece istek varsa log yaz
            console.log(`📦 ${allPendingRequests.length} pending istek bulundu`);
            
            // İlk 10 isteği işle (limit)
            const requestsToProcess = allPendingRequests.slice(0, 10);
            
            for (const request of requestsToProcess) {
                try {
                    // İsteği pending'den processing'e taşı
                    await moveRequestToProcessing(request.username, request.request_id);
                    
                    // İsteği işle
                    await handleStockRequestFromSupabase(request);
                } catch (error) {
                    console.error('❌ Stok isteği işlenirken hata:', error);
                    // Hata durumunda processing'den failed'e taşı
                    try {
                        await moveRequestToFailed(request.username, request.request_id, error.message);
                    } catch (updateError) {
                        console.error('❌ Status güncelleme hatası:', updateError);
                    }
                }
            }
        }
    } catch (error) {
        // Sadece kritik hatalarda log yaz
        if (error.message && !error.message.includes('network')) {
        console.error('❌ Error checking Supabase:', error);
        }
    } finally {
        pollingActive = false;
    }
}

// Extension yüklendiğinde veya başlatıldığında birkaç kere çalıştır
chrome.runtime.onInstalled.addListener(() => {
    // İlk yüklemede hemen çalıştır
    checkSupabaseRequests();
    // 2 saniye sonra tekrar çalıştır
    setTimeout(() => checkSupabaseRequests(), 2000);
    // 4 saniye sonra son kez çalıştır
    setTimeout(() => checkSupabaseRequests(), 4000);
});

chrome.runtime.onStartup.addListener(() => {
    // Extension başlatıldığında da aynı şekilde
    pollingAttempts = 0; // Deneme sayacını sıfırla
    checkSupabaseRequests();
    setTimeout(() => checkSupabaseRequests(), 2000);
    setTimeout(() => checkSupabaseRequests(), 4000);
});

// İlk yüklemede de çalıştır (background script yüklendiğinde)
checkSupabaseRequests();
setTimeout(() => checkSupabaseRequests(), 2000);
setTimeout(() => checkSupabaseRequests(), 4000);

// Cleanup mekanizması - eski completed/failed istekleri temizle
// OPTİMİZE EDİLDİ: Log'lar kaldırıldı - sessizce çalışır
setInterval(async () => {
    try {
        // Log yazma - sessizce çalış
        const allUsersData = await supabaseQuery('stock_requests', 'GET', null, {});
        
        if (allUsersData && Array.isArray(allUsersData)) {
            for (const userData of allUsersData) {
                if (userData.requests) {
                    const requests = userData.requests;
                    let updated = false;
                    
                    // Completed array'inden 1 saatten eski istekleri temizle
                    if (Array.isArray(requests.completed)) {
                        const beforeCount = requests.completed.length;
                        requests.completed = requests.completed.filter(r => {
                            if (!r.completed_at) return true; // completed_at yoksa tut
                            const completedTime = new Date(r.completed_at);
                            return completedTime > new Date(Date.now() - 60 * 60 * 1000); // 1 saat
                        });
                        if (requests.completed.length !== beforeCount) {
                            updated = true;
                            // Log yazma - sessizce çalış
                        }
                    }
                    
                    // Failed array'inden 1 saatten eski istekleri temizle
                    if (Array.isArray(requests.failed)) {
                        const beforeCount = requests.failed.length;
                        requests.failed = requests.failed.filter(r => {
                            if (!r.created_at && !r.failed_at) return true;
                            const failedTime = new Date(r.failed_at || r.created_at);
                            return failedTime > new Date(Date.now() - 60 * 60 * 1000); // 1 saat
                        });
                        if (requests.failed.length !== beforeCount) {
                            updated = true;
                            // Log yazma - sessizce çalış
                        }
                    }
                    
                    // Eğer güncelleme varsa Supabase'e yaz
                    if (updated) {
                        await supabaseQuery('stock_requests', 'PATCH', { requests: requests }, { username: userData.username });
                    }
                }
            }
        }
    } catch (error) {
        // Sadece kritik hatalarda log yaz
        if (error.message && !error.message.includes('network')) {
        console.error('❌ Cleanup hatası:', error);
        }
    }
}, 5 * 60 * 1000); // Her 5 dakikada bir cleanup yap

// Log yazma - sessizce başlat

// Message listener - content script'ten veya counting.html'den gelen mesajları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // GET_API_INFO - chrome.storage'dan API bilgilerini oku ve döndür
    if (request.type === 'GET_API_INFO') {
        chrome.storage.local.get(['getir_api_info'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('❌ chrome.storage okuma hatası (GET_API_INFO):', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            
            const apiInfo = result.getir_api_info;
            if (apiInfo) {
                console.log('✅ API bilgileri chrome.storage\'dan alındı (background):', {
                    hasToken: !!apiInfo.token,
                    warehouseId: apiInfo.warehouseId,
                    stockEndpoint: apiInfo.stockEndpoint
                });
                sendResponse({ success: true, apiInfo: apiInfo });
            } else {
                console.log('ℹ️ chrome.storage\'da API bilgileri bulunamadı');
                sendResponse({ success: false, error: 'API bilgileri bulunamadı. Lütfen Getir franchise sayfasını açın ve sayfayı yenileyin.' });
            }
        });
        return true; // Async response - channel'ı açık tut
    }
    
    if (request.type === 'GET_STOCK_BY_BARCODE') {
        handleStockRequest(request.barcode, request.productName, Date.now().toString())
            .then(stock => {
                try {
                    sendResponse({ success: true, stock: stock });
                } catch (error) {
                    console.error('❌ sendResponse hatası (GET_STOCK_BY_BARCODE):', error);
                }
            })
            .catch(error => {
                try {
                    sendResponse({ success: false, error: error.message });
                } catch (responseError) {
                    console.error('❌ sendResponse hatası (GET_STOCK_BY_BARCODE error):', responseError);
                }
            });
        return true; // Async response - channel'ı açık tut
    }
    
    if (request.type === 'GET_STOCK_FROM_API') {
        handleAPIRequest(request.apiInfo, request.barcode, request.productName, Date.now().toString())
            .then(stock => {
                try {
                    sendResponse({ success: true, stock: stock });
                } catch (error) {
                    console.error('❌ sendResponse hatası (GET_STOCK_FROM_API):', error);
                }
            })
            .catch(error => {
                try {
                    sendResponse({ success: false, error: error.message });
                } catch (responseError) {
                    console.error('❌ sendResponse hatası (GET_STOCK_FROM_API error):', responseError);
                }
            });
        return true; // Async response - channel'ı açık tut
    }

    if (request.type === 'FETCH_EXPIRY_PRODUCTS') {
        handleFetchExpiryProducts(request, sendResponse, sender).catch((error) => {
            console.error('❌ SKT fetch hatası:', error);
            try {
                sendResponse({ success: false, error: error.message || 'SKT alınamadı' });
            } catch (e) {
                /* channel closed */
            }
        });
        return true;
    }
    
    // Eşleşmeyen mesajlar için false döndür (synchronous response)
    return false;
});

// İsteği pending'den processing'e taşı
async function moveRequestToProcessing(username, requestId) {
    const userDataArray = await supabaseQuery('stock_requests', 'GET', null, { username: username });
    
    if (!userDataArray || !Array.isArray(userDataArray) || userDataArray.length === 0) {
        throw new Error('Kullanıcı verisi bulunamadı');
    }
    
    const userData = userDataArray[0];
    const requests = userData.requests || { pending: [], processing: [], completed: [], failed: [] };
    
    // İsteği pending'den bul ve processing'e taşı
    const pendingIndex = requests.pending.findIndex(r => r.request_id === requestId);
    if (pendingIndex === -1) {
        throw new Error('İstek pending array\'inde bulunamadı');
    }
    
    const request = requests.pending[pendingIndex];
    requests.pending.splice(pendingIndex, 1);
    
    if (!Array.isArray(requests.processing)) {
        requests.processing = [];
    }
    requests.processing.push({
        ...request,
        status: 'processing',
        processing_started_at: new Date().toISOString()
    });
    
    await supabaseQuery('stock_requests', 'PATCH', { requests: requests }, { username: username });
}

// İsteği processing'den completed'e taşı
async function moveRequestToCompleted(username, requestId, stockValue) {
    const userDataArray = await supabaseQuery('stock_requests', 'GET', null, { username: username });
    
    if (!userDataArray || !Array.isArray(userDataArray) || userDataArray.length === 0) {
        throw new Error('Kullanıcı verisi bulunamadı');
    }
    
    const userData = userDataArray[0];
    const requests = userData.requests || { pending: [], processing: [], completed: [], failed: [] };
    
    // İsteği processing'den bul ve completed'e taşı
    const processingIndex = requests.processing.findIndex(r => r.request_id === requestId);
    if (processingIndex === -1) {
        throw new Error('İstek processing array\'inde bulunamadı');
    }
    
    const request = requests.processing[processingIndex];
    requests.processing.splice(processingIndex, 1);
    
    if (!Array.isArray(requests.completed)) {
        requests.completed = [];
    }
    requests.completed.push({
        ...request,
        status: 'completed',
        stock_value: stockValue,
        completed_at: new Date().toISOString()
    });
    
    await supabaseQuery('stock_requests', 'PATCH', { requests: requests }, { username: username });
}

// İsteği processing'den failed'e taşı
async function moveRequestToFailed(username, requestId, errorMessage) {
    const userDataArray = await supabaseQuery('stock_requests', 'GET', null, { username: username });
    
    if (!userDataArray || !Array.isArray(userDataArray) || userDataArray.length === 0) {
        throw new Error('Kullanıcı verisi bulunamadı');
    }
    
    const userData = userDataArray[0];
    const requests = userData.requests || { pending: [], processing: [], completed: [], failed: [] };
    
    // İsteği processing'den bul ve failed'e taşı
    let request = null;
    let foundIndex = -1;
    
    const processingIndex = requests.processing.findIndex(r => r.request_id === requestId);
    if (processingIndex !== -1) {
        request = requests.processing[processingIndex];
        requests.processing.splice(processingIndex, 1);
    } else {
        // Eğer processing'de yoksa, pending'den direkt failed'e taşı
        const pendingIndex = requests.pending.findIndex(r => r.request_id === requestId);
        if (pendingIndex !== -1) {
            request = requests.pending[pendingIndex];
            requests.pending.splice(pendingIndex, 1);
        } else {
            throw new Error('İstek bulunamadı');
        }
    }
    
    if (!Array.isArray(requests.failed)) {
        requests.failed = [];
    }
    requests.failed.push({
        ...request,
        status: 'failed',
        error_message: errorMessage,
        failed_at: new Date().toISOString()
    });
    
    await supabaseQuery('stock_requests', 'PATCH', { requests: requests }, { username: username });
}

// Supabase'den gelen stok isteğini işle
async function handleStockRequestFromSupabase(request) {
    try {
        console.log('🔄 Stok isteği işleniyor:', {
            request_id: request.request_id,
            barcode: request.barcode,
            product_name: request.product_name,
            username: request.username
        });
        
        const stock = await handleStockRequest(request.barcode, request.product_name, request.request_id);
        
        console.log('✅ Stok değeri alındı:', stock);
        
        // Sonucu Supabase'e yaz (processing'den completed'e taşı)
        await moveRequestToCompleted(request.username, request.request_id, stock);
        
        console.log('✅ Stok isteği tamamlandı ve Supabase\'e yazıldı:', request.request_id, 'Stock:', stock);
        return stock;
    } catch (error) {
        console.error('❌ Stok isteği işlenirken hata:', error);
        // Hata durumunda processing'den failed'e taşı
        try {
            await moveRequestToFailed(request.username, request.request_id, error.message);
            console.log('❌ Hata durumu Supabase\'e yazıldı');
        } catch (updateError) {
            console.error('❌ Status güncelleme hatası:', updateError);
        }
        
        throw error;
    }
}

// Stok isteğini işle (API çağrısı - sayfa üzerinden arama YOK!)
async function handleStockRequest(barcode, productName, requestId) {
    try {
        // Franchise sayfasını bul (API bilgilerini almak için)
        const tabs = await chrome.tabs.query({ url: 'https://franchise.getir.com/stock/current' });
        
        if (tabs.length === 0) {
            throw new Error('Getir franchise sayfası açık değil. Lütfen https://franchise.getir.com/stock/current sayfasını açın ve sayfayı yenileyin.');
        }
        
        // Content script'ten API bilgilerini al
        let apiInfo = null;
        try {
            const apiInfoResult = await chrome.tabs.sendMessage(tabs[0].id, {
                type: 'GET_API_INFO'
            });
            if (apiInfoResult && apiInfoResult.success && apiInfoResult.apiInfo) {
                apiInfo = apiInfoResult.apiInfo;
                console.log('✅ API bilgileri alındı:', {
                    endpoint: apiInfo.stockEndpoint,
                    hasToken: !!apiInfo.token
                });
            }
        } catch (error) {
            console.warn('⚠️ API bilgileri alınamadı:', error);
        }
        
        // Eğer API bilgileri yoksa hata döndür
        if (!apiInfo || !apiInfo.token || !apiInfo.stockEndpoint) {
            throw new Error('API bilgileri bulunamadı. Lütfen Getir franchise sayfasını açın ve sayfayı yenileyin. Extension API endpoint\'ini ve token\'ı yakalayacaktır.');
        }
        
        // Content script'e API çağrısı yapması için mesaj gönder (SADECE API - sayfa üzerinden arama YOK!)
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'GET_STOCK_FROM_API',
            apiInfo: apiInfo,
            barcode: barcode,
            productName: productName,
            requestId: requestId
        });
        
        if (response && response.success) {
            // Sonucu chrome.storage'a yaz
            const responseKey = 'getir_stock_response_' + requestId;
            await chrome.storage.local.set({
                [responseKey]: {
                    success: true,
                    stock: response.stock,
                    timestamp: Date.now()
                }
            });
            
            // İsteği temizle
            await chrome.storage.local.remove('getir_stock_request');
            
            return response.stock;
        } else {
            throw new Error(response?.error || 'Stok alınamadı');
        }
    } catch (error) {
        console.error('Error handling stock request:', error);
        
        // Hata sonucunu chrome.storage'a yaz
        const responseKey = 'getir_stock_response_' + requestId;
        await chrome.storage.local.set({
            [responseKey]: {
                success: false,
                error: error.message,
                timestamp: Date.now()
            }
        });
        
        // İsteği temizle
        await chrome.storage.local.remove('getir_stock_request');
        
        throw error;
    }
}

// API isteğini işle
async function handleAPIRequest(apiInfo, barcode, productName, requestId) {
    try {
        // Franchise sayfasını bul
        const tabs = await chrome.tabs.query({ url: 'https://franchise.getir.com/stock/current' });
        
        if (tabs.length === 0) {
            throw new Error('Getir franchise sayfası açık değil. Lütfen https://franchise.getir.com/stock/current sayfasını açın.');
        }
        
        // Content script'e mesaj gönder
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'GET_STOCK_FROM_API',
            apiInfo: apiInfo,
            barcode: barcode,
            productName: productName,
            requestId: requestId
        });
        
        if (response && response.success) {
            // Sonucu chrome.storage'a yaz
            const responseKey = 'getir_api_response_' + requestId;
            await chrome.storage.local.set({
                [responseKey]: {
                    success: true,
                    stock: response.stock,
                    timestamp: Date.now()
                }
            });
            
            // İsteği temizle
            await chrome.storage.local.remove('getir_api_request');
            
            return response.stock;
        } else {
            throw new Error(response?.error || 'Stok alınamadı');
        }
    } catch (error) {
        console.error('Error handling API request:', error);
        
        // Hata sonucunu chrome.storage'a yaz
        const responseKey = 'getir_api_response_' + requestId;
        await chrome.storage.local.set({
            [responseKey]: {
                success: false,
                error: error.message,
                timestamp: Date.now()
            }
        });
        
        // İsteği temizle
        await chrome.storage.local.remove('getir_api_request');
        
        throw error;
    }
}

