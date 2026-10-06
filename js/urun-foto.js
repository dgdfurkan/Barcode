/*
 * Ürün fotoğrafı penceresi
 *
 * Arama sonuçlarında fotoğrafa basınca açılır. Kurallar:
 *  - Her fotoğraf aynı çerçevede açılır (css/urun-foto.css).
 *  - Yakınlaştırma: tekerlek, çift tık, çift dokunma, iki parmak, + / - düğmeleri.
 *  - Yakınken sürükleyerek gezilir.
 *  - Kapatma: Esc, boşluğa basmak, sağ üstteki çarpı.
 *  - Açıkken arka sayfa kaymaz.
 *
 * Sayfalar eski adlarla çağırıyor: showImageModal(url, ad), closeImageModal().
 */
(function () {
    'use strict';

    var EN_AZ = 1;
    var EN_COK = 5;
    var CIFT_ORAN = 2.5;

    var acik = null;          // açık pencerenin durumu
    var kilit = null;         // kaydırma kilidi öncesi değerler

    function hareketAzMi() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function dokunmatikMi() {
        return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    }

    function ikon(yol) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + yol + '</svg>';
    }

    /* Arka sayfa kaymasın. Kaydırma çubuğu kaybolunca sayfa sağa kaymasın
       diye çubuğun genişliği kadar boşluk bırakılıyor. */
    function kaydirmayiKilitle() {
        if (kilit) return;
        var kok = document.documentElement;
        var govde = document.body;
        var cubuk = window.innerWidth - kok.clientWidth;
        kilit = {
            kokTasma: kok.style.overflow,
            govdeTasma: govde.style.overflow,
            govdeBosluk: govde.style.paddingRight
        };
        kok.style.overflow = 'hidden';
        govde.style.overflow = 'hidden';
        if (cubuk > 0) {
            var mevcut = parseFloat(getComputedStyle(govde).paddingRight) || 0;
            govde.style.paddingRight = (mevcut + cubuk) + 'px';
        }
    }

    function kilidiAc() {
        if (!kilit) return;
        document.documentElement.style.overflow = kilit.kokTasma;
        document.body.style.overflow = kilit.govdeTasma;
        document.body.style.paddingRight = kilit.govdeBosluk;
        kilit = null;
    }

    function kur() {
        var perde = document.createElement('div');
        perde.className = 'uf-perde';
        perde.setAttribute('role', 'dialog');
        perde.setAttribute('aria-modal', 'true');
        perde.setAttribute('aria-labelledby', 'ufBaslik');
        perde.innerHTML =
            '<div class="uf-kart">' +
                '<div class="uf-bas">' +
                    '<h3 class="uf-baslik" id="ufBaslik"></h3>' +
                    '<button type="button" class="uf-dugme uf-kapat" data-uf="kapat" aria-label="Kapat" title="Kapat (Esc)">' +
                        ikon('<path d="M6 6l12 12M18 6L6 18"/>') +
                    '</button>' +
                '</div>' +
                '<div class="uf-barkod" hidden>' +
                    '<div class="uf-barkod__serit" role="group" aria-roledescription="kaydırılabilir liste" aria-label="Barkodlar"></div>' +
                    '<div class="uf-barkod__alt">' +
                        '<span class="uf-barkod__noktalar" aria-hidden="true"></span>' +
                        '<span class="uf-barkod__sayac" aria-live="polite"></span>' +
                        '<button type="button" class="uf-barkod__kopya" data-uf="kopya">' +
                            ikon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>') +
                            '<span>Kopyala</span>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="uf-sahne">' +
                    '<img class="uf-resim" alt="" decoding="async" draggable="false">' +
                    '<div class="uf-durum" data-uf="yukleniyor"><span class="uf-cark" aria-hidden="true"></span></div>' +
                    '<div class="uf-durum" data-uf="hata" hidden>' +
                        ikon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><path d="M4 4l16 16"/>') +
                        '<span>Görsel yüklenemedi</span>' +
                    '</div>' +
                '</div>' +
                '<div class="uf-arac">' +
                    '<button type="button" class="uf-dugme" data-uf="uzak" aria-label="Uzaklaştır">' + ikon('<path d="M5 12h14"/>') + '</button>' +
                    '<span class="uf-oran" aria-live="polite">%100</span>' +
                    '<button type="button" class="uf-dugme" data-uf="yakin" aria-label="Yakınlaştır">' + ikon('<path d="M12 5v14M5 12h14"/>') + '</button>' +
                    '<button type="button" class="uf-dugme uf-sigdir" data-uf="sigdir">Sığdır</button>' +
                    '<p class="uf-ipucu"></p>' +
                '</div>' +
            '</div>';

        var d = {
            perde: perde,
            baslik: perde.querySelector('.uf-baslik'),
            sahne: perde.querySelector('.uf-sahne'),
            resim: perde.querySelector('.uf-resim'),
            yukleniyor: perde.querySelector('[data-uf="yukleniyor"]'),
            hata: perde.querySelector('[data-uf="hata"]'),
            oran: perde.querySelector('.uf-oran'),
            uzak: perde.querySelector('[data-uf="uzak"]'),
            yakin: perde.querySelector('[data-uf="yakin"]'),
            sigdir: perde.querySelector('[data-uf="sigdir"]'),
            kapat: perde.querySelector('[data-uf="kapat"]'),
            ipucu: perde.querySelector('.uf-ipucu'),
            arac: perde.querySelector('.uf-arac'),
            barkod: perde.querySelector('.uf-barkod'),
            serit: perde.querySelector('.uf-barkod__serit'),
            noktalar: perde.querySelector('.uf-barkod__noktalar'),
            sayac: perde.querySelector('.uf-barkod__sayac'),
            kopya: perde.querySelector('[data-uf="kopya"]'),
            barkodlar: [],
            barkodSira: 0,
            kapaninca: null,
            s: 1, x: 0, y: 0,
            isaretler: new Map(),
            sikistirma: null,
            surukleme: null,
            sonDokunma: null,
            perdedeBasildi: false,
            oncekiOdak: null,
            kapaniyor: false
        };

        d.ipucu.textContent = dokunmatikMi()
            ? 'İki parmakla ya da çift dokunarak yakınlaştır'
            : 'Tekerlek ya da çift tıkla yakınlaştır';

        baglan(d);
        return d;
    }

    /* ---- Yakınlaştırma matematiği ----
       Dönüşüm resmin kendi kutusuna göre: translate(x,y) scale(s), köken 0 0.
       Kutunun dışına boşluk kalmasın diye kaydırma sınırlanıyor. */
    function kutu(d) {
        return { w: d.resim.offsetWidth, h: d.resim.offsetHeight };
    }

    function sinirla(d) {
        var k = kutu(d);
        var enAzX = k.w - k.w * d.s;
        var enAzY = k.h - k.h * d.s;
        d.x = Math.min(0, Math.max(enAzX, d.x));
        d.y = Math.min(0, Math.max(enAzY, d.y));
    }

    function uygula(d, yumusak) {
        sinirla(d);
        d.sahne.classList.toggle('is-yumusak', !!yumusak && !hareketAzMi());
        d.resim.style.transform = 'translate3d(' + d.x + 'px,' + d.y + 'px,0) scale(' + d.s + ')';
        d.sahne.classList.toggle('is-yakin', d.s > 1.001);
        d.oran.textContent = '%' + Math.round(d.s * 100);
        d.uzak.disabled = d.s <= EN_AZ + 0.001;
        d.yakin.disabled = d.s >= EN_COK - 0.001;
        d.sigdir.disabled = d.s <= EN_AZ + 0.001;
    }

    /* Sahne içindeki (ekran) noktayı resim kutusu koordinatına çevir */
    function noktaya(d, istemciX, istemciY) {
        var r = d.resim.getBoundingClientRect();
        // getBoundingClientRect dönüşümü içerir; kutunun dönüşümsüz başlangıcı:
        var solUst = { x: r.left - d.x, y: r.top - d.y };
        return { x: istemciX - solUst.x, y: istemciY - solUst.y };
    }

    function oranla(d, yeni, px, py, yumusak) {
        yeni = Math.min(EN_COK, Math.max(EN_AZ, yeni));
        if (px == null) {
            var k = kutu(d);
            px = k.w / 2; py = k.h / 2;
        }
        var o = yeni / d.s;
        d.x = px - (px - d.x) * o;
        d.y = py - (py - d.y) * o;
        d.s = yeni;
        uygula(d, yumusak);
    }

    function sifirla(d, yumusak) {
        d.s = 1; d.x = 0; d.y = 0;
        uygula(d, yumusak);
    }

    function ciftVurus(d, istemciX, istemciY) {
        if (d.s > 1.001) {
            sifirla(d, true);
        } else {
            var p = noktaya(d, istemciX, istemciY);
            oranla(d, CIFT_ORAN, p.x, p.y, true);
        }
    }

    function baglan(d) {
        var sahne = d.sahne;

        d.kapat.addEventListener('click', function () { kapat(); });
        d.uzak.addEventListener('click', function () { oranla(d, d.s / 1.5, null, null, true); });
        d.yakin.addEventListener('click', function () { oranla(d, d.s * 1.5, null, null, true); });
        d.sigdir.addEventListener('click', function () { sifirla(d, true); });

        /* Boşluğa basınca kapan. Basış kartın içinde başlayıp dışarıda
           bittiyse (sürüklerken taşma) kapanmasın. */
        d.perde.addEventListener('pointerdown', function (e) {
            d.perdedeBasildi = e.target === d.perde;
        });
        d.perde.addEventListener('click', function (e) {
            if (e.target === d.perde && d.perdedeBasildi) kapat();
            d.perdedeBasildi = false;
        });

        /* Arka sayfa dokunmayla da kaymasın (iOS) */
        d.perde.addEventListener('touchmove', function (e) {
            // Barkod şeridi yatay kayıyor; orada tarayıcının kaydırması lazım
            if (d.serit.contains(e.target)) return;
            if (e.cancelable) e.preventDefault();
        }, { passive: false });
        d.perde.addEventListener('wheel', function (e) {
            if (!sahne.contains(e.target) && e.cancelable) e.preventDefault();
        }, { passive: false });

        sahne.addEventListener('wheel', function (e) {
            if (!d.resim.classList.contains('is-yuklendi')) return;
            e.preventDefault();
            var p = noktaya(d, e.clientX, e.clientY);
            var carpan = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
            oranla(d, d.s * carpan, p.x, p.y, false);
        }, { passive: false });

        sahne.addEventListener('dblclick', function (e) {
            if (d.sonIsaretTuru === 'touch') return; // dokunmada kendi çift dokunmamız var
            if (!d.resim.classList.contains('is-yuklendi')) return;
            ciftVurus(d, e.clientX, e.clientY);
        });

        sahne.addEventListener('pointerdown', function (e) {
            d.sonIsaretTuru = e.pointerType;
            if (!d.resim.classList.contains('is-yuklendi')) return;
            try { sahne.setPointerCapture(e.pointerId); } catch (err) {}
            d.isaretler.set(e.pointerId, { x: e.clientX, y: e.clientY, ilkX: e.clientX, ilkY: e.clientY });

            if (d.isaretler.size === 2) {
                var n = Array.from(d.isaretler.values());
                d.surukleme = null;
                d.sikistirma = {
                    mesafe: Math.hypot(n[0].x - n[1].x, n[0].y - n[1].y) || 1,
                    s: d.s,
                    orta: noktaya(d, (n[0].x + n[1].x) / 2, (n[0].y + n[1].y) / 2),
                    x: d.x, y: d.y
                };
            } else if (d.isaretler.size === 1) {
                d.surukleme = { x: e.clientX, y: e.clientY, dx: d.x, dy: d.y, oynadi: false };
            }
        });

        sahne.addEventListener('pointermove', function (e) {
            var isaret = d.isaretler.get(e.pointerId);
            if (!isaret) return;
            isaret.x = e.clientX; isaret.y = e.clientY;

            if (d.sikistirma && d.isaretler.size >= 2) {
                var n = Array.from(d.isaretler.values());
                var mesafe = Math.hypot(n[0].x - n[1].x, n[0].y - n[1].y) || 1;
                var yeni = Math.min(EN_COK, Math.max(EN_AZ, d.sikistirma.s * mesafe / d.sikistirma.mesafe));
                var ortaEkran = { x: (n[0].x + n[1].x) / 2, y: (n[0].y + n[1].y) / 2 };
                var r = d.resim.getBoundingClientRect();
                var kokX = r.left - d.x, kokY = r.top - d.y;
                // İlk orta nokta parmakların yeni ortasının altında kalsın
                var o = yeni / d.sikistirma.s;
                d.s = yeni;
                d.x = (ortaEkran.x - kokX) - (d.sikistirma.orta.x - d.sikistirma.x) * o;
                d.y = (ortaEkran.y - kokY) - (d.sikistirma.orta.y - d.sikistirma.y) * o;
                uygula(d, false);
                return;
            }

            var s = d.surukleme;
            if (!s) return;
            var dx = e.clientX - s.x, dy = e.clientY - s.y;
            if (!s.oynadi && Math.abs(dx) + Math.abs(dy) > 4) s.oynadi = true;
            if (d.s > 1.001 && s.oynadi) {
                sahne.classList.add('is-surukle');
                d.x = s.dx + dx;
                d.y = s.dy + dy;
                uygula(d, false);
            }
        });

        function birak(e) {
            var isaret = d.isaretler.get(e.pointerId);
            if (!isaret) return;
            d.isaretler.delete(e.pointerId);
            sahne.classList.remove('is-surukle');

            if (d.isaretler.size < 2) d.sikistirma = null;

            if (d.isaretler.size === 1) {
                // Bir parmak kaldı: sürüklemeye kaldığı yerden devam
                var kalan = Array.from(d.isaretler.values())[0];
                d.surukleme = { x: kalan.x, y: kalan.y, dx: d.x, dy: d.y, oynadi: true };
                return;
            }

            var oynadi = d.surukleme && d.surukleme.oynadi;
            d.surukleme = null;

            // Dokunmada çift dokunma
            if (e.type === 'pointerup' && e.pointerType === 'touch' && !oynadi) {
                var simdi = Date.now();
                var son = d.sonDokunma;
                if (son && simdi - son.t < 300 && Math.hypot(son.x - e.clientX, son.y - e.clientY) < 24) {
                    d.sonDokunma = null;
                    ciftVurus(d, e.clientX, e.clientY);
                } else {
                    d.sonDokunma = { t: simdi, x: e.clientX, y: e.clientY };
                }
            }
        }
        sahne.addEventListener('pointerup', birak);
        sahne.addEventListener('pointercancel', birak);

        barkodBagla(d);

        d.resim.addEventListener('load', function () {
            d.yukleniyor.hidden = true;
            d.hata.hidden = true;
            d.resim.classList.add('is-yuklendi');
            uygula(d, false);
        });
        d.resim.addEventListener('error', function () {
            d.yukleniyor.hidden = true;
            d.hata.hidden = false;
            d.resim.classList.remove('is-yuklendi');
            [d.uzak, d.yakin, d.sigdir].forEach(function (b) { b.disabled = true; });
        });
    }

    function tus(e) {
        if (!acik) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            // Alttaki pencereler de Esc dinliyor; yalnız bu kapansın
            e.stopPropagation();
            kapat();
            return;
        }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); oranla(acik, acik.s * 1.5, null, null, true); return; }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); oranla(acik, acik.s / 1.5, null, null, true); return; }
        if (e.key === '0') { e.preventDefault(); sifirla(acik, true); return; }
        if (e.key === 'Tab') {
            // Odak pencerenin dışına çıkmasın
            var odaklar = Array.prototype.filter.call(
                acik.perde.querySelectorAll('button'),
                function (b) { return !b.disabled; }
            );
            if (!odaklar.length) return;
            var ilk = odaklar[0], son = odaklar[odaklar.length - 1];
            if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
            else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
            else if (!acik.perde.contains(document.activeElement)) { e.preventDefault(); ilk.focus(); }
        }
    }

    // ---- Barkod şeridi ----
    // Adın hemen altında. Kaydırınca serbest kaymıyor, bir sonrakine
    // oturuyor (karakter seçer gibi). Koda dokununca sıradaki geliyor.

    function barkodBicim(kod) {
        var k = String(kod || '');
        if (/^\d{13}$/.test(k)) return k.slice(0, 1) + ' ' + k.slice(1, 7) + ' ' + k.slice(7);
        if (/^\d{8}$/.test(k)) return k.slice(0, 4) + ' ' + k.slice(4);
        return k;
    }

    function barkodSayaci(d) {
        var n = d.barkodlar.length;
        d.sayac.textContent = n > 1 ? (d.barkodSira + 1) + ' / ' + n : 'Barkod';
        var noktalar = d.noktalar.children;
        for (var i = 0; i < noktalar.length; i++) {
            noktalar[i].classList.toggle('is-secili', i === d.barkodSira);
        }
    }

    function barkodaGit(d, i, yumusak) {
        var n = d.barkodlar.length;
        if (!n) return;
        i = ((i % n) + n) % n;
        d.barkodSira = i;
        var w = d.serit.clientWidth;
        try {
            d.serit.scrollTo({ left: i * w, behavior: yumusak && !hareketAzMi() ? 'smooth' : 'auto' });
        } catch (e) { d.serit.scrollLeft = i * w; }
        barkodSayaci(d);
    }

    function barkodBagla(d) {
        var kare = 0;
        d.serit.addEventListener('scroll', function () {
            if (kare) return;
            kare = requestAnimationFrame(function () {
                kare = 0;
                var w = d.serit.clientWidth || 1;
                var i = Math.round(d.serit.scrollLeft / w);
                if (i !== d.barkodSira && i >= 0 && i < d.barkodlar.length) {
                    d.barkodSira = i;
                    barkodSayaci(d);
                }
            });
        }, { passive: true });
        d.serit.addEventListener('click', function (e) {
            if (!e.target.closest('.uf-barkod__kod')) return;
            if (d.barkodlar.length > 1) barkodaGit(d, d.barkodSira + 1, true);
        });
        d.serit.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight') { e.preventDefault(); barkodaGit(d, d.barkodSira + 1, true); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); barkodaGit(d, d.barkodSira - 1, true); }
        });
        d.kopya.addEventListener('click', function () {
            var kod = d.barkodlar[d.barkodSira];
            if (!kod) return;
            var yaz = function () {
                var s = d.kopya.querySelector('span');
                s.textContent = 'Kopyalandı';
                d.kopya.classList.add('is-tamam');
                clearTimeout(d._kopyaSaat);
                d._kopyaSaat = setTimeout(function () {
                    s.textContent = 'Kopyala';
                    d.kopya.classList.remove('is-tamam');
                }, 1400);
            };
            try {
                navigator.clipboard.writeText(kod).then(yaz, function () {});
            } catch (e) { /* pano izni yok: kod zaten ekranda */ }
        });
    }

    function barkodlariYaz(d, liste) {
        var temiz = (Array.isArray(liste) ? liste : [])
            .map(function (b) { return String(b == null ? '' : b).trim(); })
            .filter(Boolean);
        d.barkodlar = temiz;
        d.barkodSira = 0;
        d.barkod.hidden = !temiz.length;
        d.perde.classList.toggle('uf-perde--barkodlu', temiz.length > 0);
        if (!temiz.length) { d.serit.textContent = ''; d.noktalar.textContent = ''; return; }
        var h = '';
        for (var i = 0; i < temiz.length; i++) {
            h += '<button type="button" class="uf-barkod__kod" aria-label="Barkod ' + (i + 1) + ': ' + temiz[i] +
                (temiz.length > 1 ? '. Sıradakine geçmek için dokun' : '') + '">' +
                '<span>' + barkodBicim(temiz[i]).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span></button>';
        }
        d.serit.innerHTML = h;
        d.serit.classList.toggle('is-tek', temiz.length === 1);
        var n = '';
        if (temiz.length > 1) for (var j = 0; j < temiz.length; j++) n += '<i></i>';
        d.noktalar.innerHTML = n;
        d.serit.scrollLeft = 0;
        barkodSayaci(d);
    }

    /**
     * @param {string} url
     * @param {string} ad
     * @param {{barkodlar?: string[], arac?: boolean, kapaninca?: function}} [secenek]
     *   barkodlar  Adın altında kaydırılabilir şerit.
     *   arac       false: alttaki yakınlaştırma çubuğu gizli (kişi fotoğrafı).
     *   kapaninca  Pencere kapanınca bir kez çağrılır.
     */
    function ac(url, ad, secenek) {
        secenek = secenek || {};
        if (acik && acik.kapaniyor) {
            // Kapanırken yeniden açıldı: kapanışı iptal et, aynı pencereyi kullan
            acik.kapaniyor = false;
            // Önceki açılışın kapanış haberi kaybolmasın (çağıranın geçmiş kaydı)
            var oncekiGeri = acik.kapaninca;
            acik.kapaninca = null;
            if (oncekiGeri) { try { oncekiGeri(); } catch (err) { /* sessiz */ } }
            document.addEventListener('keydown', tus, true);
            acik.perde.classList.add('is-acik');
        }
        var d = acik || kur();
        var yeni = !acik;
        acik = d;

        d.baslik.textContent = ad ? String(ad) : 'Ürün görseli';
        barkodlariYaz(d, secenek.barkodlar);
        d.arac.hidden = secenek.arac === false;
        d.perde.classList.toggle('uf-perde--aracsiz', secenek.arac === false);
        d.kapaninca = typeof secenek.kapaninca === 'function' ? secenek.kapaninca : null;
        d.resim.alt = ad ? String(ad) : '';
        d.resim.classList.remove('is-yuklendi');
        d.yukleniyor.hidden = false;
        d.hata.hidden = true;
        d.s = 1; d.x = 0; d.y = 0;
        d.isaretler.clear();
        d.sikistirma = null;
        d.surukleme = null;
        uygula(d, false);

        if (url) {
            d.resim.src = String(url);
            if (d.resim.complete && d.resim.naturalWidth > 0) {
                d.yukleniyor.hidden = true;
                d.resim.classList.add('is-yuklendi');
            }
        } else {
            d.resim.removeAttribute('src');
            d.yukleniyor.hidden = true;
            d.hata.hidden = false;
        }

        if (yeni) {
            d.oncekiOdak = document.activeElement;
            kaydirmayiKilitle();
            document.body.appendChild(d.perde);
            document.addEventListener('keydown', tus, true);
            // Açılış: bir kare bekleyip sınıfı ekle ki geçiş çalışsın
            requestAnimationFrame(function () {
                d.perde.classList.add('is-acik');
            });
            try { d.kapat.focus({ preventScroll: true }); } catch (err) { d.kapat.focus(); }
        }
    }

    function kaldir(d) {
        if (d.perde.parentNode) d.perde.parentNode.removeChild(d.perde);
        if (acik === d) acik = null;
    }

    function kapat() {
        var d = acik;
        if (!d || d.kapaniyor) return;
        d.kapaniyor = true;
        document.removeEventListener('keydown', tus, true);
        d.perde.classList.remove('is-acik');

        var bitir = function () {
            if (!d.kapaniyor) return;
            d.kapaniyor = false;
            kaldir(d);
            kilidiAc();
            var odak = d.oncekiOdak;
            d.oncekiOdak = null;
            if (odak && typeof odak.focus === 'function' && document.contains(odak)) {
                try { odak.focus({ preventScroll: true }); } catch (err) {}
            }
            var geri = d.kapaninca;
            d.kapaninca = null;
            if (geri) { try { geri(); } catch (err) { /* çağıranın hatası pencereyi kilitlemesin */ } }
        };

        if (hareketAzMi()) { bitir(); return; }
        var sure = parseFloat(getComputedStyle(d.perde).transitionDuration) || 0;
        if (!sure) { bitir(); return; }
        d.perde.addEventListener('transitionend', function son(e) {
            if (e.target !== d.perde) return;
            d.perde.removeEventListener('transitionend', son);
            bitir();
        });
        // transitionend kaçarsa yine de kapansın
        setTimeout(bitir, sure * 1000 + 80);
    }

    window.JBUrunFoto = {
        ac: ac,
        kapat: kapat,
        acikMi: function () { return !!acik && !acik.kapaniyor; }
    };
})();
