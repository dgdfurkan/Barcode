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

    var YOKLAMA_MS = 8000;
    var durum = {
        siparisler: [],
        secili: null,
        detayGorunum: 'liste',
        bantSirasi: null,
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
        seritSira: { hazirlaniyor: 'sure', hazir: 'sure', yolda: 'sure' }
    };

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
        var siparisSonuc = await d.from('orders')
            .select('*')
            .eq('username', o.username)
            .order('created_at', { ascending: false })
            .limit(60);

        if (siparisSonuc.error) throw new Error(siparisSonuc.error.message || 'Siparişler alınamadı');
        var siparisler = siparisSonuc.data || [];
        if (!siparisler.length) return [];

        var kimlikler = siparisler.map(function (s) { return s.id; });
        var satirSonuc = await d.from('order_items')
            .select('order_uuid,sira,urun_adi,gorsel_id,adet,birim,ana_kategori,sinif,alt_sinif,alindi')
            .in('order_uuid', kimlikler);

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
                    alindi: !!r.alindi
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

    async function tazele(zorla) {
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
        }
        ciz();
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

    async function urunIsaretle(siparis, urun, alindi) {
        var d = db();
        if (!d) {
            /* Sessizce hiçbir şey yapmak en kötüsü: depocu işaretlediğini
               sanıp geçiyor. */
            if (global.JBDiyalog) global.JBDiyalog.hata('Veri bağlantısı yok, işaretleme kaydedilemez.');
            return;
        }

        /* Ekranı hemen çevir; ağ beklemesi elde hissedilmesin. Yalnız o
           satır güncelleniyor: gövdeyi yeniden yazmak kaydırmayı başa
           atıyor ve bütün satırları yeniden belirtiyordu. */
        urun.alindi = alindi;
        satiriTazele(urun);
        durum.detayImzasi = siparis.id + '|' + durum.detayGorunum + '|' +
            (siparis.urunler || []).map(function (u) { return u.sira + (u.alindi ? '1' : '0'); }).join('');

        var sonuc = await d.from('order_items')
            .update({ alindi: alindi })
            .eq('order_uuid', siparis.id)
            .eq('sira', urun.sira);

        if (sonuc.error) {
            urun.alindi = !alindi;
            satiriTazele(urun);
            if (global.JBDiyalog) global.JBDiyalog.hata('Ürün işaretlenemedi. Bağlantını kontrol et.');
            return;
        }

        var tamami = (siparis.urunler || []).every(function (u) { return u.alindi; });
        var hedef = tamami ? 'toplandi' : (siparis.urunler.some(function (u) { return u.alindi; }) ? 'toplaniyor' : 'bekliyor');
        /* Kart listesindeki sayaç da güncellensin diye tam çizim. Detay
           gövdesi imzası değişmediği için yeniden yazılmıyor; kaydırma
           yerinde kalıyor. */
        if (hedef !== siparis.toplama_durumu) await siparisDurumu(siparis, hedef);
        else ciz();
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

        var sonuc = await d.from('orders')
            .update({ toplama_durumu: yeni, updated_at: new Date().toISOString() })
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

    async function gidenleriSil(liste) {
        var d = db();
        if (!d) return [];
        var silinecek = liste.filter(gitmisMi);
        if (!silinecek.length) return [];

        var silinen = [];
        for (var i = 0; i < silinecek.length; i++) {
            var sonuc = await d.from('orders').delete().eq('id', silinecek[i].id);
            if (!sonuc.error) silinen.push(silinecek[i].id);
        }
        return silinen;
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
    function fotoOnyukle(url) {
        if (!url || _fotoOnbellek.has(url)) return;
        _fotoOnbellek.add(url);
        var img = new Image();
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
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
            ? '<img src="' + kacir(foto) + '" alt="" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add(\'yuklu\')" onerror="this.remove()">'
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
                '<span class="sip-adet' + (u.birim ? ' sip-adet--birim' : '') + '">' + adetYaz(u.adet) +
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
            return '<div class="sip-kisi-satir">' +
                '<span class="sip-avatar' + (kurye ? ' sip-avatar--kurye' : '') +
                    (ad ? '' : ' sip-avatar--bos') + (ad && foto ? ' sip-avatar--foto' : '') + '">' +
                    ic + '</span>' +
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

        var bitir = el('detayBitir');
        bitir.querySelector('span').textContent = s.toplama_durumu === 'toplandi' ? 'Geri al' : 'Toplandı';
        bitir.classList.toggle('sip-bitir--tam', tam && s.toplama_durumu !== 'toplandi');
        bitir.disabled = !toplam;
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
    var SIRA_SECENEKLERI = [
        { anahtar: 'sure', etiket: 'Süreye göre' },
        { anahtar: 'banko', etiket: 'Banko numarasına göre' },
        { anahtar: 'kurye', etiket: 'Kurye adına göre' }
    ];

    function bankoSiraDegeri(s) {
        var k = siparisKimligi(s);
        if (!k.bankoVar) return 99999;
        var m = String(k.deger).match(/\d+/);
        return m ? parseInt(m[0], 10) : 99999;
    }

    function sirala(liste, kriter) {
        var kopy = liste.slice();
        if (kriter === 'banko') {
            kopy.sort(function (a, b) { return bankoSiraDegeri(a) - bankoSiraDegeri(b); });
        } else if (kriter === 'kurye') {
            kopy.sort(function (a, b) {
                var ka = (a.kurye || '').toLocaleLowerCase('tr');
                var kb = (b.kurye || '').toLocaleLowerCase('tr');
                if (!ka && !kb) return 0;
                if (!ka) return 1;
                if (!kb) return -1;
                return ka.localeCompare(kb, 'tr');
            });
        } else {
            kopy.sort(function (a, b) {
                var ta = new Date(a.sepet_zamani || a.created_at || 0).getTime();
                var tb = new Date(b.sepet_zamani || b.created_at || 0).getTime();
                return ta - tb;
            });
        }
        return kopy;
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
            kutu.innerHTML = liste.map(function (s, idx) {
                return kartCiz(s, kartYeni ? Math.min(idx, 12) : null);
            }).join('');
        }
        return liste;
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

        var saat = durum.sonYenileme ? saatYaz(durum.sonYenileme) : null;
        el('sonGuncelleme').textContent = 'Canlı · ' + (saat || 'yükleniyor');
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
        el('detayKisiler').innerHTML = yanKisiler(s);
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
                  '<p>Panelde siparişe bir kez girmen yeterli.</p></div>';
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

    function katAc(id) {
        el(id).hidden = false;
        document.body.classList.add('sip-kat-acik');
    }

    function katKapat(id) {
        el(id).hidden = true;
        if (!document.querySelector('.sip-kat:not([hidden])')) {
            document.body.classList.remove('sip-kat-acik');
        }
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

    /** Barkod penceresi. Ana kod büyük, diğerleri altında rozet olarak.
        Üstteki görsele dokunmak da büyük fotoğrafı açıyor. */
    function kodlariAc(u) {
        var bilgi = barkodBul(u);
        durum.kodUrun = u;
        var g = el('kodGorsel');
        var gd = el('kodGorselDugme');
        var kodAdres = urunGorseli(u, bilgi);
        if (kodAdres) { g.src = kodAdres; gd.hidden = false; }
        else { g.removeAttribute('src'); gd.hidden = true; }

        el('kodAd').textContent = urunBasligi(u, bilgi);
        el('kodNot').textContent = adetYaz(u.adet) + (u.birim ? ' ' + u.birim : '') + ' adet' +
            (bilgi.barkodlar.length > 1 ? '  ·  ' + bilgi.barkodlar.length + ' barkod' : '');

        var varMi = bilgi.barkodlar.length > 0;
        el('kodCizgiler').hidden = !varMi;
        el('kodNo').hidden = !varMi;
        el('kodDiger').hidden = !varMi;
        el('kodBos').hidden = varMi;

        if (varMi) {
            /* Çizgiler süs değil, koda göre çiziliyor: aynı barkod hep aynı
               desende çıkıyor, farklı ürün farklı desende. */
            var kod = bilgi.barkodlar[0];
            var cizgi = '';
            for (var i = 0; i < 34; i++) {
                var n = kod.charCodeAt(i % kod.length) % 4;
                cizgi += '<i style="width:' + [2, 4, 7, 11][n] + 'px"></i>';
            }
            el('kodCizgiler').innerHTML = cizgi;
            el('kodNo').textContent = kod;
            el('kodNo').setAttribute('data-kopyala', kod);
            el('kodDiger').innerHTML = bilgi.barkodlar.slice(1).map(function (b) {
                return '<button type="button" data-kopyala="' + kacir(b) + '">' + kacir(b) + '</button>';
            }).join('');
        } else {
            el('kodBos').textContent = 'Bu ürün katalogda eşleşmedi. Barkodu panelden okutman gerekiyor.';
        }
        katAc('siparisKodlar');
    }

    function gorseliBuyut(u) {
        if (!u) return;
        var bilgi = barkodBul(u);
        var adres = urunGorseli(u, bilgi);
        if (!adres) return;
        el('buyukGorsel').src = adres;
        el('buyukAd').textContent = urunBasligi(u, bilgi);
        katAc('siparisBuyuk');
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
            return varsayilan.map(function (k) {
                return {
                    kume: k.kume, etiket: k.etiket, renk: k.renk || '#98a2b3',
                    urunler: [],
                    dahil: (k.dahil || []).slice(), haric: (k.haric || []).slice(), yerlesik: true
                };
            });
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
        ayarYaz({ bantSirasi: durum.bantSirasi });
        siraCiz();
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

    function ayarAc() {
        siraCiz();
        kategorileriCiz();
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
        if (d) d.textContent = kapananlar().length;
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

    function detayiKapat() {
        durum.secili = null;
        durum.detayImzasi = '';
        ciz();
    }

    function siparisAc(id) {
        var tumu = durum.siparisler;
        durum.secili = tumu.filter(function (s) { return s.id === id; })[0] || null;
        durum.detayImzasi = '';
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

    var SIRA_ETIKETLERI = { sure: '⏱', banko: '#', kurye: '👤' };
    var SIRA_IPUCU = { sure: 'Süreye göre', banko: 'Bankoya göre', kurye: 'Kuryeye göre' };

    function siraBaslikGuncelle(bant) {
        var serit = el('siparisAkis').querySelector('.sip-serit--' + bant);
        if (!serit) return;
        var rozet = serit.querySelector('.sip-sira-rozet');
        var kriter = durum.seritSira[bant] || 'sure';
        if (rozet) {
            rozet.textContent = SIRA_ETIKETLERI[kriter] || '⏱';
            rozet.title = SIRA_IPUCU[kriter] || '';
        }
    }

    function siraDegistir(baslik) {
        var bant = seritBantBul(baslik);
        if (!bant) return;
        var simdiki = durum.seritSira[bant] || 'sure';
        var anahtarlar = SIRA_SECENEKLERI.map(function (s) { return s.anahtar; });
        var idx = anahtarlar.indexOf(simdiki);
        durum.seritSira[bant] = anahtarlar[(idx + 1) % anahtarlar.length];
        durum.kartImzasi[bant] = '';
        ciz();
        siraBaslikGuncelle(bant);
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

        el('detayGeri').addEventListener('click', detayiKapat);

        /* Soldan sağa kaydırma ile geri: sadece sol kenardan başlar,
           dikey scroll'a karışmaz, mesafe ile canlı bir takip verir,
           yeterli mesafede kapatır, değilse yumuşak geri döner. Yalnız
           dokunmatik cihazda. */
        (function swipeGeri() {
            var el2 = el('siparisDetay');
            if (!el2) return;
            /* Yön kilidi katı: dx en az 1.7x dy olacak ki çapraz swipe
               tetiklemesin. Kilitten önce ölçüm eşiği 14px, küçük parmak
               titreklerini ele almaz. Sol kenar 30px. Dikey yön saptanırsa
               tüm swipe iptal, sayfa normal scroll eder. */
            var basX = 0, basY = 0, aktif = false, yon = null;
            var esik = 70, kenar = 30;
            var swipeKapamaZamani = 0;

            function resetStil() {
                el2.style.transition = '';
                el2.style.transform = '';
                el2.style.opacity = '';
            }

            el2.addEventListener('touchstart', function (e) {
                if (!durum.secili || e.touches.length !== 1) return;
                var t = e.touches[0];
                if (t.clientX > kenar) return;
                basX = t.clientX; basY = t.clientY;
                aktif = true; yon = null;
                el2.style.transition = 'none';
            }, { passive: true });

            el2.addEventListener('touchmove', function (e) {
                if (!aktif) return;
                var t = e.touches[0];
                var dx = t.clientX - basX;
                var dy = t.clientY - basY;
                if (yon === null) {
                    var m = Math.abs(dx), n = Math.abs(dy);
                    if (m + n < 14) return;
                    if (dx > 0 && m > n * 1.7) {
                        yon = 'x';
                    } else {
                        yon = 'y'; aktif = false; resetStil(); return;
                    }
                }
                if (yon !== 'x') return;
                if (e.cancelable) e.preventDefault();
                dx = Math.max(0, dx);
                el2.style.transform = 'translateX(' + dx + 'px)';
                el2.style.opacity = String(1 - Math.min(dx / 400, 0.28));
            }, { passive: false });

            var bitir = function (e) {
                if (!aktif) return;
                aktif = false;
                var son = (e.changedTouches && e.changedTouches[0]) || null;
                var dx = son ? son.clientX - basX : 0;
                if (yon !== 'x') { resetStil(); return; }
                el2.style.transition = 'transform 0.2s cubic-bezier(.2,.8,.2,1), opacity 0.2s ease-out';
                if (dx > esik) {
                    var w = el2.getBoundingClientRect().width || window.innerWidth;
                    el2.style.transform = 'translateX(' + w + 'px)';
                    el2.style.opacity = '0';
                    swipeKapamaZamani = Date.now();
                    setTimeout(function () { resetStil(); detayiKapat(); }, 210);
                } else {
                    el2.style.transform = ''; el2.style.opacity = '';
                    setTimeout(function () { el2.style.transition = ''; }, 220);
                }
            };
            el2.addEventListener('touchend', bitir, { passive: true });
            el2.addEventListener('touchcancel', bitir, { passive: true });

            /* Ghost-click yut: touchend'ten sonra 350ms içinde gelen ilk
               click swipe kalıntısı olabilir; birinci tıklama boşa
               gitmesin diye o click'i emen bir hindi katman. */
            document.addEventListener('click', function (e) {
                if (swipeKapamaZamani && Date.now() - swipeKapamaZamani < 350) {
                    e.stopPropagation();
                    e.preventDefault();
                    swipeKapamaZamani = 0;
                }
            }, true);
        })();

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
            var kapaniyor = s.toplama_durumu !== 'toplandi';
            siparisDurumu(s, kapaniyor ? 'toplandi' : 'bekliyor');
            bildir(kapaniyor ? 'Sipariş toplandı olarak kapatıldı' : 'Sipariş yeniden açıldı');
            if (kapaniyor) setTimeout(detayiKapat, 350);
        });

        // ---- Katmanlar ----
        el('kodKapat').addEventListener('click', function () { katKapat('siparisKodlar'); });
        el('kodGorselDugme').addEventListener('click', function () { gorseliBuyut(durum.kodUrun); });
        el('siparisKodlar').addEventListener('click', function (e) {
            if (e.target === el('siparisKodlar')) { katKapat('siparisKodlar'); return; }
            var k = e.target.closest('[data-kopyala]');
            if (k && k.getAttribute('data-kopyala')) kopyala(k.getAttribute('data-kopyala'));
        });

        el('buyukKapat').addEventListener('click', function () { katKapat('siparisBuyuk'); });
        el('siparisBuyuk').addEventListener('click', function (e) {
            if (e.target === el('siparisBuyuk') || e.target.classList.contains('sip-buyuk__ic')) {
                katKapat('siparisBuyuk');
            }
        });

        el('kapananlarAc').addEventListener('click', kapananlariAc);
        el('kapananKapat').addEventListener('click', function () { katKapat('siparisKapananlar'); });
        el('siparisKapananlar').addEventListener('click', function (e) {
            if (e.target === el('siparisKapananlar')) { katKapat('siparisKapananlar'); return; }
            var ac = e.target.closest('[data-kapanan-ac]');
            if (ac) {
                katKapat('siparisKapananlar');
                siparisAc(ac.getAttribute('data-kapanan-ac'));
                return;
            }
            var geri = e.target.closest('[data-kapanan-geri]');
            if (geri) kapananiGeriAc(geri.getAttribute('data-kapanan-geri'));
        });

        el('siparisAyarAc').addEventListener('click', ayarAc);
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
            if (!el('siparisBuyuk').hidden) { katKapat('siparisBuyuk'); return; }
            if (!el('siparisKodlar').hidden) { katKapat('siparisKodlar'); return; }
            if (!el('siparisAyar').hidden) { katKapat('siparisAyar'); return; }
            if (!el('siparisKapananlar').hidden) { katKapat('siparisKapananlar'); return; }
            if (durum.secili) detayiKapat();
        });

        /* Sekme öne gelince hemen bir kez tazele; depocu telefonu cebinden
           çıkardığında eski listeye bakmasın. */
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') tazele(false);
        });
    }

    function yoklamayiBaslat() {
        if (zamanlayici) clearInterval(zamanlayici);
        zamanlayici = setInterval(function () {
            if (document.visibilityState === 'visible') tazele(false);
        }, YOKLAMA_MS);
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

        var vars = (global.JBSiparisSirala && global.JBSiparisSirala.VARSAYILAN_SIRA) || ['firin', 'dondurma', 'orta', 'su'];
        durum.bantSirasi = Array.isArray(ayar.bantSirasi) && ayar.bantSirasi.length
            ? ayar.bantSirasi.slice()
            : vars.slice();
        durum.kategoriler = kategorileriYukle(ayar);
        bantSirasiOnar();

        bolumGoster('siparisIcerik');
        baglan();
        ciz();
        tazele(true);
        yoklamayiBaslat();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', basla);
    } else {
        basla();
    }

    global.JBSiparisler = { tazele: tazele, durum: durum };
})(window);
