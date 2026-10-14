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

    JBA.firinHesap = {
        oneriler: generateCookingRecommendations,
        dilim: getCurrentTimeSlot,
        ekmekMi: isBreadProduct,
        tazeUretimMi: tazeUretimMi,
        ayarlar: ayarlar,
        AYAR_ANAHTARI: AYAR_ANAHTARI,
        AYAR_VARSAYILAN: AYAR_VARSAYILAN
    };
})(window);
