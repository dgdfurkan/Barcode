/**
 * Tartılı barkod: kilo ile satılan ürüne gram girilince terazi barkodu.
 * ============================================================================
 *
 * NE ÜRETİYOR
 * Terazi etiketindeki EAN-13: 2 + 6 haneli ürün kodu + 5 haneli gram +
 * kontrol hanesi. Ürün kodu kataloğun kendisinden geliyor: adı "(kg)" ile
 * biten ve 2 ile başlayan 7 haneli barkodu olan ürün. Bugün Erpiliç Piliç
 * Baget ve Bonfile (kg). Kataloğa yeni bir kg ürünü girerse kendiliğinden
 * listeye düşer.
 *
 * Örnek: Baget 937 g → 2836550 00937 + kontrol = 2836550009372.
 *
 * İKİ KÖK VARSA
 * Katalogda kg ürünlerinin iki kökü var (2807xxx ve 2836xxx). Sahada
 * okunan 2836xxx; TERCIH listesi onu seçiyor. Listede olmayan yeni üründe
 * son kök alınıyor (katalog yeni kodu sona ekliyor).
 *
 * SAYFANIN KENDİ KODUNA DOKUNULMUYOR
 * `products`, `lastSearchResults` ve `generateBarcodeSVG` adıyla okunuyor.
 * Panel yalnız tek terimli aramada ve sonuçta kg ürünü varken görünüyor;
 * virgüllü toplu sorgu (toplu kopyalama) hiç etkilenmiyor.
 * ============================================================================
 */
