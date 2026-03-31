# Getir Warehouse Sipariş İçi Ürün Arama

Kontrol paneli siparişler sayfasında (`/dashboard/orders`) breadcrumb alanına ürün arama çubuğu ekler. Siparişleri tarayıp hangi siparişte hangi ürün olduğunu aramanızı sağlar.

## Kurulum

1. Chrome’da `chrome://extensions` açın.
2. **Geliştirici modu**nu açın.
3. **Paketlenmemiş öğe yükle** deyin.
4. Bu klasörü (`getir-warehouse-orders-search-extension`) seçin.

## Kullanım

1. warehouse.getir.com → **Kontrol Paneli** → **Siparişler** sayfasına gidin (URL’de `/r/{warehouseId}/dashboard/orders` olmalı).
2. Breadcrumb’ın yanında **arama çubuğu** ve **Ara** butonu görünür.
3. Arama kutusuna **ürün adı** (veya barkod) yazıp **Ara**’ya basın (veya Enter).
4. **API yolu (tercih):** URL’den warehouse id okunabiliyorsa eklenti önce liste API’sini, sonra her sipariş için detay API’sini çağırır (karta tıklamadan). İlerleme “Aranıyor (3/24)...” şeklinde güncellenir, sonunda eşleşen siparişler listelenir.
5. **Yedek (kart tıklama):** Warehouse id bulunamazsa veya API hatası olursa, sayfadaki sipariş kartlarına sırayla tıklanıp modal içeriğinden ürünler okunur.
6. Sonuç satırına tıklayınca ilgili sipariş kartına scroll edilir ve detay açılır.

## Notlar

- API adresleri: liste `...getirapi.com/warehouse/{id}/orders`, detay `.../orders/{orderId}?domainType=1`. İstekler sayfa bağlamında (credentials) atılır.
- Eklenti yalnızca `https://warehouse.getir.com/*` ve path’te `dashboard/orders` olan sayfada çalışır.
