# Stok Sayım Sistemi - Teknik Detaylı Özet

## 📋 Genel Bakış

Stok Sayım Sistemi, Getir franchise depolarında fiziksel stok sayımını dijitalleştiren bir web uygulamasıdır. Depo çalışanları fiziksel sayım sonuçlarını girer, sistem Getir API'den mevcut stok bilgisini çeker ve ikisini karşılaştırarak farkları gösterir.

---

## 🏗️ Mimari ve Veri Yapısı

### Ana Sınıf: `CountingSystem`

```javascript
class CountingSystem {
    constructor() {
        this.countingData = {}; // Ürün verileri
        this.allProducts = []; // Tüm ürünler (products.json'dan)
        this.currentUser = null; // Aktif kullanıcı
        this.STORAGE_KEY = 'counting_data'; // localStorage key
        this.currentTableName = 'Ana Sayım'; // Aktif sayım tablosu
        this.currentSort = null; // Sıralama durumu
    }
}
```

### Veri Yapısı: `countingData`

```javascript
// Supabase'de users.counting_data JSONB kolonunda saklanır
{
    "_api_info": {
        "token": "Bearer eyJhbGci...",
        "warehouseId": "5dcafe6ae2c61b1e52cf1704",
        "warehouseName": "Merkez Depo",
        "tokenExpiry": "03.01.2026 18:42:22",
        "baseUrl": "https://franchise-api-gateway.getirapi.com",
        "stockEndpoint": "https://franchise-api-gateway.getirapi.com/stocks",
        "timestamp": "2025-01-03T10:30:00.000Z"
    },
    "_tables": {
        "Ana Sayım": {
            "5cb8e2daff9117000171adde": {
                "warehouseStock": 15,
                "systemStock": 12,
                "lastUpdated": "2025-01-03T10:30:00.000Z",
                "apiFetchFailed": false
            },
            "56dafd4d76d96e030066497f": {
                "warehouseStock": 8,
                "systemStock": null,
                "lastUpdated": "2025-01-03T10:25:00.000Z",
                "apiFetchFailed": false
            }
        },
        "Bölge A": {
            "5cb8e2daff9117000171adde": {
                "warehouseStock": 5,
                "systemStock": 3,
                "lastUpdated": "2025-01-03T09:00:00.000Z"
            }
        }
    },
    "_currentTable": "Ana Sayım"
}
```

### Ürün Veri Yapısı

```javascript
// Her ürün için:
{
    "warehouseStock": 15,        // Fiziksel sayım sonucu (manuel giriş)
    "systemStock": 12,           // Getir API'den gelen stok
    "lastUpdated": "2025-01-03T10:30:00.000Z", // Son güncelleme zamanı
    "apiFetchFailed": false      // API çağrısı başarısız oldu mu?
}
```

### Ürün Bilgisi Yapısı (products.json'dan)

```javascript
{
    "id": "5cb8e2daff9117000171adde",
    "name": "Coca Cola 1.5L",
    "image": "https://cdn.getir.com/product/...",
    "barcodes": [
        { "code": "8690632704685" },
        { "code": "8690632704692" }
    ],
    "price": 25.50
}
```

---

## 🎨 UI Bileşenleri ve Kod Yapısı

### 1. Header (Üst Bar)

**HTML Yapısı:**
```html
<header class="bg-surface border-b border-border shadow-sm sticky top-0 z-40">
    <!-- Sol: Geri + Tablo Yönetimi -->
    <div class="flex items-center space-x-1 sm:space-x-2">
        <!-- Geri Butonu -->
        <button id="backToSearchBtn">←</button>
        
        <!-- Tablo Seçici (Custom Dropdown) -->
        <div class="relative">
            <button id="tableSelectorBtn">
                <span id="tableSelectorText">Ana Sayım</span>
                <svg>▼</svg>
            </button>
            <div id="tableSelectorDropdown" class="hidden">
                <!-- Tablolar buraya eklenecek -->
            </div>
        </div>
        
        <!-- Tablo Yönetim Butonları -->
        <button id="renameTableBtn" title="Tablo Adını Değiştir">✏️</button>
        <button id="createTableBtn" title="Yeni Tablo Oluştur">➕</button>
        <button id="deleteTableBtn" title="Tablo Sil">🗑️</button>
    </div>
    
    <!-- Sağ: Kullanıcı Bilgisi + Çıkış -->
    <div class="flex items-center">
        <div id="userName">Kullanıcı Adı</div>
        <button id="logoutBtn">Çıkış</button>
    </div>
</header>
```

