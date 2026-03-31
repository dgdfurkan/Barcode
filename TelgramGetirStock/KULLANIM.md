# 📖 Getir Stock Bot - Kullanım Kılavuzu

## 🚀 Hızlı Başlangıç

### Adım 1: Bot'u Başlatın

Terminal'de proje klasörüne gidin ve bot'u çalıştırın:

```bash
cd /path/to/TelgramGetirStock
source venv/bin/activate
python main.py
```

Bot başladığında şu mesajları göreceksiniz:
```
✅ Session yüklendi
✅ Token update server başlatıldı: http://localhost:8765
✅ Bot başlatılıyor...
✅ Application started
```

**Önemli:** Bot'u çalışır durumda bırakın (terminal açık kalmalı).

---

### Adım 2: Browser Extension'ı Kurun

#### 2.1 Chrome'da Extension Sayfasını Açın

1. Chrome tarayıcınızı açın
2. Adres çubuğuna şunu yazın: `chrome://extensions/`
3. Enter'a basın

#### 2.2 Geliştirici Modunu Açın

1. Sağ üst köşede **"Geliştirici modu"** (Developer mode) toggle'ını bulun
2. Açık konuma getirin (mavi olmalı)

#### 2.3 Extension'ı Yükleyin

1. Sol üstte **"Paketlenmemiş uzantı yükle"** (Load unpacked) butonuna tıklayın
2. Finder penceresi açılacak
3. Şu klasöre gidin: `<path/to/TelgramGetirStock>/extension`
4. Klasörü seçin ve **"Seç"** (Select) butonuna tıklayın

#### 2.4 Extension'ı Aktif Edin

1. Extension yüklendikten sonra listede görünecek
2. Sağdaki toggle'ın **açık** (mavi) olduğundan emin olun
3. Extension simgesi Chrome toolbar'ında görünecek

---

### Adım 3: Getir Sitesine Giriş Yapın

1. Chrome'da şu adrese gidin: `https://franchise.getir.com/login`
2. Getir kullanıcı adı ve şifrenizle giriş yapın
3. Extension otomatik olarak token'ı algılayacak ve bot'a gönderecek

**Kontrol:** Extension simgesine tıklayın, "✅ Bot çalışıyor" mesajını görmelisiniz.

---

### Adım 4: Telegram'da Bot'u Kullanın

#### 4.1 Bot'u Başlatın

1. Telegram'ı açın
2. Bot'unuzu bulun (BotFather'dan aldığınız bot)
3. `/start` komutunu gönderin

Bot şu mesajı gönderecek:
```
👋 Merhaba! Getir Stock Bot'a hoş geldiniz.

🔍 Ürün aramak için:
• Ürün adı yazın (örn: Coca Cola)
• Barkod yazın (örn: 000000000001013727)
• /search komutu kullanın

📋 Komutlar:
/start - Bot'u başlat
/help - Yardım
/search <ürün> - Ürün ara
/refresh - Cache'i yenile
```

#### 4.2 Ürün Arayın

**Yöntem 1: Direkt Mesaj**
```
Coca Cola
```

**Yöntem 2: Komut ile**
```
/search Coca Cola
```

**Yöntem 3: Barkod ile**
```
000000000001013727
```

---

## 📱 Kullanım Örnekleri

### Örnek 1: Ürün Adı ile Arama

**Siz:** `Coca Cola`

**Bot:**
```
🔍 Arama yapılıyor: Coca Cola
⏳ Lütfen bekleyin...

✅ Sonuç bulundu:

📦 Coca Cola (330ml)
   Stok: 150 adet
   Rezerve: 0 adet
   Barkod: 000000000001013727
```

### Örnek 2: Barkod ile Arama

**Siz:** `000000000001013727`

**Bot:**
```
🔍 Barkod aranıyor: 000000000001013727

✅ Sonuç bulundu:
📦 Coca Cola (330ml)
   Stok: 150 adet
   ...
```

### Örnek 3: Sonuç Bulunamadığında

**Siz:** `Olmayan Ürün`

**Bot:**
```
❌ 'Olmayan Ürün' için sonuç bulunamadı.

💡 İpucu:
• Ürün adının bir kısmını yazmayı deneyin
• Barkod doğru mu kontrol edin
```

---

## ⚡ Performans Özellikleri

### Hızlı Arama (İlk Sayfa)

