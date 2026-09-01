/**
 * Fiyat Çek — konsol aracı
 * ============================================================================
 *
 * Verdiğin ürün adları için franchise panelinden fiyat toplar ve JSON verir.
 *
 * NASIL KULLANILIR
 *   1. https://franchise.getir.com/stock/current sayfasını aç.
 *   2. F12 → Console. Bu dosyanın tamamını yapıştır, Enter.
 *   3. Ürün adlarını KOPYALA (virgülle ya da alt alta), sonra konsola yaz:
 *        JBFiyat.basla()
 *      Listeyi koda yazmana gerek yok, olmamalı da: ürün adlarında kesme
 *      işareti geçiyor ("Nuh'un", "Lay's", "(15'li)") ve tırnaklı diziyi
 *      ortadan kapatıyor. Araç listeyi panodan alır, pano okunamazsa
 *      yapıştırman için bir kutu açar.
 *   4. Araç sana panelin kendi arama kutusuna yazman için bir barkod söyleyecek.
 *      O aramayı bir kez yap. Gerisini araç kendisi yürütür.
 *   5. Bitince JSON hem konsola yazılır hem panoya kopyalanır.
 *
 * NEDEN TEK BİR ARAMA İSTİYOR
 * Panelin stok aramasının hangi adrese, hangi gövdeyle gittiğini uydurmuyoruz.
 * Sen bir kez arayınca isteğin gerçek şeklini görüyoruz ve kalan ürünler için
 * aynı isteği tekrarlıyoruz. Böylece Getir tarafına sayfanın zaten attığı
 * istekten başka bir şey gitmiyor; uydurma uç nokta, uydurma alan adı yok.
 * Depo kimliği de koda yazılmıyor, yakalanan isteğin içinde ne varsa o gidiyor.
 *
 * HIZ
 * İstekler tek tek ve aralıklı gidiyor. Varsayılan 1,5 saniye; sayım
 * senkronunda kullanılan aralıkla aynı mertebede. `JBFiyat.ARA_MS` ile
 * değiştirebilirsin ama aşağı çekme.
 *
 * TOPTAN FİYAT
 * Yanıtta fiyatın hangi alan adıyla geldiğini bilmiyoruz. Araç fiyata benzeyen
 * BÜTÜN alanları topluyor ve sonunda hangi adların kaç kez geçtiğini ayrıca
 * yazıyor. O listeye bakıp toptan fiyatın hangisi olduğunu görebilirsin.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var KATALOG = 'https://jetbarkod.com.tr/products.json';
    var FIYAT_DESENI = /(price|cost|fiyat|tutar|amount|vat|kdv|margin|profit|kar|supplier|purchase|buy|sale)/i;

    // ==================================================================
    // Türkçe metin sadeleştirme (sitedeki arama ile aynı kural)
    // ==================================================================

    var HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c' };

    function sade(metin) {
        return String(metin == null ? '' : metin)
            .toLocaleLowerCase('tr')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')   // birleşen işaretler (kaçış dizisiyle: konsola yapıştırınca bozulmasın)
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
     * Listeyi nereden alacağını çözer.
     *
     * Ürün adlarında kesme işareti var: "Sade Gurme Gezen Yumurta (15'li)",
     * "Carte d'Or", "Nuh'un", "Lay's". Bunlar tek tırnaklı bir JS dizesini
     * ortadan kapatıyor ve konsol sözdizimi hatası veriyordu. Bu yüzden liste
     * artık koda yazılmıyor: önce panoya, o olmazsa prompt kutusuna bakılıyor.
     * İkisinde de tırnak diye bir dert yok.
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
    // İstek şablonunu panelin kendi aramasından öğrenme
    // ==================================================================

    var sablon = null;       // { yontem, url, basliklar, govde }
    var beklenenIz = null;   // kullanıcının yazması istenen barkod
    var sablonuCozen = null;
    var asilFetch = null;
    var asilAc = null;
    var asilYolla = null;

    function ilgiliMi(url) {
        return typeof url === 'string' && url.indexOf('getirapi.com') !== -1;
    }

    function izVarMi(url, govde) {
        if (!beklenenIz) return false;
        if (typeof url === 'string' && url.indexOf(beklenenIz) !== -1) return true;
        if (typeof govde === 'string' && govde.indexOf(beklenenIz) !== -1) return true;
        return false;
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
        console.log('   ' + sablon.yontem + ' ' + sablon.url.split('?')[0]);
        dinlemeyiBirak();
        if (sablonuCozen) sablonuCozen();
    }

    function dinlemeyeBasla() {
        if (asilFetch) return;
        asilFetch = global.fetch;
        global.fetch = function (girdi, ayar) {
            /* Referansı önce al. sablonuKaydet sarmayı geri alıp asilFetch'i
               boşaltıyor; aşağıda ona dokunursak SENİN aramanı patlatırız. */
            var asil = asilFetch;
            try {
                var url = (typeof girdi === 'string') ? girdi : (girdi && girdi.url);
                var govde = ayar && typeof ayar.body === 'string' ? ayar.body : null;
                if (ilgiliMi(url) && izVarMi(url, govde)) {
                    var bas = basliklariDuzle((ayar && ayar.headers) || (girdi && girdi.headers));
                    sablonuKaydet((ayar && ayar.method) || 'GET', url, bas, govde);
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
                var g = typeof govde === 'string' ? govde : null;
                if (ilgiliMi(this.__jbUrl) && izVarMi(this.__jbUrl, g)) {
                    sablonuKaydet(this.__jbYontem, this.__jbUrl, this.__jbBas, g);
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
    // Şablonu bir barkoda uyarlayıp isteği atma
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

    /* Barkod adreste ya da gövdede düz veya yüzde kodlu geçebilir; ikisini de
       değiştiriyoruz. */
    function iziDegistir(metin, barkod) {
        if (typeof metin !== 'string') return metin;
        return metin
            .split(beklenenIz).join(barkod)
            .split(encodeURIComponent(beklenenIz)).join(encodeURIComponent(barkod));
    }

    function istekAt(barkod) {
        var url = iziDegistir(sablon.url, barkod);
        var govde = sablon.govde ? iziDegistir(sablon.govde, barkod) : null;

        var ayar = {
            method: sablon.yontem,
            headers: temizBasliklar(sablon.basliklar),
            credentials: 'include'
        };
        if (govde != null && sablon.yontem !== 'GET' && sablon.yontem !== 'HEAD') {
            ayar.body = govde;
        }

        return fetch(url, ayar).then(function (y) {
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

    function satirlariAyikla(veri) {
        if (Array.isArray(veri)) return veri;
        if (!veri || typeof veri !== 'object') return [];
        var d = veri.data;
        if (Array.isArray(d)) return d;
        if (d && Array.isArray(d.data)) return d.data;
        if (d && Array.isArray(d.items)) return d.items;
        if (d && typeof d === 'object') return [d];
        return [];
    }

    /** Nesnenin içindeki fiyata benzeyen ne varsa toplar. İki kademe iniyor. */
    function fiyatlariTopla(nesne, onek, torba, sayac, derinlik) {
        if (!nesne || typeof nesne !== 'object' || derinlik > 2) return;
        Object.keys(nesne).forEach(function (k) {
            var v = nesne[k];
            var ad = onek ? onek + '.' + k : k;
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                if (FIYAT_DESENI.test(k) || derinlik === 0) {
                    fiyatlariTopla(v, ad, torba, sayac, derinlik + 1);
                }
                return;
            }
            if (!FIYAT_DESENI.test(k)) return;
            if (typeof v !== 'number' && typeof v !== 'string') return;
            if (v === '' || v === null) return;
            torba[ad] = v;
            sayac[ad] = (sayac[ad] || 0) + 1;
        });
    }

    function coklu(deger) {
        if (deger == null) return '';
        if (typeof deger === 'string') return deger;
        if (typeof deger === 'object') return deger.tr || deger.en || '';
        return String(deger);
    }

    function yanittanKayit(veri, barkod, sayac) {
        var satirlar = satirlariAyikla(veri);
        var secili = null;

        // Barkodu taşıyan satırı seç; bulamazsan ilk satırı al.
        for (var i = 0; i < satirlar.length && !secili; i++) {
            try {
                if (JSON.stringify(satirlar[i]).indexOf(barkod) !== -1) secili = satirlar[i];
            } catch (e) { /* sessiz */ }
        }
        if (!secili) secili = satirlar[0] || null;
        if (!secili) return null;

        var u = secili.product && typeof secili.product === 'object' ? secili.product : secili;
        var torba = {};
        fiyatlariTopla(u, '', torba, sayac, 0);
        /* Satırın kendisinde de fiyat olabiliyor. `product` atlanıyor, o
           nesne yukarıda zaten tarandı; yoksa her alan listede iki kez
           görünüyor ve hangisinin ne olduğu karışıyor. */
        var satirKopya = {};
        Object.keys(secili).forEach(function (k) {
            if (k !== 'product') satirKopya[k] = secili[k];
        });
        fiyatlariTopla(satirKopya, 'satir', torba, sayac, 0);

        return {
            panelAdi: coklu(u.fullName) || coklu(u.shortName) || coklu(u.name) || '',
            stok: (secili.productStock && typeof secili.productStock.available === 'number')
                ? secili.productStock.available
                : (typeof secili.available === 'number' ? secili.available : null),
            fiyatlar: torba
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
                return API._listeyleBasla(metin);
            });
        },

        _listeyleBasla: function (adMetni) {
            sablon = null;
            beklenenIz = null;

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
                beklenenIz = c.cozulen[0].barkod;

                dinlemeyeBasla();
                console.log('%c\n  ŞİMDİ SEN YAP  ', 'background:#135bec;color:#fff;font-weight:bold');
                console.log('%cPanelin kendi arama kutusuna şunu yaz ve arat:', 'color:#f2f4f8');
                console.log('%c    ' + beklenenIz, 'font-size:16px;font-weight:bold;color:#7ddc9a');
                console.log('Aramayı yapınca ' + c.cozulen.length +
                            ' ürünün hepsini sırayla kendim çekeceğim.\n');

                return new Promise(function (coz) { sablonuCozen = coz; }).then(API._yurut);
            });
        },

        _yurut: function () {
            var liste = API._islenecek;
            var sayac = {};
            var kayitlar = [];
            var hatalar = [];
            var i = 0;

            console.log('%c› Çekim başlıyor: ' + liste.length + ' ürün, aralarında ' +
                        API.ARA_MS + ' ms.', 'color:#8ab4ff');

            function tur() {
                if (i >= liste.length) return Promise.resolve();
                var it = liste[i];
                return istekAt(it.barkod).then(function (veri) {
                    var k = yanittanKayit(veri, it.barkod, sayac);
                    if (k) {
                        kayitlar.push({
                            istenen: it.istenen,
                            ad: it.ad,
                            barkod: it.barkod,
                            panelAdi: k.panelAdi,
                            stok: k.stok,
                            fiyatlar: k.fiyatlar
                        });
                    } else {
                        hatalar.push({ ad: it.ad, barkod: it.barkod, sebep: 'yanıtta satır yok' });
                    }
                }).catch(function (e) {
                    hatalar.push({ ad: it.ad, barkod: it.barkod, sebep: String(e && e.message || e) });
                }).then(function () {
                    i++;
                    console.log('  ' + i + '/' + liste.length + '  ' + it.ad);
                    if (i >= liste.length) return;
                    return bekle(API.ARA_MS).then(tur);
                });
            }

            return tur().then(function () {
                var cikti = {
                    olusturma: new Date().toISOString(),
                    istenen: liste.length,
                    alinan: kayitlar.length,
                    katalogdaBulunamayan: API._eksik,
                    hatalar: hatalar,
                    fiyatAlaniSayaci: sayac,
                    urunler: kayitlar
                };
                API.sonuc = cikti;
                var json = JSON.stringify(cikti, null, 2);

                console.log('%c\n✓ Bitti. ' + kayitlar.length + '/' + liste.length + ' ürün alındı.',
                            'color:#7ddc9a;font-weight:bold');
                if (hatalar.length) console.log('%c  ' + hatalar.length + ' üründe sorun çıktı.', 'color:#ffb454');
                console.log('%cYanıtta görülen fiyat alanları:', 'color:#8ab4ff');
                Object.keys(sayac).forEach(function (a) {
                    console.log('    ' + a + '  (' + sayac[a] + ' üründe)');
                });
                console.log('\nJSON `JBFiyat.sonuc` içinde. Panoya kopyalamayı deniyorum…');

                try {
                    navigator.clipboard.writeText(json).then(function () {
                        console.log('%c✓ Panoya kopyalandı.', 'color:#7ddc9a');
                    }, function () {
                        console.log('%cPano izni yok. `copy(JSON.stringify(JBFiyat.sonuc,null,2))` yaz.', 'color:#ffb454');
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
    console.log('Kullanım: ürün adlarını KOPYALA, sonra şunu yaz:  JBFiyat.basla()');
    console.log('Pano okunamazsa yapıştırman için bir kutu açılır.');
    console.log('İstekler arası bekleme: JBFiyat.ARA_MS = ' + API.ARA_MS + ' ms');
})(window);