**JavaScript Event Listeners:**
```javascript
// Tablo seçici aç/kapa
document.getElementById('tableSelectorBtn').addEventListener('click', () => {
    this.openTableSelector();
});

// Yeni tablo oluştur
document.getElementById('createTableBtn').addEventListener('click', () => {
    this.showCreateTableModal();
});

// Tablo sil
document.getElementById('deleteTableBtn').addEventListener('click', () => {
    this.showDeleteTableModal();
});

// Tablo yeniden adlandır
document.getElementById('renameTableBtn').addEventListener('click', () => {
    this.showRenameTableModal();
});
```

---

### 2. Ürün Ekle Bölümü

**HTML Yapısı:**
```html
<div class="bg-white rounded-xl shadow-md p-5 sm:p-6">
    <h3>Ürün Ekle</h3>
    
    <!-- Manuel Input -->
    <div class="relative">
        <input 
            id="manualProductInput"
            type="text"
            placeholder="Ürün adı, barkod veya gram değeri girin..."
            class="w-full py-3 pl-12 border-2 rounded-xl"
        >
        <svg class="absolute left-4">🔍</svg>
        
        <!-- Arama Sonuçları Dropdown -->
        <div id="manualInputResults" class="hidden absolute z-50">
            <!-- Sonuçlar buraya eklenecek -->
        </div>
    </div>
    
    <!-- Butonlar -->
    <div class="flex gap-2">
        <button id="addProductBtn" class="bg-gradient-to-r from-emerald-600 to-green-600">
            ➕ Ekle
        </button>
        <button id="searchProductBtn" class="bg-gradient-to-r from-blue-600 to-indigo-600">
            🔍 Ara
        </button>
        <button id="cameraScanBtn" class="bg-gradient-to-r from-purple-600 to-pink-600">
            📷 Kamera
        </button>
    </div>
</div>
```

**JavaScript Fonksiyonları:**
```javascript
// Manuel input arama
document.getElementById('manualProductInput').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length >= 2) {
        const results = this.searchProducts(query);
        this.renderManualInputResults(results);
    }
});

// Ürün ekle butonu
document.getElementById('addProductBtn').addEventListener('click', () => {
    const input = document.getElementById('manualProductInput');
    const query = input.value.trim();
    if (query) {
        this.handleManualAdd(query);
    }
});

// Ürün ara butonu (modal açar)
document.getElementById('searchProductBtn').addEventListener('click', () => {
    this.openProductSearchModal();
});

// Kamera butonu
document.getElementById('cameraScanBtn').addEventListener('click', () => {
    this.startBarcodeScanner();
});
```

---

### 3. İstatistik Kartları

**HTML Yapısı:**
```html
<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <!-- Toplam Sayılan -->
    <div class="stat-card bg-white rounded-2xl p-5">
        <p class="text-sm text-gray-500">Toplam Sayılan</p>
        <p id="totalProductsCount" class="text-3xl font-bold">8</p>
    </div>
    
    <!-- Fazla Ürün -->
    <div class="stat-card bg-white rounded-2xl p-5">
        <p class="text-sm text-gray-500">Fazla Ürün</p>
        <p id="positiveDifferenceCount" class="text-3xl font-bold">0</p>
    </div>
    
    <!-- Eksik Ürün -->
    <div class="stat-card bg-white rounded-2xl p-5">
        <p class="text-sm text-gray-500">Eksik Ürün</p>
        <p id="negativeDifferenceCount" class="text-3xl font-bold">8</p>
    </div>
</div>
```

**JavaScript Güncelleme:**
```javascript
updateStatistics() {
    const productIds = Object.keys(this.countingData).filter(key => 
        key !== '_api_info' && key !== '_tables' && key !== '_currentTable'
    );
    
    let positiveCount = 0; // Fazla ürün
    let negativeCount = 0; // Eksik ürün
    
    productIds.forEach(productId => {
        const data = this.countingData[productId];
        const diff = this.calculateDifference(
            data.warehouseStock, 
            data.systemStock
        );
        
        if (diff.type === 'positive') positiveCount++;
        if (diff.type === 'negative') negativeCount++;
    });
    
    document.getElementById('totalProductsCount').textContent = productIds.length;
    document.getElementById('positiveDifferenceCount').textContent = positiveCount;
    document.getElementById('negativeDifferenceCount').textContent = negativeCount;
}
```

---

### 4. API Durum Kartı

