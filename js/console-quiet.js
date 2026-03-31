/**
 * Production'da console.log / debug / info gürültüsünü kapatır.
 * Konsolda tekrar görmek için: localStorage.setItem('JETBARKOD_DEBUG','1'); sayfayı yenile
 */
(function () {
    'use strict';
    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('JETBARKOD_DEBUG') === '1') {
            return;
        }
    } catch (e) { /* ignore */ }
    var noop = function () {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
})();