(function () {
    'use strict';

    var TERCIH = ['2836550', '2836552'];
    var KOK = /^2\d{6}$/;

    var sonucBolumu = document.getElementById('resultsSection');
    var aramaKutusu = document.getElementById('searchInput');
    if (!sonucBolumu) return;

    var tartili = null;      // id → { id, ad, kisa, kok, gorsel }
    var panel = null;
    var secili = null;       // ürün id
    var gram = '';
    var sonBarkod = '';
    var gosterilenImza = '';

    function katalog() {
        return (typeof products !== 'undefined' && Array.isArray(products) && products.length)
            ? products : null;
    }

    function kacir(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function kokBul(p) {
        var kodlar = (p.barcodes || []).map(function (b) {
            return String(b && b.code != null ? b.code : b).trim();
        }).filter(function (k) { return KOK.test(k); });
        if (!kodlar.length) return null;
        for (var i = 0; i < TERCIH.length; i++) {
            if (kodlar.indexOf(TERCIH[i]) !== -1) return TERCIH[i];
        }
        return kodlar[kodlar.length - 1];
    }

    function tartiliHazirla() {
        if (tartili) return tartili;
        var k = katalog();
        if (!k) return null;
        tartili = {};
        k.forEach(function (p) {
            if (!p || !/\(\s*kg\s*\)\s*$/i.test(String(p.name || ''))) return;
            var kok = kokBul(p);
            if (!kok) return;
            var kisa = String(p.name).replace(/\(\s*kg\s*\)\s*$/i, '').trim();
            if (p.brand) kisa = kisa.replace(new RegExp('^' + String(p.brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'), '');
            tartili[p.id] = { id: p.id, ad: p.name, kisa: kisa || p.name, kok: kok, gorsel: p.image || '' };
        });
        return tartili;
    }

    // EAN-13 kontrol hanesi: tek sıradakiler 1, çift sıradakiler 3 ile çarpılır
    function kontrolHanesi(on2) {
        var t = 0;
        for (var i = 0; i < 12; i++) t += (+on2.charAt(i)) * (i % 2 === 0 ? 1 : 3);
        return String((10 - t % 10) % 10);
    }

    function barkodUret(kok, g) {
        var n = parseInt(g, 10);
        if (!KOK.test(kok) || !(n >= 1 && n <= 99999)) return null;
        var on2 = kok + String(n).padStart(5, '0');
        return { kod: on2 + kontrolHanesi(on2), gram: n, kontrol: kontrolHanesi(on2) };
    }

    function terimTek() {
        var s = (aramaKutusu && aramaKutusu.value) || '';
        return s.trim() !== '' && s.indexOf(',') === -1;
    }

    function sonuctakiler() {
        var t = tartiliHazirla();
        if (!t || typeof lastSearchResults === 'undefined' || !lastSearchResults) return [];
        var r = lastSearchResults;
        if (r.grouped) return [];
        var liste = (r.active || []).concat(r.outOfStock || []);
        var gorulen = {};
        return liste.filter(function (p) {
            if (!p || !t[p.id] || gorulen[p.id]) return false;
            gorulen[p.id] = true;
            return true;
        }).map(function (p) { return t[p.id]; });
    }

    // ------------------------------------------------------------------
    // Panel
    // ------------------------------------------------------------------

    var BARKOD_IM = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5v10M5.5 5v10M8 5v10M11 5v10M13.5 5v10M17 5v10"/></svg>';
    var KOPYA_IM = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9.5" height="9.5" rx="2"/><path d="M13 7V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V11a2 2 0 0 0 2 2H7"/></svg>';
    var TAMAM_IM = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg>';

    function panelKur() {
        panel = document.createElement('section');
        panel.className = 'trt';
        panel.setAttribute('aria-label', 'Tartılı barkod');
        panel.hidden = true;
        panel.innerHTML =
            '<div class="trt__bas">' +
                '<span class="trt__im">' + BARKOD_IM + '</span>' +
                '<div class="trt__baslik"><strong>Tartılı Barkod</strong><span>Gramı yaz, terazi barkodu hazır</span></div>' +
            '</div>' +
            '<div class="trt__urunler" role="radiogroup" aria-label="Ürün"></div>' +
            '<div class="trt__govde">' +
                '<div class="trt__giris">' +
                    '<label class="trt__kutu">' +
                        '<input type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="Örn. 937" aria-label="Ağırlık (gram)">' +
                        '<span>g</span>' +
                    '</label>' +
                    '<div class="trt__ipucu" aria-live="polite"></div>' +
                '</div>' +
                '<button type="button" class="trt__barkod" title="Barkodu kopyalamak için dokun" disabled>' +
                    '<span class="trt__cizim"></span>' +
                    '<span class="trt__numara"></span>' +
                    '<span class="trt__bos">Gram gir, barkod burada belirsin</span>' +
                '</button>' +
                '<button type="button" class="trt__kopyala" disabled>' + KOPYA_IM + '<span>Barkodu Kopyala</span></button>' +
            '</div>';

        sonucBolumu.parentNode.insertBefore(panel, sonucBolumu);

        var girdi = panel.querySelector('input');
        girdi.addEventListener('input', function () {
            var temiz = girdi.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5);
            if (temiz !== girdi.value) girdi.value = temiz;
            gram = temiz;
            ciz();
        });
        girdi.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); kopyala(); }
        });
        panel.querySelector('.trt__barkod').addEventListener('click', kopyala);
        panel.querySelector('.trt__kopyala').addEventListener('click', kopyala);
        panel.querySelector('.trt__urunler').addEventListener('click', function (e) {
            var d = e.target.closest('[data-urun]');
            if (!d) return;
            secili = d.getAttribute('data-urun');
            urunleriCiz(sonuctakiler());
            ciz();
            girdi.focus();
        });
    }

    function urunleriCiz(liste) {
        var kap = panel.querySelector('.trt__urunler');
        kap.innerHTML = liste.map(function (u) {
            var acik = u.id === secili;
            return '<button type="button" role="radio" class="trt__urun" data-urun="' + kacir(u.id) + '" aria-checked="' + acik + '">' +
                (u.gorsel ? '<img src="' + kacir(u.gorsel) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') +
                '<span><strong>' + kacir(u.kisa) + '</strong><small>' + kacir(u.kok) + '</small></span>' +
            '</button>';
        }).join('');
    }

    function ciz() {
        if (!panel) return;
        var t = tartiliHazirla() || {};
        var u = t[secili];
        var b = u ? barkodUret(u.kok, gram) : null;
        var kutu = panel.querySelector('.trt__barkod');
        var dugme = panel.querySelector('.trt__kopyala');
        var ipucu = panel.querySelector('.trt__ipucu');

        sonBarkod = b ? b.kod : '';
        kutu.disabled = !b;
        dugme.disabled = !b;
        kutu.classList.toggle('trt__barkod--dolu', !!b);
        dugmeSifirla();

        if (!b) {
            panel.querySelector('.trt__cizim').innerHTML = '';
            panel.querySelector('.trt__numara').textContent = '';
            ipucu.textContent = 'Örn. 937 g = 0,937 kg';
            ipucu.classList.remove('trt__ipucu--etkin');
            return;
        }

        ipucu.textContent = b.gram.toLocaleString('tr-TR') + ' g = ' +
            (b.gram / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
        ipucu.classList.add('trt__ipucu--etkin');

        panel.querySelector('.trt__cizim').innerHTML = cizgiler(b.kod);
        panel.querySelector('.trt__numara').innerHTML =
            kacir(b.kod.charAt(0)) + ' <b>' + kacir(b.kod.slice(1, 7)) + '</b> ' +
            '<i>' + kacir(b.kod.slice(7, 12)) + '</i> ' + kacir(b.kod.charAt(12));
        kutu.setAttribute('aria-label', u.kisa + ', ' + b.gram + ' gram, barkod ' + b.kod + '. Kopyalamak için dokun.');
    }

    /* Rakamlar SVG'nin altında değil, gram kısmı vurgulu ayrı satırda; o yüzden
       sayfanın generateBarcodeSVG'si (rakamlı çiziyor) yalnız yedek. */
    function cizgiler(kod) {
        if (typeof JsBarcode === 'function') {
            try {
                var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                JsBarcode(svg, kod, {
                    format: 'EAN13', width: 2, height: 80, margin: 0,
                    displayValue: false, background: 'transparent', lineColor: '#000000'
                });
                // Okuyucu geniş çizgiyi daha kolay alıyor: kutunun enine yayılıyor
                svg.setAttribute('preserveAspectRatio', 'none');
                return svg.outerHTML;
            } catch (e) { /* aşağıdaki yedeğe düş */ }
        }
        return typeof generateBarcodeSVG === 'function' ? (generateBarcodeSVG(kod, 300, 80) || '') : '';
    }

    var dugmeZaman = 0;
    function dugmeSifirla() {
        clearTimeout(dugmeZaman);
        var d = panel.querySelector('.trt__kopyala');
        d.classList.remove('trt__kopyala--tamam');
        d.innerHTML = KOPYA_IM + '<span>Barkodu Kopyala</span>';
    }

    function panoya(metin) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(metin).catch(function () { return eskiYol(metin); });
        }
        return eskiYol(metin);
    }

    function eskiYol(metin) {
        return new Promise(function (coz, reddet) {
            var ta = document.createElement('textarea');
            ta.value = metin;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
            document.body.appendChild(ta);
            ta.select();
            var tamam = false;
            try { tamam = document.execCommand('copy'); } catch (e) { tamam = false; }
            ta.remove();
            if (tamam) coz(); else reddet(new Error('kopyalanamadı'));
        });
    }

    function kopyala() {
        if (!sonBarkod) return;
        var kod = sonBarkod;
        panoya(kod).then(function () {
            var d = panel.querySelector('.trt__kopyala');
            d.classList.add('trt__kopyala--tamam');
            d.innerHTML = TAMAM_IM + '<span>Kopyalandı</span>';
            clearTimeout(dugmeZaman);
            dugmeZaman = setTimeout(dugmeSifirla, 1600);
            if (window.JBDiyalog && JBDiyalog.bildir) JBDiyalog.bildir(kod + ' kopyalandı', 'basari');
        }, function () {
            if (window.JBDiyalog && JBDiyalog.bildir) JBDiyalog.bildir('Kopyalanamadı, barkodu elle seç', 'hata');
        });
    }

    // ------------------------------------------------------------------
    // Ne zaman görünür
    // ------------------------------------------------------------------

    function guncelle() {
        var liste = (!sonucBolumu.classList.contains('hidden') && terimTek()) ? sonuctakiler() : [];
        if (!liste.length) {
            if (panel) panel.hidden = true;
            gosterilenImza = '';
            return;
        }
        if (!panel) panelKur();

        var imza = liste.map(function (u) { return u.id; }).join('|');
        if (!secili || !liste.some(function (u) { return u.id === secili; })) secili = liste[0].id;
        if (imza !== gosterilenImza) {
            gosterilenImza = imza;
            urunleriCiz(liste);
            ciz();
        }
        panel.hidden = false;
    }

    var bekleyen = 0;
    function planla() {
        clearTimeout(bekleyen);
        bekleyen = setTimeout(guncelle, 60);
    }

    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(planla).observe(sonucBolumu, { attributes: true, attributeFilter: ['class'] });
        ['resultsTableBody', 'gridResults', 'mobileResults'].forEach(function (kimlik) {
            var el = document.getElementById(kimlik);
            if (el) new MutationObserver(planla).observe(el, { childList: true });
        });
    }

    window.JBTartili = { barkodUret: barkodUret };
})();
