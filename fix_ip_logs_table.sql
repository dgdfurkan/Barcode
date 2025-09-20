-- ip_logs tablosundaki user_id kolonunu düzelt
-- Bu script'i Supabase SQL Editor'da çalıştır

-- ip_logs tablosundaki user_id kolonunu UUID olarak güncelle
ALTER TABLE ip_logs ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- ip_logs tablosuna foreign key ekle
ALTER TABLE ip_logs ADD CONSTRAINT fk_ip_logs_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ip_logs tablosuna index ekle
CREATE INDEX IF NOT EXISTS idx_ip_logs_user_id ON ip_logs(user_id);
