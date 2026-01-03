# Stok Sayım Sistemi - Tasarımsal ve Genel Özet

## 📋 Sayım Sayfası Nedir?

Stok Sayım Sistemi, Getir franchise depolarında fiziksel stok sayımını dijitalleştiren bir web uygulamasıdır. Depo çalışanları fiziksel sayım sonuçlarını girer, sistem Getir API'den mevcut stok bilgisini çeker ve ikisini karşılaştırarak farkları gösterir.

## 🎯 Amaç ve Kullanım Senaryoları

### Amaç
- Fiziksel stok sayımını dijitalleştirmek
- Depo stoku ile sistem stoku arasındaki farkları tespit etmek
- Çoklu sayım tabloları ile farklı bölgeler/zamanlar için ayrı sayımlar yapmak
- Mobil, tablet ve masaüstü cihazlardan erişilebilir olmak

### Kullanım Senaryoları
1. **Günlük Sayım**: Depo çalışanları günlük stok kontrolü yapar
2. **Bölgesel Sayım**: Farklı depo bölgeleri için ayrı tablolar oluşturulur
3. **Haftalık Kontrol**: Yöneticiler haftalık stok kontrolü yapar
4. **Finansal Analiz**: Stok farklarının finansal etkisi analiz edilir

## 👥 Kullanıcı Erişimi

### Erişim Yolları
- **Web Tarayıcı**: Chrome, Edge, Safari, Firefox (tüm cihazlarda)
- **Mobil Web**: iPhone Safari, Android Chrome (PWA olarak ana ekrana eklenebilir)
- **Tablet**: iPad Safari, Android Tablet Chrome
- **Masaüstü**: Windows, macOS, Linux tarayıcıları

### Giriş Noktası
- Ana sayfadan (`product_search.html`) "Stok Sayımı" butonu ile
- Direkt URL: `/pages/counting.html`
- Premium özellik kontrolü: Sadece premium kullanıcılar erişebilir

---

## 🎨 Tasarımsal Yapı ve HTML/CSS Kodları

### 1. Ana Container

**DOM Path:**
```
main.counting-container.px-2.sm:px-4.lg:px-8.py-4.sm:py-6.w-full
```

**HTML Yapısı:**
```html
<main class="counting-container px-2 sm:px-4 lg:px-8 py-4 sm:py-6 w-full">
    <!-- Tüm içerik burada -->
</main>
```

**CSS Özellikleri:**
- `max-width: 1400px` (merkeze hizalı)
- Responsive padding: `px-2` (mobil) → `px-4` (tablet) → `px-8` (masaüstü)
- Responsive padding: `py-4` (mobil) → `py-6` (tablet+)

---

### 2. İstatistik Kartları

**DOM Path:**
```
main.counting-container > div.grid.grid-cols-1.sm:grid-cols-3.gap-3.sm:gap-4.lg:gap-6 > div.bg-white.rounded-2xl.shadow-soft.p-5.border.border-gray-100.stat-card
```

**HTML Yapısı:**
```html
<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 w-full">
    <!-- Toplam Sayılan Kartı -->
    <div class="bg-white rounded-2xl shadow-soft p-5 border border-gray-100 stat-card relative overflow-hidden group">
        <!-- Arka plan dekoratif ikon -->
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg class="w-16 h-16 text-blue-600">...</svg>
        </div>
        <!-- İçerik -->
        <div>
            <p class="text-sm font-medium text-gray-500 mb-1">Toplam Sayılan</p>
            <p class="text-3xl font-bold text-gray-800 tracking-tight" id="totalProductsCount">0</p>
        </div>
        <!-- Alt gradient çizgi -->
        <div class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-300"></div>
    </div>
    
    <!-- Fazla Ürün Kartı -->
    <div class="bg-white rounded-2xl shadow-soft p-5 border border-gray-100 stat-card relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg class="w-16 h-16 text-emerald-500">...</svg>
        </div>
        <div>
            <p class="text-sm font-medium text-gray-500 mb-1">Fazla Ürün</p>
            <p class="text-3xl font-bold text-emerald-600 tracking-tight" id="positiveDifferenceCount">0</p>
        </div>
        <div class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-300"></div>
    </div>
    
    <!-- Eksik Ürün Kartı -->
    <div class="bg-white rounded-2xl shadow-soft p-5 border border-gray-100 stat-card relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg class="w-16 h-16 text-rose-500">...</svg>
        </div>
        <div>
            <p class="text-sm font-medium text-gray-500 mb-1">Eksik Ürün</p>
            <p class="text-3xl font-bold text-rose-600 tracking-tight" id="negativeDifferenceCount">0</p>
        </div>
        <div class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-rose-300"></div>
    </div>
</div>
```

