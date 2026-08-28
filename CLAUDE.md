# Jet Barkod

Saf HTML + vanilla JS + derlenmiş Tailwind. React yok, derleme adımı yok, `npm run build` yok.
Dosyayı kaydet, sayfayı yenile, biter. Depo **herkese açık**.

---

## 1. Cevap kuralları

Uzun anlatım token yakıyor. Varsayılan biçim şu:

- **İş bitti raporu: en fazla 5 madde.** Ne değişti, nerede, hangi hata çıktı. Başka bir şey yok.
- Yaptığın işi **tekrar anlatma**. Kod zaten orada, commit mesajı zaten orada.
- "Şimdi şunu yapıyorum", "kontrol ediyorum", "bakıyorum" gibi ara anlatım **yazma**. Sessizce yap.
- Kod parçasını cevaba **yapıştırma**. Dosya ve satır ver: `js/foo.js:120`.
- Seçenek listesi sunma. Bir tanesini seç, tek cümleyle gerekçelendir, devam et.
- Tablo, başlık, kalın yazı ancak gerçekten okumayı kolaylaştırıyorsa.

**İstisna:** Kullanıcı "tart", "düşün", "analiz et", "nasıl yapalım" derse uzun yaz. Talep edilen düşünme işidir, orada kısalık zarar verir.

**Dil:** Düzgün Türkçe. Yapay zeka gibi yazma. **Uzun tire (—) asla kullanma.**

## 2. Araç disiplini

Token'ın çoğu araç çıktısında gidiyor, cevaplarda değil. Sıralama en pahalıdan ucuza:

**Ekran görüntüsü en pahalı araç.** Bir tanesi 2000 token. Görsel doğrulama için:

1. Önce `javascript_tool` ile **ölç**. Yükseklik, taşma, sınıf durumu, hesaplanmış stil hepsi sayı olarak gelir ve neredeyse bedavadır.
2. Ekran görüntüsünü **yalnızca** görsel yerleşim gerçekten gözle görülecekse al, o da **bir tane**.
3. Aynı ekranı iki kez çekme. Animasyon yüzünden kare kaçtıysa `wait` + tek çekim.
4. Toplu çekim yapma. Birden çok adımı `browser_batch` içinde çekmek yerine tek ölçüm betiği yaz.

**Dosya okuma:** 500 satırdan büyük dosyayı baştan sona okuma. `grep -n` ile yeri bul, `sed -n 'A,Bp'` ile o parçayı al.

**Düzenleme:** Çok yerde aynı değişiklik gerekiyorsa tek python betiği yaz, iddialı (`assert`) eşleştir. Ard arda on `Edit` çağırma.

**Doğrulama:** `node --check` yeter. Değiştirmediğin dosyayı tekrar okuma, düzenleme başarılıysa zaten yazılmıştır.

## 3. Yerleşik kararlar (bir daha sorma)

- Commit ve push'u **sen** yaparsın, onay isteme. Hesap `dgdfurkan`.
- API anahtarı, token, parola **hiçbir zaman** commit edilen dosyaya yazılmaz. Depo herkese açık.
- Premium kilidi admin kontrolünde: admin açarsa kullanılır, açmazsa kilitli görünür.
- Kullanıcıya gösterilen her metin Türkçe. Dosya ve klasör adları da Türkçe.
- Kayma, zıplama, boyut oynaması kabul edilmez. Ölç ve kanıtla.
- Dış CDN kullanma. Her şey yerelde: `js/vendor/`, `css/tailwind.build.css`.

## 4. Proje haritası

Aramadan önce buraya bak.

**Sayfalar** (`pages/`): `product_search.html` en büyüğü, ayarlar ve premium özellikler burada.
`counting.html` (v1), `counting_v2.html` (v2), `low_stock_products.html`, `shelf_missing.html`,
`dispatch_agenda.html`, `landing-scroll.html`. Kök dizinde `index.html` ve `admin.html`.

**Veri katmanı:** `js/jb-db.js` yerel PostgREST istemcisi. **Supabase kütüphanesi kaldırıldı**, geri getirme.
`js/db-config.js`, `js/vps-api-config.js`.

**Kimlik:** `js/auth.js`, `js/auth-token.js`, `js/user-manager.js`, `js/guest-access.js`.

**Premium:** `js/premium-features.js`, `js/feature-definitions.js`, `js/feature-manager.js`, `js/feature-checker.js`.
Özellik kartına tıklanınca açılan modal: `pages/product_search.html` içinde `showPremiumFeatureDetail`.

**Eklenti tanıtım ve kurulum sihirbazı:** `js/eklenti-rehberi.js` + `css/eklenti-rehberi.css`.
Ekran görüntüsü değil, satır içi SVG sahneler. Adımlar tek ızgara gözünde üst üste durur,
panel boyu hiçbir genişlikte oynamaz. Bu kuralı bozma.

**Chrome eklentileri** (kök dizin, hepsi MV3): `getir-warehouse-html-copy-extension` (Toplu Kopyalama),
`getir-stock-barcodes-extension` (Stok Barkodları), `getir-stock-sync-extension` (Sayım Hazırlığı, en büyüğü,
`webRequest` ile token yakalar), `getir-warehouse-orders-search-extension` (Sipariş İçi Ürün Arama),
`getir-low-stock-alert-extension`, `getir-warehouse-shelf-label-fetcher`, `getir-product-fetcher`.
Dağıtılan ZIP'ler `eklentiler/` altında, adları Türkçe.
Fırın Pişirme şu an yer imi: `eklentiler/firin-pisirme.js`.

**Sayfa başına eklenti çakışması:** franchise.getir.com'da 4, warehouse.getir.com'da 3,
jetbarkod.com.tr'de 3 eklenti aynı anda çalışıyor.

**Büyük dosyalar** (baştan sona okuma): `js/counting.js` 16k satır, `js/admin.js` 5k,
`admin.html` ve `pages/product_search.html` on binlerce satır.

**Yerel sunucu:** `.claude/launch.json` içinde `jetbarkod-static`, port 8899. `preview_start` ile aç.

## 5. Açık işler

- Tek eklenti birleştirme (`Jet Barkod Asistan`). Eskiler silinmeden, yanına. Sıra:
  Toplu Kopyalama, Stok Barkodları, Fırın, Sipariş Arama, Düşük Stok, Sayım Hazırlığı.
- `getir-warehouse-shelf-label-fetcher` ve `getir-product-fetcher` gereksiz yere `https://*/*` istiyor.
  Tek sebebi `admin_panel_inject.js`. jetbarkod.com.tr ile sınırlandırılabilir.
- Site ile eklenti arasındaki `postMessage` çağrıları hedef kaynağı `'*'` veriyor. Kısıtlanmalı.
- `sql_files/security_02_drop_plaintext_password.sql` çalıştırılacak.
- VPS'te apt upgrade + reboot bekliyor.
