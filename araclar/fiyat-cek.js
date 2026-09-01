/**
 * Fiyat Çek — konsol aracı (Jet Barkod sayım sayfası)
 * ============================================================================
 *
 * Verdiğin ürün adlarının satış ve TOPTAN fiyatını toplar, tablo + JSON verir.
 *
 * NASIL KULLANILIR
 *   1. https://jetbarkod.com.tr/sayim/ sayfasını aç (giriş yapmış ol).
 *      Franchise sekmesi de açık olsun; jeton oradan geliyor.
 *   2. F12 -> Console. "allow pasting" yaz, sonra bu dosyanın tamamını
 *      yapıştır, Enter. `JBFiyat hazır.` görmelisin.
 *   3. Ürün adlarını KOPYALA (virgülle ya da alt alta), sonra yaz:
 *        JBFiyat.basla()
 *
 *      Listeyi tırnak içinde koda yazma; ürün adlarında kesme işareti var
 *      ("Nuh'un", "Lay's", "(15'li)") ve tırnağı ortadan kapatıyor. Araç
 *      listeyi panodan alır, pano okunamazsa yapıştırman için kutu açar.
 *   4. Sonuç konsola tablo olarak basılır, JSON panoya kopyalanır.
 *
 * NE YAPIYOR
 * Sayım sayfasının zaten kullandığı yolu kullanıyor, yeni bir şey icat
 * etmiyor: adı katalogdan ürün kimliğine çeviriyor, sonra her ürün için
 * `countingSystem._fetchApiProductRowByProductId` ile TEK istek atıyor.
 * O istek `POST /stocks` gövdesine yalnız o ürünün kimliğini koyuyor.
 * İstekler sırayla ve aralıklı gidiyor, varsayılan 1,5 saniye.
 *
 * Jeton ve depo kimliği `_resolveApiInfoForDebug` üzerinden geliyor; ikisi de
 * koda yazılmıyor. Depo kimliği bulunamazsa araç istek atmadan duruyor,
 * çünkü o değer depodan depoya değişiyor ve yanlışı başkasının deposuna
 * istek atmak demek.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ==================================================================
    // Metin işleri
    // ==================================================================

    var HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c' };

    function sade(metin) {
        return String(metin == null ? '' : metin)
            .toLocaleLowerCase('tr')
            .normalize('NFD')
            // birleşen işaretler; kaçış dizisiyle yazıldı, konsola yapıştırınca bozulmasın
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[ığüşöçâîû]/g, function (m) { return HARF[m] || m; })
            .replace(/(\d)[.,](\d)/g, '$1$2')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* Ondalık virgül geçici bir imle korunuyor; yoksa ad bozulup "(15 L)"
       hâline geliyor ve katalogda hiçbir şeye eşleşmiyor. */
    var IM = '\u0001';

    /** Virgülle böler ama "1,5 L" içindeki ondalık virgülü ayırıcı saymaz. */
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

    /**
     * Listeyi nereden alacağını çözer: önce pano, olmazsa kutu. Liste koda
     * yazılmıyor; ürün adlarındaki kesme işareti tırnaklı diziyi kapatıyor.
     */
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
            console.log('%c› Pano okunamadı, kutu açılıyor. Listeyi oraya yapıştır.', 'color:#ffb454');
            return global.prompt('Ürün adlarını yapıştır (virgülle ya da alt alta):', '') || '';
        });
    }

    // ==================================================================
    // Katalogdan ürün çözümü
    // ==================================================================

    function sistem() {
        return global.countingSystem || null;
    }

    function urunleri() {
        var s = sistem();
        return (s && Array.isArray(s.allProducts)) ? s.allProducts : [];
    }

    function adiCoz(ad, liste) {
        var a = sade(ad);
        if (!a) return null;

        // Önce birebir tam ad.
        for (var i = 0; i < liste.length; i++) {
            if (liste[i].name && sade(liste[i].name) === a) return liste[i];
        }
        // Sonra adı içeren TEK kayıt.
        var adaylar = liste.filter(function (p) {
            return p.name && sade(p.name).indexOf(a) !== -1;
        });
        if (adaylar.length === 1) return adaylar[0];
        return null;
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
    // Yanıttan fiyat
    // ==================================================================

    function paraYaz(sayi) {
        if (typeof sayi !== 'number' || !isFinite(sayi)) return null;
        try {
            return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(sayi);
        } catch (e) {
            return String(sayi);
        }
    }

    /* Alan adları uydurma değil; sayım sayfasının okuduğu alanların aynısı
       (js/counting.js, _summarizeApiProductRow). */
    function fiyatCikar(satir) {
        if (!satir || typeof satir !== 'object') return null;
        var toptan = (typeof satir.wholesalePrice === 'number') ? satir.wholesalePrice : null;
        var satis = (typeof satir.price === 'number') ? satir.price : null;
        return {
            toptanFiyat: toptan,
            toptanFiyatYazi: satir.wholesalePriceText || paraYaz(toptan),
            satisFiyati: satis,
            satisFiyatiYazi: satir.priceText || paraYaz(satis),
            kdv: (satir.vat != null ? satir.vat : null),
            toptanKdv: (satir.wholesaleVat != null ? satir.wholesaleVat : null),
            stok: (typeof satir.available === 'number' ? satir.available : null)
        };
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
                    console.log('%cListe boş geldi. Ürün adlarını kopyalayıp ' +
                                'JBFiyat.basla() yaz.', 'color:#ffb454');
                    return;
                }
                return API._yurut(metin);
            });
        },

        _yurut: function (adMetni) {
            var s = sistem();
            if (!s || typeof s._fetchApiProductRowByProductId !== 'function') {
                console.log('%c⚠ Sayım sistemi yüklü değil. Bu betik Jet Barkod sayım ' +
                            'sayfasında çalışır:', 'color:#ffb454;font-weight:bold');
                console.log('   https://jetbarkod.com.tr/sayim/');
                return Promise.resolve();
            }

            var liste = urunleri();
            if (!liste.length) {
                console.log('%c⚠ Katalog daha yüklenmemiş. Birkaç saniye sonra tekrar dene.',
                            'color:#ffb454');
                return Promise.resolve();
            }

            var adlar = adlariAyikla(adMetni);
            console.log('%c› ' + adlar.length + ' ad okundu.', 'color:#8ab4ff');

            var islenecek = [];
            var katalogdaYok = [];
            adlar.forEach(function (ad) {
                var u = adiCoz(ad, liste);
                var pid = u && (u.id || u.productId);
                if (u && pid) {
                    islenecek.push({ istenen: ad, ad: u.name, urunId: String(pid), barkod: barkodBul(u) });
                } else {
                    katalogdaYok.push(ad);
                }
            });

            if (katalogdaYok.length) {
                console.log('%c⚠ Katalogda bulunamayan ' + katalogdaYok.length + ' ad:', 'color:#ffb454');
                katalogdaYok.forEach(function (a) { console.log('    ' + a); });
            }
            if (!islenecek.length) {
                console.log('%cHiçbir ad ürüne çözülemedi, duruyorum.', 'color:#ff7676');
                return Promise.resolve();
            }

            return s._resolveApiInfoForDebug().then(function (apiInfo) {
                if (!apiInfo || !apiInfo.token) {
                    console.log('%c⚠ Jeton yok. Getir franchise sekmesini açıp sayfayı yenile, ' +
                                'sonra tekrar dene.', 'color:#ff7676;font-weight:bold');
                    return;
                }
                /* Depo kimliği koda yazılmıyor. Bulunamazsa istek atmıyoruz;
                   sabit bir kimlikle istek atmak başkasının deposunu sormak olur. */
                if (!apiInfo.warehouseId) {
                    console.log('%c⚠ Depo kimliği okunamadı. Franchise sekmesinde stok ' +
                                'sayfasını bir kez aç, sonra tekrar dene.', 'color:#ff7676;font-weight:bold');
                    return;
                }

                console.log('%c› ' + islenecek.length + ' ürün, aralarında ' + API.ARA_MS +
                            ' ms. Yaklaşık ' + Math.ceil(islenecek.length * API.ARA_MS / 1000) +
                            ' saniye sürer.', 'color:#8ab4ff');

                var kayitlar = [];
                var basarisiz = [];
                var i = 0;

                function tur() {
                    if (i >= islenecek.length) return Promise.resolve();
                    var it = islenecek[i];

                    return Promise.resolve(s._fetchApiProductRowByProductId(it.urunId, it.barkod))
                        .then(function (satir) {
                            var f = fiyatCikar(satir);
                            if (f && (f.toptanFiyat != null || f.satisFiyati != null)) {
                                kayitlar.push({
                                    ad: it.ad,
                                    barkod: it.barkod,
                                    toptanFiyat: f.toptanFiyat,
                                    toptanFiyatYazi: f.toptanFiyatYazi,
                                    satisFiyati: f.satisFiyati,
                                    satisFiyatiYazi: f.satisFiyatiYazi,
                                    kdv: f.kdv,
                                    toptanKdv: f.toptanKdv,
                                    stok: f.stok
                                });
                            } else {
                                basarisiz.push({ ad: it.ad, barkod: it.barkod,
                                                 sebep: satir ? 'yanıtta fiyat yok' : 'ürün dönmedi' });
                            }
                        })
                        .catch(function (e) {
                            basarisiz.push({ ad: it.ad, barkod: it.barkod,
                                             sebep: String((e && e.message) || e) });
                        })
                        .then(function () {
                            i++;
                            console.log('  ' + i + '/' + islenecek.length + '  ' + it.ad);
                            if (i >= islenecek.length) return;
                            return bekle(API.ARA_MS).then(tur);
                        });
                }

                return tur().then(function () {
                    var cikti = {
                        olusturma: new Date().toISOString(),
                        istenen: islenecek.length,
                        alinan: kayitlar.length,
                        katalogdaBulunamayan: katalogdaYok,
                        fiyatiAlinamayan: basarisiz,
                        urunler: kayitlar
                    };
                    API.sonuc = cikti;

                    console.log('%c\n✓ Bitti. ' + kayitlar.length + '/' + islenecek.length +
                                ' ürünün fiyatı alındı.', 'color:#7ddc9a;font-weight:bold');
                    if (basarisiz.length) {
                        console.log('%c  Fiyatı alınamayan ' + basarisiz.length + ':', 'color:#ffb454');
                        basarisiz.forEach(function (b) { console.log('    ' + b.ad + '  (' + b.sebep + ')'); });
                    }
                    if (kayitlar.length && console.table) {
                        console.table(kayitlar.map(function (u) {
                            return {
                                'Ürün': u.ad,
                                'Toptan': u.toptanFiyatYazi,
                                'Satış': u.satisFiyatiYazi,
                                'Stok': u.stok
                            };
                        }));
                    }

                    var json = JSON.stringify(cikti, null, 2);
                    console.log('JSON `JBFiyat.sonuc` içinde. Panoya kopyalamayı deniyorum…');
                    try {
                        navigator.clipboard.writeText(json).then(function () {
                            console.log('%c✓ Panoya kopyalandı.', 'color:#7ddc9a');
                        }, function () {
                            console.log('%cPano izni yok. `copy(JSON.stringify(JBFiyat.sonuc,null,2))` yaz.',
                                        'color:#ffb454');
                        });
                    } catch (e) {
                        console.log('`copy(JSON.stringify(JBFiyat.sonuc,null,2))` yaz.');
                    }
                    return cikti;
                });
            });
        },

        /** Sadece tabloyu yeniden bas. */
        tablo: function () {
            if (!API.sonuc) { console.log('Henüz sonuç yok.'); return; }
            console.table(API.sonuc.urunler.map(function (u) {
                return { 'Ürün': u.ad, 'Toptan': u.toptanFiyatYazi, 'Satış': u.satisFiyatiYazi, 'Stok': u.stok };
            }));
        }
    };

    global.JBFiyat = API;

    console.log('%cJBFiyat hazır.', 'color:#7ddc9a;font-weight:bold');
    console.log('Ürün adlarını KOPYALA, sonra şunu yaz:  JBFiyat.basla()');
    console.log('İstekler arası bekleme: JBFiyat.ARA_MS = ' + API.ARA_MS + ' ms');
})(window);
