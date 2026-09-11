/**
 * Jet Barkod. Karşılaştırma senaryosu: sipariş toplama.
 * ============================================================================
 *
 * DURUM
 * Bankoya bir sipariş düştü: beş kalem, sekiz parça. İki yöntemle de aynı
 * sipariş toplanıyor.
 *
 * SOLDA: el terminali. Liste cihazın küçük ekranında, ürün rafta. Göz iki
 * yerde: bir listeye, bir rafa. Her kalemde terminale dönüp sıradakini
 * okumak, adedi küçük yazıdan seçmek, gramajdan emin olamayınca tahmin
 * etmek gerekiyor. Üstelik saat işliyor; acele ettiren şey işin kendisi
 * değil, süreyi yetiştirme kaygısı.
 *
 * SAĞDA: barkodlar tek seferde okutuluyor, liste telefona düşüyor. Toplama
 * sıradaki sipariş beklenirken yapılıyor. Satıra dokununca yeşile dönüyor,
 * adet balonu çıkıyor, gramajdan emin olunmayan üründe görsel büyütülüp
 * barkod kontrol ediliyor.
 *
 * NEDEN SAĞDAKİ ADIMLAR DAHA ÇOK AMA SÜRE DAHA KISA
 * Sağda bilinçli olarak DAHA FAZLA adım var: görsel açma, barkod kontrolü,
 * adet doğrulama. Yani sağ taraf işi baştan savmıyor, aksine daha çok
 * kontrol yapıyor. Buna rağmen süre kısa çıkıyor çünkü kaybedilen zaman
 * kontrolde değil, raf ile terminal arasında gidip gelmekte.
 *
 * VERİ KURGUSAL
 * Banko numarası, sipariş içeriği ve adetler uydurma. Ürün adları ve
 * görselleri katalogdan. Depo, müşteri, toplayıcı, kurye bilgisi yok.
 * ============================================================================
 */
