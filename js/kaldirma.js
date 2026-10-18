/**
 * Satıştan Kaldırma sayfası
 * ============================================================================
 *
 * Depo panelinin "Satıştan Kaldırma Listesi" (fırın çıkışları hariç). Veriyi
 * Jet Barkod Asistan saatte bir aktarıyor; sayfa Jet Barkod API'sinden okuyor
 * (GET /api/kaldirma/liste). Telefonda da aynı liste görünür.
 *
 * Görünümler
 *   - Ürüne Göre: hangi üründen kaç adet (gruba atılacak bilgi bu)
 *   - Kayıtlar: gün gün, saatiyle tek tek kayıt
 * Rapor
 *   - Görseli İndir: sunucunun ürettiği PNG (telefonda paylaş menüsü açılır,
 *     "Görüntüyü Kaydet" ile galeriye)
 *   - Telegram'a Gönder: aynı görsel, bağlı Telegram hesaplarına
 * İptal edilen kayıt zaten anında Telegram'a gidiyor (sunucu bildiriyor).
 * ============================================================================
 */
(function (global) {
    'use strict';

    var HAK = 'satistanKaldirma';
    var BITMIS = { 210: true, 350: true, 500: true, 600: true };
    var IPTAL = 700;
    var VARSAYILAN_DURUMLAR = {
        100: 'Oluşturuldu', 150: 'Bekliyor', 160: 'Depo Aksiyonu Bekleniyor', 200: 'Onay Bekliyor',
        210: 'Onaylandı', 300: 'Transfer Edilecek', 350: 'Transfer Tamamlandı', 500: 'Sonuçlandı',
        600: 'Tamamlandı', 700: 'İptal Edildi'
    };
    var ADET_RENK = { 2: '#2563eb', 3: '#7c3aed', 4: '#d97706', 5: '#d92d20' };
    var YOKLAMA_MS = 60 * 1000;
    var AYAR = 'jb_kaldirma_ayar';

    var d = {
        aralik: 'bugun',
        bas: '', son: '',
        gorunum: 'urun',
        durum: 'hepsi',
        sebep: '',
        kayitlar: [],
        durumlar: VARSAYILAN_DURUMLAR,
        sonucTipleri: { 10: 'İade', 20: 'İmha', 30: 'Transfer', 40: 'Kurumsal Satış' },
        sonEsitleme: null,
        telegram: { hazir: false, hesap: 0 },
        yukleniyor: false,
        hata: '',
        ilk: true
    };

    function el(id) { return document.getElementById(id); }

    function kacir(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function bildir(metin, tur) {
        if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir(metin, tur || 'bilgi', 4200);
    }

    function adetYaz(n) {
        n = Number(n) || 0;
        return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
    }

    // ------------------------------------------------------------------
    // Tarih
    // ------------------------------------------------------------------

    function gunYaz(t) {
        return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
    }

    function aralikHesapla(a) {
        var bugun = new Date();
        var g = function (gunOnce) { return gunYaz(new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() - gunOnce)); };
        if (a === 'dun') return { bas: g(1), son: g(1) };
        if (a === '7') return { bas: g(6), son: g(0) };
        if (a === '30') return { bas: g(29), son: g(0) };
        if (a === 'ozel' && d.bas && d.son) return { bas: d.bas, son: d.son };
        return { bas: g(0), son: g(0) };
    }

    function gunEtiketi(s) {
        var p = s.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    }

    function saatYaz(iso) {
        try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
    }

    function tarihSaatYaz(iso) {
        try {
            return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ''; }
    }

    function gunBasligi(iso) {
        var t = new Date(iso);
        var bugun = new Date();
        var dun = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() - 1);
        if (gunYaz(t) === gunYaz(bugun)) return 'Bugün';
        if (gunYaz(t) === gunYaz(dun)) return 'Dün';
        return t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
    }

    function onceYaz(iso) {
        var dk = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        if (dk < 1) return 'az önce';
        if (dk < 60) return dk + ' dk önce';
        var sa = Math.floor(dk / 60);
        if (sa < 24) return sa + ' sa önce';
        return Math.floor(sa / 24) + ' gün önce';
    }

    // ------------------------------------------------------------------
    // Durum sınıfları
    // ------------------------------------------------------------------

    function durumSinifi(kod) {
        if (kod === IPTAL) return 'iptal';
        if (BITMIS[kod]) return 'biten';
        if (!d.durumlar[kod]) return 'bilinmeyen';
        return 'bekleyen';
    }

    /* "Yeniden girildi": iptal edilen kaydın ardından aynı ürün 7 gün içinde
       yeniden girilmiş ve o kayıt iptal değil. Depo kendi iptal edip doğru
       sebeple tekrar girmiş demek; iptal sayılmaz, sönük gösterilir. */
    function duzeltmeleriIsaretle(liste) {
        var urunler = {};
        liste.forEach(function (k) {
            var a = (k.urun && (k.urun.id || k.urun.ad)) || k.id;
            (urunler[a] = urunler[a] || []).push(k);
        });
        liste.forEach(function (k) {
            k._yeniden = false;
            if (k.durum !== IPTAL) return;
            var a = (k.urun && (k.urun.id || k.urun.ad)) || k.id;
            var t = Date.parse(k.olusturma);
            k._yeniden = (urunler[a] || []).some(function (x) {
                var tx = Date.parse(x.olusturma);
                return x !== k && x.durum !== IPTAL && tx > t && tx - t < 7 * 864e5;
            });
        });
    }

    /* Kaydın görünen sınıfı: yeniden girilen iptal "yeniden", 160 "red" */
    function kayitSinifi(k) {
        if (k._yeniden) return 'yeniden';
        if (k.durum === 160) return 'red';
        return durumSinifi(k.durum);
    }

    var DURUM_IKON = {
        biten: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 8.5 2.5 2.5L12 5.5"/></svg>',
        iptal: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 5 6 6M11 5l-6 6"/></svg>',
        red: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4.5v4M8 11v.5"/><circle cx="8" cy="8" r="5.5"/></svg>',
        bekleyen: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.5V8l1.5 1.5"/></svg>',
        yeniden: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8a4 4 0 0 1 7-2.6M12 4v2.5H9.5M12 8a4 4 0 0 1-7 2.6M4 12V9.5h2.5"/></svg>',
        bilinmeyen: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4.5v4M8 11v.5"/><circle cx="8" cy="8" r="5.5"/></svg>'
    };

    function kayitCipi(k) {
        var s = kayitSinifi(k);
        var ad = s === 'yeniden' ? 'Yeniden Girildi' : s === 'red' ? 'Reddedildi' : durumAdi(k.durum);
        return '<span class="kld-d kld-d--' + s + '">' + (DURUM_IKON[s] || '') + kacir(ad) + '</span>';
    }

    function durumAdi(kod) {
        return d.durumlar[kod] || ('Durum ' + kod);
    }

    function durumCipi(kod) {
        var s = durumSinifi(kod);
        return '<span class="kld-d kld-d--' + s + '">' + kacir(durumAdi(kod)) + '</span>';
    }

    function filtreUyar(k) {
        if (d.sebep && (k.sebep || 'Sebep yok') !== d.sebep) return false;
        if (d.durum === 'hepsi') return true;
        var s = kayitSinifi(k);
        if (d.durum === 'bekleyen') return s === 'bekleyen' || s === 'bilinmeyen' || s === 'red';
        return s === d.durum;
    }

    // ------------------------------------------------------------------
    // API
    // ------------------------------------------------------------------

    async function istek(yol, secenek) {
        var a = global.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { kod: 401, j: { error: 'unauthorized' } };
        try {
            var r = await a.apiFetch(yol, secenek || {});
            var j = null;
            if (secenek && secenek.ham && r.ok) return { kod: r.status, blob: await r.blob(), j: {} };
            try { j = await r.json(); } catch (e) { /* gövde yok */ }
            return { kod: r.status, j: j || {} };
        } catch (e) {
            return { kod: 0, j: { error: 'ag' } };
        }
    }

    function hataMetni(c) {
        var k = c && c.j && c.j.error;
        if (c && c.kod === 401) return 'Oturum doldu. Sayfayı yenileyip tekrar giriş yap.';
        if (k === 'kurulum_bekleniyor' || (c && c.kod === 404)) return 'Sunucu güncellemesi bekleniyor. Kurulum bitince liste burada görünecek.';
        if (k === 'cok_sik') return 'Çok sık istendi. ' + ((c.j && c.j.bekleSn) || 15) + ' sn sonra tekrar dene.';
        if (k === 'saatlik_sinir') return 'Saatlik rapor sınırı doldu. Biraz sonra tekrar dene.';
        if (k === 'baglanti_yok') return 'Telegram hesabı bağlı değil.';
        if (k === 'bot_hazir_degil') return 'Telegram botu şu an hazır değil.';
        if (k === 'gonderilemedi') return 'Telegram\'a gönderilemedi. Bot engellenmiş olabilir; hesabı yeniden bağla.';
        if (c && c.kod === 0) return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.';
        return 'İşlem yapılamadı. Biraz sonra tekrar dene.';
    }

    async function yukle(sessiz) {
        var a = aralikHesapla(d.aralik);
        if (!sessiz) { d.yukleniyor = true; ciz(); }
        var c = await istek('/api/kaldirma/liste?bas=' + a.bas + '&son=' + a.son);
        d.yukleniyor = false;
        if (c.kod === 200 && c.j.ok) {
            d.kayitlar = Array.isArray(c.j.kayitlar) ? c.j.kayitlar : [];
            duzeltmeleriIsaretle(d.kayitlar);
            if (c.j.durumlar) d.durumlar = Object.assign({}, VARSAYILAN_DURUMLAR, c.j.durumlar);
            if (c.j.sonucTipleri) d.sonucTipleri = c.j.sonucTipleri;
            d.sonEsitleme = c.j.sonEsitleme || null;
            d.telegram = c.j.telegram || d.telegram;
            d.hata = '';
        } else if (!sessiz || !d.kayitlar.length) {
            d.hata = hataMetni(c);
        }
        d.ilk = false;
        ciz();
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------

    function durumCiz() {
        var p = el('kldDurum');
        if (!p) return;
        var taze = d.sonEsitleme && Date.now() - new Date(d.sonEsitleme).getTime() < 75 * 60 * 1000;
        p.className = 'kld-durum' + (d.sonEsitleme ? (taze ? ' kld-durum--taze' : ' kld-durum--bayat') : '');
        p.querySelector('span').textContent = d.sonEsitleme
            ? 'Son aktarım ' + saatYaz(d.sonEsitleme) + ' · ' + onceYaz(d.sonEsitleme)
            : (d.ilk ? 'Yükleniyor' : 'Henüz aktarım yok');
    }

    function ozetCiz(liste) {
        var adet = 0, bekleyen = 0, iptal = 0;
        liste.forEach(function (k) {
            if (!k._yeniden) adet += Number(k.adet) || 0;
            var s = kayitSinifi(k);
            if (s === 'iptal') iptal++;
            else if (s !== 'biten' && s !== 'yeniden') bekleyen++;
        });
        var yaz = function (ad, v, renk) {
            var b = document.querySelector('[data-ozet="' + ad + '"]');
            if (!b) return;
            b.textContent = d.yukleniyor && d.ilk ? '–' : v;
            b.parentNode.className = 'kld-kutu' + (renk ? ' kld-kutu--' + renk : '');
        };
        yaz('kayit', String(liste.length));
        yaz('adet', adetYaz(adet));
        yaz('bekleyen', String(bekleyen), bekleyen ? 'sari' : '');
        yaz('iptal', String(iptal), iptal ? 'kirmizi' : '');
    }

    function sebepCiz(liste) {
        var bolum = el('kldSebepler');
        var harita = {};
        liste.forEach(function (k) {
            if (k._yeniden) return;
            var s = k.sebep || 'Sebep yok';
            harita[s] = (harita[s] || 0) + (Number(k.adet) || 0);
        });
        var sirali = Object.keys(harita).map(function (s) { return [s, harita[s]]; }).sort(function (a, b) { return b[1] - a[1]; });
        bolum.hidden = !sirali.length;
        if (!sirali.length) return;
        var enCok = sirali[0][1] || 1;
        el('kldSebepListe').innerHTML = sirali.slice(0, 8).map(function (x) {
            var secili = d.sebep === x[0];
            return '<button type="button" class="kld-sebep' + (secili ? ' is-secili' : '') + '" data-sebep="' + kacir(x[0]) + '" aria-pressed="' + secili + '">' +
                '<span class="kld-sebep__ust"><span class="kld-sebep__ad">' + kacir(x[0]) + '</span><b>' + adetYaz(x[1]) + '</b></span>' +
                '<span class="kld-sebep__cubuk"><i style="transform:scaleX(' + Math.max(0.03, x[1] / enCok).toFixed(3) + ')"></i></span>' +
            '</button>';
        }).join('');
        var not = el('kldSebepFiltre');
        not.hidden = !d.sebep;
        if (d.sebep) not.innerHTML = '<span>Sebep: <b>' + kacir(d.sebep) + '</b></span><button type="button" data-sebep-temizle>Temizle</button>';
    }

    function gorselHtml(u, sinif) {
        var g = u && u.gorsel;
        return /^https:\/\//.test(g || '')
            ? '<img class="' + sinif + '" src="' + kacir(g) + '" alt="" loading="lazy" decoding="async">'
            : '<span class="' + sinif + ' ' + sinif + '--bos" aria-hidden="true"></span>';
    }

    function adetRozeti(n, sinif) {
        var renk = ADET_RENK[Math.min(5, Math.floor(Number(n) || 0))];
        return '<span class="' + sinif + '"' + (renk ? ' style="background:' + renk + '"' : '') + '><small>×</small>' + adetYaz(n) + '</span>';
    }

    function urunlereTopla(liste) {
        var h = {};
        var sira = [];
        liste.forEach(function (k) {
            var u = k.urun || {};
            var a = u.id || u.ad || k.id;
            if (!h[a]) { h[a] = { anahtar: a, urun: u, adet: 0, kayitlar: [], sebepler: {}, son: 0 }; sira.push(a); }
            var x = h[a];
            x.son = Math.max(x.son, Date.parse(k.olusturma) || 0);
            x.kayitlar.push(k);
            if (k._yeniden) return; // yeniden girilen iptal adede ve sebebe sayılmaz
            x.adet += Number(k.adet) || 0;
            var s = k.sebep || 'Sebep yok';
            x.sebepler[s] = (x.sebepler[s] || 0) + (Number(k.adet) || 0);
        });
        // En son çıkılan en başta
        return sira.map(function (a) { return h[a]; }).sort(function (a, b) {
            return b.son - a.son || String(a.urun.ad || '').localeCompare(String(b.urun.ad || ''), 'tr');
        });
    }

    function urunGorunumu(liste) {
        var urunler = urunlereTopla(liste);
        return '<div class="kld-izgara">' + urunler.map(function (x) {
            var sebep = Object.keys(x.sebepler).sort(function (a, b) { return x.sebepler[b] - x.sebepler[a]; })[0];
            var siniflar = x.kayitlar.map(kayitSinifi);
            var gercek = siniflar.filter(function (s) { return s !== 'yeniden'; });
            var durum = gercek.indexOf('iptal') !== -1 ? 'iptal'
                : gercek.indexOf('red') !== -1 ? 'red'
                : gercek.some(function (s) { return s === 'bekleyen' || s === 'bilinmeyen'; }) ? 'bekleyen'
                : gercek.length ? 'biten' : 'yeniden';
            var DURUM_YAZI = { iptal: 'İptal Edildi', red: 'Reddedildi', bekleyen: 'Bekliyor', biten: 'Tamamlandı', yeniden: 'Yeniden Girildi' };
            var red = x.kayitlar.filter(function (k) { return k.red && k.red.baslik && kayitSinifi(k) !== 'yeniden'; })[0];
            var foto = x.kayitlar.reduce(function (t, k) { return t + (Number(k.foto) || 0); }, 0);
            return '<button type="button" class="kld-urun kld-urun--' + durum + '" data-urun="' + kacir(x.anahtar) + '">' +
                '<span class="kld-urun__gorsel">' + gorselHtml(x.urun, 'kld-urun__img') + adetRozeti(x.adet, 'kld-urun__adet') +
                    '<span class="kld-urun__durum kld-d kld-d--' + durum + '">' + (DURUM_IKON[durum] || '') + DURUM_YAZI[durum] + '</span>' +
                    (foto ? '<span class="kld-urun__foto" title="' + foto + ' hasar fotoğrafı">' + IKON_KAMERA + foto + '</span>' : '') +
                '</span>' +
                '<span class="kld-urun__ad">' + kacir(x.urun.ad || 'Ürün') + '</span>' +
                '<span class="kld-urun__alt"><span class="kld-urun__sebep">' + kacir(sebep) + '</span></span>' +
                (red ? '<span class="kld-urun__red">' + kacir(red.red.baslik) + '</span>' : '') +
                '<span class="kld-urun__sayi">' + kacir(onceYaz(new Date(x.son).toISOString())) + (x.kayitlar.length > 1 ? ' · ' + x.kayitlar.length + ' kayıt' : '') + '</span>' +
            '</button>';
        }).join('') + '</div>';
    }

    function kayitSatiri(k) {
        var u = k.urun || {};
        return '<button type="button" class="kld-satir kld-satir--' + kayitSinifi(k) + '" data-urun="' + kacir(u.id || u.ad || k.id) + '">' +
            '<span class="kld-satir__saat">' + saatYaz(k.olusturma) + '</span>' +
            gorselHtml(u, 'kld-satir__img') +
            '<span class="kld-satir__metin"><span class="kld-satir__ad">' + kacir(u.ad || 'Ürün') + '</span>' +
            '<span class="kld-satir__alt">' + kacir(k.sebep || 'Sebep yok') + (k.altNeden ? ' · ' + kacir(k.altNeden) : '') + (k.olusturan ? ' · ' + kacir(k.olusturan) : '') + '</span>' +
            (k.red && k.red.baslik && kayitSinifi(k) !== 'yeniden' ? '<span class="kld-satir__red">' + kacir(k.red.baslik) + '</span>' : '') +
            '</span>' +
            '<span class="kld-satir__sag">' + adetRozeti(k.adet, 'kld-satir__adet') + kayitCipi(k) + '</span>' +
        '</button>';
    }

    function kayitGorunumu(liste) {
        var gunler = {};
        var sira = [];
        liste.slice().sort(function (a, b) { return new Date(b.olusturma) - new Date(a.olusturma); }).forEach(function (k) {
            var g = gunYaz(new Date(k.olusturma));
            if (!gunler[g]) { gunler[g] = []; sira.push(g); }
            gunler[g].push(k);
        });
        return sira.map(function (g) {
            var adet = gunler[g].reduce(function (t, k) { return t + (Number(k.adet) || 0); }, 0);
            return '<div class="kld-gun"><h3><span>' + kacir(gunBasligi(gunler[g][0].olusturma)) + '</span><small>' +
                gunler[g].length + ' kayıt · ' + adetYaz(adet) + ' adet</small></h3>' +
                '<div class="kld-gun__liste">' + gunler[g].map(kayitSatiri).join('') + '</div></div>';
        }).join('');
    }

    function iskelet() {
        var parca = '';
        for (var i = 0; i < 8; i++) parca += '<div class="kld-urun kld-urun--iskelet" aria-hidden="true"><span class="kld-urun__gorsel"></span><span class="kld-iskelet-metin"></span><span class="kld-iskelet-metin kld-iskelet-metin--kisa"></span></div>';
        return '<div class="kld-izgara">' + parca + '</div>';
    }

    function bosDurum(baslik, metin, ikon) {
        return '<div class="kld-bos"><span class="kld-bos__ikon">' + ikon + '</span><strong>' + kacir(baslik) + '</strong><p>' + kacir(metin) + '</p></div>';
    }

    var IKON_KAMERA = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5.5h2l1-1.5h5l1 1.5h2v7h-11z"/><circle cx="8" cy="8.5" r="2"/></svg>';
    var IKON_BOS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M3 4h18v3H3zM10 11h4"/></svg>';
    var IKON_HATA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5h.01"/><path d="M10.3 3.9 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>';

    function ciz() {
        durumCiz();
        var liste = d.kayitlar.filter(filtreUyar);
        var tumu = d.kayitlar.filter(function (k) { return !d.sebep || (k.sebep || 'Sebep yok') === d.sebep; });
        ozetCiz(d.sebep ? tumu : d.kayitlar);
        sebepCiz(d.kayitlar);
        var kap = el('kldListe');
        if (d.yukleniyor && d.ilk) { kap.innerHTML = iskelet(); return; }
        if (d.hata && !d.kayitlar.length) { kap.innerHTML = bosDurum('Liste yüklenemedi', d.hata, IKON_HATA); return; }
        if (!d.kayitlar.length) {
            kap.innerHTML = bosDurum('Bu aralıkta kayıt yok',
                d.sonEsitleme ? 'Depo panelinde bu tarihlerde satıştan kaldırılan ürün görünmüyor.'
                    : 'Depo panelinin açık olduğu bilgisayarda Jet Barkod Asistan listeyi saatte bir aktarır.', IKON_BOS);
            return;
        }
        if (!liste.length) { kap.innerHTML = bosDurum('Bu filtrede kayıt yok', 'Durum ya da sebep filtresini değiştir.', IKON_BOS); return; }
        kap.innerHTML = d.gorunum === 'kayit' ? kayitGorunumu(liste) : urunGorunumu(liste);
    }

    function segmentYaz() {
        document.querySelectorAll('[data-gorunum]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-gorunum') === d.gorunum)); });
        document.querySelectorAll('[data-durum]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-durum') === d.durum)); });
        document.querySelectorAll('[data-aralik]').forEach(function (b) {
            var s = b.getAttribute('data-aralik') === d.aralik;
            b.classList.toggle('is-secili', s);
            b.setAttribute('aria-checked', String(s));
        });
        var oz = el('kldOzelYazi');
        if (oz) oz.textContent = d.aralik === 'ozel' && d.bas ? (d.bas === d.son ? gunEtiketi(d.bas) : gunEtiketi(d.bas) + ' - ' + gunEtiketi(d.son)) : 'Tarih Seç';
    }

    // ------------------------------------------------------------------
    // Detay paneli
    // ------------------------------------------------------------------

    var sonOdak = null;

    function detayAc(anahtar) {
        var liste = d.kayitlar.filter(function (k) { var u = k.urun || {}; return (u.id || u.ad || k.id) === anahtar; });
        if (!liste.length) return;
        var u = liste[0].urun || {};
        var adet = liste.reduce(function (t, k) { return t + (Number(k.adet) || 0); }, 0);
        var img = el('kldDetayGorsel');
        if (/^https:\/\//.test(u.gorsel || '')) { img.src = u.gorsel; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
        el('kldDetayAd').textContent = u.ad || 'Ürün';
        el('kldDetayAlt').textContent = adetYaz(adet) + ' adet · ' + liste.length + ' kayıt' + (u.barkod ? ' · ' + u.barkod : '');
        el('kldDetayGovde').innerHTML = liste.slice().sort(function (a, b) { return new Date(b.olusturma) - new Date(a.olusturma); }).map(function (k) {
            var gecmis = Array.isArray(k.gecmis) ? k.gecmis.filter(function (g) { return g && g.zaman; }) : [];
            var bilgi = [];
            if (k.altNeden) bilgi.push(['Alt Neden', k.altNeden, true]);
            if (k.skt) bilgi.push(['SKT', tarihYaz(k.skt)]);
            if (k.skt && typeof k.oluGun === 'number') bilgi.push(['Kaldırılabileceği Tarih', tarihYaz(new Date(Date.parse(k.skt) - k.oluGun * 864e5).toISOString())]);
            if (k.sonucTipi && d.sonucTipleri[k.sonucTipi]) bilgi.push(['Sonuç', d.sonucTipleri[k.sonucTipi]]);
            if (k.nereden || k.nereye) bilgi.push(['Yer', (k.nereden || '?') + ' → ' + (k.nereye || '?')]);
            if (k.olusturan) bilgi.push(['Oluşturan', k.olusturan]);
            var sinif = kayitSinifi(k);
            var foto = Math.min(4, Number(k.foto) || 0);
            var fotolar = '';
            for (var i = 1; i <= foto; i++) fotolar += '<button type="button" class="kld-foto" data-foto="' + kacir(k.id) + '/' + i + '" aria-label="Hasar fotoğrafı ' + i + '"><span class="kld-foto__yer"></span></button>';
            return '<article class="kld-kayit kld-kayit--' + sinif + '">' +
                '<div class="kld-kayit__ust"><div><b>' + adetYaz(k.adet) + ' adet</b><span>' + kacir(k.sebep || 'Sebep yok') + '</span></div>' + kayitCipi(k) + '</div>' +
                '<p class="kld-kayit__zaman">' + kacir(tarihSaatYaz(k.olusturma)) + '</p>' +
                (sinif === 'yeniden' ? '<p class="kld-kayit__not">Bu kayıt iptal edildikten sonra ürün yeniden girildi; iptal sayılmıyor.</p>' : '') +
                (k.red && (k.red.baslik || k.red.aciklama)
                    ? '<div class="kld-red"><b>' + kacir(k.red.baslik || 'Red sebebi') + '</b>' + (k.red.aciklama ? '<span>' + kacir(k.red.aciklama) + '</span>' : '') + '</div>' : '') +
                (fotolar ? '<div class="kld-fotolar">' + fotolar + '</div>' : '') +
                (bilgi.length ? '<dl class="kld-kayit__bilgi">' + bilgi.map(function (b) { return '<div' + (b[2] ? ' class="genis"' : '') + '><dt>' + kacir(b[0]) + '</dt><dd>' + kacir(b[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
                (gecmis.length > 1 ? '<ol class="kld-gecmis">' + gecmis.map(function (g) {
                    return '<li><i class="kld-gecmis__nokta kld-gecmis__nokta--' + (g.durum === 160 ? 'red' : durumSinifi(g.durum)) + '"></i><span>' + kacir(durumAdi(g.durum)) + (g.kisi ? ' · ' + kacir(g.kisi) : '') + '</span><time>' + kacir(tarihSaatYaz(g.zaman)) + '</time></li>';
                }).join('') + '</ol>' : '') +
            '</article>';
        }).join('');
        fotolariYukle();
        var k = el('kldDetay');
        sonOdak = document.activeElement;
        k.hidden = false;
        document.body.classList.add('kld-kilit');
        void k.offsetWidth; // başlangıç konumu çizilsin, sonra geçiş başlasın
        k.classList.add('acik');
        var kapat = k.querySelector('.kld-kapat');
        if (kapat) kapat.focus({ preventScroll: true });
    }

    function tarihYaz(iso) {
        var t = Date.parse(iso);
        return Number.isFinite(t) ? new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    }

    /* Hasar fotoğrafları: panelin linkleri, doğrudan gösterilir. Linkler
       süreli; Asistan her saatlik aktarımda tazeler. Süresi dolmuşsa not düşülür. */
    var fotoAdresleri = {};
    async function fotolariYukle() {
        var govde = el('kldDetayGovde');
        var dugmeler = govde.querySelectorAll('[data-foto]');
        var kayitlar = {};
        dugmeler.forEach(function (b) { kayitlar[b.getAttribute('data-foto').split('/')[0]] = true; });
        await Promise.all(Object.keys(kayitlar).map(async function (id) {
            var c = await istek('/api/kaldirma/fotolar/' + id);
            var liste = c.kod === 200 && c.j.ok && Array.isArray(c.j.adresler) ? c.j.adresler : [];
            liste.forEach(function (u, i) { if (/^https:\/\//.test(u)) fotoAdresleri[id + '/' + (i + 1)] = u; });
        }));
        dugmeler.forEach(function (b) {
            var adres = fotoAdresleri[b.getAttribute('data-foto')];
            if (!b.isConnected) return;
            if (!adres) { b.classList.add('is-yok'); return; }
            var img = new Image();
            img.alt = '';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.onerror = function () { b.classList.add('is-suresi'); b.innerHTML = '<span>Link süresi doldu</span>'; };
            img.src = adres;
            b.innerHTML = '';
            b.appendChild(img);
        });
    }

    function fotoBuyut(anahtar) {
        var adres = fotoAdresleri[anahtar];
        if (!adres) return;
        var k = document.createElement('div');
        k.className = 'kld-buyuk';
        k.setAttribute('role', 'dialog');
        k.setAttribute('aria-label', 'Hasar fotoğrafı');
        k.innerHTML = '<img alt="" referrerpolicy="no-referrer"><button type="button" class="kld-kapat" aria-label="Kapat"><svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg></button>';
        k.querySelector('img').src = adres;
        k.addEventListener('click', function () { k.remove(); });
        document.body.appendChild(k);
        k.querySelector('button').focus({ preventScroll: true });
    }

    function detayKapat() {
        var k = el('kldDetay');
        if (k.hidden) return;
        k.classList.remove('acik');
        document.body.classList.remove('kld-kilit');
        setTimeout(function () { k.hidden = true; }, 220);
        if (sonOdak && sonOdak.focus) sonOdak.focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------
    // Rapor ve güncelleme
    // ------------------------------------------------------------------

    function mesgul(dugme, acik, yazi) {
        if (!dugme) return;
        dugme.disabled = acik;
        dugme.classList.toggle('is-mesgul', acik);
        var s = dugme.querySelector('span');
        if (s) {
            if (acik) { s.setAttribute('data-eski', s.textContent); s.textContent = yazi; }
            else if (s.getAttribute('data-eski')) s.textContent = s.getAttribute('data-eski');
        }
    }

    async function gorselIndir() {
        var dugme = el('kldIndir');
        var a = aralikHesapla(d.aralik);
        mesgul(dugme, true, 'Hazırlanıyor');
        var c = await istek('/api/kaldirma/kart?bas=' + a.bas + '&son=' + a.son, { ham: true });
        mesgul(dugme, false);
        if (!c.blob) { bildir(hataMetni(c), 'hata'); return; }
        var ad = 'satistan-kaldirma-' + a.bas + (a.son !== a.bas ? '_' + a.son : '') + '.png';
        // Telefonda paylaş menüsü: "Görüntüyü Kaydet" doğrudan galeriye
        try {
            var dosya = new File([c.blob], ad, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [dosya] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
                await navigator.share({ files: [dosya], title: 'Satıştan Kaldırma' });
                return;
            }
        } catch (e) {
            if (e && e.name === 'AbortError') return; // kullanıcı paylaşımı kapattı
        }
        var url = URL.createObjectURL(c.blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = ad;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    }

    async function telegramaGonder() {
        var dugme = el('kldTelegram');
        var a = aralikHesapla(d.aralik);
        mesgul(dugme, true, 'Gönderiliyor');
        var c = await istek('/api/kaldirma/rapor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bas: a.bas, son: a.son })
        });
        mesgul(dugme, false);
        if (c.kod === 200 && c.j.ok) { bildir('Rapor Telegram\'a gönderildi.', 'basari'); return; }
        if (c.j && c.j.error === 'baglanti_yok') { telegramBagla(); return; }
        bildir(hataMetni(c), 'hata');
    }

    async function telegramBagla() {
        var onay = global.JBDiyalog && global.JBDiyalog.onay
            ? await global.JBDiyalog.onay('Raporlar ve iptal bildirimleri için Telegram hesabını bağla. Telegram açılınca Başlat\'a bas, sonra tekrar gönder.', { baslik: 'Telegram Bağlı Değil', onayYazi: 'Telegram\'ı Bağla' })
            : true;
        if (!onay) return;
        var c = await istek('/api/rapor/bagla', { method: 'POST' });
        if (c.kod === 200 && c.j.adres) { global.open(c.j.adres, '_blank', 'noopener'); return; }
        bildir(hataMetni(c), 'hata');
    }

    var tazeleBekleyen = null;

    function tazele() {
        var dugme = el('kldTazele');
        var asistan = global.JetBarkodAsistan && global.JetBarkodAsistan.durum;
        if (!asistan || !asistan.kurulu) {
            bildir('Bu cihazda Jet Barkod Asistan yok. Liste, depo panelinin açık olduğu bilgisayardan saatte bir gelir.', 'bilgi');
            yukle(true);
            return;
        }
        mesgul(dugme, true, 'Güncelleniyor');
        clearTimeout(tazeleBekleyen);
        tazeleBekleyen = setTimeout(function () {
            mesgul(dugme, false);
            bildir('Jet Barkod Asistan yanıt vermedi.', 'hata');
        }, 100000);
        global.postMessage({ type: 'JB_KALDIRMA_TAZELE' }, location.origin);
    }

    global.addEventListener('message', function (e) {
        if (e.source !== global || e.origin !== location.origin) return;
        var m = e.data;
        if (!m || m.type !== 'JB_KALDIRMA_SONUC') return;
        clearTimeout(tazeleBekleyen);
        mesgul(el('kldTazele'), false);
        bildir(m.metin || (m.ok ? 'Güncellendi.' : 'Güncellenemedi.'), m.ok ? 'basari' : 'hata');
        if (m.ok) yukle(true);
    });

    // ------------------------------------------------------------------
    // Olaylar ve açılış
    // ------------------------------------------------------------------

    function ayarYaz() {
        try { localStorage.setItem(AYAR, JSON.stringify({ aralik: d.aralik === 'ozel' ? 'bugun' : d.aralik, gorunum: d.gorunum })); } catch (e) { /* sessiz */ }
    }

    function olaylariBagla() {
        el('kldTarihler').addEventListener('click', function (e) {
            var b = e.target.closest('[data-aralik]');
            if (!b) return;
            var a = b.getAttribute('data-aralik');
            if (a === 'ozel') {
                var oz = el('kldOzel');
                oz.hidden = !oz.hidden;
                var bugun = gunYaz(new Date());
                el('kldBas').max = bugun;
                el('kldSon').max = bugun;
                if (!el('kldBas').value) el('kldBas').value = d.bas || bugun;
                if (!el('kldSon').value) el('kldSon').value = d.son || bugun;
                return;
            }
            el('kldOzel').hidden = true;
            d.aralik = a;
            d.sebep = '';
            segmentYaz();
            ayarYaz();
            d.ilk = true;
            yukle();
        });
        el('kldOzelUygula').addEventListener('click', function () {
            var b = el('kldBas').value;
            var s = el('kldSon').value;
            if (!b || !s) { bildir('Başlangıç ve bitiş tarihini seç.', 'uyari'); return; }
            if (s < b) { var t = b; b = s; s = t; }
            var fark = (new Date(s) - new Date(b)) / 86400000;
            if (fark > 61) { bildir('En fazla 62 günlük aralık seçilebilir.', 'uyari'); return; }
            d.bas = b; d.son = s; d.aralik = 'ozel'; d.sebep = '';
            el('kldOzel').hidden = true;
            segmentYaz();
            d.ilk = true;
            yukle();
        });
        document.querySelectorAll('[data-gorunum]').forEach(function (b) {
            b.addEventListener('click', function () { d.gorunum = b.getAttribute('data-gorunum'); segmentYaz(); ayarYaz(); ciz(); });
        });
        document.querySelectorAll('[data-durum]').forEach(function (b) {
            b.addEventListener('click', function () { d.durum = b.getAttribute('data-durum'); segmentYaz(); ciz(); });
        });
        el('kldSebepler').addEventListener('click', function (e) {
            var b = e.target.closest('[data-sebep]');
            if (!b) return;
            var s = b.getAttribute('data-sebep');
            d.sebep = d.sebep === s ? '' : s;
            ciz();
        });
        el('kldSebepFiltre').addEventListener('click', function (e) {
            if (e.target.closest('[data-sebep-temizle]')) { d.sebep = ''; ciz(); }
        });
        el('kldListe').addEventListener('click', function (e) {
            var b = e.target.closest('[data-urun]');
            if (b) detayAc(b.getAttribute('data-urun'));
        });
        el('kldDetayGovde').addEventListener('click', function (e) {
            var f = e.target.closest('[data-foto]');
            if (f && !f.classList.contains('is-suresi')) { e.stopPropagation(); fotoBuyut(f.getAttribute('data-foto')); }
        });
        el('kldDetay').addEventListener('click', function (e) {
            if (e.target.closest('[data-kapat]')) detayKapat();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var b = document.querySelector('.kld-buyuk');
            if (b) b.remove(); else detayKapat();
        });
        el('kldIndir').addEventListener('click', gorselIndir);
        el('kldTelegram').addEventListener('click', telegramaGonder);
        el('kldTazele').addEventListener('click', tazele);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) yukle(true); });
        setInterval(function () { if (!document.hidden) yukle(true); }, YOKLAMA_MS);
        setInterval(durumCiz, 30000);
    }

    function bolumGoster(id) {
        ['kldGiris', 'kldYetkiYok', 'kldIcerik'].forEach(function (x) {
            var e = el(x);
            if (e) e.hidden = (x !== id);
        });
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
        if (!o || !o.username) { bolumGoster('kldGiris'); return; }
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;
        if (!(await hakVarMi())) { bolumGoster('kldYetkiYok'); return; }
        try {
            var ayar = JSON.parse(localStorage.getItem(AYAR) || '{}');
            if (['bugun', 'dun', '7', '30'].indexOf(ayar.aralik) !== -1) d.aralik = ayar.aralik;
            if (ayar.gorunum === 'kayit' || ayar.gorunum === 'urun') d.gorunum = ayar.gorunum;
        } catch (e) { /* varsayılan */ }
        bolumGoster('kldIcerik');
        segmentYaz();
        olaylariBagla();
        yukle();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
