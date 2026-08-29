/**
 * Jet Barkod. Karşılaştırma senaryosu: fırında ne pişecek.
 * ============================================================================
 *
 * Başlangıç iki tarafta da aynı: vardiya başında personel Pişirme
 * Önerileri sayfasını açıyor. Kronometre sayfaya girildiği anda başlıyor.
 *
 * SAYFA GERÇEKTE NASIL
 * Dört zaman dilimi yan yana: 08-12, 12-16, 16-20, 20-00. Her dilimde on
 * beş ürün, yani toplam altmış satır. Satırların çoğunda yazan sayı bir
 * ya da sıfır. Satırda yalnız "kaç pişir" yazıyor; rafta ve donukta ne
 * kadar olduğunu görmek için satırı tek tek açmak gerekiyor.
 *
 * SOLDA yaşanan: içinde bulunulan dilime bakılıyor, birkaç satır tek tek
 * açılıp kapatılıyor, sonraki dilimlere bakılmıyor ve miktar tahminle
 * belirleniyor. Fazla pişen ürün akşam çöpe gidiyor.
 *
 * SAĞDA: tek düğme, karar kartları. Ne kadar ve neden yazıyor, rafta ve
 * donuktaki stok kartın üstünde, sonraki üç dilim de aynı ekranda.
 * Fazla pişirme daha başlamadan engelleniyor.
 *
 * VERİ KURGUSAL
 * Ürün adları ve görselleri katalogdan. Adetler canlı panelin gerçek
 * değerleri DEĞİL; aynı şekle sahip örnek sayılar.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ==================================================================
    // Ortak parçalar
    // ==================================================================

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
            '<text x="24" y="15" class="p-yazi p-yazi--kucuk">Depo Paneli</text>';
    }

    /** Panel kabuğu: mor şerit, sol menü, kırıntı yolu, sekmeler. */
    function kabuk() {
        var sekmeler = ['Siparişler', 'Harita', 'Pişirme Önerileri', 'İptal Siparişler'];
        var x = 86;
        var sekmeYazi = '';
        for (var i = 0; i < sekmeler.length; i++) {
            var sec = sekmeler[i] === 'Pişirme Önerileri';
            sekmeYazi += '<text x="' + x + '" y="86" class="p-yazi p-yazi--kucuk" fill="' +
                         (sec ? '#5d3ebc' : '#64748b') + '"' + (sec ? ' font-weight="700"' : '') +
                         '>' + sekmeler[i] + '</text>';
            if (sec) sekmeYazi += '<rect x="' + x + '" y="90" width="' + (sekmeler[i].length * 3.1) +
                                  '" height="1.6" fill="#5d3ebc"/>';
            x += sekmeler[i].length * 3.1 + 12;
        }

        return '<rect x="0" y="22" width="400" height="38" class="p-mor"/>' +
            '<text x="14" y="46" class="p-sari" style="font-size:12px;font-weight:800">getir</text>' +
            '<text x="46" y="38" class="p-yazi--ak" style="font-size:6.5px;font-weight:700">Depo Paneli</text>' +
            '<rect x="46" y="42" width="28" height="8" rx="3" fill="#0f7b4a"/>' +
            '<text x="50" y="48" class="p-yazi p-yazi--ak" style="font-size:4.5px">Müsait</text>' +
            '<text x="78" y="48" class="p-yazi p-yazi--ak" style="font-size:5.5px">Örnek Depo</text>' +
            '<circle cx="386" cy="41" r="7" fill="rgb(255 255 255 / 0.24)"/>' +
            '<rect x="0" y="60" width="400" height="240" fill="#fff"/>' +
            '<rect x="0" y="60" width="72" height="240" fill="#fff"/>' +
            '<path d="M72 60 v240" class="p-cizgi"/>' +
            '<text x="12" y="76" class="p-yazi p-yazi--kucuk" opacity="0.6">Kontrol Paneli</text>' +
            '<text x="12" y="90" class="p-yazi p-yazi--kucuk" fill="#5d3ebc" font-weight="700">Stok</text>' +
            '<text x="12" y="104" class="p-yazi p-yazi--kucuk" opacity="0.6">Sık Kullanılanlar</text>' +
            '<text x="82" y="72" class="p-yazi p-yazi--kucuk" opacity="0.5">Stok / Stok Yönetimi /</text>' +
            '<text x="152" y="72" class="p-yazi p-yazi--kucuk">Pişirme Önerileri</text>' +
            sekmeYazi +
            '<path d="M76 94 h324" class="p-cizgi"/>';
    }

    // ==================================================================
    // Pişirme listesi
    // ==================================================================

    /*
     * Dört dilim, dilim başına on beş ürün. Sahnede ilk beşi çiziliyor,
     * kalanı "kaydırınca geliyor" olarak anlatılıyor. Adetler örnek.
     */
    var URUNLER = [
        ['La Lorraine Sokak Simiti', 'simit.jpg', [44, 14, 6, 4]],
        ['Wasa Gevrek Ekmek',        'ekmek.jpg', [33, 21, 23, 11]],
        ['La Lorraine Taze Baget',   'baget.jpg', [9, 7, 5, 3]],
        ['Milfetti Rulo Börek',      'borek.jpg', [6, 6, 2, 1]],
        ['La Lorraine Kruvasan',     'simit.jpg', [2, 1, 1, 0]]
    ];

    var DILIMLER = ['08:00 - 12:00', '12:00 - 16:00', '16:00 - 20:00', '20:00 - 00:00'];

    /**
     * Tek bir dilim sütunu. `acikSira` verilirse o satır açılmış ve
     * altında rafta/donukta bilgisi görünüyor demektir.
     */
    function sutun(x, dilimSira, acikSira) {
        var aktif = dilimSira === 1;
        var cikti =
            '<rect x="' + x + '" y="102" width="76" height="22" rx="5" fill="' +
            (aktif ? '#5d3ebc' : '#fff') + '" stroke="' + (aktif ? '#5d3ebc' : '#e2e8f0') + '"/>' +
            '<text x="' + (x + 9) + '" y="116" class="p-yazi p-yazi--kucuk" fill="' +
            (aktif ? '#ffffff' : '#334155') + '" style="font-size:5px">' +
            DILIMLER[dilimSira] + '</text>';

        var yy = 130;
        for (var i = 0; i < URUNLER.length; i++) {
            var acik = i === acikSira;
            var boy = acik ? 44 : 26;
            cikti +=
                '<rect x="' + x + '" y="' + yy + '" width="76" height="' + boy +
                '" rx="5" fill="#fff" stroke="' + (acik ? '#c4b5fd' : '#eef2f7') + '"/>' +
                gorsel(x + 5, yy + 4, 9, URUNLER[i][1]) +
                '<text x="' + (x + 17) + '" y="' + (yy + 8) + '" class="p-yazi"' +
                ' style="font-size:3.8px">' + URUNLER[i][0] + '</text>' +
                '<path d="M' + (x + 69) + ' ' + (yy + 6) + ' l2.5 2.5 l-2.5 2.5"' +
                ' stroke="#94a3b8" stroke-width="1" fill="none" stroke-linecap="round"' +
                (acik ? ' transform="rotate(90 ' + (x + 70) + ' ' + (yy + 8.5) + ')"' : '') + '/>' +
                '<rect x="' + (x + 5) + '" y="' + (yy + 15) + '" width="26" height="8" rx="2" fill="#fef3c7"/>' +
                '<text x="' + (x + 8) + '" y="' + (yy + 21) + '" class="p-yazi" fill="#92400e"' +
                ' style="font-size:4px">' + URUNLER[i][2][dilimSira] + ' Pişir</text>' +
                (acik
                    ? '<path d="M' + (x + 4) + ' ' + (yy + 27) + ' h68" class="p-cizgi"/>' +
                      '<text x="' + (x + 6) + '" y="' + (yy + 35) + '" class="p-yazi"' +
                      ' style="font-size:3.8px" opacity="0.6">Rafta</text>' +
                      '<text x="' + (x + 24) + '" y="' + (yy + 35) + '" class="p-yazi"' +
                      ' style="font-size:3.8px" font-weight="700">2</text>' +
                      '<text x="' + (x + 36) + '" y="' + (yy + 35) + '" class="p-yazi"' +
                      ' style="font-size:3.8px" opacity="0.6">Donukta</text>' +
                      '<text x="' + (x + 62) + '" y="' + (yy + 35) + '" class="p-yazi"' +
                      ' style="font-size:3.8px" font-weight="700">56</text>' +
                      '<text x="' + (x + 6) + '" y="' + (yy + 41) + '" class="p-yazi"' +
                      ' style="font-size:3.4px" opacity="0.5">son güncelleme 12:04</text>'
                    : '');
            yy += boy + 4;
        }
        return cikti;
    }

    function liste(acikSira, dugme) {
        return '<svg viewBox="0 0 400 300">' + sekmeSeridi() + kabuk() +
            '<text x="82" y="112" class="p-yazi p-yazi--kalin" style="font-size:7px">Pişirme Önerileri</text>' +
            (dugme
                ? '<rect x="308" y="103" width="76" height="15" rx="4" fill="#1d4ed8"/>' +
                  '<circle cx="316" cy="110.5" r="2.6" fill="#fbbf24"/>' +
                  '<text x="322" y="113" class="p-yazi p-yazi--ak" style="font-size:5px">Pişirme Paneli</text>'
                : '') +
            '<g transform="translate(0,16)">' +
            sutun(80, 0, -1) + sutun(160, 1, acikSira) + sutun(240, 2, -1) + sutun(320, 3, -1) +
            '</g>' +
            '<text x="82" y="292" class="p-yazi" style="font-size:4px" opacity="0.5">' +
            '4 dilim · dilim başına 15 ürün · toplam 60 satır</text>' +
            '</svg>';
    }

    // ==================================================================
    // Jet Barkod karar kartları
    // ==================================================================

    /**
     * Karar kartı. Ne kadar, neden, rafta ve donukta ne var, hepsi bir
     * arada. Sağ üstteki şerit sonraki dilimleri gösteriyor; fazla
     * pişirmeyi asıl engelleyen kısım orası.
     */
    function kararKart(x, yy, ad, dosya, adet, sebep, rozet, rozetRenk, rozetZemin,
                       rafta, donukta, sonraki) {
        var s = '';
        for (var i = 0; i < sonraki.length; i++) {
            s += '<text x="' + (x + 118 + i * 22) + '" y="' + (yy + 14) + '" class="p-yazi"' +
                 ' style="font-size:4px" opacity="0.55">' + sonraki[i][0] + '</text>' +
                 '<text x="' + (x + 118 + i * 22) + '" y="' + (yy + 21) + '" class="p-yazi"' +
                 ' style="font-size:5.5px" font-weight="700" fill="' +
                 (sonraki[i][1] === '0' ? '#94a3b8' : '#0f172a') + '">' + sonraki[i][1] + '</text>';
        }

        return '<g>' +
            '<rect x="' + x + '" y="' + yy + '" width="188" height="56" rx="7" class="p-kart"/>' +
            gorsel(x + 8, yy + 8, 26, dosya) +
            '<text x="' + (x + 40) + '" y="' + (yy + 15) + '" class="p-yazi"' +
            ' style="font-size:5px;font-weight:700">' + ad + '</text>' +
            '<text x="' + (x + 40) + '" y="' + (yy + 24) + '" class="p-yazi"' +
            ' style="font-size:4.4px">' + adet + '</text>' +
            '<text x="' + (x + 40) + '" y="' + (yy + 32) + '" class="p-yazi"' +
            ' style="font-size:4px" opacity="0.6">' + sebep + '</text>' +
            '<rect x="' + (x + 8) + '" y="' + (yy + 38) + '" width="46" height="11" rx="3" fill="' +
            rozetZemin + '"/>' +
            '<text x="' + (x + 12) + '" y="' + (yy + 46) + '" class="p-yazi" fill="' + rozetRenk +
            '" style="font-size:4.4px;font-weight:700">' + rozet + '</text>' +
            '<text x="' + (x + 62) + '" y="' + (yy + 46) + '" class="p-yazi"' +
            ' style="font-size:4px" opacity="0.55">Rafta</text>' +
            '<text x="' + (x + 80) + '" y="' + (yy + 46) + '" class="p-yazi"' +
            ' style="font-size:5px;font-weight:700">' + rafta + '</text>' +
            '<text x="' + (x + 92) + '" y="' + (yy + 46) + '" class="p-yazi"' +
            ' style="font-size:4px" opacity="0.55">Donukta</text>' +
            '<text x="' + (x + 120) + '" y="' + (yy + 46) + '" class="p-yazi"' +
            ' style="font-size:5px;font-weight:700">' + donukta + '</text>' +
            '<path d="M' + (x + 112) + ' ' + (yy + 6) + ' v30" class="p-cizgi"/>' +
            '<text x="' + (x + 118) + '" y="' + (yy + 8) + '" class="p-yazi"' +
            ' style="font-size:3.6px" opacity="0.45">SONRAKİ DİLİMLER</text>' +
            s +
            '</g>';
    }

    function panelKabuk(icerik) {
        return '<svg viewBox="0 0 400 300">' + sekmeSeridi() + kabuk() +
            '<text x="82" y="112" class="p-yazi p-yazi--kalin" style="font-size:7px">Pişirme Önerileri</text>' +
            '<rect x="308" y="103" width="76" height="15" rx="4" fill="#1d4ed8"/>' +
            '<circle cx="316" cy="110.5" r="2.6" fill="#fbbf24"/>' +
            '<text x="322" y="113" class="p-yazi p-yazi--ak" style="font-size:5px">Pişirme Paneli</text>' +
            '<rect x="0" y="22" width="400" height="278" fill="rgb(15 23 42 / 0.45)"/>' +
            '<rect x="22" y="60" width="356" height="228" rx="9" fill="#f8fafc"/>' +
            '<rect x="22" y="60" width="356" height="26" rx="9" fill="#1d4ed8"/>' +
            '<rect x="22" y="76" width="356" height="10" fill="#1d4ed8"/>' +
            '<circle cx="38" cy="73" r="3.4" fill="#fbbf24"/>' +
            '<text x="46" y="76" class="p-yazi p-yazi--ak" style="font-size:6.5px;font-weight:700">' +
            'Pişirme Paneli</text>' +
            '<text x="300" y="76" class="p-yazi p-yazi--ak" style="font-size:4.6px" opacity="0.8">' +
            'Jet Barkod Asistan</text>' +
            icerik +
            '</svg>';
    }

    var PANEL_BOS = panelKabuk(
        '<rect x="34" y="96" width="188" height="56" rx="7" fill="#eef2f7"/>' +
        '<rect x="234" y="96" width="132" height="56" rx="7" fill="#eef2f7"/>' +
        '<rect x="34" y="160" width="188" height="56" rx="7" fill="#eef2f7"/>' +
        '<rect x="234" y="160" width="132" height="56" rx="7" fill="#eef2f7"/>' +
        '<text x="150" y="248" class="p-yazi p-yazi--kucuk" opacity="0.45">Dört dilim okunuyor…</text>');

    var PANEL_DOLU = panelKabuk(
        kararKart(34, 96, 'La Lorraine Kruvasan', 'simit.jpg', '1 adet pişirilecek',
                  'Rafta hiç kalmadı, hemen fırına girmeli', 'ACİL PİŞİR', '#b91c1c', '#fee2e2',
                  '0', '33', [['16-20', '1'], ['20-24', '0']]) +
        kararKart(34, 160, 'La Lorraine Sokak Simiti', 'simit.jpg', '6 adet pişirilecek',
                  'Akşam vardiyası için hazırlık gerekiyor', 'HAZIRLIK YAP', '#b45309', '#fef3c7',
                  '2', '56', [['16-20', '6'], ['20-24', '4']]) +
        kararKart(34, 224, 'Wasa Gevrek Ekmek', 'ekmek.jpg', '1 adet fazla',
                  'Hedefin üzerine çıkıldı, pişirmeye gerek yok', 'FAZLA', '#475569', '#f1f5f9',
                  '23', '0', [['16-20', '0'], ['20-24', '0']]) +

        /* Sağ sütun: israfın nasıl önlendiği */
        '<rect x="234" y="96" width="132" height="120" rx="7" fill="#ecfdf5" stroke="#a7f3d0"/>' +
        '<text x="244" y="110" class="p-yazi" fill="#047857"' +
        ' style="font-size:5.5px;font-weight:700">İsraf önlendi</text>' +
        '<text x="244" y="122" class="p-yazi" style="font-size:4.4px" fill="#065f46">' +
        'Sonraki dilimlerde talep düşük.</text>' +
        '<text x="244" y="131" class="p-yazi" style="font-size:4.4px" fill="#065f46">' +
        'Tahminle 12 pişirilecekti.</text>' +
        '<rect x="244" y="138" width="112" height="1" fill="#a7f3d0"/>' +
        '<text x="244" y="152" class="p-yazi" style="font-size:4.2px" opacity="0.7">Tahminle</text>' +
        '<text x="300" y="152" class="p-yazi" style="font-size:8px;font-weight:700" fill="#94a3b8">12</text>' +
        '<text x="244" y="168" class="p-yazi" style="font-size:4.2px" opacity="0.7">Panelle</text>' +
        '<text x="300" y="168" class="p-yazi" style="font-size:8px;font-weight:700" fill="#047857">7</text>' +
        '<rect x="244" y="176" width="112" height="14" rx="4" fill="#047857"/>' +
        '<text x="252" y="186" class="p-yazi p-yazi--ak" style="font-size:4.6px">' +
        '5 ürün çöpe gitmedi</text>' +
        '<text x="244" y="204" class="p-yazi" style="font-size:4px" opacity="0.6" fill="#065f46">' +
        'Gece 23.00 sonrası yalnız</text>' +
        '<text x="244" y="211" class="p-yazi" style="font-size:4px" opacity="0.6" fill="#065f46">' +
        'elde stoğu olanlar listelenir.</text>' +

        '<rect x="234" y="224" width="132" height="56" rx="7" fill="#fff" stroke="#e2e8f0"/>' +
        '<text x="244" y="238" class="p-yazi" style="font-size:4.6px;font-weight:700">Tek ekranda</text>' +
        '<text x="244" y="249" class="p-yazi" style="font-size:4.2px" opacity="0.7">' +
        '60 satır yerine 3 karar kartı</text>' +
        '<text x="244" y="259" class="p-yazi" style="font-size:4.2px" opacity="0.7">' +
        'Rafta ve donukta stok üstünde</text>' +
        '<text x="244" y="269" class="p-yazi" style="font-size:4.2px" opacity="0.7">' +
        'Dört dilim aynı anda</text>');

    // ==================================================================
    // Senaryo
    // ==================================================================

    function y(x, yy) { return [x / 4, yy / 3]; }

    global.JBSenaryoFirin = {
        baslik: 'Fırında ne pişecek, ne kadar pişecek',
        ozet: 'Aynı sayfa, aynı an. Soldaki satırları tek tek açıyor, sağdaki tek düğmeye basıyor.',
        vurgu: 'Asıl kazanç sürede değil: 12 yerine 7 pişiriliyor, 5 ürün çöpe gitmiyor.',

        sol: {
            ad: 'Eklentisiz depo',
            ekranlar: {
                liste: liste(-1, false),
                acik1: liste(0, false),
                acik2: liste(1, false),
                acik3: liste(3, false)
            },
            adimlar: [
                { ad: 'Pişirme Önerileri açıldı', sure: 700, ekran: 'liste',
                  imlec: y(130, 86), goz: y(130, 86), tik: true },
                { ad: 'Sayfa yükleniyor', sureAralik: [1800, 2800], ekran: 'liste',
                  yukleniyor: true, goz: y(240, 200) },
                { ad: 'İçinde bulunulan dilime bakıldı', sure: 1300, ekran: 'liste',
                  goz: y(198, 150), imlec: y(230, 150) },
                { ad: 'İlk ürünün satırı açıldı', sure: 900, ekran: 'acik1',
                  imlec: y(230, 155), goz: y(230, 155), tik: true },
                { ad: 'Rafta ve donuktaki stok okundu', sureAralik: [1400, 2000], ekran: 'acik1',
                  goz: y(198, 180) },
                { ad: 'İkinci ürünün satırı açıldı', sure: 900, ekran: 'acik2',
                  imlec: y(230, 185), goz: y(230, 185), tik: true },
                { ad: 'Stok tekrar okundu', sureAralik: [1400, 2000], ekran: 'acik2',
                  goz: y(198, 212) },
                { ad: 'Dördüncü ürüne geçildi', sure: 1000, ekran: 'acik3',
                  imlec: y(230, 248), goz: y(230, 248), tik: true },
                { ad: 'Stok bir kez daha okundu', sureAralik: [1400, 2000], ekran: 'acik3',
                  goz: y(198, 268) },
                { ad: 'Beşinci ürün açıldı', sure: 900, ekran: 'acik2',
                  imlec: y(230, 215), goz: y(230, 215), tik: true },
                { ad: 'Stok yine tek tek okundu', sureAralik: [1300, 1900], ekran: 'acik2',
                  goz: y(198, 240) },
                { ad: 'Aşağı kaydırıldı, kalan on satır duruyor', sure: 1500, ekran: 'liste',
                  goz: y(198, 250), imlec: y(236, 250) },
                { ad: 'Sonraki dilimlere bakılmadı', sure: 1400, ekran: 'liste',
                  goz: y(300, 150), imlec: null },
                { ad: 'Miktar tahminle belirlendi', sure: 1500, ekran: 'liste',
                  goz: y(198, 150) }
            ]
        },

        sag: {
            ad: 'Jet Barkod Asistan kurulu',
            ekranlar: {
                liste: liste(-1, true),
                panelBos: PANEL_BOS,
                panel: PANEL_DOLU
            },
            adimlar: [
                { ad: 'Pişirme Önerileri açıldı', sure: 700, ekran: 'liste',
                  imlec: y(130, 86), goz: y(130, 86), tik: true },
                { ad: 'Sayfa yükleniyor', sureAralik: [1800, 2800], ekran: 'liste',
                  yukleniyor: true, goz: y(240, 200) },
                { ad: 'Pişirme Paneli düğmesine basıldı', sure: 800, ekran: 'liste',
                  imlec: y(346, 111), goz: y(346, 111), tik: true },
                { ad: 'Dört dilim birden okunuyor', sure: 600, ekran: 'panelBos',
                  yukleniyor: true, goz: y(200, 170) },
                { ad: 'Karar kartları hazır', sure: 1100, ekran: 'panel',
                  goz: y(128, 150), imlec: null },
                { ad: 'Fazla pişirme daha başlamadan engellendi', sure: 1300, ekran: 'panel',
                  goz: y(300, 155) }
            ]
        }
    };
})(window);
