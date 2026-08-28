/**
 * Modül: Sayım Listesi Kopyalama
 * ============================================================================
 *
 * warehouse.getir.com'daki depo ve sayım tablolarını panoya JSON olarak
 * alır. Sipariş tablosundan farkı şu: orada HTML kopyalanıyor, burada
 * ürün adı ve barkod ayrıştırılıp `BARCODE_SAYIM_V1` başlıklı bir yük
 * üretiliyor. Sayım sayfasındaki "Panodan İçe Aktar" bunu okuyor.
 *
 * Kaynağı `getir-warehouse-html-copy-extension/content-sayim.js`. Tablo
 * tanıma ve sütun bulma mantığı birebir korundu; Getir başlıkları
 * değişebildiği için hem başlığa hem gövdeye bakan iki aşamalı tahmin var.
 *
 * Toplu Kopyalama ile aynı sayfada çalışabilir: o sipariş yolunda
 * (`/dashboard/orders`), bu ondan geri kalan her yerde. İkisi aynı anda
 * uyanmasın diye yol koşulu birbirinin tersi.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var BASLIK = 'BARCODE_SAYIM_V1';

    var STIL = [
        '.jba-sayim-kopyala {',
        '  opacity: 0.6; padding: 4px 10px; font-size: 12px; border: 1px solid #4a90e2;',
        '  background: #e8f4f8; color: #4a90e2; border-radius: 4px; cursor: pointer;',
        '  margin: 5px; font-weight: 500; }',
        '.jba-sayim-kopyala:hover { opacity: 1; background: #4a90e2; color: #fff; }',
        '.jba-sayim-kap { display: flex; justify-content: flex-end; padding: 5px; margin-bottom: 10px; }'
    ].join('\n');

    function stilKur() {
        if (document.getElementById('jba-sayim-stil')) return;
        var s = document.createElement('style');
        s.id = 'jba-sayim-stil';
        s.textContent = STIL;
        (document.head || document.documentElement).appendChild(s);
    }

    // ==================================================================
    // Metin yardımcıları
    // ==================================================================

    function sadelestir(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
    function kucuk(s) { return sadelestir(s).toLocaleLowerCase('tr-TR'); }

    // ==================================================================
    // Tablo tanıma
    // ==================================================================

    function basliklarTheadden(tablo) {
        var thead = tablo.querySelector('thead');
        if (!thead) return [];
        return Array.prototype.map.call(thead.querySelectorAll('th'), function (th) {
            var t = th.querySelector('.ant-table-column-title');
            return sadelestir(t ? t.textContent : th.textContent);
        });
    }

    function basliklarYedek(tablo) {
        var ilk = tablo.querySelector('tr');
        if (!ilk) return [];
        return Array.prototype.map.call(ilk.querySelectorAll('th, td'), function (h) {
            return sadelestir(h.textContent);
        });
    }

    function basliklar(tablo) {
        var b = [];
        try { b = basliklarTheadden(tablo); } catch (e) { b = []; }
        return b.length ? b : basliklarYedek(tablo);
    }

    function baslikSayimaBenziyorMu(bas) {
        var k = bas.map(kucuk);
        var adVar = k.some(function (x) {
            return x.indexOf('ürün adı') !== -1 || x.indexOf('urun adi') !== -1 ||
                   (x.indexOf('ürün') !== -1 && x.length < 20) || x === 'ürün' ||
                   x.indexOf('product') !== -1;
        });
        var barkodVar = k.some(function (x) {
            return x.indexOf('barkod') !== -1 || x.indexOf('barcode') !== -1;
        });
        return adVar && barkodVar;
    }

    /** Başlık başka dilde ya da hiç yoksa gövdeye bak: 8-14 haneli sayı barkoddur. */
    function govdeSayimaBenziyorMu(tablo) {
        var satirlar = tablo.querySelectorAll('tbody tr');
        var sayi = 0;
        for (var i = 0; i < satirlar.length && i < 8; i++) {
            if (satirlar[i].classList.contains('ant-table-measure-row')) continue;
            var t = sadelestir(satirlar[i].textContent);
            if (t && t.length > 5 && /\b\d{8,14}\b/.test(t)) sayi++;
        }
        return sayi >= 2;
    }

    function sayimTablosuMu(tablo) {
        if (tablo.closest('.ant-descriptions')) return false;
        var bas = basliklar(tablo);
        if (bas.length >= 2 && baslikSayimaBenziyorMu(bas)) return true;
        return govdeSayimaBenziyorMu(tablo);
    }

    // ==================================================================
    // Sütun bulma
    // ==================================================================

    function sutunlar(tablo) {
        var k = basliklar(tablo).map(kucuk);
        var ad = -1, barkod = -1;
        for (var j = 0; j < k.length; j++) {
            if (ad < 0 && (k[j].indexOf('ürün adı') !== -1 || k[j].indexOf('urun adi') !== -1 ||
                (k[j].indexOf('ürün') !== -1 && k[j].indexOf('barkod') === -1) ||
                k[j].indexOf('product') !== -1)) ad = j;
            if (barkod < 0 && (k[j].indexOf('barkod') !== -1 || k[j].indexOf('barcode') !== -1)) barkod = j;
        }
        if (ad < 0 || barkod < 0) return sutunlariTahminEt(tablo);
        return { ad: ad, barkod: barkod };
    }

    function sutunlariTahminEt(tablo) {
        var tr = tablo.querySelector('tbody tr:not(.ant-table-measure-row)');
        if (!tr) return { ad: -1, barkod: -1 };
        var hucreler = tr.querySelectorAll('td');
        var ad = -1, barkod = -1;
        for (var i = 0; i < hucreler.length; i++) {
            var t = sadelestir(hucreler[i].textContent);
            if (barkod < 0 && /\d{8,14}/.test(t)) barkod = i;
            if (ad < 0 && t.length > 2 && !/^\d{8,14}$/.test(t) && !/^\d+$/.test(t)) ad = i;
        }
        return { ad: ad, barkod: barkod };
    }

    // ==================================================================
    // Ayrıştırma
    // ==================================================================

    function kalemleriCikar(tablo) {
        var s = sutunlar(tablo);
        if (s.ad < 0 || s.barkod < 0) return [];

        var satirlar = tablo.querySelectorAll('tbody tr.ant-table-row');
        if (!satirlar.length) satirlar = tablo.querySelectorAll('tbody tr:not(.ant-table-measure-row)');

        var kalemler = [];
        for (var r = 0; r < satirlar.length; r++) {
            var tr = satirlar[r];
            if (tr.classList.contains('ant-table-measure-row')) continue;
            var hucreler = tr.querySelectorAll('td');
            if (!hucreler.length) continue;

            var ad = hucreler[s.ad] ? sadelestir(hucreler[s.ad].textContent) : '';
            var barkodlar = [];
            var hucre = hucreler[s.barkod];
            if (hucre) {
                // Barkodlar çoğu zaman ayrı etiketler halinde duruyor.
                var etiketler = hucre.querySelectorAll('.ant-tag, span[class*="tag"]');
                for (var t = 0; t < etiketler.length; t++) {
                    var x = sadelestir(etiketler[t].textContent);
                    if (/^\d{8,14}$/.test(x)) barkodlar.push(x);
                }
                if (!barkodlar.length) {
                    var e = sadelestir(hucre.textContent).match(/\d{8,14}/g);
                    if (e) barkodlar = e;
                }
            }

            if (ad || barkodlar.length) {
                kalemler.push({
                    name: ad,
                    barcode: barkodlar.length ? barkodlar[0] : '',
                    barcodes: barkodlar.length ? barkodlar : undefined
                });
            }
        }
        return kalemler;
    }

    function yukHazirla(kalemler) {
        return BASLIK + '\n' + JSON.stringify({
            version: 1,
            source: 'getir-warehouse-sayim',
            generatedAt: new Date().toISOString(),
            itemCount: kalemler.length,
            items: kalemler
        });
    }

    // ==================================================================
    // Düğme yerleştirme
    // ==================================================================

    /**
     * Sipariş tablosu `.ant-row` içinde duruyor, sayım tablosu çoğu ekranda
     * durmuyor. O yüzden yukarı doğru sırayla ant-row, table-wrapper,
     * table-container ve spin-container deneniyor.
     */
    function nereyeKoymali(tablo) {
        var el = tablo;
        while (el && el !== document.body) {
            if (el.classList && el.classList.contains('ant-row') && el.contains(tablo)) {
                return { ust: el.parentNode, once: el };
            }
            el = el.parentElement;
        }
        var adaylar = ['.ant-table-wrapper', '.ant-table-container', '.ant-spin-container'];
        for (var i = 0; i < adaylar.length; i++) {
            var a = tablo.closest(adaylar[i]);
            if (a && a.parentNode) return { ust: a.parentNode, once: a };
        }
        return null;
    }

    function zatenVar(once) {
        var oncekiKardes = once && once.previousElementSibling;
        return !!(oncekiKardes && oncekiKardes.classList &&
                  oncekiKardes.classList.contains('jba-sayim-kap'));
    }

    function dugmeleriKur() {
        var tablolar = document.querySelectorAll('table');
        for (var i = 0; i < tablolar.length; i++) {
            var tablo = tablolar[i];
            if (!sayimTablosuMu(tablo)) continue;

            var yer = nereyeKoymali(tablo);
            if (!yer || !yer.ust || !yer.once || zatenVar(yer.once)) continue;

            var kap = document.createElement('div');
            kap.className = 'jba-sayim-kap';

            var d = document.createElement('button');
            d.type = 'button';
            d.className = 'jba-sayim-kopyala';
            d.textContent = '📋 Tümünü Kopyala';
            d.title = 'Sayım listesini panoya kopyala. Sayım sayfasında Panodan İçe Aktar ile yapıştır.';
            d.addEventListener('click', (function (t) {
                return function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    kopyala(t);
                };
            })(tablo));

            kap.appendChild(d);
            yer.ust.insertBefore(kap, yer.once);
        }
    }

    function kopyala(tablo) {
        var kalemler = kalemleriCikar(tablo);
        if (!kalemler.length) return JBA.bildir('Bu tabloda ürün ya da barkod satırı yok.', 'olumsuz');
        JBA.panoyaYaz(yukHazirla(kalemler)).then(function (oldu) {
            JBA.bildir(oldu ? kalemler.length + ' kalem kopyalandı.' : 'Kopyalanamadı, tekrar dene.',
                       oldu ? 'olumlu' : 'olumsuz');
        });
    }

    /** Panelden çağrılınca sayfadaki ilk sayım tablosunu alır. */
    function ilkTabloyuKopyala() {
        var tablolar = document.querySelectorAll('table');
        for (var i = 0; i < tablolar.length; i++) {
            if (sayimTablosuMu(tablolar[i])) return kopyala(tablolar[i]);
        }
        JBA.bildir('Bu sayfada sayım tablosu bulunamadı.', 'olumsuz');
    }

    // ==================================================================

    JBA.kayit({
        kimlik: 'sayimKopyalama',
        ad: 'Sayım Listesi Kopyalama',
        ozet: 'Depo ve sayım tablolarını barkodlarıyla birlikte panoya alır. Sayım sayfasında yapıştır.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return !yol.includes('/dashboard/orders'); },

        baslat: function (ctx) {
            stilKur();
            dugmeleriKur();
            this._birak = ctx.izle(dugmeleriKur);
        },

        durdur: function () {
            if (this._birak) this._birak();
            document.querySelectorAll('.jba-sayim-kap').forEach(function (e) { e.remove(); });
        },

        eylemler: [
            { ad: 'Sayım listesini kopyala', calistir: ilkTabloyuKopyala }
        ]
    });
})(window);
