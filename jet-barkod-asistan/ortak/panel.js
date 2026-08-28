/**
 * Jet Barkod Asistan. Yüzen düğme ve panel.
 * ============================================================================
 *
 * Sayfada TEK düğme var. Eskiden her eklenti kendi köşesine kendi düğmesini
 * koyuyordu; warehouse'ta üç ayrı yüzen düğme üst üste biniyordu. Artık
 * hepsi tek panelde toplanıyor.
 *
 * Modülün kendi yerinde çalışan arayüzü (tablo satırındaki kopyala düğmesi
 * gibi) yerinde kalır. Panel onların yerine geçmez; hangi modülün ayakta
 * olduğunu gösterir ve bağlama bağlı olmayan eylemleri sunar.
 *
 * Tamamı gölge DOM içinde, sayfanın stilini ne bozar ne ondan etkilenir.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var acik = false;
    var panelEl = null;
    var dugmeEl = null;

    function ciz() {
        var kok = JBA.golgeKok();
        var kap = JBA.arayuzKabi(kok);

        panelEl = document.createElement('div');
        panelEl.className = 'panel';
        panelEl.hidden = true;

        dugmeEl = document.createElement('button');
        dugmeEl.type = 'button';
        dugmeEl.className = 'dugme';
        dugmeEl.innerHTML =
            '<span class="dugme__nokta"></span>' +
            '<span>Jet Barkod</span>' +
            '<span class="dugme__sayi"></span>';

        dugmeEl.addEventListener('click', function () {
            acik = !acik;
            panelEl.hidden = !acik;
            if (acik) tazele();
        });

        // Panel dışına tıklayınca kapansın. Gölge kökün dışındaki tıklamalar
        // buraya composedPath ile ulaşıyor.
        document.addEventListener('click', function (e) {
            if (!acik) return;
            var yol = e.composedPath ? e.composedPath() : [];
            if (yol.indexOf(panelEl) > -1 || yol.indexOf(dugmeEl) > -1) return;
            acik = false;
            panelEl.hidden = true;
        }, true);

        // Bildirimler her zaman en altta kalsın diye panel onların üstüne giriyor.
        kap.insertBefore(panelEl, kap.firstChild);
        kap.appendChild(dugmeEl);
    }

    function tazele() {
        if (!panelEl) return;

        var satirlar = JBA.calisanlar.map(function (c) {
            var durum = c.hata ? 'bozuk' : (c.calisiyor ? '' : 'uyku');
            var eylemler = (c.modul.eylemler || []).map(function (e, i) {
                return '<button type="button" class="eylem" data-modul="' + c.modul.kimlik +
                       '" data-eylem="' + i + '">' + kacir(e.ad) + '</button>';
            }).join('');
            return '<div class="modul">' +
                '<div class="modul__ust">' +
                '  <span class="modul__nokta ' + durum + '"></span>' +
                '  <span class="modul__ad">' + kacir(c.modul.ad) + '</span>' +
                '</div>' +
                '<p class="modul__ozet">' +
                (c.hata ? 'Bu modül hata verdi, diğerleri çalışmaya devam ediyor.'
                        : kacir(c.modul.ozet || '')) +
                '</p>' +
                (eylemler ? '<div class="eylemler">' + eylemler + '</div>' : '') +
                '</div>';
        }).join('');

        panelEl.innerHTML =
            '<div class="panel__bas">' +
            '  <span class="panel__ad">Jet Barkod Asistan</span>' +
            '  <span class="panel__yer">' + kacir(location.hostname) + '</span>' +
            '</div>' +
            (satirlar || '<p class="bos">Bu sayfada çalışan bir modül yok. Modüller yalnızca ' +
                         'ilgili panellerde uyanır.</p>');

        panelEl.querySelectorAll('.eylem').forEach(function (d) {
            d.addEventListener('click', function () {
                var c = JBA.calisanlar.filter(function (x) { return x.modul.kimlik === d.dataset.modul; })[0];
                if (!c) return;
                var e = c.modul.eylemler[Number(d.dataset.eylem)];
                if (e) JBA.korumali(c.modul.kimlik + ' eylemi', function () { e.calistir(); });
            });
        });
    }

    function kacir(m) {
        return String(m == null ? '' : m)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** Yükleyici modülleri çalıştırdıktan sonra çağırır. */
    function goster() {
        JBA.korumali('panel', function () {
            var ayakta = JBA.calisanlar.filter(function (c) { return c.calisiyor; }).length;
            // Bu sayfada hiç modül yoksa düğmeyi hiç koyma. Boş düğme
            // sayfayı kirletmekten başka bir işe yaramaz.
            if (!JBA.calisanlar.length) return;
            if (!panelEl) ciz();
            dugmeEl.querySelector('.dugme__sayi').textContent = ayakta;
            dugmeEl.querySelector('.dugme__nokta').style.background =
                JBA.calisanlar.some(function (c) { return c.hata; }) ? '#fca5a5' : '#86efac';
            tazele();
        });
    }

    JBA.panel = { goster: goster, tazele: tazele };
})(window);
