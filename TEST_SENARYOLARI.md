# Guest User Management Test Senaryoları

## Sistem Özeti

Yeni sistem şu öncelik sırasıyla çalışıyor:
1. **Kayıtlı Kullanıcı** (user_ip_tracking'den IP'ye göre en son giriş)
2. **Guest Kullanıcı** (guest_chats'den IP'ye göre)
3. **Yeni Guest Kullanıcı Oluşturma** (maksimum numara + 1)

## Test Senaryoları

### Senaryo 1: İlk Kez Guest Kullanıcı Oluşturma
**Amaç:** Yeni bir IP'den ilk kez gelen kullanıcının guest user ID alması

**Adımlar:**
1. Index.html'i aç (giriş yapmadan)
2. Sohbet butonuna tıkla
3. Chat arayüzü açılmalı
4. Console'da şunu görmelisin: `✅ New guest user created in Supabase: KullanıcıXXX for IP: [IP_ADRESI]`
5. Chat header'da "Merhaba KullanıcıXXX! 👋" yazmalı

**Beklenen Sonuç:**
- Guest user ID'si oluşturulmalı (örn: Kullanıcı100, Kullanıcı101, vb.)
- Supabase'de `guest_chats` tablosunda yeni kayıt olmalı
- IP adresi kaydedilmeli

---

### Senaryo 2: Aynı IP'den Tekrar Gelme
**Amaç:** Aynı IP'den tekrar geldiğinde aynı guest user ID'sinin kullanılması

**Adımlar:**
1. Senaryo 1'i tamamla (örn: Kullanıcı100 oluşturuldu)
2. Sayfayı kapat veya farklı bir sekme aç
3. Aynı IP'den tekrar index.html'i aç
4. Sohbet butonuna tıkla
5. Console'da şunu görmelisin: `✅ Existing guest user found in Supabase for IP: [IP_ADRESI] -> Kullanıcı100`

**Beklenen Sonuç:**
- Aynı guest user ID'si kullanılmalı (Kullanıcı100)
- Yeni kayıt oluşturulmamalı
- Önceki mesajlar görünmeli (varsa)

---

### Senaryo 3: Farklı IP'lerden Farklı Guest User ID'leri
**Amaç:** Farklı IP'lerden gelen kullanıcıların farklı ID alması

**Adımlar:**
1. VPN veya farklı bir ağdan index.html'i aç
2. Sohbet butonuna tıkla
3. Console'da yeni bir guest user ID görmelisin (örn: Kullanıcı101)
4. Başka bir IP'den tekrar dene (örn: Kullanıcı102)

**Beklenen Sonuç:**
- Her farklı IP farklı bir guest user ID almalı
- Supabase'de her IP için ayrı kayıt olmalı
- ID'ler sıralı olmalı (100, 101, 102, ...)

---

### Senaryo 4: Kayıtlı Kullanıcı Önceliği
**Amaç:** IP'ye kayıtlı bir kullanıcı varsa, guest user yerine o kullanılmalı

**Hazırlık:**
1. Bir kullanıcı hesabıyla giriş yap (örn: "testuser")
2. Bu IP'den giriş yapıldığında `user_ip_tracking` tablosunda kayıt oluşur
3. Çıkış yap

**Test:**
1. Aynı IP'den (giriş yapmadan) index.html'i aç
2. Sohbet butonuna tıkla
3. Console'da şunu görmelisin: `🔍 Using registered user from IP tracking: testuser for IP: [IP_ADRESI]`
4. Chat header'da "Merhaba testuser! 👋" yazmalı

**Beklenen Sonuç:**
- Guest user yerine kayıtlı kullanıcı kullanılmalı
- Kullanıcının mesajları görünmeli
- `isGuest` false olmalı

---

### Senaryo 5: Kayıtlı Kullanıcı Giriş Yaptıktan Sonra
**Amaç:** Giriş yapıldığında kayıtlı kullanıcı öncelikli olmalı

**Adımlar:**
1. Guest user olarak sohbet aç (örn: Kullanıcı100)
2. Birkaç mesaj gönder
3. Giriş yap (kayıtlı kullanıcı ile)
4. Sohbeti tekrar aç

**Beklenen Sonuç:**
- Artık kayıtlı kullanıcı görünmeli
- Guest user mesajları görünmemeli (farklı kullanıcı olduğu için)
- Console'da: `🔍 Using authenticated user: [KULLANICI_ADI]`

---

### Senaryo 6: Telegram Bildirimi - Guest User
**Amaç:** Guest kullanıcı mesaj gönderdiğinde Telegram bildirimi gelmeli

**Hazırlık:**
1. SQL trigger'ın çalıştığından emin ol (`guest_chats_telegram_trigger.sql`)
2. Telegram bot token ve chat ID'nin ayarlandığından emin ol

**Test:**
1. Guest user olarak sohbet aç
2. Bir mesaj gönder (örn: "Merhaba, yardıma ihtiyacım var")
3. Telegram'da bildirim gelmeli

**Beklenen Sonuç:**
- Telegram'da mesaj gelmeli
- Format: `📩 Yeni Destek Mesajı!\nKimden: Kullanıcı100\nMesaj: Merhaba, yardıma ihtiyacım var`
- Mesaj timestamp'i içermeli

---

### Senaryo 7: Telegram Bildirimi - Kayıtlı Kullanıcı
**Amaç:** Kayıtlı kullanıcı mesaj gönderdiğinde de Telegram bildirimi gelmeli

**Test:**
1. Kayıtlı kullanıcı ile giriş yap
2. Sohbet aç
3. Mesaj gönder
4. Telegram'da bildirim gelmeli

