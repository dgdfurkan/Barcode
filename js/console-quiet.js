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
    var origWarn = console.warn;
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = function () {
        var msg = String(arguments[0] || '');
        if (msg.indexOf('cdn.tailwindcss.com') !== -1) return;
        if (msg.indexOf('apple-mobile-web-app-capable') !== -1) return;
        return origWarn.apply(console, arguments);
    };
})();
