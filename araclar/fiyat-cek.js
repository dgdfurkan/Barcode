/**
 * Fiyat Çek — konsol aracı
 * ============================================================================
 *
 * Verdiğin ürün adları için franchise panelinden SATIŞ ve TOPTAN fiyatı
 * toplar, JSON verir.
 *
 * NASIL KULLANILIR
 *   1. https://franchise.getir.com/stock/movements  (Stok > Stok Hareketleri)
 *      sayfasını aç.
 *   2. F12 -> Console. "allow pasting" yaz, sonra bu dosyanın tamamını
 *      yapıştır, Enter. Alt satırda `JBFiyat hazır.` görmelisin.
 *   3. Ürün adlarını KOPYALA (virgülle ya da alt alta), sonra yaz:
 *        JBFiyat.basla()
 *      Listeyi tırnak içinde koda yazma; ürün adlarında kesme işareti var
 *      ("Nuh'un", "Lay's", "(15'li)") ve tırnağı ortadan kapatıyor. Araç
 *      listeyi panodan alır, pano okunamazsa yapıştırman için kutu açar.
 *   4. Araç senden tablonun altındaki sayfa okuna BİR KEZ basmanı ister.
 *      Bastıktan sonra gerisini kendisi yürütür.
 *   5. Bitince JSON hem konsola yazılır hem panoya kopyalanır.
 *
 * NEDEN STOK HAREKETLERİ SAYFASI
 * Mevcut Stok sayfasında fiyat sütunu yok; oradaki ürün araması da ağa hiç
 * çıkmıyor, listeyi tarayıcıda süzüyor. Fiyat "Stok Hareketleri" sayfasında:
 * tablodaki "Birim Fiyat" sütunu orada. Sayfanın çektiği kayıtta ürün nesnesi
 * şu alanları taşıyor: `price` (satış), `wholesalePrice` (toptan), `vat`,
 * `wholesaleVat`, `priceText`, `wholesalePriceText`, `currency`, `unitPrice`.
 *
 * NEDEN SENDEN BİR TIK İSTİYOR
 * İsteği biz uydurmuyoruz. Sen sayfayı değiştirince sayfanın kendi isteği
 * gidiyor; biz onun adresini ve başlıklarını yakalayıp yalnızca `offset`
 * değerini artırarak aynı isteği tekrarlıyoruz. Böylece Getir'e sayfanın
 * zaten attığı istekten başka bir şey gitmiyor, oturum anahtarını biz
 * aramıyoruz, depo kimliği koda yazılmıyor.
 *
 * HIZ
 * Sayfalar arası 2 saniye. Düşük Stok modülünde kullanılan aralıkla aynı.
 * `JBFiyat.ARA_MS` ile değiştirebilirsin ama aşağı çekme.
 *
 * KAPSAM
 * Stok hareketleri bir kayıt defteri; yalnız hareket görmüş ürünler geçiyor.
 * Uzun süredir hareket görmemiş ürün taramada çıkmayabilir. Araç
 * bulamadıklarını sonunda ayrıca listeler, sessizce yutmaz.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var KATALOG = 'https://jetbarkod.com.tr/products.json';
    var HAREKET_IZI = '/stocks/stock-movements';

    /* Alan adları uydurma değil, gerçek yanıttan okundu. */
    var FIYAT_ALANLARI = {
        price: 'satisFiyati',
        priceText: 'satisFiyatiYazi',
        wholesalePrice: 'toptanFiyat',
        wholesalePriceText: 'toptanFiyatYazi',
        vat: 'kdv',
        wholesaleVat: 'toptanKdv',
        unitPrice: 'birimFiyat',
        priceTypeText: 'fiyatTuru',
        currency: 'paraBirimi'
    };

    // ==================================================================
    // Türkçe metin sadeleştirme (sitedeki arama ile aynı kural)
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
    // Katalogdan barkod çözümü
    // ==================================================================

    var katalog = null;

    function katalogYukle() {
        if (katalog) return Promise.resolve(katalog);
        console.log('%c› Katalog indiriliyor…', 'color:#8ab4ff');
        return fetch(KATALOG, { cache: 'force-cache' })
            .then(function (y) {
                if (!y.ok) throw new Error('Katalog indirilemedi (' + y.status + ')');
                return y.json();
            })
            .then(function (veri) {
                var liste = (veri && veri.products) || [];
                var dizin = new Map();
                liste.forEach(function (p) {
                    if (!p || !p.name) return;
                    var a = sade(p.name);
                    if (!dizin.has(a)) dizin.set(a, p);
                });
                katalog = { liste: liste, dizin: dizin };
                console.log('%c› ' + liste.length + ' ürünlük katalog hazır.', 'color:#7ddc9a');
                return katalog;
            });
    }

    function barkodBul(urun) {
        if (!urun || !Array.isArray(urun.barcodes)) return '';
        for (var i = 0; i < urun.barcodes.length; i++) {
            var b = urun.barcodes[i];
            if (b && b.code) return String(b.code).trim();
        }
        return '';
    }

    function adlariCoz(adlar) {
        var cozulen = [];
        var eksik = [];
        adlar.forEach(function (ad) {
            var urun = katalog.dizin.get(sade(ad));
            if (!urun) {
                // Tam ad tutmadıysa adı içeren TEK bir kayıt varsa onu al.
                var a = sade(ad);
                var adaylar = katalog.liste.filter(function (p) {
                    return p.name && sade(p.name).indexOf(a) !== -1;
                });
                if (adaylar.length === 1) urun = adaylar[0];
            }
            var kod = barkodBul(urun);
            if (urun && kod) cozulen.push({ istenen: ad, ad: urun.name, barkod: kod });
            else eksik.push(ad);
        });
        return { cozulen: cozulen, eksik: eksik };
    }

    // ==================================================================
    // Sayfanın kendi isteğini yakalama
    // ==================================================================

    var sablon = null;
    var sablonuCozen = null;
    var asilFetch = null;
    var asilAc = null;
    var asilYolla = null;

    function hareketIstegiMi(url) {
        return typeof url === 'string' && url.indexOf(HAREKET_IZI) !== -1;
    }

    function basliklariDuzle(h) {
        var o = {};
        if (!h) return o;
        try {
            if (typeof Headers !== 'undefined' && h instanceof Headers) {
                h.forEach(function (v, k) { o[k] = v; });
                return o;
            }
        } catch (e) { /* sessiz */ }
        if (Array.isArray(h)) {
            h.forEach(function (c) { o[c[0]] = c[1]; });
            return o;
        }
        Object.keys(h).forEach(function (k) { o[k] = h[k]; });
        return o;
    }

    function sablonuKaydet(yontem, url, basliklar, govde) {
        if (sablon) return;
        sablon = {
            yontem: yontem || 'GET',
            url: String(url),
            basliklar: basliklar || {},
            govde: typeof govde === 'string' ? govde : null
        };
        console.log('%c✓ İstek şekli öğrenildi.', 'color:#7ddc9a;font-weight:bold');
        dinlemeyiBirak();
        if (sablonuCozen) sablonuCozen();
    }

    function dinlemeyeBasla() {
        if (asilFetch) return;
        asilFetch = global.fetch;
        global.fetch = function (girdi, ayar) {
            /* Referansı önce al. sablonuKaydet sarmayı geri alıp asilFetch'i
               boşaltıyor; aşağıda ona dokunursak SENİN isteğini patlatırız. */
            var asil = asilFetch;
            try {
                var url = (typeof girdi === 'string') ? girdi : (girdi && girdi.url);
                if (hareketIstegiMi(url)) {
                    var bas = basliklariDuzle((ayar && ayar.headers) || (girdi && girdi.headers));
                    sablonuKaydet((ayar && ayar.method) || 'GET', url, bas,
                                  ayar && typeof ayar.body === 'string' ? ayar.body : null);
                }
            } catch (e) { /* sessiz */ }
            return asil.apply(this, arguments);
        };

        asilAc = XMLHttpRequest.prototype.open;
        asilYolla = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (yontem, url) {
            this.__jbYontem = yontem;
            this.__jbUrl = url;
            this.__jbBas = {};
            var asilBaslik = this.setRequestHeader;
            this.setRequestHeader = function (k, v) {
                try { this.__jbBas[k] = v; } catch (e) { /* sessiz */ }
                return asilBaslik.apply(this, arguments);
            };
            return asilAc.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (govde) {
            var asil = asilYolla;   // yukarıdaki gerekçe
            try {
                if (hareketIstegiMi(this.__jbUrl)) {
                    sablonuKaydet(this.__jbYontem, this.__jbUrl, this.__jbBas,
                                  typeof govde === 'string' ? govde : null);
                }
            } catch (e) { /* sessiz */ }
            return asil.apply(this, arguments);
        };
    }

    function dinlemeyiBirak() {
        if (asilFetch) { global.fetch = asilFetch; asilFetch = null; }
        if (asilAc) { XMLHttpRequest.prototype.open = asilAc; asilAc = null; }
        if (asilYolla) { XMLHttpRequest.prototype.send = asilYolla; asilYolla = null; }
    }

    // ==================================================================
    // İsteği tekrarlama
    // ==================================================================

    /* fetch bu başlıkları kendisi kuruyor; yakalanan istekten kopyalamak
       ya hata veriyor ya sessizce yok sayılıyor. */
    var YASAKLI = ['content-length', 'host', 'connection', 'origin', 'referer',
                   'cookie', 'user-agent', 'accept-encoding'];

    function temizBasliklar(bas) {
        var o = {};
        Object.keys(bas || {}).forEach(function (k) {
            if (YASAKLI.indexOf(String(k).toLowerCase()) === -1) o[k] = bas[k];
        });
        return o;
    }

    function sayfaCek(offset, limit) {
        var u = new URL(sablon.url, location.origin);
        u.searchParams.set('offset', String(offset));
        u.searchParams.set('limit', String(limit));

        var ayar = {
            method: sablon.yontem,
            headers: temizBasliklar(sablon.basliklar),
            credentials: 'include'
        };
        if (sablon.govde && sablon.yontem !== 'GET' && sablon.yontem !== 'HEAD') {
            ayar.body = sablon.govde;
        }

        return fetch(u.toString(), ayar).then(function (y) {
            if (y.status === 401 || y.status === 403) {
                throw new Error('Oturum düştü. Sayfayı yenile ve baştan başla.');
            }
            if (!y.ok) throw new Error('Sunucu ' + y.status);
            return y.json();
        });
    }

    // ==================================================================
    // Yanıttan fiyat ayıklama
    // ==================================================================

    function coklu(deger) {
        if (deger == null) return '';
        if (typeof deger === 'string') return deger;
        if (typeof deger === 'object') return deger.tr || deger.en || '';
        return String(deger);
    }

    function urunBarkodu(u) {
        try {
            var p = u.packagingInfo && u.packagingInfo['1'];
            if (p && p.barcodes && p.barcodes.length) return String(p.barcodes[0]).trim();
        } catch (e) { /* sessiz */ }
        return '';
    }

    function fiyatKaydi(u) {
        var k = {};
        Object.keys(FIYAT_ALANLARI).forEach(function (alan) {
            var v = u[alan];
            if (v === undefined || v === null || v === '') return;
            k[FIYAT_ALANLARI[alan]] = (typeof v === 'object') ? coklu(v) : v;
        });
        return k;
    }

    function satirlariAyikla(veri) {
        if (Array.isArray(veri)) return veri;
        if (!veri || typeof veri !== 'object') return [];
        if (Array.isArray(veri.data)) return veri.data;
        if (veri.data && Array.isArray(veri.data.data)) return veri.data.data;
        return [];
    }

    function devamVarMi(veri) {
        if (!veri || typeof veri !== 'object') return false;
        if (typeof veri.hasNext === 'boolean') return veri.hasNext;
        if (veri.data && typeof veri.data.hasNext === 'boolean') return veri.data.hasNext;
        return true;
    }

    // ==================================================================
    // Akış
    // ==================================================================

    var API = {
        ARA_MS: 2000,
        SAYFA_BOYU: 100,
        EN_COK_SAYFA: 120,
        sonuc: null,

        basla: function (adMetni) {
            return metniAl(adMetni).then(function (metin) {
                if (!metin || !metin.trim()) {
                    console.log('%cListe boş geldi. Ürün adlarını kopyalayıp ' +
                                'JBFiyat.basla() yaz.', 'color:#ffb454');
                    return;
                }
                return API._listeyleBasla(metin);
            });
        },

        _listeyleBasla: function (adMetni) {
            if (location.pathname.indexOf('/stock/movements') === -1) {
                console.log('%c⚠ Yanlış sayfadasın. Stok > Stok Hareketleri sayfasını aç:',
                            'color:#ffb454;font-weight:bold');
                console.log('   https://franchise.getir.com/stock/movements');
                return;
            }

            sablon = null;
            var adlar = adlariAyikla(adMetni);
            console.log('%c› ' + adlar.length + ' ad okundu.', 'color:#8ab4ff');

            return katalogYukle().then(function () {
                var c = adlariCoz(adlar);
                if (c.eksik.length) {
                    console.log('%c⚠ Katalogda bulunamayan ' + c.eksik.length + ' ad:', 'color:#ffb454');
                    c.eksik.forEach(function (a) { console.log('    ' + a); });
                }
                if (!c.cozulen.length) {
                    console.log('%cHiçbir ad barkoda çözülemedi, duruyorum.', 'color:#ff7676');
                    return;
                }
                API._islenecek = c.cozulen;
                API._eksik = c.eksik;

                dinlemeyeBasla();
                console.log('%c\n  ŞİMDİ SEN YAP  ', 'background:#135bec;color:#fff;font-weight:bold');
                console.log('%cTablonun altındaki sayfa okuna bir kez bas (ileri ya da geri, fark etmez).',
                            'color:#f2f4f8');
                console.log('Bastığın anda ' + c.cozulen.length + ' ürünün fiyatını kendim toplarım.\n');

                return new Promise(function (coz) { sablonuCozen = coz; }).then(API._yurut);
            });
        },

        _yurut: function () {
            var aranan = new Map();
            API._islenecek.forEach(function (x) { aranan.set(x.barkod, x); });

            var bulunan = new Map();
            var offset = 0;
            var sayfa = 0;
            var hatalar = [];

            console.log('%c› Toplama başladı. Sayfa başına ' + API.SAYFA_BOYU +
                        ' kayıt, sayfalar arası ' + API.ARA_MS + ' ms.', 'color:#8ab4ff');

            function tur() {
                if (sayfa >= API.EN_COK_SAYFA) return Promise.resolve();
                if (bulunan.size >= aranan.size) return Promise.resolve();

                return sayfaCek(offset, API.SAYFA_BOYU).then(function (veri) {
                    var satirlar = satirlariAyikla(veri);
                    sayfa++;

                    satirlar.forEach(function (satir) {
                        var u = satir && satir.product;
                        if (!u || typeof u !== 'object') return;
                        var kod = urunBarkodu(u);
                        if (!kod || !aranan.has(kod) || bulunan.has(kod)) return;
                        var istek = aranan.get(kod);
                        bulunan.set(kod, {
                            istenen: istek.istenen,
                            ad: istek.ad,
                            barkod: kod,
                            panelAdi: coklu(u.fullName) || coklu(u.name) || '',
                            stok: (satir.productStock && typeof satir.productStock.available === 'number')
                                ? satir.productStock.available : null,
                            fiyat: fiyatKaydi(u)
                        });
                    });

                    console.log('  ' + sayfa + '. sayfa · ' + satirlar.length + ' kayıt · ' +
                                bulunan.size + '/' + aranan.size + ' ürün bulundu');

                    if (!satirlar.length || !devamVarMi(veri)) return;
                    if (bulunan.size >= aranan.size) return;
                    offset += API.SAYFA_BOYU;
                    return bekle(API.ARA_MS).then(tur);
                }).catch(function (e) {
                    hatalar.push({ sayfa: sayfa + 1, sebep: String(e && e.message || e) });
                    console.log('%c  ' + (sayfa + 1) + '. sayfada hata: ' +
                                (e && e.message || e), 'color:#ff7676');
                });
            }

            return tur().then(function () {
                var urunler = [];
                var bulunamayan = [];
                API._islenecek.forEach(function (x) {
                    if (bulunan.has(x.barkod)) urunler.push(bulunan.get(x.barkod));
                    else bulunamayan.push({ ad: x.ad, barkod: x.barkod });
                });

                var cikti = {
                    olusturma: new Date().toISOString(),
                    istenen: API._islenecek.length,
                    alinan: urunler.length,
                    tarananSayfa: sayfa,
                    katalogdaBulunamayan: API._eksik,
                    hareketlerdeBulunamayan: bulunamayan,
                    hatalar: hatalar,
                    urunler: urunler
                };
                API.sonuc = cikti;
                var json = JSON.stringify(cikti, null, 2);

                console.log('%c\n✓ Bitti. ' + urunler.length + '/' + API._islenecek.length +
                            ' ürünün fiyatı alındı. ' + sayfa + ' sayfa tarandı.',
                            'color:#7ddc9a;font-weight:bold');
                if (bulunamayan.length) {
                    console.log('%c  Stok hareketlerinde geçmeyen ' + bulunamayan.length +
                                ' ürün (uzun süredir hareket görmemiş olabilir):', 'color:#ffb454');
                    bulunamayan.forEach(function (b) { console.log('    ' + b.ad); });
                }
                if (urunler.length && console.table) {
                    console.table(urunler.map(function (u) {
                        return {
                            'ürün': u.ad,
                            'satış': u.fiyat.satisFiyati,
                            'toptan': u.fiyat.toptanFiyat,
                            'stok': u.stok
                        };
                    }));
                }
                console.log('\nJSON `JBFiyat.sonuc` içinde. Panoya kopyalamayı deniyorum…');

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
        },

        /** Yarıda bırakırsan sayfanın fetch/XHR sarmalarını geri alır. */
        iptal: function () {
            dinlemeyiBirak();
            sablonuCozen = null;
            console.log('Dinleme kapatıldı.');
        }
    };

    global.JBFiyat = API;

    console.log('%cJBFiyat hazır.', 'color:#7ddc9a;font-weight:bold');
    console.log('Sayfa: Stok > Stok Hareketleri olmalı.');
    console.log('Kullanım: ürün adlarını KOPYALA, sonra şunu yaz:  JBFiyat.basla()');
    console.log('Sayfalar arası bekleme: JBFiyat.ARA_MS = ' + API.ARA_MS + ' ms');
})(window);
