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
 * özet şeridi, sipariş kartı, iki sütunlu detay, sabit alt çubuk, barkod ve
 * ayar pencereleri, bildirim.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var YOKLAMA_MS = 8000;
    var durum = {
        siparisler: [],
        secili: null,
        sekme: 'hazir',
        gorunum: 'kart',
        detayGorunum: 'liste',
        bantSirasi: null,
        kodUrun: null,
        yukleniyor: true,
        sonImza: '',
        sonYenileme: null,
        /* Giriş animasyonu yalnız içerik gerçekten değiştiğinde oynuyor.
           Her yoklamada yeniden oynasa ekran titrerdi. */
        kartImzasi: '',
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
            .replace(/[\u0300-\u036f]/g, '')
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
                ? global.JBSiparisSirala.sirala(ham, { sira: durum.bantSirasi })
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
        satiriTazele(urun, true);
        durum.detayImzasi = siparis.id + '|' + durum.detayGorunum + '|' +
            (siparis.urunler || []).map(function (u) { return u.sira + (u.alindi ? '1' : '0'); }).join('');

        var sonuc = await d.from('order_items')
            .update({ alindi: alindi })
            .eq('order_uuid', siparis.id)
            .eq('sira', urun.sira);

        if (sonuc.error) {
            urun.alindi = !alindi;
            satiriTazele(urun, false);
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
    // Çizim
    // ==================================================================

    /*
     * Panelin kolon adına göre bant. Kolon adı panelin kendi metni; sayı
     * koduna göre tahmin yürütmüyoruz.
     *
     *   hazir         Hazırlandı. Depocunun asıl işi bu, varsayılan sekme.
     *   hazirlaniyor  Toplayıcı Bekliyor, Doğrulanıyor, Hazırlanıyor.
     *   bitti         El Değiştiriliyor, Yolda, Ulaştı, Teslim, iptal.
     *                 Listede hiç görünmüyor.
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

    function listele() {
        return durum.siparisler.filter(function (s) { return bandaGore(s) === durum.sekme; });
    }

    var BANT_ADI = { hazir: 'Hazırlandı', hazirlaniyor: 'Hazırlanıyor', bitti: 'Kapandı' };

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

    /* Bant renkleri: kartın sol şeridi, kart etiketleri ve bant başlıkları
       aynı rengi kullanıyor. Süs değil; depocu rengi tanıyor. */
    var BANT_RENK = { firin: '#f59e0b', dondurma: '#7c3aed', su: '#0284c7', orta: '#98a2b3' };

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

    function kategoriRengi(s) {
        var d = bantDagilimi(s).filter(function (x) { return x.bant !== 'orta'; })[0];
        return d ? BANT_RENK[d.bant] : '#c7d0dd';
    }

    var TIK = '<svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-9"/></svg>';

    function kisiCiz(ad, rol, kurye) {
        if (!ad) {
            return '<span class="sip-kisi"><i>–</i><span><small>' + rol +
                   '</small><strong>Atanmadı</strong></span></span>';
        }
        return '<span class="sip-kisi' + (kurye ? ' sip-kisi--kurye' : '') + '">' +
            '<i>' + kacir(basHarfler(ad)) + '</i>' +
            '<span><small>' + rol + '</small><strong>' + kacir(ad) + '</strong></span>' +
        '</span>';
    }

    function kartCiz(s, sira) {
        var urunler = s.urunler || [];
        var toplam = urunler.length;
        var alinan = urunler.filter(function (u) { return u.alindi; }).length;
        var oran = toplam ? Math.round(alinan / toplam * 100) : 0;
        var kimlik = siparisKimligi(s);
        var etiketler = (global.JBSiparisSirala && global.JBSiparisSirala.BANT_ETIKET) || {};

        var meta = bantDagilimi(s).slice(0, 3).map(function (d) {
            return '<span><i style="background:' + (BANT_RENK[d.bant] || BANT_RENK.orta) + '"></i>' +
                   kacir(etiketler[d.bant] || 'Ürün') + ' ' + d.sayi + '</span>';
        }).join('');

        return '<button type="button" class="sip-kart' + (sira != null ? ' sip-kart--gir' : '') +
               (oran === 100 ? ' sip-kart--tam' : '') +
               '" data-siparis="' + kacir(s.id) + '" style="--vurgu:' + kategoriRengi(s) +
               ';--i:' + (sira || 0) + '">' +
            '<div class="sip-kart__ust">' +
                '<div class="sip-kart__kimlik">' +
                    '<span class="sip-banko' + (kimlik.bankoVar ? '' : ' sip-banko--yok') + '">' +
                        '<strong>' + kacir(kimlik.deger) + '</strong>' +
                        '<small>' + kacir(kimlik.etiket) + '</small>' +
                    '</span>' +
                    '<span class="sip-kart__ozet">' +
                        '<strong>' + (s.toplam_adet != null ? s.toplam_adet : toplam) + ' parça</strong>' +
                        '<span>' + toplam + ' çeşit' +
                            (s.poset_sayisi != null ? ' · ' + s.poset_sayisi + ' poşet' : '') + '</span>' +
                    '</span>' +
                '</div>' +
                '<span class="sip-kart__sure">' + kacir(gecenSure(s)) + '</span>' +
            '</div>' +
            '<div class="sip-kart__kisiler">' +
                kisiCiz(s.toplayici, 'Toplayıcı', false) +
                kisiCiz(s.kurye, 'Kurye', true) +
            '</div>' +
            '<div class="sip-kart__alt">' +
                '<div class="sip-kart__meta">' + meta + '</div>' +
                '<div class="sip-kart__ilerleme">' +
                    '<strong>' + alinan + '<span>/' + toplam + '</span></strong>' +
                    '<span><i style="width:' + oran + '%"></i></span>' +
                '</div>' +
            '</div>' +
        '</button>';
    }

    /* Satırda tek barkod duruyor: depocu okutacağı kodu aramasın. Fazlası
       varsa ada dokununca açılan pencerede hepsi görünüyor. */
    function kodCiz(bilgi) {
        if (!bilgi.barkodlar.length) return '<span class="sip-kod sip-kod--yok">barkod yok</span>';
        return '<span class="sip-kod">' + kacir(bilgi.barkodlar[0]) +
               (bilgi.barkodlar.length > 1 ? '<b>+' + (bilgi.barkodlar.length - 1) + '</b>' : '') +
               '</span>';
    }

    function urunCiz(u, sira) {
        var bilgi = barkodBul(u);
        var gorsel = u.gorsel
            ? '<span class="sip-urun__gorsel" data-buyut="' + u.sira + '">' +
                  '<img src="' + kacir(u.gorsel) + '" alt="" loading="lazy"></span>'
            : '<span class="sip-urun__gorsel sip-urun__gorsel--bos"></span>';

        return '<div class="sip-urun' + (u.alindi ? ' sip-urun--alindi' : '') +
               '" data-sira="' + u.sira + '" style="--i:' + (sira || 0) + '">' +
            gorsel +
            '<div class="sip-urun__bilgi">' +
                '<button type="button" class="sip-urun__ad" data-barkod="' + u.sira + '">' +
                    kacir(urunBasligi(u, bilgi)) +
                '</button>' +
                kodCiz(bilgi) +
            '</div>' +
            '<div class="sip-urun__eylem">' +
                '<span class="sip-adet">' + adetYaz(u.adet) +
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
     * Ürünleri bantlara ayırıp her bandın üstüne başlık koyar. Her bant kendi
     * bölümünde: yapışkan başlıklar aynı kapsayıcıda olsaydı geçilen bantların
     * başlıkları tepede üst üste yığılırdı.
     */
    function bantlaraAyir(urunler) {
        var etiketler = (global.JBSiparisSirala && global.JBSiparisSirala.BANT_ETIKET) || {};
        var sayac = 0;
        return bantlariTopla(urunler).map(function (g) {
            var alinan = g.urunler.filter(function (u) { return u.alindi; }).length;
            return '<section class="sip-bolum">' +
                '<div class="sip-bant' + (alinan === g.urunler.length ? ' sip-bant--bitti' : '') +
                '" style="--bant:' + (BANT_RENK[g.bant] || BANT_RENK.orta) + '">' +
                    '<i></i><b>' + kacir(etiketler[g.bant] || 'Ürünler') + '</b><s></s>' +
                    '<span>' + alinan + '/' + g.urunler.length + '</span>' +
                '</div>' +
                g.urunler.map(function (u) { return urunCiz(u, Math.min(sayac++, 16)); }).join('') +
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

    function bosCiz(sekme) {
        var b = sekme === 'hazir'
            ? ['Bankoda bekleyen sipariş yok', 'Panelde bir sipariş hazırlandığında burada belirir.']
            : ['Arkada hazırlanan sipariş yok', 'Toplayıcı bekleyen siparişler bu sekmede görünür.'];
        return '<div class="sip-bos"><span>' + BOS_IKON + '</span><strong>' + b[0] + '</strong><p>' + b[1] + '</p></div>';
    }

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

    function ciz() {
        var izgara = el('siparisIzgara');

        var sayac = { hazir: 0, hazirlaniyor: 0, bitti: 0 };
        durum.siparisler.forEach(function (s) { sayac[bandaGore(s)]++; });

        el('sayacHazir').textContent = sayac.hazir;
        el('sayacHazirlaniyor').textContent = sayac.hazirlaniyor;
        el('ozetHazir').textContent = sayac.hazir;
        el('ozetHazirlaniyor').textContent = sayac.hazirlaniyor;
        el('ozetBitti').textContent = sayac.bitti;

        var hazirParca = durum.siparisler
            .filter(function (s) { return bandaGore(s) === 'hazir'; })
            .reduce(function (a, s) { return a + (s.toplam_adet || (s.urunler || []).length); }, 0);
        el('ozetHazirNot').innerHTML = hazirParca
            ? '<b>' + hazirParca + '</b> parça bankoda'
            : 'Bankoda seni bekliyor';

        var saat = durum.sonYenileme ? saatYaz(durum.sonYenileme) : '—';
        el('ozetSaat').textContent = saat;
        el('sonGuncelleme').textContent = durum.sonYenileme ? 'Son güncelleme ' + saat : 'Yükleniyor';

        document.querySelectorAll('.sip-sekme').forEach(function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-sekme') === durum.sekme));
        });
        document.querySelectorAll('.sip-ozet__oge[data-sekme]').forEach(function (b) {
            b.classList.toggle('secili', b.getAttribute('data-sekme') === durum.sekme);
        });
        document.querySelectorAll('.sip-meta .sip-gorunum button').forEach(function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-gorunum') === durum.gorunum));
        });
        izgara.classList.toggle('sip-izgara--liste', durum.gorunum === 'liste');

        var liste = listele();
        /* Kartlar yalnız liste gerçekten değiştiğinde sıralı beliriyor; her
           yoklamada oynasa ekran titrerdi. */
        var kartImza = durum.yukleniyor ? 'y' : durum.gorunum + '|' + liste.map(function (s) { return s.id; }).join(',');
        var kartYeni = kartImza !== durum.kartImzasi;
        durum.kartImzasi = kartImza;

        if (durum.yukleniyor) {
            izgara.innerHTML = '<div class="sip-iskelet"></div><div class="sip-iskelet"></div><div class="sip-iskelet"></div>';
        } else if (!liste.length) {
            izgara.innerHTML = bosCiz(durum.sekme);
        } else {
            izgara.innerHTML = liste.map(function (s, i) {
                return kartCiz(s, kartYeni ? Math.min(i, 12) : null);
            }).join('');
        }

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

        el('olcuParca').textContent = s.toplam_adet != null ? s.toplam_adet : urunler.length;
        el('olcuCesit').textContent = urunler.length;
        el('olcuPoset').textContent = s.poset_sayisi != null ? s.poset_sayisi : '–';
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

    /** Barkod penceresi. Ana kod büyük, diğerleri altında rozet olarak. */
    function kodlariAc(u) {
        var bilgi = barkodBul(u);
        var g = el('kodGorsel');
        if (u.gorsel) { g.src = u.gorsel; g.hidden = false; }
        else { g.removeAttribute('src'); g.hidden = true; }

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
        if (!u.gorsel) return;
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

    function ayarAc() {
        siraCiz();
        var isaretle = function (ad, deger) {
            var r = document.querySelector('input[name="' + ad + '"][value="' + deger + '"]');
            if (r) r.checked = true;
        };
        isaretle('ayarGorunum', durum.gorunum);
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
        durum.secili = durum.siparisler.filter(function (s) { return s.id === id; })[0] || null;
        durum.detayImzasi = '';
        ciz();
    }

    function sekmeSec(ad) {
        if (!ad || ad === durum.sekme) return;
        durum.sekme = ad;
        ciz();
    }

    function baglan() {
        document.querySelectorAll('[data-sekme]').forEach(function (b) {
            b.addEventListener('click', function () { sekmeSec(b.getAttribute('data-sekme')); });
        });

        document.querySelectorAll('.sip-meta .sip-gorunum button').forEach(function (b) {
            b.addEventListener('click', function () {
                durum.gorunum = b.getAttribute('data-gorunum');
                ayarYaz({ gorunum: durum.gorunum });
                ciz();
            });
        });

        el('siparisYenile').addEventListener('click', function () {
            var d = el('siparisYenile');
            d.classList.remove('donuyor');
            void d.offsetWidth;
            d.classList.add('donuyor');
            tazele(true);
        });

        el('siparisIzgara').addEventListener('click', function (e) {
            var kart = e.target.closest('.sip-kart');
            if (kart) siparisAc(kart.getAttribute('data-siparis'));
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
            if (t.name === 'ayarGorunum') {
                durum.gorunum = t.value;
                ayarYaz({ gorunum: t.value });
                durum.kartImzasi = '';
                ciz();
                bildir('Liste görünümü güncellendi');
            }
            if (t.name === 'ayarDetayGorunum') {
                durum.detayGorunum = t.value;
                ayarYaz({ detayGorunum: t.value });
                ciz();
                bildir('Toplama görünümü güncellendi');
            }
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

    async function basla() {
        var o = oturum();
        if (!o || !o.username) { bolumGoster('siparisGiris'); return; }
        if (!(await hakVarMi())) { bolumGoster('siparisYetkiYok'); return; }

        var ayar = ayarOku();
        if (ayar.gorunum === 'kart' || ayar.gorunum === 'liste') durum.gorunum = ayar.gorunum;
        if (['liste', 'izgara'].indexOf(ayar.detayGorunum) !== -1) durum.detayGorunum = ayar.detayGorunum;
        var vars = (global.JBSiparisSirala && global.JBSiparisSirala.VARSAYILAN_SIRA) || ['firin', 'dondurma', 'orta', 'su'];
        durum.bantSirasi = Array.isArray(ayar.bantSirasi) && ayar.bantSirasi.length
            ? ayar.bantSirasi.slice()
            : vars.slice();

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
