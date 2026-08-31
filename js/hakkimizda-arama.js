/**
 * Kahraman bölümündeki canlı arama.
 * ============================================================================
 *
 * Sahte ekran görüntüsü değil, sayfanın kendi içinde çalışan küçük bir arama.
 * Ürünler `hakkimizda-urunler.js` içinden geliyor ve hepsi katalogda gerçekten
 * kayıtlı. Barkodlar JsBarcode ile EAN-13 olarak çizdiriliyor; ekranda görünen
 * çizgiler okutulabilir gerçek kodlar.
 *
 * KAYMA YOK
 * Liste kutusunun yüksekliği sabit (CSS'te 306px) ve her satır aynı boyda.
 * Sonuç sayısı değişince kutu büyüyüp küçülmüyor, sayfa oynamıyor. Sayaç
 * da sabit genişlikte.
 *
 * BOŞ KALMAZ
 * Betik en başta bütün listeyi çiziyor. Animasyon hiç başlamasa bile
 * ziyaretçi dolu bir ekran görüyor.
 *
 * GÖRÜNMÜYORSA DURUR
 * Bölüm ekrandan çıkınca döngü duruyor. Arka planda boşuna kare harcanmıyor.
 * ============================================================================
 */
(function () {
    'use strict';

    var kutu = document.querySelector('.arama');
    var yaziEl = document.getElementById('aramaYazi');
    var sayacEl = document.getElementById('aramaSayac');
    var listeEl = document.getElementById('aramaListe');
    if (!kutu || !yaziEl || !listeEl || !window.JBUrunler) return;

    var URUNLER = window.JBUrunler.liste;
    var azHareket = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ==================================================================
    // Barkod çizimi
    // ==================================================================

    var barkodOnbellek = {};

    function barkodCiz(kod) {
        if (barkodOnbellek[kod]) return barkodOnbellek[kod];
        var html = '';
        if (typeof window.JsBarcode === 'function') {
            try {
                var kap = document.createElement('div');
                var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                kap.appendChild(svg);
                window.JsBarcode(svg, kod, {
                    format: 'EAN13',
                    lineColor: '#131720',
                    background: 'transparent',
                    width: 1.15,
                    height: 30,
                    displayValue: false,
                    margin: 0
                });
                html = kap.innerHTML;
            } catch (e) {
                html = '';
            }
        }
        barkodOnbellek[kod] = html;
        return html;
    }

    // ==================================================================
    // Satır çizimi
    // ==================================================================

    function kac(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function satir(u) {
        return '<div class="urun">' +
            '<img class="urun__gorsel" src="' + u.gorsel + '" alt="" width="54" height="54" loading="lazy">' +
            '<div>' +
                '<p class="urun__ad">' + kac(u.ad) + '</p>' +
                '<p class="urun__alt">' + kac(u.boy) + ' · Raf ' + kac(u.raf) + '</p>' +
            '</div>' +
            '<div class="urun__kod">' + barkodCiz(u.kod) +
                '<span class="urun__rakam">' + u.kod + '</span>' +
            '</div>' +
        '</div>';
    }

    function listele(urunler) {
        var h = '';
        for (var i = 0; i < urunler.length; i++) h += satir(urunler[i]);
        listeEl.innerHTML = h;
        if (sayacEl) sayacEl.textContent = urunler.length + ' sonuç';
    }

    // İlk çizim: animasyon çalışmasa bile ekran dolu.
    listele(URUNLER);

    if (azHareket) {
        yaziEl.textContent = 'sütaş, erikli, cips';
        return;
    }

    // ==================================================================
    // Senaryo
    // ==================================================================

    var SENARYO = [
        { yaz: 'sütaş',  bekle: 1900 },
        { yaz: 'cips',   bekle: 1900 },
        { yaz: 'peynir', bekle: 1900 },
        { yaz: '',       bekle: 3400, kaydir: true }
    ];

    var adim = 0;
    var zamanlayici = null;
    var kaydirmaKare = 0;
    var calisiyor = false;

    function temizle() {
        if (zamanlayici) { clearTimeout(zamanlayici); zamanlayici = null; }
        if (kaydirmaKare) { cancelAnimationFrame(kaydirmaKare); kaydirmaKare = 0; }
    }

    function bekle(ms, sonra) {
        zamanlayici = setTimeout(function () {
            zamanlayici = null;
            if (calisiyor) sonra();
        }, ms);
    }

    /** Aramayı boşaltırken tüm katalog kayarak geçiyor: "hepsi geldi" hissi. */
    function kaydirmayaBasla(sure, sonra) {
        var kap = listeEl.parentNode;
        var yol = listeEl.scrollHeight - kap.clientHeight;
        if (yol <= 0) { bekle(sure, sonra); return; }

        var basla = 0;
        function kare(t) {
            if (!calisiyor) return;
            if (!basla) basla = t;
            var oran = Math.min(1, (t - basla) / sure);
            // Yumuşak giriş çıkış: kaydırma ne sertçe başlıyor ne sertçe duruyor.
            var e = oran < 0.5 ? 2 * oran * oran : 1 - Math.pow(-2 * oran + 2, 2) / 2;
            kap.scrollTop = yol * e;
            if (oran < 1) {
                kaydirmaKare = requestAnimationFrame(kare);
            } else {
                kaydirmaKare = 0;
                bekle(600, function () { kap.scrollTop = 0; sonra(); });
            }
        }
        kaydirmaKare = requestAnimationFrame(kare);
    }

    function harfHarf(metin, sonra) {
        var i = 0;
        function bir() {
            if (!calisiyor) return;
            yaziEl.textContent = metin.slice(0, i);
            listeEl.parentNode.scrollTop = 0;
            listele(i ? window.JBUrunler.ara(metin.slice(0, i)) : URUNLER);
            if (i++ < metin.length) {
                bekle(78 + Math.random() * 55, bir);
            } else {
                sonra();
            }
        }
        bir();
    }

    function silHarfHarf(sonra) {
        var metin = yaziEl.textContent;
        function bir() {
            if (!calisiyor) return;
            metin = metin.slice(0, -1);
            yaziEl.textContent = metin;
            listele(metin ? window.JBUrunler.ara(metin) : URUNLER);
            if (metin) bekle(38, bir);
            else sonra();
        }
        bir();
    }

    function sonrakiAdim() {
        if (!calisiyor) return;
        var s = SENARYO[adim % SENARYO.length];
        adim++;

        if (!s.yaz) {
            silHarfHarf(function () {
                if (s.kaydir) kaydirmayaBasla(s.bekle, sonrakiAdim);
                else bekle(s.bekle, sonrakiAdim);
            });
            return;
        }

        silHarfHarf(function () {
            harfHarf(s.yaz, function () {
                bekle(s.bekle, sonrakiAdim);
            });
        });
    }

    function basla() {
        if (calisiyor) return;
        calisiyor = true;
        sonrakiAdim();
    }

    function dur() {
        calisiyor = false;
        temizle();
    }

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (kayitlar) {
            if (kayitlar[0].isIntersecting) basla(); else dur();
        }, { threshold: 0.25 }).observe(kutu);
    } else {
        basla();
    }
})();
