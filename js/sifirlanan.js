/**
 * Sayım Farkı ve Sıfırlananlar (/sifirlanan/)
 * ============================================================================
 * Veri: GET /api/sayim-fark/rapor (public.sayim_gecmisi'den derlenir). Ürün
 * başına son sistem/fiziksel stok, fark ve sıfırlananlar. Alt kategori
 * PRODUCTS_DATA'dan (ürün kimliğiyle) eklenir. Depo paneline istek gitmez.
 * Tablo yoksa sunucu 503 döner; sayfa "sunucu güncellemesi bekleniyor" der.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var HAKLAR = ['stokSayimi', 'jetBarkodAsistan'];

    function el(id) { return document.getElementById(id); }

    function kacis(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    async function istek(yol) {
        var a = global.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { kod: 401, j: {} };
        try {
            var r = await a.apiFetch(yol, {});
            var j = null;
            try { j = await r.json(); } catch (e) { /* gövde yok */ }
            return { kod: r.status, j: j || {} };
        } catch (e) { return { kod: 0, j: {} }; }
    }

    // Ürün kimliği -> { ad, kategori } (alt kategori için)
    var URUN = (function () {
        var m = new Map();
        try {
            var liste = global.PRODUCTS_DATA && Array.isArray(global.PRODUCTS_DATA.products) ? global.PRODUCTS_DATA.products : [];
            for (var i = 0; i < liste.length; i++) {
                var u = liste[i];
                if (u && u.id) m.set(String(u.id), { ad: u.name || '', kategori: u.category || '' });
            }
        } catch (e) { /* veri yoksa boş */ }
        return m;
    })();

    function sayiMetni(n) {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        var v = Number(n);
        return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
    }

    function tarihMetni(iso) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        return new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short' });
    }

    var durum = { satirlar: [], ozet: null, ara: '', sadeceSifir: false };

    function ozetCiz() {
        var o = durum.ozet || { urun: 0, sifir: 0, eksik: 0, fazla: 0 };
        el('sfOzet').innerHTML =
            kutu(o.sifir, 'Sıfırlanan ürün', true) +
            kutu(o.eksik, 'Eksik çıkan') +
            kutu(o.fazla, 'Fazla çıkan') +
            kutu(o.urun, 'Toplam farklı');
    }

    function kutu(sayi, ad, sifir) {
        return '<div class="sf-ozet__kutu"><div class="sf-ozet__sayi' + (sifir ? ' is-sifir' : '') + '">' +
            sayiMetni(sayi) + '</div><div class="sf-ozet__ad">' + kacis(ad) + '</div></div>';
    }

    function satirHtml(s) {
        var bilgi = URUN.get(String(s.urunId));
        var ad = s.ad || (bilgi && bilgi.ad) || s.urunId;
        var kat = bilgi && bilgi.kategori ? bilgi.kategori : '';
        var farkSinif = s.fark > 0 ? 'art' : s.fark < 0 ? 'eks' : '';
        var farkYazi = (s.fark > 0 ? '+' : '') + sayiMetni(s.fark);
        var durumHucre = s.sifir
            ? '<span class="sf-rozet">Sıfırlandı' + (s.sifirKez > 1 ? ' ×' + s.sifirKez : '') + '</span>'
            : '<span class="sf-kez">' + (s.sayimKez > 1 ? s.sayimKez + ' sayım' : '1 sayım') + '</span>';
        var ne = tarihMetni(s.sayimAt);
        var tur = s.otomatik ? 'Günlük' : 'Elle';
        return '<tr' + (s.sifir ? ' class="is-sifir"' : '') + '>' +
            '<td><div class="sf-urun__ad">' + kacis(ad) + '</div>' + (kat ? '<div class="sf-urun__kat">' + kacis(kat) + '</div>' : '') + '</td>' +
            '<td class="sag">' + sayiMetni(s.sistem) + '</td>' +
            '<td class="sag">' + sayiMetni(s.fiziksel) + '</td>' +
            '<td class="sag sf-fark ' + farkSinif + '">' + farkYazi + '</td>' +
            '<td>' + durumHucre + '</td>' +
            '<td class="sf-gizle-mobil">' + kacis(ne) + (ne ? ' · ' : '') + '<span class="sf-kez">' + tur + '</span></td>' +
            '</tr>';
    }

    function tabloCiz() {
        var liste = durum.satirlar;
        if (durum.sadeceSifir) liste = liste.filter(function (s) { return s.sifir; });
        var ara = durum.ara.trim().toLocaleLowerCase('tr');
        if (ara) {
            liste = liste.filter(function (s) {
                var bilgi = URUN.get(String(s.urunId));
                var ad = (s.ad || (bilgi && bilgi.ad) || '').toLocaleLowerCase('tr');
                return ad.indexOf(ara) !== -1;
            });
        }
        if (!liste.length) {
            el('sfGovde').innerHTML = '<div class="sf-tablo-sar"><div class="sf-durum">' +
                (durum.satirlar.length ? 'Aramaya uyan ürün yok.' : 'Fark bulunan ürün yok.') + '</div></div>';
            return;
        }
        var basliklar = '<tr><th>Ürün</th><th class="sag">Sistem</th><th class="sag">Fiziksel</th><th class="sag">Fark</th><th>Durum</th><th class="sf-gizle-mobil">Son sayım</th></tr>';
        el('sfGovde').innerHTML = '<div class="sf-tablo-sar"><table class="sf-tablo"><thead>' + basliklar + '</thead><tbody>' +
            liste.map(satirHtml).join('') + '</tbody></table></div>';
    }

    function durumGoster(metin) {
        el('sfGovde').innerHTML = '<div class="sf-tablo-sar"><div class="sf-durum">' + kacis(metin) + '</div></div>';
    }

    async function veriYukle() {
        durumGoster('Yükleniyor...');
        var c = await istek('/api/sayim-fark/rapor');
        if (c.kod === 503) { durumGoster('Sunucu güncellemesi bekleniyor. Kurulum tamamlanınca rapor burada görünecek.'); return; }
        if (c.kod === 401) { el('sfGiris').hidden = false; el('sfIcerik').hidden = true; return; }
        if (c.kod !== 200 || !c.j || !c.j.ok) { durumGoster('Rapor alınamadı. Biraz sonra tekrar dene.'); return; }
        durum.satirlar = Array.isArray(c.j.satirlar) ? c.j.satirlar : [];
        durum.ozet = c.j.ozet || null;
        ozetCiz();
        tabloCiz();
    }

    function olaylar() {
        var ara = el('sfAra');
        var zaman = null;
        ara.addEventListener('input', function () {
            clearTimeout(zaman);
            zaman = setTimeout(function () { durum.ara = ara.value; tabloCiz(); }, 120);
        });
        var dugme = el('sfSadeceSifir');
        dugme.addEventListener('click', function () {
            durum.sadeceSifir = !durum.sadeceSifir;
            dugme.classList.toggle('is-acik', durum.sadeceSifir);
            tabloCiz();
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

    async function basla() {
        var o = null;
        try { o = (global.authUtils && global.authUtils.checkAuth()) || null; } catch (e) { o = null; }
        if (!o || !o.username) { el('sfGiris').hidden = false; return; }
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;
        el('sfIcerik').hidden = false;
        durumGoster('Yükleniyor...');
        var p = await haklariYukle();
        var acik = p && HAKLAR.some(function (h) { return p.checkPremiumFeature(h); });
        if (!acik) { durumGoster('Bu özellik hesabında kapalı. Stok Sayımı ya da Jet Barkod Asistan açık hesaplarda çalışır.'); return; }
        olaylar();
        veriYukle();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
