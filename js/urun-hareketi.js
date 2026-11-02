/**
 * Ürün Hareketi: ürün kartının sağ üstündeki düğme ve açılan pencere
 * ============================================================================
 *
 * "Bu ürün rafta yok, yeni mi geldi?" sorusunun cevabı tek yerde:
 *   - Son iki transfer: depo panelinin Ürün Hareketleri isteği, yalnız
 *     "IncomingTransferAcceptance-IncreaseStock" (transferle mevcut stoğun
 *     artması), son 12 gün.
 *   - Son satış: aynı istek, "PickingBasketDeliver" (toplama sepeti teslimi).
 *   - Bugün gelen paletler: Transfer Teslimat listesi ve her teslimatın ürün
 *     listesi. Mal kabul bitmeden ürün hareketlerde görünmez, burada görünür.
 *   - Ajanda: bu ürün için açık eksik/fazla kaydı.
 *
 * Getir'in ağ geçidi başka siteden gelen tarayıcı isteğini kesiyor; sorular
 * Jet Barkod sunucusundan, Asistan'ın hesaba yazdığı depo jetonuyla gider
 * (js/depo-oturum.js → /api/depo-panel).
 * Teslimatların ürün listesi değişmediği için cihazda saklanır, yalnız
 * durumu değişen teslimat yeniden istenir. Sunucu istekleri 350 ms arayla atar.
 *
 * window.JBUrunHareketi.dugme(urun)        → kart için sağ üst düğme HTML
 * window.JBUrunHareketi.ac(urun)           → pencereyi aç
 * window.JBUrunHareketi.yeniGelenler(ids)  → Map(id → { zaman, adet }) bugün/dün transferle gelenler
 *   urun: { id, ad, gorsel, barkod }
 * ============================================================================
 */