**CSS Özellikleri:**
```css
.stat-card {
    transition: all 0.3s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.shadow-soft {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
```

**Responsive Yapı:**
- Mobil: `grid-cols-1` (tek sütun, alt alta)
- Tablet+: `sm:grid-cols-3` (3 sütun, yan yana)
- Gap: `gap-3` (mobil) → `gap-4` (tablet) → `gap-6` (masaüstü)

---

### 3. API Durum Kartı

**DOM Path:**
```
main.counting-container > div#apiStatusCard.bg-gradient-to-r.from-blue-50.to-indigo-50.border.border-blue-200.rounded-xl.shadow-sm.p-3.sm:p-4.lg:p-5.mb-6
```

**HTML Yapısı:**
```html
<div id="apiStatusCard" class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm p-3 sm:p-4 lg:p-5 mb-4 sm:mb-6 w-full hidden">
    <div class="flex items-start justify-between">
        <!-- Sol: İkon + Bilgiler -->
        <div class="flex items-start space-x-3 flex-1">
            <div class="flex-shrink-0 mt-1">
                <div id="apiStatusIcon" class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg class="w-6 h-6 text-blue-600">✓</svg>
                </div>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm font-semibold text-gray-900 mb-1">API Durumu</h4>
                <p id="apiStatusText" class="text-sm text-gray-600 mb-1">API güncel ve aktif</p>
                <p id="apiWarehouseInfo" class="text-xs text-gray-500 mb-2">
                    Depo: 5dcafe6a...
                </p>
                <p id="apiTokenExpiry" class="text-xs text-gray-500">
                    Kalan süre: 9 saat 29 dakika
                </p>
                <p id="apiTokenExpiryDate" class="text-xs text-gray-500">
                    Son kullanma: 03.01.2026 18:42
                </p>
            </div>
        </div>
        <!-- Sağ: Yenile Butonu -->
        <button id="refreshTokenBtn" class="ml-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            🔄
        </button>
    </div>
</div>
```

**CSS Özellikleri:**
- Gradient arka plan: `from-blue-50 to-indigo-50`
- Border: `border-blue-200`
- Shadow: `shadow-sm`
- Responsive padding: `p-3` (mobil) → `p-4` (tablet) → `p-5` (masaüstü)

---

### 4. Senkronizasyon Bölümü

**DOM Path:**
```
main.counting-container > div.bg-white.rounded-lg.shadow-md.p-3.sm:p-4.mb-4.sm:mb-6 > div.flex.flex-col.lg:flex-row > div.flex.items-center.gap-2 > button#syncStocksBtn
```

**HTML Yapısı:**
```html
<div class="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6 w-full">
    <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
        <!-- Sol: Başlık ve Açıklama -->
        <div class="flex-1 min-w-0 w-full lg:w-auto">
            <h3 class="text-base sm:text-lg font-semibold text-text-primary">Sistem Stokları</h3>
            <p class="text-xs sm:text-sm text-text-secondary">Depo stoku girilen ürünler için sistem stoklarını getir</p>
        </div>
        <!-- Sağ: Butonlar -->
        <div class="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full lg:w-auto lg:flex-nowrap">
            <!-- Depo Stoklarını Sıfırla -->
            <button id="resetWarehouseStocksBtn" class="bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 text-orange-700 border border-orange-200 rounded-xl px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5">
                🔄 Depo Stoklarını Sıfırla
            </button>
            
            <!-- Sistem Stoklarını Sıfırla -->
            <button id="resetSystemStocksBtn" class="bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 border border-purple-200 rounded-xl px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5">
                🔄 Sistem Stoklarını Sıfırla
            </button>
            
            <!-- Sync Butonu -->
            <button id="syncStocksBtn" class="modern-action-btn sync-btn group flex-1 lg:flex-initial px-4 sm:px-5 lg:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105" title="Sistem stoklarını senkronize et">
                <svg class="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:rotate-180 transition-transform duration-500 flex-shrink-0">🔄</svg>
                <span class="font-bold whitespace-nowrap">Senkronize Et</span>
            </button>
        </div>
    </div>
</div>
```

**CSS Özellikleri:**
```css
.modern-action-btn {
    position: relative;
    overflow: hidden;
}

.modern-action-btn::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
}

.modern-action-btn:hover::before {
    width: 300px;
    height: 300px;
}

.sync-btn:active {
    transform: scale(0.98);
}
```

