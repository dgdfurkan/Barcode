// Product Importer - Admin Panel için ürün içe aktarma ve barkod arama sistemi
// HTML tablo formatındaki verileri analiz eder ve products.json'a ekler

(function() {
    'use strict';

    class ProductImporter {
    constructor() {
        this.productsCache = null;
        this.productsCacheTimestamp = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 dakika
        this.searchDebounceTimer = null;
        this.analysisResults = [];
        this.allAnalysisResults = []; // Tüm analiz sonuçları (sil diyene kadar tutulacak)
        this.currentFileInput = null; // Seçilen dosya input'u
        this.fetchedProducts = null; // Getir API'den çekilen ürünler
        this.fetchedShelfLabels = null; // Warehouse'dan çekilen raf etiketleri
        this.manualShelfLabels = null; // Manuel olarak yüklenen raf etiketi dosyası
        this.missingPages = []; // Eksik sayfalar (100 ürün alınamayan sayfalar)
    }

        // Products.json dosyasını yükle ve cache'le
        async loadProductsJSON(fileInput = null, forceRefresh = false) {
            try {
                const now = Date.now();
                let data = null;

                // Önce file input kontrolü yap (cache'den önce!)
                // Eğer file input varsa, cache'i atla ve dosyadan oku
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    // Yeni dosya yüklendi, cache'i atla
                    const file = fileInput.files[0];
                    const text = await file.text();
                    data = JSON.parse(text);
                    this.currentFileInput = fileInput;
                    console.log('📁 Loaded products.json from file input (cache bypassed)');
                } else if (this.currentFileInput && this.currentFileInput.files && this.currentFileInput.files.length > 0) {
                    // Kaydedilmiş file input varsa, onu kullan
                    const file = this.currentFileInput.files[0];
                    const text = await file.text();
                    data = JSON.parse(text);
                    console.log('📁 Loaded products.json from saved file input');
                } else {
                    // File input yoksa, cache kontrolü yap
                    if (!forceRefresh && this.productsCache && this.productsCacheTimestamp && (now - this.productsCacheTimestamp) < this.CACHE_DURATION) {
                        console.log('📦 Using cached products data');
                        return this.productsCache;
                    }

                    // Önce global PRODUCTS_DATA'yı kontrol et (sayfada yüklenmiş olabilir)
                    if (window.PRODUCTS_DATA && window.PRODUCTS_DATA.products) {
                        data = window.PRODUCTS_DATA;
                        console.log('📦 Using global PRODUCTS_DATA');
                    } else {
                        // Fetch ile yükle (http/https protokolünde çalışır)
                        // Ana dizindeki products.json'u oku (admin.html root'ta)
                        try {
                            const response = await fetch('products.json');
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            data = await response.json();
                            console.log('🌐 Loaded products.json via fetch');
                            console.log('📁 Dosya konumu: Ana dizin (root/products.json)');
                            console.log(`📊 Toplam ürün sayısı: ${data.products ? data.products.length : 0}`);
                        } catch (fetchError) {
                            // CORS hatası veya fetch başarısız, kullanıcıya dosya seçtir (sessizce handle et)
                            // console.warn('⚠️ Fetch failed, requesting file input:', fetchError);
                            throw new Error('products.json dosyasını yükleyemiyorum. Lütfen dosyayı seçin.');
                        }
                    }
                }

                if (!data.products || !Array.isArray(data.products)) {
                    throw new Error('Invalid products.json format');
                }

                // Cache'le
                this.productsCache = data.products;
                this.productsCacheTimestamp = now;

                console.log(`✅ Loaded ${data.products.length} products from products.json`);
                console.log(`📊 Cache updated at ${new Date().toLocaleTimeString()}`);
                return this.productsCache;
            } catch (error) {
                // Sadece kritik hataları logla, CORS hatalarını sessizce handle et
                if (!error.message.includes('products.json dosyasını yükleyemiyorum')) {
                    console.error('❌ Error loading products.json:', error);
                }
                throw error;
            }
        }

        // HTML tablodan veri çıkarma
        parseHTMLTable(htmlContent) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');
                const tables = doc.querySelectorAll('table');

                if (tables.length === 0) {
                    throw new Error('HTML içinde tablo bulunamadı');
                }

                // İlk tabloyu kullan
                const table = tables[0];
                const rows = table.querySelectorAll('tr');

                if (rows.length < 2) {
                    throw new Error('Tablo en az 2 satır içermeli (header + data)');
                }

                // İlk satırı header olarak kabul et
                const headerRow = rows[0];
                const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => {
                    return cell.textContent.trim().toLowerCase();
                });

                // Header mapping (Türkçe ve İngilizce destek)
                const headerMap = {
                    'ürün adı': 'name',
                    'product name': 'name',
                    'name': 'name',
                    'barkod': 'barcode',
                    'barcode': 'barcode',
                    'kod': 'barcode',
                    'code': 'barcode',
                    'kategori': 'category',
                    'category': 'category',
                    'marka': 'brand',
                    'brand': 'brand',
                    'açıklama': 'description',
                    'description': 'description',
                    'resim': 'image',
                    'image': 'image',
                    'görsel': 'image',
                    'raf': 'shelf',
                    'shelf': 'shelf',
                    'boyut': 'size',
                    'size': 'size',
                    'varyant': 'variant',
                    'variant': 'variant'
                };

                const mappedHeaders = headers.map(h => headerMap[h] || h);

                // Veri satırlarını çıkar
                const products = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const cells = Array.from(row.querySelectorAll('td, th'));

                    if (cells.length === 0) continue;

                    const product = {};
                    cells.forEach((cell, index) => {
                        const header = mappedHeaders[index];
                        if (header) {
                            const value = cell.textContent.trim();
                            if (value) {
                                product[header] = value;
                            }
                        }
                    });
                    
                    // En az name veya barcode olmalı
                    if (product.name || product.barcode) {
                        products.push(product);
                    }
                }

                console.log(`✅ Parsed ${products.length} products from HTML table`);
                return products;
            } catch (error) {
                console.error('❌ Error parsing HTML table:', error);
                throw error;
            }
        }
        
        // Eksik sayfaları göster
        displayMissingPages(missingPages) {
            console.log(`📋 displayMissingPages çağrıldı, ${missingPages.length} eksik sayfa:`, missingPages);
            const missingPagesDiv = document.getElementById('shelfLabelMissingPages');
            const missingPagesList = document.getElementById('missingPagesList');
            
            if (!missingPagesDiv) {
                console.error('❌ shelfLabelMissingPages div bulunamadı!');
                return;
            }
            
            if (!missingPagesList) {
                console.error('❌ missingPagesList div bulunamadı!');
                return;
            }
            
            // Eksik sayfalar div'ini göster
            missingPagesDiv.classList.remove('hidden');
            console.log(`✅ Eksik sayfalar div'i gösterildi`);
            
            // Liste temizle
            missingPagesList.innerHTML = '';
            
            // Her eksik sayfa için badge oluştur
            missingPages.forEach(pageNumber => {
                const badge = document.createElement('button');
                badge.className = 'px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium transition-colors';
                badge.textContent = `Sayfa ${pageNumber}`;
                badge.title = `Sayfa ${pageNumber} - Eksik veri çekildi, manuel HTML ile ekleyebilirsiniz`;
                badge.onclick = () => {
                    console.log(`📝 Sayfa ${pageNumber} için manuel HTML modal açılıyor`);
                    this.openManualHtmlModal(pageNumber);
                };
                missingPagesList.appendChild(badge);
            });
            
            console.log(`✅ ${missingPages.length} eksik sayfa badge'i oluşturuldu`);
            
            // Manuel HTML gir butonunu da bağla
            const openManualHtmlModalBtn = document.getElementById('openManualHtmlModalBtn');
            if (openManualHtmlModalBtn) {
                openManualHtmlModalBtn.onclick = () => {
                    this.openManualHtmlModal(null);
                };
            }
        }
        
        // Manuel HTML modalını aç
        openManualHtmlModal(pageNumber) {
            const modal = document.getElementById('manualHtmlModal');
            const pageNumberInput = document.getElementById('manualHtmlPageNumber');
            
            if (modal) {
                modal.classList.remove('hidden');
                if (pageNumberInput && pageNumber) {
                    pageNumberInput.value = pageNumber;
                }
            }
        }
        
        // Manuel HTML analiz et ve ekle
        async analyzeManualHtml(htmlContent, pageNumber) {
            try {
                const progressDiv = document.getElementById('manualHtmlProgress');
                const progressText = document.getElementById('manualHtmlProgressText');
                
                if (progressDiv) {
                    progressDiv.classList.remove('hidden');
                }
                if (progressText) {
                    progressText.textContent = 'HTML analiz ediliyor...';
                }
                
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        window.removeEventListener('message', listener);
                        reject(new Error('Extension yanıt vermedi (timeout).'));
                    }, 30000); // 30 saniye
                    
                    const listener = (event) => {
                        if (event.data && event.data.type === 'WAREHOUSE_MANUAL_HTML_RESPONSE') {
                            clearTimeout(timeout);
                            window.removeEventListener('message', listener);
                            
                            const response = event.data;
                            
                            if (!response.success) {
                                if (progressText) {
                                    progressText.textContent = `❌ Hata: ${response.error}`;
                                }
                                reject(new Error(response.error));
                                return;
                            }
                            
                            if (progressText) {
                                progressText.textContent = `✅ ${response.total} ürün başarıyla parse edildi!`;
                            }
                            
                            // Parse edilen verileri mevcut array'e ekle
                            if (response.data && response.data.length > 0) {
                                if (!this.fetchedShelfLabels) {
                                    this.fetchedShelfLabels = [];
                                }
                                this.fetchedShelfLabels = this.fetchedShelfLabels.concat(response.data);
                                
                                // Eksik sayfalar listesinden bu sayfayı kaldır
                                if (this.missingPages && this.missingPages.includes(pageNumber)) {
                                    this.missingPages = this.missingPages.filter(p => p !== pageNumber);
                                    console.log(`✅ Sayfa ${pageNumber} eksik sayfalar listesinden kaldırıldı. Kalan: ${this.missingPages.length}`);
                                }
                                
                                const missingPagesList = document.getElementById('missingPagesList');
                                if (missingPagesList) {
                                    const badges = missingPagesList.querySelectorAll('button');
                                    badges.forEach(badge => {
                                        if (badge.textContent.includes(`Sayfa ${pageNumber}`)) {
                                            badge.remove();
                                        }
                                    });
                                    
                                    // Eğer hiç eksik sayfa kalmadıysa div'i gizle
                                    if (missingPagesList.children.length === 0) {
                                        const missingPagesDiv = document.getElementById('shelfLabelMissingPages');
                                        if (missingPagesDiv) {
                                            missingPagesDiv.classList.add('hidden');
                                        }
                                    }
                                }
                                
                                // Karşılaştırma sonuçlarındaki eksik sayfalar listesini de güncelle
                                const missingPagesListInComparison = document.getElementById('missingPagesListInComparison');
                                if (missingPagesListInComparison) {
                                    const comparisonBadges = missingPagesListInComparison.querySelectorAll('button');
                                    comparisonBadges.forEach(badge => {
                                        const onclickAttr = badge.getAttribute('onclick');
                                        if (onclickAttr && onclickAttr.includes(`openManualHtmlModal(${pageNumber})`)) {
                                            badge.remove();
                                        }
                                    });
                                    
                                    // Eğer hiç eksik sayfa kalmadıysa info div'ini gizle
                                    if (missingPagesListInComparison.children.length === 0) {
                                        const missingPagesInfo = document.getElementById('missingPagesInfo');
                                        if (missingPagesInfo) {
                                            missingPagesInfo.classList.add('hidden');
                                        }
                                    }
                                }
                                
                                // Sonuçları güncelle
                                const resultsText = document.getElementById('shelfLabelResultsText');
                                if (resultsText) {
                                    resultsText.textContent = `Toplam ${this.fetchedShelfLabels.length} raf etiketi çekildi. JSON olarak indirebilir veya mevcut products.json ile karşılaştırabilirsiniz.`;
                                }
                                
                                console.log(`✅ Sayfa ${pageNumber} için ${response.total} ürün eklendi. Toplam: ${this.fetchedShelfLabels.length}`);
                            }
                            
                            resolve(response.data);
                        }
                    };
                    
                    window.addEventListener('message', listener);
                    
                    // Extension'a mesaj gönder
                    window.postMessage({
                        type: 'WAREHOUSE_PARSE_MANUAL_HTML',
                        htmlContent: htmlContent,
                        pageNumber: pageNumber
                    }, '*');
                });
            } catch (error) {
                console.error('❌ Manuel HTML analiz hatası:', error);
                throw error;
            }
        }
        
        // MongoDB ObjectId formatında benzersiz ID üretme
        generateObjectId() {
            // 24 karakter hex string (MongoDB ObjectId formatı)
            const timestamp = Math.floor(Date.now() / 1000).toString(16);
            const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            return (timestamp + random).substring(0, 24);
        }

        // Ürünü products.json formatına dönüştür
        formatProductForJSON(productData) {
            const product = {
                id: this.generateObjectId(),
                name: productData.name || '',
                category: productData.category || 'Genel',
                brand: productData.brand || '',
                description: productData.description || productData.name || '',
                image: productData.image || '',
                barcodes: [],
                shelf: productData.shelf || '-',
                price: productData.price || null,
                stock: productData.stock || null
            };

            // Barkod ekle
            if (productData.barcode) {
                product.barcodes.push({
                    code: productData.barcode.toString().trim(),
                    type: 'EAN-13',
                    size: productData.size || '',
                    variant: productData.variant || ''
                });
            }

            return product;
        }

        // Ürünün zaten var olup olmadığını kontrol et
        checkProductExists(product, existingProducts) {
            const productName = (product.name || '').toLowerCase().trim();
            const productBarcode = (product.barcode || '').toString().trim();

            if (!productName && !productBarcode) {
                return { exists: false, reason: 'missing_data' };
            }

            for (const existing of existingProducts) {
                // Barkod kontrolü
                if (productBarcode && existing.barcodes && Array.isArray(existing.barcodes)) {
                    for (const barcode of existing.barcodes) {
                        if (barcode.code && barcode.code.toString().trim() === productBarcode) {
                            return { exists: true, reason: 'barcode', existingProduct: existing };
                        }
                    }
                }

                // Ürün adı kontrolü (case-insensitive)
                const existingName = (existing.name || '').toLowerCase().trim();
                if (productName && existingName && productName === existingName) {
                    return { exists: true, reason: 'name', existingProduct: existing };
                }
            }

            return { exists: false, reason: 'new' };
        }

        // HTML tablo verilerini analiz et
        async analyzeProducts(htmlContent) {
            try {
                console.log('🔄 Starting product analysis...');

                // HTML tablodan veri çıkar
                const parsedProducts = this.parseHTMLTable(htmlContent);

                // Products.json'u yükle (file input'u geç)
                const fileInput = this.currentFileInput || document.getElementById('productsJsonFileInput');
                const existingProducts = await this.loadProductsJSON(fileInput);

                // Analiz sonuçları
                const results = {
                    new: [],
                    existing: [],
                    errors: [],
                    timestamp: new Date().toISOString(),
                    source: htmlContent.substring(0, 100) + '...' // İlk 100 karakter
                };

                // Her ürünü kontrol et
                for (const parsedProduct of parsedProducts) {
                    try {
                        const formattedProduct = this.formatProductForJSON(parsedProduct);
                        const checkResult = this.checkProductExists(formattedProduct, existingProducts);

                        if (checkResult.exists) {
                            results.existing.push({
                                product: formattedProduct,
                                reason: checkResult.reason,
                                existingProduct: checkResult.existingProduct
                            });
                        } else {
                            results.new.push(formattedProduct);
                        }
                    } catch (error) {
                        results.errors.push({
                            product: parsedProduct,
                            error: error.message
                        });
                    }
                }

                // Mevcut analiz sonucunu güncelle
                this.analysisResults = results;

                // Tüm analiz sonuçlarına ekle (sil diyene kadar tutulacak)
                this.allAnalysisResults.push(results);

                console.log(`✅ Analysis complete: ${results.new.length} new, ${results.existing.length} existing, ${results.errors.length} errors`);
                return results;
            } catch (error) {
                console.error('❌ Error analyzing products:', error);
                throw error;
            }
        }

        // Barkod ile arama
        searchByBarcode(barcode, products = null) {
            try {
                const searchCode = barcode.toString().trim();
                if (!searchCode) {
                    return [];
                }

                const searchProducts = products || this.productsCache;
                if (!searchProducts || !Array.isArray(searchProducts)) {
                    return [];
                }

                const results = [];

                for (const product of searchProducts) {
                    if (product.barcodes && Array.isArray(product.barcodes)) {
                        for (const barcodeObj of product.barcodes) {
                            if (barcodeObj.code && barcodeObj.code.toString().trim() === searchCode) {
                                results.push({
                                    product: product,
                                    barcode: barcodeObj
                                });
                                break; // Aynı ürünü tekrar ekleme
                            }
                        }
                    }
                }

                return results;
            } catch (error) {
                console.error('❌ Error searching by barcode:', error);
                return [];
            }
        }

        // Yeni ürünleri hafızada tut (dosya indirme yok)
        addProductsToMemory(newProducts) {
            try {
                if (!newProducts || newProducts.length === 0) {
                    throw new Error('Eklenecek ürün yok');
                }

                console.log(`💾 Adding ${newProducts.length} products to memory...`);

                // Tüm analiz sonuçlarından yeni ürünleri topla
                let allNewProducts = [];
                
                // Mevcut analiz sonuçlarından yeni ürünleri al
                for (const result of this.allAnalysisResults) {
                    if (result.new && Array.isArray(result.new)) {
                        allNewProducts = [...allNewProducts, ...result.new];
                    }
                }

                // Tekrarları kaldır (id'ye göre)
                const uniqueProducts = [];
                const seenIds = new Set();
                for (const product of allNewProducts) {
                    if (!seenIds.has(product.id)) {
                        seenIds.add(product.id);
                        uniqueProducts.push(product);
                    }
                }

                console.log(`✅ Total unique products in memory: ${uniqueProducts.length}`);

                return {
                    success: true,
                    newProducts: newProducts,
                    totalInMemory: uniqueProducts.length,
                    allProducts: uniqueProducts
                };
            } catch (error) {
                console.error('❌ Error adding products to memory:', error);
                throw error;
            }
        }

        // Tüm hafızadaki ürünleri products.json formatında döndür
        getAllProductsFromMemory() {
            if (!this.productsCache) {
                throw new Error('Önce products.json dosyasını yükleyin!');
            }

            // Tüm analiz sonuçlarından yeni ürünleri topla
            let allNewProducts = [];
            
            for (const result of this.allAnalysisResults) {
                if (result.new && Array.isArray(result.new)) {
                    allNewProducts = [...allNewProducts, ...result.new];
                }
            }

            // Tekrarları kaldır (id'ye göre)
            const uniqueProducts = [];
            const seenIds = new Set();
            for (const product of allNewProducts) {
                if (!seenIds.has(product.id)) {
                    seenIds.add(product.id);
                    uniqueProducts.push(product);
                }
            }

            // Mevcut products.json ile birleştir
            const updatedProducts = [...this.productsCache, ...uniqueProducts];

            return {
                products: updatedProducts,
                newProducts: uniqueProducts,
                existingProducts: this.productsCache.length,
                totalProducts: updatedProducts.length
            };
        }

        // Hafızadaki tüm analiz sonuçlarını temizle
        clearAllAnalysisResults() {
            this.allAnalysisResults = [];
            this.analysisResults = [];
            console.log('🧹 All analysis results cleared from memory');
        }

        // Getir API'den tüm ürünleri çek (Chrome Extension üzerinden)
        async fetchAllProductsFromGetirAPI() {
            try {
                console.log('🚀 Getir API\'den ürünler çekiliyor (Extension üzerinden)...');
                
                // İlerleme göstergesini göster
                const progressDiv = document.getElementById('fetchProgress');
                const progressBar = document.getElementById('fetchProgressBar');
                const progressText = document.getElementById('fetchProgressText');
                const resultsDiv = document.getElementById('fetchResults');
                const resultsText = document.getElementById('fetchResultsText');
                
                if (progressDiv) {
                    progressDiv.classList.remove('hidden');
                    progressBar.style.width = '10%';
                    progressText.textContent = 'Extension\'a bağlanılıyor...';
                }
                
                // Önce localStorage'dan extension ID'sini kontrol et
                let extensionId = localStorage.getItem('getir_extension_id');
                
                if (extensionId) {
                    console.log('✅ Extension ID localStorage\'dan alındı:', extensionId);
                } else {
                    // Extension ID'yi bul
                    extensionId = await this.getExtensionId();
                    
                    if (!extensionId) {
                        // Extension bulunamadı - kullanıcıya manuel olarak extension ID'sini girmesini söyle
                        const manualId = prompt(
                            'Extension ID bulunamadı!\n\n' +
                            'Lütfen extension ID\'sini manuel olarak girin:\n\n' +
                            '1. Chrome\'da chrome://extensions/ adresine gidin\n' +
                            '2. "Getir Stock Bot Token Provider" extension\'ını bulun\n' +
                            '3. Extension ID\'sini kopyalayın (genellikle uzun bir harf-rakam kombinasyonu)\n' +
                            '4. Buraya yapıştırın\n\n' +
                            'Veya "İptal" deyip extension\'ı yeniden yükleyin ve sayfayı yenileyin.'
                        );
                        
                        if (manualId && manualId.trim()) {
                            extensionId = manualId.trim();
                            localStorage.setItem('getir_extension_id', extensionId);
                            console.log('✅ Extension ID manuel olarak girildi:', extensionId);
                        } else {
                            throw new Error('Extension ID girilmedi. Lütfen extension\'ı yükleyin ve sayfayı yenileyin.');
                        }
                    } else {
                        // Extension ID'yi kaydet
                        localStorage.setItem('getir_extension_id', extensionId);
                        console.log('✅ Extension ID bulundu:', extensionId);
                    }
                }
                
                // Chrome Extension kontrolü
                if (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.sendMessage) {
                    throw new Error('Chrome Extension API\'lerine erişilemiyor!\n\nLütfen:\n1. Sayfayı HTTP sunucusu üzerinden açın (file:// protokolü çalışmaz)\n2. Örnek: python -m http.server 8000\n3. Sonra http://localhost:8000/admin.html adresini açın');
                }
                
                if (progressBar) {
                    progressBar.style.width = '30%';
                    progressText.textContent = 'Extension\'a bağlanılıyor...';
                }
                
                if (progressBar) {
                    progressBar.style.width = '40%';
                    progressText.textContent = 'Extension\'a bağlanılıyor...';
                }
                
                // Content script üzerinden mesaj gönder (window.postMessage)
                return new Promise((resolve, reject) => {
                    // Timeout ekle (300 saniye - ürün çekme uzun sürebilir, 8000+ ürün için)
                    const timeout = setTimeout(() => {
                        window.removeEventListener('message', messageListener);
                        window.removeEventListener('message', progressListener);
                        reject(new Error('Extension yanıt vermedi (timeout). Getir sitesi açık mı kontrol edin.'));
                    }, 300000); // 5 dakika
                    
                    // İlerleme mesajlarını dinle
                    const progressListener = (event) => {
                        if (event.data && event.data.type === 'GETIR_PROGRESS') {
                            if (progressText) {
                                progressText.textContent = event.data.message;
                            }
                            console.log('📊 İlerleme:', event.data.message);
                        }
                    };
                    
                    // Response listener
                    const messageListener = (event) => {
                        if (event.data && event.data.type === 'GETIR_EXPORT_PRODUCTS_RESPONSE') {
                            clearTimeout(timeout);
                            window.removeEventListener('message', messageListener);
                            window.removeEventListener('message', progressListener);
                            
                            const response = event.data;
                            
                            if (!response.success) {
                                const error = response.error || 'Ürünler çekilemedi';
                                if (progressText) {
                                    progressText.textContent = `❌ ${error}`;
                                    progressText.classList.add('text-red-600');
                                }
                                reject(new Error(error));
                                return;
                            }
                            
                            if (progressBar) {
                                progressBar.style.width = '100%';
                            }
                            
                            const products = response.products || [];
                            const total = response.total || products.length;
                            
                            if (progressText) {
                                progressText.textContent = `✅ ${total} ürün başarıyla çekildi ve dönüştürüldü`;
                            }
                            
                            // Sonuçları göster
                            if (resultsDiv) {
                                resultsDiv.classList.remove('hidden');
                                resultsText.textContent = `Toplam ${total} ürün çekildi. JSON olarak indirebilir veya eksik ürünleri bulabilirsiniz.`;
                            }
                            
                            // Ürünleri hafızada tut
                            this.fetchedProducts = products;
                            
                            console.log(`✅ ${total} ürün başarıyla çekildi`);
                            resolve(products);
                        }
                    };
                    
                    // Listener'ları ekle
                    window.addEventListener('message', messageListener);
                    window.addEventListener('message', progressListener);
                    
                    // İlk ilerleme mesajları
                    if (progressBar) {
                        progressBar.style.width = '10%';
                    }
                    if (progressText) {
                        progressText.textContent = '🔄 Extension\'a bağlanılıyor...';
                    }
                    
                    // Content script'e mesaj gönder
                    setTimeout(() => {
                        if (progressBar) {
                            progressBar.style.width = '20%';
                        }
                        if (progressText) {
                            progressText.textContent = '🔍 Getir sitesi kontrol ediliyor...';
                        }
                        
                        window.postMessage({
                            type: 'GETIR_EXPORT_PRODUCTS'
                        }, '*');
                        
                        console.log('📤 Admin panelden extension\'a mesaj gönderildi');
                    }, 100);
                });
                
            } catch (error) {
                console.error('❌ Getir API\'den ürün çekme hatası:', error);
                
                // Hata mesajını göster
                const progressText = document.getElementById('fetchProgressText');
                if (progressText) {
                    progressText.textContent = `❌ Hata: ${error.message}`;
                    progressText.classList.add('text-red-600');
                }
                
                throw error;
            }
        }

        // Chrome Extension ID'sini bul
        async getExtensionId() {
            try {
                // Önce window'dan extension ID'sini al (content script tarafından eklenmiş olabilir)
                if (window.getirExtensionId && window.getirExtensionAvailable) {
                    console.log('✅ Extension ID window\'dan alındı:', window.getirExtensionId);
                    return window.getirExtensionId;
                }
                
                // Extension'a mesaj göndererek ID'sini al
                // Tüm extension'lara mesaj gönder, hangisi yanıt verirse o bizim extension'ımız
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.error('❌ Extension bulunamadı - timeout');
                        resolve(null);
                    }, 3000);
                    
                    // Extension'a mesaj gönder
                    // chrome.runtime.sendMessage ID olmadan çalışmaz, bu yüzden farklı bir yöntem kullanmalıyız
                    // Alternatif: Tüm extension'ları tarayıp test et
                    
                    // En iyi yöntem: Extension'ın kendisini bulmak için manifest'teki name'i kullan
                    // Ama web sayfasından chrome.management API'sine erişemeyiz
                    
                    // Çözüm: Extension'a direkt mesaj göndermeyi dene (ID olmadan)
                    // Chrome'da bu çalışmaz, bu yüzden content script üzerinden yapmalıyız
                    
                    // Event dinle (extension hazır olduğunda)
                    window.addEventListener('getirExtensionReady', (event) => {
                        clearTimeout(timeout);
                        const extensionId = event.detail?.extensionId || window.getirExtensionId;
                        console.log('✅ Extension ID event\'ten alındı:', extensionId);
                        resolve(extensionId);
                    }, { once: true });
                    
                    // Eğer extension zaten hazırsa hemen döndür
                    if (window.getirExtensionId) {
                        clearTimeout(timeout);
                        resolve(window.getirExtensionId);
                    }
                    
                    // Alternatif: Extension'ın ID'sini localStorage'dan al (eğer daha önce kaydedildiyse)
                    const savedExtensionId = localStorage.getItem('getir_extension_id');
                    if (savedExtensionId) {
                        clearTimeout(timeout);
                        console.log('✅ Extension ID localStorage\'dan alındı:', savedExtensionId);
                        // ID'nin hala geçerli olup olmadığını test et
                        this.testExtensionId(savedExtensionId).then(isValid => {
                            if (isValid) {
                                resolve(savedExtensionId);
                            } else {
                                localStorage.removeItem('getir_extension_id');
                                resolve(null);
                            }
                        });
                        return;
                    }
                });
            } catch (error) {
                console.error('Extension ID bulunamadı:', error);
                return null;
            }
        }
        
        // Extension ID'sinin geçerli olup olmadığını test et
        async testExtensionId(extensionId) {
            return new Promise((resolve) => {
                try {
                    chrome.runtime.sendMessage(extensionId, {
                        type: 'GET_EXTENSION_ID'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            resolve(false);
                            return;
                        }
                        if (response && response.success) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                } catch (error) {
                    resolve(false);
                }
            });
        }
        
        // Tüm extension'lara mesaj göndererek bizim extension'ı bul
        async findExtensionById() {
            return new Promise((resolve) => {
                // Chrome'da web sayfasından extension ID'sini bulmak için
                // Extension'ın kendi ID'sini window'a eklemesi gerekiyor
                // Ama content script çalışmıyorsa, başka bir yöntem kullanmalıyız
                
                // Çözüm: Extension'ın popup'ından veya başka bir yöntemle ID'yi al
                // En basit: Kullanıcıdan extension ID'sini manuel olarak girmesini iste
                // Ama daha iyi: Extension'ın kendi ID'sini bir endpoint'e kaydetmesi
                
                // Şimdilik: Extension'ın ID'sini localStorage'dan al veya null döndür
                const savedId = localStorage.getItem('getir_extension_id');
                if (savedId) {
                    this.testExtensionId(savedId).then(isValid => {
                        if (isValid) {
                            resolve(savedId);
                        } else {
                            resolve(null);
                        }
                    });
                } else {
                    resolve(null);
                }
            });
        }
        
        // Extension'ın çalışıp çalışmadığını test et
        async testExtensionConnection(extensionId) {
            return new Promise((resolve) => {
                try {
                    // Önce basit bir mesaj gönder (GET_EXTENSION_ID)
                    chrome.runtime.sendMessage(extensionId, {
                        type: 'GET_EXTENSION_ID'
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Extension bağlantı testi başarısız:', chrome.runtime.lastError.message);
                            resolve(false);
                            return;
                        }
                        
                        if (response && response.success) {
                            console.log('✅ Extension bağlantı testi başarılı:', response.extensionId);
                            resolve(true);
                        } else {
                            console.warn('⚠️ Extension yanıt vermedi');
                            resolve(false);
                        }
                    });
                } catch (error) {
                    console.error('❌ Extension test hatası:', error);
                    resolve(false);
                }
            });
        }

        // Çekilen ürünleri products.json ile karşılaştır ve eksik ürünleri bul
        async findMissingProducts(fetchedProducts = null) {
            try {
                const products = fetchedProducts || this.fetchedProducts;
                
                if (!products || products.length === 0) {
                    throw new Error('Önce ürünleri çekmelisiniz!');
                }
                
                console.log('🔍 Eksik ürünler aranıyor...');
                
                // Mevcut products.json'u yükle
                const existingProducts = await this.loadProductsJSON();
                
                // Eksik ürünleri bul
                const missingProducts = [];
                const existingProductsMap = new Map();
                
                // Mevcut ürünleri index'le (barkod ve ID'ye göre)
                for (const existing of existingProducts) {
                    // Barkodlara göre index'le
                    if (existing.barcodes && Array.isArray(existing.barcodes)) {
                        for (const barcode of existing.barcodes) {
                            if (barcode.code) {
                                existingProductsMap.set(`barcode:${barcode.code}`, existing);
                            }
                        }
                    }
                    // ID'ye göre index'le
                    if (existing.id) {
                        existingProductsMap.set(`id:${existing.id}`, existing);
                    }
                }
                
                // Çekilen ürünleri kontrol et
                for (const fetched of products) {
                    let found = false;
                    
                    // Önce barkod ile kontrol et
                    if (fetched.barcodes && Array.isArray(fetched.barcodes)) {
                        for (const barcode of fetched.barcodes) {
                            if (barcode.code && existingProductsMap.has(`barcode:${barcode.code}`)) {
                                found = true;
                                break;
                            }
                        }
                    }
                    
                    // Barkod ile bulunamazsa ID ile kontrol et
                    if (!found && fetched.id && existingProductsMap.has(`id:${fetched.id}`)) {
                        found = true;
                    }
                    
                    // Bulunamadıysa eksik ürünler listesine ekle
                    if (!found) {
                        missingProducts.push(fetched);
                    }
                }
                
                console.log(`✅ ${missingProducts.length} eksik ürün bulundu (toplam ${products.length} ürün)`);
                
                // Analiz sonuçlarını oluştur
                const analysisResults = {
                    new: missingProducts,
                    existing: products.filter(p => !missingProducts.includes(p)),
                    errors: [],
                    timestamp: new Date().toISOString(),
                    source: 'Getir API'
                };
                
                // Mevcut analiz sonuçlarına ekle
                this.analysisResults = analysisResults;
                this.allAnalysisResults.push(analysisResults);
                
                // UI'da göster
                this.displayAnalysisResults(analysisResults);
                
                return {
                    missing: missingProducts,
                    existing: products.length - missingProducts.length,
                    total: products.length
                };
                
            } catch (error) {
                console.error('❌ Eksik ürün bulma hatası:', error);
                throw error;
            }
        }

        // Analiz sonuçlarını UI'da göster
        displayAnalysisResults(results) {
            const resultsDiv = document.getElementById('analysisResults');
            const resultsBody = document.getElementById('analysisResultsBody');
            const newCount = document.getElementById('newProductsCount');
            const existingCount = document.getElementById('existingProductsCount');
            const errorCount = document.getElementById('errorProductsCount');
            
            if (!resultsDiv || !resultsBody) return;
            
            // Sonuçları göster
            resultsDiv.classList.remove('hidden');
            
            // Sayıları güncelle
            if (newCount) newCount.textContent = `${results.new.length} yeni ürün`;
            if (existingCount) existingCount.textContent = `${results.existing.length} zaten var`;
            if (errorCount) errorCount.textContent = `${results.errors.length} hata`;
            
            // Tabloyu temizle
            resultsBody.innerHTML = '';
            
            // Yeni ürünleri göster
            for (const product of results.new) {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                
                const checkbox = document.createElement('td');
                checkbox.className = 'px-4 py-3';
                checkbox.innerHTML = `<input type="checkbox" class="product-checkbox rounded" data-product-id="${product.id}">`;
                
                const status = document.createElement('td');
                status.className = 'px-4 py-3';
                status.innerHTML = '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Yeni</span>';
                
                const name = document.createElement('td');
                name.className = 'px-4 py-3 text-sm text-gray-900';
                const productImage = product.image && product.image.trim() && !product.image.includes('placeholder')
                    ? product.image
                    : null;
                name.innerHTML = productImage 
                    ? `<div class="flex items-center gap-2">
                         <img src="${productImage}" 
                              alt="${(product.name || 'Ürün').replace(/"/g, '&quot;')}" 
                              class="w-10 h-10 object-cover rounded flex-shrink-0"
                              onerror="this.style.display='none'"
                              loading="lazy">
                         <span>${product.name || 'Bilinmeyen'}</span>
                       </div>`
                    : `<div class="flex items-center gap-2">
                         <div class="w-10 h-10 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                           <span>Görsel Yok</span>
                         </div>
                         <span>${product.name || 'Bilinmeyen'}</span>
                       </div>`;
                
                const barcode = document.createElement('td');
                barcode.className = 'px-4 py-3 text-sm text-gray-600';
                barcode.textContent = product.barcodes && product.barcodes.length > 0 
                    ? product.barcodes[0].code 
                    : 'Yok';
                
                const category = document.createElement('td');
                category.className = 'px-4 py-3 text-sm text-gray-600';
                category.textContent = product.category || 'Genel';
                
                const brand = document.createElement('td');
                brand.className = 'px-4 py-3 text-sm text-gray-600';
                brand.textContent = product.brand || '-';
                
                row.appendChild(checkbox);
                row.appendChild(status);
                row.appendChild(name);
                row.appendChild(barcode);
                row.appendChild(category);
                row.appendChild(brand);
                
                resultsBody.appendChild(row);
            }
        }

        // Çekilen ürünleri JSON olarak indir
        downloadProductsAsJSON(products = null) {
            try {
                const productsToDownload = products || this.fetchedProducts;
                
                if (!productsToDownload || productsToDownload.length === 0) {
                    throw new Error('İndirilecek ürün yok!');
                }
                
                const data = {
                    products: productsToDownload
                };
                
                const jsonString = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `getir_products_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(url);
                
                console.log(`✅ ${productsToDownload.length} ürün JSON olarak indirildi`);
            } catch (error) {
                console.error('❌ JSON indirme hatası:', error);
                throw error;
            }
        }

        // Warehouse'dan raf etiketlerini çek (Chrome Extension üzerinden)
        async fetchShelfLabelsFromWarehouse() {
            try {
                console.log('🏷️ Warehouse\'dan raf etiketleri çekiliyor (Extension üzerinden)...');
                
                // İlerleme göstergesini göster
                const progressDiv = document.getElementById('shelfLabelProgress');
                const progressBar = document.getElementById('shelfLabelProgressBar');
                const progressText = document.getElementById('shelfLabelProgressText');
                const resultsDiv = document.getElementById('shelfLabelResults');
                const resultsText = document.getElementById('shelfLabelResultsText');
                
                if (progressDiv) {
                    progressDiv.classList.remove('hidden');
                    progressBar.style.width = '10%';
                    progressText.textContent = 'Extension\'a bağlanılıyor...';
                }
                
                // Önce localStorage'dan extension ID'sini kontrol et
                let extensionId = localStorage.getItem('getir_warehouse_extension_id');
                
                if (extensionId) {
                    console.log('✅ Warehouse Extension ID localStorage\'dan alındı:', extensionId);
                } else {
                    // Extension ID'yi bul
                    extensionId = await this.getWarehouseExtensionId();
                    
                    if (!extensionId) {
                        throw new Error('Warehouse Extension bulunamadı. Lütfen extension\'ı yükleyin ve sayfayı yenileyin.');
                    } else {
                        localStorage.setItem('getir_warehouse_extension_id', extensionId);
                        console.log('✅ Warehouse Extension ID bulundu:', extensionId);
                    }
                }
                
                // Chrome Extension kontrolü
                if (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.sendMessage) {
                    throw new Error('Chrome Extension API\'lerine erişilemiyor!');
                }
                
                if (progressBar) {
                    progressBar.style.width = '20%';
                    progressText.textContent = 'Extension\'a bağlanılıyor...';
                }
                
                // Yavaş çek modu checkbox'ını kontrol et
                const slowModeCheckbox = document.getElementById('slowModeCheckbox');
                const slowMode = slowModeCheckbox ? slowModeCheckbox.checked : false;
                const slowModeDelayInput = document.getElementById('slowModeDelay');
                const slowModeDelay = slowMode && slowModeDelayInput ? parseInt(slowModeDelayInput.value) || 2000 : 2000;
                
                // Content script üzerinden mesaj gönder (window.postMessage)
                return new Promise((resolve, reject) => {
                    // Timeout ekle (600 saniye = 10 dakika - 86 sayfa için yeterli)
                    let timeout = setTimeout(() => {
                        window.removeEventListener('message', messageListener);
                        window.removeEventListener('message', progressListener);
                        reject(new Error('Extension yanıt vermedi (timeout). Warehouse sitesi açık mı kontrol edin.'));
                    }, 600000); // 10 dakika
                    
                    // Timeout'u resetleme fonksiyonu
                    const resetTimeout = () => {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => {
                            window.removeEventListener('message', messageListener);
                            window.removeEventListener('message', progressListener);
                            reject(new Error('Extension yanıt vermedi (timeout). Warehouse sitesi açık mı kontrol edin.'));
                        }, 600000); // Her progress mesajında timeout'u resetle
                    };
                    
                    // İlerleme mesajlarını dinle
                    const progressListener = (event) => {
                        if (event.data && event.data.type === 'WAREHOUSE_SHELF_LABEL_PROGRESS') {
                            if (progressText) {
                                progressText.textContent = event.data.message;
                            }
                            console.log('📊 İlerleme:', event.data.message);
                            
                            // Progress mesajı geldiğinde timeout'u resetle
                            resetTimeout();
                            
                            // Progress bar'ı güncelle
                            if (progressBar && event.data.message.includes('%')) {
                                const match = event.data.message.match(/(\d+)%/);
                                if (match) {
                                    progressBar.style.width = match[1] + '%';
                                }
                            }
                        }
                    };
                    
                    // Response listener
                    const messageListener = (event) => {
                        if (event.data && event.data.type === 'WAREHOUSE_SHELF_LABEL_RESPONSE') {
                            clearTimeout(timeout);
                            window.removeEventListener('message', messageListener);
                            window.removeEventListener('message', progressListener);
                            
                            const response = event.data;
                            
                            if (!response.success) {
                                const error = response.error || 'Raf etiketleri çekilemedi';
                                if (progressText) {
                                    progressText.textContent = `❌ ${error}`;
                                }
                                reject(new Error(error));
                                return;
                            }
                            
                            if (progressBar) {
                                progressBar.style.width = '100%';
                            }
                            
                            const data = response.data || [];
                            const total = response.total || data.length;
                            const missingPages = response.missingPages || [];
                            
                            console.log(`✅ ${total} raf etiketi başarıyla çekildi`);
                            if (missingPages.length > 0) {
                                console.log(`⚠️ Eksik sayfalar: ${missingPages.join(', ')}`);
                            }
                            
                            if (progressText) {
                                progressText.textContent = `✅ ${total} raf etiketi başarıyla çekildi${missingPages.length > 0 ? ` (${missingPages.length} sayfa eksik)` : ''}`;
                            }
                            
                            // Progress div'i gizle
                            if (progressDiv) {
                                progressDiv.classList.add('hidden');
                            }
                            
                            // Sonuçları göster
                            if (resultsDiv) {
                                resultsDiv.classList.remove('hidden');
                                resultsText.textContent = `Toplam ${total} raf etiketi çekildi. JSON olarak indirebilir veya mevcut products.json ile karşılaştırabilirsiniz.`;
                            }
                            
                            // Eksik sayfaları göster (MUTLAKA!)
                            if (missingPages.length > 0) {
                                console.log(`📋 Eksik sayfaları gösteriliyor: ${missingPages.length} sayfa`);
                                this.displayMissingPages(missingPages);
                            } else {
                                // Eksik sayfa yoksa div'i gizle
                                const missingPagesDiv = document.getElementById('shelfLabelMissingPages');
                                if (missingPagesDiv) {
                                    missingPagesDiv.classList.add('hidden');
                                }
                            }
                            
                            // Verileri hafızada tut
                            this.fetchedShelfLabels = data;
                            this.missingPages = missingPages; // Eksik sayfaları da sakla
                            
                            resolve(data);
                        }
                    };
                    
                    // Listener'ları ekle
                    window.addEventListener('message', messageListener);
                    window.addEventListener('message', progressListener);
                    
                    // İlk ilerleme mesajları
                    if (progressBar) {
                        progressBar.style.width = '10%';
                    }
                    if (progressText) {
                        progressText.textContent = '🔄 Extension\'a bağlanılıyor...';
                    }
                    
                    // Content script'e mesaj gönder
                    setTimeout(() => {
                        if (progressBar) {
                            progressBar.style.width = '20%';
                        }
                        if (progressText) {
                            progressText.textContent = '🔍 Warehouse sitesi kontrol ediliyor...';
                        }
                        
                        window.postMessage({
                            type: 'WAREHOUSE_EXPORT_SHELF_LABELS',
                            slowMode: slowMode,
                            slowModeDelay: slowModeDelay
                        }, '*');
                        
                        console.log('📤 Admin panelden warehouse extension\'a mesaj gönderildi');
                    }, 100);
                });
                
            } catch (error) {
                console.error('❌ Warehouse\'dan raf etiketi çekme hatası:', error);
                
                // Hata mesajını göster
                const progressText = document.getElementById('shelfLabelProgressText');
                if (progressText) {
                    progressText.textContent = `❌ Hata: ${error.message}`;
                }
                
                throw error;
            }
        }

        // Warehouse Extension ID'sini bul
        async getWarehouseExtensionId() {
            try {
                // Önce window'dan extension ID'sini al (content script tarafından eklenmiş olabilir)
                if (window.getirWarehouseExtensionId && window.getirWarehouseExtensionAvailable) {
                    console.log('✅ Warehouse Extension ID window\'dan alındı:', window.getirWarehouseExtensionId);
                    return window.getirWarehouseExtensionId;
                }
                
                // Extension'a mesaj göndererek ID'sini al
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.error('❌ Warehouse Extension bulunamadı - timeout');
                        resolve(null);
                    }, 3000);
                    
                    // Extension'a mesaj gönder
                    window.postMessage({
                        type: 'GET_WAREHOUSE_EXTENSION_ID'
                    }, '*');
                    
                    // Extension'dan gelen yanıtı dinle
                    const listener = (event) => {
                        if (event.data && event.data.type === 'WAREHOUSE_EXTENSION_ID_RESPONSE') {
                            clearTimeout(timeout);
                            window.removeEventListener('message', listener);
                            resolve(event.data.extensionId);
                        }
                    };
                    
                    window.addEventListener('message', listener);
                });
            } catch (error) {
                console.error('❌ Warehouse Extension ID bulma hatası:', error);
                return null;
            }
        }

        // Raf etiketlerini JSON olarak indir (products.json formatında)
        downloadShelfLabelsJSON() {
            try {
                if (!this.fetchedShelfLabels || this.fetchedShelfLabels.length === 0) {
                    throw new Error('İndirilecek raf etiketi verisi yok. Lütfen önce raf etiketlerini çekin.');
                }
                
                // Products.json formatına dönüştür (DOĞRU SIRALAMA: id, name, category, brand, description, image, barcodes, shelf, price, stock)
                const productsData = {
                    products: this.fetchedShelfLabels.map(product => {
                        // Sıralamayı düzelt: id, name, category, brand, description, image, barcodes, shelf, price, stock
                        return {
                            id: product.id,
                            name: product.name,
                            category: product.category,
                            brand: product.brand,
                            description: product.description,
                            image: product.image,
                            barcodes: product.barcodes,
                            shelf: product.shelf,
                            price: product.price,
                            stock: product.stock
                        };
                    })
                };
                
                const jsonString = JSON.stringify(productsData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `warehouse_shelf_labels_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(url);
                
                console.log(`✅ ${this.fetchedShelfLabels.length} raf etiketi JSON olarak indirildi (products.json formatında)`);
            } catch (error) {
                console.error('❌ JSON indirme hatası:', error);
                throw error;
            }
        }
        
        // Warehouse verisini direkt products.json'a aktar (karşılaştırma yapmadan)
        async importWarehouseToProducts() {
            try {
                if (!this.fetchedShelfLabels || this.fetchedShelfLabels.length === 0) {
                    throw new Error('Aktarılacak raf etiketi verisi yok. Lütfen önce raf etiketlerini çekin.');
                }
                
                // Onay al
                const confirmed = confirm(
                    `⚠️ DİKKAT!\n\n` +
                    `${this.fetchedShelfLabels.length} ürün direkt products.json'a aktarılacak.\n\n` +
                    `Bu işlem:\n` +
                    `- Mevcut products.json dosyasını YEDEKLEYECEK\n` +
                    `- Warehouse verisini products.json'a YAZACAK\n` +
                    `- Karşılaştırma YAPMAYACAK (tüm ürünler direkt eklenecek)\n\n` +
                    `Devam etmek istiyor musunuz?`
                );
                
                if (!confirmed) {
                    return;
                }
                
                console.log(`📥 Warehouse verisi products.json'a aktarılıyor: ${this.fetchedShelfLabels.length} ürün...`);
                
                // Mevcut products.json'ı yükle (yedek için)
                const existingProducts = await this.loadProductsJSON(null, true);
                
                // Warehouse verisini products.json formatına dönüştür (DOĞRU SIRALAMA)
                const warehouseProducts = this.fetchedShelfLabels.map(product => {
                    // Sıralamayı düzelt: id, name, category, brand, description, image, barcodes, shelf, price, stock
                    return {
                        id: product.id,
                        name: product.name,
                        category: product.category || 'Genel',
                        brand: product.brand || '',
                        description: product.description || product.name,
                        image: product.image || '',
                        barcodes: product.barcodes || [],
                        shelf: product.shelf || '-', // MUTLAKA VAR
                        price: product.price || null,
                        stock: product.stock || null
                    };
                });
                
                // Yeni products.json oluştur
                const newProductsData = {
                    products: warehouseProducts
                };
                
                // JSON string'e çevir
                const jsonString = JSON.stringify(newProductsData, null, 2);
                
                // Yedek oluştur (mevcut products.json'ı kaydet)
                const backupData = {
                    products: existingProducts,
                    backupDate: new Date().toISOString(),
                    originalCount: existingProducts.length,
                    warehouseCount: warehouseProducts.length
                };
                const backupJsonString = JSON.stringify(backupData, null, 2);
                const backupBlob = new Blob([backupJsonString], { type: 'application/json' });
                const backupUrl = URL.createObjectURL(backupBlob);
                const backupA = document.createElement('a');
                backupA.href = backupUrl;
                backupA.download = `products_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
                document.body.appendChild(backupA);
                backupA.click();
                document.body.removeChild(backupA);
                URL.revokeObjectURL(backupUrl);
                
                console.log(`💾 Yedek oluşturuldu: ${existingProducts.length} ürün`);
                
                // Yeni products.json'ı indir
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'products.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`✅ ${warehouseProducts.length} ürün products.json'a aktarıldı!`);
                alert(`✅ Başarılı!\n\n` +
                      `- Yedek oluşturuldu: ${existingProducts.length} ürün\n` +
                      `- Warehouse verisi aktarıldı: ${warehouseProducts.length} ürün\n\n` +
                      `Şimdi indirilen products.json dosyasını projenin kök dizinine kopyalayın ve temp products işlemini çalıştırın.`);
            } catch (error) {
                console.error('❌ Warehouse verisi aktarma hatası:', error);
                alert(`❌ Hata: ${error.message}`);
                throw error;
            }
        }

        // Temp Products Güncelle (products.json'dan temp_products.js oluştur)
        async updateTempProducts() {
            try {
                console.log('📖 products.json dosyası okunuyor...');
                
                // products.json'ı yükle
                const productsData = await this.loadProductsJSON(null, true);
                
                if (!productsData || !Array.isArray(productsData)) {
                    throw new Error('products.json geçersiz format!');
                }
                
                console.log(`✅ ${productsData.length} ürün bulundu`);
                
                // temp_products.js formatına dönüştür
                const productsDataObj = {
                    products: productsData
                };
                
                // temp_products.js içeriğini oluştur
                const jsContent = `const PRODUCTS_DATA = ${JSON.stringify(productsDataObj, null, 2)};`;
                
                // Dosyayı indir
                const blob = new Blob([jsContent], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'temp_products.js';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`✅ temp_products.js dosyası oluşturuldu!`);
                console.log(`📊 Toplam ürün sayısı: ${productsData.length}`);
                
                alert(`✅ Başarılı!\n\n` +
                      `- ${productsData.length} ürün bulundu\n` +
                      `- temp_products.js dosyası indirildi\n\n` +
                      `İndirilen dosyayı pages klasörüne kopyalayın.`);
            } catch (error) {
                console.error('❌ Temp products güncelleme hatası:', error);
                alert(`❌ Hata: ${error.message}`);
                throw error;
            }
        }

        // Raf etiketlerini products.json ile karşılaştır
        async compareShelfLabelsWithProducts(shelfLabels = null) {
            try {
                // Öncelik sırası: 1) Parametre olarak verilen, 2) Manuel yüklenen, 3) Çekilen
                const labelsToCompare = shelfLabels || this.manualShelfLabels || this.fetchedShelfLabels;
                
                if (!labelsToCompare || labelsToCompare.length === 0) {
                    throw new Error('Karşılaştırılacak raf etiketi verisi yok. Lütfen önce raf etiketlerini çekin veya dosya yükleyin.');
                }
                
                console.log(`🔍 Karşılaştırma yapılıyor: ${labelsToCompare.length} ürün`);
                if (shelfLabels) {
                    console.log('📋 Parametre olarak verilen veri kullanılıyor');
                } else if (this.manualShelfLabels) {
                    console.log('📁 Manuel yüklenen dosya kullanılıyor');
                } else if (this.fetchedShelfLabels) {
                    console.log('🌐 Çekilen raf etiketleri kullanılıyor');
                }
                
                // Products.json'ı yükle (cache'i zorla yenile - en güncel veriyi kullan)
                // Eğer manuel dosya yüklendiyse, o dosyayı kullan
                const existingProducts = await this.loadProductsJSON(null, true);
                
                // Karşılaştır (SADECE BARKOD İLE - BASIT VE KESIN)
                const missingProducts = [];
                const existingProductsMap = new Map(); // Key: "barcode:CODE" (tüm varyasyonlar)
                
                // Tüm barkod varyasyonlarını oluştur (nokta, tire vs. temizle)
                const getBarcodeVariations = (code) => {
                    if (!code) return [];
                    const variations = new Set();
                    const str = String(code).trim();
                    
                    // Orijinal
                    variations.add(str);
                    
                    // Nokta/tire/boşluk temizlenmiş
                    const cleaned = str.replace(/[.\-\s]/g, '');
                    if (cleaned && cleaned !== str && cleaned.length >= 6) {
                        variations.add(cleaned);
                    }
                    
                    // Sadece sayılar (eğer farklıysa)
                    const numbersOnly = str.replace(/\D/g, '');
                    if (numbersOnly && numbersOnly.length >= 6 && numbersOnly !== str && numbersOnly !== cleaned) {
                        variations.add(numbersOnly);
                    }
                    
                    return Array.from(variations);
                };
                
                console.log('📦 Mevcut ürünler indexleniyor (BARKOD VARYASYONLARIYLA)...');
                let indexedCount = 0;
                
                // Mevcut ürünleri map'e ekle (SADECE BARKOD VARYASYONLARIYLA)
                for (const product of existingProducts) {
                    // Barkod ile index'le (TÜM VARYASYONLARLA)
                    if (product.barcodes && Array.isArray(product.barcodes)) {
                        for (const barcode of product.barcodes) {
                            if (barcode.code) {
                                const variations = getBarcodeVariations(barcode.code);
                                for (const variation of variations) {
                                    existingProductsMap.set(`barcode:${variation}`, product);
                                }
                            }
                        }
                    }
                    
                    indexedCount++;
                    if (indexedCount % 1000 === 0) {
                        console.log(`📦 ${indexedCount}/${existingProducts.length} ürün indexlendi...`);
                    }
                }
                
                console.log(`✅ ${indexedCount} ürün indexlendi. ${existingProductsMap.size} barkod varyasyonu oluşturuldu.`);
                
                // Çekilen raf etiketlerini kontrol et (SADECE BARKOD İLE - BASIT VE KESIN)
                console.log('🔍 Raf etiketleri kontrol ediliyor (BARKOD İLE)...');
                let checkedCount = 0;
                let foundByBarcode = 0;
                let notFound = 0;
                const notFoundDetails = []; // Debug için
                
                for (const shelfLabel of labelsToCompare) {
                    let found = false;
                    
                    // SADECE BARKOD İLE KONTROL ET
                    if (shelfLabel.barcodes && Array.isArray(shelfLabel.barcodes) && shelfLabel.barcodes.length > 0) {
                        for (const barcode of shelfLabel.barcodes) {
                            if (barcode.code) {
                                const variations = getBarcodeVariations(barcode.code);
                                for (const variation of variations) {
                                    if (existingProductsMap.has(`barcode:${variation}`)) {
                                        found = true;
                                        foundByBarcode++;
                                        break;
                                    }
                                }
                                if (found) break;
                            }
                        }
                    }
                    
                    // Eğer barkod yoksa veya bulunamadıysa, eksik ürünler listesine ekle
                    if (!found) {
                        missingProducts.push(shelfLabel);
                        notFound++;
                        
                        // İlk 20 bulunamayan ürünü logla (debug için)
                        if (notFound <= 20) {
                            const barcodeList = shelfLabel.barcodes && shelfLabel.barcodes.length > 0 
                                ? shelfLabel.barcodes.map(b => b.code).join(', ') 
                                : 'BARKOD YOK';
                            notFoundDetails.push({
                                name: shelfLabel.name,
                                id: shelfLabel.id,
                                barcodes: barcodeList
                            });
                        }
                    }
                    
                    checkedCount++;
                    // Her 100 üründe bir ilerleme göster
                    if (checkedCount % 100 === 0) {
                        console.log(`🔍 ${checkedCount}/${labelsToCompare.length} ürün kontrol edildi... (✅ Bulunan: ${foundByBarcode}, ❌ Bulunamayan: ${notFound})`);
                    }
                }
                
                // Bulunamayan ürünlerin detaylarını göster
                if (notFoundDetails.length > 0) {
                    console.log('❌ İlk 20 bulunamayan ürün (BARKOD KONTROLÜ):');
                    notFoundDetails.forEach((detail, idx) => {
                        console.log(`   ${idx + 1}. ${detail.name} (Barkod: ${detail.barcodes})`);
                    });
                }
                
                console.log(`📊 Karşılaştırma tamamlandı:`);
                console.log(`   ✅ Barkod ile bulunan: ${foundByBarcode}`);
                console.log(`   ❌ Bulunamayan (barkod yok veya eşleşme yok): ${notFound}`);
                console.log(`   📈 Toplam kontrol edilen: ${checkedCount}`);
                
                console.log(`📊 Karşılaştırma sonucu: ${missingProducts.length} eksik ürün bulundu`);
                
                // Sonuçları göster (üstte)
                const resultsText = document.getElementById('shelfLabelResultsText');
                if (resultsText) {
                    resultsText.innerHTML = `
                        <div class="mb-2">
                            <strong>Karşılaştırma Sonucu:</strong>
                        </div>
                        <div class="text-sm space-y-1">
                            <div>✅ Mevcut ürünler: ${existingProducts.length}</div>
                            <div>📋 Çekilen raf etiketleri: ${labelsToCompare.length}</div>
                            <div class="text-blue-600 font-medium">🔍 Eksik ürünler: ${missingProducts.length}</div>
                            ${this.missingPages && this.missingPages.length > 0 ? `<div class="text-yellow-600 font-medium">⚠️ Eksik sayfalar (100 ürün alınamayan): ${this.missingPages.length} sayfa (${this.missingPages.join(', ')})</div>` : ''}
                        </div>
                    `;
                }
                
                // Eksik ürünleri hafızada tut
                this.missingShelfLabelProducts = missingProducts;
                
                // Detaylı sonuçları sayfanın altında göster
                this.displayComparisonResults(existingProducts.length, labelsToCompare.length, missingProducts);
                
                return {
                    total: labelsToCompare.length,
                    existing: existingProducts.length,
                    missing: missingProducts.length,
                    missingProducts: missingProducts
                };
            } catch (error) {
                console.error('❌ Karşılaştırma hatası:', error);
                throw error;
            }
        }

        // Seçili ürünleri güncelleme için JSON formatına çevir
        exportSelectedProductsAsJSON() {
            try {
                const checkboxes = document.querySelectorAll('.missing-product-checkbox:checked');
                if (checkboxes.length === 0) {
                    throw new Error('Lütfen en az bir ürün seçin!');
                }
                
                const selectedProducts = [];
                checkboxes.forEach(cb => {
                    const index = parseInt(cb.dataset.index);
                    // missingProducts'ı saklamak için state'i kontrol et
                    if (this.lastComparisonMissingProducts && this.lastComparisonMissingProducts[index]) {
                        const product = this.lastComparisonMissingProducts[index];
                        
                        // İlk barkodu al
                        const firstBarcode = product.barcodes && product.barcodes.length > 0 
                            ? product.barcodes[0].code 
                            : '';
                        
                        // Ürün verisini oluştur
                        selectedProducts.push({
                            name: product.name || 'İsimsiz Ürün',
                            barcode: firstBarcode,
                            image: product.image || ''
                        });
                    }
                });
                
                if (selectedProducts.length === 0) {
                    throw new Error('Seçili ürün bulunamadı!');
                }
                
                // JSON formatını oluştur
                const jsonData = {
                    type: 'product_update',
                    display_type: 'grid', // Seçenekler: grid, list, carousel, orbit
                    products: selectedProducts
                };
                
                return JSON.stringify(jsonData, null, 2);
            } catch (error) {
                console.error('❌ JSON export hatası:', error);
                throw error;
            }
        }

        // Karşılaştırma sonuçlarını sayfanın altında göster
        displayComparisonResults(existingCount, totalCount, missingProducts) {
            const resultsDiv = document.getElementById('shelfLabelComparisonResults');
            const existingCountEl = document.getElementById('comparisonExistingCount');
            const totalCountEl = document.getElementById('comparisonTotalCount');
            const missingCountEl = document.getElementById('comparisonMissingCount');
            const missingListEl = document.getElementById('missingProductsList');
            
            if (!resultsDiv) return;
            
            // missingProducts'ı state'e kaydet (export için)
            this.lastComparisonMissingProducts = missingProducts;
            
            // İstatistikleri güncelle
            if (existingCountEl) existingCountEl.textContent = existingCount;
            if (totalCountEl) totalCountEl.textContent = totalCount;
            if (missingCountEl) missingCountEl.textContent = missingProducts.length;
            
            // Eksik sayfaları göster (eğer varsa)
            if (this.missingPages && this.missingPages.length > 0) {
                // Eksik sayfalar bölümünü göster
                this.displayMissingPages(this.missingPages);
                
                // Karşılaştırma sonuçlarına eksik sayfalar bilgisini ekle
                const missingPagesInfo = document.getElementById('missingPagesInfo');
                if (missingPagesInfo) {
                    missingPagesInfo.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center space-x-2">
                                    <span class="text-yellow-600 font-semibold">⚠️ Eksik Sayfalar (100 ürün alınamayan)</span>
                                    <span class="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-sm font-medium">${this.missingPages.length} sayfa</span>
                                </div>
                                <button onclick="window.productImporter.openManualHtmlModal(null)" class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-sm font-medium transition-colors">
                                    📝 Manuel HTML Ekle
                                </button>
                            </div>
                            <div class="text-sm text-gray-700 mb-2">
                                Aşağıdaki sayfalardan 100 ürün çekilemedi. Manuel olarak HTML girerek eksik ürünleri ekleyebilirsiniz:
                            </div>
                            <div id="missingPagesListInComparison" class="flex flex-wrap gap-2">
                                ${this.missingPages.map(pageNum => `
                                    <button onclick="window.productImporter.openManualHtmlModal(${pageNum})" 
                                            class="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium transition-colors">
                                        Sayfa ${pageNum}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    `;
                    missingPagesInfo.classList.remove('hidden');
                }
            } else {
                const missingPagesInfo = document.getElementById('missingPagesInfo');
                if (missingPagesInfo) {
                    missingPagesInfo.classList.add('hidden');
                }
            }
            
            // Eksik ürünleri listele
            if (missingListEl) {
                if (missingProducts.length === 0) {
                    missingListEl.innerHTML = '<div class="p-4 text-center text-gray-500">Tüm ürünler mevcut! Eksik ürün yok.</div>';
                } else {
                    missingListEl.innerHTML = missingProducts.map((product, index) => {
                        const barcodeText = product.barcodes && product.barcodes.length > 0 
                            ? product.barcodes.map(b => b.code).join(', ')
                            : 'Barkod yok';
                        const productImage = product.image && product.image.trim() && !product.image.includes('placeholder')
                            ? product.image
                            : null;
                        return `
                            <div class="p-3 border-b border-gray-200 hover:bg-gray-50 flex items-center">
                                <input type="checkbox" class="missing-product-checkbox mr-3" data-index="${index}" checked>
                                ${productImage ? `
                                    <img src="${productImage}" 
                                         alt="${(product.name || 'Ürün').replace(/"/g, '&quot;')}" 
                                         class="w-12 h-12 object-cover rounded mr-3 flex-shrink-0"
                                         onerror="this.style.display='none'"
                                         loading="lazy">
                                ` : `
                                    <div class="w-12 h-12 bg-gray-200 rounded mr-3 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                                        <span>Görsel Yok</span>
                                    </div>
                                `}
                                <div class="flex-1">
                                    <div class="font-medium text-gray-900">${product.name || 'İsimsiz Ürün'}</div>
                                    <div class="text-sm text-gray-600">
                                        <span>ID: ${product.id}</span>
                                        <span class="ml-3">Barkod: ${barcodeText}</span>
                                        ${product.brand ? `<span class="ml-3">Marka: ${product.brand}</span>` : ''}
                                        ${product.category ? `<span class="ml-3">Kategori: ${product.category}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
            
            // Sonuçları göster
            resultsDiv.classList.remove('hidden');
            
            // Sayfanın altına scroll
            setTimeout(() => {
                resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }

        // Ürünü doğru sıralamayla JSON string'e çevir (manuel format)
        formatProductToJSON(product, indent = 4) {
            const indentStr = ' '.repeat(indent);
            const indentStr2 = ' '.repeat(indent + 4);
            const indentStr3 = ' '.repeat(indent + 8);
            
            // Barcodes'u formatla
            let barcodesStr = '[]';
            if (product.barcodes && product.barcodes.length > 0) {
                const barcodeItems = product.barcodes.map(barcode => {
                    return `${indentStr3}{\n${indentStr3}    "code": ${JSON.stringify(barcode.code || '')},\n${indentStr3}    "type": ${JSON.stringify(barcode.type || 'EAN-13')},\n${indentStr3}    "size": ${JSON.stringify(barcode.size || '')},\n${indentStr3}    "variant": ${JSON.stringify(barcode.variant || '')}\n${indentStr3}}`;
                });
                barcodesStr = `[\n${barcodeItems.join(',\n')}\n${indentStr2}]`;
            }
            
            // Product'ı DOĞRU SIRALAMAYLA formatla
            // Sıralama: id, name, category, brand, description, image, barcodes, shelf, price, stock
            return `${indentStr}{\n${indentStr2}"id": ${JSON.stringify(product.id || '')},\n${indentStr2}"name": ${JSON.stringify(product.name || '')},\n${indentStr2}"category": ${JSON.stringify(product.category || '')},\n${indentStr2}"brand": ${JSON.stringify(product.brand || '')},\n${indentStr2}"description": ${JSON.stringify(product.description || product.name || '')},\n${indentStr2}"image": ${JSON.stringify(product.image || '')},\n${indentStr2}"barcodes": ${barcodesStr},\n${indentStr2}"shelf": ${JSON.stringify(product.shelf || '-')},\n${indentStr2}"price": ${product.price !== undefined ? JSON.stringify(product.price) : 'null'},\n${indentStr2}"stock": ${product.stock !== undefined ? JSON.stringify(product.stock) : 'null'}\n${indentStr}}`;
        }
        
        // Seçili ürünleri JSON formatında indir (products.json'a eklemeden)
        async addSelectedProductsToJSON() {
            try {
                if (!this.missingShelfLabelProducts || this.missingShelfLabelProducts.length === 0) {
                    throw new Error('Eklenecek ürün yok.');
                }
                
                // Seçili checkbox'ları bul
                const checkboxes = document.querySelectorAll('.missing-product-checkbox:checked');
                const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
                
                if (selectedIndices.length === 0) {
                    throw new Error('Lütfen en az bir ürün seçin.');
                }
                
                // Seçili ürünleri al
                const selectedProducts = selectedIndices.map(index => this.missingShelfLabelProducts[index]);
                
                // Ürünleri DOĞRU SIRALAMAYLA JSON string'e çevir (manuel format)
                const productStrings = selectedProducts.map(product => this.formatProductToJSON(product, 4));
                const jsonString = `[\n${productStrings.join(',\n')}\n]`;
                
                // JSON'u indir
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `eksik_urunler_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(url);
                
                alert(`✅ ${selectedProducts.length} eksik ürün JSON formatında indirildi!\n\nBu ürünleri manuel olarak products.json dosyanıza ekleyebilirsiniz.`);
                
                console.log(`✅ ${selectedProducts.length} eksik ürün JSON formatında indirildi`);
            } catch (error) {
                console.error('❌ Ürün indirme hatası:', error);
                throw error;
            }
        }
    }

    // Initialize ProductImporter
    if (typeof window !== 'undefined') {
        window.productImporter = new ProductImporter();
        console.log('✅ ProductImporter initialized');
    }
})();


