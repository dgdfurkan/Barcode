-- TOAST Storage Temizleme ve Analiz Sorguları

-- 1. Tablo yapısını kontrol et
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_data'
ORDER BY ordinal_position;

-- 2. Tablo boyutunu kontrol et (TOAST dahil)
SELECT 
    pg_size_pretty(pg_total_relation_size('user_data')) as total_size,
    pg_size_pretty(pg_relation_size('user_data')) as table_size,
    pg_size_pretty(pg_total_relation_size('user_data') - pg_relation_size('user_data')) as toast_size,
    (SELECT count(*) FROM user_data) as row_count;

-- 3. TOAST tablosunu kontrol et
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'pg_toast%'
  AND tablename LIKE '%user_data%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. VACUUM FULL ile temizle (DİKKAT: Tabloyu lock eder, işlem sırasında kullanılamaz)
-- ÖNEMLİ: VACUUM komutları transaction block içinde çalıştırılamaz!
-- Her komutu ayrı ayrı, BEGIN/COMMIT olmadan çalıştırın!

-- Önce sadece VACUUM ANALYZE deneyin (lock yapmaz, bu komutu ayrı sorgu olarak çalıştırın):
-- VACUUM ANALYZE user_data;

-- Eğer hala büyükse, VACUUM FULL yapın (lock yapar ama tam temizlik yapar, bu komutu da ayrı sorgu olarak çalıştırın):
-- VACUUM FULL user_data;

-- 5. Eğer VACUUM FULL bile işe yaramazsa, tabloyu yeniden oluştur:
-- Tabloyu yeniden oluştur (tüm verileri korur)
-- NOT: Bu işlem transaction block içinde çalıştırılabilir
/*
BEGIN;

-- Yedek tablo oluştur
CREATE TABLE user_data_backup AS SELECT * FROM user_data;

-- Orijinal tabloyu sil
DROP TABLE user_data;

-- Yeni tabloyu oluştur
CREATE TABLE user_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    custom_products JSONB DEFAULT '[]'::jsonb NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'leri oluştur
CREATE INDEX idx_user_data_custom_products ON user_data USING GIN (custom_products);
CREATE INDEX idx_user_data_settings ON user_data USING GIN (settings);
CREATE INDEX idx_user_data_username ON user_data(username);

-- Trigger'ı yeniden oluştur
CREATE TRIGGER update_user_data_updated_at BEFORE UPDATE ON user_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verileri geri yükle
INSERT INTO user_data SELECT * FROM user_data_backup;

-- Yedek tabloyu sil
DROP TABLE user_data_backup;

COMMIT;
*/

