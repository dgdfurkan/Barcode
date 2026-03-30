# Getir Warehouse HTML Kopyalayıcı

warehouse.getir.com sayfasında ürün listelerine 📋 butonları ekleyen Chrome eklentisi. Sayfa yenilense bile otomatik çalışır.

## Kurulum

1. ZIP dosyasını indirin
2. ZIP'i açın
3. Chrome'da `chrome://extensions` adresine gidin
4. "Geliştirici modu"nu açın
5. "Paketlenmemiş öğe yükle" → Açılan ZIP'teki `getir-warehouse-html-copy-extension` klasörünü seçin

## Kullanım

1. warehouse.getir.com sitesine gidin
2. Ürün listesini görüntüleyin
3. Her ürünün yanında 📋 butonu otomatik görünür
4. Tek ürün: 📋 butonuna tıklayın
5. Tüm ürünler: "📋 Tümünü Kopyala" butonuna tıklayın
6. HTML panoya kopyalanır

## Sayım listesi (kontrol paneli)

Sayım ekranında ürün + barkod içeren Ant tablo göründüğünde, sipariş sayfasındaki ile aynı **«📋 Tümünü Kopyala»** butonu (`getir-copy-all-btn`) tablonun hemen üstünde çıkar — çoğu ekranda tablo `ant-row` içinde olmadığı için buton **`ant-table-wrapper`** satırının üstüne eklenir.

**Not:** Eklenti güncelledikten sonra `chrome://extensions` → bu eklenti → **Yenile** (↻) ile yeniden yükleyin.

- Panoya `BARCODE_SAYIM_V1` + JSON yazılır (ürün sayısı güne göre değişir).
- Barcode sayfasında **Sayım** sekmesi → **Günlük Sayım** → **Panodan İçe Aktar** → yapıştır → **Tabloya Ekle**.
- O günün günlük tablosu açılır ve barkod/isim eşleşen tüm ürünler eklenir.

## Ayarlar

Eklenti ikonuna tıklayarak "Kopyalama sonrası Barcode sitesine yönlendir" seçeneğini açabilirsiniz.
