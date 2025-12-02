# Getir Warehouse Shelf Label Fetcher Extension

Warehouse.getir.com sitesinden raf etiketlerini çeken Chrome extension.

## Kurulum

1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üstteki "Geliştirici modu" toggle'ını açın
3. "Paketlenmemiş uzantı yükle" butonuna tıklayın
4. `getir-warehouse-shelf-label-fetcher` klasörünü seçin
5. Extension yüklenecektir

## Kullanım

1. Warehouse.getir.com sitesinde raf etiketleri sayfasını açın:
   - `https://warehouse.getir.com/r/5dcafe6ae2c61b1e52cf1704/stock/stock-management/shelf-label/list?limit=100&offset=1`
2. Admin panelde "Ürün İçe Aktarma" sekmesine gidin
3. "Warehouse Raf Etiketleri" bölümünde "Raf Etiketlerini Çek" butonuna tıklayın
4. Extension otomatik olarak tabloyu parse edecek ve JSON dosyası olarak indirebileceksiniz

## Özellikler

- `ant-table-container` içindeki tablo verilerini otomatik parse eder
- Tüm sayfaları tarar (pagination desteği)
- JSON formatında indirme
- İlerleme mesajları gösterir

## Notlar

- Extension çalışması için warehouse.getir.com sitesinin açık olması gerekir
- Tablo yapısı değişirse extension güncellenmelidir

