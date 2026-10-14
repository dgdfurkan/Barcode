/**
 * Jet Barkod Asistan. Araç çubuğu paneli.
 * ============================================================================
 *
 * Chrome'un eklenti simgesine tıklanınca açılıyor. Etkin sekmeye "hangi
 * modüller çalışıyor" diye soruyor ve listeliyor. Modülün eylemleri varsa
 * düğme olarak çıkıyor; basınca sekmedeki modül çalıştırılıyor.
 *
 * NEDEN BURADA
 * Önceki sürümde bu bilgi sayfanın sağ altında sürekli duran yüzen bir
 * düğmedeydi. Her sayfada yer kaplıyor, gözü yoruyordu. Buraya taşınınca
 * eklenti sayfaya hiçbir şey koymuyor; bilgi lazım olduğunda kullanıcı
 * simgeye basıyor.
 *
 * CEVAP GELMEZSE
 * Getir dışındaki sayfalarda içerik betiği hiç çalışmıyor, dolayısıyla
 * mesaja kimse cevap vermiyor. Bu bir hata değil, beklenen durum;
 * kullanıcıya "bu sayfada çalışmıyor" diye anlatılıyor.
 * ============================================================================
 */
(function () {
    'use strict';

    var govde = document.getElementById('govde');
    var rozet = document.getElementById('rozet');
    var yerEl = document.getElementById('yer');
    var surumEl = document.getElementById('surum');

    var DESTEKLENEN = ['warehouse.getir.com', 'franchise.getir.com', 'franchise-v2.getir.com'];

    try {
        surumEl.textContent = 'sürüm ' + chrome.runtime.getManifest().version;
    } catch (e) { /* sessiz */ }

    function yaz(dugum) {
        govde.innerHTML = '';
        govde.appendChild(dugum);
    }

    function bosMesaj(metin) {
        var p = document.createElement('p');
        p.className = 'bos';
        p.textContent = metin;
        return p;
    }

    function rozetYaz(metin, sinif) {
        rozet.textContent = metin;
        rozet.className = 'rozet' + (sinif ? ' ' + sinif : '');
    }

    /** Tek modül satırı. */
    function modulSatiri(m) {
        var kap = document.createElement('div');
        kap.className = 'modul';

        var ust = document.createElement('div');
        ust.className = 'modul__ust';

        var durumSinifi = m.hata ? 'bozuk' : (m.calisiyor ? 'acik' : '');

        var nokta = document.createElement('span');
        nokta.className = 'nokta' + (durumSinifi ? ' ' + durumSinifi : '');

        var ad = document.createElement('span');
        ad.className = 'modul__ad';
        ad.textContent = m.ad;

        var durum = document.createElement('span');
        durum.className = 'modul__durum' + (durumSinifi ? ' ' + durumSinifi : '');
        durum.textContent = m.hata ? 'hata' : (m.calisiyor ? 'açık' : 'kapalı');

        ust.appendChild(nokta);
        ust.appendChild(ad);
        ust.appendChild(durum);
        kap.appendChild(ust);

        var ozet = document.createElement('p');
        ozet.className = 'modul__ozet';
        ozet.textContent = m.hata
            ? 'Bu modül hata verdi, diğerleri çalışmaya devam ediyor.'
            : (m.calisiyor ? m.ozet : (m.izinli === false ? 'Bu hak hesabında kapalı.' : 'Sayfa yüklenince uyanır.'));
        kap.appendChild(ozet);

        if (m.calisiyor && m.eylemler && m.eylemler.length) {
            var eylemler = document.createElement('div');
            eylemler.className = 'eylemler';
            m.eylemler.forEach(function (ad2, i) {
                var d = document.createElement('button');
                d.type = 'button';
                d.className = 'eylem';
                d.textContent = ad2;
                d.addEventListener('click', function () {
                    d.disabled = true;
                    eylemCalistir(m.kimlik, i, function () {
                        // Eylem sekmede çalışıyor; paneli kapatınca kullanıcı
                        // sonucu sayfada görüyor.
                        window.close();
                    });
                });
                eylemler.appendChild(d);
            });
            kap.appendChild(eylemler);
        }

        return kap;
    }

    function etkinSekme(devam) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (sekmeler) {
            devam(sekmeler && sekmeler[0]);
        });
    }

    function eylemCalistir(kimlik, sira, bitince) {
        etkinSekme(function (sekme) {
            if (!sekme) return bitince();
            chrome.tabs.sendMessage(sekme.id,
                { type: 'JBA_EYLEM_CALISTIR', kimlik: kimlik, eylem: sira },
                function () { void chrome.runtime.lastError; bitince(); });
        });
    }

    function ciz(durum) {
        /* Yalnız bu sayfada çalışan modüller. Eskiden host'taki bütün modüller
           listeleniyordu; kontrol panelinde Fırın Pişirme "kapalı, hak yok"
           görünüyordu, oysa yalnız fırın sayfasında uyanıyor. */
        var moduller = ((durum && durum.moduller) || []).filter(function (m) {
            return m.buSayfada !== false || m.calisiyor;
        });
        var acik = moduller.filter(function (m) { return m.calisiyor; }).length;
        var bozukVar = moduller.some(function (m) { return m.hata; });

        if (!moduller.length) {
            rozetYaz('yok', 'bos');
            return yaz(bosMesaj('Bu sayfada çalışan modül yok. Modüller yalnız ' +
                                'ilgili Getir panellerinde uyanır.'));
        }

        rozetYaz(acik + ' / ' + moduller.length, bozukVar ? 'bozuk' : null);

        var liste = document.createElement('div');
        moduller.forEach(function (m) { liste.appendChild(modulSatiri(m)); });
        yaz(liste);
    }

    etkinSekme(function (sekme) {
        if (!sekme || !sekme.url) {
            rozetYaz('yok', 'bos');
            return yaz(bosMesaj('Sekme okunamadı.'));
        }

        var adres;
        try { adres = new URL(sekme.url).hostname; } catch (e) { adres = ''; }
        yerEl.textContent = adres || sekme.url;

        chrome.tabs.sendMessage(sekme.id, { type: 'JBA_DURUM_SOR' }, function (cevap) {
            // Cevap gelmemesi hata değil: desteklenmeyen sayfada içerik
            // betiği hiç çalışmıyor. lastError okunmazsa konsola uyarı düşer.
            var kopuk = chrome.runtime.lastError;
            void kopuk;

            if (cevap) return ciz(cevap);

            rozetYaz('yok', 'bos');
            if (DESTEKLENEN.indexOf(adres) > -1) {
                yaz(bosMesaj('Sayfa henüz yüklenmemiş olabilir. Sekmeyi yenileyip tekrar dene.'));
            } else {
                yaz(bosMesaj('Asistan bu sayfada çalışmıyor. Getir depo ya da franchise ' +
                             'panelinde aç.'));
            }
        });
    });

    /* Fırın bildirimi sıklığı (arka-plan/firin-nobet.js okuyor) */
    var firinAyar = document.getElementById('firinAyar');
    if (firinAyar) {
        chrome.storage.local.get('jbaFirinNobet', function (r) {
            var a = (r && r.jbaFirinNobet) || { acik: true, dk: 3 };
            firinAyar.value = a.acik === false ? '0' : String(a.simule ? 3 : (a.dk || 3));
        });
        firinAyar.addEventListener('change', function () {
            var dk = parseInt(firinAyar.value, 10) || 0;
            chrome.storage.local.set({ jbaFirinNobet: dk ? { acik: true, dk: dk } : { acik: false, dk: 3 } });
        });
    }

    /* Son kontrolün sonucu: nöbetçinin çalıştığı buradan görülüyor */
    var firinDurum = document.getElementById('firinDurum');
    function saatYaz(t) {
        var d = new Date(t);
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    function durumCiz(v) {
        if (!firinDurum) return;
        if (!v || !v.zaman) { firinDurum.textContent = 'Henüz kontrol yapılmadı.'; return; }
        firinDurum.textContent = '';
        var b = document.createElement('b');
        b.textContent = 'Son kontrol ' + saatYaz(v.zaman);
        firinDurum.appendChild(b);
        firinDurum.appendChild(document.createTextNode(' · ' + String(v.metin || '')));
    }
    chrome.storage.local.get('jbaFirinDurum', function (r) { durumCiz(r && r.jbaFirinDurum); });
    chrome.storage.onChanged.addListener(function (d, alan) {
        if (alan === 'local' && d.jbaFirinDurum) durumCiz(d.jbaFirinDurum.newValue);
    });

    /* Simülasyon: tek sefer, gerçek ürünlerden rastgele eksik, kart 10 sn */
    var firinSim = document.getElementById('firinSim');
    if (firinSim) {
        firinSim.addEventListener('click', function () {
            firinSim.disabled = true;
            firinSim.textContent = 'Hazırlanıyor...';
            chrome.runtime.sendMessage({ type: 'JBA_FIRIN_SIM' }, function (c) {
                void chrome.runtime.lastError;
                firinSim.textContent = c && c.ok ? 'Panelde Gösterildi' : 'Gösterilemedi';
                if (firinDurum && c && !c.ok && c.metin) firinDurum.textContent = c.metin;
                setTimeout(function () {
                    firinSim.disabled = false;
                    firinSim.textContent = 'Simülasyonu Göster';
                }, 3000);
            });
        });
    }
})();
