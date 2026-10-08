/**
 * Sayım > Finans: Sayım Raporu (PDF ve bilgi kartı, Telegram)
 * ============================================================================
 *
 * Finans sekmesindeki kart üç pencere açıyor:
 *
 *   Gönder      Şablon seç, içeriği aç kapa, canlı önizlemeyi gör, gönder.
 *               Önizleme sunucuda gerçek üreticiyle çiziliyor (göndermeden).
 *   Belgeler    Bağlı Telegram hesapları (en fazla 5) ve gönderilen belgeler.
 *   Görüntüle   Gönderilmiş ya da önizlenen belgeyi sayfa içinde gösterir.
 *               PDF, pdf.js ile tuvale çiziliyor; Android'de de çalışıyor.
 *
 * Bütün üretim ve gönderim sunucuda (vps-api/sayim-raporu). Kullanıcı sayfayı
 * kapatsa da rapor gidiyor. Bot jetonu tarayıcıya hiç gelmiyor. Seçilen
 * şablon ve ayrıntılar hesapta saklanıyor, cihazda değil.
 *
 * Ağ: sayfa açılışında istek yok. Finans sekmesi açılınca tek durum isteği.
 * Önizleme ayar değişince 600 ms bekleyip istenir, aynı ayar ikinci kez
 * istenmez (bellekte son 12 önizleme). pdf.js yalnız ilk PDF önizlemesinde
 * yüklenir.
 * ============================================================================
 */
