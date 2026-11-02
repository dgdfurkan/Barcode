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
 * Getir'e istek atmaz.
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

    // Köprü jetonu biz dinlemeye başlamadan yayınlamış olabilir
    try { global.postMessage({ type: 'JB_JETON_SOR' }, location.origin); } catch (e) { /* sessiz */ }
})(window);
