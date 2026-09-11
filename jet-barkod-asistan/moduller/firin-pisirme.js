/**
 * Modül: Fırın Pişirme
 * ============================================================================
 *
 * Getir fırın sayfasındaki pişirme akışını tek panelde toplar. Ne kadar
 * pişirileceğini hesaplar, ekmek uyarılarını ayrı tutar.
 *
 * ARTIK YER İMİ DEĞİL
 * Eskiden bookmarklet'ti: kullanıcı Ctrl+Shift+B ile yer işaretleri
 * çubuğunu açıyor, düğmeyi sürükleyip bırakıyor, sonra her seferinde ona
 * tıklıyordu. Sürükleme adımı kurulumun en çok takılınan yeriydi; tıklamak
 * işe yaramıyordu ve bunu anlatmak için ayrı bir uyarı satırı gerekiyordu.
 *
 * Şimdi sayfaya gerçek bir düğme koyuyoruz. Kurulum yok, sürükleme yok.
 *
 * KOD NEREDEN GELİYOR
 * Gövde `eklentiler/firin-pisirme.js` içindeki yer imi kodunun URL
 * çözülmüş hâli. Tek satır ve yüzde işaretleriyle kaçırılmış hâlde
 * duruyordu, burada okunabilir hâliyle duruyor. Mantığa dokunulmadı;
 * sahada çalışan kısım o ve fırın sayfasının DOM yapısına bağlı.
 *
 * Panel kendi kendini yönetiyor: `baking-assistant-modal` zaten açıksa
 * ikinci çağrı sessizce çıkıyor, o yüzden düğmeye üst üste basmak güvenli.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var DUGME_KIMLIK = 'jba-firin-dugme';

    var STIL = [
        '#jba-firin-dugme { display: inline-flex; align-items: center; gap: 6px;',
        '  margin-left: 8px; padding: 5px 12px; border: none; border-radius: 6px;',
        '  background: #1d4ed8; color: #fff; font-size: 12px; font-weight: 600;',
        '  cursor: pointer; vertical-align: middle; white-space: nowrap;',
        '  font-family: inherit; -webkit-appearance: none; appearance: none; }',
        '#jba-firin-dugme:hover { background: #1e40af; }',
        '#jba-firin-dugme::before { content: ""; width: 6px; height: 6px;',
        '  border-radius: 50%; background: #fbbf24; }'
    ].join('\n');

    function stilKur() {
        if (document.getElementById('jba-firin-stil')) return;
        var s = document.createElement('style');
        s.id = 'jba-firin-stil';
        s.textContent = STIL;
        (document.head || document.documentElement).appendChild(s);
    }

    // ==================================================================
    // Panel. Gövde yer imi kodunun aynısı, çağrılabilir hâle getirildi.
    // ==================================================================

    function paneliAc() {
        (async function () {
          if (document.getElementById('baking-assistant-modal')) return;

          const CLEAR_BTN_SVG_MARK = 'M8.621 8.086';
          /** Eski panel sürümündeki detay aç düğmesi. Yedek iz olarak duruyor. */
          const CLIPBOARD_BTN_SVG_MARK = 'M9 9H4v1h5V9z';

          /*
           * Sütun başlığındaki "hepsini aç / hepsini kapat" düğmesi.
           *
           * Kart başlığında iki tane `ant-btn-icon-only` var: biri sıralama
           * (title="Artan"/"Azalan"), diğeri bu. İkisinin de sınıf listesi
           * birebir aynı, ikisi de `ant-btn-primary`. Yani düğmeyi sınıftan
           * ayırt etmek mümkün değil, SVG'sinden ayırt ediliyor.
           *
           * Düğmenin dış çerçevesi iki durumda da aynı (AC_KAPA_SVG_IZ);
           * içindeki ikon kapalıyken artı, açıkken çarpı. Ama duruma da
           * ikondan karar verilmiyor: panelin kendi `ant-collapse-item-active`
           * sayısına bakılıyor, çünkü tek doğru kaynak o.
           */
          const AC_KAPA_SVG_IZ = 'M15 6V11C15 13.21';
          /* Aynı düğmenin iki ikonu: kapalıyken artı, açıkken çarpı. */
          const ARTI_SVG_IZ = 'M9.5 7H8V5.5';
          const CARPI_SVG_IZ = 'M9.854 5.146';

          const SETTINGS_LS_KEY = 'getirPişirmeAssistantSettings_v2';
          const SETTINGS_DEFAULT = {
            /* Bu üç ayar yalnız taze üretim ürünlerini etkiliyor:
               "Ekmek (200 g)", "Ramazan Pidesi (300 g)" ve gramaj
               türevleri. La Lorraine ürünleri sıradan ürün sayılıyor,
               `isBreadProduct` açıklamasına bak.

               Varsayılan `true`: taze ekmek fırının işi, listede dursun. */
            includeBread: true,
            breadAlertDeficit: true,
            breadAlertSurplus: false,
            eveningShelfExit: false
          };

          let cachedProducts = null;
          /** 📋 ile manuel açılınca sabah/akşam ayırmadan stok tablosuna geçilir */
          let manualShelfToggle = false;

          /* BARKOD HAVUZU
             Uc kaynak birlesti: firin urunlerinin disa aktarimi (CSV), site
             katalogundaki "Ekmek (N g)" ve "Ramazan Pidesi (N g)" gramaj
             varyantlari, ve panelde gorulen adlar.

             Gramaj ADIN PARCASI: "Ekmek (200 g)" ile "Ekmek (250 g)" ayri
             urun, ayri barkod. Eslestirme bu yuzden parantez icini atmiyor.

             Ayni gramajin birkac bolgesel barkodu olabiliyor (agri200,
             batman200 gibi); genel desen olan F001/F003 tercih ediliyor. */
          const FIRIN_CATALOG = JSON.parse(
            '[{"Urun_Adi": "Ekmek (200 g)", "Barkod": "F001200"}, {"Urun_Adi": "Ekmek (210 g)", "Barkod": "F001210"}, {"Urun_Adi": "Ekmek (250 g)", "Barkod": "F001250"}, {"Urun_Adi": "Ekmek (260 g)", "Barkod": "F001260"}, {"Urun_Adi": "Ekmek (280 g)", "Barkod": "F001280"}, {"Urun_Adi": "Ekmek (290 g)", "Barkod": "F001290"}, {"Urun_Adi": "La Lorraine - Uğur/UDD 560 BK - Donuk Dolap (Sandık Tipi 150 cm)", "Barkod": "108181500700900"}, {"Urun_Adi": "La Lorraine Antep Fıstıklı Kruvasan (75 g)", "Barkod": "8681573033743"}, {"Urun_Adi": "La Lorraine Baget Kraftı", "Barkod": "10300010"}, {"Urun_Adi": "La Lorraine Balkan Çöreği (85 g)", "Barkod": "8681573031961"}, {"Urun_Adi": "La Lorraine Börek Paketi (2 Ürün)", "Barkod": "lalorraineborek_bundle"}, {"Urun_Adi": "La Lorraine Ciabatta (105 g)", "Barkod": "8681573030537"}, {"Urun_Adi": "La Lorraine Ciabatta (145 g)", "Barkod": "8681573033712"}, {"Urun_Adi": "La Lorraine Dondurulmuş Mini Ciabatta (10\'lu)", "Barkod": "4400147"}, {"Urun_Adi": "La Lorraine Dondurulmuş Mini Esmer Baget (10\'lu)", "Barkod": "8699975525391"}, {"Urun_Adi": "La Lorraine Dondurulmuş Mini Rustik Baget (10\'lu)", "Barkod": "4400152"}, {"Urun_Adi": "La Lorraine Dondurulmuş Mini Sade Baget (10\'lu)", "Barkod": "8699975525353"}, {"Urun_Adi": "La Lorraine Ekmek Kraftı", "Barkod": "10300008"}, {"Urun_Adi": "La Lorraine Ekşi Mayalı Kare Rustik Ekmek (385 g)", "Barkod": "8681573033927"}, {"Urun_Adi": "La Lorraine Ekşi Mayalı Tam Buğday Ekmeği (380 g)", "Barkod": "8681573033804"}, {"Urun_Adi": "La Lorraine Fındıklı ve Çikolata Kremalı Çörek (80 g)", "Barkod": "8681573031978"}, {"Urun_Adi": "La Lorraine Ispanaklı Börek (85 g)", "Barkod": "8681573031756"}, {"Urun_Adi": "La Lorraine Ispanaklı Börek İkilisi (2 x 85 g)", "Barkod": "lalorraineıspanaklıbörek2lig10"}, {"Urun_Adi": "La Lorraine Ispanaklı Börek İkilisi (2 x 95 g)", "Barkod": "ıspanaklıbörekikilisi"}, {"Urun_Adi": "La Lorraine Jalapeno Biberli Peynirli Çörek (1 Adet)", "Barkod": "8681573033767"}, {"Urun_Adi": "La Lorraine Kare Rustik Ekmek (385 g)", "Barkod": "8681573030278"}, {"Urun_Adi": "La Lorraine Kruvasan Paketi (2 Ürün)", "Barkod": "lalorrainekruvasan_pkt"}, {"Urun_Adi": "La Lorraine Kuru Domatesli Fesleğenli Baget (135 g)", "Barkod": "8681573033842"}, {"Urun_Adi": "La Lorraine Kıymalı Patatesli Börek (2 x 95 g)", "Barkod": "lalorrainekıymalıpatateslibörek2li"}, {"Urun_Adi": "La Lorraine Kıymalı Patatesli Börek (80 g)", "Barkod": "8681573031824"}, {"Urun_Adi": "La Lorraine Patatesli Rulo Börek (85 g)", "Barkod": "8681573031749"}, {"Urun_Adi": "La Lorraine Patlıcanlı Rulo Börek (80 g)", "Barkod": "8681573032180"}, {"Urun_Adi": "La Lorraine Peynirli Danish Çörek (65 g)", "Barkod": "8681573032319"}, {"Urun_Adi": "La Lorraine Peynirli Kruvasan (65 g)", "Barkod": "8681573032302"}, {"Urun_Adi": "La Lorraine Peynirli Milföy Böreği (105 g)", "Barkod": "8681573033705"}, {"Urun_Adi": "La Lorraine Peynirli Poğaça (2 x 75 g)", "Barkod": "lalorraine2lipogaca_cmn"}, {"Urun_Adi": "La Lorraine Peynirli Poğaça (73 g)", "Barkod": "8681573033194"}, {"Urun_Adi": "La Lorraine Peynirli Rulo Börek (85 g)", "Barkod": "8681573031732"}, {"Urun_Adi": "La Lorraine Pizza Çörek (110 g)", "Barkod": "8681573033415"}, {"Urun_Adi": "La Lorraine Rustik Esmer Baget Ekmek (95 g)", "Barkod": "8681573030063"}, {"Urun_Adi": "La Lorraine Sade Baget (255 g)", "Barkod": "8681573030896"}, {"Urun_Adi": "La Lorraine Sokak Simiti (2 x 90 g)", "Barkod": "lalorreınesımıt2lı_g10"}, {"Urun_Adi": "La Lorraine Sokak Simiti (90 g)", "Barkod": "8681573033125"}, {"Urun_Adi": "La Lorraine Tam Buğday Ekmeği (360 g)", "Barkod": "8681573033446"}, {"Urun_Adi": "La Lorraine Tam Buğday Unlu Ekmek (350 g)", "Barkod": "4400154"}, {"Urun_Adi": "La Lorraine Taze Baget (110 g)", "Barkod": "5941878404789"}, {"Urun_Adi": "La Lorraine Taze Baget (2 x 110 g)", "Barkod": "66990addc0f970edb6d176af_g10_gb_x2"}, {"Urun_Adi": "La Lorraine Taze Ekmek Paketi (2 Ürün)", "Barkod": "g10_lalrraine_tze_ekmk"}, {"Urun_Adi": "La Lorraine Tereyağlı Kruvasan (55 g)", "Barkod": "8681573031923"}, {"Urun_Adi": "La Lorraine Tereyağlı Kruvasan İkilisi (2 x 55 g)", "Barkod": "lalorrainekruvasan2li_cmn"}, {"Urun_Adi": "La Lorraine Tombul Ekmek (320 g)", "Barkod": "8681573030612"}, {"Urun_Adi": "La Lorraine Vanilya Kremalı Kruvasan (80 g)", "Barkod": "8681573033637"}, {"Urun_Adi": "La Lorraine Yenilenen Tombul Ekmek (300 g)", "Barkod": "5941878404550"}, {"Urun_Adi": "La Lorraine Zeytinli Kekikli Rustik Baget (110 g)", "Barkod": "8681573033316"}, {"Urun_Adi": "La Lorraine Çavdar Ekmeği (300 g)", "Barkod": "4400155"}, {"Urun_Adi": "La Lorraine Çavdar Ekmeği (380 g) (380 g)", "Barkod": "8681573033439"}, {"Urun_Adi": "La Lorraine Çikolata Dolgulu Kruvasan  (65 g)", "Barkod": "8681573032241"}, {"Urun_Adi": "La Lorraine Çikolata Kremalı Kruvasan (65 g)", "Barkod": "8681573031954"}, {"Urun_Adi": "La Lorraine Çilekli Danish Çörek (2 x 80 g)", "Barkod": "çileklidanishg10"}, {"Urun_Adi": "La Lorraine Çilekli Danish Çörek (65 g)", "Barkod": "8681573032258"}, {"Urun_Adi": "La Lorraine Çörek Kraftı", "Barkod": "10300006"}, {"Urun_Adi": "La Lorraine Üzümlü Çörek (80 g)", "Barkod": "8681573031992"}, {"Urun_Adi": "La Lorraine Üç Peynirli Mini Çörek (2 x 24 g)", "Barkod": "minicörekg10bundle2li"}, {"Urun_Adi": "La Lorraine Üç Peynirli Mini Çörek (24 g)", "Barkod": "8681573033392"}, {"Urun_Adi": "La Lorraine İki Peynirli Çörek (80 g)", "Barkod": "8681573033408"}, {"Urun_Adi": "Ramazan Pidesi (200 g)", "Barkod": "F003200"}, {"Urun_Adi": "Ramazan Pidesi (210 g)", "Barkod": "F003210"}, {"Urun_Adi": "Ramazan Pidesi (220 g)", "Barkod": "F003220"}, {"Urun_Adi": "Ramazan Pidesi (240 g)", "Barkod": "F003240"}, {"Urun_Adi": "Ramazan Pidesi (250 g)", "Barkod": "F003250"}, {"Urun_Adi": "Ramazan Pidesi (260 g)", "Barkod": "F003260"}, {"Urun_Adi": "Ramazan Pidesi (270 g)", "Barkod": "F003270"}, {"Urun_Adi": "Ramazan Pidesi (275 g)", "Barkod": "F003275"}, {"Urun_Adi": "Ramazan Pidesi (280 g)", "Barkod": "F003280"}, {"Urun_Adi": "Ramazan Pidesi (300 g)", "Barkod": "F003300"}, {"Urun_Adi": "Ramazan Pidesi (310 g)", "Barkod": "F003310"}, {"Urun_Adi": "Ramazan Pidesi (320 g)", "Barkod": "F003320"}, {"Urun_Adi": "Ramazan Pidesi (325 g)", "Barkod": "F003325"}, {"Urun_Adi": "Ramazan Pidesi (330 g)", "Barkod": "F003330"}, {"Urun_Adi": "Ramazan Pidesi (335 g)", "Barkod": "F003335"}, {"Urun_Adi": "Ramazan Pidesi (340 g)", "Barkod": "F003340"}, {"Urun_Adi": "Ramazan Pidesi (350 g)", "Barkod": "F003350"}, {"Urun_Adi": "Ramazan Pidesi (360 g)", "Barkod": "F003360"}, {"Urun_Adi": "Ramazan Pidesi (370 g)", "Barkod": "F003370"}, {"Urun_Adi": "Ramazan Pidesi (380 g)", "Barkod": "F003380"}, {"Urun_Adi": "Ramazan Pidesi (400 g)", "Barkod": "F003400"}, {"Urun_Adi": "Ramazan Pidesi (420 g)", "Barkod": "F003420"}, {"Urun_Adi": "Ramazan Pidesi (440 g)", "Barkod": "F003440"}, {"Urun_Adi": "Ramazan Pidesi (450 g)", "Barkod": "F003450"}, {"Urun_Adi": "Ramazan Pidesi (500 g)", "Barkod": "F003500"}]'
          );

          /** Yeni barkod ekleyince firin.json ile bu JSON'ı eşleştirip yeniden bookmarklet oluştur. */

          const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
          const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
          const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
          const EAN_FIRST_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

          /* GRAMAJ ADIN PARÇASI
             Eskiden parantez içi silinip atılıyordu; "Ekmek (200 g)" ile
             "Ekmek (250 g)" aynı isme indirgeniyor ve ikisi de aynı barkodu
             alıyordu. Oysa bunlar ayrı ürün, ayrı barkod. Gramaj artık adın
             sonuna sayı olarak ekleniyor: "ekmek 200". */
          function gramajCikar(s) {
            const m = String(s || '').match(/\(\s*(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(g|gr|kg|ml|l)\s*\)/i);
            if (!m) return '';
            /* Çarpan da imzaya giriyor: "2 x 110 g" ile "110 g" ayrı ürün,
               ayrı barkod. Atlanırsa depocu ikili paketin barkodunu tek
               ürün için okutuyor. */
            const adet = m[1] ? m[1] + 'x' : '';
            const sayi = m[2].replace(',', '.');
            const birim = m[3].toLowerCase();
            return adet + sayi + (birim === 'gr' ? 'g' : birim);
          }

          function normalizeNameForBarcodeMatch(s, gramajsiz) {
            const gramaj = gramajsiz ? '' : gramajCikar(s);
            const govde = String(s || '')
              .toLowerCase()
              .normalize('NFKD')
              .replace(/\p{M}+/gu, '')
              .replace(/l[\s.]*lorraine\s*/gi, '')
              .replace(/\([^)]*\)/g, ' ')
              .replace(/[^\p{L}\p{N}\s]/gu, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            return gramaj ? govde + ' ' + gramaj : govde;
          }

          /* Eşleştirme üç kademe, sırayla:
               1. Gramajıyla birebir  -> "ekmek 200" = "ekmek 200"
               2. Gramajsız birebir   -> ada tam uyan tek kayıt varsa
               3. Parça eşleşmesi     -> en uzun ortak gövde

             İkinci kademede birden çok aday varsa hiçbiri seçilmiyor:
             gramajı bilinmeyen "Ekmek" için rastgele bir gramajın barkodunu
             vermek, depocunun yanlış ürün okutması demek. */
          function lookupEan13ForDisplayName(displayName) {
            const pn = normalizeNameForBarcodeMatch(displayName);
            if (!pn || pn.length < 4) return '';

            let exact = '';
            FIRIN_CATALOG.forEach((row) => {
              if (normalizeNameForBarcodeMatch(row.Urun_Adi) === pn) exact = row.Barkod;
            });
            if (exact) return exact;

            const pnSade = normalizeNameForBarcodeMatch(displayName, true);
            const adaylar = [];
            FIRIN_CATALOG.forEach((row) => {
              if (normalizeNameForBarcodeMatch(row.Urun_Adi, true) === pnSade) adaylar.push(row.Barkod);
            });
            if (adaylar.length === 1) return adaylar[0];
            if (adaylar.length > 1) return '';

            let best = '';
            let bestKn = '';
            FIRIN_CATALOG.forEach((row) => {
              const kn = normalizeNameForBarcodeMatch(row.Urun_Adi, true);
              if (!kn || kn.length < 8) return;
              if (pnSade.includes(kn) || kn.includes(pnSade)) {
                if (kn.length > bestKn.length) {
                  bestKn = kn;
                  best = row.Barkod;
                }
              }
            });
            return best;
          }

          function ean13CheckDigit(body12) {
            let sum = 0;
            for (let i = 0; i < 12; i++) sum += parseInt(body12[i], 10) * (i % 2 === 0 ? 1 : 3);
            const ch = (10 - (sum % 10)) % 10;
            return String(ch);
          }

          /** Çizilebilir 13 rakam döndürür (gerekirse kontrol rakamını düzeltir) */
          function ean13CanonicalForDrawing(raw) {
            if (!/^\d{13}$/.test(raw)) return null;
            const body = raw.slice(0, 12);
            return body + ean13CheckDigit(body);
          }

          function ean13EncodeBits(canonical13) {
            const digits = canonical13.split('').map((c) => parseInt(c, 10));
            const parity = EAN_FIRST_PARITY[digits[0]];
            if (!parity) return null;
            let bits = '101';
            for (let i = 1; i <= 6; i++) {
              const ch = parity[i - 1] === 'L' ? EAN_L[digits[i]] : EAN_G[digits[i]];
              bits += ch;
            }
            bits += '01010';
            for (let i = 7; i <= 12; i++) bits += EAN_R[digits[i]];
            bits += '101';
            return bits;
          }

          /** Barkod görünümü (Getir/grid tarzı: guard uzun çubuk, veri çubukları kısa). */
          const EAN_BAR = {
            viewW: 222,
            viewH: 72,
            pad: 4,
            leadW: 24,
            module: 2,
            hGuard: 56.6,
            hData: 47.6,
            fontPx: 14,
            digitYInBarRow: 59.8,
            /** Önceki yaklaşık 260 px genişliğin ~%70 küçültülmüş ekran boyutu */
            displayScale: 78 / 222
          };

          function isEan13GuardIndex(i) {
            if (i < 3) return true;
            if (i >= 45 && i <= 49) return true;
            if (i >= 92) return true;
            return false;
          }

          function svgEan13BarCode(canonical13, shelfLargerDisplay) {
            const bits = ean13EncodeBits(canonical13);
            if (!bits || bits.length !== 95) return '';
            const d0 = canonical13[0];
            const leftLabel = canonical13.slice(1, 7);
            const rightLabel = canonical13.slice(7, 13);
            const bx = EAN_BAR.pad + EAN_BAR.leadW;
            const ty = String(EAN_BAR.digitYInBarRow);
            const fs = String(EAN_BAR.fontPx);
            const rects = [];
            let i = 0;
            while (i < bits.length) {
              if (bits[i] !== '1') {
                i++;
                continue;
              }
              const guard = isEan13GuardIndex(i);
              let j = i;
              while (
                j < bits.length &&
                bits[j] === '1' &&
                isEan13GuardIndex(j) === guard
              ) {
                j++;
              }
              const run = j - i;
              const x = bx + i * EAN_BAR.module;
              const h = guard ? EAN_BAR.hGuard : EAN_BAR.hData;
              rects.push(`<rect x="${x}" y="0" width="${run * EAN_BAR.module}" height="${h}" />`);
              i = j;
            }
            const xLeftNums = bx + (3 + 21) * EAN_BAR.module;
            const xRightNums = bx + (50 + 21) * EAN_BAR.module;
            const scale = shelfLargerDisplay ? EAN_BAR.displayScale * 1.58 : EAN_BAR.displayScale;
            const dw = +(EAN_BAR.viewW * scale).toFixed(2);
            const dh = +(EAN_BAR.viewH * scale).toFixed(2);
            return (
              `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" viewBox="0 0 ${EAN_BAR.viewW} ${EAN_BAR.viewH}" preserveAspectRatio="xMinYMin meet" aria-label="EAN-13 barkod ${canonical13}" role="img" title="${canonical13}">` +
              `<rect x="0" y="0" width="${EAN_BAR.viewW}" height="${EAN_BAR.viewH}" fill="transparent" />` +
              `<g transform="translate(${EAN_BAR.pad}, ${EAN_BAR.pad})" fill="#000">` +
              `<text font-weight="700" font-size="${fs}" font-family="ui-monospace,Consolas,'Courier New',monospace" x="0" y="${ty}" text-anchor="start">${d0}</text>` +
              `</g>` +
              `<g transform="translate(0, ${EAN_BAR.pad})" fill="#000">${rects.join('')}</g>` +
              `<g transform="translate(0, ${EAN_BAR.pad})" fill="#000">` +
              `<text font-weight="700" font-size="${fs}" font-family="ui-monospace,Consolas,'Courier New',monospace" text-anchor="middle" x="${xLeftNums}" y="${ty}">${leftLabel}</text>` +
              `<text font-weight="700" font-size="${fs}" font-family="ui-monospace,Consolas,'Courier New',monospace" text-anchor="middle" x="${xRightNums}" y="${ty}">${rightLabel}</text>` +
              `</g></svg>`
            );
          }


          /* ============================================================
             CODE 128-B
             Fırın ürünlerinin bir kısmının barkodu EAN-13 değil: "F001200",
             "agri200", "lalorrainekruvasan_pkt" gibi harf taşıyan iç kodlar.
             Çizim katmanı yalnız 13 haneli sayı kabul ediyordu, bu yüzden
             havuzda kaydı OLAN ürünler için bile "barkod kaydı yok"
             yazıyordu. Kayıt vardı, çizilemiyordu.

             Code 128-B bu kodları olduğu gibi taşıyor: ASCII 32-126 arası
             her karakter, 11 modül genişliğinde altı elemanla kodlanıyor.
             ============================================================ */
          const C128_DESEN = [
            '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
            '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
            '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
            '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
            '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
            '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
            '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
            '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
            '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
            '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
            '114131','311141','411131','211412','211214','211232','2331112'
          ];

          function code128BBitleri(metin) {
            const kodlar = [104];               // Start B
            for (let i = 0; i < metin.length; i++) {
              const c = metin.charCodeAt(i);
              if (c < 32 || c > 126) return null;   // Code B dışı
              kodlar.push(c - 32);
            }
            let toplam = 104;
            for (let i = 1; i < kodlar.length; i++) toplam += kodlar[i] * i;
            kodlar.push(toplam % 103);          // kontrol
            kodlar.push(106);                   // Stop

            let bit = '';
            kodlar.forEach((k) => {
              const d = C128_DESEN[k];
              if (!d) return;
              for (let i = 0; i < d.length; i++) {
                const genislik = parseInt(d[i], 10);
                bit += (i % 2 === 0 ? '1' : '0').repeat(genislik);
              }
            });
            return bit;
          }

          function svgCode128BarCode(metin, shelfLargerDisplay) {
            const bits = code128BBitleri(metin);
            if (!bits) return '';
            const modul = 1.4;
            const pad = 4;
            const yaziPx = 12;
            const cizgiY = 46;
            const genislik = bits.length * modul + pad * 2;
            const yukseklik = cizgiY + yaziPx + 8;

            const rects = [];
            let i = 0;
            while (i < bits.length) {
              if (bits[i] !== '1') { i++; continue; }
              let j = i;
              while (j < bits.length && bits[j] === '1') j++;
              rects.push('<rect x="' + (pad + i * modul).toFixed(2) + '" y="0" width="' +
                         ((j - i) * modul).toFixed(2) + '" height="' + cizgiY + '" />');
              i = j;
            }
            const olcek = (shelfLargerDisplay ? 124 : 92) / genislik;
            const dw = +(genislik * olcek).toFixed(2);
            const dh = +(yukseklik * olcek).toFixed(2);
            const kacir = metin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            return (
              '<svg xmlns="http://www.w3.org/2000/svg" width="' + dw + '" height="' + dh +
              '" viewBox="0 0 ' + genislik.toFixed(2) + ' ' + yukseklik +
              '" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Barkod ' + kacir + '">' +
              '<rect x="0" y="0" width="' + genislik.toFixed(2) + '" height="' + yukseklik + '" fill="transparent" />' +
              '<g fill="#000">' + rects.join('') + '</g>' +
              '<text x="' + (genislik / 2).toFixed(2) + '" y="' + (cizgiY + yaziPx + 1) +
              '" fill="#000" font-weight="700" font-size="' + yaziPx +
              '" font-family="ui-monospace,Consolas,\'Courier New\',monospace" text-anchor="middle">' + kacir + '</text>' +
              '</svg>'
            );
          }

          function shelfBarcodeCornerInner(productName) {
            const listed = lookupEan13ForDisplayName(productName);
            if (!listed) return { barcode: '', mismatch: false };

            /* EAN-13 olmayan iç kodlar (F001200, agri200 ...) Code 128 ile
               çiziliyor. Eskiden bunlar sessizce eleniyor ve ürün barkodsuz
               görünüyordu. */
            if (!/^\d{13}$/.test(listed)) {
              const svg128 = svgCode128BarCode(listed, true);
              if (!svg128) return { barcode: '', mismatch: false };
              return {
                barcode: '<span style="display:block;line-height:0;" title="' +
                         listed.replace(/"/g, '&quot;') + '">' + svg128 + '</span>',
                mismatch: false
              };
            }

            const canon = ean13CanonicalForDrawing(listed);
            if (!canon) return { barcode: '', mismatch: false };
            const mismatch = listed !== canon;
            const svg = svgEan13BarCode(canon, true);
            if (!svg) return { barcode: '', mismatch };
            const warn = mismatch
              ? `<div style="font-size:0.55rem;color:#b45309;max-width:100%;line-height:1.25;text-align:right;margin:6px 0 0;">Liste ile kontrol rakamı uyuşmuyordu; etiketi doğrula.</div>`
              : '';
            return {
              barcode: `<span style="display:block;line-height:0;" title="${canon.replace(/"/g, '&quot;')}">${svg}</span>${warn}`,
              mismatch
            };
          }

          const styles = `
        #baking-assistant-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 99998; font-family: 'Inter', sans-serif; }
        #baking-assistant-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 800px; background: #f3f4f6; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 99999; overflow: visible; }
        #baking-assistant-header { background: white; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        #baking-assistant-header h2 { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin-right: auto; flex: 0 0 auto; }
        #baking-assistant-close { font-size: 1.5rem; font-weight: bold; cursor: pointer; color: #6b7280; background: none; border: none; line-height: 1; padding: 0.5rem; flex-shrink: 0; }
        #baking-assistant-settings { cursor: pointer; background: none; border: none; padding: 0.35rem; font-size: 1.35rem; line-height: 1; color: #4b5563; flex-shrink: 0; border-radius: 0.375rem; }
        #baking-assistant-settings:hover { background: #f3f4f6; color: #111827; }
        #baking-assistant-settings-popover { display: none; position: absolute; right: 1rem; top: 3.25rem; width: min(340px, calc(100% - 2rem)); background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.12); padding: 1rem; z-index: 100020; text-align: left; }
        #baking-assistant-settings-popover.open { display: block; }
        #baking-assistant-settings-popover h3 { margin: 0 0 0.75rem; font-size: 0.875rem; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
        #baking-assistant-settings-popover label { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.875rem; color: #1f2937; margin-bottom: 0.6rem; cursor: pointer; }
        #baking-assistant-settings-popover input[type="checkbox"] { margin-top: 0.2rem; }
        #baking-assistant-settings-popover .sub { padding-left: 1.75rem; margin-top: -0.25rem; margin-bottom: 0.65rem; color: #6b7280; font-size: 0.75rem; line-height: 1.35; }
        #baking-assistant-shelf-toggle { cursor: pointer; background: none; border: none; padding: 0.35rem; font-size: 1.35rem; line-height: 1; color: #4b5563; flex-shrink: 0; border-radius: 0.375rem; }
        #baking-assistant-shelf-toggle:hover { background: #f3f4f6; color: #111827; }
        #baking-assistant-shelf-toggle.pressed { background: #dbeafe; color: #1d40af; border: 1px solid #93c5fd; box-sizing: border-box; }
        .ba-corner-barcode svg { display: block; max-width: min(94px, 100%); height: auto; margin: 0; vertical-align: top; }
        .baking-card-shelf .ba-corner-barcode {
          flex: 1 1 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: flex-end;
          width: 100%;
          max-width: 100%;
          min-height: 0;
        }
        .baking-card-shelf .ba-shelf-bc svg {
          display: block;
          width: min(176px, 100%) !important;
          max-width: 100% !important;
          height: auto !important;
          max-height: 100% !important;
          margin: 0;
        }
        #baking-assistant-results { padding: 1rem; max-height: 70vh; overflow-y: auto; }
        .baking-card-shelf {
          display: grid !important;
          grid-template-columns: 52px minmax(0, 1fr) minmax(124px, 158px);
          grid-template-rows: auto auto auto;
          align-items: start;
          column-gap: 0.65rem;
          row-gap: 0.2rem;
          padding: 0.5rem 0.65rem !important;
          margin-bottom: 0.48rem !important;
          border-left-width: 4px !important;
        }
        .baking-card-shelf > .ba-shelf-img {
          grid-column: 1;
          grid-row: 1 / span 3;
          align-self: start;
        }
        .baking-card-shelf > .ba-shelf-title {
          grid-column: 2;
          grid-row: 1;
          margin: 0;
          padding: 0;
          font-weight: 700;
          font-size: 0.95rem;
          line-height: 1.25;
          color: #0f172a;
          min-width: 0;
          white-space: normal;
        }
        .baking-card-shelf > .ba-shelf-bc {
          grid-column: 3;
          grid-row: 1 / span 3;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: stretch;
          min-width: 0;
          min-height: 0;
          line-height: 0;
        }
        .baking-card-shelf > .ba-shelf-stock {
          grid-column: 2;
          grid-row: 2;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          align-content: flex-start;
          gap: 0.1rem 0.65rem;
          margin: 0;
          padding: 0;
          width: fit-content;
          max-width: 100%;
          justify-self: start;
        }
        .baking-card-shelf .ba-shelf-elde {
          font-size: 1.2rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .baking-card-shelf .ba-shelf-donuk {
          font-size: 0.72rem;
          color: #475569;
          font-variant-numeric: tabular-nums;
        }
        .baking-card-shelf .ba-shelf-firin-hint {
          font-size: 0.6rem;
          color: #94a3b8;
          flex: 0 0 100%;
          line-height: 1.35;
          margin-top: 0.2rem;
          min-width: 0;
        }
        .baking-card-shelf > .ba-shelf-dilim {
          grid-column: 2;
          grid-row: 3;
          margin: 0.25rem 0 0 !important;
          padding: 0.35rem 0 0 !important;
          border-top: 1px solid #e5e7eb;
          display: grid !important;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.2rem !important;
          text-align: center;
        }
        .baking-card { display: flex; align-items: stretch; padding: 1rem; border-left-width: 8px; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; background: white; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.5s ease-out forwards; }
        `;

          const styleSheet = document.createElement('style');
          styleSheet.type = 'text/css';
          styleSheet.innerText = styles;
          document.head.appendChild(styleSheet);

          const overlay = document.createElement('div');
          overlay.id = 'baking-assistant-overlay';
          const modal = document.createElement('div');
          modal.id = 'baking-assistant-modal';
          modal.innerHTML = `
        <div id="baking-assistant-header">
          <h2 id="baking-assistant-title">🥐 Pişirme önerileri</h2>
          <span id="baking-assistant-clock" style="font-size: 1.25rem; font-weight: 700; color: #1f2937;">--:--</span>
          <button type="button" id="baking-assistant-shelf-toggle" title="Stokta olan ürünleri ve barkodu göster" aria-label="Stok özeti" aria-pressed="false">📋</button>
          <button type="button" id="baking-assistant-settings" title="Ayarlar" aria-label="Ayarlar">⚙️</button>
          <button id="baking-assistant-close" aria-label="Kapat">&times;</button>
        </div>
        <div id="baking-assistant-settings-popover" role="dialog" aria-label="Ayarlar"></div>
        <div id="baking-assistant-results"></div>`;
          document.body.appendChild(overlay);
          document.body.appendChild(modal);

          const clockEl = document.getElementById('baking-assistant-clock');
          const updateClock = () => {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          };
          updateClock();
          const clockInterval = setInterval(updateClock, 1000);

          const closeModal = () => {
            clearInterval(clockInterval);
            const sp = document.getElementById('baking-assistant-settings-popover');
            if (sp) sp.classList.remove('open');
            overlay.remove();
            modal.remove();
          };
          document.getElementById('baking-assistant-close').onclick = closeModal;
          overlay.onclick = closeModal;

          const shelfToggleBtn = document.getElementById('baking-assistant-shelf-toggle');
          const headerTitleEl = document.getElementById('baking-assistant-title');
          const settingsBtn = document.getElementById('baking-assistant-settings');
          const settingsPopover = document.getElementById('baking-assistant-settings-popover');

          function renderSettingsForm() {
            const s = settingsState;
            settingsPopover.innerHTML =
              '<h3>Taze ekmek</h3>' +
              '<label><input type="checkbox" id="ba-set-include-bread" ' +
              (s.includeBread ? 'checked' : '') +
              '/> Listeye taze ekmeği dahil et</label>' +
              '<div class="sub">Yalnız «Ekmek (200 g)» ve «Ramazan Pidesi (300 g)» gibi ' +
              'gramajlı, markasız ürünler. Bunlar hamurdan üretiliyor, donuk stokları olmuyor. ' +
              'La Lorraine ürünleri bu ayardan etkilenmez.</div>' +
              '<label style="opacity:' +
              (s.includeBread ? '1' : '0.55') +
              '"><input type="checkbox" id="ba-set-bread-def" ' +
              (s.breadAlertDeficit ? 'checked' : '') +
              (s.includeBread ? '' : ' disabled') +
              '/> Taze ekmekte eksik stok uyarısı</label>' +
              '<label style="opacity:' +
              (s.includeBread ? '1' : '0.55') +
              '"><input type="checkbox" id="ba-set-bread-sur" ' +
              (s.breadAlertSurplus ? 'checked' : '') +
              (s.includeBread ? '' : ' disabled') +
              '/> Taze ekmekte fazla stok uyarısı</label>' +
              '<h3 style="margin-top:1rem">Gece çıkışı</h3>' +
              '<label><input type="checkbox" id="ba-set-evening" ' +
              (s.eveningShelfExit ? 'checked' : '') +
              '/> 23:00–23:59: yalnızca stokta olanlar</label>' +
              '<div class="sub">Bu saatlerde yalnızca elde görünen miktarı sıfırdan büyük ürünler listelenir (vardiya çıkışı; pişirme önerisi değil). Seçenekler tarayıcıda saklanır.</div>';

            settingsPopover.querySelector('#ba-set-include-bread').addEventListener('change', (ev) => {
              saveSettings({ includeBread: !!ev.target.checked });
              renderSettingsForm();
              applyViewFromCache();
            });
            settingsPopover.querySelector('#ba-set-bread-def').addEventListener('change', (ev) => {
              saveSettings({ breadAlertDeficit: !!ev.target.checked });
              applyViewFromCache();
            });
            settingsPopover.querySelector('#ba-set-bread-sur').addEventListener('change', (ev) => {
              saveSettings({ breadAlertSurplus: !!ev.target.checked });
              applyViewFromCache();
            });
            settingsPopover.querySelector('#ba-set-evening').addEventListener('change', (ev) => {
              saveSettings({ eveningShelfExit: !!ev.target.checked });
              applyViewFromCache();
            });
          }

          shelfToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            manualShelfToggle = !manualShelfToggle;
            settingsPopover.classList.remove('open');
            applyViewFromCache();
          });

          settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !settingsPopover.classList.contains('open');
            settingsPopover.classList.toggle('open', willOpen);
            if (willOpen) renderSettingsForm();
          });

          modal.addEventListener('click', (e) => {
            if (shelfToggleBtn.contains(e.target)) return;
            if (settingsBtn.contains(e.target)) return;
            if (settingsPopover.contains(e.target)) return;
            settingsPopover.classList.remove('open');
          });

          const resultsContainer = document.getElementById('baking-assistant-results');
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

          function loadSettings() {
            try {
              const raw = localStorage.getItem(SETTINGS_LS_KEY);
              if (!raw) return { ...SETTINGS_DEFAULT };
              return { ...SETTINGS_DEFAULT, ...JSON.parse(raw) };
            } catch (_) {
              return { ...SETTINGS_DEFAULT };
            }
          }

          let settingsState = loadSettings();

          function saveSettings(partial) {
            settingsState = { ...SETTINGS_DEFAULT, ...settingsState, ...partial };
            try {
              localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(settingsState));
            } catch (_) {}
            return settingsState;
          }

          /* EKMEK AYARLARI YALNIZ TAZE ÜRETİM İÇİN
             "Ekmek (200 g)" ve "Ramazan Pidesi (300 g)" gibi markasız,
             gramajlı ürünler fırında hamurdan üretiliyor. Donuk stokları
             hiçbir zaman olmaz. Ayarlardaki ekmek seçenekleri bunlar için
             var.

             Önce ad içinde "ekmek" ya da "pide" geçen HER ürün ekmek
             sayılıyordu. La Lorraine Tombul Ekmek, Kare Rustik Ekmek, Ekşi
             Mayalı Tam Buğday Ekmeği de bu ağa takılıyordu. Oysa onlar
             donuk hamurdan pişen sıradan ürünler, donuk stokları var.
             Ekmek kuralları onlara uygulanınca yanlış davranıyorlardı:
             ayar kapalıyken listeden siliniyorlar, açıkken "donukta stok
             görünmüyor" uyarısı alıyorlardı.

             Ayrım artık marka adının olup olmamasında. Adı doğrudan
             "Ekmek (N g)" ya da "Ramazan Pidesi (N g)" olan ürün taze
             üretimdir. Başında marka olan her şey sıradan üründür. */
          function isBreadProduct(name) {
            return /^\s*(ekmek|ramazan\s+pidesi)\s*\(\s*\d+\s*(g|gr)\s*\)\s*$/i.test(name || '');
          }

          /* Aynı kural. İki ad da kodda kullanılıyor, ikisi de tek yerden
             beslensin. */
          function tazeUretimMi(name) {
            return isBreadProduct(name);
          }

          function findHeatingCards() {
            const out = [];
            const seen = new Set();
            const add = (el) => {
              if (el && !seen.has(el)) {
                seen.add(el);
                out.push(el);
              }
            };

            document.querySelectorAll('[class*="heatingEstimationCard"]').forEach(add);
            if (out.length) return out.slice(0, 4);

            document.querySelectorAll('[class*="period-title"], .period-title').forEach((t) => {
              const card =
                t.closest('[class*="heatingEstimationCard"]') || t.closest('.ant-card') || t.closest('[class*="ant-card"]');
              add(card);
            });
            if (out.length) return out;

            const row = document.querySelector('main .ant-row, #root .ant-row, .ant-row');
            if (row) {
              row.querySelectorAll('.ant-col .ant-card').forEach((c) => {
                if (c.querySelector('[class*="period-title"], .period-title')) add(c);
              });
            }
            return out;
          }

          function filterRealProductRows(items) {
            return items.filter((el) => {
              const tx = el.textContent || '';
              if (!/\d/.test(tx)) return false;
              return /Pi[şs]ir/i.test(tx) || el.querySelector('[class*="progressBar"]');
            });
          }

          function getProductItemsFromCard(card) {
            let items = card.querySelectorAll('[class*="productCollapseItem"]');
            if (items.length) return Array.from(items);

            const collapse = card.querySelector('.ant-card-body .ant-collapse, .ant-collapse');
            if (collapse) {
              let direct = [];
              try {
                direct = Array.from(collapse.querySelectorAll(':scope > .ant-collapse-item'));
              } catch (e) {
                direct = [];
              }
              if (direct.length) return filterRealProductRows(direct);
            }

            const all = card.querySelectorAll('.ant-card-body .ant-collapse-item, .ant-collapse-item');
            return filterRealProductRows(Array.from(all));
          }

          function getClearFilterButtonsInOrder() {
            const out = [];
            const push = (b) => {
              if (b && out.indexOf(b) === -1) out.push(b);
            };

            findHeatingCards().forEach((card) => {
              const actions = card.querySelector('[class*="cardActions"]');
              if (!actions) return;
              actions.querySelectorAll('button.ant-btn-icon-only').forEach((btn) => {
                if (btn.innerHTML.includes(CLEAR_BTN_SVG_MARK)) push(btn);
              });
            });
            if (out.length) return out;

            document.querySelectorAll('button.ant-btn-icon-only').forEach((btn) => {
              if (btn.innerHTML.includes(CLEAR_BTN_SVG_MARK)) push(btn);
            });
            return out;
          }

          async function clickAllClearFilters(forceAll) {
            const btns = getClearFilterButtonsInOrder();
            for (let i = 0; i < btns.length; i++) {
              const b = btns[i];
              if (forceAll || !b.classList.contains('ant-btn-primary')) {
                b.click();
                await sleep(240);
              }
            }
            await sleep(550);
          }

          /* KART AÇIK MI
             İki bağımsız kanıt kullanılıyor:

             1. Panelin kendi işareti: kaç satır `ant-collapse-item-active`.
                Asıl ölçüt bu, çünkü stok hücreleri satır açıkken DOM'a giriyor.
             2. Düğmenin ikonu: kapalıyken artı, açıkken çarpı. Sınıf listesi
                iki durumda da birebir aynı olduğu için durum ancak buradan
                okunuyor.

             İkincisi tek başına yetmiyor (kullanıcı elle bir satırı kapatmış
             olabilir), ama birincinin doğrulaması olarak duruyor: satırların
             hepsi açık görünüp düğme hâlâ artıysa panel henüz çizmemiş
             demektir ve bir tur daha beklemek gerekiyor. */
          function kartSatirDurumu(card) {
            const collapse = card.querySelector('.ant-card-body .ant-collapse, .ant-collapse');
            if (!collapse) return { toplam: 0, acik: 0 };
            let items = [];
            try {
              items = Array.from(collapse.querySelectorAll(':scope > .ant-collapse-item'));
            } catch (_) {
              items = [];
            }
            return {
              toplam: items.length,
              acik: items.filter((x) => x.classList.contains('ant-collapse-item-active')).length
            };
          }

          /* Düğme ikonundan durum: '' bilinmiyor, 'acik' çarpı, 'kapali' artı. */
          function dugmeDurumu(card) {
            const btn = acKapaDugmesi(card);
            if (!btn) return '';
            const ic = btn.innerHTML;
            if (ic.indexOf(CARPI_SVG_IZ) !== -1) return 'acik';
            if (ic.indexOf(ARTI_SVG_IZ) !== -1) return 'kapali';
            return '';
          }

          function heatingCardNeedsDetailExpand(card) {
            const d = kartSatirDurumu(card);
            if (!d.toplam) return false;
            if (d.acik < d.toplam) return true;
            /* Satırlar açık görünüyor ama düğme hâlâ "aç" diyorsa panel
               henüz oturmamış; kapalı sayıp bir tur daha bekliyoruz. */
            return dugmeDurumu(card) === 'kapali';
          }

          /* Kart başlığındaki aç/kapa düğmesi. Dört kademeli arama:
             güncel SVG izi, eski sürüm izi, title'sız düğme (sıralama
             düğmesinin title'ı hep dolu), en son da sondaki düğme. */
          function acKapaDugmesi(card) {
            const kok = card.querySelector('[class*="cardActions"]') || card.querySelector('.ant-card-head') || card;
            const hepsi = Array.from(kok.querySelectorAll('button.ant-btn-icon-only'));
            if (!hepsi.length) return null;

            const ile = (iz) => hepsi.filter((b) => b.innerHTML.indexOf(iz) !== -1)[0] || null;
            return (
              ile(AC_KAPA_SVG_IZ) ||
              ile(CLIPBOARD_BTN_SVG_MARK) ||
              hepsi.filter((b) => !(b.getAttribute('title') || '').trim())[0] ||
              hepsi[hepsi.length - 1]
            );
          }

          /* Tek kartı açar. Düğme aç/kapa olduğu için ters yönde de
             çalışabilir; o yüzden tıklanıp SONUÇ ölçülüyor ve hedefe
             varılana kadar tekrarlanıyor. Dört deneme fazlasıyla yeter. */
          async function kartiAc(card) {
            for (let deneme = 0; deneme < 4; deneme++) {
              if (!heatingCardNeedsDetailExpand(card)) return true;
              const btn = acKapaDugmesi(card);
              if (!btn) return false;
              btn.click();
              await sleep(320);
              if (!heatingCardNeedsDetailExpand(card)) return true;
              await sleep(220);
            }
            return !heatingCardNeedsDetailExpand(card);
          }

          async function expandPanelClipboardIfNeeded() {
            const cards = findHeatingCards().slice(0, 4);
            for (let c = 0; c < cards.length; c++) await kartiAc(cards[c]);
            await sleep(180);
          }

          /* Stok hücreleri yalnız sütun açıkken DOM'a giriyor. Hepsi sıfırsa
             ya depo gerçekten boş ya da sütun açılmamış; ikincisini elemek
             için bir tur daha deneniyor. */
          /* Eskiden "en az bir üründe stok var mı" diye bakılıyordu. Tek bir
             ürünün stok hücresi hiç açılmamışsa o kontrol geçiyor ve o ürün
             sıfır stokla listeye giriyordu; Tombul Ekmek ve Kare Rustik
             Ekmek böyle kayboluyordu. Artık HER ürün tek tek soruluyor. */
          function stokOkunmayanlar(products) {
            return (products || []).filter((p) => !p.stokOkundu);
          }

          function stokOkunduMu(products) {
            return !!(products || []).length && stokOkunmayanlar(products).length === 0;
          }

          /**
           * Dört saat sütununu okumaya hazır hâle getirir.
           *
           * Açma düğmesi eski bir SVG iziyle (`M9 9H4v1h5V9z`) aranıyordu.
           * Getir o ikonu değiştirmiş; iz hiçbir düğmeyle eşleşmediği için
           * yıllardır TEK BİR TIKLAMA bile yapılmıyordu. Sütun kapalıyken
           * ürün adı ile "N Pişir" yine okunuyor, ama Raf ve Donuk hücreleri
           * DOM'da olmadığı için sıfır kalıyordu. `products.length` sıfır
           * olmadığından da yeniden deneme tetiklenmiyordu: eksik veri
           * sessizce doğru sanılıyordu.
           *
           * Artık düğme güncel iziyle bulunuyor, tıklanıyor ve AÇILDIĞI
           * DOĞRULANIYOR. Kapalı kalan varsa üç tura kadar tekrar deneniyor.
           */
          async function sutunlariAcVeDogrula() {
            await clickAllClearFilters(false);
            for (let tur = 0; tur < 3; tur++) {
              await expandPanelClipboardIfNeeded();
              const kapali = findHeatingCards()
                .slice(0, 4)
                .filter(heatingCardNeedsDetailExpand);
              if (!kapali.length) return true;
              await sleep(400);
            }
            return false;
          }

          function parseLegacyTable() {
            const rows = document.querySelectorAll('tbody tr');
            const products = [];
            rows.forEach((row) => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 7) {
                const nameTag = cells[0].querySelector('.ant-tag');
                const imgSrc = cells[0].querySelector('img')?.src;
                if (nameTag && imgSrc) {
                  products.push({
                    name: nameTag.innerText.trim(),
                    imgSrc,
                    currentStock: parseInt(cells[1].innerText, 10) || 0,
                    frozenStock: parseInt(cells[2].innerText, 10) || 0,
                    recommendations: [
                      parseInt(cells[3].innerText, 10) || 0,
                      parseInt(cells[4].innerText, 10) || 0,
                      parseInt(cells[5].innerText, 10) || 0,
                      parseInt(cells[6].innerText, 10) || 0
                    ]
                  });
                }
              }
            });
            return products;
          }

          function parseNameImgFromItem(item) {
            const nameEl =
              item.querySelector('[class*="productAvatar"] .ant-typography') ||
              item.querySelector('.ant-collapse-header-text .ant-typography') ||
              item.querySelector('.ant-collapse-header .ant-typography') ||
              item.querySelector('span.ant-typography');
            const img =
              item.querySelector('[class*="productAvatar"] img') ||
              item.querySelector('.ant-collapse-header img') ||
              item.querySelector('img');

            let name = nameEl?.textContent?.trim() || '';
            if (!name) {
              const header = item.querySelector('.ant-collapse-header') || item;
              let raw = (header.textContent || '').replace(/\s+/g, ' ').trim();
              raw = raw.replace(/\d+\s*Pi[şs]ir.*/i, '').trim();
              name = raw.slice(0, 200);
            }
            if (!name) {
              const src = img?.src || '';
              const base = decodeURIComponent(src.split('/').pop() || '').split('?')[0] || 'Ürün';
              name = base.slice(0, 100);
            }
            return { name, imgSrc: img?.src || '' };
          }

          function parsePisirCount(item) {
            const el =
              item.querySelector('[class*="progressBarLabel"]') ||
              item.querySelector('[class*="progressBarWrapper"]') ||
              item.querySelector('[class*="progressBar"]');
            let m = el?.textContent?.match(/(\d+)\s*Pi[şs]ir/i);
            if (!m) m = (item.textContent || '').match(/(\d+)\s*Pi[şs]ir/i);
            return m ? parseInt(m[1], 10) : 0;
          }

          /* Stok hücreleri yalnız satır AÇIKKEN DOM'da. Okundu mu bilgisi
             geri dönüyor: hiç okunmayan ürün sessizce sıfır stokla
             geçmesin. */
          function applyStocksFromItem(product, item) {
            let okundu = false;
            item.querySelectorAll('[class*="stockCell"]').forEach((cell) => {
              const lab = cell.querySelector('[class*="stockLabel"]')?.textContent?.trim() || '';
              const raw = cell.querySelector('[class*="stockValue"]')?.textContent;
              const val = parseInt(raw, 10);
              if (Number.isNaN(val)) return;
              if (lab === 'Raf' || (lab.length && lab.indexOf('Raf') !== -1)) { product.currentStock = val; okundu = true; }
              if (lab === 'Donuk' || (lab.length && lab.indexOf('Donuk') !== -1)) { product.frozenStock = val; okundu = true; }
            });
            if (okundu) product.stokOkundu = true;
            return okundu;
          }

          function parseHeatingPanels() {
            const cards = findHeatingCards().slice(0, 4);
            if (cards.length === 0) return [];
            const byName = new Map();
            cards.forEach((card, slotIndex) => {
              /* Panel dörtten fazla kart çizerse fazlası dizinin dışına
                 yazılır ve `recommendations` bozulurdu. */
              if (slotIndex > 3) return;
              getProductItemsFromCard(card).forEach((item) => {
                const { name, imgSrc } = parseNameImgFromItem(item);
                if (!name) return;
                if (!byName.has(name)) {
                  byName.set(name, {
                    name,
                    imgSrc,
                    currentStock: 0,
                    frozenStock: 0,
                    stokOkundu: false,
                    recommendations: [0, 0, 0, 0]
                  });
                }
                const p = byName.get(name);
                if (imgSrc) p.imgSrc = imgSrc;
                p.recommendations[slotIndex] = parsePisirCount(item);
                applyStocksFromItem(p, item);
              });
            });
            return Array.from(byName.values());
          }

          function parseProductsFromPage() {
            const fromPanels = parseHeatingPanels();
            if (fromPanels.length) return fromPanels;
            return parseLegacyTable();
          }

          function getCurrentTimeSlot(hours) {
            if (hours >= 8 && hours < 12) return { index: 0, name: '08:00-12:00', start: 8, end: 12 };
            if (hours >= 12 && hours < 16) return { index: 1, name: '12:00-16:00', start: 12, end: 16 };
            if (hours >= 16 && hours < 20) return { index: 2, name: '16:00-20:00', start: 16, end: 20 };
            return { index: 3, name: '20:00-00:00', start: 20, end: 24 };
          }

          function collectShelfStockRows(products, settings) {
            const rows = [];
            products.forEach((p) => {
              if (!settings.includeBread && isBreadProduct(p.name)) return;
              const elde = Number(p.currentStock) || 0;
              if (elde <= 0) return;
              rows.push({ ...p });
            });
            rows.sort((a, b) => b.currentStock - a.currentStock || String(a.name).localeCompare(String(b.name), 'tr'));
            return rows;
          }

          function buildViewModel(products, settings) {
            const now = new Date();
            const h = now.getHours();
            const { index: currentSlotIndex } = getCurrentTimeSlot(h);
            const eveningShelf = settings.eveningShelfExit && h === 23;
            const useShelfMode = manualShelfToggle || eveningShelf;
            let shelfBannerKind = 'evening';
            if (manualShelfToggle && eveningShelf) shelfBannerKind = 'both';
            else if (manualShelfToggle) shelfBannerKind = 'manual';

            if (useShelfMode) {
              const rows = collectShelfStockRows(products, settings);
              return { mode: 'shelf-exit', rows, currentSlotIndex, shelfBannerKind };
            }
            return {
              mode: 'cook',
              rows: generateCookingRecommendations(products, settings),
              currentSlotIndex
            };
          }

          function refreshShelfChrome() {
            const h = new Date().getHours();
            const onShelfView = manualShelfToggle || (settingsState.eveningShelfExit && h === 23);
            shelfToggleBtn.classList.toggle('pressed', manualShelfToggle);
            shelfToggleBtn.setAttribute('aria-pressed', manualShelfToggle ? 'true' : 'false');
            shelfToggleBtn.title = manualShelfToggle ? 'Pişirme önerilerine geri dön' : 'Stokta olan ürünleri ve barkodu göster';
            headerTitleEl.textContent = onShelfView ? '📋 Eldeki stok özeti' : '🥐 Pişirme önerileri';
          }

          function applyViewFromCache() {
            if (!cachedProducts) return;
            refreshShelfChrome();
            const view = buildViewModel(cachedProducts, settingsState);
            displayView(view);
          }

          function generateCookingRecommendations(products, settings) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const { index: currentSlotIndex, end: currentSlotEnd } = getCurrentTimeSlot(currentHour);
            const nextSlotIndex = (currentSlotIndex + 1) % 4;
            const lookaheadMinutes = 30;
            const finalRecommendations = [];

            products.forEach((ham) => {
              /* Stok değerleri sayıya çekiliyor. Panel normalde sayı
                 veriyor ama bir alan okunamazsa `null` kalabiliyor ve
                 `null === 0` yanlış olduğu için ürün bütün kontrollerden
                 sıyrılıp listeden düşüyordu. Eksi değer de sıfıra
                 çekiliyor: eksi raf diye bir şey yok. */
              const product = Object.assign({}, ham, {
                currentStock: Math.max(0, Number(ham.currentStock) || 0),
                frozenStock: Math.max(0, Number(ham.frozenStock) || 0),
                recommendations: (ham.recommendations || []).map((r) => Math.max(0, Number(r) || 0))
              });

              const bread = isBreadProduct(product.name);
              if (!settings.includeBread && bread) return;

              /* Panel bazen dörtten az dilim kartı çiziyor; okunmayan dilim
                 `undefined` kalmasın diye sıfıra düşürülüyor. */
              const currentTarget = product.recommendations[currentSlotIndex] || 0;
              const nextTarget = product.recommendations[nextSlotIndex] || 0;

              const hasTargets = product.recommendations.some((r) => r > 0);
              if (!hasTargets) return;

              /* RAF SIFIRSA VE HEDEF VARSA ÜRÜN MUTLAKA LİSTEDE.
                 Eskiden donuk sıfır olan ürün burada düşüyordu. Raf da
                 sıfırsa ürün hiç görünmüyordu, oysa o en kritik durum:
                 müşteri isteyecek, rafta yok. Donuktan pişirilemiyorsa da
                 bilinmesi gerekiyor. Donuk sıfır ve raf doluysa yapacak bir
                 şey yok, o zaman düşsün. */
              const rafBosAcil = currentTarget > 0 && product.currentStock === 0;
              if (product.frozenStock === 0 && !bread && !rafBosAcil) return;
              let amountToCook = 0,
                reason = '',
                alertLevel = 'info',
                sortPriority = 99;
              let rowAdded = false;

              const tryPush = () => {
                if (amountToCook <= 0) return;
                if (bread && !settings.breadAlertDeficit) return;
                finalRecommendations.push({
                  ...product,
                  currentTarget,
                  amountToCook,
                  alertLevel,
                  reason,
                  sortPriority
                });
                rowAdded = true;
              };

              const minutesToNextSlot = (currentSlotEnd - currentHour - 1) * 60 + (60 - currentMinute);
              const isLookaheadActive = lookaheadMinutes > 0 && minutesToNextSlot <= lookaheadMinutes && currentSlotIndex !== 3;

              if (isLookaheadActive && product.currentStock === 0 && nextTarget > 0) {
                amountToCook = Math.min(nextTarget, product.frozenStock);
                alertLevel = 'urgent-prep';
                reason = `Stok sıfır! Sonraki dilim (${getCurrentTimeSlot(currentSlotEnd).name}) için ACİL hazırlık.`;
                sortPriority = 1;
                tryPush();
              } else if (product.currentStock === 0 && currentTarget > 0) {
                amountToCook = Math.min(currentTarget, product.frozenStock);
                alertLevel = 'danger';
                reason = `Stok sıfır! Mevcut dilim hedefi: ${currentTarget}`;
                sortPriority = 1;
                tryPush();
              } else if (isLookaheadActive) {
                const neededForNextSlot = nextTarget - product.currentStock;
                if (neededForNextSlot > 0) {
                  amountToCook = Math.min(neededForNextSlot, product.frozenStock);
                  alertLevel = 'info';
                  reason = `Sonraki dilim (${getCurrentTimeSlot(currentSlotEnd).name}) için hazırlık. (${product.currentStock}/${nextTarget})`;
                  sortPriority = 4;
                  tryPush();
                }
              } else {
                const deficit = currentTarget - product.currentStock;
                if (deficit > 0) {
                  amountToCook = Math.min(deficit, product.frozenStock);
                  const urgencyRatio = currentTarget > 0 ? product.currentStock / currentTarget : 1;
                  if (urgencyRatio < 0.25) {
                    alertLevel = 'danger';
                    reason = `Stok kritik! (${product.currentStock}/${currentTarget})`;
                    sortPriority = 2;
                  } else {
                    alertLevel = 'warning';
                    reason = `Stok eksik. (${product.currentStock}/${currentTarget})`;
                    sortPriority = 3;
                  }
                  tryPush();
                }
              }

              /* Taze üretim ürünleri bu uyarının dışında: donuk stokları
                 zaten olmuyor, "donukta yok" demek yanlış alarm. Eksik
                 varsa aşağıdaki genel ekmek uyarısı zaten yakalıyor. */
              if (
                bread &&
                !tazeUretimMi(product.name) &&
                settings.includeBread &&
                settings.breadAlertDeficit &&
                !rowAdded &&
                product.frozenStock === 0 &&
                currentTarget > 0 &&
                product.currentStock < currentTarget
              ) {
                finalRecommendations.push({
                  ...product,
                  currentTarget,
                  amountToCook: 0,
                  alertLevel: 'warning',
                  reason: `Eldeki miktar dilim hedefinin altında (${product.currentStock} / ${currentTarget}). Donuktan pişirilecek stok görünmüyor.`,
                  sortPriority: 3,
                  displayKind: 'bread-no-frozen'
                });
                rowAdded = true;
              }

              /* Taze üretimde eksik varsa gerekçe donuk değil, üretim. */
              if (
                bread &&
                tazeUretimMi(product.name) &&
                settings.includeBread &&
                settings.breadAlertDeficit &&
                !rowAdded &&
                currentTarget > 0 &&
                product.currentStock < currentTarget
              ) {
                finalRecommendations.push({
                  ...product,
                  currentTarget,
                  amountToCook: currentTarget - product.currentStock,
                  alertLevel: 'warning',
                  reason: `Rafta ${product.currentStock}, dilim hedefi ${currentTarget}. ${currentTarget - product.currentStock} adet üretilmeli.`,
                  sortPriority: 3,
                  displayKind: 'bread-taze'
                });
                rowAdded = true;
              }

              if (
                !rowAdded &&
                bread &&
                settings.includeBread &&
                settings.breadAlertSurplus &&
                currentTarget > 0 &&
                product.currentStock > currentTarget
              ) {
                const surplusAmt = product.currentStock - currentTarget;
                finalRecommendations.push({
                  ...product,
                  currentTarget,
                  amountToCook: surplusAmt,
                  alertLevel: 'surplus',
                  reason: `Hedef üzerinde fazla: mevcut ${product.currentStock}, hedef ${currentTarget}.`,
                  sortPriority: 5,
                  displayKind: 'bread-surplus'
                });
                rowAdded = true;
              }

              /* Raf sıfır, hedef var, donuk da sıfır. Pişirilecek bir şey
                 yok ama satır listede kalıyor: rafın boş olduğunu bilmek
                 gerekiyor. */
              if (!rowAdded && rafBosAcil && product.frozenStock === 0) {
                finalRecommendations.push({
                  ...product,
                  currentTarget,
                  amountToCook: 0,
                  alertLevel: 'danger',
                  reason: `Raf sıfır, dilim hedefi ${currentTarget}. Donukta da stok görünmüyor.`,
                  sortPriority: 2,
                  displayKind: 'bread-no-frozen'
                });
              }
            });

            finalRecommendations.sort((a, b) => a.sortPriority - b.sortPriority);
            return finalRecommendations;
          }

          /* Ürün adı panelden geliyor; içinde `<` geçen bir ad satırın
             HTML'ini bozar. Metin olarak basılıyor. */
          function kacir(m) {
            const k = document.createElement('span');
            k.textContent = String(m == null ? '' : m);
            return k.innerHTML;
          }

          /* Tek bir ürünün çizimi patlarsa (bozuk ad, çizilemeyen barkod)
             listenin geri kalanı da ölüyordu. Her satır kendi başına
             korunuyor; hatalı olan yerine tek satırlık uyarı geliyor. */
          function guvenliEkle(kap, uret, ad) {
            try {
              const el = uret();
              if (el) kap.appendChild(el);
            } catch (e) {
              JBA && JBA.hata && JBA.hata('firin satır çizimi', e);
              const uyari = document.createElement('div');
              uyari.style.cssText =
                'padding:8px 10px;border:1px solid #fecaca;border-radius:9px;background:#fef2f2;' +
                'color:#991b1b;font-size:12px;margin-bottom:6px;';
              uyari.textContent = (ad || 'Bir ürün') + ' çizilemedi, atlandı.';
              kap.appendChild(uyari);
            }
          }

          function displayShelfExitList(rows, currentSlotIndex, shelfBannerKind) {
            resultsContainer.innerHTML = '';
            if (rows.length === 0) {
              resultsContainer.innerHTML =
                '<div style="text-align: center; padding: 3rem 1rem; background: #f8fafc; color: #475569; border-radius: 0.5rem;"><h3 style="font-size: 1.125rem;">Liste boş</h3><p style="margin-top: 0.5rem;">Stokta görünür ürün yok ya da okunamadı. Filtreleri temizleyip tekrar dene ya da ayarlardan ekmek seçeneğine bak.</p></div>';
              return;
            }
            const banner = document.createElement('div');
            banner.style.cssText =
              'margin-bottom: 1rem; padding: 0.75rem 1rem; background: #1e293b; color: #f8fafc; border-radius: 0.5rem; font-size: 0.875rem; line-height: 1.4;';

            let bannerInner = '';
            if (shelfBannerKind === 'manual') {
              bannerInner =
                '<strong>Anlık stok özeti</strong><br/>Stok satırı kompakt; barkod kartın sağında alta kadar uzar. Dilim kutuları solda.';
            } else if (shelfBannerKind === 'both') {
              bannerInner =
                '<strong>Gece çıkışı ve stok listesi birlikte</strong><br/>Liste solda/elde miktar barkoddan ayrı; barkod sağ sütunda. 📋 seçili değilken mavi yanmaz.';
            } else {
              bannerInner =
                '<strong>Akşam çıkış listesi (23:00–23:59)</strong><br/>Çıkış içindir. Elde/donuk solda; barkod sağda alta yaslı. Dilimler solda.';
            }
            banner.innerHTML = bannerInner;
            resultsContainer.appendChild(banner);

            const activeStyle = 'color: #16a34a; font-weight: 700;';
            const inactiveStyle = 'color: #6b7280;';

            rows.forEach((p, i) => {
              guvenliEkle(resultsContainer, () => {
              const bcParts = shelfBarcodeCornerInner(p.name);
              const bcHtml = `<div class="ba-shelf-bc">${bcParts.barcode ? `<div class="ba-corner-barcode">${bcParts.barcode}</div>` : ''}</div>`;
              const stockHint =
                bcParts.barcode ? '' : '<span class="ba-shelf-firin-hint">Barkod kaydı yok — <code style="background:#f1f5f9;padding:0 4px;border-radius:3px">firin.json</code></span>';
              const card = document.createElement('div');
              card.className = 'baking-card baking-card-shelf fade-in';
              card.style.borderColor = '#64748b';
              card.style.backgroundColor = '#fff';
              card.style.animationDelay = `${i * 40}ms`;
              card.innerHTML = `
        <img class="ba-shelf-img" src="${p.imgSrc}" alt="" width="52" height="52" style="width:52px;height:52px;object-fit:cover;border-radius:0.3rem;flex-shrink:0;">
        <h4 class="ba-shelf-title" title="${p.name.replace(/"/g, '&quot;')}">${p.name}</h4>
        ${bcHtml}
        <div class="ba-shelf-stock">
          <strong class="ba-shelf-elde">${p.currentStock}</strong>
          <span class="ba-shelf-donuk">Donuk · ${p.frozenStock}</span>
          ${stockHint}
        </div>
        <div class="ba-shelf-dilim">
            <div style="${currentSlotIndex === 0 ? activeStyle : ''}"><div style="font-size: 0.76rem; font-weight: inherit;">${p.recommendations[0]}</div><div style="font-size: 0.55rem; ${currentSlotIndex === 0 ? '' : inactiveStyle}">08–12</div></div>
            <div style="${currentSlotIndex === 1 ? activeStyle : ''}"><div style="font-size: 0.76rem; font-weight: inherit;">${p.recommendations[1]}</div><div style="font-size: 0.55rem; ${currentSlotIndex === 1 ? '' : inactiveStyle}">12–16</div></div>
            <div style="${currentSlotIndex === 2 ? activeStyle : ''}"><div style="font-size: 0.76rem; font-weight: inherit;">${p.recommendations[2]}</div><div style="font-size: 0.55rem; ${currentSlotIndex === 2 ? '' : inactiveStyle}">16–20</div></div>
            <div style="${currentSlotIndex === 3 ? activeStyle : ''}"><div style="font-size: 0.76rem; font-weight: inherit;">${p.recommendations[3]}</div><div style="font-size: 0.55rem; ${currentSlotIndex === 3 ? '' : inactiveStyle}">20–00</div></div>
        </div>`;
              return card;
              }, p.name);
            });
          }

          function displayView(view) {
            if (view.mode === 'shelf-exit') {
              displayShelfExitList(view.rows, view.currentSlotIndex, view.shelfBannerKind || 'evening');
              return;
            }
            displayCookingResults(view.rows, view.currentSlotIndex);
          }

          function displayCookingResults(recommendations, currentSlotIndex) {
            resultsContainer.innerHTML = '';
            if (recommendations.length === 0) {
              resultsContainer.innerHTML =
                '<div style="text-align: center; padding: 4rem 1rem; background: #f0fdf4; color: #166534; border-radius: 0.5rem;"><h3 style="font-size: 1.25rem; font-weight: 600;">Her şey yolunda!</h3><p style="margin-top: 0.5rem;">Mevcut stoklar yeterli, pişirilmesi gereken ürün yok.</p></div>';
              return;
            }
            recommendations.forEach((p, i) => {
              guvenliEkle(resultsContainer, () => {
              const colorMap = {
                danger: { border: '#ef4444', bg: '#fef2f2', labelBg: '#fee2e2' },
                warning: { border: '#f59e0b', bg: '#fffbeb', labelBg: '#fef3c7' },
                info: { border: '#3b82f6', bg: '#eff6ff', labelBg: '#dbeafe' },
                surplus: { border: '#0d9488', bg: '#f0fdfa', labelBg: '#ccfbf1' }
              };
              const labels = {
                danger: 'ACİL PİŞİR',
                warning: 'PİŞİRME GEREKLİ',
                info: 'HAZIRLIK YAP',
                surplus: 'FAZLA'
              };
              let currentColors;
              let labelHtml;
              if (p.alertLevel === 'urgent-prep') {
                currentColors = colorMap.danger;
                labelHtml = `<span style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 9999px; background-color: ${colorMap.danger.labelBg}; color: ${colorMap.danger.border}; flex-shrink: 0;">${labels.danger}</span>
        <span style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 9999px; background-color: ${colorMap.info.labelBg}; color: ${colorMap.info.border}; flex-shrink: 0;">${labels.info}</span>`;
              } else if (p.alertLevel === 'surplus') {
                currentColors = colorMap.surplus;
                labelHtml = `<span style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 9999px; background-color: ${currentColors.labelBg}; color: ${currentColors.border}; flex-shrink: 0;">${labels.surplus}</span>`;
              } else {
                currentColors = colorMap[p.alertLevel];
                labelHtml = `<span style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 9999px; background-color: ${currentColors.labelBg}; color: ${currentColors.border}; flex-shrink: 0;">${labels[p.alertLevel]}</span>`;
              }

              let mainTitle = `${p.amountToCook} Adet Pişirilecek`;
              if (p.displayKind === 'bread-no-frozen') {
                mainTitle = 'Donuktan pişirilecek stok görünmüyor';
              } else if (p.alertLevel === 'surplus') {
                mainTitle = `${p.amountToCook} Adet Fazla`;
              }

              const card = document.createElement('div');
              card.className = 'baking-card fade-in';
              card.style.borderColor = currentColors.border;
              card.style.backgroundColor = currentColors.bg;
              card.style.animationDelay = `${i * 100}ms`;
              const activeStyle = 'color: #16a34a; font-weight: 700;';
              const inactiveStyle = 'color: #6b7280;';
              card.innerHTML = `
        <img src="${p.imgSrc}" alt="" style="width: 80px; height: 80px; object-fit: cover; border-radius: 0.375rem; margin-right: 1rem; flex-shrink: 0;">
        <div style="flex-grow: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h4 style="font-weight: 700; font-size: 1.125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name.replace(/"/g, '&quot;')}">${p.name}</h4>
            <div style="display: flex; flex-shrink: 0; gap: 0.25rem; margin-left: 0.5rem;">${labelHtml}</div>
          </div>
          <p style="font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0; color: #111827;">${mainTitle}</p>
          <p style="font-size: 0.75rem; font-weight: 500; color: #4b5563; margin-bottom: 0.5rem;">${p.reason}</p>
          <div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; text-align: center;">
            <div style="${currentSlotIndex === 0 ? activeStyle : ''}"><div style="font-size: 0.875rem; font-weight: inherit;">${p.recommendations[0]}</div><div style="font-size: 0.625rem; ${currentSlotIndex === 0 ? '' : inactiveStyle}">08:00-12:00</div></div>
            <div style="${currentSlotIndex === 1 ? activeStyle : ''}"><div style="font-size: 0.875rem; font-weight: inherit;">${p.recommendations[1]}</div><div style="font-size: 0.625rem; ${currentSlotIndex === 1 ? '' : inactiveStyle}">12:00-16:00</div></div>
            <div style="${currentSlotIndex === 2 ? activeStyle : ''}"><div style="font-size: 0.875rem; font-weight: inherit;">${p.recommendations[2]}</div><div style="font-size: 0.625rem; ${currentSlotIndex === 2 ? '' : inactiveStyle}">16:00-20:00</div></div>
            <div style="${currentSlotIndex === 3 ? activeStyle : ''}"><div style="font-size: 0.875rem; font-weight: inherit;">${p.recommendations[3]}</div><div style="font-size: 0.625rem; ${currentSlotIndex === 3 ? '' : inactiveStyle}">20:00-00:00</div></div>
          </div>
        </div>
        <div style="margin-left: 1rem; text-align: center; width: 80px; flex-shrink: 0; border-left: 1px solid #e5e7eb; padding-left: 1rem; display: flex; flex-direction: column; justify-content: center;">
          <div style="font-size: 0.75rem; font-weight: 600; color: #4b5563;">MEVCUT</div>
          <div style="font-size: 1.25rem; font-weight: 700;">${p.currentStock}</div>
          <div style="font-size: 0.75rem; font-weight: 600; color: #4b5563; margin-top: 0.5rem;">DONUK</div>
          <div style="font-size: 1.25rem; font-weight: 700;">${p.frozenStock}</div>
        </div>`;
              return card;
              }, p.name);
            });
          }

          resultsContainer.innerHTML =
            '<div style="text-align: center; padding: 2rem;">Sütunlar açılıyor…</div>';

          try {
            /* Sütunlar açılmadan okuma yapılmıyor ve HER ürünün stok hücresi
               okunana kadar tur tekrarlanıyor. Eskiden "en az bir üründe stok
               var" yeterli sayılıyordu; tek bir ürünün satırı açılmamışsa o
               ürün sıfır stokla listeye giriyor ve fark edilmiyordu. */
            let products = [];
            let eksikler = [];
            for (let tur = 0; tur < 3; tur++) {
              await sutunlariAcVeDogrula();
              const okunan = parseProductsFromPage();
              if (okunan.length) products = okunan;
              eksikler = stokOkunmayanlar(products);
              if (products.length && !eksikler.length) break;
              await sleep(500);
            }

            if (!products.length) {
              await sleep(600);
              products = parseProductsFromPage();
              eksikler = stokOkunmayanlar(products);
            }
            if (!products.length) {
              throw new Error('NO_PRODUCTS');
            }

            cachedProducts = products;
            applyViewFromCache();

            /* Üç turda da okunamayan ürün varsa sessiz geçilmiyor: yanlış
               sayıya bakıp yanlış pişirmektense eksik olduğunu bilmek yeğ. */
            if (eksikler.length) {
              const uyari = document.createElement('div');
              uyari.style.cssText = 'margin:0 0 12px;padding:12px 14px;border:1px solid #fbdba7;border-radius:12px;background:#fff6e8;color:#92400e;font-size:13px;line-height:1.5;';
              uyari.innerHTML = '<strong>' + eksikler.length + ' ürünün stoğu okunamadı.</strong><br>' +
                eksikler.map((p) => p.name).join(', ') +
                '<br>Sütunları elle açıp panel düğmesine tekrar bas.';
              resultsContainer.insertBefore(uyari, resultsContainer.firstChild);
            }
          } catch (error) {
            JBA.hata('fırın pişirme', error);
            resultsContainer.innerHTML =
              '<div style="text-align: center; padding: 4rem 1rem; background: #fef2f2; color: #991b1b; border-radius: 0.5rem;"><h3 style="font-size: 1.25rem; font-weight: 600;">Analiz Başarısız!</h3><p style="margin-top: 0.5rem;">Pişirme listesi okunamadı. Isıtma tahmini ekranındayken tekrar dene; yine olmazsa bookmarklet metnini dosyadan yeniden kopyala.</p></div>';
          }
        })();
    }

    // ==================================================================
    // Sayfaya düğme
    // ==================================================================

    /**
     * Yalnız pişirme tahmini listesi:
     *   /r/<depoKimligi>/stock/stock-management/product/bakery-estimation/list
     *
     * Depo kimliği depodan depoya değişiyor, o yüzden desende sabit değil
     * 24 haneli onaltılık kalıp var. Başka hiçbir sayfada düğme çıkmıyor.
     */
    var FIRIN_YOLU = /^\/r\/[a-f0-9]{24}\/stock\/stock-management\/product\/bakery-estimation\/list\/?$/;

    function firinSayfasiMi() {
        return FIRIN_YOLU.test(location.pathname);
    }

    /** Düğmenin gireceği yer: sayfa başlığının yanı, yoksa araç çubuğu. */
    function yerBul() {
        var adaylar = [
            '[class*="pageHeader"]', '[class*="PageHeader"]',
            '[class*="headerContainer"]', '[class*="leftContainer"]',
            '.ant-page-header-heading', '.ant-tabs-nav'
        ];
        for (var i = 0; i < adaylar.length; i++) {
            var e = document.querySelector(adaylar[i]);
            if (e) return e;
        }
        var b = document.querySelector('h1, h2');
        return b && b.parentNode ? b.parentNode : null;
    }

    function dugmeyiKur() {
        if (document.getElementById(DUGME_KIMLIK)) return;
        if (!firinSayfasiMi()) return;

        var yer = yerBul();
        if (!yer) return;

        var d = document.createElement('button');
        d.type = 'button';
        d.id = DUGME_KIMLIK;
        d.textContent = 'Pişirme Paneli';
        d.title = 'Fırın pişirme panelini aç';
        d.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            JBA.korumali('fırın paneli', paneliAc);
        });
        yer.appendChild(d);
    }

    // ==================================================================

    JBA.kayit({
        kimlik: 'firinPisirme',
        ad: 'Fırın Pişirme',
        ozet: 'Fırın sayfasına pişirme paneli düğmesi ekler. Ne kadar pişirileceğini hesaplar.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return FIRIN_YOLU.test(yol); },

        baslat: function (ctx) {
            stilKur();
            dugmeyiKur();
            this._birak = ctx.izle(dugmeyiKur);
        },

        durdur: function () {
            if (this._birak) this._birak();
            var d = document.getElementById(DUGME_KIMLIK);
            if (d) d.remove();
            var m = document.getElementById('baking-assistant-modal');
            if (m) m.remove();
        },

        eylemler: [
            { ad: 'Pişirme panelini aç', calistir: function () {
                JBA.korumali('fırın paneli', paneliAc);
            } }
        ]
    });
})(window);
