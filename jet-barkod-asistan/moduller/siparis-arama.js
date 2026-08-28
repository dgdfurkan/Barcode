/**
 * Modül: Sipariş İçi Ürün Arama
 * ============================================================================
 *
 * warehouse.getir.com sipariş panelinde bir arama kutusu açar. Ürün adı ya
 * da barkod yazınca aktif siparişlerin tamamı taranır, içinde o ürün geçen
 * siparişler listelenir. Sonuca tıklayınca ilgili kart açılır.
 *
 * Kaynağı `getir-warehouse-orders-search-extension`. Üç değişiklik var:
 *
 * 1. `cookies` İZNİ KALKTI
 *    Eski eklenti hem sayfa bağlamından hem de arka plandan istek atmayı
 *    biliyordu. Arka plan yolu `chrome.cookies` istiyordu ama içerik
 *    betiği ona hiç `FETCH_ORDERS` göndermiyordu, yani ölü koddu. Sayfa
 *    bağlamı yolu sayfanın kendi oturumunu kullandığı için zaten yeterli.
 *    Ölü yol atıldı, izin de onunla gitti.
 *
 * 2. SAYFA BAĞLAMI ARTIK MANIFEST'TEN
 *    `chrome.runtime.getURL` ile script etiketi enjekte etmek yerine
 *    manifest'te `world: MAIN`. Böylece `web_accessible_resources` da
 *    gerekmiyor; eklentinin dosyaları dışarıya hiç açılmıyor.
 *
 * 3. KARTLARI TEK TEK AÇAN YEDEK YOL ATILDI
 *    `runSearchByClickingCards` her siparişin modalını açıp kapatıyordu.
 *    Kodda duruyordu ama hiçbir yerden çağrılmıyordu; ona bağlı yarım
 *    düzine yardımcıyla birlikte silindi.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var KOK_KIMLIK = 'jba-siparis-root';

    var STIL = `/* Sipariş içi ürün arama - breadcrumb ile aynı satır, minimal (üst panel konumu korunur) */

.jba-siparis-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 37px;
}

.jba-siparis-bar-wrap {
  position: relative;
  display: inline-flex;
  margin-left: auto;
}

.jba-siparis-root {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 28px;
}

.jba-siparis-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
}

.jba-siparis-input {
  width: 180px;
  height: 28px;
  padding: 0 8px 0 28px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  background: #fafafa url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23bfbfbf' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 8px 50%;
  background-size: 12px;
  color: #262626;
}

.jba-siparis-input::placeholder {
  color: #bfbfbf;
}

.jba-siparis-input:hover {
  border-color: #d9d9d9;
  background-color: #fff;
}

.jba-siparis-input:focus {
  border-color: #1890ff;
  background-color: #fff;
  box-shadow: 0 0 0 1px rgba(24, 144, 255, 0.2);
}

