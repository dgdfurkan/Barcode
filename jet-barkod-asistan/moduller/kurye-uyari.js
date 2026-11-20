/**
 * Modül: Kurye Uyarısı (depo panelinin sipariş ekranı, sol üst)
 * ============================================================================
 *
 * Arka plan (arka-plan/kurye-nobet.js) seçilen sıklıkla franchise panelinden
 * kurye sayılarını okuyup JBA_KURYE_UYARI gönderir. Burası iki kart çizer:
 *   - Kurye eksiği: planlanan > aktif (müsait + siparişte + geri dönen).
 *   - Uzun mola: eşikten uzun süredir meşgulde kalan kurye (fotoğrafıyla).
 * Her kartta Ertele (15 / 30 / 45 dk, 1 sa); ertelenen kart o süre gelmez,
 * sesi de çalmaz. Çarpı kartları bir sonraki değişikliğe kadar gizler.
 * Fırın bildirimi sağ üstte, bu sol üstte: üst üste binmez.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var PANO_YOLU = /^\/r\/[a-f0-9]{24}\/dashboard\/orders\/?$/;
    var ERTELE_DK = [15, 30, 45, 60];

    var etkin = false;
    var kap = null;
    var kok = null;
    var son = null;
    var gizliImza = '';
    var simZaman = null;
    var gercek = null; // simülasyon ekrandayken gelen son gerçek uyarı

    var IKON_KURYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6M13 7h3l2.5 10M6 14l3-5h5"/></svg>';
    var IKON_SAAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
    var IKON_X = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>';

    var STIL = [
        ':host { all: initial; }',
        '.pano { position: fixed; top: 80px; left: 24px; z-index: 2147483000; width: 360px; max-width: calc(100vw - 32px); max-height: calc(100vh - 104px); overflow-y: auto;',
        '  display: flex; flex-direction: column; gap: 8px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 18px; color: #111827; }',
        '.pano *, .pano *::before { box-sizing: border-box; }',
        'svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }',
        'button { font-family: inherit; cursor: pointer; }',
        'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }',
        '.kart { position: relative; padding: 14px 14px 12px; border-radius: 16px; background: #fff; overflow: hidden;',
        '  box-shadow: 0 20px 50px rgba(16,24,40,.18), 0 0 0 1px rgba(16,24,40,.06); animation: gir 220ms cubic-bezier(.22,1,.36,1) both; }',
        '.kart::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--vurgu); }',
        '.kart--eksik { --vurgu: #d92d20; --zemin: #fef3f2; --yazi: #b42318; }',
        '.kart--mola { --vurgu: #d97706; --zemin: #fff6e8; --yazi: #b45309; }',
        /* Adım renkleri (css/siparisler.css token'ları): meşgul kırmızı, geri dönüyor
           turuncu, adreste mavi, toplamada mor, yolda yeşil, siparişte lacivert */
        '.kart--mesgul { --vurgu: #d92d20; --zemin: #fdecec; --yazi: #b42318; }',
        '.kart--donen { --vurgu: #d97706; --zemin: #fff6e8; --yazi: #b45309; }',
        '.kart--adreste { --vurgu: #2563eb; --zemin: #eff6ff; --yazi: #1d4ed8; }',
        '.kart--toplama { --vurgu: #7c3aed; --zemin: #f3edff; --yazi: #6d28d9; }',
        '.kart--yolda { --vurgu: #0e9f6e; --zemin: #eafaf4; --yazi: #047857; }',
        '.kart--sipariste { --vurgu: #344054; --zemin: #f2f4f7; --yazi: #111827; }',
        '@keyframes gir { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }',
        '.ust { display: flex; align-items: center; gap: 12px; }',
        '.ikon { flex: none; width: 40px; height: 40px; border-radius: 12px; background: var(--zemin); color: var(--yazi); display: grid; place-items: center; position: relative; }',
        '.ikon svg { width: 22px; height: 22px; }',
        '.kart--eksik .ikon::after { content: ""; position: absolute; inset: -3px; border-radius: 14px; border: 2px solid var(--vurgu); opacity: 0; animation: halka 1.8s ease-out infinite; }',
        '@keyframes halka { 0% { opacity: .7; transform: scale(.9); } 80%, 100% { opacity: 0; transform: scale(1.25); } }',
        '.metin { flex: 1; min-width: 0; }',
        '.baslik { margin: 0; font-size: 15px; line-height: 20px; font-weight: 800; color: #111827; }',
        '.alt { margin: 2px 0 0; font-size: 12px; line-height: 16px; color: #667085; }',
        '.sim { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 6px; background: #eef2ff; color: #4338ca; font-size: 10px; font-weight: 800; vertical-align: 2px; }',
        '.kapat { flex: none; align-self: flex-start; width: 32px; height: 32px; margin: -6px -6px 0 0; border: 0; border-radius: 999px; background: transparent; color: #98a2b3; display: grid; place-items: center; }',
        '.kapat:hover { background: #f2f4f7; color: #344054; }',
        '.kapat svg { width: 16px; height: 16px; }',
        '.sayi { display: flex; align-items: baseline; gap: 6px; margin: 2px 0 0; }',
        '.sayi b { font-size: 26px; line-height: 30px; font-weight: 800; color: var(--yazi); font-variant-numeric: tabular-nums; }',
        '.sayi span { font-size: 13px; font-weight: 700; color: var(--yazi); }',
        '.mesgul { list-style: none; margin: 10px 0 0; padding: 0; display: grid; grid-template-columns: 24px minmax(0, 1fr) auto auto; column-gap: 8px; row-gap: 6px; align-items: center; font-size: 12px; line-height: 16px; }',
        '.mesgul li { display: contents; }',
        '.mini { flex: none; width: 24px; height: 24px; border-radius: 999px; object-fit: cover; background: var(--zemin); color: var(--yazi); display: grid; place-items: center; font-size: 10px; font-weight: 800; }',
        '.mesgul__ad { flex: 1; min-width: 0; font-weight: 700; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
        '.mesgul__neden { font-weight: 700; color: var(--yazi); white-space: nowrap; }',
        '.mesgul__sure { color: #475467; font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }',
        '.mesgul__daha { grid-column: 2 / -1; color: #667085; font-weight: 600; }',
        '.neden { display: block; margin-top: 2px; font-size: 12px; line-height: 16px; font-weight: 600; color: #475467; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
        '.tablo { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }',
        '.hucre { padding: 6px 4px; border-radius: 9px; background: #f8fafc; text-align: center; min-width: 0; }',
        '.hucre small { display: block; font-size: 10px; line-height: 14px; font-weight: 700; letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; color: #667085; }',
        '.hucre b { font-size: 16px; line-height: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }',
        '.hucre--vurgu { background: var(--zemin); }',
        '.hucre--vurgu b { color: var(--yazi); }',
        '.kisi { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; }',
        '.kart--mola { padding: 12px 14px 10px; }',
        '.kart--mola .baslik { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
        '.kart--mola .ertele { margin-top: 10px; padding-top: 8px; }',
        '.foto { flex: none; width: 44px; height: 44px; border-radius: 999px; object-fit: cover; background: var(--zemin); color: var(--yazi); display: grid; place-items: center; font-size: 15px; font-weight: 800;',
        '  box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--vurgu); }',
        '.sure { display: inline-flex; align-items: center; gap: 4px; margin-top: 2px; font-size: 12px; font-weight: 700; color: var(--yazi); font-variant-numeric: tabular-nums; }',
        '.sure svg { width: 14px; height: 14px; }',
        '.sure { white-space: nowrap; }',
        '.sim--alt { display: table; margin: 4px 0 0; }',
        '.ertele { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #f2f4f7; }',
        '.ertele span { flex: 1; font-size: 11px; font-weight: 700; color: #667085; }',
        '.ertele button { min-width: 44px; height: 30px; padding: 0 8px; border: 1px solid #e4e7ec; border-radius: 999px; background: #fff; font-size: 12px; font-weight: 700; color: #344054;',
        '  transition: border-color 120ms, background-color 120ms, transform 120ms; }',
        '.ertele button:hover { border-color: var(--vurgu); background: var(--zemin); color: var(--yazi); }',
        '.ertele button:active { transform: scale(.96); }',
        '@media (prefers-reduced-motion: reduce) { .kart, .kart--eksik .ikon::after { animation: none; } .ertele button { transition: none; } }'
    ].join('\n');

    function kacir(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function sureYaz(dk) {
        dk = Math.max(0, Number(dk) || 0);
        var s = Math.floor(dk / 60), d = dk % 60;
        return s ? s + ' sa ' + d + ' dk' : d + ' dk';
    }

    function bas(ad) {
        return String(ad || '?').trim().split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toLocaleUpperCase('tr');
    }

    function erteleHtml(tur, id) {
        return '<div class="ertele"><span>Ertele</span>' + ERTELE_DK.map(function (dk) {
            return '<button type="button" data-ertele="' + tur + '" data-id="' + kacir(id || '') + '" data-dk="' + dk + '">' + (dk === 60 ? '1 sa' : dk + ' dk') + '</button>';
        }).join('') + '</div>';
    }

    function fotoHtml(m, sinif) {
        return /^https:\/\//.test(m.foto || '')
            ? '<img class="' + sinif + '" src="' + kacir(m.foto) + '" alt="">'
            : '<span class="' + sinif + '">' + kacir(bas(m.ad)) + '</span>';
    }

    function eksikHtml(e, sim) {
        var s = e.sayi || {};
        var liste = Array.isArray(e.mesgul) ? e.mesgul : [];
        var gor = liste.slice(0, 4);
        var mesgulHtml = gor.length ? '<ul class="mesgul">' + gor.map(function (m) {
            return '<li>' + fotoHtml(m, 'mini') + '<span class="mesgul__ad">' + kacir(m.ad) + '</span>' +
                '<span class="mesgul__neden">' + kacir(m.neden || 'Meşgul') + '</span>' +
                '<span class="mesgul__sure">' + (m.dk != null ? sureYaz(m.dk) : '') + '</span></li>';
        }).join('') + (liste.length > gor.length ? '<li><span class="mesgul__daha">+' + (liste.length - gor.length) + ' kurye daha meşgul</span></li>' : '') + '</ul>' : '';
        return '<section class="kart kart--eksik" role="alert">' +
            '<div class="ust"><span class="ikon">' + IKON_KURYE + '</span>' +
            '<div class="metin"><p class="baslik">Kurye Eksiğiniz Var' + (sim ? '<span class="sim">SİMÜLASYON</span>' : '') + '</p>' +
            '<p class="sayi"><b>' + kacir(e.eksik) + '</b><span>Kurye Eksik</span></p></div>' +
            '<button type="button" class="kapat" data-kapat aria-label="Gizle">' + IKON_X + '</button></div>' +
            '<div class="tablo"><div class="hucre"><small>Planlanan</small><b>' + kacir(e.planlanan) + '</b></div>' +
            '<div class="hucre"><small>Toplam</small><b>' + kacir(s.toplam || 0) + '</b></div>' +
            '<div class="hucre"><small>Aktif</small><b>' + kacir(e.aktif) + '</b></div>' +
            '<div class="hucre hucre--vurgu"><small>Meşgul</small><b>' + kacir(s.mesgul || 0) + '</b></div></div>' +
            mesgulHtml + erteleHtml('eksik') + '</section>';
    }

    function molaHtml(m, sim) {
        var adim = /^(mesgul|donen|adreste|toplama|yolda|sipariste)$/.test(m.adim || '') ? m.adim : 'mesgul';
        return '<section class="kart kart--mola kart--' + adim + '">' +
            '<div class="ust"><div class="kisi">' + fotoHtml(m, 'foto') +
            '<div class="metin"><p class="baslik">' + kacir(m.ad) + '</p>' +
            '<span class="sure">' + IKON_SAAT + sureYaz(m.dk) + "'dır " + kacir(m.fiil || 'meşgulde') + '</span>' +
            (m.neden ? '<span class="neden">' + kacir(m.neden) + '</span>' : '') +
            (sim ? '<span class="sim sim--alt">SİMÜLASYON</span>' : '') + '</div></div>' +
            '<button type="button" class="kapat" data-kapat aria-label="Gizle">' + IKON_X + '</button></div>' +
            erteleHtml('mola', m.id) + '</section>';
    }

    function imza(m) {
        if (!m) return '';
        return (m.eksik ? 'e' + m.eksik.eksik : '') + '|' + (m.mola || []).map(function (x) { return x.id; }).join(',');
    }

    function kaldir() {
        if (kap) kap.remove();
        kap = null;
        kok = null;
    }

    function ciz(m) {
        son = m;
        if (!etkin || !m || (!m.eksik && !(m.mola && m.mola.length))) { kaldir(); return; }
        if (!m.sim && gizliImza && gizliImza === imza(m)) { kaldir(); return; }
        var html = (m.eksik ? eksikHtml(m.eksik, m.sim) : '') + (m.mola || []).slice(0, 4).map(function (x) { return molaHtml(x, m.sim && !m.eksik); }).join('');
        if (!kap) {
            kap = document.createElement('div');
            kap.setAttribute('data-jba', 'kurye-uyari');
            kok = kap.attachShadow({ mode: 'closed' });
            document.documentElement.appendChild(kap);
            kok.addEventListener('click', tikla);
        }
        kok.innerHTML = '<style>' + STIL + '</style><div class="pano">' + html + '</div>';
    }

    function tikla(e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-kapat')) {
            if (son && son.sim) { simBitir(); return; }
            gizliImza = imza(son);
            kaldir();
            return;
        }
        var tur = b.getAttribute('data-ertele');
        if (!tur) return;
        var kart = b.closest('.kart');
        if (kart) kart.style.opacity = '0.4';
        if (son && son.sim) {
            if (kart) kart.remove();
            if (kok && !kok.querySelector('.kart')) simBitir();
            return;
        }
        try {
            chrome.runtime.sendMessage({ type: 'JBA_KURYE_ERTELE', tur: tur, id: b.getAttribute('data-id') || '', dk: Number(b.getAttribute('data-dk')) || 15 },
                function () { void chrome.runtime.lastError; });
        } catch (x) { /* yetim bağlam */ }
    }

    /* Simülasyon çarpıyla (ya da 10 dk sonra) biter, varsa gerçek uyarı geri gelir */
    function simBitir() {
        clearTimeout(simZaman);
        son = null;
        kaldir();
        if (gercek) ciz(gercek);
    }

    try {
        chrome.runtime.onMessage.addListener(function (m) {
            if (!m || m.type !== 'JBA_KURYE_UYARI') return false;
            var veri = { eksik: m.eksik || null, mola: Array.isArray(m.mola) ? m.mola : [], sim: !!m.sim };
            if (veri.sim) {
                if (son && !son.sim) gercek = son;
                ciz(veri);
                clearTimeout(simZaman);
                simZaman = setTimeout(simBitir, Number(m.sure) || 600000);
                return false;
            }
            gercek = veri;
            if (son && son.sim && kap) return false; // simülasyon ekrandayken bölünmesin
            if (imza(veri) !== gizliImza) gizliImza = '';
            ciz(veri);
            return false;
        });
    } catch (e) { /* yetim bağlam */ }

    JBA.kayit({
        kimlik: 'kuryeUyari',
        ad: 'Kurye Uyarısı',
        ozet: 'Kurye eksiği ve bir adımda uzun kalan kurye olunca sol üstte haber verir.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return PANO_YOLU.test(yol); },
        baslat: function () {
            etkin = true;
            try { chrome.runtime.sendMessage({ type: 'JBA_KURYE_PANO_HAZIR' }, function () { void chrome.runtime.lastError; }); }
            catch (e) { /* yetim bağlam */ }
            if (son) ciz(son);
        },
        durdur: function () {
            etkin = false;
            kaldir();
        }
    });
})(window);
