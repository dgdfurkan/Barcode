/**
 * Modül: Düşük Stok Uyarısı (franchise tarafı)
 * ============================================================================
 *
 * Arka plandaki alarm dakikada bir uyanıp bu modülden stok hareketlerini
 * istiyor. İstek franchise sayfasından atılıyor çünkü Getir'in API'si
 * sayfanın kendi yetki jetonunu istiyor.
 *
 * JETON NEREDEN GELİYOR (eskisinden farkı burada)
 * Eski eklenti jetonu yakalamak için `window.fetch`'i içerik betiğinden
 * sarmalıyordu. Ama içerik betikleri yalıtılmış dünyada çalışır; oradaki
 * `window.fetch` sayfanın kullandığı fetch değildir. Yani sarmalayıcı
 * sayfanın isteklerini hiç görmüyordu ve jeton çoğu zaman yakalanamıyordu.
 * Elle jeton girme alanının varlık sebebi de buydu.
 *
 * Artık sarmalama `sayfa-koprusu.js` içinde, sayfanın kendi dünyasında
 * yapılıyor; yakalanan jeton buraya postMessage ile geliyor. Elle jeton
 * yolu yine duruyor, yedek olarak.
 *
 * Sayfalama ve hata biçimi `getir-low-stock-alert-extension/
 * content-franchise.js` ile aynı; arka plan aynı yanıtı bekliyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var HAREKET_ADRESI = 'https://franchise-api-gateway.getirapi.com/stocks/stock-movements';
    var VARSAYILAN_DEPO = '5dcafe6ae2c61b1e52cf1704';
    var EN_FAZLA_SAYFA = 3;
    var SAYFA_ARASI_MS = 2000;

    var jeton = null;
    var sonGovde = null;

    // ==================================================================
    // Sayfa köprüsünden gelen jeton ve istek gövdesi
    // ==================================================================

    global.addEventListener('message', function (e) {
        if (e.source !== global) return;
        if (e.origin !== location.origin) return;
        var d = e.data;
        if (!d || typeof d.type !== 'string') return;

        if (d.type === 'JB_JETON' && typeof d.jeton === 'string') {
            jeton = d.jeton;
            try { chrome.runtime.sendMessage({ type: 'TOKEN_FROM_FRANCHISE', token: jeton }); } catch (err) { /* sessiz */ }
        }
        if (d.type === 'JB_HAREKET_GOVDESI' && typeof d.govde === 'string') {
            sonGovde = d.govde;
        }
    });

    /** Sayfa hiç istek atmadıysa bugünün aralığıyla varsayılan gövde. */
    function varsayilanGovde() {
        try {
            var bas = new Date();
            bas.setHours(0, 0, 0, 0);
            var son = new Date(bas.getTime() + 24 * 60 * 60 * 1000 - 1);
            return JSON.stringify({
                warehouseIds: [VARSAYILAN_DEPO],
                startDate: bas.toISOString(),
                endDate: son.toISOString()
            });
        } catch (e) {
            return JSON.stringify({});
        }
    }

    // ==================================================================
    // Arka planın isteği
    // ==================================================================

    function hareketleriGetir(istek) {
        var enFazla = typeof istek.maxPages === 'number' ? istek.maxPages : EN_FAZLA_SAYFA;
        var elleJeton = (typeof istek.manualToken === 'string' && istek.manualToken.trim())
            ? istek.manualToken.trim() : null;
        var kullanilan = elleJeton || jeton;
        if (!kullanilan) return Promise.resolve({ error: 'TOKEN_NOT_CAPTURED' });

        var govde = istek.bodyTemplate || sonGovde || varsayilanGovde();
        var hepsi = [];

        function sayfa(kayma, sayac) {
            if (sayac >= enFazla) return Promise.resolve({ data: hepsi });

            return fetch(HAREKET_ADRESI + '?limit=100&offset=' + kayma, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': kullanilan },
                body: govde
            }).then(function (r) {
                return r.text().then(function (metin) {
                    if (!r.ok) {
                        var ayrinti = metin && metin.length
                            ? (metin.length > 300 ? metin.slice(0, 300) + '...' : metin)
                            : undefined;
                        return { error: 'API ' + r.status, errorDetail: ayrinti };
                    }
                    var json;
                    try { json = JSON.parse(metin); }
                    catch (e) { return { error: 'API yanıtı geçersiz' }; }

                    hepsi = hepsi.concat(json.data || []);
                    if (json.hasNext !== true) return { data: hepsi };
                    if (sayac + 1 >= enFazla) return { data: hepsi };
                    // Getir'in API'sini boğmamak için sayfalar arası bekleme.
                    return new Promise(function (coz) {
                        setTimeout(function () { coz(sayfa(kayma + 100, sayac + 1)); }, SAYFA_ARASI_MS);
                    });
                });
            }).catch(function (e) {
                return { error: 'İstek hatası: ' + ((e && e.message) || 'Bilinmeyen') };
            });
        }

        return sayfa(0, 0);
    }

    function dinleyici(istek, gonderen, cevapla) {
        if (!istek || istek.type !== 'FETCH_MOVEMENTS_FOR_POLL') return;
        hareketleriGetir(istek).then(cevapla, function (e) {
            try { cevapla({ error: 'İstek hatası: ' + ((e && e.message) || 'Bilinmeyen') }); }
            catch (err) { /* sessiz */ }
        });
        return true;
    }

    // ==================================================================

    JBA.kayit({
        kimlik: 'dusukStok',
        ad: 'Düşük Stok Uyarısı',
        ozet: 'Stok hareketlerini izler, eşiğin altına düşen ürünleri Jet Barkod listesine gönderir.',
        hostlar: ['franchise.getir.com'],

        baslat: function () {
            chrome.runtime.onMessage.addListener(dinleyici);
            this._dinleyici = dinleyici;
            // Sayfa köprüsü bizden önce jeton yakalamış olabilir; sorup alalım.
            global.postMessage({ type: 'JB_JETON_SOR' }, location.origin);
        },

        durdur: function () {
            if (this._dinleyici) {
                try { chrome.runtime.onMessage.removeListener(this._dinleyici); } catch (e) { /* sessiz */ }
            }
        },

        eylemler: [
            { ad: 'Jeton durumu', calistir: function () {
                JBA.bildir(jeton
                    ? 'Yetki jetonu yakalandı, uyarılar çalışıyor.'
                    : 'Jeton henüz yakalanmadı. Stok hareketleri sayfasını bir kez aç.',
                    jeton ? 'olumlu' : 'olumsuz');
            } }
        ]
    });
})(window);
