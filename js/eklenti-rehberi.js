/**
 * Jet Barkod — Chrome eklentileri: tanıtım + kurulum sihirbazı
 * ============================================================================
 *
 * Ayarlar > Özellikler'de bir eklentiye dokununca açılan panelin içeriğini
 * üretir: önce "bu ne işe yarar", sonra adım adım kurulum.
 *
 * ---------------------------------------------------------------------------
 * NEDEN TEK SİHİRBAZ
 * ---------------------------------------------------------------------------
 * Beş eklentinin de kurulumu birebir aynı: ZIP indir → çıkar → chrome://
 * extensions → geliştirici modu → paketlenmemiş öğe yükle → klasörü seç.
 * Her eklentiye ayrı anlatım yazmak beş kat bakım demekti; adımlar ortak,
 * yalnızca dosya adı, klasör adı ve "hangi sitede çalışır" değişiyor.
 *
 * ---------------------------------------------------------------------------
 * GÖRSELLER
 * ---------------------------------------------------------------------------
 * Ekran görüntüsü değil, çizim (satır içi SVG). Sebebi: her ekran
 * çözünürlüğünde net, toplam birkaç KB, Chrome arayüzü değişince eskimiyor
 * ve yalnızca o adımda bakılması gereken parçayı gösteriyor — gerçek bir
 * ekran görüntüsündeki kalabalık yok.
 *
 * ---------------------------------------------------------------------------
 * PERFORMANS
 * ---------------------------------------------------------------------------
 * Aynı anda yalnızca TEK adım görünür ve animasyon yalnızca görünen adımda
 * çalışır (`.is-aktif` altında tanımlı). Gizli adımlarda animasyon yok, boya
 * yok. Yalnızca `opacity` ve `transform` animate edilir — ikisi de
 * compositor'da çalışır, ana iş parçacığını meşgul etmez.
 * `prefers-reduced-motion` açıksa tüm hareket kapanır.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ==================================================================
    // Eklenti kayıtları
    // ==================================================================

    var KAYITLAR = {
        topluKopyalama: {
            ad: 'Toplu Kopyalama',
            emoji: '📦',
            site: 'warehouse.getir.com',
            ozet: 'Warehouse listelerindeki ürünleri tek tıkla kopyalar; Jet Barkod bunları barkod ve görsele çözer.',
            neYapar: [
                'Ürün listesinin tamamını tek tıkla panoya alır — satır satır seçmek yok.',
                'Panodakini Jet Barkod arama kutusuna yapıştırınca barkodlar ve görseller çözülür.',
                'Sayfa yenilense bile kendini yeniden kurar, düğme kaybolmaz.',
            ],
            zip: 'getir-warehouse-html-copy-extension.zip',
            klasor: 'getir-warehouse-html-copy-extension',
        },

        stokBarkodlari: {
            ad: 'Getir Stok Barkodları',
            emoji: '🧩',
            site: 'franchise.getir.com',
            ozet: 'Franchise stok sayfasındaki görsel adreslerini, satırların sırasını bozmadan kopyalar.',
            neYapar: [
                'Stok tablosundaki her ürünün görsel adresini sırayla toplar.',
                'Sıra korunduğu için Jet Barkod eşleştirmeyi şaşırmaz.',
                'Kopyalanan liste doğrudan arama kutusuna yapıştırılır.',
            ],
            zip: 'getir-stock-barcodes-extension.zip',
            klasor: 'getir-stock-barcodes-extension',
        },

        stokSenkron: {
            ad: 'Sayım Hazırlığı',
            emoji: '🔄',
            site: 'franchise.getir.com',
            ozet: 'Sayım tablosunu ürünle doldurmanın hızlı yolu: stok sayfasından toplu seçim.',
            neYapar: [
                'Franchise stok sayfasında istediğin ürünleri toplu işaretlersin.',
                'Kategori kategori seçebilirsin — yüzlerce ürünü tek seferde alırsın.',
                'Sayım sayfasındaki “panodan yapıştır” düğmesiyle tabloya iner.',
            ],
            zip: 'getir-stock-sync-extension.zip',
            klasor: 'getir-stock-sync-extension',
        },

        siparisUrunArama: {
            ad: 'Sipariş İçi Ürün Arama',
            emoji: '🔎',
            site: 'warehouse.getir.com',
            ozet: 'Aktif siparişleri tarar; aradığın ürün hangi siparişteyse o kartı renklendirir.',
            neYapar: [
                'Sipariş sayfasına bir arama çubuğu ekler.',
                'Ürünü arayınca içinde o ürün geçen siparişlerin kartları renklenir.',
                'Hangi siparişe koşacağını listeyi tek tek açmadan görürsün.',
            ],
            zip: 'getir-warehouse-orders-search-extension.zip',
            klasor: 'getir-warehouse-orders-search-extension',
        },

        firinPisirme: {
            ad: 'Fırın Pişirme',
            emoji: '🔥',
            site: 'warehouse.getir.com',
            ozet: 'Fırın sekmesindeki pişirme akışını tek ekrana toplar.',
            neYapar: [
                'Fırın sekmesi açıldığında pişirme işini tek yerden yönetirsin.',
                'Jet Barkod’dan bağımsız çalışır; ayrı bir hesap ya da kurulum istemez.',
            ],
            zip: null,           // dosya henüz repoda yok
            klasor: 'getir-firin-pisirme-extension',
            yakinda: true,
        },
    };

    // ==================================================================
    // Çizimler — her adımın SVG'si
    // ------------------------------------------------------------------
    // Ortak dil: 320x150 tuval, ince çizgi, tek vurgu rengi.
    // Hareketli parçalar `.hr-*` sınıfını taşır; animasyonları CSS'te
    // yalnızca aktif adım altında tanımlıdır.
    // ==================================================================

    function tuval(ic) {
        return '<svg class="er-cizim" viewBox="0 0 320 150" role="img" aria-hidden="true">' + ic + '</svg>';
    }

    var pencere =
        '<rect x="34" y="16" width="252" height="118" rx="10" class="er-kutu"/>' +
        '<path d="M34 42h252" class="er-cizgi"/>' +
        '<circle cx="50" cy="29" r="3.5" class="er-nokta"/>' +
        '<circle cx="62" cy="29" r="3.5" class="er-nokta"/>' +
        '<circle cx="74" cy="29" r="3.5" class="er-nokta"/>';

    var CIZIMLER = {
        indir: tuval(
            pencere +
            '<rect x="96" y="60" width="60" height="52" rx="6" class="er-dolgu-soft"/>' +
            '<path d="M108 74h36M108 84h36M108 94h22" class="er-cizgi-ince"/>' +
            '<g class="hr-indir">' +
            '  <path d="M212 62v34" class="er-vurgu-cizgi"/>' +
            '  <path d="M200 86l12 12 12-12" class="er-vurgu-cizgi"/>' +
            '</g>' +
            '<path d="M192 110h40" class="er-vurgu-cizgi"/>'
        ),

        cikar: tuval(
            '<g class="hr-zip">' +
            '  <rect x="44" y="42" width="72" height="66" rx="8" class="er-kutu"/>' +
            '  <path d="M80 42v66" class="er-cizgi-ince"/>' +
            '  <rect x="74" y="52" width="12" height="9" rx="2" class="er-dolgu"/>' +
            '  <rect x="74" y="68" width="12" height="9" rx="2" class="er-dolgu"/>' +
            '</g>' +
            '<path d="M132 75h44" class="er-vurgu-cizgi hr-ok"/>' +
            '<path d="M166 65l12 10-12 10" class="er-vurgu-cizgi hr-ok"/>' +
            '<g class="hr-klasor">' +
            '  <path d="M196 52h30l8 10h42a6 6 0 016 6v40a6 6 0 01-6 6h-80a6 6 0 01-6-6V58a6 6 0 016-6z" class="er-kutu"/>' +
            '  <path d="M214 84h44M214 96h30" class="er-cizgi-ince"/>' +
            '</g>'
        ),

        adres: tuval(
            pencere +
            '<rect x="52" y="56" width="216" height="26" rx="13" class="er-dolgu-soft"/>' +
            '<text x="70" y="73" class="er-yazi">chrome://extensions</text>' +
            '<rect class="hr-imlec" x="212" y="61" width="2" height="16" rx="1"/>' +
            '<path d="M52 102h120" class="er-cizgi-ince"/>'
        ),

        gelistirici: tuval(
            '<rect x="34" y="34" width="252" height="82" rx="10" class="er-kutu"/>' +
            '<text x="58" y="72" class="er-yazi er-yazi--lg">Geliştirici modu</text>' +
            '<g class="hr-anahtar">' +
            '  <rect x="206" y="60" width="48" height="26" rx="13" class="er-anahtar-yol"/>' +
            '  <circle cx="219" cy="73" r="9" class="er-anahtar-top"/>' +
            '</g>' +
            '<path d="M58 90h96" class="er-cizgi-ince"/>'
        ),

        yukle: tuval(
            '<rect x="34" y="26" width="252" height="98" rx="10" class="er-kutu"/>' +
            '<g class="hr-basma">' +
            '  <rect x="56" y="52" width="128" height="32" rx="8" class="er-vurgu-dolgu"/>' +
            '  <text x="72" y="72" class="er-yazi er-yazi--ters">Paketlenmemiş öğe yükle</text>' +
            '</g>' +
            '<circle class="hr-dalga" cx="120" cy="68" r="18"/>' +
            '<rect x="200" y="52" width="60" height="32" rx="8" class="er-dolgu-soft"/>' +
            '<path d="M56 100h180" class="er-cizgi-ince"/>'
        ),

        klasorSec: tuval(
            '<rect x="34" y="20" width="252" height="110" rx="10" class="er-kutu"/>' +
            '<path d="M34 46h252" class="er-cizgi"/>' +
            '<text x="52" y="38" class="er-yazi">Klasör seç</text>' +
            '<g class="hr-secim">' +
            '  <rect x="50" y="56" width="220" height="26" rx="6" class="er-vurgu-soft"/>' +
            '  <path d="M62 62h12l4 5h14a3 3 0 013 3v6a3 3 0 01-3 3H62a3 3 0 01-3-3V65a3 3 0 013-3z" class="er-vurgu-dolgu"/>' +
            '  <text x="104" y="73" class="er-yazi">getir-…-extension</text>' +
            '</g>' +
            '<rect x="50" y="90" width="220" height="20" rx="6" class="er-dolgu-soft"/>'
        ),

        hazir: tuval(
            '<rect x="76" y="34" width="168" height="82" rx="12" class="er-kutu"/>' +
            '<path d="M104 62h1" class="er-cizgi"/>' +
            '<g class="hr-parca">' +
            '  <path d="M108 58h16a8 8 0 1116 0h16v16a8 8 0 100 16v16h-48V58z" class="er-vurgu-soft"/>' +
            '</g>' +
            '<g class="hr-tik">' +
            '  <circle cx="198" cy="76" r="20" class="er-vurgu-dolgu"/>' +
            '  <path d="M188 76l7 7 14-14" class="er-tik-cizgi"/>' +
            '</g>'
        ),
    };

    // ==================================================================
    // Adımlar
    // ==================================================================

    function adimlar(kayit) {
        return [
            {
                baslik: 'ZIP dosyasını indir',
                metin: 'Aşağıdaki düğme eklentinin sıkıştırılmış klasörünü indirir. İndirilenler klasörüne düşecek.',
                cizim: CIZIMLER.indir,
            },
            {
                baslik: 'Klasöre çıkar',
                metin: 'ZIP’e sağ tıkla, “Buraya çıkar” de. Ortaya <b>' + kayit.klasor + '</b> adında bir klasör çıkacak. ' +
                       'Bu klasörü silme — eklenti kurulduktan sonra da oradan çalışır.',
                cizim: CIZIMLER.cikar,
            },
            {
                baslik: 'Chrome eklenti sayfasını aç',
                metin: 'Adres çubuğuna <b>chrome://extensions</b> yaz ve Enter’a bas.',
                cizim: CIZIMLER.adres,
            },
            {
                baslik: 'Geliştirici modunu aç',
                metin: 'Sayfanın sağ üstündeki anahtarı aç. Açılınca üstte üç yeni düğme belirecek.',
                cizim: CIZIMLER.gelistirici,
            },
            {
                baslik: '“Paketlenmemiş öğe yükle”ye bas',
                metin: 'Yeni çıkan düğmelerin ilki. Bir klasör seçme penceresi açılacak.',
                cizim: CIZIMLER.yukle,
            },
            {
                baslik: 'Çıkardığın klasörü seç',
                metin: '2. adımda çıkardığın <b>' + kayit.klasor + '</b> klasörünü seç ve onayla. ' +
                       'İçindeki dosyayı değil, <b>klasörün kendisini</b> seçmelisin.',
                cizim: CIZIMLER.klasorSec,
            },
            {
                baslik: 'Hazır',
                metin: 'Eklenti listede görünüyor. Artık <b>' + kayit.site + '</b> adresine gittiğinde kendiliğinden çalışacak.',
                cizim: CIZIMLER.hazir,
            },
        ];
    }

    // ==================================================================
    // Çizim
    // ==================================================================

    function kacir(m) {
        return String(m).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /** Metindeki <b> etiketlerine izin ver, gerisini kaçır. */
    function guvenliMetin(m) {
        return kacir(m).replace(/&lt;(\/?)b&gt;/g, '<$1b>');
    }

    function zipYolu(kayit) {
        // pages/ altından çalışıyoruz; ZIP'ler kök dizinde
        return '../' + kayit.zip;
    }

    /**
     * Eklenti panelini kaba çizer.
     * @param {HTMLElement} kap   içeriğin yazılacağı düğüm
     * @param {string} anahtar    KAYITLAR anahtarı
     * @param {boolean} kilitli   premium hakkı yoksa true
     */
    function ciz(kap, anahtar, kilitli) {
        var kayit = KAYITLAR[anahtar];
        if (!kap || !kayit) return false;

        var basamaklar = adimlar(kayit);

        var html =
            '<div class="er">' +
            // ---- Tanıtım ----
            '  <div class="er-tanitim">' +
            '    <p class="er-ozet">' + kacir(kayit.ozet) + '</p>' +
            '    <ul class="er-liste">' +
            kayit.neYapar.map(function (x) { return '<li>' + kacir(x) + '</li>'; }).join('') +
            '    </ul>' +
            '    <p class="er-site"><span>Çalıştığı yer</span><b>' + kacir(kayit.site) + '</b></p>' +
            '  </div>';

        if (kilitli) {
            html +=
                '  <div class="er-kilit">' +
                '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
                '      <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>' +
                '    <span>Bu eklenti hesabında kapalı. Açtırmak için yöneticine yaz.</span>' +
                '  </div>';
        } else if (kayit.yakinda) {
            html +=
                '  <div class="er-kilit er-kilit--yakinda">' +
                '    <span>Kurulum dosyası hazırlanıyor. Hazır olduğunda buradan indirilebilecek.</span>' +
                '  </div>';
        } else {
            // ---- Sihirbaz ----
            html +=
                '  <div class="er-sihirbaz" id="erSihirbaz">' +
                '    <div class="er-ust">' +
                '      <span class="er-sayac" id="erSayac">1 / ' + basamaklar.length + '</span>' +
                '      <div class="er-cubuk"><span class="er-cubuk__dolu" id="erCubuk"></span></div>' +
                '    </div>' +
                '    <div class="er-adimlar" id="erAdimlar">' +
                basamaklar.map(function (a, i) {
                    return '<section class="er-adim' + (i === 0 ? ' is-aktif' : '') + '" data-adim="' + i + '">' +
                        '<div class="er-gorsel">' + a.cizim + '</div>' +
                        '<h4 class="er-baslik">' + kacir(a.baslik) + '</h4>' +
                        '<p class="er-metin">' + guvenliMetin(a.metin) + '</p>' +
                        (i === 0
                            ? '<a class="er-indir" href="' + zipYolu(kayit) + '" download>' +
                              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
                              '<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>' +
                              kacir(kayit.ad) + ' — ZIP indir</a>'
                            : '') +
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

        if (!kilitli && !kayit.yakinda) sihirbaziBagla(kap, basamaklar.length);
        return true;
    }

    function sihirbaziBagla(kap, toplam) {
        var adimEls = kap.querySelectorAll('.er-adim');
        var geri = kap.querySelector('#erGeri');
        var ileri = kap.querySelector('#erIleri');
        var sayac = kap.querySelector('#erSayac');
        var cubuk = kap.querySelector('#erCubuk');
        var kaydirmaKabi = kap.closest('.jb-modal__body') || kap;
        var simdi = 0;

        function goster(yeni) {
            if (yeni < 0 || yeni >= toplam) return;
            adimEls[simdi].classList.remove('is-aktif');
            simdi = yeni;
            adimEls[simdi].classList.add('is-aktif');

            sayac.textContent = (simdi + 1) + ' / ' + toplam;
            cubuk.style.width = ((simdi + 1) / toplam * 100) + '%';
            geri.disabled = simdi === 0;
            ileri.textContent = simdi === toplam - 1 ? 'Bitir' : 'İleri';

            // Adım değişince panel başa dönsün; uzun adımda yarıda kalmasın
            if (kaydirmaKabi.scrollTo) kaydirmaKabi.scrollTo({ top: 0, behavior: 'smooth' });
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

        cubuk.style.width = (1 / toplam * 100) + '%';
    }

    global.EklentiRehberi = { KAYITLAR: KAYITLAR, ciz: ciz };
})(typeof window !== 'undefined' ? window : globalThis);
