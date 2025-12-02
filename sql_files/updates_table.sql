-- Updates Table - Güncelleme Bildirimleri için
-- Supabase SQL Editor'da çalıştır

-- Updates tablosu
CREATE TABLE IF NOT EXISTS updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    update_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_updates_update_number ON updates(update_number);
CREATE INDEX IF NOT EXISTS idx_updates_is_active ON updates(is_active);
CREATE INDEX IF NOT EXISTS idx_updates_scheduled_at ON updates(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_updates_created_at ON updates(created_at);

-- RLS Politikaları
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: Since the app doesn't use Supabase Auth, we need simpler policies
-- Admin check is done in application code (admin-updates.js)

-- Allow public to view active updates (for users)
CREATE POLICY "Public can view active updates" ON updates
    FOR SELECT USING (
        is_active = true 
        AND (scheduled_at IS NULL OR scheduled_at <= NOW())
    );

-- Allow anyone to insert (admin check done in app code)
-- Note: This is less secure but necessary since we don't use Supabase Auth
-- For production, consider using service role key for admin operations
CREATE POLICY "Anyone can insert updates" ON updates
    FOR INSERT WITH CHECK (true);

-- Allow anyone to update (admin check done in app code)
CREATE POLICY "Anyone can update updates" ON updates
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- Allow anyone to delete (admin check done in app code)
CREATE POLICY "Anyone can delete updates" ON updates
    FOR DELETE USING (true);

-- Allow anyone to view all updates (for admin panel)
CREATE POLICY "Anyone can view all updates" ON updates
    FOR SELECT USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_updates_updated_at BEFORE UPDATE ON updates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE updates IS 'Sistem güncelleme bildirimleri';
COMMENT ON COLUMN updates.update_number IS 'Manuel girilen güncelleme numarası (unique)';
COMMENT ON COLUMN updates.steps IS 'JSONB array: [{title, description, image_url, icon, color}]';
COMMENT ON COLUMN updates.scheduled_at IS 'Zamanlanmış gönderim tarihi (NULL ise hemen aktif)';

