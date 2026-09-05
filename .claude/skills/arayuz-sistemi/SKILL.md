---
name: arayuz-sistemi
description: Jet Barkod arayüzünde tasarım kararı verir. Yeni ekran, kart, panel, modal, form, boş durum, liste ya da bileşen tasarlarken; mevcut bir ekranın görünümünü elden geçirirken; "bu çirkin oldu", "AI işi gibi duruyor", "daha güzel yap" geri bildirimi geldiğinde kullanılır. Tipografi ölçeği, boşluk, renk, hiyerarşi, durum tasarımı ve mobil dokunma kurallarını projenin kendi token'ları üzerinden uygular.
---

# Arayüz sistemi

## Neden bu skill var

Bu projede tasarım token'ları zaten iyi. Renk paleti isimlendirilmiş, gölgeler üç kademeli,
`prefers-reduced-motion` 21 CSS dosyasında var. Disiplin mevcut.

Sorun tutarlılıkta. Ölç:

```bash
cat css/*.css | grep -oE 'font-size: *[0-9.]+px' | grep -oE '[0-9.]+' | sort -n | uniq | wc -l
cat css/*.css | grep -oE 'border-radius: *[0-9.]+px' | grep -oE '[0-9.]+' | sort -n | uniq | wc -l
```

Bugünkü sonuç: **28 farklı yazı boyutu, 20 farklı köşe yarıçapı.** İçlerinde `11.2px`,
`14.4px`, `18.9px` gibi değerler var. Bunlar kimsenin seçmediği sayılar, bir `rem`
hesabından ondalık olarak düşmüşler. `12px`, `12.5px` ve `13px` aynı ekranda yan yana
duruyor; hiçbir göz bu farkı okuyamaz ama her biri ayrı bir bakım yükü.

İşte AI slop budur. Çirkin renk değil, gradient değil. **Karar veremeyip her seferinde
yakınındaki bir sayıyı biraz değiştirmek.** Sistem yoksa her yeni bileşen ölçeğe bir
sayı daha ekler ve arayüz yavaşça dağılır.

Bu skill karar verdirir.

## 1. Kırmızı çizgiler

Bunlar tartışılmaz. Biri bile ihlal edilirse iş bitmemiştir.

- **Ölçek dışı sayı yazma.** Yazı boyutu, yarıçap ve boşluk aşağıdaki ölçeklerden seçilir.
  Ölçekte olmayan bir değere ihtiyaç duyuyorsan tasarım yanlıştır, sayı değil.
- **Ondalıklı piksel yok.** `11.2px`, `14.4px`, `12.5px` yasak. Tek istisna `0.5px`
  kenarlıklar (retina saç çizgisi).
- **Amaçsız gradient yok.** Mor-mavi geçiş, cam efekti, her kutuya gölge. Gölge yalnız
  yükseklik anlatır: kağıttan kalkan şey gölge alır, düz duran almaz.
- **Emoji ile ikon yapma.** İşletim sistemine göre değişir, hizalanmaz, renk almaz.
  Satır içi SVG çiz, `stroke-width` ortak olsun, `currentColor` kullansın.
- **Aynı ekranda üçten fazla yazı boyutu yok.** Kart için ikisi yeter: ana veri ve destek.
- **Kayma, zıplama, boyut oynaması yok.** Bu CLAUDE.md kuralı. `ui-dogrula` ile kanıtlanır.
- **Dış CDN yok.** Font, ikon, kütüphane; hepsi yerelde.

## 2. Tipografi ölçeği

Projede iki font var, ikisi de yerel:

```css
--baslik-font: 'Manrope', 'Inter', sans-serif;   /* sayı ve başlık */
--govde-font:  'DM Sans', system-ui, ...;         /* metin */
```

Bundan sonra yeni yazılan her yerde **bu yedi basamak** kullanılır:

| Basamak | Nerede |
|---|---|
| `10px` | Rozet içi, üst etiket (CAPS + `letter-spacing: 0.12em`) |
| `11px` | İkincil bilgi, yardımcı metin, sayaç |
| `12px` | Liste satırı, ikincil düğme |
| `13px` | Gövde metni, varsayılan |
| `15px` | Kart başlığı, ürün adı |
| `18px` | Panel başlığı |
| `26px` | Ekranın tek büyük sayısı (banko numarası gibi) |

