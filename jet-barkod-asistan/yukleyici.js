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

    function calistir(acikliste) {
        var uygun = JBA.moduller.filter(JBA.buSayfayaUygun);

        uygun.forEach(function (m) {
            var kayit = { modul: m, calisiyor: false, hata: null };
            JBA.calisanlar.push(kayit);

            // Liste yoksa hepsi açık. Varsa sadece içindekiler.
            if (acikliste && acikliste.indexOf(m.kimlik) === -1) return;

            try {
                m.baslat({
                    izle: JBA.izle,
                    bildir: JBA.bildir,
                    panoyaYaz: JBA.panoyaYaz,
                    korumali: JBA.korumali
                });
                kayit.calisiyor = true;
            } catch (e) {
                kayit.hata = e;
                JBA.hata('modül ' + m.kimlik, e);
            }
        });

        /* Getir konsolunu kirletmesin diye başlangıç bilgisi yazılmıyor. */

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
