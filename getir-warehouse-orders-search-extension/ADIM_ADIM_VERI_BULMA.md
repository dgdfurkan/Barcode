# Tıklamadan Sipariş İçeriğine Erişim – Adım Adım

Kartlara tıklamadan ürün listesine ulaşmak için verinin **nereden** geldiğini bulmalıyız. Aşağıdaki adımları sırayla dene.

---

## Adım 1: Sayfa açılırken hangi istek atılıyor?

1. warehouse.getir.com → Kontrol Paneli → Siparişler sayfasına git.
2. **F12** → **Network** sekmesi.
3. **XHR** veya **Fetch** filtresini aç (veya "All" bırak).
4. Sayfayı **yenile** (F5). **Hiçbir sipariş kartına tıklama.**
5. Listede çıkan istekleri incele. Özellikle URL’de şunlar geçenleri not et:
   - `order` / `orders`
   - `dashboard`
   - `list` / `listOrders`
   - `warehouse`
6. Bu isteklerden birine tıkla → **Response** / **Preview** sekmesine bak.
   - Cevap bir **dizi** (array) sipariş mi?
   - Her siparişin içinde **ürün listesi** (items, products, lineItems vb.) var mı?

**Buldun mu?**  
- **Evet, içinde ürün listesi var:** Bu API’yi extension’da tek seferde çağırıp tüm siparişleri alabiliriz (Adım 4).  
- **Hayır, sadece sipariş özeti (id, müşteri, durum):** O zaman sipariş detayı ayrı bir API’den geliyordur; Adım 2’ye geç.

---

## Adım 2: Bir karta tıklayınca hangi istek atılıyor?

1. Network sekmesi açık kalsın.
2. **Tek bir sipariş kartına** tıkla (modal açılsın).
3. Yeni çıkan isteklere bak. Genelde **tek bir** “detay” isteği olur (URL’de `order`, `detail`, `getOrder` vb. geçer).
4. Bu isteği seç → **Headers** kısmında **Request URL**’i kopyala. Örnek:
   - `https://warehouse.getir.com/api/v2/orders/69a04cd27dc15184d9decd09`
   - veya `.../order/detail?id=...`
5. **Response** / **Preview**’e bak: Sipariş detayı ve ürün listesi burada mı?

**Sonuç:**  
- Detay isteği = “Bir siparişin ürünlerini veren” API.  
- Bu API’yi kullanmak için her sipariş için bir **sipariş ID**’si lazım. ID bazen URL’nin sonundaki kısım (örn. `69a04cd27dc15184d9decd09`).

---

## Adım 3: Karttaki elementte ID veya veri var mı?

1. Sayfada bir sipariş **kartına** sağ tıkla → **İncele** (Inspect).
2. `<div class="orderCard--LDG_w" data-testid="550" ...>` gibi bir element seçili olacak.
3. Bu div’in **tüm attribute’larını** kontrol et:
   - `data-testid="550"` → muhtemelen kısa kod.
   - `data-order-id`, `data-id`, `data-orderid`, `data-cursor-element-id` vb. var mı?
4. Aynı kartın **parent** veya **child** elementlerinde (ör. `orderCardWrapper--auMdk`) ek `data-*` attribute’ları var mı bak.

**Önemli:**  
- Eğer kartta veya yakınında **tam sipariş ID**’si (detay API’de kullanılan) varsa, extension’da tıklamadan `fetch(detailApiUrl + orderId)` ile her siparişin detayını çekebiliriz.  
- Sadece `data-testid="550"` varsa, “550” ile tam ID eşleşmesi Adım 1’deki liste API cevabında olabilir (orada `shortCode: "550"` ve `id: "69a04cd27dc15184d9decd09"` gibi).

---

## Adım 4: Liste API’si ürünleri de veriyorsa (en rahat senaryo)

- Adım 1’de bulduğun istek, sipariş listesini **ve** her siparişin ürünlerini veriyorsa:
  - Extension’da sadece bu API’yi **bir kez** çağırıyoruz (sayfa açıldığında veya “Ara”ya basıldığında).
  - Gelen JSON’da arama yapıyoruz; hiç kart tıklamıyoruz.
  - Bunun için bana şunları yazman yeterli:
    - İsteğin **tam URL**’i (sorgu parametreleriyle).
    - Response’un kısa bir örneği veya yapısı (örn. `{ data: { orders: [ { id, items: [...] } ] } }`).

---

## Adım 5: Sadece detay API varsa (karta tıklayınca çıkan)

- Her sipariş için ayrı detay isteği atmamız gerekiyor.
- Bunun için **her kart için bir sipariş ID**’si lazım. Bu ID:
  - Ya kartta/attributelarda (Adım 3),  
  - Ya da liste API’sinin cevabında (Adım 1) – orada `id` + `shortCode` veya `data-testid` ile eşleşen bir alan olabilir.
- Bana şunları yaz:
  - Detay isteğinin **tam URL şablonu** (örn. `.../orders/{{ORDER_ID}}`).
  - Liste cevabında veya DOM’da sipariş ID’sini nereden aldığın (alan adı veya selector).

---

## Özet

| Durum | Ne yapacağız? |
|-------|----------------|
| Liste API’si ürünleri de veriyor | O API’yi extension’da çağırıp tek seferde tüm veriyi alıyoruz. |
| Sadece detay API var + ID’yi biliyoruz | Her sipariş ID’si için detay API’yi extension’dan `fetch` ile çağırıyoruz (modal açmadan). |
| ID’yi bulamıyoruz | Karttaki `data-testid` ile liste cevabındaki bir alanı eşleştirip ID’yi oradan çıkarırız. |

Bu adımları uyguladıktan sonra bulduğun **URL’leri** ve **response yapısını** (mümkünse bir örnek JSON veya “orders array’i şu path’te” gibi) yazarsan, bir sonraki adımda extension’ı buna göre net şekilde güncelleyebilirim.
