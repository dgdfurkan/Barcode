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
        kilit: '<rect x="4.5" y="9" width="11" height="8.5" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>',
        tamam: '<path d="m5 10.5 3.5 3.5L15 7"/>',
        karistir: '<path d="M3 6h3.5l7 8H17M3 14h3.5l2-2.3M11.5 8.3l2-2.3H17"/><path d="m15 4 2 2-2 2M15 12l2 2-2 2"/>',
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
        sira: 'ad',
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

    /* Panelden alınan aylık liste: Yenile'ye basılınca alınır, sonra bu cihazda
       tutulur; sayfa her açılışta panele gitmez. En çok son 6 ay. */
    var VERI_AY = 6;
    function veriAnahtari() { return 'jb_hesaplama_veri:' + (d.kim || 'misafir'); }
    function veriOku() {
        var o = null;
        try { o = JSON.parse(localStorage.getItem(veriAnahtari()) || 'null'); } catch (e) { o = null; }
        o = nesne(o);
        Object.keys(o).forEach(function (ay) {
            var v = o[ay];
            if (/^\d{4}-\d{2}$/.test(ay) && v && Array.isArray(v.kuryeler)) d.veri.set(ay, v);
        });
    }
    function veriYaz() {
        if (d.ornek) return;
        var aylar = Array.from(d.veri.keys()).sort().slice(-VERI_AY);
        var o = {};
        aylar.forEach(function (ay) { o[ay] = d.veri.get(ay); });
        try { localStorage.setItem(veriAnahtari(), JSON.stringify(o)); }
        catch (e) { bildir('Panel verisi bu cihaza kaydedilemedi: tarayıcı belleği dolu', 'uyari'); }
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
        veriYaz();
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

    function bolum(id) { ['hsGiris', 'hsYetkiYok', 'hsKilit', 'hsIcerik'].forEach(function (x) { el(x).hidden = x !== id; }); }

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
            var t = new Date(v.zaman).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            metin = (d.ornek ? 'Örnek veri' : 'Panelden alındı') + ' · ' + t + ' · ' + v.kuryeler.length + ' kurye';
            tur = 'tamam';
        } else { metin = 'Bu ayın verisi henüz alınmadı'; tur = ''; }
        kutu.setAttribute('data-tur', tur);
        el('hsDurumMetin').textContent = metin;
        el('hsYenile').disabled = d.yukleniyor;
        el('hsYenile').querySelector('span').textContent = v ? 'Yenile' : 'Panelden Al';
    }

    /* Üstte toplam kutusu yok (kullanıcı istemedi); toplam tablonun alt satırında */
    function ozetCiz() {
        el('hsFiyatUyari').hidden = !d.veri.get(d.ay) || fiyatVarMi();
        altCiz();
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

    function fiyatYazi(f) { return '×' + (Math.round(f * 100) / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 }); }

    function sutunSayisi() { return gorunenTurler().length + 5; }

    function listeCiz() {
        var kutu = el('hsListe');
        var v = d.veri.get(d.ay);
        if (!v) {
            if (d.hata) {
                kutu.innerHTML = '<div class="hs-bos">' + ikon('kurye') + '<strong>Kurye verisi alınamadı</strong><p>' + kacir(hataMetni(d.hata)) + '</p><button type="button" class="hs-dugme" data-yenile>' + ikon('geri') + '<span>Tekrar Dene</span></button></div>';
            } else if (!d.yukleniyor) {
                kutu.innerHTML = '<div class="hs-bos">' + ikon('kurye') + '<strong>' + kacir(ayAdi(d.ay)) + ' verisi alınmadı</strong><p>Kurye paketleri, not ve km panelden bir kez alınır, sonra bu cihazda durur. Güncellemek istediğinde Yenile\'ye basarsın.</p><button type="button" class="hs-dugme hs-dugme--ana" data-yenile>' + ikon('geri') + '<span>Panelden Al</span></button></div>';
            } else {
                kutu.innerHTML = '<div class="hs-t-kap"><table class="hs-t">' + basHtml() + '<tbody>' +
                    [0, 1, 2, 3, 4].map(function () { return '<tr class="hs-t__iskelet"><td colspan="' + sutunSayisi() + '"><span class="hs-iskelet"></span></td></tr>'; }).join('') +
                    '</tbody></table></div>';
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
            if (d.sira === 'net') return b.h.net - a.h.net;
            if (d.sira === 'paket') return b.h.paket - a.h.paket;
            if (d.sira === 'puan') return (b.k.cdi == null ? -1 : b.k.cdi) - (a.k.cdi == null ? -1 : a.k.cdi);
            return a.k.ad.localeCompare(b.k.ad, 'tr');
        });
        kutu.innerHTML = '<div class="hs-t-kap"><table class="hs-t">' + basHtml() + '<tbody>' +
            (satirlar.length ? satirlar.map(function (x) { return satirHtml(x.k, x.h); }).join('')
                : '<tr><td colspan="' + sutunSayisi() + '" class="hs-t__bos">Eşleşen kurye yok</td></tr>') +
            '</tbody><tfoot></tfoot></table></div>';
        altCiz();
    }

    function basHtml() {
        return '<thead><tr><th class="hs-t__kurye">Kurye</th>' +
            gorunenTurler().map(function (t) { return '<th>' + kacir(t.ad) + '</th>'; }).join('') +
            '<th>Km Desteği</th><th>Avans</th><th class="hs-t__toplam">Toplam</th><th>Not</th></tr></thead>';
    }

    function satirHtml(k, h) {
        var s = kuryeAyi(k.id, false);
        var foto = k.foto
            ? '<img class="hs-av" src="' + kacir(k.foto) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'hs-av hs-av--bas\',textContent:' + kacir(JSON.stringify(bas(k.ad))) + '}))">'
            : '<span class="hs-av hs-av--bas">' + kacir(bas(k.ad)) + '</span>';
        var arac = ARACLAR.filter(function (a) { return a.k === h.arac; })[0];
        var kurye = '<td class="hs-t__kurye"><div class="hs-kurye">' + foto +
            '<div class="hs-kurye__ad"><strong title="' + kacir(k.ad) + '">' + kacir(k.ad) + '</strong><span class="hs-kurye__araclar">' +
                '<button type="button" class="hs-mini" data-arac-degis title="' + arac.ad + ' · değiştirmek için dokun" aria-label="Araç: ' + arac.ad + '">' + ikon(arac.ikon) + '</button>' +
                '<button type="button" class="hs-mini' + (h.bagli.length ? ' is-on' : '') + '" data-bagla-ac title="Başka hesap bağla" aria-label="Başka hesap">' + ikon('karistir') + (h.bagli.length ? '<b>' + h.bagli.length + '</b>' : '') + '</button>' +
            '</span></div></div></td>';

        var hucreler = h.satirlar.map(function (r) {
            var elle = r.ek !== 0;
            var baslik = (r.t.alan ? 'Panel ' + adet(r.kendi) : 'Panel vermiyor') + (r.diger ? ' · bağlı hesap ' + adet(r.diger) : '') + (elle ? ' · elle ' + (r.ek > 0 ? '+' : '') + r.ek : '');
            return '<td><div class="hs-hucre">' +
                '<input class="hs-sayi' + (elle ? ' is-elle' : '') + (r.diger ? ' is-bagli' : '') + '" type="text" inputmode="numeric" data-say="' + r.t.k + '" value="' + (r.toplam || (r.t.alan ? 0 : '')) + '" placeholder="–" title="' + kacir(baslik) + '" aria-label="' + kacir(k.ad + ' ' + r.t.ad) + '">' +
                '<small data-o="f-' + r.t.k + '">' + fiyatYazi(r.fiyat) + '</small></div></td>';
        }).join('');

        var kmDeger = h.kmDestek ? (h.elleKm ? s.km : String(h.g10).replace('.', ',')) : '';
        var km = '<td><div class="hs-hucre"><div class="hs-km2">' +
            '<input class="hs-sayi hs-sayi--km' + (h.elleKm ? ' is-elle' : '') + '" type="text" inputmode="decimal" data-km value="' + kacir(kmDeger) + '" placeholder="–" aria-label="' + kacir(k.ad) + ' km desteği">' +
            '<button type="button" class="hs-g10" data-g10 aria-pressed="' + h.kmDestek + '" title="' + (h.kmDestek ? 'Km desteği açık · kapatmak için dokun' : 'G10 ' + adet(h.g10) + ' km · km desteğine yazmak için dokun') + '">' + ikon('yol') + '</button>' +
            '</div><small>G10 ' + adet(h.g10) + '</small></div></td>';

        var avans = '<td><div class="hs-hucre"><button type="button" class="hs-avans-d' + (h.avans ? ' is-var' : '') + '" data-avans-ac aria-label="' + kacir(k.ad) + ' avans">' +
            (h.avans ? '−' + para(h.avans) : ikon('arti')) + '</button>' +
            '<small>' + (h.avanslar.length > 1 ? h.avanslar.length + ' avans' : '&nbsp;') + '</small></div></td>';

        var toplam = '<td class="hs-t__toplam"><div class="hs-hucre"><strong data-o="net">' + para(h.net) + '</strong><small data-o="paket">' + adet(h.paket) + ' paket</small></div></td>';

        var notlar = notListesi();
        var i = h.not ? notlar.indexOf(h.not) : notlar.length;
        var not = '<td><div class="hs-notkol">' +
            '<button type="button" class="hs-ok" data-not-yon="-1" aria-label="Notu yükselt"' + (i <= 0 ? ' disabled' : '') + '>' + ikon('yukari') + '</button>' +
            '<button type="button" class="hs-not hs-not--' + notSinif(h.not) + (h.yukseltildi ? ' is-degisti' : '') + '"' + (h.yukseltildi ? ' data-not-sifirla title="Panel notu ' + kacir(k.not || 'yok') + ' · geri almak için dokun"' : ' title="Panel notu' + (k.cdi != null ? ' · CDI %' + kacir(String(Math.round(k.cdi * 10) / 10).replace('.', ',')) : '') + '"') + '>' + kacir(h.not || '–') + '</button>' +
            '<button type="button" class="hs-ok" data-not-yon="1" aria-label="Notu düşür"' + (!h.not || i >= notlar.length - 1 ? ' disabled' : '') + '>' + ikon('asagi') + '</button>' +
            '</div></td>';

        return '<tr data-id="' + kacir(k.id) + '">' + kurye + hucreler + km + avans + toplam + not + '</tr>';
    }

    function altCiz() {
        var v = d.veri.get(d.ay);
        var ayak = el('hsListe').querySelector('tfoot');
        if (!v || !ayak) return;
        var turler = gorunenTurler();
        var t = { say: {}, km: 0, kmTutar: 0, avans: 0, net: 0, paket: 0, kurye: 0 };
        turler.forEach(function (x) { t.say[x.k] = 0; });
        anaKuryeler(v).forEach(function (k) {
            var h = hesapla(k, v);
            h.satirlar.forEach(function (r) { t.say[r.t.k] += r.toplam; });
            t.km += h.km; t.kmTutar += h.kmTutar; t.avans += h.avans; t.net += h.net; t.paket += h.paket; t.kurye++;
        });
        ayak.innerHTML = '<tr><td class="hs-t__kurye"><div class="hs-hucre hs-hucre--sol"><strong>Toplam</strong><small>' + t.kurye + ' kurye</small></div></td>' +
            turler.map(function (x) { return '<td><div class="hs-hucre"><strong>' + adet(t.say[x.k]) + '</strong><small>&nbsp;</small></div></td>'; }).join('') +
            '<td><div class="hs-hucre"><strong>' + para(t.kmTutar) + '</strong><small>' + adet(t.km) + ' km</small></div></td>' +
            '<td><div class="hs-hucre"><strong class="' + (t.avans ? 'eksi' : '') + '">' + (t.avans ? '−' : '') + para(t.avans) + '</strong><small>&nbsp;</small></div></td>' +
            '<td class="hs-t__toplam"><div class="hs-hucre"><strong>' + para(t.net) + '</strong><small>' + adet(t.paket) + ' paket</small></div></td><td></td></tr>';
    }

    function kuryeBul(id) {
        var v = d.veri.get(d.ay);
        return v ? v.kuryeler.filter(function (x) { return x.id === id; })[0] : null;
    }

    /* Yazarken yalnız rakamlar değişir; girdi yeniden çizilmez, odak kaçmaz */
    function rakamYaz(tr) {
        var v = d.veri.get(d.ay);
        var k = kuryeBul(tr.getAttribute('data-id'));
        if (!k) return;
        var h = hesapla(k, v);
        var yaz = function (o, m) { var e = tr.querySelector('[data-o="' + o + '"]'); if (e) e.textContent = m; };
        yaz('net', para(h.net));
        yaz('paket', adet(h.paket) + ' paket');
        h.satirlar.forEach(function (r) {
            var g = tr.querySelector('[data-say="' + r.t.k + '"]');
            if (g) g.classList.toggle('is-elle', r.ek !== 0);
        });
        altCiz();
    }

    function satirYenidenCiz(id) {
        var v = d.veri.get(d.ay);
        var tr = el('hsListe').querySelector('tr[data-id="' + id + '"]');
        var k = kuryeBul(id);
        if (!tr || !k) { listeCiz(); ozetCiz(); return; }
        var t = document.createElement('tbody');
        t.innerHTML = satirHtml(k, hesapla(k, v));
        tr.replaceWith(t.firstChild);
        altCiz();
    }

    function hepsiniCiz() { donemCiz(); durumCiz(); listeCiz(); ozetCiz(); }

    // ------------------------------------------------------------------
    // Kilit: her açılışta şifre (yalnız bu cihazda)
    // ------------------------------------------------------------------
    /*
     * İlk girişte şifre sorulmaz, belirlenir; yanında bir hafıza kartı seçilir.
     * Şifre unutulursa doğru kart seçilince yeni şifre yazılır. Şifrenin kendisi
     * saklanmaz: PBKDF2 (SHA-256, 120 bin tur) özeti ve tuzu localStorage'da.
     * Bu bir cihaz kilidi; sunucuya hiçbir şey gitmez.
     */
    var KARTLAR = [
        { k: 'motor', ad: 'Motor', renk: '#2563eb', zemin: '#eff4ff', yol: '<circle cx="6" cy="16.5" r="3"/><circle cx="18" cy="16.5" r="3"/><path d="M6 16.5h5.5l3.5-6H18l-3 6M12.5 6.5H15l1.2 4"/>' },
        { k: 'kahve', ad: 'Kahve', renk: '#92400e', zemin: '#fdf3e7', yol: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M9 3.5c-.8 1 .8 2 0 3M12.5 3.5c-.8 1 .8 2 0 3"/>' },
        { k: 'yildiz', ad: 'Yıldız', renk: '#d97706', zemin: '#fff7e6', yol: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>' },
        { k: 'ev', ad: 'Ev', renk: '#0e9f6e', zemin: '#ecfdf5', yol: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>' },
        { k: 'kalp', ad: 'Kalp', renk: '#d92d20', zemin: '#fef3f2', yol: '<path d="M12 19.5s-7.5-4.4-7.5-10a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 5.6-7.5 10-7.5 10z"/>' },
        { k: 'anahtar', ad: 'Anahtar', renk: '#7c3aed', zemin: '#f4f0ff', yol: '<circle cx="8" cy="12" r="4"/><path d="M12 12h8.5M17.5 12v3M20.5 12v2"/>' },
        { k: 'agac', ad: 'Ağaç', renk: '#047857', zemin: '#ecfdf3', yol: '<path d="M12 3.5 6 12h3l-3.5 5h13L15 12h3z"/><path d="M12 17v3.5"/>' },
        { k: 'balik', ad: 'Balık', renk: '#0891b2', zemin: '#ecfeff', yol: '<path d="M3.5 12c2.5-3.8 6-5.5 9.5-5.5 3 0 5.5 2 7 5.5-1.5 3.5-4 5.5-7 5.5-3.5 0-7-1.7-9.5-5.5z"/><path d="M3.5 12 1.8 9M3.5 12l-1.7 3"/><circle cx="16" cy="11" r="0.9"/>' },
        { k: 'ay', ad: 'Ay', renk: '#334155', zemin: '#f1f5f9', yol: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>' }
    ];
    var KILIT_IKON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2.5"/></svg>';
    var EN_AZ_SIFRE = 4;
    var YANLIS_KART_SINIRI = 3;
    var kilitCoz = null;
    var kilitMod = '';
    var kartSecim = '';

    function kilitAnahtari() { return 'jb_hesaplama_kilit:' + (d.kim || 'misafir'); }
    function kilitOku() {
        var o = null;
        try { o = JSON.parse(localStorage.getItem(kilitAnahtari()) || 'null'); } catch (e) { o = null; }
        return o && o.ozet && o.tuz && o.kart ? o : null;
    }
    function kilitYaz(o) {
        try { localStorage.setItem(kilitAnahtari(), JSON.stringify(o)); return true; }
        catch (e) { bildir('Şifre kaydedilemedi: tarayıcı belleği dolu', 'hata'); return false; }
    }

    function onaltilik(tampon) {
        return Array.prototype.map.call(new Uint8Array(tampon), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    async function sifreOzeti(sifre, tuz) {
        var kod = new TextEncoder();
        var anahtar = await crypto.subtle.importKey('raw', kod.encode(sifre), 'PBKDF2', false, ['deriveBits']);
        var bit = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: kod.encode(tuz), iterations: 120000, hash: 'SHA-256' }, anahtar, 256);
        return onaltilik(bit);
    }
    function yeniTuz() { var a = new Uint8Array(16); crypto.getRandomValues(a); return onaltilik(a.buffer); }

    async function sifreKaydet(sifre, kart) {
        var tuz = yeniTuz();
        return kilitYaz({ s: 1, tuz: tuz, ozet: await sifreOzeti(sifre, tuz), kart: kart });
    }
    async function sifreDogruMu(sifre) {
        var k = kilitOku();
        return !!k && (await sifreOzeti(sifre, k.tuz)) === k.ozet;
    }

    function kartHtml(secili, karisik) {
        var liste = KARTLAR.slice();
        if (karisik) for (var i = liste.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = liste[i]; liste[i] = liste[j]; liste[j] = t; }
        return '<div class="hs-kartlar" role="radiogroup" aria-label="Hafıza kartı">' + liste.map(function (x) {
            return '<button type="button" role="radio" class="hs-kartim" data-kart="' + x.k + '" aria-checked="' + (secili === x.k) + '" style="--k-renk:' + x.renk + ';--k-zemin:' + x.zemin + '">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true">' + x.yol + '</svg><span>' + x.ad + '</span></button>';
        }).join('') + '</div>';
    }

    function sifreAlanlari(ikinci) {
        return '<label class="hs-sifre"><input type="password" data-sifre="1" autocomplete="new-password" placeholder="' + (ikinci ? 'Yeni şifre' : 'Şifre') + '" aria-label="Şifre" minlength="' + EN_AZ_SIFRE + '" maxlength="64"></label>' +
            '<label class="hs-sifre"><input type="password" data-sifre="2" autocomplete="new-password" placeholder="Şifre tekrar" aria-label="Şifre tekrar" maxlength="64"></label>';
    }

    function kilitCiz(mod, mesaj) {
        kilitMod = mod;
        var k = el('hsKilitKart');
        var kayitli = kilitOku();
        var bekleme = kayitli && kayitli.kilitKadar && kayitli.kilitKadar > Date.now() ? Math.ceil((kayitli.kilitKadar - Date.now()) / 1000) : 0;
        var hata = '<p class="hs-kilit__hata" data-hata>' + kacir(mesaj || '') + '</p>';
        if (mod === 'ac') {
            k.innerHTML = '<span class="hs-kilit__im">' + KILIT_IKON + '</span>' +
                '<h1>Hesaplama Kilitli</h1><p>Devam etmek için şifreni gir.</p>' +
                '<form class="hs-kilit__form" data-form="ac" novalidate>' +
                    '<label class="hs-sifre"><input type="password" data-sifre="ac" autocomplete="current-password" placeholder="Şifre" aria-label="Şifre" maxlength="64"></label>' +
                    hata + '<button type="submit" class="hs-dugme hs-dugme--ana hs-dugme--tam">Aç</button>' +
                '</form>' +
                '<button type="button" class="hs-kilit__bag" data-mod="unuttum">Şifremi Unuttum</button>';
        } else if (mod === 'kur' || mod === 'yeni') {
            kartSecim = mod === 'yeni' && kayitli ? kayitli.kart : '';
            k.innerHTML = '<span class="hs-kilit__im">' + KILIT_IKON + '</span>' +
                '<h1>' + (mod === 'kur' ? 'Şifre Belirle' : 'Yeni Şifre') + '</h1>' +
                '<p>' + (mod === 'kur' ? 'Hesaplama bundan sonra her açılışta bu şifreyi sorar. Şifre yalnız bu cihazda tutulur.' : 'Hafıza kartın doğru. Yeni şifreni yaz.') + '</p>' +
                '<form class="hs-kilit__form" data-form="' + mod + '" novalidate>' + sifreAlanlari(mod === 'yeni') +
                    (mod === 'kur' ? '<div class="hs-kilit__kart"><b>Hafıza Kartı</b><small>Şifreni unutursan bu kartı seçerek sıfırlarsın. Aklında kalacak birini seç.</small>' + kartHtml('', false) + '</div>' : '') +
                    hata + '<button type="submit" class="hs-dugme hs-dugme--ana hs-dugme--tam">' + (mod === 'kur' ? 'Kaydet ve Aç' : 'Şifreyi Kaydet') + '</button>' +
                '</form>';
        } else {
            k.innerHTML = '<span class="hs-kilit__im hs-kilit__im--sari">' + KILIT_IKON + '</span>' +
                '<h1>Hafıza Kartın Hangisi?</h1><p>Şifreyi belirlerken seçtiğin kartı bul. Doğru kartla yeni şifre yazarsın.</p>' +
                (bekleme ? '<p class="hs-kilit__hata">Çok fazla yanlış deneme. ' + bekleme + ' sn sonra tekrar dene.</p>' : kartHtml('', true) + hata) +
                '<button type="button" class="hs-kilit__bag" data-mod="ac">Şifreyi Hatırladım</button>';
            if (bekleme) setTimeout(function () { if (kilitMod === 'unuttum') kilitCiz('unuttum'); }, Math.min(bekleme, 60) * 1000);
        }
        var ilk = k.querySelector('input');
        if (ilk) ilk.focus();
    }

    function hataYaz(m) {
        var h = el('hsKilitKart').querySelector('[data-hata]');
        if (!h) return;
        h.textContent = m;
        var kart = el('hsKilitKart');
        kart.classList.remove('is-salla');
        void kart.offsetWidth;
        kart.classList.add('is-salla');
    }

    function yeniSifreOku(kap) {
        var a = kap.querySelector('[data-sifre="1"]').value;
        var b = kap.querySelector('[data-sifre="2"]').value;
        if (a.length < EN_AZ_SIFRE) return { hata: 'Şifre en az ' + EN_AZ_SIFRE + ' karakter olmalı.' };
        if (a !== b) return { hata: 'İki şifre aynı değil.' };
        return { sifre: a };
    }

    function kilitAcildi() {
        var c = kilitCoz;
        kilitCoz = null;
        el('hsKilitKart').innerHTML = '';
        if (c) c();
    }

    function kilitOlaylari() {
        var k = el('hsKilitKart');
        k.addEventListener('click', function (e) {
            var b = e.target.closest('[data-mod]');
            if (b) { kilitCiz(b.getAttribute('data-mod')); return; }
            var kart = e.target.closest('[data-kart]');
            if (!kart) return;
            if (kilitMod === 'kur') {
                kartSecim = kart.getAttribute('data-kart');
                k.querySelectorAll('[data-kart]').forEach(function (x) { x.setAttribute('aria-checked', String(x === kart)); });
                return;
            }
            if (kilitMod !== 'unuttum') return;
            var kayitli = kilitOku();
            if (!kayitli) { kilitCiz('kur'); return; }
            if (kart.getAttribute('data-kart') === kayitli.kart) {
                delete kayitli.yanlis; delete kayitli.kilitKadar;
                kilitYaz(kayitli);
                kilitCiz('yeni');
                return;
            }
            kayitli.yanlis = (kayitli.yanlis || 0) + 1;
            if (kayitli.yanlis >= YANLIS_KART_SINIRI) { kayitli.yanlis = 0; kayitli.kilitKadar = Date.now() + 60000; }
            kilitYaz(kayitli);
            if (kayitli.kilitKadar && kayitli.kilitKadar > Date.now()) kilitCiz('unuttum');
            else hataYaz('Bu kart değil. ' + (YANLIS_KART_SINIRI - kayitli.yanlis) + ' deneme hakkın kaldı.');
        });
        k.addEventListener('submit', async function (e) {
            e.preventDefault();
            var form = e.target;
            var tur = form.getAttribute('data-form');
            var dugme = form.querySelector('[type="submit"]');
            dugme.disabled = true;
            try {
                if (tur === 'ac') {
                    var g = form.querySelector('[data-sifre="ac"]');
                    if (!g.value) { hataYaz('Şifreni yaz.'); return; }
                    if (await sifreDogruMu(g.value)) { kilitAcildi(); return; }
                    g.value = '';
                    g.focus();
                    hataYaz('Şifre yanlış.');
                    return;
                }
                var y = yeniSifreOku(form);
                if (y.hata) { hataYaz(y.hata); return; }
                if (tur === 'kur' && !kartSecim) { hataYaz('Bir hafıza kartı seç.'); return; }
                var kart = tur === 'kur' ? kartSecim : (kilitOku() || {}).kart || kartSecim;
                if (await sifreKaydet(y.sifre, kart)) {
                    bildir(tur === 'kur' ? 'Şifre belirlendi' : 'Yeni şifre kaydedildi', 'basari');
                    kilitAcildi();
                }
            } finally {
                if (dugme.isConnected) dugme.disabled = false;
            }
        });
    }

    function kilitIste() {
        return new Promise(function (coz) {
            kilitCoz = coz;
            bolum('hsKilit');
            kilitOlaylari();
            if (!(global.crypto && crypto.subtle)) {
                /* Güvenli bağlam yoksa (http) özet alınamaz; kilit kurulamaz */
                el('hsKilitKart').innerHTML = '<span class="hs-kilit__im hs-kilit__im--sari">' + KILIT_IKON + '</span><h1>Kilit kullanılamıyor</h1><p>Tarayıcı bu adreste şifreleme izni vermiyor. Siteyi https ile aç.</p>';
                return;
            }
            kilitCiz(kilitOku() ? 'ac' : 'kur');
        });
    }

    /* Ayarlar > Şifreyi Değiştir (kutu) */
    function sifreKutusuHtml() {
        var kayitli = kilitOku();
        kartSecim = kayitli ? kayitli.kart : '';
        return '<form class="hs-kilit__form" data-form="degis" novalidate>' +
            '<label class="hs-sifre"><input type="password" data-sifre="eski" autocomplete="current-password" placeholder="Şu anki şifre" aria-label="Şu anki şifre" maxlength="64"></label>' +
            sifreAlanlari(true) +
            '<div class="hs-kilit__kart"><b>Hafıza Kartı</b><small>İstersen kartını da değiştir.</small>' + kartHtml(kartSecim, false) + '</div>' +
            '<p class="hs-kilit__hata" data-kutu-hata></p>' +
            '<div class="hs-pano__alt"><button type="button" class="hs-dugme" data-kapat>Vazgeç</button><button type="submit" class="hs-dugme hs-dugme--ana">Kaydet</button></div>' +
            '</form>';
    }

    async function sifreDegistir(form) {
        var h = form.querySelector('[data-kutu-hata]');
        var yaz = function (m) { h.textContent = m; };
        var eski = form.querySelector('[data-sifre="eski"]').value;
        if (!(await sifreDogruMu(eski))) { yaz('Şu anki şifre yanlış.'); return; }
        var y = yeniSifreOku(form);
        if (y.hata) { yaz(y.hata); return; }
        if (await sifreKaydet(y.sifre, kartSecim || (kilitOku() || {}).kart)) {
            kutuKapat();
            bildir('Şifre değiştirildi', 'basari');
        }
    }

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
            '<div class="hs-pano__satir"><span class="hs-pano__ad"><b>' + ikon('kilit') + 'Şifre</b><small>Hesaplama her açılışta şifre sorar. Şifre ve hafıza kartı yalnız bu cihazda.</small></span>' +
                '<button type="button" class="hs-dugme" data-sifre-degis>' + ikon('kilit') + '<span>Şifreyi Değiştir</span></button></div>' +
            '<div class="hs-pano__alt"><button type="button" class="hs-dugme" data-fiyat-kopyala>' + ikon('katman') + '<span>' + (arac === 'car' ? 'Motorlu fiyatlarını buraya kopyala' : 'Bu fiyatları Arabalıya kopyala') + '</span></button></div>';
    }

    function fiyatAc() {
        fiyatCiz();
        el('hsFiyat').hidden = false;
        document.body.classList.add('hs-kaydirma-yok');
        var ilk = el('hsFiyatGovde').querySelector('input');
        if (ilk && matchMedia('(pointer: fine)').matches) ilk.focus();
    }
    function fiyatKapat() {
        el('hsFiyat').hidden = true;
        document.body.classList.remove('hs-kaydirma-yok');
        kaydet(true);
        listeCiz();
        ozetCiz();
    }

    // ------------------------------------------------------------------
    // Avans ve başka hesap kutusu
    // ------------------------------------------------------------------

    var kutuDurum = null;   // { tur: 'avans' | 'bagla' | 'sifirla', id }

    /* Sıfırla: seçilen ayın girdileri. Fiyatlar ayrı (Fiyatlar penceresinde). */
    var SIFIR_SECENEK = [
        { k: 'ek', ikon: 'kutu', ad: 'Paket düzeltmeleri', not: 'Hücreye elle yazılan sayılar panel değerine döner', acik: true },
        { k: 'not', ikon: 'not', ad: 'Not değişiklikleri', not: 'Yükseltilen ya da düşürülen notlar panel notuna döner', acik: true },
        { k: 'km', ikon: 'yol', ad: 'Elle yazılan km', not: 'Km desteği açık kuryelerde G10 km kullanılır', acik: true },
        { k: 'bagli', ikon: 'karistir', ad: 'Bağlı hesaplar', not: 'Bağlanan hesaplar yine ayrı satır olur', acik: false },
        { k: 'avans', ikon: 'cuzdan', ad: 'Avanslar', not: 'Bu ay girilen bütün avanslar silinir', acik: false },
        { k: 'veri', ikon: 'geri', ad: 'Panel verisi', not: 'Bu cihazdaki kopya silinir; Panelden Al ile yeniden alınır', acik: false }
    ];
    var sifirSecim = {};

    function kutuAc(tur, id) {
        kutuDurum = { tur: tur, id: id };
        kutuCiz();
        el('hsKutu').hidden = false;
        document.body.classList.add('hs-kaydirma-yok');
        var g = el('hsKutuGovde').querySelector('input');
        if (g && matchMedia('(pointer: fine)').matches) g.focus();
    }
    function kutuKapat() {
        el('hsKutu').hidden = true;
        document.body.classList.remove('hs-kaydirma-yok');
        kutuDurum = null;
    }

    function kutuCiz() {
        if (!kutuDurum) return;
        if (kutuDurum.tur === 'sifre') {
            el('hsKutuBaslik').textContent = 'Şifreyi Değiştir';
            el('hsKutuAlt').textContent = 'Önce şu anki şifreni yaz.';
            el('hsKutuGovde').innerHTML = sifreKutusuHtml();
            return;
        }
        if (kutuDurum.tur === 'sifirla') {
            el('hsKutuBaslik').textContent = 'Sıfırla';
            el('hsKutuAlt').textContent = ayAdi(d.ay) + ' için neyin silineceğini seç. Fiyatlar ve araç ayarları değişmez.';
            var secili = SIFIR_SECENEK.some(function (x) { return sifirSecim[x.k]; });
            el('hsKutuGovde').innerHTML = '<div class="hs-liste-k">' + SIFIR_SECENEK.map(function (x) {
                return '<button type="button" class="hs-secenek hs-secenek--sec" data-sifir="' + x.k + '" aria-pressed="' + !!sifirSecim[x.k] + '">' +
                    '<span class="hs-secenek__ikon">' + ikon(x.ikon) + '</span><span><b>' + kacir(x.ad) + '</b><small>' + kacir(x.not) + '</small></span>' +
                    '<span class="hs-isaret">' + ikon('tamam') + '</span></button>';
            }).join('') + '</div>' +
                '<div class="hs-pano__alt"><button type="button" class="hs-dugme" data-kapat>Vazgeç</button>' +
                '<button type="button" class="hs-dugme hs-dugme--tehlike" data-sifirla-onay' + (secili ? '' : ' disabled') + '>' + ikon('sil') + '<span>Sıfırla</span></button></div>';
            return;
        }
        var v = d.veri.get(d.ay);
        var k = kuryeBul(kutuDurum.id);
        if (!v || !k) { kutuKapat(); return; }
        var h = hesapla(k, v);
        var g = el('hsKutuGovde');
        if (kutuDurum.tur === 'avans') {
            el('hsKutuBaslik').textContent = 'Avans · ' + k.ad;
            el('hsKutuAlt').textContent = ayAdi(d.ay) + ' hak edişinden düşülür.';
            g.innerHTML =
                (h.avanslar.length ? '<ul class="hs-avanslar">' + h.avanslar.map(function (x, j) {
                    return '<li><span>' + kacir(x.tarih ? new Date(x.tarih + 'T12:00:00Z').toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' }) : '') + '</span><em>' + kacir(x.not || 'Avans') + '</em><b>−' + para(num(x.tutar)) + '</b><button type="button" data-avans-sil="' + j + '" aria-label="Avansı sil">' + ikon('sil') + '</button></li>';
                }).join('') + '</ul>' : '<p class="hs-blok__not">Bu ay avans yok.</p>') +
                '<div class="hs-avans-ekle"><label class="hs-girdi-kap"><input class="hs-girdi" type="text" inputmode="decimal" data-avans-tutar placeholder="Tutar" aria-label="Avans tutarı"><span>₺</span></label>' +
                '<input class="hs-girdi" type="text" data-avans-not placeholder="Not (isteğe bağlı)" maxlength="60" aria-label="Avans notu">' +
                '<button type="button" class="hs-dugme hs-dugme--ana" data-avans-ekle>' + ikon('arti') + '<span>Ekle</span></button></div>' +
                '<div class="hs-kutu-alt"><span>Brüt <b>' + para(h.brut) + '</b></span><span>Avans <b class="eksi">−' + para(h.avans) + '</b></span><span>Net <b>' + para(h.net) + '</b></span></div>';
            return;
        }
        var a = ayKaydi(false);
        var adaylar = v.kuryeler.filter(function (x) {
            if (x.id === k.id || a.bagli[x.id]) return false;
            return !v.kuryeler.some(function (y) { return a.bagli[y.id] === x.id; });
        });
        var paketi = function (x) { return TURLER.reduce(function (t, tur) { return t + (x.say[tur.k] || 0); }, 0); };
        el('hsKutuBaslik').textContent = 'Başka Hesap · ' + k.ad;
        el('hsKutuAlt').textContent = 'Kurye bu ay başka birinin hesabından da çıktıysa o hesabı bağla. Paketleri ve G10 km\'si bu kuryeye eklenir, bağlanan satır listeden düşer.';
        g.innerHTML =
            (h.bagli.length ? '<div class="hs-liste-k"><span class="hs-alan__ad">Bağlı</span>' + h.bagli.map(function (b) {
                return '<div class="hs-secenek is-bagli"><span><b>' + kacir(b.ad) + '</b><small>' + adet(paketi(b)) + ' paket · G10 ' + adet(b.km) + ' km</small></span><button type="button" class="hs-dugme hs-dugme--kucuk" data-coz="' + kacir(b.id) + '">Kaldır</button></div>';
            }).join('') + '</div>' : '') +
            '<div class="hs-liste-k"><span class="hs-alan__ad">Bağlanabilir</span>' + (adaylar.length ? adaylar.map(function (x) {
                return '<div class="hs-secenek"><span><b>' + kacir(x.ad) + '</b><small>' + adet(paketi(x)) + ' paket · G10 ' + adet(x.km) + ' km</small></span><button type="button" class="hs-dugme hs-dugme--kucuk" data-bagla="' + kacir(x.id) + '">' + ikon('bag') + '<span>Bağla</span></button></div>';
            }).join('') : '<p class="hs-blok__not">Bağlanabilecek başka hesap yok.</p>') + '</div>';
    }

    function sifirla() {
        var a = kayit.ay[d.ay];
        var s = sifirSecim;
        if (a) {
            Object.keys(nesne(a.k)).forEach(function (id) {
                var x = a.k[id];
                if (s.ek) delete x.ek;
                if (s.not) delete x.not;
                if (s.km) delete x.km;
                if (s.avans) delete x.avans;
                if (!Object.keys(x).length) delete a.k[id];
            });
            if (s.bagli) a.bagli = {};
            if (!Object.keys(nesne(a.k)).length && !Object.keys(nesne(a.bagli)).length) delete kayit.ay[d.ay];
        }
        kaydet(true);
        if (s.veri) { d.veri.delete(d.ay); veriYaz(); }
        kutuKapat();
        hepsiniCiz();
        bildir(ayAdi(d.ay) + ' sıfırlandı', 'basari');
    }

    function avansEkle() {
        var g = el('hsKutuGovde');
        var t = g.querySelector('[data-avans-tutar]');
        var n = g.querySelector('[data-avans-not]');
        var tutar = num(t && t.value);
        if (!(tutar > 0)) { if (t) t.focus(); bildir('Avans tutarını yaz', 'uyari'); return; }
        var s = kuryeAyi(kutuDurum.id, true);
        if (!Array.isArray(s.avans)) s.avans = [];
        s.avans.push({ tutar: Math.round(tutar * 100) / 100, not: (n && n.value.trim().slice(0, 60)) || '', tarih: bugun() });
        kaydet();
        kutuCiz();
        satirYenidenCiz(kutuDurum.id);
        var yeni = g.querySelector('[data-avans-tutar]');
        if (yeni) yeni.focus();
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
        el('hsSifirla').addEventListener('click', function () {
            sifirSecim = {};
            SIFIR_SECENEK.forEach(function (x) { sifirSecim[x.k] = x.acik; });
            kutuAc('sifirla', null);
        });
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
            var tr = e.target.closest('tr[data-id]');
            if (!tr) return;
            var id = tr.getAttribute('data-id');
            var b;
            if (e.target.closest('[data-arac-degis]')) {
                var kal = kuryeKalici(id, true);
                kal.arac = kal.arac === 'car' ? 'moto' : 'car';
                kaydet(); satirYenidenCiz(id);
                bildir(kal.arac === 'car' ? 'Arabalı fiyatı uygulanıyor' : 'Motorlu fiyatı uygulanıyor', 'bilgi');
                return;
            }
            if (e.target.closest('[data-bagla-ac]')) { kutuAc('bagla', id); return; }
            if (e.target.closest('[data-avans-ac]')) { kutuAc('avans', id); return; }
            if (e.target.closest('[data-g10]')) {
                var k1 = kuryeKalici(id, true);
                k1.km = !k1.km;
                delete kuryeAyi(id, true).km;
                kaydet(); satirYenidenCiz(id); return;
            }
            if ((b = e.target.closest('[data-not-yon]'))) {
                var v = d.veri.get(d.ay);
                var k = kuryeBul(id);
                var notlar = notListesi();
                var simdi = hesapla(k, v).not;
                var i = simdi ? notlar.indexOf(simdi) : notlar.length;
                var j = Math.max(0, Math.min(notlar.length - 1, i + Number(b.getAttribute('data-not-yon'))));
                var s = kuryeAyi(id, true);
                if (notlar[j] === k.not) delete s.not; else s.not = notlar[j];
                kaydet(); satirYenidenCiz(id); return;
            }
            if (e.target.closest('[data-not-sifirla]')) { delete kuryeAyi(id, true).not; kaydet(); satirYenidenCiz(id); }
        });
        liste.addEventListener('focusin', function (e) { if (e.target.matches('.hs-sayi')) e.target.select(); });
        liste.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.matches('.hs-sayi')) { e.preventDefault(); e.target.blur(); }
        });
        liste.addEventListener('input', function (e) {
            var tr = e.target.closest('tr[data-id]');
            if (!tr) return;
            var id = tr.getAttribute('data-id');
            var t = e.target;
            if (t.matches('[data-say]')) {
                var deger = temizSayi(t.value, false);
                if (deger !== t.value) t.value = deger;
                var tur = t.getAttribute('data-say');
                var v = d.veri.get(d.ay);
                var k = kuryeBul(id);
                var r = hesapla(k, v).satirlar.filter(function (x) { return x.t.k === tur; })[0];
                var panel = r.kendi + r.diger;
                var s = kuryeAyi(id, true);
                s.ek = nesne(s.ek);
                if (deger === '' || Number(deger) === panel) delete s.ek[tur]; else s.ek[tur] = Number(deger) - panel;
                kaydet(); rakamYaz(tr); return;
            }
            if (t.matches('[data-km]')) {
                var km = temizSayi(t.value, true);
                if (km !== t.value) t.value = km;
                var s2 = kuryeAyi(id, true);
                var kal = kuryeKalici(id, true);
                if (km === '') { delete s2.km; kal.km = false; }
                else { s2.km = km; kal.km = true; }
                var g = tr.querySelector('[data-g10]');
                if (g) g.setAttribute('aria-pressed', String(!!kal.km));
                t.classList.toggle('is-elle', km !== '');
                kaydet(); rakamYaz(tr);
            }
        });
        /* Kutudan çıkınca boş kalan sayı panel değerine döner */
        liste.addEventListener('change', function (e) {
            var tr = e.target.closest('tr[data-id]');
            if (tr && e.target.matches('.hs-sayi')) satirYenidenCiz(tr.getAttribute('data-id'));
        });

        var kutu = el('hsKutu');
        kutu.addEventListener('click', function (e) {
            if (e.target === kutu || e.target.closest('[data-kapat]')) { kutuKapat(); return; }
            if (!kutuDurum) return;
            var b;
            if (kutuDurum.tur === 'sifre' && (b = e.target.closest('[data-kart]'))) {
                kartSecim = b.getAttribute('data-kart');
                kutu.querySelectorAll('[data-kart]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
                return;
            }
            if ((b = e.target.closest('[data-sifir]'))) {
                var sk = b.getAttribute('data-sifir');
                sifirSecim[sk] = !sifirSecim[sk];
                kutuCiz(); return;
            }
            if (e.target.closest('[data-sifirla-onay]')) { sifirla(); return; }
            if (e.target.closest('[data-avans-ekle]')) { avansEkle(); return; }
            if ((b = e.target.closest('[data-avans-sil]'))) {
                var s = kuryeAyi(kutuDurum.id, true);
                if (Array.isArray(s.avans)) s.avans.splice(Number(b.getAttribute('data-avans-sil')), 1);
                kaydet(); kutuCiz(); satirYenidenCiz(kutuDurum.id); return;
            }
            if ((b = e.target.closest('[data-bagla]'))) {
                ayKaydi(true).bagli[b.getAttribute('data-bagla')] = kutuDurum.id;
                kaydet(); kutuCiz(); listeCiz(); ozetCiz(); return;
            }
            if ((b = e.target.closest('[data-coz]'))) {
                delete ayKaydi(true).bagli[b.getAttribute('data-coz')];
                kaydet(); kutuCiz(); listeCiz(); ozetCiz();
            }
        });
        kutu.addEventListener('submit', function (e) {
            e.preventDefault();
            if (e.target.getAttribute('data-form') === 'degis') sifreDegistir(e.target);
        });
        kutu.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.matches('[data-avans-tutar], [data-avans-not]')) { e.preventDefault(); avansEkle(); }
        });
        kutu.addEventListener('input', function (e) {
            if (!e.target.matches('[data-avans-tutar]')) return;
            var a = temizSayi(e.target.value, true);
            if (a !== e.target.value) e.target.value = a;
        });

        var perde = el('hsFiyat');
        perde.addEventListener('click', function (e) {
            if (e.target === perde || e.target.closest('[data-kapat]')) { fiyatKapat(); return; }
            var b;
            if (e.target.closest('[data-sifre-degis]')) { fiyatKapat(); kutuAc('sifre', null); return; }
            if ((b = e.target.closest('[data-fiyat-arac]'))) { d.fiyatArac = b.getAttribute('data-fiyat-arac'); fiyatCiz(); return; }
            if ((b = e.target.closest('[data-tur-gizle]'))) {
                var k = b.getAttribute('data-tur-gizle');
                if (kayit.gizli[k]) delete kayit.gizli[k];
                else if (gorunenTurler().length > 1) kayit.gizli[k] = true;
                kaydet(); fiyatCiz(); return;
            }
            if (e.target.closest('[data-fiyat-kopyala]')) {
                kayit.fiyat.car = JSON.parse(JSON.stringify(nesne(kayit.fiyat.moto)));
                if (kayit.km.moto != null) kayit.km.car = kayit.km.moto;
                kaydet();
                d.fiyatArac = 'car';
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
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (!kutu.hidden) kutuKapat();
            else if (!perde.hidden) fiyatKapat();
        });
        addEventListener('pagehide', function () { kaydet(true); });
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
        d.hata = null;
        hepsiniCiz();
        yukle(false);
    }

    var istekNo = 0;
    async function yukle(zorla) {
        var no = ++istekNo;
        var ay = d.ay;
        if (!zorla && (d.veri.has(ay) || !d.ornek)) { hepsiniCiz(); return; }
        d.yukleniyor = true;
        d.hata = null;
        hepsiniCiz();
        try {
            await veriAl(ay, zorla);
            if (no !== istekNo) return;
            d.yukleniyor = false;
        } catch (e) {
            if (no !== istekNo) return;
            d.yukleniyor = false;
            /* Elde eski veri varsa tablo kalır, hata yalnız durum satırında */
            d.hata = e;
            if (d.veri.has(ay)) bildir(hataMetni(e), 'hata');
        }
        hepsiniCiz();
        if (!d.hata && zorla) bildir(ayAdi(ay) + ' verisi güncellendi', 'basari');
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

        /* Kilit ilk karede; haklar arkada yükleniyor */
        var haklar = haklariYukle();
        await kilitIste();

        kayit = kayitOku();
        veriOku();
        d.ay = varsayilanAy();
        bolum('hsIcerik');
        hepsiniCiz();

        var p = await haklar;
        if (!d.ornek && !(p && p.checkPremiumFeature(HAK))) { bolum('hsYetkiYok'); return; }
        olaylar();
        yukle(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
