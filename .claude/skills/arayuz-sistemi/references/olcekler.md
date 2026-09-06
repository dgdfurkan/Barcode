# Ölçekler: gerekçeler ve ayrıntı

SKILL.md'deki tablolar karar için yeter. Bu dosya "neden bu sayı" sorusunun cevabı ve
sınır durumlar için.

## Tipografi

İki font var, ikisi de yerel:

```css
--baslik-font: 'Manrope', 'Inter', sans-serif;   /* sayı ve başlık */
--govde-font:  'DM Sans', system-ui, ...;         /* metin */
```

| Basamak | Nerede | Not |
|---|---|---|
| `10px` | Rozet içi, üst etiket | CAPS + `letter-spacing: 0.12em` ile birlikte |
| `11px` | İkincil bilgi, sayaç | Depoda okunabilir alt sınır |
| `12px` | Liste satırı, ikincil düğme | |
| `13px` | Gövde metni | Varsayılan |
| `15px` | Kart başlığı, ürün adı | |
| `18px` | Panel başlığı | |
| `26px` | Ekranın tek büyük sayısı | Banko numarası gibi. Ekranda bir tane |

Aradaki değere ihtiyaç duyduğunda durup şunu sor: gerçekten yeni bir hiyerarşi kademesi
mi gerekiyor, yoksa üsttekini biraz büyütmeye mi çalışıyorum? Cevap ikincisiyse ölçeğe
sadık kal.

**Ağırlık hiyerarşiyi boyuttan ucuza kurar.** 13px/700 ile 13px/500 arasındaki fark,
15px ile 13px arasındaki farktan daha okunaklıdır ve satır yüksekliğini bozmaz. Önce
ağırlığı dene, boyutu sonra.

**Satır yüksekliği:** başlık `1.15`, gövde `1.45`, tek satırlık etiket `1`.

**Sayılarda `font-variant-numeric: tabular-nums`.** Sayaç ve süre değişirken genişlik
oynamasın. Projede zaten uygulanmış, sürdür.

## Boşluk

`4 · 8 · 12 · 16 · 24 · 32 · 48`. Aradaki hiçbir sayı meşru değil.

**Boşluk ilişkiyi anlatır.** İki öğe arasındaki boşluk, o öğelerin iç boşluğundan büyük
olmalı; yoksa hangi etiketin hangi değere ait olduğu okunmaz. Kartın iç dolgusu `12px`
ise kartlar arası `16px` olur, tersi olmaz.

Eşit boşluk dağıtmak gruplama yapmamaktır. Liste okunmuyorsa ilk bakılacak yer budur.

## Yarıçap

| Değer | Nerede |
|---|---|
| `6px` | Rozet, küçük etiket, kod kutusu |
| `9px` | Düğme, girdi, liste satırı |
| `12px` | Kart |
| `16px` | Panel, modal |
| `999px` | Hap ve daire (avatar, sayaç balonu) |

**İç öğenin yarıçapı dış kabından küçük olur.** 12px kartın içindeki düğme 9px alır.
Eşitlenirse köşeler iç içe geçmiş görünür.

## Renk

```
--mavi #2563eb   eylem, seçili durum, bağlantı
--yesil #0e9f6e  tamamlandı, olumlu
--sari  #d97706  bekliyor, uyarı
--mor   #7c3aed  premium
--yazi  #111827  ana metin
--sonuk #667085  ikincil metin
--soluk #98a2b3  üçüncül, yer tutucu
--cizgi #e4e7ec  ayırıcı
--kagit #f4f6f9  sayfa zemini
--yuzey #ffffff  kart zemini
```

**Renk tek başına anlam taşımaz.** Kırmızı-yeşil ayrımı göremeyen kullanıcı var. Durum
rengi her zaman bir ikon, etiket ya da konum farkıyla birlikte gelir.

**Kontrast eşikleri:** gövde metni zemine karşı en az 4.5:1, 18px üstü ve ikonlar 3:1.

`--soluk` (#98a2b3) beyaz üstünde **2.5:1** verir. Yalnız yer tutucu ve devre dışı öğede
kullanılabilir, okunması gereken metinde asla.

Ölç:

```js
(() => {
  const l = (h) => { const c=[1,3,5].map(i=>{let v=parseInt(h.substr(i,2),16)/255;
    return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
    return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
  const oran = (a,b) => { const x=l(a),y=l(b); return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2); };
  return { sonuk: oran('#667085','#ffffff'), soluk: oran('#98a2b3','#ffffff') };
})()
```

**Dördüncü renk gerekçe ister.** Zemin, metin ve tek vurgu çoğu ekran için yeter.
