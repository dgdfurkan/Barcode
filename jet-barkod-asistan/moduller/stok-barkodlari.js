/**
 * Modül: Stok Barkodları
 * ============================================================================
 *
 * franchise.getir.com stok tablosundaki ürün görsel adreslerini satır
 * sırasını bozmadan panoya alır. Jet Barkod arama kutusuna yapıştırınca
 * adresler barkoda çözülüyor; sıra korunduğu için eşleştirme şaşmıyor.
 *
 * Kopyalamadan önce iki filtre soruluyor: inaktif satırlar ve stoğu sıfır
 * olanlar. İkisi de varsayılan olarak eleniyor.
 *
 * Kaynağı `getir-stock-barcodes-extension/content.js`. Görsel adresi tanıma
 * ve sütun bulma mantığı birebir korundu. Değişenler:
 *
 *   - Kendi modalları yok, çekirdeğin gölge DOM diyaloğu. Eskiden sayfaya
 *     kendi kutusunu enjekte ediyordu ve Ant Design modalıyla z-index
 *     yarışına giriyordu.
 *   - `window.alert` yok. Sayfayı kilitleyen uyarı yerine bildirim.
 *   - 1,5 saniyede bir 40 kez deneyen zamanlayıcı yok. Çekirdeğin tek
 *     gözlemcisi araç çubuğu geldiği anda haber veriyor; hem daha hızlı
 *     hem sayfa geç açılırsa pes etmiyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var KAP_KIMLIK = 'jba-stok-barkod-kap';
    var ETIKET = 'Barkodları kopyala';

    var STIL = [
        '#jba-stok-barkod-kap { display: inline-flex; align-items: center; gap: 4px;',
        '  margin-left: 6px; vertical-align: middle; }',
        '.jba-stok-barkod-btn { margin: 0; padding: 1px 6px; font-size: 10px; line-height: 1.35;',
        '  cursor: pointer; border: 1px solid rgba(0,0,0,0.14); border-radius: 4px;',
        '  background: rgba(255,255,255,0.9); color: inherit; vertical-align: middle;',
        '  box-sizing: border-box; -webkit-appearance: none; appearance: none; white-space: nowrap; }',
        '.jba-stok-barkod-btn:hover { background: #fff; border-color: rgba(0,0,0,0.28); }',
        '.jba-stok-barkod-sayi { font-size: 10px; opacity: 0.55; max-width: 140px;',
        '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }'
    ].join('\n');

    function stilKur() {
        if (document.getElementById('jba-stok-barkod-stil')) return;
        var s = document.createElement('style');
        s.id = 'jba-stok-barkod-stil';
        s.textContent = STIL;
        (document.head || document.documentElement).appendChild(s);
    }

    // ==================================================================
    // Görsel adresi tanıma
    // ==================================================================

    function urunGorseliMi(src) {
        if (!src || src.indexOf('http') !== 0) return false;
        if (src.indexOf('cdn-image.getir.com/market/product') !== -1) return true;
        if (src.indexOf('cdn.getir.com/product') !== -1) return true;
        // Görseli olmayan üründe yer tutucu geliyor, o da geçerli sayılır.
        if (src.indexOf('cdn.getir.com/misc/') !== -1 &&
            /\.(jpe?g|png|gif|webp)(\?|$)/i.test(src)) return true;
        // Depo ve ERP'den yüklenen görseller (uuid'li dosya adı).
        if (src.indexOf('vsrm-cdn.erp.getirapi.com/docs/') !== -1) return true;
        return false;
    }

    function satirinGorseli(tr) {
        if (!tr || tr.classList.contains('ant-table-measure-row')) return null;
        var gorseller = tr.querySelectorAll('img[src]');
        for (var i = 0; i < gorseller.length; i++) {
            var src = (gorseller[i].getAttribute('src') || '').trim();
            if (urunGorseliMi(src)) return gorseller[i];
        }
        return null;
    }

    /** Başlıktan Stok ve Statü sütunlarının yerini bulur. */
    function sutunlar() {
        var basliklar = document.querySelectorAll('.ant-table-thead th.ant-table-cell');
        var stok = -1, statu = -1;
        for (var i = 0; i < basliklar.length; i++) {
            var t = (basliklar[i].textContent || '').replace(/\s+/g, ' ').trim();
            if (t === 'Stok') stok = i;
            if (t === 'Statü' || t === 'Statu') statu = i;
        }
        return { stok: stok, statu: statu };
    }

    function elenirMi(tr, secim, sut) {
        if (!tr || tr.classList.contains('ant-table-measure-row')) return true;
        var hucreler = tr.querySelectorAll('td');
        if (!hucreler.length) return true;

        if (secim.inaktif && sut.statu >= 0 && hucreler[sut.statu]) {
            var st = (hucreler[sut.statu].textContent || '').trim();
            if (st.indexOf('İnaktif') !== -1 || st.indexOf('Inaktif') !== -1) return true;
        }

        if (secim.sifirStok && sut.stok >= 0 && hucreler[sut.stok]) {
            var ham = (hucreler[sut.stok].textContent || '').trim();
            var sayi = ham.replace(/[^\d.,-]/g, '').replace(',', '.');
            var n = parseFloat(sayi);
            if (ham === '' || ham === '-' || (sayi !== '' && !isNaN(n) && n === 0)) return true;
        }

        return false;
    }

    /** Ekrandaki sayfanın satırlarını gezip görsel adreslerini sırayla toplar. */
    function adresleriTopla(secim) {
        secim = secim || {};
        var filtreVar = secim.inaktif === true || secim.sifirStok === true;
        var sut = filtreVar ? sutunlar() : { stok: -1, statu: -1 };

        var cikti = [];
        var govdeler = document.querySelectorAll('.ant-table-tbody');
        for (var t = 0; t < govdeler.length; t++) {
            var satirlar = govdeler[t].querySelectorAll(':scope > tr');
            for (var r = 0; r < satirlar.length; r++) {
                var tr = satirlar[r];
                if (filtreVar) {
                    if (elenirMi(tr, secim, sut)) continue;
                } else if (tr.classList.contains('ant-table-measure-row')) {
                    continue;
                }
                var g = satirinGorseli(tr);
                if (!g) continue;
                var src = (g.getAttribute('src') || '').trim();
                if (src) cikti.push(src);
            }
        }
        return cikti;
    }

    // ==================================================================
    // Kopyalama
    // ==================================================================

    function kopyala(dugme, adresler) {
        var metin = adresler.join(', ');
        JBA.panoyaYaz(metin).then(function (oldu) {
            if (oldu) {
                dugme.textContent = 'Kopyalandı';
                setTimeout(function () { dugme.textContent = ETIKET; }, 1600);
                JBA.bildir(adresler.length + ' adres panoda.', 'olumlu');
                return;
            }
            // Pano tamamen engelliyse elle kopyalanabilsin diye kutuda göster.
            JBA.diyalog({
                baslik: 'Pano engellendi',
                aciklama: 'Tarayıcı panoya yazmamıza izin vermedi. Aşağıdaki kutudan elle kopyala.',
                metin: metin,
                onayEtiketi: 'Kapat'
            });
        });
    }

    function kopyalamayiBaslat(dugme) {
        var hepsi = adresleriTopla({});
        if (!hepsi.length) {
            return JBA.bildir('Tabloda ürün görseli bulunamadı. Liste yüklenene kadar bekle.', 'olumsuz');
        }

        JBA.diyalog({
            baslik: 'Kopyalama seçenekleri',
            aciklama: 'İşaretli seçeneklerdeki satırlar panoya alınmaz. Kopyalama yalnızca ekrandaki ' +
                      'sayfa için geçerli; çok sayfalı listede her sayfayı ayrı kopyala.',
            secenekler: [
                { kimlik: 'inaktif', etiket: 'İnaktifleri kopyalama (Statü: İnaktif)', varsayilan: true },
                { kimlik: 'sifirStok', etiket: 'Stokta olmayanları kopyalama (Stok = 0)', varsayilan: true }
            ],
            onayEtiketi: 'Kopyala',
            onay: function (secim) {
                var adresler = adresleriTopla(secim);
                if (!adresler.length) {
                    return JBA.bildir('Filtrelerden sonra satır kalmadı. Kutuları kaldırıp tekrar dene.', 'olumsuz');
                }
                kopyala(dugme, adresler);
            }
        });
    }

    // ==================================================================
    // Düğme yerleştirme
    // ==================================================================

    /** Araç çubuğunda düğmenin gireceği yeri arar. Getir sınıf adları değişebiliyor. */
    function cubuktaYer() {
        var rozet = document.querySelector('[class*="totalBadge"]');
        if (rozet && rozet.parentNode) return { ust: rozet.parentNode, once: rozet.nextSibling };

        var sol = document.querySelector('[class*="leftContainer"]');
        if (sol) return { ust: sol, once: null };

        var getir = document.getElementById('BRING_BUTTON');
        if (getir && getir.parentNode) return { ust: getir.parentNode, once: getir.nextSibling };

        var esnek = document.querySelector('[class*="flexContainer-"] button.ant-btn-primary');
        if (esnek && esnek.parentNode) return { ust: esnek.parentNode, once: esnek.nextSibling };

        return null;
    }

    function dugmeyiKur() {
        if (document.getElementById(KAP_KIMLIK)) return;
        var yer = cubuktaYer();
        if (!yer) return;

        var kap = document.createElement('span');
        kap.id = KAP_KIMLIK;

        var dugme = document.createElement('button');
        dugme.type = 'button';
        dugme.className = 'jba-stok-barkod-btn';
        dugme.textContent = ETIKET;
        dugme.setAttribute('aria-label', 'Tablodaki ürün görsel adreslerini kopyala');

        var sayi = document.createElement('span');
        sayi.className = 'jba-stok-barkod-sayi';

        function sayiyiTazele() {
            var n = adresleriTopla({}).length;
            sayi.textContent = n ? n + ' adres (sayfa)' : '';
            dugme.title = n
                ? n + ' adres. Yalnızca ekrandaki sayfa satırları; üstteki toplam tüm listeyi gösterebilir.'
                : 'Tabloda satır ya da görsel yok';
        }

        dugme.addEventListener('mouseenter', sayiyiTazele, { passive: true });
        dugme.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            kopyalamayiBaslat(dugme);
        });

        kap.appendChild(dugme);
        kap.appendChild(sayi);
        if (yer.once) yer.ust.insertBefore(kap, yer.once);
        else yer.ust.appendChild(kap);

        sayiyiTazele();
    }

    // ==================================================================

    JBA.kayit({
        kimlik: 'stokBarkodlari',
        ad: 'Stok Barkodları',
        ozet: 'Stok tablosundaki ürün görsel adreslerini sırayla kopyalar. Jet Barkod arama kutusuna yapıştır.',
        hostlar: ['franchise.getir.com'],

        baslat: function (ctx) {
            stilKur();
            dugmeyiKur();
            // Araç çubuğu tek sayfa uygulamasında geç geliyor. Eski sürüm
            // 1,5 saniyede bir 40 kez deneyip pes ediyordu; tek gözlemci
            // hem daha hızlı yakalıyor hem de geç açılan sayfayı kaçırmıyor.
            this._birak = ctx.izle(dugmeyiKur);
        },

        durdur: function () {
            if (this._birak) this._birak();
            var k = document.getElementById(KAP_KIMLIK);
            if (k) k.remove();
        },

        eylemler: [
            { ad: 'Barkodları kopyala', calistir: function () {
                var d = document.querySelector('.jba-stok-barkod-btn');
                if (d) return d.click();
                kopyalamayiBaslat(document.createElement('button'));
            } }
        ]
    });
})(window);
