/**
 * Jet Barkod. Ürün arama v3 davranış katmanı.
 * ============================================================================
 *
 * Sayfanın kendi mantığına dokunmuyor: hiçbir dinleyici kaldırılmıyor, hiçbir
 * kimlik değişmiyor. Bu dosya yalnızca sınıf ekliyor, birkaç öğe yaratıyor ve
 * iki yeni yeteneği bağlıyor: yazım önerisi ve banko karekodları.
 *
 * NEDEN DIŞARIDAN ULAŞABİLİYOR
 * Sayfanın `products` ve `performOptimizedSearch` gibi tanımları klasik betik
 * içinde en üst seviyede. Klasik betikler aynı global sözcüksel ortamı
 * paylaştığı için buradan adıyla erişilebiliyorlar. `window.products` diye
 * aranırsa bulunamaz; öyle denendi, yoktu.
 *
 * GÖZLEMCİ TUZAĞI
 * v2'de hap gözlemcisi kabın kendisini dinliyor ve geri bildiriminde yine o
 * kaba sınıf ekliyordu; sayfa kilitlendi. Burada gözlemci yalnızca düğmeleri
 * dinliyor ve değer değişmediyse hiçbir şey yazılmıyor. İki ayrı kilit.
 *
 * KAYMA YOK
 * Buradaki hiçbir satır yükseklik, genişlik ya da kenar boşluğu değiştirmiyor.
 * Ölçüm yapılan tek yer Liste/Grid hapı; konumlandırılan öğe akış dışında.
 * ============================================================================
 */
