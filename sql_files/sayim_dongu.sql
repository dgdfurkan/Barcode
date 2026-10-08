-- =============================================================
-- Sayım Döngüsü: alt kategori durumu ve katalog dışı ürünler
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < sayim_dongu.sql
--
-- sayim_dongu
--   Kullanıcı başına alt kategori satırı: Getir alt kategori kimliği
--   (doğrulanmış ya da öğrenilmiş), son ürün çekimi zamanı ve ürün sayısı.
--   anahtar = '_ayar' satırı döngü ayarını (süre) ve Getir yanıtlarından
--   öğrenilen ad -> kimlik eşleşmelerini tutar.
--   Satır bazlı: telefon ve bilgisayar aynı anda yazsa da birbirini ezmez.
--
-- sayim_harici_urunler
--   Getir'den çekilen ama sitenin ürün kataloğunda olmayan ürünlerin adı,
--   görseli ve barkodları. Sayım listesi bunlar olmadan ürünü gösteremez;
--   hesapta durduğu için öbür cihaz da görür.
--
-- GÜVENLİK: İkisi de counting_items ile aynı kural: tarayıcı yalnız kendi
-- satırlarını görür ve yazar (RLS, kullanıcı adı imzalı jetondan).
--
-- GÜVENLİ: Yalnız yeni tablo ekler. Birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sayim_dongu (
    username      VARCHAR(50) NOT NULL
                  REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    anahtar       TEXT        NOT NULL CHECK (char_length(anahtar) BETWEEN 1 AND 120),
    getir_id      TEXT        CHECK (getir_id IS NULL OR getir_id ~ '^[0-9a-f]{24}$'),
    cekildi_at    TIMESTAMPTZ,
    urun_sayisi   INTEGER     CHECK (urun_sayisi IS NULL OR urun_sayisi BETWEEN 0 AND 5000),
    ayar          JSONB       CHECK (ayar IS NULL OR pg_column_size(ayar) < 65536),
    guncellendi_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, anahtar)
);

CREATE TABLE IF NOT EXISTS public.sayim_harici_urunler (
    username      VARCHAR(50) NOT NULL
                  REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id    TEXT        NOT NULL CHECK (product_id ~ '^[0-9a-f]{24}$'),
    ad            TEXT        NOT NULL CHECK (char_length(ad) BETWEEN 1 AND 200),
    gorsel        TEXT        CHECK (gorsel IS NULL OR (char_length(gorsel) <= 400 AND gorsel LIKE 'https://%')),
    barkodlar     JSONB       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(barkodlar) = 'array' AND pg_column_size(barkodlar) < 4096),
    kategori      TEXT        CHECK (kategori IS NULL OR char_length(kategori) <= 120),
    guncellendi_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, product_id)
);

ALTER TABLE public.sayim_dongu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sayim_harici_urunler ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['sayim_dongu', 'sayim_harici_urunler'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_self', t);
        EXECUTE format($f$
            CREATE POLICY %I ON public.%I
                FOR ALL TO web_user
                USING (username = public.auth_username())
                WITH CHECK (username = public.auth_username())
        $f$, t || '_self', t);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
        EXECUTE format($f$
            CREATE POLICY %I ON public.%I
                FOR ALL TO web_admin
                USING (public.auth_is_admin())
                WITH CHECK (public.auth_is_admin())
        $f$, t || '_admin', t);

        EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, web_anon', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO web_user, web_admin', t);
    END LOOP;
END
$$;

COMMIT;

-- PostgREST yeni tabloları hemen görsün
NOTIFY pgrst, 'reload schema';

-- Doğrulama: iki tablo, RLS açık, giriş yapmamış ziyaretçiye yetki yok
SELECT c.relname AS tablo,
       c.relrowsecurity AS rls,
       has_table_privilege('web_user', c.oid, 'INSERT') AS kullanici_yazabilir,
       has_table_privilege('web_anon', c.oid, 'SELECT') AS ziyaretci_okuyabilir
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('sayim_dongu', 'sayim_harici_urunler')
ORDER BY 1;
