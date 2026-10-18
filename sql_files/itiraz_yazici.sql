-- =============================================================
-- İtiraz Yazıcı: geçmiş itirazlar, üslup hafızası ve Gemini anahtarı
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < itiraz_yazici.sql
--
-- NE TUTULUYOR
-- Site sayfası (/itiraz/) franchise panelinin kendi listesini okuyup kayıtları
-- buraya bırakıyor. Sonuçlanan itirazlar (kabul / red) yapay zekânın örnek
-- hafızası oluyor. Kullanıcının seçip düzenlediği son metin de üslup için
-- saklanıyor. Gemini anahtarı AES-256-GCM ile şifreli; tarayıcıya hiç dönmüyor.
--
-- NEDEN AYRI ŞEMA
-- `itiraz` şeması PostgREST'te yayınlanmıyor. Tek kapı Node API'si
-- (vps-api/itiraz); her uç kullanıcı adını imzalı jetondan alıyor.
--
-- GÜVENLİ: Yalnız yeni şema ve tablo ekler, birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS itiraz;
REVOKE ALL ON SCHEMA itiraz FROM PUBLIC;

CREATE TABLE IF NOT EXISTS itiraz.ayarlar (
    username        VARCHAR(50) PRIMARY KEY
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    anahtar_sifreli TEXT,                                       -- iv.etiket.veri (base64)
    anahtar_son4    TEXT,                                       -- yalnız "…abcd" göstermek için
    olgular         JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- işaretlenen depo olguları
    guncelleme      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS itiraz.kayitlar (
    username        VARCHAR(50) NOT NULL
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    kayit_id        TEXT        NOT NULL,
    kayit_tarihi    TIMESTAMPTZ,
    son_tarih       TIMESTAMPTZ,
    durum           INTEGER     NOT NULL,       -- 100 itirazsız · 200 bekliyor · 300 kabul · 400 red
    kriter          TEXT,
    sikayet         TEXT,                       -- "Eksik ürün", "Yanlış ürün" ...
    aciklama        TEXT,
    musteri_notu    TEXT,
    urun            TEXT,
    itiraz_metni    TEXT,
    itiraz_sebep_id TEXT,
    secilen_metin   TEXT,                       -- Jet Barkod'dan seçilip düzenlenen son metin
    secilen_sebep   TEXT,
    ilk_gorulme     TIMESTAMPTZ NOT NULL DEFAULT now(),
    son_gorulme     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, kayit_id)
);
-- Son üretilen taslaklar (telefon ve bilgisayar aynı taslağı görsün)
ALTER TABLE itiraz.kayitlar ADD COLUMN IF NOT EXISTS taslak JSONB;
CREATE INDEX IF NOT EXISTS itiraz_kayitlar_tarih ON itiraz.kayitlar (username, kayit_tarihi DESC);

-- Günlük yazdırma sayacı (kullanıcının kendi anahtarını korur)
CREATE TABLE IF NOT EXISTS itiraz.kullanim (
    username        VARCHAR(50) NOT NULL
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    gun             DATE        NOT NULL,
    sayi            INTEGER     NOT NULL DEFAULT 0,
    PRIMARY KEY (username, gun)
);

ALTER TABLE itiraz.ayarlar  ENABLE ROW LEVEL SECURITY;
ALTER TABLE itiraz.kayitlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE itiraz.kullanim ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA itiraz TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON itiraz.ayarlar  TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON itiraz.kayitlar TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON itiraz.kullanim TO jetbarkod;

COMMIT;

-- Doğrulama: üç satır, hepsinde api_yazabilir = t
SELECT c.relname AS tablo,
       has_table_privilege('jetbarkod', c.oid, 'INSERT') AS api_yazabilir
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'itiraz' AND c.relkind = 'r'
ORDER BY 1;
