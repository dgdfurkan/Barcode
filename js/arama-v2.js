/**
 * Jet Barkod. Ürün arama v2 hareket katmanı.
 * ============================================================================
 *
 * Sayfanın kendi mantığına dokunmuyor. Hiçbir dinleyiciyi kaldırmıyor, hiçbir
 * kimliği değiştirmiyor; yalnızca sınıf ekliyor ve iki küçük öğe yaratıyor
 * (ilerleme çizgisi, odak ışığı). Bu yüzden birinci sürümdeki bütün düğmeler
 * v2'de de aynı şekilde çalışıyor.
 *
 * KAYMA YOK
 * Buradaki hiçbir satır yükseklik, genişlik ya da kenar boşluğu değiştirmiyor.
 * Ölçüm yapılan tek yer Liste/Grid hapı; o da `transform` ile taşınıyor ve
 * konumlandırılan öğe akış dışında (`position: absolute`).
 *
 * GÖZLEMCİ TUZAĞI (yaşandı, bir daha yaşanmasın)
 * İlk sürümde hap gözlemcisi kabın KENDİSİNİ dinliyordu ve geri bildiriminde
 * yine o kaba sınıf ekliyordu. `classList.add` var olan bir sınıfı yeniden
 * eklerken bile öznitelik yazıldığı için gözlemci tekrar tetikleniyor,
 * sayfa kilitleniyordu. İki önlem alındı:
 *   1. Gözlemci yalnızca DÜĞMELERİ dinliyor, kabı değil.
 *   2. Değer gerçekten değişmediyse hiçbir şey yazılmıyor.
 * İkisinden biri bile yetiyor; ikisi birden var çünkü bu hata sessizce
 * geri gelirse sayfayı tamamen kilitliyor.
 *
 * KARE BÜTÇESİ
 * Kaydırma dinleyicisi her olayda değil, çizim karesi başına bir kez ölçüyor.
 *
 * HAREKET TERCİHİ
 * `prefers-reduced-motion` açıksa ilerleme çizgisi ve odak ışığı hiç
 * kurulmuyor; CSS geçişleri de kapalı.
 * ============================================================================
 */
