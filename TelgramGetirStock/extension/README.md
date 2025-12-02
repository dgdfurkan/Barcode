# Getir Stock Bot Chrome Extension

Bu extension, Getir franchise sitesinde açık olan hesabınızdan token'ı otomatik olarak alıp Python bot'a gönderir.

## Kurulum

### 1. Chrome'da Extension'ı Yükleyin

1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üstteki "Geliştirici modu"nu açın
3. "Paketlenmemiş uzantı yükle" butonuna tıklayın
4. `TelgramGetirStock/extension` klasörünü seçin

### 2. Extension'ı Aktif Edin

1. Extension yüklendikten sonra aktif olduğundan emin olun
2. Getir sitesine gidin: `https://franchise.getir.com/login`
3. Giriş yapın
4. Extension otomatik olarak token'ı alıp bot'a gönderecek

### 3. Bot'u Çalıştırın

Bot çalıştığında extension otomatik olarak token'ı gönderecektir.

## Kullanım

- Extension simgesine tıklayarak durumu kontrol edebilirsiniz
- Token otomatik olarak güncellenir (her 30 saniyede bir kontrol)
- Bot çalışmıyorsa extension hata vermez (normal)

## Notlar

- Bot'un çalışması gerekiyor (localhost:8765 portunda HTTP server)
- Getir sitesi açıkken extension çalışır
- Token expire olunca extension yeni token'ı otomatik gönderir

