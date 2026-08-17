/** Ürün detay — API alan etiketleri */
const COUNTING_PRODUCT_DETAIL_API_FIELD_LABELS = {
    remainingShelfLife: 'Kalan raf ömrü',
    remainingShelfLifeInDays: 'Kalan raf ömrü (gün)',
    totalShelfLife: 'Toplam raf ömrü',
    totalShelfLifeInDays: 'Toplam raf ömrü (gün)',
    shelfLifeInDays: 'Raf ömrü (gün)',
    shelfLife: 'Raf ömrü',
    removeFromSaleBeforeExpiryInDays: 'SKT\'den kaç gün önce çıkmalı',
    removeFromSaleDays: 'Satıştan kaldırma süresi (gün)',
    removeFromSaleDayCount: 'Satıştan kaldırma (gün)',
    storageType: 'Depolama tipi',
    storageCondition: 'Depolama koşulu',
    storageTemperature: 'Depolama sıcaklığı',
    vatRate: 'KDV oranı',
    weight: 'Ağırlık',
    unit: 'Birim',
    unitOfMeasure: 'Ölçü birimi',
    sapReferenceCode: 'SAP kodu',
};

/** Ürün detay — gizlenebilir bölüm ve alan etiketleri */
const COUNTING_PRODUCT_DETAIL_FIELD_LABELS = {
    section_hero: 'Üst özet',
    section_category: 'Kategori yolu',
    section_price: 'Fiyat',
    section_stock: 'Stok durumu',
    section_skt: 'SKT & Raf ömrü',
    section_packaging: 'Ambalaj barkodları',
    section_flags: 'Durum',
    section_group_urun: 'Ürün & kategori',
    section_group_barkod: 'Barkodlar',
    section_group_teknik: 'Teknik',
    product_id: 'Ürün ID',
    description: 'Açıklama',
    short_desc: 'Paket / gramaj',
    brand: 'Marka',
    category_path: 'Kategori yolu',
    shelf: 'Raf',
    storage_type: 'Depolama',
    return_policy: 'İade politikası',
    barcodes: 'Katalog barkodları',
    sap: 'SAP kodu',
    warehouse: 'Depo ID',
    price_type: 'Fiyat tipi',
    manufacturer: 'Üretici ID',
    suppliers: 'Tedarikçi sayısı',
    last_updated: 'Son sayım güncellemesi',
};

// Counting System for Stock Management

/** Alt kategori listesi — tablo oluşturma combobox için */
const COUNTING_SUBCATEGORIES = [
    "Ağız Bakım","Ağda & Tüy Dökücü","Ayran & Kefir","Baharat","Bakliyat",
    "Bal & Reçel","Balık & Deniz Ürünleri","Bar","Bebek Bakım","Bebek Bezi",
    "Beyaz Et","Beyaz Peynir","Biberon & Emzik","Bisküvi","Böcek İlacı",
    "Bulaşık","Bulgur","Buz","Çamaşır","Çay",
    "Çiğ Köfte & Meze","Çikolata Bar","Çocuklara Özel","Çorba","Çubuk",
    "Çoklu","Cips","Deodorant","Dergi","Diğer",
    "Donuk Et & Tavuk & Balık","Donuk Hazır Yemek & Atıştırmalık",
    "Donuk Meyve Sebze","Donuk Pasta & Tatlı","Donuk Unlu Mamüller",
    "Duş & Banyo","Elektrik & Aydınlatma",
    "Enerji İçeceği","Fit & Form","Fonksiyonel İçecekler","Gazlı İçecek",
    "Genel Sağlık","Giyim","Glutensiz","Gofret","Hazır Yemek","Helva",
    "Hijyenik Ped","Islak Havlu","İthal Peynir","Jel","Kağıt Ürünleri",
    "Kahvaltılık Gevrek","Kahve","Kaşar & Tost Peyniri","Kedi","Kek",
    "Kırmızı Et","Kırtasiye","Kolonya","Konserve","Köpek",
    "Kozmetik","Kraker & Kurabiye","Krema & Kaymak","Kuruyemiş","Kutu",
    "Külah","Maden Suyu","Makarna","Mama","Margarin","Meyve","Meyve Suyu",
    "Mutfak","Mutfak Ürünleri","Oda Kokusu","Oyun & Oyuncak","Paketli Ekmek",
    "Parti Malzemeleri","Pasta Malzemeleri","Pastörize Süt",
    "Patlamış Mısır ve Tahıl Patlağı","Paylaşımlık & Draje","Piknik","Pil",
    "Pirinç","Prezervatif","Sabun","Saç Bakım","Saç Boyası",
    "Sakız & Şekerleme","Salça","Sandviç","Sebze",
    "Seyahat Ürünleri","Sıvı Yağ","Sirke & Salata Sosu","Sos","Soğuk Çay",
    "Soğuk Kahve","Su","Süt & Salep","Sütlü Tatlı",
    "Sürülebilir","Sürülebilir Peynir","Şarj Aleti & Kablo","Şarküteri",
    "Şeker","Tahin & Pekmez","Tablet Çikolata","Tatlı","Taze Fırın",
    "Taze Yemek","Teknoloji","Temizlik","Tereyağı","Ton Balığı",
    "Tıraş Malzemeleri","Turşu","Un","Unlu Mamüller","Uzun Ömürlü Süt",
    "Vegan","Vücut & El Bakım","Yeşillik","Yoğurt","Yöresel Peynir",
    "Yumurta",    "Zeytin","Zeytinyağı"
];

/** O(1) sabit alt kategori tablo adı kontrolü */
const COUNTING_SUBCATEGORIES_SET = new Set(COUNTING_SUBCATEGORIES);

/** Alt kategori başına tahmini ürün çeşidi (tablo oluşturma rehberi) */
const COUNTING_SUBCATEGORY_ESTIMATES = {
    'Ağda & Tüy Dökücü': 5, 'Ağız Bakım': 38, 'Ayran & Kefir': 27, 'Baharat': 33, 'Bakliyat': 17,
    'Balık & Deniz Ürünleri': 2, 'Bal & Reçel': 8, 'Bar': 10, 'Bebek Bakım': 12, 'Bebek Bezi': 24,
    'Beyaz Et': 10, 'Beyaz Peynir': 26, 'Biberon & Emzik': 2, 'Bisküvi': 70, 'Böcek İlacı': 10,
    'Bulaşık': 24, 'Bulgur': 3, 'Buz': 1, 'Cips': 95, 'Çamaşır': 52, 'Çay': 27,
    'Çiğ Köfte & Meze': 10, 'Çikolata Bar': 27, 'Çocuklara Özel': 14, 'Çoklu': 12, 'Çorba': 27,
    'Çubuk': 31, 'Deodorant': 31, 'Dergi': 1, 'Diğer': 1,
    'Donuk Et & Tavuk & Balık': 4, 'Donuk Hazır Yemek & Atıştırmalık': 6, 'Donuk Meyve Sebze': 15,
    'Donuk Pasta & Tatlı': 3, 'Donuk Unlu Mamüller': 7, 'Duş & Banyo': 18, 'Elektrik & Aydınlatma': 4,
    'Enerji İçeceği': 19, 'Fit & Form': 84, 'Fonksiyonel İçecekler': 1, 'Gazlı İçecek': 62,
    'Genel Sağlık': 4, 'Giyim': 18, 'Glutensiz': 5, 'Gofret': 64, 'Hazır Yemek': 37, 'Helva': 6,
    'Hijyenik Ped': 16, 'Islak Havlu': 2, 'İthal Peynir': 2, 'Jel': 3, 'Kağıt Ürünleri': 16,
    'Kahvaltılık Gevrek': 32, 'Kahve': 59, 'Kaşar & Tost Peyniri': 16, 'Kedi': 29, 'Kek': 77,
    'Kırmızı Et': 4, 'Kırtasiye': 8, 'Kolonya': 4, 'Konserve': 23, 'Köpek': 7, 'Kozmetik': 19,
    'Kraker & Kurabiye': 41, 'Krema & Kaymak': 13, 'Kuruyemiş': 85, 'Kutu': 32, 'Külah': 17,
    'Maden Suyu': 46, 'Makarna': 29, 'Mama': 27, 'Margarin': 5, 'Meyve': 19, 'Meyve Suyu': 64,
    'Mutfak': 13, 'Mutfak Ürünleri': 5, 'Oda Kokusu': 6, 'Oyun & Oyuncak': 6, 'Paketli Ekmek': 26,
    'Parti Malzemeleri': 2, 'Pasta Malzemeleri': 23, 'Pastörize Süt': 5,
    'Patlamış Mısır ve Tahıl Patlağı': 21, 'Paylaşımlık & Draje': 48, 'Piknik': 6, 'Pil': 7,
    'Pirinç': 9, 'Prezervatif': 13, 'Sabun': 16, 'Saç Bakım': 55, 'Saç Boyası': 8,
    'Sakız & Şekerleme': 70, 'Salça': 13, 'Sandviç': 11, 'Sebze': 20, 'Seyahat Ürünleri': 1,
    'Sıvı Yağ': 10, 'Sirke & Salata Sosu': 5, 'Soğuk Çay': 54, 'Soğuk Kahve': 18, 'Sos': 52,
    'Su': 26, 'Sürülebilir': 23, 'Sürülebilir Peynir': 19, 'Süt & Salep': 1, 'Sütlü Tatlı': 21,
    'Şarj Aleti & Kablo': 1, 'Şarküteri': 49, 'Şeker': 3, 'Tablet Çikolata': 80, 'Tahin & Pekmez': 4,
    'Tatlı': 11, 'Taze Fırın': 16, 'Taze Yemek': 1, 'Teknoloji': 16, 'Temizlik': 48, 'Tereyağı': 12,
    'Tıraş Malzemeleri': 14, 'Ton Balığı': 19, 'Turşu': 14, 'Un': 8, 'Unlu Mamüller': 17,
    'Uzun Ömürlü Süt': 36, 'Vegan': 15, 'Vücut & El Bakım': 10, 'Yeşillik': 13, 'Yoğurt': 47,
    'Yöresel Peynir': 17, 'Yumurta': 9, 'Zeytin': 28, 'Zeytinyağı': 6,
};

class CountingSystem {
    constructor() {
        this.countingData = {}; // { productId: { warehouseStock, systemStock, lastUpdated, history } }
        this.allProducts = []; // All available products
        this.currentUser = null;
        this.STORAGE_KEY = 'counting_data';
        this.currentTableName = 'Ana Sayım'; // Aktif sayım tablosu
        /** Genel / günlük alt sekme geçişlerinde son seçilen tablolar */
        this._lastGeneralTableName = 'Ana Sayım';
        this._lastDailyTableName = null;
        this.currentSort = null; // { field: 'productName', direction: 'asc' } or null
        this.lastTokenCheckTime = null; // Son token kontrol zamanı (gereksiz çağrıları önlemek için)
        this.lastTokenExpiry = null; // Son kontrol edilen token expiry (değişiklik tespiti için)
        this.isTokenUpdateInProgress = false; // Token güncelleme devam ediyor mu? (çoklu çağrıları önlemek için)
        this.currentViewMode = 'rapid'; // Her sayfa açılışında Grid (rapid) öncelik; kullanıcı o an değiştirebilir
        this.currentCountingProduct = null; // Açık modal'daki ürün ID
        this.skippedProducts = new Set(); // Atlanan ürün ID'leri
        this.autoSaveTimeout = null; // Otomatik kaydetme için timeout
        const _savedTab = localStorage.getItem('counting_active_tab') || 'sayim';
        this.currentTab = 'sayim';
        void _savedTab;
        /** Stok farkı sekmesi: seçili tablo adları (varsayılan tümü, ilk açılışta doldurulur) */
        this._farkTableSelection = null;
        /** Önceki tablo listesi — yalnızca yeni eklenen tablolar otomatik seçilir (kullanıcı iptalini ezmez) */
        this._farkTableNamesSnapshot = null;
        /** Stok farkı: günlük tabloları listeden gizle */
        try {
            this._farkHideDailyTables = sessionStorage.getItem('counting_fark_hide_daily') === '1';
        } catch (e) {
            this._farkHideDailyTables = false;
        }
        this.selectedFinancialTable = null; // Seçili finans tablosu ('all' veya table name) — sayım tablosuyla senkron
        /** Tablo oluştur combobox: mevcut kategorileri gizle */
        this._createTableHideExisting = false;
        this._financeBarcodesVisible = false; // Finans Stok Özeti barkodları (varsayılan gizli)
        this.productSortOrder = 'desc'; // 'asc' | 'desc' - Finans tabındaki ürün sıralaması
        this.financialProducts = []; // Finans tabındaki ürünler (sıralama için)
        this.categoryPieChart = null; // Chart.js pie chart instance
        this.categoryBarChart = null; // Chart.js bar chart instance
        this.topProfitProductsChart = null; // Top profit products chart
        this.topLossProductsChart = null; // Top loss products chart
        this.topValueProductsChart = null; // Top value products chart
        this.topStockDiffChart = null; // Top stock difference chart
        this.currentChartIndex = 0; // Current chart index in carousel
        this.totalCharts = 6; // Total number of charts
        this.chartCarouselSetup = false;
        /** Depo takibi: kısa işlem kayıtları (Supabase counting_data._auditLog) */
        this.auditLog = [];
        this.AUDIT_LOG_MAX = 200;
        /** İşlem kaydı paneli filtreleri (arama / tablo / işlem türü) */
        this._auditUiFilter = { search: '', table: '', category: '' };
        this._auditSearchDebounce = null;
        /** syncSystemStocks içinde tekil stok satırlarını denetim günlüğüne yazma */
        this._auditSyncBatch = false; // Chart carousel setup flag
        /** Sayım bottom sheet açıkken stok audit tek satırda birleştirilir (kapanınca / ürün değişince flush) */
        this._deferStockAuditWhileSheetOpen = false;
        this._stockAuditDirty = false;
        /** Sadece UI: renderTable çağrılarını birleştir (Supabase kaydına dokunmaz) */
        this._renderTableDebounceTimer = null;
        this.cameraScanAndCountMode = false; // Kamera: barkod okutunca sayım ekranı açılsın
        this.cameraTableOnlyScanMode = false; // Tablo İçi Sayım: yalnızca tablodaki ürünler
        /** Finans: orijinal (struckPrice) fiyatı kullan — default true, sayfa yenilenince sıfırlanır */
        this._financeUseStruckPrice = true;
        /** Finans Stok Özeti — oturum içi yapıştırma rehberi (kaydedilmez) */
        this._financePasteGuide = null;
        /** Rehber SKT önbelleği — productId → [{ date, qty }] (kaydedilmez) */
        this._financePasteGuideSkt = new Map();
        /** SKT Getir sonrası warehouse linki + yapıştır modu */
        this._financePasteGuideSktLinkReady = false;
        this._financePasteGuideSktUrl = null;
        this._financePasteGuideSelectedIndex = null;
        /** Oturum içi ürün fiyat önbelleği — API tekrarlarını azaltır */
        this._productPriceCache = new Map();
        this._priceFetchInFlight = new Set();
        /** Finans hesap önbelleği — tablo anahtarı → { key, data } */
        this._financeCalcCache = new Map();
        this._financeBgEnrichQueue = new Set();
        this._financeBgEnrichRunner = null;
        this._financeBgRefreshTimer = null;
        /** Seri okuma + sayarak ilerle: sayım sheet'i kamera akışından açıldı (Önceki/Sıradaki yerine Doğru Girdim) */
        this.countingBottomSheetFromCameraSeriSayar = false;
        /** DEPO yanındaki kamera ile barkod doğrulama devam ediyor mu */
        this._barcodeVerifyInProgress = false;
        /** Sayım bottom sheet açıkken arka plan scroll kilidi (iOS dahil) */
        this._countingSheetBodyLocked = false;
        this._countingSheetScrollY = 0;
        /** Genel tablolardan ayrılmak için günlük tablo adları: `Günlük|YYYY-MM-DD` */
        this.DAILY_TABLE_PREFIX = 'Günlük|';
        /** `deleteDailyTableModal` onayı için */
        this._pendingDailyDeleteTableName = null;
        /** Genel tablo dropdown — üst arama sonrası liste (dropdown içi filtre için) */
        this._lastFilteredGeneral = [];
        /** scheduleScrollActiveGeneralTableChip zamanlayıcıları */
        this._scrollGeneralChipTimers = null;
        /** Cihaza özgü aktif tablo anahtarı — Supabase'e yazılmaz */
        this.DEVICE_TABLE_KEY = 'counting_current_table';
        /** Tüm sayım blob'unun bellek kopyası — her Supabase SELECT'i ortadan kaldırır */
        this.cachedFullData = null;
        /** Ürün ID → ürün nesnesi eşlemesi (O(1) arama için) */
        this.productIndex = new Map();
        /** scheduleSave debounce timer */
        this._saveDebounceTimer = null;
        /** Incremental grid render: son çizilen ürün ID sırası */
        this._rapidRenderedIds = [];
        /** Incremental grid render: son çizilen her kartın durum anahtarı */
        this._rapidRenderedStates = new Map();
        /** Delegated event listeners kuruldu mu (tek seferlik) */
        this._delegatedListenersSetup = false;
        /** Cihaza özgü benzersiz kimlik — realtime echo filtrelemesi için */
        this.deviceId = 'dev_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
        /** Toplu yapıştırma / içe aktarma sırasında arka plan sync'i durdurur */
        this._importInProgress = false;
        this._busyDepth = 0;
        this._sheetStockFetchInFlight = false;
        this._sheetStockFetchReject = null;
        this._sheetStockFetchSlowTimer = null;
        this._sheetStockFetchTimeoutTimer = null;
        this.SHEET_STOCK_FETCH_SLOW_MS = 10000;
        this.SHEET_STOCK_FETCH_TIMEOUT_MS = 45000;
        /** Aktif tablo catch-up debounce (çok cihaz — tek tablo sorgusu) */
        this._activeTableCatchUpTimer = null;
        this._activeTableCatchUpInFlight = false;
        this._activeTableCatchUpQueued = false;
        /** Toplu yapıştırma bittikten sonra kısa catch-up susturma (sayı zıplamasını önler) */
        this._suppressCatchUpUntil = 0;
        /** Silinen tablolar — DB temizlenene kadar listeden gizlenir */
        this._deletedTableTombstones = new Set();
        this._metaSaveTimer = null;
        this._countingHydratedFromLocal = false;
        /** Per-product debounce timers: { productId: timeoutId } */
        this._productSaveTimers = {};
        /** counting_items tablosu mevcut mu? (yoksa eski blob yoluna düş) */
        this._countingItemsTableReady = null; // null=bilinmiyor, true/false
        /** counting_items struck_price kolonları (migration sonrası true) */
        this._countingItemsPriceExtension = null;
        /** Desktop tablo görünümü pasif — yalnızca grid render */
        this._desktopTableModeDisabled = true;
        /** Finans grafik / ürün performans / kategori analizi pasif (kod durur, UI gizli) */
        this._financeVisualAnalyticsDisabled = true;
        /** Sayım tablosu anlık filtre (ürün silmez, yalnızca görünüm + sıradaki/önceki kapsamı) */
        this._tableProductSearchQuery = '';
        this._tableProductSearchTimer = null;
        /** Son Getir yapıştırmada eşleşmeyen görsel URL'leri */
        this._lastUnmatchedGetirUrls = [];
        this._unmatchedGetirModalIndex = 0;
        /** Ürün detay paneli — gizli alan tercihleri (localStorage) */
        this._productDetailHiddenFields = this._loadProductDetailHiddenFields();
        /** Ürün detay — SKT önbelleği productId → [{ date, qty, removeDate? }] */
        this._productDetailExpiryCache = new Map();
        /** Stok API yanıtı önbelleği — detay paneli için */
        this._apiProductRowCache = new Map();
        /** Ürün detay paneli veri yükleme durumu */
        this._productDetailLoading = false;
        this._productDetailExpiryErrors = new Map();
        this._productDetailExpiryFetched = new Set();
        /** Ürün detay — SKT tarih kontrolü productId → YYYY-MM-DD */
        this._productDetailSktCheckDates = new Map();
        /** Açık mini takvim productId set */
        this._productDetailSktCalOpen = new Set();
        /** Mini takvim görünen ay productId → { year, month } */
        this._productDetailSktCalMonth = new Map();
    }

    _applyFinanceVisualAnalyticsVisibility() {
        const hidden = this._financeVisualAnalyticsDisabled === true;
        ['financialChartsSection', 'financialProductPerformanceSection', 'financialCategoryAnalysisSection'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', hidden);
        });
    }

    _hideInitSkeleton() {
        if (window.SkeletonUI) {
            window.SkeletonUI.leaveMany([
                'sayimActiveTableHost',
                'sayimGeneralListHost',
                'countingStatsHost',
                'countingMainDataHost',
            ]);
        }
    }

    _showInitSkeleton() {
        if (window.SkeletonUI) {
            window.SkeletonUI.enterMany([
                'sayimActiveTableHost',
                'sayimGeneralListHost',
                'countingStatsHost',
                'countingMainDataHost',
            ]);
        }
    }

    async init() {
        try {
            const session = window.authUtils?.checkAuth();
            if (!session) {
                throw new Error('User not authenticated');
            }
            this.currentUser = session;

            this._showInitSkeleton();

            const hadLocalCache = this._hydrateFromLocalStorageOnly();

            this.setupEventListeners();
            this.bindCountingTableSearch();
            this.bindSayimSubTabControls();
            this.bindSayimTableCardMenu();
            this.bindSayimGeneralTableDropdown();
            this.bindSayimGeneralTableScrollRestore();
            this.initDailyDateControls();
            this.setupTabSystem();
            this._applyFinanceVisualAnalyticsVisibility();
            this.bindSayimAuditLogPanel();

            this.currentViewMode = 'rapid';
            this.currentTab = 'sayim';

            if (hadLocalCache) {
                this.renderTable();
                this.updateStatistics();
                this.updateTableSelector();
                this.updateViewMode();
            }

            await Promise.all([this.loadProducts(), this.loadCountingData()]);

            this.renderTable();
            this.updateViewMode();
            this.updateStatistics();
            this.updateTableSelector();
            this.syncSayimSubTabToTable();
            this.scheduleScrollActiveGeneralTableChip();
            this.syncDeleteTableButtonsVisibility();
            this._hideInitSkeleton();
            
            // Setup scroll listener for toast positioning
            this.setupToastScrollListener();
            
            // Check and save API info from extension to Supabase on page load
            this.checkAndSaveAPIInfoFromExtension();
            
            // Update API status card (with delay to ensure data is loaded)
            setTimeout(() => {
                this.updateAPIStatusCard();
            }, 500);
            
            // Set up periodic API status updates (every 30 seconds)
            setInterval(() => {
                this.updateAPIStatusCard();
            }, 30000);
            
            // Refresh token button event listener
            const refreshTokenBtn = document.getElementById('refreshTokenBtn');
            if (refreshTokenBtn) {
                refreshTokenBtn.addEventListener('click', () => {
                    this.checkAndSaveAPIInfoFromExtension();
                    setTimeout(() => this.updateAPIStatusCard(), 1000);
                });
            }

            const manualTokenSaveBtn = document.getElementById('manualTokenSaveBtn');
            const manualTokenClearBtn = document.getElementById('manualTokenClearBtn');
            const manualTokenInput = document.getElementById('manualTokenInput');
            if (manualTokenSaveBtn) {
                manualTokenSaveBtn.addEventListener('click', () => this.applyManualTokenFromInput());
            }
            if (manualTokenClearBtn && manualTokenInput) {
                manualTokenClearBtn.addEventListener('click', () => {
                    manualTokenInput.value = '';
                    this.updateManualTokenPreview();
                });
            }
            if (manualTokenInput) {
                manualTokenInput.addEventListener('input', () => this.updateManualTokenPreview());
            }
            
            // Realtime listener: başka cihazdan gelen sayım değişikliklerini cache'e merge et
            this._setupRealtimeSync();

            // Sayfa görünür olunca aktif tabloyu hafif catch-up (realtime kaçırılan güncellemeler için)
            this._setupVisibilityRefresh();

            // İlk açılışta tekrar tam DB çekme yok — loadCountingData + realtime yeterli

            // beforeunload: pending save'leri flush et (localStorage'a en azından yaz)
            window.addEventListener('beforeunload', () => {
                // Per-product timer'ları temizle
                for (const [pId, timer] of Object.entries(this._productSaveTimers || {})) {
                    clearTimeout(timer);
                }
                this._productSaveTimers = {};
                if (this._saveDebounceTimer) {
                    clearTimeout(this._saveDebounceTimer);
                    this._saveDebounceTimer = null;
                }
                try {
                    if (this.cachedFullData && this.currentUser) {
                        const key = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                        localStorage.setItem(key, JSON.stringify(this._buildMetaBlob()));
                    }
                } catch (e) { /* ignore */ }
            });

            console.log('✅ Counting system initialized');
        } catch (error) {
            console.error('Error initializing counting system:', error);
            this._hideInitSkeleton();
        }
    }
    
    // Check and save API info from extension to Supabase
    // Öncelik: Supabase (okuma). Supabase süresi az/bitmişse eklentiden çek, Supabase'e yaz.
    // Her zaman eklentiden en güncel token'ı alıp Supabase'e yazarız (böylece Supabase hep en uzun süreli token'a sahip olur).
    async checkAndSaveAPIInfoFromExtension() {
        try {
            if (!window.supabase || !this.currentUser) {
                return;
            }
            
            // 1) Önce Supabase'deki mevcut durumu al (manuel token dahil)
            let existingToken = null;
            let existingTimestamp = 0;
            let existingExpiry = null;
            let existingApiInfo = null;
            if (window.supabase && this.currentUser) {
                try {
                    const { data: userData } = await window.supabase
                        .from('users')
                        .select('counting_data')
                        .eq('username', this.currentUser.username)
                        .maybeSingle();
                    if (userData && userData.counting_data) {
                        const countingData = typeof userData.counting_data === 'string'
                            ? JSON.parse(userData.counting_data)
                            : userData.counting_data;
                        existingApiInfo = countingData._api_info || null;
                        existingToken = countingData._api_info?.token;
                        existingTimestamp = countingData._api_info?.timestamp || 0;
                        existingExpiry = countingData._api_info?.tokenExpiry;
                    }
                } catch (e) {
                    // Silent
                }
            }
            
            // 2) Eklentiden token al. getirExtensionHelper content script ile gelir; bazen gecikmeli yüklenir.
            let apiInfo = null;
            if (window.getirExtensionHelper && window.getirExtensionHelper.getAPIInfo) {
                try {
                    apiInfo = await window.getirExtensionHelper.getAPIInfo();
                    if (apiInfo && apiInfo.token) {
                        console.log('🔑 Eklentiden franchise token alındı', { tokenLength: apiInfo.token?.length, tokenExpiry: apiInfo.tokenExpiry });
                    }
                } catch (err) {
                    console.warn('⚠️ getirExtensionHelper.getAPIInfo hatası:', err?.message || err);
                }
            } else {
                // Content script henüz yüklenmemiş olabilir; bir kez gecikmeli tekrar dene (site "göremiyor" sorunu)
                if (!this._extensionRetryDone) {
                    this._extensionRetryDone = true;
                    setTimeout(() => this.checkAndSaveAPIInfoFromExtension(), 800);
                    return;
                }
            }
            
            // chrome (sayfa context'inde yok) varsa ek kaynaklar dene
            if (!apiInfo && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    const extensionId = 'dhgdhdnnpeakmomlgpgmokecmdmeoebn';
                    const response = await new Promise((resolve) => {
                        chrome.runtime.sendMessage(extensionId, { type: 'GET_API_INFO' }, (r) => {
                            if (chrome.runtime.lastError) resolve(null);
                            else resolve(r);
                        });
                    });
                    if (response && response.success && response.apiInfo) apiInfo = response.apiInfo;
                } catch (e) {
                    // Silent
                }
            }
            if (!apiInfo && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                try {
                    apiInfo = await new Promise((resolve) => {
                        chrome.storage.local.get(['getir_api_info'], (result) => {
                            resolve(chrome.runtime.lastError ? null : result?.getir_api_info || null);
                        });
                    });
                } catch (e) {
                    // Silent
                }
            }
            
            if (!apiInfo) {
                try {
                    const raw = localStorage.getItem('getir_api_info');
                    if (raw) apiInfo = JSON.parse(raw);
                } catch (e) {
                    // Silent
                }
            }
            
            // 3) Eklenti + Supabase: en geç bitecek token kazanır (ör. manuel 2 saat, eklenti 19 saat → 19 saat)
            if (apiInfo && apiInfo.token) {
                const prevCandidate = existingApiInfo && existingToken
                    ? { ...existingApiInfo, token: existingToken, tokenExpiry: existingExpiry }
                    : existingToken
                        ? { token: existingToken, tokenExpiry: existingExpiry, timestamp: existingTimestamp }
                        : null;
                const best = this.pickBestApiInfo([prevCandidate, apiInfo].filter(Boolean));
                if (best && best.token) {
                    const merged = this.mergeApiInfoForSave(best, prevCandidate || {});
                    if (this.apiInfoSignature(merged) !== this.apiInfoSignature(prevCandidate)) {
                        await this.saveAPIInfoToSupabase(merged);
                        if (merged.tokenExpiry) this.lastTokenExpiry = merged.tokenExpiry;
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ API bilgileri kontrol edilemedi:', error);
        }
    }

    // tokenExpiry (number | string) -> timestamp (ms)
    normalizeExpiry(tokenExpiry) {
        if (!tokenExpiry) return 0;
        if (typeof tokenExpiry === 'number') return tokenExpiry;
        if (typeof tokenExpiry === 'string') {
            const t = new Date(tokenExpiry).getTime();
            if (!isNaN(t)) return t;
            const p = parseInt(tokenExpiry, 10);
            return isNaN(p) ? 0 : p;
        }
        return 0;
    }

    /** JWT payload `exp` (saniye) -> ms */
    parseJwtExpiryMsFromToken(tokenString) {
        if (!tokenString || typeof tokenString !== 'string') return null;
        try {
            const bare = tokenString.replace(/^Bearer\s+/i, '').trim();
            const parts = bare.split('.');
            if (parts.length !== 3) return null;
            const payload = parts[1];
            const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
            const decoded = JSON.parse(atob(padded));
            if (decoded.exp) {
                return decoded.exp * 1000;
            }
        } catch (e) {
            /* geçersiz JWT */
        }
        return null;
    }

    /** tokenExpiry alanı veya JWT exp — en geç bitiş (ms) */
    getEffectiveExpiryMs(apiInfo) {
        if (!apiInfo || !apiInfo.token) return null;
        let fromField = 0;
        if (apiInfo.tokenExpiry) {
            fromField = this.normalizeExpiry(apiInfo.tokenExpiry);
        }
        const fromJwt = this.parseJwtExpiryMsFromToken(apiInfo.token);
        const mx = Math.max(fromField || 0, fromJwt || 0);
        return mx > 0 ? mx : null;
    }

    /**
     * Birden fazla kaynak arasında en geç bitecek token'ı seçer (manuel / Supabase / eklenti).
     * Aynı bitişte: daha yeni timestamp öncelikli.
     */
    pickBestApiInfo(candidates) {
        const valid = (candidates || []).filter((c) => c && c.token && String(c.token).trim());
        if (valid.length === 0) return null;
        return valid.reduce((best, cur) => {
            const expB = this.getEffectiveExpiryMs(best) || 0;
            const expC = this.getEffectiveExpiryMs(cur) || 0;
            if (expC > expB) return cur;
            if (expC < expB) return best;
            const tsB = best.timestamp || 0;
            const tsC = cur.timestamp || 0;
            return tsC >= tsB ? cur : best;
        });
    }

    mergeApiInfoForSave(winner, prev) {
        if (!winner) return prev;
        const bare = String(winner.token).replace(/^Bearer\s+/i, '').trim();
        const token = bare ? `Bearer ${bare}` : winner.token;
        const jwtExp = this.parseJwtExpiryMsFromToken(winner.token);
        let tokenExpiry = winner.tokenExpiry || jwtExp || prev?.tokenExpiry;
        if (tokenExpiry) {
            const n = this.normalizeExpiry(tokenExpiry);
            if (n) tokenExpiry = n;
        } else if (jwtExp) {
            tokenExpiry = jwtExp;
        }
        return {
            token,
            warehouseId: winner.warehouseId || prev?.warehouseId,
            warehouseName: winner.warehouseName || prev?.warehouseName,
            tokenExpiry: tokenExpiry || null,
            baseUrl: winner.baseUrl || prev?.baseUrl || 'https://franchise-api-gateway.getirapi.com',
            stockEndpoint: winner.stockEndpoint || prev?.stockEndpoint || 'https://franchise-api-gateway.getirapi.com/stocks',
            timestamp: winner.timestamp || Date.now()
        };
    }

    apiInfoSignature(info) {
        if (!info || !info.token) return '';
        const exp = this.getEffectiveExpiryMs(info) || 0;
        const tok = String(info.token).replace(/^Bearer\s+/i, '').trim().slice(0, 48);
        return `${tok}|${exp}`;
    }

    /**
     * Tam blob yazımından önce _api_info'yu korur: Supabase + yerel cache arasında en uzun süreli token kazanır.
     */
    async _protectApiInfoInFullBlob(fullData) {
        if (!fullData || typeof fullData !== 'object') return fullData;
        const remote = await this.fetchSupabaseApiInfo();
        const local = fullData._api_info || this.cachedFullData?._api_info || null;
        const best = this.pickBestApiInfo([remote, local].filter(Boolean));
        if (best && best.token) {
            const merged = this.mergeApiInfoForSave(best, remote || local || {});
            fullData._api_info = merged;
            if (this.cachedFullData) this.cachedFullData._api_info = merged;
        }
        return fullData;
    }

    /** Gelen aday ile Supabase/cache birleştir — yalnızca en uzun süreli token yazılır */
    _resolveBestApiInfoForSave(incoming, existingCandidates = []) {
        if (!incoming || !incoming.token) return null;
        const candidates = [...existingCandidates, incoming].filter((c) => c && c.token);
        const best = this.pickBestApiInfo(candidates);
        if (!best || !best.token) return null;
        const prev = this.pickBestApiInfo(existingCandidates.filter(Boolean)) || {};
        return this.mergeApiInfoForSave(best, prev);
    }

    async fetchSupabaseApiInfo() {
        if (!window.supabase || !this.currentUser) return null;
        try {
            const { data: userData } = await window.supabase
                .from('users')
                .select('counting_data')
                .eq('username', this.currentUser.username)
                .maybeSingle();
            if (userData && userData.counting_data) {
                const countingData =
                    typeof userData.counting_data === 'string'
                        ? JSON.parse(userData.counting_data)
                        : userData.counting_data;
                return countingData._api_info || null;
            }
        } catch (e) {
            /* ignore */
        }
        return null;
    }

    async fetchExtensionApiInfo() {
        let extensionApiInfo = null;
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                const extensionId =
                    window.getirExtensionHelper?.extensionId || 'dhgdhdnnpeakmomlgpgmokecmdmeoebn';
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage(
                        extensionId,
                        { type: 'GET_API_INFO' },
                        (response) => {
                            if (chrome.runtime.lastError) resolve(null);
                            else resolve(response);
                        }
                    );
                });
                if (response && response.success && response.apiInfo) {
                    extensionApiInfo = response.apiInfo;
                }
            } catch (error) {
                /* ignore */
            }
        }
        if (!extensionApiInfo && typeof window !== 'undefined' && window.getirExtensionHelper) {
            try {
                extensionApiInfo = await window.getirExtensionHelper.getAPIInfo();
            } catch (error) {
                /* ignore */
            }
        }
        if (!extensionApiInfo) {
            const apiInfoStr = localStorage.getItem('getir_api_info');
            if (apiInfoStr) {
                try {
                    extensionApiInfo = JSON.parse(apiInfoStr);
                } catch (e) {
                    /* ignore */
                }
            }
        }
        return extensionApiInfo && extensionApiInfo.token ? extensionApiInfo : null;
    }

    updateManualTokenPreview() {
        const input = document.getElementById('manualTokenInput');
        const preview = document.getElementById('manualTokenPreview');
        if (!input || !preview) return;
        const raw = input.value.trim();
        if (!raw) {
            preview.textContent = '';
            return;
        }
        const exp = this.parseJwtExpiryMsFromToken(raw);
        if (exp) {
            preview.textContent = `JWT bitiş: ${new Date(exp).toLocaleString('tr-TR')}`;
        } else {
            preview.textContent =
                'JWT algılanamadı; yine de kaydedebilirsiniz (varsa mevcut süre alanı kullanılır).';
        }
    }

    async applyManualTokenFromInput() {
        const input = document.getElementById('manualTokenInput');
        const raw = input?.value?.trim();
        if (!raw) {
            this.showToast('Token girin', 'warning', 3000);
            return;
        }
        if (!window.supabase || !this.currentUser) {
            this.showToast('Oturum gerekli', 'error', 3000);
            return;
        }
        const bearer = raw.startsWith('Bearer ') ? raw.trim() : `Bearer ${raw.trim()}`;
        const jwtExp = this.parseJwtExpiryMsFromToken(raw);
        const manualCandidate = {
            token: bearer,
            tokenExpiry: jwtExp || null,
            timestamp: Date.now()
        };
        const supabaseSnap = await this.fetchSupabaseApiInfo();
        const extensionApiInfo = await this.fetchExtensionApiInfo();
        const best = this.pickBestApiInfo(
            [supabaseSnap, extensionApiInfo, manualCandidate].filter(Boolean)
        );
        if (!best || !best.token) {
            this.showToast('Geçerli token oluşturulamadı', 'error', 3000);
            return;
        }
        const merged = this.mergeApiInfoForSave(best, supabaseSnap || {});
        await this.saveAPIInfoToSupabase(merged);
        if (input) input.value = '';
        const pv = document.getElementById('manualTokenPreview');
        if (pv) pv.textContent = '';
        await this.updateAPIStatusCard();
        this.showToast('Token kaydedildi (en uzun süreli seçildi)', 'success', 3500);
    }

    async loadProducts() {
        try {
            if (window.userDataManager) {
                this.allProducts = window.userDataManager.getAllProducts(true) || [];
            } else if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA.products) {
                this.allProducts = PRODUCTS_DATA.products || [];
            }
            this.productIndex = new Map(this.allProducts.map(p => [p.id, p]));
            const G = typeof window !== 'undefined' ? window.GetirCdnPaste : null;
            this._getirImageIndex =
                G && typeof G.getOrBuildGetirImageProductIndex === 'function'
                    ? G.getOrBuildGetirImageProductIndex(this.allProducts)
                    : null;
            console.log(`📦 Loaded ${this.allProducts.length} products`);
        } catch (error) {
            console.error('Error loading products:', error);
            this.allProducts = [];
            this.productIndex = new Map();
        }
    }

    async loadFullCountingData() {
        try {
            if (this.cachedFullData) return this.cachedFullData;

            let fullData = null;
            
            if (window.supabase && this.currentUser) {
                const { data, error } = await window.supabase
                    .from('users')
                    .select('counting_data')
                    .eq('username', this.currentUser.username)
                    .maybeSingle();

                if (!error && data && data.counting_data) {
                    fullData = data.counting_data;
                }
            }

            if (!fullData) {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser?.username || 'default'}`;
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    fullData = JSON.parse(stored);
                }
            }
                
            if (fullData) {
                fullData = this.migrateToNestedStructure(fullData);
            } else {
                fullData = {
                    _api_info: {},
                    _tables: { 'Ana Sayım': {} },
                };
            }

            this.cachedFullData = fullData;
            return fullData;
        } catch (error) {
            console.error('Error loading full counting data:', error);
            const fallback = {
                _api_info: {},
                _tables: { 'Ana Sayım': {} },
            };
            this.cachedFullData = fallback;
            return fallback;
        }
    }

    _hydrateFromLocalStorageOnly() {
        if (!this.currentUser) return false;
        try {
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            const stored = localStorage.getItem(storageKey);
            if (!stored) return false;
            const localFull = JSON.parse(stored);
            const metaBlob = this.migrateToNestedStructure(localFull);
            if (!localFull?._tables || Object.keys(localFull._tables).length === 0) return false;

            const tables = {};
            for (const [tName, tData] of Object.entries(localFull._tables)) {
                if (this._isTableTombstoned(tName)) continue;
                tables[tName] = this._cloneTableDataSlot(tData);
            }
            const fullData = {
                _api_info: localFull._api_info || {},
                _auditLog: localFull._auditLog || [],
                _tableMeta: localFull._tableMeta || metaBlob?._tableMeta || {},
                _currentTable: localFull._currentTable || metaBlob?._currentTable || null,
                _tables: tables,
            };
            this._finalizeCountingHydration(fullData, tables);
            this._countingHydratedFromLocal = true;
            return true;
        } catch (e) {
            return false;
        }
    }

    async loadCountingData() {
        try {
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            let metaBlob = null;
            let localFull = null;

            try {
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    localFull = JSON.parse(stored);
                    metaBlob = this.migrateToNestedStructure(localFull);
                    if (localFull?._tables && Object.keys(localFull._tables).length > 0) {
                        const tables = { ...localFull._tables };
                        const fullData = {
                            _api_info: localFull._api_info || {},
                            _auditLog: localFull._auditLog || [],
                            _tableMeta: localFull._tableMeta || {},
                            _currentTable: localFull._currentTable || metaBlob?._currentTable || null,
                            _tables: tables,
                        };
                        this._finalizeCountingHydration(fullData, tables);
                        this._countingHydratedFromLocal = true;
                    }
                }
            } catch (e) {
                /* ignore */
            }

            let itemRows = null;
            let countingItemsAvailable = false;

            if (window.supabase && this.currentUser) {
                if ((this._statusDepth || 0) > 0) {
                    this.updateCountingStatus('Sunucuya bağlanılıyor…', 'Güncel veriler alınıyor', { lock: true });
                }
                const deviceTableForFetch = this._loadDeviceCurrentTable();
                const serverTableForFetch = metaBlob?._currentTable || localFull?._currentTable;
                const resolvedForFetch =
                    serverTableForFetch ||
                    deviceTableForFetch ||
                    'Ana Sayım';

                const [userRes, itemsRes] = await Promise.all([
                    window.supabase
                        .from('users')
                        .select('counting_data')
                        .eq('username', this.currentUser.username)
                        .maybeSingle(),
                    this._queryCountingItems(this._getCountingItemsSelectColumns(true), (q) =>
                        q.eq('username', this.currentUser.username).eq('table_name', resolvedForFetch)
                    ),
                ]);

                if (!userRes.error && userRes.data?.counting_data) {
                    metaBlob = this.migrateToNestedStructure(userRes.data.counting_data);
                }

                if (!itemsRes.error) {
                    itemRows = itemsRes.data || [];
                    countingItemsAvailable = true;
                    this._countingItemsTableReady = true;
                } else {
                    this._countingItemsTableReady = false;
                }
            }

            if (!metaBlob && localFull) {
                metaBlob = this.migrateToNestedStructure(localFull);
            }

            const deviceTable = this._loadDeviceCurrentTable();
            const serverTable = metaBlob?._currentTable;
            const resolvedTable = serverTable || deviceTable || 'Ana Sayım';

            const tables = {};
            if (this.cachedFullData?._tables) {
                for (const [tName, tData] of Object.entries(this.cachedFullData._tables)) {
                    if (this._isTableTombstoned(tName)) continue;
                    tables[tName] = this._cloneTableDataSlot(tData);
                }
            }

            if (countingItemsAvailable) {
                tables[resolvedTable] = tables[resolvedTable] || {};
                for (const row of itemRows) {
                    const rowTable = row.table_name || resolvedTable;
                    if (!tables[rowTable]) tables[rowTable] = {};
                    tables[rowTable][row.product_id] = this._mapCountingItemRowToEntry(row);
                }

                const tableMeta = metaBlob?._tableMeta || {};
                for (const [tName, meta] of Object.entries(tableMeta)) {
                    if (this._isTableTombstoned(tName)) continue;
                    if (!tables[tName]) tables[tName] = {};
                    if (meta.createdAt || meta.lastActivityAt) {
                        if (!tables[tName]._tableMeta) tables[tName]._tableMeta = {};
                        if (meta.createdAt) tables[tName]._tableMeta.createdAt = meta.createdAt;
                        if (meta.lastActivityAt) tables[tName]._tableMeta.lastActivityAt = meta.lastActivityAt;
                    }
                    if (Array.isArray(meta._productOrder)) {
                        tables[tName]._productOrder = meta._productOrder;
                    }
                }

                if (metaBlob?._tables) {
                    for (const [tName, tData] of Object.entries(metaBlob._tables)) {
                        if (this._isTableTombstoned(tName)) continue;
                        if (!tables[tName]) tables[tName] = {};
                        for (const [pId, pData] of Object.entries(tData)) {
                            if (this.isReservedCountingKey(pId) || typeof pData !== 'object' || !pData) continue;
                            if (this._looksLikeNestedTableBlob(pData)) continue;
                            if (!tables[tName][pId]) {
                                tables[tName][pId] = { ...pData };
                            } else {
                                if (pData.struckPrice != null && tables[tName][pId].struckPrice == null) {
                                    tables[tName][pId].struckPrice = pData.struckPrice;
                                }
                                if (pData.struckPriceText != null && tables[tName][pId].struckPriceText == null) {
                                    tables[tName][pId].struckPriceText = pData.struckPriceText;
                                }
                            }
                        }
                        if (!tables[tName]._tableMeta && tData._tableMeta) {
                            tables[tName]._tableMeta = tData._tableMeta;
                        }
                        if (!tables[tName]._productOrder && Array.isArray(tData._productOrder)) {
                            tables[tName]._productOrder = [...tData._productOrder];
                        }
                    }
                }

                if (itemRows.length === 0 && metaBlob?._tables) {
                    this._migrateOldDataToCountingItems(metaBlob).catch(() => {});
                }
            } else if (metaBlob?._tables && Object.keys(metaBlob._tables).length > 0) {
                for (const [tName, tData] of Object.entries(metaBlob._tables)) {
                    if (this._isTableTombstoned(tName)) continue;
                    tables[tName] = { ...tData };
                }
            } else if (metaBlob?._tableMeta) {
                for (const [tName, meta] of Object.entries(metaBlob._tableMeta)) {
                    if (this._isTableTombstoned(tName)) continue;
                    if (!tables[tName]) {
                        tables[tName] = {};
                        if (meta?.createdAt || meta?.lastActivityAt) {
                            tables[tName]._tableMeta = {};
                            if (meta?.createdAt) tables[tName]._tableMeta.createdAt = meta.createdAt;
                            if (meta?.lastActivityAt) tables[tName]._tableMeta.lastActivityAt = meta.lastActivityAt;
                        }
                        if (Array.isArray(meta?._productOrder)) tables[tName]._productOrder = meta._productOrder;
                    }
                }
            }

            const fullData = {
                _api_info: metaBlob?._api_info || this.cachedFullData?._api_info || {},
                _auditLog: metaBlob?._auditLog || this.cachedFullData?._auditLog || [],
                _tableMeta: metaBlob?._tableMeta || this.cachedFullData?._tableMeta || {},
                _currentTable: metaBlob?._currentTable || this.cachedFullData?._currentTable || null,
                _tables: tables,
            };

            this._finalizeCountingHydration(fullData, tables);
            this._saveFullBlobToLocalStorage();

            console.log('✅ loadCountingData tamamlandı, tablo:', this.currentTableName);
            void this._warmCountingTablesInBackground();
        } catch (error) {
            console.error('Error loading counting data:', error);
            this.currentTableName = 'Ana Sayım';
            this.countingData = {};
            this.auditLog = [];
        }
    }

    /**
     * Eski users.counting_data._tables içindeki ürünleri counting_items tablosuna taşır.
     * Tek seferlik — counting_items henüz boşken çalışır.
     */
    async _migrateOldDataToCountingItems(metaBlob) {
        if (!window.supabase || !this.currentUser || !metaBlob?._tables) return;
        const rows = [];
        for (const [tName, tData] of Object.entries(metaBlob._tables)) {
            for (const [pId, pData] of Object.entries(tData)) {
                if (this.isReservedCountingKey(pId) || typeof pData !== 'object' || !pData) continue;
                rows.push({
                    username: this.currentUser.username,
                    table_name: tName,
                    product_id: pId,
                    warehouse_stock: pData.warehouseStock ?? null,
                    system_stock: pData.systemStock ?? null,
                    price: pData.price ?? null,
                    price_text: pData.priceText ?? null,
                    struck_price: pData.struckPrice ?? null,
                    struck_price_text: pData.struckPriceText ?? null,
                    no_struck_price: pData._apiNoStruckPrice === true,
                    reserved_stock: pData.reservedStock ?? null,
                    history: pData.history || [],
                    api_fetch_failed: pData.apiFetchFailed || false,
                    last_updated: pData.lastUpdated || new Date().toISOString(),
                });
            }
        }
        if (rows.length === 0) return;
        // Toplu upsert (50'şer chunk)
        const CHUNK = 50;
        for (let i = 0; i < rows.length; i += CHUNK) {
            const slice = rows.slice(i, i + CHUNK);
            let { error } = await window.supabase.from('counting_items').upsert(slice, {
                onConflict: 'username,table_name,product_id',
            });
            if (error && this._isMissingDbColumnError(error) && this._countingItemsPriceExtension !== false) {
                this._countingItemsPriceExtension = false;
                const fallbackSlice = slice.map(({ struck_price, struck_price_text, no_struck_price, ...rest }) => rest);
                ({ error } = await window.supabase.from('counting_items').upsert(fallbackSlice, {
                    onConflict: 'username,table_name,product_id',
                }));
            } else if (!error) {
                this._countingItemsPriceExtension = true;
            }
            if (error) console.warn('Migration chunk hatası:', error.message);
        }
        console.log(`🔄 Migration tamamlandı: ${rows.length} ürün counting_items'a taşındı`);
    }

    // Migrate old structure to new nested structure
    migrateToNestedStructure(data) {
        if (!data || typeof data !== 'object') {
            return { _api_info: {}, _tables: {}, _currentTable: 'Ana Sayım' };
        }

        let migrated = data;

        // Zaten yeni yapıda (_tables mevcut)
        if (!data._tables) {
            // Yeni meta-only format: _tableMeta var ama _tables yok
            if (data._tableMeta && !data._tables) {
                migrated = { ...data, _tables: {} };
            } else {
                // Eski format: ürün ID'leri doğrudan üst düzeyde
                migrated = {
                    _api_info: data._api_info || {},
                    _tables: {},
                    _currentTable: 'Ana Sayım',
                };

                if (data._auditLog && Array.isArray(data._auditLog)) {
                    migrated._auditLog = data._auditLog;
                }

                const RESERVED = new Set(['_api_info', '_tables', '_currentTable', '_auditLog', '_tableMeta']);
                const defaultTable = {};
                for (const key in data) {
                    if (!RESERVED.has(key)) {
                        defaultTable[key] = data[key];
                    }
                }
                migrated._tables['Ana Sayım'] = defaultTable;
            }
        }

        return this.sanitizeTablesStructure(migrated);
    }

    // Save full counting data structure (including all tables)
    // Her zaman tam blob yazar — counting_items gerçek zamanlı sync için,
    // users.counting_data çapraz-cihaz güvenlik yedeği için.
    // NOT: counting_items INSERT başarısız olsa bile Supabase'de ürünler kaybolmaz.
    async saveFullCountingData(fullData) {
        await this._saveFullBlobLegacy(fullData);
    }

    /** Eski adı _saveMetaOnly olan, artık her zaman TAM blob yazan alias.
     *  Kritik: meta-only yazım veri kaybına neden oluyordu (users.counting_data._tables siliniyordu).
     *  Artık bu çağrı her durumda `_saveFullBlobLegacy`'ya yönlendiriliyor. */
    async _saveMetaOnly() {
        if (!this.currentUser) return;
        await this._saveFullBlobLegacy(this.cachedFullData || { _api_info: {}, _tables: {} });
    }

    /** Tüm ürünleri localStorage'a yazar — sessiz, hızlı, senkron. */
    _saveFullBlobToLocalStorage() {
        try {
            if (!this.currentUser || !this.cachedFullData) return;
            const fullBlob = this._buildFullBlob();
            const key = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            localStorage.setItem(key, JSON.stringify(fullBlob));
        } catch (e) { /* ignore — storage dolu olabilir */ }
    }

    /** Tüm tablo + ürün verisini içeren tam blob oluşturur (localStorage yedeği için). */
    _buildFullBlob() {
        if (!this.auditLog) this.auditLog = [];
        const tables = { ...(this.cachedFullData?._tables || {}) };
        if (this.currentTableName && this.countingData) {
            this._safeWriteTableSlot(tables, this.currentTableName, this.countingData);
        }
        const tableMeta = {};
        for (const [tName, tData] of Object.entries(tables)) {
            if (!this.isValidTableNameKey(tName)) continue;
            tableMeta[tName] = {
                createdAt: tData._tableMeta?.createdAt || null,
                lastActivityAt: tData._tableMeta?.lastActivityAt || null,
                _productOrder: Array.isArray(tData._productOrder) ? [...tData._productOrder] : [],
            };
        }
        return {
            _api_info: this.cachedFullData?._api_info || {},
            _auditLog: this.auditLog.slice(-this.AUDIT_LOG_MAX),
            _tableMeta: tableMeta,
            _tables: tables,
        };
    }

    /**
     * Periyodik Supabase tam blob yedeği — counting_items başarısız olursa çapraz-cihaz kurtarma için.
     * 3 saniyelik debounce ile yazar (daha hızlı çapraz-cihaz görünürlüğü).
     */
    _scheduleFullBackup() {
        if (this._fullBackupTimer) clearTimeout(this._fullBackupTimer);
        this._fullBackupTimer = setTimeout(() => {
            this._fullBackupTimer = null;
            this._writeFullBlobToSupabase().catch(() => {});
        }, 1200);
    }

    async _writeFullBlobToSupabase() {
        if (!window.supabase || !this.currentUser) return;
        try {
            const payload =
                this._countingItemsTableReady === true ? this._buildMetaBlob() : this._buildFullBlob();
            await this._protectApiInfoInFullBlob(payload);
            payload._writerDeviceId = this.deviceId;
            payload._writerAt = Date.now();
            await window.supabase
                .from('users')
                .update({ counting_data: payload })
                .eq('username', this.currentUser.username);
        } catch (e) { /* ignore */ }
    }

    /** Tüm tablolardan meta bilgisini (createdAt, _productOrder) çıkarır */
    _buildMetaBlob() {
        if (!this.auditLog) this.auditLog = [];
        if (this.currentTableName && this.countingData && this.cachedFullData?._tables) {
            this._safeWriteTableSlot(this.cachedFullData._tables, this.currentTableName, this.countingData);
        }
        const tableMeta = {};
        const tables = this.cachedFullData?._tables || {};
        for (const [tName, tData] of Object.entries(tables)) {
            tableMeta[tName] = {
                createdAt: tData._tableMeta?.createdAt || null,
                lastActivityAt: tData._tableMeta?.lastActivityAt || null,
                _productOrder: Array.isArray(tData._productOrder) ? [...tData._productOrder] : [],
            };
        }
        return {
            _api_info: this.cachedFullData?._api_info || {},
            _auditLog: this.auditLog.slice(-this.AUDIT_LOG_MAX),
            _tableMeta: tableMeta,
            _currentTable: this.currentTableName || null,
            _currentTableAt: Date.now(),
        };
    }

    /** Tam blobu Supabase + localStorage'a yazar. */
    async _saveFullBlobLegacy(fullData) {
        try {
            if (!fullData._tables) fullData._tables = {};
            this._safeWriteTableSlot(fullData._tables, this.currentTableName, this.countingData);
            if (!this.auditLog) this.auditLog = [];
            fullData._auditLog = this.auditLog.slice(-this.AUDIT_LOG_MAX);
            this.sanitizeTablesStructure(fullData);
            await this._protectApiInfoInFullBlob(fullData);
            fullData._writerDeviceId = this.deviceId;
            fullData._writerAt = Date.now();
            this.cachedFullData = fullData;

            if (window.supabase && this.currentUser) {
                const remotePayload =
                    this._countingItemsTableReady === true ? this._buildMetaBlob() : fullData;
                await this._protectApiInfoInFullBlob(remotePayload);
                remotePayload._writerDeviceId = this.deviceId;
                remotePayload._writerAt = Date.now();
                const { error } = await window.supabase
                    .from('users')
                    .update({ counting_data: remotePayload })
                    .eq('username', this.currentUser.username);
                if (error) throw error;
            }
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            localStorage.setItem(storageKey, JSON.stringify(fullData));
        } catch (error) {
            console.error('Error saving full blob (legacy):', error);
            try {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                localStorage.setItem(storageKey, JSON.stringify(fullData));
            } catch (e) { /* ignore */ }
        }
    }

    pushAuditEntry(message, meta = {}) {
        if (!message || !this.currentUser) return;
        if (!this.auditLog) this.auditLog = [];
        const m = String(message).slice(0, 900);
        const cat = meta.cat || this.inferAuditCategoryFromMessage(m);
        const tbl =
            meta.tbl !== undefined && meta.tbl !== null
                ? String(meta.tbl).slice(0, 120)
                : this.currentTableName || '';
        const row = { t: Date.now(), m, cat, tbl };
        if (meta.productId != null && meta.productId !== '') row.productId = meta.productId;
        if (meta.productName != null && String(meta.productName).trim() !== '') {
            row.productName = String(meta.productName).trim().slice(0, 400);
        }
        if (meta.productImage != null && String(meta.productImage).trim() !== '') {
            row.productImage = String(meta.productImage).trim().slice(0, 800);
        }
        this.auditLog.push(row);
        while (this.auditLog.length > this.AUDIT_LOG_MAX) this.auditLog.shift();
        const overlay = document.getElementById('sayimAuditLogOverlay');
        const body = document.getElementById('sayimAuditLogBody');
        if (overlay && body && !overlay.classList.contains('hidden')) {
            this.renderSayimAuditLogPanel();
        }
    }

    /** Eski {t,m} kayıtları ve meta eksik girdiler için */
    normalizeAuditEntry(raw) {
        if (typeof raw === 'string') {
            const m = String(raw);
            return {
                t: Date.now(),
                m,
                cat: this.inferAuditCategoryFromMessage(m),
                tbl: this.inferAuditTableFromMessage(m),
            };
        }
        const t = raw && raw.t != null ? Number(raw.t) : Date.now();
        const m = raw && raw.m != null ? String(raw.m) : '';
        let cat = (raw && raw.cat) || this.inferAuditCategoryFromMessage(m);
        if (cat === 'product') {
            if (/^Ürün eklendi/i.test(m)) cat = 'product_new';
            else if (/^Listeden çıkarıldı/i.test(m)) cat = 'product_removed';
            else if (/^Ürün silindi/i.test(m)) cat = 'product_deleted';
        }
        let tbl = raw && raw.tbl != null ? String(raw.tbl) : '';
        if (!tbl) tbl = this.inferAuditTableFromMessage(m);
        const out = { t, m, cat, tbl };
        if (raw && raw.productId != null && raw.productId !== '') out.productId = raw.productId;
        if (raw && raw.productName != null && String(raw.productName).trim() !== '') {
            out.productName = String(raw.productName).trim().slice(0, 400);
        }
        if (raw && raw.productImage != null && String(raw.productImage).trim() !== '') {
            out.productImage = String(raw.productImage).trim().slice(0, 800);
        }
        return out;
    }

    inferAuditCategoryFromMessage(m) {
        const s = String(m);
        if (/^Barkod doğrula/i.test(s)) return 'verify';
        if (/^İçe aktarma/i.test(s)) return 'import';
        if (/^Günlük tablo oluşturuldu|^Tablo oluşturuldu|^Tablo silindi|^Tablo yeniden adlandırıldı/i.test(s)) return 'table';
        if (/^📦\s*Depo:|^Sayım güncellendi/i.test(s)) return 'stock';
        if (/Sistem stoku senkron/i.test(s)) return 'sync';
        if (/sıfırlandı/i.test(s)) return 'reset';
        if (/^Ürün silindi/i.test(s)) return 'product_deleted';
        if (/^Listeden çıkarıldı/i.test(s)) return 'product_removed';
        if (/^Ürün eklendi/i.test(s)) return 'product_new';
        return 'other';
    }

    /** Eski kayıtlarda mesajdan tablo adı çıkarmayı dene */
    inferAuditTableFromMessage(m) {
        const s = String(m);
        let x = s.match(/^İçe aktarma · (.+?) ·/);
        if (x) return x[1].trim();
        x = s.match(/^(?:Günlük tablo oluşturuldu|Tablo oluşturuldu|Tablo silindi) · (.+)$/);
        if (x) return x[1].trim();
        return '';
    }

    getAuditCategoryMeta(cat) {
        const map = {
            table: { label: 'Tablo', class: 'bg-indigo-50 text-indigo-800 ring-indigo-200/80' },
            import: { label: 'İçe aktarma', class: 'bg-emerald-50 text-emerald-900 ring-emerald-200/80' },
            product: { label: 'Ürün', class: 'bg-sky-50 text-sky-900 ring-sky-200/80' },
            product_new: {
                label: 'YENİ ÜRÜN',
                class: 'bg-emerald-50 text-emerald-900 ring-emerald-300/90',
            },
            product_removed: {
                label: 'ÜRÜN SİLİNDİ',
                class: 'bg-red-50 text-red-900 ring-red-300/90',
            },
            product_deleted: {
                label: 'ÜRÜN SİLİNDİ',
                class: 'bg-red-50 text-red-900 ring-red-300/90',
            },
            stock: { label: 'Stok', class: 'bg-amber-50 text-amber-900 ring-amber-200/80' },
            sync: { label: 'Senkron', class: 'bg-violet-50 text-violet-900 ring-violet-200/80' },
            reset: { label: 'Sıfırlama', class: 'bg-rose-50 text-rose-900 ring-rose-200/80' },
            verify: { label: 'Barkod doğrula', class: 'bg-teal-50 text-teal-900 ring-teal-200/80' },
            other: { label: 'Diğer', class: 'bg-slate-100 text-slate-700 ring-slate-200/80' },
        };
        return map[cat] || map.other;
    }

    getFilteredAuditEntries() {
        const q = (this._auditUiFilter?.search || '').trim().toLowerCase();
        const ft = this._auditUiFilter?.table || '';
        const fc = this._auditUiFilter?.category || '';
        let list = (Array.isArray(this.auditLog) ? this.auditLog : []).map((r) => this.normalizeAuditEntry(r));
        list.sort((a, b) => b.t - a.t);
        if (fc) {
            if (fc === 'product') {
                list = list.filter((e) =>
                    ['product_new', 'product_removed', 'product_deleted', 'product'].includes(e.cat)
                );
            } else {
                list = list.filter((e) => e.cat === fc);
            }
        }
        if (ft) list = list.filter((e) => e.tbl === ft);
        if (q) {
            list = list.filter((e) => {
                const blob = `${e.m} ${e.tbl} ${e.productName || ''} ${this.getAuditCategoryMeta(e.cat).label}`.toLowerCase();
                return blob.includes(q);
            });
        }
        return list;
    }

    populateAuditLogTableFilterOptions() {
        const sel = document.getElementById('sayimAuditLogFilterTable');
        if (!sel) return;
        const names = new Set();
        try {
            this.getTableList().forEach((row) => {
                if (row && row.name) names.add(row.name);
            });
        } catch {
            /* ignore */
        }
        (this.auditLog || []).forEach((raw) => {
            const e = this.normalizeAuditEntry(raw);
            if (e.tbl) names.add(e.tbl);
        });
        const sorted = Array.from(names).sort((a, b) => String(a).localeCompare(String(b), 'tr'));
        const cur = this._auditUiFilter?.table ?? '';
        sel.innerHTML = '<option value="">Tüm tablolar</option>';
        sorted.forEach((name) => {
            const o = document.createElement('option');
            o.value = name;
            o.textContent = this.formatTableDisplayName(name);
            if (name === cur) o.selected = true;
            sel.appendChild(o);
        });
        sel.value = cur;
    }

    populateAuditLogCategoryFilterOptions() {
        const sel = document.getElementById('sayimAuditLogFilterCat');
        if (!sel) return;
        const cur = this._auditUiFilter?.category ?? '';
        const cats = [
            '',
            'table',
            'import',
            'product_new',
            'product_removed',
            'product_deleted',
            'stock',
            'sync',
            'reset',
            'verify',
            'other',
        ];
        sel.innerHTML = '';
        cats.forEach((c) => {
            const o = document.createElement('option');
            o.value = c;
            o.textContent = c ? this.getAuditCategoryMeta(c).label : 'Tüm işlemler';
            sel.appendChild(o);
        });
        sel.value = cur;
    }

    formatSayimAuditTime(ts) {
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return '—';
        const now = new Date();
        const sameDay =
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();
        if (sameDay) {
            return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    /** Sayım ürün listesinde id eşlemesi (string/number farkını yutar) */
    findProductByIdLoose(productId) {
        if (productId == null || productId === '') return null;
        const sid = String(productId);
        const list = this.allProducts;
        if (!Array.isArray(list)) return null;
        return (
            list.find((x) => x && (String(x.id) === sid || String(x.productId) === sid)) || null
        );
    }

    auditProductLabel(productId) {
        const p = this.findProductByIdLoose(productId);
        return (p && p.name) || String(productId);
    }

    /**
     * Mesajdan «Barkod doğrula · …» parçalarını ayırır (eski: ürün adı ikinci segment; yeni: Ürün:/Okutulan/Durum).
     */
    parseVerifyAuditMessageParts(raw) {
        const m = String(raw || '').trim();
        const parts = m.split(/\s*[\u00B7•]\s*/).map((s) => s.trim());
        if (parts[0] !== 'Barkod doğrula') {
            return { nameFromMessage: null, tailSegments: [], raw: m };
        }
        const rest = parts.slice(1);
        if (rest.length === 0) {
            return { nameFromMessage: null, tailSegments: [], raw: m };
        }
        const first = rest[0];
        const isMetaStart = (s) => {
            const t = String(s);
            return (
                /^Ürün:/i.test(t) ||
                /^Okutulan barkod:/i.test(t) ||
                /^okutulan:/i.test(t) ||
                /^Durum:/i.test(t) ||
                /^Sonuç:/i.test(t)
            );
        };
        let nameFromMessage = null;
        let tailStart = 0;
        if (/^Ürün:/i.test(first)) {
            nameFromMessage = first.replace(/^Ürün:\s*/i, '').trim();
            tailStart = 1;
        } else if (isMetaStart(first)) {
            tailStart = 0;
        } else {
            nameFromMessage = first;
            tailStart = 1;
        }
        const tailSegments = rest.slice(tailStart);
        return { nameFromMessage, tailSegments, raw: m };
    }

    /** Kesik/legacy ürün adından katalogda ürün bul (tam ad + görsel için) */
    tryFindProductByNameHint(nameHint) {
        const raw = String(nameHint || '').trim();
        if (raw.length < 3) return null;
        const clean = raw.replace(/[\u2026…]+$/g, '').replace(/\.\.\.$/, '').trim();
        const list = this.allProducts || [];
        for (const x of list) {
            if (!x || !x.name) continue;
            if (x.name === raw || x.name === clean) return x;
        }
        if (clean.length >= 4) {
            let best = null;
            for (const x of list) {
                if (!x || !x.name) continue;
                if (x.name.startsWith(clean) && (!best || x.name.length > best.name.length)) best = x;
            }
            if (best) return best;
        }
        const words = clean.split(/\s+/).filter(Boolean);
        for (let n = Math.min(words.length, 12); n >= 2; n--) {
            const prefix = words.slice(0, n).join(' ');
            if (prefix.length < 6) continue;
            let best = null;
            for (const x of list) {
                if (!x || !x.name) continue;
                if (x.name.startsWith(prefix) && (!best || x.name.length > best.name.length)) best = x;
            }
            if (best) return best;
        }
        return null;
    }

    /**
     * Stok / ürün audit mesajından ürün adı parçasını çıkar (productId olmayan eski kayıtlar için).
     * Örn: "Sayım güncellendi · Eti Nero … · depo 25 · …" → ikinci segment
     */
    parseAuditMessageEmbeddedProductName(m, cat) {
        const s = String(m || '').trim();
        if (!s) return null;
        const tabSep = ' · 📋 ';
        if (s.includes(tabSep)) {
            const name = s.split(tabSep)[0].trim();
            if (name) return name;
        }
        const parts = s.split(/\s*·\s*/).map((x) => x.trim()).filter(Boolean);
        if (
            parts.length === 1 &&
            /^(product_new|product_removed|product_deleted)$/.test(String(cat))
        ) {
            return parts[0] || null;
        }
        if (parts.length < 2) return null;
        const head = parts[0];
        if (cat === 'stock' && /^Sayım güncellendi$/i.test(head)) {
            return parts[1] || null;
        }
        const legacyProduct =
            cat === 'product' ||
            cat === 'product_new' ||
            cat === 'product_removed' ||
            cat === 'product_deleted';
        if (legacyProduct) {
            if (/^Ürün eklendi$/i.test(head)) return parts[1] || null;
            if (/^Listeden çıkarıldı$/i.test(head)) return parts[1] || null;
            if (/^Ürün silindi$/i.test(head)) return parts[1] || null;
        }
        return null;
    }

    /** İşlem kaydı tek satır: ürün kartta göründüğü için kısa stok özeti */
    formatStockAuditMessageLine(warehouseNorm, systemNorm) {
        const dep =
            warehouseNorm === null || warehouseNorm === undefined ? '—' : String(warehouseNorm);
        const sys =
            systemNorm === null || systemNorm === undefined ? '—' : String(systemNorm);
        return `📦 Depo: ${dep} · 💻 Sistem: ${sys}`;
    }

    shouldDeferStockAuditLog(productId) {
        return (
            this._deferStockAuditWhileSheetOpen &&
            productId != null &&
            productId === this.currentCountingProduct
        );
    }

    flushDeferredStockAuditForProduct(productId) {
        if (!productId || !this._stockAuditDirty) return;
        const data = this.countingData[productId];
        if (!data) {
            this._stockAuditDirty = false;
            return;
        }
        const normStock = (v) => {
            if (v === null || v === undefined) return null;
            const n = Number(v);
            return Number.isNaN(n) ? null : n;
        };
        const d = normStock(data.warehouseStock);
        const s = normStock(data.systemStock);
        this.pushAuditEntry(this.formatStockAuditMessageLine(d, s), { cat: 'stock', productId });
        this._stockAuditDirty = false;
    }

    /** İşlem kaydı kartı (verify dışı): id veya mesajdan ürün bul — logo için */
    resolveProductForGenericAuditThumbnail(e) {
        if (e.productId != null && e.productId !== '') {
            const byId = this.findProductByIdLoose(e.productId);
            if (byId) return byId;
        }
        const fromMsg = this.parseAuditMessageEmbeddedProductName(e.m, e.cat);
        if (fromMsg) {
            const byName = this.tryFindProductByNameHint(fromMsg);
            if (byName) return byName;
        }
        if (e.productName != null && String(e.productName).trim() !== '') {
            return this.tryFindProductByNameHint(String(e.productName).trim());
        }
        return null;
    }

    /** Barkod doğrulama: snapshot + id + isim ipucu ile ürün çöz */
    resolveProductForVerifyAudit(e) {
        const pId = this.findProductByIdLoose(e.productId);
        if (pId) return pId;
        const snap = e.productName && String(e.productName).trim();
        if (snap) {
            const bySnap = this.tryFindProductByNameHint(snap);
            if (bySnap) return bySnap;
        }
        const { nameFromMessage } = this.parseVerifyAuditMessageParts(e.m);
        if (nameFromMessage) {
            const byMsg = this.tryFindProductByNameHint(nameFromMessage);
            if (byMsg) return byMsg;
        }
        return null;
    }

    /** Tail segmentlerini Türkçe etiket + değer satırlarına */
    verifyAuditTailToRows(tailSegments) {
        const rows = [];
        const segs = Array.isArray(tailSegments) ? tailSegments : [];
        for (const seg of segs) {
            const idx = seg.indexOf(':');
            if (idx === -1) {
                if (!seg) continue;
                if (/^eşleşti$/i.test(seg)) rows.push({ label: 'Sonuç', value: 'eşleşti' });
                else if (/^eşleşmedi$/i.test(seg)) rows.push({ label: 'Sonuç', value: 'eşleşmedi' });
                else rows.push({ label: '', value: seg });
                continue;
            }
            let label = seg.slice(0, idx).trim();
            const value = seg.slice(idx + 1).trim();
            if (/^okutulan$/i.test(label)) label = 'Okutulan barkod';
            else if (/^Ürün$/i.test(label)) label = 'Ürün';
            else if (/^Sonuç$/i.test(label)) label = 'Sonuç';
            rows.push({ label, value });
        }
        return rows;
    }

    /** Barkod doğrulama: kartta tek satır, emoji ile okunaklı */
    formatVerifyAuditCompactMessage(e) {
        const m = String(e.m || '').trim();
        const okutulanM = m.match(/Okutulan barkod:\s*([^\s·]+)/i) || m.match(/okutulan:\s*([^\s·]+)/i);
        const okutulan = okutulanM ? okutulanM[1] : '';
        const sonucM = m.match(/Sonuç:\s*(eşleşti|eşleşmedi)/i);
        const sonuc = sonucM ? sonucM[1].toLowerCase() : '';
        if (okutulan && sonuc) {
            const icon = sonuc === 'eşleşti' ? '✅' : '❌';
            return `📷 ${okutulan} · ${icon} ${sonuc}`;
        }
        if (/Durum:\s*kamera/i.test(m)) {
            return m.replace(/^Barkod doğrula\s*·\s*/i, '🔔 ');
        }
        return m;
    }

    /** İşlem kaydı: ürün görseli (verify: anlık görsel + katalog) */
    getAuditThumbnailHtmlForEntry(e) {
        if (e.cat === 'verify') {
            const p = this.resolveProductForVerifyAudit(e);
            const snap = e.productImage && String(e.productImage).trim();
            const rawSrc = snap || (p && p.image) || '../assets/logo.png';
            const alt =
                (p && p.name) ||
                (e.productName && String(e.productName).trim()) ||
                this.auditProductLabel(e.productId) ||
                'Ürün';
            const src = this.escapeHtml(rawSrc);
            const altE = this.escapeHtml(alt);
            return `<div class="flex-shrink-0 pt-0.5"><img src="${src}" alt="${altE}" class="h-11 w-11 sm:h-12 sm:w-12 rounded-lg object-cover border border-slate-200/80 bg-white shadow-sm" loading="lazy" width="48" height="48" decoding="async" onerror="this.onerror=null;this.src='../assets/logo.png'"/></div>`;
        }
        const p = this.resolveProductForGenericAuditThumbnail(e);
        if (!p) return '';
        const src = this.escapeHtml((p.image) || '../assets/logo.png');
        const alt = this.escapeHtml(p.name || 'Ürün');
        return `<div class="flex-shrink-0 pt-0.5"><img src="${src}" alt="${alt}" class="h-11 w-11 sm:h-12 sm:w-12 rounded-lg object-cover border border-slate-200/80 bg-white shadow-sm" loading="lazy" width="48" height="48" decoding="async" onerror="this.onerror=null;this.src='../assets/logo.png'"/></div>`;
    }

    toggleSayimAuditLogPanel() {
        const overlay = document.getElementById('sayimAuditLogOverlay');
        if (!overlay) return;
        const nowHidden = overlay.classList.toggle('hidden');
        if (!nowHidden) {
            this._auditUiFilter = { search: '', table: '', category: '' };
            const si = document.getElementById('sayimAuditLogSearch');
            if (si) si.value = '';
            this.renderSayimAuditLogPanel();
            document.body.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
        }
    }

    renderSayimAuditLogPanel() {
        if (!this._auditUiFilter) this._auditUiFilter = { search: '', table: '', category: '' };
        this.populateAuditLogTableFilterOptions();
        this.populateAuditLogCategoryFilterOptions();

        const container = document.getElementById('sayimAuditLogBody');
        const countEl = document.getElementById('sayimAuditLogCount');
        const total = (this.auditLog || []).length;
        const filtered = this.getFilteredAuditEntries();

        if (countEl) {
            countEl.textContent =
                total === 0
                    ? 'Henüz kayıt yok'
                    : total === filtered.length
                      ? `${total} kayıt`
                      : `${filtered.length} kayıt · toplam ${total}`;
        }

        if (!container) return;

        if (total === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
                    <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    </div>
                    <p class="text-sm font-medium text-slate-600">Henüz işlem kaydı yok</p>
                    <p class="text-xs text-slate-400 max-w-xs">Sayım, içe aktarma ve barkod doğrulama gibi işlemler burada listelenir.</p>
                </div>`;
            return;
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2 py-14 px-4 text-center">
                    <p class="text-sm font-medium text-slate-600">Filtreye uygun kayıt yok</p>
                    <p class="text-xs text-slate-400">Aramayı veya filtreleri sıfırlamayı deneyin.</p>
                </div>`;
            return;
        }

        const blocks = filtered.map((e) => {
            const meta = this.getAuditCategoryMeta(e.cat);
            const time = this.escapeHtml(this.formatSayimAuditTime(e.t));
            const bodyRaw =
                e.cat === 'verify' ? this.formatVerifyAuditCompactMessage(e) : String(e.m || '');
            const msg = this.escapeHtml(bodyRaw);
            const tblRaw = e.tbl ? this.formatTableDisplayName(e.tbl) : '';
            const tbl = tblRaw
                ? `<span class="inline-flex max-w-[min(100%,14rem)] rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200/80 [overflow-wrap:anywhere] break-words text-left" title="${this.escapeHtml(tblRaw)}">${this.escapeHtml(tblRaw)}</span>`
                : `<span class="text-[11px] text-slate-400">Tablo bilinmiyor</span>`;
            return `
                <article class="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 p-3.5 shadow-sm transition hover:border-indigo-200/80 hover:shadow-md sm:p-4">
                    <div class="flex flex-wrap items-center gap-2 border-b border-slate-100/90 pb-2.5 mb-2.5">
                        <time class="text-xs font-mono font-semibold text-indigo-600 tabular-nums">${time}</time>
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${meta.class}">${this.escapeHtml(meta.label)}</span>
                        ${tbl}
                    </div>
                    <div class="flex gap-3 items-start min-w-0">
                        ${this.getAuditThumbnailHtmlForEntry(e)}
                        <p class="min-w-0 flex-1 text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere] break-words">${msg}</p>
                    </div>
                </article>`;
        });
        container.innerHTML = `<div class="flex flex-col gap-3">${blocks.join('')}</div>`;
    }

    bindSayimAuditLogPanel() {
        const overlay = document.getElementById('sayimAuditLogOverlay');
        const card = document.getElementById('sayimAuditLogPanel');
        const closeBtn = document.getElementById('sayimAuditLogClose');
        const clearBtn = document.getElementById('sayimAuditLogClear');
        const resetFiltersBtn = document.getElementById('sayimAuditLogFilterReset');
        const searchInput = document.getElementById('sayimAuditLogSearch');
        const tableSel = document.getElementById('sayimAuditLogFilterTable');
        const catSel = document.getElementById('sayimAuditLogFilterCat');

        const closeOverlay = () => {
            if (overlay) overlay.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        };
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeOverlay();
            });
        }
        if (card) {
            card.addEventListener('click', (e) => e.stopPropagation());
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', closeOverlay);
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const ok = typeof window !== 'undefined' && window.confirm
                    ? window.confirm('Tüm işlem kayıtları silinsin mi?')
                    : true;
                if (!ok) return;
                this.auditLog = [];
                try {
                    await this.saveCountingData();
                } catch (e) {
                    console.error(e);
                }
                this.renderSayimAuditLogPanel();
            });
        }

        if (!this._auditLogFilterBound) {
            this._auditLogFilterBound = true;
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    clearTimeout(this._auditSearchDebounce);
                    this._auditSearchDebounce = setTimeout(() => {
                        if (!this._auditUiFilter) this._auditUiFilter = { search: '', table: '', category: '' };
                        this._auditUiFilter.search = searchInput.value;
                        this.renderSayimAuditLogPanel();
                    }, 160);
                });
            }
            if (tableSel) {
                tableSel.addEventListener('change', () => {
                    if (!this._auditUiFilter) this._auditUiFilter = { search: '', table: '', category: '' };
                    this._auditUiFilter.table = tableSel.value;
                    this.renderSayimAuditLogPanel();
                });
            }
            if (catSel) {
                catSel.addEventListener('change', () => {
                    if (!this._auditUiFilter) this._auditUiFilter = { search: '', table: '', category: '' };
                    this._auditUiFilter.category = catSel.value;
                    this.renderSayimAuditLogPanel();
                });
            }
            if (resetFiltersBtn) {
                resetFiltersBtn.addEventListener('click', () => {
                    this._auditUiFilter = { search: '', table: '', category: '' };
                    if (searchInput) searchInput.value = '';
                    this.renderSayimAuditLogPanel();
                });
            }
        }

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const o = document.getElementById('sayimAuditLogOverlay');
            if (o && !o.classList.contains('hidden')) {
                closeOverlay();
            }
        });
    }

    async saveCountingData() {
        return this.saveCountingDataForTable(this.currentTableName);
    }

    /** Belirli tablo slotunu kaydeder — debounce sırasında tablo değişse bile doğru slota yazar */
    async saveCountingDataForTable(tableName) {
        const tName = tableName || this.currentTableName;
        if (!tName) return;
        try {
            if (!this.cachedFullData) {
                this.cachedFullData = { _api_info: {}, _tables: {} };
            }
            if (!this.cachedFullData._tables) this.cachedFullData._tables = {};
            this.cachedFullData = this.migrateToNestedStructure(this.cachedFullData);
            if (tName === this.currentTableName && this.countingData) {
                this.ensureTableMeta(this.countingData);
                this._safeWriteTableSlot(this.cachedFullData._tables, tName, this.countingData);
            }
            await this.saveFullCountingData(this.cachedFullData);
            this._invalidateFinanceCache(tName);
        } catch (error) {
            console.error('Error saving counting data:', error);
            try {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                const dataRef =
                    tName === this.currentTableName
                        ? this.countingData
                        : this.cachedFullData?._tables?.[tName];
                const fallback = {
                    _api_info: {},
                    _tables: dataRef ? { [tName]: dataRef } : {},
                };
                localStorage.setItem(storageKey, JSON.stringify(fallback));
            } catch (e) { /* ignore */ }
        }
    }

    /** scheduleSave: meta + ürünler için genel debounce (eski yöntem uyumu) */
    scheduleSave(delay = 500) {
        const tableName = this.currentTableName;
        if (this._saveDebounceTimer) clearTimeout(this._saveDebounceTimer);
        this._saveDebounceTimer = setTimeout(() => {
            this._saveDebounceTimer = null;
            this.saveCountingDataForTable(tableName).catch(e => console.error('scheduleSave error:', e));
        }, delay);
    }

    _countTableProductKeys(tableData) {
        if (!tableData || typeof tableData !== 'object') return 0;
        return Object.keys(tableData).filter((k) => !this.isReservedCountingKey(k)).length;
    }

    _getTableProductIds(tableData) {
        if (!tableData || typeof tableData !== 'object') return [];
        return Object.keys(tableData).filter((k) => !this.isReservedCountingKey(k));
    }

    async _purgeTableProductsNotInSet(keepIds, tableName) {
        const tName = tableName || this.currentTableName;
        if (!tName) return;
        const keep = new Set(keepIds || []);
        const beforeIds = this._getTableProductIds(this.countingData);
        const removedIds = beforeIds.filter((id) => !keep.has(id));
        if (removedIds.length === 0) return;
        for (const pid of removedIds) {
            delete this.countingData[pid];
        }
        if (this._countingItemsTableReady === true && removedIds.length > 0) {
            await Promise.all(removedIds.map((pid) => this.deleteProductEntry(pid, tName).catch(() => {})));
        }
    }

    /** Toplu counting_items upsert — yapıştırma sonrası tek seferde (50'şer chunk) */
    async _bulkSaveProductEntries(productIds, tableName) {
        if (this._countingItemsTableReady !== true || !Array.isArray(productIds) || productIds.length === 0) return;
        const tName = tableName || this.currentTableName;
        if (!tName) return;

        const rows = [];
        for (const pid of productIds) {
            const snapshot = this._snapshotProductEntry(this.countingData[pid]);
            if (snapshot) rows.push(this._buildCountingItemUpsertRow(tName, pid, snapshot));
        }
        if (rows.length === 0) return;

        const CHUNK = 50;
        for (let i = 0; i < rows.length; i += CHUNK) {
            const slice = rows.slice(i, i + CHUNK);
            let { error } = await window.supabase.from('counting_items').upsert(slice, {
                onConflict: 'username,table_name,product_id',
            });
            if (error && this._isMissingDbColumnError(error) && this._countingItemsPriceExtension !== false) {
                this._countingItemsPriceExtension = false;
                const fallbackSlice = slice.map(({ struck_price, struck_price_text, no_struck_price, ...rest }) => rest);
                ({ error } = await window.supabase.from('counting_items').upsert(fallbackSlice, {
                    onConflict: 'username,table_name,product_id',
                }));
            } else if (!error) {
                this._countingItemsPriceExtension = true;
            }
            if (error) console.warn('_bulkSaveProductEntries chunk hatası:', error.message);
        }
        this._saveFullBlobToLocalStorage();
        this._scheduleFullBackup();
    }

    _cloneTableDataSlot(source) {
        const clone = {};
        if (!source || typeof source !== 'object') return clone;
        for (const [k, v] of Object.entries(source)) {
            if (this.isReservedCountingKey(k)) {
                if (k === '_tableMeta' && v && typeof v === 'object') clone._tableMeta = { ...v };
                else if (k === '_productOrder' && Array.isArray(v)) clone._productOrder = [...v];
            } else if (v && typeof v === 'object') {
                clone[k] = this._hydrateProductEntryTimeline({
                    ...v,
                    history: Array.isArray(v.history) ? [...v.history] : [],
                });
            }
        }
        return clone;
    }

    /** Yerel tablo verisini hedef slota birleştirir (ürün kaybını önler) */
    _mergeTableDataSlotInto(target, source) {
        if (!target || !source || typeof target !== 'object' || typeof source !== 'object') return;
        for (const [k, v] of Object.entries(source)) {
            if (this.isReservedCountingKey(k)) {
                if (k === '_tableMeta' && v && typeof v === 'object') {
                    if (!target._tableMeta) target._tableMeta = {};
                    Object.assign(target._tableMeta, v);
                } else if (k === '_productOrder' && Array.isArray(v) && v.length > 0) {
                    target._productOrder = [...v];
                }
                continue;
            }
            if (!v || typeof v !== 'object') continue;
            const incTs = v.lastUpdated ? new Date(v.lastUpdated).getTime() : 0;
            const locTs = target[k]?.lastUpdated ? new Date(target[k].lastUpdated).getTime() : 0;
            if (!target[k] || incTs >= locTs) {
                target[k] = this._hydrateProductEntryTimeline({
                    ...v,
                    history: Array.isArray(v.history) ? [...v.history] : [],
                });
            }
        }
    }

    _beginBulkImportLock(message = 'Ürünler işleniyor…') {
        this._importInProgress = true;
        this.showCountingStatus(message, 'Lütfen bekleyin', { lock: true });
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
            this._saveDebounceTimer = null;
        }
    }

    _endBulkImportLock() {
        this._importInProgress = false;
        this._suppressCatchUpUntil = Date.now() + 3000;
        this.hideCountingStatus();
    }

    showCountingBusy(message = 'İşleniyor…', detail = '', options = {}) {
        const lock = options.lock === true;
        this.showCountingStatus(message, detail, { lock });
    }

    hideCountingBusy() {
        this.hideCountingStatus();
    }

    showCountingStatus(message = 'Yükleniyor…', detail = '', options = {}) {
        const lock = options.lock === true;
        const bump = options.bump !== false;
        if (bump) {
            if (!this._statusDepth) this._statusDepth = 0;
            this._statusDepth += 1;
        }

        const dock = document.getElementById('countingStatusDock');
        const msgEl = document.getElementById('countingStatusMsg');
        const detailEl = document.getElementById('countingStatusDetail');
        if (msgEl) msgEl.textContent = message;
        if (detailEl) {
            detailEl.textContent = detail || '';
            detailEl.style.display = detail ? 'block' : 'none';
        }
        if (dock) {
            dock.classList.toggle('is-lock', lock);
            dock.classList.remove('hidden');
            requestAnimationFrame(() => dock.classList.add('is-visible'));
        }
        document.documentElement.classList.add('counting-status-active');
        document.documentElement.classList.toggle('counting-status-lock', lock);
    }

    updateCountingStatus(message, detail = '', options = {}) {
        this.showCountingStatus(message, detail, {
            lock: options.lock === true,
            bump: false,
        });
    }

    hideCountingStatus() {
        this._statusDepth = Math.max(0, (this._statusDepth || 1) - 1);
        if (this._statusDepth > 0) return;
        const dock = document.getElementById('countingStatusDock');
        if (dock) {
            dock.classList.remove('is-visible', 'is-lock');
            setTimeout(() => {
                if ((this._statusDepth || 0) === 0) dock.classList.add('hidden');
            }, 260);
        }
        document.documentElement.classList.remove('counting-status-active', 'counting-status-lock');
    }

    _isTableTombstoned(tableName) {
        return this._deletedTableTombstones?.has(tableName) === true;
    }

    _scheduleMetaSave(delay = 450) {
        if (this._metaSaveTimer) clearTimeout(this._metaSaveTimer);
        this._metaSaveTimer = setTimeout(() => {
            this._metaSaveTimer = null;
            this._saveMetaOnly().catch(() => {});
        }, delay);
    }

    _persistTableSlotLocally(tableName) {
        if (!tableName || !this.cachedFullData) return;
        if (tableName === this.currentTableName && this.countingData) {
            this._safeWriteTableSlot(this.cachedFullData._tables, tableName, this.countingData);
        }
        this._saveFullBlobToLocalStorage();
    }

    _finalizeCountingHydration(fullData, tables) {
        if (Object.keys(tables).length === 0) {
            tables['Ana Sayım'] = {};
            fullData._tableMeta = fullData._tableMeta || {};
            fullData._tableMeta['Ana Sayım'] = fullData._tableMeta['Ana Sayım'] || {
                createdAt: new Date().toISOString(),
            };
        }

        this.cachedFullData = fullData;
        this.sanitizeTablesStructure(this.cachedFullData);

        const deviceTable = this._loadDeviceCurrentTable();
        const serverTable = fullData._currentTable;
        let resolvedTable = serverTable || deviceTable || 'Ana Sayım';
        if (!tables[resolvedTable]) {
            resolvedTable = Object.keys(tables).find((n) => !this._isTableTombstoned(n)) || 'Ana Sayım';
        }
        this.currentTableName = resolvedTable;
        this._saveDeviceCurrentTable(resolvedTable);
        this._persistCurrentTableToMeta();
        this._rememberTableContext(resolvedTable);

        if (!tables[this.currentTableName]) tables[this.currentTableName] = {};
        this.countingData = tables[this.currentTableName];

        this.auditLog = Array.isArray(fullData._auditLog)
            ? fullData._auditLog.slice(-this.AUDIT_LOG_MAX)
            : [];

        for (const tName of Object.keys(tables)) {
            if (this._isTableTombstoned(tName)) continue;
            this.syncTableLastActivityMeta(tName, tables[tName]);
        }
    }

    async _loadTableProductsFromSupabase(tableName) {
        if (!tableName || !window.supabase || !this.currentUser) return false;
        if (this._countingItemsTableReady !== true) return false;
        if (this._isTableTombstoned(tableName)) return false;

        try {
            const { data: rows, error } = await this._queryCountingItems(
                this._getCountingItemsSelectColumns(false),
                (q) => q.eq('username', this.currentUser.username).eq('table_name', tableName)
            );
            if (error || !rows) return false;

            if (!this.cachedFullData) this.cachedFullData = { _api_info: {}, _tables: {}, _tableMeta: {} };
            if (!this.cachedFullData._tables) this.cachedFullData._tables = {};
            if (!this.cachedFullData._tables[tableName]) {
                this.cachedFullData._tables[tableName] = {};
            }
            const slot = this.cachedFullData._tables[tableName];
            const meta = this.cachedFullData._tableMeta?.[tableName];
            if (meta?.createdAt || meta?.lastActivityAt) {
                if (!slot._tableMeta) slot._tableMeta = {};
                if (meta.createdAt) slot._tableMeta.createdAt = meta.createdAt;
                if (meta.lastActivityAt) slot._tableMeta.lastActivityAt = meta.lastActivityAt;
            }
            if (Array.isArray(meta?._productOrder)) slot._productOrder = [...meta._productOrder];

            for (const row of rows) {
                slot[row.product_id] = this._mapCountingItemRowToEntry(row);
            }

            if (tableName === this.currentTableName) {
                this.countingData = slot;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    async _warmCountingTablesInBackground() {
        if (this._countingItemsTableReady !== true || !this.cachedFullData) return;
        const names = new Set([
            ...Object.keys(this.cachedFullData._tableMeta || {}),
            ...Object.keys(this.cachedFullData._tables || {}),
        ]);
        for (const tName of names) {
            if (!this.isValidTableNameKey(tName) || this._isTableTombstoned(tName)) continue;
            if (tName === this.currentTableName) continue;
            const slot = this.cachedFullData._tables?.[tName];
            if (slot && this._countTableProductKeys(slot) > 0) continue;
            await this._loadTableProductsFromSupabase(tName);
        }
        this._scheduleTableSelectorUpdate(80);
    }

    _isSheetStockFetchLocked() {
        return this._sheetStockFetchInFlight === true;
    }

    _applySheetStockFetchLock(locked) {
        const ids = [
            'countingPrevBtn',
            'countingNextBtn',
            'countingDeleteProductBtn',
            'countingProductTimelineBtn',
            'countingVerifyBarcodeBtn',
            'countingDecreaseBtn',
            'countingIncreaseBtn',
            'countingCorrectEntryBtn',
            'countingRefreshSystemStockBtn',
        ];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = !!locked;
        });
        document.querySelectorAll('#countingBottomSheet .keypad-btn, #keypadBackspace').forEach((btn) => {
            btn.disabled = !!locked;
            btn.classList.toggle('opacity-40', !!locked);
            btn.classList.toggle('pointer-events-none', !!locked);
        });
        const lock = document.getElementById('countingSheetStockLock');
        if (lock) lock.classList.toggle('is-visible', !!locked);
    }

    _clearSheetStockFetchTimers() {
        if (this._sheetStockFetchSlowTimer) {
            clearTimeout(this._sheetStockFetchSlowTimer);
            this._sheetStockFetchSlowTimer = null;
        }
        if (this._sheetStockFetchTimeoutTimer) {
            clearTimeout(this._sheetStockFetchTimeoutTimer);
            this._sheetStockFetchTimeoutTimer = null;
        }
    }

    _updateSheetStockFetchUi(message, hint = '', showCancel = false) {
        const msgEl = document.getElementById('countingSheetStockLockMsg');
        const hintEl = document.getElementById('countingSheetStockLockHint');
        const cancelBtn = document.getElementById('countingSheetStockCancelBtn');
        if (msgEl && message) msgEl.textContent = message;
        if (hintEl) {
            hintEl.textContent = hint || '';
            hintEl.classList.toggle('hidden', !hint);
        }
        if (cancelBtn) cancelBtn.classList.toggle('hidden', !showCancel);
    }

    _cancelSheetStockFetch() {
        if (!this._sheetStockFetchInFlight) return;
        this._sheetStockFetchCancelled = true;
        if (typeof this._sheetStockFetchReject === 'function') {
            this._sheetStockFetchReject(new Error('cancelled'));
            this._sheetStockFetchReject = null;
        }
        this._endSheetStockFetch({ cancelled: true });
        this.showToast('Stok isteği iptal edildi', 'info', 2200);
    }

    _beginSheetStockFetch() {
        this._sheetStockFetchInFlight = true;
        this._sheetStockFetchCancelled = false;
        this._sheetStockFetchReject = null;
        this._applySheetStockFetchLock(true);
        this._updateSheetStockFetchUi('Stok çekiliyor…', '', false);

        this._clearSheetStockFetchTimers();
        this._sheetStockFetchSlowTimer = setTimeout(() => {
            this._updateSheetStockFetchUi(
                'Biraz uzun sürüyor…',
                'Bağlantı yavaş olabilir. Biraz daha bekleyin veya iptal edin.',
                true
            );
        }, this.SHEET_STOCK_FETCH_SLOW_MS);

        this._sheetStockFetchTimeoutTimer = setTimeout(() => {
            if (!this._sheetStockFetchInFlight) return;
            if (typeof this._sheetStockFetchReject === 'function') {
                this._sheetStockFetchReject(new Error('timeout'));
                this._sheetStockFetchReject = null;
            }
        }, this.SHEET_STOCK_FETCH_TIMEOUT_MS);
    }

    _endSheetStockFetch({ cancelled = false } = {}) {
        if (!this._sheetStockFetchInFlight && !cancelled) return;
        this._sheetStockFetchInFlight = false;
        this._sheetStockFetchReject = null;
        this._clearSheetStockFetchTimers();
        this._applySheetStockFetchLock(false);
        this._updateSheetStockFetchUi('Stok çekiliyor…', '', false);
    }

    async _fetchStockForCountingSheet(productId, barcode) {
        if (this._isSheetStockFetchLocked()) return null;
        this._beginSheetStockFetch();

        try {
            const result = await new Promise((resolve, reject) => {
                this._sheetStockFetchReject = reject;
                this.requestStockFromExtension(null, barcode, productId, {})
                    .then(resolve)
                    .catch(reject);
            });
            if (this._sheetStockFetchCancelled) return null;
            return result;
        } catch (error) {
            if (this._sheetStockFetchCancelled || error?.message === 'cancelled') return null;
            if (error?.message === 'timeout') {
                this.showToast('Stok isteği zaman aşımına uğradı. Tekrar deneyin.', 'warning', 4000);
            } else {
                throw error;
            }
            return null;
        } finally {
            this._endSheetStockFetch();
        }
    }

    _refreshOpenCountingSheetFromData() {
        const productId = this.currentCountingProduct;
        if (!productId) return;
        const data = this.countingData[productId];
        if (!data) return;

        this.updateCountingBottomSheetSystemStockDisplay(data.systemStock, data.reservedStock);
        const depoInput = document.getElementById('countingDepoInput');
        if (depoInput) {
            depoInput.value =
                data.warehouseStock !== null && data.warehouseStock !== undefined
                    ? data.warehouseStock
                    : '';
        }
        const stockIndicator = document.getElementById('countingStockIndicator');
        this.updateStockIndicator(productId, stockIndicator);
        this.updateCorrectEntryButtonState();
    }

    _persistCurrentTableToMeta() {
        if (!this.cachedFullData || !this.currentTableName) return;
        this.cachedFullData._currentTable = this.currentTableName;
        this.cachedFullData._currentTableAt = Date.now();
    }

    _syncProductOrderMeta(tableName) {
        const tName = tableName || this.currentTableName;
        if (!tName || !this.cachedFullData) return;
        const data =
            tName === this.currentTableName && this.countingData
                ? this.countingData
                : this.cachedFullData._tables?.[tName];
        if (!data || !Array.isArray(data._productOrder)) return;
        if (!this.cachedFullData._tableMeta) this.cachedFullData._tableMeta = {};
        if (!this.cachedFullData._tableMeta[tName]) this.cachedFullData._tableMeta[tName] = {};
        this.cachedFullData._tableMeta[tName]._productOrder = [...data._productOrder];
    }

    /** Uzak cihazdan gelen sırayı yerel ürünlerle birleştirir (yapıştırma sırası korunur) */
    _mergeRemoteProductOrder(incomingOrder, localProductIds, existingLocalOrder = []) {
        const localSet = new Set(localProductIds);
        const merged = [];
        const seen = new Set();
        for (const id of incomingOrder || []) {
            if (!localSet.has(id) || seen.has(id)) continue;
            merged.push(id);
            seen.add(id);
        }
        for (const id of existingLocalOrder || []) {
            if (!localSet.has(id) || seen.has(id)) continue;
            merged.push(id);
            seen.add(id);
        }
        for (const id of localProductIds) {
            if (seen.has(id)) continue;
            merged.push(id);
            seen.add(id);
        }
        return merged;
    }

    /** Meta blob veya parametreden gelen sırayı tablo slotuna uygular */
    _applyRemoteProductOrderForTable(tableName, incomingOrder) {
        const tName = tableName || this.currentTableName;
        if (!tName) return false;
        const table = this.cachedFullData?._tables?.[tName];
        if (!table) return false;
        const order = incomingOrder || this.cachedFullData?._tableMeta?.[tName]?._productOrder;
        if (!Array.isArray(order) || order.length === 0) return false;
        const localIds = Object.keys(table).filter((k) => !this.isReservedCountingKey(k));
        const merged = this._mergeRemoteProductOrder(order, localIds, table._productOrder);
        if (merged.length === 0) return false;
        const prev = table._productOrder;
        if (Array.isArray(prev) && prev.length === merged.length && prev.every((id, i) => id === merged[i])) {
            return false;
        }
        table._productOrder = merged;
        if (tName === this.currentTableName && this.countingData) {
            this.countingData._productOrder = [...merged];
        }
        return true;
    }

    /** Debounced aktif tablo catch-up — tek counting_items sorgusu, egress dostu */
    _scheduleActiveTableCatchUp(delay = 150) {
        if (this._importInProgress || !this.currentTableName) return;
        if (this._suppressCatchUpUntil && Date.now() < this._suppressCatchUpUntil) return;
        if (this._activeTableCatchUpTimer) clearTimeout(this._activeTableCatchUpTimer);
        this._activeTableCatchUpTimer = setTimeout(() => {
            this._activeTableCatchUpTimer = null;
            this._catchUpActiveTableFromSupabase().catch(() => {});
        }, delay);
    }

    /** Aktif tablonun ürünlerini + sırasını Supabase ile hizalar (realtime güvenlik ağı) */
    async _catchUpActiveTableFromSupabase() {
        if (this._importInProgress || !this.currentTableName) return;
        if (this._suppressCatchUpUntil && Date.now() < this._suppressCatchUpUntil) return;
        if (this._activeTableCatchUpInFlight) {
            this._activeTableCatchUpQueued = true;
            return;
        }
        this._activeTableCatchUpInFlight = true;
        try {
            await this.refreshCurrentTableFromSupabase();
            const orderChanged = this._applyRemoteProductOrderForTable(this.currentTableName);
            if (orderChanged) {
                this.scheduleRenderTable();
                this.updateStatistics();
                this.updateCountingProgress();
            }
        } finally {
            this._activeTableCatchUpInFlight = false;
            if (this._activeTableCatchUpQueued) {
                this._activeTableCatchUpQueued = false;
                this._scheduleActiveTableCatchUp(400);
            }
        }
    }

    /** countingData ile cachedFullData slotunun aynı tabloya bağlı olduğunu doğrular */
    _verifyCountingDataTableBinding() {
        const name = this.currentTableName;
        if (!name) return;
        const fullData = this.cachedFullData || { _api_info: {}, _tables: {} };
        if (!fullData._tables) fullData._tables = {};
        let slot = fullData._tables[name];

        if (slot && typeof slot === 'object' && slot !== fullData._tables) {
            for (const [otherName, otherSlot] of Object.entries(fullData._tables)) {
                if (otherName === name) continue;
                if (otherSlot === slot) {
                    slot = this._cloneTableDataSlot(slot);
                    fullData._tables[name] = slot;
                    break;
                }
            }
        }

        if (this.countingData && this.countingData !== slot) {
            let sharedWithOther = false;
            for (const [otherName, otherSlot] of Object.entries(fullData._tables)) {
                if (otherName === name) continue;
                if (otherSlot === this.countingData) {
                    sharedWithOther = true;
                    break;
                }
            }
            if (!slot || typeof slot !== 'object') {
                slot = { _tableMeta: { createdAt: new Date().toISOString() } };
                fullData._tables[name] = slot;
            } else if (sharedWithOther) {
                slot = this._cloneTableDataSlot(this.countingData);
                fullData._tables[name] = slot;
            } else {
                this._mergeTableDataSlotInto(slot, this.countingData);
            }
            this.countingData = slot;
        } else if (!this.countingData) {
            if (!slot || typeof slot !== 'object') {
                slot = { _tableMeta: { createdAt: new Date().toISOString() } };
                fullData._tables[name] = slot;
            }
            this.countingData = slot;
        }

        this.cachedFullData = fullData;
        this.ensureTableMeta(this.countingData);
    }

    /**
     * Tablo değişiminde bellek + slot izolasyonu.
     * Önceki tablo slota yazılır; yeni tablo kendi nesnesine bağlanır.
     */
    _activateCountingTable(tableName, { fromTable = null, persistFrom = true } = {}) {
        const fullData = this.cachedFullData || { _api_info: {}, _tables: {} };
        if (!fullData._tables) fullData._tables = {};

        if (persistFrom && fromTable && this.countingData) {
            this._safeWriteTableSlot(fullData._tables, fromTable, this.countingData);
        }

        let slot = fullData._tables[tableName];
        if (!slot || typeof slot !== 'object' || Array.isArray(slot) || slot === fullData._tables) {
            slot = { _tableMeta: { createdAt: new Date().toISOString() } };
            fullData._tables[tableName] = slot;
        }

        for (const [otherName, otherSlot] of Object.entries(fullData._tables)) {
            if (otherName === tableName) continue;
            if (otherSlot === slot) {
                slot = this._cloneTableDataSlot(otherSlot);
                fullData._tables[tableName] = slot;
                break;
            }
        }

        this.cachedFullData = fullData;
        this.currentTableName = tableName;
        this.countingData = slot;
        this._verifyCountingDataTableBinding();
    }

    /** Tablo nesnesine güvenli erişim (tablo değişiminde countingData kaymasını önler) */
    _getTableDataRef(tableName) {
        const tName = tableName || this.currentTableName;
        if (!tName) return null;
        if (this.cachedFullData?._tables?.[tName]) return this.cachedFullData._tables[tName];
        if (tName === this.currentTableName && this.countingData) return this.countingData;
        return null;
    }

    /** Supabase kolon eksikliği hatası mı */
    _isMissingDbColumnError(err) {
        const msg = String(err?.message || err?.code || err || '').toLowerCase();
        return (
            msg.includes('column') &&
            (msg.includes('does not exist') ||
                msg.includes('could not find') ||
                msg.includes('schema cache') ||
                msg.includes('42703'))
        );
    }

    _getCountingItemsSelectColumns(includeCreatedAt = true) {
        const base = includeCreatedAt
            ? 'table_name, product_id, warehouse_stock, system_stock, price, price_text, reserved_stock, history, api_fetch_failed, last_updated, created_at'
            : 'product_id, warehouse_stock, system_stock, price, price_text, reserved_stock, history, api_fetch_failed, last_updated';
        if (this._countingItemsPriceExtension === false) return base;
        return `${base}, struck_price, struck_price_text, no_struck_price`;
    }

    /** Meta sync / polling — history hariç (egress tasarrufu) */
    _getCountingItemsMetaSyncColumns() {
        const base =
            'table_name, product_id, warehouse_stock, system_stock, price, price_text, reserved_stock, api_fetch_failed, last_updated, created_at';
        if (this._countingItemsPriceExtension === false) return base;
        return `${base}, struck_price, struck_price_text, no_struck_price`;
    }

    _isCountingRealtimeHealthy() {
        return this._realtimeItemsActive === true || this._realtimeMetaActive === true;
    }

    _mapCountingItemRowToEntry(row) {
        if (!row) return null;
        const { stockHist, meta } = this._splitProductHistoryAndTimeline(row.history || []);
        const entry = {
            warehouseStock: row.warehouse_stock ?? null,
            systemStock: row.system_stock ?? null,
            price: row.price ?? null,
            priceText: row.price_text ?? null,
            reservedStock: row.reserved_stock ?? null,
            history: stockHist,
            apiFetchFailed: row.api_fetch_failed || false,
            lastUpdated: row.last_updated || new Date().toISOString(),
            addedAt: meta.addedAt ?? null,
            warehouseStockAt: meta.warehouseStockAt ?? null,
            systemStockAt: meta.systemStockAt ?? null,
        };
        if (row.struck_price != null && row.struck_price !== '') {
            const sp = Number(row.struck_price);
            if (!Number.isNaN(sp)) entry.struckPrice = sp;
        }
        if (row.struck_price_text) entry.struckPriceText = row.struck_price_text;
        if (row.no_struck_price === true) entry._apiNoStruckPrice = true;
        return entry;
    }

    /** saveProductEntry upsert anı için ürün satırı anlık görüntüsü */
    _snapshotProductEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const { stockHist } = this._splitProductHistoryAndTimeline(entry.history || []);
        return {
            warehouseStock: entry.warehouseStock ?? null,
            systemStock: entry.systemStock ?? null,
            price: entry.price ?? null,
            priceText: entry.priceText ?? null,
            struckPrice: entry.struckPrice ?? null,
            struckPriceText: entry.struckPriceText ?? null,
            _apiNoStruckPrice: entry._apiNoStruckPrice === true,
            reservedStock: entry.reservedStock ?? null,
            history: this._embedProductTimelineInHistory(stockHist, entry),
            apiFetchFailed: entry.apiFetchFailed || false,
            lastUpdated: entry.lastUpdated || new Date().toISOString(),
            addedAt: entry.addedAt ?? null,
            warehouseStockAt: entry.warehouseStockAt ?? null,
            systemStockAt: entry.systemStockAt ?? null,
        };
    }

    /** Stok geçmişi ile timeline meta birlikte history JSON'da — mevcut kayıtları bozmaz */
    _splitProductHistoryAndTimeline(history) {
        const stockHist = [];
        const meta = {};
        if (!Array.isArray(history)) return { stockHist, meta };
        for (const item of history) {
            if (item && item._tl === true) {
                if (item.addedAt) meta.addedAt = item.addedAt;
                if (item.warehouseStockAt) meta.warehouseStockAt = item.warehouseStockAt;
                if (item.systemStockAt) meta.systemStockAt = item.systemStockAt;
            } else if (item) {
                stockHist.push(item);
            }
        }
        return { stockHist, meta };
    }

    _embedProductTimelineInHistory(stockHist, entry) {
        const out = Array.isArray(stockHist)
            ? stockHist.filter((h) => !(h && h._tl === true))
            : [];
        const tl = {};
        if (entry?.addedAt) tl.addedAt = entry.addedAt;
        if (entry?.warehouseStockAt) tl.warehouseStockAt = entry.warehouseStockAt;
        if (entry?.systemStockAt) tl.systemStockAt = entry.systemStockAt;
        if (Object.keys(tl).length > 0) out.push({ _tl: true, ...tl });
        return out;
    }

    _hydrateProductEntryTimeline(entry) {
        if (!entry || typeof entry !== 'object') return entry;
        const { stockHist, meta } = this._splitProductHistoryAndTimeline(entry.history || []);
        entry.history = stockHist;
        if (!entry.addedAt && meta.addedAt) entry.addedAt = meta.addedAt;
        if (!entry.warehouseStockAt && meta.warehouseStockAt) entry.warehouseStockAt = meta.warehouseStockAt;
        if (!entry.systemStockAt && meta.systemStockAt) entry.systemStockAt = meta.systemStockAt;
        return entry;
    }

    _mergeTimelineIso(localVal, incomingVal, mode = 'latest') {
        const lMs = this._isoToMs(localVal);
        const iMs = this._isoToMs(incomingVal);
        if (Number.isNaN(lMs) && Number.isNaN(iMs)) return null;
        if (Number.isNaN(lMs)) return incomingVal || null;
        if (Number.isNaN(iMs)) return localVal || null;
        if (mode === 'earliest') return lMs <= iMs ? localVal : incomingVal;
        return lMs >= iMs ? localVal : incomingVal;
    }

    _isoToMs(iso) {
        if (!iso) return NaN;
        const ms = new Date(iso).getTime();
        return Number.isNaN(ms) ? NaN : ms;
    }

    _localDateKeyFromMs(ms) {
        if (ms == null || Number.isNaN(ms)) return '';
        try {
            const d = new Date(ms);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        } catch (e) {
            return '';
        }
    }

    _auditEntryMatchesProduct(entry, productId) {
        if (!entry || productId == null) return false;
        if (entry.productId != null && String(entry.productId) === String(productId)) return true;
        const label = this.auditProductLabel(productId);
        if (label && entry.m && String(entry.m).includes(label)) return true;
        return false;
    }

    _findAuditTimestampForProduct(productId, categories, mode = 'earliest') {
        const cats = new Set(Array.isArray(categories) ? categories : [categories]);
        let result = NaN;
        for (const raw of this.auditLog || []) {
            const entry = this.normalizeAuditEntry(raw);
            if (!this._auditEntryMatchesProduct(entry, productId)) continue;
            if (!cats.has(entry.cat)) continue;
            const t = Number(entry.t);
            if (Number.isNaN(t)) continue;
            if (Number.isNaN(result)) {
                result = t;
                continue;
            }
            result = mode === 'latest' ? Math.max(result, t) : Math.min(result, t);
        }
        return result;
    }

    _ensureProductTimelineFields(productId) {
        const entry = this.countingData?.[productId];
        if (!entry) return false;
        let dirty = false;
        const nowIso = new Date().toISOString();

        if (!entry.addedAt) {
            const ms = this._findAuditTimestampForProduct(productId, ['product_new', 'import'], 'earliest');
            if (!Number.isNaN(ms)) {
                entry.addedAt = new Date(ms).toISOString();
                dirty = true;
            } else if (Array.isArray(entry.history) && entry.history.length > 0) {
                const histMs = entry.history
                    .map((h) => (h?.timestamp ? new Date(h.timestamp).getTime() : NaN))
                    .filter((t) => !Number.isNaN(t));
                if (histMs.length > 0) {
                    entry.addedAt = new Date(Math.min(...histMs)).toISOString();
                    dirty = true;
                }
            } else if (entry.lastUpdated) {
                entry.addedAt = entry.lastUpdated;
                dirty = true;
            }
        }

        const hasWarehouse =
            entry.warehouseStock !== null && entry.warehouseStock !== undefined;
        if (hasWarehouse && !entry.warehouseStockAt) {
            const ms = this._findAuditTimestampForProduct(productId, ['stock'], 'latest');
            entry.warehouseStockAt = !Number.isNaN(ms)
                ? new Date(ms).toISOString()
                : entry.lastUpdated || nowIso;
            dirty = true;
        }

        const hasSystem = entry.systemStock !== null && entry.systemStock !== undefined;
        if (hasSystem && !entry.systemStockAt) {
            const ms = this._findAuditTimestampForProduct(productId, ['sync', 'stock'], 'latest');
            entry.systemStockAt = !Number.isNaN(ms)
                ? new Date(ms).toISOString()
                : entry.lastUpdated || nowIso;
            dirty = true;
        }

        if (dirty) {
            this._scheduleProductSave(productId, 600);
        }
        return dirty;
    }

    _resolveProductTimelineEvents(productId) {
        this._ensureProductTimelineFields(productId);
        const entry = this.countingData?.[productId] || {};
        const events = [];

        const pushEvent = (type, label, iso, icon, tone) => {
            const ms = this._isoToMs(iso);
            if (Number.isNaN(ms)) return;
            events.push({ type, label, iso, ms, icon, tone });
        };

        pushEvent('added', 'Tabloya eklendi', entry.addedAt, 'added', 'violet');
        pushEvent('system', 'Sistem stoku çekildi', entry.systemStockAt, 'system', 'blue');
        pushEvent('warehouse', 'Depo stoku girildi', entry.warehouseStockAt, 'warehouse', 'orange');

        events.sort((a, b) => a.ms - b.ms);
        return events;
    }

    _renderProductTimelineIcon(icon, tone) {
        const tones = {
            violet: 'bg-violet-100 text-violet-700 ring-violet-200/80',
            blue: 'bg-blue-100 text-blue-700 ring-blue-200/80',
            orange: 'bg-orange-100 text-orange-700 ring-orange-200/80',
        };
        const cls = tones[tone] || tones.violet;
        if (icon === 'added') {
            return `<span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${cls}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg></span>`;
        }
        if (icon === 'system') {
            return `<span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${cls}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></span>`;
        }
        return `<span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${cls}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></span>`;
    }

    renderProductTimelinePanel(productId) {
        const container = document.getElementById('countingProductTimelineContent');
        if (!container) return;

        const events = this._resolveProductTimelineEvents(productId);
        if (events.length === 0) {
            container.innerHTML =
                '<p class="text-xs text-slate-500 py-2">Bu ürün için henüz kayıtlı bir geçmiş yok.</p>';
            return;
        }

        const byDay = new Map();
        for (const ev of events) {
            const key = this._localDateKeyFromMs(ev.ms);
            if (!byDay.has(key)) byDay.set(key, []);
            byDay.get(key).push(ev);
        }

        const dayBlocks = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        container.innerHTML = dayBlocks
            .map(([dayKey, dayEvents], dayIdx) => {
                const dayLabel = this.formatDateOnlyTr(dayEvents[0]?.ms);
                const blockClass = dayIdx > 0 ? 'counting-timeline-day-block' : '';
                const rows = dayEvents
                    .map((ev) => {
                        const abs = this.formatAbsoluteDateTimeTr(ev.ms);
                        const rel = this.formatRelativeAgoTr(ev.ms);
                        const relHtml = rel
                            ? `<span class="text-[11px] text-slate-400">${this.escapeHtml(rel)}</span>`
                            : '';
                        return `
                            <div class="flex items-start gap-2.5 py-1.5">
                                ${this._renderProductTimelineIcon(ev.icon, ev.tone)}
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-semibold text-slate-800">${this.escapeHtml(ev.label)}</p>
                                    <p class="text-[11px] text-slate-600 mt-0.5">${this.escapeHtml(abs)}</p>
                                    ${relHtml}
                                </div>
                            </div>`;
                    })
                    .join('');
                return `
                    <div class="${blockClass}">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">${this.escapeHtml(dayLabel)}</p>
                        <div class="space-y-0.5">${rows}</div>
                    </div>`;
            })
            .join('');
    }

    openProductTimelinePanel() {
        const productId = this.currentCountingProduct;
        if (!productId) return;
        const overlay = document.getElementById('countingProductTimelineOverlay');
        const btn = document.getElementById('countingProductTimelineBtn');
        const subtitle = document.getElementById('countingProductTimelineSubtitle');
        if (!overlay) return;

        const product = this.productIndex.get(productId);
        if (subtitle) {
            subtitle.textContent = product?.name ? String(product.name) : '';
        }

        this.renderProductTimelinePanel(productId);
        overlay.classList.remove('hidden');
        overlay.classList.add('flex', 'show');
        if (btn) {
            btn.classList.add('is-active');
            btn.setAttribute('aria-expanded', 'true');
        }
    }

    closeProductTimelinePanel() {
        const overlay = document.getElementById('countingProductTimelineOverlay');
        const btn = document.getElementById('countingProductTimelineBtn');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex', 'show');
        }
        if (btn) {
            btn.classList.remove('is-active');
            btn.setAttribute('aria-expanded', 'false');
        }
    }

    toggleProductTimelinePanel() {
        const overlay = document.getElementById('countingProductTimelineOverlay');
        if (!overlay) return;
        if (overlay.classList.contains('hidden')) this.openProductTimelinePanel();
        else this.closeProductTimelinePanel();
    }

    isProductTimelinePanelOpen() {
        const overlay = document.getElementById('countingProductTimelineOverlay');
        return !!(overlay && !overlay.classList.contains('hidden'));
    }

    _loadProductDetailHiddenFields() {
        try {
            const raw = localStorage.getItem('counting_product_detail_hidden_v1');
            const parsed = raw ? JSON.parse(raw) : [];
            const set = new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
            if (set.has('ingredients')) {
                set.delete('ingredients');
                set.add('description');
            }
            return set;
        } catch (e) {
            return new Set();
        }
    }

    _saveProductDetailHiddenFields() {
        try {
            localStorage.setItem(
                'counting_product_detail_hidden_v1',
                JSON.stringify([...this._productDetailHiddenFields])
            );
        } catch (e) {
            /* storage dolu olabilir */
        }
    }

    _hideProductDetailField(fieldId) {
        if (!fieldId) return;
        this._productDetailHiddenFields.add(String(fieldId));
        this._saveProductDetailHiddenFields();
        if (this.currentCountingProduct) {
            this.renderProductDetailPanel(this.currentCountingProduct);
        }
    }

    _resetProductDetailHiddenFields() {
        this._productDetailHiddenFields.clear();
        this._saveProductDetailHiddenFields();
        if (this.currentCountingProduct) {
            this.renderProductDetailPanel(this.currentCountingProduct);
        }
    }

    _getProductDetailFieldLabel(fieldId) {
        return COUNTING_PRODUCT_DETAIL_FIELD_LABELS[fieldId] || fieldId;
    }

    _isProductDetailHidden(fieldId) {
        return this._productDetailHiddenFields.has(String(fieldId));
    }

    _unhideProductDetailField(fieldId) {
        if (!fieldId) return;
        this._productDetailHiddenFields.delete(String(fieldId));
        this._saveProductDetailHiddenFields();
        if (this.currentCountingProduct) {
            this.renderProductDetailPanel(this.currentCountingProduct);
        }
    }

    _renderProductDetailHideBtn(fieldId, title) {
        const label = title || this._getProductDetailFieldLabel(fieldId);
        return `<button type="button" class="pd-section-hide-btn product-detail-hide-btn" data-field-id="${this.escapeHtml(fieldId)}" title="${this.escapeHtml(label + ' gizle')}" aria-label="${this.escapeHtml(label + ' gizle')}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858 5.858a3 3 0 104.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18"/>
            </svg>
        </button>`;
    }

    _renderProductDetailHiddenChips() {
        const chipsEl = document.getElementById('countingProductDetailHiddenChips');
        const hiddenBar = document.getElementById('countingProductDetailHiddenBar');
        if (!chipsEl || !hiddenBar) return;

        const hiddenIds = [...this._productDetailHiddenFields].sort((a, b) =>
            this._getProductDetailFieldLabel(a).localeCompare(this._getProductDetailFieldLabel(b), 'tr')
        );

        if (!hiddenIds.length) {
            hiddenBar.classList.add('hidden');
            chipsEl.innerHTML = '';
            return;
        }

        hiddenBar.classList.remove('hidden');
        chipsEl.innerHTML = hiddenIds
            .map(
                (id) =>
                    `<button type="button" class="pd-hidden-chip" data-unhide-field="${this.escapeHtml(id)}" title="Göster: ${this.escapeHtml(this._getProductDetailFieldLabel(id))}">
                        <span class="truncate max-w-[9rem]">${this.escapeHtml(this._getProductDetailFieldLabel(id))}</span>
                        <span class="pd-hidden-chip-x" aria-hidden="true">×</span>
                    </button>`
            )
            .join('');
    }

    _decodeHtmlEntities(text) {
        if (!text) return '';
        const ta = document.createElement('textarea');
        ta.innerHTML = String(text);
        return ta.value;
    }

    _sanitizeDetailHtml(raw) {
        if (!raw) return '';
        let html = this._decodeHtmlEntities(String(raw).trim());
        if (!html) return '';

        const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'P', 'UL', 'OL', 'LI', 'SPAN']);
        const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
        const root = doc.body.firstElementChild;
        if (!root) return this.escapeHtml(html);

        const walk = (node) => {
            [...node.childNodes].forEach((child) => {
                if (child.nodeType !== Node.ELEMENT_NODE) return;
                if (!allowed.has(child.tagName)) {
                    const text = doc.createTextNode(child.textContent || '');
                    child.replaceWith(text);
                    return;
                }
                [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
                walk(child);
            });
        };
        walk(root);
        return root.innerHTML;
    }

    _formatRichDescription(raw) {
        if (!raw) return '';
        const sanitized = this._sanitizeDetailHtml(raw);
        return sanitized || this.escapeHtml(String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }

    _startOfLocalDay(date) {
        const d = date instanceof Date ? date : new Date(date);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    _parseIsoDateParts(iso) {
        if (!iso || typeof iso !== 'string') return null;
        const parts = iso.trim().split('-');
        if (parts.length !== 3) return null;
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }

    _formatIsoDateTr(iso) {
        const d = this._parseIsoDateParts(iso);
        if (!d) return iso || '';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}.${mm}.${d.getFullYear()}`;
    }

    _addDaysToIsoDate(iso, days) {
        const d = this._parseIsoDateParts(iso);
        if (!d) return null;
        d.setDate(d.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    _daysFromTodayToIso(iso) {
        const target = this._parseIsoDateParts(iso);
        if (!target) return null;
        const today = this._startOfLocalDay(new Date());
        return Math.round((target.getTime() - today.getTime()) / 86400000);
    }

    _analyzeSktDate(expDays, sktIso) {
        const remainingToSkt = this._daysFromTodayToIso(sktIso);
        if (remainingToSkt == null) return null;

        const warning = Number(expDays?.warning);
        const dead = Number(expDays?.dead);
        const allowed = Number(expDays?.allowed);
        const hasDeadRule = !Number.isNaN(dead) && dead >= 0;

        // Ölü süre = SKT'ye kaç gün kala satış biter — bu limit aşılmamalı
        const saleLimitIso = hasDeadRule ? this._addDaysToIsoDate(sktIso, -dead) : sktIso;
        const remainingToLimit = saleLimitIso ? this._daysFromTodayToIso(saleLimitIso) : remainingToSkt;
        const primaryRemaining = hasDeadRule && dead > 0 ? remainingToLimit : remainingToSkt;

        let status = 'ok';
        let statusLabel = 'Satışa uygun';
        let statusHint = '';

        if (remainingToSkt < 0) {
            status = 'expired';
            statusLabel = 'SKT geçmiş';
            statusHint = `SKT ${Math.abs(remainingToSkt)} gün önce doldu — ürün satılamaz.`;
        } else if (hasDeadRule && dead > 0 && remainingToLimit < 0) {
            status = 'dead';
            statusLabel = 'Ölü süreyi aştınız';
            statusHint = `Satış limiti ${Math.abs(remainingToLimit)} gün önce doldu. SKT'ye hâlâ ${remainingToSkt} gün var ama ölü süre (${dead} gün) aşıldı — satış yapılmamalı.`;
        } else if (hasDeadRule && dead > 0 && remainingToLimit === 0) {
            status = 'dead';
            statusLabel = 'Bugün son satış günü';
            statusHint = `Ölü süre limiti bugün doluyor. SKT ${this._formatIsoDateTr(sktIso)} (${remainingToSkt} gün sonra).`;
        } else if (hasDeadRule && dead > 0 && remainingToLimit <= dead) {
            status = 'dead';
            statusLabel = 'Ölü süre içinde';
            statusHint = `Satış limitine ${remainingToLimit} gün kaldı — ölü süre (${dead} gün) eşiğindesiniz, SKT'yi aşmayın.`;
        } else if (!Number.isNaN(warning) && warning > 0 && primaryRemaining <= warning) {
            status = 'warning';
            statusLabel = 'Uyarı';
            statusHint = hasDeadRule && dead > 0
                ? `Satış limitine ${primaryRemaining} gün kaldı — uyarı eşiği (${warning} gün). Ölü süreyi (${dead} gün) aşma.`
                : `SKT'ye ${remainingToSkt} gün kaldı — uyarı eşiğinin (${warning} gün) altında.`;
        } else if (remainingToSkt === 0) {
            status = 'expired';
            statusLabel = 'SKT bugün';
            statusHint = 'SKT bugün doluyor.';
        } else if (hasDeadRule && dead > 0) {
            statusHint = `Satış limitine ${remainingToLimit} gün kaldı. SKT ${this._formatIsoDateTr(sktIso)} — ölü süre ${dead} gün, aşmayın.`;
        } else {
            statusHint = `SKT'ye ${remainingToSkt} gün kaldı.`;
        }

        const warningStartIso = !Number.isNaN(warning) && warning > 0 ? this._addDaysToIsoDate(sktIso, -warning) : null;

        return {
            remaining: primaryRemaining,
            remainingToSkt,
            remainingToLimit,
            status,
            statusLabel,
            statusHint,
            sktTr: this._formatIsoDateTr(sktIso),
            saleLimitIso,
            saleLimitTr: saleLimitIso ? this._formatIsoDateTr(saleLimitIso) : null,
            removeIso: saleLimitIso,
            removeTr: saleLimitIso ? this._formatIsoDateTr(saleLimitIso) : null,
            removeRemaining: remainingToLimit,
            warningStartTr: warningStartIso ? this._formatIsoDateTr(warningStartIso) : null,
            warning,
            dead,
            allowed,
            hasDeadRule,
        };
    }

    _renderSktDateCheckResultHtml(expDays, sktIso) {
        if (!sktIso) {
            return `<p class="pd-skt-check-hint">SKT tarihi seçin — ölü süre limitine göre kalan gün burada görünür.</p>`;
        }

        const analysis = this._analyzeSktDate(expDays, sktIso);
        if (!analysis) {
            return `<p class="pd-skt-check-hint">Geçerli bir tarih seçin.</p>`;
        }

        const primaryAbs = Math.abs(analysis.remaining);
        const useLimit = analysis.hasDeadRule && analysis.dead > 0;
        const remainingLabel =
            analysis.remaining > 0
                ? useLimit
                    ? `Satış limitine ${primaryAbs} gün`
                    : `${primaryAbs} gün kaldı`
                : analysis.remaining < 0
                  ? useLimit
                      ? `Limit ${primaryAbs} gün geçti`
                      : `${primaryAbs} gün geçti`
                  : useLimit
                    ? 'Limit bugün'
                    : 'Bugün';

        const extraLines = [];
        if (analysis.hasDeadRule && analysis.dead > 0 && analysis.saleLimitTr) {
            extraLines.push(
                `<div class="pd-skt-check-meta pd-skt-check-meta--dead"><span>Ölü süre limiti (SKT−${analysis.dead}g)</span><strong>${this.escapeHtml(analysis.saleLimitTr)}</strong></div>`
            );
        }
        extraLines.push(
            `<div class="pd-skt-check-meta"><span>SKT</span><strong>${this.escapeHtml(analysis.sktTr)}${analysis.remainingToSkt != null ? ` · ${analysis.remainingToSkt > 0 ? analysis.remainingToSkt + ' gün sonra' : analysis.remainingToSkt < 0 ? Math.abs(analysis.remainingToSkt) + ' gün geçti' : 'bugün'}` : ''}</strong></div>`
        );
        if (analysis.warningStartTr && analysis.warning > 0) {
            extraLines.push(`<div class="pd-skt-check-meta"><span>Uyarı başlangıcı</span><strong>${this.escapeHtml(analysis.warningStartTr)}</strong></div>`);
        }

        return `
            <div class="pd-skt-check-result-inner pd-skt-check-result--${analysis.status}">
                <div class="pd-skt-check-main">
                    <span class="pd-skt-check-days">${this.escapeHtml(remainingLabel)}</span>
                    <span class="pd-skt-check-badge">${this.escapeHtml(analysis.statusLabel)}</span>
                </div>
                <p class="pd-skt-check-desc">${this.escapeHtml(analysis.statusHint)}</p>
                ${extraLines.length ? `<div class="pd-skt-check-extras">${extraLines.join('')}</div>` : ''}
            </div>`;
    }

    _isoToSegmentValues(iso) {
        const d = this._parseIsoDateParts(iso);
        if (!d) return { day: '', month: '', year: '' };
        return {
            day: String(d.getDate()).padStart(2, '0'),
            month: String(d.getMonth() + 1).padStart(2, '0'),
            year: String(d.getFullYear()),
        };
    }

    _segmentsToIso(dayStr, monthStr, yearStr) {
        const day = Number(dayStr);
        const month = Number(monthStr);
        const year = Number(yearStr);
        if (!day || !month || !year || yearStr.length < 4) return null;
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    _getSktCalViewMonth(productId, selectedIso) {
        const pid = String(productId);
        if (this._productDetailSktCalMonth.has(pid)) return this._productDetailSktCalMonth.get(pid);
        const ref = selectedIso ? this._parseIsoDateParts(selectedIso) : new Date();
        const view = { year: ref.getFullYear(), month: ref.getMonth() + 1 };
        this._productDetailSktCalMonth.set(pid, view);
        return view;
    }

    _renderSktMiniCalendarHtml(productId, year, month, selectedIso) {
        const pid = String(productId);
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const weekdays = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
        const first = new Date(year, month - 1, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        const startOffset = (first.getDay() + 6) % 7;
        const today = this._startOfLocalDay(new Date());
        const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        let cells = '';
        for (let i = 0; i < startOffset; i++) {
            cells += `<span class="pd-skt-cal-cell pd-skt-cal-cell--empty"></span>`;
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const classes = ['pd-skt-cal-cell', 'pd-skt-cal-day'];
            if (iso === todayIso) classes.push('pd-skt-cal-day--today');
            if (iso === selectedIso) classes.push('pd-skt-cal-day--selected');
            cells += `<button type="button" class="${classes.join(' ')}" data-action="skt-cal-pick" data-product-id="${this.escapeHtml(pid)}" data-iso="${iso}">${day}</button>`;
        }

        return `
            <div class="pd-skt-cal" data-skt-calendar="${this.escapeHtml(pid)}">
                <div class="pd-skt-cal-nav">
                    <button type="button" class="pd-skt-cal-nav-btn" data-action="skt-cal-prev" data-product-id="${this.escapeHtml(pid)}" aria-label="Önceki ay">‹</button>
                    <span class="pd-skt-cal-month">${this.escapeHtml(monthNames[month - 1] || '')} ${year}</span>
                    <button type="button" class="pd-skt-cal-nav-btn" data-action="skt-cal-next" data-product-id="${this.escapeHtml(pid)}" aria-label="Sonraki ay">›</button>
                </div>
                <div class="pd-skt-cal-weekdays">${weekdays.map((w) => `<span>${w}</span>`).join('')}</div>
                <div class="pd-skt-cal-grid">${cells}</div>
            </div>`;
    }

    _renderSktDateQuickChips(expDays) {
        const chips = [];
        const add = (days, label) => {
            const n = Number(days);
            if (!n || Number.isNaN(n) || n <= 0) return;
            chips.push({ days: n, label });
        };
        add(expDays?.dead, `Ölü limit +${expDays.dead}g`);
        add(expDays?.warning, `+${expDays.warning}g uyarı`);
        add(expDays?.allowed, `+${expDays.allowed}g satış`);
        add(30, '+30 gün');
        add(90, '+90 gün');
        add(180, '+180 gün');

        const seen = new Set();
        const unique = chips.filter((c) => {
            if (seen.has(c.days)) return false;
            seen.add(c.days);
            return true;
        });

        if (!unique.length) return '';

        return `<div class="pd-skt-quick">${unique
            .slice(0, 5)
            .map(
                (c) =>
                    `<button type="button" class="pd-skt-quick-chip" data-action="skt-quick-days" data-days="${c.days}">${this.escapeHtml(c.label)}</button>`
            )
            .join('')}</div>`;
    }

    _setProductDetailSktDate(content, productId, expDays, iso, options = {}) {
        const pid = String(productId);
        const picker = content.querySelector(`.pd-skt-date-picker[data-product-id="${pid}"]`);
        if (!picker) return;

        if (iso) this._productDetailSktCheckDates.set(pid, iso);
        else this._productDetailSktCheckDates.delete(pid);

        const segs = this._isoToSegmentValues(iso || '');
        picker.querySelectorAll('[data-skt-part]').forEach((el) => {
            const part = el.getAttribute('data-skt-part');
            if (part === 'day') el.value = segs.day;
            if (part === 'month') el.value = segs.month;
            if (part === 'year') el.value = segs.year;
        });

        const clearBtn = picker.querySelector('[data-action="skt-date-clear"]');
        if (clearBtn) clearBtn.classList.toggle('hidden', !iso);

        const calWrap = picker.querySelector('[data-skt-cal-wrap]');
        const isOpen = options.forceCalOpen != null ? options.forceCalOpen : this._productDetailSktCalOpen.has(pid);
        if (options.forceCalOpen != null) {
            if (options.forceCalOpen) this._productDetailSktCalOpen.add(pid);
            else this._productDetailSktCalOpen.delete(pid);
        }
        if (calWrap) {
            calWrap.classList.toggle('hidden', !isOpen);
            if (isOpen && iso) {
                const d = this._parseIsoDateParts(iso);
                if (d) this._productDetailSktCalMonth.set(pid, { year: d.getFullYear(), month: d.getMonth() + 1 });
            }
            const view = this._getSktCalViewMonth(pid, iso);
            calWrap.innerHTML = this._renderSktMiniCalendarHtml(pid, view.year, view.month, iso || '');
        }

        const toggleBtn = picker.querySelector('[data-action="toggle-skt-cal"]');
        if (toggleBtn) toggleBtn.classList.toggle('is-active', isOpen);

        const resultEl = content.querySelector(`[data-skt-result="${pid}"]`);
        if (resultEl) {
            resultEl.innerHTML = iso
                ? this._renderSktDateCheckResultHtml(expDays, iso)
                : this._renderSktDateCheckResultHtml(expDays, null);
        }
    }

    _renderProductDetailSktDateChecker(expDays, productId) {
        if (!expDays || typeof expDays !== 'object') return '';

        const pid = String(productId);
        const saved = this._productDetailSktCheckDates.get(pid) || '';
        const segs = this._isoToSegmentValues(saved);
        const calOpen = this._productDetailSktCalOpen.has(pid);
        const view = this._getSktCalViewMonth(pid, saved);
        const resultHtml = saved
            ? this._renderSktDateCheckResultHtml(expDays, saved)
            : this._renderSktDateCheckResultHtml(expDays, null);

        return `
            <div class="pd-skt-check">
                <div class="pd-skt-check-head">
                    <span class="pd-skt-check-title">SKT tarihi kontrol</span>
                    <span class="pd-skt-check-sub">Ölü süre limitine göre — SKT'yi aşma</span>
                </div>
                <div class="pd-skt-date-picker" data-product-id="${this.escapeHtml(pid)}">
                    <div class="pd-skt-date-row">
                        <div class="pd-skt-date-segments" role="group" aria-label="SKT tarihi">
                            <input type="text" inputmode="numeric" maxlength="2" placeholder="GG" class="pd-skt-date-seg" data-skt-part="day" data-product-id="${this.escapeHtml(pid)}" value="${this.escapeHtml(segs.day)}" aria-label="Gün">
                            <span class="pd-skt-date-sep">·</span>
                            <input type="text" inputmode="numeric" maxlength="2" placeholder="AA" class="pd-skt-date-seg" data-skt-part="month" data-product-id="${this.escapeHtml(pid)}" value="${this.escapeHtml(segs.month)}" aria-label="Ay">
                            <span class="pd-skt-date-sep">·</span>
                            <input type="text" inputmode="numeric" maxlength="4" placeholder="YYYY" class="pd-skt-date-seg pd-skt-date-seg--year" data-skt-part="year" data-product-id="${this.escapeHtml(pid)}" value="${this.escapeHtml(segs.year)}" aria-label="Yıl">
                        </div>
                        <button type="button" class="pd-skt-date-cal-btn${calOpen ? ' is-active' : ''}" data-action="toggle-skt-cal" data-product-id="${this.escapeHtml(pid)}" aria-label="Takvimi aç">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                        </button>
                        <button type="button" class="pd-skt-date-clear${saved ? '' : ' hidden'}" data-action="skt-date-clear" data-product-id="${this.escapeHtml(pid)}" aria-label="Tarihi temizle">×</button>
                    </div>
                    ${this._renderSktDateQuickChips(expDays)}
                    <div class="pd-skt-cal-wrap${calOpen ? '' : ' hidden'}" data-skt-cal-wrap="${this.escapeHtml(pid)}">${calOpen ? this._renderSktMiniCalendarHtml(pid, view.year, view.month, saved) : ''}</div>
                </div>
                <div class="pd-skt-check-result" data-skt-result="${this.escapeHtml(pid)}">${resultHtml}</div>
            </div>`;
    }

    _bindProductDetailSktDateChecker(content, productId, expDays) {
        if (!content || !expDays) return;

        const pid = String(productId);
        const picker = content.querySelector(`.pd-skt-date-picker[data-product-id="${pid}"]`);
        if (!picker) return;

        const readSegmentsAndApply = () => {
            const day = picker.querySelector('[data-skt-part="day"]')?.value || '';
            const month = picker.querySelector('[data-skt-part="month"]')?.value || '';
            const year = picker.querySelector('[data-skt-part="year"]')?.value || '';
            if (!day && !month && !year) {
                this._setProductDetailSktDate(content, pid, expDays, null);
                return;
            }
            const iso = this._segmentsToIso(day, month, year);
            if (iso) this._setProductDetailSktDate(content, pid, expDays, iso);
        };

        picker.querySelectorAll('[data-skt-part]').forEach((input, idx, arr) => {
            input.addEventListener('input', () => {
                input.value = input.value.replace(/\D/g, '').slice(0, input.maxLength);
                const max = Number(input.maxLength);
                if (input.value.length >= max && idx < arr.length - 1) arr[idx + 1].focus();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    readSegmentsAndApply();
                }
            });
            input.addEventListener('blur', readSegmentsAndApply);
        });

        picker.addEventListener('click', (e) => {
            const t = e.target.closest('[data-action]');
            if (!t) return;

            const action = t.getAttribute('data-action');
            if (action === 'toggle-skt-cal') {
                e.stopPropagation();
                const open = !this._productDetailSktCalOpen.has(pid);
                this._setProductDetailSktDate(content, pid, expDays, this._productDetailSktCheckDates.get(pid) || null, {
                    forceCalOpen: open,
                });
            } else if (action === 'skt-date-clear') {
                e.stopPropagation();
                this._productDetailSktCalOpen.delete(pid);
                this._setProductDetailSktDate(content, pid, expDays, null, { forceCalOpen: false });
            } else if (action === 'skt-quick-days') {
                e.stopPropagation();
                const days = Number(t.getAttribute('data-days'));
                if (!days) return;
                const today = this._startOfLocalDay(new Date());
                const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const iso = this._addDaysToIsoDate(todayIso, days);
                this._setProductDetailSktDate(content, pid, expDays, iso, { forceCalOpen: true });
            } else if (action === 'skt-cal-pick') {
                e.stopPropagation();
                this._setProductDetailSktDate(content, pid, expDays, t.getAttribute('data-iso'), { forceCalOpen: true });
            } else if (action === 'skt-cal-prev') {
                e.stopPropagation();
                const view = this._getSktCalViewMonth(pid, this._productDetailSktCheckDates.get(pid));
                let m = view.month - 1;
                let y = view.year;
                if (m < 1) { m = 12; y -= 1; }
                this._productDetailSktCalMonth.set(pid, { year: y, month: m });
                this._setProductDetailSktDate(content, pid, expDays, this._productDetailSktCheckDates.get(pid) || null, { forceCalOpen: true });
            } else if (action === 'skt-cal-next') {
                e.stopPropagation();
                const view = this._getSktCalViewMonth(pid, this._productDetailSktCheckDates.get(pid));
                let m = view.month + 1;
                let y = view.year;
                if (m > 12) { m = 1; y += 1; }
                this._productDetailSktCalMonth.set(pid, { year: y, month: m });
                this._setProductDetailSktDate(content, pid, expDays, this._productDetailSktCheckDates.get(pid) || null, { forceCalOpen: true });
            }
        });
    }

    _parseTrDateParts(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const parts = dateStr.trim().split('.');
        if (parts.length !== 3) return null;
        const day = Number(parts[0]);
        const month = Number(parts[1]);
        const year = Number(parts[2]);
        if (!day || !month || !year) return null;
        return new Date(year, month - 1, day);
    }

    _daysBetweenTrDates(laterStr, earlierStr) {
        const later = this._parseTrDateParts(laterStr);
        const earlier = this._parseTrDateParts(earlierStr);
        if (!later || !earlier) return null;
        return Math.round((later.getTime() - earlier.getTime()) / 86400000);
    }

    _getProductDetailSktEntries(productId) {
        const pid = String(productId);
        if (this._productDetailExpiryCache.has(pid)) {
            return this._productDetailExpiryCache.get(pid) || [];
        }
        const fromGuide = this._getFinancePasteGuideSktEntries(pid);
        if (fromGuide.length) return fromGuide;
        return [];
    }

    _mergeProductDetailExpiryEntries(entries) {
        const map = new Map();
        (entries || []).forEach((entry) => {
            if (!entry?.date) return;
            const key = `${entry.date}|${entry.removeDate || ''}`;
            const prev = map.get(key);
            if (prev) prev.qty += Number(entry.qty) || 0;
            else map.set(key, { date: entry.date, qty: Number(entry.qty) || 0, removeDate: entry.removeDate || null });
        });
        return [...map.values()].sort((a, b) => {
            const da = this._parseTrDateParts(a.date);
            const db = this._parseTrDateParts(b.date);
            if (!da || !db) return 0;
            return da - db;
        });
    }

    _pickLocalizedName(value) {
        if (value == null) return '';
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'object') {
            return (value.tr || value.en || value.name || '').toString().trim();
        }
        return String(value);
    }

    _formatProductDetailScalar(value) {
        if (value == null || value === '') return '';
        if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
        if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'object') {
            const localized = this._pickLocalizedName(value);
            if (localized) return localized;
            try {
                return JSON.stringify(value);
            } catch (e) {
                return String(value);
            }
        }
        return String(value);
    }

    _collectDeepApiProductFields(root, maxDepth = 5) {
        const found = new Map();
        const keyRe = /(shelf|life|expir|storage|temperature|vat|weight|unit|remove|omur|raf|skt|duration|day|sap)/i;
        const skipKeys = new Set(['history', 'tokenExpiry', 'timestamp', 'updatedAt', 'createdAt', 'lastUpdated']);

        const walk = (obj, depth) => {
            if (!obj || depth > maxDepth || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach((item) => walk(item, depth + 1));
                return;
            }
            Object.entries(obj).forEach(([key, value]) => {
                if (skipKeys.has(key)) return;
                if (value == null || typeof value === 'function') return;
                if (keyRe.test(key)) {
                    const scalar = this._formatProductDetailScalar(value);
                    if (scalar && scalar !== '—') {
                        const label = COUNTING_PRODUCT_DETAIL_API_FIELD_LABELS[key] || key;
                        if (!found.has(key)) found.set(key, { id: `api_${key}`, label, value: scalar });
                    }
                }
                if (typeof value === 'object') walk(value, depth + 1);
            });
        };

        walk(root, 0);
        return [...found.values()];
    }

    _formatVatRate(vat) {
        if (vat == null || vat === '') return '';
        const n = Number(vat);
        if (Number.isNaN(n)) return String(vat);
        const pct = n <= 1 ? n * 100 : n;
        return `%${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1).replace(/\.0$/, '')}`;
    }

    _calcDiscountPercent(price, struckPrice) {
        const p = Number(price);
        const s = Number(struckPrice);
        if (!p || !s || s <= p) return null;
        return Math.round(((s - p) / s) * 100);
    }

    _formatUnitPriceLine(apiRow) {
        if (!apiRow) return '';
        const props = apiRow.unitPriceProperties;
        const unitPrice = apiRow.unitPrice;
        if (unitPrice == null) return '';
        const priceText = apiRow.unitPriceText || this.formatCurrency(Number(unitPrice));
        if (props && props.unit) {
            const qty = props.quantity != null ? props.quantity : '';
            const unit = props.unit;
            const per = props.perUnit != null ? props.perUnit : 1;
            const qtyPart = qty ? ` (${qty} ${unit})` : '';
            return `${priceText} / ${per > 1 ? per + ' ' : ''}${unit}${qtyPart}`;
        }
        return priceText;
    }

    _buildCategoryBreadcrumb(apiRow) {
        if (!apiRow) return [];
        const items = [];
        const push = (obj) => {
            const name = this._pickLocalizedName(obj?.name || obj);
            if (name) items.push(name);
        };
        push(apiRow.masterCategoryV2);
        push(apiRow.category);
        push(apiRow.level3);
        push(apiRow.level4);
        push(apiRow.subCategory);
        return [...new Set(items)];
    }

    _buildPackagingCards(packagingInfo) {
        if (!packagingInfo || typeof packagingInfo !== 'object') return [];
        return Object.keys(packagingInfo)
            .filter((key) => key !== 'pickingType')
            .map((key) => {
                const pkg = packagingInfo[key];
                if (!pkg) return null;
                const codes = Array.isArray(pkg.barcodes) ? pkg.barcodes.filter(Boolean) : [];
                if (!codes.length) return null;
                return { type: key, barcodes: codes, pickingType: packagingInfo.pickingType };
            })
            .filter(Boolean);
    }

    _buildProductDetailViewModel(productId) {
        const product = this.productIndex.get(productId);
        if (!product) return null;

        const data = this.countingData[productId] || {};
        const apiRow = this._apiProductRowCache.get(String(productId)) || null;
        const sktEntries = this._mergeProductDetailExpiryEntries(this._getProductDetailSktEntries(productId));
        const expiryError = this._productDetailExpiryErrors.get(String(productId)) || null;
        const diff = this.calculateDifference(data.warehouseStock, data.systemStock);

        const price = apiRow?.price ?? data.price;
        const struckPrice = apiRow?.struckPrice ?? data.struckPrice;
        const priceText = apiRow?.priceText || data.priceText || (price != null ? this.formatCurrency(Number(price)) : '');
        const struckPriceText = apiRow?.struckPriceText || data.struckPriceText || (struckPrice != null ? this.formatCurrency(Number(struckPrice)) : '');
        const priceNum = Number(price);
        const struckNum = Number(struckPrice);
        const hasDiscount =
            !Number.isNaN(priceNum) && !Number.isNaN(struckNum) && struckNum > priceNum + 0.001;
        const discountPct = hasDiscount ? this._calcDiscountPercent(price, struckPrice) : null;

        const richDescription =
            (product.description && String(product.description).trim()) ||
            this._pickLocalizedName(apiRow?.ingredients) ||
            null;

        const barcodeLines = (product.barcodes || [])
            .map((b) => {
                if (!b?.code) return '';
                const extras = [b.size, b.variant, b.type].filter(Boolean).join(' · ');
                return extras ? `${b.code} (${extras})` : String(b.code);
            })
            .filter(Boolean);

        const packagingCards = this._buildPackagingCards(apiRow?.packagingInfo);

        let stockDiffText = '—';
        if (diff.type === 'zero') stockDiffText = 'Eşit';
        else if (diff.type === 'positive') stockDiffText = `+${diff.value} fazla`;
        else if (diff.type === 'negative') stockDiffText = `−${diff.value} eksik`;

        const totalStock =
            data.systemStock != null && data.reservedStock != null
                ? Number(data.systemStock) + Number(data.reservedStock)
                : data.systemStock != null
                  ? Number(data.systemStock)
                  : null;

        const infoRows = [
            { id: 'product_id', label: 'Ürün ID', value: product.id, group: 'urun' },
            {
                id: 'description',
                label: 'Açıklama',
                value: richDescription,
                isRichHtml: true,
                group: 'urun',
            },
            { id: 'short_desc', label: 'Paket / gramaj', value: this._pickLocalizedName(apiRow?.shortDescription), group: 'urun' },
            { id: 'brand', label: 'Marka', value: product.brand || apiRow?.brandName, group: 'urun' },
            { id: 'category_path', label: 'Kategori yolu', value: this._buildCategoryBreadcrumb(apiRow).join(' › '), group: 'urun' },
            { id: 'shelf', label: 'Raf', value: product.shelf && product.shelf !== '-' ? product.shelf : null, group: 'urun' },
            { id: 'storage_type', label: 'Depolama', value: apiRow?.storageType, group: 'urun' },
            {
                id: 'return_policy',
                label: 'İade politikası',
                value: apiRow?.returnPolicy
                    ? apiRow.returnPolicy.isReturnable
                        ? `İade edilebilir · ${apiRow.returnPolicy.returnPeriodDays || '?'} gün`
                        : 'İade edilemez'
                    : null,
                group: 'urun',
            },
            {
                id: 'barcodes',
                label: 'Katalog barkodları',
                value: barcodeLines.length ? barcodeLines.join('<br>') : null,
                isHtml: true,
                group: 'barkod',
            },
            { id: 'sap', label: 'SAP kodu', value: apiRow?.sapReferenceCode, group: 'teknik' },
            { id: 'warehouse', label: 'Depo ID', value: apiRow?.warehouse, group: 'teknik' },
            { id: 'price_type', label: 'Fiyat tipi', value: apiRow?.priceTypeText || (apiRow?.priceType != null ? String(apiRow.priceType) : null), group: 'teknik' },
            { id: 'manufacturer', label: 'Üretici ID', value: apiRow?.manufacturer, group: 'teknik' },
            {
                id: 'suppliers',
                label: 'Tedarikçi sayısı',
                value: Array.isArray(apiRow?.suppliers) ? String(apiRow.suppliers.length) : null,
                group: 'teknik',
            },
            {
                id: 'last_updated',
                label: 'Son sayım güncellemesi',
                value: data.lastUpdated
                    ? this.formatAbsoluteDateTimeTr(new Date(data.lastUpdated).getTime()) || String(data.lastUpdated)
                    : null,
                group: 'teknik',
            },
        ];

        const visibleInfoRows = infoRows.filter((row) => {
            if (this._productDetailHiddenFields.has(row.id)) return false;
            const v = row.value;
            return v != null && v !== '' && v !== '—';
        });

        const flags = [];
        if (apiRow) {
            const flagDefs = [
                { key: 'isVisible', label: 'Görünür', positive: true },
                { key: 'isShowOutOfStock', label: 'Stokta yok göster', positive: true },
                { key: 'isShownUnderSpecialOffers', label: 'Kampanyada', positive: true },
                { key: 'isSensitive', label: 'Hassas ürün', positive: false },
                { key: 'isAgeRestricted', label: 'Yaş sınırlı', positive: false },
                { key: 'isBundle', label: 'Paket ürün', positive: true },
            ];
            flagDefs.forEach(({ key, label, positive }) => {
                if (apiRow[key] === true) flags.push({ label, tone: positive ? 'ok' : 'warn' });
                else if (apiRow[key] === false && (key === 'isVisible' || key === 'isShowOutOfStock')) {
                    flags.push({ label: `${label} (kapalı)`, tone: 'off' });
                }
            });
            if (apiRow.status != null) {
                flags.push({ label: `Durum: ${apiRow.status}`, tone: apiRow.status === 1 ? 'ok' : 'neutral' });
            }
        }

        return {
            productId,
            product,
            data,
            apiRow,
            sktEntries,
            expiryError,
            isLoading:
                this._productDetailLoading &&
                !this._productDetailExpiryFetched.has(String(productId)) &&
                !apiRow,
            isApiLoading: this._productDetailLoading && !apiRow,
            hero: {
                name: this._pickLocalizedName(apiRow?.fullName || apiRow?.displayName || apiRow?.name) || product.name,
                shortName: this._pickLocalizedName(apiRow?.shortName),
                shortDesc: this._pickLocalizedName(apiRow?.shortDescription),
                image:
                    this._pickLocalizedName(apiRow?.picURL || apiRow?.squareThumbnailURL) ||
                    product.image ||
                    '../assets/logo.png',
                storageType: apiRow?.storageType || null,
            },
            price: {
                price,
                priceText,
                struckPrice,
                struckPriceText,
                hasDiscount,
                discountPct,
                wholesalePriceText: apiRow?.wholesalePriceText || (apiRow?.wholesalePrice != null ? this.formatCurrency(Number(apiRow.wholesalePrice)) : null),
                unitPriceLine: this._formatUnitPriceLine(apiRow),
                vatText: apiRow?.vat != null ? this._formatVatRate(apiRow.vat) : null,
                currency: apiRow?.currency?.symbol || '₺',
            },
            stock: {
                available: apiRow?.available,
                reserve: apiRow?.reserve ?? data.reservedStock,
                systemStock: data.systemStock,
                warehouseStock: data.warehouseStock,
                totalStock,
                stockDiffText,
                diffType: diff.type,
            },
            expDays: apiRow?.expDays || null,
            categoryBreadcrumb: this._buildCategoryBreadcrumb(apiRow),
            packagingCards,
            flags,
            infoGroups: [
                { key: 'urun', sectionId: 'section_group_urun', title: 'Ürün & kategori', tone: 'genel', rows: visibleInfoRows.filter((r) => r.group === 'urun') },
                { key: 'barkod', sectionId: 'section_group_barkod', title: 'Barkodlar', tone: 'genel', rows: visibleInfoRows.filter((r) => r.group === 'barkod') },
                { key: 'teknik', sectionId: 'section_group_teknik', title: 'Teknik', tone: 'teknik', rows: visibleInfoRows.filter((r) => r.group === 'teknik') },
            ].filter((g) => g.rows.length > 0 && !this._isProductDetailHidden(g.sectionId)),
        };
    }

    _buildProductDetailSktHtml(sktEntries, expiryError, isLoading) {
        if (isLoading) {
            return `<div class="product-detail-loading"><span class="product-detail-loading-dot"></span> SKT ve raf ömrü verisi alınıyor…</div>`;
        }
        if (!sktEntries.length) {
            const hint = expiryError
                ? this.escapeHtml(expiryError)
                : 'Warehouse sekmesi açıkken yenile butonuna basın veya stok güncellemesi yapın.';
            return `<p class="product-detail-value product-detail-value-muted px-1 py-1">${hint}</p>`;
        }

        let sktHtml = '';
        let removalHtml = '';
        let lifeHtml = '';

        sktEntries.forEach((e) => {
            sktHtml += `<span class="product-detail-chip product-detail-chip--skt">${this.escapeHtml(String(e.qty))} ad · SKT ${this.escapeHtml(e.date)}</span>`;
            if (e.removeDate) {
                removalHtml += `<span class="product-detail-chip product-detail-chip--removal">${this.escapeHtml(String(e.qty))} ad · Çıkış ${this.escapeHtml(e.removeDate)}</span>`;
                const days = this._daysBetweenTrDates(e.date, e.removeDate);
                if (days != null) {
                    lifeHtml += `<span class="product-detail-chip product-detail-chip--life">${this.escapeHtml(String(e.qty))} ad · SKT'den ${days} gün önce (${this.escapeHtml(e.removeDate)})</span>`;
                }
            }
        });

        const parts = [];
        if (sktHtml) parts.push(`<div class="mb-1.5"><div class="product-detail-label mb-1">SKT dağılımı</div><div>${sktHtml}</div></div>`);
        if (removalHtml) parts.push(`<div class="mb-1.5"><div class="product-detail-label mb-1">Satıştan kaldırma</div><div>${removalHtml}</div></div>`);
        if (lifeHtml) parts.push(`<div><div class="product-detail-label mb-1">Raf ömrü / çıkış farkı</div><div>${lifeHtml}</div></div>`);
        return parts.join('');
    }

    _renderProductDetailHero(vm) {
        if (this._isProductDetailHidden('section_hero')) return '';

        const h = vm.hero;
        const stock = vm.stock;
        const price = vm.price;
        const badges = [];

        if (stock.available != null) {
            badges.push(`<span class="pd-badge pd-badge--stock">${this.escapeHtml(String(stock.available))} stok</span>`);
        }
        if (stock.reserve != null && Number(stock.reserve) > 0) {
            badges.push(`<span class="pd-badge pd-badge--reserve">${this.escapeHtml(String(stock.reserve))} rezerve</span>`);
        }
        if (price.hasDiscount && price.discountPct) {
            badges.push(`<span class="pd-badge pd-badge--sale">−%${price.discountPct}</span>`);
        }
        if (h.storageType) {
            badges.push(`<span class="pd-badge pd-badge--cold">${this.escapeHtml(h.storageType)}</span>`);
        }

        const metaParts = [h.shortDesc].filter(Boolean);
        const subtitle = metaParts.length ? `<p class="pd-hero-meta">${this.escapeHtml(metaParts.join(' · '))}</p>` : '';

        const loadingClass = vm.isApiLoading ? ' pd-hero--loading' : '';

        return `
            <div class="pd-hero${loadingClass}">
                <button type="button" class="pd-hero-image-wrap" data-action="open-image" title="Görseli büyüt">
                    <img src="${this.escapeHtml(h.image)}" alt="" class="pd-hero-image" loading="lazy" onerror="this.src='../assets/logo.png'">
                </button>
                <div class="pd-hero-body">
                    <div class="flex items-start gap-1">
                        <div class="min-w-0 flex-1">
                            <h6 class="pd-hero-title">${this.escapeHtml(h.name)}</h6>
                            ${h.shortName && h.shortName !== h.name ? `<p class="pd-hero-sub">${this.escapeHtml(h.shortName)}</p>` : ''}
                            ${subtitle}
                        </div>
                        ${this._renderProductDetailHideBtn('section_hero')}
                    </div>
                    ${badges.length ? `<div class="pd-hero-badges">${badges.join('')}</div>` : ''}
                </div>
            </div>`;
    }

    _renderProductDetailPriceBlock(vm) {
        if (this._isProductDetailHidden('section_price')) return '';

        const p = vm.price;
        if (!p.priceText && p.wholesalePriceText == null && !p.unitPriceLine) return '';

        const priceLines = [];
        if (p.hasDiscount) {
            priceLines.push(`
                <div class="pd-price-line">
                    <span class="pd-price-line-label">İndirimli fiyat</span>
                    <span class="pd-price-line-value pd-price-line-value--sale">${this.escapeHtml(p.priceText || '')}</span>
                </div>
                <div class="pd-price-line">
                    <span class="pd-price-line-label">Liste fiyatı</span>
                    <span class="pd-price-line-value pd-price-line-value--list">${this.escapeHtml(p.struckPriceText || '')}</span>
                </div>`);
            if (p.discountPct) {
                priceLines.push(`
                <div class="pd-price-line">
                    <span class="pd-price-line-label">İndirim</span>
                    <span class="pd-price-line-value" style="color:rgb(220 38 38);font-size:0.9375rem">−%${p.discountPct}</span>
                </div>`);
            }
        } else if (p.priceText) {
            priceLines.push(`
                <div class="pd-price-line">
                    <span class="pd-price-line-label">Satış fiyatı</span>
                    <span class="pd-price-line-value pd-price-line-value--sale" style="color:rgb(180 83 9)">${this.escapeHtml(p.priceText)}</span>
                </div>`);
            if (p.struckPriceText && p.struckPriceText !== p.priceText) {
                priceLines.push(`
                <div class="pd-price-line">
                    <span class="pd-price-line-label">Liste fiyatı</span>
                    <span class="pd-price-line-value pd-price-line-value--list">${this.escapeHtml(p.struckPriceText)}</span>
                </div>`);
            }
        }

        const extras = [];
        if (p.unitPriceLine) extras.push({ label: 'Birim fiyat', value: p.unitPriceLine });
        if (p.wholesalePriceText) extras.push({ label: 'Toptan', value: p.wholesalePriceText });
        if (p.vatText) extras.push({ label: 'KDV', value: p.vatText });

        const extrasHtml = extras.length
            ? `<div class="pd-price-extras">${extras
                  .map(
                      (e) =>
                          `<div class="pd-price-extra"><span class="pd-price-extra-label">${this.escapeHtml(e.label)}</span><span class="pd-price-extra-value">${this.escapeHtml(e.value)}</span></div>`
                  )
                  .join('')}</div>`
            : '';

        return `
            <section class="pd-price-card">
                <div class="pd-price-card-head">
                    <span class="pd-price-card-head-title">Fiyat</span>
                    ${this._renderProductDetailHideBtn('section_price')}
                </div>
                <div class="pd-price-labeled">${priceLines.join('')}</div>
                ${extrasHtml}
            </section>`;
    }

    _renderProductDetailStockGrid(vm) {
        if (this._isProductDetailHidden('section_stock')) return '';

        const s = vm.stock;
        const cells = [];

        if (s.available != null) {
            cells.push({ label: 'Mevcut (API)', value: String(s.available), tone: 'emerald' });
        }
        if (s.reserve != null) {
            cells.push({ label: 'Rezerve', value: String(s.reserve), tone: 'amber' });
        }
        if (s.systemStock != null) {
            cells.push({ label: 'Sistem', value: String(s.systemStock), tone: 'sky' });
        }
        if (s.warehouseStock != null) {
            cells.push({ label: 'Depo sayım', value: String(s.warehouseStock), tone: 'violet' });
        }
        if (s.stockDiffText && s.stockDiffText !== '—') {
            const tone = s.diffType === 'positive' ? 'rose' : s.diffType === 'negative' ? 'orange' : 'slate';
            cells.push({ label: 'Fark', value: s.stockDiffText, tone });
        }

        if (!cells.length) return '';

        return `
            <section class="product-detail-group product-detail-group--stok">
                <div class="product-detail-group-head">
                    <span>Stok durumu</span>
                    ${this._renderProductDetailHideBtn('section_stock')}
                </div>
                <div class="product-detail-group-body">
                    <div class="pd-stat-grid">${cells
                        .map(
                            (c) =>
                                `<div class="pd-stat pd-stat--${c.tone}"><span class="pd-stat-label">${this.escapeHtml(c.label)}</span><span class="pd-stat-value">${this.escapeHtml(c.value)}</span></div>`
                        )
                        .join('')}</div>
                </div>
            </section>`;
    }

    _renderProductDetailExpDays(expDays, productId) {
        if (!expDays || typeof expDays !== 'object') return '';

        const lifetime = Number(expDays.lifetime);
        const allowed = Number(expDays.allowed);
        const warning = Number(expDays.warning);
        const dead = Number(expDays.dead);

        const metrics = [
            { key: 'lifetime', label: 'Toplam raf ömrü', value: lifetime, unit: 'gün', tone: 'blue' },
            { key: 'allowed', label: 'Satış süresi', value: allowed, unit: 'gün', tone: 'emerald' },
            { key: 'warning', label: 'Uyarı eşiği', value: warning, unit: 'gün', tone: 'amber' },
            { key: 'dead', label: 'Ölü süre (SKT)', value: dead, unit: 'gün', tone: 'rose' },
        ].filter((m) => !Number.isNaN(m.value));

        if (!metrics.length) return '';

        let barHtml = '';
        if (!Number.isNaN(lifetime) && lifetime > 0) {
            const seg = (val, cls) => {
                const w = Math.max(0, Math.min(100, (val / lifetime) * 100));
                return w > 0 ? `<span class="pd-exp-bar-seg ${cls}" style="width:${w}%"></span>` : '';
            };
            barHtml = `
                <div class="pd-exp-bar" title="Toplam ${lifetime} gün">
                    ${seg(allowed, 'pd-exp-bar-seg--allowed')}
                    ${seg(warning, 'pd-exp-bar-seg--warning')}
                    ${seg(dead, 'pd-exp-bar-seg--dead')}
                </div>
                <div class="pd-exp-bar-legend">
                    <span><i class="pd-exp-dot pd-exp-dot--allowed"></i>Satış</span>
                    <span><i class="pd-exp-dot pd-exp-dot--warning"></i>Uyarı</span>
                    <span><i class="pd-exp-dot pd-exp-dot--dead"></i>Ölü süre</span>
                </div>`;
        }

        const dateCheckerHtml = productId ? this._renderProductDetailSktDateChecker(expDays, productId) : '';

        return `
            <div class="pd-exp-days">
                <div class="pd-exp-metrics">${metrics
                    .map(
                        (m) =>
                            `<div class="pd-exp-metric pd-exp-metric--${m.tone}"><span class="pd-exp-metric-value">${this.escapeHtml(String(m.value))}</span><span class="pd-exp-metric-unit">${this.escapeHtml(m.unit)}</span><span class="pd-exp-metric-label">${this.escapeHtml(m.label)}</span></div>`
                    )
                    .join('')}</div>
                ${barHtml}
            </div>
            ${dateCheckerHtml}`;
    }

    _renderProductDetailPackaging(cards) {
        if (!cards?.length) return '';
        return `
            <div class="pd-packaging-grid">${cards
                .map(
                    (c) =>
                        `<div class="pd-packaging-card"><span class="pd-packaging-type">Ambalaj ${this.escapeHtml(c.type)}</span>${c.barcodes
                            .map((b) => `<code class="pd-packaging-code">${this.escapeHtml(String(b))}</code>`)
                            .join('')}</div>`
                )
                .join('')}</div>`;
    }

    _renderProductDetailFlags(flags) {
        if (!flags?.length) return '';
        return `<div class="pd-flags">${flags
            .map((f) => `<span class="pd-flag pd-flag--${f.tone}">${this.escapeHtml(f.label)}</span>`)
            .join('')}</div>`;
    }

    _renderProductDetailCategoryPath(items) {
        if (this._isProductDetailHidden('section_category') || !items?.length) return '';
        return `<div class="pd-category-wrap">
            <nav class="pd-category-path" aria-label="Kategori">${items
                .map((item, i) => {
                    const sep = i > 0 ? `<span class="pd-category-sep">›</span>` : '';
                    return `${sep}<span class="pd-category-crumb">${this.escapeHtml(item)}</span>`;
                })
                .join('')}</nav>
            ${this._renderProductDetailHideBtn('section_category')}
        </div>`;
    }

    _buildProductDetailFieldRows(productId) {
        const vm = this._buildProductDetailViewModel(productId);
        if (!vm) return { groups: [], vm: null };
        return { groups: vm.infoGroups, vm };
    }

    _renderProductDetailFieldRow(row) {
        let valueHtml;
        let valueClass = 'product-detail-value';
        if (row.isRichHtml) {
            valueHtml = this._formatRichDescription(row.value);
            valueClass += ' product-detail-value--rich';
        } else if (row.isHtml) {
            valueHtml = row.value;
        } else {
            valueHtml = this.escapeHtml(String(row.value));
        }
        return `
            <div class="product-detail-card" data-field-id="${this.escapeHtml(row.id)}">
                <div class="flex items-center justify-between gap-2">
                    <span class="product-detail-label">${this.escapeHtml(row.label)}</span>
                    ${this._renderProductDetailHideBtn(row.id, row.label)}
                </div>
                <div class="${valueClass}">${valueHtml}</div>
            </div>`;
    }

    _renderProductDetailGroupsHtml(groups) {
        return groups
            .map(
                (group) => `
                    <section class="product-detail-group product-detail-group--${group.tone}">
                        <div class="product-detail-group-head">
                            <span>${this.escapeHtml(group.title)}</span>
                            ${this._renderProductDetailHideBtn(group.sectionId || `section_group_${group.key}`, group.title)}
                        </div>
                        <div class="product-detail-group-body">${(group.rows || []).map((row) => this._renderProductDetailFieldRow(row)).join('')}</div>
                    </section>`
            )
            .join('');
    }

    renderProductDetailPanel(productId) {
        const content = document.getElementById('countingProductDetailContent');
        const subtitle = document.getElementById('countingProductDetailSubtitle');
        if (!content) return;

        const { groups, vm } = this._buildProductDetailFieldRows(productId);
        if (!vm) {
            content.innerHTML = `<p class="py-6 text-center text-sm text-slate-500">Ürün bulunamadı.</p>`;
            return;
        }

        if (subtitle) subtitle.textContent = vm.hero.name || '';

        this._renderProductDetailHiddenChips();

        const sktHtml = this._buildProductDetailSktHtml(
            vm.sktEntries,
            vm.expiryError,
            vm.isLoading && !this._productDetailExpiryFetched.has(String(productId))
        );
        const expDaysHtml = vm.expDays
            ? this._renderProductDetailExpDays(vm.expDays, productId)
            : vm.isApiLoading
              ? '<div class="product-detail-loading"><span class="product-detail-loading-dot"></span> Getir API verisi alınıyor…</div>'
              : '';
        const packagingHtml = this._renderProductDetailPackaging(vm.packagingCards);
        const flagsHtml = this._renderProductDetailFlags(vm.flags);
        const categoryPathHtml = this._renderProductDetailCategoryPath(vm.categoryBreadcrumb);

        const infoGroupsHtml = groups.length
            ? `<div class="product-detail-groups">${this._renderProductDetailGroupsHtml(groups)}</div>`
            : '';

        const sktSectionHtml = this._isProductDetailHidden('section_skt')
            ? ''
            : `<section class="product-detail-group product-detail-group--skt">
                    <div class="product-detail-group-head">
                        <span>SKT & Raf ömrü</span>
                        <button type="button" class="product-detail-refresh-btn" data-action="refresh-skt">Yenile</button>
                        ${this._renderProductDetailHideBtn('section_skt')}
                    </div>
                    <div class="product-detail-group-body">
                        ${expDaysHtml}
                        ${expDaysHtml && sktHtml ? '<div class="pd-skt-divider"></div>' : ''}
                        ${sktHtml || ''}
                    </div>
                </section>`;

        const packagingSectionHtml =
            packagingHtml && !this._isProductDetailHidden('section_packaging')
                ? `<section class="product-detail-group product-detail-group--genel"><div class="product-detail-group-head"><span>Ambalaj barkodları</span>${this._renderProductDetailHideBtn('section_packaging')}</div><div class="product-detail-group-body">${packagingHtml}</div></section>`
                : '';

        const flagsSectionHtml =
            flagsHtml && !this._isProductDetailHidden('section_flags')
                ? `<section class="product-detail-group product-detail-group--genel"><div class="product-detail-group-head"><span>Durum</span>${this._renderProductDetailHideBtn('section_flags')}</div><div class="product-detail-group-body">${flagsHtml}</div></section>`
                : '';

        content.innerHTML = `
            <div class="pd-panel">
                ${this._renderProductDetailHero(vm)}
                ${categoryPathHtml}
                ${this._renderProductDetailPriceBlock(vm)}
                ${this._renderProductDetailStockGrid(vm)}
                ${sktSectionHtml}
                ${packagingSectionHtml}
                ${flagsSectionHtml}
                ${infoGroupsHtml}
            </div>`;

        content.querySelectorAll('.product-detail-hide-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._hideProductDetailField(btn.getAttribute('data-field-id'));
            });
        });

        document.querySelectorAll('#countingProductDetailHiddenChips [data-unhide-field]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._unhideProductDetailField(btn.getAttribute('data-unhide-field'));
            });
        });

        this._bindProductDetailSktDateChecker(content, productId, vm.expDays);

        content.querySelectorAll('[data-action="refresh-skt"]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                void this._refreshProductDetailData(productId, true);
            });
        });

        content.querySelectorAll('[data-action="open-image"]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const img = btn.querySelector('img');
                if (img?.src) this.openProductImageLightbox(img.src, vm.hero.name);
            });
        });
    }

    async _fetchApiProductRowForDetail(productId, force = false) {
        const pid = String(productId);
        if (!force && this._apiProductRowCache.has(pid)) return;

        const product = this.productIndex.get(productId);
        if (!product) return;

        const barcode = product.barcodes?.[0]?.code || null;
        const row = await this._fetchApiProductRowByProductId(productId, barcode);
        if (row) return;

        if (barcode) {
            try {
                await this.requestStockFromExtension(product.name, barcode, productId, { quiet: true });
            } catch (_) { /* sessiz */ }
        }
    }

    async _fetchProductDetailExpiry(productId, force = false) {
        const pid = String(productId);
        if (!force) {
            const fromGuide = this._getFinancePasteGuideSktEntries(pid);
            if (fromGuide.length) {
                this._productDetailExpiryCache.set(pid, fromGuide);
                this._productDetailExpiryFetched.add(pid);
                this._productDetailExpiryErrors.delete(pid);
                return;
            }
            if (this._productDetailExpiryCache.has(pid) && this._productDetailExpiryFetched.has(pid)) return;
        }

        const helper = window.getirExtensionHelper;
        if (!helper?.fetchExpiryProducts) {
            this._productDetailExpiryErrors.set(
                pid,
                'SKT eklentisi bağlı değil — getir-stock-sync extension gerekli.'
            );
            this._productDetailExpiryFetched.add(pid);
            return;
        }

        try {
            const result = await helper.fetchExpiryProducts([pid]);
            const entries = result?.byProductId?.[pid] || [];
            this._productDetailExpiryCache.set(pid, entries);
            this._productDetailExpiryFetched.add(pid);
            if (entries.length) this._productDetailExpiryErrors.delete(pid);
            else {
                this._productDetailExpiryErrors.set(
                    pid,
                    'Bu ürün için SKT kaydı bulunamadı — warehouse.getir.com açık olsun.'
                );
            }
        } catch (e) {
            this._productDetailExpiryFetched.add(pid);
            this._productDetailExpiryErrors.set(
                pid,
                (e && e.message) || 'SKT alınamadı — warehouse sekmesini açıp tekrar deneyin.'
            );
        }
    }

    async _refreshProductDetailData(productId, forceSkt = false, forceApi = false) {
        if (!productId) return;
        this._productDetailLoading = true;
        if (this.isProductDetailPanelOpen() && this.currentCountingProduct === productId) {
            this.renderProductDetailPanel(productId);
        }

        await Promise.allSettled([
            this._fetchProductDetailExpiry(productId, forceSkt),
            this._fetchApiProductRowForDetail(productId, forceApi || forceSkt),
        ]);

        this._productDetailLoading = false;
        if (this.isProductDetailPanelOpen() && this.currentCountingProduct === productId) {
            this.renderProductDetailPanel(productId);
        }
    }

    async _ensureProductDetailExpiry(productId) {
        await this._refreshProductDetailData(productId, true);
    }

    openProductDetailPanel() {
        const productId = this.currentCountingProduct;
        if (!productId) return;

        this.closeProductTimelinePanel();

        const overlay = document.getElementById('countingProductDetailOverlay');
        const subtitle = document.getElementById('countingProductDetailSubtitle');
        if (!overlay) return;

        const product = this.productIndex.get(productId);
        if (subtitle) {
            subtitle.textContent = product?.name ? String(product.name) : '';
        }

        this.renderProductDetailPanel(productId);
        overlay.classList.remove('hidden');
        overlay.classList.add('flex', 'show');

        void this._refreshProductDetailData(productId, false, true);
    }

    closeProductDetailPanel() {
        const overlay = document.getElementById('countingProductDetailOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex', 'show');
        }
    }

    toggleProductDetailPanel() {
        const overlay = document.getElementById('countingProductDetailOverlay');
        if (!overlay) return;
        if (overlay.classList.contains('hidden')) this.openProductDetailPanel();
        else this.closeProductDetailPanel();
    }

    isProductDetailPanelOpen() {
        const overlay = document.getElementById('countingProductDetailOverlay');
        return !!(overlay && !overlay.classList.contains('hidden'));
    }

    setupProductDetailPanel() {
        const productName = document.getElementById('countingProductName');
        const closeBtn = document.getElementById('countingProductDetailCloseBtn');
        const backdrop = document.getElementById('countingProductDetailBackdrop');
        const resetBtn = document.getElementById('countingProductDetailResetHiddenBtn');

        const openDetail = (e) => {
            e?.stopPropagation?.();
            if (!this.currentCountingProduct) return;
            this.openProductDetailPanel();
        };

        if (productName) {
            productName.addEventListener('click', openDetail);
            productName.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(e);
                }
            });
        }
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeProductDetailPanel());
        if (backdrop) backdrop.addEventListener('click', () => this.closeProductDetailPanel());
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this._resetProductDetailHiddenFields();
                this.showToast('Gizli alanlar sıfırlandı', 'success', 2000);
            });
        }
    }

    _buildCountingItemUpsertRow(tableName, productId, snapshot) {
        const row = {
            username: this.currentUser.username,
            table_name: tableName,
            product_id: productId,
            warehouse_stock: snapshot.warehouseStock,
            system_stock: snapshot.systemStock,
            price: snapshot.price,
            price_text: snapshot.priceText,
            reserved_stock: snapshot.reservedStock,
            history: snapshot.history,
            api_fetch_failed: snapshot.apiFetchFailed,
            updated_by: this.deviceId,
            last_updated: snapshot.lastUpdated,
        };
        if (this._countingItemsPriceExtension !== false) {
            row.struck_price = snapshot.struckPrice ?? null;
            row.struck_price_text = snapshot.struckPriceText ?? null;
            row.no_struck_price = snapshot._apiNoStruckPrice === true;
        }
        return row;
    }

    async _queryCountingItems(selectCols, applyFilters) {
        let query = window.supabase.from('counting_items').select(selectCols);
        query = applyFilters(query);
        let { data, error } = await query;
        if (
            error &&
            this._isMissingDbColumnError(error) &&
            selectCols.includes('struck_price')
        ) {
            this._countingItemsPriceExtension = false;
            const fallbackCols = selectCols
                .replace(', struck_price, struck_price_text, no_struck_price', '')
                .replace('struck_price, struck_price_text, no_struck_price, ', '')
                .replace('struck_price, struck_price_text, no_struck_price', '');
            let q2 = window.supabase.from('counting_items').select(fallbackCols);
            q2 = applyFilters(q2);
            ({ data, error } = await q2);
        } else if (!error && selectCols.includes('struck_price')) {
            this._countingItemsPriceExtension = true;
        }
        return { data, error };
    }

    /**
     * Tek bir ürünü counting_items tablosuna upsert eder.
     * tableName baştan sabitlenir — tablo değişiminde A verisinin B'ye yazılmasını engeller.
     */
    async saveProductEntry(productId, options = {}) {
        if (!productId || this.isReservedCountingKey(productId)) return;
        const tableName = options.tableName || this.currentTableName;
        if (!tableName) return;

        const tableData = this._getTableDataRef(tableName);
        const entry = tableData?.[productId];
        const snapshot = this._snapshotProductEntry(entry);
        if (!snapshot) return;

        if (this._countingItemsTableReady !== true) {
            this.scheduleSave(400);
            return;
        }

        try {
            const row = this._buildCountingItemUpsertRow(tableName, productId, snapshot);
            let { error } = await window.supabase.from('counting_items').upsert(row, {
                onConflict: 'username,table_name,product_id',
            });
            if (error && this._isMissingDbColumnError(error) && this._countingItemsPriceExtension !== false) {
                this._countingItemsPriceExtension = false;
                const fallbackRow = this._buildCountingItemUpsertRow(tableName, productId, snapshot);
                ({ error } = await window.supabase.from('counting_items').upsert(fallbackRow, {
                    onConflict: 'username,table_name,product_id',
                }));
            } else if (!error && row.struck_price !== undefined) {
                this._countingItemsPriceExtension = true;
            }
            if (error) throw error;
            // Başarılı: localStorage'ı tam blob ile güncelle + gecikmeli Supabase tam yedek
            this._saveFullBlobToLocalStorage();
            this._scheduleFullBackup();
        } catch (e) {
            console.error('saveProductEntry hatası:', e);
            // Başarısız: localStorage + Supabase tam blob yaz (çift güvenlik)
            this._saveFullBlobToLocalStorage();
            this._scheduleFullBackup(); // 3s içinde Supabase'e tam blob yaz
            this.scheduleSave(400);     // 400ms sonra saveFullCountingData → tam blob
        }
    }

    /**
     * Tek bir ürünü counting_items tablosundan siler.
     */
    async deleteProductEntry(productId, tableName) {
        if (!productId || !window.supabase || !this.currentUser) return;
        if (this._countingItemsTableReady !== true) return;
        try {
            await window.supabase.from('counting_items')
                .delete()
                .eq('username', this.currentUser.username)
                .eq('table_name', tableName || this.currentTableName)
                .eq('product_id', productId);
        } catch (e) {
            console.error('deleteProductEntry hatası:', e);
        }
    }

    /**
     * Bir tablonun tüm ürünlerini counting_items tablosundan siler.
     */
    async deleteTableEntries(tableName) {
        if (!tableName || !window.supabase || !this.currentUser) return;
        if (this._countingItemsTableReady !== true) return;
        try {
            await window.supabase.from('counting_items')
                .delete()
                .eq('username', this.currentUser.username)
                .eq('table_name', tableName);
        } catch (e) {
            console.error('deleteTableEntries hatası:', e);
        }
    }

    /**
     * Per-product debounce: aynı ürünü kısa aralıklarla güncellerken
     * sadece son değeri kaydeder.
     */
    _scheduleProductSave(productId, delay = 400) {
        const tableName = this.currentTableName;
        if (this._productSaveTimers[productId]) {
            clearTimeout(this._productSaveTimers[productId]);
        }
        this._productSaveTimers[productId] = setTimeout(() => {
            delete this._productSaveTimers[productId];
            this.saveProductEntry(productId, { tableName }).catch(e => console.error('_scheduleProductSave error:', e));
        }, delay);
    }

    /** Tablo değişmeden önce bekleyen ürün kayıtlarını o tablo adıyla flush eder */
    async _flushPendingProductSaves(tableName) {
        const tName = tableName || this.currentTableName;
        if (!tName) return;
        const pendingIds = Object.keys(this._productSaveTimers || {});
        for (const pId of pendingIds) {
            clearTimeout(this._productSaveTimers[pId]);
            delete this._productSaveTimers[pId];
        }
        await Promise.all(
            pendingIds.map((pId) => this.saveProductEntry(pId, { tableName: tName }).catch(() => {}))
        );
    }

    /** Cihaza özgü aktif tablo adını localStorage'a kaydeder */
    _saveDeviceCurrentTable(tableName) {
        try {
            const key = `${this.DEVICE_TABLE_KEY}_${this.currentUser?.username || 'default'}`;
            localStorage.setItem(key, tableName);
        } catch (e) { /* ignore */ }
    }

    /** Cihaza özgü aktif tablo adını localStorage'dan okur */
    _loadDeviceCurrentTable() {
        try {
            const key = `${this.DEVICE_TABLE_KEY}_${this.currentUser?.username || 'default'}`;
            return localStorage.getItem(key) || null;
        } catch (e) { return null; }
    }

    /**
     * Supabase Realtime kurulumu.
     * counting_items tablosu mevcutsa → per-product olaylarını dinle (hızlı, çakışmasız).
     * Yoksa → eski users tablosu yöntemine düş.
     * Her iki durumda da users tablosunu meta değişiklikleri (tablo ekleme/silme) için dinliyoruz.
     */
    _setupRealtimeSync() {
        if (!window.supabase || !this.currentUser) return;
        try {
            if (this._countingItemsTableReady === true) {
                // ── YENİ YÖNTEM: per-product realtime ──
                this._realtimeItemsChannel = window.supabase
                    .channel(`ci-${this.currentUser.username}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'counting_items',
                            filter: `username=eq.${this.currentUser.username}`,
                        },
                        (payload) => this._handleProductUpdate(payload)
                    )
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            console.log('🟢 Realtime counting_items bağlandı (per-product)');
                            this._realtimeItemsActive = true;
                            this._scheduleActiveTableCatchUp(300);
                        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                            console.warn(`⚠️ Realtime counting_items: ${status} — visibility refresh fallback aktif`);
                            this._realtimeItemsActive = false;
                        }
                    });
            }

            // Her iki yöntemde de meta değişikliklerini (tablo oluşturma/silme) dinle
            this._realtimeMetaChannel = window.supabase
                .channel(`meta-${this.currentUser.username}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'users',
                        filter: `username=eq.${this.currentUser.username}`,
                    },
                    (payload) => this._handleRealtimeMetaUpdate(payload)
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('🟢 Realtime meta sync bağlandı');
                        this._realtimeMetaActive = true;
                        this._scheduleActiveTableCatchUp(400);
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        console.warn(`⚠️ Realtime meta: ${status} — visibility refresh fallback aktif`);
                        this._realtimeMetaActive = false;
                    }
                });
        } catch (e) {
            console.error('Realtime sync kurulum hatası:', e);
        }
    }

    /**
     * Sayfa görünür olunca aktif tablo catch-up + seyrek meta sync.
     * Realtime birincil kanal; polling yalnızca güvenlik ağı (tek tablo sorgusu).
     */
    _setupVisibilityRefresh() {
        let lastMetaRefresh = 0;
        let lastHiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0;

        const tryActiveCatchUp = () => {
            if (document.visibilityState !== 'visible') return;
            if (this._importInProgress) return;
            this._scheduleActiveTableCatchUp(200);
        };

        const tryMetaRefresh = (options = {}) => {
            if (document.visibilityState !== 'visible') return;
            if (this._importInProgress) return;
            const now = Date.now();
            const realtimeOk = this._isCountingRealtimeHealthy();
            const cooldownMs = realtimeOk ? 120000 : 30000;
            const hiddenMs = lastHiddenAt ? now - lastHiddenAt : 0;
            const forceMeta = options.forceMeta === true || hiddenMs >= 60000;

            if (now - lastMetaRefresh < cooldownMs && !forceMeta) return;
            lastMetaRefresh = now;

            if (forceMeta || !realtimeOk) {
                this._refreshAllTablesMetaFromSupabase().catch(() => {});
            } else {
                this._refreshTableMetaOnlyFromSupabase().catch(() => {});
            }
            this.updateAPIStatusCard();
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                lastHiddenAt = Date.now();
                this._flushPendingProductSaves(this.currentTableName).catch(() => {});
                if (this._saveDebounceTimer) {
                    clearTimeout(this._saveDebounceTimer);
                    this._saveDebounceTimer = null;
                    this.saveCountingData().catch(() => {});
                }
                return;
            }
            tryActiveCatchUp();
            tryMetaRefresh({ forceMeta: true });
        });
        window.addEventListener('focus', () => {
            tryActiveCatchUp();
            tryMetaRefresh({ forceMeta: true });
        });

        // Realtime sağlıklıyken: 60 sn'de bir yalnızca aktif tablo (hafif)
        // Realtime kopuksa: aktif tablo + meta listesi
        this._periodicRefreshInterval = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            if (this._importInProgress) return;
            tryActiveCatchUp();
            if (!this._isCountingRealtimeHealthy()) {
                tryMetaRefresh({ forceMeta: true });
            }
        }, 25000);
    }

    /**
     * Hafif meta sync — tüm counting_items çekmeden tablo listesi / _tableMeta günceller (egress tasarrufu).
     */
    async _refreshTableMetaOnlyFromSupabase() {
        if (!window.supabase || !this.currentUser) return;
        if (this._countingItemsTableReady !== true) return;
        if (this._importInProgress) return;

        try {
            const { data, error } = await window.supabase
                .from('users')
                .select('counting_data')
                .eq('username', this.currentUser.username)
                .maybeSingle();
            if (error || !data?.counting_data) return;

            const remoteTableMeta = data.counting_data._tableMeta || {};
            if (!this.cachedFullData) this.cachedFullData = { _tables: {}, _tableMeta: {} };
            if (!this.cachedFullData._tableMeta) this.cachedFullData._tableMeta = {};

            let metaChanged = false;
            for (const [tName, meta] of Object.entries(remoteTableMeta)) {
                if (this._isTableTombstoned(tName)) continue;
                if (!this.cachedFullData._tableMeta[tName]) {
                    this.cachedFullData._tableMeta[tName] = {
                        createdAt: meta?.createdAt || new Date(0).toISOString(),
                        lastActivityAt: meta?.lastActivityAt || null,
                        _productOrder: Array.isArray(meta?._productOrder) ? [...meta._productOrder] : [],
                    };
                    metaChanged = true;
                } else if (meta?.lastActivityAt) {
                    const incMs = new Date(meta.lastActivityAt).getTime();
                    const locMs = this.cachedFullData._tableMeta[tName].lastActivityAt
                        ? new Date(this.cachedFullData._tableMeta[tName].lastActivityAt).getTime()
                        : 0;
                    if (incMs > locMs) {
                        this.cachedFullData._tableMeta[tName].lastActivityAt = meta.lastActivityAt;
                        metaChanged = true;
                    }
                }
            }

            if (metaChanged) this._scheduleTableSelectorUpdate(100);
        } catch (e) { /* sessiz */ }
    }

    /**
     * Tüm tabloların listesini ve ürün sayılarını Supabase'den senkronize eder.
     * Yeni tablolar veya başka cihazlardan gelen ürün ekleme/silme'yi yakalar.
     * Sıralama bozulmaması için tablo createdAt'ı her zaman users.counting_data._tableMeta'dan alınır.
     */
    async _refreshAllTablesMetaFromSupabase() {
        if (!window.supabase || !this.currentUser) return;
        if (this._countingItemsTableReady !== true) return;
        if (this._importInProgress) return;

        try {
            // PARALEL: counting_items + users.counting_data — biri ürünler için, diğeri _tableMeta için
            const [itemsRes, userRes] = await Promise.all([
                this._queryCountingItems(this._getCountingItemsMetaSyncColumns(), (q) =>
                    q.eq('username', this.currentUser.username)
                ),
                window.supabase
                    .from('users')
                    .select('counting_data')
                    .eq('username', this.currentUser.username)
                    .maybeSingle(),
            ]);

            if (itemsRes.error) return;
            const rows = itemsRes.data || [];
            const remoteMetaBlob = userRes?.data?.counting_data || null;
            const remoteTableMeta = remoteMetaBlob?._tableMeta || {};

            if (!this.cachedFullData) this.cachedFullData = { _tables: {}, _tableMeta: {} };
            if (!this.cachedFullData._tables) this.cachedFullData._tables = {};
            if (!this.cachedFullData._tableMeta) this.cachedFullData._tableMeta = {};

            // Her tablo için: ürünleri grupla + en eski counting_items.created_at'ı tut (fallback createdAt)
            const tablesByName = {};
            const minCreatedAtByTable = {};
            for (const row of rows) {
                if (!tablesByName[row.table_name]) tablesByName[row.table_name] = {};
                tablesByName[row.table_name][row.product_id] = this._mapCountingItemRowToEntry(row);
                const ca = row.created_at ? new Date(row.created_at).getTime() : null;
                if (ca && (!minCreatedAtByTable[row.table_name] || ca < minCreatedAtByTable[row.table_name])) {
                    minCreatedAtByTable[row.table_name] = ca;
                }
            }

            // Önceliklendirilmiş createdAt çözücü:
            // 1. Yerel _tableMeta'da var → koru (değişmez)
            // 2. Uzak users.counting_data._tableMeta'da var → onu kullan (cross-device tutarlı)
            // 3. counting_items.MIN(created_at) → fallback
            // 4. Yoksa epoch (en eskiye düşsün, sıralamayı bozmasın)
            const resolveCreatedAt = (tName) => {
                const local = this.cachedFullData._tableMeta?.[tName]?.createdAt;
                if (local) return local;
                const remote = remoteTableMeta[tName]?.createdAt;
                if (remote) return remote;
                const minCa = minCreatedAtByTable[tName];
                if (minCa) return new Date(minCa).toISOString();
                return new Date(0).toISOString();
            };

            // remoteTableMeta'daki tablolar varsa local'a yansıt (silinmemiş tabloların createdAt'ı)
            for (const [tName, meta] of Object.entries(remoteTableMeta)) {
                if (!this.cachedFullData._tableMeta[tName]) {
                    this.cachedFullData._tableMeta[tName] = {
                        createdAt: meta?.createdAt || resolveCreatedAt(tName),
                        lastActivityAt: meta?.lastActivityAt || null,
                        _productOrder: Array.isArray(meta?._productOrder) ? [...meta._productOrder] : [],
                    };
                } else if (meta?.lastActivityAt) {
                    const incMs = new Date(meta.lastActivityAt).getTime();
                    const locMs = this.cachedFullData._tableMeta[tName].lastActivityAt
                        ? new Date(this.cachedFullData._tableMeta[tName].lastActivityAt).getTime()
                        : 0;
                    if (!Number.isNaN(incMs) && incMs >= locMs) {
                        this.cachedFullData._tableMeta[tName].lastActivityAt = meta.lastActivityAt;
                    }
                }
            }

            let metaChanged = false;
            for (const [tName, products] of Object.entries(tablesByName)) {
                if (this._isTableTombstoned(tName)) continue;
                if (!this.cachedFullData._tables[tName]) {
                    this.cachedFullData._tables[tName] = { ...products };
                    const createdAt = resolveCreatedAt(tName);
                    if (!this.cachedFullData._tableMeta[tName]) {
                        this.cachedFullData._tableMeta[tName] = {
                            createdAt,
                            _productOrder: Object.keys(products),
                        };
                    }
                    // Tablo objesi içine meta yansıt (sıralama + Son Sayım için)
                    const remoteLast = remoteTableMeta[tName]?.lastActivityAt
                        || this.cachedFullData._tableMeta[tName]?.lastActivityAt
                        || null;
                    const { maxMs } = this.getProductLastUpdatedBounds(this.cachedFullData._tables[tName]);
                    let lastActivityAt = remoteLast;
                    if (maxMs != null) {
                        const maxIso = new Date(maxMs).toISOString();
                        if (!lastActivityAt || maxMs > new Date(lastActivityAt).getTime()) {
                            lastActivityAt = maxIso;
                        }
                    }
                    this.cachedFullData._tables[tName]._tableMeta = {
                        createdAt,
                        ...(lastActivityAt ? { lastActivityAt } : {}),
                    };
                    if (lastActivityAt) {
                        if (!this.cachedFullData._tableMeta[tName]) {
                            this.cachedFullData._tableMeta[tName] = { createdAt, _productOrder: [] };
                        }
                        this.cachedFullData._tableMeta[tName].lastActivityAt = lastActivityAt;
                    }
                    metaChanged = true;
                    continue;
                }
                // Aktif tablo değilse merge et (aktif tablo refreshCurrentTableFromSupabase'da işleniyor)
                if (tName !== this.currentTableName) {
                    const local = this.cachedFullData._tables[tName];
                    for (const [pId, incoming] of Object.entries(products)) {
                        const localProduct = local[pId];
                        if (!localProduct) {
                            local[pId] = incoming;
                            if (!Array.isArray(local._productOrder)) local._productOrder = [];
                            if (!local._productOrder.includes(pId)) local._productOrder.push(pId);
                            metaChanged = true;
                        } else {
                            const incomingTs = new Date(incoming.lastUpdated).getTime();
                            const localTs = localProduct.lastUpdated ? new Date(localProduct.lastUpdated).getTime() : 0;
                            if (incomingTs > localTs) {
                                local[pId] = incoming;
                                metaChanged = true;
                            }
                        }
                    }
                    this.syncTableLastActivityMeta(tName, local);
                }
            }

            if (metaChanged) {
                this._scheduleTableSelectorUpdate(100);
                this._saveFullBlobToLocalStorage();
            }
        } catch (e) { /* sessiz */ }
    }

    /**
     * Aktif tablonun ürünlerini counting_items'tan yeniden çeker; tüm tabloların metasını da günceller.
     * Realtime gelmeyen senaryolar için kritik güvenlik ağı.
     */
    async refreshCurrentTableFromSupabase() {
        if (!window.supabase || !this.currentUser) return;
        if (this._countingItemsTableReady !== true) return;
        if (!this.currentTableName) return;
        if (this._importInProgress) return;

        try {
            // 1. Aktif tablonun tüm ürünlerini çek
            const { data: rows, error } = await this._queryCountingItems(
                this._getCountingItemsSelectColumns(false),
                (q) => q.eq('username', this.currentUser.username).eq('table_name', this.currentTableName)
            );
            if (error) return;

            const incomingMap = {};
            for (const row of rows || []) {
                incomingMap[row.product_id] = this._mapCountingItemRowToEntry(row);
            }

            let changed = false;
            const localTable = this.cachedFullData?._tables?.[this.currentTableName];
            if (!localTable) return;

            // Yeni gelen veya güncellenen ürünleri merge et (last-write-wins)
            for (const [pId, incoming] of Object.entries(incomingMap)) {
                const local = localTable[pId];
                if (!local) {
                    localTable[pId] = incoming;
                    this.countingData[pId] = incoming;
                    if (!Array.isArray(localTable._productOrder)) localTable._productOrder = [];
                    if (!localTable._productOrder.includes(pId)) localTable._productOrder.push(pId);
                    if (!Array.isArray(this.countingData._productOrder)) this.countingData._productOrder = [];
                    if (!this.countingData._productOrder.includes(pId)) this.countingData._productOrder.push(pId);
                    changed = true;
                } else {
                    const incomingTs = new Date(incoming.lastUpdated).getTime();
                    const localTs = local.lastUpdated ? new Date(local.lastUpdated).getTime() : 0;
                    if (incomingTs > localTs) {
                        const merged = this._mergeCountingEntryFromRemote(local, incoming);
                        localTable[pId] = merged;
                        this.countingData[pId] = merged;
                        changed = true;
                    }
                }
            }

            if (changed) {
                this.scheduleRenderTable();
                this.updateStatistics();
                this.updateCountingProgress();
                this._scheduleTableSelectorUpdate();
                this._saveFullBlobToLocalStorage();
            }
        } catch (e) { /* sessizce başarısız */ }
    }

    /**
     * Tablo seçici şeridini debounce ile yeniden çizer (her ürün güncellemesinde değil, biraz bekleyerek).
     */
    _scheduleTableSelectorUpdate(delay = 250) {
        if (this._tableSelectorUpdateTimer) clearTimeout(this._tableSelectorUpdateTimer);
        this._tableSelectorUpdateTimer = setTimeout(() => {
            this._tableSelectorUpdateTimer = null;
            this.updateTableSelector();
        }, delay);
    }

    /**
     * counting_items tablosundan gelen tek ürün güncellemesi.
     * Bu cihazdan gelen echo'ları filtreler; sadece başka cihazların değişikliklerini işler.
     */
    _handleProductUpdate(payload) {
        if (!payload) return;
        if (this._importInProgress) return;

        const eventType = payload.eventType;
        const item = payload.new || payload.old;
        if (!item) return;

        // Echo filtresi: bu cihazın kendi kaydı ise yoksay
        const writerId = payload.new?.updated_by || payload.old?.updated_by;
        if (writerId === this.deviceId) return;

        const tName = item.table_name;
        const pId = item.product_id;

        if (!this.cachedFullData) return;
        if (!this.cachedFullData._tables) this.cachedFullData._tables = {};
        if (!this.cachedFullData._tableMeta) this.cachedFullData._tableMeta = {};
        if (!this.cachedFullData._tables[tName]) {
            if (this._isTableTombstoned(tName)) return;
            // Realtime'da yeni tablo geliyor — createdAt'ı item.created_at'tan al (sıralama için kritik)
            const createdAt = item.created_at || new Date().toISOString();
            this.cachedFullData._tables[tName] = { _tableMeta: { createdAt } };
            if (!this.cachedFullData._tableMeta[tName]) {
                this.cachedFullData._tableMeta[tName] = { createdAt, _productOrder: [] };
            }
            this._scheduleTableSelectorUpdate();
        }

        if (eventType === 'DELETE') {
            delete this.cachedFullData._tables[tName][pId];
            if (Array.isArray(this.cachedFullData._tables[tName]._productOrder)) {
                this.cachedFullData._tables[tName]._productOrder =
                    this.cachedFullData._tables[tName]._productOrder.filter((id) => id !== pId);
            }
            if (tName === this.currentTableName) {
                delete this.countingData[pId];
                if (Array.isArray(this.countingData._productOrder)) {
                    this.countingData._productOrder = this.countingData._productOrder.filter((id) => id !== pId);
                }
                this.scheduleRenderTable();
                this.updateStatistics();
            }
        } else {
            const productData = this._mapCountingItemRowToEntry(item);
            const table = this.cachedFullData._tables[tName];
            const isNewProduct = !table[pId];
            table[pId] = productData;

            // Yeni ürünü _productOrder'a ekle (cross-device görünürlük için kritik)
            if (isNewProduct) {
                if (!Array.isArray(table._productOrder)) table._productOrder = [];
                if (!table._productOrder.includes(pId)) table._productOrder.push(pId);
            }

            if (tName === this.currentTableName) {
                this.countingData[pId] = productData;
                if (isNewProduct) {
                    if (!Array.isArray(this.countingData._productOrder)) this.countingData._productOrder = [];
                    if (!this.countingData._productOrder.includes(pId)) this.countingData._productOrder.push(pId);
                }
                this.scheduleRenderTable();
                this.updateStatistics();
                this.updateCountingProgress();
                if (pId === this.currentCountingProduct && !this._isSheetStockFetchLocked()) {
                    this._refreshOpenCountingSheetFromData();
                }
            }
            // Yeni tablo görünürse chip listesi de güncellensin
            if (isNewProduct) this._scheduleTableSelectorUpdate();
        }
        // localStorage TAM blob yedek (ürünler dahil — kayıp önleme)
        this._saveFullBlobToLocalStorage();
    }

    /**
     * users tablosundaki meta değişikliklerini işler.
     * MERGE-only: tablo ekleme + meta + ürün verilerini birleştirir.
     * Silme operasyonları realtime üzerinden YAPILMAZ (race condition güvenliği).
     */
    _handleRealtimeMetaUpdate(payload) {
        const incoming = payload?.new?.counting_data;
        if (!incoming) return;
        if (this._importInProgress) return;

        // ── Echo filtresi: bu cihazın kendi yazdığı blob ise yoksay ──
        if (incoming._writerDeviceId && incoming._writerDeviceId === this.deviceId) {
            return;
        }

        if (!this.cachedFullData) this.cachedFullData = { _tables: {} };
        if (!this.cachedFullData._tables) this.cachedFullData._tables = {};

        // api_info: en uzun süreli token kazanır (kısa token ile ezme yok)
        if (incoming._api_info) {
            const local = this.cachedFullData._api_info || null;
            const best = this.pickBestApiInfo([local, incoming._api_info].filter(Boolean));
            if (best && best.token) {
                this.cachedFullData._api_info = this.mergeApiInfoForSave(best, local || {});
            }
            if (!this._apiStatusRefreshTimer) {
                this._apiStatusRefreshTimer = setTimeout(() => {
                    this._apiStatusRefreshTimer = null;
                    this.updateAPIStatusCard();
                }, 400);
            }
        }

        // auditLog merge: daha uzun olan korunur
        if (Array.isArray(incoming._auditLog) &&
            incoming._auditLog.length > (this.auditLog?.length || 0)) {
            this.auditLog = incoming._auditLog.slice(-this.AUDIT_LOG_MAX);
            this.cachedFullData._auditLog = this.auditLog;
        }

        if (incoming._currentTable && incoming._currentTable !== this.cachedFullData._currentTable) {
            const incomingAt = Number(incoming._currentTableAt) || 0;
            const localAt = Number(this.cachedFullData._currentTableAt) || 0;
            if (incomingAt >= localAt) {
                this.cachedFullData._currentTable = incoming._currentTable;
                this.cachedFullData._currentTableAt = incomingAt;
            }
        }

        let tablesChanged = false;

        // ── Tabloları MERGE et (silme yok, sadece ekleme/birleştirme) ──
        if (incoming._tables && typeof incoming._tables === 'object') {
            for (const [tName, incomingTableData] of Object.entries(incoming._tables)) {
                if (!this.isValidTableNameKey(tName)) continue;
                if (this._isTableTombstoned(tName)) continue;
                if (!incomingTableData || typeof incomingTableData !== 'object') continue;

                if (!this.cachedFullData._tables[tName]) {
                    // Yeni tablo geldi → ekle
                    this.cachedFullData._tables[tName] = { ...incomingTableData };
                    tablesChanged = true;
                    continue;
                }

                // Var olan tablo: aktif tablo ise countingData'yı doğrudan değiştirme
                // (kullanıcı yazıyor olabilir); diğerlerinde tam senkronizasyon yap.
                const localTable = this.cachedFullData._tables[tName];

                for (const [pId, incomingProduct] of Object.entries(incomingTableData)) {
                    if (this.isReservedCountingKey(pId)) continue;
                    if (!incomingProduct || typeof incomingProduct !== 'object') continue;
                    if (this._looksLikeNestedTableBlob(incomingProduct)) continue;

                    const localProduct = localTable[pId];
                    const wasNew = !localProduct;
                    // last-write-wins: gelen daha yeniyse yaz
                    const incomingTs = incomingProduct.lastUpdated ? new Date(incomingProduct.lastUpdated).getTime() : 0;
                    const localTs = localProduct?.lastUpdated ? new Date(localProduct.lastUpdated).getTime() : 0;
                    if (wasNew || incomingTs >= localTs) {
                        localTable[pId] = { ...incomingProduct };
                        if (tName === this.currentTableName) {
                            this.countingData[pId] = localTable[pId];
                        }
                    }
                    // Yeni ürünü _productOrder'a ekle
                    if (wasNew) {
                        if (!Array.isArray(localTable._productOrder)) localTable._productOrder = [];
                        if (!localTable._productOrder.includes(pId)) localTable._productOrder.push(pId);
                        if (tName === this.currentTableName) {
                            if (!Array.isArray(this.countingData._productOrder)) this.countingData._productOrder = [];
                            if (!this.countingData._productOrder.includes(pId)) this.countingData._productOrder.push(pId);
                        }
                    }
                }

                // Meta birleştir (createdAt + lastActivityAt + productOrder)
                if (incomingTableData._tableMeta) {
                    if (!localTable._tableMeta) localTable._tableMeta = {};
                    const incomingMeta = incomingTableData._tableMeta;
                    if (incomingMeta.createdAt && !localTable._tableMeta.createdAt) {
                        localTable._tableMeta.createdAt = incomingMeta.createdAt;
                    }
                    const incomingAct = incomingMeta.lastActivityAt;
                    if (incomingAct) {
                        const incMs = new Date(incomingAct).getTime();
                        const locMs = localTable._tableMeta.lastActivityAt
                            ? new Date(localTable._tableMeta.lastActivityAt).getTime()
                            : 0;
                        if (!Number.isNaN(incMs) && incMs >= locMs) {
                            localTable._tableMeta.lastActivityAt = incomingAct;
                        }
                    }
                }
                // _productOrder: yerel sıra korunur (yapıştırma sırası); uzaktan yalnızca yeni ID eklenir
                if (Array.isArray(incomingTableData._productOrder)) {
                    const localOrder = Array.isArray(localTable._productOrder) ? localTable._productOrder : [];
                    const localIds = Object.keys(localTable).filter((k) => !this.isReservedCountingKey(k));
                    const localSet = new Set(localIds);
                    const merged = [];
                    const seen = new Set();
                    for (const id of localOrder) {
                        if (!localSet.has(id) || seen.has(id)) continue;
                        merged.push(id);
                        seen.add(id);
                    }
                    for (const id of localIds) {
                        if (seen.has(id)) continue;
                        merged.push(id);
                        seen.add(id);
                    }
                    for (const id of incomingTableData._productOrder) {
                        if (seen.has(id) || localSet.has(id)) continue;
                        merged.push(id);
                        seen.add(id);
                    }
                    localTable._productOrder = merged;
                    if (tName === this.currentTableName) {
                        this.countingData._productOrder = [...merged];
                    }
                }
            }
            tablesChanged = true;
        }

        // ── _tableMeta merge (silme yok) ──
        if (incoming._tableMeta && typeof incoming._tableMeta === 'object') {
            const currentMeta = this.cachedFullData._tableMeta || {};
            for (const [tName, meta] of Object.entries(incoming._tableMeta)) {
                if (!this.cachedFullData._tables[tName]) {
                    this.cachedFullData._tables[tName] = {
                        _tableMeta: { createdAt: meta?.createdAt || new Date().toISOString() },
                        _productOrder: meta?._productOrder || [],
                    };
                    tablesChanged = true;
                }
                currentMeta[tName] = { ...(currentMeta[tName] || {}), ...meta };
                if (Array.isArray(meta?._productOrder) && meta._productOrder.length > 0) {
                    if (this._applyRemoteProductOrderForTable(tName, meta._productOrder)) {
                        tablesChanged = true;
                    }
                }
            }
            this.cachedFullData._tableMeta = currentMeta;
        }

        this.sanitizeTablesStructure(this.cachedFullData);

        if (tablesChanged) {
            this.scheduleRenderTable();
            this.updateStatistics();
        }

        // localStorage tam blob yedek (kayıp önleme)
        this._saveFullBlobToLocalStorage();
        this.updateTableSelector();
    }

    /** Eski yöntem uyum shim — kaldırılmaz, bazı internal call'lar bunun üzerinden geçebilir */
    _handleRealtimeCountingUpdate(payload) {
        this._handleRealtimeMetaUpdate(payload);
    }

    // Switch to a different table
    async switchTable(tableName, options = {}) {
        if (!tableName || tableName === this.currentTableName) {
            return;
        }
        if (this._isTableTombstoned(tableName)) return;

        const skipCatchUp = options.skipCatchUp === true;
        const skipRender = options.skipRender === true;
        const fromTable = this.currentTableName;

        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
            this._saveDebounceTimer = null;
        }
        void this._flushPendingProductSaves(fromTable);
        this._persistTableSlotLocally(fromTable);

        const fullData = this.cachedFullData || { _api_info: {}, _tables: {} };
        if (!fullData._tables) fullData._tables = {};

        if (this.countingData) {
            this._safeWriteTableSlot(fullData._tables, fromTable, this.countingData);
        }
        this.cachedFullData = fullData;

        const cachedSlot = fullData._tables[tableName];
        const hasCachedProducts = cachedSlot && this._countTableProductKeys(cachedSlot) > 0;

        if (!hasCachedProducts && this._countingItemsTableReady === true && !fullData._tables[tableName]) {
            fullData._tables[tableName] = { _tableMeta: { createdAt: new Date().toISOString() } };
        }

        if (fromTable) {
            this._rememberTableContext(fromTable);
        }
        this._activateCountingTable(tableName, { fromTable, persistFrom: false });
        this._rememberTableContext(tableName);
        this._saveDeviceCurrentTable(tableName);
        this._persistCurrentTableToMeta();
        this._scheduleMetaSave(300);

        this._tableProductSearchQuery = '';
        this._syncCountingTableSearchUi();

        if (this.isDailyTableName(tableName)) {
            const iso = this.getIsoFromDailyTableName(tableName);
            if (iso) {
                const el = document.getElementById('sayimDailyDateInput');
                if (el) el.value = iso;
                try {
                    sessionStorage.setItem('sayimDailySelectedIso', iso);
                } catch (e) {
                    /* ignore */
                }
            }
        }

        if (!skipRender) {
            this.renderTable();
            this.updateStatistics();
            this.updateTableSelector();
            this.scrollActiveGeneralTableChipIntoView({ behavior: 'auto' });
            this.syncSayimSubTabToTable();
        }

        if (!hasCachedProducts && this._countingItemsTableReady === true) {
            void this._loadTableProductsFromSupabase(tableName).then((loaded) => {
                if (!loaded || tableName !== this.currentTableName) return;
                this.renderTable();
                this.updateStatistics();
                this.updateTableSelector();
            });
        } else if (!skipCatchUp && !hasCachedProducts) {
            void this._catchUpActiveTableFromSupabase();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Tablo oluşturma combobox yardımcıları
    // ─────────────────────────────────────────────────────────────

    /** Dropdown'u body'ye taşır — modal overflow/stacking tıklamayı yutmasın */
    _mountTableNameDropdownPortal() {
        const dropdown = document.getElementById('tableNameDropdown');
        const wrap = document.getElementById('tableNameComboboxWrap');
        if (!dropdown || !wrap) return;
        if (!this._tableNameDropdownHome) this._tableNameDropdownHome = wrap;
        if (dropdown.parentElement !== document.body) {
            document.body.appendChild(dropdown);
        }
    }

    _unmountTableNameDropdownPortal() {
        const dropdown = document.getElementById('tableNameDropdown');
        const home = this._tableNameDropdownHome || document.getElementById('tableNameComboboxWrap');
        if (!dropdown || !home) return;
        if (dropdown.parentElement === document.body) {
            home.appendChild(dropdown);
        }
    }

    /** Modal taşmasında tıklama kaybını önlemek için fixed konumlandırma (body portal) */
    _positionTableNameDropdown() {
        const input = document.getElementById('newTableNameInput');
        const dropdown = document.getElementById('tableNameDropdown');
        if (!input || !dropdown || dropdown.classList.contains('hidden')) return;

        const rect = input.getBoundingClientRect();
        const gap = 4;
        const maxHCap = Math.min(window.innerHeight * 0.5, 288);
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const spaceAbove = rect.top - gap;
        const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;

        dropdown.style.position = 'fixed';
        dropdown.style.left = `${Math.max(8, rect.left)}px`;
        dropdown.style.width = `${Math.min(rect.width, window.innerWidth - 16)}px`;
        dropdown.style.right = 'auto';
        dropdown.style.zIndex = '99999';

        if (openUp) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = `${Math.max(8, window.innerHeight - rect.top + gap)}px`;
            dropdown.style.maxHeight = `${Math.min(maxHCap, spaceAbove - 8)}px`;
        } else {
            dropdown.style.top = `${rect.bottom + gap}px`;
            dropdown.style.bottom = 'auto';
            dropdown.style.maxHeight = `${Math.min(maxHCap, spaceBelow - 8)}px`;
        }
    }

    _resetTableNameDropdownPosition() {
        const dropdown = document.getElementById('tableNameDropdown');
        if (!dropdown) return;
        dropdown.style.position = '';
        dropdown.style.left = '';
        dropdown.style.top = '';
        dropdown.style.bottom = '';
        dropdown.style.width = '';
        dropdown.style.right = '';
        dropdown.style.zIndex = '';
        dropdown.style.maxHeight = '';
    }

    _bindTableNameDropdownReposition() {
        if (this._tableNameDropdownRepositionHandler) return;
        this._tableNameDropdownRepositionHandler = () => {
            const input = document.getElementById('newTableNameInput');
            if (input?._dropdownOpen) this._positionTableNameDropdown();
        };
        window.addEventListener('resize', this._tableNameDropdownRepositionHandler);
        window.addEventListener('scroll', this._tableNameDropdownRepositionHandler, true);
    }

    _unbindTableNameDropdownReposition() {
        if (!this._tableNameDropdownRepositionHandler) return;
        window.removeEventListener('resize', this._tableNameDropdownRepositionHandler);
        window.removeEventListener('scroll', this._tableNameDropdownRepositionHandler, true);
    }

    /** Combobox'u ilk kez / modal her açıldığında kur */
    _setupCreateTableCombobox() {
        const input = document.getElementById('newTableNameInput');
        const dropdown = document.getElementById('tableNameDropdown');
        const chevron = document.getElementById('tableNameChevron');
        const toggleBtn = document.getElementById('tableNameToggleBtn');
        const confirmBtn = document.getElementById('confirmCreateTableBtn');
        const hint = document.getElementById('tableNameHint');
        const hideExistingBtn = document.getElementById('createTableHideExistingBtn');
        if (!input || !dropdown) return;

        const closeDropdown = () => {
            dropdown.classList.add('hidden');
            if (chevron) chevron.style.transform = '';
            input._dropdownOpen = false;
            this._unmountTableNameDropdownPortal();
            this._resetTableNameDropdownPosition();
            this._unbindTableNameDropdownReposition();
        };
        const openDropdown = () => {
            this._renderTableNameDropdown(input.value);
            this._mountTableNameDropdownPortal();
            dropdown.classList.remove('hidden');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
            input._dropdownOpen = true;
            requestAnimationFrame(() => {
                this._positionTableNameDropdown();
            });
            this._bindTableNameDropdownReposition();
        };
        this._closeTableNameDropdown = closeDropdown;
        const toggleDropdown = () => {
            if (input._dropdownOpen) closeDropdown();
            else openDropdown();
        };

        // Zaten bağlandıysa tekrar bağlama
        if (input._comboboxBound) {
            closeDropdown();
            return;
        }
        input._comboboxBound = true;
        input._dropdownOpen = false;

        if (hideExistingBtn && !hideExistingBtn.dataset.bound) {
            hideExistingBtn.dataset.bound = '1';
            hideExistingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._createTableHideExisting = !this._createTableHideExisting;
                this._syncCreateTableHideExistingBtnUi();
                if (input._dropdownOpen) {
                    this._renderTableNameDropdown(input.value);
                    requestAnimationFrame(() => this._positionTableNameDropdown());
                } else {
                    openDropdown();
                }
            });
        }
        this._syncCreateTableHideExistingBtnUi();

        const updateHint = () => {
            const val = input.value.trim();
            if (confirmBtn) confirmBtn.disabled = !val;
            if (!hint) return;
            if (!val) {
                hint.textContent = 'Listeden seçin veya özel isim yazın';
                hint.className = 'mt-1.5 text-xs text-gray-400';
            } else {
                const already = this.getTableList().find(t => t.name === val);
                const variety = this._getSubcategoryVarietyLabel(val, already);
                const varietyNote = variety
                    ? (variety.isEstimate ? ` · ${variety.text} çeşit tahmini` : ` · ${variety.text} ürün`)
                    : '';
                hint.textContent = already
                    ? `"${val}" zaten mevcut${varietyNote} — seçince o tabloya geçilir`
                    : `"${val}" oluşturulabilir${varietyNote}`;
                hint.className = `mt-1.5 text-xs ${already ? 'text-amber-500' : 'text-green-600'}`;
            }
        };

        // Dropdown yalnızca tıklayınca açılır — focus ile otomatik açılmaz
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleDropdown();
                input.focus();
            });
        }

        input.addEventListener('click', () => {
            if (!input._dropdownOpen) openDropdown();
        });

        input.addEventListener('input', () => {
            if (input._dropdownOpen) {
                this._renderTableNameDropdown(input.value);
                this._positionTableNameDropdown();
            }
            updateHint();
        });

        const pickDropdownItem = (e) => {
            e.stopPropagation();
            const item = e.target.closest('[data-cat]');
            if (!item) return;
            input.value = item.dataset.cat || '';
            updateHint();
            closeDropdown();
            input.focus();
        };

        // Input blur olmasın diye mousedown engelle; seçim click ile (capture race yok)
        dropdown.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        dropdown.addEventListener('click', pickDropdownItem);

        // Dışarı tıklayınca kapat — bubble (dropdown seçimi önce işlenir)
        document.addEventListener('pointerdown', (e) => {
            const modal = document.getElementById('createTableModal');
            if (!modal || modal.classList.contains('hidden') || !input._dropdownOpen) return;
            const wrap = document.getElementById('tableNameComboboxWrap');
            if (dropdown.contains(e.target)) return;
            if (wrap && wrap.contains(e.target)) return;
            closeDropdown();
        });

        // Escape ile kapat
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { closeDropdown(); input.blur(); }
            if (e.key === 'ArrowDown' && !input._dropdownOpen) {
                e.preventDefault();
                openDropdown();
                const first = dropdown.querySelector('[data-cat]');
                if (first) first.focus();
            }
            if (e.key === 'ArrowDown' && input._dropdownOpen) {
                const first = dropdown.querySelector('[data-cat]');
                if (first) { e.preventDefault(); first.focus(); }
            }
        });
        dropdown.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { closeDropdown(); input.focus(); }
            if (e.key === 'ArrowDown') {
                const next = document.activeElement?.nextElementSibling;
                if (next) { e.preventDefault(); next.focus(); }
            }
            if (e.key === 'ArrowUp') {
                const prev = document.activeElement?.previousElementSibling;
                if (prev) { e.preventDefault(); prev.focus(); }
                else { closeDropdown(); input.focus(); }
            }
            if (e.key === 'Enter') {
                const item = document.activeElement?.closest('[data-cat]');
                if (item) item.click();
            }
        });
    }

    /** Günlük tablolar hariç mevcut genel tablo adları */
    _getExistingGeneralTableNames() {
        return new Set(
            this.getTableList()
                .filter((t) => !this.isDailyTableName(t.name))
                .map((t) => t.name)
        );
    }

    /** Henüz oluşturulmamış sabit alt kategori sayısı (günlük tablolar dahil edilmez) */
    _getRemainingPresetSubcategoryCount() {
        const existing = this._getExistingGeneralTableNames();
        return COUNTING_SUBCATEGORIES.filter((c) => !existing.has(c)).length;
    }

    /** Kalan kategoriler için tahmini toplam ürün çeşidi */
    _getRemainingEstimatedVarietyCount() {
        const existing = this._getExistingGeneralTableNames();
        let sum = 0;
        for (const cat of COUNTING_SUBCATEGORIES) {
            if (!existing.has(cat)) {
                sum += COUNTING_SUBCATEGORY_ESTIMATES[cat] || 0;
            }
        }
        return sum;
    }

    /** Sayılan çeşit: yalnızca sabit alt kategori tabloları (günlük asla dahil değil) */
    _getTotalCountedProductVarietyCount() {
        const seen = new Set();
        const tables = this.cachedFullData?._tables;
        if (!tables || typeof tables !== 'object') return 0;
        for (const [tableName, tableData] of Object.entries(tables)) {
            if (!this.isValidTableNameKey(tableName)) continue;
            if (this.isDailyTableName(tableName)) continue;
            if (!this.isPresetSubcategoryTable(tableName)) continue;
            if (!tableData || typeof tableData !== 'object') continue;
            for (const [pid, data] of Object.entries(tableData)) {
                if (this.isReservedCountingKey(pid) || !data || typeof data !== 'object') continue;
                if (data.warehouseStock !== null && data.warehouseStock !== undefined) {
                    seen.add(pid);
                }
            }
        }
        return seen.size;
    }

    _updateCreateTablePresetRemaining() {
        const el = document.getElementById('createTablePresetRemaining');
        if (!el) return;
        const remaining = this._getRemainingPresetSubcategoryCount();
        const total = COUNTING_SUBCATEGORIES.length;
        const created = total - remaining;
        const counted = this._getTotalCountedProductVarietyCount();
        const estRemaining = this._getRemainingEstimatedVarietyCount();
        el.innerHTML = `
            <span class="flex flex-col items-end gap-1">
                <span class="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5">
                    <span><strong class="text-slate-700 font-semibold">${remaining}</strong> kategori kaldı</span>
                    <span class="text-slate-300">/</span>
                    <span>${total}</span>
                </span>
                <span class="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
                    <span>~<strong class="font-semibold text-violet-600/85">${estRemaining.toLocaleString('tr-TR')}</strong> çeşit tahmini kaldı</span>
                    <span class="text-slate-300">·</span>
                    <span><strong class="font-semibold text-slate-600">${counted.toLocaleString('tr-TR')}</strong> sayılan çeşit</span>
                </span>
            </span>`;
        el.title = `${created} kategori oluşturuldu · ${remaining} kaldı · ~${estRemaining.toLocaleString('tr-TR')} çeşit tahmini kaldı · günlük tablolar hariç`;
        this._syncCreateTableHideExistingBtnUi();
    }

    _syncCreateTableHideExistingBtnUi() {
        const btn = document.getElementById('createTableHideExistingBtn');
        if (!btn) return;
        const on = this._createTableHideExisting === true;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.classList.toggle('border-violet-300', on);
        btn.classList.toggle('bg-violet-50', on);
        btn.classList.toggle('text-violet-800', on);
        btn.classList.toggle('ring-2', on);
        btn.classList.toggle('ring-violet-200/70', on);
        btn.classList.toggle('border-slate-200', !on);
        btn.classList.toggle('bg-white', !on);
        btn.classList.toggle('text-slate-600', !on);
    }

    _clearFinancePasteGuide() {
        this._financePasteGuide = null;
        this._financePasteGuideSkt = new Map();
        this._financePasteGuideSktLinkReady = false;
        this._financePasteGuideSktUrl = null;
        this._financePasteGuideSelectedIndex = null;
    }

    _financePasteGuideMatchesCurrentTable() {
        if (!this._financePasteGuide) return false;
        return this._financePasteGuide.tableKey === this.selectedFinancialTable;
    }

    async importFinancePasteFromClipboard(tableProducts) {
        if (this.selectedFinancialTable === 'all') {
            this.showToast('Önce tek bir tablo seçin', 'warning', 2500);
            return;
        }
        const parser = window.SayimClipboardImport?.parseClipboardText;
        if (typeof parser !== 'function') {
            this.showToast('İçe aktarma modülü yüklenemedi.', 'error', 3000);
            return;
        }
        let rawText = '';
        try {
            rawText = await navigator.clipboard.readText();
        } catch (e) {
            this.showToast('Panoya erişilemedi', 'error', 3000);
            return;
        }
        const parsed = parser(rawText);
        if (!parsed.ok || !parsed.items?.length) {
            this.showToast(parsed.error || 'Geçerli satır bulunamadı.', 'error', 4000);
            return;
        }

        const productById = new Map(
            (Array.isArray(tableProducts) ? tableProducts : [])
                .filter((p) => p?.productId)
                .map((p) => [p.productId, p])
        );
        const ordered = [];
        let unmatched = 0;
        for (const row of parsed.items) {
            const catalog = this.matchDailyImportRow(row);
            const pid = catalog?.id || catalog?.productId;
            if (!pid || !productById.has(pid)) {
                unmatched++;
                continue;
            }
            ordered.push(productById.get(pid));
        }

        this._financePasteGuide = {
            tableKey: this.selectedFinancialTable,
            items: ordered,
            totalPaste: parsed.items.length,
            unmatched,
        };
        this._financePasteGuideSkt = new Map();
        this._financePasteGuideSktLinkReady = false;
        this._financePasteGuideSktUrl = null;
        this._financePasteGuideSelectedIndex = null;

        if (this._lastFinanceExecutiveProducts) {
            this.renderFinancialExecutiveReport(
                this._lastFinanceExecutiveProducts,
                this._lastFinanceExecutiveSummary
            );
        }
        this.showToast(
            `${ordered.length} ürün eşleşti${unmatched ? ` · ${unmatched} tabloda yok` : ''}`,
            ordered.length ? 'success' : 'warning',
            2500
        );
    }

    _formatPasteGuideStock(val) {
        if (val === null || val === undefined || val === '') return '—';
        return String(val);
    }

    /** Rehber satırı — güncel sayım verisi + orijinal fiyat toggle */
    _getFinancePasteGuideItemDisplay(p) {
        const pid = p?.productId;
        const tableName = this.selectedFinancialTable;
        const entry =
            tableName && tableName !== 'all' && pid && this.cachedFullData?._tables?.[tableName]
                ? this.cachedFullData._tables[tableName][pid]
                : null;

        const warehouseRaw = entry?.warehouseStock ?? p?.warehouseStock;
        const systemRaw = entry?.systemStock ?? p?.systemStock;
        const warehouseStock =
            warehouseRaw !== null && warehouseRaw !== undefined && warehouseRaw !== ''
                ? Number(warehouseRaw)
                : null;
        const systemStock =
            systemRaw !== null && systemRaw !== undefined && systemRaw !== ''
                ? Number(systemRaw)
                : null;
        const mergedEntry = entry ? this._mergeEntryWithPriceCacheForFinance(pid, entry) : null;
        const resolvedPrice = mergedEntry
            ? this._resolveFinancePrice(mergedEntry)
            : (p?.price != null ? Number(p.price) : null);
        const price = resolvedPrice ?? 0;
        const priceText = resolvedPrice
            ? (mergedEntry
                ? (this._resolveFinancePriceText(mergedEntry) || this.formatCurrency(resolvedPrice))
                : (p?.priceText || this.formatCurrency(resolvedPrice)))
            : '—';
        const stockDiff =
            warehouseStock !== null && systemStock !== null && !Number.isNaN(warehouseStock) && !Number.isNaN(systemStock)
                ? warehouseStock - systemStock
                : null;
        const difference =
            stockDiff !== null && resolvedPrice && resolvedPrice > 0 ? stockDiff * resolvedPrice : null;

        return { warehouseStock, systemStock, price, priceText, stockDiff, difference };
    }

    _getFinancePasteGuideSktEntries(productId) {
        if (!productId) return [];
        return this._financePasteGuideSkt.get(String(productId)) || [];
    }

    _renderFinancePasteGuideSktHtml(productId) {
        const entries = this._getFinancePasteGuideSktEntries(productId);
        if (!entries.length) {
            return '';
        }
        const chips = entries
            .map(
                (e) =>
                    `<span class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-100/80"><span>${this.escapeHtml(e.date)}</span><span class="font-bold">×${e.qty}</span></span>`
            )
            .join('');
        return `<div class="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]"><span class="shrink-0 font-semibold text-gray-500">SKT</span>${chips}</div>`;
    }

    _getFinancePasteGuideWarehouseId() {
        return this.cachedFullData?._api_info?.warehouseId || '5dcafe6ae2c61b1e52cf1704';
    }

    _formatFinancePasteGuideSktStartDate() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _buildFinancePasteGuideSktUrl(productIds) {
        const warehouseId = this._getFinancePasteGuideWarehouseId();
        const ids = (productIds || []).map(String).filter(Boolean).join(',');
        const startDate = this._formatFinancePasteGuideSktStartDate();
        return `https://warehouse.getir.com/r/${warehouseId}/stock/stock-management/product/expiration/list?offset=1&productIds=${ids}&startDate=${startDate}&endDate=2030-07-31`;
    }

    _sortFinancePasteGuideSktEntries(entries) {
        entries.sort((a, b) => {
            const [da, ma, ya] = String(a.date).split('.').map(Number);
            const [db, mb, yb] = String(b.date).split('.').map(Number);
            return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
        });
    }

    _mergeFinancePasteGuideSktRows(rows) {
        let mergedCount = 0;
        for (const row of rows || []) {
            const pid = String(row.productId || '').trim();
            const date = String(row.date || '').trim();
            const qty = Number(row.qty);
            if (!pid || !date || !qty || Number.isNaN(qty)) continue;

            if (!this._financePasteGuideSkt.has(pid)) {
                this._financePasteGuideSkt.set(pid, []);
            }
            const arr = this._financePasteGuideSkt.get(pid);
            const existing = arr.find((e) => e.date === date);
            if (existing) existing.qty += qty;
            else arr.push({ date, qty });
            this._sortFinancePasteGuideSktEntries(arr);
            mergedCount++;
        }
        return mergedCount;
    }

    _parseFinancePasteGuideSktHtml(htmlText) {
        const raw = String(htmlText || '').trim();
        if (!raw) return { ok: false, error: 'Yapıştırılan metin boş', rows: [] };

        let doc;
        try {
            doc = new DOMParser().parseFromString(raw, 'text/html');
        } catch (e) {
            return { ok: false, error: 'HTML okunamadı', rows: [] };
        }

        const rows = [];
        doc.querySelectorAll('tr[data-row-key]').forEach((tr) => {
            if (tr.classList.contains('ant-table-measure-row')) return;
            const productId = tr.getAttribute('data-row-key');
            if (!productId) return;

            const expiryCell = tr.querySelector('td.expiryDate');
            let date = '';
            if (expiryCell) {
                const spaceItem = expiryCell.querySelector('.ant-space-item');
                date = (spaceItem?.textContent || expiryCell.textContent || '').trim();
            }
            if (!date) return;

            const cells = tr.querySelectorAll('td.ant-table-cell');
            const qtyCell = cells.length ? cells[cells.length - 1] : null;
            const qty = qtyCell ? parseInt(String(qtyCell.textContent).trim(), 10) : NaN;
            if (!qty || Number.isNaN(qty)) return;

            rows.push({ productId, date, qty });
        });

        if (!rows.length) {
            return {
                ok: false,
                error: 'SKT tablosu bulunamadı. Warehouse sayfasından tablo HTML\'ini kopyalayın.',
                rows: [],
            };
        }
        return { ok: true, rows };
    }

    _countFinancePasteGuideSktMatched() {
        const guide = this._financePasteGuideMatchesCurrentTable() ? this._financePasteGuide : null;
        if (!guide?.items?.length) return 0;
        const guideIds = new Set(guide.items.map((p) => String(p?.productId)).filter(Boolean));
        let count = 0;
        guideIds.forEach((pid) => {
            if ((this._financePasteGuideSkt.get(pid) || []).length) count++;
        });
        return count;
    }

    _refreshFinancePasteGuideSection() {
        if (this._lastFinanceExecutiveProducts) {
            this.renderFinancialExecutiveReport(
                this._lastFinanceExecutiveProducts,
                this._lastFinanceExecutiveSummary
            );
        }
    }

    prepareFinancePasteGuideSktLink() {
        const guide = this._financePasteGuideMatchesCurrentTable() ? this._financePasteGuide : null;
        if (!guide?.items?.length) {
            this.showToast('Önce rehber listesini yapıştırın', 'warning', 2500);
            return;
        }

        const productIds = guide.items.map((p) => p?.productId).filter(Boolean);
        if (!productIds.length) {
            this.showToast('Ürün kimliği bulunamadı', 'error', 3000);
            return;
        }

        const url = this._buildFinancePasteGuideSktUrl(productIds);
        this._financePasteGuideSktLinkReady = true;
        this._financePasteGuideSktUrl = url;

        this._updateFinancePasteGuideStatus(
            `${productIds.length} ürün · linke gidin · tablo HTML\'ini kopyalayıp SKT Yapıştır`
        );
        this._refreshFinancePasteGuideSection();

        try {
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {
            /* popup engellendi */
        }

        void navigator.clipboard
            .writeText(url)
            .then(() => {
                this.showToast('SKT linki kopyalandı · SKT Yapıştır aktif', 'success', 3200);
            })
            .catch(() => {
                this.showToast('SKT linki hazır · SKT Yapıştır aktif', 'success', 2800);
            });
    }

    async importFinancePasteGuideSktFromClipboard() {
        if (!this._financePasteGuideSktLinkReady) {
            this.showToast('Önce SKT Getir ile linki oluşturun', 'warning', 2500);
            return;
        }

        const guide = this._financePasteGuideMatchesCurrentTable() ? this._financePasteGuide : null;
        if (!guide?.items?.length) {
            this.showToast('Rehber listesi yok', 'warning', 2500);
            return;
        }

        let rawText = '';
        try {
            rawText = await navigator.clipboard.readText();
        } catch (e) {
            this.showToast('Panoya erişilemedi', 'error', 3000);
            return;
        }

        const parsed = this._parseFinancePasteGuideSktHtml(rawText);
        if (!parsed.ok || !parsed.rows?.length) {
            this.showToast(parsed.error || 'SKT satırı bulunamadı', 'error', 4000);
            return;
        }

        const mergedCount = this._mergeFinancePasteGuideSktRows(parsed.rows);
        const matched = this._countFinancePasteGuideSktMatched();
        this._updateFinancePasteGuideStatus(
            `${matched}/${guide.items.length} ürün SKT · ${mergedCount} satır işlendi · tekrar yapıştırabilirsiniz`
        );
        this._renderFinancePasteGuideList();
        this.showToast(`${mergedCount} SKT satırı eklendi`, 'success', 2500);
    }

    _updateFinancePasteGuideStatus(text) {
        const status = document.getElementById('financePasteGuideStatus');
        if (status) status.textContent = text || '';
    }

    _renderFinancePasteGuideRowHtml(p, idx) {
        const img = this.escapeHtml(p.imageUrl || '../assets/logo.png');
        const name = this.escapeHtml(p.productName || '');
        const d = this._getFinancePasteGuideItemDisplay(p);
        const depo = this._formatPasteGuideStock(d.warehouseStock);
        const sistem = this._formatPasteGuideStock(d.systemStock);
        const adetStr =
            d.stockDiff !== null ? (d.stockDiff > 0 ? `+${d.stockDiff}` : `${d.stockDiff}`) : '';
        const stockDiffClass =
            d.stockDiff > 0 ? 'text-emerald-700' : d.stockDiff < 0 ? 'text-rose-700' : 'text-gray-600';
        const toneClass =
            d.stockDiff > 0 ? 'text-emerald-700' : d.stockDiff < 0 ? 'text-rose-700' : 'text-gray-600';
        const tlClass =
            d.stockDiff > 0 ? 'text-emerald-800' : d.stockDiff < 0 ? 'text-rose-800' : 'text-gray-700';
        let adetLabel = '';
        if (d.stockDiff > 0) adetLabel = `${adetStr} adet fazla`;
        else if (d.stockDiff < 0) adetLabel = `${adetStr} adet eksik`;

        const barcodeList =
            Array.isArray(p.barcodes) && p.barcodes.length ? p.barcodes : p.barcode ? [p.barcode] : [];
        const hasBarcodes = barcodeList.some((b) => {
            if (b == null) return false;
            if (typeof b === 'object' && b.code != null) return String(b.code).trim().length > 0;
            return String(b).trim().length > 0;
        });
        const barcodesHiddenClass = this._financeBarcodesVisible ? '' : 'hidden';
        const barcodesHtml = hasBarcodes
            ? `<div class="finance-barcodes-block mt-1.5 ${barcodesHiddenClass}" aria-hidden="${this._financeBarcodesVisible ? 'false' : 'true'}">${this.renderFinanceScannableBarcodesHtml(barcodeList, { maxVisible: 2 })}</div>`
            : '';

        const selected = this._financePasteGuideSelectedIndex === idx;
        const rowBgClass =
            d.stockDiff < 0
                ? 'border-rose-100/90 bg-rose-50/85'
                : d.stockDiff > 0
                  ? 'border-emerald-100/90 bg-emerald-50/85'
                  : 'border-slate-100 bg-white';
        const selectedClass = selected ? 'ring-2 ring-slate-400/90 shadow-sm' : '';
        const sktHtml = this._renderFinancePasteGuideSktHtml(p?.productId);

        return `
            <div class="finance-paste-guide-row flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-shadow sm:gap-3 sm:px-3 ${rowBgClass} ${selectedClass}" data-guide-index="${idx}" role="button" tabindex="0" aria-pressed="${selected ? 'true' : 'false'}">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">${idx + 1}</span>
                <img src="${img}" alt="" class="h-10 w-10 shrink-0 rounded-md border border-slate-100 object-cover sm:h-11 sm:w-11" loading="lazy" />
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium leading-snug text-gray-900 [overflow-wrap:anywhere]">${name}</p>
                    ${barcodesHtml}
                    <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                        <span>Depo: <strong>${depo}</strong></span>
                        <span>Sistem: <strong>${sistem}</strong></span>
                        ${d.stockDiff !== null ? `<span class="font-semibold ${stockDiffClass}">(${adetStr})</span>` : ''}
                    </div>
                    <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        ${adetLabel ? `<span class="font-semibold ${toneClass}">${adetLabel}</span>` : ''}
                        <span class="text-gray-500">Birim ${this.escapeHtml(d.priceText)}</span>
                        ${
                            d.difference !== null
                                ? `<span class="font-bold ${tlClass}">${d.difference >= 0 ? '+' : ''}${this.formatCurrency(d.difference)}</span>`
                                : ''
                        }
                    </div>
                    ${sktHtml}
                </div>
            </div>`;
    }

    _renderFinancePasteGuideHtml() {
        const guide = this._financePasteGuideMatchesCurrentTable() ? this._financePasteGuide : null;
        const canPaste = this.selectedFinancialTable !== 'all';
        const hasItems = !!(guide?.items?.length);
        const sktLinkReady = !!(hasItems && this._financePasteGuideSktLinkReady && this._financePasteGuideSktUrl);
        const sktMatched = hasItems ? this._countFinancePasteGuideSktMatched() : 0;
        const listHtml = hasItems
            ? guide.items.map((p, idx) => this._renderFinancePasteGuideRowHtml(p, idx)).join('')
            : `<p class="py-6 text-center text-xs text-gray-400">${canPaste ? 'Liste yapıştırınca eşleşen ürünler burada sırayla görünür.' : 'Tek tablo seçin, ardından sayım listesini yapıştırın.'}</p>`;
        const headerHtml = hasItems
            ? `<div class="finance-paste-guide-head sticky top-0 z-10 mb-1.5 hidden items-center gap-2.5 rounded-lg bg-slate-100/95 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur sm:flex sm:gap-3 sm:px-3">
                    <span class="w-6 shrink-0 text-center">#</span>
                    <span class="w-10 shrink-0 sm:w-11"></span>
                    <span class="min-w-0 flex-1">Ürün · depo / sistem / birim</span>
               </div>`
            : '';
        const sktPanelHtml = sktLinkReady
            ? `<div id="financePasteGuideSktPanel" class="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
                    <p class="text-[11px] font-semibold text-amber-950">Warehouse SKT linki hazır</p>
                    <p class="mt-1 text-[10px] text-amber-900/80">Linke gidin · tabloyu kopyalayın · <strong>SKT Yapıştır</strong> · sayfa sayfa tekrarlayın</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                        <a href="${this.escapeHtml(this._financePasteGuideSktUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex max-w-full items-center rounded-md bg-white px-2.5 py-1.5 text-[10px] font-semibold text-amber-950 ring-1 ring-amber-200 hover:bg-amber-50 truncate">Warehouse SKT sayfasını aç</a>
                        <button type="button" id="financePasteGuideSktCopyLinkBtn" class="rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100">Linki kopyala</button>
                    </div>
               </div>`
            : '';

        const statusText = guide
            ? sktLinkReady
                ? `${sktMatched}/${guide.items.length} ürün SKT · linke gidin · SKT Yapıştır aktif`
                : `${guide.items.length} ürün · yapıştırma sırası`
            : '';

        return `
            <div class="finance-paste-guide-section -mx-1 mt-5 rounded-xl border border-slate-200/80 bg-slate-50/50 px-2 py-4 sm:-mx-2 sm:px-4" id="financePasteGuideSection">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h4 class="text-sm font-semibold text-gray-900">Sayım Sırası Rehberi</h4>
                        <p class="mt-0.5 text-[11px] text-gray-500">Kaydedilmez · sayfa yenilenince silinir · fiyatlar ${this._financeUseStruckPrice ? 'orijinal' : 'satış'} fiyatına göre</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <button type="button" id="financePasteGuideBtn" class="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none" ${canPaste ? '' : 'disabled'} title="Panodan sayım listesi yapıştır">
                            Yapıştır
                        </button>
                        ${hasItems ? `<button type="button" id="financePasteGuideClearBtn" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Temizle</button>` : ''}
                        ${hasItems ? `<button type="button" id="financePasteGuideSktBtn" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100" title="Tüm ürünler için warehouse SKT linki oluştur">SKT Getir</button>` : ''}
                        ${hasItems ? `<button type="button" id="financePasteGuideSktPasteBtn" class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-40 disabled:pointer-events-none" ${sktLinkReady ? '' : 'disabled'} title="Warehouse tablo HTML\'ini panodan yapıştır">SKT Yapıştır</button>` : ''}
                    </div>
                </div>
                <span id="financePasteGuideStatus" class="mb-2 block text-xs text-gray-500 min-h-[1rem]" role="status" aria-live="polite">${statusText}</span>
                ${sktPanelHtml}
                ${headerHtml}
                <div id="financePasteGuideList" class="finance-paste-guide-list max-h-[min(38rem,72vh)] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">${listHtml}</div>
            </div>`;
    }

    _renderFinancePasteGuideList() {
        const list = document.getElementById('financePasteGuideList');
        if (!list) return;
        const guide = this._financePasteGuideMatchesCurrentTable() ? this._financePasteGuide : null;
        if (!guide?.items?.length) {
            list.innerHTML = '<p class="py-6 text-center text-xs text-gray-400">Liste yapıştırınca eşleşen ürünler burada sırayla görünür.</p>';
            return;
        }
        list.innerHTML = guide.items.map((p, idx) => this._renderFinancePasteGuideRowHtml(p, idx)).join('');
    }

    _bindFinancePasteGuide(container, tableProducts) {
        if (!container) return;
        const pasteBtn = container.querySelector('#financePasteGuideBtn');
        const clearBtn = container.querySelector('#financePasteGuideClearBtn');
        const sktBtn = container.querySelector('#financePasteGuideSktBtn');
        const sktPasteBtn = container.querySelector('#financePasteGuideSktPasteBtn');
        const sktCopyLinkBtn = container.querySelector('#financePasteGuideSktCopyLinkBtn');
        const list = container.querySelector('#financePasteGuideList');
        if (pasteBtn) {
            pasteBtn.addEventListener('click', () => {
                void this.importFinancePasteFromClipboard(tableProducts);
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this._clearFinancePasteGuide();
                this._updateFinancePasteGuideStatus('');
                void this.renderFinancialTab();
            });
        }
        if (sktBtn) {
            sktBtn.addEventListener('click', () => {
                this.prepareFinancePasteGuideSktLink();
            });
        }
        if (sktPasteBtn) {
            sktPasteBtn.addEventListener('click', () => {
                void this.importFinancePasteGuideSktFromClipboard();
            });
        }
        if (sktCopyLinkBtn && this._financePasteGuideSktUrl) {
            sktCopyLinkBtn.addEventListener('click', () => {
                void navigator.clipboard
                    .writeText(this._financePasteGuideSktUrl)
                    .then(() => this.showToast('SKT linki kopyalandı', 'success', 2000))
                    .catch(() => this.showToast('Link kopyalanamadı', 'error', 2500));
            });
        }
        if (list && !list.dataset.guideSelectBound) {
            list.dataset.guideSelectBound = '1';
            list.addEventListener('click', (e) => {
                const row = e.target.closest('[data-guide-index]');
                if (!row) return;
                const idx = parseInt(row.getAttribute('data-guide-index'), 10);
                if (Number.isNaN(idx)) return;
                this._financePasteGuideSelectedIndex = this._financePasteGuideSelectedIndex === idx ? null : idx;
                this._renderFinancePasteGuideList();
                const updated = list.querySelector(`[data-guide-index="${idx}"]`);
                if (updated && this._financePasteGuideSelectedIndex === idx) {
                    updated.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
            list.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const row = e.target.closest('[data-guide-index]');
                if (!row) return;
                e.preventDefault();
                row.click();
            });
        }
    }

    /** Dropdown listesini query'e göre yeniden çizer */
    _renderTableNameDropdown(query = '') {
        const dropdown = document.getElementById('tableNameDropdown');
        if (!dropdown) return;

        const q = query.trim().toLocaleLowerCase('tr');
        const tableByName = new Map(
            this.getTableList()
                .filter((t) => !this.isDailyTableName(t.name))
                .map((t) => [t.name, t])
        );

        let filtered = q
            ? COUNTING_SUBCATEGORIES.filter(c => c.toLocaleLowerCase('tr').includes(q))
            : COUNTING_SUBCATEGORIES;

        if (this._createTableHideExisting) {
            filtered = filtered.filter((cat) => !tableByName.has(cat));
        }

        if (filtered.length === 0) {
            const emptyMsg = this._createTableHideExisting
                ? (q ? 'Kalan kategorilerde arama sonucu yok.' : 'Tüm kategoriler oluşturulmuş — filtreyi kapatın.')
                : 'Sonuç bulunamadı';
            dropdown.innerHTML = `<div class="px-4 py-3 text-sm text-gray-400 text-center">${emptyMsg}</div>`;
            return;
        }

        dropdown.innerHTML = filtered.map(cat => {
            const tableRow = tableByName.get(cat);
            const isExisting = !!tableRow;
            const varietyBadge = this._renderSubcategoryVarietyBadgeHtml(cat, tableRow);
            const existingBadge = isExisting
                ? `<span class="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">Mevcut</span>`
                : '';
            const rightBadges = [varietyBadge, existingBadge].filter(Boolean).join('');
            return `
                <button
                    type="button"
                    data-cat="${cat.replace(/"/g, '&quot;')}"
                    tabindex="-1"
                    class="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                >
                    <span class="flex-1 min-w-0 break-words leading-snug">${this.escapeHtml(cat)}</span>
                    ${rightBadges ? `<span class="ml-auto flex shrink-0 items-center gap-2">${rightBadges}</span>` : ''}
                </button>`;
        }).join('');
        this._updateCreateTablePresetRemaining();
    }

    /** Modal kapanınca combobox'u sıfırla */
    _resetCreateTableCombobox() {
        const input = document.getElementById('newTableNameInput');
        const dropdown = document.getElementById('tableNameDropdown');
        const chevron = document.getElementById('tableNameChevron');
        const confirmBtn = document.getElementById('confirmCreateTableBtn');
        const hint = document.getElementById('tableNameHint');
        if (input) {
            input.value = '';
            input._dropdownOpen = false;
        }
        if (dropdown) {
            dropdown.classList.add('hidden');
            this._unmountTableNameDropdownPortal();
        }
        this._resetTableNameDropdownPosition();
        this._unbindTableNameDropdownReposition();
        if (chevron) chevron.style.transform = '';
        if (confirmBtn) confirmBtn.disabled = true;
        if (hint) {
            hint.textContent = 'Listeden seçin veya özel isim yazın';
            hint.className = 'mt-1.5 text-xs text-gray-400';
        }
        this._createTableHideExisting = false;
        this._syncCreateTableHideExistingBtnUi();
        this._updateCreateTablePresetRemaining();
    }

    // Create a new table
    async createTable(tableName, options = {}) {
        if (!tableName || tableName.trim() === '') {
            throw new Error('Tablo adı boş olamaz');
        }

        const useBusy = options.skipRender !== true && !this._importInProgress;
        if (useBusy) this.showCountingStatus('Tablo oluşturuluyor…', 'Kısa sürecek', { lock: true });

        try {
        const trimmed = tableName.trim();
        const fromTable = this.currentTableName;

        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
            this._saveDebounceTimer = null;
        }
        void this._flushPendingProductSaves(fromTable);
        this._persistTableSlotLocally(fromTable);

        if (!options.allowDaily && trimmed.startsWith(this.DAILY_TABLE_PREFIX)) {
            throw new Error('Bu isim günlük sayım için ayrılmıştır; genel tabloda kullanılamaz');
        }

        const fullData = this.cachedFullData || { _api_info: {}, _tables: {} };
        if (!fullData._tables) fullData._tables = {};

        if (fullData._tables[trimmed]) {
            throw new Error('Bu isimde bir tablo zaten mevcut');
        }

        const nowIso = new Date().toISOString();
        const newTableMeta = { createdAt: nowIso, lastActivityAt: nowIso };
        if (this.countingData && fromTable) {
            this._safeWriteTableSlot(fullData._tables, fromTable, this.countingData);
        }
        this.cachedFullData = fullData;
        fullData._tables[trimmed] = { _tableMeta: newTableMeta, _productOrder: [] };
        if (!fullData._tableMeta) fullData._tableMeta = {};
        fullData._tableMeta[trimmed] = {
            createdAt: nowIso,
            lastActivityAt: nowIso,
            _productOrder: [],
        };

        this._activateCountingTable(trimmed, { fromTable, persistFrom: false });
        this._saveDeviceCurrentTable(trimmed);
        this._persistCurrentTableToMeta();
        this.touchTableLastActivity(trimmed, nowIso);

        this.pushAuditEntry(
            options.allowDaily
                ? `Günlük tablo oluşturuldu · ${this.formatTableDisplayName(trimmed)}`
                : `Tablo oluşturuldu · ${this.formatTableDisplayName(trimmed)}`,
            { cat: 'table', tbl: trimmed }
        );

        this._scheduleMetaSave(250);

        if (options.skipRender === true) return;

        // Re-render UI
        this.renderTable();
        this.updateStatistics();
        this.updateActiveTableActivityLine();
        this.updateTableSelector();
        this.syncSayimSubTabToTable();
        } finally {
            if (useBusy) this.hideCountingStatus();
        }
    }
    async deleteTable(tableName) {
        if (!tableName || this._isTableTombstoned(tableName)) return;

        const fullData = this.cachedFullData || { _api_info: {}, _tables: {} };
        if (!fullData._tables) return;

        const tableNames = Object.keys(fullData._tables).filter((n) => !this._isTableTombstoned(n));
        if (tableNames.length <= 1) {
            throw new Error('En az bir tablo bulunmalıdır');
        }

        this._deletedTableTombstones.add(tableName);

        delete fullData._tables[tableName];
        if (fullData._tableMeta) delete fullData._tableMeta[tableName];

        this.pushAuditEntry(`Tablo silindi · ${this.formatTableDisplayName(tableName)}`, { cat: 'table', tbl: tableName });

        if (tableName === this.currentTableName) {
            const newTableName = Object.keys(fullData._tables).find((n) => !this._isTableTombstoned(n));
            if (!newTableName) {
                this._deletedTableTombstones.delete(tableName);
                throw new Error('En az bir tablo bulunmalıdır');
            }
            this.currentTableName = newTableName;
            this._saveDeviceCurrentTable(newTableName);
            this._persistCurrentTableToMeta();
            this.countingData = fullData._tables[newTableName] || {};
        }

        this.cachedFullData = fullData;
        this._saveFullBlobToLocalStorage();

        this.renderTable();
        this.updateStatistics();
        this.updateTableSelector();
        this.syncSayimSubTabToTable();
        this.syncDeleteTableButtonsVisibility();

        void (async () => {
            try {
                await this.deleteTableEntries(tableName);
                await this._saveMetaOnly();
            } finally {
                this._deletedTableTombstones.delete(tableName);
            }
        })();
    }

    // Get list of all tables
    getTableList() {
        const fullData = this.cachedFullData;

        if (!fullData || !fullData._tables) {
            return [{ name: 'Ana Sayım', isCurrent: true }];
        }

        const tableNames = Object.keys(fullData._tables).filter(
            (name) => this.isValidTableNameKey(name) && !this._isTableTombstoned(name)
        );
        const rows = tableNames.map((name) => {
            const tableData = this.resolveTableDataForList(name);
            this.syncTableLastActivityMeta(name, tableData);
            const lastActivityMs = this.resolveLastCountActivityMs(tableData, name) ?? 0;
            const createdAtMs = this.resolveTableCreatedMs(tableData) ?? 0;
            const statusSummary = this.getTableStatusSummary(tableData);
            const orderLen = Array.isArray(tableData._productOrder)
                ? tableData._productOrder.length
                : (this.cachedFullData?._tableMeta?.[name]?._productOrder?.length || 0);
            return {
                name,
                isCurrent: name === this.currentTableName,
                productCount: Math.max(this._countTableProductKeys(tableData), orderLen),
                status: statusSummary.status,
                _sortLastMs: Math.max(lastActivityMs, createdAtMs),
                _sortCreatedMs: createdAtMs,
            };
        });
        rows.sort((a, b) => {
            if (b._sortLastMs !== a._sortLastMs) return b._sortLastMs - a._sortLastMs;
            if (b._sortCreatedMs !== a._sortCreatedMs) return b._sortCreatedMs - a._sortCreatedMs;
            return String(a.name).localeCompare(String(b.name), 'tr');
        });
        return rows.map(({ _sortLastMs, _sortCreatedMs, ...rest }) => rest);
    }

    /**
     * Tablo finansal kar/zararı (TL): Σ (depo − sistem) × fiyat
     * Finans sekmesiyle aynı mantık; fiyatı olmayan ürünler toplama dahil edilmez.
     */
    calculateTableProfitLoss(tableData) {
        if (!tableData || typeof tableData !== 'object') return 0;

        let profitLoss = 0;
        const productIds = Object.keys(tableData).filter((k) => !this.isReservedCountingKey(k));

        for (const pid of productIds) {
            const data = tableData[pid];
            if (!data || typeof data !== 'object') continue;

            const warehouseStock = data.warehouseStock;
            const systemStock = data.systemStock;
            if (warehouseStock === null || warehouseStock === undefined) continue;
            if (systemStock === null || systemStock === undefined) continue;

            const price = this._resolveFinancePrice(data);
            if (!price || Number.isNaN(price)) continue;

            profitLoss += (Number(warehouseStock) - Number(systemStock)) * price;
        }

        return profitLoss;
    }

    /** API ürün satırından fiyat alanlarını çıkar */
    _extractPriceFieldsFromApiProduct(foundProduct) {
        if (!foundProduct || typeof foundProduct !== 'object') {
            return { price: null, priceText: null, struckPrice: null, struckPriceText: null };
        }
        const pricing = foundProduct.pricing || foundProduct.priceInfo || foundProduct.product?.pricing || null;
        const price =
            foundProduct.price ??
            foundProduct.salePrice ??
            foundProduct.currentPrice ??
            pricing?.price ??
            pricing?.salePrice ??
            null;
        const priceText =
            foundProduct.priceText ??
            foundProduct.salePriceText ??
            pricing?.priceText ??
            null;
        let struckPrice =
            foundProduct.struckPrice ??
            foundProduct.struck_price ??
            foundProduct.originalPrice ??
            foundProduct.listPrice ??
            pricing?.struckPrice ??
            pricing?.originalPrice ??
            pricing?.listPrice ??
            null;
        let struckPriceText =
            foundProduct.struckPriceText ??
            foundProduct.struck_price_text ??
            foundProduct.originalPriceText ??
            pricing?.struckPriceText ??
            null;
        if ((struckPrice === null || struckPrice === undefined) && foundProduct.product) {
            const nested = this._extractPriceFieldsFromApiProduct(foundProduct.product);
            if (nested.struckPrice != null) struckPrice = nested.struckPrice;
            if (nested.struckPriceText) struckPriceText = nested.struckPriceText;
            if ((price === null || price === undefined) && nested.price != null) {
                return { ...nested, price: nested.price ?? price, priceText: nested.priceText ?? priceText };
            }
        }
        return { price, priceText, struckPrice, struckPriceText };
    }

    _countingEntryNeedsPriceEnrichment(entry) {
        if (!entry || typeof entry !== 'object') return false;
        const hasPrice = entry.price != null && !Number.isNaN(Number(entry.price)) && Number(entry.price) > 0;
        if (!hasPrice) return true;
        if (entry._apiNoStruckPrice === true) return false;
        const hasStruck =
            entry.struckPrice != null && !Number.isNaN(Number(entry.struckPrice)) && Number(entry.struckPrice) > 0;
        return !hasStruck;
    }

    _finalizeStruckPriceState(entry) {
        if (!entry || typeof entry !== 'object') return;
        const hasStruck =
            entry.struckPrice != null && !Number.isNaN(Number(entry.struckPrice)) && Number(entry.struckPrice) > 0;
        if (hasStruck) {
            entry._apiNoStruckPrice = false;
        }
    }

    _markNoStruckPriceConfirmed(entry) {
        if (!entry || typeof entry !== 'object') return;
        const hasStruck =
            entry.struckPrice != null && !Number.isNaN(Number(entry.struckPrice)) && Number(entry.struckPrice) > 0;
        if (!hasStruck) entry._apiNoStruckPrice = true;
    }

    _mergePriceFieldsIntoCountingEntry(entry, fields) {
        if (!entry || !fields) return;
        if (fields.price != null && fields.price !== undefined && !Number.isNaN(Number(fields.price))) {
            entry.price = Number(fields.price);
        }
        if (fields.priceText) entry.priceText = fields.priceText;
        if (fields.struckPrice != null && fields.struckPrice !== undefined && !Number.isNaN(Number(fields.struckPrice))) {
            const sp = Number(fields.struckPrice);
            if (sp > 0) {
                entry.struckPrice = sp;
                entry._apiNoStruckPrice = false;
            }
        }
        if (fields.struckPriceText) entry.struckPriceText = fields.struckPriceText;
        if (fields._apiNoStruckPrice === true) entry._apiNoStruckPrice = true;
        entry._pricesEnrichedAt = new Date().toISOString();
        this._finalizeStruckPriceState(entry);
    }

    _resolveCountingEntryForTable(tableName, productId) {
        if (tableName === this.currentTableName && this.countingData?.[productId]) {
            return this.countingData[productId];
        }
        return this.cachedFullData?._tables?.[tableName]?.[productId] || null;
    }

    _cacheProductPriceFields(productId, fields, entryRef = null) {
        if (!productId || !fields) return;
        const prev = this._productPriceCache.get(productId) || {};
        const merged = {
            price: fields.price ?? prev.price ?? null,
            priceText: fields.priceText ?? prev.priceText ?? null,
            struckPrice: fields.struckPrice ?? prev.struckPrice ?? null,
            struckPriceText: fields.struckPriceText ?? prev.struckPriceText ?? null,
            _apiNoStruckPrice: fields._apiNoStruckPrice ?? prev._apiNoStruckPrice ?? false,
        };
        if (entryRef) {
            if (merged._apiNoStruckPrice !== true) {
                const hasStruck =
                    entryRef.struckPrice != null &&
                    !Number.isNaN(Number(entryRef.struckPrice)) &&
                    Number(entryRef.struckPrice) > 0;
                if (!hasStruck && entryRef.price != null) merged._apiNoStruckPrice = true;
            }
        }
        this._productPriceCache.set(productId, merged);
    }

    _mergeEntryWithPriceCacheForFinance(productId, entry) {
        if (!entry) return entry;
        const cached = this._productPriceCache.get(productId);
        if (!cached) return entry;
        const out = { ...entry };
        if ((out.price == null || Number(out.price) <= 0) && cached.price != null) out.price = cached.price;
        if (!out.priceText && cached.priceText) out.priceText = cached.priceText;
        if ((out.struckPrice == null || Number(out.struckPrice) <= 0) && cached.struckPrice != null) {
            out.struckPrice = cached.struckPrice;
        }
        if (!out.struckPriceText && cached.struckPriceText) out.struckPriceText = cached.struckPriceText;
        if (cached._apiNoStruckPrice === true) out._apiNoStruckPrice = true;
        return out;
    }

    _getTableFinanceCacheKey(tableName) {
        const td = this.cachedFullData?._tables?.[tableName];
        if (!td) return `${tableName}:0`;
        let count = 0;
        let sig = 0;
        for (const [k, v] of Object.entries(td)) {
            if (this.isReservedCountingKey(k) || !v || typeof v !== 'object') continue;
            count++;
            sig +=
                (Number(v.warehouseStock) || 0) * 10007 +
                (Number(v.systemStock) || 0) * 1009 +
                (Number(v.price) || 0) * 17 +
                (Number(v.struckPrice) || 0) * 23;
        }
        return `${tableName}:${count}:${sig}:${this._financeUseStruckPrice ? 1 : 0}:${this._productPriceCache.size}`;
    }

    _invalidateFinanceCache(tableName) {
        if (tableName) this._financeCalcCache.delete(tableName);
        this._financeCalcCache.delete('__all__');
    }

    _scheduleFinanceRefresh(tableName) {
        if (this._financeBgRefreshTimer) clearTimeout(this._financeBgRefreshTimer);
        this._financeBgRefreshTimer = setTimeout(() => {
            this._financeBgRefreshTimer = null;
            if (this.currentTab !== 'finans') return;
            if (tableName) this._invalidateFinanceCache(tableName);
            else this._financeCalcCache.clear();
            void this.renderFinancialDataForSelection({ skipBackgroundEnrich: true });
        }, 350);
    }

    async _fetchAndMergeProductPrices(productId, tableName) {
        const entry = this._resolveCountingEntryForTable(tableName, productId);
        if (!entry) return false;

        const cached = this._productPriceCache.get(productId);
        if (cached && this._countingEntryNeedsPriceEnrichment(entry)) {
            this._mergePriceFieldsIntoCountingEntry(entry, cached);
            if (tableName === this.currentTableName && this.countingData[productId]) {
                this._mergePriceFieldsIntoCountingEntry(this.countingData[productId], cached);
            }
            if (!this._countingEntryNeedsPriceEnrichment(entry)) return true;
        }
        if (!this._countingEntryNeedsPriceEnrichment(entry)) return false;

        if (this._priceFetchInFlight.has(productId)) return false;
        const product = this.productIndex.get(productId);
        if (!product) return false;
        const barcode = product.barcodes?.[0]?.code;
        if (!barcode) return false;

        this._priceFetchInFlight.add(productId);
        try {
            const result = await this.requestStockFromExtension(product.name, barcode, productId, { quiet: true });
            if (!result || typeof result !== 'object') return false;
            this._mergePriceFieldsIntoCountingEntry(entry, result);
            if (tableName === this.currentTableName && this.countingData[productId]) {
                this._mergePriceFieldsIntoCountingEntry(this.countingData[productId], result);
            }
            this._markNoStruckPriceConfirmed(entry);
            if (tableName === this.currentTableName && this.countingData[productId]) {
                this._markNoStruckPriceConfirmed(this.countingData[productId]);
            }
            this._cacheProductPriceFields(productId, {
                price: entry.price,
                priceText: entry.priceText,
                struckPrice: entry.struckPrice,
                struckPriceText: entry.struckPriceText,
                _apiNoStruckPrice: entry._apiNoStruckPrice === true,
            });
            return true;
        } catch (e) {
            return false;
        } finally {
            this._priceFetchInFlight.delete(productId);
        }
    }

    async _ensureTablePricesEnriched(tableName, options = {}) {
        if (!tableName || this.isDailyTableName(tableName)) return false;
        const tableData = this.cachedFullData?._tables?.[tableName];
        if (!tableData || typeof tableData !== 'object') return false;
        const ids = Object.keys(tableData).filter((k) => !this.isReservedCountingKey(k));
        const need = ids.filter((pid) => this._countingEntryNeedsPriceEnrichment(tableData[pid]));
        if (need.length === 0) return false;
        const batchSize = options.batchSize || 5;
        let changed = false;
        for (let i = 0; i < need.length; i += batchSize) {
            const batch = need.slice(i, i + batchSize);
            const results = await Promise.all(batch.map((pid) => this._fetchAndMergeProductPrices(pid, tableName)));
            if (results.some(Boolean)) changed = true;
        }
        if (changed && options.save !== false) {
            if (tableName === this.currentTableName) {
                await this.saveCountingDataForTable(tableName).catch(() => {});
            } else {
                await this._saveMetaOnly().catch(() => {});
            }
            this._invalidateFinanceCache(tableName);
        }
        return changed;
    }

    _scheduleBackgroundPriceEnrichment(tableNameOrNames) {
        const names = Array.isArray(tableNameOrNames) ? tableNameOrNames : [tableNameOrNames];
        names.forEach((n) => {
            if (n && !this.isDailyTableName(n)) this._financeBgEnrichQueue.add(n);
        });
        if (this._financeBgEnrichQueue.size === 0 || this._financeBgEnrichRunner) return;
        this._financeBgEnrichRunner = this._runFinanceBackgroundPriceEnrichment();
    }

    async _runFinanceBackgroundPriceEnrichment() {
        let changed = false;
        try {
            while (this._financeBgEnrichQueue.size > 0) {
                const tableName = this._financeBgEnrichQueue.values().next().value;
                this._financeBgEnrichQueue.delete(tableName);
                const c = await this._ensureTablePricesEnriched(tableName, { batchSize: 5 });
                if (c) changed = true;
            }
        } finally {
            this._financeBgEnrichRunner = null;
        }
        if (changed && this.currentTab === 'finans') {
            this._scheduleFinanceRefresh(tableName);
        }
    }

    /** Finans hesabına dahil sabit alt kategori tabloları (günlük hariç) */
    getFinanceEligibleTableNames() {
        return this.getTableList()
            .filter((t) => !this.isDailyTableName(t.name) && this.isPresetSubcategoryTable(t.name))
            .map((t) => t.name);
    }

    _syncFinancialTableFromSayim() {
        const current = this.currentTableName;
        const eligible = this.getFinanceEligibleTableNames();
        if (current && !this.isDailyTableName(current)) {
            const exists = this.getTableList().some((t) => t.name === current);
            if (exists) {
                this.selectedFinancialTable = current;
                return;
            }
        }
        if (
            this.selectedFinancialTable &&
            this.selectedFinancialTable !== 'all' &&
            !this.isDailyTableName(this.selectedFinancialTable) &&
            this.getTableList().some((t) => t.name === this.selectedFinancialTable)
        ) {
            return;
        }
        if (eligible.length > 0) {
            this.selectedFinancialTable = eligible[0];
            return;
        }
        if (current && !this.isDailyTableName(current)) {
            this.selectedFinancialTable = current;
        }
    }

    async renderFinancialDataForSelection(options = {}) {
        const skipBg = options.skipBackgroundEnrich === true;
        if (this.selectedFinancialTable === 'all') {
            await this.renderAllTablesFinancialData();
        } else if (this.selectedFinancialTable) {
            await this.renderSingleTableFinancialData(this.selectedFinancialTable);
            if (!skipBg) this._scheduleBackgroundPriceEnrichment(this.selectedFinancialTable);
        } else {
            this._syncFinancialTableFromSayim();
            await this.renderFinancialDataForSelection(options);
        }
    }

    /** Toggle'a göre finans fiyatını seç: struckPrice (varsa, toggle açıksa) veya price */
    _resolveFinancePrice(data) {
        if (!data) return null;
        if (this._financeUseStruckPrice) {
            const sp = Number(data.struckPrice);
            if (!Number.isNaN(sp) && sp > 0) return sp;
        }
        const p = Number(data.price);
        return (!Number.isNaN(p) && p > 0) ? p : null;
    }

    /** Toggle'a göre finans fiyat metnini seç */
    _resolveFinancePriceText(data) {
        if (!data) return null;
        if (this._financeUseStruckPrice) {
            const sp = Number(data.struckPrice);
            if (!Number.isNaN(sp) && sp > 0) return data.struckPriceText || this.formatCurrency(sp);
        }
        return data.priceText || (data.price ? this.formatCurrency(Number(data.price)) : null);
    }

    /**
     * Tablo sayım durumu — TAMAMEN FİNANSAL TL BAZLI değerlendirme.
     * Renk kararı ürün ADEDİNE değil, Σ (depo − sistem) × fiyat sonucuna göre verilir.
     *
     * - Hiç ürün yok / hiç sayım yok                     → not-started (gri)
     * - Finansal kar/zarar hesaplanmış ve > 0            → complete-positive (yeşil) — yarım da olsa
     * - Finansal kar/zarar hesaplanmış ve < 0            → complete-negative (kırmızı) — yarım da olsa
     * - Tüm ürünlerin sayımı tamam, kar/zarar = 0        → complete-positive (yeşil) — denge tam tutmuş
     * - Sayım yarım ve henüz net finans yok (price 0 vb) → incomplete (açık mavi)
     */
    getTableStatusSummary(tableData) {
        if (!tableData || typeof tableData !== 'object') {
            return { status: 'not-started', profitLoss: 0 };
        }

        const productIds = Object.keys(tableData).filter((k) => !this.isReservedCountingKey(k));
        if (productIds.length === 0) {
            return { status: 'not-started', profitLoss: 0 };
        }

        let startedCount = 0;
        let completeCount = 0;

        for (const pid of productIds) {
            const data = tableData[pid];
            if (!data || typeof data !== 'object') continue;

            const hasWarehouse = data.warehouseStock !== null && data.warehouseStock !== undefined;
            const hasSystem = data.systemStock !== null && data.systemStock !== undefined;

            if (!hasWarehouse && !hasSystem) continue;

            startedCount++;
            if (hasWarehouse && hasSystem) completeCount++;
        }

        if (startedCount === 0) {
            return { status: 'not-started', profitLoss: 0 };
        }

        const profitLoss = this.calculateTableProfitLoss(tableData);

        // TL bazlı kar → yeşil (yarım/tam fark etmez)
        if (profitLoss > 0) {
            return { status: 'complete-positive', profitLoss };
        }
        // TL bazlı zarar → kırmızı (yarım/tam fark etmez)
        if (profitLoss < 0) {
            return { status: 'complete-negative', profitLoss };
        }
        // profitLoss === 0
        // Tüm ürünler tamam ve denge tutmuş → yeşil
        if (completeCount === productIds.length) {
            return { status: 'complete-positive', profitLoss: 0 };
        }
        // Yarım sayım + henüz net finans hesabı yok → mavi
        return { status: 'incomplete', profitLoss: 0 };
    }

    getTableStatusChipClasses(status, isActive) {
        const map = {
            'not-started': 'bg-slate-100 text-slate-600 border-slate-200',
            incomplete: 'bg-sky-50 text-sky-900 border-sky-200',
            'complete-positive': 'bg-emerald-50 text-emerald-900 border-emerald-200',
            'complete-negative': 'bg-red-50 text-red-900 border-red-200',
            'complete-balanced': 'bg-emerald-50 text-emerald-900 border-emerald-200',
        };
        const base = map[status] || map['not-started'];
        const active = isActive ? ' ring-2 ring-blue-400 ring-offset-1 shadow-sm font-semibold' : ' hover:brightness-[0.98]';
        return `sayim-general-table-chip relative shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${base}${active}`;
    }

    getTableStatusCountBadgeClasses(status, isActive) {
        if (isActive) return 'text-blue-700';
        const map = {
            'not-started': 'text-slate-400',
            incomplete: 'text-sky-600',
            'complete-positive': 'text-emerald-600',
            'complete-negative': 'text-red-600',
            'complete-balanced': 'text-emerald-600',
        };
        return map[status] || map['not-started'];
    }

    getTableStatusDropdownRowClasses(status, isActive) {
        const map = {
            'not-started': isActive ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50',
            incomplete: isActive ? 'bg-sky-50 text-sky-900' : 'text-sky-900 hover:bg-sky-50/80',
            'complete-positive': isActive ? 'bg-emerald-50 text-emerald-900' : 'text-emerald-900 hover:bg-emerald-50/80',
            'complete-negative': isActive ? 'bg-red-50 text-red-900' : 'text-red-900 hover:bg-red-50/80',
            'complete-balanced': isActive ? 'bg-emerald-50 text-emerald-900' : 'text-emerald-900 hover:bg-emerald-50/80',
        };
        return map[status] || map['not-started'];
    }

    /** Stok farkı checkbox etiketi — sayım şeridiyle aynı finansal durum renkleri */
    getTableStatusFarkLabelClasses(status) {
        const map = {
            'not-started':
                'border-slate-200/90 bg-slate-50 text-slate-700 hover:border-slate-300 has-[:checked]:border-slate-400 has-[:checked]:ring-2 has-[:checked]:ring-slate-200/80 has-[:checked]:shadow-sm',
            incomplete:
                'border-sky-200 bg-sky-50/90 text-sky-900 hover:border-sky-300 has-[:checked]:border-sky-400 has-[:checked]:ring-2 has-[:checked]:ring-sky-200/90 has-[:checked]:shadow-sm',
            'complete-positive':
                'border-emerald-200 bg-emerald-50/90 text-emerald-900 hover:border-emerald-300 has-[:checked]:border-emerald-400 has-[:checked]:ring-2 has-[:checked]:ring-emerald-200/90 has-[:checked]:shadow-sm',
            'complete-negative':
                'border-red-200 bg-red-50/90 text-red-900 hover:border-red-300 has-[:checked]:border-red-400 has-[:checked]:ring-2 has-[:checked]:ring-red-200/90 has-[:checked]:shadow-sm',
            'complete-balanced':
                'border-emerald-200 bg-emerald-50/90 text-emerald-900 hover:border-emerald-300 has-[:checked]:border-emerald-400 has-[:checked]:ring-2 has-[:checked]:ring-emerald-200/90 has-[:checked]:shadow-sm',
        };
        return map[status] || map['not-started'];
    }

    /** Stok farkı listesinde gösterilecek tablolar (günlük gizleme filtresi) */
    getFarkVisibleTables() {
        const tables = this.getTableList();
        if (!this._farkHideDailyTables) return tables;
        return tables.filter((t) => !this.isDailyTableName(t.name));
    }

    getFarkVisibleTableNames() {
        return this.getFarkVisibleTables().map((t) => t.name);
    }

    _syncFarkHideDailyBtnUi() {
        const btn = document.getElementById('farkHideDailyBtn');
        if (!btn) return;
        const hidden = !!this._farkHideDailyTables;
        btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
        btn.textContent = hidden ? 'Günlük sayımları göster' : 'Günlük sayımları gizle';
        btn.classList.toggle('border-indigo-300', hidden);
        btn.classList.toggle('bg-indigo-50', hidden);
        btn.classList.toggle('text-indigo-800', hidden);
    }

    _setFarkHideDailyTables(hidden) {
        this._farkHideDailyTables = !!hidden;
        try {
            sessionStorage.setItem('counting_fark_hide_daily', this._farkHideDailyTables ? '1' : '0');
        } catch (e) {
            /* ignore */
        }
        if (this._farkHideDailyTables && this._farkTableSelection instanceof Set) {
            for (const name of [...this._farkTableSelection]) {
                if (this.isDailyTableName(name)) this._farkTableSelection.delete(name);
            }
        }
        this._syncFarkHideDailyBtnUi();
        this.populateFarkTableCheckboxes();
        void this.renderFarkOzeti();
    }

    isDailyTableName(name) {
        return typeof name === 'string' && name.startsWith(this.DAILY_TABLE_PREFIX);
    }

    getIsoFromDailyTableName(name) {
        if (!this.isDailyTableName(name)) return null;
        return name.slice(this.DAILY_TABLE_PREFIX.length);
    }

    getLocalDateIso() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    formatDailyDateLabelFromIso(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
        const [yy, mm, dd] = iso.split('-').map(Number);
        const dt = new Date(yy, mm - 1, dd);
        return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    formatTableDisplayName(name) {
        if (!name) return '—';
        if (this.isDailyTableName(name)) {
            const iso = this.getIsoFromDailyTableName(name);
            return this.formatDailyDateLabelFromIso(iso);
        }
        return name;
    }

    /** Tablo adı sabit alt kategori listesinden mi (combobox ile oluşturulan) */
    isPresetSubcategoryTable(name) {
        if (!name || typeof name !== 'string') return false;
        return COUNTING_SUBCATEGORIES_SET.has(name.trim());
    }

    _getSubcategoryVarietyLabel(catName, tableRow = null) {
        const name = String(catName || '').trim();
        if (!name) return null;
        const existing = tableRow || this.getTableList().find((t) => t.name === name);
        if (existing) {
            const n = existing.productCount ?? 0;
            return {
                text: n.toLocaleString('tr-TR'),
                isEstimate: false,
                title: 'Eklenen ürün çeşidi',
            };
        }
        const estimate = COUNTING_SUBCATEGORY_ESTIMATES[name];
        if (estimate == null) return null;
        return {
            text: `~${estimate.toLocaleString('tr-TR')}`,
            isEstimate: true,
            title: 'Tahmini ürün çeşidi',
        };
    }

    _renderSubcategoryVarietyBadgeHtml(catName, tableRow = null) {
        const label = this._getSubcategoryVarietyLabel(catName, tableRow);
        if (!label) return '';
        const cls = label.isEstimate
            ? 'text-[11px] tabular-nums text-slate-400 font-medium shrink-0'
            : 'text-[11px] tabular-nums text-slate-500 font-semibold shrink-0';
        return `<span class="${cls}" title="${this.escapeHtml(label.title)}">${this.escapeHtml(label.text)}</span>`;
    }

    /** Sol üst köşe yıldız rozeti — tablo adıyla çakışmaması için mutlak konumlu */
    renderPresetSubcategoryBadgeHtml() {
        const title = 'Sabit alt kategori tablosu';
        return `<span class="preset-subcat-table-badge" title="${title}" aria-label="${title}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.35 7.23H22l-6.05 4.39 2.31 7.13L12 16.9l-6.26 4.85 2.31-7.13L2 9.23h7.65z"/></svg></span>`;
    }

    /** Dar alanlar (finans seçici butonu) için satır içi mini yıldız */
    renderPresetSubcategoryInlineStarHtml() {
        return `<svg class="preset-subcat-inline-star shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" title="Sabit alt kategori tablosu"><path d="M12 2l2.35 7.23H22l-6.05 4.39 2.31 7.13L12 16.9l-6.26 4.85 2.31-7.13L2 9.23h7.65z"/></svg>`;
    }

    /** Sabit alt kategori chip'leri — hafif amber vurgu */
    getPresetSubcategoryChipAccentClasses() {
        return ' preset-subcat-table-chip';
    }

    /** Tablo nesnesinde ürün dışı anahtarlar (metadata) */
    isReservedCountingKey(key) {
        return (
            key === '_api_info' ||
            key === '_tableMeta' ||
            key === '_productOrder' ||
            key === '_tables' ||
            key === '_currentTable' ||
            key === '_auditLog' ||
            key === '_writerDeviceId' ||
            key === '_writerAt'
        );
    }

    /** _tables kökünde geçerli tablo adı mı */
    isValidTableNameKey(name) {
        if (!name || typeof name !== 'string') return false;
        if (this.isReservedCountingKey(name)) return false;
        return true;
    }

    /** Ürün satırı mı (depo/sistem sayım verisi) */
    _looksLikeProductRow(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
        if (obj._tableMeta || obj._tables) return false;
        return (
            'warehouseStock' in obj ||
            'systemStock' in obj ||
            'lastUpdated' in obj ||
            Array.isArray(obj.history)
        );
    }

    /** İç içe tablo blob'u — ürün satırı değil, başka tablonun tamamı */
    _looksLikeNestedTableBlob(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
        if (obj._tables && typeof obj._tables === 'object') return true;
        if (obj._tableMeta && typeof obj._tableMeta === 'object') return true;
        return false;
    }

    /**
     * Tablo slotuna güvenli yazım — _tables haritasının kendisini iç içe gömmeyi engeller.
     */
    _safeWriteTableSlot(tablesMap, tableName, tableData) {
        if (!tablesMap || !tableName || !tableData) return;
        if (tableData === tablesMap) return;
        if (tableData._tables && tableData._tables === tablesMap) return;
        tablesMap[tableName] = tableData;
    }

    /** Bozuk iç içe tabloları üst _tables seviyesine taşır / temizler */
    sanitizeTablesStructure(fullData) {
        if (!fullData || typeof fullData !== 'object') return fullData;
        if (!fullData._tables || typeof fullData._tables !== 'object') {
            fullData._tables = {};
            return fullData;
        }

        const root = fullData._tables;
        let changed = false;

        const mergeTableObjects = (target, source) => {
            if (!target || !source || typeof target !== 'object' || typeof source !== 'object') return;
            for (const [k, v] of Object.entries(source)) {
                if (this.isReservedCountingKey(k)) {
                    if (k === '_tableMeta' && v && typeof v === 'object') {
                        if (!target._tableMeta) target._tableMeta = {};
                        Object.assign(target._tableMeta, v);
                        changed = true;
                    } else if (k === '_productOrder' && Array.isArray(v)) {
                        const cur = Array.isArray(target._productOrder) ? target._productOrder : [];
                        const merged = [...cur];
                        const seen = new Set(cur);
                        for (const id of v) {
                            if (seen.has(id)) continue;
                            merged.push(id);
                            seen.add(id);
                        }
                        target._productOrder = merged;
                        changed = true;
                    }
                    continue;
                }
                if (this._looksLikeNestedTableBlob(v)) continue;
                if (this._looksLikeProductRow(v)) {
                    const incTs = v.lastUpdated ? new Date(v.lastUpdated).getTime() : 0;
                    const locTs = target[k]?.lastUpdated ? new Date(target[k].lastUpdated).getTime() : 0;
                    if (!target[k] || incTs >= locTs) {
                        target[k] = v;
                        changed = true;
                    }
                }
            }
        };

        const hoistTable = (name, tableObj) => {
            const tName = String(name || '').trim();
            if (!this.isValidTableNameKey(tName) || !tableObj || typeof tableObj !== 'object') return;
            if (tableObj === root || (tableObj._tables && tableObj._tables === root)) return;

            if (tableObj._tables && typeof tableObj._tables === 'object') {
                for (const [nestedName, nestedVal] of Object.entries(tableObj._tables)) {
                    if (nestedVal && typeof nestedVal === 'object') {
                        hoistTable(nestedName, nestedVal);
                    }
                }
            }

            if (!root[tName]) {
                root[tName] = {};
                changed = true;
            }
            mergeTableObjects(root[tName], tableObj);
        };

        for (const [tName, tVal] of Object.entries({ ...root })) {
            if (!this.isValidTableNameKey(tName)) {
                if (tVal && typeof tVal === 'object') {
                    hoistTable(tName, tVal);
                }
                delete root[tName];
                changed = true;
                continue;
            }
            if (!tVal || typeof tVal !== 'object') {
                delete root[tName];
                changed = true;
                continue;
            }
            if (tVal === root || (tVal._tables && tVal._tables === root)) {
                if (tVal._tables) {
                    for (const [nestedName, nestedVal] of Object.entries(tVal._tables)) {
                        if (nestedVal && typeof nestedVal === 'object') hoistTable(nestedName, nestedVal);
                    }
                }
                delete root[tName];
                changed = true;
                continue;
            }
            for (const [k, v] of Object.entries({ ...tVal })) {
                if (this.isReservedCountingKey(k)) continue;
                if (this._looksLikeNestedTableBlob(v)) {
                    hoistTable(k, v);
                    delete tVal[k];
                    changed = true;
                }
            }
        }

        if (changed && this.currentTableName && root[this.currentTableName]) {
            this.countingData = root[this.currentTableName];
        }

        return fullData;
    }

    /**
     * Sayım tablosunda ürün görüntüleme sırası (ekleme veya pano içe aktarma sırası).
     * Supabase/localStorage ile birlikte kaydedilir; farklı cihazda aynı sıra.
     */
    getOrderedProductIds() {
        const raw = Object.keys(this.countingData).filter((k) => !this.isReservedCountingKey(k));
        let order = this.countingData._productOrder;
        if (!Array.isArray(order)) {
            this.countingData._productOrder = [...raw];
            return [...raw];
        }
        const rawSet = new Set(raw);
        const seen = new Set();
        const next = [];
        for (const id of order) {
            if (!rawSet.has(id) || seen.has(id)) continue;
            seen.add(id);
            next.push(id);
        }
        for (const id of raw) {
            if (!seen.has(id)) {
                next.push(id);
                seen.add(id);
            }
        }
        if (next.length !== order.length || next.some((id, i) => id !== order[i])) {
            this.countingData._productOrder = next;
        }
        return next;
    }

    /** Tablo araması aktifken filtrelenmiş; değilse tam sıra */
    getDisplayOrderedProductIds() {
        const all = this.getOrderedProductIds();
        const q = (this._tableProductSearchQuery || '').trim();
        if (q.length < 2) return all;
        return this._filterTableProductIdsBySearch(all, q);
    }

    _productMatchesTableSearch(productId, query) {
        if (!query || query.length < 2) return true;
        const product = this.productIndex.get(productId);
        if (!product) return false;
        const searchTerm = query.trim().toLowerCase();
        const tokens = this.tokenizeQuery(searchTerm);

        if (product.barcodes && product.barcodes.length > 0) {
            for (const barcode of product.barcodes) {
                if (!barcode?.code) continue;
                const codeLower = String(barcode.code).toLowerCase();
                if (codeLower === searchTerm || codeLower.includes(searchTerm)) return true;
            }
        }

        if (product.name) {
            if (this.containsAllTokens(product.name, tokens)) return true;
            const gramMatch = /(\d+)\s*g/i.exec(product.name);
            if (gramMatch) {
                const gramValue = gramMatch[1];
                if (searchTerm.includes(gramValue + 'g') || searchTerm.includes(gramValue + ' g')) return true;
            }
        }

        if (product.brand && this.containsAllTokens(product.brand, tokens)) return true;
        if (product.category && this.containsAllTokens(product.category, tokens)) return true;

        return false;
    }

    _filterTableProductIdsBySearch(productIds, query) {
        const q = (query || '').trim();
        if (!q || q.length < 2) return productIds;
        return productIds.filter((pid) => this._productMatchesTableSearch(pid, q));
    }

    _syncCountingTableSearchUi() {
        const input = document.getElementById('countingTableSearchInput');
        const clearBtn = document.getElementById('countingTableSearchClear');
        const meta = document.getElementById('countingTableSearchMeta');
        const q = (this._tableProductSearchQuery || '').trim();
        if (input && input.value !== q) input.value = q;
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', q.length === 0);
            clearBtn.classList.toggle('inline-flex', q.length > 0);
        }
        if (meta) {
            if (q.length < 2) {
                meta.textContent = '';
            } else {
                const all = this.getOrderedProductIds().length;
                const shown = this.getDisplayOrderedProductIds().length;
                meta.textContent = shown
                    ? `${shown} ürün gösteriliyor${all !== shown ? ` · toplam ${all}` : ''}`
                    : 'Arama ile eşleşen ürün yok';
            }
        }
    }

    bindCountingTableSearch() {
        const input = document.getElementById('countingTableSearchInput');
        const clearBtn = document.getElementById('countingTableSearchClear');
        if (!input || input.dataset.setup === 'true') return;
        input.dataset.setup = 'true';

        const applySearch = () => {
            this._tableProductSearchQuery = input.value;
            this._syncCountingTableSearchUi();
            if (this.currentViewMode === 'rapid') {
                this.renderRapidCountingMode();
            } else {
                this.scheduleRenderTable();
            }
        };

        input.addEventListener('input', () => {
            clearTimeout(this._tableProductSearchTimer);
            this._tableProductSearchTimer = setTimeout(applySearch, 120);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.value = '';
                applySearch();
                input.blur();
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                input.value = '';
                applySearch();
                input.focus();
            });
        }

        this._syncCountingTableSearchUi();
    }

    appendProductToOrder(productId) {
        if (this.isReservedCountingKey(productId)) return;
        const raw = Object.keys(this.countingData).filter((k) => !this.isReservedCountingKey(k));
        if (!Array.isArray(this.countingData._productOrder)) {
            this.countingData._productOrder = [...raw];
            return;
        }
        const list = [...this.countingData._productOrder];
        if (!list.includes(productId)) list.push(productId);
        this.countingData._productOrder = list;
    }

    removeProductFromOrder(productId) {
        if (!Array.isArray(this.countingData._productOrder)) return;
        this.countingData._productOrder = this.countingData._productOrder.filter((id) => id !== productId);
    }

    /**
     * Pano/API içe aktarım: satırların sırası önce gelir; yapıştırmada olmayan mevcut ürünler sonda kalır.
     */
    applyImportedProductOrder(idsInPasteOrder, options = {}) {
        if (!Array.isArray(idsInPasteOrder) || idsInPasteOrder.length === 0) return;
        const pasteSet = new Set(idsInPasteOrder);
        if (options.replaceRest) {
            const raw = Object.keys(this.countingData).filter((k) => !this.isReservedCountingKey(k));
            for (const id of raw) {
                if (!pasteSet.has(id)) delete this.countingData[id];
            }
            this.countingData._productOrder = [...idsInPasteOrder];
            return;
        }
        const raw = Object.keys(this.countingData).filter((k) => !this.isReservedCountingKey(k));
        const rest = raw.filter((id) => !pasteSet.has(id));
        this.countingData._productOrder = [...idsInPasteOrder, ...rest];
    }

    /**
     * Mevcut sırayı korur; yalnızca tabloda olmayan ürünleri yapıştırma sırasıyla sona ekler.
     */
    appendImportedProductOrder(idsInPasteOrder) {
        if (!Array.isArray(idsInPasteOrder) || idsInPasteOrder.length === 0) return 0;
        const order = this.getOrderedProductIds();
        const existingSet = new Set(order);
        const toAppend = [];
        for (const id of idsInPasteOrder) {
            if (existingSet.has(id)) continue;
            toAppend.push(id);
            existingSet.add(id);
        }
        if (toAppend.length === 0) return 0;
        this.countingData._productOrder = [...order, ...toAppend];
        return toAppend.length;
    }

    /** Ürün satırlarının lastUpdated min/max (ms) */
    getProductLastUpdatedBounds(tableData) {
        let minMs = Infinity;
        let maxMs = 0;
        if (!tableData || typeof tableData !== 'object') {
            return { minMs: null, maxMs: null };
        }
        Object.keys(tableData).forEach((key) => {
            if (this.isReservedCountingKey(key)) return;
            const row = tableData[key];
            if (!row || typeof row !== 'object' || !row.lastUpdated) return;
            const t = new Date(row.lastUpdated).getTime();
            if (Number.isNaN(t)) return;
            if (t < minMs) minMs = t;
            if (t > maxMs) maxMs = t;
        });
        return {
            minMs: minMs !== Infinity ? minMs : null,
            maxMs: maxMs > 0 ? maxMs : null
        };
    }

    /** Tablo oluşturulma zamanı: önce _tableMeta.createdAt, yoksa en eski sayım zamanı */
    resolveTableCreatedMs(tableData) {
        if (!tableData || typeof tableData !== 'object') return null;
        const meta = tableData._tableMeta;
        if (meta && meta.createdAt) {
            const t = new Date(meta.createdAt).getTime();
            if (!Number.isNaN(t)) return t;
        }
        const { minMs } = this.getProductLastUpdatedBounds(tableData);
        return minMs;
    }

    /** Son sayım = ürünlerden en güncel lastUpdated + tablo/global lastActivityAt */
    resolveLastCountActivityMs(tableData, tableName) {
        const { maxMs } = this.getProductLastUpdatedBounds(tableData);
        let metaMs = null;
        const candidates = [
            tableData?._tableMeta?.lastActivityAt,
            tableName && this.cachedFullData?._tableMeta?.[tableName]?.lastActivityAt,
        ];
        for (const raw of candidates) {
            if (!raw) continue;
            const t = new Date(raw).getTime();
            if (!Number.isNaN(t)) metaMs = metaMs == null ? t : Math.max(metaMs, t);
        }
        if (maxMs != null && metaMs != null) return Math.max(maxMs, metaMs);
        return maxMs ?? metaMs;
    }

    /** getTableList için tablo verisini çöz (aktif tablo + global meta birleşimi) */
    resolveTableDataForList(tableName) {
        const fullData = this.cachedFullData;
        const tableData =
            tableName === this.currentTableName && this.countingData
                ? this.countingData
                : (fullData?._tables?.[tableName] || {});

        const globalMeta = fullData?._tableMeta?.[tableName];
        if (globalMeta?.lastActivityAt || globalMeta?.createdAt) {
            if (!tableData._tableMeta) tableData._tableMeta = {};
            if (globalMeta.createdAt && !tableData._tableMeta.createdAt) {
                tableData._tableMeta.createdAt = globalMeta.createdAt;
            }
            if (globalMeta.lastActivityAt) {
                const gMs = new Date(globalMeta.lastActivityAt).getTime();
                const lMs = tableData._tableMeta.lastActivityAt
                    ? new Date(tableData._tableMeta.lastActivityAt).getTime()
                    : 0;
                if (!Number.isNaN(gMs) && gMs >= lMs) {
                    tableData._tableMeta.lastActivityAt = globalMeta.lastActivityAt;
                }
            }
        }
        return tableData;
    }

    /** Ürün max(lastUpdated) ile tablo lastActivityAt'ı senkronize eder */
    syncTableLastActivityMeta(tableName, tableData) {
        if (!tableName || !tableData || typeof tableData !== 'object') return;
        const bestMs = this.resolveLastCountActivityMs(tableData, tableName);
        if (bestMs == null) return;

        const ts = new Date(bestMs).toISOString();
        if (!tableData._tableMeta) tableData._tableMeta = {};
        const curMs = tableData._tableMeta.lastActivityAt
            ? new Date(tableData._tableMeta.lastActivityAt).getTime()
            : 0;
        if (bestMs > curMs) tableData._tableMeta.lastActivityAt = ts;

        if (!this.cachedFullData) this.cachedFullData = { _tables: {}, _tableMeta: {} };
        if (!this.cachedFullData._tableMeta) this.cachedFullData._tableMeta = {};
        if (!this.cachedFullData._tableMeta[tableName]) this.cachedFullData._tableMeta[tableName] = {};
        const globalCurMs = this.cachedFullData._tableMeta[tableName].lastActivityAt
            ? new Date(this.cachedFullData._tableMeta[tableName].lastActivityAt).getTime()
            : 0;
        if (bestMs > globalCurMs) {
            this.cachedFullData._tableMeta[tableName].lastActivityAt = ts;
        }
    }

    /** Tablo son sayım zamanını günceller (chip sıralaması + Son Sayım satırı) */
    touchTableLastActivity(tableName, iso) {
        const ts = iso || new Date().toISOString();
        const tName = tableName || this.currentTableName;
        if (!tName) return;

        if (!this.cachedFullData) this.cachedFullData = { _tables: {}, _tableMeta: {} };
        if (!this.cachedFullData._tables) this.cachedFullData._tables = {};
        if (!this.cachedFullData._tableMeta) this.cachedFullData._tableMeta = {};

        let table = this.cachedFullData._tables[tName];
        if (!table) {
            table = {};
            this.cachedFullData._tables[tName] = table;
        }
        if (!table._tableMeta) table._tableMeta = {};
        table._tableMeta.lastActivityAt = ts;

        if (!this.cachedFullData._tableMeta[tName]) this.cachedFullData._tableMeta[tName] = {};
        this.cachedFullData._tableMeta[tName].lastActivityAt = ts;

        if (tName === this.currentTableName) {
            if (!this.countingData._tableMeta) this.countingData._tableMeta = {};
            this.countingData._tableMeta.lastActivityAt = ts;
        }
    }

    /** Eski tablolara createdAt yazar (bir sonraki kayıtta kalıcı) */
    ensureTableMeta(tableData) {
        if (!tableData || typeof tableData !== 'object') return;
        if (tableData._tableMeta && tableData._tableMeta.createdAt) return;
        const { minMs } = this.getProductLastUpdatedBounds(tableData);
        const createdAt =
            minMs != null ? new Date(minMs).toISOString() : new Date().toISOString();
        tableData._tableMeta = { ...(tableData._tableMeta || {}), createdAt };
    }

    formatAbsoluteDateTimeTr(ms) {
        if (ms == null || Number.isNaN(ms)) return '—';
        try {
            return new Date(ms).toLocaleString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '—';
        }
    }

    /** Sadece tarih (aktif tablo kartı — Oluşturulma) */
    formatDateOnlyTr(ms) {
        if (ms == null || Number.isNaN(ms)) return '—';
        try {
            return new Date(ms).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        } catch (e) {
            return '—';
        }
    }

    /**
     * Göreli zaman (Türkçe) — en fazla 2 birim:
     * dakika | saat+dakika | gün+saat | hafta+gün | ay+hafta | yıl+ay
     */
    formatRelativeAgoTr(ms) {
        if (ms == null || Number.isNaN(ms)) return '';
        const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
        if (diffSec < 45) return 'az önce';

        const MIN = 60;
        const HOUR = 3600;
        const DAY = 86400;
        const WEEK = 604800;
        const MONTH = 2592000; // ~30 gün
        const YEAR = 31536000; // ~365 gün

        const part = (value, unit) => (value === 1 ? `1 ${unit}` : `${value} ${unit}`);

        if (diffSec < HOUR) {
            return `${part(Math.floor(diffSec / MIN), 'dakika')} önce`;
        }
        if (diffSec < DAY) {
            const h = Math.floor(diffSec / HOUR);
            const m = Math.floor((diffSec % HOUR) / MIN);
            if (m === 0) return `${part(h, 'saat')} önce`;
            return `${part(h, 'saat')} ${part(m, 'dakika')} önce`;
        }
        if (diffSec < WEEK) {
            const d = Math.floor(diffSec / DAY);
            const h = Math.floor((diffSec % DAY) / HOUR);
            if (h === 0) return `${part(d, 'gün')} önce`;
            return `${part(d, 'gün')} ${part(h, 'saat')} önce`;
        }
        if (diffSec < MONTH) {
            const w = Math.floor(diffSec / WEEK);
            const d = Math.floor((diffSec % WEEK) / DAY);
            if (d === 0) return `${part(w, 'hafta')} önce`;
            return `${part(w, 'hafta')} ${part(d, 'gün')} önce`;
        }
        if (diffSec < YEAR) {
            const mo = Math.floor(diffSec / MONTH);
            const w = Math.floor((diffSec % MONTH) / WEEK);
            if (w === 0) return `${part(mo, 'ay')} önce`;
            return `${part(mo, 'ay')} ${part(w, 'hafta')} önce`;
        }
        const y = Math.floor(diffSec / YEAR);
        const mo = Math.floor((diffSec % YEAR) / MONTH);
        if (mo === 0) return `${part(y, 'yıl')} önce`;
        return `${part(y, 'yıl')} ${part(mo, 'ay')} önce`;
    }

    updateActiveTableActivityLine() {
        const createdEl = document.getElementById('activeTableCreatedAt');
        const lastEl = document.getElementById('activeTableLastCount');
        const legacy = document.getElementById('activeTableActivityLine');

        const tableData = this.countingData;
        const createdMs = this.resolveTableCreatedMs(tableData);
        const lastMs = this.resolveLastCountActivityMs(tableData, this.currentTableName);

        const clockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-slate-400" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>`;
        const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-indigo-500" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`;

        if (createdEl) {
            const createdFull = this.formatAbsoluteDateTimeTr(createdMs);
            createdEl.innerHTML = `${clockSvg}<span class="truncate">${this.escapeHtml(createdFull)}</span>`;
        }
        if (lastEl) {
            if (lastMs == null) {
                lastEl.innerHTML = `${checkSvg}<span>Henüz sayım yok</span>`;
            } else {
                const rel = this.formatRelativeAgoTr(lastMs) || '—';
                lastEl.innerHTML = `${checkSvg}<span class="truncate">${this.escapeHtml(rel)}</span>`;
            }
        }

        if (legacy && !createdEl && !lastEl) {
            const createdStr = this.formatAbsoluteDateTimeTr(createdMs);
            let lastBlock = 'Henüz sayım yok';
            if (lastMs != null) {
                const abs = this.formatAbsoluteDateTimeTr(lastMs);
                const rel = this.formatRelativeAgoTr(lastMs);
                lastBlock = rel ? `${abs} · ${rel}` : abs;
            }
            legacy.innerHTML = `
                <span class="block"><span class="text-slate-600 font-medium">Oluşturulma:</span> ${createdStr}</span>
                <span class="block mt-0.5"><span class="text-slate-600 font-medium">Son sayım:</span> ${lastBlock}</span>
            `;
        }
    }

    /** Son kullanılan genel/günlük tablo bağlamını hatırla */
    _rememberTableContext(tableName) {
        if (!tableName) return;
        if (this.isDailyTableName(tableName)) {
            this._lastDailyTableName = tableName;
        } else {
            this._lastGeneralTableName = tableName;
        }
    }

    _getActiveSayimSubTab() {
        const dailyBtn = document.getElementById('sayimTabDailyBtn');
        if (dailyBtn?.getAttribute('aria-selected') === 'true') return 'daily';
        try {
            const saved = sessionStorage.getItem('sayimSubTab');
            if (saved === 'daily' || saved === 'general') return saved;
        } catch (e) {
            /* ignore */
        }
        return this.isDailyTableName(this.currentTableName) ? 'daily' : 'general';
    }

    _resolveGeneralTableName() {
        if (this.currentTableName && !this.isDailyTableName(this.currentTableName)) {
            return this.currentTableName;
        }
        const last = this._lastGeneralTableName;
        if (last && this.getTableList().some((t) => t.name === last && !this.isDailyTableName(t.name))) {
            return last;
        }
        const first = this.getTableList().find((t) => !this.isDailyTableName(t.name));
        return first?.name || 'Ana Sayım';
    }

    _resolveDailyTableNameForContext() {
        if (this.isDailyTableName(this.currentTableName)) {
            return this.currentTableName;
        }
        const iso = this.getDailySelectedIso();
        const byDate = `${this.DAILY_TABLE_PREFIX}${iso}`;
        if (this.getTableList().some((t) => t.name === byDate)) return byDate;
        if (
            this._lastDailyTableName &&
            this.getTableList().some((t) => t.name === this._lastDailyTableName)
        ) {
            return this._lastDailyTableName;
        }
        const dailyTables = this.getTableList()
            .filter((t) => this.isDailyTableName(t.name))
            .sort((a, b) => b.name.localeCompare(a.name));
        return dailyTables[0]?.name || null;
    }

    async _syncTableToSayimSubTab(subTab) {
        const target =
            subTab === 'daily'
                ? this._resolveDailyTableNameForContext()
                : this._resolveGeneralTableName();
        if (target && target !== this.currentTableName) {
            await this.switchTable(target, { skipCatchUp: subTab === 'daily' });
        }
    }

    /** Ürün eklemeden önce UI alt sekmesi ile aktif tablonun uyumunu doğrula */
    async _ensureAddTargetTableReady() {
        const subTab = this._getActiveSayimSubTab();
        if (subTab === 'daily') {
            if (!this.isDailyTableName(this.currentTableName)) {
                const target = this._resolveDailyTableNameForContext();
                if (target) {
                    await this.switchTable(target);
                } else {
                    this.showNotification(
                        'Ürün eklemek için günlük tablolardan bir gün seçin veya «Gün ekle» ile tablo oluşturun.',
                        'error'
                    );
                    return false;
                }
            }
        } else if (this.isDailyTableName(this.currentTableName)) {
            await this.switchTable(this._resolveGeneralTableName());
        }
        this._verifyCountingDataTableBinding();
        return true;
    }

    _normalizeProductName(name) {
        return String(name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    findProductByExactName(name) {
        const norm = this._normalizeProductName(name);
        if (!norm) return null;
        for (const product of this.allProducts) {
            if (product?.name && this._normalizeProductName(product.name) === norm) {
                return product;
            }
        }
        return null;
    }

    _pickBestNameMatch(query, candidates) {
        const normQ = this._normalizeProductName(query);
        if (!normQ || !Array.isArray(candidates) || candidates.length === 0) return null;

        const qTokens = this.tokenizeQuery(normQ);
        if (qTokens.length === 0) return null;

        let best = null;
        let bestScore = -1;
        for (const product of candidates) {
            const normP = this._normalizeProductName(product?.name);
            if (!normP) continue;
            if (normP === normQ) return product;

            const matched = qTokens.filter((token) => normP.includes(token)).length;
            if (matched !== qTokens.length) continue;

            let score = (matched / qTokens.length) * 40;
            if (normP.startsWith(normQ) || normQ.startsWith(normP)) score += 50;
            score -= Math.abs(normP.length - normQ.length) * 0.05;

            if (score > bestScore) {
                bestScore = score;
                best = product;
            }
        }
        return bestScore >= 35 ? best : null;
    }

    /** Satırda pano/API'den gelen açık miktar var mı (boş string sayılmaz) */
    _rowHasExplicitQuantity(row) {
        if (!row || typeof row !== 'object') return false;
        const q = row.quantity;
        return q !== undefined && q !== null && q !== '';
    }

    /** İçe aktarımda eski depo/sistem stok kalıntılarını temizle */
    _resetCountingEntryStockFields(entry) {
        if (!entry || typeof entry !== 'object') return;
        entry.warehouseStock = null;
        entry.systemStock = null;
        entry.apiFetchFailed = false;
        entry.lastUpdated = new Date().toISOString();
    }

    /**
     * Uzak (Supabase) satırını yerel ile birleştirir.
     * Yeni eklenen ürünlerde yerel null iken uzaktan gelen 0 genelde eski/yanlış kayıttır — ezme.
     */
    _mergeCountingEntryFromRemote(local, incoming) {
        if (!incoming) return local;
        if (!local) {
            return this._hydrateProductEntryTimeline({
                ...incoming,
                history: Array.isArray(incoming.history) ? [...incoming.history] : [],
            });
        }

        const localTs = local.lastUpdated ? new Date(local.lastUpdated).getTime() : 0;
        const incomingTs = incoming.lastUpdated ? new Date(incoming.lastUpdated).getTime() : 0;
        const remoteIsNewer = incomingTs > localTs;

        const pickStock = (field) => {
            const l = local[field];
            const r = incoming[field];
            if (!remoteIsNewer) return l;
            const localUnset = l === null || l === undefined;
            if (localUnset && r === 0) return l;
            return r;
        };

        const localHist = this._splitProductHistoryAndTimeline(local.history || []).stockHist;
        const incomingHist = this._splitProductHistoryAndTimeline(incoming.history || []).stockHist;
        const stockHist =
            remoteIsNewer && incomingHist.length >= localHist.length ? incomingHist : localHist;

        const merged = {
            ...local,
            warehouseStock: pickStock('warehouseStock'),
            systemStock: pickStock('systemStock'),
            price: remoteIsNewer && incoming.price != null ? incoming.price : local.price,
            priceText: remoteIsNewer && incoming.priceText ? incoming.priceText : local.priceText,
            struckPrice:
                remoteIsNewer && incoming.struckPrice != null ? incoming.struckPrice : local.struckPrice,
            struckPriceText:
                remoteIsNewer && incoming.struckPriceText ? incoming.struckPriceText : local.struckPriceText,
            reservedStock:
                remoteIsNewer && incoming.reservedStock != null ? incoming.reservedStock : local.reservedStock,
            apiFetchFailed: remoteIsNewer ? incoming.apiFetchFailed : local.apiFetchFailed,
            lastUpdated: remoteIsNewer ? incoming.lastUpdated : local.lastUpdated,
            addedAt: this._mergeTimelineIso(local.addedAt, incoming.addedAt, 'earliest'),
            warehouseStockAt: this._mergeTimelineIso(local.warehouseStockAt, incoming.warehouseStockAt, 'latest'),
            systemStockAt: this._mergeTimelineIso(local.systemStockAt, incoming.systemStockAt, 'latest'),
        };
        merged.history = this._embedProductTimelineInHistory(stockHist, merged);
        if (remoteIsNewer && incoming._apiNoStruckPrice === true) merged._apiNoStruckPrice = true;
        return merged;
    }

    findProductByBarcodeCode(code) {
        const c = code != null ? String(code).trim() : '';
        if (!c) return null;
        return (
            this.allProducts.find((p) => {
                if (!p.barcodes || !Array.isArray(p.barcodes)) return false;
                return p.barcodes.some((b) => b && String(b.code).trim() === c);
            }) || null
        );
    }

    matchDailyImportRow(row) {
        if (!row || typeof row !== 'object') return null;
        if (Array.isArray(row.barcodes)) {
            for (const bc of row.barcodes) {
                const p = this.findProductByBarcodeCode(bc);
                if (p) return p;
            }
        }
        const code = row.barcode != null ? String(row.barcode).trim() : '';
        if (code) {
            const byBarcode = this.findProductByBarcodeCode(code);
            if (byBarcode) return byBarcode;
        }
        if (row.name && String(row.name).trim()) {
            const name = String(row.name).trim();
            const exact = this.findProductByExactName(name);
            if (exact) return exact;
            const results = this.advancedProductSearch(name, 10);
            if (results.length === 1) return results[0];
            if (results.length > 1) {
                const best = this._pickBestNameMatch(name, results);
                if (best) return best;
            }
        }
        return null;
    }

    /** Günlük paneldeki `sayimDailyDateInput` değeri; yoksa bugün (YYYY-MM-DD) */
    getDailySelectedIso() {
        const el = document.getElementById('sayimDailyDateInput');
        const v = el && el.value ? String(el.value).trim() : '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        return this.getLocalDateIso();
    }

    /** Seçili ISO için `Günlük|YYYY-MM-DD` tablosu zaten var mı? */
    hasDailyTableForIso(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
        const tableName = this.DAILY_TABLE_PREFIX + iso;
        return this.getTableList().some((t) => t.name === tableName);
    }

    countMatchedDailyPasteRows(items) {
        if (!Array.isArray(items)) return 0;
        let n = 0;
        for (const row of items) {
            if (this.matchDailyImportRow(row)) n++;
        }
        return n;
    }

    resetSayimDailyPasteUi() {
        this._pendingSayimDailyPaste = null;
        const btn = document.getElementById('sayimDailyPasteBtn');
        const status = document.getElementById('sayimDailyPasteStatus');
        if (btn) {
            btn.disabled = false;
        }
        if (status) {
            status.textContent = '';
            status.className = 'text-xs text-gray-500 min-h-[1rem]';
        }
        this.updateDailyAddModalControls();
    }

    /** Gün ekle modalı: çakışma uyarısı + Tamam (yalnızca geçerli pano + tablo yokken). */
    updateDailyAddModalControls() {
        const iso = this.getDailySelectedIso();
        const conflictEl = document.getElementById('sayimDailyAddConflictMsg');
        const exists = this.hasDailyTableForIso(iso);
        if (conflictEl) {
            const msg = exists
                ? 'Bu güne ait tablo zaten var. Önce tablolar listesinden bu günü silin; ardından yeniden ekleyebilirsiniz.'
                : '';
            conflictEl.textContent = msg;
            conflictEl.classList.toggle('hidden', !exists);
        }
        const done = document.getElementById('sayimDailyAddDoneBtn');
        if (!done) return;
        let canConfirm = false;
        if (!exists && this._pendingSayimDailyPaste) {
            const p = this._pendingSayimDailyPaste;
            if (p.iso === iso && Array.isArray(p.items) && p.items.length > 0) {
                canConfirm = true;
            }
        }
        done.disabled = !canConfirm;
        done.setAttribute('aria-disabled', canConfirm ? 'false' : 'true');
    }

    initDailyDateControls() {
        const dateInput = document.getElementById('sayimDailyDateInput');
        if (!dateInput) return;
        let initial = this.getLocalDateIso();
        try {
            const saved = sessionStorage.getItem('sayimDailySelectedIso');
            if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) initial = saved;
        } catch (e) {
            /* ignore */
        }
        dateInput.value = initial;
        dateInput.addEventListener('change', () => {
            try {
                sessionStorage.setItem('sayimDailySelectedIso', dateInput.value);
            } catch (e) {
                /* ignore */
            }
            const iso = dateInput.value;
            if (
                iso &&
                /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
                this.hasDailyTableForIso(iso) &&
                this._getActiveSayimSubTab() === 'daily'
            ) {
                void this.switchTable(`${this.DAILY_TABLE_PREFIX}${iso}`);
            }
            this.resetSayimDailyPasteUi();
        });
        this.updateDailyAddModalControls();
    }

    openDailyAddModal() {
        const modal = document.getElementById('sayimDailyAddModal');
        const dateInput = document.getElementById('sayimDailyDateInput');
        if (!modal) return;
        let initial = this.getLocalDateIso();
        try {
            const saved = sessionStorage.getItem('sayimDailySelectedIso');
            if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) initial = saved;
        } catch (e) {
            /* ignore */
        }
        if (dateInput) dateInput.value = initial;
        this.resetSayimDailyPasteUi();
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        this.updateDailyAddModalControls();
        setTimeout(() => dateInput?.focus(), 150);
    }

    closeDailyAddModal() {
        const modal = document.getElementById('sayimDailyAddModal');
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        this._pendingSayimDailyPaste = null;
        const pasteBtn = document.getElementById('sayimDailyPasteBtn');
        if (pasteBtn) pasteBtn.disabled = false;
        const status = document.getElementById('sayimDailyPasteStatus');
        if (status) {
            status.textContent = '';
            status.className = 'text-xs text-gray-500 min-h-[1rem]';
        }
        const done = document.getElementById('sayimDailyAddDoneBtn');
        if (done) {
            done.disabled = true;
            done.setAttribute('aria-disabled', 'true');
        }
    }

    async confirmSayimDailyAddFromModal() {
        const done = document.getElementById('sayimDailyAddDoneBtn');
        if (!done || done.disabled) return;
        const iso = this.getDailySelectedIso();
        if (this.hasDailyTableForIso(iso)) {
            this.showToast('Bu güne ait tablo zaten var. Önce tablolar listesinden silin.', 'warning', 4500);
            this.updateDailyAddModalControls();
            return;
        }
        const pending = this._pendingSayimDailyPaste;
        if (!pending || pending.iso !== iso || !pending.items?.length) return;
        try {
            await this.ensureDailyTableForDate(iso, { forImport: true });
        } catch (err) {
            this.showToast(err?.message || 'Tablo açılamadı', 'error', 4000);
            return;
        }
        await this.applyImportedRows(pending.items);
        this._pendingSayimDailyPaste = null;
        this.closeDailyAddModal();
    }

    async ensureDailyTableForDate(iso, options = {}) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            throw new Error('Geçersiz tarih');
        }
        const tableName = this.DAILY_TABLE_PREFIX + iso;
        const tables = this.getTableList();
        const exists = tables.some((t) => t.name === tableName);
        const forImport = options.forImport === true;
        if (!exists) {
            await this.createTable(tableName, { allowDaily: true, skipRender: forImport });
        } else if (forImport) {
            await this.switchTable(tableName, { skipCatchUp: true, skipRender: true });
        } else {
            await this.switchTable(tableName);
        }
    }

    async applyImportedRows(rows, options = {}) {
        this._beginBulkImportLock();
        try {
            this._verifyCountingDataTableBinding();
            if (!this.currentTableName) {
                throw new Error('Aktif tablo seçili değil');
            }
            let added = 0;
            let skipped = 0;
            const idsInPasteOrder = [];
            const seenPasteIds = new Set();
            const fullReplace = options.fullReplace !== false;
            // 1. Aşama: Yerel countingData — içe aktarımda eski stok kalıntısı kalmasın
            for (const row of rows) {
                const product = this.matchDailyImportRow(row);
                if (!product) {
                    skipped++;
                    continue;
                }
                const pid = product.id;
                if (!seenPasteIds.has(pid)) {
                    seenPasteIds.add(pid);
                    idsInPasteOrder.push(product.id);
                }

                const hadEntry = !!this.countingData[pid];
                if (!hadEntry) {
                    this.addProductToCounting(product, { skipSave: true });
                } else if (fullReplace) {
                    this._resetCountingEntryStockFields(this.countingData[pid]);
                }

                if (this._rowHasExplicitQuantity(row) && this.countingData[pid]) {
                    const q = Number(row.quantity);
                    if (!Number.isNaN(q) && q >= 0) {
                        this.countingData[pid].warehouseStock = q;
                        this.countingData[pid].lastUpdated = new Date().toISOString();
                    }
                }
                added++;
            }

            // 2. Aşama: Yapıştırma = tablonun yeni tam listesi (eski kısmi DB verisi kalmasın)
            if (fullReplace && idsInPasteOrder.length > 0) {
                await this._purgeTableProductsNotInSet(idsInPasteOrder);
            }
            this.applyImportedProductOrder(idsInPasteOrder, { replaceRest: fullReplace });

            this._verifyCountingDataTableBinding();
            this._syncProductOrderMeta();

            if (added > 0) {
                this.pushAuditEntry(
                    `İçe aktarma · ${this.formatTableDisplayName(this.currentTableName)} · ${added} satır${
                        skipped ? ` · ${skipped} eşleşmedi` : ''
                    }`,
                    { cat: 'import', tbl: this.currentTableName }
                );
            }

            // 3. Aşama: Meta blob + counting_items toplu kayıt (sıra korunur)
            this._rapidRenderedIds = [];
            this._rapidRenderedStates.clear();

            this.renderTable();
            if (this.currentViewMode === 'rapid') {
                this.renderRapidCountingMode();
            }
            this.updateStatistics();
            this.updateCountingProgress();
            this.updateTableSelector();
            this.syncSayimSubTabToTable();

            await this.saveCountingData();
            await this._bulkSaveProductEntries(idsInPasteOrder, this.currentTableName);
            this.showToast(
                `${added} ürün işlendi${skipped ? `, ${skipped} satır eşleşmedi` : ''}`,
                added ? 'success' : 'warning',
                4000
            );
            return { added, skipped };
        } finally {
            this._endBulkImportLock();
        }
    }

    async importDailyCountForDate(iso) {
        try {
            await this.ensureDailyTableForDate(iso);
        } catch (err) {
            this.showToast(err?.message || 'Tablo açılamadı', 'error', 4000);
            return;
        }

        const fetchFn = window.DailyCountImport?.fetchDailyRowsForDate;
        const rows = typeof fetchFn === 'function' ? await fetchFn(iso) : [];
        const label = this.formatDailyDateLabelFromIso(iso);
        if (!rows.length) {
            this.showToast(
                `Kontrol paneli verisi henüz bağlanmadı veya ${label} için satır yok. Eklentiden kopyalayıp «Panodan içe aktar» kullanın veya \`window.__DAILY_COUNT_MOCK_ROWS\` ile test edin.`,
                'info',
                5000
            );
            this.updateTableSelector();
            this.syncSayimSubTabToTable();
            this.updateDailyAddModalControls();
            return;
        }

        await this.applyImportedRows(rows);
        this.updateDailyAddModalControls();
        this.closeDailyAddModal();
    }

    /** Günlük tablo adı: `Günlük|YYYY-MM-DD` — listeden veya «Gün ekle» içi Sil; onay `deleteDailyTableModal` */
    deleteDailyTableByName(tableName) {
        if (!tableName || !this.isDailyTableName(tableName)) {
            this.showToast('Geçersiz günlük tablo.', 'error', 3000);
            return;
        }
        const tables = this.getTableList();
        if (!tables.some((t) => t.name === tableName)) {
            this.showToast('Bu gün için tablo yok.', 'info', 3500);
            return;
        }
        if (tables.length <= 1) {
            this.showToast('En az bir tablo bulunmalıdır.', 'error', 4000);
            return;
        }
        const iso = this.getIsoFromDailyTableName(tableName);
        const label = this.formatDailyDateLabelFromIso(iso);
        this._pendingDailyDeleteTableName = tableName;
        const display = document.getElementById('deleteDailyTableDisplay');
        if (display) display.textContent = label;
        const modal = document.getElementById('deleteDailyTableModal');
        if (modal) modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    closeDeleteDailyTableModal() {
        this._pendingDailyDeleteTableName = null;
        const modal = document.getElementById('deleteDailyTableModal');
        if (modal) modal.classList.add('hidden');
        const dailyAdd = document.getElementById('sayimDailyAddModal');
        if (!dailyAdd || dailyAdd.classList.contains('hidden')) {
            document.body.classList.remove('overflow-hidden');
        }
    }

    async confirmPendingDailyDelete() {
        const tableName = this._pendingDailyDeleteTableName;
        if (!tableName) {
            this.closeDeleteDailyTableModal();
            return;
        }
        const tables = this.getTableList();
        if (!tables.some((t) => t.name === tableName)) {
            this.showToast('Tablo bulunamadı.', 'info', 3000);
            this.closeDeleteDailyTableModal();
            return;
        }
        if (tables.length <= 1) {
            this.showToast('En az bir tablo bulunmalıdır.', 'error', 4000);
            this.closeDeleteDailyTableModal();
            return;
        }
        try {
            await this.deleteTable(tableName);
            this.showToast('Günlük tablo silindi.', 'success', 3000);
            this.closeDailyAddModal();
        } catch (err) {
            this.showToast(err?.message || 'Silinemedi', 'error', 4000);
        }
        this.closeDeleteDailyTableModal();
        this.updateDailyAddModalControls();
    }

    deleteDailyTableForSelectedDate() {
        this.deleteDailyTableByName(this.DAILY_TABLE_PREFIX + this.getDailySelectedIso());
    }

    async importSayimPasteFromText(rawText) {
        const parser = window.SayimClipboardImport?.parseClipboardText;
        if (typeof parser !== 'function') {
            this.showToast('İçe aktarma modülü yüklenemedi.', 'error', 4000);
            return;
        }
        const parsed = parser(rawText);
        if (!parsed.ok || !parsed.items || !parsed.items.length) {
            this.showToast(parsed.error || 'Geçerli satır bulunamadı.', 'error', 5000);
            return;
        }
        try {
            await this.ensureDailyTableForDate(this.getDailySelectedIso(), { forImport: true });
        } catch (err) {
            this.showToast(err?.message || 'Tablo açılamadı', 'error', 4000);
            return;
        }
        await this.applyImportedRows(parsed.items);
        this.closeDailyAddModal();
    }

    syncDeleteTableButtonsVisibility() {
        const tables = this.getTableList();
        const show = tables.length > 1;
        const deleteTableBtn = document.getElementById('deleteTableBtn');
        const menuDelete = document.getElementById('sayimTableMenuDeleteBtn');
        if (deleteTableBtn) deleteTableBtn.style.display = show ? 'inline-flex' : 'none';
        if (menuDelete) {
            menuDelete.classList.toggle('hidden', !show);
            menuDelete.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
    }

    // Update table selector UI (genel liste + günlük liste)
    updateTableSelector() {
        const generalList = document.getElementById('generalTableList');
        const dailyList = document.getElementById('dailyTableList');
        const summaryText = document.getElementById('activeTableSummaryText');
        const titleEl = document.getElementById('sayimActiveTableTitle');
        const countEl = document.getElementById('sayimActiveTableProductCount');
        const renameBtn = document.getElementById('renameTableBtn');

        const tables = this.getTableList();
        const currentTable = tables.find((t) => t.isCurrent);
        const displayName = this.formatTableDisplayName(this.currentTableName);
        const cnt = currentTable ? currentTable.productCount || 0 : 0;
        const tag = this.isDailyTableName(this.currentTableName) ? ' (günlük)' : '';
        const line = `${displayName}${tag} · ${cnt} ürün`;
        if (summaryText) summaryText.textContent = line;
        if (titleEl) titleEl.textContent = `${displayName}${tag}`;
        if (countEl) countEl.textContent = `· ${cnt} ürün`;

        this.updateActiveTableActivityLine();
        this.syncDeleteTableButtonsVisibility();

        if (renameBtn) {
            const lock = this.isDailyTableName(this.currentTableName);
            renameBtn.disabled = lock;
            renameBtn.setAttribute('aria-disabled', lock ? 'true' : 'false');
            renameBtn.classList.toggle('opacity-40', lock);
            renameBtn.classList.toggle('pointer-events-none', lock);
            renameBtn.title = lock
                ? 'Günlük sayım tablolarının adı sabittir'
                : 'Seçili tablonun adını değiştir';
            const menuRename = document.querySelector('[data-sayim-menu-action="rename"]');
            if (menuRename) {
                menuRename.disabled = lock;
                menuRename.setAttribute('aria-disabled', lock ? 'true' : 'false');
                menuRename.classList.toggle('opacity-40', lock);
                menuRename.classList.toggle('pointer-events-none', lock);
            }
        }

        if (!generalList || !dailyList) {
            this.updateDailyAddModalControls();
            return;
        }

        const searchEl = document.getElementById('generalTableSearch');
        const q = (searchEl && searchEl.value ? searchEl.value : '').trim().toLowerCase();

        const generalTables = tables.filter((t) => !this.isDailyTableName(t.name));
        const filteredGeneral = q
            ? generalTables.filter((t) => t.name.toLowerCase().includes(q))
            : generalTables;

        generalList.innerHTML = '';
        generalList.classList.toggle('sayim-general-table-list--empty', filteredGeneral.length === 0);
        if (filteredGeneral.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'w-full text-[11px] text-slate-500 px-2 py-3 text-center';
            empty.textContent = generalTables.length
                ? 'Arama ile eşleşen tablo yok.'
                : 'Henüz genel tablo yok. + ile oluşturun.';
            generalList.appendChild(empty);
        } else {
            filteredGeneral.forEach((table) => {
                const isActive = table.name === this.currentTableName;
                const status = table.status || 'not-started';
                const isPreset = this.isPresetSubcategoryTable(table.name);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('role', 'listitem');
                btn.dataset.tableName = table.name;
                btn.dataset.tableStatus = status;
                if (isPreset) btn.dataset.presetSubcat = '1';
                btn.title = isPreset ? `${table.name} · Sabit alt kategori tablosu` : table.name;
                btn.className =
                    this.getTableStatusChipClasses(status, isActive) +
                    (isPreset ? this.getPresetSubcategoryChipAccentClasses() : '');
                btn.innerHTML = `
                    ${isPreset ? this.renderPresetSubcategoryBadgeHtml() : ''}
                    <span class="flex min-w-0 items-center gap-2 ${isPreset ? 'pl-2.5' : ''}">
                        <span class="truncate max-w-[10rem]">${this.escapeHtml(table.name)}</span>
                        <span class="text-[10px] font-semibold shrink-0 ${this.getTableStatusCountBadgeClasses(status, isActive)}">${table.productCount ?? 0}</span>
                    </span>
                `;
                btn.addEventListener('click', async () => {
                    if (table.name !== this.currentTableName) {
                        await this.switchTable(table.name);
                    }
                });
                generalList.appendChild(btn);
            });
        }

        this._lastFilteredGeneral = filteredGeneral;
        this.renderGeneralDropdownList(filteredGeneral);
        // NOT: scrollActiveGeneralTableChipIntoView burada çağrılmaz —
        // scrollIntoView sayfa scroll'unu yukarı zıplatıyordu (sayım sheet kapanınca tetikleniyordu).

        const dailyTables = tables
            .filter((t) => this.isDailyTableName(t.name))
            .map((t) => ({
                ...t,
                iso: this.getIsoFromDailyTableName(t.name),
            }))
            .sort((a, b) => (b.iso || '').localeCompare(a.iso || ''));

        const dailyBadge = document.getElementById('dailyTableCountBadge');
        if (dailyBadge) {
            dailyBadge.textContent = `${dailyTables.length} gün`;
        }

        dailyList.innerHTML = '';
        dailyList.classList.toggle('sayim-chip-scroll--empty', dailyTables.length === 0);
        if (dailyTables.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-[11px] text-indigo-800/85 px-2 py-2 text-center leading-relaxed';
            empty.textContent = 'Henüz gün yok. «Gün ekle / veri ekle» ile tarih seçip pano veya içe aktar kullanın.';
            dailyList.appendChild(empty);
        } else {
            const canDeleteAnyDaily = tables.length > 1;
            dailyTables.forEach((table) => {
                const label = this.formatDailyDateLabelFromIso(table.iso);
                const isActive = table.name === this.currentTableName;
                const row = document.createElement('div');
                row.className = 'flex w-full min-w-0 items-stretch gap-1';
                row.setAttribute('role', 'listitem');

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.tableName = table.name;
                btn.className = [
                    'sayim-table-chip min-w-0 flex-1 inline-flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors sm:px-3.5',
                    isActive
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-950 shadow-sm ring-2 ring-indigo-200/60'
                        : 'border-indigo-200/90 bg-white text-indigo-900/95 hover:border-indigo-300 hover:bg-indigo-50/80',
                ].join(' ');
                btn.innerHTML = `
                    <span class="min-w-0 flex-1 truncate">${this.escapeHtml(label)}</span>
                    <span class="shrink-0 rounded-md bg-indigo-600/10 px-2 py-0.5 tabular-nums text-[11px] font-bold ${isActive ? 'text-indigo-800' : 'text-indigo-600'}">${table.productCount ?? 0}</span>
                `;
                btn.addEventListener('click', async () => {
                    if (table.name !== this.currentTableName) {
                        await this.switchTable(table.name);
                    }
                });

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className =
                    'sayim-daily-row-del shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100/90 bg-white p-0 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white';
                delBtn.setAttribute('aria-label', `${label} gününü sil`);
                delBtn.title = canDeleteAnyDaily ? 'Bu günü sil' : 'En az bir tablo kalmalıdır';
                delBtn.disabled = !canDeleteAnyDaily;
                delBtn.innerHTML = `
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                `;
                delBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.deleteDailyTableByName(table.name);
                });

                row.appendChild(btn);
                row.appendChild(delBtn);
                dailyList.appendChild(row);
            });
        }
        this.updateDailyAddModalControls();
        if (this.currentTab === 'stokfark') {
            this.populateFarkTableCheckboxes();
        }
    }

    /** Genel / Günlük sekmesi — aktif tablo türüyle hizala */
    syncSayimSubTabToTable() {
        if (typeof this._sayimSubTabGo !== 'function') return;
        const tab = this.isDailyTableName(this.currentTableName) ? 'daily' : 'general';
        this._sayimSubTabGo(tab);
    }

    bindSayimSubTabControls() {
        const genBtn = document.getElementById('sayimTabGeneralBtn');
        const dailyBtn = document.getElementById('sayimTabDailyBtn');
        const genPanel = document.getElementById('sayimPanelGeneral');
        const dailyPanel = document.getElementById('sayimPanelDaily');
        if (!genBtn || !dailyBtn || !genPanel || !dailyPanel) return;

        const go = (which) => {
            const isDaily = which === 'daily';
            genBtn.setAttribute('aria-selected', isDaily ? 'false' : 'true');
            dailyBtn.setAttribute('aria-selected', isDaily ? 'true' : 'false');
            genPanel.classList.toggle('hidden', isDaily);
            dailyPanel.classList.toggle('hidden', !isDaily);
            try {
                sessionStorage.setItem('sayimSubTab', which);
            } catch (e) {
                /* ignore */
            }
        };
        this._sayimSubTabGo = go;

        genBtn.addEventListener('click', () => {
            go('general');
            void this._syncTableToSayimSubTab('general');
        });
        dailyBtn.addEventListener('click', () => {
            go('daily');
            void this._syncTableToSayimSubTab('daily');
        });

        this.syncSayimSubTabToTable();
    }

    /** Aktif tablo kartı — üç nokta menü (yeniden adlandır / yeni / sil) */
    bindSayimTableCardMenu() {
        const btn = document.getElementById('sayimTableMenuBtn');
        const dropdown = document.getElementById('sayimTableMenuDropdown');
        if (!btn || !dropdown) return;

        const close = () => {
            dropdown.classList.add('hidden');
            btn.setAttribute('aria-expanded', 'false');
        };
        const open = () => {
            dropdown.classList.remove('hidden');
            btn.setAttribute('aria-expanded', 'true');
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown.classList.contains('hidden')) open();
            else close();
        });

        document.addEventListener('click', (e) => {
            if (dropdown.classList.contains('hidden')) return;
            if (btn.contains(e.target) || dropdown.contains(e.target)) return;
            close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        dropdown.querySelectorAll('[data-sayim-menu-action]').forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = item.dataset.sayimMenuAction;
                close();
                const renameTableBtn = document.getElementById('renameTableBtn');
                const createTableBtn = document.getElementById('createTableBtn');
                const deleteTableBtn = document.getElementById('deleteTableBtn');
                if (action === 'rename' && renameTableBtn && !renameTableBtn.disabled) {
                    renameTableBtn.click();
                }
                if (action === 'create' && createTableBtn) createTableBtn.click();
                if (action === 'delete' && deleteTableBtn && deleteTableBtn.style.display !== 'none') {
                    deleteTableBtn.click();
                }
            });
        });
    }

    /** Genel tablo pill şeridinde seçili chip görünür alana kayar — yalnızca yatay şerit, sayfa scroll etmez. */
    scrollActiveGeneralTableChipIntoView(options = {}) {
        const behavior = options.behavior !== undefined ? options.behavior : 'auto';
        const list = document.getElementById('generalTableList');
        if (!list || list.classList.contains('sayim-general-table-list--empty')) return;
        if (this.isDailyTableName(this.currentTableName)) return;
        const targetName = this.currentTableName;
        const btn = Array.from(list.querySelectorAll('[data-table-name]')).find(
            (el) => el.dataset.tableName === targetName
        );
        if (!btn) return;
        const run = () => {
            try {
                const targetLeft = btn.offsetLeft - (list.clientWidth - btn.offsetWidth) / 2;
                list.scrollTo({ left: Math.max(0, targetLeft), behavior });
            } catch (e) {
                list.scrollLeft = Math.max(0, btn.offsetLeft);
            }
        };
        requestAnimationFrame(run);
    }

    /**
     * Sayfa yükü / sekme dönüşü / bfcache sonrası layout oturunca tekrar hizala
     */
    scheduleScrollActiveGeneralTableChip() {
        if (this.currentTab !== 'sayim') return;
        if (this._scrollGeneralChipTimers) {
            this._scrollGeneralChipTimers.forEach((id) => clearTimeout(id));
        }
        this._scrollGeneralChipTimers = [];
        const push = (fn, ms) => {
            this._scrollGeneralChipTimers.push(setTimeout(fn, ms));
        };
        push(() => this.scrollActiveGeneralTableChipIntoView({ behavior: 'smooth' }), 0);
        push(() => this.scrollActiveGeneralTableChipIntoView({ behavior: 'auto' }), 180);
        push(() => this.scrollActiveGeneralTableChipIntoView({ behavior: 'auto' }), 450);
    }

    /** Sekme / başka sayfa dönüşünde pill hizası */
    bindSayimGeneralTableScrollRestore() {
        const onReturn = () => {
            if (document.visibilityState !== 'visible') return;
            this.scheduleScrollActiveGeneralTableChip();
        };
        window.addEventListener('pageshow', () => this.scheduleScrollActiveGeneralTableChip());
        document.addEventListener('visibilitychange', onReturn);
    }

    /** Genel tablolar — liste dropdown içeriği (üst arama + liste içi arama) */
    renderGeneralDropdownList(generalTablesFiltered) {
        const dropdownList = document.getElementById('sayimGeneralTableDropdownList');
        const btn = document.getElementById('sayimGeneralTableDropdownBtn');
        if (!dropdownList) return;
        const base = Array.isArray(generalTablesFiltered) ? generalTablesFiltered : [];
        const qDrop = (document.getElementById('sayimGeneralTableDropdownSearch')?.value || '').trim().toLowerCase();
        const list = qDrop ? base.filter((t) => t.name.toLowerCase().includes(qDrop)) : base;
        dropdownList.innerHTML = '';
        if (list.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'px-3 py-4 text-center text-[11px] text-slate-500';
            empty.textContent = base.length ? 'Arama ile eşleşen tablo yok.' : 'Henüz genel tablo yok.';
            dropdownList.appendChild(empty);
        } else {
            list.forEach((table) => {
                const isActive = table.name === this.currentTableName;
                const status = table.status || 'not-started';
                const isPreset = this.isPresetSubcategoryTable(table.name);
                const row = document.createElement('button');
                row.type = 'button';
                row.setAttribute('role', 'option');
                row.setAttribute('aria-selected', isActive ? 'true' : 'false');
                row.dataset.tableName = table.name;
                row.dataset.tableStatus = status;
                if (isPreset) row.dataset.presetSubcat = '1';
                row.className = [
                    'relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors',
                    this.getTableStatusDropdownRowClasses(status, isActive),
                    isPreset ? 'preset-subcat-table-dropdown-row pl-7' : '',
                ].join(' ');
                row.innerHTML = `
                    ${isPreset ? this.renderPresetSubcategoryBadgeHtml() : ''}
                    <span class="min-w-0 truncate font-medium">${this.escapeHtml(table.name)}</span>
                    <span class="shrink-0 tabular-nums text-[10px] font-semibold ${this.getTableStatusCountBadgeClasses(status, isActive)}">${table.productCount ?? 0}</span>
                `;
                row.addEventListener('click', async () => {
                    document.getElementById('sayimGeneralTableDropdown')?.classList.add('hidden');
                    document.getElementById('sayimGeneralTableDropdownBtn')?.setAttribute('aria-expanded', 'false');
                    const searchIn = document.getElementById('sayimGeneralTableDropdownSearch');
                    if (searchIn) searchIn.value = '';
                    if (table.name !== this.currentTableName) {
                        await this.switchTable(table.name);
                    }
                });
                dropdownList.appendChild(row);
            });
        }
        if (btn) btn.disabled = base.length === 0;
    }

    bindSayimGeneralTableDropdown() {
        const btn = document.getElementById('sayimGeneralTableDropdownBtn');
        const drop = document.getElementById('sayimGeneralTableDropdown');
        const searchEl = document.getElementById('sayimGeneralTableDropdownSearch');
        if (!btn || !drop) return;

        const close = () => {
            drop.classList.add('hidden');
            btn.setAttribute('aria-expanded', 'false');
            if (searchEl) searchEl.value = '';
            this.renderGeneralDropdownList(this._lastFilteredGeneral);
        };

        const open = () => {
            drop.classList.remove('hidden');
            btn.setAttribute('aria-expanded', 'true');
            this.renderGeneralDropdownList(this._lastFilteredGeneral);
            setTimeout(() => searchEl?.focus(), 30);
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (drop.classList.contains('hidden')) open();
            else close();
        });

        document.addEventListener('click', (e) => {
            if (drop.classList.contains('hidden')) return;
            if (btn.contains(e.target) || drop.contains(e.target)) return;
            close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        if (searchEl) {
            searchEl.addEventListener('input', () => {
                this.renderGeneralDropdownList(this._lastFilteredGeneral);
            });
        }
    }

    // Open table selector dropdown
    openTableSelector() {
        const tableSelectorBtn = document.getElementById('tableSelectorBtn');
        const tableSelectorDropdown = document.getElementById('tableSelectorDropdown');
        if (tableSelectorBtn && tableSelectorDropdown) {
            tableSelectorDropdown.classList.remove('hidden');
            tableSelectorBtn.classList.add('open');
        }
    }
    
    // Close table selector dropdown
    closeTableSelector() {
        const tableSelectorBtn = document.getElementById('tableSelectorBtn');
        const tableSelectorDropdown = document.getElementById('tableSelectorDropdown');
        if (tableSelectorBtn && tableSelectorDropdown) {
            tableSelectorDropdown.classList.add('hidden');
            tableSelectorBtn.classList.remove('open');
        }
    }

    // API bilgilerini Supabase'e kaydet (telefondan erişim için)
    async saveAPIInfoToSupabase(incomingApiInfo) {
        try {
            if (!window.supabase || !this.currentUser) {
                console.warn('⚠️ Supabase veya kullanıcı yok, API bilgileri kaydedilemedi');
                return;
            }
            if (!incomingApiInfo || !incomingApiInfo.token) return;

            const { data: userData, error: fetchError } = await window.supabase
                .from('users')
                .select('counting_data')
                .eq('username', this.currentUser.username)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.warn('⚠️ Supabase counting_data okuma hatası:', fetchError);
            }

            let countingData = {};
            if (userData && userData.counting_data) {
                try {
                    countingData =
                        typeof userData.counting_data === 'string'
                            ? JSON.parse(userData.counting_data)
                            : userData.counting_data;
                } catch (e) {
                    console.warn('⚠️ counting_data parse hatası:', e);
                    countingData = {};
                }
            }

            if (!countingData || typeof countingData !== 'object') {
                countingData = { _api_info: {}, _tables: {}, _currentTable: 'Ana Sayım' };
            }
            if (!countingData._tables || typeof countingData._tables !== 'object') {
                countingData._tables = {};
            }
            if (!countingData._currentTable) countingData._currentTable = 'Ana Sayım';
            if (!countingData._tables[countingData._currentTable]) {
                countingData._tables[countingData._currentTable] = {};
            }

            const existingApiInfo = countingData._api_info || null;
            const cacheApiInfo = this.cachedFullData?._api_info || null;
            const merged = this._resolveBestApiInfoForSave(incomingApiInfo, [existingApiInfo, cacheApiInfo]);
            if (!merged || !merged.token) return;

            if (!this.cachedFullData) this.cachedFullData = { _tables: {} };
            this.cachedFullData._api_info = merged;

            const sigNew = this.apiInfoSignature(merged);
            const sigOld = this.apiInfoSignature(existingApiInfo);
            if (sigNew === sigOld && existingApiInfo?.token) {
                return;
            }

            countingData._api_info = {
                token: merged.token,
                warehouseId: merged.warehouseId,
                warehouseName: merged.warehouseName,
                tokenExpiry: merged.tokenExpiry,
                baseUrl: merged.baseUrl,
                stockEndpoint: merged.stockEndpoint,
                lastUpdated: new Date().toISOString(),
                timestamp: merged.timestamp || Date.now(),
            };

            const { error: updateError } = await window.supabase
                .from('users')
                .update({ counting_data: countingData })
                .eq('username', this.currentUser.username);

            if (updateError) {
                console.warn('⚠️ Supabase API bilgileri kayıt hatası:', updateError);
            } else {
                console.log('✅ API bilgileri Supabase\'e kaydedildi (en uzun süreli token)', {
                    username: this.currentUser.username,
                    warehouseId: merged.warehouseId,
                    tokenExpiry: merged.tokenExpiry
                        ? new Date(merged.tokenExpiry).toLocaleString('tr-TR')
                        : 'N/A',
                });
            }
        } catch (error) {
            console.warn('⚠️ Supabase API bilgileri kayıt hatası:', error);
        }
    }

    setupEventListeners() {
        // Manual add button
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', () =>
                void this.handleManualAdd().catch((err) => console.error('handleManualAdd:', err))
            );
        }

        // Manual input enter key + temizle (X) butonu
        const manualInput = document.getElementById('manualProductInput');
        const manualInputClear = document.getElementById('manualProductInputClear');
        const syncManualInputClear = () => {
            if (!manualInput) return;
            const has = manualInput.value.length > 0;
            if (manualInputClear) {
                manualInputClear.classList.toggle('hidden', !has);
                manualInputClear.classList.toggle('inline-flex', has);
            }
        };
        if (manualInput) {
            syncManualInputClear();
            manualInput.addEventListener('input', syncManualInputClear);
            manualInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    void this.handleManualAdd().catch((err) => console.error('handleManualAdd:', err));
                }
            });
        }
        if (manualInputClear && manualInput) {
            manualInputClear.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                manualInput.value = '';
                manualInput.dispatchEvent(new Event('input', { bubbles: true }));
                syncManualInputClear();
                manualInput.focus();
            });
        }

        // Search product button
        const searchProductBtn = document.getElementById('searchProductBtn');
        if (searchProductBtn) {
            searchProductBtn.addEventListener('click', () => this.openProductSearchModal());
        }

        // Camera scan button
        const cameraScanBtn = document.getElementById('cameraScanBtn');
        if (cameraScanBtn) {
            cameraScanBtn.addEventListener('click', () => {
                if (window.barcodeScanner) {
                    window.barcodeScanner.startScanning();
                } else {
                    alert('Barkod okuyucu henüz yüklenmedi. Lütfen sayfayı yenileyin.');
                }
            });
        }

        // Terminal scan button
        const terminalScanBtn = document.getElementById('terminalScanBtn');
        if (terminalScanBtn) {
            terminalScanBtn.addEventListener('click', () => {
                if (window.terminalScanner) {
                    window.terminalScanner.startScanning();
                } else {
                    alert('Terminal okuyucu henüz yüklenmedi. Lütfen sayfayı yenileyin.');
                }
            });
        }

        // Getir CDN görsel listesi — panodan toplu ekle (eklenti çıktısı)
        const getirCdnPasteBtn = document.getElementById('getirCdnPasteBtn');
        if (getirCdnPasteBtn) {
            getirCdnPasteBtn.addEventListener('click', () => {
                void this.handleGetirCdnPasteFromClipboard().catch((err) =>
                    console.error('handleGetirCdnPasteFromClipboard:', err)
                );
            });
        }

        this.bindUnmatchedGetirImagesModal();

        // Sync stocks button
        const syncStocksBtn = document.getElementById('syncStocksBtn');
        if (syncStocksBtn) {
            syncStocksBtn.addEventListener('click', () => this.openSyncStocksConfirmModal());
        }
        document.getElementById('closeSyncStocksConfirmModal')?.addEventListener('click', () =>
            this.closeSyncStocksConfirmModal()
        );
        document.getElementById('cancelSyncStocksConfirmBtn')?.addEventListener('click', () =>
            this.closeSyncStocksConfirmModal()
        );
        document.getElementById('confirmSyncStocksBtn')?.addEventListener('click', () =>
            void this.confirmSyncStocksFromModal()
        );
        document.getElementById('syncStocksConfirmModal')?.addEventListener('click', (e) => {
            if (e.target?.id === 'syncStocksConfirmModal') this.closeSyncStocksConfirmModal();
        });
        
        // Reset warehouse stocks button
        const resetWarehouseStocksBtn = document.getElementById('resetWarehouseStocksBtn');
        if (resetWarehouseStocksBtn) {
            resetWarehouseStocksBtn.addEventListener('click', () => this.resetWarehouseStocks());
        }
        
        // Reset system stocks button
        const resetSystemStocksBtn = document.getElementById('resetSystemStocksBtn');
        if (resetSystemStocksBtn) {
            resetSystemStocksBtn.addEventListener('click', () => this.resetSystemStocks());
        }

        // Product search modal
        const productSearchModal = document.getElementById('productSearchModal');
        const closeProductSearchModal = document.getElementById('closeProductSearchModal');
        if (closeProductSearchModal) {
            closeProductSearchModal.addEventListener('click', () => {
                productSearchModal.classList.add('hidden');
            });
        }

        // Product search input
        const productSearchInput = document.getElementById('productSearchInput');
        if (productSearchInput) {
            let searchTimeout;
            productSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchProducts(e.target.value);
                }, 300);
            });
        }

        // Camera scanner modal close
        const cameraScannerModal = document.getElementById('cameraScannerModal');
        const closeCameraScannerModal = document.getElementById('closeCameraScannerModal');
        if (closeCameraScannerModal) {
            closeCameraScannerModal.addEventListener('click', () => {
                if (window.barcodeScanner) {
                    window.barcodeScanner.stopScanning();
                }
                cameraScannerModal.classList.add('hidden');
            });
        }

        // Seri okuma toggle butonu
        const continuousScanToggle = document.getElementById('continuousScanToggle');
        if (continuousScanToggle) {
            continuousScanToggle.addEventListener('change', (e) => {
                if (window.barcodeScanner) {
                    window.barcodeScanner.setContinuousMode(e.target.checked);
                }
            });
        }

        // Sayarak ilerle toggle (kamera: okutunca sayım ekranı açılsın)
        const cameraScanAndCountToggle = document.getElementById('cameraScanAndCountToggle');
        if (cameraScanAndCountToggle) {
            cameraScanAndCountToggle.addEventListener('change', (e) => {
                this.setCameraScanAndCountMode(!!e.target.checked);
            });
        }

        const cameraTableOnlyScanToggle = document.getElementById('cameraTableOnlyScanToggle');
        if (cameraTableOnlyScanToggle) {
            cameraTableOnlyScanToggle.addEventListener('change', (e) => {
                this.setCameraTableOnlyScanMode(!!e.target.checked);
            });
        }
        
        // Table management event listeners
        const generalTableSearch = document.getElementById('generalTableSearch');
        if (generalTableSearch) {
            let tableSearchT;
            generalTableSearch.addEventListener('input', () => {
                clearTimeout(tableSearchT);
                tableSearchT = setTimeout(() => this.updateTableSelector(), 120);
            });
        }

        const sayimDailyAddModal = document.getElementById('sayimDailyAddModal');
        const sayimDailyAddOpenBtn = document.getElementById('sayimDailyAddOpenBtn');
        const sayimDailyAddCloseBtn = document.getElementById('sayimDailyAddCloseBtn');
        const sayimDailyAddDoneBtn = document.getElementById('sayimDailyAddDoneBtn');
        if (sayimDailyAddOpenBtn) {
            sayimDailyAddOpenBtn.addEventListener('click', () => this.openDailyAddModal());
        }
        if (sayimDailyAddCloseBtn) {
            sayimDailyAddCloseBtn.addEventListener('click', () => this.closeDailyAddModal());
        }
        if (sayimDailyAddDoneBtn) {
            sayimDailyAddDoneBtn.addEventListener('click', () => this.confirmSayimDailyAddFromModal());
        }
        if (sayimDailyAddModal) {
            sayimDailyAddModal.addEventListener('click', (e) => {
                if (e.target === sayimDailyAddModal) this.closeDailyAddModal();
            });
        }

        const deleteDailyTableModal = document.getElementById('deleteDailyTableModal');
        const closeDeleteDailyTableModalBtn = document.getElementById('closeDeleteDailyTableModal');
        const cancelDeleteDailyTableBtn = document.getElementById('cancelDeleteDailyTableBtn');
        const confirmDeleteDailyTableBtn = document.getElementById('confirmDeleteDailyTableBtn');
        [closeDeleteDailyTableModalBtn, cancelDeleteDailyTableBtn].forEach((btn) => {
            if (btn) btn.addEventListener('click', () => this.closeDeleteDailyTableModal());
        });
        if (confirmDeleteDailyTableBtn) {
            confirmDeleteDailyTableBtn.addEventListener('click', () => this.confirmPendingDailyDelete());
        }
        if (deleteDailyTableModal) {
            deleteDailyTableModal.addEventListener('click', (e) => {
                if (e.target === deleteDailyTableModal) this.closeDeleteDailyTableModal();
            });
        }

        const sayimDailyPasteBtn = document.getElementById('sayimDailyPasteBtn');
        const sayimDailyPasteStatus = document.getElementById('sayimDailyPasteStatus');
        if (sayimDailyPasteBtn) {
            sayimDailyPasteBtn.addEventListener('click', async () => {
                const iso = this.getDailySelectedIso();
                this._pendingSayimDailyPaste = null;
                if (this.hasDailyTableForIso(iso)) {
                    if (sayimDailyPasteStatus) {
                        sayimDailyPasteStatus.textContent = 'Bu gün zaten tabloda. Önce listeden silin.';
                        sayimDailyPasteStatus.className = 'text-xs text-red-600 min-h-[1rem]';
                    }
                    this.updateDailyAddModalControls();
                    return;
                }
                const parser = window.SayimClipboardImport?.parseClipboardText;
                if (typeof parser !== 'function') {
                    if (sayimDailyPasteStatus) {
                        sayimDailyPasteStatus.textContent = 'Modül yok';
                        sayimDailyPasteStatus.className = 'text-xs text-red-600 min-h-[1rem]';
                    }
                    this.updateDailyAddModalControls();
                    return;
                }
                let text = '';
                try {
                    text = await navigator.clipboard.readText();
                } catch (err) {
                    if (sayimDailyPasteStatus) {
                        sayimDailyPasteStatus.textContent = 'Panoya erişilemedi';
                        sayimDailyPasteStatus.className = 'text-xs text-red-600 min-h-[1rem]';
                    }
                    this.updateDailyAddModalControls();
                    return;
                }
                const parsed = parser(text);
                if (!parsed.ok || !parsed.items || !parsed.items.length) {
                    if (sayimDailyPasteStatus) {
                        sayimDailyPasteStatus.textContent = 'Hatalı veri';
                        sayimDailyPasteStatus.className = 'text-xs text-red-600 min-h-[1rem]';
                    }
                    this.updateDailyAddModalControls();
                    return;
                }
                const matched = this.countMatchedDailyPasteRows(parsed.items);
                this._pendingSayimDailyPaste = { items: parsed.items, iso };
                if (sayimDailyPasteStatus) {
                    sayimDailyPasteStatus.className = 'text-xs text-emerald-700 min-h-[1rem]';
                    sayimDailyPasteStatus.textContent =
                        matched !== parsed.items.length
                            ? `${matched} ürün · Tamam ile onaylayın (${parsed.items.length} satır)`
                            : `${matched} ürün · Tamam ile onaylayın`;
                }
                this.updateDailyAddModalControls();
            });
        }

        const renameTableBtn = document.getElementById('renameTableBtn');
        const createTableBtn = document.getElementById('createTableBtn');
        const deleteTableBtn = document.getElementById('deleteTableBtn');
        
        if (renameTableBtn) {
            renameTableBtn.addEventListener('click', () => {
                this.showRenameTableModal();
            });
        }
        
        if (createTableBtn) {
            createTableBtn.addEventListener('click', () => {
                this.showCreateTableModal();
            });
        }
        
        if (deleteTableBtn) {
            deleteTableBtn.addEventListener('click', () => {
                this.showDeleteTableModal();
            });
        }
        
        // Sortable header click listeners
        const sortableHeaders = document.querySelectorAll('.sortable-header');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const sortField = header.dataset.sortField;
                if (sortField) {
                    this.handleHeaderSort(sortField, header);
                }
            });
        });
        
        // Table management modals
        const createTableModal = document.getElementById('createTableModal');
        const deleteTableModal = document.getElementById('deleteTableModal');
        const renameTableModal = document.getElementById('renameTableModal');
        const closeCreateTableModal = document.getElementById('closeCreateTableModal');
        const closeDeleteTableModal = document.getElementById('closeDeleteTableModal');
        const closeRenameTableModal = document.getElementById('closeRenameTableModal');
        const cancelCreateTableBtn = document.getElementById('cancelCreateTableBtn');
        const cancelDeleteTableBtn = document.getElementById('cancelDeleteTableBtn');
        const cancelRenameTableBtn = document.getElementById('cancelRenameTableBtn');
        const confirmCreateTableBtn = document.getElementById('confirmCreateTableBtn');
        const confirmDeleteTableBtn = document.getElementById('confirmDeleteTableBtn');
        const confirmRenameTableBtn = document.getElementById('confirmRenameTableBtn');
        const newTableNameInput = document.getElementById('newTableNameInput');
        const renameTableNameInput = document.getElementById('renameTableNameInput');
        
        const closeCreateModal = () => {
            if (createTableModal) createTableModal.classList.add('hidden');
            this._resetCreateTableCombobox();
        };

        if (closeCreateTableModal) {
            closeCreateTableModal.addEventListener('click', closeCreateModal);
        }
        if (cancelCreateTableBtn) {
            cancelCreateTableBtn.addEventListener('click', closeCreateModal);
        }

        if (confirmCreateTableBtn) {
            confirmCreateTableBtn.addEventListener('click', async () => {
                const tableName = newTableNameInput?.value.trim();
                if (!tableName) {
                    this.showToast('Lütfen bir kategori seçin', 'error', 3000);
                    return;
                }
                // Zaten mevcut ise: o tabloya geç
                const existing = this.getTableList().find(t => t.name === tableName);
                if (existing) {
                    closeCreateModal();
                    if (tableName !== this.currentTableName) {
                        await this.switchTable(tableName);
                        this.showToast(`"${tableName}" tablosuna geçildi`, 'info', 2500);
                    } else {
                        this.showToast(`"${tableName}" zaten aktif tablo`, 'info', 2000);
                    }
                    return;
                }
                try {
                    await this.createTable(tableName);
                    closeCreateModal();
                    this.showToast(`"${tableName}" tablosu oluşturuldu`, 'success', 3000);
                } catch (error) {
                    this.showToast(error.message || 'Tablo oluşturulamadı', 'error', 4000);
                }
            });
        }

        // Overlay tıklamasıyla kapat — dropdown açıkken modal kapanmaz
        if (createTableModal) {
            createTableModal.addEventListener('click', (e) => {
                if (e.target !== createTableModal) return;
                const dropdown = document.getElementById('tableNameDropdown');
                if (dropdown && !dropdown.classList.contains('hidden')) {
                    if (typeof this._closeTableNameDropdown === 'function') {
                        this._closeTableNameDropdown();
                    }
                    return;
                }
                closeCreateModal();
            });
        }

        // Combobox kurulumu (bir kez)
        this._setupCreateTableCombobox();

        if (closeDeleteTableModal) {
            closeDeleteTableModal.addEventListener('click', () => {
                if (deleteTableModal) deleteTableModal.classList.add('hidden');
            });
        }
        
        if (cancelDeleteTableBtn) {
            cancelDeleteTableBtn.addEventListener('click', () => {
                if (deleteTableModal) deleteTableModal.classList.add('hidden');
            });
        }
        
        if (confirmDeleteTableBtn) {
            confirmDeleteTableBtn.addEventListener('click', async () => {
                try {
                    await this.deleteTable(this.currentTableName);
                    if (deleteTableModal) deleteTableModal.classList.add('hidden');
                    this.showToast('Tablo silindi', 'success', 3000);
                } catch (error) {
                    this.showToast(error.message || 'Tablo silinemedi', 'error', 4000);
                }
            });
        }
        
        if (deleteTableModal) {
            deleteTableModal.addEventListener('click', (e) => {
                if (e.target === deleteTableModal) {
                    deleteTableModal.classList.add('hidden');
                }
            });
        }
        
        // Rename table modal event listeners
        if (closeRenameTableModal) {
            closeRenameTableModal.addEventListener('click', () => {
                if (renameTableModal) renameTableModal.classList.add('hidden');
                const renameInput = document.getElementById('renameTableNameInput');
                if (renameInput) renameInput.value = '';
            });
        }
        
        if (cancelRenameTableBtn) {
            cancelRenameTableBtn.addEventListener('click', () => {
                if (renameTableModal) renameTableModal.classList.add('hidden');
                const renameInput = document.getElementById('renameTableNameInput');
                if (renameInput) renameInput.value = '';
            });
        }
        
        if (confirmRenameTableBtn) {
            confirmRenameTableBtn.addEventListener('click', async () => {
                const renameInput = document.getElementById('renameTableNameInput');
                const newName = renameInput?.value.trim();
                if (!newName) {
                    this.showToast('Lütfen tablo adı girin', 'error', 3000);
                    return;
                }
                
                if (newName.length > 50) {
                    this.showToast('Tablo adı maksimum 50 karakter olabilir', 'error', 3000);
                    return;
                }
                
                if (newName === this.currentTableName) {
                    this.showToast('Yeni ad mevcut adla aynı', 'info', 3000);
                    return;
                }
                
                try {
                    await this.renameTable(this.currentTableName, newName);
                    if (renameTableModal) renameTableModal.classList.add('hidden');
                    if (renameInput) renameInput.value = '';
                    this.showToast('Tablo adı değiştirildi', 'success', 3000);
                } catch (error) {
                    this.showToast(error.message || 'Tablo adı değiştirilemedi', 'error', 4000);
                }
            });
        }
        
        // Close rename modal on overlay click
        if (renameTableModal) {
            renameTableModal.addEventListener('click', (e) => {
                if (e.target === renameTableModal) {
                    renameTableModal.classList.add('hidden');
                    const renameInput = document.getElementById('renameTableNameInput');
                    if (renameInput) renameInput.value = '';
                }
            });
        }
        
        // Enter key for create table input
        if (newTableNameInput) {
            newTableNameInput.addEventListener('keypress', (e) => {
                // Check if we're in create modal or rename modal
                const isInCreateModal = createTableModal && !createTableModal.classList.contains('hidden');
                const isInRenameModal = renameTableModal && !renameTableModal.classList.contains('hidden');
                
                if (e.key === 'Enter') {
                    if (isInCreateModal) {
                        confirmCreateTableBtn?.click();
                    } else if (isInRenameModal) {
                        confirmRenameTableBtn?.click();
                    }
                }
            });
        }
        
        // Manual input search with dropdown
        const manualInputResults = document.getElementById('manualInputResults');
        const manualInputWrapper = document.getElementById('manualProductInputWrapper');
        if (manualInput) {
            let searchTimeout;
            manualInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                clearTimeout(searchTimeout);
                
                if (query.length < 2) {
                    if (manualInputResults) manualInputResults.classList.add('hidden');
                    return;
                }
                
                searchTimeout = setTimeout(() => {
                    this.showManualInputResults(query);
                }, 300);
            });
            
            // Dropdown içine tıklanınca kapanmasın: iç tıklamaları document'e iletme
            if (manualInputResults) {
                manualInputResults.addEventListener('click', (e) => e.stopPropagation());
            }
            
            // Sadece boş bir alana (input, ikonlar ve dropdown dışına) tıklanınca kapat
            document.addEventListener('click', (e) => {
                const insideField = manualInputWrapper && manualInputWrapper.contains(e.target);
                if (manualInputResults && !insideField && !manualInputResults.contains(e.target)) {
                    manualInputResults.classList.add('hidden');
                }
            });
        }

        // Setup counting bottom sheet
        this.setupCountingBottomSheet();
        
        // Setup view mode toggle
        this.setupViewModeToggle();
    }

    setupCountingBottomSheet() {
        const depoInput = document.getElementById('countingDepoInput');
        const increaseBtn = document.getElementById('countingIncreaseBtn');
        const decreaseBtn = document.getElementById('countingDecreaseBtn');
        const saveBtn = document.getElementById('countingSaveBtn');
        const prevBtn = document.getElementById('countingPrevBtn');
        const backdrop = document.getElementById('countingBottomSheetBackdrop');
        const keypadButtons = document.querySelectorAll('.keypad-btn');
        const backspaceBtn = document.getElementById('keypadBackspace');
        const deleteProductBtn = document.getElementById('countingDeleteProductBtn');

        // Prevent keyboard from opening when clicking on input
        if (depoInput) {
            depoInput.addEventListener('focus', (e) => {
                e.preventDefault();
                e.target.blur();
            });
            
            depoInput.addEventListener('click', (e) => {
                e.preventDefault();
                e.target.blur();
            });
        }

        // +/- buttons
        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => {
                if (depoInput) {
                    const currentValue = parseInt(depoInput.value) || 0;
                    depoInput.value = currentValue + 1;
                    depoInput.dispatchEvent(new Event('input'));
                }
            });
        }

        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => {
                if (depoInput) {
                    const currentValue = parseInt(depoInput.value) || 0;
                    depoInput.value = Math.max(0, currentValue - 1);
                    depoInput.dispatchEvent(new Event('input'));
                }
            });
        }

        // Numeric keypad
        keypadButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                if (key && depoInput) {
                    const currentValue = depoInput.value || '0';
                    if (currentValue === '0') {
                        depoInput.value = key;
                    } else {
                        depoInput.value = currentValue + key;
                    }
                    depoInput.dispatchEvent(new Event('input'));
                }
            });
        });

        // Backspace button
        if (backspaceBtn) {
            backspaceBtn.addEventListener('click', () => {
                if (depoInput) {
                    const currentValue = depoInput.value.toString();
                    if (currentValue.length > 1) {
                        depoInput.value = currentValue.slice(0, -1);
                    } else {
                        depoInput.value = '0';
                    }
                    depoInput.dispatchEvent(new Event('input'));
                }
            });
        }

        // Delete product button
        if (deleteProductBtn) {
            deleteProductBtn.addEventListener('click', () => {
                if (this.currentCountingProduct) {
                    // Show delete confirmation modal
                    this.showDeleteConfirmModal(this.currentCountingProduct);
                }
            });
        }

        // Update stock indicator and auto-save when input changes
        if (depoInput) {
            depoInput.addEventListener('input', () => {
                if (this.currentCountingProduct) {
                    const stockIndicator = document.getElementById('countingStockIndicator');
                    // Temporarily update countingData for calculation
                    const tempWarehouseStock = depoInput.value.trim() === '' ? null : parseInt(depoInput.value);
                    const originalData = this.countingData[this.currentCountingProduct] || {};
                    const tempData = { ...originalData, warehouseStock: tempWarehouseStock };
                    this.countingData[this.currentCountingProduct] = tempData;
                    
                    this.updateStockIndicator(this.currentCountingProduct, stockIndicator);
                    
                    // Restore original data temporarily
                    this.countingData[this.currentCountingProduct] = originalData;
                    
                    // Auto-save after 1 second of no input
                    if (this.autoSaveTimeout) {
                        clearTimeout(this.autoSaveTimeout);
                    }
                    
                    this.autoSaveTimeout = setTimeout(() => {
                        if (this.currentCountingProduct) {
                            const value = depoInput.value.trim() === '' ? null : parseInt(depoInput.value);
                            void this.updateProductStock(this.currentCountingProduct, value, null).catch(
                                (err) => console.error('Depo otomatik kayıt:', err)
                            );

                            // Remove from skipped if was skipped
                            this.skippedProducts.delete(this.currentCountingProduct);

                            // Update rapid mode if active
                            if (this.currentViewMode === 'rapid') {
                                this.renderRapidCountingMode();
                            }

                            this.updateStatistics();
                            this.updateCountingProgress();
                        }
                    }, 1000); // 1 second debounce
                }
                this.updateCorrectEntryButtonState();
            });
        }

        // Previous button (go to previous uncounted product)
        if (prevBtn) {
            prevBtn.addEventListener('click', async () => {
                if (!this.currentCountingProduct || this._isSheetStockFetchLocked()) return;

                const prevProductId = this.findPreviousUncountedProduct(this.currentCountingProduct);
                if (prevProductId) {
                    const depoInput = document.getElementById('countingDepoInput');
                    if (depoInput) {
                        const value = depoInput.value.trim() === '' ? null : parseInt(depoInput.value);
                        await this.updateProductStock(this.currentCountingProduct, value, null);
                        this.skippedProducts.delete(this.currentCountingProduct);
                    }

                    this.openCountingBottomSheet(prevProductId);
                    
                    // Update rapid mode if active
                    if (this.currentViewMode === 'rapid') {
                        this.renderRapidCountingMode();
                    }
                    
                    this.updateStatistics();
                    this.updateCountingProgress();
                }
            });
        }

        // Next button (go to next uncounted product)
        const nextBtn = document.getElementById('countingNextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', async () => {
                if (!this.currentCountingProduct || this._isSheetStockFetchLocked()) return;

                const nextProductId = this.findNextUncountedProduct(this.currentCountingProduct);
                if (nextProductId) {
                    const depoInput = document.getElementById('countingDepoInput');
                    if (depoInput) {
                        const value = depoInput.value.trim() === '' ? null : parseInt(depoInput.value);
                        await this.updateProductStock(this.currentCountingProduct, value, null);
                        this.skippedProducts.delete(this.currentCountingProduct);
                    }

                    this.openCountingBottomSheet(nextProductId);
                    
                    // Update rapid mode if active
                    if (this.currentViewMode === 'rapid') {
                        this.renderRapidCountingMode();
                    }
                    
                    this.updateStatistics();
                    this.updateCountingProgress();
                }
            });
        }

        // Backdrop click to close
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                if (this._isSheetStockFetchLocked()) return;
                void this.closeCountingBottomSheet().catch((err) =>
                    console.error('closeCountingBottomSheet:', err)
                );
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this._isSheetStockFetchLocked()) return;
                const bottomSheet = document.getElementById('countingBottomSheet');
                if (bottomSheet && !bottomSheet.classList.contains('hidden')) {
                    void this.closeCountingBottomSheet().catch((err) =>
                        console.error('closeCountingBottomSheet:', err)
                    );
                }
            }
        });

        // Input validation
        if (depoInput) {
            depoInput.addEventListener('input', (e) => {
                const clean = e.target.value.replace(/[^0-9]/g, '');
                if (e.target.value !== clean) e.target.value = clean;
                this.updateCorrectEntryButtonState();
            });

            depoInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (saveBtn) saveBtn.click();
                }
            });
        }

        // Refresh System Stock Button
        const refreshSystemStockBtn = document.getElementById('countingRefreshSystemStockBtn');
        if (refreshSystemStockBtn) {
            refreshSystemStockBtn.addEventListener('click', async () => {
                if (!this.currentCountingProduct || this._isSheetStockFetchLocked()) {
                    return;
                }

                const product = this.productIndex.get(this.currentCountingProduct);
                if (!product) {
                    return;
                }

                const barcode = product.barcodes && product.barcodes.length > 0 ? product.barcodes[0].code : '';
                if (!barcode) {
                    this.showToast('Bu ürün için barkod bulunamadı', 'error', 3000);
                    return;
                }

                try {
                    const result = await this._fetchStockForCountingSheet(this.currentCountingProduct, barcode);
                    if (!result) return;

                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    const price = typeof result === 'object' && result !== null ? result?.price : null;
                    const priceText = typeof result === 'object' && result !== null ? result?.priceText : null;
                    const struckPrice = typeof result === 'object' && result !== null ? (result?.struckPrice ?? null) : null;
                    const struckPriceText = typeof result === 'object' && result !== null ? (result?.struckPriceText ?? null) : null;
                    const reserved =
                        typeof result === 'object' && result !== null && 'reservedStock' in result
                            ? result.reservedStock
                            : undefined;

                    if (stock !== null && stock !== undefined) {
                        await this.updateProductStock(
                            this.currentCountingProduct,
                            null,
                            stock,
                            price,
                            priceText,
                            reserved,
                            struckPrice,
                            struckPriceText
                        );
                        this.showToast('Sistem stoku yenilendi', 'success', 2000);

                        const stockIndicator = document.getElementById('countingStockIndicator');
                        this.updateStockIndicator(this.currentCountingProduct, stockIndicator);
                    } else {
                        this.showToast('Ürün stoku bulunamadı', 'info', 3000);
                    }
                } catch (error) {
                    this.showToast('Stok alınamadı: ' + (error.message || 'Bilinmeyen hata'), 'error', 3000);
                } finally {
                    this.updateCorrectEntryButtonState();
                }
            });
        }

        const sheetStockCancelBtn = document.getElementById('countingSheetStockCancelBtn');
        if (sheetStockCancelBtn) {
            sheetStockCancelBtn.addEventListener('click', () => this._cancelSheetStockFetch());
        }

        const correctEntryBtn = document.getElementById('countingCorrectEntryBtn');
        if (correctEntryBtn) {
            correctEntryBtn.addEventListener('click', () => {
                if (correctEntryBtn.disabled) return;
                void this.closeCountingBottomSheet().catch((err) =>
                    console.error('closeCountingBottomSheet:', err)
                );
            });
        }

        const verifyBarcodeBtn = document.getElementById('countingVerifyBarcodeBtn');
        if (verifyBarcodeBtn) {
            verifyBarcodeBtn.addEventListener('click', () => {
                void this.beginBarcodeVerificationForCurrentProduct();
            });
        }

        const timelineBtn = document.getElementById('countingProductTimelineBtn');
        const timelineCloseBtn = document.getElementById('countingProductTimelineCloseBtn');
        const timelineBackdrop = document.getElementById('countingProductTimelineBackdrop');
        if (timelineBtn) {
            timelineBtn.addEventListener('click', () => {
                this.toggleProductTimelinePanel();
            });
        }
        if (timelineCloseBtn) {
            timelineCloseBtn.addEventListener('click', () => {
                this.closeProductTimelinePanel();
            });
        }
        if (timelineBackdrop) {
            timelineBackdrop.addEventListener('click', () => {
                this.closeProductTimelinePanel();
            });
        }

        // Setup product image lightbox
        this.setupProductImageLightbox();
        this.setupProductDetailPanel();

        // Delegation tabanlı event listener'ları kur (tek seferlik)
        this.setupTableEventListeners();
    }

    setupTabSystem() {
        const tabFinans = document.getElementById('tabFinans');
        const tabSayim = document.getElementById('tabSayim');
        const tabStokfark = document.getElementById('tabStokfark');
        const finansTabContent = document.getElementById('finansTabContent');
        const sayimTabContent = document.getElementById('sayimTabContent');

        // Tab button clicks
        if (tabFinans) {
            tabFinans.addEventListener('click', () => {
                this.switchTab('finans');
            });
        }

        if (tabSayim) {
            tabSayim.addEventListener('click', () => {
                this.switchTab('sayim');
            });
        }

        if (tabStokfark) {
            tabStokfark.addEventListener('click', () => {
                this.switchTab('stokfark');
            });
        }

        this.setupFarkTabControls();

        const sayimTripleZone = document.getElementById('sayimTripleClickZone');
        if (sayimTripleZone) {
            sayimTripleZone.addEventListener('click', (e) => {
                this._sayimTripleTapCount = (this._sayimTripleTapCount || 0) + 1;
                clearTimeout(this._sayimTripleTapTimer);
                this._sayimTripleTapTimer = setTimeout(() => {
                    this._sayimTripleTapCount = 0;
                }, 1100);
                if (this._sayimTripleTapCount >= 4) {
                    this._sayimTripleTapCount = 0;
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleSayimAuditLogPanel();
                }
            });
        }

        // Initialize tab display
        this.updateTabDisplay();
    }

    switchTab(tab) {
        if (this.currentTab === tab) return;

        if (this.currentTab === 'finans' && tab !== 'finans') {
            this._clearFinancePasteGuide();
        }

        this.currentTab = tab;
        localStorage.setItem('counting_active_tab', tab);
        this.updateTabDisplay();

        if (tab === 'finans') {
            this.renderFinancialTab();
        } else if (tab === 'stokfark') {
            void this.renderFarkTab();
        } else {
            this.renderTable();
            this.updateViewMode();
            this.scheduleScrollActiveGeneralTableChip();
        }
    }

    updateTabDisplay() {
        const tabFinans = document.getElementById('tabFinans');
        const tabSayim = document.getElementById('tabSayim');
        const tabStokfark = document.getElementById('tabStokfark');
        const finansTabContent = document.getElementById('finansTabContent');
        const sayimTabContent = document.getElementById('sayimTabContent');
        const stokfarkTabContent = document.getElementById('stokfarkTabContent');

        const setActive = (el, on) => {
            if (!el) return;
            if (on) el.classList.add('active');
            else el.classList.remove('active');
        };

        if (tabFinans && tabSayim) {
            setActive(tabSayim, this.currentTab === 'sayim');
            setActive(tabFinans, this.currentTab === 'finans');
            setActive(tabStokfark, this.currentTab === 'stokfark');
        }

        if (finansTabContent && sayimTabContent && stokfarkTabContent) {
            finansTabContent.classList.toggle('hidden', this.currentTab !== 'finans');
            sayimTabContent.classList.toggle('hidden', this.currentTab !== 'sayim');
            stokfarkTabContent.classList.toggle('hidden', this.currentTab !== 'stokfark');
        }
    }

    setupFarkTabControls() {
        const allBtn = document.getElementById('farkSelectAllBtn');
        const noneBtn = document.getElementById('farkSelectNoneBtn');
        const hideDailyBtn = document.getElementById('farkHideDailyBtn');
        const wrap = document.getElementById('farkTableCheckboxes');
        this._syncFarkHideDailyBtnUi();
        if (allBtn && !allBtn.dataset.bound) {
            allBtn.dataset.bound = '1';
            allBtn.addEventListener('click', () => {
                this._farkTableSelection = new Set(this.getFarkVisibleTableNames());
                this.populateFarkTableCheckboxes();
                void this.renderFarkOzeti();
            });
        }
        if (noneBtn && !noneBtn.dataset.bound) {
            noneBtn.dataset.bound = '1';
            noneBtn.addEventListener('click', () => {
                this._farkTableSelection = new Set();
                this.populateFarkTableCheckboxes();
                void this.renderFarkOzeti();
            });
        }
        if (hideDailyBtn && !hideDailyBtn.dataset.bound) {
            hideDailyBtn.dataset.bound = '1';
            hideDailyBtn.addEventListener('click', () => {
                this._setFarkHideDailyTables(!this._farkHideDailyTables);
            });
        }
        if (wrap && !wrap.dataset.changeBound) {
            wrap.dataset.changeBound = '1';
            wrap.addEventListener('change', (e) => {
                const t = e.target;
                if (!t || !t.classList.contains('fark-table-cb')) return;
                const raw = t.getAttribute('data-fark-table');
                const name = raw ? decodeURIComponent(raw) : '';
                if (!name) return;
                if (t.checked) this._farkTableSelection.add(name);
                else this._farkTableSelection.delete(name);
                void this.renderFarkOzeti();
            });
        }
    }

    /** Stok farkı sekmesi: tablo kutuları + özet */
    ensureFarkTableSelection() {
        const names = this.getTableList().map((t) => t.name);
        if (!this._farkTableSelection || !(this._farkTableSelection instanceof Set)) {
            this._farkTableSelection = new Set(names);
            this._farkTableNamesSnapshot = [...names];
            return;
        }
        for (const n of [...this._farkTableSelection]) {
            if (!names.includes(n)) this._farkTableSelection.delete(n);
        }
        if (this._farkTableNamesSnapshot == null) {
            this._farkTableNamesSnapshot = [...names];
            return;
        }
        const prevSnap = Array.isArray(this._farkTableNamesSnapshot) ? this._farkTableNamesSnapshot : [];
        for (const n of names) {
            if (!prevSnap.includes(n)) {
                this._farkTableSelection.add(n);
            }
        }
        this._farkTableNamesSnapshot = [...names];
    }

    populateFarkTableCheckboxes() {
        const wrap = document.getElementById('farkTableCheckboxes');
        if (!wrap) return;
        this.ensureFarkTableSelection();
        const tables = this.getFarkVisibleTables();
        if (tables.length === 0) {
            wrap.innerHTML = `<p class="w-full py-4 text-center text-xs text-slate-500">${this._farkHideDailyTables ? 'Günlük tablolar gizli — genel tablo yok.' : 'Henüz tablo yok.'}</p>`;
            return;
        }
        wrap.innerHTML = tables
            .map((row) => {
                const name = row.name;
                const enc = encodeURIComponent(name);
                const checked = this._farkTableSelection.has(name);
                const label = this.formatTableDisplayName(name);
                const isPreset = this.isPresetSubcategoryTable(name);
                const status = row.status || 'not-started';
                const statusClasses = this.getTableStatusFarkLabelClasses(status);
                const cnt =
                    typeof row.productCount === 'number'
                        ? `<span class="font-normal tabular-nums opacity-75">(${row.productCount})</span>`
                        : '';
                const aria = String(label).replace(/"/g, '&quot;');
                return `
                    <label class="relative inline-flex cursor-pointer select-none items-center gap-2.5 rounded-xl border px-3 py-2 shadow-sm transition-all ${statusClasses}${isPreset ? ' preset-subcat-table-label pl-7' : ''}" data-table-status="${status}">
                        ${isPreset ? this.renderPresetSubcategoryBadgeHtml() : ''}
                        <input type="checkbox" class="peer sr-only fark-table-cb" data-fark-table="${enc}" ${checked ? 'checked' : ''} aria-label="${aria}"/>
                        <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-current/25 bg-white/80 transition peer-checked:border-current peer-checked:bg-current/90 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-current/30 peer-checked:[&_svg]:opacity-100">
                            <svg class="h-3 w-3 text-white opacity-0 transition-opacity" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6l2.5 2.5L9.5 3"/></svg>
                        </span>
                        <span class="text-xs sm:text-sm font-medium min-w-0 truncate">${this.escapeHtml(label)} ${cnt}</span>
                    </label>`;
            })
            .join('');
    }

    async renderFarkTab() {
        this.populateFarkTableCheckboxes();
        await this.renderFarkOzeti();
    }

    /** Seçili tablolar için depo−sistem özeti (Finans Stok Özeti ile aynı mantık, daha sade görünüm) */
    async renderFarkOzeti() {
        const container = document.getElementById('farkOzetiSection');
        if (!container) return;
        this.ensureFarkTableSelection();
        const selected = [...this._farkTableSelection].filter(Boolean);
        const allNames = this.getTableList().map((t) => t.name);

        if (selected.length === 0) {
            container.innerHTML = `
                <div class="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500">
                    En az bir tablo seçin.
                </div>`;
            return;
        }

        const mergedProducts = [];
        const summary = {
            totalWarehouseValue: 0,
            totalSystemValue: 0,
            profitLoss: 0,
            productCount: 0,
            countedProducts: 0,
        };

        for (const tableName of selected) {
            const data = await this.calculateFinancialData(tableName);
            if (!data) continue;
            summary.totalWarehouseValue += data.summary.totalWarehouseValue;
            summary.totalSystemValue += data.summary.totalSystemValue;
            summary.profitLoss += data.summary.profitLoss;
            summary.productCount += data.summary.productCount;
            summary.countedProducts += data.summary.countedProducts;
            mergedProducts.push(...data.products);
        }

        let list = mergedProducts;
        if (selected.length > 1) {
            list = this.dedupeFinancialProductsByProductId(list);
        }

        const allSelected =
            allNames.length > 0 &&
            selected.length === allNames.length &&
            allNames.every((n) => selected.includes(n));
        let scopeShort;
        if (allSelected && allNames.length > 1) {
            scopeShort = 'Tüm tablolar · aynı ürün satırları birleştirildi';
        } else if (selected.length > 1) {
            scopeShort = `${selected.length} tablo · aynı ürün satırları birleştirildi`;
        } else {
            scopeShort = this.formatTableDisplayName(selected[0]);
        }

        this.renderMinimalFarkExecutiveReport(list, summary, scopeShort);
    }

    /**
     * Finans «Stok Özeti» ile aynı veri; daha küçük tipografi ve sıkı liste (çok tablo için).
     */
    renderMinimalFarkExecutiveReport(products, summary, scopeShort) {
        const container = document.getElementById('farkOzetiSection');
        if (!container) return;

        const safeSummary = summary || {
            totalWarehouseValue: 0,
            totalSystemValue: 0,
            profitLoss: 0,
            productCount: 0,
            countedProducts: 0,
        };

        let list = Array.isArray(products) ? [...products] : [];
        const missing = list.filter((p) => p.stockDiff < 0).sort((a, b) => a.difference - b.difference);
        const surplus = list.filter((p) => p.stockDiff > 0).sort((a, b) => b.difference - a.difference);

        const sumMissing = missing.reduce((s, p) => s + p.difference, 0);
        const sumSurplus = surplus.reduce((s, p) => s + p.difference, 0);

        const now = new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });

        const rowMini = (p, kind) => {
            const img = this.escapeHtml(p.imageUrl || '../assets/logo.png');
            const name = this.escapeHtml(p.productName || '');
            const bc = p.barcode ? this.escapeHtml(p.barcode) : '—';
            const stockDiff = p.warehouseStock - p.systemStock;
            const adetStr = stockDiff > 0 ? `+${stockDiff}` : `${stockDiff}`;
            const tone =
                kind === 'miss'
                    ? 'border-l-rose-400/90 bg-rose-50/40'
                    : 'border-l-emerald-400/90 bg-emerald-50/40';
            const adCol = kind === 'miss' ? 'text-rose-700' : 'text-emerald-700';
            return `
                <div class="flex gap-2 rounded-md border border-gray-100/90 ${tone} border-l-[3px] py-1.5 pl-1.5 pr-2">
                    <img src="${img}" alt="" class="h-9 w-9 shrink-0 rounded-md border border-white object-cover" loading="lazy"/>
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-medium leading-snug text-gray-900 line-clamp-2 [overflow-wrap:anywhere]">${name}</p>
                        <p class="font-mono text-[10px] text-gray-400 truncate">${bc}</p>
                        <div class="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0 text-[11px]">
                            <span class="font-semibold ${adCol}">${adetStr} adet</span>
                            <span class="text-gray-500">${this.formatCurrency(p.price)}</span>
                            <span class="w-full text-right font-semibold text-gray-800 sm:w-auto">${p.difference >= 0 ? '+' : ''}${this.formatCurrency(p.difference)}</span>
                        </div>
                    </div>
                </div>`;
        };

        const emptyCol = (msg) => `<p class="py-4 text-center text-[11px] text-gray-400">${msg}</p>`;
        const netClass = safeSummary.profitLoss >= 0 ? 'text-emerald-700' : 'text-red-600';
        const netBg = safeSummary.profitLoss >= 0 ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/40';

        container.innerHTML = `
            <div class="rounded-xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm">
                <div class="mb-3 flex flex-col gap-0.5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h3 class="text-sm font-bold tracking-tight text-gray-900">Stok Özeti</h3>
                        <p class="text-[11px] text-gray-500">${this.escapeHtml(scopeShort || '')}</p>
                    </div>
                    <p class="text-[10px] text-gray-400">${this.escapeHtml(now)}</p>
                </div>

                <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div class="rounded-lg border border-rose-100/90 bg-rose-50/40 px-3 py-2">
                        <p class="text-[10px] font-semibold uppercase tracking-wide text-rose-600/90">Depoda eksik</p>
                        <p class="mt-0.5 flex items-baseline gap-1">
                            <span class="text-xl font-bold tabular-nums text-rose-700">${missing.length}</span>
                            <span class="text-[10px] text-rose-800/80">ürün</span>
                        </p>
                        <p class="mt-1 text-[11px] font-medium text-rose-700">${this.formatCurrency(sumMissing)} <span class="font-normal text-rose-600/70">TL</span></p>
                    </div>
                    <div class="rounded-lg border border-emerald-100/90 bg-emerald-50/40 px-3 py-2">
                        <p class="text-[10px] font-semibold uppercase tracking-wide text-emerald-600/90">Depoda fazla</p>
                        <p class="mt-0.5 flex items-baseline gap-1">
                            <span class="text-xl font-bold tabular-nums text-emerald-700">${surplus.length}</span>
                            <span class="text-[10px] text-emerald-800/80">ürün</span>
                        </p>
                        <p class="mt-1 text-[11px] font-medium text-emerald-700">${this.formatCurrency(sumSurplus)} <span class="font-normal text-emerald-600/70">TL</span></p>
                    </div>
                    <div class="rounded-lg border ${netBg} px-3 py-2 sm:flex sm:flex-col sm:justify-center">
                        <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Net (depo − sistem)</p>
                        <p class="mt-0.5 text-lg font-bold tabular-nums ${netClass}">${this.formatCurrency(safeSummary.profitLoss)}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
                    <div>
                        <div class="mb-1.5 flex items-center justify-between gap-2">
                            <span class="text-[11px] font-semibold text-gray-700">Eksik</span>
                            <span class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">${missing.length}</span>
                        </div>
                        <div class="space-y-1.5 max-h-[min(52vh,420px)] overflow-y-auto pr-0.5">
                            ${missing.length === 0 ? emptyCol('Eksik yok.') : missing.map((p) => rowMini(p, 'miss')).join('')}
                        </div>
                    </div>
                    <div>
                        <div class="mb-1.5 flex items-center justify-between gap-2">
                            <span class="text-[11px] font-semibold text-gray-700">Fazla</span>
                            <span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">${surplus.length}</span>
                        </div>
                        <div class="space-y-1.5 max-h-[min(52vh,420px)] overflow-y-auto pr-0.5">
                            ${surplus.length === 0 ? emptyCol('Fazla yok.') : surplus.map((p) => rowMini(p, 'plus')).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupProductImageLightbox() {
        const productImage = document.getElementById('countingProductImage');
        const lightbox = document.getElementById('productImageLightbox');
        const lightboxImage = document.getElementById('lightboxProductImage');
        const closeLightboxBtn = document.getElementById('closeLightboxBtn');

        if (!productImage || !lightbox || !lightboxImage) return;

        // Open lightbox on image click
        productImage.addEventListener('click', () => {
            const imageSrc = productImage.src;
            if (imageSrc) {
                lightboxImage.src = imageSrc;
                lightboxImage.alt = productImage.alt || '';
                lightbox.classList.remove('hidden');
                document.body.classList.add('lightbox-open');
                
                // Trigger animation
                requestAnimationFrame(() => {
                    lightbox.classList.add('show');
                });
            }
        });

        // Close lightbox on backdrop click (anywhere outside the image)
        lightbox.addEventListener('click', (e) => {
            // Close if clicking on backdrop or container div, but not on the image or close button
            const isImage = e.target === lightboxImage || lightboxImage.contains(e.target);
            const isCloseButton = closeLightboxBtn && (e.target === closeLightboxBtn || closeLightboxBtn.contains(e.target));
            
            if (!isImage && !isCloseButton) {
                this.closeProductImageLightbox();
            }
        });

        // Close lightbox on close button click
        if (closeLightboxBtn) {
            closeLightboxBtn.addEventListener('click', () => {
                this.closeProductImageLightbox();
            });
        }

        // Close lightbox on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.isProductDetailPanelOpen()) {
                this.closeProductDetailPanel();
                return;
            }
            if (this.isProductTimelinePanelOpen()) {
                this.closeProductTimelinePanel();
                return;
            }
            if (lightbox && !lightbox.classList.contains('hidden')) {
                this.closeProductImageLightbox();
            }
        });
    }

    openProductImageLightbox(imageSrc, alt = '') {
        const lightbox = document.getElementById('productImageLightbox');
        const lightboxImage = document.getElementById('lightboxProductImage');
        if (!lightbox || !lightboxImage || !imageSrc) return;
        lightboxImage.src = imageSrc;
        lightboxImage.alt = alt || '';
        lightbox.classList.remove('hidden');
        document.body.classList.add('lightbox-open');
        requestAnimationFrame(() => lightbox.classList.add('show'));
    }

    closeProductImageLightbox() {
        const lightbox = document.getElementById('productImageLightbox');
        if (!lightbox) return;

        lightbox.classList.remove('show');
        document.body.classList.remove('lightbox-open');
        
        setTimeout(() => {
            lightbox.classList.add('hidden');
        }, 300);
    }

    setupViewModeToggle() {
        const toggleBtn = document.getElementById('viewModeToggle');

        if (!toggleBtn) return;

        if (this._desktopTableModeDisabled) {
            toggleBtn.classList.add('hidden');
            toggleBtn.setAttribute('aria-hidden', 'true');
            this.currentViewMode = 'rapid';
            document.body.classList.add('grid-mode-active');
            return;
        }

        // View mode already loaded in init(), don't reload it here

        toggleBtn.addEventListener('click', () => {
            this.currentViewMode = this.currentViewMode === 'table' ? 'rapid' : 'table';
            localStorage.setItem('counting_view_mode', this.currentViewMode);
            this.updateViewMode();
            // Re-render based on new mode
            if (this.currentViewMode === 'rapid') {
                this.renderRapidCountingMode();
            } else {
                this.renderTable();
            }
        });
    }

    updateViewMode() {
        if (this._desktopTableModeDisabled) {
            this.currentViewMode = 'rapid';
        }

        const viewModeText = document.getElementById('viewModeText');
        const viewModeIcon = document.getElementById('viewModeIcon');
        const rapidGrid = document.getElementById('rapidCountingGrid');
        const tableView = document.getElementById('desktopTableView');
        const cardView = document.getElementById('countingCardView');
        const emptyState = document.getElementById('emptyState');

        if (this.currentViewMode === 'rapid') {
            // Add body class for CSS targeting
            document.body.classList.add('grid-mode-active');
            
            if (viewModeText) viewModeText.textContent = 'Tablo Görünümü';
            if (viewModeIcon) {
                viewModeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>';
            }
            // Grid mode: Show grid, hide table and card views
            if (rapidGrid) {
                rapidGrid.classList.remove('hidden');
                rapidGrid.style.display = '';
            }
            if (tableView) {
                tableView.classList.add('hidden');
                tableView.classList.remove('md:block');
                tableView.style.display = 'none';
                tableView.style.visibility = 'hidden';
            }
            if (cardView) {
                cardView.classList.add('hidden');
                cardView.classList.remove('md:hidden');
                cardView.style.display = 'none';
                cardView.style.visibility = 'hidden';
            }
            // Hide empty state in grid mode
            if (emptyState) {
                emptyState.classList.add('hidden');
                emptyState.style.display = 'none';
                emptyState.style.height = '0';
                emptyState.style.overflow = 'hidden';
            }
            this.renderRapidCountingMode();
        } else {
            // Remove body class for CSS targeting
            document.body.classList.remove('grid-mode-active');
            
            if (viewModeText) viewModeText.textContent = 'Grid Mod';
            if (viewModeIcon) {
                viewModeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>';
            }
            // Table mode: Hide grid, show table and card views (responsive)
            if (rapidGrid) {
                rapidGrid.classList.add('hidden');
                rapidGrid.style.display = 'none';
            }
            if (tableView) {
                tableView.classList.remove('hidden');
                tableView.classList.add('md:block');
                // Remove inline styles to let Tailwind CSS work properly
                tableView.style.removeProperty('display');
                tableView.style.removeProperty('visibility');
                // Ensure mobile hiding - CSS will handle it with !important
            }
            if (cardView) {
                cardView.classList.remove('hidden');
                cardView.classList.add('md:hidden');
                // Remove inline styles to let Tailwind CSS work properly
                cardView.style.removeProperty('display');
                cardView.style.removeProperty('visibility');
            }
            // Empty state will be handled by renderTable()
            if (emptyState) {
                emptyState.style.removeProperty('display');
                emptyState.style.removeProperty('height');
                emptyState.style.removeProperty('overflow');
            }
        }
    }

    async handleManualAdd() {
        const input = document.getElementById('manualProductInput');
        const value = input?.value.trim();
        if (!value) {
            this.showNotification('Lütfen ürün adı veya barkod girin', 'error');
            return;
        }
        await this.handleManualAddFromText(value, { clearInput: true });
    }

    /** Arama kutusu / pano — Getir CDN toplu veya tekil ürün ekleme */
    async handleManualAddFromText(rawText, options = {}) {
        const { clearInput = false } = options;
        const value = String(rawText || '').trim();
        if (!value) {
            this.showNotification('Lütfen ürün adı veya barkod girin', 'error');
            return;
        }

        const G = typeof window !== 'undefined' ? window.GetirCdnPaste : null;

        if (
            G &&
            typeof G.isGetirStyleProductHtml === 'function' &&
            G.isGetirStyleProductHtml(value) &&
            typeof G.resolveProductsFromGetirHtml === 'function'
        ) {
            const resolved = G.resolveProductsFromGetirHtml(value, this.allProducts);
            if (resolved.length > 0) {
                await this.bulkAddResolvedProductsFromGetirPaste(resolved);
                if (clearInput) {
                    const input = document.getElementById('manualProductInput');
                    if (input) input.value = '';
                }
                return;
            }
        }

        if (G && typeof G.extractGetirCdnProductImageUrlsFromText === 'function') {
            const urls = G.extractGetirCdnProductImageUrlsFromText(value);
            if (urls.length > 0) {
                await this.bulkAddProductsFromGetirCdnPaste(urls);
                if (clearInput) {
                    const input = document.getElementById('manualProductInput');
                    if (input) input.value = '';
                }
                return;
            }
        }

        let product = this.findProduct(value);
        if (
            !product &&
            G &&
            typeof G.findProductByGetirImageUrl === 'function' &&
            /^https?:\/\//i.test(value)
        ) {
            product = G.findProductByGetirImageUrl(this.allProducts, value);
        }
        if (!product) {
            this.showNotification('Ürün bulunamadı', 'error');
            return;
        }

        await this.addProductToCounting(product);
        if (clearInput) {
            const input = document.getElementById('manualProductInput');
            if (input) input.value = '';
        }
    }

    /** Panodan Getir eklenti çıktısını okuyup tabloya ekler (arama + Enter ile aynı mantık) */
    async handleGetirCdnPasteFromClipboard() {
        if (this._getirPasteInProgress) return;
        const btn = document.getElementById('getirCdnPasteBtn');
        const G = typeof window !== 'undefined' ? window.GetirCdnPaste : null;

        if (!G || typeof G.readClipboardTextForImport !== 'function') {
            this.showToast('Getir yapıştırma modülü yüklenemedi', 'error', 3000);
            return;
        }

        this._getirPasteInProgress = true;
        if (btn) btn.disabled = true;

        try {
            const raw = await G.readClipboardTextForImport();
            if (!raw) {
                this.showToast(
                    'Panoda metin yok veya tarayıcı pano izni verilmedi',
                    'warning',
                    4000
                );
                return;
            }

            if (
                typeof G.isGetirStyleProductHtml === 'function' &&
                G.isGetirStyleProductHtml(raw) &&
                typeof G.resolveProductsFromGetirHtml === 'function'
            ) {
                const resolved = G.resolveProductsFromGetirHtml(raw, this.allProducts);
                if (resolved.length > 0) {
                    await this.bulkAddResolvedProductsFromGetirPaste(resolved);
                    return;
                }
            }

            const urls =
                typeof G.extractGetirCdnProductImageUrlsFromText === 'function'
                    ? G.extractGetirCdnProductImageUrlsFromText(raw)
                    : [];
            if (urls.length === 0) {
                this.showToast(
                    'Panoda Getir görsel linki bulunamadı. Eklenti çıktısını kopyalayıp tekrar deneyin.',
                    'warning',
                    4500
                );
                return;
            }

            await this.bulkAddProductsFromGetirCdnPaste(urls);
        } finally {
            this._getirPasteInProgress = false;
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Getir HTML parse sonucu ürün listesini tabloya ekler (satır sırası korunur).
     * @param {object[]} resolvedProducts
     */
    async bulkAddResolvedProductsFromGetirPaste(resolvedProducts) {
        this._beginBulkImportLock();
        try {
            const ready = await this._ensureAddTargetTableReady();
            if (!ready) {
                return { added: 0, skippedInTable: 0, noMatch: 0, unmatchedUrls: [] };
            }
            this._verifyCountingDataTableBinding();

            if (!Array.isArray(resolvedProducts) || resolvedProducts.length === 0) {
                return { added: 0, skippedInTable: 0, noMatch: 0, unmatchedUrls: [] };
            }

            const idsInPasteOrder = [];
            const newProductIds = [];
            const seenInPaste = new Set();
            let skippedInTable = 0;
            let addedCount = 0;

            for (let i = 0; i < resolvedProducts.length; i++) {
                const product = resolvedProducts[i];
                if (!product || !product.id) continue;
                const wasInTable = !!this.countingData[product.id];
                if (!seenInPaste.has(product.id)) {
                    seenInPaste.add(product.id);
                    idsInPasteOrder.push(product.id);
                }
                if (!wasInTable) {
                    this.addProductToCounting(product, { skipSave: true });
                    newProductIds.push(product.id);
                    addedCount++;
                } else {
                    skippedInTable++;
                }
            }

            this._lastUnmatchedGetirUrls = [];

            if (idsInPasteOrder.length === 0) {
                if (skippedInTable > 0) {
                    this.showToast('Yapıştırılan ürünler zaten tabloda', 'info', 5000);
                }
                return { added: 0, skippedInTable, noMatch: 0, unmatchedUrls: [] };
            }

            this.appendImportedProductOrder(idsInPasteOrder);
            this._verifyCountingDataTableBinding();
            this._syncProductOrderMeta();

            const tn = this.currentTableName || '';
            this.pushAuditEntry(
                `Getir HTML · ${addedCount} yeni${
                    skippedInTable ? ` · ${skippedInTable} zaten vardı` : ''
                }`,
                { cat: 'import', tbl: tn }
            );

            this._scheduleBackgroundPriceEnrichment(this.currentTableName);

            this.scheduleRenderTable();
            if (this.currentViewMode === 'rapid') {
                this.renderRapidCountingMode();
            }
            this.updateStatistics();
            this.updateCountingProgress();
            this._scheduleTableSelectorUpdate();

            await this.saveCountingData();
            if (newProductIds.length > 0) {
                await this._bulkSaveProductEntries(newProductIds, tn);
            }

            let msg = `${addedCount} ürün eklendi`;
            if (skippedInTable) msg += `, ${skippedInTable} zaten tablodaydı`;
            this.showToast(msg, 'success', 5500);

            return { added: addedCount, skippedInTable, noMatch: 0, unmatchedUrls: [] };
        } finally {
            this._endBulkImportLock();
        }
    }

    /**
     * Getir CDN ürün görsel URL listesi: eşleşen ürünleri tabloya ekler.
     * Mevcut ürünler korunur; yalnızca yeniler yapıştırma sırasıyla sona eklenir.
     * @param {string[]} urls
     */
    async bulkAddProductsFromGetirCdnPaste(urls) {
        this._beginBulkImportLock();
        try {
            const ready = await this._ensureAddTargetTableReady();
            if (!ready) {
                return { added: 0, skippedInTable: 0, noMatch: 0, unmatchedUrls: [] };
            }
            this._verifyCountingDataTableBinding();
            const G = typeof window !== 'undefined' ? window.GetirCdnPaste : null;
        const buildIndex = G && typeof G.buildGetirImageProductIndex === 'function' ? G.buildGetirImageProductIndex : null;
        const findFromIndex = G && typeof G.findProductByGetirImageUrlFromIndex === 'function'
            ? G.findProductByGetirImageUrlFromIndex
            : null;
        const findLegacy = G && typeof G.findProductByGetirImageUrl === 'function' ? G.findProductByGetirImageUrl : null;
        if ((!buildIndex || !findFromIndex) && !findLegacy) {
            return { added: 0, skippedInTable: 0, noMatch: 0, unmatchedUrls: [] };
        }
        if (!Array.isArray(urls) || urls.length === 0) {
            return { added: 0, skippedInTable: 0, noMatch: 0, unmatchedUrls: [] };
        }

        const imageIndex =
            this._getirImageIndex ||
            (buildIndex ? buildIndex(this.allProducts) : null);
        const resolveProduct = (url) => {
            if (imageIndex && findFromIndex) return findFromIndex(imageIndex, url);
            return findLegacy ? findLegacy(this.allProducts, url) : null;
        };

        const idsInPasteOrder = [];
        const newProductIds = [];
        const seenInPaste = new Set();
        const unmatchedUrls = [];
        let skippedInTable = 0;
        let noMatch = 0;
        let addedCount = 0;

        for (let i = 0; i < urls.length; i++) {
            const product = resolveProduct(urls[i]);
            if (!product) {
                noMatch++;
                unmatchedUrls.push(urls[i]);
                continue;
            }
            const wasInTable = !!this.countingData[product.id];
            if (!seenInPaste.has(product.id)) {
                seenInPaste.add(product.id);
                idsInPasteOrder.push(product.id);
            }
            if (!wasInTable) {
                this.addProductToCounting(product, { skipSave: true });
                newProductIds.push(product.id);
                addedCount++;
            } else {
                skippedInTable++;
            }
        }

        this._lastUnmatchedGetirUrls = unmatchedUrls;

        if (idsInPasteOrder.length === 0) {
            if (noMatch > 0 && skippedInTable === 0) {
                this.showToast('Bu görsel adresleriyle eşleşen ürün bulunamadı', 'warning', 5000, {
                    actionHint: 'Eşleşmeyen görselleri görmek için tıklayın',
                    onClick: () => this._openUnmatchedGetirImagesModal(unmatchedUrls),
                });
            } else if (skippedInTable > 0) {
                const allDup = skippedInTable === urls.length && noMatch === 0;
                const toastOpts = noMatch
                    ? {
                          actionHint: 'Eşleşmeyen görselleri görmek için tıklayın',
                          onClick: () => this._openUnmatchedGetirImagesModal(unmatchedUrls),
                      }
                    : null;
                this.showToast(
                    allDup
                        ? 'Yapıştırılan ürünler zaten tabloda'
                        : `${skippedInTable} ürün zaten tablodaydı${noMatch ? ` · ${noMatch} eşleşmedi` : ''}`,
                    'info',
                    5000,
                    toastOpts
                );
            }
            return { added: 0, skippedInTable, noMatch, unmatchedUrls };
        }

        this.appendImportedProductOrder(idsInPasteOrder);
        this._verifyCountingDataTableBinding();
        this._syncProductOrderMeta();

        const tn = this.currentTableName || '';
        this.pushAuditEntry(
            `Getir görselleri · ${addedCount} yeni${
                skippedInTable ? ` · ${skippedInTable} zaten vardı` : ''
            }${noMatch ? ` · ${noMatch} eşleşmedi` : ''}`,
            { cat: 'import', tbl: tn }
        );

        this._scheduleBackgroundPriceEnrichment(this.currentTableName);

        this.scheduleRenderTable();
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
        }
        this.updateStatistics();
        this.updateCountingProgress();
        this._scheduleTableSelectorUpdate();

        await this.saveCountingData();
        if (newProductIds.length > 0) {
            await this._bulkSaveProductEntries(newProductIds, tn);
        }

        let msg = `${addedCount} ürün eklendi`;
        if (skippedInTable) msg += `, ${skippedInTable} zaten tablodaydı`;
        if (noMatch) msg += `, ${noMatch} adres eşleşmedi`;

        const toastOpts = noMatch
            ? {
                  actionHint: 'Eşleşmeyen görselleri görmek için tıklayın',
                  onClick: () => this._openUnmatchedGetirImagesModal(unmatchedUrls),
              }
            : null;
        this.showToast(msg, 'success', 5500, toastOpts);

        return { added: addedCount, skippedInTable, noMatch, unmatchedUrls };
        } finally {
            this._endBulkImportLock();
        }
    }

    findProduct(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        // Use advanced search for better results
        const results = this.advancedProductSearch(searchTerm, 1);
        if (results.length > 0) {
            return results[0];
        }
        
        // Fallback: simple search by name
        let product = this.allProducts.find(p => 
            p.name && p.name.toLowerCase().includes(term)
        );
        
        if (product) return product;
        
        // Fallback: search by barcode
        product = this.allProducts.find(p => {
            if (!p.barcodes || !Array.isArray(p.barcodes)) return false;
            return p.barcodes.some(b => b.code && b.code.toLowerCase() === term);
        });
        
        if (product) return product;
        
        // Fallback: search by ID
        product = this.allProducts.find(p => p.id && p.id.toLowerCase() === term);

        if (product) return product;

        const Gc = typeof window !== 'undefined' ? window.GetirCdnPaste : null;
        if (
            Gc &&
            typeof Gc.findProductByGetirImageUrl === 'function' &&
            typeof searchTerm === 'string' &&
            /(?:cdn-image\.getir\.com\/market\/product\/|cdn\.getir\.com\/(?:product|misc)\/|vsrm-cdn\.erp\.getirapi\.com\/docs\/)/i.test(
                searchTerm
            )
        ) {
            const byImg = Gc.findProductByGetirImageUrl(this.allProducts, searchTerm);
            if (byImg) return byImg;
        }

        return product;
    }

    async addProductToCounting(product, options = {}) {
        if (!product || !product.id) {
            console.error('Invalid product:', product);
            return;
        }

        if (!options.skipSave) {
            const ready = await this._ensureAddTargetTableReady();
            if (!ready) return;
        }

        if (!this._importInProgress) {
            this._verifyCountingDataTableBinding();
        }
        const productId = product.id;
        const now = new Date();
        const skipSave = options.skipSave === true;
        let isNew = false;

        // If product already exists, update it
        if (!this.countingData[productId]) {
            isNew = true;
            this.countingData[productId] = {
                warehouseStock: null,
                systemStock: null,
                lastUpdated: now.toISOString(),
                history: [],
                addedAt: now.toISOString(),
            };
        }

        if (skipSave) {
            return;
        }

        if (isNew) {
            this.appendProductToOrder(productId);
            const tn = this.currentTableName || '';
            this.pushAuditEntry(this.auditProductLabel(productId), {
                cat: 'product_new',
                productId,
                tbl: tn,
            });
        }

        // Ürünü kaydet: counting_items'a (hızlı) + tam blob backup (güvenli)
        await this.saveProductEntry(productId);
        // Yeni ürün eklenince _productOrder güncellendiğinden tam blob backup zorla
        this._scheduleFullBackup();
        this.scheduleRenderTable();

        this.updateStatistics();
        this.updateCountingProgress();
    }

    /** Tam tablo yeniden çizimini kısa gecikmeyle birleştirir; saveCountingData ile karıştırma — kayıt her zaman anında. */
    scheduleRenderTable() {
        if (this._renderTableDebounceTimer != null) {
            clearTimeout(this._renderTableDebounceTimer);
        }
        this._renderTableDebounceTimer = setTimeout(() => {
            this._renderTableDebounceTimer = null;
            this.renderTable();
        }, 24);
    }

    async updateProductStock(productId, warehouseStock, systemStock = null, price = null, priceText = null, reservedStock = undefined, struckPrice = null, struckPriceText = null) {
        if (!this.countingData[productId]) {
            console.error('Product not found in counting data:', productId);
            return;
        }

        const now = new Date();
        const normStock = (v) => {
            if (v === null || v === undefined) return null;
            const n = Number(v);
            return Number.isNaN(n) ? null : n;
        };

        const oldWarehouseStock = this.countingData[productId].warehouseStock;
        const oldSystemStock = this.countingData[productId].systemStock;

        let nextWarehouseStock = oldWarehouseStock;
        let nextSystemStock = oldSystemStock;
        if (warehouseStock !== null && warehouseStock !== undefined) {
            nextWarehouseStock = Number(warehouseStock);
        }
        if (systemStock !== null && systemStock !== undefined) {
            nextSystemStock = Number(systemStock);
        }

        const countingChanged =
            normStock(oldWarehouseStock) !== normStock(nextWarehouseStock) ||
            normStock(oldSystemStock) !== normStock(nextSystemStock);

        if (countingChanged) {
            this.countingData[productId].history.push({
                warehouseStock: oldWarehouseStock,
                systemStock: oldSystemStock,
                timestamp: this.countingData[productId].lastUpdated
            });
        }

        // Update values
        // 0 değeri de geçerli bir stok değeridir, null'dan farklıdır
        if (warehouseStock !== null && warehouseStock !== undefined) {
            this.countingData[productId].warehouseStock = Number(warehouseStock);
        }
        // systemStock = 0 durumu da kabul edilmeli
        if (systemStock !== null && systemStock !== undefined) {
            this.countingData[productId].systemStock = Number(systemStock);
        }
        // Price bilgisini kaydet
        if (price !== null && price !== undefined) {
            this.countingData[productId].price = Number(price);
        }
        if (priceText !== null && priceText !== undefined) {
            this.countingData[productId].priceText = priceText;
        }
        if (struckPrice !== null && struckPrice !== undefined) {
            this.countingData[productId].struckPrice = Number(struckPrice);
            this.countingData[productId]._apiNoStruckPrice = false;
        }
        if (struckPriceText !== null && struckPriceText !== undefined) {
            this.countingData[productId].struckPriceText = struckPriceText;
        }
        if (
            price !== null ||
            priceText !== null ||
            struckPrice !== null ||
            struckPriceText !== null
        ) {
            this._cacheProductPriceFields(
                productId,
                {
                    price: this.countingData[productId].price,
                    priceText: this.countingData[productId].priceText,
                    struckPrice: this.countingData[productId].struckPrice,
                    struckPriceText: this.countingData[productId].struckPriceText,
                    _apiNoStruckPrice: this.countingData[productId]._apiNoStruckPrice === true,
                },
                this.countingData[productId]
            );
        }
        if (
            warehouseStock !== null &&
            warehouseStock !== undefined &&
            this._countingEntryNeedsPriceEnrichment(this.countingData[productId])
        ) {
            const tn = this.currentTableName;
            void this._fetchAndMergeProductPrices(productId, tn).then((ok) => {
                if (!ok) return;
                this._scheduleProductSave(productId, 200);
                this._invalidateFinanceCache(tn);
                if (this.currentTab === 'finans') {
                    this._scheduleFinanceRefresh(tn);
                }
            });
        }
        if (reservedStock !== undefined) {
            if (reservedStock === null) {
                delete this.countingData[productId].reservedStock;
            } else {
                this.countingData[productId].reservedStock = Number(reservedStock);
            }
        }
        if (countingChanged) {
            const nowIso = now.toISOString();
            this.countingData[productId].lastUpdated = nowIso;
            if (
                warehouseStock !== null &&
                warehouseStock !== undefined &&
                normStock(oldWarehouseStock) !== normStock(nextWarehouseStock)
            ) {
                this.countingData[productId].warehouseStockAt = nowIso;
            }
            if (
                systemStock !== null &&
                systemStock !== undefined &&
                normStock(oldSystemStock) !== normStock(nextSystemStock)
            ) {
                this.countingData[productId].systemStockAt = nowIso;
            }
            this.touchTableLastActivity(this.currentTableName, nowIso);
            this._scheduleTableSelectorUpdate();
            this.updateActiveTableActivityLine();
            if (!this._auditSyncBatch) {
                const d = normStock(this.countingData[productId].warehouseStock);
                const s = normStock(this.countingData[productId].systemStock);
                const line = this.formatStockAuditMessageLine(d, s);
                if (this.shouldDeferStockAuditLog(productId)) {
                    this._stockAuditDirty = true;
                } else {
                    this.pushAuditEntry(line, { cat: 'stock', productId });
                }
            }
        }

        // Per-product atomic save (counting_items); fallback: full blob
        this._scheduleProductSave(productId, 400);
        this.scheduleRenderTable();

        this.updateStatistics();
        this.updateCountingProgress();

        if (productId === this.currentCountingProduct) {
            const d = this.countingData[productId];
            this.updateCountingBottomSheetSystemStockDisplay(d.systemStock, d.reservedStock);
            this.updateCorrectEntryButtonState();
            if (this.isProductTimelinePanelOpen()) {
                this.renderProductTimelinePanel(productId);
            }
        }
    }

    /** Sayım sheet: Sistem + (isteğe bağlı) Rezerve — sadece rezerve ≠ 0 iken gösterilir */
    updateCountingBottomSheetSystemStockDisplay(systemStock, reservedStock) {
        const elSys = document.getElementById('countingSystemStock');
        const elRes = document.getElementById('countingReservedStock');
        if (elSys) {
            if (systemStock !== null && systemStock !== undefined) {
                elSys.textContent = `Sistem: ${systemStock}`;
            } else {
                elSys.textContent = '';
            }
        }
        if (elRes) {
            const rs =
                reservedStock !== null && reservedStock !== undefined ? Number(reservedStock) : null;
            if (rs !== null && !Number.isNaN(rs) && rs !== 0) {
                elRes.textContent = `Rezerve: ${rs}`;
                elRes.classList.remove('hidden');
            } else {
                elRes.textContent = '';
                elRes.classList.add('hidden');
            }
        }
    }

    deleteProduct(productId) {
        // Özel popup ile silme onayı
        this.showDeleteConfirmModal(productId);
    }

    // Sayım listesinden onay penceresi olmadan çıkar (manuel arama panelinden toggle için)
    removeProductFromCountingSilent(productId) {
        if (!this.countingData[productId]) return;
        const tn = this.currentTableName || '';
        this.pushAuditEntry(this.auditProductLabel(productId), {
            cat: 'product_removed',
            productId,
            tbl: tn,
        });
        delete this.countingData[productId];
        this.removeProductFromOrder(productId);
        this.skippedProducts.delete(productId);
        // Counting_items'tan sil (async, fire-and-forget)
        this.deleteProductEntry(productId, tn).catch(() => {});
        this._saveMetaOnly().catch(() => {});
        const bottomSheet = document.getElementById('countingBottomSheet');
        if (bottomSheet && !bottomSheet.classList.contains('hidden') && this.currentCountingProduct === productId) {
            void this.closeCountingBottomSheet().catch((err) => console.error(err));
        }
        this.renderTable();
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
        }
        this.updateStatistics();
        this.updateCountingProgress();
    }

    showDeleteConfirmModal(productId) {
        // Ürün bilgisini al
        const product = this.productIndex.get(productId);
        const productName = product ? product.name : 'Bu ürün';
        
        // Mevcut modal varsa kaldır
        const existingModal = document.getElementById('deleteConfirmModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Modal overlay oluştur
        const overlay = document.createElement('div');
        overlay.id = 'deleteConfirmModal';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[120]';
        overlay.style.backdropFilter = 'blur(4px)';
        
        overlay.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl max-w-md w-full transform transition-all">
                <div class="p-6">
                    <div class="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                        <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 text-center mb-2">Ürünü Sil</h3>
                    <p class="text-gray-600 text-center mb-6">
                        <span class="font-medium">${this.escapeHtml(productName)}</span> ürününü sayım tablosundan silmek istediğinize emin misiniz?
                    </p>
                    <div class="flex space-x-3">
                        <button 
                            id="deleteConfirmCancel" 
                            class="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                            İptal
                        </button>
                        <button 
                            id="deleteConfirmDelete" 
                            class="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                        >
                            Sil
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Event listeners
        const cancelBtn = overlay.querySelector('#deleteConfirmCancel');
        const deleteBtn = overlay.querySelector('#deleteConfirmDelete');

        const closeModal = () => {
            overlay.remove();
        };

        cancelBtn.addEventListener('click', closeModal);
        deleteBtn.addEventListener('click', () => {
            // Ürünü sil
            const tn = this.currentTableName || '';
            this.pushAuditEntry(this.auditProductLabel(productId), {
                cat: 'product_deleted',
                productId,
                tbl: tn,
            });
            delete this.countingData[productId];
            this.removeProductFromOrder(productId);
            this.skippedProducts.delete(productId);
            // Counting_items'tan sil (async)
            this.deleteProductEntry(productId, tn).catch(() => {});
            this._saveMetaOnly().catch(() => {});
            
            // Close bottom sheet if it's open
            const bottomSheet = document.getElementById('countingBottomSheet');
            if (bottomSheet && !bottomSheet.classList.contains('hidden')) {
                void this.closeCountingBottomSheet().catch((err) => console.error(err));
            }

            this.renderTable();

            // Update rapid mode if active
            if (this.currentViewMode === 'rapid') {
                this.renderRapidCountingMode();
            }
            
            this.updateStatistics();
            this.updateCountingProgress();
            
            // Başarı bildirimi göster (küçük toast)
            this.showSuccessToast('Ürün silindi');
            
            closeModal();
        });

        // Overlay'e tıklanınca kapat
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // ESC tuşu ile kapat
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    showSuccessToast(message) {
        this.showToast(message, 'success');
    }
    
    // Modern toast notification sistemi
    showToast(message, type = 'info', duration = 4000, options = null) {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.warn('Toast container bulunamadı');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}${options?.onClick ? ' cursor-pointer hover:brightness-[0.98]' : ''}`;
        
        // Icon seç
        let iconSvg = '';
        switch(type) {
            case 'success':
                iconSvg = '<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                break;
            case 'error':
                iconSvg = '<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
                break;
            case 'warning':
                iconSvg = '<svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
                break;
            default:
                iconSvg = '<svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
        }

        const actionHint = options?.actionHint
            ? `<div class="toast-action-hint mt-0.5 text-[11px] font-medium opacity-80">${this.escapeHtml(options.actionHint)}</div>`
            : '';
        
        toast.innerHTML = `
            <div class="toast-icon">${iconSvg}</div>
            <div class="toast-content">
                <div class="toast-message">${this.escapeHtml(message)}</div>
                ${actionHint}
            </div>
            <div class="toast-close" onclick="this.closest('.toast').remove()">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </div>
            <div class="toast-progress">
                <div class="toast-progress-bar" style="width: 100%; transition: width ${duration}ms linear;"></div>
            </div>
        `;

        if (typeof options?.onClick === 'function') {
            toast.addEventListener('click', (e) => {
                if (e.target.closest('.toast-close')) return;
                options.onClick();
            });
        }

        container.appendChild(toast);

        // Show animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Progress bar animation
        setTimeout(() => {
            const progressBar = toast.querySelector('.toast-progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }, 50);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, duration);
    }

    bindUnmatchedGetirImagesModal() {
        const modal = document.getElementById('unmatchedGetirImagesModal');
        const closeBtn = document.getElementById('unmatchedGetirImagesCloseBtn');
        const prevBtn = document.getElementById('unmatchedGetirImagesPrevBtn');
        const nextBtn = document.getElementById('unmatchedGetirImagesNextBtn');
        if (!modal || modal.dataset.setup === 'true') return;
        modal.dataset.setup = 'true';

        const close = () => modal.classList.add('hidden');
        const renderSlide = () => {
            const urls = this._lastUnmatchedGetirUrls || [];
            const idx = this._unmatchedGetirModalIndex;
            const counter = document.getElementById('unmatchedGetirImagesCounter');
            const preview = document.getElementById('unmatchedGetirImagesPreview');
            const urlEl = document.getElementById('unmatchedGetirImagesUrl');
            if (!urls.length) {
                close();
                return;
            }
            const safeIdx = Math.max(0, Math.min(idx, urls.length - 1));
            this._unmatchedGetirModalIndex = safeIdx;
            if (counter) counter.textContent = `${safeIdx + 1} / ${urls.length}`;
            if (preview) preview.src = urls[safeIdx];
            if (urlEl) urlEl.textContent = urls[safeIdx];
            if (prevBtn) prevBtn.disabled = safeIdx <= 0;
            if (nextBtn) nextBtn.disabled = safeIdx >= urls.length - 1;
        };

        closeBtn?.addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
        prevBtn?.addEventListener('click', () => {
            this._unmatchedGetirModalIndex -= 1;
            renderSlide();
        });
        nextBtn?.addEventListener('click', () => {
            this._unmatchedGetirModalIndex += 1;
            renderSlide();
        });
        document.addEventListener('keydown', (e) => {
            if (modal.classList.contains('hidden')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') {
                this._unmatchedGetirModalIndex -= 1;
                renderSlide();
            }
            if (e.key === 'ArrowRight') {
                this._unmatchedGetirModalIndex += 1;
                renderSlide();
            }
        });

        this._renderUnmatchedGetirSlide = renderSlide;
    }

    _openUnmatchedGetirImagesModal(urls) {
        const list = Array.isArray(urls) && urls.length ? urls : this._lastUnmatchedGetirUrls;
        if (!list || !list.length) {
            this.showToast('Eşleşmeyen görsel kaydı yok', 'info', 2500);
            return;
        }
        this._lastUnmatchedGetirUrls = list;
        this._unmatchedGetirModalIndex = 0;
        const modal = document.getElementById('unmatchedGetirImagesModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        if (typeof this._renderUnmatchedGetirSlide === 'function') {
            this._renderUnmatchedGetirSlide();
        }
    }
    
    // Sync progress toast (aşama aşama gösterim)
    showSyncProgressToast(current, total, productName = '') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.warn('⚠️ Toast container bulunamadı');
            return;
        }

        // position: fixed olduğu için scroll pozisyonuna göre ayarlamaya gerek yok

        // Mevcut progress toast'ı bul veya yeni oluştur
        let progressToast = container.querySelector('.toast-sync-progress');
        
        if (!progressToast) {
            progressToast = document.createElement('div');
            progressToast.className = 'toast toast-info toast-sync-progress';
            container.appendChild(progressToast);
        }

        const percentage = Math.round((current / total) * 100);
        
        // Ürün adını kısalt (çok uzunsa)
        const displayName = productName && productName.length > 30 
            ? productName.substring(0, 30) + '...' 
            : productName;
        
        progressToast.innerHTML = `
            <div class="toast-icon">
                <svg class="w-6 h-6 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
            </div>
            <div class="toast-content">
                <div class="toast-title">Stok Senkronizasyonu</div>
                <div class="toast-message">
                    ${displayName ? `<span class="font-medium text-gray-900">${this.escapeHtml(displayName)}</span> güncelleniyor...<br>` : ''}
                    <span class="text-xs text-gray-500">${current}/${total} ürün (${percentage}%)</span>
                </div>
            </div>
            <div class="toast-progress">
                <div class="toast-progress-bar" style="width: ${percentage}%; background: #3b82f6; transition: width 0.3s ease;"></div>
            </div>
        `;

        // Show animation
        if (!progressToast.classList.contains('show')) {
            requestAnimationFrame(() => {
                progressToast.classList.add('show');
            });
        }
    }
    
    // Sync progress toast'ı kapat
    hideSyncProgressToast() {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const progressToast = container.querySelector('.toast-sync-progress');
        if (progressToast) {
            progressToast.classList.remove('show');
            progressToast.classList.add('hide');
            setTimeout(() => {
                if (progressToast.parentNode) {
                    progressToast.remove();
                }
            }, 300);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    _getProductsNeedingSystemSync() {
        return Object.keys(this.countingData).filter((productId) => {
            if (this.isReservedCountingKey(productId)) return false;
            const data = this.countingData[productId];
            return data.systemStock === null || data.systemStock === undefined;
        });
    }

    openSyncStocksConfirmModal() {
        const productsToSync = this._getProductsNeedingSystemSync();
        if (productsToSync.length === 0) {
            this.showToast('Senkronize edilecek ürün bulunamadı', 'info', 3000);
            return;
        }
        const countEl = document.getElementById('syncStocksConfirmCount');
        if (countEl) countEl.textContent = String(productsToSync.length);
        document.getElementById('syncStocksConfirmModal')?.classList.remove('hidden');
    }

    closeSyncStocksConfirmModal() {
        document.getElementById('syncStocksConfirmModal')?.classList.add('hidden');
    }

    async confirmSyncStocksFromModal() {
        this.closeSyncStocksConfirmModal();
        await this.syncSystemStocks();
    }

    async syncSystemStocks() {
        const productsToSync = this._getProductsNeedingSystemSync();

        if (productsToSync.length === 0) {
            this.showToast('Senkronize edilecek ürün bulunamadı', 'info', 3000);
            return;
        }

            // Show loading
            const syncBtn = document.getElementById('syncStocksBtn');
        const originalContent = syncBtn?.innerHTML || '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> <span>Sync</span>';
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<div class="spinner"></div> <span>Senkronize ediliyor...</span>';
        }

            let updatedCount = 0;
        let failedCount = 0;
        let notFoundCount = 0;
        const totalProducts = productsToSync.length;

        // Process each product individually - continue even if one fails
        this._auditSyncBatch = true;
        try {
        for (let i = 0; i < productsToSync.length; i++) {
            const productId = productsToSync[i];
            const currentIndex = i + 1;
            
            try {
                const product = this.productIndex.get(productId);
                if (!product) {
                    console.warn(`⚠️ Ürün bulunamadı (ID: ${productId})`);
                    failedCount++;
                    // Progress güncelle
                    this.showSyncProgressToast(currentIndex, totalProducts);
                    continue;
                }

                const barcode = product.barcodes && product.barcodes.length > 0 ? product.barcodes[0].code : '';
                if (!barcode) {
                    console.warn(`⚠️ Ürün için barkod bulunamadı: ${product.name || productId}`);
                    failedCount++;
                    // Mark as failed
                    if (this.countingData[productId]) {
                        this.countingData[productId].apiFetchFailed = true;
                    }
                    // Progress güncelle
                    this.showSyncProgressToast(currentIndex, totalProducts);
                    continue;
                }

                // Progress göster
                this.showSyncProgressToast(currentIndex, totalProducts, product.name);

                // Try to fetch stock
                try {
                    const result = await this.requestStockFromExtension(product.name, barcode, productId);
                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    const price = typeof result === 'object' && result !== null ? result?.price : null;
                    const priceText = typeof result === 'object' && result !== null ? result?.priceText : null;
                    const struckPrice = typeof result === 'object' && result !== null ? (result?.struckPrice ?? null) : null;
                    const struckPriceText = typeof result === 'object' && result !== null ? (result?.struckPriceText ?? null) : null;
                    const reserved =
                        typeof result === 'object' && result !== null && 'reservedStock' in result
                            ? result.reservedStock
                            : undefined;

                    if (stock !== null && stock !== undefined) {
                        // Success - update stock and clear failed flag
                        if (this.countingData[productId]) {
                            this.countingData[productId].apiFetchFailed = false;
                        }
                        await this.updateProductStock(productId, null, stock, price, priceText, reserved, struckPrice, struckPriceText);
                    updatedCount++;
                        console.log(`✅ ${product.name || productId}: ${stock}${price ? ` (Fiyat: ${priceText || price})` : ''}`);
                    } else {
                        // Not found - mark as failed
                        if (this.countingData[productId]) {
                            this.countingData[productId].apiFetchFailed = true;
                            this.saveCountingData();
                        }
                        notFoundCount++;
                        console.warn(`⚠️ Stok bulunamadı: ${product.name || productId}`);
                    }
                } catch (error) {
                    // API error - mark as failed but continue
                    console.warn(`❌ API hatası (${product.name || productId}):`, error.message || error);
                    if (this.countingData[productId]) {
                        this.countingData[productId].apiFetchFailed = true;
                        this.saveCountingData();
                    }
                    failedCount++;
                }
            } catch (error) {
                // Unexpected error - continue with next product
                console.error(`❌ Beklenmeyen hata (${productId}):`, error);
                failedCount++;
            }
        }
        } finally {
            this._auditSyncBatch = false;
        }

        if (updatedCount > 0) {
            this.pushAuditEntry(`Sistem stoku senkron · ${updatedCount} ürün`, { cat: 'sync' });
            await this.saveCountingData();
        }
        
        // Progress toast'ı kapat
        this.hideSyncProgressToast();

            // Reset button
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalContent;
        }

        // Re-render table to show updated states
        this.renderTable();
        this.updateStatistics();
        this.updateCorrectEntryButtonState();

        // Show summary toast (tarayıcı bildirimi yerine)
        const messages = [];
            if (updatedCount > 0) {
            messages.push(`${updatedCount} ürün güncellendi`);
        }
        if (notFoundCount > 0) {
            messages.push(`${notFoundCount} ürün bulunamadı`);
        }
        if (failedCount > 0) {
            messages.push(`${failedCount} ürün hatası`);
        }

        if (messages.length > 0) {
            const summary = messages.join(', ');
            if (updatedCount > 0) {
                this.showToast(summary, 'success', 5000);
            } else {
                this.showToast(summary, 'info', 5000);
            }
        } else {
            this.showToast('Hiçbir ürün güncellenemedi', 'error', 5000);
        }
    }

    async fetchSystemStocks(productIds) {
        // Get products that need sync
        const productsToSync = productIds.map(id => {
            const product = this.productIndex.get(id);
            return {
                id,
                name: product?.name || '',
                barcode: product?.barcodes?.[0]?.code || '',
                productId: id // Product ID'yi direkt kullan (Getir API formatında)
            };
        });

        const systemStocks = {};

        // Check if Getir franchise page is open
        try {
            // Try to communicate with extension via postMessage
            // We'll use a popup window approach or check if the page is open
            
            // For each product, request stock from extension (productId öncelikli, sonra barcode)
            for (const product of productsToSync) {
                try {
                    // Product ID öncelikli - direkt product ID ile arama yap (en hızlı ve güvenilir)
                    const result = await this.requestStockFromExtension(product.name, product.barcode, product.productId);
                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    if (stock !== null && stock !== undefined) {
                        systemStocks[product.id] = stock;
                    }
                } catch (error) {
                    console.warn(`Failed to get stock for ${product.name} (ID: ${product.id}):`, error);
                }
            }

            // If no stocks were retrieved, show instruction
            if (Object.keys(systemStocks).length === 0) {
                this.showNotification('Getir franchise sayfası açık değil veya token süresi dolmuş. Lütfen https://franchise.getir.com/stock/current sayfasını açın ve sayfayı yenileyin.', 'error');
            }
        } catch (error) {
            console.error('Error fetching stocks from extension:', error);
            this.showNotification('Stok senkronizasyonu başarısız. Lütfen Getir franchise sayfasının açık olduğundan ve eklentinin kurulu olduğundan emin olun.', 'error');
        }

        return systemStocks;
    }

    async requestStockFromExtension(productName, barcode, productId = null, options = {}) {
        return new Promise(async (resolve, reject) => {
            // Background script'ten API bilgilerini al (chrome.runtime.sendMessage)
            let apiInfo = null;
            
            // Debug: Extension durumunu kontrol et
            console.log('🔍 Extension durumu kontrol ediliyor...');
            console.log('  - typeof chrome:', typeof chrome);
            console.log('  - chrome.runtime:', typeof chrome !== 'undefined' ? (chrome.runtime ? 'mevcut' : 'yok') : 'chrome yok');
            console.log('  - chrome.runtime.sendMessage:', typeof chrome !== 'undefined' && chrome.runtime ? (chrome.runtime.sendMessage ? 'mevcut' : 'yok') : 'yok');
            console.log('  - chrome.runtime.id:', typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : 'yok');
            
            // ÖNCE SUPABASE'DEN OKU (Mobil için)
            if (!apiInfo && window.supabase) {
                try {
                    // currentUser yoksa auth'dan al
                    let username = null;
                    if (this.currentUser && this.currentUser.username) {
                        username = this.currentUser.username;
                    } else if (window.authUtils && window.authUtils.checkAuth) {
                        const session = window.authUtils.checkAuth();
                        if (session && session.username) {
                            username = session.username;
                        }
                    }
                    
                    if (!username) {
                        console.warn('⚠️ Kullanıcı adı bulunamadı, Supabase\'den okuma yapılamıyor');
                    } else {
                        console.log('🔍 Supabase\'den API bilgileri okunuyor (kullanıcı:', username, ')...');
                        const { data: userData, error } = await window.supabase
                            .from('users')
                            .select('counting_data')
                            .eq('username', username)
                            .maybeSingle();
                    
                    if (!error && userData && userData.counting_data) {
                        const countingData = typeof userData.counting_data === 'string' 
                            ? JSON.parse(userData.counting_data) 
                            : userData.counting_data;
                        
                        if (countingData._api_info && countingData._api_info.token) {
                            // Token'ın Bearer prefix'i olup olmadığını kontrol et
                            let token = countingData._api_info.token;
                            if (!token.startsWith('Bearer ')) {
                                token = 'Bearer ' + token.trim();
                            }
                            
                            apiInfo = {
                                token: token,
                                warehouseId: countingData._api_info.warehouseId,
                                warehouseName: countingData._api_info.warehouseName || null,
                                tokenExpiry: countingData._api_info.tokenExpiry,
                                baseUrl: countingData._api_info.baseUrl || 'https://franchise-api-gateway.getirapi.com',
                                stockEndpoint: countingData._api_info.stockEndpoint || 'https://franchise-api-gateway.getirapi.com/stocks',
                                timestamp: countingData._api_info.timestamp
                            };
                            console.log('✅ API bilgileri Supabase\'den alındı:', {
                                hasToken: !!apiInfo.token,
                                warehouseId: apiInfo.warehouseId,
                                warehouseName: apiInfo.warehouseName,
                                stockEndpoint: apiInfo.stockEndpoint,
                                tokenLength: token.length,
                                tokenPrefix: token.substring(0, 7)
                            });
                        } else {
                            console.warn('⚠️ Supabase\'de _api_info veya token bulunamadı');
                        }
                    } else if (error) {
                        console.warn('⚠️ Supabase okuma hatası:', error);
                    } else {
                        console.warn('⚠️ Supabase\'de counting_data bulunamadı');
                    }
                    }
                } catch (error) {
                    console.warn('⚠️ Supabase API bilgileri okuma hatası:', error);
                    console.error('Hata detayı:', error);
                }
            }
            
            try {
                // Extension varsa background script'ten API bilgilerini al
                // chrome.runtime.id sadece extension context'inde çalışır, normal sayfalarda undefined olur
                // Bu yüzden direkt chrome.runtime.sendMessage kullanıyoruz (ID olmadan)
                if (!apiInfo && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    console.log('✅ Extension API mevcut, background script\'e mesaj gönderiliyor...');
                    
                    // Extension ID'yi al (extension helper'dan veya hardcoded)
                    const extensionId = window.getirExtensionHelper?.extensionId || 'dhgdhdnnpeakmomlgpgmokecmdmeoebn';
                    
                    const response = await new Promise((resolveMessage) => {
                        // Extension ID ile gönder
                        chrome.runtime.sendMessage(
                            extensionId,
                            { type: 'GET_API_INFO' },
                            (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error('❌ Extension mesaj hatası:', chrome.runtime.lastError.message);
                                    console.log('💡 Extension yüklü değil veya erişilemiyor. Extension\'ı kontrol edin.');
                                    console.log('💡 Extension ID:', extensionId);
                                    resolveMessage(null);
                                } else {
                                    console.log('📥 Extension\'dan yanıt alındı:', response ? 'var' : 'yok');
                                    resolveMessage(response);
                                }
                            }
                        );
                    });
                    
                    if (response && response.success && response.apiInfo) {
                        apiInfo = response.apiInfo;
                        console.log('✅ API bilgileri background script\'ten alındı:', {
                            hasToken: !!apiInfo.token,
                            warehouseId: apiInfo.warehouseId,
                            stockEndpoint: apiInfo.stockEndpoint
                        });
                        
                        // API bilgilerini Supabase'e kaydet (kullanıcıya özel)
                        await this.saveAPIInfoToSupabase(apiInfo);
                    } else if (response && !response.success) {
                        console.warn('⚠️ Background script API bilgileri döndürmedi:', response.error);
                    } else if (!response) {
                        console.log('ℹ️ Extension\'dan yanıt alınamadı (null)');
                    }
                } else if (!apiInfo) {
                    console.warn('⚠️ chrome.runtime.sendMessage mevcut değil');
                    console.log('💡 Extension yüklü olmayabilir veya sayfa extension context\'inde değil');
                }
            } catch (error) {
                console.error('❌ Extension mesaj gönderme hatası:', error);
            }
            
            // Fallback 1: window.getirExtensionHelper kullan (content script inject edilmişse)
            if (!apiInfo && typeof window !== 'undefined' && window.getirExtensionHelper) {
                try {
                    console.log('🔍 window.getirExtensionHelper kullanılıyor...');
                    apiInfo = await window.getirExtensionHelper.getAPIInfo();
                    console.log('✅ API bilgileri window.getirExtensionHelper\'dan alındı');
                    
                    // API bilgilerini Supabase'e kaydet (kullanıcıya özel)
                    if (apiInfo) {
                        await this.saveAPIInfoToSupabase(apiInfo);
                    }
                } catch (error) {
                    console.warn('⚠️ window.getirExtensionHelper hatası:', error.message);
                }
            }
            
            // Fallback 2: localStorage'dan oku (aynı domain ise)
            if (!apiInfo) {
            const apiInfoKey = 'getir_api_info';
            const apiInfoStr = localStorage.getItem(apiInfoKey);
            
                if (apiInfoStr) {
                    try {
                        apiInfo = JSON.parse(apiInfoStr);
                        console.log('📥 API bilgileri localStorage\'dan alındı (fallback)');
                        
                        // API bilgilerini Supabase'e kaydet (kullanıcıya özel)
                        if (apiInfo) {
                            await this.saveAPIInfoToSupabase(apiInfo);
                        }
                    } catch (e) {
                        console.warn('⚠️ localStorage parse hatası:', e);
                    }
                }
            }
            
            if (!apiInfo) {
                console.log('ℹ️ API bilgileri bulunamadı. Supabase, extension ve localStorage kontrol edildi.');
                reject(new Error('API bilgileri bulunamadı. Lütfen Getir franchise sayfasını açın (https://franchise.getir.com/stock/current) ve sayfayı yenileyin. Extension token\'ı yakalayacak ve Supabase\'e kaydedecektir.'));
                return;
            }
            
            try {
                console.log('🌐 API bilgileri bulundu:', {
                    baseUrl: apiInfo.baseUrl,
                    stockEndpoint: apiInfo.stockEndpoint,
                    warehouseId: apiInfo.warehouseId,
                    hasToken: !!apiInfo.token,
                    tokenExpiry: apiInfo.tokenExpiry ? new Date(apiInfo.tokenExpiry).toLocaleString('tr-TR') : 'N/A'
                });
                
                // Token geçerliliğini kontrol et (JWT exp dahil)
                const effectiveExpiry = this.getEffectiveExpiryMs(apiInfo);
                if (effectiveExpiry && Date.now() >= effectiveExpiry - 5 * 60 * 1000) {
                    reject(new Error('Token süresi dolmuş. Lütfen Getir franchise sayfasını yenileyin (https://franchise.getir.com/stock/current).'));
                    return;
                }
                
                // API bilgileri varsa direkt API çağrısı yap
                if (!apiInfo.token) {
                    reject(new Error('Token bulunamadı. Lütfen Getir franchise sayfasını açın ve sayfayı yenileyin.'));
                    return;
                }
                
                if (!apiInfo.stockEndpoint) {
                    // Varsayılan endpoint
                    apiInfo.stockEndpoint = 'https://franchise-api-gateway.getirapi.com/stocks';
                }
                
                if (!apiInfo.warehouseId) {
                    // Varsayılan warehouse ID
                    apiInfo.warehouseId = '5dcafe6ae2c61b1e52cf1704';
                }
                
                // API bilgilerini Supabase'e kaydet (telefondan erişim için)
                await this.saveAPIInfoToSupabase(apiInfo);
                
                try {
                    const result = await this.fetchStockFromAPI(apiInfo, barcode, productName, productId, options);
                    // Backward compatibility: if result is a number, return it as stock
                    // Otherwise return the full object
                    if (typeof result === 'number') {
                        resolve(result);
                    } else if (result && typeof result === 'object' && result.stock !== undefined) {
                        resolve(result);
                    } else {
                        resolve(result);
                    }
                } catch (apiError) {
                    console.error('❌ API çağrısı başarısız:', apiError);
                    reject(apiError);
                }
            } catch (error) {
                console.error('⚠️ API bilgileri parse edilemedi:', error);
                reject(new Error('API bilgileri okunamadı: ' + error.message));
            }
        });
    }

    /** console-quiet.js log'u kapatsa bile konsolda görünür çıktı */
    _devOut(...args) {
        console.warn('[JetBarkod]', ...args);
    }

    async _resolveApiInfoForDebug() {
        if (this.countingData?._api_info?.token) return this.countingData._api_info;

        try {
            const raw = localStorage.getItem('getir_api_info');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.token) return parsed;
            }
        } catch (_) { /* ignore */ }

        if (window.getirExtensionHelper?.getAPIInfo) {
            try {
                const info = await window.getirExtensionHelper.getAPIInfo();
                if (info?.token) return info;
            } catch (_) { /* ignore */ }
        }

        if (window.supabase) {
            const session = window.authUtils?.checkAuth();
            if (session?.username) {
                const { data: userData } = await window.supabase
                    .from('users')
                    .select('counting_data')
                    .eq('username', session.username)
                    .maybeSingle();
                if (userData?.counting_data) {
                    const cd = typeof userData.counting_data === 'string'
                        ? JSON.parse(userData.counting_data)
                        : userData.counting_data;
                    if (cd?._api_info?.token) return cd._api_info;
                }
            }
        }

        return null;
    }

    _findProductRowInApiData(data, { productId, barcode } = {}) {
        if (!data?.data || !Array.isArray(data.data)) return null;

        if (productId) {
            const byId = data.data.find((item) => {
                const itemProductId = item._id || item.id || item.product?._id || item.product?.id || item.product;
                return itemProductId === productId || String(itemProductId) === String(productId);
            });
            if (byId) return byId;
        }

        if (barcode) {
            const code = String(barcode);
            return data.data.find((item) => {
                if (item.packagingInfo) {
                    for (const key in item.packagingInfo) {
                        if (item.packagingInfo[key]?.barcodes?.includes(code)) return true;
                    }
                }
                return item.barcode === code;
            }) || null;
        }

        return null;
    }

    _summarizeApiProductRow(row) {
        if (!row || typeof row !== 'object') return null;
        const name = row.fullName?.tr || row.displayName?.tr || row.name || row.productName || '—';
        const productId = row._id || row.id || row.product?._id || row.product?.id || row.product || '—';
        const barcodes = [];
        if (row.barcode) barcodes.push(String(row.barcode));
        if (row.packagingInfo) {
            Object.values(row.packagingInfo).forEach((pkg) => {
                (pkg?.barcodes || []).forEach((b) => {
                    if (b && !barcodes.includes(String(b))) barcodes.push(String(b));
                });
            });
        }
        return {
            productId,
            name,
            barcodes,
            available: row.available,
            reserve: row.reserve ?? row.reservedStock ?? row.reserved,
            price: row.price,
            priceText: row.priceText,
            struckPrice: row.struckPrice,
            struckPriceText: row.struckPriceText,
            wholesalePrice: row.wholesalePrice,
            expDays: row.expDays || null,
            categories: row.categories,
            categoryName: row.category?.name?.tr || row.category?.name || null,
        };
    }

    /**
     * Konsoldan barkod ile API ürün satırını incele.
     * Kullanım: await testBarkod('8690103292390')
     */
    async inspectProductByBarcode(barcode) {
        const code = String(barcode || '').trim();
        if (!code) {
            this._devOut('❌ Barkod girin. Örnek: await testBarkod("8690103292390")');
            return null;
        }

        try {
            const apiInfo = await this._resolveApiInfoForDebug();
            if (!apiInfo?.token) {
                this._devOut('❌ API bilgisi yok. Getir franchise sayfasını açıp sayfayı yenileyin.');
                return null;
            }

            const catalogProduct = this.findProductByBarcode(code);
            const productId = catalogProduct?.id || catalogProduct?.productId || null;

            this._devOut('🧪 Barkod testi', {
                barcode: code,
                productId,
                catalogName: catalogProduct?.name || null,
            });

            const endpoint = apiInfo.stockEndpoint || 'https://franchise-api-gateway.getirapi.com/stocks';
            const warehouseId = apiInfo.warehouseId || '5dcafe6ae2c61b1e52cf1704';
            let authToken = apiInfo.token;
            if (!authToken.startsWith('Bearer ')) authToken = 'Bearer ' + authToken.trim();

            const requestBody = {
                warehouseIds: [warehouseId],
                productIds: productId ? [productId] : [],
                sort: { available: 1 },
            };

            const response = await fetch(`${endpoint}?limit=100&offset=0`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: authToken,
                    Origin: 'https://franchise.getir.com',
                    Referer: 'https://franchise.getir.com/',
                    Accept: '*/*',
                },
                body: JSON.stringify(requestBody),
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseErr) {
                this._devOut('❌ API yanıtı JSON değil', response.status, responseText.slice(0, 300));
                return null;
            }

            if (!response.ok) {
                this._devOut('❌ API hatası', response.status, data);
                return data;
            }

            const foundProduct = this._findProductRowInApiData(data, { productId, barcode: code });
            if (foundProduct) {
                const pid = foundProduct._id || foundProduct.id || foundProduct.product;
                if (pid) this._apiProductRowCache.set(String(pid), foundProduct);

                const summary = this._summarizeApiProductRow(foundProduct);
                this._devOut('📦 Özet:', summary);
                this._devOut('📦 Tam ürün satırı:', foundProduct);
                if (summary?.expDays) {
                    this._devOut('⏳ Raf ömrü (expDays):', summary.expDays);
                }
                return foundProduct;
            }

            this._devOut('⚠️ Ürün bulunamadı — ham yanıt:', data);
            return data;
        } catch (error) {
            this._devOut('❌ Test hatası:', error);
            return null;
        }
    }

    async _fetchApiProductRowByProductId(productId, barcode = null) {
        const pid = String(productId || '').trim();
        if (!pid) return null;

        try {
            const apiInfo = await this._resolveApiInfoForDebug();
            if (!apiInfo?.token) return null;

            const endpoint = apiInfo.stockEndpoint || 'https://franchise-api-gateway.getirapi.com/stocks';
            const warehouseId = apiInfo.warehouseId || '5dcafe6ae2c61b1e52cf1704';
            let authToken = apiInfo.token;
            if (!authToken.startsWith('Bearer ')) authToken = 'Bearer ' + authToken.trim();

            const response = await fetch(`${endpoint}?limit=100&offset=0`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: authToken,
                    Origin: 'https://franchise.getir.com',
                    Referer: 'https://franchise.getir.com/',
                    Accept: '*/*',
                },
                body: JSON.stringify({
                    warehouseIds: [warehouseId],
                    productIds: [pid],
                    sort: { available: 1 },
                }),
            });

            const data = JSON.parse(await response.text());
            if (!response.ok) return null;

            const foundProduct = this._findProductRowInApiData(data, {
                productId: pid,
                barcode: barcode ? String(barcode) : null,
            });
            if (foundProduct) {
                const cacheId = foundProduct._id || foundProduct.id || foundProduct.product || pid;
                this._apiProductRowCache.set(String(cacheId), foundProduct);
                return foundProduct;
            }
            return null;
        } catch (_) {
            return null;
        }
    }

    async testAPIRequest(barcode) {
        return this.inspectProductByBarcode(barcode);
    }

    /**
     * Getir /stocks API ürün satırından rezerve miktarı.
     * Tek alan (reservedStock, reserved, …) veya kurumsal + imha + transfer rezerv toplamı.
     * @returns {number|null} null = yanıtta rezerve alanı yok veya okunamadı
     */
    extractReservedStockFromProductItem(item) {
        if (!item || typeof item !== 'object') return null;
        const directKeys = ['reserve', 'reservedStock', 'reserved', 'reservedQuantity', 'rezerveStock'];
        for (const k of directKeys) {
            if (Object.prototype.hasOwnProperty.call(item, k) && item[k] !== null && item[k] !== undefined) {
                const n = Number(item[k]);
                if (!Number.isNaN(n)) return n;
            }
        }
        const sumKeys = ['reservedForCorporateSales', 'reservedForDisposal', 'reservedForTransfer'];
        let sum = 0;
        let any = false;
        for (const k of sumKeys) {
            if (Object.prototype.hasOwnProperty.call(item, k) && item[k] !== null && item[k] !== undefined) {
                const n = Number(item[k]);
                if (!Number.isNaN(n)) {
                    sum += n;
                    any = true;
                }
            }
        }
        return any ? sum : null;
    }

    /**
     * /stocks ürün satırından sistem stoku — öncelik: available → stock → quantity
     * @returns {{ stock: number|null, sourceField: string|null }}
     */
    pickSystemStockFromProductRow(item) {
        if (!item || typeof item !== 'object') {
            return { stock: null, sourceField: null };
        }
        if (item.available !== null && item.available !== undefined) {
            return { stock: item.available, sourceField: 'available' };
        }
        if (item.stock !== null && item.stock !== undefined) {
            return { stock: item.stock, sourceField: 'stock' };
        }
        if (item.quantity !== null && item.quantity !== undefined) {
            return { stock: item.quantity, sourceField: 'quantity' };
        }
        return { stock: null, sourceField: null };
    }

    async fetchStockFromAPI(apiInfo, barcode, productName, productId = null, options = {}) {
        try {
            // Token geçerliliğini kontrol et
            if (apiInfo.tokenExpiry && Date.now() >= (apiInfo.tokenExpiry - 5 * 60 * 1000)) {
                throw new Error('Token süresi dolmuş. Lütfen Getir franchise sayfasını yenileyin.');
            }
            
            // Eğer productId yoksa ve barcode varsa, products.json'dan product ID'yi bul
            if (!productId && barcode) {
                const foundProduct = this.findProductByBarcode(barcode);
                if (foundProduct && foundProduct.productId) {
                    productId = foundProduct.productId;
                } else {
                    throw new Error(`Barkod "${barcode}" için product ID bulunamadı. Lütfen products.json'da bu barkodun olduğundan emin olun.`);
                }
            }
            
            // Eğer productId hala yoksa ve productName varsa, isim ile product ID bul
            if (!productId && productName) {
                const foundProduct = this.findProductByName(productName);
                if (foundProduct && foundProduct.productId) {
                    productId = foundProduct.productId;
                }
            }
            
            // Product ID yoksa hata ver
            if (!productId) {
                throw new Error('Product ID bulunamadı. Lütfen barkod veya ürün adı girin.');
            }
            
            // franchise-api-gateway.getirapi.com/stocks endpoint'ini kullan
            const endpoint = apiInfo.stockEndpoint || 'https://franchise-api-gateway.getirapi.com/stocks';
            const warehouseId = apiInfo.warehouseId || '5dcafe6ae2c61b1e52cf1704';
            
            // Yeni API formatı: warehouseIds (array), productIds (array), sort
            let requestBody = {
                warehouseIds: [warehouseId],
                productIds: [productId], // Artık her zaman product ID var
                sort: { available: 1 }
            };
            
            const urlWithParams = `${endpoint}?limit=100&offset=0`;
            
            // Token'ın Bearer prefix'i olup olmadığını kontrol et ve düzelt
            let authToken = apiInfo.token;
            if (!authToken) {
                throw new Error('Token bulunamadı. Lütfen Getir franchise sayfasını açın ve sayfayı yenileyin.');
            }
            if (!authToken.startsWith('Bearer ')) {
                authToken = 'Bearer ' + authToken.trim();
            }
            
            let response;
            try {
                // apiInfo.headers içinden User-Agent'ı filtrele (CORS hatası vermemesi için)
                const safeHeaders = {};
                if (apiInfo.headers && typeof apiInfo.headers === 'object') {
                    Object.keys(apiInfo.headers).forEach(key => {
                        // User-Agent ve user-agent header'larını atla
                        if (key.toLowerCase() !== 'user-agent') {
                            safeHeaders[key] = apiInfo.headers[key];
                        }
                    });
                }
                
                // Final headers objesi - User-Agent kesinlikle olmamalı
                const finalHeaders = {
                    'Content-Type': 'application/json',
                    'Authorization': authToken,
                    'Origin': 'https://franchise.getir.com',
                    'Referer': 'https://franchise.getir.com/',
                    'Accept': '*/*',
                    'Accept-Language': 'tr-TR,tr;q=0.9',
                    // User-Agent header'ı kaldırıldı - CORS tarafından izin verilmiyor
                    ...safeHeaders // Sadece güvenli header'ları ekle
                };
                
                // Son kontrol: User-Agent var mı?
                if (finalHeaders['User-Agent'] || finalHeaders['user-agent']) {
                    delete finalHeaders['User-Agent'];
                    delete finalHeaders['user-agent'];
                }

                response = await fetch(urlWithParams, {
                    method: 'POST',
                    headers: finalHeaders,
                    body: JSON.stringify(requestBody),
                    // CORS için mode ve credentials ayarları
                    mode: 'cors',
                    credentials: 'omit'
                });
            } catch (fetchError) {
                // CORS hatası kontrolü
                if (fetchError.message && (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError'))) {
                    throw new Error('API\'ye erişilemiyor (CORS/Network hatası). Detaylar: ' + fetchError.message + ' | URL: ' + urlWithParams.substring(0, 50) + '...');
                } else if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
                    throw new Error('API çağrısı yapılamadı: ' + fetchError.message + '. Lütfen sayfayı yenileyip tekrar deneyin.');
                }
                throw new Error('API çağrısı başarısız: ' + (fetchError.message || fetchError.name || 'Bilinmeyen hata'));
            }
            
            if (!response.ok) {
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch (e) {
                    errorText = 'Yanıt okunamadı';
                }
                if (response.status === 401) {
                    throw new Error('Yetkilendirme hatası: Token geçersiz veya süresi dolmuş. Lütfen Getir franchise sayfasını yenileyin.');
                } else if (response.status === 403) {
                    throw new Error('Erişim reddedildi: Token yetkisi yetersiz. Lütfen Getir franchise sayfasını yenileyin.');
                } else if (response.status === 404) {
                    throw new Error('API endpoint bulunamadı. Lütfen daha sonra tekrar deneyin.');
                } else if (response.status >= 500) {
                    throw new Error('Sunucu hatası: API geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
                }
                throw new Error(`API hatası: ${response.status} ${response.statusText}`);
            }
            
            let data;
            try {
                const responseText = await response.text();
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    throw new Error('API yanıtı geçersiz JSON formatında: ' + responseText.substring(0, 200));
                }
            } catch (textError) {
                throw new Error('API yanıtı okunamadı: ' + (textError.message || 'Bilinmeyen hata'));
            }
            
            // Response format'ına göre stok değerini bul
            let stock = null;
            let foundProduct = null;
            let stockSourceField = null;
            
            // Yeni format: { data: [...], total: ... }
            if (data.data && Array.isArray(data.data)) {
                // Eğer productId varsa, direkt eşleşeni bul
                if (productId) {
                    foundProduct = data.data.find(item => {
                        const itemProductId = item._id || item.id || item.product;
                        return itemProductId === productId || String(itemProductId) === String(productId);
                    });
                }
                // Eğer barcode varsa, packagingInfo'dan barcode'u kontrol et
                else if (barcode) {
                    foundProduct = data.data.find(item => {
                        // packagingInfo'dan tüm barcode'ları çıkar
                        if (item.packagingInfo) {
                            for (const key in item.packagingInfo) {
                                if (key !== 'pickingType' && item.packagingInfo[key] && item.packagingInfo[key].barcodes) {
                                    const barcodes = item.packagingInfo[key].barcodes;
                                    if (Array.isArray(barcodes) && barcodes.includes(String(barcode))) {
                                        return true;
                                    }
                                }
                            }
                        }
                        // Direkt barcode field'ı varsa
                        if (item.barcode === barcode || item.barcode === String(barcode)) {
                            return true;
                    }
                    return false;
                });
                }
                // Eğer productName varsa, isim ile eşleşeni bul
                else if (productName) {
                    foundProduct = data.data.find(item => {
                        const itemName = item.name || (item.fullName && (item.fullName.tr || item.fullName.en)) || '';
                        const nameStr = typeof itemName === 'string' ? itemName : (itemName.tr || itemName.en || '');
                        return nameStr.toLowerCase().includes(productName.toLowerCase());
                    });
                }
                
                if (foundProduct) {
                    if (productId) {
                        this._apiProductRowCache.set(String(productId), foundProduct);
                    }
                    const picked = this.pickSystemStockFromProductRow(foundProduct);
                    stock = picked.stock;
                    stockSourceField = picked.sourceField;
                }
            } 
            // Eski format desteği (fallback)
            else if (Array.isArray(data)) {
                foundProduct = data.find(item => {
                    if (productId) {
                        const itemProductId = item._id || item.id || item.product;
                        return itemProductId === productId || String(itemProductId) === String(productId);
                    } else if (barcode) {
                        if (item.packagingInfo) {
                            for (const key in item.packagingInfo) {
                                if (key !== 'pickingType' && item.packagingInfo[key] && item.packagingInfo[key].barcodes) {
                                    const barcodes = item.packagingInfo[key].barcodes;
                                    if (Array.isArray(barcodes) && barcodes.includes(String(barcode))) {
                                        return true;
                                    }
                                }
                            }
                        }
                        return item.barcode === barcode || item.barcode === String(barcode);
                        } else if (productName) {
                        const itemName = item.name || (item.fullName && (item.fullName.tr || item.fullName.en)) || '';
                        const nameStr = typeof itemName === 'string' ? itemName : (itemName.tr || itemName.en || '');
                        return nameStr.toLowerCase().includes(productName.toLowerCase());
                        }
                        return false;
                    });
                if (foundProduct) {
                    if (productId) {
                        this._apiProductRowCache.set(String(productId), foundProduct);
                    }
                    const picked = this.pickSystemStockFromProductRow(foundProduct);
                    stock = picked.stock;
                    stockSourceField = picked.sourceField;
                    
                    // Kategori bilgisini API'den al ve allProducts array'ini güncelle (eski format için de)
                    if (productId && foundProduct) {
                        let category = null;
                        let subCategory = null;
                        
                        // 1. Öncelik: category.name.tr veya category.name.en (object formatı)
                        if (foundProduct.category) {
                            if (typeof foundProduct.category === 'string') {
                                category = foundProduct.category;
                            } else if (foundProduct.category.name) {
                                // name object ise tr veya en al
                                category = foundProduct.category.name.tr || 
                                          foundProduct.category.name.en || 
                                          foundProduct.category.name;
                            } else if (foundProduct.category.tr) {
                                category = foundProduct.category.tr;
                            } else if (foundProduct.category.en) {
                                category = foundProduct.category.en;
                            }
                        }
                        // 2. categoryName field'ı (string)
                        else if (foundProduct.categoryName) {
                            category = foundProduct.categoryName;
                        }
                        // 3. product.category (nested)
                        else if (foundProduct.product?.category) {
                            if (typeof foundProduct.product.category === 'string') {
                                category = foundProduct.product.category;
                            } else if (foundProduct.product.category.name) {
                                category = foundProduct.product.category.name.tr || 
                                          foundProduct.product.category.name.en;
                            }
                        }
                        // 4. masterCategoryV2.name.tr (yeni format)
                        else if (foundProduct.masterCategoryV2?.name) {
                            category = foundProduct.masterCategoryV2.name.tr || 
                                      foundProduct.masterCategoryV2.name.en;
                        }
                        
                        // Alt kategori bilgisini al
                        if (foundProduct.subCategory) {
                            if (typeof foundProduct.subCategory === 'string') {
                                subCategory = foundProduct.subCategory;
                            } else if (foundProduct.subCategory.name) {
                                subCategory = foundProduct.subCategory.name.tr || 
                                            foundProduct.subCategory.name.en;
                            }
                        } else if (foundProduct.subCategoryName) {
                            subCategory = foundProduct.subCategoryName;
                        } else if (foundProduct.product?.subCategory) {
                            if (typeof foundProduct.product.subCategory === 'string') {
                                subCategory = foundProduct.product.subCategory;
                            } else if (foundProduct.product.subCategory.name) {
                                subCategory = foundProduct.product.subCategory.name.tr || 
                                            foundProduct.product.subCategory.name.en;
                            }
                        }
                        
                        // allProducts array'indeki ürünü güncelle
                        if (category) {
                            const productIndex = this.allProducts.findIndex(p => p.id === productId);
                            if (productIndex !== -1) {
                                // Kategori bilgisini güncelle (sadece yoksa veya "Genel" ise)
                                if (!this.allProducts[productIndex].category || 
                                    this.allProducts[productIndex].category === 'Genel') {
                                    this.allProducts[productIndex].category = category;
                                }
                                
                                // Alt kategori bilgisini de ekle (varsa)
                                if (subCategory && !this.allProducts[productIndex].subCategory) {
                                    this.allProducts[productIndex].subCategory = subCategory;
                                }
                            }
                        }
                    }
                }
            }
            
            // 0 değeri de geçerli bir stok değeridir
            if (stock !== null && stock !== undefined) {
                const priceFields = this._extractPriceFieldsFromApiProduct(foundProduct);
                let { price, priceText, struckPrice, struckPriceText } = priceFields;
                
                if (foundProduct) {
                    
                    // Kategori bilgisini API'den al ve allProducts array'ini güncelle
                    if (productId && foundProduct) {
                        // Kategori bilgisini farklı formatlardan al
                        let category = null;
                        let subCategory = null;
                        
                        // 1. Öncelik: category.name.tr veya category.name.en (object formatı)
                        if (foundProduct.category) {
                            if (typeof foundProduct.category === 'string') {
                                category = foundProduct.category;
                            } else if (foundProduct.category.name) {
                                // name object ise tr veya en al
                                category = foundProduct.category.name.tr || 
                                          foundProduct.category.name.en || 
                                          foundProduct.category.name;
                            } else if (foundProduct.category.tr) {
                                category = foundProduct.category.tr;
                            } else if (foundProduct.category.en) {
                                category = foundProduct.category.en;
                            }
                        }
                        // 2. categoryName field'ı (string)
                        else if (foundProduct.categoryName) {
                            category = foundProduct.categoryName;
                        }
                        // 3. product.category (nested)
                        else if (foundProduct.product?.category) {
                            if (typeof foundProduct.product.category === 'string') {
                                category = foundProduct.product.category;
                            } else if (foundProduct.product.category.name) {
                                category = foundProduct.product.category.name.tr || 
                                          foundProduct.product.category.name.en;
                            }
                        }
                        // 4. masterCategoryV2.name.tr (yeni format)
                        else if (foundProduct.masterCategoryV2?.name) {
                            category = foundProduct.masterCategoryV2.name.tr || 
                                      foundProduct.masterCategoryV2.name.en;
                        }
                        
                        // Alt kategori bilgisini al
                        if (foundProduct.subCategory) {
                            if (typeof foundProduct.subCategory === 'string') {
                                subCategory = foundProduct.subCategory;
                            } else if (foundProduct.subCategory.name) {
                                subCategory = foundProduct.subCategory.name.tr || 
                                            foundProduct.subCategory.name.en;
                            }
                        } else if (foundProduct.subCategoryName) {
                            subCategory = foundProduct.subCategoryName;
                        } else if (foundProduct.product?.subCategory) {
                            if (typeof foundProduct.product.subCategory === 'string') {
                                subCategory = foundProduct.product.subCategory;
                            } else if (foundProduct.product.subCategory.name) {
                                subCategory = foundProduct.product.subCategory.name.tr || 
                                            foundProduct.product.subCategory.name.en;
                            }
                        }
                        
                        // allProducts array'indeki ürünü güncelle
                        if (category) {
                            const productIndex = this.allProducts.findIndex(p => p.id === productId);
                            if (productIndex !== -1) {
                                // Kategori bilgisini güncelle (sadece yoksa veya "Genel" ise)
                                if (!this.allProducts[productIndex].category || 
                                    this.allProducts[productIndex].category === 'Genel') {
                                    this.allProducts[productIndex].category = category;
                                }
                                
                                // Alt kategori bilgisini de ekle (varsa)
                                if (subCategory && !this.allProducts[productIndex].subCategory) {
                                    this.allProducts[productIndex].subCategory = subCategory;
                                }
                            }
                        }
                    }
                }

                const reservedStock = foundProduct ? this.extractReservedStockFromProductItem(foundProduct) : null;

                /**
                 * Stok güncelle / API yanıt özeti (fetchStockFromAPI):
                 * - stock: available | stock | quantity (öncelik sırasıyla)
                 * - price, priceText: ürün fiyatı
                 * - reservedStock: reserve | reservedStock | reserved | … veya
                 *   reservedForCorporateSales + reservedForDisposal + reservedForTransfer toplamı
                 */
                return {
                    stock: stock,
                    price: price,
                    priceText: priceText,
                    struckPrice,
                    struckPriceText,
                    reservedStock
                };
            }
            
            throw new Error('API yanıtında stok değeri bulunamadı');
            
        } catch (error) {
            throw error;
        }
    }

    // Barkod'dan product bul (products.json'dan)
    findProductByBarcode(barcode) {
        if (!barcode || !this.allProducts || this.allProducts.length === 0) {
            return null;
        }
        
        const barcodeStr = String(barcode).trim();
        
        // Önce userDataManager'dan bul
        if (window.userDataManager) {
            const products = window.userDataManager.getAllProducts(true) || [];
            for (const product of products) {
                if (product.barcodes && Array.isArray(product.barcodes)) {
                    for (const barcodeObj of product.barcodes) {
                        if (barcodeObj.code && String(barcodeObj.code).trim() === barcodeStr) {
                            return {
                                productId: product.productId || product.id,
                                name: product.name,
                                barcode: barcodeObj.code
                            };
                        }
                    }
                }
                // Direkt barcode field'ı varsa
                if (product.barcode && String(product.barcode).trim() === barcodeStr) {
                    return {
                        productId: product.productId || product.id,
                        name: product.name,
                        barcode: product.barcode
                    };
                }
            }
        }
        
        // Fallback: this.allProducts'tan bul
        for (const product of this.allProducts) {
            if (product.barcodes && Array.isArray(product.barcodes)) {
                for (const barcodeObj of product.barcodes) {
                    if (barcodeObj.code && String(barcodeObj.code).trim() === barcodeStr) {
                        return {
                            productId: product.productId || product.id,
                            name: product.name,
                            barcode: barcodeObj.code
                        };
                    }
                }
            }
            // Direkt barcode field'ı varsa
            if (product.barcode && String(product.barcode).trim() === barcodeStr) {
                return {
                    productId: product.productId || product.id,
                    name: product.name,
                    barcode: product.barcode
                };
            }
        }
        
        return null;
    }
    
    // İsimden product bul (products.json'dan)
    findProductByName(productName) {
        if (!productName || !this.allProducts || this.allProducts.length === 0) {
            return null;
        }
        
        const nameStr = String(productName).trim().toLowerCase();
        
        // Önce userDataManager'dan bul
        if (window.userDataManager) {
            const products = window.userDataManager.getAllProducts(true) || [];
            for (const product of products) {
                const productName = String(product.name || '').toLowerCase();
                if (productName.includes(nameStr) || nameStr.includes(productName)) {
                    return {
                        productId: product.productId || product.id,
                        name: product.name
                    };
                }
            }
        }
        
        // Fallback: this.allProducts'tan bul
        for (const product of this.allProducts) {
            const productName = String(product.name || '').toLowerCase();
            if (productName.includes(nameStr) || nameStr.includes(productName)) {
                return {
                    productId: product.productId || product.id,
                    name: product.name
                };
            }
        }
        
        return null;
    }

    calculateDifference(warehouseStock, systemStock) {
        if (warehouseStock === null || warehouseStock === undefined) {
            return { value: null, type: 'empty' };
        }
        if (systemStock === null || systemStock === undefined) {
            return { value: null, type: 'empty' };
        }
        
        const diff = Number(warehouseStock) - Number(systemStock);
        if (diff > 0) {
            return { value: diff, type: 'positive' };
        } else if (diff < 0) {
            return { value: Math.abs(diff), type: 'negative' };
        } else {
            return { value: 0, type: 'zero' };
        }
    }

    formatDateTime(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    renderTable() {
        // Desktop tablo modu pasif — yalnızca grid render (legacy kod korunur)
        if (this._desktopTableModeDisabled) {
            if (this.currentViewMode !== 'rapid') this.currentViewMode = 'rapid';
            this.renderRapidCountingMode();
            return;
        }

        // If grid mode is active, don't render table - render grid instead
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
            return;
        }

        const tableBody = document.getElementById('countingTableBody');
        const cardView = document.getElementById('countingCardView');
        const emptyState = document.getElementById('emptyState');
        
        const sortedProductIds = this.getOrderedProductIds();

        if (sortedProductIds.length === 0) {
            if (tableBody) tableBody.innerHTML = '';
            if (cardView) cardView.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.style.removeProperty('display');
                emptyState.style.removeProperty('height');
                emptyState.style.removeProperty('overflow');
            }
            // Update sort icons
            this.updateSortIcons();
            return;
        }

        if (emptyState) {
            emptyState.classList.add('hidden');
            emptyState.style.removeProperty('display');
            emptyState.style.removeProperty('height');
            emptyState.style.removeProperty('overflow');
        }

        // Sıra: yalnızca kayıtlı ekleme / içe aktarma sırası (sütun sıralaması yok)
        this.updateSortIcons();

        // Render desktop table
        if (tableBody) {
            tableBody.innerHTML = sortedProductIds.map(productId => {
                const data = this.countingData[productId];
                const product = this.productIndex.get(productId);
                if (!product) return '';

                const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
                const diffClass = `difference-${diff.type}`;
                const diffIcon = diff.type === 'positive' ? '↑' : diff.type === 'negative' ? '↓' : diff.type === 'zero' ? '=' : '';

                const diffBadgeClass = diff.type === 'positive' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                                      diff.type === 'negative' ? 'bg-rose-100 text-rose-700 border-rose-200' : 
                                      diff.type === 'zero' ? 'bg-gray-100 text-gray-700 border-gray-200' : 
                                      'bg-gray-50 text-gray-500 border-gray-200';

                return `
                    <tr class="product-row-modern hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200 border-b border-gray-100" data-product-id="${productId}">
                        <!-- Görsel -->
                        <td class="px-4 py-4">
                            <div class="relative">
                                <img src="${product.image || '../assets/logo.png'}" alt="${product.name}" class="w-16 h-16 object-cover rounded-xl shadow-sm border-2 border-white">
                                ${diff.value !== null && diff.value !== 0 ? 
                                    `<div class="absolute -top-1 -right-1 w-5 h-5 rounded-full ${diff.type === 'positive' ? 'bg-emerald-100' : 'bg-rose-100'} flex items-center justify-center">
                                        <span class="${diff.type === 'positive' ? 'text-emerald-700' : 'text-rose-700'} text-xs font-bold">${diffIcon}</span>
                                    </div>` : ''
                                }
                            </div>
                        </td>
                        
                        <!-- Ürün Adı -->
                        <td class="px-4 py-4">
                            <div class="space-y-2">
                                <div class="font-bold text-gray-900 text-sm leading-tight">${product.name || 'Bilinmeyen Ürün'}</div>
                                ${product.barcodes && product.barcodes.length > 0 ? 
                                    `<div class="flex flex-wrap gap-1.5">
                                        ${product.barcodes.slice(0, 2).map(b => 
                                            `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                                                </svg>
                                                ${b.code}
                                            </span>`
                                        ).join('')}
                                        ${product.barcodes.length > 2 ? 
                                            `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                +${product.barcodes.length - 2}
                                            </span>` : ''
                                        }
                                    </div>` : ''
                                }
                            </div>
                        </td>
                        
                        <!-- Depo Stoku -->
                        <td class="px-4 py-4">
                            <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5 border border-orange-100">
                                <div class="flex items-center space-x-1.5 mb-1.5">
                                    <svg class="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                    </svg>
                                    <span class="text-xs font-semibold text-orange-700 uppercase">Depo</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <button 
                                        type="button"
                                        class="warehouse-stock-decrease-btn flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white border-2 border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50 hover:border-orange-400 active:bg-orange-100 active:scale-95 transition-all duration-150 shadow-sm"
                                        data-product-id="${productId}"
                                        title="Azalt"
                                    >
                                        <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"/>
                                        </svg>
                                    </button>
                            <input 
                                type="number" 
                                        inputmode="numeric"
                                        pattern="[0-9]*"
                                        class="warehouse-stock-input flex-1 min-w-0 px-2 sm:px-3 py-2 bg-white border-2 border-orange-200 rounded-lg text-sm sm:text-base font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-400 transition-all text-center"
                                        min="0"
                                        step="1"
                                value="${data.warehouseStock !== null && data.warehouseStock !== undefined ? data.warehouseStock : ''}"
                                placeholder="—"
                                data-product-id="${productId}"
                            >
                                    <button 
                                        type="button"
                                        class="warehouse-stock-increase-btn flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white border-2 border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50 hover:border-orange-400 active:bg-orange-100 active:scale-95 transition-all duration-150 shadow-sm"
                                        data-product-id="${productId}"
                                        title="Artır"
                                    >
                                        <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </td>
                        
                        <!-- Sistem Stoku -->
                        <td class="px-4 py-4">
                            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-2.5 border border-blue-100">
                                <div class="flex items-center space-x-1.5 mb-1.5">
                                    <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span class="text-xs font-semibold text-blue-700 uppercase">Sistem</span>
                                </div>
                            ${data.systemStock !== null && data.systemStock !== undefined ? 
                                    `<div class="flex items-center justify-between">
                                        <span class="text-base font-bold text-gray-900">${data.systemStock}</span>
                                        ${data.warehouseStock !== null && data.warehouseStock !== undefined ? 
                                `<button 
                                                class="refresh-system-stock-btn p-1.5 bg-white hover:bg-blue-100 text-blue-600 rounded-lg transition-all shadow-sm hover:shadow"
                                                data-product-id="${productId}"
                                                data-barcode="${product.barcodes && product.barcodes.length > 0 ? product.barcodes[0].code : ''}"
                                                title="Sistem stokunu yenile"
                                            >
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                                </svg>
                                            </button>` : ''
                                        }
                                    </div>` :
                                    (data.apiFetchFailed ? 
                                        `<div class="flex items-center space-x-2 text-rose-600">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                            </svg>
                                            <span class="text-sm font-semibold">Bulamadım</span>
                                        </div>` :
                                        `<button 
                                            class="sync-single-product-btn w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2"
                                    data-product-id="${productId}"
                                    data-barcode="${product.barcodes && product.barcodes.length > 0 ? product.barcodes[0].code : ''}"
                                    title="Sistem stokunu getir"
                                >
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                    </svg>
                                    <span>Getir</span>
                                </button>`
                                    )
                            }
                            </div>
                        </td>
                        
                        <!-- Fark -->
                        <td class="px-4 py-4">
                            <div class="flex items-center justify-center">
                                <span class="px-3 py-1.5 rounded-lg text-sm font-bold border-2 ${diffBadgeClass}">
                                    ${diff.value !== null ? `${diffIcon} ${Math.abs(diff.value)}` : '-'}
                            </span>
                            </div>
                        </td>
                        
                        <!-- Tarih/Saat -->
                        <td class="px-4 py-4">
                            <div class="flex items-center space-x-1.5 text-sm text-gray-600">
                                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                                <span class="font-medium">${this.formatDateTime(data.lastUpdated)}</span>
                            </div>
                        </td>
                        
                        <!-- İşlemler -->
                        <td class="px-4 py-4">
                            <button 
                                class="delete-product-btn px-3 py-2 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 text-red-600 hover:text-red-700 border-2 border-red-200 hover:border-red-300 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1.5 shadow-sm hover:shadow"
                                data-product-id="${productId}"
                                title="Ürünü sil"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                                <span class="hidden lg:inline">Sil</span>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Render mobile cards
        if (cardView) {
            cardView.innerHTML = sortedProductIds.map(productId => {
                const data = this.countingData[productId];
                const product = this.productIndex.get(productId);
                if (!product) return '';

                const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
                const diffClass = `difference-${diff.type}`;
                const diffIcon = diff.type === 'positive' ? '↑' : diff.type === 'negative' ? '↓' : diff.type === 'zero' ? '=' : '';

                const diffBadgeClass = diff.type === 'positive' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                                      diff.type === 'negative' ? 'bg-rose-100 text-rose-700 border-rose-200' : 
                                      diff.type === 'zero' ? 'bg-gray-100 text-gray-700 border-gray-200' : 
                                      'bg-gray-50 text-gray-500 border-gray-200';

                return `
                    <div class="product-card-modern bg-white rounded-2xl shadow-md hover:shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 transform hover:-translate-y-1" data-product-id="${productId}">
                        <!-- Header with Image and Title -->
                        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border-b border-gray-100">
                            <div class="flex items-start space-x-4">
                                <div class="relative flex-shrink-0">
                                    <img src="${product.image || '../assets/logo.png'}" alt="${product.name}" class="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl shadow-sm border-2 border-white">
                                    ${diff.value !== null && diff.value !== 0 ? 
                                        `<div class="absolute -top-1 -right-1 w-6 h-6 rounded-full ${diff.type === 'positive' ? 'bg-emerald-100' : 'bg-rose-100'} flex items-center justify-center">
                                            <span class="${diff.type === 'positive' ? 'text-emerald-700' : 'text-rose-700'} text-xs font-bold">${diffIcon}</span>
                                        </div>` : ''
                                    }
                                </div>
                            <div class="flex-1 min-w-0">
                                    <h4 class="text-base sm:text-lg font-bold text-gray-900 leading-tight mb-1.5">${product.name || 'Bilinmeyen Ürün'}</h4>
                                    ${product.barcodes && product.barcodes.length > 0 ? 
                                        `<div class="flex flex-wrap gap-1.5 mt-2">
                                            ${product.barcodes.slice(0, 2).map(b => 
                                                `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                                                    </svg>
                                                    ${b.code}
                                                </span>`
                                            ).join('')}
                                            ${product.barcodes.length > 2 ? 
                                                `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                    +${product.barcodes.length - 2}
                                                </span>` : ''
                                            }
                                        </div>` : ''
                                    }
                                </div>
                            </div>
                        </div>
                        
                        <!-- Content Section -->
                        <div class="p-4 sm:p-5 space-y-4">
                            <!-- Stock Information Grid -->
                            <div class="grid grid-cols-2 gap-3 sm:gap-4">
                                <!-- Depo Stoku -->
                                <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2 sm:p-3 border border-orange-100">
                                    <div class="flex items-center space-x-1 sm:space-x-2 mb-1.5 sm:mb-2">
                                        <svg class="w-3 h-3 sm:w-4 sm:h-4 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                                        </svg>
                                        <span class="text-xs font-semibold text-orange-700 uppercase tracking-wide">Depo</span>
                                    </div>
                                    <div class="flex items-center gap-1 sm:gap-2">
                                        <button 
                                            type="button"
                                            class="warehouse-stock-decrease-btn flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center bg-white border border-orange-300 sm:border-2 rounded-md sm:rounded-lg text-orange-600 hover:bg-orange-50 hover:border-orange-400 active:bg-orange-100 active:scale-95 transition-all duration-150 shadow-sm"
                                            data-product-id="${productId}"
                                            title="Azalt"
                                        >
                                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"/>
                                            </svg>
                                        </button>
                                        <input 
                                            type="number" 
                                            inputmode="numeric"
                                            pattern="[0-9]*"
                                            class="warehouse-stock-input flex-1 min-w-[60px] px-1.5 sm:px-2 py-1.5 sm:py-2.5 bg-white border-2 border-orange-200 rounded-lg text-sm sm:text-base font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-400 transition-all text-center"
                                            min="0"
                                            step="1"
                                            value="${data.warehouseStock !== null && data.warehouseStock !== undefined ? data.warehouseStock : ''}"
                                            placeholder="—"
                                            data-product-id="${productId}"
                                        >
                                        <button 
                                            type="button"
                                            class="warehouse-stock-increase-btn flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center bg-white border border-orange-300 sm:border-2 rounded-md sm:rounded-lg text-orange-600 hover:bg-orange-50 hover:border-orange-400 active:bg-orange-100 active:scale-95 transition-all duration-150 shadow-sm"
                                            data-product-id="${productId}"
                                            title="Artır"
                                        >
                                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Sistem Stoku -->
                                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
                                    <div class="flex items-center space-x-2 mb-2">
                                        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <span class="text-xs font-semibold text-blue-700 uppercase tracking-wide">Sistem</span>
                                    </div>
                                        ${data.systemStock !== null && data.systemStock !== undefined ? 
                                        `<div class="flex items-center justify-between">
                                            <span class="text-lg font-bold text-gray-900">${data.systemStock}</span>
                                            ${data.warehouseStock !== null && data.warehouseStock !== undefined ? 
                                            `<button 
                                                    class="refresh-system-stock-btn p-1.5 bg-white hover:bg-blue-100 text-blue-600 rounded-lg transition-all shadow-sm hover:shadow"
                                                    data-product-id="${productId}"
                                                    data-barcode="${product.barcodes && product.barcodes.length > 0 ? product.barcodes[0].code : ''}"
                                                    title="Sistem stokunu yenile"
                                                >
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                                    </svg>
                                                </button>` : ''
                                            }
                                        </div>` :
                                        (data.apiFetchFailed ? 
                                            `<div class="flex items-center space-x-2 text-rose-600">
                                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                                </svg>
                                                <span class="text-sm font-semibold">Bulamadım</span>
                                            </div>` :
                                            `<button 
                                                class="sync-single-product-btn w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2"
                                                data-product-id="${productId}"
                                                data-barcode="${product.barcodes && product.barcodes.length > 0 ? product.barcodes[0].code : ''}"
                                                title="Sistem stokunu getir"
                                            >
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                                </svg>
                                                <span>Getir</span>
                                            </button>`
                                        )
                                        }
                                    </div>
                            </div>
                            
                            <!-- Difference Badge and Date -->
                            <div class="flex items-center justify-between pt-3 border-t border-gray-100">
                                <div class="flex items-center space-x-2">
                                    <span class="text-xs font-medium text-gray-500 uppercase">Fark:</span>
                                    <span class="px-3 py-1.5 rounded-lg text-sm font-bold border-2 ${diffBadgeClass}">
                                        ${diff.value !== null ? `${diffIcon} ${Math.abs(diff.value)}` : '-'}
                                        </span>
                                    </div>
                                <div class="flex items-center space-x-1.5 text-xs text-gray-500">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                    </svg>
                                    <span class="font-medium">${this.formatDateTime(data.lastUpdated)}</span>
                                </div>
                                    </div>
                                </div>
                                
                        <!-- Footer with Delete Button -->
                        <div class="px-4 sm:px-5 pb-4 sm:pb-5">
                                <button 
                                class="delete-product-btn w-full px-4 py-2.5 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 text-red-600 hover:text-red-700 border-2 border-red-200 hover:border-red-300 rounded-xl text-sm font-semibold transition-all flex items-center justify-center space-x-2 shadow-sm hover:shadow"
                                    data-product-id="${productId}"
                                >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                                <span>Ürünü Sil</span>
                                </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Event listeners tek seferlik delegation ile kurulur — her render'da yeniden ekleme gerekmez
        
        // Render rapid counting mode if active
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
        }

        this.updateActiveTableActivityLine();
    }

    /** Rapid kart için durum anahtarı — değişim tespitinde kullanılır */
    _getRapidCardStateKey(data) {
        const hasWarehouse = data.warehouseStock !== null && data.warehouseStock !== undefined;
        const hasSystem = data.systemStock !== null && data.systemStock !== undefined;
        if (!hasWarehouse && !hasSystem) return 'blue';
        if (hasWarehouse && hasSystem) {
            const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
            return diff.type; // 'positive' | 'negative' | 'zero'
        }
        return 'orange';
    }

    /** Rapid kart sağ üst rozet sınıfı (fazla/eksik soft arka plan) */
    _getRapidStatusIconWrapClass(data) {
        const hasWarehouse = data.warehouseStock !== null && data.warehouseStock !== undefined;
        const hasSystem = data.systemStock !== null && data.systemStock !== undefined;
        let iconWrapClass = 'product-status-icon';
        if (hasWarehouse && hasSystem) {
            const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
            if (diff.type === 'positive') iconWrapClass += ' product-status-icon--positive';
            else if (diff.type === 'negative') iconWrapClass += ' product-status-icon--negative';
            else if (diff.type === 'zero') iconWrapClass += ' product-status-icon--zero';
        }
        return iconWrapClass;
    }

    /** Tek bir rapid kart için innerHTML string'i */
    _buildRapidCardInner(product, data) {
        const isCounted = data.warehouseStock !== null && data.warehouseStock !== undefined;
        const hasWarehouse = isCounted;
        const hasSystem = data.systemStock !== null && data.systemStock !== undefined;

        const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
        let stockIndicator = '';
        let statusIcon = '';
        let iconWrapClass = this._getRapidStatusIconWrapClass(data);

        if (hasWarehouse && hasSystem) {
            if (diff.type === 'positive') {
                stockIndicator = '<div class="stock-indicator bg-emerald-400"></div>';
                statusIcon = '<svg class="w-3 h-3 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7"/></svg>';
            } else if (diff.type === 'negative') {
                stockIndicator = '<div class="stock-indicator bg-rose-400"></div>';
                statusIcon = '<svg class="w-3 h-3 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"/></svg>';
            } else {
                stockIndicator = '<div class="stock-indicator bg-gray-300"></div>';
                statusIcon = '<svg class="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 9h14M5 15h14"/></svg>';
            }
        } else if (hasSystem && !hasWarehouse) {
            stockIndicator = '<div class="stock-indicator bg-orange-400"></div>';
            statusIcon = '<div class="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center shadow-sm"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l2 2m6-2a8 8 0 11-16 0 8 8 0 0116 0z"/></svg></div>';
        } else if (hasWarehouse && !hasSystem) {
            stockIndicator = '<div class="stock-indicator bg-orange-400"></div>';
            statusIcon = '<div class="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center shadow-sm"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></div>';
        } else {
            statusIcon = '<div class="w-4 h-4 border-[3px] border-blue-600 bg-white rounded-full flex items-center justify-center shadow-sm"></div>';
        }

        const productName = product.name || 'Ürün';
        const productImage = product.image || '../assets/logo.png';

        return `<div class="${iconWrapClass}">${statusIcon}</div>${stockIndicator}<div class="flex-1 flex flex-col p-1 sm:p-1.5 overflow-hidden"><div class="flex-1 flex items-center justify-center mb-0.5 sm:mb-1 min-h-0 overflow-hidden"><img src="${productImage}" alt="${product.name || ''}" class="max-w-full max-h-full w-auto h-auto object-contain" onerror="this.src='../assets/logo.png'"></div><div class="text-center flex-shrink-0 px-0.5"><p class="text-[9px] sm:text-[10px] font-semibold text-gray-900 line-clamp-1 leading-tight truncate">${productName}</p></div></div>`;
    }

    renderRapidCountingMode() {
        const gridContainer = document.getElementById('rapidCountingGridContainer');
        if (!gridContainer) return;

        const sortedProductIds = this.getDisplayOrderedProductIds();

        if (sortedProductIds.length === 0) {
            const q = (this._tableProductSearchQuery || '').trim();
            const emptyMsg =
                q.length >= 2
                    ? 'Arama ile eşleşen ürün yok'
                    : 'Henüz ürün eklenmedi';
            gridContainer.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500">${emptyMsg}</div>`;
            this._rapidRenderedIds = [];
            this._rapidRenderedStates.clear();
            return;
        }

        const newIds = new Set(sortedProductIds);
        const prevIds = new Set(this._rapidRenderedIds);

        // Silinen ürünlerin kartlarını DOM'dan kaldır
        for (const oldId of prevIds) {
            if (!newIds.has(oldId)) {
                const el = gridContainer.querySelector(`[data-product-id="${CSS.escape(oldId)}"]`);
                if (el) el.remove();
                this._rapidRenderedStates.delete(oldId);
            }
        }

        // Yeni / değişen kartları işle
        const newElements = [];
        for (const productId of sortedProductIds) {
            const data = this.countingData[productId];
            const product = this.productIndex.get(productId);
            if (!product) continue;

            const stateKey = this._getRapidCardStateKey(data);
            const cardClass = (data.warehouseStock !== null && data.warehouseStock !== undefined) ? 'counted' : 'not-counted';
            const existing = prevIds.has(productId)
                ? gridContainer.querySelector(`[data-product-id="${CSS.escape(productId)}"]`)
                : null;

            if (existing) {
                // Sadece durum değiştiyse güncelle
                if (this._rapidRenderedStates.get(productId) !== stateKey) {
                    existing.innerHTML = this._buildRapidCardInner(product, data);
                    existing.dataset.rapidState = stateKey;
                    existing.className = `rapid-product-card ${cardClass}`;
                    this._rapidRenderedStates.set(productId, stateKey);
                } else {
                    const iconEl = existing.querySelector('.product-status-icon');
                    const expectedClass = this._getRapidStatusIconWrapClass(data);
                    if (iconEl && iconEl.className !== expectedClass) {
                        existing.innerHTML = this._buildRapidCardInner(product, data);
                    }
                }
            } else {
                const div = document.createElement('div');
                div.className = `rapid-product-card ${cardClass}`;
                div.dataset.rapidState = stateKey;
                div.dataset.productId = productId;
                div.innerHTML = this._buildRapidCardInner(product, data);
                newElements.push(div);
                this._rapidRenderedStates.set(productId, stateKey);
            }
        }

        // Yeni kartları ekle
        if (newElements.length > 0) {
            const frag = document.createDocumentFragment();
            newElements.forEach(el => frag.appendChild(el));
            gridContainer.appendChild(frag);
        }

        // Sıra değişikliği kontrolü ve düzeltme
        const children = Array.from(gridContainer.children);
        let needsReorder = false;
        for (let i = 0; i < sortedProductIds.length; i++) {
            if (children[i]?.dataset?.productId !== sortedProductIds[i]) {
                needsReorder = true;
                break;
            }
        }
        if (needsReorder) {
            for (let i = 0; i < sortedProductIds.length; i++) {
                const el = gridContainer.querySelector(`[data-product-id="${CSS.escape(sortedProductIds[i])}"]`);
                if (el && gridContainer.children[i] !== el) {
                    gridContainer.insertBefore(el, gridContainer.children[i] || null);
                }
            }
        }

        this._rapidRenderedIds = [...sortedProductIds];
        // Click delegation rapidGrid üzerinde kurulur — burada listener ekleme
    }

    /**
     * Sayım tamamlanmamış mı?
     * Depo stoku girilmemiş VEYA sistem stoku henüz alınmamışsa ürün tamamlanmamış sayılır.
     */
    isProductCountingIncomplete(data) {
        const d = data || {};
        const noWarehouse = d.warehouseStock === null || d.warehouseStock === undefined;
        const noSystem = d.systemStock === null || d.systemStock === undefined;
        return noWarehouse || noSystem;
    }

    /**
     * Listedeki bir sonraki ürünü döner.
     * Önce tamamlanmamış ürünleri arar (depo yok veya sistem stoku yok);
     * hepsi tamamlanmışsa sıradaki herhangi ürüne gider.
     */
    findNextUncountedProduct(currentProductId) {
        const productIds = this.getDisplayOrderedProductIds();
        const currentIndex = productIds.indexOf(currentProductId);
        if (currentIndex === -1) return null;
        if (productIds.length <= 1) return null;

        // 1. Önce tamamlanmamış ürünleri dene
        for (let i = currentIndex + 1; i < productIds.length; i++) {
            if (this.isProductCountingIncomplete(this.countingData[productIds[i]])) return productIds[i];
        }
        for (let i = 0; i < currentIndex; i++) {
            if (this.isProductCountingIncomplete(this.countingData[productIds[i]])) return productIds[i];
        }

        // 2. Hepsi tamamlanmışsa — sıradaki ürüne git (listenin sonunda sarma)
        return productIds[(currentIndex + 1) % productIds.length];
    }

    /**
     * Listedeki bir önceki ürünü döner.
     * Önce tamamlanmamış ürünleri arar; hepsi tamamlanmışsa bir önceki herhangi ürüne gider.
     */
    findPreviousUncountedProduct(currentProductId) {
        const productIds = this.getDisplayOrderedProductIds();
        const currentIndex = productIds.indexOf(currentProductId);
        if (currentIndex === -1) return null;
        if (productIds.length <= 1) return null;

        // 1. Önce tamamlanmamış ürünleri dene
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (this.isProductCountingIncomplete(this.countingData[productIds[i]])) return productIds[i];
        }
        for (let i = productIds.length - 1; i > currentIndex; i--) {
            if (this.isProductCountingIncomplete(this.countingData[productIds[i]])) return productIds[i];
        }

        // 2. Hepsi tamamlanmışsa — bir önceki ürüne git (listenin başında sarma)
        return productIds[(currentIndex - 1 + productIds.length) % productIds.length];
    }

    isCameraScanAndCountMode() {
        return !!this.cameraScanAndCountMode;
    }

    isCameraTableOnlyScanMode() {
        return !!this.cameraTableOnlyScanMode;
    }

    syncCameraScanModeToggles() {
        const countToggle = document.getElementById('cameraScanAndCountToggle');
        const tableOnlyToggle = document.getElementById('cameraTableOnlyScanToggle');
        if (countToggle) countToggle.checked = !!this.cameraScanAndCountMode;
        if (tableOnlyToggle) tableOnlyToggle.checked = !!this.cameraTableOnlyScanMode;
    }

    setCameraScanAndCountMode(enabled) {
        this.cameraScanAndCountMode = !!enabled;
        if (!this.cameraScanAndCountMode && this.cameraTableOnlyScanMode) {
            this.cameraTableOnlyScanMode = false;
        }
        this.syncCameraScanModeToggles();
    }

    setCameraTableOnlyScanMode(enabled) {
        this.cameraTableOnlyScanMode = !!enabled;
        if (this.cameraTableOnlyScanMode) {
            this.cameraScanAndCountMode = true;
        }
        this.syncCameraScanModeToggles();
    }

    /** Tablo İçi Sayım: barkod yalnızca aktif tabloda varsa sayım panelini açar */
    handleCameraTableOnlyScan(code, result = null) {
        const bs = window.barcodeScanner;
        const product = this.findProductByBarcode(code);

        const toastOnly = (message, type = 'warning') => {
            this.showToast(message, type, 2500);
        };

        if (!product || !product.productId) {
            toastOnly(`Barkod "${code}" için ürün bulunamadı`, 'error');
            return;
        }

        if (!this.countingData[product.productId]) {
            toastOnly('Bu ürün bu tabloda yok', 'warning');
            return;
        }

        if (bs) {
            bs.showSuccessFlash();
            if (result) bs.showBarcodeFrame(result);
            bs.playSuccessSound();
        }
        this.onCameraScannedProductOpenForCount(product.productId);
    }

    isSeriOkumaVeSayarakIlerle() {
        return !!(window.barcodeScanner && window.barcodeScanner.continuousMode && this.cameraScanAndCountMode);
    }

    updateCorrectEntryButtonState() {
        const btn = document.getElementById('countingCorrectEntryBtn');
        if (!btn || !this.countingBottomSheetFromCameraSeriSayar || !this.currentCountingProduct) return;

        const pid = this.currentCountingProduct;
        const data = this.countingData[pid] || {};
        const depoInput = document.getElementById('countingDepoInput');
        const trimmed = depoInput?.value?.trim() ?? '';
        const hasWarehouseFromInput = trimmed !== '';
        const hasWarehouseFromData =
            data.warehouseStock !== null && data.warehouseStock !== undefined;
        const warehouseOk = hasWarehouseFromInput || hasWarehouseFromData;

        const systemOk = data.systemStock !== null && data.systemStock !== undefined;

        btn.disabled = !(warehouseOk && systemOk);
    }

    updateCountingBottomSheetFooterMode() {
        const navDefault = document.getElementById('countingBottomSheetNavDefault');
        const navCorrect = document.getElementById('countingBottomSheetNavCorrectEntry');
        if (!navDefault || !navCorrect) return;

        if (this.countingBottomSheetFromCameraSeriSayar) {
            navDefault.classList.add('hidden');
            navCorrect.classList.remove('hidden');
            this.updateCorrectEntryButtonState();
        } else {
            navDefault.classList.remove('hidden');
            navCorrect.classList.add('hidden');
        }
    }

    getExpectedBarcodeStringsForProduct(product) {
        const set = new Set();
        if (!product) return set;
        if (product.barcodes && Array.isArray(product.barcodes)) {
            for (const b of product.barcodes) {
                if (b && b.code != null) {
                    const s = String(b.code).trim();
                    if (s) set.add(s);
                }
            }
        }
        if (product.barcode != null) {
            const s = String(product.barcode).trim();
            if (s) set.add(s);
        }
        return set;
    }

    updateVerifyBarcodeButtonState() {
        const btn = document.getElementById('countingVerifyBarcodeBtn');
        if (!btn) return;
        if (!this.currentCountingProduct) {
            btn.disabled = true;
            return;
        }
        const product = this.productIndex.get(this.currentCountingProduct);
        const hasCodes = product && this.getExpectedBarcodeStringsForProduct(product).size > 0;
        btn.disabled = !hasCodes || this._barcodeVerifyInProgress;
    }

    async beginBarcodeVerificationForCurrentProduct() {
        if (this._barcodeVerifyInProgress) return;
        if (!this.currentCountingProduct) {
            this.showToast('Önce bir ürün seçin', 'warning', 2500);
            return;
        }
        const product = this.productIndex.get(this.currentCountingProduct);
        if (!product) {
            this.showToast('Ürün bulunamadı', 'error', 3000);
            return;
        }
        const expected = this.getExpectedBarcodeStringsForProduct(product);
        if (expected.size === 0) {
            this.showToast('Bu ürün için kayıtlı barkod yok; doğrulama yapılamaz.', 'warning', 3500);
            return;
        }
        const bs = window.barcodeScanner;
        if (!bs || typeof bs.beginVerificationScan !== 'function') {
            this.pushAuditEntry(`Barkod doğrula · Durum: kamera modülü yok`, {
                cat: 'verify',
                productId: product.id,
                productName: product.name,
                productImage: product.image || '',
            });
            void this.saveCountingData();
            this.showToast('Kamera modülü yüklenemedi. Sayfayı yenileyin.', 'error', 4000);
            return;
        }

        this._barcodeVerifyInProgress = true;
        this.updateVerifyBarcodeButtonState();

        const restoreSeriPause = !!(
            this.countingBottomSheetFromCameraSeriSayar && this.isSeriOkumaVeSayarakIlerle()
        );

        const cleanup = () => {
            this._barcodeVerifyInProgress = false;
            this.updateVerifyBarcodeButtonState();
        };

        const onRead = (code) => {
            const norm = String(code).trim();
            const match = expected.has(norm);
            const scanned = norm || '—';
            const verifyMeta = {
                cat: 'verify',
                productId: product.id,
                productName: product.name,
                productImage: product.image || '',
            };
            if (match) {
                this.pushAuditEntry(
                    `Barkod doğrula · Okutulan barkod: ${scanned} · Sonuç: eşleşti`,
                    verifyMeta
                );
                this.showToast('Eşleşiyor: Okutulan barkod bu ürüne ait.', 'success', 3500);
                if (typeof bs.playVerificationMatchSound === 'function') {
                    bs.playVerificationMatchSound();
                } else if (typeof bs.playSuccessSound === 'function') {
                    bs.playSuccessSound();
                }
            } else {
                this.pushAuditEntry(
                    `Barkod doğrula · Okutulan barkod: ${scanned} · Sonuç: eşleşmedi`,
                    verifyMeta
                );
                this.showToast(
                    'Eşleşmiyor: Okutulan barkod bu ürünün kayıtlı barkodlarıyla uyuşmuyor.',
                    'error',
                    4500
                );
                if (typeof bs.playVerificationMismatchSound === 'function') {
                    bs.playVerificationMismatchSound();
                } else if (typeof bs.playWarningSound === 'function') {
                    bs.playWarningSound();
                }
            }
            void this.saveCountingData();
            if (restoreSeriPause && typeof bs.pauseScanningKeepStream === 'function') {
                bs.pauseScanningKeepStream();
            } else {
                bs.stopScanning();
            }
            cleanup();
        };

        bs.beginVerificationScan(onRead, { mini: true });

        try {
            if (typeof bs.hasActiveCameraSession === 'function' && bs.hasActiveCameraSession()) {
                await bs.resumeScanningAfterOverlay();
            } else {
                await bs.startScanning({ mini: true });
            }
        } catch (e) {
            console.error(e);
            if (typeof bs.clearVerificationScan === 'function') bs.clearVerificationScan();
            this.pushAuditEntry(`Barkod doğrula · Durum: kamera açılamadı`, {
                cat: 'verify',
                productId: product.id,
                productName: product.name,
                productImage: product.image || '',
            });
            void this.saveCountingData();
            this.showToast('Kamera açılamadı', 'error', 4000);
            cleanup();
        }
    }

    lockCountingSheetScroll() {
        if (this._countingSheetBodyLocked) return;
        this._countingSheetBodyLocked = true;
        this._countingSheetScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        document.documentElement.classList.add('bottom-sheet-open');
        document.body.classList.add('bottom-sheet-open');
        // CSS (.bottom-sheet-open) overflow:hidden verir — position:fixed / scrollTo kullanma (sayfa zıplaması).
    }

    unlockCountingSheetScroll() {
        if (!this._countingSheetBodyLocked) return;
        this._countingSheetBodyLocked = false;
        document.documentElement.classList.remove('bottom-sheet-open');
        document.body.classList.remove('bottom-sheet-open');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
    }

    // Kamera ile barkod okutulduktan sonra sayım ekranını aç (sayarak ilerle modu)
    onCameraScannedProductOpenForCount(productId) {
        const isSeriOkuma = window.barcodeScanner && window.barcodeScanner.continuousMode;
        const isSeriSayar = this.isSeriOkumaVeSayarakIlerle();

        if (isSeriSayar) {
            if (window.barcodeScanner && typeof window.barcodeScanner.pauseScanningKeepStream === 'function') {
                window.barcodeScanner.pauseScanningKeepStream();
            } else if (window.barcodeScanner) {
                window.barcodeScanner.stopScanning();
            }
        } else if (!isSeriOkuma) {
            const cameraScannerModal = document.getElementById('cameraScannerModal');
            if (cameraScannerModal) cameraScannerModal.classList.add('hidden');
            if (window.barcodeScanner) window.barcodeScanner.stopScanning();
        }

        this.openCountingBottomSheet(productId, { fromCameraSeriSayar: isSeriSayar });
    }

    openCountingBottomSheet(productId, options = {}) {
        if (this._isSheetStockFetchLocked() && productId !== this.currentCountingProduct) return;

        if (this.currentCountingProduct && this.currentCountingProduct !== productId) {
            this.flushDeferredStockAuditForProduct(this.currentCountingProduct);
        }

        const product = this.productIndex.get(productId);
        if (!product) return;

        this.closeProductTimelinePanel();
        this.closeProductDetailPanel();

        const data = this.countingData[productId] || {};
        this.currentCountingProduct = productId;
        this.countingBottomSheetFromCameraSeriSayar = !!options.fromCameraSeriSayar;

        // Update product info in modal
        const productImage = document.getElementById('countingProductImage');
        const productName = document.getElementById('countingProductName');
        const productBarcodesEl = document.getElementById('countingProductBarcodes');
        const depoInput = document.getElementById('countingDepoInput');
        const stockIndicator = document.getElementById('countingStockIndicator');

        if (productImage) {
            productImage.src = product.image || '../assets/logo.png';
            productImage.alt = product.name || '';
        }
        if (productName) {
            productName.textContent = product.name || 'Bilinmeyen Ürün';
        }
        if (productBarcodesEl) {
            productBarcodesEl.innerHTML = '';
            const codes = [
                ...new Set(
                    (product.barcodes || [])
                        .map((b) => (b && b.code != null ? String(b.code).trim() : ''))
                        .filter(Boolean)
                ),
            ];
            if (codes.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-[10px] text-gray-500 font-mono';
                empty.textContent = 'Barkod yok';
                productBarcodesEl.appendChild(empty);
            } else {
                codes.forEach((code) => {
                    const chip = document.createElement('span');
                    chip.setAttribute('role', 'listitem');
                    chip.className =
                        'inline-flex flex-shrink-0 snap-start items-center whitespace-nowrap rounded-full border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/90 px-2.5 py-1 text-[10px] font-mono tabular-nums tracking-tight text-slate-600 shadow-sm';
                    chip.textContent = code;
                    productBarcodesEl.appendChild(chip);
                });
            }
        }
        if (depoInput) {
            depoInput.value = data.warehouseStock !== null && data.warehouseStock !== undefined ? data.warehouseStock : '';
        }
        
        this.updateCountingBottomSheetSystemStockDisplay(data.systemStock, data.reservedStock);

        // Update stock indicator
        this.updateStockIndicator(productId, stockIndicator);

        // Update progress
        this.updateCountingProgress();

        if (!this.countingBottomSheetFromCameraSeriSayar) {
            // Update previous button state
            const prevBtn = document.getElementById('countingPrevBtn');
            if (prevBtn) {
                const prevProductId = this.findPreviousUncountedProduct(productId);
                if (prevProductId) {
                    prevBtn.disabled = false;
                    prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    prevBtn.disabled = true;
                    prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }

            // Update next button state
            const nextBtn = document.getElementById('countingNextBtn');
            if (nextBtn) {
                const nextProductId = this.findNextUncountedProduct(productId);
                if (nextProductId) {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        }

        this.updateCountingBottomSheetFooterMode();
        this.updateVerifyBarcodeButtonState();

        // Setup delete product button (re-setup in case modal was recreated)
        const deleteProductBtn = document.getElementById('countingDeleteProductBtn');
        if (deleteProductBtn) {
            // Remove existing event listeners by cloning the button
            const newDeleteBtn = deleteProductBtn.cloneNode(true);
            deleteProductBtn.parentNode.replaceChild(newDeleteBtn, deleteProductBtn);
            
            // Add event listener to new button
            newDeleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.currentCountingProduct) {
                    // Show delete confirmation modal
                    this.showDeleteConfirmModal(this.currentCountingProduct);
                }
            });
        }

        // Show modal with smooth animation
        const bottomSheet = document.getElementById('countingBottomSheet');
        if (bottomSheet) {
            // Remove hidden class first
            bottomSheet.classList.remove('hidden');
            
            // Force reflow to ensure the element is visible before animation
            void bottomSheet.offsetHeight;
            
            // Add show class after a tiny delay to trigger smooth animation
            requestAnimationFrame(() => {
                bottomSheet.classList.add('show');
                this.lockCountingSheetScroll();
            });
            
            // Focus on input after animation
            setTimeout(() => {
                if (depoInput) {
                    try {
                        depoInput.focus({ preventScroll: true });
                    } catch (e) {
                        depoInput.focus();
                    }
                }
            }, 450);
        }

        this._deferStockAuditWhileSheetOpen = true;
    }

    updateStockIndicator(productId, indicatorElement) {
        if (!indicatorElement) return;

        const data = this.countingData[productId] || {};
        const warehouseStock = data.warehouseStock !== null && data.warehouseStock !== undefined ? data.warehouseStock : null;
        const systemStock = data.systemStock !== null && data.systemStock !== undefined ? data.systemStock : null;

        if (warehouseStock === null || systemStock === null) {
            indicatorElement.innerHTML = '';
            return;
        }

        const diff = this.calculateDifference(warehouseStock, systemStock);
        
        if (diff.type === 'zero') {
            indicatorElement.innerHTML = `
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Eşit
                </span>
            `;
        } else if (diff.type === 'positive') {
            indicatorElement.innerHTML = `
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                    </svg>
                    +${diff.value} Fazla
                </span>
            `;
        } else if (diff.type === 'negative') {
            indicatorElement.innerHTML = `
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                    <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                    </svg>
                    -${diff.value} Eksik
                </span>
            `;
        } else {
            indicatorElement.innerHTML = '';
        }
    }

    async closeCountingBottomSheet() {
        if (this._isSheetStockFetchLocked()) return;

        this.closeProductTimelinePanel();
        this.closeProductDetailPanel();

        const resumeSeriSayarCamera = this.countingBottomSheetFromCameraSeriSayar;

        if (this._barcodeVerifyInProgress && window.barcodeScanner) {
            this._barcodeVerifyInProgress = false;
            if (typeof window.barcodeScanner.clearVerificationScan === 'function') {
                window.barcodeScanner.clearVerificationScan();
            }
            window.barcodeScanner.stopScanning();
        }

        // Clear any pending auto-save
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }
        
        // Save final value before closing
        if (this.currentCountingProduct) {
            const depoInput = document.getElementById('countingDepoInput');
            if (depoInput) {
                const value = depoInput.value.trim() === '' ? null : parseInt(depoInput.value);
                await this.updateProductStock(this.currentCountingProduct, value, null);

                // Remove from skipped if was skipped
                this.skippedProducts.delete(this.currentCountingProduct);

                // Update rapid mode if active
                if (this.currentViewMode === 'rapid') {
                    this.renderRapidCountingMode();
                }

                this.updateStatistics();
                this.updateCountingProgress();
            }
        }

        if (this.currentCountingProduct) {
            this.flushDeferredStockAuditForProduct(this.currentCountingProduct);
        }
        this._deferStockAuditWhileSheetOpen = false;
        this._stockAuditDirty = false;
        
        this.countingBottomSheetFromCameraSeriSayar = false;

        const bottomSheet = document.getElementById('countingBottomSheet');
        if (bottomSheet) {
            bottomSheet.classList.remove('show');
            this.unlockCountingSheetScroll();
            
            // Wait for animation to complete before hiding
            setTimeout(() => {
                bottomSheet.classList.add('hidden');
                if (resumeSeriSayarCamera && this.isSeriOkumaVeSayarakIlerle() && window.barcodeScanner) {
                    const bs = window.barcodeScanner;
                    if (typeof bs.resumeScanningAfterOverlay === 'function') {
                        void bs.resumeScanningAfterOverlay();
                    } else {
                        bs.startScanning();
                    }
                }
            }, 400);
        } else {
            this.unlockCountingSheetScroll();
            if (resumeSeriSayarCamera && this.isSeriOkumaVeSayarakIlerle() && window.barcodeScanner) {
                const bs = window.barcodeScanner;
                if (typeof bs.resumeScanningAfterOverlay === 'function') {
                    void bs.resumeScanningAfterOverlay();
                } else {
                    bs.startScanning();
                }
            }
        }
        
        this.currentCountingProduct = null;
    }

    updateCountingProgress() {
        const productIds = Object.keys(this.countingData).filter((k) => !this.isReservedCountingKey(k));
        const totalProducts = productIds.length;
        const countedProducts = productIds.filter((pid) => {
            const data = this.countingData[pid];
            return (
                data &&
                data.warehouseStock !== null &&
                data.warehouseStock !== undefined
            );
        }).length;
        const skippedCount = this.skippedProducts.size;

        const progressText = document.getElementById('countingProgressText');
        const progressBar = document.getElementById('countingProgressBar');

        if (progressText) {
            progressText.textContent = `İlerleme: ${countedProducts}/${totalProducts}${skippedCount > 0 ? ` (${skippedCount} Atlandı)` : ''}`;
        }

        if (progressBar && totalProducts > 0) {
            const percentage = (countedProducts / totalProducts) * 100;
            progressBar.style.width = `${percentage}%`;
        }
    }

    /**
     * Tablo/grid için tüm event listener'larını delegation ile kurar.
     * Render'dan bağımsız olarak yalnızca bir kez çağrılır.
     */
    setupTableEventListeners() {
        if (this._delegatedListenersSetup) return;
        this._delegatedListenersSetup = true;

        const ALLOWED_KEYS = new Set([
            'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'Home', 'End', 'Enter',
        ]);

        // --- Rapid grid: click delegation ---
        const rapidGrid = document.getElementById('rapidCountingGridContainer');
        if (rapidGrid) {
            rapidGrid.addEventListener('click', (e) => {
                const card = e.target.closest('.rapid-product-card');
                if (card) {
                    const productId = card.dataset.productId;
                    if (productId) this.openCountingBottomSheet(productId);
                }
            });
        }

        // --- Tablo/Kart: keydown delegation (sayı filtresi) ---
        document.addEventListener('keydown', (e) => {
            if (!e.target.classList.contains('warehouse-stock-input')) return;
            const isNumber = e.key >= '0' && e.key <= '9';
            const isCtrl = e.ctrlKey || e.metaKey;
            const isCopyPaste = isCtrl && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase());
            if (!isNumber && !ALLOWED_KEYS.has(e.key) && !isCopyPaste) {
                e.preventDefault();
            }
        }, true);

        // --- input delegation (sanitize) ---
        document.addEventListener('input', (e) => {
            if (!e.target.classList.contains('warehouse-stock-input')) return;
            const clean = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value !== clean) e.target.value = clean;
        }, true);

        // --- paste delegation ---
        document.addEventListener('paste', (e) => {
            if (!e.target.classList.contains('warehouse-stock-input')) return;
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            const nums = pasted.replace(/[^0-9]/g, '');
            if (nums) {
                e.target.value = nums;
                e.target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, true);

        // --- change delegation (warehouse-stock-input) ---
        document.addEventListener('change', (e) => {
            if (!e.target.classList.contains('warehouse-stock-input')) return;
            const productId = e.target.dataset.productId;
            let value = e.target.value.trim();
            if (value === '') {
                value = null;
                e.target.value = '';
            } else {
                const num = Math.max(0, Math.floor(Number(value)));
                value = num;
                e.target.value = String(value);
            }
            this.updateProductStock(productId, value, null).catch(err => console.error('updateProductStock:', err));
        }, true);

        // --- click delegation (buttons) ---
        document.addEventListener('click', async (e) => {
            // Artır
            const incrBtn = e.target.closest('.warehouse-stock-increase-btn');
            if (incrBtn) {
                e.preventDefault();
                e.stopPropagation();
                const productId = incrBtn.dataset.productId;
                const inp = document.querySelector(`.warehouse-stock-input[data-product-id="${CSS.escape(productId)}"]`);
                if (inp) {
                    inp.value = String((parseInt(inp.value) || 0) + 1);
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return;
            }

            // Azalt
            const decrBtn = e.target.closest('.warehouse-stock-decrease-btn');
            if (decrBtn) {
                e.preventDefault();
                e.stopPropagation();
                const productId = decrBtn.dataset.productId;
                const inp = document.querySelector(`.warehouse-stock-input[data-product-id="${CSS.escape(productId)}"]`);
                if (inp) {
                    const cur = inp.value === '' || isNaN(parseInt(inp.value)) ? 0 : parseInt(inp.value);
                    inp.value = String(Math.max(0, cur - 1));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return;
            }

            // Sil
            const delBtn = e.target.closest('.delete-product-btn');
            if (delBtn) {
                const productId = delBtn.closest('[data-product-id]')?.dataset?.productId;
                if (productId) this.deleteProduct(productId);
                return;
            }

            // Sistem stoku yenile
            const refreshBtn = e.target.closest('.refresh-system-stock-btn');
            if (refreshBtn) {
                e.stopPropagation();
                const productId = refreshBtn.dataset.productId;
                const barcode = refreshBtn.dataset.barcode;
                if (!barcode) { this.showNotification('Bu ürün için barkod bulunamadı', 'error'); return; }
                const orig = refreshBtn.innerHTML;
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<div class="spinner" style="width:10px;height:10px;border:2px solid #f3f4f4;border-top:2px solid #6b7280;border-radius:50%;animation:spin 1s linear infinite;"></div>';
                try {
                    const result = await this.requestStockFromExtension(null, barcode, productId);
                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    const price = typeof result === 'object' && result !== null ? result?.price : null;
                    const priceText = typeof result === 'object' && result !== null ? result?.priceText : null;
                    const struckPrice = typeof result === 'object' && result !== null ? (result?.struckPrice ?? null) : null;
                    const struckPriceText = typeof result === 'object' && result !== null ? (result?.struckPriceText ?? null) : null;
                    const reserved = typeof result === 'object' && result !== null && 'reservedStock' in result ? result.reservedStock : undefined;
                    if (stock !== null && stock !== undefined) {
                        if (this.countingData[productId]) this.countingData[productId].apiFetchFailed = false;
                        await this.updateProductStock(productId, null, stock, price, priceText, reserved, struckPrice, struckPriceText);
                        this.showToast('Stok güncellendi', 'success', 3000);
                    } else {
                        if (this.countingData[productId]) { this.countingData[productId].apiFetchFailed = true; this.scheduleSave(200); this.renderTable(); }
                        this.showToast('Ürün stoku bulunamadı', 'info', 3000);
                    }
                } catch (err) {
                    console.error('Error refreshing system stock:', err);
                    if (this.countingData[productId]) { this.countingData[productId].apiFetchFailed = true; this.scheduleSave(200); this.renderTable(); }
                    this.showToast('Stok alınamadı: ' + (err.message || 'Bilinmeyen hata'), 'error', 4000);
                } finally { refreshBtn.disabled = false; refreshBtn.innerHTML = orig; }
                return;
            }

            // Tek ürün stok sync
            const syncBtn = e.target.closest('.sync-single-product-btn');
            if (syncBtn) {
                const productId = syncBtn.dataset.productId;
                const barcode = syncBtn.dataset.barcode;
                if (!barcode) { this.showNotification('Bu ürün için barkod bulunamadı', 'error'); return; }
                const orig = syncBtn.innerHTML;
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border:2px solid #f3f4f6;border-top:2px solid white;border-radius:50%;animation:spin 1s linear infinite;"></div>';
                try {
                    const result = await this.requestStockFromExtension(null, barcode, productId);
                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    const price = typeof result === 'object' && result !== null ? result?.price : null;
                    const priceText = typeof result === 'object' && result !== null ? result?.priceText : null;
                    const struckPrice = typeof result === 'object' && result !== null ? (result?.struckPrice ?? null) : null;
                    const struckPriceText = typeof result === 'object' && result !== null ? (result?.struckPriceText ?? null) : null;
                    const reserved = typeof result === 'object' && result !== null && 'reservedStock' in result ? result.reservedStock : undefined;
                    if (stock !== null && stock !== undefined) {
                        if (this.countingData[productId]) this.countingData[productId].apiFetchFailed = false;
                        await this.updateProductStock(productId, null, stock, price, priceText, reserved, struckPrice, struckPriceText);
                    } else {
                        if (this.countingData[productId]) { this.countingData[productId].apiFetchFailed = true; this.scheduleSave(200); this.renderTable(); }
                        this.showNotification('Ürün stoku bulunamadı', 'info');
                    }
                } catch (err) {
                    console.error('Error syncing single product:', err);
                    if (this.countingData[productId]) { this.countingData[productId].apiFetchFailed = true; this.scheduleSave(200); this.renderTable(); }
                    this.showNotification('Stok alınamadı: ' + (err.message || 'Bilinmeyen hata'), 'error');
                } finally { syncBtn.disabled = false; syncBtn.innerHTML = orig; }
                return;
            }
        }, false);
    }

    updateStatistics() {
        // _api_info ve _tables metadata'sını filtrele (sistem bilgisi, ürün değil)
        const productIds = Object.keys(this.countingData).filter((key) => !this.isReservedCountingKey(key));
        let positiveCount = 0;
        let negativeCount = 0;

        productIds.forEach(productId => {
            const data = this.countingData[productId];
            // data null veya undefined olabilir, kontrol et
            if (!data || typeof data !== 'object') {
                return;
            }
            
            const warehouseStock = data.warehouseStock;
            const systemStock = data.systemStock;
            
            // Her iki değer de null/undefined ise sayma
            if ((warehouseStock === null || warehouseStock === undefined) && 
                (systemStock === null || systemStock === undefined)) {
                return; // Bu ürünü sayma
            }
            
            // Eğer warehouseStock var ama systemStock yoksa, bu fazla ürün (positive)
            if ((warehouseStock !== null && warehouseStock !== undefined) && 
                (systemStock === null || systemStock === undefined)) {
                positiveCount++;
            }
            // Eğer systemStock var ama warehouseStock yoksa, bu eksik ürün (negative)
            else if ((systemStock !== null && systemStock !== undefined) && 
                     (warehouseStock === null || warehouseStock === undefined)) {
                negativeCount++;
            }
            // Her ikisi de varsa, farkı hesapla
            else if (warehouseStock !== null && warehouseStock !== undefined && 
                     systemStock !== null && systemStock !== undefined) {
                // Sayısal değerlere çevir
                const ws = Number(warehouseStock);
                const ss = Number(systemStock);
                
                // warehouseStock > systemStock ise fazla (positive)
                if (ws > ss) {
                    positiveCount++;
                }
                // warehouseStock < systemStock ise eksik (negative)
                else if (ws < ss) {
                    negativeCount++;
                }
                // Eşitse sayma (zero)
            }
        });

        const totalCountEl = document.getElementById('totalProductsCount');
        const positiveCountEl = document.getElementById('positiveDifferenceCount');
        const negativeCountEl = document.getElementById('negativeDifferenceCount');

        if (totalCountEl) totalCountEl.textContent = productIds.length;
        if (positiveCountEl) positiveCountEl.textContent = positiveCount;
        if (negativeCountEl) negativeCountEl.textContent = negativeCount;

        // Tablo chip renklerini güncel sayım durumuna göre yenile (debounced — performans)
        this._scheduleTableSelectorUpdate();
    }

    openProductSearchModal() {
        const modal = document.getElementById('productSearchModal');
        if (modal) {
            modal.classList.remove('hidden');
            const searchInput = document.getElementById('productSearchInput');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            this.searchProducts('');
        }
    }

    searchProducts(searchTerm) {
        const resultsContainer = document.getElementById('productSearchResults');
        if (!resultsContainer) return;

        // Use advanced search (same as manual input) - supports gram values, token-based search, etc.
        const results = this.advancedProductSearch(searchTerm, 50); // Limit to 50 results for modal

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="text-center text-gray-500 py-4">Ürün bulunamadı</p>';
            return;
        }

        resultsContainer.innerHTML = results.map(product => {
            // Check if product is already added
            const isAlreadyAdded = this.countingData[product.id] !== undefined;
            const buttonClass = isAlreadyAdded 
                ? 'px-3 py-1 bg-green-500 text-white text-xs rounded cursor-not-allowed' 
                : 'px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700';
            const buttonText = isAlreadyAdded ? 'Eklendi' : 'Ekle';
            const buttonDisabled = isAlreadyAdded ? 'disabled' : '';
            
            return `
            <div class="product-search-result p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer" data-product-id="${product.id}">
                <div class="flex items-center space-x-3">
                    <img src="${product.image || '../assets/logo.png'}" alt="${product.name}" class="w-12 h-12 object-cover rounded">
                    <div class="flex-1">
                        <h4 class="text-sm font-medium text-gray-900">${product.name || 'Bilinmeyen Ürün'}</h4>
                        ${product.barcodes && product.barcodes.length > 0 ? `<p class="text-xs text-gray-500">Barkod: ${product.barcodes[0].code}</p>` : ''}
                    </div>
                    <button class="add-from-search-btn ${buttonClass}" data-product-id="${product.id}" ${buttonDisabled}>
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
        }).join('');

        // Setup event listeners
        const addButtons = resultsContainer.querySelectorAll('.add-from-search-btn, .product-search-result');
        addButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                
                const productId = e.target.closest('[data-product-id]').dataset.productId;
                const product = this.productIndex.get(productId);
                if (product) {
                    // Check if product is already added
                    const isAlreadyAdded = this.countingData[productId] !== undefined;
                    
                    if (!isAlreadyAdded) {
                        void this.addProductToCounting(product).catch((err) =>
                            console.error('addProductToCounting:', err)
                        );
                        
                        // Find and update the button (could be clicked directly or via card)
                        // Try multiple ways to find the button
                        let button = e.target.closest('.add-from-search-btn');
                        if (!button) {
                            const resultCard = e.target.closest('.product-search-result');
                            if (resultCard) {
                                button = resultCard.querySelector('.add-from-search-btn');
                            }
                        }
                        // If still not found, search by productId
                        if (!button) {
                            button = resultsContainer.querySelector(`.add-from-search-btn[data-product-id="${productId}"]`);
                        }
                        
                        if (button) {
                            button.textContent = 'Eklendi';
                            button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                            button.classList.add('bg-green-500', 'cursor-not-allowed');
                            button.disabled = true;
                        }
                    }
                    // Modal kapanmıyor - kullanıcı devam edebilir
                }
            });
        });
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }
    
    // Show manual input search results (panel açık kalır; eklenenler tıklanınca çıkar)
    showManualInputResults(query) {
        const resultsContainer = document.getElementById('manualInputResults');
        if (!resultsContainer) return;
        
        const results = this.advancedProductSearch(query, 20);
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="p-3 text-sm text-gray-500">Ürün bulunamadı</div>';
            resultsContainer.classList.remove('hidden');
            return;
        }
        
        resultsContainer.innerHTML = results.map(product => {
            const isAlreadyAdded = this.countingData[product.id] !== undefined;
            return `
                <div class="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 transition-colors ${isAlreadyAdded ? 'bg-green-50 hover:bg-green-100' : ''}" 
                     data-product-id="${product.id}"
                     onclick="window.countingSystem.addProductFromManualInput('${product.id}')">
                    <div class="flex items-center space-x-3">
                        <img src="${product.image || '../assets/logo.png'}" alt="${product.name}" class="w-10 h-10 object-cover rounded flex-shrink-0">
                        <div class="flex-1 min-w-0">
                            <h4 class="text-sm font-medium text-gray-900 truncate">${product.name || 'Bilinmeyen Ürün'}</h4>
                            ${product.barcodes && product.barcodes.length > 0 ? 
                                `<p class="text-xs text-gray-500 truncate">${product.barcodes.length > 1 ? 
                                    `Barkodlar: ${product.barcodes.map(b => b.code).join(', ')}` : 
                                    `Barkod: ${product.barcodes[0].code}`
                                }</p>` : ''
                            }
                            ${isAlreadyAdded 
                                ? '<span class="inline-flex items-center gap-1 mt-1 text-xs text-green-700 font-semibold">✓ Eklendi <span class="text-green-600 font-normal">(çıkarmak için tıkla)</span></span>' 
                                : '<span class="text-xs text-blue-600 font-medium mt-1 inline-block">Ekle</span>'
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        resultsContainer.classList.remove('hidden');
    }
    
    // Add product from manual input dropdown (toggle: ekliyse çıkar, değilse ekle; panel açık kalır)
    async addProductFromManualInput(productId) {
        const product = this.productIndex.get(productId);
        if (!product) return;

        const manualInput = document.getElementById('manualProductInput');
        const resultsContainer = document.getElementById('manualInputResults');
        const currentQuery = manualInput ? manualInput.value.trim() : '';

        if (this.countingData[productId]) {
            this.removeProductFromCountingSilent(productId);
        } else {
            await this.addProductToCounting(product);
        }

        // Paneli kapatma, input'u silme; aynı arama ile listeyi anlık güncelle (Eklendi durumları)
        if (currentQuery.length >= 2 && resultsContainer) {
            this.showManualInputResults(currentQuery);
        }
    }
    
    // Advanced product search (similar to product_search.html)
    advancedProductSearch(query, limit = 50) {
        if (!query || query.trim().length < 2) {
            return [];
        }
        
        const searchTerm = query.trim().toLowerCase();
        const tokens = this.tokenizeQuery(searchTerm);
        
        if (tokens.length === 0) {
            return [];
        }
        
        const results = [];
        const maxResults = limit;
        
        for (const product of this.allProducts) {
            if (results.length >= maxResults) break;
            
            let found = false;
            
            // Check barcodes: önce tam eşleşme, yoksa kısmi (ilk/son 4 hane vb. ile arama)
            if (product.barcodes && product.barcodes.length > 0) {
                for (const barcode of product.barcodes) {
                    if (!barcode.code) continue;
                    const codeLower = barcode.code.toLowerCase();
                    if (codeLower === searchTerm) {
                        found = true;
                        break;
                    }
                    // Kısmi barkod: yazılan kısım barkodun içinde geçiyorsa eşleşir (ilk 4, son 4 hane vb.)
                    if (codeLower.includes(searchTerm)) {
                        found = true;
                        break;
                    }
                }
            }
            
            if (found) {
                results.push(product);
                continue;
            }
            
            // Check product name (token-based)
            if (product.name) {
                const nameMatch = this.containsAllTokens(product.name, tokens);
                if (nameMatch) {
                    found = true;
                }
            }
            
            // Check for gram values (e.g., "160g")
            if (!found && product.name) {
                const gramMatch = /(\d+)\s*g/i.exec(product.name);
                if (gramMatch) {
                    const gramValue = gramMatch[1];
                    if (searchTerm.includes(gramValue + 'g') || searchTerm.includes(gramValue + ' g')) {
                        found = true;
                    }
                }
            }
            
            // Check brand
            if (!found && product.brand) {
                const brandMatch = this.containsAllTokens(product.brand, tokens);
                if (brandMatch) {
                    found = true;
                }
            }
            
            // Check category
            if (!found && product.category) {
                const categoryMatch = this.containsAllTokens(product.category, tokens);
                if (categoryMatch) {
                    found = true;
                }
            }
            
            if (found) {
                results.push(product);
            }
        }
        
        return results;
    }
    
    // Tokenize query (split into words)
    tokenizeQuery(query) {
        return query.toLowerCase()
            .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 0);
    }
    
    // Check if text contains all tokens
    containsAllTokens(text, tokens) {
        if (!text || !tokens || tokens.length === 0) return false;
        const textLower = text.toLowerCase();
        return tokens.every(token => textLower.includes(token));
    }
    
    // Show create table modal
    showCreateTableModal() {
        const createTableModal = document.getElementById('createTableModal');
        if (!createTableModal) return;
        this._setupCreateTableCombobox();
        this._resetCreateTableCombobox();
        this._updateCreateTablePresetRemaining();
        createTableModal.classList.remove('hidden');
    }
    
    // Show delete table modal
    showDeleteTableModal() {
        const tables = this.getTableList();
        if (tables.length <= 1) {
            this.showToast('En az bir tablo bulunmalıdır', 'error', 3000);
            return;
        }
        
        const deleteTableModal = document.getElementById('deleteTableModal');
        const deleteTableNameDisplay = document.getElementById('deleteTableNameDisplay');
        if (deleteTableModal && deleteTableNameDisplay) {
            deleteTableNameDisplay.textContent = this.formatTableDisplayName(this.currentTableName);
            deleteTableModal.classList.remove('hidden');
        }
    }
    
    // Setup scroll listener for toast positioning - Artık gerek yok, position: fixed kullanıyoruz
    setupToastScrollListener() {
        // position: fixed kullandığımız için scroll listener'a gerek yok
        // Toast container zaten sayfanın sağ üstünde sabit kalacak
    }
    
    // Reset all warehouse stocks
    resetWarehouseStocks() {
        this.showResetConfirmationModal('warehouse');
    }
    
    // Reset all system stocks
    resetSystemStocks() {
        this.showResetConfirmationModal('system');
    }
    
    // Show reset confirmation modal
    showResetConfirmationModal(type) {
        const isWarehouse = type === 'warehouse';
        const title = isWarehouse ? 'Depo Stoklarını Sıfırla' : 'Sistem Stoklarını Sıfırla';
        const message = isWarehouse 
            ? 'Tüm depo stoklarını sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.'
            : 'Tüm sistem stoklarını sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.';
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('resetStocksModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'resetStocksModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
                    <div class="p-6">
                        <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900 text-center mb-2" id="resetModalTitle">${title}</h3>
                        <p class="text-gray-600 text-center mb-6" id="resetModalMessage">${message}</p>
                        <div class="flex gap-3">
                            <button id="cancelResetBtn" class="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium">
                                İptal
                            </button>
                            <button id="confirmResetBtn" class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium">
                                Sıfırla
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Event listeners
            document.getElementById('cancelResetBtn').addEventListener('click', () => {
                modal.classList.add('hidden');
            });
            
            document.getElementById('confirmResetBtn').addEventListener('click', () => {
                const resetType = modal.dataset.resetType;
                modal.classList.add('hidden');
                if (resetType === 'warehouse') {
                    void this.executeResetWarehouseStocks();
                } else {
                    void this.executeResetSystemStocks();
                }
            });
            
            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
        
        // Update modal content
        document.getElementById('resetModalTitle').textContent = title;
        document.getElementById('resetModalMessage').textContent = message;
        modal.dataset.resetType = type;
        modal.classList.remove('hidden');
    }
    
    // Execute reset warehouse stocks
    async executeResetWarehouseStocks() {
        let resetCount = 0;
        const resetIds = [];
        const productIds = Object.keys(this.countingData).filter((id) => !this.isReservedCountingKey(id));
        
        const nowIso = new Date().toISOString();
        productIds.forEach(productId => {
            if (this.countingData[productId]) {
                const data = this.countingData[productId];
                if (data.warehouseStock !== null && data.warehouseStock !== undefined) {
                    this.countingData[productId].warehouseStock = null;
                    this.countingData[productId].lastUpdated = nowIso;
                    resetIds.push(productId);
                    resetCount++;
                }
            }
        });
        
        if (resetCount > 0) {
            const tn = this.currentTableName || '';
            this.touchTableLastActivity(tn, nowIso);
            this.pushAuditEntry(
                `📋 ${this.formatTableDisplayName(tn)} · Depo stoku sıfırlandı · ${resetCount} satır`,
                { cat: 'reset', tbl: tn }
            );
            await this.saveCountingData();
            if (this._countingItemsTableReady === true) {
                for (const productId of resetIds) {
                    await this.saveProductEntry(productId).catch(() => {});
                }
            }
            this.renderTable();
            this.updateStatistics();
            this.updateActiveTableActivityLine();
            this._scheduleTableSelectorUpdate();
            this.showToast(`${resetCount} ürünün depo stoku sıfırlandı`, 'success', 3000);
        } else {
            this.showToast('Sıfırlanacak depo stoku bulunamadı', 'info', 3000);
        }
    }
    
    // Execute reset system stocks
    async executeResetSystemStocks() {
        let resetCount = 0;
        const resetIds = [];
        const productIds = Object.keys(this.countingData).filter((id) => !this.isReservedCountingKey(id));
        
        const nowIso = new Date().toISOString();
        productIds.forEach(productId => {
            if (this.countingData[productId]) {
                const data = this.countingData[productId];
                if (data.systemStock !== null && data.systemStock !== undefined) {
                    this.countingData[productId].systemStock = null;
                    this.countingData[productId].apiFetchFailed = false; // Reset failed flag too
                    this.countingData[productId].lastUpdated = nowIso;
                    resetIds.push(productId);
                    resetCount++;
                }
            }
        });
        
        if (resetCount > 0) {
            const tn = this.currentTableName || '';
            this.touchTableLastActivity(tn, nowIso);
            this.pushAuditEntry(
                `📋 ${this.formatTableDisplayName(tn)} · Sistem stoku sıfırlandı · ${resetCount} satır`,
                { cat: 'reset', tbl: tn }
            );
            await this.saveCountingData();
            if (this._countingItemsTableReady === true) {
                for (const productId of resetIds) {
                    await this.saveProductEntry(productId).catch(() => {});
                }
            }
            this.renderTable();
            this.updateStatistics();
            this.updateActiveTableActivityLine();
            this._scheduleTableSelectorUpdate();
            this.showToast(`${resetCount} ürünün sistem stoku sıfırlandı`, 'success', 3000);
        } else {
            this.showToast('Sıfırlanacak sistem stoku bulunamadı', 'info', 3000);
        }
    }
    
    // Show rename table modal
    showRenameTableModal() {
        if (this.isDailyTableName(this.currentTableName)) {
            this.showToast('Günlük sayım tablolarının adı tarih olarak sabittir; yeniden adlandırılamaz.', 'info', 4000);
            return;
        }
        const renameTableModal = document.getElementById('renameTableModal');
        const currentTableNameDisplay = document.getElementById('currentTableNameDisplay');
        const renameTableNameInput = document.getElementById('renameTableNameInput');
        
        if (renameTableModal && currentTableNameDisplay && renameTableNameInput) {
            currentTableNameDisplay.textContent = this.formatTableDisplayName(this.currentTableName);
            renameTableNameInput.value = this.currentTableName;
            renameTableModal.classList.remove('hidden');
            // Focus on input
            setTimeout(() => {
                renameTableNameInput.focus();
                renameTableNameInput.select();
            }, 100);
        }
    }
    
    // Rename table
    async renameTable(oldName, newName) {
        if (this.isDailyTableName(oldName)) {
            throw new Error('Günlük sayım tabloları yeniden adlandırılamaz');
        }
        const trimmedNew = (newName || '').trim();
        if (!trimmedNew) {
            throw new Error('Tablo adı boş olamaz');
        }
        if (this.isDailyTableName(trimmedNew)) {
            throw new Error('Bu isim günlük sayım için ayrılmıştır');
        }
        const tables = this.getTableList();
        if (tables.some(t => t.name === trimmedNew)) {
            throw new Error('Bu isimde bir tablo zaten mevcut');
        }
        
        const fullData = this.cachedFullData;
        if (!fullData || !fullData._tables) {
            throw new Error('Tablo yapısı bulunamadı');
        }
        
        const currentTableData = fullData._tables[oldName];
        if (!currentTableData) {
            throw new Error('Tablo bulunamadı');
        }
        
        fullData._tables[trimmedNew] = currentTableData;
        delete fullData._tables[oldName];
        
        if (this.currentTableName === oldName) {
            this.currentTableName = trimmedNew;
            this._saveDeviceCurrentTable(trimmedNew);
            this.countingData = currentTableData;
        }
        this.cachedFullData = fullData;
        
        this.pushAuditEntry(
            `Tablo yeniden adlandırıldı · ${this.formatTableDisplayName(oldName)} → ${this.formatTableDisplayName(trimmedNew)}`,
            { cat: 'table', tbl: trimmedNew }
        );

        // Save changes
        await this.saveFullCountingData(fullData);
        
        // Update UI
        this.updateTableSelector();
        this.renderTable();
    }
    
    // Handle header sort click — devre dışı (ürün sırası yalnızca ekleme / içe aktarma sırasına bağlı)
    handleHeaderSort() {
        /* no-op */
    }
    
    // Update sort icons based on current sort state
    updateSortIcons() {
        document.querySelectorAll('.sortable-header').forEach(header => {
            const sortField = header.dataset.sortField;
            const isActive = this.currentSort && this.currentSort.field === sortField;
            
            // Remove all active classes
            header.classList.remove('active', 'asc', 'desc');
            
            // Hide all icons
            header.querySelectorAll('.sort-asc-icon, .sort-desc-icon').forEach(icon => {
                icon.style.display = 'none';
            });
            
            // Show appropriate icon if active
            if (isActive) {
                header.classList.add('active', this.currentSort.direction);
                if (this.currentSort.direction === 'asc') {
                    const ascIcon = header.querySelector('.sort-asc-icon');
                    if (ascIcon) ascIcon.style.display = 'block';
                } else {
                    const descIcon = header.querySelector('.sort-desc-icon');
                    if (descIcon) descIcon.style.display = 'block';
                }
            }
        });
    }
    
    // Update API status card
    async updateAPIStatusCard() {
        try {
            const apiStatusCard = document.getElementById('apiStatusCard');
            const apiStatusIcon = document.getElementById('apiStatusIcon');
            const apiStatusText = document.getElementById('apiStatusText');
            const apiWarehouseName = document.getElementById('apiWarehouseName');
            const apiExpiryTime = document.getElementById('apiExpiryTime');
            
            if (!apiStatusCard || !apiStatusIcon || !apiStatusText || !apiWarehouseName || !apiExpiryTime) {
                return;
            }
            
            let apiInfo = await this.fetchSupabaseApiInfo();
            const extensionApiInfo = await this.fetchExtensionApiInfo();
            
            // Supabase (manuel + önceki kayıt) + eklenti: en geç bitecek token kazanır
            const supabaseSnapshot = apiInfo && apiInfo.token ? { ...apiInfo } : null;
            const best = this.pickBestApiInfo([supabaseSnapshot, extensionApiInfo].filter(Boolean));
            if (best && best.token) {
                const mergedForSave = this.mergeApiInfoForSave(best, supabaseSnapshot || {});
                if (!this.cachedFullData) this.cachedFullData = { _tables: {} };
                this.cachedFullData._api_info = mergedForSave;
                if (this.apiInfoSignature(mergedForSave) !== this.apiInfoSignature(supabaseSnapshot)) {
                    await this.saveAPIInfoToSupabase(mergedForSave);
                }
                apiInfo = mergedForSave;
            } else {
                apiInfo = supabaseSnapshot;
            }
            
            // Update card based on API info
            if (apiInfo && apiInfo.token) {
                apiStatusCard.classList.remove('hidden');

                const expiryTime = this.getEffectiveExpiryMs(apiInfo);
                const now = Date.now();
                const timeRemaining = expiryTime ? expiryTime - now : null;

                const shouldCheckForNewToken =
                    timeRemaining !== null &&
                    (timeRemaining < 0 || timeRemaining < 5 * 60 * 1000) &&
                    (!this.lastTokenCheckTime || now - this.lastTokenCheckTime > 30000) &&
                    this.lastTokenExpiry !== expiryTime &&
                    !this.isTokenUpdateInProgress;

                const minutesRemaining = timeRemaining !== null ? Math.floor(timeRemaining / (1000 * 60)) : 0;
                const hoursRemaining = timeRemaining !== null ? Math.floor(minutesRemaining / 60) : 0;
                const daysRemaining = timeRemaining !== null ? Math.floor(hoursRemaining / 24) : 0;

                if (shouldCheckForNewToken) {
                    this.lastTokenCheckTime = now;
                    this.lastTokenExpiry = expiryTime;
                    this.isTokenUpdateInProgress = true;
                    try {
                        await this.checkAndSaveAPIInfoFromExtension();
                        setTimeout(() => {
                            this.isTokenUpdateInProgress = false;
                            this.updateAPIStatusCard();
                        }, 1000);
                    } catch (error) {
                        console.warn('⚠️ Token güncelleme hatası:', error);
                        this.isTokenUpdateInProgress = false;
                    }
                }

                if (timeRemaining === null || isNaN(timeRemaining)) {
                    apiStatusCard.className = 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                    apiStatusIcon.className = 'w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center';
                    apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
                    apiStatusText.textContent = 'Token bilgisi eksik';
                    if (apiInfo.warehouseId) {
                        const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                        apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                    } else {
                        apiWarehouseName.textContent = 'Depo bilgisi yok';
                    }
                    apiExpiryTime.innerHTML = '<span class="text-yellow-700">Token expiry bilgisi geçersiz format</span>';
                } else if (timeRemaining < 0) {
                    apiStatusCard.className = 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                    apiStatusIcon.className = 'w-10 h-10 rounded-full bg-red-100 flex items-center justify-center';
                    apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    apiStatusText.textContent = 'Token süresi dolmuş';
                    if (apiInfo.warehouseId) {
                        const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                        apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                    } else {
                        apiWarehouseName.textContent = 'Depo bilgisi yok';
                    }
                    apiExpiryTime.innerHTML = '<span class="text-red-600 font-medium">Lütfen Getir franchise sayfasını yenileyin</span>';
                } else if (timeRemaining < 5 * 60 * 1000) {
                    apiStatusCard.className = 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                    apiStatusIcon.className = 'w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center';
                    apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
                    apiStatusText.textContent = 'Token yakında dolacak';
                    if (apiInfo.warehouseId) {
                        const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                        apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                    } else {
                        apiWarehouseName.textContent = 'Depo bilgisi yok';
                    }
                    apiExpiryTime.innerHTML = `<span class="text-yellow-700 font-medium">${minutesRemaining} dakika içinde Getir franchise sayfasını yenileyin</span>`;
                } else {
                    apiStatusCard.className = 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                    apiStatusIcon.className = 'w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center';
                    apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    apiStatusText.textContent = 'API güncel ve aktif';
                    if (apiInfo.warehouseId) {
                        const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                        apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                    } else {
                        apiWarehouseName.textContent = 'Depo bilgisi yok';
                    }
                    let timeText = '';
                    if (daysRemaining > 0) {
                        timeText = `${daysRemaining} gün ${hoursRemaining % 24} saat`;
                    } else if (hoursRemaining > 0) {
                        timeText = `${hoursRemaining} saat ${minutesRemaining % 60} dakika`;
                    } else {
                        timeText = `${minutesRemaining} dakika`;
                    }
                    const expiryDate = new Date(expiryTime).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    });
                    apiExpiryTime.innerHTML = `
                            <span class="text-gray-600">Kalan süre: <span class="font-medium text-blue-700">${timeText}</span></span><br>
                            <span class="text-gray-500 text-xs mt-1">Son kullanma: ${expiryDate}</span>
                        `;
                }
            } else {
                // No API info
                apiStatusCard.classList.add('hidden');
            }
        } catch (error) {
            console.warn('⚠️ API durumu güncellenemedi:', error);
        }
    }

    // Financial Analysis Functions
    _buildFinancialDataForTable(tableName) {
        const fullData = this.cachedFullData;
        if (!fullData?._tables?.[tableName]) return null;

        const tableData = fullData._tables[tableName];
        const products = [];
        const categoryMap = {};

        for (const [productId, rawData] of Object.entries(tableData)) {
            if (this.isReservedCountingKey(productId)) continue;

            const product = this.productIndex.get(productId);
            if (!product) continue;

            const data = this._mergeEntryWithPriceCacheForFinance(productId, rawData);
            const warehouseStock = data.warehouseStock ?? 0;
            const systemStock = data.systemStock ?? 0;
            const resolvedPrice = this._resolveFinancePrice(data);
            const price = resolvedPrice ?? 0;
            const priceText = resolvedPrice
                ? (this._resolveFinancePriceText(data) || this.formatCurrency(resolvedPrice))
                : '—';
            const pricePending = !resolvedPrice || resolvedPrice <= 0;

            const warehouseValue = (resolvedPrice ? warehouseStock : 0) * (resolvedPrice || 0);
            const systemValue = (resolvedPrice ? systemStock : 0) * (resolvedPrice || 0);
            const difference = warehouseValue - systemValue;
            const stockDiff = warehouseStock - systemStock;
            const barcodes = (product.barcodes || [])
                .map((b) => (b && b.code != null ? String(b.code).trim() : ''))
                .filter(Boolean);
            const barcode = barcodes.length ? barcodes[0] : '';
            const imageUrl = product.image || '../assets/logo.png';
            const category = product.category || 'Genel';

            const productData = {
                productId,
                productName: product.name || 'Bilinmeyen Ürün',
                category,
                warehouseStock,
                systemStock,
                price,
                priceText,
                pricePending,
                warehouseValue,
                systemValue,
                difference,
                stockDiff,
                barcode,
                barcodes,
                imageUrl,
            };

            products.push(productData);

            if (!categoryMap[category]) {
                categoryMap[category] = {
                    category,
                    warehouseValue: 0,
                    systemValue: 0,
                    difference: 0,
                    productCount: 0,
                };
            }
            categoryMap[category].warehouseValue += warehouseValue;
            categoryMap[category].systemValue += systemValue;
            categoryMap[category].difference += difference;
            categoryMap[category].productCount += 1;
        }

        const totalWarehouseValue = products.reduce((sum, p) => sum + p.warehouseValue, 0);
        const totalSystemValue = products.reduce((sum, p) => sum + p.systemValue, 0);
        const profitLoss = totalWarehouseValue - totalSystemValue;
        const productCount = products.length;
        const countedProducts = products.filter(
            (p) => p.warehouseStock !== null && p.warehouseStock !== undefined
        ).length;
        const categories = Object.values(categoryMap).sort((a, b) => b.warehouseValue - a.warehouseValue);

        return {
            tableName,
            summary: {
                totalWarehouseValue,
                totalSystemValue,
                profitLoss,
                productCount,
                countedProducts,
            },
            categories,
            products: products.sort((a, b) => b.warehouseValue - a.warehouseValue),
        };
    }

    async calculateFinancialData(tableName) {
        try {
            await this.loadFullCountingData();
            const cacheKey = this._getTableFinanceCacheKey(tableName);
            const cached = this._financeCalcCache.get(tableName);
            if (cached?.key === cacheKey && cached.data) {
                return cached.data;
            }
            const data = this._buildFinancialDataForTable(tableName);
            if (data) {
                this._financeCalcCache.set(tableName, { key: cacheKey, data });
            }
            return data;
        } catch (error) {
            console.error('Error calculating financial data:', error);
            return null;
        }
    }

    async getAllTablesFinancialData() {
        try {
            await this.loadFullCountingData();
            const tables = this.getFinanceEligibleTableNames();
            const allCacheKey = `__all__:${tables.map((t) => this._getTableFinanceCacheKey(t)).join(';')}`;
            const cachedAll = this._financeCalcCache.get('__all__');
            if (cachedAll?.key === allCacheKey && Array.isArray(cachedAll.data)) {
                return cachedAll.data;
            }

            const financialData = (
                await Promise.all(tables.map((tableName) => this.calculateFinancialData(tableName)))
            ).filter(Boolean);

            this._financeCalcCache.set('__all__', { key: allCacheKey, data: financialData });
            return financialData;
        } catch (error) {
            console.error('Error getting all tables financial data:', error);
            return [];
        }
    }

    getCategoryBreakdown(tableData) {
        const categoryMap = {};

        for (const product of tableData.products) {
            const category = product.category || 'Genel';

            if (!categoryMap[category]) {
                categoryMap[category] = {
                    category,
                    warehouseValue: 0,
                    systemValue: 0,
                    difference: 0,
                    productCount: 0
                };
            }

            categoryMap[category].warehouseValue += product.warehouseValue;
            categoryMap[category].systemValue += product.systemValue;
            categoryMap[category].difference += product.difference;
            categoryMap[category].productCount += 1;
        }

        return Object.values(categoryMap).sort((a, b) => b.warehouseValue - a.warehouseValue);
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    async renderFinancialTab() {
        const finansTabContent = document.getElementById('finansTabContent');
        if (!finansTabContent) return;

        this._applyFinanceVisualAnalyticsVisibility();

        // Setup financial table selector (same as counting table selector)
        this.setupFinancialTableSelector();

        // Orijinal fiyat toggle
        const struckPriceToggle = document.getElementById('financeStruckPriceToggle');
        if (struckPriceToggle && !struckPriceToggle.dataset.setup) {
            struckPriceToggle.dataset.setup = 'true';
            struckPriceToggle.checked = this._financeUseStruckPrice;
            struckPriceToggle.addEventListener('change', () => {
                this._financeUseStruckPrice = struckPriceToggle.checked;
                void this.renderFinancialDataForSelection();
            });
        }

        this._syncFinancialTableFromSayim();
        this.updateFinancialTableSelector();
        await this.renderFinancialDataForSelection();
    }

    _closeFinancialTableSelectorDropdown() {
        const financialTableSelectorDropdown = document.getElementById('financialTableSelectorDropdown');
        const financialTableSelectorBtn = document.getElementById('financialTableSelectorBtn');
        const financialTableSelectorIcon = document.getElementById('financialTableSelectorIcon');
        const financialTableSearch = document.getElementById('financialTableSearch');
        if (financialTableSelectorDropdown) financialTableSelectorDropdown.classList.add('hidden');
        if (financialTableSelectorBtn) financialTableSelectorBtn.setAttribute('aria-expanded', 'false');
        if (financialTableSelectorIcon) financialTableSelectorIcon.style.transform = 'rotate(0deg)';
        if (financialTableSearch) financialTableSearch.value = '';
    }

    _getFinancialTableSearchQuery() {
        const el = document.getElementById('financialTableSearch');
        return (el?.value || '').trim().toLocaleLowerCase('tr');
    }

    _renderFinancialTableSelectorList() {
        const financialTableSelectorList = document.getElementById('financialTableSelectorList');
        if (!financialTableSelectorList) return;

        const tables = this.getTableList().filter((t) => !this.isDailyTableName(t.name));
        const q = this._getFinancialTableSearchQuery();
        const filteredTables = q
            ? tables.filter((t) => {
                const label = this.formatTableDisplayName(t.name).toLocaleLowerCase('tr');
                return label.includes(q) || String(t.name).toLocaleLowerCase('tr').includes(q);
            })
            : tables;

        financialTableSelectorList.innerHTML = '';

        const appendRow = (labelHtml, isActive, status, onPick, extraClass = '') => {
            const row = document.createElement('button');
            row.type = 'button';
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', isActive ? 'true' : 'false');
            row.className = [
                'relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors',
                this.getTableStatusDropdownRowClasses(status, isActive),
                extraClass,
            ].join(' ');
            row.innerHTML = labelHtml;
            row.addEventListener('click', onPick);
            financialTableSelectorList.appendChild(row);
        };

        appendRow(
            `<span class="min-w-0 flex-1 truncate font-medium">Tüm Kategoriler</span><span class="shrink-0 text-[10px] font-normal text-slate-400">Günlük hariç</span>`,
            this.selectedFinancialTable === 'all',
            'not-started',
            async () => {
                this._clearFinancePasteGuide();
                this.selectedFinancialTable = 'all';
                await this.renderAllTablesFinancialData();
                this.updateFinancialTableSelector();
                this._closeFinancialTableSelectorDropdown();
            }
        );

        if (filteredTables.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'px-3 py-4 text-center text-[11px] text-slate-500';
            empty.textContent = tables.length ? 'Arama ile eşleşen tablo yok.' : 'Henüz tablo yok.';
            financialTableSelectorList.appendChild(empty);
            return;
        }

        filteredTables.forEach((table) => {
            const isActive = table.name === this.selectedFinancialTable;
            const isPreset = this.isPresetSubcategoryTable(table.name);
            const label = this.formatTableDisplayName(table.name);
            appendRow(
                `${isPreset ? this.renderPresetSubcategoryBadgeHtml() : ''}<span class="min-w-0 truncate font-medium">${this.escapeHtml(label)}</span><span class="shrink-0 tabular-nums text-[10px] font-semibold ${this.getTableStatusCountBadgeClasses(table.status, isActive)}">${table.productCount ?? 0}</span>`,
                isActive,
                table.status || 'not-started',
                async () => {
                    if (this.selectedFinancialTable !== table.name) {
                        this._clearFinancePasteGuide();
                    }
                    this.selectedFinancialTable = table.name;
                    await this.renderSingleTableFinancialData(table.name);
                    this.updateFinancialTableSelector();
                    this._closeFinancialTableSelectorDropdown();
                },
                isPreset ? 'preset-subcat-table-dropdown-row pl-7' : ''
            );
        });
    }

    setupFinancialTableSelector() {
        const financialTableSelectorBtn = document.getElementById('financialTableSelectorBtn');
        const financialTableSelectorText = document.getElementById('financialTableSelectorText');
        const financialTableSelectorDropdown = document.getElementById('financialTableSelectorDropdown');
        const financialTableSelectorIcon = document.getElementById('financialTableSelectorIcon');
        const financialTableSearch = document.getElementById('financialTableSearch');

        if (!financialTableSelectorBtn || !financialTableSelectorText || !financialTableSelectorDropdown) return;

        if (financialTableSelectorBtn.dataset.setup === 'true') return;
        financialTableSelectorBtn.dataset.setup = 'true';

        financialTableSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = financialTableSelectorDropdown.classList.contains('hidden');
            if (willOpen) {
                financialTableSelectorDropdown.classList.remove('hidden');
                financialTableSelectorBtn.setAttribute('aria-expanded', 'true');
                if (financialTableSelectorIcon) financialTableSelectorIcon.style.transform = 'rotate(180deg)';
                this._renderFinancialTableSelectorList();
                setTimeout(() => financialTableSearch?.focus(), 30);
            } else {
                this._closeFinancialTableSelectorDropdown();
            }
        });

        if (financialTableSearch && !financialTableSearch.dataset.setup) {
            financialTableSearch.dataset.setup = 'true';
            let searchTimer = null;
            financialTableSearch.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => this._renderFinancialTableSelectorList(), 120);
            });
            financialTableSearch.addEventListener('click', (e) => e.stopPropagation());
            financialTableSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this._closeFinancialTableSelectorDropdown();
            });
        }

        document.addEventListener('click', (e) => {
            if (financialTableSelectorDropdown.classList.contains('hidden')) return;
            if (financialTableSelectorBtn.contains(e.target) || financialTableSelectorDropdown.contains(e.target)) return;
            this._closeFinancialTableSelectorDropdown();
        });
    }

    updateFinancialTableSelector() {
        const financialTableSelectorText = document.getElementById('financialTableSelectorText');
        const financeActiveTableLabel = document.getElementById('financeActiveTableLabel');

        if (!financialTableSelectorText && !financeActiveTableLabel) return;

        const tables = this.getTableList();
        const financialTableSelectorBtn = document.getElementById('financialTableSelectorBtn');
        let activeLabel = 'Tablo seçin';
        if (this.selectedFinancialTable === 'all') {
            activeLabel = 'Tüm Kategoriler';
            financialTableSelectorBtn?.classList.remove('preset-subcat-table-selector-active');
        } else {
            const selectedTable = tables.find((t) => t.name === this.selectedFinancialTable);
            activeLabel = selectedTable
                ? this.formatTableDisplayName(selectedTable.name)
                : (this.selectedFinancialTable || 'Tablo seçin');
            const isPreset = selectedTable && this.isPresetSubcategoryTable(selectedTable.name);
            if (isPreset) {
                financialTableSelectorBtn?.classList.add('preset-subcat-table-selector-active');
            } else {
                financialTableSelectorBtn?.classList.remove('preset-subcat-table-selector-active');
            }
        }
        if (financeActiveTableLabel) {
            financeActiveTableLabel.textContent = activeLabel;
        }
        if (financialTableSelectorText) {
            financialTableSelectorText.textContent = activeLabel;
        }

        const financialTableSelectorDropdown = document.getElementById('financialTableSelectorDropdown');
        if (financialTableSelectorDropdown && !financialTableSelectorDropdown.classList.contains('hidden')) {
            this._renderFinancialTableSelectorList();
        }
    }

    async renderAllTablesFinancialData() {
        const allData = await this.getAllTablesFinancialData();
        
        // Aggregate all tables
        const aggregated = {
            summary: {
                totalWarehouseValue: 0,
                totalSystemValue: 0,
                profitLoss: 0,
                productCount: 0,
                countedProducts: 0
            },
            categories: {},
            products: []
        };

        allData.forEach(tableData => {
            aggregated.summary.totalWarehouseValue += tableData.summary.totalWarehouseValue;
            aggregated.summary.totalSystemValue += tableData.summary.totalSystemValue;
            aggregated.summary.profitLoss += tableData.summary.profitLoss;
            aggregated.summary.productCount += tableData.summary.productCount;
            aggregated.summary.countedProducts += tableData.summary.countedProducts;

            tableData.categories.forEach(cat => {
                if (!aggregated.categories[cat.category]) {
                    aggregated.categories[cat.category] = { ...cat };
                } else {
                    aggregated.categories[cat.category].warehouseValue += cat.warehouseValue;
                    aggregated.categories[cat.category].systemValue += cat.systemValue;
                    aggregated.categories[cat.category].difference += cat.difference;
                    aggregated.categories[cat.category].productCount += cat.productCount;
                }
            });

            aggregated.products.push(...tableData.products);
        });

        this.renderFinancialSummary(aggregated.summary);
        this.renderCategoryBreakdown(Object.values(aggregated.categories));
        this.renderCharts(Object.values(aggregated.categories), aggregated.products);
        this.renderTopProductsTables(aggregated.products);
        this.renderFinancialExecutiveReport(aggregated.products, aggregated.summary);
    }

    async renderSingleTableFinancialData(tableName) {
        const data = await this.calculateFinancialData(tableName);
        if (!data) {
            // Show empty state
            this.renderFinancialSummary({ totalWarehouseValue: 0, totalSystemValue: 0, profitLoss: 0, productCount: 0, countedProducts: 0 });
            this.renderCategoryBreakdown([]);
            this.renderFinancialExecutiveReport([], { totalWarehouseValue: 0, totalSystemValue: 0, profitLoss: 0, productCount: 0, countedProducts: 0 });
            return;
        }

        this.renderFinancialSummary(data.summary);
        this.renderCategoryBreakdown(data.categories);
        this.renderCharts(data.categories, data.products);
        this.renderTopProductsTables(data.products);
        this.renderFinancialExecutiveReport(data.products, data.summary);
    }

    renderFinancialSummary(summary) {
        const summaryCards = document.getElementById('financialSummaryCards');
        if (!summaryCards) return;

        summaryCards.innerHTML = `
            <div class="financial-card warehouse">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                        </div>
                        <div>
                            <div class="text-xs text-gray-600 font-medium">Toplam Depo Değeri</div>
                            <div class="text-xl sm:text-2xl font-bold text-gray-900">${this.formatCurrency(summary.totalWarehouseValue)}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="financial-card system">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                        </div>
                        <div>
                            <div class="text-xs text-gray-600 font-medium">Toplam Sistem Değeri</div>
                            <div class="text-xl sm:text-2xl font-bold text-gray-900">${this.formatCurrency(summary.totalSystemValue)}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="financial-card ${summary.profitLoss >= 0 ? 'profit' : 'loss'}">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <div class="w-10 h-10 rounded-lg ${summary.profitLoss >= 0 ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center">
                            <svg class="w-6 h-6 ${summary.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${summary.profitLoss >= 0 ? 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' : 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6'}"/>
                            </svg>
                        </div>
                        <div>
                            <div class="text-xs text-gray-600 font-medium">Kar/Zarar</div>
                            <div class="text-xl sm:text-2xl font-bold ${summary.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}">${this.formatCurrency(summary.profitLoss)}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="financial-card count">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                        </div>
                        <div>
                            <div class="text-xs text-gray-600 font-medium">Ürün Sayısı</div>
                            <div class="text-xl sm:text-2xl font-bold text-gray-900">${summary.countedProducts}/${summary.productCount}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderCategoryBreakdown(categories) {
        if (this._financeVisualAnalyticsDisabled) return;
        const categoryBreakdownBody = document.getElementById('categoryBreakdownBody');
        if (!categoryBreakdownBody) return;

        if (categories.length === 0) {
            categoryBreakdownBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                        Kategori verisi bulunamadı
                    </td>
                </tr>
            `;
            return;
        }

        categoryBreakdownBody.innerHTML = categories.map(cat => {
            const rowClass = cat.difference >= 0 ? 'profit-row' : 'loss-row';
            return `
                <tr class="${rowClass}">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">${cat.category}</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold">${this.formatCurrency(cat.warehouseValue)}</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold">${this.formatCurrency(cat.systemValue)}</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold ${cat.difference >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${cat.difference >= 0 ? '+' : ''}${this.formatCurrency(cat.difference)}
                    </td>
                    <td class="px-4 py-3 text-sm text-center text-gray-600">${cat.productCount}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Tüm tablolar görünümünde aynı ürün satırlarını birleştirir (fiyat aynı varsayımı).
     */
    dedupeFinancialProductsByProductId(products) {
        const map = new Map();
        for (const p of products) {
            const id = p.productId;
            const ex = map.get(id);
            if (!ex) {
                map.set(id, { ...p });
            } else {
                const warehouseStock = ex.warehouseStock + p.warehouseStock;
                const systemStock = ex.systemStock + p.systemStock;
                const price = ex.price;
                const warehouseValue = warehouseStock * price;
                const systemValue = systemStock * price;
                map.set(id, {
                    ...ex,
                    warehouseStock,
                    systemStock,
                    warehouseValue,
                    systemValue,
                    difference: warehouseValue - systemValue,
                    stockDiff: warehouseStock - systemStock,
                    barcodes: ex.barcodes && ex.barcodes.length ? ex.barcodes : (p.barcodes || []),
                });
            }
        }
        return [...map.values()];
    }

    /** Finans Stok Özeti — terminal okutulabilir EAN-13 / Code128 SVG */
    renderFinanceScannableBarcodesHtml(barcodes, options = {}) {
        const maxVisible = options.maxVisible ?? 2;
        const width = options.width ?? 196;
        const height = options.height ?? 56;
        const BV = typeof window !== 'undefined' ? window.BarcodeVisual : null;
        const list = Array.isArray(barcodes) ? barcodes : [];
        const codes = list
            .map((b) => {
                if (b == null) return '';
                if (typeof b === 'object' && b.code != null) return String(b.code).trim();
                return String(b).trim();
            })
            .filter(Boolean);
        if (!codes.length) {
            return options.emptyHtml || '<span class="text-[10px] text-gray-400">—</span>';
        }

        const visible = codes.slice(0, maxVisible);
        const chunks = visible
            .map((code) => {
                const safe = this.escapeHtml(code);
                let visual = null;
                if (BV && typeof BV.generateBarcodeSVG === 'function') {
                    visual = BV.generateBarcodeSVG(code, width, height);
                }
                if (!visual) {
                    return `<button type="button" class="finance-barcode-fallback rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] text-slate-700 hover:bg-slate-50" data-barcode-copy="${safe}" title="Barkodu kopyala">${safe}</button>`;
                }
                return `<button type="button" class="finance-barcode-visual rounded-md border border-slate-200 bg-white px-1 py-0.5 shadow-sm hover:border-slate-300 hover:shadow transition-colors cursor-pointer" data-barcode-copy="${safe}" title="Terminal okutma / kopyalamak için tıklayın">${visual}</button>`;
            })
            .join('');

        const extra =
            codes.length > maxVisible
                ? `<span class="self-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">+${codes.length - maxVisible} barkod</span>`
                : '';

        return `<div class="flex flex-wrap items-end gap-2">${chunks}${extra}</div>`;
    }

    _bindFinanceBarcodeCopy(root) {
        if (!root) return;
        root.querySelectorAll('[data-barcode-copy]').forEach((el) => {
            if (el.dataset.barcodeCopyBound === '1') return;
            el.dataset.barcodeCopyBound = '1';
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const code = el.getAttribute('data-barcode-copy');
                if (!code) return;
                navigator.clipboard
                    .writeText(code)
                    .then(() => this.showToast(`Barkod kopyalandı: ${code}`, 'success', 2200))
                    .catch(() => this.showToast('Barkod kopyalanamadı', 'error', 2200));
            });
        });
    }

    _syncFinanceBarcodesVisibility(container) {
        const root = container || document.getElementById('financialExecutiveReport');
        if (!root) return;
        const visible = !!this._financeBarcodesVisible;
        root.querySelectorAll('.finance-barcodes-block').forEach((el) => {
            el.classList.toggle('hidden', !visible);
            el.setAttribute('aria-hidden', visible ? 'false' : 'true');
        });
        const btn = root.querySelector('#financeBarcodesToggleBtn');
        if (!btn) return;
        const label = btn.querySelector('[data-finance-barcode-label]');
        if (label) label.textContent = visible ? 'Barkodları gizle' : 'Barkodları göster';
        btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
        btn.classList.toggle('finance-barcodes-toggle--active', visible);
    }

    _bindFinanceBarcodeToggle(container) {
        const root = container || document.getElementById('financialExecutiveReport');
        if (!root) return;
        const btn = root.querySelector('#financeBarcodesToggleBtn');
        if (!btn) return;
        btn.onclick = () => {
            this._financeBarcodesVisible = !this._financeBarcodesVisible;
            this._syncFinanceBarcodesVisibility(root);
        };
        this._syncFinanceBarcodesVisibility(root);
    }

    /** Sayım tablosu / genel — barkod rozetleri (SVG ikonlu metin) */
    renderBarcodeBadgesHtml(barcodes, options = {}) {
        const maxVisible = options.maxVisible ?? 3;
        const list = Array.isArray(barcodes) ? barcodes : [];
        const codes = list
            .map((b) => {
                if (b == null) return '';
                if (typeof b === 'object' && b.code != null) return String(b.code).trim();
                return String(b).trim();
            })
            .filter(Boolean);
        if (!codes.length) {
            return options.emptyHtml || '<span class="text-[10px] text-gray-400">—</span>';
        }
        const iconSvg =
            '<svg class="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>';
        const visible = codes.slice(0, maxVisible);
        const pills = visible
            .map(
                (code) =>
                    `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 font-mono tabular-nums">${iconSvg}${this.escapeHtml(code)}</span>`
            )
            .join('');
        const extra =
            codes.length > maxVisible
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">+${codes.length - maxVisible}</span>`
                : '';
        return `<div class="flex flex-wrap gap-1.5">${pills}${extra}</div>`;
    }

    /**
     * Finans sekmesi altı: eksik / fazla ürünler, foto, tam ad, barkod, adet ve TL etkisi, net kar/zarar.
     */
    renderFinancialExecutiveReport(products, summary) {
        const container = document.getElementById('financialExecutiveReport');
        if (!container) return;

        this._lastFinanceExecutiveProducts = products;
        this._lastFinanceExecutiveSummary = summary;

        if (this._financePasteGuide && this._financePasteGuide.tableKey !== this.selectedFinancialTable) {
            this._clearFinancePasteGuide();
        }

        const safeSummary = summary || {
            totalWarehouseValue: 0,
            totalSystemValue: 0,
            profitLoss: 0,
            productCount: 0,
            countedProducts: 0
        };

        let list = Array.isArray(products) ? [...products] : [];
        if (this.selectedFinancialTable === 'all' && list.length) {
            list = this.dedupeFinancialProductsByProductId(list);
        }

        const missing = list.filter((p) => p.stockDiff < 0).sort((a, b) => a.difference - b.difference);
        const surplus = list.filter((p) => p.stockDiff > 0).sort((a, b) => b.difference - a.difference);

        const sumMissing = missing.reduce((s, p) => s + p.difference, 0);
        const sumSurplus = surplus.reduce((s, p) => s + p.difference, 0);

        const scopeShort =
            this.selectedFinancialTable === 'all'
                ? 'Tüm kategoriler · sabit alt kategoriler · günlük hariç'
                : this.formatTableDisplayName(this.selectedFinancialTable || '');

        const now = new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });

        const productHasBarcodes = (p) => {
            const list = Array.isArray(p.barcodes) && p.barcodes.length ? p.barcodes : p.barcode ? [p.barcode] : [];
            return list.some((b) => {
                if (b == null) return false;
                if (typeof b === 'object' && b.code != null) return String(b.code).trim().length > 0;
                return String(b).trim().length > 0;
            });
        };
        const hasAnyBarcodes = missing.some(productHasBarcodes) || surplus.some(productHasBarcodes);
        const barcodesHiddenClass = this._financeBarcodesVisible ? '' : 'hidden';

        const productCard = (p, kind) => {
            const img = this.escapeHtml(p.imageUrl || '../assets/logo.png');
            const name = this.escapeHtml(p.productName || '');
            const barcodeList = Array.isArray(p.barcodes) && p.barcodes.length
                ? p.barcodes
                : (p.barcode ? [p.barcode] : []);
            const barcodesHtml = productHasBarcodes(p)
                ? `<div class="finance-barcodes-block mt-1.5 ${barcodesHiddenClass}" aria-hidden="${this._financeBarcodesVisible ? 'false' : 'true'}">${this.renderFinanceScannableBarcodesHtml(barcodeList, { maxVisible: 2 })}</div>`
                : '';
            const adetStr = p.stockDiff > 0 ? `+${p.stockDiff}` : `${p.stockDiff}`;
            const adetLabel = kind === 'miss' ? `${adetStr} adet eksik` : `${adetStr} adet fazla`;
            const stockDiffClass = p.stockDiff > 0 ? 'text-emerald-700' : p.stockDiff < 0 ? 'text-rose-700' : 'text-gray-600';
            const tone =
                kind === 'miss'
                    ? { bar: 'border-l-rose-400 bg-rose-50/35', ad: 'text-rose-700', tl: 'text-rose-800' }
                    : { bar: 'border-l-emerald-400 bg-emerald-50/35', ad: 'text-emerald-700', tl: 'text-emerald-800' };
            return `
                <div class="flex gap-2.5 rounded-lg border border-gray-100 ${tone.bar} border-l-[3px] p-2.5 pl-2">
                    <img src="${img}" alt="" class="h-11 w-11 shrink-0 rounded-lg border border-white object-cover shadow-sm" loading="lazy" />
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium leading-snug text-gray-900 [overflow-wrap:anywhere]">${name}</p>
                        ${barcodesHtml}
                        <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                            <span>Depo: <strong>${p.warehouseStock ?? '—'}</strong></span>
                            <span>Sistem: <strong>${p.systemStock ?? '—'}</strong></span>
                            <span class="font-semibold ${stockDiffClass}">(${adetStr})</span>
                        </div>
                        <div class="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-t border-gray-100/80 pt-1.5 text-[11px]">
                            <span class="font-semibold ${tone.ad}">${adetLabel}</span>
                            <span class="text-gray-500">Birim ${p.pricePending ? '—' : this.formatCurrency(p.price)}</span>
                            <span class="w-full text-right text-xs font-bold ${tone.tl} sm:w-auto">${p.difference >= 0 ? '+' : ''}${this.formatCurrency(p.difference)}</span>
                        </div>
                    </div>
                </div>`;
        };

        const emptyCol = (msg) => `<p class="py-6 text-center text-xs text-gray-400">${msg}</p>`;

        const netClass = safeSummary.profitLoss >= 0 ? 'text-emerald-700' : 'text-red-600';
        const netBg = safeSummary.profitLoss >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/40';

        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-md border border-gray-100 p-3 sm:p-4">
                <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0">
                        <h3 class="text-base font-bold tracking-tight text-gray-900 sm:text-lg">Stok Özeti</h3>
                        <p class="mt-0.5 text-xs text-gray-500">${this.escapeHtml(scopeShort)}</p>
                    </div>
                    <div class="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        ${
                            hasAnyBarcodes
                                ? `<button type="button" id="financeBarcodesToggleBtn" class="finance-barcodes-toggle inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md" aria-pressed="${this._financeBarcodesVisible ? 'true' : 'false'}" title="Terminal okutma için barkod görsellerini aç / kapat">
                            <svg class="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
                            <span data-finance-barcode-label>${this._financeBarcodesVisible ? 'Barkodları gizle' : 'Barkodları göster'}</span>
                        </button>`
                                : ''
                        }
                        <p class="text-[11px] text-gray-400 sm:text-right">${this.escapeHtml(now)}</p>
                    </div>
                </div>

                <div class="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                    <div class="rounded-xl border border-rose-100 bg-rose-50/90 px-4 py-3 shadow-sm">
                        <p class="text-[11px] font-medium uppercase tracking-wide text-rose-600/90">Depoda eksik</p>
                        <p class="mt-1 flex items-baseline gap-1.5">
                            <span class="text-3xl font-bold tabular-nums leading-none text-rose-700">${missing.length}</span>
                            <span class="text-xs font-medium text-rose-800/80">ürün</span>
                        </p>
                        <p class="mt-2 text-xs font-semibold text-rose-700">${this.formatCurrency(sumMissing)} <span class="font-normal text-rose-600/80">TL etki</span></p>
                    </div>
                    <div class="rounded-xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 shadow-sm">
                        <p class="text-[11px] font-medium uppercase tracking-wide text-emerald-600/90">Depoda fazla</p>
                        <p class="mt-1 flex items-baseline gap-1.5">
                            <span class="text-3xl font-bold tabular-nums leading-none text-emerald-700">${surplus.length}</span>
                            <span class="text-xs font-medium text-emerald-800/80">ürün</span>
                        </p>
                        <p class="mt-2 text-xs font-semibold text-emerald-700">${this.formatCurrency(sumSurplus)} <span class="font-normal text-emerald-600/80">TL etki</span></p>
                    </div>
                    <div class="rounded-xl border ${netBg} px-4 py-3 shadow-sm sm:flex sm:flex-col sm:justify-center">
                        <p class="text-[11px] font-medium uppercase tracking-wide text-gray-500">Net (depo − sistem)</p>
                        <p class="mt-1 text-2xl font-bold tabular-nums ${netClass}">${this.formatCurrency(safeSummary.profitLoss)}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                    <div>
                        <div class="mb-2 flex items-center justify-between gap-2">
                            <span class="text-xs font-semibold text-gray-800">Hangi ürünler eksik?</span>
                            <span class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">${missing.length} kalem</span>
                        </div>
                        <div class="space-y-2">
                            ${missing.length === 0 ? emptyCol('Eksik ürün yok.') : missing.map((p) => productCard(p, 'miss')).join('')}
                        </div>
                    </div>
                    <div>
                        <div class="mb-2 flex items-center justify-between gap-2">
                            <span class="text-xs font-semibold text-gray-800">Hangi ürünler fazla?</span>
                            <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">${surplus.length} kalem</span>
                        </div>
                        <div class="space-y-2">
                            ${surplus.length === 0 ? emptyCol('Fazla ürün yok.') : surplus.map((p) => productCard(p, 'plus')).join('')}
                        </div>
                    </div>
                </div>
                ${this._renderFinancePasteGuideHtml()}
            </div>
        `;
        this._bindFinanceBarcodeCopy(container);
        this._bindFinanceBarcodeToggle(container);
        this._bindFinancePasteGuide(container, list);
    }

    setupChartCarousel() {
        const chartPrevBtn = document.getElementById('chartPrevBtn');
        const chartNextBtn = document.getElementById('chartNextBtn');
        const chartSlidesContainer = document.getElementById('chartSlidesContainer');
        const chartDotsContainer = document.getElementById('chartDotsContainer');

        if (!chartPrevBtn || !chartNextBtn || !chartSlidesContainer || !chartDotsContainer) return;

        // Create dots dynamically
        chartDotsContainer.innerHTML = '';
        for (let i = 0; i < this.totalCharts; i++) {
            const dot = document.createElement('button');
            dot.className = `chart-dot w-2 h-2 rounded-full transition-all ${i === 0 ? 'bg-blue-600 active' : 'bg-gray-300'}`;
            dot.dataset.chartIndex = i;
            dot.addEventListener('click', () => {
                this.currentChartIndex = i;
                this.updateChartCarousel();
            });
            chartDotsContainer.appendChild(dot);
        }

        // Previous button
        chartPrevBtn.addEventListener('click', () => {
            this.currentChartIndex = (this.currentChartIndex - 1 + this.totalCharts) % this.totalCharts;
            this.updateChartCarousel();
        });

        // Next button
        chartNextBtn.addEventListener('click', () => {
            this.currentChartIndex = (this.currentChartIndex + 1) % this.totalCharts;
            this.updateChartCarousel();
        });
    }

    updateChartCarousel() {
        const chartSlidesContainer = document.getElementById('chartSlidesContainer');
        const chartDots = document.querySelectorAll('.chart-dot');

        if (!chartSlidesContainer) return;

        // Move slides - each slide is 100% width, so translate by index * 100%
        chartSlidesContainer.style.transform = `translateX(-${this.currentChartIndex * 100}%)`;

        // Update dots
        chartDots.forEach((dot, index) => {
            if (index === this.currentChartIndex) {
                dot.classList.add('active');
                dot.classList.remove('bg-gray-300');
                dot.classList.add('bg-blue-600');
                dot.style.width = '8px';
                dot.style.height = '8px';
            } else {
                dot.classList.remove('active');
                dot.classList.remove('bg-blue-600');
                dot.classList.add('bg-gray-300');
                dot.style.width = '6px';
                dot.style.height = '6px';
            }
        });
    }

    renderCharts(categories, products = []) {
        if (this._financeVisualAnalyticsDisabled) return;
        if (!window.Chart) {
            console.warn('Chart.js not loaded');
            return;
        }

        // Setup carousel if not already done
        if (!this.chartCarouselSetup) {
            this.setupChartCarousel();
            this.chartCarouselSetup = true;
        }

        // Destroy existing charts
        if (this.categoryPieChart) this.categoryPieChart.destroy();
        if (this.categoryBarChart) this.categoryBarChart.destroy();
        if (this.topProfitProductsChart) this.topProfitProductsChart.destroy();
        if (this.topLossProductsChart) this.topLossProductsChart.destroy();
        if (this.topValueProductsChart) this.topValueProductsChart.destroy();
        if (this.topStockDiffChart) this.topStockDiffChart.destroy();

        if (!categories || categories.length === 0) {
            return;
        }

        // Prepare data
        const labels = categories.map(cat => cat.category);
        const warehouseValues = categories.map(cat => cat.warehouseValue);
        const differences = categories.map(cat => cat.difference);

        // Generate colors
        const colors = [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
        ];

        // Pie Chart - Category Distribution
        const pieCtx = document.getElementById('categoryPieChart');
        if (pieCtx) {
            this.categoryPieChart = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: warehouseValues,
                        backgroundColor: colors.slice(0, labels.length),
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 10,
                                font: {
                                    size: 11
                                },
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = this.formatCurrency(context.parsed);
                                    const total = warehouseValues.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.parsed / total) * 100).toFixed(1);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Bar Chart - Category Profit/Loss
        const barCtx = document.getElementById('categoryBarChart');
        if (barCtx) {
            this.categoryBarChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Kar/Zarar',
                        data: differences,
                        backgroundColor: differences.map(diff => 
                            diff >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
                        ),
                        borderColor: differences.map(diff => 
                            diff >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'
                        ),
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = this.formatCurrency(context.parsed.y);
                                    return `Fark: ${value}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => {
                                    return this.formatCurrency(value);
                                },
                                font: {
                                    size: 10
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: 10
                                },
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }

        // Render product-based charts if products available
        if (products && products.length > 0) {
            this.renderTopProfitProductsChart(products);
            this.renderTopLossProductsChart(products);
            this.renderTopValueProductsChart(products);
            this.renderTopStockDiffChart(products);
        }
    }

    renderTopProfitProductsChart(products) {
        // Filter and sort by profit (difference > 0)
        const profitProducts = products
            .filter(p => p.difference > 0)
            .sort((a, b) => b.difference - a.difference)
            .slice(0, 10);

        if (profitProducts.length === 0) return;

        const ctx = document.getElementById('topProfitProductsChart');
        if (!ctx) return;

        this.topProfitProductsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: profitProducts.map(p => p.productName.length > 20 ? p.productName.substring(0, 20) + '...' : p.productName),
                datasets: [{
                    label: 'Kar',
                    data: profitProducts.map(p => p.difference),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Kar: ${this.formatCurrency(context.parsed.x)}`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value),
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 0
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    renderTopLossProductsChart(products) {
        // Filter and sort by loss (difference < 0)
        const lossProducts = products
            .filter(p => p.difference < 0)
            .sort((a, b) => a.difference - b.difference)
            .slice(0, 10);

        if (lossProducts.length === 0) return;

        const ctx = document.getElementById('topLossProductsChart');
        if (!ctx) return;

        this.topLossProductsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: lossProducts.map(p => p.productName.length > 20 ? p.productName.substring(0, 20) + '...' : p.productName),
                datasets: [{
                    label: 'Zarar',
                    data: lossProducts.map(p => Math.abs(p.difference)),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Zarar: ${this.formatCurrency(-context.parsed.x)}`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value),
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 0
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    renderTopValueProductsChart(products) {
        // Sort by warehouse value
        const topValueProducts = [...products]
            .sort((a, b) => b.warehouseValue - a.warehouseValue)
            .slice(0, 10);

        if (topValueProducts.length === 0) return;

        const ctx = document.getElementById('topValueProductsChart');
        if (!ctx) return;

        this.topValueProductsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topValueProducts.map(p => p.productName.length > 15 ? p.productName.substring(0, 15) + '...' : p.productName),
                datasets: [{
                    label: 'Depo Değeri',
                    data: topValueProducts.map(p => p.warehouseValue),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Değer: ${this.formatCurrency(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value),
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    renderTopStockDiffChart(products) {
        // Calculate stock differences and sort
        const stockDiffProducts = products
            .map(p => ({
                ...p,
                stockDiff: Math.abs(p.warehouseStock - p.systemStock)
            }))
            .filter(p => p.stockDiff > 0)
            .sort((a, b) => b.stockDiff - a.stockDiff)
            .slice(0, 10);

        if (stockDiffProducts.length === 0) return;

        const ctx = document.getElementById('topStockDiffChart');
        if (!ctx) return;

        this.topStockDiffChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: stockDiffProducts.map(p => p.productName.length > 20 ? p.productName.substring(0, 20) + '...' : p.productName),
                datasets: [{
                    label: 'Stok Farkı',
                    data: stockDiffProducts.map(p => p.stockDiff),
                    backgroundColor: stockDiffProducts.map(p => {
                        const diff = p.warehouseStock - p.systemStock;
                        return diff > 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
                    }),
                    borderColor: stockDiffProducts.map(p => {
                        const diff = p.warehouseStock - p.systemStock;
                        return diff > 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)';
                    }),
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const product = stockDiffProducts[context.dataIndex];
                                return `Fark: ${product.stockDiff} adet (Depo: ${product.warehouseStock}, Sistem: ${product.systemStock})`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 0
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    renderTopProductsTables(products) {
        if (this._financeVisualAnalyticsDisabled) return;
        if (!products || products.length === 0) return;

        const topProfitTable = document.getElementById('topProfitProductsTable');
        const topLossTable = document.getElementById('topLossProductsTable');

        // Top 10 Profit Products
        if (topProfitTable) {
            const profitProducts = products
                .filter(p => p.difference > 0)
                .sort((a, b) => b.difference - a.difference)
                .slice(0, 10);

            if (profitProducts.length === 0) {
                topProfitTable.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-gray-500 text-sm">Kar eden ürün bulunamadı</td></tr>';
            } else {
                topProfitTable.innerHTML = profitProducts.map((product, index) => `
                    <tr class="hover:bg-green-50 transition-colors">
                        <td class="py-2 px-2">
                            <div class="flex items-center space-x-2">
                                <span class="text-green-600 font-bold text-xs">#${index + 1}</span>
                                <span class="text-gray-900 font-medium text-xs">${product.productName.length > 30 ? product.productName.substring(0, 30) + '...' : product.productName}</span>
                            </div>
                        </td>
                        <td class="py-2 px-2 text-right">
                            <span class="text-green-700 font-bold text-sm">${this.formatCurrency(product.difference)}</span>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // Top 10 Loss Products
        if (topLossTable) {
            const lossProducts = products
                .filter(p => p.difference < 0)
                .sort((a, b) => a.difference - b.difference)
                .slice(0, 10);

            if (lossProducts.length === 0) {
                topLossTable.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-gray-500 text-sm">Zarar eden ürün bulunamadı</td></tr>';
            } else {
                topLossTable.innerHTML = lossProducts.map((product, index) => `
                    <tr class="hover:bg-red-50 transition-colors">
                        <td class="py-2 px-2">
                            <div class="flex items-center space-x-2">
                                <span class="text-red-600 font-bold text-xs">#${index + 1}</span>
                                <span class="text-gray-900 font-medium text-xs">${product.productName.length > 30 ? product.productName.substring(0, 30) + '...' : product.productName}</span>
                            </div>
                        </td>
                        <td class="py-2 px-2 text-right">
                            <span class="text-red-700 font-bold text-sm">${this.formatCurrency(product.difference)}</span>
                        </td>
                    </tr>
                `).join('');
            }
        }
    }
}

// Global instance
window.countingSystem = new CountingSystem();

/** Konsol: await testBarkod('8690103292390') */
window.testBarkod = (barcode) => window.countingSystem.inspectProductByBarcode(barcode);
window.testAPIRequest = window.testBarkod;

