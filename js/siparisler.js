/**
 * Siparişler sayfası
 * ============================================================================
 *
 * Depo panelinden eklentinin yazdığı siparişleri gösterir ve toplama işini
 * yürütür. Depocu barkodları okuttuktan sonra telefonu eline alıyor, sipariş
 * burada duruyor, tek tek işaretleyerek topluyor.
 *
 * VERİ
 * `orders` ve `order_items` tabloları. Yazan taraf eklenti, okuyan taraf
 * burası. Satırlar kullanıcı bazlı; RLS zaten kendi siparişinden başkasını
 * göstermiyor.
 *
 * SIRALAMA
 * Ürünler geldikleri sırada değil, toplama sırasında diziliyor:
 * `js/siparis-sirala.js`. Fırın ve dondurma başta, su sonda, benzerler yan
 * yana.
 *
 * TAZELEME
 * Sayım sayfasındaki mantık: belirli aralıkla yoklama, sekme öne gelince
 * hemen bir kez. Websocket yok, sunucuya yük bindirmiyor.
 *
 * EKRAN
 * Yerleşim ve görsel dil `Jet-Barkod-Siparisler-Premium/` referansından:
 * iki şerit (Hazırlanıyor / Hazırlandı), sipariş kartı, sağdan kayan detay
 * (solda ürünler, sağda künye), sabit alt çubuk, barkod ve ayar pencereleri,
 * bildirim.
 *
 * KATEGORİLER
 * Fırın/dondurma/su hangi ürünleri kapsayacağı (anahtar kelime + renk)
 * ayarlardan değişebiliyor; kullanıcı yepyeni bir kategori de açabiliyor.
 * Sınıflandırmayı gerçekten yapan `js/siparis-sirala.js`, burası yalnız
 * kullanıcının ayarını o modülün beklediği biçime çeviriyor. Kart zemini
 * kategori renklerinin soluk karışımından hesaplanıyor (sipariş hangi
 * kategoriden ağırlıklıysa).
 * ============================================================================
 */
