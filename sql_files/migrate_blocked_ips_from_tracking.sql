-- İsteğe bağlı: user_ip_tracking'deki engelli IP'leri blocked_ips'e taşı
-- create_blocked_ips.sql çalıştırıldıktan SONRA, drop_user_ip_tracking.sql'den ÖNCE çalıştırın.
-- Böylece mevcut engelli IP'ler kaybolmaz.

INSERT INTO blocked_ips (ip_address)
SELECT DISTINCT ip_address::text
FROM user_ip_tracking
WHERE is_blocked = true
ON CONFLICT (ip_address) DO NOTHING;
