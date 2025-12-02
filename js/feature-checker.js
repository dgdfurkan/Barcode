// Feature Checker - Uygulama kodunda özellikleri kontrol etmek için helper fonksiyonlar
// Bu dosya uygulama kodunda özellikleri kolayca kontrol etmek için kullanılır

(function() {
    'use strict';

    // Özelliğin aktif olup olmadığını kontrol et (boolean özellikler için)
    async function isFeatureEnabled(featureKey) {
        try {
            if (!window.featureManager) {
                console.warn('FeatureManager not available, using default value');
                const definition = window.getFeatureDefinition?.(featureKey);
                return definition?.defaultValue === true;
            }

            const value = await window.featureManager.getFeatureValue(featureKey);
            return value === true;
        } catch (error) {
            console.error(`Error checking feature ${featureKey}:`, error);
            const definition = window.getFeatureDefinition?.(featureKey);
            return definition?.defaultValue === true;
        }
    }

    // Özellik değerini getir (tüm tipler için)
    async function getFeatureValue(featureKey) {
        try {
            if (!window.featureManager) {
                console.warn('FeatureManager not available, using default value');
                const definition = window.getFeatureDefinition?.(featureKey);
                return definition?.defaultValue || null;
            }

            return await window.featureManager.getFeatureValue(featureKey);
        } catch (error) {
            console.error(`Error getting feature value for ${featureKey}:`, error);
            const definition = window.getFeatureDefinition?.(featureKey);
            return definition?.defaultValue || null;
        }
    }

    // Özellik değerini senkron olarak getir (cache'den)
    // Not: İlk çağrıda cache boş olabilir, async versiyonu tercih edilmelidir
    function getFeatureValueSync(featureKey) {
        try {
            // Önce featureManager'dan cache'i kontrol et
            if (window.featureManager) {
                // FeatureManager'ın cache'ini kontrol et
                if (window.featureManager.featuresCache) {
                    const feature = window.featureManager.featuresCache[featureKey];
                    if (feature && feature.current_value !== undefined) {
                        return feature.current_value;
                    }
                }
                
                // Eğer cache yoksa, default değeri döndür
                const definition = window.getFeatureDefinition?.(featureKey);
                if (definition) {
                    return definition.defaultValue;
                }
            }

            // FeatureManager yoksa direkt default değeri döndür
            const definition = window.getFeatureDefinition?.(featureKey);
            return definition?.defaultValue || false; // boolean özellikler için false default
        } catch (error) {
            console.error(`Error getting feature value sync for ${featureKey}:`, error);
            const definition = window.getFeatureDefinition?.(featureKey);
            return definition?.defaultValue || false;
        }
    }

    // Tüm özellikleri yükle ve cache'le
    async function loadAllFeatures() {
        try {
            if (!window.featureManager) {
                console.warn('FeatureManager not available');
                return {};
            }

            return await window.featureManager.loadAllFeatures();
        } catch (error) {
            console.error('Error loading all features:', error);
            return {};
        }
    }

    // Özellik geçmişini getir
    async function getFeatureHistory(featureKey, limit = 50) {
        try {
            if (!window.featureManager) {
                console.warn('FeatureManager not available');
                return [];
            }

            return await window.featureManager.getFeatureHistory(featureKey, limit);
        } catch (error) {
            console.error(`Error getting feature history for ${featureKey}:`, error);
            return [];
        }
    }

    // Export functions to window
    if (typeof window !== 'undefined') {
        window.isFeatureEnabled = isFeatureEnabled;
        window.getFeatureValue = getFeatureValue;
        window.getFeatureValueSync = getFeatureValueSync;
        window.loadAllFeatures = loadAllFeatures;
        window.getFeatureHistory = getFeatureHistory;
        console.log('✅ FeatureChecker helper functions initialized');
    }
})();

