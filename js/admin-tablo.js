/**
 * Admin tabloları: mobilde kart görünümü için başlık etiketleri
 * ============================================================================
 *
 * NEDEN VAR
 * Panelde sekiz tablo var. Dar ekranda `thead` gizlenip her satır bir karta
 * dönüşüyor; kartın okunabilmesi için her hücrenin hangi sütuna ait olduğunu
 * söylemesi gerekiyor. Bu bilgi `data-label` özniteliğinde duruyor ve CSS onu
 * `content: attr(data-label)` ile basıyor.
 *
 * Eskiden yalnız kullanıcı tablosunda elle yazılmış `data-label`'lar vardı.
 * Kalan yedi tablo dar ekranda başlıksız hücre yığınına dönüşüyor, 322 piksel
 * genişliğinde bir kapta 1014 piksellik tabloyu yatay kaydırarak okumak
 * gerekiyordu.
 *
 * NEDEN JS
 * Tabloların gövdesi `admin.js` tarafından `innerHTML` ile yazılıyor. HTML'e
 * elle eklenen öznitelik ilk çizimde siliniyor. Bu yüzden etiketler `thead`
 * başlıklarından okunup her çizimden sonra yeniden yazılıyor.
 *
 * Gözlemci `tbody` değişimlerini izliyor; sekme değiştirildiğinde ya da tablo
 * yeniden doldurulduğunda etiketler kendiliğinden yerine oturuyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var KAPSAM = '.adm-workspace table, .adm-table-wrap table';

    function basliklar(tablo) {
        var satir = tablo.querySelector('thead tr');
        if (!satir) return null;
        return Array.prototype.map.call(satir.children, function (h) {
            return (h.textContent || '').replace(/\s+/g, ' ').trim();
        });
    }

    function tabloyuEtiketle(tablo) {
        var basliklarDizisi = basliklar(tablo);
        if (!basliklarDizisi || !basliklarDizisi.length) return;

        var govde = tablo.tBodies && tablo.tBodies[0];
        if (!govde) return;

        Array.prototype.forEach.call(govde.rows, function (satir) {
            /* Tek hücreli "kayıt yok" satırları etiketlenmiyor: onlar veri
               değil, boş durum mesajı. */
            if (satir.cells.length === 1 && satir.cells[0].colSpan > 1) {
                satir.cells[0].setAttribute('data-bos', '1');
                return;
            }
            Array.prototype.forEach.call(satir.cells, function (hucre, i) {
                if (hucre.hasAttribute('data-label')) return;
                var etiket = basliklarDizisi[i];
                /* Başlığı boş sütun (eylem düğmeleri gibi) etiket almıyor,
                   yoksa kartta boş bir satır başlığı beliriyor. */
                hucre.setAttribute('data-label', etiket || '');
            });
        });
    }

    function hepsiniEtiketle(kok) {
        var alan = kok || document;
        var tablolar = alan.querySelectorAll ? alan.querySelectorAll(KAPSAM) : [];
        Array.prototype.forEach.call(tablolar, tabloyuEtiketle);
    }

    /* Çizim sırasında art arda birçok mutasyon geliyor; hepsini tek turda
       toplayıp bir kez çalışıyoruz. */
    var bekleyen = null;
    function ertele() {
        if (bekleyen) return;
        /* `requestAnimationFrame` değil: sekme arka plandayken hiç
           çalışmıyor ve tablo etiketsiz kalıyor. `setTimeout` gizli
           sekmede de ilerliyor. */
        bekleyen = setTimeout(function () {
            bekleyen = null;
            hepsiniEtiketle(document);
        }, 0);
    }

    function baslat() {
        hepsiniEtiketle(document);
        try {
            var gozlemci = new MutationObserver(function (kayitlar) {
                for (var i = 0; i < kayitlar.length; i++) {
                    var h = kayitlar[i].target;
                    if (h && h.closest && h.closest('table')) { ertele(); return; }
                }
            });
            gozlemci.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* gözlemci yoksa ilk tur yine de çalıştı */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }

    global.JBAdminTablo = { etiketle: hepsiniEtiketle };
})(window);
