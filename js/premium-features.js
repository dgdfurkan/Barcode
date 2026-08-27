// Premium Features Management System
class PremiumFeatures {
    constructor() {
        this.currentUser = null;
        this.premiumFeatures = {};
        this._loadPromise = null;
    }

    _getGuestPremiumFeatureKeys() {
        if (window.jetbarkodGuestAccess?.getGuestPremiumFeatures) {
            return window.jetbarkodGuestAccess.getGuestPremiumFeatures();
        }
        const cfg = window.JETBARKOD_GUEST_ACCESS || {};
        return Array.isArray(cfg.guestPremiumFeatures)
            ? cfg.guestPremiumFeatures
            : ['autoPaste', 'bulkCopy', 'imageSearch'];
    }

    _isGuestPremiumFeature(featureName) {
        const session = this.currentUser || window.authUtils?.checkAuth?.();
        if (!session?.isGuest) return false;
        if (!window.jetbarkodGuestAccess?.isEnabled?.()) return false;
        return this._getGuestPremiumFeatureKeys().includes(featureName);
    }

    _applyGuestPremiumFeatures() {
        this.premiumFeatures = {};
        this._getGuestPremiumFeatureKeys().forEach((key) => {
            this.premiumFeatures[key] = true;
        });
    }

    _premiumStorageKey(username) {
        return `jetbarkod_premium_${username || 'unknown'}`;
    }