**Beklenen Sonuç:**
- Telegram'da mesaj gelmeli
- Format: `📩 Yeni Destek Mesajı!\nKimden: [KULLANICI_ADI]\nMesaj: [MESAJ]`
- Hem guest hem kayıtlı kullanıcılar için çalışmalı

---

### Senaryo 8: Maksimum Numara Bulma (Performans Testi)
**Amaç:** Yeni guest user oluşturulurken maksimum numarayı doğru bulması

**Hazırlık:**
1. Supabase'de `guest_chats` tablosunda birkaç kayıt oluştur (Kullanıcı100, Kullanıcı105, Kullanıcı110)
2. En yüksek numara 110 olsun

**Test:**
1. Yeni bir IP'den guest user oluştur
2. Console'da kontrol et

**Beklenen Sonuç:**
- Yeni guest user ID'si Kullanıcı111 olmalı (110 + 1)
- Boşlukları atlamamalı (100, 105, 110'dan sonra 111 gelmeli)

---

### Senaryo 9: Aynı IP'den Farklı Cihazlar
**Amaç:** Aynı IP'den farklı cihazlar aynı guest user ID'sini almalı

**Test:**
1. Cihaz 1'den (aynı ağ/VPN) guest user oluştur (Kullanıcı100)
2. Cihaz 2'den (aynı ağ/VPN) sohbet aç
3. Console'da kontrol et

**Beklenen Sonuç:**
- Cihaz 2 de Kullanıcı100'ü kullanmalı
- Yeni guest user oluşturulmamalı
- Mesajlar paylaşılmalı (aynı kullanıcı olduğu için)

---

### Senaryo 10: Guest User'dan Kayıtlı Kullanıcıya Geçiş
**Amaç:** Guest user olarak mesaj gönderdikten sonra aynı IP'den kayıtlı kullanıcı giriş yaparsa

**Test:**
1. Guest user olarak mesaj gönder (Kullanıcı100)
2. Aynı IP'den kayıtlı kullanıcı ile giriş yap
3. Sohbet aç

**Beklenen Sonuç:**
- Artık kayıtlı kullanıcı görünmeli
- Guest user mesajları görünmemeli (farklı kullanıcı)
- Kayıtlı kullanıcının mesajları görünmeli

---

## Console Log Kontrolleri

Test sırasında console'da şu logları görmelisiniz:

### Başarılı Guest User Oluşturma:
```
✅ New guest user created in Supabase: Kullanıcı100 for IP: 192.168.1.1
🔍 Using guest user: Kullanıcı100
```

### Mevcut Guest User Bulundu:
```
✅ Existing guest user found in Supabase for IP: 192.168.1.1 -> Kullanıcı100
🔍 Using guest user: Kullanıcı100
```

### Kayıtlı Kullanıcı Bulundu:
```
🔍 Using registered user from IP tracking: testuser for IP: 192.168.1.1
```

### Aktif Oturum:
```
🔍 Using authenticated user: testuser
```

---

## Supabase Kontrolleri

### guest_chats Tablosu:
```sql
SELECT * FROM guest_chats 
ORDER BY created_at DESC 
LIMIT 10;
```

Kontrol edilecekler:
- `username`: Kullanıcı100, Kullanıcı101, vb.
- `ip_address`: IP adresi kayıtlı olmalı
- `chat_messages`: JSON array formatında mesajlar
- `last_chat_update`: Son mesaj zamanı

### user_ip_tracking Tablosu:
```sql
SELECT u.username, uit.ip_address, uit.last_seen 
FROM user_ip_tracking uit
JOIN users u ON uit.user_id = u.id
ORDER BY uit.last_seen DESC
LIMIT 10;
```

Kontrol edilecekler:
- IP adresine göre en son giriş yapan kullanıcı
- `last_seen` tarihi

---

## Hata Senaryoları

### Hata 1: Supabase Bağlantısı Yok
**Beklenen:** localStorage fallback çalışmalı
**Log:** `⚠️ Supabase not available, using localStorage fallback`

### Hata 2: IP Tespit Edilemedi
**Beklenen:** 'unknown' IP kullanılmalı
**Log:** `IP detection failed`

### Hata 3: Guest User Oluşturma Hatası
**Beklenen:** localStorage fallback çalışmalı
**Log:** `❌ Error creating guest user in Supabase`

---

## Performans Notları

- Maksimum numara bulma tek sorgu ile yapılıyor (performanslı)
- IP bazlı arama index'lenmiş alanlarda yapılıyor
- Fallback mekanizması var (Supabase yoksa localStorage)

---

## Test Checklist

- [ ] Senaryo 1: İlk kez guest user oluşturma
- [ ] Senaryo 2: Aynı IP'den tekrar gelme
- [ ] Senaryo 3: Farklı IP'lerden farklı ID'ler
- [ ] Senaryo 4: Kayıtlı kullanıcı önceliği
- [ ] Senaryo 5: Giriş yaptıktan sonra
- [ ] Senaryo 6: Telegram bildirimi (guest)
- [ ] Senaryo 7: Telegram bildirimi (kayıtlı)
- [ ] Senaryo 8: Maksimum numara bulma
- [ ] Senaryo 9: Aynı IP'den farklı cihazlar
- [ ] Senaryo 10: Guest'ten kayıtlıya geçiş

---

## Önemli Notlar

1. **IP Değişikliği:** VPN veya farklı ağ kullanarak test edebilirsiniz
2. **Console Logları:** Her adımda console'u kontrol edin
3. **Supabase Verileri:** SQL sorguları ile verileri kontrol edin
4. **Telegram Bildirimi:** Admin panelden bot ayarlarını kontrol edin
5. **RLS Politikaları:** Supabase RLS politikalarının doğru ayarlandığından emin olun

