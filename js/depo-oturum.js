/**
 * Depo paneli: sitedeki sayfaların depo paneline soru sorması için
 * ============================================================================
 *
 * Getir'in depo paneli ağ geçidi başka sitelerden gelen tarayıcı isteğini
 * 503'le kesiyor; jetbarkod.com.tr doğrudan soramıyor. Soru Jet Barkod
 * sunucusuna gider (/api/depo-panel), sunucu Asistan'ın hesaba yazdığı depo
 * jetonuyla ve panelin başlıklarıyla sorar (vps-api/depo-jeton.js). Depo
 * paneli bir bilgisayarda açık durdukça jeton tazedir; telefon da çalışır.
 *
 * Yalnız üç işlem: hareket, paletler, palet. Gövdeyi sunucu kurar.
 *
 * window.depoPaneli.istek(islem, veri) → cevabın `veri`si
 *   hata.kod: 'oturum' (jeton yok ya da eski) · 'kurulum' (sunucu güncel değil) · 'panel' · 'ag'
 * ============================================================================
 */
(function (global) {
    'use strict';

    function hata(kod) { var h = new Error(kod); h.kod = kod; return h; }

    async function istek(islem, veri) {
        var a = global.jetbarkodAuth;
        if (!a || typeof a.apiFetch !== 'function') throw hata('oturum');
        var r;
        try {
            r = await a.apiFetch('/api/depo-panel', { method: 'POST', body: JSON.stringify({ islem: islem, veri: veri || {} }) });
        } catch (e) {
            throw hata('ag');
        }
        if (r.status === 404) throw hata('kurulum');
        var j = await r.json().catch(function () { return null; });
        if (r.ok && j && j.ok) return j.veri;
        var k = j && j.error;
        throw hata(k === 'oturum' ? 'oturum' : k === 'ag' ? 'ag' : 'panel');
    }

    global.depoPaneli = { istek: istek };
})(window);
