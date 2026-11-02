/**
 * Stok düğmesi: ürün kartının sol üstü (Ürün Arama ve Ajanda)
 * ============================================================================
 *
 * Basınca o ürünün anlık stoğu franchise panelinin kendi stok isteğiyle
 * alınır. Ürün açık sayım tablosunda varsa sayılan adet "Sayımda" satırında.
 * Bugün ya da dün transferle stoğa girdiyse kart yeşil çerçeve alır ve
 * "Bugün geldi +24" satırı çıkar (depo paneli, js/urun-hareketi.js). Depo
 * paneli bağlı değilse bu satır sessizce çıkmaz, stok yine görünür.
 *
 * Sonuç yalnız bu aramada durur; sifirla() düğmeleri boşaltır.
 *
 * Oturum: js/franchise-oturum.js. Art arda basılan düğmeler 200 ms içinde
 * toplanıp TEK istekte gider, iki istek arası en az 600 ms.
 *
 * window.JBUrunStok.dugme(id)   → düğme HTML ('' : ayar kapalı ya da kimlik geçersiz)
 * window.JBUrunStok.sifirla()
 * window.JBUrunStok.acikMi(fn)  → düğmenin görünüp görünmeyeceğine karar veren işlev
 * ============================================================================
 */
(function (global) {
    'use strict';

    var STOK_URUN = /^[0-9a-f]{24}$/i;
    var sonuclar = new Map();
    var nesil = 0;
    var kuyruk = new Set();
    var zaman = null;
    var sonIstek = 0;
    var sayimTablosu = null;
    var acikMiFn = function () { return true; };

    var IKON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11z"/><path d="M2.5 5 8 7.5 13.5 5M8 7.5v6"/></svg>';
    var DONEN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 0 5.5 5.5"/></svg>';

    function sifirla() {
        sonuclar = new Map();
        kuyruk = new Set();
        nesil++;
    }

    function sayimSatiri(d) {
        if (!d || !d.sayim) return '';
        var v = d.sayim.sayilan == null ? 'Sırada' : d.sayim.sayilan;
        return '<span class="arama-stok__satir arama-stok__satir--sayim"><span>Sayımda</span><b>' + v + '</b></span>';
    }

    function yeniSatiri(d) {
        if (!d || !d.yeni) return '';
        var H = global.JBUrunHareketi;
        var gun = H ? H.kacGunOnce(d.yeni.zaman) : 0;
        return '<span class="arama-stok__satir arama-stok__satir--yeni"><span>' + (gun === 0 ? 'Bugün' : 'Dün') + '</span><b>+' + d.yeni.adet + '</b></span>';
    }

    function gorunum(d) {
        if (!d) return { sinif: '', html: IKON + '<span>Stok</span>', etiket: 'Stoku göster' };
        if (d.yuk) return { sinif: ' is-yuk', html: DONEN + '<span>Stok</span>', etiket: 'Stok alınıyor' };
        if (d.hata) {
            var m = d.hata === 'oturum' ? ['Oturum yok', 'Franchise panelini aç']
                : d.hata === 'depo' ? ['Depo yok', 'Franchise panelini aç']
                : ['Alınamadı', 'Tekrar dene'];
            return { sinif: ' is-hata', html: '<span class="arama-stok__etiket">' + m[0] + '</span><span class="arama-stok__not">' + m[1] + '</span>', etiket: m[0] + '. ' + m[1] };
        }
        var alt = sayimSatiri(d) + yeniSatiri(d);
        var yeni = d.yeni ? ' is-yeni' : '';
        var yeniEtiket = d.yeni ? ', ' + (global.JBUrunHareketi && global.JBUrunHareketi.kacGunOnce(d.yeni.zaman) === 0 ? 'bugün' : 'dün') + ' ' + d.yeni.adet + ' adet geldi' : '';
        if (d.yok) {
            return {
                sinif: ' is-dolu is-sifir' + yeni,
                html: '<span class="arama-stok__ana"><span class="arama-stok__etiket">Stok</span><span class="arama-stok__sayi">0</span></span><span class="arama-stok__ayrac"></span><span class="arama-stok__not">Depoda yok</span>' + alt,
                etiket: 'Depoda kaydı yok' + yeniEtiket
            };
        }
        var rez = d.rezerv > 0 ? '<span class="arama-stok__satir"><span>Rezerv</span><b>' + d.rezerv + '</b></span>' : '';
        var hepsi = rez + alt;
        return {
            sinif: ' is-dolu' + (d.stok <= 0 ? ' is-sifir' : '') + yeni,
            html: '<span class="arama-stok__ana"><span class="arama-stok__etiket">Stok</span><span class="arama-stok__sayi">' + d.stok + '</span></span>' + (hepsi ? '<span class="arama-stok__ayrac"></span>' + hepsi : ''),
            etiket: 'Stok ' + d.stok + (d.rezerv > 0 ? ', rezerv ' + d.rezerv : '')
                + (d.sayim ? (d.sayim.sayilan == null ? ', sayımda, sırada' : ', sayımda ' + d.sayim.sayilan) : '')
                + yeniEtiket + '. Yenilemek için bas'
        };
    }

    function dugme(productId) {
        var id = String(productId == null ? '' : productId);
        var acik = false;
        try { acik = !!acikMiFn(); } catch (e) { acik = false; }
        if (!acik || !STOK_URUN.test(id)) return '';
        var g = gorunum(sonuclar.get(id));
        return '<button type="button" class="arama-stok' + g.sinif + '" data-stok-id="' + id + '" aria-label="' + g.etiket + '" title="' + g.etiket + '">' + g.html + '</button>';
    }

    function durumYaz(id, d) {
        sonuclar.set(id, d);
        var g = gorunum(d);
        document.querySelectorAll('.arama-stok[data-stok-id="' + id + '"]').forEach(function (b) {
            b.className = 'arama-stok' + g.sinif;
            b.setAttribute('aria-label', g.etiket);
            b.title = g.etiket;
            b.setAttribute('aria-busy', d && d.yuk ? 'true' : 'false');
            b.innerHTML = g.html;
        });
    }

    async function stokCek(ids) {
        var fo = global.franchiseOturum;
        if (!fo) { var h = new Error('oturum'); h.kod = 'oturum'; throw h; }
        var o = await fo.al();
        var r = await fo.istek('/stocks?limit=100&offset=0', {
            method: 'POST',
            govde: { warehouseIds: [o.depo], productIds: ids, sort: { available: -1 } }
        });
        if (!r.ok) { var h2 = new Error('sunucu'); h2.kod = 'sunucu'; throw h2; }
        var j = await r.json().catch(function () { return null; });
        var harita = new Map();
        (Array.isArray(j && j.data) ? j.data : []).forEach(function (row) {
            var id = String(row.id || row._id || row.product || '');
            var stok = Number(row.available != null ? row.available : row.stock != null ? row.stock : row.quantity);
            if (!id || !Number.isFinite(stok)) return;
            var rezerv = null;
            ['reserve', 'reservedStock', 'reserved', 'reservedQuantity', 'rezerveStock'].some(function (k) {
                if (row[k] != null && Number.isFinite(Number(row[k]))) { rezerv = Number(row[k]); return true; }
                return false;
            });
            if (rezerv === null) {
                var top = 0, var_ = false;
                ['reservedForCorporateSales', 'reservedForDisposal', 'reservedForTransfer'].forEach(function (k) {
                    if (row[k] != null && Number.isFinite(Number(row[k]))) { top += Number(row[k]); var_ = true; }
                });
                if (var_) rezerv = top;
            }
            harita.set(id, { stok: stok, rezerv: rezerv || 0 });
        });
        return harita;
    }

    /* Açık sayım tablosunda bu ürünler var mı. Hata sessiz: stok yine görünür. */
    async function sayimBilgisi(ids) {
        var sonuc = new Map();
        var kim = null;
        try {
            kim = (global.userDataManager && global.userDataManager.currentUser && global.userDataManager.currentUser.username) ||
                (global.authUtils && global.authUtils.checkAuth() && global.authUtils.checkAuth().username) || null;
        } catch (e) { kim = null; }
        if (!kim || !global.jbDb) return sonuc;
        try {
            if (!sayimTablosu || Date.now() - sayimTablosu.zaman > 60000) {
                var t = await global.jbDb.from('users').select('tablo:counting_data->_currentTable').eq('username', kim).maybeSingle();
                var ad = t && t.data && t.data.tablo;
                sayimTablosu = { ad: typeof ad === 'string' ? ad : 'Ana Sayım', zaman: Date.now() };
            }
            var r = await global.jbDb.from('counting_items')
                .select('product_id, warehouse_stock')
                .eq('username', kim)
                .eq('table_name', sayimTablosu.ad)
                .in('product_id', ids);
            (Array.isArray(r && r.data) ? r.data : []).forEach(function (x) {
                var n = Number(x.warehouse_stock);
                sonuc.set(String(x.product_id), { sayilan: x.warehouse_stock == null || !Number.isFinite(n) ? null : n });
            });
        } catch (e) { /* sayım bilgisi yok */ }
        return sonuc;
    }

    /* Bugün/dün transferle gelenler. Depo paneli bağlı değilse boş döner. */
    async function yeniBilgisi(ids) {
        var H = global.JBUrunHareketi;
        if (!H) return new Map();
        try { return await H.yeniGelenler(ids); } catch (e) { return new Map(); }
    }

    async function gonder() {
        zaman = null;
        var benim = nesil;
        var ids = Array.from(kuyruk).slice(0, 100);
        ids.forEach(function (i) { kuyruk.delete(i); });
        if (!ids.length) return;
        var b = sonIstek + 600 - Date.now();
        if (b > 0) await new Promise(function (c) { setTimeout(c, b); });
        sonIstek = Date.now();
        var harita = null;
        var hata = null;
        var sayimSozu = sayimBilgisi(ids);
        var yeniSozu = yeniBilgisi(ids);
        try { harita = await stokCek(ids); } catch (e) { hata = e.kod || 'ag'; }
        var sayim = await sayimSozu;
        var yeni = await yeniSozu;
        if (benim !== nesil) return;
        ids.forEach(function (id) {
            if (hata) { durumYaz(id, { hata: hata }); return; }
            var d = Object.assign({}, harita.get(id) || { yok: true });
            if (sayim.has(id)) d.sayim = sayim.get(id);
            var y = yeni.get(id.toLowerCase());
            if (y) d.yeni = y;
            durumYaz(id, d);
        });
        if (kuyruk.size && !zaman) zaman = setTimeout(gonder, 200);
    }

    function iste(id) {
        var d = sonuclar.get(id);
        if ((d && d.yuk) || kuyruk.has(id)) return;
        kuyruk.add(id);
        durumYaz(id, { yuk: true });
        if (!zaman) zaman = setTimeout(gonder, 200);
    }

    // Yakalama evresinde: görselin büyütme penceresi açılmasın
    document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.arama-stok') : null;
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        var id = b.getAttribute('data-stok-id');
        if (STOK_URUN.test(id || '')) iste(id);
    }, true);

    global.JBUrunStok = {
        dugme: dugme,
        sifirla: sifirla,
        iste: iste,
        acikMi: function (fn) { if (typeof fn === 'function') acikMiFn = fn; }
    };
})(window);
