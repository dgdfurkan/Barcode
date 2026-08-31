/**
 * Arama sayfasının iki eklentisi: yazım önerisi ve banko karekodları.
 * ============================================================================
 *
 * Tek dosya, üç sürüm. `/arama`, `/arama-v2` ve `/arama-v3` aynı davranışı
 * paylaşıyor; önceden yalnızca v3'te vardı ve kullanıcı haklı olarak
 * "asıl sayfada yok" dedi.
 *
 * SAYFANIN KENDİ KODUNA DOKUNULMUYOR
 * Hiçbir dinleyici kaldırılmıyor, hiçbir kimlik değiştirilmiyor. Sayfanın
 * `products` ve `performOptimizedSearch` tanımlarına adıyla erişiliyor;
 * klasik betikler aynı global sözcüksel ortamı paylaşıyor. `window.products`
 * diye aranırsa bulunmaz, öyle değil.
 *
 * ÖNERİ NE ZAMAN ÇALIŞIR
 * Yalnızca sonuç sıfır dönünce. Yazarken hiç çalışmıyor, tuş gecikmesine
 * katkısı yok.
 *
 * BANKO KAPALIYKEN
 * Ayarlardaki anahtar kapalıysa panel DOM'a hiç eklenmiyor, karekod
 * üretilmiyor, dinleyici bağlanmıyor.
 * ============================================================================
 */
