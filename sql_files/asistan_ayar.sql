-- =============================================================
-- Asistan ayarları hesapta (Hızlı Bul kategorileri ve benzerleri)
-- =============================================================
-- Çalıştırma (Mac'te, Barcode klasöründe):
--   ssh root@198.55.109.160 "sudo -u postgres psql -d jetbarkod" < sql_files/asistan_ayar.sql
--
-- asistan_ayar
--   Kullanıcı başına anahtar → JSON değer. Jet Barkod Asistan, Getir panelinin
--   tarayıcı belleğinde duran ayarları (Hızlı Bul dahil/hariç kelimeleri) burada
--   da saklar; panel belleği silinse ya da Asistan yeniden kurulsa da geri gelir.
--
-- GÜVENLİK: counting_items ile aynı kural. Tarayıcı yalnız kendi satırlarını
-- görür ve yazar (RLS, kullanıcı adı imzalı jetondan).
--
-- GÜVENLİ: Yalnız yeni tablo ekler. Birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.asistan_ayar (
    username        VARCHAR(50) NOT NULL
                    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
    anahtar         TEXT        NOT NULL CHECK (anahtar ~ '^[a-zA-Z0-9_-]{1,60}$'),
    veri            JSONB       NOT NULL CHECK (pg_column_size(veri) < 65536),
    guncellendi_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (username, anahtar)
);

ALTER TABLE public.asistan_ayar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asistan_ayar_self ON public.asistan_ayar;
CREATE POLICY asistan_ayar_self ON public.asistan_ayar
    FOR ALL TO web_user
    USING (username = public.auth_username())
    WITH CHECK (username = public.auth_username());

DROP POLICY IF EXISTS asistan_ayar_admin ON public.asistan_ayar;
CREATE POLICY asistan_ayar_admin ON public.asistan_ayar
    FOR ALL TO web_admin
    USING (public.auth_is_admin())
    WITH CHECK (public.auth_is_admin());

REVOKE ALL ON public.asistan_ayar FROM PUBLIC, web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asistan_ayar TO web_user, web_admin;

COMMIT;

-- PostgREST yeni tabloyu hemen görsün
NOTIFY pgrst, 'reload schema';

-- Doğrulama: RLS açık, giriş yapmamış ziyaretçiye yetki yok
SELECT c.relname AS tablo,
       c.relrowsecurity AS rls,
       has_table_privilege('web_user', c.oid, 'INSERT') AS kullanici_yazabilir,
       has_table_privilege('web_anon', c.oid, 'SELECT') AS ziyaretci_okuyabilir
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'asistan_ayar';
