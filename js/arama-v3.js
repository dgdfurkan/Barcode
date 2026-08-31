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

    // ==================================================================
    // "Şunu mu demek istediniz?"
    // ==================================================================

    var oneriKutusu = null;
    var oneriHazirlaniyor = false;

    function oneriAlani() {
        if (oneriKutusu) return oneriKutusu;
        var bos = document.getElementById('noResultsState');
        if (!bos) return null;
        oneriKutusu = document.createElement('div');
        oneriKutusu.id = 'v3OneriAlani';
        bos.insertBefore(oneriKutusu, bos.firstChild);
        return oneriKutusu;
    }

    function sonucVarMi(metin) {
        if (!aramaVar()) return false;
        var k = katalog();
        if (!k) return false;
        var r = performOptimizedSearch(k, [metin], false);
        if (r && r.grouped) {
            return r.grouped.some(function (g) { return g.active.length + g.outOfStock.length > 0; });
        }
        return !!(r && (r.active.length + r.outOfStock.length) > 0);
    }

    function oneriTemizle() {
        var alan = oneriAlani();
        if (alan) alan.innerHTML = '';
    }

    function oneriGoster() {
        var alan = oneriAlani();
        if (!alan || !aramaKutusu || !window.JBOneri) return;

        var sorgu = aramaKutusu.value.trim();
        if (!sorgu || sorgu.length > 60) { oneriTemizle(); return; }

        var k = katalog();
        if (!k || !k.length) return;

        /* İndeks ısınmadıysa şimdi kur. Kullanıcı zaten boş sonuç ekranına
           bakıyor; 250 ms burada harcanabilir. Yazarken asla çalışmıyor. */
        if (!window.JBOneri.hazirMi()) {
            if (oneriHazirlaniyor) return;
            oneriHazirlaniyor = true;
            window.JBOneri.hazirla(k, function () {
                oneriHazirlaniyor = false;
                oneriGoster();
            }, true);
            return;
        }

        var o = window.JBOneri.oner(sorgu, sonucVarMi);
        if (!o) { oneriTemizle(); return; }

        alan.innerHTML =
            '<div class="v3-oneri">' +
                '<span class="v3-oneri__im" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
                    ' stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3' +
                    'M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>' +
                '</span>' +
                '<span>Şunu mu demek istediniz: ' +
                    '<button type="button" class="v3-oneri__dugme" data-metin="' +
                    o.metin.replace(/"/g, '&quot;') + '">' + o.metin + '</button>' +
                '</span>' +
            '</div>';

        var dugme = alan.querySelector('.v3-oneri__dugme');
        if (dugme) {
            dugme.addEventListener('click', function () {
                aramaKutusu.value = dugme.dataset.metin;
                aramaKutusu.dispatchEvent(new Event('input', { bubbles: true }));
                aramaKutusu.focus();
            });
        }
    }

    /* Boş sonuç ekranı görünür olduğunda öneri üretiliyor. Sayfanın arama
       koduna hiç dokunulmadan bitişi yakalamanın yolu bu. */
    var bosEkran = document.getElementById('noResultsState');
    if (bosEkran && typeof MutationObserver !== 'undefined') {
        new MutationObserver(function () {
            if (bosEkran.classList.contains('hidden')) oneriTemizle();
            else setTimeout(oneriGoster, 30);
        }).observe(bosEkran, { attributes: true, attributeFilter: ['class'] });
    }

    // ==================================================================
    // Banko
    // ==================================================================

    var bankoKap = null;
    var bankoArayuz = null;

    function bankoYerlestir() {
        if (!window.JBBanko) return;
        var acik = window.JBBanko.acikMi();

        if (!acik) {
            if (bankoKap) { bankoKap.remove(); bankoKap = null; bankoArayuz = null; }
            return;
        }
        if (bankoKap) return;

        var ana = document.querySelector('main');
        var sonuc = document.getElementById('resultsSection');
        if (!ana) return;

        bankoKap = document.createElement('div');
        bankoKap.className = 'v3-banko';
        if (sonuc) ana.insertBefore(bankoKap, sonuc);
        else ana.appendChild(bankoKap);

        bankoArayuz = window.JBBanko.kur(bankoKap);
    }

    /**
     * Ayar anahtarını "Görünüm" sekmesine ekliyor. Sayfanın kendi ayar
     * yapısı (settings-row / settings-switch) kullanılıyor; yeni bir görsel
     * dil getirilmiyor.
     */
    function bankoAyariEkle() {
        var pano = document.getElementById('settingsPaneTercihler');
        if (!pano || document.getElementById('bankoToggle')) return;

        var grup = document.createElement('div');
        grup.className = 'settings-group';
        grup.innerHTML =
            '<span class="settings-group__label">Depo</span>' +
            '<div class="settings-card">' +
                '<div class="settings-row">' +
                    '<span class="settings-row__icon" aria-hidden="true">' +
                        '<svg width="16" height="16" fill="none" stroke="currentColor"' +
                        ' stroke-width="2" viewBox="0 0 24 24">' +
                        '<rect x="3" y="3" width="7" height="7" rx="1.5"/>' +
                        '<rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
                        '<rect x="3" y="14" width="7" height="7" rx="1.5"/>' +
                        '<path d="M14 14h3v3h-3zM19 19h2v2h-2z"/></svg>' +
                    '</span>' +
                    '<div class="settings-row__body">' +
                        '<p class="settings-row__title">Banko karekodları</p>' +
                        '<p class="settings-row__desc">Sipariş ekranının altında banko ' +
                        'karekodu paneli açılır. Numarayı yaz, karekod okutulacak boyda ' +
                        'ekrana gelsin. Kapalıyken sayfa şu anki gibi kalır.</p>' +
                    '</div>' +
                    '<div class="settings-row__actions">' +
                        '<label class="settings-switch">' +
                            '<input type="checkbox" id="bankoToggle" aria-label="Banko karekodları">' +
                            '<span class="settings-switch__track"></span>' +
                        '</label>' +
                    '</div>' +
                '</div>' +
            '</div>';

        pano.insertBefore(grup, pano.firstChild);

        var kutucuk = grup.querySelector('#bankoToggle');
        kutucuk.checked = window.JBBanko.acikMi();
        kutucuk.addEventListener('change', function () {
            window.JBBanko.ayarla(kutucuk.checked);
            bankoYerlestir();
        });
    }

    bankoAyariEkle();
    bankoYerlestir();
})();
