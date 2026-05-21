// Counting System for Stock Management

/** Alt kategori listesi — tablo oluşturma combobox için */
const COUNTING_SUBCATEGORIES = [
    "Ağız Bakım","Ağda & Tüy Dökücü","Ayran & Kefir","Baharat","Bakliyat",
    "Bal & Reçel","Balık & Deniz Ürünleri","Bar","Bebek Bakım","Bebek Bezi",
    "Beyaz Et","Beyaz Peynir","Biberon & Emzik","Bisküvi","Böcek İlacı",
    "Bulaşık","Bulgur","Buz","Çamaşır","Çamaşır &Temizlik","Çay",
    "Çiğ Köfte & Meze","Çikolata Bar","Çocuklara Özel","Çorba","Çubuk",
    "Çoklu","Cips","Deodorant","Demirbaş Ürünler","Dergi","Diğer",
    "Donuk Et & Tavuk & Balık","Donuk Hazır Yemek & Atıştırmalık",
    "Donuk Meyve Sebze","Donuk Pasta & Tatlı","Donuk Unlu Mamüller",
    "Dondurma Paketleri","Duş & Banyo","EkipmanÜrün","Elektrik & Aydınlatma",
    "Enerji İçeceği","Fit & Form","Fonksiyonel İçecekler","Gazlı İçecek",
    "Genel Sağlık","Giyim","Glutensiz","Gofret","Hazır Yemek","Helva",
    "Hijyenik Ped","Islak Havlu","İthal Peynir","Jel","Kağıt Ürünleri",
    "Kahvaltılık Gevrek","Kahve","Kaşar & Tost Peyniri","Kedi","Kek",
    "Kırmızı Et","Kırtasiye","Kolini Hazırla","Kolonya","Konserve","Köpek",
    "Kozmetik","Kraker & Kurabiye","Krema & Kaymak","Kuruyemiş","Kutu",
    "Külah","Maden Suyu","Makarna","Mama","Margarin","Meyve","Meyve Suyu",
    "Mutfak","Mutfak Ürünleri","Oda Kokusu","Oyun & Oyuncak","Paketli Ekmek",
    "Parti Malzemeleri","Pasta Malzemeleri","Pastörize Süt",
    "Patlamış Mısır ve Tahıl Patlağı","Paylaşımlık & Draje","Piknik","Pil",
    "Pirinç","Poşet","Prezervatif","Sabun","Saç Bakım","Saç Boyası",
    "Sakız & Şekerleme","Salça","Sandviç","Sarf Malzeme","Sebze",
    "Seyahat Ürünleri","Sıvı Yağ","Sirke & Salata Sosu","Sos","Soğuk Çay",
    "Soğuk Kahve","Soğutucu Dolap","Su","Süt & Salep","Sütlü Tatlı",
    "Sürülebilir","Sürülebilir Peynir","Şarj Aleti & Kablo","Şarküteri",
    "Şeker","Tahin & Pekmez","Tablet Çikolata","Tatlı","Taze Fırın",
    "Taze Yemek","Teknoloji","Temizlik","Tereyağı","Ton Balığı",
    "Tıraş Malzemeleri","Turşu","Un","Unlu Mamüller","Uzun Ömürlü Süt",
    "Vegan","Vücut & El Bakım","Yeşillik","Yoğurt","Yöresel Peynir",
    "Yumurta","Zeytin","Zeytinyağı"
];

class CountingSystem {
    constructor() {
        this.countingData = {}; // { productId: { warehouseStock, systemStock, lastUpdated, history } }
        this.allProducts = []; // All available products
        this.currentUser = null;
        this.STORAGE_KEY = 'counting_data';
        this.currentTableName = 'Ana Sayım'; // Aktif sayım tablosu
        this.currentSort = null; // { field: 'productName', direction: 'asc' } or null
        this.lastTokenCheckTime = null; // Son token kontrol zamanı (gereksiz çağrıları önlemek için)
        this.lastTokenExpiry = null; // Son kontrol edilen token expiry (değişiklik tespiti için)
        this.isTokenUpdateInProgress = false; // Token güncelleme devam ediyor mu? (çoklu çağrıları önlemek için)
        this.currentViewMode = 'rapid'; // Her sayfa açılışında Grid (rapid) öncelik; kullanıcı o an değiştirebilir
        this.currentCountingProduct = null; // Açık modal'daki ürün ID
        this.skippedProducts = new Set(); // Atlanan ürün ID'leri
        this.autoSaveTimeout = null; // Otomatik kaydetme için timeout
        const _savedTab = localStorage.getItem('counting_active_tab') || 'sayim';
        this.currentTab = ['sayim', 'finans', 'stokfark'].includes(_savedTab) ? _savedTab : 'sayim'; // 'sayim' | 'finans' | 'stokfark'
        /** Stok farkı sekmesi: seçili tablo adları (varsayılan tümü, ilk açılışta doldurulur) */
        this._farkTableSelection = null;
        /** Önceki tablo listesi — yalnızca yeni eklenen tablolar otomatik seçilir (kullanıcı iptalini ezmez) */
        this._farkTableNamesSnapshot = null;
        this.selectedFinancialTable = 'all'; // Seçili finans tablosu ('all' veya table name)
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
        /** Per-product debounce timers: { productId: timeoutId } */
        this._productSaveTimers = {};
        /** counting_items tablosu mevcut mu? (yoksa eski blob yoluna düş) */
        this._countingItemsTableReady = null; // null=bilinmiyor, true/false
    }

