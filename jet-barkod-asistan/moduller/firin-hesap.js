/**
 * Fırın hesabı (ortak): pişirme önerisi
 * ============================================================================
 *
 * Pişirme paneli (moduller/firin-pisirme.js) ile kontrol panelindeki
 * bildirim (moduller/firin-uyari.js) AYNI hesabı kullanıyor. Önce bildirim
 * kendi kuralıyla çalışıyordu (raf × 5 ≤ öneri); panel ise her eksiği
 * gösteriyordu. Bildirim Ispanaklı'yı gösterip panelin istediği
 * Patatesli'yi atlayabiliyordu. Kural artık tek yerde, ikisi ayrışamaz.
 *
 * Ayarlar da ortak: panelin ayar düğmesindeki tercih (ekmek dahil mi vb.)
 * warehouse.getir.com'un yerel deposunda, iki modül aynı kaydı okuyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var AYAR_ANAHTARI = 'getirPişirmeAssistantSettings_v2';
    var AYAR_VARSAYILAN = {
        includeBread: true,
        breadAlertDeficit: true,
        breadAlertSurplus: false,
        eveningShelfExit: false
    };

    function ayarlar() {
        try {
            var ham = global.localStorage.getItem(AYAR_ANAHTARI);
            return Object.assign({}, AYAR_VARSAYILAN, ham ? JSON.parse(ham) : {});
        } catch (e) {
            return Object.assign({}, AYAR_VARSAYILAN);
        }
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

    function tazeUretimMi(name) {
      return isBreadProduct(name);
    }

    function getCurrentTimeSlot(hours) {
      /* GECE YARISI İLE 08:00 ARASI 08:00-12:00 DİLİMİ SAYILIR.
         Fırın paneli asıl bu saatlerde, sabahki pişirmeye hazırlanmak
         için açılıyor. Eskiden 00:00-07:59 hiçbir aralığa uymayıp son
         satıra düşüyordu: dün akşamın 20:00-00:00 hedefi "şimdi"
         sanılıyor, kartta o sütun yeşil yanıyor, hesap o sayıya göre
         yapılıyordu. Üstelik ileriye bakış `currentSlotIndex !== 3`
         dediği için sabah dilimine hazırlık uyarısı hiç açılmıyordu.

         Gündüz davranışı değişmiyor. `getCurrentTimeSlot(24)` de bu
         dala girmiyor (24 < 8 değil), yani "sonraki dilim" adlandırması
         olduğu gibi kalıyor. */
      if (hours < 8) return { index: 0, name: '08:00-12:00', start: 8, end: 12 };
      if (hours >= 8 && hours < 12) return { index: 0, name: '08:00-12:00', start: 8, end: 12 };
      if (hours >= 12 && hours < 16) return { index: 1, name: '12:00-16:00', start: 12, end: 16 };
      if (hours >= 16 && hours < 20) return { index: 2, name: '16:00-20:00', start: 16, end: 20 };
      return { index: 3, name: '20:00-00:00', start: 20, end: 24 };
    }

    function generateCookingRecommendations(products, settings, simdi) {
      const now = simdi ? new Date(simdi) : new Date();
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

    /* ------------------------------------------------------------------
       PİŞİRME YÖNTEMİ (Asistan penceresi > Pişirme Yöntemi; arayuz/kapi.js yazar)
       Bildirim (firin-uyari.js) ve pişirme paneli (firin-pisirme.js) aynı ayarı
       ve aynı hesabı kullanır.
       ------------------------------------------------------------------ */
    var yontemDegeri = { ad: 'eski', hesap: 'toplam', cikar: 'kadar', esik: 1 };
    function yontemTemiz(a) {
        a = a || {};
        return {
            ad: a.ad === 'yeni' ? 'yeni' : 'eski',
            hesap: a.hesap === 'dilim' ? 'dilim' : 'toplam',
            cikar: ['kadar', 'hepsi', 'yok'].indexOf(a.cikar) > -1 ? a.cikar : 'kadar',
            esik: [0, 1, 2].indexOf(Number(a.esik)) > -1 ? Number(a.esik) : 1
        };
    }
    try {
        chrome.storage.local.get('jbaFirinYontem', function (r) {
            void chrome.runtime.lastError;
            yontemDegeri = yontemTemiz(r && r.jbaFirinYontem);
        });
        chrome.storage.onChanged.addListener(function (d, alan) {
            if (alan === 'local' && d.jbaFirinYontem) yontemDegeri = yontemTemiz(d.jbaFirinYontem.newValue);
        });
    } catch (e) { /* yetim bağlam */ }

    function toplam(l, son) {
        var t = 0;
        for (var i = 0; i <= son; i++) t += Number(l && l[i]) || 0;
        return t;
    }

    /* Ürüne gün boyu sayıları ekler: öneri, pişirilen, satılan (panel verisinden) */
    function gunToplamlari(p) {
        return {
            oneriGun: toplam(p.recommendations, 3),
            pisenGun: toplam(p.pisenler, 3),
            satisGun: toplam(p.satislar, 3)
        };
    }

    /*
     * YENİ YÖNTEM
     * Fırın S/Ö puanı: Öneriye Uyum = günlük Pişirilen ÷ günlük Öneri (100'de
     * kesilir), puan = (Stok Doğruluğu + Uyum) ÷ 2. Rafta stok varken pişirme
     * girilmeyince az satan üründe öneri birikir. Burada iki şey birlikte:
     *   1) ÖNERİ GERİDE KALMASIN. 'toplam': bu dilim sonuna kadarki öneri −
     *      bugün pişirilen. 'dilim': bu dilimin önerisi − bu dilimde pişirilen.
     *      Pişirme hiçbir zaman eksikten fazla istenmez.
     *   2) STOK ASLA SIFIR OLMASIN. Raf eşiğe inince (0/1/2), bu ya da sonraki
     *      dilimde talep varsa pişir; panelin acil satırları da katılır.
     * Eski stok: öneri eksiği varken bu dilimde henüz pişirme yoksa raftakiler
     * önceki dilimden kalmadır; ayara göre pişirilecek kadarı, hepsi ya da
     * hiçbiri çıkarılır (stok koruması varken hiç çıkarılmaz).
     * Ürünlerde pisenler[4] ve satislar[4] olmalı (yoksa sıfır sayılır).
     */
    function yeniOneriler(products, settings, yontem, simdi) {
      var y = yontemTemiz(yontem || yontemDegeri);
      var now = simdi ? new Date(simdi) : new Date();
      var suan = getCurrentTimeSlot(now.getHours()).index;
      var sonraki = Math.min(3, suan + 1);
      var koruma = {};
      generateCookingRecommendations(products, settings, simdi).forEach(function (r) {
        if (!r.displayKind && r.amountToCook > 0 && (r.alertLevel === 'danger' || r.alertLevel === 'urgent-prep')) koruma[r.name] = r;
      });
      var satirlar = [];
      products.forEach(function (ham) {
        if (isBreadProduct(ham.name)) return;
        var O = (ham.recommendations || []).map(function (r) { return Math.max(0, Number(r) || 0); });
        var P = ham.pisenler || [];
        var S = ham.satislar || [];
        if (!O.some(function (x) { return x > 0; })) return;
        var raf = Math.max(0, Number(ham.currentStock) || 0);
        var donuk = Math.max(0, Number(ham.frozenStock) || 0);
        var oneriTop = toplam(O, suan), pisenTop = toplam(P, suan);
        var dilimOneri = O[suan] || 0, dilimPisen = Number(P[suan]) || 0;
        // Pişirilen sayısı okunamadıysa (panel verisi eşleşmedi) öneri takibi yapılmaz:
        // yoksa bütün öneri yeniden "pişir" diye çıkardı. Yalnız stok koruması kalır.
        var pisenBilinir = Array.isArray(ham.pisenler);
        var eksik = !pisenBilinir ? 0 : y.hesap === 'dilim' ? Math.max(0, dilimOneri - dilimPisen) : Math.max(0, oneriTop - pisenTop);
        var oneriPisir = Math.min(eksik, donuk);
        var talep = dilimOneri > 0 || (O[sonraki] || 0) > 0;
        var k = koruma[ham.name];
        var korumaPisir = k ? Math.min(donuk, k.amountToCook)
          : (talep && raf <= y.esik && donuk > 0 ? Math.min(donuk, Math.max(1, dilimOneri - raf)) : 0);
        var pisir = Math.min(donuk, Math.max(oneriPisir, korumaPisir));
        var eskiCikar = 0;
        if (oneriPisir > 0 && !korumaPisir && raf > 0 && dilimPisen === 0 && y.cikar !== 'yok') {
          eskiCikar = y.cikar === 'hepsi' ? raf : Math.min(raf, oneriPisir);
        }
        var donukYetmez = eksik > donuk || (talep && raf <= y.esik && donuk === 0);
        if (!pisir && !eskiCikar && !donukYetmez) return;
        // Kısa ve net: sayılar tabloda zaten var
        var parca = [];
        if (eksik > 0) parca.push(y.hesap === 'dilim'
          ? 'Bu dilim: öneri ' + dilimOneri + ', pişirilen ' + dilimPisen + '.'
          : 'Öneri ' + oneriTop + ', pişirilen ' + pisenTop + '.');
        if (korumaPisir) parca.push(raf ? 'Rafta ' + raf + ' kaldı.' : 'Raf bitti.');
        if (eskiCikar) {
          var oncekiSatis = suan > 0 ? (Number(S[suan - 1]) || 0) : null;
          parca.push((oncekiSatis === 0 ? 'Satış yok: ' : '') + eskiCikar + ' eskiyi çıkar, taze pişir.');
        }
        if (donukYetmez) parca.push('Donuk yetmiyor (' + donuk + ').');
        satirlar.push(Object.assign({}, ham, {
          currentStock: raf, frozenStock: donuk, recommendations: O,
          currentTarget: dilimOneri,
          amountToCook: pisir,
          eskiCikar: eskiCikar,
          alertLevel: korumaPisir ? 'danger' : (pisir ? 'oneri' : 'warning'),
          reason: parca.join(' '),
          sortPriority: korumaPisir ? 1 : (pisir ? 3 : 2),
          sadeceOneri: !korumaPisir,
          displayKind: !pisir && donukYetmez ? 'bread-no-frozen' : undefined
        }));
      });
      satirlar.sort(function (a, b) { return (a.sortPriority - b.sortPriority) || (a.currentStock - b.currentStock); });
      return satirlar;
    }

    /*
     * DİLİM TABLOSU: satırlar Öneri / Pişirilen / Satılan, sütunlar dört dilim + Toplam.
     * Pişirme paneli, stok görünümü ve sağ üst bildirim aynı tabloyu kullanır; stil
     * her yerin kendi CSS'inde (.jba-dt). Satış verisi yoksa yalnız Öneri satırı.
     */
    var DILIM_KISA = ['08–12', '12–16', '16–20', '20–24'];
    function dilimTablosuHtml(p, suan) {
      var O = p.recommendations || [];
      var satirlar = [['Öneri', O]];
      if (Array.isArray(p.pisenler)) satirlar.push(['Pişirilen', p.pisenler]);
      if (Array.isArray(p.satislar)) satirlar.push(['Satılan', p.satislar]);
      var sayi = function (x) { return String(Math.max(0, Number(x) || 0)); };
      var h = '<table class="jba-dt"><thead><tr><th></th>' + DILIM_KISA.map(function (d, i) {
        return '<th' + (i === suan ? ' class="su"' : '') + '>' + d + '</th>';
      }).join('') + '<th class="top">Toplam</th></tr></thead><tbody>';
      satirlar.forEach(function (r) {
        h += '<tr><th>' + r[0] + '</th>' + [0, 1, 2, 3].map(function (i) {
          return '<td' + (i === suan ? ' class="su"' : '') + '>' + sayi(r[1][i]) + '</td>';
        }).join('') + '<td class="top">' + toplam(r[1], 3) + '</td></tr>';
      });
      return h + '</tbody></table>';
    }

    /* Panelin API yanıtından (GET /heating-estimations) ad → dilim başına öneri, pişirilen, satılan */
    function apiDilimleri(ham) {
      var sira = { 8: 0, 12: 1, 16: 2, 20: 3 };
      var ad = {};
      ((ham && ham.data) || []).forEach(function (d) {
        var i = sira[Number(String(d.startDate || '').slice(11, 13))];
        if (i === undefined) return;
        (d.products || []).forEach(function (p) {
          var n = p.fullName && typeof p.fullName === 'object' ? (p.fullName.tr || p.fullName.en) : (p.fullName || p.name);
          n = n && typeof n === 'object' ? (n.tr || n.en) : n;
          if (!n) return;
          var x = ad[n] || (ad[n] = { pisenler: [0, 0, 0, 0], satislar: [0, 0, 0, 0] });
          x.pisenler[i] = Math.max(0, Number(p.cookedQuantity) || 0);
          x.satislar[i] = Math.max(0, Number(p.soldQuantity) || 0);
        });
      });
      return ad;
    }

    JBA.firinHesap = {
        yeniOneriler: yeniOneriler,
        yontem: function () { return yontemDegeri; },
        gunToplamlari: gunToplamlari,
        dilimTablosuHtml: dilimTablosuHtml,
        apiDilimleri: apiDilimleri,
        oneriler: generateCookingRecommendations,
        dilim: getCurrentTimeSlot,
        ekmekMi: isBreadProduct,
        tazeUretimMi: tazeUretimMi,
        ayarlar: ayarlar,
        AYAR_ANAHTARI: AYAR_ANAHTARI,
        AYAR_VARSAYILAN: AYAR_VARSAYILAN
    };
})(window);
