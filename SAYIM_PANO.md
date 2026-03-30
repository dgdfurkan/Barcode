# Sayım panosu ↔ site köprüsü

## Akış

1. **Depo paneli** (`warehouse.getir.com`): Sayım tablosunda **Sayım Listesini Kopyala** → pano.
2. **Barcode sayım sayfası**: **Günlük Sayım** → **Panodan İçe Aktar** → yapıştır → **Tabloya Ekle**.

Her gün için veri değişir; sabit ürün listesi kodda yoktur.

## Pano formatı (satır 1)

`BARCODE_SAYIM_V1`  
Sonrasında tek bir JSON nesnesi: `{ "version": 1, "items": [ { "name", "barcode", "barcodes?" }, ... ] }`

Eski / alternatif: Aynı yapıdaki tablonun **HTML**’i yapıştırılırsa da satırlar çözülür.

## Örnek HTML

` sayim.md ` dosyasındaki gibi uzun HTML örnekleri yalnızca referans içindir; içe aktarma çalışma zamanında panodan gelen metne göre yapılır.
