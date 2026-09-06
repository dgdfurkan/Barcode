/**
 * Jet Barkod Asistan. Yükleyici.
 * ============================================================================
 *
 * İçerik betiklerinin sonuncusu. Kayıtlı modüllerden bu sayfaya uyanları
 * seçer, açık olanları çalıştırır, sonra paneli gösterir.
 *
 * HATA YALITIMI
 * Her modül kendi try/catch kabuğunda başlatılıyor. Biri fırlatırsa
 * `calisanlar` listesine hata olarak işaretlenip döngü devam ediyor.
 * Panelde o modülün noktası kırmızı yanar, diğerleri çalışmaya devam eder.
 * Tek eklentiye geçmenin en büyük riski buydu.
 *
 * MODÜL KİLİDİ
 * Hangi modülün açık olduğunu site söylüyor. Kullanıcı jetbarkod.com.tr'ye
 * her girdiğinde `site-koprusu.js` güncel listeyi yerel depoya yazıyor,
 * yükleyici de buradan okuyor. Site hiç ziyaret edilmediyse liste yok
 * sayılır ve hepsi açık kabul edilir; eklenti kurulur kurulmaz çalışsın,
 * kullanıcı boş ekrana bakmasın diye.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var LISTE_ANAHTARI = 'jbaAcikModuller';

    function acikListesi() {
        return new Promise(function (coz) {
            try {
                chrome.storage.local.get(LISTE_ANAHTARI, function (r) {
                    var l = r && r[LISTE_ANAHTARI];
                    coz(Array.isArray(l) ? l : null);
                });
            } catch (e) {
                coz(null);
            }
        });
    }

    /* ==================================================================
       ROTA NÖBETÇİSİ
       ------------------------------------------------------------------
       Getir paneli tek sayfa uygulaması. Fırın ekranından sipariş
       ekranına geçerken sayfa yenilenmiyor, yalnız arayüz değişiyor.
       Yükleyici eskiden bir kez çalışıp bırakıyordu; sonuç şuydu:

         - Fırın düğmesi sipariş ekranında asılı kalıyordu
         - Sipariş ekranına ait modüller hiç başlamıyordu
         - Ürün bulucu görünüp işlevsiz kalabiliyordu

       Artık host'a uyan bütün modüller kayda giriyor, hangisinin
       çalışacağına YOL'a göre her gezinmede yeniden karar veriliyor.
       Modül sözleşmesindeki `durdur` bunun için zaten vardı, yalnız
       kimse çağırmıyordu.
       ================================================================== */

    var sonAcikListe = null;
    var sonYol = location.pathname;

    function hostUygun(m) {
        var host = location.hostname;
        return (m.hostlar || []).some(function (h) {
            return host === h || host.endsWith('.' + h);
        });
    }

    function baglam() {
        return {
            izle: JBA.izle,
            bildir: JBA.bildir,
            panoyaYaz: JBA.panoyaYaz,
            korumali: JBA.korumali
        };
    }

    function modulBaslat(kayit) {
        if (kayit.calisiyor) return;
        try {
            kayit.modul.baslat(baglam());
            kayit.calisiyor = true;
            kayit.hata = null;
        } catch (e) {
            kayit.hata = e;
            JBA.hata('modül ' + kayit.modul.kimlik, e);
        }
    }

    function modulDurdur(kayit) {
        if (!kayit.calisiyor) return;
        try {
            if (typeof kayit.modul.durdur === 'function') kayit.modul.durdur();
        } catch (e) {
            JBA.hata('modül durdur ' + kayit.modul.kimlik, e);
        }
        kayit.calisiyor = false;
    }

    /* Her gezinmede çağrılıyor: yola uymayan modül durduruluyor, uyan
       ve izinli olan başlatılıyor. Hata almış modül yeniden denenmiyor
       ki her turda aynı hata tekrarlanmasın; sayfa yenilendiğinde
       temiz bir şans daha alıyor. */
    function yenidenDegerlendir() {
        JBA.calisanlar.forEach(function (kayit) {
            var uygun = JBA.buSayfayaUygun(kayit.modul);
            var izinli = !sonAcikListe || sonAcikListe.indexOf(kayit.modul.kimlik) !== -1;
            if (!uygun || !izinli) modulDurdur(kayit);
            else if (!kayit.hata) modulBaslat(kayit);
        });
    }

    function rotayiIzle() {
        var bak = function () {
            if (location.pathname === sonYol) return;
            sonYol = location.pathname;
            JBA.korumali('rota', yenidenDegerlendir);
        };
        ['pushState', 'replaceState'].forEach(function (ad) {
            var asil = history[ad];
            if (typeof asil !== 'function' || asil.__jbaSarildi) return;
            var sarmal = function () {
                var r = asil.apply(this, arguments);
                setTimeout(bak, 0);
                return r;
            };
            sarmal.__jbaSarildi = true;
            history[ad] = sarmal;
        });
        global.addEventListener('popstate', function () { setTimeout(bak, 0); });
        /* React yolu history API'sine dokunmadan da değiştirebiliyor;
           yalnız dize karşılaştırması yapan bu nöbet ölçülebilir yük
           getirmiyor. */
        setInterval(bak, 800);
    }

    function calistir(acikliste) {
        sonAcikListe = acikliste;

        /* Host'a uyan HER modül kayda giriyor; yol uymuyorsa yalnız
           başlatılmıyor. Böylece sonradan o yola gezinildiğinde modül
           elimizde hazır duruyor. */
        JBA.moduller.filter(hostUygun).forEach(function (m) {
            JBA.calisanlar.push({ modul: m, calisiyor: false, hata: null });
        });

        yenidenDegerlendir();
        rotayiIzle();
    }

    /*
     * Araç çubuğundaki panel durumu buradan soruyor. Sayfada duran bir
     * düğme yok; kullanıcı Chrome'daki eklenti simgesine tıklayınca
     * bu mesaj geliyor ve o anki sekmenin durumu dönüyor.
     */
    function durumDinleyici(istek, gonderen, cevapla) {
        if (!istek || typeof istek.type !== 'string') return;

        if (istek.type === 'JBA_DURUM_SOR') {
            cevapla({
                adres: location.hostname,
                yol: location.pathname,
                moduller: JBA.calisanlar.map(function (c, i) {
                    return {
                        sira: i,
                        kimlik: c.modul.kimlik,
                        ad: c.modul.ad,
                        ozet: c.modul.ozet || '',
                        calisiyor: !!c.calisiyor,
                        hata: c.hata ? String(c.hata.message || c.hata) : null,
                        eylemler: (c.modul.eylemler || []).map(function (e) { return e.ad; })
                    };
                })
            });
            return true;
        }

        if (istek.type === 'JBA_EYLEM_CALISTIR') {
            var c = JBA.calisanlar.filter(function (x) {
                return x.modul.kimlik === istek.kimlik;
            })[0];
            var e = c && (c.modul.eylemler || [])[istek.eylem];
            if (!e) { cevapla({ ok: false }); return true; }
            JBA.korumali(c.modul.kimlik + ' eylemi', function () { e.calistir(); });
            cevapla({ ok: true });
            return true;
        }
    }

    try { chrome.runtime.onMessage.addListener(durumDinleyici); } catch (e) { /* sessiz */ }

    function baslat() {
        acikListesi().then(calistir, function () { calistir(null); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})(window);
