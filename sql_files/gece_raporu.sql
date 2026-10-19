-- =============================================================
-- Gece raporu: her gece 01:00'de son 24 saat Telegram'a
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < gece_raporu.sql
--
-- ÖNCE: sayim_gecmisi_paylasim.sql ve itiraz_yazici.sql çalışmış olmalı
-- (sayım farkları public.sayim_gecmisi'den, itirazlar itiraz.kayitlar'dan).
--
-- gece.ayar      Hesap başına açık/kapalı (yoksa açık sayılır).
-- gece.gonderim  Hangi gecenin raporu gitti; sunucu yeniden başlasa da
--                aynı gece ikinci kez gönderilmez.
-- itiraz.kayitlar.durum_degisti_at  "Son 24 saatte sonuçlanan itirazlar" için.
--
-- GÜVENLİ: Yalnız yeni şema, tablo ve kolon ekler; birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS gece;
REVOKE ALL ON SCHEMA gece FROM PUBLIC;

CREATE TABLE IF NOT EXISTS gece.ayar (
    username    VARCHAR(50) PRIMARY KEY
                REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    acik        BOOLEAN     NOT NULL DEFAULT true,
    guncelleme  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gece.gonderim (
    username    VARCHAR(50) NOT NULL
                REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    gun         DATE        NOT NULL,                 -- raporun gittiği gece (İstanbul günü)
    gonderildi  TIMESTAMPTZ NOT NULL DEFAULT now(),
    kart        INTEGER,
    PRIMARY KEY (username, gun)
);

ALTER TABLE gece.ayar     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gece.gonderim ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA gece TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON gece.ayar     TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON gece.gonderim TO jetbarkod;

-- İtirazın durumu ne zaman değişti (kabul / red geldiği an)
ALTER TABLE itiraz.kayitlar ADD COLUMN IF NOT EXISTS durum_degisti_at TIMESTAMPTZ;

-- Asistan gece sayım sonuçlarını Node API üzerinden yazar
GRANT SELECT, INSERT, UPDATE ON public.sayim_gecmisi TO jetbarkod;

COMMIT;

SELECT c.relname AS tablo,
       has_table_privilege('jetbarkod', c.oid, 'INSERT') AS api_yazabilir
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'gece' AND c.relkind = 'r'
ORDER BY 1;
