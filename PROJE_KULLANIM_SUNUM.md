# Barcode – Ürün Barkod Arama Sistemi | Kullanım Kılavuzu ve Sunum Dokümanı

Bu doküman, **Barcode** projesinin baştan sona nasıl kullanıldığını anlatır. Sunum hazırlığı veya Notebook LM ile sunum üretmek için kullanılabilir.

---

## 1. Proje Özeti

**Barcode**, Getir franchise depoları ve benzeri işletmeler için tasarlanmış bir **ürün barkod arama ve stok sayım** sistemidir.

- **Giriş:** Kullanıcı adı ve şifre ile giriş; test süresi (trial) ekranda gösterilir.
- **Ana sayfa:** Ürün arama (isim veya barkod), sonuçlarda barkod/ürün adı kopyalama.
- **Sayım:** Premium özellik; fiziksel sayım ile sistem stokunu karşılaştırma, çoklu sayım tabloları.
- **İletişim:** Giriş yapmadan veya giriş yapmış herkes sağ alttaki **Destek Sohbeti** ile sizinle iletişime geçebilir.
- **Premium özellikler:** Ayarlar içinden yönetilir; klavye kısayolları, toplu kopyalama, stok sayımı, otomatik yapıştır, görsel link arama vb.

---

## 2. Giriş Sayfası

### 2.1 Erişim ve Görünüm

- Sitenin ana adresinde giriş sayfası açılır.
- Koyu barkod temalı arka plan, ortada giriş kartı, üstte logo ve **Destek** / **Hakkımızda** linkleri.

### 2.2 Giriş Yapma

1. **Kullanıcı adı** ve **şifre** girilir.
2. **Giriş Yap** butonuna tıklanır.
3. Başarılı girişte kullanıcı bilgisi gösterilir; **Uygulamaya Git** ile ana sayfaya yönlendirilir.

### 2.3 Hata Durumları

- **Yanlış kullanıcı adı veya şifre:** Kırmızı hata mesajı gösterilir.
- **Giriş yapılamıyorsa:** Destek sohbeti ile iletişime geçmeleri gerekir.
- **Test süresi bitmişse:** İlgili mesaj gösterilir; destek ile iletişim önerilir.

### 2.4 Hesabı Olmayan veya Destek İsteyen Kullanıcılar

- **“Bize Ulaşın”** (giriş kartının altında): Tıklanınca **Destek Sohbeti** açılır; hesap açmadan mesaj yazılabilir.
- **“Destek Alın”** (sayfanın altında) ve üstteki **Destek** linki: Aynı şekilde sohbeti açar.

Böylece **giriş yapmamış kullanıcılar da** sağ alttaki sohbet ile sizinle iletişime geçebilir.

---

## 3. Ana Uygulama Sayfası (Ürün Arama)

### 3.1 Sayfaya Giriş

- Giriş sonrası **Uygulamaya Git** ile ana sayfaya geçilir.
- Üst kısımda: Logo, kullanıcı bilgisi, **test süresi**, Ayarlar, Çıkış, **Sayım Sayfası** (premium kullanıcılarda görünür). Ürün ekleme şu an sadece yönetici tarafından yapılmaktadır; kullanıcılar arama yapıp sonuçlardan kopyalayabilir.

### 3.2 Arama Bölümü – Nerede ve Nasıl Aranır?

- **Konum:** Sayfanın ortasında, “Ürün Arama” başlıklı kutu.
- **Arama kutusu:**
  - Placeholder: “Ürün adını yazın veya tablo verisi yapıştırın... (örn: Nesfit, Coca Cola)”.
  - **Ürün adı** ile arama: Tek terim veya virgülle ayrılmış birden fazla terim.
  - **Barkod** ile arama: Barkod numarası yazılabilir.
  - **Tablo verisi:** Arama kutusuna tablo formatında veri yapıştırılarak arama yapılabilir.
- **İpuçları (kutunun altında):**
  - Virgülle birden fazla terim arayabilirsiniz.
  - Türkçe karakterler desteklenir.
  - Tablo formatında veri yapıştırılabilir.
- **Butonlar:**
  - **Panodan yapıştır** (arama kutusunun sağında): Panodaki metni arama kutusuna yapıştırır.
  - **Temizle (X):** Arama metnini siler, sonuçları gizler.

