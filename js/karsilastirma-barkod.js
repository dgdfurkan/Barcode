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
        sut:      ['Sütaş %2,5 Yağlı UHT Süt (1 L)', '8690767716034', 'urunler/sutas-sut.jpg'],
        sos:      ['Calve Barbekü Sos (290 g)', '8690637805219', 'sos.jpg'],
        su:       ['Erikli Doğal Kaynak Suyu (500 ml)', '8690793010052', 'su.jpg'],
        un:       ['Bağdat Galeta Unu (250 g)', '8690560011077', 'un.jpg'],
        maydanoz: ['Maydanoz Paket (1 Adet)', '8680422241643', 'maydanoz.jpg'],
        sogan:    ['Kuru Soğan (1 kg)', '8697458342084', 'sogan.jpg'],
        simit:    ['La Lorraine Sokak Simiti (90 g)', '8681573033125', 'simit.jpg'],
        dondurma: ['Algida Nogger Sandwich (145 ml)', '8690637117121', 'dondurma.jpg'],
        kaymak:   ['Sütaş Kaymaksız Yoğurt (600 g)', '8690767671104', 'kaymak.jpg'],
        folyo:    ['Cook Alüminyum Folyo (10 M)', '8690709040005', 'folyo.jpg'],
        peynir:   ['Pınar Beyaz Taze Peynir (350 g)', '8690565022733', 'urunler/pinar-peynir.jpg'],
        ayran:    ['Sütaş Ayran (1 L)', '8690767160189', 'urunler/sutas-ayran.jpg'],
        kola:     ['Coca-Cola (250 ml)', '5000112664867', 'urunler/kola.jpg'],
        cips:     ["Lay's Klasik Patates Cipsi (107 g)", '8690624100983', 'urunler/lays.jpg'],
        gofret:   ['Ülker Çikolatalı Gofret (36 g)', '8690504020509', 'urunler/ulker-gofret.jpg'],
        pogaca:   ['Uno Kaşar Peynirli Poğaça (75 g)', '8680959080333', 'urunler/uno-pogaca.jpg']
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
        /* Sipariştekiler ve Jet Barkod'da çıkanlar aynı on iki ürün.
           Sağ şeritteki ızgara (JET_SIRALAR) bu listeyle birebir aynı. */
        var sira = ['sogan', 'maydanoz', 'su', 'sos', 'simit', 'dondurma',
                    'kaymak', 'un', 'folyo', 'sut', 'peynir', 'ayran'];
        var adetler = [1, 1, 2, 1, 3, 2, 1, 1, 1, 1, 1, 1];

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
            '<text x="210" y="116" class="p-yazi p-yazi--kucuk" style="font-size:5px">16 DP.101</text>' +

            '<text x="266" y="88" class="p-yazi p-yazi--kucuk" opacity="0.55">Toplayıcı Adı:</text>' +
            '<text x="266" y="98" class="p-yazi p-yazi--kucuk">A. Demir</text>' +
            '<text x="266" y="116" class="p-yazi p-yazi--kucuk" opacity="0.55">Adet:</text>' +
            '<text x="290" y="116" class="p-yazi p-yazi--kucuk">16</text>' +

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
        [URUNLER.peynir[1],   URUNLER.peynir[0],   URUNLER.peynir[2],   '0000aa11bb22cc33'],
        [URUNLER.ayran[1],    URUNLER.ayran[0],    URUNLER.ayran[2],    '0000aa11bb22cc34'],
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
     * Açılan öneri listesi.
     *
     * Gerçekte olan şu: "sütaş" yazınca kasa, kampanya ve tekil ürünler aynı
     * listede karışıyor. Aranan tekil ürün listenin görünen kısmında bile
     * olmuyor, aşağı kaydırmak gerekiyor. Sattığımız zaman farkının yarısı
     * burada kaybediliyor.
     *
     * Liste on dört satır, kutuda sekiz satır görünüyor. `kaydir` verilince
     * alt yarısı gösteriliyor; iki ekran arka arkaya oynatılınca personelin
     * listeyi aşağı çekişi görülüyor.
     */
    var ONERILER = [
        ['Sütaş & Uno Kahvaltılık', 'KAMPANYA'],
        ['Sütaş Kasa - 30012', 'KASA'],
        ['Sütaş Çilekli Süt (200 ml)', ''],
        ['Sütaş Muzlu Süt (200 ml)', ''],
        ['Sütaş Kakaolu Süt (200 ml)', ''],
        ['Sütaş Laktozsuz Süt (1 L)', ''],
        ['Sütaş Kasa - 30018', 'KASA'],
        ['Sütaş Labne (180 g)', ''],
        ['Sütaş Süzme Peynir (500 g)', ''],
        ['Sütaş Kaymaksız Yoğurt (600 g)', ''],
        ['Sütaş Ayran (1 L)', ''],
        ['Sütaş Kasa - 30021', 'KASA'],
        ['Sütaş Tereyağı (250 g)', ''],
        ['Sütaş %2,5 Yağlı UHT Süt (1 L)', '']
    ];

    var ONERI_PENCERE = 8;

    /**
     * @param secili  Vurgulanacak satırın listedeki gerçek sırası, yoksa -1.
     * @param kaydir  0 ise başı, 1 ise sonu gösteriliyor.
     */
    function oneriListesi(secili, kaydir) {
        var bas = kaydir ? ONERILER.length - ONERI_PENCERE : 0;
        var x = 186, g = 136, satirY = 15;
        var yuk = ONERI_PENCERE * satirY + 12;

        /* Aşağıya düşen gölge: liste tablonun üstünde duran bir katman. */
        var cikti =
            '<rect x="' + (x + 1) + '" y="' + (g + 3) + '" width="' + g + '" height="' + yuk +
            '" rx="6" fill="#0f172a" opacity="0.07"/>' +
            '<rect x="' + x + '" y="' + g + '" width="' + g + '" height="' + yuk +
            '" rx="6" fill="#fff" stroke="#dfe4ec"/>';

        /* Kaydırma çubuğu: iki ekranda farklı yerde, hareket görünüyor. */
        var yol = yuk - 14;
        var basparmak = yol * (ONERI_PENCERE / ONERILER.length);
        cikti +=
            '<rect x="' + (x + g - 6) + '" y="' + (g + 7) + '" width="2.4" height="' + yol +
            '" rx="1.2" fill="#eef1f5"/>' +
            '<rect x="' + (x + g - 6) + '" y="' + (g + 7 + (kaydir ? yol - basparmak : 0)) +
            '" width="2.4" height="' + basparmak + '" rx="1.2" fill="#c3cad6"/>';

        for (var i = 0; i < ONERI_PENCERE; i++) {
            var sira = bas + i;
            var oge = ONERILER[sira];
            if (!oge) continue;
            var yy = g + 8 + i * satirY;
            var bu = sira === secili;

            if (bu) {
                cikti += '<rect x="' + (x + 3) + '" y="' + yy + '" width="' + (g - 12) +
                         '" height="' + (satirY - 1) + '" rx="3" fill="#f2f8f5"/>';
            }

            /* Ant Design çoklu seçim kutucuğu */
            cikti +=
                '<rect x="' + (x + 8) + '" y="' + (yy + 4) + '" width="6.5" height="6.5" rx="1.6"' +
                ' fill="' + (bu ? '#0e7c58' : '#fff') + '" stroke="' + (bu ? '#0e7c58' : '#cbd2dc') +
                '" stroke-width="0.8"/>' +
                (bu ? '<path d="M' + (x + 9.6) + ' ' + (yy + 7.3) + ' l1.4 1.4 l2.5 -2.6"' +
                      ' stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"' +
                      ' stroke-linejoin="round"/>' : '') +
                '<text x="' + (x + 20) + '" y="' + (yy + 9.6) + '" class="p-yazi"' +
                ' style="font-size:4.6px"' + (bu ? ' font-weight="700"' : '') + '>' +
                oge[0] + '</text>' +
                (oge[1]
                    ? '<rect x="' + (x + g - 40) + '" y="' + (yy + 2.6) + '" width="30" height="8"' +
                      ' rx="2" fill="#fdf3e2"/>' +
                      '<text x="' + (x + g - 37) + '" y="' + (yy + 8.6) + '" class="p-yazi"' +
                      ' fill="#8a6420" style="font-size:3.6px">' + oge[1] + '</text>'
                    : '');
        }

        cikti += '<text x="' + (x + 8) + '" y="' + (g + yuk - 3) + '" class="p-yazi"' +
                 ' style="font-size:3.6px" opacity="0.5">' + ONERILER.length + ' kayıt</text>';
        return cikti;
    }

    var EKRAN_RAF_ONERI =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk(URUN_YAZILDI) + rafTablo(RAF_VARSAYILAN, -1) + oneriListesi(-1, 0) + '</svg>';

    var EKRAN_RAF_KAYDIRILDI =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk(URUN_YAZILDI) + rafTablo(RAF_VARSAYILAN, -1) + oneriListesi(-1, 1) + '</svg>';

    var EKRAN_RAF_SECILDI =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk(URUN_YAZILDI) + rafTablo(RAF_VARSAYILAN, -1) +
        oneriListesi(ONERILER.length - 1, 1) + '</svg>';

    var EKRAN_RAF_SONUC =
        '<svg viewBox="0 0 400 300">' + sekmeSeridi(['Depo Paneli', 'Raf Etiketi'], 1) +
        rafKabuk('<rect x="188" y="120" width="88" height="14" rx="4" fill="#f5f3ff" stroke="#c4b5fd"/>' +
                 '<rect x="192" y="123.5" width="76" height="7" rx="2" fill="#ede9fe"/>' +
                 '<text x="195" y="129.5" class="p-yazi" fill="#5b21b6" style="font-size:4.2px">' +
                 'Sütaş %2,5 Yağlı UHT S…</text>') +
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
     * EAN-13 basamak dizilimi. Gerçek sayfada olduğu gibi: ilk hane
     * barkodun solunda ayrı duruyor, kalan on iki hane altta iki gruba
     * bölünüyor.
     */
    function eanYazi(x, yy, kod) {
        var ilk = kod.slice(0, 1);
        var sol = kod.slice(1, 7);
        var sag = kod.slice(7);
        return '<text x="' + x + '" y="' + yy + '" class="p-yazi" style="font-size:4.4px">' +
               ilk + '</text>' +
               '<text x="' + (x + 14) + '" y="' + yy + '" class="p-yazi"' +
               ' style="font-size:4.4px;letter-spacing:0.5px">' + sol + '</text>' +
               '<text x="' + (x + 48) + '" y="' + yy + '" class="p-yazi"' +
               ' style="font-size:4.4px;letter-spacing:0.5px">' + sag + '</text>';
    }

    /**
     * Jet Barkod sonuç kartı. Canlı sayfaya bakılarak çizildi: üstte
     * ürünün büyük fotoğrafı, altında adı, ince ayraç, sağda çoklu barkod
     * sayfalaması ve en altta okutulabilir EAN-13 barkod.
     *
     * Sattığımız şey burası. Önceki çizimde kart küçük ve cılızdı,
     * ürünü hak ettiğinden zayıf gösteriyordu.
     */
    function jetKart(x, yy, anahtar, barkodSayisi) {
        var u = URUNLER[anahtar];
        var ad = u[0];
        // Uzun adlar iki satıra iniyor, tıpkı gerçek kartta olduğu gibi.
        var satir1 = ad, satir2 = '';
        if (ad.length > 24) {
            var kes = ad.lastIndexOf(' ', 24);
            if (kes > 10) { satir1 = ad.slice(0, kes); satir2 = ad.slice(kes + 1); }
        }

        return '<g>' +
            '<rect x="' + x + '" y="' + yy + '" width="88" height="118" rx="7"' +
            ' fill="#fff" stroke="#eef2f7"/>' +
            '<rect x="' + (x + 1) + '" y="' + (yy + 1) + '" width="86" height="52" rx="6" fill="#fbfdff"/>' +
            gorsel(x + 27, yy + 5, 34, u[2]) +
            '<text x="' + (x + 8) + '" y="' + (yy + 66) + '" class="p-yazi"' +
            ' style="font-size:5px;font-weight:700">' + satir1 + '</text>' +
            (satir2
                ? '<text x="' + (x + 8) + '" y="' + (yy + 73) + '" class="p-yazi"' +
                  ' style="font-size:5px;font-weight:700">' + satir2 + '</text>'
                : '') +
            '<path d="M' + (x + 8) + ' ' + (yy + 80) + ' h72" class="p-cizgi"/>' +
            '<text x="' + (x + 54) + '" y="' + (yy + 89) + '" class="p-yazi"' +
            ' style="font-size:4px" opacity="0.55">1 / ' + barkodSayisi + '</text>' +
            '<path d="M' + (x + 68) + ' ' + (yy + 86) + ' l-2 2 l2 2" stroke="#cbd5e1"' +
            ' stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
            '<path d="M' + (x + 75) + ' ' + (yy + 86) + ' l2 2 l-2 2" stroke="#94a3b8"' +
            ' stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
            barkod(x + 10, yy + 93, 68, 16) +
            eanYazi(x + 10, yy + 114, u[1]) +
            '</g>';
    }

    /** Jet Barkod üst şeridi. Gerçek sayfadaki düğmeler ve deneme rozeti. */
    function jetUst() {
        return '<rect x="0" y="22" width="400" height="34" fill="#fff"/>' +
            '<path d="M0 56 h400" class="p-cizgi"/>' +
            '<rect x="12" y="30" width="17" height="17" rx="5" fill="#eef4ff" stroke="#dbe6ff"/>' +
            '<circle cx="20.5" cy="38.5" r="4.4" fill="none" stroke="#2563eb" stroke-width="1.4"/>' +
            '<path d="M23.6 41.6 L26 44" stroke="#2563eb" stroke-width="1.4" stroke-linecap="round"/>' +
            '<text x="34" y="38" class="p-yazi" style="font-size:7px;font-weight:800">Jet Barkod</text>' +
            '<text x="34" y="46" class="p-yazi" style="font-size:4.2px" opacity="0.6">' +
            'Ürün Barkod Arama Sistemi</text>' +
            '<rect x="132" y="31" width="34" height="14" rx="5" fill="#fff" stroke="#e8edf3"/>' +
            '<text x="139" y="40" class="p-yazi" style="font-size:4.4px">Sayım</text>' +
            '<rect x="170" y="31" width="34" height="14" rx="5" fill="#fff" stroke="#e8edf3"/>' +
            '<text x="177" y="40" class="p-yazi" style="font-size:4.4px">Ajanda</text>' +
            '<rect x="208" y="31" width="52" height="14" rx="5" fill="#fff" stroke="#e8edf3"/>' +
            '<text x="214" y="40" class="p-yazi" style="font-size:4.4px">Raftaki Eksikler</text>' +
            '<rect x="266" y="31" width="46" height="14" rx="5" fill="#fff" stroke="#e8edf3"/>' +
            '<text x="272" y="40" class="p-yazi" style="font-size:4.4px" font-weight="700">14</text>' +
            '<text x="279" y="40" class="p-yazi" style="font-size:4.2px" opacity="0.6">gün</text>' +
            '<text x="292" y="40" class="p-yazi" style="font-size:4.4px" font-weight="700">18</text>' +
            '<text x="299" y="40" class="p-yazi" style="font-size:4.2px" opacity="0.6">saat</text>' +
            '<rect x="316" y="29" width="46" height="18" rx="7" fill="#fff" stroke="#e8edf3"/>' +
            '<circle cx="325" cy="38" r="5.5" fill="#eef4ff"/>' +
            '<text x="334" y="37" class="p-yazi" style="font-size:4.6px;font-weight:700">deneme</text>' +
            '<text x="334" y="43" class="p-yazi" style="font-size:3.6px" opacity="0.6">Örnek Depo</text>' +
            '<rect x="366" y="31" width="26" height="14" rx="5" fill="#fff" stroke="#e8edf3"/>' +
            '<text x="371" y="40" class="p-yazi" style="font-size:4.2px">Ayarlar</text>';
    }

    /** Arama kartı: başlık, ipucu rozetleri, Liste/Grid geçişi. */
    function jetArama(metin) {
        return '<rect x="10" y="62" width="380" height="52" rx="8" class="p-kart"/>' +
            '<rect x="18" y="68" width="14" height="14" rx="5" fill="#eef4ff"/>' +
            '<circle cx="25" cy="74.5" r="3.6" fill="none" stroke="#2563eb" stroke-width="1.2"/>' +
            '<path d="M27.6 77.1 L29.6 79.1" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round"/>' +
            '<text x="38" y="74" class="p-yazi" style="font-size:5.5px;font-weight:700">Ürün Arama</text>' +
            '<text x="38" y="81" class="p-yazi" style="font-size:4px" opacity="0.6">' +
            'Ürün adını yazarak barkod bilgilerine ulaşın</text>' +
            '<rect x="326" y="66" width="28" height="13" rx="4" fill="#fff" stroke="#e8edf3"/>' +
            '<text x="333" y="75" class="p-yazi" style="font-size:4.2px">Liste</text>' +
            '<rect x="356" y="66" width="26" height="13" rx="4" fill="#eef4ff" stroke="#c7dbff"/>' +
            '<text x="362" y="75" class="p-yazi" style="font-size:4.2px" fill="#1d4ed8">Grid</text>' +
            '<rect x="18" y="86" width="364" height="14" rx="5" fill="#fff" stroke="' +
            (metin ? '#93c5fd' : '#e8edf3') + '"/>' +
            '<circle cx="27" cy="93" r="3.4" fill="none" stroke="#94a3b8" stroke-width="1.1"/>' +
            '<path d="M29.4 95.4 L31.4 97.4" stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round"/>' +
            '<text x="37" y="95" class="p-yazi" style="font-size:4.4px"' +
            (metin ? '' : ' opacity="0.42"') + '>' +
            (metin || 'Ürün adını yazın veya tablo verisi yapıştırın… (örn: Nesfit, Coca Cola)') + '</text>' +
            '<text x="18" y="109" class="p-yazi" style="font-size:3.8px" opacity="0.5">İpucu:</text>' +
            '<rect x="36" y="103" width="86" height="9" rx="3" fill="#eff6ff"/>' +
            '<text x="40" y="109.5" class="p-yazi" fill="#1d4ed8" style="font-size:3.6px">' +
            'Virgülle birden fazla terim</text>' +
            '<rect x="126" y="103" width="72" height="9" rx="3" fill="#ecfdf5"/>' +
            '<text x="130" y="109.5" class="p-yazi" fill="#047857" style="font-size:3.6px">' +
            'Türkçe karakter desteği</text>' +
            '<rect x="202" y="103" width="76" height="9" rx="3" fill="#ecfdf5"/>' +
            '<text x="206" y="109.5" class="p-yazi" fill="#047857" style="font-size:3.6px">' +
            'Tablo verisi yapıştırma</text>';
    }

    function jetKabuk(sonucAlani, aramaMetni) {
        return '<svg viewBox="0 0 400 300">' +
            sekmeSeridi(['Depo Paneli', 'Jet Barkod'], 1) +
            '<rect x="0" y="22" width="400" height="278" fill="#f7f9fc"/>' +
            jetUst() + jetArama(aramaMetni) + sonucAlani +
            '</svg>';
    }

    /* Tümünü Kopyala siparişin on iki kalemini birden yapıştırıyor.
       Sipariş tablosundaki sırayla, aynı ürünler. */
    var JET_ARAMA = 'kuru soğan, maydanoz, erikli, calve, sokak simiti, algida, ' +
                    'sütaş kaymaksız, galeta unu, cook folyo, sütaş süt, ' +
                    'pınar peynir, sütaş ayran';

    /* Sekmeye yeni geçilmiş an: arama dolu, sonuçlar henüz gelmemiş. */
    var EKRAN_JET_BOS = jetKabuk(
        '<rect x="10" y="122" width="380" height="24" rx="7" class="p-kart"/>' +
        '<rect x="18" y="128" width="12" height="12" rx="4" fill="#ecfdf5"/>' +
        '<text x="36" y="134" class="p-yazi" style="font-size:5px;font-weight:700">Arama Sonuçları</text>' +
        '<text x="36" y="141" class="p-yazi" style="font-size:4px" opacity="0.6">' +
        'çözülüyor…</text>' +
        '<rect x="10" y="152" width="88" height="118" rx="7" fill="#eef2f7"/>' +
        '<rect x="108" y="152" width="88" height="118" rx="7" fill="#eef2f7"/>' +
        '<rect x="206" y="152" width="88" height="118" rx="7" fill="#eef2f7"/>' +
        '<rect x="304" y="152" width="88" height="118" rx="7" fill="#eef2f7"/>',
        JET_ARAMA);

    var EKRAN_JET = jetKabuk(
        '<rect x="10" y="122" width="380" height="24" rx="7" class="p-kart"/>' +
        '<rect x="18" y="128" width="12" height="12" rx="4" fill="#ecfdf5"/>' +
        '<path d="M21 134 l2 2 l4 -4" stroke="#047857" stroke-width="1.2" fill="none"' +
        ' stroke-linecap="round" stroke-linejoin="round"/>' +
        '<text x="36" y="134" class="p-yazi" style="font-size:5px;font-weight:700">Arama Sonuçları</text>' +
        '<text x="36" y="141" class="p-yazi" style="font-size:4px" opacity="0.65">' +
        '35 ürün bulundu (12 arama terimi) · hepsi görseli ve barkoduyla</text>' +
        jetKart(10, 152, 'sogan', 2) +
        jetKart(108, 152, 'maydanoz', 6) +
        jetKart(206, 152, 'su', 4) +
        jetKart(304, 152, 'sos', 2) +
        '<text x="10" y="284" class="p-yazi" style="font-size:4px" opacity="0.5">' +
        'Barkodu olmayan ürün yok. Çoklu barkodlu ürünlerde oklarla diğer kodlara geçilir.</text>',
        JET_ARAMA);

    /**
     * Bütün sonuçların kaydırılarak geçtiği ekran.
     *
     * Üç sıra, on iki kart. Kartlar bir kırpma alanının içinde duruyor ve
     * CSS ile yukarı kayıyor. Kayma yalnızca ekran açıkken oynuyor
     * (`.krs__ekran.acik`), arka planda kare harcanmıyor.
     *
     * NEDEN VAR
     * Sağ şeritte "35 ürün geldi" yazmak yetmiyordu; ziyaretçi ilk dört
     * kartı görüp geri kalanını hayal ediyordu. Liste gözünün önünde
     * geçince gerçekten hepsinin geldiği anlaşılıyor.
     */
    var JET_SIRALAR = [
        ['sogan', 'maydanoz', 'su', 'sos'],
        ['simit', 'dondurma', 'kaymak', 'un'],
        ['folyo', 'sut', 'peynir', 'ayran']
    ];

    function jetIzgara() {
        var cikti = '';
        for (var r = 0; r < JET_SIRALAR.length; r++) {
            for (var k = 0; k < JET_SIRALAR[r].length; k++) {
                cikti += jetKart(10 + k * 98, 152 + r * 130, JET_SIRALAR[r][k], 2 + ((r + k) % 5));
            }
        }
        return cikti;
    }

    function jetBaslik(altYazi) {
        return '<rect x="10" y="122" width="380" height="24" rx="7" class="p-kart"/>' +
            '<rect x="18" y="128" width="12" height="12" rx="4" fill="#ecfdf5"/>' +
            '<path d="M21 134 l2 2 l4 -4" stroke="#047857" stroke-width="1.2" fill="none"' +
            ' stroke-linecap="round" stroke-linejoin="round"/>' +
            '<text x="36" y="134" class="p-yazi" style="font-size:5px;font-weight:700">Arama Sonuçları</text>' +
            '<text x="36" y="141" class="p-yazi" style="font-size:4px" opacity="0.65">' + altYazi + '</text>';
    }

    var EKRAN_JET_KAYDIR = jetKabuk(
        jetBaslik('35 ürün bulundu (12 arama terimi) · liste baştan sona geçiyor') +
        '<clipPath id="jbKirp"><rect x="6" y="150" width="388" height="132" rx="7"/></clipPath>' +
        '<g clip-path="url(#jbKirp)"><g class="jb-kaydir">' + jetIzgara() + '</g></g>' +
        /* Kaydırma çubuğu */
        '<rect x="394" y="152" width="2.4" height="128" rx="1.2" fill="#e8edf3"/>' +
        '<rect x="394" y="152" width="2.4" height="44" rx="1.2" fill="#b9c3d1" class="jb-kaydir-cubuk"/>',
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
        vurgu: 'Solda tek ürünün barkodu çıktı. Sağda siparişin tamamı, görseliyle birlikte.',

        sol: {
            ad: 'Eklentisiz depo',
            ekranlar: {
                panel: EKRAN_PANEL,
                detay: ekranSiparisDetay(false, false),
                secili: EKRAN_SECILI,
                rafBos: EKRAN_RAF_BOS,
                rafYazildi: EKRAN_RAF_YAZILDI,
                rafOneri: EKRAN_RAF_ONERI,
                rafKaydirildi: EKRAN_RAF_KAYDIRILDI,
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
                { ad: 'Raf Etiketi sayfasına geçildi', sureAralik: [1300, 1900], ekran: 'rafBos',
                  imlec: y(100, 12), goz: y(100, 12), tik: true },
                { ad: 'Ürünler filtresine ürün adı yazıldı', sure: 2400, ekran: 'rafYazildi',
                  imlec: y(232, 127), goz: y(232, 127), tik: true },
                { ad: 'Listede kasa ve kampanyalar karışık geliyor', sure: 1500, ekran: 'rafOneri',
                  goz: y(250, 165), imlec: y(300, 158) },
                { ad: 'Doğru tekil ürün için liste aşağı çekiliyor', sureAralik: [2600, 3800],
                  ekran: 'rafKaydirildi', goz: y(250, 220), imlec: y(300, 215) },
                { ad: 'Ürün seçildi', sure: 900, ekran: 'rafSecildi',
                  imlec: y(240, 254), goz: y(240, 254), tik: true },
                { ad: 'Uygula düğmesine basıldı', sure: 800, ekran: 'rafSecildi',
                  imlec: y(357, 144), goz: y(357, 144), tik: true },
                { ad: 'Tablo yeniden yükleniyor', sureAralik: [1300, 1900], ekran: 'rafSonuc',
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
                jetKaydir: EKRAN_JET_KAYDIR,
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
                { ad: 'Liste çözülüyor', sure: 550, ekran: 'jetBos',
                  yukleniyor: true, goz: y(200, 200) },
                { ad: '35 ürünün tamamı görseli ve barkoduyla geldi', sure: 2400,
                  ekran: 'jetKaydir', goz: y(200, 210), imlec: null },
                { ad: 'Aranan ürün ilk bakışta görülüyor', sure: 900, ekran: 'jet',
                  goz: y(54, 200) }
            ]
        }
    };
})(window);
