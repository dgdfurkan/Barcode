-- User Update Status Table - Kullanıcı güncelleme durumu takibi
-- Supabase SQL Editor'da çalıştır

-- User update status tablosu
CREATE TABLE IF NOT EXISTS user_update_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    update_number VARCHAR(50) NOT NULL,
    is_seen BOOLEAN DEFAULT false,
    is_completed BOOLEAN DEFAULT false,
    seen_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, update_number)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_user_update_status_username ON user_update_status(username);
CREATE INDEX IF NOT EXISTS idx_user_update_status_update_number ON user_update_status(update_number);
CREATE INDEX IF NOT EXISTS idx_user_update_status_completed ON user_update_status(is_completed);
CREATE INDEX IF NOT EXISTS idx_user_update_status_seen ON user_update_status(is_seen);

-- RLS Politikaları
ALTER TABLE user_update_status ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi durumlarını görebilir
CREATE POLICY "Users can view own update status" ON user_update_status
    FOR SELECT USING (
        username = current_setting('app.current_user', true)
    );

-- Kullanıcılar kendi durumlarını güncelleyebilir
CREATE POLICY "Users can update own status" ON user_update_status
    FOR UPDATE USING (
        username = current_setting('app.current_user', true)
    );

-- Kullanıcılar kendi durumlarını oluşturabilir
CREATE POLICY "Users can insert own status" ON user_update_status
    FOR INSERT WITH CHECK (
        username = current_setting('app.current_user', true)
    );

-- Admin'ler tüm durumları görebilir
CREATE POLICY "Admins can view all update status" ON user_update_status
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE username = current_setting('app.current_user', true) 
            AND is_admin = true
        )
    );

-- Updated_at trigger
CREATE TRIGGER update_user_update_status_updated_at BEFORE UPDATE ON user_update_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE user_update_status IS 'Kullanıcıların güncelleme görüntüleme durumu';
COMMENT ON COLUMN user_update_status.is_seen IS 'Kullanıcı bildirimi gördü mü';
COMMENT ON COLUMN user_update_status.is_completed IS 'Kullanıcı tüm adımları tamamladı mı';

