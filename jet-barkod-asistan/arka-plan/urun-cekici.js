/**
 * Arka plan işi: Ürün Çekici
 * ============================================================================
 *
 * Kaynağı `getir-product-fetcher/background.js`. Mantık birebir kopyalandı;
 * yalnız çakışan mesaj adları `JBA_URUN_` önekine alındı. Gerekçesi
 * `raf-etiketi.js` başlığında yazıyor.
 *
 * Yönetici paneline giden GETIR_EXPORT_PRODUCTS_RESPONSE ve GETIR_PROGRESS
 * adlarına dokunulmadı; çakışmıyorlar ve panel bunları dinliyor.
 * ============================================================================
 */

// Background service worker
// Getir API'den ürün çekme extension'ı (Admin panel için)

console.log('🚀 Getir Product Fetcher - Background service worker başlatıldı!');
console.log('✅ Service worker aktif ve çalışıyor!', new Date().toISOString());

// Service worker'ın başladığını garanti et
self.addEventListener('activate', (event) => {
  console.log('✅ Service worker activated!', new Date().toISOString());
  event.waitUntil(self.clients.claim());
});

// Service worker'ın yüklendiğini garanti et
self.addEventListener('install', (event) => {
  console.log('✅ Service worker installed!', new Date().toISOString());
  self.skipWaiting(); // Hemen aktif ol
});

// Service worker'ı aktif tutmak için sürekli ping gönder
// NOT: setInterval service worker'da çalışmayabilir, bu yüzden chrome.alarms kullanıyoruz
// Ama ek olarak her mesaj geldiğinde de ping gönderiyoruz

function pingKeepAlive() {
  chrome.storage.local.set({ 
    keepAlive: Date.now(),
    lastPing: new Date().toISOString()
  }, () => {
    console.log('💓 Keep-alive ping:', new Date().toISOString());
  });
}

// Hemen ping gönder
pingKeepAlive();

// Service worker'ı aktif tutmak için periyodik ping
// Manifest v3'te service worker'lar uzun süre kullanılmadığında uykuya dalıyor
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') {
    console.log('💓 Service worker keep-alive ping');
    // Service worker'ı aktif tutmak için storage'a yaz
    pingKeepAlive();
    // Alarm'ı yeniden kur (sürekli aktif kalması için)
    chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 }); // 9 saniye
  }
});

// Keep-alive alarm'ını kur (her 9 saniyede bir - daha sık)
chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 }); // 9 saniye

// Extension yüklendiğinde alarm'ı başlat
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 });
  pingKeepAlive();
  console.log('✅ Extension yüklendi, keep-alive başlatıldı');
});

// Extension başlatıldığında alarm'ı başlat
chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 });

// Tab açıldığında service worker'ı aktif tut
chrome.tabs.onActivated.addListener(() => {
  chrome.storage.local.set({ lastTabActivity: Date.now() });
  pingKeepAlive();
});

chrome.tabs.onUpdated.addListener(() => {
  chrome.storage.local.set({ lastTabActivity: Date.now() });
  pingKeepAlive();
});

