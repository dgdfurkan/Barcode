/**
 * Telegram Raporları (/telegram/)
 * ============================================================================
 *
 * Üç sekme, hepsi tek ayar nesnesinde (vps-api/telegram-ayar.js):
 *   Zamanlı Rapor   ayar.gece: saatler (en çok 4), bölümler ve seçenekleri
 *   Anlık Bildirim  ayar.anlik: satıştan kaldırma durum değişince giden mesaj
 *   Elle Gönderim   ayar.kaldirmaGonder: Satıştan Kaldırma sayfasındaki
 *                   "Telegram'a Gönder" panelinin açılış seçimi
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
        uyari: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.5"/></svg>'
    };

    // ------------------------------------------------------------------
    // Ayar okuma ve yazma (yol: 'gece.kaldirma.red.goster')
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
        onizlemeZamanla();
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

    function saatlerHtml() {
        var saatler = al('gece.saatler') || [60];
        var tek = saatler.length === 1;
        var secenek = '';
        for (var dk = 0; dk < 1440; dk += SAAT_ADIM) {
            if (saatler.indexOf(dk) === -1) secenek += '<option value="' + dk + '">' + saatYazi(dk) + '</option>';
        }
        return '<div class="tg-saatler">' + saatler.map(function (dk) {
            return '<span class="tg-saat' + (tek ? ' is-tek' : '') + '">' + saatYazi(dk) +
                (tek ? '' : '<button type="button" data-saat-sil="' + dk + '" data-odak="sil:' + dk + '" aria-label="' + saatYazi(dk) + ' saatini kaldır">' + IKON.carpi + '</button>') + '</span>';
        }).join('') +
            (saatler.length < EN_COK_SAAT
                ? '<label class="tg-saat-ekle">' + IKON.arti + 'Saat Ekle<select data-saat-ekle data-odak="saat-ekle" aria-label="Rapor saati ekle"><option value="">Saat seç</option>' + secenek + '</select></label>'
                : '') +
            '</div>';
    }

    function sebeplerHtml() {
        if (!d.sebepler.length) return '<p class="tg-satir__metin"><small>Son 60 günde kayıt yok; bütün sebepler gönderilir.</small></p>';
        var secili = al('gece.kaldirma.sebepler');
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

    function geceHtml() {
        var acik = !!al('gece.acik');
        var sonuc = !!al('gece.itiraz.sonuc');
        return kartHtml({
            ikon: IKON.saat, baslik: 'Gönderim', anahtar: 'gece.acik',
            aciklama: acik ? 'Her gün seçtiğin saatlerde. Her rapor bir öncekinden bu yana olanları içerir.' : 'Zamanlı rapor kapalı.',
            govde: '<div class="tg-satir tg-satir--dikey"><span class="tg-satir__metin"><b>Saatler</b><small>Gün içinde en çok ' + EN_COK_SAAT + ' saat seçebilirsin.</small></span>' + saatlerHtml() + '</div>'
        }) +
        kartHtml({ ikon: IKON.ozet, baslik: 'Özet Kartı', aciklama: 'Albümün ilk kartı: sayılar ve günlük sayımın durumu.', anahtar: 'gece.bolumler.ozet' }) +
        kartHtml({
            ikon: IKON.kaldirma, baslik: 'Satıştan Kaldırma', aciklama: 'Her grup ayrı açılır; hasar fotoğrafı grup başına seçilir.', anahtar: 'gece.bolumler.kaldirma',
            govde: grupSatiri('Reddedilen ve İptal Edilen', 'Rapor aralığında reddedilen ya da iptal edilenler', 'gece.kaldirma.red') +
                grupSatiri('Onay Bekleyen', 'Şu an sonuç bekleyen kayıtlar', 'gece.kaldirma.bekleyen') +
                grupSatiri('Tamamlanan', 'Rapor aralığında tamamlananlar', 'gece.kaldirma.tamam') +
                satirAnahtar('Yeniden Girilenleri Gizle', 'İptalden sonra depo aynı ürünü yeniden girdiyse gösterme', 'gece.kaldirma.yenidenGizle', !al('gece.kaldirma.red.goster')) +
                satirSegment('Grup Başına En Çok', null, 'gece.kaldirma.sinir', [[10, '10'], [20, '20'], [40, '40']]) +
                '<p class="tg-alt-baslik">Sebepler</p>' + sebeplerHtml()
        }) +
        kartHtml({
            ikon: IKON.itiraz, baslik: 'İtirazlar', aciklama: 'Depo değerlendirme kayıtları.', anahtar: 'gece.bolumler.itiraz',
            govde: satirSegment('İtiraz Bekleyenler', 'Süresi dolmamış kayıtlar', 'gece.itiraz.bekleyen', [['hepsi', 'Hepsi'], ['acil', '24 Saatten Az'], ['yok', 'Gösterme']]) +
                satirAnahtar('Müşteri Notu', 'Bekleyen kaydın altında', 'gece.itiraz.not', al('gece.itiraz.bekleyen') === 'yok') +
                satirAnahtar('Sonuçlananlar', 'Rapor aralığında kabul ya da red gelenler', 'gece.itiraz.sonuc') +
                satirAnahtar('Gönderilen İtiraz Metni', 'Sonuçlanan kaydın altında', 'gece.itiraz.metin', !sonuc)
        }) +
        kartHtml({
            ikon: IKON.sayim, baslik: 'Sayımlar', aciklama: 'Rapor aralığında tamamlanan sayımlar.', anahtar: 'gece.bolumler.sayim',
            govde: satirAnahtar('Günlük Sayım', 'Otomatik 50\'lik sayım, paneldeki durumuyla', 'gece.sayim.gunluk') +
                satirAnahtar('Diğer Sayımlar', 'Elle açılan sayımlar', 'gece.sayim.diger') +
                satirAnahtar('Başlama ve Bitiş Saatleri', 'Her sayımın başlığında', 'gece.sayim.saatler') +
                satirAnahtar('Farksız Sayımlar', 'Kapalıysa yalnız farkı olan sayımlar gelir', 'gece.sayim.farksiz') +
                satirSegment('Ürün Listesi', null, 'gece.sayim.liste', [['fark', 'Yalnız Farklar'], ['hepsi', 'Bütün Ürünler']]) +
                satirSegment('Fark Eşiği', 'Bu kadar ve daha büyük farklar', 'gece.sayim.esik', [[0, 'Her Fark'], [2, '±2'], [5, '±5'], [10, '±10']])
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

    function ayarCiz() {
        var kutu = el('tgAyarlar');
        var odak = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-odak') : null;
        kutu.innerHTML = d.sekme === 'anlik' ? anlikHtml() : d.sekme === 'gonder' ? gonderHtml() : geceHtml();
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
        if (!d.son || !d.son.gonderildi) return 'Henüz zamanlı rapor gönderilmedi.';
        var t = new Date(d.son.gonderildi).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        return 'Son rapor: ' + t + (d.son.kart ? ' · ' + d.son.kart + ' kart' : '');
    }

    function cubukCiz() {
        var degis = degistiMi();
        var durum = el('tgKayitDurum');
        durum.textContent = d.kaydediyor ? 'Kaydediliyor...' : degis ? 'Kaydedilmemiş değişiklik var' : (d.sekme === 'gece' ? sonYazi() : 'Kaydedildi');
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
        var parca = d.sekme === 'anlik' ? d.ayar.anlik : d.sekme === 'gonder' ? d.ayar.kaldirmaGonder : d.ayar.gece;
        return d.sekme + '|' + (d.sekme === 'gonder' ? 'g' : d.veri) + '|' + JSON.stringify(parca);
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
        onizlemeCiz();
        var c;
        if (d.sekme === 'gonder') {
            c = await istek('/api/kaldirma/onizleme', { secim: d.ayar.kaldirmaGonder });
        } else {
            var ayar = d.sekme === 'anlik' ? { anlik: d.ayar.anlik } : { gece: d.ayar.gece };
            c = await istek('/api/telegram-ayar/onizleme', { rapor: d.sekme === 'anlik' ? 'anlik' : 'gece', veri: d.veri, ayar: ayar });
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
        o.sonuc[anahtar] = c.kod === 200 && c.j.ok ? { ok: true, j: c.j } : { ok: false, metin: hataMetni(c) };
        o.goster = anahtar;
        onizlemeCiz();
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
            return '<button type="button" data-kart="' + i + '" aria-label="Kart ' + (i + 1) + ' büyüt"><img src="' + k + '" alt="" loading="lazy" decoding="async">' +
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
        el('tgSohbetAlt').textContent = d.sekme === 'gonder' ? 'son 7 günün kayıtlarıyla' : d.veri === 'ornek' ? 'örnek veriyle' : 'gerçek verinle';

        var anahtar = onizlemeAnahtari();
        var s = o.sonuc[o.goster];
        // Yeni sonuç gelene kadar eskisi soluk durur: yerleşim zıplamaz
        kutu.classList.toggle('is-eski', !!(o.yukleniyor && s));
        if (!s) { if (o.yukleniyor) kutu.innerHTML = iskeletHtml(); return; }
        if (o.goster !== anahtar && !o.yukleniyor) { onizlemeZamanla(true); }
        if (!s.ok) { kutu.innerHTML = bosHtml('Önizleme alınamadı', s.metin, true); return; }
        var j = s.j;
        var kaydir = kutu.scrollTop;
        if (d.sekme === 'anlik') {
            var m = j.mesajlar || [];
            kutu.innerHTML = m.length ? m.map(function (x) {
                return '<div class="tg-mesaj">' + (x.gorsel ? '<img class="tg-mesaj__resim" src="' + kacis(x.gorsel) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') +
                    '<p class="tg-mesaj__yazi">' + kacis(x.metin) + '</p><span class="tg-mesaj__saat">' + (x.ornek ? 'örnek · ' : '') + simdiSaat() + '</span></div>';
            }).join('') : bosHtml('Anlık bildirim kapalı', 'Hiçbir durum seçili değil; bildirim gelmez.');
        } else {
            var kartlar = j.kartlar || [];
            if (!kartlar.length) {
                kutu.innerHTML = d.sekme === 'gonder'
                    ? bosHtml('Gönderilecek kart yok', 'Son 7 günde seçili gruplarda kayıt yok.')
                    : bosHtml('Gönderilecek kart yok', d.veri === 'gercek' ? 'Bu ayarla rapor aralığında içerik yok; rapor bu saatte gitmez. Örnek Veri ile görünümü inceleyebilirsin.' : 'Bütün bölümler kapalı.');
            } else {
                var saatler = (d.ayar.gece.saatler || [60]).map(saatYazi);
                var yazi = d.sekme === 'gonder'
                    ? 'Satıştan Kaldırma · son 7 gün' + (j.gruplar ? '\n' + [j.gruplar.red ? j.gruplar.red + ' reddedilen / iptal' : '', j.gruplar.bekleyen ? j.gruplar.bekleyen + ' onay bekleyen' : '', j.gruplar.tamam ? j.gruplar.tamam + ' tamamlanan' : ''].filter(Boolean).join('\n') : '')
                    : j.baslik;
                kutu.innerHTML = (d.sekme === 'gece' ? '<span class="tg-etiket">' + kacis(saatler.join(' · ')) + '</span>' : '') +
                    albumHtml(kartlar, yazi, d.sekme === 'gece' ? saatler[0] : simdiSaat());
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
        d.gonderiyor = true;
        cubukCiz();
        var c;
        if (d.sekme === 'gonder') {
            var a = sonYediGun();
            c = await istek('/api/kaldirma/rapor', { bas: a.bas, son: a.son, secim: d.ayar.kaldirmaGonder });
        } else {
            var ayar = d.sekme === 'anlik' ? { anlik: d.ayar.anlik } : { gece: d.ayar.gece };
            c = await istek('/api/telegram-ayar/test', { rapor: d.sekme === 'anlik' ? 'anlik' : 'gece', ayar: ayar });
        }
        d.gonderiyor = false;
        cubukCiz();
        if (c.kod === 200 && c.j.ok) bildir((c.j.kart || 1) + (d.sekme === 'anlik' ? ' mesaj' : ' kart') + ' Telegram\'a gönderildi.', 'basari');
        else bildir(hataMetni(c), 'hata');
    }

    async function varsayilanaDon() {
        var alan = d.sekme === 'anlik' ? 'anlik' : d.sekme === 'gonder' ? 'kaldirmaGonder' : 'gece';
        var onay = global.JBDiyalog && global.JBDiyalog.onay
            ? await global.JBDiyalog.onay('Bu sekmedeki seçimler ilk hâline döner. Kaydetmeden önce önizlemede görebilirsin.', { baslik: 'Varsayılana dönülsün mü?', onayYazi: 'Varsayılana Dön' })
            : global.confirm('Varsayılana dönülsün mü?');
        if (!onay) return;
        var saatler = d.ayar.gece.saatler;
        d.ayar[alan] = kopya(d.varsayilan[alan]);
        // Saatler varsayılana dönmez: kullanıcının en sık değiştirmeyeceği seçim
        if (alan === 'gece') d.ayar.gece.saatler = saatler;
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
            b.setAttribute('aria-selected', String(b.getAttribute('data-sekme') === sekme));
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
                var l = (al('gece.saatler') || []).concat(dk).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
                koy('gece.saatler', l.slice(0, EN_COK_SAAT));
            }
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
                var l = (al('gece.saatler') || []).filter(function (x) { return x !== dk; });
                if (l.length) koy('gece.saatler', l);
                return;
            }
            if (e.target.closest('[data-sebep-hepsi]')) {
                if (al('gece.kaldirma.sebepler')) koy('gece.kaldirma.sebepler', null);
                return;
            }
            var sb = e.target.closest('[data-sebep]');
            if (sb) {
                var ad = sb.getAttribute('data-sebep');
                var tum = d.sebepler.map(function (x) { return x.ad; });
                var secili = al('gece.kaldirma.sebepler') || tum.slice();
                var yeni = secili.indexOf(ad) === -1 ? secili.concat(ad) : secili.filter(function (x) { return x !== ad; });
                if (!yeni.length) { bildir('En az bir sebep seçili kalmalı.'); return; }
                var hepsi = tum.every(function (x) { return yeni.indexOf(x) !== -1; });
                koy('gece.kaldirma.sebepler', hepsi ? null : yeni);
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
        d.bot = c.j.bot !== false;
        // Yeni sebep listede yoksa seçimde de görünsün
        var secili = d.ayar.gece.kaldirma.sebepler;
        if (secili) secili.forEach(function (s) {
            if (!d.sebepler.some(function (x) { return x.ad === s; })) d.sebepler.push({ ad: s, adet: 0 });
        });
        try {
            var q = new URLSearchParams(location.search).get('sekme');
            if (q === 'anlik' || q === 'gonder') d.sekme = q;
        } catch (e) { /* adres okunamadı */ }
        el('tgCubuk').hidden = false;
        olaylariBagla();
        hesapCiz();
        uyariCiz();
        sekmeSec(d.sekme);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
    else basla();
})(window);
