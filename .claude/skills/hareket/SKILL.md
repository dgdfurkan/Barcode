---
name: hareket
description: Jet Barkod'da animasyon ve geçiş yazar. Panel açılışı, kart girişi, liste sıralaması, modal, iskelet yükleme, sürükleme jesti, ilerleme çubuğu, durum değişimi ya da mikro etkileşim eklenirken; "animasyon kasıyor", "geçiş kötü", "zıplıyor", "swipe bozuk" geri bildirimi geldiğinde kullanılır. Süre, eğri, hangi özelliğin animate edileceği ve azaltılmış hareket desteğini projenin motion.css token'ları üzerinden belirler.
---

# Hareket

## Neden bu skill var

Projede `css/motion.css` zaten doğru bir hareket sistemi kuruyor:

```css
--motion-micro:  100ms;
--motion-fast:   140ms;
--motion-normal: 180ms;
--motion-panel:  220ms;
--motion-ease-out:      cubic-bezier(0.22, 1, 0.36, 1);
--motion-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
```

Ama `css/siparisler.css` bundan habersiz. Kendi `--yay: cubic-bezier(0.22, 0.8, 0.2, 1)`
değişkenini tanımlamış ve süreleri satır içinde yazmış. Ölç:

```bash
grep -oE 'transition:[^;]+' css/siparisler.css | grep -oE '[0-9.]+m?s' | sort | uniq -c | sort -rn
```

Bugünkü sonuç: `0.18s`, `0.16s`, `0.15s`, `0.14s`, `0.2s`, `0.22s`, `0.35s`, `0.38s`, `120ms`.
Dokuz farklı süre, hiçbiri token'dan gelmiyor. Üstelik projede **103 `@keyframes`** var.

İki rakip sistem, ikisi de yarım. Sonuç: aynı jest bir ekranda 140ms, diğerinde 180ms
sürüyor ve arayüz tek bir el tarafından yapılmamış gibi hissettiriyor.

**Bu skill tek kaynağı dayatır: `motion.css`.**

## 1. Kırmızı çizgiler

- **Süre uydurma.** Dört token var. Beşincisine ihtiyaç duyuyorsan animasyon yanlıştır.
- **`width`, `height`, `top`, `left`, `margin` animate etme.** Bunlar her karede yerleşim
  hesaplatır. Yalnız `transform` ve `opacity` animate edilir; ikisi de bileşik katmanda çalışır.
- **500ms üstü yok.** Kullanıcı beklemez, arayüzü yavaş sanır. Tek istisna kasıtlı olarak
  dikkat çeken tek seferlik kutlama.
- **Sonsuz döngü yalnız gerçek beklemede.** Yükleniyor göstergesi döner; "tamamlandı"
  ekranı dönemez. Bu kural `ui-dogrula` skill'inde de var.
- **Otomatik oynayan hareket, azaltılmış hareket ayarına saygı duyar.** İstisnasız.
- **Kayma, zıplama yok.** Animasyon yerleşimi değiştiriyorsa animasyon değil, hatadır.

## 2. Süre seçimi

Süreyi hisse göre değil, **kat edilen mesafeye** göre seç. Uzak yol daha uzun sürer,
yakın yol kısa. Doğal olan budur.

| Token | Süre | Nerede |
|---|---|---|
| `--motion-micro` | 100ms | Renk, opaklık, kenarlık. Yer değiştirmeyen her şey |
| `--motion-fast` | 140ms | Küçük hareket: düğme basılması, onay tiki, rozet belirmesi |
| `--motion-normal` | 180ms | Kart girişi, satır açılması, açılır menü |
| `--motion-panel` | 220ms | Ekranı kaplayan panel, modal, tam sayfa geçiş |

Kural: **çıkış girişten hızlıdır.** Kullanıcı gitmeye karar vermiştir, onu bekletme.
Giriş `--motion-normal` ise çıkış `--motion-fast` olur.

## 3. Eğri seçimi

Üç durum var, üçünün eğrisi farklı. Karıştırma.

**Ekrana giren şey: `--motion-ease-out`**
Hızlı başlar, yavaşlayarak durur. Nesne uzaktan gelip yerine oturuyormuş gibi hissettirir.
Panel açılışı, kart belirmesi, açılır menü.

