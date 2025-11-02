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
                    .single();
                
                if (!error && data && (data.custom_products !== null || data.settings !== null)) {
                    // New structure: separate columns
                    console.log('📦 Loading from new structure (custom_products + settings columns)');
                    this.userData = {
                        products: data.custom_products || [],
                        settings: data.settings || {}
                    };
                    
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
        try {
            // Prepare data for saving
            const customProducts = (this.userData.products || []).filter(p => !p.isDefault);
            const settings = this.userData.settings || {};
            
            // Save to Supabase - ONLY to custom_products and settings columns
            if (window.supabase) {
                // Save to new structure (custom_products + settings columns)
                const updateData = {
                    username: this.currentUser.username,
                    custom_products: customProducts,
                    settings: settings,
                    updated_at: new Date().toISOString()
                };
                
                // IMPORTANT: Do NOT write to 'data' column - it will not be used
                const { error } = await window.supabase
                    .from('user_data')
                    .upsert(updateData);
                
                if (error) {
                    // If new columns don't exist, inform user but don't write to data column
                    if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
                        console.error('⚠️ New columns (custom_products, settings) not found. Please run migration SQL first!');
                        throw new Error('Yeni kolonlar bulunamadı. Lütfen migration SQL dosyasını çalıştırın!');
                    } else {
                        throw error;
                    }
                }
            }
            
            // Save to local storage as backup
            const localData = {
                products: customProducts,
                settings: settings
            };
            localStorage.setItem(`userData_${this.currentUser.username}`, JSON.stringify(localData));
            
            console.log('✅ User data saved successfully');
        } catch (error) {
            console.error('Error saving user data:', error);
            // Fallback to local storage only
            const localData = {
                products: (this.userData.products || []).filter(p => !p.isDefault),
                settings: this.userData.settings || {}
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
        
        this.saveUserData();
    }

    // Remove product from user data
    removeProduct(productId) {
        if (!this.userData.products) return;
        
        this.userData.products = this.userData.products.filter(p => p.id !== productId);
        this.saveUserData();
    }

    // Remove multiple products
    removeProducts(productIds) {
        if (!this.userData.products) return;
        
        this.userData.products = this.userData.products.filter(p => !productIds.includes(p.id));
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
