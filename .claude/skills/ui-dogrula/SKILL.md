---
name: ui-dogrula
description: Bir arayüz değişikliğini ekran görüntüsü yakmadan doğrular. Kayma, taşma, boyut oynaması, duyarlı kırılma noktaları, animasyon durumu ve erişilebilirlik ölçümle kanıtlanır. Jet Barkod'da bir panel, modal, kart, sihirbaz ya da sayfa yerleşimi değiştirildiğinde kullanılır.
---

# Arayüz doğrulama

## Neden

Ekran görüntüsü en pahalı araç. Bir tanesi yaklaşık 2000 token ve sana yalnızca **o anki tek kareyi** verir.
Animasyonlu bir arayüzde çektiğin kare çoğu zaman yanlış fazı yakalar, sen de "acaba bozuk mu" diye
bir tane daha çekersin. Üç dört tekrarda on binlerce token gider ve elinde hâlâ sayı yoktur.

Ölçüm bunun tersi. `javascript_tool` ile aldığın sonuç birkaç yüz token tutar, kesindir,
her kırılma noktasında tekrarlanabilir ve kanıt olarak commit mesajına yazılabilir.

**Kural: önce ölç, sonunda bir tek görüntü al.**

## Sıra

1. Sunucuyu aç: `preview_start` ile `jetbarkod-static` (port 8899).
2. Gerekiyorsa `pages/_deneme.html` gibi izole bir deneme sayfası yaz. Bileşeni tek başına,
   birden çok genişlikte yan yana koy. İş bitince **sil**.
3. Aşağıdaki ölçüm betiklerini çalıştır.
4. Ölçümler temizse **tek** ekran görüntüsü al, o da son hâli görmek için.
5. Deneme sayfasını sil, sunucuyu `preview_stop` ile kapat, `resize_window` ile görünümü `desktop`'a döndür.

## Ölçüm betikleri

Hepsi `javascript_tool` ile `javascript_exec` olarak çalışır.

### Kayma: adım ya da sekme değişince boy oynuyor mu

En sık hata bu. Tek benzersiz değer çıkmalı.

```js
(() => {
  const k = document.querySelector('.er-sihirbaz');      // ölçülecek kap
  const ileri = document.querySelector('#erIleri');       // ilerleten düğme
  const h = [];
  for (let i = 0; i < 7; i++) { if (i) ileri.click(); h.push(+k.getBoundingClientRect().height.toFixed(2)); }
  return { benzersiz: [...new Set(h)], hepsi: h };
})()
```

`benzersiz` dizisinde **tek** eleman varsa kayma yok. Birden fazlaysa hangi adımda oynadığı `hepsi`'nden okunur.

### Kayma kaynağı: hangi blok büyüyor

Boy oynuyorsa suçluyu bul. Gizli adımları geçici olarak açıp alt blokları tek tek ölç.

```js
(() => {
  const r = [];
  document.querySelectorAll('.er-adim').forEach((a, i) => {
    const eski = a.className; a.classList.add('is-aktif');
    r.push({ adim: i + 1,
      metin: +a.querySelector('.er-metin').getBoundingClientRect().height.toFixed(2),
      eylem: +a.querySelector('.er-eylem-alani').getBoundingClientRect().height.toFixed(2) });
    a.className = eski;
  });
  return r;
})()
```

Sabit `min-height` ile kayma çözülmez, yalnız ertelenir: dar ekranda metin bir satır fazla sarınca
geri gelir. Kalıcı çözüm adımları tek ızgara gözünde üst üste koymaktır, satır en uzun adıma göre ölçülür.

### Taşma: yatay kaydırma ve iç kutu taşması

```js
({
  sayfaTasmasi: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  tasanlar: [...document.querySelectorAll('*')]
    .filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
    .slice(0, 10).map(e => e.className || e.tagName)
})
```

### Dar ekran: kırılma noktalarını tek turda gez

Görünümü gerçekten küçültmek yerine kabın genişliğini oynat. Çok daha hızlı ve `resize_window` gerektirmez.

```js
(() => {
  const kap = document.querySelector('.jb-modal__panel');
  const olc = document.querySelector('.er-ray');
  const eski = kap.style.width, r = [];
  [288, 320, 375, 480, 544].forEach(w => {
    kap.style.width = w + 'px';
    r.push({ genislik: w, tasma: olc.scrollWidth > olc.clientWidth + 0.5,
             boy: +document.querySelector('.er-sihirbaz').getBoundingClientRect().height.toFixed(1) });
  });
  kap.style.width = eski;
  return r;
})()
```

### Animasyon: doğru fazda mı, sonsuz mu dönüyor

Ekran görüntüsünün yanlış kare yakalaması hep buradan gelir. Fazı sayıyla oku.

```js
(() => {
  const h = document.querySelector('.er-adim.is-aktif');
  return [...h.querySelectorAll('*')].filter(e => getComputedStyle(e).animationName !== 'none')
    .map(e => { const s = getComputedStyle(e);
      return { sinif: e.getAttribute('class'), ad: s.animationName,
               sure: s.animationDuration, tekrar: s.animationIterationCount, opaklik: s.opacity }; });
})()
```

`tekrar: "infinite"` olan bir **sonuç ekranı** hatadır. Bir eylemi anlatan sahne dönebilir,
"tamamlandı" ekranı bir kez oynayıp durmalıdır. Boşuna kare üretmesin.

### Gizli içerik gerçekten gizli mi

`visibility: hidden` klavye sırasından çıkarır, `opacity: 0` çıkarmaz. Varsayma, dene.

```js
(() => {
  const g = document.querySelector('.er-adim:not(.is-aktif) button, .er-adim:not(.is-aktif) a');
  g.focus();
  return { odaklanabiliyor: document.activeElement === g };  // false olmalı
})()
```

### Çakışma: iki öğe üst üste binmiş mi

SVG sahnelerde sık olur, gözle bakınca da kaçar.

```js
(() => {
  const a = document.querySelector('.c-adres').getBoundingClientRect();
  const b = document.querySelector('.c-anahtar-acik').getBoundingClientRect();
  return { cakisiyor: !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top) };
})()
```

## Ekran görüntüsü alırken

Kaçınılmazsa:

- **Tek** çekim. `browser_batch` içinde arka arkaya birden çok `screenshot` koyma.
- Animasyonlu sahnede önce `computer{action:"wait"}` ile fazı bekle, sonra çek.
- `browser_batch` içinde çekilen görüntü bazen bir önceki karenin karışımını gösterir.
  Kritik bir kareyi doğrulayacaksan tek başına `screenshot` çağır.
- `zoom` bu ortamda bölge kırpmıyor, tam görüntü döndürüyor. Yakınlaştırmak için kullanma.

## Bitirirken

- Deneme sayfasını sil.
- `preview_stop`.
- `resize_window` ile `desktop`.
- Ölçüm sonucunu commit mesajına yaz. "Kayma yok" demek yerine
  "yedi adımın yedisi de 546.70px, 288px genişlikte de tek boy" yaz. Kanıt kalsın.
