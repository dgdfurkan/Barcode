/**
 * Oturum Yeri — telefonda uygulamaya dönünce kaldığı yerden devam
 * ============================================================================
 *
 * SORUN
 * Telefonda uygulama olarak (PWA) kullanılırken sayım yapılıyor, başka bir
 * uygulamaya geçiliyor, bir süre sonra geri dönülüyor ve uygulama ana ekranda
 * açılıyor. Sayım ekranı kayboluyor.
 *
 * SEBEP
 * İşletim sistemi arka plandaki sayfayı belleği geri almak için kapatıyor.
 * Geri dönünce uygulama yeniden başlıyor ve `manifest.json` içindeki
 * `start_url` neresiyse oraya gidiyor; bizde bu "/" yani ana ekran.
 * Bunu engellemenin yolu yok, telefon ne zaman kapatacağına kendi karar
 * veriyor. Yapılabilecek olan, yeniden başlarken nerede kalındığını bilmek.
 *
 * ÇÖZÜM
 * Uygulama sayfalarında son bulunulan adres yerel depoya yazılıyor. Ana
 * ekran açıldığında, uygulama gerçekten yeniden başlamışsa o adrese
 * dönülüyor. Sayım tablosunun hangisi olduğu zaten kayıtlı (`_currentTable`),
 * o yüzden ekran da kaldığı yerden geliyor.
 *
 * NE ZAMAN DÖNMÜYOR
 * Aşağıdaki durumlarda hiç karışmıyor; kullanıcı ana ekrana bilerek geldiyse
 * onu geri fırlatmak en can sıkıcı hata olurdu:
 *   - Tarayıcı sekmesinde açıksa (yalnız PWA'da çalışıyor).
 *   - Oturum yoksa.
 *   - Sayfaya uygulama içinden gelinmişse (`document.referrer` dolu).
 *   - Kullanıcı ana ekrana giden bir bağlantıya tıklamışsa (kayıt siliniyor).
 *   - Kayıt 12 saatten eskiyse.
 *   - Bu açılışta bir kez denenmişse (sessionStorage nöbetçisi, döngü olmasın).
 * ============================================================================
 */
(function (global) {
    'use strict';

    var ANAHTAR = 'jb_son_sayfa';
    var NOBETCI = 'jb_yer_denendi';
    var OMUR_MS = 12 * 60 * 60 * 1000;

    // ==================================================================
    // Küçük yardımcılar
    // ==================================================================

    function pwaMi() {
        try {
            if (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) return true;
            if (global.matchMedia && global.matchMedia('(display-mode: fullscreen)').matches) return true;
            return global.navigator.standalone === true;   // iOS
        } catch (e) {
            return false;
        }
    }

    function girisVarMi() {
        try {
            return !!localStorage.getItem('userSession');
        } catch (e) {
            return false;
        }
    }

    function anaEkranMi(yol) {
        var p = yol || location.pathname;
        return p === '/' || p === '/index.html';
    }

    function yaz(deger) {
        try { localStorage.setItem(ANAHTAR, JSON.stringify(deger)); } catch (e) { /* sessiz */ }
    }

    function sil() {
        try { localStorage.removeItem(ANAHTAR); } catch (e) { /* sessiz */ }
    }

    function oku() {
        try {
            var ham = localStorage.getItem(ANAHTAR);
            if (!ham) return null;
            var k = JSON.parse(ham);
            if (!k || typeof k.yol !== 'string' || !k.yol) return null;
            if (!k.zaman || (Date.now() - k.zaman) > OMUR_MS) return null;
            if (anaEkranMi(k.yol.split('?')[0])) return null;
            return k;
        } catch (e) {
            return null;
        }
    }

    // ==================================================================
    // Kayıt
    // ==================================================================

    function yeriKaydet() {
        if (anaEkranMi()) return;
        if (!girisVarMi()) return;
        yaz({ yol: location.pathname + location.search + location.hash, zaman: Date.now() });
    }

    /**
     * Kullanıcı ana ekrana giden bir bağlantıya tıkladıysa kayıt siliniyor.
     * Böylece oraya bilerek gitmiş oluyor ve geri fırlatılmıyor. Bu denetim
     * `document.referrer`den daha güvenilir; iOS'ta PWA içinde referrer boş
     * gelebiliyor ve o zaman bilerek gidiş de yeniden başlama sanılıyordu.
     */
    function baglantiDenetimi(olay) {
        var a = olay.target && olay.target.closest ? olay.target.closest('a[href]') : null;
        if (!a) return;
        var adres;
        try { adres = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
        if (adres.origin !== location.origin) return;
        if (anaEkranMi(adres.pathname)) sil();
    }

    // ==================================================================
    // Dönüş
    // ==================================================================

    function geriDon() {
        if (!anaEkranMi()) return false;
        if (!pwaMi()) return false;
        if (!girisVarMi()) return false;

        // Uygulama içinden gelindiyse karışma.
        if (document.referrer) {
            try {
                if (new URL(document.referrer).origin === location.origin) return false;
            } catch (e) { /* çözülemedi, devam */ }
        }

        // Bu açılışta bir kez. sessionStorage her yeniden başlatmada boş gelir.
        try {
            if (sessionStorage.getItem(NOBETCI)) return false;
            sessionStorage.setItem(NOBETCI, '1');
        } catch (e) { /* sessiz */ }

        var k = oku();
        if (!k) return false;

        location.replace(k.yol);
        return true;
    }

    // ==================================================================
    // Bağlantı
    // ==================================================================

    if (anaEkranMi()) {
        geriDon();
        document.addEventListener('click', baglantiDenetimi, true);
    } else {
        yeriKaydet();
        document.addEventListener('click', baglantiDenetimi, true);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') yeriKaydet();
        });
        /* pagehide, telefonda sekme kapanırken visibilitychange'den daha
           güvenilir tetikleniyor. İkisi birden var, biri kaçarsa öbürü tutar. */
        global.addEventListener('pagehide', yeriKaydet);
        global.addEventListener('beforeunload', yeriKaydet);
    }

    global.JBOturumYeri = {
        kaydet: yeriKaydet,
        sil: sil,
        oku: oku,
        pwaMi: pwaMi
    };
})(window);
