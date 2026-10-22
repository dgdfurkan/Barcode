-- =============================================================
-- Telegram Raporları sayfası: ayrıntılı ayar ve gün içinde birden çok rapor saati
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < telegram_ayar.sql
--
-- ÖNCE: gece_raporu.sql çalışmış olmalı.
--
-- gece.ayar.ayrinti      Sayfadaki bütün seçimler (jsonb). Eski kolonlar (acik,
--                        bekleyen, foto) Asistan penceresi için kalır, sunucu
--                        ikisini eşitler.
-- gece.gonderim.dakika   Raporun saati (gün içinde dakika, 60 = 01:00). Aynı gün
--                        birden çok saat seçilebildiği için anahtar artık
--                        (username, gun, dakika). Eski satırlar 01:00 sayılır.
-- gece.gunluk_durum      Günlük (otomatik) sayımın depo panelindeki son durumu:
--                        toplam görev, tamamlanan. Asistan rapordan önce yazar.
--
-- GÜVENLİ: Yalnız ekler; birden çok kez çalıştırılabilir. Var olan veri silinmez.
-- =============================================================

BEGIN;

ALTER TABLE gece.ayar ADD COLUMN IF NOT EXISTS ayrinti JSONB;

ALTER TABLE gece.gonderim ADD COLUMN IF NOT EXISTS dakika SMALLINT NOT NULL DEFAULT 60;
ALTER TABLE gece.gonderim DROP CONSTRAINT IF EXISTS gonderim_pkey;
ALTER TABLE gece.gonderim ADD CONSTRAINT gonderim_pkey PRIMARY KEY (username, gun, dakika);

CREATE TABLE IF NOT EXISTS gece.gunluk_durum (
    username    VARCHAR(50) NOT NULL
                REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    gun         DATE        NOT NULL,
    toplam      INTEGER     NOT NULL,
    tamam       INTEGER     NOT NULL,
    bitti       BOOLEAN     NOT NULL DEFAULT false,
    guncelleme  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, gun)
);
ALTER TABLE gece.gunluk_durum ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gece.gunluk_durum TO jetbarkod;

COMMIT;

SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema = 'gece' AND table_name IN ('ayar', 'gonderim') AND column_name IN ('ayrinti', 'dakika');
