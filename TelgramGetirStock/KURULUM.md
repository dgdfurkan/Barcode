# 🚀 Getir Stock Bot - Detaylı Kurulum Rehberi

> 💡 **Bu rehber hiçbir teknik bilgisi olmayan kullanıcılar için hazırlanmıştır. Her adımı sırayla takip edin.**

---

## ⚡ HIZLI KURULUM - Otomatik Script (ÖNERİLEN)

**En kolay yol! Script'i çalıştırın, o her şeyi halledecek:**

### 🍎 Mac Kullanıcıları:

1. **Finder'da proje klasörünü bulun** (`TelgramGetirStock` klasörü)
2. **`setup.sh` dosyasına çift tıklayın** veya sağ tıklayın → "Open With" → "Terminal"
3. **Veya Terminal açın**, proje klasörüne gidin ve şunu yazın:
   ```bash
   bash setup.sh
   ```
4. Script size sorular soracak:
   - Bot Token'ınızı girin (BotFather'dan aldığınız)
   - Getir kullanıcı adınızı girin
   - Getir şifrenizi girin
5. Script otomatik olarak:
   - ✅ Python'u kontrol eder
   - ✅ Virtual environment oluşturur
   - ✅ Bağımlılıkları yükler
   - ✅ .env dosyasını oluşturur ve bilgilerinizi kaydeder
6. **Kurulum tamamlandı!** ✅

### 🪟 Windows Kullanıcıları:

1. **Proje klasörünü açın** (`TelgramGetirStock` klasörü)
2. **`setup.bat` dosyasına çift tıklayın**
   - Veya sağ tıklayın → "Run as administrator" (yönetici olarak çalıştır)
3. Bir pencere açılacak ve script çalışmaya başlayacak
4. Script size sorular soracak:
   - Bot Token'ınızı girin (BotFather'dan aldığınız)
   - Getir kullanıcı adınızı girin
   - Getir şifrenizi girin
5. Script otomatik olarak:
   - ✅ Python'u kontrol eder
   - ✅ Virtual environment oluşturur
   - ✅ Bağımlılıkları yükler
   - ✅ .env dosyasını oluşturur ve bilgilerinizi kaydeder
6. **Kurulum tamamlandı!** ✅

> 💡 **İpucu:** Script çalışırken terminal/command prompt penceresini kapatmayın. Kurulum bitince "KURULUM TAMAMLANDI!" mesajını göreceksiniz.

---

## 📋 İhtiyacınız Olan Şeyler

1. ✅ Bilgisayar (Mac, Windows veya Linux)
2. ✅ İnternet bağlantısı
3. ✅ Chrome veya Edge tarayıcı
4. ✅ Telegram hesabı (telefon numarası ile kayıt olmuş)
5. ✅ BotFather'dan bot token'ı (script size soracak)
6. ✅ Getir kullanıcı adı ve şifresi (script size soracak)

---

## 📖 Manuel Kurulum (Script Çalışmazsa)

Eğer otomatik script çalışmazsa veya adım adım yapmak isterseniz, aşağıdaki adımları takip edin:

---

## 🔧 ADIM 1: Python Kurulumu (Eğer yoksa)

### 🍎 Mac Kullanıcıları İçin:

#### Python'un kurulu olup olmadığını kontrol edin:

1. **Terminal'i açın:**
   - Spotlight'a basın (⌘ + Space)
   - "Terminal" yazın
   - Enter'a basın

2. **Terminal'de şu komutu yazın:**
   ```bash
   python3 --version
   ```
   
3. **Eğer şöyle bir şey görürseniz (örnek: `Python 3.9.7`):**
   - ✅ Python zaten kurulu! **ADIM 2'ye geçin**

4. **Eğer "command not found" hatası alırsanız:**
   - Python kurulu değil, kurmanız gerekiyor

#### Python Kurulumu (Mac):

**Yöntem 1: Homebrew ile (Önerilen)**

1. Terminal'i açın
2. Şu komutu yazın ve Enter'a basın:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. Kurulum sırasında şifre isteyecek, Mac şifrenizi girin
4. Kurulum bitince şu komutu yazın:
   ```bash
   brew install python3
   ```