(function (global) {
    'use strict';

    /* YOKLAMA
       İki katmanlı. 1,5 saniyede bir yalnız sipariş başlıkları soruluyor
       (birkaç yüz bayt); bir şey değiştiyse ürünlerle birlikte tam çekim
       yapılıyor. Bir depocunun tiki diğer cihazlara böylece 1-2 saniyede
       ulaşıyor. Tik ürün satırında değişiyor; başlığa iz bırakması için
       veritabanı `orders.son_isaret` damgasını kendisi basıyor
       (sql_files/siparis_canli.sql). O sütun yoksa sayfa 3 saniyede bir
       tam çekime düşüyor, yine çalışıyor. Hiçbir koşulda 20 saniyeden uzun
       süre tam çekimsiz kalınmıyor. */
    var HAFIF_MS = 1500;
    var GUVENLIK_MS = 20000;
    var YEDEK_TAM_MS = 3000;
    var durum = {
        siparisler: [],
        secili: null,
        detayGorunum: 'liste',
        bantSirasi: null,
        yukSirasi: null,
        kategoriler: null,
        kodUrun: null,
        yukleniyor: true,
        sonImza: '',
        sonYenileme: null,
        /* Giriş animasyonu yalnız içerik gerçekten değiştiğinde oynuyor.
           Her yoklamada yeniden oynasa ekran titrerdi. İki şerit ayrı ayrı
           izleniyor. */
        kartImzasi: { hazirlaniyor: '', hazir: '', yolda: '' },
        detayImzasi: '',
        /* Şerit sıralaması. Varsayılan: hazırlanan en eski başta (sırası
           gelen önde), bankoda bekleyen en yeni başta (yeni gelen hemen
           görülsün), yoldakiler kuryeye göre gruplu. Cihaza özel; ayarlardan
           ya da şerit başlığındaki rozetten değişiyor ve hatırlanıyor. */
        seritSira: { hazirlaniyor: 'sure', hazir: 'sureTers', yolda: 'kurye' },
        /* Çoklu adet efekti, cihaza özel. mod: tam (kenar ışığı + sayı),
           sayi (yalnız sayı), kapali. guc: kenar ışığının sertliği 0-100. */
        efekt: { mod: 'tam', guc: 60, titresim: true }
    };

    var SERIT_VARSAYILAN = { hazirlaniyor: 'sure', hazir: 'sureTers', yolda: 'kurye' };

    /* Cihaza özel ayarlar. Depocunun telefonu ile ofisteki bilgisayar aynı
       hesabı kullanıyor ama aynı ekranı istemiyor; bu yüzden sunucuya değil
       yerel depoya yazılıyor. */
    var AYAR_ANAHTARI = 'jb_siparis_ayar';

    function ayarOku() {
        try {
            var h = JSON.parse(localStorage.getItem(AYAR_ANAHTARI) || '{}');
            if (h && typeof h === 'object') return h;
        } catch (e) { /* sessiz */ }
        return {};
    }

    function ayarYaz(yeni) {
        try {
            localStorage.setItem(AYAR_ANAHTARI, JSON.stringify(Object.assign(ayarOku(), yeni)));
        } catch (e) { /* sessiz */ }
    }
    var zamanlayici = null;

    // ==================================================================
    // Yardımcılar
    // ==================================================================

    function el(id) { return document.getElementById(id); }

    function kacir(t) {
        return String(t == null ? '' : t)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function oturum() {
        try { return (global.authUtils && global.authUtils.checkAuth()) || null; }
        catch (e) { return null; }
    }

    function db() { return global.jbDb || null; }

    /** Adet tam sayıysa "3", kesirliyse "1,5" yazılır. Kilo bazlı ürünler için. */
    function adetYaz(n) {
        var s = Number(n);
        if (!isFinite(s)) return '1';
        if (Math.abs(s - Math.round(s)) < 0.0005) return String(Math.round(s));
        return s.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
    }

    /* Toplam ve alınan: ürün ÇEŞİTİ değil ADET bazlı. Aynı üründen 5 varsa
       5 parçadır, 1 değil. Kilo bazlı ürünlerde (Erpiliç bonfile, baget vb.)
       adet 0.882, 1.867 gibi kesirli geliyor; bunlar en yakın tam sayıya
       (0.88 → 1, 1.87 → 2) yuvarlanır. Böylece "8.874 parça" yerine "9 parça"
       gibi kartta anlamlı sayı çıkar; birim ve gerçek miktar ayrıntıda "0,882 kg
       alınacak" olarak korunur. */
    function urunAdet(u) {
        var n = Number(u && u.adet);
        if (!isFinite(n) || n <= 0) return 1;
        return Math.max(1, Math.round(n));
    }
    function toplamAdet(urunler) {
        return (urunler || []).reduce(function (a, u) { return a + urunAdet(u); }, 0);
    }
    function alinanAdet(urunler) {
        return (urunler || []).reduce(function (a, u) { return a + (u.alindi ? urunAdet(u) : 0); }, 0);
    }

    // ==================================================================
    // Katalog: ürün adı ve görselinden barkoda
    //
    // Sipariş detayında ürün kimliği gelmiyor, yalnız ad ve görsel var.
    // Katalogda ikisiyle de arıyoruz: önce görsel adresi (birebir), sonra
    // sadeleştirilmiş ad. Sonuç önbelleğe alınıyor, her çizimde yeniden
    // aranmıyor.
    // ==================================================================

    var HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c' };

    function sade(metin) {
        return String(metin == null ? '' : metin)
            .toLocaleLowerCase('tr')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[ığüşöçâîû]/g, function (m) { return HARF[m] || m; })
            .replace(/(\d)[.,](\d)/g, '$1$2')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    var katalogDizin = null;
    var gorselDizin = null;
    var barkodOnbellek = new Map();

    /* PRODUCTS_DATA `const` olarak tanımlanıyor; üst düzey const window'a
       yazılmaz, yalnız betik kapsamında durur. `global.PRODUCTS_DATA` bu
       yüzden boş geliyordu. Çıplak adla okumak gerekiyor. */
    function katalogListesi() {
        try {
            if (typeof PRODUCTS_DATA !== 'undefined' && PRODUCTS_DATA && PRODUCTS_DATA.products) {
                return PRODUCTS_DATA.products;
            }
        } catch (e) { /* tanımlı değil */ }
        return (global.PRODUCTS_DATA && global.PRODUCTS_DATA.products) || [];
    }

    function katalogHazirla() {
        if (katalogDizin) return;
        var liste = katalogListesi();
        katalogDizin = new Map();
        liste.forEach(function (p) {
            if (!p || !p.name) return;
            var a = sade(p.name);
            if (!katalogDizin.has(a)) katalogDizin.set(a, p);
        });
        try {
            var G = global.GetirCdnPaste;
            if (G && liste.length) {
                gorselDizin = (typeof G.getOrBuildGetirImageProductIndex === 'function')
                    ? G.getOrBuildGetirImageProductIndex(liste)
                    : G.buildGetirImageProductIndex(liste);
            }
        } catch (e) { gorselDizin = null; }
    }

    /**
     * Siparişin kimliği. Banko varsa o; depocu bankoya yürüyor, aradığı sayı
     * bu. Banko henüz atanmadıysa eskiden siparişin son dört hanesi
     * yazılıyordu, kullanıcının hiçbir yerde görmediği bir koddu. Onun yerine
     * ne kadar zamandır beklediği yazıyor; anlamı olan tek şey o.
     *
     * @returns {{etiket: string, deger: string, bankoVar: boolean}}
     */
    function siparisKimligi(s) {
        if (s.banko) return { etiket: 'Banko', deger: String(s.banko), bankoVar: true };
        return { etiket: 'Banko yok', deger: '–', bankoVar: false };
    }

    /**
     * Ürünün ekranda görünecek adı. Panelden ad gelmediyse katalogdan
     * bulunan ad kullanılıyor; o da yoksa barkod yazılıyor. "Adı gelmedi"
     * gibi bir hata metni kullanıcıya gösterilmiyor.
     */
    function urunBasligi(u, bilgi) {
        /* Panel "Mantar Paket" gibi kısa ad veriyor, oysa katalogda
           "Mantar Paket (400 g)" var. Görsele göre eşleştirdiğimiz
           katalog adı 2 çeşitten doğru olanı bulur; onu öncelikli tut.
           Görsel eşleşmezse panel adı, o da yoksa katalog adı. */
        if (bilgi.gorselEsti && bilgi.katalogAdi) return bilgi.katalogAdi;
        if (u.ad) return u.ad;
        if (bilgi.katalogAdi) return bilgi.katalogAdi;
        if (bilgi.barkodlar.length) return bilgi.barkodlar[0];
        return 'Ürün';
    }

    /** @returns {{barkodlar: string[], katalogAdi: string, gorselEsti: boolean, katalogGorsel: string}} */
    function barkodBul(u) {
        var anahtar = (u.gorsel || '') + '|' + (u.ad || '');
        if (barkodOnbellek.has(anahtar)) return barkodOnbellek.get(anahtar);

        katalogHazirla();
        var urun = null;
        var gorselIle = false;

        if (gorselDizin && u.gorsel) {
            try {
                urun = global.GetirCdnPaste.findProductByGetirImageUrlFromIndex(gorselDizin, u.gorsel);
                if (urun) gorselIle = true;
            } catch (e) { urun = null; }
        }
        if (!urun && u.ad && katalogDizin) urun = katalogDizin.get(sade(u.ad)) || null;

        var sonuc = {
            barkodlar: (urun && Array.isArray(urun.barcodes))
                ? urun.barcodes.map(function (b) { return b && b.code ? String(b.code).trim() : ''; })
                             .filter(Boolean)
                : [],
            katalogAdi: (urun && urun.name) || '',
            gorselEsti: gorselIle,
            /* Panelden görsel gelmediyse (ya da adres kırıksa) katalogdaki
               görseli kullanıyoruz. Telefonda/başka bilgisayarda eklenti
               olmadığı için oradan Getir'e istek atılamıyor; katalog
               yerel dosya olduğundan her cihazda çalışıyor. */
            katalogGorsel: (urun && urun.image) || ''
        };
        barkodOnbellek.set(anahtar, sonuc);
        return sonuc;
    }

    /* Bant adları panelin kendi kolon adlarıyla aynı; depocu iki ekranda
       aynı kelimeyi görüyor. */
    var BANT_ADI = {
        hazir: 'Hazırlandı',
        hazirlaniyor: 'Hazırlanıyor',
        yolda: 'Yolda',
        bitti: 'Kapandı'
    };

    // ==================================================================
    // Veri
    // ==================================================================

    async function siparisleriCek() {
        var o = oturum();
        var d = db();
        if (!o || !o.username || !d) return null;

        /* Kolon listesi yerine `*`: `toplayici_foto`/`kurye_foto` kolonları
           VPS'te göç çalışmadan önce yoksa, adı geçen kolon listesi
           PostgREST'te hata veriyor ve bütün sipariş çekimi patlıyordu.
           `*` ile eksik kolon yalnız gelmemiş oluyor. Tabloda müşteri
           verisi yok, hepsi bizim yazdığımız alanlar. */
        /* PENCERE
           Eskiden son 60 kayıt körlemesine çekiliyordu. Bunların bir kısmı
           zaten `eskimisMi` ile ekranda gizleniyordu, ama `order_items`
           sorgusu onları da kapsıyordu: her turda boşuna yüzlerce ürün
           satırı taşınıyordu. Şikâyet edilen yavaşlık buydu.

           Pencere `ESKIME_MS` ile aynı: üç saat. Sınırı geçmiş kayıt
           panelde kesinlikle yok, çekmenin anlamı da yok. `updated_at`
           eklenti nabzıyla tazeleniyor, yani uzun süren sipariş
           pencerede kalmaya devam ediyor. */
        var pencere = new Date(Date.now() - ESKIME_MS).toISOString();
        var siparisSonuc = await d.from('orders')
            .select('*')
            .eq('username', o.username)
            .gte('updated_at', pencere)
            .order('created_at', { ascending: false })
            .limit(60);

        if (siparisSonuc.error) throw new Error(siparisSonuc.error.message || 'Siparişler alınamadı');
        var siparisler = siparisSonuc.data || [];
        if (!siparisler.length) return [];

        var kimlikler = siparisler.map(function (s) { return s.id; });
        /* Ürün sorgusu bu anda yola çıkıyor. Bu andan SONRA onaylanan bir
           tik, bu yanıtta görünmeyebilir; aşağıda yerel değer korunuyor. */
        var cekimBasi = Date.now();
        /* SIRALAMA ŞART
           PostgREST `order` verilmeyen sorguda satır sırası için hiçbir
           garanti vermiyor; aynı sorgu iki turda farklı sırada dönebiliyor.
           `JBSiparisSirala.sirala` küme sırasını "kümenin ilk göründüğü
           yer"e göre kuruyor, yani girdi sırası değişince çıktı sırası da
           değişiyordu. Depocu bir ürünü tikliyor, iki saniye sonraki
           tazelemede liste kendiliğinden yeniden diziliyordu. */
        var satirSonuc = await d.from('order_items')
            .select('order_uuid,sira,urun_adi,gorsel_id,adet,birim,ana_kategori,sinif,alt_sinif,alindi')
            .in('order_uuid', kimlikler)
            .order('sira', { ascending: true });

        if (satirSonuc.error) throw new Error(satirSonuc.error.message || 'Ürünler alınamadı');

        var harita = new Map();
        (satirSonuc.data || []).forEach(function (r) {
            if (!harita.has(r.order_uuid)) harita.set(r.order_uuid, []);
            harita.get(r.order_uuid).push(r);
        });

        siparisler.forEach(function (s) {
            var ham = (harita.get(s.id) || []).map(function (r) {
                return {
                    sira: r.sira,
                    ad: r.urun_adi || '',
                    gorsel: r.gorsel_id || '',
                    adet: r.adet,
                    birim: r.birim || '',
                    anaKategori: r.ana_kategori || '',
                    sinif: r.sinif || '',
                    altSinif: r.alt_sinif || '',
                    alindi: bekleyenUygula(s.id, r.sira, !!r.alindi, cekimBasi)
                };
            });
            s.urunler = (global.JBSiparisSirala && global.JBSiparisSirala.sirala)
                ? global.JBSiparisSirala.sirala(ham, { sira: durum.bantSirasi, kurallar: kategoriKurallari() })
                : ham;
        });

        return siparisler;
    }

    function imzaCikar(siparisler) {
        return siparisler.map(function (s) {
            return s.id + ':' + s.toplama_durumu + ':' + s.durum + ':' +
                   (s.urunler || []).filter(function (u) { return u.alindi; }).length +
                   '/' + (s.urunler || []).length;
        }).join('|');
    }

    /* TEK UÇUŞ
       Aynı anda iki tam çekim olmuyor. İkisi yarışınca geç başlayan erken
       bitebiliyor, sonra erken başlayanın ESKİ verisi ekrana basılıyordu:
       tik bir an görünüp geri kalkıyordu. Çekim sürerken gelen istek
       bekletiliyor, bitince tek bir tane daha yapılıyor. */
    var _tazeleSoz = null;
    var _tazeleBekleyen = false;
    var _tazeleZorla = false;
    var sonTamCekim = 0;

    function tazele(zorla) {
        if (_tazeleSoz) {
            _tazeleBekleyen = true;
            _tazeleZorla = _tazeleZorla || !!zorla;
            return _tazeleSoz;
        }
        sonTamCekim = Date.now();
        _tazeleSoz = tazeleIc(!!zorla).catch(function (e) {
            console.warn('Sipariş tazeleme:', e && e.message);
        }).then(function () {
            _tazeleSoz = null;
            if (_tazeleBekleyen) {
                var z = _tazeleZorla;
                _tazeleBekleyen = false;
                _tazeleZorla = false;
                return tazele(z);
            }
        });
        return _tazeleSoz;
    }

    async function tazeleIc(zorla) {
        var yeni;
        try {
            yeni = await siparisleriCek();
        } catch (e) {
            console.warn('Siparişler alınamadı:', e && e.message);
            return;
        }
        if (yeni === null) return;

        var imza = imzaCikar(yeni);
        durum.yukleniyor = false;
        durum.sonYenileme = Date.now();
        /* Erken çıkıştan ÖNCE: ürünü gelmemiş sipariş varken liste hiç
           değişmiyor, imza sabit kalıyor ve aşağıdaki return bildirimi
           hiç çalıştırmıyordu. Tam da bu durumda haber vermek gerekiyor. */
        urunEksikleriBildir(yeni);
        /* Canlılık göstergesi de erken çıkıştan önce tazelenir. Veri
           donduğunda imza hiç değişmez; aşağıdaki return çalışsaydı
           gösterge tam da uyarması gereken anda donmuş kalırdı. */
        durum.siparisler = yeni;
        canliliksGoster();
        /* Pencere dışında kalmış kayıtlar çekilen listede olmadığı için
           erken çıkıştan önce temizleniyor; kendi iç aralığı var, her
           turda istek atmıyor. */
        copToplama();
        if (!zorla && imza === durum.sonImza) return;
        /* Kurye alıp gitmiş ve eskimiş kayıtlar siliniyor; ekrana da
           girmiyorlar. Silme başarısız olursa liste yine de çizilir,
           yalnız o kayıt bir sonraki turda tekrar denenir. */
        var silinen = await gidenleriSil(yeni);
        if (silinen.length) {
            yeni = yeni.filter(function (s) { return silinen.indexOf(s.id) === -1; });
            imza = imzaCikar(yeni);
        }

        durum.sonImza = imza;
        durum.siparisler = yeni;
        // Panelde el değiştirmeye geçmiş siparişler burada kapanıyor.
        bitenleriKapat(yeni);

        if (durum.secili) {
            var guncel = yeni.filter(function (s) { return s.id === durum.secili.id; })[0];
            durum.secili = guncel || null;
            // Sipariş listeden düştü: geçmiş yığınından da düşsün
            if (!guncel) katmanDustu('detay');
        }
        ciz();
    }

    // ==================================================================
    // Hafif yoklama
    // ==================================================================

    var isaretKolonu = null;     // null: bilinmiyor · true · false (göç yok)
    var sonHafifImza = '';
    var hafifSuruyor = false;
    var donguSaati = null;

    function kolonYokHatasi(h) {
        if (!h) return false;
        var kod = String(h.code || '');
        return kod === '42703' || kod === 'PGRST204' || /son_isaret/.test(String(h.message || ''));
    }

    async function hafifYokla() {
        if (hafifSuruyor) return;
        var o = oturum();
        var d = db();
        if (!o || !o.username || !d) return;
        hafifSuruyor = true;
        try {
            var pencere = new Date(Date.now() - ESKIME_MS).toISOString();
            var kolonlar = 'id,updated_at,toplama_durumu' + (isaretKolonu === false ? '' : ',son_isaret');
            var r = await d.from('orders')
                .select(kolonlar)
                .eq('username', o.username)
                .gte('updated_at', pencere)
                .order('created_at', { ascending: false })
                .limit(60);
            if (r.error) {
                if (isaretKolonu !== false && kolonYokHatasi(r.error)) isaretKolonu = false;
                return;
            }
            if (isaretKolonu === null) isaretKolonu = true;
            var imza = (r.data || []).map(function (x) {
                return x.id + ':' + x.updated_at + ':' + x.toplama_durumu + ':' + (x.son_isaret || '');
            }).join('|');
            if (imza !== sonHafifImza) {
                var ilk = !sonHafifImza;
                sonHafifImza = imza;
                // İlk turda imza yalnız öğreniliyor; tam çekim zaten yeni yapıldı
                if (!ilk || Date.now() - sonTamCekim > HAFIF_MS) await tazele(false);
            }
        } catch (e) {
            /* Ağ yok: bir sonraki turda yine denenir */
        } finally {
            hafifSuruyor = false;
        }
    }

    function dongu() {
        clearTimeout(donguSaati);
        donguSaati = null;
        if (document.visibilityState !== 'visible') return;
        var aralik = isaretKolonu === false ? YEDEK_TAM_MS : GUVENLIK_MS;
        var is = (Date.now() - sonTamCekim >= aralik) ? tazele(false) : hafifYokla();
        var sonra = function () {
            clearTimeout(donguSaati);
            if (document.visibilityState === 'visible') donguSaati = setTimeout(dongu, HAFIF_MS);
        };
        Promise.resolve(is).then(sonra, sonra);
    }

    /* Ürünü gelmemiş siparişleri eklentiye bildirir.

       Neden gerekli: telefonda ya da eklentisiz bir bilgisayarda bu sayfa
       yalnız veritabanını okuyabiliyor, Getir'e istek atamıyor. Ürünler
       bir sebeple yazılamadıysa o cihaz kendi başına düzeltemez. Bu mesaj
       depo panelinin açık olduğu makineye ulaşıyor, iş orada yapılıyor ve
       sonuç veritabanı üzerinden bütün cihazlara dönüyor.

       Eklenti yoksa mesajı kimse dinlemez, zararsız. Aynı sipariş için
       60 saniyede birden fazla istek çıkmıyor. */
    var _eksikSorulan = new Map();
    var EKSIK_TEKRAR_MS = 60 * 1000;

    function urunEksikleriBildir(liste) {
        try {
            var simdi = Date.now();
            var eksik = [];
            (liste || []).forEach(function (s) {
                if (!s || !s.order_id) return;
                if ((s.urunler || []).length) return;
                if (eskimisMi(s) || panelBitirmisMi(s)) return;
                if (simdi - (_eksikSorulan.get(s.order_id) || 0) < EKSIK_TEKRAR_MS) return;
                _eksikSorulan.set(s.order_id, simdi);
                eksik.push(s.order_id);
            });
            if (!eksik.length) return;
            global.postMessage({ type: 'JB_SIPARIS_URUN_EKSIK', siparisler: eksik }, global.location.origin);
        } catch (e) { /* eklenti yoksa sessiz */ }
    }

    // ==================================================================
    // Yazma
    // ==================================================================

    /* TİK YAZMA
       Eskiden her dokunuş ayrı bir istekti. Hızlı iki dokunuşta (tikle,
       vazgeç) istekler sunucuya ters sırada varabiliyor, ekranla
       veritabanı ayrı düşüyordu. Yoklama da tik kaydedilmeden başlamışsa
       eski veriyi getirip tiki geri kaldırıyordu.

       Şimdi her ürün için tek bir yazıcı var. Ekran anında dönüyor; yazıcı
       uçuştayken yeni dokunuş gelirse yalnız istenen son durum hatırlanıyor
       ve uçuş bitince o yazılıyor. Onaylanmamış ya da yoklamadan sonra
       onaylanmış tik, yoklama yanıtında ezilmiyor (`bekleyenUygula`).
       Ağ hatasında üç kez yeniden deneniyor; gene olmazsa ekran
       sunucunun bildiği son hâle dönüyor ve uyarı çıkıyor. */
    var bekleyen = new Map();

    function bekleyenAnahtar(siparisId, sira) { return siparisId + '|' + sira; }

    function bekleyenUygula(siparisId, sira, sunucu, cekimBasi) {
        var k = bekleyenAnahtar(siparisId, sira);
        var b = bekleyen.get(k);
        if (!b) return sunucu;
        if (b.ucusta || b.istenen !== b.yazilan) return b.istenen;
        if (cekimBasi < b.onay) return b.istenen;
        // Onaydan sonra başlamış bir okuma: sunucu artık yetkili (başka cihaz değiştirmiş olabilir)
        bekleyen.delete(k);
        return sunucu;
    }

    function urunuBul(siparisId, sira) {
        var kaynak = (durum.secili && durum.secili.id === siparisId) ? durum.secili
            : (durum.siparisler || []).filter(function (x) { return x.id === siparisId; })[0];
        if (!kaynak) return null;
        return (kaynak.urunler || []).filter(function (u) { return u.sira === sira; })[0] || null;
    }

    function detayImzasiTazele(siparis) {
        if (!durum.secili || durum.secili.id !== siparis.id) return;
        durum.detayImzasi = siparis.id + '|' + durum.detayGorunum + '|' +
            (siparis.urunler || []).map(function (u) { return u.sira + (u.alindi ? '1' : '0'); }).join('');
    }

    function urunIsaretle(siparis, urun, alindi) {
        if (!db()) {
            /* Sessizce hiçbir şey yapmak en kötüsü: depocu işaretlediğini
               sanıp geçiyor. */
            if (global.JBDiyalog) global.JBDiyalog.hata('Veri bağlantısı yok, işaretleme kaydedilemez.');
            return;
        }
        var k = bekleyenAnahtar(siparis.id, urun.sira);
        var b = bekleyen.get(k);
        if (!b) {
            b = { siparisId: siparis.id, sira: urun.sira, ilk: !!urun.alindi, istenen: alindi,
                  yazilan: null, ucusta: false, onay: 0, deneme: 0 };
            bekleyen.set(k, b);
        } else {
            b.istenen = alindi;
        }

        /* Ekran anında dönüyor; ağ beklemesi elde hissedilmesin. Yalnız o
           satır güncelleniyor: gövdeyi yeniden yazmak kaydırmayı başa
           atıyor ve bütün satırları yeniden belirtiyordu. */
        urun.alindi = alindi;
        satiriTazele(urun);
        isaretEfekti(urun, alindi);
        detayImzasiTazele(siparis);
        durumuPlanla(siparis.id);

        if (!b.ucusta) isaretPompala(b);
    }

    var YENIDEN_DENE_MS = [600, 1500, 3500];

    async function isaretPompala(b) {
        var d = db();
        if (!d) return;
        b.ucusta = true;
        var hedef = b.istenen;
        var sonuc;
        try {
            sonuc = await d.from('order_items')
                .update({ alindi: hedef })
                .eq('order_uuid', b.siparisId)
                .eq('sira', b.sira)
                .select('sira');
        } catch (e) {
            sonuc = { error: e };
        }
        b.ucusta = false;

        var tamam = sonuc && !sonuc.error && Array.isArray(sonuc.data) && sonuc.data.length > 0;
        if (!tamam) {
            /* Hata yoksa ama hiç satır güncellenmediyse sipariş silinmiş
               demektir; yeniden denemenin anlamı yok. */
            if (sonuc && sonuc.error && b.deneme < YENIDEN_DENE_MS.length) {
                var bekle = YENIDEN_DENE_MS[b.deneme];
                b.deneme++;
                setTimeout(function () { if (!b.ucusta && bekleyen.get(bekleyenAnahtar(b.siparisId, b.sira)) === b) isaretPompala(b); }, bekle);
                return;
            }
            bekleyen.delete(bekleyenAnahtar(b.siparisId, b.sira));
            var u = urunuBul(b.siparisId, b.sira);
            if (u) {
                u.alindi = b.ilk;
                if (durum.secili && durum.secili.id === b.siparisId) {
                    satiriTazele(u);
                    detayImzasiTazele(durum.secili);
                }
                cizIste();
            }
            if (global.JBDiyalog) global.JBDiyalog.hata('Ürün işaretlenemedi. Bağlantını kontrol et.');
            return;
        }

        b.deneme = 0;
        b.yazilan = hedef;
        b.ilk = hedef;
        b.onay = Date.now();
        // Uçuş sürerken fikir değiştiyse son istenen durumu yaz
        if (b.istenen !== hedef) isaretPompala(b);
    }

    /* Bekleyen kayıtlar sonsuza dek birikmesin: bir dakikadır onaylı ve
       sakin olanlar düşüyor. */
    setInterval(function () {
        var sinir = Date.now() - 60 * 1000;
        bekleyen.forEach(function (b, k) {
            if (!b.ucusta && b.istenen === b.yazilan && b.onay && b.onay < sinir) bekleyen.delete(k);
        });
    }, 30 * 1000);

    /* Toplama durumu (bekliyor/toplaniyor/toplandi) ve kart sayaçları her
       dokunuşta değil, dokunuşlar durulunca bir kez yazılıyor. Hızlı
       tiklemede hem ağ hem çizim yükü düşüyor. */
    var _durumSaatleri = new Map();

    function durumuPlanla(siparisId) {
        clearTimeout(_durumSaatleri.get(siparisId));
        _durumSaatleri.set(siparisId, setTimeout(function () {
            _durumSaatleri.delete(siparisId);
            var s = (durum.secili && durum.secili.id === siparisId) ? durum.secili
                : (durum.siparisler || []).filter(function (x) { return x.id === siparisId; })[0];
            if (!s) return;
            var urunler = s.urunler || [];
            var hepsi = urunler.length > 0 && urunler.every(function (u) { return u.alindi; });
            var hedef = hepsi ? 'toplandi' : (urunler.some(function (u) { return u.alindi; }) ? 'toplaniyor' : 'bekliyor');
            if (hedef !== s.toplama_durumu) siparisDurumu(s, hedef, true);
            cizIste();
        }, 450));
    }

    var _cizimKaresi = 0;
    function cizIste() {
        if (_cizimKaresi) return;
        _cizimKaresi = requestAnimationFrame(function () {
            _cizimKaresi = 0;
            ciz();
        });
    }

    async function siparisDurumu(siparis, yeni, sessiz) {
        var d = db();
        if (!d) {
            if (global.JBDiyalog) global.JBDiyalog.hata('Veri bağlantısı yok, durum kaydedilemez.');
            return;
        }
        var eski = siparis.toplama_durumu;
        siparis.toplama_durumu = yeni;
        if (!sessiz) ciz(); else ilerlemeyiTazele();

        /* `updated_at` yazılmıyor: o damga depo panelinin nabzı. Sitedeki
           tikler onu tazeleseydi panel sustuğu hâlde gösterge "Canlı"
           derdi. Değişikliği diğer cihazlar `toplama_durumu` üzerinden
           görüyor. */
        var sonuc = await d.from('orders')
            .update({ toplama_durumu: yeni })
            .eq('id', siparis.id);

        if (sonuc.error) {
            siparis.toplama_durumu = eski;
            if (!sessiz) ciz();
            if (!sessiz && global.JBDiyalog) global.JBDiyalog.hata('Sipariş durumu kaydedilemedi.');
        }
    }


    // ==================================================================
    // Bant: sınıflandırma, renk, arka plan
    // ==================================================================

    /*
     * Panelin kolon adına göre bant. Kolon adı panelin kendi metni; sayı
     * koduna göre tahmin yürütmüyoruz.
     *
     *   hazir         Hazırlandı. Depocunun asıl işi bu.
     *   hazirlaniyor  Toplayıcı Bekliyor, Doğrulanıyor, Hazırlanıyor.
     *   yolda         El Değiştiriliyor, Yolda. Kurye üzerine almış.
     *   bitti         Teslim Edildi, İptal, Tamamlandı, Ulaştı. Bitmiş siparişler.
     */
    var KOLON_BITTI = /(teslim|iptal|tamamlan)/;
    var KOLON_YOLDA = /(el degistir|yolda|ulast)/;
    var KOLON_HAZIR = /hazirland/;

    function kolonAdi(s) { return sade(s && s.kolon); }

    /* Panelden düşen siparişi eklenti siliyor. Bu ikinci savunma katmanı:
       eklenti kapalıysa ya da warehouse sekmesi hiç açılmadıysa silme
       çalışmaz, DB'de kalıntı durur. Üç saati geçmiş bir sipariş panelde
       kesinlikle yok, ekranda da göstermiyoruz.

       `updated_at` de bakılıyor: eklenti siparişe her dokunduğunda bu alan
       tazeleniyor. Yani "panel hâlâ bu siparişi gösteriyor" demek. Yalnız
       sepet zamanına bakmak uzun süren siparişleri haksız yere gizliyordu. */
    var ESKIME_MS = 3 * 60 * 60 * 1000;

    function eskimisMi(s) {
        var damgalar = [s.updated_at, s.sepet_zamani, s.created_at];
        var enYeni = 0;
        for (var i = 0; i < damgalar.length; i++) {
            if (!damgalar[i]) continue;
            var t = new Date(damgalar[i]).getTime();
            if (isFinite(t) && t > enYeni) enYeni = t;
        }
        if (!enYeni) return false;
        return (Date.now() - enYeni) > ESKIME_MS;
    }

    function panelBitirmisMi(s) { return KOLON_BITTI.test(kolonAdi(s)); }

    function panelBandi(s) {
        var k = kolonAdi(s);
        if (KOLON_BITTI.test(k)) return 'bitti';
        if (KOLON_YOLDA.test(k)) return 'yolda';
        if (KOLON_HAZIR.test(k)) return 'hazir';
        return 'hazirlaniyor';
    }

    /** Panelde biten siparişleri sunucuda da kapatır. Bir kez yazar. */
    async function bitenleriKapat(liste) {
        var kapatilacak = liste.filter(function (s) {
            return s.toplama_durumu !== 'toplandi' && panelBitirmisMi(s);
        });
        if (!kapatilacak.length) return false;
        for (var i = 0; i < kapatilacak.length; i++) {
            kapatilacak[i].toplama_durumu = 'toplandi';
            await siparisDurumu(kapatilacak[i], 'toplandi', true);
        }
        return true;
    }

    /*
     * Kurye alıp gittiyse kayıt yer kaplamasın: sipariş veritabanından
     * siliniyor, kapananlar listesinde de görünmüyor. "El değiştiriliyor"
     * silinmiyor; kurye henüz depoda olabiliyor, o aşamada sipariş
     * kapananlarda dursun ki bakılabilsin. Yolda/ulaştı/teslim/iptal ise
     * iş bitmiş demektir.
     *
     * Eskiyen kayıtlar da gidiyor: panelden düşmüş, bir daha güncellenmeyecek
     * ve kimsenin işine yaramayan satırlar.
     *
     * `order_items` foreign key'de ON DELETE CASCADE; ürün satırları
     * siparişle birlikte gidiyor, ayrı silme gerekmiyor.
     */
    var GIDEN_KOLON = /(teslim|iptal|tamamlan)/;
    function gitmisMi(s) {
        var k = kolonAdi(s);
        if (GIDEN_KOLON.test(k)) return true;
        if (eskimisMi(s)) return true;
        return false;
    }

    /* Tek istekte siliniyor. Önceden her kayıt için ayrı DELETE atılıyordu;
       yirmi kalıntı yirmi gidiş dönüş demekti ve arada biri patlarsa
       gerisi yarım kalıyordu. */
    var SILME_PARCA = 80;

    async function gidenleriSil(liste) {
        var d = db();
        if (!d) return [];
        var silinecek = liste.filter(gitmisMi).map(function (s) { return s.id; });
        if (!silinecek.length) return [];

        var silinen = [];
        for (var i = 0; i < silinecek.length; i += SILME_PARCA) {
            var parca = silinecek.slice(i, i + SILME_PARCA);
            var sonuc = await d.from('orders').delete().in('id', parca);
            if (!sonuc.error) silinen = silinen.concat(parca);
        }
        return silinen;
    }

    /* ÇÖP TOPLAMA
       Pencere dışındaki kayıtlar artık hiç çekilmiyor, dolayısıyla
       `gidenleriSil` onları göremiyor: görmediğini silemez. Geçmişte
       birikmiş ne varsa burada tek istekle gidiyor.

       Silme ölçütü zaman, kolon değil. Panelde üç saattir dokunulmamış
       bir sipariş yok; eklenti nabzı duran her siparişin damgasını
       dakikada bir tazeliyor. Eklenti hiç çalışmasa bile bu temizlik
       site tarafından yürüyor, yani çöp tek bir zincire bağlı değil. */
    var COP_ARALIK_MS = 10 * 60 * 1000;
    var sonCopToplama = 0;

    async function copToplama() {
        var o = oturum();
        var d = db();
        if (!o || !o.username || !d) return 0;
        if (Date.now() - sonCopToplama < COP_ARALIK_MS) return 0;
        sonCopToplama = Date.now();

        var sinir = new Date(Date.now() - ESKIME_MS).toISOString();
        var sonuc = await d.from('orders')
            .delete()
            .eq('username', o.username)
            .lt('updated_at', sinir);
        return sonuc && sonuc.error ? 0 : 1;
    }

    function bandaGore(s) {
        if (eskimisMi(s)) return 'bitti';
        return panelBandi(s);
    }

    /** "2 dk.", "1 sa. 20 dk." */
    function gecenSure(s) {
        var t = s.sepet_zamani || s.created_at;
        if (!t) return '';
        var ms = Date.now() - new Date(t).getTime();
        if (!isFinite(ms) || ms < 0) return '';
        var dk = Math.floor(ms / 60000);
        if (dk < 1) return 'az önce';
        if (dk < 60) return dk + ' dk.';
        return Math.floor(dk / 60) + ' sa. ' + (dk % 60) + ' dk.';
    }

    function saatYaz(t) {
        if (!t) return '';
        var d = new Date(t);
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function basHarfler(ad) {
        var p = String(ad || '').trim().split(/\s+/).filter(Boolean);
        if (!p.length) return '–';
        if (p.length === 1) return p[0].slice(0, 2).toLocaleUpperCase('tr');
        return (p[0][0] + p[p.length - 1][0]).toLocaleUpperCase('tr');
    }

    /* Kategori tanımları: hangi kelime hangi bandı tetikliyor, rengi ne.
       Yerleşik üçü (fırın/dondurma/su) `siparis-sirala.js`in varsayılanından
       geliyor; kullanıcı ayarlardan hem bunların kelimelerini değiştirebiliyor
       hem yepyeni bir kategori açabiliyor. "Diğer ürünler" bandının belirli
       bir kategorisi yok, sabit gri kalıyor. */
    function kategoriBul(bant) {
        return (durum.kategoriler || []).filter(function (k) { return k.kume === bant; })[0] || null;
    }

    function bantRengi(bant) {
        if (!bant || bant === 'orta') return '#98a2b3';
        var k = kategoriBul(bant);
        return (k && k.renk) || '#98a2b3';
    }

    function bantEtiket(bant) {
        if (!bant || bant === 'orta') return 'Diğer ürünler';
        var k = kategoriBul(bant);
        return (k && k.etiket) || bant;
    }

    /** `siparis-sirala.js`e verilecek biçim: yalnız sınıflandırmada gereken alanlar. */
    function kategoriKurallari() {
        return (durum.kategoriler || []).map(function (k) {
            return { kume: k.kume, etiket: k.etiket, urunler: k.urunler, dahil: k.dahil, haric: k.haric };
        });
    }

    /** Siparişin bant dağılımı: [{bant, sayi}] çoktan aza. */
    function bantDagilimi(s) {
        var sayim = {};
        (s.urunler || []).forEach(function (u) {
            var b = u.toplamaBandi || 'orta';
            sayim[b] = (sayim[b] || 0) + 1;
        });
        return Object.keys(sayim)
            .map(function (b) { return { bant: b, sayi: sayim[b] }; })
            .sort(function (a, b) { return b.sayi - a.sayi; });
    }

    /** Renk + beyaz karışımı, kart zemininde soluk bir ipucu. */
    function pastel(hex) {
        return 'color-mix(in srgb, ' + hex + ' 14%, white)';
    }

    /**
     * Kart zemini siparişin içindeki kategorileri gösteriyor: tek kategori
     * varsa düz soluk renk, birden fazlaysa yatay şeritler halinde bölünmüş
     * gradyan. "Diğer ürünler" zemine yansımıyor, yalnız fırın/dondurma/su.
     */
    function kartArkaPlan(s) {
        var dagilim = bantDagilimi(s).filter(function (x) { return x.bant !== 'orta'; });
        if (!dagilim.length) return '#ffffff';
        var renkler = dagilim.map(function (x) { return pastel(bantRengi(x.bant)); });
        if (renkler.length === 1) return renkler[0];
        var adim = 100 / renkler.length;
        var duraklar = [];
        renkler.forEach(function (r, i) {
            duraklar.push(r + ' ' + (i * adim).toFixed(2) + '%');
            duraklar.push(r + ' ' + ((i + 1) * adim).toFixed(2) + '%');
        });
        return 'linear-gradient(90deg, ' + duraklar.join(', ') + ')';
    }

    var TIK = '<svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-9"/></svg>';
    var OK_SAG = '<svg viewBox="0 0 18 18"><path d="m7 4 5 5-5 5"/></svg>';
    var POSET_IKON = '<svg class="sip-poset-ikon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l1.2 13.2a1 1 0 0 1-1 1.1H5.8a1 1 0 0 1-1-1.1L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>';

    // ==================================================================
    // Çizim: sipariş kartı
    // ==================================================================

    var BAS_RENKLER = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];
    function basRenk(ad) {
        var h = 0;
        for (var i = 0; i < ad.length; i++) h = ad.charCodeAt(i) + ((h << 5) - h);
        return BAS_RENKLER[Math.abs(h) % BAS_RENKLER.length];
    }

    var BOS_ICON_KURYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/><path d="M15 17.5h-4L8 8h3l1.5 3h5.5l-1.5 5"/></svg>';
    var BOS_ICON_TOPLAYICI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.4-3.6 4.2-5.5 7-5.5s5.6 1.9 7 5.5"/></svg>';

    /* Kişi fotoğrafını sayfaya bir kez indir. Sonraki `ciz`'lerde
       aynı URL browser cache'ten anında paint edilir, harflerden
       fotoğrafa "zıplama" olmuyor. */
    var _fotoOnbellek = new Set();
    /* Yüklenmiş fotoğraflar. Kart yeniden kurulsa bile (başka şeride
       geçince) bu adreslerdeki fotoğraf görünür başlıyor; saydamdan
       belirme geçişi tekrar oynamıyor, fotoğraf bir an kaybolmuyor. */
    var _fotoYuklu = new Set();
    function fotoOnyukle(url) {
        if (!url || _fotoOnbellek.has(url)) return;
        _fotoOnbellek.add(url);
        var img = new Image();
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.onload = function () { _fotoYuklu.add(url); };
        img.src = url;
    }

    function kisiCip(ad, foto, kurye) {
        var varMi = !!ad;
        var bas = varMi ? basHarfler(ad) : '';
        var renk = varMi ? basRenk(ad) : '#cbd5e1';
        /* Foto varsa harf yazma; harf → foto geçişi göz yoruyordu.
           Foto yüklenene kadar sadece renkli daire görünür, sonra
           `yuklu` sınıfıyla belirir. Cache'ten geliyorsa yükleme
           anlıktır ve geçiş görülmez. */
        var fotoHtml = (varMi && foto)
            ? '<img src="' + kacir(foto) + '" alt="" decoding="async" referrerpolicy="no-referrer"' +
              (_fotoYuklu.has(foto) ? ' class="yuklu"' : ' onload="this.classList.add(\'yuklu\')"') +
              ' onerror="this.remove()">'
            : '';
        var icerik = varMi
            ? (foto ? '' : '<b>' + kacir(bas) + '</b>')
            : (kurye ? BOS_ICON_KURYE : BOS_ICON_TOPLAYICI);
        return '<span class="sip-kart__kisi' + (kurye ? ' sip-kart__kisi--kurye' : '') +
                    (varMi ? '' : ' sip-kart__kisi--bos') + '">' +
            '<span class="sip-kart__bas" style="background:' + renk + '">' +
                fotoHtml + icerik +
            '</span>' +
            (varMi ? '<span class="sip-kart__kisiad">' + kacir(ad) + '</span>' : '') +
        '</span>';
    }

    function kartCiz(s, sira) {
        var urunler = s.urunler || [];
        var toplam = toplamAdet(urunler);
        var alinan = alinanAdet(urunler);
        /* Ürünler henüz gelmediyse panel künyesindeki toplam_adet
           göstergesine düş; kullanıcı "3 parça var" bilsin. */
        if (!toplam && s.toplam_adet != null) toplam = Number(s.toplam_adet) || 0;
        var oran = toplam ? Math.round(alinan / toplam * 100) : 0;
        var kimlik = siparisKimligi(s);
        var tam = oran === 100 && toplam > 0;

        var kisiler = kisiCip(s.toplayici, s.toplayici_foto, false) +
                      kisiCip(s.kurye, s.kurye_foto, true);

        return '<button type="button" class="sip-kart' + (sira != null ? ' sip-kart--gir' : '') +
               (tam ? ' sip-kart--tam' : '') +
               '" data-siparis="' + kacir(s.id) + '" style="--kart-zemin:' + kartArkaPlan(s) +
               ';--i:' + (sira || 0) + '" aria-label="' + kacir(kimlik.deger) + ' siparişini aç">' +
            '<span class="sip-kart__ust">' +
                '<strong class="sip-kart__numara' + (kimlik.bankoVar ? '' : ' sip-kart__numara--yok') + '">' + kacir(kimlik.deger) + '</strong>' +
                '<span class="sip-kart__sure">' + kacir(gecenSure(s)) + '</span>' +
            '</span>' +
            '<span class="sip-kart__kisiler">' + kisiler + '</span>' +
            '<span class="sip-kart__ilerleme">' +
                '<span><i style="width:' + oran + '%"></i></span>' +
                '<strong>' + alinan + '<span>/' + toplam + ' parça</span></strong>' +
            '</span>' +
        '</button>';
    }

    // ==================================================================
    // Çizim: ürün satırı / kutucuğu
    // ==================================================================

    /* Satırda tek barkod duruyor: depocu okutacağı kodu aramasın. Fazlası
       varsa ada dokununca açılan pencerede hepsi görünüyor. */
    /* Ürünün barkodlarının hepsi satırda. Önceden yalnız ilki yazılıp
       gerisi "+2" rozetine sıkışıyordu; depocu elindeki kodu listede
       göremeyip her seferinde pencereyi açmak zorunda kalıyordu. Üçten
       fazlası satırı şişirdiği için gerisi rozette kalıyor. */
    function kodCiz(bilgi) {
        if (!bilgi.barkodlar.length) return '<span class="sip-kod sip-kod--yok">barkod yok</span>';
        return '<span class="sip-kod">' + kacir(bilgi.barkodlar[0]) + '</span>';
    }

    function urunNotYaz(u) {
        var miktar = adetYaz(u.adet);
        return u.birim ? (miktar + ' ' + u.birim + ' alınacak') : (miktar + ' adet alınacak');
    }

    /**
     * Ürün görselinin adresi. Önce panelden gelen, o yoksa katalogdaki.
     * İkisi de yoksa boş kutu çiziliyor.
     */
    function urunGorseli(u, bilgi) {
        if (u.gorsel) return u.gorsel;
        return (bilgi && bilgi.katalogGorsel) || '';
    }

    /* Görsel yüklenemedi: varsa katalog adresine bir kez düş, o da
       tutmazsa kutuyu "Görsel yok" durumuna al. Kırık görsel simgesi
       bırakmıyoruz. Satır içi `onerror`'dan çağrılıyor. */
    global.JBUrunGorselHata = function (img) {
        if (!img) return;
        var yedek = img.getAttribute('data-yedek');
        if (yedek && img.getAttribute('src') !== yedek) {
            img.removeAttribute('data-yedek');
            img.setAttribute('src', yedek);
            return;
        }
        var kap = img.parentElement;
        img.remove();
        if (kap && kap.classList) {
            kap.classList.add('sip-urun__gorsel--bos');
            kap.removeAttribute('data-buyut');
        }
    };

    function urunCiz(u, sira) {
        var bilgi = barkodBul(u);
        var adres = urunGorseli(u, bilgi);
        /* Panel adresi yüklenemezse katalog adresine düşülüyor; o da
           tutmazsa kutu boş görünüyor (kırık görsel simgesi kalmıyor).
           `data-yedek` yalnız iki adres farklıysa yazılıyor. */
        var yedek = (u.gorsel && bilgi.katalogGorsel && bilgi.katalogGorsel !== u.gorsel)
            ? bilgi.katalogGorsel : '';
        var gorsel = adres
            ? '<button type="button" class="sip-urun__gorsel" data-buyut="' + u.sira + '" aria-label="' +
                  kacir(urunBasligi(u, bilgi)) + ' görselini büyüt">' +
                  '<img src="' + kacir(adres) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                  (yedek ? ' data-yedek="' + kacir(yedek) + '"' : '') +
                  ' onerror="JBUrunGorselHata(this)"></button>'
            : '<span class="sip-urun__gorsel sip-urun__gorsel--bos"></span>';

        return '<div class="sip-urun' + (u.alindi ? ' sip-urun--alindi' : '') +
               '" data-sira="' + u.sira + '" style="--i:' + Math.min(Math.max((sira || 1) - 1, 0), 16) + '">' +
            gorsel +
            '<div class="sip-urun__bilgi">' +
                '<button type="button" class="sip-urun__ad" data-barkod="' + u.sira + '"' +
                    ' aria-label="Barkodları göster">' +
                    '<span>' + kacir(urunBasligi(u, bilgi)) + '</span>' +
                '</button>' +
                '<span class="sip-urun__not">' + urunNotYaz(u) + '</span>' +
            '</div>' +
            '<div class="sip-urun__eylem">' +
                '<span class="sip-adet' + (u.birim ? ' sip-adet--birim' : '') +
                    (!u.birim && urunAdet(u) > 1 ? ' sip-adet--coklu' : '') +
                    '" data-adet="' + kacir(adetYaz(u.adet)) + '">' + adetYaz(u.adet) +
                    (u.birim ? '<u>' + kacir(u.birim) + '</u>' : '') + '</span>' +
                '<button type="button" class="sip-al" data-isaretle="' + u.sira + '"' +
                    ' aria-pressed="' + (u.alindi ? 'true' : 'false') +
                    '" aria-label="Alındı olarak işaretle">' + TIK + '</button>' +
            '</div>' +
        '</div>';
    }

    /**
     * Ardışık aynı bantları gruplar. Hem çizim hem sayaç tazeleme aynı
     * gruplamayı kullanıyor ki ikisi birbirinden ayrı düşmesin.
     */
    function bantlariTopla(urunler) {
        var gruplar = [];
        var suanki = null;
        urunler.forEach(function (u) {
            var b = u.toplamaBandi || 'orta';
            if (b !== suanki) { gruplar.push({ bant: b, urunler: [] }); suanki = b; }
            gruplar[gruplar.length - 1].urunler.push(u);
        });
        return gruplar;
    }

    /**
     * Ürünleri bantlara ayırıp her bandın üstüne başlık koyar. Numara rozeti
     * bantları aşıp tüm siparişte kesintisiz devam ediyor; depocu "12
     * üründen kaçıncısındayım" diye tek bakışta görüyor. Her bant kendi
     * bölümünde: yapışkan başlıklar aynı kapsayıcıda olsaydı geçilen
     * bantların başlıkları tepede üst üste yığılırdı.
     */
    function bantlaraAyir(urunler) {
        var sayac = 0;
        return bantlariTopla(urunler).map(function (g) {
            var toplam = toplamAdet(g.urunler);
            var alinan = alinanAdet(g.urunler);
            return '<section class="sip-bolum">' +
                '<div class="sip-bant' + (alinan === toplam ? ' sip-bant--bitti' : '') +
                '" style="--bant:' + bantRengi(g.bant) + '">' +
                    '<i></i><b>' + kacir(bantEtiket(g.bant)) + '</b><s></s>' +
                    '<span>' + alinan + '/' + toplam + '</span>' +
                '</div>' +
                g.urunler.map(function (u) { sayac++; return urunCiz(u, sayac); }).join('') +
            '</section>';
        }).join('');
    }

    /* Panelden fotoğraf adresi geldiyse yüz görünüyor, gelmediyse baş
       harfler. Adres bozuksa `onerror` ile baş harflere düşülüyor; kırık
       görsel simgesi bırakmak en kötüsü. */
    function yanKisiler(s) {
        var satir = function (ad, foto, rol, kurye, aktif) {
            var bas = kacir(basHarfler(ad));
            var ic = (ad && foto)
                ? '<img src="' + kacir(foto) + '" alt="" referrerpolicy="no-referrer"' +
                  ' onerror="this.remove()"><b>' + bas + '</b>'
                : bas;
            var sinif = 'sip-avatar' + (kurye ? ' sip-avatar--kurye' : '') +
                    (ad ? '' : ' sip-avatar--bos') + (ad && foto ? ' sip-avatar--foto' : '');
            var avatar = (ad && foto)
                ? '<button type="button" class="' + sinif + '" data-kisi-foto="' + kacir(foto) +
                  '" data-kisi-ad="' + kacir(ad) + '" data-kisi-rol="' + rol + '" aria-label="' +
                  kacir(ad) + ' fotoğrafını büyüt">' + ic + '</button>'
                : '<span class="' + sinif + '">' + ic + '</span>';
            return '<div class="sip-kisi-satir">' + avatar +
                '<div><small>' + rol + '</small><strong>' + kacir(ad || 'Atanmadı') + '</strong></div>' +
                (ad && aktif ? '<span class="sip-kisi-durum"><i></i>Aktif</span>' : '') +
            '</div>';
        };
        return '<p class="sip-yan-etiket">GÖREVLİLER</p>' +
               satir(s.toplayici, s.toplayici_foto, 'Toplayıcı', false, true) +
               satir(s.kurye, s.kurye_foto, 'Kurye', true, false);
    }

    var BOS_IKON = '<svg viewBox="0 0 24 24"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3"/></svg>';

    /* Ürün işaretlenince bütün gövdeyi yeniden çizmek iki şeyi bozuyordu:
       kaydırma başa dönüyor ve bütün satırlar yeniden beliriyordu. Artık
       yalnız o satır ve sayaçlar güncelleniyor. */
    function satiriTazele(urun) {
        var oge = el('detayGovde').querySelector('[data-sira="' + urun.sira + '"]');
        if (oge) {
            oge.classList.toggle('sip-urun--alindi', !!urun.alindi);
            var d = oge.querySelector('[data-isaretle]');
            if (d) d.setAttribute('aria-pressed', urun.alindi ? 'true' : 'false');
        }
        ilerlemeyiTazele();
    }

    /* TİK HİSSİ
       Tek adetli üründe kısa ve net bir onay: düğme hafifçe büzülüp
       açılıyor, tik çiziliyor, satır yeşile dolarak dönüyor.

       Çoklu adette ekranın kenarları adet kadar nabız atıyor (oyunlarda
       hasar alınca kenarda beliren ışık gibi) ve satırın ortasında
       "×3 ADET" damgası beliriyor. Renk adetle değişiyor: 2 mavi, 3 mor,
       4 turuncu, 5 ve üstü kırmızı; yani göz rengi tanıdıkça sayıyı
       okumadan anlıyor. Destekleyen telefonda aynı sayıda titreşim de var.

       Hepsi `pointer-events: none` ve yalnız transform/opacity: liste
       akmıyor, sonraki dokunuşu engellemiyor. Azaltılmış harekette nabız
       ve büyüme yok, damga sakin görünüp kayboluyor. */
    var COKLU_RENK = { 2: '#2563eb', 3: '#7c3aed', 4: '#d97706', 5: '#d92d20' };

    function titret(alindi, n) {
        try {
            if (!navigator.vibrate || !durum.efekt.titresim) return;
            if (!alindi) { navigator.vibrate(8); return; }
            if (n <= 1) { navigator.vibrate(14); return; }
            var desen = [];
            for (var i = 0; i < Math.min(n, 5); i++) desen.push(26, 60);
            navigator.vibrate(desen);
        } catch (e) { /* desteklenmiyor */ }
    }

    var _duyuruSaati = null;
    function canliDuyur(metin) {
        var b = el('sipDuyuru');
        if (!b) return;
        b.textContent = '';
        clearTimeout(_duyuruSaati);
        _duyuruSaati = setTimeout(function () { b.textContent = metin; }, 30);
    }

    function cokluEfektKatmani() {
        var e = el('sipCokluEfekt');
        if (e) return e;
        e = document.createElement('div');
        e.id = 'sipCokluEfekt';
        e.className = 'sip-coklu-efekt';
        e.setAttribute('aria-hidden', 'true');
        document.body.appendChild(e);
        return e;
    }

    function isaretEfekti(urun, alindi) {
        var n = urun.birim ? 1 : urunAdet(urun);
        titret(alindi, n);
        var oge = el('detayGovde').querySelector('[data-sira="' + urun.sira + '"]');
        if (!oge) return;

        oge.classList.remove('sip-urun--tik', 'sip-urun--geri');
        void oge.offsetWidth;
        if (!alindi) { oge.classList.add('sip-urun--geri'); return; }
        oge.classList.add('sip-urun--tik');
        if (n <= 1) return;
        cokluEfektOynat(oge, n);
    }

    /* Kenar ışığının sertliği (0-100) üç şeyi birlikte ayarlıyor: en
       parlak anın opaklığı, kenardaki hattın kalınlığı ve içe sönen
       ışığın genişliği. */
    function kenarIsigiAyarla(ef, renk, guc) {
        var g = Math.max(0, Math.min(100, guc)) / 100;
        ef.style.setProperty('--efekt-renk', renk);
        ef.style.setProperty('--efekt-tepe', (0.2 + 0.75 * g).toFixed(2));
        ef.style.boxShadow = 'inset 0 0 0 ' + Math.round(2 + 4 * g) + 'px ' + renk +
            ', inset 0 0 ' + Math.round(28 + 64 * g) + 'px ' + Math.round(4 + 10 * g) + 'px ' + renk;
    }

    function cokluEfektOynat(oge, n) {
        var mod = durum.efekt.mod;
        if (mod === 'kapali') { canliDuyur(n + ' adet alındı'); return; }
        var m = Math.min(n, 5);
        var renk = COKLU_RENK[m];

        if (mod === 'tam') {
            var ef = cokluEfektKatmani();
            kenarIsigiAyarla(ef, renk, durum.efekt.guc);
            ef.style.setProperty('--n', m);
            ef.classList.remove('oyna');
            void ef.offsetWidth;
            ef.classList.add('oyna');
            clearTimeout(ef._saat);
            ef._saat = setTimeout(function () { ef.classList.remove('oyna'); }, 1300);
        }

        if (!oge) { canliDuyur(n + ' adet alındı'); return; }
        var eski = oge.querySelector('.sip-damga');
        if (eski) eski.remove();
        var damga = document.createElement('span');
        damga.className = 'sip-damga';
        damga.setAttribute('aria-hidden', 'true');
        damga.style.setProperty('--efekt-renk', renk);
        damga.innerHTML = '<b>×' + n + '</b><small>ADET</small>';
        oge.appendChild(damga);
        setTimeout(function () { if (damga.parentNode) damga.remove(); }, 1200);

        var kutu = oge.querySelector('.sip-adet');
        if (kutu) {
            kutu.style.setProperty('--n', m);
            kutu.style.setProperty('--efekt-renk', renk);
            kutu.classList.remove('sip-adet--nabiz');
            void kutu.offsetWidth;
            kutu.classList.add('sip-adet--nabiz');
        }
        canliDuyur(n + ' adet alındı');
    }

    /** Bant sayaçları, yan panel, alt çubuk ve bitir düğmesi. */
    function ilerlemeyiTazele() {
        var s = durum.secili;
        if (!s) return;
        var urunler = s.urunler || [];
        var alinan = alinanAdet(urunler);
        var toplam = toplamAdet(urunler);
        var oran = toplam ? Math.round(alinan / toplam * 100) : 0;
        var tam = oran === 100 && toplam > 0;

        var basliklar = el('detayGovde').querySelectorAll('.sip-bant');
        bantlariTopla(urunler).forEach(function (g, i) {
            var b = basliklar[i];
            if (!b) return;
            var gt = toplamAdet(g.urunler);
            var ga = alinanAdet(g.urunler);
            b.querySelector('span').textContent = ga + '/' + gt;
            b.classList.toggle('sip-bant--bitti', ga === gt);
        });

        el('olcuAlindi').textContent = alinan + '/' + toplam;
        el('araclarSayi').textContent = alinan + '/' + toplam;
        el('yanSayac').textContent = alinan + ' / ' + toplam + ' parça';
        el('altAlinan').textContent = alinan;
        el('altToplam').textContent = toplam;

        [el('yanYol'), el('altYol')].forEach(function (y) {
            y.firstElementChild.style.width = oran + '%';
            y.classList.toggle('tam', tam);
        });

        /* BİTİR
           Üç hâl: toplama sürüyor (Bitir), hepsi alındı (Tamamla), sipariş
           toplandı (Toplandı, dokununca yalnız kapanır). Eskiden toplandıktan
           sonra düğme "Geri al"a dönüyordu; yanlışlıkla basılınca iş geri
           açılıyordu. Geri açmak gerekiyorsa bir ürünün tikini kaldırmak
           yeter, sipariş kendiliğinden toplanıyor durumuna döner. */
        var bitir = el('detayBitir');
        var hal = !toplam ? 'bos' : (s.toplama_durumu === 'toplandi' ? 'bitti' : (tam ? 'tam' : 'suruyor'));
        bitir.setAttribute('data-hal', hal);
        bitir.querySelector('span').textContent = hal === 'bitti' ? 'Toplandı' : (hal === 'tam' ? 'Tamamla' : 'Bitir');
        bitir.classList.toggle('sip-bitir--tam', hal === 'tam');
        bitir.classList.toggle('sip-bitir--bitti', hal === 'bitti');
        bitir.disabled = hal === 'bos';
    }

    // ==================================================================
    // Çizim: şeritler + detay
    // ==================================================================

    var ISKELET_SAYISI = 2;

    /**
     * Tek bir şeridi (Hazırlanıyor ya da Hazırlandı) çizer. Kartlar yalnız
     * liste gerçekten değiştiğinde sıralı beliriyor; her yoklamada oynasa
     * ekran titrerdi. Şeritler birbirinden bağımsız: biri değişirken öbürü
     * yeniden yazılmıyor.
     *
     * @returns {Array} o şeritteki siparişler (sayaç ve toplam için)
     */
    /* Şerit başlığındaki rozet bunları sırayla geziyor. Etiket rozette
       yazılı duruyor: eskiden yalnız `title` vardı, dokunmatikte hover
       olmadığı için depocu hangi sıralamada olduğunu göremiyordu. */
    var SIRA_IKON = {
        sure:     '<svg viewBox="0 0 20 20"><path d="M10 4v12M6 12l4 4 4-4"/></svg>',
        sureTers: '<svg viewBox="0 0 20 20"><path d="M10 16V4M6 8l4-4 4 4"/></svg>',
        temiz:    '<svg viewBox="0 0 20 20"><path d="M3 5h14M3 10h9M3 15h5"/></svg>',
        banko:    '<svg viewBox="0 0 20 20"><path d="M7 3v14M13 3v14M3 7h14M3 13h14"/></svg>',
        kurye:    '<svg viewBox="0 0 20 20"><path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 17c0-3 2.7-5 6-5s6 2 6 5"/></svg>'
    };

    var SIRA_SECENEKLERI = [
        { anahtar: 'sure',     kisa: 'Eski önce',  etiket: 'En eski sipariş başta' },
        { anahtar: 'sureTers', kisa: 'Yeni önce',  etiket: 'En yeni sipariş başta' },
        { anahtar: 'temiz',    kisa: 'Kolay önce', etiket: 'Kategorisiz siparişler başta, ağır olanlar sonda' },
        { anahtar: 'banko',    kisa: 'Banko',      etiket: 'Banko numarasına göre' },
        { anahtar: 'kurye',    kisa: 'Kurye',      etiket: 'Kurye adına göre' }
    ];

    /* KATEGORİ YÜKÜ
       Depocu önce kolay siparişi alıp bankoya bırakmak istiyor: içinde
       fırın ya da dondurma olmayan sipariş tek turda toplanıyor, dondurmalı
       olan dolabı açmayı gerektiriyor.

       Yük iki sayıdan oluşuyor. Birincisi siparişin içindeki EN AĞIR
       kategori; ağırlık sırasını kullanıcı ayarlardan diziyor. İkincisi
       kaç ayrı kategori olduğu, çünkü "fırın" tek turdur ama "fırın + su"
       iki ayrı rafa gitmek demektir. Hiç kategorisi olmayan sipariş, yani
       kartı beyaz görünen sipariş, en hafif olanıdır.

       Ürünleri henüz gelmemiş sipariş de beyaz sayılıyor; kartı da beyaz
       çiziliyor, yani ekranla tutarlı. */
    function kategoriYuku(s) {
        var sira = durum.yukSirasi || [];
        var gorulen = {};
        (s.urunler || []).forEach(function (u) {
            var b = u.toplamaBandi || 'orta';
            if (b && b !== 'orta') gorulen[b] = true;
        });
        var bantlar = Object.keys(gorulen);
        if (!bantlar.length) return [0, 0];
        var enAgir = 0;
        bantlar.forEach(function (b) {
            var i = sira.indexOf(b);
            enAgir = Math.max(enAgir, i < 0 ? sira.length + 1 : i + 1);
        });
        return [enAgir, bantlar.length];
    }

    function bankoSiraDegeri(s) {
        var k = siparisKimligi(s);
        if (!k.bankoVar) return 99999;
        var m = String(k.deger).match(/\d+/);
        return m ? parseInt(m[0], 10) : 99999;
    }

    /*
     * Şu an fiilen toplanan sipariş şeridin en üstünde durur.
     *
     * Hazırlanıyor şeridimiz panelin üç sütununu birden topluyor:
     * Toplayıcı Bekliyor, Hazırlanıyor, Doğrulanıyor. Depocunun elindeki
     * iş bunların yalnız biri: toplayıcı atanmış ve panelde Hazırlanıyor
     * sütununda duran sipariş. Onu aramak için listeyi taramasın.
     *
     * Toplayıcı adı eklentiden bir tur geç gelebiliyor. O aradaki sipariş
     * en dibe düşmesin diye ikinci kademeye alınıyor.
     *
     * Seçilen sıralama kriteri (süre / banko / kurye) iptal olmuyor,
     * grupların İÇİNDE çalışmaya devam ediyor.
     */
    var KOLON_TOPLANIYOR = /hazirlaniyor/;

    function aktifToplamaSirasi(s) {
        if (!KOLON_TOPLANIYOR.test(kolonAdi(s))) return 2;
        return String(s.toplayici || '').trim() ? 0 : 1;
    }

    function zamanDegeri(s) {
        var t = new Date(s.sepet_zamani || s.created_at || 0).getTime();
        return isFinite(t) ? t : 0;
    }

    function sirala(liste, kriter) {
        var karsilastir;
        if (kriter === 'banko') {
            karsilastir = function (a, b) { return bankoSiraDegeri(a) - bankoSiraDegeri(b); };
        } else if (kriter === 'sureTers') {
            karsilastir = function (a, b) { return zamanDegeri(b) - zamanDegeri(a); };
        } else if (kriter === 'temiz') {
            karsilastir = function (a, b) {
                var ya = kategoriYuku(a);
                var yb = kategoriYuku(b);
                /* Eşit yükte en eski sipariş öne geçiyor; iki kolay sipariş
                   arasında bekleyeni seçmek doğru olan. */
                return (ya[0] - yb[0]) || (ya[1] - yb[1]) || (zamanDegeri(a) - zamanDegeri(b));
            };
        } else if (kriter === 'kurye') {
            karsilastir = function (a, b) {
                var ka = (a.kurye || '').toLocaleLowerCase('tr');
                var kb = (b.kurye || '').toLocaleLowerCase('tr');
                if (!ka && !kb) return zamanDegeri(a) - zamanDegeri(b);
                if (!ka) return 1;
                if (!kb) return -1;
                return ka.localeCompare(kb, 'tr') || (zamanDegeri(a) - zamanDegeri(b));
            };
        } else {
            karsilastir = function (a, b) { return zamanDegeri(a) - zamanDegeri(b); };
        }

        return liste.slice().sort(function (a, b) {
            return (aktifToplamaSirasi(a) - aktifToplamaSirasi(b)) || karsilastir(a, b);
        });
    }

    function seritCiz(bant, listeId, bosId, imzaAnahtari) {
        var liste = durum.siparisler.filter(function (s) { return bandaGore(s) === bant; });
        liste = sirala(liste, durum.seritSira[bant] || 'sure');
        var kutu = el(listeId);

        var kartImza = durum.yukleniyor ? 'y' : liste.map(function (s) { return s.id; }).join(',');
        var kartYeni = kartImza !== durum.kartImzasi[imzaAnahtari];
        durum.kartImzasi[imzaAnahtari] = kartImza;

        if (durum.yukleniyor) {
            var iskelet = '';
            for (var i = 0; i < ISKELET_SAYISI; i++) iskelet += '<div class="sip-iskelet"></div>';
            kutu.innerHTML = iskelet;
            el(bosId).hidden = true;
        } else if (!liste.length) {
            kutu.innerHTML = '';
            el(bosId).hidden = false;
        } else {
            el(bosId).hidden = true;
            seritiYamala(kutu, liste, kartYeni);
        }
        return liste;
    }

    /* KARTLAR YERİNDE GÜNCELLENİYOR
       Eskiden her çizimde (her tikte, detaya girip çıkınca, her yoklamada)
       şeridin bütün kartları silinip yeniden yazılıyordu. Kurye ve
       toplayıcı fotoğrafları da yeniden yükleniyor, milisaniyelik bir an
       kaybolup geri geliyordu; ekran bozuluyormuş gibi görünüyordu.

       Şimdi kartlar sipariş kimliğiyle eşleniyor. Değişmeyen kart hiç
       ellenmiyor. Değişende yalnız değişen parça değişiyor: ilerleme
       çubuğu yerinde kayıyor, süre yazısı yerinde yazılıyor, kişi kısmı
       ancak kişi gerçekten değiştiyse yenileniyor. Yeni gelen kart
       belirme animasyonuyla giriyor, var olanlar bir daha oynamıyor. */
    var _kartParcalari = new WeakMap();
    var _kartSablonu = document.createElement('div');

    function kartParcala(html) {
        _kartSablonu.innerHTML = html;
        var dugum = _kartSablonu.firstElementChild;
        _kartSablonu.removeChild(dugum);
        return {
            dugum: dugum,
            /* Karşılaştırmada fotoğrafın yüklenme izi (yuklu sınıfı, onload)
               yok sayılıyor: yalnız fotoğraf yüklendi diye kişi kısmı
               yeniden kurulmasın. */
            parcalar: Array.prototype.map.call(dugum.children, function (c) {
                return c.outerHTML.replace(/ class="yuklu"| onload="[^"]*"/g, '');
            })
        };
    }

    function kartYamala(eski, yeni) {
        ['class', 'style', 'aria-label'].forEach(function (a) {
            var v = yeni.dugum.getAttribute(a);
            /* Belirme sınıfı ilk girişte kalsın; yeniden eklemek animasyonu
               baştan oynatır, kaldırmak ise etkisiz. */
            if (a === 'class' && eski.classList.contains('sip-kart--gir')) v = (v || '') + ' sip-kart--gir';
            if (eski.getAttribute(a) !== v) {
                if (v == null) eski.removeAttribute(a); else eski.setAttribute(a, v);
            }
        });
        var eskiParcalar = _kartParcalari.get(eski) || [];
        var yeniCocuklar = Array.prototype.slice.call(yeni.dugum.children);
        yeniCocuklar.forEach(function (yc, i) {
            if (eskiParcalar[i] === yeni.parcalar[i]) return;
            var ec = eski.children[i];
            if (!ec) { eski.appendChild(yc); return; }
            if (ec.classList.contains('sip-kart__ilerleme') && yc.classList.contains('sip-kart__ilerleme')) {
                // Çubuk yerinde kaysın: genişlik geçişi korunuyor
                var ei = ec.querySelector('i'); var yi = yc.querySelector('i');
                if (ei && yi) ei.style.width = yi.style.width;
                var es = ec.querySelector('strong'); var ys = yc.querySelector('strong');
                if (es && ys && es.innerHTML !== ys.innerHTML) es.innerHTML = ys.innerHTML;
                return;
            }
            eski.replaceChild(yc, ec);
        });
        while (eski.children.length > yeniCocuklar.length) eski.removeChild(eski.lastElementChild);
        _kartParcalari.set(eski, yeni.parcalar);
    }

    function seritiYamala(kutu, liste, kartYeni) {
        var mevcut = new Map();
        Array.prototype.slice.call(kutu.children).forEach(function (n) {
            var id = n.getAttribute('data-siparis');
            if (id && !mevcut.has(id)) mevcut.set(id, n);
            else kutu.removeChild(n);   // iskelet ya da yinelenen düğüm
        });
        var onceki = null;
        liste.forEach(function (s, idx) {
            var n = mevcut.get(s.id);
            if (n) {
                mevcut.delete(s.id);
                kartYamala(n, kartParcala(kartCiz(s, null)));
            } else {
                var p = kartParcala(kartCiz(s, kartYeni ? Math.min(idx, 12) : null));
                n = p.dugum;
                _kartParcalari.set(n, kartParcala(kartCiz(s, null)).parcalar);
            }
            var hedef = onceki ? onceki.nextSibling : kutu.firstChild;
            if (n !== hedef) kutu.insertBefore(n, hedef);
            onceki = n;
        });
        mevcut.forEach(function (n) { if (n.parentNode === kutu) kutu.removeChild(n); });
    }

    /**
     * Başlıktaki canlılık göstergesi.
     *
     * Eskiden burada "Canlı · 13:15" yazıyordu ama o saat SİTENİN
     * veritabanını okuduğu andı, verinin tazeliği değil. Depo panelinin
     * açık olduğu bilgisayarda eklenti sustuğunda (güncelleme sonrası
     * yetim kalan sekme, kapanan tarayıcı) veritabanı donuyor; site yine
     * "Canlı" diyordu ve kullanıcı saatler öncesinin siparişlerine
     * bakarken bunu bilmiyordu.
     *
     * Artık ölçü verinin kendisi: en son güncellenen siparişin damgası.
     * Eklenti yazmayı bıraktığı an bu damga eskimeye başlar ve gösterge
     * uyarıya döner.
     */
    /* Depo paneli dakikada bir nabız atıyor. İki buçuk dakika susarsa
       gecikme, on dakika susarsa kopukluk sayılıyor; eskiden yirmi
       dakika bekleniyordu ve kesinti saatlerce fark edilmiyordu. */
    var TAZE_MS = 150 * 1000;
    var KOPUK_MS = 10 * 60 * 1000;

    function verininYasi() {
        var enYeni = 0;
        (durum.siparisler || []).forEach(function (s) {
            var t = s && s.updated_at ? new Date(s.updated_at).getTime() : 0;
            if (isFinite(t) && t > enYeni) enYeni = t;
        });
        return enYeni ? (Date.now() - enYeni) : null;
    }

    /* Kopukluk yalnız küçük bir yazıyla anlatılınca depoda kimse fark
       etmiyordu. Listenin üstünde ne yapılacağını söyleyen bir şerit var. */
    function kopukSeridi(metin) {
        var b = el('sipKopuk');
        if (!b) return;
        if (!metin) { b.hidden = true; return; }
        b.hidden = false;
        b.querySelector('[data-kopuk-sure]').textContent = metin;
    }

    function canliliksGoster() {
        var kutu = el('sonGuncelleme');
        if (!kutu) return;
        kopukSeridi(null);
        var kap = kutu.closest('.sip-canli');
        var yas = verininYasi();

        /* Hiç sipariş yoksa yaş ölçülemez. Panel gerçekten boş olabilir,
           bu bir hata değil; site kendi okuma saatini gösteriyor. */
        if (yas === null) {
            var saat = durum.sonYenileme ? saatYaz(durum.sonYenileme) : null;
            kutu.textContent = 'Canlı · ' + (saat || 'yükleniyor');
            if (kap) kap.classList.remove('sip-canli--eski', 'sip-canli--kopuk');
            kutu.removeAttribute('title');
            return;
        }

        var dk = Math.floor(yas / 60000);
        if (yas < TAZE_MS) {
            kutu.textContent = 'Canlı · ' + saatYaz(Date.now() - yas);
            if (kap) kap.classList.remove('sip-canli--eski', 'sip-canli--kopuk');
            kutu.removeAttribute('title');
        } else if (yas < KOPUK_MS) {
            kutu.textContent = 'Veri ' + dk + ' dk. önce';
            if (kap) { kap.classList.add('sip-canli--eski'); kap.classList.remove('sip-canli--kopuk'); }
            kutu.setAttribute('title', 'Depo paneli bir süredir yeni veri göndermedi.');
        } else {
            var metin = dk < 60 ? (dk + ' dk.') : (Math.floor(dk / 60) + ' sa.');
            kopukSeridi(metin);
            kutu.textContent = 'Bağlantı kesik · ' + metin;
            if (kap) { kap.classList.add('sip-canli--kopuk'); kap.classList.remove('sip-canli--eski'); }
            kutu.setAttribute('title',
                'Depo paneli ' + metin + ' önce sustu. warehouse.getir.com sipariş ' +
                'ekranının açık olduğu bilgisayarda sayfayı yenile.');
        }
    }

    function ciz() {
        /* Kişi fotoğraflarını çizim öncesi ön-yükle: browser cache'e
           girsinler ki innerHTML sıfırlamalarında img mount edilir
           edilmez paint olsun, harften fotoğrafa zıplama olmasın. */
        (durum.siparisler || []).forEach(function (s) {
            if (s.toplayici_foto) fotoOnyukle(s.toplayici_foto);
            if (s.kurye_foto) fotoOnyukle(s.kurye_foto);
        });

        var hazirlaniyor = seritCiz('hazirlaniyor', 'izgaraHazirlaniyor', 'bosHazirlaniyor', 'hazirlaniyor');
        var hazir = seritCiz('hazir', 'izgaraHazir', 'bosHazir', 'hazir');
        var yolda = seritCiz('yolda', 'izgaraYolda', 'bosYolda', 'yolda');

        el('sayacHazirlaniyor').textContent = hazirlaniyor.length;
        el('sayacHazir').textContent = hazir.length;
        el('sayacYolda').textContent = yolda.length;

        var hazirParca = hazir.reduce(function (a, s) { return a + (s.toplam_adet || (s.urunler || []).length); }, 0);
        el('ozetHazirParca').textContent = adetYaz(hazirParca);

        canliliksGoster();
        kapananSayiTazele();

        detayiCiz();
    }

    function detayiCiz() {
        var detay = el('siparisDetay');
        var s = durum.secili;
        if (!s) {
            detay.classList.remove('acik');
            detay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('sip-detay-acik');
            return;
        }

        var urunler = s.urunler || [];
        var kimlik = siparisKimligi(s);
        var bant = bandaGore(s);

        el('detayEtiket').textContent = kimlik.bankoVar ? 'BANKO' : 'BANKO ATANMADI';
        var buyuk = el('detayBanko');
        buyuk.textContent = kimlik.bankoVar ? kimlik.deger : (gecenSure(s) || 'Yeni');
        buyuk.classList.toggle('kucuk', !kimlik.bankoVar);

        var rozet = el('detayRozet');
        rozet.className = 'sip-rozet sip-rozet--' + bant;
        rozet.querySelector('b').textContent = BANT_ADI[bant] || '';
        el('detayYas').textContent = gecenSure(s) ? gecenSure(s) + ' önce' : '';

        el('olcuParca').textContent = adetYaz(s.toplam_adet != null ? s.toplam_adet : urunler.length);
        el('olcuCesit').textContent = urunler.length;
        el('olcuPoset').innerHTML = (s.poset_sayisi != null ? s.poset_sayisi : '–');
        /* Görevliler yalnız değiştiyse yeniden yazılıyor; yoksa her tikte
           fotoğraflar bir an kaybolup geri geliyordu. */
        var kisilerHtml = yanKisiler(s);
        if (kisilerHtml !== durum.kisilerHtml) {
            durum.kisilerHtml = kisilerHtml;
            el('detayKisiler').innerHTML = kisilerHtml;
        }
        el('yanNot').textContent = s.eksik_urun_var
            ? 'Panelde eksik ürün işaretli. Bulamazsan panelden bildir.'
            : 'Toplama sırasına göre listelendi.';

        /* Gövde yalnız gerçekten değiştiyse yeniden yazılıyor: yoklama
           sırasında kaydırma başa dönmesin, satırlar boşuna belirmesin. */
        var govde = el('detayGovde');
        var imza = s.id + '|' + durum.detayGorunum + '|' +
            urunler.map(function (u) { return u.sira + (u.alindi ? '1' : '0'); }).join('');
        if (imza !== durum.detayImzasi) {
            var eski = durum.detayImzasi.split('|');
            var yeniSiparis = eski[0] !== s.id || eski[1] !== durum.detayGorunum;
            var kaydirma = govde.scrollTop;
            durum.detayImzasi = imza;
            govde.className = 'sip-urunler sip-urunler--' + durum.detayGorunum +
                              (yeniSiparis ? ' sip-urunler--gir' : '');
            govde.innerHTML = urunler.length
                ? bantlaraAyir(urunler)
                : '<div class="sip-bos"><span>' + BOS_IKON + '</span><strong>Ürünler henüz gelmedi</strong>' +
                  '<p>Depo paneli açıksa birkaç saniyede iniyor. Gelmiyorsa panel sekmesinde ' +
                  'konsolu açıp <code>jbaLog()</code> yaz, son satır sebebi söylüyor.</p></div>';
            govde.scrollTop = yeniSiparis ? 0 : kaydirma;
        }

        document.querySelectorAll('#detayGorunum button').forEach(function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-detay-gorunum') === durum.detayGorunum));
        });
        ilerlemeyiTazele();

        detay.classList.add('acik');
        detay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('sip-detay-acik');
    }

    // ==================================================================
    // Katmanlar: barkod, görsel, ayarlar, bildirim
    // ==================================================================

    /* GERİ TUŞU VE KATMANLAR
       Açık olan her şey (sipariş detayı, barkod penceresi, fotoğraf,
       ayarlar, kapananlar) bir yığında ve her biri tarayıcı geçmişinde bir
       kayıt. Geri tuşu ya da geri hareketi her zaman EN ÜSTTEKİNİ kapatıyor.

       Eskiden yalnız detay geçmişe yazılıyordu. Fotoğraf ya da barkod
       açıkken geri basılınca alttaki detay kapanıyor, üstteki pencere
       ortada kalıyordu; geçmiş ile ekran birbirinden kopuyor, bazen sayfa
       dokunuşa cevap vermez hâle geliyordu. */
    var katmanlar = [];
    var gecmisAtla = 0;
    var KATMAN_KAPAT = {};

    /* Sayfa bir katman açıkken yenilendiyse o anki geçmiş kaydı bizden
       kalma; yığın boş başladığı için sahipsiz. Kaydı nötrle ki ilk geri
       basışı boşa gitmesin. */
    try {
        if (history.state && history.state.jbKatman) history.replaceState(null, '');
    } catch (e) { /* sessiz */ }

    function katmanAc(ad) {
        katmanlar.push(ad);
        try { history.pushState({ jbKatman: ad, derinlik: katmanlar.length }, ''); } catch (e) { /* sessiz */ }
    }

    /** Katman ekrandaki düğmeyle kapandı: geçmiş kaydı da tüketilsin. */
    function katmanKapandi(ad) {
        var i = katmanlar.lastIndexOf(ad);
        if (i === -1) return;
        var enUst = i === katmanlar.length - 1;
        katmanlar.splice(i, 1);
        if (enUst) {
            gecmisAtla++;
            try { history.back(); } catch (e) { gecmisAtla--; }
        }
    }

    /** Katman veri yüzünden kendiliğinden gitti: yalnız yığından düşsün. */
    function katmanDustu(ad) {
        var i = katmanlar.lastIndexOf(ad);
        if (i !== -1) katmanlar.splice(i, 1);
    }

    window.addEventListener('popstate', function () {
        if (gecmisAtla > 0) { gecmisAtla--; durumuOnar(); return; }
        var ad = katmanlar.pop();
        if (ad && KATMAN_KAPAT[ad]) {
            try { KATMAN_KAPAT[ad](); } catch (e) { console.warn('Katman kapatılamadı:', e); }
        }
        durumuOnar();
    });

    function katGizle(id) {
        var k = el(id);
        if (k) k.hidden = true;
        if (!document.querySelector('.sip-kat:not([hidden])')) {
            document.body.classList.remove('sip-kat-acik');
        }
    }

    function katAc(id) {
        var k = el(id);
        if (!k) return;
        if (!k.hidden) return;
        k.hidden = false;
        document.body.classList.add('sip-kat-acik');
        KATMAN_KAPAT[id] = function () { katGizle(id); };
        katmanAc(id);
    }

    function katKapat(id) {
        var k = el(id);
        if (!k || k.hidden) { katmanDustu(id); return; }
        katGizle(id);
        katmanKapandi(id);
    }

    KATMAN_KAPAT.foto = function () {
        if (global.JBUrunFoto && global.JBUrunFoto.acikMi()) global.JBUrunFoto.kapat();
    };

    /* GÜVENLİK AĞI
       Ekran ile durum birbirinden koparsa (yarım kalmış bir kaydırma,
       uygulamadan çıkıp dönme, beklenmedik bir hata) sayfa dokunuşa
       cevap vermez hâle gelebiliyordu: görünmez bir katman ekranı
       kaplıyor ya da gövde kilitli kalıyordu. Sekmeye her dönüşte ve her
       geri hareketinden sonra ekran duruma göre onarılıyor. */
    function durumuOnar() {
        var detay = el('siparisDetay');
        if (detay && !durum.secili) {
            detay.classList.remove('acik');
            detay.setAttribute('aria-hidden', 'true');
            detay.style.transition = '';
            detay.style.transform = '';
            detay.style.opacity = '';
            document.body.classList.remove('sip-detay-acik');
            katmanDustu('detay');
        }
        if (global.JBSiparisKaydir) global.JBSiparisKaydir.sifirla();
        ['siparisKodlar', 'siparisAyar', 'siparisKapananlar'].forEach(function (id) {
            var k = el(id);
            if (k && k.hidden) katmanDustu(id);
        });
        if (!document.querySelector('.sip-kat:not([hidden])')) {
            document.body.classList.remove('sip-kat-acik');
        }
        if (!(global.JBUrunFoto && global.JBUrunFoto.acikMi())) katmanDustu('foto');
    }

    var bildirimSaati = null;

    function bildir(metin) {
        var b = el('siparisBildirim');
        b.querySelector('span').textContent = metin;
        b.classList.add('acik');
        clearTimeout(bildirimSaati);
        bildirimSaati = setTimeout(function () { b.classList.remove('acik'); }, 2200);
    }

    function kopyala(kod, mesaj) {
        try {
            navigator.clipboard.writeText(kod);
            bildir(mesaj || 'Barkod kopyalandı');
        } catch (e) { /* pano izni yoksa kod zaten ekranda */ }
    }

    /* BARKOD PENCERESİ
       Eskiden üstte süs çizgiler vardı: koddan türetiliyordu ama gerçek
       bir barkod değildi, okuyucu okumuyordu; iriydi ve hangi koda ait
       olduğu belli değildi. Diğer kodlar da sarmalanan rozetlerdi, çok
       barkodlu üründe pencere taşıyordu.

       Şimdi seçili kodun gerçek, okutulabilir barkodu çiziliyor (EAN-13,
       EAN-8, UPC-A, olmadı Code 128; js/barkod-svg.js). Altında haneler
       okunaklı gruplarla ve kopyala düğmesi. Bütün kodlar altta liste:
       birine dokununca üstteki barkod ona geçiyor. Liste kendi içinde
       kayıyor, pencere hiçbir zaman ekrandan taşmıyor. */
    function kodBicim(kod) {
        var k = String(kod || '');
        if (/^\d{13}$/.test(k)) return k.slice(0, 1) + ' ' + k.slice(1, 7) + ' ' + k.slice(7);
        if (/^\d{8}$/.test(k)) return k.slice(0, 4) + ' ' + k.slice(4);
        if (/^\d{12}$/.test(k)) return k.slice(0, 1) + ' ' + k.slice(1, 6) + ' ' + k.slice(6, 11) + ' ' + k.slice(11);
        return k;
    }

    function kodSec(i) {
        var u = durum.kodUrun;
        if (!u) return;
        var liste = barkodBul(u).barkodlar;
        if (!liste.length) return;
        i = Math.max(0, Math.min(liste.length - 1, i));
        durum.kodSecili = i;
        var kod = liste[i];
        var kutu = el('kodCizim');
        kutu.hidden = false;
        var alan = Math.max(160, (kutu.clientWidth || 300) - 24);
        var cizim = global.JBBarkodSvg ? global.JBBarkodSvg.ciz(kod, { genislik: alan, etiket: kod + ' barkodu' }) : null;
        kutu.innerHTML = cizim ? cizim.svg : '<span class="sip-bk__duz">' + kacir(kodBicim(kod)) + '</span>';
        el('kodTur').textContent = (cizim ? cizim.tur + ' · ' : '') + (liste.length > 1 ? (i + 1) + '. barkod' : 'tek barkod');
        el('kodKopya').setAttribute('data-kopyala', kod);
        el('kodListe').querySelectorAll('[data-kod-sec]').forEach(function (b) {
            var secili = Number(b.getAttribute('data-kod-sec')) === i;
            b.classList.toggle('is-secili', secili);
            b.setAttribute('aria-selected', secili ? 'true' : 'false');
        });
    }

    function kodlariAc(u) {
        var bilgi = barkodBul(u);
        durum.kodUrun = u;
        var g = el('kodGorsel');
        var gd = el('kodGorselDugme');
        var kodAdres = urunGorseli(u, bilgi);
        if (kodAdres) { g.src = kodAdres; gd.hidden = false; }
        else { g.removeAttribute('src'); gd.hidden = true; }

        el('kodAd').textContent = urunBasligi(u, bilgi);
        var n = bilgi.barkodlar.length;
        el('kodNot').textContent = adetYaz(u.adet) + (u.birim ? ' ' + u.birim : ' adet') +
            (n ? '  ·  ' + n + ' barkod' : '');

        var varMi = n > 0;
        el('kodSecili').hidden = !varMi;
        el('kodBos').hidden = varMi;
        el('kodListeKap').hidden = n < 2;

        if (varMi) {
            el('kodSayi').textContent = n;
            el('kodListe').innerHTML = bilgi.barkodlar.map(function (b, i) {
                var tur = global.JBBarkodSvg && global.JBBarkodSvg.desen(b);
                return '<button type="button" class="sip-bk__satir" role="option" data-kod-sec="' + i + '" aria-selected="false">' +
                    '<span class="sip-bk__sira">' + (i + 1) + '</span>' +
                    '<span class="sip-bk__satir-kod">' + kacir(kodBicim(b)) + '</span>' +
                    '<span class="sip-bk__satir-tur">' + kacir(tur ? tur.tur : '') + '</span>' +
                    '<svg class="sip-bk__tik" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg>' +
                '</button>';
            }).join('');
        } else {
            el('kodBos').textContent = 'Bu ürün katalogda eşleşmedi. Barkodu panelden okutman gerekiyor.';
            el('kodListe').innerHTML = '';
        }
        katAc('siparisKodlar');
        // Çizim kutunun gerçek genişliğine göre: pencere açıldıktan sonra
        if (varMi) kodSec(0);
    }

    /* Ürün ve kişi fotoğrafı arama sayfasındaki pencereyle açılıyor
       (js/urun-foto.js): her fotoğraf aynı çerçevede, yakınlaştırılabilir.
       Ürünün adının altında barkodları kaydırılabilir şerit olarak. */
    var _fotoYeniden = false;

    function fotoAc(adres, baslik, secenek) {
        if (!adres || !global.JBUrunFoto) return;
        /* Kapanmakta olan pencere hemen yeniden açılırsa, eski açılışın
           kapanış haberi bu sırada geliyor. O haber geçmiş kaydını silmesin:
           aynı kayıt yeni açılışa devrediliyor. */
        _fotoYeniden = true;
        try {
            global.JBUrunFoto.ac(adres, baslik, Object.assign({}, secenek || {}, {
                kapaninca: function () { if (!_fotoYeniden) katmanKapandi('foto'); }
            }));
        } finally {
            _fotoYeniden = false;
        }
        if (katmanlar.indexOf('foto') === -1) katmanAc('foto');
    }

    function gorseliBuyut(u) {
        if (!u) return;
        var bilgi = barkodBul(u);
        var adres = urunGorseli(u, bilgi);
        if (!adres) return;
        fotoAc(adres, urunBasligi(u, bilgi), { barkodlar: bilgi.barkodlar });
    }

    function kisiFotoAc(dugum) {
        var foto = dugum && dugum.getAttribute('data-kisi-foto');
        if (!foto) return;
        var ad = dugum.getAttribute('data-kisi-ad') || '';
        var rol = dugum.getAttribute('data-kisi-rol') || '';
        fotoAc(foto, ad + (rol ? ' · ' + rol : ''), { arac: false });
    }

    // ---- Ayarlar ----

    function siraCiz() {
        el('ayarSira').innerHTML = durum.bantSirasi.map(function (k, i) {
            return '<div class="sip-sira__oge">' +
                '<span class="sip-sira__no">' + (i + 1) + '</span>' +
                '<span class="sip-sira__ad">' + kacir(bantEtiket(k)) + '</span>' +
                '<button type="button" data-bant="' + k + '" data-tasi="-1" aria-label="Yukarı"' +
                    (i === 0 ? ' disabled' : '') + '>' +
                    '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg></button>' +
                '<button type="button" data-bant="' + k + '" data-tasi="1" aria-label="Aşağı"' +
                    (i === durum.bantSirasi.length - 1 ? ' disabled' : '') + '>' +
                    '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>' +
            '</div>';
        }).join('');
    }

    // ==================================================================
    // Kategoriler: hangi ürün hangi banda giriyor
    //
    // Yerleşik üçü (fırın/dondurma/su) `siparis-sirala.js`in varsayılanından
    // geliyor; kullanıcı bunların kelimelerini ve rengini değiştirebiliyor,
    // ayrıca tamamen yeni kategori açabiliyor. Hepsi cihaza özel, sunucuya
    // yazılmıyor. Renk girdisi Hızlı Bul eklentisindeki kategori renk
    // satırıyla aynı düzen.
    // ==================================================================

    function kelimeleriOku(metin) {
        return String(metin || '').split(',')
            .map(function (k) { return k.trim(); })
            .filter(Boolean);
    }

    function kelimeleriYaz(dizi) {
        return (dizi || []).join(', ');
    }

    /**
     * Ayarlarda saklanan ham veriyi doğrulayıp kullanılabilir kategori
     * dizisine çevirir. Kayıt yoksa ya da tamamen bozuksa `siparis-sirala`
     * modülünün varsayılanına dönülüyor.
     */
    function kategorileriYukle(ayar) {
        var varsayilan = (global.JBSiparisSirala && global.JBSiparisSirala.KURALLAR) || [];
        var kayitli = ayar && Array.isArray(ayar.kategoriler) ? ayar.kategoriler : null;

        if (!kayitli || !kayitli.length) {
            ayarYaz({ kurallarSurum: (global.JBSiparisSirala && global.JBSiparisSirala.KURALLAR_SURUM) || 0 });
            return varsayilan.map(function (k) {
                return {
                    kume: k.kume, etiket: k.etiket, renk: k.renk || '#98a2b3',
                    urunler: [],
                    dahil: (k.dahil || []).slice(), haric: (k.haric || []).slice(), yerlesik: true
                };
            });
        }

        /* YERLEŞİK KURALLARIN TAZELENMESİ
           Ayarlar cihazda saklanıyor. Fırın, dondurma ve su listeleri
           sahadan gelen bilgiyle güncellendiğinde eski kayıt yüzünden
           kimse yeni listeyi görmüyordu. `KURALLAR_SURUM` artınca yerleşik
           üçünün kelime listeleri bir kez varsayılana çekiliyor.

           Dokunulmayanlar: kullanıcının katalogdan tek tek seçtiği ürünler
           (`urunler`), seçtiği renk ve kendi eklediği kategoriler. O emek
           gitmesin. */
        var surum = (global.JBSiparisSirala && global.JBSiparisSirala.KURALLAR_SURUM) || 0;
        if ((ayar.kurallarSurum || 0) < surum) {
            var varsayilanHarita = {};
            varsayilan.forEach(function (v) { varsayilanHarita[v.kume] = v; });
            kayitli = kayitli.map(function (k) {
                var v = k && k.yerlesik && varsayilanHarita[k.kume];
                if (!v) return k;
                return Object.assign({}, k, {
                    dahil: (v.dahil || []).slice(),
                    haric: (v.haric || []).slice()
                });
            });
            ayarYaz({ kategoriler: kayitli, kurallarSurum: surum });
        }

        var temiz = kayitli.filter(function (k) {
            return k && typeof k.kume === 'string' && k.kume && typeof k.etiket === 'string' && k.etiket;
        }).map(function (k) {
            return {
                kume: k.kume,
                etiket: k.etiket,
                renk: (typeof k.renk === 'string' && /^#[0-9a-f]{6}$/i.test(k.renk)) ? k.renk : '#98a2b3',
                urunler: Array.isArray(k.urunler) ? k.urunler.filter(function (x) { return typeof x === 'string' && x; }) : [],
                dahil: Array.isArray(k.dahil) ? k.dahil.filter(function (x) { return typeof x === 'string' && x; }) : [],
                haric: Array.isArray(k.haric) ? k.haric.filter(function (x) { return typeof x === 'string' && x; }) : [],
                yerlesik: !!k.yerlesik
            };
        });
        return temiz.length ? temiz : kategorileriYukle({});
    }

    /* Bant sırası ile kategori listesi birbirinden kopmasın: silinen
       kategorinin kalıntısı sırada kalmasın, yeni eklenen kategori sıraya
       düşmemiş olmasın. Her açılışta ve her değişiklikte çalışıyor. */
    /* SİPARİŞ ÖNCELİK SIRASI
       "Kolay önce" sıralamasının ağırlık listesi. Toplama sırasından ayrı
       tutuluyor: toplama sırası depoda hangi rafa önce gidileceğini
       söylüyor, bu liste ise hangi SİPARİŞİN önce alınacağını. İkisi aynı
       şey değil; fırına önce gidiyor olman fırınlı siparişin kolay olduğu
       anlamına gelmiyor. 'orta' burada yok, kategorisiz sipariş zaten en
       hafif sayılıyor. */
    function yukSirasiOnar() {
        var gecerli = {};
        (durum.kategoriler || []).forEach(function (k) { gecerli[k.kume] = true; });
        durum.yukSirasi = (durum.yukSirasi || []).filter(function (k) {
            return gecerli[k] && k !== 'orta';
        });
        (durum.kategoriler || []).forEach(function (k) {
            if (k.kume === 'orta') return;
            if (durum.yukSirasi.indexOf(k.kume) === -1) durum.yukSirasi.push(k.kume);
        });
    }

    function yukSirasiCiz() {
        var kap = el('ayarYukSira');
        if (!kap) return;
        if (!durum.yukSirasi.length) {
            kap.innerHTML = '<p class="sip-ayar__not">Kategori yok.</p>';
            return;
        }
        kap.innerHTML = durum.yukSirasi.map(function (k, i) {
            return '<div class="sip-sira__oge">' +
                '<span class="sip-sira__no">' + (i + 1) + '</span>' +
                '<span class="sip-sira__ad">' + kacir(bantEtiket(k)) + '</span>' +
                '<button type="button" data-yuk="' + kacir(k) + '" data-tasi="-1" aria-label="Yukarı"' +
                    (i === 0 ? ' disabled' : '') + '>' +
                    '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg></button>' +
                '<button type="button" data-yuk="' + kacir(k) + '" data-tasi="1" aria-label="Aşağı"' +
                    (i === durum.yukSirasi.length - 1 ? ' disabled' : '') + '>' +
                    '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>' +
            '</div>';
        }).join('');
    }

    function bantSirasiOnar() {
        var gecerli = { orta: true };
        (durum.kategoriler || []).forEach(function (k) { gecerli[k.kume] = true; });
        durum.bantSirasi = (durum.bantSirasi || []).filter(function (k) { return gecerli[k]; });

        var suIndex = durum.bantSirasi.indexOf('su');
        (durum.kategoriler || []).forEach(function (k) {
            if (durum.bantSirasi.indexOf(k.kume) !== -1) return;
            var yer = suIndex === -1 ? durum.bantSirasi.length : suIndex;
            durum.bantSirasi.splice(yer, 0, k.kume);
            if (suIndex !== -1) suIndex++;
        });
        if (durum.bantSirasi.indexOf('orta') === -1) durum.bantSirasi.push('orta');
    }

    function kategoriSlugUret(ad) {
        var taban = (global.JBSiparisSirala && global.JBSiparisSirala.sade)
            ? global.JBSiparisSirala.sade(ad).replace(/\s+/g, '-')
            : String(ad || '').toLocaleLowerCase('tr').replace(/[^a-z0-9]+/g, '-');
        if (!taban) taban = 'kategori';
        var mevcut = (durum.kategoriler || []).map(function (k) { return k.kume; }).concat(['orta']);
        var aday = taban, sayac = 2;
        while (mevcut.indexOf(aday) !== -1) { aday = taban + '-' + sayac; sayac++; }
        return aday;
    }

    /*
     * Kategori tanımı değişince kaydediliyor, sıra listesi güncelleniyor.
     * Ekrandaki siparişler yalnız yeniden ÇİZİLMÜYOR, gerçekten yeniden
     * SINIFLANDIRILIYOR: `tazele(true)` siparişleri güncel kurallarla tekrar
     * `sirala()`dan geçiriyor. Yalnız ciz() çağırmak yetmezdi; ürünlerin
     * `toplamaBandi`'ı zaten hesaplanmış haliyle önbellekte kalır, "Temizlik"
     * kategorisini silince ürün ekranda hâlâ "temizlik" bandında görünürdü.
     * İmzalar sıfırlanıyor ki kart zemini ve bant başlıkları da tazelensin;
     * onlar sipariş id'sine göre atlanıyordu, kategori değişince aynı id
     * için farklı renk/bant çizilmesi gerekiyor.
     *
     * Ayarlar penceresindeki kategori kartları burada yeniden ÇİZİLMİYOR:
     * kullanıcı bir kelime kutusuna yazarken kartı yeniden basmak imleci
     * kaybettirirdi.
     */
    function kategorileriDegisti() {
        ayarYaz({ kategoriler: durum.kategoriler });
        bantSirasiOnar();
        yukSirasiOnar();
        ayarYaz({ bantSirasi: durum.bantSirasi, yukSirasi: durum.yukSirasi });
        siraCiz();
        yukSirasiCiz();
        durum.kartImzasi = { hazirlaniyor: '', hazir: '', yolda: '' };
        durum.detayImzasi = '';
        tazele(true);
    }

    /**
     * Katalogda ada göre arama. 9.000 küsür ürün var; her tuşta tamamını
     * gezmek yerine sadeleştirilmiş adları bir kez kurup onun üstünde
     * geziyoruz. Sonuç sekiz taneyle sınırlı: uzun liste seçtirmiyor,
     * yazmayı sürdürtüyor.
     */
    var KATALOG_ARAMA_SINIRI = 8;

    function katalogAra(sorgu) {
        var q = sade(sorgu);
        if (q.length < 2) return [];
        katalogHazirla();
        var sonuc = [];
        katalogDizin.forEach(function (urun, sadeAd) {
            if (sonuc.length >= KATALOG_ARAMA_SINIRI) return;
            if (sadeAd.indexOf(q) !== -1) sonuc.push(urun);
        });
        return sonuc;
    }

    /** Bir ürün hangi kategoride seçili? (Aynı ürün iki yerde olmasın.) */
    function urunSeciliMi(ad) {
        var a = sade(ad);
        return (durum.kategoriler || []).filter(function (k) {
            return (k.urunler || []).some(function (u) { return sade(u) === a; });
        })[0] || null;
    }

    function urunCipleri(k) {
        if (!(k.urunler || []).length) {
            return '<p class="sip-kat-kart__bos">Henüz ürün seçilmedi. Aşağıdan arayıp ekle.</p>';
        }
        return '<div class="sip-kat-cipler">' + k.urunler.map(function (ad) {
            return '<span class="sip-kat-cip">' + kacir(ad) +
                '<button type="button" data-urun-cikar="' + kacir(k.kume) + '" data-urun-ad="' + kacir(ad) +
                '" aria-label="' + kacir(ad) + ' ürününü çıkar">' + CARPI_IKON + '</button>' +
            '</span>';
        }).join('') + '</div>';
    }

    function kategorileriCiz() {
        el('ayarKategoriler').innerHTML = (durum.kategoriler || []).map(function (k) {
            var adAlani = k.yerlesik
                ? '<strong class="sip-kat-kart__ad">' + kacir(k.etiket) + '</strong>'
                : '<input type="text" class="sip-kat-kart__ad--ozel" data-kategori-ad="' + kacir(k.kume) +
                  '" value="' + kacir(k.etiket) + '" maxlength="24" aria-label="Kategori adı">';
            var silDugmesi = k.yerlesik ? '' :
                '<button type="button" class="sip-kat-kart__sil" data-kategori-sil="' + kacir(k.kume) +
                '" aria-label="' + kacir(k.etiket) + ' kategorisini sil">' + SIL_IKON + '</button>';
            return '<div class="sip-kat-kart" data-kume="' + kacir(k.kume) + '">' +
                '<div class="sip-kat-kart__ust">' +
                    '<input type="color" data-kategori-renk="' + k.kume + '" value="' + k.renk +
                    '" aria-label="' + kacir(k.etiket) + ' rengi">' +
                    adAlani +
                    '<span class="sip-kat-kart__sayi">' + (k.urunler || []).length + ' ürün</span>' +
                    silDugmesi +
                '</div>' +
                urunCipleri(k) +
                '<div class="sip-kat-arama">' +
                    '<input type="search" data-urun-ara="' + k.kume + '" autocomplete="off"' +
                        ' placeholder="Katalogdan ürün ara ve ekle">' +
                    '<div class="sip-kat-oneri" data-oneri="' + k.kume + '" hidden></div>' +
                '</div>' +
                /* Anahtar kelime tek tek seçmenin anlamsız olduğu geniş
                   gruplar için ("ekmek" bütün ekmekleri yakalıyor). Kapalı
                   duruyor; asıl yol ürün seçmek. */
                '<details class="sip-kat-gelismis">' +
                    '<summary>Anahtar kelimeler (gelişmiş)</summary>' +
                    '<label>Bu kelimeler geçerse bu kategoriye girsin' +
                        '<textarea data-kategori-dahil="' + k.kume + '" rows="2" placeholder="ör. deterjan, çamaşır suyu">' +
                            kacir(kelimeleriYaz(k.dahil)) +
                        '</textarea>' +
                    '</label>' +
                    '<label>Hariç tutulacaklar' +
                        '<textarea data-kategori-haric="' + k.kume + '" rows="1" placeholder="yanlış yakalananları buraya yaz">' +
                            kacir(kelimeleriYaz(k.haric)) +
                        '</textarea>' +
                    '</label>' +
                '</details>' +
            '</div>';
        }).join('');
    }

    /** Arama kutusunun altındaki öneri listesi. */
    function onerileriCiz(kume, sorgu) {
        var kutu = document.querySelector('[data-oneri="' + kume + '"]');
        if (!kutu) return;
        var bulunan = katalogAra(sorgu);
        if (!bulunan.length) {
            kutu.hidden = sade(sorgu).length < 2;
            kutu.innerHTML = '<p class="sip-kat-oneri__bos">Eşleşen ürün yok</p>';
            return;
        }
        kutu.hidden = false;
        kutu.innerHTML = bulunan.map(function (p) {
            var sahibi = urunSeciliMi(p.name);
            var not = sahibi
                ? '<em>' + kacir(sahibi.kume === kume ? 'ekli' : sahibi.etiket) + '</em>'
                : '';
            return '<button type="button" class="sip-kat-oneri__oge' + (sahibi ? ' dolu' : '') +
                '" data-urun-ekle="' + kacir(kume) + '" data-urun-ad="' + kacir(p.name) + '">' +
                (p.image
                    ? '<img src="' + kacir(p.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
                    : '<span class="sip-kat-oneri__bosgorsel"></span>') +
                '<span>' + kacir(p.name) + '</span>' + not +
            '</button>';
        }).join('');
    }

    function urunEkle(kume, ad) {
        var k = kategoriBul(kume);
        if (!k || !ad) return;
        var a = sade(ad);
        /* Aynı ürün iki kategoride duramaz: hangi bandın kazandığı kural
           sırasına kalırdı, o da kullanıcıya görünmeyen bir davranış olurdu.
           Eskisinden çıkarılıp yenisine alınıyor. */
        (durum.kategoriler || []).forEach(function (x) {
            x.urunler = (x.urunler || []).filter(function (u) { return sade(u) !== a; });
        });
        k.urunler.push(ad);
        kategorileriDegisti();
        kategorileriCiz();
        bildir(ad + ' → ' + k.etiket);
        /* Kullanıcı arka arkaya ürün ekliyor; kutu yeniden odaklanıyor. */
        var kutu = document.querySelector('[data-urun-ara="' + kume + '"]');
        if (kutu) { kutu.focus(); kutu.scrollIntoView({ block: 'center' }); }
    }

    function urunCikar(kume, ad) {
        var k = kategoriBul(kume);
        if (!k) return;
        var a = sade(ad);
        k.urunler = (k.urunler || []).filter(function (u) { return sade(u) !== a; });
        kategorileriDegisti();
        kategorileriCiz();
    }

    function kategoriEkle() {
        var adGirdi = el('kategoriAdi');
        var ad = adGirdi.value.trim();
        if (!ad) { bildir('Önce kategoriye bir ad yaz'); adGirdi.focus(); return; }

        var kume = kategoriSlugUret(ad);
        var renk = el('kategoriRenk').value || '#16a34a';
        durum.kategoriler.push({ kume: kume, etiket: ad, renk: renk, dahil: [], haric: [], yerlesik: false });
        kategorileriDegisti();
        kategorileriCiz();

        adGirdi.value = '';
        bildir(ad + ' kategorisi eklendi, şimdi kelimelerini yaz');
        /* Kullanıcı direkt kelime yazmaya devam etsin; yeni kartın kelime
           kutusuna odaklanıp göze getiriliyor. */
        var yeniKutu = document.querySelector('.sip-kat-kart[data-kume="' + kume + '"] [data-kategori-dahil]');
        if (yeniKutu) {
            yeniKutu.scrollIntoView({ block: 'center', behavior: 'smooth' });
            yeniKutu.focus();
        }
    }

    function kategoriSil(kume) {
        var k = kategoriBul(kume);
        if (!k || k.yerlesik) return;
        durum.kategoriler = durum.kategoriler.filter(function (x) { return x.kume !== kume; });
        kategorileriDegisti();
        kategorileriCiz();
        if (durum.secili && durum.secili.urunler && durum.secili.urunler.some(function (u) { return u.toplamaBandi === kume; })) {
            durum.detayImzasi = '';
        }
        bildir(k.etiket + ' kategorisi silindi');
    }

    var SIL_IKON = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>';
    var CARPI_IKON = '<svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg>';

    /* AYARLAR
       Dört sekme, her birinde tek bir konu: Sıralama, Toplama,
       Kategoriler, Efektler. Eskiden hepsi alt alta tek uzun sayfaydı ve
       kategori kartları açılınca neyin nerede olduğu kayboluyordu. */
    var AYAR_SEKMELERI = ['siralama', 'toplama', 'kategoriler', 'efektler'];
    var _aktifAyarSekmesi = 'siralama';

    function ayarSekmesiGoster(ad) {
        if (AYAR_SEKMELERI.indexOf(ad) === -1) ad = 'siralama';
        _aktifAyarSekmesi = ad;
        document.querySelectorAll('#ayarSekmeler [data-ayar-sekme]').forEach(function (b) {
            var secili = b.getAttribute('data-ayar-sekme') === ad;
            b.setAttribute('aria-selected', secili ? 'true' : 'false');
            b.tabIndex = secili ? 0 : -1;
        });
        document.querySelectorAll('#siparisAyar [data-ayar-bolum]').forEach(function (p) {
            p.hidden = p.getAttribute('data-ayar-bolum') !== ad;
        });
        var kutu = el('siparisAyar').querySelector('.sip-ayar__govde');
        if (kutu) kutu.scrollTop = 0;
    }

    var BANT_ETIKETI = { hazirlaniyor: 'Hazırlanıyor', hazir: 'Hazırlandı', yolda: 'Yolda' };

    function seritSiraCiz() {
        var kap = el('ayarSeritSira');
        if (!kap) return;
        kap.innerHTML = Object.keys(BANT_ETIKETI).map(function (b) {
            return '<label class="sip-ayar-satir">' +
                '<span class="sip-ayar-satir__ad">' + BANT_ETIKETI[b] + '</span>' +
                '<span class="sip-secici">' +
                    '<select data-serit-sira="' + b + '" aria-label="' + BANT_ETIKETI[b] + ' sıralaması">' +
                    SIRA_SECENEKLERI.map(function (o) {
                        return '<option value="' + o.anahtar + '"' + (durum.seritSira[b] === o.anahtar ? ' selected' : '') +
                            '>' + kacir(o.kisa) + '</option>';
                    }).join('') +
                    '</select>' +
                    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>' +
                '</span>' +
            '</label>';
        }).join('');
        var not = el('ayarSeritNot');
        if (not) {
            var varsayilanMi = Object.keys(SERIT_VARSAYILAN).every(function (b) { return durum.seritSira[b] === SERIT_VARSAYILAN[b]; });
            not.hidden = varsayilanMi;
        }
    }

    function efektAyarCiz() {
        var e = durum.efekt;
        document.querySelectorAll('#ayarEfektMod input[name="efektMod"]').forEach(function (r) {
            r.checked = r.value === e.mod;
        });
        var guc = el('ayarEfektGuc');
        guc.value = e.guc;
        guc.disabled = e.mod !== 'tam';
        el('ayarEfektGucDeger').textContent = e.guc;
        el('ayarEfektGucSatir').classList.toggle('is-pasif', e.mod !== 'tam');
        el('ayarTitresim').checked = !!e.titresim;
        el('ayarTitresimSatir').hidden = !('vibrate' in navigator);
    }

    function efektYaz(degisim) {
        Object.assign(durum.efekt, degisim);
        ayarYaz({ efekt: durum.efekt });
        efektAyarCiz();
    }

    /* Ayarlardaki "Dene": seçili hâliyle 3 adetlik efekt. */
    function efektDene() {
        var n = 3;
        if (durum.efekt.titresim) titret(true, n);
        var onizleme = el('ayarEfektOnizleme');
        cokluEfektOynat(onizleme, n);
    }

    function ayarAc() {
        siraCiz();
        yukSirasiCiz();
        kategorileriCiz();
        seritSiraCiz();
        efektAyarCiz();
        ayarSekmesiGoster(_aktifAyarSekmesi);
        katAc('siparisAyar');
    }

    // ==================================================================
    // Kapananlar
    //
    // Depocu yanlışlıkla "Toplandı" diyebiliyor ya da panelde sipariş ileri
    // gidiyor; ikisinde de sipariş şeritlerden düşüyor ve bir daha
    // bulunamıyordu. Buradan son kapananlar görünüyor: elle kapatılan geri
    // açılabiliyor, panelde teslime geçen yalnız okunabiliyor (onu geri
    // açmak yalan olurdu, panelde iş bitmiş).
    // ==================================================================

    var KAPANAN_SINIRI = 30;

    /* En yeni kapanan başta. Panelden düşen sipariş silindiği için burada
       yalnız elle kapatılanlar ve henüz silinmemiş olanlar kalıyor. */
    function kapananlar() {
        return durum.siparisler
            .filter(function (s) { return bandaGore(s) === 'bitti'; })
            .slice()
            .sort(function (a, b) {
                var ta = new Date(a.sepet_zamani || a.created_at || 0).getTime() || 0;
                var tb = new Date(b.sepet_zamani || b.created_at || 0).getTime() || 0;
                return tb - ta;
            })
            .slice(0, KAPANAN_SINIRI);
    }

    function kapananSayiTazele() {
        var d = el('kapananSayi');
        if (!d) return;
        var yeni = String(kapananlar().length);
        if (d.textContent === yeni) return;
        d.textContent = yeni;
        /* Değişimi tek seferlik bir vurguyla bildiriyoruz. Sınıf önce
           kaldırılıp reflow tetikleniyor; yoksa ikinci değişimde animasyon
           hiç yeniden başlamazdı. */
        d.classList.remove('sip-sayi--degisti');
        void d.offsetWidth;
        d.classList.add('sip-sayi--degisti');
    }

    function kapananlariCiz() {
        var liste = kapananlar();
        if (!liste.length) {
            el('kapananListe').innerHTML =
                '<p class="sip-kapanan__bos">Kapanan sipariş yok.</p>';
            return;
        }
        el('kapananListe').innerHTML = liste.map(function (s) {
            var urunler = s.urunler || [];
            var kimlik = siparisKimligi(s);
            var panelBitti = panelBitirmisMi(s);
            var eskidi = eskimisMi(s);
            var neden = panelBitti ? 'Panelde teslime geçti'
                : (eskidi ? 'Eskidi, panelde yok' : 'Elle kapatıldı');
            var zaman = s.sepet_zamani || s.created_at;
            /* Aynı banko gün içinde birden çok siparişe verilebiliyor;
               saat olmadan hangisi olduğu ayırt edilemiyordu. */
            var saat = zaman ? saatYaz(new Date(zaman).getTime()) : '';

            return '<div class="sip-kapanan__oge">' +
                '<span class="sip-kapanan__banko' + (kimlik.bankoVar ? '' : ' yok') + '">' +
                    kacir(kimlik.deger) + '</span>' +
                '<div class="sip-kapanan__bilgi">' +
                    '<strong>' + (kimlik.bankoVar ? 'Banko ' + kacir(kimlik.deger) : 'Bankosuz') +
                        (saat ? '<span>' + saat + '</span>' : '') + '</strong>' +
                    '<small>' + urunler.length + ' çeşit · ' + kacir(neden) + '</small>' +
                '</div>' +
                '<div class="sip-kapanan__eylem">' +
                    '<button type="button" class="sip-kapanan__ac" data-kapanan-ac="' + kacir(s.id) + '">Aç</button>' +
                    /* Geri açma yalnız elle kapatılanlara. Panelde teslime
                       geçmiş ya da eskimiş siparişi geri açmak yalan olurdu:
                       bir sonraki yoklamada yine kapanır. */
                    (panelBitti || eskidi ? '' :
                        '<button type="button" class="sip-kapanan__geri" data-kapanan-geri="' + kacir(s.id) + '">Geri aç</button>') +
                '</div>' +
            '</div>';
        }).join('');
    }

    function kapananlariAc() {
        kapananlariCiz();
        katAc('siparisKapananlar');
    }

    function kapananiGeriAc(id) {
        var s = durum.siparisler.filter(function (x) { return x.id === id; })[0];
        if (!s) return;
        siparisDurumu(s, 'bekliyor');
        katKapat('siparisKapananlar');
        bildir((s.banko ? 'Banko ' + s.banko : 'Sipariş') + ' geri açıldı');
    }

    // ==================================================================
    // Olaylar
    // ==================================================================

    /* ==================================================================
       ANDROID GERİ TUŞU
       ------------------------------------------------------------------
       El terminalinin altındaki geri tuşu tarayıcı geçmişini işletiyor.
       Sipariş detayı ayrı bir sayfa değil, aynı sayfada açılan bir panel;
       geçmişte karşılığı yoktu ve geri tuşu depocuyu doğrudan Ürün Arama
       sayfasına atıyordu. Yanlışlıkla basıldığında yapılan iş kayboluyor.

       Detay ve üstündeki her pencere geçmişe bir kayıt bırakıyor
       (`katmanAc`); geri tuşu her seferinde en üsttekini kapatıyor, sayfadan
       çıkmıyor. Ekrandaki düğmeyle kapanan katman kendi kaydını
       `katmanKapandi` ile tüketiyor. Ayrıntı: "GERİ TUŞU VE KATMANLAR".
       ================================================================== */
    function azaltilmisHareket() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    /* Geri düğmesi ve geri tuşu: panel sağa kayıp kapanıyor. */
    var _kapanisSaati = null;
    function detayiKaydirarakKapat() {
        var p = el('siparisDetay');
        if (!p || azaltilmisHareket()) { detayiGercektenKapat(); return; }
        var w = p.getBoundingClientRect().width || window.innerWidth;
        p.style.transition = 'transform var(--motion-panel) var(--motion-ease-out)';
        p.style.transform = 'translate3d(' + w + 'px,0,0)';
        clearTimeout(_kapanisSaati);
        _kapanisSaati = setTimeout(function () {
            /* Aynı karede sınıf düşüyor ve satır içi stil siliniyor: panel
               zaten ekran dışında, CSS'in kendi kapanış konumu da orası.
               Ayrı karelerde yapılınca panel bir an geri gelip yeniden
               kayıyordu. */
            detayiGercektenKapat();
            p.style.transition = 'none';
            p.style.transform = '';
            requestAnimationFrame(function () { p.style.transition = ''; });
        }, 230);
    }

    function detayiGercektenKapat() {
        durum.secili = null;
        durum.detayImzasi = '';
        ciz();
    }

    /** Ekrandaki geri düğmesi, kaydırma sonu, Esc. */
    function detayiKapat(animasyonAtla) {
        if (durum.secili) {
            if (animasyonAtla === true) detayiGercektenKapat();
            else detayiKaydirarakKapat();
        }
        katmanKapandi('detay');
    }

    KATMAN_KAPAT.detay = function () {
        if (durum.secili) detayiKaydirarakKapat();
    };

    function siparisAc(id) {
        var tumu = durum.siparisler;
        durum.secili = tumu.filter(function (s) { return s.id === id; })[0] || null;
        durum.detayImzasi = '';
        if (durum.secili && katmanlar.indexOf('detay') === -1) katmanAc('detay');
        ciz();
        /* Detay panelindeki TÜM scroll'lu elementleri sıfırla; window
           scroll'una dokunma (siparişler sayfası kaldığı yerde kalsın).
           Mobil layout `.sip-detay__yerlesim` üzerinde, masaüstünde
           `.sip-yan` yan panelde ve `#detayGovde` ürün listesinde scroll
           tutar. Üçünü de baştan alıyoruz ki yeni siparişte üstte olsun. */
        var detay = el('siparisDetay');
        if (detay) {
            detay.scrollTop = 0;
            var yerlesim = detay.querySelector('.sip-detay__yerlesim');
            if (yerlesim) yerlesim.scrollTop = 0;
            var yan = detay.querySelector('.sip-yan');
            if (yan) yan.scrollTop = 0;
        }
        var govde = el('detayGovde'); if (govde) govde.scrollTop = 0;
    }

    var BANT_HARITA = {
        'sip-serit--hazirlaniyor': 'hazirlaniyor',
        'sip-serit--hazir': 'hazir',
        'sip-serit--yolda': 'yolda'
    };

    function seritBantBul(baslik) {
        var serit = baslik.closest('.sip-serit');
        if (!serit) return null;
        for (var sinif in BANT_HARITA) {
            if (serit.classList.contains(sinif)) return BANT_HARITA[sinif];
        }
        return null;
    }

    function siraSecenegi(anahtar) {
        return SIRA_SECENEKLERI.filter(function (x) { return x.anahtar === anahtar; })[0] ||
               SIRA_SECENEKLERI[0];
    }

    function siraBaslikGuncelle(bant) {
        var serit = el('siparisAkis').querySelector('.sip-serit--' + bant);
        if (!serit) return;
        var rozet = serit.querySelector('.sip-sira-rozet');
        if (!rozet) return;
        var sec = siraSecenegi(durum.seritSira[bant] || 'sure');
        rozet.innerHTML = (SIRA_IKON[sec.anahtar] || SIRA_IKON.sure) +
                          '<b>' + kacir(sec.kisa) + '</b>';
        rozet.title = sec.etiket;
        rozet.setAttribute('aria-label', 'Sıralama: ' + sec.etiket + '. Değiştirmek için tıkla.');
    }

    function siraDegistir(baslik) {
        var bant = seritBantBul(baslik);
        if (!bant) return;
        var simdiki = durum.seritSira[bant] || 'sure';
        var anahtarlar = SIRA_SECENEKLERI.map(function (s) { return s.anahtar; });
        var idx = anahtarlar.indexOf(simdiki);
        seritSirasiAyarla(bant, anahtarlar[(idx + 1) % anahtarlar.length]);
    }

    function seritSirasiAyarla(bant, anahtar) {
        if (!siraSecenegiVarMi(anahtar)) return;
        durum.seritSira[bant] = anahtar;
        ayarYaz({ seritSira: durum.seritSira });
        durum.kartImzasi[bant] = '';
        ciz();
        siraBaslikGuncelle(bant);
        if (!el('siparisAyar').hidden) seritSiraCiz();
    }

    function siraSecenegiVarMi(anahtar) {
        return SIRA_SECENEKLERI.some(function (x) { return x.anahtar === anahtar; });
    }

    /* KAYDIRARAK GERİ
       iOS'taki gibi: panel parmağı birebir takip ediyor, arkadaki liste
       soldan hafifçe kayarak geliyor, aradaki gölge açılıyor. Bırakınca
       karar mesafeye VE hıza göre: ekranın üçte birini geçtiyse ya da hızlı
       bir fiske attıysa kapanıyor, yoksa yaya gibi yerine dönüyor. Kalan
       yol hızla orantılı sürede tamamlanıyor, yani hareket elden kopmuyor.

       Eskiden yalnız sol kenardan 30 piksellik şeritten başlıyordu ve
       eşik sabit 70 pikseldi; parmak kenarı ıskalayınca hiç çalışmıyordu.
       Artık detayın her yerinden başlıyor; yön kilidi katı (yatay hareket
       dikeyin 1,4 katı), dikey kaydırma bozulmuyor.

       DONMA
       Eski hareket bir dokunuşta "aktif" kalabiliyordu (uygulamadan çıkıp
       dönünce dokunuşun bitişi hiç gelmiyor). O hâlde sonraki her dokunuş
       kaydırmayı engelliyordu: sayfa donmuş gibiydi. Şimdi her yeni
       dokunuş, iptal, sekme değişimi ve geri tuşu durumu sıfırlıyor. */
    function kaydirarakGeriKur() {
        var panel = el('siparisDetay');
        if (!panel) return;
        var arkalar = [document.querySelector('.sip-ust'), document.querySelector('.sip-sayfa')].filter(Boolean);
        var golge = document.createElement('div');
        golge.className = 'sip-geri-golge';
        golge.hidden = true;
        golge.setAttribute('aria-hidden', 'true');
        document.body.appendChild(golge);

        var EGRI = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
        var PARALAKS = 0.28;
        var d = null;
        var kare = 0;
        var bitisSaati = null;
        var hayaletBitis = 0;

        function stilYaz(gecis, x, w) {
            var p = Math.min(1, Math.max(0, x / w));
            panel.style.transition = gecis ? 'transform ' + gecis : 'none';
            panel.style.transform = 'translate3d(' + x + 'px,0,0)';
            arkalar.forEach(function (a) {
                a.style.transition = gecis ? 'transform ' + gecis : 'none';
                a.style.transform = 'translate3d(' + (-PARALAKS * w * (1 - p)) + 'px,0,0)';
            });
            golge.style.transition = gecis ? 'opacity ' + gecis : 'none';
            golge.style.opacity = String(1 - p);
        }

        function sifirla() {
            clearTimeout(bitisSaati);
            bitisSaati = null;
            if (kare) { cancelAnimationFrame(kare); kare = 0; }
            d = null;
            panel.classList.remove('sip-detay--suruk');
            panel.style.transition = '';
            panel.style.transform = '';
            arkalar.forEach(function (a) { a.style.transition = ''; a.style.transform = ''; });
            golge.hidden = true;
            golge.style.transition = '';
            golge.style.opacity = '';
        }

        global.JBSiparisKaydir = { sifirla: function () { if (!d || !d.bitiyor) sifirla(); } };

        function cerceve() {
            kare = 0;
            if (d && d.yon === 'x' && !d.bitiyor) stilYaz(null, Math.max(0, d.dx), d.w);
        }

        panel.addEventListener('touchstart', function (e) {
            if (d && d.bitiyor) return;
            d = null;
            if (!durum.secili || e.touches.length !== 1 || azaltilmisHareket()) return;
            if (e.target.closest('input, textarea, select, [data-yatay]')) return;
            var t = e.touches[0];
            d = { x0: t.clientX, y0: t.clientY, dx: 0, yon: null, bitiyor: false,
                  w: panel.getBoundingClientRect().width || window.innerWidth,
                  iz: [{ t: e.timeStamp, x: t.clientX }] };
        }, { passive: true });

        panel.addEventListener('touchmove', function (e) {
            if (!d || d.bitiyor) return;
            if (e.touches.length !== 1) { if (d.yon === 'x') geriBirak(false); else d = null; return; }
            var t = e.touches[0];
            var dx = t.clientX - d.x0;
            var dy = t.clientY - d.y0;
            if (d.yon === null) {
                if (Math.abs(dx) + Math.abs(dy) < 10) return;
                if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.4) {
                    d.yon = 'x';
                    d.x0 = t.clientX;          // eşik payı panele yansımasın
                    golge.hidden = false;
                    panel.classList.add('sip-detay--suruk');
                } else {
                    d = null;                   // dikey: sayfa normal kayar
                    return;
                }
            }
            if (e.cancelable) e.preventDefault();
            d.dx = t.clientX - d.x0;
            d.iz.push({ t: e.timeStamp, x: t.clientX });
            if (d.iz.length > 8) d.iz.shift();
            if (!kare) kare = requestAnimationFrame(cerceve);
        }, { passive: false });

        function hiz() {
            if (!d || d.iz.length < 2) return 0;
            var son = d.iz[d.iz.length - 1];
            var ilk = d.iz[0];
            for (var i = d.iz.length - 2; i >= 0; i--) {
                if (son.t - d.iz[i].t > 100) break;
                ilk = d.iz[i];
            }
            var sure = son.t - ilk.t;
            return sure > 0 ? (son.x - ilk.x) / sure : 0;
        }

        function geriBirak(iptal) {
            if (!d) return;
            if (d.yon !== 'x') { d = null; return; }
            if (kare) { cancelAnimationFrame(kare); kare = 0; }
            var v = iptal ? 0 : hiz();
            var x = Math.max(0, d.dx);
            var kapat = !iptal && (x > d.w * 0.33 || (v > 0.45 && x > 24));
            var kalan = kapat ? (d.w - x) : x;
            var sure = Math.round(Math.min(300, Math.max(150, kalan / Math.max(Math.abs(v), 1.3))));
            d.bitiyor = true;
            stilYaz(sure + 'ms ' + EGRI, kapat ? d.w : 0, d.w);
            if (kapat) hayaletBitis = Date.now() + sure + 350;
            bitisSaati = setTimeout(function () {
                if (kapat) {
                    /* Panel ekran dışındayken aynı karede kapanıyor ve stiller
                       siliniyor; CSS'in kapanış konumu da ekran dışı, bir an
                       geri görünme olmuyor. */
                    detayiKapat(true);
                }
                sifirla();
            }, sure + 16);
        }

        panel.addEventListener('touchend', function () { geriBirak(false); }, { passive: true });
        panel.addEventListener('touchcancel', function () { geriBirak(true); }, { passive: true });
        window.addEventListener('blur', function () { if (d && !d.bitiyor) geriBirak(true); });

        /* Hayalet tık: parmak kalkınca tarayıcı bir tık daha üretebiliyor
           ve alttaki kartı açabiliyordu. Kapanıştan hemen sonraki tık yutuluyor. */
        document.addEventListener('click', function (e) {
            if (hayaletBitis && Date.now() < hayaletBitis) {
                e.stopPropagation();
                e.preventDefault();
                hayaletBitis = 0;
            }
        }, true);
    }

    function baglan() {
        /* İki şerit de aynı kapsayıcının altında; tek dinleyici kartı
           bulup açıyor. */
        el('siparisAkis').addEventListener('click', function (e) {
            var kart = e.target.closest('.sip-kart');
            if (kart) { siparisAc(kart.getAttribute('data-siparis')); return; }

            var baslik = e.target.closest('.sip-serit__ust');
            if (baslik) siraDegistir(baslik);
        });

        el('siparisYenile').addEventListener('click', function () {
            var d = el('siparisYenile');
            d.classList.remove('donuyor');
            void d.offsetWidth;
            d.classList.add('donuyor');
            tazele(true);
        });

        /* Doğrudan `detayiKapat` bağlanamaz: dinleyici event nesnesini
           ilk argüman olarak geçiriyor ve o da `animasyonAtla` sayılıp
           kapanış animasyonunu iptal ediyordu. */
        el('detayGeri').addEventListener('click', function () { detayiKapat(); });

        kaydirarakGeriKur();

        /* Kişi fotoğrafı yalnız sipariş detayında büyüyor. Ana ekrandaki
           kartın her yeri siparişi açıyor; kişiye dokunmak da öyle. */
        el('detayKisiler').addEventListener('click', function (e) {
            var kf = e.target.closest('[data-kisi-foto]');
            if (kf) kisiFotoAc(kf);
        });

        el('detayGovde').addEventListener('click', function (e) {
            if (!durum.secili) return;
            var urunBul = function (n) {
                return (durum.secili.urunler || []).filter(function (x) { return x.sira === n; })[0];
            };

            var img = e.target.closest('[data-buyut]');
            if (img) { var u1 = urunBul(Number(img.getAttribute('data-buyut'))); if (u1) gorseliBuyut(u1); return; }

            var ad = e.target.closest('[data-barkod]');
            if (ad) { var u2 = urunBul(Number(ad.getAttribute('data-barkod'))); if (u2) kodlariAc(u2); return; }

            /* İşaretleme yalnız yuvarlak düğmeden. Barkodu okumak için ada
               dokunan depocu ürünü yanlışlıkla alınmış işaretlemesin. */
            var al = e.target.closest('[data-isaretle]');
            if (!al) return;
            var u3 = urunBul(Number(al.getAttribute('data-isaretle')));
            if (u3) urunIsaretle(durum.secili, u3, !u3.alindi);
        });

        document.querySelectorAll('#detayGorunum button').forEach(function (b) {
            b.addEventListener('click', function () {
                durum.detayGorunum = b.getAttribute('data-detay-gorunum');
                ayarYaz({ detayGorunum: durum.detayGorunum });
                ciz();
            });
        });

        el('detayBitir').addEventListener('click', function () {
            var s = durum.secili;
            if (!s) return;
            var hal = el('detayBitir').getAttribute('data-hal');
            if (hal === 'bitti') { detayiKapat(); return; }
            var kapat = function () {
                if (!durum.secili || durum.secili.id !== s.id) return;
                clearTimeout(_durumSaatleri.get(s.id));
                _durumSaatleri.delete(s.id);
                siparisDurumu(s, 'toplandi', true);
                bildir((s.banko ? 'Banko ' + s.banko : 'Sipariş') + ' toplandı');
                setTimeout(function () { if (durum.secili && durum.secili.id === s.id) detayiKapat(); }, 260);
            };
            if (hal === 'tam') { kapat(); return; }
            var urunler = s.urunler || [];
            var eksik = toplamAdet(urunler) - alinanAdet(urunler);
            var soru = eksik + ' parça henüz alınmadı. Sipariş yine de toplandı sayılsın mı?';
            if (global.JBDiyalog && global.JBDiyalog.onay) {
                global.JBDiyalog.onay(soru, { baslik: 'Siparişi bitir', onayYazi: 'Evet, bitir', vazgecYazi: 'Vazgeç' })
                    .then(function (evet) { if (evet) kapat(); });
            } else if (window.confirm(soru)) {
                kapat();
            }
        });

        // ---- Katmanlar ----
        el('kodKapat').addEventListener('click', function () { katKapat('siparisKodlar'); });
        el('kodGorselDugme').addEventListener('click', function () { gorseliBuyut(durum.kodUrun); });
        el('siparisKodlar').addEventListener('click', function (e) {
            if (e.target === el('siparisKodlar')) { katKapat('siparisKodlar'); return; }
            var sec = e.target.closest('[data-kod-sec]');
            if (sec) { kodSec(Number(sec.getAttribute('data-kod-sec'))); return; }
            var k = e.target.closest('[data-kopyala]');
            if (k && k.getAttribute('data-kopyala')) {
                kopyala(k.getAttribute('data-kopyala'));
                if (k.id === 'kodKopya') {
                    k.classList.add('is-tamam');
                    k.querySelector('span').textContent = 'Kopyalandı';
                    clearTimeout(k._saat);
                    k._saat = setTimeout(function () {
                        k.classList.remove('is-tamam');
                        k.querySelector('span').textContent = 'Kopyala';
                    }, 1400);
                }
            }
        });
        el('kodListe').addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            var yeni = (durum.kodSecili || 0) + (e.key === 'ArrowDown' ? 1 : -1);
            kodSec(yeni);
            var b = el('kodListe').querySelector('[data-kod-sec="' + durum.kodSecili + '"]');
            if (b) b.focus();
        });

        el('kapananlarAc').addEventListener('click', kapananlariAc);
        el('kapananKapat').addEventListener('click', function () { katKapat('siparisKapananlar'); });
        el('siparisKapananlar').addEventListener('click', function (e) {
            if (e.target === el('siparisKapananlar')) { katKapat('siparisKapananlar'); return; }
            var ac = e.target.closest('[data-kapanan-ac]');
            if (ac) {
                /* Pencere kapanıp detay açılıyor. Geri gidip yeni kayıt
                   yazmak yerine pencerenin geçmiş kaydı detaya devrediliyor:
                   ikisi aynı anda yapılınca tarayıcı yanlış kaydı geri
                   alabiliyordu. */
                var i = katmanlar.lastIndexOf('siparisKapananlar');
                katGizle('siparisKapananlar');
                if (i !== -1 && i === katmanlar.length - 1 && katmanlar.indexOf('detay') === -1) {
                    katmanlar[i] = 'detay';
                    try { history.replaceState({ jbKatman: 'detay', derinlik: katmanlar.length }, ''); } catch (err) { /* sessiz */ }
                } else {
                    katmanKapandi('siparisKapananlar');
                }
                siparisAc(ac.getAttribute('data-kapanan-ac'));
                return;
            }
            var geri = e.target.closest('[data-kapanan-geri]');
            if (geri) kapananiGeriAc(geri.getAttribute('data-kapanan-geri'));
        });

        el('siparisAyarAc').addEventListener('click', ayarAc);

        // ---- Ayar sekmeleri ----
        el('ayarSekmeler').addEventListener('click', function (e) {
            var b = e.target.closest('[data-ayar-sekme]');
            if (b) ayarSekmesiGoster(b.getAttribute('data-ayar-sekme'));
        });
        el('ayarSekmeler').addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            var i = AYAR_SEKMELERI.indexOf(_aktifAyarSekmesi) + (e.key === 'ArrowRight' ? 1 : -1);
            var ad = AYAR_SEKMELERI[(i + AYAR_SEKMELERI.length) % AYAR_SEKMELERI.length];
            ayarSekmesiGoster(ad);
            var b = el('ayarSekmeler').querySelector('[data-ayar-sekme="' + ad + '"]');
            if (b) b.focus();
        });
        el('ayarSeritSira').addEventListener('change', function (e) {
            var sec = e.target.closest('[data-serit-sira]');
            if (sec) seritSirasiAyarla(sec.getAttribute('data-serit-sira'), sec.value);
        });
        el('ayarSeritSifirla').addEventListener('click', function () {
            durum.seritSira = Object.assign({}, SERIT_VARSAYILAN);
            ayarYaz({ seritSira: durum.seritSira });
            durum.kartImzasi = { hazirlaniyor: '', hazir: '', yolda: '' };
            ['hazirlaniyor', 'hazir', 'yolda'].forEach(siraBaslikGuncelle);
            ciz();
            seritSiraCiz();
        });
        el('ayarEfektMod').addEventListener('change', function (e) {
            if (e.target.name === 'efektMod') efektYaz({ mod: e.target.value });
        });
        el('ayarEfektGuc').addEventListener('input', function (e) {
            durum.efekt.guc = Number(e.target.value) || 0;
            el('ayarEfektGucDeger').textContent = durum.efekt.guc;
        });
        el('ayarEfektGuc').addEventListener('change', function (e) {
            efektYaz({ guc: Number(e.target.value) || 0 });
            efektDene();
        });
        el('ayarTitresim').addEventListener('change', function (e) {
            efektYaz({ titresim: !!e.target.checked });
        });
        el('ayarEfektDene').addEventListener('click', efektDene);
        el('ayarKapat').addEventListener('click', function () { katKapat('siparisAyar'); });
        el('siparisAyar').addEventListener('click', function (e) {
            if (e.target === el('siparisAyar')) katKapat('siparisAyar');
        });

        /* Renk girdisi sürüklenirken anında uygulanıyor; "input" olayı
           "change"den daha erken ve daha sık geliyor. Kelime kutuları ise
           "change"de kaydediyor: her tuşta yeniden sıralamak yazarken
           rahatsız ederdi. */
        el('ayarKategoriler').addEventListener('input', function (e) {
            var t = e.target.closest('[data-kategori-renk]');
            if (!t) return;
            var k = kategoriBul(t.getAttribute('data-kategori-renk'));
            if (!k) return;
            k.renk = t.value;
            kategorileriDegisti();
        });
        el('ayarKategoriler').addEventListener('change', function (e) {
            var dahilEl = e.target.closest('[data-kategori-dahil]');
            if (dahilEl) {
                var k1 = kategoriBul(dahilEl.getAttribute('data-kategori-dahil'));
                if (k1) { k1.dahil = kelimeleriOku(dahilEl.value); kategorileriDegisti(); }
                return;
            }
            var haricEl = e.target.closest('[data-kategori-haric]');
            if (haricEl) {
                var k2 = kategoriBul(haricEl.getAttribute('data-kategori-haric'));
                if (k2) { k2.haric = kelimeleriOku(haricEl.value); kategorileriDegisti(); }
                return;
            }
            var adEl = e.target.closest('[data-kategori-ad]');
            if (adEl) {
                var k3 = kategoriBul(adEl.getAttribute('data-kategori-ad'));
                if (!k3) return;
                var yeniAd = adEl.value.trim();
                if (!yeniAd) { adEl.value = k3.etiket; return; }
                k3.etiket = yeniAd;
                kategorileriDegisti();
            }
        });
        el('ayarKategoriler').addEventListener('click', function (e) {
            var sil = e.target.closest('[data-kategori-sil]');
            if (sil) { kategoriSil(sil.getAttribute('data-kategori-sil')); return; }

            var ekle = e.target.closest('[data-urun-ekle]');
            if (ekle) {
                urunEkle(ekle.getAttribute('data-urun-ekle'), ekle.getAttribute('data-urun-ad'));
                return;
            }
            var cikar = e.target.closest('[data-urun-cikar]');
            if (cikar) urunCikar(cikar.getAttribute('data-urun-cikar'), cikar.getAttribute('data-urun-ad'));
        });

        /* Arama her tuşta değil, kısa bir duraklamadan sonra çalışıyor;
           9.000 ürünü her harfte taramanın anlamı yok. */
        var aramaSaati = null;
        el('ayarKategoriler').addEventListener('input', function (e) {
            var kutu = e.target.closest('[data-urun-ara]');
            if (!kutu) return;
            clearTimeout(aramaSaati);
            var kume = kutu.getAttribute('data-urun-ara');
            var sorgu = kutu.value;
            aramaSaati = setTimeout(function () { onerileriCiz(kume, sorgu); }, 120);
        });
        el('kategoriEkle').addEventListener('click', kategoriEkle);

        el('ayarYukSira').addEventListener('click', function (e) {
            var d = e.target.closest('[data-tasi]');
            if (!d) return;
            var yon = Number(d.getAttribute('data-tasi'));
            var k = d.getAttribute('data-yuk');
            var dizi = durum.yukSirasi.slice();
            var i = dizi.indexOf(k);
            var j = i + yon;
            if (i < 0 || j < 0 || j >= dizi.length) return;
            dizi[i] = dizi[j];
            dizi[j] = k;
            durum.yukSirasi = dizi;
            ayarYaz({ yukSirasi: dizi });
            yukSirasiCiz();
            /* Yalnız "Kolay önce" seçili şeritler etkileniyor ama kart
               imzasını sıfırlamak en ucuzu; liste zaten elde. */
            durum.kartImzasi = { hazirlaniyor: '', hazir: '', yolda: '' };
            ciz();
        });

        el('ayarSira').addEventListener('click', function (e) {
            var d = e.target.closest('[data-tasi]');
            if (!d) return;
            var yon = Number(d.getAttribute('data-tasi'));
            var k = d.getAttribute('data-bant');
            var dizi = durum.bantSirasi.slice();
            var i = dizi.indexOf(k);
            var j = i + yon;
            if (i < 0 || j < 0 || j >= dizi.length) return;
            dizi[i] = dizi[j];
            dizi[j] = k;
            durum.bantSirasi = dizi;
            ayarYaz({ bantSirasi: dizi });
            siraCiz();
            durum.detayImzasi = '';
            tazele(true);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            // Üstteki katman önce kapanmalı; Esc bir seferde ikisini kapatmasın.
            if (!el('siparisKodlar').hidden) { katKapat('siparisKodlar'); return; }
            if (!el('siparisAyar').hidden) { katKapat('siparisAyar'); return; }
            if (!el('siparisKapananlar').hidden) { katKapat('siparisKapananlar'); return; }
            if (durum.secili) detayiKapat();
        });

        /* Sekme öne gelince hemen bir kez tazele; depocu telefonu cebinden
           çıkardığında eski listeye bakmasın. Arka planda yoklama durur,
           pil ve veri harcamaz. */
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') {
                durumuOnar();
                sonTamCekim = 0;
                dongu();
            } else {
                clearTimeout(donguSaati);
                if (global.JBSiparisKaydir) global.JBSiparisKaydir.sifirla();
            }
        });
        window.addEventListener('pageshow', function () { durumuOnar(); dongu(); });
        window.addEventListener('online', function () { sonTamCekim = 0; dongu(); });
    }

    function yoklamayiBaslat() {
        dongu();
    }

    // ==================================================================
    // Açılış
    // ==================================================================

    async function hakVarMi() {
        var p = global.premiumFeatures;
        if (!p) return false;
        try {
            if (typeof p.init === 'function' && !p.checkPremiumFeature('siparisTakibi')) await p.init();
            if (!p.checkPremiumFeature('siparisTakibi') && typeof p.loadPremiumFeatures === 'function') {
                await p.loadPremiumFeatures();
            }
        } catch (e) { /* sessiz */ }
        return !!p.checkPremiumFeature('siparisTakibi');
    }

    /* Üç bölümden yalnız biri açık kalmalı. */
    function bolumGoster(id) {
        ['siparisGiris', 'siparisYetkiYok', 'siparisIcerik'].forEach(function (x) {
            var e = el(x);
            if (e) e.hidden = (x !== id);
        });
    }

    async function basla() {
        var o = oturum();
        if (!o || !o.username) { bolumGoster('siparisGiris'); return; }
        if (!(await hakVarMi())) { bolumGoster('siparisYetkiYok'); return; }

        var ayar = ayarOku();
        if (['liste', 'ikili', 'uclu', 'dortlu'].indexOf(ayar.detayGorunum) !== -1) durum.detayGorunum = ayar.detayGorunum;
        durum.seritSira = Object.assign({}, SERIT_VARSAYILAN);
        if (ayar.seritSira && typeof ayar.seritSira === 'object') {
            Object.keys(SERIT_VARSAYILAN).forEach(function (b) {
                if (siraSecenegiVarMi(ayar.seritSira[b])) durum.seritSira[b] = ayar.seritSira[b];
            });
        }
        if (ayar.efekt && typeof ayar.efekt === 'object') {
            var ef = ayar.efekt;
            if (['tam', 'sayi', 'kapali'].indexOf(ef.mod) !== -1) durum.efekt.mod = ef.mod;
            if (isFinite(Number(ef.guc))) durum.efekt.guc = Math.max(0, Math.min(100, Math.round(Number(ef.guc))));
            if (typeof ef.titresim === 'boolean') durum.efekt.titresim = ef.titresim;
        }

        var vars = (global.JBSiparisSirala && global.JBSiparisSirala.VARSAYILAN_SIRA) || ['firin', 'dondurma', 'orta', 'su'];
        durum.bantSirasi = Array.isArray(ayar.bantSirasi) && ayar.bantSirasi.length
            ? ayar.bantSirasi.slice()
            : vars.slice();
        durum.kategoriler = kategorileriYukle(ayar);
        bantSirasiOnar();
        /* Varsayılan yük sırası: su en hafif, dondurma en ağır. Depocunun
           anlattığı akış bu. */
        durum.yukSirasi = Array.isArray(ayar.yukSirasi) && ayar.yukSirasi.length
            ? ayar.yukSirasi.slice()
            : ['su', 'firin', 'dondurma'];
        yukSirasiOnar();
        /* Rozetlerin içeriği JS'ten geliyor; açılışta bir kez doldurulmazsa
           kullanıcı boş bir hap görüyor. Eskiden HTML'de emoji yazılıydı,
           bu adım gerekmiyordu. */
        ['hazirlaniyor', 'hazir', 'yolda'].forEach(siraBaslikGuncelle);

        bolumGoster('siparisIcerik');
        baglan();
        ciz();
        tazele(true).then(yoklamayiBaslat);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', basla);
    } else {
        basla();
    }

    global.JBSiparisler = { tazele: tazele, durum: durum };
})(window);
