/**
 * Jet Barkod. Karşılaştırma motoru.
 * ============================================================================
 *
 * İki şeridi aynı saatte oynatır: solda eski yöntem, sağda Jet Barkod.
 *
 * TEK SAAT, İKİ ŞERİT
 * İki ayrı zamanlayıcı yok. Tek bir başlangıç damgası var; her çizim
 * karesinde iki şerit de aynı damgadan hesaplanıyor. İki `setInterval`
 * kullanılsaydı aralarında milisaniyeler birikir ve "aynı anda başlıyor"
 * iddiası bozulurdu.
 *
 * ADIM SÜRELERİ
 * Her adımın kendi süresi var. Sayfa yüklenmesi gibi gerçekte değişken
 * olan adımlarda `sureAralik: [2000, 3000]` verilir; motor her oynatmada
 * o aralıktan rastgele bir süre seçer. Böylece aynı sahne her seferinde
 * birebir aynı sonucu vermez, gerçeğe yakın durur.
 *
 * BİTİŞ
 * Şerit kendi adımlarını bitirince kronometresi durur ve bayrağı çıkar.
 * Diğeri saymaya devam eder. İkisi de bitince aradaki fark yazılır.
 *
 * HAREKET TERCİHİ
 * `prefers-reduced-motion` açıksa hiç oynatılmaz: iki taraf da son
 * ekranıyla, tüm adımları geçmiş hâlde ve bitiş süreleriyle gösterilir.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var IMLEC_SVG =
        '<svg viewBox="0 0 22 22" fill="none" aria-hidden="true">' +
        '<path d="M4 2.5 L4 17.5 L8 13.6 L10.8 19.4 L13.6 18.1 L10.9 12.5 L16.2 12.5 Z"' +
        ' fill="#fff" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round"/></svg>';

    function bayrakSvg(beyazMi) {
        var bez = beyazMi ? '#ffffff' : '#059669';
        var kenar = beyazMi ? '#cbd5e1' : '#047857';
        return '<svg viewBox="0 0 62 62" fill="none" aria-hidden="true">' +
            '<path d="M14 54 L14 8" stroke="#475569" stroke-width="3" stroke-linecap="round"/>' +
            '<circle cx="14" cy="7" r="2.6" fill="#475569"/>' +
            '<path class="bez" d="M15.5 10 H48 L41 19 L48 28 H15.5 Z" fill="' + bez +
            '" stroke="' + kenar + '" stroke-width="1.6" stroke-linejoin="round"/>' +
            '</svg>';
    }

    function sayiIki(n) { return (n < 10 ? '0' : '') + n; }

    /** ms değerini sa:sn.ss biçiminde yazar. */
    function saatYaz(ms) {
        var toplamSaniye = Math.floor(ms / 1000);
        var dakika = Math.floor(toplamSaniye / 60);
        var saniye = toplamSaniye % 60;
        var salise = Math.floor((ms % 1000) / 10);
        return sayiIki(dakika) + ':' + sayiIki(saniye) + '.' + sayiIki(salise);
    }

    function kacir(m) {
        return String(m == null ? '' : m)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function rastgele(aralik) {
        return aralik[0] + Math.random() * (aralik[1] - aralik[0]);
    }

    // ==================================================================
    // Şerit
    // ==================================================================

    function Serit(kap, tanim, yeniMi) {
        this.tanim = tanim;
        this.yeniMi = yeniMi;
        this.kap = kap;

        this.sahne = kap.querySelector('.krs__sahne');
        this.saatEl = kap.querySelector('.krs__saat');
        this.imlec = kap.querySelector('.krs__imlec');
        this.goz = kap.querySelector('.krs__goz');
        this.tik = kap.querySelector('.krs__tik');
        this.yuk = kap.querySelector('.krs__yukleniyor');
        this.bayrak = kap.querySelector('.krs__bayrak');
        this.ekranlar = {};
        this.adimEl = kap.querySelectorAll('.krs__adim');

        var ekranDugumleri = kap.querySelectorAll('.krs__ekran');
        for (var i = 0; i < ekranDugumleri.length; i++) {
            this.ekranlar[ekranDugumleri[i].dataset.ekran] = ekranDugumleri[i];
        }

        this.sifirla();
    }

    /** Süreleri her oynatmada yeniden kur: rastgele aralıklar tazelensin. */
    Serit.prototype.sureleriKur = function () {
        var t = 0;
        this.zaman = this.tanim.adimlar.map(function (a) {
            var sure = a.sureAralik ? rastgele(a.sureAralik) : (a.sure || 700);
            var kayit = { bas: t, son: t + sure };
            t += sure;
            return kayit;
        });
        this.toplam = t;
    };

    Serit.prototype.sifirla = function () {
        this.sureleriKur();
        this.sonAdim = -1;
        this.bittiMi = false;

        this.saatEl.textContent = saatYaz(0);
        this.saatEl.classList.remove('bitti');
        this.bayrak.classList.remove('acik');
        this.yuk.classList.remove('acik');
        this.imlec.classList.remove('acik');
        this.goz.classList.remove('acik');

        for (var i = 0; i < this.adimEl.length; i++) {
            this.adimEl[i].classList.remove('gecti', 'simdi');
        }
        for (var ad in this.ekranlar) {
            this.ekranlar[ad].classList.remove('acik');
        }

        var ilk = this.tanim.adimlar[0];
        if (ilk && ilk.ekran && this.ekranlar[ilk.ekran]) {
            this.ekranlar[ilk.ekran].classList.add('acik');
        }
    };

    /** Sahne yüzdesini piksel konumuna çevirir. */
    Serit.prototype.konum = function (nokta) {
        var k = this.sahne.getBoundingClientRect();
        return { x: (nokta[0] / 100) * k.width, y: (nokta[1] / 100) * k.height };
    };

    Serit.prototype.adimaGec = function (sira) {
        var adim = this.tanim.adimlar[sira];
        if (!adim) return;

        if (adim.ekran && this.ekranlar[adim.ekran]) {
            for (var ad in this.ekranlar) {
                this.ekranlar[ad].classList.toggle('acik', ad === adim.ekran);
            }
        }

        this.yuk.classList.toggle('acik', !!adim.yukleniyor);

        if (adim.imlec) {
            var p = this.konum(adim.imlec);
            this.imlec.classList.add('acik');
            this.imlec.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)';
            if (adim.tik) this.tiklat(p);
        } else if (adim.imlec === null) {
            // Açıkça null verilen adımda imleç sahneden çekiliyor: iş bitti,
            // artık bakılacak yer ekranın kendisi.
            this.imlec.classList.remove('acik');
        }

        if (adim.goz) {
            var g = this.konum(adim.goz);
            this.goz.classList.add('acik');
            this.goz.style.transform = 'translate3d(' + g.x + 'px,' + g.y + 'px,0)';
        } else if (adim.goz === null) {
            this.goz.classList.remove('acik');
        }

        for (var i = 0; i < this.adimEl.length; i++) {
            this.adimEl[i].classList.toggle('gecti', i < sira);
            this.adimEl[i].classList.toggle('simdi', i === sira);
        }
    };

    Serit.prototype.tiklat = function (p) {
        var t = this.tik;
        t.classList.remove('calis');
        t.style.setProperty('--x', p.x + 'px');
        t.style.setProperty('--y', p.y + 'px');
        // Sınıfı yeniden vermeden önce tarayıcının yerleşimi okuması gerekiyor,
        // yoksa animasyon baştan başlamıyor.
        void t.offsetWidth;
        t.classList.add('calis');
    };

    Serit.prototype.bitir = function () {
        if (this.bittiMi) return;
        this.bittiMi = true;
        this.saatEl.classList.add('bitti');
        this.saatEl.textContent = saatYaz(this.toplam);
        this.bayrak.classList.add('acik');
        this.imlec.classList.remove('acik');
        this.goz.classList.remove('acik');
        this.yuk.classList.remove('acik');
        for (var i = 0; i < this.adimEl.length; i++) {
            this.adimEl[i].classList.add('gecti');
            this.adimEl[i].classList.remove('simdi');
        }
    };

    /** Ortak saatten gelen geçen süreye göre şeridi ilerletir. */
    Serit.prototype.ilerle = function (gecen) {
        if (this.bittiMi) return true;

        if (gecen >= this.toplam) {
            this.bitir();
            return true;
        }

        this.saatEl.textContent = saatYaz(gecen);

        var sira = this.sonAdim;
        while (sira + 1 < this.zaman.length && gecen >= this.zaman[sira + 1].bas) sira++;

        if (sira !== this.sonAdim && sira >= 0) {
            this.sonAdim = sira;
            this.adimaGec(sira);
        }
        return false;
    };

    /** Oynatmadan son hâli göster. Hareket tercihi kapalıysa kullanılır. */
    Serit.prototype.sonHal = function () {
        var son = this.tanim.adimlar.length - 1;
        this.adimaGec(son);
        this.yuk.classList.remove('acik');
        this.imlec.classList.remove('acik');
        this.goz.classList.remove('acik');
        this.bitir();
    };

    // ==================================================================
    // Sahne kurulumu
    // ==================================================================

    function seritHtml(tanim, yeniMi) {
        var adimlar = tanim.adimlar.map(function (a) {
            return '<li class="krs__adim">' +
                '<span class="krs__adim-nokta"></span>' +
                '<span class="krs__adim-yazi">' + kacir(a.ad) + '</span></li>';
        }).join('');

        var ekranlar = Object.keys(tanim.ekranlar).map(function (ad) {
            return '<div class="krs__ekran" data-ekran="' + kacir(ad) + '">' +
                tanim.ekranlar[ad] + '</div>';
        }).join('');

        return '<div class="krs__serit krs__serit--' + (yeniMi ? 'yeni' : 'eski') + '">' +
            '<div class="krs__baslik">' +
            '  <span class="krs__etiket">' + (yeniMi ? 'Jet Barkod ile' : 'Eski yöntem') + '</span>' +
            '  <span class="krs__serit-ad">' + kacir(tanim.ad) + '</span>' +
            '  <span class="krs__saat">00:00.00</span>' +
            '</div>' +
            '<div class="krs__sahne">' +
            ekranlar +
            '  <div class="krs__yukleniyor"><span class="krs__cark"></span><span>Yükleniyor</span></div>' +
            '  <div class="krs__goz"></div>' +
            '  <div class="krs__tik"></div>' +
            '  <div class="krs__imlec">' + IMLEC_SVG + '</div>' +
            '  <div class="krs__bayrak">' + bayrakSvg(!yeniMi) + '</div>' +
            '</div>' +
            '<ul class="krs__adimlar">' + adimlar + '</ul>' +
            '</div>';
    }

    function kur(kap, tanim) {
        if (!kap || !tanim) return null;

        kap.classList.add('krs');
        kap.innerHTML =
            '<div class="krs__ust">' +
            '  <h3 class="krs__ad">' + kacir(tanim.baslik) + '</h3>' +
            '  <span class="krs__bosluk"></span>' +
            '  <button type="button" class="krs__dugme" data-rol="oynat">' +
            '    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
            '      <path d="M8 5v14l11-7z"/></svg>' +
            '    <span data-rol="dugmeYazi">Oynat</span>' +
            '  </button>' +
            '</div>' +
            '<div class="krs__alan">' +
            seritHtml(tanim.sol, false) +
            seritHtml(tanim.sag, true) +
            '</div>' +
            '<div class="krs__sonuc">' +
            '  <span data-rol="sonucYazi">' + kacir(tanim.ozet || '') + '</span>' +
            '  <span class="krs__bosluk"></span>' +
            '  <span class="krs__fark" data-rol="fark"></span>' +
            '</div>';

        var seritler = kap.querySelectorAll('.krs__serit');
        var sol = new Serit(seritler[0], tanim.sol, false);
        var sag = new Serit(seritler[1], tanim.sag, true);

        var dugme = kap.querySelector('[data-rol="oynat"]');
        var dugmeYazi = kap.querySelector('[data-rol="dugmeYazi"]');
        var farkEl = kap.querySelector('[data-rol="fark"]');

        var azHareket = global.matchMedia &&
                        global.matchMedia('(prefers-reduced-motion: reduce)').matches;

        var calisiyor = false;
        var baslangic = 0;
        var kare = 0;

        /*
         * Rozetin iskeleti BAŞTAN yazılıyor, yalnız rakamlar değişiyor.
         * Önce boş bırakılıyordu; içi dolunca kutu sıfırdan büyüyor ve
         * sonuç şeridi bir satır uzuyordu. Boş kutu yer kaplamaz, opaklık
         * sıfır olan dolu kutu kaplar.
         */
        farkEl.innerHTML = '<span data-rol="farkSure">00:00.00 daha hızlı</span>' +
                           '<small data-rol="farkKat">0,0 kat</small>';
        var farkSure = farkEl.querySelector('[data-rol="farkSure"]');
        var farkKat = farkEl.querySelector('[data-rol="farkKat"]');

        function farkYaz() {
            var fark = Math.max(0, sol.toplam - sag.toplam);
            var kat = sag.toplam > 0 ? (sol.toplam / sag.toplam) : 0;
            farkSure.textContent = saatYaz(fark) + ' daha hızlı';
            farkKat.textContent = kat.toFixed(1).replace('.', ',') + ' kat';
            farkEl.classList.add('acik');
        }

        function dur() {
            calisiyor = false;
            if (kare) { cancelAnimationFrame(kare); kare = 0; }
            dugmeYazi.textContent = 'Tekrar oynat';
        }

        function adim() {
            if (!calisiyor) return;
            var gecen = performance.now() - baslangic;

            // İkisi de AYNI `gecen` değerinden hesaplanıyor: kayma olmuyor.
            var solBitti = sol.ilerle(gecen);
            var sagBitti = sag.ilerle(gecen);

            if (solBitti && sagBitti) {
                farkYaz();
                dur();
                return;
            }
            kare = requestAnimationFrame(adim);
        }

        function oynat() {
            if (kare) { cancelAnimationFrame(kare); kare = 0; }
            farkEl.classList.remove('acik');
            sol.sifirla();
            sag.sifirla();

            if (azHareket) {
                sol.sonHal();
                sag.sonHal();
                farkYaz();
                dugmeYazi.textContent = 'Tekrar oynat';
                return;
            }

            dugmeYazi.textContent = 'Oynuyor';
            calisiyor = true;
            // Tek damga: iki şerit de bundan hesaplanıyor.
            baslangic = performance.now();
            kare = requestAnimationFrame(adim);
        }

        dugme.addEventListener('click', oynat);

        /*
         * Sahne ekrandan çıkınca oynatmayı durdur. Görünmeyen sahnenin
         * kare hesaplaması boşa giden iştir; birden çok sahne olduğunda
         * hepsi aynı anda dönerse sayfa yorulur.
         */
        var gozlemci = null;
        if ('IntersectionObserver' in global) {
            gozlemci = new IntersectionObserver(function (kayitlar) {
                if (!kayitlar[0].isIntersecting && calisiyor) {
                    dur();
                    sol.sifirla();
                    sag.sifirla();
                    dugmeYazi.textContent = 'Oynat';
                }
            }, { threshold: 0.15 });
            gozlemci.observe(kap);
        }

        return { oynat: oynat, dur: dur };
    }

    global.JBKarsilastirma = { kur: kur, saatYaz: saatYaz };
})(window);