5. Kurulum bitince kontrol edin:
   ```bash
   python3 --version
   ```

**Yöntem 2: Python.org'dan indirin**

1. Tarayıcınızda şu adrese gidin: https://www.python.org/downloads/
2. "Download Python 3.x.x" butonuna tıklayın (en üstteki büyük sarı buton)
3. İndirilen `.pkg` dosyasına çift tıklayın
4. Kurulum sihirbazını takip edin (hepsinde "Continue" ve "Install" butonlarına tıklayın)
5. Kurulum bitince Terminal'i açın ve kontrol edin:
   ```bash
   python3 --version
   ```

---

### 🪟 Windows Kullanıcıları İçin:

#### Python'un kurulu olup olmadığını kontrol edin:

1. **Command Prompt'u açın:**
   - Windows tuşuna basın
   - "cmd" yazın
   - Enter'a basın

2. **Şu komutu yazın:**
   ```cmd
   python --version
   ```
   
3. **Eğer şöyle bir şey görürseniz (örnek: `Python 3.9.7`):**
   - ✅ Python zaten kurulu! **ADIM 2'ye geçin**

4. **Eğer "Python is not recognized" hatası alırsanız:**
   - Python kurulu değil, kurmanız gerekiyor

#### Python Kurulumu (Windows):

1. Tarayıcınızda şu adrese gidin: https://www.python.org/downloads/
2. "Download Python 3.x.x" butonuna tıklayın (en üstteki büyük sarı buton)
3. İndirilen `.exe` dosyasına çift tıklayın
4. **ÖNEMLİ:** Kurulum ekranında **"Add Python to PATH"** kutusunu işaretleyin! ✅
5. "Install Now" butonuna tıklayın
6. Kurulum bitince Command Prompt'u kapatıp yeniden açın
7. Kontrol edin:
   ```cmd
   python --version
   ```

---

### 🐧 Linux Kullanıcıları İçin:

Terminal'i açın ve şu komutu yazın:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

**Fedora/CentOS:**
```bash
sudo dnf install python3 python3-pip
```

Kontrol edin:
```bash
python3 --version
```

---

## 🔧 ADIM 2: Projeyi İndirin ve Hazırlayın

### 2.1 Proje Klasörünü Bulun

1. Projeyi size veren kişiden `TelgramGetirStock` klasörünü alın
2. Bu klasörü bilgisayarınızda bir yere kopyalayın (örnek: Masaüstü, Belgeler klasörü)

### 2.2 Terminal/Command Prompt'u Açın

**Mac:**
- Spotlight (⌘ + Space) → "Terminal" yazın → Enter

**Windows:**
- Windows tuşu → "cmd" yazın → Enter

**Linux:**
- Ctrl + Alt + T

### 2.3 Proje Klasörüne Gidin

Terminal/Command Prompt'ta şu komutları yazın (kendi klasör yolunuza göre değiştirin):

**Mac/Linux:**
```bash
cd ~/Desktop/TelgramGetirStock
```
veya
```bash
cd ~/Documents/TelgramGetirStock
```

**Windows:**
```cmd
cd C:\Users\KullaniciAdiniz\Desktop\TelgramGetirStock
```
veya
```cmd
cd C:\Users\KullaniciAdiniz\Documents\TelgramGetirStock
```

> 💡 **İpucu:** Klasör yolunu bilmiyorsanız:
> - Mac: Finder'da klasöre sağ tıklayın → "Get Info" → "Where" kısmındaki yolu kopyalayın
> - Windows: Klasöre sağ tıklayın → "Properties" → "Location" kısmındaki yolu kopyalayın

### 2.4 Klasörün Doğru Olduğunu Kontrol Edin

Şu komutu yazın:
```bash
ls
```
(Mac/Linux) veya
```cmd
dir
```
(Windows)

Şunları görmelisiniz:
- `main.py`
- `requirements.txt`
- `src` klasörü
- `extension` klasörü

Eğer bunları görmüyorsanız, yanlış klasördesiniz demektir. Doğru klasöre gidin.

---

## 🔧 ADIM 3: Python Ortamını Hazırlayın

### 3.1 Virtual Environment Oluşturun

Terminal/Command Prompt'ta (proje klasöründeyken) şu komutu yazın:

**Mac/Linux:**
```bash
python3 -m venv venv
```

**Windows:**
```cmd
python -m venv venv
```

Bu komut birkaç saniye sürebilir. Bitince hiçbir hata mesajı görmemelisiniz.

### 3.2 Virtual Environment'ı Aktifleştirin

**Mac/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```cmd
venv\Scripts\activate
```

Başarılı olursa, terminal satırının başında `(venv)` yazısını göreceksiniz. Örnek:
```
(venv) user@computer TelgramGetirStock %
```

### 3.3 Bağımlılıkları Yükleyin

Terminal'de (venv aktifken) şu komutu yazın:

**Mac/Linux:**
```bash
pip3 install -r requirements.txt
```

**Windows:**
```cmd
pip install -r requirements.txt
```

Bu işlem 1-2 dakika sürebilir. Kurulum sırasında birçok paket indirilecek. Bitince "Successfully installed" mesajı göreceksiniz.

---

## 🔧 ADIM 4: Bot Token'ınızı Alın

### 4.1 Telegram'da BotFather'a Gidin

1. Telegram uygulamasını açın (telefon veya bilgisayar)
2. Arama kutusuna `@BotFather` yazın
3. BotFather bot'una tıklayın
4. `/start` komutunu gönderin

### 4.2 Yeni Bot Oluşturun

1. BotFather'a `/newbot` komutunu gönderin
2. Bot'unuza bir **isim** verin (örnek: "C Deposu Stok Botu")
3. Bot'unuza bir **kullanıcı adı** verin (örnek: "c_depo_stok_bot")
   - Kullanıcı adı `bot` ile bitmeli
   - Kullanıcı adı benzersiz olmalı (eğer alınmışsa farklı bir şey deneyin)

### 4.3 Bot Token'ınızı Kopyalayın

BotFather size şöyle bir mesaj gönderecek:
```
Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890

Keep your token secure and store it safely...
```

**Bu token'ı kopyalayın!** (1234567890:ABC... kısmını)

> ⚠️ **ÖNEMLİ:** Bu token'ı kimseyle paylaşmayın! Bot'unuzun kontrolü bu token'da.

---

## 🔧 ADIM 5: Bot Token'ını Ayarlayın

### 5.1 .env Dosyasını Oluşturun

Proje klasöründe `.env` adında bir dosya oluşturun:

