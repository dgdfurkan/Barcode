# Hareket ölçümü

Ekran görüntüsü animasyonun yanlış karesini yakalar ve pahalıdır. Sayıyla bak.

## Hangi öğeler hareket ediyor, hangi eğriyle

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

Çıktıda üç şeye bak:

| Bulgu | Anlamı |
|---|---|
| `tekrar: "infinite"` bir sonuç ekranında | Hata. Kutlama dönmez, yükleniyor döner |
| `ozellik` içinde `width`, `height`, `top`, `left`, `margin` | Yerleşim hesaplatıyor, değiştir |
| `sure` token dışı (140/180/220 değil) | Satır içi süre yazılmış, token'a geçir |

## Kare düşüyor mu

Animasyon sırasında çalıştır.

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

`fps` 50'nin altındaysa muhtemelen yerleşim hesaplatan bir özellik animate ediliyor.
Yukarıdaki ilk betiği çalıştırıp `ozellik` sütununa bak.

## Azaltılmış hareket gerçekten çalışıyor mu

Geliştirici araçlarında `prefers-reduced-motion: reduce` emülasyonunu aç, ilk betiği
tekrar çalıştır. Çıktıda `transform` içeren `ozellik` kalmamalı, `opacity` kalabilir.

## Boyut oynaması

Animasyon yerleşimi değiştiriyorsa animasyon değil, hatadır. Ölçüm yöntemi ve kayma
kanıtı `ui-dogrula` skill'inde; buradaki betikler onun tamamlayıcısı.
