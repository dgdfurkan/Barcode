---
name: hareket
description: Jet Barkod'da animasyon ve geçiş yazar. Panel açılışı, kart girişi, liste sıralaması, modal, iskelet yükleme, sürükleme jesti, ilerleme çubuğu, durum değişimi ya da mikro etkileşim eklenirken; "animasyon kasıyor", "geçiş kötü", "zıplıyor", "swipe bozuk" geri bildirimi geldiğinde kullanılır. Süre, eğri, hangi özelliğin animate edileceği ve azaltılmış hareket desteğini projenin motion.css token'ları üzerinden belirler.
---

# Hareket

Projede `css/motion.css` doğru bir hareket sistemi kuruyor. Ama `css/siparisler.css`
bundan habersiz: kendi `--yay` değişkenini tanımlamış ve süreleri satır içine yazmış.

```bash
grep -oE 'transition:[^;]+' css/siparisler.css | grep -oE '[0-9.]+m?s' | sort | uniq -c | sort -rn
```

Bugünkü sonuç: `0.18s`, `0.16s`, `0.15s`, `0.14s`, `0.2s`, `0.22s`, `0.35s`, `0.38s`,
`120ms`. Dokuz farklı süre, hiçbiri token'dan gelmiyor. Projede ayrıca **103 `@keyframes`** var.

İki rakip sistem, ikisi de yarım. Aynı jest bir ekranda 140ms, diğerinde 180ms sürüyor
ve arayüz tek bir el tarafından yapılmamış gibi hissettiriyor.

**Tek kaynak `motion.css`.**

## Öncelik sırası

| # | Alan | Etki | Zorunlu | Yapma |
|---|---|---|---|---|
| 1 | Azaltılmış hareket | KRİTİK | `prefers-reduced-motion` her animasyonda karşılanır | Hepsini `transition: none` yapıp geçmek |
| 2 | Animate edilen özellik | KRİTİK | Yalnız `transform` ve `opacity` | `width`, `height`, `top`, `left`, `margin` |
| 3 | Kayma ve zıplama | KRİTİK | Animasyon yerleşimi değiştirmez | `display` geçişine güvenmek |
| 4 | Token'dan süre ve eğri | YÜKSEK | Dört süre, üç eğri; hepsi `motion.css`'ten | Satır içi süre yazmak, yeni eğri uydurmak |
| 5 | Jest yön kilidi | YÜKSEK | Yatayda `dx > dy * 1.7`, `passive: false` | Çapraz hareketi yatay saymak |
| 6 | Sıralı giriş sınırı | ORTA | Gecikme 30-60ms, üst sınır zorunlu | Yirminci karta 600ms gecikme vermek |
| 7 | Gereksiz hareket | ORTA | Sık tekrarlanan işlemde animasyon yok | Her tike 200ms animasyon koymak |

## Süre

Süreyi hisse göre değil, **kat edilen mesafeye** göre seç.

| Token | Süre | Nerede |
|---|---|---|
| `--motion-micro` | 100ms | Renk, opaklık, kenarlık. Yer değiştirmeyen her şey |
| `--motion-fast` | 140ms | Küçük hareket: düğme basılması, onay tiki, rozet |
| `--motion-normal` | 180ms | Kart girişi, satır açılması, açılır menü |
| `--motion-panel` | 220ms | Ekranı kaplayan panel, modal, tam sayfa geçiş |

**Çıkış girişten hızlıdır.** Kullanıcı gitmeye karar vermiştir. Giriş `--motion-normal`
ise çıkış `--motion-fast` olur.

**500ms üstü yok.** Tek istisna kasıtlı, tek seferlik kutlama.

## Eğri

Üç durum, üç eğri. Karıştırma.

| Durum | Eğri | His |
|---|---|---|
| Ekrana giren | `--motion-ease-out` | Hızlı başlar, yavaşlayarak oturur |
| Ekrandan çıkan | `ease-in` → `cubic-bezier(0.4, 0, 1, 1)` | Yavaş başlar, hızlanarak gider |
| Yerinde değişen | `--motion-ease-standard` | Simetrik. Renk, yeniden sıralama, akordeon |

`siparisler.css` içindeki `--yay` de bir ease-out eğrisi ve fena değil. Yeni kodda
`--motion-ease-out` kullan; o dosyaya dokunuyorsan token'a geçir, ama toplu değiştirme
yapma, yalnız dokunduğun yeri düzelt.

## Neyi animate ediyorsun

Yalnız `transform` ve `opacity` ucuzdur. Sık yapılan hataların karşılığı:

| Yanlış | Doğru |
|---|---|
| `height: 0 → auto` | `grid-template-rows: 0fr → 1fr` ya da `transform: scaleY()` |
| `width` ile ilerleme çubuğu | `transform: scaleX()` + `transform-origin: left` |
| `top` / `left` ile kaydırma | `transform: translate()` |
| `margin` ile aralık açma | `transform: translateY()` |
| `display: none → block` | `opacity` + `visibility` |
| `box-shadow` animasyonu | İki katman, `opacity` ile çapraz geçiş |

`display` animate edilemez. Gizlemek için `visibility: hidden` kullan; bu öğeyi klavye
sırasından da çıkarır. `opacity: 0` çıkarmaz, gizli düğme hâlâ odaklanabilir kalır.

## Ne zaman animasyon yapma

En çok atlanan bölüm.

- **Sık tekrarlanan işlemde.** Depocu 40 ürünü tek tek işaretliyor. Her tikte 200ms
  animasyon 8 saniye eder. Burada `--motion-micro` renk geçişi yeter.
- **Veri yoklamasında.** Arka planda liste tazelenirken kartlar yeniden animasyonla
  girmemeli. Projede `kartImzasi` bunun için var: liste değişmediyse `sira` null geçilir.
  Bu kalıbı koru.
- **Hata mesajında.** Kullanıcı sorunu okumak istiyor, gösteriyi değil.
- **Kullanıcı çoktan karar vermişken.** Kapat düğmesine bastıysa panel gitmelidir.
- **Canlı sayaçta.** Yumuşatma yanlış değer okutur.

## Referanslar

- **Azaltılmış hareket doğru uygulaması ve sıralı giriş** için `references/teknik.md`.
- **Sürükleme jestleri** (yön kilidi, `passive: false`, hayalet tık) için
  `references/jestler.md`. Bu dosya siparişler sayfasındaki geri-kaydırma işinden çıktı,
  üçü de gerçek hataydı.
- **Ölçüm betikleri** (hangi öğe neyi animate ediyor, kare düşüyor mu) için
  `references/olcum.md`.

## Devretmedikleri

Ölçüm yöntemi ve kayma kanıtı `ui-dogrula`'da. Renk, boyut, boşluk kararları
`arayuz-sistemi`'nde. Türkçe metin kuralları CLAUDE.md'de.
