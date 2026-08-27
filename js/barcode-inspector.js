/**
 * Jet Barkod — bilinmeyen kod inceleyici
 * ============================================================================
 *
 * Arama kutusuna katalogda olmayan bir KOD girildiğinde devreye girer:
 * kodu tanır, doğrular ve okunabilir bir barkod/QR olarak sunar.
 *
 * Neden gerekli: depoya gelen palet ve koli etiketlerindeki kodlar (SSCC,
 * ITF-14, Getir'in KP ile başlayan palet kodları) katalogda bulunmaz.
 * Öncesinde bunlar "Sonuç bulunamadı" ekranına düşüp kayboluyordu; oysa
 * elemanın ihtiyacı kodun NE olduğunu görmek ve gerekirse yeniden
 * bastırabilmek.
 *
 * ---------------------------------------------------------------------------
 * TANIDIĞI TİPLER
 * ---------------------------------------------------------------------------
 *   EAN-13   13 hane   perakende ürün
 *   EAN-8     8 hane   küçük ambalaj
 *   UPC-A    12 hane   Kuzey Amerika (EAN-13'e 0 ile genişletilir)
 *   ITF-14   14 hane   koli / iç ambalaj (GTIN-14)
 *   SSCC-18  18 hane   palet / sevkiyat birimi
 *   KP…               Getir palet kodu (Code 128)
 *   Code 128          diğer alfanümerik iç kodlar
 *
 * İlk beşinin tamamı GS1 mod-10 kontrol hanesi taşır ve doğrulanır.
 * Kontrol hanesi tutmuyorsa kod yine gösterilir ama AÇIKÇA uyarılır —
 * sessizce doğru sanmak, yanlış paleti göndermekten beterdir.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ==================================================================
    // GS1 mod-10 kontrol hanesi
    // ==================================================================

    /**
     * Verilen hane dizisinin (kontrol hanesi HARİÇ) kontrol hanesini hesaplar.
     * EAN-8/13, UPC-A, ITF-14 ve SSCC-18 aynı kuralı kullanır: sağdan sola
     * 3,1,3,1… ağırlıkları.
     */
    function kontrolHanesi(govde) {
        var toplam = 0;
        for (var i = govde.length - 1, k = 0; i >= 0; i--, k++) {
            toplam += parseInt(govde[i], 10) * (k % 2 === 0 ? 3 : 1);
        }
        return (10 - (toplam % 10)) % 10;
    }

    function kontrolGecerliMi(haneler) {
        if (!/^\d{2,}$/.test(haneler)) return false;
        var govde = haneler.slice(0, -1);
        var son = parseInt(haneler.slice(-1), 10);
        return kontrolHanesi(govde) === son;
    }

    // ==================================================================
    // GS1 ülke ön ekleri — yalnızca ana aralıklar
    // ==================================================================

    var ONEKLER = [
        [0, 19, 'ABD & Kanada'], [30, 39, 'ABD'], [50, 59, 'Kupon'],
        [60, 139, 'ABD & Kanada'], [300, 379, 'Fransa'], [380, 380, 'Bulgaristan'],
        [383, 383, 'Slovenya'], [385, 385, 'Hırvatistan'], [387, 387, 'Bosna-Hersek'],
        [389, 389, 'Karadağ'], [400, 440, 'Almanya'], [450, 459, 'Japonya'],
        [460, 469, 'Rusya'], [470, 470, 'Kırgızistan'], [471, 471, 'Tayvan'],
        [474, 474, 'Estonya'], [475, 475, 'Letonya'], [476, 476, 'Azerbaycan'],
        [477, 477, 'Litvanya'], [478, 478, 'Özbekistan'], [479, 479, 'Sri Lanka'],
        [480, 480, 'Filipinler'], [481, 481, 'Belarus'], [482, 482, 'Ukrayna'],
        [484, 484, 'Moldova'], [485, 485, 'Ermenistan'], [486, 486, 'Gürcistan'],
        [487, 487, 'Kazakistan'], [489, 489, 'Hong Kong'], [490, 499, 'Japonya'],
        [500, 509, 'Birleşik Krallık'], [520, 521, 'Yunanistan'], [528, 528, 'Lübnan'],
        [529, 529, 'Kıbrıs'], [530, 530, 'Arnavutluk'], [531, 531, 'Kuzey Makedonya'],
        [535, 535, 'Malta'], [539, 539, 'İrlanda'], [540, 549, 'Belçika & Lüksemburg'],
        [560, 560, 'Portekiz'], [569, 569, 'İzlanda'], [570, 579, 'Danimarka'],
        [590, 590, 'Polonya'], [594, 594, 'Romanya'], [599, 599, 'Macaristan'],
        [600, 601, 'Güney Afrika'], [608, 608, 'Bahreyn'], [609, 609, 'Mauritius'],
        [611, 611, 'Fas'], [613, 613, 'Cezayir'], [615, 615, 'Nijerya'],
        [616, 616, 'Kenya'], [618, 618, 'Fildişi Sahili'], [619, 619, 'Tunus'],
        [620, 620, 'Tanzanya'], [621, 621, 'Suriye'], [622, 622, 'Mısır'],
        [624, 624, 'Libya'], [625, 625, 'Ürdün'], [626, 626, 'İran'],
        [627, 627, 'Kuveyt'], [628, 628, 'Suudi Arabistan'], [629, 629, 'BAE'],
        [640, 649, 'Finlandiya'], [690, 699, 'Çin'], [700, 709, 'Norveç'],
        [729, 729, 'İsrail'], [730, 739, 'İsveç'], [740, 745, 'Orta Amerika'],
        [750, 750, 'Meksika'], [754, 755, 'Kanada'], [759, 759, 'Venezuela'],
        [760, 769, 'İsviçre'], [770, 771, 'Kolombiya'], [773, 773, 'Uruguay'],
        [775, 775, 'Peru'], [777, 777, 'Bolivya'], [778, 779, 'Arjantin'],
        [780, 780, 'Şili'], [784, 784, 'Paraguay'], [786, 786, 'Ekvador'],
        [789, 790, 'Brezilya'], [800, 839, 'İtalya'], [840, 849, 'İspanya'],
        [850, 850, 'Küba'], [858, 858, 'Slovakya'], [859, 859, 'Çekya'],
        [860, 860, 'Sırbistan'], [865, 865, 'Moğolistan'], [867, 867, 'Kuzey Kore'],
        [868, 869, 'Türkiye'], [870, 879, 'Hollanda'], [880, 880, 'Güney Kore'],
        [884, 884, 'Kamboçya'], [885, 885, 'Tayland'], [888, 888, 'Singapur'],
        [890, 890, 'Hindistan'], [893, 893, 'Vietnam'], [896, 896, 'Pakistan'],
        [899, 899, 'Endonezya'], [900, 919, 'Avusturya'], [930, 939, 'Avustralya'],
        [940, 949, 'Yeni Zelanda'], [955, 955, 'Malezya'], [958, 958, 'Makao'],
        [977, 977, 'Süreli yayın (ISSN)'], [978, 979, 'Kitap (ISBN)'],
        [980, 980, 'İade makbuzu'], [981, 984, 'GS1 kuponu'], [990, 999, 'GS1 kuponu'],
    ];

    /** EAN-13/UPC ön ekinden ülke/kullanım alanı. Bulunamazsa null. */
    function onekAlani(ean13) {
        if (!/^\d{13}$/.test(ean13)) return null;
        var n = parseInt(ean13.slice(0, 3), 10);
        for (var i = 0; i < ONEKLER.length; i++) {
            if (n >= ONEKLER[i][0] && n <= ONEKLER[i][1]) return ONEKLER[i][2];
        }
        return null;
    }

    // ==================================================================
    // Tanıma
    // ==================================================================

    var HANE_TIPLERI = {
        8:  { ad: 'EAN-8',   bicim: 'EAN8',    aciklama: 'Küçük ambalaj ürün kodu' },
        12: { ad: 'UPC-A',   bicim: 'UPC',     aciklama: 'Kuzey Amerika ürün kodu' },
        13: { ad: 'EAN-13',  bicim: 'EAN13',   aciklama: 'Perakende ürün kodu' },
        14: { ad: 'ITF-14',  bicim: 'ITF14',   aciklama: 'Koli / iç ambalaj kodu (GTIN-14)' },
        18: { ad: 'SSCC-18', bicim: 'CODE128', aciklama: 'Palet / sevkiyat birimi kodu' },
    };

    /**
     * Bir metnin barkod olup olmadığını söyler.
     *
     * Ürün adlarını yanlışlıkla barkod saymamak için dar davranır:
     * boşluk içeren, hiç rakamı olmayan ya da çok kısa metinler elenir.
     *
     * @returns {object|null} { ham, deger, tip, bicim, aciklama, gecerli,
     *                          kontrolBeklenen, alan, qrGerekli }
     */
    function tani(metin) {
        if (metin === null || metin === undefined) return null;
        var ham = String(metin).trim();
        if (!ham) return null;

        /*
         * Boşluk temizliği YALNIZCA sayısal yolda yapılır.
         *
         * Önce her girdiden tüm boşluklar siliniyordu; "Eker Kaymak 200 g"
         * → "EkerKaymak200g" olup alfanümerik kod testinden geçiyor ve ürün
         * adı barkod sanılıyordu. Sayısal kodlarda tarayıcı gürültüsünü
         * temizlemek gerekli, ama içinde boşluk olan bir metin hiçbir zaman
         * alfanümerik bir kod değildir.
         */
        var temiz = ham.replace(/[\s\u200b-\u200d\ufeff]/g, '');
        if (!temiz) return null;

        // --- Sadece hane: GS1 ailesi ---
        if (/^\d+$/.test(temiz)) {
            var t = HANE_TIPLERI[temiz.length];
            if (t) {
                var gecerli = kontrolGecerliMi(temiz);
                var ean13 = temiz.length === 12 ? '0' + temiz : temiz;
                return {
                    ham: ham,
                    deger: temiz,
                    tip: t.ad,
                    bicim: t.bicim,
                    aciklama: t.aciklama,
                    gecerli: gecerli,
                    kontrolBeklenen: gecerli ? null : String(kontrolHanesi(temiz.slice(0, -1))),
                    alan: temiz.length === 13 || temiz.length === 12 ? onekAlani(ean13) : null,
                    qrGerekli: false,
                };
            }
            // Tanınan uzunluklarda değil ama yine de bir kod olabilir
            if (temiz.length >= 6 && temiz.length <= 48) {
                return {
                    ham: ham, deger: temiz, tip: 'Sayısal kod', bicim: 'CODE128',
                    aciklama: 'Standart bir GTIN uzunluğunda değil',
                    gecerli: null, kontrolBeklenen: null, alan: null, qrGerekli: false,
                };
            }
            return null;
        }

        // Buradan sonrası alfanümerik: içinde boşluk varsa bu bir ürün adıdır
        if (/\s/.test(ham)) return null;

        // --- Getir palet kodu: KP ile başlar ---
        if (/^KP[-_]?[0-9A-Z]{3,}$/i.test(temiz)) {
            return {
                ham: ham, deger: temiz.toUpperCase(), tip: 'Palet kodu',
                bicim: 'CODE128', aciklama: 'Getir palet etiketi',
                gecerli: null, kontrolBeklenen: null, alan: null, qrGerekli: true,
            };
        }

        // --- Diğer alfanümerik iç kodlar ---
        // Ürün adı olmadığından emin ol: boşluk yok, en az bir rakam var,
        // en az bir harf var ve makul uzunlukta.
        if (/^[0-9A-Za-z][0-9A-Za-z._\/-]{5,47}$/.test(temiz) &&
            /\d/.test(temiz) && /[A-Za-z]/.test(temiz)) {
            return {
                ham: ham, deger: temiz, tip: 'Kod',
                bicim: 'CODE128', aciklama: 'Alfanümerik iç kod',
                gecerli: null, kontrolBeklenen: null, alan: null, qrGerekli: true,
            };
        }

        return null;
    }

    /**
     * Bir aramadaki tüm kodları çıkarır (virgül / satır / noktalı virgülle
     * ayrılmış listeler için). Yinelenenler tekilleştirilir.
     */
    function hepsiniTani(metin) {
        if (!metin) return [];
        var parcalar = String(metin).split(/[\n\r,;\t]+/);
        var gorulen = Object.create(null);
        var sonuc = [];
        for (var i = 0; i < parcalar.length; i++) {
            var k = tani(parcalar[i]);
            if (k && !gorulen[k.deger]) {
                gorulen[k.deger] = true;
                sonuc.push(k);
            }
        }
        return sonuc;
    }

    global.BarkodInceleyici = {
        tani: tani,
        hepsiniTani: hepsiniTani,
        kontrolHanesi: kontrolHanesi,
        kontrolGecerliMi: kontrolGecerliMi,
        onekAlani: onekAlani,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.BarkodInceleyici;
    }
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Jet Barkod — bilinmeyen kod kartı (gösterim katmanı)
 * ============================================================================
 * Tanınan kodu görsel bir barkoda ve gerektiğinde QR'a çevirir.
 * JsBarcode ve QRCode kütüphaneleri isteğe bağlıdır: yoksa kart yine
 * çizilir, yalnızca görsel yerine bir açıklama görünür.
 * ============================================================================
 */
