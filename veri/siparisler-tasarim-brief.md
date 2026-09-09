# Siparişler ekranı: tasarım özeti

## Ne işe yarıyor

Karanlık mağaza deposunda çalışan bir toplayıcının ekranı. Depoya düşen
siparişleri görüyor, birini seçip içindeki ürünleri raflardan topluyor,
topladıkça işaretliyor, bitince bankoya bırakıyor.

Kullanıcı tek kişi ve genelde telefonda, ayakta, hareket hâlinde, bir eli
dolu. Masaüstü ikincil. Ekran sürekli açık duruyor ve kendi kendine
tazeleniyor; kullanıcı yenile düğmesine basmak zorunda değil.

## Ekran yapısı

**Üst şerit.** Marka, iki bağlantı (Ürün Arama, Sayım) ve hesap çipi.

**Başlık alanı.** Sayfa adı, tek cümlelik açıklama ve sağda üç eylem:
Kapananlar (yanında sayı), Ayarlar, Yenile. Başlığın üstünde küçük bir
durum çipi var: verinin ne kadar taze olduğunu söylüyor (canlı / gecikti /
bağlantı yok) ve buna göre renk değiştiriyor.

**Üç şerit yan yana.** Siparişin hangi aşamada olduğunu gösteriyor:

- Hazırlanıyor: toplayıcı ürünleri raflardan topluyor
- Hazırlandı: sipariş bankoda kuryeyi bekliyor
- Yolda: kurye almış, teslimata çıkmış

Her şeridin başlığında ikon, ad, sipariş sayısı ve bir sıralama rozeti var.
Rozete dokununca sıralama ölçütü değişiyor ve seçili ölçüt rozetin üstünde
yazılı duruyor: Eski önce, Yeni önce, Kolay önce, Banko, Kurye. "Kolay
önce" siparişin içindeki ürün kategorilerine bakıyor; hiç özel kategorisi
olmayan sipariş en başta, dondurmalı olan en sonda.

**Sipariş kartı.** Şeritlerin içindeki kutular. Üstte banko numarası ve
siparişin ne kadar süredir beklediği. Altında toplayıcı ve kurye çipleri
(fotoğraf varsa fotoğraf, yoksa baş harfler). En altta ilerleme çubuğu ve
"alınan / toplam parça" sayısı. Kartın zemini siparişin içindeki
kategorilere göre soluk renk alıyor: hiç kategorisi yoksa beyaz, su varsa
maviye çalıyor, birden çok kategori varsa ince şeritler hâlinde bölünüyor.
Kart tamamen toplandıysa belirginleşiyor.

**Sipariş detayı.** Karta dokununca sağdan kayarak açılan tam ekran panel.

- Üstte geri düğmesi, banko numarası, durum rozeti ve poşet sayısı
- Ürün listesi, dört farklı yoğunlukta görüntülenebiliyor: tek sütun liste,
  ikili, üçlü, dörtlü ızgara
- Ürünler toplama sırasına göre dizili ve kategori bantlarına ayrılmış
  (Fırın, Dondurma, Su, Diğer ürünler). Bant sırasını kullanıcı ayarlardan
  değiştiriyor; depoda hangi rafa önce gidiyorsa o
- Altta ilerleme çubuğu ve "Toplandı" düğmesi

**Ürün satırı.** Solda ürün görseli, ortada ad ve barkod, sağda adet kutusu
ve "Aldım" düğmesi. Birden fazla adet varsa adet kutusu renkli, tek adet
sönük. İşaretlerken adet kutusunun üstünde kısa bir "×2" balonu belirip
sönüyor; toplayıcı hızlı çalışırken sayıyı kaçırmasın diye. Ada dokununca
ürünün bütün barkodları açılıyor, görsele dokununca büyüyor.

**Ayarlar.** Üç bölüm: ürünlerin toplama sırası, siparişlerin öncelik
sırası, ve kategori tanımları (hangi kelime hangi bandı tetikliyor, rengi
ne). Hepsi cihaza özel.

**Kapananlar.** Teslim edilmiş siparişlerin listesi, ayrı bir katman.

## Etkileşim

- Detaydan çıkış üç yolla: geri düğmesi, sağa kaydırma, cihazın geri tuşu.
  Üçü de aynı animasyonu oynatıyor
- Listeden bir siparişe girip çıkınca liste kaldığı yerde kalıyor; yeni bir
  siparişe girince detay en üstten başlıyor
- Ürün işaretlemek anında; ağ beklemesi elde hissedilmiyor
- Sipariş listesi kendi kendine tazeleniyor, kullanıcı bir şey yapmıyor

## Görsel dil

Açık gri zemin, beyaz kartlar, ince gri kenarlıklar. Tek vurgu rengi mavi.
Durum renkleri yalnız üç yerde: yeşil canlı, sarı gecikti, kırmızı kopuk.
Köşeler yumuşak, gölgeler hafif ve yalnız yükseklik anlatıyor.

Yazı boyutları yedi basamaklı bir ölçekten seçiliyor, ara değer yok.
Boşluklar dörtün katı. Dokunma hedefleri en az 44 piksel.

Hareket kısa ve az: yer değiştirmeyen geçişler 100 ms, küçük hareketler
140 ms, panel açılışı 220 ms. Yalnız konum ve saydamlık animate ediliyor,
kayma ya da zıplama yok. Cihazda azaltılmış hareket açıksa hepsi kapanıyor.

## Dikkat edilenler

- Depoda ışık parlak, ekran küçük: kontrast yüksek, yazı ufak değil
- Tek elle kullanılıyor: sık eylemler ekranın altında
- Ürün adı uzun olabilir, banko numarası olmayabilir, kurye atanmamış
  olabilir. Boş alan kutuyu küçültmüyor, yerleşim oynamıyor
- Dört durum da tasarlanıyor: yükleniyor (iskelet), boş, hata, dolu
