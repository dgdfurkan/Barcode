# Barcode – Slayt Sunumu İçin HTML Kodları (Parça Bazlı)

Bu doküman, Barcode sitesinin tüm önemli HTML bölümlerini **slayt sunumunda kullanılabilecek parçalar** halinde içerir. Her parça bir slayt veya ekran görüntüsü için referans olarak kullanılabilir.

**Kaynak dosyalar:** `index.html`, `pages/product_search.html`, `pages/counting.html`

---

## SLAYT 1: Giriş Sayfası – Üst Bar ve Logo

**Açıklama:** Giriş sayfasının üst kısmı; logo, Destek ve Hakkımızda linkleri.

**Kaynak:** `index.html`

```html
<div class="absolute top-0 left-0 right-0 px-6 sm:px-10 py-6 flex justify-between items-center hidden lg:flex">
    <div class="flex items-center gap-3 text-white">
        <img src="assets/logo.png" alt="Barcode" class="w-8 h-8 object-contain">
        <h2 class="text-xl font-bold tracking-tight">Barcode</h2>
    </div>
    <div class="flex gap-6">
        <button type="button" id="openSupportChatHeader" class="text-white/70 hover:text-white text-sm font-medium transition-colors cursor-pointer">Destek</button>
        <a class="text-white/70 hover:text-white text-sm font-medium transition-colors" href="#">Hakkımızda</a>
    </div>
</div>
```

---

## SLAYT 2: Giriş Formu – Kart Başlığı

**Açıklama:** Giriş kartının üst kısmı; logo, başlık ve alt başlık.

**Kaynak:** `index.html`

```html
<div class="pt-10 pb-6 px-8 text-center border-b border-slate-100 dark:border-slate-800">
    <div class="flex justify-center mb-4">
        <img src="assets/logo.png" alt="Logo" class="w-16 h-16 object-contain">
    </div>
    <h1 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Barcode</h1>
    <p class="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Ürün Barkod Arama Sistemi</p>
</div>
```

---

## SLAYT 3: Giriş Formu – Kullanıcı Adı ve Şifre

**Açıklama:** Giriş formu alanları; kullanıcı adı, şifre ve Giriş Yap butonu.

**Kaynak:** `index.html`

```html
<div class="mb-6">
    <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Hesabınıza Giriş Yapın</h2>
    <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Devam etmek için lütfen bilgilerinizi girin.</p>
</div>

<form id="loginForm" class="space-y-5">
    <div class="flex flex-col gap-2">
        <label class="text-slate-700 dark:text-slate-300 text-sm font-semibold">Kullanıcı Adı</label>
        <input type="text" id="username" placeholder="Kullanıcı adınızı girin" required>
    </div>
    <div class="flex flex-col gap-2">
        <label class="text-slate-700 dark:text-slate-300 text-sm font-semibold">Şifre</label>
        <input type="password" id="password" placeholder="Şifrenizi girin" required>
    </div>
    <button type="submit" class="w-full bg-[#135bec] hover:bg-[#0f4fd4] text-white font-bold py-3.5 px-4 rounded-lg">
        <span id="loginText">Giriş Yap</span>
    </button>
</form>
```

---

## SLAYT 4: Giriş Sayfası – Bize Ulaşın ve Destek

**Açıklama:** Hesabı olmayan kullanıcılar için iletişim linkleri; Bize Ulaşın ve Destek Alın.

**Kaynak:** `index.html`

```html
<div class="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
    <p class="text-slate-500 dark:text-slate-400 text-xs">Bir hesabınız yok mu? 
        <button type="button" id="openSupportChatBize" class="text-[#135bec] font-bold hover:underline cursor-pointer">Bize Ulaşın</button>
    </p>
</div>

<div class="text-center mt-8">
    <p class="text-white/60 text-sm">
        Sorun mu yaşıyorsunuz?
        <button type="button" id="openSupportChat" class="text-white font-medium hover:underline cursor-pointer">Destek Alın</button>
    </p>
</div>
```