(function () {
    'use strict';

    var govde = document.body;
    if (!govde || !govde.classList.contains('v2')) return;

    var azHareket = window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ==================================================================
    // Kaydırma: üst şerit yükseklik değil ölçek değiştiriyor
    // ==================================================================

    var kaydirmaKare = 0;
    var sonKaydi = null;

    function kaydirmaOlc() {
        kaydirmaKare = 0;
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;
        var kaydi = y > 6;
        if (kaydi === sonKaydi) return;   // Aynı durumu tekrar yazma
        sonKaydi = kaydi;
        govde.classList.toggle('kaydi', kaydi);
    }

    window.addEventListener('scroll', function () {
        if (kaydirmaKare) return;
        kaydirmaKare = requestAnimationFrame(kaydirmaOlc);
    }, { passive: true });

    kaydirmaOlc();

    // ==================================================================
    // Odak ışığı ve ilerleme çizgisi
    // ==================================================================

    var serit = null;

    if (!azHareket) {
        var isik = document.createElement('div');
        isik.className = 'v2-isik';
        isik.setAttribute('aria-hidden', 'true');
        govde.appendChild(isik);

        serit = document.createElement('div');
        serit.className = 'v2-serit';
        serit.setAttribute('aria-hidden', 'true');
        govde.appendChild(serit);
    }

    var seritZaman = null;

    function seritBasla() {
        if (!serit || serit.classList.contains('calisiyor')) return;
        serit.classList.remove('bitti');
        serit.classList.add('calisiyor');
        if (seritZaman) clearTimeout(seritZaman);
        // Sonuç hiç gelmezse çizgi sonsuza kadar asılı kalmasın.
        seritZaman = setTimeout(seritBitir, 2500);
    }

    function seritBitir() {
        if (!serit) return;
        if (seritZaman) { clearTimeout(seritZaman); seritZaman = null; }
        if (!serit.classList.contains('calisiyor')) return;
        serit.classList.remove('calisiyor');
        serit.classList.add('bitti');
        setTimeout(function () { serit.classList.remove('bitti'); }, 300);
    }

    var aramaKutusu = document.getElementById('searchInput');

    if (aramaKutusu) {
        aramaKutusu.addEventListener('focus', function () {
            govde.classList.add('arama-odakta');
        });
        aramaKutusu.addEventListener('blur', function () {
            govde.classList.remove('arama-odakta');
        });
        aramaKutusu.addEventListener('input', function () {
            if (aramaKutusu.value.trim()) seritBasla(); else seritBitir();
        });
    }

    /* Sonuçlar DOM'a girdiği anda çizgi tamamlanıyor. Sayfanın kendi arama
       koduna dokunmadan bitişi yakalamanın yolu bu. */
    if (typeof MutationObserver !== 'undefined') {
        ['resultsTableBody', 'mobileResults', 'gridResults'].forEach(function (kimlik) {
            var el = document.getElementById(kimlik);
            if (el) new MutationObserver(seritBitir).observe(el, { childList: true });
        });
    }

    // ==================================================================
    // Liste / Grid hapı
    // ==================================================================
    //
    // Aktif düğmenin altındaki beyaz hap `transform` ile kayıyor. Düğmelerin
    // arka planını değiştirmek yerine tek bir katmanı taşımak hem daha akıcı
    // hem de düğme genişliklerini hiç oynatmıyor.

    var hapKap = document.querySelector('.view-toggle-container');
    var sonEn = -1;
    var sonX = -1;

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

        // Değişen bir şey yoksa yazma. Gözlemci döngüsünün ikinci kilidi.
        if (en === sonEn && x === sonX && hazir) return;

        sonEn = en;
        sonX = x;
        hapKap.style.setProperty('--hap-en', en + 'px');
        hapKap.style.setProperty('--hap-x', x + 'px');
        if (!hazir) hapKap.classList.add('hap-hazir');
    }

    if (hapKap) {
        /* Yalnızca düğmeler dinleniyor. Kabın kendisi dinlenseydi buradan
           kaba eklenen `hap-hazir` sınıfı gözlemciyi yeniden tetikler ve
           sayfa kilitlenirdi; bir kez oldu. */
        if (typeof MutationObserver !== 'undefined') {
            var hapGozlemci = new MutationObserver(function () {
                requestAnimationFrame(hapYerlestir);
            });
            hapKap.querySelectorAll('.view-toggle-btn').forEach(function (dugme) {
                hapGozlemci.observe(dugme, { attributes: true, attributeFilter: ['class'] });
            });
        }

        /* Boyut değişimini pencereden değil doğrudan öğelerden dinliyoruz.
           Kırılma noktasında düğme içindeki yazı gizlenince pencere boyu
           değişmiyor ama düğme genişliği değişiyordu; hap yanlış yerde
           kalıyordu. Ayrıca arka plandaki sekmede `requestAnimationFrame`
           geciktiği için ölçüm bayatlayabiliyordu. */
        if (typeof ResizeObserver !== 'undefined') {
            var boyutGozlemci = new ResizeObserver(function () {
                sonEn = sonX = -1;
                hapYerlestir();
            });
            boyutGozlemci.observe(hapKap);
            hapKap.querySelectorAll('.view-toggle-btn').forEach(function (dugme) {
                boyutGozlemci.observe(dugme);
            });
        } else {
            window.addEventListener('resize', function () {
                sonEn = sonX = -1;
                requestAnimationFrame(hapYerlestir);
            }, { passive: true });
        }

        requestAnimationFrame(hapYerlestir);

        // Yazı tipi geç yüklenirse düğme genişliği değişebiliyor.
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                sonEn = sonX = -1;
                hapYerlestir();
            }).catch(function () {});
        }
    }

    // ==================================================================
    // Kopyalandı geri bildirimi
    // ==================================================================
    //
    // Kopyalama işini ve bildirimini sayfa zaten yapıyor. Buradaki tek iş,
    // dokunulan öğenin kısa bir onay hareketi yapması: kullanıcı hangi
    // satıra bastığını görüyor.

    document.addEventListener('click', function (e) {
        var el = e.target;
        if (!el || typeof el.closest !== 'function') return;
        var hedef = el.closest('[onclick*="copy"], [data-rol="kopyala"], .barkod-kopyala');
        if (!hedef) return;
        hedef.classList.remove('v2-kopyalandi');
        void hedef.offsetWidth;
        hedef.classList.add('v2-kopyalandi');
        setTimeout(function () { hedef.classList.remove('v2-kopyalandi'); }, 560);
    }, true);
})();
