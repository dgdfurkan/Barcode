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
 * ============================================================================
 */
(function (global) {
    'use strict';

    var YOKLAMA_MS = 8000;
    var durum = {
        siparisler: [],
        secili: null,
        sekme: 'bekliyor',
        gorunum: 'kart',
        detayGorunum: 'liste',
        bantSirasi: null,
        acikBarkodlar: {},
        yukleniyor: true,
        sonImza: '',
        sonYenileme: null
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
     * Siparişin ekranda görünecek başlığı. Banko henüz atanmamış olabiliyor;
     * "Banko yok" yazmak yerine siparişin son dört hanesi gösteriliyor.
     * Depocu o kodu panelde de görüyor, karşılığı var.
     */
    function siparisBasligi(s) {
        if (s.banko) return s.banko;
        var k = String(s.order_id || s.id || '').slice(-4);
        return k ? '#' + k : 'Sipariş';
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

    var DURUM_ADI = {
        bekliyor: 'Bekliyor',
        toplaniyor: 'Toplanıyor',
        toplandi: 'Toplandı'
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

        // Ekranı hemen çevir; ağ beklemesi elde hissedilmesin.
        urun.alindi = alindi;
        ciz();

        var sonuc = await d.from('order_items')
            .update({ alindi: alindi })
            .eq('order_uuid', siparis.id)
            .eq('sira', urun.sira);

        if (sonuc.error) {
            urun.alindi = !alindi;
            ciz();
            if (global.JBDiyalog) global.JBDiyalog.hata('Ürün işaretlenemedi. Bağlantını kontrol et.');
            return;
        }

        var tamami = (siparis.urunler || []).every(function (u) { return u.alindi; });
        var hedef = tamami ? 'toplandi' : (siparis.urunler.some(function (u) { return u.alindi; }) ? 'toplaniyor' : 'bekliyor');
        if (hedef !== siparis.toplama_durumu) await siparisDurumu(siparis, hedef);
    }

    async function siparisDurumu(siparis, yeni, sessiz) {
        var d = db();
        if (!d) {
            if (global.JBDiyalog) global.JBDiyalog.hata('Veri bağlantısı yok, durum kaydedilemez.');
            return;
        }
        var eski = siparis.toplama_durumu;
        siparis.toplama_durumu = yeni;
        if (!sessiz) ciz();

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
     * Panel siparişi teslim akışına geçirdiyse toplama işi bitmiştir.
     * Kolon adı panelin kendi metni; sayı koduna göre tahmin yürütmüyoruz.
     */
    var BITMIS_KOLON = /(el de[ğg]i[şs]tir|yolda|ula[şs]t|teslim)/i;

    function panelBitirmisMi(s) {
        return BITMIS_KOLON.test(String(s.kolon || ''));
    }

    /** Panelde biten siparişleri sunucuda da kapatır. Bir kez yazar. */
    async function bitenleriKapat(liste) {
        var kapatilacak = liste.filter(function (s) {
            return s.toplama_durumu !== 'toplandi' && panelBitirmisMi(s);
        });
        if (!kapatilacak.length) return false;

        for (var i = 0; i < kapatilacak.length; i++) {
            var s = kapatilacak[i];
            s.toplama_durumu = 'toplandi';
            await siparisDurumu(s, 'toplandi', true);
        }
        return true;
    }

    function bandaGore(s) {
        var d = s.toplama_durumu || 'bekliyor';
        return d === 'toplandi' ? 'toplandi' : (d === 'toplaniyor' ? 'toplaniyor' : 'bekliyor');
    }

    function listele() {
        return durum.siparisler.filter(function (s) { return bandaGore(s) === durum.sekme; });
    }

    /** "2 dk.", "1 sa. 20 dk." — depocu kaç dakikadır beklediğini görsün. */
    function gecenSure(s) {
        var t = s.sepet_zamani || s.created_at;
        if (!t) return '';
        var ms = Date.now() - new Date(t).getTime();
        if (!isFinite(ms) || ms < 0) return '';
        var dk = Math.floor(ms / 60000);
        if (dk < 1) return 'az önce';
        if (dk < 60) return dk + ' dk.';
        var sa = Math.floor(dk / 60);
        return sa + ' sa. ' + (dk % 60) + ' dk.';
    }

    function basHarfler(ad) {
        var p = String(ad || '').trim().split(/\s+/).filter(Boolean);
        if (!p.length) return '—';
        if (p.length === 1) return p[0].slice(0, 2).toLocaleUpperCase('tr');
        return (p[0][0] + p[p.length - 1][0]).toLocaleUpperCase('tr');
    }

    /* Kart şeridinin rengi siparişin ağırlıklı kategorisinden geliyor.
       Süs değil: depocu daha karta bakarken fırına mı buzluğa mı gideceğini
       biliyor. */
    var KUME_RENK = { firin: '#f59e0b', dondurma: '#7c5cf0', su: '#0ea5e9' };

    function kategoriRengi(s) {
        var sayim = {};
        (s.urunler || []).forEach(function (u) {
            if (KUME_RENK[u.toplamaKumesi]) sayim[u.toplamaKumesi] = (sayim[u.toplamaKumesi] || 0) + 1;
        });
        var en = null;
        Object.keys(sayim).forEach(function (k) { if (!en || sayim[k] > sayim[en]) en = k; });
        return en ? KUME_RENK[en] : '#cbd5e1';
    }

    function kartCiz(s) {
        var urunler = s.urunler || [];
        var toplam = urunler.length;
        var alinan = urunler.filter(function (u) { return u.alindi; }).length;
        var d = bandaGore(s);
        var kisi = s.kurye || s.toplayici || '';
        var kisiNot = s.kurye ? 'Kurye' : (s.toplayici ? 'Toplayıcı' : 'Atanmadı');
        var ilkler = urunler.slice(0, 3);
        var kalan = toplam - ilkler.length;

        return '<button type="button" class="sip-kart" data-siparis="' + kacir(s.id) +
               '" style="--kategori:' + kategoriRengi(s) + '">' +
            '<div class="sip-kart__ust">' +
                '<span class="sip-banko">' +
                    '<b class="sip-parca">x' + (s.toplam_adet != null ? s.toplam_adet : toplam) + '</b>' +
                    kacir(siparisBasligi(s)) +
                '</span>' +
                '<span class="sip-sure">' + kacir(gecenSure(s)) + '</span>' +
            '</div>' +
            '<div class="sip-kisi">' +
                '<span class="sip-avatar">' + kacir(basHarfler(kisi)) + '</span>' +
                '<span class="sip-kisi__ad">' +
                    '<strong>' + kacir(kisi || 'Kişi atanmadı') + '</strong>' +
                    '<span>' + kacir(kisiNot) +
                        (s.poset_sayisi != null ? '  ·  ' + s.poset_sayisi + ' poşet' : '') +
                    '</span>' +
                '</span>' +
            '</div>' +
            (ilkler.length
                ? '<div class="sip-urunler">' +
                    ilkler.map(function (u) {
                        return '<div class="sip-satir"><span>' + kacir(urunBasligi(u, barkodBul(u))) +
                               '</span><b>x' + adetYaz(u.adet) + '</b></div>';
                    }).join('') +
                    (kalan > 0 ? '<div class="sip-daha">+' + kalan + ' ürün daha</div>' : '') +
                  '</div>'
                : '') +
            '<div class="sip-alt-satir">' +
                '<span class="sip-rozet sip-rozet--' + d + '"><i></i>' + kacir(DURUM_ADI[d]) + '</span>' +
                '<span class="sip-ilerleme-yazi">' + alinan + '/' + toplam + ' alındı</span>' +
            '</div>' +
        '</button>';
    }

    var TIK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>';

    function urunCiz(u) {
        var bilgi = barkodBul(u);
        var baslik = urunBasligi(u, bilgi);
        var acik = !!durum.acikBarkodlar[u.sira];
        /* İlk barkod hep görünüyor; depocu okutacağı kodu aramasın. Birden
           fazlaysa ada dokununca hepsi açılıyor ve yana kaydırılabiliyor. */
        var gosterilecek = acik ? bilgi.barkodlar : bilgi.barkodlar.slice(0, 1);

        var barkodlar = gosterilecek.length
            ? gosterilecek.map(function (b) { return '<span class="sip-barkod">' + kacir(b) + '</span>'; }).join('') +
              (!acik && bilgi.barkodlar.length > 1
                  ? '<span class="sip-barkod sip-barkod--yok">+' + (bilgi.barkodlar.length - 1) + '</span>'
                  : '')
            : '<span class="sip-barkod sip-barkod--yok">Barkod bulunamadı</span>';

        var gorsel = u.gorsel
            ? '<img class="sip-urun__gorsel" src="' + kacir(u.gorsel) + '" alt="" loading="lazy" data-buyut="' + u.sira + '">'
            : '<div class="sip-urun__gorsel"></div>';

        return '<div class="sip-urun' + (u.alindi ? ' sip-urun--alindi' : '') +
               '" data-sira="' + u.sira + '">' +
            gorsel +
            '<div class="sip-urun__orta">' +
                '<button type="button" class="sip-urun__ad-dugme" data-barkod-ac="' + u.sira + '">' +
                    '<span class="sip-urun__ad">' + kacir(baslik) + '</span>' +
                '</button>' +
                '<div class="sip-barkodlar">' + barkodlar + '</div>' +
            '</div>' +
            '<div class="sip-urun__sag" data-isaretle="' + u.sira + '">' +
                '<span class="sip-adet">' + adetYaz(u.adet) + (u.birim ? ' ' + kacir(u.birim) : '') + '</span>' +
                '<span class="sip-kutu">' + TIK + '</span>' +
            '</div>' +
        '</div>';
    }

    /* Bant renkleri kart şeridiyle aynı; depocu aynı rengi iki yerde görüyor. */
    var BANT_RENK = { firin: '#f59e0b', dondurma: '#7c5cf0', su: '#0ea5e9', orta: '#94a3b8' };

    /**
     * Ürünleri bantlara ayırıp her bandın üstüne başlık koyar. Depocu fırını
     * bitirip buzluğa geçtiğini görüyor; tek uzun liste bunu göstermiyordu.
     * Sıra `siparis-sirala` tarafından zaten kurulmuş durumda, burada yalnız
     * ardışık aynı bantlar gruplanıyor.
     */
    function bantlaraAyir(urunler) {
        var etiketler = (global.JBSiparisSirala && global.JBSiparisSirala.BANT_ETIKET) || {};
        var parcalar = [];
        var suanki = null;
        var kume = [];

        function bosalt() {
            if (!kume.length) return;
            var bitti = kume.every(function (u) { return u.alindi; });
            var alinan = kume.filter(function (u) { return u.alindi; }).length;
            parcalar.push(
                '<div class="sip-bant' + (bitti ? ' sip-bant--bitti' : '') +
                '" style="--bant-renk:' + (BANT_RENK[suanki] || BANT_RENK.orta) + '">' +
                    '<span class="sip-bant__nokta"></span>' +
                    '<span class="sip-bant__ad">' + kacir(etiketler[suanki] || 'Ürünler') + '</span>' +
                    '<span class="sip-bant__cizgi"></span>' +
                    '<span class="sip-bant__sayi">' + alinan + '/' + kume.length + '</span>' +
                '</div>' +
                kume.map(urunCiz).join('')
            );
            kume = [];
        }

        urunler.forEach(function (u) {
            var b = u.toplamaBandi || 'orta';
            if (b !== suanki) { bosalt(); suanki = b; }
            kume.push(u);
        });
        bosalt();
        return parcalar.join('');
    }

    /** İlerleme halkası. Çevre 2*pi*r, r = 20. */
    function halkaCiz(alinan, toplam) {
        var halka = el('detayHalka');
        if (!halka) return;
        var cevre = 2 * Math.PI * 20;
        var oran = toplam ? alinan / toplam : 0;
        var dolu = halka.querySelector('.dolu');
        dolu.setAttribute('stroke-dasharray', (cevre * oran).toFixed(1) + ' ' + cevre.toFixed(1));
        halka.classList.toggle('tam', oran === 1 && toplam > 0);
        halka.querySelector('b').textContent = toplam ? Math.round(oran * 100) + '%' : '0%';
    }

    function kunyeCiz(s) {
        var urunler = s.urunler || [];
        var d = bandaGore(s);
        var parcalar = [
            '<span class="sip-kunye__oge sip-kunye__oge--vurgu"><b>' +
                (s.toplam_adet != null ? s.toplam_adet : urunler.length) + '</b> parça</span>'
        ];
        if (s.poset_sayisi != null) {
            parcalar.push('<span class="sip-kunye__oge"><b>' + s.poset_sayisi + '</b> poşet</span>');
        }
        parcalar.push('<span class="sip-kunye__oge"><b>' + urunler.length + '</b> çeşit</span>');
        if (s.kurye) parcalar.push('<span class="sip-kunye__oge">Kurye <span>' + kacir(s.kurye) + '</span></span>');
        if (s.toplayici) parcalar.push('<span class="sip-kunye__oge">Toplayıcı <span>' + kacir(s.toplayici) + '</span></span>');
        parcalar.push('<span class="sip-rozet sip-rozet--' + d + '"><i></i>' + kacir(DURUM_ADI[d]) + '</span>');
        if (s.eksik_urun_var) {
            parcalar.push('<span class="sip-kunye__oge">Eksik ürün var</span>');
        }
        return parcalar.join('');
    }

    function saatYaz(t) {
        if (!t) return '';
        var d = new Date(t);
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function ciz() {
        var izgara = el('siparisIzgara');
        var detay = el('siparisDetay');

        var sayac = { bekliyor: 0, toplaniyor: 0, toplandi: 0 };
        durum.siparisler.forEach(function (s) { sayac[bandaGore(s)]++; });

        el('sayacBekliyor').textContent = sayac.bekliyor;
        el('sayacToplaniyor').textContent = sayac.toplaniyor;
        el('sayacToplandi').textContent = sayac.toplandi;
        el('ozetBekleyen').textContent = sayac.bekliyor;
        el('ozetToplaniyor').textContent = sayac.toplaniyor;
        el('ozetToplandi').textContent = sayac.toplandi;

        var bekleyenParca = durum.siparisler
            .filter(function (s) { return bandaGore(s) === 'bekliyor'; })
            .reduce(function (a, s) { return a + (s.toplam_adet || (s.urunler || []).length); }, 0);
        el('ozetBekleyenNot').textContent = bekleyenParca ? bekleyenParca + ' parça bekliyor' : 'Toplanmayı bekliyor';
        el('sonGuncelleme').textContent = durum.sonYenileme
            ? 'Son güncelleme ' + saatYaz(durum.sonYenileme)
            : 'Yükleniyor';

        document.querySelectorAll('.sip-sekme').forEach(function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-sekme') === durum.sekme));
        });
        /* Yalnız üstteki liste anahtarı. `.sip-gorunum` sınıfı detaydaki
           anahtarda da var; genel seçici ikisini birden yakalıyor ve detay
           düğmeleri liste görünümünü bozuyordu. */
        document.querySelectorAll('.sip-meta .sip-gorunum button').forEach(function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-gorunum') === durum.gorunum));
        });
        izgara.classList.toggle('sip-izgara--liste', durum.gorunum === 'liste');

        var liste = listele();
        if (durum.yukleniyor) {
            izgara.innerHTML = '<div class="sip-iskelet"></div><div class="sip-iskelet"></div><div class="sip-iskelet"></div>';
        } else if (!liste.length) {
            izgara.innerHTML = '<div class="sip-bos">' +
                (durum.sekme === 'bekliyor'
                    ? 'Bekleyen sipariş yok.<br>Depo panelinde yeni sipariş düştüğünde burada görünür.'
                    : durum.sekme === 'toplaniyor'
                        ? 'Şu an toplanan sipariş yok.'
                        : 'Henüz tamamlanan sipariş yok.') +
                '</div>';
        } else {
            izgara.innerHTML = liste.map(kartCiz).join('');
        }

        if (!durum.secili) { detay.hidden = true; return; }

        var s = durum.secili;
        var urunler = s.urunler || [];
        var alinan = urunler.filter(function (u) { return u.alindi; }).length;

        el('detayBanko').textContent = siparisBasligi(s);
        el('detayAlt').textContent = gecenSure(s) ? gecenSure(s) + ' önce düştü' : '';
        el('detayKunye').innerHTML = kunyeCiz(s);

        var govde = el('detayGovde');
        govde.className = 'sip-detay__govde sip-detay__govde--' + durum.detayGorunum;
        govde.innerHTML = urunler.length
            ? bantlaraAyir(urunler)
            : '<div class="sip-bos">Bu siparişin ürünleri henüz gelmedi.</div>';
        document.querySelectorAll('#detayGorunum button').forEach(function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-detay-gorunum') === durum.detayGorunum));
        });
        el('detaySayac').innerHTML = '<b>' + alinan + '</b> / ' + urunler.length + ' ürün alındı';

        var oran = urunler.length ? alinan / urunler.length : 0;
        var cubuk = el('detayCubuk');
        cubuk.classList.toggle('tam', oran === 1 && urunler.length > 0);
        cubuk.firstElementChild.style.width = Math.round(oran * 100) + '%';
        halkaCiz(alinan, urunler.length);

        var bitir = el('detayBitir');
        bitir.textContent = s.toplama_durumu === 'toplandi' ? 'Geri al' : 'Toplandı';
        bitir.classList.toggle('sip-bitir--tam', oran === 1 && s.toplama_durumu !== 'toplandi');
        bitir.disabled = !urunler.length;
        detay.hidden = false;
    }

    // ==================================================================
    // Olaylar
    // ==================================================================

    function baglan() {
        document.querySelectorAll('.sip-sekme').forEach(function (b) {
            b.addEventListener('click', function () {
                durum.sekme = b.getAttribute('data-sekme');
                ciz();
            });
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
            d.classList.add('donuyor');
            setTimeout(function () { d.classList.remove('donuyor'); }, 600);
            tazele(true);
        });

        el('siparisIzgara').addEventListener('click', function (e) {
            var kart = e.target.closest('.sip-kart');
            if (!kart) return;
            var id = kart.getAttribute('data-siparis');
            durum.secili = durum.siparisler.filter(function (s) { return s.id === id; })[0] || null;
            ciz();
        });

        el('detayGeri').addEventListener('click', function () {
            durum.secili = null;
            ciz();
        });

        el('detayGovde').addEventListener('click', function (e) {
            if (!durum.secili) return;

            // Görsele dokunuş: büyük fotoğraf
            var img = e.target.closest('[data-buyut]');
            if (img) {
                var s1 = Number(img.getAttribute('data-buyut'));
                var u1 = (durum.secili.urunler || []).filter(function (x) { return x.sira === s1; })[0];
                if (u1) gorseliBuyut(u1);
                return;
            }

            // Ada dokunuş: barkodları aç/kapat
            var ad = e.target.closest('[data-barkod-ac]');
            if (ad) {
                var s2 = Number(ad.getAttribute('data-barkod-ac'));
                durum.acikBarkodlar[s2] = !durum.acikBarkodlar[s2];
                ciz();
                return;
            }

            /* İşaretleme yalnız sağdaki adet ve kutu alanından. Barkodu
               okumak için ada dokunan depocu ürünü yanlışlıkla alınmış
               işaretlemesin. */
            var sag = e.target.closest('[data-isaretle]');
            if (!sag) return;
            var s3 = Number(sag.getAttribute('data-isaretle'));
            var u3 = (durum.secili.urunler || []).filter(function (x) { return x.sira === s3; })[0];
            if (u3) urunIsaretle(durum.secili, u3, !u3.alindi);
        });

        document.querySelectorAll('#detayGorunum button').forEach(function (b) {
            b.addEventListener('click', function () {
                durum.detayGorunum = b.getAttribute('data-detay-gorunum');
                ayarYaz({ detayGorunum: durum.detayGorunum });
                ciz();
            });
        });

        el('buyukKapat').addEventListener('click', gorseliKapat);
        el('siparisBuyuk').addEventListener('click', function (e) {
            if (e.target === el('siparisBuyuk')) gorseliKapat();
        });

        el('siparisAyarAc').addEventListener('click', ayarAc);
        el('ayarKapat').addEventListener('click', ayarKapat);
        el('siparisAyar').addEventListener('click', function (e) {
            if (e.target === el('siparisAyar')) ayarKapat();
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
            tazele(true);
        });

        el('detayBitir').addEventListener('click', function () {
            var s = durum.secili;
            if (!s) return;
            siparisDurumu(s, s.toplama_durumu === 'toplandi' ? 'bekliyor' : 'toplandi');
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            // Üstteki katman önce kapanmalı; Esc bir seferde ikisini kapatmasın.
            if (!el('siparisBuyuk').hidden) { gorseliKapat(); return; }
            if (!el('siparisAyar').hidden) { ayarKapat(); return; }
            if (durum.secili) { durum.secili = null; ciz(); }
        });

        /* Sekme öne gelince hemen bir kez tazele; depocu telefonu cebinden
           çıkardığında eski listeye bakmasın. */
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') tazele(false);
        });
    }

    // ==================================================================
    // Görsel büyütme
    // ==================================================================

    function gorseliBuyut(u) {
        if (!u.gorsel) return;
        el('buyukGorsel').src = u.gorsel;
        el('buyukAd').textContent = u.ad || '';
        el('siparisBuyuk').hidden = false;
    }

    function gorseliKapat() {
        el('siparisBuyuk').hidden = true;
        el('buyukGorsel').removeAttribute('src');
    }

    // ==================================================================
    // Ayarlar
    // ==================================================================

    function siraCiz() {
        var etiketler = (global.JBSiparisSirala && global.JBSiparisSirala.BANT_ETIKET) || {};
        el('ayarSira').innerHTML = durum.bantSirasi.map(function (k, i) {
            return '<div class="sip-sira-oge">' +
                '<span class="sip-sira-oge__no">' + (i + 1) + '</span>' +
                '<span class="sip-sira-oge__ad">' + kacir(etiketler[k] || k) + '</span>' +
                '<button type="button" data-bant="' + k + '" data-tasi="-1" aria-label="Yukarı"' +
                    (i === 0 ? ' disabled' : '') + '>' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>' +
                '</button>' +
                '<button type="button" data-bant="' + k + '" data-tasi="1" aria-label="Aşağı"' +
                    (i === durum.bantSirasi.length - 1 ? ' disabled' : '') + '>' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>' +
                '</button>' +
            '</div>';
        }).join('');
    }

    function ayarAc() {
        siraCiz();
        el('siparisAyar').hidden = false;
    }

    function ayarKapat() {
        el('siparisAyar').hidden = true;
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

    /* Üç bölümden yalnız biri açık kalmalı. Tek tek açıp kapatınca ikisi
       birden görünebiliyordu. */
    function bolumGoster(id) {
        ['siparisGiris', 'siparisYetkiYok', 'siparisIcerik'].forEach(function (x) {
            var e = el(x);
            if (e) e.hidden = (x !== id);
        });
    }

    async function basla() {
        var o = oturum();
        if (!o || !o.username) {
            bolumGoster('siparisGiris');
            return;
        }
        if (!(await hakVarMi())) {
            bolumGoster('siparisYetkiYok');
            return;
        }
        var ayar = ayarOku();
        if (ayar.gorunum === 'kart' || ayar.gorunum === 'liste') durum.gorunum = ayar.gorunum;
        if (['liste', 'ikili', 'kart'].indexOf(ayar.detayGorunum) !== -1) durum.detayGorunum = ayar.detayGorunum;
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