**HTML Yapısı:**
```html
<div id="apiStatusCard" class="bg-white rounded-xl p-4 mb-4">
    <div class="flex items-center justify-between">
        <div>
            <p class="text-sm font-semibold">API Durumu</p>
            <p id="apiStatusText">API güncel ve aktif</p>
            <p id="apiWarehouseName">Depo: 5dcafe6a...</p>
            <p id="apiTokenExpiry">Kalan süre: 10 saat 18 dakika</p>
            <p id="apiTokenExpiryDate">Son kullanma: 03.01.2026 18:42</p>
        </div>
        <button id="refreshTokenBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg">
            🔄 Yenile
        </button>
    </div>
</div>
```

**JavaScript Güncelleme:**
```javascript
async updateAPIStatusCard() {
    const apiInfo = await this.getAPIInfo();
    
    if (apiInfo && apiInfo.token) {
        const expiry = new Date(apiInfo.tokenExpiry);
        const now = new Date();
        const diff = expiry - now;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        document.getElementById('apiStatusText').textContent = 'API güncel ve aktif';
        document.getElementById('apiWarehouseName').textContent = 
            `Depo: ${apiInfo.warehouseName || apiInfo.warehouseId}`;
        document.getElementById('apiTokenExpiry').textContent = 
            `Kalan süre: ${hours} saat ${minutes} dakika`;
        document.getElementById('apiTokenExpiryDate').textContent = 
            `Son kullanma: ${apiInfo.tokenExpiry}`;
    }
}
```

---

### 5. Senkronizasyon Bölümü

**HTML Yapısı:**
```html
<div class="bg-white rounded-lg p-4 mb-6">
    <div class="flex flex-col lg:flex-row gap-4">
        <div>
            <h3>Sistem Stokları</h3>
            <p>Depo stoku girilen ürünler için sistem stoklarını getir</p>
        </div>
        <div class="flex gap-2">
            <button id="resetWarehouseStocksBtn" class="bg-orange-50 text-orange-700">
                🔄 Depo Stoklarını Sıfırla
            </button>
            <button id="resetSystemStocksBtn" class="bg-purple-50 text-purple-700">
                🔄 Sistem Stoklarını Sıfırla
            </button>
            <button id="syncBtn" class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                🔄 Sync
            </button>
        </div>
    </div>
</div>
```

**JavaScript Fonksiyonları:**
```javascript
// Sync butonu
document.getElementById('syncBtn').addEventListener('click', async () => {
    await this.syncSystemStocks();
});

// Depo stoklarını sıfırla
document.getElementById('resetWarehouseStocksBtn').addEventListener('click', () => {
    this.showResetConfirmationModal('warehouse');
});

// Sistem stoklarını sıfırla
document.getElementById('resetSystemStocksBtn').addEventListener('click', () => {
    this.showResetConfirmationModal('system');
});

// Sync işlemi
async syncSystemStocks() {
    const productIds = Object.keys(this.countingData).filter(key => 
        key !== '_api_info' && key !== '_tables' && key !== '_currentTable'
    );
    
    // Sistem stoku olmayan ürünleri bul
    const productsToSync = productIds.filter(productId => {
        const data = this.countingData[productId];
        return data.systemStock === null || data.systemStock === undefined;
    });
    
    this.showSyncProgressToast(0, productsToSync.length, '');
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < productsToSync.length; i++) {
        const productId = productsToSync[i];
        const product = this.allProducts.find(p => p.id === productId);
        
        if (product && product.barcodes && product.barcodes.length > 0) {
            try {
                const stock = await this.requestStockFromExtension(
                    null, 
                    product.barcodes[0].code, 
                    productId
                );
                
                if (stock !== null && stock !== undefined) {
                    successCount++;
                } else {
                    failCount++;
                    this.countingData[productId].apiFetchFailed = true;
                }
            } catch (error) {
                failCount++;
                this.countingData[productId].apiFetchFailed = true;
            }
        }
        
        this.showSyncProgressToast(i + 1, productsToSync.length, product.name);
    }
    
    this.hideSyncProgressToast();
    this.saveCountingData();
    this.renderTable();
    this.updateStatistics();
    
    this.showToast(
        `Senkronizasyon tamamlandı: ${successCount} başarılı, ${failCount} başarısız`,
        'success'
    );
}
```

---

### 6. Ürün Listesi - Masaüstü Tablo Görünümü

