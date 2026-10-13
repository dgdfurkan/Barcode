-- =============================================================
-- Siparişler ve sayım: anlık eşitleme, paket, teslimat bilgisi
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < siparis_canli_v2.sql
--
-- 1) Tik damgası (siparis_canli.sql'in aynısı; o dosya çalışmadıysa bu yeter)
--    Ürün tiklenince siparişin `son_isaret` damgasını veritabanı basıyor.
--
-- 2) Paket ve teslimat bilgisi
--    paketlendi_at  Sipariş poşetlenip paketlendiğinde zamanı, geri alınınca NULL.
--    adres, adres_tarifi, musteri_notu
--                   Depo panelinin sipariş detayından. Müşteri adı ve telefonu
--                   alınmıyor. Satırlar RLS ile yalnız hesabın kendisine açık.
--
-- 3) Canlı bildirim
--    orders, order_items, counting_items ve users.counting_data değişince
--    veritabanı `jb_canli` kanalına kısa bir haber atıyor: kullanıcı adı,
--    tablo adı, sipariş ya da sayım tablosu kimliği. Veri taşımıyor.
--    API (vps-api/canli.js) bu haberi bekleyen cihazlara anında iletiyor;
--    cihaz değişeni kendi yetkisiyle çekiyor. Gecikme yoklama aralığı değil,
--    ağ gidiş-dönüşü kadar.
--
-- GÜVENLİ: Yalnız sütun, işlev ve tetikleyici ekler; hiçbir satırı silmez.
-- Birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1) Tik damgası
-- ---------------------------------------------------------------
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS son_isaret TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.order_items_isaret_damgasi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.alindi IS DISTINCT FROM OLD.alindi THEN
        UPDATE public.orders SET son_isaret = now() WHERE id = NEW.order_uuid;
    END IF;
    RETURN NEW;
END
$$;

GRANT EXECUTE ON FUNCTION public.order_items_isaret_damgasi() TO web_user, web_admin;

DROP TRIGGER IF EXISTS order_items_isaret_damgasi ON public.order_items;
CREATE TRIGGER order_items_isaret_damgasi
    AFTER UPDATE OF alindi ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.order_items_isaret_damgasi();

-- ---------------------------------------------------------------
-- 2) Paket ve teslimat bilgisi
-- ---------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paketlendi_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS adres TEXT
    CHECK (adres IS NULL OR char_length(adres) <= 500);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS adres_tarifi TEXT
    CHECK (adres_tarifi IS NULL OR char_length(adres_tarifi) <= 500);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS musteri_notu TEXT
    CHECK (musteri_notu IS NULL OR char_length(musteri_notu) <= 500);

-- ---------------------------------------------------------------
-- 3) Canlı bildirim
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jb_canli_bildir()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    kim  text;
    ek   text;
BEGIN
    IF TG_TABLE_NAME = 'orders' THEN
        kim := COALESCE(NEW.username, OLD.username);
        ek  := COALESCE(NEW.order_id, OLD.order_id);
    ELSIF TG_TABLE_NAME = 'order_items' THEN
        SELECT o.username, o.order_id INTO kim, ek
        FROM public.orders o
        WHERE o.id = COALESCE(NEW.order_uuid, OLD.order_uuid);
    ELSIF TG_TABLE_NAME = 'counting_items' THEN
        kim := COALESCE(NEW.username, OLD.username);
        ek  := COALESCE(NEW.table_name, OLD.table_name);
    ELSIF TG_TABLE_NAME = 'users' THEN
        kim := NEW.username;
    END IF;

    IF kim IS NOT NULL THEN
        -- Aynı işlemde aynı haber bir kez gider (PostgreSQL tekrarı birleştirir)
        PERFORM pg_notify('jb_canli', json_build_object(
            't', TG_TABLE_NAME, 'u', kim, 'k', left(ek, 120)
        )::text);
    END IF;
    RETURN NULL;
END
$$;

REVOKE ALL ON FUNCTION public.jb_canli_bildir() FROM PUBLIC;

DROP TRIGGER IF EXISTS jb_canli ON public.orders;
CREATE TRIGGER jb_canli AFTER INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.jb_canli_bildir();

DROP TRIGGER IF EXISTS jb_canli ON public.order_items;
CREATE TRIGGER jb_canli AFTER INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.jb_canli_bildir();

DROP TRIGGER IF EXISTS jb_canli ON public.counting_items;
CREATE TRIGGER jb_canli AFTER INSERT OR UPDATE OR DELETE ON public.counting_items
    FOR EACH ROW EXECUTE FUNCTION public.jb_canli_bildir();

DROP TRIGGER IF EXISTS jb_canli ON public.users;
CREATE TRIGGER jb_canli AFTER UPDATE OF counting_data ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.jb_canli_bildir();

COMMIT;

-- PostgREST yeni sütunları hemen görsün
NOTIFY pgrst, 'reload schema';

-- Doğrulama: 4 sütun ve 5 tetikleyici görünmeli
SELECT column_name AS ad, 'sütun' AS tur
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
  AND column_name IN ('son_isaret', 'paketlendi_at', 'adres', 'adres_tarifi', 'musteri_notu')
UNION ALL
SELECT tgrelid::regclass::text || '.' || tgname, 'tetikleyici'
FROM pg_trigger
WHERE tgname IN ('jb_canli', 'order_items_isaret_damgasi')
ORDER BY 2, 1;
