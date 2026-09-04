-- Siparişlerde toplayıcı ve kurye fotoğrafı
-- ===========================================================================
-- Panel, sipariş nesnesinde kişi için fotoğraf adresi veriyorsa eklenti onu
-- da yolluyor (jet-barkod-asistan/sayfa-koprusu.js -> fotoBul). Alan adı
-- panelin sürümüne göre değişebildiği için eklenti bilinen adları sırayla
-- deniyor; hiçbiri yoksa boş kalıyor ve ekranda baş harfler görünüyor.
--
-- Adres saklanıyor, görselin kendisi değil. Kişi adı zaten `toplayici` ve
-- `kurye` alanlarında duruyordu; bu iki kolon onların yanına geliyor.
-- ===========================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS toplayici_foto text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kurye_foto text;

-- PostgREST şema önbelleği yenilenmezse yeni kolonlar 404 veriyor.
NOTIFY pgrst, 'reload schema';
