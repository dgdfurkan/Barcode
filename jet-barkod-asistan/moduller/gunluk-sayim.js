/**
 * Modül: Günlük Sayım kartları (depo paneli, kontrol paneli)
 * ============================================================================
 *
 * Sağ üstte, fırın kartının altında küçük ve sakin bir kart:
 *   SABAH 08:00-08:09  "Günlük sayım hazır · 50 ürün": Sayıma Başla Jet
 *                      Barkod sayım sayfasını o günün tablosuyla açar. Günde
 *                      bir kez; basılınca ya da çarpıyla bir daha gelmez,
 *                      basılmazsa 08:10'da kaybolur.
 *   GECE 00:00-00:59   Dünkü günlük sayımda sayılmamış ürün varsa uyarı.
 *                      Çarpı 10 dakika gizler. Sayım bitince ya da 01:00'de
 *                      kaybolur.
 * Simülasyon (Asistan penceresi): gerçeğin aynısı, 20 sn, çarpı kapatır.
 *
 * Veri arka plandan (arka-plan/gunluk-sayim.js); burası Getir'e istek atmaz.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var PANO_YOLU = /^\/r\/[a-f0-9]{24}\/dashboard\/orders\/?$/;
    var SITE = 'https://jetbarkod.com.tr/sayim/?gunluk=';
    var KART_ANAHTAR = 'jbaGunlukKart';   // { sabah: 'YYYY-MM-DD' } gösterildi
    var SIM_MS = 20000;
    var GECE_GIZLE_MS = 10 * 60 * 1000;

    var etkin = false;
    var kap = null;
    var kok = null;
    var cizili = null;          // 'sabah' | 'gece' | null
    var zamanlayici = null;
    var simBitis = 0;
    var simZaman = null;
    var geceGizliBitis = 0;
    var konumGozcu = null;

    var STIL = [
        ':host { all: initial; }',
        '.kart { position: fixed; right: 24px; z-index: 2147482990; width: 320px; max-width: calc(100vw - 32px);',
        '  box-sizing: border-box; padding: 16px; border-radius: 16px; background: #fff; color: #111827; overflow: hidden;',
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 18px;',
        '  box-shadow: 0 16px 40px rgba(16,24,40,.14), 0 0 0 1px rgba(17,24,39,.06);',
        '  display: flex; flex-direction: column; gap: 12px; animation: gir 220ms cubic-bezier(.22,1,.36,1); }',
        '.kart *, .kart *::before { box-sizing: border-box; }',
        '@keyframes gir { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }',
        'button { font-family: inherit; cursor: pointer; }',
        'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }',
        '.ust { display: flex; align-items: flex-start; gap: 12px; }',
        '.ikon { flex: none; width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; background: #eef4ff; color: #2563eb; }',
        '.kart.gece .ikon { background: #fff6e8; color: #d97706; }',
        'svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }',
        '.metin { flex: 1; min-width: 0; }',
        '.baslik { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; line-height: 20px; }',
        '.alt { margin: 2px 0 0; font-size: 12px; color: #667085; }',
        '.alt b { color: #111827; font-weight: 700; font-variant-numeric: tabular-nums; }',
        '.kart.gece .alt b { color: #b45309; }',
        '.sim { padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; line-height: 14px; }',
        '.kapat { flex: none; width: 32px; height: 32px; margin: -6px -6px 0 0; border: 0; border-radius: 999px; background: transparent; color: #98a2b3; display: grid; place-items: center; transition: background 160ms, color 160ms; }',
        '.kapat:hover { background: rgba(17,24,39,.06); color: #111827; }',
        '.kapat svg { width: 16px; height: 16px; stroke-width: 2; }',
        '.git { height: 40px; border: 0; border-radius: 9px; background: #2563eb; color: #fff; font-size: 13px; font-weight: 600;',
        '  display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: background 160ms; }',
        '.git:hover { background: #1d4ed8; }',
        '.kart.gece .git { background: #d97706; }',
        '.kart.gece .git:hover { background: #b45309; }',
        '.git svg { width: 16px; height: 16px; }',
        '.sure { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: #2563eb; opacity: .35; transform-origin: 0 50%; animation: azal linear forwards; }',
        '@keyframes azal { from { transform: scaleX(1); } to { transform: scaleX(0); } }',
        '@media (prefers-reduced-motion: reduce) { .kart, .sure { animation: none; } }'
    ].join('\n');

    var IKON_SAYIM = '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="m9 13 2 2 4-4"/></svg>';
    var IKON_SAAT = '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M5 4 3 6M19 4l2 2"/></svg>';
    var IKON_X = '<svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg>';
    var IKON_OK = '<svg viewBox="0 0 20 20"><path d="M8 5h7v7M15 5l-9 9"/></svg>';

    function kacir(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function saat() {
        var p = {};
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
        return { gun: p.year + '-' + p.month + '-' + p.day, saat: Number(p.hour), dakika: Number(p.minute) };
    }

    function gunYazi(gun) {
        var t = Date.parse(gun + 'T12:00:00Z');
        return Number.isFinite(t) ? new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : gun;
    }

    function depolama(anahtarlar) {
        return new Promise(function (coz) {
            try { chrome.storage.local.get(anahtarlar, function (r) { coz(r || {}); }); }
            catch (e) { coz({}); }
        });
    }

    function arkaPlana(m) {
        return new Promise(function (coz) {
            try { chrome.runtime.sendMessage(m, function (c) { void chrome.runtime.lastError; coz(c || null); }); }
            catch (e) { coz(null); }
        });
    }

    // ------------------------------------------------------------------
    // Konum: fırın kartı varsa onun altına
    // ------------------------------------------------------------------

    function konumla() {
        var k = kok && kok.querySelector('.kart');
        if (!k) return;
        var firin = Number(document.documentElement.getAttribute('data-jba-firin-alt')) || 0;
        k.style.top = Math.max(80, firin ? firin + 12 : 80) + 'px';
    }

    // ------------------------------------------------------------------
    // Çizim
    // ------------------------------------------------------------------

    function kaldir() {
        clearTimeout(simZaman);
        simZaman = null;
        simBitis = 0;
        if (konumGozcu) { konumGozcu.disconnect(); konumGozcu = null; }
        if (kap) kap.remove();
        kap = null;
        kok = null;
        cizili = null;
    }

    /** v: { tur: 'sabah'|'gece', gun, adet|kalan, sim } */
    function ciz(v) {
        kaldir();
        if (!etkin || !PANO_YOLU.test(location.pathname)) return;
        kap = document.createElement('div');
        kap.id = 'jba-gunluk-sayim';
        kok = kap.attachShadow({ mode: 'closed' });
        document.documentElement.appendChild(kap);
        var gece = v.tur === 'gece';
        var baslik = gece ? 'Günlük sayım bitmedi' : 'Günlük sayım hazır';
        var alt = gece
            ? kacir(gunYazi(v.gun)) + ' sayımında <b>' + v.kalan + ' ürün</b> sayılmadı'
            : kacir(gunYazi(v.gun)) + ' · <b>' + v.adet + ' ürün</b> Jet Barkod\'a eklendi';
        kok.innerHTML = '<style>' + STIL + '</style>' +
            '<div class="kart' + (gece ? ' gece' : '') + '" role="' + (gece ? 'alert' : 'status') + '" aria-live="polite">' +
                '<div class="ust">' +
                    '<span class="ikon">' + (gece ? IKON_SAAT : IKON_SAYIM) + '</span>' +
                    '<div class="metin"><p class="baslik">' + baslik + (v.sim ? '<span class="sim">Simülasyon</span>' : '') + '</p>' +
                    '<p class="alt">' + alt + '</p></div>' +
                    '<button type="button" class="kapat" data-is="kapat" aria-label="' + (gece ? '10 dakika gizle' : 'Kapat') + '">' + IKON_X + '</button>' +
                '</div>' +
                '<button type="button" class="git" data-is="git">' + (gece ? 'Sayıma Git' : 'Sayıma Başla') + IKON_OK + '</button>' +
                (v.sim ? '<span class="sure" style="animation-duration:' + SIM_MS + 'ms"></span>' : '') +
            '</div>';
        cizili = v.tur;
        konumla();
        konumGozcu = new MutationObserver(konumla);
        konumGozcu.observe(document.documentElement, { attributes: true, attributeFilter: ['data-jba-firin-alt'] });

        kok.querySelector('.kart').addEventListener('click', function (e) {
            var b = e.target.closest('[data-is]');
            if (!b) return;
            var is = b.getAttribute('data-is');
            if (is === 'git') {
                try { window.open(SITE + encodeURIComponent(v.gun), '_blank', 'noopener'); } catch (x) { /* engellendi */ }
                if (!v.sim && !gece) sabahGosterildi(v.gun);
                kaldir();
            } else if (is === 'kapat') {
                if (!v.sim) {
                    if (gece) geceGizliBitis = Date.now() + GECE_GIZLE_MS;
                    else sabahGosterildi(v.gun);
                }
                kaldir();
            }
        });
        if (v.sim) {
            simBitis = Date.now() + SIM_MS;
            simZaman = setTimeout(function () { kaldir(); tur(); }, SIM_MS);
        }
    }

    function sabahGosterildi(gun) {
        try { chrome.storage.local.set({ [KART_ANAHTAR]: { sabah: gun } }); } catch (e) { /* yetim bağlam */ }
    }

    // ------------------------------------------------------------------
    // Gerçek akış: 20 saniyede bir yalnız yerel saat ve depolama okunur
    // ------------------------------------------------------------------

    async function tur() {
        if (!etkin || simBitis > Date.now()) return;
        var z = saat();
        var ayar = (await depolama(['jbaGunlukAyar'])).jbaGunlukAyar || {};
        if (z.saat === 8 && z.dakika < 10 && ayar.sabah !== false) {
            var r = await depolama(['jbaGunlukSayim', KART_ANAHTAR]);
            var d = r.jbaGunlukSayim;
            var gosterildi = r[KART_ANAHTAR] && r[KART_ANAHTAR].sabah === z.gun;
            if (d && d.gun === z.gun && d.durum === 'eklendi' && !gosterildi) {
                if (cizili !== 'sabah') ciz({ tur: 'sabah', gun: z.gun, adet: d.adet || 0 });
                return;
            }
        } else if (z.saat === 0 && ayar.gece !== false && Date.now() >= geceGizliBitis) {
            var c = await arkaPlana({ type: 'JBA_GUNLUK_GECE' });
            var g = c && c.durum;
            if (g && g.var && g.kalan > 0) {
                if (cizili !== 'gece') ciz({ tur: 'gece', gun: g.gun, kalan: g.kalan });
                return;
            }
        }
        if (cizili) kaldir();
    }

    try {
        chrome.runtime.onMessage.addListener(function (m) {
            if (!m || m.type !== 'JBA_GUNLUK_KART' || !etkin) return false;
            ciz({ tur: m.tur === 'gece' ? 'gece' : 'sabah', gun: m.gun || saat().gun, adet: m.adet || 50, kalan: m.kalan || 3, sim: true });
            return false;
        });
    } catch (e) { /* yetim bağlam */ }

    JBA.kayit({
        kimlik: 'gunlukSayim',
        ad: 'Günlük Sayım',
        ozet: 'Her sabah günün 50\'lik sayımını Jet Barkod\'a ekler; 08:00\'de haber verir, gece unutulan ürün varsa uyarır.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return PANO_YOLU.test(yol); },
        baslat: function () {
            etkin = true;
            tur();
            clearInterval(zamanlayici);
            zamanlayici = setInterval(tur, 20000);
        },
        durdur: function () { etkin = false; clearInterval(zamanlayici); kaldir(); }
    });
})(window);
