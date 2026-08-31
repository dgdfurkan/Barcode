/**
 * Jet Barkod Asistan. Site köprüsü.
 * ============================================================================
 *
 * Yalnızca jetbarkod.com.tr'de (ve yerel geliştirmede) çalışır. İki işi var:
 *
 *   1. Sayfaya "eklenti kurulu" diye haber verir. Premium özellikler
 *      sayfasındaki kart bunu görüp "Kurulu" rozetini gösteriyor.
 *   2. Sayfanın gönderdiği açık modül listesini yerel depoya yazar.
 *      Yükleyici bu listeyi okuyup kapalı modülü hiç başlatmıyor.
 *      Premium kilidi ilk kez gerçekten çalışıyor: eskiden ZIP kimdeyse
 *      özellik onda kalıyordu, artık admin kapattığı an kapanıyor.
 *
 * GÜVENLİK
 * `postMessage` iki yönlü bir kapı, sayfadaki her betik yazabilir. Bu
 * yüzden yalnızca `JB_` önekli mesajlar okunuyor, `event.source` pencerenin
 * kendisi olmak zorunda ve kaynak beyaz listeye karşı denetleniyor. Giden
 * mesajlarda hedef kaynak `'*'` değil, sayfanın kendi kaynağı.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var LISTE_ANAHTARI = 'jbaAcikModuller';
    var SURUM = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '0';

    var IZINLI = [
        'https://jetbarkod.com.tr',
        'https://www.jetbarkod.com.tr',
        'http://localhost',
        'http://127.0.0.1'
    ];

    function kaynakIzinliMi(kaynak) {
        for (var i = 0; i < IZINLI.length; i++) {
            if (kaynak === IZINLI[i] || kaynak.indexOf(IZINLI[i] + ':') === 0) return true;
        }
        return false;
    }

    var HEDEF = kaynakIzinliMi(location.origin) ? location.origin : null;
    if (!HEDEF) return;

    function gonder(veri) {
        try { global.postMessage(veri, HEDEF); } catch (e) { /* sessiz */ }
    }

    function merhaba() {
        gonder({ type: 'JB_ASISTAN_HAZIR', surum: SURUM, kimlik: chrome.runtime.id });
        /*
         * Kimliği sorulmadan da duyuruyoruz. `site-yardimci.js` sayfanın
         * dünyasında document_start'ta çalışıyor ve PING'i biz yüklenmeden
         * gönderebiliyor; o durumda sorusu cevapsız kalıyordu. Duyuru
         * yapınca yükleme sırası önemsiz hâle geliyor.
         */
        gonder({ type: 'GETIR_EXTENSION_PONG', extensionId: chrome.runtime.id });
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global) return;
        if (!kaynakIzinliMi(e.origin)) return;
        var d = e.data;
        if (!d || typeof d.type !== 'string') return;

        // Düşük Stok mesajları JB_ önekli değil; eski adlar korunuyor.
        if (d.type.indexOf('LOW_STOCK') === 0 || d.type === 'CLEAR_LOW_STOCK' ||
            d.type === 'SAVE_MANUAL_TOKEN' || d.type === 'GET_MANUAL_TOKEN_STATUS' ||
            d.type === 'REQUEST_LOW_STOCK_REFRESH') {
            // Bizim kendi yaydığımız sonuç mesajları geri dönmesin.
            if (d.type === 'LOW_STOCK_LIST_UPDATE') return;
            if (dusukStokAktar(d)) return;
        }

        if (YONETICI_ESLEME[d.type]) {
            if (yoneticiAktar(d)) return;
        }

        if (d.type.indexOf('GETIR_') === 0) {
            if (d.type === 'GETIR_EXTENSION_PONG' || d.type === 'GETIR_API_INFO_RESULT') return;
            if (sktAktar(d)) return;
        }

        if (d.type.indexOf('JB_') !== 0) return;

        // Sayfa "orada mısın" diye soruyor.
        if (d.type === 'JB_ASISTAN_SOR') {
            merhaba();
            return;
        }

        // Sayfa açık modül listesini bildiriyor.
        if (d.type === 'JB_ASISTAN_MODULLER' && Array.isArray(d.moduller)) {
            var temiz = d.moduller.filter(function (x) { return typeof x === 'string'; });
            try {
                var yaz = {};
                yaz[LISTE_ANAHTARI] = temiz;
                chrome.storage.local.set(yaz, function () {
                    gonder({ type: 'JB_ASISTAN_MODULLER_TAMAM', adet: temiz.length });
                });
            } catch (err) { /* sessiz */ }
        }
    });

    // ==================================================================
    // Düşük Stok Uyarısı aktarımı
    //
    // Mesaj adları eski eklentiden birebir korundu. Site tarafında
    // `dusuk-stok/index.html` bu adları dinliyor; değiştirseydik
    // onu da elden geçirmek gerekirdi.
    // ==================================================================

    // LOW_STOCK_MARK_DONE mesajı kullanıcı adı taşımıyor. Eski eklenti
    // bunu `window.authUtils` üzerinden okumaya çalışıyordu ama içerik
    // betiği yalıtılmış dünyada; sayfanın `authUtils` nesnesini hiç
    // göremiyordu. Adı LOW_STOCK_INIT'ten hatırlayıp kullanıyoruz.
    var sonKullanici = null;

    try {
        chrome.runtime.onMessage.addListener(function (m) {
            if (m && m.type === 'LOW_STOCK_LIST_UPDATE') {
                gonder({ type: 'LOW_STOCK_LIST_UPDATE', list: m.list || [], username: m.username });
            }
        });
    } catch (e) { /* sessiz */ }

    function arkaPlana(istek, cevapla) {
        try { chrome.runtime.sendMessage(istek, cevapla); }
        catch (e) { cevapla(null); }
    }

    function dusukStokAktar(d) {
        if (d.type === 'LOW_STOCK_INIT' && d.payload) {
            if (d.payload.username) sonKullanici = d.payload.username;
            arkaPlana({ type: 'LOW_STOCK_INIT', payload: d.payload }, function (y) {
                if (y && y.username !== undefined) {
                    gonder({ type: 'LOW_STOCK_LIST_UPDATE', list: y.list || [], username: y.username });
                }
            });
            return true;
        }

        if (d.type === 'REQUEST_LOW_STOCK_REFRESH' && d.username) {
            arkaPlana({ type: 'REQUEST_LOW_STOCK_REFRESH', username: d.username, payload: d.payload || null },
                function (y) {
                    if (y && y.error) gonder({ type: 'LOW_STOCK_REFRESH_RESULT', error: y.error, username: d.username });
                    else if (y && y.ok && y.list) gonder({ type: 'LOW_STOCK_REFRESH_RESULT', list: y.list, username: d.username });
                    else gonder({ type: 'LOW_STOCK_REFRESH_RESULT', error: 'Yanıt alınamadı', username: d.username });
                });
            return true;
        }

        if (d.type === 'CLEAR_LOW_STOCK' && d.username) {
            arkaPlana({ type: 'CLEAR_LOW_STOCK', username: d.username }, function (y) {
                gonder(y && y.error
                    ? { type: 'LOW_STOCK_CLEAR_RESULT', ok: false, error: y.error, username: d.username }
                    : { type: 'LOW_STOCK_CLEAR_RESULT', ok: true, username: d.username });
            });
            return true;
        }

        if (d.type === 'SAVE_MANUAL_TOKEN' && d.username !== undefined) {
            arkaPlana({ type: 'SAVE_MANUAL_TOKEN', username: d.username, token: d.token }, function (y) {
                gonder({ type: 'MANUAL_TOKEN_SAVED', ok: !!(y && y.ok), expiry: y && y.expiry });
            });
            return true;
        }

        if (d.type === 'GET_MANUAL_TOKEN_STATUS' && d.username) {
            arkaPlana({ type: 'GET_MANUAL_TOKEN_STATUS', username: d.username }, function (y) {
                gonder({ type: 'MANUAL_TOKEN_STATUS', hasToken: !!(y && y.hasToken), expiry: y && y.expiry });
            });
            return true;
        }

        if (d.type === 'LOW_STOCK_MARK_DONE' && d.productId) {
            var kullanici = d.username || sonKullanici;
            if (kullanici) arkaPlana({ type: 'MARK_DONE', username: kullanici, productId: d.productId }, function () {});
            return true;
        }

        return false;
    }

    // ==================================================================
    // Sayım Hazırlığı aktarımı: SKT ve API bilgisi
    //
    // Sayfa dünyasındaki `site-yardimci.js` isteği buraya postMessage ile
    // yolluyor, biz arka plana iletiyoruz, cevabı geri yayınlıyoruz.
    // Mesaj adları eski eklentiden korundu; `js/counting.js` bunları biliyor.
    // ==================================================================

    try {
        chrome.runtime.onMessage.addListener(function (m) {
            if (!m || typeof m.type !== 'string') return;
            if (m.type === 'WAREHOUSE_EXPIRY_PROGRESS') {
                gonder({ type: 'WAREHOUSE_EXPIRY_PROGRESS', message: m.message || '' });
            } else if (m.type === 'WAREHOUSE_EXPIRY_RESPONSE') {
                gonder({
                    type: 'WAREHOUSE_EXPIRY_RESPONSE',
                    success: m.success,
                    byProductId: m.byProductId,
                    error: m.error,
                    total: m.total,
                    withData: m.withData
                });
            }
        });
    } catch (e) { /* sessiz */ }

    function sktAktar(d) {
        if (d.type === 'GETIR_EXTENSION_PING') {
            gonder({ type: 'GETIR_EXTENSION_PONG', extensionId: chrome.runtime.id });
            return true;
        }

        if (d.type === 'GETIR_GET_API_INFO') {
            arkaPlana({ type: 'GET_API_INFO' }, function (y) {
                gonder({
                    type: 'GETIR_API_INFO_RESULT',
                    success: !!(y && y.success),
                    apiInfo: y && y.apiInfo,
                    error: (y && y.error) || (y ? null : 'Eklenti yanıt vermedi')
                });
            });
            return true;
        }

        if (d.type === 'GETIR_FETCH_EXPIRY_REQUEST') {
            arkaPlana({
                type: 'FETCH_EXPIRY_PRODUCTS',
                productIds: d.productIds || [],
                warehouseId: d.warehouseId,   // depo kimliği çağırandan gelir, sabit yok
                endDate: d.endDate || '2030-07-31'
            }, function () {
                // Asıl sonuç arka plandan WAREHOUSE_EXPIRY_RESPONSE olarak
                // geliyor, yukarıdaki dinleyici yakalıyor. Buradaki geri
                // çağrı yalnız bağlantı koptuysa haber vermek için.
                if (chrome.runtime.lastError) {
                    gonder({
                        type: 'WAREHOUSE_EXPIRY_RESPONSE',
                        success: false,
                        byProductId: {},
                        error: chrome.runtime.lastError.message
                    });
                }
            });
            return true;
        }

        return false;
    }

    // ==================================================================
    // Yönetici paneli aktarımı: Raf Etiketi ve Ürün Çekici
    //
    // Eski eklentiler bu işi `https://*/*` izniyle yapıyordu, yani Chrome
    // kurulumda "ziyaret ettiğiniz tüm sitelerdeki verileri okuyabilir"
    // diyordu. Tek sebebi yönetici paneline eklenti kimliğini yazmaktı.
    // Burada aktarım jetbarkod.com.tr ile sınırlı, o izne hiç gerek yok.
    //
    // Panelin kullandığı mesaj adları (WAREHOUSE_EXPORT_SHELF_LABELS gibi)
    // korundu; `js/admin-product-importer.js` değişmedi. Çakışan adlar
    // yalnızca eklentinin İÇİNDE ayrıldı.
    // ==================================================================

    var YONETICI_ESLEME = {
        WAREHOUSE_EXPORT_SHELF_LABELS: 'JBA_RAF_ETIKET_DISAKTAR',
        WAREHOUSE_PARSE_MANUAL_HTML: 'JBA_RAF_HTML_AYRISTIR',
        GETIR_EXPORT_PRODUCTS: 'JBA_URUN_DISAKTAR'
    };

    // Arka plandan panele geri dönen adlar. Bunlar çakışmıyor, olduğu gibi
    // aktarılıyor; panel zaten bunları dinliyor.
    var YONETICI_CEVAPLARI = [
        'WAREHOUSE_SHELF_LABEL_PROGRESS', 'WAREHOUSE_SHELF_LABEL_RESPONSE',
        'WAREHOUSE_MANUAL_HTML_RESPONSE', 'WAREHOUSE_EXTENSION_ID_RESPONSE',
        'GETIR_EXPORT_PRODUCTS_RESPONSE', 'GETIR_PROGRESS'
    ];

    try {
        chrome.runtime.onMessage.addListener(function (m) {
            if (m && typeof m.type === 'string' && YONETICI_CEVAPLARI.indexOf(m.type) > -1) {
                gonder(m);
            }
        });
    } catch (e) { /* sessiz */ }

    function yoneticiAktar(d) {
        var yeniAd = YONETICI_ESLEME[d.type];
        if (!yeniAd) return false;
        var istek = {};
        for (var k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) istek[k] = d[k]; }
        istek.type = yeniAd;
        arkaPlana(istek, function () { /* sonuç ayrı mesajla geliyor */ });
        return true;
    }

    // Sayfa dinleyicisini bizden önce kurmuş olabilir de olmayabilir de.
    // İkisini de yakalamak için hem hemen hem yükleme bitince haber ver.
    merhaba();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', merhaba);
    }
    global.addEventListener('load', merhaba);
})(window);
