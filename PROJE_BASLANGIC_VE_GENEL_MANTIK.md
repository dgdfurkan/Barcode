# 🚀 Barcode SaaS – Proje Başlangıç Dokümanı

> **Bu doküman**, projeye yeni başlıyormuş gibi bir Cursor penceresinde kullanılmak üzere hazırlanmıştır.  
> Genel mantık, tanımlar ve zaman çizelgesi burada toplanmıştır. İstediğin kısımları doğrudan kopyalayıp diğer sohbete yapıştırabilirsin.

---

## 📅 Şu anki durum

- **Bugün:** Projenin **1. günü**
- **Aşama:** **Planlama** – henüz kod yazmıyoruz, mimari ve süreç netleştiriliyor
- **Hedef süre:** Yaklaşık **1,5 ay** (6 hafta) içinde MVP’yi tamamlamış gibi ilerleyeceğiz

---

## 📌 Genel tanımlar

| Terim | Açıklama |
|-------|----------|
| **Barcode SaaS** | Barkod / ürün arama odaklı, abonelik/test süreli bir web uygulaması. Kullanıcı girişi, IP kısıtı, trial süresi yönetimi var. |
| **Product Search System** | Giriş sonrası ana ekran: ürün arama, barkod okuma, ürün listesi. Kullanıcı verisi Supabase + isteğe göre local ile tutuluyor. |
| **Admin paneli** | Kullanıcı ekleme/düzenleme, trial uzatma, IP whitelist, mesajlar, basit loglar. `admin.html` ve ilgili JS. |
| **Sayım modülü** | Stok sayımı: fiziksel sayım verisi girilir, sistem stoku ile karşılaştırılır, farklar raporlanır. Premium özellik. |
| **Auth** | Username/password, IP kontrolü, trial bitiş tarihi. Local + Supabase ile kullanıcı ve oturum yönetimi. |
| **Supabase** | Backend: kullanıcılar, user_data, mesajlar, sayım verisi, IP logları vb. |
| **Getir entegrasyonu** | Ayrı bir Python/extension tarafı: Getir API ile stok/sayım verisi. Bu doküman daha çok “web uygulaması” tarafını anlatır. |

---

## 🧭 Projenin genel mantığı ve süreci

1. **Giriş (index.html)**  
   Kullanıcı adı/şifre → IP kontrolü → trial kontrolü → başarılıysa `product_search.html` veya ilgili sayfaya yönlendirme.

2. **Ana uygulama (product_search.html)**  
   Ürün arama, barkod, listeler. Sayım sayfasına geçiş (premium kontrolü ile). Kullanıcı verisi Supabase/local’de.

3. **Sayım (pages/counting.html)**  
   Sayım tabloları, sayılan miktar girişi, sistem stoku ile karşılaştırma, fark raporu. Supabase’de sayım verisi.

4. **Admin (admin.html)**  
   Sadece admin kullanıcılar. Kullanıcı CRUD, trial, IP, mesajlar, loglar.

5. **Güvenlik**  
   IP whitelist, trial_end, CORS, mümkünse rate limit. Şifreler hash’lenmiş/saklı, token’lar güvenli kullanılacak.

---

## 📂 Klasör ve dosya mantığı (özet)

- **`index.html`** – Giriş sayfası  
- **`admin.html`** – Admin paneli  
- **`pages/product_search.html`** – Ana ürün arama sayfası  
- **`pages/counting.html`** – Stok sayım sayfası  
- **`js/`** – auth, admin, user-manager, counting, barcode-scanner, premium vb.  
- **`css/`** – main.css, tailwind  
- **`sql_files/`** – Supabase şema, migrations  
- **`supabase/`** – Edge functions (ör. telegram-notify)  
- **`getir-*` / `TelgramGetirStock/`** – Getir API / Telegram bot tarafı (ayrı modül)

---

## ⏱️ Zaman çizelgesi (1,5 ay – 6 hafta)

Planlama, sanki projeyi 1,5 ayda bitiriyormuşuz gibi ilerlemek için kullanılacak.

| Hafta | Odak | Beklenen çıktı (kavramsal) |
|-------|------|----------------------------|
| **1. Hafta** | Temel arayüz ve giriş | Giriş sayfası taslağı, basit layout, renk/font. Çalışmasa da “ekran tasarımı” seviyesinde arayüz. |
| **2. Hafta** | Auth ve ana sayfa iskeleti | Login mantığı (mock da olabilir), giriş sonrası ana sayfa iskeleti, menü/navigasyon. |
| **3. Hafta** | Ürün arama ve liste | Arama alanı, ürün listesi (statik/demo veri), barkod alanı (UI). |
| **4. Hafta** | Sayım ekranı taslağı | Sayım sayfası layout’u, tablo/ kart yapısı, “sayılan / fark” alanları (veri bağlanmasa da olur). |
| **5. Hafta** | Admin paneli ve veri | Admin sayfası, kullanıcı listesi/formları, trial/IP alanları. Supabase veya mock. |
| **6. Hafta** | Entegrasyon ve sadeleştirme | Sayfalar arası geçiş, trial/premium kontrolü, temel güvenlik (IP/token) ve polish. |

Bu çizelge “şu an 1. haftadayız, arayüz yap” gibi cümlelerde referans olarak kullanılacak.

---

## 🛠️ Teknik stack (hedef)

- **Frontend:** HTML5, CSS3, Tailwind CSS, vanilla JS (isteğe göre ileride framework).  
- **Backend / DB:** Supabase (auth, tables, storage, edge functions).  
- **Giriş:** Custom auth (username/password + IP + trial), token/session.  
- **Dağıtım:** Static hosting (GitHub Pages, Vercel, Netlify vb.).

---

## 📋 Diğer Cursor sohbetinde nasıl kullanılır?

1. **Yeni bir Cursor penceresi** aç.  
2. Bu dosyayı (`PROJE_BASLANGIC_VE_GENEL_MANTIK.md`) veya ihtiyacın olan bölümleri **kopyala-yapıştır** yap.  
3. Talep örnekleri:  
   - *“Kanka bak 1. haftaya gelmişiz; bize giriş sayfası ve genel arayüz iskeletini yap. Çalışmasa da olur, taslak olsun.”*  
   - *“2. haftadayız, auth ve ana sayfa iskeletini çıkar.”*  
   - *“4. hafta sayım ekranı – tablo ve kartlar olsun, veri bağlama zorunlu değil.”*  
4. Bu dokümandaki **Genel tanımlar** ve **Zaman çizelgesi** tablosu, o sohbette “proje nedir, hangi haftadayız” sorusuna cevap olacak.

---

## ✅ Özet

- **Bugün:** 1. gün, planlama.  
- **Amaç:** 1,5 aylık süreci haftalara bölüp, her hafta için arayüz/modül taslağı çıkarmak; gerektiğinde “çalışmasa bile” önce görünür iskelet, sonra mantık.  
- **Ne verirsen buraya yaz:** Bu dokümana ek tanım, haftalık görev veya ekran listesi eklersen, aynı metni diğer Cursor sohbetine aynen yapıştırabilirsin; tutarlı bir başlangıç bağlamı oluşur.

---

*Son güncelleme: Proje 1. gün – planlama aşaması.*
