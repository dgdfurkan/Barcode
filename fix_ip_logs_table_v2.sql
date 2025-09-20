-- ip_logs tablosunu kontrol et ve düzelt
-- Bu script'i Supabase SQL Editor'da çalıştır

-- Önce ip_logs tablosunun yapısını kontrol et
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ip_logs';

-- ip_logs tablosuna user_id kolonu ekle (eğer yoksa)
ALTER TABLE ip_logs ADD COLUMN IF NOT EXISTS user_id UUID;

-- ip_logs tablosundaki username kolonunu user_id ile eşleştir
UPDATE ip_logs 
SET user_id = users.id 
FROM users 
WHERE ip_logs.username = users.username;

-- ip_logs tablosuna foreign key ekle
ALTER TABLE ip_logs ADD CONSTRAINT fk_ip_logs_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ip_logs tablosuna index ekle
CREATE INDEX IF NOT EXISTS idx_ip_logs_user_id ON ip_logs(user_id);

-- ip_logs tablosundaki username kolonunu kaldır (artık gerekli değil)
-- ALTER TABLE ip_logs DROP COLUMN IF EXISTS username;
