/**
 * Herkese açık Döngü raporu (dongu/index.html)
 * ============================================================================
 *
 * Adres: jetbarkod.com.tr/dongu/#<anahtar>
 * Giriş gerekmez. Sayfa yalnız `dongu_rapor(anahtar)` işlevini çağırır; işlev
 * anahtarı bilinen tek raporun özetini döndürür. Tabloya, başka kullanıcıya ya
 * da hesap bilgisine erişim yok.
 *
 * Güvenlik: veri hiçbir yerde HTML olarak basılmaz (yalnız textContent).
 * Görsel adresi yalnız ürün görseli CDN'inden kabul edilir. Sayfanın içerik
 * güvenlik politikası dış betiği ve satır içi kodu zaten engelliyor.
 * ============================================================================
 */
(function () {
    'use strict';

    var API = 'https://api.flowcobalt.com/rest/v1/rpc/dongu_rapor';
    var ANAHTAR = /^[A-Za-z0-9_-]{22,64}$/;
    var GORSEL = /^https:\/\/cdn-image\.getir\.com\/[A-Za-z0-9/_.,%=?&-]{1,300}$/;
    var YENILEME_MS = 60000;
    var CEVRE = 2 * Math.PI * 31;

    var durum = { veri: null, sekme: 'kalan', arama: '', yukleniyor: false };

    function $(id) { return document.getElementById(id); }

    function el(etiket, sinif, metin) {
        var e = document.createElement(etiket);
        if (sinif) e.className = sinif;
        if (metin !== undefined && metin !== null) e.textContent = String(metin);
        return e;
    }

    function anahtarBul() {
        var h = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
        if (ANAHTAR.test(h)) return h;
        var q = new URLSearchParams(location.search).get('k');
        if (q && ANAHTAR.test(q)) return q;
        var p = location.pathname.split('/').filter(Boolean);
        var son = p[p.length - 1];
        return son && ANAHTAR.test(son) ? son : null;
    }

    function sayi(n) { return Number(n || 0).toLocaleString('tr-TR'); }

    function tarih(ms) {
        var d = new Date(ms);
        if (isNaN(d.getTime())) return '';
        return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
    }
    function saat(ms) {
        var d = new Date(ms);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    function goreli(ms) {
        var dk = Math.round((Date.now() - ms) / 60000);
        if (dk < 1) return 'az önce';
        if (dk < 60) return dk + ' dakika önce';
        var sa = Math.round(dk / 60);
        if (sa < 24) return sa + ' saat önce';
        var g = Math.round(sa / 24);
        return g === 1 ? 'dün' : g + ' gün önce';
    }

    function durumGoster(baslik, metin, tekrar) {
        $('rapor').hidden = true;
        $('durum').hidden = false;
        $('durumBaslik').textContent = baslik;
        $('durumMetin').textContent = metin;
        $('tekrar').hidden = !tekrar;
        document.title = baslik + ' · Jet Barkod';
    }

    function iskelet() {
        var l = $('liste');
        l.textContent = '';
        for (var i = 0; i < 6; i++) {
            var s = el('li', 'dr-iskelet-satir');
            s.appendChild(el('span', 'dr-iskelet'));
            s.appendChild(el('span', 'dr-iskelet dr-iskelet--genis'));
            l.appendChild(s);
        }
    }

    // ------------------------------------------------------------------
    // Veri
    // ------------------------------------------------------------------

    var KODLAR = { guncel: 1, yaklasiyor: 1, suruyor: 1, gecikti: 1, yok: 1, pasif: 1 };

    /** Sunucudan geleni doğrula; beklenmeyen alanlar atılır */
    function temizle(ham) {
        if (!ham || typeof ham !== 'object' || !ham.ozet || typeof ham.ozet !== 'object') return null;
        var o = ham.ozet;
        var kategoriler = Array.isArray(o.kategoriler) ? o.kategoriler.slice(0, 400) : [];
        return {
            baslik: typeof ham.baslik === 'string' ? ham.baslik.slice(0, 80) : '',
            guncellendi: Date.parse(ham.guncellendi_at || '') || null,
            sure: Math.max(1, Math.min(365, parseInt(o.sure, 10) || 30)),
            urunSayilan: Math.max(0, Number(o.urunSayilan) || 0),
            urunToplam: Math.max(0, Number(o.urunToplam) || 0),
            kategoriler: kategoriler.map(function (k) {
                if (!k || typeof k !== 'object') return null;
                var kod = KODLAR[k.kod] ? k.kod : 'yok';
                return {
                    ad: String(k.ad || '').slice(0, 80),
                    ust: String(k.ust || '').slice(0, 80),
                    kod: kod,
                    oran: Math.max(0, Math.min(1, Number(k.oran) || 0)),
                    sayilan: Math.max(0, Number(k.sayilan) || 0),
                    toplam: Math.max(0, Number(k.toplam) || 0),
                    son: Number(k.son) || null,
                    gorsel: GORSEL.test(String(k.gorsel || '')) ? k.gorsel : '',
                };
            }).filter(function (k) { return k && k.ad; }),
        };
    }

    async function getir(anahtar, sessiz) {
        if (durum.yukleniyor) return;
        durum.yukleniyor = true;
        var kesici = new AbortController();
        var zaman = setTimeout(function () { kesici.abort(); }, 15000);
        try {
            var r = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ anahtar: anahtar }),
                signal: kesici.signal,
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
            if (!r.ok) throw new Error('durum ' + r.status);
            var ham = await r.json();
            var v = temizle(ham);
            if (!v) {
                durumGoster('Rapor Bulunamadı', 'Bu bağlantı kapatılmış ya da hiç oluşturulmamış. Raporu paylaşan kişiden yeni bağlantı isteyebilirsin.', false);
                return;
            }
            durum.veri = v;
            $('durum').hidden = true;
            $('rapor').hidden = false;
            ciz();
        } catch (e) {
            if (!sessiz || !durum.veri) {
                durumGoster('Rapor Açılamadı', 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.', true);
            }
        } finally {
            clearTimeout(zaman);
            durum.yukleniyor = false;
            $('rapor').setAttribute('aria-busy', 'false');
        }
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------

    function sayilanMi(k) { return k.kod === 'guncel' || k.kod === 'yaklasiyor'; }

    function ciz() {
        var v = durum.veri;
        var baslik = v.baslik || 'Döngü Raporu';
        $('baslik').textContent = baslik;
        document.title = baslik + ' · Jet Barkod';
        $('guncel').textContent = v.guncellendi
            ? 'Son güncelleme ' + tarih(v.guncellendi) + ' ' + saat(v.guncellendi) + ' · ' + goreli(v.guncellendi)
            : '';

        var aktif = v.kategoriler.filter(function (k) { return k.kod !== 'pasif'; });
        var sayilan = aktif.filter(sayilanMi).length;
        var suruyor = aktif.filter(function (k) { return k.kod === 'suruyor'; }).length;
        var kalan = aktif.length - sayilan;
        var oran = aktif.length ? sayilan / aktif.length : 0;

        $('yuzde').textContent = '%' + Math.round(oran * 100);
        requestAnimationFrame(function () {
            $('halka').style.strokeDasharray = (oran * CEVRE).toFixed(1) + ' ' + CEVRE.toFixed(1);
        });
        var satir = $('kategoriSatiri');
        satir.textContent = '';
        var g = el('strong', null, sayi(sayilan));
        satir.appendChild(g);
        satir.appendChild(document.createTextNode(' / ' + sayi(aktif.length) + ' Alt Kategori Sayıldı'));
        $('sureSatiri').textContent = 'Her alt kategori ' + v.sure + ' günde bir sayılır';

        var uOran = v.urunToplam ? Math.min(1, v.urunSayilan / v.urunToplam) : 0;
        $('urunSatiri').textContent = v.urunToplam
            ? sayi(v.urunSayilan) + ' / ' + sayi(v.urunToplam) + ' Ürün Sayıldı'
            : 'Ürün bilgisi yok';
        $('urunYuzde').textContent = v.urunToplam ? '%' + Math.round(uOran * 100) : '';
        requestAnimationFrame(function () { $('urunCubuk').style.transform = 'scaleX(' + uOran.toFixed(4) + ')'; });

        var kpi = $('kpi');
        kpi.textContent = '';
        [['Sayıldı', sayilan, 'yesil'], ['Sürüyor', suruyor, 'mavi'], ['Kalan', kalan, '']].forEach(function (x) {
            var k = el('div', 'dr-kpi__kutu' + (x[2] ? ' dr-kpi__kutu--' + x[2] : ''));
            k.appendChild(el('div', 'dr-kpi__ad', x[0]));
            k.appendChild(el('div', 'dr-kpi__deger', sayi(x[1])));
            kpi.appendChild(k);
        });

        var sekmeSayi = { kalan: kalan, sayilan: sayilan, tumu: aktif.length };
        Array.prototype.forEach.call($('sekmeler').querySelectorAll('button'), function (b) {
            var ad = b.getAttribute('data-sekme');
            b.setAttribute('aria-selected', String(ad === durum.sekme));
            var eski = b.querySelector('.dr-sekme__sayi');
            if (eski) eski.remove();
            b.appendChild(el('span', 'dr-sekme__sayi', sayi(sekmeSayi[ad])));
        });

        var pasif = v.kategoriler.length - aktif.length;
        $('pasif').hidden = !pasif;
        $('pasif').textContent = pasif ? sayi(pasif) + ' alt kategori pasif (stokta ürün yok); hesaba katılmıyor.' : '';

        listeCiz(aktif);
    }

    var SIRA = { suruyor: 0, gecikti: 1, yok: 2, yaklasiyor: 3, guncel: 4 };

    function listeCiz(aktif) {
        var ara = durum.arama.trim().toLocaleLowerCase('tr');
        var liste = aktif.filter(function (k) {
            if (durum.sekme === 'kalan' && sayilanMi(k)) return false;
            if (durum.sekme === 'sayilan' && !sayilanMi(k)) return false;
            if (ara && (k.ad + ' ' + k.ust).toLocaleLowerCase('tr').indexOf(ara) === -1) return false;
            return true;
        });
        liste.sort(function (a, b) {
            if (durum.sekme === 'sayilan') return (b.son || 0) - (a.son || 0);
            return (SIRA[a.kod] - SIRA[b.kod]) || (b.oran - a.oran) || a.ad.localeCompare(b.ad, 'tr');
        });

        var l = $('liste');
        l.textContent = '';
        if (!liste.length) {
            l.appendChild(el('li', 'dr-bos', ara
                ? 'Aramaya uyan alt kategori yok.'
                : durum.sekme === 'kalan' ? 'Bütün alt kategoriler sayıldı.' : 'Henüz sayılan alt kategori yok.'));
            return;
        }
        var parca = document.createDocumentFragment();
        liste.forEach(function (k) { parca.appendChild(satirYap(k)); });
        l.appendChild(parca);
    }

    function satirYap(k) {
        var li = el('li', 'dr-satir');
        if (k.gorsel) {
            var img = el('img', 'dr-satir__gorsel');
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.src = k.gorsel;
            img.addEventListener('error', function () { img.removeAttribute('src'); });
            li.appendChild(img);
        } else {
            li.appendChild(el('span', 'dr-satir__gorsel'));
        }
        var metin = el('div', 'dr-satir__metin');
        metin.appendChild(el('div', 'dr-satir__ad', k.ad));
        var alt = [];
        if (k.ust) alt.push(k.ust);
        if (k.kod === 'suruyor' && k.toplam) alt.push(sayi(k.sayilan) + ' / ' + sayi(k.toplam) + ' ürün');
        else if (k.son) alt.push('Son sayım ' + tarih(k.son));
        else alt.push('Hiç sayılmadı');
        metin.appendChild(el('div', 'dr-satir__alt', alt.join(' · ')));
        if (k.kod === 'suruyor') {
            var c = el('div', 'dr-satir__cubuk');
            var s = el('span');
            s.style.transform = 'scaleX(' + k.oran.toFixed(3) + ')';
            c.appendChild(s);
            metin.appendChild(c);
        }
        li.appendChild(metin);

        var hap;
        if (sayilanMi(k)) hap = el('span', 'dr-hap dr-hap--guncel', 'Sayıldı');
        else if (k.kod === 'suruyor') hap = el('span', 'dr-hap dr-hap--suruyor', '%' + Math.round(k.oran * 100));
        else if (k.kod === 'gecikti') hap = el('span', 'dr-hap dr-hap--gecikti', 'Süresi Doldu');
        else hap = el('span', 'dr-hap dr-hap--yok', 'Sayılmadı');
        li.appendChild(hap);
        return li;
    }

    // ------------------------------------------------------------------
    // Başlangıç
    // ------------------------------------------------------------------

    function basla() {
        var anahtar = anahtarBul();
        if (!anahtar) {
            durumGoster('Bağlantı Geçersiz', 'Adres eksik ya da bozuk. Raporu paylaşan kişiden bağlantıyı yeniden isteyebilirsin.', false);
            return;
        }
        $('sekmeler').addEventListener('click', function (e) {
            var b = e.target.closest('button[data-sekme]');
            if (!b || !durum.veri) return;
            durum.sekme = b.getAttribute('data-sekme');
            ciz();
        });
        $('ara').addEventListener('input', function (e) {
            durum.arama = e.target.value;
            if (durum.veri) listeCiz(durum.veri.kategoriler.filter(function (k) { return k.kod !== 'pasif'; }));
        });
        $('tekrar').addEventListener('click', function () { getir(anahtar, false); });
        iskelet();
        getir(anahtar, false);
        // Açık duran rapor arada tazelenir; sekme arkadayken istek yok
        setInterval(function () {
            if (document.visibilityState === 'visible') getir(anahtar, true);
        }, YENILEME_MS);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && durum.veri) getir(anahtar, true);
        });
    }

    basla();
})();
