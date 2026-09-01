/**
 * Jet Barkod. Asistan eklentisi köprüsü (site tarafı).
 * ============================================================================
 *
 * Eklentinin `site-koprusu.js` dosyasıyla konuşur. İki işi var:
 *
 *   1. Eklenti kurulu mu, hangi sürüm. Premium özellikler sayfasındaki
 *      kart bunu kullanıp "Kurulu" rozetini gösteriyor.
 *   2. Kullanıcının hangi modüllere hakkı olduğunu eklentiye bildirmek.
 *      Eklenti bu listeyi yerel deposuna yazıyor, kapalı modülü hiç
 *      başlatmıyor. Premium kilidi ilk kez gerçekten işliyor: eskiden
 *      ZIP kimdeyse özellik onda kalıyordu.
 *
 * GÜVENLİK
 * `postMessage` sayfadaki her betiğe açık. Gelen mesajda kaynak sayfanın
 * kendi kaynağı olmak zorunda, `event.source` de pencerenin kendisi.
 * Giden mesajlarda hedef kaynak `'*'` değil, yine kendi kaynağımız.
 * ============================================================================
 */
(function (global) {
    'use strict';

    /**
     * Premium hakkı ile eklenti modülü eşlemesi.
     * Yeni modül eklenince tek değişecek yer burası.
     */
    var ESLEME = {
        // Şemsiye hak: tek başına bütün modülleri açar.
        jetBarkodAsistan: ['topluKopyalama', 'sayimKopyalama', 'stokBarkodlari',
                           'hizliBul', 'firinPisirme', 'dusukStok',
                           'sayimHazirligi', 'rafEtiketi', 'urunCekici'],
        // Tek tek verilmiş eski haklar da kendi modülünü açmaya devam ediyor.
        bulkCopy: ['topluKopyalama', 'sayimKopyalama'],
        getirStockBarcodesExtension: ['stokBarkodlari'],
        siparisUrunArama: ['hizliBul'],
        firinPisirme: ['firinPisirme'],
        lowStockAlert: ['dusukStok'],
        stokSenkron: ['sayimHazirligi']
    };

    var durum = { kurulu: false, surum: null, kimlik: null };
    var dinleyiciler = [];

    function haberVer() {
        dinleyiciler.forEach(function (d) {
            try { d(durum); } catch (e) { console.warn('Asistan dinleyicisi:', e); }
        });
    }

    function gonder(veri) {
        try { global.postMessage(veri, location.origin); } catch (e) { /* sessiz */ }
    }

    /** Kullanıcının açık haklarından modül listesi çıkarır. */
    function acikModuller() {
        var liste = [];
        Object.keys(ESLEME).forEach(function (hak) {
            var acik = false;
            try {
                acik = !!(global.premiumFeatures &&
                          global.premiumFeatures.checkPremiumFeature(hak));
            } catch (e) { acik = false; }
            if (acik) liste = liste.concat(ESLEME[hak]);
        });
        // Aynı modül iki haktan da gelmiş olabilir.
        return liste.filter(function (m, i) { return liste.indexOf(m) === i; });
    }

    function moduleriBildir() {
        if (!durum.kurulu) return;
        gonder({ type: 'JB_ASISTAN_MODULLER', moduller: acikModuller() });
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global) return;
        if (e.origin !== location.origin) return;
        var d = e.data;
        if (!d || typeof d.type !== 'string') return;

        if (d.type === 'JB_ASISTAN_HAZIR') {
            var ilkKez = !durum.kurulu;
            durum.kurulu = true;
            durum.surum = d.surum || null;
            durum.kimlik = d.kimlik || null;
            haberVer();
            // Kurulu olduğunu yeni öğrendiysek hak listesini hemen gönder.
            if (ilkKez) moduleriBildir();
        }
    });

    global.JetBarkodAsistan = {
        durum: durum,
        /** Kurulu mu diye sorar; eklenti varsa kısa süre içinde cevap gelir. */
        sor: function () { gonder({ type: 'JB_ASISTAN_SOR' }); },
        /** Haklar değişince çağır: eklenti listesini tazeler. */
        moduleriBildir: moduleriBildir,
        /** Durum değişince haber alır. Anında bir kez de çağrılır. */
        dinle: function (f) {
            dinleyiciler.push(f);
            try { f(durum); } catch (e) { /* sessiz */ }
            return function () {
                var i = dinleyiciler.indexOf(f);
                if (i > -1) dinleyiciler.splice(i, 1);
            };
        }
    };

    // Eklenti bizden önce de sonra da yüklenmiş olabilir. O yüzden hem
    // hemen soruyoruz hem de eklentinin kendi selamını dinliyoruz.
    global.JetBarkodAsistan.sor();
    global.addEventListener('load', function () { global.JetBarkodAsistan.sor(); });
})(window);
