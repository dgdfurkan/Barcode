-- =============================================================
-- Sayım geçmişi ve herkese açık Döngü raporu
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < sayim_gecmisi_paylasim.sql
--
-- sayim_gecmisi
--   Depo panelindeki tamamlanmış sayımların ürün başına sonucu: sistem
--   adedi, sayılan adet, zaman. Asistan panelin kendi isteklerinden
--   okuyor. Kişi adı (toplayıcı, oluşturan) tutulmaz.
--
-- dongu_paylasim + dongu_rapor()
--   Kullanıcı başına tek paylaşım bağlantısı. Bağlantı açan kişi giriş
--   yapmadan yalnız dongu_rapor(anahtar) ile o satırın özetini görür.
--   Tablonun kendisi ziyaretçiye kapalı: liste alınamaz, başka
--   kullanıcının satırı okunamaz. Anahtar 128 bit rastgele, tahmin
--   edilemez. Bağlantı silinince rapor anında kapanır.
--
-- GÜVENLİ: Yalnız yeni tablo ve kolon ekler. Birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1) Sayım geçmişi
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sayim_gecmisi (
    username           VARCHAR(50) NOT NULL
                       REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    gorev_id           TEXT        NOT NULL CHECK (gorev_id ~ '^[0-9a-f]{24}$'),
    sayim_id           TEXT        NOT NULL CHECK (sayim_id ~ '^[0-9a-f]{24}$'),
    product_id         TEXT        NOT NULL CHECK (product_id ~ '^[0-9a-f]{24}$'),
    urun_adi           TEXT        CHECK (urun_adi IS NULL OR char_length(urun_adi) <= 200),
    sistem             NUMERIC     NOT NULL CHECK (sistem BETWEEN -1000000 AND 1000000),
    fiziksel           NUMERIC     NOT NULL CHECK (fiziksel BETWEEN -1000000 AND 1000000),
    birim              SMALLINT    CHECK (birim IS NULL OR birim BETWEEN 0 AND 100),
    otomatik           BOOLEAN     NOT NULL DEFAULT false,
    sayim_gorev_sayisi INTEGER     CHECK (sayim_gorev_sayisi IS NULL OR sayim_gorev_sayisi BETWEEN 0 AND 5000),
    sayim_at           TIMESTAMPTZ NOT NULL,
    tamamlandi_at      TIMESTAMPTZ,
    guncellendi_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, gorev_id)
);

CREATE INDEX IF NOT EXISTS idx_sayim_gecmisi_zaman ON public.sayim_gecmisi (username, sayim_at);
CREATE INDEX IF NOT EXISTS idx_sayim_gecmisi_urun  ON public.sayim_gecmisi (username, product_id);

-- ---------------------------------------------------------------
-- 2) Herkese açık Döngü raporu
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dongu_paylasim (
    username       VARCHAR(50) PRIMARY KEY
                   REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    token          TEXT        NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{22,64}$'),
    baslik         TEXT        CHECK (baslik IS NULL OR char_length(baslik) <= 80),
    ozet           JSONB       NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(ozet) < 131072),
    olusturuldu_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    guncellendi_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sayim_gecmisi  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dongu_paylasim ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['sayim_gecmisi', 'dongu_paylasim'] LOOP
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

-- Ziyaretçinin tek kapısı: anahtarı bilen tek satırın özetini görür.
-- Kullanıcı adı, token ve diğer satırlar dönmez.
CREATE OR REPLACE FUNCTION public.dongu_rapor(anahtar text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'baslik', p.baslik,
        'ozet', p.ozet,
        'guncellendi_at', p.guncellendi_at
    )
    FROM public.dongu_paylasim p
    WHERE anahtar ~ '^[A-Za-z0-9_-]{22,64}$'
      AND p.token = anahtar
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.dongu_rapor(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dongu_rapor(text) TO web_anon, web_user, web_admin;

COMMIT;

-- PostgREST yeni tabloları ve işlevi hemen görsün
NOTIFY pgrst, 'reload schema';

-- Doğrulama: RLS açık, ziyaretçi tabloları okuyamıyor, yalnız işlevi çağırabiliyor
SELECT c.relname AS tablo,
       c.relrowsecurity AS rls,
       has_table_privilege('web_user', c.oid, 'INSERT') AS kullanici_yazabilir,
       has_table_privilege('web_anon', c.oid, 'SELECT') AS ziyaretci_okuyabilir
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('sayim_gecmisi', 'dongu_paylasim')
ORDER BY 1;

SELECT has_function_privilege('web_anon', 'public.dongu_rapor(text)', 'EXECUTE') AS ziyaretci_rapor_acabilir;
