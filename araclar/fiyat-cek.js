/**
 * Fiyat Çek — konsol aracı (Jet Barkod sayım sayfası)
 * ============================================================================
 *
 * Ürün adlarının TOPTAN fiyatını toplar. Çıktı iki sütun: ad ve toptan fiyat.
 *
 * NASIL KULLANILIR
 *   1. https://jetbarkod.com.tr/sayim/ aç, giriş yapmış ol.
 *      Franchise sekmesi de açık olsun; jeton oradan geliyor.
 *   2. F12 -> Console. "allow pasting" yaz, dosyanın tamamını yapıştır.
 *   3. Yaz:  JBFiyat.ac()
 *      Sayfada bir panel açılır. Ürün adlarını oraya yapıştır, Başlat'a bas.
 *      Sonuç aynı panelde çıkar, Kopyala düğmesi de orada.
 *
 * NEDEN PANEL
 * Önce liste konsola argüman olarak yazılıyordu; ürün adlarındaki kesme
 * işareti ("Nuh'un", "Lay's", "(15'li)") tırnaklı diziyi kapatıyor ve konsol
 * sözdizimi hatası veriyordu. Sonra panodan okumaya geçildi; `readText()`
 * kullanıcı hareketi istiyor, konsoldan çağrılınca izin çıkmıyor ve araç
 * sessizce boş dönüyordu. Metin kutusu ikisini de çözüyor: yapıştırma
 * tarayıcının kendi işi, izin gerekmiyor.
 *
 * NE YAPIYOR
 * Sayım sayfasının zaten attığı isteği atıyor: `POST /stocks`, gövdede yalnız
 * o ürünün kimliği. Ürün başına tek istek, aralarında 1,5 saniye. Jeton ve
 * depo kimliği `countingSystem._resolveApiInfoForDebug()` üzerinden geliyor,
 * ikisi de koda yazılmıyor. Depo kimliği okunamazsa hiç istek atmıyor; o
 * değer depodan depoya değişiyor.
 *
 * Başlamadan önce tek ürünle deneme isteği gidiyor. Tutmazsa sunucunun
 * döndüğü kod yazılıp duruluyor, kalan istekler atılmıyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    // ==================================================================
    // Metin
    // ==================================================================

    var HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c' };

    function sade(metin) {
        return String(metin == null ? '' : metin)
            .toLocaleLowerCase('tr')
            .normalize('NFD')
            // birleşen işaretler; kaçış dizisiyle, konsola yapıştırınca bozulmasın
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[ığüşöçâîû]/g, function (m) { return HARF[m] || m; })
            .replace(/(\d)[.,](\d)/g, '$1$2')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* Ondalık virgül geçici imle korunuyor; yoksa ad "(15 L)" olup katalogda
       hiçbir şeye eşleşmiyor. */
    var IM = '\u0001';

    function adlariAyikla(metin) {
        var parcalar = [];
        String(metin == null ? '' : metin).split(/[\r\n]+/).forEach(function (satir) {
            satir.replace(/(\d),(\d)/g, '$1' + IM + '$2')
                 .split(',')
                 .forEach(function (p) { parcalar.push(p.split(IM).join(',')); });
        });
        return parcalar.map(function (p) { return p.trim(); })
                       .filter(function (p) { return p.length >= 3; });
    }

    function bekle(ms) {
        return new Promise(function (c) { setTimeout(c, ms); });
    }

    // ==================================================================
    // Katalog
    // ==================================================================

    function sistem() { return global.countingSystem || null; }

    function katalogListesi() {
        var s = sistem();
        if (s && Array.isArray(s.allProducts) && s.allProducts.length) return s.allProducts;
        if (global.PRODUCTS_DATA && Array.isArray(global.PRODUCTS_DATA.products)) {
            return global.PRODUCTS_DATA.products;
        }
        return [];
    }

    function adiCoz(ad, liste) {
        var a = sade(ad);
        if (!a) return null;
        for (var i = 0; i < liste.length; i++) {
            if (liste[i] && liste[i].name && sade(liste[i].name) === a) return liste[i];
        }
        var adaylar = liste.filter(function (p) {
            return p && p.name && sade(p.name).indexOf(a) !== -1;
        });
        return adaylar.length === 1 ? adaylar[0] : null;
    }

    function barkodBul(urun) {
        if (!urun || !Array.isArray(urun.barcodes)) return '';
        for (var i = 0; i < urun.barcodes.length; i++) {
            var b = urun.barcodes[i];
            if (b && b.code) return String(b.code).trim();
        }
        return '';
    }

    // ==================================================================
    // İstek
    // ==================================================================

    var apiBilgi = null;

    /**
     * Depo kimliğini Jet Barkod'un kendi belleğinde arar. Sayım sistemi bu
     * değeri birkaç yere yazıyor; hangisi doluysa o kullanılıyor.
     */
    function depoKimligiAra() {
        var s = sistem();
        var adaylar = [];
        try { if (s && s.countingData && s.countingData._api_info) adaylar.push(s.countingData._api_info); } catch (e) {}
        try { if (s && s.cachedFullData && s.cachedFullData._api_info) adaylar.push(s.cachedFullData._api_info); } catch (e) {}
        try {
            var ham = localStorage.getItem('getir_api_info');
            if (ham) adaylar.push(JSON.parse(ham));
        } catch (e) {}
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (!k || k.toLowerCase().indexOf('api_info') === -1) continue;
                var v = localStorage.getItem(k);
                if (v && v.charAt(0) === '{') adaylar.push(JSON.parse(v));
            }
        } catch (e) {}

        for (var j = 0; j < adaylar.length; j++) {
            var a = adaylar[j];
            if (a && a.warehouseId) return String(a.warehouseId);
        }
        return null;
    }

    function jetonHazirla(t) {
        var j = String(t || '').trim();
        return j.indexOf('Bearer ') === 0 ? j : 'Bearer ' + j;
    }

    /**
     * Tek ürünün stok satırını çeker. Sayım sayfasındaki isteğin aynısı; fark,
     * hataları yutmaması. `_fetchApiProductRowByProductId` her hatada sessizce
     * null dönüyor, o yüzden neyin ters gittiği hiç görünmüyordu.
     */
    /**
     * Depo kimliği elimizde yoksa gövdeye hiç konmuyor; sunucu jetondan
     * çözüyor ve yanıttaki `warehouse` alanından kimliği öğreniyoruz.
     * Koda sabit kimlik yazmak yok: o değer depodan depoya değişiyor ve
     * yanlışı başkasının deposunu sormak demek.
     */
    function istekGovdesi(urunId) {
        var g = { productIds: [String(urunId)], sort: { available: 1 } };
        if (apiBilgi.warehouseId) g.warehouseIds = [apiBilgi.warehouseId];
        return g;
    }

    /** Yanıttaki satırdan depo kimliğini öğrenir ve saklar. */
    function depoyuOgren(satir) {
        if (apiBilgi.warehouseId || !satir) return;
        var w = satir.warehouse || (satir.productStock && satir.productStock.warehouse);
        if (w && typeof w === 'object') w = w._id || w.id;
        if (w) {
            apiBilgi.warehouseId = String(w);
            console.log('[Fiyat] Depo kimliği yanıttan öğrenildi.');
        }
    }

    function satirCek(urunId, barkod) {
        var uc = apiBilgi.stockEndpoint || 'https://franchise-api-gateway.getirapi.com/stocks';
        return fetch(uc + '?limit=100&offset=0', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': jetonHazirla(apiBilgi.token),
                'Accept': '*/*'
            },
            body: JSON.stringify(istekGovdesi(urunId))
        }).then(function (y) {
            return y.text().then(function (metin) {
                if (!y.ok) {
                    var e = new Error('sunucu ' + y.status + ' — ' + metin.slice(0, 160));
                    e.durum = y.status;
                    throw e;
                }
                var veri;
                try { veri = JSON.parse(metin); }
                catch (x) { throw new Error('yanıt JSON değil: ' + metin.slice(0, 160)); }

                var satirlar = (veri && Array.isArray(veri.data)) ? veri.data : [];
                if (!satirlar.length) return null;

                var secili = null;
                if (barkod) {
                    for (var i = 0; i < satirlar.length && !secili; i++) {
                        var p = satirlar[i].packagingInfo;
                        if (!p) continue;
                        for (var k in p) {
                            if (p[k] && p[k].barcodes && p[k].barcodes.indexOf(barkod) !== -1) {
                                secili = satirlar[i];
                                break;
                            }
                        }
                    }
                }
                if (!secili) secili = satirlar[0];
                depoyuOgren(secili);
                return secili;
            });
        });
    }

    function paraYaz(sayi) {
        if (typeof sayi !== 'number' || !isFinite(sayi)) return null;
        try {
            return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(sayi);
        } catch (e) { return String(sayi); }
    }

    /** Toptan fiyat satırda ya da içindeki product nesnesinde olabiliyor. */
    function toptanFiyat(satir) {
        if (!satir || typeof satir !== 'object') return { yazi: null, sayi: null };
        var kaynaklar = [satir, satir.product];
        for (var i = 0; i < kaynaklar.length; i++) {
            var k = kaynaklar[i];
            if (!k || typeof k !== 'object') continue;
            if (k.wholesalePriceText) {
                return { yazi: String(k.wholesalePriceText),
                         sayi: (typeof k.wholesalePrice === 'number' ? k.wholesalePrice : null) };
            }
            if (typeof k.wholesalePrice === 'number') {
                return { yazi: paraYaz(k.wholesalePrice), sayi: k.wholesalePrice };
            }
        }
        return { yazi: null, sayi: null };
    }

    // ==================================================================
    // Panel
    // ==================================================================

    var panel = null;
    var oge = {};

    function stilVer(e, s) { Object.keys(s).forEach(function (k) { e.style[k] = s[k]; }); return e; }

    function yap(etiket, stil, metin) {
        var e = document.createElement(etiket);
        if (stil) stilVer(e, stil);
        if (metin != null) e.textContent = metin;
        return e;
    }

    function panelAc() {
        if (panel) { panel.remove(); panel = null; }

        panel = yap('div', {
            position: 'fixed', right: '20px', bottom: '20px', width: '440px',
            maxWidth: 'calc(100vw - 40px)', maxHeight: 'calc(100vh - 40px)',
            display: 'flex', flexDirection: 'column',
            background: '#131720', color: '#f2f4f8', borderRadius: '14px',
            padding: '16px', zIndex: '2147483000', boxShadow: '0 18px 48px rgba(0,0,0,.45)',
            font: '13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
        });

        var ust = yap('div', { display: 'flex', alignItems: 'center', marginBottom: '4px' });
        ust.appendChild(yap('strong', { fontSize: '15px', flex: '1' }, 'Toptan Fiyat Çek'));
        var kapat = yap('button', {
            background: 'none', border: '0', color: '#7b8798', fontSize: '20px',
            lineHeight: '1', cursor: 'pointer', padding: '0 2px'
        }, '×');
        kapat.onclick = function () { panel.remove(); panel = null; };
        ust.appendChild(kapat);
        panel.appendChild(ust);

        panel.appendChild(yap('p', { margin: '0 0 10px', color: '#9aa3b2', fontSize: '12px' },
            'Ürün adlarını buraya yapıştır. Virgülle ya da alt alta, ikisi de olur.'));

        oge.giris = yap('textarea', {
            width: '100%', height: '110px', boxSizing: 'border-box', background: '#0c0f16',
            color: '#f2f4f8', border: '1px solid #29313f', borderRadius: '9px', padding: '9px',
            font: '12px/1.45 inherit', resize: 'vertical'
        });
        oge.giris.placeholder = 'Magnum Badem (100 ml), Kiraz Paket (500 g), …';
        panel.appendChild(oge.giris);

        var satir = yap('div', { display: 'flex', gap: '8px', marginTop: '10px' });
        oge.baslat = yap('button', {
            flex: '1', border: '0', borderRadius: '9px', padding: '9px 10px',
            font: '600 13px inherit', cursor: 'pointer', background: '#135bec', color: '#fff'
        }, 'Başlat');
        oge.kopyala = yap('button', {
            flex: '1', border: '0', borderRadius: '9px', padding: '9px 10px',
            font: '600 13px inherit', cursor: 'pointer', background: '#232b38', color: '#cdd4e0',
            opacity: '.45'
        }, 'Kopyala');
        oge.kopyala.disabled = true;
        satir.appendChild(oge.baslat);
        satir.appendChild(oge.kopyala);
        panel.appendChild(satir);

        oge.durum = yap('div', { marginTop: '10px', minHeight: '18px', fontSize: '12px', color: '#9aa3b2' });
        panel.appendChild(oge.durum);

        oge.sonuc = yap('div', {
            marginTop: '8px', overflowY: 'auto', flex: '1', minHeight: '0',
            borderTop: '1px solid #232b38', paddingTop: '8px', display: 'none'
        });
        panel.appendChild(oge.sonuc);

        oge.baslat.onclick = function () { API._basla(oge.giris.value); };
        oge.kopyala.onclick = function () { API._kopyala(); };

        document.body.appendChild(panel);
        oge.giris.focus();
        return panel;
    }

    function durumYaz(metin, renk) {
        if (oge.durum) {
            oge.durum.textContent = metin;
            oge.durum.style.color = renk || '#9aa3b2';
        }
        console.log('[Fiyat] ' + metin);
    }

    function sonucBas(kayitlar) {
        if (!oge.sonuc) return;
        oge.sonuc.innerHTML = '';
        oge.sonuc.style.display = 'block';
        var t = yap('table', { width: '100%', borderCollapse: 'collapse', fontSize: '12px' });
        kayitlar.forEach(function (k) {
            var tr = document.createElement('tr');
            var a = yap('td', { padding: '4px 6px 4px 0', borderBottom: '1px solid #1c2330' }, k.ad);
            var b = yap('td', {
                padding: '4px 0', borderBottom: '1px solid #1c2330', textAlign: 'right',
                whiteSpace: 'nowrap', fontWeight: '600',
                color: k.toptanFiyat ? '#7ddc9a' : '#ff7676'
            }, k.toptanFiyat || 'yok');
            tr.appendChild(a);
            tr.appendChild(b);
            t.appendChild(tr);
        });
        oge.sonuc.appendChild(t);
    }

    // ==================================================================
    // Akış
    // ==================================================================

    var API = {
        ARA_MS: 1500,
        sonuc: null,

        /** Paneli açar. Asıl giriş noktası bu. */
        ac: function () {
            var s = sistem();
            if (!s || typeof s._resolveApiInfoForDebug !== 'function') {
                console.log('%c⚠ Bu araç Jet Barkod sayım sayfasında çalışır: ' +
                            'https://jetbarkod.com.tr/sayim/', 'color:#ff7676;font-weight:bold');
                return;
            }
            panelAc();
            durumYaz('Listeyi yapıştır ve Başlat\'a bas.');
        },

        /** Panel olmadan, doğrudan metinle. */
        basla: function (adMetni) {
            if (adMetni && String(adMetni).trim()) return API._basla(String(adMetni));
            API.ac();
        },

        _basla: function (adMetni) {
            var s = sistem();
            var liste = katalogListesi();
            if (!liste.length) { durumYaz('Katalog henüz yüklenmedi, birkaç saniye bekle.', '#ffb454'); return; }

            var adlar = adlariAyikla(adMetni);
            if (!adlar.length) { durumYaz('Liste boş.', '#ffb454'); return; }

            var islenecek = [];
            var katalogdaYok = [];
            adlar.forEach(function (ad) {
                var u = adiCoz(ad, liste);
                var pid = u && (u.id || u.productId);
                if (u && pid) islenecek.push({ ad: u.name, urunId: String(pid), barkod: barkodBul(u) });
                else katalogdaYok.push(ad);
            });

            if (!islenecek.length) {
                durumYaz(adlar.length + ' addan hiçbiri katalogda bulunamadı.', '#ff7676');
                return;
            }
            durumYaz(adlar.length + ' ad okundu, ' + islenecek.length + ' tanesi çözüldü. Jeton alınıyor…');
            if (oge.baslat) { oge.baslat.disabled = true; oge.baslat.style.opacity = '.45'; }

            return Promise.resolve(s._resolveApiInfoForDebug()).then(function (bilgi) {
                if (!bilgi || !bilgi.token) {
                    durumYaz('Jeton yok. Getir franchise sekmesini açıp yenile, sonra tekrar dene.', '#ff7676');
                    return;
                }
                apiBilgi = {
                    token: bilgi.token,
                    stockEndpoint: bilgi.stockEndpoint,
                    warehouseId: bilgi.warehouseId || depoKimligiAra()
                };
                if (!apiBilgi.warehouseId) {
                    /* Durmuyoruz. İlk istek depo kimliği olmadan gidiyor,
                       sunucu jetondan çözüyor, kimliği yanıttan öğreniyoruz. */
                    console.log('[Fiyat] Depo kimliği yerelde yok; ilk istekten öğrenilecek.');
                }

                durumYaz('Deneme isteği gönderiliyor…');
                return satirCek(islenecek[0].urunId, islenecek[0].barkod).then(function (satir) {
                    if (!satir) {
                        durumYaz('Yanıt geldi ama ürün dönmedi. Depo bu ürünü tanımıyor olabilir.', '#ff7676');
                        return;
                    }
                    var f = toptanFiyat(satir);
                    if (!f.yazi) {
                        durumYaz('Ürün geldi ama toptan fiyat alanı yok. Ham satır konsolda.', '#ff7676');
                        console.log(satir);
                        return;
                    }
                    return API._topla(islenecek, katalogdaYok, satir);
                }).catch(function (e) {
                    var m = (e && e.message) || e;
                    durumYaz('Deneme isteği başarısız: ' + m, '#ff7676');
                    if (e && e.durum === 401) {
                        durumYaz('Jetonun süresi dolmuş. Franchise sekmesini yenile.', '#ff7676');
                    }
                });
            }).then(function (r) {
                if (oge.baslat) { oge.baslat.disabled = false; oge.baslat.style.opacity = '1'; }
                return r;
            });
        },

        _topla: function (islenecek, katalogdaYok, ilkSatir) {
            var kayitlar = [];
            var basarisiz = [];

            var f0 = toptanFiyat(ilkSatir);
            kayitlar.push({ ad: islenecek[0].ad, toptanFiyat: f0.yazi });
            sonucBas(kayitlar);

            var i = 1;

            function tur() {
                if (i >= islenecek.length) return Promise.resolve();
                var it = islenecek[i];
                durumYaz((i + 1) + '/' + islenecek.length + '  ' + it.ad);
                return bekle(API.ARA_MS).then(function () {
                    return satirCek(it.urunId, it.barkod);
                }).then(function (satir) {
                    var f = toptanFiyat(satir);
                    kayitlar.push({ ad: it.ad, toptanFiyat: f.yazi });
                    if (!f.yazi) basarisiz.push(it.ad);
                }).catch(function (e) {
                    kayitlar.push({ ad: it.ad, toptanFiyat: null });
                    basarisiz.push(it.ad + ' (' + ((e && e.message) || e) + ')');
                }).then(function () {
                    i++;
                    sonucBas(kayitlar);
                    return tur();
                });
            }

            return tur().then(function () {
                var tutan = kayitlar.filter(function (k) { return !!k.toptanFiyat; });
                API.sonuc = {
                    olusturma: new Date().toISOString(),
                    istenen: islenecek.length,
                    alinan: tutan.length,
                    katalogdaBulunamayan: katalogdaYok,
                    fiyatiAlinamayan: basarisiz,
                    urunler: kayitlar
                };
                durumYaz('Bitti. ' + tutan.length + '/' + islenecek.length +
                         ' ürünün toptan fiyatı alındı.' +
                         (katalogdaYok.length ? '  ' + katalogdaYok.length + ' ad katalogda yok.' : ''),
                         '#7ddc9a');
                if (oge.kopyala) { oge.kopyala.disabled = false; oge.kopyala.style.opacity = '1'; }
                if (console.table) {
                    var t = {};
                    kayitlar.forEach(function (k) { t[k.ad] = { 'Toptan Fiyat': k.toptanFiyat || '—' }; });
                    console.table(t);
                }
                return API.sonuc;
            });
        },

        /** Panoya yazar. Clipboard API izin istemesin diye seç-kopyala yolu. */
        _kopyala: function () {
            if (!API.sonuc) return;
            var metin = API.sonuc.urunler.map(function (k) {
                return k.ad + '\t' + (k.toptanFiyat || '');
            }).join('\n');

            var alan = document.createElement('textarea');
            alan.value = metin;
            alan.style.position = 'fixed';
            alan.style.opacity = '0';
            document.body.appendChild(alan);
            alan.select();
            var oldu = false;
            try { oldu = document.execCommand('copy'); } catch (e) { oldu = false; }
            alan.remove();
            durumYaz(oldu ? 'Panoya kopyalandı, tabloya yapıştırabilirsin.'
                          : 'Kopyalanamadı. Sonuç JBFiyat.sonuc içinde.',
                     oldu ? '#7ddc9a' : '#ffb454');
        }
    };

    global.JBFiyat = API;

    console.log('%cJBFiyat hazır.', 'color:#7ddc9a;font-weight:bold');
    console.log('Paneli açmak için:  JBFiyat.ac()');
})(window);