### 3.3 Arama Sonuçları

- **Liste / Grid görünümü:** Üstte “Liste” ve “Grid” butonları ile geçiş.
- **Liste görünümü:** Tablo – Ürün Adı, Barkod Bilgileri, Raf Konumu, Stok.
- **Grid görünümü:** Kartlar halinde ürünler; görsel, isim, barkodlar.
- **Kopyalama:**
  - Ürün adına veya barkoda tıklanarak **tek barkod/ürün adı** panoya kopyalanır; “Kopyalandı” bildirimi çıkar.
- **Stok:** Sonuçlarda stok bilgisi gösterilir (varsa).

### 3.4 Üst Bar (Header) ve Mobil Menü

- **Masaüstü:** Sayım Sayfası (premium’da), test süresi (gün • saat), Kullanıcı adı / Şirket, Ayarlar, Çıkış.
- **Mobil:** Hamburger menü; açılınca aynı işlevler ve kullanıcı bilgisi + **test süresi** gösterilir.

### 3.5 Trial (Test) Süresi – Nerede Görünür?

- **Header’da:** “X gün • Y saat” şeklinde kalan test süresi.
- **Mobil menüde:** Kullanıcı adı ve şirket altında aynı süre.
- **Trial Banner:** Ana içerikte bazen büyük bir banner; “Test süreniz X gün Y saat sonra bitiyor” veya “Son X saat/dakika” uyarıları (süreye göre renk değişir: mavi, sarı, kırmızı).
- **Süre dolunca:** “Test süreniz doldu! Lütfen destek ile iletişime geçin.” mesajı; destek sohbeti ile iletişim kurulması gerekir.

---

## 4. Ayarlar

### 4.1 Ayarların Açılması

- **Ayarlar** butonuna (header veya mobil menüden) tıklanır.
- Modal açılır: Genel ayarlar, **Premium Özellikler** listesi, Güncelleme Geçmişi (Changelog) butonu.

### 4.2 Genel Ayarlar (Ayarlar Modalı İçinde)

- **Veri güncelleme:** Yenile, Analiz, Temizle butonları (veri yenileme ve tekrarları temizleme için).

### 4.3 Premium Özellikler Listesi (Ayarlar İçinde)

Her satırda: Özellik adı, açıklama, **Açık/Kapalı** toggle (premium açıksa). Bazılarında ek **Yönet** / **Sayım Sayfası** butonu vardır.

| Özellik | Kısa Açıklama | Kullanım |
|--------|----------------|----------|
| **Otomatik Yapıştır** | Kopyalanan ürün adı/barkod sayfaya dönünce arama kutusuna yapışır | Toggle ile aç/kapa; terminalden kopyalayıp sayfaya gelince otomatik arama kutusunda olur |
| **Klavye Kısayolları** | Tuş atayarak ürünlere hızlı erişim | Toggle + **Yönet** ile modal açılır; kısayol ekle/düzenle/sil, limit var |
| **Toplu Kopyalama** | Birden fazla barkodu tek seferde kopyala | Premium açıksa sonuçlarda çoklu seçim ve toplu kopyalama |
| **Görsel Link Arama** | HTML tablolardan görsel linklerini çıkarıp görsele göre arama | Bookmarklet kurulumu; Getir warehouse sayfasında kullanım talimatı modalda |
| **Stok Sayımı** | Sayım sayfası + eklenti araçları | Toggle + **Sayım Sayfası** butonu; modalda “Sayım Sayfasına Git” ve **Chrome/Edge eklentisi** indirme/kurulum adımları |
| **Karanlık Mod / Çevrimdışı / Gelişmiş Filtreler / Sınırsız Geçmiş / Favoriler** | Diğer premium özellikler | Liste halinde; kilidi açıksa toggle, değilse “KİLİTLİ” ve “Bizimle iletişime geçin” |

### 4.4 Premium Özelliğe Tıklayınca (Detay Modalı)