.jba-siparis-btn {
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.jba-siparis-btn:active {
  opacity: 0.9;
}

.jba-siparis-btn--scan {
  background: #1890ff;
  color: #fff;
}

.jba-siparis-btn--scan:hover:not(:disabled) {
  background: #40a9ff;
}

.jba-siparis-btn--scan:disabled {
  background: #d9d9d9;
  color: #fff;
  cursor: not-allowed;
}

.jba-siparis-btn--clear {
  background: transparent;
  color: #8c8c8c;
  border: 1px solid #e8e8e8;
}

.jba-siparis-btn--clear:hover {
  color: #262626;
  border-color: #d9d9d9;
}

.jba-siparis-status {
  font-size: 11px;
  color: #8c8c8c;
  margin-left: 4px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Sonuç paneli - barın altında, minimal */
.jba-siparis-results {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-height: 320px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 9999;
}

.jba-siparis-results--empty {
  padding: 16px;
  text-align: center;
  color: #8c8c8c;
  font-size: 12px;
}

.jba-siparis-results-list {
  overflow-y: auto;
  flex: 1;
}

.jba-siparis-result-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  border: none;
  border-bottom: 1px solid #f5f5f5;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s;
}

.jba-siparis-result-item:hover {
  background: #f5f9ff;
}

.jba-siparis-result-item:last-child {
  border-bottom: none;
}

.jba-siparis-result-order-id {
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 2px;
}

.jba-siparis-result-products {
  color: #595959;
  font-size: 11px;
  line-height: 1.35;
}

.jba-siparis-results-header {
  padding: 6px 12px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  font-size: 11px;
  font-weight: 600;
  color: #262626;
}

.jba-siparis-progress {
  padding: 8px 12px;
  font-size: 12px;
  color: #1890ff;
}

.jba-siparis-root .jba-siparis-results[hidden] {
  display: none !important;
}
`;

    function stilKur() {
        if (document.getElementById('jba-siparis-stil')) return;
        var s = document.createElement('style');
        s.id = 'jba-siparis-stil';
        s.textContent = STIL;
        (document.head || document.documentElement).appendChild(s);
    }

    // ==================================================================
    // Veri
    // ==================================================================

    /** Adresten depo kimliği: /r/<id>/dashboard/orders */
    function depoKimligi() {
        var m = location.pathname.match(/\/r\/([a-f0-9]+)\//);
        return m ? m[1] : null;
    }

    /**
     * Siparişleri sayfa bağlamındaki köprüden ister. Köprü sayfanın kendi
     * oturumunu kullanıyor; biz içerik betiğinden aynı isteği atsak çerez
     * gitmezdi.
     */
    function siparisleriGetir(depo, ilerleme) {
        return new Promise(function (coz, red) {
            var zamanAsimi = setTimeout(function () {
                global.removeEventListener('message', dinle);
                red(new Error('Zaman aşımı'));
            }, 120000);

            function dinle(e) {
                if (e.source !== global || !e.data) return;
                if (e.data.type === 'JB_SIPARIS_ILERLEME' && ilerleme) {
                    ilerleme(e.data.current, e.data.total);
                }
                if (e.data.type === 'JB_SIPARIS_SONUC') {
                    clearTimeout(zamanAsimi);
                    global.removeEventListener('message', dinle);
                    if (e.data.error) return red(new Error(e.data.error));
                    coz(e.data.data || []);
                }
            }

            global.addEventListener('message', dinle);
            global.postMessage({ type: 'JB_SIPARIS_GETIR', warehouseId: depo }, location.origin);
        });
    }

    // ==================================================================
    // Arayüz
    // ==================================================================

    function kacir(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : s;
        return d.innerHTML;
    }

    function arayuzuKur() {
        if (document.getElementById(KOK_KIMLIK)) return;

        var iz = document.querySelector('nav.ant-breadcrumb') ||
                 document.querySelector('[class*="breadcrumb"]');
        if (!iz) return;

        var kok = document.createElement('div');
        kok.className = 'jba-siparis-root';
        kok.id = KOK_KIMLIK;

        var kutu = document.createElement('div');
        kutu.className = 'jba-siparis-wrap';

        var girdi = document.createElement('input');
        girdi.type = 'text';
        girdi.placeholder = 'Ürün veya barkod ara...';
        girdi.className = 'jba-siparis-input';
        girdi.autocomplete = 'off';

        var araDugme = document.createElement('button');
        araDugme.type = 'button';
        araDugme.className = 'jba-siparis-btn jba-siparis-btn--scan';
        araDugme.textContent = 'Ara';

        var temizleDugme = document.createElement('button');
        temizleDugme.type = 'button';
        temizleDugme.className = 'jba-siparis-btn jba-siparis-btn--clear';
        temizleDugme.textContent = 'Temizle';

        var durum = document.createElement('span');
        durum.className = 'jba-siparis-status';

        var sonuc = document.createElement('div');
        sonuc.className = 'jba-siparis-results';
        sonuc.hidden = true;

        kutu.appendChild(girdi);
        kutu.appendChild(araDugme);
        kutu.appendChild(temizleDugme);
        kok.appendChild(kutu);
        kok.appendChild(durum);

        var sarmal = document.createElement('div');
        sarmal.className = 'jba-siparis-bar-wrap';
        sarmal.appendChild(kok);
        sarmal.appendChild(sonuc);

        var ust = iz.parentElement;
        if (ust) {
            var satir = document.createElement('div');
            satir.className = 'jba-siparis-row';
            ust.insertBefore(satir, iz);
            satir.appendChild(iz);
            satir.appendChild(sarmal);
        } else {
            document.body.insertBefore(sarmal, document.body.firstChild);
        }

        function durumYaz(t) { durum.textContent = t; }

        function sonuclariGoster(eslesenler) {
            sonuc.hidden = false;
            sonuc.innerHTML = '';

            if (!eslesenler || !eslesenler.length) {
                var bos = document.createElement('div');
                bos.className = 'jba-siparis-results--empty';
                bos.textContent = 'Eşleşen sipariş bulunamadı.';
                sonuc.appendChild(bos);
                return;
            }

            var bas = document.createElement('div');
            bas.className = 'jba-siparis-results-header';
            bas.textContent = eslesenler.length + ' sipariş bulundu';
            sonuc.appendChild(bas);

            var liste = document.createElement('div');
            liste.className = 'jba-siparis-results-list';

            eslesenler.forEach(function (m) {
                var d = document.createElement('button');
                d.type = 'button';
                d.className = 'jba-siparis-result-item';
                var urunler = (m.products || []).slice(0, 3).map(function (p) { return p.name; }).join(' · ');
                d.innerHTML =
                    '<div class="jba-siparis-result-order-id">' + kacir(m.orderLabel || m.orderId) + '</div>' +
                    '<div class="jba-siparis-result-products">' + kacir(urunler) +
                    ((m.products && m.products.length > 3) ? ' ...' : '') + '</div>';
                d.addEventListener('click', function () { kartaGit(m); });
                liste.appendChild(d);
            });

            sonuc.appendChild(liste);
        }

        /** Sonuca tıklanınca ilgili sipariş kartını bulup açar. */
        function kartaGit(m) {
            var kart = null;
            if (m.orderId) {
                var son4 = m.orderId.slice(-4);
                var adi = (m.orderLabel || '').split(' - ')[0];
                var kartlar = document.querySelectorAll('[class*="orderCard"]');
                for (var i = 0; i < kartlar.length; i++) {
                    var metin = kartlar[i].textContent || '';
                    if (metin.indexOf(son4) !== -1 || (adi && metin.indexOf(adi) !== -1)) {
                        kart = kartlar[i];
                        break;
                    }
                }
            }
            if (!kart) kart = document.querySelector('[class*="orderCard"][data-testid="' + m.orderId + '"]');
            if (!kart) return JBA.bildir('Sipariş kartı ekranda bulunamadı.', 'olumsuz');
            kart.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(function () { kart.click(); }, 300);
        }

        function ara() {
            var sorgu = (girdi.value || '').trim();
            if (!sorgu) return durumYaz('Ürün adı ya da barkod gir.');

            var depo = depoKimligi();
            if (!depo) return durumYaz('Bu sayfada arama yapılamıyor, depo bilgisi yok.');

            araDugme.disabled = true;
            durumYaz('Siparişler alınıyor...');

            var ilerlemeEl = document.createElement('div');
            ilerlemeEl.className = 'jba-siparis-progress';
            sonuc.innerHTML = '';
            sonuc.appendChild(ilerlemeEl);
            sonuc.hidden = false;

            siparisleriGetir(depo, function (simdi, toplam) {
                ilerlemeEl.textContent = toplam
                    ? 'Siparişler alınıyor (' + simdi + '/' + toplam + ')...'
                    : 'Siparişler alınıyor...';
            }).then(function (hepsi) {
                var kucuk = sorgu.toLowerCase();
                var eslesenler = (hepsi || []).filter(function (o) {
                    return (o.products || []).some(function (p) {
                        return (p.name && p.name.toLowerCase().indexOf(kucuk) !== -1) ||
                               (p.barcode && String(p.barcode).indexOf(sorgu) !== -1);
                    });
                });
                durumYaz(eslesenler.length ? eslesenler.length + ' sipariş bulundu.' : 'Eşleşme yok.');
                sonuclariGoster(eslesenler);
                araDugme.disabled = false;
            }, function (e) {
                durumYaz('Veri alınamadı.');
                sonuc.innerHTML = '<div class="jba-siparis-results--empty">Siparişler alınamadı: ' +
                    kacir((e && e.message) || 'Bilinmeyen hata') +
                    '<br><small>Sayfayı yenileyip tekrar dene; istek şablonu sayfa yüklenirken kopyalanıyor.</small></div>';
                sonuc.hidden = false;
                araDugme.disabled = false;
            });
        }

        araDugme.addEventListener('click', ara);
        girdi.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); ara(); }
        });
        temizleDugme.addEventListener('click', function () {
            girdi.value = '';
            sonuc.hidden = true;
            durumYaz('');
        });
    }

    // ==================================================================

    JBA.kayit({
        kimlik: 'siparisUrunArama',
        ad: 'Sipariş İçi Ürün Arama',
        ozet: 'Aktif siparişleri tarar, aradığın ürün hangi siparişteyse onu listeler.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return yol.indexOf('/dashboard/orders') !== -1; },

        baslat: function (ctx) {
            stilKur();
            arayuzuKur();
            this._birak = ctx.izle(arayuzuKur);
        },

        durdur: function () {
            if (this._birak) this._birak();
            var k = document.getElementById(KOK_KIMLIK);
            if (k && k.parentNode) k.parentNode.remove();
        },

        eylemler: [
            { ad: 'Arama kutusuna git', calistir: function () {
                var g = document.querySelector('.jba-siparis-input');
                if (g) { g.scrollIntoView({ block: 'center' }); g.focus(); }
                else JBA.bildir('Arama kutusu bu sayfada yok.', 'olumsuz');
            } }
        ]
    });
})(window);