**HTML Yapısı:**
```html
<table class="w-full">
    <thead>
        <tr>
            <th class="sortable-header" data-sort-field="productName">
                Görsel
            </th>
            <th class="sortable-header" data-sort-field="productName">
                Ürün Adı
            </th>
            <th class="sortable-header" data-sort-field="warehouseStock">
                Depo Stoku
            </th>
            <th class="sortable-header" data-sort-field="systemStock">
                Sistem Stoku
            </th>
            <th class="sortable-header" data-sort-field="difference">
                Fark
            </th>
            <th class="sortable-header" data-sort-field="date">
                Tarih/Saat
            </th>
            <th>İşlemler</th>
        </tr>
    </thead>
    <tbody id="countingTableBody">
        <!-- Ürünler buraya eklenecek -->
    </tbody>
</table>
```

**JavaScript Render Fonksiyonu:**
```javascript
renderTable() {
    const tableBody = document.getElementById('countingTableBody');
    const productIds = Object.keys(this.countingData).filter(key => 
        key !== '_api_info' && key !== '_tables' && key !== '_currentTable'
    );
    
    // Sıralama uygula
    const sortedProductIds = this.applySorting(productIds);
    
    tableBody.innerHTML = sortedProductIds.map(productId => {
        const data = this.countingData[productId];
        const product = this.allProducts.find(p => p.id === productId);
        const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
        
        return `
            <tr data-product-id="${productId}">
                <!-- Görsel -->
                <td>
                    <img src="${product.image}" alt="${product.name}" class="w-16 h-16 rounded-xl">
                    ${diff.value !== null && diff.value !== 0 ? 
                        `<div class="absolute -top-1 -right-1 w-5 h-5 rounded-full ${diff.type === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'}">
                            <span>${diff.type === 'positive' ? '↑' : '↓'}</span>
                        </div>` : ''
                    }
                </td>
                
                <!-- Ürün Adı -->
                <td>
                    <div class="font-bold">${product.name}</div>
                    ${product.barcodes && product.barcodes.length > 0 ? 
                        `<div class="flex gap-1">
                            ${product.barcodes.slice(0, 2).map(b => 
                                `<span class="badge">${b.code}</span>`
                            ).join('')}
                            ${product.barcodes.length > 2 ? 
                                `<span>+${product.barcodes.length - 2}</span>` : ''
                            }
                        </div>` : ''
                    }
                </td>
                
                <!-- Depo Stoku -->
                <td>
                    <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5">
                        <div class="flex items-center gap-1.5">
                            <button class="warehouse-stock-decrease-btn w-8 h-8">-</button>
                            <input 
                                type="number"
                                class="warehouse-stock-input flex-1"
                                value="${data.warehouseStock !== null ? data.warehouseStock : ''}"
                                data-product-id="${productId}"
                            >
                            <button class="warehouse-stock-increase-btn w-8 h-8">+</button>
                        </div>
                    </div>
                </td>
                
                <!-- Sistem Stoku -->
                <td>
                    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-2.5">
                        ${data.systemStock !== null ? 
                            `<div class="flex items-center justify-between">
                                <span>${data.systemStock}</span>
                                <button class="refresh-system-stock-btn">🔄</button>
                            </div>` :
                            (data.apiFetchFailed ? 
                                `<div class="text-rose-600">❌ Bulamadım</div>` :
                                `<button class="sync-single-product-btn">Getir</button>`
                            )
                        }
                    </div>
                </td>
                
                <!-- Fark -->
                <td>
                    <span class="px-3 py-1.5 rounded-lg border-2 ${
                        diff.type === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                        diff.type === 'negative' ? 'bg-rose-100 text-rose-700' :
                        'bg-gray-100 text-gray-700'
                    }">
                        ${diff.value !== null ? 
                            `${diff.type === 'positive' ? '↑' : diff.type === 'negative' ? '↓' : '='} ${Math.abs(diff.value)}` : 
                            '-'
                        }
                    </span>
                </td>
                
                <!-- Tarih/Saat -->
                <td>
                    <span>${this.formatDateTime(data.lastUpdated)}</span>
                </td>
                
                <!-- İşlemler -->
                <td>
                    <button class="delete-product-btn">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    
    this.setupTableEventListeners();
}
```

---

### 7. Ürün Listesi - Mobil/Tablet Kart Görünümü

**HTML Yapısı:**
```html
<div id="countingCardView" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <!-- Ürün kartları buraya eklenecek -->
</div>
```

**JavaScript Render Fonksiyonu:**
```javascript
renderCardView() {
    const cardView = document.getElementById('countingCardView');
    const productIds = Object.keys(this.countingData).filter(key => 
        key !== '_api_info' && key !== '_tables' && key !== '_currentTable'
    );
    
    const sortedProductIds = this.applySorting(productIds);
    
    cardView.innerHTML = sortedProductIds.map(productId => {
        const data = this.countingData[productId];
        const product = this.allProducts.find(p => p.id === productId);
        const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
        
        return `
            <div class="product-card-modern bg-white rounded-2xl shadow-md" data-product-id="${productId}">
                <!-- Header: Görsel + Ürün Adı -->
                <div class="p-4">
                    <img src="${product.image}" alt="${product.name}" class="w-full h-48 object-cover rounded-xl">
                    <h3 class="font-bold text-lg mt-3">${product.name}</h3>
                    ${product.barcodes && product.barcodes.length > 0 ? 
                        `<div class="flex flex-wrap gap-1 mt-2">
                            ${product.barcodes.map(b => 
                                `<span class="badge">${b.code}</span>`
                            ).join('')}
                        </div>` : ''
                    }
                </div>
                
                <!-- Stock Information Grid -->
                <div class="grid grid-cols-2 gap-3 p-4">
                    <!-- Depo Stoku -->
                    <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-3">
                        <div class="flex items-center gap-2 mb-2">
                            <svg>📦</svg>
                            <span class="text-xs font-semibold">Depo</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button class="warehouse-stock-decrease-btn w-7 h-7">-</button>
                            <input 
                                type="number"
                                class="warehouse-stock-input flex-1 min-w-[60px]"
                                value="${data.warehouseStock !== null ? data.warehouseStock : ''}"
                                data-product-id="${productId}"
                            >
                            <button class="warehouse-stock-increase-btn w-7 h-7">+</button>
                        </div>
                    </div>
                    
                    <!-- Sistem Stoku -->
                    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3">
                        <div class="flex items-center gap-2 mb-2">
                            <svg>💻</svg>
                            <span class="text-xs font-semibold">Sistem</span>
                        </div>
                        ${data.systemStock !== null ? 
                            `<div class="flex items-center justify-between">
                                <span class="text-base font-bold">${data.systemStock}</span>
                                <button class="refresh-system-stock-btn">🔄</button>
                            </div>` :
                            (data.apiFetchFailed ? 
                                `<div class="text-rose-600">❌ Bulamadım</div>` :
                                `<button class="sync-single-product-btn">Getir</button>`
                            )
                        }
                    </div>
                </div>
                
                <!-- Fark Badge + Tarih -->
                <div class="flex items-center justify-between p-4 border-t">
                    <span class="px-3 py-1.5 rounded-lg border-2 ${
                        diff.type === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                        diff.type === 'negative' ? 'bg-rose-100 text-rose-700' :
                        'bg-gray-100 text-gray-700'
                    }">
                        ${diff.value !== null ? 
                            `${diff.type === 'positive' ? '↑' : diff.type === 'negative' ? '↓' : '='} ${Math.abs(diff.value)}` : 
                            '-'
                        }
                    </span>
                    <span class="text-xs text-gray-500">${this.formatDateTime(data.lastUpdated)}</span>
                </div>
                
                <!-- Sil Butonu -->
                <div class="p-4 border-t">
                    <button class="delete-product-btn w-full">🗑️ Sil</button>
                </div>
            </div>
        `;
    }).join('');
    
    this.setupTableEventListeners();
}
```

---

## 🔄 Kullanıcı Akışları ve Event Handler'lar

### 1. Ürün Ekleme Akışı

```javascript
// Manuel input'tan ürün ekleme
handleManualAdd(query) {
    // 1. Ürünü ara (barkod, isim veya gram değeri ile)
    const product = this.findProduct(query);
    
    if (!product) {
        this.showToast('Ürün bulunamadı', 'error');
        return;
    }
    
    // 2. Ürünü countingData'ya ekle
    if (!this.countingData[product.productId]) {
        this.countingData[product.productId] = {
            warehouseStock: null,
            systemStock: null,
            lastUpdated: new Date().toISOString(),
            apiFetchFailed: false
        };
    }
    
    // 3. Veriyi kaydet
    this.saveCountingData();
    
    // 4. Tabloyu yeniden render et
    this.renderTable();
    this.updateStatistics();
    
    // 5. Input'u temizle
    document.getElementById('manualProductInput').value = '';
}
```

### 2. Depo Stoku Güncelleme Akışı

```javascript
// Input change event listener
setupTableEventListeners() {
    const warehouseInputs = document.querySelectorAll('.warehouse-stock-input');
    
    warehouseInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const productId = e.target.dataset.productId;
            let value = e.target.value.trim();
            
            // Boşsa null, değilse sayıya çevir
            if (value === '') {
                value = null;
            } else {
                value = Math.max(0, Math.floor(Number(value)));
                e.target.value = String(value);
            }
            
            // Ürün stokunu güncelle
            this.updateProductStock(productId, value, null);
        });
    });
    
    // Artırma butonu
    const increaseButtons = document.querySelectorAll('.warehouse-stock-increase-btn');
    increaseButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = btn.dataset.productId;
            const input = document.querySelector(`.warehouse-stock-input[data-product-id="${productId}"]`);
            
            let currentValue = input.value === '' || isNaN(parseInt(input.value)) ? 0 : parseInt(input.value);
            currentValue += 1;
            input.value = String(currentValue);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
    
    // Azaltma butonu
    const decreaseButtons = document.querySelectorAll('.warehouse-stock-decrease-btn');
    decreaseButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = btn.dataset.productId;
            const input = document.querySelector(`.warehouse-stock-input[data-product-id="${productId}"]`);
            
            let currentValue = input.value === '' || isNaN(parseInt(input.value)) ? 0 : parseInt(input.value);
            currentValue = Math.max(0, currentValue - 1);
            input.value = String(currentValue);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
}
```

### 3. Sistem Stoku Çekme Akışı

```javascript
// Tekil ürün için sistem stoku çekme
async requestStockFromExtension(barcode, productName, productId) {
    // 1. API bilgilerini al (extension'dan veya Supabase'den)
    const apiInfo = await this.getAPIInfo();
    
    if (!apiInfo || !apiInfo.token) {
        throw new Error('API bilgileri bulunamadı');
    }
    
    // 2. Ürün ID'sini bul (barkod veya isimden)
    let finalProductId = productId;
    if (!finalProductId && barcode) {
        const product = this.findProductByBarcode(barcode);
        if (product) finalProductId = product.productId;
    }
    if (!finalProductId && productName) {
        const product = this.findProductByName(productName);
        if (product) finalProductId = product.productId;
    }
    
    if (!finalProductId) {
        throw new Error('Ürün ID bulunamadı');
    }
    
    // 3. Getir API'ye istek at
    const stock = await this.fetchStockFromAPI(apiInfo, finalProductId);
    
    // 4. Stoku kaydet
    if (stock !== null && stock !== undefined) {
        this.updateProductStock(finalProductId, null, stock);
    }
    
    return stock;
}