- Özelliğe tıklanınca **Premium Özellik Detay** modalı açılır.
- **Aktif** ise: “Bu özelliğe erişiminiz var”, ayarları yukarıdan yapın.
- **Kilitli** ise: “Premium üyeler için; lütfen bizimle iletişime geçin” – iletişim yolu **Destek Sohbeti** (sağ alttaki sohbet).

### 4.5 Kalan Süre ve İletişim (Ayarlar Bağlamında)

- **Kalan süre:** Ayarlar modalında değil; header ve mobil menüde + isteğe bağlı trial banner’da gösterilir (yukarıda anlatıldı).
- **İletişim:** Ayarlar içinde ayrı “iletişim formu” yok; tüm “bizimle iletişime geçin” ifadeleri **Destek Sohbeti** ile çözülür (giriş yapmadan da kullanılabilir).

---

## 5. Premium Özellikler – Detaylı Kullanım

### 5.1 Otomatik Yapıştır (autoPaste)

- **Amaç:** Başka sekme/uygulama (örn. terminal) veya bu siteden kopyalanan barkod/ürün adı, kullanıcı bu sayfaya geri döndüğünde **arama kutusuna otomatik yapışır**.
- **Kullanım:** Ayarlar → Premium Özellikler → Otomatik Yapıştır toggle’ı açık olsun. Sayfadan çıkıp panoya bir şey kopyalayıp geri dönünce arama kutusunda görünür.

### 5.2 Klavye Kısayolları (keyboardShortcuts)

- **Amaç:** Belirli bir tuş veya tuş kombinasyonuna (örn. Ctrl+1) bir veya birden fazla ürünün barkodunu bağlamak; basınca bu barkodlar arama/akışta kullanılabilir veya arama çubuğuna odaklanır.
- **Ayar:** “Arama çubuğuna odaklan” – Açıksa kısayol basıldığında imleç arama kutusuna gider; kapalıysa peş peşe farklı kısayollar kullanılabilir.
- **Kullanım:**
  1. Ayarlar → Klavye Kısayolları → **Yönet**.
  2. **Yeni kısayol:** “Klavye tuşu/kombinasyonu” alanına tıklayıp tuşa basın (Ctrl, Alt, Shift desteklenir).
  3. Ürün seçimi: Açılan listeden ürünleri seçin (tek veya çoklu); bu barkodlar o kısayola bağlanır.
  4. **Kısayol Ekle** ile kaydedin.
  5. Liste görünümünde her kısayol için: **Açık/Kapalı** toggle, **Düzenle**, **Sil**.
  6. **Limit:** Premium’da kısayol sayısı sınırlı olabilir (örn. 3 veya 5); limit aşılırsa uyarı verilir.

### 5.3 Toplu Kopyalama (bulkCopy)

- **Amaç:** Birden fazla ürünün barkodunu seçip **tek seferde** panoya kopyalamak (terminalde toplu okutma vb. için).
- **Kullanım:** Premium açıksa, arama sonuçlarında ürünleri işaretleyip “Toplu kopyala” benzeri aksiyonla tüm seçilen barkodlar panoya alınır (arayüzdeki ilgili buton/onay ile).

### 5.4 Görsel Link Arama (imageSearch)

- **Amaç:** HTML tablolardan görsel URL’lerini çıkarıp, görsel linkine göre ürün aramak.
- **Kullanım:** Ayarlar → Görsel Link Arama’ya tıklayınca modalda **Getir Kısayol** bookmarklet kurulumu anlatılır; Getir warehouse sayfasında kullanılır, kopyalama sonrası isteğe bağlı bu siteye yönlendirme.

### 5.5 Stok Sayımı (stokSayimi) – Sayfa + Eklenti

- **Sayfa:** Ayarlar → Stok Sayımı → **Sayım Sayfası** veya üst bardaki **Sayım Sayfası** butonu ile sayım sayfası açılır.
- **Eklenti (Chrome/Edge):**
  - Modalda “Chrome/Edge Eklentisi Gerekli” bölümü; **Eklentiyi ZIP olarak indir** linki.
  - Kurulum: ZIP’i indirip çıkarın → Tarayıcıda uzantılar sayfasına gidin → Geliştirici modu aç → Paketlenmemiş uzantı yükle → Çıkardığınız eklenti klasörünü seçin.
  - Eklenti, Getir franchise stok sayfası açıkken stok bilgisini alır; sayım sayfasında “Senkronize Et” ile sistem stokları güncellenir.

