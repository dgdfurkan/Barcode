# Cloudinary Kurulum Rehberi - Basit ve Detaylı

## 🎯 Sistem Nasıl Çalışıyor?

**Evet, tam olarak öyle!** 

1. Admin panelde güncelleme oluştururken **"📤 Yükle"** butonuna tıklıyorsun
2. Bilgisayarından bir dosya (video veya görsel) seçiyorsun
3. Dosya **direkt Cloudinary'e yükleniyor** (Supabase'e gitmiyor)
4. Cloudinary'den gelen URL otomatik olarak form alanına yazılıyor
5. Video'lar otomatik GIF gibi oynatılıyor, görseller yüksek kalitede gösteriliyor

**Sorunsuzca çalışıyor!** ✅

---

## 📋 Adım 1: Cloudinary Hesabı Oluştur

1. Tarayıcıda şu adrese git: **https://cloudinary.com/users/register/free**

2. **"Sign up for free"** veya **"Ücretsiz Kaydol"** butonuna tıkla

3. Formu doldur:
   - **Email adresin**
   - **Şifre** (güçlü bir şifre seç)
   - **Ad ve Soyad**

4. **"Create Account"** veya **"Hesap Oluştur"** butonuna tıkla

5. Email'ine gelen doğrulama linkine tıkla (spam klasörüne bakabilirsin)

6. Hesabın hazır! 🎉

---

## 📋 Adım 2: Cloudinary Dashboard'a Gir

1. **https://cloudinary.com/console** adresine git

2. Email ve şifrenle giriş yap

3. Dashboard'u görüyorsun - burada tüm ayarları yapacağız

---

## 📋 Adım 3: Cloud Name'i Bul

1. Dashboard'un **sağ üst köşesine** bak

2. Şöyle bir şey göreceksin:
   ```
   Cloud Name: dxyz1234
   ```
   (Senin cloud name'in farklı olacak, örneğin: `mycompany` veya `abc123`)

3. Bu **Cloud Name**'i bir yere not al (örnek: `dxyz1234`)

**Alternatif yol:** Eğer sağ üstte görmüyorsan:
- Sol menüden **"Settings"** (Ayarlar) tıkla
- **"Account Details"** (Hesap Detayları) bölümüne git
- Orada **"Cloud name"** yazıyor

---

## 📋 Adım 4: Upload Preset Oluştur (ÖNEMLİ!)

Upload Preset, dosya yükleme işlemini kolaylaştırır. Şöyle yapılır:

### 4.1. Upload Preset Sayfasına Git

1. Sol menüden **"Settings"** (Ayarlar) tıkla
2. **"Upload"** (Yükleme) sekmesine tıkla
3. **"Upload presets"** (Yükleme ön ayarları) bölümüne git
4. **"Add upload preset"** (Yükleme ön ayarı ekle) butonuna tıkla

### 4.2. Preset Ayarlarını Yap

Açılan formda şunları yap:

1. **"Preset name"** (Ön ayar adı) kısmına yaz: `updates_media`
   - (İstediğin ismi verebilirsin, ama bu ismi kullanırsan kolay olur)

2. **"Signing mode"** (İmzalama modu) kısmında:
   - **"Unsigned"** seçeneğini işaretle
   - ⚠️ **ÖNEMLİ:** Unsigned seçmezsen, dosya yükleme çalışmaz!

3. **"Folder"** (Klasör) kısmına yaz: `updates`
   - (Bu, dosyaların hangi klasörde saklanacağını belirler - opsiyonel ama önerilir)

4. **"Resource type"** (Kaynak tipi) kısmında:
   - **"Auto"** seçeneğini seç
   - (Bu, hem video hem görsel için çalışır)

5. **"Save"** (Kaydet) butonuna tıkla

✅ **Hazır!** Upload preset'in oluşturuldu.

---

## 📋 Adım 5: API Key (OPSİYONEL - Gerekli Değil!)

**⚠️ ÖNEMLİ:** API Key **gerekli değil!** Unsigned upload preset kullanıyorsan, sadece Cloud Name ve Upload Preset yeterli.

Eğer yine de merak ediyorsan:

1. Sol menüden **"Settings"** (Ayarlar) tıkla
2. **"Security"** (Güvenlik) sekmesine tıkla
3. **"API Keys"** bölümüne git
4. Orada **"API Key"** göreceksin

**Ama şimdilik gerekli değil!** Admin panelde API Key alanını boş bırakabilirsin, sistem çalışır. ✅

---

## 📋 Adım 6: Admin Panel'e Bilgileri Gir

1. Admin panelini aç (projenin admin sayfası)

2. Üst menüden **"Sistem Ayarları"** (Settings) tab'ına tıkla

3. **"Cloudinary Ayarları"** bölümünü bul

4. Şu bilgileri gir:

   **Cloud Name:**
   - Adım 3'te not aldığın Cloud Name'i buraya yaz
   - Örnek: `dxyz1234`

   **API Key:**
   - **BOŞ BIRAKABİLİRSİN!** ✅
   - Unsigned preset kullanıyorsan gerekli değil
   - (İstersen Adım 5'te bulduğun API Key'i yazabilirsin, ama zorunlu değil)

   **Upload Preset:**
   - Adım 4'te oluşturduğun preset ismini buraya yaz
   - Örnek: `updates_media`

5. Bilgileri girdikten sonra, sayfadan ayrılırken otomatik kaydedilir

---

## 📋 Adım 7: Test Et!

1. Admin panelde **"Güncellemeler"** (Updates) tab'ına git

2. **"Yeni Güncelleme"** veya **"Güncelleme Ekle"** butonuna tıkla

3. Bir adım ekle (Step ekle)

4. **"Görsel/Video"** alanında **"📤 Yükle"** butonuna tıkla

5. Bilgisayarından bir dosya seç (video veya görsel)

6. **"⏳ Yükleniyor..."** mesajını görüyorsun

7. Yükleme tamamlandığında:
   - **"✅ Video yüklendi"** veya **"✅ Görsel yüklendi"** mesajı görünür
   - URL alanı otomatik dolar
   - Önizlemede dosyan görünür

8. Video ise otomatik GIF gibi oynatılır, görsel ise yüksek kalitede gösterilir

✅ **Başarılı!** Artık Cloudinary kullanıyorsun!

---

## ❓ Sık Sorulan Sorular

### Soru 1: Upload Preset'i neden "Unsigned" seçmeliyim?

**Cevap:** Unsigned seçmezsen, dosya yükleme için API Secret gerekiyor. Ama API Secret'ı frontend'te (tarayıcıda) kullanmak güvenli değil. Unsigned seçersen, sadece Upload Preset ismi yeterli olur ve güvenli bir şekilde dosya yükleyebilirsin.

### Soru 2: Dosyalar nerede saklanıyor?

**Cevap:** Cloudinary'in sunucularında. Ücretsiz hesapta 25GB depolama alanın var. Dosyalar `updates` klasöründe saklanıyor (eğer preset'te folder belirttiysen).