// Getir API çağrısı
async fetchStockFromAPI(apiInfo, productId) {
    const url = `${apiInfo.stockEndpoint}?limit=100&offset=0`;
    const authToken = apiInfo.token.startsWith('Bearer ') ? apiInfo.token : `Bearer ${apiInfo.token}`;
    
    const requestBody = {
        warehouseIds: [apiInfo.warehouseId],
        productIds: [productId],
        sort: { available: 1 }
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken,
            'Origin': 'https://franchise.getir.com',
            'Referer': 'https://franchise.getir.com/',
            'Accept': '*/*',
            'Accept-Language': 'tr-TR,tr;q=0.9'
        },
        body: JSON.stringify(requestBody),
        mode: 'cors',
        credentials: 'omit'
    });
    
    if (!response.ok) {
        throw new Error(`API çağrısı başarısız: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Ürünü bul
    const foundProduct = data.data?.find(p => p.id === productId || p._id === productId);
    
    if (foundProduct) {
        // available, stock veya quantity alanından stok değerini al
        let stock = null;
        if (foundProduct.available !== null && foundProduct.available !== undefined) {
            stock = foundProduct.available;
        } else if (foundProduct.stock !== null && foundProduct.stock !== undefined) {
            stock = foundProduct.stock;
        } else if (foundProduct.quantity !== null && foundProduct.quantity !== undefined) {
            stock = foundProduct.quantity;
        }
        
        return stock;
    }
    
    return null;
}
```

### 4. Sıralama Akışı

```javascript
// Tablo başlığına tıklama
handleHeaderSort(sortField, headerElement) {
    // Mevcut sıralama durumunu kontrol et
    if (this.currentSort && this.currentSort.field === sortField) {
        // Aynı alana tıklandı, yönü değiştir
        this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Yeni alan, varsayılan olarak artan sırala
        this.currentSort = { field: sortField, direction: 'asc' };
    }
    
    // Tabloyu yeniden render et
    this.renderTable();
}

// Sıralama uygula
applySorting(productIds) {
    if (!this.currentSort) {
        return productIds;
    }
    
    const { field, direction } = this.currentSort;
    
    const productsWithData = productIds.map(productId => {
        const data = this.countingData[productId];
        const product = this.allProducts.find(p => p.id === productId);
        return { productId, data, product };
    }).filter(item => item.data && item.product);
    
    productsWithData.sort((a, b) => {
        let comparison = 0;
        
        if (field === 'productName') {
            const nameA = (a.product.name || '').toLowerCase();
            const nameB = (b.product.name || '').toLowerCase();
            comparison = nameA.localeCompare(nameB);
        } else if (field === 'warehouseStock') {
            const stockA = a.data.warehouseStock ?? -Infinity;
            const stockB = b.data.warehouseStock ?? -Infinity;
            comparison = Number(stockA) - Number(stockB);
        } else if (field === 'systemStock') {
            const stockA = a.data.systemStock ?? -Infinity;
            const stockB = b.data.systemStock ?? -Infinity;
            comparison = Number(stockA) - Number(stockB);
        } else if (field === 'difference') {
            // Gerçek fark değerini hesapla (negatif veya pozitif)
            const warehouseA = a.data.warehouseStock ?? null;
            const systemA = a.data.systemStock ?? null;
            const warehouseB = b.data.warehouseStock ?? null;
            const systemB = b.data.systemStock ?? null;
            
            let valueA = null;
            let valueB = null;
            
            if (warehouseA !== null && systemA !== null) {
                valueA = Number(warehouseA) - Number(systemA);
            }
            if (warehouseB !== null && systemB !== null) {
                valueB = Number(warehouseB) - Number(systemB);
            }
            
            if (valueA === null && valueB === null) {
                comparison = 0;
            } else if (valueA === null) {
                comparison = 1;
            } else if (valueB === null) {
                comparison = -1;
            } else {
                comparison = Number(valueA) - Number(valueB);
            }
        } else if (field === 'date') {
            const dateA = a.data.lastUpdated ? new Date(a.data.lastUpdated).getTime() : 0;
            const dateB = b.data.lastUpdated ? new Date(b.data.lastUpdated).getTime() : 0;
            comparison = dateA - dateB;
        }
        
        if (direction === 'desc') comparison *= -1;
        return comparison;
    });
    
    return productsWithData.map(item => item.productId);
}
```

---

## 💾 Veri Saklama ve Senkronizasyon

### Supabase'e Kaydetme

```javascript
async saveCountingData() {
    if (!window.supabase || !this.currentUser) {
        return;
    }
    
    // Tüm tabloları içeren full data yapısı
    const fullData = await this.getFullCountingData();
    
    // Supabase'e kaydet
    const { error } = await window.supabase
        .from('users')
        .update({ counting_data: fullData })
        .eq('username', this.currentUser.username);
    
    if (error) {
        console.error('Supabase kayıt hatası:', error);
    } else {
        console.log('💾 Saved full counting data to Supabase');
    }
    
    // localStorage'a da yedekle
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(fullData));
}
```

### Supabase'den Yükleme

```javascript
async loadCountingData() {
    // Önce Supabase'den yükle
    if (window.supabase && this.currentUser) {
        const { data, error } = await window.supabase
            .from('users')
            .select('counting_data')
            .eq('username', this.currentUser.username)
            .maybeSingle();
        
        if (!error && data && data.counting_data) {
            const fullData = typeof data.counting_data === 'string' 
                ? JSON.parse(data.counting_data) 
                : data.counting_data;
            
            // Aktif tabloyu yükle
            if (fullData._currentTable && fullData._tables && fullData._tables[fullData._currentTable]) {
                this.currentTableName = fullData._currentTable;
                this.countingData = fullData._tables[fullData._currentTable];
            }
            
            return;
        }
    }
    
    // Fallback: localStorage'dan yükle
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
        const fullData = JSON.parse(stored);
        if (fullData._currentTable && fullData._tables && fullData._tables[fullData._currentTable]) {
            this.currentTableName = fullData._currentTable;
            this.countingData = fullData._tables[fullData._currentTable];
        }
    }
}
```

---

## 📊 Örnek Veri Senaryoları

### Senaryo 1: Günlük Sayım

```javascript
// Kullanıcı "Günlük Sayım - 03.01.2026" tablosu oluşturur
{
    "_tables": {
        "Günlük Sayım - 03.01.2026": {
            "5cb8e2daff9117000171adde": { // Coca Cola 1.5L
                "warehouseStock": 15,
                "systemStock": 12,
                "lastUpdated": "2025-01-03T10:30:00.000Z",
                "apiFetchFailed": false
            },
            "56dafd4d76d96e030066497f": { // Fanta 1.5L
                "warehouseStock": 8,
                "systemStock": 10,
                "lastUpdated": "2025-01-03T10:25:00.000Z",
                "apiFetchFailed": false
            }
        }
    },
    "_currentTable": "Günlük Sayım - 03.01.2026"
}

// İstatistikler:
// - Toplam Sayılan: 2
// - Fazla Ürün: 1 (Coca Cola: 15 > 12)
// - Eksik Ürün: 1 (Fanta: 8 < 10)
```

### Senaryo 2: Bölgesel Sayım

```javascript
// Kullanıcı "A Bölgesi" ve "B Bölgesi" tabloları oluşturur
{
    "_tables": {
        "A Bölgesi": {
            "5cb8e2daff9117000171adde": {
                "warehouseStock": 5,
                "systemStock": 3,
                "lastUpdated": "2025-01-03T09:00:00.000Z"
            }
        },
        "B Bölgesi": {
            "5cb8e2daff9117000171adde": {
                "warehouseStock": 10,
                "systemStock": 9,
                "lastUpdated": "2025-01-03T09:30:00.000Z"
            }
        }
    },
    "_currentTable": "A Bölgesi"
}
```

### Senaryo 3: API Başarısız Durumu

```javascript
// Ürün API'den bulunamadığında
{
    "56dafd4d76d96e030066497f": {
        "warehouseStock": 8,
        "systemStock": null,
        "lastUpdated": "2025-01-03T10:25:00.000Z",
        "apiFetchFailed": true  // API çağrısı başarısız
    }
}

// UI'da gösterim:
// - Sistem Stoku: "❌ Bulamadım" (kırmızı)
// - Fark: "-" (hesaplanamıyor)
```

---

## 🎯 Önemli Fonksiyonlar

### Fark Hesaplama

```javascript
calculateDifference(warehouseStock, systemStock) {
    if (warehouseStock === null || warehouseStock === undefined) {
        return { value: null, type: 'empty' };
    }
    if (systemStock === null || systemStock === undefined) {
        return { value: null, type: 'empty' };
    }
    
    const diff = Number(warehouseStock) - Number(systemStock);
    
    if (diff > 0) {
        return { value: diff, type: 'positive' }; // Fazla ürün
    } else if (diff < 0) {
        return { value: Math.abs(diff), type: 'negative' }; // Eksik ürün
    } else {
        return { value: 0, type: 'zero' }; // Eşit
    }
}
```

### Ürün Arama

```javascript
searchProducts(query) {
    const queryLower = query.toLowerCase().trim();
    const results = [];
    
    for (const product of this.allProducts) {
        // İsim ile eşleşme
        if (product.name && product.name.toLowerCase().includes(queryLower)) {
            results.push(product);
            continue;
        }
        
        // Barkod ile eşleşme
        if (product.barcodes && Array.isArray(product.barcodes)) {
            for (const barcodeObj of product.barcodes) {
                if (barcodeObj.code && barcodeObj.code.includes(query)) {
                    results.push(product);
                    break;
                }
            }
        }
        
        // Gram değeri ile eşleşme (örn: "160g")
        if (product.name && /\d+g/.test(queryLower)) {
            const gramMatch = queryLower.match(/(\d+)g/);
            if (gramMatch && product.name.toLowerCase().includes(gramMatch[0])) {
                results.push(product);
            }
        }
    }
    
    return results.slice(0, 50); // Maksimum 50 sonuç
}
```

---

## 🔔 Bildirim Sistemi (Toast)

```javascript
showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">×</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animasyon
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Otomatik kapanma
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
    
    // Manuel kapanma
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    });
}
```

---

## 📱 Responsive Tasarım

- **Mobil (< 640px)**: Kart görünümü, kompakt butonlar, tek sütun
- **Tablet (640px - 1024px)**: Kart görünümü, 2 sütun, orta boy butonlar
- **Masaüstü (> 1024px)**: Tablo görünümü, 3+ sütun, tam özellikler

---

## 🔐 Güvenlik ve Yetkilendirme

- Premium özellik kontrolü: `window.premiumFeatures.checkPremiumFeature('stokSayimi')`
- Kullanıcı authentication: `window.authUtils.checkAuth()`
- Supabase Row Level Security (RLS) ile kullanıcı bazlı veri erişimi

---

Bu teknik özet, sayım sayfasının tüm bileşenlerini, veri yapılarını, akışları ve kod örneklerini içermektedir.

