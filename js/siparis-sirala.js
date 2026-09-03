/**
 * Sipariş toplama sırası
 * ============================================================================
 *
 * Getir siparişteki ürünleri kendi sırasıyla veriyor; o sıra depoda yürüme
 * sırasına uymuyor. Depocu ekmeği alıp rafın öbür ucuna, sonra geri
 * dönüyordu. Bu dosya listeyi toplama sırasına diziyor.
 *
 * KURAL
 *   1. Fırın ve dondurma ürünleri en başta.
 *   2. Su en sonda.
 *   3. Aradakiler kendi sınıflarında kümelenip yan yana duruyor; kek kekle,
 *      cips cipsle. Ayrı ayrı gezmek yerine tek durakta toplanıyor.
 *
 * NASIL KARAR VERİYOR
 * Önce panelden gelen kategori ağacına bakıyor (`anaKategori`, `sinif`).
 * O boşsa ürün adındaki anahtar kelimelere düşüyor. Yapay zeka çağrısı yok;
 * karar yerel, anlık ve her seferinde aynı.
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

    /* Bant numarası küçükse önce toplanıyor. Aradaki her şey 50'de duruyor ve
       kendi içinde sınıfa göre kümeleniyor. */
    var BANT = { ONCE: 10, ORTA: 50, SON: 90 };

    /* Anahtar kelimeler Hızlı Bul'daki varsayılan kategorilerden büyütüldü.
       `haric` listesi yanlış yakalamayı kesiyor: "kuzeyden cam" su değil,
       "dondurma külahı" dondurma değil. */
    var KURALLAR = [
        {
            ad: 'fırın',
            bant: BANT.ONCE,
            kume: 'firin',
            dahil: ['ekmek', 'baget', 'simit', 'poğaça', 'pogaca', 'börek', 'borek',
                    'kruvasan', 'la lorraine', 'firin', 'fırın', 'donut', 'berliner',
                    'sandvic', 'sandviç', 'tost'],
            haric: ['uno', 'untad', 'ekmek kırıntısı', 'galeta']
        },
        {
            ad: 'dondurma',
            bant: BANT.ONCE,
            kume: 'dondurma',
            dahil: ['dondurma', 'dondurulmus', 'donuk', 'cornetto', 'magnum', 'algida',
                    'carte d or', 'golf', 'buz kupu', 'buz küpü', 'frigo', 'feast',
                    'mochiko', 'superfresh', 'pizza donuk', 'dondurmali'],
            haric: ['dondurma kulahi', 'dondurma külahı', 'dondurma sosu']
        },
        {
            ad: 'su',
            bant: BANT.SON,
            kume: 'su',
            dahil: ['su ', ' su', 'dogal kaynak suyu', 'mineralli su', 'maden suyu',
                    'erikli', 'hayat su', 'kuzeyden', 'damla su', 'sırma', 'sirma'],
            haric: ['sut', 'süt', 'suyu konsantre', 'meyve suyu', 'sebze suyu',
                    'cam sise', 'cam şişe', 'susam', 'sucuk']
        }
    ];

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
            var haric = (k.haric || []).some(function (h) { return gecerMi(metin, h); });
            if (haric) continue;
            var dahil = k.dahil.some(function (d) { return gecerMi(metin, d); });
            if (dahil) return k;
        }
        return null;
    }

    /**
     * Orta bandın kümesi. Panelin sınıfı varsa o kullanılıyor; yoksa ürün
     * adının ilk sözüne düşülüyor. İkisi arasındaki fark önemli: adın ilk
     * sözü ("lay", "ruffles") kümelemeye yarıyor ama ekranda etiket olarak
     * gösterilmemeli, depocuya bir şey anlatmıyor. `kaynak` bunu ayırıyor.
     */
    function ortaKume(urun) {
        var sinif = sade(urun.sinif || urun.anaKategori || '');
        if (sinif) return { kume: sinif, kaynak: 'kategori' };
        var ad = sade(urun.ad || '');
        return { kume: ad ? ad.split(' ')[0] : 'diger', kaynak: 'ad' };
    }

    /**
     * Ürünleri toplama sırasına dizer.
     *
     * @param {Array} urunler  {sira, ad, anaKategori, sinif, altSinif, ...}
     * @returns {Array} yeni dizi; her öğeye `toplamaSirasi` (1'den başlar) ve
     *                  `toplamaKumesi` eklenir. Girdi dizisi değiştirilmez.
     */
    function sirala(urunler) {
        if (!Array.isArray(urunler) || !urunler.length) return [];

        /* Kümenin ilk göründüğü yer, kümenin sırasını belirliyor. Böylece
           Getir'in verdiği sıra tamamen alt üst olmuyor, yalnız benzerler
           birbirine çekiliyor. */
        var kumeSirasi = new Map();

        var isaretli = urunler.map(function (u, i) {
            var kural = kuralBul(u);
            var orta = kural ? null : ortaKume(u);
            var bant = kural ? kural.bant : BANT.ORTA;
            var kume = kural ? kural.kume : orta.kume;
            var kaynak = kural ? 'kural' : orta.kaynak;
            if (!kumeSirasi.has(bant + '|' + kume)) kumeSirasi.set(bant + '|' + kume, i);
            return { urun: u, giris: i, bant: bant, kume: kume, kaynak: kaynak };
        });

        isaretli.sort(function (a, b) {
            if (a.bant !== b.bant) return a.bant - b.bant;
            var ak = kumeSirasi.get(a.bant + '|' + a.kume);
            var bk = kumeSirasi.get(b.bant + '|' + b.kume);
            if (ak !== bk) return ak - bk;
            return a.giris - b.giris;
        });

        return isaretli.map(function (x, i) {
            return Object.assign({}, x.urun, {
                toplamaSirasi: i + 1,
                toplamaKumesi: x.kume,
                toplamaKumeKaynagi: x.kaynak
            });
        });
    }

    global.JBSiparisSirala = {
        sirala: sirala,
        // Sınama ve ayar ekranı için açık duruyor.
        kuralBul: kuralBul,
        BANT: BANT,
        KURALLAR: KURALLAR
    };
})(typeof window !== 'undefined' ? window : globalThis);