    async init() {
        try {
            // Get current user
            const session = window.authUtils?.checkAuth();
            if (!session) {
                throw new Error('User not authenticated');
            }
            this.currentUser = session;
            
            // Load all products
            await this.loadProducts();
            
            // Load counting data
            await this.loadCountingData();
            
            // Her gelişte Grid mod öncelik (localStorage okunmaz)
            this.currentViewMode = 'rapid';
            
            // Setup event listeners
            this.setupEventListeners();
            this.bindSayimSubTabControls();
            this.bindSayimTableCardMenu();
            this.bindSayimGeneralTableDropdown();
            this.bindSayimGeneralTableScrollRestore();
            this.initDailyDateControls();

            // Setup tab system
            this.setupTabSystem();
            this.bindSayimAuditLogPanel();
            
            // Render based on current tab
            if (this.currentTab === 'finans') {
                this.renderFinancialTab();
            } else if (this.currentTab === 'stokfark') {
                void this.renderFarkTab();
            } else {
                // Render table (will render grid if mode is rapid)
            this.renderTable();
                // Update view mode display after render
                this.updateViewMode();
            }
            
            // Update statistics
            this.updateStatistics();
            
            // Update table selector
            this.updateTableSelector();
            this.scheduleScrollActiveGeneralTableChip();
            
            this.syncDeleteTableButtonsVisibility();
            
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

            // Sayfa görünür olunca aktif tabloyu force refresh et (realtime kaçırılan güncellemeler için güvenlik ağı)
            this._setupVisibilityRefresh();

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

    async loadCountingData() {
        try {
            // ── 1. Meta blob'u yükle (users.counting_data — sadece api_info + auditLog + tableMeta) ──
            let metaBlob = null;
            if (window.supabase && this.currentUser) {
                const { data, error } = await window.supabase
                    .from('users')
                    .select('counting_data')
                    .eq('username', this.currentUser.username)
                    .maybeSingle();
                if (!error && data && data.counting_data) {
                    metaBlob = data.counting_data;
                }
            }
            // localStorage yedek — hem meta hem tam blob olabilir
            if (!metaBlob) {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    try { metaBlob = JSON.parse(stored); } catch (e) { /* ignore */ }
                }
            }
            if (metaBlob) {
                metaBlob = this.migrateToNestedStructure(metaBlob);
            }

            // ── 2. counting_items tablosundan ürünleri çek ──
            let itemRows = null;
            let countingItemsAvailable = false;
            if (window.supabase && this.currentUser) {
                try {
                    const { data: rows, error: rowErr } = await window.supabase
                        .from('counting_items')
                        .select('table_name, product_id, warehouse_stock, system_stock, price, price_text, reserved_stock, history, api_fetch_failed, last_updated')
                        .eq('username', this.currentUser.username);
                    if (!rowErr) {
                        itemRows = rows || [];
                        countingItemsAvailable = true;
                        this._countingItemsTableReady = true;
                        console.log(`📦 counting_items yüklendi: ${itemRows.length} ürün`);
                    } else {
                        // Tablo henüz yok — eski blob yoluna düş
                        this._countingItemsTableReady = false;
                        console.warn('⚠️ counting_items tablosu bulunamadı, eski blob yöntemi kullanılıyor:', rowErr.message);
                    }
                } catch (e) {
                    this._countingItemsTableReady = false;
                }
            }

            // ── 3. Tabloları inşa et ──
            const tables = {};

            if (countingItemsAvailable) {
                // counting_items'tan ürün verilerini yükle
                for (const row of itemRows) {
                    if (!tables[row.table_name]) tables[row.table_name] = {};
                    tables[row.table_name][row.product_id] = {
                        warehouseStock: row.warehouse_stock ?? null,
                        systemStock: row.system_stock ?? null,
                        price: row.price ?? null,
                        priceText: row.price_text ?? null,
                        reservedStock: row.reserved_stock ?? null,
                        history: row.history || [],
                        apiFetchFailed: row.api_fetch_failed || false,
                        lastUpdated: row.last_updated || new Date().toISOString(),
                    };
                }

                // Tablo meta verilerini (sıra, createdAt) ekle
                const tableMeta = metaBlob?._tableMeta || {};
                for (const [tName, meta] of Object.entries(tableMeta)) {
                    if (!tables[tName]) tables[tName] = {};
                    if (meta.createdAt) {
                        if (!tables[tName]._tableMeta) tables[tName]._tableMeta = {};
                        tables[tName]._tableMeta.createdAt = meta.createdAt;
                    }
                    if (Array.isArray(meta._productOrder)) {
                        tables[tName]._productOrder = meta._productOrder;
                    }
                }

                // ── 3a. Eski blob'dan eksik ürünleri kurtarma (counting_items'ta olmayan ürünler) ──
                // Bu kritik güvenlik adımıdır: counting_items INSERT başarısız olduysa
                // veya henüz migrate edilmediyse, tam blob'daki ürünleri kullan.
                if (metaBlob?._tables) {
                    for (const [tName, tData] of Object.entries(metaBlob._tables)) {
                        if (!tables[tName]) tables[tName] = {};
                        // counting_items'ta olmayan ürünleri blob'dan al (kayıp ürün kurtarma)
                        for (const [pId, pData] of Object.entries(tData)) {
                            if (this.isReservedCountingKey(pId) || typeof pData !== 'object' || !pData) continue;
                            if (!tables[tName][pId]) {
                                // Bu ürün counting_items'ta yok → blob'dan al
                                tables[tName][pId] = { ...pData };
                            }
                        }
                        // Meta verilerini de tamamla
                        if (!tables[tName]._tableMeta && tData._tableMeta) {
                            tables[tName]._tableMeta = tData._tableMeta;
                        }
                        if (!tables[tName]._productOrder && Array.isArray(tData._productOrder)) {
                            tables[tName]._productOrder = [...tData._productOrder];
                        }
                    }
                }

                // ── 3b. Mevcut ürünleri migration ettirme: eski blob'da ürün var, counting_items boş ──
                if (itemRows.length === 0 && metaBlob?._tables) {
                    // Async migration: blob → counting_items (performans için arka planda)
                    this._migrateOldDataToCountingItems(metaBlob).catch(() => {});
                }
            } else {
                // counting_items yok → eski blob yöntemi (fallback)
                if (metaBlob?._tables && Object.keys(metaBlob._tables).length > 0) {
                    // Eski tam blob: _tables içinde ürünler var
                    for (const [tName, tData] of Object.entries(metaBlob._tables)) {
                        tables[tName] = { ...tData };
                    }
                } else if (metaBlob?._tableMeta) {
                    // Yeni meta-only format ama counting_items yoksa: tablo listesini _tableMeta'dan çıkar
                    // Ürünler localStorage'da olabilir
                    for (const [tName, meta] of Object.entries(metaBlob._tableMeta)) {
                        if (!tables[tName]) {
                            tables[tName] = {};
                            if (meta?.createdAt) tables[tName]._tableMeta = { createdAt: meta.createdAt };
                            if (Array.isArray(meta?._productOrder)) tables[tName]._productOrder = meta._productOrder;
                        }
                    }
                }
            }

            // ── 4. cachedFullData oluştur ──
            const fullData = {
                _api_info: metaBlob?._api_info || {},
                _auditLog: metaBlob?._auditLog || [],
                _tableMeta: metaBlob?._tableMeta || {},
                _tables: tables,
            };

            if (Object.keys(tables).length === 0) {
                tables['Ana Sayım'] = {};
                fullData._tableMeta['Ana Sayım'] = { createdAt: new Date().toISOString() };
            }

            this.cachedFullData = fullData;

            // ── 5. Aktif tabloyu belirle ──
            const deviceTable = this._loadDeviceCurrentTable();
            const serverTable = metaBlob?._currentTable;
            let resolvedTable = deviceTable || serverTable || 'Ana Sayım';
            if (!tables[resolvedTable]) {
                resolvedTable = Object.keys(tables)[0] || 'Ana Sayım';
            }
            this.currentTableName = resolvedTable;
            this._saveDeviceCurrentTable(resolvedTable);

            if (!tables[this.currentTableName]) tables[this.currentTableName] = {};
            this.countingData = tables[this.currentTableName];

            this.auditLog = Array.isArray(fullData._auditLog)
                ? fullData._auditLog.slice(-this.AUDIT_LOG_MAX)
                : [];

            console.log('✅ loadCountingData tamamlandı, tablo:', this.currentTableName);
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
            await window.supabase.from('counting_items').upsert(rows.slice(i, i + CHUNK), { onConflict: 'username,table_name,product_id' });
        }
        console.log(`🔄 Migration tamamlandı: ${rows.length} ürün counting_items'a taşındı`);
    }

    // Migrate old structure to new nested structure
    migrateToNestedStructure(data) {
        // Zaten yeni yapıda (_tables mevcut)
        if (data._tables) {
            return data;
        }

        // Yeni meta-only format: _tableMeta var ama _tables yok
        // Bu formatı boş _tables ile döndür — ürün verisi counting_items'tan gelir
        if (data._tableMeta && !data._tables) {
            return { ...data, _tables: {} };
        }

        // Eski format: ürün ID'leri doğrudan üst düzeyde
        const migrated = {
            _api_info: data._api_info || {},
            _tables: {},
            _currentTable: 'Ana Sayım'
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

        return migrated;
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
        const tables = this.cachedFullData?._tables || {};
        // Aktif tablonun en güncel halini yaz
        if (this.currentTableName && this.countingData) {
            tables[this.currentTableName] = this.countingData;
        }
        const tableMeta = {};
        for (const [tName, tData] of Object.entries(tables)) {
            tableMeta[tName] = {
                createdAt: tData._tableMeta?.createdAt || null,
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
        }, 3000);
    }

    async _writeFullBlobToSupabase() {
        if (!window.supabase || !this.currentUser) return;
        try {
            const fullBlob = this._buildFullBlob();
            fullBlob._writerDeviceId = this.deviceId;
            fullBlob._writerAt = Date.now();
            await window.supabase
                .from('users')
                .update({ counting_data: fullBlob })
                .eq('username', this.currentUser.username);
        } catch (e) { /* ignore */ }
    }

    /** Tüm tablolardan meta bilgisini (createdAt, _productOrder) çıkarır */
    _buildMetaBlob() {
        if (!this.auditLog) this.auditLog = [];
        const tableMeta = {};
        const tables = this.cachedFullData?._tables || {};
        for (const [tName, tData] of Object.entries(tables)) {
            tableMeta[tName] = {
                createdAt: tData._tableMeta?.createdAt || null,
                _productOrder: Array.isArray(tData._productOrder) ? [...tData._productOrder] : [],
            };
        }
        return {
            _api_info: this.cachedFullData?._api_info || {},
            _auditLog: this.auditLog.slice(-this.AUDIT_LOG_MAX),
            _tableMeta: tableMeta,
        };
    }

    /** Tam blobu Supabase + localStorage'a yazar. */
    async _saveFullBlobLegacy(fullData) {
        try {
            if (!fullData._tables) fullData._tables = {};
            fullData._tables[this.currentTableName] = this.countingData;
            if (!this.auditLog) this.auditLog = [];
            fullData._auditLog = this.auditLog.slice(-this.AUDIT_LOG_MAX);
            // Echo filtresi için: bu cihazın yazdığını işaretle
            fullData._writerDeviceId = this.deviceId;
            fullData._writerAt = Date.now();
            this.cachedFullData = fullData;

            if (window.supabase && this.currentUser) {
                const { error } = await window.supabase
                    .from('users')
                    .update({ counting_data: fullData })
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
        try {
            if (!this.cachedFullData) {
                this.cachedFullData = { _api_info: {}, _tables: {} };
            }
            if (!this.cachedFullData._tables) this.cachedFullData._tables = {};
            this.cachedFullData = this.migrateToNestedStructure(this.cachedFullData);
            this.ensureTableMeta(this.countingData);
            this.cachedFullData._tables[this.currentTableName] = this.countingData;
            await this.saveFullCountingData(this.cachedFullData);
        } catch (error) {
            console.error('Error saving counting data:', error);
            try {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                const fallback = {
                    _api_info: {},
                    _tables: { [this.currentTableName]: this.countingData },
                };
                localStorage.setItem(storageKey, JSON.stringify(fallback));
            } catch (e) { /* ignore */ }
        }
    }

    /** scheduleSave: meta + ürünler için genel debounce (eski yöntem uyumu) */
    scheduleSave(delay = 500) {
        if (this._saveDebounceTimer) clearTimeout(this._saveDebounceTimer);
        this._saveDebounceTimer = setTimeout(() => {
            this._saveDebounceTimer = null;
            this.saveCountingData().catch(e => console.error('scheduleSave error:', e));
        }, delay);
    }

    /**
     * Tek bir ürünü counting_items tablosuna upsert eder.
     * counting_items hazır değilse eski blob yöntemine düşer.
     */
    async saveProductEntry(productId) {
        if (!productId || this.isReservedCountingKey(productId)) return;
        const entry = this.countingData[productId];
        if (!entry || typeof entry !== 'object') return;

        if (this._countingItemsTableReady !== true) {
            // counting_items yok: eski blob yöntemi
            this.scheduleSave(400);
            return;
        }

        try {
            const { error } = await window.supabase.from('counting_items').upsert({
                username: this.currentUser.username,
                table_name: this.currentTableName,
                product_id: productId,
                warehouse_stock: entry.warehouseStock ?? null,
                system_stock: entry.systemStock ?? null,
                price: entry.price ?? null,
                price_text: entry.priceText ?? null,
                reserved_stock: entry.reservedStock ?? null,
                history: entry.history || [],
                api_fetch_failed: entry.apiFetchFailed || false,
                updated_by: this.deviceId,
                last_updated: entry.lastUpdated || new Date().toISOString(),
            }, { onConflict: 'username,table_name,product_id' });
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
        if (this._productSaveTimers[productId]) {
            clearTimeout(this._productSaveTimers[productId]);
        }
        this._productSaveTimers[productId] = setTimeout(() => {
            delete this._productSaveTimers[productId];
            // saveProductEntry: counting_items'a yazar (hızlı) VEYA scheduleSave tetikler (tam blob)
            // _saveMetaOnly burada çağrılmıyor: meta-only yazarak tam blob'u ezmesin.
            // _scheduleFullBackup, saveProductEntry içinden otomatik tetiklenir.
            this.saveProductEntry(productId).catch(e => console.error('_scheduleProductSave error:', e));
        }, delay);
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
     * Sayfa görünür olunca / pencere fokus alınca / periyodik olarak aktif tabloyu Supabase'den force fetch eder.
     * Realtime kaçırırsa veya kurulmazsa güvenlik ağı görevi görür.
     */
    _setupVisibilityRefresh() {
        let lastRefresh = 0;
        const REFRESH_COOLDOWN_MS = 5000;

        const tryRefresh = () => {
            if (document.visibilityState !== 'visible') return;
            const now = Date.now();
            if (now - lastRefresh < REFRESH_COOLDOWN_MS) return;
            lastRefresh = now;
            this.refreshCurrentTableFromSupabase().catch(() => {});
            // Aynı zamanda tüm tabloların metasını da senkronize et (yeni tablo eklenmiş olabilir)
            this._refreshAllTablesMetaFromSupabase().catch(() => {});
        };

        document.addEventListener('visibilitychange', tryRefresh);
        window.addEventListener('focus', tryRefresh);

        // Periyodik fallback (sayfa açıkken her 20 sn'de bir hafif kontrol)
        this._periodicRefreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                tryRefresh();
            }
        }, 20000);
    }

    /**
     * Tüm tabloların listesini ve ürün sayılarını Supabase'den senkronize eder.
     * Yeni tablolar veya başka cihazlardan gelen ürün ekleme/silme'yi yakalar.
     * Sıralama bozulmaması için tablo createdAt'ı her zaman users.counting_data._tableMeta'dan alınır.
     */
    async _refreshAllTablesMetaFromSupabase() {
        if (!window.supabase || !this.currentUser) return;
        if (this._countingItemsTableReady !== true) return;

        try {
            // PARALEL: counting_items + users.counting_data — biri ürünler için, diğeri _tableMeta için
            const [itemsRes, userRes] = await Promise.all([
                window.supabase
                    .from('counting_items')
                    .select('table_name, product_id, warehouse_stock, system_stock, price, price_text, reserved_stock, history, api_fetch_failed, last_updated, created_at')
                    .eq('username', this.currentUser.username),
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
                tablesByName[row.table_name][row.product_id] = {
                    warehouseStock: row.warehouse_stock ?? null,
                    systemStock: row.system_stock ?? null,
                    price: row.price ?? null,
                    priceText: row.price_text ?? null,
                    reservedStock: row.reserved_stock ?? null,
                    history: row.history || [],
                    apiFetchFailed: row.api_fetch_failed || false,
                    lastUpdated: row.last_updated || new Date().toISOString(),
                };
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
                        _productOrder: Array.isArray(meta?._productOrder) ? [...meta._productOrder] : [],
                    };
                }
            }

            let metaChanged = false;
            for (const [tName, products] of Object.entries(tablesByName)) {
                if (!this.cachedFullData._tables[tName]) {
                    this.cachedFullData._tables[tName] = { ...products };
                    const createdAt = resolveCreatedAt(tName);
                    if (!this.cachedFullData._tableMeta[tName]) {
                        this.cachedFullData._tableMeta[tName] = {
                            createdAt,
                            _productOrder: Object.keys(products),
                        };
                    }
                    // Tablo objesi içine de createdAt yansıt (resolveTableCreatedMs için)
                    this.cachedFullData._tables[tName]._tableMeta = { createdAt };
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

        try {
            // 1. Aktif tablonun tüm ürünlerini çek
            const { data: rows, error } = await window.supabase
                .from('counting_items')
                .select('product_id, warehouse_stock, system_stock, price, price_text, reserved_stock, history, api_fetch_failed, last_updated')
                .eq('username', this.currentUser.username)
                .eq('table_name', this.currentTableName);
            if (error) return;

            const incomingMap = {};
            for (const row of (rows || [])) {
                incomingMap[row.product_id] = {
                    warehouseStock: row.warehouse_stock ?? null,
                    systemStock: row.system_stock ?? null,
                    price: row.price ?? null,
                    priceText: row.price_text ?? null,
                    reservedStock: row.reserved_stock ?? null,
                    history: row.history || [],
                    apiFetchFailed: row.api_fetch_failed || false,
                    lastUpdated: row.last_updated || new Date().toISOString(),
                };
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
                        localTable[pId] = incoming;
                        this.countingData[pId] = incoming;
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
        if (!payload || !payload.new) return;
        const item = payload.new;

        // Bu cihazın kendi kaydı ise yoksay (echo)
        if (item.updated_by === this.deviceId) return;

        const tName = item.table_name;
        const pId = item.product_id;

        if (!this.cachedFullData) return;
        if (!this.cachedFullData._tables) this.cachedFullData._tables = {};
        if (!this.cachedFullData._tableMeta) this.cachedFullData._tableMeta = {};
        if (!this.cachedFullData._tables[tName]) {
            // Realtime'da yeni tablo geliyor — createdAt'ı item.created_at'tan al (sıralama için kritik)
            const createdAt = item.created_at || new Date().toISOString();
            this.cachedFullData._tables[tName] = { _tableMeta: { createdAt } };
            if (!this.cachedFullData._tableMeta[tName]) {
                this.cachedFullData._tableMeta[tName] = { createdAt, _productOrder: [] };
            }
            this._scheduleTableSelectorUpdate();
        }

        if (payload.eventType === 'DELETE') {
            delete this.cachedFullData._tables[tName][pId];
            if (tName === this.currentTableName) {
                delete this.countingData[pId];
                this.scheduleRenderTable();
                this.updateStatistics();
            }
        } else {
            const productData = {
                warehouseStock: item.warehouse_stock ?? null,
                systemStock: item.system_stock ?? null,
                price: item.price ?? null,
                priceText: item.price_text ?? null,
                reservedStock: item.reserved_stock ?? null,
                history: item.history || [],
                apiFetchFailed: item.api_fetch_failed || false,
                lastUpdated: item.last_updated || new Date().toISOString(),
            };
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

        // ── Echo filtresi: bu cihazın kendi yazdığı blob ise yoksay ──
        if (incoming._writerDeviceId && incoming._writerDeviceId === this.deviceId) {
            return;
        }

        if (!this.cachedFullData) this.cachedFullData = { _tables: {} };
        if (!this.cachedFullData._tables) this.cachedFullData._tables = {};

        // api_info güncelle
        if (incoming._api_info) this.cachedFullData._api_info = incoming._api_info;

        // auditLog merge: daha uzun olan korunur
        if (Array.isArray(incoming._auditLog) &&
            incoming._auditLog.length > (this.auditLog?.length || 0)) {
            this.auditLog = incoming._auditLog.slice(-this.AUDIT_LOG_MAX);
            this.cachedFullData._auditLog = this.auditLog;
        }

        let tablesChanged = false;

        // ── Tabloları MERGE et (silme yok, sadece ekleme/birleştirme) ──
        if (incoming._tables && typeof incoming._tables === 'object') {
            for (const [tName, incomingTableData] of Object.entries(incoming._tables)) {
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

                // Meta birleştir (createdAt + productOrder)
                if (incomingTableData._tableMeta && !localTable._tableMeta) {
                    localTable._tableMeta = { ...incomingTableData._tableMeta };
                }
                // _productOrder: INCOMING kazanır (yazıcı son sırayı bilir).
                // Yereldeki ekstra ID'ler sona eklenir (silinmesin diye).
                if (Array.isArray(incomingTableData._productOrder)) {
                    const incomingOrder = incomingTableData._productOrder;
                    const incomingSet = new Set(incomingOrder);
                    const localOrder = Array.isArray(localTable._productOrder) ? localTable._productOrder : [];
                    const extras = localOrder.filter((id) => !incomingSet.has(id));
                    localTable._productOrder = [...incomingOrder, ...extras];
                    // Aktif tablo ise countingData._productOrder'ı da güncelle
                    if (tName === this.currentTableName) {
                        this.countingData._productOrder = [...localTable._productOrder];
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
            }
            this.cachedFullData._tableMeta = currentMeta;
        }

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
    async switchTable(tableName) {
        if (!tableName || tableName === this.currentTableName) {
            return;
        }

        // Pending per-product timer'larını flush et
        for (const [pId, timer] of Object.entries(this._productSaveTimers)) {
            clearTimeout(timer);
            delete this._productSaveTimers[pId];
            await this.saveProductEntry(pId).catch(() => {});
        }
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
            this._saveDebounceTimer = null;
        }

        const fullData = this.cachedFullData || { _api_info: {}, _tables: {} };
        if (!fullData._tables) fullData._tables = {};

        this.currentTableName = tableName;
        this._saveDeviceCurrentTable(tableName);

        // counting_items mevcutsa ve tablo henüz bellekte yoksa yükle
        if (this._countingItemsTableReady === true && !fullData._tables[tableName]) {
            const { data: rows } = await window.supabase
                .from('counting_items')
                .select('product_id, warehouse_stock, system_stock, price, price_text, reserved_stock, history, api_fetch_failed, last_updated')
                .eq('username', this.currentUser.username)
                .eq('table_name', tableName);
            fullData._tables[tableName] = {};
            const tMeta = fullData._tableMeta?.[tableName];
            if (tMeta?.createdAt) fullData._tables[tableName]._tableMeta = { createdAt: tMeta.createdAt };
            if (tMeta?._productOrder) fullData._tables[tableName]._productOrder = tMeta._productOrder;
            for (const row of (rows || [])) {
                fullData._tables[tableName][row.product_id] = {
                    warehouseStock: row.warehouse_stock ?? null,
                    systemStock: row.system_stock ?? null,
                    price: row.price ?? null,
                    priceText: row.price_text ?? null,
                    reservedStock: row.reserved_stock ?? null,
                    history: row.history || [],
                    apiFetchFailed: row.api_fetch_failed || false,
                    lastUpdated: row.last_updated || new Date().toISOString(),
                };
            }
        } else if (!fullData._tables[tableName]) {
            fullData._tables[tableName] = {
                _tableMeta: { createdAt: new Date().toISOString() }
            };
        }

        this.countingData = fullData._tables[tableName];
        this.cachedFullData = fullData;
        await this._saveMetaOnly();

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

        // Re-render UI
        this.renderTable();
        this.updateStatistics();
        this.updateTableSelector();
        this.scrollActiveGeneralTableChipIntoView({ behavior: 'auto' });
        this.syncSayimSubTabToTable();
    }

    // ─────────────────────────────────────────────────────────────
    // Tablo oluşturma combobox yardımcıları
    // ─────────────────────────────────────────────────────────────

    /** Combobox'u ilk kez / modal her açıldığında kur */
    _setupCreateTableCombobox() {
        const input = document.getElementById('newTableNameInput');
        const dropdown = document.getElementById('tableNameDropdown');
        const chevron = document.getElementById('tableNameChevron');
        const toggleBtn = document.getElementById('tableNameToggleBtn');
        const confirmBtn = document.getElementById('confirmCreateTableBtn');
        const hint = document.getElementById('tableNameHint');
        if (!input || !dropdown) return;

        const closeDropdown = () => {
            dropdown.classList.add('hidden');
            if (chevron) chevron.style.transform = '';
            input._dropdownOpen = false;
        };
        const openDropdown = () => {
            this._renderTableNameDropdown(input.value);
            dropdown.classList.remove('hidden');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
            input._dropdownOpen = true;
        };
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

        const updateHint = () => {
            const val = input.value.trim();
            if (confirmBtn) confirmBtn.disabled = !val;
            if (!hint) return;
            if (!val) {
                hint.textContent = 'Listeden seçin veya özel isim yazın';
                hint.className = 'mt-1.5 text-xs text-gray-400';
            } else {
                const already = this.getTableList().find(t => t.name === val);
                hint.textContent = already
                    ? `"${val}" zaten mevcut — seçince o tabloya geçilir`
                    : `"${val}" oluşturulabilir`;
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
            }
            updateHint();
        });

        // Dropdown item seçimi (event delegation)
        dropdown.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // overlay'e ulaşmasın
            const item = e.target.closest('[data-cat]');
            if (!item) return;
            e.preventDefault();
            const cat = item.dataset.cat;
            input.value = cat;
            updateHint();
            closeDropdown();
            input.focus();
        });

        // touch eventleri için de aynı koruma (mobil)
        dropdown.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        dropdown.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });

        // Dışarı tıklayınca kapat
        document.addEventListener('mousedown', (e) => {
            const wrap = document.getElementById('tableNameComboboxWrap');
            if (wrap && !wrap.contains(e.target)) closeDropdown();
        }, { capture: true });

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
                if (item) { item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
            }
        });
    }

    /** Dropdown listesini query'e göre yeniden çizer */
    _renderTableNameDropdown(query = '') {
        const dropdown = document.getElementById('tableNameDropdown');
        if (!dropdown) return;

        const q = query.trim().toLocaleLowerCase('tr');
        const existing = new Set(this.getTableList().map(t => t.name));

        const filtered = q
            ? COUNTING_SUBCATEGORIES.filter(c => c.toLocaleLowerCase('tr').includes(q))
            : COUNTING_SUBCATEGORIES;

        if (filtered.length === 0) {
            dropdown.innerHTML = `<div class="px-4 py-3 text-sm text-gray-400 text-center">Sonuç bulunamadı</div>`;
            return;
        }

        dropdown.innerHTML = filtered.map(cat => {
            const isExisting = existing.has(cat);
            const badge = isExisting
                ? `<span class="ml-auto text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">Mevcut</span>`
                : '';
            return `
                <button
                    type="button"
                    data-cat="${cat.replace(/"/g, '&quot;')}"
                    tabindex="-1"
                    class="w-full flex items-start gap-2 text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                >
                    <span class="flex-1 min-w-0 break-words leading-snug">${cat}</span>${badge}
                </button>`;
        }).join('');
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
        if (dropdown) dropdown.classList.add('hidden');
        if (chevron) chevron.style.transform = '';
        if (confirmBtn) confirmBtn.disabled = true;
        if (hint) {
            hint.textContent = 'Listeden seçin veya özel isim yazın';
            hint.className = 'mt-1.5 text-xs text-gray-400';
        }
    }

    // Create a new table
    async createTable(tableName, options = {}) {
        if (!tableName || tableName.trim() === '') {
            throw new Error('Tablo adı boş olamaz');
        }

        const trimmed = tableName.trim();
        if (!options.allowDaily && trimmed.startsWith(this.DAILY_TABLE_PREFIX)) {
            throw new Error('Bu isim günlük sayım için ayrılmıştır; genel tabloda kullanılamaz');
        }

        const fullData = this.cachedFullData || { _api_info: {}, _tables: {} };
        if (!fullData._tables) fullData._tables = {};

        if (fullData._tables[trimmed]) {
            throw new Error('Bu isimde bir tablo zaten mevcut');
        }

        const newTableMeta = { createdAt: new Date().toISOString() };
        fullData._tables[trimmed] = { _tableMeta: newTableMeta };
        if (!fullData._tableMeta) fullData._tableMeta = {};
        fullData._tableMeta[trimmed] = { createdAt: newTableMeta.createdAt, _productOrder: [] };

        this.currentTableName = trimmed;
        this._saveDeviceCurrentTable(trimmed);
        this.countingData = fullData._tables[trimmed];
        this.cachedFullData = fullData;

        this.pushAuditEntry(
            options.allowDaily
                ? `Günlük tablo oluşturuldu · ${this.formatTableDisplayName(trimmed)}`
                : `Tablo oluşturuldu · ${this.formatTableDisplayName(trimmed)}`,
            { cat: 'table', tbl: trimmed }
        );

        await this._saveMetaOnly();

        // Re-render UI
        this.renderTable();
        this.updateStatistics();
        this.updateTableSelector();
        this.syncSayimSubTabToTable();
    }

    // Delete a table
    async deleteTable(tableName) {
        if (!tableName) return;

        const fullData = this.cachedFullData || { _api_info: {}, _tables: {} };
        if (!fullData._tables) return;

        const tableNames = Object.keys(fullData._tables);
        if (tableNames.length <= 1) {
            throw new Error('En az bir tablo bulunmalıdır');
        }

        delete fullData._tables[tableName];
        if (fullData._tableMeta) delete fullData._tableMeta[tableName];

        this.pushAuditEntry(`Tablo silindi · ${this.formatTableDisplayName(tableName)}`, { cat: 'table', tbl: tableName });

        if (tableName === this.currentTableName) {
            const newTableName = Object.keys(fullData._tables)[0];
            this.currentTableName = newTableName;
            this._saveDeviceCurrentTable(newTableName);
            this.countingData = fullData._tables[newTableName] || {};
        }

        this.cachedFullData = fullData;

        // counting_items'tan bu tablonun tüm ürünlerini sil (async)
        this.deleteTableEntries(tableName).catch(() => {});
        await this._saveMetaOnly();

        // Re-render UI
        this.renderTable();
        this.updateStatistics();
        this.updateTableSelector();
        this.syncSayimSubTabToTable();
    }

    // Get list of all tables
    getTableList() {
        const fullData = this.cachedFullData;

        if (!fullData || !fullData._tables) {
            return [{ name: 'Ana Sayım', isCurrent: true }];
        }

        const tableNames = Object.keys(fullData._tables);
        const rows = tableNames.map((name) => {
            const tableData = fullData._tables[name] || {};
            const createdAtMs = this.resolveTableCreatedMs(tableData) ?? 0;
            const statusSummary = this.getTableStatusSummary(tableData);
            return {
                name,
                isCurrent: name === this.currentTableName,
                productCount: Object.keys(tableData).filter((k) => !this.isReservedCountingKey(k)).length,
                status: statusSummary.status,
                _sortMs: createdAtMs,
            };
        });
        rows.sort((a, b) => {
            if (b._sortMs !== a._sortMs) return b._sortMs - a._sortMs;
            return String(a.name).localeCompare(String(b.name), 'tr');
        });
        return rows.map(({ _sortMs, ...rest }) => rest);
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

            const priceRaw = data.price;
            let price = Number(priceRaw);
            if (!price || Number.isNaN(price)) {
                const product = this.productIndex?.get(pid);
                price = Number(product?.price);
            }
            if (!price || Number.isNaN(price)) continue;

            profitLoss += (Number(warehouseStock) - Number(systemStock)) * price;
        }

        return profitLoss;
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
        return `sayim-general-table-chip shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${base}${active}`;
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

    /** Tablo nesnesinde ürün dışı anahtarlar (metadata) */
    isReservedCountingKey(key) {
        return (
            key === '_api_info' ||
            key === '_tableMeta' ||
            key === '_productOrder' ||
            key === '_tables' ||
            key === '_currentTable'
        );
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
    applyImportedProductOrder(idsInPasteOrder) {
        if (!Array.isArray(idsInPasteOrder) || idsInPasteOrder.length === 0) return;
        const raw = Object.keys(this.countingData).filter((k) => !this.isReservedCountingKey(k));
        const pasteSet = new Set(idsInPasteOrder);
        const rest = raw.filter((id) => !pasteSet.has(id));
        this.countingData._productOrder = [...idsInPasteOrder, ...rest];
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

    /** Son sayım = ürünlerden en güncel lastUpdated */
    resolveLastCountActivityMs(tableData) {
        const { maxMs } = this.getProductLastUpdatedBounds(tableData);
        return maxMs;
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

    /** "2 saat önce" vb. */
    formatRelativeAgoTr(ms) {
        if (ms == null || Number.isNaN(ms)) return '';
        const diffSec = Math.floor((Date.now() - ms) / 1000);
        if (diffSec < 45) return 'az önce';
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk önce`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} saat önce`;
        if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} gün önce`;
        const weeks = Math.floor(diffSec / 604800);
        return `${weeks} hafta önce`;
    }

    updateActiveTableActivityLine() {
        const createdEl = document.getElementById('activeTableCreatedAt');
        const lastEl = document.getElementById('activeTableLastCount');
        const legacy = document.getElementById('activeTableActivityLine');

        const tableData = this.countingData;
        const createdMs = this.resolveTableCreatedMs(tableData);
        const lastMs = this.resolveLastCountActivityMs(tableData);

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
            return this.findProduct(String(row.name).trim());
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
            await this.ensureDailyTableForDate(iso);
        } catch (err) {
            this.showToast(err?.message || 'Tablo açılamadı', 'error', 4000);
            return;
        }
        await this.applyImportedRows(pending.items);
        this._pendingSayimDailyPaste = null;
        this.closeDailyAddModal();
    }

    async ensureDailyTableForDate(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            throw new Error('Geçersiz tarih');
        }
        const tableName = this.DAILY_TABLE_PREFIX + iso;
        const tables = this.getTableList();
        const exists = tables.some((t) => t.name === tableName);
        if (!exists) {
            await this.createTable(tableName, { allowDaily: true });
        } else {
            await this.switchTable(tableName);
        }
    }

    async applyImportedRows(rows) {
        let added = 0;
        let skipped = 0;
        const idsInPasteOrder = [];
        const seenPasteIds = new Set();
        // 1. Aşama: Hızlı önce yereldeki countingData yapısını hazırla (skipSave: true → counting_items'a yazmıyor)
        for (const row of rows) {
            const product = this.matchDailyImportRow(row);
            if (!product) {
                skipped++;
                continue;
            }
            if (!seenPasteIds.has(product.id)) {
                seenPasteIds.add(product.id);
                idsInPasteOrder.push(product.id);
            }
            this.addProductToCounting(product, { skipSave: true });
            if (
                row.quantity !== undefined &&
                row.quantity !== null &&
                this.countingData[product.id]
            ) {
                const q = Number(row.quantity);
                if (!Number.isNaN(q)) {
                    this.countingData[product.id].warehouseStock = q;
                    this.countingData[product.id].lastUpdated = new Date().toISOString();
                }
            }
            added++;
        }

        // 2. Aşama: Paste sırasını uygula (bu en kritik — _productOrder'ı yapıştırma sırasına göre yazar)
        this.applyImportedProductOrder(idsInPasteOrder);

        if (added > 0) {
            this.pushAuditEntry(
                `İçe aktarma · ${this.formatTableDisplayName(this.currentTableName)} · ${added} satır${
                    skipped ? ` · ${skipped} eşleşmedi` : ''
                }`,
                { cat: 'import', tbl: this.currentTableName }
            );
        }

        // 3. Aşama: Tam blob önce Supabase'e yaz (paste sırasını içerir, telefon doğru sırayı alır)
        await this.saveCountingData();

        // 4. Aşama: Her ürünü counting_items'a SIRAYLA yaz (paralel değil — sıralı yazımla Supabase created_at sırası korunur)
        if (this._countingItemsTableReady === true) {
            for (const productId of idsInPasteOrder) {
                if (this.countingData[productId]) {
                    await this.saveProductEntry(productId).catch(() => {});
                }
            }
        }
        this.renderTable();
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
        }
        this.updateStatistics();
        this.updateCountingProgress();
        this.updateTableSelector();
        this.syncSayimSubTabToTable();
        this.showToast(
            `${added} ürün işlendi${skipped ? `, ${skipped} satır eşleşmedi` : ''}`,
            added ? 'success' : 'warning',
            4000
        );
        return { added, skipped };
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
            await this.ensureDailyTableForDate(this.getDailySelectedIso());
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
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('role', 'listitem');
                btn.dataset.tableName = table.name;
                btn.dataset.tableStatus = status;
                btn.title = table.name;
                btn.className = this.getTableStatusChipClasses(status, isActive);
                btn.innerHTML = `
                    <span class="truncate max-w-[10rem]">${this.escapeHtml(table.name)}</span>
                    <span class="text-[10px] font-semibold ${this.getTableStatusCountBadgeClasses(status, isActive)}">${table.productCount ?? 0}</span>
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

        genBtn.addEventListener('click', () => go('general'));
        dailyBtn.addEventListener('click', () => go('daily'));

        let initial = 'general';
        try {
            const saved = sessionStorage.getItem('sayimSubTab');
            if (saved === 'daily' || saved === 'general') initial = saved;
        } catch (e) {
            /* ignore */
        }
        go(initial);
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
                const row = document.createElement('button');
                row.type = 'button';
                row.setAttribute('role', 'option');
                row.setAttribute('aria-selected', isActive ? 'true' : 'false');
                row.dataset.tableName = table.name;
                row.dataset.tableStatus = status;
                row.className = [
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors',
                    this.getTableStatusDropdownRowClasses(status, isActive),
                ].join(' ');
                row.innerHTML = `
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
    async saveAPIInfoToSupabase(apiInfo) {
        try {
            if (!window.supabase || !this.currentUser) {
                console.warn('⚠️ Supabase veya kullanıcı yok, API bilgileri kaydedilemedi');
                return; // Supabase veya kullanıcı yoksa kaydetme
            }

            // Mevcut counting_data'yı al
            const { data: userData, error: fetchError } = await window.supabase
                .from('users')
                .select('counting_data')
                .eq('username', this.currentUser.username)
                .maybeSingle();

            // Eğer kullanıcı bulunamadıysa veya counting_data yoksa, yeni oluştur
            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.warn('⚠️ Supabase counting_data okuma hatası:', fetchError);
                // Hata varsa devam et, yeni yapı oluşturacağız
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

            // Eğer counting_data yoksa veya yapısı bozuksa, yeni yapı oluştur
            if (!countingData || typeof countingData !== 'object') {
                countingData = {
                    _api_info: {},
                    _tables: {},
                    _currentTable: 'Ana Sayım'
                };
            }

            // _tables yoksa oluştur
            if (!countingData._tables || typeof countingData._tables !== 'object') {
                countingData._tables = {};
            }

            // Mevcut tablo yoksa varsayılan tabloyu oluştur
            if (!countingData._currentTable) {
                countingData._currentTable = 'Ana Sayım';
            }
            if (!countingData._tables[countingData._currentTable]) {
                countingData._tables[countingData._currentTable] = {};
            }

            // Mevcut API bilgilerini kontrol et (değişiklik tespiti için)
            const existingAPIInfo = countingData._api_info || {};
            const existingToken = existingAPIInfo.token ? (existingAPIInfo.token.startsWith('Bearer ') ? existingAPIInfo.token.substring(7).trim() : existingAPIInfo.token) : '';
            const newToken = apiInfo.token ? (apiInfo.token.startsWith('Bearer ') ? apiInfo.token.substring(7).trim() : apiInfo.token) : '';
            
            const hasChanged = 
                existingToken !== newToken ||
                existingAPIInfo.warehouseId !== apiInfo.warehouseId ||
                existingAPIInfo.tokenExpiry !== apiInfo.tokenExpiry;

            // API bilgilerini _api_info key'ine kaydet
            countingData._api_info = {
                token: apiInfo.token,
                warehouseId: apiInfo.warehouseId,
                warehouseName: apiInfo.warehouseName,
                tokenExpiry: apiInfo.tokenExpiry,
                baseUrl: apiInfo.baseUrl,
                stockEndpoint: apiInfo.stockEndpoint,
                lastUpdated: new Date().toISOString(),
                timestamp: apiInfo.timestamp || Date.now()
            };

            // Her zaman Supabase'e kaydet (kullanıcıya özel veri yapısını güncellemek için)
            const { error: updateError } = await window.supabase
                .from('users')
                .update({ counting_data: countingData })
                .eq('username', this.currentUser.username);

            if (updateError) {
                console.warn('⚠️ Supabase API bilgileri kayıt hatası:', updateError);
            } else {
                if (hasChanged) {
                    console.log('✅ API bilgileri Supabase\'e kaydedildi (counting_data._api_info)', {
                        username: this.currentUser.username,
                        warehouseId: apiInfo.warehouseId,
                        tokenLength: newToken.length,
                        tokenExpiry: apiInfo.tokenExpiry ? new Date(apiInfo.tokenExpiry).toLocaleString('tr-TR') : 'N/A',
                        changed: 'Token/Warehouse/Expiry güncellendi'
                    });
                } else {
                    console.log('✅ API bilgileri Supabase\'de mevcut (değişiklik yok)', {
                        username: this.currentUser.username,
                        warehouseId: apiInfo.warehouseId
                    });
                }
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

        // Sync stocks button
        const syncStocksBtn = document.getElementById('syncStocksBtn');
        if (syncStocksBtn) {
            syncStocksBtn.addEventListener('click', () => this.syncSystemStocks());
        }
        
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
                this.cameraScanAndCountMode = !!e.target.checked;
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
        const renameTableNameInput = document.getElementById('newTableNameInput');
        
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

        // Overlay tıklamasıyla kapat — dropdown açıkken kapanmaz
        if (createTableModal) {
            createTableModal.addEventListener('click', (e) => {
                if (e.target !== createTableModal) return;
                const dropdown = document.getElementById('tableNameDropdown');
                if (dropdown && !dropdown.classList.contains('hidden')) return;
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
                const renameInput = renameTableModal?.querySelector('#newTableNameInput');
                if (renameInput) renameInput.value = '';
            });
        }
        
        if (cancelRenameTableBtn) {
            cancelRenameTableBtn.addEventListener('click', () => {
                if (renameTableModal) renameTableModal.classList.add('hidden');
                const renameInput = renameTableModal?.querySelector('#newTableNameInput');
                if (renameInput) renameInput.value = '';
            });
        }
        
        if (confirmRenameTableBtn) {
            confirmRenameTableBtn.addEventListener('click', async () => {
                const renameInput = renameTableModal?.querySelector('#newTableNameInput');
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
                    const renameInput = renameTableModal.querySelector('#newTableNameInput');
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
                if (!this.currentCountingProduct) return;

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
                if (!this.currentCountingProduct) return;

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
                void this.closeCountingBottomSheet().catch((err) =>
                    console.error('closeCountingBottomSheet:', err)
                );
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
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
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value === '') value = '0';
                e.target.value = value;
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
                if (!this.currentCountingProduct) {
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

                // Disable button and show loading
                refreshSystemStockBtn.disabled = true;
                const originalHTML = refreshSystemStockBtn.innerHTML;
                refreshSystemStockBtn.innerHTML = '<div class="spinner" style="width: 8px; height: 8px; border: 1.5px solid #e5e7eb; border-top: 1.5px solid #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>';

                try {
                    const result = await this.requestStockFromExtension(null, barcode, this.currentCountingProduct, {});
                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    const price = typeof result === 'object' && result !== null ? result?.price : null;
                    const priceText = typeof result === 'object' && result !== null ? result?.priceText : null;
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
                            reserved
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
                    refreshSystemStockBtn.disabled = false;
                    refreshSystemStockBtn.innerHTML = originalHTML;
                    this.updateCorrectEntryButtonState();
                }
            });
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

        // Setup product image lightbox
        this.setupProductImageLightbox();

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
        const wrap = document.getElementById('farkTableCheckboxes');
        if (allBtn && !allBtn.dataset.bound) {
            allBtn.dataset.bound = '1';
            allBtn.addEventListener('click', () => {
                const names = this.getTableList().map((t) => t.name);
                this._farkTableSelection = new Set(names);
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
        const tables = this.getTableList();
        wrap.innerHTML = tables
            .map((row) => {
                const name = row.name;
                const enc = encodeURIComponent(name);
                const checked = this._farkTableSelection.has(name);
                const label = this.formatTableDisplayName(name);
                const cnt =
                    typeof row.productCount === 'number'
                        ? `<span class="text-slate-400 font-normal tabular-nums">(${row.productCount})</span>`
                        : '';
                const aria = String(label).replace(/"/g, '&quot;');
                return `
                    <label class="inline-flex cursor-pointer select-none items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50/90 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/35 has-[:checked]:shadow-md has-[:checked]:shadow-indigo-100/40">
                        <input type="checkbox" class="peer sr-only fark-table-cb" data-fark-table="${enc}" ${checked ? 'checked' : ''} aria-label="${aria}"/>
                        <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-slate-300 bg-white transition peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400/50 peer-checked:[&_svg]:opacity-100">
                            <svg class="h-3 w-3 text-white opacity-0 transition-opacity" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6l2.5 2.5L9.5 3"/></svg>
                        </span>
                        <span class="text-xs sm:text-sm font-medium text-slate-800">${this.escapeHtml(label)} ${cnt}</span>
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
            if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) {
                this.closeProductImageLightbox();
            }
        });
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

        const G = typeof window !== 'undefined' ? window.GetirCdnPaste : null;
        if (G && typeof G.extractGetirCdnProductImageUrlsFromText === 'function') {
            const urls = G.extractGetirCdnProductImageUrlsFromText(value);
            if (urls.length > 0) {
                await this.bulkAddProductsFromGetirCdnPaste(urls);
                if (input) input.value = '';
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
        input.value = '';
    }

    /**
     * Getir CDN ürün görsel URL listesi: eşleşen ürünleri tabloya ekler.
     * Yapıştırma sırası birebir korunur (mevcut ürünler de bu sıraya göre yeniden dizilir).
     * @param {string[]} urls
     */
    async bulkAddProductsFromGetirCdnPaste(urls) {
        const G = typeof window !== 'undefined' ? window.GetirCdnPaste : null;
        const findFn = G && typeof G.findProductByGetirImageUrl === 'function' ? G.findProductByGetirImageUrl : null;
        if (!findFn || !Array.isArray(urls) || urls.length === 0) {
            return { added: 0, skippedInTable: 0, noMatch: 0 };
        }

        const idsInPasteOrder = [];
        const seenInPaste = new Set();
        let skippedInTable = 0;
        let noMatch = 0;
        let addedCount = 0;

        for (let i = 0; i < urls.length; i++) {
            const product = findFn(this.allProducts, urls[i]);
            if (!product) {
                noMatch++;
                continue;
            }
            const wasInTable = !!this.countingData[product.id];
            if (!seenInPaste.has(product.id)) {
                seenInPaste.add(product.id);
                idsInPasteOrder.push(product.id);
            }
            if (!wasInTable) {
                this.addProductToCounting(product, { skipSave: true });
                addedCount++;
            } else {
                skippedInTable++;
            }
        }

        if (idsInPasteOrder.length === 0) {
            if (noMatch > 0 && skippedInTable === 0) {
                this.showToast('Bu görsel adresleriyle eşleşen ürün bulunamadı', 'warning', 4000);
            } else if (skippedInTable > 0) {
                const allDup = skippedInTable === urls.length && noMatch === 0;
                this.showToast(
                    allDup
                        ? 'Yapıştırılan ürünler zaten tabloda'
                        : `${skippedInTable} ürün zaten tablodaydı${noMatch ? ` · ${noMatch} eşleşmedi` : ''}`,
                    'info',
                    4500
                );
            }
            return { added: 0, skippedInTable, noMatch };
        }

        // Yapıştırma sırasını uygula (yeni + mevcut ürünler birlikte)
        this.applyImportedProductOrder(idsInPasteOrder);

        const tn = this.currentTableName || '';
        this.pushAuditEntry(
            `Getir görselleri · ${addedCount} yeni · ${idsInPasteOrder.length} sıralandı${
                skippedInTable ? ` · ${skippedInTable} zaten vardı` : ''
            }${noMatch ? ` · ${noMatch} eşleşmedi` : ''}`,
            { cat: 'import', tbl: tn }
        );

        await this.saveCountingData();

        if (this._countingItemsTableReady === true) {
            for (const productId of idsInPasteOrder) {
                if (this.countingData[productId]) {
                    await this.saveProductEntry(productId).catch(() => {});
                }
            }
        }

        this.scheduleRenderTable();
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
        }
        this.updateStatistics();
        this.updateCountingProgress();
        this._scheduleTableSelectorUpdate();

        let msg = addedCount > 0 ? `${addedCount} ürün eklendi` : `${idsInPasteOrder.length} ürün sıralandı`;
        if (skippedInTable) msg += `, ${skippedInTable} zaten tablodaydı`;
        if (noMatch) msg += `, ${noMatch} adres eşleşmedi`;
        this.showToast(msg, 'success', 4500);

        return { added: addedCount, skippedInTable, noMatch };
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

    async updateProductStock(productId, warehouseStock, systemStock = null, price = null, priceText = null, reservedStock = undefined) {
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
        if (reservedStock !== undefined) {
            if (reservedStock === null) {
                delete this.countingData[productId].reservedStock;
            } else {
                this.countingData[productId].reservedStock = Number(reservedStock);
            }
        }
        if (countingChanged) {
            this.countingData[productId].lastUpdated = now.toISOString();
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
    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.warn('Toast container bulunamadı');
            return;
        }

        // position: fixed olduğu için scroll pozisyonuna göre ayarlamaya gerek yok

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
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
        
        toast.innerHTML = `
            <div class="toast-icon">${iconSvg}</div>
            <div class="toast-content">
                <div class="toast-message">${this.escapeHtml(message)}</div>
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

    async syncSystemStocks() {
        // Get products that have no system stock (warehouse stock doesn't matter)
        // _api_info'yu filtrele (sistem bilgisi, ürün değil)
            const productsToSync = Object.keys(this.countingData).filter(productId => {
            if (this.isReservedCountingKey(productId)) return false;
                const data = this.countingData[productId];
            // Sistem stoku yoksa sync yap (depo stoku olsun ya da olmasın)
            return data.systemStock === null || data.systemStock === undefined;
            });

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
                    const reserved =
                        typeof result === 'object' && result !== null && 'reservedStock' in result
                            ? result.reservedStock
                            : undefined;

                    if (stock !== null && stock !== undefined) {
                        // Success - update stock and clear failed flag
                        if (this.countingData[productId]) {
                            this.countingData[productId].apiFetchFailed = false;
                        }
                        await this.updateProductStock(productId, null, stock, price, priceText, reserved);
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
                
                // Token geçerliliğini kontrol et
                if (apiInfo.tokenExpiry && Date.now() >= (apiInfo.tokenExpiry - 5 * 60 * 1000)) {
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

    // API'den direkt stok getir (Direkt fetch ile - Extension'a gerek yok)
    // Test function to see full API response
    async testAPIRequest(barcode) {
        try {
            // Get API info
            let apiInfo = null;
            if (this.countingData._api_info) {
                apiInfo = this.countingData._api_info;
            } else if (window.supabase) {
                const session = window.authUtils?.checkAuth();
                if (session && session.username) {
                    const { data: userData } = await window.supabase
                        .from('users')
                        .select('counting_data')
                        .eq('username', session.username)
                        .maybeSingle();
                    if (userData?.counting_data) {
                        const cd = typeof userData.counting_data === 'string' 
                            ? JSON.parse(userData.counting_data) 
                            : userData.counting_data;
                        apiInfo = cd._api_info;
                    }
                }
            }
            
            if (!apiInfo || !apiInfo.token) {
                console.error('❌ API bilgisi bulunamadı');
                return null;
            }
            
            // Find product by barcode
            const product = this.findProductByBarcode(barcode);
            const productId = product?.id || product?.productId;
            
            console.log('🧪 Test API Request:', { barcode, productId, productName: product?.name });
            
            // Make API request
            const endpoint = apiInfo.stockEndpoint || 'https://franchise-api-gateway.getirapi.com/stocks';
            const warehouseId = apiInfo.warehouseId || '5dcafe6ae2c61b1e52cf1704';
            
            let authToken = apiInfo.token;
            if (!authToken.startsWith('Bearer ')) {
                authToken = 'Bearer ' + authToken.trim();
            }
            
            const requestBody = {
                warehouseIds: [warehouseId],
                productIds: productId ? [productId] : [],
                sort: { available: 1 }
            };
            
            // If no productId, search by barcode in response
            if (!productId && barcode) {
                requestBody.productIds = [];
            }
            
            console.log('📤 Request:', {
                url: `${endpoint}?limit=100&offset=0`,
                method: 'POST',
                body: requestBody
            });
            
            const response = await fetch(`${endpoint}?limit=100&offset=0`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken,
                    'Origin': 'https://franchise.getir.com',
                    'Referer': 'https://franchise.getir.com/',
                    'Accept': '*/*'
                },
                body: JSON.stringify(requestBody)
            });
            
            const responseText = await response.text();
            const data = JSON.parse(responseText);
            
            console.log('📥 FULL API RESPONSE:', JSON.stringify(data, null, 2));
            
            // If productId, find the specific product
            if (productId && data.data && Array.isArray(data.data)) {
                const foundProduct = data.data.find(item => {
                    const itemProductId = item._id || item.id || item.product?._id || item.product?.id;
                    return itemProductId === productId || String(itemProductId) === String(productId);
                });
                if (foundProduct) {
                    console.log('📦 FOUND PRODUCT:', JSON.stringify(foundProduct, null, 2));
                    return foundProduct;
                }
            }
            
            // If barcode, search in response
            if (barcode && data.data && Array.isArray(data.data)) {
                const foundProduct = data.data.find(item => {
                    if (item.packagingInfo) {
                        for (const key in item.packagingInfo) {
                            if (item.packagingInfo[key]?.barcodes?.includes(String(barcode))) {
                                return true;
                            }
                        }
                    }
                    return item.barcode === String(barcode);
                });
                if (foundProduct) {
                    console.log('📦 FOUND PRODUCT BY BARCODE:', JSON.stringify(foundProduct, null, 2));
                    return foundProduct;
                }
            }
            
            return data;
        } catch (error) {
            console.error('❌ Test API Error:', error);
            return null;
        }
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
                // Price bilgisini de al
                let price = null;
                let priceText = null;
                
                if (foundProduct) {
                    price = foundProduct.price !== null && foundProduct.price !== undefined ? foundProduct.price : null;
                    priceText = foundProduct.priceText || null;
                    
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
                                    `<div class="absolute -top-1 -right-1 w-5 h-5 rounded-full ${diff.type === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'} border-2 border-white flex items-center justify-center">
                                        <span class="text-white text-xs font-bold">${diffIcon}</span>
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
                                value="${data.warehouseStock !== null ? data.warehouseStock : ''}"
                                placeholder="0"
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
                                        `<div class="absolute -top-1 -right-1 w-6 h-6 rounded-full ${diff.type === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'} border-2 border-white flex items-center justify-center">
                                            <span class="text-white text-xs font-bold">${diffIcon}</span>
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
                                            value="${data.warehouseStock !== null ? data.warehouseStock : ''}"
                                            placeholder="0"
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

    /** Tek bir rapid kart için innerHTML string'i */
    _buildRapidCardInner(product, data) {
        const isCounted = data.warehouseStock !== null && data.warehouseStock !== undefined;
        const hasWarehouse = isCounted;
        const hasSystem = data.systemStock !== null && data.systemStock !== undefined;

        const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
        let stockIndicator = '';
        let statusIcon = '';

        if (hasWarehouse && hasSystem) {
            if (diff.type === 'positive') {
                stockIndicator = '<div class="stock-indicator bg-emerald-400"></div>';
                statusIcon = '<div class="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7"/></svg></div>';
            } else if (diff.type === 'negative') {
                stockIndicator = '<div class="stock-indicator bg-rose-400"></div>';
                statusIcon = '<div class="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-sm"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"/></svg></div>';
            } else {
                stockIndicator = '<div class="stock-indicator bg-gray-300"></div>';
                statusIcon = '<div class="w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center shadow-sm"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 9h14M5 15h14"/></svg></div>';
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

        return `<div class="product-status-icon">${statusIcon}</div>${stockIndicator}<div class="flex-1 flex flex-col p-1 sm:p-1.5 overflow-hidden"><div class="flex-1 flex items-center justify-center mb-0.5 sm:mb-1 min-h-0 overflow-hidden"><img src="${productImage}" alt="${product.name || ''}" class="max-w-full max-h-full w-auto h-auto object-contain" onerror="this.src='../assets/logo.png'"></div><div class="text-center flex-shrink-0 px-0.5"><p class="text-[9px] sm:text-[10px] font-semibold text-gray-900 line-clamp-1 leading-tight truncate">${productName}</p></div></div>`;
    }

    renderRapidCountingMode() {
        const gridContainer = document.getElementById('rapidCountingGridContainer');
        if (!gridContainer) return;

        const sortedProductIds = this.getOrderedProductIds();

        if (sortedProductIds.length === 0) {
            gridContainer.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">Henüz ürün eklenmedi</div>';
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
        const productIds = this.getOrderedProductIds();
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
        const productIds = this.getOrderedProductIds();
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
        if (this.currentCountingProduct && this.currentCountingProduct !== productId) {
            this.flushDeferredStockAuditForProduct(this.currentCountingProduct);
        }

        const product = this.productIndex.get(productId);
        if (!product) return;

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
                    const reserved = typeof result === 'object' && result !== null && 'reservedStock' in result ? result.reservedStock : undefined;
                    if (stock !== null && stock !== undefined) {
                        if (this.countingData[productId]) this.countingData[productId].apiFetchFailed = false;
                        await this.updateProductStock(productId, null, stock, price, priceText, reserved);
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
                    const reserved = typeof result === 'object' && result !== null && 'reservedStock' in result ? result.reservedStock : undefined;
                    if (stock !== null && stock !== undefined) {
                        if (this.countingData[productId]) this.countingData[productId].apiFetchFailed = false;
                        await this.updateProductStock(productId, null, stock, price, priceText, reserved);
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
                    this.executeResetWarehouseStocks();
                } else {
                    this.executeResetSystemStocks();
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
    executeResetWarehouseStocks() {
        let resetCount = 0;
        const productIds = Object.keys(this.countingData).filter((id) => !this.isReservedCountingKey(id));
        
        const nowIso = new Date().toISOString();
        productIds.forEach(productId => {
            if (this.countingData[productId]) {
                const data = this.countingData[productId];
                if (data.warehouseStock !== null && data.warehouseStock !== undefined) {
                    this.countingData[productId].warehouseStock = null;
                    this.countingData[productId].lastUpdated = nowIso;
                    resetCount++;
                }
            }
        });
        
        if (resetCount > 0) {
            const tn = this.currentTableName || '';
            this.pushAuditEntry(
                `📋 ${this.formatTableDisplayName(tn)} · Depo stoku sıfırlandı · ${resetCount} satır`,
                { cat: 'reset', tbl: tn }
            );
            this.saveCountingData();
            this.renderTable();
            this.updateStatistics();
            this.showToast(`${resetCount} ürünün depo stoku sıfırlandı`, 'success', 3000);
        } else {
            this.showToast('Sıfırlanacak depo stoku bulunamadı', 'info', 3000);
        }
    }
    
    // Execute reset system stocks
    executeResetSystemStocks() {
        let resetCount = 0;
        const productIds = Object.keys(this.countingData).filter((id) => !this.isReservedCountingKey(id));
        
        const nowIso = new Date().toISOString();
        productIds.forEach(productId => {
            if (this.countingData[productId]) {
                const data = this.countingData[productId];
                if (data.systemStock !== null && data.systemStock !== undefined) {
                    this.countingData[productId].systemStock = null;
                    this.countingData[productId].apiFetchFailed = false; // Reset failed flag too
                    this.countingData[productId].lastUpdated = nowIso;
                    resetCount++;
                }
            }
        });
        
        if (resetCount > 0) {
            const tn = this.currentTableName || '';
            this.pushAuditEntry(
                `📋 ${this.formatTableDisplayName(tn)} · Sistem stoku sıfırlandı · ${resetCount} satır`,
                { cat: 'reset', tbl: tn }
            );
            this.saveCountingData();
            this.renderTable();
            this.updateStatistics();
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
        const newTableNameInput = document.getElementById('newTableNameInput');
        
        if (renameTableModal && currentTableNameDisplay && newTableNameInput) {
            currentTableNameDisplay.textContent = this.formatTableDisplayName(this.currentTableName);
            newTableNameInput.value = this.currentTableName;
            renameTableModal.classList.remove('hidden');
            // Focus on input
            setTimeout(() => {
                newTableNameInput.focus();
                newTableNameInput.select();
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
                
                const tokenExpiry = apiInfo.tokenExpiry;
                const now = Date.now();
                
                if (tokenExpiry) {
                    // Token expiry'yi parse et (timestamp veya string olabilir)
                    let expiryTime;
                    if (typeof tokenExpiry === 'number') {
                        expiryTime = tokenExpiry;
                    } else if (typeof tokenExpiry === 'string') {
                        // String ise parse et
                        expiryTime = new Date(tokenExpiry).getTime();
                        // Eğer parse edilemediyse (NaN), timestamp olarak dene
                        if (isNaN(expiryTime)) {
                            expiryTime = parseInt(tokenExpiry, 10);
                        }
                    } else {
                        expiryTime = null;
                    }
                    
                    // Geçerli bir timestamp değilse atla
                    if (!expiryTime || isNaN(expiryTime)) {
                        console.warn('⚠️ Token expiry geçersiz format:', tokenExpiry);
                    }
                    
                    const timeRemaining = expiryTime && !isNaN(expiryTime) ? expiryTime - now : null;
                    
                    // Token expiry kontrolü: Eğer token süresi geçmişse veya 5 dakika içinde geçecekse,
                    // ve son kontrol zamanından 30 saniye geçmişse, yeni token çek
                    const shouldCheckForNewToken = timeRemaining !== null && 
                                                   (timeRemaining < 0 || timeRemaining < 5 * 60 * 1000) && 
                                                   (!this.lastTokenCheckTime || (now - this.lastTokenCheckTime) > 30000) &&
                                                   (this.lastTokenExpiry !== tokenExpiry) &&
                                                   !this.isTokenUpdateInProgress;
                    
                    // Time remaining değerlerini hesapla
                    const minutesRemaining = timeRemaining !== null ? Math.floor(timeRemaining / (1000 * 60)) : 0;
                    const hoursRemaining = timeRemaining !== null ? Math.floor(minutesRemaining / 60) : 0;
                    const daysRemaining = timeRemaining !== null ? Math.floor(hoursRemaining / 24) : 0;
                    
                    if (shouldCheckForNewToken) {
                        console.log('🔄 Token otomatik güncelleme tetiklendi:', {
                            timeRemaining: timeRemaining,
                            minutesRemaining: minutesRemaining,
                            lastCheckTime: this.lastTokenCheckTime,
                            lastTokenExpiry: this.lastTokenExpiry,
                            currentTokenExpiry: tokenExpiry
                        });
                        
                        // Yeni token çekmeyi dene
                        this.lastTokenCheckTime = now;
                        this.lastTokenExpiry = tokenExpiry;
                        this.isTokenUpdateInProgress = true;
                        
                        // Extension'dan yeni token çek
                        try {
                            await this.checkAndSaveAPIInfoFromExtension();
                            console.log('✅ Token otomatik güncelleme başarılı');
                            // Token güncelleme sonrası UI'ı yenile (kısa bir gecikme ile)
                            setTimeout(() => {
                                this.isTokenUpdateInProgress = false;
                                this.updateAPIStatusCard();
                            }, 1000);
                        } catch (error) {
                            console.warn('⚠️ Token güncelleme hatası:', error);
                            this.isTokenUpdateInProgress = false;
                        }
                    }
                    
                    // Determine status
                    if (timeRemaining === null || isNaN(timeRemaining)) {
                        // Token expiry geçersiz format
                        apiStatusCard.className = 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                        apiStatusIcon.className = 'w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center';
                        apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
                        apiStatusText.textContent = 'Token bilgisi eksik';
                        
                        // Warehouse bilgisi
                        if (apiInfo.warehouseId) {
                            const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                            apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                        } else {
                            apiWarehouseName.textContent = 'Depo bilgisi yok';
                        }
                        
                        apiExpiryTime.innerHTML = '<span class="text-yellow-700">Token expiry bilgisi geçersiz format</span>';
                    } else if (timeRemaining < 0) {
                        // Expired
                        apiStatusCard.className = 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                        apiStatusIcon.className = 'w-10 h-10 rounded-full bg-red-100 flex items-center justify-center';
                        apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                        apiStatusText.textContent = 'Token süresi dolmuş';
                        
                        // Warehouse bilgisi
                        if (apiInfo.warehouseId) {
                            const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                            apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                        } else {
                            apiWarehouseName.textContent = 'Depo bilgisi yok';
                        }
                        
                        apiExpiryTime.innerHTML = '<span class="text-red-600 font-medium">Lütfen Getir franchise sayfasını yenileyin</span>';
                    } else if (timeRemaining < 5 * 60 * 1000) {
                        // Expiring soon (less than 5 minutes)
                        apiStatusCard.className = 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                        apiStatusIcon.className = 'w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center';
                        apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
                        apiStatusText.textContent = 'Token yakında dolacak';
                        
                        // Warehouse bilgisi
                        if (apiInfo.warehouseId) {
                            const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                            apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                        } else {
                            apiWarehouseName.textContent = 'Depo bilgisi yok';
                        }
                        
                        apiExpiryTime.innerHTML = `<span class="text-yellow-700 font-medium">${minutesRemaining} dakika içinde Getir franchise sayfasını yenileyin</span>`;
                    } else {
                        // Valid
                        apiStatusCard.className = 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                        apiStatusIcon.className = 'w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center';
                        apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                        apiStatusText.textContent = 'API güncel ve aktif';
                        
                        // Warehouse bilgisi
                        if (apiInfo.warehouseId) {
                            const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                            apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                        } else {
                            apiWarehouseName.textContent = 'Depo bilgisi yok';
                        }
                        
                        // Format remaining time
                        let timeText = '';
                        if (daysRemaining > 0) {
                            timeText = `${daysRemaining} gün ${hoursRemaining % 24} saat`;
                        } else if (hoursRemaining > 0) {
                            timeText = `${hoursRemaining} saat ${minutesRemaining % 60} dakika`;
                        } else {
                            timeText = `${minutesRemaining} dakika`;
                        }
                        
                        const expiryDate = new Date(tokenExpiry).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        apiExpiryTime.innerHTML = `
                            <span class="text-gray-600">Kalan süre: <span class="font-medium text-blue-700">${timeText}</span></span><br>
                            <span class="text-gray-500 text-xs mt-1">Son kullanma: ${expiryDate}</span>
                        `;
                    }
                } else {
                    // No expiry info
                    apiStatusCard.className = 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6';
                    apiStatusIcon.className = 'w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center';
                    apiStatusIcon.innerHTML = '<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    apiStatusText.textContent = 'API aktif';
                    
                    // Warehouse bilgisi
                    if (apiInfo.warehouseId) {
                        const warehouseName = apiInfo.warehouseName || apiInfo.warehouseId.substring(0, 8) + '...';
                        apiWarehouseName.textContent = `Depo: ${warehouseName}`;
                    } else {
                        apiWarehouseName.textContent = 'Depo bilgisi yok';
                    }
                    
                    apiExpiryTime.innerHTML = '<span class="text-gray-500">Token bilgisi mevcut</span>';
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
    async calculateFinancialData(tableName) {
        try {
            // Load full counting data to access all tables
            const fullData = await this.loadFullCountingData();
            if (!fullData || !fullData._tables || !fullData._tables[tableName]) {
                return null;
            }

            const tableData = fullData._tables[tableName];
            const products = [];
            const categoryMap = {};

            // Process each product in the table
            for (const [productId, data] of Object.entries(tableData)) {
                if (this.isReservedCountingKey(productId)) {
                    continue;
                }

                const product = this.productIndex.get(productId);
                if (!product) continue;

                const warehouseStock = data.warehouseStock ?? 0;
                const systemStock = data.systemStock ?? 0;
                const price = data.price ?? 0;
                const priceText = data.priceText || '₺0,00';

                if (price === 0 || price === null) continue;

                const warehouseValue = warehouseStock * price;
                const systemValue = systemStock * price;
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
                    warehouseValue,
                    systemValue,
                    difference,
                    stockDiff,
                    barcode,
                    barcodes,
                    imageUrl
                };

                products.push(productData);

                // Aggregate by category
                if (!categoryMap[category]) {
                    categoryMap[category] = {
                        category,
                        warehouseValue: 0,
                        systemValue: 0,
                        difference: 0,
                        productCount: 0
                    };
                }

                categoryMap[category].warehouseValue += warehouseValue;
                categoryMap[category].systemValue += systemValue;
                categoryMap[category].difference += difference;
                categoryMap[category].productCount += 1;
            }

            // Calculate summary
            const totalWarehouseValue = products.reduce((sum, p) => sum + p.warehouseValue, 0);
            const totalSystemValue = products.reduce((sum, p) => sum + p.systemValue, 0);
            const profitLoss = totalWarehouseValue - totalSystemValue;
            const productCount = products.length;
            const countedProducts = products.filter(p => p.warehouseStock !== null && p.warehouseStock !== undefined).length;

            const categories = Object.values(categoryMap).sort((a, b) => b.warehouseValue - a.warehouseValue);

            return {
                tableName,
                summary: {
                    totalWarehouseValue,
                    totalSystemValue,
                    profitLoss,
                    productCount,
                    countedProducts
                },
                categories,
                products: products.sort((a, b) => b.warehouseValue - a.warehouseValue)
            };
        } catch (error) {
            console.error('Error calculating financial data:', error);
            return null;
        }
    }

    async getAllTablesFinancialData() {
        try {
            const fullData = await this.loadFullCountingData();
            if (!fullData || !fullData._tables) {
                return [];
            }

            const tables = Object.keys(fullData._tables);
            const financialData = [];

            for (const tableName of tables) {
                const data = await this.calculateFinancialData(tableName);
                if (data) {
                    financialData.push(data);
                }
            }

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

        // Setup financial table selector (same as counting table selector)
        this.setupFinancialTableSelector();
        
        // Update dropdown with current tables
        this.updateFinancialTableSelector();

        // Render initial data (default to all tables)
        await this.renderAllTablesFinancialData();
    }

    setupFinancialTableSelector() {
        const financialTableSelectorBtn = document.getElementById('financialTableSelectorBtn');
        const financialTableSelectorText = document.getElementById('financialTableSelectorText');
        const financialTableSelectorDropdown = document.getElementById('financialTableSelectorDropdown');
        const financialTableSelectorIcon = document.getElementById('financialTableSelectorIcon');

        if (!financialTableSelectorBtn || !financialTableSelectorText || !financialTableSelectorDropdown) return;

        // Check if already set up (to avoid duplicate event listeners)
        if (financialTableSelectorBtn.dataset.setup === 'true') return;
        financialTableSelectorBtn.dataset.setup = 'true';

        // Button click to toggle dropdown
        financialTableSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            financialTableSelectorDropdown.classList.toggle('hidden');
            if (financialTableSelectorIcon) {
                financialTableSelectorIcon.style.transform = financialTableSelectorDropdown.classList.contains('hidden') 
                    ? 'rotate(0deg)' 
                    : 'rotate(180deg)';
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!financialTableSelectorBtn.contains(e.target) && !financialTableSelectorDropdown.contains(e.target)) {
                financialTableSelectorDropdown.classList.add('hidden');
                if (financialTableSelectorIcon) {
                    financialTableSelectorIcon.style.transform = 'rotate(0deg)';
                }
            }
        });
    }

    updateFinancialTableSelector() {
        const financialTableSelectorText = document.getElementById('financialTableSelectorText');
        const financialTableSelectorDropdown = document.getElementById('financialTableSelectorDropdown');
        const financialTableSelectorIcon = document.getElementById('financialTableSelectorIcon');

        if (!financialTableSelectorText || !financialTableSelectorDropdown) return;

        const tables = this.getTableList();
        
        // Update button text
        if (this.selectedFinancialTable === 'all') {
            financialTableSelectorText.textContent = 'Tüm Tablolar';
        } else {
            const selectedTable = tables.find(t => t.name === this.selectedFinancialTable);
            financialTableSelectorText.textContent = selectedTable
                ? this.formatTableDisplayName(selectedTable.name)
                : (this.selectedFinancialTable || 'Tüm Tablolar');
        }

        // Clear and populate dropdown
        financialTableSelectorDropdown.innerHTML = '';

        // Add "Tüm Tablolar" option
        const allOption = document.createElement('div');
        allOption.className = `table-selector-option ${this.selectedFinancialTable === 'all' ? 'active' : ''}`;
        allOption.dataset.tableName = 'all';
        allOption.innerHTML = `
            <span>Tüm Tablolar</span>
            <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
        allOption.addEventListener('click', async () => {
            this.selectedFinancialTable = 'all';
            await this.renderAllTablesFinancialData();
            this.updateFinancialTableSelector();
            financialTableSelectorDropdown.classList.add('hidden');
            if (financialTableSelectorIcon) {
                financialTableSelectorIcon.style.transform = 'rotate(0deg)';
            }
        });
        financialTableSelectorDropdown.appendChild(allOption);

        // Add table options
        tables.forEach(table => {
            const option = document.createElement('div');
            option.className = `table-selector-option ${table.name === this.selectedFinancialTable ? 'active' : ''}`;
            option.dataset.tableName = table.name;
            const label = this.formatTableDisplayName(table.name);
            option.innerHTML = `
                <span>${this.escapeHtml(label)}${table.productCount ? ` <span class="text-gray-500 text-xs">(${table.productCount})</span>` : ''}</span>
                <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            `;
            
            option.addEventListener('click', async () => {
                this.selectedFinancialTable = table.name;
                await this.renderSingleTableFinancialData(table.name);
                this.updateFinancialTableSelector();
                financialTableSelectorDropdown.classList.add('hidden');
                if (financialTableSelectorIcon) {
                    financialTableSelectorIcon.style.transform = 'rotate(0deg)';
                }
            });
            
            financialTableSelectorDropdown.appendChild(option);
        });
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
        this.renderProductDetails(aggregated.products);
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
            this.renderProductDetails([]);
            this.renderFinancialExecutiveReport([], { totalWarehouseValue: 0, totalSystemValue: 0, profitLoss: 0, productCount: 0, countedProducts: 0 });
            return;
        }

        this.renderFinancialSummary(data.summary);
        this.renderCategoryBreakdown(data.categories);
        this.renderProductDetails(data.products);
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

    renderProductDetails(products) {
        const productDetailsCards = document.getElementById('productDetailsCards');
        const sortProductsDesc = document.getElementById('sortProductsDesc');
        const sortProductsAsc = document.getElementById('sortProductsAsc');

        // Store products for sorting
        this.financialProducts = products;

        // Filter out products with zero difference
        const filteredProducts = products.filter(product => product.difference !== 0);

        if (filteredProducts.length === 0) {
            if (productDetailsCards) {
                productDetailsCards.innerHTML = '<p class="text-center text-gray-500 py-6 text-sm">Farkı olan ürün bulunamadı</p>';
            }
            return;
        }

        // Sort products based on current sort order
        const sortedProducts = [...filteredProducts].sort((a, b) => {
            if (this.productSortOrder === 'desc') {
                return a.difference - b.difference; // En çok zarardan en az zarara (negatiften pozitife)
            } else {
                return b.difference - a.difference; // En az zarardan en çok zarara (pozitiften negatife)
            }
        });

        // Update sort button states
        if (sortProductsDesc && sortProductsAsc) {
            if (this.productSortOrder === 'desc') {
                sortProductsDesc.classList.add('bg-blue-100', 'text-blue-700');
                sortProductsDesc.classList.remove('bg-gray-100');
                sortProductsAsc.classList.remove('bg-blue-100', 'text-blue-700');
                sortProductsAsc.classList.add('bg-gray-100');
            } else {
                sortProductsAsc.classList.add('bg-blue-100', 'text-blue-700');
                sortProductsAsc.classList.remove('bg-gray-100');
                sortProductsDesc.classList.remove('bg-blue-100', 'text-blue-700');
                sortProductsDesc.classList.add('bg-gray-100');
            }
        }

        // Setup sort button listeners
        if (sortProductsDesc) {
            sortProductsDesc.onclick = () => {
                this.productSortOrder = 'desc';
                this.renderProductDetails(this.financialProducts);
            };
        }
        if (sortProductsAsc) {
            sortProductsAsc.onclick = () => {
                this.productSortOrder = 'asc';
                this.renderProductDetails(this.financialProducts);
            };
        }

        // Compact card view for all devices
        if (productDetailsCards) {
            productDetailsCards.innerHTML = sortedProducts.map(product => {
                const cardClass = product.difference > 0 ? 'profit' : product.difference < 0 ? 'loss' : 'zero';
                const stockDiff = product.warehouseStock - product.systemStock;
                const stockDiffText = stockDiff > 0 ? `+${stockDiff}` : stockDiff < 0 ? `${stockDiff}` : '0';
                const stockDiffClass = stockDiff > 0 ? 'text-green-600' : stockDiff < 0 ? 'text-red-600' : 'text-gray-600';
                
                return `
                    <div class="product-financial-card ${cardClass}">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <h4 class="text-sm font-semibold text-gray-900 truncate mb-1">${product.productName}</h4>
                                <div class="flex items-center gap-3 text-xs text-gray-600">
                                    <span>${product.category}</span>
                                    <span>•</span>
                                    <span>Depo: <strong>${product.warehouseStock}</strong></span>
                                    <span>Sistem: <strong>${product.systemStock}</strong></span>
                                    <span class="${stockDiffClass} font-semibold">(${stockDiffText})</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-end gap-1 flex-shrink-0">
                                <div class="text-xs text-gray-500">Fark</div>
                                <div class="text-sm font-bold ${product.difference > 0 ? 'text-green-600' : product.difference < 0 ? 'text-red-600' : 'text-gray-600'}">
                                    ${product.difference >= 0 ? '+' : ''}${this.formatCurrency(product.difference)}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
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

    /**
     * Finans sekmesi altı: eksik / fazla ürünler, foto, tam ad, barkod, adet ve TL etkisi, net kar/zarar.
     */
    renderFinancialExecutiveReport(products, summary) {
        const container = document.getElementById('financialExecutiveReport');
        if (!container) return;

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
                ? 'Tüm tablolar · aynı ürün satırları birleştirildi'
                : this.formatTableDisplayName(this.selectedFinancialTable || '');

        const now = new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });

        const productCard = (p, kind) => {
            const img = this.escapeHtml(p.imageUrl || '../assets/logo.png');
            const name = this.escapeHtml(p.productName || '');
            const barcodeList = Array.isArray(p.barcodes) && p.barcodes.length
                ? p.barcodes
                : (p.barcode ? [p.barcode] : []);
            const barcodesHtml = barcodeList.length
                ? barcodeList.map((bc) =>
                    `<span class="inline-flex shrink-0 items-center rounded-full border border-slate-200/70 bg-slate-50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-slate-600">${this.escapeHtml(String(bc))}</span>`
                ).join('')
                : '<span class="text-[10px] text-gray-400">—</span>';
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
                        <div class="mt-1 flex flex-wrap gap-1">${barcodesHtml}</div>
                        <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                            <span>Depo: <strong>${p.warehouseStock ?? '—'}</strong></span>
                            <span>Sistem: <strong>${p.systemStock ?? '—'}</strong></span>
                            <span class="font-semibold ${stockDiffClass}">(${adetStr})</span>
                        </div>
                        <div class="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-t border-gray-100/80 pt-1.5 text-[11px]">
                            <span class="font-semibold ${tone.ad}">${adetLabel}</span>
                            <span class="text-gray-500">Birim ${this.formatCurrency(p.price)}</span>
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
                <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h3 class="text-base font-bold tracking-tight text-gray-900 sm:text-lg">Stok Özeti</h3>
                        <p class="mt-0.5 text-xs text-gray-500">${this.escapeHtml(scopeShort)}</p>
                    </div>
                    <p class="text-[11px] text-gray-400">${this.escapeHtml(now)}</p>
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
            </div>
        `;
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


