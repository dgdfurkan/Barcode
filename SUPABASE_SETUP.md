# 🚀 Supabase Remote Database Kurulum Rehberi

## 📋 **Adım 1: Supabase Hesabı Oluştur**

1. [Supabase.com](https://supabase.com) adresine git
2. "Start your project" butonuna tıkla
3. GitHub ile giriş yap
4. "New Project" oluştur
5. Proje adı: `product-barcode-search`
6. Database password oluştur (güçlü bir şifre)
7. Region: `Europe West (London)` seç

## 📋 **Adım 2: Database Schema Kurulumu**

1. Supabase Dashboard → SQL Editor
2. `supabase_schema.sql` dosyasının içeriğini kopyala
3. SQL Editor'e yapıştır
4. "Run" butonuna tıkla
5. Tablolar oluşturulacak

## 📋 **Adım 3: API Keys Alma**

1. Supabase Dashboard → Settings → API
2. **Project URL**'i kopyala
3. **anon public** key'i kopyala

## 📋 **Adım 4: Kod Güncelleme**

`js/auth.js` dosyasında şu satırları güncelle:

```javascript
const SUPABASE_URL = 'YOUR_PROJECT_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

## 📋 **Adım 5: Test Et**

1. Test hesabıyla giriş yap (admin panelinden oluşturulan hesap)
2. Admin panelinde yeni kullanıcı oluştur
3. Kullanıcıların Supabase'de göründüğünü kontrol et

## 🔧 **Özellikler**

### ✅ **Kullanıcı Yönetimi**
- Kullanıcı oluşturma/silme
- Trial süresi yönetimi
- IP kontrolü
- Admin/User rolleri

### ✅ **Mesaj Sistemi**
- Kullanıcıların admin'e mesaj göndermesi
- Mesaj durumu takibi
- Admin yanıtları

### ✅ **IP Logging**
- Giriş/çıkış logları
- IP adresi takibi
- Session süresi

### ✅ **Rate Limiting**
- Başarısız giriş denemeleri
- IP bazlı engelleme
- Otomatik açılma

### ✅ **Güvenlik**
- Row Level Security (RLS)
- Password hashing
- JWT tokens
- CORS koruması

## 🚨 **Önemli Notlar**

1. **Demo Modu**: Supabase yapılandırılmamışsa demo kullanıcılar çalışır
2. **Fallback**: Tüm fonksiyonlar localStorage fallback'i var
3. **Güvenlik**: Production'da RLS politikaları aktif
4. **Backup**: Supabase otomatik backup sağlar

## 💰 **Maliyet**

- **Free Tier**: 50,000 veritabanı işlemi/ay
- **Pro Tier**: $25/ay (500,000 işlem)
- **Team Tier**: $599/ay (unlimited)

## 🔧 **Troubleshooting**

### Sorun: "Supabase not initialized"
**Çözüm**: API keys'leri kontrol et

### Sorun: "Permission denied"
**Çözüm**: RLS politikalarını kontrol et

### Sorun: "Table doesn't exist"
**Çözüm**: SQL schema'yı tekrar çalıştır

## 📞 **Destek**

- Supabase Docs: [docs.supabase.com](https://docs.supabase.com)
- Discord: [discord.supabase.com](https://discord.supabase.com)
- GitHub: [github.com/supabase/supabase](https://github.com/supabase/supabase)