---

## SLAYT 5: Destek Sohbeti Arayüzü

**Açıklama:** Sağ altta açılan destek sohbeti paneli; mesaj alanı ve gönder butonu.

**Kaynak:** `index.html` (product_search.html'de de aynı yapı var)

```html
<div id="chatInterface" class="fixed bottom-4 right-4 w-80 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 hidden z-50 flex flex-col">
    <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-2xl flex-shrink-0">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">...</svg>
                </div>
                <div>
                    <h3 class="font-semibold">Destek Sohbeti</h3>
                    <p class="text-xs opacity-90">Admin ile iletişim</p>
                </div>
            </div>
            <button id="closeChat" class="text-white/80 hover:text-white transition-colors">×</button>
        </div>
    </div>
    <div id="chatMessages" class="h-[360px] overflow-y-auto p-4 space-y-3 bg-gray-50"></div>
    <div class="p-4 border-t border-gray-200">
        <div class="flex space-x-2">
            <input type="text" id="messageInput" placeholder="Mesajınızı yazın..." class="flex-1 px-3 py-2 border border-gray-300 rounded-lg">
            <button id="sendMessage" class="premium-btn text-white px-4 py-2 rounded-lg">Gönder</button>
        </div>
    </div>
</div>

<button id="openChat" class="chat-button fixed bottom-4 right-4 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center z-40">
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">...</svg>
</button>
```

---

## SLAYT 6: Ana Sayfa – Header (Ürün Arama)

**Açıklama:** Ana uygulama sayfasının üst barı; logo, ürün ekle, sayım, trial süresi, ayarlar, çıkış.

**Kaynak:** `pages/product_search.html`

```html
<header class="bg-surface border-b border-border shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
            <div class="flex items-center space-x-3">
                <img src="../assets/logo.png" alt="Logo" class="w-8 h-8 object-contain">
                <div>
                    <h1 class="text-2xl font-bold text-text-primary">FlowCobalt</h1>
                    <p class="text-sm text-text-secondary">Ürün Barkod Arama Sistemi</p>
                </div>
            </div>
            <div id="scanEffectContainer" class="flex items-center">
                <p class="loader"><span>Scan</span></p>
            </div>
            <div class="flex items-center space-x-4">
                <button id="addProductBtn" class="btn-primary text-sm mr-2">Ürün Ekle</button>
                <button id="headerCountingPageBtn" class="btn-secondary text-sm mr-2 hidden">Sayım Sayfası</button>
                <div id="trialCountdownContainer" class="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-gray-100">
                    <span id="trialCountdownValue1">--</span><span id="trialCountdownLabel1">gün</span>
                    <span id="trialCountdownValue2">--</span><span id="trialCountdownLabel2">saat</span>
                </div>
                <div class="text-right">
                    <p id="userName">Yükleniyor...</p>
                    <p id="userCompany">Yükleniyor...</p>
                </div>
                <button id="settingsBtn" class="btn-secondary text-sm mr-2">Ayarlar</button>
                <button id="logoutBtn" class="btn-secondary text-sm">Çıkış</button>
            </div>
        </div>
    </div>
</header>
```

---

## SLAYT 7: Mobil Hamburger Menü

**Açıklama:** Mobil cihazlarda açılan yan menü; kullanıcı bilgisi, trial süresi, menü öğeleri.

**Kaynak:** `pages/product_search.html`

```html
<div id="mobileMenuPanel" class="mobile-menu-panel">
    <div class="mobile-menu-header">
        <h2 class="text-lg font-semibold text-text-primary">Menü</h2>
        <button id="mobileMenuClose">×</button>
    </div>
    <div class="mobile-menu-content">
        <div class="mobile-menu-user-info">
            <p id="mobileUserName">Yükleniyor...</p>
            <p id="mobileUserCompany">Yükleniyor...</p>
            <div id="mobileTrialCountdownInUserInfo">
                <span id="mobileTrialCountdownValue1InUserInfo">--</span> gün
                <span id="mobileTrialCountdownValue2InUserInfo">--</span> saat
            </div>
        </div>
        <button id="mobileAddProductBtn" class="mobile-menu-item">Ürün Ekle</button>
        <button id="mobileCountingPageBtn" class="mobile-menu-item hidden">Sayım Sayfası</button>
        <button id="mobileSettingsBtn" class="mobile-menu-item">Ayarlar</button>
        <button id="mobileLogoutBtn" class="mobile-menu-item">Çıkış Yap</button>
    </div>
</div>
```

---

## SLAYT 8: Trial (Test Süresi) Banner

**Açıklama:** Ana içerikte gösterilen test süresi geri sayım banner'ı.

**Kaynak:** `pages/product_search.html`

```html
<div id="trialBanner" class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-lg shadow-lg mb-6 hidden">
    <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
            <div class="bg-white bg-opacity-20 p-2 rounded-full">
                <svg class="w-6 h-6">...</svg>
            </div>
            <div>
                <h3 class="text-lg font-semibold">⏰ Test Süreniz</h3>
                <p class="text-sm opacity-90" id="trialBannerText">Yükleniyor...</p>
            </div>
        </div>
        <div class="text-right">
            <div class="text-2xl font-bold" id="trialBannerCountdown">--</div>
            <div class="text-xs opacity-80" id="trialBannerUnit">gün</div>
        </div>
    </div>
</div>
```

---

## SLAYT 9: Ürün Arama Bölümü

**Açıklama:** Ana arama kutusu; placeholder, panodan yapıştır, temizle, liste/grid toggle, ipuçları.

**Kaynak:** `pages/product_search.html`

```html
<section class="mb-8">
    <div class="bg-surface rounded-xl border border-border shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
                <div class="bg-primary-50 rounded-lg p-2">
                    <svg class="w-5 h-5 text-primary">...</svg>
                </div>
                <div>
                    <h2 class="text-lg font-semibold text-text-primary">Ürün Arama</h2>
                    <p class="text-sm text-text-secondary">Ürün adını yazarak barkod bilgilerine ulaşın</p>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <button id="viewListBtn" class="view-toggle-btn active">Liste</button>
                <button id="viewGridBtn" class="view-toggle-btn">Grid</button>
            </div>
        </div>
        <div class="relative">
            <input type="text" id="searchInput" placeholder="Ürün adını yazın veya tablo verisi yapıştırın... (örn: Nesfit, Coca Cola)" class="input-field pl-12 text-lg h-14" autocomplete="off" />
            <button id="pasteFromClipboard" title="Panodan yapıştır">📋</button>
            <button id="clearSearch" class="hidden">×</button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 search-tips">
            <span class="text-xs text-text-secondary">İpucu:</span>
            <span class="px-2 py-1 rounded-md bg-primary-50 text-primary text-xs">Virgülle ayırarak birden fazla terim arayabilirsiniz</span>
            <span class="px-2 py-1 rounded-md bg-accent-50 text-accent text-xs">Türkçe karakterler desteklenir</span>
            <span class="px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs">Tablo formatında veri yapıştırabilirsiniz</span>
        </div>
    </div>
</section>
```

---

## SLAYT 10: Arama Sonuçları – Tablo Görünümü

**Açıklama:** Arama sonuçlarının masaüstü tablo yapısı; ürün adı, barkod, raf, stok sütunları.

**Kaynak:** `pages/product_search.html`

```html
<section id="resultsSection" class="hidden">
    <div class="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div class="bg-secondary-50 px-6 py-4 border-b border-border">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-text-primary">Arama Sonuçları</h3>
                    <p id="resultCount" class="text-sm text-text-secondary">0 ürün bulundu</p>
                </div>
                <button id="exportResults" class="btn-secondary text-sm hidden">Dışa Aktar</button>
            </div>
        </div>
        <div class="hidden md:block">
            <table class="w-full">
                <thead class="bg-secondary-50">
                    <tr>
                        <th class="px-6 py-4 text-left text-sm font-semibold">Ürün Adı</th>
                        <th class="px-6 py-4 text-left text-sm font-semibold">Barkod Bilgileri</th>
                        <th class="px-6 py-4 text-left text-sm font-semibold">Raf Konumu</th>
                        <th class="px-6 py-4 text-center text-sm font-semibold">Stok</th>
                    </tr>
                </thead>
                <tbody id="resultsTableBody" class="divide-y divide-border"></tbody>
            </table>
        </div>
    </div>
</section>
```

---

## SLAYT 11: Sonuç Bulunamadı ve Başlangıç Durumu

**Açıklama:** Sonuç yok mesajı ve ilk açılışta gösterilen hoş geldiniz alanı.

**Kaynak:** `pages/product_search.html`

```html
<div id="noResultsState" class="hidden">
    <div class="bg-surface rounded-xl border border-border shadow-sm p-12 text-center">
        <h3 class="text-lg font-semibold text-text-primary mb-2">Sonuç Bulunamadı</h3>
        <p class="text-text-secondary mb-4">Aradığınız kriterlere uygun ürün bulunamadı.</p>
        <p>• Ürün adını doğru yazdığınızdan emin olun</p>
        <p>• Farklı anahtar kelimeler deneyin</p>
    </div>
</div>

<div id="initialState">
    <div class="bg-surface rounded-xl border border-border shadow-sm p-12 text-center">
        <h3 class="text-xl font-semibold text-text-primary mb-3">Ürün Barkod Arama Sistemi</h3>
        <p class="text-text-secondary mb-6">Ürün adını yazarak hızlıca barkod bilgilerine ulaşın. Sistem Türkçe karakterleri destekler ve virgülle ayırarak birden fazla terim arayabilirsiniz.</p>
    </div>
</div>
```

---

## SLAYT 12: Ürün Ekle Modalı

**Açıklama:** HTML tablo verisi yapıştırma ile ürün ekleme modalı.

**Kaynak:** `pages/product_search.html`

```html
<div id="addProductModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
    <div class="bg-surface rounded-xl border border-border shadow-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-text-primary">🛍️ Ürün Ekle</h3>
            <button id="closeAddProduct">×</button>
        </div>
        <div class="space-y-4">
            <div class="bg-blue-50 rounded-lg p-4">
                <h4 class="font-medium text-blue-700 mb-2">📋 HTML Tablo Verisi</h4>
                <p class="text-sm text-blue-600 mb-3">Aşağıdaki alana HTML tablo verisini yapıştırın:</p>
                <textarea id="htmlTableInput" placeholder="HTML tablo verisini buraya yapıştırın..." class="w-full h-24 p-3 border border-gray-300 rounded-lg"></textarea>
            </div>
            <div class="flex space-x-2">
                <button id="parseHtmlTable" class="btn-primary text-sm">Verileri Analiz Et</button>
                <button id="clearHtmlInput" class="btn-secondary text-sm">Temizle</button>
            </div>
            <div id="parsedProducts" class="hidden">
                <div class="bg-green-50 rounded-lg p-4">
                    <h4 class="font-medium text-green-700">✅ Analiz Sonuçları</h4>
                </div>
                <button id="addAllProducts" class="btn-primary text-sm">Tümünü Ekle</button>
                <button id="addSelectedProducts" class="btn-accent text-sm">Seçilenleri Ekle</button>
            </div>
        </div>
    </div>
</div>
```

---

## SLAYT 13: Ayarlar Modalı

**Açıklama:** Ayarlar penceresi; premium özellikler, veri bilgileri, ürün yönetimi, görüntüleme, güncelleme geçmişi.

**Kaynak:** `pages/product_search.html`

```html
<div id="settingsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
    <div class="bg-surface rounded-xl border border-border shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between p-6 border-b border-border">
            <h3 class="text-2xl font-bold text-text-primary">Ayarlar</h3>
            <button id="closeSettings">×</button>
        </div>
        <div class="overflow-y-auto flex-1 p-6">
            <div class="bg-gradient-to-br from-purple-50 via-purple-100 to-pink-50 rounded-xl p-4 border-2 border-purple-200 mb-4">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">⭐</span>
                        <h4 class="text-lg font-bold">Premium Özellikler</h4>
                    </div>
                    <span class="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full">PREMIUM</span>
                </div>
                <p class="text-xs text-gray-600 mb-3">İş verimliliğinizi artıracak özellikler</p>
                <div id="premiumFeaturesSettings" class="grid grid-cols-1 md:grid-cols-2 gap-2"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-primary-50 rounded-lg p-3">
                    <h4 class="font-medium text-primary text-sm mb-2">Veri Bilgileri</h4>
                    <p>Ürün: <span id="totalProducts">-</span></p>
                    <p>Tekrar: <span id="duplicateProducts">-</span></p>
                </div>
                <div class="bg-blue-50 rounded-lg p-3">
                    <h4 class="font-medium text-blue-600 text-sm mb-2">Ürün Yönetimi</h4>
                    <button id="manageProductsBtn">Yönet</button>
                    <button id="exportProductsBtn">Aktar</button>
                </div>
                <div class="bg-yellow-50 rounded-lg p-3">
                    <h4 class="font-medium text-yellow-700 text-sm mb-2">Görüntüleme Ayarları</h4>
                    <label><input type="checkbox" id="antiGlareModeUserToggle"> Parlama Önleme Modu</label>
                </div>
                <div class="bg-green-50 rounded-lg p-3 md:col-span-2">
                    <h4 class="font-medium text-green-700 text-sm mb-2">Veri Güncelleme</h4>
                    <button id="refreshData">Yenile</button>
                    <button id="analyzeDuplicates">Analiz</button>
                    <button id="cleanDuplicates">Temizle</button>
                </div>
            </div>
            <div class="mt-6 pt-6 border-t border-gray-200">
                <button id="openChangelogFromSettings" class="w-full bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold py-2.5 px-4 rounded-lg">
                    Güncelleme Geçmişi
                </button>
            </div>
        </div>
    </div>
</div>
```

---

## SLAYT 14: Klavye Kısayolları Modalı

**Açıklama:** Premium özellik – klavye kısayolları yönetim modalı.

**Kaynak:** `pages/product_search.html`

```html
<div id="keyboardShortcutsModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] hidden">
    <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div class="bg-gradient-to-r from-purple-400 via-purple-500 to-pink-400 text-white p-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <span class="text-4xl">⌨️</span>
                    <div>
                        <h3 class="text-2xl font-bold">Klavye Kısayolları</h3>
                        <p class="text-purple-100 text-sm mt-1">Ürünlerinize hızlı erişim için tuş atayın</p>
                    </div>
                </div>
                <button id="closeKeyboardShortcutsModal">×</button>
            </div>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
            <div class="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 class="font-semibold text-gray-900 mb-3">Ayar</h4>
                <label>Arama Çubuğuna Odaklan</label>
                <input type="checkbox" id="keyboardShortcutsFocusInput">
            </div>
            <div id="keyboardShortcutsList" class="space-y-3 mb-4"></div>
            <div>
                <h4 class="font-semibold mb-2">Yeni Kısayol Ekle</h4>
                <input type="text" id="shortcutKeyInput" placeholder="Klavye Tuşu/Kombinasyonu">
                <button id="addShortcutBtn">➕ Kısayol Ekle</button>
            </div>
        </div>
    </div>
</div>
```

---

## SLAYT 15: Sayım Sayfası – Header

**Açıklama:** Sayım sayfasının üst barı; geri butonu, logo, kullanıcı bilgisi, çıkış.

**Kaynak:** `pages/counting.html`

```html
<header class="bg-surface border-b border-border shadow-sm sticky top-0 z-40">
    <div class="w-full mx-auto px-2 sm:px-4 lg:px-8">
        <div class="flex items-center justify-between h-14 sm:h-16">
            <div class="flex items-center space-x-2 sm:space-x-3">
                <button id="backToSearchBtn" class="flex items-center space-x-1 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg" title="Barkod Arama Sayfasına Dön">
                    <svg class="w-4 h-4">...</svg>
                    <span class="hidden sm:inline">Barkod Aramaya Dön</span>
                    <span class="sm:hidden">Arama</span>
                </button>
                <img src="../assets/logo.png" alt="FlowCobalt" class="w-8 h-8 object-contain">
                <div>
                    <h1 class="text-lg sm:text-xl font-bold text-text-primary">FlowCobalt</h1>
                    <p class="text-xs sm:text-sm text-text-secondary">Stok Sayım Sistemi</p>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <div class="text-right hidden xl:block">
                    <p id="userName">Yükleniyor...</p>
                    <p id="userCompany">Yükleniyor...</p>
                </div>
                <button id="logoutBtn" class="btn-secondary">Çıkış</button>
            </div>
        </div>
    </div>
</header>
```

---

## SLAYT 16: Sayım Sayfası – Tab Geçişi (Sayım / Finans)

**Açıklama:** Sayım ve Finans sekmeleri.

**Kaynak:** `pages/counting.html`

```html
<div class="bg-white rounded-xl shadow-md border border-gray-100 mb-6 overflow-hidden">
    <div class="flex border-b border-gray-200">
        <button id="tabSayim" class="tab-button flex-1 px-4 py-3 font-semibold text-gray-600 border-b-2 border-transparent active" data-tab="sayim">
            <div class="flex items-center justify-center space-x-2">
                <svg class="w-5 h-5">...</svg>
                <span>Sayım</span>
            </div>
        </button>
        <button id="tabFinans" class="tab-button flex-1 px-4 py-3 font-semibold text-gray-600 border-b-2 border-transparent" data-tab="finans">
            <div class="flex items-center justify-center space-x-2">
                <svg class="w-5 h-5">...</svg>
                <span>Finans</span>
            </div>
        </button>
    </div>
</div>
```

---

## SLAYT 17: Sayım – Tablo Seçici ve Yönetim Butonları

**Açıklama:** Sayım tablosu seçici dropdown; yeniden adlandır, yeni tablo, tablo sil butonları.

**Kaynak:** `pages/counting.html`

```html
<div class="bg-white rounded-xl shadow-md border border-gray-100 p-4 sm:p-5 mb-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center space-x-1 sm:space-x-2">
            <div class="relative min-w-[120px] sm:min-w-[150px]">
                <button id="tableSelectorBtn" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center justify-between">
                    <span id="tableSelectorText" class="text-gray-700 truncate font-medium">Tablo Seçin</span>
                    <svg class="w-4 h-4 text-gray-500">▼</svg>
                </button>
                <div id="tableSelectorDropdown" class="hidden absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"></div>
            </div>
            <button id="renameTableBtn" title="Tablo Adını Değiştir">✏️</button>
            <button id="createTableBtn" title="Yeni Tablo Oluştur">➕</button>
            <button id="deleteTableBtn" title="Tablo Sil" class="text-red-600">🗑️</button>
        </div>
    </div>
</div>
```

---

## SLAYT 18: Sayım – Ürün Ekle Bölümü

**Açıklama:** Manuel giriş, ara, kamera, terminal butonları ile ürün ekleme alanı.

**Kaynak:** `pages/counting.html`

```html
<div class="bg-white rounded-xl shadow-md border border-gray-100 p-5 sm:p-6 mb-6">
    <h3 class="text-xl font-bold text-gray-900 mb-5 flex items-center space-x-2">
        <svg class="w-6 h-6 text-blue-600">➕</svg>
        <span>Ürün Ekle</span>
    </h3>
    <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1 relative">
            <input type="text" id="manualProductInput" placeholder="Ürün adı, barkod veya gram değeri girin..." class="w-full py-3 pl-12 pr-4 border-2 border-gray-200 rounded-xl">
            <div id="manualInputResults" class="hidden absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto"></div>
        </div>
        <div class="flex gap-2 sm:gap-3 flex-wrap">
            <button id="addProductBtn" class="bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl px-5 py-3 font-semibold">➕ Ekle</button>
            <button id="searchProductBtn" class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl px-5 py-3 font-semibold">🔍 Ara</button>
            <button id="cameraScanBtn" class="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl px-5 py-3 font-semibold">📷 Kamera</button>
            <button id="terminalScanBtn" class="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-5 py-3 font-semibold">Terminal</button>
        </div>
    </div>
</div>
```

---

## SLAYT 19: Sayım – Senkronizasyon Bölümü

**Açıklama:** Sistem stokları senkronizasyonu; depo sıfırla, sistem sıfırla, senkronize et butonları.

**Kaynak:** `pages/counting.html`

```html
<div class="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6 w-full">
    <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div class="flex-1">
            <h3 class="text-base sm:text-lg font-semibold text-text-primary">Sistem Stokları</h3>
            <p class="text-xs sm:text-sm text-text-secondary">Depo stoku girilen ürünler için sistem stoklarını getir</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
            <button id="resetWarehouseStocksBtn" class="px-4 py-2.5 bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border border-orange-200 rounded-xl font-semibold">
                Depo Stoklarını Sıfırla
            </button>
            <button id="resetSystemStocksBtn" class="px-4 py-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 border border-purple-200 rounded-xl font-semibold">
                Sistem Stoklarını Sıfırla
            </button>
            <button id="syncStocksBtn" class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg">
                Senkronize Et
            </button>
        </div>
    </div>
</div>
```

---

## SLAYT 20: Sayım – API Durum Kartı

**Açıklama:** Getir eklentisi token durumu; API durumu, depo bilgisi, kalan süre, yenile butonu.

**Kaynak:** `pages/counting.html`

```html
<div id="apiStatusCard" class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm p-3 sm:p-4 mb-6 w-full hidden">
    <div class="flex items-start justify-between">
        <div class="flex items-start space-x-3 flex-1">
            <div id="apiStatusIcon" class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600">✓</svg>
            </div>
            <div class="flex-1">
                <h4 class="text-sm font-semibold text-gray-900 mb-1">API Durumu</h4>
                <p id="apiStatusText" class="text-sm text-gray-600 mb-1">Token yükleniyor...</p>
                <p id="apiWarehouseInfo" class="text-xs text-gray-500 mb-2">Depo: <span id="apiWarehouseName">-</span></p>
                <div id="apiExpiryInfo" class="text-xs text-gray-500">
                    <span id="apiExpiryTime">Kalan süre: -</span>
                </div>
            </div>
        </div>
        <button id="refreshTokenBtn" class="ml-3 p-2 text-blue-600 hover:bg-blue-100 rounded-lg" title="Token'ı yenile">
            <svg class="w-5 h-5">🔄</svg>
        </button>
    </div>
</div>
```

---

## SLAYT 21: Sayım – İstatistik Kartları

**Açıklama:** Toplam sayılan, fazla ürün, eksik ürün kartları.

**Kaynak:** `pages/counting.html`

```html
<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6 w-full">
    <div class="bg-white rounded-2xl shadow-soft p-5 border border-gray-100 stat-card">
        <p class="text-sm font-medium text-gray-500 mb-1">Toplam Sayılan</p>
        <p class="text-3xl font-bold text-gray-800" id="totalProductsCount">0</p>
        <div class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-300"></div>
    </div>
    <div class="bg-white rounded-2xl shadow-soft p-5 border border-gray-100 stat-card">
        <p class="text-sm font-medium text-gray-500 mb-1">Fazla Ürün</p>
        <p class="text-3xl font-bold text-emerald-600" id="positiveDifferenceCount">0</p>
        <div class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-300"></div>
    </div>
    <div class="bg-white rounded-2xl shadow-soft p-5 border border-gray-100 stat-card">
        <p class="text-sm font-medium text-gray-500 mb-1">Eksik Ürün</p>
        <p class="text-3xl font-bold text-rose-600" id="negativeDifferenceCount">0</p>
        <div class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-rose-300"></div>
    </div>
</div>
```

---

## SLAYT 22: Sayım – Tablo Başlıkları (Masaüstü Görünümü)

**Açıklama:** Sayım tablosunun sütun başlıkları; Görsel, Ürün Adı, Depo Stoku, Sistem Stoku, Fark, Tarih, İşlemler.

**Kaynak:** `pages/counting.html`

```html
<div id="desktopTableView" class="hidden md:block overflow-x-auto">
    <table class="w-full">
        <thead class="bg-gray-50">
            <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Görsel</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="productName">Ürün Adı</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="warehouseStock">Depo Stoku</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="systemStock">Sistem Stoku</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="difference">Fark</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sortable-header" data-sort-field="date">Tarih/Saat</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
            </tr>
        </thead>
        <tbody id="countingTableBody" class="bg-white divide-y divide-gray-200"></tbody>
    </table>
</div>
```

---

## SLAYT 23: Finans Sekmesi – Özet Kartları ve Grafikler

**Açıklama:** Finansal analiz; tablo seçici, özet kartları, grafik carousel.

**Kaynak:** `pages/counting.html`

```html
<div id="finansTabContent" class="tab-content hidden">
    <div class="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-gray-900">Finansal Analiz</h3>
            <button id="financialTableSelectorBtn">
                <span id="financialTableSelectorText">Tüm Tablolar</span> ▼
            </button>
        </div>
    </div>
    <div id="financialSummaryCards" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"></div>
    <div class="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Grafikler</h3>
        <div id="chartCarousel">
            <div id="chartSlidesContainer">
                <div class="chart-slide"><h4>Kategori Dağılımı</h4><canvas id="categoryPieChart"></canvas></div>
                <div class="chart-slide"><h4>Kategori Kar/Zarar</h4><canvas id="categoryBarChart"></canvas></div>
                <div class="chart-slide"><h4>Top 10 En Çok Kar Eden Ürünler</h4><canvas id="topProfitProductsChart"></canvas></div>
                <div class="chart-slide"><h4>Top 10 En Çok Zarar Eden Ürünler</h4><canvas id="topLossProductsChart"></canvas></div>
            </div>
        </div>
    </div>
</div>
```

---

## Özet – Slayt Sırası Önerisi

| Slayt | Konu |
|-------|------|
| 1 | Giriş – Üst bar |
| 2 | Giriş – Kart başlığı |
| 3 | Giriş – Form alanları |
| 4 | Giriş – Bize Ulaşın / Destek |
| 5 | Destek Sohbeti |
| 6 | Ana sayfa – Header |
| 7 | Mobil menü |
| 8 | Trial banner |
| 9 | Ürün arama bölümü |
| 10 | Arama sonuçları |
| 11 | Sonuç yok / Başlangıç |
| 12 | Ürün ekle modalı |
| 13 | Ayarlar modalı |
| 14 | Klavye kısayolları |
| 15 | Sayım – Header |
| 16 | Sayım / Finans sekmeleri |
| 17 | Tablo seçici |
| 18 | Ürün ekle (sayım) |
| 19 | Senkronizasyon |
| 20 | API durum kartı |
| 21 | İstatistik kartları |
| 22 | Sayım tablosu |
| 23 | Finans sekmesi |

---

*Bu doküman Notebook LM veya sunum araçlarına yüklenerek slayt içerikleri üretmek için kullanılabilir.*
