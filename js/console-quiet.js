/**
 * Konsol gürültüsünü kapatır.
 *
 * Uygulamada yüzlerce durum/debug log'u var; bunlar geliştirirken faydalı
 * ama son kullanıcının konsolunu kirletiyor ve gerçek hataları gizliyor.
 * Burada log/debug/info tamamen susturulur, tarayıcının kendi bilinen
 * uyarıları filtrelenir, HATALAR ise DOKUNULMADAN geçer.
 *
 * Geliştirirken hepsini geri açmak için:
 *   localStorage.setItem('JETBARKOD_DEBUG','1'); // sonra sayfayı yenile
 * Kapatmak için:
 *   localStorage.removeItem('JETBARKOD_DEBUG');
 *
 * NOT: Bu dosya her sayfada EN ÜSTTE yüklenmeli; sonra yüklenirse
 * kendisinden önce çalışan script'lerin log'ları geçer.
 */
(function () {
    'use strict';

    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('JETBARKOD_DEBUG') === '1') {
            console.info('%c[Jet Barkod] Debug modu açık — tüm log\'lar görünür.', 'color:#2563eb');
            return;
        }
    } catch (e) { /* ignore */ }

    var noop = function () {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.trace = noop;
    console.group = noop;
    console.groupCollapsed = noop;
    console.groupEnd = noop;
    console.table = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.count = noop;

    // Tarayıcının/kütüphanelerin ürettiği, bizim değiştiremediğimiz bilinen uyarılar
    var SUSTURULAN_UYARILAR = [
        'cdn.tailwindcss.com',
        'apple-mobile-web-app-capable',
        'should not be used in production',
        'Tracking Prevention',
        'was preloaded using link preload',
        'Third-party cookie',
        '-ms-high-contrast',
    ];

    var origWarn = console.warn;
    console.warn = function () {
        var msg = '';
        try { msg = String(arguments[0] || ''); } catch (e) { /* ignore */ }
        for (var i = 0; i < SUSTURULAN_UYARILAR.length; i++) {
            if (msg.indexOf(SUSTURULAN_UYARILAR[i]) !== -1) return;
        }
        return origWarn.apply(console, arguments);
    };

    // console.error'a DOKUNULMUYOR — gerçek hatalar her zaman görünmeli.
})();
