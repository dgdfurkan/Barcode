# 🔍 Product Barcode Search SaaS System

Profesyonel barkod arama sistemi - Kullanıcı kimlik doğrulama, IP kontrolü ve test süresi yönetimi ile.

**GitHub:** [dgdfurkan/product_barcode_search](https://github.com/dgdfurkan/product_barcode_search)  
**Email:** furkangunduz.dev@gmail.com

## 🚀 Özellikler

### 🔐 Kimlik Doğrulama Sistemi
- **Kullanıcı girişi** - Username/password ile güvenli giriş
- **IP Whitelist** - Sadece belirlenen IP'lerden erişim
- **Test süresi kontrolü** - Otomatik süre sonu yönetimi
- **Session yönetimi** - 24 saatlik oturum süresi

### 📊 Admin Paneli
- **Kullanıcı yönetimi** - Oluşturma, düzenleme, silme
- **Test süresi uzatma** - Esnek süre yönetimi
- **IP kontrolü** - Whitelist yönetimi
- **Mesaj sistemi** - Kullanıcı talepleri
- **Sistem logları** - IP ve aktivite takibi

### 🛡️ Güvenlik
- **Local + Cloud** - Supabase entegrasyonu
- **Şifreleme** - Base64 token encoding
- **CORS koruması** - Güvenli API erişimi
- **Rate limiting** - Brute force koruması

## 📁 Dosya Yapısı

```
product-search-saas/
├── index.html              # Ana giriş sayfası
├── admin.html              # Admin paneli
├── pages/
│   └── product_search.html # Korumalı ana sayfa
├── js/
│   ├── auth.js            # Kimlik doğrulama
│   ├── user-manager.js    # Kullanıcı veri yönetimi
│   └── admin.js           # Admin paneli
├── css/
├── assets/
└── README.md
```

## 🛠️ Kurulum

### 1. Local Kurulum
```bash
# Projeyi klonlayın
git clone <repository-url>
cd product-search-saas

# Basit HTTP sunucusu başlatın
python -m http.server 8000
# veya
npx serve .
```

### 2. Supabase Kurulumu (Opsiyonel)
1. [Supabase](https://supabase.com) hesabı oluşturun
2. Yeni proje oluşturun
3. `js/auth.js` dosyasında API key'leri güncelleyin
4. Veritabanı tablolarını oluşturun:

```sql
-- Kullanıcılar tablosu
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  company TEXT,
  contact_email TEXT,
  trial_start TIMESTAMP DEFAULT NOW(),
  trial_end TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  allowed_ips TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- IP logları
CREATE TABLE ip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  ip_address TEXT,
  login_time TIMESTAMP DEFAULT NOW(),
  user_agent TEXT
);

-- Mesajlar
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  message_type TEXT,
  content TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Kullanıcı verileri
CREATE TABLE user_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  data JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 👥 Kullanım

### Kullanıcı Girişi
1. `index.html` sayfasını açın
2. Kullanıcı adı ve şifre girin
3. Sistem otomatik olarak IP kontrolü yapar
4. Test süresi kontrolü yapılır
5. Başarılı girişte ana sayfaya yönlendirilir

### Admin Paneli
1. Admin hesabı ile giriş yapın
2. `admin.html` sayfasına gidin
3. Kullanıcı yönetimi yapın
4. Mesajları kontrol edin
5. Sistem loglarını görüntüleyin

## 🔧 Konfigürasyon

### Kullanıcı Ekleme
```javascript
// js/auth.js dosyasında LOCAL_USERS objesine ekleyin
const LOCAL_USERS = {
    'yeni.kullanici': {
        password: 'sifre123',
        company: 'Şirket Adı',
        trialEnd: '2024-12-31',
        allowedIPs: ['192.168.1.100', '203.0.113.1'],
        isActive: true
    }
};
```

### IP Kontrolü
- `allowedIPs: ['*']` - Tüm IP'lere izin ver
- `allowedIPs: ['192.168.1.100']` - Sadece belirli IP
- `allowedIPs: ['192.168.1.0/24']` - IP aralığı (gelecek özellik)

### Test Süresi
- `trialEnd: '2024-12-31'` - Belirli tarih
- `trialEnd: null` - Süresiz erişim

## 📱 Responsive Tasarım

- **Mobile First** - Mobil cihazlar öncelikli
- **Tailwind CSS** - Modern CSS framework
- **Glass Effect** - Şeffaf cam efekti
- **Dark/Light Mode** - Tema desteği (gelecek)

## 🚀 Deployment

### GitHub Pages
1. Repository'yi GitHub'a yükleyin
2. Settings > Pages > Source: Deploy from branch
3. Branch: main seçin
4. `https://username.github.io/repository-name` adresinden erişin

### Vercel
1. [Vercel](https://vercel.com) hesabı oluşturun
2. GitHub repository'yi bağlayın
3. Otomatik deployment yapılır

### Netlify
1. [Netlify](https://netlify.com) hesabı oluşturun
2. Drag & drop ile dosyaları yükleyin
3. Custom domain ekleyin

## 🔒 Güvenlik Notları

- **HTTPS kullanın** - Production'da SSL sertifikası
- **Şifreleri güçlü yapın** - En az 8 karakter
- **IP'leri düzenli kontrol edin** - Güvenlik logları
- **Backup alın** - Kullanıcı verilerini yedekleyin

## 🐛 Sorun Giderme

### Giriş Yapamıyorum
1. Kullanıcı adı/şifre kontrolü
2. IP adresi kontrolü
3. Test süresi kontrolü
4. Console'da hata mesajları

### Admin paneline erişemiyorum
1. `isAdmin: true` kontrolü
2. Supabase bağlantısı
3. API key'leri kontrolü

### Veriler kayboluyor
1. Local storage kontrolü
2. Supabase bağlantısı
3. Backup dosyaları

## 📞 Destek

- **Email:** support@example.com
- **GitHub Issues:** Repository'de issue açın
- **Documentation:** Bu README dosyası

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🔄 Güncellemeler

### v1.0.0 (2024-01-15)
- ✅ Kimlik doğrulama sistemi
- ✅ Admin paneli
- ✅ IP kontrolü
- ✅ Test süresi yönetimi
- ✅ Responsive tasarım

### Gelecek Özellikler
- 🔄 Email bildirimleri
- 🔄 IP aralığı desteği
- 🔄 Dark mode
- 🔄 API rate limiting
- 🔄 Multi-language support

---

**Not:** Bu sistem tamamen ücretsiz ve açık kaynaklıdır. Ticari kullanım için lisans kontrolü yapın.
