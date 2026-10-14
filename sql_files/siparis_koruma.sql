-- =============================================================
-- Siparişler: canlı siparişin yanlışlıkla silinmesine karşı koruma
-- =============================================================
-- Çalıştırma (VPS):  sudo -u postgres psql -d jetbarkod < siparis_koruma.sql
--
-- SORUN
-- Aynı hesapla birden çok bilgisayarda depo paneli açık olabiliyor. Bir
-- bilgisayarın paneli eski, donmuş ya da Asistan'ı eski sürümse, kendi
-- panelinde görmediği siparişi veritabanından siliyordu. Ürün satırları
-- siparişle birlikte gidiyor (ON DELETE CASCADE), yani o siparişin bütün
-- tikleri de gidiyordu. Diğer bilgisayar siparişi az sonra yeniden yazınca
-- sipariş tiksiz geri geliyordu: "tikler gitti geldi".
--
-- KORUMA
-- Son 2 dakikada dokunulmuş sipariş silinmez. Panelini gören her Asistan
-- siparişe dakikada bir dokunuyor (updated_at), yani hâlâ bir panelde duran
-- sipariş hiçbir cihazdan silinemez. Gerçekten bitmiş sipariş kimse
-- dokunmadığı için 2 dakika sonra normal şekilde silinir.
--
-- Silme engellendiğinde hata dönmez; satır yalnız silinmez. Eski Asistan
-- sürümleri de böylece zarar veremez.
--
-- GÜVENLİ: Yalnız işlev ve tetikleyici ekler. Birden çok kez çalıştırılabilir.
-- =============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.orders_canli_silme_koruma()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.updated_at IS NOT NULL AND OLD.updated_at > now() - interval '2 minutes' THEN
        RETURN NULL;   -- bu satır silinmez, işlemin geri kalanı sürer
    END IF;
    RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS orders_canli_silme_koruma ON public.orders;
CREATE TRIGGER orders_canli_silme_koruma
    BEFORE DELETE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.orders_canli_silme_koruma();

COMMIT;

-- Doğrulama: tek satır görünmeli
SELECT tgname AS tetikleyici FROM pg_trigger WHERE tgname = 'orders_canli_silme_koruma';
