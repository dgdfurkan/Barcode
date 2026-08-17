// User Data Management System
class UserDataManager {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this._saveUserDataPromise = null;
        this._allProductsCache = null;
    }

    _invalidateAllProductsCache() {
        this._allProductsCache = null;
    }

    // Initialize user data
    async init() {
        const session = window.authUtils.checkAuth();
        if (!session) {
            throw new Error('User not authenticated');
        }
        
        this.currentUser = session;
        await this.loadUserData();
    }

    // Load user-specific data (ONLY from custom_products and settings columns)
    // Note: 'data' column has been removed - only new columns are used
    async loadUserData() {
        try {
            // Try to load from Supabase first
            if (window.supabase) {
                // Load from new structure (custom_products + settings columns)
                const { data, error } = await window.supabase
                    .from('user_data')
                    .select('custom_products, settings')
                    .eq('username', this.currentUser.username)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!error && data && (data.custom_products !== null || data.settings !== null)) {
                    // New structure: separate columns
                    console.log('📦 Loading from new structure (custom_products + settings columns)');
                    this.userData = {
                        products: data.custom_products || [],
                        settings: data.settings || {}
                    };
                    this._invalidateAllProductsCache();
                    
                    // Clean default products if any exist (they should come from PRODUCTS_DATA)
                    if (this.userData.products && Array.isArray(this.userData.products)) {
                        const beforeCount = this.userData.products.length;
                        this.userData.products = this.userData.products.filter(p => !p.isDefault);
                        const afterCount = this.userData.products.length;
                        
                        if (beforeCount !== afterCount) {
                            console.log(`🧹 Cleaned ${beforeCount - afterCount} default products from user_data`);
                            this.saveUserData().catch(err => console.warn('Failed to save cleaned data:', err));
                        }
                    }
                    
                    return;
                } else if (error && error.code === 'PGRST116') {
                    // No row found - create default data
                    console.log('📦 No user data found, creating default');
                    this.userData = this.createDefaultUserData();
                    await this.saveUserData();
                    return;
                } else if (error) {
                    // Other error
                    console.error('Error loading user data:', error);
                    throw error;
                }
            }
            
            // Fallback to local storage
            const localData = localStorage.getItem(`userData_${this.currentUser.username}`);
            if (localData) {
                this.userData = JSON.parse(localData);
                // MIGRATION: Remove default products from local storage too
                if (this.userData.products && Array.isArray(this.userData.products)) {
                    this.userData.products = this.userData.products.filter(p => !p.isDefault);
                }
                
                // Remove statistics and searchHistory from local storage
                if (this.userData.statistics) {
                    delete this.userData.statistics;
                }
                if (this.userData.settings && this.userData.settings.searchHistory) {
                    delete this.userData.settings.searchHistory;
                }
            } else {
                // Create default user data
                this.userData = this.createDefaultUserData();
            }
        } catch (error) {
            console.warn('Error loading user data:', error);
            this.userData = this.createDefaultUserData();
        }
    }

    // Create default user data structure WITHOUT default products
    // Default products are always loaded from PRODUCTS_DATA, not stored in user_data
    // Statistics and searchHistory are removed as per requirements
    createDefaultUserData() {
        return {
            products: [], // Only custom products added by user, NOT default products
            settings: {
                showDuplicates: false,
                theme: 'light',
                showDefaultProducts: true
                // searchHistory and statistics removed - will be added later if needed
            }
        };
    }

    // Save user data (ONLY to custom_products and settings columns, NOT to data column)
    async saveUserData() {
        if (this._saveUserDataPromise) {
            return this._saveUserDataPromise;
        }
        this._saveUserDataPromise = this._saveUserDataInternal();
        try {
            await this._saveUserDataPromise;
        } finally {
            this._saveUserDataPromise = null;
        }
    }

    async _saveUserDataInternal() {
        try {
            const customProducts = (this.userData.products || []).filter((p) => !p.isDefault);
            const settings = this.userData.settings || {};

            if (window.supabase && this.currentUser?.username) {
                const updateData = {
                    custom_products: customProducts,
                    settings,
                    updated_at: new Date().toISOString(),
                };

                const { data: updatedRows, error: updateError } = await window.supabase
                    .from('user_data')
                    .update(updateData)
                    .eq('username', this.currentUser.username)
                    .select('id');

                if (updateError) {
                    if (
                        updateError.message &&
                        updateError.message.includes('column') &&
                        updateError.message.includes('does not exist')
                    ) {
                        throw new Error('Yeni kolonlar bulunamadı. Lütfen migration SQL dosyasını çalıştırın!');
                    }
                    throw updateError;
                }

                if (!updatedRows || updatedRows.length === 0) {
                    const { error: insertError } = await window.supabase.from('user_data').insert({
                        username: this.currentUser.username,
                        ...updateData,
                    });
                    if (insertError) throw insertError;
                } else if (updatedRows.length > 1) {
                    const keepId = updatedRows[0].id;
                    const extraIds = updatedRows.slice(1).map((r) => r.id).filter(Boolean);
                    if (extraIds.length) {
                        await window.supabase.from('user_data').delete().in('id', extraIds);
                        console.warn(`🧹 user_data duplicate temizlendi (${this.currentUser.username}): ${extraIds.length} satır`);
                    }
                }
            }

            const localData = { products: customProducts, settings };
            localStorage.setItem(`userData_${this.currentUser.username}`, JSON.stringify(localData));
            console.log('✅ User data saved successfully');
        } catch (error) {
            console.error('Error saving user data:', error);
            const localData = {
                products: (this.userData.products || []).filter((p) => !p.isDefault),
                settings: this.userData.settings || {},
            };
            localStorage.setItem(`userData_${this.currentUser.username}`, JSON.stringify(localData));
        }
    }

    // Get user products (only custom products, default products come from PRODUCTS_DATA)
    // This function now only returns custom products added by user
    getProducts(showDefaultProducts = null) {
        // Only return custom products (user_data.products should NOT contain default products)
        return this.userData.products || [];
    }
    
    // Get ALL products (custom + default from PRODUCTS_DATA)
    // Use this when you need both custom and default products merged
    getAllProducts(showDefaultProducts = null) {
        if (showDefaultProducts === null) {
            showDefaultProducts = this.userData?.settings?.showDefaultProducts;
        }
        const cacheKey = `${showDefaultProducts ? 1 : 0}_${this.userData?.products?.length || 0}_${
            typeof PRODUCTS_DATA !== 'undefined' ? PRODUCTS_DATA.products?.length || 0 : 0
        }`;
        if (this._allProductsCache && this._allProductsCache.key === cacheKey) {
            return this._allProductsCache.list;
        }

        const customProducts = this.userData.products || [];
        const defaultProducts = [];
        
        // Merge with default products from PRODUCTS_DATA if available
        if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA.products) {
            defaultProducts.push(...PRODUCTS_DATA.products.map(p => ({ ...p, isDefault: true })));
        }
        
        let merged;
        if (showDefaultProducts) {
            merged = [...customProducts, ...defaultProducts];
        } else {
            merged = customProducts;
        }

        this._allProductsCache = { key: cacheKey, list: merged };
        return merged;
    }

    // Add product to user data (only custom products, NOT default products)
    addProduct(product) {
        // Prevent adding default products to user_data
        if (product.isDefault) {
            console.warn('⚠️ Cannot add default product to user_data. Default products come from PRODUCTS_DATA.');
            return;
        }
        
        if (!this.userData.products) {
            this.userData.products = [];
        }
        
        // Check for duplicates
        const existingIndex = this.userData.products.findIndex(p => 
            p.name.toLowerCase() === product.name.toLowerCase() ||
            p.barcodes.some(b => 
                product.barcodes.some(nb => nb.code === b.code)
            )
        );
        
        if (existingIndex >= 0) {
            // Update existing product
            this.userData.products[existingIndex] = product;
        } else {
            // Add new product
            this.userData.products.push(product);
        }
        
        this._invalidateAllProductsCache();
        this.saveUserData();
    }

    // Remove product from user data
    removeProduct(productId) {
        if (!this.userData.products) return;
        
        this.userData.products = this.userData.products.filter(p => p.id !== productId);
        this._invalidateAllProductsCache();
        this.saveUserData();
    }

    // Remove multiple products
    removeProducts(productIds) {
        if (!this.userData.products) return;
        
        this.userData.products = this.userData.products.filter(p => !productIds.includes(p.id));
        this._invalidateAllProductsCache();
        this.saveUserData();
    }

    // Toggle default products visibility
    toggleDefaultProducts() {
        this.userData.settings.showDefaultProducts = !this.userData.settings.showDefaultProducts;
        this._invalidateAllProductsCache();
        this.saveUserData();
        return this.userData.settings.showDefaultProducts;
    }

    // Update user settings
    updateSettings(newSettings) {
        this.userData.settings = { ...this.userData.settings, ...newSettings };
        this.saveUserData();
    }

    // Get user settings
    getSettings() {
        return this.userData.settings || {};
    }
    
    // Get feature preferences (premium feature toggles)
    getFeaturePreferences() {
        return this.userData.settings?.featurePreferences || {};
    }
    
    // Save feature preferences to database
    async saveFeaturePreferences(featureKey, enabled) {
        if (!this.userData) {
            await this.loadUserData();
        }
        if (!this.userData.settings) {
            this.userData.settings = {};
        }
        if (!this.userData.settings.featurePreferences) {
            this.userData.settings.featurePreferences = {};
        }
        this.userData.settings.featurePreferences[featureKey] = enabled;
        await this.saveUserData();
    }
    
    // Save all feature preferences at once
    async saveAllFeaturePreferences(preferences) {
        if (!this.userData.settings) {
            this.userData.settings = {};
        }
        this.userData.settings.featurePreferences = preferences;

        // Save to database
        await this.saveUserData();
    }

    /**
     * Düşük stok uyarısı ayarları (Supabase user_data.settings.lowStockAlert)
     * threshold: Varsayılan eşik (kalan stok bu değerin altına düşünce uyarı)
     * soundEnabled: Sesli uyarı açık mı
     * overrides: Ürün/barkod bazlı özel eşikler { barcodeOrProductId: number }
     */
    getLowStockAlertSettings() {
        const defaults = { threshold: 5, soundEnabled: true, overrides: {} };
        const stored = this.userData?.settings?.lowStockAlert;
        if (!stored || typeof stored !== 'object') {
            return { ...defaults };
        }
        const overrides = stored.overrides && typeof stored.overrides === 'object' ? stored.overrides : {};
        return {
            threshold: typeof stored.threshold === 'number' && stored.threshold >= 0 ? stored.threshold : defaults.threshold,
            soundEnabled: typeof stored.soundEnabled === 'boolean' ? stored.soundEnabled : defaults.soundEnabled,
            overrides
        };
    }

    /**
     * Düşük stok uyarısı ayarlarını kaydeder (mevcut ayarlarla merge eder).
     * @param {{ threshold?: number, soundEnabled?: boolean, overrides?: Record<string, number> }} opts
     */
    async saveLowStockAlertSettings(opts) {
        if (!this.userData.settings) {
            this.userData.settings = {};
        }
        const current = this.getLowStockAlertSettings();
        const next = {
            threshold: typeof opts.threshold === 'number' && opts.threshold >= 0 ? opts.threshold : current.threshold,
            soundEnabled: typeof opts.soundEnabled === 'boolean' ? opts.soundEnabled : current.soundEnabled,
            overrides: opts.overrides !== undefined ? (opts.overrides && typeof opts.overrides === 'object' ? opts.overrides : current.overrides) : current.overrides
        };
        this.userData.settings.lowStockAlert = next;
        await this.saveUserData();
    }

    /**
     * Belirli bir ürün/barkod için özel eşik ekler veya günceller.
     * @param {string} key - Barkod (örn. "8690504009603") veya Getir productId (24 karakter)
     * @param {number} threshold - Eşik değeri
     */
    async addLowStockAlertOverride(key, threshold) {
        if (!key || typeof key !== 'string' || typeof threshold !== 'number' || threshold < 0) return;
        const current = this.getLowStockAlertSettings();
        const overrides = { ...current.overrides, [key.trim()]: threshold };
        await this.saveLowStockAlertSettings({ overrides });
    }

    /**
     * Ürün/barkod bazlı özel eşiği kaldırır.
     * @param {string} key - Barkod veya productId
     */
    async removeLowStockAlertOverride(key) {
        if (!key) return;
        const current = this.getLowStockAlertSettings();
        const overrides = { ...current.overrides };
        delete overrides[key];
        await this.saveLowStockAlertSettings({ overrides });
    }

    // Search history and statistics removed as per requirements (will be added later if needed)

    // Export user data
    exportUserData() {
        const exportData = {
            user: this.currentUser.username,
            company: this.currentUser.company,
            exportDate: new Date().toISOString(),
            data: this.userData
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentUser.username}_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Import user data
    async importUserData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    // Validate import data
                    if (!importData.data || !importData.data.products) {
                        throw new Error('Geçersiz dosya formatı');
                    }
                    
                    // Merge with existing data
                    this.userData.products = [...this.userData.products, ...importData.data.products];
                    
                    this._invalidateAllProductsCache();
                    this.saveUserData();
                    resolve('Veriler başarıyla içe aktarıldı');
                } catch (error) {
                    reject(error.message);
                }
            };
            reader.readAsText(file);
        });
    }

    // Statistics removed as per requirements (will be added later if needed)
    // getStatistics() removed - will be added later if needed

    // Calculate trial days left
    getTrialDaysLeft() {
        if (!this.currentUser.trialEnd) return null;
        
        const now = new Date();
        const trialEnd = new Date(this.currentUser.trialEnd);
        const diffTime = trialEnd - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays);
    }

    // Check if trial is expired
    isTrialExpired() {
        return this.getTrialDaysLeft() <= 0;
    }
}

// Global user data manager instance
window.userDataManager = new UserDataManager();

// Export for use in other files
window.UserDataManager = UserDataManager;
