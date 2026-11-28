/**
 * Depo paneli jetonunu arka plana iletir (görünmez, her zaman açık)
 * ============================================================================
 *
 * Sayfa köprüsü (sayfa-koprusu.js) panelin kendi isteklerinden yakaladığı
 * jetonu `JB_JETON` olarak yayınlıyor. Burası onu, adresteki depo kimliğiyle
 * birlikte arka plana verir; arka plan (arka-plan/depo-jeton.js) Jet Barkod
 * hesabına yazar. Ürün aramadaki Ürün Hareketi penceresi telefonda da bu
 * jetonla çalışır.
 *
 * Getir'e kendisi istek atmaz; Mal Kabul ürün sorusunu sayfa köprüsüne aktarır.
 * ============================================================================
 */
(function (global) {
    'use strict';

    if (global.__jbaDepoJeton) return;
    global.__jbaDepoJeton = true;

    function depo() {
        var m = /^\/r\/([a-f0-9]{24})(?:\/|$)/i.exec(location.pathname);
        return m ? m[1].toLowerCase() : null;
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global || e.origin !== location.origin) return;
        var d = e.data;
        if (!d || d.type !== 'JB_JETON' || typeof d.jeton !== 'string') return;
        var k = depo();
        if (!k) return;
        try {
            chrome.runtime.sendMessage({ type: 'JBA_DEPO_JETON', jeton: d.jeton, depo: k }, function () { void chrome.runtime.lastError; });
        } catch (err) { /* yetim bağlam */ }
    });

    /* Siteden oturum tazeleme (arka-plan/depo-jeton.js djTazele): köprü
       yakaladığı son jetonu yeniden duyurur, yukarıdaki dinleyici gönderir. */
    try {
        chrome.runtime.onMessage.addListener(function (m) {
            if (!m || m.type !== 'JBA_DEPO_JETON_ISTE') return false;
            try { global.postMessage({ type: 'JB_JETON_SOR' }, location.origin); } catch (e) { /* sessiz */ }
            return false;
        });
    } catch (e) { /* yetim bağlam */ }

    /* Mal Kabul Talepleri: arka plan (arka-plan/talep-formu.js) katalogda olmayan
       ürünlerin adını açık panel sekmesine soruyor; soru sayfa köprüsüne gider. */
    var urunNo = 0;
    function urunBilgisiSor(idler) {
        return new Promise(function (coz) {
            var no = 'u' + Date.now() + '-' + (++urunNo);
            var bitti = false;
            function dinle(e) {
                if (e.source !== global || e.origin !== location.origin) return;
                var d = e.data;
                if (!d || d.type !== 'JB_URUN_BILGI' || d.no !== no) return;
                bitir(d.sonuc || { ok: false });
            }
            function bitir(v) {
                if (bitti) return;
                bitti = true;
                global.removeEventListener('message', dinle);
                coz(v);
            }
            global.addEventListener('message', dinle);
            setTimeout(function () { bitir({ ok: false, sebep: 'zaman aşımı' }); }, 15000);
            global.postMessage({ type: 'JB_URUN_BILGI_SOR', no: no, idler: idler }, location.origin);
        });
    }
    try {
        chrome.runtime.onMessage.addListener(function (m, gonderen, cevapla) {
            if (!m || m.type !== 'JBA_URUN_BILGI_SOR') return false;
            urunBilgisiSor(Array.isArray(m.idler) ? m.idler.slice(0, 100) : []).then(cevapla);
            return true;
        });
    } catch (e) { /* yetim bağlam */ }

    // Köprü jetonu biz dinlemeye başlamadan yayınlamış olabilir
    try { global.postMessage({ type: 'JB_JETON_SOR' }, location.origin); } catch (e) { /* sessiz */ }
})(window);
