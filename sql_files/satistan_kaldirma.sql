-- =============================================================
-- Satıştan Kaldırma: depo panelindeki kayıtların kopyası
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < satistan_kaldirma.sql
--
-- NE TUTULUYOR
-- Jet Barkod Asistan, depo panelinin "Satıştan Kaldırma Listesi"ni saatte
-- bir okuyup buraya yazıyor (fırın çıkışları hiç gelmiyor). Site sayfası
-- (/kaldirma/) buradan okuyor; durum İptal Edildi'ye ya da bilinmeyen bir
-- koda dönen kayıt Telegram'a bildiriliyor (vps-api/kaldirma).
--
-- NEDEN AYRI ŞEMA
-- `kaldirma` şeması PostgREST'te yayınlanmıyor (yalnız public). Tek kapı
-- Node API'si; her uç kullanıcı adını imzalı jetondan alıyor. RLS açık,
-- tarayıcı rollerine hiçbir yetki yok.
--
-- GÜVENLİ: Yalnız yeni şema ve tablo ekler, birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS kaldirma;
REVOKE ALL ON SCHEMA kaldirma FROM PUBLIC;

-- Panel kaydı (Getir kimliği + hesap başına tek satır)
CREATE TABLE IF NOT EXISTS kaldirma.kayitlar (
    username        VARCHAR(50) NOT NULL
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    kayit_id        TEXT        NOT NULL,
    olusturma       TIMESTAMPTZ NOT NULL,
    guncelleme      TIMESTAMPTZ,
    durum           INTEGER     NOT NULL,
    sonuc_tipi      INTEGER,
    sebep           TEXT,
    adet            NUMERIC     NOT NULL DEFAULT 0,
    veri            JSONB       NOT NULL DEFAULT '{}'::jsonb,   -- ürün, görsel, SKT, oluşturan, geçmiş
    bildirilen_durum INTEGER,                                    -- Telegram'a son bildirilen durum
    ilk_gorulme     TIMESTAMPTZ NOT NULL DEFAULT now(),
    son_gorulme     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, kayit_id)
);
CREATE INDEX IF NOT EXISTS kaldirma_kayitlar_tarih ON kaldirma.kayitlar (username, olusturma DESC);

-- Hesap başına eşitleme durumu (ilk eşitlemede geçmiş kayıtlar bildirilmez)
CREATE TABLE IF NOT EXISTS kaldirma.esitleme (
    username        VARCHAR(50) PRIMARY KEY
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    ilk_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    son_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    son_sayi        INTEGER     NOT NULL DEFAULT 0
);

ALTER TABLE kaldirma.kayitlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaldirma.esitleme ENABLE ROW LEVEL SECURITY;

-- Node API (jetbarkod, BYPASSRLS): yalnız gerekeni
GRANT USAGE ON SCHEMA kaldirma TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON kaldirma.kayitlar TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON kaldirma.esitleme TO jetbarkod;

COMMIT;

-- Doğrulama: iki satır, ikisinde de api_yazabilir = t
SELECT c.relname AS tablo,
       has_table_privilege('jetbarkod', c.oid, 'INSERT') AS api_yazabilir
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'kaldirma' AND c.relkind = 'r'
ORDER BY 1;
