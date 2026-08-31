/**
 * Banko kodları.
 * ============================================================================
 *
 * SORUN
 * Sipariş hazırlanırken depocu önce bankonun (sepetin durduğu yer) karekodunu,
 * sonra ürünleri okutuyor. Karekodlar A4 kâğıda basılı: 120 tane, sayfalarca.
 * Depocu fiziksel olarak boş bir bankonun önünde duruyor, numarasını görüyor,
 * sonra kâğıtta o numarayı arıyor. Otuz banko doluyken bu arama zaman yiyor.
 *
 * ÇÖZÜM
 * Numara zaten depocunun gözünün önünde; ondan tahmin istemiyoruz. Numarayı
 * yazıyor ya da ızgaradan dokunuyor, karekod okutulacak boyda ekrana geliyor.
 * Kâğıt aramak yok, sayfa çevirmek yok.
 *
 * NEDEN "SANA BOŞ BANKO SEÇEYİM" DEMİYORUZ
 * Hangi bankonun boş olduğunu yalnızca oradaki insan görüyor. Tarayıcı bunu
 * bilemez; bilirmiş gibi yapan bir arayüz depocuyu yanlış bankoya gönderir ve
 * kâğıttan daha kötü olur. Yaptığımız tek yardım hafıza: bu cihazda son
 * kullanılan bankolar işaretli kalıyor, aynı yere iki kez gitmiyor.
 *
 * KAREKODUN İÇERİĞİ
 * Basılı kâğıttaki karekodların içeriği düz metin: "BNK.001", "BNK.047".
 * Kâğıttan üç örnek çözülüp doğrulandı. Bu yüzden görsel taşımıyoruz,
 * karekodu kendimiz üretiyoruz; okutulunca terminal aynı değeri görüyor.
 *
 * KAPALIYKEN HİÇBİR ŞEY YAPMAZ
 * Ayarlardaki anahtar kapalıysa modül DOM'a hiç dokunmuyor, karekod
 * üretmiyor, dinleyici bağlamıyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var ADET = 120;
    var ONEK = 'BNK.';
    var AYAR_ANAHTARI = 'bankoEnabled';
    var SON_ANAHTAR = 'jb_banko_son';
    var SECILI_ANAHTAR = 'jb_banko_secili';
    var SON_SINIRI = 12;

    function kod(no) {
        return ONEK + String(no).padStart(3, '0');
    }

    /*
     * KAREKODUN İÇERİĞİ
     *
     * Basılı kâğıttaki karekod düz metin DEĞİL, otuz yedi karakterlik bir
     * JSON:
     *
     *     {"type":60,"data":{"code":"BNK.008"}}
     *
     * İlk denememde çözücünün döndürdüğü nesnenin içindeki `data.code`
     * alanını okuyup onu içerik sandım ve karekodu "BNK.008" olarak
     * ürettim. Telefonla okutulunca "https://BNK.008" çıkıyordu, çünkü
     * nokta içeren düz metni tarayıcılar adres sanıyor. Terminal de yanlış
     * değeri görürdü.
     *
     * `type` alanı kod ailesini söylüyor: banko 60, satıştan çıkarma
     * (ATIK.*) 20. Kâğıttan dört örnek çözülüp doğrulandı.
     *
     * Metin elle kuruluyor, `JSON.stringify` ile değil: alan sırası ve
     * boşluksuzluk garanti olsun, kütüphane sürümüne bağlı kalmasın.
     */
    var TUR_BANKO = 60;

    function karekodIcerigi(no) {
        return '{"type":' + TUR_BANKO + ',"data":{"code":"' + kod(no) + '"}}';
    }

    // ==================================================================
    // Ayar ve hafıza
    // ==================================================================

    function acikMi() {
        try { return localStorage.getItem(AYAR_ANAHTARI) === '1'; }
        catch (e) { return false; }
    }

    function ayarla(acik) {
        try { localStorage.setItem(AYAR_ANAHTARI, acik ? '1' : '0'); }
        catch (e) { /* gizli sekmede yazılamaz, sorun değil */ }
    }

    function sonKullanilanlar() {
        try {
            var ham = JSON.parse(localStorage.getItem(SON_ANAHTAR) || '[]');
            return Array.isArray(ham) ? ham : [];
        } catch (e) { return []; }
    }

    function kullanildiIsaretle(no) {
        var liste = sonKullanilanlar().filter(function (k) { return k.no !== no; });
        liste.unshift({ no: no, an: Date.now() });
        if (liste.length > SON_SINIRI) liste.length = SON_SINIRI;
        try {
            localStorage.setItem(SON_ANAHTAR, JSON.stringify(liste));
            localStorage.setItem(SECILI_ANAHTAR, String(no));
        } catch (e) { /* yoksay */ }
    }

    function seciliNo() {
        try {
            var n = parseInt(localStorage.getItem(SECILI_ANAHTAR) || '', 10);
            return (n >= 1 && n <= ADET) ? n : null;
        } catch (e) { return null; }
    }

    /** Kaç dakika önce kullanıldı. */
    function neZaman(an) {
        var dk = Math.floor((Date.now() - an) / 60000);
        if (dk < 1) return 'az önce';
        if (dk < 60) return dk + ' dk önce';
        var sa = Math.floor(dk / 60);
        if (sa < 24) return sa + ' saat önce';
        return Math.floor(sa / 24) + ' gün önce';
    }

    // ==================================================================
    // Karekod
    // ==================================================================

    var qrOnbellek = {};

    /**
     * Karekodu üretip veri adresi olarak döndürür. Aynı banko için ikinci
     * kez üretilmiyor; 120 bankonun tamamı gezilse bile toplam maliyet bir
     * kerelik.
     */
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
        } catch (e) {
            adres = null;
        }
        document.body.removeChild(kap);
        if (adres) qrOnbellek[anahtar] = adres;
        return adres;
    }

    // ==================================================================
    // Arayüz
    // ==================================================================

    function kacir(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /*
     * ARAYÜZ KARARI
     *
     * İlk hâlinde çubuğa dokun, panel açılsın, ızgarada numarayı bul, tıkla,
     * sonra karekodu görmek için kaydır. Dört hareket ve uzayan bir sayfa.
     * Depocunun elinde terminal var, tek eli boş.
     *
     * Şimdi tek hareket: numarayı yaz. Numara zaten gözünün önünde, bankonun
     * üstünde yazıyor. İki hane girer girmez karekod ekranın ortasında,
     * okutulacak boyda beliriyor. Kaydırma yok, panel açma yok.
     *
     * Karekod akışın içinde değil üstünde duruyor. Böylece satır 56 pikselde
     * kalıyor, sayfa hiç uzamıyor ve karekod belirip kaybolurken altındaki
     * hiçbir şey kımıldamıyor.
     *
     * 120'lik ızgara duruyor ama ikinci planda: numarayı bilmeyen ya da
     * gözüyle seçmek isteyen için "Tümü" düğmesinin arkasında.
     */
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

                '<div class="bnk__son" data-rol="son"></div>' +
                '<span class="bnk__bosluk"></span>' +
                '<button class="bnk__tumu" type="button" data-rol="tumu">Tümü</button>' +
            '</div>' +

            /* Karekod perdesi: akışın üstünde, sayfayı uzatmıyor */
            '<div class="bnk__perde" data-rol="perde" hidden>' +
                '<div class="bnk__kart" role="dialog" aria-label="Banko karekodu">' +
                    '<div class="bnk__qr" data-rol="qr"></div>' +
                    '<p class="bnk__kod" data-rol="kod">—</p>' +
                    '<p class="bnk__ipucu">Okuttuktan sonra kapatmak için dokun ya da Esc</p>' +
                    '<button class="bnk__kapat" type="button" data-rol="kapat" aria-label="Kapat">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
                        ' stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>' +

            /* Izgara perdesi: ikinci plan */
            '<div class="bnk__perde bnk__perde--izgara" data-rol="izgaraPerde" hidden>' +
                '<div class="bnk__izgaraKart" role="dialog" aria-label="Banko numaraları">' +
                    '<div class="bnk__izgaraBas">' +
                        '<b>Banko seç</b>' +
                        '<button class="bnk__kapat bnk__kapat--ic" type="button" data-rol="izgaraKapat"' +
                        ' aria-label="Kapat">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
                        ' stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
                    '</div>' +
                    '<div class="bnk__izgara" data-rol="izgara" role="listbox"' +
                    ' aria-label="Banko numaraları"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function kur(hedef, secenekler) {
        if (!hedef) return null;
        secenekler = secenekler || {};

        hedef.innerHTML = panelHtml();

        var kok = hedef.querySelector('.bnk');
        var alan = kok.querySelector('[data-rol="alan"]');
        var perde = kok.querySelector('[data-rol="perde"]');
        var qrKutu = kok.querySelector('[data-rol="qr"]');
        var kodYazi = kok.querySelector('[data-rol="kod"]');
        var sonKutu = kok.querySelector('[data-rol="son"]');
        var tumuDugme = kok.querySelector('[data-rol="tumu"]');
        var izgaraPerde = kok.querySelector('[data-rol="izgaraPerde"]');
        var izgara = kok.querySelector('[data-rol="izgara"]');

        var secili = seciliNo();

        // Izgara bir kez çiziliyor
        var h = '';
        for (var i = 1; i <= ADET; i++) {
            h += '<button class="bnk__hucre" type="button" role="option" data-no="' + i +
                 '" aria-selected="false">' + i + '</button>';
        }
        izgara.innerHTML = h;
        var hucreler = izgara.querySelectorAll('.bnk__hucre');

        function sonuYaz() {
            var liste = sonKullanilanlar();
            if (!liste.length) { sonKutu.innerHTML = ''; return; }
            var c = '<span class="bnk__sonEtiket">son</span>';
            for (var j = 0; j < Math.min(liste.length, 4); j++) {
                c += '<button class="bnk__sonOge" type="button" data-no="' + liste[j].no +
                     '" title="' + neZaman(liste[j].an) + '">' + liste[j].no + '</button>';
            }
            sonKutu.innerHTML = c;
        }

        function isaretle() {
            var son = sonKullanilanlar();
            var harita = {};
            for (var j = 0; j < son.length; j++) harita[son[j].no] = true;
            for (var k = 0; k < hucreler.length; k++) {
                var no = parseInt(hucreler[k].dataset.no, 10);
                hucreler[k].classList.toggle('kullanildi', !!harita[no]);
                var bu = no === secili;
                hucreler[k].classList.toggle('secili', bu);
                hucreler[k].setAttribute('aria-selected', bu ? 'true' : 'false');
            }
        }

        function perdeKapat() {
            perde.hidden = true;
            izgaraPerde.hidden = true;
            document.body.classList.remove('bnk-acik');
        }

        function goster(no) {
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

            kullanildiIsaretle(no);
            sonuYaz();
            isaretle();
            if (typeof secenekler.secildi === 'function') secenekler.secildi(no, kod(no));
        }

        /* İki hane girilir girmez karekod açılıyor. Tek haneli bankolar için
           (1-9) kısa bir bekleme var: "4" yazıp "7" yazacak olan kişi
           4 numaralı bankonun karekoduyla karşılaşmasın. */
        var yazmaZaman = null;

        alan.addEventListener('input', function () {
            var temiz = alan.value.replace(/\D/g, '').slice(0, 3);
            if (temiz !== alan.value) alan.value = temiz;
            if (yazmaZaman) { clearTimeout(yazmaZaman); yazmaZaman = null; }
            var no = parseInt(temiz, 10);
            if (!(no >= 1 && no <= ADET)) return;
            if (temiz.length >= 2) goster(no);
            else yazmaZaman = setTimeout(function () { goster(no); }, 700);
        });

        alan.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            if (yazmaZaman) { clearTimeout(yazmaZaman); yazmaZaman = null; }
            var no = parseInt(alan.value.replace(/\D/g, ''), 10);
            if (no >= 1 && no <= ADET) goster(no);
        });

        sonKutu.addEventListener('click', function (e) {
            var d = e.target.closest('.bnk__sonOge');
            if (!d) return;
            alan.value = d.dataset.no;
            goster(parseInt(d.dataset.no, 10));
        });

        tumuDugme.addEventListener('click', function () {
            izgaraPerde.hidden = false;
            perde.hidden = true;
            document.body.classList.add('bnk-acik');
            var s = izgara.querySelector('.bnk__hucre.secili');
            if (s) s.scrollIntoView({ block: 'center' });
        });

        izgara.addEventListener('click', function (e) {
            var d = e.target.closest('.bnk__hucre');
            if (!d) return;
            alan.value = d.dataset.no;
            goster(parseInt(d.dataset.no, 10));
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

        sonuYaz();
        isaretle();

        return {
            goster: goster,
            kapat: perdeKapat,
            odakla: function () { try { alan.focus(); alan.select(); } catch (e) {} },
            kok: kok
        };
    }

    global.JBBanko = {
        ADET: ADET,
        kod: kod,
        karekodIcerigi: karekodIcerigi,
        acikMi: acikMi,
        ayarla: ayarla,
        kur: kur,
        karekod: karekod,
        sonKullanilanlar: sonKullanilanlar
    };
})(window);
