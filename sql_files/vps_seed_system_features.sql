-- VPS: system_features varsayılan kayıtları
-- ssh root@flowcobalt → sudo -u postgres psql jetbarkod -f /opt/jetbarkod-api/vps_seed_system_features.sql

INSERT INTO system_features (feature_key, feature_name, current_value, default_value, value_type, description, is_active)
VALUES
    ('new_search_algorithm', 'Yeni Arama Algoritması', 'false'::jsonb, 'false'::jsonb, 'boolean', 'Gelişmiş arama algoritmasını aktif eder', true),
    ('max_results_per_page', 'Sayfa Başına Maksimum Sonuç', '20'::jsonb, '20'::jsonb, 'number', 'Bir sayfada gösterilecek maksimum sonuç sayısı', true),
    ('enable_qr_code', 'QR Kod Desteği', 'false'::jsonb, 'false'::jsonb, 'boolean', 'QR kod oluşturma ve okuma özelliğini aktif eder', true),
    ('api_rate_limit', 'API Rate Limit', '100'::jsonb, '100'::jsonb, 'number', 'API istekleri için saatlik limit', true),
    ('maintenance_mode', 'Bakım Modu', 'false'::jsonb, 'false'::jsonb, 'boolean', 'Sistem bakım modunda mı?', true),
    ('feature_flags', 'Özellik Bayrakları', '{}'::jsonb, '{}'::jsonb, 'object', 'Genel özellik bayrakları (key-value pairs)', true),
    ('custom_settings', 'Özel Ayarlar', '{}'::jsonb, '{}'::jsonb, 'object', 'Özel sistem ayarları', true),
    ('anti_glare_mode', 'Parlama Önleme Modu', 'false'::jsonb, 'false'::jsonb, 'boolean', 'Barkodları QR Code olarak gösterir ve ekran parlamasını azaltır', true),
    ('scan_effect_visible', 'Scan Efekti Görünürlüğü', 'true'::jsonb, 'true'::jsonb, 'boolean', 'Ana sayfadaki animasyonlu scan efektinin görünürlüğünü kontrol eder', true)
ON CONFLICT (feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    default_value = EXCLUDED.default_value,
    value_type = EXCLUDED.value_type,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

SELECT feature_key, current_value FROM system_features ORDER BY feature_key;