// Content script'ten gelen mesajları dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📥 Background script\'e mesaj alındı:', message.type);
  console.log('📋 Sender:', sender.tab ? `Tab ${sender.tab.id}` : 'Unknown');
  console.log('📋 Message:', JSON.stringify(message));
  
  // Service worker'ın aktif olduğunu göster
  console.log('✅ Service worker aktif ve mesaj alıyor!');
  
  // Keep-alive alarm'ını yeniden kur (mesaj geldiğinde)
  chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 });
  // Hemen ping gönder
  pingKeepAlive();
  
  if (message.type === 'JBA_URUN_DISAKTAR') {
    // Admin panelden gelen ürün çekme isteği
    console.log('📦 Tüm ürünleri çekme isteği alındı');
    
    // Service worker'ın aktif olduğunu kontrol et
    if (typeof chrome.alarms !== 'undefined') {
      chrome.alarms.get('keep-alive', (alarm) => {
        if (!alarm) {
          // Alarm yoksa yeniden oluştur
          chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 });
          console.log('✅ Keep-alive alarm yeniden oluşturuldu');
        }
      });
    }
    
    handleExportAllProducts(sendResponse);
    return true; // Async response için
  } else if (message.type === 'JBA_URUN_KIMLIK') {
    // Admin panelden gelen extension ID isteği
    console.log('🔍 Extension ID isteği alındı');
    sendResponse({ 
      success: true, 
      extensionId: chrome.runtime.id,
      extensionName: 'Getir Product Fetcher'
    });
    return true;
  } else if (message.type === 'JBA_URUN_JETON') {
    // Token güncelleme (sadece extension içinde kullanım için)
    console.log('🔑 Token güncelleme alındı (uzunluk:', message.token ? message.token.length : 0, ')');
    // Token'ı sakla (ürün çekme işlemi için)
    chrome.storage.local.set({ 
      lastToken: message.token,
      lastTokenUpdate: Date.now()
    });
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'JBA_URUN_UYAN') {
    // Service worker'ı uyandır
    console.log('⏰ Service worker uyandırıldı!');
    chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 });
    sendResponse({ success: true, message: 'Service worker aktif' });
    return true;
  } else {
    console.log('⚠️ Bilinmeyen mesaj tipi:', message.type);
  }
  return true;
});

