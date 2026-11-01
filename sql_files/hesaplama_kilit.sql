-- =============================================================
-- Hesaplama kilidi: açılış şifresi hesapta (vps-api/hesaplama-kilit.js)
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < hesaplama_kilit.sql
--
-- ozet          bcrypt özeti; şifrenin kendisi saklanmaz
-- kart          şifre unutulunca sorulan hafıza kartı (9 resimden biri)
-- yanlis_*      art arda yanlış deneme; sınırda 60 sn bekleme (bekle_kadar)
--
-- GÜVENLİ: Yalnız ekler; birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS hesaplama;
GRANT USAGE ON SCHEMA hesaplama TO jetbarkod;

CREATE TABLE IF NOT EXISTS hesaplama.kilit (
    username      VARCHAR(50) PRIMARY KEY
                  REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    ozet          TEXT        NOT NULL,
    kart          VARCHAR(16) NOT NULL,
    yanlis_sifre  SMALLINT    NOT NULL DEFAULT 0,
    yanlis_kart   SMALLINT    NOT NULL DEFAULT 0,
    bekle_kadar   TIMESTAMPTZ,
    olusturma     TIMESTAMPTZ NOT NULL DEFAULT now(),
    guncelleme    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE hesaplama.kilit ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON hesaplama.kilit TO jetbarkod;

COMMIT;