(function () {
    'use strict';

    var govde = document.body;
    if (!govde || !govde.classList.contains('v3')) return;

    var azHareket = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function katalog() {
        return (typeof products !== 'undefined' && Array.isArray(products)) ? products : null;
    }

    function aramaVar() {
        return typeof performOptimizedSearch === 'function';
    }

    // ==================================================================
    // Kaydırma
    // ==================================================================

    var kare = 0;
    var sonDurum = null;

    function kaydirmaOlc() {
        kare = 0;
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;
        var kaydi = y > 6;
        if (kaydi === sonDurum) return;
        sonDurum = kaydi;
        govde.classList.toggle('kaydi', kaydi);
    }

    window.addEventListener('scroll', function () {
        if (kare) return;
        kare = requestAnimationFrame(kaydirmaOlc);
    }, { passive: true });
    kaydirmaOlc();

    // ==================================================================
    // Tarama imi: ray ortasındaki "Scan" yazısının yerine
    // ==================================================================

    (function taramaImi() {
        var kap = document.getElementById('scanEffectContainer');
        if (!kap || azHareket) return;
        var im = document.createElement('div');
        im.className = 'v3-tara';
        im.setAttribute('aria-hidden', 'true');
        /* Çizgi boyları sabit bir desen; her yüklemede değişseydi göz
           her seferinde yeniden okumak zorunda kalırdı. */
        var boylar = [10, 16, 8, 14, 18, 9, 15, 11, 17, 8, 13, 16, 10, 14];
        var ic = '';
        for (var i = 0; i < boylar.length; i++) {
            ic += '<i style="--boy:' + boylar[i] + 'px"></i>';
        }
        im.innerHTML = ic + '<span class="v3-tara__isik"></span>';
        kap.appendChild(im);
    })();

    // ==================================================================
    // İlerleme çizgisi ve odak
    // ==================================================================

    var serit = null;
    if (!azHareket) {
        serit = document.createElement('div');
        serit.className = 'v3-serit';
        serit.setAttribute('aria-hidden', 'true');
        govde.appendChild(serit);
    }

    var seritZaman = null;

    function seritBasla() {
        govde.classList.add('araniyor');
        if (!serit || serit.classList.contains('calisiyor')) return;
        serit.classList.remove('bitti');
        serit.classList.add('calisiyor');
        if (seritZaman) clearTimeout(seritZaman);
        seritZaman = setTimeout(seritBitir, 2500);
    }

    function seritBitir() {
        govde.classList.remove('araniyor');
        if (!serit) return;
        if (seritZaman) { clearTimeout(seritZaman); seritZaman = null; }
        if (!serit.classList.contains('calisiyor')) return;
        serit.classList.remove('calisiyor');
        serit.classList.add('bitti');
        setTimeout(function () { serit.classList.remove('bitti'); }, 320);
    }

    var aramaKutusu = document.getElementById('searchInput');

    if (aramaKutusu) {
        aramaKutusu.addEventListener('focus', function () { govde.classList.add('arama-odakta'); });
        aramaKutusu.addEventListener('blur', function () { govde.classList.remove('arama-odakta'); });
        aramaKutusu.addEventListener('input', function () {
            if (aramaKutusu.value.trim()) seritBasla(); else seritBitir();
        });
    }

    if (typeof MutationObserver !== 'undefined') {
        ['resultsTableBody', 'mobileResults', 'gridResults'].forEach(function (kimlik) {
            var el = document.getElementById(kimlik);
            if (el) new MutationObserver(seritBitir).observe(el, { childList: true });
        });
    }

    // ==================================================================
    // Liste / Grid hapı
    // ==================================================================

    var hapKap = document.querySelector('.view-toggle-container');
    var sonEn = -1, sonX = -1;

    function hapYerlestir() {
        if (!hapKap) return;
        var aktif = hapKap.querySelector('.view-toggle-btn.active');
        if (!aktif || !aktif.offsetWidth) {
            if (hapKap.classList.contains('hap-hazir')) {
                hapKap.classList.remove('hap-hazir');
                sonEn = sonX = -1;
            }
            return;
        }
        var en = aktif.offsetWidth;
        var x = aktif.offsetLeft - hapKap.clientLeft - 3;
        var hazir = hapKap.classList.contains('hap-hazir');
        if (en === sonEn && x === sonX && hazir) return;   // Döngü kilidi
        sonEn = en; sonX = x;
        hapKap.style.setProperty('--hap-en', en + 'px');
        hapKap.style.setProperty('--hap-x', x + 'px');
        if (!hazir) hapKap.classList.add('hap-hazir');
    }

    if (hapKap) {
        if (typeof MutationObserver !== 'undefined') {
            var hapGoz = new MutationObserver(function () { requestAnimationFrame(hapYerlestir); });
            // Yalnızca düğmeler dinleniyor; kabın kendisi değil.
            hapKap.querySelectorAll('.view-toggle-btn').forEach(function (d) {
                hapGoz.observe(d, { attributes: true, attributeFilter: ['class'] });
            });
        }
        if (typeof ResizeObserver !== 'undefined') {
            var boyGoz = new ResizeObserver(function () { sonEn = sonX = -1; hapYerlestir(); });
            boyGoz.observe(hapKap);
            hapKap.querySelectorAll('.view-toggle-btn').forEach(function (d) { boyGoz.observe(d); });
        } else {
            window.addEventListener('resize', function () {
                sonEn = sonX = -1; requestAnimationFrame(hapYerlestir);
            }, { passive: true });
        }
        requestAnimationFrame(hapYerlestir);
    }

    // ==================================================================
    // Kopyalandı onayı
    // ==================================================================

    document.addEventListener('click', function (e) {
        var el = e.target;
        if (!el || typeof el.closest !== 'function') return;
        var hedef = el.closest('[onclick*="copy"], [data-rol="kopyala"], .barkod-kopyala');
        if (!hedef) return;
        hedef.classList.remove('v3-kopyalandi');
        void hedef.offsetWidth;
        hedef.classList.add('v3-kopyalandi');
        setTimeout(function () { hedef.classList.remove('v3-kopyalandi'); }, 560);
    }, true);

    /* Yazım önerisi ve banko karekodları artık `js/arama-eklentileri.js`
       içinde; üç sürüm de aynı dosyayı kullanıyor. Burada kopyası
       tutulmuyor ki biri düzeltilip diğeri unutulmasın. */
})();
