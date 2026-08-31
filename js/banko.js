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

    function panelHtml() {
        return '' +
        '<div class="bnk" data-durum="kapali">' +
            '<button class="bnk__cubuk" type="button" data-rol="ac" aria-expanded="false">' +
                '<span class="bnk__im" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
                    ' stroke-linecap="round" stroke-linejoin="round">' +
                    '<rect x="3" y="3" width="7" height="7" rx="1.5"/>' +
                    '<rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
                    '<rect x="3" y="14" width="7" height="7" rx="1.5"/>' +
                    '<path d="M14 14h3v3h-3zM19 19h2v2h-2zM19 14h2M14 19h2"/></svg>' +
                '</span>' +
                '<span class="bnk__baslik">Banko</span>' +
                '<span class="bnk__secili" data-rol="cubukKod">—</span>' +
                '<span class="bnk__bosluk"></span>' +
                '<span class="bnk__ipucu">karekodu göster</span>' +
                '<svg class="bnk__ok" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
                ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M6 9l6 6 6-6"/></svg>' +
            '</button>' +

            '<div class="bnk__govde" hidden>' +
                '<div class="bnk__ust">' +
                    '<div class="bnk__giris">' +
                        '<label class="bnk__etiket" for="bnkNo">Banko numarası</label>' +
                        '<div class="bnk__kutu">' +
                            '<span class="bnk__onek">' + ONEK + '</span>' +
                            '<input id="bnkNo" class="bnk__alan" type="text" inputmode="numeric"' +
                            ' autocomplete="off" maxlength="3" placeholder="047" data-rol="alan">' +
                        '</div>' +
                        '<p class="bnk__not">Önünde durduğun bankonun numarasını yaz ya da aşağıdan seç.</p>' +
                        '<div class="bnk__son" data-rol="son"></div>' +
                    '</div>' +

                    '<div class="bnk__kart" data-rol="kart">' +
                        '<div class="bnk__qr" data-rol="qr"><span class="bnk__bekle">Numara seç</span></div>' +
                        '<p class="bnk__kod" data-rol="kod">—</p>' +
                    '</div>' +
                '</div>' +

                '<div class="bnk__izgaraKap">' +
                    '<div class="bnk__izgara" data-rol="izgara" role="listbox" aria-label="Banko numaraları"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function kur(hedef, secenekler) {
        if (!hedef) return null;
        secenekler = secenekler || {};

        hedef.innerHTML = panelHtml();

        var kok = hedef.querySelector('.bnk');
        var acDugme = kok.querySelector('[data-rol="ac"]');
        var govde = kok.querySelector('.bnk__govde');
        var alan = kok.querySelector('[data-rol="alan"]');
        var qrKutu = kok.querySelector('[data-rol="qr"]');
        var kodYazi = kok.querySelector('[data-rol="kod"]');
        var cubukKod = kok.querySelector('[data-rol="cubukKod"]');
        var izgara = kok.querySelector('[data-rol="izgara"]');
        var sonKutu = kok.querySelector('[data-rol="son"]');

        var secili = seciliNo();

        // --- Izgara: 120 hücre, bir kez çiziliyor ---
        var izgaraHtml = '';
        for (var i = 1; i <= ADET; i++) {
            izgaraHtml += '<button class="bnk__hucre" type="button" role="option"' +
                          ' data-no="' + i + '" aria-selected="false">' + i + '</button>';
        }
        izgara.innerHTML = izgaraHtml;
        var hucreler = izgara.querySelectorAll('.bnk__hucre');

        function sonuYaz() {
            var liste = sonKullanilanlar();
            if (!liste.length) {
                sonKutu.innerHTML = '<span class="bnk__sonBos">Henüz banko kullanılmadı.</span>';
                return;
            }
            var h = '<span class="bnk__sonBaslik">Son kullandıkların</span><div class="bnk__sonSira">';
            for (var j = 0; j < Math.min(liste.length, 6); j++) {
                h += '<button class="bnk__sonOge" type="button" data-no="' + liste[j].no + '">' +
                     '<b>' + liste[j].no + '</b><span>' + kacir(neZaman(liste[j].an)) + '</span></button>';
            }
            sonKutu.innerHTML = h + '</div>';
        }

        function isaretleriTazele() {
            var son = sonKullanilanlar();
            var haritada = {};
            for (var j = 0; j < son.length; j++) haritada[son[j].no] = true;
            for (var k = 0; k < hucreler.length; k++) {
                var no = parseInt(hucreler[k].dataset.no, 10);
                hucreler[k].classList.toggle('kullanildi', !!haritada[no]);
                var bu = no === secili;
                hucreler[k].classList.toggle('secili', bu);
                hucreler[k].setAttribute('aria-selected', bu ? 'true' : 'false');
            }
        }

        function goster(no, hatirla) {
            if (!(no >= 1 && no <= ADET)) return;
            secili = no;
            var metin = kod(no);
            cubukKod.textContent = metin;
            kodYazi.textContent = metin;

            var adres = karekod(metin, 320);
            if (adres) {
                qrKutu.innerHTML = '<img src="' + adres + '" alt="' + kacir(metin) +
                                   ' karekodu" width="320" height="320">';
            } else {
                qrKutu.innerHTML = '<span class="bnk__bekle">Karekod üretilemedi</span>';
            }

            if (hatirla !== false) kullanildiIsaretle(no);
            sonuYaz();
            isaretleriTazele();

            var hucre = izgara.querySelector('.bnk__hucre[data-no="' + no + '"]');
            if (hucre && govde.hidden === false) {
                hucre.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
            if (typeof secenekler.secildi === 'function') secenekler.secildi(no, metin);
        }

        // --- Açma / kapama ---
        function acKapa(ac) {
            var acilsin = ac === undefined ? govde.hidden : ac;
            govde.hidden = !acilsin;
            kok.dataset.durum = acilsin ? 'acik' : 'kapali';
            acDugme.setAttribute('aria-expanded', acilsin ? 'true' : 'false');
            if (acilsin && secili) goster(secili, false);
            if (acilsin && alan) setTimeout(function () { alan.focus(); }, 60);
        }

        acDugme.addEventListener('click', function () { acKapa(); });

        izgara.addEventListener('click', function (e) {
            var d = e.target.closest('.bnk__hucre');
            if (!d) return;
            goster(parseInt(d.dataset.no, 10), true);
        });

        sonKutu.addEventListener('click', function (e) {
            var d = e.target.closest('.bnk__sonOge');
            if (!d) return;
            goster(parseInt(d.dataset.no, 10), true);
        });

        /* Yazarken anında gösteriyor: "47" yazınca beklemeden karekod geliyor.
           Numara aralık dışındaysa hiçbir şey yapmıyor, hata çıkarmıyor. */
        alan.addEventListener('input', function () {
            var temiz = alan.value.replace(/\D/g, '').slice(0, 3);
            if (temiz !== alan.value) alan.value = temiz;
            var no = parseInt(temiz, 10);
            if (no >= 1 && no <= ADET) goster(no, false);
        });

        alan.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            var no = parseInt(alan.value.replace(/\D/g, ''), 10);
            if (no >= 1 && no <= ADET) goster(no, true);
        });

        sonuYaz();
        isaretleriTazele();
        if (secili) cubukKod.textContent = kod(secili);

        return {
            ac: function () { acKapa(true); },
            kapat: function () { acKapa(false); },
            goster: goster,
            kok: kok
        };
    }

    global.JBBanko = {
        ADET: ADET,
        kod: kod,
        acikMi: acikMi,
        ayarla: ayarla,
        kur: kur,
        karekod: karekod,
        sonKullanilanlar: sonKullanilanlar
    };
})(window);
