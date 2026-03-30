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

Sayım ekranında **Ürün Adı** ve **Ürün Barkodları** sütunlu Ant tablo göründüğünde, tablonun üstünde **«Sayım Listesini Kopyala»** butonu çıkar.

- Panoya `BARCODE_SAYIM_V1` + JSON yazılır (ürün sayısı güne göre değişir).
- Barcode sayfasında **Sayım** sekmesi → **Günlük Sayım** → **Panodan İçe Aktar** → yapıştır → **Tabloya Ekle**.
- O günün günlük tablosu açılır ve barkod/isim eşleşen tüm ürünler eklenir.

## Ayarlar

Eklenti ikonuna tıklayarak "Kopyalama sonrası Barcode sitesine yönlendir" seçeneğini açabilirsiniz.
