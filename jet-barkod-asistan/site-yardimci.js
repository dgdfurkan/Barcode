/**
 * Jet Barkod Asistan. Sayfa dünyasındaki yardımcı (yalnız jetbarkod.com.tr).
 * ============================================================================
 *
 * `window.getirExtensionHelper` nesnesini SAYFANIN kendi dünyasına koyar.
 *
 * NEDEN GEREKLİ
 * `js/counting.js` bu nesneyi arıyor: SKT (son kullanma tarihi) verisini ve
 * API bilgisini oradan istiyor. Eski eklenti nesneyi içerik betiğinden
 * tanımlıyordu ama içerik betikleri yalıtılmış dünyada çalışır; sayfadaki
 * `counting.js` o `window`'u hiç göremiyordu. Bu yüzden sayfa her seferinde
 * yedek yollara düşüyor, eklenti kimliğini koda gömülü sabitten okumaya
 * çalışıyordu. Gömülü kimlik de eski eklentinin kimliğiydi.
 *
 * Burada gerçekten sayfanın dünyasındayız (manifest'te `world: MAIN`), yani
 * `counting.js` nesneyi görüyor. Nesne kendi başına bir şey yapmıyor;
 * istekleri postMessage ile yalıtılmış köprüye (`site-koprusu.js`) iletiyor,
 * asıl işi o yapıyor.
 *
 * Sayfada zaten bir `getirExtensionHelper` varsa (eski eklenti hâlâ
 * kuruluysa) dokunulmuyor. İkisi birden kuruluyken eskisi kazanır, bu
 * bilinçli: yarısı bizden yarısı ondan bir nesne oluşmasın.
 * ============================================================================
 */
(function (global) {
    'use strict';

    if (global.getirExtensionHelper) return;

    var KAYNAK = location.origin;
    var kimlik = null;

    function gonder(v) {
        try { global.postMessage(v, KAYNAK); } catch (e) { /* sessiz */ }
    }

    /** Bir mesaj gönderip belirli tipte cevap bekler. */
    function sorCevapla(istek, cevapTipi, sureMs) {
        return new Promise(function (coz, red) {
            var bitti = false;

            function temizle() { global.removeEventListener('message', dinle); }

            function dinle(e) {
                if (e.source !== global || e.origin !== KAYNAK) return;
                if (!e.data || e.data.type !== cevapTipi) return;
                if (bitti) return;
                bitti = true;
                temizle();
                coz(e.data);
            }

            global.addEventListener('message', dinle);
            gonder(istek);

            setTimeout(function () {
                if (bitti) return;
                bitti = true;
                temizle();
                red(new Error('İstek zaman aşımına uğradı'));
            }, sureMs || 120000);
        });
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global || e.origin !== KAYNAK) return;
        if (e.data && e.data.type === 'GETIR_EXTENSION_PONG' && e.data.extensionId) {
            kimlik = e.data.extensionId;
        }
    });

    global.getirExtensionHelper = {
        get extensionId() { return kimlik; },

        isAvailable: function () { return true; },

        /** Franchise sayfasından yakalanmış yetki ve depo bilgisi. */
        getAPIInfo: function () {
            return sorCevapla({ type: 'GETIR_GET_API_INFO' }, 'GETIR_API_INFO_RESULT', 15000)
                .then(function (y) {
                    if (y.success) return y.apiInfo;
                    throw new Error(y.error || 'API bilgileri alınamadı');
                });
        },

        /** Ürünlerin son kullanma tarihlerini getirir. */
        fetchExpiryProducts: function (urunler, secenekler) {
            secenekler = secenekler || {};
            var idler = Array.isArray(urunler) ? urunler.filter(Boolean) : [];
            if (!idler.length) return Promise.reject(new Error('Ürün listesi boş'));

            return sorCevapla({
                type: 'GETIR_FETCH_EXPIRY_REQUEST',
                productIds: idler,
                warehouseId: secenekler.warehouseId || '5dcafe6ae2c61b1e52cf1704',
                endDate: secenekler.endDate || '2030-07-31'
            }, 'WAREHOUSE_EXPIRY_RESPONSE', 120000).then(function (y) {
                if (y.success) return y;
                throw new Error(y.error || 'SKT alınamadı');
            });
        }
    };

    // Köprüye kimliğini sor; cevabı yukarıdaki dinleyici yakalıyor.
    gonder({ type: 'GETIR_EXTENSION_PING' });
})(window);
