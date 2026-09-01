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
                   gibi bir metin görmüyor.

                   `kutuyuDoldur` üzerinden gidiyor: yoksa bu doldurma
                   yapıştırma sanılıp banko açılıyordu. */
                kutuyuDoldur(dugme.dataset.ara);
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
    var bankoArayuz = null;

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

        bankoArayuz = window.JBBanko.kur(bankoKap);
    }

    /*
     * Banko YALNIZCA toplu kopyalamada açılıyor.
     *
     * ÖNCEKİ ÖLÇÜT YANLIŞTI
     * "Birden fazla sonuç geldiyse toplu kopyalamadır" diye bakıyordum.
     * Oysa tek kelime yazınca da yüz sonuç geliyor: "süt" yazan depocunun
     * karşısına banko karekodu çıkıyordu. Sonuç sayısı sorgunun ne olduğunu
     * söylemiyor.
     *
     * DOĞRU ÖLÇÜT: SORGUNUN KENDİSİ
     * Toplu kopyalama arama kutusuna virgülle ayrılmış bir liste bırakıyor
     * (eklentinin "Tümünü Kopyala" düğmesi de, tablo yapıştırması da).
     * Elle tek ürün arayan virgül yazmıyor. O yüzden ölçüt virgülle ayrılmış
     * en az iki terim.
     *
     * Sonuç sayısına yine bakılıyor ama yalnızca "hiç sonuç yoksa açma"
     * için; tetikleyen şey sorgunun biçimi.
     *
     * Aynı sorgu için ikinci kez açılmıyor: kullanıcı kapattıysa kapalı
     * kalıyor, her yeniden çizimde önüne fırlamıyor.
     */
    var sonAcilisImzasi = null;

    function sonucSayisi() {
        var t = document.querySelectorAll('#resultsTableBody tr').length;
        var g = document.querySelectorAll('#gridResults > *').length;
        var m = document.querySelectorAll('#mobileResults > *').length;
        return Math.max(t, g, m);
    }

    /*
     * SORGU YAZILDI MI, YAPIŞTIRILDI MI?
     *
     * Virgül tek başına yetmiyor. Tek ürünlük bir sipariş kopyalandığında
     * listede virgül olmuyor ama o da bir sepet; bankoya konması gerekiyor.
     * Öte yandan elle "süt" yazan kişiye banko açılmamalı.
     *
     * Ayrım şu: toplu kopyalama arama kutusunu KENDİSİ dolduruyor. Ya
     * eklenti sayfaya dönünce otomatik yapıştırıyor, ya kullanıcı yapıştır
     * düğmesine basıyor, ya da Ctrl+V yapıyor. Üçünde de metin bir anda
     * beliriyor, harf harf yazılmıyor.
     *
     * Son tuş vuruşunun üstünden ne kadar geçtiğine bakılıyor. Ctrl+V'de
     * tuş vuruşu da olduğu için `paste` olayı ayrıca dinleniyor ve o bir
     * sonraki değişiklikte sözü kesiyor.
     */
    var tusaBasildi = false;
    var yapistirmaBayragi = false;
    var kendiYazdik = false;
    var sonSorguYapistirma = false;

    /*
     * Arama kutusunu KENDİMİZ doldurduğumuzda çağrılıyor.
     *
     * Yapıştırma tespiti "tuş vuruşu var mı" diye bakıyor. Öneri şeridine
     * tıklayınca kutuyu kod dolduruyor ve tuş vuruşu olmuyor; bu da
     * yapıştırma sayılıp banko açılıyordu. Kullanıcı sadece "pepsi mi demek
     * istediniz" önerisine dokunmuştu.
     *
     * Bu işaret, bir sonraki değişimin ne yazma ne yapıştırma olduğunu
     * söylüyor: bizim kendi doldurmamız.
     */
    function kutuyuDoldur(metin) {
        if (!aramaKutusu) return;
        kendiYazdik = true;
        aramaKutusu.value = metin;
        aramaKutusu.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (aramaKutusu) {
        /*
         * SÜREYE BAKMAK YANLIŞTI
         * Önce "son tuştan 400 ms geçtiyse yazma değildir" deniyordu. Uzun
         * bir ürün adını duraklaya duraklaya yazan biri bu sınırı aşıyor ve
         * yazdığı şey yapıştırma sanılıyordu; "Ülker Çubuk Kraker (" yazınca
         * banko açılıyordu.
         *
         * Süre değil, tuşun kendisi ölçüt. Harf harf yazarken her değişimin
         * hemen öncesinde bir tuş vuruşu vardır. Eklenti kutuyu kendisi
         * doldurduğunda hiç tuş vuruşu olmaz. Ctrl+V'de tuş da olur, o yüzden
         * `paste` olayı ayrıca dinleniyor ve sözü kesiyor.
         */
        aramaKutusu.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) return;
            tusaBasildi = true;
        });

        aramaKutusu.addEventListener('paste', function () { yapistirmaBayragi = true; });

        aramaKutusu.addEventListener('input', function () {
            if (kendiYazdik) {
                sonSorguYapistirma = false;
                kendiYazdik = false;
                tusaBasildi = false;
                return;
            }
            if (yapistirmaBayragi) {
                sonSorguYapistirma = true;
                yapistirmaBayragi = false;
                tusaBasildi = false;
                return;
            }
            sonSorguYapistirma = !tusaBasildi;
            tusaBasildi = false;
        });
    }

    /** Virgülle ayrılmış, boş olmayan terim sayısı. */
    function terimSayisi() {
        var ham = (aramaKutusu && aramaKutusu.value) || '';
        if (!ham) return 0;
        var parcalar = ham.split(',');
        var adet = 0;
        for (var i = 0; i < parcalar.length; i++) {
            if (parcalar[i].replace(/\s+/g, '')) adet++;
        }
        return adet;
    }

    function topluSonucGeldi() {
        if (!bankoArayuz || typeof bankoArayuz.otomatikAc !== 'function') return;

        /* Toplu kopyalamanın iki işareti var, biri yetiyor:
           virgüllü liste (barkod listesi, ürün adı listesi, görsel
           bağlantılı liste) ya da kutunun elle yazılmadan dolması
           (tek ürünlük sipariş kopyalaması). */
        if (terimSayisi() < 2 && !sonSorguYapistirma) return;
        if (!sonucSayisi()) return;

        var imza = (aramaKutusu && aramaKutusu.value) || '';
        if (imza === sonAcilisImzasi) return;
        sonAcilisImzasi = imza;

        bankoArayuz.otomatikAc();
    }

    var sonucBolumu = document.getElementById('resultsSection');
    if (sonucBolumu && typeof MutationObserver !== 'undefined') {
        new MutationObserver(function () {
            if (!sonucBolumu.classList.contains('hidden')) setTimeout(topluSonucGeldi, 320);
        }).observe(sonucBolumu, { attributes: true, attributeFilter: ['class'] });

        ['resultsTableBody', 'gridResults', 'mobileResults'].forEach(function (kimlik) {
            var el = document.getElementById(kimlik);
            if (el) new MutationObserver(function () {
                if (!sonucBolumu.classList.contains('hidden')) setTimeout(topluSonucGeldi, 320);
            }).observe(el, { childList: true });
        });
    }

    // ==================================================================
    // Ayarlar
    // ==================================================================

    /**
     * Banko ayarları "Görünüm" sekmesine ekleniyor. Sayfanın kendi ayar
     * yapısı (settings-row / settings-switch) kullanılıyor; yeni bir görsel
     * dil getirilmiyor.
     *
     * Anahtar kapalıyken alt ayarlar gizleniyor: kapalı bir özelliğin
     * ayarları ekranda durup kafa karıştırmasın.
     */
    function ayarEkle() {
        var pano = document.getElementById('settingsPaneTercihler');
        if (!pano || document.getElementById('bankoToggle') || !window.JBBanko) return;

        var s = window.JBBanko.secenekler();

        var grup = document.createElement('div');
        grup.className = 'settings-group';
        grup.id = 'bankoAyarGrubu';
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
                        'paneli açılır. Kapalıyken sayfa şu anki gibi kalır.</p>' +
                    '</div>' +
                    '<div class="settings-row__actions">' +
                        '<label class="settings-switch">' +
                            '<input type="checkbox" id="bankoToggle" aria-label="Banko Karekodları">' +
                            '<span class="settings-switch__track"></span>' +
                        '</label>' +
                    '</div>' +
                '</div>' +

                '<div id="bankoAltAyar" class="bnk-ayar" hidden>' +
                    '<div class="settings-row settings-row--stack">' +
                        '<div class="settings-row__body">' +
                            '<p class="settings-row__title">Banko aralığı</p>' +
                            '<p class="settings-row__desc">Öneriler yalnızca bu aralıktan ' +
                            'gelir. Deponda kullanılmayan numaralar hiç çıkmaz.</p>' +
                        '</div>' +
                        '<div class="settings-row__actions bnk-ayar__aralik">' +
                            '<input type="number" id="bankoAlt" class="bnk-ayar__sayi" min="1"' +
                            ' max="120" aria-label="En küçük banko numarası">' +
                            '<span class="bnk-ayar__ayrac">–</span>' +
                            '<input type="number" id="bankoUst" class="bnk-ayar__sayi" min="1"' +
                            ' max="120" aria-label="En büyük banko numarası">' +
                        '</div>' +
                    '</div>' +

                    '<div class="settings-row settings-row--stack">' +
                        '<div class="settings-row__body">' +
                            '<p class="settings-row__title">Satırdaki öneri sayısı</p>' +
                            '<p class="settings-row__desc">Panelde kaç rastgele banko ' +
                            'görünsün. <b data-rol="oneriDeger"></b> tane.</p>' +
                        '</div>' +
                        '<div class="settings-row__actions">' +
                            '<input type="range" id="bankoOneriAdedi" class="bnk-ayar__kaydir"' +
                            ' min="0" max="20" step="1" aria-label="Öneri sayısı">' +
                        '</div>' +
                    '</div>' +

                    '<div class="settings-row">' +
                        '<div class="settings-row__body">' +
                            '<p class="settings-row__title">Toplu kopyalamada kendiliğinden aç</p>' +
                            '<p class="settings-row__desc">Birden fazla ürün geldiğinde ' +
                            'rastgele bir banko karekodu ekrana gelir.</p>' +
                        '</div>' +
                        '<div class="settings-row__actions">' +
                            '<label class="settings-switch">' +
                                '<input type="checkbox" id="bankoOtoAc" aria-label="Kendiliğinden aç">' +
                                '<span class="settings-switch__track"></span>' +
                            '</label>' +
                        '</div>' +
                    '</div>' +

                    '<div class="settings-row settings-row--stack">' +
                        '<div class="settings-row__body">' +
                            '<p class="settings-row__title">Kendiliğinden kapanma</p>' +
                            '<p class="settings-row__desc">Karekod <b data-rol="sureDeger"></b> ' +
                            'sonra kapanır; okuttuktan sonra elini sürmene gerek kalmaz. ' +
                            'Sıfır yapılırsa kapanmaz.</p>' +
                        '</div>' +
                        '<div class="settings-row__actions">' +
                            '<input type="range" id="bankoSure" class="bnk-ayar__kaydir"' +
                            ' min="0" max="15" step="1" aria-label="Kapanma süresi">' +
                        '</div>' +
                    '</div>' +

                    '<div class="settings-row">' +
                        '<div class="settings-row__body">' +
                            '<p class="settings-row__title">Verilmiş bankoları unut</p>' +
                            '<p class="settings-row__desc">Son verilen bankolar bir süre ' +
                            'tekrar önerilmez. Bu listeyi sıfırlar.</p>' +
                        '</div>' +
                        '<div class="settings-row__actions">' +
                            '<button id="bankoSifirla" class="settings-btn" type="button">Sıfırla</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        pano.insertBefore(grup, pano.firstChild);

        var anahtar = grup.querySelector('#bankoToggle');
        var altAyar = grup.querySelector('#bankoAltAyar');
        var alt = grup.querySelector('#bankoAlt');
        var ust = grup.querySelector('#bankoUst');
        var adet = grup.querySelector('#bankoOneriAdedi');
        var otoAc = grup.querySelector('#bankoOtoAc');
        var sure = grup.querySelector('#bankoSure');
        var sifirla = grup.querySelector('#bankoSifirla');
        var adetYazi = grup.querySelector('[data-rol="oneriDeger"]');
        var sureYazi = grup.querySelector('[data-rol="sureDeger"]');

        function yaz() {
            var g = window.JBBanko.secenekler();
            alt.value = g.altSinir;
            ust.value = g.ustSinir;
            adet.value = g.oneriAdedi;
            otoAc.checked = g.otoAc;
            sure.value = g.otoKapatSn;
            adetYazi.textContent = g.oneriAdedi;
            sureYazi.textContent = g.otoKapatSn ? g.otoKapatSn + ' saniye' : 'kendiliğinden değil';
            anahtar.checked = window.JBBanko.acikMi();
            altAyar.hidden = !anahtar.checked;
        }

        function kaydet(yeni) {
            window.JBBanko.secenekYaz(yeni);
            yaz();
            if (bankoArayuz && typeof bankoArayuz.tazele === 'function') bankoArayuz.tazele();
        }

        anahtar.addEventListener('change', function () {
            window.JBBanko.ayarla(anahtar.checked);
            bankoYerlestir();
            yaz();
        });

        alt.addEventListener('change', function () { kaydet({ altSinir: parseInt(alt.value, 10) }); });
        ust.addEventListener('change', function () { kaydet({ ustSinir: parseInt(ust.value, 10) }); });
        otoAc.addEventListener('change', function () { kaydet({ otoAc: otoAc.checked }); });

        /* Kaydırırken sayı anında güncelleniyor, bırakınca kaydediliyor:
           her piksel için yerel depolamaya yazılmıyor. */
        adet.addEventListener('input', function () { adetYazi.textContent = adet.value; });
        adet.addEventListener('change', function () { kaydet({ oneriAdedi: parseInt(adet.value, 10) }); });
        sure.addEventListener('input', function () {
            sureYazi.textContent = +sure.value ? sure.value + ' saniye' : 'kendiliğinden değil';
        });
        sure.addEventListener('change', function () { kaydet({ otoKapatSn: parseInt(sure.value, 10) }); });

        sifirla.addEventListener('click', function () {
            window.JBBanko.gecmisSifirla();
            if (bankoArayuz && typeof bankoArayuz.tazele === 'function') bankoArayuz.tazele();
            sifirla.textContent = 'Sıfırlandı';
            setTimeout(function () { sifirla.textContent = 'Sıfırla'; }, 1400);
        });

        yaz();
    }

    ayarEkle();
    bankoYerlestir();

    /* "Görünüm" sekmesi parlama önleme kapalıyken gizleniyor. Banko ayarları
       orada olduğu için sekme her hâlükârda açık kalmalı. */
    var ayarDugmesi = document.getElementById('settingsBtn');
    if (ayarDugmesi) {
        ayarDugmesi.addEventListener('click', function () {
            setTimeout(function () {
                ayarEkle();
                var sekme = document.getElementById('settingsTabTercihler');
                if (sekme) sekme.classList.remove('settings-tab--display-only');
            }, 120);
        });
    }
})();
