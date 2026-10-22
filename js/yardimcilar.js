/**
 * Yardımcılar: küçük araçların giriş sayfası (/yardimcilar/)
 * ============================================================================
 *
 * Her araç kendi sayfasında yaşar; burası yalnız listeler. Araçlar gruplu
 * (Depo İşleri, Bildirimler). Hesapta açık olan araç tıklanır, kapalı olan
 * kilitli görünür. En üstte Telegram bağlantı şeridi.
 *
 * Sayfa hemen açılır: Telegram şeridi ve kartlar önce aynı boyda iskelet,
 * veri gelince içleri dolar. Şerit hiçbir durumda sonradan eklenmez ya da
 * kaldırılmaz (kayma olmasın); hak yoksa ya da okunamazsa bunu yazar.
 * Canlı durum satırları yalnız ucuz Jet Barkod çağrılarından gelir; depo
 * paneline istek gitmez. Okunamazsa satır boş kalır (yeri ayrılmış).
 * Yeni araç eklemek için GRUPLAR'a bir satır yeterli.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var TELEGRAM_HAKLARI = ['satistanKaldirma', 'itirazYazici', 'stokSayimi', 'jetBarkodAsistan'];

    var GRUPLAR = [
        {
            ad: 'Depo İşleri',
            araclar: [
                {
                    kimlik: 'kaldirma',
                    hak: 'satistanKaldirma',
                    ad: 'Satıştan Kaldırma',
                    ozet: 'Kaldırılan ürünler, sebepler, iptaller ve hasar fotoğrafları.',
                    adres: '../kaldirma/',
                    renk: 'kirmizi',
                    ikon: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'
                },
                {
                    kimlik: 'itiraz',
                    hak: 'itirazYazici',
                    ad: 'İtiraz Yazıcı',
                    ozet: 'Depo değerlendirme kayıtları için duruma uygun itiraz metni.',
                    adres: '../itiraz/',
                    renk: 'mor',
                    ikon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'
                }
            ]
        },
        {
            ad: 'Bildirimler',
            araclar: [
                {
                    kimlik: 'telegram',
                    haklar: TELEGRAM_HAKLARI,
                    ad: 'Telegram Raporları',
                    ozet: 'Zamanlı rapor, anlık bildirim ve gönderilen görselleri ayarla, önizle.',
                    adres: '../telegram/',
                    renk: 'mavi',
                    ikon: '<path d="m3.5 11.5 16-7-3 15-5.5-4.5z"/><path d="m11 15 8.5-10.5"/>'
                }
            ]
        }
    ];

    var IKON_OK = '<svg class="yrd-kart__ok" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg>';
    var IKON_KILIT = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 9V7a3.5 3.5 0 0 1 7 0v2M5 9h10v7.5H5z"/></svg>';
    var IKON_TG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 11.5 16-7-3 15-5.5-4.5z"/><path d="m11 15 8.5-10.5"/></svg>';

    function el(id) { return document.getElementById(id); }

    function kacis(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    async function istek(yol, govde) {
        var a = global.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { kod: 401, j: {} };
        try {
            var r = await a.apiFetch(yol, govde ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) } : {});
            var j = null;
            try { j = await r.json(); } catch (e) { /* gövde yok */ }
            return { kod: r.status, j: j || {} };
        } catch (e) {
            return { kod: 0, j: {} };
        }
    }

    async function haklariYukle() {
        var p = global.premiumFeatures;
        if (!p) return null;
        try {
            if (typeof p.init === 'function') await p.init();
            if (typeof p.loadPremiumFeatures === 'function') await p.loadPremiumFeatures();
        } catch (e) { /* sessiz */ }
        return p;
    }

    function acikMi(a, p) {
        if (!p) return false;
        var l = a.haklar || [a.hak];
        return l.some(function (h) { return h && p.checkPremiumFeature(h); });
    }

    function kartCiz(a, p) {
        var acik = acikMi(a, p);
        var ic = '<span class="yrd-kart__ikon yrd-kart__ikon--' + a.renk + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + a.ikon + '</svg></span>' +
            '<span class="yrd-kart__metin"><strong>' + kacis(a.ad) + '</strong><span>' + kacis(a.ozet) + '</span>' +
            '<small class="yrd-kart__canli" id="yrdCanli_' + a.kimlik + '"></small></span>' +
            (acik ? IKON_OK : '<span class="yrd-kart__kilit">' + IKON_KILIT + 'Kapalı</span>');
        if (acik) return '<a class="yrd-kart" href="' + a.adres + '">' + ic + '</a>';
        return '<div class="yrd-kart yrd-kart--kapali" aria-disabled="true" title="Hesabında kapalı">' + ic + '</div>';
    }

    function canliYaz(kimlik, metin, tur) {
        var k = el('yrdCanli_' + kimlik);
        if (!k || !metin) return;
        k.textContent = metin;
        k.className = 'yrd-kart__canli' + (tur ? ' is-' + tur : '');
    }

    var saatYazi = function (dk) { return String(Math.floor(dk / 60)).padStart(2, '0') + ':' + String(dk % 60).padStart(2, '0'); };

    function gecenSure(iso) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        var dk = Math.max(0, Math.round((Date.now() - t) / 60000));
        if (dk < 1) return 'az önce';
        if (dk < 60) return dk + ' dk önce';
        var sa = Math.round(dk / 60);
        return sa < 24 ? sa + ' saat önce' : Math.round(sa / 24) + ' gün önce';
    }

    /** Telegram şeridi ve Telegram Raporları kartının durumu */
    async function telegramDurumu(p) {
        var serit = el('yrdTelegram');
        if (!acikMi({ haklar: TELEGRAM_HAKLARI }, p)) {
            seritYaz(serit, 'kapali', 'Telegram raporları kapalı', 'Satıştan Kaldırma, İtiraz Yazıcı ya da Stok Sayımı açık hesaplarda.', '<span class="yrd-tg__dugme is-pasif">Kapalı</span>');
            return;
        }
        var c = await istek('/api/telegram-ayar');
        if (c.kod !== 200 || !c.j.ok) {
            seritYaz(serit, 'hata', 'Telegram durumu okunamadı', c.kod === 404 || c.kod === 503 ? 'Sunucu güncellemesi bekleniyor.' : 'Ayarlar sayfasından bakabilirsin.', '<a class="yrd-tg__dugme" href="../telegram/">Ayarla</a>');
            return;
        }
        var j = c.j;
        var adlar = (j.hesaplar || []).map(function (h) { return h.ad || (h.kullanici ? '@' + h.kullanici : ''); }).filter(Boolean);
        var gece = j.ayar && j.ayar.gece;
        var saatler = gece && gece.acik ? (gece.saatler || [60]).map(saatYazi).join(', ') : '';
        var bagli = (j.hesaplar || []).length > 0;
        seritYaz(serit, bagli ? 'bagli' : 'yok', bagli ? 'Telegram bağlı' : 'Telegram bağlı değil',
            bagli ? (adlar.join(', ') || j.hesaplar.length + ' hesap') + (saatler ? ' · Rapor ' + saatler : ' · Zamanlı rapor kapalı')
                : 'Raporlar ve anlık bildirimler için bir kez bağla.',
            bagli ? '<a class="yrd-tg__dugme" href="../telegram/">Ayarla</a>' : '<button type="button" class="yrd-tg__dugme yrd-tg__dugme--ana" id="yrdBagla">Bağla</button>');
        canliYaz('telegram', saatler ? 'Sonraki rapor ' + siradaki(gece.saatler) : bagli ? 'Zamanlı rapor kapalı' : 'Telegram bağlı değil', saatler ? '' : 'uyari');
    }

    /** Şeridin içi; kutu hep aynı yapıda (ikon, iki satır, düğme): boy değişmez */
    function seritYaz(serit, durum, baslik, alt, dugme) {
        serit.innerHTML = '<span class="yrd-tg__ikon">' + IKON_TG + '</span>' +
            '<span class="yrd-tg__metin"><strong>' + kacis(baslik) + '</strong><span>' + kacis(alt) + '</span></span>' + dugme;
        serit.className = 'yrd-tg is-' + durum;
        serit.removeAttribute('aria-busy');
    }

    function seritIskelet() {
        return '<span class="yrd-tg__ikon yrd-iskelet"></span>' +
            '<span class="yrd-tg__metin"><span class="yrd-iskelet" style="width:120px;height:14px"></span><span class="yrd-iskelet" style="width:200px;max-width:100%;height:12px"></span></span>' +
            '<span class="yrd-tg__dugme yrd-iskelet" aria-hidden="true"></span>';
    }

    /** Kart iskeleti: gerçek kartla aynı kutu (yrd-kart min-height) */
    function kartIskelet() {
        return '<div class="yrd-kart yrd-kart--iskelet" aria-hidden="true"><span class="yrd-kart__ikon yrd-iskelet"></span>' +
            '<span class="yrd-kart__metin"><span class="yrd-iskelet" style="width:55%;height:16px"></span>' +
            '<span class="yrd-iskelet" style="width:90%;height:12px"></span><span class="yrd-iskelet" style="width:70%;height:12px"></span></span></div>';
    }

    function listeHtml(kart) {
        return GRUPLAR.map(function (g) {
            return '<section class="yrd-grup" aria-label="' + kacis(g.ad) + '"><h2>' + kacis(g.ad) + '</h2>' +
                '<div class="yrd-grup__liste">' + g.araclar.map(kart).join('') + '</div></section>';
        }).join('');
    }

    function siradaki(saatler) {
        var p = {};
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
            .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
        var simdi = Number(p.hour) * 60 + Number(p.minute);
        var en = null;
        (saatler || [60]).forEach(function (s) {
            var kalan = (s - simdi + 1440) % 1440;
            if (en == null || kalan < en.kalan) en = { s: s, kalan: kalan };
        });
        return en ? saatYazi(en.s) : '01:00';
    }

    /** Satıştan Kaldırma: bugünkü kayıt sayısı ve son aktarım (yalnız Jet Barkod) */
    async function kaldirmaDurumu() {
        var gun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
        var c = await istek('/api/kaldirma/liste?bas=' + gun + '&son=' + gun);
        if (c.kod !== 200 || !c.j.ok) return;
        var n = Array.isArray(c.j.kayitlar) ? c.j.kayitlar.length : 0;
        var son = c.j.sonEsitleme ? 'Son aktarım ' + gecenSure(c.j.sonEsitleme) : 'Henüz aktarım yok';
        canliYaz('kaldirma', (n ? 'Bugün ' + n + ' kayıt · ' : 'Bugün kayıt yok · ') + son);
    }

    async function telegramBagla() {
        var c = await istek('/api/rapor/bagla', {});
        if (c.kod === 200 && c.j.adres) {
            global.open(c.j.adres, '_blank', 'noopener');
            if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir('Telegram açıldı. Başlat\'a basınca bu sayfayı yenile.', 'bilgi', 5000);
        } else if (global.JBDiyalog && global.JBDiyalog.bildir) {
            global.JBDiyalog.bildir('Telegram bağlantısı açılamadı. Biraz sonra tekrar dene.', 'hata', 4200);
        }
    }

    async function basla() {
        var o = null;
        try { o = (global.authUtils && global.authUtils.checkAuth()) || null; } catch (e) { o = null; }
        if (!o || !o.username) { el('yrdGiris').hidden = false; return; }
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;
        // Sayfa hemen açılır; haklar ve durumlar gelene kadar aynı boyda iskelet
        var serit = el('yrdTelegram');
        serit.innerHTML = seritIskelet();
        serit.setAttribute('aria-busy', 'true');
        el('yrdListe').innerHTML = listeHtml(kartIskelet);
        el('yrdIcerik').hidden = false;
        var p = await haklariYukle();
        el('yrdListe').innerHTML = listeHtml(function (a) { return kartCiz(a, p); });
        document.addEventListener('click', function (e) { if (e.target.closest('#yrdBagla')) telegramBagla(); });
        // Canlı satırlar arkada; sayfa onları beklemez
        telegramDurumu(p);
        if (p && p.checkPremiumFeature('satistanKaldirma')) kaldirmaDurumu();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
