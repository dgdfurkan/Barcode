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
            // Request nesnesiyle çağrıldıysa başlıklar orada.
            if (typeof girdi === 'object' && girdi && girdi.headers) {
                jetonYakala(url, girdi.headers);
            }
            hareketGovdesiYakala(url, init);
            panelBasliklariYakala(url, init && init.headers);
            if (typeof girdi === 'object' && girdi && girdi.headers) panelBasliklariYakala(url, girdi.headers);
            // Yanıt olduğu gibi geri gidiyor; sayfanın akışına karışmıyoruz.
            return asilFetch.apply(this, arguments).then(function (yanit) {
                return yanitiDuyur(url, yanit);
            });
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
                    if (sonUrl.indexOf(TEMEL) === 0) { var o = {}; o[k] = v; panelBasliklariYakala(sonUrl, o); }
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
        // Hızlı Bul modülü bu adı bekliyor (kaynağındaki inject.js'ten).
        gonder({ type: 'GETIR_TOKEN_CAPTURED', token: deger });
    }

    /**
     * Getir API yanıtlarını sayfaya duyurur. Hızlı Bul sipariş kimliklerini
     * buradan topluyor; kendi isteğini atmıyor, sayfanın zaten aldığı
     * yanıtı okuyor. Getir tarafında ek yük yok.
     *
     * Yanıt klonlanıp okunuyor, aslına dokunulmuyor.
     */
    function yanitiDuyur(url, yanit) {
        if (!url || url.indexOf('getirapi.com') === -1) return yanit;
        try {
            yanit.clone().json().then(function (veri) {
                gonder({ type: 'GETIR_DATA_RECEIVED', payload: veri, url: url });
            }).catch(function () { /* JSON değilse boş ver */ });
        } catch (e) { /* sessiz */ }
        return yanit;
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

    /**
     * Detay yanıtının ALAN ADLARINI bir kez yerel depoya yazar. Değer değil,
     * yalnız ad. Ürün kimliği ve görsel alanının adı belgelenmiş değil;
     * tahmin edip yanlış alan okumaktansa gerçek yanıttan öğreniyoruz.
     * Kayıt bir kez yazılıyor, sonraki çekimlerde dokunulmuyor.
     */
    /* Panel `basketProductCount` alanını bazı siparişlerde nesne olarak
       veriyor. `siparis-kopru.js` yalnız `typeof === 'number'` olduğunda
       yazdığı için adet sessizce boş kalıyordu. Sayı çıkaramazsak ürün
       listesindeki `orderCount` toplamına düşüyoruz; parça dediğimiz zaten o.
       Aynı çözüm `moduller/hizli-bul.js` içinde de var (ayrı dünya, ortak
       dosya paylaşamıyorlar). */
    var ADET_ADLARI = ['count', 'total', 'value', 'amount', 'quantity',
                       'totalCount', 'productCount', 'basketProductCount'];

    function sayiyaCevir(d) {
        if (typeof d === 'number') return isFinite(d) ? Math.round(d) : null;
        if (typeof d === 'string' && d.trim() !== '') {
            var n = Number(d);
            return isFinite(n) ? Math.round(n) : null;
        }
        return null;
    }

    function parcaSayisiCoz(deger, urunler) {
        var dogrudan = sayiyaCevir(deger);
        if (dogrudan !== null) return dogrudan;

        if (deger && typeof deger === 'object') {
            for (var i = 0; i < ADET_ADLARI.length; i++) {
                var a = sayiyaCevir(deger[ADET_ADLARI[i]]);
                if (a !== null) return a;
            }
            var sayisallar = Object.keys(deger).filter(function (k) {
                return sayiyaCevir(deger[k]) !== null;
            });
            if (sayisallar.length === 1) return sayiyaCevir(deger[sayisallar[0]]);
        }

        if (!Array.isArray(urunler) || !urunler.length) return null;
        var toplam = 0, bulundu = false;
        for (var j = 0; j < urunler.length; j++) {
            var p = urunler[j] || {};
            var b = sayiyaCevir(p.orderCount);
            if (b === null) b = sayiyaCevir(p.count);
            if (b === null) continue;
            toplam += b;
            bulundu = true;
        }
        return bulundu ? toplam : null;
    }

    function semayiKaydet(siparis) {
        try {
            if (!siparis || localStorage.getItem('jba_detay_sema')) return;
            var p0 = (Array.isArray(siparis.products) && siparis.products[0]) || null;
            var altlar = {};
            if (p0) {
                Object.keys(p0).forEach(function (k) {
                    var v = p0[k];
                    if (v && typeof v === 'object' && !Array.isArray(v)) altlar[k] = Object.keys(v);
                });
            }
            localStorage.setItem('jba_detay_sema', JSON.stringify({
                siparisAlanlari: Object.keys(siparis),
                urunAlanlari: p0 ? Object.keys(p0) : null,
                urunAltNesneler: altlar,
                urunSatiri: Array.isArray(siparis.products) ? siparis.products.length : 0,
                zaman: new Date().toISOString()
            }));
        } catch (e) { /* sessiz */ }
    }

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
                            semayiKaydet(o);
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

    // ==================================================================
    // Sipariş listesi toplayıcı
    //
    // Panel siparişleri soket üzerinden alıyor ve React durumunda tutuyor;
    // HTTP trafiğinde görünmüyorlar. İçerik betiği yalıtılmış dünyada olduğu
    // için React'in DOM üzerine koyduğu alanları göremiyor, o yüzden okuma
    // burada, sayfanın kendi dünyasında yapılıyor. Getir'e tek bir ek istek
    // gitmiyor; veri zaten ekranda.
    // ==================================================================

    function fiberBul(el) {
        for (var k in el) {
            if (k.indexOf('__reactFiber$') === 0 || k.indexOf('__reactInternalInstance$') === 0) return el[k];
        }
        return null;
    }

    var _fotoHaritasi = {};

    function fotoHaritasiniGuncelle() {
        _fotoHaritasi = {};
        var avatarlar = document.querySelectorAll('[class*="avatar"] img, .ant-avatar img');
        for (var i = 0; i < avatarlar.length; i++) {
            var src = avatarlar[i].src || avatarlar[i].getAttribute('src') || '';
            if (src.indexOf('cdn.getir.com/person/') < 0) continue;
            var eslesme = src.match(/person\/([a-f0-9]{24})\./);
            if (eslesme) _fotoHaritasi[eslesme[1]] = src;
        }
        var kaplamalar = document.querySelectorAll('[class*="avatar"]');
        for (var j = 0; j < kaplamalar.length; j++) {
            var fiber = fiberBul(kaplamalar[j]);
            var adim = 0;
            while (fiber && adim < 8) {
                var p = fiber.memoizedProps;
                if (p && typeof p.src === 'string' && p.src.indexOf('cdn.getir.com/person/') >= 0) {
                    var m = p.src.match(/person\/([a-f0-9]{24})\./);
                    if (m && !_fotoHaritasi[m[1]]) _fotoHaritasi[m[1]] = p.src;
                    break;
                }
                fiber = fiber.return; adim++;
            }
        }
    }

    function metin(v) {
        if (v == null) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object') return v.tr || v.en || '';
        return String(v);
    }

    /**
     * Kişi nesnesindeki fotoğraf adresi. Panelin alan adı sürümden sürüme
     * değişebiliyor (imageURL, photoUrl, avatar...); tahmin etmek yerine
     * bilinen adları sırayla deniyoruz, ilk geçerli adres alınıyor. Hiçbiri
     * yoksa boş dönüyor ve ekranda baş harfler kalıyor.
     */
    /* Getir'in gerçek alan adı `picURL`. Kişi nesnesinde başka form da
       çıkabilir diye alternatifleri sırayla deniyoruz. */
    var FOTO_ALANLARI = ['picURL', 'picUrl', 'imageURL', 'imageUrl',
                         'photoURL', 'photoUrl', 'avatarURL', 'avatarUrl',
                         'avatar', 'picture', 'photo', 'image',
                         'profileImageUrl', 'profileImageURL', 'profilePhoto'];

    function fotoBul(kisi) {
        if (!kisi || typeof kisi !== 'object') return '';
        for (var i = 0; i < FOTO_ALANLARI.length; i++) {
            var v = kisi[FOTO_ALANLARI[i]];
            if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
        }
        return '';
    }

    function kisiFoto(kisi) {
        /* Yalnız gerçek URL. `picker.id` medya hash'inden farklı olduğu
           için ID'den URL üretmek 404 veriyordu; kaldırıldı. Panel
           React state'inde picURL yoksa DOM avatar haritasına bakıyoruz. */
        var url = fotoBul(kisi);
        if (url) return url;
        var id = (kisi && (kisi._id || kisi.id)) || '';
        if (id && _fotoHaritasi[id]) return _fotoHaritasi[id];
        return '';
    }

    function sadeSiparis(o, kolon) {
        try {
            if (!localStorage.getItem('jba_kisi_sema')) {
                var kisi = o.picker || o.courier;
                if (kisi && typeof kisi === 'object') {
                    localStorage.setItem('jba_kisi_sema', JSON.stringify({
                        alanlar: Object.keys(kisi),
                        idVar: !!(kisi._id || kisi.id),
                        fotoHaritaSayac: Object.keys(_fotoHaritasi).length,
                        zaman: new Date().toISOString()
                    }));
                }
            }
        } catch (e) { /* sessiz */ }
        var kon = Array.isArray(o.productLocations) ? o.productLocations : [];
        return {
            siparisId: o.id,
            banko: (kon[0] && kon[0].locationBarcode) || '',
            kolon: metin(kolon),
            durum: o.status,
            toplamAdet: parcaSayisiCoz(o.basketProductCount, o.products),
            posetSayisi: parcaSayisiCoz(o.totalBagUsageCount, null),
            eksikUrunVar: !!o.hasMissingProduct,
            toplayici: (o.picker && o.picker.name) || '',
            kurye: (o.courier && o.courier.name) || '',
            toplayiciFoto: kisiFoto(o.picker),
            kuryeFoto: kisiFoto(o.courier),
            sepetZamani: o.checkoutDate || null,
            urunler: (Array.isArray(o.products) ? o.products : []).map(function (p) {
                var k = p.masterCategory || {};
                return {
                    sira: p.index,
                    adet: p.count,
                    siparisAdedi: p.orderCount,
                    tur: p.type,
                    altTur: p.subType,
                    anaKategori: metin(k.masterMainCategory),
                    sinif: metin(k.masterClass),
                    altSinif: metin(k.masterSubClass)
                };
            })
        };
    }

    function siparisleriTopla() {
        var cikti = [];
        var gorulen = {};
        var kartlar = document.querySelectorAll('[class*="orderCard--"]');
        for (var i = 0; i < kartlar.length; i++) {
            var n = fiberBul(kartlar[i]);
            var adim = 0;
            while (n && adim < 25) {
                var p = n.memoizedProps;
                if (p && Array.isArray(p.orders)) {
                    for (var j = 0; j < p.orders.length; j++) {
                        var o = p.orders[j];
                        if (!o || !o.id || gorulen[o.id]) continue;
                        gorulen[o.id] = 1;
                        if (!global.__jbaHamOrnek) global.__jbaHamOrnek = o;
                        cikti.push(sadeSiparis(o, p.title));
                    }
                    break;
                }
                n = n.return; adim++;
            }
        }
        if (cikti.length) global.__jbaSadeOrnek = cikti[0];
        /* Otomatik döküm KAPALI: Getir konsolunu kirletmesin. İhtiyaç
           olursa kullanıcı `jba()` yazıp elle görebilir. */
        return cikti;
    }

    function jbaHamDok(ham, sade) {
        var stil = 'background:#131720;color:#fff;padding:3px 10px;border-radius:6px;font-weight:700';
        var b1 = 'color:#3b82f6;font-weight:700';
        var b2 = 'color:#10b981;font-weight:700';
        var b3 = 'color:#f59e0b;font-weight:700';
        var b4 = 'color:#ef4444;font-weight:700';
        console.group('%c[JBA] Panel siparişinin HAM verisi (React fiber)', stil);
        console.log('%cSipariş nesnesinin alan adları:', b1, Object.keys(ham || {}));
        console.log('%cTam ham nesne:', b1, ham);
        console.log('%cpicker (toplayıcı) alanları:', b2, ham && ham.picker ? Object.keys(ham.picker) : null);
        console.log('%cpicker nesnesi:', b2, ham && ham.picker);
        console.log('%ccourier (kurye) alanları:', b2, ham && ham.courier ? Object.keys(ham.courier) : null);
        console.log('%ccourier nesnesi:', b2, ham && ham.courier);
        console.log('%cproductLocations (banko):', b3, ham && ham.productLocations);
        var u0 = ham && Array.isArray(ham.products) ? ham.products[0] : null;
        console.log('%cilk ürün alan adları:', b3, u0 ? Object.keys(u0) : null);
        console.log('%cilk ürün:', b3, u0);
        console.log('%cBIZIM sadeleştirdiğimiz (DB\'ye giden):', b4, sade);
        console.log('%cKomutlar: jba() | jbaHam() | jbaSade() | jbaKopya() | jbaLog() | jbaTazele() | jbaSifirla(true)', 'color:#94a3b8');
        console.groupEnd();
    }

    global.jba = function () { jbaHamDok(global.__jbaHamOrnek, global.__jbaSadeOrnek); };
    global.jbaHam = function () { return global.__jbaHamOrnek; };
    global.jbaSade = function () { return global.__jbaSadeOrnek; };
    global.jbaKopya = function () {
        var v = { ham: global.__jbaHamOrnek, sade: global.__jbaSadeOrnek };
        var m = JSON.stringify(v, function (k, x) {
            if (x && typeof x === 'object' && x.stateNode) return '[React node]';
            return x;
        }, 2);
        (navigator.clipboard && navigator.clipboard.writeText)
            ? navigator.clipboard.writeText(m).then(function () { console.log('[JBA] panoya kopyalandı, ' + m.length + ' karakter'); })
            : console.log(m);
    };

    /* Log/cache helper'ları MAIN world'de: `hizli-bul.js` içerik betiği
       isolated world'de olduğu için window.jbaLog konsoldan görünmüyordu.
       Buradaki tanımlar sayfa contextinde çalışıyor. localStorage aynı
       origin'de paylaşılıyor, yani `jba_yazma_log` her iki tarafça görülür. */
    global.jbaLog = function () {
        var l = [];
        try { l = JSON.parse(localStorage.getItem('jba_yazma_log') || '[]'); } catch (e) {}
        console.table(l);
        return l;
    };
    global.jbaCacheOku = function () {
        try { return JSON.parse(localStorage.getItem('getir_order_cache') || '{}'); } catch (e) { return {}; }
    };
    global.jbaCache = global.jbaCacheOku;
    global.jbaHataLog = function () {
        var l = [];
        try { l = JSON.parse(localStorage.getItem('jba_hata_log') || '[]'); } catch (e) {}
        console.table(l);
        return l;
    };
    global.jbaTemizle = function () {
        try { localStorage.removeItem('jba_yazma_log'); } catch (e) {}
        try { localStorage.removeItem('getir_order_cache'); } catch (e) {}
        console.log('[JBA] log ve cache silindi, sayfayı yenile.');
    };

    /* SIFIRLAMA KOMUTLARI
       Panelle veritabanı birbirine girdiğinde kullanılır.

       jbaTazele()      Defterleri siler, panelden her şeyi baştan çeker.
                        Veritabanındaki kayıtlara ve depocunun topladığı
                        ürün işaretlerine dokunmaz. Önce bu denenir.

       jbaSifirla(true) Yukarıdakine ek olarak veritabanındaki bütün
                        siparişleri siler ve panelden sıfırdan kurar.
                        TOPLAMA İŞARETLERİ GİDER, o yüzden onay istiyor.

       Asıl iş isolated world'de yapılıyor; `chrome.runtime` yalnız orada
       var. Buradan yalnız sinyal gidiyor. */
    /* Bu betik franchise.getir.com'da da çalışıyor ama sipariş modülü
       orada yok: sinyali dinleyen kimse olmaz. Sessiz beklemek yerine
       süre dolunca söylüyoruz. */
    var _sifirlamaBekleyen = 0;

    function sifirlamaSinyali(dbdeSil) {
        _sifirlamaBekleyen = Date.now();
        gonder({ type: 'JB_JBA_SIFIRLA', dbdeSil: !!dbdeSil });
        setTimeout(function () {
            if (!_sifirlamaBekleyen) return;
            _sifirlamaBekleyen = 0;
            console.warn('[JBA] Yanıt gelmedi. Bu komut yalnız depo paneli sekmesinde ' +
                'çalışıyor: warehouse.getir.com siparişler ekranı. Eklenti güncellendiyse ' +
                'sayfayı bir kez yenile.');
        }, 5000);
    }

    global.jbaTazele = function () {
        sifirlamaSinyali(false);
        console.log('%c[JBA] Tazeleniyor: defterler silindi, panel baştan okunuyor…', 'color:#0ea5e9');
        return 'bekleniyor';
    };

    global.jbaSifirla = function (onay) {
        if (onay !== true) {
            console.warn('[JBA] Bu komut veritabanındaki BÜTÜN siparişleri siler.\n' +
                'Toplanmış ürün işaretleri de gider ve panelden sıfırdan kurulur.\n' +
                'Önce jbaTazele() dene; yine düzelmezse jbaSifirla(true) yaz.');
            return 'onay gerekli: jbaSifirla(true)';
        }
        sifirlamaSinyali(true);
        console.log('%c[JBA] Sıfırlanıyor: kayıtlar siliniyor, panel baştan yazılıyor…', 'color:#ef4444');
        return 'bekleniyor';
    };

    /* Aynı listeyi tekrar tekrar yollamamak için imza karşılaştırılıyor.
       Sipariş kimliği, durumu ve adedi değişmediyse mesaj gitmiyor.
       null: hiç göndermedik. '' : boş liste gönderdik (panel boş). */
    var sonImza = null;
    var _panelBirGorunmus = false;
    var _sayfaGirisi = 0;
    var _sonZorunluDuyuru = 0;
    /* 20 saniyede bir zorunlu heartbeat: liste değişmese de yollarız.
       Sebep: sipariş panelden düştüğünde imza aynı kalırsa mesaj gitmez,
       DB'de eski kayıt "5 dk kala kalır". Zorunlu duyuru ile background
       her 20 sn'de bir güncel tumIdler'i alır, panelde olmayan silinir. */
    var ZORUNLU_DUYURU_MS = 20000;
    /* Sayfa açıldıktan/sekmeye dönüldükten sonraki İLK duyuruda `ilk: true`
       gider. Arka plan bunu görünce temizlik kilidini atlayıp panelle tam
       senkron olur. Kullanıcı saatler sonra döndüğünde eski kayıtlar bir
       tur beklemeden gitsin. */
    var _ilkDuyuruYapildi = false;

    function siparisleriDuyur() {
        try {
            if (!/^\/r\/[a-f0-9]{24}\/dashboard\/orders\/?$/.test(location.pathname)) {
                _sayfaGirisi = 0; _panelBirGorunmus = false; sonImza = null;
                _sonZorunluDuyuru = 0; _ilkDuyuruYapildi = false;
                return;
            }
            if (!_sayfaGirisi) _sayfaGirisi = Date.now();
            fotoHaritasiniGuncelle();
            var liste = siparisleriTopla();
            if (liste.length) _panelBirGorunmus = true;
            var boslukGercek = !liste.length && (_panelBirGorunmus || Date.now() - _sayfaGirisi > 6000);
            if (!liste.length && !boslukGercek) return;

            var imza = liste.map(function (o) {
                return o.siparisId + ':' + o.durum + ':' + o.kolon + ':' + o.toplamAdet + ':' + o.banko + ':' + o.toplayici + ':' + o.kurye;
            }).join('|');
            var zorunlu = Date.now() - _sonZorunluDuyuru > ZORUNLU_DUYURU_MS;
            if (imza === sonImza && !zorunlu) return;
            var ilk = !_ilkDuyuruYapildi;
            _ilkDuyuruYapildi = true;
            sonImza = imza;
            _sonZorunluDuyuru = Date.now();
            gonder({ type: 'JB_SIPARISLER', liste: liste, ilk: ilk });
            try { localStorage.setItem('jba_son_siparisler', JSON.stringify({ adet: liste.length, ornek: liste[0] || null })); } catch (e) {}
        } catch (e) { /* sessiz */ }
    }

    /* Sekmeye geri dönüldüğünde tam senkron: kullanıcı saatlerce başka
       yerdeyken panel değişmiş olabilir, DB'yi hemen panele eşitleyelim. */
    global.document.addEventListener('visibilitychange', function () {
        if (global.document.visibilityState !== 'visible') return;
        _ilkDuyuruYapildi = false;
        sonImza = null;
        siparisleriDuyur();
    });

    // ==================================================================
    // Fırın tahmini (arka-plan/firin-nobet.js, moduller/firin-uyari.js)
    //
    // Fırın sayfası açılınca panel `GET /heating-estimations` atıyor;
    // dilim dilim pişirme önerisi, o anki dilimde de raf ve donuk stok
    // geliyor. Kontrol panelinde aynı isteği, panelin kendi sipariş
    // isteğinden kopyalanan başlıklarla atıyoruz: jeton sayfada kalıyor,
    // dışarı çıkmıyor. Yeni sekme açılmıyor, sayfa çizilmiyor.
    // Sıklık sınırı burada da var: 10 sn içinde ikinci istek atılmaz,
    // son cevap döner.
    // ==================================================================

    var FIRIN_ARA_MS = 8 * 1000;
    var firinSon = null;
    var firinZaman = 0;
    var firinSuruyor = null;

    /* Panel isteklerini `new Request(url, { headers })` ile atıyor, ikinci
       parametre boş geliyor. Başlıklar o yüzden hem init'ten hem Request
       nesnesinden, panelin kendi API'sine giden her istekten toplanıyor.
       Sayaçlar dakikada birkaç kez yenilendiği için jeton hep taze kalıyor.
       Gövde türü (content-type) alınmıyor; fırın isteği GET. */
    var panelBasliklari = {};

    function panelBasliklariYakala(url, basliklar) {
        if (!url || typeof url !== 'string' || url.indexOf(TEMEL) !== 0 || !basliklar) return;
        try {
            var ekle = function (v, k) {
                var a = String(k).toLowerCase();
                if (a === 'content-type' || a === 'content-length') return;
                if (v) panelBasliklari[a] = String(v);
            };
            if (typeof basliklar.forEach === 'function') basliklar.forEach(ekle);
            else Object.keys(basliklar).forEach(function (k) { ekle(basliklar[k], k); });
        } catch (e) { /* sessiz */ }
    }

    function jetonVarMi() {
        return String(panelBasliklari.authorization || '').indexOf('Bearer ') === 0;
    }

    function firinSade(yanit) {
        var dilimler = (yanit && Array.isArray(yanit.data)) ? yanit.data : [];
        return dilimler.slice(0, 6).map(function (d) {
            return {
                bas: String(d.startDate || ''),
                son: String(d.endDate || ''),
                urunler: (Array.isArray(d.products) ? d.products : []).slice(0, 60).map(function (p) {
                    return {
                        ad: String(p.fullName || p.name || '').slice(0, 120),
                        gorsel: String(p.picURL || ''),
                        oneri: Number(p.prediction) || 0,
                        raf: typeof p.available === 'number' ? p.available : null,
                        donuk: typeof p.frozen === 'number' ? p.frozen : null,
                        rezerv: typeof p.reserve === 'number' ? p.reserve : null,
                        pisen: Number(p.cookedQuantity) || 0
                    };
                })
            };
        });
    }

    function firinTahmini() {
        if (firinSuruyor) return firinSuruyor;
        if (firinSon && Date.now() - firinZaman < FIRIN_ARA_MS) return Promise.resolve(firinSon);
        if (!jetonVarMi() || !asilFetch) return Promise.resolve({ ok: false, sebep: 'oturum' });
        var basliklar = {};
        Object.keys(panelBasliklari).forEach(function (k) { basliklar[k] = panelBasliklari[k]; });
        firinSuruyor = asilFetch(TEMEL + '/heating-estimations', { method: 'GET', headers: basliklar, credentials: 'include' })
            .then(function (r) {
                if (!r.ok) return { ok: false, sebep: 'http ' + r.status };
                return r.json().then(function (j) { return { ok: true, dilimler: firinSade(j) }; });
            })
            .catch(function () { return { ok: false, sebep: 'ağ' }; })
            .then(function (sonuc) {
                firinSuruyor = null;
                firinZaman = Date.now();
                firinSon = sonuc;
                return sonuc;
            });
        return firinSuruyor;
    }

    // ==================================================================
    // Satıştan Kaldırma Listesi (arka-plan/kaldirma-nobet.js, saatte bir)
    //
    // Depo panelinin "Satıştan Kaldırma Listesi" sayfası
    // POST /blocked-stocks/filter?offset&limit atıyor; gövde
    // { createdAt: { startDate, endDate }, warehouses: [depo] }. Aynı istek
    // panelin kendi başlıklarıyla, son N gün için sayfa sayfa atılıyor.
    // Depo kimliği adres çubuğundan; koda gömülü kimlik yok. Fırın
    // çıkışları (sebep "Fırın Ürünleri ...") hiç alınmıyor. Hasar fotoğrafı
    // adresi süreli imzalı olduğu için taşınmıyor.
    // ==================================================================

    var KALDIRMA_ARA_MS = 30 * 1000;
    var kaldirmaSon = null;
    var kaldirmaZaman = 0;
    var kaldirmaSuruyor = null;

    function depoKimligi() {
        var m = /^\/r\/([a-f0-9]{24})\//.exec(location.pathname);
        return m ? m[1] : null;
    }

    function kisiAdi(p) {
        if (!p || typeof p !== 'object') return '';
        return String(p.name || p.fullName || p.username || '').slice(0, 80);
    }

    function firinCikisiMi(k) {
        var r = k && k.reason;
        if (!r) return false;
        if (r.type === 199 || r.type === 403) return true;
        return /f[ıi]r[ıi]n/i.test(String(r.values || ''));
    }

    function kaldirmaSade(k) {
        var p = k.product || {};
        var pic = p.picURL && typeof p.picURL === 'object' ? (p.picURL.tr || p.picURL.en || '') : (p.picURL || '');
        var gecmis = Array.isArray(k.statusChangeLog) ? k.statusChangeLog : [];
        return {
            id: String(k.id || ''),
            olusturma: k.createdAt || null,
            guncelleme: k.updatedAt || null,
            durum: typeof k.status === 'number' ? k.status : null,
            sonucTipi: typeof k.conclusionType === 'number' ? k.conclusionType : null,
            sebep: String((k.reason && k.reason.values) || '').slice(0, 200),
            adet: Number(k.count) || 0,
            birim: typeof p.stockUnitOfMeasurement === 'number' ? p.stockUnitOfMeasurement : null,
            urun: {
                id: String(p.id || ''),
                ad: String(p.fullName || p.name || '').slice(0, 200),
                gorsel: String(pic || ''),
                barkod: Array.isArray(p.barcodes) && p.barcodes.length ? String(p.barcodes[0]) : ''
            },
            skt: k.expiryDate || null,
            altNeden: String((k.subReason && k.subReason.values) || '').slice(0, 160),
            nereden: String(k.fromLocationBarcode || '').slice(0, 60),
            nereye: String(k.toLocationBarcode || '').slice(0, 60),
            // Hasar fotoğrafı: süreli imzalı adres; sunucu bir kez indirip saklar
            fotoKaynak: (Array.isArray(k.damagedPicUrls) ? k.damagedPicUrls : []).filter(function (u) {
                return typeof u === 'string' && /^https:\/\//.test(u);
            }).slice(0, 3),
            olusturan: gecmis.length ? kisiAdi(gecmis[0].picker) : '',
            gecmis: gecmis.slice(0, 20).map(function (g) {
                return { durum: g.status, zaman: g.occurredAt, kisi: kisiAdi(g.picker), sonucTipi: typeof g.conclusionType === 'number' ? g.conclusionType : null };
            })
        };
    }

    // Detay (GET /blocked-stocks/<id>): listede olmayan red sebebi ve ürünün
    // "satıştan kaldırılabileceği" gün sayısı (dead) yalnız burada. Panelin
    // kendi detay isteği; kayıt başına bir kez (durum değişince yeniden),
    // ürün başına bir kez. Tur başına en fazla 60 istek, 400 ms arayla
    // (ilk turlar dolunca saatte birkaç istek kalır).
    var DETAY_ANAHTAR = 'jbKaldirmaDetay';
    var DETAY_TUR = 60;

    function detayDepoOku() {
        try {
            var d = JSON.parse(localStorage.getItem(DETAY_ANAHTAR) || 'null');
            if (d && d.k && d.o) return d;
        } catch (e) { /* bozuk */ }
        return { k: {}, o: {} };
    }

    function detayDepoYaz(d) {
        var sinir = Date.now() - 45 * 864e5;
        Object.keys(d.k).forEach(function (id) { if ((d.k[id].t || 0) < sinir) delete d.k[id]; });
        Object.keys(d.o).forEach(function (id) { if ((d.o[id].t || 0) < sinir) delete d.o[id]; });
        try { localStorage.setItem(DETAY_ANAHTAR, JSON.stringify(d)); } catch (e) { /* dolu */ }
    }

    function detayIste(id, basliklar) {
        return asilFetch(TEMEL + '/blocked-stocks/' + id, { method: 'GET', headers: basliklar, credentials: 'include' })
            .then(function (r) {
                if (r.status === 401 || r.status === 403) throw new Error('oturum');
                return r.ok ? r.json() : null;
            })
            .then(function (j) { return j && j.data ? j.data : null; });
    }

    function kaldirmaZenginlestir(kayitlar, basliklar) {
        var depo = detayDepoOku();
        var redli = { 160: true, 700: true };
        var is = [];
        var urunIstenen = {};
        kayitlar.forEach(function (k) {
            var c = depo.k[k.id];
            if (redli[k.durum] && (!c || c.s !== k.durum)) is.push({ id: k.id, oncelik: 0 });
        });
        kayitlar.forEach(function (k) {
            var pid = k.urun && k.urun.id;
            if (!pid || !k.skt || depo.o[pid] || urunIstenen[pid]) return;
            urunIstenen[pid] = true;
            is.push({ id: k.id, oncelik: 1 });
        });
        is.sort(function (a, b) { return a.oncelik - b.oncelik; });
        is = is.slice(0, DETAY_TUR);
        var temiz = {};
        Object.keys(basliklar).forEach(function (h) { if (h.toLowerCase() !== 'content-type') temiz[h] = basliklar[h]; });

        function sira(i) {
            if (i >= is.length) return Promise.resolve();
            return detayIste(is[i].id, temiz).then(function (v) {
                if (v) {
                    var rr = v.rejectReason || null;
                    var baslik = rr && rr.value && (rr.value.tr || rr.value.en) || v.rejectDescription || '';
                    var aciklama = rr && rr.description && (rr.description.tr || rr.description.en) || '';
                    depo.k[v.id || is[i].id] = {
                        s: v.status, t: Date.now(),
                        red: baslik || aciklama ? { baslik: String(baslik).slice(0, 160), aciklama: String(aciklama).slice(0, 400) } : null
                    };
                    var pid = v.product && v.product.id;
                    if (pid && typeof v.dead === 'number') depo.o[pid] = { g: v.dead, t: Date.now() };
                }
                return new Promise(function (coz) { setTimeout(coz, 400); }).then(function () { return sira(i + 1); });
            });
        }

        return sira(0).catch(function () { /* oturum ya da ağ: elimizdekiyle devam */ }).then(function () {
            detayDepoYaz(depo);
            kayitlar.forEach(function (k) {
                var c = depo.k[k.id];
                if (c && c.red) k.red = c.red;
                var pid = k.urun && k.urun.id;
                if (pid && depo.o[pid]) k.oluGun = depo.o[pid].g;
            });
            return kayitlar;
        });
    }

    function kaldirmaListesi(gun) {
        if (kaldirmaSuruyor) return kaldirmaSuruyor;
        if (kaldirmaSon && Date.now() - kaldirmaZaman < KALDIRMA_ARA_MS) return Promise.resolve(kaldirmaSon);
        var depo = depoKimligi();
        if (!depo) return Promise.resolve({ ok: false, sebep: 'depo' });
        if (!jetonVarMi() || !asilFetch) return Promise.resolve({ ok: false, sebep: 'oturum' });
        var n = Math.max(1, Math.min(31, Number(gun) || 14));
        var simdi = new Date();
        var bas = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() - (n - 1), 0, 0, 0, 0);
        var son = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate(), 23, 59, 59, 999);
        var govde = JSON.stringify({ createdAt: { startDate: bas.toISOString(), endDate: son.toISOString() }, warehouses: [depo] });
        var basliklar = {};
        Object.keys(panelBasliklari).forEach(function (k) { basliklar[k] = panelBasliklari[k]; });
        basliklar['content-type'] = 'application/json';
        var LIMIT = 100;
        var gorulen = {};
        var kayitlar = [];
        var atlanan = 0;

        function sayfa(offset, deneme) {
            return asilFetch(TEMEL + '/blocked-stocks/filter?offset=' + offset + '&limit=' + LIMIT, {
                method: 'POST', headers: basliklar, body: govde, credentials: 'include'
            }).then(function (r) {
                if (r.status === 401 || r.status === 403) throw new Error('oturum');
                if (!r.ok) throw new Error('http ' + r.status);
                return r.json();
            }).catch(function (e) {
                if (String(e && e.message) === 'oturum' || deneme >= 2) throw e;
                return new Promise(function (coz) { setTimeout(coz, 800 * (deneme + 1)); })
                    .then(function () { return sayfa(offset, deneme + 1); });
            });
        }

        function devam(offset) {
            return sayfa(offset, 0).then(function (j) {
                var d = j && j.data;
                var liste = d && Array.isArray(d.blockedStocks) ? d.blockedStocks : [];
                var toplam = d && typeof d.total === 'number' ? d.total : liste.length;
                liste.forEach(function (k) {
                    if (!k || !k.id || gorulen[k.id]) return;
                    gorulen[k.id] = true;
                    if (firinCikisiMi(k)) { atlanan++; return; }
                    kayitlar.push(kaldirmaSade(k));
                });
                var sonraki = offset + LIMIT;
                // Sayfa dolu geldiyse ve toplam bitmediyse devam (azami 30 sayfa)
                if (liste.length === LIMIT && sonraki < toplam && sonraki < 3000) {
                    return new Promise(function (coz) { setTimeout(coz, ARA_MS); }).then(function () { return devam(sonraki); });
                }
                return kaldirmaZenginlestir(kayitlar, basliklar).then(function () {
                    return { ok: true, kayitlar: kayitlar, toplam: toplam, firin: atlanan, gun: n };
                });
            });
        }

        kaldirmaSuruyor = devam(0)
            .catch(function (e) {
                var m = String(e && e.message || e);
                return { ok: false, sebep: m === 'oturum' ? 'oturum' : (/^http/.test(m) ? m : 'ağ') };
            })
            .then(function (sonuc) {
                kaldirmaSuruyor = null;
                kaldirmaZaman = Date.now();
                kaldirmaSon = sonuc;
                return sonuc;
            });
        return kaldirmaSuruyor;
    }

    setInterval(siparisleriDuyur, 2000);
    setTimeout(siparisleriDuyur, 3000);

    global.addEventListener('message', function (e) {
        if (e.source !== global) return;
        if (e.origin !== KAYNAK) return;
        var d = e.data;
        /* İçerik betiği yeniden yayın istiyor (sayfa açılışı, sekmeye
           dönüş, gezinme). Tam senkron sayılıyor: `ilk` bayrağıyla gidip
           arka planın temizlik kilidini atlatıyor. */
        if (d && d.type === 'JB_SIPARIS_SOR') {
            sonImza = null; _ilkDuyuruYapildi = false; siparisleriDuyur(); return;
        }
        /* Arka plan nabzı (arka-plan/pano-nobet.js): sekme arkadayken Chrome
           yukarıdaki 2 sn'lik zamanlayıcıyı dakikada bire düşürüyor ve
           durum değişikliği Jet Barkod'a geç gidiyordu. Nabız bir mesaj
           olduğu için kısılmıyor; duyuru her nabızda imzayla denetleniyor,
           değişiklik yoksa hiçbir şey gönderilmiyor. */
        if (d && d.type === 'JB_SIPARIS_TIK') { siparisleriDuyur(); return; }
        /* Jet Barkod'da detay açıldı, fotoğraf linkinin süresi geçmiş (panel
           linkleri ~15 dk): tek kaydın detayı panelin kendi isteğiyle okunur. */
        if (d && d.type === 'JB_KALDIRMA_FOTO_SOR' && /^[a-f0-9]{24}$/.test(String(d.id || ''))) {
            var fno = d.no;
            var fb = {};
            Object.keys(panelBasliklari).forEach(function (h) { if (h.toLowerCase() !== 'content-type') fb[h] = panelBasliklari[h]; });
            (jetonVarMi() && asilFetch ? detayIste(String(d.id), fb) : Promise.resolve(null))
                .then(function (v) {
                    var l = v && Array.isArray(v.damagedPicUrls) ? v.damagedPicUrls.filter(function (u) { return typeof u === 'string' && /^https:\/\//.test(u); }).slice(0, 4) : null;
                    gonder({ type: 'JB_KALDIRMA_FOTO', no: fno, adresler: l });
                }, function () { gonder({ type: 'JB_KALDIRMA_FOTO', no: fno, adresler: null }); });
            return;
        }
        if (d && d.type === 'JB_KALDIRMA_SOR') {
            var kno = d.no;
            kaldirmaListesi(d.gun).then(function (sonuc) {
                gonder({ type: 'JB_KALDIRMA_LISTE', no: kno, sonuc: sonuc });
            });
            return;
        }
        if (d && d.type === 'JB_FIRIN_TAHMIN_SOR') {
            var no = d.no;
            firinTahmini().then(function (sonuc) {
                gonder({ type: 'JB_FIRIN_TAHMIN', no: no, sonuc: sonuc });
            });
            return;
        }
        if (d && d.type === 'JB_JBA_SIFIRLA_SONUC') {
            _sifirlamaBekleyen = 0;
            if (d.ok) {
                console.log('%c[JBA] Bitti. ' + (d.db ? 'Kayıtlar silindi, ' : '') +
                    'panel baştan okunuyor; birkaç saniyede yerine oturur.', 'color:#16a34a');
            } else {
                console.warn('[JBA] Sıfırlama tamamlanamadı: ' + (d.sebep || 'bilinmiyor') +
                    '\nJet Barkod sitesine bir kez girip geri dön, sonra tekrar dene.');
            }
            return;
        }
        if (!d || d.type !== 'JB_SIPARIS_GETIR') return;
        if (!d.warehouseId) {
            return gonder({ type: 'JB_SIPARIS_SONUC', data: [], error: 'Depo bilgisi yok' });
        }
        getir(d.warehouseId);
    });
})(window);
