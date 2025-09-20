-- IP tracking tablosuna username kolonu ekle
-- Bu script'i Supabase SQL Editor'da çalıştır

-- user_ip_tracking tablosuna username kolonu ekle
ALTER TABLE user_ip_tracking ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Mevcut verileri güncelle
UPDATE user_ip_tracking 
SET username = users.username 
FROM users 
WHERE user_ip_tracking.user_id = users.id;

-- IP tracking fonksiyonunu güncelle - username de eklesin
CREATE OR REPLACE FUNCTION track_user_ip(p_user_id UUID, p_ip_address INET)
RETURNS JSON AS $$
DECLARE
    v_user_max_ip INTEGER;
    v_current_ip_count INTEGER;
    v_existing_ip RECORD;
    v_user_tracked_ips TEXT[];
    v_username VARCHAR(50);
    v_result JSON;
BEGIN
    -- Kullanıcının max IP sayısını ve username'ini al
    SELECT max_ip_count, username INTO v_user_max_ip, v_username
    FROM users 
    WHERE id = p_user_id;
    
    -- Kullanıcının tracked_ips'ini al
    SELECT tracked_ips INTO v_user_tracked_ips
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
            updated_at = NOW(),
            username = v_username
        WHERE id = v_existing_ip.id;
        
        -- Users tablosundaki current_ip'yi güncelle
        UPDATE users 
        SET current_ip = p_ip_address,
            last_ip_update = NOW()
        WHERE id = p_user_id;
        
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
            -- user_ip_tracking tablosuna ekle
            INSERT INTO user_ip_tracking (user_id, ip_address, username, first_seen, last_seen)
            VALUES (p_user_id, p_ip_address, v_username, NOW(), NOW());
            
            -- Users tablosundaki tracked_ips'e ekle
            UPDATE users 
            SET tracked_ips = CASE 
                WHEN tracked_ips IS NULL THEN ARRAY[p_ip_address::TEXT]
                ELSE array_append(tracked_ips, p_ip_address::TEXT)
            END,
                current_ip = p_ip_address,
                last_ip_update = NOW()
            WHERE id = p_user_id;
            
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

-- Fonksiyon iznini güncelle
GRANT EXECUTE ON FUNCTION track_user_ip(UUID, INET) TO authenticated;