**Responsive Yapı:**
- Mobil: Butonlar alt alta (`flex-col`), tam genişlik (`w-full`)
- Tablet+: Butonlar yan yana (`lg:flex-row`), otomatik genişlik (`lg:w-auto`)

---

### 5. Ürün Listesi - Mobil Kart Görünümü

**DOM Path:**
```
main.counting-container > div.bg-white.rounded-lg.shadow-md.overflow-hidden > div#countingCardView > div.product-card-modern.bg-white.rounded-2xl.shadow-md.hover:shadow-lg.border.border-gray-100
```

**HTML Yapısı:**
```html
<div id="countingCardView" class="md:hidden p-4 space-y-4">
    <div class="product-card-modern bg-white rounded-2xl shadow-md hover:shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 transform hover:-translate-y-1" data-product-id="5cb8e22cc6831800016f60cb">
        <!-- Header: Görsel + Ürün Adı -->
        <div class="p-4 sm:p-5">
            <img src="..." alt="Tadelle Fındık Dolgulu Sütlü Çikolata" class="w-full h-48 object-cover rounded-xl">
            <h3 class="font-bold text-lg mt-3">Tadelle Fındık Dolgulu Sütlü Çikolata (30 g)</h3>
            <!-- Barkodlar -->
            <div class="flex flex-wrap gap-1.5 mt-2">
                <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    8683417000140
                </span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    8690550913510
                </span>
            </div>
        </div>
        
        <!-- Stock Information Grid -->
        <div class="p-4 sm:p-5 space-y-4">
            <div class="grid grid-cols-2 gap-3 sm:gap-4">
                <!-- Depo Stoku -->
                <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2 sm:p-3 border border-orange-100">
                    <div class="flex items-center space-x-1 sm:space-x-2 mb-1.5 sm:mb-2">
                        <svg class="w-3 h-3 sm:w-4 sm:h-4 text-orange-600">📦</svg>
                        <span class="text-xs font-semibold text-orange-700 uppercase">Depo</span>
                    </div>
                    <div class="flex items-center gap-1 sm:gap-2">
                        <button class="warehouse-stock-decrease-btn w-7 h-7 sm:w-9 sm:h-9 bg-white border border-orange-300 rounded-md sm:rounded-lg text-orange-600 hover:bg-orange-50">-</button>
                        <input type="number" class="warehouse-stock-input flex-1 min-w-[60px] px-1.5 sm:px-2 py-1.5 sm:py-2.5 bg-white border-2 border-orange-200 rounded-lg text-sm sm:text-base font-bold text-center" value="9" data-product-id="...">
                        <button class="warehouse-stock-increase-btn w-7 h-7 sm:w-9 sm:h-9 bg-white border border-orange-300 rounded-md sm:rounded-lg text-orange-600 hover:bg-orange-50">+</button>
                    </div>
                </div>
                
                <!-- Sistem Stoku -->
                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-2 sm:p-3 border border-blue-100">
                    <div class="flex items-center space-x-1 sm:space-x-2 mb-1.5 sm:mb-2">
                        <svg class="w-3 h-3 sm:w-4 sm:h-4 text-blue-600">💻</svg>
                        <span class="text-xs font-semibold text-blue-700 uppercase">Sistem</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-base font-bold">8</span>
                        <button class="refresh-system-stock-btn p-1.5 bg-white hover:bg-blue-100 text-blue-600 rounded-lg">🔄</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Fark Badge + Tarih -->
        <div class="flex items-center justify-between p-4 border-t border-gray-100">
            <span class="px-3 py-1.5 rounded-lg text-sm font-bold border-2 bg-emerald-100 text-emerald-700 border-emerald-200">
                ↑ 1
            </span>
            <span class="text-xs text-gray-500">03.01.2026 08:48</span>
        </div>
        
        <!-- Sil Butonu -->
        <div class="p-4 border-t border-gray-100">
            <button class="delete-product-btn w-full px-3 py-2 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 text-red-600 border-2 border-red-200 rounded-lg">
                🗑️ Ürünü Sil
            </button>
        </div>
    </div>
</div>
```

**CSS Özellikleri:**
```css
.product-card-modern {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.product-card-modern:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}
```

**Responsive Yapı:**
- Mobil: Tek sütun, kartlar alt alta
- Tablet: Grid yapısı (2 sütun)
- Masaüstü: Gizli (`md:hidden`), tablo görünümü gösterilir

