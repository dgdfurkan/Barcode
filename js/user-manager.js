// User Data Management System
class UserDataManager {
    constructor() {
        this.currentUser = null;
        this.userData = null;
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

    // Load user-specific data
    async loadUserData() {
        try {
            // Try to load from Supabase first
            if (window.supabase) {
                const { data, error } = await window.supabase
                    .from('user_data')
                    .select('data')
                    .eq('username', this.currentUser.username)
                    .single();
                
                if (!error && data) {
                    this.userData = data.data;
                    // MIGRATION: Remove default products from user_data (they should come from PRODUCTS_DATA)
                    if (this.userData.products && Array.isArray(this.userData.products)) {
                        const beforeCount = this.userData.products.length;
                        this.userData.products = this.userData.products.filter(p => !p.isDefault);
                        const afterCount = this.userData.products.length;
                        
                        // If we removed default products, update statistics and save
                        if (beforeCount !== afterCount) {
                            console.log(`🧹 Cleaned ${beforeCount - afterCount} default products from user_data`);
                            this.userData.statistics.totalProducts = afterCount;
                            // Save cleaned data (only once, async without blocking)
                            this.saveUserData().catch(err => console.warn('Failed to save cleaned data:', err));
                        }
                    }
                    return;
                }
            }
            
            // Fallback to local storage
            const localData = localStorage.getItem(`userData_${this.currentUser.username}`);
            if (localData) {
                this.userData = JSON.parse(localData);
                // MIGRATION: Remove default products from local storage too
                if (this.userData.products && Array.isArray(this.userData.products)) {
                    this.userData.products = this.userData.products.filter(p => !p.isDefault);
                    this.userData.statistics.totalProducts = this.userData.products.length;
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
    createDefaultUserData() {
        return {
            products: [], // Only custom products added by user, NOT default products
            settings: {
                showDuplicates: false,
                theme: 'light',
                searchHistory: [],
                lastBackup: null,
                showDefaultProducts: true
            },
            statistics: {
                totalSearches: 0,
                totalProducts: 0, // Only count custom products, default products are in PRODUCTS_DATA
                lastLogin: new Date().toISOString()
            }
        };
    }

    // Save user data
    async saveUserData() {
        try {
            // Update statistics
            this.userData.statistics.lastLogin = new Date().toISOString();
            
            // Save to Supabase
            if (window.supabase) {
                await window.supabase
                    .from('user_data')
                    .upsert({
                        username: this.currentUser.username,
                        data: this.userData,
                        updated_at: new Date().toISOString()
                    });
            }
            
            // Save to local storage as backup
            localStorage.setItem(`userData_${this.currentUser.username}`, JSON.stringify(this.userData));
            
            console.log('User data saved successfully');
        } catch (error) {
            console.error('Error saving user data:', error);
            // Fallback to local storage only
            localStorage.setItem(`userData_${this.currentUser.username}`, JSON.stringify(this.userData));
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
        const customProducts = this.userData.products || [];
        const defaultProducts = [];
        
        // Merge with default products from PRODUCTS_DATA if available
        if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA.products) {
            defaultProducts.push(...PRODUCTS_DATA.products.map(p => ({ ...p, isDefault: true })));
        }
        
        // Use setting if no parameter provided
        if (showDefaultProducts === null) {
            showDefaultProducts = this.userData.settings.showDefaultProducts;
        }
        
        if (showDefaultProducts) {
            // Merge custom + default products
            return [...customProducts, ...defaultProducts];
        } else {
            // Only custom products
            return customProducts;
        }
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
        
        // Only count custom products in statistics
        this.userData.statistics.totalProducts = this.userData.products.length;
        this.saveUserData();
    }

    // Remove product from user data
    removeProduct(productId) {
        if (!this.userData.products) return;
        
        this.userData.products = this.userData.products.filter(p => p.id !== productId);
        this.userData.statistics.totalProducts = this.userData.products.length;
        this.saveUserData();
    }

    // Remove multiple products
    removeProducts(productIds) {
        if (!this.userData.products) return;
        
        this.userData.products = this.userData.products.filter(p => !productIds.includes(p.id));
        this.userData.statistics.totalProducts = this.userData.products.length;
        this.saveUserData();
    }

    // Toggle default products visibility
    toggleDefaultProducts() {
        this.userData.settings.showDefaultProducts = !this.userData.settings.showDefaultProducts;
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

    // Add search to history (optimized: save only settings, not products)
    addSearchHistory(query) {
        if (!this.userData.settings.searchHistory) {
            this.userData.settings.searchHistory = [];
        }
        
        // Add to beginning and limit to 50 items
        this.userData.settings.searchHistory.unshift({
            query: query,
            timestamp: new Date().toISOString()
        });
        
        this.userData.settings.searchHistory = this.userData.settings.searchHistory.slice(0, 50);
        this.userData.statistics.totalSearches++;
        
        // Save user data (now only contains small settings, not 8000+ products)
        this.saveUserData();
    }

    // Get search history
    getSearchHistory() {
        return this.userData.settings.searchHistory || [];
    }

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
                    this.userData.statistics.totalProducts = this.userData.products.length;
                    
                    this.saveUserData();
                    resolve('Veriler başarıyla içe aktarıldı');
                } catch (error) {
                    reject(error.message);
                }
            };
            reader.readAsText(file);
        });
    }

    // Get user statistics
    getStatistics() {
        return {
            ...this.userData.statistics,
            trialDaysLeft: this.getTrialDaysLeft(),
            productsCount: this.userData.products.length,
            searchHistoryCount: this.userData.settings.searchHistory.length
        };
    }

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
