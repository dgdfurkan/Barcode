/**
 * Jet Barkod. Karşılaştırma senaryosu: fırında ne pişecek.
 * ============================================================================
 *
 * SAYFA GERÇEKTE NASIL (canlı panelin DOM'una bakılarak düzeltildi)
 * Dört zaman dilimi yan yana kart hâlinde. İçinde bulunulan dilimin kartı
 * mor başlıklı ve yanında alev simgesi var; sağ üstünde sıralama ve
 * kopyalama düğmeleri duruyor.
 *
 * Her ürün satırı BAŞTAN AÇIK geliyor. Yani "satırları tek tek açmak
 * gerekiyor" doğru değil; ilk yazımda öyle kurgulamıştım, yanlıştı.
 * Satırda ürünün küçük kare fotoğrafı, adı ve "N Pişir" rozeti var;
 * hemen altında DÖRT stok hücresi: Satılan, Rezerve, Donuk, Raf.
 *
 * ASIL ZORLUK BURADA
 * Bilgi eksik değil, fazla. On beş ürün çarpı dört dilim, altmış satır ve
 * satır başına dört sayı, yani iki yüz kırk rakam. Hiçbiri "ne yapayım"
 * sorusuna cevap vermiyor. Personel Raf'a mı baksın, Donuk'a mı, Satılan
 * eğilimine mi? Sonraki dilimleri okuyup toplayan da yok. Sonuçta gözle
 * tarayıp tahmin ediyor ve fazla pişiriyor.
 *
 * SAYFA YÜKLEME ADIMI YOK
 * İlk yazımda iki şeride de "sayfa yükleniyor" koymuştum. Personel zaten
 * panelin içinde; sekmeye geçmek tam sayfa yüklemesi değil. Kaldırıldı.
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

    /** Tek dilim kartı. Satırların hepsi açık, tıpkı gerçeğinde olduğu gibi. */
    function dilimKarti(x, dilimSira, adet) {
        var aktif = dilimSira === 1;
        var cikti =
            '<rect x="' + x + '" y="96" width="80" height="' + (28 + adet * 30) +
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
            '<text x="' + (x + 15) + '" y="' + 109 + '" class="p-yazi" style="font-size:5px" fill="' +
            (aktif ? '#ffffff' : '#334155') + '">' + DILIMLER[dilimSira] + '</text>' +
            '<rect x="' + (x + 60) + '" y="102" width="8" height="8" rx="2" fill="' +
            (aktif ? 'rgb(255 255 255 / 0.28)' : '#eef2f7') + '"/>' +
            '<rect x="' + (x + 70) + '" y="102" width="8" height="8" rx="2" fill="' +
            (aktif ? 'rgb(255 255 255 / 0.28)' : '#eef2f7') + '"/>';

        var yy = 122;
        for (var i = 0; i < adet; i++) {
            var u = URUNLER[i];
            cikti +=
                (i ? '<path d="M' + (x + 4) + ' ' + (yy - 3) + ' h72" class="p-cizgi"/>' : '') +
                gorsel(x + 4, yy, 9, u[1]) +
                '<text x="' + (x + 16) + '" y="' + (yy + 4) + '" class="p-yazi"' +
                ' style="font-size:3.4px">' + u[0].slice(0, 26) + '</text>' +
                '<rect x="' + (x + 16) + '" y="' + (yy + 6) + '" width="24" height="7" rx="2" fill="#fef3c7"/>' +
                '<text x="' + (x + 19) + '" y="' + (yy + 11.4) + '" class="p-yazi" fill="#92400e"' +
                ' style="font-size:3.8px">' + u[2][dilimSira] + ' Pişir</text>' +
                stokSatiri(x, yy + 20, u[3]);
            yy += 30;
        }
        return cikti;
    }

    function liste(dugme) {
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
            dilimKarti(70, 0, 5) + dilimKarti(154, 1, 5) +
            dilimKarti(238, 2, 5) + dilimKarti(322, 3, 5) +
            '</g>' +
            '<text x="70" y="296" class="p-yazi" style="font-size:3.8px" opacity="0.45">' +
            '4 dilim · dilim başına 15 ürün · satır başına 4 sayı · toplam 240 rakam</text>' +
            '</svg>';
    }

    // ==================================================================
    // Jet Barkod karar kartları
    // ==================================================================

    function kararKart(x, yy, ad, dosya, adet, sebep, rozet, renk, zemin, raf, donuk, sonraki) {
        var s = '';
        for (var i = 0; i < sonraki.length; i++) {
            s += '<text x="' + (x + 124 + i * 20) + '" y="' + (yy + 15) + '" class="p-yazi"' +
                 ' style="font-size:3.6px" opacity="0.5">' + sonraki[i][0] + '</text>' +
                 '<text x="' + (x + 124 + i * 20) + '" y="' + (yy + 23) + '" class="p-yazi"' +
                 ' style="font-size:6px;font-weight:700" fill="' +
                 (sonraki[i][1] === '0' ? '#cbd5e1' : '#0f172a') + '">' + sonraki[i][1] + '</text>';
        }
        return '<g>' +
            '<rect x="' + x + '" y="' + yy + '" width="180" height="54" rx="7"' +
            ' fill="#fff" stroke="#e8edf3"/>' +
            gorsel(x + 8, yy + 9, 26, dosya) +
            '<text x="' + (x + 40) + '" y="' + (yy + 16) + '" class="p-yazi"' +
            ' style="font-size:4.8px;font-weight:700">' + ad + '</text>' +
            '<text x="' + (x + 40) + '" y="' + (yy + 25) + '" class="p-yazi"' +
            ' style="font-size:4.4px">' + adet + '</text>' +
            '<text x="' + (x + 40) + '" y="' + (yy + 33) + '" class="p-yazi"' +
            ' style="font-size:3.8px" opacity="0.6">' + sebep + '</text>' +
            '<rect x="' + (x + 8) + '" y="' + (yy + 39) + '" width="44" height="10" rx="3" fill="' +
            zemin + '"/>' +
            '<text x="' + (x + 12) + '" y="' + (yy + 46) + '" class="p-yazi" fill="' + renk +
            '" style="font-size:4.2px;font-weight:700">' + rozet + '</text>' +
            '<text x="' + (x + 58) + '" y="' + (yy + 46) + '" class="p-yazi"' +
            ' style="font-size:3.8px" opacity="0.5">Raf</text>' +
            '<text x="' + (x + 71) + '" y="' + (yy + 46) + '" class="p-yazi"' +
            ' style="font-size:5px;font-weight:700">' + raf + '</text>' +
            '<text x="' + (x + 84) + '" y="' + (yy + 46) + '" class="p-yazi"' +
            ' style="font-size:3.8px" opacity="0.5">Donuk</text>' +
            '<text x="' + (x + 105) + '" y="' + (yy + 46) + '" class="p-yazi"' +
            ' style="font-size:5px;font-weight:700">' + donuk + '</text>' +
            '<path d="M' + (x + 118) + ' ' + (yy + 8) + ' v34" class="p-cizgi"/>' +
            '<text x="' + (x + 124) + '" y="' + (yy + 9) + '" class="p-yazi"' +
            ' style="font-size:3.2px" opacity="0.4">SONRAKİ DİLİMLER</text>' + s +
            '</g>';
    }

    function panelKabuk(icerik) {
        return '<svg viewBox="0 0 400 300">' + sekmeSeridi() + kabuk() +
            '<text x="76" y="104" class="p-yazi p-yazi--kalin" style="font-size:6.5px">' +
            'Pişirme Önerileri</text>' +
            '<rect x="306" y="96" width="80" height="15" rx="4" fill="#1d4ed8"/>' +
            '<circle cx="314" cy="103.5" r="2.6" fill="#fbbf24"/>' +
            '<text x="320" y="106" class="p-yazi p-yazi--ak" style="font-size:5px">Pişirme Paneli</text>' +
            '<rect x="0" y="22" width="400" height="278" fill="rgb(15 23 42 / 0.45)"/>' +
            '<rect x="18" y="52" width="364" height="238" rx="9" fill="#f7f9fc"/>' +
            '<path d="M18 61 a9 9 0 0 1 9 -9 h346 a9 9 0 0 1 9 9 v17 h-364 z" fill="#1d4ed8"/>' +
            '<circle cx="34" cy="66" r="3.4" fill="#fbbf24"/>' +
            '<text x="42" y="69" class="p-yazi p-yazi--ak" style="font-size:6.5px;font-weight:700">' +
            'Pişirme Paneli</text>' +
            '<text x="292" y="69" class="p-yazi p-yazi--ak" style="font-size:4.4px" opacity="0.8">' +
            'Jet Barkod Asistan</text>' + icerik + '</svg>';
    }

    var PANEL_BOS = panelKabuk(
        '<rect x="28" y="88" width="180" height="54" rx="7" fill="#eaeff5"/>' +
        '<rect x="28" y="150" width="180" height="54" rx="7" fill="#eaeff5"/>' +
        '<rect x="28" y="212" width="180" height="54" rx="7" fill="#eaeff5"/>' +
        '<rect x="218" y="88" width="146" height="178" rx="7" fill="#eaeff5"/>' +
        '<text x="150" y="282" class="p-yazi" style="font-size:4.4px" opacity="0.45">' +
        'Dört dilim ve stok değerleri okunuyor…</text>');

    var PANEL_DOLU = panelKabuk(
        kararKart(28, 88, 'La Lorraine Çikolatalı Kruvasan', 'f-cikolata.jpg',
                  '2 adet pişirilecek', 'Rafta 3 kaldı, donukta 56 var', 'ACİL PİŞİR',
                  '#b91c1c', '#fee2e2', '3', '56', [['16-20', '0'], ['20-24', '0']]) +
        kararKart(28, 150, 'La Lorraine Sokak Simiti', 'f-simit.jpg',
                  '15 adet pişirilecek', 'Satılan 15, rafta yalnız 8 var', 'HAZIRLIK YAP',
                  '#b45309', '#fef3c7', '8', '130', [['16-20', '6'], ['20-24', '4']]) +
        kararKart(28, 212, 'Ekmek (200 g)', 'f-ekmek.jpg',
                  'Pişirmeye gerek yok', 'Rafta 35 var, donukta hiç yok', 'FAZLA',
                  '#475569', '#f1f5f9', '35', '0', [['16-20', '24'], ['20-24', '12']]) +

        '<rect x="218" y="88" width="146" height="106" rx="7" fill="#ecfdf5" stroke="#a7f3d0"/>' +
        '<text x="228" y="102" class="p-yazi" fill="#047857"' +
        ' style="font-size:5.5px;font-weight:700">İsraf önlendi</text>' +
        '<text x="228" y="113" class="p-yazi" style="font-size:4.2px" fill="#065f46">' +
        'Çikolatalı kruvasan sonraki iki</text>' +
        '<text x="228" y="121" class="p-yazi" style="font-size:4.2px" fill="#065f46">' +
        'dilimde hiç istenmiyor.</text>' +
        '<rect x="228" y="127" width="126" height="1" fill="#a7f3d0"/>' +
        '<text x="228" y="142" class="p-yazi" style="font-size:4.2px" opacity="0.7">' +
        'Tahminle pişirilirdi</text>' +
        '<text x="330" y="144" class="p-yazi" style="font-size:9px;font-weight:700" fill="#94a3b8">6</text>' +
        '<text x="228" y="158" class="p-yazi" style="font-size:4.2px" opacity="0.7">' +
        'Panelin dediği</text>' +
        '<text x="330" y="160" class="p-yazi" style="font-size:9px;font-weight:700" fill="#047857">2</text>' +
        '<rect x="228" y="166" width="126" height="14" rx="4" fill="#047857"/>' +
        '<text x="238" y="176" class="p-yazi p-yazi--ak" style="font-size:4.6px">' +
        '4 kruvasan çöpe gitmedi</text>' +
        '<text x="228" y="189" class="p-yazi" style="font-size:3.6px" opacity="0.6" fill="#065f46">' +
        'Gece 23.00 sonrası yalnız elde stoğu olanlar listelenir.</text>' +

        '<rect x="218" y="202" width="146" height="64" rx="7" fill="#fff" stroke="#e8edf3"/>' +
        '<text x="228" y="216" class="p-yazi" style="font-size:4.6px;font-weight:700">' +
        'Panel neyi hesaplıyor</text>' +
        '<text x="228" y="228" class="p-yazi" style="font-size:4px" opacity="0.7">' +
        'Satılan eğilimi, rezerve, donuktaki</text>' +
        '<text x="228" y="236" class="p-yazi" style="font-size:4px" opacity="0.7">' +
        'stok ve raftaki mevcut, dört dilim</text>' +
        '<text x="228" y="244" class="p-yazi" style="font-size:4px" opacity="0.7">' +
        'birlikte okunuyor.</text>' +
        '<text x="228" y="258" class="p-yazi" style="font-size:4px" fill="#1d4ed8" font-weight="700">' +
        '240 rakam yerine 3 karar.</text>');

    // ==================================================================
    // Senaryo
    // ==================================================================

    function y(x, yy) { return [x / 4, yy / 3]; }

    global.JBSenaryoFirin = {
        baslik: 'Fırında ne pişecek, ne kadar pişecek',
        ozet: 'Sayfa ikisinde de açık ve satırlar zaten görünüyor. Sorun bilgiyi bulmak değil, karar vermek.',
        vurgu: 'Asıl kazanç sürede değil: 6 yerine 2 pişiriliyor, 4 kruvasan çöpe gitmiyor.',

        sol: {
            ad: 'Eklentisiz depo',
            ekranlar: { liste: liste(false) },
            adimlar: [
                { ad: 'Pişirme Önerileri sekmesine geçildi', sure: 700, ekran: 'liste',
                  imlec: y(124, 82), goz: y(124, 82), tik: true },
                { ad: 'İçinde bulunulan dilim okunmaya başlandı', sure: 1200, ekran: 'liste',
                  goz: y(194, 130), imlec: y(230, 130) },
                { ad: 'İlk ürünün dört sayısı karşılaştırıldı', sureAralik: [1500, 2200],
                  ekran: 'liste', goz: y(194, 160) },
                { ad: 'İkinci ürün: satılan 15, rafta 8', sureAralik: [1500, 2200],
                  ekran: 'liste', goz: y(194, 190) },
                { ad: 'Üçüncü ve dördüncü ürün okundu', sureAralik: [1800, 2600],
                  ekran: 'liste', goz: y(194, 240) },
                { ad: 'Sonraki dilime bakıldı', sureAralik: [1400, 2000], ekran: 'liste',
                  goz: y(278, 170), imlec: y(300, 170) },
                { ad: 'İki dilim kafada karşılaştırılmaya çalışıldı', sureAralik: [1600, 2400],
                  ekran: 'liste', goz: y(236, 200) },
                { ad: 'Kalan on bir ürün için aşağı kaydırıldı', sure: 1500, ekran: 'liste',
                  goz: y(194, 270), imlec: y(236, 270) },
                { ad: 'Dördüncü dilim hiç okunmadı', sure: 1200, ekran: 'liste',
                  goz: y(362, 170), imlec: null },
                { ad: 'Miktar tahminle belirlendi, fazla pişirildi', sure: 1600, ekran: 'liste',
                  goz: y(194, 150) }
            ]
        },

        sag: {
            ad: 'Jet Barkod Asistan kurulu',
            ekranlar: { liste: liste(true), panelBos: PANEL_BOS, panel: PANEL_DOLU },
            adimlar: [
                { ad: 'Pişirme Önerileri sekmesine geçildi', sure: 700, ekran: 'liste',
                  imlec: y(124, 82), goz: y(124, 82), tik: true },
                { ad: 'Pişirme Paneli düğmesine basıldı', sure: 800, ekran: 'liste',
                  imlec: y(346, 104), goz: y(346, 104), tik: true },
                { ad: 'Dört dilim ve stoklar birlikte okunuyor', sure: 700, ekran: 'panelBos',
                  yukleniyor: true, goz: y(200, 170) },
                { ad: 'Üç karar kartı hazır', sure: 1200, ekran: 'panel',
                  goz: y(118, 120), imlec: null },
                { ad: 'Sonraki dilimler kartın üstünde', sure: 1100, ekran: 'panel',
                  goz: y(154, 118) },
                { ad: 'Fazla pişirme daha başlamadan engellendi', sure: 1300, ekran: 'panel',
                  goz: y(291, 140) }
            ]
        }
    };
})(window);
