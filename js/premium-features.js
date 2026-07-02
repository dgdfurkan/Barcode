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

    // Initialize premium features for current user
    async init() {
        const session = window.authUtils?.checkAuth();
        if (!session) {
            console.warn('No user session found for premium features');
            return;
        }

        this.currentUser = session;

        if (session.isGuest && window.jetbarkodGuestAccess?.isEnabled?.()) {
            this._applyGuestPremiumFeatures();
            return;
        }

        if (this.currentUser?.username === session.username && Object.keys(this.premiumFeatures).length) {
            return;
        }

        await this.loadPremiumFeatures();
    }

    // Load premium features from Supabase
    async loadPremiumFeatures() {
        if (this._loadPromise) return this._loadPromise;

        this._loadPromise = this._fetchPremiumFeaturesFromSupabase();
        try {
            await this._loadPromise;
        } finally {
            this._loadPromise = null;
        }
    }

    async _fetchPremiumFeaturesFromSupabase() {
        try {
            if (!window.supabase || !this.currentUser) {
                this.premiumFeatures = {};
                return;
            }

            const { data, error } = await window.supabase
                .from('users')
                .select('premium_features')
                .eq('username', this.currentUser.username)
                .single();

            if (!error && data && data.premium_features) {
                this.premiumFeatures = data.premium_features;
            } else {
                this.premiumFeatures = {};
            }
        } catch (error) {
            console.error('Error loading premium features:', error);
            this.premiumFeatures = {};
        }
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

        try {
            if (!window.supabase || !this.currentUser) {
                return false;
            }

            // Try RPC function first (more secure)
            try {
                const { data: rpcData, error: rpcError } = await window.supabase
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
            const { data, error } = await window.supabase
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
            if (!window.supabase || !this.currentUser) {
                return {};
            }
            // user_data'da aynı kullanıcı için birden fazla satır olabilir; en günceli al (user-manager ile uyumlu)
            const { data, error } = await window.supabase
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

