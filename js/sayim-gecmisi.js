/**
 * Sayım Geçmişi ve "Önceki Sayım"
 * ============================================================================
 *
 * SAYIM GEÇMİŞİ
 * Depo panelinde bir tarih aralığında yapılmış sayımların ürün başına sonucu:
 * sistemde kaç vardı, kaç sayıldı, fark ne. Yanlışlıkla sıfırlanan ürün de
 * burada görünür. Veriyi Jet Barkod Asistan okuyor (panelin kendi
 * istekleriyle, arka planda); sonuç `sayim_gecmisi` tablosuna yazılıyor ki
 * telefon da görsün. Tablo henüz kurulmadıysa bu tarayıcıda saklanır.
 *
 * ÖNCEKİ SAYIM
 * Ay içinde panelde yapılmış bir sayım ürünü zaten +17 düzelttiyse, sistem
 * stoğu bu düzeltmeyi içerir; bizim tabloda fark 0 görünür. "Önceki Sayım"
 * bu 17'yi rafta sayılanın üstüne ekler: fark = (raf + önceki) − sistem.
 * Değer sayım satırının içinde durur (js/counting.js `setEkSayim`).
 *
 * Panelden okunan sayım, ürünün sistem stoğu çekilmeden ÖNCE tamamlandıysa
 * önerilir. Sonra yapılmış sayım zaten bu tablodan doğmuş olabilir; onu
 * eklemek farkı iki kez sayar.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var KIMLIK = /^[0-9a-f]{24}$/;
    var SAKLAMA_GUN = 120;
    var SATIR_SINIRI = 200;
    var GOREV_SURESI_SN = 0.8;

    var durum = {
        kayitlar: new Map(),      // gorev_id -> kayıt
        tam: new Set(),           // eksiksiz okunmuş sayım kimlikleri
        yuklendi: false,
        yukleniyor: null,
        tabloVar: null,           // null bilinmiyor, false kurulmamış
        calisma: null,            // { basladi, yapilan, toplam, mesaj, asama }
        sonHata: null,
        sonOzet: null,
        suzgec: 'fark',
        arama: '',
        gosterilen: SATIR_SINIRI,
        acik: {},
    };

    // ------------------------------------------------------------------
    // Yardımcılar
    // ------------------------------------------------------------------

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function kullanici() {
        try { return (global.authUtils && global.authUtils.checkAuth() || {}).username || null; }
        catch (e) { return null; }
    }

    function cs() { return global.countingSystem || null; }

    function gunIso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function gunBasi(iso) { var p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).getTime(); }
    function gunSonu(iso) { return gunBasi(iso) + 86400000 - 1; }

    function tarihMetni(ms) {
        if (!ms) return '—';
        var d = new Date(ms);
        return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
    }
    function zamanMetni(ms) {
        if (!ms) return '—';
        var d = new Date(ms);
        return tarihMetni(ms) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function sayi(n) {
        var c = cs();
        if (c && typeof c._sayiMetni === 'function') return c._sayiMetni(n);
        return String(Math.round(Number(n) * 1000) / 1000).replace('.', ',');
    }
    function isaretli(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + sayi(Math.abs(n)); }

    function ms(v) { var t = v ? new Date(v).getTime() : 0; return isNaN(t) ? 0 : t; }

    function ayar() {
        var bugun = new Date();
        var v = { bas: gunIso(new Date(bugun.getFullYear(), bugun.getMonth(), 1)), son: gunIso(bugun), otomatik: true };
        try {
            var y = JSON.parse(localStorage.getItem('jb_sg_ayar') || 'null');
            if (y && typeof y === 'object') {
                if (/^\d{4}-\d{2}-\d{2}$/.test(y.bas)) v.bas = y.bas;
                if (/^\d{4}-\d{2}-\d{2}$/.test(y.son)) v.son = y.son;
                if (typeof y.otomatik === 'boolean') v.otomatik = y.otomatik;
                // Kayıtlı bitiş geçmişte kaldıysa bugüne çek: "ayın 1'i → bugün" alışkanlığı
                if (y.sonBugun !== false && v.son < gunIso(bugun)) v.son = gunIso(bugun);
            }
        } catch (e) { /* varsayılan */ }
        return v;
    }
    function ayarYaz(v) {
        try { localStorage.setItem('jb_sg_ayar', JSON.stringify({ bas: v.bas, son: v.son, otomatik: v.otomatik, sonBugun: v.son === gunIso(new Date()) })); }
        catch (e) { /* önemsiz */ }
    }

    function urunBilgisi(pid, kayit) {
        var c = cs();
        var p = c && c.productIndex && c.productIndex.get ? c.productIndex.get(pid) : null;
        return {
            ad: (p && p.name) || (kayit && kayit.ad) || 'Ürün',
            gorsel: (p && (p.image || p.imageUrl)) || '',
        };
    }

    function depoKimligi() {
        var c = cs();
        if (!c) return null;
        var aday = [c.cachedFullData && c.cachedFullData._api_info];
        try { aday.push(JSON.parse(localStorage.getItem('getir_api_info') || 'null')); } catch (e) { /* yok */ }
        for (var i = 0; i < aday.length; i++) {
            var k = aday[i] && c._depoKimligi ? c._depoKimligi(aday[i].warehouseId) : null;
            if (k && KIMLIK.test(k)) return k;
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Saklama
    // ------------------------------------------------------------------

    function yerelAnahtar() { return 'jb_sayim_gecmisi_' + (kullanici() || '_'); }

    function kayitAl(r) {
        // Hem veritabanı satırı hem Asistan kaydı aynı biçime gelir
        var k = {
            g: String(r.gorev_id || r.g || ''),
            s: String(r.sayim_id || r.s || ''),
            p: String(r.product_id || r.p || ''),
            ad: r.urun_adi != null ? r.urun_adi : (r.ad || null),
            sis: Number(r.sistem != null ? r.sistem : r.sis),
            fiz: Number(r.fiziksel != null ? r.fiziksel : r.fiz),
            b: r.birim != null ? Number(r.birim) : (r.b != null ? Number(r.b) : null),
            o: r.otomatik != null ? r.otomatik === true : r.o === true,
            n: Number(r.sayim_gorev_sayisi != null ? r.sayim_gorev_sayisi : r.n) || null,
            sa: ms(r.sayim_at || r.sa),
            ta: ms(r.tamamlandi_at || r.ta),
        };
        if (!KIMLIK.test(k.g) || !KIMLIK.test(k.s) || !KIMLIK.test(k.p)) return null;
        if (!Number.isFinite(k.sis) || !Number.isFinite(k.fiz) || !k.sa) return null;
        if (k.ad) k.ad = String(k.ad).slice(0, 200);
        return k;
    }

    function satira(k) {
        return {
            username: kullanici(),
            gorev_id: k.g, sayim_id: k.s, product_id: k.p,
            urun_adi: k.ad || null,
            sistem: k.sis, fiziksel: k.fiz, birim: k.b,
            otomatik: k.o === true,
            sayim_gorev_sayisi: k.n,
            sayim_at: new Date(k.sa).toISOString(),
            tamamlandi_at: k.ta ? new Date(k.ta).toISOString() : null,
        };
    }

    function tabloYokMu(hata) {
        var m = String((hata && (hata.message || hata.code)) || '').toLowerCase();
        return m.indexOf('42p01') > -1 || m.indexOf('pgrst205') > -1 || m.indexOf('does not exist') > -1 ||
            m.indexOf('could not find the table') > -1 || m.indexOf('schema cache') > -1;
    }

    function yereldenOku() {
        try {
            var ham = JSON.parse(localStorage.getItem(yerelAnahtar()) || 'null');
            if (!ham || typeof ham !== 'object') return;
            (ham.k || []).forEach(function (r) { var k = kayitAl(r); if (k) durum.kayitlar.set(k.g, k); });
            (ham.t || []).forEach(function (s) { if (KIMLIK.test(s)) durum.tam.add(s); });
        } catch (e) { /* bozuk kopya */ }
    }

    function yereleYaz() {
        try {
            var esik = Date.now() - SAKLAMA_GUN * 86400000;
            var k = [];
            durum.kayitlar.forEach(function (x) { if (x.sa >= esik) k.push(x); });
            localStorage.setItem(yerelAnahtar(), JSON.stringify({ k: k, t: Array.from(durum.tam) }));
        } catch (e) { /* kota dolu olabilir */ }
    }

    function yukle() {
        if (durum.yuklendi) return Promise.resolve();
        if (durum.yukleniyor) return durum.yukleniyor;
        yereldenOku();
        var u = kullanici();
        durum.yukleniyor = (async function () {
            if (!u || !global.jbDb) return;
            var esik = new Date(Date.now() - SAKLAMA_GUN * 86400000).toISOString();
            try {
                var r = await global.jbDb.from('sayim_gecmisi')
                    .select('gorev_id,sayim_id,product_id,urun_adi,sistem,fiziksel,birim,otomatik,sayim_gorev_sayisi,sayim_at,tamamlandi_at')
                    .eq('username', u)
                    .gte('sayim_at', esik)
                    .order('sayim_at', { ascending: false })
                    .limit(20000);
                if (r.error) {
                    if (tabloYokMu(r.error)) durum.tabloVar = false;
                    return;
                }
                durum.tabloVar = true;
                (r.data || []).forEach(function (row) { var k = kayitAl(row); if (k) durum.kayitlar.set(k.g, k); });
            } catch (e) { /* ağ yok: yerel kopya kalır */ }
        })().then(function () {
            tamlariHesapla();
            durum.yuklendi = true;
            durum.yukleniyor = null;
        });
        return durum.yukleniyor;
    }

    /** Görev sayısı kadar kaydı olan sayım eksiksiz sayılır. */
    function tamlariHesapla() {
        var sayac = {};
        var gorev = {};
        durum.kayitlar.forEach(function (k) {
            sayac[k.s] = (sayac[k.s] || 0) + 1;
            if (k.n) gorev[k.s] = k.n;
        });
        Object.keys(sayac).forEach(function (s) { if (gorev[s] && sayac[s] >= gorev[s]) durum.tam.add(s); });
    }

    async function kaydet(kayitlar) {
        kayitlar.forEach(function (k) { durum.kayitlar.set(k.g, k); });
        yereleYaz();
        if (durum.tabloVar === false || !global.jbDb || !kullanici()) return;
        var satirlar = kayitlar.map(satira);
        for (var i = 0; i < satirlar.length; i += SATIR_SINIRI) {
            try {
                var r = await global.jbDb.from('sayim_gecmisi')
                    .upsert(satirlar.slice(i, i + SATIR_SINIRI), { onConflict: 'username,gorev_id' });
                if (r.error) {
                    if (tabloYokMu(r.error)) { durum.tabloVar = false; return; }
                    console.warn('Sayım geçmişi kaydı:', r.error.message || r.error);
                } else {
                    durum.tabloVar = true;
                }
            } catch (e) { /* ağ: yerel kopya duruyor, bir dahaki çekimde tekrar yazılır */ }
        }
    }

    // ------------------------------------------------------------------
    // Asistan ile konuşma
    // ------------------------------------------------------------------

    var dinleyiciKuruldu = false;
    var kabulBekleyen = null;

    function dinleyiciKur() {
        if (dinleyiciKuruldu) return;
        dinleyiciKuruldu = true;
        global.addEventListener('message', function (e) {
            if (e.source !== global || e.origin !== location.origin) return;
            var d = e.data;
            if (!d || typeof d.type !== 'string') return;
            if (d.type === 'JB_SAYIM_GECMISI_KABUL' && kabulBekleyen) {
                var f = kabulBekleyen;
                if (d.ok) { kabulBekleyen = null; f(d); }
                else setTimeout(function () { if (kabulBekleyen === f) { kabulBekleyen = null; f(d); } }, 300);
                return;
            }
            if (d.type === 'JB_SAYIM_GECMISI_OLAY' && durum.calisma) olayIsle(d);
        });
    }

    function olayIsle(d) {
        var c = durum.calisma;
        if (d.tur === 'ilerleme') {
            if (d.mesaj) c.mesaj = d.mesaj;
            if (d.asama) c.asama = d.asama;
            if (Number.isFinite(d.toplam)) c.toplam = d.toplam;
            if (Number.isFinite(d.yapilan)) {
                if (!c.gorevBasladi && d.yapilan > 0) c.gorevBasladi = Date.now();
                c.yapilan = d.yapilan;
            }
            if (Number.isFinite(d.sayimSayisi)) c.sayimSayisi = d.sayimSayisi;
            if (Number.isFinite(d.yeniSayim)) c.yeniSayim = d.yeniSayim;
            ilerlemeCiz();
            return;
        }
        if (d.tur === 'parca') {
            var yeni = (Array.isArray(d.kayitlar) ? d.kayitlar : []).map(kayitAl).filter(Boolean);
            if (d.tam && KIMLIK.test(String(d.sayimId))) durum.tam.add(String(d.sayimId));
            c.yazma = (c.yazma || Promise.resolve()).then(function () { return kaydet(yeni); });
            return;
        }
        if (d.tur === 'bitti') {
            if (c.bitti) return;
            c.bitti = true;
            (c.yazma || Promise.resolve()).then(function () {
                durum.calisma = null;
                if (!d.ok) durum.sonHata = d.hata || 'Sayım geçmişi alınamadı.';
                else durum.sonHata = null;
                durum.sonOzet = {
                    sayim: d.sayimSayisi || 0, yeni: d.yeniSayim || 0,
                    kayit: d.kayitSayisi || 0, durduruldu: !!d.durduruldu,
                };
                tamlariHesapla();
                yereleYaz();
                pencereCiz();
                guncelPencereyiTazele();
                var c2 = cs();
                if (c2 && c2.showToast) {
                    if (!d.ok) c2.showToast(durum.sonHata, 'error', 5000);
                    else if (d.durduruldu) c2.showToast('Durduruldu. Okunan sayımlar kaydedildi.', 'info', 3500);
                    else c2.showToast((d.kayitSayisi || 0) + ' ürün sayımı okundu.', 'success', 3000);
                }
            });
        }
    }

    function asistanaSor(istek) {
        dinleyiciKur();
        return new Promise(function (coz) {
            var bitti = false;
            kabulBekleyen = function (d) { if (bitti) return; bitti = true; coz(d); };
            try { global.postMessage(istek, location.origin); } catch (e) { /* sessiz */ }
            setTimeout(function () {
                if (bitti) return;
                bitti = true;
                kabulBekleyen = null;
                coz({ ok: false, hata: 'Jet Barkod Asistan yanıt vermedi. Asistan kurulu ve güncel olmalı (0.25 ve sonrası). Sayfayı yenileyip tekrar deneyin.' });
            }, 5000);
        });
    }

    async function baslat() {
        if (durum.calisma) return;
        var a = ayarOku();
        if (!a) return;
        ayarYaz(a);
        var depo = depoKimligi();
        if (!depo) {
            durum.sonHata = 'Depo bilgisi bulunamadı. Franchise stok sayfasını bir kez açın, depo oradan öğreniliyor.';
            pencereCiz();
            return;
        }
        await yukle();
        var bilinen = {};
        durum.tam.forEach(function (s) { bilinen[s] = true; });

        durum.sonHata = null;
        durum.calisma = { basladi: Date.now(), yapilan: 0, toplam: 0, mesaj: 'Asistan hazırlanıyor', asama: 'acilis' };
        pencereCiz();

        var y = await asistanaSor({
            type: 'JB_SAYIM_GECMISI_ISTEK',
            warehouseId: depo, baslangic: a.bas, bitis: a.son, otomatik: a.otomatik, bilinen: bilinen,
        });
        if (!y.ok) {
            durum.calisma = null;
            durum.sonHata = y.hata || 'Asistan işi başlatamadı.';
            pencereCiz();
        }
    }

    function durdur() {
        if (!durum.calisma) return;
        durum.calisma.mesaj = 'Durduruluyor';
        ilerlemeCiz();
        try { global.postMessage({ type: 'JB_SAYIM_GECMISI_DURDUR' }, location.origin); } catch (e) { /* sessiz */ }
    }

    // ------------------------------------------------------------------
    // Hesap
    // ------------------------------------------------------------------

    function kayitZamani(k) { return k.ta || k.sa; }

    function aralikKayitlari(a) {
        var bas = gunBasi(a.bas);
        var son = gunSonu(a.son);
        var out = [];
        durum.kayitlar.forEach(function (k) {
            if (k.sa < bas || k.sa > son) return;
            if (!a.otomatik && k.o) return;
            out.push(k);
        });
        return out;
    }

    function urunOzetleri(a) {
        var harita = new Map();
        aralikKayitlari(a).forEach(function (k) {
            var u = harita.get(k.p);
            if (!u) { u = { p: k.p, ad: k.ad, kayitlar: [], net: 0, sifir: false, son: 0, sayim: new Set() }; harita.set(k.p, u); }
            u.kayitlar.push(k);
            u.net = Math.round((u.net + (k.fiz - k.sis)) * 1000) / 1000;
            if (k.fiz === 0 && k.sis > 0) u.sifir = true;
            u.son = Math.max(u.son, kayitZamani(k));
            u.sayim.add(k.s);
        });
        var liste = Array.from(harita.values());
        liste.forEach(function (u) { u.kayitlar.sort(function (x, y) { return kayitZamani(y) - kayitZamani(x); }); });
        return liste;
    }

    /**
     * Bir ürünün önerilen "önceki sayım"ı: seçili aralıkta, sistem stoğu
     * çekilmeden önce tamamlanmış panel sayımlarının fark toplamı.
     */
    function urunOnerisi(pid, entry) {
        var a = ayar();
        var sinir = entry && entry.systemStockAt ? ms(entry.systemStockAt) : Date.now();
        var kayitlar = aralikKayitlari(a).filter(function (k) { return k.p === pid; })
            .sort(function (x, y) { return kayitZamani(y) - kayitZamani(x); });
        var gecerli = kayitlar.filter(function (k) { return kayitZamani(k) <= sinir; });
        var net = 0;
        gecerli.forEach(function (k) { net = Math.round((net + (k.fiz - k.sis)) * 1000) / 1000; });
        return { kayitlar: kayitlar, gecerli: gecerli, net: net, sinir: sinir, aralik: a };
    }

    // ------------------------------------------------------------------
    // Sayım Geçmişi penceresi
    // ------------------------------------------------------------------

    var IKON_KAPAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
    var IKON_GECMIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

    var katman = null;

    function katmanAc(icerik, kucuk) {
        var k = document.createElement('div');
        k.className = 'sg-katman';
        k.innerHTML = '<div class="sg-panel' + (kucuk ? ' sg-panel--kucuk' : '') + '" role="dialog" aria-modal="true">' + icerik + '</div>';
        document.body.appendChild(k);
        requestAnimationFrame(function () { k.classList.add('is-acik'); });
        k.addEventListener('click', function (e) { if (e.target === k) katmanKapat(k); });
        return k;
    }

    function katmanKapat(k) {
        if (!k || !k.parentNode) return;
        k.classList.remove('is-acik');
        var kaldir = function () { if (k.parentNode) k.parentNode.removeChild(k); };
        var azalt = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (azalt) kaldir(); else setTimeout(kaldir, 240);
        if (k === katman) katman = null;
        if (k === duzenleyici) duzenleyici = null;
    }

    function ayarOku() {
        if (!katman) return ayar();
        var bas = katman.querySelector('[data-sg="bas"]').value;
        var son = katman.querySelector('[data-sg="son"]').value;
        var otomatik = katman.querySelector('[data-sg="otomatik"]').checked;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bas) || !/^\d{4}-\d{2}-\d{2}$/.test(son) || bas > son) {
            durum.sonHata = 'Tarih aralığı geçersiz.';
            pencereCiz();
            return null;
        }
        if ((gunBasi(son) - gunBasi(bas)) / 86400000 > 92) {
            durum.sonHata = 'En fazla 3 aylık aralık seçilebilir.';
            pencereCiz();
            return null;
        }
        return { bas: bas, son: son, otomatik: otomatik };
    }

    function pencereAc() {
        if (katman) return;
        var a = ayar();
        katman = katmanAc(
            '<div class="sg-ust"><div class="sg-ust__metin">' +
                '<h2 class="sg-baslik">Sayım Geçmişi</h2>' +
                '<p class="sg-alt">Depo panelindeki sayımlarda sistemde kaç vardı, kaç sayıldı.</p>' +
            '</div><button type="button" class="sg-kapat" data-sg="kapat" aria-label="Kapat">' + IKON_KAPAT + '</button></div>' +
            '<div class="sg-govde">' +
                '<div class="sg-ayar">' +
                    '<label class="sg-alan"><span>Başlangıç</span><input type="date" class="sg-girdi" data-sg="bas" value="' + a.bas + '" max="' + gunIso(new Date()) + '"></label>' +
                    '<label class="sg-alan"><span>Bitiş</span><input type="date" class="sg-girdi" data-sg="son" value="' + a.son + '" max="' + gunIso(new Date()) + '"></label>' +
                    '<label class="sg-anahtar"><input type="checkbox" data-sg="otomatik"' + (a.otomatik ? ' checked' : '') + '><span class="sg-anahtar__iz" aria-hidden="true"></span><span>Günlük Sayımlar Dahil</span></label>' +
                '</div>' +
                '<div data-sg="durum"></div>' +
                '<div data-sg="sonuc"></div>' +
            '</div>' +
            '<div class="sg-alt-cubuk" data-sg="alt"></div>'
        );
        katman.addEventListener('click', pencereTiklama);
        katman.addEventListener('change', function (e) {
            var t = e.target;
            if (t.matches('[data-sg="bas"], [data-sg="son"], [data-sg="otomatik"]')) {
                var y = ayarOku();
                if (y) { ayarYaz(y); durum.sonHata = null; durum.gosterilen = SATIR_SINIRI; pencereCiz(); }
            }
        });
        katman.addEventListener('input', function (e) {
            if (e.target.matches('[data-sg="ara"]')) {
                durum.arama = e.target.value;
                durum.gosterilen = SATIR_SINIRI;
                listeCiz();
            }
        });
        document.addEventListener('keydown', escKapat);
        pencereCiz();
        yukle().then(pencereCiz);
    }

    function escKapat(e) {
        if (e.key !== 'Escape') return;
        if (duzenleyici) { katmanKapat(duzenleyici); return; }
        if (katman) { katmanKapat(katman); document.removeEventListener('keydown', escKapat); }
    }

    function pencereTiklama(e) {
        var t = e.target.closest('[data-sg]');
        if (!t) return;
        var ne = t.getAttribute('data-sg');
        if (ne === 'kapat') { katmanKapat(katman); document.removeEventListener('keydown', escKapat); }
        else if (ne === 'baslat') baslat();
        else if (ne === 'durdur') durdur();
        else if (ne === 'uygula') tabloyaUygula();
        else if (ne === 'daha') { durum.gosterilen += SATIR_SINIRI; listeCiz(); }
        else if (ne === 'suzgec') { durum.suzgec = t.getAttribute('data-deger'); durum.gosterilen = SATIR_SINIRI; sonucCiz(); }
        else if (ne === 'urun') {
            var p = t.getAttribute('data-p');
            durum.acik[p] = !durum.acik[p];
            listeCiz();
        }
    }

    function pencereCiz() {
        if (!katman) return;
        ilerlemeCiz();
        sonucCiz();
        altCiz();
    }

    function altCiz() {
        var alt = katman && katman.querySelector('[data-sg="alt"]');
        if (!alt) return;
        var c = cs();
        var tabloVar = c && c.currentTableName && c.countingData;
        if (durum.calisma) {
            alt.innerHTML = '<button type="button" class="sg-dugme" data-sg="durdur">Durdur</button>';
            return;
        }
        alt.innerHTML =
            (tabloVar && durum.kayitlar.size
                ? '<button type="button" class="sg-dugme" data-sg="uygula">Bu Tabloya Uygula</button>'
                : '') +
            '<button type="button" class="sg-dugme sg-dugme--ana" data-sg="baslat">' + IKON_GECMIS + '<span>Sayımları Çek</span></button>';
    }

    function ilerlemeCiz() {
        var kutu = katman && katman.querySelector('[data-sg="durum"]');
        if (!kutu) return;
        if (durum.calisma) {
            var c = durum.calisma;
            var oran = c.toplam ? Math.min(1, c.yapilan / c.toplam) : 0;
            var kalan = '';
            if (c.toplam && c.yapilan > 3 && c.gorevBasladi) {
                var hiz = (Date.now() - c.gorevBasladi) / c.yapilan;
                var sn = Math.max(0, Math.round(((c.toplam - c.yapilan) * hiz) / 1000));
                kalan = sn >= 60 ? ' · yaklaşık ' + Math.ceil(sn / 60) + ' dk kaldı' : ' · ' + sn + ' sn kaldı';
            } else if (c.toplam) {
                var tahmin = Math.ceil((c.toplam * GOREV_SURESI_SN) / 60);
                kalan = ' · yaklaşık ' + tahmin + ' dk';
            }
            kutu.innerHTML =
                '<div class="sg-ilerleme" role="status" aria-live="polite">' +
                    '<div class="sg-ilerleme__satir"><span class="sg-ilerleme__metin">' + esc(c.mesaj || 'Okunuyor') + '</span>' +
                    '<span class="sg-ilerleme__sayi">' + (c.toplam ? sayi(c.yapilan) + ' / ' + sayi(c.toplam) + ' ürün' : '') + esc(kalan) + '</span></div>' +
                    '<div class="sg-cubuk' + (c.toplam ? '' : ' sg-cubuk--belirsiz') + '"><i style="transform:scaleX(' + oran.toFixed(4) + ')"></i></div>' +
                    '<p class="sg-not">Depo paneli arka planda açık kalır, iş bitince kapanır. Bu sayfada çalışmaya devam edebilirsin.</p>' +
                '</div>';
            return;
        }
        if (durum.sonHata) {
            kutu.innerHTML = '<div class="sg-hata" role="alert">' + esc(durum.sonHata) + '</div>';
            return;
        }
        var not = durum.tabloVar === false
            ? 'Sonuçlar şimdilik yalnız bu tarayıcıda saklanıyor. Telefonda görmek için sunucu güncellemesi gerekiyor.'
            : 'İlk çekim bir ay için birkaç dakika sürebilir. Sonra yalnız yeni sayımlar okunur.';
        kutu.innerHTML = '<p class="sg-not">' + esc(not) + '</p>';
    }

    function suzgecUygun(u) {
        if (durum.suzgec === 'fark') return u.net !== 0 || u.sifir;
        if (durum.suzgec === 'eksik') return u.net < 0;
        if (durum.suzgec === 'fazla') return u.net > 0;
        if (durum.suzgec === 'sifir') return u.sifir;
        return true;
    }

    function sonucCiz() {
        var kutu = katman && katman.querySelector('[data-sg="sonuc"]');
        if (!kutu) return;
        if (!durum.yuklendi) {
            kutu.innerHTML = '<div class="sg-bos">Kayıtlar yükleniyor</div>';
            return;
        }
        var a = ayar();
        var ozet = urunOzetleri(a);
        var kayit = 0, fazla = 0, eksik = 0, sifir = 0;
        var sayimlar = new Set();
        ozet.forEach(function (u) {
            kayit += u.kayitlar.length;
            u.sayim.forEach(function (s) { sayimlar.add(s); });
            if (u.net > 0) fazla += u.net;
            if (u.net < 0) eksik += u.net;
            if (u.sifir) sifir++;
        });
        if (!ozet.length) {
            kutu.innerHTML = '<div class="sg-bos">' +
                (durum.kayitlar.size
                    ? 'Bu aralıkta okunmuş sayım yok. Aralığı değiştir ya da "Sayımları Çek" ile oku.'
                    : 'Henüz sayım okunmadı. Tarih aralığını seçip "Sayımları Çek"e bas.') +
                '</div>';
            altCiz();
            return;
        }
        var suzgecler = [
            ['fark', 'Farklı Olanlar'], ['eksik', 'Eksik'], ['fazla', 'Fazla'], ['sifir', 'Sıfırlanan'], ['hepsi', 'Tümü'],
        ];
        kutu.innerHTML =
            '<div class="sg-kpi">' +
                '<div class="sg-kpi__kutu"><div class="sg-kpi__ad">Sayım</div><div class="sg-kpi__deger">' + sayi(sayimlar.size) + '</div></div>' +
                '<div class="sg-kpi__kutu"><div class="sg-kpi__ad">Fazla</div><div class="sg-kpi__deger sg-kpi__deger--fazla">' + isaretli(fazla) + '</div></div>' +
                '<div class="sg-kpi__kutu"><div class="sg-kpi__ad">Eksik</div><div class="sg-kpi__deger sg-kpi__deger--eksik">' + isaretli(eksik) + '</div></div>' +
                '<div class="sg-kpi__kutu"><div class="sg-kpi__ad">Sıfırlanan Ürün</div><div class="sg-kpi__deger' + (sifir ? ' sg-kpi__deger--uyari' : '') + '">' + sayi(sifir) + '</div></div>' +
            '</div>' +
            '<div class="sg-suzgec" role="group" aria-label="Süzgeç">' +
                suzgecler.map(function (s) {
                    return '<button type="button" data-sg="suzgec" data-deger="' + s[0] + '" aria-pressed="' + (durum.suzgec === s[0]) + '">' + s[1] + '</button>';
                }).join('') +
            '</div>' +
            '<input type="search" class="sg-girdi sg-ara" data-sg="ara" placeholder="Ürün ara" value="' + esc(durum.arama) + '" autocomplete="off">' +
            '<div class="sg-liste" data-sg="liste"></div>';
        listeCiz(ozet);
        altCiz();
    }

    function listeCiz(onHesap) {
        var kutu = katman && katman.querySelector('[data-sg="liste"]');
        if (!kutu) return;
        var ozet = onHesap || urunOzetleri(ayar());
        var ara = durum.arama.trim().toLocaleLowerCase('tr');
        var liste = ozet.filter(suzgecUygun).map(function (u) {
            var b = urunBilgisi(u.p, u);
            return { u: u, b: b };
        }).filter(function (x) {
            return !ara || x.b.ad.toLocaleLowerCase('tr').indexOf(ara) > -1;
        });
        liste.sort(function (x, y) {
            return Math.abs(y.u.net) - Math.abs(x.u.net) || (y.u.sifir - x.u.sifir) || (y.u.son - x.u.son);
        });
        if (!liste.length) {
            kutu.innerHTML = '<div class="sg-bos">Bu süzgeçte ürün yok.</div>';
            return;
        }
        var parca = liste.slice(0, durum.gosterilen);
        kutu.innerHTML = parca.map(function (x) {
            var u = x.u;
            var sinif = u.net > 0 ? 'fazla' : u.net < 0 ? 'eksik' : 'esit';
            var acik = !!durum.acik[u.p];
            return '<div class="sg-urun">' +
                '<button type="button" class="sg-urun__bas" data-sg="urun" data-p="' + u.p + '" aria-expanded="' + acik + '">' +
                    (x.b.gorsel
                        ? '<img class="sg-urun__foto" src="' + esc(x.b.gorsel) + '" alt="" loading="lazy" decoding="async">'
                        : '<span class="sg-urun__foto" aria-hidden="true"></span>') +
                    '<span class="sg-urun__metin"><span class="sg-urun__ad">' + esc(x.b.ad) + '</span>' +
                    '<span class="sg-urun__bilgi"><span>' + u.kayitlar.length + ' sayım · son ' + esc(tarihMetni(u.son)) + '</span>' +
                    (u.sifir ? '<span class="sg-etiket sg-etiket--sifir">Sıfırlandı</span>' : '') + '</span></span>' +
                    '<span class="sg-net sg-net--' + sinif + '">' + (u.net === 0 ? '0' : isaretli(u.net)) + '</span>' +
                '</button>' +
                (acik ? '<div class="sg-kayitlar">' + u.kayitlar.map(kayitSatiri).join('') + '</div>' : '') +
            '</div>';
        }).join('') +
        (liste.length > parca.length
            ? '<button type="button" class="sg-dugme sg-daha" data-sg="daha">' + sayi(liste.length - parca.length) + ' Ürün Daha Göster</button>'
            : '');
    }

    function kayitSatiri(k) {
        var f = Math.round((k.fiz - k.sis) * 1000) / 1000;
        var renk = f > 0 ? '#047857' : f < 0 ? '#b42318' : '#667085';
        return '<div class="sg-kayit">' +
            '<span class="sg-kayit__zaman">' + esc(zamanMetni(kayitZamani(k))) + '</span>' +
            '<span class="sg-kayit__adet">Sistem ' + sayi(k.sis) + ' → Sayılan ' + sayi(k.fiz) + (k.o ? ' <span class="sg-etiket">Günlük</span>' : '') + '</span>' +
            '<span class="sg-kayit__fark" style="color:' + renk + '">' + (f === 0 ? '0' : isaretli(f)) + '</span>' +
        '</div>';
    }

    async function tabloyaUygula() {
        var c = cs();
        if (!c || !c.countingData || !c.currentTableName) return;
        var degisecek = [];
        Object.keys(c.countingData).forEach(function (pid) {
            if (!KIMLIK.test(pid)) return;
            var e = c.countingData[pid];
            if (!e || typeof e !== 'object') return;
            var o = urunOnerisi(pid, e);
            var mevcut = c._ekSayim(e);
            if (o.gecerli.length && o.net !== mevcut) degisecek.push({ pid: pid, net: o.net, mevcut: mevcut });
        });
        if (!degisecek.length) {
            c.showToast && c.showToast('Bu tabloda uygulanacak önceki sayım yok.', 'info', 3000);
            return;
        }
        var tabloAdi = typeof c._durumTabloEtiketi === 'function' ? c._durumTabloEtiketi(c.currentTableName) : c.currentTableName;
        var onay = global.JBDiyalog && global.JBDiyalog.onay
            ? await global.JBDiyalog.onay(
                '"' + tabloAdi + '" tablosunda ' + degisecek.length + ' ürüne önceki sayım yazılacak. ' +
                'Elle girilmiş önceki sayım değerlerinin üstüne yazılır.',
                { baslik: 'Önceki Sayımları Uygula', onayYazi: 'Uygula' })
            : global.confirm(degisecek.length + ' ürüne önceki sayım yazılsın mı?');
        if (!onay) return;
        for (var i = 0; i < degisecek.length; i++) {
            try { await c.setEkSayim(degisecek[i].pid, degisecek[i].net); } catch (e) { console.warn('Önceki sayım:', e); }
        }
        c.showToast && c.showToast(degisecek.length + ' ürüne önceki sayım yazıldı.', 'success', 3000);
    }

    // ------------------------------------------------------------------
    // Sayım penceresi: "Önceki Sayım" çipi ve düzenleyici
    // ------------------------------------------------------------------

    var cip = null;
    var duzenleyici = null;

    function cipKur() {
        if (cip && document.body.contains(cip)) return cip;
        var girdi = document.getElementById('countingDepoInput');
        if (!girdi) return null;
        var bolum = girdi.closest('div.px-3') || girdi.parentElement && girdi.parentElement.parentElement;
        var etiket = bolum && bolum.querySelector('label');
        if (!etiket) return null;
        etiket.classList.add('sg-depo-etiket');
        cip = document.createElement('button');
        cip.type = 'button';
        cip.className = 'sg-cip';
        cip.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var c = cs();
            if (c && c.currentCountingProduct) duzenleyiciAc(c.currentCountingProduct);
        });
        etiket.appendChild(cip);
        return cip;
    }

    function pencereGuncelle(pid) {
        var c = cs();
        var b = cipKur();
        if (!b || !c) return;
        var e = c.countingData && c.countingData[pid];
        var ek = e ? c._ekSayim(e) : 0;
        if (ek) {
            b.className = 'sg-cip ' + (ek > 0 ? 'sg-cip--fazla' : 'sg-cip--eksik');
            b.innerHTML = 'Önceki Sayım ' + esc(isaretli(ek));
            b.setAttribute('aria-label', 'Önceki sayım ' + isaretli(ek) + ', düzenle');
            return;
        }
        var oneri = durum.yuklendi && e ? urunOnerisi(pid, e) : null;
        if (oneri && oneri.gecerli.length && oneri.net !== 0) {
            b.className = 'sg-cip sg-cip--var';
            b.innerHTML = '<span class="sg-cip__nokta" aria-hidden="true"></span>Panelde ' + esc(isaretli(oneri.net));
            b.setAttribute('aria-label', 'Panelde bu ürünün önceki sayımı var: ' + isaretli(oneri.net) + '. Aç');
            return;
        }
        b.className = 'sg-cip';
        b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>Önceki Sayım';
        b.setAttribute('aria-label', 'Önceki sayım ekle');
        if (!durum.yuklendi) yukle().then(function () {
            var c2 = cs();
            if (c2 && c2.currentCountingProduct === pid) pencereGuncelle(pid);
        });
    }

    function guncelPencereyiTazele() {
        var c = cs();
        if (c && c.currentCountingProduct) pencereGuncelle(c.currentCountingProduct);
    }

    function duzenleyiciAc(pid) {
        var c = cs();
        if (!c || !c.countingData || !c.countingData[pid]) return;
        if (duzenleyici) katmanKapat(duzenleyici);
        var e = c.countingData[pid];
        var b = urunBilgisi(pid);
        var kg = typeof c.isKgProduct === 'function' && c.isKgProduct(pid);
        var mevcut = c._ekSayim(e);
        var sec = { yon: mevcut > 0 ? 'fazla' : 'eksik', adet: Math.abs(mevcut) || '' };
        var oneri = urunOnerisi(pid, e);

        var panelSayim = '';
        if (oneri.kayitlar.length) {
            panelSayim =
                '<h3 class="sg-bolum-baslik">Depo Panelindeki Sayımlar</h3>' +
                '<div>' + oneri.kayitlar.map(function (k) {
                    var sonra = kayitZamani(k) > oneri.sinir;
                    return kayitSatiri(k).replace('<div class="sg-kayit">', '<div class="sg-kayit"' + (sonra ? ' style="opacity:.5" title="Sistem stoğu çekildikten sonra yapılmış, hesaba katılmaz"' : '') + '>');
                }).join('') + '</div>' +
                (oneri.gecerli.length
                    ? '<div class="sg-ozet-satir"><span>Toplam <b>' + esc(isaretli(oneri.net) || '0') + '</b></span>' +
                      '<button type="button" class="sg-dugme" data-sg="kullan">Bunu Kullan</button></div>'
                    : '<p class="sg-not">Bu sayımlar sistem stoğu çekildikten sonra yapılmış; sistem stoğunu yeniden çekince hesaba katılır.</p>');
        } else {
            panelSayim = '<p class="sg-not">' + (durum.kayitlar.size
                ? 'Seçili aralıkta bu ürünün panel sayımı yok (' + esc(tarihMetni(gunBasi(oneri.aralik.bas))) + ' → ' + esc(tarihMetni(gunBasi(oneri.aralik.son))) + ').'
                : 'Panel sayımları henüz okunmadı. Tablo menüsünden "Sayım Geçmişi"ni açıp çekebilirsin.') + '</p>';
        }

        duzenleyici = katmanAc(
            '<div class="sg-ust"><div class="sg-ust__metin"><h2 class="sg-baslik">Önceki Sayım</h2>' +
            '<p class="sg-alt">' + esc(b.ad) + '</p></div>' +
            '<button type="button" class="sg-kapat" data-sg="kapat" aria-label="Kapat">' + IKON_KAPAT + '</button></div>' +
            '<div class="sg-govde">' +
                panelSayim +
                '<h3 class="sg-bolum-baslik">Önceki Sayımda</h3>' +
                '<div class="sg-ikili" role="group" aria-label="Yön">' +
                    '<button type="button" data-sg="yon" data-yon="eksik" aria-pressed="' + (sec.yon === 'eksik') + '">Eksik Çıktı</button>' +
                    '<button type="button" data-sg="yon" data-yon="fazla" aria-pressed="' + (sec.yon === 'fazla') + '">Fazla Çıktı</button>' +
                '</div>' +
                '<input type="text" class="sg-girdi sg-adet" data-sg="adet" inputmode="' + (kg ? 'decimal' : 'numeric') + '" autocomplete="off" placeholder="0" value="' + esc(sec.adet === '' ? '' : sayi(sec.adet)) + '" aria-label="Adet">' +
                '<div class="sg-hesap" data-sg="hesap"></div>' +
            '</div>' +
            '<div class="sg-alt-cubuk">' +
                (mevcut ? '<button type="button" class="sg-dugme sg-dugme--tehlike" data-sg="kaldir">Kaldır</button>' : '') +
                '<button type="button" class="sg-dugme" data-sg="kapat">Vazgeç</button>' +
                '<button type="button" class="sg-dugme sg-dugme--ana" data-sg="kaydet">Kaydet</button>' +
            '</div>',
            true
        );
        var d = duzenleyici;
        var girdi = d.querySelector('[data-sg="adet"]');

        function deger() {
            var n = c._depoDegeriOku ? c._depoDegeriOku(girdi.value, kg) : Number(String(girdi.value).replace(',', '.'));
            n = Number(n);
            if (!Number.isFinite(n) || n < 0) n = 0;
            return sec.yon === 'eksik' ? -n : n;
        }
        function hesapCiz() {
            var ek = deger();
            var raf = c._rafDegeri(e);
            var sis = e.systemStock;
            var satir = '';
            if (raf === null) {
                satir = 'Ürün henüz sayılmadı. Rafta sayınca bu değer eklenir.';
            } else {
                var toplam = Math.round((raf + ek) * 1000) / 1000;
                satir = 'Rafta <b>' + sayi(raf) + '</b> ' + (ek < 0 ? '−' : '+') + ' Önceki <b>' + sayi(Math.abs(ek)) + '</b> = Toplam <b>' + sayi(toplam) + '</b>';
                if (sis !== null && sis !== undefined && sis !== '') {
                    var fark = Math.round((toplam - Number(sis)) * 1000) / 1000;
                    satir += '<br>Sistem <b>' + sayi(sis) + '</b> · Fark <b style="color:' + (fark > 0 ? '#047857' : fark < 0 ? '#b42318' : '#667085') + '">' +
                        (fark === 0 ? 'Eşit' : isaretli(fark) + (fark > 0 ? ' Fazla' : ' Eksik')) + '</b>';
                }
            }
            d.querySelector('[data-sg="hesap"]').innerHTML = satir;
        }
        hesapCiz();
        girdi.addEventListener('input', hesapCiz);
        girdi.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') d.querySelector('[data-sg="kaydet"]').click(); });

        d.addEventListener('click', async function (ev) {
            var t = ev.target.closest('[data-sg]');
            if (!t) return;
            var ne = t.getAttribute('data-sg');
            if (ne === 'kapat') { katmanKapat(d); return; }
            if (ne === 'yon') {
                sec.yon = t.getAttribute('data-yon');
                d.querySelectorAll('[data-sg="yon"]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === t)); });
                hesapCiz();
                return;
            }
            if (ne === 'kullan') {
                sec.yon = oneri.net < 0 ? 'eksik' : 'fazla';
                d.querySelectorAll('[data-sg="yon"]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-yon') === sec.yon)); });
                girdi.value = sayi(Math.abs(oneri.net));
                hesapCiz();
                return;
            }
            if (ne === 'kaldir' || ne === 'kaydet') {
                t.disabled = true;
                try {
                    await c.setEkSayim(pid, ne === 'kaldir' ? 0 : deger());
                    katmanKapat(d);
                } catch (err) {
                    t.disabled = false;
                    c.showToast && c.showToast('Kaydedilemedi: ' + (err && err.message || 'bilinmeyen hata'), 'error', 4000);
                }
            }
        });
        setTimeout(function () { try { girdi.focus({ preventScroll: true }); } catch (x) { /* sessiz */ } }, 60);
    }

    // ------------------------------------------------------------------
    // Tablo menüsüne giriş
    // ------------------------------------------------------------------

    function menuyeEkle() {
        var menu = document.getElementById('sayimTableMenuDropdown');
        if (!menu || menu.querySelector('[data-sg-menu]')) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.setAttribute('data-sg-menu', '1');
        b.className = 'sg-menu-ogesi flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50';
        b.innerHTML = IKON_GECMIS + '<span>Sayım Geçmişi</span>';
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.classList.add('hidden');
            var dugme = document.getElementById('sayimTableMenuBtn');
            if (dugme) dugme.setAttribute('aria-expanded', 'false');
            pencereAc();
        });
        var sil = menu.querySelector('[data-sayim-menu-action="delete"]');
        menu.insertBefore(b, sil || null);
    }

    function kur() {
        menuyeEkle();
        dinleyiciKur();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kur);
    else kur();

    global.JBSayimGecmisi = {
        ac: pencereAc,
        yukle: yukle,
        pencereGuncelle: pencereGuncelle,
        urunOnerisi: urunOnerisi,
    };
})(window);
