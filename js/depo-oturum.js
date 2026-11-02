/**
 * Depo paneli oturumu: sitedeki sayfaların depo paneline istek atması için
 * ============================================================================
 *
 * Jeton hesaptan gelir (users.counting_data._depo_info). Depo paneli bir
 * bilgisayarda açık durdukça Asistan her yeni jetonu oraya yazar
 * (vps-api/depo-jeton.js). Jeton 15 dakika yaşıyor; süresi dolmak üzereyse
 * hesaptan yenisi okunur.
 *
 * İstekler panelin kendi başlıklarıyla gider: countrycode, language,
 * x-requester-client. Yeni bir istek üretmiyoruz, panelin attığının aynısı.
 *
 * window.depoOturum.al(zorla)          → { jeton, depo, bitis }   (hata.kod: 'oturum')
 * window.depoOturum.istek(yol, secenek) → Response; 401'de hesaptan bir kez tazeler
 * ============================================================================
 */
(function (global) {
    'use strict';

    var KIMLIK = /^[0-9a-f]{24}$/i;
    var KOK = 'https://warehouse-panel-api-gateway.getirapi.com';
    var PAY_MS = 45000;
    var onbellek = null;
    var bekleyen = null;

    function hata(kod) { var h = new Error(kod); h.kod = kod; return h; }

    function kim() {
        try {
            return (global.userDataManager && global.userDataManager.currentUser && global.userDataManager.currentUser.username) ||
                (global.authUtils && global.authUtils.checkAuth() && global.authUtils.checkAuth().username) || null;
        } catch (e) { return null; }
    }

    async function topla() {
        var k = kim();
        if (!k || !global.jbDb) throw hata('oturum');
        var b = null;
        try {
            var r = await global.jbDb.from('users').select('depo:counting_data->_depo_info').eq('username', k).maybeSingle();
            b = r && r.data && r.data.depo;
            if (typeof b === 'string') b = JSON.parse(b);
        } catch (e) { throw hata('ag'); }
        if (!b || typeof b.token !== 'string' || !KIMLIK.test(String(b.depo || ''))) throw hata('oturum');
        var bitis = Number(b.bitis) || 0;
        if (bitis < Date.now() + PAY_MS) {
            var h = hata('oturum');
            h.sonGorulme = Number(b.zaman) || null;
            throw h;
        }
        onbellek = { jeton: /^Bearer /.test(b.token) ? b.token : 'Bearer ' + b.token, depo: String(b.depo).toLowerCase(), bitis: bitis };
        return onbellek;
    }

    function al(zorla) {
        if (!zorla && onbellek && onbellek.bitis > Date.now() + PAY_MS) return Promise.resolve(onbellek);
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
                r = await fetch(KOK + yol.replace('{depo}', o.depo), {
                    method: secenek.method || 'GET',
                    headers: {
                        accept: 'application/json',
                        authorization: o.jeton,
                        'content-type': 'application/json',
                        countrycode: 'TR',
                        language: 'tr',
                        'x-requester-client': 'warehouse-panel-frontend'
                    },
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

    global.depoOturum = { al: al, istek: istek };
})(window);
