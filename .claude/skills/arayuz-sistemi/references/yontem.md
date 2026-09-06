# Yöntem: tasarlama, durumlar, mobil, elden geçirme

## Ekranı tasarlama, beş adım

Sıra önemli. Atlamadan uygula.

**1. Tek soruyu bul.** Kullanıcı bu ekrana bakarken zihninde ne var? Siparişler
sayfasında bu soru "hangi bankoya gideceğim". Cevap ekranın en büyük ve en koyu öğesi
olur. Ekranda **bir** tane böyle öğe vardır.

**2. Destekleyicileri sırala.** Kaç parça, kim topluyor, ne kadar oldu. Bunlar ikincil:
`11-12px`, `--sonuk`, normal ağırlık. Ana veriyle yarışmazlar.

**3. Gerisini at.** En zor ve en çok işe yarayan adım. Kullanıcının kararını
değiştirmeyen her alan gürültüdür. Ürün kimliği, dahili kod, oluşturma zamanı; hiçbiri
depocunun elini hızlandırmaz.

**4. Boşlukla grupla, çizgiyle değil.** Ayırıcı çizgi son çaredir. Aynı gruba ait şeyler
yakın, farklı gruplar uzak durur; göz bunu çizgisiz de okur.

**5. Dört durumu say.** Aşağıdaki tabloyu uygula.

## Dört durum

Her liste ve her veri ekranı bu dördünü taşır. Dördü de tasarlanır.

| Durum | Ne göstermeli | Yapma |
|---|---|---|
| Yükleniyor | İskelet: gelecek yerleşimi gösterir, zıplama olmaz | Dönen çark, boş ekran |
| Boş | Neden boş + ne yapılacağı | "Kayıt yok" gibi kuru metin |
| Hata | Ne oldu + tekrar dene düğmesi | Yığın izi, teknik mesaj |
| Dolu | Asıl tasarım | |

Boş durum metni Türkçe, suçlayıcı değil, eylem önerir. Projede iyi örnek:
"Hazırlanan sipariş yok".

## Mobil

Depocu bu arayüzü tek eliyle, hareket hâlinde, ışık altında kullanıyor. Masaüstü ikincil.

- **Dokunma hedefi en az 44×44px.** Görsel olarak küçük olabilir, dokunma alanı olamaz.
  Gerekirse şeffaf dolgu ya da `::after` ile alanı büyüt. Hedefler arası en az 8px.
- **Başparmak bölgesi.** Sık kullanılan eylem ekranın alt üçte birinde. Üst köşe en zor
  yerdir; oraya yalnız geri ve kapat konur.
- **Çentik ve ev çubuğu.** Sayfa kabuğu `env(safe-area-inset-*)` kullanır,
  `viewport-fit=cover` ile birlikte. Projede `.site-header` ve `.mobile-menu-panel`
  bunu uyguluyor, yeni kabuklar da uygulamalı.
- **Yatay kaydırma yok.** Geniş içerik kendi `overflow-x: auto` kabında kayar, sayfa
  gövdesi asla.
- **Metin en az 11px.** Altındaki hiçbir şey depoda okunmaz.
- **Hover'a bağlı bilgi yok.** Dokunmatikte hover yoktur; tooltip'te saklanan bilgi
  telefonda kaybolur.

## "Bu çirkin oldu" teşhisi

Kullanıcı beğenmediyse baştan çizme. Önce ölç, sonra karar ver.

```js
(() => {
  const k = document.querySelector('.sip-kart');   // incelenecek bileşen
  const hepsi = [...k.querySelectorAll('*')].map(e => getComputedStyle(e));
  return {
    yaziBoyutlari: [...new Set(hepsi.map(s => s.fontSize))].sort(),
    agirliklar:    [...new Set(hepsi.map(s => s.fontWeight))].sort(),
    renkler:       [...new Set(hepsi.map(s => s.color))],
    yaricaplar:    [...new Set(hepsi.map(s => s.borderRadius))]
  };
})()
```

Çıktıyı beş soruyla oku:

1. **`yaziBoyutlari` üçten uzun mu?** Sorun budur. Ölçeğe indir.
2. **Hiyerarşi tek mi?** İki şey aynı anda bağırıyorsa göz karar veremez. Birini geri çek.
3. **Boşluk ilişkiyi anlatıyor mu?** Eşit boşluk = gruplama yok = liste okunmuyor.
4. **`renkler` üçten uzun mu?** Zemin, metin ve tek vurgu yeter. Dördüncü gerekçe ister.
5. **Ne silinebilir?** Genelde cevap "epeyce". Çirkinliğin en sık sebebi fazlalıktır.

Mesele estetik değil, disiplin. Ölçüm bunu gösterir.
