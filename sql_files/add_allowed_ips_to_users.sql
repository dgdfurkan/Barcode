-- users tablosunda allowed_ips yoksa ekle (Supabase schema cache hatası için)
-- SQL Editor'da bu dosyayı çalıştırın.

ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT ARRAY['*'];

-- Mevcut satırlarda NULL ise varsayılan değer ata
UPDATE users SET allowed_ips = ARRAY['*'] WHERE allowed_ips IS NULL;
