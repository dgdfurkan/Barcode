-- =============================================================
-- Sayım farkı / sıfırlanan ürünler
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < sayim_fark.sql
--
-- Rapor artık AYRI bir tablo tutmuyor: veri zaten public.sayim_gecmisi'de
-- (Sayım Geçmişi / gece raporu akışı panelden sistem/fiziksel stoğu okuyup
-- oraya artımlı yazıyor). Rapor o tablodan derleniyor (vps-api/sayim-fark.js).
--
-- Bu dosya, ilk denemede açılan ama kullanılmayan `sayim_fark` şemasını
-- temizler. GÜVENLİ: yalnız o boş şemayı siler, birden çok kez çalıştırılabilir.
-- Çalıştırmasan da zarar yok (boş dururlar); sadece düzen için.
--
-- GEREKLİ KURULUM: Raporun veri görmesi için public.sayim_gecmisi'nin kurulu
-- olması lazım (sql_files/sayim_gecmisi_paylasim.sql). Kurulu değilse rapor
-- "sunucu güncellemesi bekleniyor" der.
-- =============================================================

BEGIN;

DROP TABLE IF EXISTS sayim_fark.farklar;
DROP TABLE IF EXISTS sayim_fark.imlec;
DROP SCHEMA IF EXISTS sayim_fark;

COMMIT;

-- Kontrol: 0 satır gelmeli (şema kalmadı)
SELECT nspname FROM pg_namespace WHERE nspname = 'sayim_fark';
