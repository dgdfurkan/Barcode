-- Feature History Table - Özellik değişim geçmişi (audit log)
-- Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS feature_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_key VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    update_number VARCHAR(50),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by VARCHAR(50)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_feature_history_feature_key ON feature_history(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_history_update_number ON feature_history(update_number);
CREATE INDEX IF NOT EXISTS idx_feature_history_changed_at ON feature_history(changed_at);

-- RLS Politikaları
ALTER TABLE feature_history ENABLE ROW LEVEL SECURITY;

-- Allow public to view all history (read-only for app)
CREATE POLICY "Public can view feature history" ON feature_history
    FOR SELECT USING (true);

-- Allow anyone to insert (admin check done in app code)
CREATE POLICY "Anyone can insert feature history" ON feature_history
    FOR INSERT WITH CHECK (true);

-- Comments
COMMENT ON TABLE feature_history IS 'Özellik değişim geçmişi (audit log)';
COMMENT ON COLUMN feature_history.feature_key IS 'Değişen özellik anahtarı';
COMMENT ON COLUMN feature_history.old_value IS 'Eski değer (NULL olabilir - ilk değer ataması)';
COMMENT ON COLUMN feature_history.new_value IS 'Yeni değer';
COMMENT ON COLUMN feature_history.update_number IS 'Hangi güncelleme ile değişti (NULL olabilir - manuel değişiklik)';
COMMENT ON COLUMN feature_history.changed_by IS 'Değişikliği yapan admin kullanıcı adı';

