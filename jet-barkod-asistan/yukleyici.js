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

        if (uygun.length) {
            JBA.log(uygun.length + ' modül bu sayfaya uygun, ' +
                    JBA.calisanlar.filter(function (c) { return c.calisiyor; }).length + ' tanesi çalışıyor.');
        }

        if (JBA.panel) JBA.panel.goster();
    }

    function baslat() {
        acikListesi().then(calistir, function () { calistir(null); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})(window);
