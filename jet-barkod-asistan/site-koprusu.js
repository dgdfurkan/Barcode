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
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global) return;
        if (!kaynakIzinliMi(e.origin)) return;
        var d = e.data;
        if (!d || typeof d.type !== 'string' || d.type.indexOf('JB_') !== 0) return;

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

    // Sayfa dinleyicisini bizden önce kurmuş olabilir de olmayabilir de.
    // İkisini de yakalamak için hem hemen hem yükleme bitince haber ver.
    merhaba();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', merhaba);
    }
    global.addEventListener('load', merhaba);
})(window);
