-- Users tablosuna IP adreslerini ekle
-- Bu script'i Supabase SQL Editor'da çalıştır

-- Users tablosuna allowed_ips kolonu ekle (eğer yoksa)
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT ARRAY['*'];

-- Users tablosuna tracked_ips kolonu ekle (kullanıcının kullandığı IP'ler)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracked_ips TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Users tablosuna current_ip kolonu ekle (şu anki IP)
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_ip INET;

-- Users tablosuna last_ip_update kolonu ekle (son IP güncelleme tarihi)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- IP tracking fonksiyonunu güncelle - users tablosuna da IP eklesin
CREATE OR REPLACE FUNCTION track_user_ip(p_user_id UUID, p_ip_address INET)
RETURNS JSON AS $$
DECLARE
    v_user_max_ip INTEGER;
    v_current_ip_count INTEGER;
    v_existing_ip RECORD;
    v_user_tracked_ips TEXT[];
    v_result JSON;
BEGIN
    -- Kullanıcının max IP sayısını al
    SELECT max_ip_count INTO v_user_max_ip 
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
            updated_at = NOW()
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
            INSERT INTO user_ip_tracking (user_id, ip_address, first_seen, last_seen)
            VALUES (p_user_id, p_ip_address, NOW(), NOW());
            
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
