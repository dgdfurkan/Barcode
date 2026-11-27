/**
 * Mal Kabul Talepleri (/mal-kabul/)
 * ============================================================================
 *
 * "Transferleri Kontrol Et": Jet Barkod sunucusu, Asistan'ın hesaba yazdığı
 * depo paneli jetonuyla günün transfer teslimatlarını ve tamamlanan her
 * paletin ürünlerini okur (/api/depo-panel, islem: malkabul). Sekme açmak
 * gerekmez; depo paneli bir bilgisayarda açık durdukça jeton tazedir.
 *
 * Sipariş adedi ile alınan adet farklı, ya da hasarlı adedi olan ürünler
 * paletine göre ayrılır. Her palet için talep türüne göre (Palet Kalite/Hasar,
 * İrsaliye, Transfer Dışı) yazı hazırlanır; kullanıcı ürün durumunu, alt
 * kategoriyi, alanları ve yazıyı değiştirebilir.
 *
 * "Talep Formunda Hazırla": Asistan, Depo Talep Merkezi'nin formunu yan
 * sekmede açıp doldurur (jet-barkod-asistan/arka-plan/talep-formu.js).
 * GÖNDER'e kullanıcı basar. Asistan yoksa yazı kopyalanır, form açılır.
 *
 * SAKLAMA: o günün verisi ve düzenlemeler yalnız bu tarayıcıda, gün değişince
 * silinir (jb_malkabul_<kullanıcı>). Telefon, plaka ve domain kalıcı
 * varsayılan (jb_malkabul_ayar_<kullanıcı>).
 * ============================================================================
 */
