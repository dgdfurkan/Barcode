/**
 * Tanıtım sayfasında kullanılan gerçek ürünler.
 * ============================================================================
 *
 * Adlar, barkodlar ve görseller `products.json` içindeki gerçek kayıtlardan
 * alındı. Uydurma ürün yok, uydurma barkod yok: sayfadaki her kod geçerli bir
 * EAN-13 ve ekranda JsBarcode ile gerçekten çizdiriliyor.
 *
 * Getir tekli satıyor. Bu yüzden çoklu paketler (4 x 100 g gibi) listeye
 * alınmadı; hepsi tek ürün.
 *
 * Görseller yerelde: `assets/tanitim/urunler/`. Sayfa dışarıdan hiçbir şey
 * çekmiyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var G = '../assets/tanitim/urunler/';

    var URUNLER = [
        { ad: 'Sütaş %2,5 Yağlı UHT Süt',        boy: '1 L',      kod: '8690767716034', gorsel: G + 'sutas-sut.jpg',    raf: 'A2-04' },
        { ad: 'Erikli Doğal Kaynak Suyu',        boy: '1,5 L',    kod: '8690793010151', gorsel: G + 'erikli-su.jpg',    raf: 'C1-11' },
        { ad: 'Coca-Cola',                       boy: '250 ml',   kod: '5000112664867', gorsel: G + 'kola.jpg',         raf: 'C2-03' },
        { ad: "Lay's Klasik Patates Cipsi",      boy: '107 g',    kod: '8690624100983', gorsel: G + 'lays.jpg',         raf: 'D3-07' },
        { ad: 'Pınar Beyaz Taze Peynir',         boy: '350 g',    kod: '8690565022733', gorsel: G + 'pinar-peynir.jpg', raf: 'A1-02' },
        { ad: 'Ülker Çikolatalı Gofret',         boy: '36 g',     kod: '8690504020509', gorsel: G + 'ulker-gofret.jpg', raf: 'D1-15' },
        { ad: 'Algida Maraş Usulü Dondurma',     boy: '105 ml',   kod: '8690637724343', gorsel: G + 'algida-maras.jpg', raf: 'F1-01' },
        { ad: 'Milka Oreo Tablet Çikolata',      boy: '100 g',    kod: '7622201522360', gorsel: G + 'milka-oreo.jpg',   raf: 'D1-09' },
        { ad: 'Eti Cin Lokmalık Portakallı',     boy: '114 g',    kod: '8690533003177', gorsel: G + 'eti-cin.jpg',      raf: 'D2-12' },
        { ad: 'Sütaş Ayran',                     boy: '1 L',      kod: '8690767160189', gorsel: G + 'sutas-ayran.jpg',  raf: 'A2-08' },
        { ad: 'Uno Kaşar Peynirli Poğaça',       boy: '75 g',     kod: '8680959080333', gorsel: G + 'uno-pogaca.jpg',   raf: 'B1-03' },
        { ad: 'CP Orta Boy Omega 3 Yumurta',     boy: "10'lu",    kod: '8695895107808', gorsel: G + 'cp-yumurta.jpg',   raf: 'A3-01' },
        { ad: 'Fairy Sıvı Bulaşık Deterjanı',    boy: '1350 ml',  kod: '5413149798977', gorsel: G + 'fairy.jpg',        raf: 'E2-06' },
        { ad: 'Sarelle Kakaolu Fındık Ezmesi',   boy: '350 g',    kod: '8683417000027', gorsel: G + 'sarelle.jpg',      raf: 'D4-02' },
        { ad: 'Doritos Nacho Mısır Cipsi',       boy: '113 g',    kod: '8690624200539', gorsel: G + 'doritos.jpg',      raf: 'D3-11' },
        { ad: 'Torku Banada Kakaolu Krema',      boy: '400 g',    kod: '8690120070056', gorsel: G + 'torku-banada.jpg', raf: 'D4-05' }
    ];

    /** Barkodun ilk ve son dördü açık, ortası noktalı: dar alanda okunur. */
    function kisaKod(kod) {
        return kod.slice(0, 4) + '…' + kod.slice(-4);
    }

    /** Ada göre arar. Türkçe karakterleri normalleştirir. */
    function sadelestir(s) {
        return String(s).toLocaleLowerCase('tr')
            .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
            .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
    }

    function ara(terim) {
        var t = sadelestir(terim).trim();
        if (!t) return [];
        return URUNLER.filter(function (u) {
            return sadelestir(u.ad).indexOf(t) !== -1 || u.kod.indexOf(t) !== -1;
        });
    }

    global.JBUrunler = { liste: URUNLER, ara: ara, kisaKod: kisaKod };
})(window);