**Ekrandan çıkan şey: `ease-in` (`cubic-bezier(0.4, 0, 1, 1)`)**
Yavaş başlar, hızlanarak gider. Kullanıcı gidişi izlemek zorunda kalmaz.

**Yerinde değişen şey: `--motion-ease-standard`**
Simetrik. Konum değiştirmeyen, yalnız hâl değiştiren öğe: renk geçişi, yeniden sıralanan
liste satırı, genişleyen akordeon.

`siparisler.css` içindeki `--yay: cubic-bezier(0.22, 0.8, 0.2, 1)` da bir ease-out eğrisi
ve fena değil. Yeni kodda `--motion-ease-out` kullan; o dosyaya dokunuyorsan `--yay`
yerine token'a geçir, ama tek seferde toplu değiştirme yapma, dokunduğun yeri düzelt.

## 4. Neyi animate ediyorsun

Yalnız bu ikisi ucuzdur:

```css
transform: translateX() translateY() scale() rotate();
opacity: 0 → 1;
```

Sık yapılan hataların doğru karşılığı:

| Yanlış | Doğru |
|---|---|
| `height: 0 → auto` | `grid-template-rows: 0fr → 1fr` ya da `transform: scaleY()` |
| `width` ile ilerleme çubuğu | `transform: scaleX()` + `transform-origin: left` |
| `top` / `left` ile kaydırma | `transform: translate()` |
| `margin` ile aralık açma | `transform: translateY()` ya da `gap` geçişi |
| `display: none → block` | `opacity` + `visibility`, `display` geçiş yapmaz |
| `box-shadow` animasyonu | Üst üste iki katman, `opacity` ile çapraz geçiş |

`display` özelliği animate edilemez. Gizlemek için `visibility: hidden` kullan; bu öğeyi
klavye sırasından da çıkarır. `opacity: 0` çıkarmaz, gizli düğme hâlâ odaklanabilir kalır.
Bu tuzağın ölçümü `ui-dogrula` skill'inde var.

## 5. Azaltılmış hareket

21 CSS dosyasında zaten var, sürdür. Ama doğru anlamıyla:

**"Azaltılmış hareket" hareketsiz demek değil.** Rahatsız eden şey yer değiştirme ve
ölçek değişimi; opaklık geçişi genelde güvenlidir ve arayüzün nefesini korur.

```css
@media (prefers-reduced-motion: reduce) {
    .sip-kart {
        animation: none;
        transition-property: opacity;   /* transform gider, opaklık kalır */
        transition-duration: var(--motion-fast);
    }
}
```

Hepsini `transition: none` yapmak kolaycılıktır ve arayüzü kırık hissettirir.

## 6. Sıralı giriş

Liste öğeleri aynı anda belirirse hareket gürültü olur. Sırayla gelirse göz akışı takip eder.

Projede bu zaten kurulu: `kartCiz` her karta `style="--i: 0..12"` yazıyor. CSS tarafı:

```css
.sip-kart--gir {
    animation: kartGir var(--motion-normal) var(--motion-ease-out) backwards;
    animation-delay: calc(var(--i) * 30ms);
}
```

**Gecikme 30-60ms arası olur.** Altında fark edilmez, üstünde liste yavaş açılıyormuş
gibi hissedilir. **Ve mutlaka üst sınır konur:** projede `Math.min(idx, 12)` var. Yirmi
siparişte yirminci kart 600ms beklerse kullanıcı arayüzün takıldığını sanır.

`backwards` dolgusu önemli: gecikme boyunca öğe ilk karede durur, aksi hâlde bir kare
görünüp kaybolur.

## 7. Sürükleme jestleri

Bu bölüm siparişler sayfasındaki geri-kaydırma işinden çıkarıldı. Üçü de gerçek hatalardı.

**Yön kilidi katı olmalı.** Yatay jest için `dx > dy` yetmez, çapraz hareket de tetikler.
Oran şart:

```js
if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.7) yon = 'x';
else { yon = 'y'; aktif = false; return; }   // dikeyse tamamen bırak, sayfa kaysın
```

Kilit kararı ilk 12-16px'de verilir. Daha erken verirsen parmak titremesi yanlış yön seçer.

**`passive: false` olmadan sayfa kaymasını durduramazsın.**

```js
el.addEventListener('touchmove', islev, { passive: false });
// ve yön 'x' iken:
if (e.cancelable) e.preventDefault();
```

`touchstart` ve `touchend` `passive: true` kalabilir; yalnız `touchmove` müdahale eder.

