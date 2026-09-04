/**
 * Sipariş toplama sırası
 * ============================================================================
 *
 * Getir siparişteki ürünleri kendi sırasıyla veriyor; o sıra depoda yürüme
 * sırasına uymuyor. Depocu ekmeği alıp rafın öbür ucuna, sonra geri
 * dönüyordu. Bu dosya listeyi toplama sırasına diziyor.
 *
 * KURAL
 *   1. Bantlar kullanıcının seçtiği sırada geliyor. Varsayılan: fırın,
 *      dondurma, diğerleri, su.
 *   2. Aynı bandın içinde ürünler kendi sınıflarında kümelenip yan yana
 *      duruyor; kek kekle, cips cipsle.
 *
 * NASIL KARAR VERİYOR
 * Önce panelden gelen kategori ağacına bakıyor (`anaKategori`, `sinif`).
 * O boşsa ürün adındaki anahtar kelimelere düşüyor. Yapay zeka çağrısı yok;
 * karar yerel, anlık ve her seferinde aynı.
 *
 * İKİ TÜR EŞLEŞME
 * Kategoriye ürün iki yoldan giriyor:
 *   1. `urunler` — katalogdan elle seçilmiş ürün adları. Ad birebir
 *      tutuyorsa kategori kesin; hiçbir anahtar kelime bunu ezemiyor.
 *   2. `dahil` — anahtar kelime. Tek tek seçmenin anlamsız olduğu geniş
 *      gruplar için ("ekmek" bütün ekmekleri yakalıyor).
 * Sıra da bu: önce seçilmiş ürünler, sonra kelimeler.
 *
 * KURALLAR DIŞARIDAN DEĞİŞEBİLİR
 * `sirala(urunler, { kurallar })` verilirse modülün kendi `KURALLAR` dizisi
 * yerine o kullanılıyor. Siparişler ekranındaki ayarlar bunu kullanıyor:
 * kullanıcı fırın/dondurma/su anahtar kelimelerini düzenleyebiliyor, hatta
 * tamamen yeni bir bant ekleyebiliyor. Modülün kendi `KURALLAR`'ı yalnız
 * varsayılan; hiçbir zaman dışarıdan değiştirilmiyor.
 *
 * KISA KELİME TUZAĞI
 * "su" tek kelime olarak arandığında "süper", "suşi" gibi kelimelerin içine
 * de giriyordu. İki harf ve altındaki anahtar kelimeler otomatik olarak tam
 * kelime eşleşmesine geçiyor; üç ve üstü harfli anahtar kelimeler metnin
 * herhangi bir yerinde geçebiliyor. Bu davranış hem yerleşik hem kullanıcının
 * eklediği kategoriler için aynı.
 *
 * ETİKET AYRI TUTULUYOR
 * Kümenin anahtarı sadeleştirilmiş ("firin"), ekranda görünen etiket düzgün
 * Türkçe ("Fırın"). Eskiden anahtar doğrudan basılıyordu ve ekranda "FİRİN",
 * "SU" gibi çirkin yazılar çıkıyordu.
 *
 * SIRA KORUNUR
 * Aynı bandın ve aynı kümenin içinde Getir'in verdiği sıra bozulmuyor.
 * Sıralama kararlı; aynı liste her zaman aynı diziliyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c' };

    function sade(metin) {
        return String(metin == null ? '' : metin)
            .toLocaleLowerCase('tr')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[ığüşöçâîû]/g, function (m) { return HARF[m] || m; })
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* Anahtar kelimeler Hızlı Bul'daki varsayılan kategorilerden büyütüldü.
       `haric` listesi yanlış yakalamayı kesiyor: "erikli cam şişe" su değil,
       "dondurma külahı" dondurma değil. Bunlar depodaki VARSAYILAN kurallar;
       kullanıcının ayarlardan yaptığı değişiklikler burayı değiştirmiyor,
       yalnız `sirala()`'ya ayrıca `kurallar` olarak veriliyor. */
    var KURALLAR = [
        {
            kume: 'firin',
            etiket: 'Fırın',
            renk: '#ffff00',
            dahil: ['ekmek', 'baget', 'simit', 'poğaça', 'pogaca', 'börek', 'borek',
                    'kruvasan', 'la lorraine', 'firin', 'fırın', 'donut', 'berliner',
                    'sandvic', 'sandviç', 'tost'],
            haric: ['uno', 'untad', 'ekmek kırıntısı', 'galeta']
        },
        {
            kume: 'dondurma',
            etiket: 'Dondurma',
            renk: '#bb00ff',
            dahil: ['dondurma', 'dondurulmus', 'donuk', 'cornetto', 'magnum', 'algida',
                    'carte d or', 'golf', 'buz kupu', 'buz küpü', 'frigo', 'feast',
                    'mochiko', 'superfresh', 'pizza donuk', 'dondurmali'],
            haric: ['dondurma kulahi', 'dondurma külahı', 'dondurma sosu']
        },
        {
            kume: 'su',
            etiket: 'Su',
            renk: '#0088ff',
            /* Bare "su" iki harfli; aşağıdaki otomatik kural onu tam kelime
               yapıyor, "süper"in içine girmiyor. */
            dahil: ['su', 'sular', 'dogal kaynak suyu', 'mineralli su', 'maden suyu',
                    'kaynak suyu', 'erikli', 'hayat su', 'kuzeyden', 'damla su',
                    'sırma', 'sirma'],
            haric: ['sut', 'süt', 'suyu konsantre', 'meyve suyu', 'sebze suyu',
                    'cam sise', 'cam şişe', 'susam', 'sucuk']
        }
    ];

    /* Bant sırası kullanıcı ayarı. 'orta' kural tutmayan her şeyin yeri.
       Ayarlar ekranı bu diziyi yeniden diziyor. */
    var VARSAYILAN_SIRA = ['firin', 'dondurma', 'orta', 'su'];

    var BANT_ETIKET = {
        firin: 'Fırın',
        dondurma: 'Dondurma',
        su: 'Su',
        orta: 'Diğer ürünler'
    };

    var BANT_RENK_VARSAYILAN = { firin: '#d97706', dondurma: '#7c3aed', su: '#0284c7', orta: '#98a2b3' };

    /* Kısa anahtar kelime tam kelime, uzun anahtar kelime metnin herhangi
       bir yerinde aranıyor. Eşik iki harf: "su" tam kelimeye düşüyor,
       "sut" (üç harf) yine substring kalıyor, davranışı değişmiyor. */
    function kelimeGecerMi(metin, kelimeHam) {
        var kelime = sade(kelimeHam);
        if (!kelime) return false;
        if (kelime.length <= 2) {
            return (' ' + metin + ' ').indexOf(' ' + kelime + ' ') !== -1;
        }
        return metin.indexOf(kelime) !== -1;
    }

    /**
     * @param {Object} urun
     * @param {Array}  [kurallar]  Verilmezse modülün varsayılan KURALLAR'ı.
     */
    function kuralBul(urun, kurallar) {
        var liste = (Array.isArray(kurallar) && kurallar.length) ? kurallar : KURALLAR;
        var metin = sade(
            [urun.ad, urun.anaKategori, urun.sinif, urun.altSinif].filter(Boolean).join(' ')
        );
        if (!metin) return null;
        var ad = sade(urun.ad);

        /* Önce katalogdan seçilmiş ürünler: ad birebir tutuyorsa başka
           hiçbir şeye bakılmıyor. Kullanıcı o ürünü eliyle seçmiş, anahtar
           kelime tahminlerinin onu ezmesi yanlış olur. Hariç listesi de
           burada devreye girmiyor; seçim açık bir karardır. */
        for (var s = 0; s < liste.length; s++) {
            var sk = liste[s];
            if ((sk.urunler || []).some(function (u) { return sade(u) === ad; })) return sk;
        }

        for (var i = 0; i < liste.length; i++) {
            var k = liste[i];
            if ((k.haric || []).some(function (h) { return kelimeGecerMi(metin, h); })) continue;
            if ((k.dahil || []).some(function (d) { return kelimeGecerMi(metin, d); })) return k;
        }
        return null;
    }

    /**
     * Kural tutmayan ürünün kümesi. Panelin sınıfı varsa o kullanılıyor ve
     * etiketi olduğu gibi gösteriliyor (zaten Türkçe geliyor). Sınıf da yoksa
     * ürün adının ilk sözüne düşülüyor; o küme yalnız gruplamaya yarıyor,
     * ekranda gösterilmiyor.
     */
    function ortaKume(urun) {
        var ham = urun.sinif || urun.anaKategori || '';
        var anahtar = sade(ham);
        if (anahtar) return { kume: anahtar, etiket: String(ham).trim() };
        var ad = sade(urun.ad || '');
        return { kume: ad ? ad.split(' ')[0] : 'diger', etiket: '' };
    }

    /**
     * Sıra belirtilmediğinde kullanılacak taban: fırın, dondurma, orta, su
     * (su hep en sonda). Kullanıcının eklediği kategoriler bu tabanda yok;
     * su'dan hemen önce ekleniyor ki "su en sonda" alışkanlığı bozulmasın.
     * Kullanıcı isterse ayarlardaki oklarla yeniden sıralayabiliyor.
     */
    function varsayilanSiraHesapla(kurallar) {
        var taban = VARSAYILAN_SIRA.slice();
        var eldeki = {};
        taban.forEach(function (k) { eldeki[k] = true; });
        var suIndex = taban.indexOf('su');
        if (suIndex === -1) suIndex = taban.length;
        kurallar.forEach(function (k) {
            if (!eldeki[k.kume]) {
                taban.splice(suIndex, 0, k.kume);
                suIndex++;
                eldeki[k.kume] = true;
            }
        });
        return taban;
    }

    function siraOku(ayar, varsayilanSira, gecerli) {
        var istenen = (ayar && Array.isArray(ayar.sira)) ? ayar.sira : varsayilanSira;
        var temiz = [];
        istenen.forEach(function (k) {
            if (gecerli[k] && temiz.indexOf(k) === -1) temiz.push(k);
        });
        // Eksik kalan bant sona ekleniyor; ayar bozuksa da liste tam olsun.
        varsayilanSira.forEach(function (k) { if (temiz.indexOf(k) === -1) temiz.push(k); });
        return temiz;
    }

    /**
     * Ürünleri toplama sırasına dizer.
     *
     * @param {Array}  urunler   {sira, ad, anaKategori, sinif, altSinif, ...}
     * @param {Object} [ayar]
     * @param {Array}  [ayar.sira]      Bant sırası, örn. ['firin','dondurma','orta','su']
     * @param {Array}  [ayar.kurallar]  Kullanıcının kendi kategori kuralları.
     *                                  Verilmezse modülün varsayılan KURALLAR'ı.
     * @returns {Array} yeni dizi. Eklenen alanlar:
     *                  toplamaSirasi   1'den başlayan sıra
     *                  toplamaKumesi   gruplama anahtarı
     *                  toplamaEtiketi  ekranda görünecek Türkçe ad ('' olabilir)
     *                  toplamaBandi    bant anahtarı ('firin' | 'su' | ... | 'orta')
     *                  Girdi dizisi değiştirilmez.
     */
    function sirala(urunler, ayar) {
        if (!Array.isArray(urunler) || !urunler.length) return [];

        var kurallar = (ayar && Array.isArray(ayar.kurallar) && ayar.kurallar.length) ? ayar.kurallar : KURALLAR;
        var etiketler = {};
        var gecerliBantlar = { orta: true };
        kurallar.forEach(function (k) { etiketler[k.kume] = k.etiket; gecerliBantlar[k.kume] = true; });
        etiketler.orta = BANT_ETIKET.orta;

        var varsayilanSira = varsayilanSiraHesapla(kurallar);
        var sira = siraOku(ayar, varsayilanSira, gecerliBantlar);
        var bantNo = {};
        sira.forEach(function (k, i) { bantNo[k] = i; });

        /* Kümenin ilk göründüğü yer, kümenin sırasını belirliyor. Böylece
           Getir'in verdiği sıra tamamen alt üst olmuyor, yalnız benzerler
           birbirine çekiliyor. */
        var kumeSirasi = new Map();

        var isaretli = urunler.map(function (u, i) {
            var kural = kuralBul(u, kurallar);
            var orta = kural ? null : ortaKume(u);
            var bant = kural ? kural.kume : 'orta';
            var kume = kural ? kural.kume : orta.kume;
            var etiket = kural ? kural.etiket : orta.etiket;
            var anahtar = bant + '|' + kume;
            if (!kumeSirasi.has(anahtar)) kumeSirasi.set(anahtar, i);
            return { urun: u, giris: i, bant: bant, kume: kume, etiket: etiket, anahtar: anahtar };
        });

        isaretli.sort(function (a, b) {
            var ab = bantNo[a.bant];
            var bb = bantNo[b.bant];
            if (ab !== bb) return ab - bb;
            var ak = kumeSirasi.get(a.anahtar);
            var bk = kumeSirasi.get(b.anahtar);
            if (ak !== bk) return ak - bk;
            return a.giris - b.giris;
        });

        return isaretli.map(function (x, i) {
            return Object.assign({}, x.urun, {
                toplamaSirasi: i + 1,
                toplamaKumesi: x.kume,
                toplamaEtiketi: x.etiket,
                toplamaBandi: x.bant
            });
        });
    }

    global.JBSiparisSirala = {
        sirala: sirala,
        kuralBul: kuralBul,
        sade: sade,
        VARSAYILAN_SIRA: VARSAYILAN_SIRA,
        BANT_ETIKET: BANT_ETIKET,
        BANT_RENK_VARSAYILAN: BANT_RENK_VARSAYILAN,
        KURALLAR: KURALLAR
    };
})(typeof window !== 'undefined' ? window : globalThis);
