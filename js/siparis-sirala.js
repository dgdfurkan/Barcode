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
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[ığüşöçâîû]/g, function (m) { return HARF[m] || m; })
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* Anahtar kelimeler Hızlı Bul'daki varsayılan kategorilerden büyütüldü.
       `haric` listesi yanlış yakalamayı kesiyor: "erikli cam şişe" su değil,
       "dondurma külahı" dondurma değil. */
    var KURALLAR = [
        {
            kume: 'firin',
            etiket: 'Fırın',
            dahil: ['ekmek', 'baget', 'simit', 'poğaça', 'pogaca', 'börek', 'borek',
                    'kruvasan', 'la lorraine', 'firin', 'fırın', 'donut', 'berliner',
                    'sandvic', 'sandviç', 'tost'],
            haric: ['uno', 'untad', 'ekmek kırıntısı', 'galeta']
        },
        {
            kume: 'dondurma',
            etiket: 'Dondurma',
            dahil: ['dondurma', 'dondurulmus', 'donuk', 'cornetto', 'magnum', 'algida',
                    'carte d or', 'golf', 'buz kupu', 'buz küpü', 'frigo', 'feast',
                    'mochiko', 'superfresh', 'pizza donuk', 'dondurmali'],
            haric: ['dondurma kulahi', 'dondurma külahı', 'dondurma sosu']
        },
        {
            kume: 'su',
            etiket: 'Su',
            dahil: ['su ', ' su', 'dogal kaynak suyu', 'mineralli su', 'maden suyu',
                    'erikli', 'hayat su', 'kuzeyden', 'damla su', 'sırma', 'sirma'],
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

    function gecerMi(metin, kelime) {
        return metin.indexOf(sade(kelime)) !== -1;
    }

    function kuralBul(urun) {
        var metin = sade(
            [urun.ad, urun.anaKategori, urun.sinif, urun.altSinif].filter(Boolean).join(' ')
        );
        if (!metin) return null;

        for (var i = 0; i < KURALLAR.length; i++) {
            var k = KURALLAR[i];
            if ((k.haric || []).some(function (h) { return gecerMi(metin, h); })) continue;
            if (k.dahil.some(function (d) { return gecerMi(metin, d); })) return k;
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

    function siraOku(ayar) {
        var istenen = (ayar && Array.isArray(ayar.sira)) ? ayar.sira : VARSAYILAN_SIRA;
        var temiz = [];
        istenen.forEach(function (k) {
            if (BANT_ETIKET[k] && temiz.indexOf(k) === -1) temiz.push(k);
        });
        // Eksik kalan bant sona ekleniyor; ayar bozuksa da liste tam olsun.
        VARSAYILAN_SIRA.forEach(function (k) { if (temiz.indexOf(k) === -1) temiz.push(k); });
        return temiz;
    }

    /**
     * Ürünleri toplama sırasına dizer.
     *
     * @param {Array}  urunler  {sira, ad, anaKategori, sinif, altSinif, ...}
     * @param {Object} [ayar]   { sira: ['firin','dondurma','orta','su'] }
     * @returns {Array} yeni dizi. Eklenen alanlar:
     *                  toplamaSirasi   1'den başlayan sıra
     *                  toplamaKumesi   gruplama anahtarı
     *                  toplamaEtiketi  ekranda görünecek Türkçe ad ('' olabilir)
     *                  toplamaBandi    'firin' | 'dondurma' | 'su' | 'orta'
     *                  Girdi dizisi değiştirilmez.
     */
    function sirala(urunler, ayar) {
        if (!Array.isArray(urunler) || !urunler.length) return [];

        var sira = siraOku(ayar);
        var bantNo = {};
        sira.forEach(function (k, i) { bantNo[k] = i; });

        /* Kümenin ilk göründüğü yer, kümenin sırasını belirliyor. Böylece
           Getir'in verdiği sıra tamamen alt üst olmuyor, yalnız benzerler
           birbirine çekiliyor. */
        var kumeSirasi = new Map();

        var isaretli = urunler.map(function (u, i) {
            var kural = kuralBul(u);
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
        VARSAYILAN_SIRA: VARSAYILAN_SIRA,
        BANT_ETIKET: BANT_ETIKET,
        KURALLAR: KURALLAR
    };
})(typeof window !== 'undefined' ? window : globalThis);
