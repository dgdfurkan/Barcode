-- =============================================================
-- Sayım raporu: Telegram bağlantısı ve rapor kuyruğu
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < sayim_raporu_telegram.sql
--
-- NEDEN AYRI ŞEMA
-- Tablolar `rapor` şemasında. PostgREST yalnız `public` şemasını
-- yayınlıyor (db-schemas = "public"), yani bu tablolara /rest/v1
-- üzerinden hiçbir rol, hiçbir yapılandırmada ulaşamaz. Tek kapı Node
-- API'si (jetbarkod rolü) ve orada her uç kendi yetki kontrolünü yapıyor.
-- Ek savunma olarak RLS açık ve tarayıcı rollerine hiçbir yetki yok.
--
-- GÜVENLİ
-- Yeni şema, tablo ve fonksiyon ekler. Mevcut tablolarda tek dokunuş:
-- counting_items'ta orijinal fiyat sütunları yoksa ekler (sayım sayfası
-- zaten bu sütunları kullanıyor; varsa hiçbir şey olmaz). Hiçbir satır
-- silinmez. Birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

ALTER TABLE public.counting_items
    ADD COLUMN IF NOT EXISTS struck_price NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS struck_price_text TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS no_struck_price BOOLEAN DEFAULT FALSE;

CREATE SCHEMA IF NOT EXISTS rapor;
REVOKE ALL ON SCHEMA rapor FROM PUBLIC;

-- Kullanıcının bağladığı Telegram sohbeti (hesaba bağlı, cihaza değil)
CREATE TABLE IF NOT EXISTS rapor.telegram_baglantilari (
    username          VARCHAR(50) PRIMARY KEY
                      REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    chat_id           BIGINT      NOT NULL,
    tg_ad             TEXT,
    tg_kullanici_adi  TEXT,
    durum             TEXT        NOT NULL DEFAULT 'aktif'
                      CHECK (durum IN ('aktif', 'engelli')),
    baglandi_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rapor istekleri. PDF diskte tutulmuyor; Telegram'daki dosya kimliği
-- saklanıyor, "Tekrar gönder" o kimlikle yeniden üretmeden gönderiyor.
CREATE TABLE IF NOT EXISTS rapor.sayim_raporlari (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    no              BIGINT      GENERATED ALWAYS AS IDENTITY,
    username        VARCHAR(50) NOT NULL
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    tablo           TEXT        NOT NULL CHECK (char_length(tablo) BETWEEN 1 AND 200),
    durum           TEXT        NOT NULL DEFAULT 'bekliyor'
                    CHECK (durum IN ('bekliyor', 'hazirlaniyor', 'gonderildi', 'hata')),
    hata            TEXT,
    deneme          SMALLINT    NOT NULL DEFAULT 0,
    sonraki_deneme  TIMESTAMPTZ,
    yedek_fiyat     JSONB,
    ozet            JSONB,
    sayfa           SMALLINT,
    boyut           INTEGER,
    tg_dosya_id     TEXT,
    istendi_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    basladi_at      TIMESTAMPTZ,
    gonderildi_at   TIMESTAMPTZ
);

-- Geçmiş listesi ve hız sınırı: kullanıcının son istekleri
CREATE INDEX IF NOT EXISTS idx_sr_kullanici_zaman
    ON rapor.sayim_raporlari (username, istendi_at DESC);
-- İşçi yalnız bekleyenlere bakıyor; küçük kısmi indeks
CREATE INDEX IF NOT EXISTS idx_sr_bekleyen
    ON rapor.sayim_raporlari (istendi_at)
    WHERE durum IN ('bekliyor', 'hazirlaniyor');

ALTER TABLE rapor.telegram_baglantilari ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapor.sayim_raporlari ENABLE ROW LEVEL SECURITY;

-- Tarayıcı rolleri: hiçbir şey
DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['web_anon', 'web_user', 'web_admin', 'authenticator'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA rapor FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA rapor FROM %I', r);
        END IF;
    END LOOP;
END
$$;

-- Sayım satırlarını okuma kapısı. API'ye counting_items üzerinde tablo
-- yetkisi VERİLMİYOR; yalnız bu fonksiyon, yalnız istenen kullanıcının
-- istenen tablosu, yalnız rapora gereken beş sütun. Fonksiyon `rapor`
-- şemasında olduğu için PostgREST /rpc üzerinden de çağrılamaz.
CREATE OR REPLACE FUNCTION rapor.sayim_satirlari(p_username TEXT, p_tablo TEXT)
RETURNS TABLE (
    product_id      TEXT,
    warehouse_stock NUMERIC,
    system_stock    NUMERIC,
    price           NUMERIC,
    struck_price    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT ci.product_id, ci.warehouse_stock, ci.system_stock, ci.price, ci.struck_price
    FROM public.counting_items ci
    WHERE ci.username = p_username AND ci.table_name = p_tablo
    LIMIT 5000
$$;

REVOKE ALL ON FUNCTION rapor.sayim_satirlari(TEXT, TEXT) FROM PUBLIC;

-- Node API (jetbarkod, BYPASSRLS): yalnız gerekeni
GRANT USAGE ON SCHEMA rapor TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON rapor.telegram_baglantilari TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON rapor.sayim_raporlari TO jetbarkod;
GRANT EXECUTE ON FUNCTION rapor.sayim_satirlari(TEXT, TEXT) TO jetbarkod;

COMMIT;

-- Doğrulama: iki tablo görünmeli, "tarayici_yetkisi" sütunu false olmalı
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