**Mac/Linux (Terminal'de):**
```bash
touch .env
```

**Windows (Command Prompt'ta):**
```cmd
type nul > .env
```

**Veya manuel olarak:**
- Notepad (Windows) veya TextEdit (Mac) açın
- Boş bir dosya oluşturun
- `.env` adıyla kaydedin (proje klasörüne)

### 5.2 .env Dosyasını Düzenleyin

`.env` dosyasını açın ve şu satırları ekleyin (kendi bilgilerinizle değiştirin):

```env
# Telegram Bot Token (BotFather'dan aldığınız token)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890

# Getir Kullanıcı Bilgileri (Getir'e giriş yaptığınız kullanıcı adı ve şifre)
GETIR_USERNAME=kullanici_adiniz
GETIR_PASSWORD=sifreniz

# Getir API Ayarları (Bunları değiştirmeyin)
GETIR_API_BASE_URL=https://franchise-api-gateway.getirapi.com
GETIR_RECAPTCHA_SITE_KEY=6LfRdRobAAAAAGtQPnhju9dtpIU0eeMuJ_4ogcGa
```

> 💡 **Örnek:**
> ```env
> TELEGRAM_BOT_TOKEN=8374649024:AAF29fckFOHHAyc5SUzt01tm1sV5dw8X03k
> GETIR_USERNAME=bernal.sayan
> GETIR_PASSWORD=Dunya262726.
> GETIR_API_BASE_URL=https://franchise-api-gateway.getirapi.com
> GETIR_RECAPTCHA_SITE_KEY=6LfRdRobAAAAAGtQPnhju9dtpIU0eeMuJ_4ogcGa
> ```

Dosyayı kaydedin.

---

## 🔧 ADIM 6: Chrome Extension'ını Yükleyin

### 6.1 Extension Klasörünü Bulun

Proje klasöründe `extension` adında bir klasör var. Bu klasörün yolunu not edin.

### 6.2 Chrome'da Extension Sayfasını Açın

1. Chrome tarayıcısını açın
2. Adres çubuğuna şunu yazın: `chrome://extensions/`
3. Enter'a basın

### 6.3 Developer Mode'u Açın

1. Sağ üst köşede "Developer mode" toggle'ını bulun
2. Açık konuma getirin (mavi olmalı)

### 6.4 Extension'ı Yükleyin

1. "Load unpacked" butonuna tıklayın
2. Açılan pencerede `extension` klasörünü seçin
3. "Select Folder" (Mac) veya "Klasör Seç" (Windows) butonuna tıklayın

### 6.5 Extension'ın Yüklendiğini Kontrol Edin

Extension listesinde "Getir Stock Bot Token Provider" adında bir extension görmelisiniz. Yanında bir ikon olmalı.

---

## 🔧 ADIM 7: Bot'u Başlatın

### 7.1 Terminal'i Açın ve Proje Klasörüne Gidin

(ADIM 2'deki gibi)

### 7.2 Virtual Environment'ı Aktifleştirin

(ADIM 3.2'deki gibi)

### 7.3 Bot'u Başlatın

Terminal'de şu komutu yazın:

**Mac/Linux:**
```bash
python3 main.py
```

**Windows:**
```cmd
python main.py
```

### 7.4 Başarı Mesajlarını Kontrol Edin

Bot başladığında şu mesajları görmelisiniz:

```
✅ Bot başlatıldı - Keycloak token yüklendi
Token update server başlatıldı: http://localhost:8765
Application started
```

> ⚠️ **ÖNEMLİ:** Terminal penceresini **KAPATMAYIN**! Bot çalışırken bu pencere açık kalmalı.

---

## 🔧 ADIM 8: Extension'ı Yapılandırın

### 8.1 Extension Popup'ını Açın

1. Chrome'da sağ üst köşede extension ikonunu bulun
2. İkonuna tıklayın
3. Popup penceresi açılacak

### 8.2 Bot Durumunu Kontrol Edin

1. Popup'ta "📊 Bot Durumu" bölümünü bulun
2. "🔄 Durumu Yenile" butonuna tıklayın
3. Eğer bot çalışıyorsa şunu göreceksiniz:
   - ✅ Bot çalışıyor
   - Bot Token: 8374649024:AAF...
   - Franchise Token: ✅ Geçerli
   - SKT Durumu: ✅ Açık veya ❌ Kapalı

### 8.3 Bot Token'ı Extension'a Kaydedin (Opsiyonel)

1. Popup'ta "🤖 Bot Token" bölümünü bulun
2. BotFather'dan aldığınız token'ı yapıştırın
3. "💾 Bot Token'ı Kaydet" butonuna tıklayın
4. Extension token'ı kaydedecek (sadece hatırlatma için)

---

## 🔧 ADIM 9: Token'ları Aktifleştirin

### 9.1 Franchise Token'ı Aktifleştirin

1. Chrome'da şu adrese gidin: `https://franchise.getir.com/stock/current`
2. Getir'e giriş yapın (kullanıcı adı ve şifre ile)
3. Sayfayı yenileyin:
   - **Mac:** ⌘ + R veya F5
   - **Windows:** Ctrl + R veya F5
4. Extension otomatik olarak token'ı yakalayıp bot'a gönderecek
5. Extension popup'ını açıp "Bot Durumu"nda "Franchise Token: ✅ Geçerli" yazısını görmelisiniz

### 9.2 Warehouse Token'ı Aktifleştirin

1. Chrome'da şu adrese gidin: `https://warehouse.getir.com/`
2. Getir'e giriş yapın (eğer giriş yapmadıysanız)
3. Sayfayı **hard refresh** yapın:
   - **Mac:** ⌘ + Shift + R
   - **Windows:** Ctrl + Shift + R
4. Extension otomatik olarak token'ı yakalayıp bot'a gönderecek
5. Extension popup'ını açıp "Bot Durumu"nda token durumunu kontrol edin

---

## 🔧 ADIM 10: SKT Ayarlarını Yapın

1. Extension popup'ını açın
2. "📅 SKT (Son Kullanma Tarihi) Ayarları" bölümünü bulun
3. Toggle switch'e tıklayın:
   - **Açık (mavi):** SKT bilgisi gösterilir
   - **Kapalı (gri):** SKT bilgisi gösterilmez
4. Ayar otomatik olarak kaydedilir

---

## 🎯 Kullanım

### Telegram'da Bot'u Kullanma

1. Telegram uygulamasını açın (telefon veya bilgisayar)
2. BotFather'dan aldığınız bot adını arayın (örnek: "C Deposu Stok Botu")
3. Bot'a tıklayın
4. `/start` komutunu gönderin
5. Bot size hoş geldin mesajı gönderecek
6. Bir ürün adı veya barkod gönderin (örnek: `8690451709908` veya `soğan`)
7. Bot size stok bilgisini ve SKT bilgisini (açıksa) gösterecek

### Komutlar

- `/start` - Bot'u başlatır ve hoş geldin mesajı gösterir
- `/help` - Yardım mesajı gösterir
- `/skt_on` - SKT bilgisini açar
- `/skt_off` - SKT bilgisini kapatır
- `/status` - Bot durumunu gösterir

---

## 🔍 Sorun Giderme

### ❌ "Python is not recognized" veya "command not found" hatası

**Çözüm:** Python kurulu değil. ADIM 1'e geri dönün ve Python'u kurun.

### ❌ "pip is not recognized" hatası

**Çözüm:** Python kurulumunda PATH'e eklenmemiş. Python'u yeniden kurun ve "Add Python to PATH" seçeneğini işaretleyin.

### ❌ Bot başlamıyor - Port hatası

**Çözüm:** Port 8765 başka bir program tarafından kullanılıyor.

**Mac/Linux:**
```bash
lsof -i :8765
```
Çıkan PID numarasını not edin, sonra:
```bash
kill <PID>
```

**Windows:**
```cmd
netstat -ano | findstr :8765
```
Çıkan PID numarasını not edin, sonra:
```cmd
taskkill /PID <PID> /F
```

### ❌ Extension token yakalamıyor

**Çözüm:**
1. Extension'ı yeniden yükleyin (`chrome://extensions/` → Reload)
2. Sayfayı hard refresh yapın (Cmd+Shift+R veya Ctrl+Shift+R)
3. Browser console'u açın (F12) ve hata mesajlarını kontrol edin
4. Extension popup'ında "Manuel Token Girişi" bölümünü kullanın

### ❌ SKT bilgisi gelmiyor

**Çözüm:**
1. Extension popup'ında SKT toggle'ının açık olduğundan emin olun
2. Warehouse token'ının geldiğini kontrol edin (Extension popup → Bot Durumu)
3. Bot loglarını kontrol edin (Terminal'de bot çalışırken hata mesajları var mı?)

---

## 📝 Önemli Notlar

- ✅ **Her depo için farklı bot token kullanın** - Token'lar birbirine karışmaz
- ✅ Bot token'ı `.env` dosyasında saklanır - Bu dosyayı kimseyle paylaşmayın
- ✅ Extension token'ları otomatik yakalar ve bot'a gönderir
- ✅ Bot çalışırken terminal penceresini kapatmayın
- ✅ Bot'u kapatmak için terminal'de `Ctrl + C` tuşlarına basın

---

## 🆘 Yardım

Sorun yaşıyorsanız:

1. **Bot loglarını kontrol edin:**
   - Terminal'de bot çalışırken hata mesajları var mı?
   - `bot.log` dosyasını açıp kontrol edin

2. **Extension console'unu kontrol edin:**
   - `chrome://extensions/` → "Getir Stock Bot Token Provider" → "Service Worker" → Console

3. **Browser console'unu kontrol edin:**
   - F12 tuşuna basın → Console sekmesi → Hata mesajları var mı?

4. **Bot durumunu kontrol edin:**
   - Extension popup → Bot Durumu → Tüm bilgiler doğru mu?

---

## ✅ Kurulum Tamamlandı!

Artık bot'unuz çalışıyor! Telegram'da bot'unuza mesaj göndererek test edebilirsiniz.

**İyi kullanımlar! 🎉**