- İlk aramada sadece ilk 100 ürün kontrol edilir
- **Süre: 2-5 saniye**
- Çoğu ürün ilk sayfada bulunur

### Derinlemesine Arama

- İlk sayfada bulunamazsa tüm stoklarda aranır
- **Süre: 30-60 saniye** (ilk kez)
- Sonraki aramalar cache'den hızlı gelir

### Cache Sistemi

- İlk sayfa: 5 dakika cache
- Tüm stoklar: 5 dakika cache
- Cache varsa anında sonuç

---

## 🔧 Komutlar

### `/start`
Bot'u başlatır ve hoş geldin mesajı gösterir.

### `/help`
Yardım mesajı gösterir.

### `/search <ürün>`
Ürün araması yapar.

**Örnek:**
```
/search Sütaş Süt
```

### `/refresh`
Stok cache'ini temizler ve yeniden yükler.

**Ne zaman kullanılır:**
- Stok bilgileri güncel görünmüyorsa
- Yeni ürünler eklenmişse

---

## 🛠️ Sorun Giderme

### Bot Yanıt Vermiyor

1. **Bot çalışıyor mu kontrol edin:**
   ```bash
   ps aux | grep "python main.py"
   ```
   Çalışmıyorsa tekrar başlatın.

2. **Token durumunu kontrol edin:**
   - Extension simgesine tıklayın
   - "Token durumu: geçerli" görmelisiniz

3. **Getir sitesi açık mı kontrol edin:**
   - `https://franchise.getir.com` açık olmalı
   - Giriş yapılmış olmalı

### Extension Token Göndermiyor

1. **Extension aktif mi kontrol edin:**
   - `chrome://extensions/` sayfasına gidin
   - Extension'ın toggle'ı açık olmalı

2. **Getir sitesinde console'u kontrol edin:**
   - Getir sitesinde F12'ye basın
   - Console sekmesine gidin
   - "Token bulundu" mesajını görmelisiniz

3. **Bot server çalışıyor mu:**
   ```bash
   curl http://localhost:8765/status
   ```
   JSON yanıt almalısınız.

### Arama Çok Yavaş

1. **İlk arama normal:** İlk kez arama yapıyorsanız 30-60 saniye sürebilir
2. **Cache kullanın:** `/refresh` komutunu sadece gerektiğinde kullanın
3. **İlk sayfa cache'i:** İlk sayfa cache'i 5 dakika geçerli

### Token Expire Oluyor

- Extension otomatik olarak yeni token gönderir
- Getir sitesi açıkken extension çalışır
- Token expire olunca extension yeni token'ı gönderir

---

## 📊 Kullanım İstatistikleri

Bot şu bilgileri loglar:
- Arama sayısı
- Başarılı/başarısız aramalar
- Cache kullanımı
- Token güncellemeleri

Logları görmek için:
```bash
tail -f bot.log
```

---

## 🔐 Güvenlik Notları

1. **Token Güvenliği:**
   - Token'lar sadece localhost'ta saklanır
   - Extension sadece Getir sitesinde çalışır
   - Token'lar asla dışarıya gönderilmez

2. **Credentials:**
   - `.env` dosyası gitignore'da
   - Session dosyaları gitignore'da
   - Asla commit edilmez

3. **Rate Limiting:**
   - Bot dakikada maksimum 10 istek kabul eder
   - Rate limit aşılırsa uyarı mesajı gönderilir

---

## 💡 İpuçları

1. **Hızlı Arama:** Çoğu ürün ilk sayfada, bu yüzden ilk arama hızlıdır
2. **Cache Kullanımı:** Cache varsa anında sonuç alırsınız
3. **Extension Popup:** Extension simgesine tıklayarak durumu kontrol edebilirsiniz
4. **Log Takibi:** Sorun yaşarsanız `bot.log` dosyasını kontrol edin

---

## 🆘 Yardım

Sorun yaşıyorsanız:

1. Bot loglarını kontrol edin: `tail -f bot.log`
2. Extension console'unu kontrol edin (F12)
3. Bot server durumunu kontrol edin: `curl http://localhost:8765/status`

---

## 📝 Notlar

- Bot sürekli çalışır durumda olmalı
- Getir sitesi açıkken extension çalışır
- Token otomatik yenilenir (extension sayesinde)
- İlk aramalar biraz yavaş olabilir (normal)
- Cache sayesinde sonraki aramalar hızlıdır

