/**
 * Franchise oturumu: sitedeki sayfaların franchise paneline istek atması için
 * ============================================================================
 *
 * Jeton iki yerden gelir, süresi en uzun olan seçilir:
 *   1. Jet Barkod Asistan (bu bilgisayarda franchise paneli açıksa yakalanır)
 *   2. Hesaba yazılmış jeton (Asistan, panelin herhangi bir sayfası açıkken
 *      kendisi yazar; telefon buradan okur)
 *
 * window.franchiseOturum.al(zorla)  → { jeton, depo, bitis }   (hata.kod: 'oturum' | 'depo')
 * window.franchiseOturum.istek(yol, secenek) → Response; 401'de bir kez tazeleyip dener
 * window.franchiseOturum.siparisOzeti(id, tur) → { urunler, kalem, adet, teslimDk, tarih, kurye, toplayici }
 *   Panelin "Sipariş Detayı" isteği. Yalnız ürünler, süreler, kurye ve
 *   toplayıcının adı ve fotoğraf adresi alınır; müşteri bilgisi hiç okunmaz.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var KIMLIK = /^[0-9a-f]{24}$/i;
    var KOK = 'https://franchise-api-gateway.getirapi.com';
    var onbellek = null;
    var bekleyen = null;

    function bitisMs(b) {
        if (!b || !b.token) return 0;
        var alan = 0;
        var v = b.tokenExpiry;
        if (v != null && v !== '') {
            var n = Number(v);
            alan = Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : (Date.parse(String(v)) || 0);
        }
        var jwt = 0;
        try {
            var p = String(b.token).replace(/^Bearer\s+/i, '').split('.')[1];
            var y = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
            if (Number.isFinite(y.exp)) jwt = y.exp * 1000;
        } catch (e) { /* jwt değil */ }
        return Math.max(alan, jwt);
    }

    function hata(kod) { var h = new Error(kod); h.kod = kod; return h; }

    async function adaylar() {
        var liste = [];
        var y = global.getirExtensionHelper;
        if (y && typeof y.getAPIInfo === 'function') {
            try {
                liste.push(await Promise.race([
                    y.getAPIInfo(),
                    new Promise(function (_, red) { setTimeout(function () { red(new Error('zaman')); }, 2500); })
                ]));
            } catch (e) { /* Asistan yok ya da jeton yok */ }
        }
        var kim = null;
        try {
            kim = (global.userDataManager && global.userDataManager.currentUser && global.userDataManager.currentUser.username) ||
                (global.authUtils && global.authUtils.checkAuth() && global.authUtils.checkAuth().username) || null;
        } catch (e) { kim = null; }
        if (kim && global.jbDb) {
            try {
                var r = await global.jbDb.from('users').select('api:counting_data->_api_info').eq('username', kim).maybeSingle();
                var b = r && r.data && r.data.api;
                if (typeof b === 'string') b = JSON.parse(b);
                if (b && typeof b === 'object') liste.push(b);
            } catch (e) { /* okunamadı */ }
        }
        return liste;
    }

    async function topla() {
        var simdi = Date.now();
        var en = null, enBitis = 0, depo = null;
        (await adaylar()).forEach(function (a) {
            if (!a || typeof a.token !== 'string') return;
            var d = typeof a.warehouseId === 'string' && KIMLIK.test(a.warehouseId) ? a.warehouseId : null;
            var b = bitisMs(a);
            if (b > simdi + 60000 && b > enBitis) { en = a; enBitis = b; if (d) depo = d; }
            if (!depo && d) depo = d;
        });
        if (!en) throw hata('oturum');
        if (!depo) throw hata('depo');
        var jeton = en.token.trim();
        if (!/^Bearer /.test(jeton)) jeton = 'Bearer ' + jeton;
        onbellek = { jeton: jeton, depo: depo, bitis: enBitis };
        return onbellek;
    }

    function al(zorla) {
        if (!zorla && onbellek && onbellek.bitis > Date.now() + 60000) return Promise.resolve(onbellek);
        if (zorla) onbellek = null;
        if (!bekleyen) bekleyen = topla().finally(function () { bekleyen = null; });
        return bekleyen;
    }

    async function istek(yol, secenek) {
        secenek = secenek || {};
        for (var deneme = 0; deneme < 2; deneme++) {
            var o = await al(deneme > 0);
            var r;
            try {
                r = await fetch(KOK + yol, {
                    method: secenek.method || 'GET',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: o.jeton },
                    body: secenek.govde ? JSON.stringify(secenek.govde) : undefined
                });
            } catch (e) {
                throw hata('ag');
            }
            if (r.status === 401 || r.status === 403) {
                onbellek = null;
                if (deneme === 0) continue;
                throw hata('oturum');
            }
            return r;
        }
        throw hata('oturum');
    }

    var URUN_GORSEL = /^https:\/\/(?:cdn-image\.getir\.com|cdn\.getir\.com|images\.getir\.com)\/[A-Za-z0-9._~%\/-]{1,300}$/;
    var KISI_FOTO = /^https:\/\/cdn\.getir\.com\/person\/[A-Za-z0-9._-]+\.(?:png|jpe?g)(?:\?[0-9]+)?$/;

    /* Panel nesnesindeki görsel alanı: dize, { tr, en, ... } ya da dizi */
    function gorselAl(p) {
        if (!p || typeof p !== 'object') return '';
        var x = p.picURL || p.picUrl || p.picURLs || p.image || '';
        if (Array.isArray(x)) x = x[0];
        if (x && typeof x === 'object') x = x.tr || x.en || x['en-US'] || Object.keys(x).map(function (k) { return x[k]; }).filter(function (v) { return typeof v === 'string'; })[0] || '';
        if (Array.isArray(x)) x = x[0];
        return typeof x === 'string' && URUN_GORSEL.test(x) ? x : '';
    }

    function kisiAl(k) {
        if (!k || typeof k !== 'object') return null;
        var ad = typeof k.name === 'string' ? k.name : typeof k.fullName === 'string' ? k.fullName : '';
        var foto = typeof k.picURL === 'string' && KISI_FOTO.test(k.picURL) ? k.picURL : '';
        ad = ad.replace(/\s+/g, ' ').trim().slice(0, 60);
        return ad || foto ? { ad: ad, foto: foto } : null;
    }

    async function siparisOzeti(id, tur) {
        if (!KIMLIK.test(String(id || ''))) throw hata('gecersiz');
        var r = await istek('/orders/' + id + (tur != null && tur !== '' ? '?domainType=' + Number(tur) : ''));
        if (!r.ok) throw hata('panel');
        var j = await r.json();
        var o = j && j.basket ? j : j && j.data && j.data.basket ? j.data : j && j.data && j.data.order ? j.data.order : j;
        var ham = o && o.basket && Array.isArray(o.basket.products) ? o.basket.products : o && Array.isArray(o.products) ? o.products : [];
        var urunler = ham.map(function (u) {
            var ad = u && u.name && typeof u.name === 'object' ? (u.name.tr || u.name.en || '') : (u && (u.name || u.fullName)) || '';
            if (ad && typeof ad === 'object') ad = ad.tr || ad.en || '';
            var pid = u && (u.product && typeof u.product === 'object' ? (u.product.id || u.product._id) : (u.product || u.productId || u.id || u._id));
            return {
                ad: String(ad || '').slice(0, 120), adet: Number(u && u.count) || 1,
                id: KIMLIK.test(String(pid || '')) ? String(pid).toLowerCase() : '',
                gorsel: gorselAl(u) || gorselAl(u && u.product)
            };
        }).filter(function (u) { return u.ad; });
        var zaman = function (yol) { var x = o && o[yol] && o[yol].date; var ms = Date.parse(x); return Number.isFinite(ms) ? ms : null; };
        var bas = zaman('checkout') || Date.parse(o && o.checkoutDate) || null;
        var teslim = zaman('deliver');
        return {
            urunler: urunler,
            kalem: urunler.length,
            adet: urunler.reduce(function (a, u) { return a + u.adet; }, 0),
            teslimDk: bas && teslim && teslim > bas ? Math.round((teslim - bas) / 60000) : null,
            tarih: bas ? new Date(bas).toISOString() : null,
            kurye: kisiAl(o && o.courier),
            toplayici: kisiAl(o && o.picker)
        };
    }

    global.franchiseOturum = { al: al, istek: istek, bitisMs: bitisMs, siparisOzeti: siparisOzeti };
})(window);
