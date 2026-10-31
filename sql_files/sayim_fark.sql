-- =============================================================
-- Sayım farkı: Telegram'a raporlanmış görevler
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < sayim_fark.sql
-- Önce: sayim_gecmisi_paylasim.sql (public.sayim_gecmisi)
--
-- Sayım sonuçları public.sayim_gecmisi'de (Sayım Geçmişi, gece raporu ve
-- Sayım Farkı sayfasının "Panelden Güncelle"si yazıyor). Burada yalnız
-- zamanlı Sayım Farkı raporunun hangi görevi gönderdiği tutulur: panel
-- açık değilken yapılmış bir sayım ertesi gün okunsa da raporda bir kez
-- görünür, ikinci kez gelmez.
--
-- Tablo yoksa rapor çalışır; yeni satırları sayımın bitiş saatine göre
-- seçer (geç okunan sayım o zaman kaçabilir).
--
-- GÜVENLİ: birden çok kez çalıştırılabilir. İlk denemeden kalan
-- kullanılmayan tablolar (farklar, imlec) silinir.
-- =============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS sayim_fark;

DROP TABLE IF EXISTS sayim_fark.farklar;
DROP TABLE IF EXISTS sayim_fark.imlec;

CREATE TABLE IF NOT EXISTS sayim_fark.raporlanan (
    username    TEXT        NOT NULL,
    gorev_id    TEXT        NOT NULL,
    gonderildi  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, gorev_id)
);

CREATE INDEX IF NOT EXISTS idx_sayim_fark_raporlanan_zaman ON sayim_fark.raporlanan (username, gonderildi);

GRANT USAGE ON SCHEMA sayim_fark TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON sayim_fark.raporlanan TO jetbarkod;

COMMIT;

-- Kontrol: raporlanan tablosu ve API'nin yazma izni
SELECT to_regclass('sayim_fark.raporlanan') AS tablo,
       has_table_privilege('jetbarkod', 'sayim_fark.raporlanan', 'INSERT') AS api_yazabilir;
