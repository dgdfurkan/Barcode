// Counting System for Stock Management
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
        this.currentTab = localStorage.getItem('counting_active_tab') || 'sayim'; // 'sayim' | 'finans'
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
        this.chartCarouselSetup = false; // Chart carousel setup flag
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

            // Setup tab system
            this.setupTabSystem();
            
            // Render based on current tab
            if (this.currentTab === 'finans') {
                this.renderFinancialTab();
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
            
            // Show/hide delete button based on table count
            const deleteTableBtn = document.getElementById('deleteTableBtn');
            if (deleteTableBtn) {
                const tables = this.getTableList();
                deleteTableBtn.style.display = tables.length > 1 ? 'block' : 'none';
            }
            
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
            
            // Set up periodic API status updates (every 30 seconds)
            setInterval(() => {
                this.updateAPIStatusCard();
            }, 30000);
            
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
            
            // 1) Önce Supabase'deki mevcut durumu al (öncelik Supabase)
            let existingToken = null;
            let existingTimestamp = 0;
            let existingExpiry = null;
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
                        existingToken = countingData._api_info?.token;
                        existingTimestamp = countingData._api_info?.timestamp || 0;
                        existingExpiry = countingData._api_info?.tokenExpiry;
                    }
                } catch (e) {
                    // Silent
                }
            }
            
            const supabaseExpired = existingExpiry && (Date.now() >= (this.normalizeExpiry(existingExpiry) - 5 * 60 * 1000));
            
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
            
            // 3) Eklentiden token geldiyse: Supabase'de yoksa, süresi geçmişse veya eklenti daha güncel/uzun süreliyse Supabase'e yaz
            if (apiInfo && apiInfo.token) {
                const newToken = apiInfo.token;
                const newTimestamp = apiInfo.timestamp || Date.now();
                const newExpiry = apiInfo.tokenExpiry ? this.normalizeExpiry(apiInfo.tokenExpiry) : null;
                
                let shouldUpdate = false;
                if (!existingToken || supabaseExpired) {
                    shouldUpdate = true;
                    if (supabaseExpired) console.log('🔄 Supabase token süresi dolmuş/az kaldı, eklentiden güncel token Supabase\'e yazılıyor');
                } else if (newToken !== existingToken) {
                    shouldUpdate = true;
                    console.log('🔄 Token değeri değişti, Supabase güncelleniyor');
                } else if (newTimestamp > existingTimestamp) {
                    shouldUpdate = true;
                    console.log('🔄 Eklentiden daha yeni timestamp, Supabase güncelleniyor');
                } else if (newExpiry && existingExpiry && newExpiry > this.normalizeExpiry(existingExpiry)) {
                    shouldUpdate = true;
                    console.log('🔄 Eklentiden daha uzun süreli token, Supabase güncelleniyor');
                }
                
                if (shouldUpdate) {
                    await this.saveAPIInfoToSupabase(apiInfo);
                    if (apiInfo.tokenExpiry) this.lastTokenExpiry = apiInfo.tokenExpiry;
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

    async loadProducts() {
        try {
            if (window.userDataManager) {
                this.allProducts = window.userDataManager.getAllProducts(true) || [];
            } else if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA.products) {
                this.allProducts = PRODUCTS_DATA.products || [];
            }
            console.log(`📦 Loaded ${this.allProducts.length} products`);
        } catch (error) {
            console.error('Error loading products:', error);
            this.allProducts = [];
        }
    }

    async loadFullCountingData() {
        try {
            let fullData = null;
            
            // Try to load from Supabase first (users.counting_data column)
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

            // Fallback to localStorage
            if (!fullData) {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser?.username || 'default'}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                    fullData = JSON.parse(stored);
                }
            }
                
            // Migrate old structure if needed
            if (fullData) {
                fullData = this.migrateToNestedStructure(fullData);
            } else {
                // Initialize new structure
                fullData = {
                    _api_info: {},
                    _tables: {
                        'Ana Sayım': {}
                    },
                    _currentTable: 'Ana Sayım'
                };
            }

            return fullData;
        } catch (error) {
            console.error('Error loading full counting data:', error);
            return {
                _api_info: {},
                _tables: {
                    'Ana Sayım': {}
                },
                _currentTable: 'Ana Sayım'
            };
        }
    }

    async loadCountingData() {
        try {
            let fullData = null;
            
            // Try to load from Supabase first (users.counting_data column)
            if (window.supabase && this.currentUser) {
                const { data, error } = await window.supabase
                    .from('users')
                    .select('counting_data')
                    .eq('username', this.currentUser.username)
                    .maybeSingle();

                if (!error && data && data.counting_data) {
                    fullData = data.counting_data;
                    console.log('📦 Loaded counting data from Supabase (users.counting_data)');
                }
            }

            // Fallback to localStorage
            if (!fullData) {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    fullData = JSON.parse(stored);
                console.log('📦 Loaded counting data from localStorage');
                }
            }

            // Migrate old structure to new nested structure if needed
            if (fullData) {
                fullData = this.migrateToNestedStructure(fullData);
                
                // Set current table name
                if (fullData._currentTable) {
                    this.currentTableName = fullData._currentTable;
                } else {
                    this.currentTableName = 'Ana Sayım';
                    fullData._currentTable = this.currentTableName;
                }
                
                // Load active table data
                if (fullData._tables && fullData._tables[this.currentTableName]) {
                    this.countingData = fullData._tables[this.currentTableName];
                } else {
                    // Create default table if it doesn't exist
                    if (!fullData._tables) {
                        fullData._tables = {};
                    }
                    fullData._tables[this.currentTableName] = {};
                    this.countingData = {};
                }
                
                // Save full structure back
                await this.saveFullCountingData(fullData);
                } else {
                // Initialize new structure
                this.currentTableName = 'Ana Sayım';
                this.countingData = {};
                const newStructure = {
                    _api_info: {},
                    _tables: {
                        [this.currentTableName]: {}
                    },
                    _currentTable: this.currentTableName
                };
                await this.saveFullCountingData(newStructure);
            }
        } catch (error) {
            console.error('Error loading counting data:', error);
            // Fallback to empty structure
            this.currentTableName = 'Ana Sayım';
                this.countingData = {};
            }
        }

    // Migrate old structure to new nested structure
    migrateToNestedStructure(data) {
        // If already in new structure, return as is
        if (data._tables) {
            return data;
        }

        // Migrate old structure
        const migrated = {
            _api_info: data._api_info || {},
            _tables: {},
            _currentTable: 'Ana Sayım'
        };

        // Move all product data to default table
        const defaultTable = {};
        for (const key in data) {
            if (key !== '_api_info' && key !== '_tables' && key !== '_currentTable') {
                defaultTable[key] = data[key];
            }
        }
        migrated._tables['Ana Sayım'] = defaultTable;

        return migrated;
    }

    // Save full counting data structure (including all tables)
    async saveFullCountingData(fullData) {
        try {
            // Update current table in full data
            if (fullData._tables && fullData._tables[this.currentTableName]) {
                fullData._tables[this.currentTableName] = this.countingData;
            }
            fullData._currentTable = this.currentTableName;

            // Save to Supabase
            if (window.supabase && this.currentUser) {
                const { error } = await window.supabase
                    .from('users')
                    .update({ counting_data: fullData })
                    .eq('username', this.currentUser.username);

                if (error) {
                    throw error;
                }
                console.log('💾 Saved full counting data to Supabase');
            }

            // Also save to localStorage as backup
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            localStorage.setItem(storageKey, JSON.stringify(fullData));
            console.log('💾 Saved full counting data to localStorage (backup)');
        } catch (error) {
            console.error('Error saving full counting data:', error);
            // Fallback to localStorage only
            try {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                localStorage.setItem(storageKey, JSON.stringify(fullData));
                console.log('💾 Saved full counting data to localStorage (fallback)');
            } catch (e) {
                console.error('Error saving to localStorage:', e);
            }
        }
    }

    async saveCountingData() {
        try {
            // Load full structure first
            let fullData = null;
            if (window.supabase && this.currentUser) {
                const { data } = await window.supabase
                    .from('users')
                    .select('counting_data')
                    .eq('username', this.currentUser.username)
                    .maybeSingle();
                if (data && data.counting_data) {
                    fullData = data.counting_data;
                }
            }

            // Fallback to localStorage
            if (!fullData) {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    fullData = JSON.parse(stored);
                }
            }

            // Initialize if needed
            if (!fullData) {
                fullData = {
                    _api_info: {},
                    _tables: {},
                    _currentTable: this.currentTableName
                };
            }

            // Ensure _tables exists
            if (!fullData._tables) {
                fullData._tables = {};
            }

            // Update current table with current countingData
            fullData._tables[this.currentTableName] = this.countingData;
            fullData._currentTable = this.currentTableName;

            // Save full structure
            await this.saveFullCountingData(fullData);
        } catch (error) {
            console.error('Error saving counting data:', error);
            // Fallback to localStorage only
            try {
                const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
                const fullData = {
                    _api_info: {},
                    _tables: {
                        [this.currentTableName]: this.countingData
                    },
                    _currentTable: this.currentTableName
                };
                localStorage.setItem(storageKey, JSON.stringify(fullData));
                console.log('💾 Saved counting data to localStorage (fallback)');
            } catch (e) {
                console.error('Error saving to localStorage:', e);
            }
        }
    }

    // Switch to a different table
    async switchTable(tableName) {
        if (!tableName || tableName === this.currentTableName) {
            return; // Already on this table
        }

        // Save current table first
        await this.saveCountingData();

        // Load full structure
        let fullData = null;
        if (window.supabase && this.currentUser) {
            const { data } = await window.supabase
                .from('users')
                .select('counting_data')
                .eq('username', this.currentUser.username)
                .maybeSingle();
            if (data && data.counting_data) {
                fullData = data.counting_data;
            }
        }

        if (!fullData) {
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                fullData = JSON.parse(stored);
            }
        }

        if (!fullData || !fullData._tables) {
            console.error('Cannot switch table: data structure not found');
            return;
        }

        // Switch to new table
        this.currentTableName = tableName;
        if (fullData._tables[tableName]) {
            this.countingData = fullData._tables[tableName];
        } else {
            // Create new table if it doesn't exist
            fullData._tables[tableName] = {};
            this.countingData = {};
        }

        fullData._currentTable = tableName;
        await this.saveFullCountingData(fullData);

        // Re-render UI
        this.renderTable();
        this.updateStatistics();
        this.updateTableSelector();
        this.syncSayimSubTabToTable();
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

        // Save current table first
        await this.saveCountingData();

        // Load full structure
        let fullData = null;
        if (window.supabase && this.currentUser) {
            const { data } = await window.supabase
                .from('users')
                .select('counting_data')
                .eq('username', this.currentUser.username)
                .maybeSingle();
            if (data && data.counting_data) {
                fullData = data.counting_data;
            }
        }

        if (!fullData) {
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                fullData = JSON.parse(stored);
            }
        }

        if (!fullData) {
            fullData = {
                _api_info: {},
                _tables: {},
                _currentTable: this.currentTableName
            };
        }

        if (!fullData._tables) {
            fullData._tables = {};
        }

        // Check if table already exists
        if (fullData._tables[trimmed]) {
            throw new Error('Bu isimde bir tablo zaten mevcut');
        }

        // Create new table
        fullData._tables[trimmed] = {};
        
        // Switch to new table
        this.currentTableName = trimmed;
        this.countingData = {};
        fullData._currentTable = trimmed;

        await this.saveFullCountingData(fullData);

        // Re-render UI
        this.renderTable();
        this.updateStatistics();
        this.updateTableSelector();
        this.syncSayimSubTabToTable();
    }

    // Delete a table
    async deleteTable(tableName) {
        if (!tableName) {
            return;
        }

        // Cannot delete current table if it's the only one
        let fullData = null;
        if (window.supabase && this.currentUser) {
            const { data } = await window.supabase
                .from('users')
                .select('counting_data')
                .eq('username', this.currentUser.username)
                .maybeSingle();
            if (data && data.counting_data) {
                fullData = data.counting_data;
            }
        }

        if (!fullData) {
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                fullData = JSON.parse(stored);
            }
        }

        if (!fullData || !fullData._tables) {
            return;
        }

        const tableNames = Object.keys(fullData._tables);
        if (tableNames.length <= 1) {
            throw new Error('En az bir tablo bulunmalıdır');
        }

        // Delete table
        delete fullData._tables[tableName];

        // If deleted table was current, switch to first available table
        if (tableName === this.currentTableName) {
            const newTableName = Object.keys(fullData._tables)[0];
            this.currentTableName = newTableName;
            this.countingData = fullData._tables[newTableName] || {};
            fullData._currentTable = newTableName;
        }

        await this.saveFullCountingData(fullData);

        // Re-render UI
        this.renderTable();
        this.updateStatistics();
        this.updateTableSelector();
        this.syncSayimSubTabToTable();
    }

    // Get list of all tables
    getTableList() {
        let fullData = null;
        if (window.supabase && this.currentUser) {
            // Try to get from localStorage first (faster)
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                fullData = JSON.parse(stored);
            }
        }

        if (!fullData) {
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                fullData = JSON.parse(stored);
            }
        }

        if (!fullData || !fullData._tables) {
            return [{ name: 'Ana Sayım', isCurrent: true }];
        }

        const tableNames = Object.keys(fullData._tables);
        return tableNames.map(name => ({
            name,
            isCurrent: name === this.currentTableName,
            productCount: Object.keys(fullData._tables[name] || {}).filter(k => k !== '_api_info').length
        }));
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

    async ensureDailyTableForToday() {
        const iso = this.getLocalDateIso();
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
        for (const row of rows) {
            const product = this.matchDailyImportRow(row);
            if (!product) {
                skipped++;
                continue;
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

        await this.saveCountingData();
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
    }

    async importDailyCountForToday() {
        try {
            await this.ensureDailyTableForToday();
        } catch (err) {
            this.showToast(err?.message || 'Tablo açılamadı', 'error', 4000);
            return;
        }

        const iso = this.getLocalDateIso();
        const fetchFn = window.DailyCountImport?.fetchDailyRowsForDate;
        const rows = typeof fetchFn === 'function' ? await fetchFn(iso) : [];
        if (!rows.length) {
            this.showToast(
                'Kontrol paneli verisi henüz bağlanmadı veya bugün için satır yok. Eklentiden kopyalayıp «Panodan içe aktar» kullanın veya `window.__DAILY_COUNT_MOCK_ROWS` ile test edin.',
                'info',
                5000
            );
            this.updateTableSelector();
            this.syncSayimSubTabToTable();
            return;
        }

        await this.applyImportedRows(rows);
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
            await this.ensureDailyTableForToday();
        } catch (err) {
            this.showToast(err?.message || 'Tablo açılamadı', 'error', 4000);
            return;
        }
        await this.applyImportedRows(parsed.items);
    }

    // Update table selector UI (genel liste + günlük liste)
    updateTableSelector() {
        const generalList = document.getElementById('generalTableList');
        const dailyList = document.getElementById('dailyTableList');
        const summaryText = document.getElementById('activeTableSummaryText');
        const renameBtn = document.getElementById('renameTableBtn');

        const tables = this.getTableList();
        const currentTable = tables.find((t) => t.isCurrent);
        const displayName = this.formatTableDisplayName(this.currentTableName);
        const cnt = currentTable ? currentTable.productCount || 0 : 0;
        if (summaryText) {
            const tag = this.isDailyTableName(this.currentTableName) ? ' (günlük)' : '';
            summaryText.textContent = `${displayName}${tag} · ${cnt} ürün`;
        }

        if (renameBtn) {
            const lock = this.isDailyTableName(this.currentTableName);
            renameBtn.disabled = lock;
            renameBtn.setAttribute('aria-disabled', lock ? 'true' : 'false');
            renameBtn.classList.toggle('opacity-40', lock);
            renameBtn.classList.toggle('pointer-events-none', lock);
            renameBtn.title = lock
                ? 'Günlük sayım tablolarının adı sabittir'
                : 'Seçili tablonun adını değiştir';
        }

        if (!generalList || !dailyList) {
            return;
        }

        const searchEl = document.getElementById('generalTableSearch');
        const q = (searchEl && searchEl.value ? searchEl.value : '').trim().toLowerCase();

        const generalTables = tables.filter((t) => !this.isDailyTableName(t.name));
        const filteredGeneral = q
            ? generalTables.filter((t) => t.name.toLowerCase().includes(q))
            : generalTables;

        generalList.innerHTML = '';
        generalList.classList.toggle('sayim-chip-scroll--empty', filteredGeneral.length === 0);
        if (filteredGeneral.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-[11px] text-slate-500 px-2 py-1 text-center shrink-0 min-w-[min(100%,18rem)]';
            empty.textContent = generalTables.length
                ? 'Arama ile eşleşen tablo yok.'
                : 'Henüz genel tablo yok. + ile oluşturun.';
            generalList.appendChild(empty);
        } else {
            filteredGeneral.forEach((table) => {
                const isActive = table.name === this.currentTableName;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('role', 'listitem');
                btn.dataset.tableName = table.name;
                btn.className = [
                    'sayim-table-chip shrink-0 inline-flex max-w-[min(100vw-4rem,14rem)] items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors snap-start sm:max-w-[16rem]',
                    isActive
                        ? 'border-blue-400 bg-blue-50 text-blue-900 shadow-sm ring-1 ring-blue-200/50'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
                ].join(' ');
                btn.innerHTML = `
                    <span class="min-w-0 truncate">${this.escapeHtml(table.name)}</span>
                    <span class="shrink-0 tabular-nums text-[10px] font-semibold ${isActive ? 'text-blue-700' : 'text-slate-400'}">${table.productCount ?? 0}</span>
                `;
                btn.addEventListener('click', async () => {
                    if (table.name !== this.currentTableName) {
                        await this.switchTable(table.name);
                    }
                });
                generalList.appendChild(btn);
            });
        }

        const dailyTables = tables
            .filter((t) => this.isDailyTableName(t.name))
            .map((t) => ({
                ...t,
                iso: this.getIsoFromDailyTableName(t.name),
            }))
            .sort((a, b) => (b.iso || '').localeCompare(a.iso || ''));

        dailyList.innerHTML = '';
        dailyList.classList.toggle('sayim-chip-scroll--empty', dailyTables.length === 0);
        if (dailyTables.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-[11px] text-indigo-800/85 px-2 py-1 text-center shrink-0 min-w-[min(100%,18rem)]';
            empty.textContent = 'Günlük kayıt yok. «Bugün» veya panodan ekleyin.';
            dailyList.appendChild(empty);
        } else {
            dailyTables.forEach((table) => {
                const label = this.formatDailyDateLabelFromIso(table.iso);
                const isActive = table.name === this.currentTableName;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('role', 'listitem');
                btn.dataset.tableName = table.name;
                btn.className = [
                    'sayim-table-chip shrink-0 inline-flex max-w-[min(100vw-4rem,12rem)] items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors snap-start sm:max-w-[14rem]',
                    isActive
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-950 shadow-sm ring-1 ring-indigo-200/50'
                        : 'border-indigo-200/90 bg-white/95 text-indigo-900/90 hover:bg-indigo-50/90 hover:border-indigo-300',
                ].join(' ');
                btn.innerHTML = `
                    <span class="min-w-0 truncate">${this.escapeHtml(label)}</span>
                    <span class="shrink-0 tabular-nums text-[10px] font-semibold ${isActive ? 'text-indigo-700' : 'text-indigo-400'}">${table.productCount ?? 0}</span>
                `;
                btn.addEventListener('click', async () => {
                    if (table.name !== this.currentTableName) {
                        await this.switchTable(table.name);
                    }
                });
                dailyList.appendChild(btn);
            });
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
            addProductBtn.addEventListener('click', () => this.handleManualAdd());
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
                    this.handleManualAdd();
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

        const dailyCountImportBtn = document.getElementById('dailyCountImportBtn');
        if (dailyCountImportBtn) {
            dailyCountImportBtn.addEventListener('click', () => {
                this.importDailyCountForToday();
            });
        }

        const sayimPasteModal = document.getElementById('sayimPasteModal');
        const sayimPasteOpenBtn = document.getElementById('sayimPasteOpenBtn');
        const sayimPasteTextarea = document.getElementById('sayimPasteTextarea');
        const sayimPasteCloseBtn = document.getElementById('sayimPasteCloseBtn');
        const sayimPasteCancelBtn = document.getElementById('sayimPasteCancelBtn');
        const sayimPasteConfirmBtn = document.getElementById('sayimPasteConfirmBtn');
        const closeSayimPasteModal = () => {
            if (sayimPasteModal) sayimPasteModal.classList.add('hidden');
            if (sayimPasteTextarea) sayimPasteTextarea.value = '';
        };
        if (sayimPasteOpenBtn && sayimPasteModal) {
            sayimPasteOpenBtn.addEventListener('click', () => {
                sayimPasteModal.classList.remove('hidden');
                if (sayimPasteTextarea) {
                    setTimeout(() => sayimPasteTextarea.focus(), 100);
                }
            });
        }
        [sayimPasteCloseBtn, sayimPasteCancelBtn].forEach((btn) => {
            if (btn) btn.addEventListener('click', closeSayimPasteModal);
        });
        if (sayimPasteModal) {
            sayimPasteModal.addEventListener('click', (e) => {
                if (e.target === sayimPasteModal) closeSayimPasteModal();
            });
        }
        if (sayimPasteConfirmBtn) {
            sayimPasteConfirmBtn.addEventListener('click', async () => {
                const text = sayimPasteTextarea?.value || '';
                if (sayimPasteModal) sayimPasteModal.classList.add('hidden');
                if (sayimPasteTextarea) sayimPasteTextarea.value = '';
                await this.importSayimPasteFromText(text);
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
        
        if (closeCreateTableModal) {
            closeCreateTableModal.addEventListener('click', () => {
                if (createTableModal) createTableModal.classList.add('hidden');
                if (newTableNameInput) newTableNameInput.value = '';
            });
        }
        
        if (cancelCreateTableBtn) {
            cancelCreateTableBtn.addEventListener('click', () => {
                if (createTableModal) createTableModal.classList.add('hidden');
                if (newTableNameInput) newTableNameInput.value = '';
            });
        }
        
        if (confirmCreateTableBtn) {
            confirmCreateTableBtn.addEventListener('click', async () => {
                const tableName = newTableNameInput?.value.trim();
                if (!tableName) {
                    this.showToast('Lütfen tablo adı girin', 'error', 3000);
                    return;
                }
                
                if (tableName.length > 50) {
                    this.showToast('Tablo adı maksimum 50 karakter olabilir', 'error', 3000);
                    return;
                }
                
                try {
                    await this.createTable(tableName);
                    if (createTableModal) createTableModal.classList.add('hidden');
                    if (newTableNameInput) newTableNameInput.value = '';
                    this.showToast('Tablo oluşturuldu', 'success', 3000);
                } catch (error) {
                    this.showToast(error.message || 'Tablo oluşturulamadı', 'error', 4000);
                }
            });
        }
        
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
        
        // Close modals on overlay click
        if (createTableModal) {
            createTableModal.addEventListener('click', (e) => {
                if (e.target === createTableModal) {
                    createTableModal.classList.add('hidden');
                    if (newTableNameInput) newTableNameInput.value = '';
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
                            this.updateProductStock(this.currentCountingProduct, value, null);
                            
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
            prevBtn.addEventListener('click', () => {
                if (!this.currentCountingProduct) return;
                
                const prevProductId = this.findPreviousUncountedProduct(this.currentCountingProduct);
                if (prevProductId) {
                    // Save current product first
                    const depoInput = document.getElementById('countingDepoInput');
                    if (depoInput) {
                        const value = depoInput.value.trim() === '' ? null : parseInt(depoInput.value);
                        this.updateProductStock(this.currentCountingProduct, value, null);
                        this.skippedProducts.delete(this.currentCountingProduct);
                    }
                    
                    // Open previous product
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
            nextBtn.addEventListener('click', () => {
                if (!this.currentCountingProduct) return;
                
                const nextProductId = this.findNextUncountedProduct(this.currentCountingProduct);
                if (nextProductId) {
                    // Save current product first
                    const depoInput = document.getElementById('countingDepoInput');
                    if (depoInput) {
                        const value = depoInput.value.trim() === '' ? null : parseInt(depoInput.value);
                        this.updateProductStock(this.currentCountingProduct, value, null);
                        this.skippedProducts.delete(this.currentCountingProduct);
                    }
                    
                    // Open next product
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
                this.closeCountingBottomSheet();
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const bottomSheet = document.getElementById('countingBottomSheet');
                if (bottomSheet && !bottomSheet.classList.contains('hidden')) {
                    this.closeCountingBottomSheet();
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
                if (!this.currentCountingProduct) return;
                
                const product = this.allProducts.find(p => p.id === this.currentCountingProduct);
                if (!product) return;
                
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
                    const result = await this.requestStockFromExtension(null, barcode, this.currentCountingProduct);
                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    const price = typeof result === 'object' ? result?.price : null;
                    const priceText = typeof result === 'object' ? result?.priceText : null;
                    
                    if (stock !== null && stock !== undefined) {
                        this.updateProductStock(this.currentCountingProduct, null, stock, price, priceText);
                        this.showToast('Sistem stoku yenilendi', 'success', 2000);
                        
                        // Update system stock display
                        const systemStockElement = document.getElementById('countingSystemStock');
                        if (systemStockElement) {
                            systemStockElement.textContent = `Sistem: ${stock}`;
                        }
                        
                        // Update stock indicator
                        const stockIndicator = document.getElementById('countingStockIndicator');
                        this.updateStockIndicator(this.currentCountingProduct, stockIndicator);
                    } else {
                        this.showToast('Ürün stoku bulunamadı', 'info', 3000);
                    }
                } catch (error) {
                    console.error('Error refreshing system stock:', error);
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
                this.closeCountingBottomSheet();
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
    }

    setupTabSystem() {
        const tabFinans = document.getElementById('tabFinans');
        const tabSayim = document.getElementById('tabSayim');
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
        } else {
            this.renderTable();
            this.updateViewMode();
        }
    }

    updateTabDisplay() {
        const tabFinans = document.getElementById('tabFinans');
        const tabSayim = document.getElementById('tabSayim');
        const finansTabContent = document.getElementById('finansTabContent');
        const sayimTabContent = document.getElementById('sayimTabContent');

        // Update tab buttons
        if (tabFinans && tabSayim) {
            if (this.currentTab === 'finans') {
                tabFinans.classList.add('active');
                tabSayim.classList.remove('active');
            } else {
                tabFinans.classList.remove('active');
                tabSayim.classList.add('active');
            }
        }

        // Update content visibility
        if (finansTabContent && sayimTabContent) {
            if (this.currentTab === 'finans') {
                finansTabContent.classList.remove('hidden');
                sayimTabContent.classList.add('hidden');
            } else {
                finansTabContent.classList.add('hidden');
                sayimTabContent.classList.remove('hidden');
            }
        }
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

    handleManualAdd() {
        const input = document.getElementById('manualProductInput');
        const value = input?.value.trim();
        if (!value) {
            this.showNotification('Lütfen ürün adı veya barkod girin', 'error');
            return;
        }

        // Search for product
        const product = this.findProduct(value);
        if (!product) {
            this.showNotification('Ürün bulunamadı', 'error');
            return;
        }

        // Add to counting table
        this.addProductToCounting(product);
        input.value = '';
        // Bildirim kaldırıldı - ürün sessizce ekleniyor
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
        
        return product;
    }

    addProductToCounting(product, options = {}) {
        if (!product || !product.id) {
            console.error('Invalid product:', product);
            return;
        }

        const productId = product.id;
        const now = new Date();
        const skipSave = options.skipSave === true;

        // If product already exists, update it
        if (this.countingData[productId]) {
            // Update existing entry
            const existing = this.countingData[productId];
            // Keep warehouse stock if it exists, otherwise reset
            if (!existing.warehouseStock) {
                existing.warehouseStock = null;
            }
            existing.lastUpdated = now.toISOString();
        } else {
            // Create new entry
            this.countingData[productId] = {
                warehouseStock: null,
                systemStock: null,
                lastUpdated: now.toISOString(),
                history: []
            };
        }

        if (skipSave) {
            return;
        }

        // Save and render
        this.saveCountingData();
        this.renderTable();
        
        // Update rapid mode if active
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
        }
        
        this.updateStatistics();
        this.updateCountingProgress();
    }

    updateProductStock(productId, warehouseStock, systemStock = null, price = null, priceText = null) {
        if (!this.countingData[productId]) {
            console.error('Product not found in counting data:', productId);
            return;
        }

        const now = new Date();
        const oldWarehouseStock = this.countingData[productId].warehouseStock;
        const oldSystemStock = this.countingData[productId].systemStock;

        // Add to history if value changed
        if (oldWarehouseStock !== warehouseStock || oldSystemStock !== systemStock) {
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
        this.countingData[productId].lastUpdated = now.toISOString();

        // Save and render
        this.saveCountingData();
        this.renderTable();
        
        // Update rapid mode if active
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
        }
        
        this.updateStatistics();
        this.updateCountingProgress();

        if (productId === this.currentCountingProduct) {
            this.updateCorrectEntryButtonState();
        }
    }

    deleteProduct(productId) {
        // Özel popup ile silme onayı
        this.showDeleteConfirmModal(productId);
    }

    // Sayım listesinden onay penceresi olmadan çıkar (manuel arama panelinden toggle için)
    removeProductFromCountingSilent(productId) {
        if (!this.countingData[productId]) return;
        delete this.countingData[productId];
        this.skippedProducts.delete(productId);
        this.saveCountingData();
        const bottomSheet = document.getElementById('countingBottomSheet');
        if (bottomSheet && !bottomSheet.classList.contains('hidden') && this.currentCountingProduct === productId) {
            this.closeCountingBottomSheet();
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
        const product = this.allProducts.find(p => p.id === productId);
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
            delete this.countingData[productId];
            this.skippedProducts.delete(productId);
            this.saveCountingData();
            
            // Close bottom sheet if it's open
            const bottomSheet = document.getElementById('countingBottomSheet');
            if (bottomSheet && !bottomSheet.classList.contains('hidden')) {
                this.closeCountingBottomSheet();
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
            if (productId === '_api_info' || productId === '_tables' || productId === '_currentTable') return false;
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
        for (let i = 0; i < productsToSync.length; i++) {
            const productId = productsToSync[i];
            const currentIndex = i + 1;
            
            try {
                const product = this.allProducts.find(p => p.id === productId);
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
                    const price = typeof result === 'object' ? result?.price : null;
                    const priceText = typeof result === 'object' ? result?.priceText : null;
                    
                    if (stock !== null && stock !== undefined) {
                        // Success - update stock and clear failed flag
                        if (this.countingData[productId]) {
                            this.countingData[productId].apiFetchFailed = false;
                        }
                        this.updateProductStock(productId, null, stock, price, priceText);
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
            const product = this.allProducts.find(p => p.id === id);
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

    async requestStockFromExtension(productName, barcode, productId = null) {
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
                    const result = await this.fetchStockFromAPI(apiInfo, barcode, productName, productId);
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

    async fetchStockFromAPI(apiInfo, barcode, productName, productId = null) {
        try {
            console.log('🌐 Direkt API çağrısı yapılıyor:', { 
                barcode, 
                productName, 
                productId,
                endpoint: apiInfo.stockEndpoint,
                hasToken: !!apiInfo.token,
                warehouseId: apiInfo.warehouseId
            });
            
            // Token geçerliliğini kontrol et
            if (apiInfo.tokenExpiry && Date.now() >= (apiInfo.tokenExpiry - 5 * 60 * 1000)) {
                throw new Error('Token süresi dolmuş. Lütfen Getir franchise sayfasını yenileyin.');
            }
            
            // Eğer productId yoksa ve barcode varsa, products.json'dan product ID'yi bul
            if (!productId && barcode) {
                const foundProduct = this.findProductByBarcode(barcode);
                if (foundProduct && foundProduct.productId) {
                    productId = foundProduct.productId;
                    console.log('✅ Barkod\'dan product ID bulundu:', { barcode, productId, productName: foundProduct.name });
                } else {
                    console.warn('⚠️ Barkod için product ID bulunamadı:', barcode);
                    throw new Error(`Barkod "${barcode}" için product ID bulunamadı. Lütfen products.json'da bu barkodun olduğundan emin olun.`);
                }
            }
            
            // Eğer productId hala yoksa ve productName varsa, isim ile product ID bul
            if (!productId && productName) {
                const foundProduct = this.findProductByName(productName);
                if (foundProduct && foundProduct.productId) {
                    productId = foundProduct.productId;
                    console.log('✅ İsimden product ID bulundu:', { productName, productId });
                } else {
                    console.warn('⚠️ İsim için product ID bulunamadı:', productName);
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
            
            console.log('📤 API isteği gönderiliyor:', { 
                url: urlWithParams, 
                method: 'POST',
                body: requestBody,
                hasToken: !!authToken,
                tokenPrefix: authToken.substring(0, 7),
                warehouseId: warehouseId
            });
            
            let response;
            try {
                // apiInfo.headers içinden User-Agent'ı filtrele (CORS hatası vermemesi için)
                const safeHeaders = {};
                if (apiInfo.headers && typeof apiInfo.headers === 'object') {
                    Object.keys(apiInfo.headers).forEach(key => {
                        // User-Agent ve user-agent header'larını atla
                        if (key.toLowerCase() !== 'user-agent') {
                            safeHeaders[key] = apiInfo.headers[key];
                        } else {
                            console.warn('⚠️ User-Agent header filtrelendi:', key);
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
                    console.warn('⚠️ User-Agent header final headers\'dan kaldırıldı');
                }
                
                console.log('📤 Fetch çağrısı başlatılıyor...', {
                    url: urlWithParams,
                    method: 'POST',
                    hasToken: !!authToken,
                    tokenLength: authToken ? authToken.length : 0,
                    warehouseId: warehouseId,
                    productId: productId,
                    headersCount: Object.keys(finalHeaders).length,
                    headerKeys: Object.keys(finalHeaders)
                });
                
                response = await fetch(urlWithParams, {
                    method: 'POST',
                    headers: finalHeaders,
                    body: JSON.stringify(requestBody),
                    // CORS için mode ve credentials ayarları
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                console.log('✅ Fetch çağrısı tamamlandı, response alındı:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                });
            } catch (fetchError) {
                console.error('❌ Fetch hatası detayları:', {
                    name: fetchError.name,
                    message: fetchError.message,
                    stack: fetchError.stack,
                    error: fetchError
                });
                
                // CORS hatası kontrolü
                if (fetchError.message && (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError'))) {
                    // CORS hatası olabilir - backend proxy gerekebilir
                    console.error('⚠️ CORS veya Network hatası tespit edildi. Bu, mobil tarayıcılarda yaygın bir sorundur.');
                    const errorDetails = {
                        name: fetchError.name,
                        message: fetchError.message,
                        stack: fetchError.stack,
                        url: urlWithParams,
                        hasToken: !!authToken,
                        tokenLength: authToken ? authToken.length : 0
                    };
                    console.error('📋 Hata detayları:', errorDetails);
                    throw new Error('API\'ye erişilemiyor (CORS/Network hatası). Detaylar: ' + fetchError.message + ' | URL: ' + urlWithParams.substring(0, 50) + '...');
                } else if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
                    console.error('📋 TypeError detayları:', {
                        name: fetchError.name,
                        message: fetchError.message,
                        stack: fetchError.stack
                    });
                    throw new Error('API çağrısı yapılamadı: ' + fetchError.message + '. Lütfen sayfayı yenileyip tekrar deneyin.');
                }
                console.error('📋 Genel hata detayları:', {
                    name: fetchError.name,
                    message: fetchError.message,
                    stack: fetchError.stack,
                    error: fetchError
                });
                throw new Error('API çağrısı başarısız: ' + (fetchError.message || fetchError.name || 'Bilinmeyen hata'));
            }
            
            if (!response.ok) {
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch (e) {
                    errorText = 'Yanıt okunamadı';
                }
                console.error('❌ API hatası:', response.status, response.statusText, errorText);
                
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
                console.log('📥 API yanıtı (text, ilk 500 karakter):', responseText.substring(0, 500));
                try {
                    data = JSON.parse(responseText);
                    console.log('📥 API yanıtı (parsed, ilk 1000 karakter):', JSON.stringify(data, null, 2).substring(0, 1000));
                } catch (parseError) {
                    console.error('❌ JSON parse hatası:', parseError);
                    throw new Error('API yanıtı geçersiz JSON formatında: ' + responseText.substring(0, 200));
                }
            } catch (textError) {
                console.error('❌ Response text okuma hatası:', textError);
                throw new Error('API yanıtı okunamadı: ' + (textError.message || 'Bilinmeyen hata'));
            }
            
            // Response format'ına göre stok değerini bul
            let stock = null;
            let foundProduct = null;
            
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
                    // 0 değeri de geçerli, bu yüzden || yerine explicit kontrol yap
                    if (foundProduct.available !== null && foundProduct.available !== undefined) {
                        stock = foundProduct.available;
                    } else if (foundProduct.stock !== null && foundProduct.stock !== undefined) {
                        stock = foundProduct.stock;
                    } else if (foundProduct.quantity !== null && foundProduct.quantity !== undefined) {
                        stock = foundProduct.quantity;
                    } else {
                        stock = null;
                    }
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
                    // 0 değeri de geçerli, bu yüzden || yerine explicit kontrol yap
                    if (foundProduct.available !== null && foundProduct.available !== undefined) {
                        stock = foundProduct.available;
                    } else if (foundProduct.stock !== null && foundProduct.stock !== undefined) {
                        stock = foundProduct.stock;
                    } else if (foundProduct.quantity !== null && foundProduct.quantity !== undefined) {
                        stock = foundProduct.quantity;
                    } else {
                        stock = null;
                    }
                    
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
                                    console.log(`✅ Kategori güncellendi (eski format): ${productId} -> ${category}${subCategory ? ` (Alt: ${subCategory})` : ''}`);
                                }
                                
                                // Alt kategori bilgisini de ekle (varsa)
                                if (subCategory && !this.allProducts[productIndex].subCategory) {
                                    this.allProducts[productIndex].subCategory = subCategory;
                                }
                            }
                        } else {
                            // Debug: Kategori bulunamadıysa logla
                            const currentProduct = this.allProducts.find(p => p.id === productId);
                            if (currentProduct && (!currentProduct.category || currentProduct.category === 'Genel')) {
                                console.log('⚠️ Kategori bulunamadı (eski format):', {
                                    productId,
                                    hasCategory: !!foundProduct.category,
                                    hasCategoryName: !!foundProduct.categoryName,
                                    hasMasterCategoryV2: !!foundProduct.masterCategoryV2,
                                    categoryType: foundProduct.category ? typeof foundProduct.category : 'none',
                                    categoryKeys: foundProduct.category ? Object.keys(foundProduct.category) : []
                                });
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
                                    console.log(`✅ Kategori güncellendi: ${productId} -> ${category}${subCategory ? ` (Alt: ${subCategory})` : ''}`);
                                }
                                
                                // Alt kategori bilgisini de ekle (varsa)
                                if (subCategory && !this.allProducts[productIndex].subCategory) {
                                    this.allProducts[productIndex].subCategory = subCategory;
                                }
                            }
                        } else {
                            // Debug: Kategori bulunamadıysa logla
                            const currentProduct = this.allProducts.find(p => p.id === productId);
                            if (currentProduct && (!currentProduct.category || currentProduct.category === 'Genel')) {
                                console.log('⚠️ Kategori bulunamadı:', {
                                    productId,
                                    hasCategory: !!foundProduct.category,
                                    hasCategoryName: !!foundProduct.categoryName,
                                    hasMasterCategoryV2: !!foundProduct.masterCategoryV2,
                                    categoryType: foundProduct.category ? typeof foundProduct.category : 'none',
                                    categoryKeys: foundProduct.category ? Object.keys(foundProduct.category) : []
                                });
                            }
                        }
                    }
                }
                
                console.log('✅ Stok değeri bulundu:', stock, foundProduct ? `(Ürün: ${foundProduct.name?.tr || foundProduct.fullName?.tr || 'N/A'})` : '');
                if (price !== null) {
                    console.log('💰 Fiyat bilgisi bulundu:', price, priceText ? `(${priceText})` : '');
                }
                
                // Return object with stock and price
                return {
                    stock: stock,
                    price: price,
                    priceText: priceText
                };
            }
            
            console.warn('⚠️ API yanıtında stok değeri bulunamadı. Response:', data);
            throw new Error('API yanıtında stok değeri bulunamadı');
            
        } catch (error) {
            console.error('❌ API çağrısı hatası:', error);
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
        
        // _api_info, _tables, _currentTable'u filtrele (sistem bilgisi, ürün değil)
        const productIds = Object.keys(this.countingData).filter(key => 
            key !== '_api_info' && key !== '_tables' && key !== '_currentTable'
        );
        
        if (productIds.length === 0) {
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

        // Apply sorting
        const sortedProductIds = this.applySorting(productIds);
        
        // Update sort icons
        this.updateSortIcons();

        // Render desktop table
        if (tableBody) {
            tableBody.innerHTML = sortedProductIds.map(productId => {
                const data = this.countingData[productId];
                const product = this.allProducts.find(p => p.id === productId);
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
                const product = this.allProducts.find(p => p.id === productId);
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

        // Setup event listeners for inputs and delete buttons
        this.setupTableEventListeners();
        
        // Render rapid counting mode if active
        if (this.currentViewMode === 'rapid') {
            this.renderRapidCountingMode();
        }
    }

    renderRapidCountingMode() {
        const gridContainer = document.getElementById('rapidCountingGridContainer');
        if (!gridContainer) return;

        // _api_info, _tables, _currentTable'u filtrele (sistem bilgisi, ürün değil)
        const productIds = Object.keys(this.countingData).filter(key => 
            key !== '_api_info' && key !== '_tables' && key !== '_currentTable'
        );
        
        if (productIds.length === 0) {
            gridContainer.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">Henüz ürün eklenmedi</div>';
            return;
        }

        // Apply sorting
        const sortedProductIds = this.applySorting(productIds);

        gridContainer.innerHTML = sortedProductIds.map(productId => {
            const data = this.countingData[productId];
            const product = this.allProducts.find(p => p.id === productId);
            if (!product) return '';

            const isCounted = data.warehouseStock !== null && data.warehouseStock !== undefined;
            const isSkipped = this.skippedProducts.has(productId);
            
            // Calculate stock difference for border color and icon
            const diff = this.calculateDifference(data.warehouseStock, data.systemStock);
            let stockIndicator = '';
            let borderClass = '';
            let statusIcon = '';
            
            if (isCounted && data.systemStock !== null && data.systemStock !== undefined) {
                if (diff.type === 'positive') {
                    // Fazla stok - yeşil çerçeve ve yeşil yuvarlak + yukarı ok
                    stockIndicator = '<div class="stock-indicator bg-emerald-400"></div>';
                    borderClass = 'border-2 border-green-500';
                    statusIcon = '<div class="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7"/></svg></div>';
                } else if (diff.type === 'negative') {
                    // Eksik stok - kırmızı çerçeve ve kırmızı yuvarlak + aşağı ok
                    stockIndicator = '<div class="stock-indicator bg-rose-400"></div>';
                    borderClass = 'border-2 border-red-500';
                    statusIcon = '<div class="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"/></svg></div>';
                } else {
                    // Eşit - gri çerçeve ve gri yuvarlak + eşittir işareti
                    stockIndicator = '<div class="stock-indicator bg-gray-300"></div>';
                    borderClass = 'border-2 border-gray-400';
                    statusIcon = '<div class="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 9h14M5 15h14"/></svg></div>';
                }
            } else {
                // Sayılmamış - mavi yuvarlak
                borderClass = '';
                statusIcon = '<div class="w-3 h-3 border-2 border-blue-500 rounded-full"></div>';
            }
            
            const cardClass = isCounted ? 'counted' : 'not-counted';
            
            // Always show product name, not Qty
            const productName = product.name || 'Ürün';
            const productImage = product.image || '../assets/logo.png';
            const barcode = product.barcodes && product.barcodes.length > 0 ? product.barcodes[0].code : '';

            return `
                <div class="rapid-product-card ${cardClass} ${borderClass}" data-product-id="${productId}">
                    <div class="product-status-icon">
                        ${statusIcon}
                    </div>
                    ${stockIndicator}
                    <div class="flex-1 flex flex-col p-1 sm:p-1.5 overflow-hidden">
                        <div class="flex-1 flex items-center justify-center mb-0.5 sm:mb-1 min-h-0 overflow-hidden">
                            <img src="${productImage}" alt="${product.name || ''}" class="max-w-full max-h-full w-auto h-auto object-contain" onerror="this.src='../assets/logo.png'">
                        </div>
                        <div class="text-center flex-shrink-0 px-0.5">
                            <p class="text-[9px] sm:text-[10px] font-semibold text-gray-900 line-clamp-1 leading-tight truncate">${productName}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Setup click event listeners for cards
        gridContainer.querySelectorAll('.rapid-product-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const productId = card.dataset.productId;
                if (productId) {
                    this.openCountingBottomSheet(productId);
                }
            });
        });
    }

    findNextUncountedProduct(currentProductId) {
        // Get all product IDs from countingData (excluding non-product keys)
        const productIds = Object.keys(this.countingData).filter(
            key => key !== '_api_info' && key !== '_tables' && key !== '_currentTable'
        );
        
        // Find current product index
        const currentIndex = productIds.indexOf(currentProductId);
        if (currentIndex === -1) return null;
        
        // Start searching from next product
        for (let i = currentIndex + 1; i < productIds.length; i++) {
            const productId = productIds[i];
            const data = this.countingData[productId] || {};
            // Check if product is not counted (warehouseStock is null/undefined)
            if (data.warehouseStock === null || data.warehouseStock === undefined) {
                return productId;
            }
        }
        
        // If not found after current, search from beginning
        for (let i = 0; i < currentIndex; i++) {
            const productId = productIds[i];
            const data = this.countingData[productId] || {};
            // Check if product is not counted (warehouseStock is null/undefined)
            if (data.warehouseStock === null || data.warehouseStock === undefined) {
                return productId;
            }
        }
        
        return null; // No uncounted product found
    }

    findPreviousUncountedProduct(currentProductId) {
        // Get all product IDs from countingData (excluding non-product keys)
        const productIds = Object.keys(this.countingData).filter(
            key => key !== '_api_info' && key !== '_tables' && key !== '_currentTable'
        );
        
        // Find current product index
        const currentIndex = productIds.indexOf(currentProductId);
        if (currentIndex === -1) return null;
        
        // Start searching backwards from previous product
        for (let i = currentIndex - 1; i >= 0; i--) {
            const productId = productIds[i];
            const data = this.countingData[productId] || {};
            // Check if product is not counted (warehouseStock is null/undefined)
            if (data.warehouseStock === null || data.warehouseStock === undefined) {
                return productId;
            }
        }
        
        // If not found before current, search from end
        for (let i = productIds.length - 1; i > currentIndex; i--) {
            const productId = productIds[i];
            const data = this.countingData[productId] || {};
            // Check if product is not counted (warehouseStock is null/undefined)
            if (data.warehouseStock === null || data.warehouseStock === undefined) {
                return productId;
            }
        }
        
        return null; // No uncounted product found
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
        const product = this.allProducts.find((p) => p.id === this.currentCountingProduct);
        const hasCodes = product && this.getExpectedBarcodeStringsForProduct(product).size > 0;
        btn.disabled = !hasCodes || this._barcodeVerifyInProgress;
    }

    async beginBarcodeVerificationForCurrentProduct() {
        if (this._barcodeVerifyInProgress) return;
        if (!this.currentCountingProduct) {
            this.showToast('Önce bir ürün seçin', 'warning', 2500);
            return;
        }
        const product = this.allProducts.find((p) => p.id === this.currentCountingProduct);
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
            if (match) {
                this.showToast('Eşleşiyor: Okutulan barkod bu ürüne ait.', 'success', 3500);
                if (typeof bs.playVerificationMatchSound === 'function') {
                    bs.playVerificationMatchSound();
                } else if (typeof bs.playSuccessSound === 'function') {
                    bs.playSuccessSound();
                }
            } else {
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
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._countingSheetScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
    }

    unlockCountingSheetScroll() {
        if (!this._countingSheetBodyLocked) return;
        this._countingSheetBodyLocked = false;
        const y = this._countingSheetScrollY || 0;
        document.documentElement.classList.remove('bottom-sheet-open');
        document.body.classList.remove('bottom-sheet-open');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(0, y);
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
        const product = this.allProducts.find(p => p.id === productId);
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
        const systemStockElement = document.getElementById('countingSystemStock');

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
        
        // Update system stock display
        if (systemStockElement) {
            if (data.systemStock !== null && data.systemStock !== undefined) {
                systemStockElement.textContent = `Sistem: ${data.systemStock}`;
            } else {
                systemStockElement.textContent = '';
            }
        }

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
                    depoInput.focus();
                }
            }, 450);
        }
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

    closeCountingBottomSheet() {
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
                this.updateProductStock(this.currentCountingProduct, value, null);
                
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
        const totalProducts = Object.keys(this.countingData).length;
        const countedProducts = Object.values(this.countingData).filter(
            data => data.warehouseStock !== null && data.warehouseStock !== undefined
        ).length;
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

    setupTableEventListeners() {
        // Warehouse stock inputs
        const warehouseInputs = document.querySelectorAll('.warehouse-stock-input');
        warehouseInputs.forEach(input => {
            // Klavye ile sadece sayı girişine izin ver (harfler, özel karakterler engelle)
            input.addEventListener('keydown', (e) => {
                // İzin verilen tuşlar: sayılar (0-9), Backspace, Delete, Tab, Arrow keys, Home, End
                const allowedKeys = [
                    'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                    'Home', 'End', 'Enter'
                ];
                
                // Sayı tuşları (0-9) veya izin verilen tuşlar
                const isNumber = e.key >= '0' && e.key <= '9';
                const isAllowedKey = allowedKeys.includes(e.key);
                
                // Ctrl/Cmd + A, C, V, X gibi kısayolları izin ver
                const isCtrlKey = e.ctrlKey || e.metaKey;
                const isCopyPaste = isCtrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase());
                
                if (!isNumber && !isAllowedKey && !isCopyPaste) {
                    e.preventDefault();
                }
            });
            
            // Input event'inde sadece sayıları kabul et (harfler, özel karakterler kaldır)
            input.addEventListener('input', (e) => {
                let value = e.target.value;
                // Sadece sayıları bırak, diğer her şeyi kaldır
                value = value.replace(/[^0-9]/g, '');
                // Eğer değer değiştiyse güncelle
                if (e.target.value !== value) {
                    e.target.value = value;
                }
            });
            
            // Paste event'inde de sadece sayıları kabul et
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                // Sadece sayıları al
                const numbersOnly = pastedText.replace(/[^0-9]/g, '');
                if (numbersOnly) {
                    e.target.value = numbersOnly;
                    // Change event'ini tetikle
                    e.target.dispatchEvent(new Event('change'));
                }
            });
            
            input.addEventListener('change', (e) => {
                const productId = e.target.dataset.productId;
                let value = e.target.value.trim();
                
                // Boşsa null, değilse sayıya çevir
                if (value === '') {
                    value = null;
                    e.target.value = ''; // Boş bırak
                } else {
                    // Sadece pozitif tam sayıları kabul et
                    const numValue = Math.max(0, Math.floor(Number(value)));
                    value = numValue;
                    // Input değerini güncelle (0'ı da göster)
                    e.target.value = String(value);
                }
                
                this.updateProductStock(productId, value, null);
            });
        });

        // Warehouse stock increase/decrease buttons
        const increaseButtons = document.querySelectorAll('.warehouse-stock-increase-btn');
        increaseButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const productId = btn.dataset.productId;
                const input = document.querySelector(`.warehouse-stock-input[data-product-id="${productId}"]`);
                if (input) {
                    let currentValue = parseInt(input.value) || 0;
                    currentValue += 1;
                    input.value = currentValue;
                    // Change event'ini tetikle
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });

        const decreaseButtons = document.querySelectorAll('.warehouse-stock-decrease-btn');
        decreaseButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const productId = btn.dataset.productId;
                const input = document.querySelector(`.warehouse-stock-input[data-product-id="${productId}"]`);
                if (input) {
                    // Boş string veya NaN ise 0 olarak kabul et
                    let currentValue = input.value === '' || isNaN(parseInt(input.value)) ? 0 : parseInt(input.value);
                    currentValue = Math.max(0, currentValue - 1); // Minimum 0
                    input.value = String(currentValue); // 0'ı da göster
                    // Change event'ini tetikle
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });

        // Delete buttons
        const deleteButtons = document.querySelectorAll('.delete-product-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.closest('[data-product-id]').dataset.productId;
                this.deleteProduct(productId);
            });
        });

        // Refresh system stock buttons (when system stock exists)
        const refreshButtons = document.querySelectorAll('.refresh-system-stock-btn');
        refreshButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const productId = btn.dataset.productId;
                const barcode = btn.dataset.barcode;
                
                if (!barcode) {
                    this.showNotification('Bu ürün için barkod bulunamadı', 'error');
                    return;
                }

                // Disable button and show loading
                const originalContent = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner" style="width: 10px; height: 10px; border: 2px solid #f3f4f4; border-top: 2px solid #6b7280; border-radius: 50%; animation: spin 1s linear infinite;"></div>';

                try {
                    const result = await this.requestStockFromExtension(null, barcode, productId);
                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    const price = typeof result === 'object' ? result?.price : null;
                    const priceText = typeof result === 'object' ? result?.priceText : null;
                    
                    if (stock !== null && stock !== undefined) {
                        // Başarılı - apiFetchFailed flag'ini temizle
                        if (this.countingData[productId]) {
                            this.countingData[productId].apiFetchFailed = false;
                        }
                        this.updateProductStock(productId, null, stock, price, priceText);
                        // Toast bildirimi göster
                        this.showToast('Stok güncellendi', 'success', 3000);
                    } else {
                        // Bulunamadı - apiFetchFailed flag'ini set et
                        if (this.countingData[productId]) {
                            this.countingData[productId].apiFetchFailed = true;
                            this.saveCountingData();
                            this.renderTable();
                        }
                        this.showToast('Ürün stoku bulunamadı', 'info', 3000);
                    }
                } catch (error) {
                    console.error('Error refreshing system stock:', error);
                    // Başarısız - apiFetchFailed flag'ini set et
                    if (this.countingData[productId]) {
                        this.countingData[productId].apiFetchFailed = true;
                        this.saveCountingData();
                        this.renderTable();
                    }
                    this.showToast('Stok alınamadı: ' + (error.message || 'Bilinmeyen hata'), 'error', 4000);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            });
        });

        // Single product sync buttons
        const syncButtons = document.querySelectorAll('.sync-single-product-btn');
        syncButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const productId = btn.dataset.productId;
                const barcode = btn.dataset.barcode;
                
                if (!barcode) {
                    this.showNotification('Bu ürün için barkod bulunamadı', 'error');
                    return;
                }

                // Disable button and show loading
                const originalContent = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner" style="width: 12px; height: 12px; border: 2px solid #f3f4f6; border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>';

                try {
                    const result = await this.requestStockFromExtension(null, barcode, productId);
                    const stock = typeof result === 'number' ? result : (result?.stock ?? null);
                    const price = typeof result === 'object' ? result?.price : null;
                    const priceText = typeof result === 'object' ? result?.priceText : null;
                    
                    if (stock !== null && stock !== undefined) {
                        // Başarılı - apiFetchFailed flag'ini temizle
                        if (this.countingData[productId]) {
                            this.countingData[productId].apiFetchFailed = false;
                        }
                        this.updateProductStock(productId, null, stock, price, priceText);
                        // Bildirim kaldırıldı - stok sessizce güncelleniyor
                    } else {
                        // Bulunamadı - apiFetchFailed flag'ini set et
                        if (this.countingData[productId]) {
                            this.countingData[productId].apiFetchFailed = true;
                            this.saveCountingData();
                            this.renderTable();
                        }
                        this.showNotification('Ürün stoku bulunamadı', 'info');
                    }
                } catch (error) {
                    console.error('Error syncing single product:', error);
                    // Başarısız - apiFetchFailed flag'ini set et
                    if (this.countingData[productId]) {
                        this.countingData[productId].apiFetchFailed = true;
                        this.saveCountingData();
                        this.renderTable();
                    }
                    this.showNotification('Stok alınamadı: ' + (error.message || 'Bilinmeyen hata'), 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            });
        });
    }

    updateStatistics() {
        // _api_info ve _tables metadata'sını filtrele (sistem bilgisi, ürün değil)
        const productIds = Object.keys(this.countingData).filter(key => 
            key !== '_api_info' && 
            key !== '_tables' && 
            key !== '_currentTable'
        );
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
                const product = this.allProducts.find(p => p.id === productId);
                if (product) {
                    // Check if product is already added
                    const isAlreadyAdded = this.countingData[productId] !== undefined;
                    
                    if (!isAlreadyAdded) {
                        // Add product
                    this.addProductToCounting(product);
                        
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
    
    // Apply sorting to product list
    applySorting(productIds) {
        // Use current sort state (set by header clicks)
        if (!this.currentSort) {
            return productIds;
        }
        
        const { field, direction } = this.currentSort;
        
        // Create array with product data for sorting
        const productsWithData = productIds.map(productId => {
            const data = this.countingData[productId];
            const product = this.allProducts.find(p => p.id === productId);
            return { productId, data, product };
        }).filter(item => item.data && item.product);
        
        // Apply sorting
        productsWithData.sort((a, b) => {
            let comparison = 0;
            
            if (field === 'productName') {
                const nameA = (a.product?.name || '').toLowerCase();
                const nameB = (b.product?.name || '').toLowerCase();
                comparison = nameA.localeCompare(nameB, 'tr');
                if (direction === 'desc') comparison *= -1;
            } else if (field === 'warehouseStock') {
                const stockA = a.data.warehouseStock ?? -Infinity;
                const stockB = b.data.warehouseStock ?? -Infinity;
                comparison = Number(stockA) - Number(stockB);
                if (direction === 'desc') comparison *= -1;
            } else if (field === 'systemStock') {
                const stockA = a.data.systemStock ?? -Infinity;
                const stockB = b.data.systemStock ?? -Infinity;
                comparison = Number(stockA) - Number(stockB);
                if (direction === 'desc') comparison *= -1;
            } else if (field === 'difference') {
                // Gerçek fark değerini hesapla (negatif veya pozitif)
                // calculateDifference negatif farklar için Math.abs kullanıyor, bu yüzden direkt hesaplama yapıyoruz
                const warehouseA = a.data.warehouseStock ?? null;
                const systemA = a.data.systemStock ?? null;
                const warehouseB = b.data.warehouseStock ?? null;
                const systemB = b.data.systemStock ?? null;
                
                // Her iki değer de varsa farkı hesapla, yoksa null
                let valueA = null;
                let valueB = null;
                
                if (warehouseA !== null && warehouseA !== undefined && systemA !== null && systemA !== undefined) {
                    valueA = Number(warehouseA) - Number(systemA);
                }
                if (warehouseB !== null && warehouseB !== undefined && systemB !== null && systemB !== undefined) {
                    valueB = Number(warehouseB) - Number(systemB);
                }
                
                // null değerleri en sona at
                if (valueA === null && valueB === null) {
                    comparison = 0;
                } else if (valueA === null) {
                    comparison = 1; // A null ise B'den sonra
                } else if (valueB === null) {
                    comparison = -1; // B null ise A'dan sonra
                } else {
                    comparison = Number(valueA) - Number(valueB);
                }
                
                if (direction === 'desc') comparison *= -1;
            } else if (field === 'date') {
                const dateA = a.data.lastUpdated ? new Date(a.data.lastUpdated).getTime() : 0;
                const dateB = b.data.lastUpdated ? new Date(b.data.lastUpdated).getTime() : 0;
                comparison = dateA - dateB;
                if (direction === 'desc') comparison *= -1;
            }
            
            return comparison;
        });
        
        return productsWithData.map(item => item.productId);
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
    addProductFromManualInput(productId) {
        const product = this.allProducts.find(p => p.id === productId);
        if (!product) return;

        const manualInput = document.getElementById('manualProductInput');
        const resultsContainer = document.getElementById('manualInputResults');
        const currentQuery = manualInput ? manualInput.value.trim() : '';

        if (this.countingData[productId]) {
            this.removeProductFromCountingSilent(productId);
        } else {
            this.addProductToCounting(product);
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
        const newTableNameInput = document.getElementById('newTableNameInput');
        if (createTableModal && newTableNameInput) {
            newTableNameInput.value = '';
            createTableModal.classList.remove('hidden');
            // Focus on input
            setTimeout(() => newTableNameInput.focus(), 100);
        }
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
        const productIds = Object.keys(this.countingData).filter(id => 
            id !== '_api_info' && id !== '_tables' && id !== '_currentTable'
        );
        
        productIds.forEach(productId => {
            if (this.countingData[productId]) {
                const data = this.countingData[productId];
                if (data.warehouseStock !== null && data.warehouseStock !== undefined) {
                    this.countingData[productId].warehouseStock = null;
                    resetCount++;
                }
            }
        });
        
        if (resetCount > 0) {
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
        const productIds = Object.keys(this.countingData).filter(id => 
            id !== '_api_info' && id !== '_tables' && id !== '_currentTable'
        );
        
        productIds.forEach(productId => {
            if (this.countingData[productId]) {
                const data = this.countingData[productId];
                if (data.systemStock !== null && data.systemStock !== undefined) {
                    this.countingData[productId].systemStock = null;
                    this.countingData[productId].apiFetchFailed = false; // Reset failed flag too
                    resetCount++;
                }
            }
        });
        
        if (resetCount > 0) {
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
        
        // Check if new name already exists
        if (tables.some(t => t.name === trimmedNew)) {
            throw new Error('Bu isimde bir tablo zaten mevcut');
        }
        
        // Get full data structure
        let fullData = null;
        if (window.supabase && this.currentUser) {
            // Try to get from localStorage first (faster)
            const storageKey = `${this.STORAGE_KEY}_${this.currentUser.username}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                try {
                    fullData = JSON.parse(stored);
                } catch (e) {
                    console.error('Error parsing localStorage data:', e);
                }
            }
            
            // If not in localStorage, get from Supabase
            if (!fullData) {
                const { data, error } = await window.supabase
                    .from('users')
                    .select('counting_data')
                    .eq('username', this.currentUser.username)
                    .single();
                
                if (error) {
                    console.error('Error loading counting data:', error);
                    throw new Error('Veri yüklenemedi');
                }
                
                fullData = this.migrateCountingData(data.counting_data || {});
            }
        } else {
            // Fallback to localStorage only
            const storageKey = this.STORAGE_KEY;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                try {
                    fullData = JSON.parse(stored);
                    fullData = this.migrateCountingData(fullData);
                } catch (e) {
                    console.error('Error parsing localStorage data:', e);
                    throw new Error('Veri yüklenemedi');
                }
            } else {
                throw new Error('Veri bulunamadı');
            }
        }
        
        if (!fullData || !fullData._tables) {
            throw new Error('Tablo yapısı bulunamadı');
        }
        
        // Get current table data
        const currentTableData = fullData._tables[oldName];
        if (!currentTableData) {
            throw new Error('Tablo bulunamadı');
        }
        
        // Rename in _tables
        fullData._tables[trimmedNew] = currentTableData;
        delete fullData._tables[oldName];
        
        // Update current table name if it was the active one
        if (this.currentTableName === oldName) {
            this.currentTableName = trimmedNew;
            this.countingData = currentTableData;
        }
        fullData._currentTable = this.currentTableName;
        
        // Save changes
        await this.saveFullCountingData(fullData);
        
        // Update UI
        this.updateTableSelector();
        this.renderTable();
    }
    
    // Handle header sort click
    handleHeaderSort(sortField, headerElement) {
        // Get current sort state
        const isActive = this.currentSort && this.currentSort.field === sortField;
        const isAsc = isActive && this.currentSort.direction === 'asc';
        const isDesc = isActive && this.currentSort.direction === 'desc';
        
        // Determine new sort state: none -> asc -> desc -> none
        let newSort = null;
        if (!isActive) {
            // First click: ascending
            newSort = 'asc';
        } else if (isAsc) {
            // Second click: descending
            newSort = 'desc';
        } else {
            // Third click: no sort
            newSort = null;
        }
        
        // Store current sort
        this.currentSort = newSort ? { field: sortField, direction: newSort } : null;
        
        // Apply sort and re-render
        this.renderTable();
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
            
            // Get API info from Supabase and extension (karşılaştırma için)
            let apiInfo = null;
            let extensionApiInfo = null;
            
            // Try to get from Supabase first
            if (window.supabase && this.currentUser) {
                const { data: userData } = await window.supabase
                    .from('users')
                    .select('counting_data')
                    .eq('username', this.currentUser.username)
                    .maybeSingle();
                
                if (userData && userData.counting_data) {
                    const countingData = typeof userData.counting_data === 'string' 
                        ? JSON.parse(userData.counting_data) 
                        : userData.counting_data;
                    apiInfo = countingData._api_info || null;
                }
            }
            
            // Try extension (karşılaştırma için)
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    // Extension ID'yi al (extension helper'dan veya hardcoded)
                    const extensionId = window.getirExtensionHelper?.extensionId || 'dhgdhdnnpeakmomlgpgmokecmdmeoebn';
                    
                    const response = await new Promise((resolve) => {
                        chrome.runtime.sendMessage(
                            extensionId,
                            { type: 'GET_API_INFO' },
                            (response) => {
                                if (chrome.runtime.lastError) {
                                    resolve(null);
                                } else {
                                    resolve(response);
                                }
                            }
                        );
                    });
                    
                    if (response && response.success && response.apiInfo) {
                        extensionApiInfo = response.apiInfo;
                    }
                } catch (error) {
                    // Silent fail
                }
            }
            
            // Fallback: window.getirExtensionHelper
            if (!extensionApiInfo && typeof window !== 'undefined' && window.getirExtensionHelper) {
                try {
                    extensionApiInfo = await window.getirExtensionHelper.getAPIInfo();
                } catch (error) {
                    // Silent fail
                }
            }
            
            // Fallback: localStorage
            if (!extensionApiInfo) {
                const apiInfoKey = 'getir_api_info';
                const apiInfoStr = localStorage.getItem(apiInfoKey);
                if (apiInfoStr) {
                    try {
                        extensionApiInfo = JSON.parse(apiInfoStr);
                    } catch (e) {
                        // Silent fail
                    }
                }
            }
            
            // Extension'dan gelen token'ı Supabase'dekiyle karşılaştır
            // Eğer extension'daki token daha geçerliyse (daha uzun süre kaldıysa), güncelle
            if (extensionApiInfo && extensionApiInfo.token) {
                // Eğer Supabase'de token yoksa, extension'dan gelen token'ı kullan
                if (!apiInfo || !apiInfo.token) {
                    console.log('🔄 Supabase\'de token yok, extension\'dan gelen token kullanılıyor');
                    apiInfo = extensionApiInfo;
                    // Supabase'e kaydet
                    await this.checkAndSaveAPIInfoFromExtension();
                } else {
                    // Her iki token'ın expiry'sini karşılaştır
                    let supabaseExpiryTime = null;
                    let extensionExpiryTime = null;
                    
                    if (apiInfo.tokenExpiry) {
                        if (typeof apiInfo.tokenExpiry === 'number') {
                            supabaseExpiryTime = apiInfo.tokenExpiry;
                        } else if (typeof apiInfo.tokenExpiry === 'string') {
                            supabaseExpiryTime = new Date(apiInfo.tokenExpiry).getTime();
                            if (isNaN(supabaseExpiryTime)) {
                                supabaseExpiryTime = parseInt(apiInfo.tokenExpiry, 10);
                            }
                        }
                    }
                    
                    if (extensionApiInfo.tokenExpiry) {
                        if (typeof extensionApiInfo.tokenExpiry === 'number') {
                            extensionExpiryTime = extensionApiInfo.tokenExpiry;
                        } else if (typeof extensionApiInfo.tokenExpiry === 'string') {
                            extensionExpiryTime = new Date(extensionApiInfo.tokenExpiry).getTime();
                            if (isNaN(extensionExpiryTime)) {
                                extensionExpiryTime = parseInt(extensionApiInfo.tokenExpiry, 10);
                            }
                        }
                    }
                    
                    // Eğer extension'daki token daha geçerliyse (daha uzun süre kaldıysa), güncelle
                    // Extension'dan gelen token'ı öncelikli olarak kabul et
                    // Çünkü extension daha güncel token yakalıyor
                    const supabaseToken = apiInfo?.token?.substring(7)?.trim() || '';
                    const extensionToken = extensionApiInfo?.token?.substring(7)?.trim() || '';
                    
                    // Token değeri farklıysa veya extension'dan gelen token daha güncelse, güncelle
                    if (extensionToken && extensionToken !== supabaseToken) {
                        // Token değeri farklı, extension'dan gelen token'ı kullan
                        console.log('🔄 Extension\'dan yeni token geldi, güncelleniyor');
                        apiInfo = extensionApiInfo;
                        await this.checkAndSaveAPIInfoFromExtension();
                    } else if (supabaseExpiryTime && extensionExpiryTime && !isNaN(supabaseExpiryTime) && !isNaN(extensionExpiryTime)) {
                        const supabaseTimeRemaining = supabaseExpiryTime - Date.now();
                        const extensionTimeRemaining = extensionExpiryTime - Date.now();
                        
                        // Extension'daki token daha geçerliyse (daha uzun süre kaldıysa) veya her ikisi de süresi dolmuşsa extension'ı kullan
                        if (extensionTimeRemaining > supabaseTimeRemaining || (extensionTimeRemaining < 0 && supabaseTimeRemaining < 0)) {
                            // Extension'daki token daha geçerli veya her ikisi de süresi dolmuş, extension'ı kullan
                            console.log('🔄 Extension\'dan gelen token kullanılıyor:', {
                                supabaseTimeRemaining: Math.floor(supabaseTimeRemaining / (1000 * 60)) + ' dakika',
                                extensionTimeRemaining: Math.floor(extensionTimeRemaining / (1000 * 60)) + ' dakika'
                            });
                            apiInfo = extensionApiInfo;
                            // Supabase'e kaydet
                            await this.checkAndSaveAPIInfoFromExtension();
                        } else {
                            console.log('ℹ️ Supabase\'deki token daha geçerli, güncelleme yapılmıyor');
                        }
                    } else if (extensionExpiryTime && !isNaN(extensionExpiryTime)) {
                        // Supabase'de expiry yok ama extension'da var, güncelle
                        console.log('🔄 Extension\'da expiry var, Supabase\'e güncelleniyor');
                        apiInfo = extensionApiInfo;
                        await this.checkAndSaveAPIInfoFromExtension();
                    } else if (extensionToken && !supabaseToken) {
                        // Extension'da token var ama Supabase'de yok, güncelle
                        console.log('🔄 Extension\'da token var, Supabase\'e güncelleniyor');
                        apiInfo = extensionApiInfo;
                        await this.checkAndSaveAPIInfoFromExtension();
                    }
                }
            } else if (!apiInfo && extensionApiInfo) {
                // Fallback: extension'dan gelen token'ı kullan
                apiInfo = extensionApiInfo;
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
                if (productId === '_api_info' || productId === '_tables' || productId === '_currentTable') {
                    continue;
                }

                const product = this.allProducts.find(p => p.id === productId);
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
                const barcode =
                    product.barcodes && product.barcodes[0] && product.barcodes[0].code
                        ? String(product.barcodes[0].code)
                        : '';
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
                    stockDiff: warehouseStock - systemStock
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
            const bc = p.barcode ? this.escapeHtml(p.barcode) : '—';
            const adetStr = p.stockDiff > 0 ? `+${p.stockDiff}` : `${p.stockDiff}`;
            const adetLabel = kind === 'miss' ? `${adetStr} adet eksik` : `${adetStr} adet fazla`;
            const tone =
                kind === 'miss'
                    ? { bar: 'border-l-rose-400 bg-rose-50/35', ad: 'text-rose-700', tl: 'text-rose-800' }
                    : { bar: 'border-l-emerald-400 bg-emerald-50/35', ad: 'text-emerald-700', tl: 'text-emerald-800' };
            return `
                <div class="flex gap-2.5 rounded-lg border border-gray-100 ${tone.bar} border-l-[3px] p-2.5 pl-2">
                    <img src="${img}" alt="" class="h-11 w-11 shrink-0 rounded-lg border border-white object-cover shadow-sm" loading="lazy" />
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium leading-snug text-gray-900 [overflow-wrap:anywhere]">${name}</p>
                        <p class="mt-0.5 font-mono text-[10px] text-gray-400">${bc}</p>
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