---

## 6. Stok Sayım Sayfası – Baştan Sona

### 6.1 Erişim ve Yetki

- Sadece **Stok Sayımı** premium özelliği açık kullanıcılar sayım sayfasına erişebilir.
- Ana sayfadan **Sayım Sayfası** butonu ile sayım sayfasına gidilir.

### 6.2 Üst Bar (Header)

- **Geri:** Ana sayfaya (product_search) dönüş.
- **Tablo seçici:** Açılır liste – “Ana Sayım”, “Bölge A” vb. mevcut sayım tabloları; seçilen tablo aktif olur.
- **Tablo yönetimi:** Yeniden adlandır (✏️), Yeni tablo (➕), Tablo sil (🗑️).
- Sağda: Kullanıcı adı, şirket, **Çıkış**.

### 6.3 İstatistik Kartları

- **Toplam Sayılan:** Sayım tablosundaki ürün sayısı.
- **Fazla Ürün:** Depo stoku > sistem stoku olan kalem sayısı.
- **Eksik Ürün:** Depo stoku < sistem stoku olan kalem sayısı.

### 6.4 Bağlantı Durum Kartı (Getir Eklentisi Kullanılıyorsa)

- **Gösterim:** Bağlantı durumu, depo bilgisi, kalan süre ve son kullanma tarihi.
- **Yenile** butonu: Getir sayfasında oturum açıkken tıklanarak bilgiler yenilenir.

### 6.5 Senkronizasyon Bölümü

- **Senkronize Et:** Sayımda olan ürünler için **sistem stoklarını** Getir üzerinden çeker; depo stoku girilmiş ürünlerin sistem stoku sütunu güncellenir (eklenti kurulu ve Getir sayfası açık olmalı).
- **Depo Stoklarını Sıfırla:** Mevcut tablodaki tüm depo stoku değerlerini sıfırlar (onay gerekir).
- **Sistem Stoklarını Sıfırla:** Sistem stoku sütununu temizler (onay gerekir).

### 6.6 Ürün Ekleme (Sayım İçine)

- **Manuel giriş:** “Ürün adı, barkod veya gram değeri girin...” alanına yazın; açılan öneri listesinden ürün seçilir veya Enter ile ilk eşleşme eklenir.
- **Ekle:** Seçilen/aranan ürünü sayım tablosuna ekler.
- **Ara:** Ürün arama modalı açar; arama yapıp ürün seçilerek eklenir.
- **Kamera:** Barkod tarayıcı açar; kameradan barkod okutulup ürün bulunur ve eklenir.

### 6.7 Ürün Listesi – Tablo ve Kart Görünümü

- **Masaüstü:** Tablo – Görsel, Ürün Adı (barkodlar), **Depo Stoku** (artı/eksi veya sayı girişi), **Sistem Stoku** (Getir’den veya “Getir” butonu ile), **Fark**, Tarih/Saat, İşlemler (sil).
- **Mobil/tablet:** Kart görünümü – aynı alanlar kart içinde; depo stoku +/- butonları, sistem stoku ve yenile, fark rozeti, **Ürünü Sil**.
- **Depo stoku:** +/- ile veya doğrudan sayı yazarak güncellenir.
- **Sistem stoku:** “Getir” / yenile ile tek ürün için stok çekilir; başarısızsa “Bulamadım” gösterilir.
- **Fark:** Depo − Sistem; yeşil (fazla), kırmızı (eksik), gri (eşit). Sütun başlıklarına tıklayarak sıralama yapılabilir.

### 6.8 Sayım Eklentisi (Getir Stok Senkronizasyonu)

- **Ne işe yarar:** Getir franchise stok sayfası açıkken stok bilgisini alır; sayım sayfasında “Senkronize Et” veya tek ürün “Getir” ile sistem stokları güncellenir.
- **Kurulum:** Ayarlar → Stok Sayımı modalından eklentiyi ZIP olarak indirip tarayıcı uzantılar sayfasından yükleyin.
- **Kullanım:** Kullanıcı Getir franchise stok sayfasını açtığında eklenti bilgiyi kaydeder. Süre dolduğunda Getir’de sayfayı yenilemek veya tekrar giriş yapmak gerekebilir.

