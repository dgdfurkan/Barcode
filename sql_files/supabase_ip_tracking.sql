-- IP Tracking Schema - Supabase SQL Editor'da çalıştır

-- IP Tracking Tablosu
CREATE TABLE IF NOT EXISTS user_ip_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    login_count INTEGER DEFAULT 1,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_user_id ON user_ip_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_ip ON user_ip_tracking(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_last_seen ON user_ip_tracking(last_seen);

-- username kolonu (bazı kurulumlarda NOT NULL; INSERT hatasını önlemek için)
ALTER TABLE user_ip_tracking ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Users tablosuna max_ip_count kolonu ekle
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_ip_count INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ip_tracking_enabled BOOLEAN DEFAULT TRUE;

-- RLS Politikaları (yeniden çalıştırılabilir: önce varsa kaldır)
ALTER TABLE user_ip_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all IP tracking" ON user_ip_tracking;
CREATE POLICY "Admins can view all IP tracking" ON user_ip_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Admins can update IP tracking" ON user_ip_tracking;
CREATE POLICY "Admins can update IP tracking" ON user_ip_tracking
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Admins can delete IP tracking" ON user_ip_tracking;
CREATE POLICY "Admins can delete IP tracking" ON user_ip_tracking
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Users can view own IP tracking" ON user_ip_tracking;
CREATE POLICY "Users can view own IP tracking" ON user_ip_tracking
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own IP tracking" ON user_ip_tracking;
CREATE POLICY "Users can insert own IP tracking" ON user_ip_tracking
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own IP tracking" ON user_ip_tracking;
CREATE POLICY "Users can update own IP tracking" ON user_ip_tracking
    FOR UPDATE USING (user_id = auth.uid());

-- Trigger fonksiyonu - updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_user_ip_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger (yeniden çalıştırılabilir: önce varsa kaldır)
DROP TRIGGER IF EXISTS trigger_update_user_ip_tracking_updated_at ON user_ip_tracking;
CREATE TRIGGER trigger_update_user_ip_tracking_updated_at
    BEFORE UPDATE ON user_ip_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_user_ip_tracking_updated_at();

-- IP tracking fonksiyonu (username tabloda varsa NOT NULL hatası önlenir)
CREATE OR REPLACE FUNCTION track_user_ip(p_user_id UUID, p_ip_address INET, p_username TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    v_user_max_ip INTEGER;
    v_current_ip_count INTEGER;
    v_existing_ip RECORD;
    v_username TEXT;
    v_result JSON;
BEGIN
    -- Username yoksa users tablosundan al
    v_username := COALESCE(p_username, (SELECT username FROM users WHERE id = p_user_id LIMIT 1));
    
    -- Kullanıcının max IP sayısını al
    SELECT max_ip_count INTO v_user_max_ip 
    FROM users 
    WHERE id = p_user_id;
    
    -- Mevcut IP sayısını say
    SELECT COUNT(*) INTO v_current_ip_count
    FROM user_ip_tracking 
    WHERE user_id = p_user_id AND is_blocked = FALSE;
    
    -- Bu IP daha önce kayıtlı mı?
    SELECT * INTO v_existing_ip
    FROM user_ip_tracking 
    WHERE user_id = p_user_id AND ip_address = p_ip_address;
    
    IF v_existing_ip IS NOT NULL THEN
        -- Mevcut IP'yi güncelle
        UPDATE user_ip_tracking 
        SET last_seen = NOW(), 
            login_count = login_count + 1,
            updated_at = NOW()
        WHERE id = v_existing_ip.id;
        
        v_result := json_build_object(
            'success', true,
            'message', 'IP güncellendi',
            'ip_count', v_current_ip_count,
            'max_ip', v_user_max_ip,
            'is_new', false
        );
    ELSE
        -- Yeni IP ekle
        IF v_current_ip_count >= v_user_max_ip THEN
            v_result := json_build_object(
                'success', false,
                'message', 'Maksimum IP sayısı aşıldı',
                'ip_count', v_current_ip_count,
                'max_ip', v_user_max_ip,
                'is_new', false
            );
        ELSE
            -- username kolonu varsa (NOT NULL) değer ver; yoksa sadece user_id/ip_address
            INSERT INTO user_ip_tracking (user_id, ip_address, first_seen, last_seen, username)
            VALUES (p_user_id, p_ip_address, NOW(), NOW(), v_username);
            
            v_result := json_build_object(
                'success', true,
                'message', 'Yeni IP eklendi',
                'ip_count', v_current_ip_count + 1,
                'max_ip', v_user_max_ip,
                'is_new', true
            );
        END IF;
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eski ve yeni imza için izin (UUID, INET) ve (UUID, INET, TEXT)
GRANT EXECUTE ON FUNCTION track_user_ip(UUID, INET) TO authenticated;
GRANT EXECUTE ON FUNCTION track_user_ip(UUID, INET, TEXT) TO authenticated;
