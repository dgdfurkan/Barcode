-- =============================================================
-- İtiraz raporu: itiraz kaydının siparişi (Telegram kartında içerik ve kişiler)
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < itiraz_rapor.sql
--
-- ÖNCE: itiraz_yazici.sql ve gece_raporu.sql çalışmış olmalı.
--
-- itiraz.kayitlar.siparis_id      Kaydın siparişi (panel listesinden)
-- itiraz.kayitlar.siparis_tur     Siparişin alanı (domainType)
-- itiraz.kayitlar.siparis         Sipariş özeti: ürünler (ad, adet, kimlik, görsel
--                                 adresi), teslim süresi, sipariş zamanı, kurye ve
--                                 toplayıcının adı ve fotoğraf adresi. Müşteri
--                                 bilgisi yok (vps-api/itiraz/siparis.js).
-- itiraz.kayitlar.siparis_deneme  Son okuma denemesi; okunamayan sipariş saatte
--                                 bir yeniden istenir.
--
-- GÜVENLİ: Yalnız ekler; birden çok kez çalıştırılabilir. Var olan veri silinmez.
-- =============================================================

BEGIN;

ALTER TABLE itiraz.kayitlar ADD COLUMN IF NOT EXISTS siparis_id     TEXT;
ALTER TABLE itiraz.kayitlar ADD COLUMN IF NOT EXISTS siparis_tur    SMALLINT;
ALTER TABLE itiraz.kayitlar ADD COLUMN IF NOT EXISTS siparis        JSONB;
ALTER TABLE itiraz.kayitlar ADD COLUMN IF NOT EXISTS siparis_deneme TIMESTAMPTZ;

COMMIT;

-- Kontrol: dört satır gelmeli
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'itiraz' AND table_name = 'kayitlar'
   AND column_name IN ('siparis_id', 'siparis_tur', 'siparis', 'siparis_deneme');