### Soru 3: Video'lar gerçekten GIF gibi mi oynatılıyor?

**Cevap:** Evet! Cloudinary video URL'lerine `f_auto,fl_loop` parametreleri ekleniyor. Bu sayede video otomatik oynatılır, döngüye alınır ve kontroller görünmez (GIF gibi).

### Soru 4: Ücretsiz hesapta limit var mı?

**Cevap:** Evet, ücretsiz hesapta:
- **25GB depolama alanı**
- **25GB aylık bant genişliği** (download/stream)

Bu limitler çoğu proje için yeterli. Limit aşılırsa, o ay için ücretlendirilirsin.

### Soru 5: Dosya yükleme çalışmıyor, ne yapmalıyım?

**Kontrol listesi:**
1. ✅ Cloud Name doğru mu? (Settings'te kontrol et)
2. ✅ Upload Preset ismi doğru mu? (Settings > Upload > Upload presets'te kontrol et)
3. ✅ Upload Preset "Unsigned" mı? (Settings > Upload > Upload presets'te kontrol et)
4. ✅ Admin panelde bilgiler doğru girilmiş mi? (Sistem Ayarları'nda kontrol et)
5. ✅ Tarayıcı konsolunda hata var mı? (F12 > Console'da kontrol et)

---

## 🎉 Tamamlandı!

Artık Cloudinary kullanmaya hazırsın! 

**Özet:**
- ✅ Hesap oluşturdun
- ✅ Cloud Name'i buldun
- ✅ Upload Preset oluşturdun
- ✅ Admin panelde bilgileri girdin
- ✅ Test ettin ve çalıştığını gördün

**Sonraki adım:** Güncellemelerinde dosya yüklerken artık Cloudinary kullanıyorsun! 🚀
