/**
 * Modül: Fiyat Listesi
 * ============================================================================
 *
 * Verilen ürün adları için güncel fiyatları franchise panelinden toplar ve
 * JSON olarak verir.
 *
 * KAYNAK
 * `POST /stocks?limit=&offset=` uç noktası. Bu isteği panelin stok sayfası
 * zaten kendisi atıyor; biz yeni bir uç nokta uydurmuyoruz, aynı isteği
 * sayfalayarak tekrarlıyoruz. Jeton da sayfanın kendi isteklerinin
 * başlığından geliyor (`sayfa-koprusu.js`, JB_JETON). Depo kimliği koda
 * yazılmadı, `null` gönderiliyor ve sunucu jetondan çözüyor.
 * Gerekçesi: getir-guvenlik-cizgisi.
 *
 * FİYAT ALANI NEREDE
 * Yanıttaki ürün nesnesinde `price` alanı olduğunu Düşük Stok modülünden
 * biliyoruz. Toptan/alış fiyatının hangi adla geldiğini bilmiyoruz; canlı
 * yanıta bakmadan ad uydurmak yanlış olurdu. Bu yüzden modül fiyata benzeyen
 * BÜTÜN alanları toplayıp çıktıya koyuyor ve hangi adların kaç kez geçtiğini
 * ayrı bir bölümde raporluyor. İlk çalıştırmadan sonra doğru ad görülür ve
 * `ALAN_ADLARI` tablosuna yazılır.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var TEMEL = 'https://franchise-api-gateway.getirapi.com';
    var SAYFA_BOYU = 100;
    var SAYFA_ARASI_MS = 500;   // urun-cekici ile aynı hız sınırı
    var EN_COK_SAYFA = 200;

    // Fiyata benzeyen alan adları. Geniş tutuldu; eleme çıktıda yapılıyor.
    var FIYAT_DESENI = /(price|cost|fiyat|tutar|amount|vat|kdv|margin|profit|kar)/i;

    // Anlamı bilinen alanlar. Yenisi öğrenildikçe buraya eklenecek.
    var ALAN_ADLARI = {
        price: 'satisFiyati',
        priceText: 'satisFiyatiYazi'
    };

    var jeton = null;
    var panel = null;
    var calisiyor = false;

    // ==================================================================
    // Jeton
    // ==================================================================

    function jetonDinle() {
        global.addEventListener('message', function (e) {
            if (e.source !== global) return;
            if (e.origin !== location.origin) return;
            var v = e.data;
            if (!v || v.type !== 'JB_JETON' || !v.jeton) return;
            jeton = v.jeton;
            durumTazele();
        });
    }

    // ==================================================================
    // Metin eşleme (Türkçe)
    // ==================================================================

    var HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c' };

    function sade(metin) {
        return String(metin == null ? '' : metin)
            .toLocaleLowerCase('tr')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[ığüşöçâîû]/g, function (m) { return HARF[m] || m; })
            .replace(/(\d)[.,](\d)/g, '$1$2')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ==================================================================
    // Yanıt ayıklama
    // ==================================================================

    function satirlariAyikla(veri) {
        if (Array.isArray(veri)) return veri;
        if (!veri || typeof veri !== 'object') return [];
        var d = veri.data;
        if (Array.isArray(d)) return d;
        if (d && Array.isArray(d.data)) return d.data;
        if (d && Array.isArray(d.items)) return d.items;
        return [];
    }

    function coklu(deger) {
        if (deger == null) return '';
        if (typeof deger === 'string') return deger;
        if (typeof deger === 'object') return deger.tr || deger.en || '';
        return String(deger);
    }

    function urunAdi(u) {
        return coklu(u.fullName) || coklu(u.shortName) || coklu(u.name) || '';
    }

    function barkod(u) {
        try {
            var p = u.packagingInfo && u.packagingInfo['1'];
            if (p && p.barcodes && p.barcodes[0]) return String(p.barcodes[0]);
        } catch (e) { /* sessiz */ }
        if (Array.isArray(u.barcodes) && u.barcodes[0]) {
            var b = u.barcodes[0];
            return String(b && b.code ? b.code : b);
        }
        return '';
    }

    /**
     * Nesnenin içinde fiyata benzeyen ne varsa toplar. İki kademe iniyor;
     * daha derine inmek yanıtın tamamını gezmek demek olurdu.
     */
    function fiyatAlanlari(nesne, onek, torba, sayac) {
        if (!nesne || typeof nesne !== 'object') return;
        Object.keys(nesne).forEach(function (k) {
            var v = nesne[k];
            var ad = onek ? onek + '.' + k : k;
            if (v && typeof v === 'object' && !Array.isArray(v) && !onek) {
                // Yalnız fiyat kokan alt nesnelere iniyoruz.
                if (FIYAT_DESENI.test(k)) fiyatAlanlari(v, ad, torba, sayac);
                return;
            }
            if (!FIYAT_DESENI.test(k)) return;
            if (typeof v !== 'number' && typeof v !== 'string') return;
            if (typeof v === 'string' && !v) return;
            torba[ad] = v;
            sayac[ad] = (sayac[ad] || 0) + 1;
        });
    }

    // ==================================================================
    // Çekme
    // ==================================================================

    function sayfaCek(offset) {
        return fetch(TEMEL + '/stocks?limit=' + SAYFA_BOYU + '&offset=' + offset, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'Authorization': jeton
            },
            credentials: 'include',
            body: JSON.stringify({ warehouseIds: [null], sort: { available: 1 } })
        }).then(function (y) {
            if (y.status === 401 || y.status === 403) {
                throw new Error('Jeton geçersiz. Franchise sayfasını yenile.');
            }
            if (!y.ok) throw new Error('Sunucu ' + y.status + ' döndü.');
            return y.json();
        });
    }

    function bekle(ms) {
        return new Promise(function (c) { setTimeout(c, ms); });
    }

    function hepsiniCek(ilerle) {
        var satirlar = [];
        var offset = 0;
        var sayfa = 0;

        function tur() {
            return sayfaCek(offset).then(function (veri) {
                var parca = satirlariAyikla(veri);
                if (!parca.length) return satirlar;
                satirlar = satirlar.concat(parca);
                sayfa++;
                ilerle(sayfa, satirlar.length);
                if (parca.length < SAYFA_BOYU || sayfa >= EN_COK_SAYFA) return satirlar;
                offset += SAYFA_BOYU;
                return bekle(SAYFA_ARASI_MS).then(tur);
            });
        }

        return tur();
    }

    // ==================================================================
    // Derleme
    // ==================================================================

    function derle(satirlar, istenenler) {
        var sayac = {};
        var kayitlar = [];

        satirlar.forEach(function (satir) {
            var u = satir && satir.product;
            if (u && typeof u === 'string') u = null;
            if (!u) u = satir;
            if (!u || typeof u !== 'object') return;

            var torba = {};
            fiyatAlanlari(u, '', torba, sayac);
            fiyatAlanlari(satir, 'stok', torba, sayac);

            var kayit = {
                ad: urunAdi(u),
                barkod: barkod(u),
                stok: (satir.productStock && typeof satir.productStock.available === 'number')
                    ? satir.productStock.available
                    : (typeof satir.available === 'number' ? satir.available : null),
                fiyatlar: torba
            };
            Object.keys(ALAN_ADLARI).forEach(function (k) {
                if (torba[k] != null) kayit[ALAN_ADLARI[k]] = torba[k];
            });
            if (kayit.ad) kayitlar.push(kayit);
        });

        if (!istenenler.length) {
            return { urunler: kayitlar, bulunamayan: [], alanSayaci: sayac };
        }

        var dizin = new Map();
        kayitlar.forEach(function (k) {
            var a = sade(k.ad);
            if (!dizin.has(a)) dizin.set(a, k);
        });

        var sonuc = [];
        var bulunamayan = [];
        istenenler.forEach(function (ad) {
            var a = sade(ad);
            var k = dizin.get(a);
            if (!k) {
                // Tam eşleşme yoksa adı içeren tek kayıt varsa onu al.
                var adaylar = kayitlar.filter(function (x) { return sade(x.ad).indexOf(a) !== -1; });
                if (adaylar.length === 1) k = adaylar[0];
            }
            if (k) sonuc.push(Object.assign({ istenen: ad }, k));
            else bulunamayan.push(ad);
        });

        return { urunler: sonuc, bulunamayan: bulunamayan, alanSayaci: sayac };
    }

    // ==================================================================
    // Panel
    // ==================================================================

    function stilEkle(kok) {
        if (kok.querySelector('#jbaFiyatStil')) return;
        var s = document.createElement('style');
        s.id = 'jbaFiyatStil';
        s.textContent = [
            '.fyt{position:fixed;right:18px;bottom:18px;width:380px;max-width:calc(100vw - 36px);',
            'background:#131720;color:#f2f4f8;border-radius:14px;padding:16px;z-index:2147483000;',
            'box-shadow:0 18px 48px rgba(0,0,0,.42);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
            '.fyt h4{margin:0 0 4px;font-size:15px;font-weight:600}',
            '.fyt p{margin:0 0 10px;color:#9aa3b2;font-size:12px}',
            '.fyt textarea{width:100%;height:120px;box-sizing:border-box;background:#0c0f16;color:#f2f4f8;',
            'border:1px solid #29313f;border-radius:9px;padding:9px;font:12px/1.45 inherit;resize:vertical}',
            '.fyt__satir{display:flex;gap:8px;margin-top:10px}',
            '.fyt button{flex:1;border:0;border-radius:9px;padding:9px 10px;font:600 13px inherit;cursor:pointer}',
            '.fyt__ana{background:#135bec;color:#fff}',
            '.fyt__yan{background:#232b38;color:#cdd4e0}',
            '.fyt button[disabled]{opacity:.45;cursor:default}',
            '.fyt__durum{margin-top:10px;min-height:18px;font-size:12px;color:#9aa3b2}',
            '.fyt__kapat{position:absolute;top:10px;right:12px;background:none;color:#7b8798;font-size:18px;',
            'line-height:1;padding:0;width:22px;flex:none}'
        ].join('');
        kok.appendChild(s);
    }

    function durumTazele() {
        if (!panel) return;
        var d = panel.querySelector('.fyt__durum');
        var b = panel.querySelector('.fyt__ana');
        if (calisiyor) return;
        if (jeton) {
            d.textContent = 'Jeton hazır.';
            b.disabled = false;
        } else {
            d.textContent = 'Jeton bekleniyor. Sayfayı yenile ya da stok sayfasında gezin.';
            b.disabled = true;
        }
    }

    function panelAc() {
        var kok = JBA.golgeKok();
        stilEkle(kok);
        if (panel) { panel.remove(); panel = null; }

        panel = document.createElement('div');
        panel.className = 'fyt';
        panel.innerHTML =
            '<button type="button" class="fyt__kapat" title="Kapat">×</button>' +
            '<h4>Fiyat Listesi</h4>' +
            '<p>Ürün adlarını alt alta ya da virgülle yapıştır. Boş bırakırsan depodaki bütün ürünler gelir.</p>' +
            '<textarea class="fyt__giris" placeholder="Cheetos Shots ... (25 g)&#10;Erikli Doğal Kaynak Suyu (6 x 1 L)"></textarea>' +
            '<div class="fyt__satir">' +
            '<button type="button" class="fyt__ana">Fiyatları çek</button>' +
            '<button type="button" class="fyt__yan fyt__kopya" disabled>JSON kopyala</button>' +
            '<button type="button" class="fyt__yan fyt__indir" disabled>İndir</button>' +
            '</div>' +
            '<div class="fyt__durum"></div>';

        panel.querySelector('.fyt__kapat').addEventListener('click', function () {
            panel.remove();
            panel = null;
        });
        panel.querySelector('.fyt__ana').addEventListener('click', basla);
        kok.appendChild(panel);
        durumTazele();
    }

    var sonJson = '';

    function basla() {
        if (calisiyor || !jeton || !panel) return;
        calisiyor = true;

        var d = panel.querySelector('.fyt__durum');
        var ana = panel.querySelector('.fyt__ana');
        var kopya = panel.querySelector('.fyt__kopya');
        var indir = panel.querySelector('.fyt__indir');
        ana.disabled = true;
        kopya.disabled = true;
        indir.disabled = true;

        var ham = panel.querySelector('.fyt__giris').value;
        var istenenler = ham.split(/[\n,]+/)
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length > 1; });

        d.textContent = 'Stoklar çekiliyor…';

        hepsiniCek(function (sayfa, adet) {
            d.textContent = sayfa + '. sayfa alındı, ' + adet + ' kayıt.';
        }).then(function (satirlar) {
            var c = derle(satirlar, istenenler);
            var cikti = {
                olusturma: new Date().toISOString(),
                istenenAdet: istenenler.length,
                bulunanAdet: c.urunler.length,
                bulunamayan: c.bulunamayan,
                fiyatAlaniSayaci: c.alanSayaci,
                urunler: c.urunler
            };
            sonJson = JSON.stringify(cikti, null, 2);

            var eksik = c.bulunamayan.length ? ', ' + c.bulunamayan.length + ' tanesi bulunamadı' : '';
            d.textContent = c.urunler.length + ' ürün hazır' + eksik + '. Alanlar: ' +
                Object.keys(c.alanSayaci).join(', ');
            kopya.disabled = false;
            indir.disabled = false;
        }).catch(function (e) {
            d.textContent = 'Hata: ' + (e && e.message ? e.message : e);
        }).then(function () {
            calisiyor = false;
            ana.disabled = false;
        });

        kopya.onclick = function () {
            JBA.panoyaYaz(sonJson).then(function () { JBA.bildir('JSON panoya alındı.', 'olumlu'); });
        };
        indir.onclick = function () {
            var b = new Blob([sonJson], { type: 'application/json' });
            var u = URL.createObjectURL(b);
            var a = document.createElement('a');
            a.href = u;
            a.download = 'fiyatlar-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
        };
    }

    // ==================================================================

    var kuruldu = false;

    JBA.kayit({
        kimlik: 'fiyatListesi',
        ad: 'Fiyat Listesi',
        ozet: 'Verilen ürünlerin güncel fiyatlarını JSON olarak çıkarır.',
        hostlar: ['franchise.getir.com'],

        baslat: function () {
            if (kuruldu) return;
            kuruldu = true;
            jetonDinle();
        },

        eylemler: [
            { ad: 'Fiyatları çek', calistir: function () { panelAc(); } }
        ],

        durdur: function () {
            if (panel) { panel.remove(); panel = null; }
        }
    });
})(window);