(function () {
    'use strict';

    function katalog() {
        return (typeof products !== 'undefined' && Array.isArray(products) && products.length)
            ? products : null;
    }

    function aramaVar() { return typeof performOptimizedSearch === 'function'; }

    var aramaKutusu = document.getElementById('searchInput');
    var bosEkran = document.getElementById('noResultsState');

    // ==================================================================
    // Şunu mu demek istediniz
    // ==================================================================

    var oneriAlan = null;
    var kuruluyor = false;

    function alan() {
        if (oneriAlan && oneriAlan.isConnected) return oneriAlan;
        if (!bosEkran) return null;
        oneriAlan = document.createElement('div');
        oneriAlan.id = 'jbOneriAlani';
        bosEkran.insertBefore(oneriAlan, bosEkran.firstChild);
        return oneriAlan;
    }

    function sonucVarMi(metin) {
        var k = katalog();
        if (!k || !aramaVar()) return false;
        var r = performOptimizedSearch(k, [metin], false);
        if (r && r.grouped) {
            return r.grouped.some(function (g) { return g.active.length + g.outOfStock.length > 0; });
        }
        return !!(r && (r.active.length + r.outOfStock.length) > 0);
    }

    function temizle() {
        var a = alan();
        if (a) a.innerHTML = '';
    }

    function kacir(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function goster() {
        var a = alan();
        if (!a || !aramaKutusu || !window.JBOneri) return;

        var sorgu = (aramaKutusu.value || '').trim();
        // Uzun yapıştırmalar ve virgüllü toplu sorgular için öneri üretilmiyor
        if (!sorgu || sorgu.length > 60 || sorgu.indexOf(',') !== -1) { temizle(); return; }

        var k = katalog();
        if (!k) return;

        /* İndeks ısınmadıysa şimdi kuruluyor. Kullanıcı zaten boş sonuç
           ekranına bakıyor; buradaki bir saniye yazma hızını etkilemiyor. */
        if (!window.JBOneri.hazirMi()) {
            if (kuruluyor) return;
            kuruluyor = true;
            window.JBOneri.hazirla(k, function () { kuruluyor = false; goster(); }, true);
            return;
        }

        var o = window.JBOneri.oner(sorgu, sonucVarMi);
        if (!o) { temizle(); return; }

        a.innerHTML =
            '<div class="jb-oneri">' +
                '<span class="jb-oneri__im" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
                    ' stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M9.1 9a3 3 0 1 1 4 2.8c-.8.3-1.1 1-1.1 1.7v.5"/>' +
                    '<circle cx="12" cy="17.5" r="0.6" fill="currentColor"/></svg>' +
                '</span>' +
                '<span>Şunu mu demek istediniz: ' +
                    '<button type="button" class="jb-oneri__dugme" data-ara="' +
                    kacir(o.gosterim || o.metin) + '">' +
                    kacir(o.gosterim || o.metin) + '</button>' +
                '</span>' +
            '</div>';

        var dugme = a.querySelector('.jb-oneri__dugme');
        if (dugme) {
            dugme.addEventListener('click', function () {
                /* Kutuya Türkçe yazımı giriyor. Arama zaten sadeleştirerek
                   çalıştığı için sonuç aynı; kullanıcı "sutas yarim yagli"
                   gibi bir metin görmüyor. */
                aramaKutusu.value = dugme.dataset.ara;
                aramaKutusu.dispatchEvent(new Event('input', { bubbles: true }));
                aramaKutusu.focus();
            });
        }
    }

    if (bosEkran && typeof MutationObserver !== 'undefined') {
        new MutationObserver(function () {
            if (bosEkran.classList.contains('hidden')) temizle();
            else setTimeout(goster, 30);
        }).observe(bosEkran, { attributes: true, attributeFilter: ['class'] });
    }

    /* Katalog yüklendikten sonra indeksi boşta zamanda ısıt: ilk öneri de
       beklemesiz gelsin. */
    (function isit() {
        var k = katalog();
        if (!k) { setTimeout(isit, 1200); return; }
        if (window.JBOneri && !window.JBOneri.hazirMi() && !kuruluyor) {
            kuruluyor = true;
            window.JBOneri.hazirla(k, function () { kuruluyor = false; });
        }
    })();

    // ==================================================================
    // Banko karekodları
    // ==================================================================

    var bankoKap = null;

    function bankoYerlestir() {
        if (!window.JBBanko) return;

        if (!window.JBBanko.acikMi()) {
            if (bankoKap) { bankoKap.remove(); bankoKap = null; }
            return;
        }
        if (bankoKap && bankoKap.isConnected) return;

        var ana = document.querySelector('main');
        if (!ana) return;
        var sonuc = document.getElementById('resultsSection');

        bankoKap = document.createElement('div');
        bankoKap.className = 'jb-banko-kap';
        bankoKap.style.marginBottom = '1.1rem';
        if (sonuc) ana.insertBefore(bankoKap, sonuc);
        else ana.appendChild(bankoKap);

        window.JBBanko.kur(bankoKap);
    }

    /**
     * Ayar anahtarı "Görünüm" sekmesine ekleniyor. Sayfanın kendi ayar
     * yapısı kullanılıyor, yeni bir görsel dil getirilmiyor.
     *
     * Sekme sayfa açılırken gizli olabiliyor; ayarlar penceresi ilk kez
     * açıldığında da denenmesi için düğmeye dinleyici bağlanıyor.
     */
    function ayarEkle() {
        var pano = document.getElementById('settingsPaneTercihler');
        if (!pano || document.getElementById('bankoToggle') || !window.JBBanko) return;

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
                        '<p class="settings-row__title">Banko Karekodları</p>' +
                        '<p class="settings-row__desc">Sipariş sonuçlarının üstünde banko ' +
                        'paneli açılır. Önünde durduğun bankonun numarasını yaz, karekod ' +
                        'okutulacak boyda ekrana gelsin. Kapalıyken sayfa şu anki gibi kalır.</p>' +
                    '</div>' +
                    '<div class="settings-row__actions">' +
                        '<label class="settings-switch">' +
                            '<input type="checkbox" id="bankoToggle" aria-label="Banko Karekodları">' +
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

    ayarEkle();
    bankoYerlestir();

    /* "Görünüm" sekmesi yalnızca parlama önleme açıkken görünüyor. Ayar
       satırımız o sekmede duruyor; sekme gizliyse kullanıcı bulamaz. Ayarlar
       her açıldığında satırın yerinde olduğu doğrulanıyor ve sekme gerekiyorsa
       görünür kılınıyor. */
    var ayarDugmesi = document.getElementById('settingsBtn');
    if (ayarDugmesi) {
        ayarDugmesi.addEventListener('click', function () {
            setTimeout(function () {
                ayarEkle();
                var bolum = document.getElementById('antiGlareSettingsSection');
                var sekme = document.getElementById('settingsTabTercihler');
                /* Parlama önleme kapalıysa bölüm gizleniyor ve sekme de
                   onunla birlikte kayboluyordu. Banko satırı orada olduğu
                   için sekme her hâlükârda açık kalmalı. */
                if (sekme) sekme.classList.remove('settings-tab--display-only');
                if (bolum && bolum.classList.contains('hidden')) {
                    var pano = document.getElementById('settingsPaneTercihler');
                    if (pano) pano.hidden = pano.hidden;   // yerleşimi bozma
                }
            }, 120);
        });
    }
})();
