-- =============================================================
-- Hesaplama: panelden okunan aylık kurye verisi hesapta (vps-api/hesaplama-kilit.js)
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < hesaplama_veri.sql
--
-- ÖNCE: hesaplama_kilit.sql çalışmış olmalı (hesaplama şeması).
--
-- veri   { kuryeler: [{ id, ad, foto, say, km, not, cdi }], bas, son }
-- zaman  panelden son okunma; kullanıcı başına son 12 ay tutulur
--
-- GÜVENLİ: Yalnız ekler; birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS hesaplama;
GRANT USAGE ON SCHEMA hesaplama TO jetbarkod;

CREATE TABLE IF NOT EXISTS hesaplama.veri (
    username  VARCHAR(50) NOT NULL
              REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    ay        CHAR(7)     NOT NULL,
    veri      JSONB       NOT NULL,
    zaman     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, ay)
);
ALTER TABLE hesaplama.veri ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON hesaplama.veri TO jetbarkod;

COMMIT;