---

### 6. Ürün Listesi - Masaüstü Tablo Görünümü

**DOM Path:**
```
main.counting-container > div.bg-white.rounded-lg.shadow-md.overflow-hidden > div.hidden.md:block.overflow-x-auto > table.w-full > tbody#countingTableBody > tr.product-row-modern
```

**HTML Yapısı:**
```html
<div class="hidden md:block overflow-x-auto">
    <table class="w-full">
        <thead class="bg-gray-50">
            <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Görsel</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header cursor-pointer hover:bg-gray-100" data-sort-field="productName">
                    <div class="flex items-center space-x-1">
                        <span>Ürün Adı</span>
                        <div class="sort-icons flex flex-col">
                            <svg class="w-3 h-3 sort-asc-icon text-gray-400">↑</svg>
                            <svg class="w-3 h-3 sort-desc-icon text-gray-400">↓</svg>
                        </div>
                    </div>
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="warehouseStock">Depo Stoku</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="systemStock">Sistem Stoku</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="difference">Fark</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="date">Tarih/Saat</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
            </tr>
        </thead>
        <tbody id="countingTableBody" class="bg-white divide-y divide-gray-200">
            <tr class="product-row-modern hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200 border-b border-gray-100" data-product-id="...">
                <!-- Görsel -->
                <td class="px-4 py-4">
                    <img src="..." alt="..." class="w-16 h-16 object-cover rounded-xl shadow-sm border-2 border-white">
                </td>
                
                <!-- Ürün Adı -->
                <td class="px-4 py-4">
                    <div class="font-bold text-gray-900 text-sm">Tadelle Fındık Dolgulu Sütlü Çikolata</div>
                    <div class="flex flex-wrap gap-1.5 mt-1">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            8683417000140
                        </span>
                    </div>
                </td>
                
                <!-- Depo Stoku -->
                <td class="px-4 py-4">
                    <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5 border border-orange-100">
                        <div class="flex items-center gap-1.5">
                            <button class="warehouse-stock-decrease-btn w-8 h-8 sm:w-9 sm:h-9 bg-white border-2 border-orange-300 rounded-lg text-orange-600">-</button>
                            <input type="number" class="warehouse-stock-input flex-1 min-w-0 px-2 sm:px-3 py-2 bg-white border-2 border-orange-200 rounded-lg text-sm sm:text-base font-bold text-center" value="9">
                            <button class="warehouse-stock-increase-btn w-8 h-8 sm:w-9 sm:h-9 bg-white border-2 border-orange-300 rounded-lg text-orange-600">+</button>
                        </div>
                    </div>
                </td>
                
                <!-- Sistem Stoku -->
                <td class="px-4 py-4">
                    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-2.5 border border-blue-100">
                        <div class="flex items-center justify-between">
                            <span class="text-base font-bold text-gray-900">8</span>
                            <button class="refresh-system-stock-btn p-1.5 bg-white hover:bg-blue-100 text-blue-600 rounded-lg">🔄</button>
                        </div>
                    </div>
                </td>
                
                <!-- Fark -->
                <td class="px-4 py-4">
                    <span class="px-3 py-1.5 rounded-lg text-sm font-bold border-2 bg-emerald-100 text-emerald-700 border-emerald-200">
                        ↑ 1
                    </span>
                </td>
                
                <!-- Tarih/Saat -->
                <td class="px-4 py-4">
                    <span class="text-sm text-gray-600">03.01.2026 08:48</span>
                </td>
                
                <!-- İşlemler -->
                <td class="px-4 py-4">
                    <button class="delete-product-btn px-3 py-2 bg-gradient-to-r from-red-50 to-rose-50 text-red-600 border-2 border-red-200 rounded-lg">🗑️</button>
                </td>
            </tr>
        </tbody>
    </table>
</div>
```

**CSS Özellikleri:**
```css
.product-row-modern {
    transition: all 0.2s ease;
}

.product-row-modern:hover {
    background: linear-gradient(to right, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05));
}
```

**Responsive Yapı:**
- Mobil/Tablet: Gizli (`hidden md:block`), kart görünümü gösterilir
- Masaüstü: Görünür, tablo formatında

---

### 7. Ürün Ekle Bölümü

**DOM Path:**
```
main.counting-container > div.bg-white.rounded-xl.shadow-md.border.border-gray-100.p-5.sm:p-6.mb-6
```

