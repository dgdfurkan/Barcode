-- Hızlı çözüm: VACUUM FULL ile TOAST temizleme
-- Bu komut tabloyu geçici olarak lock eder, işlem sırasında kullanılamaz
-- ÖNEMLİ: VACUUM komutları transaction block içinde çalıştırılamaz!
-- Her komutu ayrı ayrı, BEGIN/COMMIT olmadan çalıştırın!

-- 1. Önce sadece VACUUM ANALYZE deneyin (lock yapmaz, ama TOAST'ı tam temizlemez)
-- Bu komutu ayrı bir sorgu olarak çalıştırın:
VACUUM ANALYZE user_data;

-- 2. Eğer hala 964 MB gösteriyorsa, VACUUM FULL yapın (lock yapar, ama tam temizlik yapar)
-- Bu komutu da ayrı bir sorgu olarak çalıştırın:
VACUUM FULL user_data;

-- 3. Sonrasında boyutu kontrol edin (bu normal SELECT, transaction içinde çalışabilir):
SELECT 
    pg_size_pretty(pg_total_relation_size('user_data')) as total_size,
    (SELECT count(*) FROM user_data) as row_count;

