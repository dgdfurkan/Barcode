-- =============================================================
-- Depo Görevleri (Yardımcılar > Görevler)
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < depo_gorev.sql
--
-- depo_gorev
--   Hesabın görev listesi: ad, grup, sıklık (kaç günde bir) ve sırayla
--   yapılan işler için öğeler (donuk dolaplar gibi: her gün biri).
--
-- depo_gorev_gun
--   Bir görevin bir iş günündeki durumu. İş günü 08:00'de başlar.
--   oge = '' görevin kendisi; sırayla yapılan işte öğe adı.
--   yapildi: tiklendi · eklendi: o güne elle eklendi · ertelendi: o günden çıkarıldı.
--   Satır bazlı: iki cihaz aynı anda tiklese de birbirini ezmez.
--
-- GÜVENLİK: counting_items ile aynı kural. Tarayıcı yalnız kendi satırlarını
-- görür ve yazar (RLS, kullanıcı adı imzalı jetondan).
--
-- GÜVENLİ: Yalnız yeni tablo ekler. Birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.depo_gorev (
    username        VARCHAR(50) NOT NULL
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    id              UUID        NOT NULL,
    ad              TEXT        NOT NULL CHECK (char_length(ad) BETWEEN 1 AND 120),
    grup            TEXT        NOT NULL DEFAULT 'diger' CHECK (char_length(grup) BETWEEN 1 AND 40),
    siklik          SMALLINT    NOT NULL DEFAULT 1 CHECK (siklik BETWEEN 1 AND 60),
    ogeler          JSONB       NOT NULL DEFAULT '[]'::jsonb
                    CHECK (jsonb_typeof(ogeler) = 'array' AND pg_column_size(ogeler) < 8192),
    sirali          BOOLEAN     NOT NULL DEFAULT false,
    sira            INTEGER     NOT NULL DEFAULT 0,
    olusturuldu_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    guncellendi_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, id)
);

CREATE TABLE IF NOT EXISTS public.depo_gorev_gun (
    username        VARCHAR(50) NOT NULL,
    gorev_id        UUID        NOT NULL,
    gun             DATE        NOT NULL,
    oge             TEXT        NOT NULL DEFAULT '' CHECK (char_length(oge) <= 80),
    yapildi         BOOLEAN     NOT NULL DEFAULT false,
    eklendi         BOOLEAN     NOT NULL DEFAULT false,
    ertelendi       BOOLEAN     NOT NULL DEFAULT false,
    zaman           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, gorev_id, gun, oge),
    FOREIGN KEY (username, gorev_id) REFERENCES public.depo_gorev (username, id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_depo_gorev_gun_tarih ON public.depo_gorev_gun (username, gun DESC);

ALTER TABLE public.depo_gorev ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depo_gorev_gun ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['depo_gorev', 'depo_gorev_gun'] LOOP
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
WHERE n.nspname = 'public' AND c.relname IN ('depo_gorev', 'depo_gorev_gun')
ORDER BY 1;
