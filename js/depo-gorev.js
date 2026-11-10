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
 * GÖRSEL
 * Her işin yanında ya Getir ürün görselleri (en çok 3, deste gibi üst üste)
 * ya da kendi çizimimiz (paspas, raf, buz çözme) durur. Ürün görseli
 * düzenleme penceresinde katalogdan aranıp seçilir; katalog (5 MB) yalnız
 * arama açılınca yüklenir.
 *
 * TARAYICI AÇILIR LİSTESİ YOK
 * Grup, sıklık, çizim: hepsi dokunulan düğmeler. Düzenleme alttan açılan
 * pencerede (masaüstünde ortada).
 *
 * KAYIT
 * Sunucuda (sql_files/depo_gorev.sql): depodaki bütün cihazlar aynı listeyi
 * görür. Her tik ayrı satır, iki cihaz aynı anda yazsa da birbirini ezmez.
 * Tablo yoksa (SQL çalışmadıysa) liste bu cihazda saklanır ve bunu yazar.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var GUN_BASI = 8;
    var GECMIS_GUN = 90;
    /* Cihazlar arası eşitleme: 4 sn'de bir yalnız bugünün tikleri ve iş listesi (küçük),
       dakikada bir 90 günlük tam okuma. Pencereye dönülünce hemen sorulur. */
    var YOKLAMA_MS = 4 * 1000;
    var TAM_OKUMA_MS = 60 * 1000;
    /* Kendi yazmamız bitmeden ve bittikten sonraki bu süre içinde gelen okuma ekrana basılmaz:
       tik atılıp sunucuya varmadan eski hali okunursa tik bir an kaybolup geri gelirdi */
    var YAZMA_KORUMA_MS = 1500;
    var KATALOG = '../veri/temp_products.js?v=20261030a';

    var IKON = {
        icecek: '<path d="M9 3h6M10 3v3.5L8 9v10.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5V9l-2-2.5V3"/><path d="M8 13h8"/>',
        raf: '<path d="M4 4v16M20 4v16M4 9h16M4 15h16"/><path d="M7 9V6.5h3V9M13 15v-3h4v3"/>',
        donuk: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
        temizlik: '<path d="M14 3 9.5 12"/><path d="M6 13h8l1 8H5z"/><path d="M8 17v4M11 16v5"/>',
        diger: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'
    };

    /* Kendi çizimlerimiz: 48'lik kare, iki ton (grup rengi + açığı), pırıltılar bir kez parlar */
    var CIZIM = {
        paspas: {
            ad: 'Paspas',
            svg: '<path class="c-d" d="M9 31h19l-2 11H11z"/><path class="c-c" d="M9 31h19M12 36h13"/>' +
                '<path class="c-c" d="M37 5 24.5 33"/><path class="c-d2" d="M17 35.5c3-3.5 11.5-3.5 14.5 0l1 3.5h-16.5z"/>' +
                '<path class="c-p" d="M39 22v5M36.5 24.5h5"/><path class="c-p c-p2" d="M33 13v3M31.5 14.5h3"/>'
        },
        raf: {
            ad: 'Raf Temizliği',
            svg: '<path class="c-c" d="M7 8v33M41 8v33M7 19h34M7 31h34"/>' +
                '<rect class="c-d" x="10" y="10" width="7" height="9" rx="2"/><rect class="c-d" x="19" y="13" width="6" height="6" rx="2"/>' +
                '<rect class="c-d2" x="21" y="23.5" width="14" height="7" rx="2.5" transform="rotate(-10 28 27)"/>' +
                '<path class="c-c" d="M11 27h6" stroke-dasharray="1.5 2.5"/>' +
                '<path class="c-p" d="M36 9v4M34 11h4"/><path class="c-p c-p2" d="M13 34v3M11.5 35.5h3"/>'
        },
        buz: {
            ad: 'Buz Çözme',
            svg: '<rect class="c-d" x="8" y="7" width="22" height="34" rx="5"/><path class="c-c" d="M8 19h22M13 12v3M13 23v7"/>' +
                '<path class="c-c" d="M37 7v12M31.8 10l10.4 6M42.2 10l-10.4 6"/>' +
                '<path class="c-d2" d="M37 26s4.5 5 4.5 8a4.5 4.5 0 0 1-9 0c0-3 4.5-8 4.5-8z"/>' +
                '<path class="c-p" d="M22 26v3M20.5 27.5h3"/>'
        },
        dolap: {
            ad: 'İçecek Dolabı',
            svg: '<rect class="c-d" x="11" y="5" width="26" height="38" rx="5"/><path class="c-c" d="M11 15h26M11 27h26M15 10h4"/>' +
                '<rect class="c-d2" x="15" y="18" width="4" height="9" rx="1.5"/><rect class="c-d2" x="22" y="18" width="4" height="9" rx="1.5"/><rect class="c-d2" x="29" y="18" width="4" height="9" rx="1.5"/>' +
                '<rect class="c-d2" x="15" y="30" width="4" height="9" rx="1.5"/><rect class="c-d2" x="22" y="30" width="4" height="9" rx="1.5"/>' +
                '<path class="c-p" d="M41 9v4M39 11h4"/>'
        },
        kutu: {
            ad: 'Koli Açma',
            svg: '<path class="c-d" d="M7 18 24 11l17 7v19l-17 7-17-7z"/><path class="c-c" d="M7 18l17 7 17-7M24 25v19"/>' +
                '<path class="c-d2" d="M7 18 2 12l17-6 5 5zM41 18l5-6-17-6-5 5z"/><path class="c-p" d="M40 30v3M38.5 31.5h3"/>'
        }
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

    var G = function (u) { return 'https://cdn-image.getir.com/market/product/' + u; };
    var C = function (u) { return 'https://cdn.getir.com/product/' + u; };

    /* İlk açılışta listeye konanlar: [grup, ad, sıklık, sırayla, görseller, çizim] */
    var BASLANGIC = [
        ['icecek', 'Banko altlarına Beypazarı Soda diz', 1, false, [G('c49e1869-ddc8-4c16-ab46-1fbf8a68c786.jpg'), G('cf1c7ea3-e942-4499-9c0a-e532c23e595f.jpg')]],
        ['icecek', 'Meyveli Sodaları diz', 1, false, [G('e065a01a-21ab-46fd-9be7-5cb4f95d53b9.jpg'), G('4ebbac73-b028-4a41-9d74-3bff04c681fc.jpg'), G('6208a43b-0b6e-4450-90f3-bf5a0bade319.jpg')]],
        ['icecek', 'Litrelik İçecekleri diz', 1, false, [G('508b5b51-93f6-4094-bf0a-6d378c6ffef4.jpg'), G('00c97417-3076-436a-8e0d-333cf2dd5608.jpg'), G('ef5f0f10-9db8-4096-b4e2-677b4f2a4fbf.jpg')]],
        ['icecek', 'Küçük İçecekleri diz', 1, false, [G('454b9012-be23-4ce4-b5f1-da82402e41b9.jpg'), G('e86caf0c-8624-4ddc-9a9b-44043fcb007e.jpg'), G('543a64cd-f081-45a6-981a-edd60181c6f3.jpg')]],
        ['icecek', 'Coca-Cola Dolabının stoklarını diz', 1, false, [G('32fc2191-7892-4e5e-8a19-082f7f633c26.jpg'), G('89831b74-4ff3-438e-95fc-96a2abfd8f8f.jpg')]],
        ['icecek', 'Meyveli Kefirleri açıp rafa diz', 2, false, [G('5107c89c-a8f9-4023-989f-9bf0f57499a4.jpg'), G('bbd1ef77-07da-4eb1-acd7-0a1e0b7d3fda.jpg'), G('9a6441ec-f312-4954-8c70-412afda9b282.png')]],
        ['raf', 'Cipsleri diz', 2, false, [G('46368c8b-e99d-4256-8564-6faa8274e683.jpg'), G('d8ff9f16-96a6-408f-bd4e-8aeb37559d8f.jpg'), C('58918837694a6800047644d9_tr_1563866038485.jpeg')]],
        ['raf', 'Abur Cubur Grubunu diz', 2, false, [G('f35ecb54-e65a-4511-9fb4-b5175845ffe7.jpg'), G('3af0e06c-521d-4f38-afd1-03df64f79a68.jpg'), G('e6a571cd-8b8c-4cd0-bfba-c240d82f233e.jpg')]],
        ['raf', 'Çekirdek ve Kuru Yemiş Grubunu diz', 2, false, [C('55984337b1dc700c006a72b3_tr_1561014256952.jpeg'), C('559843f1b1dc700c006a72bf_tr_1602167859805.jpeg')]],
        ['raf', 'Sıvı Yağları diz', 3, false, [G('01294010-e645-42ac-b6a3-ec24deb0ddc7.jpg'), G('f4a1f8d3-ff27-4238-a93f-da80fa708099.jpg'), G('99fa9ad1-dee9-4fb1-9ab3-26ba128e355e.jpg')]],
        ['raf', 'Hazır Yemek ve Noodle Grubunu diz', 3, false, [G('a0c4cb71-2822-4086-98f7-a6fa24c5af79.jpg'), G('76d6a1a8-e439-4836-9ea7-734027e7d6d0.jpg')]],
        ['raf', 'Kedi Mamalarını aç', 3, false, [C('55983faab1dc700c006a724d_tr_1601931914145.jpeg'), C('57f3625bbbfa040003d6c312_tr_1601931163586.jpeg')]],
        ['raf', 'Temizlik Ürünlerini rafa diz', 3, false, [G('203fcf73-85b7-4c47-8f27-6aff0cd175b5.jpg'), C('559840c1b1dc700c006a7281_6a9f6a1b-6bfa-4fe5-9870-9a1470e20ace.jpeg'), C('5928359f5a5ecc000496a93e_tr_1590682483224.jpeg')]],
        ['raf', 'Unları diz', 7, false, [G('3fbedee3-5d6b-47f8-a87c-527e608d5099.jpg')]],
        ['donuk', 'Donuk Dolabın buzunu çöz', 1, true, [], 'buz'],
        ['donuk', 'La Lorraine Donuk Fırın Ürünlerini düzgün diz', 1, false, [C('5f36a342feba7929034a1562_tr_1610972748444.jpeg'), C('5f36a3bfe734034466325225_tr_1610972810517.jpeg')]],
        ['donuk', 'Feast ve SuperFresh Donuk Ürünlerini düzgün diz', 2, false, [G('e840b9db-2028-4ec9-afe6-7656fd7a8176.jpg'), G('204f9ff6-652b-4f01-8012-16ccb0d86f42.jpg'), G('7822a058-aa83-4a65-8b55-62cda1aaa6d0.jpg')]],
        ['temizlik', 'Gece çıkmadan Paspas at', 1, false, [], 'paspas'],
        ['temizlik', 'Rafları sil ve temizle', 1, true, [], 'raf']
    ];

    /* İlk sürümün adları: görseli olmayan eski kayıt yeni ada ve görsele geçer */
    var ESKI_ADLAR = {
        'Banko altlarına Beypazarı soda diz': 0, 'Meyveli sodaları diz': 1, 'Litrelik içecekleri diz': 2, 'Küçük içecekleri diz': 3,
        'Coca-Cola dolabının stoklarını diz': 4, 'Meyveli kefirleri açıp rafa diz': 5, 'Cipsleri diz': 6, 'Abur cubur grubunu diz': 7,
        'Çekirdek ve kuru yemiş grubunu diz': 8, 'Sıvı yağları diz': 9, 'Hazır yemek ve noodle grubunu diz': 10,
        'Kedi mamalarını aç': 11, 'Temizlik ürünlerini rafa diz': 12, 'Unları diz': 13, 'Donuk dolabın buzunu çöz': 14,
        'La Lorraine donuk fırın ürünlerini düzgün diz': 15, 'Feast ve Super Fresh donuk ürünlerini düzgün diz': 16,
        'Gece çıkmadan paspas at': 17, 'Rafları sil ve temizle': 18
    };

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

    function sade(metin) {
        var H = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };
        return String(metin || '').toLocaleLowerCase('tr').replace(/[ığüşöçâîû]/g, function (h) { return H[h] || h; })
            .replace(/[^a-z0-9]+/g, ' ').trim();
    }

    var GORSEL_KALIP = /^https:\/\/([a-z0-9-]+\.)*(getir\.com|getirapi\.com)\/[^\s"'<>]+$/i;
    function gorselTemiz(l) {
        return (Array.isArray(l) ? l : []).map(String).filter(function (u) { return GORSEL_KALIP.test(u); }).slice(0, 3);
    }

    function bildir(metin, tur) {
        if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir(metin, tur || 'bilgi', 3200);
    }

    function svg(ic, sinif) {
        return '<svg class="' + (sinif || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ic + '</svg>';
    }

    var azHareket = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // ------------------------------------------------------------------
    // Kayıt: sunucu, yoksa bu cihaz
    // ------------------------------------------------------------------

    var D = { kullanici: '', yerel: false, gorevler: [], gunler: [], yuklendi: false, tohumlandi: false };

    function tabloYokMu(e) {
        return !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST204' ||
            /does not exist|could not find the table|schema cache/i.test(e.message || ''));
    }

    function yerelAnahtar() { return 'jb_depo_gorev_' + D.kullanici; }

    function jsonOku(anahtar) {
        try {
            var v = JSON.parse(localStorage.getItem(anahtar) || 'null');
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

    function baslangicGorevi(b, i) {
        return { id: kimlik(), ad: b[1], grup: b[0], siklik: b[2], sirali: !!b[3], ogeler: [], gorseller: (b[4] || []).slice(), cizim: b[5] || '', sira: i * 10 };
    }

    function baslangicListesi() { return BASLANGIC.map(baslangicGorevi); }

    function db() { return global.jbDb && global.jbDb.from ? global.jbDb : null; }

    function satirTemiz(g) {
        return {
            id: g.id, ad: String(g.ad || '').slice(0, 120), grup: g.grup || 'diger',
            siklik: Math.max(1, Math.min(60, Number(g.siklik) || 1)),
            sirali: !!g.sirali, ogeler: Array.isArray(g.ogeler) ? g.ogeler.map(String) : [],
            gorseller: gorselTemiz(g.gorseller), cizim: CIZIM[g.cizim] ? g.cizim : '',
            sira: Number(g.sira) || 0
        };
    }

    /* İlk sürümde kurulan, görseli olmayan varsayılan işler yeni yazım ve görsele geçer */
    function eskileriYukselt() {
        var degisen = [];
        D.gorevler.forEach(function (g) {
            var i = ESKI_ADLAR[g.ad];
            if (i === undefined || g.gorseller.length || g.cizim) return;
            var b = BASLANGIC[i];
            g.ad = b[1];
            g.gorseller = (b[4] || []).slice();
            g.cizim = b[5] || '';
            degisen.push(g);
        });
        // Raf temizliği sırayla yapılan işe döndü (buz çözme gibi): her gün bir raf.
        // Yalnız hiç dokunulmamış eski hali (haftalık, sırasız, rafsız) geçer.
        D.gorevler.forEach(function (g) {
            if (g.ad === 'Rafları sil ve temizle' && !g.sirali && !g.ogeler.length && g.siklik === 7) {
                g.sirali = true;
                g.siklik = 1;
                if (degisen.indexOf(g) === -1) degisen.push(g);
            }
        });
        return degisen;
    }

    /* Sırayla yapılan işin öğesine ne denir: raf işinde "Raf", gerisinde "Dolap" */
    function ogeAdi(g) {
        var raf = g.cizim === 'raf' || /\braf/i.test(sade(g.ad));
        return raf ? { tek: 'Raf', cok: 'Raflar', belirtme: 'Rafları', ornek: 'Örn. Atıştırmalık Rafı 1' } : { tek: 'Dolap', cok: 'Dolaplar', belirtme: 'Dolapları', ornek: 'Örn. Dondurma Dolabı 1' };
    }

    async function yukle() {
        var d = db();
        // Her yoklamada sunucu yeniden denenir: tablo kurulduğu an yerel liste aktarılır
        D.yerel = !d;
        if (!D.yerel) {
            var sinir = gunEkle(isGunu(), -GECMIS_GUN);
            var r = await Promise.all([
                d.from('depo_gorev').select('id,ad,grup,siklik,sirali,ogeler,gorseller,cizim,sira').eq('username', D.kullanici).order('sira', { ascending: true }),
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
                // Sunucu tablosu yokken bu cihazda tutulan liste: sunucu boşsa hemen aktarılır,
                // doluysa kullanıcıya sorulur (bkz. aktarimSeridi)
                var yerelKopya = jsonOku(yerelAnahtar());
                D.aktarimBekliyor = null;
                if (yerelKopya && yerelKopya.gorevler.length) {
                    if (!D.gorevler.length) {
                        await yereliSunucuyaYaz(d, yerelKopya, false);
                        return;
                    }
                    D.aktarimBekliyor = yerelKopya;
                }
                if (!D.gorevler.length && !D.gunler.length && !D.tohumlandi) {
                    D.tohumlandi = true;
                    var ilk = baslangicListesi();
                    var y = await d.from('depo_gorev').insert(ilk.map(function (g) { return Object.assign({ username: D.kullanici }, g); }));
                    if (!y.error) D.gorevler = ilk;
                }
                eskileriYukselt().forEach(function (g) { gorevKaydet(g, null, true); });
                D.yuklendi = true;
                onbellekYaz();
                return;
            }
        }
        var v = jsonOku(yerelAnahtar());
        if (v) {
            D.gorevler = v.gorevler.map(satirTemiz);
            D.gunler = Array.isArray(v.gunler) ? v.gunler : [];
            if (eskileriYukselt().length) yerelYaz();
        } else {
            D.gorevler = baslangicListesi();
            D.gunler = [];
            yerelYaz();
        }
        D.yuklendi = true;
    }

    /*
     * Bu cihazın listesini sunucuya yazar. degistir: sunucudaki liste silinip
     * yerine bu cihazdaki konur (kullanıcı seçti). Başarılı olunca yerel kopya silinir.
     */
    async function yereliSunucuyaYaz(d, kopya, degistir) {
        var gorevler = kopya.gorevler.map(satirTemiz);
        var kimlikler = {};
        gorevler.forEach(function (g) { kimlikler[g.id] = true; });
        var sinir = gunEkle(isGunu(), -GECMIS_GUN);
        var gunler = (kopya.gunler || []).filter(function (s) { return kimlikler[s.gorev_id] && s.gun >= sinir; });
        if (degistir) {
            var sil = await d.from('depo_gorev').delete().eq('username', D.kullanici);
            if (sil && sil.error) throw sil.error;
        }
        var r1 = await d.from('depo_gorev').upsert(gorevler.map(function (g) { return Object.assign({ username: D.kullanici }, g); }), { onConflict: 'username,id' });
        if (r1 && r1.error) throw r1.error;
        if (gunler.length) {
            var r2 = await d.from('depo_gorev_gun').upsert(gunler.map(function (s) {
                return { username: D.kullanici, gorev_id: s.gorev_id, gun: s.gun, oge: s.oge || '', yapildi: !!s.yapildi, eklendi: !!s.eklendi, ertelendi: !!s.ertelendi };
            }), { onConflict: 'username,gorev_id,gun,oge' });
            if (r2 && r2.error) throw r2.error;
        }
        try { localStorage.removeItem(yerelAnahtar()); } catch (e) { /* yok */ }
        D.gorevler = gorevler;
        D.gunler = gunler.map(function (s) { return { gorev_id: s.gorev_id, gun: s.gun, oge: s.oge || '', yapildi: !!s.yapildi, eklendi: !!s.eklendi, ertelendi: !!s.ertelendi }; });
        D.aktarimBekliyor = null;
        D.yuklendi = true;
        onbellekYaz();
    }

    /* Yazmalar iyimser: ekran hemen değişir, sunucu arkada; düşerse geri alınır */
    async function sunucuya(is, geriAl) {
        if (D.yerel) { yerelYaz(); return true; }
        D.yaziyor = (D.yaziyor || 0) + 1;
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
        } finally {
            D.yaziyor -= 1;
            D.sonYazma = Date.now();
        }
    }

    function yaziyorMu() { return (D.yaziyor || 0) > 0 || Date.now() - (D.sonYazma || 0) < YAZMA_KORUMA_MS; }

    /* Hafif okuma: iş listesi + bugünün satırları. Eski günler yerinde kalır. */
    async function yukleHafif() {
        var d = db();
        if (!d || D.yerel || !D.yuklendi) return yukle();
        var bugun = isGunu();
        var r = await Promise.all([
            d.from('depo_gorev').select('id,ad,grup,siklik,sirali,ogeler,gorseller,cizim,sira').eq('username', D.kullanici).order('sira', { ascending: true }),
            d.from('depo_gorev_gun').select('gorev_id,gun,oge,yapildi,eklendi,ertelendi').eq('username', D.kullanici).eq('gun', bugun).limit(2000)
        ]);
        if (r[0].error || r[1].error) {
            if (tabloYokMu(r[0].error) || tabloYokMu(r[1].error)) return yukle();
            throw r[0].error || r[1].error;
        }
        if (yaziyorMu()) return;
        D.gorevler = (r[0].data || []).map(satirTemiz);
        var kimlikler = {};
        D.gorevler.forEach(function (g) { kimlikler[g.id] = true; });
        D.gunler = D.gunler.filter(function (s) { return s.gun !== bugun && kimlikler[s.gorev_id]; }).concat((r[1].data || []).map(function (s) {
            return { gorev_id: s.gorev_id, gun: String(s.gun).slice(0, 10), oge: s.oge || '', yapildi: !!s.yapildi, eklendi: !!s.eklendi, ertelendi: !!s.ertelendi };
        }));
        onbellekYaz();
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

    function gorevKaydet(g, eski, sessiz) {
        if (!sessiz) ciz();
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
    // Çizim parçaları
    // ------------------------------------------------------------------

    var kok = null;
    var gorunum = 'bugun';
    var planYon = 'ileri';
    var sonImza = '';
    var gorunumDegisti = true;
    var sonTiklanan = null;
    var oncekiTamam = null;

    var IKON_TIK = '<svg class="gv-tik__isaret" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12.5 3.2 3.2L17 9"/></svg>';
    var IKON_SONRA = '<path d="M5 12h12M13 7l5 5-5 5"/>';
    var IKON_ARTI = '<path d="M12 5v14M5 12h14"/>';
    var IKON_GERI = '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>';
    var IKON_X = '<path d="M7 7l10 10M17 7 7 17"/>';
    var IKON_OK = '<path d="m9 6 6 6-6 6"/>';
    var IKON_ARA = '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>';
    var IKON_RESIM = '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5"/>';

    function gruplanmis(liste) {
        return GRUPLAR.map(function (gr) {
            return { grup: gr, gorevler: liste.filter(function (x) { return grupBul(x.g.grup).ad === gr.ad; }) };
        }).filter(function (x) { return x.gorevler.length; });
    }

    /** İşin görseli: çizim > ürün destesi > grup simgesi. Boyut sabit, resim gelmese de kutu aynı. */
    function karo(g, kucuk) {
        var sinif = 'gv-karo' + (kucuk ? ' gv-karo--kucuk' : '');
        if (g.cizim && CIZIM[g.cizim]) {
            return '<span class="' + sinif + ' gv-karo--cizim" aria-hidden="true"><svg class="gv-cizim" viewBox="0 0 48 48">' + CIZIM[g.cizim].svg + '</svg></span>';
        }
        if (g.gorseller.length) {
            // Önde ilk ürün; birden çok görsel varsa arkasında grup renginde ince katmanlar (deste)
            var kat = kucuk ? 0 : Math.min(2, g.gorseller.length - 1);
            var katlar = '';
            for (var i = 1; i <= kat; i++) katlar += '<i class="gv-karo__kat gv-karo__kat--' + i + '"></i>';
            return '<span class="' + sinif + ' gv-karo--urun" aria-hidden="true">' + katlar +
                '<span class="gv-karo__on"><img src="' + kacis(g.gorseller[0]) + '" alt="" loading="lazy" decoding="async" width="40" height="40" onerror="this.style.visibility=\'hidden\'"></span></span>';
        }
        return '<span class="' + sinif + ' gv-karo--ikon" aria-hidden="true">' + svg(IKON[grupBul(g.grup).ad] || IKON.diger) + '</span>';
    }

    function halka(oran, tamam) {
        var r = 34;
        var cevre = 2 * Math.PI * r;
        var dolu = Math.max(0, Math.min(1, oran));
        return '<svg class="gv-halka' + (tamam ? ' is-tamam' : '') + '" viewBox="0 0 80 80" aria-hidden="true">' +
            '<circle class="gv-halka__iz" cx="40" cy="40" r="' + r + '"/>' +
            '<circle class="gv-halka__dolu" data-olcek="halka" cx="40" cy="40" r="' + r + '" stroke-dasharray="' + cevre.toFixed(2) + '" stroke-dashoffset="' + (cevre * (1 - dolu)).toFixed(2) + '"/>' +
            '</svg>';
    }

    /* Hepsi bitince bir kez: halkanın çevresinde 8 parçacık açılır (kutlama, tek seferlik) */
    function kutlama() {
        var p = '';
        for (var i = 0; i < 8; i++) {
            var a = (i / 8) * Math.PI * 2;
            p += '<i style="--x:' + (Math.cos(a) * 52).toFixed(1) + 'px;--y:' + (Math.sin(a) * 52).toFixed(1) + 'px;--g:' + (i * 25) + 'ms"></i>';
        }
        return '<span class="gv-kutlama" aria-hidden="true">' + p + '</span>';
    }

    function ustKart(bugun, liste) {
        var toplam = liste.length;
        var biten = liste.filter(function (x) { return x.d.yapildi; }).length;
        var tamam = toplam > 0 && biten === toplam;
        var kutla = tamam && oncekiTamam === false && !azHareket;
        oncekiTamam = tamam;
        var seritler = gruplanmis(liste).map(function (x) {
            var b = x.gorevler.filter(function (y) { return y.d.yapildi; }).length;
            return '<div class="gv-serit gv--' + x.grup.renk + '">' +
                '<span class="gv-serit__ad">' + svg(IKON[x.grup.ad] || IKON.diger) + kacis(x.grup.baslik) + '</span>' +
                '<span class="gv-serit__cubuk"><i data-olcek="s-' + x.grup.ad + '" style="transform:scaleX(' + (b / x.gorevler.length).toFixed(3) + ')"></i></span>' +
                '<span class="gv-serit__sayi">' + b + '/' + x.gorevler.length + '</span></div>';
        }).join('');
        return '<section class="gv-ust' + (tamam ? ' is-tamam' : '') + '">' +
            '<div class="gv-ust__halka">' + halka(toplam ? biten / toplam : 0, tamam) + (kutla ? kutlama() : '') +
            '<span class="gv-ust__sayi">' + (tamam ? svg('<path d="m6.5 12.5 3.8 3.8L18 8.5"/>', 'gv-ust__tamam') : '<b>' + biten + '</b><small>/' + toplam + '</small>') + '</span></div>' +
            '<div class="gv-ust__metin"><strong>' + (tamam ? 'Bugünün İşleri Tamam' : toplam ? (toplam - biten) + ' iş kaldı' : 'Bugün iş yok') + '</strong>' +
            '<span>' + kacis(gunAdi(bugun)) + ' · 08:00\'de yenilenir</span>' +
            (D.yerel ? '<span class="gv-ust__uyari">' + svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16v.5"/>') + 'Sunucuda görev tablosu henüz yok: liste ve tikler şimdilik yalnız bu cihazda. Tablo kurulunca bu cihazdaki liste kendiliğinden sunucuya geçer.</span>' : '') +
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
            return '<button type="button" class="gv-cip gv-cip--bos" data-eylem="duzenle-ac">' + svg(IKON_ARTI) + ogeAdi(g).belirtme + ' ekle</button>';
        }
        var t = tur(g, bugun);
        var kalan = g.ogeler.filter(function (o) { return !t.biten[o]; });
        var bitenSayi = g.ogeler.length - kalan.length + kalan.filter(function (o) { return t.bugun[o]; }).length;
        var parcalar = g.ogeler.map(function (o, i) { return '<i class="' + (i < bitenSayi ? 'is-dolu' : '') + '"></i>'; }).join('');
        var cipler = kalan.map(function (o) {
            var yapildi = !!t.bugun[o];
            return '<button type="button" class="gv-cip' + (yapildi ? ' is-tamam' : '') + '" data-eylem="oge" data-oge="' + kacis(o) + '" aria-pressed="' + yapildi + '">' +
                svg('<path d="m6 12.5 3.5 3.5L18 8"/>', 'gv-cip__tik') + kacis(o) + '</button>';
        }).join('');
        return '<div class="gv-tur"><span class="gv-tur__parca" aria-hidden="true">' + parcalar + '</span>' +
            '<span class="gv-tur__yazi">Bu tur ' + bitenSayi + '/' + g.ogeler.length + '</span></div>' +
            '<div class="gv-cipler">' + cipler + '</div>';
    }

    function satirHtml(x, bugun) {
        var g = x.g;
        var d = x.d;
        var tikEylem = g.sirali ? (g.ogeler.length ? '' : 'duzenle-ac') : 'tik';
        var tik = '<button type="button" class="gv-tik' + (g.sirali ? ' gv-tik--sirali' : '') + '"' +
            (tikEylem ? ' data-eylem="' + tikEylem + '"' : ' tabindex="-1"') +
            ' aria-pressed="' + d.yapildi + '" aria-label="' + kacis(g.ad) + (d.yapildi ? ' yapıldı' : ' yapılmadı') + '">' +
            '<span class="gv-tik__kutu">' + IKON_TIK + '</span></button>';
        // Yapılınca düğme kalkar ama yeri kalır: ad yeniden sarılıp satır boyu oynamasın
        var cikar = d.yapildi ? '<span class="gv-ikon-yer" aria-hidden="true"></span>'
            : '<button type="button" class="gv-ikon-dugme" data-eylem="cikar" aria-label="Bugünden çıkar" title="Bugünden çıkar">' + svg(IKON_SONRA) + '</button>';
        return '<div class="gv-satir gv--' + grupBul(g.grup).renk + (d.yapildi ? ' is-tamam' : '') + (sonTiklanan === g.id ? ' is-yeni' : '') + '" data-id="' + g.id + '"' +
            (!g.sirali ? ' data-satir-tik' : '') + '>' + tik + karo(g) +
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
                '<span class="gv-grup__cubuk"><i data-olcek="g-' + x.grup.ad + '" style="transform:scaleX(' + (b / x.gorevler.length).toFixed(3) + ')"></i></span></header>' +
                '<div class="gv-grup__liste">' + x.gorevler.map(function (y) { return satirHtml(y, bugun); }).join('') + '</div></section>';
        }).join('');

        var bos = !liste.length ? '<div class="gv-bos"><svg class="gv-bos__cizim" viewBox="0 0 48 48" aria-hidden="true">' + CIZIM.kutu.svg + '</svg>' +
            '<strong>Bugün Yapılacak İş Yok</strong><span>Sıradakilerden bugüne iş ekleyebilirsin.</span></div>' : '';

        var sirada = disarda.length ? '<section class="gv-sirada"><h3 class="gv-baslik">Sıradakiler</h3><div class="gv-sirada__liste">' +
            disarda.map(function (x) {
                var g = x.g;
                var kalan = fark(x.d.sonraki, bugun);
                var ne = x.d.ertelendi ? 'Bugünden çıkarıldı' : (g.sirali && !g.ogeler.length) ? ogeAdi(g).tek + ' eklenmedi' : kalan <= 1 ? 'Yarın' : kalan + ' gün sonra';
                var dugme = x.d.ertelendi
                    ? '<button type="button" class="gv-kucuk-dugme" data-eylem="geri-al">' + svg(IKON_GERI) + 'Geri al</button>'
                    : (g.sirali && !g.ogeler.length)
                        ? '<button type="button" class="gv-kucuk-dugme" data-eylem="duzenle-ac">' + svg(IKON_ARTI) + ogeAdi(g).tek + '</button>'
                        : '<button type="button" class="gv-kucuk-dugme" data-eylem="ekle">' + svg(IKON_ARTI) + 'Bugüne</button>';
                return '<div class="gv-sira gv--' + grupBul(g.grup).renk + '" data-id="' + g.id + '">' + karo(g, true) +
                    '<span class="gv-sira__metin"><span class="gv-ad">' + kacis(g.ad) + '</span>' +
                    '<span class="gv-sira__alt"><i class="gv-nokta"></i>' + kacis(ne) + ' · ' + kacis(siklikYazi(g.siklik, true)) + '</span></span>' + dugme + '</div>';
            }).join('') + '</div></section>' : '';

        return aktarimSeridi() + ustKart(bugun, liste) + bos + gruplar + sirada;
    }

    /* Sunucuda başka cihazdan gelmiş liste var, bu cihazda da aktarılmamış liste: hangisi kalsın */
    function aktarimSeridi() {
        var k = D.aktarimBekliyor;
        if (!k) return '';
        return '<section class="gv-aktar">' + svg('<path d="M4 7h11M11 3l4 4-4 4M20 17H9M13 13l-4 4 4 4"/>', 'gv-aktar__ikon') +
            '<div class="gv-aktar__metin"><strong>Bu cihazda ayrı bir liste var</strong>' +
            '<span>Sunucu güncellemesinden önce bu cihazda ' + k.gorevler.length + ' işlik bir liste düzenlenmiş. Hangisi kalsın?</span></div>' +
            '<div class="gv-aktar__dugmeler"><button type="button" class="gv-ana-dugme" data-eylem="aktar-yerel">Bu Cihazdakini Kullan</button>' +
            '<button type="button" class="gv-kucuk-dugme" data-eylem="aktar-sunucu">Sunucudakini Kullan</button></div></section>';
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
                    return '<div class="gv-plan__satir"><span class="gv-plan__ad">' + karo(g, true) + '<span>' + kacis(g.ad) + '</span></span>' +
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

    function duzenleHtml() {
        var yeni = '<button type="button" class="gv-yeni-dugme" data-eylem="yeni-ac">' +
            '<span class="gv-yeni-dugme__ikon">' + svg(IKON_ARTI) + '</span><span class="gv-yeni-dugme__metin"><strong>Yeni İş Ekle</strong><small>Ad, grup, sıklık ve görsel seç</small></span>' + svg(IKON_OK, 'gv-yeni-dugme__ok') + '</button>';
        var gruplar = GRUPLAR.map(function (gr) {
            var l = D.gorevler.filter(function (g) { return grupBul(g.grup).ad === gr.ad; });
            if (!l.length) return '';
            return '<section class="gv-grup gv--' + gr.renk + '"><header class="gv-grup__bas"><span class="gv-grup__ikon">' + svg(IKON[gr.ad] || IKON.diger) + '</span>' +
                '<h3>' + kacis(gr.baslik) + '</h3><span class="gv-grup__sayi">' + l.length + ' iş</span></header>' +
                '<div class="gv-grup__liste">' + l.map(function (g) {
                    var alt = siklikYazi(g.siklik) + (g.sirali ? ' · Sırayla, ' + g.ogeler.length + ' ' + ogeAdi(g).tek.toLocaleLowerCase('tr') : '');
                    return '<button type="button" class="gv-duzen" data-id="' + g.id + '" data-eylem="duzenle-ac">' + karo(g) +
                        '<span class="gv-duzen__metin"><span class="gv-ad">' + kacis(g.ad) + '</span><span class="gv-sira__alt">' + kacis(alt) + '</span></span>' +
                        svg(IKON_OK, 'gv-duzen__ok') + '</button>';
                }).join('') + '</div></section>';
        }).join('');
        return yeni + gruplar;
    }

    // ------------------------------------------------------------------
    // Çiz: değerler önceki halinden yeni haline kayar (çubuk, halka)
    // ------------------------------------------------------------------

    function olcekleriOku() {
        var o = {};
        if (!kok) return o;
        Array.prototype.forEach.call(kok.querySelectorAll('[data-olcek]'), function (e) {
            o[e.getAttribute('data-olcek')] = e.tagName.toLowerCase() === 'circle' ? e.getAttribute('stroke-dashoffset') : e.style.transform;
        });
        return o;
    }

    function olcekleriKaydir(eski) {
        if (azHareket) return;
        var hedefler = [];
        Array.prototype.forEach.call(kok.querySelectorAll('[data-olcek]'), function (e) {
            var k = e.getAttribute('data-olcek');
            if (eski[k] === undefined) return;
            if (e.tagName.toLowerCase() === 'circle') {
                var yeni = e.getAttribute('stroke-dashoffset');
                if (eski[k] === yeni) return;
                e.style.transition = 'none';
                e.setAttribute('stroke-dashoffset', eski[k]);
                hedefler.push(function () { e.style.transition = ''; e.setAttribute('stroke-dashoffset', yeni); });
            } else {
                var son = e.style.transform;
                if (eski[k] === son) return;
                e.style.transition = 'none';
                e.style.transform = eski[k];
                hedefler.push(function () { e.style.transition = ''; e.style.transform = son; });
            }
        });
        if (!hedefler.length) return;
        void kok.offsetWidth;
        hedefler.forEach(function (f) { f(); });
    }

    function ciz(yoklama) {
        if (!kok || !D.yuklendi) return;
        var govde = kok.querySelector('.gv-govde');
        var eski = gorunumDegisti ? {} : olcekleriOku();
        govde.innerHTML = gorunum === 'plan' ? planHtml() : gorunum === 'duzenle' ? duzenleHtml() : bugunHtml();
        sonTiklanan = null;
        govde.classList.remove('is-giris');
        if (gorunumDegisti) {
            void govde.offsetWidth;
            govde.classList.add('is-giris');
            gorunumDegisti = false;
        } else if (yoklama !== true) {
            olcekleriKaydir(eski);
        }
        Array.prototype.forEach.call(kok.querySelectorAll('[data-gorunum]'), function (b) {
            b.setAttribute('aria-selected', String(b.getAttribute('data-gorunum') === gorunum));
        });
        sonImza = imza();
    }

    function imza() {
        var bugun = isGunu();
        return JSON.stringify([D.gorevler, D.gunler.length, D.gunler.filter(function (s) { return s.gun === bugun; }), bugun, D.yerel, D.aktarimBekliyor ? D.aktarimBekliyor.gorevler.length : 0]);
    }

    function iskelet() {
        var satir = '<div class="gv-satir gv-satir--iskelet"><span class="gv-tik"><span class="gv-tik__kutu yrd-iskelet"></span></span><span class="gv-karo yrd-iskelet"></span>' +
            '<div class="gv-satir__metin"><span class="yrd-iskelet" style="width:70%;height:16px"></span><span class="yrd-iskelet" style="width:64px;height:16px"></span></div></div>';
        return '<section class="gv-ust"><div class="gv-ust__halka"><span class="yrd-iskelet gv-iskelet-halka"></span></div>' +
            '<div class="gv-ust__metin"><span class="yrd-iskelet" style="width:120px;height:18px"></span><span class="yrd-iskelet" style="width:200px;max-width:100%;height:12px"></span></div></section>' +
            '<section class="gv-grup"><div class="gv-grup__liste">' + satir + satir + satir + satir + '</div></section>';
    }

    // ------------------------------------------------------------------
    // Düzenleme penceresi (alttan açılır; masaüstünde ortada)
    // ------------------------------------------------------------------

    var P = { kok: null, taslak: null, kaynak: null, aramaZaman: null, sonOdak: null, katalogSozu: null };

    function katalogYukle() {
        if (typeof PRODUCTS_DATA !== 'undefined') return Promise.resolve(PRODUCTS_DATA.products || []); // eslint-disable-line no-undef
        if (P.katalogSozu) return P.katalogSozu;
        P.katalogSozu = new Promise(function (coz, red) {
            var s = document.createElement('script');
            s.src = KATALOG;
            s.async = true;
            s.onload = function () {
                if (typeof PRODUCTS_DATA !== 'undefined') coz(PRODUCTS_DATA.products || []); // eslint-disable-line no-undef
                else red(new Error('katalog'));
            };
            s.onerror = function () { P.katalogSozu = null; red(new Error('katalog')); };
            document.head.appendChild(s);
        });
        return P.katalogSozu;
    }

    function pencereKur() {
        if (P.kok) return;
        var k = document.createElement('div');
        k.className = 'gvp gv-kok';
        k.hidden = true;
        k.innerHTML = '<div class="gvp__perde" data-p="kapat"></div>' +
            '<div class="gvp__pano" role="dialog" aria-modal="true" aria-labelledby="gvpBaslik">' +
            '<span class="gvp__tutamak" aria-hidden="true"></span>' +
            '<header class="gvp__bas"><h2 id="gvpBaslik">İşi Düzenle</h2>' +
            '<button type="button" class="gv-ikon-dugme" data-p="kapat" aria-label="Kapat">' + svg(IKON_X) + '</button></header>' +
            '<div class="gvp__govde"></div>' +
            '<footer class="gvp__alt"></footer></div>';
        document.body.appendChild(k);
        P.kok = k;
        k.addEventListener('click', pencereTikla);
        k.addEventListener('input', pencereYazi);
        k.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); pencereKapat(); }
            else if (e.key === 'Enter' && e.target.matches('.gvp-oge-girdi')) { e.preventDefault(); ogeEkle(); }
            else if (e.key === 'Enter' && e.target.matches('.gvp-ad')) { e.preventDefault(); e.target.blur(); }
        });
    }

    function secimDugmeleri(ad, liste, secili, ikonlu) {
        return '<div class="gvp-secim" role="radiogroup" data-alan="' + ad + '">' + liste.map(function (x) {
            var on = String(x.deger) === String(secili);
            return '<button type="button" role="radio" class="gvp-secim__dugme' + (x.renk ? ' gv--' + x.renk : '') + '" data-deger="' + kacis(x.deger) + '" aria-checked="' + on + '">' +
                (ikonlu && x.ikon ? x.ikon : '') + '<span>' + kacis(x.ad) + '</span></button>';
        }).join('') + '</div>';
    }

    function pencereGovde() {
        var t = P.taslak;
        var gruplar = GRUPLAR.map(function (g) { return { deger: g.ad, ad: g.baslik, renk: g.renk, ikon: svg(IKON[g.ad] || IKON.diger) }; });
        var sikliklar = SIKLIKLAR.map(function (s) { return { deger: s[0], ad: s[2] }; });
        var cizimler = [{ deger: '', ad: 'Çizim yok', ikon: svg(IKON_X) }].concat(Object.keys(CIZIM).map(function (k) {
            return { deger: k, ad: CIZIM[k].ad, ikon: '<svg class="gvp-mini-cizim" viewBox="0 0 48 48" aria-hidden="true">' + CIZIM[k].svg + '</svg>' };
        }));
        var secilen = t.gorseller.map(function (u, i) {
            return '<span class="gvp-resim"><img src="' + kacis(u) + '" alt="" width="56" height="56" decoding="async"><button type="button" data-p="resim-cikar" data-i="' + i + '" aria-label="Görseli kaldır">' + svg(IKON_X) + '</button></span>';
        }).join('') + (t.gorseller.length < 3 ? '<span class="gvp-resim gvp-resim--bos" aria-hidden="true">' + svg(IKON_RESIM) + '</span>' : '');
        var dolaplar = t.sirali
            ? '<div class="gvp-alan"><span class="gvp-etiket">' + ogeAdi(t).cok + ' <small>Her gün biri yapılır, tiklenen tur bitene kadar gösterilmez</small></span>' +
              (t.ogeler.length ? '<div class="gv-ogeler">' + t.ogeler.map(function (o, i) {
                  return '<span class="gv-cip gv-cip--duzen">' + kacis(o) + '<button type="button" data-p="oge-sil" data-i="' + i + '" aria-label="' + kacis(o) + ' sil">' + svg(IKON_X) + '</button></span>';
              }).join('') + '</div>' : '') +
              '<div class="gvp-satir"><input class="gv-girdi gvp-oge-girdi" maxlength="80" placeholder="' + ogeAdi(t).ornek + '" autocomplete="off" enterkeyhint="done">' +
              '<button type="button" class="gv-kucuk-dugme" data-p="oge-ekle">' + svg(IKON_ARTI) + 'Ekle</button></div></div>'
            : '';
        return '<div class="gvp-onizleme gv--' + grupBul(t.grup).renk + '">' + karo(t) +
            '<input class="gv-girdi gvp-ad" maxlength="120" placeholder="İşin adı, Örn. Süt Dolabını diz" value="' + kacis(t.ad) + '" autocomplete="off" aria-label="İşin adı"></div>' +
            '<p class="gvp-ipucu">Öne çıkan kelimeler büyük harfle: <b>Beypazarı Soda</b>, <b>Coca-Cola Dolabı</b>.</p>' +
            '<div class="gvp-alan"><span class="gvp-etiket">Grup</span>' + secimDugmeleri('grup', gruplar, t.grup, true) + '</div>' +
            '<div class="gvp-alan"><span class="gvp-etiket">Sıklık</span>' + secimDugmeleri('siklik', sikliklar, t.siklik) + '</div>' +
            '<div class="gvp-alan"><span class="gvp-etiket">Görsel <small>Ürün fotoğrafı (en çok 3) ya da çizim</small></span>' +
            '<div class="gvp-resimler">' + secilen + '</div>' +
            '<label class="gvp-ara">' + svg(IKON_ARA) + '<input class="gvp-ara__girdi" placeholder="Üründen görsel ara: Örn. Kefir" autocomplete="off" enterkeyhint="search" aria-label="Ürün görseli ara"></label>' +
            '<div class="gvp-sonuclar" aria-live="polite"></div>' +
            secimDugmeleri('cizim', cizimler, t.cizim, true) + '</div>' +
            '<div class="gvp-alan gvp-alan--yatay"><span class="gvp-etiket">Sırayla Yapılan İş <small>Dolaplar ya da raflar gibi, her gün biri</small></span>' +
            '<button type="button" role="switch" class="gvp-anahtar" data-p="sirali" aria-checked="' + !!t.sirali + '" aria-label="Sırayla yapılan iş"><i></i></button></div>' +
            dolaplar;
    }

    function pencereCiz(odakKoru) {
        var govde = P.kok.querySelector('.gvp__govde');
        var ara = govde.querySelector('.gvp-ara__girdi');
        var aramaMetni = ara ? ara.value : '';
        var sonuclar = govde.querySelector('.gvp-sonuclar');
        var sonucHtml = sonuclar ? sonuclar.innerHTML : '';
        var kaydir = govde.scrollTop;
        govde.innerHTML = pencereGovde();
        govde.scrollTop = kaydir;
        govde.querySelector('.gvp-ara__girdi').value = aramaMetni;
        if (sonucHtml) {
            govde.querySelector('.gvp-sonuclar').innerHTML = sonucHtml;
            sonucIsaretle();
        }
        if (odakKoru) { var e = govde.querySelector(odakKoru); if (e) e.focus({ preventScroll: true }); }
        var yeni = !P.kaynak;
        P.kok.querySelector('#gvpBaslik').textContent = yeni ? 'Yeni İş' : 'İşi Düzenle';
        P.kok.querySelector('.gvp__alt').innerHTML =
            (yeni ? '' : '<button type="button" class="gvp-sil" data-p="sil">' + svg('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>') + 'Sil</button>') +
            '<button type="button" class="gvp-vazgec" data-p="kapat">Vazgeç</button>' +
            '<button type="button" class="gv-ana-dugme" data-p="kaydet">' + (yeni ? 'Ekle' : 'Kaydet') + '</button>';
    }

    function pencereAc(g) {
        pencereKur();
        P.kaynak = g || null;
        P.taslak = g ? satirTemiz(g) : { id: kimlik(), ad: '', grup: 'raf', siklik: 1, sirali: false, ogeler: [], gorseller: [], cizim: '', sira: 0 };
        P.sonOdak = document.activeElement;
        var govde = P.kok.querySelector('.gvp__govde');
        govde.innerHTML = '';
        pencereCiz();
        govde.scrollTop = 0;
        P.kok.hidden = false;
        document.documentElement.classList.add('gvp-acik');
        void P.kok.offsetWidth;
        P.kok.classList.add('is-acik');
        setTimeout(function () {
            var ad = P.kok.querySelector('.gvp-ad');
            if (ad && !g) ad.focus();
            else { var k = P.kok.querySelector('.gvp__bas .gv-ikon-dugme'); if (k) k.focus({ preventScroll: true }); }
        }, azHareket ? 0 : 230);
    }

    function pencereKapat() {
        if (!P.kok || P.kok.hidden) return;
        P.kok.classList.remove('is-acik');
        document.documentElement.classList.remove('gvp-acik');
        setTimeout(function () {
            if (!P.kok.classList.contains('is-acik')) P.kok.hidden = true;
        }, azHareket ? 0 : 160);
        if (P.sonOdak && P.sonOdak.isConnected) try { P.sonOdak.focus({ preventScroll: true }); } catch (e) { /* yok */ }
    }

    function sonucIsaretle() {
        Array.prototype.forEach.call(P.kok.querySelectorAll('.gvp-sonuc'), function (b) {
            b.setAttribute('aria-pressed', String(P.taslak.gorseller.indexOf(b.getAttribute('data-u')) !== -1));
        });
    }

    function gorselAra(metin) {
        var kap = P.kok.querySelector('.gvp-sonuclar');
        var sorgu = sade(metin);
        if (sorgu.length < 2) { kap.innerHTML = ''; return; }
        if (typeof PRODUCTS_DATA === 'undefined') kap.innerHTML = '<span class="gvp-sonuclar__bilgi">Katalog açılıyor...</span>'; // eslint-disable-line no-undef
        katalogYukle().then(function (urunler) {
            var girdi = P.kok.querySelector('.gvp-ara__girdi');
            if (!girdi || sade(girdi.value) !== sorgu) return;
            var parcalar = sorgu.split(' ');
            var bulunan = [];
            for (var i = 0; i < urunler.length && bulunan.length < 24; i++) {
                var p = urunler[i];
                if (!p || !p.image || !GORSEL_KALIP.test(p.image)) continue;
                var ad = p._gvSade || (p._gvSade = sade(p.name));
                if (parcalar.every(function (x) { return ad.indexOf(x) !== -1; })) bulunan.push(p);
            }
            kap.innerHTML = bulunan.length ? bulunan.map(function (p) {
                return '<button type="button" class="gvp-sonuc" data-p="resim-sec" data-u="' + kacis(p.image) + '" title="' + kacis(p.name) + '" aria-label="' + kacis(p.name) + '">' +
                    '<img src="' + kacis(p.image) + '" alt="" loading="lazy" decoding="async" width="64" height="64">' + svg('<path d="m6 12.5 3.5 3.5L18 8"/>', 'gvp-sonuc__tik') + '</button>';
            }).join('') : '<span class="gvp-sonuclar__bilgi">Bu adla ürün bulunamadı.</span>';
            sonucIsaretle();
        }, function () {
            kap.innerHTML = '<span class="gvp-sonuclar__bilgi">Katalog açılamadı, bağlantıyı kontrol et.</span>';
        });
    }

    function pencereYazi(e) {
        if (e.target.matches('.gvp-ad')) {
            P.taslak.ad = e.target.value;
        } else if (e.target.matches('.gvp-ara__girdi')) {
            clearTimeout(P.aramaZaman);
            var m = e.target.value;
            P.aramaZaman = setTimeout(function () { gorselAra(m); }, 160);
        }
    }

    function ogeEkle() {
        var girdi = P.kok.querySelector('.gvp-oge-girdi');
        if (!girdi) return;
        var o = girdi.value.trim().slice(0, 80);
        if (!o) return;
        if (P.taslak.ogeler.indexOf(o) !== -1) { bildir('Bu ad zaten var.', 'uyari'); return; }
        P.taslak.ogeler.push(o);
        pencereCiz('.gvp-oge-girdi');
    }

    function pencereTikla(e) {
        var secim = e.target.closest('.gvp-secim__dugme');
        if (secim) {
            var alan = secim.closest('[data-alan]').getAttribute('data-alan');
            var deger = secim.getAttribute('data-deger');
            if (alan === 'siklik') P.taslak.siklik = Number(deger) || 1;
            else if (alan === 'grup') P.taslak.grup = deger;
            else if (alan === 'cizim') P.taslak.cizim = deger;
            pencereCiz();
            return;
        }
        var b = e.target.closest('[data-p]');
        if (!b) return;
        var ne = b.getAttribute('data-p');
        if (ne === 'kapat') pencereKapat();
        else if (ne === 'sirali') { P.taslak.sirali = !P.taslak.sirali; pencereCiz(); }
        else if (ne === 'oge-ekle') ogeEkle();
        else if (ne === 'oge-sil') { P.taslak.ogeler.splice(Number(b.getAttribute('data-i')), 1); pencereCiz(); }
        else if (ne === 'resim-cikar') { P.taslak.gorseller.splice(Number(b.getAttribute('data-i')), 1); pencereCiz(); }
        else if (ne === 'resim-sec') {
            var u = b.getAttribute('data-u');
            var yer = P.taslak.gorseller.indexOf(u);
            if (yer !== -1) P.taslak.gorseller.splice(yer, 1);
            else if (P.taslak.gorseller.length >= 3) { bildir('En çok 3 görsel seçilebilir.', 'uyari'); return; }
            else { P.taslak.gorseller.push(u); P.taslak.cizim = ''; }
            pencereCiz();
        } else if (ne === 'kaydet') pencereKaydet();
        else if (ne === 'sil') {
            var g = P.kaynak;
            if (!g) return;
            var onay = global.JBDiyalog && global.JBDiyalog.onay
                ? global.JBDiyalog.onay('"' + g.ad + '" listeden silinsin mi? Geçmiş tikleri de silinir.', { baslik: 'İşi Sil', onayYazi: 'Sil', tehlikeli: true })
                : Promise.resolve(global.confirm('"' + g.ad + '" silinsin mi?'));
            Promise.resolve(onay).then(function (evet) {
                if (!evet) return;
                pencereKapat();
                gorevSil(g);
            });
        }
    }

    function pencereKaydet() {
        var t = P.taslak;
        t.ad = String(t.ad || '').trim();
        if (!t.ad) {
            var ad = P.kok.querySelector('.gvp-ad');
            if (ad) { ad.focus(); ad.classList.add('is-hata'); setTimeout(function () { ad.classList.remove('is-hata'); }, 600); }
            return;
        }
        if (t.sirali && !t.ogeler.length) {
            bildir('Sırayla yapılan işe en az bir ' + ogeAdi(t).tek.toLocaleLowerCase('tr') + ' ekle.', 'uyari');
            var o = P.kok.querySelector('.gvp-oge-girdi');
            if (o) o.focus();
            return;
        }
        var g = P.kaynak;
        if (g) {
            var eski = satirTemiz(g);
            Object.assign(g, satirTemiz(Object.assign({}, t, { id: g.id, sira: g.sira })));
            pencereKapat();
            gorevKaydet(g, eski);
            bildir('"' + g.ad + '" kaydedildi.', 'basari');
        } else {
            t.sira = D.gorevler.reduce(function (m, x) { return Math.max(m, x.sira || 0); }, 0) + 10;
            var yeni = satirTemiz(t);
            D.gorevler.push(yeni);
            pencereKapat();
            gorevKaydet(yeni, null);
            bildir('"' + yeni.ad + '" eklendi.', 'basari');
        }
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

    function titres() { if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { /* yok */ } }

    function tikla(e) {
        var b = e.target.closest('[data-eylem], [data-gorunum]');
        // Satırın boş yerine dokunmak da tik atar (iş adı, görsel)
        if (!b) {
            var satir = e.target.closest('[data-satir-tik]');
            if (satir && kok.contains(satir)) b = satir.querySelector('[data-eylem="tik"]');
        }
        if (!b || !kok.contains(b)) return;
        if (b.hasAttribute('data-gorunum')) { gorunumSec(b.getAttribute('data-gorunum')); return; }
        var eylem = b.getAttribute('data-eylem');
        var g = gorevBul(b);
        var bugun = isGunu();
        if (eylem === 'plan-yon') { planYon = b.getAttribute('data-yon'); ciz(); return; }
        if (eylem === 'yeni-ac') { pencereAc(null); return; }
        if (eylem === 'aktar-yerel' && D.aktarimBekliyor) {
            b.disabled = true;
            yereliSunucuyaYaz(db(), D.aktarimBekliyor, true).then(function () {
                ciz();
                bildir('Bu cihazdaki liste sunucuya aktarıldı; bütün cihazlar bunu görecek.', 'basari');
            }, function () {
                b.disabled = false;
                bildir('Aktarılamadı, bağlantıyı kontrol et.', 'hata');
            });
            return;
        }
        if (eylem === 'aktar-sunucu' && D.aktarimBekliyor) {
            try { localStorage.removeItem(yerelAnahtar()); } catch (x) { /* yok */ }
            D.aktarimBekliyor = null;
            ciz();
            return;
        }
        if (eylem === 'duzenle-ac') { pencereAc(g); return; }
        if (!g) return;
        if (eylem === 'tik') {
            var s = gunSatiri(g.id, bugun, '');
            var yeni = !(s && s.yapildi);
            if (yeni) sonTiklanan = g.id;
            gunAyarla(g.id, '', { yapildi: yeni });
            titres();
        } else if (eylem === 'oge') {
            var oge = b.getAttribute('data-oge');
            var so = gunSatiri(g.id, bugun, oge);
            if (!(so && so.yapildi)) sonTiklanan = g.id;
            gunAyarla(g.id, oge, { yapildi: !(so && so.yapildi) });
            titres();
        } else if (eylem === 'cikar') {
            var d = durum(g, bugun);
            if (d.eklendi) gunAyarla(g.id, '', { eklendi: false });
            else gunAyarla(g.id, '', { ertelendi: true, eklendi: false });
            bildir('"' + g.ad + '" bugünden çıkarıldı.', 'bilgi');
        } else if (eylem === 'ekle') {
            gunAyarla(g.id, '', { eklendi: true, ertelendi: false });
        } else if (eylem === 'geri-al') {
            gunAyarla(g.id, '', { ertelendi: false });
        }
    }

    // ------------------------------------------------------------------
    // Kurulum
    // ------------------------------------------------------------------

    var kurulu = false;
    var sonGun = '';

    var tazeleniyor = false;
    var sonTam = 0;
    async function tazele(tam) {
        if (!kok || document.visibilityState !== 'visible' || kok.closest('[hidden]')) return;
        if (P.kok && !P.kok.hidden) return;
        if (tazeleniyor || yaziyorMu()) return;
        tazeleniyor = true;
        try {
            if (tam === true || Date.now() - sonTam > TAM_OKUMA_MS) {
                var oncekiGorevler = D.gorevler, oncekiGunler = D.gunler;
                await yukle();
                sonTam = Date.now();
                // Okuma sürerken tik atıldıysa onun hali korunur
                if (yaziyorMu()) { D.gorevler = oncekiGorevler; D.gunler = oncekiGunler; return; }
            } else {
                await yukleHafif();
            }
            if (imza() !== sonImza) ciz(true);
        } catch (e) { /* ağ: eldeki liste kalır */ } finally {
            tazeleniyor = false;
        }
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

        // Son bilinen liste beklemeden; sunucu cevabı gelince yerine geçer
        var o = jsonOku(yerelAnahtar() + '_onbellek');
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
                    '<strong>Görevler Okunamadı</strong><span>Bağlantıyı kontrol edip sayfayı yenile.</span></div>';
                return;
            }
        }
        gorunumDegisti = !o;
        ciz();
        sonGun = isGunu();
        setInterval(function () {
            if (isGunu() !== sonGun) { sonGun = isGunu(); oncekiTamam = null; ciz(); }
        }, 60 * 1000);
        sonTam = Date.now();
        setInterval(tazele, YOKLAMA_MS);
        // Sekmeye ya da pencereye dönülünce beklemeden (bilgisayarda pencere değiştirmek visibilitychange vermez)
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') tazele(); });
        global.addEventListener('focus', function () { tazele(); });
        global.addEventListener('pageshow', function (e) { if (e.persisted) tazele(true); });
        global.addEventListener('online', function () { tazele(true); });
    }

    global.JBDepoGorev = { kur: kur, _ic: { durum: durum, tur: tur, planIleri: planIleri, isGunu: isGunu, D: D, pencereAc: pencereAc } };
})(window);