(function (global) {
    'use strict';

    if (!global.document) return;
    var API = global.BarkodInceleyici;
    if (!API) return;

    var sayac = 0;

    function el(tag, cls, metin) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (metin != null) n.textContent = metin;
        return n;
    }

    /** JsBarcode'un tanıdığı biçime çevirir; olmazsa CODE128'e düşer. */
    function barkodCiz(svg, kod) {
        if (typeof global.JsBarcode !== 'function') return false;

        var denemeler = [kod.bicim, 'CODE128'];
        for (var i = 0; i < denemeler.length; i++) {
            try {
                global.JsBarcode(svg, kod.deger, {
                    format: denemeler[i],
                    lineColor: '#0f172a',
                    background: '#ffffff',
                    width: 2,
                    height: 64,
                    margin: 8,
                    fontSize: 14,
                    font: 'Inter, sans-serif',
                    textMargin: 4,
                    displayValue: true,
                    valid: function (gecerli) { if (!gecerli) throw new Error('geçersiz'); },
                });
                return true;
            } catch (e) {
                // Sonraki biçimi dene; hepsi başarısızsa kart yazıyla devam eder
                svg.innerHTML = '';
            }
        }
        return false;
    }

    function qrCiz(kap, deger) {
        if (typeof global.QRCode !== 'function') return false;
        try {
            kap.innerHTML = '';
            new global.QRCode(kap, {
                text: deger,
                width: 128,
                height: 128,
                colorDark: '#0f172a',
                colorLight: '#ffffff',
                correctLevel: global.QRCode.CorrectLevel ? global.QRCode.CorrectLevel.M : 0,
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    /** SVG barkodu PNG olarak indirir. */
    function pngIndir(svg, adi) {
        try {
            var seri = new XMLSerializer().serializeToString(svg);
            var img = new Image();
            var url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(seri)));
            img.onload = function () {
                var olcek = 3; // baskıda okunur olsun
                var c = document.createElement('canvas');
                c.width = img.width * olcek;
                c.height = img.height * olcek;
                var ctx = c.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                var a = document.createElement('a');
                a.href = c.toDataURL('image/png');
                a.download = adi + '.png';
                document.body.appendChild(a);
                a.click();
                a.remove();
            };
            img.src = url;
        } catch (e) {
            console.warn('Barkod PNG üretilemedi:', e);
        }
    }

    function dugme(metin, ikon, isle) {
        var b = el('button', 'bk-btn');
        b.type = 'button';
        b.innerHTML = ikon + '<span>' + metin + '</span>';
        b.addEventListener('click', isle);
        return b;
    }

    var IKON = {
        kopyala: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2"/></svg>',
        indir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>',
        qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path stroke-linecap="round" d="M14 14h3v3h-3zM20 14v3M14 20h6"/></svg>',
    };

    /** Tek bir kod için kart üretir. */
    function kart(kod) {
        var k = el('article', 'bk-kart');
        sayac++;

        /*
         * Üst blok iki satır: tip+doğrulama, sonra kodun kendisi.
         * Tipin uzun açıklaması ("Perakende ürün kodu" gibi) satır yemek
         * yerine ipucu metnine taşındı — kart zaten dar, her satır pahalı.
         */
        var ust = el('header', 'bk-kart__ust');

        var satir = el('div', 'bk-kart__satir');
        var tip = el('span', 'bk-kart__tip', kod.tip + (kod.alan ? ' · ' + kod.alan : ''));
        tip.title = kod.aciklama;
        satir.appendChild(tip);

        if (kod.gecerli === true) {
            var ok = el('span', 'bk-rozet bk-rozet--ok');
            ok.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
                '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
            ok.title = 'Kontrol hanesi geçerli';
            satir.appendChild(ok);
        } else if (kod.gecerli === false) {
            var uyari = el('span', 'bk-rozet bk-rozet--uyari', 'son hane ' + kod.kontrolBeklenen + ' olmalı');
            uyari.title = 'Kontrol hanesi tutmuyor. Kod yanlış okunmuş ya da eksik yazılmış ' +
                'olabilir. Düzeltilmiş hâli otomatik gösterilmiyor: yanlış bir barkodu doğru ' +
                'sanıp basmak, hiç basmamaktan kötüdür.';
            satir.appendChild(uyari);
        }

        ust.appendChild(satir);
        ust.appendChild(el('p', 'bk-kart__deger', kod.deger));
        k.appendChild(ust);

        // --- Görsel ---
        var gorsel = el('div', 'bk-kart__gorsel');
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'bk-barkod');
        gorsel.appendChild(svg);

        var qrKap = el('div', 'bk-qr');
        qrKap.hidden = !kod.qrGerekli;
        gorsel.appendChild(qrKap);
        k.appendChild(gorsel);

        var cizildi = barkodCiz(svg, kod);
        if (!cizildi) {
            svg.remove();
            gorsel.insertBefore(
                el('p', 'bk-kart__yok', 'Bu kod çizilebilir bir barkoda dönüştürülemedi.'),
                gorsel.firstChild
            );
        }
        if (kod.qrGerekli) qrCiz(qrKap, kod.deger);

        // --- Eylemler ---
        var alt = el('footer', 'bk-kart__eylem');

        alt.appendChild(dugme('Kopyala', IKON.kopyala, function (e) {
            var b = e.currentTarget;
            var s = b.querySelector('span');
            var eski = s.textContent;
            navigator.clipboard.writeText(kod.deger).then(
                function () { s.textContent = 'Kopyalandı'; },
                function () { s.textContent = 'Kopyalanamadı'; }
            );
            setTimeout(function () { s.textContent = eski; }, 1600);
        }));

        if (cizildi) {
            alt.appendChild(dugme('PNG', IKON.indir, function () {
                pngIndir(svg, kod.deger);
            }));
        }

        var qrBtn = dugme('QR', IKON.qr, function (e) {
            var acilacak = qrKap.hidden;
            qrKap.hidden = !acilacak;
            if (acilacak && !qrKap.childElementCount) qrCiz(qrKap, kod.deger);
            e.currentTarget.classList.toggle('bk-btn--acik', acilacak);
        });
        if (kod.qrGerekli) qrBtn.classList.add('bk-btn--acik');
        alt.appendChild(qrBtn);

        k.appendChild(alt);
        return k;
    }

    /**
     * Verilen metindeki kodları bulur ve kaba çizer.
     * @returns {number} çizilen kart sayısı (0 ise kod yok)
     */
    function ciz(kap, metin) {
        if (!kap) return 0;
        kap.innerHTML = '';

        var kodlar = API.hepsiniTani(metin);
        if (!kodlar.length) {
            kap.hidden = true;
            return 0;
        }

        // Tek satır. Kartlar zaten ne olduklarını söylüyor; başlığın işi
        // yalnızca "bunlar ürün değil, kod" demek.
        var baslik = el('div', 'bk-baslik');
        baslik.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
            '<path stroke-linecap="round" d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12"/></svg>' +
            '<span>Katalogda yok · ' + kodlar.length + ' kod çözümlendi</span>';
        kap.appendChild(baslik);

        var liste = el('div', 'bk-liste');
        for (var i = 0; i < kodlar.length; i++) liste.appendChild(kart(kodlar[i]));
        kap.appendChild(liste);

        kap.hidden = false;
        return kodlar.length;
    }

    API.ciz = ciz;
    API.kart = kart;
})(typeof window !== 'undefined' ? window : globalThis);
