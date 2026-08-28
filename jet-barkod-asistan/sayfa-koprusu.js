/**
 * Jet Barkod Asistan. Sayfa bağlamı köprüsü.
 * ============================================================================
 *
 * Bu dosya sayfanın KENDİ bağlamında çalışıyor (manifest'te `world: MAIN`),
 * içerik betiklerinin yalıtılmış dünyasında değil. Sebebi tek: sayfanın
 * kendi oturumunu ve istek başlıklarını kullanabilmek.
 *
 * Sipariş listesi Getir'in kendi API'sinden geliyor ve kimlik doğrulaması
 * istiyor. İçerik betiğinden atılan istekte sayfanın çerezi ve yetki
 * başlığı bulunmaz. Eski eklenti bu yüzden iki yol tutmuştu: ya buradan,
 * ya da `chrome.cookies` iznini alıp arka plandan. İkinci yol hiç
 * kullanılmıyordu, izinle birlikte atıldı.
 *
 * NASIL ÇALIŞIYOR
 * Sayfanın kendi `fetch` ve `XMLHttpRequest` çağrıları sarmalanıyor.
 * Sipariş listesi isteği geçtiğinde başlıkları bir kenara not ediliyor;
 * sonra kendi isteklerimizi aynı başlıklarla atıyoruz. Sarmalayıcı
 * yanıtı olduğu gibi geri veriyor, sayfanın davranışına dokunmuyor.
 *
 * GÜVENLİK
 * Sayfa bağlamında olduğumuz için buradaki kod eklentinin ayrıcalıklarına
 * sahip değil, sayfadaki herhangi bir betikle aynı yetkide. Mesajlar
 * `JB_` önekli, gelen mesajda kaynak denetleniyor, giden mesajda hedef
 * kaynak `'*'` değil sayfanın kendi kaynağı.
 * ============================================================================
 */
