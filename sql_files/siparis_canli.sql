-- =============================================================
-- Siparişler: cihazlar arası anlık tik
-- =============================================================
-- Bir depocu telefonda ürünü tiklediğinde, aynı siparişe bakan diğer
-- cihazlar bunu 1-2 saniye içinde görsün diye.
--
-- NASIL
-- Siparişler sayfası 1,5 saniyede bir yalnız sipariş başlıklarını
-- soruyor (birkaç yüz bayt). Başlıkta bir şey değiştiyse ürünleri çekiyor.
-- Tik ise ürün satırında (order_items.alindi) değişiyordu; başlıkta iz
-- bırakmadığı için hafif yoklama onu göremiyordu. Bu dosya siparişe
-- `son_isaret` damgası ekliyor ve bir ürün tiklenince/kaldırılınca bu
-- damgayı veritabanının kendisi basıyor (tetikleyici). Yazma ile damga
-- aynı işlemde: biri olup öbürü olmama ihtimali yok.
--
-- GÜVENLİ
-- Yalnız sütun, fonksiyon ve tetikleyici ekler; hiçbir satırı silmez.
-- Birden çok kez çalıştırılabilir. Bu dosya çalışmadan önce de sayfa
-- çalışıyor: damga yoksa daha sık tam çekime düşüyor.
--
-- Tetikleyici SECURITY DEFINER: ürün satırının güncellenmesi zaten RLS'ten
-- geçmiş oluyor; damga yalnız o satırın kendi siparişine basılıyor,
-- dışarıdan girdi almıyor.
-- =============================================================

BEGIN;

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

COMMIT;

-- PostgREST yeni sütunu hemen görsün
NOTIFY pgrst, 'reload schema';

-- Doğrulama: iki satır görünmeli
--   son_isaret | timestamp with time zone
--   order_items_isaret_damgasi
SELECT column_name AS ad, data_type AS tur
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'son_isaret'
UNION ALL
SELECT tgname, 'tetikleyici'
FROM pg_trigger
WHERE tgname = 'order_items_isaret_damgasi';
