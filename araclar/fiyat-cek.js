/**
 * Fiyat Çek — konsol aracı (Jet Barkod sayım sayfası)
 * ============================================================================
 *
 * Verdiğin ürün adlarının TOPTAN fiyatını toplar. Çıktı iki sütun: ürün adı
 * ve toptan fiyat.
 *
 * NASIL KULLANILIR
 *   1. https://jetbarkod.com.tr/sayim/ aç, giriş yapmış ol.
 *      Franchise sekmesi de açık olsun; jeton oradan geliyor.
 *   2. F12 -> Console. "allow pasting" yaz, dosyanın tamamını yapıştır.
 *   3. Ürün adlarını KOPYALA, sonra:  JBFiyat.basla()
 *
 * Listeyi tırnak içinde koda yazma; adlarda kesme işareti var ("Nuh'un",
 * "Lay's", "(15'li)") ve tırnağı ortadan kapatıyor. Araç panodan okur.
 *
 * NE YAPIYOR
 * Sayım sayfasının zaten kullandığı isteği atıyor: `POST /stocks` gövdesinde
 * yalnız o ürünün kimliği. Ürün başına tek istek, aralarında 1,5 saniye.
 * Jeton ve depo kimliği `countingSystem._resolveApiInfoForDebug()` üzerinden
 * geliyor, ikisi de koda yazılmıyor. Depo kimliği okunamazsa hiç istek
 * atmadan duruyor; o değer depodan depoya değişiyor.
 *
 * HATA GÖRÜNÜR
 * Önce tek ürünle deneme isteği atılıyor. O tutmazsa sunucunun döndüğü kod
 * ve gövde ekrana yazılıp duruluyor. Altmış altı isteği boşuna atıp sonunda
 * boş tablo göstermenin âlemi yok.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ==================================================================
    // Metin
    // ==================================================================

    var HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c' };

    function sade(metin) {
        return String(metin == null ? '' : metin)
            .toLocaleLowerCase('tr')
            .normalize('NFD')
            // birleşen işaretler; kaçış dizisiyle, konsola yapıştırınca bozulmasın
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[ığüşöçâîû]/g, function (m) { return HARF[m] || m; })
            .replace(/(\d)[.,](\d)/g, '$1$2')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* Ondalık virgül geçici imle korunuyor; yoksa ad "(15 L)" olup katalogda
       hiçbir şeye eşleşmiyor. */
    var IM = '\u0001';

    function adlariAyikla(metin) {
        var parcalar = [];
        String(metin == null ? '' : metin).split(/[\r\n]+/).forEach(function (satir) {
            satir.replace(/(\d),(\d)/g, '$1' + IM + '$2')
                 .split(',')
                 .forEach(function (p) { parcalar.push(p.split(IM).join(',')); });
        });
        return parcalar.map(function (p) { return p.trim(); })
                       .filter(function (p) { return p.length >= 3; });
    }

    function bekle(ms) {
        return new Promise(function (c) { setTimeout(c, ms); });
    }

    function metniAl(verilen) {
        if (verilen && String(verilen).trim()) return Promise.resolve(String(verilen));
        var panodan = (global.navigator && navigator.clipboard && navigator.clipboard.readText)
            ? navigator.clipboard.readText().catch(function () { return ''; })
            : Promise.resolve('');
        return panodan.then(function (pano) {
            if (pano && pano.trim()) {
                console.log('%c› Liste panodan alındı.', 'color:#8ab4ff');
                return pano;
            }
            console.log('%c› Pano okunamadı, kutu açılıyor.', 'color:#ffb454');
            return global.prompt('Ürün adlarını yapıştır (virgülle ya da alt alta):', '') || '';
        });
    }

    // ==================================================================
    // Katalog
    // ==================================================================

    function sistem() { return global.countingSystem || null; }

    function katalogListesi() {
        var s = sistem();
        if (s && Array.isArray(s.allProducts) && s.allProducts.length) return s.allProducts;
        if (global.PRODUCTS_DATA && Array.isArray(global.PRODUCTS_DATA.products)) {
            return global.PRODUCTS_DATA.products;
        }
        return [];
    }

    function adiCoz(ad, liste) {
        var a = sade(ad);
        if (!a) return null;
        for (var i = 0; i < liste.length; i++) {
            if (liste[i] && liste[i].name && sade(liste[i].name) === a) return liste[i];
        }
        var adaylar = liste.filter(function (p) {
            return p && p.name && sade(p.name).indexOf(a) !== -1;
        });
        return adaylar.length === 1 ? adaylar[0] : null;
    }

    function barkodBul(urun) {
        if (!urun || !Array.isArray(urun.barcodes)) return '';
        for (var i = 0; i < urun.barcodes.length; i++) {
            var b = urun.barcodes[i];
            if (b && b.code) return String(b.code).trim();
        }
        return '';
    }

    // ==================================================================
    // İstek
    // ==================================================================

    var apiBilgi = null;

    function jetonHazirla(t) {
        var j = String(t || '').trim();
        return j.indexOf('Bearer ') === 0 ? j : 'Bearer ' + j;
    }

    /**
     * Tek ürünün stok satırını çeker. Sayım sayfasındaki isteğin aynısı;
     * fark, hataları yutmaması. `_fetchApiProductRowByProductId` her hatada
     * sessizce null dönüyor, o yüzden neyin ters gittiği görünmüyordu.
     */
    function satirCek(urunId, barkod) {
        var uc = apiBilgi.stockEndpoint || 'https://franchise-api-gateway.getirapi.com/stocks';
        return fetch(uc + '?limit=100&offset=0', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': jetonHazirla(apiBilgi.token),
                'Accept': '*/*'
            },
            body: JSON.stringify({
                warehouseIds: [apiBilgi.warehouseId],
                productIds: [String(urunId)],
                sort: { available: 1 }
            })
        }).then(function (y) {
            return y.text().then(function (metin) {
                if (!y.ok) {
                    var e = new Error('sunucu ' + y.status + ' — ' + metin.slice(0, 160));
                    e.durum = y.status;
                    throw e;
                }
                var veri;
                try { veri = JSON.parse(metin); }
                catch (x) { throw new Error('yanıt JSON değil: ' + metin.slice(0, 160)); }

                var satirlar = (veri && Array.isArray(veri.data)) ? veri.data : [];
                if (!satirlar.length) return null;

                if (barkod) {
                    for (var i = 0; i < satirlar.length; i++) {
                        var p = satirlar[i].packagingInfo;
                        if (!p) continue;
                        for (var k in p) {
                            if (p[k] && p[k].barcodes && p[k].barcodes.indexOf(barkod) !== -1) return satirlar[i];
                        }
                    }
                }
                return satirlar[0];
            });
        });
    }

    function paraYaz(sayi) {
        if (typeof sayi !== 'number' || !isFinite(sayi)) return null;
        try {
            return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(sayi);
        } catch (e) { return String(sayi); }
    }

    /** Toptan fiyat satırda ya da içindeki product nesnesinde olabiliyor. */
    function toptanFiyat(satir) {
        if (!satir || typeof satir !== 'object') return { yazi: null, sayi: null };
        var kaynaklar = [satir, satir.product];
        for (var i = 0; i < kaynaklar.length; i++) {
            var k = kaynaklar[i];
            if (!k || typeof k !== 'object') continue;
            if (k.wholesalePriceText) {
                return { yazi: String(k.wholesalePriceText),
                         sayi: (typeof k.wholesalePrice === 'number' ? k.wholesalePrice : null) };
            }
            if (typeof k.wholesalePrice === 'number') {
                return { yazi: paraYaz(k.wholesalePrice), sayi: k.wholesalePrice };
            }
        }
        return { yazi: null, sayi: null };
    }

    // ==================================================================
    // Akış
    // ==================================================================

    var API = {
        ARA_MS: 1500,
        sonuc: null,

        basla: function (adMetni) {
            return metniAl(adMetni).then(function (metin) {
                if (!metin || !metin.trim()) {
                    console.log('%cListe boş. Adları kopyalayıp JBFiyat.basla() yaz.', 'color:#ffb454');
                    return;
                }
                return API._yurut(metin);
            });
        },

        _yurut: function (adMetni) {
            var s = sistem();
            if (!s || typeof s._resolveApiInfoForDebug !== 'function') {
                console.log('%c⚠ Bu betik Jet Barkod sayım sayfasında çalışır: ' +
                            'https://jetbarkod.com.tr/sayim/', 'color:#ff7676;font-weight:bold');
                return Promise.resolve();
            }

            var liste = katalogListesi();
            if (!liste.length) {
                console.log('%c⚠ Katalog henüz yüklenmemiş. Birkaç saniye sonra tekrar dene.',
                            'color:#ffb454');
                return Promise.resolve();
            }

            var adlar = adlariAyikla(adMetni);
            var islenecek = [];
            var katalogdaYok = [];
            adlar.forEach(function (ad) {
                var u = adiCoz(ad, liste);
                var pid = u && (u.id || u.productId);
                if (u && pid) islenecek.push({ ad: u.name, urunId: String(pid), barkod: barkodBul(u) });
                else katalogdaYok.push(ad);
            });

            console.log('%c› ' + adlar.length + ' ad okundu, ' + islenecek.length +
                        ' tanesi ürüne çözüldü.', 'color:#8ab4ff');
            if (katalogdaYok.length) {
                console.log('%c⚠ Katalogda bulunamayan ' + katalogdaYok.length + ':', 'color:#ffb454');
                katalogdaYok.forEach(function (a) { console.log('    ' + a); });
            }
            if (!islenecek.length) return Promise.resolve();

            return Promise.resolve(s._resolveApiInfoForDebug()).then(function (bilgi) {
                if (!bilgi || !bilgi.token) {
                    console.log('%c⚠ Jeton yok. Getir franchise sekmesini açıp sayfayı yenile, ' +
                                'sonra tekrar dene.', 'color:#ff7676;font-weight:bold');
                    return;
                }
                if (!bilgi.warehouseId) {
                    console.log('%c⚠ Depo kimliği okunamadı. Franchise sekmesinde stok sayfasını ' +
                                'bir kez aç, sonra tekrar dene.', 'color:#ff7676;font-weight:bold');
                    return;
                }
                apiBilgi = bilgi;

                // Deneme isteği. Tutmazsa 66 isteği boşuna atmayalım.
                console.log('%c› Deneme isteği gönderiliyor…', 'color:#8ab4ff');
                return satirCek(islenecek[0].urunId, islenecek[0].barkod).then(function (satir) {
                    var f = toptanFiyat(satir);
                    if (!satir) {
                        console.log('%c⚠ Deneme isteği yanıt verdi ama ürün dönmedi. ' +
                                    'Depo kimliği bu ürünü tanımıyor olabilir. Duruyorum.',
                                    'color:#ff7676;font-weight:bold');
                        return;
                    }
                    if (!f.yazi) {
                        console.log('%c⚠ Ürün geldi ama toptan fiyat alanı yok. ' +
                                    'Ham satır aşağıda, bakalım nerede duruyor:',
                                    'color:#ff7676;font-weight:bold');
                        console.log(satir);
                        return;
                    }
                    console.log('%c✓ Deneme tuttu: ' + islenecek[0].ad + ' → ' + f.yazi,
                                'color:#7ddc9a;font-weight:bold');
                    return API._topla(islenecek, katalogdaYok, satir);
                }).catch(function (e) {
                    console.log('%c⚠ Deneme isteği başarısız: ' + ((e && e.message) || e),
                                'color:#ff7676;font-weight:bold');
                    if (e && e.durum === 401) {
                        console.log('   Jetonun süresi dolmuş. Franchise sekmesini yenile.');
                    }
                });
            });
        },

        _topla: function (islenecek, katalogdaYok, ilkSatir) {
            var kayitlar = [];
            var basarisiz = [];
            var i = 0;

            var f0 = toptanFiyat(ilkSatir);
            kayitlar.push({ ad: islenecek[0].ad, toptanFiyat: f0.yazi, toptanSayi: f0.sayi });
            i = 1;

            console.log('%c› ' + islenecek.length + ' ürün, aralarında ' + API.ARA_MS + ' ms. ' +
                        'Yaklaşık ' + Math.ceil(islenecek.length * API.ARA_MS / 1000) + ' saniye.',
                        'color:#8ab4ff');

            function tur() {
                if (i >= islenecek.length) return Promise.resolve();
                var it = islenecek[i];
                return bekle(API.ARA_MS).then(function () {
                    return satirCek(it.urunId, it.barkod);
                }).then(function (satir) {
                    var f = toptanFiyat(satir);
                    if (f.yazi) kayitlar.push({ ad: it.ad, toptanFiyat: f.yazi, toptanSayi: f.sayi });
                    else basarisiz.push({ ad: it.ad, sebep: satir ? 'toptan fiyat yok' : 'ürün dönmedi' });
                }).catch(function (e) {
                    basarisiz.push({ ad: it.ad, sebep: String((e && e.message) || e) });
                }).then(function () {
                    i++;
                    console.log('  ' + i + '/' + islenecek.length + '  ' + it.ad);
                    return tur();
                });
            }

            return tur().then(function () {
                API.sonuc = {
                    olusturma: new Date().toISOString(),
                    istenen: islenecek.length,
                    alinan: kayitlar.length,
                    katalogdaBulunamayan: katalogdaYok,
                    fiyatiAlinamayan: basarisiz,
                    urunler: kayitlar.map(function (k) {
                        return { ad: k.ad, toptanFiyat: k.toptanFiyat };
                    })
                };

                console.log('%c\n✓ Bitti. ' + kayitlar.length + '/' + islenecek.length +
                            ' ürünün toptan fiyatı alındı.', 'color:#7ddc9a;font-weight:bold');
                if (basarisiz.length) {
                    console.log('%c  Alınamayan ' + basarisiz.length + ':', 'color:#ffb454');
                    basarisiz.forEach(function (b) { console.log('    ' + b.ad + '  (' + b.sebep + ')'); });
                }
                API.tablo();

                var json = JSON.stringify(API.sonuc.urunler, null, 2);
                try {
                    navigator.clipboard.writeText(json).then(function () {
                        console.log('%c✓ Liste panoya kopyalandı.', 'color:#7ddc9a');
                    }, function () {
                        console.log('Pano izni yok: copy(JSON.stringify(JBFiyat.sonuc.urunler,null,2))');
                    });
                } catch (e) {
                    console.log('copy(JSON.stringify(JBFiyat.sonuc.urunler,null,2))');
                }
                return API.sonuc;
            });
        },

        /** Sonucu iki sütunlu tablo olarak basar. */
        tablo: function () {
            if (!API.sonuc || !API.sonuc.urunler.length) {
                console.log('Gösterilecek sonuç yok.');
                return;
            }
            var satirlar = {};
            API.sonuc.urunler.forEach(function (u) { satirlar[u.ad] = { 'Toptan Fiyat': u.toptanFiyat }; });
            console.table(satirlar);
        }
    };

    global.JBFiyat = API;

    console.log('%cJBFiyat hazır.', 'color:#7ddc9a;font-weight:bold');
    console.log('Ürün adlarını KOPYALA, sonra:  JBFiyat.basla()');
})(window);
