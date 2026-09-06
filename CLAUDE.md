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
- **Canlı panelden görülen hiçbir gerçek veri depoya yazılmaz.** Depo adı, müşteri,
  toplayıcı, kurye adı, sipariş kimliği, ürün kimliği, adres, lokasyon kodu ve depo
  kimliği dahil. Ekran çizerken canlı panele bakılır ama içine kurgusal veri yazılır.
  Depo herkese açık; bu bir kere sızarsa git geçmişinden de temizlemek gerekir.
- Kayma, zıplama, boyut oynaması kabul edilmez. Ölç ve kanıtla.
- Dış CDN kullanma. Her şey yerelde: `js/vendor/`, `css/tailwind.build.css`.

## 4. Proje haritası

Aramadan önce **kod hafızasına** sor, sonra buraya bak, en son dosya aç.

`kod-hafizasi` MCP (codebase-memory-mcp) depoyu bir bilgi grafiğine indeksledi:
5.4k düğüm, 20k kenar, proje adı `jetbarkod`. Amacı token yakmadan yer bulmak.

| Soru | Araç |
| --- | --- |
| Bu isim nerede tanımlı | `search_graph` |
| Bunu kim çağırıyor, bu neyi çağırıyor | `trace_path` |
| Şu satırları göster | `get_code_snippet` |
| Genel yapı, katmanlar, rotalar | `get_architecture` (`aspects: ["overview"]`) |
| Niye böyle yapılmış | `manage_adr` (`mode: "sections"`) |
| Dosya değişti mi, indeks bayat mı | `detect_changes` |

Kural: `grep -rn` ile depo taramadan önce `search_graph` denenir. 16k satırlık
`js/counting.js` içinde fonksiyon aramak için dosya açılmaz, grafik sorulur,
dönen satır aralığı `sed -n 'A,Bp'` ile okunur.

Mimari kararlar ADR'de duruyor (`manage_adr`). Kalıcı bir karar değiştiğinde
ADR de güncellenir, yoksa bir sonraki oturum eski kararla çalışır.

İndeks otomatik tazeleniyor; büyük yeniden düzenlemeden sonra
`index_repository` elle çalıştırılır.

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

**Tasarım kaynakları:** Renk, gölge ve font token'ları `css/siparisler.css` içindeki
`:root`'ta. Hareket token'ları `css/motion.css` içinde (`--motion-micro/fast/normal/panel`,
`--motion-ease-out/standard`). Yeni değer uydurulmaz, buradan seçilir.

## 5. Arayüz işlerinde skill sırası

Arayüze dokunan her işte üçü sırayla kullanılır:

1. **`arayuz-sistemi`** karar verir. Tipografi ölçeği, boşluk, yarıçap, renk, hiyerarşi,
   dört durum (yükleniyor/boş/hata/dolu), mobil dokunma hedefleri. "Çirkin oldu",
   "AI işi gibi" geri bildirimi geldiğinde de buradan başlanır.
2. **`hareket`** animasyonu yazar. Süre ve eğri `motion.css` token'larından seçilir,
   yalnız `transform` ve `opacity` animate edilir, azaltılmış hareket desteklenir.
   Sürükleme jesti kuralları (yön kilidi, `passive: false`, hayalet tık) burada.
3. **`ui-dogrula`** kanıtlar. Kayma, taşma, kırılma noktası ve animasyon fazı ölçümle
   doğrulanır. Ekran görüntüsü en son ve tek adet.

## 6. Açık işler

- Tek eklenti birleştirme (`Jet Barkod Asistan`). Eskiler silinmeden, yanına. Sıra:
  Toplu Kopyalama, Stok Barkodları, Fırın, Sipariş Arama, Düşük Stok, Sayım Hazırlığı.
- `getir-warehouse-shelf-label-fetcher` ve `getir-product-fetcher` gereksiz yere `https://*/*` istiyor.
  Tek sebebi `admin_panel_inject.js`. jetbarkod.com.tr ile sınırlandırılabilir.
- Site ile eklenti arasındaki `postMessage` çağrıları hedef kaynağı `'*'` veriyor. Kısıtlanmalı.
- `sql_files/security_02_drop_plaintext_password.sql` çalıştırılacak.
- VPS'te apt upgrade + reboot bekliyor.