(function (global) {
    'use strict';

    function gorsel(x, yy, boyut, dosya) {
        return '<image href="../assets/tanitim/' + dosya + '" x="' + x + '" y="' + yy +
               '" width="' + boyut + '" height="' + boyut +
               '" preserveAspectRatio="xMidYMid slice"' +
               ' style="clip-path: inset(0 round 2px)"/>';
    }

    /* [ad, görsel, barkod, adet, raf] */
    var SIPARIS = [
        ['Ekmek (200 g)',      'ekmek.jpg',    '8690000000018', 2, 'A-12'],
        ['Süt (1 L)',          'sut.jpg',      '8690000000025', 1, 'C-04'],
        ['Erikli Su (5 L)',    'su.jpg',       '8690000000032', 3, 'D-21'],
        ['Maydanoz',           'maydanoz.jpg', '8690000000049', 1, 'B-07'],
        ['Süzme Yoğurt',       'yogurt.jpg',   '8690000000056', 1, 'C-09']
    ];

    // ==================================================================
    // Sol taraf: depo koridoru ve el terminali
    // ==================================================================

    /** Uzaklaştıkça daralan raf sıraları. Koşulan yer burası. */
    function koridor(kayma) {
        var raflar = '';
        for (var i = 0; i < 4; i++) {
            var t = i / 4, t2 = (i + 1) / 4;
            var x1 = t * 92, x2 = t2 * 92;
            var ust1 = 64 + t * 44, ust2 = 64 + t2 * 44;
            var alt1 = 300 - t * 58, alt2 = 300 - t2 * 58;
            raflar +=
                '<polygon points="' + x1 + ',' + ust1 + ' ' + x2 + ',' + ust2 + ' ' +
                x2 + ',' + alt2 + ' ' + x1 + ',' + alt1 + '" fill="#1e293b" opacity="' +
                (0.5 + i * 0.12) + '"/>' +
                '<polygon points="' + (400 - x1) + ',' + ust1 + ' ' + (400 - x2) + ',' + ust2 + ' ' +
                (400 - x2) + ',' + alt2 + ' ' + (400 - x1) + ',' + alt1 + '" fill="#1e293b" opacity="' +
                (0.5 + i * 0.12) + '"/>';
        }

        /* Raf katları. `kayma` her ekranda biraz değişiyor: aynı koridorda
           başka bir noktada olunduğunu anlatan tek işaret bu. */
        var katlar = '';
        for (var k = 0; k < 3; k++) {
            var yy = 112 + k * 50 + (kayma || 0);
            katlar += '<path d="M0 ' + yy + ' L92 ' + (yy + 24) + '" stroke="#334155"' +
                      ' stroke-width="1.6" fill="none"/>' +
                      '<path d="M400 ' + yy + ' L308 ' + (yy + 24) + '" stroke="#334155"' +
                      ' stroke-width="1.6" fill="none"/>';
        }

        return '<rect x="0" y="0" width="400" height="300" fill="#0b1220"/>' +
            '<polygon points="0,300 92,242 308,242 400,300" fill="#111c2f"/>' +
            '<polygon points="0,0 92,108 308,108 400,0" fill="#0d1626"/>' +
            raflar + katlar +
            '<rect x="92" y="108" width="216" height="134" fill="#152036"/>' +
            '<rect x="146" y="142" width="108" height="62" rx="4" fill="#1b2942"/>';
    }

    /**
     * El terminali. Ekranı küçük: sipariş satırları 3,4 punto çıkıyor.
     * Bu bir üslup tercihi değil, anlatılan şeyin kendisi; okumak için
     * durup bakmak gerekiyor.
     */
    function terminal(icerik, uyari) {
        return '<g>' +
            /* El */
            '<path d="M118 300 q8 -62 38 -74 q24 -9 36 5 l5 69 z" fill="#c9a288" opacity="0.92"/>' +
            /* Gövde */
            '<rect x="140" y="52" width="126" height="214" rx="13" fill="#111827"/>' +
            '<rect x="146" y="58" width="114" height="202" rx="9" fill="#1f2937"/>' +
            /* Ekran */
            '<rect x="152" y="66" width="102" height="122" rx="5" fill="#f8fafc"/>' +
            icerik +
            /* Tuş takımı */
            '<g fill="#374151">' +
            '<rect x="154" y="196" width="22" height="13" rx="3"/>' +
            '<rect x="180" y="196" width="22" height="13" rx="3"/>' +
            '<rect x="206" y="196" width="22" height="13" rx="3"/>' +
            '<rect x="232" y="196" width="22" height="13" rx="3"/>' +
            '<rect x="154" y="213" width="22" height="13" rx="3"/>' +
            '<rect x="180" y="213" width="22" height="13" rx="3"/>' +
            '<rect x="206" y="213" width="22" height="13" rx="3"/>' +
            '<rect x="232" y="213" width="22" height="13" rx="3"/>' +
            '<rect x="154" y="230" width="48" height="13" rx="3"/>' +
            '<rect x="206" y="230" width="48" height="13" rx="3"/>' +
            '</g>' +
            (uyari
                ? '<rect x="286" y="24" width="102" height="30" rx="7" fill="rgb(180 83 9 / 0.92)"/>' +
                  '<text x="296" y="36" class="p-yazi p-yazi--ak" style="font-size:4.6px;font-weight:700">' +
                  uyari[0] + '</text>' +
                  '<text x="296" y="46" class="p-yazi p-yazi--ak" style="font-size:4px" opacity="0.85">' +
                  uyari[1] + '</text>'
                : '') +
            '</g>';
    }

    /** Terminalin ekranındaki sipariş listesi. */
    function terminalListe(sira) {
        var s = '<rect x="152" y="66" width="102" height="16" fill="#e5e7eb"/>' +
            '<text x="158" y="76" class="p-yazi" style="font-size:4.6px;font-weight:700">' +
            'SIPARIS BNK.004</text>';
        for (var i = 0; i < SIPARIS.length; i++) {
            var u = SIPARIS[i];
            var yy = 86 + i * 19;
            var bitti = i < sira;
            s += '<rect x="155" y="' + yy + '" width="96" height="17" rx="2" fill="' +
                 (bitti ? '#eef2f6' : '#fff') + '" stroke="#d1d5db" stroke-width="0.5"/>' +
                 '<text x="159" y="' + (yy + 7) + '" class="p-yazi" style="font-size:3.6px' +
                 (bitti ? ';opacity:0.45' : '') + '">' + u[0] + '</text>' +
                 '<text x="159" y="' + (yy + 13.5) + '" class="p-yazi" style="font-size:3.2px;opacity:0.5">' +
                 'RAF ' + u[4] + '</text>' +
                 '<text x="242" y="' + (yy + 11) + '" class="p-yazi" style="font-size:4.6px;font-weight:700' +
                 (bitti ? ';opacity:0.4' : '') + '">' + u[3] + '</text>' +
                 (bitti ? '<path d="M232 ' + (yy + 8) + ' l2.4 2.4 l4.6 -5" stroke="#16a34a"' +
                          ' stroke-width="1.4" fill="none" stroke-linecap="round"/>' : '');
        }
        return s;
    }

    function eskiEkran(sira, kayma, uyari) {
        return '<svg viewBox="0 0 400 300">' + koridor(kayma) +
            terminal(terminalListe(sira), uyari) + '</svg>';
    }

    // ==================================================================
    // Sağ taraf: telefonda siparişler sayfası
    // ==================================================================

    /** Telefon kasası. Sağ tarafın yıldızı, bu yüzden daha büyük. */
    function telefon(icerik) {
        return '<g>' +
            '<path d="M112 300 q8 -58 36 -70 q22 -8 34 4 l5 66 z" fill="#c9a288" opacity="0.9"/>' +
            '<rect x="116" y="30" width="168" height="262" rx="19" fill="#0f172a"/>' +
            '<rect x="122" y="36" width="156" height="250" rx="15" fill="#f4f6f9"/>' +
            '<rect x="182" y="40" width="36" height="4" rx="2" fill="#0f172a"/>' +
            icerik +
            '</g>';
    }

    /**
     * Siparişler sayfasının kendisi. Sınıf adları ve düzen `siparisler`
     * sayfasıyla aynı mantıkta: banko başlığı, ilerleme çubuğu, ürün
     * satırları, alınan satır yeşile dönüyor.
     */
    function siparisListesi(alinan, opts) {
        opts = opts || {};
        var toplamParca = 8;
        var alinanParca = 0;
        for (var a = 0; a < alinan; a++) alinanParca += SIPARIS[a][3];
        var oran = alinanParca / toplamParca;

        var s = '';

        /* Başlık */
        s += '<rect x="122" y="48" width="156" height="30" fill="#fff"/>' +
             '<path d="M122 78 h156" stroke="#e4e7ec" stroke-width="0.8"/>' +
             '<path d="M132 58 l-4 5 l4 5" stroke="#667085" stroke-width="1.4" fill="none"' +
             ' stroke-linecap="round" stroke-linejoin="round"/>' +
             '<text x="140" y="60" class="p-yazi" style="font-size:6px;font-weight:800;fill:#111827">' +
             'BNK.004</text>' +
             '<text x="140" y="70" class="p-yazi" style="font-size:3.8px;opacity:0.6">' +
             '5 kalem · 8 parça · 2 poşet</text>' +
             '<rect x="242" y="54" width="28" height="13" rx="6" fill="#eef4ff"/>' +
             '<text x="248" y="63" class="p-yazi" style="font-size:4px;font-weight:700;fill:#2563eb">' +
             alinanParca + '/' + toplamParca + '</text>';

        /* İlerleme çubuğu */
        s += '<rect x="132" y="84" width="136" height="4" rx="2" fill="#e4e7ec"/>' +
             '<rect x="132" y="84" width="' + (136 * oran).toFixed(1) + '" height="4" rx="2"' +
             ' fill="' + (oran === 1 ? '#0e9f6e' : '#2563eb') + '"/>';

        /* Ürün satırları */
        for (var i = 0; i < SIPARIS.length; i++) {
            var u = SIPARIS[i];
            var yy = 96 + i * 34;
            var bitti = i < alinan;
            var coklu = u[3] > 1;

            s += '<rect x="130" y="' + yy + '" width="140" height="30" rx="6" fill="' +
                 (bitti ? '#f0fdf6' : '#fff') + '" stroke="' +
                 (bitti ? '#a7e8c8' : '#e4e7ec') + '" stroke-width="0.8"/>' +
                 gorsel(134, yy + 4, 22, u[1]) +
                 '<text x="160" y="' + (yy + 12) + '" class="p-yazi"' +
                 ' style="font-size:4.4px;font-weight:600;fill:#111827' +
                 (bitti ? ';opacity:0.55' : '') + '">' + u[0] + '</text>' +
                 '<text x="160" y="' + (yy + 20) + '" class="p-yazi"' +
                 ' style="font-size:3.4px;opacity:0.5">' + u[2] + '</text>' +
                 '<text x="160" y="' + (yy + 26.5) + '" class="p-yazi"' +
                 ' style="font-size:3.4px;opacity:0.5">Raf ' + u[4] + '</text>';

            /* Adet rozeti: çoklu olan mavi ve kalın, tek olan sönük.
               Kaçırılması en pahalı bilgi bu. */
            s += '<rect x="226" y="' + (yy + 8) + '" width="18" height="13" rx="4" fill="' +
                 (coklu ? '#dbe7ff' : '#f4f6f9') + '"/>' +
                 '<text x="230" y="' + (yy + 17) + '" class="p-yazi"' +
                 ' style="font-size:5px;font-weight:800;fill:' +
                 (coklu ? '#2563eb' : '#667085') + '">×' + u[3] + '</text>';

            /* Tik */
            if (bitti) {
                s += '<circle cx="256" cy="' + (yy + 15) + '" r="7" fill="#0e9f6e"/>' +
                     '<path d="M252.5 ' + (yy + 15) + ' l2.4 2.4 l4.6 -5.2" stroke="#fff"' +
                     ' stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
            } else {
                s += '<circle cx="256" cy="' + (yy + 15) + '" r="7" fill="#fff" stroke="#d0d5dd"' +
                     ' stroke-width="1"/>';
            }
        }

        /* Adet balonu: işaretlenen satırın üstünde bir an beliriyor. */
        if (opts.balon != null) {
            var by = 96 + opts.balon * 34;
            s += '<rect x="216" y="' + (by - 6) + '" width="38" height="14" rx="5" fill="#111827"/>' +
                 '<path d="M232 ' + (by + 8) + ' l4 -4 h-8 z" fill="#111827"/>' +
                 '<text x="222" y="' + (by + 4) + '" class="p-yazi p-yazi--ak"' +
                 ' style="font-size:5px;font-weight:800">×' + SIPARIS[opts.balon][3] + ' aldım</text>';
        }

        /* Büyütülmüş ürün görseli: gramajdan emin olunmadığında açılıyor. */
        if (opts.buyutulen != null) {
            var u2 = SIPARIS[opts.buyutulen];
            s += '<rect x="122" y="36" width="156" height="250" rx="15" fill="rgb(15 23 42 / 0.72)"/>' +
                 '<rect x="136" y="92" width="128" height="138" rx="10" fill="#fff"/>' +
                 gorsel(146, 102, 108, u2[1]) +
                 '<text x="146" y="222" class="p-yazi"' +
                 ' style="font-size:5px;font-weight:700;fill:#111827">' + u2[0] + '</text>' +
                 '<rect x="136" y="236" width="128" height="26" rx="7" fill="#fff"/>' +
                 barkodCizgileri(144, 241, 112, 12) +
                 '<text x="146" y="272" class="p-yazi p-yazi--ak" style="font-size:4px" opacity="0.85">' +
                 'Barkod ve gramaj doğrulandı</text>';
        }

        return s;
    }

    /** Barkod çizgileri. Okunacak bir şey değil, "barkod var" işareti. */
    function barkodCizgileri(x, yy, en, boy) {
        var c = '';
        var kalinliklar = [1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 3, 1];
        var imlec = x;
        for (var i = 0; i < kalinliklar.length && imlec < x + en; i++) {
            if (i % 2 === 0) {
                c += '<rect x="' + imlec.toFixed(1) + '" y="' + yy + '" width="' +
                     kalinliklar[i] + '" height="' + boy + '" fill="#111827"/>';
            }
            imlec += kalinliklar[i] + 1.4;
        }
        return c;
    }

    /** Toplu barkod okutma: siparişin bütün barkodları tek geçişte. */
    function okutmaEkrani() {
        return '<svg viewBox="0 0 400 300">' + koridor(0) +
            telefon(siparisListesi(0)) +
            '<rect x="122" y="36" width="156" height="250" rx="15" fill="rgb(11 18 32 / 0.82)"/>' +
            '<rect x="136" y="118" width="128" height="76" rx="8" fill="#0b1220"/>' +
            '<path d="M142 132 v-8 h10 M258 132 v-8 h-10 M142 182 v8 h10 M258 182 v8 h-10"' +
            ' stroke="#22c55e" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
            barkodCizgileri(152, 142, 96, 28) +
            '<rect x="136" y="150" width="128" height="1.6" fill="#22c55e" opacity="0.85"/>' +
            '<text x="146" y="214" class="p-yazi p-yazi--ak" style="font-size:5px;font-weight:700">' +
            'Sekiz parça tek geçişte okundu</text>' +
            '<text x="146" y="224" class="p-yazi p-yazi--ak" style="font-size:4px" opacity="0.7">' +
            'liste telefona düştü</text>' +
            '<rect x="292" y="24" width="96" height="30" rx="7" fill="rgb(14 124 88 / 0.92)"/>' +
            '<circle cx="304" cy="39" r="4" fill="#4ade80"/>' +
            '<text x="313" y="36" class="p-yazi p-yazi--ak" style="font-size:4.6px;font-weight:700">' +
            'Sıradaki sipariş</text>' +
            '<text x="313" y="46" class="p-yazi p-yazi--ak" style="font-size:4px" opacity="0.85">' +
            'daha gelmedi</text>' +
            '</svg>';
    }

    function yeniEkran(alinan, opts) {
        return '<svg viewBox="0 0 400 300">' + koridor(0) +
            telefon(siparisListesi(alinan, opts)) +
            '</svg>';
    }

    function bittiEkrani() {
        return '<svg viewBox="0 0 400 300">' + koridor(0) +
            telefon(siparisListesi(5)) +
            '<rect x="136" y="240" width="128" height="30" rx="8" fill="#0e9f6e"/>' +
            '<path d="M158 255 l4 4 l7 -8" stroke="#fff" stroke-width="2" fill="none"' +
            ' stroke-linecap="round" stroke-linejoin="round"/>' +
            '<text x="174" y="259" class="p-yazi p-yazi--ak" style="font-size:6px;font-weight:800">' +
            'Toplandı</text>' +
            '</svg>';
    }

    // ==================================================================
    // Senaryo
    // ==================================================================

    function y(x, yy) { return [x / 4, yy / 3]; }

    global.JBSenaryoToplama = {
        baslik: 'Bir siparişin toplanması',
        ozet: 'Beş kalem, sekiz parça. Solda el terminaliyle, sağda telefonla.',
        vurgu: 'Sağ taraf daha çok kontrol yapıyor: adet, gramaj, barkod. Süre yine de kısa.',

        sol: {
            ad: 'El terminali · raf raf',
            ekranlar: {
                dusen: eskiEkran(0, 0, null),
                raf1:  eskiEkran(0, 6, null),
                oku1:  eskiEkran(1, 6, null),
                raf2:  eskiEkran(1, 14, null),
                oku2:  eskiEkran(2, 14, null),
                suphe: eskiEkran(2, 14, ['Gramajdan emin değil', 'etiket okunmuyor']),
                raf3:  eskiEkran(3, 22, null),
                raf4:  eskiEkran(4, 8, null),
                banko: eskiEkran(5, 0, null)
            },
            adimlar: [
                { ad: 'Sipariş terminale düştü', sure: 900, ekran: 'dusen',
                  goz: y(200, 120) },
                { ad: 'İlk kalem okundu, rafa gidiliyor', sureAralik: [2600, 3400], ekran: 'raf1',
                  goz: y(200, 120) },
                { ad: 'Ürün alındı, terminale dönüldü', sureAralik: [1800, 2400], ekran: 'oku1',
                  goz: y(200, 120), imlec: y(200, 210), tik: true },
                { ad: 'Sıradaki kalem için başka koridor', sureAralik: [3000, 3900], ekran: 'raf2',
                  goz: y(200, 130) },
                { ad: 'Adet küçük yazıda, durup bakılıyor', sureAralik: [1600, 2200], ekran: 'oku2',
                  goz: y(203, 120) },
                { ad: 'Gramajdan emin olunamadı', sureAralik: [2200, 3000], ekran: 'suphe',
                  goz: y(203, 130), imlec: null },
                { ad: 'Tahminle alındı, üçüncü rafa', sureAralik: [3000, 3800], ekran: 'raf3',
                  goz: y(200, 120) },
                { ad: 'Dördüncü ve beşinci kalem', sureAralik: [4200, 5400], ekran: 'raf4',
                  goz: y(200, 130) },
                { ad: 'Bankoya dönüldü, sipariş kapandı', sureAralik: [2200, 2800], ekran: 'banko',
                  goz: y(200, 120), imlec: null }
            ]
        },

        sag: {
            ad: 'Jet Barkod · telefonda liste',
            ekranlar: {
                okut:  okutmaEkrani(),
                liste: yeniEkran(0),
                bir:   yeniEkran(1, { balon: 0 }),
                iki:   yeniEkran(2),
                gorselAcik: yeniEkran(2, { buyutulen: 2 }),
                uc:    yeniEkran(3, { balon: 2 }),
                bes:   yeniEkran(5),
                bitti: bittiEkrani()
            },
            adimlar: [
                { ad: 'Barkodlar tek geçişte okutuldu', sureAralik: [800, 1100], ekran: 'okut',
                  goz: y(200, 156) },
                { ad: 'Liste telefona düştü, sıradaki sipariş beklenirken', sureAralik: [700, 950], ekran: 'liste',
                  goz: y(200, 110) },
                { ad: 'İlk ürün alındı, satır yeşile döndü', sureAralik: [600, 850], ekran: 'bir',
                  imlec: y(256, 111), goz: y(256, 111), tik: true },
                { ad: 'Adet balonu ne kadar alındığını söylüyor', sureAralik: [550, 800], ekran: 'iki',
                  imlec: y(256, 145), goz: y(240, 104), tik: true },
                { ad: 'Gramajdan emin olunmadı, görsel açıldı', sureAralik: [800, 1200], ekran: 'gorselAcik',
                  imlec: y(190, 160), goz: y(200, 160), tik: true },
                { ad: 'Barkod da doğrulandı', sureAralik: [600, 900], ekran: 'uc',
                  imlec: y(256, 179), goz: y(200, 248), tik: true },
                { ad: 'Kalan iki kalem işaretlendi', sureAralik: [850, 1250], ekran: 'bes',
                  imlec: y(256, 247), goz: y(256, 247), tik: true },
                { ad: 'Sipariş kapandı', sure: 800, ekran: 'bitti',
                  goz: y(200, 255), imlec: null }
            ]
        }
    };
})(window);