(function (global) {
    'use strict';

    var HAKLAR = ['jetBarkodAsistan'];
    var FORM_ADRES = 'https://getir2.my.site.com/Depo/s/flow/Depo_Talep_Formu_ForCommunityUsers';

    var GRUPLAR = {
        hasar: { alt: 'Palet Kalite/Hasar Problemleri', ad: 'Hasar' },
        irsaliye: { alt: 'Merkez Depo İrsaliye Problemleri', ad: 'Adet Farkı' },
        tdisi: { alt: 'Transfer Dışı Gelen Ürün', ad: 'Transfer Dışı' }
    };
    var GRUP_SIRA = ['hasar', 'irsaliye', 'tdisi'];
    var ALT_SECENEK = ['Palet Kalite/Hasar Problemleri', 'Merkez Depo İrsaliye Problemleri', 'Transfer Dışı Gelen Ürün', 'Hatalı Teslimat'];
    var ALT_KISA = {
        'Palet Kalite/Hasar Problemleri': 'Hasar',
        'Merkez Depo İrsaliye Problemleri': 'İrsaliye',
        'Transfer Dışı Gelen Ürün': 'Transfer Dışı',
        'Hatalı Teslimat': 'Hatalı Teslimat'
    };
    var DURUMLAR = [
        { k: 'eksik', ad: 'Eksik' },
        { k: 'fazla', ad: 'Fazla' },
        { k: 'gelmedi', ad: 'Hiç Gelmedi' },
        { k: 'tdisi', ad: 'Transfer Dışı' },
        { k: 'hasar', ad: 'Hasarlı' },
        { k: 'koli', ad: 'Koli Farkı' }
    ];
    var BITTI = ['COMPLETED', 'COMPLETE_PENDING', 'CLOSED'];
    var DURUM_AD = {
        CREATED: 'Yolda', VERIFICATION_REQUIRED: 'Doğrulama bekliyor', VERIFIED: 'Doğrulandı',
        HANDSHAKE_APPROVED: 'Mal kabul bekliyor', GOODS_ACCEPTANCE_STARTED: 'Mal kabul sürüyor',
        COMPLETE_PENDING: 'Tamamlanıyor', COMPLETED: 'Tamamlandı', CLOSED: 'Kapandı'
    };

    var IKON = {
        kopya: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M4 13V5a1 1 0 0 1 1-1h8"/></svg>',
        form: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 3.5h5.5V9"/><path d="M16.5 3.5 9 11"/><path d="M14 11.5v4a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>',
        yenile: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10a6 6 0 1 1-1.8-4.3"/><path d="M16 3.8v3.6h-3.6"/></svg>',
        tik: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3 3 7-7"/></svg>',
        ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>',
        kutu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v7"/></svg>',
        uyari: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/></svg>'
    };

    var d = {
        kullanici: '',
        gunGeri: 0,          // 0 bugün, 1 dün
        yukleniyor: false,
        hata: null,
        kayit: null,         // { tarih, gunler: { 'YYYY-AA-GG': { zaman, liste } }, secim, taslak }
        ayar: { telefon: '', plaka: '', domain: 'Getir10/GetirBüyük' },
        acik: {},            // açılmış sorunsuz/bekleyen listeleri
        istekNo: 0
    };

    function el(id) { return document.getElementById(id); }

    function kacis(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function bildir(metin, tur) {
        if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir(metin, tur || 'bilgi', 4800);
    }

    // ------------------------------------------------------------------
    // Tarih (İstanbul günü)
    // ------------------------------------------------------------------

    var GUN_BICIM = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
    function gunAnahtari(geri) { return GUN_BICIM.format(new Date(Date.now() - (geri || 0) * 86400000)); }
    function tarihUzun(iso) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        return new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });
    }
    function saat(iso) {
        var t = typeof iso === 'number' ? iso : Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        return new Date(t).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    }

    /* 15'li, 6'lı, 4'lü, 10'lu: sayının okunuşundaki son ünlü */
    function liEki(n) {
        n = Math.abs(Math.round(Number(n) || 0));
        var son;
        if (n === 0) son = 'ı';
        else if (n % 1000000 === 0) son = 'o';
        else if (n % 1000 === 0) son = 'i';
        else if (n % 100 === 0) son = 'ü';
        else if (n % 10 === 0) son = { 1: 'o', 2: 'i', 3: 'u', 4: 'ı', 5: 'i', 6: 'ı', 7: 'i', 8: 'e', 9: 'a' }[(n % 100) / 10];
        else son = { 1: 'i', 2: 'i', 3: 'ü', 4: 'ö', 5: 'e', 6: 'ı', 7: 'i', 8: 'i', 9: 'u' }[n % 10];
        var ek = { a: 'lı', ı: 'lı', e: 'li', i: 'li', o: 'lu', u: 'lu', ö: 'lü', ü: 'lü' }[son];
        return n + "'" + ek;
    }

    // ------------------------------------------------------------------
    // Saklama
    // ------------------------------------------------------------------

    function anahtar() { return 'jb_malkabul_' + d.kullanici; }
    function ayarAnahtari() { return 'jb_malkabul_ayar_' + d.kullanici; }

    function kayitOku() {
        var bugun = gunAnahtari(0);
        var k = null;
        try { k = JSON.parse(localStorage.getItem(anahtar()) || 'null'); } catch (e) { k = null; }
        // Gün değişti: dünün verisi ve düzenlemeleri silinir, sayfa temiz açılır.
        if (!k || k.tarih !== bugun) {
            try { localStorage.removeItem(anahtar()); } catch (e) { /* sessiz */ }
            k = null;
        }
        d.kayit = k || { tarih: bugun, gunler: {}, secim: {}, taslak: {} };
        try {
            var a = JSON.parse(localStorage.getItem(ayarAnahtari()) || 'null');
            if (a && typeof a === 'object') {
                d.ayar.telefon = String(a.telefon || '').slice(0, 20);
                d.ayar.plaka = String(a.plaka || '').slice(0, 20);
                if (a.domain === 'GetirSu' || a.domain === 'Getir10/GetirBüyük') d.ayar.domain = a.domain;
            }
        } catch (e) { /* sessiz */ }
    }

    var yazZaman = null;
    function kayitYaz() {
        clearTimeout(yazZaman);
        yazZaman = setTimeout(function () {
            try { localStorage.setItem(anahtar(), JSON.stringify(d.kayit)); } catch (e) { /* dolu ya da kapalı */ }
        }, 250);
    }
    function ayarYaz() {
        try { localStorage.setItem(ayarAnahtari(), JSON.stringify(d.ayar)); } catch (e) { /* sessiz */ }
    }

    // ------------------------------------------------------------------
    // Sunucu
    // ------------------------------------------------------------------

    async function panelOku(gun) {
        var a = global.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { hata: 'giris' };
        var r;
        try {
            r = await a.apiFetch('/api/depo-panel', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ islem: 'malkabul', veri: { gun: gun } })
            });
        } catch (e) { return { hata: 'ag' }; }
        var j = null;
        try { j = await r.json(); } catch (e) { j = null; }
        if (r.status === 401) return { hata: 'giris' };
        if (r.ok && j && j.ok && j.veri && Array.isArray(j.veri.liste)) return { veri: j.veri };
        var k = j && j.error;
        // Eski sunucu "malkabul"u tanımıyor: gecersiz der ya da uç hiç yok
        if (r.status === 404 || (r.status === 400 && k === 'gecersiz')) return { hata: 'kurulum' };
        if (k === 'oturum') return { hata: 'oturum' };
        if (r.status === 429) return { hata: 'sik' };
        return { hata: k === 'ag' ? 'ag' : 'panel' };
    }

    var HATA_METNI = {
        oturum: ['Depo paneli oturumu bulunamadı', 'Depo panelinin açık olduğu bilgisayarda Asistan çalışıyor olmalı. Paneli açıp birkaç saniye sonra yeniden dene.'],
        kurulum: ['Sunucu güncellemesi bekleniyor', 'Mal kabul kontrolü sunucuya yüklenince çalışacak.'],
        sik: ['Biraz bekle', 'Çok sık soruldu; birkaç saniye sonra yeniden dene.'],
        ag: ['Bağlantı kurulamadı', 'İnternet bağlantını kontrol edip yeniden dene.'],
        panel: ['Depo paneli cevap vermedi', 'Birazdan yeniden dene.'],
        giris: ['Oturum kapandı', 'Yeniden giriş yapman gerekiyor.']
    };

    async function kontrolEt() {
        if (d.yukleniyor) return;
        var gun = gunAnahtari(d.gunGeri);
        var no = ++d.istekNo;
        d.yukleniyor = true;
        d.hata = null;
        ciz();
        var c = await panelOku(gun);
        if (no !== d.istekNo) return;
        d.yukleniyor = false;
        if (c.hata === 'giris') { bolum('mkGiris'); return; }
        if (c.hata) { d.hata = c.hata; ciz(); return; }
        d.kayit.gunler[gun] = { zaman: c.veri.zaman || Date.now(), liste: c.veri.liste };
        kayitYaz();
        ciz();
        var g = gunVerisi();
        var sorunlu = g ? g.liste.filter(function (p) { return sorunluMu(p); }).length : 0;
        bildir(sorunlu ? sorunlu + ' palette fark var, talepler hazır.' : 'Farklı gelen ürün yok.', sorunlu ? 'bilgi' : 'basari');
    }

    function gunVerisi() { return d.kayit.gunler[gunAnahtari(d.gunGeri)] || null; }

    // ------------------------------------------------------------------
    // Ürün durumu ve talep taslakları
    // ------------------------------------------------------------------

    /* Panel adetlerinden ürünün kendiliğinden işaretlenen durumları */
    function otomatikDurum(u) {
        var l = [];
        if (u.s === 0 && u.a > 0) l.push('tdisi');
        else if (u.s > 0 && u.a === 0) l.push('gelmedi');
        else if (u.a < u.s) l.push('eksik');
        else if (u.a > u.s) l.push('fazla');
        if (u.h > 0) l.push('hasar');
        return l;
    }

    function urunSecim(p, u) {
        var s = (d.kayit.secim[p.id] || {})[u.id];
        return {
            durum: s && Array.isArray(s.durum) ? s.durum : otomatikDurum(u),
            koliB: s && s.koliB ? s.koliB : '',
            koliG: s && s.koliG ? s.koliG : ''
        };
    }

    function secimYaz(p, u, degis) {
        var bu = d.kayit.secim[p.id] = d.kayit.secim[p.id] || {};
        var s = urunSecim(p, u);
        bu[u.id] = Object.assign({ durum: s.durum, koliB: s.koliB, koliG: s.koliG }, degis);
        kayitYaz();
    }

    function grupBul(durum) {
        if (durum.indexOf('hasar') !== -1) return 'hasar';
        if (durum.indexOf('tdisi') !== -1) return 'tdisi';
        if (durum.some(function (x) { return x === 'eksik' || x === 'fazla' || x === 'gelmedi' || x === 'koli'; })) return 'irsaliye';
        return null;
    }

    function sorunluMu(p) { return Array.isArray(p.urunler) && p.urunler.length > 0; }

    /* Palet → { hasar: [u...], irsaliye: [...], tdisi: [...] } */
    function gruplar(p) {
        var g = {};
        (p.urunler || []).forEach(function (u) {
            var k = grupBul(urunSecim(p, u).durum);
            if (!k) return;
            (g[k] = g[k] || []).push(u);
        });
        return g;
    }

    function satirYazi(p, u) {
        var s = urunSecim(p, u);
        var var_ = function (k) { return s.durum.indexOf(k) !== -1; };
        var ad = u.ad || 'Katalogda adı bulunmayan ürün';
        var parca = [];
        if (var_('tdisi')) parca.push('transfer listesinde yok, ' + u.a + ' adet geldi');
        else if (var_('gelmedi')) parca.push(u.s + ' adet gönderildi görünüyor, hiç gelmedi');
        else if (var_('eksik') || var_('fazla') || var_('koli')) {
            var t = u.s + ' adet gönderildi, ' + u.a + ' adet geldi';
            if (var_('eksik') && u.a < u.s) t += ', ' + (u.s - u.a) + ' adet eksik';
            if (var_('fazla') && u.a > u.s) t += ', ' + (u.a - u.s) + ' adet fazla';
            parca.push(t);
        } else if (var_('hasar')) parca.push(u.a + ' adet geldi');
        if (var_('koli')) {
            var b = parseInt(s.koliB, 10), g = parseInt(s.koliG, 10);
            parca.push(b > 0 && g > 0 ? liEki(b) + ' yerine ' + liEki(g) + ' koli geldi' : 'koli içi adet farklı geldi');
        }
        if (var_('hasar')) parca.push((u.h > 0 ? u.h : 1) + ' adedi hasarlı');
        return '- ' + (u.barkod ? u.barkod + ' barkodlu ' : '') + ad + ': ' + parca.join('; ') + '.';
    }

    function otomatikMetin(p, grup, urunler) {
        var tek = urunler.length === 1;
        var tarih = tarihUzun(p.kabul || p.olusma);
        var giris = 'Merhaba,\n' + (tarih ? tarih + ' tarihli ' : '') + (p.no ? p.no + ' numaralı transferin ' : 'transferin ') +
            (p.palet ? p.palet + ' barkodlu paletinde ' : 'paletinde ') + (tek ? 'aşağıdaki ürün ' : 'aşağıdaki ürünler ');
        var bas = {
            hasar: 'hasarlı geldi:',
            irsaliye: 'sipariş adedinden farklı geldi:',
            tdisi: 'transfer listesinde olmadığı hâlde geldi:'
        }[grup];
        var son = {
            hasar: 'Hasarlı ' + (tek ? 'ürün' : 'ürünler') + ' mal kabulde hasarlı olarak işlendi, görselleri satıştan kaldırma kaydında mevcuttur.',
            irsaliye: 'Mal kabulde fiziken gelen adetler girildi.',
            tdisi: 'Gelen ' + (tek ? 'ürün' : 'ürünler') + ' mal kabulde alındı.'
        }[grup];
        return giris + bas + '\n' + urunler.map(function (u) { return satirYazi(p, u); }).join('\n') + '\n' + son + '\nBilginize, iyi çalışmalar.';
    }

    /* Ürün Barkodu alanı en çok 255 karakter (form sınırı) */
    function otomatikBarkod(urunler) {
        var l = [];
        urunler.forEach(function (u) {
            if (!u.barkod || l.indexOf(u.barkod) !== -1) return;
            var aday = l.concat([u.barkod]).join(' , ');
            if (aday.length <= 255) l.push(u.barkod);
        });
        return l.join(' , ');
    }

    function taslakAnahtari(p, grup) { return p.id + '|' + grup; }

    /* Gösterilecek taslak: otomatik değerler + kullanıcının değiştirdikleri */
    function taslak(p, grup, urunler) {
        var t = d.kayit.taslak[taslakAnahtari(p, grup)] || {};
        var oto = { aciklama: otomatikMetin(p, grup, urunler), barkod: otomatikBarkod(urunler) };
        return {
            alt: ALT_SECENEK.indexOf(t.alt) !== -1 ? t.alt : GRUPLAR[grup].alt,
            palet: t.palet != null ? t.palet : (p.palet || ''),
            transferId: t.transferId != null ? t.transferId : p.id,
            barkod: t.barkod != null ? t.barkod : oto.barkod,
            aciklama: t.aciklama != null ? t.aciklama : oto.aciklama,
            elle: t.aciklama != null || t.barkod != null || t.palet != null || t.transferId != null,
            hazir: t.hazir || 0
        };
    }

    function taslakYaz(anah, degis) {
        d.kayit.taslak[anah] = Object.assign({}, d.kayit.taslak[anah] || {}, degis);
        kayitYaz();
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------

    function bolum(id) {
        ['mkGiris', 'mkYetkiYok', 'mkIcerik'].forEach(function (x) { el(x).hidden = x !== id; });
    }

    function veriSeridi() {
        var serit = el('mkVeri');
        var g = gunVerisi();
        var baslik, alt;
        serit.classList.toggle('is-calisiyor', d.yukleniyor);
        serit.classList.toggle('is-hata', !!d.hata && !d.yukleniyor);
        if (d.yukleniyor) {
            baslik = 'Transferler kontrol ediliyor';
            alt = (d.gunGeri ? 'Dünün' : 'Bugünün') + ' paletleri ve ürünleri depo panelinden okunuyor.';
        } else if (d.hata) {
            baslik = HATA_METNI[d.hata][0];
            alt = HATA_METNI[d.hata][1];
        } else if (g) {
            var l = g.liste;
            var bitti = l.filter(function (p) { return BITTI.indexOf(p.durum) !== -1; }).length;
            var sorunlu = l.filter(sorunluMu).length;
            baslik = l.length ? (sorunlu ? sorunlu + ' palette fark var' : 'Farklı gelen ürün yok') : (d.gunGeri ? 'Dün' : 'Bugün') + ' oluşturulan transfer yok';
            alt = l.length + ' palet · ' + bitti + ' tamamlandı · ' + saat(g.zaman) + '\'de kontrol edildi';
        } else {
            baslik = 'Transferler henüz kontrol edilmedi';
            alt = 'Depo panelinden ' + (d.gunGeri ? 'dünün' : 'günün') + ' paletleri okunur, farklı gelen ürünler ayrılır.';
        }
        el('mkVeriBaslik').textContent = baslik;
        el('mkVeriAlt').textContent = alt;
        var k = el('mkKontrol');
        k.disabled = d.yukleniyor;
        k.querySelector('span').textContent = d.yukleniyor ? 'Kontrol Ediliyor' : (g ? 'Yeniden Kontrol Et' : 'Transferleri Kontrol Et');
        document.querySelectorAll('#mkGun [data-gun]').forEach(function (b) {
            b.setAttribute('aria-checked', String(Number(b.getAttribute('data-gun')) === d.gunGeri));
        });
    }

    function iskelet() {
        return '<div class="mk-palet mk-palet--iskelet" aria-hidden="true"><div class="mk-palet__bas"><i></i><i></i></div>' +
            '<div class="mk-urun"><i class="mk-gorsel"></i><span class="mk-urun__bilgi"><i></i><i></i></span></div>' +
            '<div class="mk-urun"><i class="mk-gorsel"></i><span class="mk-urun__bilgi"><i></i><i></i></span></div></div>';
    }

    function bosDurum(ikon, baslik, metin) {
        return '<div class="mk-bos"><span>' + ikon + '</span><strong>' + kacis(baslik) + '</strong><p>' + kacis(metin) + '</p></div>';
    }

    function rozetler(p) {
        var say = { eksik: 0, fazla: 0, gelmedi: 0, tdisi: 0, hasar: 0, koli: 0 };
        (p.urunler || []).forEach(function (u) { urunSecim(p, u).durum.forEach(function (k) { if (k in say) say[k]++; }); });
        return DURUMLAR.filter(function (x) { return say[x.k]; }).map(function (x) {
            return '<span class="mk-rozet mk-rozet--' + x.k + '">' + say[x.k] + ' ' + kacis(x.ad.toLocaleLowerCase('tr')) + '</span>';
        }).join('');
    }

    function urunCiz(p, u) {
        var s = urunSecim(p, u);
        var gorsel = u.gorsel ? '<img src="' + kacis(u.gorsel) + '" alt="" loading="lazy">' : IKON.kutu;
        var cipler = DURUMLAR.map(function (x) {
            var on = s.durum.indexOf(x.k) !== -1;
            return '<button type="button" class="mk-cip mk-cip--' + x.k + '" data-durum="' + x.k + '" aria-pressed="' + on + '"><i></i>' + kacis(x.ad) + '</button>';
        }).join('');
        var koli = s.durum.indexOf('koli') !== -1
            ? '<div class="mk-koli"><label><span>Beklenen</span><input type="number" min="1" max="999" inputmode="numeric" data-koli="koliB" value="' + kacis(s.koliB) + '"><em>\'li</em></label>' +
              '<label><span>Gelen</span><input type="number" min="1" max="999" inputmode="numeric" data-koli="koliG" value="' + kacis(s.koliG) + '"><em>\'li</em></label></div>'
            : '';
        var hasar = u.h > 0 ? '<span class="mk-sayi mk-sayi--hasar"><small>Hasarlı</small><b>' + u.h + '</b></span>' : '';
        return '<div class="mk-urun" data-urun="' + u.id + '">' +
            '<span class="mk-gorsel">' + gorsel + '</span>' +
            '<div class="mk-urun__bilgi">' +
                '<strong class="mk-urun__ad">' + kacis(u.ad || 'Katalogda adı bulunmayan ürün') + '</strong>' +
                (u.barkod ? '<button type="button" class="mk-barkod" data-kopya="' + kacis(u.barkod) + '" aria-label="Barkodu kopyala">' + kacis(u.barkod) + IKON.kopya + '</button>' : '<span class="mk-urun__yok">Barkod bulunamadı</span>') +
                '<div class="mk-cipler" role="group" aria-label="Ürün durumu">' + cipler + '</div>' + koli +
            '</div>' +
            '<div class="mk-sayilar">' +
                '<span class="mk-sayi"><small>Sipariş</small><b>' + u.s + '</b></span>' +
                '<span class="mk-sayi' + (u.a !== u.s ? ' mk-sayi--fark' : '') + '"><small>Alınan</small><b>' + u.a + '</b></span>' + hasar +
            '</div>' +
        '</div>';
    }

    function taslakCiz(p, grup, urunler) {
        var t = taslak(p, grup, urunler);
        var anah = taslakAnahtari(p, grup);
        var altlar = ALT_SECENEK.map(function (a) {
            return '<button type="button" role="radio" data-alt="' + kacis(a) + '" aria-checked="' + (a === t.alt) + '" title="' + kacis(a) + '">' + kacis(ALT_KISA[a]) + '</button>';
        }).join('');
        return '<div class="mk-taslak" data-taslak="' + kacis(anah) + '">' +
            '<div class="mk-taslak__bas">' +
                '<span class="mk-taslak__tur mk-taslak__tur--' + grup + '">' + kacis(GRUPLAR[grup].ad) + ' talebi</span>' +
                (t.hazir ? '<span class="mk-taslak__hazir">' + IKON.tik + saat(t.hazir) + '\'de forma aktarıldı</span>' : '') +
            '</div>' +
            '<div class="mk-taslak__alt"><span>Alt kategori</span><div class="mk-segment mk-segment--sar" role="radiogroup" aria-label="Tedarik alt kategorisi">' + altlar + '</div></div>' +
            '<div class="mk-alanlar">' +
                '<label class="mk-girdi"><span>Palet Barkodu</span><input type="text" data-alan="palet" value="' + kacis(t.palet) + '" maxlength="60"></label>' +
                '<label class="mk-girdi"><span>Transfer ID</span><input type="text" data-alan="transferId" value="' + kacis(t.transferId) + '" maxlength="24" spellcheck="false"></label>' +
                '<label class="mk-girdi mk-girdi--genis"><span>Ürün Barkodu</span><input type="text" data-alan="barkod" value="' + kacis(t.barkod) + '" maxlength="255" spellcheck="false"></label>' +
            '</div>' +
            '<label class="mk-girdi mk-girdi--metin"><span>Açıklama</span><textarea data-alan="aciklama" rows="7" maxlength="4000">' + kacis(t.aciklama) + '</textarea></label>' +
            '<div class="mk-taslak__dugmeler">' +
                '<button type="button" class="mk-dugme mk-dugme--ana" data-eylem="hazirla">' + IKON.form + 'Talep Formunda Hazırla</button>' +
                '<button type="button" class="mk-dugme" data-eylem="kopyala">' + IKON.kopya + 'Yazıyı Kopyala</button>' +
                (t.elle ? '<button type="button" class="mk-dugme mk-dugme--sade" data-eylem="sifirla">' + IKON.yenile + 'Yeniden Yaz</button>' : '') +
            '</div>' +
        '</div>';
    }

    function paletCiz(p) {
        var g = gruplar(p);
        var tur = GRUP_SIRA.filter(function (k) { return g[k] && g[k].length; });
        var bas = '<div class="mk-palet__bas">' +
            '<div class="mk-palet__kimlik"><strong>' + kacis(p.palet || 'Palet barkodu yok') + '</strong>' +
            '<span>' + kacis([p.no, p.tur, p.kabul ? saat(p.kabul) + ' kabul' : ''].filter(Boolean).join(' · ')) + '</span></div>' +
            '<div class="mk-rozetler">' + rozetler(p) + '</div></div>';
        var urunler = '<div class="mk-urunler">' + p.urunler.map(function (u) { return urunCiz(p, u); }).join('') + '</div>';
        var taslaklar = tur.length
            ? '<div class="mk-taslaklar">' + tur.map(function (k) { return taslakCiz(p, k, g[k]); }).join('') + '</div>'
            : '<p class="mk-not">Bu palette talebe girecek ürün seçili değil.</p>';
        return '<article class="mk-palet" data-palet="' + p.id + '">' + bas + urunler + taslaklar + '</article>';
    }

    function kisaSatir(p, metin) {
        return '<li class="mk-kisa"><strong>' + kacis(p.palet || p.no || 'Palet') + '</strong><span>' + kacis(p.palet ? p.no : '') + '</span><em>' + kacis(metin) + '</em></li>';
    }

    function katlanir(kimlik, baslik, sayi, icerik) {
        var acik = !!d.acik[kimlik];
        return '<section class="mk-katlanir">' +
            '<button type="button" class="mk-katlanir__bas" data-katla="' + kimlik + '" aria-expanded="' + acik + '">' +
            '<span>' + kacis(baslik) + '</span><b>' + sayi + '</b>' + IKON.ok + '</button>' +
            '<ul class="mk-kisalar"' + (acik ? '' : ' hidden') + '>' + icerik + '</ul></section>';
    }

    function govdeCiz() {
        var govde = el('mkGovde');
        var g = gunVerisi();
        if (d.yukleniyor && !g) { govde.innerHTML = iskelet() + iskelet(); return; }
        if (!g) {
            govde.innerHTML = d.hata ? '' : bosDurum(IKON.kutu, 'Henüz kontrol edilmedi', 'Mal kabul bittiğinde "Transferleri Kontrol Et"e bas. Farklı gelen her palet için talep yazısı hazırlanır.');
            return;
        }
        var l = g.liste;
        if (!l.length) {
            govde.innerHTML = bosDurum(IKON.kutu, (d.gunGeri ? 'Dün' : 'Bugün') + ' transfer yok', 'Depo panelinde bu gün oluşturulan transfer teslimatı görünmüyor.');
            return;
        }
        var sorunlu = l.filter(function (p) { return BITTI.indexOf(p.durum) !== -1 && sorunluMu(p); });
        var temiz = l.filter(function (p) { return BITTI.indexOf(p.durum) !== -1 && !sorunluMu(p) && !p.okunamadi; });
        var okunamadi = l.filter(function (p) { return p.okunamadi; });
        var bekleyen = l.filter(function (p) { return BITTI.indexOf(p.durum) === -1; });

        var h = '';
        if (sorunlu.length) h += sorunlu.map(paletCiz).join('');
        else h += bosDurum(IKON.tik, 'Farklı gelen ürün yok', 'Tamamlanan paletlerde sipariş ve alınan adetler tutuyor, hasarlı ürün yok.');
        if (okunamadi.length) h += katlanir('okunamadi', 'Ürünleri okunamayan paletler', okunamadi.length,
            okunamadi.map(function (p) { return kisaSatir(p, 'Yeniden kontrol et'); }).join(''));
        if (bekleyen.length) h += katlanir('bekleyen', 'Mal kabulü bitmemiş paletler', bekleyen.length,
            bekleyen.map(function (p) { return kisaSatir(p, DURUM_AD[p.durum] || p.durum); }).join(''));
        if (temiz.length) h += katlanir('temiz', 'Sorunsuz paletler', temiz.length,
            temiz.map(function (p) { return kisaSatir(p, (p.toplam || p.sku || 0) + ' ürün, fark yok'); }).join(''));
        govde.innerHTML = h;
    }

    function formCiz() {
        if (document.activeElement !== el('mkTelefon')) el('mkTelefon').value = d.ayar.telefon;
        if (document.activeElement !== el('mkPlaka')) el('mkPlaka').value = d.ayar.plaka;
        document.querySelectorAll('#mkDomain [data-domain]').forEach(function (b) {
            b.setAttribute('aria-checked', String(b.getAttribute('data-domain') === d.ayar.domain));
        });
    }

    function ciz() {
        veriSeridi();
        formCiz();
        govdeCiz();
    }

    /* Bir paleti yerinde yeniden çizer; odaktaki alan korunur */
    function paletYenile(paletId) {
        var g = gunVerisi();
        var p = g && g.liste.find(function (x) { return x.id === paletId; });
        var eski = document.querySelector('.mk-palet[data-palet="' + paletId + '"]');
        if (!p || !eski) { govdeCiz(); return; }
        var y = document.createElement('div');
        y.innerHTML = paletCiz(p);
        eski.replaceWith(y.firstChild);
    }

    // ------------------------------------------------------------------
    // Eylemler
    // ------------------------------------------------------------------

    function bul(hedef) {
        var kart = hedef.closest('.mk-palet');
        if (!kart) return null;
        var g = gunVerisi();
        var p = g && g.liste.find(function (x) { return x.id === kart.getAttribute('data-palet'); });
        if (!p) return null;
        var uEl = hedef.closest('[data-urun]');
        var u = uEl ? p.urunler.find(function (x) { return x.id === uEl.getAttribute('data-urun'); }) : null;
        var tEl = hedef.closest('[data-taslak]');
        var anah = tEl ? tEl.getAttribute('data-taslak') : null;
        var grup = anah ? anah.split('|')[1] : null;
        return { p: p, u: u, anah: anah, grup: grup };
    }

    async function kopyala(metin) {
        try { await navigator.clipboard.writeText(metin); return true; } catch (e) {
            var t = document.createElement('textarea');
            t.value = metin;
            t.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(t);
            t.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
            t.remove();
            return ok;
        }
    }

    function formTaslagi(b) {
        var g = gruplar(b.p)[b.grup] || [];
        var t = taslak(b.p, b.grup, g);
        return {
            alt: t.alt,
            domain: d.ayar.domain,
            telefon: d.ayar.telefon,
            palet: t.palet,
            transferId: t.transferId,
            urunBarkod: t.barkod,
            plaka: t.alt === 'Palet Kalite/Hasar Problemleri' ? d.ayar.plaka : '',
            aciklama: t.aciklama
        };
    }

    var bekleyenHazirla = null;
    async function hazirla(b) {
        var f = formTaslagi(b);
        if (!f.aciklama.trim()) { bildir('Açıklama boş.', 'hata'); return; }
        var asistan = global.JetBarkodAsistan && global.JetBarkodAsistan.durum && global.JetBarkodAsistan.durum.kurulu;
        if (!asistan) {
            var ok = await kopyala(f.aciklama);
            global.open(FORM_ADRES, '_blank', 'noopener');
            bildir(ok ? 'Asistan bulunamadı. Yazı kopyalandı; formda alanları seçip Açıklama\'ya yapıştır.' : 'Asistan bulunamadı. Form açıldı; yazıyı buradan kopyala.', 'bilgi');
            return;
        }
        clearTimeout(bekleyenHazirla && bekleyenHazirla.zaman);
        bekleyenHazirla = {
            anah: b.anah,
            paletId: b.p.id,
            zaman: setTimeout(function () {
                bekleyenHazirla = null;
                bildir('Jet Barkod Asistan yanıt vermedi. Asistan\'ı güncelleyip yeniden dene.', 'hata');
            }, 15000)
        };
        global.postMessage({ type: 'JB_TALEP_DOLDUR', taslak: f }, location.origin);
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global || e.origin !== location.origin) return;
        var m = e.data;
        if (!m || m.type !== 'JB_TALEP_DOLDUR_SONUC' || !bekleyenHazirla) return;
        var b = bekleyenHazirla;
        clearTimeout(b.zaman);
        bekleyenHazirla = null;
        if (m.ok) {
            taslakYaz(b.anah, { hazir: Date.now() });
            paletYenile(b.paletId);
            var f = d.ayar.telefon ? '' : ' Telefon numarası boş; formda yaz.';
            bildir('Talep formu yan sekmede açıldı ve dolduruluyor. Kontrol edip GÖNDER\'e sen bas.' + f, 'basari');
        } else {
            bildir(m.metin || 'Talep formu açılamadı.', 'hata');
        }
    });

    function olaylar() {
        el('mkKontrol').addEventListener('click', kontrolEt);
        el('mkGun').addEventListener('click', function (e) {
            var b = e.target.closest('[data-gun]');
            if (!b) return;
            d.gunGeri = Number(b.getAttribute('data-gun')) || 0;
            d.hata = null;
            ciz();
        });
        el('mkDomain').addEventListener('click', function (e) {
            var b = e.target.closest('[data-domain]');
            if (!b) return;
            d.ayar.domain = b.getAttribute('data-domain');
            ayarYaz();
            formCiz();
        });
        el('mkTelefon').addEventListener('input', function () { d.ayar.telefon = this.value.replace(/[^\d+ ]/g, '').slice(0, 20); ayarYaz(); });
        el('mkPlaka').addEventListener('input', function () { d.ayar.plaka = this.value.toLocaleUpperCase('tr').slice(0, 20); ayarYaz(); });
        el('mkPlaka').addEventListener('blur', function () { this.value = d.ayar.plaka; });

        var govde = el('mkGovde');
        govde.addEventListener('click', async function (e) {
            var katla = e.target.closest('[data-katla]');
            if (katla) {
                var k = katla.getAttribute('data-katla');
                d.acik[k] = !d.acik[k];
                katla.setAttribute('aria-expanded', String(d.acik[k]));
                katla.nextElementSibling.hidden = !d.acik[k];
                return;
            }
            var kopya = e.target.closest('[data-kopya]');
            if (kopya) {
                var ok = await kopyala(kopya.getAttribute('data-kopya'));
                kopya.classList.toggle('is-kopyalandi', ok);
                setTimeout(function () { kopya.classList.remove('is-kopyalandi'); }, 1200);
                return;
            }
            var b = bul(e.target);
            if (!b) return;
            var cip = e.target.closest('[data-durum]');
            if (cip && b.u) {
                var s = urunSecim(b.p, b.u);
                var k2 = cip.getAttribute('data-durum');
                var l = s.durum.slice();
                var i = l.indexOf(k2);
                if (i === -1) {
                    l.push(k2);
                    // Birbirini dışlayanlar: eksik/fazla/hiç gelmedi/transfer dışı tek seçilir
                    var tekli = ['eksik', 'fazla', 'gelmedi', 'tdisi'];
                    if (tekli.indexOf(k2) !== -1) l = l.filter(function (x) { return x === k2 || tekli.indexOf(x) === -1; });
                } else l.splice(i, 1);
                secimYaz(b.p, b.u, { durum: l });
                paletYenile(b.p.id);
                return;
            }
            var alt = e.target.closest('[data-alt]');
            if (alt && b.anah) {
                taslakYaz(b.anah, { alt: alt.getAttribute('data-alt') });
                alt.parentNode.querySelectorAll('[data-alt]').forEach(function (x) { x.setAttribute('aria-checked', String(x === alt)); });
                return;
            }
            var eylem = e.target.closest('[data-eylem]');
            if (!eylem || !b.anah) return;
            var ad = eylem.getAttribute('data-eylem');
            if (ad === 'hazirla') hazirla(b);
            else if (ad === 'kopyala') {
                var ok2 = await kopyala(formTaslagi(b).aciklama);
                bildir(ok2 ? 'Yazı kopyalandı.' : 'Kopyalanamadı; yazıyı seçip kopyala.', ok2 ? 'basari' : 'hata');
            } else if (ad === 'sifirla') {
                var t = d.kayit.taslak[b.anah] || {};
                delete t.aciklama; delete t.barkod; delete t.palet; delete t.transferId;
                kayitYaz();
                paletYenile(b.p.id);
            }
        });
        govde.addEventListener('input', function (e) {
            var b = bul(e.target);
            if (!b) return;
            var alan = e.target.getAttribute('data-alan');
            if (alan && b.anah) {
                var degis = {};
                degis[alan] = e.target.value;
                taslakYaz(b.anah, degis);
                // "Yeniden Yaz" düğmesi ilk düzenlemede belirsin; yazı yeniden çizilmez
                var kutu = e.target.closest('.mk-taslak');
                if (kutu && !kutu.querySelector('[data-eylem="sifirla"]')) {
                    kutu.querySelector('.mk-taslak__dugmeler').insertAdjacentHTML('beforeend',
                        '<button type="button" class="mk-dugme mk-dugme--sade" data-eylem="sifirla">' + IKON.yenile + 'Yeniden Yaz</button>');
                }
                return;
            }
            var koli = e.target.getAttribute('data-koli');
            if (koli && b.u) {
                var deg = {};
                deg[koli] = String(e.target.value || '').replace(/\D/g, '').slice(0, 3);
                secimYaz(b.p, b.u, deg);
                // Yazıyı tazele ama odaktaki koli girdisini bozma: yalnız taslak metinleri
                var g = gruplar(b.p);
                Object.keys(g).forEach(function (k) {
                    var kutu = document.querySelector('[data-taslak="' + taslakAnahtari(b.p, k) + '"] textarea');
                    if (kutu && (d.kayit.taslak[taslakAnahtari(b.p, k)] || {}).aciklama == null) kutu.value = otomatikMetin(b.p, k, g[k]);
                });
            }
        });
    }

    // ------------------------------------------------------------------
    // Başlangıç
    // ------------------------------------------------------------------

    async function haklariYukle() {
        var p = global.premiumFeatures;
        if (!p) return null;
        try {
            if (typeof p.init === 'function') await p.init();
            if (typeof p.loadPremiumFeatures === 'function') await p.loadPremiumFeatures();
        } catch (e) { /* sessiz */ }
        return p;
    }

    async function basla() {
        var o = null;
        try { o = (global.authUtils && global.authUtils.checkAuth()) || null; } catch (e) { o = null; }
        if (!o || !o.username) { bolum('mkGiris'); return; }
        d.kullanici = o.username;
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;
        kayitOku();
        bolum('mkIcerik');
        ciz();
        var p = await haklariYukle();
        var acik = p && HAKLAR.some(function (h) { return p.checkPremiumFeature(h); });
        if (!acik) { bolum('mkYetkiYok'); return; }
        olaylar();
        // Gün içinde sayfa açık kaldıysa gece yarısı temizlensin
        setInterval(function () {
            if (d.kayit && d.kayit.tarih !== gunAnahtari(0)) { kayitOku(); ciz(); }
        }, 60000);
    }

    global.MalKabul = { _d: d, _otomatikMetin: otomatikMetin, _liEki: liEki, _gruplar: gruplar };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
