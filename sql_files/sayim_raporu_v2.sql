-- =============================================================
-- Sayım raporu v2: şablon ayarı, kare kart, tekrar gönderim
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < sayim_raporu_v2.sql
-- Önce sayim_raporu_telegram.sql çalışmış olmalı.
--
-- - sayim_raporlari: her işin ayarı (ayar), kartın Telegram kimliği
--   (tg_kart_id) ve tekrar gönderimde kaynak iş (kaynak).
-- - tercihler: kullanıcının son seçtiği şablon ve ayrıntılar. Cihazda
--   değil hesapta duruyor; başka cihazdan girince aynı ayar geliyor.
--
-- GÜVENLİ: Yalnız sütun ve tablo ekler, hiçbir satırı silmez. Birden çok
-- kez çalıştırılabilir. `rapor` şeması PostgREST'e kapalı.
-- =============================================================

BEGIN;

ALTER TABLE rapor.sayim_raporlari
    ADD COLUMN IF NOT EXISTS ayar JSONB,
    ADD COLUMN IF NOT EXISTS tg_kart_id TEXT,
    ADD COLUMN IF NOT EXISTS kaynak UUID;

CREATE TABLE IF NOT EXISTS rapor.tercihler (
    username     VARCHAR(50) PRIMARY KEY
                 REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    ayar         JSONB       NOT NULL,
    guncellendi  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rapor.tercihler ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['web_anon', 'web_user', 'web_admin', 'authenticator'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON rapor.tercihler FROM %I', r);
        END IF;
    END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON rapor.tercihler TO jetbarkod;

COMMIT;

-- Doğrulama: üç tablo, "tarayici_yetkisi" hep false; sütun sayısı 3
SELECT c.relname AS tablo,
       has_table_privilege('jetbarkod', c.oid, 'INSERT') AS api_yazabilir,
       EXISTS (
           SELECT 1 FROM pg_roles r
           WHERE r.rolname IN ('web_anon', 'web_user', 'web_admin')
             AND has_table_privilege(r.rolname, c.oid, 'SELECT')
       ) AS tarayici_yetkisi
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'rapor' AND c.relkind = 'r'
ORDER BY 1;

SELECT count(*) AS yeni_sutun
FROM information_schema.columns
WHERE table_schema = 'rapor' AND table_name = 'sayim_raporlari'
  AND column_name IN ('ayar', 'tg_kart_id', 'kaynak');