**HTML Yapısı:**
```html
<div class="bg-white rounded-xl shadow-md border border-gray-100 p-5 sm:p-6 mb-6">
    <h3 class="text-xl font-bold text-gray-900 mb-5 flex items-center space-x-2">
        <svg class="w-6 h-6 text-blue-600">➕</svg>
        <span>Ürün Ekle</span>
    </h3>
    <div class="flex flex-col sm:flex-row gap-4">
        <!-- Manuel Input -->
        <div class="flex-1 relative min-w-0">
            <div class="relative w-full">
                <input 
                    type="text" 
                    id="manualProductInput" 
                    placeholder="Ürün adı, barkod veya gram değeri girin..."
                    class="w-full py-3 pl-12 sm:pl-14 md:pl-16 pr-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm sm:text-base font-medium bg-gray-50 focus:bg-white"
                >
                <svg class="absolute left-3.5 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none z-10">🔍</svg>
                <!-- Arama Sonuçları Dropdown -->
                <div id="manualInputResults" class="hidden absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    <!-- Sonuçlar buraya eklenecek -->
                </div>
            </div>
        </div>
        
        <!-- Butonlar -->
        <div class="flex gap-2 sm:gap-3 flex-wrap sm:flex-nowrap flex-shrink-0">
            <button id="addProductBtn" class="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-center space-x-1.5 sm:space-x-2.5 text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105">
                ➕ <span class="font-bold">Ekle</span>
            </button>
            <button id="searchProductBtn" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-center space-x-1.5 sm:space-x-2.5 text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105">
                🔍 <span class="font-bold hidden sm:inline">Ara</span>
            </button>
            <button id="cameraScanBtn" class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-center space-x-1.5 sm:space-x-2.5 text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105">
                📷 <span class="font-bold hidden sm:inline">Kamera</span>
            </button>
        </div>
    </div>
</div>
```

**Responsive Yapı:**
- Mobil: Input ve butonlar alt alta (`flex-col`)
- Tablet+: Input ve butonlar yan yana (`sm:flex-row`)

---

### 8. Header (Üst Bar)

**DOM Path:**
```
header.bg-surface.border-b.border-border.shadow-sm.sticky.top-0.z-40
```

**HTML Yapısı:**
```html
<header class="bg-surface border-b border-border shadow-sm sticky top-0 z-40">
    <div class="w-full mx-auto px-2 sm:px-4 lg:px-8">
        <div class="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
            <!-- Sol: Geri + Tablo Yönetimi -->
            <div class="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                <button id="backToSearchBtn" class="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg">←</button>
                
                <!-- Tablo Seçici -->
                <div class="relative min-w-[120px] sm:min-w-[150px]">
                    <button id="tableSelectorBtn" class="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center justify-between">
                        <span id="tableSelectorText" class="text-gray-700 truncate">Ana Sayım</span>
                        <svg class="w-4 h-4 sm:w-5 sm:h-5 text-gray-500">▼</svg>
                    </button>
                    <div id="tableSelectorDropdown" class="hidden absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <!-- Tablolar buraya eklenecek -->
                    </div>
                </div>
                
                <!-- Tablo Yönetim Butonları -->
                <button id="renameTableBtn" class="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg">✏️</button>
                <button id="createTableBtn" class="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg">➕</button>
                <button id="deleteTableBtn" class="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg text-red-600">🗑️</button>
            </div>
            
            <!-- Orta: Logo + Başlık (Tablet+) -->
            <div class="hidden md:flex items-center flex-shrink-0 mx-2 sm:mx-4">
                <img src="../assets/logo.png" alt="Logo" class="w-6 h-6 sm:w-8 sm:h-8">
                <h1 class="text-lg sm:text-xl md:text-2xl font-bold">GunduzDev</h1>
            </div>
            
            <!-- Sağ: Kullanıcı Bilgisi + Çıkış -->
            <div class="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
                <div class="text-right hidden xl:block">
                    <p class="text-sm lg:text-lg font-semibold" id="userName">Kullanıcı Adı</p>
                    <p class="text-xs lg:text-sm text-text-secondary" id="userCompany">Şirket</p>
                </div>
                <button id="logoutBtn" class="btn-secondary text-xs sm:text-sm p-1.5 sm:p-2">Çıkış</button>
            </div>
        </div>
    </div>
</header>
```

**CSS Özellikleri:**
- Sticky header: `sticky top-0 z-40`
- Responsive height: `h-14` (mobil) → `h-16` (tablet+)
- Responsive padding: `px-2` (mobil) → `px-4` (tablet) → `px-8` (masaüstü)

