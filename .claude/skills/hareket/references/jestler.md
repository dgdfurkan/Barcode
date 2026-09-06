# Sürükleme jestleri

Bu dosya siparişler sayfasındaki geri-kaydırma işinden çıkarıldı. Üçü de gerçek hataydı,
üçü de kullanıcı tarafından yakalandı.

## 1. Yön kilidi katı olmalı

Yatay jest için `dx > dy` yetmez; çapraz hareket de bu koşulu geçer ve panel yamuk
kayar. Oran şart:

```js
if (yon === null) {
    const m = Math.abs(dx), n = Math.abs(dy);
    if (m + n < 14) return;                  // kilit kararı için yeterli mesafe bekle
    if (dx > 0 && m > n * 1.7) yon = 'x';
    else { yon = 'y'; aktif = false; resetStil(); return; }   // dikeyse tamamen bırak
}
```

Kilit kararı ilk 12-16px'de verilir. Daha erken verirsen parmak titremesi yanlış yön
seçer. Dikey saptandıysa jesti **tamamen** bırak ve stilleri sıfırla; yarım bırakırsan
panel kaymış hâlde takılı kalır.

## 2. `passive: false` olmadan sayfa kaymasını durduramazsın

```js
el.addEventListener('touchmove', islev, { passive: false });

// ve yön 'x' iken:
if (e.cancelable) e.preventDefault();
```

`touchstart` ve `touchend` `passive: true` kalabilir, performansı korur. Yalnız
`touchmove` müdahale eder. `e.cancelable` kontrolü şart; tarayıcı jesti çoktan
devrettiyse `preventDefault` konsola uyarı basar.

## 3. Hayalet tıklama

Dokunma bittikten sonra tarayıcı yaklaşık 300ms içinde sentetik bir `click` üretir.
Jestle bir panel kapattıysan bu tık arkadaki öğeye düşer ve kullanıcının **ilk gerçek
dokunuşu yutulur**. Kullanıcı iki kez basmak zorunda kalır ve bunu "tıklama gitmiyor"
diye bildirir.

```js
document.addEventListener('click', (e) => {
    if (kapamaZamani && Date.now() - kapamaZamani < 350) {
        e.stopPropagation();
        e.preventDefault();
        kapamaZamani = 0;
    }
}, true);   // yakalama evresinde olmalı
```

`kapamaZamani` yalnız jestle kapatma anında set edilir. Düğmeyle kapatmada set edilmez;
orada hayalet tık sorunu yoktur.

## 4. Parmak altında canlı takip

Jest sırasında öğe parmakla birlikte hareket etmeli, yoksa jest ölü hissettirir.

```js
// touchstart
el.style.transition = 'none';

// touchmove, yon === 'x'
dx = Math.max(0, dx);
el.style.transform = 'translateX(' + dx + 'px)';
el.style.opacity = String(1 - Math.min(dx / 400, 0.28));

// touchend
el.style.transition = 'transform var(--motion-panel) var(--motion-ease-out), opacity var(--motion-panel) ease-out';
```

Eşik geçilmediyse `transform` sıfırlanır ve öğe yumuşak geri döner. Geçildiyse aynı yönde
dışarı çıkar, animasyon bitince asıl kapatma çağrılır.

## 5. Eşik

**Ekran genişliğinin dörtte biri ya da 70px, hangisi küçükse.** Sabit büyük eşik küçük
telefonlarda ulaşılamaz olur.

## 6. `touchcancel` unutma

Telefon çağrısı, bildirim ya da sistem jesti dokunmayı iptal edebilir. `touchend` ile
aynı temizliği yapan bir `touchcancel` dinleyicisi olmazsa panel yarı kaymış hâlde
donar.

```js
el.addEventListener('touchend', bitir, { passive: true });
el.addEventListener('touchcancel', bitir, { passive: true });
```