    _readPremiumCache(username) {
        try {
            const sessionCached = sessionStorage.getItem('jetbarkod_premium_features');
            if (sessionCached) {
                const parsed = JSON.parse(sessionCached);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (e) { /* ignore */ }
        try {
            const localCached = localStorage.getItem(this._premiumStorageKey(username));
            if (localCached) {
                const parsed = JSON.parse(localCached);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    _writePremiumCache(username, features) {
        const payload = JSON.stringify(features || {});
        try {
            sessionStorage.setItem('jetbarkod_premium_features', payload);
        } catch (e) { /* ignore */ }
        try {
            localStorage.setItem(this._premiumStorageKey(username), payload);
        } catch (e) { /* ignore */ }
    }

    async _waitForDb(maxWait = 10000) {
        if (typeof window.jetbarkodWaitForDb === 'function') {
            return window.jetbarkodWaitForDb(maxWait);
        }
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            if (window.jbDb?.from) return window.jbDb;
            await new Promise((r) => setTimeout(r, 100));
        }
        return window.jbDb || null;
    }

    // Initialize premium features for current user
    async init() {
        const session = window.authUtils?.checkAuth();
        if (!session) {
            // Misafir sayfalarında beklenen durum — sessiz geç.
            return;
        }

        this.currentUser = session;

        if (session.isGuest && window.jetbarkodGuestAccess?.isEnabled?.()) {
            this._applyGuestPremiumFeatures();
            return;
        }

        const cached = this._readPremiumCache(session.username);
        if (cached && Object.keys(cached).length) {
            this.premiumFeatures = cached;
        }

        if (window.JETBARKOD_VPS_API?.enabled) {
            if (cached && Object.keys(cached).length) {
                void this._refreshPremiumInBackground();
                return;
            }
            await this._waitForDb();
            await this.loadPremiumFeatures();
            if (Object.keys(this.premiumFeatures).length) {
                this._writePremiumCache(session.username, this.premiumFeatures);
            }
            return;
        }

        if (this.currentUser?.username === session.username && Object.keys(this.premiumFeatures).length) {
            return;
        }

        await this._waitForDb();
        await this.loadPremiumFeatures();
        if (Object.keys(this.premiumFeatures).length) {
            this._writePremiumCache(session.username, this.premiumFeatures);
        }
    }

    async _refreshPremiumInBackground() {
        try {
            await this._waitForDb(8000);
            await this.loadPremiumFeatures();
            if (this.currentUser && Object.keys(this.premiumFeatures).length) {
                this._writePremiumCache(this.currentUser.username, this.premiumFeatures);
            }
        } catch (e) {
            console.warn('Premium arka plan yenilemesi başarısız:', e);
        }
    }

    // Load premium features from Supabase
    async loadPremiumFeatures() {
        if (this._loadPromise) return this._loadPromise;

        this._loadPromise = this._fetchPremiumFeaturesFromDb();
        try {
            await this._loadPromise;
        } finally {
            this._loadPromise = null;
        }
    }

    /**
     * Premium haklarını sunucudan çeker.
     *
     * KURAL: Hata durumunda ELDEKİ DEĞERLER KORUNUR.
     * Eskiden her hatada premiumFeatures = {} yapılıyordu; arka planda
     * sessizce çalışan yenileme geçici bir sebeple başarısız olunca
     * kullanıcının tüm premium özellikleri kilitli görünüyordu.
     * Yalnızca sunucudan BAŞARILI bir yanıt geldiğinde değer değişir.
     *
     * @returns {Promise<boolean>} taze veri alındı mı
     */
    async _fetchPremiumFeaturesFromDb() {
        try {
            if (!window.jbDb || !this.currentUser) {
                return false;
            }

            const { data, error } = await window.jbDb
                .from('users')
                .select('premium_features')
                .eq('username', this.currentUser.username)
                .maybeSingle();

            if (error) {
                console.warn('Premium hakları alınamadı, mevcut değerler korunuyor:', error.message);
                return false;
            }

            if (!data) {
                console.warn('Kullanıcı satırı dönmedi, premium hakları korunuyor.');
                return false;
            }

            // Boş nesne meşru bir cevap: kullanıcının hiç premium hakkı yok.
            this.premiumFeatures = data.premium_features || {};
            if (this.currentUser?.username) {
                this._writePremiumCache(this.currentUser.username, this.premiumFeatures);
            }
            return true;
        } catch (error) {
            console.warn('Premium hakları alınamadı (istisna), mevcut değerler korunuyor:', error?.message);
            return false;
        }
    }

    /**
     * Önbelleği atlayıp sunucudan TAZE premium haklarını getirir ve bekler.
     * Ayarlar ekranı bunu kullanır — orada bayat veri göstermek kabul edilemez.
     */
    async refresh() {
        const session = window.authUtils?.checkAuth?.();
        if (!session) return false;
        this.currentUser = session;

        if (session.isGuest && window.jetbarkodGuestAccess?.isEnabled?.()) {
            this._applyGuestPremiumFeatures();
            return true;
        }

        await this._waitForDb(8000);
        return this._fetchPremiumFeaturesFromDb();
    }

    // Check if a specific premium feature is enabled
    checkPremiumFeature(featureName) {
        if (this._isGuestPremiumFeature(featureName)) {
            return true;
        }

        if (!this.premiumFeatures || typeof this.premiumFeatures !== 'object') {
            return false;
        }
        
        const feature = this.premiumFeatures[featureName];
        
        // Support both old format (true/false) and new format ({enabled: true, limit: 3})
        if (typeof feature === 'boolean') {
            return feature === true;
        } else if (typeof feature === 'object' && feature !== null) {
            return feature.enabled === true;
        }
        
        return false;
    }
    
    // Get premium feature limit (if exists)
    getPremiumFeatureLimit(featureName) {
        if (!this.premiumFeatures || typeof this.premiumFeatures !== 'object') {
            return null;
        }
        
        const feature = this.premiumFeatures[featureName];
        
        // If feature is an object with limit property
        if (typeof feature === 'object' && feature !== null && typeof feature.limit === 'number') {
            return feature.limit;
        }
        
        // No limit (null means unlimited)
        return null;
    }

    // Get all premium features
    getPremiumFeatures() {
        return this.premiumFeatures || {};
    }

    // Get premium feature status (for display purposes)
    getPremiumFeatureStatus(featureName) {
        return this.checkPremiumFeature(featureName);
    }

    // Validate premium feature with backend (security check)
    async validatePremiumFeature(featureName) {
        if (this._isGuestPremiumFeature(featureName)) {
            return true;
        }

        if (window.JETBARKOD_VPS_API?.enabled) {
            return this.checkPremiumFeature(featureName);
        }

        try {
            if (!window.jbDb || !this.currentUser) {
                return false;
            }

            // Try RPC function first (more secure)
            try {
                const { data: rpcData, error: rpcError } = await window.jbDb
                    .rpc('check_premium_feature', {
                        p_username: this.currentUser.username,
                        p_feature_name: featureName
                    });
                
                if (!rpcError && typeof rpcData === 'boolean') {
                    // RPC function available and working
                    // Still refresh cache for consistency
                    await this.loadPremiumFeatures();
                    return rpcData;
                }
            } catch (rpcError) {
                console.warn('RPC function not available, falling back to direct query:', rpcError);
            }

            // Fallback: Fetch fresh data from backend
            const { data, error } = await window.jbDb
                .from('users')
                .select('premium_features')
                .eq('username', this.currentUser.username)
                .single();

            if (error || !data) {
                return false;
            }

            const features = data.premium_features || {};
            
            // Update local cache
            this.premiumFeatures = features;
            
            // Return validation result (support both formats)
            const feature = features[featureName];
            if (typeof feature === 'boolean') {
                return feature === true;
            } else if (typeof feature === 'object' && feature !== null) {
                return feature.enabled === true;
            }
            return false;
        } catch (error) {
            console.error('Error validating premium feature:', error);
            return false;
        }
    }

    // Refresh premium features from backend
    async refresh() {
        await this.loadPremiumFeatures();
        // Clear cache when refreshed (admin might have changed settings)
        this.clearCache();
    }
    
    // Cache for feature preferences (user toggles)
    featurePreferencesCache = null;
    cacheTimestamp = null;
    CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    // Load feature preferences from user_data (cached)
    async loadFeaturePreferences() {
        try {
            const now = Date.now();
            if (this.featurePreferencesCache && this.cacheTimestamp && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
                return this.featurePreferencesCache;
            }
            if (!window.jbDb || !this.currentUser) {
                return {};
            }
            // user_data'da aynı kullanıcı için birden fazla satır olabilir; en günceli al (user-manager ile uyumlu)
            const { data, error } = await window.jbDb
                .from('user_data')
                .select('settings')
                .eq('username', this.currentUser.username)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!error && data && data.settings) {
                this.featurePreferencesCache = data.settings.featurePreferences && typeof data.settings.featurePreferences === 'object'
                    ? data.settings.featurePreferences
                    : {};
                this.cacheTimestamp = now;
                return this.featurePreferencesCache;
            }
            this.featurePreferencesCache = {};
            this.cacheTimestamp = now;
            return {};
        } catch (error) {
            console.error('Error loading feature preferences:', error);
            return {};
        }
    }
    
    // Save feature preferences to database
    async saveFeaturePreferences(featureKey, enabled) {
        try {
            // Update cache
            if (!this.featurePreferencesCache) {
                this.featurePreferencesCache = {};
            }
            this.featurePreferencesCache[featureKey] = enabled;
            this.cacheTimestamp = Date.now();
            
            // Save via user-manager
            if (window.userDataManager) {
                await window.userDataManager.saveFeaturePreferences(featureKey, enabled);
            }
        } catch (error) {
            console.error('Error saving feature preferences:', error);
        }
    }
    
    // Clear cache (when admin changes settings)
    clearCache() {
        this.featurePreferencesCache = null;
        this.cacheTimestamp = null;
    }
    
    // Get feature preference (from cache or database)
    async getFeaturePreference(featureKey) {
        const preferences = await this.loadFeaturePreferences();
        return preferences[featureKey] || false;
    }
}

// Global premium features instance
window.premiumFeatures = new PremiumFeatures();

// Utility function for easy access
window.checkPremiumFeature = function(featureName) {
    if (!window.premiumFeatures) {
        return false;
    }
    return window.premiumFeatures.checkPremiumFeature(featureName);
};

// Initialize when auth is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.authUtils?.checkAuth()) {
            window.premiumFeatures.init();
        }
    });
} else {
    // Already loaded, check if user is authenticated
    setTimeout(() => {
        if (window.authUtils?.checkAuth()) {
            window.premiumFeatures.init();
        }
    }, 500);
}

