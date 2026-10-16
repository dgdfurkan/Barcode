/**
 * Modül: Satıştan Kaldırma (depo paneli, görünmez)
 * ============================================================================
 *
 * Arayüzü yok. Arka plandaki nöbetçi (arka-plan/kaldirma-nobet.js) saatte
 * bir `JBA_KALDIRMA_SOR` der; burası sayfa köprüsünden (sayfa-koprusu.js)
 * panelin "Satıştan Kaldırma Listesi"ni ister ve sade kayıtları geri verir.
 * Panelin bütün sayfalarında çalışır: kontrol paneli açık olmasa da depo
 * panelinin herhangi bir sekmesi yeter.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var etkin = false;
    var soruNo = 0;

    function listeSor(gun) {
        return new Promise(function (coz) {
            var no = 'k' + Date.now() + '-' + (++soruNo);
            var bitti = false;
            function dinle(e) {
                if (e.source !== window || e.origin !== location.origin) return;
                var d = e.data;
                if (!d || d.type !== 'JB_KALDIRMA_LISTE' || d.no !== no) return;
                bitir(d.sonuc || { ok: false });
            }
            function bitir(v) {
                if (bitti) return;
                bitti = true;
                window.removeEventListener('message', dinle);
                coz(v);
            }
            window.addEventListener('message', dinle);
            // 30 sayfaya kadar sürebilir
            setTimeout(function () { bitir({ ok: false, sebep: 'zaman aşımı' }); }, 90000);
            window.postMessage({ type: 'JB_KALDIRMA_SOR', no: no, gun: gun }, location.origin);
        });
    }

    try {
        chrome.runtime.onMessage.addListener(function (m, gonderen, cevapla) {
            if (!m || m.type !== 'JBA_KALDIRMA_SOR') return false;
            if (!etkin) { cevapla({ ok: false, sebep: 'kapalı' }); return false; }
            listeSor(m.gun).then(cevapla);
            return true;
        });
    } catch (e) { /* yetim bağlam */ }

    JBA.kayit({
        kimlik: 'kaldirma',
        ad: 'Satıştan Kaldırma',
        ozet: 'Satıştan kaldırma listesini saatte bir Jet Barkod\'a aktarır; iptal edilen kayıt Telegram\'a bildirilir.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return /^\/r\/[a-f0-9]{24}\//.test(yol); },
        baslat: function () {
            etkin = true;
            try { chrome.runtime.sendMessage({ type: 'JBA_KALDIRMA_PANO_HAZIR' }, function () { void chrome.runtime.lastError; }); }
            catch (e) { /* yetim bağlam */ }
        },
        durdur: function () { etkin = false; }
    });
})(window);
