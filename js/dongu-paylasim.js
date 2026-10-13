/**
 * Döngü raporunu herkese açık bağlantıyla paylaşma
 * ============================================================================
 *
 * Döngü başlığındaki "Paylaş" bir bağlantı üretir: jetbarkod.com.tr/dongu/#<anahtar>.
 * Bağlantıyı açan kişi giriş yapmadan yalnız Döngü özetini görür: alt
 * kategori adı, durumu, ilerlemesi ve son sayım zamanı.
 *
 * GÜVENLİK
 *   - Özet bu sayfada hazırlanır (js/sayim-dongu.js `paylasimVerisi`) ve
 *     `dongu_paylasim` tablosuna kullanıcının kendi satırı olarak yazılır.
 *     Ürün, fiyat, stok adedi, depo, oturum ya da hesap bilgisi girmez.
 *   - Rapor sayfası tabloyu okuyamaz; yalnız `dongu_rapor(anahtar)` işlevini
 *     çağırır, o da anahtarı bilinen tek satırın özetini verir.
 *   - Anahtar 128 bit rastgele (crypto.getRandomValues); tahmin edilemez.
 *     Adresteki # kısmı sunucuya gitmez, sunucu kayıtlarına da düşmez.
 *   - "Bağlantıyı Yenile" eski bağlantıyı anında geçersiz kılar,
 *     "Paylaşımı Kapat" satırı siler.
 *
 * Özet Döngü paneli her çizildiğinde karşılaştırılır; değiştiyse birkaç
 * saniye sonra sunucuya yazılır. Döngü açılmadıkça rapor güncellenmez;
 * rapor sayfası son güncelleme zamanını gösterir.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var YAYIN_GECIKMESI_MS = 6000;
    var ANAHTAR = /^[A-Za-z0-9_-]{22,64}$/;

    var d = {
        yuklendi: false,
        yukleniyor: null,
        tabloYok: false,
        kayit: null,          // { token, baslik, guncellendi_at }
        sonIz: null,
        zaman: null,
        mesgul: false,
        hata: null,
        kopyalandi: false,
    };
    var perde = null;

    function kullanici() {
        try { return (global.authUtils && global.authUtils.checkAuth() || {}).username || null; }
        catch (e) { return null; }
    }

    function kacir(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function tabloYokMu(h) {
        var m = String((h && (h.message || h.code)) || '').toLowerCase();
        return m.indexOf('42p01') > -1 || m.indexOf('pgrst205') > -1 || m.indexOf('does not exist') > -1 ||
            m.indexOf('could not find the table') > -1 || m.indexOf('schema cache') > -1;
    }

    function yeniAnahtar() {
        var b = new Uint8Array(16);
        global.crypto.getRandomValues(b);
        var s = '';
        for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function baglanti(token) {
        return 'https://jetbarkod.com.tr/dongu/#' + token;
    }

    function veri() {
        var dn = global.JBSayimDongu;
        if (!dn || typeof dn.paylasimVerisi !== 'function') return null;
        try { return dn.paylasimVerisi(); } catch (e) { return null; }
    }

    function zamanMetni(iso) {
        var t = Date.parse(iso || '');
        if (!t) return '';
        var dk = Math.round((Date.now() - t) / 60000);
        if (dk < 1) return 'Az önce';
        if (dk < 60) return dk + ' dakika önce';
        var sa = Math.round(dk / 60);
        if (sa < 24) return sa + ' saat önce';
        var g = new Date(t);
        return String(g.getDate()).padStart(2, '0') + '.' + String(g.getMonth() + 1).padStart(2, '0') + '.' + g.getFullYear();
    }

    // ------------------------------------------------------------------
    // Sunucu
    // ------------------------------------------------------------------

    function yukle() {
        if (d.yuklendi) return Promise.resolve();
        if (d.yukleniyor) return d.yukleniyor;
        var u = kullanici();
        if (!u || !global.jbDb) { d.yuklendi = true; return Promise.resolve(); }
        d.yukleniyor = global.jbDb.from('dongu_paylasim')
            .select('token, baslik, guncellendi_at')
            .eq('username', u)
            .maybeSingle()
            .then(function (r) {
                if (r.error) { d.tabloYok = tabloYokMu(r.error); return; }
                d.tabloYok = false;
                d.kayit = r.data && ANAHTAR.test(String(r.data.token || '')) ? r.data : null;
            })
            .catch(function () { /* ağ yok: düğme yine çalışır, açılınca tekrar denenir */ })
            .then(function () {
                d.yuklendi = true;
                d.yukleniyor = null;
                if (global.JBSayimDongu && global.JBSayimDongu.ciz) global.JBSayimDongu.ciz();
            });
        return d.yukleniyor;
    }

    async function yaz(alanlar) {
        var u = kullanici();
        if (!u) throw new Error('Oturum bulunamadı.');
        var satir = Object.assign({ username: u, guncellendi_at: new Date().toISOString() }, alanlar);
        var r = await global.jbDb.from('dongu_paylasim').upsert(satir, { onConflict: 'username' });
        if (r.error) {
            if (tabloYokMu(r.error)) d.tabloYok = true;
            throw new Error(d.tabloYok ? 'Paylaşım için sunucu güncellemesi bekleniyor.' : 'Kaydedilemedi. Bağlantını kontrol edip tekrar dene.');
        }
        return satir;
    }

    function iz(v) {
        try { return JSON.stringify(v); } catch (e) { return String(Date.now()); }
    }

    async function yayinla() {
        if (!d.kayit || d.mesgul) return;
        var v = veri();
        if (!v) return;
        var yeniIz = iz(v);
        if (yeniIz === d.sonIz) return;
        try {
            var s = await yaz({ token: d.kayit.token, baslik: d.kayit.baslik || null, ozet: v });
            d.kayit.guncellendi_at = s.guncellendi_at;
            d.sonIz = yeniIz;
            pencereCiz();
        } catch (e) { /* bir sonraki çizimde tekrar denenir */ }
    }

    function degisti() {
        if (!d.yuklendi) { yukle(); return; }
        if (!d.kayit) return;
        clearTimeout(d.zaman);
        d.zaman = setTimeout(yayinla, YAYIN_GECIKMESI_MS);
    }

    async function olustur(yenile) {
        if (d.mesgul) return;
        var v = veri();
        if (!v) { d.hata = 'Döngü verisi hazır değil. Döngü listesi yüklendikten sonra tekrar dene.'; return pencereCiz(); }
        d.mesgul = true;
        d.hata = null;
        pencereCiz();
        try {
            var girdi = perde && perde.querySelector('[data-pl="baslik"]');
            var baslik = girdi ? girdi.value.replace(/\s+/g, ' ').trim().slice(0, 80) : (d.kayit && d.kayit.baslik) || '';
            var token = yeniAnahtar();
            var s = await yaz({ token: token, baslik: baslik || null, ozet: v });
            d.kayit = { token: token, baslik: baslik || null, guncellendi_at: s.guncellendi_at };
            d.sonIz = iz(v);
            d.kopyalandi = false;
            if (yenile) bildir('Yeni bağlantı oluşturuldu. Eski bağlantı artık açılmıyor.');
        } catch (e) {
            d.hata = e.message;
        }
        d.mesgul = false;
        pencereCiz();
        if (global.JBSayimDongu && global.JBSayimDongu.ciz) global.JBSayimDongu.ciz();
    }

    async function kapat() {
        if (d.mesgul || !d.kayit) return;
        var onay = global.JBDiyalog
            ? await global.JBDiyalog.onay('Bağlantıyı açan herkes raporu artık göremez.', {
                baslik: 'Paylaşımı Kapat', tehlikeli: true, onayYazi: 'Kapat' })
            : global.confirm('Paylaşım kapatılsın mı?');
        if (!onay) return;
        d.mesgul = true;
        pencereCiz();
        try {
            var r = await global.jbDb.from('dongu_paylasim').delete().eq('username', kullanici());
            if (r.error) throw new Error('Kapatılamadı. Tekrar dene.');
            d.kayit = null;
            d.sonIz = null;
            bildir('Paylaşım kapatıldı.');
        } catch (e) {
            d.hata = e.message;
        }
        d.mesgul = false;
        pencereCiz();
        if (global.JBSayimDongu && global.JBSayimDongu.ciz) global.JBSayimDongu.ciz();
    }

    async function kopyala() {
        if (!d.kayit) return;
        var metin = baglanti(d.kayit.token);
        try {
            await navigator.clipboard.writeText(metin);
        } catch (e) {
            var g = perde && perde.querySelector('[data-pl="adres"]');
            if (g) { g.select(); try { document.execCommand('copy'); } catch (x) { /* elle kopyalanır */ } }
        }
        d.kopyalandi = true;
        pencereCiz();
        setTimeout(function () { d.kopyalandi = false; pencereCiz(); }, 2000);
    }

    async function paylas() {
        if (!d.kayit || !navigator.share) return kopyala();
        try {
            await navigator.share({ title: d.kayit.baslik || 'Döngü Raporu', url: baglanti(d.kayit.token) });
        } catch (e) { /* vazgeçildi */ }
    }

    function bildir(m) {
        var c = global.countingSystem;
        if (c && c.showToast) c.showToast(m, 'success', 3000);
    }

    // ------------------------------------------------------------------
    // Pencere
    // ------------------------------------------------------------------

    function pencereHtml() {
        var govde, eylem;
        if (!d.yuklendi) {
            govde = '<p class="sd-pencere__metin">Yükleniyor</p>';
            eylem = '<button type="button" class="sd-dugme sd-dugme--ikincil" data-pl="kapat">Kapat</button>';
        } else if (d.tabloYok) {
            govde = '<p class="sd-pencere__uyari">Paylaşım için sunucu güncellemesi bekleniyor. Güncelleme yapılınca bu düğme çalışır.</p>';
            eylem = '<button type="button" class="sd-dugme sd-dugme--ikincil" data-pl="kapat">Kapat</button>';
        } else if (!d.kayit) {
            govde =
                '<p class="sd-pencere__metin">Bağlantıyı açan kişi giriş yapmadan Döngü özetini görür: alt kategoriler, durumları, ilerleme ve son sayım tarihi. ' +
                'Ürün, fiyat, stok adedi ve hesap bilgisi görünmez.</p>' +
                '<label class="sd-pl__alan"><span>Rapor Başlığı</span>' +
                '<input type="text" class="sd-pl__girdi" data-pl="baslik" maxlength="80" placeholder="Döngü Raporu" autocomplete="off"></label>';
            eylem = '<button type="button" class="sd-dugme sd-dugme--ikincil" data-pl="kapat">Vazgeç</button>' +
                '<button type="button" class="sd-dugme sd-dugme--ana" data-pl="olustur"' + (d.mesgul ? ' disabled' : '') + '>' +
                (d.mesgul ? 'Oluşturuluyor' : 'Bağlantı Oluştur') + '</button>';
        } else {
            var adres = baglanti(d.kayit.token);
            govde =
                '<p class="sd-pencere__metin">Bağlantıyı açan herkes ' + (d.kayit.baslik ? '<strong>' + kacir(d.kayit.baslik) + '</strong> raporunu' : 'raporu') +
                ' giriş yapmadan görür. Döngü ekranı her açıldığında rapor kendiliğinden güncellenir.</p>' +
                '<div class="sd-pl__alan"><span>Bağlantı</span><div class="sd-pl__bag">' +
                '<input type="text" class="sd-pl__girdi" data-pl="adres" readonly value="' + kacir(adres) + '" aria-label="Paylaşım bağlantısı">' +
                '<button type="button" class="sd-dugme sd-dugme--ikincil" data-pl="kopyala">' + (d.kopyalandi ? 'Kopyalandı' : 'Kopyala') + '</button>' +
                '</div></div>' +
                '<p class="sd-pl__not">Son güncelleme: ' + kacir(zamanMetni(d.kayit.guncellendi_at) || '—') + '</p>' +
                '<div class="sd-pl__ikincil">' +
                '<button type="button" class="sd-dugme sd-dugme--metin" data-pl="ac">Raporu Aç</button>' +
                '<button type="button" class="sd-dugme sd-dugme--metin" data-pl="yenile"' + (d.mesgul ? ' disabled' : '') + '>Bağlantıyı Yenile</button>' +
                '<button type="button" class="sd-dugme sd-dugme--metin sd-pl__tehlike" data-pl="sil"' + (d.mesgul ? ' disabled' : '') + '>Paylaşımı Kapat</button>' +
                '</div>';
            eylem = '<button type="button" class="sd-dugme sd-dugme--ikincil" data-pl="kapat">Kapat</button>' +
                '<button type="button" class="sd-dugme sd-dugme--ana" data-pl="paylas">' + (navigator.share ? 'Paylaş' : (d.kopyalandi ? 'Kopyalandı' : 'Bağlantıyı Kopyala')) + '</button>';
        }
        return '<div class="sd-pencere" role="dialog" aria-modal="true" aria-labelledby="sdPlBaslik">' +
            '<p class="sd-etiket">Herkese Açık Rapor</p><h2 class="sd-pencere__baslik" id="sdPlBaslik">Döngüyü Paylaş</h2>' +
            govde +
            (d.hata ? '<p class="sd-pencere__uyari">' + kacir(d.hata) + '</p>' : '') +
            '<div class="sd-pencere__eylem">' + eylem + '</div></div>';
    }

    function pencereCiz() {
        if (!perde) return;
        var html = pencereHtml();
        if (perde.__html === html) return;
        // Yazılmakta olan başlık silinmesin
        var girdi = perde.querySelector('[data-pl="baslik"]');
        var deger = girdi ? girdi.value : null;
        perde.innerHTML = html;
        perde.__html = html;
        var yeni = perde.querySelector('[data-pl="baslik"]');
        if (yeni && deger !== null) yeni.value = deger;
    }

    function ac() {
        if (perde) return;
        d.hata = null;
        perde = document.createElement('div');
        perde.className = 'sd-perde';
        document.body.appendChild(perde);
        document.documentElement.classList.add('sd-kilit');
        pencereCiz();
        perde.addEventListener('click', function (e) {
            if (e.target === perde) return kapatPencere();
            var h = e.target.closest('[data-pl]');
            if (!h || h.disabled) return;
            var ne = h.getAttribute('data-pl');
            if (ne === 'kapat') kapatPencere();
            else if (ne === 'olustur') olustur(false);
            else if (ne === 'yenile') olustur(true);
            else if (ne === 'sil') kapat();
            else if (ne === 'kopyala') kopyala();
            else if (ne === 'paylas') paylas();
            else if (ne === 'ac' && d.kayit) global.open(baglanti(d.kayit.token), '_blank', 'noopener');
            else if (ne === 'adres') h.select();
        });
        perde.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') kapatPencere();
            if (e.key === 'Enter' && e.target.matches('[data-pl="baslik"]')) olustur(false);
        });
        void perde.offsetWidth;
        perde.classList.add('is-acik');
        yukle().then(function () {
            pencereCiz();
            var ilk = perde && (perde.querySelector('[data-pl="baslik"]') || perde.querySelector('.sd-dugme--ana'));
            if (ilk) ilk.focus({ preventScroll: true });
        });
    }

    function kapatPencere() {
        if (!perde) return;
        var p = perde;
        perde = null;
        p.classList.remove('is-acik');
        document.documentElement.classList.remove('sd-kilit');
        var azalt = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(function () { p.remove(); }, azalt ? 0 : 200);
    }

    global.JBDonguPaylasim = {
        ac: ac,
        degisti: degisti,
        acikMi: function () { return !!d.kayit; },
    };
})(window);