(function (global) {
    'use strict';

    var KIMLIK = /^[0-9a-f]{24}$/i;
    var TRANSFER = 'IncomingTransferAcceptance-IncreaseStock';
    var SATIS = 'PickingBasketDeliver';
    var GUN = 12;
    var PALET_ANAHTAR = 'jb_palet_v1';
    var PALET_LISTE_MS = 60000;

    var GUN_MS = 86400000;
    var AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    var GUNLER = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    var DURUM = {
        CREATED: ['Yolda', 'yol'],
        VERIFICATION_REQUIRED: ['Yolda', 'yol'],
        VERIFIED: ['Yolda', 'yol'],
        HANDSHAKE_APPROVED: ['Geldi, mal kabul bekliyor', 'bekle'],
        HANDSHAKE_REJECTED: ['El sıkışma reddedildi', 'sorun'],
        GOODS_ACCEPTANCE_STARTED: ['Mal kabul sürüyor', 'bekle'],
        ACCEPTANCE_PAUSED: ['Mal kabul durdu', 'bekle'],
        COMPLETE_PENDING: ['Tamamlanıyor', 'bekle'],
        COMPLETE_FAILED: ['Tamamlanamadı', 'sorun'],
        COMPLETED: ['Stoğa alındı', 'tamam']
    };
    var IPTAL = /CANCEL/;


    function bekle(ms) { return new Promise(function (c) { setTimeout(c, ms); }); }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function gunBasi(ms) { var d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }

    function saat(ms) {
        var d = new Date(ms);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    /* Bugün 14:49 · Dün 14:49 · 31 Eki Cum 14:49 */
    function zamanYaz(ms, saatsiz) {
        var fark = Math.round((gunBasi(Date.now()) - gunBasi(ms)) / GUN_MS);
        var d = new Date(ms);
        var gun = fark === 0 ? 'Bugün' : fark === 1 ? 'Dün' : d.getDate() + ' ' + AYLAR[d.getMonth()] + ' ' + GUNLER[d.getDay()];
        return saatsiz ? gun : gun + ' ' + saat(ms);
    }

    function kacGunOnce(ms) { return Math.round((gunBasi(Date.now()) - gunBasi(ms)) / GUN_MS); }

    // ==================================================================
    // Veri
    // ==================================================================

    function sor(islem, veri) {
        if (!global.depoPaneli) { var h = new Error('oturum'); h.kod = 'oturum'; return Promise.reject(h); }
        return global.depoPaneli.istek(islem, veri);
    }

    /* Ürün Hareketleri: panelin "Açıklama" filtresiyle aynı istek, sunucu üzerinden */
    async function hareketler(ids, aciklama, gun, limit, sayfaSiniri) {
        var bas = new Date(gunBasi(Date.now() - (gun - 1) * GUN_MS)).toISOString();
        var bit = new Date().toISOString();
        var liste = [];
        for (var sayfa = 0; sayfa < (sayfaSiniri || 1); sayfa++) {
            var v = await sor('hareket', { urunler: ids, aciklama: aciklama, bas: bas, bit: bit, limit: limit, offset: sayfa * limit });
            (v && Array.isArray(v.liste) ? v.liste : []).forEach(function (x) {
                var z = Date.parse(x.z);
                if (!KIMLIK.test(String(x.id || '')) || !Number.isFinite(z)) return;
                liste.push({ id: String(x.id).toLowerCase(), zaman: z, adet: Math.abs(Number(x.q) || 0) });
            });
            if (!v || !v.devam) break;
        }
        liste.sort(function (a, b) { return b.zaman - a.zaman; });
        return liste;
    }

    /* Bugün ya da dün transferle stoğa girenler (stok düğmesindeki yeşil satır) */
    async function yeniGelenler(ids) {
        var temiz = (ids || []).map(String).filter(function (i) { return KIMLIK.test(i); }).slice(0, 100);
        var harita = new Map();
        if (!temiz.length) return harita;
        var liste = await hareketler(temiz, TRANSFER, 2, 100, 3);
        liste.forEach(function (x) {
            var v = harita.get(x.id);
            // Aynı gün birden çok kabul: adetler toplanır, saat en sonuncusu
            if (!v) harita.set(x.id, { zaman: x.zaman, adet: x.adet });
            else if (gunBasi(v.zaman) === gunBasi(x.zaman)) v.adet += x.adet;
        });
        return harita;
    }

    // Paletler: liste kısa ömürlü, ürün listesi cihazda

    var paletListe = null;
    var paletSozu = null;

    function paletDepoOku() {
        try {
            var v = JSON.parse(global.localStorage.getItem(PALET_ANAHTAR) || '{}');
            return v && typeof v === 'object' ? v : {};
        } catch (e) { return {}; }
    }

    function paletDepoYaz(v) {
        var sinir = Date.now() - 3 * GUN_MS;
        Object.keys(v).forEach(function (k) { if (!v[k] || (v[k].t || 0) < sinir) delete v[k]; });
        try { global.localStorage.setItem(PALET_ANAHTAR, JSON.stringify(v)); } catch (e) { /* dolu */ }
    }

    async function paletleriTopla() {
        var bas = gunBasi(Date.now() - GUN_MS);
        var son = gunBasi(Date.now()) + GUN_MS - 1;
        var v = await sor('paletler', { bas: new Date(bas).toISOString(), bit: new Date(son).toISOString() });
        var teslimatlar = (v && Array.isArray(v.liste) ? v.liste : [])
            .filter(function (t) { return KIMLIK.test(String(t.id || '')) && !IPTAL.test(String(t.durum || '')); });

        var depo = paletDepoOku();
        for (var i = 0; i < teslimatlar.length; i++) {
            var t = teslimatlar[i];
            var kayit = depo[t.id];
            if (kayit && kayit.d === t.durum) continue;
            var d;
            try { d = await sor('palet', { id: t.id }); } catch (e) { if (e.kod === 'oturum') throw e; continue; }
            depo[t.id] = { d: t.durum, u: (d && d.urunler) || {}, t: Date.now() };
        }
        paletDepoYaz(depo);
        return teslimatlar.map(function (t) {
            return {
                id: t.id,
                durum: t.durum,
                zaman: Date.parse(t.z) || Date.now(),
                urunler: (depo[t.id] && depo[t.id].u) || null
            };
        });
    }

    function paletler(zorla) {
        if (!zorla && paletListe && Date.now() - paletListe.t < PALET_LISTE_MS) return Promise.resolve(paletListe.v);
        if (!paletSozu) {
            paletSozu = paletleriTopla().then(function (v) {
                paletListe = { v: v, t: Date.now() };
                return v;
            }).finally(function () { paletSozu = null; });
        }
        return paletSozu;
    }

    async function ajandaKayitlari(id) {
        var kim = null;
        try { var s = global.authUtils && global.authUtils.checkAuth(); kim = s && s.username; } catch (e) { kim = null; }
        if (!kim || !global.jbDb) return [];
        var r = await global.jbDb.from('dispatch_agenda_items')
            .select('id,quantity,reason_preset,event_date,created_at')
            .eq('username', kim)
            .eq('product_id', id)
            .order('created_at', { ascending: false });
        return r && Array.isArray(r.data) ? r.data : [];
    }

    // ==================================================================
    // Pencere
    // ==================================================================

    var IKON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 7h11.5M12 4l3 3-3 3"/><path d="M16.5 13H5M8 10l-3 3 3 3"/></svg>';
    var KAPAT = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>';
    var OK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg>';

    var perde = null;
    var acikUrun = null;
    var nesil = 0;
    var oncekiOdak = null;

    function dugme(urun) {
        var id = String(urun && urun.id || '');
        if (!KIMLIK.test(id)) return '';
        return '<button type="button" class="uh-dugme" data-uh-id="' + esc(id) + '" aria-label="Ürün hareketi" title="Ürün hareketi: son transfer, son satış, bugün gelen paletler">' + IKON + '</button>';
    }

    function kur() {
        if (perde) return;
        perde = document.createElement('div');
        perde.className = 'uh-perde';
        perde.hidden = true;
        perde.innerHTML =
            '<div class="uh-pano" role="dialog" aria-modal="true" aria-labelledby="uhAd">' +
                '<div class="uh-bas">' +
                    '<button type="button" class="uh-foto" data-uh-foto aria-label="Fotoğrafı büyüt"><img alt="" data-uh-gorsel></button>' +
                    '<div class="uh-kim"><strong id="uhAd" data-uh-ad></strong><span data-uh-barkod></span></div>' +
                    '<button type="button" class="uh-kapat" data-uh-kapat aria-label="Kapat">' + KAPAT + '</button>' +
                '</div>' +
                '<div class="uh-govde" data-uh-govde aria-live="polite"></div>' +
            '</div>';
        document.body.appendChild(perde);
        perde.addEventListener('click', function (e) {
            if (e.target === perde || e.target.closest('[data-uh-kapat]')) { kapat(); return; }
            if (e.target.closest('[data-uh-foto]') && acikUrun && acikUrun.gorsel && global.JBUrunFoto) {
                global.JBUrunFoto.ac(acikUrun.gorsel, acikUrun.ad || '');
                return;
            }
            if (e.target.closest('[data-uh-yenile]') && acikUrun) yukle(acikUrun, true);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' || !perde || perde.hidden) return;
            // Fotoğraf büyükken önce o kapansın
            if (document.querySelector('.uf-perde')) return;
            kapat();
        });
    }

    function bolum(baslik, govde, ek) {
        return '<section class="uh-bolum' + (ek ? ' ' + ek : '') + '"><h3>' + baslik + '</h3>' + govde + '</section>';
    }

    function iskelet(satir) {
        var s = '';
        for (var i = 0; i < (satir || 1); i++) s += '<div class="uh-satir uh-satir--iskelet"><span class="uh-isk uh-isk--uzun"></span><span class="uh-isk"></span></div>';
        return s;
    }

    function satir(sol, sag, ek) {
        return '<div class="uh-satir' + (ek ? ' ' + ek : '') + '"><span class="uh-satir__sol">' + sol + '</span><span class="uh-satir__sag">' + sag + '</span></div>';
    }

    function bos(metin) { return '<p class="uh-bos">' + metin + '</p>'; }

    function hataNotu(kod) {
        if (kod === 'oturum') {
            return '<div class="uh-not uh-not--uyari"><strong>Depo paneli bağlı değil</strong>' +
                '<span>Asistan kurulu bir bilgisayarda depo paneli açık durmalı. Panel kapalıyken jeton 15 dakikada eskir.</span>' +
                '<button type="button" class="uh-metin-dugme" data-uh-yenile>Tekrar Dene</button></div>';
        }
        if (kod === 'kurulum') {
            return '<div class="uh-not uh-not--uyari"><strong>Sunucu güncellemesi bekleniyor</strong>' +
                '<span>Ürün hareketi için sunucuya yeni dosya atılacak.</span></div>';
        }
        return '<div class="uh-not uh-not--uyari"><strong>Panelden okunamadı</strong>' +
            '<span>Bağlantı ya da panel cevap vermedi.</span><button type="button" class="uh-metin-dugme" data-uh-yenile>Tekrar Dene</button></div>';
    }

    function transferHtml(liste) {
        if (!liste.length) return bos(GUN + ' günde transfer yok');
        var h = '';
        liste.slice(0, 2).forEach(function (x, i) {
            var yeni = kacGunOnce(x.zaman) <= 1;
            var sol = (i === 1 ? '<em>Önceki</em>' : '') + esc(zamanYaz(x.zaman));
            var sag = '<b class="uh-adet' + (i === 0 && yeni ? ' is-yeni' : '') + '">+' + x.adet + '</b>';
            h += satir(sol, sag, i === 0 ? 'uh-satir--ana' : '');
        });
        if (kacGunOnce(liste[0].zaman) <= 1) {
            h += '<p class="uh-ipucu uh-ipucu--yesil">' + (kacGunOnce(liste[0].zaman) === 0 ? 'Bugün' : 'Dün') + ' geldi. Rafta yoksa yeni gelen ürünlere bak.</p>';
        }
        return h;
    }

    function satisHtml(liste) {
        if (!liste.length) return bos(GUN + ' günde satış yok');
        var x = liste[0];
        return satir(esc(zamanYaz(x.zaman)), '<b class="uh-adet">' + x.adet + ' adet</b>');
    }

    function paletHtml(liste, id) {
        var bulunan = [];
        liste.forEach(function (p) {
            var u = p.urunler && p.urunler[id];
            if (u) bulunan.push({ p: p, istenen: u[0], alinan: u[1] });
        });
        if (!liste.length) return bos('Bugün ve dün palet yok');
        if (!bulunan.length) return bos(liste.length + ' palette bu ürün yok');
        var h = '';
        var bekleyen = false;
        bulunan.forEach(function (b) {
            var d = DURUM[b.p.durum] || [b.p.durum.toLowerCase(), 'yol'];
            if (d[1] !== 'tamam') bekleyen = true;
            var adet = d[1] === 'tamam' && b.alinan != null ? b.alinan : b.istenen;
            h += satir(
                '<i class="uh-durum uh-durum--' + d[1] + '"></i>' + esc(d[0]) + '<em>' + esc(zamanYaz(b.p.zaman, true)) + '</em>',
                '<b class="uh-adet">' + adet + ' adet</b>'
            );
        });
        if (bekleyen) h += '<p class="uh-ipucu uh-ipucu--sari">Henüz stoğa alınmadı. Gelen paletlerin içine bak.</p>';
        return h;
    }

    function ajandaHtml(liste) {
        if (!liste.length) return '';
        return liste.slice(0, 3).map(function (k) {
            var fazla = /fazla/i.test(String(k.reason_preset || ''));
            var tarih = Date.parse(k.event_date ? String(k.event_date).slice(0, 10) + 'T12:00:00' : k.created_at);
            return '<a class="uh-ajanda" href="../ajanda/?kayit=' + encodeURIComponent(k.id) + '">' +
                '<span class="uh-ajanda__rozet' + (fazla ? ' is-fazla' : '') + '">' + (fazla ? '+' : '−') + (Number(k.quantity) || 1) + '</span>' +
                '<span class="uh-ajanda__metin"><b>Ajandada ' + (fazla ? 'fazla' : 'eksik') + ' olarak kayıtlı</b>' +
                (Number.isFinite(tarih) ? '<em>' + esc(zamanYaz(tarih, true)) + '</em>' : '') + '</span>' + OK + '</a>';
        }).join('');
    }

    function ciz(d) {
        var g = perde.querySelector('[data-uh-govde]');
        var h = '';
        if (d.ajanda && d.ajanda.length) h += bolum('Ajanda', ajandaHtml(d.ajanda), 'uh-bolum--ajanda');
        if (d.hata) {
            h += hataNotu(d.hata);
        } else {
            h += bolum('Son Transfer', d.transfer ? transferHtml(d.transfer) : iskelet(2));
            h += bolum('Son Satış', d.satis ? satisHtml(d.satis) : iskelet(1));
            h += bolum('Bugün Gelen Paletler', d.palet ? paletHtml(d.palet, d.id) : d.paletHata ? bos('Palet listesi okunamadı') : iskelet(1));
        }
        g.innerHTML = h;
    }

    async function yukle(urun, zorla) {
        var benim = ++nesil;
        var d = { id: urun.id, ajanda: null, transfer: null, satis: null, palet: null, hata: null, paletHata: false };
        ciz(d);
        var guncelle = function () { if (benim === nesil && !perde.hidden) ciz(d); };

        ajandaKayitlari(urun.id).then(function (v) { d.ajanda = v; guncelle(); }, function () { /* ajanda okunamadı */ });

        var t = hareketler([urun.id], TRANSFER, GUN, 20).then(function (v) { d.transfer = v; guncelle(); });
        var s = hareketler([urun.id], SATIS, GUN, 1).then(function (v) { d.satis = v.slice(0, 1); guncelle(); });
        var p = paletler(zorla).then(function (v) { d.palet = v; guncelle(); }, function () { d.paletHata = true; guncelle(); });
        try {
            await Promise.all([t, s]);
        } catch (e) {
            d.hata = e && (e.kod === 'oturum' || e.kod === 'kurulum') ? e.kod : 'ag';
            guncelle();
        }
        await p.catch(function () {});
    }

    function ac(urun) {
        if (!urun || !KIMLIK.test(String(urun.id || ''))) return;
        kur();
        acikUrun = { id: String(urun.id).toLowerCase(), ad: urun.ad || '', gorsel: urun.gorsel || '', barkod: urun.barkod || '' };
        var img = perde.querySelector('[data-uh-gorsel]');
        img.src = acikUrun.gorsel || '../assets/logo.png';
        perde.querySelector('[data-uh-foto]').disabled = !acikUrun.gorsel;
        perde.querySelector('[data-uh-ad]').textContent = acikUrun.ad || 'Ürün';
        perde.querySelector('[data-uh-barkod]').textContent = acikUrun.barkod || '';
        oncekiOdak = document.activeElement;
        perde.hidden = false;
        document.documentElement.classList.add('uh-acik');
        requestAnimationFrame(function () { perde.classList.add('is-acik'); });
        perde.querySelector('[data-uh-kapat]').focus({ preventScroll: true });
        yukle(acikUrun, false);
    }

    function kapat() {
        if (!perde || perde.hidden) return;
        nesil++;
        perde.classList.remove('is-acik');
        document.documentElement.classList.remove('uh-acik');
        var bitti = false;
        var bitir = function () { if (bitti) return; bitti = true; perde.hidden = true; };
        perde.addEventListener('transitionend', bitir, { once: true });
        setTimeout(bitir, 260);
        if (oncekiOdak && oncekiOdak.focus) { try { oncekiOdak.focus({ preventScroll: true }); } catch (e) { /* gitmiş */ } }
    }

    /* Yakalama evresinde: kartın kendi tıklaması (fotoğraf büyütme) çalışmasın.
       Kart bilgisini düğmenin data alanlarından değil, kayıtlı sağlayıcıdan alır. */
    var saglayici = null;
    document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.uh-dugme') : null;
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        var id = b.getAttribute('data-uh-id');
        var urun = saglayici ? saglayici(id) : null;
        ac(urun || { id: id });
    }, true);

    global.JBUrunHareketi = {
        dugme: dugme,
        ac: ac,
        kapat: kapat,
        yeniGelenler: yeniGelenler,
        saglayici: function (fn) { saglayici = typeof fn === 'function' ? fn : null; },
        zamanYaz: zamanYaz,
        kacGunOnce: kacGunOnce
    };
})(window);
