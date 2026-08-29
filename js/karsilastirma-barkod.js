/**
 * Jet Barkod. Karşılaştırma senaryosu: barkoda ulaşmak.
 * ============================================================================
 *
 * Başlangıç noktası iki tarafta da aynı: rafta okunmayan bir barkodla
 * karşılaşan personel bilgisayarın başına geliyor, kontrol panelinde aktif
 * sipariş açık. Kronometre, siparişe tıklandığı anda başlıyor.
 *
 * SOLDA yaşanan gerçek akış: ürün adını kopyala, raf etiketleri sistemini
 * aç, yüklenmesini bekle, ara, kampanyalı ürünlerin arasından doğru olanı
 * ayıkla, barkodu kopyala, yeni sekmede barkod üretecine yapıştır, oluştur.
 *
 * SAĞDA: tümünü kopyala, yan sekmeye geç, hepsi barkoduyla karşında.
 *
 * SÜRELER
 * Sabit değil. Sayfa yüklenmesi ve arama gibi adımlar `sureAralik` ile
 * veriliyor; her oynatmada o aralıktan rastgele seçiliyor. Gerçekte de
 * bu adımlar her seferinde aynı sürmüyor.
 *
 * VERİ TAMAMEN KURGUSAL
 * Buradaki depo adı, müşteri, toplayıcı, kurye, sipariş kimliği, ürün
 * kimliği ve lokasyon kodlarının hiçbiri gerçek değil. Ekranlar canlı
 * panele BAKILARAK çizildi ama içindeki hiçbir veri oradan alınmadı.
 * Depo herkese açık; buraya gerçek bir isim ya da kimlik yazılmaz.
 *
 * ÖLÇEK
 * Bütün sahneler 400x300 birimlik alanda çiziliyor. İmleç ve göz konumları
 * sahnenin yüzdesi olarak veriliyor, yani SVG birimini 4 ve 3'e bölerek.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ==================================================================
    // Ortak parçalar
    // ==================================================================

    /**
     * Getir depo panelinin üst şeridi. Canlı panele bakılarak çizildi:
     * sarı getir yazısı, Depo Paneli başlığı, yeşil "Müsait" rozeti ve
     * depo adı solda; gezinme ortada; arama, görünüm, bildirim ve profil
     * sağda. Altında kırıntı yolu ve alt sekmeler var.
     */
    function getirKabuk(altSekme) {
        var ust = ['Kontrol Paneli', 'Harita', 'Stok', 'Sık Kullanılanlar'];
        var x = 148;
        var ustYazi = '';
        for (var i = 0; i < ust.length; i++) {
            var aktif = ust[i] === 'Kontrol Paneli';
            ustYazi += '<text x="' + x + '" y="26" class="p-yazi p-yazi--kucuk" fill="' +
                       (aktif ? '#ffd300' : '#ffffff') + '"' + (aktif ? '' : ' opacity="0.8"') +
                       '>' + ust[i] + '</text>';
            if (aktif) ustYazi += '<rect x="' + x + '" y="30" width="' + (ust[i].length * 3.2) +
                                  '" height="1.6" class="p-sari"/>';
            x += ust[i].length * 3.2 + 12;
        }

        var alt = ['Siparişler', 'Harita', 'Pişirme Önerileri', 'İptal Siparişler',
                   'İade Siparişler', 'Eksik Ürünlü Siparişler'];
        var ax = 14;
        var altYazi = '';
        for (var j = 0; j < alt.length; j++) {
            var sec = alt[j] === altSekme;
            altYazi += '<text x="' + ax + '" y="70" class="p-yazi p-yazi--kucuk" fill="' +
                       (sec ? '#5d3ebc' : '#64748b') + '"' + (sec ? ' font-weight="700"' : '') +
                       '>' + alt[j] + '</text>';
            if (sec) altYazi += '<rect x="' + ax + '" y="74" width="' + (alt[j].length * 3.1) +
                                '" height="1.6" fill="#5d3ebc"/>';
            ax += alt[j].length * 3.1 + 12;
        }

        return '<rect x="0" y="0" width="400" height="38" class="p-mor"/>' +
            '<text x="14" y="24" class="p-sari" style="font-size:12px;font-weight:800">getir</text>' +
            '<text x="46" y="16" class="p-yazi--ak" style="font-size:7px;font-weight:700">Depo Paneli</text>' +
            '<rect x="46" y="20" width="30" height="9" rx="3" fill="#0f7b4a"/>' +
            '<text x="51" y="27" class="p-yazi p-yazi--kucuk p-yazi--ak" style="font-size:5px">Müsait</text>' +
            '<text x="80" y="27" class="p-yazi p-yazi--kucuk p-yazi--ak" style="font-size:6px">Örnek Depo</text>' +
            ustYazi +
            '<rect x="332" y="12" width="16" height="15" rx="5" fill="rgb(255 255 255 / 0.16)"/>' +
            '<rect x="352" y="12" width="22" height="15" rx="4" fill="rgb(255 255 255 / 0.16)"/>' +
            '<circle cx="386" cy="19" r="7" fill="rgb(255 255 255 / 0.24)"/>' +
            '<text x="383.5" y="22" class="p-yazi p-yazi--ak" style="font-size:6px">F</text>' +
            '<rect x="0" y="38" width="400" height="262" fill="#fff"/>' +
            '<text x="14" y="50" class="p-yazi p-yazi--kucuk" opacity="0.55">Kontrol Paneli</text>' +
            altYazi +
            '<path d="M0 78 h400" class="p-cizgi"/>' +
            '<rect x="0" y="78" width="400" height="222" class="p-zemin"/>';
    }

    /** Tarayıcı sekme şeridi. Hangi sekmenin önde olduğunu gösterir. */
    function sekmeSeridi(sekmeler, aktifSira) {
        var cikti = '<rect x="0" y="0" width="400" height="22" fill="#dfe3e8"/>';
        var x = 6;
        for (var i = 0; i < sekmeler.length; i++) {
            var g = sekmeler[i].length * 3.1 + 26;
            var onde = i === aktifSira;
            cikti += '<path d="M' + x + ' 22 v-13 a4 4 0 0 1 4 -4 h' + (g - 8) +
                     ' a4 4 0 0 1 4 4 v13 z" fill="' + (onde ? '#ffffff' : '#eef1f4') + '"/>' +
                     '<circle cx="' + (x + 11) + '" cy="12.5" r="3.2" fill="' +
                     (onde ? '#5d3ebc' : '#b9c2cc') + '"/>' +
                     '<text x="' + (x + 18) + '" y="15" class="p-yazi p-yazi--kucuk"' +
                     (onde ? '' : ' opacity="0.6"') + '>' + sekmeler[i] + '</text>';
            x += g + 4;
        }
        return cikti;
    }

    /**
     * Sipariş kartı. Canlı panelde üstte geçen süre ve kırmızı bir çubuk,
     * altında sipariş kodu, müşteri, kurye ve toplayıcı satırları, sağ
     * altta da lokasyon rozeti duruyor.
     */
    function siparisKart(x, y, sure, kod, musteri, toplayici, lokasyon, secili) {
        var satir = function (sy, im, metin) {
            return '<rect x="' + (x + 9) + '" y="' + (sy - 5) + '" width="6" height="6" rx="1.5" fill="#c7cdd6"/>' +
                   '<text x="' + (x + 19) + '" y="' + sy + '" class="p-yazi p-yazi--kucuk">' + metin + '</text>';
        };
        return '<g>' +
            '<rect x="' + x + '" y="' + y + '" width="104" height="86" rx="6" class="p-kart"' +
            (secili ? ' stroke="#5d3ebc" stroke-width="1.6"' : '') + '/>' +
            '<text x="' + (x + 34) + '" y="' + (y + 13) + '" class="p-yazi p-yazi--kucuk">' + sure + '</text>' +
            '<rect x="' + (x + 8) + '" y="' + (y + 17) + '" width="88" height="1.8" rx="1" fill="#e11d48"/>' +
            satir(y + 32, 1, kod) +
            satir(y + 45, 2, musteri) +
            satir(y + 58, 3, '-') +
            satir(y + 71, 4, toplayici) +
            '<rect x="' + (x + 60) + '" y="' + (y + 76) + '" width="38" height="9" rx="2" fill="#f1f5f9"/>' +
            '<text x="' + (x + 64) + '" y="' + (y + 83) + '" class="p-yazi p-yazi--kucuk" style="font-size:5px">' +
            lokasyon + '</text>' +
            '</g>';
    }

    /** Kanban sütunu başlığı. */
    function sutunBas(x, ad, sayi) {
        return '<text x="' + x + '" y="94" class="p-yazi p-yazi--kucuk" opacity="0.75">' + ad + '</text>' +
               '<rect x="' + x + '" y="100" width="16" height="12" rx="3" fill="#fff" stroke="#e2e8f0"/>' +
               '<text x="' + (x + 6) + '" y="109" class="p-yazi p-yazi--kucuk">' + sayi + '</text>' +
               '<path d="M' + (x + 112) + ' 88 v190" class="p-cizgi"/>';
    }

    /**
     * Ürün görseli. Adresler `assets/tanitim/` altında yerelde duruyor;
     * dış bir CDN'e bağlanmıyoruz. Görseller ürün kataloğundan alınıp
     * 140 piksele küçültüldü.
     */
    function gorsel(x, yy, boyut, dosya) {
        return '<image href="../assets/tanitim/' + dosya + '" x="' + x + '" y="' + yy +
               '" width="' + boyut + '" height="' + boyut +
               '" preserveAspectRatio="xMidYMid slice"' +
               ' style="clip-path: inset(0 round 2px)"/>';
    }

    /*
     * Sahnelerde geçen ürünler. Adlar ve barkodlar gerçek ürün
     * kataloğundan; kişi, depo ya da sipariş bilgisi DEĞİL.
     */
    var URUNLER = {
        sut:      ['Sütaş Yarım Yağlı Süt (4 x 1 L)', '8690767714887', 'sut.jpg'],
        sos:      ['Calve Barbekü Sos (290 g)', '8690637805219', 'sos.jpg'],
        su:       ['Erikli Doğal Kaynak Suyu (500 ml)', '8690793010052', 'su.jpg'],
        un:       ['Bağdat Galeta Unu (250 g)', '8690560011077', 'un.jpg'],
        maydanoz: ['Maydanoz Paket (1 Adet)', '8680422241643', 'maydanoz.jpg'],
        sogan:    ['Kuru Soğan (1 kg)', '8697458342084', 'sogan.jpg'],
        simit:    ['La Lorraine Sokak Simiti (90 g)', '8681573033125', 'simit.jpg'],
        dondurma: ['Algida Nogger Sandwich (145 ml)', '8690637117121', 'dondurma.jpg'],
        kaymak:   ['Sütaş Kaymaksız Yoğurt (600 g)', '8690767671104', 'kaymak.jpg'],
        folyo:    ['Cook Alüminyum Folyo (10 M)', '8690709040005', 'folyo.jpg'],
        yogurt:   ['Activia Probiyotik Sade Yoğurt (4 x 100 g)', '8696368011332', 'yogurt.jpg'],
        yogurt2:  ['Activia Probiyotik Çilekli Yoğurt (4 x 100 g)', '8696368011349', 'yogurt2.jpg']
    };

    /** Barkod çizgileri. */
    function barkod(x, y, g, y2, renk) {
        var cikti = '';
        var enler = [2, 1, 2.6, 1, 1.8, 2.6, 1, 2, 1.2, 2.4, 1, 1.8, 2.6, 1, 2, 1.4, 2.2, 1, 1.6, 2.8];
        var kx = x;
        var i = 0;
        while (kx < x + g - 3) {
            cikti += '<rect x="' + kx.toFixed(1) + '" y="' + y + '" width="' + enler[i % enler.length] +
                     '" height="' + y2 + '" fill="' + (renk || '#0f172a') + '"/>';
            kx += enler[i % enler.length] + 1.6;
            i++;
        }
        return cikti;
    }

    /** Ürün satırı (sipariş detayı tablosu). */
    function urunSatiri(y, ad, adet, kopyalaDugmesi) {
        return '<g>' +
            '<text x="46" y="' + (y + 7) + '" class="p-yazi p-yazi--kucuk">' + ad + '</text>' +
            '<text x="286" y="' + (y + 7) + '" class="p-yazi p-yazi--kucuk">' + adet + '</text>' +
            (kopyalaDugmesi
                ? '<rect x="306" y="' + y + '" width="34" height="10" rx="3" fill="#f1f5f9" stroke="#e2e8f0"/>' +
                  '<text x="311" y="' + (y + 7) + '" class="p-yazi p-yazi--kucuk" opacity="0.8">kopyala</text>'
                : '') +
            '<path d="M40 ' + (y + 12) + ' h320" class="p-cizgi"/>' +
            '</g>';
    }

    // ==================================================================
    // Ekranlar: ortak
    // ==================================================================

    var EKRAN_PANEL =
        '<svg viewBox="0 0 400 300">' +
        sekmeSeridi(['Depo Paneli'], 0) +
        '<g transform="translate(0,22)">' +
        getirKabuk('Siparişler') +
        sutunBas(14, 'Toplayıcı Bekliyor', 0) +
        sutunBas(140, 'Hazırlandı', 4) +
        sutunBas(266, 'Yolda / Ulaştı', 3) +
        siparisKart(140, 120, '00:04:52', 'c7d4', 'S. Kaya', 'A. Demir', 'DP.101', true) +
        siparisKart(140, 214, '00:04:00', '4cdb', 'E. Şahin', 'A. Demir', 'DP.114', false) +
        siparisKart(266, 120, '00:02:18', '82c9', 'M. Aydın', 'A. Demir', 'DP.126', false) +
        '</g>' +
        '</svg>';

    /**
     * Sipariş detayı penceresi. Canlı panelde bilgi alanı üç sütun, ürün
     * tablosu ise İKİ sütun hâlinde yan yana; ürünlerin küçük fotoğrafı
     * var. Buradaki kareler o fotoğrafların yerini tutuyor.
     */
    function ekranSiparisDetay(tumunuKopyala, seciliUrun) {
        var sira = ['sogan', 'maydanoz', 'su', 'sos', 'simit',
                    'dondurma', 'kaymak', 'un', 'folyo', 'sut'];
        var adetler = [1, 1, 2, 1, 3, 2, 1, 1, 1, 1];

        var tablo = '';
        for (var i = 0; i < sira.length; i++) {
            var u = URUNLER[sira[i]];
            var solda = i % 2 === 0;
            var satirNo = Math.floor(i / 2);
            var x = solda ? 44 : 214;
            var yy = 168 + satirNo * 20;
            var sonUrun = i === sira.length - 1;
            tablo +=
                gorsel(x, yy - 9, 12, u[2]) +
                (sonUrun && seciliUrun
                    ? '<rect x="' + (x + 16) + '" y="' + (yy - 8) + '" width="104" height="11" rx="2" fill="#bfdbfe"/>'
                    : '') +
                '<text x="' + (x + 18) + '" y="' + yy + '" class="p-yazi p-yazi--kucuk"' +
                ' style="font-size:4.6px">' + u[0] + '</text>' +
                '<text x="' + (x + 130) + '" y="' + yy + '" class="p-yazi p-yazi--kucuk">' +
                adetler[i] + '</text>' +
                '<path d="M' + x + ' ' + (yy + 5) + ' h150" class="p-cizgi"/>';
        }

        return '<svg viewBox="0 0 400 300">' +
            sekmeSeridi(['Depo Paneli'], 0) +
            '<g transform="translate(0,22)">' + getirKabuk('Siparişler') + '</g>' +
            '<rect x="0" y="22" width="400" height="278" fill="rgb(15 23 42 / 0.4)"/>' +
            '<rect x="24" y="46" width="352" height="234" rx="8" fill="#fff"/>' +
            '<text x="38" y="66" class="p-yazi p-yazi--kalin">Sipariş Detayları</text>' +
            '<rect x="104" y="57" width="86" height="12" rx="3" fill="#f1f5f9"/>' +
            '<text x="108" y="66" class="p-yazi p-yazi--kucuk" style="font-size:5px">0000000000000000000000aa</text>' +
            '<path d="M358 60 l8 8 M366 60 l-8 8" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/>' +

            '<text x="38" y="88" class="p-yazi p-yazi--kucuk" opacity="0.55">Müşteri Adı:</text>' +
            '<text x="82" y="88" class="p-yazi p-yazi--kucuk">S. Kaya</text>' +
            '<text x="38" y="102" class="p-yazi p-yazi--kucuk" opacity="0.55">Durum:</text>' +
            '<text x="72" y="102" class="p-yazi p-yazi--kucuk">Hazırlandı</text>' +
            '<text x="38" y="116" class="p-yazi p-yazi--kucuk" opacity="0.55">Kurye Adı:</text>' +
            '<text x="78" y="116" class="p-yazi p-yazi--kucuk">-</text>' +

            '<text x="160" y="88" class="p-yazi p-yazi--kucuk" opacity="0.55">Teslimat Adresi:</text>' +
            '<text x="160" y="98" class="p-yazi p-yazi--kucuk" style="font-size:5px">Örnek Mah. Örnek Cad. No: 1</text>' +
            '<text x="160" y="116" class="p-yazi p-yazi--kucuk" opacity="0.55">Lokasyonlar:</text>' +
            '<rect x="206" y="108" width="34" height="11" rx="3" fill="#f1f5f9"/>' +
            '<text x="210" y="116" class="p-yazi p-yazi--kucuk" style="font-size:5px">13 DP.101</text>' +

            '<text x="266" y="88" class="p-yazi p-yazi--kucuk" opacity="0.55">Toplayıcı Adı:</text>' +
            '<text x="266" y="98" class="p-yazi p-yazi--kucuk">A. Demir</text>' +
            '<text x="266" y="116" class="p-yazi p-yazi--kucuk" opacity="0.55">Adet:</text>' +
            '<text x="290" y="116" class="p-yazi p-yazi--kucuk">13</text>' +

            (tumunuKopyala
                ? '<rect x="252" y="126" width="72" height="15" rx="4" fill="#e8f4f8" stroke="#4a90e2"/>' +
                  '<text x="258" y="136" class="p-yazi p-yazi--kucuk" fill="#2563eb">Tümünü Kopyala</text>'
                : '') +
            '<rect x="330" y="126" width="34" height="15" rx="4" class="p-mor"/>' +
            '<text x="334" y="136" class="p-yazi p-yazi--kucuk p-yazi--ak" style="font-size:5px">Şüpheli Bildir</text>' +

            '<path d="M38 150 h324" class="p-cizgi"/>' +
            '<text x="44" y="160" class="p-yazi p-yazi--kucuk" opacity="0.55">Ürün Adı</text>' +
            '<text x="174" y="160" class="p-yazi p-yazi--kucuk" opacity="0.55">Adet</text>' +
            '<text x="214" y="160" class="p-yazi p-yazi--kucuk" opacity="0.55">Ürün Adı</text>' +
            '<text x="344" y="160" class="p-yazi p-yazi--kucuk" opacity="0.55">Adet</text>' +
            tablo +
            '</svg>';
    }

    /** Ürün adı seçili hâli: kopyalama anı. */
    var EKRAN_SECILI = ekranSiparisDetay(false, true);

    /**
     * Raf Etiketi sayfası. Canlı panele bakılarak çizildi: solda açılan
     * Stok ağacı, üstte kırıntı yolu, Filtreler paneli (Depo, Ürünler,
     * Raf, Temizle, Uygula) ve altında Barkodlar / Ürün Görseli / Ürün ID /
     * Ürün Adı / Raf sütunlu tablo.
     */
    function rafKabuk(urunAlani) {
        var yan = ['Kontrol Paneli', 'Harita', 'Stok', 'Sık Kullanılanlar', 'Favoriler'];
        var yanYazi = '';
        for (var i = 0; i < yan.length; i++) {
            var aktif = yan[i] === 'Stok';
            yanYazi += '<text x="14" y="' + (78 + i * 17) + '" class="p-yazi p-yazi--kucuk" fill="' +
                       (aktif ? '#5d3ebc' : '#334155') + '"' + (aktif ? ' font-weight="700"' : '') +
                       '>' + yan[i] + '</text>';
        }

        return '<rect x="0" y="22" width="400" height="38" class="p-mor"/>' +
            '<text x="14" y="46" class="p-sari" style="font-size:12px;font-weight:800">getir</text>' +
            '<text x="46" y="38" class="p-yazi--ak" style="font-size:6.5px;font-weight:700">Depo Paneli</text>' +
            '<rect x="46" y="42" width="28" height="8" rx="3" fill="#0f7b4a"/>' +
            '<text x="50" y="48" class="p-yazi p-yazi--ak" style="font-size:4.5px">Müsait</text>' +
            '<text x="78" y="48" class="p-yazi p-yazi--ak" style="font-size:5.5px">Örnek Depo</text>' +
            '<circle cx="386" cy="41" r="7" fill="rgb(255 255 255 / 0.24)"/>' +
            '<rect x="0" y="60" width="400" height="240" fill="#fff"/>' +

            /* Sol menü */
            '<rect x="0" y="60" width="72" height="240" fill="#fff"/>' +
            '<path d="M72 60 v240" class="p-cizgi"/>' +
            '<rect x="8" y="66" width="56" height="10" rx="3" fill="#f1f5f9"/>' +
            '<text x="13" y="73" class="p-yazi p-yazi--kucuk" opacity="0.45" style="font-size:5px">Arama</text>' +
            yanYazi +

            /* Kırıntı yolu */
            '<text x="82" y="72" class="p-yazi p-yazi--kucuk" opacity="0.5">Stok / Stok Yönetimi /</text>' +
            '<text x="152" y="72" class="p-yazi p-yazi--kucuk">Raf Etiketi</text>' +

            /* Kart */
            '<rect x="80" y="80" width="312" height="212" rx="6" class="p-kart"/>' +
            '<text x="90" y="96" class="p-yazi p-yazi--kalin">Raf Etiketi</text>' +
            '<rect x="336" y="87" width="46" height="13" rx="4" fill="#fff" stroke="#5d3ebc"/>' +
            '<text x="343" y="96" class="p-yazi p-yazi--kucuk" fill="#5d3ebc" style="font-size:5px">Import CSV</text>' +

            /* Filtreler */
            '<rect x="88" y="104" width="296" height="52" rx="5" fill="#fafbfc" stroke="#eef2f7"/>' +
            '<text x="96" y="116" class="p-yazi p-yazi--kucuk">Filtreler</text>' +
            '<rect x="96" y="120" width="86" height="14" rx="4" fill="#f1f5f9" stroke="#e2e8f0"/>' +
            '<text x="101" y="130" class="p-yazi p-yazi--kucuk" opacity="0.45">Örnek Depo</text>' +
            urunAlani +
            '<rect x="282" y="120" width="94" height="14" rx="4" fill="#fff" stroke="#e2e8f0"/>' +
            '<text x="287" y="130" class="p-yazi p-yazi--kucuk" opacity="0.45">Raf</text>' +
            '<rect x="96" y="138" width="10" height="10" rx="3" fill="#fff" stroke="#e2e8f0"/>' +
            '<text x="99" y="146" class="p-yazi p-yazi--kucuk">+</text>' +
            '<rect x="110" y="138" width="72" height="11" rx="4" fill="#fff" stroke="#e2e8f0"/>' +
            '<text x="115" y="146" class="p-yazi p-yazi--kucuk" opacity="0.45" style="font-size:5px">Kayıtlı aramalar</text>' +
            '<rect x="298" y="137" width="34" height="13" rx="4" fill="#fff" stroke="#e2e8f0"/>' +
            '<text x="305" y="146" class="p-yazi p-yazi--kucuk">Temizle</text>' +
            '<rect x="338" y="137" width="38" height="13" rx="4" class="p-mor"/>' +
            '<text x="348" y="146" class="p-yazi p-yazi--kucuk p-yazi--ak">Uygula</text>';
    }

    /** Tablo başlığı ve satırları. */
    function rafTablo(satirlar, vurguSira) {
        var cikti =
            '<text x="94" y="172" class="p-yazi p-yazi--kucuk" opacity="0.6">Barkodlar</text>' +
            '<text x="152" y="172" class="p-yazi p-yazi--kucuk" opacity="0.6">Görsel</text>' +
            '<text x="188" y="172" class="p-yazi p-yazi--kucuk" opacity="0.6">Ürün ID</text>' +
            '<text x="256" y="172" class="p-yazi p-yazi--kucuk" opacity="0.6">Ürün Adı</text>' +
            '<text x="366" y="172" class="p-yazi p-yazi--kucuk" opacity="0.6">Raf</text>' +
            '<path d="M88 176 h296" class="p-cizgi"/>';

        for (var i = 0; i < satirlar.length; i++) {
            var yy = 190 + i * 20;
            var vurgu = i === vurguSira;
            cikti +=
                (vurgu ? '<rect x="88" y="' + (yy - 11) + '" width="296" height="18" fill="#ecfdf5"/>' : '') +
                '<rect x="92" y="' + (yy - 8) + '" width="54" height="11" rx="3" fill="#f5f3ff" stroke="' +
                (vurgu ? '#059669' : '#c4b5fd') + '"/>' +
                '<text x="96" y="' + yy + '" class="p-yazi p-yazi--kucuk" fill="' +
                (vurgu ? '#047857' : '#6d28d9') + '" style="font-size:5px">' + satirlar[i][0] + '</text>' +
                gorsel(154, yy - 9, 12, satirlar[i][2]) +
                '<rect x="186" y="' + (yy - 8) + '" width="62" height="11" rx="3" fill="#f8fafc" stroke="#eef2f7"/>' +
                '<text x="189" y="' + yy + '" class="p-yazi p-yazi--kucuk" opacity="0.7" style="font-size:4.5px">' +
                satirlar[i][3] + '</text>' +
                '<rect x="254" y="' + (yy - 8) + '" width="104" height="11" rx="3" fill="#f8fafc" stroke="#eef2f7"/>' +
                '<text x="257" y="' + yy + '" class="p-yazi p-yazi--kucuk" style="font-size:4.5px">' +
                satirlar[i][1] + '</text>' +
                '<text x="368" y="' + yy + '" class="p-yazi p-yazi--kucuk" opacity="0.5">-</text>';
        }
        return cikti;
    }

    var RAF_VARSAYILAN = [
        [URUNLER.yogurt[1],   URUNLER.yogurt[0],   URUNLER.yogurt[2],   '0000aa11bb22cc33'],
        [URUNLER.yogurt2[1],  URUNLER.yogurt2[0],  URUNLER.yogurt2[2],  '0000aa11bb22cc34'],
        [URUNLER.folyo[1],    URUNLER.folyo[0],    URUNLER.folyo[2],    '0000aa11bb22cc35'],
        [URUNLER.su[1],       URUNLER.su[0],       URUNLER.su[2],       '0000aa11bb22cc36'],
        [URUNLER.sos[1],      URUNLER.sos[0],      URUNLER.sos[2],      '0000aa11bb22cc37']
    ];

    var URUN_BOS =
        '<rect x="188" y="120" width="88" height="14" rx="4" fill="#fff" stroke="#e2e8f0"/>' +
        '<text x="193" y="130" class="p-yazi p-yazi--kucuk" opacity="0.45">Ürünler</text>';

    var URUN_YAZILDI =
        '<rect x="188" y="120" width="88" height="14" rx="4" fill="#fff" stroke="#5d3ebc"/>' +
        '<text x="193" y="130" class="p-yazi p-yazi--kucuk">sütaş</text>' +
        '<rect x="212" y="123" width="1.2" height="8" fill="#5d3ebc"/>';

    var EKRAN_RAF_BOS =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk(URUN_BOS) + rafTablo(RAF_VARSAYILAN, -1) + '</svg>';

    var EKRAN_RAF_YAZILDI =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk(URUN_YAZILDI) + rafTablo(RAF_VARSAYILAN, -1) + '</svg>';

    /**
     * Açılan öneri listesi. Canlı panelde tam olarak böyle: kasa, paket ve
     * kampanya üçlüsü aranan tekil ürünle karışıyor. Aranan satır listenin
     * görünen kısmında bile olmayabiliyor.
     */
    var ONERILER = [
        ['Sütaş, Uno & Domates Üçlüsü', 'ÜÇLÜ', '#fca5a5'],
        ['Sütaş Kasa', 'KASA', '#c4b5fd'],
        ['Sütaş Çilekli Süt (200 ml)', '', '#fbcfe8'],
        ['Sütaş Muzlu Süt (200 ml)', '', '#fde68a'],
        ['Sütaş Laktozsuz Süt (200 ml)', '', '#bae6fd'],
        ['Sütaş Çikolatalı Süt (200 ml)', '', '#d6bfa8'],
        ['Sütaş Kasa - 30012', 'KASA', '#c4b5fd'],
        ['Sütaş Yarım Yağlı Süt (4 x 1 L)', '', '#bfdbfe']
    ];

    function oneriListesi(secili) {
        var cikti = '<rect x="188" y="136" width="130" height="' + (ONERILER.length * 13 + 8) +
                    '" rx="5" fill="#fff" stroke="#e2e8f0"/>';
        for (var i = 0; i < ONERILER.length; i++) {
            var yy = 148 + i * 13;
            if (i === secili) {
                cikti += '<rect x="190" y="' + (yy - 9) + '" width="126" height="12" rx="3" fill="#ecfdf5"/>';
            }
            cikti += '<rect x="194" y="' + (yy - 8) + '" width="8" height="8" rx="2" fill="' +
                     ONERILER[i][2] + '"/>' +
                     '<text x="206" y="' + yy + '" class="p-yazi p-yazi--kucuk" style="font-size:4.6px"' +
                     (i === secili ? ' font-weight="700"' : '') + '>' + ONERILER[i][0] + '</text>' +
                     (ONERILER[i][1]
                        ? '<rect x="292" y="' + (yy - 7.5) + '" width="22" height="8" rx="2" fill="#fef3c7"/>' +
                          '<text x="295" y="' + (yy - 1.5) + '" class="p-yazi" fill="#b45309"' +
                          ' style="font-size:4px">' + ONERILER[i][1] + '</text>'
                        : '');
        }
        return cikti;
    }

    var EKRAN_RAF_ONERI =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk(URUN_YAZILDI) + rafTablo(RAF_VARSAYILAN, -1) + oneriListesi(-1) + '</svg>';

    var EKRAN_RAF_SECILDI =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk(URUN_YAZILDI) + rafTablo(RAF_VARSAYILAN, -1) + oneriListesi(7) + '</svg>';

    var EKRAN_RAF_SONUC =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk('<rect x="188" y="120" width="88" height="14" rx="4" fill="#f5f3ff" stroke="#c4b5fd"/>' +
                 '<text x="192" y="130" class="p-yazi p-yazi--kucuk" fill="#6d28d9" style="font-size:4.6px">' +
                 'Sütaş Yarım Yağlı Süt (4 x 1 L)</text>') +
        rafTablo([[URUNLER.sut[1], URUNLER.sut[0], URUNLER.sut[2], '0000aa11bb22cc38']], 0) +
        '</svg>';

    // ==================================================================
    // Barkod üreteci (barkodist.com)
    // ==================================================================

    function barkodistKabuk(aktifTur, deger, sonucVar) {
        var turler = ['CODE 128', 'EAN / UPC', 'CODE39', 'ITF 14', 'MSI', 'Codabar'];
        var x = 18;
        var turYazi = '';
        for (var i = 0; i < turler.length; i++) {
            var aktif = turler[i] === aktifTur;
            var g = turler[i].length * 3.4 + 12;
            if (aktif) turYazi += '<rect x="' + (x - 6) + '" y="84" width="' + g +
                                  '" height="14" rx="4" fill="#0f172a"/>';
            turYazi += '<text x="' + x + '" y="94" class="p-yazi p-yazi--kucuk" fill="' +
                       (aktif ? '#ffffff' : '#0f172a') + '"' + (aktif ? ' font-weight="700"' : '') +
                       '>' + turler[i] + '</text>';
            x += g + 4;
        }

        return '<svg viewBox="0 0 400 300">' +
            sekmeSeridi(['Depo Paneli', 'Raf Etiketi', 'Barkodist'], 2) +
            '<rect x="0" y="22" width="400" height="278" fill="#fff"/>' +
            '<circle cx="26" cy="40" r="9" fill="none" stroke="#0f172a" stroke-width="1.6"/>' +
            '<path d="M22 36 v8 M26 34 v10 M30 36 v8" stroke="#0f172a" stroke-width="1.4"/>' +
            '<text x="286" y="43" class="p-yazi p-yazi--kucuk">Anasayfa</text>' +
            '<text x="322" y="43" class="p-yazi p-yazi--kucuk">Barkod Oluştur</text>' +
            '<path d="M0 56 h400" class="p-cizgi"/>' +
            '<text x="18" y="74" class="p-yazi--kalin" style="font-size:13px">Ücretsiz Barkod Oluşturucu</text>' +
            turYazi +
            '<rect x="12" y="104" width="42" height="10" rx="5" fill="#0f172a"/>' +
            '<text x="17" y="112" class="p-yazi p-yazi--ak" style="font-size:4.5px">CODE 128 AUTO</text>' +
            '<rect x="12" y="122" width="292" height="150" rx="6" class="p-kart"/>' +
            (sonucVar
                ? '<rect x="120" y="132" width="80" height="46" rx="2" fill="#fff" stroke="#e2e8f0"/>' +
                  barkod(126, 136, 68, 34) +
                  '<text x="136" y="188" class="p-yazi p-yazi--kucuk">' + deger + '</text>'
                : '<rect x="120" y="132" width="80" height="46" rx="2" fill="#fff" stroke="#e2e8f0"/>' +
                  barkod(126, 136, 68, 34, '#94a3b8') +
                  '<text x="146" y="188" class="p-yazi p-yazi--kucuk" opacity="0.5">Merhaba!</text>') +
            '<rect x="24" y="198" width="268" height="18" rx="4" fill="#fff" stroke="#e2e8f0"/>' +
            '<text x="32" y="210" class="p-yazi p-yazi--kucuk"' + (deger ? '' : ' opacity="0.45"') + '>' +
            (deger || 'Barkod Numarası Giriniz') + '</text>' +
            '<rect x="24" y="224" width="128" height="18" rx="4" fill="#0f172a"/>' +
            '<text x="72" y="236" class="p-yazi p-yazi--ak">+ Oluştur</text>' +
            '<rect x="164" y="224" width="128" height="18" rx="4" fill="#0f172a"/>' +
            '<text x="214" y="236" class="p-yazi p-yazi--ak">İndir</text>' +
            '</svg>';
    }

    var EKRAN_BARKOD_BOS = barkodistKabuk('CODE 128', '', false);
    var EKRAN_BARKOD_TUR = barkodistKabuk('EAN / UPC', '', false);
    var EKRAN_BARKOD_YAPISTIRILDI = barkodistKabuk('EAN / UPC', '8690767670053', false);
    var EKRAN_BARKOD_HAZIR = barkodistKabuk('EAN / UPC', '8690767670053', true);

    // ==================================================================
    // Ekranlar: Jet Barkod
    // ==================================================================

    /**
     * Jet Barkod sonuç kartı. Ürünün fotoğrafı, adı ve okutulabilir
     * barkodu aynı kartta. Sattığımız şey burası: personel sonucu okumuyor,
     * görüyor.
     */
    function jetKart(x, yy, anahtar) {
        var u = URUNLER[anahtar];
        return '<g>' +
            '<rect x="' + x + '" y="' + yy + '" width="121" height="74" rx="6" class="p-kart"/>' +
            gorsel(x + 7, yy + 7, 32, u[2]) +
            '<text x="' + (x + 45) + '" y="' + (yy + 15) + '" class="p-yazi p-yazi--kucuk"' +
            ' style="font-size:4.4px;font-weight:700">' + u[0] + '</text>' +
            barkod(x + 45, yy + 20, 68, 17) +
            '<text x="' + (x + 45) + '" y="' + (yy + 44) + '" class="p-yazi p-yazi--kucuk"' +
            ' style="font-size:4.6px">' + u[1] + '</text>' +
            '<rect x="' + (x + 7) + '" y="' + (yy + 46) + '" width="32" height="9" rx="2" fill="#ecfdf5"/>' +
            '<text x="' + (x + 11) + '" y="' + (yy + 52) + '" class="p-yazi" fill="#047857"' +
            ' style="font-size:4px">GÖRSELLİ</text>' +
            barkod(x + 45, yy + 50, 68, 17) +
            '<text x="' + (x + 45) + '" y="' + (yy + 70) + '" class="p-yazi p-yazi--kucuk"' +
            ' opacity="0.55" style="font-size:4px">ekrandan okutulabilir</text>' +
            '</g>';
    }

    /** Jet Barkod kabuğu. Sonuç alanı ayrı veriliyor. */
    function jetKabuk(sonucAlani, aramaMetni) {
        return '<svg viewBox="0 0 400 300">' +
            sekmeSeridi(['Depo Paneli', 'Jet Barkod'], 1) +
            '<rect x="0" y="22" width="400" height="278" fill="#f8fafc"/>' +
            '<rect x="0" y="22" width="400" height="30" fill="#fff"/>' +
            '<path d="M0 52 h400" class="p-cizgi"/>' +
            '<rect x="14" y="30" width="14" height="14" rx="4" fill="#2563eb"/>' +
            '<text x="34" y="42" class="p-yazi p-yazi--kalin">Jet Barkod</text>' +
            '<text x="300" y="42" class="p-yazi p-yazi--kucuk" opacity="0.55">Ürün Barkod Arama</text>' +
            '<rect x="14" y="60" width="372" height="20" rx="6" class="p-kart"/>' +
            '<circle cx="27" cy="70" r="4.2" fill="none" stroke="#94a3b8" stroke-width="1.3"/>' +
            '<path d="M30 73 L33.6 76.6" stroke="#94a3b8" stroke-width="1.3" stroke-linecap="round"/>' +
            '<text x="38" y="73" class="p-yazi p-yazi--kucuk"' +
            (aramaMetni ? '' : ' opacity="0.45"') + ' style="font-size:4.6px">' +
            (aramaMetni || 'Ürün adı, barkod veya yapıştırılan tablo') + '</text>' +
            sonucAlani +
            '</svg>';
    }

    var JET_ARAMA = 'Kuru Soğan, Maydanoz, Erikli Su, Calve Sos, Sokak Simiti, Algida…';

    /* Sekmeye yeni geçilmiş an: arama dolu, sonuç henüz gelmemiş. */
    var EKRAN_JET_BOS = jetKabuk(
        '<text x="14" y="94" class="p-yazi p-yazi--kucuk" opacity="0.55">Yapıştırılan liste çözülüyor…</text>' +
        '<rect x="14" y="100" width="121" height="74" rx="6" fill="#eef2f7"/>' +
        '<rect x="139" y="100" width="121" height="74" rx="6" fill="#eef2f7"/>' +
        '<rect x="264" y="100" width="121" height="74" rx="6" fill="#eef2f7"/>' +
        '<rect x="14" y="180" width="121" height="74" rx="6" fill="#eef2f7"/>' +
        '<rect x="139" y="180" width="121" height="74" rx="6" fill="#eef2f7"/>' +
        '<rect x="264" y="180" width="121" height="74" rx="6" fill="#eef2f7"/>',
        JET_ARAMA);

    var EKRAN_JET = jetKabuk(
        '<text x="14" y="94" class="p-yazi p-yazi--kucuk" opacity="0.7">' +
        '10 ürün · hepsi görseli ve barkoduyla</text>' +
        jetKart(14, 100, 'sogan') + jetKart(139, 100, 'maydanoz') + jetKart(264, 100, 'su') +
        jetKart(14, 180, 'sos') + jetKart(139, 180, 'simit') + jetKart(264, 180, 'dondurma'),
        JET_ARAMA);

    // ==================================================================
    // Senaryo
    // ==================================================================

    /*
     * İmleç ve göz konumları sahnenin yüzdesi. Sahne 400x300 birim
     * olduğu için x/4 ve y/3 ile çevriliyor.
     */
    function y(x, yy) { return [x / 4, yy / 3]; }

    global.JBSenaryoBarkod = {
        baslik: 'Okunmayan bir barkodu bulmak',
        ozet: 'İki tarafta da aynı yerden başlanıyor: kontrol panelinde açık bir sipariş.',

        sol: {
            ad: 'Eklentisiz depo',
            ekranlar: {
                panel: EKRAN_PANEL,
                detay: ekranSiparisDetay(false, false),
                secili: EKRAN_SECILI,
                rafBos: EKRAN_RAF_BOS,
                rafYazildi: EKRAN_RAF_YAZILDI,
                rafOneri: EKRAN_RAF_ONERI,
                rafSecildi: EKRAN_RAF_SECILDI,
                rafSonuc: EKRAN_RAF_SONUC,
                barkodBos: EKRAN_BARKOD_BOS,
                barkodTur: EKRAN_BARKOD_TUR,
                barkodYapistirildi: EKRAN_BARKOD_YAPISTIRILDI,
                barkodHazir: EKRAN_BARKOD_HAZIR
            },
            adimlar: [
                { ad: 'Siparişe tıklandı', sure: 700, ekran: 'panel',
                  imlec: y(190, 176), goz: y(190, 176), tik: true },
                { ad: 'Sipariş detayı yükleniyor', sureAralik: [900, 1400], ekran: 'detay',
                  yukleniyor: true, goz: y(200, 200) },
                { ad: 'Ürün adı seçilip kopyalandı', sure: 2200, ekran: 'secili',
                  imlec: y(278, 246), goz: y(268, 244), tik: true },
                { ad: 'Raf Etiketi sayfasına geçildi', sure: 1100, ekran: 'rafBos',
                  imlec: y(100, 12), goz: y(100, 12), tik: true },
                { ad: 'Sayfa yükleniyor', sureAralik: [2000, 3000], ekran: 'rafBos',
                  yukleniyor: true, goz: y(230, 200) },
                { ad: 'Ürünler filtresine ürün adı yazıldı', sure: 2400, ekran: 'rafYazildi',
                  imlec: y(232, 127), goz: y(232, 127), tik: true },
                { ad: 'Açılan listede kasa ve paketler karışık', sure: 900, ekran: 'rafOneri',
                  goz: y(250, 160), imlec: y(310, 150) },
                { ad: 'Doğru tekil ürün aranıyor', sureAralik: [3000, 4600], ekran: 'rafOneri',
                  goz: y(250, 215), imlec: y(310, 210) },
                { ad: 'Ürün seçildi', sure: 900, ekran: 'rafSecildi',
                  imlec: y(250, 174), goz: y(250, 174), tik: true },
                { ad: 'Uygula düğmesine basıldı', sure: 800, ekran: 'rafSecildi',
                  imlec: y(357, 144), goz: y(357, 144), tik: true },
                { ad: 'Tablo yeniden yükleniyor', sureAralik: [1600, 2600], ekran: 'rafSonuc',
                  yukleniyor: true, goz: y(230, 200) },
                { ad: 'Barkod rozetine tıklanıp kopyalandı', sure: 1100, ekran: 'rafSonuc',
                  imlec: y(120, 190), goz: y(120, 190), tik: true },
                { ad: 'Barkod üreteci sekmesine geçildi', sure: 1000, ekran: 'barkodBos',
                  imlec: y(178, 12), goz: y(178, 12), tik: true },
                { ad: 'EAN / UPC türü seçildi', sure: 900, ekran: 'barkodTur',
                  imlec: y(86, 92), goz: y(86, 92), tik: true },
                { ad: 'Numara yapıştırıldı', sure: 900, ekran: 'barkodYapistirildi',
                  imlec: y(150, 208), goz: y(150, 208), tik: true },
                { ad: 'Oluştur düğmesine basıldı', sure: 700, ekran: 'barkodYapistirildi',
                  imlec: y(88, 234), goz: y(88, 234), tik: true },
                { ad: 'Tek ürünün barkodu hazır', sure: 900, ekran: 'barkodHazir',
                  goz: y(160, 158), imlec: null }
            ]
        },

        sag: {
            ad: 'Jet Barkod Asistan kurulu',
            ekranlar: {
                panel: EKRAN_PANEL,
                detay: ekranSiparisDetay(true, false),
                jetBos: EKRAN_JET_BOS,
                jet: EKRAN_JET
            },
            adimlar: [
                { ad: 'Siparişe tıklandı', sure: 700, ekran: 'panel',
                  imlec: y(190, 176), goz: y(190, 176), tik: true },
                { ad: 'Sipariş detayı yükleniyor', sureAralik: [900, 1400], ekran: 'detay',
                  yukleniyor: true, goz: y(200, 200) },
                { ad: 'Tümünü Kopyala düğmesine basıldı', sure: 800, ekran: 'detay',
                  imlec: y(288, 134), goz: y(288, 134), tik: true },
                { ad: 'Yan sekmedeki Jet Barkod açıldı', sure: 600, ekran: 'jetBos',
                  imlec: y(98, 12), goz: y(98, 12), tik: true },
                { ad: 'Liste çözülüyor', sure: 500, ekran: 'jetBos',
                  yukleniyor: true, goz: y(200, 180) },
                { ad: 'Hepsi görseli ve barkoduyla ekranda', sure: 1000, ekran: 'jet',
                  goz: y(200, 180), imlec: null }
            ]
        }
    };
})(window);
