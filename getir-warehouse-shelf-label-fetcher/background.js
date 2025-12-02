// Background service worker
// Warehouse.getir.com'dan raf etiketlerini çekme extension'ı (Admin panel için)

console.log('🚀 Getir Warehouse Shelf Label Fetcher - Background service worker başlatıldı!');
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
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') {
    console.log('💓 Service worker keep-alive ping');
    pingKeepAlive();
    chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 }); // 9 saniye
  }
});

// Keep-alive alarm'ını kur
chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 });

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
  
  // Service worker'ın aktif olduğunu göster
  console.log('✅ Service worker aktif ve mesaj alıyor!');
  
  // Keep-alive alarm'ını yeniden kur
  chrome.alarms.create('keep-alive', { delayInMinutes: 0.15 });
  pingKeepAlive();
  
  if (message.type === 'EXPORT_SHELF_LABELS') {
    // Admin panelden gelen raf etiketi çekme isteği
    console.log('📋 Raf etiketlerini çekme isteği alındı');
    
    handleExportShelfLabels(sendResponse);
    return true; // Async response için
  } else if (message.type === 'GET_EXTENSION_ID') {
    // Admin panelden gelen extension ID isteği
    console.log('🔍 Extension ID isteği alındı');
    sendResponse({ 
      success: true, 
      extensionId: chrome.runtime.id,
      extensionName: 'Getir Warehouse Shelf Label Fetcher'
    });
    return true;
  } else if (message.type === 'WAKE_UP') {
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

// Admin panelden gelen raf etiketi çekme isteğini işle
async function handleExportShelfLabels(sendResponse) {
  sendResponse({ success: true, message: 'İşlem başlatıldı' });
  
  try {
    console.log('📋 Raf etiketlerini çekme işlemi başlatılıyor...');
    
    // Admin panel tab'ını bul
    let adminTabs = [];
    try {
      adminTabs = await chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*', 'https://*/*'] });
    } catch (e) {
      console.error('Admin tab bulunamadı:', e);
    }
    
    const sendProgressToAdmin = (message) => {
      for (const adminTab of adminTabs) {
        chrome.tabs.sendMessage(adminTab.id, {
          type: 'WAREHOUSE_SHELF_LABEL_PROGRESS',
          step: 'fetching',
          message: message
        }).catch(() => {});
      }
    };
    
    sendProgressToAdmin('🔍 Warehouse sitesi kontrol ediliyor...');
    
    // Warehouse sitesinde açık tab'ı bul
    const warehouseTabs = await chrome.tabs.query({ url: 'https://warehouse.getir.com/*' });
    
    if (!warehouseTabs || warehouseTabs.length === 0) {
      console.error('❌ Warehouse sitesi açık değil!');
      sendProgressToAdmin('❌ Warehouse sitesi açık değil. Lütfen https://warehouse.getir.com adresini açın.');
      
      // Hata mesajını admin panele gönder
      for (const adminTab of adminTabs) {
        chrome.tabs.sendMessage(adminTab.id, {
          type: 'WAREHOUSE_SHELF_LABEL_RESPONSE',
          success: false,
          data: null,
          error: 'Warehouse sitesi açık değil. Lütfen https://warehouse.getir.com adresini açın.',
          total: 0
        }).catch(() => {});
      }
      return;
    }
    
    // İlk açık tab'ı kullan
    const tab = warehouseTabs[0];
    console.log('✅ Warehouse tab bulundu:', tab.id, tab.url);
    
    sendProgressToAdmin('✅ Warehouse sitesi bulundu, raf etiketleri çekiliyor...');
    
    console.log('Script çalıştırılıyor, tab ID:', tab.id);
    
    // Tab'da script çalıştır ve raf etiketlerini çek
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function() {
          return (async function() {
            // İlerleme mesajı gönder fonksiyonu
            function sendProgressMessage(message) {
              try {
                console.log('📊 İlerleme:', message);
              } catch (e) {
                console.error('İlerleme mesajı gönderilemedi:', e);
              }
            }
            
            // Object ID oluştur (MongoDB ObjectId formatı)
            function generateObjectId() {
              const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
              const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
              return (timestamp + random).substring(0, 24);
            }
            
            // Shelf label verisini products.json formatına dönüştür
            function convertShelfLabelToProductFormat(rowData, headers, rowElement) {
              try {
                // Warehouse tablosu yapısı (product_search.html'deki gibi):
                // 0: Barkod (ant-tag-blue içinde)
                // 1: Görsel (img tag)
                // 2: Ürün ID (ant-tag içinde)
                // 3: Ürün Adı (ant-tag içinde)
                // 4: Raf
                
                const cells = rowElement ? rowElement.querySelectorAll('td') : [];
                
                if (cells.length < 5) {
                  return null; // Yetersiz sütun
                }
                
                // 1. Barkod - İlk sütunda ant-tag-blue içinde (TÜM tag'leri kontrol et)
                let barcode = '';
                let barcodeSize = '';
                let barcodeVariant = '';
                
                // Önce ant-tag-blue'ları kontrol et
                const barcodeTagsBlue = cells[0].querySelectorAll('.ant-tag-blue');
                if (barcodeTagsBlue.length > 0) {
                  barcode = barcodeTagsBlue[0].textContent.trim();
                } else {
                  // Sonra normal ant-tag'leri kontrol et
                  const barcodeTags = cells[0].querySelectorAll('.ant-tag');
                  if (barcodeTags.length > 0) {
                    barcode = barcodeTags[0].textContent.trim();
                  } else {
                    // Son olarak tüm text'i al
                    barcode = cells[0].textContent.trim();
                  }
                }
                
                // Barkod'dan sadece sayısal kısmı al (eğer başka karakterler varsa)
                barcode = barcode.replace(/\D/g, '').trim();
                
                // 2. Görsel - İkinci sütunda img tag
                let image = '';
                const imgTag = cells[1].querySelector('img');
                if (imgTag && imgTag.src) {
                  image = imgTag.src;
                }
                
                // 3. Ürün ID - Üçüncü sütunda ant-tag içinde
                let productId = '';
                const idTag = cells[2].querySelector('.ant-tag, span');
                if (idTag) {
                  productId = idTag.textContent.trim();
                } else {
                  productId = cells[2].textContent.trim();
                }
                // Eğer bulunamazsa, ID oluştur
                if (!productId) {
                  productId = generateObjectId();
                }
                
                // 4. Ürün Adı - Dördüncü sütunda ant-tag içinde
                let productName = '';
                const nameTag = cells[3].querySelector('.ant-tag, span, a');
                if (nameTag) {
                  productName = nameTag.textContent.trim();
                } else {
                  productName = cells[3].textContent.trim();
                }
                if (!productName || productName.includes('http')) {
                  productName = 'Bilinmeyen Ürün';
                }
                
                // 5. Raf - Beşinci sütunda
                let shelf = '-';
                if (cells.length > 4) {
                  shelf = cells[4].textContent.trim() || '-';
                }
                
                // Kategori - Header'lardan veya ekstra sütunlardan bul
                let category = 'Genel';
                let brand = '';
                
                // Header'lardan kategori bul
                for (let i = 5; i < headers.length; i++) {
                  const header = headers[i].toLowerCase();
                  const cellValue = cells[i] ? cells[i].textContent.trim() : '';
                  
                  // Kategori bul
                  if ((header.includes('kategori') || header.includes('category')) && !header.includes('alt')) {
                    if (cellValue && !cellValue.includes('http') && cellValue !== productName && cellValue !== barcode && cellValue !== productId && cellValue.length > 0) {
                      category = cellValue;
                      break;
                    }
                  }
                }
                
                // Eğer kategori bulunamadıysa, ürün adından çıkarmaya çalış
                if (category === 'Genel' && productName) {
                  // Bazı ürün adlarında kategori ipucu olabilir
                  const categoryHints = {
                    'yoğurt': 'Süt Ürünleri',
                    'süt': 'Süt Ürünleri',
                    'peynir': 'Süt Ürünleri',
                    'ekmek': 'Fırın',
                    'su': 'İçecek',
                    'cola': 'İçecek',
                    'çay': 'İçecek',
                    'kahve': 'İçecek',
                    'meyve': 'Meyve & Sebze',
                    'sebze': 'Meyve & Sebze'
                  };
                  
                  const productNameLower = productName.toLowerCase();
                  for (const [hint, cat] of Object.entries(categoryHints)) {
                    if (productNameLower.includes(hint)) {
                      category = cat;
                      break;
                    }
                  }
                }
                
                // Ürün adından brand, size ve variant çıkar
                // Örnek: "Activia Probiyotik Sade Yoğurt (4 x 100 g)"
                if (productName) {
                  productName = productName.trim();
                  
                  // Brand: İlk kelime (büyük harfle başlayan)
                  const words = productName.split(/\s+/);
                  if (words.length > 0 && /^[A-ZÇĞİÖŞÜ]/.test(words[0])) {
                    brand = words[0].trim();
                  }
                  
                  // Size: Parantez içindeki kısım (En son parantez genellikle gramajdır)
                  const sizeMatch = productName.match(/\(([^)]+)\)$/);
                  if (sizeMatch) {
                    barcodeSize = sizeMatch[1].trim();
                  } else {
                     // Parantez sonda değilse herhangi bir parantezi al
                     const anySizeMatch = productName.match(/\(([^)]+)\)/);
                     if (anySizeMatch) {
                        barcodeSize = anySizeMatch[1].trim();
                     }
                  }
                  
                  // Variant: Parantez öncesi son kelimeyi al, ama genel kelimeleri atla
                  // "Activia Probiyotik Sade Yoğurt" -> "Yoğurt" (atla) -> "Sade" (al)
                  let nameWithoutSize = productName;
                  if (productName.includes('(')) {
                    nameWithoutSize = productName.split('(')[0].trim();
                  }
                  
                  const beforeWords = nameWithoutSize.split(/\s+/);
                  
                  // Genel kelimeleri atla (variant olmayan kelimeler) - Genişletilmiş liste
                  const skipWords = [
                      'yoğurt', 'yogurt', 'sade', 'tam', 'yarım', 'yağlı', 'yagli', 'kaymaksız', 'kaymaksiz',
                      'çay', 'cay', 'su', 'ekmek', 'peynir', 'peyniri', 'süt', 'sütü',
                      'meyve', 'sebze', 'kahve', 'cola', 'kola', 'içecek', 'icecek',
                      'ürün', 'nektarı', 'nektari', 'suyu', 'yağ', 'yag', 'yağı',
                      'un', 'şeker', 'seker', 'tuz', 'makarna', 'pirinç', 'pirinc',
                      'bulgur', 'mercimek', 'nohut', 'fasulye', 'salça', 'salca',
                      'sirke', 'sos', 'bisküvi', 'biskuvi', 'çikolata', 'cikolata',
                      'gofret', 'kraker', 'kek', 'cips', 'kuruyemiş', 'dondurma',
                      'kağıt', 'kagit', 'havlu', 'bez', 'deterjan', 'sabun',
                      'şampuan', 'sampuan', 'duş', 'dus', 'jel', 'jeli',
                      'diş', 'dis', 'macun', 'macunu', 'fırça', 'firca',
                      'suyu', 'meyvesuyu'
                  ];
                  
                  if (beforeWords.length > 1) {
                    // Son kelimeden başlayarak geriye doğru git, skipWords'te olmayan ilk kelimeyi bul
                    for (let i = beforeWords.length - 1; i >= 0; i--) {
                      const word = beforeWords[i];
                      const wordLower = word.toLowerCase().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
                      
                      // Eğer bu kelime skipWords'te değilse ve büyük harfle başlıyorsa variant olabilir
                      // Ayrıca Brand ile aynı olmamalı (eğer kelime sayısı > 1 ise)
                      if (!skipWords.includes(wordLower) && /^[A-ZÇĞİÖŞÜ]/.test(word)) {
                        if (word !== brand || beforeWords.length === 1) {
                            barcodeVariant = word;
                            break;
                        }
                      }
                    }
                  }
                }
                
                // Barkod array'ini önce hazırla (DOĞRU SIRALAMA: code, type, size, variant)
                const barcodesArray = [];
                if (barcode && barcode.length >= 8 && !barcode.includes('http')) {
                  // Barcodes objesini DOĞRU SIRALAMAYLA oluştur
                  const barcodeObj = {};
                  barcodeObj.code = String(barcode).trim();
                  barcodeObj.type = 'EAN-13';
                  barcodeObj.size = String(barcodeSize || '');
                  barcodeObj.variant = String(barcodeVariant || '');
                  barcodesArray.push(barcodeObj);
                }
                
                // Products.json formatına dönüştür (DOĞRU SIRALAMA: id, name, category, brand, description, image, barcodes, shelf, price, stock)
                // JavaScript objelerinde key sıralaması eklenme sırasına göre olur, bu yüzden doğru sırayla ekliyoruz
                const product = {};
                product.id = String(productId);
                product.name = String(productName);
                product.category = String(category);
                product.brand = String(brand);
                product.description = String(productName);
                product.image = String(image);
                product.barcodes = barcodesArray;
                product.shelf = String(shelf);
                product.price = null;
                product.stock = null;
                
                // Boş verileri filtrele
                // Eğer barkod yoksa, name "Bilinmeyen Ürün" ise, veya image yoksa ve name boşsa - atla
                if (product.barcodes.length === 0) {
                  return null; // Barkod yoksa ekleme
                }
                
                if (product.name === 'Bilinmeyen Ürün' || !product.name || product.name.trim() === '') {
                  return null; // Geçersiz ürün adı
                }
                
                if (!product.image || product.image.trim() === '') {
                  // Görsel yoksa da eklenebilir, ama diğer kontroller geçerli olmalı
                }
                
                return product;
              } catch (error) {
                console.error('Shelf label dönüştürme hatası:', error);
                return null;
              }
            }
            
            // Tablo parse fonksiyonu
            function parseShelfLabelTable() {
              try {
                sendProgressMessage('📋 Tablo aranıyor...');
                
                // ant-table-container elementini bul
                const tableContainer = document.querySelector('.ant-table-container');
                if (!tableContainer) {
                  return { success: false, error: 'Tablo bulunamadı. Lütfen raf etiketleri sayfasını açın.' };
                }
                
                sendProgressMessage('✅ Tablo bulundu, veriler parse ediliyor...');
                
                // Header'ları bul
                const thead = tableContainer.querySelector('thead');
                const headers = [];
                if (thead) {
                  const headerRows = thead.querySelectorAll('tr');
                  // Son header satırını kullan (eğer birden fazla satır varsa)
                  const lastHeaderRow = headerRows[headerRows.length - 1];
                  if (lastHeaderRow) {
                    const thElements = lastHeaderRow.querySelectorAll('th');
                    thElements.forEach((th, index) => {
                      const text = th.textContent.trim();
                      if (text) {
                        headers.push(text);
                      } else {
                        headers.push(`Column${index + 1}`);
                      }
                    });
                  }
                }
                
                // Body'yi bul
                const tbody = tableContainer.querySelector('tbody');
                if (!tbody) {
                  return { success: false, error: 'Tablo body bulunamadı.' };
                }
                
                // Satırları parse et
                const rows = tbody.querySelectorAll('tr');
                const data = [];
                
                sendProgressMessage(`📊 ${rows.length} satır bulundu, parse ediliyor...`);
                
                rows.forEach((row, rowIndex) => {
                  const cells = row.querySelectorAll('td');
                  const rowData = {};
                  
                  // Row data'yı header'larla eşleştir (debug için)
                  cells.forEach((cell, cellIndex) => {
                    const headerName = headers[cellIndex] || `Column${cellIndex + 1}`;
                    let cellText = cell.textContent.trim();
                    // Eğer img tag varsa src'yi de ekle
                    const img = cell.querySelector('img');
                    if (img && img.src) {
                      cellText = img.src;
                    }
                    rowData[headerName] = cellText;
                  });
                  
                  // Products.json formatına dönüştür (row element'i de gönder)
                  const product = convertShelfLabelToProductFormat(rowData, headers, row);
                  if (product) {
                    data.push(product);
                  }
                  
                  if ((rowIndex + 1) % 100 === 0) {
                    sendProgressMessage(`🔄 ${rowIndex + 1}/${rows.length} satır parse edildi...`);
                  }
                });
                
                sendProgressMessage(`✅ ${data.length} satır başarıyla parse edildi!`);
                
                return {
                  success: true,
                  data: data,
                  total: data.length
                };
              } catch (error) {
                console.error('Tablo parse hatası:', error);
                return {
                  success: false,
                  error: error.message || 'Bilinmeyen hata'
                };
              }
            }
            
            // Pagination kontrolü ve tüm sayfaları çek (ÖNCE ÇEK, SONRA PARSE ET - ÇOK HIZLI)
            async function fetchAllShelfLabels() {
              try {
                sendProgressMessage('🔄 Sayfa sayısı kontrol ediliyor...');
                
                // Sayfa sayısını bul
                const initialPagination = document.querySelector('.ant-pagination');
                let totalPages = 1;
                
                if (initialPagination) {
                  const pageItems = initialPagination.querySelectorAll('.ant-pagination-item');
                  if (pageItems.length > 0) {
                    const lastPageItem = pageItems[pageItems.length - 1];
                    const lastPageNumber = parseInt(lastPageItem.textContent.trim());
                    if (lastPageNumber && !isNaN(lastPageNumber)) {
                      totalPages = lastPageNumber;
                    }
                  } else {
                     const paginationOptions = initialPagination.querySelector('.ant-pagination-options');
                     if (paginationOptions) {
                       const totalText = paginationOptions.textContent;
                       const match = totalText.match(/(\d+)\s*\/\s*(\d+)/);
                       if (match) {
                         totalPages = parseInt(match[2]);
                       }
                     }
                  }
                }

                sendProgressMessage(`📊 Toplam ${totalPages} sayfa bulundu, tüm sayfalar çekiliyor ve parse ediliyor...`);
                
                // İlk sayfayı parse et
                let allData = [];
                let firstPageResult = parseShelfLabelTable();
                if (firstPageResult.success && firstPageResult.data) {
                  allData = allData.concat(firstPageResult.data);
                  sendProgressMessage(`✅ Sayfa 1/${totalPages} parse edildi (${firstPageResult.data.length} ürün)`);
                }
                
                // Diğer sayfaları çek ve parse et
                let currentPage = 1;
                const maxPages = 200;
                
                if (totalPages > 1) {
                  while (currentPage < totalPages && currentPage < maxPages) {
                    // Pagination elementini bul
                    const currentPagination = document.querySelector('.ant-pagination');
                    if (!currentPagination) {
                      sendProgressMessage(`⚠️ Pagination elementi bulunamadı. Durduruluyor.`);
                      break;
                    }

                    // Next butonunu bul
                    const nextButtonLi = currentPagination.querySelector('.ant-pagination-next');
                    if (!nextButtonLi) {
                      sendProgressMessage(`✅ Next butonu bulunamadı. Tüm sayfalar çekildi (${currentPage}/${totalPages}).`);
                      break;
                    }
                    
                    // Devre dışı kontrolü
                    const isDisabled = nextButtonLi.getAttribute('aria-disabled') === 'true' || nextButtonLi.classList.contains('ant-pagination-disabled');
                    if (isDisabled) {
                      sendProgressMessage(`✅ Next butonu devre dışı. Tüm sayfalar çekildi (${currentPage}/${totalPages}).`);
                      break;
                    }
                    
                    // Önceki sayfa numarası
                    const activePageBefore = currentPagination.querySelector('.ant-pagination-item-active');
                    const pageNumBefore = activePageBefore ? parseInt(activePageBefore.textContent.trim()) : currentPage;
                    
                    // Her 5 sayfada bir progress mesajı gönder
                    if (currentPage % 5 === 0 || currentPage === 1) {
                      sendProgressMessage(`📥 Sayfa ${currentPage + 1}/${totalPages} çekiliyor...`);
                    }
                    
                    // Next butonuna tıkla
                    const nextButton = nextButtonLi.querySelector('button.ant-pagination-item-link');
                    if (nextButton) {
                      nextButton.click();
                    } else {
                      nextButtonLi.click();
                    }
                    
                    // Sayfa değişikliğini bekle ve TABLO İÇERİĞİNİN TAM YÜKLENDİĞİNDEN EMİN OL
                    let pageChanged = false;
                    let tableFullyLoaded = false;
                    await new Promise((resolve) => {
                      let checkCount = 0;
                      const maxChecks = 60; // 3 saniye (60 * 50ms) - tablo tam yüklensin
                      let previousRowCount = 0;
                      let stableRowCount = 0; // Kaç kez aynı satır sayısı geldi
                      
                      const checkInterval = setInterval(() => {
                        checkCount++;
                        
                        // Sayfa numarası değişikliğini kontrol et
                        const checkPagination = document.querySelector('.ant-pagination');
                        if (checkPagination) {
                          const activePageAfter = checkPagination.querySelector('.ant-pagination-item-active');
                          const pageNumAfter = activePageAfter ? parseInt(activePageAfter.textContent.trim()) : null;
                          
                          // Sayfa numarası değiştiyse ve doğru sayfadaysa
                          if (pageNumAfter && pageNumAfter !== pageNumBefore && pageNumAfter === currentPage + 1) {
                            // Tablo içeriğini kontrol et - TAM YÜKLENDİ Mİ? (100 SATIR OLMALI!)
                            const tableContainer = document.querySelector('.ant-table-container');
                            const tbody = tableContainer ? tableContainer.querySelector('tbody') : null;
                            const rows = tbody ? tbody.querySelectorAll('tr') : [];
                            const currentRowCount = rows.length;
                            
                            // 100 satır olmalı (veya son sayfada daha az olabilir)
                            const expectedRowCount = currentPage + 1 === totalPages ? currentRowCount : 100;
                            
                            if (currentRowCount > 0) {
                              // Satır sayısı 100'e ulaştı mı? (veya son sayfada mevcut sayıya ulaştı mı?)
                              if (currentRowCount >= expectedRowCount || (currentPage + 1 === totalPages && currentRowCount > 0)) {
                                // Satır sayısı sabit mi? (5 kez aynı sayı gelirse tam yüklenmiş demektir)
                                if (currentRowCount === previousRowCount) {
                                  stableRowCount++;
                                  if (stableRowCount >= 5) {
                                    // Tablo tam yüklendi ve 100 satır var!
                                    pageChanged = true;
                                    tableFullyLoaded = true;
                                    clearInterval(checkInterval);
                                    resolve();
                                    return;
                                  }
                                } else {
                                  // Satır sayısı değişti, henüz yükleniyor
                                  stableRowCount = 0;
                                  previousRowCount = currentRowCount;
                                }
                              } else {
                                // Henüz 100 satıra ulaşmadı, yükleniyor
                                stableRowCount = 0;
                                previousRowCount = currentRowCount;
                              }
                            }
                          }
                        }
                        
                        if (checkCount >= maxChecks) {
                          clearInterval(checkInterval);
                          resolve();
                        }
                      }, 50); // 50ms interval
                    });
                    
                    // Sayfa değişmediyse veya tablo tam yüklenmediyse biraz daha bekle
                    if (!pageChanged || !tableFullyLoaded) {
                      sendProgressMessage(`⏳ Sayfa ${currentPage + 1} yükleniyor, bekleniyor...`);
                      await new Promise(resolve => setTimeout(resolve, 300));
                      
                      // Son kontrol - tablo tam yüklendi mi?
                      const finalTableContainer = document.querySelector('.ant-table-container');
                      const finalTbody = finalTableContainer ? finalTableContainer.querySelector('tbody') : null;
                      const finalRows = finalTbody ? finalTbody.querySelectorAll('tr') : [];
                      
                      if (finalRows.length === 0) {
                        sendProgressMessage(`⚠️ Sayfa ${currentPage + 1} tablosu boş, tekrar deneniyor...`);
                        // Bir kez daha tıkla
                        const retryPagination = document.querySelector('.ant-pagination');
                        if (retryPagination) {
                          const retryNextButtonLi = retryPagination.querySelector('.ant-pagination-next');
                          if (retryNextButtonLi && retryNextButtonLi.getAttribute('aria-disabled') !== 'true') {
                            const retryNextButton = retryNextButtonLi.querySelector('button.ant-pagination-item-link');
                            if (retryNextButton) {
                              retryNextButton.click();
                            } else {
                              retryNextButtonLi.click();
                            }
                            await new Promise(resolve => setTimeout(resolve, 500));
                            // Tekrar tablo yüklenmesini bekle
                            let retryStableCount = 0;
                            let retryPreviousCount = 0;
                            let retryCheckCount = 0;
                            await new Promise((resolve) => {
                              const retryCheckInterval = setInterval(() => {
                                retryCheckCount++;
                                const retryTableContainer = document.querySelector('.ant-table-container');
                                const retryTbody = retryTableContainer ? retryTableContainer.querySelector('tbody') : null;
                                const retryRows = retryTbody ? retryTbody.querySelectorAll('tr') : [];
                                const retryCurrentCount = retryRows.length;
                                
                                if (retryCurrentCount > 0) {
                                  if (retryCurrentCount === retryPreviousCount) {
                                    retryStableCount++;
                                    if (retryStableCount >= 3) {
                                      clearInterval(retryCheckInterval);
                                      resolve();
                                      return;
                                    }
                                  } else {
                                    retryStableCount = 0;
                                    retryPreviousCount = retryCurrentCount;
                                  }
                                }
                                
                                // Max 60 kontrol (3 saniye)
                                if (retryCheckCount >= 60) {
                                  clearInterval(retryCheckInterval);
                                  resolve();
                                }
                              }, 50);
                            });
                          }
                        }
                      }
                    }
                    
                    // Tablo tam yüklendi, şimdi parse et
                    // Ekstra güvenlik için kısa bir bekleme
                    await new Promise(resolve => setTimeout(resolve, 150)); // Render tamamlansın
                    
                    // Parse öncesi satır sayısını kontrol et - 100 SATIR OLMALI!
                    const preParseTableContainer = document.querySelector('.ant-table-container');
                    const preParseTbody = preParseTableContainer ? preParseTableContainer.querySelector('tbody') : null;
                    const preParseRows = preParseTbody ? preParseTbody.querySelectorAll('tr') : [];
                    const expectedRowCount = currentPage === totalPages ? preParseRows.length : 100; // Son sayfa hariç 100 olmalı
                    
                    if (preParseRows.length === 0) {
                      sendProgressMessage(`⚠️ Sayfa ${currentPage + 1} tablosu boş, tekrar bekleniyor...`);
                      await new Promise(resolve => setTimeout(resolve, 500));
                      // Tekrar kontrol et
                      const retryTableContainer = document.querySelector('.ant-table-container');
                      const retryTbody = retryTableContainer ? retryTableContainer.querySelector('tbody') : null;
                      const retryRows = retryTbody ? retryTbody.querySelectorAll('tr') : [];
                      if (retryRows.length === 0) {
                        sendProgressMessage(`⚠️ Sayfa ${currentPage + 1} hala boş, atlanıyor...`);
                        currentPage++;
                        continue;
                      }
                    }
                    
                    // 100 SATIR OLMALI - Eğer değilse bekle!
                    if (preParseRows.length < expectedRowCount && currentPage < totalPages) {
                      sendProgressMessage(`⏳ Sayfa ${currentPage + 1}: ${preParseRows.length}/${expectedRowCount} satır yüklendi, bekleniyor...`);
                      // 100 satıra ulaşana kadar bekle
                      let waitCount = 0;
                      await new Promise((resolve) => {
                        const waitInterval = setInterval(() => {
                          waitCount++;
                          const waitTableContainer = document.querySelector('.ant-table-container');
                          const waitTbody = waitTableContainer ? waitTableContainer.querySelector('tbody') : null;
                          const waitRows = waitTbody ? waitTbody.querySelectorAll('tr') : [];
                          
                          if (waitRows.length >= expectedRowCount) {
                            clearInterval(waitInterval);
                            resolve();
                          } else if (waitCount >= 40) { // Max 2 saniye bekle
                            clearInterval(waitInterval);
                            resolve();
                          }
                        }, 50);
                      });
                    }
                    
                    // Final kontrol - 100 satır var mı?
                    const finalTableContainer = document.querySelector('.ant-table-container');
                    const finalTbody = finalTableContainer ? finalTableContainer.querySelector('tbody') : null;
                    const finalRows = finalTbody ? finalTbody.querySelectorAll('tr') : [];
                    const finalRowCount = finalRows.length;
                    
                    // Parse et
                    const pageResult = parseShelfLabelTable();
                    
                    if (pageResult.success && pageResult.data && pageResult.data.length > 0) {
                      const parsedCount = pageResult.data.length;
                      
                      // Parse edilen satır sayısı DOM'daki satır sayısından azsa, tekrar dene
                      if (parsedCount < finalRowCount * 0.95) { // %95'ten azsa sorun var
                        sendProgressMessage(`⚠️ Sayfa ${currentPage + 1}: ${parsedCount}/${finalRowCount} satır parse edildi, tekrar deneniyor...`);
                        // Biraz daha bekle ve tekrar parse et
                        await new Promise(resolve => setTimeout(resolve, 400));
                        const retryResult = parseShelfLabelTable();
                        if (retryResult.success && retryResult.data && retryResult.data.length >= finalRowCount * 0.95) {
                          allData = allData.concat(retryResult.data);
                          sendProgressMessage(`✅ Sayfa ${currentPage + 1} tekrar parse edildi: ${retryResult.data.length} satır`);
                        } else {
                          // Hala eksikse uyar ama ekle
                          allData = allData.concat(retryResult.data || pageResult.data);
                          sendProgressMessage(`⚠️ Sayfa ${currentPage + 1}: ${(retryResult.data || pageResult.data).length} satır parse edildi (${finalRowCount} bekleniyordu)`);
                        }
                      } else {
                        // Normal durum - tüm satırlar parse edildi
                        allData = allData.concat(pageResult.data);
                      }
                      
                      currentPage++;
                      
                      // Her 5 sayfada bir progress mesajı gönder
                      if (currentPage % 5 === 0 || currentPage === totalPages) {
                        sendProgressMessage(`✅ ${currentPage}/${totalPages} sayfa parse edildi (Toplam: ${allData.length} ürün)`);
                      }
                    } else {
                      sendProgressMessage(`⚠️ Sayfa ${currentPage + 1} parse edilemedi, devam ediliyor...`);
                      currentPage++; // Devam et
                    }
                    
                    // Minimum bekleme (rate limiting)
                    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms
                  }
                }
                
                sendProgressMessage(`✅ Toplam ${allData.length} raf etiketi başarıyla çekildi ve parse edildi!`);
                
                return {
                  success: true,
                  data: allData,
                  total: allData.length,
                  message: `${allData.length} raf etiketi başarıyla çekildi`
                };
              } catch (error) {
                console.error('❌ Raf etiketi çekme hatası:', error);
                return {
                  success: false,
                  error: error.message || 'Bilinmeyen hata'
                };
              }
            }
            
            // Ana fonksiyon
            try {
              const result = await fetchAllShelfLabels();
              return result;
            } catch (error) {
              console.error('❌ Hata:', error);
              return {
                success: false,
                error: error.message || 'Bilinmeyen hata'
              };
            }
          })();
        }
      });
      
      console.log('📊 Script sonucu alındı:', results ? 'Var' : 'Yok');
      
      // Admin tab'ları tekrar bul
      try {
        adminTabs = await chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*', 'https://*/*'] });
      } catch (e) {
        console.error('Admin tab bulunamadı:', e);
      }
      
      if (results && results[0] && results[0].result) {
        const result = results[0].result;
        if (result.success) {
          console.log(`✅ ${result.data.length} raf etiketi başarıyla çekildi`);
          
          sendProgressToAdmin(`✅ ${result.data.length} raf etiketi başarıyla çekildi!`);
          
          // Sonucu admin panele gönder
          for (const adminTab of adminTabs) {
            try {
              chrome.tabs.sendMessage(adminTab.id, {
                type: 'WAREHOUSE_SHELF_LABEL_RESPONSE',
                success: true,
                data: result.data,
                total: result.total,
                message: result.message
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error(`❌ Admin tab ${adminTab.id} mesaj gönderilemedi:`, chrome.runtime.lastError.message);
                } else {
                  console.log(`✅ Admin tab ${adminTab.id} mesaj gönderildi`);
                }
              });
            } catch (e) {
              console.error(`❌ Admin tab ${adminTab.id} hata:`, e.message);
            }
          }
        } else {
          console.error('❌ Raf etiketi çekme hatası:', result.error);
          sendProgressToAdmin(`❌ Hata: ${result.error}`);
          
          // Hata mesajını admin panele gönder
          for (const adminTab of adminTabs) {
            chrome.tabs.sendMessage(adminTab.id, {
              type: 'WAREHOUSE_SHELF_LABEL_RESPONSE',
              success: false,
              data: null,
              error: result.error,
              total: 0
            }).catch(() => {});
          }
        }
      } else {
        console.error('❌ Script sonucu alınamadı');
        
        sendProgressToAdmin('❌ Script sonucu alınamadı. Lütfen tekrar deneyin.');
        
        // Hata mesajını admin panele gönder
        for (const adminTab of adminTabs) {
          chrome.tabs.sendMessage(adminTab.id, {
            type: 'WAREHOUSE_SHELF_LABEL_RESPONSE',
            success: false,
            data: null,
            error: 'Script çalıştırılamadı veya sonuç alınamadı',
            total: 0
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('❌ Raf etiketi çekme işlemi hatası:', error);
      
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
          type: 'WAREHOUSE_SHELF_LABEL_RESPONSE',
          success: false,
          data: null,
          error: error.message || 'Bilinmeyen hata',
          total: 0
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('❌ Genel hata:', error);
  }
}

