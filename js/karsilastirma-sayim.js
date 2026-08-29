/**
 * Jet Barkod. Karşılaştırma senaryosu: raf sayımı.
 * ============================================================================
 *
 * Durum: bir rafın sayımı yapılacak. Rafta on bir kalem var.
 *
 * SOLDA: masa başında Getir'in stok ekranından gidiliyor. Ürün tek tek
 * aratılıyor, çıkan satırdaki sistem stoğu okunuyor, kâğıda ya da tabloya
 * yazılıyor, sonraki ürüne geçiliyor. Raftaki gerçek adet ise ayrıca
 * rafa gidip sayılmış olmak zorunda; iki iş iki ayrı yerde.
 *
 * SAĞDA: telefon elde, rafın önünde. Barkod okutuluyor, ürün listeye
 * kendiliğinden düşüyor, adet giriliyor. Seri okuma modunda ürünler peş
 * peşe ekleniyor. Sayım bitince sistem stoğu otomatik alınıyor, depo ile
 * sistem yan yana duruyor ve fark anında hesaplanıyor.
 *
 * SAHNE DİLİ
 * Diğer senaryolarda iki taraf da tarayıcı ekranıydı. Burada sağ taraf
 * masa başı değil, rafın önü. O yüzden sağda perspektifli bir depo
 * koridoru ve elde telefon çizildi; anlatılan fark zaten yerin kendisi.
 *
 * VERİ KURGUSAL
 * Ürün adları ve görselleri katalogdan. Adetler örnek.
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

    /* [ad, görsel, barkod, depo, sistem] */
    var URUNLER = [
        ['Kuru Soğan (1 kg)',        'sogan.jpg',    '8697458342084', 12, 14],
        ['Maydanoz Paket',           'maydanoz.jpg', '8680422241643',  6,  6],
        ['Calve Barbekü Sos',        'sos.jpg',      '8690637805219',  9, 13],
        ['Erikli Doğal Kaynak Suyu', 'su.jpg',       '8690793010052', 24, 24],
        ['Bağdat Galeta Unu',        'un.jpg',       '8690560011077',  3,  5]
    ];

    // ==================================================================
    // Sol: masa başı, Getir stok ekranı
    // ==================================================================

    function sekmeSeridi() {
        return '<rect x="0" y="0" width="400" height="22" fill="#dfe3e8"/>' +
            '<path d="M6 22 v-13 a4 4 0 0 1 4 -4 h52 a4 4 0 0 1 4 4 v13 z" fill="#fff"/>' +
            '<circle cx="17" cy="12.5" r="3.2" fill="#5d3ebc"/>' +
            '<text x="24" y="15" class="p-yazi" style="font-size:5px">Depo Paneli</text>';
    }

    function stokEkrani(aranan, sonucVar, kagitSatir) {
        var satirlar = '';
        if (sonucVar) {
            var u = URUNLER[sonucVar - 1];
            satirlar =
                '<rect x="80" y="146" width="228" height="18" rx="4" fill="#f0fdf4"/>' +
                gorsel(86, 148, 14, u[1]) +
                '<text x="106" y="158" class="p-yazi" style="font-size:4.6px;font-weight:700">' +
                u[0] + '</text>' +
                '<text x="216" y="158" class="p-yazi" style="font-size:4.2px" opacity="0.65">' +
                u[2] + '</text>' +
                '<text x="286" y="158" class="p-yazi" style="font-size:6px;font-weight:700">' +
                u[4] + '</text>';
        } else {
            satirlar = '<text x="150" y="160" class="p-yazi" style="font-size:4.4px" opacity="0.4">' +
                       (aranan ? 'Aranıyor…' : 'Ürün adı yazıp aratın') + '</text>';
        }

        var kagit = '';
        for (var i = 0; i < kagitSatir; i++) {
            var u2 = URUNLER[i];
            var yy = 216 + i * 13;
            kagit +=
                '<text x="86" y="' + yy + '" class="p-yazi" style="font-size:4px">' +
                u2[0].slice(0, 20) + '</text>' +
                '<text x="212" y="' + yy + '" class="p-yazi" style="font-size:4.4px">' + u2[3] + '</text>' +
                '<text x="248" y="' + yy + '" class="p-yazi" style="font-size:4.4px">' + u2[4] + '</text>' +
                '<text x="284" y="' + yy + '" class="p-yazi" style="font-size:4.4px" fill="' +
                (u2[3] - u2[4] < 0 ? '#dc2626' : '#64748b') + '">' +
                (u2[3] - u2[4] > 0 ? '+' : '') + (u2[3] - u2[4]) + '</text>';
        }

        return '<svg viewBox="0 0 400 300">' + sekmeSeridi() +
            '<rect x="0" y="22" width="400" height="34" class="p-mor"/>' +
            '<text x="12" y="44" class="p-sari" style="font-size:11px;font-weight:800">getir</text>' +
            '<text x="42" y="43" class="p-yazi--ak" style="font-size:6px;font-weight:700">Depo Paneli</text>' +
            '<text x="150" y="43" class="p-yazi p-yazi--ak" style="font-size:5px" opacity="0.75">' +
            'Kontrol Paneli</text>' +
            '<text x="204" y="43" class="p-sari" style="font-size:5px">Stok</text>' +
            '<circle cx="386" cy="39" r="6.5" fill="rgb(255 255 255 / 0.24)"/>' +
            '<rect x="0" y="56" width="400" height="244" class="p-zemin"/>' +

            /* Stok arama kartı */
            '<rect x="72" y="66" width="316" height="108" rx="6" class="p-kart"/>' +
            '<text x="82" y="82" class="p-yazi p-yazi--kalin" style="font-size:6px">Ürün Listesi</text>' +
            '<rect x="82" y="90" width="230" height="16" rx="5" fill="#fff" stroke="' +
            (aranan ? '#5d3ebc' : '#e2e8f0') + '"/>' +
            '<circle cx="92" cy="98" r="3.6" fill="none" stroke="#94a3b8" stroke-width="1.1"/>' +
            '<path d="M94.6 100.6 L97 103" stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round"/>' +
            '<text x="102" y="101" class="p-yazi" style="font-size:4.4px"' +
            (aranan ? '' : ' opacity="0.42"') + '>' + (aranan || 'Ürün adı') + '</text>' +
            '<rect x="320" y="90" width="42" height="16" rx="5" class="p-mor"/>' +
            '<text x="332" y="101" class="p-yazi p-yazi--ak" style="font-size:4.6px">Ara</text>' +
            '<text x="86" y="122" class="p-yazi" style="font-size:4px" opacity="0.55">Ürün</text>' +
            '<text x="216" y="122" class="p-yazi" style="font-size:4px" opacity="0.55">Barkod</text>' +
            '<text x="286" y="122" class="p-yazi" style="font-size:4px" opacity="0.55">Sistem</text>' +
            '<path d="M80 128 h300" class="p-cizgi"/>' +
            satirlar +

            /* Yanda tutulan tablo */
            '<rect x="72" y="182" width="316" height="106" rx="6" fill="#fffdf5" stroke="#fde68a"/>' +
            '<text x="82" y="196" class="p-yazi" style="font-size:5px;font-weight:700" fill="#92400e">' +
            'Elde tutulan sayım tablosu</text>' +
            '<text x="86" y="208" class="p-yazi" style="font-size:4px" opacity="0.55">Ürün</text>' +
            '<text x="212" y="208" class="p-yazi" style="font-size:4px" opacity="0.55">Depo</text>' +
            '<text x="248" y="208" class="p-yazi" style="font-size:4px" opacity="0.55">Sistem</text>' +
            '<text x="284" y="208" class="p-yazi" style="font-size:4px" opacity="0.55">Fark</text>' +
            '<path d="M80 211 h300" class="p-cizgi"/>' + kagit +
            (kagitSatir < 5
                ? '<text x="86" y="' + (216 + kagitSatir * 13 + 4) + '" class="p-yazi"' +
                  ' style="font-size:3.8px" opacity="0.4">kalan ' + (11 - kagitSatir) +
                  ' kalem için aynı tur</text>'
                : '') +
            '</svg>';
    }

    // ==================================================================
    // Sağ: rafın önü, elde telefon
    // ==================================================================

    /** Perspektifli depo koridoru. */
    function koridor() {
        var raflar = '';
        /* Sol ve sağ raf sıraları, uzaklaştıkça daralıyor. */
        for (var i = 0; i < 4; i++) {
            var t = i / 4, t2 = (i + 1) / 4;
            var x1 = 0 + t * 96, x2 = 0 + t2 * 96;
            var ust1 = 70 + t * 46, ust2 = 70 + t2 * 46;
            var alt1 = 300 - t * 62, alt2 = 300 - t2 * 62;
            raflar +=
                '<polygon points="' + x1 + ',' + ust1 + ' ' + x2 + ',' + ust2 + ' ' +
                x2 + ',' + alt2 + ' ' + x1 + ',' + alt1 + '" fill="#1e293b" opacity="' +
                (0.55 + i * 0.11) + '"/>' +
                '<polygon points="' + (400 - x1) + ',' + ust1 + ' ' + (400 - x2) + ',' + ust2 + ' ' +
                (400 - x2) + ',' + alt2 + ' ' + (400 - x1) + ',' + alt1 + '" fill="#1e293b" opacity="' +
                (0.55 + i * 0.11) + '"/>';
        }
        /* Raf katları */
        var katlar = '';
        for (var k = 0; k < 3; k++) {
            var yy = 120 + k * 52;
            katlar += '<path d="M0 ' + yy + ' L96 ' + (yy + 26) + '" stroke="#334155"' +
                      ' stroke-width="1.6" fill="none"/>' +
                      '<path d="M400 ' + yy + ' L304 ' + (yy + 26) + '" stroke="#334155"' +
                      ' stroke-width="1.6" fill="none"/>';
        }
        return '<rect x="0" y="0" width="400" height="300" fill="#0b1220"/>' +
            /* Zemin ve tavan */
            '<polygon points="0,300 96,238 304,238 400,300" fill="#111c2f"/>' +
            '<polygon points="0,0 96,116 304,116 400,0" fill="#0d1626"/>' +
            raflar + katlar +
            /* Uzakta koridorun sonu */
            '<rect x="96" y="116" width="208" height="122" fill="#152036"/>' +
            '<rect x="150" y="150" width="100" height="56" rx="4" fill="#1b2942"/>' +
            '<circle cx="200" cy="130" r="16" fill="#1d4ed8" opacity="0.14"/>';
    }

    /** Elde telefon: kamera görüntüsü ve okuma çerçevesi. */
    function telefon(icerik, tarayici) {
        return '<g>' +
            /* El */
            '<path d="M96 300 q10 -70 44 -84 q26 -10 40 6 l6 78 z" fill="#c9a288" opacity="0.9"/>' +
            /* Gövde */
            '<rect x="112" y="86" width="176" height="206" rx="16" fill="#0f172a"/>' +
            '<rect x="118" y="92" width="164" height="194" rx="12" fill="#f8fafc"/>' +
            '<rect x="176" y="96" width="48" height="5" rx="2.5" fill="#0f172a"/>' +
            icerik +
            (tarayici
                ? '<rect x="130" y="120" width="140" height="76" rx="6" fill="#0b1220"/>' +
                  '<path d="M136 132 v-8 h10 M264 132 v-8 h-10 M136 184 v8 h10 M264 184 v8 h-10"' +
                  ' stroke="#22c55e" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
                  '<g fill="#e2e8f0">' +
                  '<rect x="158" y="146" width="3" height="26"/><rect x="164" y="146" width="1.6" height="26"/>' +
                  '<rect x="169" y="146" width="3.4" height="26"/><rect x="176" y="146" width="1.6" height="26"/>' +
                  '<rect x="181" y="146" width="2.6" height="26"/><rect x="187" y="146" width="3.6" height="26"/>' +
                  '<rect x="194" y="146" width="1.6" height="26"/><rect x="199" y="146" width="3" height="26"/>' +
                  '<rect x="205" y="146" width="2" height="26"/><rect x="210" y="146" width="3.4" height="26"/>' +
                  '<rect x="217" y="146" width="1.6" height="26"/><rect x="222" y="146" width="2.6" height="26"/>' +
                  '<rect x="228" y="146" width="3.6" height="26"/><rect x="235" y="146" width="1.6" height="26"/>' +
                  '</g>' +
                  '<rect x="134" y="156" width="132" height="1.6" fill="#22c55e" opacity="0.85"/>' +
                  '<text x="150" y="210" class="p-yazi" style="font-size:5px" opacity="0.55">' +
                  'Barkodu çerçeveye alın</text>'
                : '') +
            '</g>';
    }

    function telefonIcerik(eklenen) {
        var bas =
            '<rect x="118" y="92" width="164" height="26" rx="12" fill="#2563eb"/>' +
            '<rect x="118" y="108" width="164" height="10" fill="#2563eb"/>' +
            '<text x="130" y="112" class="p-yazi p-yazi--ak" style="font-size:5.5px;font-weight:700">' +
            'Sayım · Raf C4</text>' +
            '<text x="242" y="112" class="p-yazi p-yazi--ak" style="font-size:5px" opacity="0.85">' +
            eklenen + ' ürün</text>';

        var liste = '';
        for (var i = 0; i < eklenen && i < 5; i++) {
            var u = URUNLER[i];
            var yy = 206 + i * 17;
            liste +=
                '<rect x="126" y="' + yy + '" width="148" height="14" rx="4" fill="#f1f5f9"/>' +
                gorsel(129, yy + 1.5, 11, u[1]) +
                '<text x="144" y="' + (yy + 9) + '" class="p-yazi" style="font-size:4px">' +
                u[0].slice(0, 18) + '</text>' +
                '<rect x="252" y="' + (yy + 2) + '" width="18" height="10" rx="3" fill="#dbeafe"/>' +
                '<text x="258" y="' + (yy + 9.5) + '" class="p-yazi" fill="#1d4ed8"' +
                ' style="font-size:4.4px;font-weight:700">' + u[3] + '</text>';
        }
        return bas + liste;
    }

    function depoEkrani(eklenen, tarayici) {
        return '<svg viewBox="0 0 400 300">' + koridor() +
            telefon(telefonIcerik(eklenen), tarayici) +
            '<rect x="296" y="16" width="94" height="26" rx="7" fill="rgb(15 23 42 / 0.72)"/>' +
            '<circle cx="308" cy="29" r="4" fill="#22c55e"/>' +
            '<text x="317" y="26" class="p-yazi p-yazi--ak" style="font-size:4.4px;font-weight:700">' +
            'Seri okuma açık</text>' +
            '<text x="317" y="36" class="p-yazi p-yazi--ak" style="font-size:4px" opacity="0.7">' +
            'raf başında, telefonla</text>' +
            '</svg>';
    }

    /** Sayım bitince: depo ve sistem yan yana, fark hesaplanmış. */
    var EKRAN_TABLO =
        '<svg viewBox="0 0 400 300">' +
        '<rect x="0" y="0" width="400" height="300" fill="#f7f9fc"/>' +
        '<rect x="0" y="0" width="400" height="30" fill="#fff"/>' +
        '<path d="M0 30 h400" class="p-cizgi"/>' +
        '<rect x="14" y="8" width="14" height="14" rx="4" fill="#2563eb"/>' +
        '<text x="34" y="20" class="p-yazi p-yazi--kalin" style="font-size:6px">Jet Barkod · Sayım</text>' +
        '<text x="300" y="20" class="p-yazi" style="font-size:4.6px" opacity="0.6">Raf C4 · 11 kalem</text>' +

        '<rect x="14" y="40" width="118" height="40" rx="7" class="p-kart"/>' +
        '<text x="24" y="54" class="p-yazi" style="font-size:4.2px" opacity="0.6">TOPLAM SAYILAN</text>' +
        '<text x="24" y="72" class="p-yazi" style="font-size:14px;font-weight:700">54</text>' +
        '<rect x="140" y="40" width="118" height="40" rx="7" fill="#fef2f2" stroke="#fecaca"/>' +
        '<text x="150" y="54" class="p-yazi" style="font-size:4.2px" fill="#b91c1c">DEPODA EKSİK</text>' +
        '<text x="150" y="72" class="p-yazi" style="font-size:14px;font-weight:700" fill="#dc2626">8</text>' +
        '<text x="196" y="72" class="p-yazi" style="font-size:6px;font-weight:700" fill="#dc2626">' +
        '− ₺ 412,60</text>' +
        '<rect x="266" y="40" width="120" height="40" rx="7" fill="#ecfdf5" stroke="#a7f3d0"/>' +
        '<text x="276" y="54" class="p-yazi" style="font-size:4.2px" fill="#047857">TAM EŞLEŞEN</text>' +
        '<text x="276" y="72" class="p-yazi" style="font-size:14px;font-weight:700" fill="#059669">2</text>' +

        '<rect x="14" y="90" width="372" height="196" rx="7" class="p-kart"/>' +
        '<text x="26" y="106" class="p-yazi" style="font-size:4.4px" opacity="0.55">Ürün</text>' +
        '<text x="228" y="106" class="p-yazi" style="font-size:4.4px" opacity="0.55">Depo</text>' +
        '<text x="272" y="106" class="p-yazi" style="font-size:4.4px" opacity="0.55">Sistem</text>' +
        '<text x="320" y="106" class="p-yazi" style="font-size:4.4px" opacity="0.55">Fark</text>' +
        '<path d="M22 111 h356" class="p-cizgi"/>' +
        (function () {
            var t = '';
            for (var i = 0; i < URUNLER.length; i++) {
                var u = URUNLER[i];
                var fark = u[3] - u[4];
                var yy = 130 + i * 30;
                t += gorsel(26, yy - 12, 18, u[1]) +
                     '<text x="52" y="' + yy + '" class="p-yazi" style="font-size:5px">' + u[0] + '</text>' +
                     '<text x="52" y="' + (yy + 8) + '" class="p-yazi" style="font-size:4px"' +
                     ' opacity="0.55">' + u[2] + '</text>' +
                     '<text x="230" y="' + yy + '" class="p-yazi" style="font-size:6px;font-weight:700">' +
                     u[3] + '</text>' +
                     '<text x="276" y="' + yy + '" class="p-yazi" style="font-size:6px;font-weight:700">' +
                     u[4] + '</text>' +
                     '<rect x="316" y="' + (yy - 8) + '" width="30" height="12" rx="3" fill="' +
                     (fark === 0 ? '#f1f5f9' : '#fee2e2') + '"/>' +
                     '<text x="323" y="' + yy + '" class="p-yazi" style="font-size:5px;font-weight:700"' +
                     ' fill="' + (fark === 0 ? '#64748b' : '#dc2626') + '">' +
                     (fark > 0 ? '+' : '') + fark + '</text>' +
                     '<path d="M22 ' + (yy + 15) + ' h356" class="p-cizgi"/>';
            }
            return t;
        })() +
        '</svg>';

    // ==================================================================
    // Senaryo
    // ==================================================================

    function y(x, yy) { return [x / 4, yy / 3]; }

    global.JBSenaryoSayim = {
        baslik: 'Bir rafın sayımı',
        ozet: 'On bir kalemlik bir raf sayılacak. Solda masa başında, sağda rafın önünde.',
        vurgu: 'Solda sistem stoğu tek tek aratılıyor. Sağda sayım bitince kendiliğinden geliyor.',

        sol: {
            ad: 'Eski yöntem · masa başı',
            ekranlar: {
                bos: stokEkrani('', 0, 0),
                aranan1: stokEkrani('kuru soğan', 0, 0),
                sonuc1: stokEkrani('kuru soğan', 1, 0),
                yazildi1: stokEkrani('kuru soğan', 1, 1),
                sonuc2: stokEkrani('maydanoz', 2, 1),
                yazildi2: stokEkrani('maydanoz', 2, 2),
                sonuc3: stokEkrani('calve barbekü', 3, 2),
                yazildi3: stokEkrani('calve barbekü', 3, 3)
            },
            adimlar: [
                { ad: 'Stok ekranı açık, ilk ürün yazıldı', sure: 1400, ekran: 'aranan1',
                  imlec: y(180, 98), goz: y(180, 98), tik: true },
                { ad: 'Sistem stoğu geldi', sureAralik: [1200, 1800], ekran: 'sonuc1',
                  yukleniyor: true, goz: y(240, 155) },
                { ad: 'Değer tabloya yazıldı', sure: 1300, ekran: 'yazildi1',
                  imlec: y(250, 216), goz: y(200, 216), tik: true },
                { ad: 'İkinci ürün aratıldı', sure: 1400, ekran: 'sonuc2',
                  imlec: y(180, 98), goz: y(180, 98), tik: true },
                { ad: 'Değer okundu ve yazıldı', sureAralik: [1400, 2000], ekran: 'yazildi2',
                  goz: y(200, 229) },
                { ad: 'Üçüncü ürün aratıldı', sure: 1400, ekran: 'sonuc3',
                  imlec: y(180, 98), goz: y(180, 98), tik: true },
                { ad: 'Değer okundu ve yazıldı', sureAralik: [1400, 2000], ekran: 'yazildi3',
                  goz: y(200, 242) },
                { ad: 'Kalan sekiz kalem için aynı tur', sureAralik: [1600, 2400],
                  ekran: 'yazildi3', goz: y(200, 262) },
                { ad: 'Raftaki gerçek adetler ayrıca sayılacak', sure: 1500,
                  ekran: 'yazildi3', goz: y(200, 200), imlec: null }
            ]
        },

        sag: {
            ad: 'Jet Barkod · rafın önünde',
            ekranlar: {
                tara: depoEkrani(0, true),
                bir: depoEkrani(1, true),
                iki: depoEkrani(2, true),
                uc: depoEkrani(3, true),
                bes: depoEkrani(5, false),
                tablo: EKRAN_TABLO
            },
            adimlar: [
                { ad: 'Raf başında seri okuma açıldı', sure: 800, ekran: 'tara',
                  goz: y(200, 158) },
                { ad: 'İlk barkod okutuldu, ürün listeye düştü', sure: 900, ekran: 'bir',
                  goz: y(200, 158) },
                { ad: 'İkinci ürün', sure: 700, ekran: 'iki', goz: y(200, 158) },
                { ad: 'Üçüncü ürün', sure: 700, ekran: 'uc', goz: y(200, 158) },
                { ad: 'Peş peşe okundu, adetler girildi', sure: 1100, ekran: 'bes',
                  goz: y(200, 240) },
                { ad: 'Sistem stoğu otomatik alındı', sure: 800, ekran: 'tablo',
                  yukleniyor: true, goz: y(200, 60) },
                { ad: 'Depo ve sistem yan yana, fark hesaplandı', sure: 1200, ekran: 'tablo',
                  goz: y(320, 150), imlec: null }
            ]
        }
    };
})(window);
