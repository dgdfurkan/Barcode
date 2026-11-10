/**
 * Depo Görevleri: Yardımcılar > Görevler sekmesi
 * ============================================================================
 *
 * Depodaki tekrar eden işlerin listesi. Her görevin sıklığı var: her gün,
 * 2-3 günde bir, haftada bir. Sıklık "son yapıldığı günden" sayılır; vakti
 * gelen görev o günün listesine düşer.
 *
 * İŞ GÜNÜ 08:00'DE BAŞLAR
 * Gece 02:00'de atılan tik bir önceki iş gününe sayılır. 08:00'de liste
 * yenilenir, dünkü tikler kalkar.
 *
 * BUGÜNE EKLE / BUGÜNDEN ÇIKAR
 * Vakti gelmemiş görev elle o güne eklenebilir; vakti gelmiş görev o günden
 * çıkarılabilir (ertesi gün yine gelir).
 *
 * SIRAYLA YAPILAN İŞ
 * Donuk dolapların buzunu çözmek gibi: öğeler (dolaplar) tanımlanır, her
 * gün biri yapılır. Hangisi tiklendiyse turun geri kalanında gösterilmez;
 * hepsi bitince tur baştan başlar.
 *
 * KAYIT
 * Sunucuda (sql_files/depo_gorev.sql): depodaki bütün cihazlar aynı listeyi
 * görür. Her tik ayrı satır, iki cihaz aynı anda yazsa da birbirini ezmez.
 * Tablo yoksa (SQL çalışmadıysa) liste bu cihazda saklanır ve bunu yazar.
 *
 * Görünüm: Bugün (halka + gruplar), Plan (7 günlük şema), Düzenle.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var GUN_BASI = 8;
    var GECMIS_GUN = 90;
    var YOKLAMA_MS = 30 * 1000;

    var IKON = {
        icecek: '<path d="M9 3h6M10 3v3.5L8 9v10.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5V9l-2-2.5V3"/><path d="M8 13h8"/>',
        raf: '<path d="M4 4v16M20 4v16M4 9h16M4 15h16"/><path d="M7 9V6.5h3V9M13 15v-3h4v3"/>',
        donuk: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
        temizlik: '<path d="M14 3 9.5 12"/><path d="M6 13h8l1 8H5z"/><path d="M8 17v4M11 16v5"/>',
        diger: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'
    };

    var GRUPLAR = [
        { ad: 'icecek', baslik: 'İçecek', renk: 'mavi' },
        { ad: 'raf', baslik: 'Raf Dizimi', renk: 'sari' },
        { ad: 'donuk', baslik: 'Donuk', renk: 'mor' },
        { ad: 'temizlik', baslik: 'Temizlik', renk: 'yesil' },
        { ad: 'diger', baslik: 'Diğer', renk: 'gri' }
    ];

    var SIKLIKLAR = [
        [1, 'Her gün', 'Her gün'],
        [2, '2 günde bir', '2 günde'],
        [3, '3 günde bir', '3 günde'],
        [7, 'Haftada bir', 'Haftalık'],
        [14, '2 haftada bir', '2 haftada']
    ];

    /* İlk açılışta listeye konanlar; Düzenle'den değişir */
    var BASLANGIC = [
        ['icecek', 'Banko altlarına Beypazarı soda diz', 1],
        ['icecek', 'Meyveli sodaları diz', 1],
        ['icecek', 'Litrelik içecekleri diz', 1],
        ['icecek', 'Küçük içecekleri diz', 1],
        ['icecek', 'Coca-Cola dolabının stoklarını diz', 1],
        ['icecek', 'Meyveli kefirleri açıp rafa diz', 2],
        ['raf', 'Cipsleri diz', 2],
        ['raf', 'Abur cubur grubunu diz', 2],
        ['raf', 'Çekirdek ve kuru yemiş grubunu diz', 2],
        ['raf', 'Sıvı yağları diz', 3],
        ['raf', 'Hazır yemek ve noodle grubunu diz', 3],
        ['raf', 'Kedi mamalarını aç', 3],
        ['raf', 'Temizlik ürünlerini rafa diz', 3],
        ['raf', 'Unları diz', 7],
        ['donuk', 'Donuk dolabın buzunu çöz', 1, true],
        ['donuk', 'La Lorraine donuk fırın ürünlerini düzgün diz', 1],
        ['donuk', 'Feast ve Super Fresh donuk ürünlerini düzgün diz', 2],
        ['temizlik', 'Gece çıkmadan paspas at', 1],
        ['temizlik', 'Rafları sil ve temizle', 7]
    ];

    // ------------------------------------------------------------------
    // Yardımcılar
    // ------------------------------------------------------------------

    function kacis(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function kimlik() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function ymd(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /** İş günü: 08:00'den önce bir önceki gün */
    function isGunu() {
        return ymd(new Date(Date.now() - GUN_BASI * 3600 * 1000));
    }

    function gunEkle(gun, n) {
        var p = gun.split('-').map(Number);
        return ymd(new Date(p[0], p[1] - 1, p[2] + n));
    }

    function fark(a, b) {
        var x = a.split('-').map(Number);
        var y = b.split('-').map(Number);
        return Math.round((Date.UTC(x[0], x[1] - 1, x[2]) - Date.UTC(y[0], y[1] - 1, y[2])) / 86400000);
    }

    function gunAdi(gun, kisa) {
        var p = gun.split('-').map(Number);
        var d = new Date(p[0], p[1] - 1, p[2]);
        return d.toLocaleDateString('tr-TR', kisa ? { weekday: 'short' } : { day: 'numeric', month: 'long', weekday: 'long' });
    }

    function siklikYazi(n, kisa) {
        for (var i = 0; i < SIKLIKLAR.length; i++) if (SIKLIKLAR[i][0] === n) return SIKLIKLAR[i][kisa ? 2 : 1];
        return n + ' günde' + (kisa ? '' : ' bir');
    }

    function grupBul(ad) {
        for (var i = 0; i < GRUPLAR.length; i++) if (GRUPLAR[i].ad === ad) return GRUPLAR[i];
        return GRUPLAR[GRUPLAR.length - 1];
    }

    function bildir(metin, tur) {
        if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir(metin, tur || 'bilgi', 3200);
    }

    function svg(ic, sinif) {
        return '<svg class="' + (sinif || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ic + '</svg>';
    }

    // ------------------------------------------------------------------
    // Kayıt: sunucu, yoksa bu cihaz
    // ------------------------------------------------------------------

    var D = {
        kullanici: '',
        yerel: false,
        gorevler: [],
        gunler: [],
        yuklendi: false
    };

    function tabloYokMu(e) {
        return !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST204' ||
            /does not exist|could not find the table|schema cache/i.test(e.message || ''));
    }

    function yerelAnahtar() { return 'jb_depo_gorev_' + D.kullanici; }

    function yerelOku() {
        try {
            var v = JSON.parse(localStorage.getItem(yerelAnahtar()) || 'null');
            if (v && Array.isArray(v.gorevler)) return v;
        } catch (e) { /* bozuk */ }
        return null;
    }

    function yerelYaz() {
        if (!D.yerel) return;
        try {
            var sinir = gunEkle(isGunu(), -GECMIS_GUN);
            D.gunler = D.gunler.filter(function (s) { return s.gun >= sinir; });
            localStorage.setItem(yerelAnahtar(), JSON.stringify({ gorevler: D.gorevler, gunler: D.gunler }));
        } catch (e) { /* kota */ }
    }

    function onbellekYaz() {
        if (D.yerel) return;
        try { localStorage.setItem(yerelAnahtar() + '_onbellek', JSON.stringify({ gorevler: D.gorevler, gunler: D.gunler })); } catch (e) { /* kota */ }
    }

    function onbellekOku() {
        try {
            var v = JSON.parse(localStorage.getItem(yerelAnahtar() + '_onbellek') || 'null');
            if (v && Array.isArray(v.gorevler)) return v;
        } catch (e) { /* bozuk */ }
        return null;
    }

    function baslangicListesi() {
        return BASLANGIC.map(function (b, i) {
            return { id: kimlik(), ad: b[1], grup: b[0], siklik: b[2], sirali: !!b[3], ogeler: [], sira: i * 10 };
        });
    }

    function db() { return global.jbDb && global.jbDb.from ? global.jbDb : null; }

    function satirTemiz(g) {
        return {
            id: g.id, ad: String(g.ad || '').slice(0, 120), grup: g.grup || 'diger',
            siklik: Math.max(1, Math.min(60, Number(g.siklik) || 1)),
            sirali: !!g.sirali, ogeler: Array.isArray(g.ogeler) ? g.ogeler.map(String) : [],
            sira: Number(g.sira) || 0
        };
    }

    async function yukle() {
        var d = db();
        if (!d) {
            D.yerel = true;
        }
        if (!D.yerel) {
            var sinir = gunEkle(isGunu(), -GECMIS_GUN);
            var r = await Promise.all([
                d.from('depo_gorev').select('id,ad,grup,siklik,sirali,ogeler,sira').eq('username', D.kullanici).order('sira', { ascending: true }),
                d.from('depo_gorev_gun').select('gorev_id,gun,oge,yapildi,eklendi,ertelendi').eq('username', D.kullanici).gte('gun', sinir).limit(5000)
            ]);
            if (tabloYokMu(r[0].error) || tabloYokMu(r[1].error)) {
                D.yerel = true;
            } else if (r[0].error || r[1].error) {
                throw r[0].error || r[1].error;
            } else {
                D.gorevler = (r[0].data || []).map(satirTemiz);
                D.gunler = (r[1].data || []).map(function (s) {
                    return { gorev_id: s.gorev_id, gun: String(s.gun).slice(0, 10), oge: s.oge || '', yapildi: !!s.yapildi, eklendi: !!s.eklendi, ertelendi: !!s.ertelendi };
                });
                if (!D.gorevler.length && !D.gunler.length && !D.tohumlandi) {
                    D.tohumlandi = true;
                    var ilk = baslangicListesi();
                    var y = await d.from('depo_gorev').insert(ilk.map(function (g) { return Object.assign({ username: D.kullanici }, g); }));
                    if (!y.error) D.gorevler = ilk;
                }
                D.yuklendi = true;
                onbellekYaz();
                return;
            }
        }
        var v = yerelOku();
        if (v) {
            D.gorevler = v.gorevler.map(satirTemiz);
            D.gunler = Array.isArray(v.gunler) ? v.gunler : [];
        } else {
            D.gorevler = baslangicListesi();
            D.gunler = [];
            yerelYaz();
        }
        D.yuklendi = true;
    }

    /* Yazmalar iyimser: ekran hemen değişir, sunucu arkada; düşerse geri alınır */
    async function sunucuya(is, geriAl) {
        if (D.yerel) { yerelYaz(); return true; }
        try {
            var r = await is(db());
            if (r && r.error) throw r.error;
            onbellekYaz();
            return true;
        } catch (e) {
            if (tabloYokMu(e)) {
                D.yerel = true;
                yerelYaz();
                return true;
            }
            if (geriAl) geriAl();
            bildir('Kaydedilemedi, bağlantıyı kontrol et.', 'hata');
            ciz();
            return false;
        }
    }

    function gunSatiri(gorevId, gun, oge) {
        for (var i = 0; i < D.gunler.length; i++) {
            var s = D.gunler[i];
            if (s.gorev_id === gorevId && s.gun === gun && s.oge === (oge || '')) return s;
        }
        return null;
    }

    function gunAyarla(gorevId, oge, alanlar) {
        var gun = isGunu();
        var s = gunSatiri(gorevId, gun, oge);
        var eski = s ? Object.assign({}, s) : null;
        if (!s) {
            s = { gorev_id: gorevId, gun: gun, oge: oge || '', yapildi: false, eklendi: false, ertelendi: false };
            D.gunler.push(s);
        }
        Object.assign(s, alanlar);
        ciz();
        var govde = Object.assign({ username: D.kullanici, gorev_id: gorevId, gun: gun, oge: oge || '', zaman: new Date().toISOString() }, alanlar);
        return sunucuya(function (d) {
            return d.from('depo_gorev_gun').upsert(govde, { onConflict: 'username,gorev_id,gun,oge' });
        }, function () {
            if (eski) Object.assign(s, eski);
            else D.gunler.splice(D.gunler.indexOf(s), 1);
        });
    }

    function gorevKaydet(g, eski) {
        ciz();
        var govde = Object.assign({ username: D.kullanici, guncellendi_at: new Date().toISOString() }, satirTemiz(g));
        return sunucuya(function (d) {
            return d.from('depo_gorev').upsert(govde, { onConflict: 'username,id' });
        }, function () {
            if (eski) Object.assign(g, eski);
            else D.gorevler.splice(D.gorevler.indexOf(g), 1);
        });
    }

    function gorevSil(g) {
        var yer = D.gorevler.indexOf(g);
        var gunler = D.gunler.filter(function (s) { return s.gorev_id === g.id; });
        D.gorevler.splice(yer, 1);
        D.gunler = D.gunler.filter(function (s) { return s.gorev_id !== g.id; });
        ciz();
        return sunucuya(function (d) {
            return d.from('depo_gorev').delete().eq('username', D.kullanici).eq('id', g.id);
        }, function () {
            D.gorevler.splice(yer, 0, g);
            D.gunler = D.gunler.concat(gunler);
        });
    }

    // ------------------------------------------------------------------
    // Hesap: bugün listede mi, ne zaman sırası gelir, sıralı işte tur
    // ------------------------------------------------------------------

    function durum(g, bugun) {
        var bugunSatir = gunSatiri(g.id, bugun, '') || {};
        var son = null;
        var bugunYapildi = false;
        for (var i = 0; i < D.gunler.length; i++) {
            var s = D.gunler[i];
            if (s.gorev_id !== g.id || !s.yapildi) continue;
            if (s.gun === bugun) bugunYapildi = true;
            else if (s.gun < bugun && (!son || s.gun > son)) son = s.gun;
        }
        var gecen = son ? fark(bugun, son) : null;
        var vakti = (gecen === null || gecen >= g.siklik) && (!g.sirali || g.ogeler.length > 0);
        var bugunde = bugunYapildi || !!bugunSatir.eklendi || (vakti && !bugunSatir.ertelendi);
        var sonraki = son ? gunEkle(son, g.siklik) : bugun;
        if (bugunSatir.ertelendi && sonraki <= bugun) sonraki = gunEkle(bugun, 1);
        return {
            bugunde: bugunde,
            yapildi: bugunYapildi,
            eklendi: !!bugunSatir.eklendi && !vakti,
            ertelendi: !!bugunSatir.ertelendi && !bugunYapildi,
            vakti: vakti,
            gecikme: gecen !== null && gecen > g.siklik ? gecen - g.siklik : 0,
            son: son,
            sonraki: sonraki
        };
    }

    function tur(g, bugun) {
        var onceki = D.gunler
            .filter(function (s) { return s.gorev_id === g.id && s.yapildi && s.oge && s.gun < bugun; })
            .sort(function (a, b) { return a.gun < b.gun ? -1 : a.gun > b.gun ? 1 : 0; });
        var biten = {};
        var sayi = 0;
        onceki.forEach(function (s) {
            if (g.ogeler.indexOf(s.oge) === -1 || biten[s.oge]) return;
            biten[s.oge] = true;
            sayi++;
            if (sayi >= g.ogeler.length) { biten = {}; sayi = 0; }
        });
        var bugunku = {};
        D.gunler.forEach(function (s) {
            if (s.gorev_id === g.id && s.gun === bugun && s.oge && s.yapildi) bugunku[s.oge] = true;
        });
        return { biten: biten, bugun: bugunku };
    }

    /* Plan: önümüzdeki 7 gün. Vakti gelen gün yapılmış sayılır, sıradaki ondan sayılır. */
    function planIleri(g, bugun) {
        var d = durum(g, bugun);
        var son = d.son;
        var hucreler = [];
        for (var i = 0; i < 7; i++) {
            var gun = gunEkle(bugun, i);
            var h;
            if (i === 0) {
                h = d.yapildi ? 'tamam' : d.bugunde ? 'vade' : 'bos';
                if (d.yapildi || d.bugunde) son = bugun;
                else if (d.ertelendi) son = gunEkle(bugun, 1 - g.siklik);
            } else {
                var vade = (!son || fark(gun, son) >= g.siklik) && (!g.sirali || g.ogeler.length > 0);
                h = vade ? 'vade' : 'bos';
                if (vade) son = gun;
            }
            hucreler.push(h);
        }
        return hucreler;
    }

    function planGeri(g, bugun) {
        var hucreler = [];
        for (var i = 6; i >= 0; i--) {
            var gun = gunEkle(bugun, -i);
            var yapildi = D.gunler.some(function (s) { return s.gorev_id === g.id && s.gun === gun && s.yapildi; });
            hucreler.push(yapildi ? 'tamam' : 'bos');
        }
        return hucreler;
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------

    var kok = null;
    var gorunum = 'bugun';
    var planYon = 'ileri';
    var sonImza = '';
    var gorunumDegisti = true;

    var IKON_TIK = '<svg class="gv-tik__isaret" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12.5 3.2 3.2L17 9"/></svg>';
    var IKON_SONRA = '<path d="M5 12h12M13 7l5 5-5 5"/>';
    var IKON_ARTI = '<path d="M12 5v14M5 12h14"/>';
    var IKON_SIL = '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>';
    var IKON_GERI = '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>';
    var IKON_X = '<path d="M7 7l10 10M17 7 7 17"/>';

    function gruplanmis(liste) {
        return GRUPLAR.map(function (gr) {
            return { grup: gr, gorevler: liste.filter(function (x) { return (grupBul(x.g.grup)).ad === gr.ad; }) };
        }).filter(function (x) { return x.gorevler.length; });
    }

    function halka(oran, tamam) {
        var r = 34;
        var cevre = 2 * Math.PI * r;
        var dolu = Math.max(0, Math.min(1, oran));
        return '<svg class="gv-halka' + (tamam ? ' is-tamam' : '') + '" viewBox="0 0 80 80" aria-hidden="true">' +
            '<circle class="gv-halka__iz" cx="40" cy="40" r="' + r + '"/>' +
            '<circle class="gv-halka__dolu" cx="40" cy="40" r="' + r + '" stroke-dasharray="' + cevre.toFixed(2) + '" stroke-dashoffset="' + (cevre * (1 - dolu)).toFixed(2) + '"/>' +
            '</svg>';
    }

    function ustKart(bugun, liste) {
        var toplam = liste.length;
        var biten = liste.filter(function (x) { return x.d.yapildi; }).length;
        var tamam = toplam > 0 && biten === toplam;
        var seritler = gruplanmis(liste).map(function (x) {
            var b = x.gorevler.filter(function (y) { return y.d.yapildi; }).length;
            return '<div class="gv-serit gv--' + x.grup.renk + '" title="' + kacis(x.grup.baslik) + '">' +
                '<span class="gv-serit__ad">' + svg(IKON[x.grup.ad] || IKON.diger) + kacis(x.grup.baslik) + '</span>' +
                '<span class="gv-serit__cubuk"><i style="transform:scaleX(' + (x.gorevler.length ? b / x.gorevler.length : 0).toFixed(3) + ')"></i></span>' +
                '<span class="gv-serit__sayi">' + b + '/' + x.gorevler.length + '</span></div>';
        }).join('');
        return '<section class="gv-ust' + (tamam ? ' is-tamam' : '') + '">' +
            '<div class="gv-ust__halka">' + halka(toplam ? biten / toplam : 0, tamam) +
            '<span class="gv-ust__sayi"><b>' + biten + '</b><small>/' + toplam + '</small></span></div>' +
            '<div class="gv-ust__metin"><strong>' + (tamam ? 'Bugünün işleri tamam' : toplam ? (toplam - biten) + ' iş kaldı' : 'Bugün iş yok') + '</strong>' +
            '<span>' + kacis(gunAdi(bugun)) + ' · 08:00\'de yenilenir</span>' +
            (D.yerel ? '<span class="gv-ust__uyari">Sunucu güncellemesi bekleniyor: işaretler yalnız bu cihazda.</span>' : '') +
            '</div>' +
            (seritler ? '<div class="gv-ust__seritler">' + seritler + '</div>' : '') +
            '</section>';
    }

    function etiketler(g, d) {
        var h = '<span class="gv-hap">' + kacis(siklikYazi(g.siklik, true)) + '</span>';
        if (d.gecikme && !d.yapildi) h += '<span class="gv-hap gv-hap--gec">' + d.gecikme + ' gün gecikti</span>';
        if (d.eklendi) h += '<span class="gv-hap gv-hap--ek">Elle eklendi</span>';
        return '<span class="gv-etiketler">' + h + '</span>';
    }

    function turHtml(g, bugun) {
        if (!g.ogeler.length) {
            return '<button type="button" class="gv-cip gv-cip--bos" data-eylem="duzenle-git">' + svg(IKON_ARTI) + 'Dolapları ekle</button>';
        }
        var t = tur(g, bugun);
        var kalan = g.ogeler.filter(function (o) { return !t.biten[o]; });
        var bitenSayi = g.ogeler.length - kalan.length + kalan.filter(function (o) { return t.bugun[o]; }).length;
        var parcalar = g.ogeler.map(function (o, i) {
            return '<i class="' + (i < bitenSayi ? 'is-dolu' : '') + '"></i>';
        }).join('');
        var cipler = kalan.map(function (o) {
            var yapildi = !!t.bugun[o];
            return '<button type="button" class="gv-cip' + (yapildi ? ' is-tamam' : '') + '" data-eylem="oge" data-oge="' + kacis(o) + '" aria-pressed="' + yapildi + '">' +
                (yapildi ? svg('<path d="m6 12.5 3.5 3.5L18 8"/>') : '') + kacis(o) + '</button>';
        }).join('');
        return '<div class="gv-tur"><span class="gv-tur__parca" aria-hidden="true">' + parcalar + '</span>' +
            '<span class="gv-tur__yazi">Bu tur ' + bitenSayi + '/' + g.ogeler.length + '</span></div>' +
            '<div class="gv-cipler">' + cipler + '</div>';
    }

    function satirHtml(x, bugun) {
        var g = x.g;
        var d = x.d;
        var tikEylem = g.sirali ? (g.ogeler.length ? '' : 'duzenle-git') : 'tik';
        var tik = '<button type="button" class="gv-tik' + (g.sirali ? ' gv-tik--sirali' : '') + '"' +
            (tikEylem ? ' data-eylem="' + tikEylem + '"' : ' tabindex="-1"') +
            ' aria-pressed="' + d.yapildi + '" aria-label="' + kacis(g.ad) + (d.yapildi ? ' yapıldı' : ' yapılmadı') + '">' +
            '<span class="gv-tik__kutu">' + IKON_TIK + '</span></button>';
        // Yapılınca düğme kalkar ama yeri kalır: ad yeniden sarılıp satır boyu oynamasın
        var cikar = d.yapildi ? '<span class="gv-ikon-yer" aria-hidden="true"></span>' : '<button type="button" class="gv-ikon-dugme" data-eylem="cikar" aria-label="Bugünden çıkar" title="Bugünden çıkar">' + svg(IKON_SONRA) + '</button>';
        return '<div class="gv-satir gv--' + grupBul(g.grup).renk + (d.yapildi ? ' is-tamam' : '') + '" data-id="' + g.id + '">' + tik +
            '<div class="gv-satir__metin"><span class="gv-ad">' + kacis(g.ad) + '</span>' + etiketler(g, d) +
            (g.sirali ? turHtml(g, bugun) : '') + '</div>' + cikar + '</div>';
    }

    function bugunHtml() {
        var bugun = isGunu();
        var hepsi = D.gorevler.map(function (g) { return { g: g, d: durum(g, bugun) }; });
        var liste = hepsi.filter(function (x) { return x.d.bugunde; });
        var disarda = hepsi.filter(function (x) { return !x.d.bugunde; })
            .sort(function (a, b) { return a.d.sonraki < b.d.sonraki ? -1 : a.d.sonraki > b.d.sonraki ? 1 : 0; });

        var gruplar = gruplanmis(liste).map(function (x) {
            var b = x.gorevler.filter(function (y) { return y.d.yapildi; }).length;
            return '<section class="gv-grup gv--' + x.grup.renk + '">' +
                '<header class="gv-grup__bas"><span class="gv-grup__ikon">' + svg(IKON[x.grup.ad] || IKON.diger) + '</span>' +
                '<h3>' + kacis(x.grup.baslik) + '</h3><span class="gv-grup__sayi">' + b + '/' + x.gorevler.length + '</span>' +
                '<span class="gv-grup__cubuk"><i style="transform:scaleX(' + (b / x.gorevler.length).toFixed(3) + ')"></i></span></header>' +
                '<div class="gv-grup__liste">' + x.gorevler.map(function (y) { return satirHtml(y, bugun); }).join('') + '</div></section>';
        }).join('');

        var bos = !liste.length ? '<div class="gv-bos">' + svg(IKON.diger) + '<strong>Bugün yapılacak iş yok</strong><span>Aşağıdan bugüne iş ekleyebilirsin.</span></div>' : '';

        var sirada = disarda.length ? '<section class="gv-sirada"><h3 class="gv-baslik">Sıradakiler</h3><div class="gv-sirada__liste">' +
            disarda.map(function (x) {
                var g = x.g;
                var kalan = fark(x.d.sonraki, bugun);
                var ne = x.d.ertelendi ? 'Bugünden çıkarıldı' : (g.sirali && !g.ogeler.length) ? 'Dolap eklenmedi' : kalan <= 1 ? 'Yarın' : kalan + ' gün sonra';
                var dugme = x.d.ertelendi
                    ? '<button type="button" class="gv-kucuk-dugme" data-eylem="geri-al">' + svg(IKON_GERI) + 'Geri al</button>'
                    : (g.sirali && !g.ogeler.length)
                        ? '<button type="button" class="gv-kucuk-dugme" data-eylem="duzenle-git">' + svg(IKON_ARTI) + 'Ekle</button>'
                        : '<button type="button" class="gv-kucuk-dugme" data-eylem="ekle">' + svg(IKON_ARTI) + 'Bugüne</button>';
                return '<div class="gv-sira gv--' + grupBul(g.grup).renk + '" data-id="' + g.id + '">' +
                    '<span class="gv-sira__nokta" aria-hidden="true"></span>' +
                    '<span class="gv-sira__metin"><span class="gv-ad">' + kacis(g.ad) + '</span>' +
                    '<span class="gv-sira__alt">' + kacis(ne) + ' · ' + kacis(siklikYazi(g.siklik, true)) + '</span></span>' + dugme + '</div>';
            }).join('') + '</div></section>' : '';

        return ustKart(bugun, liste) + bos + gruplar + sirada;
    }

    function planHtml() {
        var bugun = isGunu();
        var gunler = [];
        for (var i = 0; i < 7; i++) gunler.push(planYon === 'ileri' ? gunEkle(bugun, i) : gunEkle(bugun, i - 6));
        var bas = '<div class="gv-plan__satir gv-plan__satir--bas"><span class="gv-plan__ad"></span>' + gunler.map(function (g) {
            var p = g.split('-');
            return '<span class="gv-plan__gun' + (g === bugun ? ' is-bugun' : '') + '"><small>' + kacis(gunAdi(g, true)) + '</small><b>' + Number(p[2]) + '</b></span>';
        }).join('') + '</div>';
        var gruplar = GRUPLAR.map(function (gr) {
            var l = D.gorevler.filter(function (g) { return grupBul(g.grup).ad === gr.ad; });
            if (!l.length) return '';
            return '<div class="gv-plan__grup gv--' + gr.renk + '"><span class="gv-plan__grup-ad">' + svg(IKON[gr.ad] || IKON.diger) + kacis(gr.baslik) + '</span>' +
                l.map(function (g) {
                    var h = planYon === 'ileri' ? planIleri(g, bugun) : planGeri(g, bugun);
                    return '<div class="gv-plan__satir"><span class="gv-plan__ad" title="' + kacis(g.ad) + '">' + kacis(g.ad) + '</span>' +
                        h.map(function (c, j) {
                            return '<span class="gv-plan__hucre is-' + c + (gunler[j] === bugun ? ' is-bugun' : '') + '"><i></i></span>';
                        }).join('') + '</div>';
                }).join('') + '</div>';
        }).join('');
        var anahtar = '<div class="gv-plan__anahtar"><span><i class="is-vade"></i>Sırası gelir</span><span><i class="is-tamam"></i>Yapıldı</span><span><i class="is-bos"></i>Boş</span></div>';
        return '<section class="gv-plan">' +
            '<div class="gv-plan__ust"><div class="gv-segment gv-segment--kucuk" role="tablist" aria-label="Plan yönü">' +
            '<button type="button" role="tab" data-eylem="plan-yon" data-yon="geri" aria-selected="' + (planYon === 'geri') + '">Son 7 Gün</button>' +
            '<button type="button" role="tab" data-eylem="plan-yon" data-yon="ileri" aria-selected="' + (planYon === 'ileri') + '">Önümüzdeki 7 Gün</button>' +
            '</div>' + anahtar + '</div>' +
            '<div class="gv-plan__tablo">' + bas + gruplar + '</div></section>';
    }

    function secenekler(liste, secili) {
        return liste.map(function (x) {
            return '<option value="' + kacis(x[0]) + '"' + (String(x[0]) === String(secili) ? ' selected' : '') + '>' + kacis(x[1]) + '</option>';
        }).join('');
    }

    var GRUP_SECENEK = GRUPLAR.map(function (g) { return [g.ad, g.baslik]; });
    var SIKLIK_SECENEK = SIKLIKLAR.map(function (s) { return [s[0], s[1]]; });

    function duzenleHtml() {
        var form = '<form class="gv-yeni" data-eylem="yeni">' +
            '<input class="gv-girdi gv-yeni__ad" name="ad" maxlength="120" placeholder="Yeni iş: Örn. Süt dolabını diz" autocomplete="off" required>' +
            '<select class="gv-girdi" name="grup" aria-label="Grup">' + secenekler(GRUP_SECENEK, 'raf') + '</select>' +
            '<select class="gv-girdi" name="siklik" aria-label="Sıklık">' + secenekler(SIKLIK_SECENEK, 1) + '</select>' +
            '<button type="submit" class="gv-ana-dugme">' + svg(IKON_ARTI) + 'Ekle</button></form>';
        var gruplar = GRUPLAR.map(function (gr) {
            var l = D.gorevler.filter(function (g) { return grupBul(g.grup).ad === gr.ad; });
            if (!l.length) return '';
            return '<section class="gv-grup gv--' + gr.renk + '"><header class="gv-grup__bas"><span class="gv-grup__ikon">' + svg(IKON[gr.ad] || IKON.diger) + '</span>' +
                '<h3>' + kacis(gr.baslik) + '</h3><span class="gv-grup__sayi">' + l.length + ' iş</span></header>' +
                '<div class="gv-grup__liste">' + l.map(function (g) {
                    var ogeler = g.sirali
                        ? '<div class="gv-ogeler">' + g.ogeler.map(function (o) {
                            return '<span class="gv-cip gv-cip--duzen">' + kacis(o) + '<button type="button" data-eylem="oge-sil" data-oge="' + kacis(o) + '" aria-label="' + kacis(o) + ' sil">' + svg(IKON_X) + '</button></span>';
                        }).join('') +
                        '<form class="gv-oge-ekle" data-eylem="oge-ekle"><input class="gv-girdi" name="oge" maxlength="80" placeholder="Dolap adı, Örn. Dondurma 1" autocomplete="off"><button type="submit" class="gv-kucuk-dugme">' + svg(IKON_ARTI) + 'Ekle</button></form></div>'
                        : '';
                    return '<div class="gv-duzen" data-id="' + g.id + '">' +
                        '<input class="gv-girdi gv-duzen__ad" data-alan="ad" value="' + kacis(g.ad) + '" maxlength="120" aria-label="İş adı">' +
                        '<div class="gv-duzen__alt">' +
                        '<select class="gv-girdi" data-alan="siklik" aria-label="Sıklık">' + secenekler(SIKLIK_SECENEK, g.siklik) + '</select>' +
                        '<select class="gv-girdi" data-alan="grup" aria-label="Grup">' + secenekler(GRUP_SECENEK, grupBul(g.grup).ad) + '</select>' +
                        '<label class="gv-anahtar"><input type="checkbox" data-alan="sirali"' + (g.sirali ? ' checked' : '') + '><span>Sırayla</span></label>' +
                        '<button type="button" class="gv-ikon-dugme gv-ikon-dugme--sil" data-eylem="sil" aria-label="' + kacis(g.ad) + ' sil" title="Sil">' + svg(IKON_SIL) + '</button>' +
                        '</div>' + ogeler + '</div>';
                }).join('') + '</div></section>';
        }).join('');
        var not = '<p class="gv-not">Sırayla: dolap gibi öğeleri olan iş. Her gün biri yapılır; tiklenen tur bitene kadar gösterilmez.</p>';
        return form + not + gruplar;
    }

    function ciz(yoklama) {
        if (!kok) return;
        var govde = kok.querySelector('.gv-govde');
        if (!D.yuklendi) return;
        var html = gorunum === 'plan' ? planHtml() : gorunum === 'duzenle' ? duzenleHtml() : bugunHtml();
        // Düzenle'de yazarken arka plan yoklaması listeyi yeniden çizmesin (kullanıcının kendi işi çizer)
        if (yoklama === true && gorunum === 'duzenle' && kok.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
        govde.innerHTML = html;
        govde.classList.remove('is-giris');
        if (gorunumDegisti) {
            void govde.offsetWidth;
            govde.classList.add('is-giris');
            gorunumDegisti = false;
        }
        Array.prototype.forEach.call(kok.querySelectorAll('[data-gorunum]'), function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-gorunum') === gorunum));
        });
        sonImza = imza();
    }

    function imza() {
        return JSON.stringify([D.gorevler, D.gunler.length, D.gunler.filter(function (s) { return s.gun === isGunu(); }), isGunu(), D.yerel]);
    }

    function iskelet() {
        var satir = '<div class="gv-satir gv-satir--iskelet"><span class="gv-tik"><span class="gv-tik__kutu yrd-iskelet"></span></span>' +
            '<div class="gv-satir__metin"><span class="yrd-iskelet" style="width:70%;height:16px"></span><span class="yrd-iskelet" style="width:64px;height:16px"></span></div></div>';
        return '<section class="gv-ust"><div class="gv-ust__halka"><span class="yrd-iskelet gv-iskelet-halka"></span></div>' +
            '<div class="gv-ust__metin"><span class="yrd-iskelet" style="width:120px;height:18px"></span><span class="yrd-iskelet" style="width:200px;max-width:100%;height:12px"></span></div></section>' +
            '<section class="gv-grup"><div class="gv-grup__liste">' + satir + satir + satir + satir + '</div></section>';
    }

    // ------------------------------------------------------------------
    // Olaylar
    // ------------------------------------------------------------------

    function gorevBul(el) {
        var k = el && el.closest('[data-id]');
        if (!k) return null;
        var id = k.getAttribute('data-id');
        for (var i = 0; i < D.gorevler.length; i++) if (D.gorevler[i].id === id) return D.gorevler[i];
        return null;
    }

    function gorunumSec(ad) {
        if (ad === gorunum) return;
        gorunum = ad;
        gorunumDegisti = true;
        try { localStorage.setItem('jb_depo_gorev_gorunum', ad); } catch (e) { /* yok */ }
        ciz();
    }

    function tikla(e) {
        var b = e.target.closest('[data-eylem], [data-gorunum]');
        if (!b || !kok.contains(b)) return;
        if (b.hasAttribute('data-gorunum')) { gorunumSec(b.getAttribute('data-gorunum')); return; }
        var eylem = b.getAttribute('data-eylem');
        var g = gorevBul(b);
        var bugun = isGunu();
        if (eylem === 'plan-yon') { planYon = b.getAttribute('data-yon'); gorunumDegisti = false; ciz(); return; }
        if (eylem === 'duzenle-git') { gorunumSec('duzenle'); return; }
        if (!g) return;
        if (eylem === 'tik') {
            var s = gunSatiri(g.id, bugun, '');
            gunAyarla(g.id, '', { yapildi: !(s && s.yapildi) });
            if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { /* yok */ }
        } else if (eylem === 'oge') {
            var oge = b.getAttribute('data-oge');
            var so = gunSatiri(g.id, bugun, oge);
            gunAyarla(g.id, oge, { yapildi: !(so && so.yapildi) });
            if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { /* yok */ }
        } else if (eylem === 'cikar') {
            var d = durum(g, bugun);
            if (d.eklendi) gunAyarla(g.id, '', { eklendi: false });
            else gunAyarla(g.id, '', { ertelendi: true, eklendi: false });
            bildir('"' + g.ad + '" bugünden çıkarıldı.', 'bilgi');
        } else if (eylem === 'ekle') {
            gunAyarla(g.id, '', { eklendi: true, ertelendi: false });
        } else if (eylem === 'geri-al') {
            gunAyarla(g.id, '', { ertelendi: false });
        } else if (eylem === 'oge-sil') {
            var o = b.getAttribute('data-oge');
            var eski = { ogeler: g.ogeler.slice() };
            g.ogeler = g.ogeler.filter(function (x) { return x !== o; });
            gorevKaydet(g, eski);
        } else if (eylem === 'sil') {
            var onay = global.JBDiyalog && global.JBDiyalog.onay
                ? global.JBDiyalog.onay('"' + g.ad + '" listeden silinsin mi? Geçmiş tikleri de silinir.', { baslik: 'İşi Sil', onayYazi: 'Sil', tehlikeli: true })
                : Promise.resolve(global.confirm('"' + g.ad + '" silinsin mi?'));
            Promise.resolve(onay).then(function (evet) { if (evet) gorevSil(g); });
        }
    }

    function degisti(e) {
        var el = e.target;
        var alan = el.getAttribute && el.getAttribute('data-alan');
        if (!alan) return;
        var g = gorevBul(el);
        if (!g) return;
        var eski = { ad: g.ad, siklik: g.siklik, grup: g.grup, sirali: g.sirali };
        if (alan === 'ad') {
            var ad = el.value.trim();
            if (!ad || ad === g.ad) { el.value = g.ad; return; }
            g.ad = ad;
        } else if (alan === 'siklik') g.siklik = Number(el.value) || 1;
        else if (alan === 'grup') g.grup = el.value;
        else if (alan === 'sirali') g.sirali = !!el.checked;
        gorunumDegisti = false;
        el.blur();
        gorevKaydet(g, eski);
    }

    function gonder(e) {
        var f = e.target;
        var eylem = f.getAttribute('data-eylem');
        if (!eylem) return;
        e.preventDefault();
        if (eylem === 'yeni') {
            var ad = f.elements.ad.value.trim();
            if (!ad) return;
            var grup = f.elements.grup.value;
            var enSon = D.gorevler.reduce(function (m, g) { return Math.max(m, g.sira || 0); }, 0);
            var g = { id: kimlik(), ad: ad, grup: grup, siklik: Number(f.elements.siklik.value) || 1, sirali: false, ogeler: [], sira: enSon + 10 };
            D.gorevler.push(g);
            gorevKaydet(g, null);
            var yeni = kok.querySelector('.gv-yeni__ad');
            if (yeni) { yeni.value = ''; yeni.focus(); }
            bildir('"' + ad + '" eklendi.', 'basari');
        } else if (eylem === 'oge-ekle') {
            var gg = gorevBul(f);
            var oge = f.elements.oge.value.trim().slice(0, 80);
            if (!gg || !oge) return;
            if (gg.ogeler.indexOf(oge) !== -1) { bildir('Bu ad zaten var.', 'uyari'); return; }
            var eski = { ogeler: gg.ogeler.slice() };
            gg.ogeler = gg.ogeler.concat([oge]);
            gorunumDegisti = false;
            gorevKaydet(gg, eski).then(function () {
                var g2 = kok.querySelector('.gv-duzen[data-id="' + gg.id + '"] .gv-oge-ekle input');
                if (g2) g2.focus();
            });
        }
    }

    // ------------------------------------------------------------------
    // Kurulum
    // ------------------------------------------------------------------

    var kurulu = false;
    var sonGun = '';

    async function tazele() {
        if (!kok || document.visibilityState !== 'visible' || kok.closest('[hidden]')) return;
        try {
            await yukle();
            if (imza() !== sonImza) ciz(true);
        } catch (e) { /* ağ: eldeki liste kalır */ }
    }

    async function kur(hedef, kullanici) {
        if (kurulu) return;
        kurulu = true;
        kok = hedef;
        D.kullanici = kullanici;
        try { gorunum = localStorage.getItem('jb_depo_gorev_gorunum') || 'bugun'; } catch (e) { gorunum = 'bugun'; }
        if (['bugun', 'plan', 'duzenle'].indexOf(gorunum) === -1) gorunum = 'bugun';
        kok.innerHTML =
            '<div class="gv-segment" role="tablist" aria-label="Görev görünümü">' +
            '<button type="button" role="tab" data-gorunum="bugun">Bugün</button>' +
            '<button type="button" role="tab" data-gorunum="plan">Plan</button>' +
            '<button type="button" role="tab" data-gorunum="duzenle">Düzenle</button></div>' +
            '<div class="gv-govde" aria-live="polite"></div>';
        Array.prototype.forEach.call(kok.querySelectorAll('[data-gorunum]'), function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-gorunum') === gorunum));
        });
        kok.addEventListener('click', tikla);
        kok.addEventListener('change', degisti);
        kok.addEventListener('submit', gonder);

        // Son bilinen liste beklemeden; sunucu cevabı gelince yerine geçer
        var o = onbellekOku();
        if (o) {
            D.gorevler = o.gorevler.map(satirTemiz);
            D.gunler = o.gunler || [];
            D.yuklendi = true;
            ciz();
        } else {
            kok.querySelector('.gv-govde').innerHTML = iskelet();
        }
        try {
            await yukle();
        } catch (e) {
            if (!D.yuklendi) {
                kok.querySelector('.gv-govde').innerHTML = '<div class="gv-bos gv-bos--hata">' + svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16v.5"/>') +
                    '<strong>Görevler okunamadı</strong><span>Bağlantıyı kontrol edip sayfayı yenile.</span></div>';
                return;
            }
        }
        gorunumDegisti = !o;
        ciz();
        sonGun = isGunu();
        setInterval(function () {
            if (isGunu() !== sonGun) { sonGun = isGunu(); ciz(); }
        }, 60 * 1000);
        setInterval(tazele, YOKLAMA_MS);
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') tazele(); });
    }

    global.JBDepoGorev = { kur: kur, _ic: { durum: durum, tur: tur, planIleri: planIleri, isGunu: isGunu, D: D } };
})(window);
