/**
 * Jet Barkod. Karşılaştırma senaryosu: fırında ne pişecek.
 * ============================================================================
 *
 * SAYFA GERÇEKTE NASIL (canlı panelin DOM'una bakılarak)
 * Dört zaman dilimi yan yana kart hâlinde. İçinde bulunulan dilimin kartı
 * mor başlıklı, yanında alev simgesi, sağ üstünde sıralama ve kopyalama
 * düğmeleri var.
 *
 * Ürün satırları KAPALI geliyor (`aria-expanded="false"`). Satırda yalnız
 * ürünün küçük fotoğrafı, adı ve "N Pişir" rozeti görünüyor. Satılan,
 * Rezerve, Donuk ve Raf değerlerini görmek için satıra tıklayıp açmak
 * gerekiyor. On beş ürün çarpı dört dilim, altmış satır.
 *
 * PİŞİRME PANELİ GERÇEKTE NASIL
 * Başlıkta saat, stok özeti ve ayarlar düğmeleri var. Kartlar aciliyete
 * göre sıralı geliyor: önce ACİL PİŞİR (kırmızı), sonra PİŞİRME GEREKLİ
 * (sarı), en sonda FAZLA (yeşil). Her kartta ürünün fotoğrafı, kaç adet
 * pişirileceği, sebebi, dört dilimin sayıları ve sağda MEVCUT ile DONUK
 * değerleri duruyor. İçinde bulunulan dilim yeşil ve kalın.
 *
 * VERİ
 * 12:00-16:00 sütunu ve stok değerleri gerçek panelden alınan biçimde.
 * Diğer üç dilimin sayıları örnek. Kişi, depo ya da sipariş bilgisi yok.
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
            '<text x="24" y="15" class="p-yazi p-yazi--kucuk">Depo Paneli</text>';
    }

    function kabuk() {
        var sekmeler = ['Siparişler', 'Harita', 'Pişirme Önerileri', 'İptal Siparişler'];
        var x = 86, sekmeYazi = '';
        for (var i = 0; i < sekmeler.length; i++) {
            var sec = sekmeler[i] === 'Pişirme Önerileri';
            sekmeYazi += '<text x="' + x + '" y="82" class="p-yazi" fill="' +
                         (sec ? '#5d3ebc' : '#64748b') + '" style="font-size:5px"' +
                         (sec ? ' font-weight="700"' : '') + '>' + sekmeler[i] + '</text>';
            if (sec) sekmeYazi += '<rect x="' + x + '" y="86" width="' + (sekmeler[i].length * 2.7) +
                                  '" height="1.6" fill="#5d3ebc"/>';
            x += sekmeler[i].length * 2.7 + 11;
        }
        return '<rect x="0" y="22" width="400" height="34" class="p-mor"/>' +
            '<text x="12" y="44" class="p-sari" style="font-size:11px;font-weight:800">getir</text>' +
            '<text x="42" y="37" class="p-yazi--ak" style="font-size:6px;font-weight:700">Depo Paneli</text>' +
            '<rect x="42" y="40" width="26" height="8" rx="3" fill="#0f7b4a"/>' +
            '<text x="46" y="46" class="p-yazi p-yazi--ak" style="font-size:4.2px">Müsait</text>' +
            '<text x="72" y="46" class="p-yazi p-yazi--ak" style="font-size:5px">Örnek Depo</text>' +
            '<circle cx="386" cy="39" r="6.5" fill="rgb(255 255 255 / 0.24)"/>' +
            '<rect x="0" y="56" width="400" height="244" fill="#fff"/>' +
            '<rect x="0" y="56" width="66" height="244" fill="#fff"/>' +
            '<path d="M66 56 v244" class="p-cizgi"/>' +
            '<text x="10" y="70" class="p-yazi" style="font-size:5px" opacity="0.6">Kontrol Paneli</text>' +
            '<text x="10" y="82" class="p-yazi" style="font-size:5px" fill="#5d3ebc" font-weight="700">Stok</text>' +
            '<text x="10" y="94" class="p-yazi" style="font-size:5px" opacity="0.6">Sık Kullanılanlar</text>' +
            '<text x="76" y="68" class="p-yazi" style="font-size:4.6px" opacity="0.5">' +
            'Stok / Stok Yönetimi / Pişirme Önerileri</text>' +
            sekmeYazi + '<path d="M70 90 h330" class="p-cizgi"/>';
    }

    // ==================================================================
    // Veri
    // ==================================================================

    /*
     * [ad, görsel, [dilim başına pişir], [Satılan, Rezerve, Donuk, Raf]]
     * 12:00-16:00 değerleri gerçek biçimde; diğer dilimler örnek.
     */
    var URUNLER = [
        ['Ekmek (200 g)',                'f-ekmek.jpg',    [35, 22, 24, 12], [20, 3, 0, 35]],
        ['La Lorraine Sokak Simiti',     'f-simit.jpg',    [46, 15, 6, 4],   [15, 5, 130, 8]],
        ['La Lorraine Taze Baget',       'f-baget.jpg',    [8, 7, 5, 3],     [1, 0, 102, 6]],
        ['La Lorraine Patatesli Börek',  'f-patates.jpg',  [6, 6, 2, 1],     [0, 2, 61, 4]],
        ['La Lorraine Ispanaklı Börek',  'f-ispanak.jpg',  [5, 4, 2, 1],     [5, 0, 128, 4]],
        ['La Lorraine Rustik Baget',     'f-rustik.jpg',   [3, 2, 1, 0],     [1, 1, 18, 1]],
        ['La Lorraine Tereyağlı Kruvasan','f-kruvasan.jpg',[2, 1, 1, 0],     [2, 0, 19, 1]],
        ['La Lorraine Çikolatalı Kruvasan','f-cikolata.jpg',[2, 1, 0, 0],    [0, 0, 56, 3]]
    ];

    var DILIMLER = ['08:00 - 12:00', '12:00 - 16:00', '16:00 - 20:00', '20:00 - 00:00'];

    /** Alev simgesi: içinde bulunulan dilimin başlığında duruyor. */
    var ALEV = '<path d="M0 0 c1.4 1.6 1 3 .2 3.9 c-.5.6-1.4.4-1.5-.4 c-.1-.9.5-1.4.3-2.6' +
               ' c-1.1 1-2 2.2-2 3.6 c0 1.9 1.5 3.3 3.3 3.3 s3.3-1.4 3.3-3.3 C3.6 2.6 1.8.9 0 0z"' +
               ' fill="#ffffff"/>';

    /** Dört stok hücresi: Satılan, Rezerve, Donuk, Raf. */
    function stokSatiri(x, yy, stok) {
        var etiketler = ['Satılan', 'Rezerve', 'Donuk', 'Raf'];
        var cikti = '';
        for (var i = 0; i < 4; i++) {
            var hx = x + 4 + i * 19;
            cikti += '<text x="' + hx + '" y="' + yy + '" class="p-yazi"' +
                     ' style="font-size:3.2px" opacity="0.5">' + etiketler[i] + '</text>' +
                     '<text x="' + hx + '" y="' + (yy + 6) + '" class="p-yazi"' +
                     ' style="font-size:5px;font-weight:700" fill="' +
                     (stok[i] === 0 ? '#cbd5e1' : '#0f172a') + '">' + stok[i] + '</text>';
        }
        return cikti;
    }

    /**
     * Tek dilim kartı. Satırlar varsayılan olarak KAPALI; `acikSira`
     * verilirse o satır açılır ve altında dört stok hücresi görünür.
     * Gerçeğinde de böyle: değerleri görmek için satıra tıklamak gerekiyor.
     */
    function dilimKarti(x, dilimSira, adet, acikSira) {
        var aktif = dilimSira === 1;
        var acikVar = acikSira >= 0 && acikSira < adet;
        var cikti =
            '<rect x="' + x + '" y="96" width="80" height="' + (26 + adet * 19 + (acikVar ? 16 : 0)) +
            '" rx="6" fill="#fff" stroke="' + (aktif ? '#5d3ebc' : '#e8edf3') + '"/>' +
            '<rect x="' + x + '" y="96" width="80" height="20" rx="6" fill="' +
            (aktif ? '#5d3ebc' : '#fafbfc') + '"/>' +
            '<rect x="' + x + '" y="110" width="80" height="6" fill="' +
            (aktif ? '#5d3ebc' : '#fafbfc') + '"/>' +
            (aktif
                ? '<g transform="translate(' + (x + 8) + ',103)">' + ALEV + '</g>'
                : '<circle cx="' + (x + 8) + '" cy="106" r="3.2" fill="none" stroke="#94a3b8"' +
                  ' stroke-width="0.9"/><path d="M' + (x + 8) + ' 104 v2.3 l1.6 1" stroke="#94a3b8"' +
                  ' stroke-width="0.9" fill="none" stroke-linecap="round"/>') +
            '<text x="' + (x + 15) + '" y="109" class="p-yazi" style="font-size:5px" fill="' +
            (aktif ? '#ffffff' : '#334155') + '">' + DILIMLER[dilimSira] + '</text>' +
            '<rect x="' + (x + 60) + '" y="102" width="8" height="8" rx="2" fill="' +
            (aktif ? 'rgb(255 255 255 / 0.28)' : '#eef2f7') + '"/>' +
            '<rect x="' + (x + 70) + '" y="102" width="8" height="8" rx="2" fill="' +
            (aktif ? 'rgb(255 255 255 / 0.28)' : '#eef2f7') + '"/>';

        var yy = 122;
        for (var i = 0; i < adet; i++) {
            var u = URUNLER[i];
            var acik = i === acikSira;
            cikti +=
                (i ? '<path d="M' + (x + 4) + ' ' + (yy - 3) + ' h72" class="p-cizgi"/>' : '') +
                gorsel(x + 4, yy, 9, u[1]) +
                '<text x="' + (x + 15) + '" y="' + (yy + 4) + '" class="p-yazi"' +
                ' style="font-size:3.2px">' + u[0].slice(0, 24) + '</text>' +
                '<rect x="' + (x + 15) + '" y="' + (yy + 6) + '" width="22" height="6.5" rx="2" fill="#fef3c7"/>' +
                '<text x="' + (x + 17.5) + '" y="' + (yy + 11) + '" class="p-yazi" fill="#92400e"' +
                ' style="font-size:3.6px">' + u[2][dilimSira] + ' Pişir</text>' +
                /* Kapalı satırda sağda sağa bakan ok, açık satırda aşağı bakan. */
                '<path d="M' + (x + 72) + ' ' + (yy + 4) + ' l2.4 2.4 l-2.4 2.4"' +
                ' stroke="#9ca3af" stroke-width="0.9" fill="none" stroke-linecap="round"' +
                (acik ? ' transform="rotate(90 ' + (x + 73.2) + ' ' + (yy + 6.4) + ')"' : '') + '/>';
            yy += 19;
            if (acik) {
                cikti += '<rect x="' + (x + 3) + '" y="' + (yy - 4) + '" width="74" height="15" rx="3"' +
                         ' fill="#f8fafc"/>' + stokSatiri(x, yy + 2, u[3]);
                yy += 16;
            }
        }
        return cikti;
    }

    function liste(dugme, acikSira) {
        return '<svg viewBox="0 0 400 300">' + sekmeSeridi() + kabuk() +
            '<text x="76" y="104" class="p-yazi p-yazi--kalin" style="font-size:6.5px">' +
            'Pişirme Önerileri</text>' +
            (dugme
                ? '<rect x="306" y="96" width="80" height="15" rx="4" fill="#1d4ed8"/>' +
                  '<circle cx="314" cy="103.5" r="2.6" fill="#fbbf24"/>' +
                  '<text x="320" y="106" class="p-yazi p-yazi--ak" style="font-size:5px">' +
                  'Pişirme Paneli</text>'
                : '<rect x="322" y="96" width="64" height="15" rx="4" fill="#fff" stroke="#5d3ebc"/>' +
                  '<text x="328" y="106" class="p-yazi" fill="#5d3ebc" style="font-size:4.4px">' +
                  'Pişirme Talimatları</text>') +
            '<g transform="translate(0,18)">' +
            dilimKarti(70, 0, 8, -1) +
            dilimKarti(154, 1, 8, acikSira === undefined ? -1 : acikSira) +
            dilimKarti(238, 2, 8, -1) + dilimKarti(322, 3, 8, -1) +
            '</g>' +
            '<text x="70" y="296" class="p-yazi" style="font-size:3.8px" opacity="0.45">' +
            '4 dilim · dilim başına 15 ürün · stok değerleri için her satıra ayrı tıklanır</text>' +
            '</svg>';
    }

    // ==================================================================
    // Pişirme paneli (gerçek eklentinin kendisi)
    // ==================================================================

    /*
     * [ad, görsel, rozet, adetYazi, sebep, mevcut, donuk, [4 dilim], durum]
     * Değerler canlı panelin ürettiği kartlardan.
     */
    var KARTLAR = [
        ['La Lorraine Peynirli Rulo Börek', 'f-peynirli.jpg', 'ACİL PİŞİR',
         '1 Adet Pişirilecek', 'Stok sıfır! Mevcut dilim hedefi: 1', 0, 178,
         [2, 1, 1, 0], 'acil'],
        ['La Lorraine Vanilya Kremalı Kruvasan', 'f-vanilya.jpg', 'ACİL PİŞİR',
         '1 Adet Pişirilecek', 'Stok sıfır! Mevcut dilim hedefi: 1', 0, 33,
         [1, 1, 1, 0], 'acil'],
        ['La Lorraine Sokak Simiti (90 g)', 'f-simit.jpg', 'PİŞİRME GEREKLİ',
         '7 Adet Pişirilecek', 'Stok eksik. (8/15)', 8, 130,
         [46, 15, 6, 4], 'gerekli'],
        ['Ekmek (200 g)', 'f-ekmek.jpg', 'FAZLA',
         '13 Adet Fazla', 'Hedef üzerinde fazla: mevcut 35, hedef 22.', 35, 0,
         [35, 22, 24, 12], 'fazla']
    ];

    var DURUM = {
        acil:    ['#ef4444', '#fef2f2', '#fee2e2', '#ef4444'],
        gerekli: ['#f59e0b', '#fffbeb', '#fef3c7', '#f59e0b'],
        fazla:   ['#0d9488', '#f0fdfa', '#ccfbf1', '#0d9488']
    };

    /** Tek pişirme kartı. Ölçüler gerçek karttaki oranlara göre. */
    function pisirmeKart(x, yy, k) {
        var d = DURUM[k[8]];
        var dilimYazi = '';
        for (var i = 0; i < 4; i++) {
            var simdi = i === 1;
            var dx = x + 46 + i * 32;
            dilimYazi +=
                '<text x="' + dx + '" y="' + (yy + 44) + '" class="p-yazi"' +
                ' style="font-size:5px;font-weight:700" fill="' +
                (simdi ? '#16a34a' : '#0f172a') + '">' + k[7][i] + '</text>' +
                '<text x="' + (dx - 6) + '" y="' + (yy + 50) + '" class="p-yazi"' +
                ' style="font-size:3.4px" fill="' + (simdi ? '#16a34a' : '#6b7280') + '">' +
                DILIMLER[i].replace(/ /g, '') + '</text>';
        }

        return '<g>' +
            '<rect x="' + x + '" y="' + yy + '" width="330" height="56" rx="6" fill="' +
            d[1] + '" stroke="' + d[0] + '" stroke-width="1.2"/>' +
            gorsel(x + 6, yy + 6, 26, k[1]) +
            '<text x="' + (x + 38) + '" y="' + (yy + 13) + '" class="p-yazi"' +
            ' style="font-size:5.2px;font-weight:700">' + k[0] + '</text>' +
            '<rect x="' + (x + 232) + '" y="' + (yy + 7) + '" width="' + (k[2].length * 2.9 + 8) +
            '" height="9" rx="4.5" fill="' + d[2] + '"/>' +
            '<text x="' + (x + 236) + '" y="' + (yy + 13.5) + '" class="p-yazi" fill="' + d[3] +
            '" style="font-size:3.8px;font-weight:700">' + k[2] + '</text>' +
            '<text x="' + (x + 38) + '" y="' + (yy + 25) + '" class="p-yazi"' +
            ' style="font-size:7.5px;font-weight:700" fill="#111827">' + k[3] + '</text>' +
            '<text x="' + (x + 38) + '" y="' + (yy + 33) + '" class="p-yazi"' +
            ' style="font-size:3.8px" fill="#4b5563">' + k[4] + '</text>' +
            '<path d="M' + (x + 38) + ' ' + (yy + 37) + ' h192" stroke="#e5e7eb" stroke-width="0.8"/>' +
            dilimYazi +
            '<path d="M' + (x + 278) + ' ' + (yy + 6) + ' v44" stroke="#e5e7eb" stroke-width="0.8"/>' +
            '<text x="' + (x + 292) + '" y="' + (yy + 16) + '" class="p-yazi"' +
            ' style="font-size:3.6px;font-weight:600" fill="#4b5563">MEVCUT</text>' +
            '<text x="' + (x + 300) + '" y="' + (yy + 26) + '" class="p-yazi"' +
            ' style="font-size:7px;font-weight:700">' + k[5] + '</text>' +
            '<text x="' + (x + 294) + '" y="' + (yy + 37) + '" class="p-yazi"' +
            ' style="font-size:3.6px;font-weight:600" fill="#4b5563">DONUK</text>' +
            '<text x="' + (x + 298) + '" y="' + (yy + 47) + '" class="p-yazi"' +
            ' style="font-size:7px;font-weight:700">' + k[6] + '</text>' +
            '</g>';
    }

    function panelKabuk(icerik) {
        return '<svg viewBox="0 0 400 300">' + sekmeSeridi() + kabuk() +
            '<text x="76" y="104" class="p-yazi p-yazi--kalin" style="font-size:6.5px">' +
            'Pişirme Önerileri</text>' +
            '<rect x="306" y="96" width="80" height="15" rx="4" fill="#1d4ed8"/>' +
            '<circle cx="314" cy="103.5" r="2.6" fill="#fbbf24"/>' +
            '<text x="320" y="106" class="p-yazi p-yazi--ak" style="font-size:5px">Pişirme Paneli</text>' +
            '<rect x="0" y="22" width="400" height="278" fill="rgb(15 23 42 / 0.5)"/>' +
            '<rect x="20" y="44" width="360" height="248" rx="8" fill="#fff"/>' +
            '<path d="M28 62 h344" stroke="#e5e7eb" stroke-width="0.9"/>' +
            '<text x="28" y="58" class="p-yazi" style="font-size:6.5px;font-weight:700">' +
            '🥐 Pişirme önerileri</text>' +
            '<text x="286" y="58" class="p-yazi" style="font-size:6px;font-weight:700">13:33</text>' +
            '<rect x="318" y="50" width="11" height="11" rx="3" fill="#f3f4f6"/>' +
            '<text x="320.5" y="58" style="font-size:6px">📋</text>' +
            '<rect x="333" y="50" width="11" height="11" rx="3" fill="#f3f4f6"/>' +
            '<text x="335.5" y="58" style="font-size:6px">⚙️</text>' +
            '<path d="M358 51 l8 8 M366 51 l-8 8" stroke="#9ca3af" stroke-width="1.2"' +
            ' stroke-linecap="round"/>' + icerik + '</svg>';
    }

    var PANEL_BOS = panelKabuk(
        '<rect x="30" y="70" width="330" height="56" rx="6" fill="#f3f4f6"/>' +
        '<rect x="30" y="130" width="330" height="56" rx="6" fill="#f3f4f6"/>' +
        '<rect x="30" y="190" width="330" height="56" rx="6" fill="#f3f4f6"/>' +
        '<text x="160" y="272" class="p-yazi" style="font-size:4.4px" opacity="0.45">' +
        'Dört dilim ve stoklar okunuyor…</text>');

    var PANEL_DOLU = panelKabuk(
        pisirmeKart(30, 70, KARTLAR[0]) +
        pisirmeKart(30, 130, KARTLAR[1]) +
        pisirmeKart(30, 190, KARTLAR[2]) +
        '<text x="30" y="262" class="p-yazi" style="font-size:4px" opacity="0.55">' +
        'Kartlar aciliyete göre sıralı: acil pişecekler üstte, fazla olanlar en altta.</text>' +
        '<text x="30" y="272" class="p-yazi" style="font-size:4px" opacity="0.55">' +
        'Aşağıda 4 kart daha var. Gece 23.00 sonrası yalnız elde stoğu olanlar listelenir.</text>');

    // ==================================================================
    // Senaryo
    // ==================================================================

    function y(x, yy) { return [x / 4, yy / 3]; }

    global.JBSenaryoFirin = {
        baslik: 'Fırında ne pişecek, ne kadar pişecek',
        ozet: 'Sayfa ikisinde de açık. Solda stok değerleri için her satıra ayrı tıklanıyor.',
        vurgu: '60 satırı tek tek açmak yerine, aciliyete göre sıralanmış karar kartları.',

        sol: {
            ad: 'Eklentisiz depo',
            ekranlar: {
                liste: liste(false, -1),
                acik0: liste(false, 0),
                acik1: liste(false, 1),
                acik2: liste(false, 2),
                acik5: liste(false, 5)
            },
            adimlar: [
                { ad: 'Pişirme Önerileri sekmesine geçildi', sure: 700, ekran: 'liste',
                  imlec: y(124, 82), goz: y(124, 82), tik: true },
                { ad: 'İçinde bulunulan dilim tarandı', sure: 1200, ekran: 'liste',
                  goz: y(194, 140), imlec: y(228, 140) },
                { ad: 'İlk satır açıldı', sure: 800, ekran: 'acik0',
                  imlec: y(228, 145), goz: y(228, 145), tik: true },
                { ad: 'Dört stok değeri okundu', sureAralik: [1300, 1900], ekran: 'acik0',
                  goz: y(194, 162) },
                { ad: 'İkinci satır açıldı', sure: 800, ekran: 'acik1',
                  imlec: y(228, 164), goz: y(228, 164), tik: true },
                { ad: 'Değerler tekrar okundu', sureAralik: [1300, 1900], ekran: 'acik1',
                  goz: y(194, 181) },
                { ad: 'Üçüncü satır açıldı', sure: 800, ekran: 'acik2',
                  imlec: y(228, 183), goz: y(228, 183), tik: true },
                { ad: 'Değerler bir kez daha okundu', sureAralik: [1300, 1900], ekran: 'acik2',
                  goz: y(194, 200) },
                { ad: 'Aşağıdaki satırlara geçildi', sure: 1100, ekran: 'acik5',
                  imlec: y(228, 240), goz: y(228, 240), tik: true },
                { ad: 'Kalan on bir satır için aynı tur gerekiyor', sureAralik: [1500, 2200],
                  ekran: 'acik5', goz: y(194, 258) },
                { ad: 'Sonraki dilimler için baştan başlanacak', sure: 1300, ekran: 'liste',
                  goz: y(278, 180), imlec: y(300, 180) },
                { ad: 'Miktar tahminle belirlendi', sure: 1400, ekran: 'liste',
                  goz: y(194, 150), imlec: null }
            ]
        },

        sag: {
            ad: 'Jet Barkod Asistan kurulu',
            ekranlar: { liste: liste(true, -1), panelBos: PANEL_BOS, panel: PANEL_DOLU },
            adimlar: [
                { ad: 'Pişirme Önerileri sekmesine geçildi', sure: 700, ekran: 'liste',
                  imlec: y(124, 82), goz: y(124, 82), tik: true },
                { ad: 'Pişirme Paneli düğmesine basıldı', sure: 800, ekran: 'liste',
                  imlec: y(346, 104), goz: y(346, 104), tik: true },
                { ad: 'Dört dilim ve stoklar birlikte okunuyor', sure: 700, ekran: 'panelBos',
                  yukleniyor: true, goz: y(200, 170) },
                { ad: 'Karar kartları aciliyete göre sıralı geldi', sure: 1200, ekran: 'panel',
                  goz: y(150, 96), imlec: null },
                { ad: 'Kaç adet ve neden, kartın üstünde yazıyor', sure: 1100, ekran: 'panel',
                  goz: y(120, 158) },
                { ad: 'Dört dilim ve MEVCUT / DONUK aynı kartta', sure: 1300, ekran: 'panel',
                  goz: y(300, 160) }
            ]
        }
    };
})(window);
