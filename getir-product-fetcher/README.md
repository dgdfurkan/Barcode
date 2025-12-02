# Getir Product Fetcher Extension

Telegram bot entegrasyonu olmayan, sadece Getir API'den ürün çekmeye odaklı Chrome extension.

## ÖNEMLİ: Service Worker Durumu

**Service worker'ın "Etkin değil" görünmesi NORMAL'dir!**

Manifest v3'te service worker'lar sadece gerektiğinde çalışır:
- Mesaj geldiğinde otomatik uyanır
- İşlem tamamlandıktan sonra uykuya dalabilir
- Bu Chrome'un normal davranışıdır

**Önemli olan:** Extension çalışıyor mu? Evet! Mesaj geldiğinde service worker uyanır ve işlemi yapar.

## Kurulum

1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üstteki "Geliştirici modu"nu açın
3. "Paketlenmemiş uzantı yükle" butonuna tıklayın
4. `getir-product-fetcher` klasörünü seçin
5. Extension yüklendi!

## Kullanım

1. Getir franchise sitesine giriş yapın: https://franchise.getir.com
2. Admin paneli açın: http://localhost:8080/admin.html (veya kendi portunuz)
3. "Ürün İçe Aktarma" sekmesine gidin
4. "Getir API'den Tüm Ürünleri Çek" butonuna tıklayın
5. İlerleme mesajlarını takip edin

## Service Worker Test

Service worker'ın çalışıp çalışmadığını test etmek için:

1. Extension detaylarında "service worker" linkine tıklayın
2. Console'da şu mesajları görmelisiniz:
   - `🚀 Getir Product Fetcher - Background service worker başlatıldı!`
   - `✅ Service worker aktif ve çalışıyor!`
3. Admin panelden butona tıklayın
4. Console'da mesaj alındığını görmelisiniz:
   - `📥 Background script'e mesaj alındı: EXPORT_ALL_PRODUCTS`

## Sorun Giderme

**Service worker "Etkin değil" görünüyor:**
- Bu NORMAL'dir! Service worker sadece gerektiğinde çalışır
- Butona tıkladığınızda otomatik uyanır
- İşlem çalışıyorsa sorun yok

**Extension çalışmıyor:**
1. Extension'ı kaldırıp yeniden yükleyin
2. Chrome'u yeniden başlatın
3. Admin paneli yenileyin
4. Getir sitesinin açık olduğundan emin olun

## Dosya Yapısı

```
getir-product-fetcher/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (ürün çekme işlevi)
├── admin_panel_inject.js  # Admin panel ile iletişim
├── content.js             # Getir sitesinde token yakalama
└── README.md              # Bu dosya
```

## Notlar

- Extension sadece Getir franchise sitesinde token yakalar
- Token'lar sadece extension içinde kullanılır (bot'a gönderilmez)
- Service worker mesaj geldiğinde otomatik uyanır
- Admin panel ile iletişim `window.postMessage` ve `chrome.runtime.sendMessage` üzerinden yapılır
