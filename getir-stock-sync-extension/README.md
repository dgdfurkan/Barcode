# Getir Stok Senkronizasyonu Extension

Bu Chrome extension, Getir franchise stok sayfasından stok verilerini senkronize eder. Extension, her kullanıcının kendi API endpoint'lerini ve token'larını yakalayıp, counting.html sayfasına bildirir.

## Nasıl Çalışır?

1. **API Bilgilerini Yakalama**: Extension, Getir franchise sayfasına girildiğinde:
   - Network isteklerini dinler (`fetch` ve `XMLHttpRequest`)
   - API endpoint'lerini yakalar
   - Authentication token'larını kaydeder
   - Bu bilgileri `localStorage`'a yazar (`getir_api_info`)

2. **API Çağrısı**: Counting.html sayfası:
   - Extension'ın yakaladığı API bilgilerini okur
   - Extension üzerinden API çağrısı yapar (CORS sorunu olmadan)
   - Stok değerlerini alır ve gösterir

3. **Fallback**: Eğer API bilgileri bulunamazsa:
   - Extension, sayfa üzerinden manuel arama yapar (eski yöntem)

## Kurulum

1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üstteki "Geliştirici modu"nu açın
3. "Paketlenmemiş uzantı yükle" butonuna tıklayın
4. Bu klasörü seçin
5. Extension yüklenecektir

## Kullanım

### İlk Kurulum

1. **Getir franchise sayfasını açın**: `https://franchise.getir.com/stock/current`
2. Extension otomatik olarak API bilgilerini yakalayacaktır
3. Console'u açın (F12) ve şu log'ları göreceksiniz:
   - `🌐 API çağrısı yakalandı:` - Gerçek API endpoint'i
   - `🔑 Token yakalandı` - Authentication token
   - `📦 Stock endpoint kaydedildi` - Stok endpoint'i
   - `📤 API bilgileri kaydedildi` - Bilgiler localStorage'a yazıldı

### Stok Senkronizasyonu

1. Counting sayfasından stok senkronizasyonu yapabilirsiniz
2. Extension, yakaladığı API bilgilerini kullanarak direkt API çağrısı yapacaktır
3. Daha hızlı ve güvenilir çalışır

## Özellikler

- ✅ Her kullanıcının kendi API endpoint'lerini yakalar
- ✅ Authentication token'larını otomatik kaydeder
- ✅ CORS sorunu olmadan API çağrısı yapar (extension aynı origin'de)
- ✅ Fallback mekanizması (API bulunamazsa sayfa üzerinden arama)
- ✅ Gerçek zamanlı stok senkronizasyonu
- ✅ Periyodik API bilgisi güncelleme (her 5 saniyede bir)

## Dosya Yapısı

```
getir-stock-sync-extension/
├── manifest.json      # Extension yapılandırması
├── content.js         # Ana script (Getir sayfasında çalışır)
├── background.js      # Background script (API dinleme)
└── README.md          # Bu dosya
```

## Sorun Giderme

### API bilgileri yakalanmıyor
- Getir franchise sayfasının açık olduğundan emin olun
- Sayfada bir ürün arayın (manuel olarak) - bu API çağrısını tetikler
- Console'da API log'larını kontrol edin

### Stok değeri alınamıyor
- API bilgilerinin yakalandığını kontrol edin (`localStorage.getItem('getir_api_info')`)
- Extension'ın aktif olduğundan emin olun
- Browser console'da hata mesajlarını kontrol edin

## Notlar

- Extension sadece Getir franchise sayfasında çalışır
- Her kullanıcının kendi deposu ve API endpoint'leri vardır
- API bilgileri otomatik olarak yakalanır ve güncellenir
- Extension, CORS sorunu olmadan API çağrısı yapabilir (aynı origin'de çalışır)
