/**
 * Modül: Toplu Kopyalama
 * ============================================================================
 *
 * warehouse.getir.com sipariş panelinde ürün tablolarına kopyalama düğmesi
 * ekler. Satır başına küçük bir düğme, tablonun üstüne de "Tümünü Kopyala".
 * Kopyalanan HTML, Jet Barkod arama kutusuna yapıştırılınca barkoda ve
 * görsele çözülüyor.
 *
 * Kaynağı `getir-warehouse-html-copy-extension/content.js`. Ürün satırı
 * tanıma mantığı birebir korundu; sahada çalışan kısım orası ve Getir
 * panelinin sınıf isimlerine bağlı. Değişen yerler:
 *
 *   - Kendi MutationObserver'ı yok, çekirdeğin tek gözlemcisine abone.
 *   - Kendi bildirim kutusu yok, çekirdeğin bildirimi.
 *   - Kendi pano yardımcısı yok, çekirdeğinki (yedekli).
 *   - Sınıf adları `jba-` önekine alındı. Sayfaya sızan tek şey bu iki
 *     düğmenin stili; tablo satırının içinde durdukları için gölge DOM'a
 *     alınamıyor, o yüzden önek şart.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var SITE = 'https://jetbarkod.com.tr/pages/product_search.html';
    var YONLENDIR_ANAHTARI = 'getirAutoRedirect';

    var STIL = [
        '.jba-satir-kopyala {',
        '  opacity: 0.4; transition: opacity 0.2s; font-size: 11px; padding: 2px 6px;',
        '  border: 1px solid #ddd; background: #f5f5f5; border-radius: 3px;',
        '  cursor: pointer; margin-left: 5px; color: #666; font-weight: normal; }',
        '.jba-satir-kopyala:hover {',
        '  opacity: 1; background: #e8f4f8; border-color: #4a90e2; color: #4a90e2; }',
        '.jba-tum-kopyala {',
        '  opacity: 0.6; padding: 4px 10px; font-size: 12px; border: 1px solid #4a90e2;',
        '  background: #e8f4f8; color: #4a90e2; border-radius: 4px; cursor: pointer;',
        '  margin: 5px; font-weight: 500; }',
        '.jba-tum-kopyala:hover { opacity: 1; background: #4a90e2; color: #fff; }',
        '.jba-tum-kap { display: flex; justify-content: flex-end; padding: 5px; margin-bottom: 10px; }'
    ].join('\n');

    function stilKur() {
        if (document.getElementById('jba-toplu-kopyalama-stil')) return;
        var s = document.createElement('style');
        s.id = 'jba-toplu-kopyalama-stil';
        s.textContent = STIL;
        (document.head || document.documentElement).appendChild(s);
    }

    // ==================================================================
    // Yönlendirme tercihi
    // ==================================================================

    function yonlendirmeAcikMi() {
        return new Promise(function (coz) {
            try {
                chrome.storage.local.get(YONLENDIR_ANAHTARI, function (r) {
                    var d = r && r[YONLENDIR_ANAHTARI];
                    coz(d === true || d === 'true');
                });
            } catch (e) { coz(false); }
        });
    }

    /**
     * Jet Barkod zaten açık bir sekmedeyse yeni sekme açma. Açık sekme
     * BroadcastChannel'dan cevap veriyor; yarım saniye sessizlik gelirse
     * açık değildir, yeni sekme açılır.
     */
    function siteyeGit() {
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                var kanal = new BroadcastChannel('barcode_site_nav');
                var cevap = false;
                var dinle = function (e) {
                    if (e.data && e.data.type === 'pong') cevap = true;
                };
                kanal.addEventListener('message', dinle);
                kanal.postMessage({ type: 'ping', url: SITE });
                setTimeout(function () {
                    kanal.removeEventListener('message', dinle);
                    kanal.close();
                    if (!cevap) window.open(SITE, '_blank');
                }, 500);
                return;
            }
        } catch (e) { /* kanal yoksa aşağıdaki yol */ }
        window.open(SITE, '_blank');
    }

    function kopyalandiktanSonra() {
        yonlendirmeAcikMi().then(function (acik) {
            if (acik) setTimeout(siteyeGit, 500);
        });
    }

    // ==================================================================
    // Ürün satırı tanıma. Getir panelinin Ant Design yapısına bağlı.
    // ==================================================================

    var ATLA = ['müşteri adı', 'müşteri notu', 'teslimat adresi', 'adres açıklaması',
                'toplayıcı adı', 'kurye adı', 'poşet kullanımı', 'durum', 'lokasyonlar',
                'müşteri', 'kurye', 'toplayıcı', 'adres', 'teslimat', 'notu'];

    function urunTablosuMu(tablo) {
        if (tablo.closest('.ant-descriptions')) return false;
        if (tablo.closest('.ant-descriptions-view')) return false;
        var sarmal = tablo.closest('.ant-table-wrapper, .ant-table-container');
        if (!sarmal && !tablo.classList.contains('ant-table')) {
            if (!tablo.closest('.ant-row .ant-col')) return false;
        }
        return true;
    }

    function urunSatiriMi(tr) {
        if (tr.closest('.ant-descriptions')) return false;
        if (tr.classList.contains('ant-descriptions-row')) return false;
        if (tr.closest('.ant-descriptions-view')) return false;

        var hucreler = tr.querySelectorAll('td');
        var metin = Array.prototype.map.call(hucreler, function (h) {
            return h.textContent.trim();
        }).join(' ').toLowerCase();
        for (var i = 0; i < ATLA.length; i++) {
            if (metin.includes(ATLA[i])) return false;
        }

        var gorsel = tr.querySelector(
            'img[src*="product"], img[src*="getir.com/product"], img[src*="getir.com/market/product"],' +
            ' img[src*="market/product"], img[src*="cdn-image.getir.com"]');
        if (!gorsel) {
            var ant = tr.querySelector('.ant-image img');
            if (!ant || !ant.src) return false;
            if (!ant.src.includes('product') && !ant.src.includes('getir')) return false;
        }

        return Array.prototype.some.call(hucreler, function (h) {
            var t = h.textContent.trim();
            return t && t.length > 2 && !/^\d+$/.test(t);
        });
    }

    function satirKabi(kok) {
        var satirlar = (kok || document).querySelectorAll('.ant-row');
        for (var i = 0; i < satirlar.length; i++) {
            var s = satirlar[i];
            if (s.closest('.ant-descriptions')) continue;
            var trler = s.querySelectorAll('table tbody tr');
            for (var j = 0; j < trler.length; j++) {
                var tr = trler[j];
                if (tr.querySelector('img') || tr.querySelector('.ant-image img')) return s;
                var hucreler = tr.querySelectorAll('td');
                var adVar = Array.prototype.some.call(hucreler, function (h) {
                    var t = (h.textContent || '').trim();
                    return t.length > 2 && !/^\d+$/.test(t) &&
                           !t.includes('Ürün Adı') && !t.includes('Adet');
                });
                if (adVar) return s;
            }
        }
        return null;
    }

    // ==================================================================
    // Kopyalama
    // ==================================================================

    function satirKopyala(tr) {
        JBA.panoyaYaz(tr.outerHTML).then(function (oldu) {
            if (!oldu) return JBA.bildir('Kopyalanamadı, tekrar dene.', 'olumsuz');
            JBA.bildir('Ürün kopyalandı.', 'olumlu');
            kopyalandiktanSonra();
        });
    }

    function tumunuKopyala() {
        var html = null;
        var kap = satirKabi();
        if (kap) {
            html = kap.outerHTML;
        } else {
            var govde = document.querySelector('.ant-modal .ant-modal-body');
            if (govde) html = govde.innerHTML;
        }
        if (!html) return JBA.bildir('Ürün tablosu bulunamadı.', 'olumsuz');

        JBA.panoyaYaz(html).then(function (oldu) {
            if (!oldu) return JBA.bildir('Kopyalanamadı, tekrar dene.', 'olumsuz');
            var adet = kap
                ? kap.querySelectorAll('tbody tr.ant-table-row').length
                : (html.match(/ant-table-row/g) || html.match(/<tr/g) || []).length;
            JBA.bildir(adet > 0 ? adet + ' ürün kopyalandı.' : 'Liste kopyalandı.', 'olumlu');
            kopyalandiktanSonra();
        });
    }

    // ==================================================================
    // Düğmeleri yerleştir
    // ==================================================================

    function satiraDugme(tr) {
        if (tr.querySelector('.jba-satir-kopyala')) return;
        if (!urunSatiriMi(tr)) return;

        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'jba-satir-kopyala';
        d.textContent = '📋';
        d.title = 'Bu ürünü kopyala';
        d.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            satirKopyala(tr);
        });

        var hucreler = tr.querySelectorAll('td');
        if (hucreler.length) {
            var son = hucreler[hucreler.length - 1];
            if (!son.querySelector('.jba-satir-kopyala')) {
                son.style.position = 'relative';
                son.appendChild(d);
            }
        } else {
            var yeni = document.createElement('td');
            yeni.appendChild(d);
            tr.appendChild(yeni);
        }
    }

    function tumunuDugmesi() {
        var satirlar = document.querySelectorAll('.ant-row');
        for (var i = 0; i < satirlar.length; i++) {
            var satir = satirlar[i];
            if (satir.closest('.ant-descriptions')) continue;

            var urunVar = false;
            var sutunlar = satir.querySelectorAll('.ant-col');
            for (var j = 0; j < sutunlar.length && !urunVar; j++) {
                var tablolar = sutunlar[j].querySelectorAll('table');
                for (var k = 0; k < tablolar.length && !urunVar; k++) {
                    if (!urunTablosuMu(tablolar[k])) continue;
                    var trler = tablolar[k].querySelectorAll('tbody tr');
                    for (var m = 0; m < trler.length; m++) {
                        if (urunSatiriMi(trler[m])) { urunVar = true; break; }
                    }
                }
            }
            if (!urunVar) continue;

            var ust = satir.parentNode;
            if (!ust || ust.querySelector('.jba-tum-kap')) continue;

            var kap = document.createElement('div');
            kap.className = 'jba-tum-kap';
            var d = document.createElement('button');
            d.type = 'button';
            d.className = 'jba-tum-kopyala';
            d.textContent = '📋 Tümünü Kopyala';
            d.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                tumunuKopyala();
            });
            kap.appendChild(d);
            ust.insertBefore(kap, satir);
        }
    }

    function tara() {
        tumunuDugmesi();
        var gorulen = [];
        var satirlar = document.querySelectorAll('.ant-row');
        for (var i = 0; i < satirlar.length; i++) {
            if (satirlar[i].closest('.ant-descriptions')) continue;
            var sutunlar = satirlar[i].querySelectorAll('.ant-col');
            for (var j = 0; j < sutunlar.length; j++) {
                var tablolar = sutunlar[j].querySelectorAll('table');
                for (var k = 0; k < tablolar.length; k++) {
                    var t = tablolar[k];
                    if (gorulen.indexOf(t) > -1 || !urunTablosuMu(t)) continue;
                    gorulen.push(t);
                    var trler = t.querySelectorAll('tbody tr');
                    for (var m = 0; m < trler.length; m++) satiraDugme(trler[m]);
                }
            }
        }
    }

    // ==================================================================

    JBA.kayit({
        kimlik: 'topluKopyalama',
        ad: 'Toplu Kopyalama',
        ozet: 'Sipariş tablolarına kopyalama düğmesi ekler. Kopyalananı Jet Barkod arama kutusuna yapıştır.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return yol.includes('/dashboard/orders'); },

        baslat: function (ctx) {
            stilKur();
            tara();
            // Getir paneli tek sayfa uygulaması: tablo sonradan geliyor,
            // modal açılıp kapanıyor. Tek gözlemci her değişiklikte tarıyor.
            this._birak = ctx.izle(tara);
        },

        durdur: function () {
            if (this._birak) this._birak();
            document.querySelectorAll('.jba-satir-kopyala, .jba-tum-kap').forEach(function (e) { e.remove(); });
        },

        eylemler: [
            { ad: 'Tümünü kopyala', calistir: tumunuKopyala }
        ]
    });
})(window);
