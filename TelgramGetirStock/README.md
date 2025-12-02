# Getir Stock Telegram Bot

Getir franchise depo sistemindeki ürünlerin stok bilgilerini Telegram üzerinden sorgulamanızı sağlayan bot.

## Özellikler

- 🔍 Ürün adı veya barkod ile stok sorgulama
- 📊 Mevcut stok ve rezerve stok bilgileri
- ⚡ **Hızlı arama** - İlk sayfada arama (5 saniyeden az)
- 🔐 **Browser Extension** ile otomatik token yönetimi (reCAPTCHA sorunu yok!)
- 💾 Akıllı cache mekanizması
- 📱 Telegram üzerinden kolay kullanım

## ⚡ Hızlı Kurulum (ÖNERİLEN)

**En kolay yol! Otomatik kurulum script'ini çalıştırın:**

### 🍎 Mac/Linux:
```bash
bash setup.sh
```

### 🪟 Windows:
`setup.bat` dosyasına çift tıklayın

Script otomatik olarak:
- ✅ Python'u kontrol eder
- ✅ Virtual environment oluşturur
- ✅ Bağımlılıkları yükler
- ✅ .env dosyasını oluşturur (size sorular soracak)

**Detaylı kurulum için:** [KURULUM.md](KURULUM.md)

---

## 📖 Manuel Kurulum

### 1. Gereksinimler

- Python 3.9+
- Telegram Bot Token (BotFather'dan alın)
- Getir franchise hesabı

### 2. Projeyi İndirin

Proje klasörünü bilgisayarınıza kopyalayın.

### 3. Python Ortamını Hazırlayın

```bash
# Virtual environment oluştur
python3 -m venv venv

# Aktifleştir
# Mac/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Bağımlılıkları yükle
pip install -r requirements.txt
```

### 4. Environment Variables Ayarlayın

`.env` dosyası oluşturun ve düzenleyin:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
GETIR_USERNAME=your_getir_username
GETIR_PASSWORD=your_getir_password
GETIR_API_BASE_URL=https://franchise-api-gateway.getirapi.com
GETIR_RECAPTCHA_SITE_KEY=6LfRdRobAAAAAGtQPnhju9dtpIU0eeMuJ_4ogcGa
```

### 5. Browser Extension'ı Kurun (Önerilen)

Browser extension ile token otomatik olarak yönetilir ve reCAPTCHA sorunu olmaz.

1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üstteki **"Geliştirici modu"**nu açın
3. **"Paketlenmemiş uzantı yükle"** butonuna tıklayın
4. `TelgramGetirStock/extension` klasörünü seçin
5. Extension yüklendikten sonra Getir sitesine gidin: `https://franchise.getir.com/login`
6. Giriş yapın - Extension otomatik olarak token'ı bot'a gönderecek

Detaylı kurulum için: [extension/README.md](extension/README.md)

### 6. Bot'u Çalıştırın

```bash
python main.py
```

Bot başlatıldığında:
- Extension token server `http://localhost:8765` portunda çalışacak
- Getir sitesinde açıkken extension otomatik olarak token'ı gönderecek
- Token expire olunca extension yeni token'ı otomatik gönderecek

## Kullanım

### Telegram'da Bot'u Başlatın

1. Telegram'da bot'unuzu bulun
2. `/start` komutunu gönderin
3. Ürün adı veya barkod yazarak arama yapın

### Komutlar

- `/start` - Bot'u başlat ve hoş geldin mesajı
- `/help` - Yardım mesajı
- `/search <ürün>` - Ürün ara
- `/refresh` - Stok cache'ini yenile

### Örnekler

```
Coca Cola          # Ürün adı ile arama
000000000001013727  # Barkod ile arama
/search Coca Cola   # Komut ile arama
```

## Proje Yapısı

```
TelgramGetirStock/
├── src/
│   ├── __init__.py
│   ├── bot.py                 # Telegram bot ana dosyası
│   ├── getir_client.py        # Getir API client
│   ├── auth_manager.py         # Authentication ve session yönetimi
│   ├── stock_service.py       # Stok sorgulama servisi
│   └── utils.py               # Yardımcı fonksiyonlar
├── extension/                 # Chrome extension
│   ├── manifest.json
│   ├── content.js            # Getir sitesinde çalışan script
│   ├── background.js         # Token yönetimi
│   ├── popup.html            # Extension popup
│   ├── popup.js              # Popup script
│   └── README.md             # Extension kurulum talimatları
├── data/
│   └── session.json          # Session/cookie saklama (gitignore)
├── requirements.txt
├── .env                       # Gerçek credentials (gitignore)
├── .gitignore
├── main.py                    # Ana giriş noktası
└── README.md
```

## Güvenlik

- `.env` dosyası `.gitignore`'a eklenmiştir
- Session dosyaları (`data/session.json`) gitignore'da
- Credentials asla commit edilmez
- Token'lar güvenli şekilde saklanır

## Notlar

- **Browser Extension kullanıyorsanız**: reCAPTCHA sorunu yok, token otomatik yönetiliyor
- **Extension kullanmıyorsanız**: İlk girişte reCAPTCHA çözümü gerekebilir
- Session token'ları otomatik olarak saklanır ve yenilenir
- Stok verileri 5 dakika cache'lenir (performans için)
- İlk sayfa stokları ayrı cache'lenir (hızlı arama için)
- Rate limiting ve retry mekanizması mevcuttur
- **Performans**: İlk aramada sadece ilk sayfa kontrol edilir (5 saniyeden az), bulunamazsa tüm stoklarda aranır

## Lisans

Bu proje kişisel kullanım içindir.

