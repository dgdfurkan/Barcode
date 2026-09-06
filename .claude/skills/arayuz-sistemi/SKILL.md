---
name: arayuz-sistemi
description: Jet Barkod arayüzünde tasarım kararı verir. Yeni ekran, kart, panel, modal, form, boş durum, liste ya da bileşen tasarlarken; mevcut bir ekranın görünümünü elden geçirirken; "bu çirkin oldu", "AI işi gibi duruyor", "daha güzel yap" geri bildirimi geldiğinde kullanılır. Tipografi ölçeği, boşluk, renk, hiyerarşi, durum tasarımı ve mobil dokunma kurallarını projenin kendi token'ları üzerinden uygular.
---

# Arayüz sistemi

Bu projede tasarım token'ları iyi: renk paleti isimlendirilmiş, gölgeler üç kademeli,
`prefers-reduced-motion` 21 CSS dosyasında var. Sorun tutarlılıkta.

```bash
cat css/*.css | grep -oE 'font-size: *[0-9.]+px' | grep -oE '[0-9.]+' | sort -n | uniq | wc -l
cat css/*.css | grep -oE 'border-radius: *[0-9.]+px' | grep -oE '[0-9.]+' | sort -n | uniq | wc -l
```

Bugünkü sonuç: **28 farklı yazı boyutu, 20 farklı köşe yarıçapı.** İçlerinde `11.2px`,
`14.4px`, `18.9px` gibi kimsenin seçmediği sayılar var, bir `rem` hesabından ondalık
düşmüşler. `12px`, `12.5px` ve `13px` aynı ekranda yan yana; hiçbir göz bu farkı okumaz.

**AI slop budur.** Çirkin renk değil, gradient değil. Karar veremeyip her seferinde
yakındaki bir sayıyı biraz değiştirmek. Sistem yoksa her yeni bileşen ölçeğe bir sayı
daha ekler ve arayüz yavaşça dağılır.

## Öncelik sırası

Zaman kısıtlıysa yukarıdan aşağı çalış. Çatışma çıkarsa üstteki kazanır.

| # | Alan | Etki | Zorunlu | Yapma |
|---|---|---|---|---|
| 1 | Okunabilirlik | KRİTİK | Gövde metni 4.5:1 kontrast, en az 11px | `--soluk` ile okunacak metin yazma (2.5:1) |
| 2 | Dokunma hedefi | KRİTİK | En az 44×44px, aralarında 8px | Görsel küçüklüğü dokunma alanına yansıtma |
| 3 | Kayma ve zıplama | KRİTİK | Yükleniyor durumu yerleşimi korur | Dönen çarkla iskeleti karıştırma |
| 4 | Hiyerarşi | YÜKSEK | Ekranda tek bir ana veri | İki şeyi aynı anda bağırtma |
| 5 | Ölçek disiplini | YÜKSEK | Boyut, yarıçap, boşluk listeden seçilir | Ondalıklı piksel, ara değer uydurma |
| 6 | Dört durum | YÜKSEK | Yükleniyor, boş, hata, dolu tasarlanır | Yalnız dolu durumu çizip bırakma |
| 7 | Renk anlamı | ORTA | Durum renk + ikon/etiket ile birlikte | Anlamı yalnız renge yükleme |
| 8 | Fazlalık | ORTA | Kararı değiştirmeyen alan silinir | "Dursun belki lazım olur" |

## Ölçekler

Yeni yazılan her yerde bunlar kullanılır. Ara değer yok.

**Yazı boyutu**, yedi basamak:
`10` rozet ve caps etiket · `11` yardımcı metin · `12` liste satırı · `13` gövde ·
`15` kart başlığı · `18` panel başlığı · `26` ekranın tek büyük sayısı

**Boşluk**, 4'ün katı: `4 · 8 · 12 · 16 · 24 · 32 · 48`

**Yarıçap**, beş basamak:
`6` rozet · `9` düğme ve girdi · `12` kart · `16` panel · `999` hap ve daire

**Renk**: `css/siparisler.css` içindeki `:root`. Yeni hex üretme, oradan seç.

Gerekçeler, kontrast eşikleri, ağırlık ve satır yüksekliği kuralları için
`references/olcekler.md` dosyasını oku.

## Kırmızı çizgiler

- **Ölçek dışı sayı yok.** İhtiyaç duyuyorsan tasarım yanlıştır, sayı değil.
- **Ondalıklı piksel yok.** Tek istisna `0.5px` kenarlık.
- **Emoji ile ikon yapma.** Satır içi SVG, ortak `stroke-width`, `currentColor`.
- **Amaçsız gradient ve gölge yok.** Gölge yalnız yükseklik anlatır.
- **Aynı ekranda üçten fazla yazı boyutu yok.**
- **Dış CDN yok.** Font, ikon, kütüphane; hepsi yerelde.

## Çalışma sırası

**Yeni bileşen tasarlarken:** önce `references/yontem.md` içindeki beş adımı uygula
(tek soruyu bul, destekleyicileri sırala, gerisini at, boşlukla grupla, dört durumu say).
Sonra aşağıdaki listeyi geç.

**"Bu çirkin oldu" geldiğinde:** baştan çizme. `references/yontem.md` içindeki beş
soruluk teşhisi ölçerek uygula; çıktı sana neyin bozuk olduğunu söyler.

**Mobil ayrıntıları** (başparmak bölgesi, güvenli alan, yatay kaydırma) yine
`references/yontem.md` içinde.

## Teslim öncesi kontrol

- [ ] Kullandığım her yazı boyutu ölçekten mi? Her yarıçap listeden mi?
- [ ] Boşluklar 4'ün katı mı?
- [ ] Renk `:root`'tan mı geliyor?
- [ ] Dört durum da tasarlandı mı?
- [ ] Durum yalnız renkle mi anlatılıyor? Öyleyse ikon ekle.
- [ ] Dokunma hedefleri 44px mi?
- [ ] En uzun içerikle ne oluyor? 40 karakterlik ürün adı, 3 haneli sayaç, boş kurye alanı.
- [ ] Hareket var mı? Varsa `hareket` skill'ini aç.
- [ ] Ölçüm yapıldı mı? `ui-dogrula` skill'i ile kanıtla, ekran görüntüsü en son ve tek adet.

## Devretmedikleri

Ölçüm ve kayma kanıtı `ui-dogrula`'da. Animasyon süresi ve eğrisi `hareket`'te.
Türkçe metin kuralları CLAUDE.md'de.
