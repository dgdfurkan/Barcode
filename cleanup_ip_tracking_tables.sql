-- Supabase tablolarını temizle ve düzenle
-- Bu script'i Supabase SQL Editor'da çalıştır

-- Users tablosundaki gereksiz kolonları temizle
ALTER TABLE users DROP COLUMN IF EXISTS allowed_ips;

-- user_ip_tracking tablosundaki kolon sırasını düzenle
-- (PostgreSQL'de kolon sırasını değiştirmek için tabloyu yeniden oluşturmak gerekir)

-- Yeni tablo oluştur (doğru sırayla)
CREATE TABLE user_ip_tracking_new (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    login_count INTEGER DEFAULT 1,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mevcut verileri yeni tabloya kopyala
INSERT INTO user_ip_tracking_new (id, username, user_id, ip_address, first_seen, last_seen, login_count, is_blocked, created_at, updated_at)
SELECT id, username, user_id, ip_address, first_seen, last_seen, login_count, is_blocked, created_at, updated_at
FROM user_ip_tracking;

-- Eski tabloyu sil
DROP TABLE user_ip_tracking;

-- Yeni tabloyu eski isimle yeniden adlandır
ALTER TABLE user_ip_tracking_new RENAME TO user_ip_tracking;

-- Index'leri yeniden oluştur
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_username ON user_ip_tracking(username);
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_user_id ON user_ip_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_ip ON user_ip_tracking(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_last_seen ON user_ip_tracking(last_seen);

-- RLS politikalarını yeniden oluştur
ALTER TABLE user_ip_tracking ENABLE ROW LEVEL SECURITY;

-- Admin'ler tüm IP tracking verilerini görebilir
CREATE POLICY "Admins can view all IP tracking" ON user_ip_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Admin'ler IP tracking verilerini güncelleyebilir
CREATE POLICY "Admins can update IP tracking" ON user_ip_tracking
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Admin'ler IP tracking verilerini silebilir
CREATE POLICY "Admins can delete IP tracking" ON user_ip_tracking
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Kullanıcılar kendi IP tracking verilerini görebilir
CREATE POLICY "Users can view own IP tracking" ON user_ip_tracking
    FOR SELECT USING (user_id = auth.uid());

-- Kullanıcılar kendi IP tracking verilerini ekleyebilir (giriş sırasında)
CREATE POLICY "Users can insert own IP tracking" ON user_ip_tracking
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Kullanıcılar kendi IP tracking verilerini güncelleyebilir (last_seen, login_count)
CREATE POLICY "Users can update own IP tracking" ON user_ip_tracking
    FOR UPDATE USING (user_id = auth.uid());

-- Trigger'ı yeniden oluştur
CREATE TRIGGER trigger_update_user_ip_tracking_updated_at
    BEFORE UPDATE ON user_ip_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_user_ip_tracking_updated_at();