---

## 7. İletişim – Destek Sohbeti (Hesap Açmadan veya Açık)

### 7.1 Nerede Görünür?

- **Giriş sayfasında:** “Destek”, “Bize Ulaşın”, “Destek Alın” tıklanınca sohbet açılır.
- **Ana sayfa ve sayım sayfasında:** Sağ alt köşede **sabit sohbet butonu** (yuvarlak, mavi-mor); tıklanınca sohbet paneli açılır.

### 7.2 Giriş Yapmadan Kullanım

- Giriş yapmamış kullanıcı sohbeti açar ve mesaj yazar; mesajlar size ulaşır.
- Böylece **hesap açmadan da** kullanıcılar sizinle iletişime geçebilir.

### 7.3 Giriş Yapmış Kullanıcı

- Mesajlar kullanıcı hesabına bağlı saklanır; geçmiş yüklenir, yeni mesajlar anında görünür.
- Tarih ayraçları: Bugün, Dün, gün adı veya tam tarih.

### 7.4 Özet

- **“Benimle nasıl iletişime geçebilirler?”** → Her zaman sağ alttaki **Destek Sohbeti**. Giriş yapmasalar bile sohbeti açıp yazabilirler. Giriş sayfasındaki “Bize Ulaşın” ve “Destek Alın” da aynı sohbeti açar.

---

## 8. Klavye Kısayolları – Özet

- **Yönetim:** Ayarlar → Premium Özellikler → Klavye Kısayolları → **Yönet**.
- **Ekleme:** Tuş/kombinasyon girilir (Ctrl/Alt/Shift + tuş), ürünler seçilir, “Kısayol Ekle”.
- **Düzenleme/Silme:** Listeden düzenle veya sil.
- **Limit:** Premium plana göre maksimum kısayol sayısı (örn. 3 veya 5).
- **Engelli tuşlar:** Tarayıcı kısayolları (Ctrl+T, Ctrl+N vb.) kullanılamaz; uyarı verilir.

---

## 9. Toplu Kopyalama – Özet

- **Amaç:** Birden fazla ürünün barkodunu tek seferde panoya almak.
- **Koşul:** Premium’da “Toplu Kopyalama” açık olmalı.
- **Akış:** Arama sonuçlarında veya ilgili listede ürünleri işaretle → “Toplu kopyala” / benzeri aksiyon → seçilen barkodlar panoya kopyalanır (satır sonu veya virgülle ayrılmış format, arayüze göre değişir).

---

## 10. Ürün Ekleme

- **Ürün ekleme** şu an sadece **yönetici** tarafından yapılmaktadır. Kullanıcılar ana sayfada sadece arama yapıp sonuçlardan barkod veya ürün adı kopyalayabilir.
- **Görsel link arama** (premium): Bookmarklet ile görsel üzerinden ürün eşleştirme; ayarlardaki Görsel Link Arama detayında anlatılır.

---

## 11. Diğer Kısa Notlar

- **Sürüm:** Footer’da versiyon numarası gösterilir.
- **Güncelleme geçmişi:** Ayarlar penceresinde “Güncelleme Geçmişi” butonu ile açılır.

---

## 12. Notebook LM İçin Önerilen Kaynak Dosyalar

Sunumu Notebook LM ile üretirken aşağıdaki dosyaları **kaynak** olarak yüklemeniz, daha tutarlı ve detaylı bir sunum çıktısı verir.

### Önerilen kaynaklar

1. **PROJE_KULLANIM_SUNUM.md** (bu dosya) – Ana kullanım ve sunum metni.
2. **README.md** – Proje tanımı ve özellikler.
3. **SAYIM_SAYFASI_TASARIMSAL_OZET.md** – Sayım sayfası arayüzü.
4. **getir-stock-sync-extension/README.md** – Eklenti kurulumu (kullanıcı diline uygun bölümler).

Bu dosyayı Notebook LM’e kaynak olarak ekleyerek kullanım sunumu üretebilirsiniz.

---

*Son güncelleme: Proje kullanım kılavuzu – sunum ve Notebook LM kaynağı.*
