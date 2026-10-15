/**
 * Modül: Fırın Bildirimi (kontrol panelinde)
 * ============================================================================
 *
 * Arka plandaki fırın nöbetçisi (arka-plan/firin-nobet.js) belli aralıklarla
 * buraya `JBA_FIRIN_SOR` der. Burası sayfa köprüsünden (sayfa-koprusu.js)
 * panelin fırın tahminini ister, pişirme panelinin KENDİ hesabıyla
 * (moduller/firin-hesap.js, aynı ayarlar) neyin pişeceğini bulur ve listeyi
 * geri verir. Yeni sekme açılmaz.
 *
 * NE GÖSTERİLİYOR
 *   - Donuktan pişen ürün: pişirme panelinin ACİL / KRİTİK dediği satırlar.
 *     Rafta yok ya da raf hedefin dörtte birinin altında (öneri 6, raf 1).
 *     "Stok eksik (5/6)" gibi hafif eksik gösterilmiyor; panelde yine var.
 *     Donukta stok yoksa gösterilmiyor (pişirilemez).
 *   - Taze üretim ekmek: rafta 10 ve altı kaldıysa.
 *
 * Kart kapatılamıyor: pişirme yapılıp panel verisi güncellenene kadar
 * duruyor. Bilinen durum için ürün başına 1-4 saat ertelenebiliyor
 * (bu tarayıcıda, chrome.storage). Fırın sayfası yalnız düğmeyle açılıyor.
 * Simülasyonda üstte "Simülasyon" yazıyor, 10 sn sonra kapanıyor.
 * Panelin stilleriyle karışmasın diye gölge DOM içinde.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var PANO_YOLU = /^\/r\/[a-f0-9]{24}\/dashboard\/orders\/?$/;
    var EN_COK_KART = 3;
    var DILIM_SIRA = { 8: 0, 12: 1, 16: 2, 20: 3 };
    var DILIM_AD = ['08:00-12:00', '12:00-16:00', '16:00-20:00', '20:00-24:00'];
    var EKMEK_SINIRI = 10;
    var ERTELE_ANAHTARI = 'jbaFirinErtele';
    var ERTELE_SAATLER = [1, 2, 3, 4];

    var etkin = false;
    var kap = null;
    var kok = null;
    var son = { liste: [] };
    var simZamanlayici = null;
    /* Pişirme panelinin "Raf" sayısı API'de hangi alan: fırın sayfasında
       panel her açıldığında ölçülüp kaydediliyor (firin-pisirme.js). */
    var rafAlani = 'available';
    /* Ürün adı → erteleme bitişi (ms) */
    var ertele = {};

    var IKON_SAAT = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 6.5V10l2.5 1.5"/></svg>';
    var IKON_X = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>';

    var STIL = [
        ':host { all: initial; }',
        '.pano { position: fixed; top: 80px; right: 24px; z-index: 2147483000; width: 400px; max-width: calc(100vw - 32px);',
        '  box-sizing: border-box; padding: 16px; border-radius: 16px; background: #fff; color: #111827; overflow: hidden;',
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 18px;',
        '  box-shadow: 0 24px 60px rgba(16,24,40,.18), 0 0 0 1px rgba(217,119,6,.28);',
        '  animation: gir 220ms cubic-bezier(.22,1,.36,1); display: flex; flex-direction: column; max-height: calc(100vh - 104px); }',
        '.pano *, .pano *::before { box-sizing: border-box; }',
        '.pano::before { content: ""; position: absolute; inset: 0; border-radius: 16px; pointer-events: none;',
        '  box-shadow: inset 0 0 0 2px rgba(217,119,6,.55); animation: nabiz 1.8s ease-out infinite; }',
        '@keyframes gir { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }',
        '@keyframes nabiz { 0% { opacity: 1; } 70% { opacity: 0; } 100% { opacity: 0; } }',
        'button { font-family: inherit; }',
        'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }',

        '.ust { display: flex; align-items: center; gap: 12px; }',
        '.ikon { position: relative; flex: none; width: 36px; height: 36px; border-radius: 12px; background: #fff6e8; color: #d97706; display: grid; place-items: center; }',
        '.ikon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }',
        '.ikon i { position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: 999px; background: #d92d20; box-shadow: 0 0 0 2px #fff; animation: nokta 1.2s ease-in-out infinite; }',
        '@keyframes nokta { 50% { transform: scale(.7); opacity: .6; } }',
        '.metin { flex: 1; min-width: 0; }',
        '.baslik { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; line-height: 20px; }',
        '.sim { padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; line-height: 14px; }',
        '.alt { margin: 2px 0 0; font-size: 12px; color: #667085; }',

        '.liste { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }',
        '.ust, .daha, .git, .kart, .ertelenen { flex: none; }',
        '.kart { display: grid; grid-template-columns: 56px minmax(0, 1fr) 56px; column-gap: 12px; padding: 12px; border-radius: 12px; border-left: 6px solid var(--kenar); background: var(--zemin); }',
        '.kart.danger { --kenar: #ef4444; --zemin: #fef2f2; --hap: #fee2e2; --hap-yazi: #b42318; }',
        '.kart.warning { --kenar: #f59e0b; --zemin: #fffbeb; --hap: #fef3c7; --hap-yazi: #b45309; }',
        '.kart.info { --kenar: #3b82f6; --zemin: #eff6ff; --hap: #dbeafe; --hap-yazi: #1d4ed8; }',
        '.gorsel { width: 56px; height: 56px; border-radius: 9px; background: #fff; object-fit: cover; }',
        '.ad { margin: 0; font-size: 13px; font-weight: 600; line-height: 18px; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }',
        '.miktar { margin: 4px 0 0; font-size: 18px; font-weight: 700; line-height: 24px; color: #111827; font-variant-numeric: tabular-nums; }',
        '.sebep { margin: 4px 0 0; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 11px; color: #4b5563; }',
        '.hap { flex: none; padding: 2px 8px; border-radius: 999px; background: var(--hap); color: var(--hap-yazi); font-size: 10px; font-weight: 700; line-height: 14px; }',
        '.dilimler { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(17,24,39,.08); display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; text-align: center; color: #6b7280; }',
        '.dilimler b { display: block; font-size: 12px; font-weight: 600; color: #374151; font-variant-numeric: tabular-nums; }',
        '.dilimler span { font-size: 10px; }',
        '.dilimler .su b, .dilimler .su span { color: #16a34a; font-weight: 700; }',
        '.sag { padding-left: 12px; border-left: 1px solid rgba(17,24,39,.08); display: flex; flex-direction: column; justify-content: center; text-align: center; gap: 8px; }',
        '.sag span { display: block; font-size: 10px; font-weight: 600; color: #4b5563; letter-spacing: .02em; }',
        '.sag b { display: block; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }',

        /* Erteleme: kartın altında tek satır. Kapalıyken yalnız sessiz bir
           "Ertele" düğmesi, açılınca aynı yerde süre seçenekleri. */
        '.ertele { grid-column: 1 / -1; margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(17,24,39,.08);',
        '  display: grid; height: 40px; align-items: center; }',
        '.ertele > * { grid-area: 1 / 1; }',
        '.ertele__ac { justify-self: end; height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: #667085;',
        '  font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: background 160ms, color 160ms; }',
        '.ertele__ac:hover { background: rgba(17,24,39,.06); color: #111827; }',
        '.ertele svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }',
        '.ertele__secim { display: flex; align-items: center; gap: 6px; visibility: hidden; opacity: 0; transform: translateY(4px);',
        '  transition: opacity 160ms cubic-bezier(.22,1,.36,1), transform 160ms cubic-bezier(.22,1,.36,1), visibility 0s linear 160ms; }',
        '.ertele__etiket { flex: 1; min-width: 0; font-size: 11px; color: #667085; white-space: nowrap; }',
        '.ertele__sure { flex: none; min-width: 44px; height: 32px; padding: 0 8px; border: 1px solid rgba(17,24,39,.12); border-radius: 999px; background: #fff;',
        '  color: #111827; font-size: 12px; font-weight: 600; cursor: pointer; font-variant-numeric: tabular-nums; transition: border-color 160ms, background 160ms, color 160ms; }',
        '.ertele__sure:hover { border-color: #d97706; background: #fff6e8; color: #b45309; }',
        '.ertele__vazgec { flex: none; width: 32px; height: 32px; border: 0; border-radius: 999px; background: transparent; color: #667085; display: grid; place-items: center; cursor: pointer; }',
        '.ertele__vazgec:hover { background: rgba(17,24,39,.06); color: #111827; }',
        '.ertele[data-acik="1"] .ertele__ac { visibility: hidden; opacity: 0; }',
        '.ertele[data-acik="1"] .ertele__secim { visibility: visible; opacity: 1; transform: none; transition-delay: 0s; }',

        '.daha { margin: 8px 0 0; font-size: 12px; color: #667085; }',
        '.ertelenen { margin: 8px 0 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: #667085; }',
        '.ertelenen button { height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: #b45309; font-size: 12px; font-weight: 600; cursor: pointer; }',
        '.ertelenen button:hover { background: #fff6e8; }',

        '.git { width: 100%; height: 44px; margin-top: 12px; border: 0; border-radius: 9px; background: #d97706; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 160ms; }',
        '.git:hover { background: #b45309; }',
        '.git svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }',
        '.sure { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #6366f1; transform-origin: left; animation: sure linear forwards; }',
        '@keyframes sure { from { transform: scaleX(1); } to { transform: scaleX(0); } }',
        '@media (prefers-reduced-motion: reduce) { .pano, .pano::before, .ikon i { animation: none; } .pano::before { opacity: .6; }',
        '  .ertele__secim, .ertele__ac, .ertele__sure, .git { transition: none; } }'
    ].join('\n');

    var ETIKET = {
        'urgent-prep': 'ACİL PİŞİR', danger: 'ACİL PİŞİR', warning: 'PİŞİRME GEREKLİ', info: 'HAZIRLIK YAP',
        'ekmek-bitti': 'EKMEK BİTTİ', 'ekmek-az': 'EKMEK AZALDI'
    };

    function kacir(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function sayi(v) {
        var n = Number(v);
        return Number.isFinite(n) ? Math.round(n) : 0;
    }

    // ==================================================================
    // Hesap: panel verisi → bildirim listesi
    // ==================================================================

    function dilimSirasi(bas) {
        var saat = Number(String(bas || '').slice(11, 13));
        return Object.prototype.hasOwnProperty.call(DILIM_SIRA, saat) ? DILIM_SIRA[saat] : -1;
    }

    function rafDegeri(u) {
        if (typeof u.raf !== 'number') return null;
        return rafAlani === 'available+reserve' ? u.raf + (Number(u.rezerv) || 0) : u.raf;
    }

    /* API cevabını pişirme panelinin ürün biçimine çevirir: dört dilimin
       önerisi (Pişir N) ve şu anki dilimin raf/donuk sayısı. */
    function urunlereCevir(dilimler, simdi) {
        var suan = JBA.firinHesap.dilim(new Date(simdi).getHours()).index;
        var ada = {};
        var sira = [];
        (dilimler || []).forEach(function (d) {
            var i = dilimSirasi(d.bas);
            if (i < 0) return;
            (d.urunler || []).forEach(function (u) {
                if (!u || typeof u.ad !== 'string' || !u.ad) return;
                var p = ada[u.ad];
                if (!p) {
                    p = ada[u.ad] = { name: u.ad, imgSrc: u.gorsel || '', currentStock: 0, frozenStock: 0,
                        recommendations: [0, 0, 0, 0], stokOkundu: false, _stokDilim: -1 };
                    sira.push(u.ad);
                }
                p.recommendations[i] = Number(u.oneri) || 0;
                var raf = rafDegeri(u);
                // Stok önce şu anki dilimden; yoksa ilk bulunan dilimden
                if (raf !== null && typeof u.donuk === 'number' && p._stokDilim !== suan && (!p.stokOkundu || i === suan)) {
                    p.currentStock = raf;
                    p.frozenStock = u.donuk;
                    p.stokOkundu = true;
                    p._stokDilim = i;
                }
            });
        });
        return sira.map(function (ad) { return ada[ad]; });
    }

    /* Bildirime girenler:
         - Donuktan pişen: pişirme panelinin ACİL (raf 0, sonraki dilime acil
           hazırlık) ve KRİTİK (raf < hedefin dörtte biri) satırları.
           Panel ikisini de kırmızı `danger` / `urgent-prep` olarak işaretliyor.
         - Taze üretim ekmek: rafta EKMEK_SINIRI ve altı. */
    function bildirimListesi(urunler, simdi) {
        var stoklu = urunler.filter(function (p) { return p.stokOkundu; });
        var suan = JBA.firinHesap.dilim(new Date(simdi).getHours()).index;
        var liste = JBA.firinHesap.oneriler(stoklu, JBA.firinHesap.ayarlar(), simdi)
            .filter(function (r) {
                return !r.displayKind && r.amountToCook > 0 && r.frozenStock > 0 &&
                    (r.alertLevel === 'danger' || r.alertLevel === 'urgent-prep');
            })
            .map(function (r) {
                return {
                    ad: r.name, gorsel: r.imgSrc, raf: r.currentStock, donuk: r.frozenStock,
                    oneri: r.currentTarget, pisir: r.amountToCook, seviye: r.alertLevel,
                    sebep: r.reason, oneriler: r.recommendations.slice(0, 4)
                };
            });
        stoklu.forEach(function (p) {
            if (!JBA.firinHesap.ekmekMi(p.name)) return;
            var raf = Math.max(0, Number(p.currentStock) || 0);
            if (raf > EKMEK_SINIRI) return;
            var hedef = Number(p.recommendations[suan]) || 0;
            liste.push({
                ad: p.name, gorsel: p.imgSrc, raf: raf, donuk: null, oneri: hedef,
                pisir: Math.max(0, hedef - raf), ekmek: true,
                seviye: raf === 0 ? 'ekmek-bitti' : 'ekmek-az',
                sebep: 'Rafta ' + raf + (hedef ? ', dilim hedefi ' + hedef + '.' : ' kaldı.'),
                oneriler: p.recommendations.slice(0, 4)
            });
        });
        return liste.sort(function (a, b) { return (a.raf - b.raf) || (b.oneri - a.oneri); });
    }

    /* Simülasyon: gerçek ürünlerden rastgele 1-4 tanesinin rafı boşaltılıyor,
       hesap yine gerçek hesap. */
    function simUrunleri(urunler, simdi) {
        var suan = JBA.firinHesap.dilim(new Date(simdi).getHours()).index;
        var adaylar = urunler.slice();
        for (var i = adaylar.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = adaylar[i]; adaylar[i] = adaylar[j]; adaylar[j] = t;
        }
        var adet = 1 + Math.floor(Math.random() * Math.min(4, adaylar.length));
        var secilen = {};
        adaylar.slice(0, adet).forEach(function (p) { secilen[p.name] = true; });
        return urunler.map(function (p) {
            var k = JSON.parse(JSON.stringify(p));
            if (!secilen[k.name]) { k.stokOkundu = false; return k; }
            k.stokOkundu = true;
            if (JBA.firinHesap.ekmekMi(k.name)) { k.currentStock = Math.floor(Math.random() * (EKMEK_SINIRI + 1)); return k; }
            if (!k.recommendations[suan]) k.recommendations[suan] = 4 + Math.floor(Math.random() * 9);
            // Raf 0 ya da hedefin beşte birinin altı: panelin kritik saydığı aralık
            k.currentStock = Math.random() < 0.5 ? 0 : Math.floor((k.recommendations[suan] - 1) / 5);
            if (!(k.frozenStock > 0)) k.frozenStock = 6 + Math.floor(Math.random() * 35);
            return k;
        });
    }

    function ertelenmisMi(ad, simdi) {
        return (ertele[ad] || 0) > (simdi || Date.now());
    }

    function hesapla(sonuc, sim) {
        var simdi = Date.now();
        var urunler = urunlereCevir(sonuc.dilimler, simdi);
        var liste = bildirimListesi(sim ? simUrunleri(urunler, simdi) : urunler, simdi);
        var ertelenen = sim ? 0 : liste.filter(function (u) { return ertelenmisMi(u.ad, simdi); }).length;
        return {
            ok: true,
            liste: liste,
            gorunenSayisi: liste.length - ertelenen,
            ertelenenSayisi: ertelenen,
            urunSayisi: urunler.length,
            stokluSayisi: urunler.filter(function (p) { return p.stokOkundu; }).length,
            dilimler: DILIM_AD,
            simdiki: JBA.firinHesap.dilim(new Date(simdi).getHours()).index
        };
    }

    // ==================================================================
    // Erteleme
    // ==================================================================

    function erteleOku(sonra) {
        try {
            chrome.storage.local.get(ERTELE_ANAHTARI, function (r) {
                void chrome.runtime.lastError;
                var k = (r && r[ERTELE_ANAHTARI]) || {};
                var simdi = Date.now();
                ertele = {};
                Object.keys(k).forEach(function (ad) { if (Number(k[ad]) > simdi) ertele[ad] = Number(k[ad]); });
                if (sonra) sonra();
            });
        } catch (e) { if (sonra) sonra(); }
    }

    function erteleYaz() {
        var k = {};
        var simdi = Date.now();
        Object.keys(ertele).forEach(function (ad) { if (ertele[ad] > simdi) k[ad] = ertele[ad]; });
        try { chrome.storage.local.set({ [ERTELE_ANAHTARI]: k }); } catch (e) { /* yetim bağlam */ }
    }

    // ==================================================================
    // Çizim
    // ==================================================================

    function kaldir() {
        clearTimeout(simZamanlayici);
        simZamanlayici = null;
        if (kap) kap.remove();
        kap = null;
        kok = null;
    }

    /** Pişirme panelindeki kartın küçüğü, altında erteleme satırı */
    function kartHtml(u, dilimler, simdiki, sim) {
        var seviye = u.seviye === 'urgent-prep' || u.seviye === 'ekmek-bitti' ? 'danger'
            : u.seviye === 'ekmek-az' ? 'warning'
            : (ETIKET[u.seviye] ? u.seviye : 'warning');
        var gorsel = /^https:\/\//.test(u.gorsel || '')
            ? '<img class="gorsel" src="' + kacir(u.gorsel) + '" alt="">'
            : '<span class="gorsel"></span>';
        var oneriler = Array.isArray(u.oneriler) ? u.oneriler : [];
        var dilimHtml = (dilimler || []).slice(0, 4).map(function (et, i) {
            return '<div' + (i === simdiki ? ' class="su"' : '') + '><b>' + sayi(oneriler[i]) + '</b>' +
                '<span>' + kacir(String(et).replace(/:00/g, '')) + '</span></div>';
        }).join('');
        var miktar = u.ekmek
            ? (u.pisir > 0 ? sayi(u.pisir) + ' Adet Üretilmeli' : sayi(u.raf) + ' Adet Kaldı')
            : sayi(u.pisir) + ' Adet Pişirilecek';
        var sag = '<div><span>MEVCUT</span><b>' + sayi(u.raf) + '</b></div>' +
            (u.ekmek ? '<div><span>HEDEF</span><b>' + sayi(u.oneri) + '</b></div>'
                     : '<div><span>DONUK</span><b>' + sayi(u.donuk) + '</b></div>');
        var erteleHtml = sim ? '' :
            '<div class="ertele" data-acik="0">' +
                '<button type="button" class="ertele__ac" aria-expanded="false">' + IKON_SAAT + '<span>Ertele</span></button>' +
                '<div class="ertele__secim" role="group" aria-label="Bu ürünün bildirimini ertele">' +
                    '<span class="ertele__etiket">Şu süre gösterme</span>' +
                    ERTELE_SAATLER.map(function (s) {
                        return '<button type="button" class="ertele__sure" data-sa="' + s + '" tabindex="-1">' + s + ' sa</button>';
                    }).join('') +
                    '<button type="button" class="ertele__vazgec" aria-label="Vazgeç" tabindex="-1">' + IKON_X + '</button>' +
                '</div>' +
            '</div>';
        return '<li class="kart ' + seviye + '" data-ad="' + kacir(u.ad) + '">' + gorsel +
            '<div class="orta">' +
                '<p class="ad" title="' + kacir(u.ad) + '">' + kacir(u.ad) + '</p>' +
                '<p class="miktar">' + miktar + '</p>' +
                '<p class="sebep"><span class="hap">' + kacir(ETIKET[u.seviye] || 'PİŞİRME GEREKLİ') + '</span>' +
                '<span>' + kacir(u.sebep || '') + '</span></p>' +
                (dilimHtml ? '<div class="dilimler">' + dilimHtml + '</div>' : '') +
            '</div>' +
            '<div class="sag">' + sag + '</div>' +
            erteleHtml +
        '</li>';
    }

    function erteleAcKapa(satir, ac) {
        if (!satir) return;
        satir.setAttribute('data-acik', ac ? '1' : '0');
        var acDugme = satir.querySelector('.ertele__ac');
        if (acDugme) {
            acDugme.setAttribute('aria-expanded', ac ? 'true' : 'false');
            acDugme.tabIndex = ac ? -1 : 0;
        }
        satir.querySelectorAll('.ertele__secim button').forEach(function (b) { b.tabIndex = ac ? 0 : -1; });
        if (ac) { var ilk = satir.querySelector('.ertele__sure'); if (ilk) ilk.focus({ preventScroll: true }); }
        else if (acDugme) acDugme.focus({ preventScroll: true });
    }

    function tiklama(e) {
        var hedef = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!hedef) return;
        if (hedef.classList.contains('git')) {
            try { chrome.runtime.sendMessage({ type: 'JBA_FIRIN_AC' }, function () { void chrome.runtime.lastError; }); }
            catch (x) { /* yetim bağlam */ }
            return;
        }
        if (hedef.classList.contains('geri-al')) {
            (son.liste || []).forEach(function (u) { delete ertele[u.ad]; });
            erteleYaz();
            ciz(son);
            return;
        }
        var satir = hedef.closest('.ertele');
        if (!satir) return;
        if (hedef.classList.contains('ertele__ac')) { erteleAcKapa(satir, true); return; }
        if (hedef.classList.contains('ertele__vazgec')) { erteleAcKapa(satir, false); return; }
        var saat = Number(hedef.getAttribute('data-sa'));
        var kart = hedef.closest('.kart');
        var ad = kart && kart.getAttribute('data-ad');
        if (!saat || !ad) return;
        // data-ad kaçırılmış metin; listedeki asıl adı bul
        var u = (son.liste || []).filter(function (x) { return kacir(x.ad) === ad || x.ad === ad; })[0];
        if (!u) return;
        ertele[u.ad] = Date.now() + saat * 3600 * 1000;
        erteleYaz();
        ciz(son);
    }

    function ciz(m) {
        son = m || { liste: [] };
        var tum = son.liste || [];
        var simdi = Date.now();
        var liste = son.sim ? tum : tum.filter(function (u) { return !ertelenmisMi(u.ad, simdi); });
        var ertelenen = tum.length - liste.length;
        kaldir();
        if (!etkin || !PANO_YOLU.test(location.pathname) || !liste.length) return;

        kap = document.createElement('div');
        kap.id = 'jba-firin-uyari';
        kok = kap.attachShadow({ mode: 'closed' });
        document.documentElement.appendChild(kap);

        var dilimler = Array.isArray(son.dilimler) ? son.dilimler : DILIM_AD;
        var simdiki = typeof son.simdiki === 'number' ? son.simdiki : -1;
        var goster = liste.slice(0, EN_COK_KART);
        var alt = (simdiki > -1 && dilimler[simdiki] ? dilimler[simdiki] + ' dilimi · ' : '') +
            liste.length + ' ürün bekliyor';
        var sure = son.sim ? Math.max(1000, Math.min(60000, sayi(son.sure) || 10000)) : 0;

        kok.innerHTML = '<style>' + STIL + '</style>' +
            '<div class="pano" role="alert" aria-live="polite">' +
                '<div class="ust">' +
                    '<span class="ikon"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0v6H4z"/><path d="M8 18v-3M12 18v-4M16 18v-3"/></svg><i></i></span>' +
                    '<div class="metin"><p class="baslik">Pişirme Zamanı' + (son.sim ? '<span class="sim">Simülasyon</span>' : '') + '</p>' +
                    '<p class="alt">' + kacir(alt) + '</p></div>' +
                '</div>' +
                '<ul class="liste">' + goster.map(function (u) { return kartHtml(u, dilimler, simdiki, son.sim); }).join('') + '</ul>' +
                (liste.length > goster.length ? '<p class="daha">+' + (liste.length - goster.length) + ' ürün daha</p>' : '') +
                (ertelenen ? '<p class="ertelenen"><span>' + ertelenen + ' ürün ertelendi</span><button type="button" class="geri-al">Geri Al</button></p>' : '') +
                '<button type="button" class="git"><span>Fırın Sayfasını Aç</span><svg viewBox="0 0 20 20"><path d="M8 5h7v7M15 5l-9 9"/></svg></button>' +
                (sure ? '<span class="sure" style="animation-duration:' + sure + 'ms"></span>' : '') +
            '</div>';

        kok.querySelector('.pano').addEventListener('click', tiklama);
        kok.querySelector('.pano').addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var acik = kok.querySelector('.ertele[data-acik="1"]');
            if (acik) erteleAcKapa(acik, false);
        });
        if (sure) {
            simZamanlayici = setTimeout(function () {
                // Simülasyon bitti: gerçek liste varsa o geri gelsin
                var gercek = son.gercek;
                kaldir();
                if (gercek && gercek.liste && gercek.liste.length) ciz(gercek);
            }, sure);
        }
    }

    // ==================================================================
    // Sayfa köprüsü
    // ==================================================================

    /* Sayfa köprüsüne sor, cevabı bekle (en fazla 20 sn) */
    var soruNo = 0;
    function tahminSor() {
        return new Promise(function (coz) {
            var no = 'f' + Date.now() + '-' + (++soruNo);
            var bitti = false;
            function dinle(e) {
                if (e.source !== window || e.origin !== location.origin) return;
                var d = e.data;
                if (!d || d.type !== 'JB_FIRIN_TAHMIN' || d.no !== no) return;
                bitir(d.sonuc || { ok: false });
            }
            function bitir(v) {
                if (bitti) return;
                bitti = true;
                window.removeEventListener('message', dinle);
                coz(v);
            }
            window.addEventListener('message', dinle);
            setTimeout(function () { bitir({ ok: false, sebep: 'zaman aşımı' }); }, 20000);
            window.postMessage({ type: 'JB_FIRIN_TAHMIN_SOR', no: no }, location.origin);
        });
    }

    function rafAlaniOku() {
        try {
            chrome.storage.local.get('jbaFirinRafAlani', function (r) {
                void chrome.runtime.lastError;
                var a = r && r.jbaFirinRafAlani && r.jbaFirinRafAlani.alan;
                if (a === 'available' || a === 'available+reserve') rafAlani = a;
            });
        } catch (e) { /* yetim bağlam */ }
    }

    try {
        chrome.runtime.onMessage.addListener(function (m, gonderen, cevapla) {
            if (m && m.type === 'JBA_FIRIN_SOR') {
                if (!etkin || !JBA.firinHesap) { cevapla({ ok: false, sebep: 'kapalı' }); return false; }
                tahminSor().then(function (sonuc) {
                    if (!sonuc || !sonuc.ok) { cevapla(sonuc || { ok: false }); return; }
                    try { cevapla(hesapla(sonuc, !!m.sim)); }
                    catch (e) { cevapla({ ok: false, sebep: 'hesap: ' + String(e && e.message || e).slice(0, 80) }); }
                });
                return true;
            }
            if (!m || m.type !== 'JBA_FIRIN_UYARI') return false;
            var liste = Array.isArray(m.liste) ? m.liste.filter(function (u) { return u && typeof u.ad === 'string'; }) : [];
            var yeni = { liste: liste, dilimler: m.dilimler, simdiki: m.simdiki, sim: !!m.sim, sure: m.sure };
            if (m.sim) {
                // Gerçek uyarı varken simülasyon gösterilirse süre bitince gerçek geri gelir
                yeni.gercek = son && !son.sim ? son : (son && son.gercek) || null;
                ciz(yeni);
                return false;
            }
            // Simülasyon ekrandayken gelen gerçek sonuç simülasyonu bölmez, sonrası için saklanır
            if (son && son.sim && kap) { son.gercek = yeni; return false; }
            // Erteleme seçenekleri açıkken aynı liste yeniden çizilip kapanmasın
            if (kap && kok && kok.querySelector('.ertele[data-acik="1"]') && JSON.stringify(son.liste) === JSON.stringify(liste)) return false;
            ciz(yeni);
            return false;
        });
        chrome.storage.onChanged.addListener(function (d, alan) {
            if (alan !== 'local') return;
            if (d.jbaFirinRafAlani) rafAlaniOku();
            // Başka sekmede ertelendi ya da geri alındı
            if (d[ERTELE_ANAHTARI] && !son.sim) erteleOku(function () { ciz(son); });
        });
    } catch (e) { /* yetim bağlam */ }

    rafAlaniOku();
    erteleOku();

    JBA.kayit({
        kimlik: 'firinUyari',
        ad: 'Fırın Bildirimi',
        ozet: 'Kontrol panelinde pişirilmesi gereken ürün varsa sağ üstte bildirim gösterir.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return PANO_YOLU.test(yol); },

        baslat: function () {
            etkin = true;
            try { chrome.runtime.sendMessage({ type: 'JBA_FIRIN_PANO_HAZIR' }, function () { void chrome.runtime.lastError; }); }
            catch (e) { /* yetim bağlam */ }
            if (!son.sim) ciz(son);
        },

        durdur: function () {
            etkin = false;
            kaldir();
        }
    });
})(window);
