/**
 * Jet Barkod. Hakkımızda sayfası davranışı.
 * ============================================================================
 *
 * Üç iş yapar: bölümleri görüş alanına girince açar, üst çubuğu sayfa
 * kaydırılınca ayırır, üstteki okuma çizgisini ilerletir.
 *
 * NEDEN IntersectionObserver
 * Scroll olayını dinleyip her karede konum hesaplamak sayfayı yorar.
 * Gözlemci işi tarayıcıya bırakır ve yalnız eşik geçildiğinde haber verir.
 *
 * GERİ DÖNÜNCE TEKRAR
 * Sınıf iki yönlü veriliyor: öğe görüş alanından çıkınca kaldırılıyor,
 * geri gelince ekleniyor. Sayfayı yukarı kaydıran kullanıcı animasyonu
 * yeniden görüyor.
 *
 * DESTEK YOKSA
 * Gözlemci ya da hareket tercihi engelliyorsa bütün öğeler doğrudan açık
 * hâle getiriliyor. İçerik hiçbir koşulda gizli kalmıyor; animasyon bir
 * süs, okumanın önkoşulu değil.
 * ============================================================================
 */
(function () {
    'use strict';

    // `<head>` içindeki betik bu bayrağı bekliyor: gelmezse gizlemeyi
    // geri alıyor ve sayfa animasyonsuz da olsa eksiksiz görünüyor.
    window.__hkHazir = true;

    var azHareket = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var girenler = document.querySelectorAll('.gir, .oynat, .merdiven');

    function hepsiniAc() {
        for (var i = 0; i < girenler.length; i++) {
            girenler[i].classList.add('gorunur');
        }
    }

    // ==================================================================
    // Görünürlük
    // ==================================================================

    if (!('IntersectionObserver' in window) || azHareket) {
        hepsiniAc();
    } else {
        var gozlemci = new IntersectionObserver(function (kayitlar) {
            for (var i = 0; i < kayitlar.length; i++) {
                kayitlar[i].target.classList.toggle('gorunur', kayitlar[i].isIntersecting);
            }
        }, {
            // Alttan biraz erken başlasın, üstten geç kapansın: öğe ekranın
            // ortasına gelmeden açılmış olur, çıkarken de aniden sönmez.
            rootMargin: '-8% 0px -12% 0px',
            threshold: 0.12
        });

        for (var i = 0; i < girenler.length; i++) gozlemci.observe(girenler[i]);
    }

    // ==================================================================
    // Üst çubuk ve okuma çizgisi
    // ==================================================================

    var ust = document.querySelector('.ust');
    var cizgi = document.querySelector('.ilerleme');
    var bekleyen = 0;

    function olc() {
        bekleyen = 0;

        var y = window.pageYOffset || document.documentElement.scrollTop || 0;

        if (ust) ust.classList.toggle('kaydi', y > 8);

        if (cizgi) {
            var toplam = document.documentElement.scrollHeight - window.innerHeight;
            var oran = toplam > 0 ? Math.min(1, Math.max(0, y / toplam)) : 0;
            // Genişlik değil ölçek: tarayıcı yeniden yerleşim hesaplamıyor.
            cizgi.style.transform = 'scaleX(' + oran + ')';
        }
    }

    function kaydir() {
        // Her scroll olayında değil, çizim karesi başına bir kez ölç.
        if (bekleyen) return;
        bekleyen = requestAnimationFrame(olc);
    }

    if (azHareket && cizgi) cizgi.remove();

    window.addEventListener('scroll', kaydir, { passive: true });
    window.addEventListener('resize', kaydir, { passive: true });
    olc();

    // ==================================================================
    // Yıl
    // ==================================================================

    var yil = document.getElementById('yil');
    if (yil) yil.textContent = new Date().getFullYear();
})();
