/**
 * Jet Barkod. Eklenti tanıtımı ve kurulum sihirbazı.
 * ============================================================================
 *
 * Ayarlar > Özellikler'de bir araca dokununca açılan panelin içeriğini üretir:
 * önce ne işe yaradığı, sonra adım adım kurulum.
 *
 * İKİ KURULUM TÜRÜ
 *   tur: 'eklenti'      Chrome eklentisi. ZIP indir, klasöre çıkar,
 *                       chrome://extensions, geliştirici modu, klasörü seç.
 *   tur: 'yerImi'       Yer imi (bookmarklet). Tek satırlık kod; kurulumu
 *                       düğmeyi yer işaretleri çubuğuna sürüklemek.
 *
 * GÖRSELLER
 * Ekran görüntüsü değil, satır içi SVG. Her sahne Windows ve Chrome'un
 * gerçek yerleşimini taklit eder; her adımda bir fare imleci hareketi
 * yapar, böylece kullanıcı nereye tıklayacağını tarif okumadan görür.
 * Çizim olmasının sebebi: her çözünürlükte net kalması, birkaç KB tutması,
 * Chrome arayüzü değişince eskimemesi ve yalnızca o adımda bakılacak
 * parçayı göstermesi.
 *
 * KAYMA YOK
 * Çizim kutusunun oranı sabit (320x180), metin alanının en az yüksekliği
 * sabit. Adımlar arası geçişte panel boyu değişmez. Tüm hareket SVG'nin
 * kendi koordinat sisteminde olur; sayfa yerleşimine dokunmaz. Animasyon
 * yalnızca görünen adımda tanımlıdır, gizli adımlar boya üretmez.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var ZIP_KOKU = '../eklentiler/';

    // ==================================================================
    // Kayıtlar
    // ==================================================================

    var KAYITLAR = {
        topluKopyalama: {
            tur: 'eklenti',
            ad: 'Toplu Kopyalama',
            site: 'warehouse.getir.com',
            dosya: 'Jet Barkod - Toplu Kopyalama',
            ikon: '../assets/eklenti/toplu-kopyalama.png',
            ozet: 'Warehouse listelerindeki ürünleri tek tıkla kopyalar, Jet Barkod bunları barkoda ve görsele çözer.',
            neYapar: [
                'Listenin tamamını tek tıkla panoya alır, satır satır seçmeye gerek kalmaz.',
                'Panodakini arama kutusuna yapıştırınca barkodlar ve görseller çözülür.',
                'Sayfa yenilense bile kendini yeniden kurar, düğme kaybolmaz.',
            ],
        },

        stokBarkodlari: {
            tur: 'eklenti',
            ad: 'Stok Barkodları',
            site: 'franchise.getir.com',
            dosya: 'Jet Barkod - Stok Barkodları',
            ikon: '../assets/eklenti/stok-barkodlari.png',
            ozet: 'Franchise stok sayfasındaki görsel adreslerini, satır sırasını bozmadan kopyalar.',
            neYapar: [
                'Tablodaki her ürünün görsel adresini sırayla toplar.',
                'Sıra korunduğu için eşleştirme şaşmaz.',
                'Kopyalanan liste doğrudan arama kutusuna yapıştırılır.',
            ],
        },

        stokSenkron: {
            tur: 'eklenti',
            ad: 'Sayım Hazırlığı',
            site: 'franchise.getir.com',
            dosya: 'Jet Barkod - Sayım Hazırlığı',
            ikon: '../assets/eklenti/sayim-hazirligi.png',
            ozet: 'Sayım tablosunu ürünle doldurmanın hızlı yolu. Stok sayfasından toplu seçim yapar.',
            neYapar: [
                'Franchise stok sayfasında istediğin ürünleri toplu işaretlersin.',
                'Kategori kategori seçebilirsin, yüzlerce ürünü tek seferde alırsın.',
                'Sayım sayfasındaki panodan yapıştır düğmesiyle tabloya iner.',
            ],
        },

        siparisUrunArama: {
            tur: 'eklenti',
            ad: 'Sipariş İçi Ürün Arama',
            site: 'warehouse.getir.com',
            dosya: 'Jet Barkod - Sipariş İçi Ürün Arama',
            ikon: null,
            ozet: 'Aktif siparişleri tarar, aradığın ürün hangi siparişteyse o kartı renklendirir.',
            neYapar: [
                'Sipariş sayfasına bir arama çubuğu ekler.',
                'Ürünü arayınca içinde o ürün geçen siparişlerin kartları renklenir.',
                'Hangi siparişe gideceğini listeyi tek tek açmadan görürsün.',
            ],
        },

        /*
         * Tek eklenti denemesi. Eskilerin hepsi yerinde duruyor; bu onların
         * yerine geçmeye aday, henüz değil. Aynı anda ikisi kuruluysa
         * warehouse sayfasında iki kopyalama düğmesi çıkar, beklenen davranış.
         */
        jetBarkodAsistan: {
            tur: 'eklenti',
            asistan: true,
            ad: 'Jet Barkod Asistan',
            site: 'warehouse.getir.com',
            dosya: 'Jet Barkod - Asistan',
            ikon: null,
            ozet: 'Bütün araçlar tek eklentide. Yedi modül içinde: kopyalama, sayım, arama, fırın, stok uyarısı.',
            neYapar: [
                'Beş ayrı eklenti yerine tek kurulum, tek güncelleme.',
                'Fırın Pişirme artık yer imi değil, sayfaya düğme koyuyor.',
                'Sayfada tek düğme var; hangi modülün çalıştığını oradan görürsün.',
                'Bir modül hata verse diğerleri çalışmaya devam eder.',
                'Hakkın olmayan modül hiç başlamaz, kilit gerçekten işler.',
            ],
        },

        firinPisirme: {
            tur: 'yerImi',
            ad: 'Fırın Pişirme',
            site: 'getir.com fırın sekmesi',
            kaynak: '../eklentiler/firin-pisirme.js',
            ozet: 'Fırın sekmesindeki pişirme akışını tek ekranda toplar. Kurulum gerektirmez, yer işaretlerine sürüklersin.',
            neYapar: [
                'Fırın sayfasındayken yer işaretine basınca pişirme paneli açılır.',
                'Ne kadar pişireceğini hesaplar, ekmek uyarılarını ayrı tutar.',
                'Chrome eklentisi değil, tek satırlık bir yer imi. Kaldırmak istersen yer işaretinden silmen yeter.',
            ],
        },
    };

    // ==================================================================
    // Çizim parçaları
    // ==================================================================

    /** Windows fare imleci. cls ile hareket sınıfı verilir. */
    function fare(cls, x, y) {
        return '<g class="er-fare ' + (cls || '') + '" transform="translate(' + x + ',' + y + ')">' +
            '<path d="M0 0 L0 15 L4 11.6 L6.4 16.6 L8.8 15.5 L6.4 10.7 L11 10.7 Z" ' +
            'fill="#fff" stroke="#0f172a" stroke-width="1.2" stroke-linejoin="round"/></g>';
    }

    /**
     * Chrome penceresi kabuğu (sekme şeridi + adres çubuğu).
     *
     * Gölge bir filtre değil, altta duran ikinci bir dikdörtgen. 4. ve 5.
     * adımda kabuk yakınlaştırılıyor; filtre olsaydı tarayıcı her karede
     * yeniden rasterize ederdi. Böyle bedava.
     */
    function chromeKabuk(adres) {
        return '<rect x="10" y="14" width="304" height="160" rx="9" class="c-golge"/>' +
            '<rect x="8" y="10" width="304" height="160" rx="8" class="c-pencere"/>' +
            '<path d="M8 18a8 8 0 018-8h288a8 8 0 018 8v14H8z" class="c-sekmeserit"/>' +
            '<circle cx="286" cy="17" r="1.9" class="c-nokta"/>' +
            '<circle cx="293" cy="17" r="1.9" class="c-nokta"/>' +
            '<circle cx="300" cy="17" r="1.9" class="c-nokta"/>' +
            '<path d="M20 32v-9a5 5 0 015-5h56a5 5 0 015 5v9z" class="c-sekme"/>' +
            '<circle cx="31" cy="25" r="3" class="c-favikon"/>' +
            '<rect x="39" y="22" width="36" height="5" rx="2.5" class="c-bos"/>' +
            '<rect x="94" y="22" width="44" height="5" rx="2.5" class="c-bos-soluk"/>' +
            '<path d="M24 44l-4 4 4 4" class="c-gezinti"/>' +
            '<path d="M34 44l4 4-4 4" class="c-gezinti c-gezinti--soluk"/>' +
            '<rect x="44" y="40" width="252" height="16" rx="8" class="c-adres"/>' +
            (adres ? '<text x="54" y="51" class="c-yazi c-yazi--mono">' + adres + '</text>' : '') +
            '<path d="M8 62h304" class="c-ince"/>';
    }

    /** Windows Gezgini penceresi kabuğu. */
    function gezginKabuk(baslik) {
        return '<rect x="10" y="14" width="304" height="160" rx="7" class="c-golge"/>' +
            '<rect x="8" y="10" width="304" height="160" rx="6" class="c-pencere"/>' +
            '<path d="M8 16a6 6 0 016-6h292a6 6 0 016 6v18H8z" class="c-baslikserit"/>' +
            '<path d="M19 18h5.4l1.7 2.1h7.9a1.4 1.4 0 011.4 1.4v5.1a1.4 1.4 0 01-1.4 1.4H19a1.4 1.4 0 01-1.4-1.4v-7.2A1.4 1.4 0 0119 18z" class="c-klasor"/>' +
            '<text x="42" y="27" class="c-yazi c-yazi--kalin">' + baslik + '</text>' +
            // Küçült, büyüt, kapat. Sağdan sola gerçek sırasıyla.
            '<path d="M277 22h8M291 18h8v8h-8zM304 19l6 6m0-6l-6 6" class="c-pencere-dugme"/>' +
            '<rect x="16" y="40" width="288" height="14" rx="3" class="c-adres"/>' +
            '<text x="26" y="50" class="c-yazi">Bu bilgisayar › İndirilenler</text>';
    }

    /** Dosya satırı (Gezgin ve dosya seçici için ortak). */
    function dosyaSatiri(y, ad, tur, cls) {
        var ikon = tur === 'klasor'
            ? '<path d="M28 ' + (y + 3) + 'h9l3 3.5h13a2.5 2.5 0 012.5 2.5v8a2.5 2.5 0 01-2.5 2.5H28a2.5 2.5 0 01-2.5-2.5v-11A2.5 2.5 0 0128 ' + (y + 3) + 'z" class="c-klasor"/>'
            : '<path d="M28 ' + (y + 2) + 'h13l7 7v11a2 2 0 01-2 2H28a2 2 0 01-2-2v-16a2 2 0 012-2z" class="c-zip"/>' +
              '<path d="M34 ' + (y + 6) + 'h4v3h-4zM34 ' + (y + 11) + 'h4v3h-4z" class="c-zip-dis"/>';
        return '<g class="' + (cls || '') + '">' + ikon +
            '<text x="62" y="' + (y + 14) + '" class="c-yazi">' + ad + '</text></g>';
    }

    function kisalt(m, n) {
        m = String(m);
        return m.length > n ? m.slice(0, n - 1) + '…' : m;
    }

    // ==================================================================
    // Sahneler: Chrome eklentisi kurulumu
    // ==================================================================

    function sahneler(k) {
        var zipAdi = kisalt(k.dosya + '.zip', 30);
        var klasorAdi = kisalt(k.dosya, 30);

        return [
            // ---------- 1. ZIP indir ----------
            {
                baslik: 'ZIP dosyasını indir',
                metin: 'Aşağıdaki düğmeye bas. Dosya <b>İndirilenler</b> klasörüne inecek.',
                indirme: true,
                sahne:
                    chromeKabuk('jetbarkod.com.tr') +
                    '<rect x="96" y="86" width="128" height="26" rx="6" class="c-vurgu-dolgu s-dugme"/>' +
                    '<text x="118" y="102" class="c-yazi c-yazi--ters">ZIP indir</text>' +
                    '<g class="s-indirme-cubugu">' +
                    '  <rect x="8" y="146" width="304" height="24" class="c-indirme"/>' +
                    '  <rect x="18" y="152" width="12" height="12" rx="2" class="c-zip"/>' +
                    '  <text x="38" y="162" class="c-yazi">' + zipAdi + '</text>' +
                    '</g>' +
                    fare('s-fare-tikla', 152, 96),
            },

            // ---------- 2. Klasöre çıkar (Windows) ----------
            {
                baslik: 'Sağ tıkla, klasöre çıkar',
                metin: 'İndirilenler klasöründeki ZIP dosyasına <b>sağ tıkla</b>, açılan listeden <b>Tümünü Ayıkla</b> seç. Yanında aynı adda bir klasör oluşacak.',
                sahne:
                    gezginKabuk('İndirilenler') +
                    dosyaSatiri(62, zipAdi, 'zip', 's-zip') +
                    '<rect x="20" y="62" width="130" height="22" rx="3" class="c-secili s-secim"/>' +
                    dosyaSatiri(62, zipAdi, 'zip', 's-zip-ust') +
                    // Windows sağ tık menüsü
                    '<g class="s-menu">' +
                    '  <rect x="96" y="82" width="126" height="76" rx="5" class="c-menu"/>' +
                    '  <text x="108" y="96" class="c-yazi">Aç</text>' +
                    '  <path d="M100 102h118" class="c-ince"/>' +
                    '  <rect x="99" y="106" width="120" height="17" rx="3" class="c-vurgu-soft s-menu-sec"/>' +
                    '  <text x="108" y="118" class="c-yazi c-yazi--kalin">Tümünü Ayıkla...</text>' +
                    '  <text x="108" y="136" class="c-yazi">Kopyala</text>' +
                    '  <text x="108" y="152" class="c-yazi">Kısayol oluştur</text>' +
                    '</g>' +
                    // Sonuçta oluşan klasör
                    '<g class="s-yeni-klasor">' +
                    dosyaSatiri(92, klasorAdi, 'klasor', '') +
                    '</g>' +
                    fare('s-fare-sagtik', 110, 70),
            },

            // ---------- 3. chrome://extensions ----------
            {
                baslik: 'Chrome eklenti sayfasını aç',
                metin: 'Adres çubuğuna <b>chrome://extensions</b> yaz ve Enter\'a bas. Aşağıdaki düğmeyle kopyalayıp yapıştırabilirsin.',
                kopyala: 'chrome://extensions',
                sahne:
                    chromeKabuk('') +
                    '<text x="54" y="51" class="c-yazi c-yazi--mono s-yazi-cikar">chrome://extensions</text>' +
                    '<rect class="s-imlec" x="147" y="43" width="1.5" height="10"/>' +
                    '<rect x="16" y="76" width="288" height="86" rx="6" class="c-bos"/>' +
                    '<text x="120" y="122" class="c-yazi c-yazi--soluk">Enter</text>' +
                    fare('s-fare-adres', 160, 44),
            },

            // ---------- 4. Geliştirici modu ----------
            {
                baslik: 'Geliştirici modunu aç',
                metin: 'Eklentiler sayfasının <b>sağ üst</b> köşesindeki anahtarı aç.',
                sahne:
                    '<g class="s-zoom-4">' +
                    chromeKabuk('chrome://extensions') +
                    '  <text x="20" y="80" class="c-yazi c-yazi--kalin">Eklentiler</text>' +
                    '  <text x="214" y="80" class="c-yazi">Geliştirici modu</text>' +
                    '  <g class="s-anahtar">' +
                    '    <rect x="278" y="71" width="24" height="12" rx="6" class="c-anahtar-yol"/>' +
                    '    <circle cx="284" cy="77" r="4.6" class="c-anahtar-top"/>' +
                    '  </g>' +
                    '  <rect x="16" y="94" width="288" height="30" rx="5" class="c-bos"/>' +
                    '  <rect x="16" y="130" width="288" height="30" rx="5" class="c-bos"/>' +
                    '</g>' +
                    fare('s-fare-anahtar', 290, 84),
            },

            // ---------- 5. Paketlenmemiş öğe yükle ----------
            {
                baslik: 'Paketlenmemiş öğe yükle',
                metin: 'Geliştirici modu açılınca üstte üç düğme belirir. <b>Soldaki</b> düğmeye bas.',
                sahne:
                    '<g class="s-zoom-5">' +
                    chromeKabuk('chrome://extensions') +
                    '  <g class="s-dugmeler">' +
                    '    <rect x="18" y="70" width="98" height="18" rx="9" class="c-vurgu-soft s-hedef"/>' +
                    '    <text x="27" y="82" class="c-yazi c-yazi--vurgu">Paketlenmemiş yükle</text>' +
                    '    <rect x="122" y="70" width="56" height="18" rx="9" class="c-bos"/>' +
                    '    <rect x="184" y="70" width="52" height="18" rx="9" class="c-bos"/>' +
                    '  </g>' +
                    // Açık kalan anahtar düğmelerle aynı satırda. Adres çubuğunun
                    // hizasındayken adresin üstüne biniyordu.
                    '  <text x="212" y="83" class="c-yazi c-yazi--soluk">Geliştirici modu</text>' +
                    '  <rect x="278" y="73" width="24" height="12" rx="6" class="c-anahtar-acik"/>' +
                    '  <circle cx="296" cy="79" r="4.6" class="c-anahtar-top"/>' +
                    '  <rect x="16" y="98" width="288" height="30" rx="5" class="c-bos"/>' +
                    '  <rect x="16" y="134" width="288" height="26" rx="5" class="c-bos"/>' +
                    '</g>' +
                    '<circle class="s-dalga" cx="67" cy="79" r="14"/>' +
                    fare('s-fare-yukle', 74, 86),
            },

            // ---------- 6. Klasörü seç ----------
            {
                baslik: 'Klasörü seç, ZIP\'i değil',
                metin: 'Açılan pencerede <b>' + klasorAdi + '</b> klasörünü seç. ZIP dosyası burada seçilemez.',
                sahne:
                    gezginKabuk('Klasör Seç') +
                    dosyaSatiri(64, zipAdi, 'zip', 'c-devredisi') +
                    '<rect x="20" y="90" width="272" height="22" rx="3" class="c-secili s-klasor-secim"/>' +
                    dosyaSatiri(90, klasorAdi, 'klasor', '') +
                    '<rect x="196" y="140" width="46" height="20" rx="4" class="c-bos"/>' +
                    '<text x="205" y="154" class="c-yazi c-yazi--soluk">İptal</text>' +
                    '<rect x="248" y="140" width="56" height="20" rx="4" class="c-vurgu-dolgu"/>' +
                    '<text x="258" y="154" class="c-yazi c-yazi--ters">Klasör Seç</text>' +
                    fare('s-fare-klasor', 140, 98),
            },

            // ---------- 7. Hazır ----------
            {
                baslik: 'Kurulum tamam',
                metin: 'Eklenti listede görünüyor. Artık <b>' + k.site + '</b> adresine gittiğinde kendiliğinden çalışır.',
                sahne:
                    chromeKabuk('chrome://extensions') +
                    '<g class="s-kart">' +
                    '  <rect x="46" y="76" width="228" height="72" rx="8" class="c-kart"/>' +
                    (k.ikon
                        ? '  <image href="' + k.ikon + '" x="62" y="92" width="34" height="34"/>'
                        : '  <rect x="62" y="92" width="34" height="34" rx="8" class="c-vurgu-soft"/>') +
                    '  <text x="108" y="104" class="c-yazi c-yazi--kalin">' + kisalt(k.ad, 26) + '</text>' +
                    '  <text x="108" y="118" class="c-yazi c-yazi--soluk">Jet Barkod</text>' +
                    '  <rect x="234" y="126" width="24" height="12" rx="6" class="c-anahtar-acik"/>' +
                    '  <circle cx="252" cy="132" r="4.6" class="c-anahtar-top"/>' +
                    '</g>' +
                    '<g class="s-tik">' +
                    '  <circle cx="256" cy="84" r="13" class="c-tam-dolgu"/>' +
                    '  <path d="M249 84l5 5 9-9" class="c-tik"/>' +
                    '</g>',
            },
        ];
    }

    // ==================================================================
    // Sahneler: yer imi kurulumu
    // ==================================================================

    function yerImiSahneleri(k) {
        return [
            {
                baslik: 'Yer işaretleri çubuğunu aç',
                metin: 'Çubuk kapalıysa klavyeden <b>Ctrl + Shift + B</b> tuşlarına bas. Adres çubuğunun altında ince bir şerit belirecek.',
                sahne:
                    chromeKabuk('warehouse.getir.com') +
                    '<g class="s-yerimi-serit">' +
                    '  <rect x="8" y="62" width="304" height="18" class="c-yerimi-serit"/>' +
                    '  <rect x="20" y="67" width="42" height="9" rx="2" class="c-bos"/>' +
                    '  <rect x="70" y="67" width="34" height="9" rx="2" class="c-bos"/>' +
                    '</g>' +
                    '<rect x="16" y="92" width="288" height="66" rx="6" class="c-bos"/>' +
                    '<g class="s-kisayol">' +
                    '  <rect x="96" y="112" width="130" height="24" rx="5" class="c-tus"/>' +
                    '  <text x="112" y="128" class="c-yazi c-yazi--kalin">Ctrl + Shift + B</text>' +
                    '</g>',
            },
            {
                baslik: 'Düğmeyi çubuğa sürükle',
                metin: 'Aşağıdaki <b>Fırın Pişirme</b> düğmesini fareyle basılı tut ve yer işaretleri çubuğuna bırak.',
                surukle: true,
                sahne:
                    chromeKabuk('warehouse.getir.com') +
                    '<rect x="8" y="62" width="304" height="18" class="c-yerimi-serit"/>' +
                    '<rect x="20" y="67" width="42" height="9" rx="2" class="c-bos"/>' +
                    '<rect x="70" y="67" width="34" height="9" rx="2" class="c-bos"/>' +
                    '<rect x="112" y="66" width="2" height="11" rx="1" class="c-vurgu-dolgu s-birakma-yeri"/>' +
                    '<g class="s-surukle">' +
                    '  <rect x="118" y="118" width="86" height="22" rx="6" class="c-vurgu-dolgu"/>' +
                    '  <text x="130" y="133" class="c-yazi c-yazi--ters">Fırın Pişirme</text>' +
                    '</g>' +
                    fare('s-fare-surukle', 206, 128),
            },
            {
                baslik: 'Fırın sayfasına git',
                metin: 'Getir panelinde <b>fırın</b> sekmesini aç. Yer imi yalnızca o sayfada iş görür.',
                sahne:
                    chromeKabuk('warehouse.getir.com') +
                    '<rect x="8" y="62" width="304" height="18" class="c-yerimi-serit"/>' +
                    '<rect x="20" y="67" width="42" height="9" rx="2" class="c-bos"/>' +
                    '<g class="s-yerimi-kurulu">' +
                    '  <rect x="70" y="66" width="58" height="11" rx="2" class="c-vurgu-soft"/>' +
                    '  <text x="76" y="75" class="c-yazi c-yazi--kucuk">Fırın Pişirme</text>' +
                    '</g>' +
                    '<g class="s-sekmeler">' +
                    '  <rect x="20" y="92" width="52" height="18" rx="9" class="c-bos"/>' +
                    '  <rect x="78" y="92" width="46" height="18" rx="9" class="c-vurgu-soft s-hedef"/>' +
                    '  <text x="92" y="104" class="c-yazi c-yazi--vurgu">Fırın</text>' +
                    '  <rect x="130" y="92" width="52" height="18" rx="9" class="c-bos"/>' +
                    '</g>' +
                    '<rect x="16" y="120" width="288" height="40" rx="6" class="c-bos"/>' +
                    fare('s-fare-sekme', 108, 110),
            },
            {
                baslik: 'Yer imine bas',
                metin: 'Çubuktaki <b>Fırın Pişirme</b> düğmesine tıkla. Pişirme paneli sayfanın üstünde açılır.',
                sahne:
                    chromeKabuk('warehouse.getir.com') +
                    '<rect x="8" y="62" width="304" height="18" class="c-yerimi-serit"/>' +
                    '<rect x="20" y="67" width="42" height="9" rx="2" class="c-bos"/>' +
                    '<rect x="70" y="66" width="58" height="11" rx="2" class="c-vurgu-soft"/>' +
                    '<text x="76" y="75" class="c-yazi c-yazi--kucuk">Fırın Pişirme</text>' +
                    '<circle class="s-dalga" cx="99" cy="72" r="12"/>' +
                    '<g class="s-panel">' +
                    '  <rect x="52" y="92" width="216" height="70" rx="8" class="c-kart"/>' +
                    '  <text x="68" y="110" class="c-yazi c-yazi--kalin">Pişirme listesi</text>' +
                    '  <rect x="68" y="118" width="184" height="8" rx="4" class="c-bos"/>' +
                    '  <rect x="68" y="132" width="140" height="8" rx="4" class="c-bos"/>' +
                    '  <rect x="68" y="146" width="164" height="8" rx="4" class="c-bos"/>' +
                    '</g>' +
                    fare('s-fare-yerimi', 106, 80),
            },
        ];
    }

    // ==================================================================
    // Çizim
    // ==================================================================

    function kacir(m) {
        return String(m)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** <b> etiketine izin ver, gerisini kaçır. */
    function guvenli(m) {
        return kacir(m).replace(/&lt;(\/?)b&gt;/g, '<$1b>');
    }

    var IKON = {
        indir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>',
        kopya: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2"/></svg>',
        kilit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>',
        tik: '<svg class="er-nokta__tik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    };

    /**
     * Üstteki adım rayı: numaralı kareler, aralarında dolan çizgiler.
     *
     * Her kareye tıklanabilir, kullanıcı istediği adıma atlayabilir. Bu bir
     * form değil, anlatım; ileri gitmeden önce doldurulacak bir şey yok.
     *
     * Numara ile tik aynı kutuda üst üste duruyor, yalnızca görünürlükleri
     * değişiyor. Biri diğerinin yerini almadığı için ray hiçbir durumda
     * genişlik değiştirmez.
     */
    function ray(adimlar) {
        return adimlar.map(function (a, i) {
            return (i === 0 ? '' : '<span class="er-bag"><i></i></span>') +
                '<button type="button" class="er-nokta' + (i === 0 ? ' is-simdi' : '') + '"' +
                ' data-git="' + i + '" title="' + kacir(a.baslik) + '"' +
                ' aria-label="' + (i + 1) + '. adım. ' + kacir(a.baslik) + '">' +
                '<span class="er-nokta__no">' + (i + 1) + '</span>' + IKON.tik +
                '</button>';
        }).join('');
    }

    function ciz(kap, anahtar, kilitli) {
        var k = KAYITLAR[anahtar];
        if (!kap || !k) return false;

        var adimlar = k.tur === 'yerImi' ? yerImiSahneleri(k) : sahneler(k);

        var html =
            '<div class="er">' +
            '  <div class="er-tanitim">' +
            '    <p class="er-ozet">' + kacir(k.ozet) + '</p>' +
            '    <ul class="er-liste">' +
            k.neYapar.map(function (x) { return '<li>' + kacir(x) + '</li>'; }).join('') +
            '    </ul>' +
            '    <p class="er-site"><span>Çalıştığı yer</span><b>' + kacir(k.site) + '</b></p>' +
            (k.asistan ? '    <p class="er-durum" id="erAsistanDurum"><span class="er-durum__nokta"></span>' +
                         '<span>Kurulu mu diye bakılıyor...</span></p>' : '') +
            '  </div>';

        if (kilitli) {
            html +=
                '  <div class="er-kilit">' + IKON.kilit +
                '    <span>Bu araç hesabında kapalı. Açtırmak için yöneticine yaz.</span></div>';
        } else {
            html +=
                '  <div class="er-sihirbaz">' +
                '    <div class="er-ust">' +
                '      <div class="er-ust__satir">' +
                '        <span class="er-ust__etiket">' +
                (k.tur === 'yerImi' ? 'Yer imi kurulumu' : 'Eklenti kurulumu') + '</span>' +
                '        <span class="er-sayac" id="erSayac">1 / ' + adimlar.length + '</span>' +
                '      </div>' +
                '      <div class="er-ray" id="erRay">' + ray(adimlar) + '</div>' +
                '    </div>' +
                '    <div class="er-adimlar is-ileri" id="erAdimlar">' +
                adimlar.map(function (a, i) {
                    var ek = '';
                    if (a.indirme) {
                        ek = '<a class="er-eylem" href="' + ZIP_KOKU + encodeURIComponent(k.dosya + '.zip') + '" download>' +
                             IKON.indir + '<span>' + kacir(k.dosya) + '.zip</span></a>';
                    } else if (a.kopyala) {
                        ek = '<button type="button" class="er-eylem er-eylem--ikincil" data-kopya="' + a.kopyala + '">' +
                             IKON.kopya + '<span>' + kacir(a.kopyala) + '</span></button>';
                    } else if (a.surukle) {
                        ek = '<a class="er-yerimi" id="erYerImi" href="#" draggable="true" ' +
                             'title="Bu düğmeyi yer işaretleri çubuğuna sürükle">' +
                             '<span class="er-yerimi__nokta"></span>Fırın Pişirme</a>' +
                             '<p class="er-ipucu">Tıklamak işe yaramaz, sürüklemen gerekiyor.</p>';
                    }
                    return '<section class="er-adim' + (i === 0 ? ' is-aktif' : '') + '" data-adim="' + i + '">' +
                        '<div class="er-gorsel"><svg class="er-sahne" viewBox="0 0 320 180" role="img" aria-hidden="true">' +
                        a.sahne + '</svg></div>' +
                        '<h4 class="er-baslik">' + kacir(a.baslik) + '</h4>' +
                        '<p class="er-metin">' + guvenli(a.metin) + '</p>' +
                        // Eylem alanı her adımda var, boşken bile yer kaplar.
                        // Yoksa düğmesi olan adımda panel 35px uzayıp
                        // geçişte zıplıyordu.
                        '<div class="er-eylem-alani">' + ek + '</div>' +
                        '</section>';
                }).join('') +
                '    </div>' +
                '    <div class="er-alt">' +
                '      <button type="button" class="er-btn" id="erGeri" disabled>Geri</button>' +
                '      <button type="button" class="er-btn er-btn--ana" id="erIleri">İleri</button>' +
                '    </div>' +
                '  </div>';
        }

        html += '</div>';
        kap.innerHTML = html;

        if (!kilitli) {
            bagla(kap, adimlar.length);
            if (k.tur === 'yerImi') yerIminiHazirla(kap, k);
        }
        if (k.asistan) asistanDurumu(kap);
        return true;
    }

    function bagla(kap, toplam) {
        var sihirbaz = kap.querySelector('.er-sihirbaz');
        var kutu = kap.querySelector('#erAdimlar');
        var adimlar = kap.querySelectorAll('.er-adim');
        var noktalar = kap.querySelectorAll('.er-nokta');
        var baglar = kap.querySelectorAll('.er-bag');
        var geri = kap.querySelector('#erGeri');
        var ileri = kap.querySelector('#erIleri');
        var sayac = kap.querySelector('#erSayac');
        var simdi = -1;

        function goster(yeni) {
            if (yeni < 0 || yeni >= toplam || yeni === simdi) return;

            /*
             * Yön sınıfı adım açılmadan ÖNCE kutuya yazılıyor: giren adım
             * hangi taraftan süzüleceğini böyle öğreniyor. Çıkan adım
             * animasyon yapmaz, doğrudan display:none olur. İki adım aynı
             * anda yer kaplamadığı için panelin boyu asla oynamaz.
             *
             * Sınıflar tek seferde ve anında kuruluyor. Önce "kaldır, bir
             * kare sonra ekle" deniyordu; iki tıklama arka arkaya gelince
             * aynı anda iki adım açık kalıyordu.
             */
            kutu.classList.toggle('is-geri', yeni < simdi);
            kutu.classList.toggle('is-ileri', yeni > simdi);
            simdi = yeni;

            for (var i = 0; i < adimlar.length; i++) {
                adimlar[i].classList.toggle('is-aktif', i === simdi);
            }
            for (var j = 0; j < noktalar.length; j++) {
                noktalar[j].classList.toggle('is-simdi', j === simdi);
                noktalar[j].classList.toggle('is-bitti', j < simdi);
                noktalar[j].setAttribute('aria-current', j === simdi ? 'step' : 'false');
            }
            // baglar[b], b ile b+1 arasındaki çizgi. b'yi geçtiysek dolu.
            for (var b = 0; b < baglar.length; b++) {
                baglar[b].classList.toggle('is-dolu', b < simdi);
            }

            sayac.textContent = (simdi + 1) + ' / ' + toplam;
            geri.disabled = simdi === 0;
            ileri.textContent = simdi === toplam - 1 ? 'Bitir' : 'İleri';
            ileri.classList.toggle('er-btn--bitir', simdi === toplam - 1);
        }

        for (var n = 0; n < noktalar.length; n++) {
            noktalar[n].addEventListener('click', function () {
                goster(Number(this.dataset.git));
            });
        }

        geri.addEventListener('click', function () { goster(simdi - 1); });
        ileri.addEventListener('click', function () {
            if (simdi === toplam - 1) {
                var kapat = document.getElementById('closeFeatureDetailModal');
                if (kapat) kapat.click();
                return;
            }
            goster(simdi + 1);
        });

        /*
         * Ok tuşlarıyla gezinme. Dinleyici belgeye bağlı ama dört kapıdan
         * geçiyor: sihirbaz DOM'dan çıktıysa kendini siler, modal kapalıysa
         * (offsetParent yok) hiç karışmaz, bir yazı alanındaysan tuş sana
         * kalır, değiştirici tuş basılıysa tarayıcının kısayolu bozulmaz.
         */
        function tus(e) {
            if (!document.body.contains(sihirbaz)) {
                document.removeEventListener('keydown', tus);
                return;
            }
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (!sihirbaz.offsetParent) return;
            var h = e.target;
            if (h && (h.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(h.tagName))) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); goster(simdi + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); goster(simdi - 1); }
        }
        // Panel her açılışta yeniden çiziliyor; önceki dinleyici burada gider.
        if (global.__erTus) document.removeEventListener('keydown', global.__erTus);
        global.__erTus = tus;
        document.addEventListener('keydown', tus);

        // Kopyala düğmeleri
        kap.querySelectorAll('[data-kopya]').forEach(function (b) {
            b.addEventListener('click', function () {
                var s = b.querySelector('span');
                var eski = s.textContent;
                navigator.clipboard.writeText(b.dataset.kopya).then(
                    function () { s.textContent = 'Kopyalandı'; },
                    function () { s.textContent = 'Kopyalanamadı'; }
                );
                setTimeout(function () { s.textContent = eski; }, 1600);
            });
        });

        goster(0);
    }

    /**
     * Yer imi düğmesini kullanılabilir hâle getirir.
     *
     * Bookmarklet kodu ayrı bir dosyada duruyor ve `href`'e çalışma anında
     * yazılıyor. 54 KB'lık kodu her sayfa yüklemesinde HTML'e gömmek yerine
     * yalnızca panel açılınca çekiliyor.
     */
    function yerIminiHazirla(kap, k) {
        var a = kap.querySelector('#erYerImi');
        if (!a || !k.kaynak) return;

        fetch(k.kaynak)
            .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
            .then(function (kod) {
                a.setAttribute('href', kod.trim());
                a.classList.add('is-hazir');
            })
            .catch(function () {
                a.classList.add('is-hatali');
                a.textContent = 'Kod yüklenemedi';
            });

        // Tıklamak bir şey yapmaz; sürüklemesi gerektiğini söyle
        a.addEventListener('click', function (e) {
            e.preventDefault();
            a.classList.add('er-yerimi--sars');
            setTimeout(function () { a.classList.remove('er-yerimi--sars'); }, 500);
        });
    }

    /**
     * Asistan kurulu mu, satırı canlı tutar. Eklenti sayfaya selam
     * gönderince köprü haber veriyor; iki saniye ses çıkmazsa kurulu değil.
     */
    function asistanDurumu(kap) {
        var satir = kap.querySelector('#erAsistanDurum');
        if (!satir) return;
        var yazi = satir.querySelector('span:last-child');

        function yaz(d) {
            if (!kap.contains(satir)) return;
            satir.classList.toggle('is-kurulu', !!d.kurulu);
            yazi.textContent = d.kurulu
                ? 'Kurulu. Sürüm ' + (d.surum || '?')
                : 'Henüz kurulu değil. Aşağıdaki adımları izle.';
        }

        var koprü = global.JetBarkodAsistan;
        if (!koprü) return yaz({ kurulu: false });
        koprü.dinle(yaz);
        koprü.sor();
        setTimeout(function () { if (!koprü.durum.kurulu) yaz(koprü.durum); }, 2000);
    }

    global.EklentiRehberi = { KAYITLAR: KAYITLAR, ciz: ciz };
})(typeof window !== 'undefined' ? window : globalThis);
