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
        sekme: 'aktif',
        yukleniyor: true,
        sonImza: ''
    };
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
                ? global.JBSiparisSirala.sirala(ham)
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
        if (!zorla && imza === durum.sonImza) return;
        durum.sonImza = imza;
        durum.siparisler = yeni;

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

    async function siparisDurumu(siparis, yeni) {
        var d = db();
        if (!d) {
            if (global.JBDiyalog) global.JBDiyalog.hata('Veri bağlantısı yok, durum kaydedilemez.');
            return;
        }
        var eski = siparis.toplama_durumu;
        siparis.toplama_durumu = yeni;
        ciz();

        var sonuc = await d.from('orders')
            .update({ toplama_durumu: yeni, updated_at: new Date().toISOString() })
            .eq('id', siparis.id);

        if (sonuc.error) {
            siparis.toplama_durumu = eski;
            ciz();
            if (global.JBDiyalog) global.JBDiyalog.hata('Sipariş durumu kaydedilemedi.');
        }
    }

    // ==================================================================
    // Çizim
    // ==================================================================

    function aktifMi(s) { return s.toplama_durumu !== 'toplandi'; }

    function listele() {
        return durum.siparisler.filter(function (s) {
            return durum.sekme === 'aktif' ? aktifMi(s) : !aktifMi(s);
        });
    }

    function kartCiz(s) {
        var toplam = (s.urunler || []).length;
        var alinan = (s.urunler || []).filter(function (u) { return u.alindi; }).length;
        var yuzde = toplam ? Math.round((alinan / toplam) * 100) : 0;
        var d = s.toplama_durumu || 'bekliyor';

        return '<button type="button" class="sip-kart' + (yuzde === 100 ? ' sip-kart--tam' : '') +
               '" data-siparis="' + kacir(s.id) + '">' +
            '<div class="sip-kart__ust">' +
                '<span class="sip-banko">' + kacir(s.banko || 'Banko yok') + '</span>' +
                '<span class="sip-rozet sip-rozet--' + d + '">' + kacir(DURUM_ADI[d] || d) + '</span>' +
            '</div>' +
            '<div class="sip-kart__olculer">' +
                '<span class="sip-olcu"><b>' + (s.toplam_adet != null ? s.toplam_adet : toplam) + '</b> parça</span>' +
                (s.poset_sayisi != null ? '<span class="sip-olcu"><b>' + s.poset_sayisi + '</b> poşet</span>' : '') +
                '<span class="sip-olcu"><b>' + alinan + '/' + toplam + '</b> alındı</span>' +
            '</div>' +
            (s.kurye || s.toplayici
                ? '<div class="sip-kart__kisi">' +
                    (s.kurye ? 'Kurye: ' + kacir(s.kurye) : '') +
                    (s.kurye && s.toplayici ? '  ·  ' : '') +
                    (s.toplayici ? 'Toplayıcı: ' + kacir(s.toplayici) : '') +
                  '</div>'
                : '') +
            '<div class="sip-ilerleme"><span style="width:' + yuzde + '%"></span></div>' +
        '</button>';
    }

    var TIK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>';
    var GERI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>';

    function urunCiz(u) {
        var gorsel = u.gorsel
            ? '<img class="sip-urun__gorsel" src="' + kacir(u.gorsel) + '" alt="" loading="lazy">'
            : '<div class="sip-urun__gorsel"></div>';
        return '<button type="button" class="sip-urun' + (u.alindi ? ' sip-urun--alindi' : '') +
               '" data-sira="' + u.sira + '">' +
            gorsel +
            '<div class="sip-urun__orta">' +
                '<span class="sip-urun__ad">' + kacir(u.ad || 'Adı gelmedi') + '</span>' +
                /* Etiket yalnız anlamlıysa yazılıyor. Ürün adının ilk sözünden
                   türetilen küme ("lay", "ruffles") kümelemeye yarıyor ama
                   ekranda depocuya bir şey anlatmıyor. */
                (u.toplamaKumesi && u.toplamaKumeKaynagi !== 'ad'
                    ? '<span class="sip-urun__kume">' + kacir(u.toplamaKumesi) + '</span>' : '') +
            '</div>' +
            '<div class="sip-urun__sag">' +
                '<span class="sip-adet">' + adetYaz(u.adet) + (u.birim ? ' ' + kacir(u.birim) : '') + '</span>' +
                '<span class="sip-kutu">' + TIK + '</span>' +
            '</div>' +
        '</button>';
    }

    function ciz() {
        var liste = listele();
        var izgara = el('siparisIzgara');
        var detay = el('siparisDetay');

        // Sekme sayaçları
        var aktifSayi = durum.siparisler.filter(aktifMi).length;
        var bitenSayi = durum.siparisler.length - aktifSayi;
        el('sayacAktif').textContent = aktifSayi;
        el('sayacBiten').textContent = bitenSayi;
        el('sekmeAktif').setAttribute('aria-selected', String(durum.sekme === 'aktif'));
        el('sekmeBiten').setAttribute('aria-selected', String(durum.sekme !== 'aktif'));

        if (durum.yukleniyor) {
            izgara.innerHTML = '<div class="sip-iskelet"></div><div class="sip-iskelet"></div><div class="sip-iskelet"></div>';
        } else if (!liste.length) {
            izgara.innerHTML = '<div class="sip-bos">' +
                (durum.sekme === 'aktif'
                    ? 'Bekleyen sipariş yok.<br>Depo panelinde yeni sipariş düştüğünde burada görünür.'
                    : 'Henüz tamamlanan sipariş yok.') +
                '</div>';
        } else {
            izgara.innerHTML = liste.map(kartCiz).join('');
        }

        // Detay
        if (!durum.secili) {
            detay.hidden = true;
            return;
        }
        var s = durum.secili;
        var urunler = s.urunler || [];
        var alinan = urunler.filter(function (u) { return u.alindi; }).length;

        el('detayBanko').textContent = s.banko || 'Banko yok';
        el('detayAlt').textContent =
            (s.toplam_adet != null ? s.toplam_adet + ' parça' : urunler.length + ' ürün') +
            (s.poset_sayisi != null ? '  ·  ' + s.poset_sayisi + ' poşet' : '') +
            (s.kurye ? '  ·  ' + s.kurye : '');
        el('detayGovde').innerHTML = urunler.length
            ? urunler.map(urunCiz).join('')
            : '<div class="sip-bos">Bu siparişin ürünleri henüz gelmedi.</div>';
        el('detaySayac').innerHTML = '<b>' + alinan + '</b> / ' + urunler.length + ' alındı';

        var bitir = el('detayBitir');
        bitir.textContent = s.toplama_durumu === 'toplandi' ? 'Geri al' : 'Toplandı';
        bitir.disabled = !urunler.length;
        detay.hidden = false;
    }

    // ==================================================================
    // Olaylar
    // ==================================================================

    function baglan() {
        el('sekmeAktif').addEventListener('click', function () {
            durum.sekme = 'aktif'; ciz();
        });
        el('sekmeBiten').addEventListener('click', function () {
            durum.sekme = 'biten'; ciz();
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
            var satir = e.target.closest('.sip-urun');
            if (!satir || !durum.secili) return;
            var sira = Number(satir.getAttribute('data-sira'));
            var u = (durum.secili.urunler || []).filter(function (x) { return x.sira === sira; })[0];
            if (!u) return;
            urunIsaretle(durum.secili, u, !u.alindi);
        });

        el('detayBitir').addEventListener('click', function () {
            var s = durum.secili;
            if (!s) return;
            siparisDurumu(s, s.toplama_durumu === 'toplandi' ? 'bekliyor' : 'toplandi');
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && durum.secili) { durum.secili = null; ciz(); }
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

    function basla() {
        var o = oturum();
        if (!o || !o.username) {
            el('siparisIcerik').hidden = true;
            el('siparisGiris').hidden = false;
            return;
        }
        el('siparisGiris').hidden = true;
        el('siparisIcerik').hidden = false;
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
