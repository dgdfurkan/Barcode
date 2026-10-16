/**
 * Yardımcılar: küçük araçların giriş sayfası (/yardimcilar/)
 * ============================================================================
 *
 * Her araç kendi sayfasında yaşar; burası yalnız listeler. Hesapta açık olan
 * araç tıklanır, kapalı olan kilitli görünür, hazırlanan araç "Yakında" der.
 * Yeni araç eklemek için ARACLAR'a bir satır yeterli.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var ARACLAR = [
        {
            hak: 'satistanKaldirma',
            ad: 'Satıştan Kaldırma',
            ozet: 'Kaldırılan ürünler, sebepler ve iptaller. Telegram\'a görsel rapor.',
            adres: '../kaldirma/',
            ikon: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'
        },
        {
            hak: 'itirazYazici',
            ad: 'İtiraz Yazıcı',
            adres: '../itiraz/',
            ozet: 'İtiraz edilebilir kayıtlar için duruma uygun, ikna edici itiraz metni.',
            ikon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'
        }
    ];

    function el(id) { return document.getElementById(id); }

    function kacis(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    async function haklariYukle() {
        var p = global.premiumFeatures;
        if (!p) return null;
        try {
            if (typeof p.init === 'function') await p.init();
            if (typeof p.loadPremiumFeatures === 'function') await p.loadPremiumFeatures();
        } catch (e) { /* sessiz */ }
        return p;
    }

    function kartCiz(a, p) {
        var acik = !!(a.hak && p && p.checkPremiumFeature(a.hak));
        var durum = a.yakinda ? 'Yakında' : acik ? '' : 'Hesabında kapalı';
        var ic = '<span class="yrd-kart__ikon"><svg viewBox="0 0 24 24" aria-hidden="true">' + a.ikon + '</svg></span>' +
            '<span class="yrd-kart__metin"><strong>' + kacis(a.ad) + '</strong><span>' + kacis(a.ozet) + '</span></span>' +
            (durum
                ? '<span class="yrd-kart__durum">' + kacis(durum) + '</span>'
                : '<svg class="yrd-kart__ok" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg>');
        if (acik && !a.yakinda) return '<a class="yrd-kart" href="' + a.adres + '">' + ic + '</a>';
        return '<div class="yrd-kart yrd-kart--kapali" aria-disabled="true">' + ic + '</div>';
    }

    async function basla() {
        var o = null;
        try { o = (global.authUtils && global.authUtils.checkAuth()) || null; } catch (e) { o = null; }
        if (!o || !o.username) { el('yrdGiris').hidden = false; return; }
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;
        var p = await haklariYukle();
        el('yrdListe').innerHTML = ARACLAR.map(function (a) { return kartCiz(a, p); }).join('');
        el('yrdIcerik').hidden = false;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
