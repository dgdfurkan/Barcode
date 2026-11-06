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
            var a = (r && r.jbaFirinNobet) || {};
            // Eski kayıt dakika tutuyordu; saniyesi yoksa yeni varsayılan 15 sn
            var sn = Number(a.sn) > 0 ? Number(a.sn) : 15;
            firinAyar.value = a.acik === false ? '0' : String(sn);
            if (!firinAyar.value) firinAyar.value = '15';
        });
        firinAyar.addEventListener('change', function () {
            var sn = parseInt(firinAyar.value, 10) || 0;
            chrome.storage.local.set({ jbaFirinNobet: sn ? { acik: true, sn: sn } : { acik: false, sn: 15 } });
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

    /* Günlük sayım: durum, elle ekleme, iki simülasyon */
    var gunlukDurum = document.getElementById('gunlukDurum');
    function gunlukCiz(v) {
        if (!gunlukDurum) return;
        var bugun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
        var ozet = document.getElementById('gunlukOzet');
        if (!v || v.gun !== bugun) {
            gunlukDurum.textContent = 'Bugün henüz eklenmedi.';
            if (ozet) ozet.textContent = 'Bugün henüz eklenmedi';
            return;
        }
        if (ozet) ozet.textContent = (v.durum === 'eklendi' ? 'Bugün eklendi · ' + (v.adet || 0) + ' ürün' : String(v.metin || '')) + ' · ' + saatYaz(v.zaman);
        gunlukDurum.textContent = '';
        var b = document.createElement('b');
        b.textContent = saatYaz(v.zaman);
        gunlukDurum.appendChild(b);
        gunlukDurum.appendChild(document.createTextNode(' · ' + String(v.metin || '')));
    }
    chrome.storage.local.get('jbaGunlukSayim', function (r) { gunlukCiz(r && r.jbaGunlukSayim); });
    chrome.storage.onChanged.addListener(function (d, alan) {
        if (alan === 'local' && d.jbaGunlukSayim) gunlukCiz(d.jbaGunlukSayim.newValue);
    });
    function gunlukDugme(id, mesaj, mesgulYazi, durumEl) {
        var b = document.getElementById(id);
        if (!b) return;
        var ilk = b.textContent;
        b.addEventListener('click', function () {
            b.disabled = true;
            b.textContent = mesgulYazi;
            chrome.runtime.sendMessage(mesaj, function (c) {
                void chrome.runtime.lastError;
                b.textContent = c && c.ok ? 'Tamam' : 'Olmadı';
                var hedef = durumEl || gunlukDurum;
                if (hedef && c && c.metin) hedef.textContent = c.metin;
                setTimeout(function () { b.disabled = false; b.textContent = ilk; }, 3000);
            });
        });
    }
    /* Aç/kapa: her biri ayrı; varsayılan hepsi açık */
    var GUNLUK_SECENEK = { gunlukAyarEkle: 'ekle', gunlukAyarSabah: 'sabah', gunlukAyarGece: 'gece' };
    chrome.storage.local.get('jbaGunlukAyar', function (r) {
        var a = (r && r.jbaGunlukAyar) || {};
        Object.keys(GUNLUK_SECENEK).forEach(function (id) {
            var k = document.getElementById(id);
            if (!k) return;
            k.checked = a[GUNLUK_SECENEK[id]] !== false;
            k.addEventListener('change', function () {
                chrome.storage.local.get('jbaGunlukAyar', function (r2) {
                    var y = Object.assign({}, (r2 && r2.jbaGunlukAyar) || {});
                    y[GUNLUK_SECENEK[id]] = k.checked;
                    chrome.storage.local.set({ jbaGunlukAyar: y });
                });
            });
        });
    });
    gunlukDugme('gunlukEkle', { type: 'JBA_GUNLUK_EKLE' }, 'Okunuyor...');

    /* Fırın sesi (arka-plan/firin-ses.js okuyor; varsayılanlar orada da aynı) */
    var SES_VARSAYILAN = {
        duzey: 100, satis: 'her', ses: 'zil', tekrar: 1,
        kritik: true, kritikSes: 'siren', kritikSure: 5, kritikTekrar: 2, kritikAralik: 30, kritikEnCok: 0,
        cikis: true, cikisSes: 'alarm', hatirlat: 50
    };
    /* Ayar alanı -> öğe kimliği; sayılar sayı olarak saklanır */
    var SES_ALAN = {
        satis: 'sesSatis', ses: 'sesTur', tekrar: 'sesTekrar',
        kritikSes: 'sesKritikTur', kritikSure: 'sesKritikSure', kritikTekrar: 'sesKritikTekrar',
        kritikAralik: 'sesKritikAralik', kritikEnCok: 'sesKritikEnCok',
        cikisSes: 'sesCikisTur', hatirlat: 'sesHatirlat'
    };
    var SAYI_ALAN = ['tekrar', 'kritikSure', 'kritikTekrar', 'kritikAralik', 'kritikEnCok', 'hatirlat'];
    var sesEl = function (id) { return document.getElementById(id); };
    var sesler = (globalThis.JBASes && globalThis.JBASes.SESLER) || [];
    ['sesTur', 'sesKritikTur', 'sesCikisTur'].forEach(function (id) {
        var s = sesEl(id);
        if (!s) return;
        sesler.forEach(function (x) {
            var o = document.createElement('option');
            o.value = x.ad;
            o.textContent = x.baslik;
            s.appendChild(o);
        });
    });
    function sesGrup(ad, acik) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-grup="' + ad + '"]'), function (e) { e.hidden = !acik; });
    }
    function sesFormu(a) {
        Object.keys(SES_ALAN).forEach(function (k) { sesEl(SES_ALAN[k]).value = String(a[k]); });
        sesEl('sesDuzey').value = String(a.duzey);
        sesEl('sesDuzeyYazi').textContent = '%' + a.duzey;
        sesEl('sesKritik').checked = a.kritik;
        sesEl('sesCikis').checked = a.cikis;
        sesGrup('satis', a.satis === 'her');
        sesGrup('kritik', a.kritik);
        sesGrup('cikis', a.cikis);
        var parca = [a.satis === 'her' ? 'Her satışta' : 'Satış sessiz', a.kritik ? 'kritik alarm açık' : 'kritik alarm kapalı', '%' + a.duzey];
        var ozet = sesEl('sesOzet');
        if (ozet) ozet.textContent = parca.join(' · ');
    }
    function sesOku() {
        var y = {
            duzey: parseInt(sesEl('sesDuzey').value, 10) || 100,
            kritik: sesEl('sesKritik').checked,
            cikis: sesEl('sesCikis').checked
        };
        Object.keys(SES_ALAN).forEach(function (k) {
            var v = sesEl(SES_ALAN[k]).value;
            y[k] = SAYI_ALAN.indexOf(k) !== -1 ? parseInt(v, 10) || 0 : v;
        });
        return y;
    }
    if (sesEl('sesSatis')) {
        chrome.storage.local.get('jbaFirinSes', function (r) {
            var k = (r && r.jbaFirinSes) || {};
            var a = Object.assign({}, SES_VARSAYILAN, k);
            // 0.49.0'daki "yalnız kritik stokta" satış seçeneği
            if (a.satis === 'kritik') { a.satis = 'kapali'; a.kritik = true; }
            sesFormu(a);
            var kaydet = function () {
                var y = sesOku();
                sesFormu(y);
                chrome.storage.local.set({ jbaFirinSes: y });
            };
            Object.keys(SES_ALAN).map(function (x) { return SES_ALAN[x]; }).concat(['sesKritik', 'sesCikis', 'sesDuzey']).forEach(function (id) {
                sesEl(id).addEventListener('change', kaydet);
            });
            sesEl('sesDuzey').addEventListener('input', function () {
                sesEl('sesDuzeyYazi').textContent = '%' + sesEl('sesDuzey').value;
            });
        });
        /* Dinle: seçili ayarla, bu pencerede */
        Array.prototype.forEach.call(document.querySelectorAll('[data-dinle]'), function (b) {
            b.addEventListener('click', function () {
                var a = sesOku();
                var tur = b.getAttribute('data-dinle');
                var c = tur === 'kritik' ? { ses: a.kritikSes, tekrar: a.kritikTekrar, sure: a.kritikSure }
                    : tur === 'cikis' ? { ses: a.cikisSes, tekrar: 3, sure: 3 }
                    : { ses: a.ses, tekrar: a.tekrar, sure: 0 };
                try { globalThis.JBASes.cal(c.ses, { tekrar: c.tekrar, sure: c.sure, duzey: a.duzey }); } catch (e) { /* ses yok */ }
            });
        });
        var sesDurum = sesEl('sesDurum');
        var sesSonCiz = function (v) {
            if (!sesDurum) return;
            if (!v || !v.zaman) { sesDurum.textContent = 'Henüz çalmadı.'; return; }
            sesDurum.textContent = '';
            var b = document.createElement('b');
            b.textContent = 'Son çalma ' + saatYaz(v.zaman);
            sesDurum.appendChild(b);
            sesDurum.appendChild(document.createTextNode(' · ' + String(v.metin || '')));
        };
        /* Çalan kritik alarm ve Sustur */
        var alarmCiz = function (v) {
            var adlar = (v && Array.isArray(v.adlar)) ? v.adlar : [];
            sesEl('sesCalan').hidden = !adlar.length;
            sesEl('sesCalanYazi').textContent = adlar.length ? 'Alarm çalıyor: ' + adlar.slice(0, 3).join(', ') + (adlar.length > 3 ? ' +' + (adlar.length - 3) : '') : '';
        };
        chrome.storage.local.get(['jbaFirinSesSon', 'jbaFirinAlarm'], function (r) {
            sesSonCiz(r && r.jbaFirinSesSon);
            alarmCiz(r && r.jbaFirinAlarm);
        });
        chrome.storage.onChanged.addListener(function (d, alan) {
            if (alan !== 'local') return;
            if (d.jbaFirinSesSon) sesSonCiz(d.jbaFirinSesSon.newValue);
            if (d.jbaFirinAlarm) alarmCiz(d.jbaFirinAlarm.newValue);
        });
        sesEl('sesSustur').addEventListener('click', function () {
            chrome.runtime.sendMessage({ type: 'JBA_FIRIN_SES_SUSTUR' }, function () { void chrome.runtime.lastError; });
        });
    }

    /* Açılır kapanır bölümler: son durum hatırlanır */
    Array.prototype.forEach.call(document.querySelectorAll('.kat__bas'), function (b) {
        var govde = document.getElementById(b.getAttribute('aria-controls'));
        var anahtar = 'jbaKapiKat_' + b.getAttribute('aria-controls');
        var ac = function (acik) {
            b.setAttribute('aria-expanded', String(acik));
            govde.hidden = !acik;
        };
        try { ac(localStorage.getItem(anahtar) === '1'); } catch (e) { ac(false); }
        b.addEventListener('click', function () {
            var acik = b.getAttribute('aria-expanded') !== 'true';
            ac(acik);
            try { localStorage.setItem(anahtar, acik ? '1' : '0'); } catch (e) { /* sessiz */ }
        });
    });
    gunlukDugme('gunlukSimSabah', { type: 'JBA_GUNLUK_SIM', tur: 'sabah' }, 'Gösteriliyor...');
    gunlukDugme('gunlukSimGece', { type: 'JBA_GUNLUK_SIM', tur: 'gece' }, 'Gösteriliyor...');

    /* Simülasyon: tek sefer, gerçek ürünlerden rastgele eksik, kart 20 sn */
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
