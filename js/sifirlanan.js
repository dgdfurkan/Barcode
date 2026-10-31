/**
 * Sayım Farkı (/sifirlanan/)
 * ============================================================================
 * Veri: GET /api/sayim-fark/rapor?bas&son&tur (vps-api/sayim-fark.js), kaynağı
 * public.sayim_gecmisi. Her sayım görevi ayrı olay: ürün sonradan yeniden
 * sayılsa da sıfırlanma kaydı listede kalır.
 *
 * GÖRÜNÜMLER
 *   Ürünler   Ürün başına; aralıkta bir kez bile sıfırlandıysa "Sıfırlanan",
 *             değilse net farkın yönüne göre "Eksik" ya da "Fazla". Birden
 *             çok sayımı olan ürünün geçmişi satırın altında açılır.
 *   Sayımlar  Panel sayımları tek tek; içinde farkı olan ürünler.
 * Görsel, barkod ve kategori Jet Barkod kataloğundan (PRODUCTS_DATA).
 * Barkoda basınca kopyalanır; "Barkodları Kopyala" görünen listenin hepsini.
 *
 * PANELDEN GÜNCELLE
 *   Seçili aralığın sayımlarını Jet Barkod Asistan depo panelinden okur
 *   (Sayım Geçmişi'nin yolu: JB_SAYIM_GECMISI_ISTEK). Gelen kayıtlar
 *   /api/sayim-gecmisi/yaz ile sunucuya; eksiksiz okunmuş sayımlar
 *   (sunucunun "tam" listesi) yeniden istenmez.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var HAKLAR = ['stokSayimi', 'jetBarkodAsistan'];
    var KIMLIK = /^[0-9a-f]{24}$/i;
    var EN_COK_GUN = 93;
    var DURUMLAR = ['sifir', 'eksik', 'fazla'];
    var GRUP_AD = { sifir: 'Sıfırlanan', eksik: 'Eksik Çıkan', fazla: 'Fazla Çıkan' };
    var OLAY_AD = { sifir: 'Sıfırlandı', eksik: 'Eksik çıktı', fazla: 'Fazla çıktı' };
    var YAZ_PARCA = 300;

    var IKON = {
        kopya: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9.5" height="9.5" rx="2"/><path d="M13 7V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V11a2 2 0 0 0 2 2H7"/></svg>',
        ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 8 4.5 4.5L14.5 8"/></svg>',
        urun: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
        sayim: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="3.5" width="11" height="13.5" rx="2"/><path d="M7.5 3.5h5V6h-5z"/><path d="M7.5 10.5h5M7.5 13.5h3"/></svg>',
        bos: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 10h8M8 14h5"/></svg>',
        uyari: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/></svg>'
    };

    var d = {
        hazir: 'son30', bas: null, son: null, tur: 'hepsi',
        durum: { sifir: true, eksik: true, fazla: true },
        ara: '', gorunum: 'urun',
        veri: null, yukleniyor: false, hata: null, istekNo: 0,
        acik: new Set(),
        tarama: null
    };

    function el(id) { return document.getElementById(id); }

    function kacis(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function bildir(metin, tur) {
        if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir(metin, tur || 'bilgi', 3200);
    }

    // ------------------------------------------------------------------
    // Katalog: kimlik → ad, kategori, görsel, barkod
    // ------------------------------------------------------------------

    var URUN = (function () {
        var m = new Map();
        var v = null;
        try { v = typeof PRODUCTS_DATA !== 'undefined' ? PRODUCTS_DATA : global.PRODUCTS_DATA; } catch (e) { v = null; } // eslint-disable-line no-undef
        var liste = v && Array.isArray(v.products) ? v.products : [];
        for (var i = 0; i < liste.length; i++) {
            var u = liste[i];
            if (!u || !u.id) continue;
            var barkodlar = Array.isArray(u.barcodes) ? u.barcodes.map(function (b) { return b && b.code ? String(b.code) : ''; }).filter(Boolean) : [];
            m.set(String(u.id), {
                ad: u.name || '', kategori: u.category || '',
                gorsel: typeof u.image === 'string' && /^https:\/\//.test(u.image) ? u.image : '',
                barkod: barkodlar[0] || '', barkodlar: barkodlar
            });
        }
        return m;
    })();

    function urunBilgi(p, ad) {
        return URUN.get(String(p)) || { ad: ad || '', kategori: '', gorsel: '', barkod: '', barkodlar: [] };
    }

    // ------------------------------------------------------------------
    // Biçim
    // ------------------------------------------------------------------

    function sayi(n) {
        var v = Number(n);
        if (!Number.isFinite(v)) return '-';
        return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000).replace('.', ',');
    }
    function isaretli(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + sayi(Math.abs(n)); }

    function gunYaz(t) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(t)); }
    function tarihSaat(iso) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        return new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
    function uzunTarih(iso) {
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '';
        return new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    }
    function gunMetni(g) {
        return new Date(g + 'T12:00:00Z').toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long' });
    }

    // ------------------------------------------------------------------
    // Sunucu
    // ------------------------------------------------------------------

    async function istek(yol, govde) {
        var a = global.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { kod: 401, j: {} };
        try {
            var r = await a.apiFetch(yol, govde ? {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde)
            } : {});
            var j = null;
            try { j = await r.json(); } catch (e) { /* gövde yok */ }
            return { kod: r.status, j: j || {} };
        } catch (e) { return { kod: 0, j: {} }; }
    }

    async function veriYukle() {
        var no = ++d.istekNo;
        d.yukleniyor = true;
        d.hata = null;
        ciz();
        var c = await istek('/api/sayim-fark/rapor?bas=' + d.bas + '&son=' + d.son + '&tur=' + d.tur);
        if (no !== d.istekNo) return;
        d.yukleniyor = false;
        if (c.kod === 401) { bolum('sfGiris'); return; }
        if (c.kod === 403) { bolum('sfYetkiYok'); return; }
        // Eski sunucu (aralıksız rapor) olaylar dönmüyor
        if (c.kod === 503 || c.kod === 404 || (c.kod === 200 && c.j.ok && !Array.isArray(c.j.olaylar))) {
            d.hata = { kurulum: true };
        } else if (c.kod !== 200 || !c.j.ok) {
            d.hata = { metin: c.kod === 0 ? 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.' : c.kod === 429 ? 'Çok sık istendi. Birkaç saniye sonra tekrar dene.' : 'Rapor alınamadı. Biraz sonra tekrar dene.' };
        } else {
            d.veri = c.j;
        }
        ciz();
    }

    // ------------------------------------------------------------------
    // Derleme
    // ------------------------------------------------------------------

    /** Ürün başına: olaylar (yeniden eskiye), grup, öne çıkan olay */
    function urunler() {
        var olaylar = (d.veri && d.veri.olaylar) || [];
        var harita = new Map();
        olaylar.forEach(function (k) {
            var u = harita.get(k.p);
            if (!u) { u = { p: k.p, ad: k.ad, olaylar: [], net: 0 }; harita.set(k.p, u); }
            u.olaylar.push(k);
            u.net = Math.round((u.net + k.fark) * 1000) / 1000;
        });
        var liste = [];
        harita.forEach(function (u) {
            u.olaylar.sort(function (a, b) { return Date.parse(b.z) - Date.parse(a.z); });
            var sifir = u.olaylar.filter(function (k) { return k.durum === 'sifir'; });
            u.grup = sifir.length ? 'sifir' : u.net < 0 ? 'eksik' : u.net > 0 ? 'fazla' : u.olaylar[0].durum === 'fazla' ? 'fazla' : 'eksik';
            u.sifirKez = sifir.length;
            // Sıfırlanan üründe en son sıfırlanma öne çıkar; diğerlerinde en son sayım
            u.one = sifir.length ? sifir[0] : u.olaylar[0];
            u.son = Date.parse(u.olaylar[0].z);
            var b = urunBilgi(u.p, u.ad);
            u.bilgi = b;
            u.aranan = ((b.ad || u.ad || '') + ' ' + b.barkodlar.join(' ')).toLocaleLowerCase('tr');
            liste.push(u);
        });
        return liste;
    }

    function suzulmus(liste) {
        var ara = d.ara.trim().toLocaleLowerCase('tr');
        return liste.filter(function (u) {
            if (!d.durum[u.grup]) return false;
            return !ara || u.aranan.indexOf(ara) !== -1;
        });
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------

    function bolum(id) {
        ['sfGiris', 'sfYetkiYok', 'sfIcerik'].forEach(function (x) { el(x).hidden = x !== id; });
    }

    function hazirCiz() {
        var l = [['bugun', 'Bugün'], ['dun', 'Dün'], ['hafta', 'Son 7 Gün'], ['son30', 'Son 30 Gün'], ['ay', 'Bu Ay'], ['gecenAy', 'Geçen Ay']];
        el('sfHazir').innerHTML = l.map(function (x) {
            return '<button type="button" class="sf-cip" data-hazir="' + x[0] + '" aria-pressed="' + (d.hazir === x[0]) + '">' + x[1] + '</button>';
        }).join('');
        var bugun = gunYaz(Date.now());
        el('sfBas').value = d.bas; el('sfBas').max = d.son;
        el('sfSon').value = d.son; el('sfSon').min = d.bas; el('sfSon').max = bugun;
        document.querySelectorAll('#sfTur [data-tur]').forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-tur') === d.tur)); });
    }

    function ozetCiz(liste) {
        var say = { sifir: 0, eksik: 0, fazla: 0 };
        var adet = { eksik: 0, fazla: 0 };
        liste.forEach(function (u) { say[u.grup]++; });
        ((d.veri && d.veri.olaylar) || []).forEach(function (k) {
            if (k.fark < 0) adet.eksik += -k.fark; else adet.fazla += k.fark;
        });
        var sayimlar = (d.veri && d.veri.sayimlar) || [];
        var gunluk = sayimlar.filter(function (s) { return s.o; }).length;
        var urunSay = sayimlar.reduce(function (t, s) { return t + (s.urun || 0); }, 0);
        var kutu = function (tur, ad, n, alt) {
            return '<div class="sf-ozet__kutu' + (tur ? ' sf-ozet__kutu--' + tur : '') + (n ? ' is-dolu' : ' is-bos') + '">' +
                '<span class="sf-ozet__ad">' + ad + '</span><span class="sf-ozet__sayi">' + sayi(n) + '</span><span class="sf-ozet__alt">' + kacis(alt) + '</span></div>';
        };
        el('sfOzet').innerHTML =
            kutu('sifir', 'Sıfırlanan', say.sifir, say.sifir ? 'ürün sistemde vardı, 0 sayıldı' : 'sıfırlanan ürün yok') +
            kutu('eksik', 'Eksik Çıkan', say.eksik, adet.eksik ? 'toplam −' + sayi(Math.round(adet.eksik * 1000) / 1000) + ' adet' : 'eksik yok') +
            kutu('fazla', 'Fazla Çıkan', say.fazla, adet.fazla ? 'toplam +' + sayi(Math.round(adet.fazla * 1000) / 1000) + ' adet' : 'fazla yok') +
            kutu('', 'Sayım', sayimlar.length, sayimlar.length ? gunluk + ' günlük · ' + (sayimlar.length - gunluk) + ' elle · ' + urunSay + ' ürün' : 'bu aralıkta okunmuş sayım yok');
        DURUMLAR.forEach(function (t) {
            var s = document.querySelector('#sfDurum [data-sayi="' + t + '"]');
            if (s) s.textContent = say[t];
        });
    }

    function gorselHtml(b, ad) {
        if (!b.gorsel) return '<span class="sf-gorsel">' + IKON.urun + '</span>';
        return '<button type="button" class="sf-gorsel" data-foto="' + kacis(b.gorsel) + '" data-foto-ad="' + kacis(ad) + '" aria-label="Fotoğrafı büyüt">' +
            '<img src="' + kacis(b.gorsel) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button>';
    }

    function barkodHtml(b) {
        if (!b.barkod) return '<span>Barkod katalogda yok</span>';
        return '<button type="button" class="sf-barkod" data-kopya="' + kacis(b.barkod) + '" title="Barkodu kopyala">' + kacis(b.barkod) + IKON.kopya + '</button>';
    }

    function olayYazi(k) {
        return '<b>' + OLAY_AD[k.durum] + '</b> · ' + kacis(tarihSaat(k.z)) + ' · ' + (k.o ? 'Günlük Sayım' : 'Elle Sayım');
    }

    function degerHtml(k) {
        return '<div class="sf-deger"><span class="sf-adet" title="sistem → sayılan">' + sayi(k.sis) + ' → ' + sayi(k.fiz) + '</span>' +
            '<span class="sf-rozet sf-rozet--' + k.durum + '">' + isaretli(k.fark) + '</span></div>';
    }

    function urunSatiri(u) {
        var b = u.bilgi;
        var ad = b.ad || u.ad || 'Ürün';
        var k = u.one;
        var acik = d.acik.has('u:' + u.p);
        var digerleri = u.olaylar.length - 1;
        var meta = barkodHtml(b) + (b.kategori ? '<span>' + kacis(b.kategori) + '</span>' : '');
        var ek = [];
        if (u.sifirKez > 1) ek.push(u.sifirKez + ' kez sıfırlandı');
        if (u.olaylar.length > 1) ek.push('net ' + isaretli(u.net));
        return '<div class="sf-satir sf-satir--' + u.grup + '">' +
            '<div class="sf-satir__ana">' + gorselHtml(b, ad) +
                '<div class="sf-bilgi"><span class="sf-ad">' + kacis(ad) + '</span>' +
                    '<div class="sf-meta">' + meta + '</div>' +
                    '<span class="sf-olay sf-olay--' + k.durum + '">' + olayYazi(k) + (ek.length ? ' · ' + kacis(ek.join(' · ')) : '') + '</span>' +
                    (digerleri ? '<span><button type="button" class="sf-satir__ac" data-ac="u:' + kacis(u.p) + '" aria-expanded="' + acik + '">' +
                        (acik ? 'Geçmişi gizle' : digerleri + ' sayım daha') + IKON.ok + '</button></span>' : '') +
                '</div>' + degerHtml(k) +
            '</div>' +
            (acik && digerleri ? '<div class="sf-gecmis">' + u.olaylar.map(function (x) {
                return '<div class="sf-gecmis__satir"><span class="sf-olay sf-olay--' + x.durum + '">' + olayYazi(x) + '</span>' +
                    '<span class="sf-adet">' + sayi(x.sis) + ' → ' + sayi(x.fiz) + '</span><span class="sf-rozet sf-rozet--' + x.durum + '">' + isaretli(x.fark) + '</span></div>';
            }).join('') + '</div>' : '') +
            '</div>';
    }

    function urunGorunumu(liste) {
        var parca = [];
        DURUMLAR.forEach(function (g) {
            var l = liste.filter(function (u) { return u.grup === g; })
                .sort(function (a, b) { return Date.parse(b.one.z) - Date.parse(a.one.z); });
            if (!l.length) return;
            parca.push('<section class="sf-grup sf-grup--' + g + '"><h2><i></i>' + GRUP_AD[g] + '<b>' + l.length + '</b></h2>' +
                '<div class="sf-liste">' + l.map(urunSatiri).join('') + '</div></section>');
        });
        return parca.join('');
    }

    function sayimGorunumu(liste) {
        var gorunen = new Set(liste.map(function (u) { return u.p; }));
        var olaylar = (d.veri && d.veri.olaylar) || [];
        var oturumlar = (d.veri && d.veri.sayimlar) || [];
        var ara = d.ara.trim();
        var satirlar = oturumlar.map(function (s) {
            var icinde = olaylar.filter(function (k) { return k.s === s.s && gorunen.has(k.p) && d.durum[k.durum]; });
            if (ara && !icinde.length) return '';
            var acik = d.acik.has('s:' + s.s);
            var sayilar = DURUMLAR.filter(function (t) { return s[t]; }).map(function (t) {
                return '<span class="sf-rozet sf-rozet--' + t + '">' + s[t] + ' ' + { sifir: 'sıfır', eksik: 'eksik', fazla: 'fazla' }[t] + '</span>';
            }).join('');
            var sure = s.bit && Date.parse(s.bit) - Date.parse(s.sa) > 60000
                ? ' – ' + new Date(s.bit).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }) : '';
            var govde = '';
            if (acik) {
                govde = icinde.length ? icinde.sort(function (a, b) { return a.fark - b.fark; }).map(function (k) {
                    var b = urunBilgi(k.p, k.ad);
                    var ad = b.ad || k.ad || 'Ürün';
                    return '<div class="sf-satir sf-satir--' + k.durum + '"><div class="sf-satir__ana">' + gorselHtml(b, ad) +
                        '<div class="sf-bilgi"><span class="sf-ad">' + kacis(ad) + '</span><div class="sf-meta">' + barkodHtml(b) +
                        (b.kategori ? '<span>' + kacis(b.kategori) + '</span>' : '') + '</div></div>' + degerHtml(k) + '</div></div>';
                }).join('') : '<div class="sf-oturum__bos">Bu sayımda seçili türde fark yok.</div>';
            }
            return '<div class="sf-oturum"><button type="button" class="sf-oturum__bas" data-ac="s:' + kacis(s.s) + '" aria-expanded="' + acik + '">' +
                '<span class="sf-oturum__ikon' + (s.o ? ' sf-oturum__ikon--gunluk' : '') + '">' + IKON.sayim + '</span>' +
                '<span class="sf-oturum__metin"><strong>' + (s.o ? 'Günlük Sayım' : 'Elle Sayım') + ' · ' + kacis(uzunTarih(s.sa)) + kacis(sure) + '</strong>' +
                '<span>' + s.urun + ' ürün okundu' + (s.n && s.urun < s.n ? ' (panelde ' + s.n + ')' : '') + (s.sifir + s.eksik + s.fazla ? '' : ' · fark yok') + '</span></span>' +
                '<span class="sf-oturum__sayilar">' + sayilar + '</span>' +
                '<svg class="sf-oturum__ok" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 8 4.5 4.5L14.5 8"/></svg></button>' +
                (acik ? '<div class="sf-oturum__govde">' + govde + '</div>' : '') + '</div>';
        }).filter(Boolean);
        if (!satirlar.length) return '';
        return '<section class="sf-grup"><h2>Sayımlar<b>' + satirlar.length + '</b></h2><div class="sf-liste">' + satirlar.join('') + '</div></section>';
    }

    function durumHtml(ikon, baslik, metin, dugme) {
        return '<div class="sf-durum">' + ikon + '<strong>' + kacis(baslik) + '</strong><p>' + kacis(metin) + '</p>' + (dugme || '') + '</div>';
    }

    function iskeletHtml() {
        var s = '';
        for (var i = 0; i < 5; i++) {
            s += '<div class="sf-iskelet-satir"><span class="yrd-iskelet"></span><div><span class="yrd-iskelet" style="width:' + (60 - i * 6) + '%;height:14px"></span>' +
                '<span class="yrd-iskelet" style="width:30%;height:12px"></span></div></div>';
        }
        return '<section class="sf-grup"><div class="sf-liste" aria-busy="true">' + s + '</div></section>';
    }

    function veriCiz() {
        var v = d.veri && d.veri.veri;
        var t = d.tarama;
        var kutu = el('sfVeri');
        kutu.classList.toggle('is-calisiyor', !!t);
        kutu.classList.toggle('is-hata', !t && !!d.taramaHata);
        el('sfGuncelle').hidden = !!t;
        el('sfDurdur').hidden = !t;
        el('sfIlerleme').hidden = !t;
        if (t) {
            el('sfVeriBaslik').textContent = t.mesaj || 'Depo panelinden okunuyor';
            el('sfVeriAlt').textContent = t.toplam ? t.yapilan + ' / ' + t.toplam + ' ürün sayımı' + (t.yazilan ? ' · ' + t.yazilan + ' kayıt aktarıldı' : '')
                : 'Asistan depo panelini arka planda açıyor. Bu sekme açık kalsın.';
            el('sfIlerleme').firstElementChild.style.transform = 'scaleX(' + (t.toplam ? Math.min(1, t.yapilan / t.toplam) : 0.04) + ')';
            return;
        }
        if (d.taramaHata) {
            el('sfVeriBaslik').textContent = 'Panelden okunamadı';
            el('sfVeriAlt').textContent = d.taramaHata;
            return;
        }
        if (!v || !v.son) {
            el('sfVeriBaslik').textContent = 'Henüz sayım okunmadı';
            el('sfVeriAlt').textContent = 'Panelden Güncelle, seçili aralığın sayımlarını depo panelinden alır. Depo paneli bu bilgisayarda açık olmalı.';
            return;
        }
        el('sfVeriBaslik').textContent = 'Son okuma: ' + uzunTarih(v.son);
        el('sfVeriAlt').textContent = 'Asistan rapor saatlerinden önce yeni sayımları kendisi okur. Eksik gördüğün sayım varsa Panelden Güncelle.' +
            (v.ilk ? ' En eski kayıt: ' + gunMetni(gunYaz(Date.parse(v.ilk))) + '.' : '');
    }

    function ciz() {
        hazirCiz();
        veriCiz();
        var govde = el('sfGovde');
        if (d.hata && d.hata.kurulum) {
            el('sfOzet').innerHTML = '';
            govde.innerHTML = durumHtml(IKON.uyari, 'Sunucu güncellemesi bekleniyor', 'Kurulum bitince sayım farkları burada görünür.');
            return;
        }
        if (d.hata) {
            govde.innerHTML = durumHtml(IKON.uyari, 'Rapor alınamadı', d.hata.metin, '<button type="button" class="sf-dugme" data-yeniden>Tekrar Dene</button>');
            return;
        }
        if (!d.veri) {
            el('sfOzet').innerHTML = '';
            govde.innerHTML = iskeletHtml();
            return;
        }
        var hepsi = urunler();
        ozetCiz(hepsi);
        govde.style.opacity = d.yukleniyor ? '0.55' : '';
        var liste = suzulmus(hepsi);
        if (!hepsi.length) {
            var hic = !(d.veri.veri && d.veri.veri.son);
            govde.innerHTML = durumHtml(IKON.bos, hic ? 'Henüz sayım okunmadı' : 'Bu aralıkta fark yok',
                hic ? 'Depo panelindeki sayımları almak için Panelden Güncelle\'ye bas. Asistan bu bilgisayarda kurulu ve depo paneli açık olmalı.'
                    : (d.veri.sayimlar && d.veri.sayimlar.length ? d.veri.sayimlar.length + ' sayım okundu, hepsinde sistemle sayılan aynı.' : 'Bu tarihlerde okunmuş sayım yok. Sayım yapıldıysa Panelden Güncelle ile al.'),
                hic || !(d.veri.sayimlar && d.veri.sayimlar.length) ? '<button type="button" class="sf-dugme sf-dugme--ana" data-tara>Panelden Güncelle</button>' : '');
            return;
        }
        var html = d.gorunum === 'sayim' ? sayimGorunumu(liste) : urunGorunumu(liste);
        govde.innerHTML = html || durumHtml(IKON.bos, 'Süzgece uyan ürün yok', 'Aramayı ya da fark türü seçimini değiştir.');
        if (d.veri.kesildi) govde.insertAdjacentHTML('beforeend', '<p class="sf-not">Aralık çok geniş: en yeni 8000 fark gösteriliyor. Daha dar bir aralık seç.</p>');
    }

    // ------------------------------------------------------------------
    // Tarih
    // ------------------------------------------------------------------

    function hazirUygula(tur) {
        var bugun = gunYaz(Date.now());
        d.hazir = tur;
        if (tur === 'bugun') { d.bas = d.son = bugun; }
        else if (tur === 'dun') { d.bas = d.son = gunYaz(Date.now() - 864e5); }
        else if (tur === 'hafta') { d.bas = gunYaz(Date.now() - 6 * 864e5); d.son = bugun; }
        else if (tur === 'ay') { d.bas = bugun.slice(0, 8) + '01'; d.son = bugun; }
        else if (tur === 'gecenAy') {
            var b = new Date(bugun.slice(0, 8) + '01T12:00:00Z');
            b.setUTCDate(0);
            d.son = b.toISOString().slice(0, 10);
            d.bas = d.son.slice(0, 8) + '01';
        } else { d.hazir = 'son30'; d.bas = gunYaz(Date.now() - 29 * 864e5); d.son = bugun; }
    }

    function tarihKoy(alan, deger) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deger || ''))) return;
        d.hazir = null;
        d[alan] = deger;
        if (d.bas > d.son) { if (alan === 'bas') d.son = deger; else d.bas = deger; }
        var gun = (Date.parse(d.son) - Date.parse(d.bas)) / 864e5;
        if (gun > EN_COK_GUN - 1) {
            if (alan === 'bas') d.son = gunYaz(Date.parse(d.bas) + (EN_COK_GUN - 1) * 864e5);
            else d.bas = gunYaz(Date.parse(d.son) - (EN_COK_GUN - 1) * 864e5);
            bildir('En çok ' + EN_COK_GUN + ' günlük aralık seçilebilir.');
        }
        degisti();
    }

    function degisti() {
        d.acik.clear();
        try { localStorage.setItem('jb_sf_suzgec', JSON.stringify({ hazir: d.hazir, bas: d.bas, son: d.son, tur: d.tur, gorunum: d.gorunum })); } catch (e) { /* sessiz */ }
        veriYukle();
    }

    // ------------------------------------------------------------------
    // Kopyalama
    // ------------------------------------------------------------------

    async function kopyala(metin) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(metin); return true; }
        } catch (e) { /* aşağıdaki yola düş */ }
        try {
            var t = document.createElement('textarea');
            t.value = metin;
            t.setAttribute('readonly', '');
            t.style.position = 'fixed';
            t.style.opacity = '0';
            document.body.appendChild(t);
            t.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(t);
            return ok;
        } catch (e) { return false; }
    }

    async function tumunuKopyala() {
        var liste = suzulmus(urunler());
        var barkodlar = [];
        DURUMLAR.forEach(function (g) {
            liste.filter(function (u) { return u.grup === g; }).forEach(function (u) { if (u.bilgi.barkod) barkodlar.push(u.bilgi.barkod); });
        });
        if (!barkodlar.length) { bildir('Kopyalanacak barkod yok.'); return; }
        var ok = await kopyala(barkodlar.join('\n'));
        bildir(ok ? barkodlar.length + ' barkod kopyalandı.' : 'Kopyalanamadı.', ok ? 'basari' : 'hata');
    }

    // ------------------------------------------------------------------
    // Panelden Güncelle (Jet Barkod Asistan)
    // ------------------------------------------------------------------

    async function depoKimligi() {
        var bul = function (v) { var k = v && typeof v === 'object' ? (v._id || v.id) : v; k = String(k || '').trim(); return KIMLIK.test(k) ? k : null; };
        try {
            var yerel = JSON.parse(localStorage.getItem('getir_api_info') || 'null');
            var k = yerel && bul(yerel.warehouseId);
            if (k) return k;
        } catch (e) { /* yok */ }
        var o = null;
        try { o = global.authUtils && global.authUtils.checkAuth(); } catch (e) { o = null; }
        if (o && o.username && global.jbDb) {
            try {
                var r = await global.jbDb.from('users').select('api:counting_data->_api_info').eq('username', o.username).maybeSingle();
                var b = r && r.data && r.data.api;
                if (typeof b === 'string') b = JSON.parse(b);
                var k2 = b && bul(b.warehouseId);
                if (k2) return k2;
            } catch (e) { /* okunamadı */ }
        }
        return null;
    }

    var kabulBekleyen = null;
    var dinleyici = false;

    function dinleyiciKur() {
        if (dinleyici) return;
        dinleyici = true;
        global.addEventListener('message', function (e) {
            if (e.source !== global || e.origin !== location.origin) return;
            var m = e.data;
            if (!m || typeof m.type !== 'string') return;
            if (m.type === 'JB_SAYIM_GECMISI_KABUL' && kabulBekleyen) { var f = kabulBekleyen; kabulBekleyen = null; f(m); return; }
            if (m.type === 'JB_SAYIM_GECMISI_OLAY' && d.tarama) olayIsle(m);
        });
    }

    function yazmaSirasi(zorla) {
        var t = d.tarama;
        if (!t || (!zorla && t.tampon.length < YAZ_PARCA)) return;
        while (t.tampon.length) {
            var parca = t.tampon.splice(0, YAZ_PARCA);
            t.yazma = t.yazma.then(async function (p) {
                var c = await istek('/api/sayim-gecmisi/yaz', { kayitlar: p });
                if (c.kod === 429) { await new Promise(function (r) { setTimeout(r, 4000); }); c = await istek('/api/sayim-gecmisi/yaz', { kayitlar: p }); }
                if (c.kod === 200) t.yazilan += p.length;
                else t.yazmaHata = c.kod === 503 ? 'Sunucu güncellemesi bekleniyor: sayım tablosu kurulu değil.' : 'Bazı kayıtlar sunucuya yazılamadı (' + c.kod + ').';
                veriCiz();
            }.bind(null, parca));
        }
    }

    function olayIsle(m) {
        var t = d.tarama;
        if (m.tur === 'ilerleme') {
            if (m.mesaj) t.mesaj = m.mesaj;
            if (Number.isFinite(m.toplam)) t.toplam = m.toplam;
            if (Number.isFinite(m.yapilan)) t.yapilan = m.yapilan;
            veriCiz();
        } else if (m.tur === 'parca') {
            if (Array.isArray(m.kayitlar)) Array.prototype.push.apply(t.tampon, m.kayitlar);
            yazmaSirasi(false);
        } else if (m.tur === 'bitti') {
            if (t.bitti) return;
            t.bitti = true;
            clearInterval(t.zamanlayici);
            yazmaSirasi(true);
            t.yazma.then(function () {
                d.tarama = null;
                if (!m.ok) d.taramaHata = m.hata || 'Sayımlar okunamadı.';
                else if (t.yazmaHata) d.taramaHata = t.yazmaHata;
                else d.taramaHata = null;
                if (m.ok && !t.yazmaHata) {
                    bildir(m.durduruldu ? 'Durduruldu. Okunan sayımlar kaydedildi.'
                        : m.eksikSayim ? m.eksikSayim + ' sayım okunamadı. Tekrar dene.'
                        : (m.yeniSayim ? m.yeniSayim + ' sayım okundu.' : 'Yeni sayım yok; hepsi zaten okunmuştu.'), m.eksikSayim ? 'uyari' : 'basari');
                }
                veriYukle();
            });
        }
    }

    async function taramaBaslat() {
        if (d.tarama) return;
        d.taramaHata = null;
        var depo = await depoKimligi();
        if (!depo) {
            d.taramaHata = 'Depo bilgisi bulunamadı. Franchise panelinin stok sayfasını bir kez aç; depo oradan öğrenilir.';
            veriCiz();
            return;
        }
        dinleyiciKur();
        var bilinen = {};
        ((d.veri && d.veri.tam) || []).forEach(function (s) { bilinen[s] = true; });
        d.tarama = { mesaj: 'Asistan hazırlanıyor', yapilan: 0, toplam: 0, yazilan: 0, tampon: [], yazma: Promise.resolve(), bitti: false };
        veriCiz();
        // Kayıtlar bir sayımın ortasında da birikebilir: 8 sn'de bir sunucuya
        d.tarama.zamanlayici = setInterval(function () { yazmaSirasi(true); }, 8000);
        var y = await new Promise(function (coz) {
            var bitti = false;
            kabulBekleyen = function (m) { if (!bitti) { bitti = true; coz(m); } };
            try {
                global.postMessage({ type: 'JB_SAYIM_GECMISI_ISTEK', warehouseId: depo, baslangic: d.bas, bitis: d.son, otomatik: true, bilinen: bilinen }, location.origin);
            } catch (e) { /* sessiz */ }
            setTimeout(function () {
                if (bitti) return;
                bitti = true;
                kabulBekleyen = null;
                coz({ ok: false, hata: 'Jet Barkod Asistan yanıt vermedi. Bu bilgisayarda Asistan kurulu ve güncel olmalı; telefonda bu düğme çalışmaz.' });
            }, 5000);
        });
        if (!y.ok) {
            if (d.tarama) clearInterval(d.tarama.zamanlayici);
            d.tarama = null;
            d.taramaHata = y.hata || 'Asistan işi başlatamadı.';
            veriCiz();
        }
    }

    function taramaDurdur() {
        if (!d.tarama) return;
        d.tarama.mesaj = 'Durduruluyor';
        veriCiz();
        try { global.postMessage({ type: 'JB_SAYIM_GECMISI_DURDUR' }, location.origin); } catch (e) { /* sessiz */ }
    }

    // ------------------------------------------------------------------
    // Olaylar
    // ------------------------------------------------------------------

    function olaylar() {
        el('sfHazir').addEventListener('click', function (e) {
            var b = e.target.closest('[data-hazir]');
            if (!b) return;
            hazirUygula(b.getAttribute('data-hazir'));
            degisti();
        });
        el('sfBas').addEventListener('change', function (e) { tarihKoy('bas', e.target.value); });
        el('sfSon').addEventListener('change', function (e) { tarihKoy('son', e.target.value); });
        el('sfTur').addEventListener('click', function (e) {
            var b = e.target.closest('[data-tur]');
            if (!b || b.getAttribute('data-tur') === d.tur) return;
            d.tur = b.getAttribute('data-tur');
            degisti();
        });
        el('sfDurum').addEventListener('click', function (e) {
            var b = e.target.closest('[data-durum]');
            if (!b) return;
            var t = b.getAttribute('data-durum');
            d.durum[t] = !d.durum[t];
            // Hiçbiri seçili kalmasın diye: son seçim kapanırsa yalnız ona basılmış sayılır
            if (!DURUMLAR.some(function (x) { return d.durum[x]; })) DURUMLAR.forEach(function (x) { d.durum[x] = x === t; });
            document.querySelectorAll('#sfDurum [data-durum]').forEach(function (x) { x.setAttribute('aria-pressed', String(!!d.durum[x.getAttribute('data-durum')])); });
            ciz();
        });
        el('sfGorunum').addEventListener('click', function (e) {
            var b = e.target.closest('[data-gorunum]');
            if (!b || b.getAttribute('data-gorunum') === d.gorunum) return;
            d.gorunum = b.getAttribute('data-gorunum');
            document.querySelectorAll('#sfGorunum [data-gorunum]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
            try { localStorage.setItem('jb_sf_suzgec', JSON.stringify({ hazir: d.hazir, bas: d.bas, son: d.son, tur: d.tur, gorunum: d.gorunum })); } catch (x) { /* sessiz */ }
            ciz();
        });
        var zaman = null;
        el('sfAra').addEventListener('input', function (e) {
            clearTimeout(zaman);
            zaman = setTimeout(function () { d.ara = e.target.value; ciz(); }, 120);
        });
        el('sfKopyala').addEventListener('click', tumunuKopyala);
        el('sfGuncelle').addEventListener('click', taramaBaslat);
        el('sfDurdur').addEventListener('click', taramaDurdur);
        el('sfGovde').addEventListener('click', async function (e) {
            var k = e.target.closest('[data-kopya]');
            if (k) {
                var ok = await kopyala(k.getAttribute('data-kopya'));
                if (ok) {
                    k.classList.add('is-kopyalandi');
                    setTimeout(function () { k.classList.remove('is-kopyalandi'); }, 1200);
                }
                bildir(ok ? 'Barkod kopyalandı.' : 'Kopyalanamadı.', ok ? 'basari' : 'hata');
                return;
            }
            var f = e.target.closest('[data-foto]');
            if (f && global.JBUrunFoto) { global.JBUrunFoto.ac(f.getAttribute('data-foto'), f.getAttribute('data-foto-ad')); return; }
            var a = e.target.closest('[data-ac]');
            if (a) {
                var anahtar = a.getAttribute('data-ac');
                if (d.acik.has(anahtar)) d.acik.delete(anahtar); else d.acik.add(anahtar);
                ciz();
                var yeni = el('sfGovde').querySelector('[data-ac="' + anahtar.replace(/"/g, '') + '"]');
                if (yeni) yeni.focus({ preventScroll: true });
                return;
            }
            if (e.target.closest('[data-tara]')) { taramaBaslat(); return; }
            if (e.target.closest('[data-yeniden]')) veriYukle();
        });
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

    async function basla() {
        var o = null;
        try { o = (global.authUtils && global.authUtils.checkAuth()) || null; } catch (e) { o = null; }
        if (!o || !o.username) { bolum('sfGiris'); return; }
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;

        var kayit = null;
        try { kayit = JSON.parse(localStorage.getItem('jb_sf_suzgec') || 'null'); } catch (e) { kayit = null; }
        if (kayit && kayit.hazir) hazirUygula(kayit.hazir);
        else if (kayit && /^\d{4}-\d{2}-\d{2}$/.test(kayit.bas) && /^\d{4}-\d{2}-\d{2}$/.test(kayit.son)) { d.hazir = null; d.bas = kayit.bas; d.son = kayit.son; }
        else hazirUygula('son30');
        if (kayit && ['hepsi', 'gunluk', 'elle'].indexOf(kayit.tur) !== -1) d.tur = kayit.tur;
        if (kayit && (kayit.gorunum === 'urun' || kayit.gorunum === 'sayim')) d.gorunum = kayit.gorunum;
        document.querySelectorAll('#sfGorunum [data-gorunum]').forEach(function (x) { x.setAttribute('aria-checked', String(x.getAttribute('data-gorunum') === d.gorunum)); });

        bolum('sfIcerik');
        ciz();
        var p = await haklariYukle();
        var acik = p && HAKLAR.some(function (h) { return p.checkPremiumFeature(h); });
        if (!acik) { bolum('sfYetkiYok'); return; }
        olaylar();
        veriYukle();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
