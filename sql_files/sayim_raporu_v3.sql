-- =============================================================
-- Sayım raporu v3: bir hesaba birden çok Telegram hesabı
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < sayim_raporu_v3.sql
-- Önce sayim_raporu_telegram.sql ve sayim_raporu_v2.sql çalışmış olmalı.
--
-- - telegram_baglantilari: birincil anahtar kullanıcı adından kendi
--   kimliğine (id) geçiyor; aynı kullanıcı + aynı sohbet bir kez.
--   Mevcut bağlantılar olduğu gibi kalıyor.
-- - sayim_raporlari.ilerleme: hangi hesaba hangi parça gitti; yeniden
--   denemede aynı hesaba ikinci kez gitmesin diye.
--
-- GÜVENLİ: Satır silmez. Birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

ALTER TABLE rapor.telegram_baglantilari
    ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();

DO $$
BEGIN
    -- Birincil anahtar hâlâ username üzerindeyse id'ye taşı
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'rapor.telegram_baglantilari'::regclass
          AND c.contype = 'p' AND a.attname = 'username'
    ) THEN
        ALTER TABLE rapor.telegram_baglantilari DROP CONSTRAINT telegram_baglantilari_pkey;
        ALTER TABLE rapor.telegram_baglantilari ADD CONSTRAINT telegram_baglantilari_pkey PRIMARY KEY (id);
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tb_kullanici_sohbet
    ON rapor.telegram_baglantilari (username, chat_id);

ALTER TABLE rapor.sayim_raporlari
    ADD COLUMN IF NOT EXISTS ilerleme JSONB;

COMMIT;

-- Doğrulama: birincil anahtar "id", tekil indeks var, ilerleme sütunu var
SELECT
    (SELECT a.attname FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'rapor.telegram_baglantilari'::regclass AND c.contype = 'p') AS birincil_anahtar,
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'rapor' AND indexname = 'uq_tb_kullanici_sohbet') AS tekil_indeks,
    EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'rapor' AND table_name = 'sayim_raporlari' AND column_name = 'ilerleme') AS ilerleme_sutunu,
    (SELECT count(*) FROM rapor.telegram_baglantilari) AS bagli_hesap;
