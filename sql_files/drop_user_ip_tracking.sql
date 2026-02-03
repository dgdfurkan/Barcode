-- user_ip_tracking tablosunu ve ilgili tüm nesneleri kaldır
-- IP takibi artık users.tracked_ips + users.max_ip_count ile yapılıyor.
-- Engellenen IP'ler için blocked_ips tablosu kullanılacak.
--
-- ÖNEMLİ – Çalıştırma sırası:
-- 1) create_blocked_ips.sql  (önce blocked_ips tablosunu oluştur)
-- 2) migrate_blocked_ips_from_tracking.sql  (isteğe bağlı: eski engelli IP'leri taşı)
-- 3) Bu dosyayı çalıştır (drop_user_ip_tracking.sql)
--
-- Bu dosyayı create_blocked_ips.sql'den ÖNCE çalıştırırsanız uygulama hata verir.

-- Trigger'ı kaldır
DROP TRIGGER IF EXISTS trigger_update_user_ip_tracking_updated_at ON user_ip_tracking;

-- Fonksiyonları kaldır
DROP FUNCTION IF EXISTS update_user_ip_tracking_updated_at();
DROP FUNCTION IF EXISTS track_user_ip(UUID, INET);
DROP FUNCTION IF EXISTS track_user_ip(UUID, INET, TEXT);

-- Tabloyu kaldır (policies tablo silinince otomatik gider)
DROP TABLE IF EXISTS user_ip_tracking;
