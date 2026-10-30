-- =============================================================
-- Sayım farkı / sıfırlanan ürünler: panel sayımlarından biriken rapor
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < sayim_fark.sql
--
-- NE TUTULUYOR
-- Jet Barkod Asistan, depo panelinin sayımlarını (gstore-inventory-checks)
-- API ile tarar; her sayımın ürünlerinde sistem vs fiziksel stok farkını ve
-- sıfırlananları (fiziksel 0 iken sistem > 0) buraya bırakır. Ayda bir tam
-- tarama, sonra yalnız yeni günler (imleç: en son taranan sayımın zamanı).
--
-- NEDEN AYRI ŞEMA
-- `sayim_fark` şeması PostgREST'te yayınlanmıyor. Tek kapı Node API'si
-- (vps-api/sayim-fark.js); her uç kullanıcı adını imzalı jetondan alır.
-- Getir'e buradan istek gitmez; tarama tarayıcı tarafında yapılır.
--
-- GÜVENLİ: Yalnız yeni şema ve tablo ekler, birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS sayim_fark;
REVOKE ALL ON SCHEMA sayim_fark FROM PUBLIC;

-- Her kullanıcı için tarama imleci: en son taranan sayımın zamanı
CREATE TABLE IF NOT EXISTS sayim_fark.imlec (
    username        VARCHAR(50) PRIMARY KEY
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    son_check_at    TIMESTAMPTZ,                 -- taranan en yeni sayımın createdAt'i
    ilk_tarama_at   TIMESTAMPTZ,                 -- ilk tam taramanın zamanı
    guncellendi_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sayım başına ürün farkı (log): aynı ürün farklı sayımlarda tekrar görünür
CREATE TABLE IF NOT EXISTS sayim_fark.farklar (
    username        VARCHAR(50) NOT NULL
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    check_id        TEXT        NOT NULL,         -- panelin sayım kimliği
    urun_id         TEXT        NOT NULL,
    urun_ad         TEXT,
    barkod          TEXT,
    sistem          NUMERIC,                      -- sistem stoğu
    fiziksel        NUMERIC,                      -- sayılan (fiziksel) stok
    fark            NUMERIC,                      -- fiziksel - sistem
    sifir           BOOLEAN     NOT NULL DEFAULT false,  -- fiziksel 0 iken sistem > 0
    reason_tur      SMALLINT,                     -- panel reason.type (50 = terminal)
    reason_ad       TEXT,
    alt_kategori    TEXT,                         -- sonradan PRODUCTS_DATA'dan doldurulur
    sayim_at        TIMESTAMPTZ,                  -- sayımın createdAt'i
    eklendi_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, check_id, urun_id)
);

CREATE INDEX IF NOT EXISTS farklar_user_sayim_idx ON sayim_fark.farklar (username, sayim_at DESC);
CREATE INDEX IF NOT EXISTS farklar_user_sifir_idx ON sayim_fark.farklar (username, sifir) WHERE sifir;

ALTER TABLE sayim_fark.imlec   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sayim_fark.farklar ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA sayim_fark TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON sayim_fark.imlec   TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON sayim_fark.farklar TO jetbarkod;

COMMIT;

-- Doğrulama: iki satır, api_yazabilir = t
SELECT c.relname AS tablo,
       has_table_privilege('jetbarkod', c.oid, 'INSERT') AS api_yazabilir
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'sayim_fark' AND c.relkind = 'r';
