-- VACUUM Komutları - Transaction Block Dışında Çalıştırılmalı!
-- ÖNEMLİ: Supabase SQL Editor'da bu komutları tek tek, ayrı sorgular olarak çalıştırın
-- BEGIN/COMMIT kullanmayın!

-- 1. ADIM: VACUUM ANALYZE (lock yapmaz, hızlı)
-- Bu komutu çalıştırın ve sonucu bekleyin:
VACUUM ANALYZE user_data;

-- Sonra boyutu kontrol edin:
SELECT 
    pg_size_pretty(pg_total_relation_size('user_data')) as total_size,
    pg_size_pretty(pg_relation_size('user_data')) as table_size,
    (SELECT count(*) FROM user_data) as row_count;

-- Eğer hala 964 MB gösteriyorsa:

-- 2. ADIM: VACUUM FULL (lock yapar, tam temizlik)
-- DİKKAT: Bu komut tabloyu geçici olarak kilitleyecek, işlem sırasında kullanılamaz!
-- Bu komutu ayrı bir sorgu olarak çalıştırın:
VACUUM FULL user_data;

-- Sonra tekrar boyutu kontrol edin:
SELECT 
    pg_size_pretty(pg_total_relation_size('user_data')) as total_size,
    pg_size_pretty(pg_relation_size('user_data')) as table_size,
    (SELECT count(*) FROM user_data) as row_count;

