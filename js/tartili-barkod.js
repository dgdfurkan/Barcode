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
 * GÖRÜNÜM
 * Sonuç tablosunun kendi dili: başlık bandı, ürün başına bir satır, satırda
 * gram kutusu ve sayfanın kendi barkod çizimi (generateBarcodeSVG). Seçim
 * adımı yok; her ürün kendi gramını tutuyor.
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

    var tartili = null;      // id → { id, ad, marka, kok, gorsel }
    var panel = null;
    var gramlar = {};        // ürün id → gram metni (arama değişse de kalır)
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
            tartili[p.id] = { id: p.id, ad: p.name, marka: p.brand || '', kok: kok, gorsel: p.image || '' };
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
        return { kod: on2 + kontrolHanesi(on2), gram: n };
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

    function kiloYazi(gram) {
        return (gram / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
    }

    // ------------------------------------------------------------------
    // Panel
    // ------------------------------------------------------------------

    var TERAZI_IM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M7 20h10M5 8h14"/><path d="M5 8l-2.5 6a3 3 0 0 0 5 0z"/><path d="M19 8l-2.5 6a3 3 0 0 0 5 0z"/><circle cx="12" cy="4" r="1"/></svg>';
    var KOPYA_IM = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
    var TAMAM_IM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

    function panelKur() {
        panel = document.createElement('section');
        panel.className = 'trt';
        panel.setAttribute('aria-label', 'Tartılı barkod');
        panel.hidden = true;
        panel.innerHTML =
            '<div class="trt__bas">' +
                '<span class="trt__im">' + TERAZI_IM + '</span>' +
                '<div class="trt__baslik"><h3>Tartılı Barkod</h3><p>Kilo ile satılan ürün. Terazideki gramı yaz, barkod hazır.</p></div>' +
            '</div>' +
            '<div class="trt__satirlar"></div>';

        sonucBolumu.parentNode.insertBefore(panel, sonucBolumu);

        var satirlar = panel.querySelector('.trt__satirlar');
        satirlar.addEventListener('input', function (e) {
            var girdi = e.target.closest('input[data-urun]');
            if (!girdi) return;
            var temiz = girdi.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5);
            if (temiz !== girdi.value) girdi.value = temiz;
            gramlar[girdi.getAttribute('data-urun')] = temiz;
            satirCiz(girdi.closest('.trt__satir'));
        });
        satirlar.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            var girdi = e.target.closest('input[data-urun]');
            if (!girdi) return;
            e.preventDefault();
            kopyala(girdi.closest('.trt__satir'));
        });
        satirlar.addEventListener('click', function (e) {
            var hedef = e.target.closest('.trt__barkod, .trt__kopyala');
            if (!hedef || hedef.disabled) return;
            kopyala(hedef.closest('.trt__satir'));
        });
    }

    function satirlariCiz(liste) {
        panel.querySelector('.trt__satirlar').innerHTML = liste.map(function (u) {
            var id = kacir(u.id);
            return '<div class="trt__satir" data-satir="' + id + '" data-kok="' + kacir(u.kok) + '">' +
                '<div class="trt__urun">' +
                    (u.gorsel ? '<img src="' + kacir(u.gorsel) + '" alt="" loading="lazy" decoding="async" onerror="this.style.visibility=\'hidden\'">' : '<span class="trt__resimsiz"></span>') +
                    '<div><h4>' + kacir(u.ad) + '</h4><p>' + (u.marka ? kacir(u.marka) + ' • ' : '') + 'Kök ' + kacir(u.kok) + '</p></div>' +
                '</div>' +
                '<label class="trt__kutu">' +
                    '<input type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="Gram" data-urun="' + id + '" value="' + kacir(gramlar[u.id] || '') + '" aria-label="' + kacir(u.ad) + ' ağırlığı (gram)">' +
                    '<span>g</span>' +
                '</label>' +
                '<button type="button" class="trt__barkod" disabled><span class="trt__cizim"></span><span class="trt__bos">Gram bekleniyor</span></button>' +
                '<button type="button" class="trt__kopyala" disabled title="Barkodu kopyala" aria-label="Barkodu kopyala">' + KOPYA_IM + '</button>' +
            '</div>';
        }).join('');
        panel.querySelectorAll('.trt__satir').forEach(satirCiz);
    }

    function satirCiz(satir) {
        if (!satir) return;
        var girdi = satir.querySelector('input');
        var b = barkodUret(satir.getAttribute('data-kok'), girdi.value);
        var kutu = satir.querySelector('.trt__barkod');
        var dugme = satir.querySelector('.trt__kopyala');
        var ad = girdi.getAttribute('aria-label').replace(/ ağırlığı \(gram\)$/, '');

        satir.setAttribute('data-barkod', b ? b.kod : '');
        kutu.disabled = !b;
        dugme.disabled = !b;
        satir.classList.toggle('trt__satir--dolu', !!b);
        dugmeSifirla(satir);

        satir.querySelector('.trt__bos').textContent = b ? '' : 'Gram bekleniyor';
        satir.querySelector('.trt__cizim').innerHTML = b ? cizim(b.kod) : '';
        satir.querySelector('.trt__kutu').setAttribute('data-kilo', b ? kiloYazi(b.gram) : '');
        if (b) {
            kutu.title = 'Kopyalamak için dokun';
            kutu.setAttribute('aria-label', ad + ', ' + kiloYazi(b.gram) + ', barkod ' + b.kod + '. Kopyalamak için dokun.');
        } else {
            kutu.removeAttribute('title');
            kutu.removeAttribute('aria-label');
        }
    }

    // Sonuç tablosundaki barkodlarla aynı çizim (rakamlar altında)
    function cizim(kod) {
        if (typeof generateBarcodeSVG === 'function') {
            var s = generateBarcodeSVG(kod, 240, 80);
            if (s) return s;
        }
        return '<span class="trt__yedek">' + kacir(kod) + '</span>';
    }

    function dugmeSifirla(satir) {
        clearTimeout(satir._zaman);
        var d = satir.querySelector('.trt__kopyala');
        d.classList.remove('trt__kopyala--tamam');
        d.innerHTML = KOPYA_IM;
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

    function kopyala(satir) {
        var kod = satir && satir.getAttribute('data-barkod');
        if (!kod) return;
        panoya(kod).then(function () {
            var d = satir.querySelector('.trt__kopyala');
            d.classList.add('trt__kopyala--tamam');
            d.innerHTML = TAMAM_IM;
            clearTimeout(satir._zaman);
            satir._zaman = setTimeout(function () { dugmeSifirla(satir); }, 1600);
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
        if (imza !== gosterilenImza) {
            gosterilenImza = imza;
            satirlariCiz(liste);
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