**Hayalet tıklama.** Dokunma bittikten sonra tarayıcı ~300ms içinde sentetik bir `click`
üretir. Jestle bir panel kapattıysan bu tık arkadaki öğeye düşer ve kullanıcının ilk
gerçek dokunuşu yutulur. Kullanıcı iki kez basmak zorunda kalır.

```js
document.addEventListener('click', (e) => {
    if (kapamaZamani && Date.now() - kapamaZamani < 350) {
        e.stopPropagation(); e.preventDefault(); kapamaZamani = 0;
    }
}, true);   // yakalama evresinde
```

**Parmak altında canlı takip.** Jest sırasında öğe parmakla birlikte hareket etmeli;
`transition: none` verilir, `touchend`'de geri açılır. Eşik geçilmediyse yumuşak geri
dönüş, geçildiyse aynı yönde dışarı çıkış.

**Eşik ekran genişliğinin dörtte biri ya da 70px, hangisi küçükse.** Sabit büyük eşik
küçük telefonlarda ulaşılamaz olur.

## 8. Ne zaman animasyon yapma

Bu en çok atlanan bölüm.

- **Sık tekrarlanan işlemde.** Depocu 40 ürünü tek tek işaretliyor. Her tikte 200ms
  animasyon 8 saniye eder. Burada `--motion-micro` renk geçişi yeter.
- **Veri yoklamasında.** Arka planda liste tazelenirken kartlar yeniden animasyonla
  girmemeli. Projede `kartImzasi` bunun için var: liste değişmediyse `sira` null geçilir
  ve giriş animasyonu çalışmaz. Bu kalıbı koru.
- **Hata mesajında.** Kullanıcı sorunu okumak istiyor, gösteriyi değil.
- **Kullanıcı çoktan karar vermişken.** Kapat düğmesine bastıysa panel gitmelidir.
- **Ölçüm göstergesinde.** Sayaç canlı sayıysa yumuşatma yapma, yanlış değer okutur.

## 9. Ölçüm

Ekran görüntüsü animasyonun yanlış karesini yakalar. Sayıyla bak.

**Hangi öğeler hareket ediyor, hangi eğriyle:**

```js
(() => {
  const kap = document.querySelector('.sip-detay') || document.body;
  return [...kap.querySelectorAll('*')]
    .map(e => ({ e, s: getComputedStyle(e) }))
    .filter(x => x.s.animationName !== 'none' || x.s.transitionDuration !== '0s')
    .slice(0, 20)
    .map(x => ({
      sinif: (x.e.getAttribute('class') || '').slice(0, 40),
      animasyon: x.s.animationName,
      tekrar: x.s.animationIterationCount,
      sure: x.s.animationDuration + ' / ' + x.s.transitionDuration,
      egri: x.s.transitionTimingFunction.slice(0, 40),
      ozellik: x.s.transitionProperty.slice(0, 60)
    }));
})()
```

Bu çıktıda üç şeye bak:
- `tekrar: "infinite"` bir sonuç ekranındaysa hatadır.
- `ozellik` içinde `width`, `height`, `top`, `left`, `margin` varsa değiştir.
- `sure` değerleri token dışıysa (140/180/220 değilse) düzelt.

**Kare düşüyor mu:**

```js
(() => {
  let n = 0; const bas = performance.now();
  return new Promise(c => {
    const tik = () => { n++; performance.now() - bas < 1000 ? requestAnimationFrame(tik)
      : c({ fps: n, saglikli: n > 50 }); };
    requestAnimationFrame(tik);
  });
})()
```

Animasyon sırasında çalıştır. `fps` 50'nin altındaysa muhtemelen yerleşim hesaplatan bir
özellik animate ediliyor.

**Azaltılmış hareket gerçekten çalışıyor mu:** Tarayıcı geliştirici araçlarında
`prefers-reduced-motion: reduce` emülasyonunu aç, yukarıdaki ilk betiği tekrar çalıştır.
`transform` içeren `ozellik` kalmamalı.

## 10. Bu skill neyi devretmez

- **Ölçüm yöntemi ve kayma kanıtı** `ui-dogrula` skill'inde. Buradaki betikler onun tamamlayıcısı.
- **Renk, boyut, boşluk kararları** `arayuz-sistemi` skill'inde.
- **Türkçe metin kuralları** CLAUDE.md'de.
