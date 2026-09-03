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
        yukleniyor: true,
        sonImza: '',
        sonYenileme: null
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
        durum.sonYenileme = Date.now();
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
                    kacir(s.banko || 'Banko yok') +
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
                        return '<div class="sip-satir"><span>' + kacir(u.ad || 'Adı gelmedi') +
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
        document.querySelectorAll('.sip-gorunum button').forEach(function (b) {
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
        document.querySelectorAll('.sip-sekme').forEach(function (b) {
            b.addEventListener('click', function () {
                durum.sekme = b.getAttribute('data-sekme');
                ciz();
            });
        });

        document.querySelectorAll('.sip-gorunum button').forEach(function (b) {
            b.addEventListener('click', function () {
                durum.gorunum = b.getAttribute('data-gorunum');
                try { localStorage.setItem('jb_siparis_gorunum', durum.gorunum); } catch (e) {}
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
        try {
            var g = localStorage.getItem('jb_siparis_gorunum');
            if (g === 'kart' || g === 'liste') durum.gorunum = g;
        } catch (e) { /* sessiz */ }
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
