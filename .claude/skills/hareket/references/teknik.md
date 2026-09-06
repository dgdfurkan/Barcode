# Azaltılmış hareket ve sıralı giriş

## Azaltılmış hareket

21 CSS dosyasında zaten var. Ama doğru anlamıyla uygula.

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

Hepsini `transition: none` yapmak kolaycılıktır ve arayüzü kırık hissettirir. Öğe bir
anda yerinde belirir, kullanıcı neyin değiştiğini kaçırır.

**Kontrol:** tarayıcı geliştirici araçlarında `prefers-reduced-motion: reduce`
emülasyonunu aç, `references/olcum.md` içindeki ilk betiği çalıştır. Çıktıda `transform`
içeren `ozellik` kalmamalı.

## Sıralı giriş

Liste öğeleri aynı anda belirirse hareket gürültü olur. Sırayla gelirse göz akışı takip eder.

Projede kurulu: `kartCiz` her karta `style="--i: 0..12"` yazıyor.

```css
.sip-kart--gir {
    animation: kartGir var(--motion-normal) var(--motion-ease-out) backwards;
    animation-delay: calc(var(--i) * 30ms);
}
```

**Gecikme 30-60ms arası olur.** Altında fark edilmez, üstünde liste yavaş açılıyormuş
gibi hissedilir.

**Üst sınır zorunlu.** Projede `Math.min(idx, 12)` var. Yirmi siparişte yirminci kart
600ms beklerse kullanıcı arayüzün takıldığını sanır.

**`backwards` dolgusu şart.** Gecikme boyunca öğe ilk karede durur; olmazsa bir kare
görünüp kaybolur, gözde titreme yapar.

## İskelet yükleme

İskelet dönen çarktan iyidir çünkü gelecek yerleşimi gösterir ve içerik gelince zıplama
olmaz. Üç kural:

- İskelet gerçek yerleşimin ölçülerini taşır. Kart 132px ise iskelet de 132px.
- Parıltı animasyonu `transform: translateX()` ile yapılır, `background-position` ile değil.
- Azaltılmış harekette parıltı durur, iskeletin kendisi kalır.
