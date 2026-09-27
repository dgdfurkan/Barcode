/**
 * Sayım: toplu eklemede eşleşmeyen ürünler
 * ============================================================================
 *
 * Toplu eklemede (görsel linkleri, Getir tablo HTML'i, ad listesi) katalogda
 * bulunamayan ürünler eskiden 5 saniyelik bir bildirimle kayboluyordu.
 * Artık üstte kalıcı bir panelde duruyorlar: görsel, bağlantı, ad, hangi
 * tabloya eklenirken kaçtığı. Kullanıcı araştırıp ürünü bulana kadar
 * silinmez; tek tek ya da hepsi birden elle temizlenir.
 *
 * Liste bu cihazda saklanır (localStorage), sayfa yenilense de kalır.
 *
 * Motor (counting.js) şunu çağırır:
 *   window.JBEslesmeyen.ekle([{ ad, gorsel }], { tablo, kaynak })
 * ============================================================================
 */
(function () {
    'use strict';

    var ANAHTAR = 'jb_sayim_eslesmeyen';
    var EN_COK = 300;

    var liste = [];
    var acik = false;
    var dom = null;
    var temizleOnay = null;

    // ------------------------------------------------------------------
    // Saklama
    // ------------------------------------------------------------------

    function oku() {
        try {
            var ham = JSON.parse(localStorage.getItem(ANAHTAR) || '[]');
            return Array.isArray(ham) ? ham.filter(function (o) { return o && (o.ad || o.gorsel); }) : [];
        } catch (e) { return []; }
    }

    function yaz() {
        try {
            if (liste.length) localStorage.setItem(ANAHTAR, JSON.stringify(liste));
            else localStorage.removeItem(ANAHTAR);
        } catch (e) {}
    }

    /* Yalnız http(s) adresi kabul: bağlantı ve görsel kaynağı olarak
       başka bir şema (javascript:, data:) asla sayfaya girmesin. */
    function guvenliAdres(u) {
        if (!u) return null;
        try {
            var x = new URL(String(u).trim());
            return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : null;
        } catch (e) { return null; }
    }

    function anahtar(o) {
        return (o.tablo || '') + '|' + String(o.gorsel || o.ad || '').toLocaleLowerCase('tr-TR');
    }

    // ------------------------------------------------------------------
    // Arayüz
    // ------------------------------------------------------------------

    function ikon(yol, kalinlik) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (kalinlik || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + yol + '</svg>';
    }

    var IKON = {
        uyari: ikon('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>'),
        kucult: ikon('<path d="M18 15l-6-6-6 6"/>'),
        ac: ikon('<path d="M6 9l6 6 6-6"/>'),
        kapat: ikon('<path d="M6 6l12 12M18 6L6 18"/>'),
        kopya: ikon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>'),
        dis: ikon('<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/>'),
        gorselYok: ikon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/>', 1.7)
    };

    function kur() {
        if (dom) return dom;
        var kok = document.createElement('section');
        kok.className = 'sye';
        kok.setAttribute('aria-label', 'Eşleşmeyen ürünler');
        kok.hidden = true;
        kok.innerHTML =
            '<button type="button" class="sye-hap" aria-expanded="false" aria-controls="syePanel">' +
                '<span class="sye-hap__ikon">' + IKON.uyari + '</span>' +
                '<span class="sye-hap__metin"></span>' +
                '<span class="sye-hap__ok">' + IKON.ac + '</span>' +
            '</button>' +
            '<div class="sye-panel" id="syePanel" role="region" aria-labelledby="syeBaslik" hidden>' +
                '<div class="sye-bas">' +
                    '<span class="sye-bas__ikon">' + IKON.uyari + '</span>' +
                    '<div class="sye-bas__metin">' +
                        '<h2 class="sye-baslik" id="syeBaslik">Eşleşmeyen ürünler <span class="sye-sayi"></span></h2>' +
                        '<p class="sye-alt">Katalogda bulunamadılar. Sen silene kadar burada kalırlar.</p>' +
                    '</div>' +
                    '<button type="button" class="sye-dugme sye-dugme--ikon" data-sye="kucult" aria-label="Küçült" title="Küçült">' + IKON.kucult + '</button>' +
                '</div>' +
                '<div class="sye-izgara" role="list"></div>' +
                '<div class="sye-alt-serit">' +
                    '<button type="button" class="sye-dugme" data-sye="hepsini-kopyala">' + IKON.kopya + '<span>Linkleri kopyala</span></button>' +
                    '<button type="button" class="sye-dugme sye-dugme--tehlike" data-sye="temizle"><span>Hepsini temizle</span></button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(kok);

        dom = {
            kok: kok,
            hap: kok.querySelector('.sye-hap'),
            hapMetin: kok.querySelector('.sye-hap__metin'),
            panel: kok.querySelector('.sye-panel'),
            sayi: kok.querySelector('.sye-sayi'),
            izgara: kok.querySelector('.sye-izgara'),
            temizle: kok.querySelector('[data-sye="temizle"]'),
            kopyala: kok.querySelector('[data-sye="hepsini-kopyala"]')
        };

        dom.hap.addEventListener('click', function () { ac(); });
        kok.querySelector('[data-sye="kucult"]').addEventListener('click', function () { kucult(); });
        dom.kopyala.addEventListener('click', hepsiniKopyala);
        dom.temizle.addEventListener('click', temizleTik);

        dom.izgara.addEventListener('click', function (e) {
            var b = e.target.closest('[data-sye-eylem]');
            if (!b) return;
            var id = b.closest('[data-id]') && b.closest('[data-id]').dataset.id;
            var o = liste.find(function (x) { return x.id === id; });
            if (!o) return;
            if (b.dataset.syeEylem === 'kaldir') {
                liste = liste.filter(function (x) { return x.id !== id; });
                yaz();
                ciz();
            } else if (b.dataset.syeEylem === 'kopyala') {
                kopyala(o.gorsel || o.ad, b);
            } else if (b.dataset.syeEylem === 'buyut') {
                if (window.JBUrunFoto) {
                    e.preventDefault();
                    window.JBUrunFoto.ac(o.gorsel, o.ad || 'Eşleşmeyen ürün');
                }
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && acik && !(window.JBUrunFoto && window.JBUrunFoto.acikMi())) {
                if (dom.kok.contains(document.activeElement)) kucult();
            }
        });

        return dom;
    }

    function saat(t) {
        try {
            var d = new Date(t);
            var bugun = new Date();
            var ayniGun = d.toDateString() === bugun.toDateString();
            var s = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            return ayniGun ? s : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + s;
        } catch (e) { return ''; }
    }

    function kart(o) {
        var kutu = document.createElement('div');
        kutu.className = 'sye-kart';
        kutu.setAttribute('role', 'listitem');
        kutu.dataset.id = o.id;

        var gorsel;
        if (o.gorsel) {
            gorsel = document.createElement('a');
            gorsel.className = 'sye-kart__gorsel';
            gorsel.href = o.gorsel;
            gorsel.target = '_blank';
            gorsel.rel = 'noopener noreferrer';
            gorsel.dataset.syeEylem = 'buyut';
            gorsel.title = 'Büyüt';
            var img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.alt = o.ad || 'Eşleşmeyen ürün görseli';
            img.src = o.gorsel;
            img.referrerPolicy = 'no-referrer';
            gorsel.appendChild(img);
        } else {
            gorsel = document.createElement('div');
            gorsel.className = 'sye-kart__gorsel sye-kart__gorsel--yok';
            gorsel.innerHTML = IKON.gorselYok;
        }
        kutu.appendChild(gorsel);

        var metin = document.createElement('div');
        metin.className = 'sye-kart__metin';
        var ad = document.createElement('p');
        ad.className = 'sye-kart__ad' + (o.ad ? '' : ' is-bos');
        ad.textContent = o.ad || 'Adı bilinmiyor';
        ad.title = o.ad || '';
        var alt = document.createElement('p');
        alt.className = 'sye-kart__alt';
        alt.textContent = [o.tablo, saat(o.t)].filter(Boolean).join(' · ');
        metin.appendChild(ad);
        metin.appendChild(alt);
        kutu.appendChild(metin);

        var eylem = document.createElement('div');
        eylem.className = 'sye-kart__eylem';
        eylem.innerHTML =
            '<button type="button" class="sye-mini" data-sye-eylem="kopyala" title="' + (o.gorsel ? 'Görsel linkini kopyala' : 'Adı kopyala') + '">' + IKON.kopya + '<span>Kopyala</span></button>' +
            (o.gorsel ? '<a class="sye-mini sye-mini--ikon" href="' + o.gorsel.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer" aria-label="Görseli yeni sekmede aç" title="Yeni sekmede aç">' + IKON.dis + '</a>' : '') +
            '<button type="button" class="sye-mini sye-mini--ikon" data-sye-eylem="kaldir" aria-label="Listeden kaldır" title="Listeden kaldır">' + IKON.kapat + '</button>';
        kutu.appendChild(eylem);
        return kutu;
    }

    function ciz() {
        kur();
        var n = liste.length;
        dom.kok.hidden = n === 0;
        if (!n) { acik = false; return; }

        dom.hapMetin.textContent = n + ' ürün eşleşmedi';
        dom.sayi.textContent = n;
        dom.hap.hidden = acik;
        dom.hap.setAttribute('aria-expanded', acik ? 'true' : 'false');
        dom.panel.hidden = !acik;
        dom.kok.classList.toggle('is-acik', acik);
        dom.kopyala.hidden = !liste.some(function (o) { return o.gorsel; });

        if (!acik) return;
        var parca = document.createDocumentFragment();
        for (var i = 0; i < n; i++) parca.appendChild(kart(liste[i]));
        dom.izgara.textContent = '';
        dom.izgara.appendChild(parca);
    }

    function ac() {
        acik = true;
        ciz();
        var ilk = dom.panel.querySelector('[data-sye="kucult"]');
        if (ilk) try { ilk.focus({ preventScroll: true }); } catch (e) {}
    }

    function kucult() {
        acik = false;
        temizleSifirla();
        ciz();
        if (!dom.kok.hidden) try { dom.hap.focus({ preventScroll: true }); } catch (e) {}
    }

    function temizleSifirla() {
        if (temizleOnay) { clearTimeout(temizleOnay); temizleOnay = null; }
        if (dom) {
            dom.temizle.classList.remove('is-onay');
            dom.temizle.querySelector('span').textContent = 'Hepsini temizle';
        }
    }

    /* Yanlışlıkla silinmesin: ilk basış onay ister, 4 sn içinde ikinci basış siler */
    function temizleTik() {
        if (!temizleOnay) {
            dom.temizle.classList.add('is-onay');
            dom.temizle.querySelector('span').textContent = 'Emin misin? Tekrar bas';
            temizleOnay = setTimeout(temizleSifirla, 4000);
            return;
        }
        temizleSifirla();
        liste = [];
        yaz();
        acik = false;
        ciz();
    }

    function bildir(mesaj, tur) {
        var cs = window.countingSystem;
        if (cs && typeof cs.showToast === 'function') cs.showToast(mesaj, tur || 'success', 2000);
    }

    function panoyaYaz(metin) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(metin);
        }
        return new Promise(function (coz, red) {
            try {
                var t = document.createElement('textarea');
                t.value = metin;
                t.setAttribute('readonly', '');
                t.style.position = 'fixed';
                t.style.opacity = '0';
                document.body.appendChild(t);
                t.select();
                var ok = document.execCommand('copy');
                t.remove();
                ok ? coz() : red(new Error('kopyalanamadı'));
            } catch (e) { red(e); }
        });
    }

    function kopyala(metin, dugme) {
        panoyaYaz(metin).then(function () {
            if (dugme) {
                var s = dugme.querySelector('span');
                if (s) {
                    s.textContent = 'Kopyalandı';
                    setTimeout(function () { s.textContent = 'Kopyala'; }, 1400);
                }
            }
        }, function () { bildir('Kopyalanamadı', 'error'); });
    }

    function hepsiniKopyala() {
        var linkler = liste.map(function (o) { return o.gorsel; }).filter(Boolean);
        if (!linkler.length) return;
        panoyaYaz(linkler.join('\n')).then(function () {
            bildir(linkler.length + ' link kopyalandı');
        }, function () { bildir('Kopyalanamadı', 'error'); });
    }

    // ------------------------------------------------------------------
    // Dış arayüz
    // ------------------------------------------------------------------

    function ekle(ogeler, secenek) {
        if (!Array.isArray(ogeler) || !ogeler.length) return 0;
        secenek = secenek || {};
        var simdi = Date.now();
        var mevcut = new Set(liste.map(anahtar));
        var yeniler = [];
        ogeler.forEach(function (ham, i) {
            if (!ham) return;
            var o = {
                id: simdi.toString(36) + '-' + i + '-' + Math.random().toString(36).slice(2, 6),
                ad: ham.ad ? String(ham.ad).trim().slice(0, 200) : '',
                gorsel: guvenliAdres(ham.gorsel),
                tablo: secenek.tablo ? String(secenek.tablo).slice(0, 120) : '',
                kaynak: secenek.kaynak ? String(secenek.kaynak).slice(0, 40) : '',
                t: simdi
            };
            if (!o.ad && !o.gorsel) return;
            var k = anahtar(o);
            if (mevcut.has(k)) return;
            mevcut.add(k);
            yeniler.push(o);
        });
        if (!yeniler.length) {
            // Hepsi zaten listede: yine de göster ki kullanıcı nerede olduklarını görsün
            if (liste.length) ac();
            return 0;
        }
        liste = yeniler.concat(liste).slice(0, EN_COK);
        yaz();
        temizleSifirla();
        ac();
        return yeniler.length;
    }

    function baslat() {
        liste = oku();
        if (liste.length) ciz();
        // Başka sekmede değişirse burada da tazelensin
        window.addEventListener('storage', function (e) {
            if (e.key !== ANAHTAR) return;
            liste = oku();
            ciz();
        });
    }

    window.JBEslesmeyen = {
        ekle: ekle,
        ac: function () { if (liste.length) ac(); },
        kucult: kucult,
        sayi: function () { return liste.length; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }
})();
