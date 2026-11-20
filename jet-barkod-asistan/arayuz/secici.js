/**
 * Jet Barkod Asistan penceresi: tarayıcı açılır listesi yerine özel seçici.
 * ============================================================================
 *
 * Kural: arayüzde tarayıcının açılır listesi (select) görünmez. Her
 * select.ayar__secim gizlenir, yerine:
 *   - kısa listelerde (en çok 4 seçenek, yazılar kısa) yan yana düğme grubu,
 *   - uzun listelerde (ses listesi gibi, gruplu olabilir) özel açılır panel.
 *
 * Asıl select yerinde (gizli) kalır ve tek gerçek kaynak odur: kapi.js
 * değerini okumaya, `change` olayını dinlemeye devam eder. Seçim yapılınca
 * select.value yazılır ve `change` gönderilir. kapi.js değeri kod içinden
 * yazarsa (select.value = ...) görünüm kendiliğinden tazelenir.
 * ============================================================================
 */
(function () {
    'use strict';

    var deger = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    var OK = '<svg class="sc__ok" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>';
    var ISARET = '<svg class="sc__isaret" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3.2L15 7"/></svg>';
    var sayac = 0;
    var acikOlan = null;

    function secenekler(sel) {
        return Array.prototype.map.call(sel.options, function (o) {
            return { deger: o.value, yazi: o.textContent, grup: o.parentElement && o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '' };
        });
    }

    function kisaMi(sel) {
        var l = secenekler(sel);
        if (!l.length || l.length > 4 || sel.querySelector('optgroup')) return false;
        var uzunluk = l.reduce(function (t, x) { return t + x.yazi.length; }, 0);
        return uzunluk <= 40;
    }

    function degeriYaz(sel, v) {
        if (deger.get.call(sel) === v) return;
        deger.set.call(sel, v);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /* Kod içinden select.value yazılınca görünüm de güncellensin */
    function degerIzle(sel, ciz) {
        Object.defineProperty(sel, 'value', {
            configurable: true,
            get: function () { return deger.get.call(this); },
            set: function (v) { deger.set.call(this, v); ciz(); }
        });
    }

    // ------------------------------------------------------------------
    // Düğme grubu
    // ------------------------------------------------------------------
    function grupKur(sel) {
        var kap = document.createElement('div');
        kap.className = 'secim';
        kap.setAttribute('role', 'radiogroup');
        if (sel.getAttribute('aria-label')) kap.setAttribute('aria-label', sel.getAttribute('aria-label'));
        else if (sel.id && document.querySelector('label[for="' + sel.id + '"]')) kap.setAttribute('aria-label', document.querySelector('label[for="' + sel.id + '"]').textContent);
        function ciz() {
            kap.innerHTML = '';
            secenekler(sel).forEach(function (x) {
                var b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('role', 'radio');
                b.setAttribute('aria-checked', String(x.deger === deger.get.call(sel)));
                b.textContent = x.yazi;
                b.addEventListener('click', function () { degeriYaz(sel, x.deger); ciz(); });
                kap.appendChild(b);
            });
        }
        ciz();
        degerIzle(sel, ciz);
        sel.addEventListener('change', ciz);
        return kap;
    }

    // ------------------------------------------------------------------
    // Açılır panel
    // ------------------------------------------------------------------
    function panelKur(sel) {
        var kimlik = 'sc' + (++sayac);
        var kap = document.createElement('div');
        kap.className = 'sc';
        var dugme = document.createElement('button');
        dugme.type = 'button';
        dugme.className = 'sc__dugme';
        dugme.setAttribute('aria-haspopup', 'listbox');
        dugme.setAttribute('aria-expanded', 'false');
        dugme.setAttribute('aria-controls', kimlik);
        var etiket = sel.getAttribute('aria-label') || (sel.id && document.querySelector('label[for="' + sel.id + '"]') ? document.querySelector('label[for="' + sel.id + '"]').textContent : '');
        if (etiket) dugme.setAttribute('aria-label', etiket);
        var liste = document.createElement('ul');
        liste.className = 'sc__liste is-asagi';
        liste.id = kimlik;
        liste.setAttribute('role', 'listbox');
        kap.appendChild(dugme);
        kap.appendChild(liste);
        var odak = -1;

        function seciliYazi() {
            var v = deger.get.call(sel);
            var x = secenekler(sel).filter(function (s) { return s.deger === v; })[0];
            return x ? x.yazi : '';
        }
        function dugmeCiz() { dugme.innerHTML = '<span class="sc__yazi"></span>' + OK; dugme.firstChild.textContent = seciliYazi(); }
        function listeCiz() {
            liste.innerHTML = '';
            var sonGrup = null;
            secenekler(sel).forEach(function (x, i) {
                if (x.grup && x.grup !== sonGrup) {
                    sonGrup = x.grup;
                    var g = document.createElement('li');
                    g.className = 'sc__grup';
                    g.setAttribute('role', 'presentation');
                    g.textContent = x.grup;
                    liste.appendChild(g);
                }
                var li = document.createElement('li');
                li.className = 'sc__secenek';
                li.setAttribute('role', 'option');
                li.setAttribute('data-i', String(i));
                li.setAttribute('aria-selected', String(x.deger === deger.get.call(sel)));
                li.innerHTML = '<span></span>' + ISARET;
                li.firstChild.textContent = x.yazi;
                li.addEventListener('click', function () { degeriYaz(sel, x.deger); kapat(true); });
                li.addEventListener('mousemove', function () { odakla(i, false); });
                liste.appendChild(li);
            });
        }
        function ogeler() { return liste.querySelectorAll('.sc__secenek'); }
        function odakla(i, kaydir) {
            var l = ogeler();
            if (!l.length) return;
            odak = Math.max(0, Math.min(l.length - 1, i));
            Array.prototype.forEach.call(l, function (e, j) { e.classList.toggle('is-odak', j === odak); });
            if (kaydir) l[odak].scrollIntoView({ block: 'nearest' });
        }
        function ac() {
            if (acikOlan && acikOlan !== kapat) acikOlan(false);
            listeCiz();
            // Altta yer yoksa yukarı açılır (pencere sabit yükseklikte)
            var r = dugme.getBoundingClientRect();
            var kap2 = kap.closest('.icerik') || document.body;
            var alt = kap2.getBoundingClientRect().bottom - r.bottom;
            liste.classList.toggle('is-yukari', alt < 250 && r.top - kap2.getBoundingClientRect().top > alt);
            liste.classList.toggle('is-asagi', !liste.classList.contains('is-yukari'));
            kap.classList.add('is-acik');
            dugme.setAttribute('aria-expanded', 'true');
            var secili = secenekler(sel).map(function (x) { return x.deger; }).indexOf(deger.get.call(sel));
            odakla(secili, true);
            acikOlan = kapat;
        }
        function kapat(odakGeri) {
            kap.classList.remove('is-acik');
            dugme.setAttribute('aria-expanded', 'false');
            if (acikOlan === kapat) acikOlan = null;
            if (odakGeri) dugme.focus();
        }
        dugme.addEventListener('click', function () { kap.classList.contains('is-acik') ? kapat(false) : ac(); });
        dugme.addEventListener('keydown', function (e) {
            var acik = kap.classList.contains('is-acik');
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!acik) { ac(); return; }
                odakla(odak + (e.key === 'ArrowDown' ? 1 : -1), true);
            } else if ((e.key === 'Enter' || e.key === ' ') && acik) {
                e.preventDefault();
                var x = secenekler(sel)[odak];
                if (x) degeriYaz(sel, x.deger);
                kapat(true);
            } else if (e.key === 'Escape' && acik) {
                e.preventDefault();
                kapat(true);
            }
        });
        dugmeCiz();
        degerIzle(sel, dugmeCiz);
        sel.addEventListener('change', dugmeCiz);
        // kapi.js ses listesini sonradan doldurabilir: seçenek değişince yazı tazelenir
        new MutationObserver(dugmeCiz).observe(sel, { childList: true, subtree: true });
        return kap;
    }

    document.addEventListener('mousedown', function (e) {
        if (acikOlan && !e.target.closest('.sc.is-acik')) acikOlan(false);
    });

    Array.prototype.forEach.call(document.querySelectorAll('select.ayar__secim'), function (sel) {
        var yeni = kisaMi(sel) ? grupKur(sel) : panelKur(sel);
        sel.hidden = true;
        sel.setAttribute('aria-hidden', 'true');
        sel.tabIndex = -1;
        sel.parentNode.insertBefore(yeni, sel.nextSibling);
    });
})();
