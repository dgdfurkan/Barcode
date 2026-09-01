/**
 * Jet Barkod. Pencereler ve bildirimler.
 * ============================================================================
 *
 * Tarayıcının kendi `alert` ve `confirm` pencereleri sitenin dışında duruyor:
 * işletim sisteminin yazı tipi, adres çubuğuna yapışan gri bir kutu, bizim
 * hiçbir rengimiz yok. Kullanıcı bir anda başka bir uygulamaya geçmiş gibi
 * oluyor. Bu dosya onların yerine geçiyor.
 *
 * NEDEN `window.confirm` DOĞRUDAN DEĞİŞTİRİLMEDİ
 * `confirm` eşzamanlı: çağrıldığı yerde durup cevabı döndürüyor. Tarayıcıda
 * bunu taklit etmenin yolu yok. O yüzden çağrı yerleri tek tek söz (Promise)
 * kullanacak şekilde değiştirildi.
 *
 * ERİŞİLEBİLİRLİK
 * Açılınca odak pencereye giriyor, Sekme tuşu pencerenin içinde dönüyor,
 * Esc kapatıyor, kapanınca odak geldiği yere dönüyor. Klavyeyle çalışan biri
 * pencerede kaybolmuyor.
 *
 * KAYMA YOK
 * Pencere akışın dışında (`position: fixed`). Açılıp kapanırken sayfadaki
 * hiçbir şey yer değiştirmiyor. Arkadaki sayfanın kaydırması kilitleniyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var acikPencere = null;
    var oncekiOdak = null;

    function kacir(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* Mesajlar bazen "\n" ile satırlara ayrılmış geliyor (eski alert
       çağrılarından kalma). Satır sonları korunuyor. */
    function metin(s) {
        return kacir(s).replace(/\r?\n/g, '<br>');
    }

    var IKON = {
        bilgi: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
        basari: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
        uyari: '<path d="M10.3 4.3 2.5 18a1.5 1.5 0 0 0 1.3 2.2h16.4A1.5 1.5 0 0 0 21.5 18L13.7 4.3a1.5 1.5 0 0 0-2.6 0z"/><path d="M12 9.5v4M12 17h.01"/>',
        hata: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
        soru: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4M12 16.6h.01"/>'
    };

    function pencereKur(secenekler) {
        var perde = document.createElement('div');
        perde.className = 'jbd';
        perde.setAttribute('role', 'presentation');

        var tur = secenekler.tur || 'bilgi';
        var onayMi = secenekler.onay === true;

        perde.innerHTML =
            '<div class="jbd__kart" role="' + (onayMi ? 'alertdialog' : 'dialog') + '"' +
            ' aria-modal="true" aria-labelledby="jbdBaslik">' +
                '<span class="jbd__im jbd__im--' + tur + '" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"' +
                    ' stroke-linecap="round" stroke-linejoin="round">' + (IKON[tur] || IKON.bilgi) + '</svg>' +
                '</span>' +
                '<h2 class="jbd__baslik" id="jbdBaslik">' + kacir(secenekler.baslik || '') + '</h2>' +
                '<p class="jbd__metin">' + metin(secenekler.mesaj) + '</p>' +
                '<div class="jbd__eylem">' +
                    (onayMi
                        ? '<button type="button" class="jbd__dugme jbd__dugme--sade" data-rol="vazgec">' +
                          kacir(secenekler.vazgecYazi || 'Vazgeç') + '</button>'
                        : '') +
                    '<button type="button" class="jbd__dugme jbd__dugme--ana' +
                    (secenekler.tehlikeli ? ' jbd__dugme--tehlike' : '') + '" data-rol="tamam">' +
                    kacir(secenekler.onayYazi || (onayMi ? 'Evet, devam et' : 'Tamam')) + '</button>' +
                '</div>' +
            '</div>';

        return perde;
    }

    function ac(secenekler) {
        return new Promise(function (cozumle) {
            // Aynı anda iki pencere olmasın: ikincisi birincinin üstüne binmesin
            if (acikPencere) kapat(false);

            oncekiOdak = document.activeElement;

            var perde = pencereKur(secenekler);
            document.body.appendChild(perde);
            document.body.classList.add('jbd-acik');
            acikPencere = { perde: perde, cozumle: cozumle };

            var kart = perde.querySelector('.jbd__kart');
            var tamam = perde.querySelector('[data-rol="tamam"]');
            var vazgec = perde.querySelector('[data-rol="vazgec"]');

            tamam.addEventListener('click', function () { kapat(true); });
            if (vazgec) vazgec.addEventListener('click', function () { kapat(false); });

            /* Zeminden kapatmak yalnızca bilgi penceresinde var. Onay
               penceresinde yanlışlıkla dokunmak "hayır" demek olmamalı;
               kullanıcı kararını düğmeyle veriyor. */
            if (!secenekler.onay) {
                perde.addEventListener('click', function (e) {
                    if (e.target === perde) kapat(false);
                });
            }

            perde.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { e.stopPropagation(); kapat(false); return; }
                if (e.key !== 'Tab') return;
                // Odak pencerenin içinde dönsün
                var odaklanabilir = kart.querySelectorAll('button');
                if (!odaklanabilir.length) return;
                var ilk = odaklanabilir[0];
                var son = odaklanabilir[odaklanabilir.length - 1];
                if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
                else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
            });

            /* Odak hemen veriliyor, çizim karesini beklemeden. Arka plandaki
               sekmede `requestAnimationFrame` gecikebiliyor; odak orada
               verilirse klavyeyle gelen kullanıcı pencereye giremiyordu.
               Tehlikeli işlemlerde odak "Vazgeç" düğmesinde başlıyor:
               boşluk tuşuna refleksle basan silme yapmasın. */
            try { (vazgec && secenekler.tehlikeli ? vazgec : tamam).focus(); }
            catch (e) { /* öğe henüz odaklanamıyorsa sorun değil */ }

            requestAnimationFrame(function () { perde.classList.add('acik'); });
        });
    }

    function kapat(sonuc) {
        if (!acikPencere) return;
        var kayit = acikPencere;
        acikPencere = null;

        kayit.perde.classList.remove('acik');
        kayit.perde.classList.add('kapaniyor');

        var bitir = function () {
            if (kayit.perde.parentNode) kayit.perde.parentNode.removeChild(kayit.perde);
            if (!acikPencere) document.body.classList.remove('jbd-acik');
            if (oncekiOdak && typeof oncekiOdak.focus === 'function') {
                try { oncekiOdak.focus(); } catch (e) { /* öğe gitmiş olabilir */ }
            }
            oncekiOdak = null;
            kayit.cozumle(sonuc);
        };

        // Geçiş bitince temizle; hareket kapalıysa bekleme olmasın
        var azHareket = global.matchMedia &&
                        global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (azHareket) bitir(); else setTimeout(bitir, 180);
    }

    // ==================================================================
    // Şerit bildirimleri
    // ==================================================================
    //
    // Kısa, onay istemeyen haberler için. Pencere açmak gereksiz; ekranın
    // altından girip kendiliğinden çıkıyor. Üst üste gelenler diziliyor.

    var seritKap = null;

    function seritAlani() {
        if (seritKap && seritKap.isConnected) return seritKap;
        seritKap = document.createElement('div');
        seritKap.className = 'jbd-serit';
        seritKap.setAttribute('role', 'status');
        seritKap.setAttribute('aria-live', 'polite');
        document.body.appendChild(seritKap);
        return seritKap;
    }

    function bildir(mesaj, tur, sure) {
        var kap = seritAlani();
        var oge = document.createElement('div');
        oge.className = 'jbd-serit__oge jbd-serit__oge--' + (tur || 'bilgi');
        oge.innerHTML =
            '<span class="jbd-serit__im" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round" stroke-linejoin="round">' +
            (IKON[tur] || IKON.bilgi) + '</svg></span>' +
            '<span class="jbd-serit__yazi">' + metin(mesaj) + '</span>';
        kap.appendChild(oge);

        requestAnimationFrame(function () { oge.classList.add('acik'); });

        var kalksin = function () {
            oge.classList.remove('acik');
            setTimeout(function () {
                if (oge.parentNode) oge.parentNode.removeChild(oge);
            }, 220);
        };
        setTimeout(kalksin, sure || 3200);
        oge.addEventListener('click', kalksin);
        return oge;
    }

    global.JBDiyalog = {
        /** `alert` yerine. Söz döndürüyor ama beklemek zorunlu değil. */
        uyari: function (mesaj, secenekler) {
            secenekler = secenekler || {};
            return ac({
                mesaj: mesaj,
                baslik: secenekler.baslik || '',
                tur: secenekler.tur || 'bilgi',
                onayYazi: secenekler.onayYazi
            });
        },
        hata: function (mesaj, secenekler) {
            secenekler = secenekler || {};
            return ac({ mesaj: mesaj, baslik: secenekler.baslik || 'Bir sorun çıktı', tur: 'hata' });
        },
        /** `confirm` yerine. Söz `true` ya da `false` döndürüyor. */
        onay: function (mesaj, secenekler) {
            secenekler = secenekler || {};
            return ac({
                mesaj: mesaj,
                baslik: secenekler.baslik || 'Emin misin?',
                tur: secenekler.tur || (secenekler.tehlikeli ? 'uyari' : 'soru'),
                onay: true,
                tehlikeli: secenekler.tehlikeli === true,
                onayYazi: secenekler.onayYazi,
                vazgecYazi: secenekler.vazgecYazi
            });
        },
        bildir: bildir,
        kapat: function () { kapat(false); }
    };
})(window);
