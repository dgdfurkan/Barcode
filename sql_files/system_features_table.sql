-- System Features Table - Sistem özelliklerini tutar
-- Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS system_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_key VARCHAR(100) UNIQUE NOT NULL,
    feature_name VARCHAR(200) NOT NULL,
    current_value JSONB NOT NULL,
    default_value JSONB NOT NULL,
    value_type VARCHAR(20) NOT NULL CHECK (value_type IN ('boolean', 'string', 'number', 'object')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_system_features_feature_key ON system_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_system_features_is_active ON system_features(is_active);

-- RLS Politikaları
ALTER TABLE system_features ENABLE ROW LEVEL SECURITY;

-- Allow public to view all features (read-only for app)
CREATE POLICY "Public can view system features" ON system_features
    FOR SELECT USING (true);

-- Allow anyone to insert/update/delete (admin check done in app code)
CREATE POLICY "Anyone can manage system features" ON system_features
    FOR ALL USING (true)
    WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_system_features_updated_at BEFORE UPDATE ON system_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE system_features IS 'Sistem özellikleri ve mevcut değerleri';
COMMENT ON COLUMN system_features.feature_key IS 'Özellik anahtarı (unique, kod içinde kullanılır)';
COMMENT ON COLUMN system_features.current_value IS 'Mevcut özellik değeri (JSONB)';
COMMENT ON COLUMN system_features.default_value IS 'Varsayılan özellik değeri (JSONB)';
COMMENT ON COLUMN system_features.value_type IS 'Değer tipi: boolean, string, number, object';