Aradaki değere ihtiyaç duyuyorsan durup düşün: gerçekten yeni bir hiyerarşi kademesi mi
gerekiyor, yoksa üsttekini biraz büyütmeye mi çalışıyorsun? Cevap ikincisiyse ölçeğe sadık kal.

**Ağırlık hiyerarşiyi boyuttan daha ucuza kurar.** 13px/700 ile 13px/500 arasındaki fark,
15px ile 13px arasındaki farktan daha okunaklıdır ve satır yüksekliğini bozmaz.

**Satır yüksekliği:** başlıkta `1.15`, gövdede `1.45`, tek satırlık etikette `1`.

**Sayılar için `font-variant-numeric: tabular-nums`.** Sayaç ve süre değişirken genişlik
oynamasın. Projede zaten uygulanmış, sürdür.

## 3. Boşluk ve yarıçap

**Boşluk 4'ün katı.** `4 · 8 · 12 · 16 · 24 · 32 · 48`. Aradaki hiçbir sayı meşru değil.

Boşluk hiyerarşisi ilişkiyi anlatır. İki öğe arasındaki boşluk, o öğelerin iç boşluğundan
büyük olmalı; yoksa hangi etiketin hangi değere ait olduğu okunmaz. Kartın iç dolgusu
`12px` ise kartlar arası `16px` olur, tersi olmaz.

**Yarıçap beş basamak:**

| Değer | Nerede |
|---|---|
| `6px` | Rozet, küçük etiket, kod kutusu |
| `9px` | Düğme, girdi, liste satırı |
| `12px` | Kart |
| `16px` | Panel, modal |
| `999px` | Hap ve daire (avatar, sayaç balonu) |

Kural: **iç öğenin yarıçapı dış kabından küçük olur.** 12px kartın içindeki düğme 9px alır.
Eşitlenirse köşeler iç içe geçmiş görünür.

## 4. Renk

Palet `css/siparisler.css` içindeki `:root`'ta. Yeni renk **üretme**, oradan seç:

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
rengi her zaman bir ikon, bir etiket ya da bir konum farkıyla birlikte gelir.