---

## 📱 Responsive Breakpoints

### Mobil (< 640px)
- İstatistik kartları: Tek sütun (`grid-cols-1`)
- Ürün listesi: Kart görünümü (`md:hidden`)
- Butonlar: Alt alta (`flex-col`), tam genişlik
- Header: Kompakt, logo gizli
- Input padding: `pl-12` (arama ikonu için)

### Tablet (640px - 1024px)
- İstatistik kartları: 3 sütun (`sm:grid-cols-3`)
- Ürün listesi: Kart görünümü (grid, 2 sütun)
- Butonlar: Yan yana (`sm:flex-row`)
- Header: Logo görünür (`md:flex`)

### Masaüstü (> 1024px)
- İstatistik kartları: 3 sütun, daha geniş gap (`lg:gap-6`)
- Ürün listesi: Tablo görünümü (`md:block`)
- Butonlar: Otomatik genişlik (`lg:w-auto`)
- Header: Tam özellikler, kullanıcı bilgisi görünür (`xl:block`)

---

## 🎨 Renk Paleti ve Stil Sistemi

### Renkler
- **Birincil (Mavi)**: `blue-600`, `indigo-600` (butonlar, linkler)
- **Başarı (Yeşil)**: `emerald-600`, `green-600` (fazla ürün, pozitif fark)
- **Uyarı (Kırmızı)**: `rose-600`, `red-600` (eksik ürün, negatif fark, silme)
- **Bilgi (Turuncu)**: `orange-600`, `amber-600` (depo stoku)
- **Arka Plan**: `gray-50`, `white` (kartlar, inputlar)
- **Metin**: `gray-900` (başlıklar), `gray-600` (açıklamalar)

### Gradient'ler
- Butonlar: `bg-gradient-to-r from-blue-600 to-indigo-600`
- Kartlar: `bg-gradient-to-br from-orange-50 to-amber-50` (depo stoku)
- Kartlar: `bg-gradient-to-br from-blue-50 to-indigo-50` (sistem stoku)
- Alt çizgiler: `bg-gradient-to-r from-blue-600 to-indigo-300`

### Gölgeler
- Yumuşak: `shadow-soft` (0 2px 8px rgba(0, 0, 0, 0.08))
- Orta: `shadow-md` (0 4px 6px rgba(0, 0, 0, 0.1))
- Büyük: `shadow-lg` (0 10px 15px rgba(0, 0, 0, 0.1))

### Border Radius
- Küçük: `rounded-lg` (8px)
- Orta: `rounded-xl` (12px)
- Büyük: `rounded-2xl` (16px)

---

## 🔄 Animasyonlar ve Transitions

### Hover Efektleri
- Kartlar: `transform: translateY(-2px)` veya `translateY(-4px)`
- Butonlar: `transform: scale(1.05)` veya `scale(0.98)` (active)
- Tablo satırları: Gradient arka plan değişimi

### Transitions
- Genel: `transition-all duration-200` veya `duration-300`
- Özel: `transition-transform duration-500` (buton ikonları)

---

## 📊 Örnek Veri Görünümleri

### İstatistik Kartları Örneği
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Toplam Sayılan │  │  Fazla Ürün     │  │  Eksik Ürün     │
│       8         │  │       0         │  │       8         │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### API Durum Kartı Örneği
```
┌─────────────────────────────────────────┐
│ ✓ API Durumu                            │
│ API güncel ve aktif                      │
│ Depo: 5dcafe6a...                        │
│ Kalan süre: 9 saat 29 dakika            │
│ Son kullanma: 03.01.2026 18:42          │
│                              [🔄 Yenile] │
└─────────────────────────────────────────┘
```

### Ürün Kartı Örneği (Mobil)
```
┌─────────────────────────────┐
│  [Ürün Görseli]             │
│  Tadelle Fındık Dolgulu...  │
│  [8683417000140] [869055...]│
│                             │
│  ┌─────────┐  ┌─────────┐  │
│  │ DEPO    │  │ SİSTEM  │  │
│  │ [-] 9 [+]│  │   8  🔄 │  │
│  └─────────┘  └─────────┘  │
│                             │
│  Fark: ↑ 1    03.01.2026   │
│  [🗑️ Ürünü Sil]             │
└─────────────────────────────┘
```

---

Bu özet, sayım sayfasının tasarımsal yapısını, HTML/CSS kodlarını, responsive özelliklerini ve genel kullanım bilgilerini içermektedir.

