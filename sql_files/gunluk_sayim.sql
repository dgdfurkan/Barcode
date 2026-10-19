-- =============================================================
-- Günlük sayım: depo panelinin 50'lik otomatik sayımı, kendiliğinden
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < gunluk_sayim.sql
--
-- NE TUTULUYOR
-- Jet Barkod Asistan her sabah 06:00'da depo panelinden o günün otomatik
-- sayımındaki ürünleri okuyup buraya bırakıyor. Sayım sayfası açılınca
-- `Günlük|YYYY-MM-DD` tablosunu bu listeden kendisi kuruyor. Birden çok
-- cihaz açıksa tabloyu yalnız biri kurar (alindi_* kilidi).
-- Gece 00:00-01:00 uyarısı, kalan ürünü counting_items'tan sayar.
--
-- NEDEN AYRI ŞEMA
-- `gunluk` şeması PostgREST'te yayınlanmıyor. Tek kapı Node API'si
-- (vps-api/gunluk-sayim.js); her uç kullanıcı adını imzalı jetondan alır.
--
-- GÜVENLİ: Yalnız yeni şema ve tablo ekler, birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS gunluk;
REVOKE ALL ON SCHEMA gunluk FROM PUBLIC;

CREATE TABLE IF NOT EXISTS gunluk.sayimlar (
    username        VARCHAR(50) NOT NULL
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    gun             DATE        NOT NULL,                     -- İstanbul günü
    sayim_id        TEXT        NOT NULL,                     -- panelin sayım kimliği
    urunler         JSONB       NOT NULL DEFAULT '[]'::jsonb, -- [{id, ad}]
    eklendi_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    alindi_at       TIMESTAMPTZ,                              -- bir cihaz tabloyu kurmaya başladı
    alan_cihaz      TEXT,
    uygulandi_at    TIMESTAMPTZ,                              -- tablo kuruldu
    eklenen         INTEGER,
    atlanan         INTEGER,
    PRIMARY KEY (username, gun)
);

ALTER TABLE gunluk.sayimlar ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA gunluk TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON gunluk.sayimlar TO jetbarkod;

COMMIT;

-- Doğrulama: bir satır, api_yazabilir = t
SELECT c.relname AS tablo,
       has_table_privilege('jetbarkod', c.oid, 'INSERT') AS api_yazabilir
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'gunluk' AND c.relkind = 'r';