(function () {
    'use strict';

    var SURUM = (document.currentScript && document.currentScript.src) || '';
    var JS_KOKU = SURUM ? SURUM.replace(/sayim-rapor\.js.*$/, '') : '';
    var QR_ADRESI = JS_KOKU ? JS_KOKU + 'vendor/qrcode.min.js?v=20260828i' : '';
    var PDFJS_KOKU = JS_KOKU ? JS_KOKU + 'vendor/pdfjs/' : '';

    // ------------------------------------------------------------------
    // İkonlar (tek çizgi kalınlığı, currentColor)
    // ------------------------------------------------------------------
    function svg(ic, kalin) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (kalin || 1.8) +
            '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ic + '</svg>';
    }
    var ikon = {
        belge: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
        ucak: svg('<path d="M21.5 3.5 2.8 10.6c-.9.3-.9 1.6 0 1.9l4.6 1.6 1.7 5.3c.3.8 1.3 1 1.9.4l2.6-2.5 4.8 3.5c.7.5 1.6.1 1.8-.7l3-15.3c.2-.9-.6-1.6-1.5-1.3Z"/><path d="m7.4 14.1 11.6-8.3-8.2 9.5"/>'),
        klasor: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
        kapat: svg('<path d="M6 6l12 12M18 6 6 18"/>', 2),
        tamam: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.2),
        hata: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h0"/>', 2),
        saat: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 2),
        yenile: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
        tekrar: svg('<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5"/><path d="M20 3.5v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5"/><path d="M4 20.5v-5h5"/>'),
        goz: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
        indir: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
        cop: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
        arti: svg('<path d="M12 5v14M5 12h14"/>', 2),
        sol: svg('<path d="m15 6-6 6 6 6"/>', 2),
        sag: svg('<path d="m9 6 6 6-6 6"/>', 2),
        buyut: svg('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
        asagi: svg('<path d="m6 9 6 6 6-6"/>', 2),
        resim: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="1.8"/><path d="m21 15-4.5-4.5L7 20"/>'),
        grafik: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
        liste: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
        kisi: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
        kutu: svg('<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>'),
        para: svg('<rect x="2.5" y="6" width="19" height="12" rx="3"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>'),
        simsek: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>'),
        katman: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>'),
        ay: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
        paylas: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>'),
    };

    var HATA_METNI = {
        baglanti_yok: 'Önce bir Telegram hesabı bağlayın.',
        bot_engelli: 'Bağlı hesapların hepsinde bot engellenmiş. Hesabı yeniden bağlayın.',
        bot_hazir_degil: 'Rapor servisi şu an kapalı. Biraz sonra deneyin.',
        bekleyen_var: 'Önceki rapor hâlâ hazırlanıyor.',
        saatlik_sinir: 'Bu saat için rapor sınırı doldu. Biraz sonra deneyin.',
        gunluk_sinir: 'Bugünkü rapor sınırı doldu.',
        yogun: 'Sistem şu an yoğun. Birkaç saniye sonra deneyin.',
        tablo_bos: 'Bu tabloda ürün yok.',
        sayim_yok: 'Bu tabloda henüz sayılan ürün yok.',
        tablo_gecersiz: 'Tablo okunamadı.',
        cok_istek: 'Çok hızlı istek gönderildi, biraz bekleyin.',
        mesgul: 'Önceki önizleme hâlâ hazırlanıyor.',
        hesap_kapali: 'Hesabınız kapalı ya da süresi dolmuş.',
        indirilemedi: 'Belge Telegram\'dan alınamadı. Biraz sonra deneyin.',
        bulunamadi: 'Belge bulunamadı.',
        unauthorized: 'Oturum süresi dolmuş. Sayfayı yenileyin.',
    };

    var DURUM_ETIKETI = {
        bekliyor: ['Sırada', 'mavi', 'saat'],
        hazirlaniyor: ['Hazırlanıyor', 'mavi', 'saat'],
        gonderildi: ['Gönderildi', 'yesil', 'tamam'],
        hata: ['Gönderilemedi', 'kirmizi', 'hata'],
    };

    // ------------------------------------------------------------------
    // Şablonlar (sunucudaki ayar.js ile aynı alanlar; sunucu yine doğruluyor)
    // ------------------------------------------------------------------
    var VARSAYILAN_AYAR = {
        sablon: 'tam', bicim: 'pdf', ozet: true, grafik: true, eksik: true, fazla: true, sayilmayan: true,
        gorsel: true, fiyat: true, barkod: true, sinir: 0, kartTema: 'mavi', kartUrunler: true, not: '', alicilar: [],
    };
    var TUM = { ozet: true, grafik: true, eksik: true, fazla: true, sayilmayan: true, gorsel: true, fiyat: true, barkod: true, sinir: 0 };
    function sablon(id, ad, aciklama, ikonAd, fark) {
        return { id: id, ad: ad, aciklama: aciklama, ikon: ikonAd, ayar: Object.assign({}, TUM, { bicim: 'pdf' }, fark) };
    }
    var SABLONLAR = [
        sablon('tam', 'Tam rapor', 'Özet, grafik ve bütün listeler', 'belge', {}),
        sablon('yonetici', 'Yönetici özeti', 'Tek sayfa: özet ve grafikler', 'grafik', { eksik: false, fazla: false, sayilmayan: false }),
        sablon('eksik', 'Eksik listesi', 'Eksikler, görsel ve barkodla', 'liste', { grafik: false, fazla: false, sayilmayan: false }),
        sablon('eksikFazla', 'Eksik ve fazla', 'Sayılmayanlar hariç', 'katman', { sayilmayan: false }),
        sablon('personel', 'Personel için', 'Fiyatsız, yalnız adetler', 'kisi', { fiyat: false }),
        sablon('tedarik', 'Tedarik listesi', 'Eksikler; barkodlu, fiyatsız', 'kutu', { ozet: false, grafik: false, fazla: false, sayilmayan: false, fiyat: false }),
        sablon('kalan', 'Kalan sayım', 'Henüz sayılmayan ürünler', 'saat', { ozet: false, grafik: false, eksik: false, fazla: false, fiyat: false }),
        sablon('finans', 'Finans odaklı', 'TL etkisi en büyük 25 ürün', 'para', { sayilmayan: false, gorsel: false, sinir: 25 }),
        sablon('hizli', 'Hızlı özet', 'Görselsiz, her listeden 10', 'simsek', { grafik: false, sayilmayan: false, gorsel: false, sinir: 10 }),
        sablon('kart', 'Bilgi kartı', 'Kare görsel, paylaşmaya hazır', 'resim', { bicim: 'kart', kartTema: 'mavi', kartUrunler: true }),
        sablon('kartKoyu', 'Koyu kart', 'Koyu tema, fiyatsız', 'ay', { bicim: 'kart', kartTema: 'koyu', fiyat: false, kartUrunler: true }),
        sablon('kartRapor', 'Kart + rapor', 'Önce kart, ardından PDF', 'paylas', { bicim: 'ikisi', kartTema: 'mavi', kartUrunler: true }),
    ];
    var PDF_ALANLARI = ['ozet', 'grafik', 'eksik', 'fazla', 'sayilmayan', 'gorsel', 'barkod', 'sinir'];
    var KART_ALANLARI = ['kartTema', 'kartUrunler'];

    // ------------------------------------------------------------------
    // Durum
    // ------------------------------------------------------------------
    var d = {
        yuklendi: false, yukleniyor: null, hata: '', bot: null, hesaplar: [], azamiHesap: 5,
        sinirSn: 15, bekleBitis: 0, gonderiliyor: false, tamamAni: 0, izlenen: null, izleZaman: null, sayacZaman: null,
    };
    var g = {
        panel: null, acik: false, acan: null, ayar: Object.assign({}, VARSAYILAN_AYAR), degisti: false, kayitZaman: null,
        digerAcik: false, onTur: 'pdf', onSayfa: 1,
        on: { zaman: null, istekNo: 0, anahtar: '', durum: 'bos', hata: '', belge: null, png: null, sayfaSayisi: 0, onbellek: new Map() },
    };
    var b = { panel: null, acik: false, acan: null, ekle: false, kod: null, durumZaman: null, gecmis: null, gecmisHata: '', gecmisZaman: null };
    var izl = { panel: null, acik: false, acan: null, kaynaklar: [], secili: 0, istekNo: 0, url: null, belge: null };
    var kok = null;
    var acikPencere = 0;

    // ------------------------------------------------------------------
    // Yardımcılar
    // ------------------------------------------------------------------
    function sistem() { return window.countingSystem || null; }

    function kacir(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    var tlBicim = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function tl(n) {
        if (n === null || n === undefined || isNaN(n)) return '';
        return (n < 0 ? '−' : n > 0 ? '+' : '') + '₺' + tlBicim.format(Math.abs(n));
    }

    function tarih(s, saatli) {
        try {
            var t = new Date(s);
            var o = { day: 'numeric', month: 'long' };
            if (t.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
            if (saatli) { o.hour = '2-digit'; o.minute = '2-digit'; }
            return t.toLocaleString('tr-TR', o);
        } catch (e) { return ''; }
    }

    function bildir(metin, tur) {
        if (window.JBDiyalog && window.JBDiyalog.bildir) window.JBDiyalog.bildir(metin, tur || 'bilgi', 4200);
        else if (sistem() && sistem().showToast) sistem().showToast(metin, tur === 'basari' ? 'success' : tur === 'hata' ? 'error' : 'info');
    }

    function azaltilmisHareket() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /** JSON uç çağrısı */
    async function istek(yol, secenek) {
        var a = window.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { kod: 401, j: { error: 'unauthorized' } };
        try {
            var r = await a.apiFetch(yol, secenek || {});
            var j = null;
            try { j = await r.json(); } catch (e) { /* gövde yok */ }
            return { kod: r.status, j: j || {} };
        } catch (e) {
            return { kod: 0, j: { error: e && e.name === 'AbortError' ? 'iptal' : 'ag' } };
        }
    }

    /** İkili yanıt (PDF/PNG). Hata gövdesi JSON olabilir. */
    async function istekHam(yol, secenek) {
        var a = window.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { kod: 401, j: { error: 'unauthorized' } };
        try {
            var r = await a.apiFetch(yol, secenek || {});
            if (!r.ok) {
                var j = null;
                try { j = await r.json(); } catch (e) { /* gövde yok */ }
                return { kod: r.status, j: j || {} };
            }
            return { kod: r.status, blob: await r.blob(), j: {} };
        } catch (e) {
            return { kod: 0, j: { error: e && e.name === 'AbortError' ? 'iptal' : 'ag' } };
        }
    }

    function hataMetni(c) {
        var k = c && c.j && c.j.error;
        if (c && c.kod === 401) return HATA_METNI.unauthorized;
        if (k === 'cok_sik') return 'Çok sık gönderildi. ' + (c.j.bekleSn || 15) + ' sn sonra tekrar deneyin.';
        if (k && HATA_METNI[k]) return HATA_METNI[k];
        if (c && c.kod === 404) return 'Rapor servisi henüz güncellenmedi.';
        if (c && c.kod === 0) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
        return 'İşlem yapılamadı. Biraz sonra tekrar deneyin.';
    }

    function seciliTablo() {
        var s = sistem();
        var t = s && s.selectedFinancialTable;
        if (!t || t === 'all') return null;
        return t;
    }

    function tabloGorunenAd(t) {
        var s = sistem();
        try { return s && s.formatTableDisplayName ? s.formatTableDisplayName(t) : t; } catch (e) { return t; }
    }

    /**
     * Ekranda görünen fiyatlar sunucuya yedek olarak gidiyor: veritabanında
     * fiyatı henüz yazılmamış ürün de ekrandaki fiyatla hesaplansın diye.
     */
    function yedekFiyatlar(tablo) {
        var s = sistem();
        if (!s) return null;
        var veri = tablo === s.currentTableName && s.countingData
            ? s.countingData
            : s.cachedFullData && s.cachedFullData._tables && s.cachedFullData._tables[tablo];
        if (!veri || typeof veri !== 'object') return null;
        var out = {};
        var n = 0;
        var ids = Object.keys(veri);
        for (var i = 0; i < ids.length && n < 5000; i++) {
            var pid = ids[i];
            var ham = veri[pid];
            if (!ham || typeof ham !== 'object' || (s.isReservedCountingKey && s.isReservedCountingKey(pid))) continue;
            if (!/^[A-Za-z0-9_-]{1,64}$/.test(pid)) continue;
            var e = s._mergeEntryWithPriceCacheForFinance ? s._mergeEntryWithPriceCacheForFinance(pid, ham) : ham;
            var p = Number(e.price);
            var o = Number(e.struckPrice);
            p = p > 0 && p < 1e7 ? Math.round(p * 100) / 100 : null;
            o = o > 0 && o < 1e7 ? Math.round(o * 100) / 100 : null;
            if (p === null && o === null) continue;
            out[pid] = [p, o];
            n++;
        }
        return n ? out : null;
    }

    function etkinHesaplar() {
        return d.hesaplar.filter(function (h) { return h.durum === 'aktif'; });
    }

    function hesapAdi(h) {
        return h.ad || (h.kullaniciAdi ? '@' + h.kullaniciAdi : 'Telegram hesabı');
    }

    function dosyaAdi(tablo, uzanti) {
        var harf = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
        var kisa = String(tabloGorunenAd(tablo) || 'Tablo')
            .replace(/[çğıöşüÇĞİÖŞÜ]/g, function (h) { return harf[h]; })
            .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'Tablo';
        return 'Sayim-Raporu-' + kisa + '.' + uzanti;
    }

    // ------------------------------------------------------------------
    // Pencere altyapısı: perde, kaydırma kilidi, odak, Esc
    // ------------------------------------------------------------------
    function perdeKur(sinif, html, kapat) {
        var p = document.createElement('div');
        p.className = 'sr-perde ' + (sinif || '');
        p.hidden = true;
        p.innerHTML = html;
        document.body.appendChild(p);
        p.addEventListener('click', function (e) { if (e.target === p) kapat(); });
        p.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.stopPropagation(); kapat(); return; }
            if (e.key !== 'Tab') return;
            var odak = p.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], summary');
            if (!odak.length) return;
            if (e.shiftKey && document.activeElement === odak[0]) { e.preventDefault(); odak[odak.length - 1].focus(); }
            else if (!e.shiftKey && document.activeElement === odak[odak.length - 1]) { e.preventDefault(); odak[0].focus(); }
        });
        return p;
    }

    function perdeAc(p, odak) {
        p.hidden = false;
        acikPencere++;
        document.documentElement.classList.add('sr-kilit');
        void p.offsetWidth; // yerleşimi zorla, geçiş başlasın (kare beklemeden)
        p.classList.add('is-acik');
        if (odak) { try { odak.focus({ preventScroll: true }); } catch (e) { /* yok */ } }
    }

    function perdeKapat(p, acan, sonra) {
        p.classList.remove('is-acik');
        var bitir = function () {
            if (p.classList.contains('is-acik')) return;
            p.hidden = true;
            if (sonra) sonra();
        };
        acikPencere = Math.max(0, acikPencere - 1);
        if (!acikPencere) document.documentElement.classList.remove('sr-kilit');
        if (azaltilmisHareket()) bitir(); else setTimeout(bitir, 240);
        if (acan && document.contains(acan)) { try { acan.focus({ preventScroll: true }); } catch (e) { /* yok */ } }
    }

    // ------------------------------------------------------------------
    // Sunucu durumu
    // ------------------------------------------------------------------
    function durumYukle(zorla) {
        if (d.yukleniyor) return d.yukleniyor;
        if (d.yuklendi && !zorla) return Promise.resolve();
        d.yukleniyor = istek('/api/rapor/durum').then(function (c) {
            if (c.kod === 200 && c.j.ok) {
                d.hata = '';
                d.bot = c.j.bot || null;
                d.hesaplar = Array.isArray(c.j.hesaplar) ? c.j.hesaplar : c.j.baglanti ? [c.j.baglanti] : [];
                d.azamiHesap = c.j.azamiHesap || 5;
                if (c.j.tercih && !g.degisti) g.ayar = ayarBirlestir(c.j.tercih);
                if (c.j.sinir) {
                    d.sinirSn = c.j.sinir.araSn || 15;
                    if (c.j.sinir.kalanSn > 0) bekleBaslat(c.j.sinir.kalanSn);
                }
            } else {
                d.hata = c.kod === 404 ? 'Rapor servisi henüz kurulmadı.' : hataMetni(c);
            }
            d.yuklendi = true;
        }).finally(function () {
            d.yukleniyor = null;
            kartCiz();
            if (b.acik) hesaplarCiz();
            if (g.acik) gonderPanelCiz();
        });
        return d.yukleniyor;
    }

    function bekleBaslat(sn) {
        d.bekleBitis = Date.now() + sn * 1000;
        if (d.sayacZaman) return;
        d.sayacZaman = setInterval(function () {
            if (Date.now() >= d.bekleBitis) {
                clearInterval(d.sayacZaman);
                d.sayacZaman = null;
            }
            dugmeCiz();
        }, 1000);
    }

    function kalanSn() {
        return Math.max(0, Math.ceil((d.bekleBitis - Date.now()) / 1000));
    }

    // ------------------------------------------------------------------
    // Finans kartı
    // ------------------------------------------------------------------
    function kartKur() {
        kok = document.getElementById('sayimRaporKart');
        if (!kok) return false;
        kok.innerHTML =
            '<section class="sr-kart" aria-labelledby="srKartBaslik">' +
            '<span class="sr-kart__ikon">' + ikon.belge + '</span>' +
            '<div class="sr-kart__metin">' +
            '<h3 class="sr-kart__baslik" id="srKartBaslik">Sayım Raporu</h3>' +
            '<p class="sr-kart__satir" data-sr="durum"></p>' +
            '<p class="sr-kart__satir" data-sr="tablo"></p>' +
            '</div>' +
            '<div class="sr-kart__eylem">' +
            '<button type="button" class="sr-dugme sr-dugme--ikincil" data-sr="belgeler" aria-label="Telegram hesapları ve gönderilen belgeler">' + ikon.klasor + '<span>Belgeler</span></button>' +
            '<button type="button" class="sr-dugme sr-dugme--ana" data-sr="gonder"></button>' +
            '</div>' +
            '</section>';
        kok.querySelector('[data-sr="belgeler"]').addEventListener('click', function (e) { belgelerAc(e.currentTarget); });
        kok.querySelector('[data-sr="gonder"]').addEventListener('click', anaEylem);
        kartCiz();
        return true;
    }

    function kartCiz() {
        if (!kok || !kok.firstChild) return;
        var durumEl = kok.querySelector('[data-sr="durum"]');
        var tabloEl = kok.querySelector('[data-sr="tablo"]');
        var etkin = etkinHesaplar();
        var html;
        if (!d.yuklendi) {
            html = '<span class="sr-iskelet-metin" aria-label="Yükleniyor"></span>';
        } else if (d.hata) {
            html = '<span class="sr-nokta"></span><span>' + kacir(d.hata) + '</span>';
        } else if (!d.bot || !d.bot.hazir) {
            html = '<span class="sr-nokta"></span><span>Rapor servisi şu an kapalı.</span>';
        } else if (!d.hesaplar.length) {
            html = '<span class="sr-nokta"></span><span>PDF ve bilgi kartı Telegram\'ınıza gelir. Önce bir hesap bağlayın.</span>';
        } else if (!etkin.length) {
            html = '<span class="sr-nokta sr-nokta--sari"></span><span>Bot engellenmiş. Belgeler\'den hesabı yeniden bağlayın.</span>';
        } else {
            html = '<span class="sr-nokta sr-nokta--yesil"></span><span>Telegram: <strong>' + kacir(hesapAdi(etkin[0])) + '</strong>' +
                (etkin.length > 1 ? ' ve ' + (etkin.length - 1) + ' hesap daha' : '') + '</span>';
        }
        durumEl.innerHTML = html;
        var t = seciliTablo();
        tabloEl.innerHTML = t
            ? '<span>Tablo: <strong>' + kacir(tabloGorunenAd(t)) + '</strong></span>'
            : '<span>Rapor için yukarıdan tek bir tablo seçin.</span>';
        dugmeCiz();
    }

    /** Gönder düğmesinin hâli (kart ve gönderim penceresinde ortak) */
    function anaHal() {
        if (!d.yuklendi || d.hata || !d.bot || !d.bot.hazir) return 'kapali';
        if (!etkinHesaplar().length) return 'bagla';
        if (d.gonderiliyor) return 'gonderiliyor';
        if (Date.now() - d.tamamAni < 2400) return 'tamam';
        if (d.izlenen) return 'hazirlaniyor';
        if (kalanSn() > 0) return 'bekle';
        if (!seciliTablo()) return 'tablo-yok';
        return 'gonder';
    }

    function dugmeIcerigi(hal, gonderimde) {
        switch (hal) {
            case 'bagla': return [ikon.ucak + '<span>' + (gonderimde ? 'Önce hesap bağla' : 'Telegram\'ı bağla') + '</span>', true];
            case 'gonderiliyor': return ['<span class="sr-cark" aria-hidden="true"></span><span>Gönderiliyor</span>', false];
            case 'tamam': return [ikon.tamam + '<span>Sıraya alındı</span>', false];
            case 'hazirlaniyor': return ['<span class="sr-cark" aria-hidden="true"></span><span>Hazırlanıyor</span>', false];
            case 'bekle': return [ikon.saat + '<span>Tekrar ' + kalanSn() + ' sn</span>', false];
            case 'gonder': return [ikon.ucak + '<span>' + (gonderimde ? 'Telegram\'a gönder' : 'Rapor gönder') + '</span>', true];
            default: return [ikon.ucak + '<span>' + (gonderimde ? 'Telegram\'a gönder' : 'Rapor gönder') + '</span>', false];
        }
    }

    function dugmeYaz(btn, hal, gonderimde) {
        if (!btn) return;
        var ic = dugmeIcerigi(hal, gonderimde);
        var anahtar = hal + (hal === 'bekle' ? kalanSn() : '');
        if (btn.dataset.icerik !== anahtar) { btn.innerHTML = ic[0]; btn.dataset.icerik = anahtar; }
        btn.dataset.hal = hal;
        btn.disabled = !ic[1];
        btn.setAttribute('aria-busy', hal === 'gonderiliyor' || hal === 'hazirlaniyor' ? 'true' : 'false');
    }

    function dugmeCiz() {
        var hal = anaHal();
        if (kok) {
            // Kartta geri sayım yok: pencere açılır, sayaç gönder düğmesinde görünür
            var btn = kok.querySelector('[data-sr="gonder"]');
            var kartHal = hal === 'bekle' ? 'gonder' : hal;
            dugmeYaz(btn, kartHal, false);
            if (btn) btn.disabled = kartHal === 'kapali' || kartHal === 'tablo-yok';
        }
        if (g.acik && g.panel) dugmeYaz(g.panel.querySelector('[data-g="gonder"]'), hal, true);
    }

    function anaEylem() {
        var hal = anaHal();
        var btn = kok.querySelector('[data-sr="gonder"]');
        if (hal === 'bagla') { belgelerAc(btn, true); return; }
        if (hal === 'kapali' || hal === 'tablo-yok') return;
        gonderPanelAc(btn);
    }

    async function gonder() {
        if (anaHal() !== 'gonder') return;
        var tablo = seciliTablo();
        if (!tablo) return;
        d.gonderiliyor = true;
        dugmeCiz();
        var ayar = Object.assign({}, g.ayar);
        var c = await istek('/api/rapor/sayim', {
            method: 'POST',
            body: JSON.stringify({ tablo: tablo, fiyatlar: ayar.fiyat ? yedekFiyatlar(tablo) : null, ayar: ayar }),
        });
        d.gonderiliyor = false;
        if (c.kod === 202 && c.j.ok) {
            d.tamamAni = Date.now();
            g.degisti = false;
            bekleBaslat(d.sinirSn);
            izle(c.j.id);
            var ne = ayar.bicim === 'kart' ? 'Bilgi kartı' : ayar.bicim === 'ikisi' ? 'Kart ve rapor' : 'Rapor';
            bildir(ne + ' hazırlanıyor. Birkaç saniye içinde Telegram\'ınızda olur; sayfayı kapatabilirsiniz.', 'basari');
            setTimeout(dugmeCiz, 2500);
            gonderPanelKapat();
            if (b.acik) gecmisYukle();
        } else {
            if (c.j.error === 'cok_sik' && c.j.bekleSn) bekleBaslat(c.j.bekleSn);
            if (c.j.error === 'baglanti_yok' || c.j.error === 'bot_engelli') durumYukle(true);
            bildir(hataMetni(c), c.j.error === 'cok_sik' || c.j.error === 'bekleyen_var' ? 'uyari' : 'hata');
        }
        dugmeCiz();
    }

    /** Bırakılan isteğin sonucunu kısa süre izle; bitince haber ver */
    function izle(id) {
        d.izlenen = { id: id, bitis: Date.now() + 3 * 60 * 1000 };
        if (d.izleZaman) clearTimeout(d.izleZaman);
        var adim = async function () {
            d.izleZaman = null;
            if (!d.izlenen) return;
            if (Date.now() > d.izlenen.bitis || document.visibilityState === 'hidden') {
                d.izlenen = null; // sunucu yine gönderecek; yalnız sayfa takibi bırakıyor
                dugmeCiz();
                return;
            }
            var c = await istek('/api/rapor/gecmis');
            if (!d.izlenen) return;
            if (c.kod === 200 && c.j.ok) {
                b.gecmis = c.j.liste;
                if (b.acik) gecmisCiz();
                var is = (c.j.liste || []).find(function (x) { return x.id === d.izlenen.id; });
                if (is && is.durum === 'gonderildi') {
                    d.izlenen = null;
                    bildir(is.hata ? 'Gönderildi. ' + is.hata : 'Telegram\'a gönderildi.', is.hata ? 'uyari' : 'basari');
                } else if (is && is.durum === 'hata') {
                    d.izlenen = null;
                    bildir('Gönderilemedi: ' + (is.hata || 'bilinmeyen hata'), 'hata');
                    durumYukle(true);
                }
            }
            dugmeCiz();
            if (d.izlenen) d.izleZaman = setTimeout(adim, 2500);
        };
        d.izleZaman = setTimeout(adim, 1500);
        dugmeCiz();
    }

    // ------------------------------------------------------------------
    // Görüntüleyici: PNG/JPEG ve PDF (pdf.js)
    // ------------------------------------------------------------------
    var pdfjsYukleniyor = null;
    function pdfjs() {
        if (!pdfjsYukleniyor) {
            pdfjsYukleniyor = import(PDFJS_KOKU + 'pdf.min.mjs').then(function (lib) {
                lib.GlobalWorkerOptions.workerSrc = PDFJS_KOKU + 'pdf.worker.min.mjs';
                return lib;
            }).catch(function (e) {
                pdfjsYukleniyor = null;
                throw e;
            });
        }
        return pdfjsYukleniyor;
    }

    async function pdfAc(blob) {
        var lib = await pdfjs();
        var veri = new Uint8Array(await blob.arrayBuffer());
        return lib.getDocument({ data: veri, isEvalSupported: false, enableXfa: false }).promise;
    }

    /** Sayfayı kutu genişliğine, ekran yoğunluğunda çiz */
    async function sayfaCiz(belge, no, tuval, genislik) {
        var sayfa = await belge.getPage(no);
        var ham = sayfa.getViewport({ scale: 1 });
        var oran = Math.min(3, window.devicePixelRatio || 1);
        var olcek = (genislik / ham.width) * oran;
        var vp = sayfa.getViewport({ scale: olcek });
        tuval.width = Math.floor(vp.width);
        tuval.height = Math.floor(vp.height);
        await sayfa.render({ canvasContext: tuval.getContext('2d'), viewport: vp }).promise;
    }

    function goruntuleyiciKur() {
        if (izl.panel) return;
        izl.panel = perdeKur('sr-perde--izle',
            '<div class="sr-izle" role="dialog" aria-modal="true" aria-labelledby="srIzleBaslik">' +
            '<header class="sr-izle__bas">' +
            '<div class="sr-izle__baslik"><h2 id="srIzleBaslik"></h2><p data-i="alt"></p></div>' +
            '<div class="sr-segment sr-segment--kucuk" data-i="sekme" role="tablist" hidden></div>' +
            '<a class="sr-ikon-dugme sr-ikon-dugme--acik" data-i="indir" aria-label="İndir" title="İndir">' + ikon.indir + '</a>' +
            '<button type="button" class="sr-ikon-dugme sr-ikon-dugme--acik" data-i="kapat" aria-label="Kapat">' + ikon.kapat + '</button>' +
            '</header>' +
            '<div class="sr-izle__govde" data-i="govde"></div>' +
            '<footer class="sr-izle__ayak" data-i="ayak" hidden></footer>' +
            '</div>',
            goruntuleyiciKapat);
        izl.panel.addEventListener('click', function (e) {
            var h = e.target.closest('[data-i], [data-sekme]');
            if (!h) return;
            if (h.getAttribute('data-i') === 'kapat') return goruntuleyiciKapat();
            if (h.hasAttribute('data-sekme')) {
                izl.secili = Number(h.getAttribute('data-sekme'));
                goruntuleyiciCiz();
            }
        });
    }

    /**
     * @param {{baslik:string, alt?:string, kaynaklar:Array<{ad:string, tur:'pdf'|'resim', dosya:string, getir:()=>Promise<Blob>}>,
     *          ayak?:{metin:string, eylem:()=>void}}} secenek
     */
    function goruntuleyiciAc(secenek, acan) {
        goruntuleyiciKur();
        izl.kaynaklar = secenek.kaynaklar || [];
        izl.secili = 0;
        izl.acan = acan || null;
        izl.panel.querySelector('#srIzleBaslik').textContent = secenek.baslik || 'Belge';
        izl.panel.querySelector('[data-i="alt"]').textContent = secenek.alt || '';
        var ayak = izl.panel.querySelector('[data-i="ayak"]');
        if (secenek.ayak) {
            ayak.hidden = false;
            ayak.innerHTML = '<button type="button" class="sr-dugme sr-dugme--ikincil" data-i="ayak-eylem">' + ikon.tekrar + '<span>' + kacir(secenek.ayak.metin) + '</span></button>';
            ayak.querySelector('[data-i="ayak-eylem"]').onclick = secenek.ayak.eylem;
        } else {
            ayak.hidden = true;
            ayak.innerHTML = '';
        }
        if (!izl.acik) {
            izl.acik = true;
            perdeAc(izl.panel, izl.panel.querySelector('[data-i="kapat"]'));
        }
        goruntuleyiciCiz();
    }

    function goruntuleyiciKapat() {
        if (!izl.acik) return;
        izl.acik = false;
        izl.istekNo++;
        perdeKapat(izl.panel, izl.acan, function () {
            izl.panel.querySelector('[data-i="govde"]').innerHTML = '';
            if (izl.url) { URL.revokeObjectURL(izl.url); izl.url = null; }
            if (izl.belge) { try { izl.belge.destroy(); } catch (e) { /* yok */ } izl.belge = null; }
        });
    }

    async function goruntuleyiciCiz() {
        var no = ++izl.istekNo;
        var sekme = izl.panel.querySelector('[data-i="sekme"]');
        sekme.hidden = izl.kaynaklar.length < 2;
        sekme.innerHTML = izl.kaynaklar.map(function (k, i) {
            return '<button type="button" role="tab" aria-selected="' + (i === izl.secili) + '" aria-checked="' + (i === izl.secili) + '" data-sekme="' + i + '">' + kacir(k.ad) + '</button>';
        }).join('');
        var govde = izl.panel.querySelector('[data-i="govde"]');
        var indir = izl.panel.querySelector('[data-i="indir"]');
        indir.removeAttribute('href');
        indir.classList.add('is-kapali');
        govde.innerHTML = '<div class="sr-izle__durum"><span class="sr-cark sr-cark--koyu" aria-hidden="true"></span><p>Belge hazırlanıyor</p></div>';
        if (izl.url) { URL.revokeObjectURL(izl.url); izl.url = null; }
        if (izl.belge) { try { izl.belge.destroy(); } catch (e) { /* yok */ } izl.belge = null; }

        var k = izl.kaynaklar[izl.secili];
        if (!k) return;
        var sonuc;
        try { sonuc = await k.getir(); } catch (e) { sonuc = { hata: hataMetni({ kod: 0, j: {} }) }; }
        if (no !== izl.istekNo) return;
        if (!sonuc || !sonuc.blob) {
            govde.innerHTML = '<div class="sr-izle__durum"><span class="sr-izle__hata">' + ikon.hata + '</span><p>' + kacir((sonuc && sonuc.hata) || 'Belge açılamadı.') + '</p>' +
                '<button type="button" class="sr-dugme sr-dugme--ikincil" data-i="yeniden">Tekrar dene</button></div>';
            govde.querySelector('[data-i="yeniden"]').onclick = goruntuleyiciCiz;
            return;
        }
        izl.url = URL.createObjectURL(sonuc.blob);
        indir.href = izl.url;
        indir.setAttribute('download', k.dosya || 'belge');
        indir.classList.remove('is-kapali');

        if (k.tur === 'resim') {
            govde.innerHTML = '<img class="sr-izle__resim" alt="' + kacir(k.ad) + '" src="' + izl.url + '">';
            return;
        }
        try {
            var belge = await pdfAc(sonuc.blob);
            if (no !== izl.istekNo) { belge.destroy(); return; }
            izl.belge = belge;
            govde.innerHTML = '';
            var genislik = Math.min(860, govde.clientWidth - 32);
            for (var s = 1; s <= belge.numPages; s++) {
                var kutu = document.createElement('div');
                kutu.className = 'sr-izle__sayfa';
                kutu.style.width = genislik + 'px';
                kutu.style.aspectRatio = '210 / 297';
                var tuval = document.createElement('canvas');
                tuval.setAttribute('aria-label', 'Sayfa ' + s);
                kutu.appendChild(tuval);
                govde.appendChild(kutu);
                await sayfaCiz(belge, s, tuval, genislik);
                if (no !== izl.istekNo) return;
            }
        } catch (e) {
            if (no !== izl.istekNo) return;
            govde.innerHTML = '<div class="sr-izle__durum"><span class="sr-izle__hata">' + ikon.hata + '</span><p>PDF bu tarayıcıda gösterilemedi. Sağ üstten indirebilirsiniz.</p></div>';
        }
    }

    // ------------------------------------------------------------------
    // Belgeler penceresi: Telegram hesapları + gönderilen belgeler
    // ------------------------------------------------------------------
    function belgelerKur() {
        if (b.panel) return;
        b.panel = perdeKur('',
            '<div class="sr-panel" role="dialog" aria-modal="true" aria-labelledby="srBelgeBaslik">' +
            '<header class="sr-panel__bas">' +
            '<h2 class="sr-panel__baslik" id="srBelgeBaslik">Sayım Raporu</h2>' +
            '<button type="button" class="sr-ikon-dugme" data-b="kapat" aria-label="Kapat">' + ikon.kapat + '</button>' +
            '</header>' +
            '<div class="sr-panel__govde">' +
            '<section class="sr-bolum"><div class="sr-bolum__ust"><h3 class="sr-bolum__baslik">Telegram Hesapları</h3><span class="sr-bolum__sayi" data-b="sayi"></span></div>' +
            '<div data-b="hesaplar"></div></section>' +
            '<section class="sr-bolum"><div class="sr-bolum__ust"><h3 class="sr-bolum__baslik">Gönderilen Belgeler</h3>' +
            '<button type="button" class="sr-ikon-dugme" data-b="yenile" aria-label="Listeyi yenile">' + ikon.yenile + '</button></div>' +
            '<div data-b="gecmis" aria-live="polite"></div></section>' +
            '<p class="sr-dipnot">Rapor A4 PDF (en fazla 4 sayfa) ya da kare bilgi kartı olarak gelir; içeriği gönderirken seçersiniz. ' +
            'Bir hesaba en fazla ' + d.azamiHesap + ' Telegram hesabı bağlanabilir, rapor seçtiğiniz hepsine gider. ' +
            'Sayılmayan ürün eksik sayılmaz. İki gönderim arasında 15 saniye beklenir.</p>' +
            '</div></div>',
            belgelerKapat);

        b.panel.addEventListener('click', function (e) {
            var h = e.target.closest('[data-b]');
            if (!h) return;
            var ne = h.getAttribute('data-b');
            if (ne === 'kapat') belgelerKapat();
            else if (ne === 'yenile') gecmisYukle();
            else if (ne === 'ekle') { b.ekle = true; hesaplarCiz(); kodHazirla(); }
            else if (ne === 'vazgec') { b.ekle = false; durumYoklaDur(); hesaplarCiz(); }
            else if (ne === 'kaldir') hesapKaldir(h.getAttribute('data-hesap'));
            else if (ne === 'yenikod') { b.kod = null; hesaplarCiz(); kodHazirla(); }
            else if (ne === 'goruntule') belgeGoruntule(h.getAttribute('data-id'), h);
            else if (ne === 'gecmis-tekrar') gecmisYukle();
        });
    }

    function belgelerAc(acan, ekle) {
        belgelerKur();
        if (b.acik) return;
        b.acik = true;
        b.acan = acan || null;
        b.ekle = !!ekle;
        perdeAc(b.panel, b.panel.querySelector('[data-b="kapat"]'));
        hesaplarCiz();
        durumYukle(true).then(function () {
            if (!b.acik) return;
            if (!d.hesaplar.length) b.ekle = true;
            hesaplarCiz();
            if (b.ekle) kodHazirla();
        });
        gecmisYukle();
    }

    function belgelerKapat() {
        if (!b.acik) return;
        b.acik = false;
        durumYoklaDur();
        if (b.gecmisZaman) { clearTimeout(b.gecmisZaman); b.gecmisZaman = null; }
        perdeKapat(b.panel, b.acan);
    }

    function hesaplarCiz() {
        if (!b.panel) return;
        var yer = b.panel.querySelector('[data-b="hesaplar"]');
        var sayi = b.panel.querySelector('[data-b="sayi"]');
        sayi.textContent = d.yuklendi && d.hesaplar.length ? d.hesaplar.length + ' / ' + d.azamiHesap : '';
        if (!d.yuklendi) {
            yer.innerHTML = '<div class="sr-hesap"><span class="sr-avatar" aria-hidden="true"></span><div class="sr-hesap__metin"><span class="sr-iskelet-metin"></span></div></div>';
            return;
        }
        if (d.hata || !d.bot || !d.bot.hazir) {
            yer.innerHTML = '<div class="sr-bos"><strong>Rapor servisi şu an kapalı</strong><span>' +
                kacir(d.hata || 'Telegram botu henüz ayarlanmadı.') + '</span></div>';
            return;
        }
        var liste = d.hesaplar.map(function (h) {
            var ad = hesapAdi(h);
            var engelli = h.durum !== 'aktif';
            return '<li class="sr-hesap">' +
                '<span class="sr-avatar" aria-hidden="true">' + kacir((ad.replace('@', '').trim()[0] || 'T').toLocaleUpperCase('tr')) + '</span>' +
                '<div class="sr-hesap__metin"><strong>' + kacir(ad) + '</strong>' +
                '<span>' + (h.kullaniciAdi && h.ad ? '@' + kacir(h.kullaniciAdi) + ' · ' : '') + 'ID <code>' + kacir(h.id) + '</code></span>' +
                '<span>' + (engelli ? 'Bot engellenmiş, yeniden bağlayın' : kacir(tarih(h.baglandi)) + ' tarihinde bağlandı') + '</span></div>' +
                (engelli ? '<span class="sr-rozet sr-rozet--sari">' + ikon.hata + 'Engelli</span>' : '<span class="sr-rozet sr-rozet--yesil">' + ikon.tamam + 'Bağlı</span>') +
                '<button type="button" class="sr-ikon-dugme" data-b="kaldir" data-hesap="' + kacir(h.hesap || '') + '" aria-label="' + kacir(ad + ' bağlantısını kaldır') + '" title="Bağlantıyı kaldır">' + ikon.cop + '</button>' +
                '</li>';
        }).join('');
        var html = liste ? '<ul class="sr-hesaplar">' + liste + '</ul>' : '';

        if (!b.ekle) {
            var dolu = d.hesaplar.length >= d.azamiHesap;
            html += '<button type="button" class="sr-dugme sr-dugme--ikincil sr-dugme--genis" data-b="ekle"' + (dolu ? ' disabled' : '') + '>' + ikon.arti +
                '<span>' + (dolu ? 'En fazla ' + d.azamiHesap + ' hesap bağlanabilir' : d.hesaplar.length ? 'Başka hesap ekle' : 'Telegram hesabı bağla') + '</span></button>';
            yer.innerHTML = html;
            return;
        }
        html += baglamaHtml();
        yer.innerHTML = html;
        var masaustu = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (masaustu && b.kod && b.kod.adres && Date.now() < b.kod.bitis) qrCiz(yer.querySelector('[data-sr-qr]'), b.kod.adres);
    }

    function baglamaHtml() {
        var kod = b.kod;
        var masaustu = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        var gecerli = kod && kod.adres && Date.now() < kod.bitis;
        var dugme;
        if (gecerli) dugme = '<a class="sr-dugme sr-dugme--tg" href="' + kacir(kod.adres) + '" target="_blank" rel="noopener noreferrer">' + ikon.ucak + '<span>Telegram\'ı aç</span></a>';
        else if (kod && kod.hata) dugme = '<button type="button" class="sr-dugme sr-dugme--ikincil" data-b="yenikod">Yeniden dene</button>';
        else if (kod) dugme = '<button type="button" class="sr-dugme sr-dugme--ikincil" data-b="yenikod">Süresi doldu · Yenile</button>';
        else dugme = '<button type="button" class="sr-dugme sr-dugme--tg" disabled><span class="sr-cark" aria-hidden="true"></span><span>Hazırlanıyor</span></button>';
        var not = kod && kod.hata
            ? '<p class="sr-bagla__not"><span>' + kacir(kod.hata) + '</span></p>'
            : gecerli
                ? '<p class="sr-bagla__not" role="status"><span class="sr-bekle-nokta" aria-hidden="true"></span><span>Onay bekleniyor · bağlantı 10 dk geçerli</span></p>'
                : '<p class="sr-bagla__not"><span>Bağlantı hazırlanıyor</span></p>';
        return '<div class="sr-bagla-kutu">' +
            '<ol class="sr-adimlar">' +
            '<li><span class="sr-adim__no">1</span><div><strong>Telegram\'ı açın</strong><span>Aşağıdaki düğme Jet Barkod botunu açar' + (masaustu ? '; telefondaysanız kodu kamerayla okutun' : '') + '.</span></div></li>' +
            '<li><span class="sr-adim__no">2</span><div><strong>Başlat\'a basın</strong><span>Sohbetin altındaki Başlat (Start) düğmesine dokunun.</span></div></li>' +
            '<li><span class="sr-adim__no">3</span><div><strong>Hepsi bu</strong><span>Hesap bu listeye kendiliğinden eklenir. Kimlik numarası aramanız gerekmez.</span></div></li>' +
            '</ol>' +
            '<div class="sr-bagla"><div class="sr-bagla__ust">' + dugme +
            (masaustu ? '<div class="sr-qr" data-sr-qr aria-label="Telegram bağlantısının karekodu" role="img"></div>' : '') +
            '</div>' + not + '</div>' +
            (d.hesaplar.length ? '<button type="button" class="sr-dugme sr-dugme--metin" data-b="vazgec">Vazgeç</button>' : '') +
            '</div>';
    }

    async function kodHazirla() {
        if (b.kod && b.kod.adres && Date.now() < b.kod.bitis - 60000) { durumYoklaBaslat(); return; }
        b.kod = null;
        hesaplarCiz();
        var c = await istek('/api/rapor/bagla', { method: 'POST' });
        if (!b.acik) return;
        if (c.kod === 200 && c.j.ok && c.j.adres) {
            b.kod = { adres: c.j.adres, bitis: Number(c.j.bitis) || Date.now() + 600000 };
            durumYoklaBaslat();
        } else {
            b.kod = { hata: c.j.error === 'cok_istek' ? 'Çok sık bağlantı istendi. Birkaç dakika sonra deneyin.' : hataMetni(c) };
        }
        hesaplarCiz();
    }

    /** Bağlama sürerken durumu sor: Başlat'a basıldığı an hesap listeye düşsün */
    function durumYoklaBaslat() {
        durumYoklaDur();
        var imza = function (liste) { return liste.map(function (h) { return h.hesap + '|' + h.durum + '|' + h.baglandi; }).join(','); };
        var onceki = imza(d.hesaplar);
        var adim = async function () {
            b.durumZaman = null;
            if (!b.acik || !b.ekle) return;
            if (b.kod && b.kod.bitis && Date.now() >= b.kod.bitis) { hesaplarCiz(); return; }
            if (document.visibilityState === 'visible') {
                var c = await istek('/api/rapor/durum');
                if (c.kod === 200 && c.j.ok && Array.isArray(c.j.hesaplar) && imza(c.j.hesaplar) !== onceki) {
                    var yeni = c.j.hesaplar.filter(function (h) {
                        return !d.hesaplar.some(function (e) { return e.hesap === h.hesap && e.baglandi === h.baglandi; });
                    })[0];
                    d.hesaplar = c.j.hesaplar;
                    b.ekle = false;
                    b.kod = null;
                    hesaplarCiz();
                    kartCiz();
                    if (g.acik) gonderPanelCiz();
                    bildir('Telegram bağlandı: ' + (yeni ? hesapAdi(yeni) : 'yeni hesap') + '.', 'basari');
                    return;
                }
            }
            if (b.acik) b.durumZaman = setTimeout(adim, 2500);
        };
        b.durumZaman = setTimeout(adim, 2500);
    }

    function durumYoklaDur() {
        if (b.durumZaman) { clearTimeout(b.durumZaman); b.durumZaman = null; }
    }

    async function hesapKaldir(hesap) {
        var h = d.hesaplar.find(function (x) { return x.hesap === hesap; });
        if (!h) return;
        var tamam = window.JBDiyalog && window.JBDiyalog.onay
            ? await window.JBDiyalog.onay(hesapAdi(h) + ' hesabına artık rapor gönderilmez. İstediğiniz zaman yeniden bağlayabilirsiniz.', {
                baslik: 'Bağlantı kaldırılsın mı?', tehlikeli: true, onayYazi: 'Kaldır', vazgecYazi: 'Vazgeç',
            })
            : window.confirm('Telegram bağlantısı kaldırılsın mı?');
        if (!tamam) return;
        var c = await istek('/api/rapor/bagla/' + encodeURIComponent(hesap), { method: 'DELETE' });
        if (c.kod === 200 && c.j.ok) {
            d.hesaplar = d.hesaplar.filter(function (x) { return x.hesap !== hesap; });
            if (Array.isArray(g.ayar.alicilar)) g.ayar.alicilar = g.ayar.alicilar.filter(function (x) { return x !== hesap; });
            if (!d.hesaplar.length) { b.ekle = true; kodHazirla(); }
            hesaplarCiz();
            kartCiz();
            bildir('Telegram bağlantısı kaldırıldı.', 'bilgi');
        } else {
            bildir(hataMetni(c), 'hata');
        }
    }

    var qrYukleniyor = null;
    function qrKutuphanesi() {
        if (window.QRCode) return Promise.resolve(true);
        if (!QR_ADRESI) return Promise.resolve(false);
        if (!qrYukleniyor) {
            qrYukleniyor = new Promise(function (coz) {
                var s = document.createElement('script');
                s.src = QR_ADRESI;
                s.async = true;
                s.onload = function () { coz(!!window.QRCode); };
                s.onerror = function () { qrYukleniyor = null; coz(false); };
                document.head.appendChild(s);
            });
        }
        return qrYukleniyor;
    }

    function qrCiz(kutu, adres) {
        if (!kutu) return;
        qrKutuphanesi().then(function (hazir) {
            // Kutu yerini hep koruyor; çizilemezse boş kalıyor, yerleşim oynamıyor
            if (!hazir || !kutu.isConnected) return;
            kutu.innerHTML = '';
            try {
                new window.QRCode(kutu, { text: adres, width: 168, height: 168, correctLevel: window.QRCode.CorrectLevel.M });
                kutu.removeAttribute('title');
                kutu.classList.add('is-hazir');
            } catch (e) { /* boş kutu kalır */ }
        });
    }

    // ---- Gönderilen belgeler ------------------------------------------
    async function gecmisYukle() {
        if (!b.panel) return;
        if (!b.gecmis) gecmisCiz();
        var c = await istek('/api/rapor/gecmis');
        if (c.kod === 200 && c.j.ok) {
            b.gecmis = c.j.liste || [];
            b.gecmisHata = '';
        } else {
            b.gecmisHata = c.kod === 404 ? 'Rapor servisi henüz kurulmadı.' : hataMetni(c);
        }
        gecmisCiz();
        if (b.gecmisZaman) clearTimeout(b.gecmisZaman);
        var bekleyen = (b.gecmis || []).some(function (x) { return x.durum === 'bekliyor' || x.durum === 'hazirlaniyor'; });
        if (b.acik && bekleyen && !d.izlenen) b.gecmisZaman = setTimeout(gecmisYukle, 3000);
    }

    function gecmisCiz() {
        if (!b.panel) return;
        var yer = b.panel.querySelector('[data-b="gecmis"]');
        var liste = b.gecmis;
        if (!liste && b.gecmisHata) {
            yer.innerHTML = '<div class="sr-bos"><strong>Liste alınamadı</strong><span>' + kacir(b.gecmisHata) +
                '</span><button type="button" class="sr-dugme sr-dugme--ikincil" data-b="gecmis-tekrar">Yeniden dene</button></div>';
            return;
        }
        if (!liste) {
            var isk = '';
            for (var i = 0; i < 3; i++) isk += '<li class="sr-satir sr-satir--iskelet"><span class="sr-satir__ikon"></span><div class="sr-satir__metin"><strong></strong><span></span></div></li>';
            yer.innerHTML = '<ul class="sr-liste" aria-label="Yükleniyor">' + isk + '</ul>';
            return;
        }
        if (!liste.length) {
            yer.innerHTML = '<div class="sr-bos"><strong>Henüz rapor gönderilmedi</strong><span>Finans ekranında bir tablo seçip "Rapor gönder"e bastığınızda burada görünür.</span></div>';
            return;
        }
        yer.innerHTML = '<ul class="sr-liste">' + liste.map(function (x) {
            var et = DURUM_ETIKETI[x.durum] || DURUM_ETIKETI.bekliyor;
            var ikonSinif = x.durum === 'gonderildi' ? 'gonderildi' : x.durum === 'hata' ? 'hata' : 'bekliyor';
            var ozet = [x.bicim === 'kart' ? 'Bilgi kartı' : x.bicim === 'ikisi' ? 'Kart + PDF' : 'PDF'];
            if (x.ozet && x.ozet.fiyatli !== false && x.ozet.net !== undefined && x.ozet.net !== null) {
                var sinif = x.ozet.net < 0 ? 'sr-satir__eksi' : x.ozet.net > 0 ? 'sr-satir__arti' : '';
                ozet.push('Net <b class="' + sinif + '">' + kacir(tl(x.ozet.net) || '₺0,00') + '</b>');
            }
            if (x.sayfa) ozet.push(x.sayfa + ' sayfa');
            var gorulur = x.belge && (x.belge.pdf || x.belge.kart);
            return '<li class="sr-satir">' +
                '<span class="sr-satir__ikon sr-satir__ikon--' + ikonSinif + '">' + ikon[et[2]] + '</span>' +
                '<div class="sr-satir__metin">' +
                '<strong>' + kacir(x.tabloAd || x.tablo) + '</strong>' +
                '<span>' + ozet.join(' · ') + '</span>' +
                '<span><b class="sr-satir__durum sr-satir__durum--' + et[1] + '">' + kacir(et[0]) + '</b> · ' + kacir(tarih(x.gonderildi || x.istendi, true)) + '</span>' +
                (x.hata ? '<span class="sr-satir__hata">' + kacir(x.hata) + '</span>' : '') +
                '</div>' +
                (gorulur
                    ? '<button type="button" class="sr-ikon-dugme" data-b="goruntule" data-id="' + kacir(x.id) + '" aria-label="' + kacir((x.tabloAd || x.tablo) + ' belgesini görüntüle') + '" title="Görüntüle">' + ikon.goz + '</button>'
                    : '') +
                '</li>';
        }).join('') + '</ul>';
    }

    function belgeGoruntule(id, acan) {
        var x = (b.gecmis || []).find(function (y) { return y.id === id; });
        if (!x || !x.belge) return;
        var kaynaklar = [];
        var getir = function (tur) {
            return async function () {
                var c = await istekHam('/api/rapor/belge/' + encodeURIComponent(id) + '/' + tur);
                return c.blob ? { blob: c.blob } : { hata: hataMetni(c) };
            };
        };
        if (x.belge.kart) kaynaklar.push({ ad: 'Bilgi kartı', tur: 'resim', dosya: dosyaAdi(x.tablo, 'jpg'), getir: getir('kart') });
        if (x.belge.pdf) kaynaklar.push({ ad: 'PDF rapor', tur: 'pdf', dosya: dosyaAdi(x.tablo, 'pdf'), getir: getir('pdf') });
        goruntuleyiciAc({
            baslik: x.tabloAd || x.tablo,
            alt: (x.bicim === 'kart' ? 'Bilgi kartı' : x.bicim === 'ikisi' ? 'Kart + PDF' : 'PDF rapor') + ' · ' + tarih(x.gonderildi || x.istendi, true),
            kaynaklar: kaynaklar,
            ayak: x.tekrar ? { metin: 'Telegram\'a tekrar gönder', eylem: function () { tekrarGonder(id); } } : null,
        }, acan);
    }

    async function tekrarGonder(id) {
        var c = await istek('/api/rapor/gecmis/' + encodeURIComponent(id) + '/tekrar', { method: 'POST' });
        if (c.kod === 202 && c.j.ok) {
            bekleBaslat(d.sinirSn);
            izle(c.j.id);
            bildir('Belge Telegram\'a yeniden gönderiliyor.', 'basari');
            goruntuleyiciKapat();
            gecmisYukle();
        } else {
            if (c.j.error === 'cok_sik' && c.j.bekleSn) bekleBaslat(c.j.bekleSn);
            bildir(hataMetni(c), c.j.error === 'cok_sik' ? 'uyari' : 'hata');
        }
    }

    // ------------------------------------------------------------------
    // Gönderim penceresi: şablon, içerik, önizleme
    // ------------------------------------------------------------------
    function ayarBirlestir(ham) {
        var a = Object.assign({}, VARSAYILAN_AYAR);
        if (!ham || typeof ham !== 'object') return a;
        Object.keys(VARSAYILAN_AYAR).forEach(function (k) {
            if (k === 'alicilar') { if (Array.isArray(ham.alicilar)) a.alicilar = ham.alicilar.slice(0, 5); return; }
            if (ham[k] !== undefined && typeof ham[k] === typeof VARSAYILAN_AYAR[k]) a[k] = ham[k];
        });
        return a;
    }

    /** Ayarın birebir uyduğu şablon; yoksa 'ozel' */
    function sablonBul(a) {
        for (var i = 0; i < SABLONLAR.length; i++) {
            var sa = Object.assign({}, VARSAYILAN_AYAR, SABLONLAR[i].ayar);
            if (sa.bicim !== a.bicim) continue;
            var alanlar = ['fiyat'].concat(a.bicim !== 'kart' ? PDF_ALANLARI : []).concat(a.bicim !== 'pdf' ? KART_ALANLARI : []);
            if (alanlar.every(function (k) { return sa[k] === a[k]; })) return SABLONLAR[i].id;
        }
        return 'ozel';
    }

    function tercihKaydetGecikmeli() {
        if (g.kayitZaman) clearTimeout(g.kayitZaman);
        g.kayitZaman = setTimeout(function () {
            g.kayitZaman = null;
            istek('/api/rapor/tercih', { method: 'PUT', body: JSON.stringify({ ayar: g.ayar }) });
        }, 900);
    }

    function ayarDegistir(degisim) {
        Object.assign(g.ayar, degisim);
        g.ayar.sablon = sablonBul(g.ayar);
        g.degisti = true;
        if (g.ayar.bicim === 'kart') g.onTur = 'kart';
        else if (g.ayar.bicim === 'pdf') g.onTur = 'pdf';
        gonderPanelCiz();
        tercihKaydetGecikmeli();
        onizlemeIste();
    }

    function cip(ad, etiket, acik, kapali) {
        return '<button type="button" class="sr-cip" role="switch" aria-checked="' + !!acik + '" data-ayar="' + ad + '"' + (kapali ? ' disabled' : '') + '>' +
            '<span class="sr-cip__isaret" aria-hidden="true">' + (acik ? ikon.tamam : ikon.arti) + '</span>' + kacir(etiket) + '</button>';
    }

    function segment(ad, secenekler, deger, etiket, ekSinif) {
        return '<div class="sr-segment ' + (ekSinif || '') + '" role="radiogroup" aria-label="' + kacir(etiket) + '">' +
            secenekler.map(function (o) {
                return '<button type="button" role="radio" aria-checked="' + (o[0] === deger) + '" data-ayar="' + ad + '" data-deger="' + kacir(String(o[0])) + '">' + kacir(o[1]) + '</button>';
            }).join('') + '</div>';
    }

    function gonderPanelKur() {
        if (g.panel) return;
        g.panel = perdeKur('sr-perde--gonder',
            '<div class="sr-panel sr-panel--gonder" role="dialog" aria-modal="true" aria-labelledby="srGonderBaslik">' +
            '<header class="sr-panel__bas"><div class="sr-panel__bas-metin">' +
            '<h2 class="sr-panel__baslik" id="srGonderBaslik">Rapor Gönder</h2>' +
            '<p class="sr-panel__alt" data-g="tablo"></p></div>' +
            '<button type="button" class="sr-ikon-dugme" data-g="kapat" aria-label="Kapat">' + ikon.kapat + '</button></header>' +
            '<div class="sr-gonder">' +
            '<div class="sr-onizleme" data-g="onizleme">' +
            '<div class="sr-onizleme__ust"><span class="sr-onizleme__etiket">Önizleme</span><div data-g="on-sekme"></div>' +
            '<div class="sr-onizleme__sayfa" data-g="on-sayfa"></div>' +
            '<button type="button" class="sr-ikon-dugme" data-g="buyut" aria-label="Önizlemeyi büyüt" title="Büyüt">' + ikon.buyut + '</button></div>' +
            '<div class="sr-onizleme__cerceve" data-g="on-cerceve"><div class="sr-onizleme__kagit" data-g="on-kagit"></div></div>' +
            '</div>' +
            '<div class="sr-gonder__ayar" data-g="govde"></div>' +
            '</div>' +
            '<footer class="sr-panel__ayak"><p class="sr-ayak__ozet" data-g="ozet"></p>' +
            '<button type="button" class="sr-dugme sr-dugme--ana" data-g="gonder"></button></footer>' +
            '</div>',
            gonderPanelKapat);

        g.panel.addEventListener('click', function (e) {
            var h = e.target.closest('[data-g], [data-sablon], button[data-ayar], [data-on-tur], [data-alici]');
            if (!h) return;
            var ne = h.getAttribute('data-g');
            if (ne === 'kapat') return gonderPanelKapat();
            if (ne === 'gonder') {
                if (anaHal() === 'bagla') { gonderPanelKapat(); return belgelerAc(kok.querySelector('[data-sr="belgeler"]'), true); }
                return gonder();
            }
            if (ne === 'buyut') return onizlemeBuyut(h);
            if (ne === 'on-geri' || ne === 'on-ileri') return onizlemeSayfa(ne === 'on-geri' ? -1 : 1);
            if (ne === 'on-tekrar') { g.on.anahtar = ''; return onizlemeIste(true); }
            if (ne === 'diger') { g.digerAcik = !g.digerAcik; return gonderPanelCiz(); }
            if (ne === 'hesap') { gonderPanelKapat(); return belgelerAc(kok.querySelector('[data-sr="belgeler"]'), !etkinHesaplar().length); }
            if (h.hasAttribute('data-on-tur')) { g.onTur = h.getAttribute('data-on-tur'); gonderPanelCiz(); return onizlemeIste(true); }
            if (h.hasAttribute('data-alici')) return aliciDegistir(h.getAttribute('data-alici'));
            var sid = h.getAttribute('data-sablon');
            if (sid) {
                var sb = SABLONLAR.find(function (x) { return x.id === sid; });
                if (sb) ayarDegistir(Object.assign({}, VARSAYILAN_AYAR, sb.ayar, { not: g.ayar.not, alicilar: g.ayar.alicilar }));
                return;
            }
            var ad = h.getAttribute('data-ayar');
            if (!ad) return;
            var degisim = {};
            if (h.getAttribute('role') === 'switch') degisim[ad] = h.getAttribute('aria-checked') !== 'true';
            else degisim[ad] = ad === 'sinir' ? Number(h.getAttribute('data-deger')) : h.getAttribute('data-deger');
            ayarDegistir(degisim);
        });
        g.panel.addEventListener('input', function (e) {
            var h = e.target;
            if (h && h.matches('input[data-ayar="not"]')) {
                g.ayar.not = h.value.slice(0, 80);
                g.degisti = true;
                var sayac = g.panel.querySelector('[data-g="not-sayac"]');
                if (sayac) sayac.textContent = g.ayar.not.length + '/80';
                tercihKaydetGecikmeli();
                onizlemeIste();
            }
        });
        // Pencere boyu değişince PDF önizlemesini yeni genişlikte yeniden çiz
        var boyutZaman = null;
        window.addEventListener('resize', function () {
            if (!g.acik) return;
            clearTimeout(boyutZaman);
            boyutZaman = setTimeout(function () { if (g.on.belge) onizlemeCiz(); }, 200);
        });
    }

    function aliciDegistir(hesap) {
        var etkin = etkinHesaplar().map(function (h) { return h.hesap; });
        var secili = g.ayar.alicilar.filter(function (x) { return etkin.indexOf(x) >= 0; });
        if (!secili.length) secili = etkin.slice(); // boş = hepsi
        var i = secili.indexOf(hesap);
        if (i >= 0) {
            if (secili.length === 1) { bildir('En az bir hesap seçili kalmalı.', 'uyari'); return; }
            secili.splice(i, 1);
        } else {
            secili.push(hesap);
        }
        g.ayar.alicilar = secili.length === etkin.length ? [] : secili;
        g.degisti = true;
        tercihKaydetGecikmeli();
        gonderPanelCiz();
    }

    function ayarOzeti(a) {
        var alici = etkinHesaplar();
        var kac = a.alicilar.length ? alici.filter(function (h) { return a.alicilar.indexOf(h.hesap) >= 0; }).length || alici.length : alici.length;
        var kime = kac > 1 ? ' · ' + kac + ' hesaba' : '';
        if (a.bicim === 'kart') return 'Bilgi kartı · ' + ({ mavi: 'mavi', koyu: 'koyu', acik: 'açık' }[a.kartTema] || 'mavi') + ' tema' + (a.fiyat ? '' : ' · fiyatsız') + kime;
        var bolum = [];
        if (a.ozet) bolum.push('özet');
        if (a.grafik) bolum.push('grafik');
        var liste = ['eksik', 'fazla', 'sayilmayan'].filter(function (k) { return a[k]; }).length;
        if (liste) bolum.push(liste + ' liste');
        return (a.bicim === 'ikisi' ? 'Kart + PDF' : 'PDF') + ': ' + (bolum.join(', ') || 'özet') +
            (a.gorsel ? ' · görselli' : '') + (a.fiyat ? '' : ' · fiyatsız') + (a.sinir ? ' · ilk ' + a.sinir : '') + kime;
    }

    function gonderPanelCiz() {
        if (!g.panel) return;
        var a = g.ayar;
        var tablo = seciliTablo();
        g.panel.querySelector('[data-g="tablo"]').textContent = tablo ? 'Tablo: ' + tabloGorunenAd(tablo) : 'Önce Finans ekranında bir tablo seçin';
        var pdfVar = a.bicim !== 'kart';
        var kartVar = a.bicim !== 'pdf';
        var sb = SABLONLAR.find(function (x) { return x.id === a.sablon; });
        var etkin = etkinHesaplar();
        var seciliAlici = a.alicilar.length ? a.alicilar : etkin.map(function (h) { return h.hesap; });

        var govde = g.panel.querySelector('[data-g="govde"]');
        var kaydir = govde.scrollTop;
        var eskiSerit = govde.querySelector('.sr-sablonlar');
        var yatay = eskiSerit ? eskiSerit.scrollLeft : 0;
        var odak = document.activeElement && govde.contains(document.activeElement)
            ? [document.activeElement.getAttribute('data-ayar') || '', document.activeElement.getAttribute('data-deger') || document.activeElement.getAttribute('data-sablon') || document.activeElement.getAttribute('data-alici') || '']
            : null;

        govde.innerHTML =
            '<section class="sr-bolum sr-bolum--sik"><h3 class="sr-bolum__baslik">Şablon</h3>' +
            '<div class="sr-sablonlar" role="radiogroup" aria-label="Rapor şablonu">' +
            SABLONLAR.map(function (s) {
                return '<button type="button" class="sr-sablon" role="radio" aria-checked="' + (a.sablon === s.id) + '" data-sablon="' + s.id + '" title="' + kacir(s.aciklama) + '">' +
                    '<span class="sr-sablon__ikon">' + (ikon[s.ikon] || ikon.belge) + '</span><span class="sr-sablon__ad">' + kacir(s.ad) + '</span></button>';
            }).join('') + '</div>' +
            '<p class="sr-ipucu">' + (sb ? kacir(sb.aciklama) : 'Özel ayar: aşağıdaki seçimler kullanılacak.') + '</p>' +
            '</section>' +

            '<section class="sr-bolum sr-bolum--sik"><h3 class="sr-bolum__baslik">Biçim</h3>' +
            segment('bicim', [['pdf', 'PDF rapor'], ['kart', 'Bilgi kartı'], ['ikisi', 'İkisi']], a.bicim, 'Biçim') +
            '</section>' +

            '<section class="sr-bolum sr-bolum--sik"><h3 class="sr-bolum__baslik">İçerik</h3>' +
            '<div class="sr-cipler">' +
            (pdfVar
                ? cip('ozet', 'Özet', a.ozet) + cip('grafik', 'Grafikler', a.grafik) + cip('eksik', 'Eksikler', a.eksik) +
                  cip('fazla', 'Fazlalar', a.fazla) + cip('sayilmayan', 'Sayılmayanlar', a.sayilmayan) + cip('gorsel', 'Görseller', a.gorsel)
                : '') +
            cip('fiyat', 'Fiyat ve TL', a.fiyat) +
            (kartVar ? cip('kartUrunler', 'Kartta ürünler', a.kartUrunler) : '') +
            '</div>' +
            (kartVar
                ? '<div class="sr-temalar" role="radiogroup" aria-label="Kart teması">' +
                  [['mavi', 'Mavi'], ['koyu', 'Koyu'], ['acik', 'Açık']].map(function (t) {
                      return '<button type="button" class="sr-tema sr-tema--' + t[0] + '" role="radio" aria-checked="' + (a.kartTema === t[0]) + '" data-ayar="kartTema" data-deger="' + t[0] + '">' +
                          '<span class="sr-tema__ornek" aria-hidden="true"></span>' + t[1] + '</button>';
                  }).join('') + '</div>'
                : '') +
            '</section>' +

            '<section class="sr-bolum sr-bolum--sik">' +
            '<button type="button" class="sr-acilir" data-g="diger" aria-expanded="' + g.digerAcik + '">' +
            '<span>Diğer ayarlar</span><span class="sr-acilir__ozet">' + kacir(digerOzeti(a, etkin, seciliAlici)) + '</span>' + ikon.asagi + '</button>' +
            (g.digerAcik
                ? '<div class="sr-acilir__icerik">' +
                  (pdfVar
                      ? '<p class="sr-alt-etiket">Liste başına ürün</p>' + segment('sinir', [[10, '10'], [25, '25'], [50, '50'], [0, 'Sığdığı kadar']], a.sinir, 'Liste başına ürün') +
                        '<div class="sr-cipler sr-cipler--ust">' + cip('barkod', 'Barkod', a.barkod) + '</div>'
                      : '') +
                  '<label class="sr-not"><span class="sr-alt-etiket">Not <em>(isteğe bağlı, rapora ve karta yazılır)</em></span>' +
                  '<span class="sr-not__kutu"><input type="text" maxlength="80" data-ayar="not" placeholder="Örn. Akşam vardiyası sayımı" value="' + kacir(a.not) + '">' +
                  '<span class="sr-not__sayac" data-g="not-sayac">' + a.not.length + '/80</span></span></label>' +
                  (etkin.length > 1
                      ? '<p class="sr-alt-etiket">Gönderilecek hesaplar</p><div class="sr-cipler">' + etkin.map(function (h) {
                          var acik = seciliAlici.indexOf(h.hesap) >= 0;
                          return '<button type="button" class="sr-cip" role="switch" aria-checked="' + acik + '" data-alici="' + kacir(h.hesap) + '">' +
                              '<span class="sr-cip__isaret" aria-hidden="true">' + (acik ? ikon.tamam : ikon.arti) + '</span>' + kacir(hesapAdi(h)) + '</button>';
                      }).join('') + '</div>'
                      : '') +
                  '</div>'
                : '') +
            '</section>' +

            '<button type="button" class="sr-hesap-serit" data-g="hesap">' +
            (etkin.length
                ? '<span class="sr-nokta sr-nokta--yesil"></span><span>Gönderilecek: <strong>' + kacir(seciliAlici.length > 1 ? seciliAlici.length + ' hesap' : hesapAdi(etkin.find(function (h) { return h.hesap === seciliAlici[0]; }) || etkin[0])) + '</strong></span><span class="sr-hesap-serit__git">Hesaplar</span>'
                : '<span class="sr-nokta sr-nokta--sari"></span><span>Göndermek için önce bir Telegram hesabı bağlayın</span><span class="sr-hesap-serit__git">Bağla</span>') +
            '</button>';

        govde.scrollTop = kaydir;
        var yeniSerit = govde.querySelector('.sr-sablonlar');
        if (yeniSerit) yeniSerit.scrollLeft = yatay;
        if (odak) {
            var hedef = odak[0]
                ? govde.querySelector('[data-ayar="' + odak[0] + '"]' + (odak[1] ? '[data-deger="' + odak[1] + '"]' : ''))
                : govde.querySelector('[data-sablon="' + odak[1] + '"], [data-alici="' + odak[1] + '"]');
            if (hedef) { try { hedef.focus({ preventScroll: true }); } catch (e) { /* yok */ } }
        }
        g.panel.querySelector('[data-g="ozet"]').textContent = ayarOzeti(a);

        // Önizleme sekmesi (ikisi seçiliyse kart / PDF)
        var sekme = g.panel.querySelector('[data-g="on-sekme"]');
        if (a.bicim === 'ikisi') {
            sekme.innerHTML = '<div class="sr-segment sr-segment--kucuk" role="tablist">' +
                '<button type="button" role="tab" aria-selected="' + (g.onTur === 'kart') + '" aria-checked="' + (g.onTur === 'kart') + '" data-on-tur="kart">Kart</button>' +
                '<button type="button" role="tab" aria-selected="' + (g.onTur === 'pdf') + '" aria-checked="' + (g.onTur === 'pdf') + '" data-on-tur="pdf">PDF</button></div>';
        } else {
            sekme.innerHTML = '';
        }
        dugmeCiz();
    }

    function digerOzeti(a, etkin, seciliAlici) {
        var p = [];
        if (a.bicim !== 'kart') p.push(a.sinir ? 'ilk ' + a.sinir : 'sığdığı kadar');
        if (a.not) p.push('notlu');
        if (etkin.length > 1) p.push(seciliAlici.length + '/' + etkin.length + ' hesap');
        return p.join(' · ');
    }

    function gonderPanelAc(acan) {
        gonderPanelKur();
        if (g.acik) return;
        g.acik = true;
        g.acan = acan || null;
        g.onTur = g.ayar.bicim === 'kart' ? 'kart' : 'pdf';
        g.onSayfa = 1;
        // Sayım sürüyor olabilir: her açılışta güncel veriden önizle
        g.on.onbellek.clear();
        g.on.anahtar = '';
        gonderPanelCiz();
        var govde = g.panel.querySelector('[data-g="govde"]');
        govde.scrollTop = 0;
        perdeAc(g.panel, null);
        var secili = g.panel.querySelector('.sr-sablon[aria-checked="true"]');
        if (secili) {
            var serit = secili.parentNode;
            if (serit.scrollWidth > serit.clientWidth) serit.scrollLeft = Math.max(0, secili.offsetLeft - 16);
        }
        try { (secili || g.panel.querySelector('[data-g="kapat"]')).focus({ preventScroll: true }); } catch (e) { /* yok */ }
        durumYukle(true);
        onizlemeIste(true);
    }

    function gonderPanelKapat() {
        if (!g.acik) return;
        g.acik = false;
        clearTimeout(g.on.zaman);
        g.on.istekNo++;
        perdeKapat(g.panel, g.acan);
    }

    // ---- Önizleme -------------------------------------------------------
    function onizlemeAnahtari() {
        var a = g.ayar;
        var tur = a.bicim === 'ikisi' ? g.onTur : a.bicim === 'kart' ? 'kart' : 'pdf';
        var alanlar = ['fiyat', 'not'].concat(tur === 'pdf' ? PDF_ALANLARI : KART_ALANLARI);
        return [seciliTablo(), tur].concat(alanlar.map(function (k) { return a[k]; })).join('|');
    }

    /** Ayar değişince 600 ms bekle; aynı ayar ikinci kez istenmez */
    function onizlemeIste(hemen) {
        clearTimeout(g.on.zaman);
        if (!g.acik) return;
        var anahtar = onizlemeAnahtari();
        if (anahtar === g.on.anahtar && g.on.durum !== 'hata') return;
        g.on.durum = 'yukleniyor';
        onizlemeDurumCiz();
        g.on.zaman = setTimeout(function () { onizlemeGetir(anahtar); }, hemen || g.on.onbellek.has(anahtar) ? 0 : 600);
    }

    async function onizlemeGetir(anahtar) {
        var tablo = seciliTablo();
        var no = ++g.on.istekNo;
        if (!tablo) { g.on.durum = 'hata'; g.on.hata = 'Önce Finans ekranında bir tablo seçin.'; return onizlemeDurumCiz(); }
        var a = Object.assign({}, g.ayar);
        var tur = a.bicim === 'ikisi' ? g.onTur : a.bicim === 'kart' ? 'kart' : 'pdf';
        var blob = g.on.onbellek.get(anahtar);
        if (!blob) {
            var c = await istekHam('/api/rapor/onizleme', {
                method: 'POST',
                body: JSON.stringify({ tablo: tablo, tur: tur, ayar: a, fiyatlar: a.fiyat ? yedekFiyatlar(tablo) : null }),
            });
            if (no !== g.on.istekNo) return;
            if (!c.blob) {
                // Önceki önizleme sunucuda bitmeden yenisi istendiyse kısa bekleyip tekrar
                if (c.j.error === 'mesgul') { g.on.zaman = setTimeout(function () { onizlemeGetir(anahtar); }, 700); return; }
                g.on.durum = 'hata';
                g.on.hata = hataMetni(c);
                return onizlemeDurumCiz();
            }
            blob = c.blob;
            g.on.onbellek.set(anahtar, blob);
            if (g.on.onbellek.size > 12) g.on.onbellek.delete(g.on.onbellek.keys().next().value);
        }
        if (no !== g.on.istekNo) return;
        g.on.anahtar = anahtar;
        g.on.tur = tur;
        g.on.blob = blob;
        if (g.on.belge) { try { g.on.belge.destroy(); } catch (e) { /* yok */ } g.on.belge = null; }
        if (g.on.png) { URL.revokeObjectURL(g.on.png); g.on.png = null; }
        try {
            if (tur === 'kart') {
                g.on.png = URL.createObjectURL(blob);
                g.on.sayfaSayisi = 1;
            } else {
                var belge = await pdfAc(blob);
                if (no !== g.on.istekNo) { belge.destroy(); return; }
                g.on.belge = belge;
                g.on.sayfaSayisi = belge.numPages;
                g.onSayfa = Math.min(g.onSayfa, belge.numPages) || 1;
            }
            g.on.durum = 'hazir';
            await onizlemeCiz();
        } catch (e) {
            if (no !== g.on.istekNo) return;
            g.on.durum = 'hata';
            g.on.hata = 'Önizleme bu tarayıcıda gösterilemedi.';
            onizlemeDurumCiz();
        }
    }

    function onizlemeDurumCiz() {
        if (!g.panel) return;
        var cerceve = g.panel.querySelector('[data-g="on-cerceve"]');
        cerceve.classList.toggle('is-yukleniyor', g.on.durum === 'yukleniyor');
        var ust = cerceve.querySelector('.sr-onizleme__durum');
        if (ust) ust.remove();
        if (g.on.durum === 'yukleniyor') {
            cerceve.insertAdjacentHTML('beforeend', '<div class="sr-onizleme__durum"><span class="sr-cark sr-cark--koyu" aria-hidden="true"></span><span>Önizleme hazırlanıyor</span></div>');
        } else if (g.on.durum === 'hata') {
            cerceve.insertAdjacentHTML('beforeend', '<div class="sr-onizleme__durum sr-onizleme__durum--hata"><span>' + kacir(g.on.hata) + '</span>' +
                '<button type="button" class="sr-dugme sr-dugme--ikincil" data-g="on-tekrar">Tekrar dene</button></div>');
        }
        sayfaGostergesiCiz();
    }

    function sayfaGostergesiCiz() {
        var yer = g.panel.querySelector('[data-g="on-sayfa"]');
        if (g.on.durum === 'hazir' && g.on.tur === 'pdf' && g.on.sayfaSayisi > 1) {
            yer.innerHTML = '<button type="button" class="sr-ikon-dugme sr-ikon-dugme--kucuk" data-g="on-geri" aria-label="Önceki sayfa"' + (g.onSayfa <= 1 ? ' disabled' : '') + '>' + ikon.sol + '</button>' +
                '<span>' + g.onSayfa + ' / ' + g.on.sayfaSayisi + '</span>' +
                '<button type="button" class="sr-ikon-dugme sr-ikon-dugme--kucuk" data-g="on-ileri" aria-label="Sonraki sayfa"' + (g.onSayfa >= g.on.sayfaSayisi ? ' disabled' : '') + '>' + ikon.sag + '</button>';
        } else {
            yer.innerHTML = '';
        }
    }

    async function onizlemeCiz() {
        var kagit = g.panel.querySelector('[data-g="on-kagit"]');
        kagit.classList.toggle('is-kare', g.on.tur === 'kart');
        if (g.on.tur === 'kart') {
            kagit.innerHTML = '<img alt="Bilgi kartı önizlemesi" src="' + g.on.png + '">';
        } else if (g.on.belge) {
            var tuval = kagit.querySelector('canvas') || document.createElement('canvas');
            if (!tuval.isConnected) { kagit.innerHTML = ''; kagit.appendChild(tuval); }
            tuval.setAttribute('aria-label', 'PDF önizlemesi, sayfa ' + g.onSayfa);
            await sayfaCiz(g.on.belge, g.onSayfa, tuval, kagit.clientWidth || 300);
        }
        onizlemeDurumCiz();
    }

    function onizlemeSayfa(yon) {
        if (!g.on.belge) return;
        var yeni = Math.max(1, Math.min(g.on.sayfaSayisi, g.onSayfa + yon));
        if (yeni === g.onSayfa) return;
        g.onSayfa = yeni;
        onizlemeCiz();
    }

    function onizlemeBuyut(acan) {
        if (g.on.durum !== 'hazir' || !g.on.blob) return;
        var blob = g.on.blob;
        var tablo = seciliTablo();
        goruntuleyiciAc({
            baslik: tabloGorunenAd(tablo),
            alt: 'Önizleme · henüz gönderilmedi',
            kaynaklar: [{
                ad: g.on.tur === 'kart' ? 'Bilgi kartı' : 'PDF rapor',
                tur: g.on.tur === 'kart' ? 'resim' : 'pdf',
                dosya: dosyaAdi(tablo, g.on.tur === 'kart' ? 'png' : 'pdf'),
                getir: function () { return Promise.resolve({ blob: blob }); },
            }],
        }, acan);
    }

    // ------------------------------------------------------------------
    // Sayım sistemine bağlanma
    // ------------------------------------------------------------------
    /** Finans çizildikçe kartı tazele (tablo değişimi dahil). İlk çizimde durumu yükle. */
    function sistemeBaglan() {
        var s = sistem();
        if (!s || s.__srBagli) return !!s;
        s.__srBagli = true;
        var asil = s.renderFinancialDataForSelection;
        if (typeof asil === 'function') {
            s.renderFinancialDataForSelection = function () {
                var sonuc = asil.apply(this, arguments);
                try {
                    kartCiz();
                    durumYukle(false);
                } catch (e) { /* kart yan iş, finansı bozmasın */ }
                return sonuc;
            };
        }
        return true;
    }

    function basla() {
        if (!kartKur()) return;
        if (!sistemeBaglan()) window.addEventListener('load', sistemeBaglan, { once: true });
        var finans = document.getElementById('finansTabContent');
        if (finans && !finans.classList.contains('hidden')) durumYukle(false);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && d.izlenen === null && b.acik) gecmisYukle();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();

    window.JBSayimRapor = {
        belgeler: function () { belgelerAc(null); },
        gonder: function () { gonderPanelAc(null); },
    };
})();
