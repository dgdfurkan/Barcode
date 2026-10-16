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

    global.franchiseOturum = { al: al, istek: istek, bitisMs: bitisMs };
})(window);
