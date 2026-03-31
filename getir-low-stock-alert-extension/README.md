# Getir Düşük Stok Uyarısı

Stok hareketleri API'sine göre eşiğin altına düşen ürünlerde sesli/görsel bildirim ve barkod sitesinde "Stoğu düşük ürünler" listesi.

## Kurulum

1. Chrome'da `chrome://extensions` → Geliştirici modu → "Paketlenmemiş öğe yükle" → bu klasörü seçin.
2. **İkon:** `getir-stock-sync-extension` klasöründeki `icon128.png` dosyasını bu klasöre kopyalayın (veya kendi ikonunuzu `icon128.png` adıyla ekleyin).
3. **Ses (isteğe bağlı):** Bildirim sesi için kısa bir MP3 dosyasını `notification.mp3` adıyla bu klasöre ekleyin. Yoksa sadece görsel bildirim çalışır.

## Kullanım

- Admin, kullanıcıya "Düşük Stok Uyarısı" premium özelliğini açar.
- Kullanıcı barkod sitesinde **Stoğu düşük ürünler** sayfasına gider; özelliği açar, varsayılan eşiği ve isteğe bağlı ürün bazlı eşikleri ayarlar.
- **Getir franchise** sayfası (`https://franchise.getir.com/...`) en az bir kez açık olmalı ki eklenti token'ı yakalasın. Sonrasında **mesai saatleri (08:00–01:00)** içinde yaklaşık her 1 dakikada stok hareketleri API'si franchise sekmesinden çağrılır (en fazla 3 sayfa, 300 hareket). Barkod sayfası kapalı olsa da liste güncellenir; Stoğu düşük sayfasına girince son liste görünür.
- Eşiğin altına düşen ürünler listelenir; her yeni düşüşte veya sayı değişiminde bildirim (ve isteğe bağlı ses) verilir.
- "Tamam, kontrol ettim" ile ürün listeden çıkar; tekrar eşiğin altına düşerse yeniden uyarı verilir.

## Gereksinimler

- Barkod sitesinde giriş yapılmış olmalı; premium özellik kullanıcıya açık olmalı.
- **Token:** İstekler token'sız atılmıyor. Eklenti Bearer token'ı franchise.getir.com sekmesinde, sayfanın kendi yaptığı API isteklerini izleyerek (fetch override) alır. Stok hareketi isteği de aynı franchise sekmesinde bu token ile yapılır. Yani franchise sekmesi en az bir kez açık olmalı ki token yakalansın; sonrasında mesai saatleri içinde otomatik poll çalışır.
- **Mesai saatleri:** Otomatik poll sadece **08:00 – 01:00** arasında çalışır. Bu saat dışında alarm tetiklense bile istek atılmaz. Barkod sayfası açık olmasa da eklenti (franchise sekmesi açıksa) mesai içinde listeyi günceller; Stoğu düşük sayfasına girince güncel liste görünür.
