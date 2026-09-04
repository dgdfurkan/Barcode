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
 * BANT RENKLERİ
 * Fırın/dondurma/su rengi ayarlardan değişebiliyor. Kart zemini o renklerin
 * soluk karışımından hesaplanıyor (sipariş hangi kategoriden ağırlıklıysa).
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
        bantRenkleri: null,
        kodUrun: null,
        yukleniyor: true,
        sonImza: '',
        sonYenileme: null,
        /* Giriş animasyonu yalnız içerik gerçekten değiştiğinde oynuyor.
           Her yoklamada yeniden oynasa ekran titrerdi. İki şerit ayrı ayrı
           izleniyor. */
        kartImzasi: { hazirlaniyor: '', hazir: '' },
        detayImzasi: ''
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
    // Örnek sipariş (geçici test aracı)
    //
    // Ayarlardan girilen kurgusal sipariş. Yalnız bu cihazın yerel
    // deposunda duruyor; sunucuya hiçbir istek gitmiyor, işaretlemeleri de
    // yerelde kalıyor. Listede ÖRNEK rozetiyle ayırt ediliyor.
    // Deneme bitince bu bölüm ve ayarlardaki alan kaldırılacak.
    // ==================================================================

    var ORNEK_ANAHTARI = 'jb_siparis_ornek';

    function ornekOku() {
        try {
            var h = JSON.parse(localStorage.getItem(ORNEK_ANAHTARI) || '[]');
            if (Array.isArray(h)) return h;
        } catch (e) { /* sessiz */ }
        return [];
    }

    function ornekYaz(liste) {
        try { localStorage.setItem(ORNEK_ANAHTARI, JSON.stringify(liste)); }
        catch (e) { /* sessiz */ }
    }

    /**
     * "Eti Canga (45 g) x3" -> { ad: 'Eti Canga (45 g)', adet: 3 }
     * "Domates x 1,35 kg"   -> { ad: 'Domates', adet: 1.35, birim: 'kg' }
     * Adet yazılmamışsa 1. Ürün adında parantez ve virgül olabildiği için
     * ayırma yalnız satır sonundaki çarpı işaretine bakıyor.
     */
    function ornekUrunAyikla(metin) {
        return String(metin || '').split(/\r?\n/)
            .map(function (satir) { return satir.trim(); })
            .filter(Boolean)
            .map(function (satir) {
                var e = /^(.*?)\s*[x*×]\s*([\d]+(?:[.,][\d]+)?)\s*(kg|g|lt|l|ml)?\s*$/i.exec(satir);
                if (!e || !e[1]) return { ad: satir, adet: 1, birim: '' };
                return {
                    ad: e[1].trim(),
                    adet: parseFloat(e[2].replace(',', '.')) || 1,
                    birim: (e[3] || '').toLowerCase()
                };
            });
    }

    /** Katalogdan ürün görselini bulur; örnek sipariş gerçeğe benzesin. */
    function katalogGorseli(ad) {
        katalogHazirla();
        var u = katalogDizin && katalogDizin.get(sade(ad));
        return (u && u.image) || '';
    }

    /** Yerel kayıtları sipariş nesnesine çevirir. */
    function ornekleriKur() {
        return ornekOku().map(function (o) {
            var ham = (o.urunler || []).map(function (u, i) {
                return {
                    sira: i + 1,
                    ad: u.ad || '',
                    gorsel: katalogGorseli(u.ad),
                    adet: u.adet,
                    birim: u.birim || '',
                    anaKategori: '',
                    sinif: '',
                    altSinif: '',
                    alindi: !!u.alindi
                };
            });
            var alinan = ham.filter(function (u) { return u.alindi; }).length;
            return {
                id: o.id,
                ornek: true,
                order_id: o.id,
                banko: o.banko || null,
                kolon: o.kolon || 'Hazırlandı',
                durum: 400,
                toplama_durumu: o.toplama_durumu ||
                    (alinan === ham.length && ham.length ? 'toplandi' : (alinan ? 'toplaniyor' : 'bekliyor')),
                toplam_adet: ham.reduce(function (a, u) { return a + (Number(u.adet) || 0); }, 0),
                poset_sayisi: o.poset != null ? o.poset : null,
                eksik_urun_var: false,
                toplayici: o.toplayici || null,
                kurye: o.kurye || null,
                sepet_zamani: o.olusturma,
                created_at: o.olusturma,
                urunler: (global.JBSiparisSirala && global.JBSiparisSirala.sirala)
                    ? global.JBSiparisSirala.sirala(ham, { sira: durum.bantSirasi })
                    : ham
            };
        });
    }

    /** Örnek siparişin bir alanını yerel kayda yazar. */
    function ornegiGuncelle(siparisId, degistir) {
        var liste = ornekOku();
        var k = liste.filter(function (o) { return o.id === siparisId; })[0];
        if (!k) return;
        degistir(k);
        ornekYaz(liste);
    }

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
        if (u.ad) return u.ad;
        if (bilgi.katalogAdi) return bilgi.katalogAdi;
        if (bilgi.barkodlar.length) return bilgi.barkodlar[0];
        return 'Ürün';
    }

    /** @returns {{barkodlar: string[], katalogAdi: string}} */
    function barkodBul(u) {
        var anahtar = (u.gorsel || '') + '|' + (u.ad || '');
        if (barkodOnbellek.has(anahtar)) return barkodOnbellek.get(anahtar);

        katalogHazirla();
        var urun = null;

        if (gorselDizin && u.gorsel) {
            try {
                urun = global.GetirCdnPaste.findProductByGetirImageUrlFromIndex(gorselDizin, u.gorsel);
            } catch (e) { urun = null; }
        }
        if (!urun && u.ad && katalogDizin) urun = katalogDizin.get(sade(u.ad)) || null;

        var sonuc = {
            barkodlar: (urun && Array.isArray(urun.barcodes))
                ? urun.barcodes.map(function (b) { return b && b.code ? String(b.code).trim() : ''; })
                             .filter(Boolean)
                : [],
            katalogAdi: (urun && urun.name) || ''
        };
        barkodOnbellek.set(anahtar, sonuc);
        return sonuc;
    }

    /* Bant adları panelin kendi kolon adlarıyla aynı; depocu iki ekranda
       aynı kelimeyi görüyor. */
    var BANT_ADI = {
        hazir: 'Hazırlandı',
        hazirlaniyor: 'Hazırlanıyor',
        bitti: 'Kapandı'
    };

    // ==================================================================
    // Veri
    // ==================================================================

    async function siparisleriCek() {
        var o = oturum();
        var d = db();
        if (!o || !o.username || !d) return null;

        var siparisSonuc = await d.from('orders')
            .select('id,order_id,banko,kolon,durum,toplama_durumu,toplam_adet,poset_sayisi,eksik_urun_var,toplayici,kurye,sepet_zamani,created_at')
            .eq('username', o.username)
            .order('created_at', { ascending: false })
            .limit(60);

        if (siparisSonuc.error) throw new Error(siparisSonuc.error.message || 'Siparişler alınamadı');
        var siparisler = siparisSonuc.data || [];
        if (!siparisler.length) return ornekleriKur();

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
                ? global.JBSiparisSirala.sirala(ham, { sira: durum.bantSirasi })
                : ham;
        });

        return ornekleriKur().concat(siparisler);
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
        if (!zorla && imza === durum.sonImza) return;
        durum.sonImza = imza;
        durum.siparisler = yeni;
        // Panelde teslim akışına geçmiş siparişler burada kapanıyor.
        bitenleriKapat(yeni);

        if (durum.secili) {
            var guncel = yeni.filter(function (s) { return s.id === durum.secili.id; })[0];
            durum.secili = guncel || null;
        }
        ciz();
    }

    // ==================================================================
    // Yazma
    // ==================================================================

    async function urunIsaretle(siparis, urun, alindi) {
        /* Örnek sipariş sunucuya yazılmıyor; işaret yerel kayda gidiyor. */
        if (siparis.ornek) {
            urun.alindi = alindi;
            ornegiGuncelle(siparis.id, function (k) {
                var y = (k.urunler || []).filter(function (u) { return u.ad === urun.ad; })[0];
                if (y) y.alindi = alindi;
            });
            satiriTazele(urun);
            durum.detayImzasi = siparis.id + '|' + durum.detayGorunum + '|' +
                (siparis.urunler || []).map(function (u) { return u.sira + (u.alindi ? '1' : '0'); }).join('');
            var hepsi = (siparis.urunler || []).every(function (u) { return u.alindi; });
            siparis.toplama_durumu = hepsi ? 'toplandi'
                : ((siparis.urunler || []).some(function (u) { return u.alindi; }) ? 'toplaniyor' : 'bekliyor');
            ornegiGuncelle(siparis.id, function (k) { k.toplama_durumu = siparis.toplama_durumu; });
            ciz();
            return;
        }

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
        if (siparis.ornek) {
            siparis.toplama_durumu = yeni;
            ornegiGuncelle(siparis.id, function (k) { k.toplama_durumu = yeni; });
            if (!sessiz) ciz(); else ilerlemeyiTazele();
            return;
        }
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
     *   bitti         El Değiştiriliyor, Yolda, Ulaştı, Teslim, iptal.
     *                 Hiçbir şeritte görünmüyor.
     */
    /* Kolon adı sade()'den geçiriliyor. Doğrudan /i ile denemek yetmiyordu:
       "İptal" büyük harfli noktalı İ ile geliyor ve JS onu 'iptal' saymıyor. */
    var KOLON_BITTI = /(el degistir|yolda|ulast|teslim|iptal|tamamlan)/;
    var KOLON_HAZIR = /hazirland/;

    function kolonAdi(s) { return sade(s && s.kolon); }

    /* Panelden düşen sipariş bir daha güncellenmiyor; kaydı bizde kalıyor.
       Üç saati geçmiş bir sipariş panelde kesinlikle yok. */
    var ESKIME_MS = 3 * 60 * 60 * 1000;

    function eskimisMi(s) {
        var t = s.sepet_zamani || s.created_at;
        if (!t) return false;
        var ms = Date.now() - new Date(t).getTime();
        return isFinite(ms) && ms > ESKIME_MS;
    }

    function panelBitirmisMi(s) { return KOLON_BITTI.test(kolonAdi(s)); }

    function panelBandi(s) {
        var k = kolonAdi(s);
        if (KOLON_BITTI.test(k)) return 'bitti';
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

    function bandaGore(s) {
        if (s.toplama_durumu === 'toplandi') return 'bitti';
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

    /* Fırın sarı, dondurma mor, su mavi: varsayılan. Ayarlardan değişirse
       durum.bantRenkleri bunun üstüne geçiyor. "Diğer ürünler" bandının
       belirli bir kategorisi yok, sabit gri kalıyor. */
    var BANT_RENK_VARSAYILAN = { firin: '#d97706', dondurma: '#7c3aed', su: '#0284c7' };
    var BANT_RENK_ETIKET = { firin: 'Fırın', dondurma: 'Dondurma', su: 'Su' };
    var BANT_RENK_SIRA = ['firin', 'dondurma', 'su'];

    function bantRengi(bant) {
        if (!bant || bant === 'orta') return '#98a2b3';
        var ozel = durum.bantRenkleri && durum.bantRenkleri[bant];
        return ozel || BANT_RENK_VARSAYILAN[bant] || '#98a2b3';
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

    function ogeYaz(rol, deger) {
        return '<div class="sip-kart__ogeye"><small>' + rol + '</small><strong>' +
               kacir(deger || 'Atanmadı') + '</strong></div>';
    }

    function kartCiz(s, sira) {
        var urunler = s.urunler || [];
        var toplam = urunler.length;
        var alinan = urunler.filter(function (u) { return u.alindi; }).length;
        var oran = toplam ? Math.round(alinan / toplam * 100) : 0;
        var kimlik = siparisKimligi(s);
        var tam = oran === 100 && toplam > 0;

        var icerik = (s.poset_sayisi != null ? POSET_IKON + s.poset_sayisi + ' poşet · ' : '') + toplam + ' çeşit';

        return '<button type="button" class="sip-kart' + (sira != null ? ' sip-kart--gir' : '') +
               (tam ? ' sip-kart--tam' : '') + (s.ornek ? ' sip-kart--ornek' : '') +
               '" data-siparis="' + kacir(s.id) + '" style="--kart-zemin:' + kartArkaPlan(s) +
               ';--i:' + (sira || 0) + '" aria-label="' + kacir(kimlik.deger) + ' siparişini aç">' +
            '<span class="sip-kart__ust">' +
                (s.ornek ? '<span class="sip-kart__ornek">ÖRNEK</span>' : '') +
                '<span class="sip-kart__sure">' + kacir(gecenSure(s)) + '</span>' +
            '</span>' +
            '<span class="sip-kart__orta">' +
                '<span class="sip-kart__banko' + (kimlik.bankoVar ? '' : ' sip-kart__banko--yok') + '">' +
                    '<small>' + kacir(kimlik.etiket) + '</small>' +
                    '<strong>' + kacir(kimlik.deger) + '</strong>' +
                '</span>' +
                '<span class="sip-kart__parca"><b>' + adetYaz(s.toplam_adet != null ? s.toplam_adet : toplam) + '</b> parça</span>' +
            '</span>' +
            '<span class="sip-kart__ozellik">' +
                ogeYaz('Toplayıcı', s.toplayici) +
                ogeYaz('Kurye', s.kurye) +
                '<div class="sip-kart__ogeye"><small>İçerik</small><strong>' + icerik + '</strong></div>' +
            '</span>' +
            '<span class="sip-kart__alt">' +
                '<span class="sip-kart__ilerleme">' +
                    '<span><i style="width:' + oran + '%"></i></span>' +
                    '<strong>' + alinan + '<span>/' + toplam + '</span></strong>' +
                '</span>' +
                '<span class="sip-kart__ac">' + (tam ? TIK : OK_SAG) + '</span>' +
            '</span>' +
        '</button>';
    }

    // ==================================================================
    // Çizim: ürün satırı / kutucuğu
    // ==================================================================

    /* Satırda tek barkod duruyor: depocu okutacağı kodu aramasın. Fazlası
       varsa ada dokununca açılan pencerede hepsi görünüyor. */
    function kodCiz(bilgi) {
        if (!bilgi.barkodlar.length) return '<span class="sip-kod sip-kod--yok">barkod yok</span>';
        return '<span class="sip-kod">' + kacir(bilgi.barkodlar[0]) +
               (bilgi.barkodlar.length > 1 ? '<b>+' + (bilgi.barkodlar.length - 1) + '</b>' : '') +
               '</span>';
    }

    function urunNotYaz(u) {
        var miktar = adetYaz(u.adet);
        return u.birim ? (miktar + ' ' + u.birim + ' alınacak') : (miktar + ' adet alınacak');
    }

    function urunCiz(u, sira) {
        var bilgi = barkodBul(u);
        var gorsel = u.gorsel
            ? '<button type="button" class="sip-urun__gorsel" data-buyut="' + u.sira + '" aria-label="' +
                  kacir(urunBasligi(u, bilgi)) + ' görselini büyüt">' +
                  '<img src="' + kacir(u.gorsel) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></button>'
            : '<span class="sip-urun__gorsel sip-urun__gorsel--bos"></span>';

        return '<div class="sip-urun' + (u.alindi ? ' sip-urun--alindi' : '') +
               '" data-sira="' + u.sira + '" style="--i:' + Math.min(Math.max((sira || 1) - 1, 0), 16) + '">' +
            '<span class="sip-urun__no">' + (sira || 1) + '</span>' +
            gorsel +
            '<div class="sip-urun__bilgi">' +
                '<button type="button" class="sip-urun__ad" data-barkod="' + u.sira + '">' +
                    '<span>' + kacir(urunBasligi(u, bilgi)) + '</span>' +
                '</button>' +
                '<div class="sip-urun__alt">' +
                    kodCiz(bilgi) +
                    '<span class="sip-urun__not">' + urunNotYaz(u) + '</span>' +
                '</div>' +
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
        var etiketler = (global.JBSiparisSirala && global.JBSiparisSirala.BANT_ETIKET) || {};
        var sayac = 0;
        return bantlariTopla(urunler).map(function (g) {
            var alinan = g.urunler.filter(function (u) { return u.alindi; }).length;
            return '<section class="sip-bolum">' +
                '<div class="sip-bant' + (alinan === g.urunler.length ? ' sip-bant--bitti' : '') +
                '" style="--bant:' + bantRengi(g.bant) + '">' +
                    '<i></i><b>' + kacir(etiketler[g.bant] || 'Ürünler') + '</b><s></s>' +
                    '<span>' + alinan + '/' + g.urunler.length + '</span>' +
                '</div>' +
                g.urunler.map(function (u) { sayac++; return urunCiz(u, sayac); }).join('') +
            '</section>';
        }).join('');
    }

    function yanKisiler(s) {
        var satir = function (ad, rol, kurye, aktif) {
            return '<div class="sip-kisi-satir">' +
                '<span class="sip-avatar' + (kurye ? ' sip-avatar--kurye' : '') +
                    (ad ? '' : ' sip-avatar--bos') + '">' + kacir(basHarfler(ad)) + '</span>' +
                '<div><small>' + rol + '</small><strong>' + kacir(ad || 'Atanmadı') + '</strong></div>' +
                (ad && aktif ? '<span class="sip-kisi-durum"><i></i>Aktif</span>' : '') +
            '</div>';
        };
        return '<p class="sip-yan-etiket">GÖREVLİLER</p>' +
               satir(s.toplayici, 'Toplayıcı', false, true) +
               satir(s.kurye, 'Kurye', true, false);
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
        var alinan = urunler.filter(function (u) { return u.alindi; }).length;
        var toplam = urunler.length;
        var oran = toplam ? Math.round(alinan / toplam * 100) : 0;
        var tam = oran === 100 && toplam > 0;

        var basliklar = el('detayGovde').querySelectorAll('.sip-bant');
        bantlariTopla(urunler).forEach(function (g, i) {
            var b = basliklar[i];
            if (!b) return;
            var a = g.urunler.filter(function (u) { return u.alindi; }).length;
            b.querySelector('span').textContent = a + '/' + g.urunler.length;
            b.classList.toggle('sip-bant--bitti', a === g.urunler.length);
        });

        el('olcuAlindi').textContent = alinan + '/' + toplam;
        el('araclarSayi').textContent = alinan + '/' + toplam;
        el('yanSayac').textContent = alinan + ' / ' + toplam + ' ürün';
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
    function seritCiz(bant, listeId, bosId, imzaAnahtari) {
        var liste = durum.siparisler.filter(function (s) { return bandaGore(s) === bant; });
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
        var hazirlaniyor = seritCiz('hazirlaniyor', 'izgaraHazirlaniyor', 'bosHazirlaniyor', 'hazirlaniyor');
        var hazir = seritCiz('hazir', 'izgaraHazir', 'bosHazir', 'hazir');

        el('sayacHazirlaniyor').textContent = hazirlaniyor.length;
        el('sayacHazir').textContent = hazir.length;

        var hazirParca = hazir.reduce(function (a, s) { return a + (s.toplam_adet || (s.urunler || []).length); }, 0);
        el('ozetHazirParca').textContent = adetYaz(hazirParca);

        var saat = durum.sonYenileme ? saatYaz(durum.sonYenileme) : null;
        el('sonGuncelleme').textContent = 'Canlı · ' + (saat || 'yükleniyor');

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
        if (u.gorsel) { g.src = u.gorsel; gd.hidden = false; }
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
        if (!u || !u.gorsel) return;
        el('buyukGorsel').src = u.gorsel;
        el('buyukAd').textContent = u.ad || '';
        katAc('siparisBuyuk');
    }

    // ---- Ayarlar ----

    function siraCiz() {
        var etiketler = (global.JBSiparisSirala && global.JBSiparisSirala.BANT_ETIKET) || {};
        el('ayarSira').innerHTML = durum.bantSirasi.map(function (k, i) {
            return '<div class="sip-sira__oge">' +
                '<span class="sip-sira__no">' + (i + 1) + '</span>' +
                '<span class="sip-sira__ad">' + kacir(etiketler[k] || k) + '</span>' +
                '<button type="button" data-bant="' + k + '" data-tasi="-1" aria-label="Yukarı"' +
                    (i === 0 ? ' disabled' : '') + '>' +
                    '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg></button>' +
                '<button type="button" data-bant="' + k + '" data-tasi="1" aria-label="Aşağı"' +
                    (i === durum.bantSirasi.length - 1 ? ' disabled' : '') + '>' +
                    '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>' +
            '</div>';
        }).join('');
    }

    /* Fırın/dondurma/su rengi. Hızlı Bul eklentisindeki kategori renk
       satırıyla aynı düzen: yerel renk girdisi, değişince anında
       uygulanıyor. */
    function renklerCiz() {
        el('ayarRenkler').innerHTML = BANT_RENK_SIRA.map(function (b) {
            var renk = bantRengi(b);
            return '<div class="sip-renk-satiri" style="--renk:' + renk + '">' +
                '<i></i>' +
                '<label for="sip-renk-' + b + '">' + BANT_RENK_ETIKET[b] + '</label>' +
                '<input type="color" id="sip-renk-' + b + '" data-bant-renk="' + b + '" value="' + renk + '">' +
            '</div>';
        }).join('');
    }

    function bantRenkleriGuncelle(bant, deger) {
        durum.bantRenkleri = Object.assign({}, durum.bantRenkleri || BANT_RENK_VARSAYILAN);
        durum.bantRenkleri[bant] = deger;
        ayarYaz({ bantRenkleri: durum.bantRenkleri });
        renklerCiz();
        /* Kart zemini ve bant başlıkları yeni renkle yeniden çizilsin. */
        durum.kartImzasi = { hazirlaniyor: '', hazir: '' };
        durum.detayImzasi = '';
        ciz();
    }

    var SIL_IKON = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>';

    function ornekListeCiz() {
        var liste = ornekOku();
        el('ornekListe').innerHTML = liste.map(function (o) {
            var say = (o.urunler || []).length;
            return '<div class="sip-ornek__kayit">' +
                '<strong>' + kacir(o.banko ? 'Banko ' + o.banko : 'Bankosuz') + '</strong>' +
                '<span>' + say + ' çeşit · ' + kacir(o.kolon || 'Hazırlandı') + '</span>' +
                '<button type="button" data-ornek-sil="' + kacir(o.id) + '" aria-label="Sil">' + SIL_IKON + '</button>' +
            '</div>';
        }).join('');
    }

    function ornekEkle() {
        var urunler = ornekUrunAyikla(el('ornekUrunler').value);
        if (!urunler.length) { bildir('Önce en az bir ürün yaz'); return; }

        var kayit = {
            id: 'ornek-' + Date.now().toString(36),
            banko: el('ornekBanko').value.trim(),
            kolon: el('ornekKolon').value,
            poset: el('ornekPoset').value === '' ? null : Number(el('ornekPoset').value),
            toplayici: el('ornekToplayici').value.trim(),
            kurye: el('ornekKurye').value.trim(),
            urunler: urunler,
            toplama_durumu: 'bekliyor',
            olusturma: new Date().toISOString()
        };
        var liste = ornekOku();
        liste.unshift(kayit);
        ornekYaz(liste);
        ornekListeCiz();
        el('ornekUrunler').value = '';
        bildir('Örnek sipariş eklendi');
        tazele(true);
    }

    function ayarAc() {
        siraCiz();
        renklerCiz();
        ornekListeCiz();
        var isaretle = function (ad, deger) {
            var r = document.querySelector('input[name="' + ad + '"][value="' + deger + '"]');
            if (r) r.checked = true;
        };
        isaretle('ayarDetayGorunum', durum.detayGorunum);
        katAc('siparisAyar');
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
    }

    function baglan() {
        /* İki şerit de aynı kapsayıcının altında; tek dinleyici kartı
           bulup açıyor. */
        el('siparisAkis').addEventListener('click', function (e) {
            var kart = e.target.closest('.sip-kart');
            if (kart) siparisAc(kart.getAttribute('data-siparis'));
        });

        el('siparisYenile').addEventListener('click', function () {
            var d = el('siparisYenile');
            d.classList.remove('donuyor');
            void d.offsetWidth;
            d.classList.add('donuyor');
            tazele(true);
        });

        el('detayGeri').addEventListener('click', detayiKapat);

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

        el('siparisAyarAc').addEventListener('click', ayarAc);
        el('ayarKapat').addEventListener('click', function () { katKapat('siparisAyar'); });
        el('siparisAyar').addEventListener('click', function (e) {
            if (e.target === el('siparisAyar')) katKapat('siparisAyar');
        });

        el('siparisAyar').addEventListener('change', function (e) {
            var t = e.target;
            if (t.name === 'ayarDetayGorunum') {
                durum.detayGorunum = t.value;
                ayarYaz({ detayGorunum: t.value });
                ciz();
                bildir('Toplama görünümü güncellendi');
            }
        });

        /* Renk girdisi sürüklenirken anında uygulanıyor; "input" olayı
           "change"den daha erken ve daha sık geliyor. */
        el('ayarRenkler').addEventListener('input', function (e) {
            var t = e.target.closest('[data-bant-renk]');
            if (!t) return;
            bantRenkleriGuncelle(t.getAttribute('data-bant-renk'), t.value);
        });
        el('ayarRenkSifirla').addEventListener('click', function () {
            durum.bantRenkleri = Object.assign({}, BANT_RENK_VARSAYILAN);
            ayarYaz({ bantRenkleri: durum.bantRenkleri });
            renklerCiz();
            durum.kartImzasi = { hazirlaniyor: '', hazir: '' };
            durum.detayImzasi = '';
            ciz();
            bildir('Bant renkleri sıfırlandı');
        });

        el('ornekEkle').addEventListener('click', ornekEkle);
        el('ornekSil').addEventListener('click', function () {
            if (!ornekOku().length) { bildir('Örnek sipariş yok'); return; }
            ornekYaz([]);
            ornekListeCiz();
            if (durum.secili && durum.secili.ornek) detayiKapat();
            bildir('Örnek siparişler silindi');
            tazele(true);
        });
        el('ornekListe').addEventListener('click', function (e) {
            var d = e.target.closest('[data-ornek-sil]');
            if (!d) return;
            var id = d.getAttribute('data-ornek-sil');
            ornekYaz(ornekOku().filter(function (o) { return o.id !== id; }));
            ornekListeCiz();
            if (durum.secili && durum.secili.id === id) detayiKapat();
            tazele(true);
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
            if (!el('siparisBuyuk').hidden) { katKapat('siparisBuyuk'); return; }
            if (!el('siparisKodlar').hidden) { katKapat('siparisKodlar'); return; }
            if (!el('siparisAyar').hidden) { katKapat('siparisAyar'); return; }
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

    /** Ayarlardan gelen renkleri doğrular: yalnız #rrggbb kabul edilir. */
    function bantRenkleriDogrula(ham) {
        if (!ham || typeof ham !== 'object') return null;
        var sonuc = {};
        var buldu = false;
        BANT_RENK_SIRA.forEach(function (b) {
            if (typeof ham[b] === 'string' && /^#[0-9a-f]{6}$/i.test(ham[b])) {
                sonuc[b] = ham[b];
                buldu = true;
            }
        });
        return buldu ? sonuc : null;
    }

    async function basla() {
        var o = oturum();
        if (!o || !o.username) { bolumGoster('siparisGiris'); return; }
        if (!(await hakVarMi())) { bolumGoster('siparisYetkiYok'); return; }

        var ayar = ayarOku();
        if (['liste', 'ikili', 'uclu'].indexOf(ayar.detayGorunum) !== -1) durum.detayGorunum = ayar.detayGorunum;
        var vars = (global.JBSiparisSirala && global.JBSiparisSirala.VARSAYILAN_SIRA) || ['firin', 'dondurma', 'orta', 'su'];
        durum.bantSirasi = Array.isArray(ayar.bantSirasi) && ayar.bantSirasi.length
            ? ayar.bantSirasi.slice()
            : vars.slice();
        durum.bantRenkleri = bantRenkleriDogrula(ayar.bantRenkleri) || Object.assign({}, BANT_RENK_VARSAYILAN);

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
