-- Engellenen IP adresleri (admin tarafından banlanan IP'ler)
-- user_ip_tracking kaldırıldığında IP engelleme bu tabloya taşındı.

CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage blocked_ips" ON blocked_ips;
CREATE POLICY "Admins can manage blocked_ips" ON blocked_ips
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.is_admin = true
        )
    );

-- Anonim/authenticated okuma: sadece IP listesi gerekebilir (login öncesi ban kontrolü)
-- Servis rolü veya RPC ile yapılıyorsa policy'i buna göre genişletebilirsiniz.
-- Şimdilik sadece admin yönetir; IP ban kontrolü Supabase client ile admin veya backend üzerinden yapılmalı.
-- Giriş öncesi IP engel kontrolü için herkes (anon + authenticated) okuyabilsin
DROP POLICY IF EXISTS "Anyone can read blocked_ips" ON blocked_ips;
CREATE POLICY "Anyone can read blocked_ips" ON blocked_ips
    FOR SELECT USING (true);
