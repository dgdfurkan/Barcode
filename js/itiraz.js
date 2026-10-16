/**
 * İtiraz Yazıcı (/itiraz/)
 * ============================================================================
 *
 * VERİ
 *   Franchise panelinin kendi istekleri, panelin kendi gövdesiyle (js/franchise-oturum.js):
 *     POST /dds100/logs/filter      son 30 gün, 50'şer, en fazla 4 sayfa
 *     POST /dds100/objection-right  kalan itiraz hakkı
 *     GET  /dds-reasons             itiraz sebepleri (günde bir, tarayıcıda saklanır)
 *   Sayfa açılışında bir kez; liste 2 dk tarayıcıda tutulur, "Yenile" en az 20 sn arayla.
 *
 * SUNUCU (vps-api/itiraz)
 *   Kayıtlar sunucuya bırakılır (sonuçlananlar yapay zekânın örnek hafızası),
 *   taslak orada Gemini ile yazılır. Anahtar tarayıcıya hiç dönmez.
 *
 * PANEL
 *   "Panelde Doldur" taslağı Jet Barkod Asistan'a verir; Asistan kaydı açar,
 *   formu doldurur. Kaydet'e kullanıcı basar.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var HAK = 'itirazYazici';
    var GUN = 30;
    var SAYFA = 50;
    var EN_COK_SAYFA = 4;
    var ONBELLEK = 'jbItirazListe';
    var ONBELLEK_MS = 2 * 60 * 1000;
    var SEBEP_ANAHTAR = 'jbItirazSebepler';
    var YENILE_ARA_MS = 20 * 1000;

    /* Panelin formunda görülen sebepler; /dds-reasons okunamazsa bunlar kullanılır */
    var YEDEK_SEBEPLER = [
        'Gönderdiğim ürünlerde eksik yok', 'Müşteri kaynaklı hata', 'Soğuk ürün garantili satış yapmamaktayız',
        'Gönderilen ürünün tarihi satışa uygun', 'Depo kaynaklı sorun değil', 'Kapalı ambalaj, bozukluğu tespit edilemez',
        'Sonradan teslim edildi', 'Tedarikçi kaynaklı kusurlu ürün', 'Gönderilen ürün yanlış değil',
        'Müşteri adresi yanlış seçilmiş, sipariş sistemdeki adrese teslim edildi'
    ];

    var HAZIR_OLGULAR = [
        'Ürünler barkod okutularak paketlenir; siparişte olmayan ürün bu adımdan geçemez.',
        'Sipariş çıkmadan önce ürünler tek tek sayılır.',
        'Kurye teslim alırken poşetteki ürünleri sayar.',
        'Küçük ürünler ayrıca kontrol edilir, poşete en son konur.',
        'Kırılabilir ürünler (yumurta gibi) ayrı ve üstte taşınır.',
        'Soğuk ürünler ayrı poşette, soğuk zincir korunarak gönderilir.',
        'Raflardaki son kullanma tarihleri düzenli kontrol edilir.',
        'Kapalı ambalajlı ürünler açılmadan gönderilir.'
    ];

    var d = {
        sekme: 'bekleyen',
        kayitlar: [],
        sebepler: [],
        sebepAd: {},
        hak: null,
        ayar: { anahtar: false, son4: '', olgular: [] },
        sunucu: 'bilinmiyor',
        secilenler: {},
        taslak: {},
        durum: 'yukleniyor',
        hataKod: null,
        sonOkuma: 0,
        asistan: false,
        acikKayit: null,
        okuyor: false
    };

    function el(id) { return document.getElementById(id); }

    function kacis(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function bildir(metin, tur) {
        if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir(metin, tur || 'bilgi', 4200);
    }

    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    var IKON = {
        tik: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3 3 7-7"/></svg>',
        saat: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>',
        kalem: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16h3l8.5-8.5-3-3L4 13z"/></svg>',
        uyari: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/></svg>',
        kutu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
        kopya: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M4 13V5a1 1 0 0 1 1-1h8"/></svg>',
        panel: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5h7v7M15 5l-9 9"/></svg>',
        yildiz: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v3M10 14v3M3 10h3M14 10h3M5.5 5.5l2 2M12.5 12.5l2 2M5.5 14.5l2-2M12.5 7.5l2-2"/></svg>'
    };

    // ------------------------------------------------------------------
    // Tarih
    // ------------------------------------------------------------------

    var TR = 'tr-TR';
    var BOLGE = 'Europe/Istanbul';

    function gunAy(iso) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        return new Date(t).toLocaleDateString(TR, { timeZone: BOLGE, day: 'numeric', month: 'short' });
    }

    function gunAySaat(iso) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        return new Date(t).toLocaleString(TR, { timeZone: BOLGE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function kalanCipi(iso) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        var ms = t - Date.now();
        if (ms <= 0) return '<span class="itr-d itr-d--gecti">Süre doldu</span>';
        var saat = Math.floor(ms / 3600000);
        var metin = saat < 1 ? '1 saatten az' : saat < 24 ? saat + ' saat kaldı'
            : saat < 48 ? '1 gün ' + (saat - 24) + ' saat' : Math.floor(saat / 24) + ' gün kaldı';
        var sinif = saat < 12 ? 'acil' : saat < 36 ? 'yakin' : 'rahat';
        return '<span class="itr-d itr-d--' + sinif + '">' + IKON.saat + metin + '</span>';
    }

    // ------------------------------------------------------------------
    // Kayıt modeli
    // ------------------------------------------------------------------

    function acikMi(k) { return k.durum === 100 && Date.parse(k.sonTarih) > Date.now(); }

    function sade(o) {
        var veri = (o && o.data) || {};
        var fb = veri.feedback || {};
        var ac = typeof veri.description === 'string' && veri.description !== 'description' ? veri.description : '';
        var itiraz = o.objection || {};
        return {
            id: String(o._id || ''),
            durum: Number(o.status),
            kayitTarihi: o.recordDate || null,
            sonTarih: o.deadlineForObjection || null,
            kriter: (o.criteria && o.criteria.name && o.criteria.name.tr) || '',
            sikayet: (fb.feedback && fb.feedback.tr) || ac || '',
            aciklama: ac,
            musteriNotu: typeof fb.note === 'string' ? fb.note : '',
            urun: (veri.product && veri.product.fullName && veri.product.fullName.tr) || '',
            siparisTarihi: (veri.order && veri.order.date) || '',
            itirazMetni: typeof itiraz.description === 'string' ? itiraz.description : '',
            itirazSebepId: typeof itiraz.reasonId === 'string' ? itiraz.reasonId : ''
        };
    }

    function sunucuya(k) {
        return {
            id: k.id, durum: k.durum, kayitTarihi: k.kayitTarihi, sonTarih: k.sonTarih, kriter: k.kriter,
            sikayet: k.sikayet, aciklama: k.aciklama, musteriNotu: k.musteriNotu, urun: k.urun,
            itirazMetni: k.itirazMetni, itirazSebepId: k.itirazSebepId
        };
    }

    // ------------------------------------------------------------------
    // Jet Barkod API
    // ------------------------------------------------------------------

    async function api(yol, secenek) {
        var a = global.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { kod: 401, j: { error: 'unauthorized' } };
        try {
            var r = await a.apiFetch(yol, secenek || {});
            var j = null;
            try { j = await r.json(); } catch (e) { /* gövde yok */ }
            return { kod: r.status, j: j || {} };
        } catch (e) {
            return { kod: 0, j: { error: 'ag' } };
        }
    }

    function postJson(yol, govde) {
        return api(yol, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
    }

    function sunucuHataMetni(c) {
        var k = c && c.j && c.j.error;
        if (c && c.kod === 401) return 'Oturum doldu. Sayfayı yenileyip tekrar giriş yap.';
        if (k === 'kurulum_bekleniyor' || (c && c.kod === 404)) return 'Sunucu güncellemesi bekleniyor. Kurulum bitince taslak yazılabilecek.';
        if (k === 'hak_yok') return 'İtiraz Yazıcı hesabında kapalı.';
        if (k === 'anahtar_yok') return 'Önce Ayarlar\'dan Gemini anahtarını ekle.';
        if (k === 'anahtar_gecersiz') return 'Gemini anahtarı geçersiz. Ayarlar\'dan yenisini ekle.';
        if (k === 'gemini_kota') return 'Gemini kotası doldu. Biraz sonra tekrar dene.';
        if (k === 'gunluk_sinir') return 'Bugünkü taslak sınırı doldu. Yarın yeniden açılır.';
        if (k === 'cok_istek') return 'Çok sık istendi. Birkaç saniye sonra tekrar dene.';
        if (k === 'gemini_ulasilamadi') return 'Gemini\'ye ulaşılamadı. Biraz sonra tekrar dene.';
        if (k === 'gemini_bicim' || k === 'gemini_hata' || k === 'model_yok') return 'Taslak üretilemedi. Bir kez daha dene.';
        if (c && c.kod === 0) return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.';
        return 'İşlem yapılamadı. Biraz sonra tekrar dene.';
    }

    async function ayarYukle() {
        var c = await api('/api/itiraz/ayar');
        if (c.kod === 200 && c.j.ok) {
            d.sunucu = 'hazir';
            d.ayar = { anahtar: !!c.j.anahtar, son4: c.j.son4 || '', olgular: Array.isArray(c.j.olgular) ? c.j.olgular : [] };
        } else if (c.kod === 503 || c.kod === 404) {
            d.sunucu = 'bekleniyor';
        } else {
            d.sunucu = 'hata';
        }
        uyariCiz();
        ayarCiz();
    }

    async function kayitlariSunucuyaYaz() {
        if (d.sunucu !== 'hazir' || !d.kayitlar.length) return;
        for (var i = 0; i < d.kayitlar.length; i += 60) {
            var c = await postJson('/api/itiraz/kayitlar', { kayitlar: d.kayitlar.slice(i, i + 60).map(sunucuya) });
            if (c.kod !== 200 || !c.j.ok) return;
            Object.assign(d.secilenler, c.j.secilenler || {});
        }
        listeCiz();
    }

    // ------------------------------------------------------------------
    // Franchise paneli
    // ------------------------------------------------------------------

    function tarihAraligi() {
        var bit = new Date();
        bit.setHours(23, 59, 59, 999);
        var bas = new Date();
        bas.setHours(0, 0, 0, 0);
        bas.setDate(bas.getDate() - GUN);
        return { startDate: bas.toISOString(), endDate: bit.toISOString() };
    }

    async function sebepleriAl() {
        try {
            var s = JSON.parse(localStorage.getItem(SEBEP_ANAHTAR) || 'null');
            if (s && Date.now() - s.zaman < 24 * 3600 * 1000 && Array.isArray(s.liste) && s.liste.length) return s.liste;
        } catch (e) { /* yok */ }
        try {
            var r = await global.franchiseOturum.istek('/dds-reasons');
            if (r.ok) {
                var j = await r.json();
                var liste = (Array.isArray(j) ? j : (j && j.data) || []).map(function (x) {
                    return { id: String(x._id || x.id || ''), ad: (x.name && x.name.tr) || '' };
                }).filter(function (x) { return x.id && x.ad; });
                if (liste.length) {
                    try { localStorage.setItem(SEBEP_ANAHTAR, JSON.stringify({ zaman: Date.now(), liste: liste })); } catch (e) { /* dolu */ }
                    return liste;
                }
            }
        } catch (e) { /* yedek liste */ }
        return YEDEK_SEBEPLER.map(function (ad) { return { id: '', ad: ad }; });
    }

    function onbellekOku() {
        try {
            var o = JSON.parse(sessionStorage.getItem(ONBELLEK) || 'null');
            if (o && Date.now() - o.zaman < ONBELLEK_MS && Array.isArray(o.kayitlar)) return o;
        } catch (e) { /* yok */ }
        return null;
    }

    async function panelOku(zorla) {
        if (d.okuyor) return;
        if (!global.franchiseOturum) { d.durum = 'hata'; d.hataKod = 'oturum'; listeCiz(); return; }
        if (!zorla) {
            var o = onbellekOku();
            if (o) {
                d.kayitlar = o.kayitlar; d.hak = o.hak; d.sebepler = o.sebepler || [];
                sebepAdlari(); d.durum = 'dolu'; d.sonOkuma = o.zaman;
                ozetCiz(); listeCiz(); kayitlariSunucuyaYaz();
                return;
            }
        } else if (Date.now() - d.sonOkuma < YENILE_ARA_MS) {
            bildir('Liste az önce okundu. Birkaç saniye sonra tekrar dene.');
            return;
        }

        d.okuyor = true;
        var dugme = el('itrYenile');
        dugme.classList.add('is-mesgul');
        dugme.disabled = true;
        if (!d.kayitlar.length) { d.durum = 'yukleniyor'; listeCiz(); }
        try {
            var oturum = await global.franchiseOturum.al();
            d.sebepler = await sebepleriAl();
            sebepAdlari();

            await bekle(250);
            var rh = await global.franchiseOturum.istek('/dds100/objection-right', { method: 'POST', govde: { warehouseId: oturum.depo } });
            if (rh.ok) {
                var jh = await rh.json().catch(function () { return null; });
                d.hak = jh && Number.isFinite(Number(jh.objectionRights)) ? Number(jh.objectionRights) : null;
            }

            var aralik = tarihAraligi();
            var hepsi = [];
            for (var s = 0; s < EN_COK_SAYFA; s++) {
                await bekle(s ? 500 : 250);
                var r = await global.franchiseOturum.istek('/dds100/logs/filter', {
                    method: 'POST',
                    govde: { startDate: aralik.startDate, endDate: aralik.endDate, limit: SAYFA, offset: s * SAYFA, warehouseIds: [oturum.depo] }
                });
                if (!r.ok) { var h = new Error('sunucu'); h.kod = 'panel'; throw h; }
                var j = await r.json();
                var parca = Array.isArray(j && j.ddsObjections) ? j.ddsObjections : [];
                hepsi = hepsi.concat(parca);
                var toplam = Number(j && j.totalCount) || 0;
                if (parca.length < SAYFA || hepsi.length >= toplam) break;
            }
            d.kayitlar = hepsi.map(sade).filter(function (k) { return /^[a-f0-9]{24}$/.test(k.id); });
            d.durum = 'dolu';
            d.hataKod = null;
            d.sonOkuma = Date.now();
            try {
                sessionStorage.setItem(ONBELLEK, JSON.stringify({ zaman: d.sonOkuma, kayitlar: d.kayitlar, hak: d.hak, sebepler: d.sebepler }));
            } catch (e) { /* dolu */ }
            ozetCiz();
            listeCiz();
            kayitlariSunucuyaYaz();
        } catch (e) {
            d.hataKod = e.kod || 'ag';
            if (!d.kayitlar.length) d.durum = 'hata';
            else bildir(panelHataMetni(d.hataKod)[0], 'hata');
            listeCiz();
        } finally {
            d.okuyor = false;
            dugme.classList.remove('is-mesgul');
            dugme.disabled = false;
        }
    }

    function sebepAdlari() {
        d.sebepAd = {};
        d.sebepler.forEach(function (s) { if (s.id) d.sebepAd[s.id] = s.ad; });
    }

    function panelHataMetni(kod) {
        if (kod === 'oturum') return ['Franchise oturumu bulunamadı', 'Franchise panelini bir kez aç. Jet Barkod Asistan oturumu buraya getirir; telefonda da çalışır.'];
        if (kod === 'depo') return ['Depo bilgisi bulunamadı', 'Franchise panelinde Mevcut Stok sayfasını bir kez aç.'];
        if (kod === 'ag') return ['Panele ulaşılamadı', 'İnternet bağlantını kontrol edip tekrar dene.'];
        return ['Kayıtlar okunamadı', 'Biraz sonra tekrar dene.'];
    }

    // ------------------------------------------------------------------
    // Çizim: uyarı, özet, liste
    // ------------------------------------------------------------------

    function uyariCiz() {
        var u = el('itrUyari');
        if (d.sunucu === 'bekleniyor') {
            u.innerHTML = '<span>Sunucu güncellemesi bekleniyor. Kayıtlar görünür; taslak yazma kurulum bitince açılır.</span>';
            u.hidden = false;
        } else if (d.sunucu === 'hazir' && !d.ayar.anahtar) {
            u.innerHTML = '<span>Taslak yazmak için Gemini anahtarı gerekiyor.</span><button type="button" data-ayar-ac>Anahtar Ekle</button>';
            u.hidden = false;
        } else {
            u.hidden = true;
        }
    }

    function ozetCiz() {
        el('itrHak').textContent = d.hak == null ? '–' : String(d.hak);
        el('itrHak').parentNode.classList.toggle('is-sifir', d.hak === 0);
        el('itrBekleyen').textContent = String(d.kayitlar.filter(acikMi).length);
        var kabul = d.kayitlar.filter(function (k) { return k.durum === 300; }).length;
        var red = d.kayitlar.filter(function (k) { return k.durum === 400; }).length;
        el('itrOran').textContent = kabul + red ? '%' + Math.round((kabul * 100) / (kabul + red)) : '–';
    }

    function iskelet() {
        var s = '';
        for (var i = 0; i < 3; i++) {
            s += '<div class="itr-kayit itr-kayit--iskelet" aria-hidden="true">' +
                '<span class="itr-iskelet" style="width:96px"></span>' +
                '<span class="itr-iskelet" style="grid-column:1/-1;width:70%;height:16px"></span>' +
                '<span class="itr-iskelet" style="grid-column:1/-1;width:90%"></span>' +
                '<span class="itr-iskelet" style="grid-column:1/-1;width:40%"></span></div>';
        }
        return s;
    }

    function bosKutu(ikon, baslik, metin, dugme, hata) {
        return '<div class="itr-bos' + (hata ? ' is-hata' : '') + '"><span>' + ikon + '</span><strong>' + kacis(baslik) + '</strong><p>' + kacis(metin) + '</p>' +
            (dugme ? '<button type="button" class="itr-arac" data-yenile>' + kacis(dugme) + '</button>' : '') + '</div>';
    }

    function durumCipi(k) {
        if (k.durum === 300) return '<span class="itr-d itr-d--kabul">' + IKON.tik + 'Kabul Edildi</span>';
        if (k.durum === 400) return '<span class="itr-d itr-d--red">Reddedildi</span>';
        if (k.durum === 200) return '<span class="itr-d itr-d--bekliyor">' + IKON.saat + 'Sonuç Bekleniyor</span>';
        return '<span class="itr-d itr-d--gecti">İtiraz Edilmedi</span>';
    }

    function kartHtml(k) {
        var bekleyen = acikMi(k);
        var hazir = bekleyen && (d.secilenler[k.id] || d.taslak[k.id])
            ? '<span class="itr-hazir">' + IKON.kalem + 'Taslak hazır</span>' : '';
        var not = k.musteriNotu
            ? '<p class="itr-kayit__not">' + kacis(k.musteriNotu) + '</p>'
            : '<p class="itr-kayit__not is-bos">Müşteri not bırakmamış.</p>';
        return '<button type="button" class="itr-kayit" data-kayit="' + k.id + '">' +
            '<span class="itr-kayit__ust">' + (k.sikayet ? '<span class="itr-cip">' + kacis(k.sikayet) + '</span>' : '') + hazir + '</span>' +
            '<span class="itr-kayit__sure">' + (bekleyen ? kalanCipi(k.sonTarih) : durumCipi(k)) + '</span>' +
            '<p class="itr-kayit__urun">' + kacis(k.urun || k.kriter || 'Kayıt') + '</p>' +
            not +
            '<span class="itr-kayit__alt"><span>Kayıt ' + kacis(gunAy(k.kayitTarihi)) + '</span>' +
            (k.siparisTarihi ? '<span>Sipariş ' + kacis(gunAy(k.siparisTarihi)) + '</span>' : '') +
            (k.kriter ? '<span>' + kacis(k.kriter) + '</span>' : '') + '</span>' +
            '</button>';
    }

    function oranlarHtml(liste) {
        var gruplar = {};
        liste.forEach(function (k) {
            if ([200, 300, 400].indexOf(k.durum) === -1) return;
            var g = gruplar[k.sikayet || 'Diğer'] = gruplar[k.sikayet || 'Diğer'] || { k: 0, r: 0, b: 0 };
            if (k.durum === 300) g.k++; else if (k.durum === 400) g.r++; else g.b++;
        });
        var adlar = Object.keys(gruplar);
        if (!adlar.length) return '';
        return '<section class="itr-oranlar" aria-label="Şikâyete göre sonuç"><h2>Şikâyete Göre Sonuç</h2>' +
            adlar.map(function (ad) {
                var g = gruplar[ad];
                var top = g.k + g.r + g.b;
                var yuzde = function (n) { return (n * 100 / top).toFixed(1) + '%'; };
                return '<div class="itr-oran"><span>' + kacis(ad) + '</span><b>' + g.k + ' kabul · ' + g.r + ' red' + (g.b ? ' · ' + g.b + ' bekliyor' : '') + '</b>' +
                    '<span class="itr-oran__cubuk"><i class="k" style="width:' + yuzde(g.k) + '"></i><i class="r" style="width:' + yuzde(g.r) + '"></i><i class="b" style="width:' + yuzde(g.b) + '"></i></span></div>';
            }).join('') + '</section>';
    }

    function listeCiz() {
        var kutu = el('itrListe');
        if (d.durum === 'yukleniyor') { kutu.innerHTML = iskelet(); return; }
        if (d.durum === 'hata') {
            var m = panelHataMetni(d.hataKod);
            kutu.innerHTML = bosKutu(IKON.uyari, m[0], m[1], 'Tekrar Dene', true);
            return;
        }
        if (d.sekme === 'bekleyen') {
            var acik = d.kayitlar.filter(acikMi).sort(function (a, b) { return Date.parse(a.sonTarih) - Date.parse(b.sonTarih); });
            kutu.innerHTML = acik.length ? acik.map(kartHtml).join('')
                : bosKutu(IKON.kutu, 'İtiraz bekleyen kayıt yok', 'Son ' + GUN + ' günde süresi dolmamış, itiraz edilmemiş kayıt bulunmuyor.');
            return;
        }
        var sonuc = d.kayitlar.filter(function (k) { return !acikMi(k); })
            .sort(function (a, b) { return Date.parse(b.kayitTarihi) - Date.parse(a.kayitTarihi); });
        kutu.innerHTML = sonuc.length ? oranlarHtml(sonuc) + sonuc.map(kartHtml).join('')
            : bosKutu(IKON.kutu, 'Henüz sonuç yok', 'İtirazların sonuçlandıkça burada görünür.');
    }

    // ------------------------------------------------------------------
    // Katman (detay ve ayarlar)
    // ------------------------------------------------------------------

    var sonOdak = null;

    function katmanAc(id) {
        var k = el(id);
        sonOdak = document.activeElement;
        k.hidden = false;
        document.body.classList.add('itr-kilit');
        void k.offsetWidth; // geçiş için
        k.classList.add('acik');
        var kapat = k.querySelector('.itr-kapat');
        if (kapat) kapat.focus({ preventScroll: true });
    }

    function katmanKapat(id) {
        var k = el(id);
        if (k.hidden) return;
        k.classList.remove('acik');
        var bitir = function () {
            k.hidden = true;
            if (el('itrDetay').hidden && el('itrAyar').hidden) document.body.classList.remove('itr-kilit');
            if (sonOdak && sonOdak.focus) sonOdak.focus({ preventScroll: true });
        };
        var sure = parseFloat(getComputedStyle(k.querySelector('.itr-panel')).transitionDuration) || 0;
        if (sure > 0) setTimeout(bitir, sure * 1000); else bitir();
        if (id === 'itrDetay') d.acikKayit = null;
    }

    // ------------------------------------------------------------------
    // Detay
    // ------------------------------------------------------------------

    function kayitBul(id) {
        for (var i = 0; i < d.kayitlar.length; i++) if (d.kayitlar[i].id === id) return d.kayitlar[i];
        return null;
    }

    function detayAc(id) {
        var k = kayitBul(id);
        if (!k) return;
        d.acikKayit = id;
        el('itrDetaySikayet').textContent = k.sikayet || k.kriter || 'Kayıt';
        el('itrDetayAd').textContent = k.urun || k.kriter || 'Kayıt';
        el('itrDetayAlt').textContent = [
            k.kriter,
            k.kayitTarihi ? 'Kayıt ' + gunAy(k.kayitTarihi) : '',
            acikMi(k) && k.sonTarih ? 'Son itiraz ' + gunAySaat(k.sonTarih) : ''
        ].filter(Boolean).join(' · ');
        detayCiz();
        katmanAc('itrDetay');
    }

    function sebepListesi() {
        return d.sebepler.length ? d.sebepler : YEDEK_SEBEPLER.map(function (ad) { return { id: '', ad: ad }; });
    }

    function detayCiz() {
        var k = kayitBul(d.acikKayit);
        if (!k) return;
        var g = el('itrDetayGovde');
        var not = k.musteriNotu
            ? '<p class="itr-alinti">' + kacis(k.musteriNotu) + '</p>'
            : '<p class="itr-alinti is-bos">Müşteri not bırakmamış.</p>';
        var ust = '<section class="itr-bolum"><h4>Müşteri Notu</h4>' + not + '</section>';

        if (!acikMi(k)) {
            g.innerHTML = ust +
                '<section class="itr-bolum"><h4>Sonuç</h4><div>' + durumCipi(k) + '</div></section>' +
                (k.itirazMetni
                    ? '<section class="itr-bolum"><h4>İtiraz Metni' + (d.sebepAd[k.itirazSebepId] ? ' · ' + kacis(d.sebepAd[k.itirazSebepId]) : '') + '</h4>' +
                      '<p class="itr-alinti">' + kacis(k.itirazMetni) + '</p></section>'
                    : '');
            return;
        }

        var t = d.taslak[k.id] || null;
        if (!t && d.secilenler[k.id]) {
            t = d.taslak[k.id] = { taslaklar: [], secili: -1, metin: d.secilenler[k.id].metin, sebep: d.secilenler[k.id].sebep || '', oneri: '', ekNot: '', yaziyor: false, eski: true };
        }

        var yazmaHazir = d.sunucu === 'hazir' && d.ayar.anahtar;
        var yazBolumu = '<section class="itr-bolum">' +
            '<h4>Bu Kayda Özel Bilgi</h4>' +
            '<input type="text" class="itr-girdi" id="itrEkNot" maxlength="400" placeholder="İsteğe bağlı. Örn: sipariş iki poşete bölünmüştü" value="' + kacis((t && t.ekNot) || '') + '">' +
            '</section>';

        var taslakBolumu;
        if (!yazmaHazir) {
            taslakBolumu = '<section class="itr-bolum"><p class="itr-ipucu">' +
                (d.sunucu === 'bekleniyor' ? 'Sunucu güncellemesi bekleniyor; taslak yazma kurulum bitince açılır.'
                    : 'Taslak yazmak için Gemini anahtarı gerekiyor.') + '</p>' +
                (d.sunucu === 'bekleniyor' ? '' : '<button type="button" class="itr-arac" data-ayar-ac>Anahtar Ekle</button>') + '</section>';
        } else if (t && t.yaziyor) {
            var isk = '';
            for (var i = 0; i < 3; i++) {
                isk += '<div class="itr-taslak itr-taslak--iskelet" aria-hidden="true"><span class="itr-iskelet" style="width:30%"></span>' +
                    '<span class="itr-iskelet" style="width:95%"></span><span class="itr-iskelet" style="width:80%"></span></div>';
            }
            taslakBolumu = '<section class="itr-bolum" aria-busy="true"><h4>Taslaklar yazılıyor</h4><div class="itr-taslaklar">' + isk + '</div></section>';
        } else if (t && t.taslaklar.length) {
            taslakBolumu = '<section class="itr-bolum"><h4>Taslaklar</h4><div class="itr-taslaklar" role="radiogroup" aria-label="Taslaklar">' +
                t.taslaklar.map(function (x, i) {
                    return '<button type="button" class="itr-taslak" role="radio" aria-checked="' + (t.secili === i) + '" data-taslak="' + i + '">' +
                        '<span class="itr-taslak__aci"><i></i>' + kacis(x.aci || ('Taslak ' + (i + 1))) + '</span>' +
                        '<span class="itr-taslak__metin">' + kacis(x.metin) + '</span></button>';
                }).join('') + '</div>' +
                '<button type="button" class="itr-arac" data-yaz>' + IKON.yildiz + 'Yeniden Yaz</button></section>';
        } else {
            taslakBolumu = '<section class="itr-bolum"><button type="button" class="itr-arac itr-arac--ana" data-yaz>' + IKON.yildiz + 'Taslak Yaz</button>' +
                (t && t.eski ? '<p class="itr-ipucu">Aşağıda daha önce seçtiğin metin duruyor.</p>' : '') + '</section>';
        }

        var duzen = '';
        if (t && t.metin != null && (t.secili > -1 || t.eski || t.metin)) {
            var oneri = t.oneri || '';
            duzen = '<section class="itr-bolum"><h4>Gönderilecek Metin</h4>' +
                '<textarea class="itr-metin" id="itrMetin" maxlength="2000" aria-label="Gönderilecek itiraz metni">' + kacis(t.metin) + '</textarea>' +
                '<span class="itr-sayac" id="itrSayac">' + t.metin.length + ' / 2000</span></section>' +
                '<section class="itr-bolum"><h4>İtiraz Sebebi</h4><div class="itr-sebepler" role="radiogroup" aria-label="İtiraz sebebi">' +
                sebepListesi().map(function (s) {
                    return '<button type="button" class="itr-sebep" role="radio" aria-checked="' + (t.sebep === s.ad) + '" data-sebep="' + kacis(s.ad) + '">' +
                        kacis(s.ad) + (oneri === s.ad ? '<span class="itr-sebep__oneri">Öneri</span>' : '') + '</button>';
                }).join('') + '</div></section>';
        }

        var eylem = '';
        if (duzen) {
            var asistanVar = d.asistan;
            eylem = '<div class="itr-eylemler">' +
                '<button type="button" class="itr-arac" data-kopyala>' + IKON.kopya + 'Kopyala</button>' +
                '<button type="button" class="itr-arac itr-arac--ana" data-doldur' + (asistanVar ? '' : ' disabled') + '>' + IKON.panel + 'Panelde Doldur</button>' +
                '</div>' +
                (asistanVar ? '' : '<p class="itr-ipucu">Panelde doldurma bilgisayarda Jet Barkod Asistan ile çalışır. Telefonda metni kopyalayıp panele yapıştır.</p>') +
                (d.hak === 0 ? '<p class="itr-ipucu">İtiraz hakkın 0 görünüyor; panel itirazı kabul etmeyebilir.</p>' : '');
        }

        g.innerHTML = ust + yazBolumu + taslakBolumu + duzen + eylem;
    }

    async function taslakYaz() {
        var k = kayitBul(d.acikKayit);
        if (!k) return;
        var ekNotEl = el('itrEkNot');
        var t = d.taslak[k.id] = Object.assign(d.taslak[k.id] || { taslaklar: [], secili: -1, metin: null, sebep: '', oneri: '' }, {
            yaziyor: true, ekNot: ekNotEl ? ekNotEl.value.trim() : ''
        });
        detayCiz();
        var govde = { kayit_id: k.id, sebepler: sebepListesi().map(function (s) { return s.ad; }), ek_not: t.ekNot };
        var c = await postJson('/api/itiraz/yaz', govde);
        if (c.kod === 404 && c.j && c.j.error === 'kayit_yok') {
            await postJson('/api/itiraz/kayitlar', { kayitlar: [sunucuya(k)] });
            c = await postJson('/api/itiraz/yaz', govde);
        }
        t.yaziyor = false;
        if (c.kod === 200 && c.j.ok && Array.isArray(c.j.taslaklar) && c.j.taslaklar.length) {
            t.taslaklar = c.j.taslaklar;
            t.secili = 0;
            t.metin = t.taslaklar[0].metin;
            t.oneri = c.j.sebep || '';
            if (t.oneri) t.sebep = t.oneri;
            t.eski = false;
        } else {
            bildir(sunucuHataMetni(c), 'hata');
            if (c.j && c.j.error === 'anahtar_gecersiz') { d.ayar.anahtar = false; uyariCiz(); ayarCiz(); }
        }
        if (d.acikKayit === k.id) detayCiz();
        listeCiz();
    }

    function secimiKaydet(k, t) {
        if (d.sunucu !== 'hazir' || !t.metin) return;
        d.secilenler[k.id] = { metin: t.metin, sebep: t.sebep || '' };
        postJson('/api/itiraz/sec', { kayit_id: k.id, metin: t.metin, sebep: t.sebep || '' });
    }

    async function kopyala() {
        var k = kayitBul(d.acikKayit);
        var t = k && d.taslak[k.id];
        if (!t || !t.metin) return;
        var ok = false;
        try { await navigator.clipboard.writeText(t.metin); ok = true; } catch (e) {
            var alan = el('itrMetin');
            if (alan) { alan.select(); try { ok = document.execCommand('copy'); } catch (x) { ok = false; } }
        }
        bildir(ok ? 'Metin kopyalandı.' : 'Kopyalanamadı; metni seçip kopyala.', ok ? 'basari' : 'hata');
        if (ok) secimiKaydet(k, t);
    }

    var dolduruyor = null;
    function panelDoldur() {
        var k = kayitBul(d.acikKayit);
        var t = k && d.taslak[k.id];
        if (!t || !t.metin || !d.asistan) return;
        if (!t.sebep) { bildir('Önce bir itiraz sebebi seç.'); return; }
        secimiKaydet(k, t);
        clearTimeout(dolduruyor);
        dolduruyor = setTimeout(function () { bildir('Jet Barkod Asistan yanıt vermedi.', 'hata'); }, 15000);
        global.postMessage({ type: 'JB_ITIRAZ_DOLDUR', kayitId: k.id, metin: t.metin, sebep: t.sebep }, location.origin);
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global || e.origin !== location.origin) return;
        var m = e.data;
        if (!m || m.type !== 'JB_ITIRAZ_DOLDUR_SONUC') return;
        clearTimeout(dolduruyor);
        bildir(m.metin || (m.ok ? 'Panel açıldı.' : 'Panel açılamadı.'), m.ok ? 'basari' : 'hata');
    });

    // ------------------------------------------------------------------
    // Ayarlar
    // ------------------------------------------------------------------

    function ayarCiz() {
        el('itrAnahtarVar').hidden = !d.ayar.anahtar;
        el('itrAnahtarSon4').textContent = d.ayar.son4 ? '••••' + d.ayar.son4 : '';
        el('itrAnahtarForm').hidden = d.ayar.anahtar && !d.anahtarDegisiyor;
        var secili = d.ayar.olgular || [];
        var hepsi = HAZIR_OLGULAR.concat(secili.filter(function (o) { return HAZIR_OLGULAR.indexOf(o) === -1; }));
        el('itrOlgular').innerHTML = hepsi.map(function (o, i) {
            return '<label class="itr-olgu"><input type="checkbox" data-olgu="' + i + '"' + (secili.indexOf(o) !== -1 ? ' checked' : '') + '><span>' + kacis(o) + '</span></label>';
        }).join('');
        el('itrOlgular').dataset.liste = JSON.stringify(hepsi);
    }

    var olguZaman = null;
    function olgulariKaydet() {
        clearTimeout(olguZaman);
        olguZaman = setTimeout(async function () {
            var c = await postJson('/api/itiraz/ayar', { olgular: d.ayar.olgular });
            if (c.kod !== 200 || !c.j.ok) bildir(sunucuHataMetni(c), 'hata');
        }, 600);
    }

    async function anahtarKaydet(e) {
        e.preventDefault();
        var girdi = el('itrAnahtarGirdi');
        var deger = girdi.value.trim();
        if (!deger) { girdi.focus(); return; }
        var dugme = el('itrAnahtarForm').querySelector('button');
        dugme.disabled = true;
        var c = await postJson('/api/itiraz/ayar', { anahtar: deger });
        dugme.disabled = false;
        if (c.kod === 200 && c.j.ok) {
            girdi.value = '';
            d.ayar.anahtar = true;
            d.ayar.son4 = deger.slice(-4);
            d.anahtarDegisiyor = false;
            bildir('Anahtar kaydedildi.', 'basari');
            ayarCiz(); uyariCiz();
            if (d.acikKayit) detayCiz();
        } else {
            bildir(sunucuHataMetni(c), 'hata');
        }
    }

    async function anahtarSil() {
        var onay = global.JBDiyalog && global.JBDiyalog.onay
            ? await global.JBDiyalog.onay('Taslak yazmak için yeniden eklemen gerekir.', { baslik: 'Gemini anahtarı silinsin mi?', onayYazi: 'Sil', tehlikeli: true })
            : global.confirm('Gemini anahtarı silinsin mi?');
        if (!onay) return;
        var c = await postJson('/api/itiraz/ayar', { anahtar: null });
        if (c.kod === 200 && c.j.ok) {
            d.ayar.anahtar = false; d.ayar.son4 = '';
            ayarCiz(); uyariCiz();
            bildir('Anahtar silindi.');
        } else {
            bildir(sunucuHataMetni(c), 'hata');
        }
    }

    // ------------------------------------------------------------------
    // Olaylar ve açılış
    // ------------------------------------------------------------------

    function olaylariBagla() {
        el('itrYenile').addEventListener('click', function () { panelOku(true); });
        el('itrAyarAc').addEventListener('click', function () { katmanAc('itrAyar'); });

        document.querySelector('.itr-segment').addEventListener('click', function (e) {
            var b = e.target.closest('[data-sekme]');
            if (!b) return;
            d.sekme = b.getAttribute('data-sekme');
            document.querySelectorAll('.itr-segment [data-sekme]').forEach(function (x) {
                x.setAttribute('aria-selected', String(x === b));
            });
            listeCiz();
        });

        el('itrListe').addEventListener('click', function (e) {
            if (e.target.closest('[data-yenile]')) { panelOku(true); return; }
            var b = e.target.closest('[data-kayit]');
            if (b) detayAc(b.getAttribute('data-kayit'));
        });

        document.addEventListener('click', function (e) {
            if (e.target.closest('[data-ayar-ac]')) { katmanAc('itrAyar'); return; }
            var kapat = e.target.closest('[data-kapat]');
            if (kapat) katmanKapat(kapat.closest('.itr-katman').id);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (!el('itrAyar').hidden) katmanKapat('itrAyar');
            else if (!el('itrDetay').hidden) katmanKapat('itrDetay');
        });

        var govde = el('itrDetayGovde');
        govde.addEventListener('click', function (e) {
            var k = kayitBul(d.acikKayit);
            var t = k && d.taslak[k.id];
            if (e.target.closest('[data-yaz]')) { taslakYaz(); return; }
            if (e.target.closest('[data-kopyala]')) { kopyala(); return; }
            if (e.target.closest('[data-doldur]')) { panelDoldur(); return; }
            var tb = e.target.closest('[data-taslak]');
            if (tb && t) {
                t.secili = Number(tb.getAttribute('data-taslak'));
                t.metin = t.taslaklar[t.secili].metin;
                var ekNot = el('itrEkNot');
                if (ekNot) t.ekNot = ekNot.value.trim();
                detayCiz();
                return;
            }
            var sb = e.target.closest('[data-sebep]');
            if (sb && t) {
                t.sebep = sb.getAttribute('data-sebep');
                govde.querySelectorAll('[data-sebep]').forEach(function (x) { x.setAttribute('aria-checked', String(x === sb)); });
            }
        });
        govde.addEventListener('input', function (e) {
            var k = kayitBul(d.acikKayit);
            if (!k) return;
            if (e.target.id === 'itrMetin') {
                var t = d.taslak[k.id];
                if (!t) return;
                t.metin = e.target.value;
                el('itrSayac').textContent = t.metin.length + ' / 2000';
            } else if (e.target.id === 'itrEkNot') {
                d.taslak[k.id] = d.taslak[k.id] || { taslaklar: [], secili: -1, metin: null, sebep: '', oneri: '' };
                d.taslak[k.id].ekNot = e.target.value;
            }
        });

        el('itrAnahtarForm').addEventListener('submit', anahtarKaydet);
        el('itrAnahtarSil').addEventListener('click', anahtarSil);
        el('itrAnahtarDegistir').addEventListener('click', function () {
            d.anahtarDegisiyor = true;
            ayarCiz();
            el('itrAnahtarGirdi').focus();
        });
        el('itrOlgular').addEventListener('change', function (e) {
            var liste = JSON.parse(el('itrOlgular').dataset.liste || '[]');
            var secili = [];
            el('itrOlgular').querySelectorAll('input[data-olgu]').forEach(function (x) {
                if (x.checked) secili.push(liste[Number(x.getAttribute('data-olgu'))]);
            });
            d.ayar.olgular = secili.filter(Boolean);
            olgulariKaydet();
        });
        el('itrOlguForm').addEventListener('submit', function (e) {
            e.preventDefault();
            var girdi = el('itrOlguGirdi');
            var v = girdi.value.trim().replace(/\s+/g, ' ');
            if (!v) return;
            if (d.ayar.olgular.indexOf(v) === -1) d.ayar.olgular.push(v);
            girdi.value = '';
            ayarCiz();
            olgulariKaydet();
        });

        // Liste her dakika süreleri tazelesin (istek atmadan)
        setInterval(function () { if (!document.hidden && d.durum === 'dolu') { ozetCiz(); listeCiz(); } }, 60000);
    }

    function bolumGoster(id) {
        ['itrGiris', 'itrYetkiYok', 'itrIcerik'].forEach(function (x) { el(x).hidden = (x !== id); });
    }

    async function hakVarMi() {
        var p = global.premiumFeatures;
        if (!p) return false;
        try {
            if (typeof p.init === 'function' && !p.checkPremiumFeature(HAK)) await p.init();
            if (!p.checkPremiumFeature(HAK) && typeof p.loadPremiumFeatures === 'function') await p.loadPremiumFeatures();
        } catch (e) { /* sessiz */ }
        return !!p.checkPremiumFeature(HAK);
    }

    async function basla() {
        var o = null;
        try { o = (global.authUtils && global.authUtils.checkAuth()) || null; } catch (e) { o = null; }
        if (!o || !o.username) { bolumGoster('itrGiris'); return; }
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;
        if (!(await hakVarMi())) { bolumGoster('itrYetkiYok'); return; }
        bolumGoster('itrIcerik');
        olaylariBagla();
        listeCiz();
        if (global.JetBarkodAsistan && global.JetBarkodAsistan.dinle) {
            global.JetBarkodAsistan.dinle(function (durum) {
                var once = d.asistan;
                d.asistan = !!(durum && durum.kurulu);
                if (once !== d.asistan && d.acikKayit) detayCiz();
            });
        }
        ayarYukle();
        panelOku(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
