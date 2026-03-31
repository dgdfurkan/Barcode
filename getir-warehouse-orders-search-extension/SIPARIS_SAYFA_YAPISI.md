# Sipariş Sayfası Yapısı (warehouse.getir.com/dashboard/orders)

Bu doküman, **getir-warehouse-html-copy-extension** content.js kodundan çıkarılan DOM yapısıdır.  
Canlı sayfa bu oturumda açılamadığı için mevcut eklenti mantığına göre derlenmiştir.

---

## Sayfa ve URL

- **URL pattern:** `https://warehouse.getir.com/*/dashboard/orders`
- **Content script:** Sadece `pathname.includes('/dashboard/orders')` ise çalışır.

---

## Kullanılan bileşenler (Ant Design)

| Bileşen | Selector | Açıklama |
|--------|----------|----------|
| Modal (sipariş detayı) | `.ant-modal`, `.ant-modal-body`, `.ant-modal-content` | Siparişe tıklanınca açılan kutu |
| Tablo | `table`, `.ant-table`, `.ant-table-wrapper`, `.ant-table-container` | Ürün listesi tabloları |
| Satırlar | `.ant-row`, `.ant-col`, `tbody tr`, `.ant-table-row` | Ürün satırları |
| Açıklama alanları | `.ant-descriptions`, `.ant-descriptions-view`, `.ant-descriptions-row` | Ürün tablosu DEĞİL (müşteri/adres vb.) |

---

## Ürün tablosu vs diğer tablolar

- **Ürün tablosu:** `.ant-table-wrapper` / `.ant-table-container` içinde VEYA `.ant-row .ant-col` içinde; `.ant-descriptions` **içinde olmamalı**.
- **Ürün satırı (isProductRow):**
  - `.ant-descriptions` içinde olmamalı.
  - Hücre metinleri: "müşteri adı", "müşteri notu", "teslimat adresi", "adres açıklaması", "toplayıcı adı", "kurye adı", "poşet kullanımı", "durum", "lokasyonlar" vb. **içermemeli**.
  - Görsel: `img[src*="product"]` veya `.ant-image img` (getir/cdn-image.getir.com) olmalı.
  - En az bir hücre: ürün adı benzeri (2+ karakter, sadece rakam değil).

---

## Ürün satırından veri çıkarma (arama için)

- **Hücreler:** `tr.querySelectorAll('td')` → metin için `cell.textContent.trim()`.
- **Görsel:** `tr.querySelector('.ant-image img')` veya `img[src*="product"]` → `src` (gerekirse barkod/ID çıkarılabilir).

---

## Modal ve “içerik container”

- Sipariş detayı: `document.querySelector('.ant-modal')` → `querySelector('.ant-modal-body')` → içinde tablolar.
- Ürün listesi container: `findRowContainer()` mantığı — `.ant-row` içinde `table tbody tr` aranır; img veya “ürün adı” benzeri hücre olan row döner.

---

## MutationObserver kullanımı

- **Body:** `childList: true`, `subtree: true` — yeni `tr`, `table`, `.ant-modal-body`, `.ant-table-wrapper`, `.ant-modal-content` eklenince işlem yapılır.
- **Modal root:** `.ant-modal-root` veya `document.body` — `.ant-modal` eklendiğinde `processTables()` tetiklenir.

---

## Sipariş arama özelliği için çıkarımlar

1. **Sipariş listesi:** Sayfada muhtemelen bir liste/tablo (sipariş ID, tarih vb.); her satır/element tıklanınca modal açılıyor.
2. **İçerik:** Sipariş içeriği (ürünler) modal açıldığında DOM’da oluşuyor; sayfa yüklenirken tüm siparişlerin içeriği yok.
3. **Arama stratejisi:**
   - **A)** Kullanıcı arama yapınca: sayfadaki görünür siparişleri + açık modal’ı tara; VEYA
   - **B)** Sipariş listesindeki her siparişe sırayla tıklayıp (modal açılıp) ürünleri topla, index oluştur, sonra arama yap.
4. **Üst bar:** Header’a (veya sipariş listesinin hemen üstüne) eklenti ile bir arama input’u enjekte edilebilir; mevcut kod sayfa DOM’una dokunmadan sadece kendi buton/container’ını ekliyor.

---

Bu yapı, **sipariş düzeni / ürün arama** eklentisinin tasarımında referans olarak kullanılabilir.  
Canlı sayfada sen header’ı ve sipariş listesini kontrol edersen (hangi element’in “üst bar”, hangisinin sipariş satırı olduğu), bu doküman güncellenebilir.
