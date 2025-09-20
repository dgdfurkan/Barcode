-- IP Tracking Schema - Policy'leri güncelle (çakışma olmasın diye)

-- Önce mevcut policy'leri sil
DROP POLICY IF EXISTS "Admins can view all IP tracking" ON user_ip_tracking;
DROP POLICY IF EXISTS "Admins can update IP tracking" ON user_ip_tracking;
DROP POLICY IF EXISTS "Admins can delete IP tracking" ON user_ip_tracking;
DROP POLICY IF EXISTS "Users can view own IP tracking" ON user_ip_tracking;
DROP POLICY IF EXISTS "Users can insert own IP tracking" ON user_ip_tracking;
DROP POLICY IF EXISTS "Users can update own IP tracking" ON user_ip_tracking;

-- Yeni policy'leri oluştur
CREATE POLICY "Admins can view all IP tracking" ON user_ip_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can update IP tracking" ON user_ip_tracking
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can delete IP tracking" ON user_ip_tracking
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

CREATE POLICY "Users can view own IP tracking" ON user_ip_tracking
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own IP tracking" ON user_ip_tracking
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own IP tracking" ON user_ip_tracking
    FOR UPDATE USING (user_id = auth.uid());

-- IP tracking fonksiyonunu güncelle (eğer varsa)
DROP FUNCTION IF EXISTS track_user_ip(UUID, INET);

CREATE OR REPLACE FUNCTION track_user_ip(p_user_id UUID, p_ip_address INET)
RETURNS JSON AS $$
DECLARE
    v_user_max_ip INTEGER;
    v_current_ip_count INTEGER;
    v_existing_ip RECORD;
    v_result JSON;
BEGIN
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
            INSERT INTO user_ip_tracking (user_id, ip_address, first_seen, last_seen)
            VALUES (p_user_id, p_ip_address, NOW(), NOW());
            
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

-- IP tracking fonksiyonunu çalıştırma izni
GRANT EXECUTE ON FUNCTION track_user_ip(UUID, INET) TO authenticated;
