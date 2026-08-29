/**
 * Jet Barkod. Karşılaştırma senaryosu: ürün hangi siparişte.
 * ============================================================================
 *
 * Durum: bankoda ya da dolapta bir ürün unutulmuş. Hangi siparişe ait
 * olduğunu bulmak gerekiyor. Kontrol panelinde on aktif sipariş var.
 *
 * SOLDA: Getir'in kendi ekranından gidiliyor. Sipariş kartı açılıyor,
 * ürün listesi gözle taranıyor, kapatılıyor, sıradaki açılıyor. Aranan
 * ürün kaçıncı siparişteyse o kadar tur dönülüyor.
 *
 * SAĞDA: Hızlı Bul çubuğuna ürün adı yazılıyor. Eşleşen siparişler öne
 * çıkıyor, kalanlar geri plana düşüyor. Kartlar içeriğe göre renkleniyor:
 * su mavi, fırın sarı, dondurma mor. Sipariş numarasının yanında kaç
 * parça olduğu yazıyor.
 *
 * VERİ KURGUSAL
 * Sipariş kodları, kurye ve müşteri adları uydurma. Ürün adları ve
 * görselleri katalogdan.
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

    function sekmeSeridi() {
        return '<rect x="0" y="0" width="400" height="22" fill="#dfe3e8"/>' +
            '<path d="M6 22 v-13 a4 4 0 0 1 4 -4 h52 a4 4 0 0 1 4 4 v13 z" fill="#fff"/>' +
            '<circle cx="17" cy="12.5" r="3.2" fill="#5d3ebc"/>' +
            '<text x="24" y="15" class="p-yazi" style="font-size:5px">Depo Paneli</text>';
    }

    function kabuk() {
        return '<rect x="0" y="22" width="400" height="34" class="p-mor"/>' +
            '<text x="12" y="44" class="p-sari" style="font-size:11px;font-weight:800">getir</text>' +
            '<text x="42" y="37" class="p-yazi--ak" style="font-size:6px;font-weight:700">Depo Paneli</text>' +
            '<rect x="42" y="40" width="26" height="8" rx="3" fill="#0f7b4a"/>' +
            '<text x="46" y="46" class="p-yazi p-yazi--ak" style="font-size:4.2px">Müsait</text>' +
            '<text x="72" y="46" class="p-yazi p-yazi--ak" style="font-size:5px">Örnek Depo</text>' +
            '<text x="150" y="43" class="p-sari" style="font-size:5px">Kontrol Paneli</text>' +
            '<text x="196" y="43" class="p-yazi p-yazi--ak" style="font-size:5px" opacity="0.75">Harita</text>' +
            '<text x="224" y="43" class="p-yazi p-yazi--ak" style="font-size:5px" opacity="0.75">Stok</text>' +
            '<circle cx="386" cy="39" r="6.5" fill="rgb(255 255 255 / 0.24)"/>' +
            '<rect x="0" y="56" width="400" height="244" class="p-zemin"/>' +
            '<text x="14" y="70" class="p-yazi" style="font-size:4.6px" opacity="0.5">Kontrol Paneli</text>' +
            '<text x="14" y="84" class="p-yazi" style="font-size:5px" fill="#5d3ebc"' +
            ' font-weight="700">Siparişler</text>' +
            '<text x="56" y="84" class="p-yazi" style="font-size:5px" opacity="0.6">Harita</text>' +
            '<text x="88" y="84" class="p-yazi" style="font-size:5px" opacity="0.6">Pişirme Önerileri</text>' +
            '<path d="M0 90 h400" class="p-cizgi"/>';
    }

    // ==================================================================
    // Siparişler
    // ==================================================================

    /* [kod, müşteri, kurye, parça, aranan ürün içinde mi, kategori] */
    var SIPARISLER = [
        ['a41c', 'S. Kaya',   'Kurye 1', 4,  false, ''],
        ['7b93', 'M. Aydın',  'Kurye 2', 11, false, 'firin'],
        ['3e08', 'E. Şahin',  'Kurye 1', 6,  false, ''],
        ['c12f', 'B. Yıldız', 'Kurye 3', 9,  true,  'su'],
        ['9d47', 'T. Arslan', 'Kurye 2', 5,  false, 'dondurma'],
        ['52a6', 'N. Çelik',  'Kurye 3', 7,  true,  'su'],
        ['e830', 'K. Doğan',  'Kurye 1', 3,  false, ''],
        ['6f15', 'A. Tunç',   'Kurye 2', 8,  false, 'firin']
    ];

    var KATEGORI = { su: '#3b82f6', firin: '#eab308', dondurma: '#a855f7', '': null };

    /**
     * Sipariş kartı. `vurgu` verildiğinde kart öne çıkıyor, `sonuk`
     * verildiğinde geri plana düşüyor. Hızlı Bul aramasında ikisi de
     * kullanılıyor.
     */
    function kart(x, yy, s, vurgu, sonuk, renkli) {
        var renk = renkli ? KATEGORI[s[5]] : null;
        return '<g' + (sonuk ? ' opacity="0.32"' : '') + '>' +
            '<rect x="' + x + '" y="' + yy + '" width="86" height="46" rx="6" fill="#fff"' +
            ' stroke="' + (vurgu ? '#1d4ed8' : '#e8edf3') + '" stroke-width="' +
            (vurgu ? '1.6' : '1') + '"/>' +
            (renk
                ? '<rect x="' + x + '" y="' + yy + '" width="3" height="46" rx="1.5" fill="' + renk + '"/>'
                : '') +
            '<text x="' + (x + 8) + '" y="' + (yy + 12) + '" class="p-yazi"' +
            ' style="font-size:5px;font-weight:700">' + s[0] + '</text>' +
            '<rect x="' + (x + 30) + '" y="' + (yy + 6) + '" width="26" height="8" rx="2" fill="#f1f5f9"/>' +
            '<text x="' + (x + 33) + '" y="' + (yy + 12) + '" class="p-yazi"' +
            ' style="font-size:3.8px" opacity="0.7">' + s[3] + ' parça</text>' +
            '<text x="' + (x + 8) + '" y="' + (yy + 24) + '" class="p-yazi"' +
            ' style="font-size:4.2px">' + s[1] + '</text>' +
            '<text x="' + (x + 8) + '" y="' + (yy + 34) + '" class="p-yazi"' +
            ' style="font-size:4.2px" opacity="0.7">' + s[2] + '</text>' +
            (vurgu
                ? '<rect x="' + (x + 8) + '" y="' + (yy + 37) + '" width="52" height="7" rx="2" fill="#dbeafe"/>' +
                  '<text x="' + (x + 11) + '" y="' + (yy + 42.5) + '" class="p-yazi" fill="#1d4ed8"' +
                  ' style="font-size:3.6px;font-weight:700">' + (s[3] > 8 ? 2 : 1) + ' ürün eşleşti</text>'
                : '<circle cx="' + (x + 76) + '" cy="' + (yy + 10) + '" r="3" fill="#22c55e"/>') +
            '</g>';
    }

    function panelEkrani(secili, widget, sonuclu, renkli) {
        var kartlar = '';
        for (var i = 0; i < SIPARISLER.length; i++) {
            var x = 14 + (i % 4) * 94;
            var yy = 100 + Math.floor(i / 4) * 56;
            var s = SIPARISLER[i];
            kartlar += kart(x, yy, s,
                sonuclu && s[4],
                sonuclu && !s[4],
                renkli);
        }
        return '<svg viewBox="0 0 400 300">' + sekmeSeridi() + kabuk() +
            kartlar +
            (sonuclu
                ? '<rect x="14" y="216" width="372" height="16" rx="5" fill="#eff6ff" stroke="#bfdbfe"/>' +
                  '<text x="22" y="227" class="p-yazi" fill="#1d4ed8"' +
                  ' style="font-size:4.6px;font-weight:700">2 siparişte bulundu</text>' +
                  '<text x="96" y="227" class="p-yazi" style="font-size:4.2px" opacity="0.7">' +
                  'Eşleşen kartlar öne çıktı, diğerleri geri plana düştü</text>'
                : '<text x="14" y="228" class="p-yazi" style="font-size:4.2px" opacity="0.5">' +
                  'Aktif sipariş: 8 · içeriği görmek için karta tıklanır</text>') +
            (widget || '') +
            '</svg>';
    }

    // ==================================================================
    // Sipariş detayı (eski yöntem)
    // ==================================================================

    var URUN_HAVUZU = [
        ['Kuru Soğan (1 kg)', 'sogan.jpg'],
        ['Maydanoz Paket', 'maydanoz.jpg'],
        ['Calve Barbekü Sos', 'sos.jpg'],
        ['Bağdat Galeta Unu', 'un.jpg'],
        ['Sütaş Kaymaksız Yoğurt', 'kaymak.jpg'],
        ['Cook Alüminyum Folyo', 'folyo.jpg'],
        ['La Lorraine Sokak Simiti', 'simit.jpg'],
        ['Algida Nogger Sandwich', 'dondurma.jpg']
    ];

    /** Sipariş detayı penceresi. `bulundu` ise aranan su ürünü listede. */
    function detayEkrani(siparisSira, bulundu) {
        var s = SIPARISLER[siparisSira];
        var satirlar = '';
        var adet = 5;
        for (var i = 0; i < adet; i++) {
            var u = URUN_HAVUZU[(siparisSira * 3 + i) % URUN_HAVUZU.length];
            var yy = 150 + i * 20;
            satirlar +=
                gorsel(46, yy - 9, 12, u[1]) +
                '<text x="64" y="' + yy + '" class="p-yazi" style="font-size:4.6px">' + u[0] + '</text>' +
                '<text x="200" y="' + yy + '" class="p-yazi" style="font-size:4.6px">1</text>' +
                '<path d="M44 ' + (yy + 5) + ' h150" class="p-cizgi"/>';
        }

        var sagSatirlar = '';
        for (var j = 0; j < adet; j++) {
            var v = URUN_HAVUZU[(siparisSira * 3 + j + 4) % URUN_HAVUZU.length];
            var yy2 = 150 + j * 20;
            var sonuncu = j === adet - 1;
            if (sonuncu && bulundu) {
                sagSatirlar +=
                    '<rect x="212" y="' + (yy2 - 11) + '" width="150" height="16" rx="3" fill="#dcfce7"/>' +
                    gorsel(216, yy2 - 9, 12, 'su.jpg') +
                    '<text x="234" y="' + yy2 + '" class="p-yazi"' +
                    ' style="font-size:4.6px;font-weight:700">Erikli Doğal Kaynak Suyu</text>' +
                    '<text x="352" y="' + yy2 + '" class="p-yazi" style="font-size:4.6px">2</text>';
            } else {
                sagSatirlar +=
                    gorsel(216, yy2 - 9, 12, v[1]) +
                    '<text x="234" y="' + yy2 + '" class="p-yazi" style="font-size:4.6px">' + v[0] + '</text>' +
                    '<text x="352" y="' + yy2 + '" class="p-yazi" style="font-size:4.6px">1</text>';
            }
            sagSatirlar += '<path d="M214 ' + (yy2 + 5) + ' h150" class="p-cizgi"/>';
        }

        return '<svg viewBox="0 0 400 300">' + sekmeSeridi() + kabuk() +
            '<rect x="0" y="22" width="400" height="278" fill="rgb(15 23 42 / 0.4)"/>' +
            '<rect x="26" y="60" width="348" height="212" rx="8" fill="#fff"/>' +
            '<text x="40" y="80" class="p-yazi p-yazi--kalin" style="font-size:6px">Sipariş Detayları</text>' +
            '<rect x="112" y="72" width="34" height="10" rx="3" fill="#f1f5f9"/>' +
            '<text x="116" y="79.5" class="p-yazi" style="font-size:4px">' + s[0] + '</text>' +
            '<path d="M356 74 l7 7 M363 74 l-7 7" stroke="#94a3b8" stroke-width="1.3"' +
            ' stroke-linecap="round"/>' +
            '<text x="40" y="98" class="p-yazi" style="font-size:4.2px" opacity="0.55">Müşteri</text>' +
            '<text x="40" y="107" class="p-yazi" style="font-size:4.6px">' + s[1] + '</text>' +
            '<text x="120" y="98" class="p-yazi" style="font-size:4.2px" opacity="0.55">Kurye</text>' +
            '<text x="120" y="107" class="p-yazi" style="font-size:4.6px">' + s[2] + '</text>' +
            '<text x="200" y="98" class="p-yazi" style="font-size:4.2px" opacity="0.55">Adet</text>' +
            '<text x="200" y="107" class="p-yazi" style="font-size:4.6px">' + s[3] + '</text>' +
            '<text x="280" y="98" class="p-yazi" style="font-size:4.2px" opacity="0.55">Durum</text>' +
            '<text x="280" y="107" class="p-yazi" style="font-size:4.6px">Hazırlandı</text>' +
            '<path d="M40 118 h320" class="p-cizgi"/>' +
            '<text x="46" y="132" class="p-yazi" style="font-size:4.2px" opacity="0.55">Ürün Adı</text>' +
            '<text x="200" y="132" class="p-yazi" style="font-size:4.2px" opacity="0.55">Adet</text>' +
            '<text x="216" y="132" class="p-yazi" style="font-size:4.2px" opacity="0.55">Ürün Adı</text>' +
            '<text x="352" y="132" class="p-yazi" style="font-size:4.2px" opacity="0.55">Adet</text>' +
            satirlar + sagSatirlar +
            '</svg>';
    }

    // ==================================================================
    // Hızlı Bul penceresi
    // ==================================================================

    function widget(acik, metin, sonuc) {
        if (!acik) {
            return '<circle cx="368" cy="266" r="15" fill="#1d4ed8"/>' +
                   '<circle cx="366" cy="264" r="4.6" fill="none" stroke="#fff" stroke-width="1.6"/>' +
                   '<path d="M369.4 267.4 L373 271" stroke="#fff" stroke-width="1.6"' +
                   ' stroke-linecap="round"/>';
        }
        var sonucAlani = '';
        if (sonuc) {
            sonucAlani =
                '<rect x="252" y="196" width="130" height="14" rx="4" fill="#eff6ff"/>' +
                '<text x="258" y="205.5" class="p-yazi" fill="#1d4ed8"' +
                ' style="font-size:4px;font-weight:700">2 SİPARİŞTE BULUNDU</text>' +
                '<rect x="252" y="213" width="130" height="20" rx="4" fill="#fff" stroke="#e5e7eb"/>' +
                '<rect x="252" y="213" width="3" height="20" rx="1.5" fill="#3b82f6"/>' +
                '<text x="260" y="222" class="p-yazi" style="font-size:4.4px;font-weight:700">c12f</text>' +
                '<text x="282" y="222" class="p-yazi" style="font-size:3.8px" opacity="0.65">9 parça</text>' +
                '<text x="320" y="222" class="p-yazi" style="font-size:3.8px" opacity="0.65">Kurye 3</text>' +
                '<text x="260" y="230" class="p-yazi" fill="#1d4ed8" style="font-size:3.8px">' +
                '2 ürün eşleşti</text>' +
                '<rect x="252" y="236" width="130" height="20" rx="4" fill="#fff" stroke="#e5e7eb"/>' +
                '<rect x="252" y="236" width="3" height="20" rx="1.5" fill="#3b82f6"/>' +
                '<text x="260" y="245" class="p-yazi" style="font-size:4.4px;font-weight:700">52a6</text>' +
                '<text x="282" y="245" class="p-yazi" style="font-size:3.8px" opacity="0.65">7 parça</text>' +
                '<text x="320" y="245" class="p-yazi" style="font-size:3.8px" opacity="0.65">Kurye 3</text>' +
                '<text x="260" y="253" class="p-yazi" fill="#1d4ed8" style="font-size:3.8px">' +
                '1 ürün eşleşti</text>';
        }

        return '<rect x="246" y="118" width="142" height="146" rx="8" fill="#fff"' +
            ' stroke="#e2e8f0"/>' +
            '<path d="M246 126 a8 8 0 0 1 8 -8 h126 a8 8 0 0 1 8 8 v14 h-142 z" fill="#0f172a"/>' +
            '<text x="254" y="133" class="p-yazi p-yazi--ak" style="font-size:5px;font-weight:700">' +
            '🚀 Hızlı Bul</text>' +
            '<text x="360" y="133" class="p-yazi p-yazi--ak" style="font-size:5px" opacity="0.7">⚙</text>' +
            '<text x="374" y="133" class="p-yazi p-yazi--ak" style="font-size:5px" opacity="0.7">✕</text>' +
            '<rect x="252" y="146" width="130" height="11" rx="4" fill="#ecfdf5" stroke="#a7f3d0"/>' +
            '<text x="258" y="153.5" class="p-yazi" fill="#047857" style="font-size:3.8px">' +
            '✅ Bağlantı hazır · 42 dk kaldı</text>' +
            '<text x="252" y="165" class="p-yazi" style="font-size:3.6px" opacity="0.55">' +
            '🔄 Token otomatik alınıyor</text>' +
            '<rect x="252" y="170" width="130" height="16" rx="5" fill="#fff" stroke="' +
            (metin ? '#1d4ed8' : '#e2e8f0') + '"/>' +
            '<text x="258" y="181" class="p-yazi" style="font-size:4.4px"' +
            (metin ? '' : ' opacity="0.42"') + '>' + (metin || '🔍 Ürün Ara...') + '</text>' +
            (metin && !sonuc ? '<rect x="' + (258 + metin.length * 2.3) +
                '" y="174" width="1" height="8" fill="#1d4ed8"/>' : '') +
            sonucAlani +
            '<text x="252" y="' + (sonuc ? 262 : 200) + '" class="p-yazi"' +
            ' style="font-size:3.4px" opacity="0.45">Kuyruk: 0 · Hafıza: 8 sipariş</text>';
    }

    // ==================================================================
    // Senaryo
    // ==================================================================

    function y(x, yy) { return [x / 4, yy / 3]; }

    global.JBSenaryoHizliBul = {
        baslik: 'Unutulan ürün hangi siparişte',
        ozet: 'Bankoda kalan bir su bulundu. Sekiz aktif siparişten hangisine ait olduğu aranıyor.',
        vurgu: 'Solda dördüncü siparişte çıktı. Beşinci olsaydı fark daha da açılırdı.',

        sol: {
            ad: 'Eklentisiz depo',
            ekranlar: {
                panel: panelEkrani(-1, null, false, false),
                detay0: detayEkrani(0, false),
                detay1: detayEkrani(1, false),
                detay2: detayEkrani(2, false),
                detay3: detayEkrani(3, true)
            },
            adimlar: [
                { ad: 'İlk sipariş açıldı', sure: 800, ekran: 'panel',
                  imlec: y(50, 118), goz: y(50, 118), tik: true },
                { ad: 'Ürün listesi gözle tarandı, yok', sureAralik: [1300, 1900],
                  ekran: 'detay0', goz: y(200, 190) },
                { ad: 'Kapatıldı, ikinci sipariş açıldı', sure: 900, ekran: 'panel',
                  imlec: y(144, 118), goz: y(144, 118), tik: true },
                { ad: 'Tarandı, yine yok', sureAralik: [1300, 1900], ekran: 'detay1',
                  goz: y(200, 190) },
                { ad: 'Üçüncü sipariş açıldı', sure: 900, ekran: 'panel',
                  imlec: y(238, 118), goz: y(238, 118), tik: true },
                { ad: 'Tarandı, yok', sureAralik: [1300, 1900], ekran: 'detay2',
                  goz: y(200, 190) },
                { ad: 'Dördüncü sipariş açıldı', sure: 900, ekran: 'panel',
                  imlec: y(332, 118), goz: y(332, 118), tik: true },
                { ad: 'Sağ sütunun sonunda bulundu', sureAralik: [1400, 2000],
                  ekran: 'detay3', goz: y(290, 230) },
                { ad: 'Sipariş numarası not edildi', sure: 1100, ekran: 'detay3',
                  goz: y(128, 78), imlec: null }
            ]
        },

        sag: {
            ad: 'Jet Barkod Asistan kurulu',
            ekranlar: {
                panel: panelEkrani(-1, widget(false), false, true),
                acik: panelEkrani(-1, widget(true, '', false), false, true),
                yazildi: panelEkrani(-1, widget(true, 'su', false), false, true),
                sonuc: panelEkrani(-1, widget(true, 'su', true), true, true)
            },
            adimlar: [
                { ad: 'Hızlı Bul düğmesine basıldı', sure: 700, ekran: 'panel',
                  imlec: y(368, 266), goz: y(368, 266), tik: true },
                { ad: 'Bağlantı hazır, jeton otomatik alınmış', sure: 700, ekran: 'acik',
                  goz: y(316, 152) },
                { ad: 'Ürün adı yazıldı', sure: 1100, ekran: 'yazildi',
                  imlec: y(300, 178), goz: y(300, 178), tik: true },
                { ad: 'İki sipariş bulundu', sure: 900, ekran: 'sonuc',
                  goz: y(316, 205), imlec: null },
                { ad: 'Eşleşen kartlar öne çıktı, kalanlar soldu', sure: 1200, ekran: 'sonuc',
                  goz: y(120, 130) }
            ]
        }
    };
})(window);
