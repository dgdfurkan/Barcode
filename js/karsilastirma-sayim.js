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

    function stokEkrani(aranan, sonucVar, yaziBirimi) {
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

        /*
         * Deftere yazma parça parça ilerliyor. `yaziBirimi` kaç parçanın
         * yazıldığını söylüyor; her satır dört parça: ürün adı, depo
         * adedi, sistem değeri ve fark.
         *
         * Önce satırın tamamı tek karede beliriyordu. Gerçekte kimse bir
         * satırı bir anda yazmıyor: adı yazılıyor, sonra rakamlar tek tek
         * giriliyor, fark en son hesaplanıyor. Süre farkının nereden
         * geldiği ancak böyle anlaşılıyor.
         */
        var kagit = '';
        var tamSatir = Math.floor(yaziBirimi / 4);
        var yarimParca = yaziBirimi % 4;

        for (var i = 0; i <= tamSatir && i < URUNLER.length; i++) {
            var parca = i < tamSatir ? 4 : yarimParca;
            if (!parca) break;

            var u2 = URUNLER[i];
            var yy = 218 + i * 14;
            var egim = [-0.9, 0.7, -0.5, 1.1, -0.7][i % 5];
            var fark = u2[3] - u2[4];
            var g = '<g transform="rotate(' + egim + ' 200 ' + yy + ')">';

            if (parca >= 1) {
                g += '<text x="88" y="' + yy + '" class="el-yazisi" style="font-size:6.4px">' +
                     u2[0].slice(0, 18) + '</text>';
            }
            if (parca >= 2) {
                g += '<text x="216" y="' + yy + '" class="el-yazisi" style="font-size:7px">' +
                     u2[3] + '</text>';
            }
            if (parca >= 3) {
                g += '<text x="252" y="' + yy + '" class="el-yazisi" style="font-size:7px">' +
                     u2[4] + '</text>';
            }
            if (parca >= 4) {
                g += '<text x="288" y="' + yy + '" class="el-yazisi el-yazisi--kirmizi"' +
                     ' style="font-size:7px">' + (fark > 0 ? '+' : '') + fark + '</text>';
            }

            /* Yazılan satırın ucunda kalem izi: sıra burada. */
            if (i === tamSatir && parca < 4) {
                var kalemX = [88, 216, 252, 288][parca];
                if (parca >= 1) kalemX = [88, 216, 252, 288][parca];
                g += '<rect x="' + kalemX + '" y="' + (yy - 5) + '" width="7" height="1.2"' +
                     ' fill="#1e3a8a" opacity="0.55"/>';
            }
            g += '</g>';
            kagit += g;
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
            /* Çizgili defter: masanın üstünde duran kağıt */
            '<rect x="72" y="182" width="316" height="106" rx="4" fill="#fffdf3" stroke="#e7dcc0"/>' +
            '<path d="M84 182 v106" stroke="#f4a8a8" stroke-width="0.9"/>' +
            (function () {
                var c = '';
                for (var g = 0; g < 6; g++) {
                    c += '<path d="M76 ' + (206 + g * 14) + ' h308" stroke="#dfe7f3"' +
                         ' stroke-width="0.7"/>';
                }
                return c;
            })() +
            '<text x="90" y="196" class="el-yazisi" style="font-size:7px">Raf C4 sayım</text>' +
            '<text x="216" y="196" class="el-yazisi" style="font-size:5.6px">depo</text>' +
            '<text x="252" y="196" class="el-yazisi" style="font-size:5.6px">sistem</text>' +
            '<text x="288" y="196" class="el-yazisi" style="font-size:5.6px">fark</text>' + kagit +

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

    /**
     * Sayım bitince açılan ızgara. Bizim sayım sayfamızın kendisi:
     * ürünler kart kart, her kartın altında depo, fark ve sistem değerleri
     * tek şeritte. Renk anlamı: eksik kırmızı, eşit gri, fazla yeşil.
     */
    function izgaraKart(x, yy, u) {
        var fark = u[3] - u[4];
        var sinif = fark === 0 ? ['#f1f5f9', '#64748b'] :
                    (fark < 0 ? ['#fee2e2', '#b91c1c'] : ['#dcfce7', '#15803d']);
        return '<g>' +
            '<rect x="' + x + '" y="' + yy + '" width="86" height="76" rx="7"' +
            ' fill="#fff" stroke="#e8edf3"/>' +
            '<rect x="' + (x + 1) + '" y="' + (yy + 1) + '" width="84" height="38" rx="6" fill="#fbfdff"/>' +
            gorsel(x + 29, yy + 4, 30, u[1]) +
            '<text x="' + (x + 6) + '" y="' + (yy + 50) + '" class="p-yazi"' +
            ' style="font-size:4.2px;font-weight:600">' + u[0].slice(0, 20) + '</text>' +
            '<text x="' + (x + 6) + '" y="' + (yy + 57) + '" class="p-yazi"' +
            ' style="font-size:3.6px" opacity="0.5">' + u[2] + '</text>' +
            /* Alt şerit: depo · fark · sistem */
            '<rect x="' + (x + 5) + '" y="' + (yy + 60) + '" width="76" height="12" rx="3" fill="' +
            sinif[0] + '"/>' +
            '<text x="' + (x + 11) + '" y="' + (yy + 68.5) + '" class="p-yazi"' +
            ' style="font-size:5.4px;font-weight:700" fill="' + sinif[1] + '">' + u[3] + '</text>' +
            '<text x="' + (x + 36) + '" y="' + (yy + 68.5) + '" class="p-yazi"' +
            ' style="font-size:5px;font-weight:700" fill="' + sinif[1] + '">' +
            (fark > 0 ? '+' : '') + fark + '</text>' +
            '<text x="' + (x + 66) + '" y="' + (yy + 68.5) + '" class="p-yazi"' +
            ' style="font-size:5.4px;font-weight:700" fill="' + sinif[1] + '">' + u[4] + '</text>' +
            '</g>';
    }

    var EKRAN_IZGARA =
        '<svg viewBox="0 0 400 300">' +
        '<rect x="0" y="0" width="400" height="300" fill="#f7f9fc"/>' +
        '<rect x="0" y="0" width="400" height="30" fill="#fff"/>' +
        '<path d="M0 30 h400" class="p-cizgi"/>' +
        '<rect x="14" y="8" width="14" height="14" rx="4" fill="#2563eb"/>' +
        '<text x="34" y="20" class="p-yazi p-yazi--kalin" style="font-size:6px">Jet Barkod · Sayım</text>' +
        '<rect x="300" y="8" width="34" height="14" rx="4" fill="#fff" stroke="#e8edf3"/>' +
        '<text x="308" y="18" class="p-yazi" style="font-size:4.4px">Liste</text>' +
        '<rect x="338" y="8" width="34" height="14" rx="4" fill="#eef4ff" stroke="#c7dbff"/>' +
        '<text x="346" y="18" class="p-yazi" fill="#1d4ed8" style="font-size:4.4px">Izgara</text>' +

        /* Özet kutuları */
        '<rect x="14" y="38" width="88" height="34" rx="6" class="p-kart"/>' +
        '<text x="22" y="50" class="p-yazi" style="font-size:3.8px" opacity="0.55">TOPLAM SAYILAN</text>' +
        '<text x="22" y="65" class="p-yazi" style="font-size:12px;font-weight:700">54</text>' +
        '<rect x="108" y="38" width="88" height="34" rx="6" fill="#fef2f2" stroke="#fecaca"/>' +
        '<text x="116" y="50" class="p-yazi" style="font-size:3.8px" fill="#b91c1c">DEPODA EKSİK</text>' +
        '<text x="116" y="65" class="p-yazi" style="font-size:12px;font-weight:700" fill="#dc2626">8</text>' +
        '<text x="150" y="65" class="p-yazi" style="font-size:5.4px;font-weight:700" fill="#dc2626">' +
        '− ₺412,60</text>' +
        '<rect x="202" y="38" width="88" height="34" rx="6" fill="#f1f5f9"/>' +
        '<text x="210" y="50" class="p-yazi" style="font-size:3.8px" opacity="0.55">TAM EŞLEŞEN</text>' +
        '<text x="210" y="65" class="p-yazi" style="font-size:12px;font-weight:700">2</text>' +
        '<rect x="296" y="38" width="90" height="34" rx="6" fill="#ecfdf5" stroke="#a7f3d0"/>' +
        '<text x="304" y="50" class="p-yazi" style="font-size:3.8px" fill="#047857">SAYIM SÜRESİ</text>' +
        '<text x="304" y="65" class="p-yazi" style="font-size:12px;font-weight:700" fill="#059669">' +
        '3dk</text>' +

        /* Renk anahtarı */
        '<rect x="14" y="78" width="372" height="14" rx="4" fill="#fff" stroke="#eef2f7"/>' +
        '<rect x="22" y="82" width="7" height="7" rx="2" fill="#fee2e2"/>' +
        '<text x="33" y="88" class="p-yazi" style="font-size:4px" opacity="0.65">Depoda eksik</text>' +
        '<rect x="82" y="82" width="7" height="7" rx="2" fill="#f1f5f9"/>' +
        '<text x="93" y="88" class="p-yazi" style="font-size:4px" opacity="0.65">Eşit</text>' +
        '<rect x="122" y="82" width="7" height="7" rx="2" fill="#dcfce7"/>' +
        '<text x="133" y="88" class="p-yazi" style="font-size:4px" opacity="0.65">Depoda fazla</text>' +
        '<text x="300" y="88" class="p-yazi" style="font-size:4px" opacity="0.5">' +
        'depo · fark · sistem</text>' +

        /* Izgara: kart kart ürünler */
        izgaraKart(14, 98, URUNLER[0]) + izgaraKart(108, 98, URUNLER[1]) +
        izgaraKart(202, 98, URUNLER[2]) + izgaraKart(296, 98, URUNLER[3]) +
        izgaraKart(14, 182, URUNLER[4]) +
        '<rect x="108" y="182" width="86" height="76" rx="7" fill="#fff" stroke="#e8edf3"/>' +
        '<rect x="202" y="182" width="86" height="76" rx="7" fill="#fff" stroke="#e8edf3"/>' +
        '<rect x="296" y="182" width="86" height="76" rx="7" fill="#fff" stroke="#e8edf3"/>' +
        '<text x="14" y="274" class="p-yazi" style="font-size:4px" opacity="0.5">' +
        '11 kalem · sistem stoğu otomatik alındı · fark adet ve tutar olarak hesaplandı</text>' +
        '</svg>';

    // ==================================================================
    // Senaryo
    // ==================================================================

    function y(x, yy) { return [x / 4, yy / 3]; }

    global.JBSenaryoSayim = {
        baslik: 'Bir rafın sayımı',
        ozet: 'On bir kalemlik bir raf. Solda elle, sağda telefonla.',
        vurgu: 'Elle sayımda her kalem için ayrı arama. Izgarada hepsi tek ekranda.',

        sol: {
            ad: 'Elle sayım · masa başı',
            /*
             * Ekran adları: a<arama sırası>_<yazılan parça sayısı>.
             * Parça sayısı deftere kaç alanın girildiğini söylüyor;
             * her satır dört alan.
             */
            ekranlar: (function () {
                var e = {};
                var aramalar = ['kuru soğan', 'maydanoz', 'calve barbekü', 'erikli su', 'galeta unu'];
                /* İlk üç kalem alan alan yazılıyor. */
                for (var i = 0; i < 3; i++) {
                    var taban = i * 4;
                    e['ara' + i] = stokEkrani(aramalar[i], 0, taban);
                    e['bul' + i] = stokEkrani(aramalar[i], i + 1, taban);
                    for (var k = 1; k <= 4; k++) {
                        e['y' + i + '_' + k] = stokEkrani(aramalar[i], i + 1, taban + k);
                    }
                }
                /* Kalan kalemler satır satır. */
                e.dort = stokEkrani(aramalar[3], 4, 16);
                e.bes = stokEkrani(aramalar[4], 5, 20);
                return e;
            })(),
            adimlar: [
                { ad: '1. kalem aratıldı', sure: 1300, ekran: 'ara0',
                  imlec: y(180, 98), goz: y(180, 98), tik: true },
                { ad: 'Sistem stoğu geldi', sureAralik: [1300, 1900], ekran: 'bul0',
                  yukleniyor: true, goz: y(240, 155) },
                { ad: 'Ürün adı deftere yazılıyor', sure: 2100, ekran: 'y0_1',
                  imlec: y(120, 218), goz: y(120, 218) },
                { ad: 'Depodaki adet giriliyor', sure: 1000, ekran: 'y0_2',
                  imlec: y(219, 218), goz: y(219, 218) },
                { ad: 'Sistem değeri giriliyor', sure: 1000, ekran: 'y0_3',
                  imlec: y(255, 218), goz: y(255, 218) },
                { ad: 'Fark elde hesaplanıp yazılıyor', sure: 1400, ekran: 'y0_4',
                  imlec: y(291, 218), goz: y(291, 218) },

                { ad: '2. kalem aratıldı', sure: 1300, ekran: 'ara1',
                  imlec: y(180, 98), goz: y(180, 98), tik: true },
                { ad: 'Sistem stoğu geldi', sureAralik: [1300, 1900], ekran: 'bul1',
                  yukleniyor: true, goz: y(240, 155) },
                { ad: 'Ürün adı yazılıyor', sure: 2000, ekran: 'y1_1',
                  imlec: y(120, 232), goz: y(120, 232) },
                { ad: 'Depo adedi', sure: 950, ekran: 'y1_2',
                  imlec: y(219, 232), goz: y(219, 232) },
                { ad: 'Sistem değeri', sure: 950, ekran: 'y1_3',
                  imlec: y(255, 232), goz: y(255, 232) },
                { ad: 'Fark', sure: 1300, ekran: 'y1_4',
                  imlec: y(291, 232), goz: y(291, 232) },

                { ad: '3. kalem aratıldı', sure: 1300, ekran: 'ara2',
                  imlec: y(180, 98), goz: y(180, 98), tik: true },
                { ad: 'Sistem stoğu geldi', sureAralik: [1300, 1900], ekran: 'bul2',
                  yukleniyor: true, goz: y(240, 155) },
                { ad: 'Ürün adı yazılıyor', sure: 2000, ekran: 'y2_1',
                  imlec: y(120, 246), goz: y(120, 246) },
                { ad: 'Depo adedi', sure: 950, ekran: 'y2_2',
                  imlec: y(219, 246), goz: y(219, 246) },
                { ad: 'Sistem değeri', sure: 950, ekran: 'y2_3',
                  imlec: y(255, 246), goz: y(255, 246) },
                { ad: 'Fark', sure: 1300, ekran: 'y2_4',
                  imlec: y(291, 246), goz: y(291, 246) },

                { ad: '4. kalem: ara, oku, yaz', sureAralik: [4200, 5200], ekran: 'dort',
                  imlec: y(180, 98), goz: y(200, 260), tik: true },
                { ad: '5. kalem: ara, oku, yaz', sureAralik: [4200, 5200], ekran: 'bes',
                  imlec: y(180, 98), goz: y(200, 274), tik: true },
                { ad: 'Kalan altı kalem için aynı tur', sureAralik: [5000, 6500],
                  ekran: 'bes', goz: y(200, 240), imlec: null }
            ]
        },

        sag: {
            ad: 'Jet Barkod · rafın önünde',
            ekranlar: {
                tara: depoEkrani(0, true),
                bir: depoEkrani(1, true),
                uc: depoEkrani(3, true),
                bes: depoEkrani(5, false),
                izgara: EKRAN_IZGARA
            },
            adimlar: [
                { ad: 'Raf başında seri okuma açıldı', sure: 550, ekran: 'tara',
                  goz: y(200, 158) },
                { ad: 'Barkodlar peş peşe okutuldu', sure: 600, ekran: 'bir',
                  goz: y(200, 158) },
                { ad: 'Ürünler listeye kendiliğinden düştü', sure: 600, ekran: 'uc',
                  goz: y(200, 158) },
                { ad: 'On bir kalem bitti', sure: 600, ekran: 'bes',
                  goz: y(200, 240) },
                { ad: 'Sistem stoğu otomatik alındı', sure: 550, ekran: 'izgara',
                  yukleniyor: true, goz: y(200, 55) },
                { ad: 'Izgarada hepsi: depo, fark, sistem', sure: 900, ekran: 'izgara',
                  goz: y(200, 160), imlec: null }
            ]
        }
    };
})(window);
