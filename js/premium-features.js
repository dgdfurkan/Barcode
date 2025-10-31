// Premium Features Management System
class PremiumFeatures {
    constructor() {
        this.currentUser = null;
        this.premiumFeatures = {};
    }

    // Initialize premium features for current user
    async init() {
        const session = window.authUtils?.checkAuth();
        if (!session) {
            console.warn('No user session found for premium features');
            return;
        }
        
        this.currentUser = session;
        await this.loadPremiumFeatures();
    }

    // Load premium features from Supabase
    async loadPremiumFeatures() {
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
                // Default to empty object if no features found
                this.premiumFeatures = {};
            }
        } catch (error) {
            console.error('Error loading premium features:', error);
            this.premiumFeatures = {};
        }
    }

    // Check if a specific premium feature is enabled
    checkPremiumFeature(featureName) {
        if (!this.premiumFeatures || typeof this.premiumFeatures !== 'object') {
            return false;
        }
        
        // Return true if feature exists and is true
        return this.premiumFeatures[featureName] === true;
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
            
            // Return validation result
            return features[featureName] === true;
        } catch (error) {
            console.error('Error validating premium feature:', error);
            return false;
        }
    }

    // Refresh premium features from backend
    async refresh() {
        await this.loadPremiumFeatures();
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

