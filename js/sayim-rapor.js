/**
 * Sayım > Finans: sayım raporu (PDF, Telegram)
 * ============================================================================
 *
 * Finans sekmesine bir kart ekliyor: seçili tablonun raporu tek dokunuşla
 * kullanıcının Telegram'ına PDF olarak gidiyor. Ayar paneli Telegram
 * hesabını bağlamayı ve gönderilen belgeleri gösteriyor.
 *
 * Bütün iş sunucuda (vps-api/sayim-raporu). Bu dosya yalnız isteği
 * bırakıyor; kullanıcı sayfayı kapatsa da rapor gidiyor. Bot jetonu
 * tarayıcıya hiç gelmiyor.
 *
 * Bağlama: sunucu tek kullanımlık bir t.me bağlantısı üretiyor, kullanıcı
 * Telegram'da Başlat'a basınca hesap bağlanıyor. Kimlik numarası yazdırılmıyor.
 *
 * Ağ: sayfa açılışında istek yok. Finans sekmesi ilk açıldığında tek durum
 * isteği; panel açıkken ve bekleyen rapor varken kısa yoklama.
 * ============================================================================
 */
(function () {
    'use strict';

    var SURUM = (document.currentScript && document.currentScript.src) || '';
    var QR_ADRESI = SURUM ? SURUM.replace(/sayim-rapor\.js.*$/, 'vendor/qrcode.min.js?v=20260828i') : '';

    var ikon = {
        belge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
        ucak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 3.5 2.8 10.6c-.9.3-.9 1.6 0 1.9l4.6 1.6 1.7 5.3c.3.8 1.3 1 1.9.4l2.6-2.5 4.8 3.5c.7.5 1.6.1 1.8-.7l3-15.3c.2-.9-.6-1.6-1.5-1.3Z"/><path d="m7.4 14.1 11.6-8.3-8.2 9.5"/></svg>',
        ayar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
        kapat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
        tamam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
        hata: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h0"/></svg>',
        saat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        yenile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
        tekrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5"/><path d="M20 3.5v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5"/><path d="M4 20.5v-5h5"/></svg>',
    };

    var HATA_METNI = {
        baglanti_yok: 'Önce Telegram hesabınızı bağlayın.',
        bot_engelli: 'Bot Telegram\'da engellenmiş. Hesabı yeniden bağlayın.',
        bot_hazir_degil: 'Rapor servisi şu an kapalı. Biraz sonra deneyin.',
        bekleyen_var: 'Önceki rapor hâlâ hazırlanıyor.',
        saatlik_sinir: 'Bu saat için rapor sınırı doldu. Biraz sonra deneyin.',
        gunluk_sinir: 'Bugünkü rapor sınırı doldu.',
        yogun: 'Sistem şu an yoğun. Birkaç dakika sonra deneyin.',
        tablo_bos: 'Bu tabloda ürün yok.',
        sayim_yok: 'Bu tabloda henüz sayılan ürün yok.',
        tablo_gecersiz: 'Tablo okunamadı.',
        cok_istek: 'Çok hızlı istek gönderildi, biraz bekleyin.',
        hesap_kapali: 'Hesabınız kapalı ya da süresi dolmuş.',
        unauthorized: 'Oturum süresi dolmuş. Sayfayı yenileyin.',
    };

    var DURUM_ETIKETI = {
        bekliyor: ['Sırada', 'mavi', 'saat'],
        hazirlaniyor: ['Hazırlanıyor', 'mavi', 'saat'],
        gonderildi: ['Gönderildi', 'yesil', 'tamam'],
        hata: ['Gönderilemedi', 'kirmizi', 'hata'],
    };

    var d = {
        yuklendi: false,
        yukleniyor: null,
        hata: '',
        bot: null,
        baglanti: null,
        sinirSn: 60,
        bekleBitis: 0,
        gonderiliyor: false,
        tamamAni: 0,
        izlenen: null, // { id, bitis }
        izleZaman: null,
        sayacZaman: null,
    };

    var kok = null;
    var panel = null;
    var panelDurum = { acik: false, acan: null, gecmis: null, gecmisHata: '', baglaGorunum: false, kod: null, durumZaman: null, gecmisZaman: null };

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

    async function istek(yol, secenek) {
        var a = window.jetbarkodAuth;
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

    function hataMetni(c) {
        var k = c && c.j && c.j.error;
        if (c && c.kod === 401) return HATA_METNI.unauthorized;
        if (k === 'cok_sik') return 'Dakikada bir rapor gönderilebilir. ' + (c.j.bekleSn || 60) + ' sn sonra tekrar deneyin.';
        if (k && HATA_METNI[k]) return HATA_METNI[k];
        if (c && c.kod === 0) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
        return 'İşlem yapılamadı. Biraz sonra tekrar deneyin.';
    }

    /** Raporu istenecek tablo: Finans seçicisindeki tek tablo */
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
     * Ekranda görünen fiyatlar sunucuya yedek olarak gidiyor. Veritabanında
     * fiyatı henüz yazılmamış ürün (arka planda yeni çekilmiş) raporda da
     * ekrandaki fiyatla hesaplansın diye. Stoklar sunucunun kendi kaydından.
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

    // ------------------------------------------------------------------
    // Durum
    // ------------------------------------------------------------------
    function durumYukle(zorla) {
        if (d.yukleniyor) return d.yukleniyor;
        if (d.yuklendi && !zorla) return Promise.resolve();
        d.yukleniyor = istek('/api/rapor/durum').then(function (c) {
            if (c.kod === 200 && c.j.ok) {
                d.hata = '';
                d.bot = c.j.bot || null;
                d.baglanti = c.j.baglanti || null;
                if (c.j.sinir) {
                    d.sinirSn = c.j.sinir.araSn || 60;
                    if (c.j.sinir.kalanSn > 0) bekleBaslat(c.j.sinir.kalanSn);
                }
            } else {
                d.hata = c.kod === 404 ? 'Rapor servisi henüz kurulmadı.' : hataMetni(c);
            }
            d.yuklendi = true;
        }).finally(function () {
            d.yukleniyor = null;
            kartCiz();
            if (panelDurum.acik) panelTelegramCiz();
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
    // Kart
    // ------------------------------------------------------------------
    function kartKur() {
        kok = document.getElementById('sayimRaporKart');
        if (!kok) return false;
        kok.innerHTML =
            '<section class="sr-kart" aria-labelledby="srKartBaslik">' +
            '<span class="sr-kart__ikon">' + ikon.belge + '</span>' +
            '<div class="sr-kart__metin">' +
            '<h3 class="sr-kart__baslik" id="srKartBaslik">Sayım raporu</h3>' +
            '<p class="sr-kart__satir" data-sr="durum"></p>' +
            '<p class="sr-kart__satir" data-sr="tablo"></p>' +
            '</div>' +
            '<div class="sr-kart__eylem">' +
            '<button type="button" class="sr-dugme sr-dugme--ikincil" data-sr="ayar" aria-label="Telegram ayarları ve gönderilen belgeler">' + ikon.ayar + '<span>Belgeler</span></button>' +
            '<button type="button" class="sr-dugme sr-dugme--ana" data-sr="gonder"></button>' +
            '</div>' +
            '</section>';
        kok.querySelector('[data-sr="ayar"]').addEventListener('click', function (e) { panelAc(e.currentTarget); });
        kok.querySelector('[data-sr="gonder"]').addEventListener('click', anaEylem);
        kartCiz();
        return true;
    }

    function kartCiz() {
        if (!kok || !kok.firstChild) return;
        var durumEl = kok.querySelector('[data-sr="durum"]');
        var tabloEl = kok.querySelector('[data-sr="tablo"]');
        var html;
        if (!d.yuklendi) {
            html = '<span class="sr-iskelet-metin" aria-label="Yükleniyor"></span>';
        } else if (d.hata) {
            html = '<span class="sr-nokta"></span><span>' + kacir(d.hata) + '</span>';
        } else if (!d.bot || !d.bot.hazir) {
            html = '<span class="sr-nokta"></span><span>Rapor servisi şu an kapalı.</span>';
        } else if (!d.baglanti) {
            html = '<span class="sr-nokta"></span><span>PDF raporu Telegram\'ınıza gelir. Önce hesabınızı bağlayın.</span>';
        } else if (d.baglanti.durum !== 'aktif') {
            html = '<span class="sr-nokta sr-nokta--sari"></span><span>Bot engellenmiş. Ayarlardan yeniden bağlayın.</span>';
        } else {
            var ad = d.baglanti.ad || (d.baglanti.kullaniciAdi ? '@' + d.baglanti.kullaniciAdi : 'Telegram hesabı');
            html = '<span class="sr-nokta sr-nokta--yesil"></span><span>Telegram: <strong>' + kacir(ad) + '</strong>' +
                (d.baglanti.kullaniciAdi && d.baglanti.ad ? ' (@' + kacir(d.baglanti.kullaniciAdi) + ')' : '') + '</span>';
        }
        durumEl.innerHTML = html;
        var t = seciliTablo();
        tabloEl.innerHTML = t
            ? '<span>Tablo: <strong>' + kacir(tabloGorunenAd(t)) + '</strong></span>'
            : '<span>Rapor için yukarıdan tek bir tablo seçin.</span>';
        dugmeCiz();
    }

    /** Ana düğmenin hâli; etiket genişliği sabit, düğme boyu oynamaz */
    function anaHal() {
        if (!d.yuklendi || d.hata || !d.bot || !d.bot.hazir) return 'kapali';
        if (!d.baglanti || d.baglanti.durum !== 'aktif') return 'bagla';
        if (d.gonderiliyor) return 'gonderiliyor';
        if (Date.now() - d.tamamAni < 2400) return 'tamam';
        if (d.izlenen) return 'hazirlaniyor';
        if (kalanSn() > 0) return 'bekle';
        if (!seciliTablo()) return 'tablo-yok';
        return 'gonder';
    }

    function dugmeCiz() {
        if (!kok) return;
        var b = kok.querySelector('[data-sr="gonder"]');
        if (!b) return;
        var hal = anaHal();
        var icerik;
        var kapali = false;
        switch (hal) {
            case 'bagla': icerik = ikon.ucak + '<span>Telegram\'ı bağla</span>'; break;
            case 'gonderiliyor': icerik = '<span class="sr-cark" aria-hidden="true"></span><span>Gönderiliyor</span>'; kapali = true; break;
            case 'tamam': icerik = ikon.tamam + '<span>Sıraya alındı</span>'; kapali = true; break;
            case 'hazirlaniyor': icerik = '<span class="sr-cark" aria-hidden="true"></span><span>Hazırlanıyor</span>'; kapali = true; break;
            case 'bekle': icerik = ikon.saat + '<span>Tekrar ' + kalanSn() + ' sn</span>'; kapali = true; break;
            case 'kapali': icerik = ikon.ucak + '<span>Telegram\'a gönder</span>'; kapali = true; break;
            case 'tablo-yok': icerik = ikon.ucak + '<span>Telegram\'a gönder</span>'; kapali = true; break;
            default: icerik = ikon.ucak + '<span>Telegram\'a gönder</span>';
        }
        if (b.dataset.icerik !== hal + (hal === 'bekle' ? kalanSn() : '')) {
            b.innerHTML = icerik;
            b.dataset.icerik = hal + (hal === 'bekle' ? kalanSn() : '');
        }
        b.dataset.hal = hal;
        b.disabled = kapali;
        b.setAttribute('aria-busy', hal === 'gonderiliyor' || hal === 'hazirlaniyor' ? 'true' : 'false');
    }

    async function anaEylem() {
        var hal = anaHal();
        if (hal === 'bagla') { panelAc(kok.querySelector('[data-sr="gonder"]'), true); return; }
        if (hal !== 'gonder') return;
        var tablo = seciliTablo();
        if (!tablo) return;
        d.gonderiliyor = true;
        dugmeCiz();
        var c = await istek('/api/rapor/sayim', {
            method: 'POST',
            body: JSON.stringify({ tablo: tablo, fiyatlar: yedekFiyatlar(tablo) }),
        });
        d.gonderiliyor = false;
        if (c.kod === 202 && c.j.ok) {
            d.tamamAni = Date.now();
            bekleBaslat(d.sinirSn);
            izle(c.j.id);
            bildir('Rapor hazırlanıyor. Birkaç saniye içinde Telegram\'ınızda olur; sayfayı kapatabilirsiniz.', 'basari');
            setTimeout(dugmeCiz, 2500);
            if (panelDurum.acik) gecmisYukle();
        } else {
            if (c.j.error === 'cok_sik' && c.j.bekleSn) bekleBaslat(c.j.bekleSn);
            if (c.j.error === 'baglanti_yok' || c.j.error === 'bot_engelli') {
                durumYukle(true);
                panelAc(kok.querySelector('[data-sr="gonder"]'), true);
            }
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
                // Sunucu yine gönderecek; yalnız sayfa takibi bırakıyor
                d.izlenen = null;
                dugmeCiz();
                return;
            }
            var c = await istek('/api/rapor/gecmis');
            if (!d.izlenen) return;
            if (c.kod === 200 && c.j.ok) {
                panelDurum.gecmis = c.j.liste;
                if (panelDurum.acik) gecmisCiz();
                var is = (c.j.liste || []).find(function (x) { return x.id === d.izlenen.id; });
                if (is && is.durum === 'gonderildi') {
                    d.izlenen = null;
                    bildir('Rapor Telegram\'a gönderildi.', 'basari');
                } else if (is && is.durum === 'hata') {
                    d.izlenen = null;
                    bildir('Rapor gönderilemedi: ' + (is.hata || 'bilinmeyen hata'), 'hata');
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
    // Panel
    // ------------------------------------------------------------------
    function panelKur() {
        if (panel) return;
        panel = document.createElement('div');
        panel.className = 'sr-perde';
        panel.hidden = true;
        panel.innerHTML =
            '<div class="sr-panel" role="dialog" aria-modal="true" aria-labelledby="srPanelBaslik">' +
            '<header class="sr-panel__bas">' +
            '<h2 class="sr-panel__baslik" id="srPanelBaslik">Sayım raporu</h2>' +
            '<button type="button" class="sr-ikon-dugme" data-sr="kapat" aria-label="Kapat">' + ikon.kapat + '</button>' +
            '</header>' +
            '<div class="sr-panel__govde">' +
            '<section class="sr-bolum"><h3 class="sr-bolum__baslik">Telegram hesabı</h3><div data-sr="tg"></div></section>' +
            '<section class="sr-bolum">' +
            '<div class="sr-bolum__ust"><h3 class="sr-bolum__baslik">Gönderilen belgeler</h3>' +
            '<button type="button" class="sr-ikon-dugme" data-sr="yenile" aria-label="Listeyi yenile">' + ikon.yenile + '</button></div>' +
            '<div data-sr="gecmis" aria-live="polite"></div>' +
            '</section>' +
            '<p class="sr-dipnot">Rapor A4 PDF, en fazla 4 sayfa: önce özet, sonra eksik, fazla ve sayılmayan ürünler. ' +
            'Fiyatlar orijinal (üstü çizili) fiyattan. Sayılmayan ürün eksik sayılmaz. ' +
            'Üst üste basmaya karşı dakikada bir rapor gönderilebilir.</p>' +
            '</div></div>';
        document.body.appendChild(panel);

        panel.addEventListener('click', function (e) {
            if (e.target === panel) { panelKapat(); return; }
            var hedef = e.target.closest('[data-sr]');
            if (!hedef) return;
            var ne = hedef.getAttribute('data-sr');
            if (ne === 'kapat') panelKapat();
            else if (ne === 'yenile') gecmisYukle();
            else if (ne === 'yeniden') { panelDurum.baglaGorunum = true; panelTelegramCiz(); kodHazirla(); }
            else if (ne === 'vazgec') { panelDurum.baglaGorunum = false; durumYoklaDur(); panelTelegramCiz(); }
            else if (ne === 'kaldir') baglantiKaldir();
            else if (ne === 'yenikod') { panelDurum.kod = null; panelTelegramCiz(); kodHazirla(); }
            else if (ne === 'tekrar') tekrarGonder(hedef);
            else if (ne === 'gecmis-tekrar') gecmisYukle();
        });
        panel.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.stopPropagation(); panelKapat(); }
            if (e.key === 'Tab') odakHapsi(e);
        });
    }

    function odakHapsi(e) {
        var odaklanir = panel.querySelectorAll('button:not([disabled]), a[href]');
        if (!odaklanir.length) return;
        var ilk = odaklanir[0];
        var son = odaklanir[odaklanir.length - 1];
        if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
        else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    }

    function panelAc(acan, baglaGorunum) {
        panelKur();
        if (panelDurum.acik) return;
        panelDurum.acik = true;
        panelDurum.acan = acan || null;
        panelDurum.baglaGorunum = !!baglaGorunum;
        panel.hidden = false;
        document.documentElement.classList.add('sr-kilit');
        // Bir kare sonra sınıf: geçiş başlasın
        requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.add('is-acik'); }); });
        panel.querySelector('[data-sr="kapat"]').focus({ preventScroll: true });
        durumYukle(true).then(function () {
            if (!panelDurum.acik) return;
            if (!d.baglanti || d.baglanti.durum !== 'aktif') panelDurum.baglaGorunum = true;
            panelTelegramCiz();
            if (panelDurum.baglaGorunum) kodHazirla();
        });
        panelTelegramCiz();
        gecmisYukle();
    }

    function panelKapat() {
        if (!panelDurum.acik) return;
        panelDurum.acik = false;
        durumYoklaDur();
        if (panelDurum.gecmisZaman) { clearTimeout(panelDurum.gecmisZaman); panelDurum.gecmisZaman = null; }
        panel.classList.remove('is-acik');
        var bitir = function () {
            if (panelDurum.acik) return;
            panel.hidden = true;
            document.documentElement.classList.remove('sr-kilit');
        };
        var azalt = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (azalt) bitir(); else setTimeout(bitir, 240);
        if (panelDurum.acan && document.contains(panelDurum.acan)) {
            try { panelDurum.acan.focus({ preventScroll: true }); } catch (e) { /* yok */ }
        }
    }

    // ---- Telegram bölümü ------------------------------------------------
    function panelTelegramCiz() {
        if (!panel) return;
        var yer = panel.querySelector('[data-sr="tg"]');
        if (!d.yuklendi) {
            yer.innerHTML = '<div class="sr-hesap"><span class="sr-avatar" aria-hidden="true"></span><div class="sr-hesap__metin"><span class="sr-iskelet-metin"></span></div></div>';
            return;
        }
        if (d.hata || !d.bot || !d.bot.hazir) {
            yer.innerHTML = '<div class="sr-bos"><strong>Rapor servisi şu an kapalı</strong><span>' +
                kacir(d.hata || 'Telegram botu henüz ayarlanmadı. Yönetici açınca burada bağlanabilirsiniz.') + '</span></div>';
            return;
        }
        var b = d.baglanti;
        if (b && !panelDurum.baglaGorunum) {
            var ad = b.ad || (b.kullaniciAdi ? '@' + b.kullaniciAdi : 'Telegram hesabı');
            var bas = (ad.replace('@', '').trim()[0] || 'T').toLocaleUpperCase('tr');
            var engelli = b.durum !== 'aktif';
            yer.innerHTML =
                (engelli ? '<p class="sr-uyari">Bot Telegram\'da engellenmiş ya da sohbet silinmiş. Raporların gelmesi için hesabı yeniden bağlayın.</p>' : '') +
                '<div class="sr-hesap">' +
                '<span class="sr-avatar" aria-hidden="true">' + kacir(bas) + '</span>' +
                '<div class="sr-hesap__metin">' +
                '<strong>' + kacir(ad) + '</strong>' +
                (b.kullaniciAdi && b.ad ? '<span>@' + kacir(b.kullaniciAdi) + '</span>' : '') +
                '<span>Telegram ID <code>' + kacir(b.id) + '</code></span>' +
                '<span>' + kacir(tarih(b.baglandi)) + ' tarihinde bağlandı</span>' +
                '</div>' +
                (engelli
                    ? '<span class="sr-rozet sr-rozet--sari">' + ikon.hata + 'Engelli</span>'
                    : '<span class="sr-rozet sr-rozet--yesil">' + ikon.tamam + 'Bağlı</span>') +
                '</div>' +
                '<div class="sr-hesap__eylem">' +
                '<button type="button" class="sr-dugme sr-dugme--ikincil" data-sr="yeniden">' + (engelli ? 'Yeniden bağla' : 'Başka hesap bağla') + '</button>' +
                '<button type="button" class="sr-dugme sr-dugme--tehlike" data-sr="kaldir">Bağlantıyı kaldır</button>' +
                '</div>';
            return;
        }

        var kod = panelDurum.kod;
        var masaustu = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        var dugme;
        if (kod && kod.adres && Date.now() < kod.bitis) {
            dugme = '<a class="sr-dugme sr-dugme--tg" href="' + kacir(kod.adres) + '" target="_blank" rel="noopener noreferrer">' + ikon.ucak + '<span>Telegram\'ı aç</span></a>';
        } else if (kod && kod.hata) {
            dugme = '<button type="button" class="sr-dugme sr-dugme--ikincil" data-sr="yenikod">Yeniden dene</button>';
        } else if (kod && Date.now() >= kod.bitis) {
            dugme = '<button type="button" class="sr-dugme sr-dugme--ikincil" data-sr="yenikod">Bağlantının süresi doldu · Yenile</button>';
        } else {
            dugme = '<button type="button" class="sr-dugme sr-dugme--tg" disabled><span class="sr-cark" aria-hidden="true"></span><span>Hazırlanıyor</span></button>';
        }
        var not;
        if (kod && kod.hata) not = '<p class="sr-bagla__not">' + kacir(kod.hata) + '</p>';
        else if (kod && kod.adres && Date.now() < kod.bitis) not = '<p class="sr-bagla__not" role="status"><span class="sr-bekle-nokta" aria-hidden="true"></span>Telegram\'dan onay bekleniyor. Bağlantı 10 dakika geçerli.</p>';
        else not = '<p class="sr-bagla__not">&nbsp;</p>';

        yer.innerHTML =
            '<ol class="sr-adimlar">' +
            '<li><span class="sr-adim__no">1</span><div><strong>Telegram\'ı açın</strong><span>Aşağıdaki düğme Jet Barkod botunu açar' + (masaustu ? '; telefondaysanız kodu kamerayla okutun' : '') + '.</span></div></li>' +
            '<li><span class="sr-adim__no">2</span><div><strong>Başlat\'a basın</strong><span>Sohbetin altındaki Başlat (Start) düğmesine dokunun.</span></div></li>' +
            '<li><span class="sr-adim__no">3</span><div><strong>Hepsi bu</strong><span>Bu ekran kendiliğinden "Bağlı" olur. Telegram kimlik numaranızı aramanız ya da yazmanız gerekmez.</span></div></li>' +
            '</ol>' +
            '<div class="sr-bagla">' +
            '<div class="sr-bagla__ust">' + dugme +
            (masaustu ? '<div class="sr-qr" data-sr-qr' + (kod && kod.adres ? '' : ' hidden') + ' aria-label="Telegram bağlantısının karekodu" role="img"></div>' : '') +
            '</div>' + not +
            '</div>' +
            (b ? '<div class="sr-hesap__eylem"><button type="button" class="sr-dugme sr-dugme--ikincil" data-sr="vazgec">Vazgeç, mevcut hesap kalsın</button></div>' : '');

        if (masaustu && kod && kod.adres && Date.now() < kod.bitis) qrCiz(panel.querySelector('[data-sr-qr]'), kod.adres);
    }

    async function kodHazirla() {
        if (panelDurum.kod && panelDurum.kod.adres && Date.now() < panelDurum.kod.bitis - 60000) {
            durumYoklaBaslat();
            return;
        }
        panelDurum.kod = null;
        panelTelegramCiz();
        var c = await istek('/api/rapor/bagla', { method: 'POST' });
        if (!panelDurum.acik) return;
        if (c.kod === 200 && c.j.ok && c.j.adres) {
            panelDurum.kod = { adres: c.j.adres, bitis: Number(c.j.bitis) || Date.now() + 600000 };
            durumYoklaBaslat();
        } else {
            panelDurum.kod = { hata: c.j.error === 'cok_istek' ? 'Çok sık bağlantı istendi. Birkaç dakika sonra deneyin.' : hataMetni(c) };
        }
        panelTelegramCiz();
    }

    /** Bağlama sürerken durumu sor: Başlat'a basıldığı an ekran "Bağlı" olsun */
    function durumYoklaBaslat() {
        durumYoklaDur();
        var onceki = d.baglanti ? d.baglanti.id + '|' + d.baglanti.baglandi : '';
        var adim = async function () {
            panelDurum.durumZaman = null;
            if (!panelDurum.acik || !panelDurum.baglaGorunum) return;
            if (panelDurum.kod && Date.now() >= panelDurum.kod.bitis) { panelTelegramCiz(); return; }
            if (document.visibilityState === 'visible') {
                var c = await istek('/api/rapor/durum');
                if (c.kod === 200 && c.j.ok) {
                    var b = c.j.baglanti;
                    var simdi = b ? b.id + '|' + b.baglandi : '';
                    if (b && simdi !== onceki && b.durum === 'aktif') {
                        d.baglanti = b;
                        panelDurum.baglaGorunum = false;
                        panelDurum.kod = null;
                        panelTelegramCiz();
                        kartCiz();
                        bildir('Telegram bağlandı. Raporlar artık ' + (b.ad || 'bu hesaba') + ' hesabına gidecek.', 'basari');
                        return;
                    }
                }
            }
            if (panelDurum.acik) panelDurum.durumZaman = setTimeout(adim, 2500);
        };
        panelDurum.durumZaman = setTimeout(adim, 2500);
    }

    function durumYoklaDur() {
        if (panelDurum.durumZaman) { clearTimeout(panelDurum.durumZaman); panelDurum.durumZaman = null; }
    }

    async function baglantiKaldir() {
        var tamam = window.JBDiyalog && window.JBDiyalog.onay
            ? await window.JBDiyalog.onay('Raporlar artık bu Telegram hesabına gönderilmez. İstediğiniz zaman yeniden bağlayabilirsiniz.', {
                baslik: 'Bağlantı kaldırılsın mı?', tehlikeli: true, onayYazi: 'Kaldır', vazgecYazi: 'Vazgeç',
            })
            : window.confirm('Telegram bağlantısı kaldırılsın mı?');
        if (!tamam) return;
        var c = await istek('/api/rapor/bagla', { method: 'DELETE' });
        if (c.kod === 200 && c.j.ok) {
            d.baglanti = null;
            panelDurum.baglaGorunum = true;
            panelTelegramCiz();
            kartCiz();
            kodHazirla();
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
            if (!hazir || !kutu.isConnected) { kutu.hidden = true; return; }
            kutu.innerHTML = '';
            try {
                new window.QRCode(kutu, { text: adres, width: 168, height: 168, correctLevel: window.QRCode.CorrectLevel.M });
                kutu.removeAttribute('title');
                kutu.hidden = false;
            } catch (e) {
                kutu.hidden = true;
            }
        });
    }

    // ---- Gönderilen belgeler ------------------------------------------
    async function gecmisYukle() {
        if (!panel) return;
        if (!panelDurum.gecmis) gecmisCiz();
        var c = await istek('/api/rapor/gecmis');
        if (c.kod === 200 && c.j.ok) {
            panelDurum.gecmis = c.j.liste || [];
            panelDurum.gecmisHata = '';
        } else {
            panelDurum.gecmisHata = c.kod === 404 ? 'Rapor servisi henüz kurulmadı.' : hataMetni(c);
        }
        gecmisCiz();
        // Bekleyen iş varsa panel açıkken listeyi canlı tut
        if (panelDurum.gecmisZaman) clearTimeout(panelDurum.gecmisZaman);
        var bekleyen = (panelDurum.gecmis || []).some(function (x) { return x.durum === 'bekliyor' || x.durum === 'hazirlaniyor'; });
        if (panelDurum.acik && bekleyen && !d.izlenen) panelDurum.gecmisZaman = setTimeout(gecmisYukle, 3000);
    }

    function gecmisCiz() {
        if (!panel) return;
        var yer = panel.querySelector('[data-sr="gecmis"]');
        var liste = panelDurum.gecmis;
        if (!liste && panelDurum.gecmisHata) {
            yer.innerHTML = '<div class="sr-bos"><strong>Liste alınamadı</strong><span>' + kacir(panelDurum.gecmisHata) +
                '</span><button type="button" class="sr-dugme sr-dugme--ikincil" data-sr="gecmis-tekrar">Yeniden dene</button></div>';
            return;
        }
        if (!liste) {
            var isk = '';
            for (var i = 0; i < 3; i++) {
                isk += '<li class="sr-satir sr-satir--iskelet"><span class="sr-satir__ikon"></span><div class="sr-satir__metin"><strong></strong><span></span></div></li>';
            }
            yer.innerHTML = '<ul class="sr-liste" aria-label="Yükleniyor">' + isk + '</ul>';
            return;
        }
        if (!liste.length) {
            yer.innerHTML = '<div class="sr-bos"><strong>Henüz rapor gönderilmedi</strong><span>Finans ekranında bir tablo seçip "Telegram\'a gönder"e bastığınızda burada görünür.</span></div>';
            return;
        }
        yer.innerHTML = '<ul class="sr-liste">' + liste.map(function (x) {
            var et = DURUM_ETIKETI[x.durum] || DURUM_ETIKETI.bekliyor;
            var ikonSinif = x.durum === 'gonderildi' ? 'gonderildi' : x.durum === 'hata' ? 'hata' : 'bekliyor';
            var ozet = [];
            if (x.ozet && x.ozet.net !== undefined && x.ozet.net !== null) {
                var sinif = x.ozet.net < 0 ? 'sr-satir__eksi' : x.ozet.net > 0 ? 'sr-satir__arti' : '';
                ozet.push('Net <b class="' + sinif + '">' + kacir(tl(x.ozet.net) || '₺0,00') + '</b>');
            }
            if (x.sayfa) ozet.push(x.sayfa + ' sayfa');
            return '<li class="sr-satir">' +
                '<span class="sr-satir__ikon sr-satir__ikon--' + ikonSinif + '">' + ikon[et[2]] + '</span>' +
                '<div class="sr-satir__metin">' +
                '<strong>' + kacir(x.tabloAd || x.tablo) + '</strong>' +
                (ozet.length ? '<span>' + ozet.join(' · ') + '</span>' : '') +
                '<span><b class="sr-satir__durum sr-satir__durum--' + et[1] + '">' + kacir(et[0]) + '</b> · ' + kacir(tarih(x.gonderildi || x.istendi, true)) + '</span>' +
                (x.durum === 'hata' && x.hata ? '<span class="sr-satir__hata">' + kacir(x.hata) + '</span>' : '') +
                '</div>' +
                (x.tekrar
                    ? '<button type="button" class="sr-ikon-dugme" data-sr="tekrar" data-id="' + kacir(x.id) + '" aria-label="' + kacir((x.tabloAd || x.tablo) + ' raporunu tekrar gönder') + '" title="Tekrar gönder">' + ikon.tekrar + '</button>'
                    : '') +
                '</li>';
        }).join('') + '</ul>';
    }

    async function tekrarGonder(dugme) {
        var id = dugme.getAttribute('data-id');
        if (!id || dugme.disabled) return;
        dugme.disabled = true;
        var c = await istek('/api/rapor/gecmis/' + encodeURIComponent(id) + '/tekrar', { method: 'POST' });
        if (c.kod === 202 && c.j.ok) {
            bekleBaslat(d.sinirSn);
            izle(c.j.id);
            bildir('Belge Telegram\'a yeniden gönderiliyor.', 'basari');
            gecmisYukle();
        } else {
            if (c.j.error === 'cok_sik' && c.j.bekleSn) bekleBaslat(c.j.bekleSn);
            bildir(hataMetni(c), c.j.error === 'cok_sik' ? 'uyari' : 'hata');
            dugme.disabled = false;
        }
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
        if (!sistemeBaglan()) {
            window.addEventListener('load', sistemeBaglan, { once: true });
        }
        // Finans sekmesi zaten açıksa (yeniden yükleme) hemen yükle
        var finans = document.getElementById('finansTabContent');
        if (finans && !finans.classList.contains('hidden')) durumYukle(false);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && d.izlenen === null && panelDurum.acik) gecmisYukle();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();

    window.JBSayimRapor = { ac: function () { panelAc(null); }, kapat: panelKapat };
})();
