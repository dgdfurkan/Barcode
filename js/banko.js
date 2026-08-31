/**
 * Banko karekodları.
 * ============================================================================
 *
 * SORUN
 * Sipariş hazırlanırken depocu önce bankonun karekodunu, sonra ürünleri
 * okutuyor. Karekodlar A4 kâğıda basılı: 120 tane, sayfalarca. Depocu boş
 * bir bankonun önünde duruyor, numarasını görüyor, kâğıtta o numarayı
 * arıyor. Otuz banko doluyken bu arama zaman yiyor.
 *
 * ÇÖZÜM
 * Toplu kopyalama yapıp siteye gelince ürünler listelenirken ekrana zaten
 * bir banko karekodu geliyor. Beğenmezse üstüne dokunuyor, başka biri
 * geliyor. Numarayı biliyorsa yazıyor. Hiçbirini istemiyorsa kapatıyor.
 * Kâğıt aramak yok, sayfa çevirmek yok, kaydırmak yok.
 *
 * TEKRAR ETMEYEN RASTGELE
 * Aynı bankoyu üst üste önermek işe yaramaz: fiziksel olarak dolu olabilir.
 * Verilen bankolar bir kuyrukta tutuluyor ve kuyruktakiler tekrar
 * önerilmiyor. Aralıktaki bütün bankolar tükenince kuyruk sıfırlanıyor.
 * Kuyruk yerelde saklanıyor, sayfa yenilenince kaybolmuyor.
 *
 * ARALIK AYARDAN
 * Her deponun kullandığı banko aralığı farklı. Alt ve üst sınır ayarlardan
 * seçiliyor; öneriler yalnızca o aralıktan geliyor.
 *
 * KAREKODUN İÇERİĞİ
 * Basılı kâğıttaki karekod düz metin DEĞİL, otuz yedi karakterlik bir JSON.
 * Ayrıntı `karekodIcerigi` içinde.
 *
 * KAPALIYKEN
 * Ayardaki anahtar kapalıysa modül DOM'a hiç dokunmuyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var ADET = 120;
    var ONEK = 'BNK.';

    var AYAR_ANAHTARI = 'bankoEnabled';
    var SECENEK_ANAHTARI = 'jb_banko_secenek';
    var GECMIS_ANAHTARI = 'jb_banko_gecmis';

    var VARSAYILAN = {
        altSinir: 9,
        ustSinir: 120,
        oneriAdedi: 10,
        otoAc: true,
        otoKapatSn: 2
    };

    function kod(no) {
        return ONEK + String(no).padStart(3, '0');
    }

    /*
     * KAREKODUN İÇERİĞİ
     *
     * Basılı kâğıttaki karekod düz metin değil, otuz yedi karakterlik JSON:
     *
     *     {"type":60,"data":{"code":"BNK.008"}}
     *
     * İlk denememde çözücünün döndürdüğü nesnenin içindeki `data.code`
     * alanını içerik sanıp karekodu "BNK.008" olarak ürettim. Telefonla
     * okutulunca "https://BNK.008" çıkıyordu; nokta içeren düz metni
     * tarayıcılar adres sanıyor. Terminal de yanlış değeri görürdü.
     *
     * `type` kod ailesini söylüyor: banko 60, satıştan çıkarma (ATIK.*) 20.
     * Kâğıttan dört örnek çözülüp doğrulandı, ürettiğimiz karekod da geri
     * okutulup karşılaştırıldı.
     *
     * Metin elle kuruluyor, `JSON.stringify` ile değil: alan sırası ve
     * boşluksuzluk kütüphane sürümüne bağlı kalmasın.
     */
    var TUR_BANKO = 60;

    function karekodIcerigi(no) {
        return '{"type":' + TUR_BANKO + ',"data":{"code":"' + kod(no) + '"}}';
    }

    // ==================================================================
    // Ayarlar
    // ==================================================================

    function acikMi() {
        try { return localStorage.getItem(AYAR_ANAHTARI) === '1'; }
        catch (e) { return false; }
    }

    function ayarla(acik) {
        try { localStorage.setItem(AYAR_ANAHTARI, acik ? '1' : '0'); }
        catch (e) { /* gizli sekmede yazılamaz */ }
    }

    function secenekler() {
        var s = {};
        for (var k in VARSAYILAN) s[k] = VARSAYILAN[k];
        try {
            var ham = JSON.parse(localStorage.getItem(SECENEK_ANAHTARI) || '{}');
            for (var a in ham) if (a in VARSAYILAN) s[a] = ham[a];
        } catch (e) { /* bozuksa varsayılan */ }

        // Sınırları makul aralığa çek: bozuk ayar arayüzü kilitlemesin
        s.altSinir = Math.min(Math.max(1, s.altSinir | 0), ADET);
        s.ustSinir = Math.min(Math.max(1, s.ustSinir | 0), ADET);
        if (s.altSinir > s.ustSinir) { var g = s.altSinir; s.altSinir = s.ustSinir; s.ustSinir = g; }
        s.oneriAdedi = Math.min(Math.max(0, s.oneriAdedi | 0), 30);
        s.otoKapatSn = Math.min(Math.max(0, +s.otoKapatSn || 0), 30);
        s.otoAc = !!s.otoAc;
        return s;
    }

    function secenekYaz(yeni) {
        var s = secenekler();
        for (var a in yeni) if (a in VARSAYILAN) s[a] = yeni[a];
        try { localStorage.setItem(SECENEK_ANAHTARI, JSON.stringify(s)); }
        catch (e) { /* yoksay */ }
        return secenekler();
    }

    // ==================================================================
    // Tekrar etmeyen rastgele
    // ==================================================================

    function gecmis() {
        try {
            var g = JSON.parse(localStorage.getItem(GECMIS_ANAHTARI) || '[]');
            return Array.isArray(g) ? g : [];
        } catch (e) { return []; }
    }

    function gecmisYaz(liste) {
        try { localStorage.setItem(GECMIS_ANAHTARI, JSON.stringify(liste)); }
        catch (e) { /* yoksay */ }
    }

    function aralik() {
        var s = secenekler();
        var liste = [];
        for (var i = s.altSinir; i <= s.ustSinir; i++) liste.push(i);
        return liste;
    }

    /**
     * Verilen bankoyu kuyruğa yazar. Kuyruk uzunluğu aralığın bir eksiğini
     * geçmiyor; yoksa hiç aday kalmaz ve her seferinde sıfırlanmak zorunda
     * kalınırdı.
     */
    function kullanildi(no) {
        var g = gecmis().filter(function (x) { return x !== no; });
        g.unshift(no);
        var enFazla = Math.max(1, Math.min(10, aralik().length - 1));
        if (g.length > enFazla) g.length = enFazla;
        gecmisYaz(g);
    }

    /**
     * Kuyrukta olmayanlardan rastgele seçer. Hepsi tükenmişse kuyruk
     * sıfırlanıyor ve baştan başlanıyor: "görünmeyen kalana kadar devam et,
     * sonra yeniden".
     */
    function rastgele(disla) {
        var havuz = aralik();
        if (!havuz.length) return null;

        var yasak = gecmis().slice();
        if (disla != null) yasak.push(disla);

        var uygun = havuz.filter(function (n) { return yasak.indexOf(n) === -1; });
        if (!uygun.length) {
            gecmisYaz([]);
            uygun = havuz.filter(function (n) { return n !== disla; });
            if (!uygun.length) uygun = havuz;
        }
        return uygun[Math.floor(Math.random() * uygun.length)];
    }

    /** Satırda gösterilecek, birbirinden farklı öneriler. */
    function oneriKumesi(adet) {
        var havuz = aralik();
        var yasak = gecmis();
        var uygun = havuz.filter(function (n) { return yasak.indexOf(n) === -1; });
        if (uygun.length < adet) uygun = havuz.slice();

        // Fisher-Yates: baştan seçmek yerine gerçekten karıştırılıyor
        for (var i = uygun.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = uygun[i]; uygun[i] = uygun[j]; uygun[j] = t;
        }
        return uygun.slice(0, Math.min(adet, uygun.length)).sort(function (a, b) { return a - b; });
    }

    // ==================================================================
    // Karekod
    // ==================================================================

    var qrOnbellek = {};

    function karekod(metin, boyut) {
        var anahtar = metin + '|' + boyut;
        if (qrOnbellek[anahtar]) return qrOnbellek[anahtar];
        if (typeof global.QRCode === 'undefined') return null;

        var kap = document.createElement('div');
        kap.style.cssText = 'position:absolute;left:-9999px;top:0;';
        document.body.appendChild(kap);
        var adres = null;
        try {
            new global.QRCode(kap, {
                text: metin,
                width: boyut,
                height: boyut,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: global.QRCode.CorrectLevel.M
            });
            var tuval = kap.querySelector('canvas');
            if (tuval) adres = tuval.toDataURL();
            else {
                var img = kap.querySelector('img');
                if (img) adres = img.src;
            }
        } catch (e) { adres = null; }
        document.body.removeChild(kap);
        if (adres) qrOnbellek[anahtar] = adres;
        return adres;
    }

    // ==================================================================
    // Arayüz
    // ==================================================================

    function panelHtml() {
        return '' +
        '<div class="bnk">' +
            '<div class="bnk__satir">' +
                '<span class="bnk__im" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
                    ' stroke-linecap="round" stroke-linejoin="round">' +
                    '<rect x="3" y="3" width="7" height="7" rx="1.5"/>' +
                    '<rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
                    '<rect x="3" y="14" width="7" height="7" rx="1.5"/>' +
                    '<path d="M14 14h3v3h-3zM19 19h2v2h-2zM19 14h2M14 19h2"/></svg>' +
                '</span>' +
                '<label class="bnk__etiket" for="bnkNo">Banko</label>' +
                '<span class="bnk__kutu">' +
                    '<span class="bnk__onek">BNK.</span>' +
                    '<input id="bnkNo" class="bnk__alan" type="text" inputmode="numeric"' +
                    ' autocomplete="off" maxlength="3" placeholder="00" data-rol="alan"' +
                    ' aria-label="Banko numarası">' +
                '</span>' +
                '<div class="bnk__oneri" data-rol="oneri"></div>' +
                '<span class="bnk__bosluk"></span>' +
                '<button class="bnk__yenile" type="button" data-rol="yenile"' +
                ' aria-label="Önerileri yenile" title="Başka numaralar öner">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
                    ' stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M20 11A8 8 0 0 0 6.3 5.7L4 8"/><path d="M4 4v4h4"/>' +
                    '<path d="M4 13a8 8 0 0 0 13.7 5.3L20 16"/><path d="M20 20v-4h-4"/></svg>' +
                '</button>' +
                '<button class="bnk__tumu" type="button" data-rol="tumu">Tümü</button>' +
            '</div>' +

            '<div class="bnk__perde" data-rol="perde" hidden>' +
                '<div class="bnk__kart" role="dialog" aria-label="Banko karekodu">' +
                    '<button class="bnk__qrDugme" type="button" data-rol="qrDugme"' +
                    ' title="Başka banko öner">' +
                        '<span class="bnk__qr" data-rol="qr"></span>' +
                    '</button>' +
                    '<p class="bnk__kod" data-rol="kod">—</p>' +
                    '<p class="bnk__ipucu">Karekoda dokun: başka banko öner</p>' +
                    '<div class="bnk__sayac" data-rol="sayac" hidden>' +
                        '<span class="bnk__sayacCubuk" data-rol="sayacCubuk"></span>' +
                    '</div>' +
                    '<button class="bnk__kapat" type="button" data-rol="kapat" aria-label="Kapat">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
                        ' stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>' +

            '<div class="bnk__perde bnk__perde--izgara" data-rol="izgaraPerde" hidden>' +
                '<div class="bnk__izgaraKart" role="dialog" aria-label="Banko numaraları">' +
                    '<div class="bnk__izgaraBas">' +
                        '<b>Banko seç</b>' +
                        '<button class="bnk__kapat bnk__kapat--ic" type="button"' +
                        ' data-rol="izgaraKapat" aria-label="Kapat">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
                        ' stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
                    '</div>' +
                    '<div class="bnk__izgara" data-rol="izgara" role="listbox"' +
                    ' aria-label="Banko numaraları"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function kur(hedef, disSecenekler) {
        if (!hedef) return null;
        disSecenekler = disSecenekler || {};

        hedef.innerHTML = panelHtml();

        var kok = hedef.querySelector('.bnk');
        var alan = kok.querySelector('[data-rol="alan"]');
        var perde = kok.querySelector('[data-rol="perde"]');
        var qrKutu = kok.querySelector('[data-rol="qr"]');
        var qrDugme = kok.querySelector('[data-rol="qrDugme"]');
        var kodYazi = kok.querySelector('[data-rol="kod"]');
        var oneriKutu = kok.querySelector('[data-rol="oneri"]');
        var yenileDugme = kok.querySelector('[data-rol="yenile"]');
        var tumuDugme = kok.querySelector('[data-rol="tumu"]');
        var izgaraPerde = kok.querySelector('[data-rol="izgaraPerde"]');
        var izgara = kok.querySelector('[data-rol="izgara"]');
        var sayac = kok.querySelector('[data-rol="sayac"]');
        var sayacCubuk = kok.querySelector('[data-rol="sayacCubuk"]');

        var secili = null;
        var kapanmaZaman = null;

        // Izgara bir kez çiziliyor
        var h = '';
        for (var i = 1; i <= ADET; i++) {
            h += '<button class="bnk__hucre" type="button" role="option" data-no="' + i +
                 '" aria-selected="false">' + i + '</button>';
        }
        izgara.innerHTML = h;
        var hucreler = izgara.querySelectorAll('.bnk__hucre');

        function onerileriYaz() {
            var s = secenekler();
            if (!s.oneriAdedi) { oneriKutu.innerHTML = ''; return; }
            var liste = oneriKumesi(s.oneriAdedi);
            var c = '';
            for (var j = 0; j < liste.length; j++) {
                c += '<button class="bnk__oneriOge" type="button" data-no="' + liste[j] + '">' +
                     liste[j] + '</button>';
            }
            oneriKutu.innerHTML = c;
        }

        function isaretle() {
            var g = gecmis();
            var harita = {};
            for (var j = 0; j < g.length; j++) harita[g[j]] = true;
            var s = secenekler();
            for (var k = 0; k < hucreler.length; k++) {
                var no = parseInt(hucreler[k].dataset.no, 10);
                hucreler[k].classList.toggle('kullanildi', !!harita[no]);
                hucreler[k].classList.toggle('disarida', no < s.altSinir || no > s.ustSinir);
                var bu = no === secili;
                hucreler[k].classList.toggle('secili', bu);
                hucreler[k].setAttribute('aria-selected', bu ? 'true' : 'false');
            }
        }

        function sayaciDurdur() {
            if (kapanmaZaman) { clearTimeout(kapanmaZaman); kapanmaZaman = null; }
            sayac.hidden = true;
            sayacCubuk.style.transition = 'none';
            sayacCubuk.style.transform = 'scaleX(1)';
        }

        /**
         * Kendiliğinden kapanma. Süre görünür: çubuk erirken kullanıcı ne
         * kadar vakti kaldığını görüyor, ekran habersiz kapanmıyor.
         */
        function sayaciBaslat(saniye) {
            sayaciDurdur();
            if (!(saniye > 0)) return;
            sayac.hidden = false;
            sayacCubuk.style.transition = 'none';
            sayacCubuk.style.transform = 'scaleX(1)';
            // Tarayıcının başlangıç hâlini okuması gerekiyor
            void sayacCubuk.offsetWidth;
            sayacCubuk.style.transition = 'transform ' + saniye + 's linear';
            sayacCubuk.style.transform = 'scaleX(0)';
            kapanmaZaman = setTimeout(perdeKapat, saniye * 1000);
        }

        function perdeKapat() {
            sayaciDurdur();
            perde.hidden = true;
            izgaraPerde.hidden = true;
            document.body.classList.remove('bnk-acik');
        }

        /**
         * @param no       Gösterilecek banko.
         * @param otoKapat Kendiliğinden kapanma süresi (saniye) ya da 0.
         */
        function goster(no, otoKapat) {
            if (!(no >= 1 && no <= ADET)) return;
            secili = no;

            var adres = karekod(karekodIcerigi(no), 420);
            qrKutu.innerHTML = adres
                ? '<img src="' + adres + '" alt="' + kod(no) + ' karekodu" width="420" height="420">'
                : '<span class="bnk__bekle">Karekod üretilemedi</span>';
            kodYazi.textContent = kod(no);

            izgaraPerde.hidden = true;
            perde.hidden = false;
            document.body.classList.add('bnk-acik');

            kullanildi(no);
            onerileriYaz();
            isaretle();
            sayaciBaslat(otoKapat || 0);

            if (typeof disSecenekler.secildi === 'function') disSecenekler.secildi(no, kod(no));
        }

        /** Toplu sonuç geldiğinde çağrılıyor: rastgele bir banko açılıyor. */
        function otomatikAc() {
            var s = secenekler();
            if (!s.otoAc) return;
            var no = rastgele();
            if (no) goster(no, s.otoKapatSn);
        }

        /* Karekoda dokunmak "bunu beğenmedim, başkasını ver" demek. Fiziksel
           banko dolu olabilir; sayfayı kapatıp yeniden aramaya gerek yok.
           Sayaç da sıfırdan başlıyor, ekran elinin altından kaçmıyor. */
        qrDugme.addEventListener('click', function () {
            var s = secenekler();
            var yeni = rastgele(secili);
            if (yeni) {
                alan.value = '';
                goster(yeni, s.otoKapatSn);
            }
        });

        var yazmaZaman = null;

        alan.addEventListener('input', function () {
            var temiz = alan.value.replace(/\D/g, '').slice(0, 3);
            if (temiz !== alan.value) alan.value = temiz;
            if (yazmaZaman) { clearTimeout(yazmaZaman); yazmaZaman = null; }
            var no = parseInt(temiz, 10);
            if (!(no >= 1 && no <= ADET)) return;
            /* İki hane girilince açılıyor. Tek hanede kısa bekleme var:
               "4" yazıp "7" yazacak olan kişi 4 numarayla karşılaşmasın. */
            if (temiz.length >= 2) goster(no, 0);
            else yazmaZaman = setTimeout(function () { goster(no, 0); }, 700);
        });

        alan.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            if (yazmaZaman) { clearTimeout(yazmaZaman); yazmaZaman = null; }
            var no = parseInt(alan.value.replace(/\D/g, ''), 10);
            if (no >= 1 && no <= ADET) goster(no, 0);
        });

        oneriKutu.addEventListener('click', function (e) {
            var d = e.target.closest('.bnk__oneriOge');
            if (!d) return;
            alan.value = '';
            goster(parseInt(d.dataset.no, 10), 0);
        });

        yenileDugme.addEventListener('click', function () {
            onerileriYaz();
            yenileDugme.classList.remove('donuyor');
            void yenileDugme.offsetWidth;
            yenileDugme.classList.add('donuyor');
        });

        tumuDugme.addEventListener('click', function () {
            sayaciDurdur();
            izgaraPerde.hidden = false;
            perde.hidden = true;
            document.body.classList.add('bnk-acik');
            var s = izgara.querySelector('.bnk__hucre.secili') ||
                    izgara.querySelector('.bnk__hucre:not(.disarida)');
            if (s) s.scrollIntoView({ block: 'center' });
        });

        izgara.addEventListener('click', function (e) {
            var d = e.target.closest('.bnk__hucre');
            if (!d) return;
            alan.value = '';
            goster(parseInt(d.dataset.no, 10), 0);
        });

        kok.querySelector('[data-rol="kapat"]').addEventListener('click', perdeKapat);
        kok.querySelector('[data-rol="izgaraKapat"]').addEventListener('click', perdeKapat);
        perde.addEventListener('click', function (e) { if (e.target === perde) perdeKapat(); });
        izgaraPerde.addEventListener('click', function (e) { if (e.target === izgaraPerde) perdeKapat(); });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && (!perde.hidden || !izgaraPerde.hidden)) {
                e.stopPropagation();
                perdeKapat();
            }
        }, true);

        onerileriYaz();
        isaretle();

        return {
            goster: goster,
            otomatikAc: otomatikAc,
            tazele: function () { onerileriYaz(); isaretle(); },
            kapat: perdeKapat,
            odakla: function () { try { alan.focus(); alan.select(); } catch (e) {} },
            kok: kok
        };
    }

    global.JBBanko = {
        ADET: ADET,
        VARSAYILAN: VARSAYILAN,
        kod: kod,
        karekodIcerigi: karekodIcerigi,
        acikMi: acikMi,
        ayarla: ayarla,
        secenekler: secenekler,
        secenekYaz: secenekYaz,
        gecmis: gecmis,
        gecmisSifirla: function () { gecmisYaz([]); },
        rastgele: rastgele,
        oneriKumesi: oneriKumesi,
        kur: kur,
        karekod: karekod
    };
})(window);
