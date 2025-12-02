// Feature Definitions - Sistem özelliklerinin tanımları
// Bu dosya özelliklerin varsayılan değerlerini ve açıklamalarını içerir

const FEATURE_DEFINITIONS = {
    'new_search_algorithm': {
        name: 'Yeni Arama Algoritması',
        defaultValue: false,
        valueType: 'boolean',
        description: 'Gelişmiş arama algoritmasını aktif eder'
    },
    'max_results_per_page': {
        name: 'Sayfa Başına Maksimum Sonuç',
        defaultValue: 20,
        valueType: 'number',
        description: 'Bir sayfada gösterilecek maksimum sonuç sayısı'
    },
    'enable_qr_code': {
        name: 'QR Kod Desteği',
        defaultValue: false,
        valueType: 'boolean',
        description: 'QR kod oluşturma ve okuma özelliğini aktif eder'
    },
    'api_rate_limit': {
        name: 'API Rate Limit',
        defaultValue: 100,
        valueType: 'number',
        description: 'API istekleri için saatlik limit'
    },
    'maintenance_mode': {
        name: 'Bakım Modu',
        defaultValue: false,
        valueType: 'boolean',
        description: 'Sistem bakım modunda mı?'
    },
    'feature_flags': {
        name: 'Özellik Bayrakları',
        defaultValue: {},
        valueType: 'object',
        description: 'Genel özellik bayrakları (key-value pairs)'
    },
    'custom_settings': {
        name: 'Özel Ayarlar',
        defaultValue: {},
        valueType: 'object',
        description: 'Özel sistem ayarları'
    },
    'anti_glare_mode': {
        name: 'Parlama Önleme Modu',
        defaultValue: false,
        valueType: 'boolean',
        description: 'Barkodları QR Code olarak gösterir ve ekran parlamasını azaltır. False ise kullanıcılar göremez, true ise görebilir ve kendileri açıp kapatabilir.'
    },
    'scan_effect_visible': {
        name: 'Scan Efekti Görünürlüğü',
        defaultValue: true,
        valueType: 'boolean',
        description: 'Ana sayfadaki animasyonlu scan efektinin görünürlüğünü kontrol eder. False ise görünmez, true ise görünür.'
    }
};

// Helper function to get feature definition
function getFeatureDefinition(featureKey) {
    return FEATURE_DEFINITIONS[featureKey] || null;
}

// Helper function to get all feature definitions
function getAllFeatureDefinitions() {
    return FEATURE_DEFINITIONS;
}

// Helper function to validate feature value based on type
function validateFeatureValue(value, valueType) {
    switch (valueType) {
        case 'boolean':
            return typeof value === 'boolean';
        case 'number':
            return typeof value === 'number' && !isNaN(value);
        case 'string':
            return typeof value === 'string';
        case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        default:
            return false;
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.FEATURE_DEFINITIONS = FEATURE_DEFINITIONS;
    window.getFeatureDefinition = getFeatureDefinition;
    window.getAllFeatureDefinitions = getAllFeatureDefinitions;
    window.validateFeatureValue = validateFeatureValue;
}