**Kontrast:** gövde metni zemine karşı en az 4.5:1, 18px üstü ve ikonlar 3:1. `--soluk`
(#98a2b3) beyaz üstünde 2.5:1 verir; yalnız yer tutucu ve devre dışı öğede kullanılabilir,
okunması gereken metinde asla.

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

## 5. Hiyerarşi: ekranı tasarlama yöntemi

Kart ya da panel tasarlarken sırayla şunu yap. Sıra önemli.

**1. Tek soruyu bul.** Kullanıcı bu ekrana bakarken zihninde ne var? Siparişler
sayfasında bu soru "hangi bankoya gideceğim". Cevap ekranın en büyük ve en koyu öğesi
olur. Ekranda **bir** tane böyle öğe vardır.

**2. Destekleyicileri sırala.** Kaç parça, kim topluyor, ne kadar oldu. Bunlar ikincil:
`11-12px`, `--sonuk`, normal ağırlık. Ana veriyle yarışmazlar.

**3. Gerisini at.** Bu adım en zorudur ve en çok işe yarar. Kullanıcının kararını
değiştirmeyen her alan gürültüdür. Ürün kimliği, dahili kod, oluşturma zamanı; hiçbiri
depocunun elini hızlandırmaz.

**4. Boşlukla grupla, çizgiyle değil.** Ayırıcı çizgi son çaredir. Aynı gruba ait şeyler
birbirine yakın, farklı gruplar uzak durur; göz bunu çizgisiz de okur.

**5. Durumları say.** Her liste dört durum taşır ve dördü de tasarlanır:

| Durum | Ne göstermeli |
|---|---|
| Yükleniyor | İskelet, dönen çark değil. İskelet gelecek yerleşimi gösterir, zıplama olmaz |
| Boş | Neden boş + ne yapılacağı. "Kayıt yok" değil, "Hazırlanan sipariş yok" |
| Hata | Ne oldu + tekrar dene düğmesi. Yığın izi değil |
| Dolu | Asıl tasarım |

Boş durum metni Türkçe, suçlayıcı değil, eylem önerir. Projede iyi bir örnek var:
"Hazırlanan sipariş yok".

## 6. Mobil

Depocu bu arayüzü tek eliyle, hareket hâlinde, ışık altında kullanıyor. Masaüstü ikincil.

- **Dokunma hedefi en az 44×44px.** Görsel olarak küçük olabilir, dokunma alanı olamaz.
  Gerekirse şeffaf dolgu ya da `::after` ile alanı büyüt.
- **Başparmak bölgesi.** Sık kullanılan eylem ekranın alt üçte birinde. Üst köşe en zor
  yerdir; oraya yalnız geri ve kapat konur.
- **Çentik ve ev çubuğu.** Sayfa kabuğu `env(safe-area-inset-*)` kullanır, `viewport-fit=cover`
  ile birlikte. Projede `.site-header` ve `.mobile-menu-panel` bunu uyguluyor.
- **Yatay kaydırma yok.** Geniş içerik kendi `overflow-x: auto` kabında kayar, sayfa gövdesi asla.
- **Metin en az 11px.** Altındaki hiçbir şey depoda okunmaz.

## 7. Yeni bileşen yazarken kontrol listesi

Kod yazmadan önce:

- [ ] Bu bileşenin tek işi ne? Bir cümleyle söyleyemiyorsan ikiye böl.
- [ ] Dört durumun dördü de tasarlandı mı?
- [ ] Kullandığım her yazı boyutu ölçekten mi? Her yarıçap listeden mi?
- [ ] Boşluklar 4'ün katı mı?
- [ ] Renk `:root`'tan mı geliyor, yoksa yeni bir hex mi uydurdum?
- [ ] Durum yalnız renkle mi anlatılıyor? Öyleyse ikon ekle.
- [ ] Dokunma hedefleri 44px mi?
- [ ] En uzun içerikle ne oluyor? 40 karakterlik ürün adı, 3 haneli sayaç, boş kurye alanı.
- [ ] Hareket gerekiyor mu? Gerekiyorsa `hareket` skill'ini aç.

Kod yazdıktan sonra `ui-dogrula` skill'i ile ölç. Ekran görüntüsü en son ve tek adet.

## 8. Elden geçirme: "bu çirkin oldu" geldiğinde

Kullanıcı beğenmediyse baştan çizme, önce teşhis et. Sırayla bak:

1. **Kaç yazı boyutu var?** Üçten fazlaysa sorun budur. Ölçeğe indir.
2. **Hiyerarşi tek mi?** İki şey aynı anda bağırıyorsa göz karar veremez. Birini geri çek.
3. **Boşluk ilişkiyi anlatıyor mu?** Eşit boşluk = gruplama yok = liste okunmuyor.
4. **Kaç renk var?** Zemin + metin + tek vurgu yeter. Dördüncü renk gerekçe ister.
5. **Ne silinebilir?** Genelde cevap "epeyce". Çirkinliğin en sık sebebi fazlalıktır.

Bu beş soruyu ölçerek cevapla, tahminle değil:

```js
(() => {
  const k = document.querySelector('.sip-kart');
  const hepsi = [...k.querySelectorAll('*')].map(e => getComputedStyle(e));
  return {
    yaziBoyutlari: [...new Set(hepsi.map(s => s.fontSize))].sort(),
    agirliklar:    [...new Set(hepsi.map(s => s.fontWeight))].sort(),
    renkler:       [...new Set(hepsi.map(s => s.color))],
    yaricaplar:    [...new Set(hepsi.map(s => s.borderRadius))]
  };
})()
```

Çıktıda `yaziBoyutlari` üçten uzunsa mesele estetik değil, disiplin.

## 9. Bu skill neyi devretmez

- **Ölçüm ve doğrulama** `ui-dogrula` skill'inin işi. Tasarımı burada kur, orada kanıtla.
- **Animasyon** `hareket` skill'inin işi. Süre ve eğri seçimini oradan al.
- **Türkçe metin kuralları** CLAUDE.md'de. Uzun tire yasak, klişe yasak.
