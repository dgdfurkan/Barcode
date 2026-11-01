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
 * NEREDE DURUYOR
 * Panel verisi (ayın 1'inden son gününe) bir kez okunur ve hesaba yazılır
 * (vps-api/hesaplama-kilit.js, /api/hesaplama/veri); sonraki açılışlarda her
 * cihaz oradan açar. Panele yalnız kullanıcı Panelden Al / Yenile deyince
 * gidilir; kaydı olmayan ay boş açılır. Açılış şifresi de hesapta (yalnız bcrypt özeti). Fiyatlar, araç, km desteği, not yükseltme, ek paket,
 * başka hesap paketleri, avanslar ve eksik ürün listesi localStorage'da,
 * kullanıcı adına göre ayrı anahtarda; sunucuya gitmez.
 *
 * HESAP
 *   paket tutarı = Σ (panel + elle ek + başka hesap) × fiyat[araç][not][kalem]
 *   km desteği   = km × km fiyatı[araç]   (km: elle yazılan, yoksa G10 km)
 *   net          = paket tutarı + km desteği − avanslar − eksik ürün (eklendiyse)
 * Not, panelin notudur; kullanıcı bir tık yükseltip düşürebilir (yalnız fiyat
 * değişir). Başka hesap: kurye başka birinin hesabından da çıktıysa o
 * paketler satırda elle girilir.
 *
 * EKSİK ÜRÜN
 * Franchise panelinin eksik ürün Excel'i (js/hesaplama-eksik.js okur) ayın
 * kaydına girer. Excel'deki kurye adı tablodaki kuryeyle adından eşleşir,
 * eşleşmeyen elle seçilir (kayit.esle, aylar arası kalır). Tutar tabloda
 * görünür ama "Hak Edişe Ekle" denene kadar netten düşülmez.
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
        kurye: '<circle cx="10" cy="7" r="3"/><path d="M4 17c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5"/>',
        eksik: '<path d="M3.5 6.5 10 3l6.5 3.5v7L10 17l-6.5-3.5z"/><path d="M7.5 10.5h5"/>',
        indir: '<path d="M10 3.5v9M6 8.5l4 4 4-4M4 16.5h12"/>',
        yazdir: '<path d="M6 7V3.5h8V7"/><rect x="3" y="7" width="14" height="7" rx="1.5"/><path d="M6 12h8v4.5H6z"/>',
        dosya: '<path d="M5.5 2.5h6l3.5 3.5v11.5h-9.5z"/><path d="M11.5 2.5V6H15M8 10.5l4 4M12 10.5l-4 4"/>'
    };
    function ikon(ad, sinif) { return '<svg viewBox="0 0 20 20" aria-hidden="true"' + (sinif ? ' class="' + sinif + '"' : '') + '>' + (IKON[ad] || '') + '</svg>'; }

    var d = {
        kim: '',
        ay: '',
        veri: new Map(),       // ay → { kuryeler, zaman, bas, son }
        yukleniyor: false,
        panelden: false,       // yükleniyor: hesaptan mı panelden mi
        hata: null,
        ara: '',
        sira: 'ad',
        fiyatArac: 'moto',
        fiyatKopya: false,     // Ayarlar: Arabalıya kopyala modu
        acik: {},              // kurye id → başka hesap satırı açık mı
        eksikYukleniyor: false,
        eksikYukMetin: '',
        eksikHata: '',
        eksikRapor: {},        // ay → 'yok' (Raporlar'da o ayın raporu bulunamadı)
        yazdirHaric: {},       // PDF / Yazdır: çıktıya girmeyen kurye adları (her açılışta boş)
        aylar: null,           // Kayıtlı Aylar: { liste, bekliyor, hata }
        aySil: {},             // ay → silinecek mi
        aySilTur: {},          // { veri, girdi }: false ise o tür silinmez
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
        return { v: 1, fiyat: nesne(o.fiyat), km: nesne(o.km), gizli: nesne(o.gizli), kurye: nesne(o.kurye), ay: nesne(o.ay), esle: nesne(o.esle), kopya: nesne(o.kopya), yazdir: nesne(o.yazdir) };
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

    /* Eski sürümler panel verisini ve kilit özetini bu cihazda tutuyordu; artık tutulmuyor */
    function eskiYerelSil() {
        ['jb_hesaplama_veri:', 'jb_hesaplama_kilit:'].forEach(function (on) {
            try { localStorage.removeItem(on + (d.kim || 'misafir')); } catch (e) { /* sessiz */ }
        });
    }

    function ayKaydi(yaz) {
        var a = kayit.ay[d.ay];
        if (!a) {
            if (!yaz) return { k: {} };
            a = kayit.ay[d.ay] = { k: {} };
        }
        a.k = nesne(a.k);
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

    /* Her zaman ayın 1'inden son gününe; süren ayda da (panel olmayan günleri boş sayar) */
    function aralik(ay) {
        return {
            bas: ay + '-01',
            son: new Date(Date.UTC(+ay.slice(0, 4), +ay.slice(5, 7), 0)).toISOString().slice(0, 10),
            surer: bugun().slice(0, 7) === ay
        };
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

    /* Hesaptaki kayıt: varsa panele gidilmez. Sunucu yoksa ya da kayıt yoksa null. */
    async function hesaptanVeri(ay) {
        var c = await hsIstek('/api/hesaplama/veri?ay=' + ay);
        var v = c.j && c.j.ok && c.j.veri;
        if (!v || !Array.isArray(v.kuryeler)) return null;
        var kuryeler = v.kuryeler.filter(function (k) { return k && KIMLIK.test(String(k.id)) && k.say && typeof k.say === 'object'; });
        return { kuryeler: kuryeler, zaman: Number(v.zaman) || Date.now(), bas: v.bas, son: v.son };
    }
    async function hesabaYaz(ay, v) {
        var c = await hsIstek('/api/hesaplama/veri', { ay: ay, veri: { kuryeler: v.kuryeler, bas: v.bas, son: v.son } });
        if (c.j && c.j.ok) return;
        if (c.kod === 404 || (c.j && c.j.error === 'kurulum_bekleniyor')) return;   // sunucu güncellenmedi: sessiz
        bildir('Veri hesaba kaydedilemedi; bir dahaki açılışta panelden yeniden okunur', 'uyari');
    }

    async function veriAl(ay, zorla) {
        if (!zorla && d.veri.has(ay)) return d.veri.get(ay);
        var r = aralik(ay);
        if (d.ornek) {
            var v0 = { kuryeler: ornekKuryeler(ay), zaman: Date.now(), bas: r.bas, son: r.son };
            d.veri.set(ay, v0);
            return v0;
        }
        d.panelden = false;
        /* Panele kendiliğinden gidilmez: kayıt yoksa boş kalır, kullanıcı Panelden Al / Yenile der */
        if (!zorla) {
            var kayitli = await hesaptanVeri(ay);
            if (kayitli) d.veri.set(ay, kayitli);
            return kayitli;
        }
        d.panelden = true;
        durumCiz();
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
        hesabaYaz(ay, v);
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
        var not = (s.not && notListesi().indexOf(s.not) !== -1) ? s.not : k.not;
        var tablo = nesne(nesne(kayit.fiyat[arac])[not]);

        var paket = 0, paketTutar = 0, digerToplam = 0;
        var satirlar = gorunenTurler().map(function (t) {
            var kendi = k.say[t.k] || 0;
            var diger = Math.max(0, Math.round(num(nesne(s.diger)[t.k])));
            var ek = Math.round(num(nesne(s.ek)[t.k]));
            var toplam = Math.max(0, kendi + ek) + diger;
            digerToplam += diger;
            var fiyat = num(tablo[t.k]);
            var tutar = toplam * fiyat;
            paket += toplam;
            paketTutar += tutar;
            return { t: t, kendi: kendi, diger: diger, ek: ek, toplam: toplam, fiyat: fiyat, tutar: tutar };
        });

        var g10 = Math.round(k.km * 10) / 10;
        var kmDestek = !!kalici.km;
        var elleKm = s.km != null && s.km !== '';
        var km = kmDestek ? (elleKm ? num(s.km) : g10) : 0;
        var kmFiyat = num(kayit.km[arac]);
        var kmTutar = km * kmFiyat;

        var avanslar = Array.isArray(s.avans) ? s.avans : [];
        var avans = avanslar.reduce(function (t2, x) { return t2 + num(x && x.tutar); }, 0);
        var brut = paketTutar + kmTutar;
        var ek = eksikOzet().kurye[k.id];
        var eksik = ek ? ek.tutar : 0;
        var eksikDus = ek && ek.islendi ? eksik : 0;
        return {
            arac: arac, not: not, yukseltildi: !!(s.not && s.not !== k.not && not === s.not), diger: digerToplam,
            satirlar: satirlar, paket: paket, paketTutar: paketTutar,
            g10: g10, kmDestek: kmDestek, elleKm: elleKm, km: km, kmFiyat: kmFiyat, kmTutar: kmTutar,
            avanslar: avanslar, avans: avans, brut: brut,
            eksik: eksik, eksikAdet: ek ? ek.adet : 0, eksikIslendi: !!(ek && ek.islendi), eksikDus: eksikDus,
            net: brut - avans - eksikDus
        };
    }

    function anaKuryeler(veri) { return veri.kuryeler; }

    // ------------------------------------------------------------------
    // Eksik ürünler (Excel'den; yalnız bu cihazda)
    // ------------------------------------------------------------------

    var HARF = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };
    function adNorm(s) {
        return String(s || '').toLocaleLowerCase('tr').replace(/[ışğüöçâîû]/g, function (h) { return HARF[h]; })
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function eksikKaydi() {
        var a = kayit.ay[d.ay];
        return a && a.eksik && Array.isArray(a.eksik.satirlar) ? a.eksik : null;
    }

    /* Excel'deki ad → tablodaki kurye. Önce elle seçilen, sonra birebir ad,
       sonra kısa adın bütün parçaları uzun adda (tek aday varsa). */
    function eslestir(n, kn) {
        if (Object.prototype.hasOwnProperty.call(kayit.esle, n)) {
            var m = kayit.esle[n];
            if (m === '') return null;
            if (kn.some(function (x) { return x.id === m; })) return m;
        }
        var tam = kn.filter(function (x) { return x.n === n; });
        if (tam.length === 1) return tam[0].id;
        var p = n.split(' ');
        var aday = kn.filter(function (x) {
            var q = x.n.split(' ');
            var kisa = p.length <= q.length ? p : q, uzun = kisa === p ? q : p;
            return kisa.every(function (t) { return uzun.indexOf(t) > -1; }) || (p[0] === q[0] && p[p.length - 1] === q[q.length - 1]);
        });
        return aday.length === 1 ? aday[0].id : null;
    }

    var eksikSurum = 0;
    var eksikBellek = { anahtar: '', sonuc: null };
    function eksikDegisti() { eksikSurum++; kaydet(); }

    function eksikOzet() {
        var e = eksikKaydi();
        var v = d.veri.get(d.ay);
        var anahtar = d.ay + '|' + eksikSurum + '|' + (v ? v.zaman : 0) + '|' + (e ? e.zaman : 0);
        if (eksikBellek.anahtar === anahtar) return eksikBellek.sonuc;
        var sonuc = { gruplar: [], kurye: {}, toplam: 0, adet: 0, silinen: 0, eslesmeyen: 0 };
        if (e) {
            var sil = nesne(e.sil);
            var kn = v ? v.kuryeler.map(function (k) { return { id: k.id, n: adNorm(k.ad) }; }) : [];
            var harita = {};
            e.satirlar.forEach(function (x, i) {
                var n = adNorm(x.kurye) || 'kurye yok';
                var g = harita[n];
                if (!g) {
                    g = harita[n] = { ad: x.kurye, n: n, satirlar: [], toplam: 0, adet: 0, id: v ? eslestir(n, kn) : null };
                    sonuc.gruplar.push(g);
                }
                var silindi = !!sil[i];
                g.satirlar.push({ i: i, tarih: x.tarih, urun: x.urun, tutar: num(x.tutar), kupon: !!x.kupon, depo: !!x.depo, silindi: silindi });
                if (silindi) { sonuc.silinen++; return; }
                g.toplam += num(x.tutar);
                g.adet++;
            });
            sonuc.gruplar.sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
            sonuc.gruplar.forEach(function (g) {
                g.toplam = Math.round(g.toplam * 100) / 100;
                g.satirlar.sort(function (a, b) { return (a.tarih || '').localeCompare(b.tarih || '') || a.urun.localeCompare(b.urun, 'tr'); });
                sonuc.toplam += g.toplam;
                sonuc.adet += g.adet;
                if (!g.id) { if (v && g.adet) sonuc.eslesmeyen++; return; }
                var t = sonuc.kurye[g.id] || (sonuc.kurye[g.id] = { tutar: 0, adet: 0, islendi: !!e.islendi });
                t.tutar = Math.round((t.tutar + g.toplam) * 100) / 100;
                t.adet += g.adet;
            });
        }
        eksikBellek = { anahtar: anahtar, sonuc: sonuc };
        return sonuc;
    }

    /* Çıktıya giden liste: silinenler ve boş kalan kuryeler hariç */
    function eksikCiktisi() {
        return eksikOzet().gruplar.filter(function (g) { return g.adet; }).map(function (g) {
            return { ad: g.ad, satirlar: g.satirlar.filter(function (s) { return !s.silindi; }) };
        });
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
        if (r.surer) alt += ' · Ay sürüyor';
        else if (ayKaydir(d.ay, 1) === bugun().slice(0, 7) && +bugun().slice(8, 10) === 1 && saat() < 13) alt += ' · Son gün öğleden sonra tamamlanır';
        el('hsAyAlt').textContent = alt;
        el('hsAyIleri').disabled = d.ay >= bugun().slice(0, 7);
    }

    function durumCiz() {
        var kutu = el('hsDurum');
        var v = d.veri.get(d.ay);
        var metin, tur;
        if (d.yukleniyor) { metin = d.panelden ? 'Panelden okunuyor' : 'Yükleniyor'; tur = 'yukleniyor'; }
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
        var o = eksikOzet();
        var rozet = el('hsEksikRozet');
        rozet.hidden = !o.adet;
        rozet.textContent = o.adet ? adet(o.adet) : '';
        el('hsEksikAc').classList.toggle('is-islendi', !!(eksikKaydi() && eksikKaydi().islendi && o.adet));
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

    function sutunSayisi() { return gorunenTurler().length + 6; }

    function listeCiz() {
        var kutu = el('hsListe');
        var v = d.veri.get(d.ay);
        if (!v) {
            if (d.hata) {
                kutu.innerHTML = '<div class="hs-bos">' + ikon('kurye') + '<strong>Kurye verisi alınamadı</strong><p>' + kacir(hataMetni(d.hata)) + '</p><button type="button" class="hs-dugme" data-yenile>' + ikon('geri') + '<span>Tekrar Dene</span></button></div>';
            } else if (!d.yukleniyor) {
                kutu.innerHTML = '<div class="hs-bos">' + ikon('kurye') + '<strong>' + kacir(ayAdi(d.ay)) + ' verisi alınmadı</strong><p>Kurye paketleri, not ve km ayın 1\'inden son gününe Panelden Al\'a basınca okunur ve hesabına kaydedilir. Sonra her cihazda kayıttan açılır; güncellemek için Yenile\'ye basarsın.</p><button type="button" class="hs-dugme hs-dugme--ana" data-yenile>' + ikon('geri') + '<span>Panelden Al</span></button></div>';
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
            '<th>Km Desteği</th><th>Eksik Ürün</th><th>Avans</th><th class="hs-t__toplam">Toplam</th><th>Not</th></tr></thead>';
    }

    function satirHtml(k, h) {
        var s = kuryeAyi(k.id, false);
        var foto = k.foto
            ? '<img class="hs-av" src="' + kacir(k.foto) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'hs-av hs-av--bas\',textContent:' + kacir(JSON.stringify(bas(k.ad))) + '}))">'
            : '<span class="hs-av hs-av--bas">' + kacir(bas(k.ad)) + '</span>';
        var arac = ARACLAR.filter(function (a) { return a.k === h.arac; })[0];
        /* Başka hesap satırı: elle açılır, sayı girilmişse kendiliğinden açık */
        var acik = d.acik[k.id] != null ? d.acik[k.id] : h.diger > 0;
        var kurye = '<td class="hs-t__kurye"><div class="hs-kurye">' + foto +
            '<div class="hs-kurye__ad"><strong title="' + kacir(k.ad) + '">' + kacir(k.ad) + '</strong><span class="hs-kurye__araclar">' +
                '<button type="button" class="hs-mini" data-arac-degis title="' + arac.ad + ' · değiştirmek için dokun" aria-label="Araç: ' + arac.ad + '">' + ikon(arac.ikon) + '</button>' +
                '<button type="button" class="hs-mini' + (acik || h.diger ? ' is-on' : '') + '" data-diger-ac aria-pressed="' + acik + '" title="Başka hesaptan çıkan paketler" aria-label="Başka hesap">' + ikon('karistir') + (!acik && h.diger ? '<b>' + adet(h.diger) + '</b>' : '') + '</button>' +
            '</span></div></div></td>';

        var hucreler = h.satirlar.map(function (r) {
            var elle = r.ek !== 0;
            var kendi = Math.max(0, r.kendi + r.ek);
            var baslik = (r.t.alan ? 'Panel ' + adet(r.kendi) : 'Panel vermiyor') + (elle ? ' · elle ' + (r.ek > 0 ? '+' : '') + r.ek : '');
            return '<td><div class="hs-hucre">' +
                '<input class="hs-sayi' + (elle ? ' is-elle' : '') + '" type="text" inputmode="numeric" data-say="' + r.t.k + '" value="' + (kendi || (r.t.alan ? 0 : '')) + '" placeholder="–" title="' + kacir(baslik) + '" aria-label="' + kacir(k.ad + ' ' + r.t.ad) + '">' +
                '<small data-o="f-' + r.t.k + '">' + fiyatYazi(r.fiyat) + '</small>' +
                (acik ? '<label class="hs-diger" title="Başka hesaptan çıkan ' + kacir(r.t.ad) + '">' + ikon('karistir') +
                    '<input class="hs-sayi hs-sayi--diger" type="text" inputmode="numeric" data-diger="' + r.t.k + '" value="' + (r.diger || '') + '" placeholder="–" aria-label="' + kacir(k.ad + ' başka hesap ' + r.t.ad) + '"></label>' : '') +
                '</div></td>';
        }).join('');

        var kmDeger = h.kmDestek ? (h.elleKm ? s.km : String(h.g10).replace('.', ',')) : '';
        var km = '<td><div class="hs-hucre"><div class="hs-km2">' +
            '<input class="hs-sayi hs-sayi--km' + (h.elleKm ? ' is-elle' : '') + '" type="text" inputmode="decimal" data-km value="' + kacir(kmDeger) + '" placeholder="–" aria-label="' + kacir(k.ad) + ' km desteği">' +
            '<button type="button" class="hs-g10" data-g10 aria-pressed="' + h.kmDestek + '" title="' + (h.kmDestek ? 'Km desteği açık · kapatmak için dokun' : 'G10 ' + adet(h.g10) + ' km · km desteğine yazmak için dokun') + '">' + ikon('yol') + '</button>' +
            '</div><small>G10 ' + adet(h.g10) + '</small></div></td>';

        var eksik = '<td><div class="hs-hucre">' + (h.eksikAdet
            ? '<button type="button" class="hs-eksik-d' + (h.eksikIslendi ? ' is-islendi' : '') + '" data-eksik-ac title="' + (h.eksikIslendi ? 'Hak edişten düşülüyor' : 'Hak edişe eklenmedi') + '" aria-label="' + kacir(k.ad) + ' eksik ürün">−' + para(h.eksik) + '</button>' +
                '<small>' + (h.eksikIslendi ? adet(h.eksikAdet) + ' ürün' : 'Eklenmedi') + '</small>'
            : '<span class="hs-eksik-bos">–</span><small>&nbsp;</small>') + '</div></td>';

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

        return '<tr data-id="' + kacir(k.id) + '">' + kurye + hucreler + km + eksik + avans + toplam + not + '</tr>';
    }

    function altCiz() {
        var v = d.veri.get(d.ay);
        var ayak = el('hsListe').querySelector('tfoot');
        if (!v || !ayak) return;
        var turler = gorunenTurler();
        var t = { say: {}, km: 0, paket: 0, kurye: 0, eksik: 0 };
        turler.forEach(function (x) { t.say[x.k] = 0; });
        anaKuryeler(v).forEach(function (k) {
            var h = hesapla(k, v);
            h.satirlar.forEach(function (r) { t.say[r.t.k] += r.toplam; });
            t.km += h.km; t.paket += h.paket; t.eksik += h.eksikAdet; t.kurye++;
        });
        ayak.innerHTML = '<tr><td class="hs-t__kurye"><div class="hs-hucre hs-hucre--sol"><strong>Toplam</strong><small>' + t.kurye + ' kurye</small></div></td>' +
            turler.map(function (x) { return '<td><div class="hs-hucre"><strong>' + adet(t.say[x.k]) + '</strong><small>&nbsp;</small></div></td>'; }).join('') +
            '<td><div class="hs-hucre"><strong>' + adet(t.km) + '</strong><small>km</small></div></td>' +
            '<td><div class="hs-hucre"><strong>' + (t.eksik ? adet(t.eksik) : '–') + '</strong><small>' + (t.eksik ? 'eksik ürün' : '&nbsp;') + '</small></div></td><td></td>' +
            '<td class="hs-t__toplam"><div class="hs-hucre"><strong>' + adet(t.paket) + '</strong><small>paket</small></div></td><td></td></tr>';
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
    // Kilit: her açılışta şifre (hesapta)
    // ------------------------------------------------------------------
    /*
     * İlk girişte şifre sorulmaz, belirlenir; yanında bir hafıza kartı seçilir.
     * Şifre unutulursa doğru kart seçilince yeni şifre yazılır. Şifre ve kart
     * hesapta (vps-api/hesaplama-kilit.js): sunucu bcrypt özetini tutar, kartı
     * hiçbir yanıtta geri vermez, yanlış denemede bekletir. Bu cihazda bir şey
     * tutulmaz. Sunucu güncellenene kadar (404) sayfa kilitsiz açılır.
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
    var kilitCoz = null;
    var kilitMod = '';
    var kartSecim = '';
    var kilitJeton = '';
    var kilitBekle = 0;   // sunucunun verdiği bekleme bitişi (ms)
    var kilitSunucuYok = false;

    function kilitIstek(yol, govde) { return hsIstek('/api/hesaplama/kilit' + yol, govde); }

    async function hsIstek(yol, govde) {
        var a = global.jetbarkodAuth;
        if (!a || !a.apiFetch || !a.get || !a.get()) return { kod: 401, j: {} };
        try {
            var r = await a.apiFetch(yol, govde ? {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde)
            } : {});
            var j = null;
            try { j = await r.json(); } catch (e) { /* gövde yok */ }
            return { kod: r.status, j: j || {} };
        } catch (e) {
            return { kod: 0, j: { error: 'ag' } };
        }
    }

    /* Sunucu yanıtı → ekrandaki cümle. Bekleme varsa kilitBekle'ye yazılır. */
    function kilitHatasi(c, yanlisMetni) {
        var k = c.j && c.j.error;
        if (c.j && c.j.bekleSn > 0) kilitBekle = Date.now() + c.j.bekleSn * 1000;
        if (k === 'bekle' || (k === 'yanlis' && c.j.bekleSn > 0)) return 'Çok fazla yanlış deneme. ' + c.j.bekleSn + ' sn sonra tekrar dene.';
        if (k === 'yanlis') return yanlisMetni + (c.j.kalan > 0 ? ' ' + c.j.kalan + ' deneme hakkın kaldı.' : '');
        if (k === 'jeton') return 'Süre doldu. Hafıza kartını yeniden seç.';
        if (k === 'cok_istek') return 'Çok sık denendi. Birkaç saniye sonra tekrar dene.';
        if (c.kod === 401) return 'Oturum doldu. Sayfayı yenileyip tekrar giriş yap.';
        if (c.kod === 0) return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.';
        return 'İşlem yapılamadı. Biraz sonra tekrar dene.';
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
        var bekleme = kilitBekle > Date.now() ? Math.ceil((kilitBekle - Date.now()) / 1000) : 0;
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
            kartSecim = '';
            k.innerHTML = '<span class="hs-kilit__im">' + KILIT_IKON + '</span>' +
                '<h1>' + (mod === 'kur' ? 'Şifre Belirle' : 'Yeni Şifre') + '</h1>' +
                '<p>' + (mod === 'kur' ? 'Hesaplama bundan sonra her açılışta bu şifreyi sorar. Şifre hesabında tutulur, her cihazda aynıdır.' : 'Hafıza kartın doğru. Yeni şifreni yaz.') + '</p>' +
                '<form class="hs-kilit__form" data-form="' + mod + '" novalidate>' + sifreAlanlari(mod === 'yeni') +
                    (mod === 'kur' ? '<div class="hs-kilit__kart"><b>Hafıza Kartı</b><small>Şifreni unutursan bu kartı seçerek sıfırlarsın. Aklında kalacak birini seç.</small>' + kartHtml('', false) + '</div>' : '') +
                    hata + '<button type="submit" class="hs-dugme hs-dugme--ana hs-dugme--tam">' + (mod === 'kur' ? 'Kaydet ve Aç' : 'Şifreyi Kaydet') + '</button>' +
                '</form>';
        } else if (mod === 'hata') {
            k.innerHTML = '<span class="hs-kilit__im hs-kilit__im--sari">' + KILIT_IKON + '</span>' +
                '<h1>Kilit Açılamadı</h1><p>' + kacir(mesaj || '') + '</p>' +
                '<button type="button" class="hs-dugme hs-dugme--ana hs-dugme--tam" data-mod="yokla">Tekrar Dene</button>';
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
        kilitJeton = '';
        el('hsKilitKart').innerHTML = '';
        if (c) c();
    }

    /* Sunucuya sor: şifre var mı. Yoksa belirlenir; sunucu güncellenmediyse kilitsiz açılır. */
    async function kilitYokla() {
        el('hsKilitKart').innerHTML = '<span class="hs-kilit__im">' + KILIT_IKON + '</span><h1>Hesaplama Kilitli</h1><p>Hesabın kontrol ediliyor.</p>';
        var c = await kilitIstek('');
        if (c.kod === 404 || (c.j && c.j.error === 'kurulum_bekleniyor')) {
            kilitSunucuYok = true;
            kilitAcildi();
            return;
        }
        if (!c.j.ok) { kilitCiz('hata', kilitHatasi(c, '')); return; }
        if (c.j.bekleSn > 0) kilitBekle = Date.now() + c.j.bekleSn * 1000;
        kilitCiz(c.j.kurulu ? 'ac' : 'kur');
    }

    function kilitOlaylari() {
        var k = el('hsKilitKart');
        k.addEventListener('click', async function (e) {
            var b = e.target.closest('[data-mod]');
            if (b) {
                if (b.getAttribute('data-mod') === 'yokla') kilitYokla();
                else kilitCiz(b.getAttribute('data-mod'));
                return;
            }
            var kart = e.target.closest('[data-kart]');
            if (!kart) return;
            if (kilitMod === 'kur') {
                kartSecim = kart.getAttribute('data-kart');
                k.querySelectorAll('[data-kart]').forEach(function (x) { x.setAttribute('aria-checked', String(x === kart)); });
                return;
            }
            if (kilitMod !== 'unuttum' || k.classList.contains('is-bekliyor')) return;
            k.classList.add('is-bekliyor');
            var c = await kilitIstek('/kart', { kart: kart.getAttribute('data-kart') });
            k.classList.remove('is-bekliyor');
            if (c.j.ok && c.j.jeton) { kilitJeton = c.j.jeton; kilitCiz('yeni'); return; }
            var m = kilitHatasi(c, 'Bu kart değil.');
            if (kilitBekle > Date.now()) kilitCiz('unuttum');
            else hataYaz(m);
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
                    var c = await kilitIstek('/ac', { sifre: g.value });
                    if (c.j.ok) { kilitAcildi(); return; }
                    g.value = '';
                    g.focus();
                    hataYaz(kilitHatasi(c, 'Şifre yanlış.'));
                    return;
                }
                var y = yeniSifreOku(form);
                if (y.hata) { hataYaz(y.hata); return; }
                if (tur === 'kur' && !kartSecim) { hataYaz('Bir hafıza kartı seç.'); return; }
                var c2 = tur === 'kur'
                    ? await kilitIstek('/kur', { sifre: y.sifre, kart: kartSecim })
                    : await kilitIstek('/yeni', { sifre: y.sifre, jeton: kilitJeton });
                if (c2.j.ok) {
                    bildir(tur === 'kur' ? 'Şifre belirlendi' : 'Yeni şifre kaydedildi', 'basari');
                    kilitAcildi();
                    return;
                }
                if (c2.j.error === 'kurulu') { kilitCiz('ac', 'Bu hesapta şifre zaten var. Şifreni gir.'); return; }
                if (c2.j.error === 'jeton') { kilitCiz('unuttum', kilitHatasi(c2, '')); return; }
                hataYaz(kilitHatasi(c2, ''));
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
            if (d.ornek) { kilitAcildi(); return; }
            kilitYokla();
        });
    }

    /* Ayarlar > Şifreyi Değiştir (kutu). Kart sunucudan dönmez; seçilmezse eskisi kalır. */
    function sifreKutusuHtml() {
        kartSecim = '';
        return '<form class="hs-kilit__form" data-form="degis" novalidate>' +
            '<label class="hs-sifre"><input type="password" data-sifre="eski" autocomplete="current-password" placeholder="Şu anki şifre" aria-label="Şu anki şifre" maxlength="64"></label>' +
            sifreAlanlari(true) +
            '<div class="hs-kilit__kart"><b>Hafıza Kartı</b><small>Değiştirmek istersen yeni kartı seç. Seçmezsen eski kartın kalır.</small>' + kartHtml('', false) + '</div>' +
            '<p class="hs-kilit__hata" data-kutu-hata></p>' +
            '<div class="hs-pano__alt"><button type="button" class="hs-dugme" data-kapat>Vazgeç</button><button type="submit" class="hs-dugme hs-dugme--ana">Kaydet</button></div>' +
            '</form>';
    }

    async function sifreDegistir(form) {
        var h = form.querySelector('[data-kutu-hata]');
        var yaz = function (m) { h.textContent = m; };
        var eski = form.querySelector('[data-sifre="eski"]').value;
        if (!eski) { yaz('Şu anki şifreni yaz.'); return; }
        var y = yeniSifreOku(form);
        if (y.hata) { yaz(y.hata); return; }
        var c = await kilitIstek('/degis', { eski: eski, sifre: y.sifre, kart: kartSecim || '' });
        if (c.j.ok) {
            kutuKapat();
            bildir('Şifre değiştirildi', 'basari');
            return;
        }
        if (c.kod === 404 && !c.j.error) { yaz('Sunucu güncellemesi bekleniyor.'); return; }
        yaz(kilitHatasi(c, 'Şu anki şifre yanlış.'));
    }

    // ------------------------------------------------------------------
    // Fiyatlar paneli
    // ------------------------------------------------------------------

    function fiyatSayi(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

    /* Arabalıya kopyalarken seçilen kutulara eklenecek fark (kayit.kopya: { fark, sec }) */
    function kopyaFark() { return num(nesne(kayit.kopya).fark != null ? kayit.kopya.fark : 10); }
    function kopyaSecili(n, t) { return !!nesne(nesne(kayit.kopya).sec)[n + '|' + t]; }

    function fiyatCiz() {
        var kopya = d.fiyatKopya;
        var arac = kopya ? 'moto' : d.fiyatArac;
        var tablo = nesne(kayit.fiyat[arac]);
        var turler = gorunenTurler();
        var notlar = notListesi();
        var fark = kopyaFark();
        var g = el('hsFiyatGovde');
        var bas = '<div class="hs-fiyat__satir hs-fiyat__satir--bas"><span>Not</span>' + turler.map(function (t) {
            var ad = '<span class="hs-fiyat__bas-ad">' + ikon(t.ikon) + '<span>' + kacir(t.ad) + '</span></span>';
            return kopya ? '<button type="button" class="hs-fiyat__bas-d" data-kopya-sutun="' + t.k + '" title="Bütün sütunu seç">' + ad + '</button>' : ad;
        }).join('') + '</div>';

        var satirlar = notlar.map(function (n) {
            var satir = nesne(tablo[n]);
            var etiket = '<b class="hs-not hs-not--' + notSinif(n) + '">' + kacir(n) + '</b>';
            if (kopya) {
                return '<div class="hs-fiyat__satir"><button type="button" class="hs-fiyat__not-d" data-kopya-satir="' + kacir(n) + '" title="Bütün satırı seç">' + etiket + '</button>' + turler.map(function (t) {
                    var ham = satir[t.k];
                    var bos = ham == null || ham === '';
                    var sec = kopyaSecili(n, t.k);
                    var sonuc = bos ? '–' : fiyatSayi(num(ham) + (sec ? fark : 0));
                    return '<button type="button" class="hs-kopya-h" data-kopya-hucre="' + kacir(n) + '|' + t.k + '" aria-pressed="' + sec + '"' + (bos ? ' disabled' : '') +
                        ' aria-label="' + kacir(n + ' ' + t.ad) + (sec ? ', fazla' : '') + '"><b>' + sonuc + '</b><small>' + (sec ? '+' + fiyatSayi(fark) : bos ? '' : 'aynı') + '</small></button>';
                }).join('') + '</div>';
            }
            return '<div class="hs-fiyat__satir"><span>' + etiket + '</span>' + turler.map(function (t) {
                return '<label class="hs-girdi-kap hs-girdi-kap--fiyat"><input class="hs-girdi" type="text" inputmode="decimal" data-fiyat="' + kacir(n) + '|' + t.k + '" value="' + kacir(satir[t.k] != null ? satir[t.k] : '') + '" placeholder="0" aria-label="' + kacir(n + ' ' + t.ad) + ' fiyatı"><span>₺</span></label>';
            }).join('') + '</div>';
        }).join('');

        var izgara = '<div class="hs-fiyat' + (kopya ? ' hs-fiyat--kopya' : '') + '" style="--sutun:' + turler.length + '">' + bas + satirlar + '</div>';

        if (kopya) {
            var secilen = notlar.reduce(function (t, n) { return t + turler.filter(function (x) { return kopyaSecili(n, x.k); }).length; }, 0);
            g.innerHTML =
                '<div class="hs-kopya-ust">' +
                    '<span class="hs-pano__ad"><b>' + ikon('araba') + 'Arabalıya Kopyala</b><small>Motorlu fiyatları kopyalanır. Fazla olacak kutulara dokun; not ya da kalem adına dokunursan bütün satır ya da sütun seçilir.</small></span>' +
                    '<label class="hs-kopya-fark"><span>Fark</span><span class="hs-girdi-kap hs-girdi-kap--fiyat"><input class="hs-girdi" type="text" inputmode="decimal" data-kopya-fark value="' + kacir(fiyatSayi(fark)) + '" aria-label="Seçilen kutulara eklenecek fark"><span>₺</span></span></label>' +
                '</div>' +
                izgara +
                '<div class="hs-pano__alt"><span class="hs-kopya-say">' + (secilen ? adet(secilen) + ' kutu +' + fiyatSayi(fark) + ' ₺' : 'Hepsi motorluyla aynı') + '</span>' +
                    '<button type="button" class="hs-dugme" data-kopya-vazgec>Vazgeç</button>' +
                    '<button type="button" class="hs-dugme hs-dugme--ana" data-kopya-uygula>' + ikon('tamam') + '<span>Arabalıya Kopyala</span></button></div>';
            return;
        }

        g.innerHTML =
            '<div class="hs-segment hs-segment--genis" role="radiogroup" aria-label="Araç">' + ARACLAR.map(function (a) {
                return '<button type="button" role="radio" data-fiyat-arac="' + a.k + '" aria-checked="' + (a.k === arac) + '">' + ikon(a.ikon) + a.ad + '</button>';
            }).join('') + '</div>' +
            izgara +
            '<div class="hs-fiyat-alt">' +
                '<div class="hs-pano__satir"><span class="hs-pano__ad"><b>' + ikon('yol') + 'Km Desteği</b><small>' + (arac === 'car' ? 'Arabalı' : 'Motorlu') + ' kurye, km başına</small></span>' +
                    '<label class="hs-girdi-kap hs-girdi-kap--fiyat"><input class="hs-girdi" type="text" inputmode="decimal" data-km-fiyat value="' + kacir(kayit.km[arac] != null ? kayit.km[arac] : '') + '" placeholder="0" aria-label="Km başına ücret"><span>₺</span></label></div>' +
                '<div class="hs-pano__satir"><span class="hs-pano__ad"><b>' + ikon('araba') + 'Arabalı Fiyatlar</b><small>Motorlu fiyatlarından, istediğin kutulara fark ekleyerek</small></span>' +
                    '<button type="button" class="hs-dugme" data-fiyat-kopyala>' + ikon('katman') + '<span>Arabalıya Kopyala</span></button></div>' +
            '</div>' +
            '<div class="hs-pano__satir hs-pano__satir--dikey"><span class="hs-pano__ad"><b>Hesaba Giren Kalemler</b><small>Kapalı kalem listede ve tutarda görünmez</small></span><div class="hs-cipler">' +
                TURLER.map(function (t) {
                    return '<button type="button" class="hs-secim" data-tur-gizle="' + t.k + '" aria-pressed="' + !kayit.gizli[t.k] + '">' + ikon(t.ikon) + kacir(t.ad) + '</button>';
                }).join('') + '</div></div>' +
            '<div class="hs-pano__satir"><span class="hs-pano__ad"><b>' + ikon('katman') + 'Kayıtlı Aylar</b><small>Geçmiş ayların panel verisini ve girdilerini sil</small></span>' +
                '<button type="button" class="hs-dugme" data-aylar-ac>' + ikon('sil') + '<span>Ayları Yönet</span></button></div>' +
            '<div class="hs-pano__satir"><span class="hs-pano__ad"><b>' + ikon('kilit') + 'Şifre</b><small>' + (kilitSunucuYok ? 'Sunucu güncellemesi bekleniyor; o zamana kadar şifre sorulmaz.' : 'Hesaplama her açılışta şifre sorar. Şifre hesabında tutulur, her cihazda aynıdır.') + '</small></span>' +
                '<button type="button" class="hs-dugme" data-sifre-degis' + (kilitSunucuYok ? ' disabled' : '') + '>' + ikon('kilit') + '<span>Şifreyi Değiştir</span></button></div>';
    }

    function kopyaUygula() {
        var fark = kopyaFark();
        var moto = nesne(kayit.fiyat.moto);
        var car = {};
        Object.keys(moto).forEach(function (n) {
            var satir = nesne(moto[n]);
            Object.keys(satir).forEach(function (t) {
                if (satir[t] == null || satir[t] === '') return;
                car[n] = car[n] || {};
                car[n][t] = fiyatSayi(num(satir[t]) + (kopyaSecili(n, t) ? fark : 0));
            });
        });
        kayit.fiyat.car = car;
        if (kayit.km.moto != null && kayit.km.car == null) kayit.km.car = kayit.km.moto;
        kaydet();
        d.fiyatKopya = false;
        d.fiyatArac = 'car';
        fiyatCiz();
        listeGecikmeli();
        bildir('Arabalı fiyatlar kopyalandı', 'basari');
    }

    /* Satır ya da sütun: hepsi seçiliyse kaldırır, değilse hepsini seçer */
    function kopyaTopluSec(anahtarlar) {
        kayit.kopya = nesne(kayit.kopya);
        var sec = kayit.kopya.sec = nesne(kayit.kopya.sec);
        var hepsi = anahtarlar.every(function (a) { return sec[a]; });
        anahtarlar.forEach(function (a) { if (hepsi) delete sec[a]; else sec[a] = 1; });
    }

    function fiyatAc() {
        d.fiyatKopya = false;
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

    var kutuDurum = null;   // { tur: 'avans' | 'sifirla' | 'sifre', id }

    /* Sıfırla: seçilen ayın girdileri. Fiyatlar ayrı (Fiyatlar penceresinde). */
    var SIFIR_SECENEK = [
        { k: 'ek', ikon: 'kutu', ad: 'Paket düzeltmeleri', not: 'Hücreye elle yazılan sayılar panel değerine döner', acik: true },
        { k: 'not', ikon: 'not', ad: 'Not değişiklikleri', not: 'Yükseltilen ya da düşürülen notlar panel notuna döner', acik: true },
        { k: 'km', ikon: 'yol', ad: 'Elle yazılan km', not: 'Km desteği açık kuryelerde G10 km kullanılır', acik: true },
        { k: 'diger', ikon: 'karistir', ad: 'Başka hesap paketleri', not: 'Başka hesaptan girilen sayılar silinir', acik: false },
        { k: 'avans', ikon: 'cuzdan', ad: 'Avanslar', not: 'Bu ay girilen bütün avanslar silinir', acik: false },
        { k: 'eksik', ikon: 'eksik', ad: 'Eksik ürün listesi', not: 'Eklenen Excel ve listeden çıkarılan ürünler silinir', acik: false },
        { k: 'veri', ikon: 'geri', ad: 'Panel verisi', not: 'Hesaptaki kayıt silinir; Panelden Al ile yeniden okunur', acik: false },

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
        /* Altta Eksik Ürünler ya da Ayarlar açıksa sayfa kilitli kalır */
        if (el('hsEksik').hidden && el('hsFiyat').hidden) document.body.classList.remove('hs-kaydirma-yok');
        kutuDurum = null;
    }

    /* Ayarlar > Kayıtlı Aylar: hesaptaki panel kayıtları ve bu cihazdaki ay girdileri.
       Seçilen ayların panel verisi (hesaptan) ve/veya girdileri (avans, düzeltme,
       eksik ürün; bu cihazdan) silinir. Fiyatlar ve kurye ayarları kalır. */
    async function aylarYukle() {
        var c = await hsIstek('/api/hesaplama/veri/aylar');
        if (c.j && c.j.ok && Array.isArray(c.j.aylar)) d.aylar = { liste: c.j.aylar };
        else if (c.kod === 404 || (c.j && c.j.error === 'kurulum_bekleniyor')) d.aylar = { liste: [], bekliyor: true };
        else d.aylar = { liste: [], hata: true };
        if (kutuDurum && kutuDurum.tur === 'aylar') kutuCiz();
    }
    function aySatirlari() {
        var sunucu = {};
        ((d.aylar && d.aylar.liste) || []).forEach(function (x) { sunucu[x.ay] = x; });
        var aylar = Object.keys(sunucu);
        Object.keys(kayit.ay).forEach(function (ay) {
            var a = kayit.ay[ay];
            if (/^\d{4}-\d{2}$/.test(ay) && a && (Object.keys(nesne(a.k)).length || a.eksik) && aylar.indexOf(ay) === -1) aylar.push(ay);
        });
        return aylar.sort().reverse().map(function (ay) {
            var a = kayit.ay[ay] || {};
            return { ay: ay, panel: sunucu[ay] || null, girdi: Object.keys(nesne(a.k)).length, eksik: !!a.eksik };
        });
    }
    function aylarKutusu() {
        el('hsKutuBaslik').textContent = 'Kayıtlı Aylar';
        el('hsKutuAlt').textContent = 'Silmek istediğin ayları seç. Fiyatlar ve kurye ayarları değişmez.';
        var g = el('hsKutuGovde');
        if (!d.aylar) { g.innerHTML = '<div class="hs-liste-k hs-liste-k--sik">' + [0, 1, 2].map(function () { return '<span class="hs-iskelet hs-iskelet--satir"></span>'; }).join('') + '</div>'; return; }
        var satirlar = aySatirlari();
        var tur = nesne(d.aySilTur);
        var secili = satirlar.filter(function (x) { return d.aySil[x.ay]; });
        var isaret = '<span class="hs-isaret">' + ikon('tamam') + '</span>';
        g.innerHTML =
            (d.aylar.bekliyor ? '<div class="hs-uyari">' + ikon('kurye') + '<span>Sunucu güncellemesi bekleniyor; yalnız bu cihazdaki girdiler listeleniyor.</span></div>' : '') +
            (d.aylar.hata ? '<div class="hs-uyari hs-uyari--hata">' + ikon('carpi') + '<span>Hesaptaki aylar okunamadı. Biraz sonra tekrar dene.</span></div>' : '') +
            (!satirlar.length ? '<p class="hs-blok__not">Kayıtlı ay yok.</p>' :
            '<div class="hs-liste-k hs-liste-k--sik">' + satirlar.map(function (x) {
                var not = [];
                if (x.panel) not.push('Panel: ' + adet(x.panel.adet) + ' kurye · ' + new Date(x.panel.zaman).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
                if (x.girdi) not.push(adet(x.girdi) + ' kuryede girdi');
                if (x.eksik) not.push('eksik ürün listesi');
                return '<button type="button" class="hs-secenek hs-secenek--sec hs-secenek--ince" data-ay-sec="' + x.ay + '" aria-pressed="' + !!d.aySil[x.ay] + '">' +
                    isaret + '<span><b>' + kacir(ayAdi(x.ay)) + (x.ay === d.ay ? ' · açık ay' : '') + '</b><small>' + kacir(not.join(' · ')) + '</small></span></button>';
            }).join('') + '</div>') +
            '<div class="hs-yz-bas"><b>Silinecekler</b></div>' +
            '<div class="hs-cipler">' +
                '<button type="button" class="hs-secim" data-ay-tur="veri" aria-pressed="' + (tur.veri !== false) + '">' + ikon('geri') + 'Panel verisi</button>' +
                '<button type="button" class="hs-secim" data-ay-tur="girdi" aria-pressed="' + (tur.girdi !== false) + '">' + ikon('cuzdan') + 'Girdiler ve eksik ürün</button>' +
            '</div>' +
            '<div class="hs-pano__alt"><button type="button" class="hs-dugme" data-kapat>Vazgeç</button>' +
                '<button type="button" class="hs-dugme hs-dugme--tehlike" data-ay-sil' + (secili.length && (tur.veri !== false || tur.girdi !== false) ? '' : ' disabled') + '>' + ikon('sil') +
                '<span>' + (secili.length ? adet(secili.length) + ' Ayı Sil' : 'Sil') + '</span></button></div>';
    }
    async function aylariSil() {
        var tur = nesne(d.aySilTur);
        var aylar = Object.keys(d.aySil).filter(function (ay) { return d.aySil[ay]; });
        if (!aylar.length) return;
        var hata = 0;
        for (var i = 0; i < aylar.length; i++) {
            var ay = aylar[i];
            if (tur.veri !== false) {
                d.veri.delete(ay);
                var c = await hsIstek('/api/hesaplama/veri/sil', { ay: ay });
                if (!(c.j && c.j.ok) && c.kod !== 404) hata++;
            }
            if (tur.girdi !== false) delete kayit.ay[ay];
        }
        eksikSurum++;
        kaydet(true);
        d.aySil = {};
        hepsiniCiz();
        bildir(hata ? 'Bazı aylar hesaptan silinemedi' : adet(aylar.length) + ' ay silindi', hata ? 'hata' : 'basari');
        d.aylar = null;
        kutuCiz();
        aylarYukle();
    }

    /* PDF / Yazdır öncesi: hangi kuryeler, kurye özeti, her kurye ayrı sayfa, Genel Toplam.
       Kurye seçimi her açılışta hepsi; seçenekler bu cihazda kalır (kayit.yazdir). */
    var YAZDIR_SECENEK = [
        { k: 'ozet', ad: 'Kurye özeti', not: 'Başta kurye başına ürün sayısı ve tutar tablosu', varsayilan: false },
        { k: 'ayri', ad: 'Her kurye ayrı sayfada', not: 'Kuryeye tek tek vermek için', varsayilan: false },
        { k: 'genel', ad: 'Genel Toplam satırı', not: 'Listenin en sonunda bir kez', varsayilan: true }
    ];
    function yazdirAyari(k) {
        var a = nesne(kayit.yazdir);
        if (a[k] != null) return !!a[k];
        return YAZDIR_SECENEK.filter(function (x) { return x.k === k; })[0].varsayilan;
    }
    function yazdirGruplari() { return eksikCiktisi().filter(function (g) { return !d.yazdirHaric[g.ad]; }); }

    function yazdirKutusu() {
        var hepsi = eksikCiktisi();
        var secili = yazdirGruplari();
        var urun = secili.reduce(function (t, g) { return t + g.satirlar.length; }, 0);
        el('hsKutuBaslik').textContent = 'PDF / Yazdır';
        el('hsKutuAlt').textContent = ayAdi(d.ay) + ' eksik ürün çıktısı. A4 dikey; bir kurye sayfaya sığmazsa bütünüyle sonraki sayfaya geçer.';
        var isaret = '<span class="hs-isaret">' + ikon('tamam') + '</span>';
        el('hsKutuGovde').innerHTML =
            '<div class="hs-yz-bas"><b>Kuryeler</b><span>' + secili.length + ' / ' + hepsi.length + '</span>' +
                '<button type="button" class="hs-dugme hs-dugme--kucuk" data-yz-hepsi>' + (secili.length === hepsi.length ? 'Hiçbirini Seçme' : 'Hepsini Seç') + '</button></div>' +
            '<div class="hs-liste-k hs-liste-k--sik">' + hepsi.map(function (g) {
                var t = g.satirlar.reduce(function (a, x) { return a + x.tutar; }, 0);
                return '<button type="button" class="hs-secenek hs-secenek--sec hs-secenek--mavi hs-secenek--ince" data-yz-kurye="' + kacir(g.ad) + '" aria-pressed="' + !d.yazdirHaric[g.ad] + '">' +
                    isaret + '<span><b>' + kacir(g.ad) + '</b></span><small class="hs-yz-say">' + adet(g.satirlar.length) + ' ürün · ' + para(t) + '</small></button>';
            }).join('') + '</div>' +
            '<div class="hs-yz-bas"><b>Seçenekler</b></div>' +
            '<div class="hs-liste-k hs-liste-k--sik">' + YAZDIR_SECENEK.map(function (x) {
                return '<button type="button" class="hs-secenek hs-secenek--sec hs-secenek--mavi hs-secenek--ince" data-yz-ayar="' + x.k + '" aria-pressed="' + yazdirAyari(x.k) + '">' +
                    isaret + '<span><b>' + kacir(x.ad) + '</b><small>' + kacir(x.not) + '</small></span></button>';
            }).join('') + '</div>' +
            '<div class="hs-pano__alt"><button type="button" class="hs-dugme" data-kapat>Vazgeç</button>' +
                '<button type="button" class="hs-dugme hs-dugme--ana" data-yz-bas' + (secili.length ? '' : ' disabled') + '>' + ikon('yazdir') +
                '<span>Yazdır' + (secili.length ? ' · ' + adet(urun) + ' ürün' : '') + '</span></button></div>';
    }

    function yazdirBas() {
        var g = yazdirGruplari();
        if (!g.length) return;
        var tek = g.length === 1 ? g[0].ad : '';
        kutuKapat();
        global.JBEksik.yazdir(g, {
            baslik: 'Kurye Bazlı Eksik Ürün Raporu',
            alt: ayAdi(d.ay) + ' · ' + aralikYazi(aralik(d.ay)) + (tek ? ' · ' + tek : ''),
            dosya: eksikDosyaAdi('pdf').replace(/\.pdf$/, '') + (tek ? '_' + dosyaAdiYap(tek) : ''),
            ozet: yazdirAyari('ozet'), ayri: yazdirAyari('ayri'), genel: yazdirAyari('genel')
        });
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
        if (kutuDurum.tur === 'yazdir') { yazdirKutusu(); return; }
        if (kutuDurum.tur === 'aylar') { aylarKutusu(); return; }
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
                '<div class="hs-kutu-alt"><span>Brüt <b>' + para(h.brut) + '</b></span><span>Avans <b class="eksi">−' + para(h.avans) + '</b></span>' +
                (h.eksikDus ? '<span>Eksik Ürün <b class="eksi">−' + para(h.eksikDus) + '</b></span>' : '') + '<span>Net <b>' + para(h.net) + '</b></span></div>';
        }
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
                if (s.diger) delete x.diger;
                if (!Object.keys(x).length) delete a.k[id];
            });
            delete a.bagli;
            if (s.eksik) delete a.eksik;
            if (!Object.keys(nesne(a.k)).length && !a.eksik) delete kayit.ay[d.ay];
        }
        if (s.veri) { d.veri.delete(d.ay); hsIstek('/api/hesaplama/veri/sil', { ay: d.ay }); }
        eksikSurum++;
        kaydet(true);
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
    // Eksik ürünler paneli
    // ------------------------------------------------------------------

    function kisaTarih(t) { return t ? t.slice(8, 10) + '.' + t.slice(5, 7) : '–'; }

    function eksikCiz() {
        var e = eksikKaydi();
        var g = el('hsEksikGovde');
        var ayak = el('hsEksikAyak');
        el('hsEksikBaslik').textContent = 'Eksik Ürünler · ' + ayAdi(d.ay);
        var hata = d.eksikHata ? '<div class="hs-uyari hs-uyari--hata">' + ikon('carpi') + '<span>' + kacir(d.eksikHata) + '</span></div>' : '';
        var dosyaGirdi = '<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-eksik-dosya hidden>';
        var rr = aralik(d.ay);
        if (!e || d.eksikYukleniyor) {
            ayak.hidden = true;
            var yok = !d.eksikYukleniyor && d.eksikRapor[d.ay] === 'yok';
            g.innerHTML = hata +
                (yok ? '<div class="hs-uyari">' + ikon('dosya') + '<span>Raporlar\'da ' + kacir(aralikYazi(rr)) + ' tarihli eksik ürün raporu yok. Franchise panelinde Raporlar &gt; Rapor İsteği ile ayın 1\'inden son gününe iste ya da dosyayı kendin ekle.</span>' +
                    '<button type="button" class="hs-dugme hs-dugme--kucuk" data-rapor-al>' + ikon('geri') + '<span>Tekrar Ara</span></button></div>' : '') +
                '<label class="hs-yukle' + (d.eksikYukleniyor ? ' is-yukleniyor' : '') + '" data-yukle>' + dosyaGirdi +
                    '<span class="hs-yukle__im">' + ikon('dosya') + '</span>' +
                    '<strong>' + (d.eksikYukleniyor ? (d.eksikYukMetin === 'Raporlar\'da aranıyor' ? 'Raporlar\'da Aranıyor' : 'Okunuyor') : 'Excel Dosyasını Seç') + '</strong>' +
                    '<span>' + (d.eksikYukleniyor ? (d.eksikYukMetin === 'Raporlar\'da aranıyor' ? aralikYazi(rr) + ' eksik ürün raporu' : d.eksikYukMetin) : 'ya da buraya sürükle · .xlsx') + '</span></label>' +
                (!yok && !d.eksikYukleniyor && !d.ornek ? '<div class="hs-pano__alt"><button type="button" class="hs-dugme" data-rapor-al>' + ikon('indir') + '<span>Raporlar\'dan Al</span></button></div>' : '') +
                '<p class="hs-blok__not">Açılınca franchise panelinin Raporlar sayfasında bu ayın (' + kacir(aralikYazi(rr)) + ') eksik ürün raporu aranır, varsa doğrudan alınır. Ürün Kırılımı ve Sipariş Kırılımı sayfaları birlikte okunur, aynı ürün iki kez sayılmaz. Buradan indirdiğin Kurye Raporu\'nu Excel\'de düzenleyip yeniden de ekleyebilirsin.</p>';
            return;
        }
        var o = eksikOzet();
        var v = d.veri.get(d.ay);
        var kuryeler = v ? v.kuryeler.slice().sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); }) : [];
        var adi = {};
        kuryeler.forEach(function (k) { adi[k.id] = k.ad; });
        var zaman = new Date(e.zaman).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        var ek = [];
        if (e.cift) ek.push(adet(e.cift) + ' tekrar atlandı');
        if (e.ekSiparis) ek.push(adet(e.ekSiparis) + ' sipariş özetten');

        var gruplar = o.gruplar.map(function (gr) {
            var esle = '';
            if (v) {
                esle = '<select class="hs-ek-esle' + (gr.id ? '' : ' is-yok') + '" data-esle="' + kacir(gr.n) + '" aria-label="' + kacir(gr.ad) + ' tablodaki kurye">' +
                    '<option value="-"' + (gr.id ? '' : ' selected') + '>' + (gr.id ? 'Tabloda yok' : 'Tabloda eşleşmedi · seç') + '</option>' +
                    kuryeler.map(function (k) { return '<option value="' + kacir(k.id) + '"' + (k.id === gr.id ? ' selected' : '') + '>' + kacir(k.ad) + '</option>'; }).join('') +
                    '</select>';
            }
            return '<section class="hs-ek-grup" data-grup-id="' + kacir(gr.id || '') + '">' +
                '<header class="hs-ek-grup__bas"><span class="hs-ek-grup__ad"><b>' + kacir(gr.ad) + '</b>' + esle + '</span>' +
                    '<span class="hs-ek-grup__top"><b>' + para(gr.toplam) + '</b><small>' + adet(gr.adet) + ' ürün</small></span></header>' +
                gr.satirlar.map(function (s) {
                    var rozet = (s.depo ? '<i class="hs-rozet hs-rozet--sari">Depo bildirdi</i>' : '') + (s.kupon ? '<i class="hs-rozet">Kupon</i>' : '');
                    return '<div class="hs-ek-satir' + (s.silindi ? ' is-silindi' : '') + '">' +
                        '<span class="hs-ek-satir__tarih">' + kisaTarih(s.tarih) + '</span>' +
                        '<span class="hs-ek-satir__urun"><span>' + kacir(s.urun) + '</span>' + rozet + '</span>' +
                        '<b class="hs-ek-satir__tutar">' + para(s.tutar) + '</b>' +
                        '<button type="button" class="hs-ek-sil" data-eksik-sil="' + s.i + '" title="' + (s.silindi ? 'Listeye geri al' : 'Listeden çıkar') + '" aria-label="' + kacir(s.urun) + (s.silindi ? ' geri al' : ' listeden çıkar') + '">' + ikon(s.silindi ? 'geri' : 'sil') + '</button></div>';
                }).join('') + '</section>';
        }).join('');

        g.innerHTML = hata +
            '<div class="hs-ek-ust"><span class="hs-ek-dosya">' + ikon('dosya') + '<span><b title="' + kacir(e.dosya) + '">' + kacir(e.dosya) + '</b>' +
                '<small>' + adet(e.satirlar.length) + ' ürün · ' + adet(o.gruplar.length) + ' kurye · ' + zaman + (ek.length ? ' · ' + ek.join(' · ') : '') + '</small></span></span>' +
                '<span class="hs-ek-ust__d">' + (d.ornek ? '' : '<button type="button" class="hs-dugme hs-dugme--kucuk" data-rapor-al title="Raporlar\'daki son raporu yeniden al">' + ikon('indir') + '<span>Raporlar\'dan Al</span></button>') +
                '<label class="hs-dugme hs-dugme--kucuk">' + dosyaGirdi + ikon('geri') + '<span>Yeni Dosya</span></label></span></div>' +
            '<div class="hs-ek-islem' + (e.islendi ? ' is-islendi' : '') + '">' +
                '<span class="hs-ek-islem__im">' + ikon(e.islendi ? 'tamam' : 'para') + '</span>' +
                '<span class="hs-ek-islem__metin"><b>' + (e.islendi ? 'Hak edişe eklendi' : 'Hak edişe eklenmedi') + '</b>' +
                    '<small>' + (e.islendi ? 'Tablodaki toplamlar eksik ürün tutarı düşülmüş halde.' : 'Tutarlar tabloda görünür ama toplamdan düşülmez.') + '</small></span>' +
                '<button type="button" class="hs-dugme' + (e.islendi ? '' : ' hs-dugme--ana') + '" data-eksik-isle' + (o.adet || e.islendi ? '' : ' disabled') + '>' + ikon(e.islendi ? 'geri' : 'tamam') + '<span>' + (e.islendi ? 'Hak Edişten Çıkar' : 'Hak Edişe Ekle') + '</span></button></div>' +
            (!v ? '<div class="hs-uyari">' + ikon('kurye') + '<span>Bu ayın kurye verisi alınmadı. Kuryelerle eşleşmesi için tabloda Panelden Al\'a bas.</span></div>'
                : o.eslesmeyen ? '<div class="hs-uyari">' + ikon('kurye') + '<span>' + o.eslesmeyen + ' kurye tabloda eşleşmedi. Adının yanından seç.</span></div>' : '') +
            '<div class="hs-ek-liste">' + gruplar + '</div>';

        ayak.hidden = false;
        el('hsEksikToplam').innerHTML = 'Genel toplam <b>' + para(o.toplam) + '</b>' + (o.silinen ? ' · ' + adet(o.silinen) + ' ürün çıkarıldı' : '');
        ayak.querySelectorAll('[data-eksik-excel], [data-eksik-yazdir]').forEach(function (b) { b.disabled = !o.adet; });
    }

    function eksikAc(id) {
        d.eksikHata = '';
        eksikCiz();
        el('hsEksik').hidden = false;
        if (!eksikKaydi() && !d.eksikRapor[d.ay] && !d.ornek) rapordanAl();
        document.body.classList.add('hs-kaydirma-yok');
        var g = el('hsEksikGovde');
        g.scrollTop = 0;
        if (id) {
            var s = g.querySelector('[data-grup-id="' + id + '"]');
            if (s) { g.scrollTop = s.offsetTop - g.offsetTop - 16; s.classList.add('is-odak'); }
        }
    }
    function eksikKapat() {
        el('hsEksik').hidden = true;
        document.body.classList.remove('hs-kaydirma-yok');
        kaydet(true);
        listeCiz();
        ozetCiz();
    }

    /*
     * Franchise paneli > Raporlar'daki "Eksik Ürünler Raporu" (reportKey
     * discountAndRefundReport.py). Panelin Raporlar sayfasının attığı istekler:
     * liste (POST /generic-report/report-request/list), İndir
     * (GET /generic-report/<id>/download-url/<token> → S3 adresi). Yalnız ayın
     * 1'inden son gününe istenmiş, hazır (status 1) ve bu depoya ait rapor
     * alınır; birden çok varsa en yenisi. Yoksa null: dosya elle eklenir.
     */
    var RAPOR_ANAHTARI = 'discountAndRefundReport.py';
    var S3 = /^https:\/\/[a-z0-9.-]+\.s3[a-z0-9.-]*\.amazonaws\.com\//;

    async function rapordanDosya(ay) {
        if (!global.franchiseOturum) throw hataYap('oturum');
        var o = await global.franchiseOturum.al();
        var r = aralik(ay);
        var uygun = function (x) {
            var b = nesne(x && x.dataReportRequestBody);
            var depolar = Array.isArray(b.warehouse_ids) ? b.warehouse_ids : [];
            return x.reportKey === RAPOR_ANAHTARI && x.status === 1 && typeof x.downloadToken === 'string' && KIMLIK.test(String(x._id)) &&
                String(b.start_date || '').slice(0, 10) === r.bas && String(b.end_date || '').slice(0, 10) === r.son &&
                (!o || !o.depo || !depolar.length || depolar.indexOf(o.depo) !== -1);
        };
        var bulunan = [];
        for (var s = 0; s < 4; s++) {
            if (s) await bekle(400);
            var y = await global.franchiseOturum.istek('/generic-report/report-request/list?limit=50&offset=' + s * 50, { method: 'POST', govde: {} });
            if (!y.ok) throw hataYap('panel');
            var j = await y.json();
            var liste = Array.isArray(j && j.data) ? j.data : [];
            bulunan = bulunan.concat(liste.filter(uygun));
            if (liste.length < 50 || s * 50 + liste.length >= (Number(j && j.totalCount) || 0)) break;
        }
        if (!bulunan.length) return null;
        bulunan.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
        var x = bulunan[0];
        var u = await global.franchiseOturum.istek('/generic-report/' + x._id + '/download-url/' + encodeURIComponent(x.downloadToken));
        if (!u.ok) throw hataYap('panel');
        var adres = String(nesne(await u.json()).url || '');
        if (!S3.test(adres)) throw hataYap('panel');
        var dosya;
        try { dosya = await fetch(adres); } catch (e) { throw hataYap('ag'); }
        if (!dosya.ok) throw hataYap('panel');
        var ad = decodeURIComponent(new URL(adres).pathname.split('/').pop() || '').replace(/_[a-f0-9]{24}(?=\.xlsx$)/i, '');
        return new File([await dosya.blob()], /\.xlsx$/i.test(ad) ? ad.slice(0, 120) : 'Eksik_Urunler_Raporu.xlsx',
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    async function rapordanAl() {
        if (d.eksikYukleniyor) return;
        var ay = d.ay;
        d.eksikHata = '';
        d.eksikYukleniyor = true;
        d.eksikYukMetin = 'Raporlar\'da aranıyor';
        eksikCiz();
        var f = null;
        try { f = await rapordanDosya(ay); }
        catch (e) { d.eksikHata = 'Raporlar okunamadı. ' + hataMetni(e); }
        d.eksikYukleniyor = false;
        if (f) { delete d.eksikRapor[ay]; await eksikDosya(f, 'rapor'); return; }
        if (!d.eksikHata) d.eksikRapor[ay] = 'yok';
        eksikCiz();
    }

    async function eksikDosya(f, kaynak) {
        if (!f || d.eksikYukleniyor) return;
        if (!global.JBEksik) { d.eksikHata = 'Excel okuyucu yüklenemedi. Sayfayı yenile.'; eksikCiz(); return; }
        d.eksikHata = '';
        d.eksikYukleniyor = true;
        d.eksikYukMetin = 'Sayfalar birleştiriliyor';
        eksikCiz();
        try {
            var r = await global.JBEksik.oku(f);
            var ay = r.ay && /^\d{4}-\d{2}$/.test(r.ay) && r.ay <= bugun().slice(0, 7) ? r.ay : d.ay;
            if (ay !== d.ay) { d.ay = ay; d.hata = null; hepsiniCiz(); }
            ayKaydi(true).eksik = {
                dosya: String(f.name || 'Eksik ürünler.xlsx').slice(0, 120), zaman: Date.now(), tur: r.tur, kaynak: kaynak === 'rapor' ? 'rapor' : 'dosya',
                cift: r.cift || 0, ekSiparis: r.ekSiparis || 0, sil: {}, islendi: false,
                satirlar: r.satirlar.map(function (x) {
                    var o = { kurye: x.kurye.slice(0, 80), tarih: x.tarih, urun: x.urun.slice(0, 160), tutar: x.tutar };
                    if (x.kupon) o.kupon = 1;
                    if (x.depo) o.depo = 1;
                    return o;
                })
            };
            eksikSurum++;
            kaydet(true);
            bildir(ayAdi(d.ay) + ': ' + adet(r.satirlar.length) + ' eksik ürün ' + (kaynak === 'rapor' ? 'Raporlar\'dan alındı' : 'eklendi'), 'basari');
        } catch (e) {
            d.eksikHata = e && e.kullanici ? e.message : 'Dosya okunamadı. Franchise panelinden indirilen .xlsx dosyasını ekle.';
        }
        d.eksikYukleniyor = false;
        eksikCiz();
        listeCiz();
        ozetCiz();
    }

    function dosyaAdiYap(t) {
        return String(t).replace(/\s+/g, '_').replace(/[ğüşıöçĞÜŞİÖÇ]/g, function (h) {
            var k = HARF[h.toLocaleLowerCase('tr')];
            return h === h.toLocaleLowerCase('tr') ? k : k.toUpperCase();
        });
    }
    function eksikDosyaAdi(uzanti) { return 'Kurye_Bazli_Eksik_Urun_' + dosyaAdiYap(ayAdi(d.ay)) + '.' + uzanti; }

    function eksikOlaylari() {
        var perde = el('hsEksik');
        perde.addEventListener('click', function (e) {
            if (e.target === perde || e.target.closest('[data-kapat]')) { eksikKapat(); return; }
            var ek = eksikKaydi();
            var b;
            if (e.target.closest('[data-rapor-al]')) { rapordanAl(); return; }
            if (ek && (b = e.target.closest('[data-eksik-sil]'))) {
                var i = b.getAttribute('data-eksik-sil');
                ek.sil = nesne(ek.sil);
                if (ek.sil[i]) delete ek.sil[i]; else ek.sil[i] = 1;
                eksikDegisti();
                var ust = el('hsEksikGovde').scrollTop;
                eksikCiz();
                el('hsEksikGovde').scrollTop = ust;
                return;
            }
            if (ek && e.target.closest('[data-eksik-isle]')) {
                ek.islendi = !ek.islendi;
                eksikDegisti();
                var ust2 = el('hsEksikGovde').scrollTop;
                eksikCiz();
                el('hsEksikGovde').scrollTop = ust2;
                listeCiz(); ozetCiz();
                bildir(ek.islendi ? 'Eksik ürünler hak edişe eklendi, netten düşülüyor' : 'Eksik ürünler hak edişten çıkarıldı', ek.islendi ? 'basari' : 'bilgi');
                return;
            }
            if (e.target.closest('[data-eksik-excel]')) {
                global.JBEksik.excel(eksikCiktisi(), eksikDosyaAdi('xlsx'));
                return;
            }
            if (e.target.closest('[data-eksik-yazdir]')) { d.yazdirHaric = {}; kutuAc('yazdir'); }
        });
        perde.addEventListener('change', function (e) {
            var t = e.target;
            if (t.matches('[data-eksik-dosya]')) { eksikDosya(t.files && t.files[0]); t.value = ''; return; }
            if (t.matches('[data-esle]')) {
                kayit.esle[t.getAttribute('data-esle')] = t.value === '-' ? '' : t.value;
                eksikDegisti();
                var ust = el('hsEksikGovde').scrollTop;
                eksikCiz();
                el('hsEksikGovde').scrollTop = ust;
            }
        });
        perde.addEventListener('dragover', function (e) {
            var y = e.target.closest('[data-yukle]');
            if (!y) return;
            e.preventDefault();
            y.classList.add('is-uzerinde');
        });
        perde.addEventListener('dragleave', function (e) {
            var y = e.target.closest('[data-yukle]');
            if (y && !y.contains(e.relatedTarget)) y.classList.remove('is-uzerinde');
        });
        perde.addEventListener('drop', function (e) {
            var y = e.target.closest('[data-yukle]');
            if (!y) return;
            e.preventDefault();
            y.classList.remove('is-uzerinde');
            eksikDosya(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
        });
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
        el('hsEksikAc').addEventListener('click', function () { eksikAc(null); });
        eksikOlaylari();
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
            if ((b = e.target.closest('[data-diger-ac]'))) {
                var ac = b.getAttribute('aria-pressed') !== 'true';
                d.acik[id] = ac;
                satirYenidenCiz(id);
                if (ac) { var ilk = el('hsListe').querySelector('tr[data-id="' + id + '"] [data-diger]'); if (ilk) ilk.focus(); }
                return;
            }
            if (e.target.closest('[data-avans-ac]')) { kutuAc('avans', id); return; }
            if (e.target.closest('[data-eksik-ac]')) { eksikAc(id); return; }
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
                var panel = r.kendi;
                var s = kuryeAyi(id, true);
                s.ek = nesne(s.ek);
                if (deger === '' || Number(deger) === panel) delete s.ek[tur]; else s.ek[tur] = Number(deger) - panel;
                kaydet(); rakamYaz(tr); return;
            }
            if (t.matches('[data-diger]')) {
                var dg = temizSayi(t.value, false);
                if (dg !== t.value) t.value = dg;
                var s3 = kuryeAyi(id, true);
                s3.diger = nesne(s3.diger);
                if (dg === '' || Number(dg) === 0) delete s3.diger[t.getAttribute('data-diger')]; else s3.diger[t.getAttribute('data-diger')] = Number(dg);
                if (!Object.keys(s3.diger).length) delete s3.diger;
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
            if (kutuDurum.tur === 'aylar') {
                if ((b = e.target.closest('[data-ay-sec]'))) { var sa = b.getAttribute('data-ay-sec'); d.aySil[sa] = !d.aySil[sa]; }
                else if ((b = e.target.closest('[data-ay-tur]'))) { d.aySilTur = nesne(d.aySilTur); var tk = b.getAttribute('data-ay-tur'); d.aySilTur[tk] = d.aySilTur[tk] === false; }
                else if (e.target.closest('[data-ay-sil]')) { aylariSil(); return; }
                else return;
                var ust2 = el('hsKutuGovde').scrollTop;
                kutuCiz();
                el('hsKutuGovde').scrollTop = ust2;
                return;
            }
            if (kutuDurum.tur === 'yazdir') {
                var ust = el('hsKutuGovde').scrollTop;
                if ((b = e.target.closest('[data-yz-kurye]'))) {
                    var ad = b.getAttribute('data-yz-kurye');
                    if (d.yazdirHaric[ad]) delete d.yazdirHaric[ad]; else d.yazdirHaric[ad] = true;
                } else if (e.target.closest('[data-yz-hepsi]')) {
                    var tumu = yazdirGruplari().length === eksikCiktisi().length;
                    d.yazdirHaric = {};
                    if (tumu) eksikCiktisi().forEach(function (g) { d.yazdirHaric[g.ad] = true; });
                } else if ((b = e.target.closest('[data-yz-ayar]'))) {
                    var ak = b.getAttribute('data-yz-ayar');
                    kayit.yazdir = nesne(kayit.yazdir);
                    kayit.yazdir[ak] = !yazdirAyari(ak);
                    kaydet();
                } else if (e.target.closest('[data-yz-bas]')) { yazdirBas(); return; }
                else return;
                kutuCiz();
                el('hsKutuGovde').scrollTop = ust;
                return;
            }
            if (e.target.closest('[data-avans-ekle]')) { avansEkle(); return; }
            if ((b = e.target.closest('[data-avans-sil]'))) {
                var s = kuryeAyi(kutuDurum.id, true);
                if (Array.isArray(s.avans)) s.avans.splice(Number(b.getAttribute('data-avans-sil')), 1);
                kaydet(); kutuCiz(); satirYenidenCiz(kutuDurum.id); return;
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
            if (e.target.closest('[data-aylar-ac]')) { fiyatKapat(); d.aySil = {}; d.aylar = null; kutuAc('aylar', null); aylarYukle(); return; }
            if ((b = e.target.closest('[data-fiyat-arac]'))) { d.fiyatArac = b.getAttribute('data-fiyat-arac'); fiyatCiz(); return; }
            if ((b = e.target.closest('[data-tur-gizle]'))) {
                var k = b.getAttribute('data-tur-gizle');
                if (kayit.gizli[k]) delete kayit.gizli[k];
                else if (gorunenTurler().length > 1) kayit.gizli[k] = true;
                kaydet(); fiyatCiz(); return;
            }
            if (e.target.closest('[data-fiyat-kopyala]')) { d.fiyatKopya = true; fiyatCiz(); el('hsFiyatGovde').scrollTop = 0; return; }
            if (e.target.closest('[data-kopya-vazgec]')) { d.fiyatKopya = false; fiyatCiz(); return; }
            if (e.target.closest('[data-kopya-uygula]')) { kopyaUygula(); return; }
            var turK = gorunenTurler().map(function (t) { return t.k; });
            var anahtarlar = null;
            if ((b = e.target.closest('[data-kopya-hucre]'))) anahtarlar = [b.getAttribute('data-kopya-hucre')];
            else if ((b = e.target.closest('[data-kopya-satir]'))) { var n = b.getAttribute('data-kopya-satir'); anahtarlar = turK.map(function (t) { return n + '|' + t; }); }
            else if ((b = e.target.closest('[data-kopya-sutun]'))) { var t = b.getAttribute('data-kopya-sutun'); anahtarlar = notListesi().map(function (n2) { return n2 + '|' + t; }); }
            if (anahtarlar) {
                /* Motorlu fiyatı boş kutu seçilmez */
                var moto = nesne(kayit.fiyat.moto);
                anahtarlar = anahtarlar.filter(function (a) { var p = a.split('|'); var v = nesne(moto[p[0]])[p[1]]; return v != null && v !== ''; });
                if (!anahtarlar.length) return;
                if (anahtarlar.length === 1) {
                    kayit.kopya = nesne(kayit.kopya);
                    var sec = kayit.kopya.sec = nesne(kayit.kopya.sec);
                    if (sec[anahtarlar[0]]) delete sec[anahtarlar[0]]; else sec[anahtarlar[0]] = 1;
                } else kopyaTopluSec(anahtarlar);
                kaydet();
                var ust = el('hsFiyatGovde').scrollTop;
                fiyatCiz();
                el('hsFiyatGovde').scrollTop = ust;
            }
        });
        perde.addEventListener('input', function (e) {
            var t = e.target;
            if (t.matches('[data-kopya-fark]')) {
                var f = temizSayi(t.value, true);
                if (f !== t.value) t.value = f;
                kayit.kopya = nesne(kayit.kopya);
                kayit.kopya.fark = f === '' ? 0 : num(f);
                kaydet();
                /* Girdi yeniden çizilmez (imleç kaçmasın); yalnız kutular ve sayaç */
                var fk = fiyatSayi(kopyaFark());
                el('hsFiyatGovde').querySelectorAll('[data-kopya-hucre][aria-pressed="true"]').forEach(function (h) {
                    var p = h.getAttribute('data-kopya-hucre').split('|');
                    h.querySelector('b').textContent = fiyatSayi(num(nesne(nesne(kayit.fiyat.moto)[p[0]])[p[1]]) + kopyaFark());
                    h.querySelector('small').textContent = '+' + fk;
                });
                var say = el('hsFiyatGovde').querySelector('.hs-kopya-say');
                var n = el('hsFiyatGovde').querySelectorAll('[data-kopya-hucre][aria-pressed="true"]').length;
                if (say) say.textContent = n ? adet(n) + ' kutu +' + fk + ' ₺' : 'Hepsi motorluyla aynı';
                return;
            }
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
            else if (!el('hsEksik').hidden) eksikKapat();
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
                var dus = [];
                if (x.h.avans) dus.push('avans ' + para(x.h.avans));
                if (x.h.eksikDus) dus.push('eksik ürün ' + para(x.h.eksikDus));
                return x.k.ad + ': ' + para(x.h.net) + (dus.length ? ' (' + dus.join(', ') + ' düşüldü)' : '');
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
        if (!zorla && d.veri.has(ay)) { hepsiniCiz(); return; }
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
        eskiYerelSil();
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