(function (global) {
    'use strict';

    if (global.__jbSayfaKoprusu) return;
    global.__jbSayfaKoprusu = true;

    var TEMEL = 'https://warehouse-panel-api-gateway.getirapi.com';
    var ARA_MS = 350;
    var KAYNAK = location.origin;

    var yakalanan = null;
    var asilFetch = global.fetch;

    function gonder(v) {
        try { global.postMessage(v, KAYNAK); } catch (e) { /* sessiz */ }
    }

    // ==================================================================
    // İstek şablonu yakalama
    // ==================================================================

    function listeAdresiMi(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.indexOf('getirapi.com') === -1) return false;
        if (url.indexOf('/orders') === -1) return false;
        // Tek siparişin detayı değil, listenin kendisi.
        return !url.match(/\/orders\/[a-f0-9]+(\?|$)/);
    }

    function sablonKopyala(init) {
        if (!init) return { credentials: 'include', method: 'GET' };
        var o = {};
        if (init.method) o.method = init.method;
        if (init.mode !== undefined) o.mode = init.mode;
        if (init.credentials !== undefined) o.credentials = init.credentials;
        if (init.cache !== undefined) o.cache = init.cache;
        if (init.headers) {
            o.headers = {};
            if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
                init.headers.forEach(function (v, k) { o.headers[k] = v; });
            } else if (typeof init.headers === 'object') {
                for (var k in init.headers) {
                    if (Object.prototype.hasOwnProperty.call(init.headers, k)) o.headers[k] = init.headers[k];
                }
            }
        }
        return o;
    }

    function sablonYakala(url, init) {
        if (!listeAdresiMi(url)) return;
        try {
            yakalanan = sablonKopyala(init);
            if (!yakalanan.headers) yakalanan.headers = {};
            if (!yakalanan.method) yakalanan.method = 'GET';
            if (yakalanan.credentials === undefined) yakalanan.credentials = 'include';
        } catch (e) { /* sessiz */ }
    }

    function sablon() {
        return yakalanan ? sablonKopyala(yakalanan) : { credentials: 'include', method: 'GET' };
    }

    if (asilFetch) {
        global.fetch = function (girdi, init) {
            var url = typeof girdi === 'string' ? girdi : (girdi && girdi.url) || '';
            sablonYakala(url, init);
            jetonYakala(url, init && init.headers);
            hareketGovdesiYakala(url, init);
            // Yanıt olduğu gibi geri gidiyor; sayfanın akışına karışmıyoruz.
            return asilFetch.apply(this, arguments);
        };
    }

    var AsilXHR = global.XMLHttpRequest;
    if (AsilXHR) {
        global.XMLHttpRequest = function () {
            var xhr = new AsilXHR();
            var sonUrl = '';
            var sonYontem = 'GET';
            var asilAc = xhr.open;
            xhr.open = function (yontem, url) {
                if (url && listeAdresiMi(url)) {
                    try {
                        yakalanan = yakalanan || { method: yontem, headers: {} };
                        yakalanan.method = yontem;
                        if (!yakalanan.headers) yakalanan.headers = {};
                        var asilBaslik = xhr.setRequestHeader;
                        xhr.setRequestHeader = function (k, v) {
                            yakalanan.headers[k] = v;
                            return asilBaslik.apply(this, arguments);
                        };
                    } catch (e) { /* sessiz */ }
                }

                // Jeton her getirapi isteğinde geçebiliyor, listeye özel değil.
                sonUrl = typeof url === 'string' ? url : '';
                sonYontem = (yontem || 'GET').toString().toUpperCase();
                var asilBaslik2 = xhr.setRequestHeader;
                xhr.setRequestHeader = function (k, v) {
                    if (sonUrl.indexOf('getirapi.com') !== -1 &&
                        (k === 'Authorization' || k === 'authorization') && v) {
                        jetonGonder(v);
                    }
                    return asilBaslik2.apply(this, arguments);
                };

                return asilAc.apply(this, arguments);
            };

            var asilGonder = xhr.send;
            xhr.send = function (govde) {
                hareketGovdesiYakalaXHR(sonUrl, sonYontem, govde);
                return asilGonder.apply(this, arguments);
            };

            return xhr;
        };
        global.XMLHttpRequest.prototype = AsilXHR.prototype;
    }

    // ==================================================================
    // Yetki jetonu ve stok hareketi gövdesi (Düşük Stok Uyarısı için)
    //
    // Bu iş neden burada: içerik betikleri yalıtılmış dünyada çalışıyor,
    // oradaki `window.fetch` sayfanın kullandığı fetch değil. Eski eklenti
    // sarmalamayı orada yapıyordu ve sayfanın isteklerini hiç göremiyordu.
    // Burada sayfanın kendi dünyasındayız, gerçekten görüyoruz.
    // ==================================================================

    var sonJeton = null;

    function jetonGonder(deger) {
        if (!deger || String(deger).indexOf('Bearer ') !== 0) return;
        if (deger === sonJeton) return;
        sonJeton = deger;
        gonder({ type: 'JB_JETON', jeton: deger });
    }

    function jetonYakala(url, basliklar) {
        if (!url || url.indexOf('getirapi.com') === -1 || !basliklar) return;
        try {
            if (typeof basliklar.get === 'function') {
                jetonGonder(basliklar.get('Authorization') || basliklar.get('authorization'));
            } else {
                jetonGonder(basliklar.Authorization || basliklar.authorization);
            }
        } catch (e) { /* sessiz */ }
    }

    function govdeyeCevir(g) {
        if (typeof g === 'string') return g;
        if (g && typeof g === 'object') {
            try { return JSON.stringify(g); } catch (e) { return null; }
        }
        return null;
    }

    function hareketGovdesiYakala(url, init) {
        if (!url || url.indexOf('/stocks/stock-movements') === -1) return;
        var yontem = (init && init.method ? String(init.method) : 'GET').toUpperCase();
        if (yontem !== 'POST' || !init) return;
        var g = govdeyeCevir(init.body);
        if (g) gonder({ type: 'JB_HAREKET_GOVDESI', govde: g });
    }

    function hareketGovdesiYakalaXHR(url, yontem, govde) {
        if (!url || url.indexOf('/stocks/stock-movements') === -1) return;
        if (yontem !== 'POST') return;
        var g = govdeyeCevir(govde);
        if (g) gonder({ type: 'JB_HAREKET_GOVDESI', govde: g });
    }

    // Modül bizden sonra uyanırsa yakaladığımızı tekrar isteyebilir.
    global.addEventListener('message', function (e) {
        if (e.source !== global || e.origin !== KAYNAK) return;
        if (!e.data || e.data.type !== 'JB_JETON_SOR') return;
        if (sonJeton) gonder({ type: 'JB_JETON', jeton: sonJeton });
    });

    // ==================================================================
    // Sipariş çekme
    // ==================================================================

    function urunler(siparis) {
        var liste = siparis && siparis.products;
        if (!Array.isArray(liste)) return [];
        return liste.map(function (p) {
            var ad = (p.name && (p.name.tr || p.name.en || '')) || '';
            return { name: String(ad).trim() || '-', barcode: '' };
        }).filter(function (p) { return p.name !== '-'; });
    }

    function getir(depo) {
        var listeAdresi = TEMEL + '/warehouse/' + depo + '/orders';

        asilFetch(listeAdresi, sablon())
            .then(function (r) { return r.json(); })
            .then(function (yanit) {
                var siparisler = yanit.data && yanit.data.orders;
                if (!Array.isArray(siparisler) || !siparisler.length) {
                    return gonder({ type: 'JB_SIPARIS_SONUC', data: [] });
                }

                var sonuc = [];
                var biten = 0;
                var toplam = siparisler.length;

                function sira(i) {
                    if (i >= toplam) return gonder({ type: 'JB_SIPARIS_SONUC', data: sonuc });

                    var detayAdresi = TEMEL + '/warehouse/' + depo + '/orders/' +
                                      siparisler[i].id + '?domainType=1';

                    function devam() {
                        biten++;
                        gonder({ type: 'JB_SIPARIS_ILERLEME', current: biten, total: toplam });
                        // Getir'in API'sini boğmamak için araya nefes payı.
                        setTimeout(function () { sira(i + 1); }, ARA_MS);
                    }

                    asilFetch(detayAdresi, sablon())
                        .then(function (r) { return r.json(); })
                        .then(function (detay) {
                            var o = detay.data && detay.data.order;
                            if (o) {
                                sonuc.push({
                                    orderId: o.id,
                                    orderLabel: (o.clientName || '') + ' - ' + (o.id ? o.id.slice(-4) : ''),
                                    products: urunler(o)
                                });
                            }
                            devam();
                        })
                        .catch(devam);
                }

                sira(0);
            })
            .catch(function (e) {
                gonder({ type: 'JB_SIPARIS_SONUC', data: [], error: (e && e.message) || 'İstek başarısız' });
            });
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global) return;
        if (e.origin !== KAYNAK) return;
        var d = e.data;
        if (!d || d.type !== 'JB_SIPARIS_GETIR') return;
        if (!d.warehouseId) {
            return gonder({ type: 'JB_SIPARIS_SONUC', data: [], error: 'Depo bilgisi yok' });
        }
        getir(d.warehouseId);
    });
})(window);