// Admin panelden gelen ürün çekme isteğini işle
async function handleExportAllProducts(sendResponse) {
  // sendResponse'u hemen çağır (async işlem başladığını belirt)
  // Ama asıl sonucu chrome.tabs.sendMessage ile göndereceğiz
  sendResponse({ success: true, message: 'İşlem başlatıldı' });
  
  try {
    console.log('📦 Tüm ürünleri çekme işlemi başlatılıyor...');
    
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
      console.error('❌ Getir franchise sitesi açık değil!');
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
    console.log('✅ Getir franchise tab bulundu:', tab.id, tab.url);
    
    sendProgressToAdmin('✅ Getir sitesi bulundu, ürünler çekiliyor...');
    
    console.log('Script çalıştırılıyor, tab ID:', tab.id);
    
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
            } catch (e) {
              console.error('İlerleme mesajı gönderilemedi:', e);
            }
          }
          
          // convertGetirProductToJSONFormat fonksiyonu
          function convertGetirProductToJSONFormat(productData) {
            try {
              // productData artık direkt ürün objesi (products endpoint'inden geliyor)
              let product = productData;
              
              // Eğer stockData formatında gelirse (product alanı string ID ise)
              // Bu durumda stock objesinden ne kadar bilgi varsa onu kullan
              if (productData.product && typeof productData.product === 'string') {
                const productId = productData.product || productData._id || productData.id;
                if (!productId) return null;
                
                // Stock objesinden mevcut bilgileri kullan
                // Eğer stock içinde başka alanlar varsa onları da kullan
                return {
                  id: String(productId),
                  name: productData.name || productData.fullName || 'Ürün Detayı Bulunamadı',
                  category: productData.masterCategoryName || productData.categoryName || 'Genel',
                  brand: productData.brandName || '',
                  description: productData.name || productData.fullName || 'Ürün detayı çekilemedi',
                  image: productData.picURL || productData.imageUrl || productData.image || '',
                  barcodes: productData.barcodes || [],
                  shelf: '-',
                  price: null,
                  stock: null
                };
              }
              
              // Eğer product alanı obje ise, onu kullan
              if (productData.product && typeof productData.product === 'object') {
                product = productData.product;
              }
              
              if (!product || typeof product !== 'object') {
                return null;
              }
              
              const productId = product._id || product.id || productData._id || productData.id;
              if (!productId) {
                return null;
              }
              
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
            
            sendProgressMessage('📊 Stoklar çekiliyor...');
            
            // Önce /stocks endpoint'inden tüm stokları çek
            let allStocks = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            let pageCount = 0;
            const maxPages = 200;
            
            while (hasMore && pageCount < maxPages) {
              const progressMsg = `📥 Sayfa ${pageCount + 1} çekiliyor... (Şu ana kadar: ${allStocks.length} stok)`;
              sendProgressMessage(progressMsg);
              
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
              
              allStocks = allStocks.concat(stocks);
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
            
            sendProgressMessage(`✅ ${allStocks.length} stok çekildi, dönüştürülüyor...`);
            
            // Stocks verilerini direkt kullan (product ID'leri ile)
            // Eğer product alanı obje ise kullan, değilse sadece ID ile minimal ürün oluştur
            const convertedProducts = [];
            let convertedCount = 0;
            let errorCount = 0;
            const seenProductIds = new Set();
            
            for (let i = 0; i < allStocks.length; i++) {
              const stock = allStocks[i];
              try {
                // Product ID'yi al
                const productId = stock.product || stock._id || stock.id;
                if (!productId) {
                  errorCount++;
                  continue;
                }
                
                // Duplicate kontrolü (aynı product ID'yi birden fazla kez işleme)
                const productIdStr = String(productId);
                if (seenProductIds.has(productIdStr)) {
                  continue;
                }
                seenProductIds.add(productIdStr);
                
                // Eğer stock içinde product objesi varsa onu kullan
                let productData = stock;
                if (stock.product && typeof stock.product === 'object') {
                  productData = stock.product;
                }
                
                const product = convertGetirProductToJSONFormat(productData);
                if (product) {
                  convertedProducts.push(product);
                  convertedCount++;
                  
                  if (convertedCount % 100 === 0) {
                    sendProgressMessage(`🔄 ${convertedCount} ürün dönüştürüldü...`);
                  }
                } else {
                  errorCount++;
                  if (errorCount <= 5) {
                    console.warn('Ürün dönüştürülemedi (örnek):', stock);
                  }
                }
              } catch (error) {
                errorCount++;
                console.warn('Ürün dönüştürme hatası:', error, 'Stock:', stock);
                continue;
              }
            }
            
            console.log(`📊 Dönüştürme özeti: ${convertedCount} başarılı, ${errorCount} hata, toplam: ${allStocks.length}`);
            sendProgressMessage(`✅ ${convertedProducts.length} ürün başarıyla dönüştürüldü! (${errorCount} hata)`);
            
            // Sonucu return et (background script admin panele gönderecek)
            console.log(`📦 Sonuç hazır: ${convertedProducts.length} ürün dönüştürüldü`);
            const finalResult = {
              success: true,
              products: convertedProducts,
              total: convertedProducts.length,
              message: `${convertedProducts.length} ürün başarıyla çekildi`
            };
            console.log('📦 Final result:', JSON.stringify(finalResult).substring(0, 200) + '...');
            return finalResult;
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
    } catch (scriptError) {
      console.error('❌ Script çalıştırma hatası:', scriptError);
      clearTimeout(scriptTimeout);
      sendProgressToAdmin('❌ Script çalıştırılamadı: ' + scriptError.message);
      
      // Hata mesajını admin panele gönder
      for (const adminTab of adminTabs) {
        chrome.tabs.sendMessage(adminTab.id, {
          type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
          success: false,
          products: null,
          error: 'Script çalıştırılamadı: ' + scriptError.message,
          total: 0
        }).catch(() => {});
      }
      return;
    }
    
    clearTimeout(scriptTimeout);
    
    console.log('📊 Script sonucu alındı:', results ? 'Var' : 'Yok');
    if (results) {
      console.log('📊 Script results type:', typeof results);
      console.log('📊 Script results isArray:', Array.isArray(results));
      console.log('📊 Script results length:', results.length);
      if (results[0]) {
        console.log('📊 Script results[0]:', typeof results[0]);
        console.log('📊 Script results[0].result:', typeof results[0].result);
        if (results[0].result) {
          console.log('📊 Script results[0].result.success:', results[0].result.success);
          console.log('📊 Script results[0].result.products length:', results[0].result.products ? results[0].result.products.length : 'null');
        }
      }
    } else {
      console.error('❌ Script results NULL veya undefined!');
    }
    
    // Admin tab'ları tekrar bul (güncel olması için)
    try {
      adminTabs = await chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*', 'https://*/*'] });
      console.log('📋 Admin tab\'lar bulundu:', adminTabs.length);
      for (const tab of adminTabs) {
        console.log('  - Tab ID:', tab.id, 'URL:', tab.url);
      }
    } catch (e) {
      console.error('Admin tab bulunamadı:', e);
    }
    
    if (results && Array.isArray(results) && results.length > 0 && results[0] && results[0].result) {
      const result = results[0].result;
      if (result.success) {
        console.log(`✅ ${result.products.length} ürün başarıyla çekildi`);
        
        sendProgressToAdmin(`✅ ${result.products.length} ürün başarıyla çekildi!`);
        
        // Sonucu admin panele gönder (sendResponse yerine chrome.tabs.sendMessage)
        console.log(`📤 Admin panele ${result.products.length} ürün gönderiliyor...`);
        for (const adminTab of adminTabs) {
          try {
            chrome.tabs.sendMessage(adminTab.id, {
              type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
              success: true,
              products: result.products,
              total: result.total,
              message: result.message
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error(`❌ Admin tab ${adminTab.id} mesaj gönderilemedi:`, chrome.runtime.lastError.message);
                // Content script yoksa inject et
                chrome.scripting.executeScript({
                  target: { tabId: adminTab.id },
                  files: ['admin_panel_inject.js']
                }).then(() => {
                  console.log(`✅ Content script inject edildi, tekrar denenecek...`);
                  // Tekrar dene
                  setTimeout(() => {
                    chrome.tabs.sendMessage(adminTab.id, {
                      type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
                      success: true,
                      products: result.products,
                      total: result.total,
                      message: result.message
                    }, (response2) => {
                      if (chrome.runtime.lastError) {
                        console.error(`❌ Admin tab ${adminTab.id} mesaj gönderilemedi (2. deneme):`, chrome.runtime.lastError.message);
                      } else {
                        console.log(`✅ Admin tab ${adminTab.id} mesaj gönderildi (2. deneme)`);
                      }
                    });
                  }, 500);
                }).catch((injectError) => {
                  console.error(`❌ Content script inject edilemedi:`, injectError.message);
                });
              } else {
                console.log(`✅ Admin tab ${adminTab.id} mesaj gönderildi`);
              }
            });
          } catch (e) {
            console.error(`❌ Admin tab ${adminTab.id} hata:`, e.message);
          }
        }
      } else {
        console.error('❌ Ürün çekme hatası:', result.error);
        sendProgressToAdmin(`❌ Hata: ${result.error}`);
        
        // Hata mesajını admin panele gönder
        for (const adminTab of adminTabs) {
          chrome.tabs.sendMessage(adminTab.id, {
            type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
            success: false,
            products: null,
            error: result.error,
            total: 0
          }).catch(() => {});
        }
      }
    } else {
      console.error('❌ Script sonucu alınamadı');
      console.error('Script results:', results);
      
      sendProgressToAdmin('❌ Script sonucu alınamadı. Lütfen tekrar deneyin.');
      
      // Hata mesajını admin panele gönder
      for (const adminTab of adminTabs) {
        chrome.tabs.sendMessage(adminTab.id, {
          type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
          success: false,
          products: null,
          error: 'Script çalıştırılamadı veya sonuç alınamadı',
          total: 0
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('❌ Ürün çekme işlemi hatası:', error);
    
    // Admin tab'ları bul
    let adminTabs = [];
    try {
      adminTabs = await chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*', 'https://*/*'] });
    } catch (e) {
      console.error('Admin tab bulunamadı:', e);
    }
    
    // Hata mesajını admin panele gönder
    for (const adminTab of adminTabs) {
      chrome.tabs.sendMessage(adminTab.id, {
        type: 'GETIR_EXPORT_PRODUCTS_RESPONSE',
        success: false,
        products: null,
        error: error.message || 'Bilinmeyen hata',
        total: 0
      }).catch(() => {});
    }
  }
}

