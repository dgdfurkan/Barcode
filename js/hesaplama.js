/**
 * Hesaplama: kurye hak edişi (premium, hak anahtarı `hesaplama`)
 * ============================================================================
 *
 * VERİ NEREDEN
 * Franchise panelinin kurye performans isteği (POST /courier/v2/metrics),
 * Telegram Raporları > Kurye CDI ile aynı istek ve aynı oturum
 * (franchise-oturum.js). Ek olarak 527 numaralı ölçü grubu: G10 km.
 *   ilk            first_order_count
 *   birlesen       batched_order_count
 *   finans         getir_finance_order_count
 *   carsi          artisan_order_count
 *   carsiBirlesen  panel vermiyor, elle girilir
 *   km             g10_distance_km (yalnız km desteği açık kuryede)
 *   not            cdi_letter_grade
 *
 * HİÇBİR ŞEY SUNUCUYA GİTMİYOR
 * Panelden gelen liste yalnız bellekte (sayfa kapanınca gider). Fiyatlar,
 * araç, km desteği, not yükseltme, ek paket, bağlı hesap ve avanslar
 * localStorage'da, kullanıcı adına göre ayrı anahtarda.
 *
 * HESAP
 *   paket tutarı = Σ (panel + bağlı hesaplar + elle ek) × fiyat[araç][not][kalem]
 *   km desteği   = km × km fiyatı[araç]   (km: elle yazılan, yoksa G10 km)
 *   net          = paket tutarı + km desteği − avanslar
 * Not, panelin notudur; kullanıcı bir tık yükseltip düşürebilir (yalnız fiyat
 * değişir). Bağlı hesap: kurye başka birinin hesabından çıktıysa o hesabın
 * paketleri ve km'si bu kuryeye eklenir, bağlanan satır listeden düşer.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var HAK = 'hesaplama';
    var KIMLIK = /^[a-f0-9]{24}$/;
    var FOTO = /^https:\/\/cdn\.getir\.com\/person\/[A-Za-z0-9._-]+\.(?:png|jpe?g)(?:\?[0-9]+)?$/;
    /* Kurye CDI raporunun ölçü grupları + 527 (G10 km) */
    var METRIK = ['406', '21', '403', '407', '22', '404', '111', '405', '410', '412', '520', '11', '12', '16', '112', '23', '409', '408', '25', '26', '510', '514', '527'];

    var TURLER = [
        { k: 'ilk', ad: 'İlk Paket', alan: 'first_order_count', ikon: 'kutu' },
        { k: 'birlesen', ad: 'Birleşen', alan: 'batched_order_count', ikon: 'katman' },
        { k: 'finans', ad: 'Getir Finans', alan: 'getir_finance_order_count', ikon: 'kart' },
        { k: 'carsi', ad: 'Çarşı', alan: 'artisan_order_count', ikon: 'dukkan' },
        { k: 'carsiBirlesen', ad: 'Çarşı Birleşen', alan: null, ikon: 'dukkanKatman' }
    ];
    var NOTLAR = ['A++', 'A+', 'A', 'C', 'E', 'F'];
    var ARACLAR = [{ k: 'moto', ad: 'Motorlu', ikon: 'motor' }, { k: 'car', ad: 'Arabalı', ikon: 'araba' }];
    var AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    var IKON = {
        kutu: '<path d="M3.5 6.5 10 3l6.5 3.5v7L10 17l-6.5-3.5z"/><path d="M3.5 6.5 10 10l6.5-3.5M10 10v7"/>',
        katman: '<path d="m10 3 7 3.5-7 3.5-7-3.5z"/><path d="m3 10 7 3.5 7-3.5"/><path d="m3 13.5 7 3.5 7-3.5"/>',
        kart: '<rect x="2.5" y="5" width="15" height="10.5" rx="2"/><path d="M2.5 8.5h15M5.5 12.5h3"/>',
        dukkan: '<path d="M3 8h14l-1-4H4z"/><path d="M4 8v8.5h12V8"/><path d="M8 16.5v-4h4v4"/>',
        dukkanKatman: '<path d="M3 8h14l-1-4H4z"/><path d="M4 8v8.5h12V8"/><path d="M7.5 12h5M10 9.5v5"/>',
        motor: '<circle cx="5" cy="13.5" r="2.5"/><circle cx="15" cy="13.5" r="2.5"/><path d="M5 13.5h4.5l3-5H15l-2.5 5M10.5 5.5h2l1 3"/>',
        araba: '<path d="M3 13V10l1.8-4h10.4L17 10v3z"/><path d="M3 10h14"/><circle cx="6" cy="14" r="1.6"/><circle cx="14" cy="14" r="1.6"/>',
        yol: '<circle cx="5" cy="15" r="2"/><circle cx="15" cy="5" r="2"/><path d="M7 15h5.5a2.5 2.5 0 0 0 0-5h-5a2.5 2.5 0 0 1 0-5H13"/>',
        cuzdan: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H15v3"/><rect x="3" y="7" width="14" height="9" rx="1.5"/><path d="M13.5 11.5h1"/>',
        bag: '<path d="M8.5 11.5a3 3 0 0 0 4.2.3l2.5-2.5a3 3 0 0 0-4.2-4.2l-.9.9"/><path d="M11.5 8.5a3 3 0 0 0-4.2-.3l-2.5 2.5a3 3 0 0 0 4.2 4.2l.9-.9"/>',
        not: '<circle cx="10" cy="8" r="4.5"/><path d="m7.5 11.8-1.2 5.2L10 15.3l3.7 1.7-1.2-5.2"/>',
        yukari: '<path d="m5 12.5 5-5 5 5"/>',
        asagi: '<path d="m5 7.5 5 5 5-5"/>',
        ok: '<path d="m7 4 6 6-6 6"/>',
        sil: '<path d="M4.5 6h11M8 6V4h4v2M6 6l.7 10h6.6L14 6"/>',
        arti: '<path d="M10 4.5v11M4.5 10h11"/>',
        carpi: '<path d="m6 6 8 8M14 6l-8 8"/>',
        geri: '<path d="M4 10a6 6 0 1 0 1.8-4.3"/><path d="M4 3.8v3.6h3.6"/>',
        para: '<circle cx="10" cy="10" r="7"/><path d="M8 6.5v7M8 9.5l4-1.5M8 12l4-1.5"/>',
        kurye: '<circle cx="10" cy="7" r="3"/><path d="M4 17c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5"/>'
    };
    function ikon(ad, sinif) { return '<svg viewBox="0 0 20 20" aria-hidden="true"' + (sinif ? ' class="' + sinif + '"' : '') + '>' + (IKON[ad] || '') + '</svg>'; }

    var d = {
        kim: '',
        ay: '',
        veri: new Map(),       // ay → { kuryeler, zaman, bas, son }
        yukleniyor: false,
        hata: null,
        ara: '',
        sira: 'net',
        acik: new Set(),
        fiyatArac: 'moto',
        ornek: /[?&]ornek\b/.test(location.search)
    };
    var kayit = null;

    function el(id) { return document.getElementById(id); }
    function kacir(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function num(v) {
        if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
        var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    }
    function para(n) {
        var y = Math.round(n * 100) / 100;
        return y.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₺';
    }
    function adet(n) { return Math.round(n).toLocaleString('tr-TR'); }
    function bildir(m, tur) { if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir(m, tur || 'bilgi'); }
    function nesne(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

    // ------------------------------------------------------------------
    // Yerel kayıt
    // ------------------------------------------------------------------

    function anahtar() { return 'jb_hesaplama:' + (d.kim || 'misafir'); }

    function kayitOku() {
        var o = null;
        try { o = JSON.parse(localStorage.getItem(anahtar()) || 'null'); } catch (e) { o = null; }
        o = nesne(o);
        return { v: 1, fiyat: nesne(o.fiyat), km: nesne(o.km), gizli: nesne(o.gizli), kurye: nesne(o.kurye), ay: nesne(o.ay) };
    }

    var yazZaman = 0;
    function kaydet(hemen) {
        clearTimeout(yazZaman);
        var yaz = function () {
            try { localStorage.setItem(anahtar(), JSON.stringify(kayit)); }
            catch (e) { bildir('Kaydedilemedi: tarayıcı belleği dolu', 'hata'); }
        };
        if (hemen) yaz(); else yazZaman = setTimeout(yaz, 250);
    }

    function ayKaydi(yaz) {
        var a = kayit.ay[d.ay];
        if (!a) {
            if (!yaz) return { k: {}, bagli: {} };
            a = kayit.ay[d.ay] = { k: {}, bagli: {} };
        }
        a.k = nesne(a.k);
        a.bagli = nesne(a.bagli);
        return a;
    }
    function kuryeAyi(id, yaz) {
        var a = ayKaydi(yaz);
        if (!a.k[id]) { if (!yaz) return {}; a.k[id] = {}; }
        return a.k[id];
    }
    function kuryeKalici(id, yaz) {
        if (!kayit.kurye[id]) { if (!yaz) return {}; kayit.kurye[id] = {}; }
        return kayit.kurye[id];
    }
    function gorunenTurler() { return TURLER.filter(function (t) { return !kayit.gizli[t.k]; }); }

    // ------------------------------------------------------------------
    // Dönem
    // ------------------------------------------------------------------

    function bugun() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date()); }
    function saat() { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false }).format(new Date())) % 24; }
    function ayKaydir(ay, n) { return new Date(Date.UTC(+ay.slice(0, 4), +ay.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7); }
    function ayAdi(ay) { return AYLAR[+ay.slice(5, 7) - 1] + ' ' + ay.slice(0, 4); }

    /* Ayın ilk haftası geçen ayın hak edişi hesaplanır, sonrası içinde bulunulan ay */
    function varsayilanAy() {
        var b = bugun();
        return +b.slice(8, 10) <= 7 ? ayKaydir(b.slice(0, 7), -1) : b.slice(0, 7);
    }

    function aralik(ay) {
        var b = bugun();
        var bas = ay + '-01';
        var son = new Date(Date.UTC(+ay.slice(0, 4), +ay.slice(5, 7), 0)).toISOString().slice(0, 10);
        var surer = b.slice(0, 7) === ay;
        if (surer) {
            var dun = new Date(Date.parse(b + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
            son = dun < bas ? bas : dun;
        }
        return { bas: bas, son: son, surer: surer };
    }

    function aralikYazi(r) {
        var g = function (t) { return +t.slice(8, 10); };
        return g(r.bas) + '–' + g(r.son) + ' ' + AYLAR[+r.bas.slice(5, 7) - 1];
    }

    // ------------------------------------------------------------------
    // Panel verisi (yalnız bellekte)
    // ------------------------------------------------------------------

    function hataYap(kod) { var h = new Error(kod); h.kod = kod; return h; }
    function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function harf(v) { return typeof v === 'string' && /^[A-F][+-]{0,2}$/.test(v.trim()) ? v.trim() : null; }

    function kuryeDuzelt(k) {
        if (!k || typeof k !== 'object') return null;
        var id = String(k.id || '');
        if (!KIMLIK.test(id)) return null;
        var say = {};
        TURLER.forEach(function (t) { say[t.k] = t.alan ? Math.max(0, Math.round(num(k[t.alan]))) : 0; });
        return {
            id: id,
            ad: String(k.name || 'Kurye').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) || 'Kurye',
            foto: typeof k.image_url === 'string' && FOTO.test(k.image_url) ? k.image_url : '',
            say: say,
            km: Math.max(0, Math.round(num(k.g10_distance_km) * 10) / 10),
            not: harf(k.cdi_letter_grade),
            cdi: k.cdi_order_score == null || k.cdi_order_score === '' ? null : num(k.cdi_order_score)
        };
    }

    async function veriAl(ay, zorla) {
        if (!zorla && d.veri.has(ay)) return d.veri.get(ay);
        var r = aralik(ay);
        if (d.ornek) {
            var v0 = { kuryeler: ornekKuryeler(ay), zaman: Date.now(), bas: r.bas, son: r.son };
            d.veri.set(ay, v0);
            return v0;
        }
        if (!global.franchiseOturum) throw hataYap('oturum');
        var o = await global.franchiseOturum.al();
        if (!o || !o.depo) throw hataYap('depo');
        var liste = [];
        for (var s = 0; s < 5; s++) {
            if (s) await bekle(400);
            var yanit = await global.franchiseOturum.istek('/courier/v2/metrics', {
                method: 'POST',
                govde: {
                    startDate: r.bas + 'T00:00:00.000Z', endDate: r.son + 'T23:59:59.999Z', courierIds: [], warehouseIds: [o.depo],
                    metricGroups: METRIK, vehicleTypes: [], limit: 100, offset: s * 100
                }
            });
            if (!yanit.ok) throw hataYap('panel');
            var j = await yanit.json();
            var parca = Array.isArray(j && j.data) ? j.data : [];
            liste = liste.concat(parca);
            if (parca.length < 100 || liste.length >= (Number(j && j.total_count) || 0)) break;
        }
        var gorulen = {};
        var kuryeler = liste.map(kuryeDuzelt).filter(function (k) {
            if (!k || gorulen[k.id]) return false;
            gorulen[k.id] = true;
            return true;
        });
        var v = { kuryeler: kuryeler, zaman: Date.now(), bas: r.bas, son: r.son };
        d.veri.set(ay, v);
        return v;
    }

    /* ?ornek: oturum olmadan sayfayı görmek için kurgusal kuryeler */
    function ornekKuryeler(ay) {
        var adlar = ['Ali Kaya', 'Burak Demir', 'Cem Yıldız', 'Deniz Aydın', 'Emre Şahin', 'Kerem Çelik', 'Mert Arslan', 'Onur Koç'];
        var notlar = ['A++', 'A+', 'A++', 'A', 'A+', 'C', 'A++', 'E'];
        var tohum = +ay.replace('-', '');
        return adlar.map(function (ad, i) {
            var x = (tohum * (i + 3)) % 97;
            var ilk = 380 + x * 4 - i * 25;
            return {
                id: ('0000000000000000000000' + (i + 1)).slice(-24),
                ad: ad, foto: '',
                say: { ilk: ilk, birlesen: Math.round(ilk * 0.6), finans: i % 3, carsi: 8 + (x % 30), carsiBirlesen: 0 },
                km: Math.round(ilk * 2.6), not: notlar[i], cdi: 90 - i * 3
            };
        });
    }

    function hataMetni(e) {
        var k = e && e.kod;
        if (k === 'oturum') return 'Franchise oturumu bulunamadı. Franchise panelini bir kez aç, Jet Barkod Asistan oturumu buraya getirir.';
        if (k === 'depo') return 'Depo bilgisi bulunamadı. Franchise panelinde Mevcut Stok sayfasını bir kez aç.';
        if (k === 'panel') return 'Panel bu ay için yanıt vermedi. Biraz sonra Yenile\'ye bas.';
        return 'Panele ulaşılamadı. İnternet bağlantını kontrol et.';
    }

    // ------------------------------------------------------------------
    // Hesap
    // ------------------------------------------------------------------

    function notSirasi(g) {
        var harfSira = 'ABCDEF'.indexOf(g.charAt(0));
        var ek = g.slice(1);
        return harfSira * 4 + (ek === '++' ? 0 : ek === '+' ? 1 : ek === '' ? 2 : 3);
    }

    function notListesi() {
        var l = NOTLAR.slice();
        var v = d.veri.get(d.ay);
        if (v) v.kuryeler.forEach(function (k) { if (k.not && l.indexOf(k.not) === -1) l.push(k.not); });
        return l.sort(function (a, b) { return notSirasi(a) - notSirasi(b); });
    }

    function hesapla(k, veri) {
        var a = ayKaydi(false);
        var s = a.k[k.id] || {};
        var kalici = kayit.kurye[k.id] || {};
        var arac = kalici.arac === 'car' ? 'car' : 'moto';
        var bagli = veri.kuryeler.filter(function (x) { return a.bagli[x.id] === k.id; });
        var not = (s.not && notListesi().indexOf(s.not) !== -1) ? s.not : k.not;
        var tablo = nesne(nesne(kayit.fiyat[arac])[not]);

        var paket = 0, paketTutar = 0;
        var satirlar = gorunenTurler().map(function (t) {
            var kendi = k.say[t.k] || 0;
            var diger = bagli.reduce(function (t2, b) { return t2 + (b.say[t.k] || 0); }, 0);
            var ek = Math.round(num(nesne(s.ek)[t.k]));
            var toplam = Math.max(0, kendi + diger + ek);
            var fiyat = num(tablo[t.k]);
            var tutar = toplam * fiyat;
            paket += toplam;
            paketTutar += tutar;
            return { t: t, kendi: kendi, diger: diger, ek: ek, toplam: toplam, fiyat: fiyat, tutar: tutar };
        });

        var g10 = Math.round((k.km + bagli.reduce(function (t2, b) { return t2 + b.km; }, 0)) * 10) / 10;
        var kmDestek = !!kalici.km;
        var elleKm = s.km != null && s.km !== '';
        var km = kmDestek ? (elleKm ? num(s.km) : g10) : 0;
        var kmFiyat = num(kayit.km[arac]);
        var kmTutar = km * kmFiyat;

        var avanslar = Array.isArray(s.avans) ? s.avans : [];
        var avans = avanslar.reduce(function (t2, x) { return t2 + num(x && x.tutar); }, 0);
        var brut = paketTutar + kmTutar;
        return {
            arac: arac, not: not, yukseltildi: !!(s.not && s.not !== k.not && not === s.not), bagli: bagli,
            satirlar: satirlar, paket: paket, paketTutar: paketTutar,
            g10: g10, kmDestek: kmDestek, elleKm: elleKm, km: km, kmFiyat: kmFiyat, kmTutar: kmTutar,
            avanslar: avanslar, avans: avans, brut: brut, net: brut - avans
        };
    }

    function anaKuryeler(veri) {
        var a = ayKaydi(false);
        var idler = {};
        veri.kuryeler.forEach(function (k) { idler[k.id] = true; });
        /* Ana kurye bu ay listede yoksa bağ geçersiz, satır yine görünsün */
        return veri.kuryeler.filter(function (k) { return !(a.bagli[k.id] && idler[a.bagli[k.id]] && a.bagli[k.id] !== k.id); });
    }

    function fiyatVarMi() {
        if (ARACLAR.some(function (a) { return num(kayit.km[a.k]) > 0; })) return true;
        return ARACLAR.some(function (a) {
            var t = nesne(kayit.fiyat[a.k]);
            return Object.keys(t).some(function (n) { return Object.keys(nesne(t[n])).some(function (k) { return num(t[n][k]) > 0; }); });
        });
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------

    function bolum(id) { ['hsGiris', 'hsYetkiYok', 'hsIcerik'].forEach(function (x) { el(x).hidden = x !== id; }); }

    function donemCiz() {
        var r = aralik(d.ay);
        el('hsAyAd').textContent = ayAdi(d.ay);
        var alt = aralikYazi(r);
        if (r.surer) alt += ' · Ay sürüyor, dün dahil';
        else if (ayKaydir(d.ay, 1) === bugun().slice(0, 7) && +bugun().slice(8, 10) === 1 && saat() < 13) alt += ' · Son gün öğleden sonra tamamlanır';
        el('hsAyAlt').textContent = alt;
        el('hsAyIleri').disabled = d.ay >= bugun().slice(0, 7);
    }

    function durumCiz() {
        var kutu = el('hsDurum');
        var v = d.veri.get(d.ay);
        var metin, tur;
        if (d.yukleniyor) { metin = 'Panelden okunuyor'; tur = 'yukleniyor'; }
        else if (d.hata) { metin = hataMetni(d.hata); tur = 'hata'; }
        else if (v) {
            var t = new Date(v.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            metin = (d.ornek ? 'Örnek veri' : 'Panelden alındı') + ' · ' + t + ' · ' + v.kuryeler.length + ' kurye';
            tur = 'tamam';
        } else { metin = ' '; tur = ''; }
        kutu.setAttribute('data-tur', tur);
        el('hsDurumMetin').textContent = metin;
        el('hsYenile').disabled = d.yukleniyor;
    }

    function ozetCiz() {
        var v = d.veri.get(d.ay);
        var kutu = el('hsOzet');
        if (!v) {
            kutu.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="hs-ozet__kutu hs-iskelet"></div>'; }).join('');
            return;
        }
        var t = { net: 0, paket: 0, paketTutar: 0, km: 0, kmTutar: 0, avans: 0, kurye: 0 };
        anaKuryeler(v).forEach(function (k) {
            var h = hesapla(k, v);
            t.net += h.net; t.paket += h.paket; t.paketTutar += h.paketTutar; t.km += h.km; t.kmTutar += h.kmTutar; t.avans += h.avans; t.kurye++;
        });
        kutu.innerHTML =
            '<div class="hs-ozet__kutu hs-ozet__kutu--ana"><span>' + ikon('para') + 'Net Hak Ediş</span><strong>' + para(t.net) + '</strong><small>' + t.kurye + ' kurye</small></div>' +
            '<div class="hs-ozet__kutu"><span>' + ikon('kutu') + 'Paket</span><strong>' + para(t.paketTutar) + '</strong><small>' + adet(t.paket) + ' paket</small></div>' +
            '<div class="hs-ozet__kutu"><span>' + ikon('yol') + 'Km Desteği</span><strong>' + para(t.kmTutar) + '</strong><small>' + adet(t.km) + ' km</small></div>' +
            '<div class="hs-ozet__kutu"><span>' + ikon('cuzdan') + 'Avans</span><strong class="' + (t.avans ? 'eksi' : '') + '">' + (t.avans ? '−' : '') + para(t.avans) + '</strong><small>düşüldü</small></div>';
        el('hsFiyatUyari').hidden = fiyatVarMi();
    }

    function bas(ad) {
        var p = String(ad || '').trim().split(/\s+/);
        return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toLocaleUpperCase('tr');
    }

    function notSinif(g) {
        if (!g) return 'bos';
        if (g.indexOf('A') === 0) return g === 'A' ? 'a' : 'app';
        if (g.charAt(0) === 'B' || g.charAt(0) === 'C') return 'c';
        return 'f';
    }

    function listeCiz() {
        var kutu = el('hsListe');
        var v = d.veri.get(d.ay);
        if (!v) {
            if (d.hata) {
                kutu.innerHTML = '<div class="hs-bos">' + ikon('kurye') + '<strong>Kurye verisi alınamadı</strong><p>' + kacir(hataMetni(d.hata)) + '</p><button type="button" class="hs-dugme" data-yenile>' + ikon('geri') + '<span>Tekrar Dene</span></button></div>';
            } else {
                kutu.innerHTML = [0, 1, 2, 3].map(function () { return '<div class="hs-k hs-iskelet hs-iskelet--satir"></div>'; }).join('');
            }
            return;
        }
        var ana = anaKuryeler(v);
        if (!ana.length) {
            kutu.innerHTML = '<div class="hs-bos">' + ikon('kurye') + '<strong>' + kacir(ayAdi(d.ay)) + ' için kurye yok</strong><p>Panel bu ay için kurye döndürmedi. Başka bir ay seç.</p></div>';
            return;
        }
        var q = d.ara.toLocaleLowerCase('tr');
        var satirlar = ana.map(function (k) { return { k: k, h: hesapla(k, v) }; })
            .filter(function (x) { return !q || x.k.ad.toLocaleLowerCase('tr').indexOf(q) !== -1; });
        satirlar.sort(function (a, b) {
            if (d.sira === 'ad') return a.k.ad.localeCompare(b.k.ad, 'tr');
            if (d.sira === 'paket') return b.h.paket - a.h.paket;
            return b.h.net - a.h.net;
        });
        if (!satirlar.length) {
            kutu.innerHTML = '<div class="hs-bos">' + ikon('kurye') + '<strong>Eşleşen kurye yok</strong><p>Aramayı temizle.</p></div>';
            return;
        }
        kutu.innerHTML = satirlar.map(function (x) { return kuryeHtml(x.k, x.h, v); }).join('');
    }

    function kuryeHtml(k, h, v) {
        var acik = d.acik.has(k.id);
        var foto = k.foto
            ? '<img class="hs-k__foto" src="' + kacir(k.foto) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'hs-k__foto hs-k__foto--bas\',textContent:' + kacir(JSON.stringify(bas(k.ad))) + '}))">'
            : '<span class="hs-k__foto hs-k__foto--bas">' + kacir(bas(k.ad)) + '</span>';
        var notHtml = h.yukseltildi
            ? '<span class="hs-not hs-not--' + notSinif(k.not) + ' hs-not--eski">' + kacir(k.not || '–') + '</span>' + ikon('ok', 'hs-not__ok') + '<span class="hs-not hs-not--' + notSinif(h.not) + '">' + kacir(h.not) + '</span>'
            : '<span class="hs-not hs-not--' + notSinif(h.not) + '">' + kacir(h.not || 'Not yok') + '</span>';
        var aracTanim = ARACLAR.filter(function (a) { return a.k === h.arac; })[0];
        return '<article class="hs-k' + (acik ? ' is-acik' : '') + '" data-id="' + kacir(k.id) + '">' +
            '<button type="button" class="hs-k__bas" data-ac aria-expanded="' + acik + '">' +
                foto +
                '<span class="hs-k__ad"><strong>' + kacir(k.ad) + '</strong>' +
                    '<small>' + ikon(aracTanim.ikon) + aracTanim.ad + ' · <b data-o="paket">' + adet(h.paket) + '</b> paket' +
                    (h.bagli.length ? ' · ' + ikon('bag') + h.bagli.length + ' hesap' : '') +
                    (h.avans ? ' · ' + ikon('cuzdan') + 'avans' : '') + '</small></span>' +
                '<span class="hs-k__not">' + notHtml + '</span>' +
                '<span class="hs-k__tutar"><strong data-o="net">' + para(h.net) + '</strong><small data-o="brutAlt">' + (h.avans ? para(h.brut) + ' − ' + para(h.avans) : 'Net') + '</small></span>' +
                ikon('asagi', 'hs-k__ok') +
            '</button>' +
            (acik ? '<div class="hs-k__govde">' + detayHtml(k, h, v) + '</div>' : '') +
        '</article>';
    }

    function detayHtml(k, h, v) {
        var s = kuryeAyi(k.id, false);
        var notlar = notListesi();
        var i = notlar.indexOf(h.not);

        var arac = '<div class="hs-alan"><span class="hs-alan__ad">Araç</span><div class="hs-segment" role="radiogroup" aria-label="Araç">' +
            ARACLAR.map(function (a) {
                return '<button type="button" role="radio" data-arac="' + a.k + '" aria-checked="' + (h.arac === a.k) + '">' + ikon(a.ikon) + a.ad + '</button>';
            }).join('') + '</div></div>';

        var not = '<div class="hs-alan"><span class="hs-alan__ad">Fiyat Notu</span><div class="hs-adim">' +
            '<button type="button" class="hs-adim__d" data-not-yon="1" aria-label="Notu düşür"' + (i < 0 || i >= notlar.length - 1 ? ' disabled' : '') + '>' + ikon('asagi') + '</button>' +
            '<span class="hs-not hs-not--buyuk hs-not--' + notSinif(h.not) + '">' + kacir(h.not || '–') + '</span>' +
            '<button type="button" class="hs-adim__d" data-not-yon="-1" aria-label="Notu yükselt"' + (i <= 0 && h.not ? ' disabled' : '') + '>' + ikon('yukari') + '</button>' +
            '</div><span class="hs-alan__not">Panel: <b>' + kacir(k.not || 'yok') + '</b>' + (k.cdi != null ? ' · CDI %' + kacir(String(Math.round(k.cdi * 10) / 10).replace('.', ',')) : '') +
            (h.yukseltildi ? ' · <button type="button" class="hs-bag" data-not-sifirla>Panel notuna dön</button>' : '') + '</span></div>';

        var tablo = '<div class="hs-tablo" role="table" aria-label="Paketler">' +
            '<div class="hs-tablo__bas" role="row"><span role="columnheader">Kalem</span><span role="columnheader">Panel</span><span role="columnheader">Ek</span><span role="columnheader">Fiyat</span><span role="columnheader">Tutar</span></div>' +
            h.satirlar.map(function (r) {
                var panel = r.t.alan ? adet(r.kendi) + (r.diger ? '<em>+' + adet(r.diger) + '</em>' : '') : '<em class="hs-soluk">elle</em>';
                return '<div class="hs-tablo__satir" role="row">' +
                    '<span role="cell" class="hs-tablo__kalem">' + ikon(r.t.ikon) + kacir(r.t.ad) + '</span>' +
                    '<span role="cell" class="hs-tablo__sayi">' + panel + '</span>' +
                    '<span role="cell"><input class="hs-girdi hs-girdi--kucuk" type="text" inputmode="numeric" data-ek="' + r.t.k + '" value="' + (r.ek ? kacir(r.ek) : '') + '" placeholder="0" aria-label="' + kacir(r.t.ad) + ' ek paket"></span>' +
                    '<span role="cell" class="hs-tablo__sayi hs-soluk" data-o="fiyat-' + r.t.k + '">× ' + para(r.fiyat) + '</span>' +
                    '<span role="cell" class="hs-tablo__sayi hs-tablo__tutar" data-o="tutar-' + r.t.k + '">' + para(r.tutar) + '</span>' +
                '</div>';
            }).join('') +
            '<div class="hs-tablo__satir hs-tablo__satir--toplam" role="row"><span role="cell">Paket Toplamı</span><span role="cell" class="hs-tablo__sayi" data-o="paket2">' + adet(h.paket) + '</span><span role="cell"></span><span role="cell"></span><span role="cell" class="hs-tablo__sayi hs-tablo__tutar" data-o="paketTutar">' + para(h.paketTutar) + '</span></div>' +
            '</div>';

        var km = '<div class="hs-blok"><div class="hs-blok__bas">' + ikon('yol') + '<strong>Km Desteği</strong>' +
            '<label class="hs-anahtar"><input type="checkbox" data-km-destek' + (h.kmDestek ? ' checked' : '') + '><span></span><em>Kendi aracıyla</em></label></div>' +
            (h.kmDestek
                ? '<div class="hs-km"><label class="hs-girdi-kap"><input class="hs-girdi" type="text" inputmode="decimal" data-km value="' + (h.elleKm ? kacir(s.km) : '') + '" placeholder="' + kacir(adet(h.g10)) + '" aria-label="Km"><span>km</span></label>' +
                  '<span class="hs-km__g10">G10 ' + adet(h.g10) + ' km' + (h.elleKm ? ' · <button type="button" class="hs-bag" data-km-g10>G10\'a dön</button>' : '') + '</span>' +
                  '<span class="hs-km__hesap"><span class="hs-soluk" data-o="kmFiyat">× ' + para(h.kmFiyat) + '</span><b data-o="kmTutar">' + para(h.kmTutar) + '</b></span></div>'
                : '<p class="hs-blok__not">Kurye kendi motoruyla ya da arabasıyla çalışıyorsa aç. G10 km\'si: ' + adet(h.g10) + ' km.</p>') +
            '</div>';

        var a = ayKaydi(false);
        var adaylar = v.kuryeler.filter(function (x) {
            if (x.id === k.id || a.bagli[x.id]) return false;
            return !v.kuryeler.some(function (y) { return a.bagli[y.id] === x.id; });
        });
        var bagli = '<div class="hs-blok"><div class="hs-blok__bas">' + ikon('bag') + '<strong>Başka Hesaplar</strong></div>' +
            '<p class="hs-blok__not">Kurye bu ay başka birinin hesabından da çıktıysa o hesabı bağla: paketleri ve km\'si buraya eklenir.</p>' +
            (h.bagli.length ? '<div class="hs-cipler">' + h.bagli.map(function (b) {
                return '<span class="hs-cip">' + kacir(b.ad) + ' · ' + adet(TURLER.reduce(function (t2, t) { return t2 + (b.say[t.k] || 0); }, 0)) + ' paket<button type="button" data-coz="' + kacir(b.id) + '" aria-label="Bağı kaldır">' + ikon('carpi') + '</button></span>';
            }).join('') + '</div>' : '') +
            (adaylar.length ? '<label class="hs-sec">' + ikon('arti') + '<select data-bagla aria-label="Hesap bağla"><option value="">Hesap bağla</option>' +
                adaylar.map(function (x) { return '<option value="' + kacir(x.id) + '">' + kacir(x.ad) + '</option>'; }).join('') + '</select></label>' : '') +
            '</div>';

        var avans = '<div class="hs-blok"><div class="hs-blok__bas">' + ikon('cuzdan') + '<strong>Avans</strong><span class="hs-blok__sag" data-o="avansToplam">' + (h.avans ? '−' + para(h.avans) : '') + '</span></div>' +
            (h.avanslar.length ? '<ul class="hs-avanslar">' + h.avanslar.map(function (x, j) {
                return '<li><span>' + kacir(x.tarih ? new Date(x.tarih + 'T12:00:00Z').toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' }) : '') + '</span><em>' + kacir(x.not || 'Avans') + '</em><b>−' + para(num(x.tutar)) + '</b><button type="button" data-avans-sil="' + j + '" aria-label="Avansı sil">' + ikon('sil') + '</button></li>';
            }).join('') + '</ul>' : '') +
            '<div class="hs-avans-ekle"><label class="hs-girdi-kap"><input class="hs-girdi" type="text" inputmode="decimal" data-avans-tutar placeholder="Tutar" aria-label="Avans tutarı"><span>₺</span></label>' +
            '<input class="hs-girdi" type="text" data-avans-not placeholder="Not (isteğe bağlı)" maxlength="60" aria-label="Avans notu">' +
            '<button type="button" class="hs-dugme" data-avans-ekle>' + ikon('arti') + '<span>Ekle</span></button></div>' +
            '</div>';

        var son = '<div class="hs-son">' +
            '<span><small>Paket</small><b data-o="paketTutar2">' + para(h.paketTutar) + '</b></span>' +
            '<span><small>Km Desteği</small><b data-o="kmTutar2">' + para(h.kmTutar) + '</b></span>' +
            '<span><small>Avans</small><b data-o="avans2">' + (h.avans ? '−' : '') + para(h.avans) + '</b></span>' +
            '<span class="hs-son__net"><small>Net</small><b data-o="net2">' + para(h.net) + '</b></span>' +
            '</div>';

        return '<div class="hs-ust">' + arac + not + '</div>' + tablo + '<div class="hs-ikili">' + km + bagli + '</div>' + avans + son;
    }

    /* Yazarken yalnız rakamlar değişir; girdiler yeniden çizilmez, odak kaçmaz */
    function rakamYaz(art) {
        var v = d.veri.get(d.ay);
        var k = v && v.kuryeler.filter(function (x) { return x.id === art.getAttribute('data-id'); })[0];
        if (!k) return;
        var h = hesapla(k, v);
        var yaz = function (o, m) { var e = art.querySelector('[data-o="' + o + '"]'); if (e) e.textContent = m; };
        yaz('net', para(h.net)); yaz('net2', para(h.net));
        yaz('brutAlt', h.avans ? para(h.brut) + ' − ' + para(h.avans) : 'Net');
        yaz('paket', adet(h.paket)); yaz('paket2', adet(h.paket));
        yaz('paketTutar', para(h.paketTutar)); yaz('paketTutar2', para(h.paketTutar));
        yaz('kmTutar', para(h.kmTutar)); yaz('kmTutar2', para(h.kmTutar));
        yaz('avans2', (h.avans ? '−' : '') + para(h.avans));
        h.satirlar.forEach(function (r) { yaz('tutar-' + r.t.k, para(r.tutar)); });
        ozetCiz();
    }

    function kuryeYenidenCiz(id) {
        var v = d.veri.get(d.ay);
        var art = el('hsListe').querySelector('.hs-k[data-id="' + id + '"]');
        var k = v && v.kuryeler.filter(function (x) { return x.id === id; })[0];
        if (!art || !k) { listeCiz(); ozetCiz(); return; }
        var yeni = document.createElement('div');
        yeni.innerHTML = kuryeHtml(k, hesapla(k, v), v);
        art.replaceWith(yeni.firstChild);
        ozetCiz();
    }

    function hepsiniCiz() { donemCiz(); durumCiz(); ozetCiz(); listeCiz(); }

    // ------------------------------------------------------------------
    // Fiyatlar paneli
    // ------------------------------------------------------------------

    function fiyatCiz() {
        var arac = d.fiyatArac;
        var tablo = nesne(kayit.fiyat[arac]);
        var turler = gorunenTurler();
        var g = el('hsFiyatGovde');
        g.innerHTML =
            '<div class="hs-segment hs-segment--genis" role="radiogroup" aria-label="Araç">' + ARACLAR.map(function (a) {
                return '<button type="button" role="radio" data-fiyat-arac="' + a.k + '" aria-checked="' + (a.k === arac) + '">' + ikon(a.ikon) + a.ad + '</button>';
            }).join('') + '</div>' +
            '<div class="hs-fiyat" style="--sutun:' + turler.length + '">' +
                '<div class="hs-fiyat__satir hs-fiyat__satir--bas"><span>Not</span>' + turler.map(function (t) { return '<span>' + ikon(t.ikon) + kacir(t.ad) + '</span>'; }).join('') + '</div>' +
                notListesi().map(function (n) {
                    var satir = nesne(tablo[n]);
                    return '<div class="hs-fiyat__satir"><span><b class="hs-not hs-not--' + notSinif(n) + '">' + kacir(n) + '</b></span>' + turler.map(function (t) {
                        return '<label class="hs-girdi-kap hs-girdi-kap--fiyat"><input class="hs-girdi" type="text" inputmode="decimal" data-fiyat="' + kacir(n) + '|' + t.k + '" value="' + kacir(satir[t.k] != null ? satir[t.k] : '') + '" placeholder="0" aria-label="' + kacir(n + ' ' + t.ad) + ' fiyatı"><span>₺</span></label>';
                    }).join('') + '</div>';
                }).join('') +
            '</div>' +
            '<div class="hs-pano__satir"><span class="hs-pano__ad"><b>' + ikon('yol') + 'Km Desteği</b><small>' + (arac === 'car' ? 'Arabalı' : 'Motorlu') + ' kurye, km başına</small></span>' +
                '<label class="hs-girdi-kap hs-girdi-kap--fiyat"><input class="hs-girdi" type="text" inputmode="decimal" data-km-fiyat value="' + kacir(kayit.km[arac] != null ? kayit.km[arac] : '') + '" placeholder="0" aria-label="Km başına ücret"><span>₺</span></label></div>' +
            '<div class="hs-pano__satir hs-pano__satir--dikey"><span class="hs-pano__ad"><b>Hesaba Giren Kalemler</b><small>Kapalı kalem listede ve tutarda görünmez</small></span><div class="hs-cipler">' +
                TURLER.map(function (t) {
                    return '<button type="button" class="hs-secim" data-tur-gizle="' + t.k + '" aria-pressed="' + !kayit.gizli[t.k] + '">' + ikon(t.ikon) + kacir(t.ad) + '</button>';
                }).join('') + '</div></div>' +
            '<div class="hs-pano__alt"><button type="button" class="hs-dugme" data-fiyat-kopyala>' + ikon('katman') + '<span>' + (arac === 'car' ? 'Motorlu fiyatlarını buraya kopyala' : 'Bu fiyatları Arabalıya kopyala') + '</span></button></div>';
    }

    function fiyatAc() {
        fiyatCiz();
        el('hsFiyat').hidden = false;
        document.body.classList.add('hs-kilit');
        var ilk = el('hsFiyatGovde').querySelector('input');
        if (ilk && matchMedia('(pointer: fine)').matches) ilk.focus();
    }
    function fiyatKapat() {
        el('hsFiyat').hidden = true;
        document.body.classList.remove('hs-kilit');
        kaydet(true);
        listeCiz();
        ozetCiz();
    }

    // ------------------------------------------------------------------
    // Olaylar
    // ------------------------------------------------------------------

    function temizSayi(v, ondalik) {
        var s = String(v).replace(ondalik ? /[^\d,.]/g : /\D/g, '');
        return s.slice(0, ondalik ? 12 : 6);
    }

    var listeZaman = 0;
    function listeGecikmeli() {
        clearTimeout(listeZaman);
        listeZaman = setTimeout(function () { listeCiz(); ozetCiz(); }, 120);
    }

    function olaylar() {
        el('hsAyGeri').addEventListener('click', function () { ayDegis(ayKaydir(d.ay, -1)); });
        el('hsAyIleri').addEventListener('click', function () { if (d.ay < bugun().slice(0, 7)) ayDegis(ayKaydir(d.ay, 1)); });
        el('hsYenile').addEventListener('click', function () { yukle(true); });
        el('hsFiyatAc').addEventListener('click', fiyatAc);
        el('hsKopyala').addEventListener('click', ozetKopyala);
        el('hsAra').addEventListener('input', function (e) { d.ara = e.target.value.trim(); listeCiz(); });
        el('hsSira').addEventListener('click', function (e) {
            var b = e.target.closest('[data-sira]');
            if (!b) return;
            d.sira = b.getAttribute('data-sira');
            el('hsSira').querySelectorAll('[data-sira]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
            listeCiz();
        });
        document.addEventListener('click', function (e) {
            if (e.target.closest('[data-fiyat-ac]')) fiyatAc();
            if (e.target.closest('[data-yenile]')) yukle(true);
        });

        var liste = el('hsListe');
        liste.addEventListener('click', function (e) {
            var art = e.target.closest('.hs-k');
            if (!art) return;
            var id = art.getAttribute('data-id');
            var b;
            if (e.target.closest('[data-ac]')) {
                if (d.acik.has(id)) d.acik.delete(id); else d.acik.add(id);
                kuryeYenidenCiz(id);
                return;
            }
            if ((b = e.target.closest('[data-arac]'))) {
                kuryeKalici(id, true).arac = b.getAttribute('data-arac');
                kaydet(); kuryeYenidenCiz(id); return;
            }
            if ((b = e.target.closest('[data-not-yon]'))) {
                var v = d.veri.get(d.ay);
                var k = v.kuryeler.filter(function (x) { return x.id === id; })[0];
                var notlar = notListesi();
                var simdi = hesapla(k, v).not;
                var i = simdi ? notlar.indexOf(simdi) : notlar.length;
                var j = Math.max(0, Math.min(notlar.length - 1, i + Number(b.getAttribute('data-not-yon'))));
                var s = kuryeAyi(id, true);
                if (notlar[j] === k.not) delete s.not; else s.not = notlar[j];
                kaydet(); kuryeYenidenCiz(id); return;
            }
            if (e.target.closest('[data-not-sifirla]')) { delete kuryeAyi(id, true).not; kaydet(); kuryeYenidenCiz(id); return; }
            if (e.target.closest('[data-km-g10]')) { delete kuryeAyi(id, true).km; kaydet(); kuryeYenidenCiz(id); return; }
            if ((b = e.target.closest('[data-coz]'))) {
                delete ayKaydi(true).bagli[b.getAttribute('data-coz')];
                kaydet(); listeCiz(); ozetCiz(); return;
            }
            if ((b = e.target.closest('[data-avans-sil]'))) {
                var s2 = kuryeAyi(id, true);
                if (Array.isArray(s2.avans)) s2.avans.splice(Number(b.getAttribute('data-avans-sil')), 1);
                kaydet(); kuryeYenidenCiz(id); return;
            }
            if (e.target.closest('[data-avans-ekle]')) avansEkle(art, id);
        });
        liste.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            if (e.target.matches('[data-avans-tutar], [data-avans-not]')) {
                e.preventDefault();
                var art = e.target.closest('.hs-k');
                avansEkle(art, art.getAttribute('data-id'));
            }
        });
        liste.addEventListener('input', function (e) {
            var art = e.target.closest('.hs-k');
            if (!art) return;
            var id = art.getAttribute('data-id');
            var t = e.target;
            if (t.matches('[data-ek]')) {
                var eksi = /^-/.test(t.value);
                var deger = (eksi ? '-' : '') + temizSayi(t.value, false);
                if (deger !== t.value) t.value = deger;
                var s = kuryeAyi(id, true);
                s.ek = nesne(s.ek);
                if (deger === '' || deger === '-') delete s.ek[t.getAttribute('data-ek')]; else s.ek[t.getAttribute('data-ek')] = Number(deger);
                kaydet(); rakamYaz(art); return;
            }
            if (t.matches('[data-km]')) {
                var km = temizSayi(t.value, true);
                if (km !== t.value) t.value = km;
                var s3 = kuryeAyi(id, true);
                if (km === '') delete s3.km; else s3.km = km;
                kaydet(); rakamYaz(art); return;
            }
            if (t.matches('[data-avans-tutar]')) {
                var a = temizSayi(t.value, true);
                if (a !== t.value) t.value = a;
            }
        });
        liste.addEventListener('change', function (e) {
            var art = e.target.closest('.hs-k');
            if (!art) return;
            var id = art.getAttribute('data-id');
            if (e.target.matches('[data-km-destek]')) {
                kuryeKalici(id, true).km = e.target.checked;
                kaydet(); kuryeYenidenCiz(id); return;
            }
            if (e.target.matches('[data-bagla]') && e.target.value) {
                var ikinci = e.target.value;
                var a = ayKaydi(true);
                a.bagli[ikinci] = id;
                d.acik.delete(ikinci);
                kaydet(); listeCiz(); ozetCiz();
                bildir('Hesap bağlandı', 'basari');
            }
        });

        var perde = el('hsFiyat');
        perde.addEventListener('click', function (e) {
            if (e.target === perde || e.target.closest('[data-kapat]')) { fiyatKapat(); return; }
            var b;
            if ((b = e.target.closest('[data-fiyat-arac]'))) { d.fiyatArac = b.getAttribute('data-fiyat-arac'); fiyatCiz(); return; }
            if ((b = e.target.closest('[data-tur-gizle]'))) {
                var k = b.getAttribute('data-tur-gizle');
                if (kayit.gizli[k]) delete kayit.gizli[k];
                else if (gorunenTurler().length > 1) kayit.gizli[k] = true;
                kaydet(); fiyatCiz(); return;
            }
            if (e.target.closest('[data-fiyat-kopyala]')) {
                var kaynak = d.fiyatArac === 'car' ? 'moto' : d.fiyatArac;
                var hedef = kaynak === 'moto' ? 'car' : 'moto';
                kayit.fiyat[hedef] = JSON.parse(JSON.stringify(nesne(kayit.fiyat[kaynak])));
                if (kayit.km[kaynak] != null) kayit.km[hedef] = kayit.km[kaynak];
                kaydet();
                if (d.fiyatArac === 'moto') { d.fiyatArac = 'car'; }
                fiyatCiz();
                bildir('Motorlu fiyatları Arabalıya kopyalandı', 'basari');
            }
        });
        perde.addEventListener('input', function (e) {
            var t = e.target;
            if (!t.matches('[data-fiyat], [data-km-fiyat]')) return;
            var deger = temizSayi(t.value, true);
            if (deger !== t.value) t.value = deger;
            var arac = d.fiyatArac;
            if (t.matches('[data-km-fiyat]')) {
                if (deger === '') delete kayit.km[arac]; else kayit.km[arac] = deger;
            } else {
                var p = t.getAttribute('data-fiyat').split('|');
                kayit.fiyat[arac] = nesne(kayit.fiyat[arac]);
                var satir = kayit.fiyat[arac][p[0]] = nesne(kayit.fiyat[arac][p[0]]);
                if (deger === '') delete satir[p[1]]; else satir[p[1]] = deger;
            }
            kaydet();
            listeGecikmeli();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !perde.hidden) fiyatKapat(); });
        addEventListener('pagehide', function () { kaydet(true); });
    }

    function avansEkle(art, id) {
        var t = art.querySelector('[data-avans-tutar]');
        var n = art.querySelector('[data-avans-not]');
        var tutar = num(t && t.value);
        if (!(tutar > 0)) { if (t) t.focus(); bildir('Avans tutarını yaz', 'uyari'); return; }
        var s = kuryeAyi(id, true);
        if (!Array.isArray(s.avans)) s.avans = [];
        s.avans.push({ tutar: Math.round(tutar * 100) / 100, not: (n && n.value.trim().slice(0, 60)) || '', tarih: bugun() });
        kaydet();
        kuryeYenidenCiz(id);
        var yeni = el('hsListe').querySelector('.hs-k[data-id="' + id + '"] [data-avans-tutar]');
        if (yeni) yeni.focus();
    }

    function ozetKopyala() {
        var v = d.veri.get(d.ay);
        if (!v) return;
        var toplam = 0;
        var satirlar = anaKuryeler(v).map(function (k) { return { k: k, h: hesapla(k, v) }; })
            .sort(function (a, b) { return b.h.net - a.h.net; })
            .map(function (x) {
                toplam += x.h.net;
                return x.k.ad + ': ' + para(x.h.net) + (x.h.avans ? ' (avans ' + para(x.h.avans) + ' düşüldü)' : '');
            });
        var metin = ayAdi(d.ay) + ' hak ediş\n' + satirlar.join('\n') + '\nToplam: ' + para(toplam);
        var bitti = function () { bildir('Özet kopyalandı', 'basari'); };
        if (navigator.clipboard && global.isSecureContext) navigator.clipboard.writeText(metin).then(bitti, function () { bildir('Kopyalanamadı', 'hata'); });
        else {
            var ta = document.createElement('textarea');
            ta.value = metin;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); bitti(); } catch (e) { bildir('Kopyalanamadı', 'hata'); }
            ta.remove();
        }
    }

    function ayDegis(ay) {
        d.ay = ay;
        d.acik.clear();
        d.hata = null;
        hepsiniCiz();
        yukle(false);
    }

    var istekNo = 0;
    async function yukle(zorla) {
        var no = ++istekNo;
        var ay = d.ay;
        if (!zorla && d.veri.has(ay)) { hepsiniCiz(); return; }
        d.yukleniyor = true;
        d.hata = null;
        if (zorla) d.veri.delete(ay);
        hepsiniCiz();
        try {
            await veriAl(ay, zorla);
            if (no !== istekNo) return;
            d.yukleniyor = false;
        } catch (e) {
            if (no !== istekNo) return;
            d.yukleniyor = false;
            d.hata = e;
        }
        hepsiniCiz();
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
        if (!o || !o.username) { bolum('hsGiris'); return; }
        d.kim = o.username;
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;

        kayit = kayitOku();
        d.ay = varsayilanAy();
        bolum('hsIcerik');
        hepsiniCiz();

        var p = await haklariYukle();
        if (!d.ornek && !(p && p.checkPremiumFeature(HAK))) { bolum('hsYetkiYok'); return; }
        olaylar();
        yukle(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
