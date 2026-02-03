-- users tablosunda IP takibi: max_ip_count + tracked_ips (user_ip_tracking kullanılmıyor)
-- SQL Editor'da çalıştır.

ALTER TABLE users ADD COLUMN IF NOT EXISTS tracked_ips TEXT[] DEFAULT '{}';

-- Mevcut satırlarda NULL ise boş dizi (text[] için '{}')
UPDATE users SET tracked_ips = '{}' WHERE tracked_ips IS NULL;
