/**
 * Telegram Raporları (/telegram/)
 * ============================================================================
 *
 * Sekmeler, hepsi tek ayar nesnesinde (vps-api/telegram-ayar.js):
 *   Gece Raporu     ayar.gece: saatler (en çok 4), özet kartı ve sayımlar
 *   Kaldırma        ayar.kaldirmaRapor: kendi saatleri; gruplar, fotoğraf, sebepler
 *   İtiraz          ayar.itirazRapor: kendi saatleri; bekleyen/sonuçlanan,
 *                   siparişin içeriği, kurye ve toplayıcı. Önizlemeden ve
 *                   gönderimden önce siparişi henüz okunmamış kayıtlar bu
 *                   tarayıcıdaki franchise oturumuyla okunur (siparisleriTazele)
 *   Anlık Bildirim  ayar.anlik: satıştan kaldırma durum değişince giden mesaj
 *   Elle Gönderim   ayar.kaldirmaGonder: Satıştan Kaldırma sayfasındaki
 *                   "Telegram'a Gönder" panelinin açılış seçimi
 *   DPS, Kurye CDI  ayar.performans.dps / .kurye: ayrı raporlar, ayrı saatler;
 *                   veri kontrolü (.kontrol) ortak. Zamanlı gönderimi Asistan
 *                   yapar (arka-plan/performans.js), elle gönderim ve önizleme
 *                   bu tarayıcıdaki franchise oturumuyla
 *
 * ÖNİZLEME
 *   Sunucu Telegram'a gidecek kartların aynısını çizer (720 px). Ayar
 *   değişince 700 ms bekleyip istenir; eski sonuç yenisi gelene kadar
 *   soluk kalır (yerleşim zıplamaz). Sunucuda 2 dk önbellek, dakikada 15.
 *
 * KAYIT
 *   "Kaydet" ayarı sunucuya yazar; telefon ve bilgisayar aynı ayarı görür.
 *   "Kendime Gönder" ekrandaki (kaydedilmemiş olabilir) ayarla bağlı
 *   Telegram hesaplarına deneme gönderir.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var ONIZLEME_BEKLE_MS = 700;
    var SAAT_ADIM = 30;
    var EN_COK_SAAT = 4;

    var d = {
        sekme: 'gece',
        veri: 'gercek',
        ayar: null,
        kayitli: null,
        varsayilan: null,
        kurulum: true,
        hesaplar: [],
        sebepler: [],
        son: null,
        bot: true,
        onizleme: { no: 0, zaman: null, sonuc: {}, yukleniyor: false },
        pf: { bas: null, son: null },
        // Satıştan Kaldırma önizleme ve Kendime Gönder aralığı; son24: zamanlı raporun penceresi
        kr: { tur: 'son24', bas: null, son: null },
        kaydediyor: false,
        gonderiyor: false
    };

    function el(id) { return document.getElementById(id); }

    function kacis(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function bildir(metin, tur) {
        if (global.JBDiyalog && global.JBDiyalog.bildir) global.JBDiyalog.bildir(metin, tur || 'bilgi', 4200);
    }

    var kopya = function (o) { return JSON.parse(JSON.stringify(o)); };
    var saatYazi = function (dk) { return String(Math.floor(dk / 60)).padStart(2, '0') + ':' + String(dk % 60).padStart(2, '0'); };

    var IKON = {
        tik: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3 3 7-7"/></svg>',
        carpi: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>',
        arti: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10"/></svg>',
        saat: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>',
        ozet: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.5"/><rect x="11" y="3.5" width="5.5" height="5.5" rx="1.5"/><rect x="3.5" y="11" width="5.5" height="5.5" rx="1.5"/><rect x="11" y="11" width="5.5" height="5.5" rx="1.5"/></svg>',
        kaldirma: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 6h13M8.5 9v5M11.5 9v5M4.5 6l.8 9.5a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5L15.5 6M7.5 6V3.5h5V6"/></svg>',
        itiraz: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5h13v9h-8l-5 3.5z"/><path d="M7 8h6M7 10.5h4"/></svg>',
        sayim: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="3.5" width="11" height="13.5" rx="2"/><path d="M7.5 3.5h5V6h-5z"/><path d="m7.5 11 1.8 1.8 3.4-3.6"/></svg>',
        zil: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5a4.5 4.5 0 0 0-4.5 4.5v3l-1.5 2.5h12L14.5 11V8A4.5 4.5 0 0 0 10 3.5zM8.5 16a1.5 1.5 0 0 0 3 0"/></svg>',
        mesaj: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3.5 3v-3a2 2 0 0 1-2-2z"/></svg>',
        gonder: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3.5 9.5 13-6-4 13-2.5-5.5z"/><path d="m10 11 6.5-7.5"/></svg>',
        bos: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 10h8M8 14h5"/></svg>',
        uyari: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/></svg>',
        siparis: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6.5h11l-1 9.5h-9z"/><path d="M7.5 8V5.5a2.5 2.5 0 0 1 5 0V8"/></svg>',
        kisi: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="3"/><path d="M4.5 16.5a5.5 5.5 0 0 1 11 0"/></svg>'
    };

    /* Sekme → ayar alanı (zamanlı raporlar) */
    var BOLUM = { gece: 'gece', kaldirma: 'kaldirmaRapor', itiraz: 'itirazRapor' };

    // ------------------------------------------------------------------
    // Ayar okuma ve yazma (yol: 'kaldirmaRapor.red.goster')
    // ------------------------------------------------------------------

    function al(yol) {
        return yol.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, d.ayar);
    }

    function koy(yol, deger) {
        var parca = yol.split('.');
        var o = d.ayar;
        for (var i = 0; i < parca.length - 1; i++) o = o[parca[i]];
        o[parca[parca.length - 1]] = deger;
        degisti();
    }

    function degistiMi() { return JSON.stringify(d.ayar) !== JSON.stringify(d.kayitli); }

    function degisti() {
        ayarCiz();
        cubukCiz();
        onizlemeBayatla();
    }

    /* Düzenlerken önizleme kendiliğinden yenilenmez (her tıkta istek gitmesin,
       tarih aralığının yarısında Getir'e gidilmesin). Önizleme soluklaşır,
       "Önizlemeyi Güncelle" öne çıkar; kullanıcı basınca yenilenir. */
    function onizlemeBayatla() {
        d.onizleme.bayat = onizlemeAnahtari() !== d.onizleme.goster;
        guncelleDugmesi();
        el('tgOnizleme').classList.toggle('is-eski', d.onizleme.bayat || d.onizleme.yukleniyor);
    }

    function guncelleDugmesi() {
        var b = el('tgGuncelle');
        if (!b) return;
        var bayat = !!d.onizleme.bayat && !d.onizleme.yukleniyor;
        b.disabled = !bayat;
        b.classList.toggle('is-vurgu', bayat);
        b.querySelector('span').textContent = d.onizleme.yukleniyor ? 'Güncelleniyor' : bayat ? 'Önizlemeyi Güncelle' : 'Güncel';
    }

    // ------------------------------------------------------------------
    // Sunucu
    // ------------------------------------------------------------------

    async function istek(yol, govde) {
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

    function hataMetni(c) {
        var k = c && c.j && c.j.error;
        if (c && c.kod === 401) return 'Oturum doldu. Sayfayı yenileyip tekrar giriş yap.';
        if (k === 'kurulum_bekleniyor' || (c && c.kod === 404)) return 'Sunucu güncellemesi bekleniyor.';
        if (k === 'baglanti_yok') return 'Telegram bağlı değil. Önce Telegram\'ı bağla.';
        if (k === 'bot_hazir_degil') return 'Telegram botu şu an hazır değil.';
        if (k === 'cok_sik') return 'Çok sık gönderildi. ' + ((c.j && c.j.bekleSn) || 120) + ' saniye sonra tekrar dene.';
        if (k === 'gunluk_sinir') return 'Bugünkü deneme sınırı doldu.';
        if (k === 'cok_istek') return 'Çok sık istendi. Birkaç saniye sonra tekrar dene.';
        if (k === 'bos') return 'Bu ayarla gönderilecek bir şey yok.';
        if (k === 'hak_yok') return 'Bu özellik hesabında kapalı.';
        if (c && c.kod === 0) return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.';
        return 'İşlem yapılamadı. Biraz sonra tekrar dene.';
    }

    // ------------------------------------------------------------------
    // Ayar bileşenleri (HTML). data-odak: yeniden çizimde odak geri gelir.
    // ------------------------------------------------------------------

    function anahtar(yol, pasif, etiket) {
        return '<span class="tg-anahtar"><input type="checkbox" data-yol="' + yol + '" data-odak="a:' + yol + '"' +
            (al(yol) ? ' checked' : '') + (pasif ? ' disabled' : '') + ' aria-label="' + kacis(etiket || '') + '"><i></i></span>';
    }

    function satirAnahtar(ad, aciklama, yol, pasif) {
        return '<div class="tg-satir' + (pasif ? ' is-pasif' : '') + '"><span class="tg-satir__metin"><b>' + kacis(ad) + '</b>' +
            (aciklama ? '<small>' + kacis(aciklama) + '</small>' : '') + '</span>' + anahtar(yol, pasif, ad) + '</div>';
    }

    function segment(yol, secenekler, etiket, pasif) {
        var deger = al(yol);
        return '<div class="tg-segment" role="radiogroup" aria-label="' + kacis(etiket) + '">' + secenekler.map(function (s) {
            return '<button type="button" role="radio" data-seg-yol="' + yol + '" data-deger="' + kacis(JSON.stringify(s[0])) + '"' +
                ' data-odak="s:' + yol + ':' + kacis(String(s[0])) + '" aria-checked="' + (deger === s[0]) + '"' + (pasif ? ' disabled' : '') + '>' + kacis(s[1]) + '</button>';
        }).join('') + '</div>';
    }

    function satirSegment(ad, aciklama, yol, secenekler, pasif) {
        return '<div class="tg-satir' + (pasif ? ' is-pasif' : '') + '"><span class="tg-satir__metin"><b>' + kacis(ad) + '</b>' +
            (aciklama ? '<small>' + kacis(aciklama) + '</small>' : '') + '</span>' + segment(yol, secenekler, ad, pasif) + '</div>';
    }

    function cip(yol, ad, pasif) {
        return '<button type="button" class="tg-cip" data-cip-yol="' + yol + '" data-odak="c:' + yol + '" aria-pressed="' + !!al(yol) + '"' +
            (pasif ? ' disabled' : '') + '><i>' + IKON.tik + '</i>' + kacis(ad) + '</button>';
    }

    /** Satıştan kaldırma grubu: göster anahtarı + fotoğraf çipi */
    function grupSatiri(ad, aciklama, taban) {
        var acik = !!al(taban + '.goster');
        return '<div class="tg-satir' + (acik ? '' : ' is-pasif') + '"><span class="tg-satir__metin"><b>' + kacis(ad) + '</b><small>' + kacis(aciklama) + '</small></span>' +
            '<span class="tg-grup">' + cip(taban + '.foto', 'Fotoğraf', !acik) + anahtar(taban + '.goster', false, ad) + '</span></div>';
    }

    function kartHtml(o) {
        var kapali = o.anahtar && !al(o.anahtar);
        return '<section class="tg-kart' + (kapali ? ' is-kapali' : '') + '">' +
            '<div class="tg-kart__bas"><span class="tg-kart__ikon">' + o.ikon + '</span>' +
                '<div class="tg-kart__metin"><h3>' + kacis(o.baslik) + '</h3>' + (o.aciklama ? '<p>' + kacis(o.aciklama) + '</p>' : '') + '</div>' +
                (o.anahtar ? anahtar(o.anahtar, false, o.baslik) : '') + '</div>' +
            (o.govde ? '<div class="tg-kart__govde">' + o.govde + '</div>' : '') +
            '</section>';
    }

    function saatlerHtml(yol) {
        yol = yol || 'gece.saatler';
        var saatler = al(yol) || [60];
        var tek = saatler.length === 1;
        var secenek = '';
        for (var dk = 0; dk < 1440; dk += SAAT_ADIM) {
            if (saatler.indexOf(dk) === -1) secenek += '<option value="' + dk + '">' + saatYazi(dk) + '</option>';
        }
        return '<div class="tg-saatler">' + saatler.map(function (dk) {
            return '<span class="tg-saat' + (tek ? ' is-tek' : '') + '">' + saatYazi(dk) +
                (tek ? '' : '<button type="button" data-saat-sil="' + dk + '" data-saat-yol="' + yol + '" data-odak="sil:' + yol + dk + '" aria-label="' + saatYazi(dk) + ' saatini kaldır">' + IKON.carpi + '</button>') + '</span>';
        }).join('') +
            (saatler.length < EN_COK_SAAT
                ? '<label class="tg-saat-ekle">' + IKON.arti + 'Saat Ekle<select data-saat-ekle data-saat-yol="' + yol + '" data-odak="saat-ekle:' + yol + '" aria-label="Rapor saati ekle"><option value="">Saat seç</option>' + secenek + '</select></label>'
                : '') +
            '</div>';
    }

    function sebeplerHtml() {
        if (!d.sebepler.length) return '<p class="tg-satir__metin"><small>Son 60 günde kayıt yok; bütün sebepler gönderilir.</small></p>';
        var secili = al('kaldirmaRapor.sebepler');
        var hepsi = !secili;
        return '<div class="tg-cipler">' +
            '<button type="button" class="tg-cip" data-sebep-hepsi data-odak="sebep-hepsi" aria-pressed="' + hepsi + '"><i>' + IKON.tik + '</i>Bütün Sebepler</button>' +
            d.sebepler.map(function (s) {
                var acik = hepsi || secili.indexOf(s.ad) !== -1;
                return '<button type="button" class="tg-cip" data-sebep="' + kacis(s.ad) + '" data-odak="sebep:' + kacis(s.ad) + '" aria-pressed="' + acik + '"><i>' + IKON.tik + '</i>' +
                    kacis(s.ad) + '<small>' + s.adet + '</small></button>';
            }).join('') + '</div>';
    }

    // ------------------------------------------------------------------
    // Sekmeler
    // ------------------------------------------------------------------

    /** Zamanlı gönderim kartı: açık/kapalı ve saatler (yol: 'gece' | 'kaldirmaRapor' | 'itirazRapor') */
    function zamanKarti(yol, acikMetin) {
        var acik = !!al(yol + '.acik');
        return kartHtml({
            ikon: IKON.saat, baslik: 'Zamanlı Gönderim', anahtar: yol + '.acik',
            aciklama: acik ? acikMetin : 'Kapalı. Alttaki "Kendime Gönder" ile istediğin an gönderebilirsin.',
            govde: '<div class="tg-satir tg-satir--dikey"><span class="tg-satir__metin"><b>Saatler</b><small>Gün içinde en çok ' + EN_COK_SAAT + ' saat seçebilirsin.</small></span>' + saatlerHtml(yol + '.saatler') + '</div>'
        });
    }

    function tamKaliteSatiri(yol) {
        return satirAnahtar('Tam Kalite Dosya', 'Görsel ayrıca dosya olarak gider; yakınlaştırınca bozulmaz', yol);
    }

    function geceHtml() {
        return zamanKarti('gece', 'Her gün seçtiğin saatlerde. Her rapor bir öncekinden bu yana olanları içerir.') +
        kartHtml({ ikon: IKON.ozet, baslik: 'Özet Kartı', aciklama: 'Albümün ilk kartı: kaldırma, itiraz ve sayım sayıları, günlük sayımın durumu.', anahtar: 'gece.bolumler.ozet' }) +
        kartHtml({
            ikon: IKON.sayim, baslik: 'Sayımlar', aciklama: 'Rapor aralığında tamamlanan sayımlar.', anahtar: 'gece.bolumler.sayim',
            govde: satirAnahtar('Günlük Sayım', 'Otomatik 50\'lik sayım, paneldeki durumuyla', 'gece.sayim.gunluk') +
                satirAnahtar('Diğer Sayımlar', 'Elle açılan sayımlar', 'gece.sayim.diger') +
                satirAnahtar('Başlama ve Bitiş Saatleri', 'Her sayımın başlığında', 'gece.sayim.saatler') +
                satirAnahtar('Farksız Sayımlar', 'Kapalıysa yalnız farkı olan sayımlar gelir', 'gece.sayim.farksiz') +
                satirSegment('Ürün Listesi', null, 'gece.sayim.liste', [['fark', 'Yalnız Farklar'], ['hepsi', 'Bütün Ürünler']]) +
                satirSegment('Fark Eşiği', 'Bu kadar ve daha büyük farklar', 'gece.sayim.esik', [[0, 'Her Fark'], [2, '±2'], [5, '±5'], [10, '±10']])
        }) +
        '<p class="tg-not">Satıştan kaldırma ve itirazlar kendi sekmelerinde, kendi saatleriyle gider.</p>';
    }

    /* Satıştan Kaldırma: önizleme ve "Kendime Gönder" için tarih aralığı */
    function krHazir(tur) {
        var bugun = gunYaz(Date.now());
        var k = d.kr;
        k.tur = tur;
        if (tur === 'bugun') { k.bas = k.son = bugun; }
        else if (tur === 'dun') { k.bas = k.son = pfDun(); }
        else if (tur === 'hafta') { k.bas = gunYaz(Date.now() - 6 * 864e5); k.son = bugun; }
        else if (tur === 'ay') { k.bas = bugun.slice(0, 8) + '01'; k.son = bugun; }
        else if (tur === 'gecenAy') {
            var b = new Date(bugun.slice(0, 8) + '01T12:00:00Z');
            b.setUTCDate(0);
            k.son = b.toISOString().slice(0, 10);
            k.bas = k.son.slice(0, 8) + '01';
        } else { k.tur = 'son24'; }
        ayarCiz();
        onizlemeBayatla();
    }

    function krTarihKoy(alan, deger) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deger || ''))) return;
        var k = d.kr;
        if (k.tur === 'son24') { k.bas = k.son = gunYaz(Date.now()); }
        k.tur = 'ozel';
        k[alan] = deger;
        if (k.bas > k.son) { if (alan === 'bas') k.son = deger; else k.bas = deger; }
        if (Date.parse(k.son) - Date.parse(k.bas) > 62 * 864e5) {
            if (alan === 'bas') k.son = gunYaz(Date.parse(k.bas) + 62 * 864e5); else k.bas = gunYaz(Date.parse(k.son) - 62 * 864e5);
        }
        ayarCiz();
        onizlemeBayatla();
    }

    /** Sunucuya giden aralık; son 24 saatte null */
    function krAralik() { return d.kr.tur === 'son24' ? null : { bas: d.kr.bas, son: d.kr.son }; }

    function krKarti() {
        var k = d.kr;
        var bugun = gunYaz(Date.now());
        var bas = k.tur === 'son24' ? bugun : k.bas;
        var son = k.tur === 'son24' ? bugun : k.son;
        return kartHtml({
            ikon: IKON.mesaj, baslik: 'Tarih Aralığı', aciklama: 'Önizleme ve "Kendime Gönder" bu aralıkla. Zamanlı rapor her zaman bir öncekinden bu yana olanları gönderir.',
            govde: '<div class="tg-satir tg-satir--dikey"><div class="tg-cipler">' + [['son24', 'Son 24 Saat'], ['bugun', 'Bugün'], ['dun', 'Dün'], ['hafta', 'Son 7 Gün'], ['ay', 'Bu Ay'], ['gecenAy', 'Geçen Ay']].map(function (x) {
                    return '<button type="button" class="tg-cip" data-kr-hazir="' + x[0] + '" data-odak="kr-hazir:' + x[0] + '" aria-pressed="' + (k.tur === x[0]) + '"><i>' + IKON.tik + '</i>' + x[1] + '</button>';
                }).join('') + '</div>' +
                '<div class="tg-tarih"><label><span>Başlangıç</span><input type="date" data-kr-tarih="bas" data-odak="kr-bas" value="' + bas + '" max="' + son + '"></label>' +
                '<label><span>Bitiş</span><input type="date" data-kr-tarih="son" data-odak="kr-son" value="' + son + '" min="' + bas + '" max="' + bugun + '"></label></div></div>'
        });
    }

    function kaldirmaHtml() {
        return krKarti() + zamanKarti('kaldirmaRapor', 'Her gün seçtiğin saatlerde. Her rapor bir öncekinden bu yana olanları içerir; onay bekleyenler o anki hâliyle.') +
        kartHtml({
            ikon: IKON.kaldirma, baslik: 'Gruplar', aciklama: 'Her grup ayrı açılır; hasar fotoğrafı grup başına seçilir.',
            govde: grupSatiri('Reddedilen ve İptal Edilen', 'Rapor aralığında reddedilen ya da iptal edilenler', 'kaldirmaRapor.red') +
                grupSatiri('Onay Bekleyen', 'Şu an sonuç bekleyen kayıtlar', 'kaldirmaRapor.bekleyen') +
                grupSatiri('Tamamlanan', 'Rapor aralığında tamamlananlar', 'kaldirmaRapor.tamam') +
                satirAnahtar('Yeniden Girilenleri Gizle', 'İptalden sonra depo aynı ürünü yeniden girdiyse gösterme', 'kaldirmaRapor.yenidenGizle', !al('kaldirmaRapor.red.goster')) +
                satirSegment('Grup Başına En Çok', 'Zamanlı rapor için. Tarih aralığı seçiliyken aralığın tamamı gelir; sığmayan sayfalara bölünür', 'kaldirmaRapor.sinir', [[10, '10'], [20, '20'], [40, '40'], [0, 'Hepsi']]) +
                tamKaliteSatiri('kaldirmaRapor.tamKalite')
        }) +
        kartHtml({ ikon: IKON.ozet, baslik: 'Sebepler', aciklama: 'Yalnız seçili sebeplerdeki kayıtlar gelir.', govde: sebeplerHtml() });
    }

    function itirazHtml() {
        var sonuc = !!al('itirazRapor.sonuc');
        var bekleyenYok = al('itirazRapor.bekleyen') === 'yok';
        var siparis = !!al('itirazRapor.siparis');
        return zamanKarti('itirazRapor', 'Her gün seçtiğin saatlerde. Asistan rapordan önce listeyi ve siparişleri tazeler.') +
        kartHtml({
            ikon: IKON.itiraz, baslik: 'Kayıtlar', aciklama: 'Depo değerlendirme kayıtları.',
            govde: satirSegment('İtiraz Bekleyenler', 'Süresi dolmamış kayıtlar', 'itirazRapor.bekleyen', [['hepsi', 'Hepsi'], ['acil', '24 Saatten Az'], ['yok', 'Gösterme']]) +
                satirAnahtar('Müşteri Notu', 'Bekleyen kaydın altında', 'itirazRapor.not', bekleyenYok) +
                satirAnahtar('Sonuçlananlar', 'Rapor aralığında kabul ya da red gelenler', 'itirazRapor.sonuc') +
                satirAnahtar('Gönderilen İtiraz Metni', 'Sonuçlanan kaydın altında', 'itirazRapor.metin', !sonuc) +
                tamKaliteSatiri('itirazRapor.tamKalite')
        }) +
        kartHtml({
            ikon: IKON.siparis, baslik: 'Sipariş', aciklama: 'Kaydın siparişi: ürünler, şikâyet edilen ürün işaretli.', anahtar: 'itirazRapor.siparis',
            govde: satirAnahtar('Kurye', 'Adı ve profil fotoğrafı', 'itirazRapor.kurye') +
                satirAnahtar('Toplayıcı', 'Siparişi hazırlayan depocu', 'itirazRapor.toplayici') +
                (siparis ? '' : '<p class="tg-satir__metin"><small>Sipariş kapalıyken de kurye ve toplayıcı görünebilir.</small></p>')
        });
    }

    function anlikHtml() {
        return kartHtml({
            ikon: IKON.zil, baslik: 'Hangi Durumda Gelsin', aciklama: 'Satıştan kaldırma kaydının durumu değişince hemen gelir.',
            govde: satirAnahtar('İptal Edildiğinde', null, 'anlik.iptal') +
                satirAnahtar('Reddedildiğinde', 'Depo aksiyonu bekleniyor durumuna düşünce', 'anlik.red') +
                satirAnahtar('Tamamlandığında', 'Onaylanıp bittiğinde, kayıt başına bir kez', 'anlik.tamam')
        }) +
        kartHtml({
            ikon: IKON.mesaj, baslik: 'Mesaj İçeriği',
            govde: satirAnahtar('Ürün Görseli', 'Kapalıysa yalnız yazı gelir', 'anlik.gorsel') +
                satirAnahtar('Oluşturan Kişi', 'Kaydı panelde kimin açtığı', 'anlik.olusturan')
        });
    }

    function gonderHtml() {
        return kartHtml({
            ikon: IKON.gonder, baslik: 'Açılış Seçimi', aciklama: 'Satıştan Kaldırma sayfasındaki "Telegram\'a Gönder" paneli bu seçimle açılır.',
            govde: satirAnahtar('Özet Kartı', 'Ürünler, adetler ve sebepler tek kartta', 'kaldirmaGonder.ozet') +
                satirAnahtar('Reddedilen ve İptal Edilenler', null, 'kaldirmaGonder.red') +
                satirAnahtar('Onay Bekleyenler', null, 'kaldirmaGonder.bekleyen') +
                satirAnahtar('Tamamlananlar', null, 'kaldirmaGonder.tamam') +
                satirAnahtar('Hasar Fotoğrafları', 'Seçilen kayıtların altına, en çok 3', 'kaldirmaGonder.foto')
        });
    }

    // ------------------------------------------------------------------
    // Performans: DPS ve kurye. Zamanlı gönderimi Asistan yapar; elle gönderim
    // ve önizleme verisi bu tarayıcıdaki franchise oturumuyla (panelin kendi
    // istekleri). Getir'e yalnız tarih değişince gidilir, sonuç 10 dk bellekte.
    // ------------------------------------------------------------------

    var PF_METRIK = ['406', '21', '403', '407', '22', '404', '111', '405', '410', '412', '520', '11', '12', '16', '112', '23', '409', '408', '25', '26', '510', '514'];
    var PF_VERI_MS = 10 * 60 * 1000;
    var pfVeriOnbellek = {};

    function pfSekmesi() { return d.sekme === 'dps' || d.sekme === 'kurye'; }

    function gunYaz(t) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(t)); }
    function pfDun() { return gunYaz(Date.now() - 864e5); }

    function pfHazirAralik(tur) {
        var bugun = gunYaz(Date.now());
        var dun = pfDun();
        if (tur === 'dun') { d.pf.bas = dun; d.pf.son = dun; }
        else if (tur === 'hafta') { d.pf.bas = gunYaz(Date.now() - 7 * 864e5); d.pf.son = dun; }
        else if (tur === 'ay') { d.pf.bas = bugun.slice(0, 8) + '01'; d.pf.son = bugun.slice(8) === '01' ? bugun : dun; }
        else if (tur === 'gecenAy') {
            var b = new Date(bugun.slice(0, 8) + '01T12:00:00Z');
            b.setUTCDate(0);
            d.pf.son = b.toISOString().slice(0, 10);
            d.pf.bas = d.pf.son.slice(0, 8) + '01';
        }
        ayarCiz();
        onizlemeBayatla();
    }

    function pfTarihKoy(alan, deger) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deger || ''))) return;
        d.pf[alan] = deger;
        if (d.pf.bas > d.pf.son) { if (alan === 'bas') d.pf.son = deger; else d.pf.bas = deger; }
        // En çok 62 gün
        if (Date.parse(d.pf.son) - Date.parse(d.pf.bas) > 62 * 864e5) {
            if (alan === 'bas') d.pf.son = gunYaz(Date.parse(d.pf.bas) + 62 * 864e5); else d.pf.bas = gunYaz(Date.parse(d.pf.son) - 62 * 864e5);
        }
        ayarCiz();
        onizlemeBayatla();
    }

    function aralikYazi(bas, son) {
        var f = function (g) { return new Date(g + 'T12:00:00Z').toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long' }); };
        return bas === son ? f(bas) : f(bas) + ' - ' + f(son);
    }

    /** Seçili aralığın verisi (yalnız istenen rapor için): { bas, son, dps | kurye } */
    async function performansVerisi(rapor) {
        var anahtar = rapor + '|' + d.pf.bas + '|' + d.pf.son;
        var o = pfVeriOnbellek[anahtar];
        if (o && Date.now() - o.zaman < PF_VERI_MS) return o.veri;
        if (!global.franchiseOturum) { var h0 = new Error('oturum'); h0.kod = 'oturum'; throw h0; }
        var oturum = await global.franchiseOturum.al();
        var depo = oturum.depo;
        var veri = { bas: d.pf.bas, son: d.pf.son };
        if (rapor === 'kurye') {
            var kurye = [];
            // 100'erli: liste tek istekte gelir
            for (var s = 0; s < 5; s++) {
                if (s) await new Promise(function (r) { setTimeout(r, 400); });
                var r = await global.franchiseOturum.istek('/courier/v2/metrics', {
                    method: 'POST',
                    govde: {
                        startDate: d.pf.bas + 'T00:00:00.000Z', endDate: d.pf.son + 'T23:59:59.999Z', courierIds: [], warehouseIds: [depo],
                        metricGroups: PF_METRIK, vehicleTypes: [], limit: 100, offset: s * 100
                    }
                });
                if (!r.ok) { var h = new Error('panel'); h.kod = 'panel'; throw h; }
                var j = await r.json();
                var parca = Array.isArray(j && j.data) ? j.data : [];
                kurye = kurye.concat(parca);
                if (parca.length < 100 || kurye.length >= (Number(j && j.total_count) || 0)) break;
            }
            veri.kurye = kurye;
        } else {
            var rd = await global.franchiseOturum.istek('/wps/criteria?startDate=' + d.pf.bas + '&endDate=' + d.pf.son + '&warehouseId=' + depo + '&isRanked=false');
            if (!rd.ok) { var h2 = new Error('panel'); h2.kod = 'panel'; throw h2; }
            veri.dps = await rd.json();
        }
        pfVeriOnbellek[anahtar] = { zaman: Date.now(), veri: veri };
        return veri;
    }

    function listeIslem(b) {
        var t = siraliTanim(b.getAttribute('data-liste'));
        if (!t) return;
        if (b.hasAttribute('data-varsayilan-liste')) { koy(t.yol, t.varsayilan.slice()); return; }
        var l = (al(t.yol) || t.varsayilan).slice();
        var k = b.getAttribute('data-tasi') || b.getAttribute('data-cikar') || b.getAttribute('data-ekle');
        var i = l.indexOf(k);
        if (b.hasAttribute('data-ekle')) { if (i === -1 && l.length < t.enCok) l.push(k); }
        else if (b.hasAttribute('data-cikar')) { if (i > -1 && l.length > 1) l.splice(i, 1); }
        else {
            var j = i + Number(b.getAttribute('data-yon'));
            if (i < 0 || j < 0 || j >= l.length) return;
            l.splice(i, 1);
            l.splice(j, 0, k);
        }
        koy(t.yol, l);
    }

    function pfHataMetni(e) {
        var k = e && e.kod;
        if (k === 'oturum') return 'Franchise oturumu bulunamadı. Franchise panelini bir kez aç (Asistan oturumu buraya getirir) ya da Örnek Veri ile bak.';
        if (k === 'depo') return 'Depo bilgisi bulunamadı. Franchise panelinde Mevcut Stok sayfasını bir kez aç.';
        if (k === 'panel') return 'Panel bu tarihler için yanıt vermedi. Biraz sonra tekrar dene.';
        return 'Panele ulaşılamadı. İnternet bağlantını kontrol et.';
    }

    /** Zamanlı gönderim kartı (rapor: dps | kurye) */
    function pfZamanKarti(rapor, baslik) {
        var acik = !!al('performans.' + rapor + '.acik');
        return kartHtml({
            ikon: IKON.saat, baslik: 'Zamanlı Gönderim', anahtar: 'performans.' + rapor + '.acik',
            aciklama: acik ? 'Her gün seçtiğin saatlerde dünün ' + baslik + ' verisi. Depo bilgisayarında Jet Barkod Asistan açık olmalı.' : 'Kapalı. Aşağıdan istediğin tarihleri elle gönderebilirsin.',
            govde: '<div class="tg-satir tg-satir--dikey"><span class="tg-satir__metin"><b>Saatler</b><small>Gün içinde en çok ' + EN_COK_SAAT + ' saat.</small></span>' + saatlerHtml('performans.' + rapor + '.saatler') + '</div>'
        });
    }

    /** Veri kontrolü: DPS ve Kurye CDI için ortak */
    function pfKontrolKarti() {
        var esikYok = !al('performans.kontrol.esik');
        return kartHtml({
            ikon: IKON.uyari, baslik: 'Veri Kontrolü', aciklama: 'DPS ve Kurye CDI için ortak. Dünün verisi gelmeden gönderilmesin diye.',
            govde: satirSegment('En Az Sipariş', 'Dünün siparişi bundan azsa veri henüz gelmemiştir, ertelenir', 'performans.kontrol.esik', [[0, 'Kapalı'], [100, '100'], [150, '150'], [200, '200'], [250, '250']]) +
                satirSegment('Erteleme Süresi', null, 'performans.kontrol.erteleme.dakika', [[15, '15 dk'], [30, '30 dk'], [60, '1 saat']], esikYok) +
                satirSegment('En Çok Erteleme', null, 'performans.kontrol.erteleme.kez', [[1, '1'], [2, '2'], [4, '4'], [6, '6'], [8, '8']], esikYok) +
                satirAnahtar('Ertelemeyi Bildir', 'Her ertelemede Telegram\'a kısa not düşer', 'performans.kontrol.ertelemeBildir', esikYok) +
                satirAnahtar('Son Denemede Yine Gönder', 'Kapalıysa veri gelmezse o gün gönderilmez', 'performans.kontrol.sonDenemedeGonder', esikYok)
        });
    }

    function pfElleKarti() {
        var dun = pfDun();
        return kartHtml({
            ikon: IKON.mesaj, baslik: 'Tarih Aralığı', aciklama: 'Önizleme ve "Kendime Gönder" bu tarihlerle. Getir\'den veri yalnız tarih değişince istenir.',
            govde: '<div class="tg-satir tg-satir--dikey"><div class="tg-tarih">' +
                '<label><span>Başlangıç</span><input type="date" data-pf-tarih="bas" data-odak="pf-bas" value="' + d.pf.bas + '" max="' + d.pf.son + '"></label>' +
                '<label><span>Bitiş</span><input type="date" data-pf-tarih="son" data-odak="pf-son" value="' + d.pf.son + '" min="' + d.pf.bas + '" max="' + gunYaz(Date.now()) + '"></label></div>' +
                '<div class="tg-cipler">' + [['dun', 'Dün'], ['hafta', 'Son 7 Gün'], ['ay', 'Bu Ay'], ['gecenAy', 'Geçen Ay']].map(function (x) {
                    var secili = x[0] === 'dun' && d.pf.bas === dun && d.pf.son === dun;
                    return '<button type="button" class="tg-cip" data-pf-hazir="' + x[0] + '" data-odak="pf-hazir:' + x[0] + '" aria-pressed="' + secili + '"><i>' + IKON.tik + '</i>' + x[1] + '</button>';
                }).join('') + '</div></div>'
        });
    }

    function dpsHtml() {
        return pfZamanKarti('dps', 'DPS') + pfKontrolKarti() +
            kartHtml({
                ikon: IKON.ozet, baslik: 'Kart İçeriği', aciklama: 'Bayi, Kurye ve Picker DPS; kriterler panelin tablosundaki gibi.',
                govde: satirAnahtar('Kurye Sütunları', 'Performans % ve puan', 'performans.dps.kurye') +
                    satirAnahtar('Depocu Sütunları', 'Performans % ve puan', 'performans.dps.depocu') +
                    satirAnahtar('Denetimler', 'Filo ve kalite denetimi', 'performans.dps.denetim') +
                    satirAnahtar('Tam Kalite Dosya', 'Görsel ayrıca dosya olarak gider; yakınlaştırınca bozulmaz', 'performans.dps.tamKalite')
            }) + pfElleKarti();
    }

    /* Sıralı seçim listesi (Kurye CDI sütunları ve özet kutuları): seçilenler
       sırasıyla yukarı/aşağı/çıkar, altta eklenebilecekler. */
    function siraliTanim(tur) {
        var kat = d.pfKatalog;
        if (!kat) return null;
        return tur === 'ozet'
            ? { yol: 'performans.kurye.ozet', ogeler: kat.ozetler, varsayilan: kat.ozetVarsayilan, enCok: kat.enCokOzet || 6 }
            : { yol: 'performans.kurye.sutunlar', ogeler: kat.sutunlar, varsayilan: kat.varsayilan, enCok: 99 };
    }

    function siraliHtml(tur) {
        var t = siraliTanim(tur);
        if (!t) return '';
        var kat = d.pfKatalog;
        var adi = {};
        t.ogeler.forEach(function (x) { adi[x.anahtar] = x; });
        var secili = (al(t.yol) || t.varsayilan).filter(function (k) { return adi[k]; });
        var grupHtml = function (o) {
            if (!o.grup) return '';
            var g = kat.gruplar[o.grup] || {};
            return '<span class="tg-sutun__grup" style="background:' + g.zemin + ';color:' + g.renk + '">' + kacis(g.ad || '') + '</span>';
        };
        var ok = function (k, yon, ad, pasif) {
            return '<button type="button" data-liste="' + tur + '" data-tasi="' + k + '" data-yon="' + yon + '" data-odak="' + tur + (yon < 0 ? '-y:' : '-a:') + k + '" aria-label="' + kacis(ad) + (yon < 0 ? ' yukarı' : ' aşağı') + '"' + (pasif ? ' disabled' : '') + '>' +
                '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="' + (yon < 0 ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5') + '"/></svg></button>';
        };
        var liste = '<ol class="tg-sutunlar">' + secili.map(function (k, i) {
            var o = adi[k];
            return '<li><span class="tg-sutun__sira">' + (i + 1) + '</span><span class="tg-sutun__ad">' + kacis(o.ad) + '</span>' + grupHtml(o) +
                ok(k, -1, o.ad, i === 0) + ok(k, 1, o.ad, i === secili.length - 1) +
                '<button type="button" data-liste="' + tur + '" data-cikar="' + k + '" data-odak="' + tur + '-c:' + k + '" aria-label="' + kacis(o.ad) + ' çıkar"' + (secili.length === 1 ? ' disabled' : '') + '>' + IKON.carpi + '</button></li>';
        }).join('') + '</ol>';
        var kalan = t.ogeler.filter(function (x) { return secili.indexOf(x.anahtar) === -1; });
        var dolu = secili.length >= t.enCok;
        return liste + (kalan.length ? '<p class="tg-alt-baslik">Eklenebilecekler' + (dolu ? ' · en çok ' + t.enCok : '') + '</p><div class="tg-cipler">' + kalan.map(function (x) {
            return '<button type="button" class="tg-cip tg-cip--ekle" data-liste="' + tur + '" data-ekle="' + x.anahtar + '" data-odak="' + tur + '-e:' + x.anahtar + '"' + (dolu ? ' disabled' : '') + '><i>' + IKON.arti + '</i>' + kacis(x.ad) + '</button>';
        }).join('') + '</div>' : '') +
            '<button type="button" class="tg-baglanti" data-liste="' + tur + '" data-varsayilan-liste data-odak="' + tur + '-v">Varsayılana Dön</button>';
    }

    function kuryeHtml() {
        var baslik = al('performans.kurye.baslik') || '';
        return pfZamanKarti('kurye', 'kurye CDI') + pfKontrolKarti() +
            kartHtml({
                ikon: IKON.gonder, baslik: 'Kart Görünümü', aciklama: 'Yatay, tek sayfa: bütün kuryeler tek görselde.',
                govde: '<div class="tg-satir tg-satir--dikey"><span class="tg-satir__metin"><b>Kart Başlığı</b><small>Boş bırakılırsa "Kurye CDI Tablosu" yazar. Örneğin depo adı.</small></span>' +
                    '<input type="text" class="tg-girdi" maxlength="40" data-metin-yol="performans.kurye.baslik" data-odak="pf-baslik" placeholder="Kurye CDI Tablosu" value="' + kacis(baslik) + '"></div>' +
                    satirSegment('Sıralama', 'Sıra numarası (1, 2, 3...) buna göre', 'performans.kurye.siralama', [['not', 'CDI Notu'], ['cdi', 'CDI Puanı'], ['siparis', 'Sipariş'], ['ad', 'Ad']]) +
                    satirSegment('En Az Sipariş', 'Bundan az sipariş alan kurye listede görünmez', 'performans.kurye.enAzSiparis', [[0, 'Hepsi'], [1, '1'], [5, '5'], [10, '10']]) +
                    satirAnahtar('Kurye Fotoğrafı', 'Panelin profil fotoğrafı', 'performans.kurye.foto') +
                    satirAnahtar('Tam Kalite Dosya', 'Görsel ayrıca dosya olarak gider; yakınlaştırınca bozulmaz', 'performans.kurye.tamKalite')
            }) +
            kartHtml({ ikon: IKON.ozet, baslik: 'Özet Kutuları', aciklama: 'Tablonun üstündeki kutular, soldan sağa bu sırayla (en çok 6).', govde: siraliHtml('ozet') }) +
            kartHtml({ ikon: IKON.ozet, baslik: 'Sütunlar ve Sırası', aciklama: 'Kartta soldan sağa bu sırayla. Aynı gruptaki art arda sütunlar tek renkli bantta birleşir.', govde: siraliHtml('sutun') }) +
            pfElleKarti();
    }

    function ayarCiz() {
        var kutu = el('tgAyarlar');
        var odak = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-odak') : null;
        kutu.innerHTML = d.sekme === 'anlik' ? anlikHtml() : d.sekme === 'gonder' ? gonderHtml() : d.sekme === 'dps' ? dpsHtml()
            : d.sekme === 'kurye' ? kuryeHtml() : d.sekme === 'kaldirma' ? kaldirmaHtml() : d.sekme === 'itiraz' ? itirazHtml() : geceHtml();
        if (odak) {
            var hedef = kutu.querySelector('[data-odak="' + odak.replace(/"/g, '\\"') + '"]');
            if (hedef) hedef.focus({ preventScroll: true });
        }
    }

    // ------------------------------------------------------------------
    // Hesap, uyarı, alt çubuk
    // ------------------------------------------------------------------

    function hesapCiz() {
        var k = el('tgHesap');
        var adlar = d.hesaplar.map(function (h) { return h.ad || (h.kullanici ? '@' + h.kullanici : ''); }).filter(Boolean);
        if (d.hesaplar.length) {
            k.innerHTML = '<span class="tg-hesap__cip">' + IKON.tik + kacis(adlar.length ? adlar.join(', ') : d.hesaplar.length + ' hesap') + '</span>';
        } else {
            k.innerHTML = '<span class="tg-hesap__cip is-yok">Telegram bağlı değil</span><button type="button" class="tg-hesap__bagla" id="tgBagla">Telegram\'ı Bağla</button>';
        }
    }

    function uyariCiz() {
        var u = el('tgUyari');
        if (!d.kurulum) {
            u.textContent = 'Sunucu güncellemesi bekleniyor: şimdilik yalnız rapor açık/kapalı, onay bekleyenler ve fotoğraf seçimi saklanır. Önizleme çalışır.';
            u.hidden = false;
        } else if (!d.bot) {
            u.textContent = 'Telegram botu şu an hazır değil; ayarlar kaydedilir, gönderim bot hazır olunca başlar.';
            u.hidden = false;
        } else {
            u.hidden = true;
        }
    }

    function sonYazi() {
        var son = (d.sonlar || {})[d.sekme] || (d.sekme === 'gece' ? d.son : null);
        if (!son || !son.gonderildi) return 'Henüz zamanlı rapor gönderilmedi.';
        var t = new Date(son.gonderildi).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        return 'Son rapor: ' + t + (son.kart ? ' · ' + son.kart + ' kart' : '');
    }

    function cubukCiz() {
        var degis = degistiMi();
        var durum = el('tgKayitDurum');
        durum.textContent = d.kaydediyor ? 'Kaydediliyor...' : degis ? 'Kaydedilmemiş değişiklik var' : (BOLUM[d.sekme] ? sonYazi() : 'Kaydedildi');
        durum.classList.toggle('is-degisti', degis && !d.kaydediyor);
        el('tgKaydet').disabled = !degis || d.kaydediyor;
        var test = el('tgTest');
        test.disabled = d.gonderiyor || !d.hesaplar.length;
        test.querySelector('span').textContent = d.gonderiyor ? 'Gönderiliyor...' : 'Kendime Gönder';
        test.title = d.hesaplar.length ? 'Ekrandaki ayarla bağlı Telegram hesaplarına deneme' : 'Önce Telegram\'ı bağla';
    }

    // ------------------------------------------------------------------
    // Önizleme
    // ------------------------------------------------------------------

    function onizlemeAnahtari() {
        if (pfSekmesi()) {
            return d.sekme + '|' + (d.veri === 'ornek' ? 'o' : d.pf.bas + '|' + d.pf.son) + '|' + JSON.stringify(d.ayar.performans[d.sekme]);
        }
        var parca = d.sekme === 'anlik' ? d.ayar.anlik : d.sekme === 'gonder' ? d.ayar.kaldirmaGonder : d.ayar[BOLUM[d.sekme] || 'gece'];
        var ar = d.sekme === 'kaldirma' && d.veri === 'gercek' ? JSON.stringify(krAralik()) : '';
        return d.sekme + '|' + (d.sekme === 'gonder' ? 'g' : d.veri) + '|' + ar + '|' + JSON.stringify(parca);
    }

    var zamanlayici = null;
    function onizlemeZamanla(hemen) {
        clearTimeout(zamanlayici);
        zamanlayici = setTimeout(onizlemeAl, hemen ? 0 : ONIZLEME_BEKLE_MS);
    }

    async function onizlemeAl() {
        var anahtar = onizlemeAnahtari();
        var o = d.onizleme;
        if (o.sonuc[anahtar] && o.sonuc[anahtar].ok) { o.goster = anahtar; onizlemeCiz(); return; }
        var no = ++o.no;
        o.yukleniyor = true;
        guncelleDugmesi();
        onizlemeCiz();
        var c;
        if (pfSekmesi()) {
            if (d.veri === 'ornek') {
                c = await istek('/api/performans/onizleme', { rapor: d.sekme, ornek: true, ayar: d.ayar.performans });
            } else {
                var pv = null;
                try { pv = await performansVerisi(d.sekme); } catch (e) { c = { kod: -1, j: {}, metin: pfHataMetni(e) }; }
                if (pv) c = await istek('/api/performans/onizleme', { rapor: d.sekme, veri: pv, ayar: d.ayar.performans });
            }
        } else if (d.sekme === 'gonder') {
            c = await istek('/api/kaldirma/onizleme', { secim: d.ayar.kaldirmaGonder });
        } else {
            if (d.sekme === 'itiraz' && d.veri === 'gercek') await siparisleriTazele();
            c = await istek('/api/telegram-ayar/onizleme', {
                rapor: d.sekme === 'anlik' ? 'anlik' : BOLUM[d.sekme] ? d.sekme : 'gece', veri: d.veri, ayar: sekmeAyari(),
                aralik: d.sekme === 'kaldirma' ? krAralik() : undefined
            });
        }
        if (no !== o.no) return; // daha yeni bir istek var
        o.yukleniyor = false;
        if (c.kod === 429) {
            o.durum = 'Çok sık; birazdan yenilenecek';
            onizlemeCiz();
            clearTimeout(zamanlayici);
            zamanlayici = setTimeout(onizlemeAl, 6000);
            return;
        }
        o.durum = null;
        // Seçilen tarih aralığı sunucuda uygulanmadıysa (eski sunucu) önizleme yanlış tarihi gösterir: hata say
        var istenen = d.sekme === 'kaldirma' && d.veri === 'gercek' ? krAralik() : null;
        if (istenen && c.kod === 200 && c.j.ok && !(c.j.aralik && c.j.aralik.bas === istenen.bas && c.j.aralik.son === istenen.son)) {
            d.krDesteksiz = true;
            c = { kod: -1, j: {}, metin: 'Sunucu güncellemesi bekleniyor: tarih aralığı henüz sunucuda yok, önizleme son 24 saati gösterirdi. Sunucu güncellenince seçtiğin tarihler gelir.' };
        } else if (istenen && c.kod === 200) {
            d.krDesteksiz = false;
        }
        o.sonuc[anahtar] = c.kod === 200 && c.j.ok ? { ok: true, j: c.j } : { ok: false, metin: c.metin || hataMetni(c) };
        o.goster = anahtar;
        // Hasar fotoğraflarının linki süresi geçmişse depo panelindeki Asistan tazeler
        // (30 sn'de bir sorar): önizleme 35 sn sonra kendiliğinden yenilenir, en çok 4 kez.
        if (o.fotoAnahtar !== anahtar) { o.fotoAnahtar = anahtar; o.fotoDeneme = 0; }
        var bekleyenFoto = c.kod === 200 && c.j && c.j.fotoTazeleniyor;
        if (bekleyenFoto && o.fotoDeneme < 4) {
            o.fotoDeneme++;
            o.durum = bekleyenFoto + ' kaydın fotoğrafı depo panelinden alınıyor';
            setTimeout(function () {
                if (onizlemeAnahtari() !== anahtar || o.yukleniyor) return;
                delete o.sonuc[anahtar];
                onizlemeAl();
            }, 35000);
        } else if (bekleyenFoto) {
            o.durum = 'Bazı fotoğraflar alınamadı: depo paneli açık bir bilgisayar gerekli';
        }
        onizlemeCiz();
    }

    /** Sunucuya giden ayar parçası: yalnız açık sekmenin bölümü */
    function sekmeAyari() {
        var a = {};
        var alan = d.sekme === 'anlik' ? 'anlik' : BOLUM[d.sekme] || 'gece';
        a[alan] = d.ayar[alan];
        return a;
    }

    /* İtiraz kayıtlarının siparişi: sunucuda özeti olmayanlar bu tarayıcıdaki
       franchise oturumuyla okunur (panelin kendi isteği, 5 dakikada bir, en çok 10).
       Oturum yoksa sessizce geçilir; kartta "henüz okunmadı" yazar. */
    var siparisSon = 0;
    async function siparisleriTazele() {
        if (Date.now() - siparisSon < 5 * 60 * 1000 || !global.franchiseOturum || !global.franchiseOturum.siparisOzeti) return;
        siparisSon = Date.now();
        var c = await istek('/api/itiraz/siparis-eksik');
        var liste = c.kod === 200 && c.j && Array.isArray(c.j.liste) ? c.j.liste.slice(0, 10) : [];
        if (!liste.length) return;
        try { await global.franchiseOturum.al(); } catch (e) { return; }
        var sonuc = [];
        for (var i = 0; i < liste.length; i++) {
            if (i) await new Promise(function (r) { setTimeout(r, 500); });
            var sp = null;
            try { sp = await global.franchiseOturum.siparisOzeti(liste[i].siparisId, liste[i].siparisTur); } catch (e) {
                if (e && e.kod === 'oturum') break;
                sp = null;
            }
            sonuc.push({ id: liste[i].id, siparis: sp });
        }
        if (sonuc.length) await istek('/api/itiraz/siparis', { liste: sonuc });
    }

    function iskeletHtml() {
        return '<div class="tg-mesaj" aria-hidden="true"><div class="tg-album">' +
            '<span class="tg-iskelet" style="height:300px;border-radius:0"></span><span class="tg-iskelet" style="height:220px;border-radius:0"></span></div>' +
            '<div style="padding:12px"><span class="tg-iskelet" style="height:12px;width:70%"></span></div></div>';
    }

    function bosHtml(baslik, metin, hata) {
        return '<div class="tg-bos' + (hata ? ' is-hata' : '') + '"><span>' + (hata ? IKON.uyari : IKON.bos) + '</span><strong>' + kacis(baslik) + '</strong>' +
            (metin ? '<p>' + kacis(metin) + '</p>' : '') + (hata ? '<button type="button" data-yeniden>Tekrar Dene</button>' : '') + '</div>';
    }

    function simdiSaat() {
        return new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    }

    function albumHtml(kartlar, yazi, saat) {
        return '<div class="tg-mesaj"><div class="tg-album">' + kartlar.map(function (k, i) {
            return '<button type="button" data-kart="' + i + '" aria-label="Kart ' + (i + 1) + ' büyüt"><img src="' + k + '" alt="">' +
                (kartlar.length > 1 ? '<span>' + (i + 1) + ' / ' + kartlar.length + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
            (yazi ? '<p class="tg-mesaj__yazi">' + kacis(yazi) + '</p>' : '') +
            '<span class="tg-mesaj__saat">' + kacis(saat) + '</span></div>';
    }

    function onizlemeCiz() {
        var kutu = el('tgOnizleme');
        var o = d.onizleme;
        var durum = el('tgOnizlemeDurum');
        durum.textContent = o.yukleniyor ? 'Güncelleniyor' : (o.durum || '');
        durum.classList.toggle('is-yukleniyor', !!o.yukleniyor);
        el('tgVeri').hidden = d.sekme === 'gonder';
        el('tgSohbetAlt').textContent = d.sekme === 'gonder' ? 'son 7 günün kayıtlarıyla' : d.veri === 'ornek' ? 'örnek veriyle'
            : pfSekmesi() ? aralikYazi(d.pf.bas, d.pf.son) + ' verisiyle'
            : d.sekme === 'kaldirma' && krAralik() ? aralikYazi(d.kr.bas, d.kr.son) + ' verisiyle' : 'gerçek verinle';

        var anahtar = onizlemeAnahtari();
        var s = o.sonuc[o.goster];
        // Yeni sonuç gelene kadar eskisi soluk durur: yerleşim zıplamaz
        kutu.classList.toggle('is-eski', !!((o.yukleniyor || o.bayat) && s));
        if (!s) { if (o.yukleniyor) kutu.innerHTML = iskeletHtml(); return; }
        o.bayat = o.goster !== anahtar;
        guncelleDugmesi();
        if (!s.ok) { kutu.innerHTML = bosHtml('Önizleme alınamadı', s.metin, true); return; }
        var j = s.j;
        var kaydir = kutu.scrollTop;
        if (d.sekme === 'anlik') {
            var m = j.mesajlar || [];
            kutu.innerHTML = m.length ? m.map(function (x) {
                return '<div class="tg-mesaj">' + (x.gorsel ? '<img class="tg-mesaj__resim" src="' + kacis(x.gorsel) + '" alt="" referrerpolicy="no-referrer">' : '') +
                    '<p class="tg-mesaj__yazi">' + kacis(x.metin) + '</p><span class="tg-mesaj__saat">' + (x.ornek ? 'örnek · ' : '') + simdiSaat() + '</span></div>';
            }).join('') : bosHtml('Anlık bildirim kapalı', 'Hiçbir durum seçili değil; bildirim gelmez.');
        } else {
            var kartlar = j.kartlar || [];
            if (!kartlar.length) {
                kutu.innerHTML = d.sekme === 'gonder'
                    ? bosHtml('Gönderilecek kart yok', 'Son 7 günde seçili gruplarda kayıt yok.')
                    : pfSekmesi() ? bosHtml('Gönderilecek kart yok', d.sekme === 'kurye' ? 'Bu tarihlerde sipariş taşıyan kurye görünmüyor.' : 'Bu tarihler için DPS verisi gelmedi.')
                    : d.sekme === 'kaldirma' ? bosHtml('Gönderilecek kart yok', d.veri === 'gercek' ? (krAralik() ? 'Seçilen tarihlerde seçili gruplarda kayıt yok. Aralığı genişletebilir ya da Örnek Veri ile görünümü inceleyebilirsin.' : 'Son 24 saatte seçili gruplarda kayıt yok; rapor bu saatte gitmez. Örnek Veri ile görünümü inceleyebilirsin.') : 'Bütün gruplar kapalı.')
                    : d.sekme === 'itiraz' ? bosHtml('Gönderilecek kart yok', d.veri === 'gercek' ? 'İtiraz bekleyen ya da son 24 saatte sonuçlanan kayıt yok; rapor bu saatte gitmez. Örnek Veri ile görünümü inceleyebilirsin.' : 'Bekleyenler ve sonuçlananlar kapalı.')
                    : bosHtml('Gönderilecek kart yok', d.veri === 'gercek' ? 'Bu ayarla rapor aralığında içerik yok; rapor bu saatte gitmez. Örnek Veri ile görünümü inceleyebilirsin.' : 'Bütün bölümler kapalı.');
            } else {
                var zb = BOLUM[d.sekme] ? d.ayar[BOLUM[d.sekme]] : null;
                var saatler = zb ? (zb.saatler || [60]).map(saatYazi) : [];
                var yazi = d.sekme === 'gonder'
                    ? 'Satıştan Kaldırma · son 7 gün' + (j.gruplar ? '\n' + [j.gruplar.red ? j.gruplar.red + ' reddedilen / iptal' : '', j.gruplar.bekleyen ? j.gruplar.bekleyen + ' onay bekleyen' : '', j.gruplar.tamam ? j.gruplar.tamam + ' tamamlanan' : ''].filter(Boolean).join('\n') : '')
                    : j.baslik;
                var pr = pfSekmesi() ? d.ayar.performans[d.sekme] : null;
                var pfSaatler = pr ? (pr.saatler || [600]).map(saatYazi) : null;
                kutu.innerHTML = (zb && zb.acik ? '<span class="tg-etiket">' + kacis(saatler.join(' · ')) + '</span>'
                    : pfSaatler && pr.acik ? '<span class="tg-etiket">' + kacis(pfSaatler.join(' · ')) + '</span>' : '') +
                    albumHtml(kartlar, yazi, zb ? saatler[0] : simdiSaat());
            }
        }
        kutu.scrollTop = kaydir;
    }

    // ------------------------------------------------------------------
    // Kaydet, deneme, varsayılan
    // ------------------------------------------------------------------

    async function kaydet() {
        if (!degistiMi() || d.kaydediyor) return;
        d.kaydediyor = true;
        cubukCiz();
        var c = await istek('/api/telegram-ayar', { ayar: d.ayar });
        d.kaydediyor = false;
        if (c.kod === 200 && c.j.ok) {
            d.ayar = kopya(c.j.ayar);
            d.kayitli = kopya(c.j.ayar);
            d.kurulum = c.j.kurulum !== false;
            uyariCiz();
            ayarCiz();
            bildir('Ayarlar kaydedildi.', 'basari');
        } else {
            bildir(hataMetni(c), 'hata');
        }
        cubukCiz();
    }

    function sonYediGun() {
        var gun = function (t) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(t)); };
        return { bas: gun(Date.now() - 6 * 864e5), son: gun(Date.now()) };
    }

    async function test() {
        if (d.gonderiyor) return;
        if (!d.hesaplar.length) { bildir('Önce Telegram\'ı bağla.', 'hata'); return; }
        if (d.sekme === 'kaldirma' && krAralik() && d.krDesteksiz) {
            bildir('Tarih aralığı henüz sunucuda yok; seçtiğin tarihler yerine son 24 saat giderdi. Sunucu güncellenince tekrar dene.', 'hata');
            return;
        }
        d.gonderiyor = true;
        cubukCiz();
        var c;
        if (pfSekmesi()) {
            if (d.veri === 'ornek') {
                d.gonderiyor = false;
                cubukCiz();
                bildir('Örnek veri gönderilmez. Önizlemede Gerçek Veri\'ye geç.');
                return;
            }
            var pv = null;
            try { pv = await performansVerisi(d.sekme); } catch (e) { d.gonderiyor = false; cubukCiz(); bildir(pfHataMetni(e), 'hata'); return; }
            c = await istek('/api/performans/gonder', { rapor: d.sekme, veri: pv, ayar: d.ayar.performans });
        } else if (d.sekme === 'gonder') {
            var a = sonYediGun();
            c = await istek('/api/kaldirma/rapor', { bas: a.bas, son: a.son, secim: d.ayar.kaldirmaGonder });
        } else {
            if (d.sekme === 'itiraz') { siparisSon = 0; await siparisleriTazele(); }
            c = await istek('/api/telegram-ayar/test', {
                rapor: d.sekme === 'anlik' ? 'anlik' : BOLUM[d.sekme] ? d.sekme : 'gece', ayar: sekmeAyari(),
                aralik: d.sekme === 'kaldirma' ? krAralik() : undefined
            });
        }
        d.gonderiyor = false;
        cubukCiz();
        if (c.kod === 200 && c.j.ok && c.j.arkada) bildir('Rapor hazırlanıyor; sayfalar birazdan Telegram\'a gelir.', 'basari');
        else if (c.kod === 200 && c.j.ok) bildir((c.j.kart || 1) + (d.sekme === 'anlik' ? ' mesaj' : ' kart') + ' Telegram\'a gönderildi.', 'basari');
        else bildir(hataMetni(c), 'hata');
    }

    async function varsayilanaDon() {
        var alan = d.sekme === 'anlik' ? 'anlik' : d.sekme === 'gonder' ? 'kaldirmaGonder' : BOLUM[d.sekme] || 'gece';
        var onay = global.JBDiyalog && global.JBDiyalog.onay
            ? await global.JBDiyalog.onay('Bu sekmedeki seçimler ilk hâline döner. Kaydetmeden önce önizlemede görebilirsin.', { baslik: 'Varsayılana dönülsün mü?', onayYazi: 'Varsayılana Dön' })
            : global.confirm('Varsayılana dönülsün mü?');
        if (!onay) return;
        // DPS ve Kurye CDI yalnız kendi bölümünü sıfırlar; saatler ve açık/kapalı korunur
        var kok = pfSekmesi() ? d.ayar.performans : d.ayar;
        var vkok = pfSekmesi() ? d.varsayilan.performans : d.varsayilan;
        if (pfSekmesi()) alan = d.sekme;
        var saatler = kok[alan] && kok[alan].saatler;
        var acikti = kok[alan] && kok[alan].acik;
        kok[alan] = kopya(vkok[alan]);
        // Saatler varsayılana dönmez: kullanıcının en sık değiştirmeyeceği seçim
        if (saatler) kok[alan].saatler = saatler;
        if (typeof acikti === 'boolean') kok[alan].acik = acikti;
        if (alan === 'kurye' && d.pfKatalog) { kok.kurye.sutunlar = d.pfKatalog.varsayilan.slice(); kok.kurye.ozet = d.pfKatalog.ozetVarsayilan.slice(); }
        degisti();
    }

    async function telegramBagla() {
        var c = await istek('/api/rapor/bagla', {});
        if (c.kod === 200 && c.j.adres) {
            global.open(c.j.adres, '_blank', 'noopener');
            bildir('Telegram açıldı. Başlat\'a basınca bu sayfayı yenile.');
            return;
        }
        bildir(hataMetni(c), 'hata');
    }

    // ------------------------------------------------------------------
    // Olaylar
    // ------------------------------------------------------------------

    function sekmeSec(sekme) {
        d.sekme = sekme;
        document.querySelectorAll('#tgSekmeler [data-sekme]').forEach(function (b) {
            var secili = b.getAttribute('data-sekme') === sekme;
            b.setAttribute('aria-selected', String(secili));
            // Telefonda sekme şeridi kayar: seçili sekme görünsün
            if (secili && b.scrollIntoView) { try { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* eski tarayıcı */ } }
        });
        ayarCiz();
        cubukCiz();
        d.onizleme.goster = null;
        el('tgOnizleme').innerHTML = '';
        onizlemeZamanla(true);
    }

    function olaylariBagla() {
        el('tgSekmeler').addEventListener('click', function (e) {
            var b = e.target.closest('[data-sekme]');
            if (b && b.getAttribute('data-sekme') !== d.sekme) sekmeSec(b.getAttribute('data-sekme'));
        });
        el('tgGorunum').addEventListener('click', function (e) {
            var b = e.target.closest('[data-gorunum]');
            if (!b) return;
            var g = b.getAttribute('data-gorunum');
            el('tgDuzen').setAttribute('data-gorunum', g);
            document.querySelectorAll('#tgGorunum [data-gorunum]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
            try { global.scrollTo({ top: 0, behavior: 'auto' }); } catch (x) { /* eski tarayıcı */ }
        });
        el('tgGuncelle').addEventListener('click', function () { onizlemeZamanla(true); });
        el('tgVeri').addEventListener('click', function (e) {
            var b = e.target.closest('[data-veri]');
            if (!b || b.getAttribute('data-veri') === d.veri) return;
            d.veri = b.getAttribute('data-veri');
            document.querySelectorAll('#tgVeri [data-veri]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
            onizlemeZamanla(true);
        });

        var ayarlar = el('tgAyarlar');
        ayarlar.addEventListener('change', function (e) {
            var t = e.target;
            if (t.matches('input[data-yol]')) { koy(t.getAttribute('data-yol'), t.checked); return; }
            if (t.matches('select[data-saat-ekle]')) {
                var dk = Number(t.value);
                if (!Number.isInteger(dk)) return;
                var syol = t.getAttribute('data-saat-yol') || 'gece.saatler';
                var l = (al(syol) || []).concat(dk).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
                koy(syol, l.slice(0, EN_COK_SAAT));
                return;
            }
            if (t.matches('input[data-pf-tarih]')) { pfTarihKoy(t.getAttribute('data-pf-tarih'), t.value); }
            if (t.matches('input[data-kr-tarih]')) { krTarihKoy(t.getAttribute('data-kr-tarih'), t.value); }
            if (t.matches('input[data-metin-yol]')) koy(t.getAttribute('data-metin-yol'), t.value.replace(/\s+/g, ' ').trim().slice(0, 40));
        });
        ayarlar.addEventListener('click', function (e) {
            var s = e.target.closest('[data-seg-yol]');
            if (s && !s.disabled) {
                var deger;
                try { deger = JSON.parse(s.getAttribute('data-deger')); } catch (x) { return; }
                if (al(s.getAttribute('data-seg-yol')) !== deger) koy(s.getAttribute('data-seg-yol'), deger);
                return;
            }
            var c = e.target.closest('[data-cip-yol]');
            if (c && !c.disabled) { koy(c.getAttribute('data-cip-yol'), !al(c.getAttribute('data-cip-yol'))); return; }
            var sil = e.target.closest('[data-saat-sil]');
            if (sil) {
                var dk = Number(sil.getAttribute('data-saat-sil'));
                var syol = sil.getAttribute('data-saat-yol') || 'gece.saatler';
                var l = (al(syol) || []).filter(function (x) { return x !== dk; });
                if (l.length) koy(syol, l);
                return;
            }
            var kh = e.target.closest('[data-kr-hazir]');
            if (kh) { krHazir(kh.getAttribute('data-kr-hazir')); return; }
            var hz = e.target.closest('[data-pf-hazir]');
            if (hz) { pfHazirAralik(hz.getAttribute('data-pf-hazir')); return; }
            var ls = e.target.closest('[data-liste]');
            if (ls && !ls.disabled) { listeIslem(ls); return; }
            if (e.target.closest('[data-sebep-hepsi]')) {
                if (al('kaldirmaRapor.sebepler')) koy('kaldirmaRapor.sebepler', null);
                return;
            }
            var sb = e.target.closest('[data-sebep]');
            if (sb) {
                var ad = sb.getAttribute('data-sebep');
                var tum = d.sebepler.map(function (x) { return x.ad; });
                var secili = al('kaldirmaRapor.sebepler') || tum.slice();
                var yeni = secili.indexOf(ad) === -1 ? secili.concat(ad) : secili.filter(function (x) { return x !== ad; });
                if (!yeni.length) { bildir('En az bir sebep seçili kalmalı.'); return; }
                var hepsi = tum.every(function (x) { return yeni.indexOf(x) !== -1; });
                koy('kaldirmaRapor.sebepler', hepsi ? null : yeni);
            }
        });

        el('tgOnizleme').addEventListener('click', function (e) {
            if (e.target.closest('[data-yeniden]')) {
                delete d.onizleme.sonuc[onizlemeAnahtari()];
                onizlemeZamanla(true);
                return;
            }
            var k = e.target.closest('[data-kart]');
            if (!k || !global.JBUrunFoto) return;
            var s = d.onizleme.sonuc[d.onizleme.goster];
            var kartlar = s && s.j && s.j.kartlar;
            if (kartlar && kartlar.length) global.JBUrunFoto.ac('', 'Önizleme', { galeri: kartlar, sira: Number(k.getAttribute('data-kart')) });
        });

        document.addEventListener('click', function (e) {
            if (e.target.closest('#tgBagla')) telegramBagla();
        });
        el('tgKaydet').addEventListener('click', kaydet);
        el('tgTest').addEventListener('click', test);
        el('tgVarsayilan').addEventListener('click', varsayilanaDon);
        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !el('tgCubuk').hidden) { e.preventDefault(); kaydet(); }
        });
        global.addEventListener('beforeunload', function (e) {
            if (d.ayar && degistiMi()) { e.preventDefault(); e.returnValue = ''; }
        });
    }

    // ------------------------------------------------------------------
    // Açılış
    // ------------------------------------------------------------------

    function bolumGoster(id) {
        ['tgGiris', 'tgYetkiYok', 'tgIcerik'].forEach(function (x) { el(x).hidden = (x !== id); });
    }

    async function basla() {
        var o = null;
        try { o = (global.authUtils && global.authUtils.checkAuth()) || null; } catch (e) { o = null; }
        if (!o || !o.username) { bolumGoster('tgGiris'); return; }
        var ad = el('headerUserName');
        if (ad) ad.textContent = o.username;

        var c = await istek('/api/telegram-ayar');
        if (c.kod === 401) { bolumGoster('tgGiris'); return; }
        if (c.kod === 403) { bolumGoster('tgYetkiYok'); return; }
        bolumGoster('tgIcerik');
        if (c.kod !== 200 || !c.j.ok) {
            el('tgAyarlar').innerHTML = '<div class="tg-kart">' + bosHtml(c.kod === 404 ? 'Sunucu güncellemesi bekleniyor' : 'Ayarlar okunamadı', c.kod === 404 ? 'Kurulum bitince bu sayfa açılır.' : hataMetni(c), false) + '</div>';
            return;
        }
        d.ayar = kopya(c.j.ayar);
        d.kayitli = kopya(c.j.ayar);
        d.varsayilan = c.j.varsayilan;
        d.kurulum = c.j.kurulum !== false;
        d.hesaplar = c.j.hesaplar || [];
        d.sebepler = c.j.sebepler || [];
        d.son = c.j.son;
        d.sonlar = c.j.sonlar || { gece: c.j.son };
        d.bot = c.j.bot !== false;
        // Yeni sebep listede yoksa seçimde de görünsün
        var secili = d.ayar.kaldirmaRapor && d.ayar.kaldirmaRapor.sebepler;
        if (secili) secili.forEach(function (s) {
            if (!d.sebepler.some(function (x) { return x.ad === s; })) d.sebepler.push({ ad: s, adet: 0 });
        });
        try {
            var q = new URLSearchParams(location.search).get('sekme');
            if (['anlik', 'gonder', 'dps', 'kurye', 'kaldirma', 'itiraz'].indexOf(q) !== -1) d.sekme = q;
            else if (q === 'performans') d.sekme = 'kurye';
        } catch (e) { /* adres okunamadı */ }
        d.pf.bas = d.pf.son = pfDun();
        d.pfKatalog = c.j.performansKatalog || null;
        if (d.pfKatalog) {
            ['sutunlar', 'ozet'].forEach(function (a) {
                var v = a === 'ozet' ? d.pfKatalog.ozetVarsayilan : d.pfKatalog.varsayilan;
                if (!Array.isArray(d.ayar.performans.kurye[a])) { d.ayar.performans.kurye[a] = v.slice(); d.kayitli.performans.kurye[a] = v.slice(); }
            });
        }
        el('tgCubuk').hidden = false;
        // İki bölmeli masaüstü düzeni üst çubuğun boyunu bilmeli
        var ustOlc = function () {
            var u = document.querySelector('.sip-ust');
            if (u) document.documentElement.style.setProperty('--tg-ust', Math.round(u.getBoundingClientRect().height) + 'px');
        };
        ustOlc();
        global.addEventListener('resize', ustOlc);
        olaylariBagla();
        hesapCiz();
        uyariCiz();
        sekmeSec(d.sekme);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
