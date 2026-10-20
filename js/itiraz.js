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
        'Fırın ürünleri diğer ürünlerden ayrı, fırın kraft poşetinde teslim edilir.',
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
        sunucuTaslak: {},
        taslak: {},
        secili: null,
        durum: 'yukleniyor',
        hataKod: null,
        sonOkuma: 0,
        asistan: false,
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
        yildiz: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5c.5 3.2 2.3 5 5.5 5.5-3.2.5-5 2.3-5.5 5.5-.5-3.2-2.3-5-5.5-5.5 3.2-.5 5-2.3 5.5-5.5z"/></svg>',
        not: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 0 1 4 11.5z"/></svg>',
        carpi: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>',
        arti: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10"/></svg>',
        yenile: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10a6 6 0 1 1-1.8-4.3"/><path d="M16 3.8v3.6h-3.6"/></svg>'
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

    function kalanCipi(iso, uzun) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        var ms = t - Date.now();
        if (ms <= 0) return '<span class="itr-d itr-d--gecti">Süre Doldu</span>';
        var saat = Math.floor(ms / 3600000);
        var kisa = saat < 1 ? '1 sa altı' : saat < 24 ? saat + ' sa' : saat < 48 ? '1 gün ' + (saat - 24) + ' sa' : Math.floor(saat / 24) + ' gün';
        var tam = saat < 1 ? '1 saatten az kaldı' : saat < 24 ? saat + ' saat kaldı'
            : saat < 48 ? '1 gün ' + (saat - 24) + ' saat kaldı' : Math.floor(saat / 24) + ' gün kaldı';
        var sinif = saat < 12 ? 'acil' : saat < 36 ? 'yakin' : 'rahat';
        return '<span class="itr-d itr-d--' + sinif + '" title="' + tam + '">' + IKON.saat + (uzun ? tam : kisa) + '</span>';
    }

    // ------------------------------------------------------------------
    // Ürün görselleri
    // Önce panelin verdiği adres; yoksa Jet Barkod kataloğundan (sunucu,
    // kimlik ya da adla). Sonuç tarayıcıda saklanır; bulunamayan üç gün
    // sonra yeniden sorulur. Sunucu cevap vermezse oturum boyunca sorulmaz.
    // ------------------------------------------------------------------

    var GORSEL_ANAHTAR = 'jbItirazGorsel';
    var GORSEL_ADRES = /^https:\/\/[a-z0-9.-]+\.getir\.com\/[^\s"'<>()\\]+$/i;
    var GORSEL_YOK_MS = 3 * 24 * 3600 * 1000;
    var gorselDepo = (function () {
        try {
            var o = JSON.parse(localStorage.getItem(GORSEL_ANAHTAR) || 'null');
            if (o && typeof o === 'object' && !Array.isArray(o)) return o;
        } catch (e) { /* bozuk */ }
        return {};
    })();
    var gorselSirada = {};
    var gorselZaman = null;
    var gorselKapali = false;

    function gecerliGorsel(u) { return typeof u === 'string' && GORSEL_ADRES.test(u) ? u : ''; }

    /* Panel nesnesindeki görsel alanı: dize, { tr, en } ya da dizi */
    function picAdresi(p) {
        if (!p || typeof p !== 'object') return '';
        var x = p.picURL || p.picUrl || p.picURLs || p.image || '';
        if (Array.isArray(x)) x = x[0];
        if (x && typeof x === 'object') x = x.tr || x.en || '';
        if (Array.isArray(x)) x = x[0];
        return gecerliGorsel(x);
    }

    function gorselAnahtari(id, ad) {
        if (/^[a-f0-9]{24}$/i.test(String(id || ''))) return 'i:' + id;
        var s = sadeAd(ad);
        return s ? 'a:' + s.slice(0, 160) : '';
    }

    function gorselBul(id, ad, dogrudan) {
        var g = gecerliGorsel(dogrudan);
        if (g) return g;
        var a = gorselAnahtari(id, ad);
        if (!a) return '';
        var v = gorselDepo[a];
        if (v && v.u) return v.u;
        if (v && Date.now() - (v.t || 0) < GORSEL_YOK_MS) return '';
        if (!gorselKapali && d.sunucu === 'hazir') {
            gorselSirada[a] = { id: /^i:/.test(a) ? String(id) : '', ad: String(ad || '').slice(0, 200) };
            if (!gorselZaman) gorselZaman = setTimeout(gorselleriIste, 250);
        }
        return '';
    }

    async function gorselleriIste() {
        gorselZaman = null;
        var anahtarlar = Object.keys(gorselSirada).slice(0, 120);
        if (!anahtarlar.length || gorselKapali) return;
        var urunler = anahtarlar.map(function (a) { return gorselSirada[a]; });
        anahtarlar.forEach(function (a) { delete gorselSirada[a]; });
        var c = await postJson('/api/itiraz/gorseller', { urunler: urunler });
        var liste = c.kod === 200 && c.j && Array.isArray(c.j.gorseller) ? c.j.gorseller : null;
        if (!liste) { gorselKapali = true; return; }
        var yeni = 0;
        anahtarlar.forEach(function (a, i) {
            var u = gecerliGorsel(liste[i]);
            gorselDepo[a] = { u: u, t: Date.now() };
            if (u) yeni++;
        });
        gorselSakla();
        if (Object.keys(gorselSirada).length && !gorselZaman) gorselZaman = setTimeout(gorselleriIste, 1000);
        if (yeni) listeCiz();
    }

    function gorselSakla() {
        var anahtarlar = Object.keys(gorselDepo);
        if (anahtarlar.length > 800) {
            anahtarlar.sort(function (a, b) { return (gorselDepo[a].t || 0) - (gorselDepo[b].t || 0); })
                .slice(0, anahtarlar.length - 800).forEach(function (a) { delete gorselDepo[a]; });
        }
        try { localStorage.setItem(GORSEL_ANAHTAR, JSON.stringify(gorselDepo)); } catch (e) { /* dolu */ }
    }

    var IKON_PAKET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8 12 4l8 4v8l-8 4-8-4z"/><path d="m4 8 8 4 8-4M12 12v8"/></svg>';

    /* boy: k (liste, 48), b (detay, 72), s (sipariş, 56) */
    function resim(url, boy) {
        return '<span class="itr-resim itr-resim--' + boy + (url ? '' : ' is-yok') + '">' + IKON_PAKET +
            (url ? '<img src="' + kacis(url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-urun-resim>' : '') +
            '</span>';
    }

    // Açılamayan görsel yerine kutu simgesi kalır
    document.addEventListener('error', function (e) {
        var t = e.target;
        if (!t || t.tagName !== 'IMG' || !t.hasAttribute('data-urun-resim')) return;
        if (t.parentNode) t.parentNode.classList.add('is-yok');
        t.remove();
    }, true);

    // ------------------------------------------------------------------
    // Şikâyet türü ve kayda özel olaylar
    // Olaylar sayfada çip; seçilenler taslağa "doğru kabul et" diye gider.
    // ------------------------------------------------------------------

    var TURLER = [
        ['iptal', /iptal/i], ['eksik', /eksik|gelmedi/i], ['yanlis', /yanl[ıi]ş/i],
        ['bozuk', /bayat|bozuk|çürük|curuk|küf|kuf/i], ['tarih', /tarih|skt|son kullanma/i],
        ['hasar', /hasar|ezik|k[ıi]r[ıi]k|patlak|ak[ıi]nt[ıi]/i], ['soguk', /so[gğ]uk|s[ıi]cak|eri/i]
    ];

    function turBul(k) {
        var metinler = [k.sikayet, k.aciklama];
        for (var m = 0; m < metinler.length; m++) {
            if (!metinler[m]) continue;
            for (var i = 0; i < TURLER.length; i++) if (TURLER[i][1].test(metinler[m])) return TURLER[i][0];
        }
        return 'diger';
    }

    var OLAYLAR = [
        { k: 'sayildi', ad: 'Bayi Kontrol Edip Saydı', metin: 'Ürünler bayi sahibi tarafından eksiksiz kontrol edilerek ve sayılarak hazırlandı.', tur: null },
        { k: 'kamera', ad: 'Kamera Görüntüsü Var', metin: 'İlgili siparişe ait kamera görüntüleri elimizde mevcut.', tur: null },
        { k: 'barkod', ad: 'Barkodla Toplandı', metin: 'Ürünler barkod okutularak toplandı.', tur: ['yanlis', 'eksik'] },
        { k: 'firin', ad: 'Fırın Poşeti Ayrıydı', metin: 'Fırın ürünleri diğer ürünlerden ayrı olarak fırın kraft poşetinde teslim edildi.', tur: ['eksik'] },
        { k: 'tarih', ad: 'Tarih Kontrol Edildi', metin: 'Ürünün son kullanma tarihi gönderim günü geçerliydi; raf tarih kontrolleri düzenli yapılıyor.', tur: ['tarih', 'bozuk'] },
        { k: 'ambalaj', ad: 'Kapalı Ambalaj', metin: 'Ürün kapalı ambalajında, açılmadan gönderildi.', tur: ['bozuk', 'tarih', 'hasar'] },
        { k: 'saglam', ad: 'Sağlam Paketlendi', metin: 'Ürün sağlam ve uygun şekilde paketlenerek gönderildi.', tur: ['hasar', 'bozuk'] },
        { k: 'soguk', ad: 'Soğuk Zincir Korundu', metin: 'Ürün soğuk zincir korunarak ayrı poşette gönderildi.', tur: ['soguk'] },
        { k: 'hazirdi', ad: 'Sipariş Hazırdı', metin: 'Sipariş eksiksiz hazırlanmış ve teslime hazırdı.', tur: ['iptal'] },
        { k: 'kurye', ad: 'Kurye Adrese Gitti', metin: 'Bildirim tarafımıza ulaşınca kuryemiz adrese yönlendirildi.', tur: ['eksik', 'yanlis', 'bozuk', 'hasar'] },
        { k: 'almadi', ad: 'Müşteri Poşeti Almamış', metin: 'Müşterinin poşetlerden birini kapıdan almadığı fark edildi.', tur: ['eksik'] },
        { k: 'ozur', ad: 'Müşteri Hatasını Kabul Etti', metin: 'Müşteriyle iletişim kurulunca müşteri hatasını fark etti ve kuryemizden özür diledi.', tur: null },
        { k: 'sonradan', ad: 'Sonradan Teslim Edildi', metin: 'Ürün müşteriye sonradan teslim edildi.', tur: ['eksik', 'yanlis'] }
    ];

    function olaylarFor(k) {
        var tur = turBul(k);
        return OLAYLAR.filter(function (o) { return !o.tur || tur === 'diger' || o.tur.indexOf(tur) !== -1; });
    }

    function olayMetinleri(t) {
        return (t.olaylar || []).map(function (anahtar) {
            for (var i = 0; i < OLAYLAR.length; i++) if (OLAYLAR[i].k === anahtar) return OLAYLAR[i].metin;
            return '';
        }).filter(Boolean);
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
            urunId: veri.product && /^[0-9a-f]{24}$/i.test(String(veri.product.id || '')) ? String(veri.product.id) : '',
            gorsel: picAdresi(veri.product),
            siparisTarihi: (veri.order && veri.order.date) || '',
            siparisId: veri.order && /^[0-9a-f]{24}$/i.test(String(veri.order.id || '')) ? String(veri.order.id) : '',
            siparisTur: Number.isFinite(parseInt(veri.domainType, 10)) ? parseInt(veri.domainType, 10) : null,
            itirazMetni: typeof itiraz.description === 'string' ? itiraz.description : '',
            itirazSebepId: typeof itiraz.reasonId === 'string' ? itiraz.reasonId : ''
        };
    }

    function sunucuya(k) {
        return {
            id: k.id, durum: k.durum, kayitTarihi: k.kayitTarihi, sonTarih: k.sonTarih, kriter: k.kriter,
            sikayet: k.sikayet, aciklama: k.aciklama, musteriNotu: k.musteriNotu, urun: k.urun, urunId: k.urunId,
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
        // Panel listesi ayardan önce geldiyse sunucuya yazım atlanmıştı
        if (d.durum === 'dolu') { listeCiz(); kayitlariSunucuyaYaz(); }
    }

    async function kayitlariSunucuyaYaz() {
        if (d.sunucu !== 'hazir' || !d.kayitlar.length) return;
        for (var i = 0; i < d.kayitlar.length; i += 60) {
            var c = await postJson('/api/itiraz/kayitlar', { kayitlar: d.kayitlar.slice(i, i + 60).map(sunucuya) });
            if (c.kod !== 200 || !c.j.ok) return;
            Object.assign(d.secilenler, c.j.secilenler || {});
            Object.assign(d.sunucuTaslak, c.j.taslaklar || {});
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
        for (var i = 0; i < 4; i++) {
            s += '<div class="itr-kayit itr-kayit--iskelet" aria-hidden="true">' +
                '<span class="itr-resim itr-resim--k itr-iskelet"></span>' +
                '<span class="itr-kayit__ic"><span class="itr-iskelet" style="width:80%"></span><span class="itr-iskelet" style="width:45%"></span></span>' +
                '<span class="itr-iskelet" style="width:56px;height:24px;border-radius:999px"></span></div>';
        }
        return s;
    }

    function bosKutu(ikon, baslik, metin, dugme, hata, sade) {
        return '<div class="itr-bos' + (hata ? ' is-hata' : '') + (sade ? ' is-sade' : '') + '"><span>' + ikon + '</span><strong>' + kacis(baslik) + '</strong><p>' + kacis(metin) + '</p>' +
            (dugme ? '<button type="button" class="itr-arac" data-yenile>' + kacis(dugme) + '</button>' : '') + '</div>';
    }

    function durumCipi(k) {
        if (k.durum === 300) return '<span class="itr-d itr-d--kabul">' + IKON.tik + 'Kabul</span>';
        if (k.durum === 400) return '<span class="itr-d itr-d--red">' + IKON.carpi + 'Red</span>';
        if (k.durum === 200) return '<span class="itr-d itr-d--bekliyor">' + IKON.saat + 'Sonuç Bekliyor</span>';
        return '<span class="itr-d itr-d--gecti">İtiraz Yok</span>';
    }

    function hazirMi(id) {
        var t = d.taslak[id];
        return !!((t && t.taslaklar.length) || d.secilenler[id] || (d.sunucuTaslak[id] && d.sunucuTaslak[id].taslaklar.length));
    }

    function kartHtml(k) {
        var bekleyen = acikMi(k);
        var turAd = k.sikayet || k.kriter || '';
        return '<button type="button" class="itr-kayit" data-kayit="' + k.id + '" aria-current="' + (d.secili === k.id) + '">' +
            resim(gorselBul(k.urunId, k.urun, k.gorsel), 'k') +
            '<span class="itr-kayit__ic">' +
                '<span class="itr-kayit__urun">' + kacis(k.urun || k.kriter || 'Kayıt') + '</span>' +
                '<span class="itr-kayit__alt">' +
                    (turAd ? '<span>' + kacis(turAd) + '</span>' : '') +
                    (k.musteriNotu ? '<span class="itr-kayit__ikon" title="Müşteri notu var">' + IKON.not + '<i class="itr-gizli">Müşteri notu var</i></span>' : '') +
                    (bekleyen && hazirMi(k.id) ? '<span class="itr-hazir">' + IKON.kalem + 'Taslak</span>' : '') +
                '</span>' +
            '</span>' +
            '<span class="itr-kayit__sag">' + (bekleyen ? kalanCipi(k.sonTarih) : durumCipi(k)) +
                '<small>' + kacis(gunAy(k.kayitTarihi)) + '</small></span>' +
            '</button>';
    }

    function oranlarHtml(liste) {
        var gruplar = {};
        liste.forEach(function (k) {
            if ([200, 300, 400].indexOf(k.durum) === -1) return;
            var g = gruplar[k.sikayet || 'Diğer'] = gruplar[k.sikayet || 'Diğer'] || { k: 0, r: 0, b: 0 };
            if (k.durum === 300) g.k++; else if (k.durum === 400) g.r++; else g.b++;
        });
        var adlar = Object.keys(gruplar).sort(function (a, b) {
            var x = gruplar[a], y = gruplar[b];
            return (y.k + y.r + y.b) - (x.k + x.r + x.b);
        });
        if (!adlar.length) return '';
        return '<section class="itr-oranlar" aria-label="Şikâyete göre sonuç">' +
            '<div class="itr-oranlar__bas"><h2>Şikâyete Göre Sonuç</h2>' +
                '<span class="itr-lejant"><i class="k"></i>Kabul<i class="r"></i>Red<i class="b"></i>Bekliyor</span></div>' +
            adlar.map(function (ad) {
                var g = gruplar[ad];
                var top = g.k + g.r + g.b;
                var yuzde = function (n) { return (n * 100 / top).toFixed(1) + '%'; };
                var oran = g.k + g.r ? '%' + Math.round(g.k * 100 / (g.k + g.r)) : '–';
                return '<div class="itr-oran"><span>' + kacis(ad) + '</span><b title="' + g.k + ' kabul, ' + g.r + ' red' + (g.b ? ', ' + g.b + ' bekliyor' : '') + '">' + oran + '</b>' +
                    '<span class="itr-oran__cubuk" aria-hidden="true"><i class="k" style="width:' + yuzde(g.k) + '"></i><i class="r" style="width:' + yuzde(g.r) + '"></i><i class="b" style="width:' + yuzde(g.b) + '"></i></span></div>';
            }).join('') + '</section>';
    }

    function gorunenListe() {
        if (d.sekme === 'bekleyen') {
            return d.kayitlar.filter(acikMi).sort(function (a, b) { return Date.parse(a.sonTarih) - Date.parse(b.sonTarih); });
        }
        return d.kayitlar.filter(function (k) { return !acikMi(k); })
            .sort(function (a, b) { return Date.parse(b.kayitTarihi) - Date.parse(a.kayitTarihi); });
    }

    function listeCiz() {
        var kutu = el('itrListe');
        sayaclariYaz();
        if (d.durum === 'yukleniyor') { kutu.innerHTML = iskelet(); detayCiz(); return; }
        if (d.durum === 'hata') {
            var m = panelHataMetni(d.hataKod);
            kutu.innerHTML = bosKutu(IKON.uyari, m[0], m[1], 'Tekrar Dene', true);
            detayCiz();
            return;
        }
        var liste = gorunenListe();
        if (!telefonMu() && (!d.secili || !liste.some(function (k) { return k.id === d.secili; }))) d.secili = liste.length ? liste[0].id : null;
        if (d.sekme === 'bekleyen') {
            kutu.innerHTML = liste.length ? liste.map(kartHtml).join('')
                : bosKutu(IKON.kutu, 'Bekleyen kayıt yok', 'Süresi dolmamış, itiraz edilmemiş kayıt kalmadı.');
        } else {
            kutu.innerHTML = liste.length ? oranlarHtml(liste) + liste.map(kartHtml).join('')
                : bosKutu(IKON.kutu, 'Henüz sonuç yok', 'İtirazlar sonuçlandıkça burada görünür.');
        }
        // Kullanıcı metin yazarken yazma alanını yeniden çizme
        var odak = document.activeElement;
        if (odak && odak !== document.body && el('itrDetayIc').contains(odak) && /^(TEXTAREA|INPUT)$/.test(odak.tagName)) return;
        detayCiz();
    }

    function sayaclariYaz() {
        var b = el('itrSayBekleyen');
        if (b) b.textContent = d.durum === 'dolu' ? String(d.kayitlar.filter(acikMi).length) : '';
    }

    // ------------------------------------------------------------------
    // Seçili kayıt
    // ------------------------------------------------------------------

    var telefonSorgu = global.matchMedia ? global.matchMedia('(max-width: 959px)') : null;
    function telefonMu() { return !!(telefonSorgu && telefonSorgu.matches); }

    function kayitBul(id) {
        for (var i = 0; i < d.kayitlar.length; i++) if (d.kayitlar[i].id === id) return d.kayitlar[i];
        return null;
    }

    function sebepListesi() {
        return d.sebepler.length ? d.sebepler : YEDEK_SEBEPLER.map(function (ad) { return { id: '', ad: ad }; });
    }

    /* Kaydın yazma durumu. Sunucudaki son taslak ve seçilen metinden kurulur;
       böylece telefon ile bilgisayar aynı taslağı görür. */
    function taslakDurumu(id) {
        if (d.taslak[id]) return d.taslak[id];
        var srv = d.sunucuTaslak[id] || null;
        var sec = d.secilenler[id] || null;
        var t = { taslaklar: [], secili: 0, duzen: {}, sebep: '', oneri: '', ekNot: '', ekAcik: false, yaziyor: false, sebepAcik: false, olaylar: [], olayDegisti: false };
        if (srv) {
            t.taslaklar = Array.isArray(srv.taslaklar) ? srv.taslaklar.slice(0, 3) : [];
            t.oneri = srv.sebep || '';
            t.sebep = srv.sebep || '';
            t.ekNot = srv.ekNot || '';
            t.ekAcik = !!t.ekNot;
            // Sunucuda olayların metni durur; çip anahtarına geri çevrilir
            (Array.isArray(srv.olaylar) ? srv.olaylar : []).forEach(function (m) {
                for (var i = 0; i < OLAYLAR.length; i++) if (OLAYLAR[i].metin === m && t.olaylar.indexOf(OLAYLAR[i].k) === -1) t.olaylar.push(OLAYLAR[i].k);
            });
        }
        if (sec && sec.metin) {
            if (sec.sebep) t.sebep = sec.sebep;
            var i = t.taslaklar.findIndex(function (x) { return x.metin === sec.metin; });
            if (i > -1) t.secili = i;
            else if (t.taslaklar.length) t.duzen[0] = sec.metin;
            else t.taslaklar = [{ aci: 'Son Seçtiğin', metin: sec.metin }];
        }
        d.taslak[id] = t;
        return t;
    }

    function metinAl(t) {
        if (!t || !t.taslaklar.length) return '';
        return t.duzen[t.secili] != null ? t.duzen[t.secili] : ((t.taslaklar[t.secili] || {}).metin || '');
    }

    // ------------------------------------------------------------------
    // Sipariş içeriği: panelin kendi "Sipariş Detayı" isteği (GET /orders/<id>)
    // Yalnız ürünler, adetler ve süreler alınır; müşteri adı ve adresi hiç
    // okunmaz, saklanmaz, sunucuya gitmez. Kayıt başına bir istek, bellekte.
    // ------------------------------------------------------------------

    var siparisler = {};

    function sadeAd(s) { return String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim(); }

    function siparisAl(k) {
        if (!k || !k.siparisId || !global.franchiseOturum) return Promise.resolve(null);
        var v = siparisler[k.id];
        if (v && v.sozu) return v.sozu;
        if (v && (v.urunler || v.hata)) return Promise.resolve(v);
        var kayit = siparisler[k.id] = { yukleniyor: true };
        kayit.sozu = (async function () {
            try {
                var r = await global.franchiseOturum.istek('/orders/' + k.siparisId + (k.siparisTur != null ? '?domainType=' + k.siparisTur : ''));
                if (!r.ok) throw new Error('http');
                var j = await r.json();
                var o = j && j.basket ? j : (j && j.data && j.data.basket ? j.data : j);
                var urunler = (o && o.basket && Array.isArray(o.basket.products) ? o.basket.products : []).map(function (u) {
                    var ad = u && u.name && typeof u.name === 'object' ? (u.name.tr || u.name.en || '') : (u && u.name) || '';
                    var pid = u && (u.product && typeof u.product === 'object' ? (u.product.id || u.product._id) : (u.product || u.productId || u.id || u._id));
                    return {
                        ad: String(ad).slice(0, 120), adet: Number(u && u.count) || 0,
                        id: /^[a-f0-9]{24}$/i.test(String(pid || '')) ? String(pid) : '',
                        gorsel: picAdresi(u) || picAdresi(u && u.product)
                    };
                }).filter(function (u) { return u.ad; });
                var t = function (yol) { var x = o && o[yol] && o[yol].date; var ms = Date.parse(x); return Number.isFinite(ms) ? ms : null; };
                var bas = t('checkout');
                var teslim = t('deliver');
                kayit.urunler = urunler;
                kayit.kalem = urunler.length;
                kayit.adet = urunler.reduce(function (a, u) { return a + u.adet; }, 0);
                kayit.teslimDk = bas && teslim && teslim > bas ? Math.round((teslim - bas) / 60000) : null;
            } catch (e) {
                kayit.hata = true;
                kayit.zaman = Date.now();
            }
            kayit.yukleniyor = false;
            kayit.sozu = null;
            return kayit;
        })();
        return kayit.sozu;
    }

    function siparisHtml(k) {
        if (!k.siparisId) return '';
        var v = siparisler[k.id];
        var bas = '<section class="itr-bolum"><div class="itr-bolum__bas"><h3 class="itr-etiket">Sipariş</h3>';
        if (!v || v.yukleniyor) {
            var bos = '';
            for (var i = 0; i < 4; i++) bos += '<span class="itr-urun"><span class="itr-resim itr-resim--s itr-iskelet"></span><span class="itr-iskelet" style="width:80%"></span></span>';
            return bas + '</div><div class="itr-urunler" aria-busy="true">' + bos + '</div></section>';
        }
        if (v.hata || !v.urunler.length) return bas + '</div><p class="itr-ipucu">Sipariş içeriği okunamadı. Franchise paneli açıkken tekrar denenir.</p></section>';
        var hedefAd = sadeAd(k.urun);
        // Panelde kayıttaki ad ile sipariş satırı bazen gramajla ayrışıyor
        var hedef = function (ad) {
            var x = sadeAd(ad);
            return x === hedefAd || (x.length > 8 && hedefAd.length > 8 && (x.indexOf(hedefAd) === 0 || hedefAd.indexOf(x) === 0));
        };
        var ozet = v.kalem + ' ürün · ' + v.adet + ' adet' + (v.teslimDk ? ' · ' + v.teslimDk + ' dk' : '');
        var sirali = v.urunler.slice().sort(function (a, b) { return hedef(b.ad) - hedef(a.ad); });
        var GOSTER = 11;
        return bas + '<span class="itr-bolum__not">' + kacis(ozet) + '</span></div>' +
            '<ul class="itr-urunler">' + sirali.slice(0, GOSTER).map(function (u) {
                var bu = hedef(u.ad);
                return '<li class="itr-urun' + (bu ? ' is-hedef' : '') + '" title="' + kacis(u.ad) + '">' +
                    '<span class="itr-urun__kap">' + resim(gorselBul(u.id, u.ad, u.gorsel), 's') +
                        (u.adet > 1 ? '<b class="itr-urun__adet">×' + u.adet + '</b>' : '') +
                        (bu ? '<i class="itr-urun__isaret">Şikâyet</i>' : '') + '</span>' +
                    '<span class="itr-urun__ad">' + kacis(u.ad) + '</span></li>';
            }).join('') +
            (sirali.length > GOSTER ? '<li class="itr-urun itr-urun--fazla"><span class="itr-resim itr-resim--s">+' + (sirali.length - GOSTER) + '</span><span class="itr-urun__ad">ürün daha</span></li>' : '') +
            '</ul></section>';
    }

    /* Seçili açık kaydın sipariş içeriği henüz yoksa iste; gelince detayı tazele */
    function siparisTetikle(k) {
        if (!k || !acikMi(k) || !k.siparisId) return;
        var v = siparisler[k.id];
        if (v && v.hata && Date.now() - (v.zaman || 0) > 60000) delete siparisler[k.id];
        else if (v) return;
        siparisAl(k).then(function () {
            // Kullanıcı yazarken yazma alanını yeniden çizme
            var odak = document.activeElement;
            if (d.secili !== k.id || (odak && el('itrDetayIc').contains(odak) && /^(TEXTAREA|INPUT)$/.test(odak.tagName))) return;
            detayCiz();
        });
    }

    function sec(id) {
        d.secili = id;
        listeIsaretle();
        detayCiz();
        if (telefonMu()) {
            el('itrDetay').classList.add('acik');
            document.body.classList.add('itr-kilit');
            el('itrDetayIc').scrollTop = 0;
        } else {
            el('itrDetayIc').scrollTop = 0;
        }
    }

    function telefonKapat() {
        el('itrDetay').classList.remove('acik');
        document.body.classList.remove('itr-kilit');
        var b = d.secili && document.querySelector('[data-kayit="' + d.secili + '"]');
        if (b) b.focus({ preventScroll: true });
    }

    function listeIsaretle() {
        document.querySelectorAll('#itrListe [data-kayit]').forEach(function (b) {
            b.setAttribute('aria-current', String(b.getAttribute('data-kayit') === d.secili));
        });
    }

    var IKON_GERI = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6"/></svg>';
    var IKON_ASAGI = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>';

    function detayCiz() {
        var ic = el('itrDetayIc');
        var k = d.secili ? kayitBul(d.secili) : null;
        if (!k) {
            ic.innerHTML = d.durum === 'yukleniyor'
                ? '<div class="itr-detay__govde"><div class="itr-hero"><span class="itr-resim itr-resim--b itr-iskelet"></span><div class="itr-hero__metin"><span class="itr-iskelet" style="width:70%;height:16px"></span><span class="itr-iskelet" style="width:40%"></span></div></div></div>'
                : '<div class="itr-detay__govde">' + bosKutu(IKON.kalem, 'Bir kayıt seç', 'Seçtiğin kaydın itiraz metni burada yazılır.', null, false, true) + '</div>';
            return;
        }
        var acik = acikMi(k);
        siparisTetikle(k);
        var tarihler = [
            k.kayitTarihi ? 'Kayıt ' + gunAy(k.kayitTarihi) : '',
            k.siparisTarihi ? 'Sipariş ' + gunAy(k.siparisTarihi) : '',
            acik && k.sonTarih ? 'Son gün ' + gunAySaat(k.sonTarih) : ''
        ].filter(Boolean).join(' · ');

        var ust = '<div class="itr-detay__cubuk">' +
            '<button type="button" class="itr-detay__geri" data-geri aria-label="Listeye dön">' + IKON_GERI + '<span>Kayıtlar</span></button>' +
            '</div>';
        var hero = '<section class="itr-hero">' + resim(gorselBul(k.urunId, k.urun, k.gorsel), 'b') +
            '<div class="itr-hero__metin">' +
                '<h2>' + kacis(k.urun || k.kriter || 'Kayıt') + '</h2>' +
                '<div class="itr-hero__cipler">' + (k.sikayet ? '<span class="itr-cip">' + kacis(k.sikayet) + '</span>' : '') +
                    (acik ? kalanCipi(k.sonTarih, true) : durumCipi(k)) + '</div>' +
                (tarihler ? '<p class="itr-meta">' + kacis(tarihler) + '</p>' : '') +
            '</div></section>';
        var not = k.musteriNotu
            ? '<section class="itr-not"><span class="itr-not__ikon">' + IKON.not + '</span><div><h3 class="itr-etiket">Müşteri Notu</h3><p>' + kacis(k.musteriNotu) + '</p></div></section>'
            : '';

        if (!acik) {
            ic.innerHTML = ust + '<div class="itr-detay__govde">' + hero + not +
                (k.itirazMetni
                    ? '<section class="itr-bolum"><div class="itr-bolum__bas"><h3 class="itr-etiket">Gönderilen İtiraz</h3>' +
                      (d.sebepAd[k.itirazSebepId] ? '<span class="itr-bolum__not">' + kacis(d.sebepAd[k.itirazSebepId]) + '</span>' : '') + '</div>' +
                      '<p class="itr-gonderilen">' + kacis(k.itirazMetni) + '</p></section>'
                    : '<p class="itr-ipucu">Bu kayda itiraz edilmemiş.</p>') +
                '</div>';
            return;
        }

        var t = taslakDurumu(k.id);
        var yazmaHazir = d.sunucu === 'hazir' && d.ayar.anahtar;

        // Bu kayıtta olanlar: dokunarak seçilen çipler + serbest not
        var olaylar = '';
        if (yazmaHazir) {
            olaylar = '<section class="itr-bolum"><div class="itr-bolum__bas"><h3 class="itr-etiket">Bu Kayıtta Olanlar</h3>' +
                (t.olaylar.length ? '<span class="itr-bolum__not">' + t.olaylar.length + ' seçili</span>' : '') + '</div>' +
                '<div class="itr-olaylar" role="group" aria-label="Bu kayıtta olanlar">' + olaylarFor(k).map(function (o) {
                    var secili = t.olaylar.indexOf(o.k) !== -1;
                    return '<button type="button" class="itr-olay" data-olay="' + o.k + '" aria-pressed="' + secili + '" title="' + kacis(o.metin) + '"><i>' + IKON.tik + '</i>' + kacis(o.ad) + '</button>';
                }).join('') +
                    '<button type="button" class="itr-olay itr-olay--not" data-ek-ac aria-pressed="' + !!(t.ekAcik || t.ekNot) + '"><i>' + IKON.arti + '</i>Not Ekle</button>' +
                '</div>' +
                (t.ekAcik || t.ekNot ? '<input type="text" class="itr-girdi" id="itrEkNot" maxlength="400" placeholder="Örn: sipariş iki poşete bölünmüştü" aria-label="Bu kayda özel not" value="' + kacis(t.ekNot) + '">' : '') +
                '</section>';
        }

        var yazici;
        if (!yazmaHazir) {
            yazici = '<div class="itr-yazici__bos"><span class="ikon">' + IKON.yildiz + '</span><div>' +
                (d.sunucu === 'bekleniyor'
                    ? '<strong>Sunucu güncellemesi bekleniyor</strong><p>Kurulum bitince taslak yazma açılır.</p></div>'
                    : '<strong>Gemini anahtarı gerekiyor</strong><p>Bir kez eklemen yeterli.</p></div><button type="button" class="itr-arac itr-arac--ana" data-ayar-ac>Anahtar Ekle</button>') +
                '</div>';
        } else if (t.yaziyor) {
            yazici = '<div class="itr-yukleniyor" aria-busy="true">' +
                '<div class="itr-sekmeler" aria-hidden="true"><span class="itr-sekme itr-iskelet"></span><span class="itr-sekme itr-iskelet"></span><span class="itr-sekme itr-iskelet"></span></div>' +
                '<div class="itr-yukleniyor__metin"><span class="itr-iskelet" style="width:96%"></span><span class="itr-iskelet" style="width:90%"></span><span class="itr-iskelet" style="width:94%"></span><span class="itr-iskelet" style="width:60%"></span></div>' +
                '<p class="itr-yazici__durum">' + IKON.yildiz + 'Üç taslak yazılıyor</p></div>';
        } else if (!t.taslaklar.length) {
            yazici = '<button type="button" class="itr-yaz-dugme" data-yaz>' + IKON.yildiz + '<span><b>Taslak Yaz</b><small>' +
                (t.olaylar.length || t.ekNot ? 'Seçtiklerinle ve sipariş içeriğiyle üç taslak' : 'Önce yukarıdan bu kayıtta olanları seçebilirsin') +
                '</small></span></button>';
        } else {
            var metin = metinAl(t);
            yazici = '<div class="itr-yazici"><div class="itr-sekmeler" role="tablist" aria-label="Taslaklar">' + t.taslaklar.map(function (x, i) {
                    return '<button type="button" class="itr-sekme" role="tab" aria-selected="' + (t.secili === i) + '" data-taslak="' + i + '" title="' + kacis(x.aci || '') + '"><b>' + (i + 1) + '</b><span>' + kacis(x.aci || ('Taslak ' + (i + 1))) + '</span></button>';
                }).join('') + '</div>' +
                '<textarea class="itr-metin" id="itrMetin" maxlength="2000" aria-label="Gönderilecek itiraz metni">' + kacis(metin) + '</textarea>' +
                '<div class="itr-yazici__alt">' +
                    '<button type="button" class="itr-kucuk' + (t.olayDegisti ? ' is-vurgu' : '') + '" data-yaz>' + IKON.yenile + (t.olayDegisti ? 'Seçimlerle Yeniden Yaz' : 'Yeniden Yaz') + '</button>' +
                    (t.duzen[t.secili] != null ? '<button type="button" class="itr-kucuk" data-geri-al>Taslağa Dön</button>' : '') +
                    '<span class="itr-sayac" id="itrSayac">' + metin.length + ' / 2000</span></div></div>';
        }

        var sebepBolumu = '';
        if (t.taslaklar.length && !t.yaziyor) {
            sebepBolumu = '<section class="itr-bolum"><div class="itr-bolum__bas"><h3 class="itr-etiket">İtiraz Sebebi</h3>' +
                (t.sebep && t.sebep === t.oneri ? '<span class="itr-bolum__not">Önerilen</span>' : '') + '</div>' +
                '<button type="button" class="itr-sebep-sec" data-sebep-ac aria-expanded="' + t.sebepAcik + '">' +
                    '<span' + (t.sebep ? '' : ' class="is-bos"') + '>' + kacis(t.sebep || 'Sebep seç') + '</span>' + IKON_ASAGI + '</button>' +
                (t.sebepAcik ? '<div class="itr-sebepler" role="radiogroup" aria-label="İtiraz sebebi">' + sebepListesi().map(function (s) {
                    return '<button type="button" class="itr-sebep" role="radio" aria-checked="' + (t.sebep === s.ad) + '" data-sebep="' + kacis(s.ad) + '"><i></i><span>' + kacis(s.ad) + '</span>' +
                        (t.oneri === s.ad ? '<small>Öneri</small>' : '') + '</button>';
                }).join('') + '</div>' : '') +
                '</section>';
        }

        var eylem = '';
        if (t.taslaklar.length && !t.yaziyor) {
            var ipucu = !d.asistan ? 'Panelde doldurma bilgisayarda Jet Barkod Asistan ile çalışır; telefonda Kopyala.'
                : d.hak === 0 ? 'İtiraz hakkın 0 görünüyor; panel kabul etmeyebilir.' : '';
            eylem = '<div class="itr-eylemler">' + (ipucu ? '<p class="itr-ipucu">' + kacis(ipucu) + '</p>' : '') +
                '<div class="itr-eylemler__dugmeler">' +
                '<button type="button" class="itr-arac" data-kopyala>' + IKON.kopya + 'Kopyala</button>' +
                '<button type="button" class="itr-arac itr-arac--ana" data-doldur' + (d.asistan ? '' : ' disabled') + ' title="Panelde kaydı açar, formu doldurur. Kaydet\'e sen basarsın.">' + IKON.panel + 'Panelde Doldur</button>' +
                '</div></div>';
        }

        ic.innerHTML = ust + '<div class="itr-detay__govde">' + hero + not + siparisHtml(k) + olaylar +
            '<section class="itr-bolum"><div class="itr-bolum__bas"><h3 class="itr-etiket">İtiraz Metni</h3></div>' + yazici + '</section>' +
            sebepBolumu + '</div>' + eylem;
    }

    async function taslakYaz() {
        var k = kayitBul(d.secili);
        if (!k) return;
        var t = taslakDurumu(k.id);
        if (t.yaziyor) return;
        var ekNotEl = el('itrEkNot');
        if (ekNotEl) t.ekNot = ekNotEl.value.trim();
        t.yaziyor = true;
        t.sebepAcik = false;
        detayCiz();
        // Sipariş içeriği taslağa girer (en çok 4 sn beklenir; gelmezse onsuz yazılır)
        var sp = await Promise.race([siparisAl(k), bekle(4000).then(function () { return null; })]);
        var govde = { kayit_id: k.id, sebepler: sebepListesi().map(function (s) { return s.ad; }), ek_not: t.ekNot, olaylar: olayMetinleri(t) };
        if (sp && sp.urunler && sp.urunler.length) {
            govde.siparis = { urunler: sp.urunler.slice(0, 40).map(function (u) { return { ad: u.ad, adet: u.adet }; }), teslimDk: sp.teslimDk };
        }
        var c = await postJson('/api/itiraz/yaz', govde);
        if (c.kod === 404 && c.j && c.j.error === 'kayit_yok') {
            await postJson('/api/itiraz/kayitlar', { kayitlar: [sunucuya(k)] });
            c = await postJson('/api/itiraz/yaz', govde);
        }
        t.yaziyor = false;
        if (c.kod === 200 && c.j.ok && Array.isArray(c.j.taslaklar) && c.j.taslaklar.length) {
            t.taslaklar = c.j.taslaklar;
            t.secili = 0;
            t.duzen = {};
            t.oneri = c.j.sebep || '';
            if (t.oneri) t.sebep = t.oneri;
            t.olayDegisti = false;
            d.sunucuTaslak[k.id] = { taslaklar: t.taslaklar, sebep: t.oneri, ekNot: t.ekNot, olaylar: olayMetinleri(t) };
        } else {
            bildir(sunucuHataMetni(c), 'hata');
            if (c.j && c.j.error === 'anahtar_gecersiz') { d.ayar.anahtar = false; uyariCiz(); ayarCiz(); }
        }
        if (d.secili === k.id) detayCiz();
        listeCiz();
    }

    /* Seçilen metin sunucuda: düzenleme bir buçuk saniye durunca, ya da
       Kopyala / Panelde Doldur anında yazılır */
    var kayitZaman = null;
    function secimiKaydet(hemen) {
        var k = kayitBul(d.secili);
        var t = k && d.taslak[k.id];
        if (!t || d.sunucu !== 'hazir') return;
        var metin = metinAl(t);
        if (!metin) return;
        clearTimeout(kayitZaman);
        var gonder = function () {
            var onceki = d.secilenler[k.id];
            if (onceki && onceki.metin === metin && onceki.sebep === (t.sebep || '')) return;
            d.secilenler[k.id] = { metin: metin, sebep: t.sebep || '' };
            postJson('/api/itiraz/sec', { kayit_id: k.id, metin: metin, sebep: t.sebep || '' });
        };
        if (hemen) gonder(); else kayitZaman = setTimeout(gonder, 1500);
    }

    async function kopyala() {
        var k = kayitBul(d.secili);
        var t = k && d.taslak[k.id];
        var metin = metinAl(t);
        if (!metin) return;
        var ok = false;
        try { await navigator.clipboard.writeText(metin); ok = true; } catch (e) {
            var alan = el('itrMetin');
            if (alan) { alan.select(); try { ok = document.execCommand('copy'); } catch (x) { ok = false; } }
        }
        bildir(ok ? 'Metin kopyalandı.' : 'Kopyalanamadı; metni seçip kopyala.', ok ? 'basari' : 'hata');
        if (ok) secimiKaydet(true);
    }

    var dolduruyor = null;
    function panelDoldur() {
        var k = kayitBul(d.secili);
        var t = k && d.taslak[k.id];
        var metin = metinAl(t);
        if (!metin || !d.asistan) return;
        if (!t.sebep) { t.sebepAcik = true; detayCiz(); bildir('Önce bir itiraz sebebi seç.'); return; }
        secimiKaydet(true);
        clearTimeout(dolduruyor);
        dolduruyor = setTimeout(function () { bildir('Jet Barkod Asistan yanıt vermedi.', 'hata'); }, 15000);
        global.postMessage({ type: 'JB_ITIRAZ_DOLDUR', kayitId: k.id, metin: metin, sebep: t.sebep }, location.origin);
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global || e.origin !== location.origin) return;
        var m = e.data;
        if (!m || m.type !== 'JB_ITIRAZ_DOLDUR_SONUC') return;
        clearTimeout(dolduruyor);
        bildir(m.ok ? 'Panel sekmesi açıldı; form dolduruluyor. Kontrol edip Kaydet\'e sen bas.' : (m.metin || 'Panel açılamadı.'), m.ok ? 'basari' : 'hata');
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
            detayCiz();
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

    // Ayarlar katmanı
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
            if (!el('itrDetay').classList.contains('acik')) document.body.classList.remove('itr-kilit');
            if (sonOdak && sonOdak.focus) sonOdak.focus({ preventScroll: true });
        };
        var sure = parseFloat(getComputedStyle(k.querySelector('.itr-panel')).transitionDuration) || 0;
        if (sure > 0) setTimeout(bitir, sure * 1000); else bitir();
    }

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
            if (!telefonMu()) d.secili = null;
            listeCiz();
        });

        el('itrListe').addEventListener('click', function (e) {
            if (e.target.closest('[data-yenile]')) { panelOku(true); return; }
            var b = e.target.closest('[data-kayit]');
            if (b) sec(b.getAttribute('data-kayit'));
        });

        document.addEventListener('click', function (e) {
            if (e.target.closest('[data-ayar-ac]')) { katmanAc('itrAyar'); return; }
            var kapat = e.target.closest('[data-kapat]');
            if (kapat) katmanKapat(kapat.closest('.itr-katman').id);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (!el('itrAyar').hidden) katmanKapat('itrAyar');
            else if (el('itrDetay').classList.contains('acik')) telefonKapat();
        });

        if (telefonSorgu && telefonSorgu.addEventListener) {
            telefonSorgu.addEventListener('change', function () {
                if (!telefonMu()) { el('itrDetay').classList.remove('acik'); document.body.classList.remove('itr-kilit'); }
                listeCiz();
            });
        }

        var ic = el('itrDetayIc');
        ic.addEventListener('click', function (e) {
            var k = kayitBul(d.secili);
            var t = k && d.taslak[k.id];
            if (e.target.closest('[data-geri]')) { telefonKapat(); return; }
            if (e.target.closest('[data-yaz]')) { taslakYaz(); return; }
            if (e.target.closest('[data-kopyala]')) { kopyala(); return; }
            if (e.target.closest('[data-doldur]')) { panelDoldur(); return; }
            if (!t && k && acikMi(k)) t = taslakDurumu(k.id);
            if (!t) return;
            if (e.target.closest('[data-ek-ac]')) {
                if (t.ekAcik && !t.ekNot) { t.ekAcik = false; detayCiz(); return; }
                t.ekAcik = true;
                detayCiz();
                var g = el('itrEkNot');
                if (g) g.focus();
                return;
            }
            var ob = e.target.closest('[data-olay]');
            if (ob) {
                var anahtar = ob.getAttribute('data-olay');
                var yer = t.olaylar.indexOf(anahtar);
                if (yer === -1) t.olaylar.push(anahtar); else t.olaylar.splice(yer, 1);
                if (t.taslaklar.length) t.olayDegisti = true;
                var kaydirma = el('itrDetayIc').scrollTop;
                detayCiz();
                el('itrDetayIc').scrollTop = kaydirma;
                var yeni = el('itrDetayIc').querySelector('[data-olay="' + anahtar + '"]');
                if (yeni) yeni.focus({ preventScroll: true });
                return;
            }
            var tb = e.target.closest('[data-taslak]');
            if (tb) {
                t.secili = Number(tb.getAttribute('data-taslak'));
                detayCiz();
                secimiKaydet(false);
                return;
            }
            if (e.target.closest('[data-geri-al]')) {
                delete t.duzen[t.secili];
                detayCiz();
                secimiKaydet(false);
                return;
            }
            if (e.target.closest('[data-sebep-ac]')) {
                t.sebepAcik = !t.sebepAcik;
                detayCiz();
                return;
            }
            var sb = e.target.closest('[data-sebep]');
            if (sb) {
                t.sebep = sb.getAttribute('data-sebep');
                t.sebepAcik = false;
                detayCiz();
                secimiKaydet(false);
            }
        });
        ic.addEventListener('input', function (e) {
            var k = kayitBul(d.secili);
            if (!k) return;
            var t = taslakDurumu(k.id);
            if (e.target.id === 'itrMetin') {
                t.duzen[t.secili] = e.target.value;
                var sayac = el('itrSayac');
                if (sayac) sayac.textContent = e.target.value.length + ' / 2000';
                secimiKaydet(false);
            } else if (e.target.id === 'itrEkNot') {
                t.ekNot = e.target.value;
                if (t.taslaklar.length) t.olayDegisti = true;
            }
        });

        el('itrAnahtarForm').addEventListener('submit', anahtarKaydet);
        el('itrAnahtarSil').addEventListener('click', anahtarSil);
        el('itrAnahtarDegistir').addEventListener('click', function () {
            d.anahtarDegisiyor = true;
            ayarCiz();
            el('itrAnahtarGirdi').focus();
        });
        el('itrOlgular').addEventListener('change', function () {
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

        // Süreler her dakika tazelensin (istek atmadan); yazarken dokunma
        setInterval(function () {
            if (document.hidden || d.durum !== 'dolu') return;
            ozetCiz();
            var odak = document.activeElement;
            if (odak && el('itrDetayIc').contains(odak)) return;
            listeCiz();
        }, 60000);
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
                if (once !== d.asistan) detayCiz();
            });
        }
        ayarYukle();
        panelOku(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
