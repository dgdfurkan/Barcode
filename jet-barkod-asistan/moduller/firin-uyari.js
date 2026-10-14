/**
 * Modül: Fırın Bildirimi (kontrol panelinde)
 * ============================================================================
 *
 * Arka plandaki fırın nöbetçisi (arka-plan/firin-nobet.js) belli aralıklarla
 * buraya `JBA_FIRIN_SOR` der; burası sayfa köprüsünden (sayfa-koprusu.js)
 * panelin fırın tahminini ister ve cevabı geri verir. Yeni sekme açılmaz.
 * Pişirilmesi gereken ürün varsa nöbetçi `JBA_FIRIN_UYARI` yollar. Siparişler ekranının
 * sağ üstünde küçük, hafifçe nabız atan bir kart çıkar: hangi ürün, rafta
 * kaç, donukta kaç, öneri kaç. Karta dokununca fırın sayfası yeni sekmede
 * açılır. Liste boş gelince (pişirme yapıldı) kart kendiliğinden kapanır.
 *
 * Kapatılan kart aynı liste için bir daha çıkmaz; listeye yeni ürün girerse
 * yeniden çıkar. Panelin stilleriyle karışmasın diye gölge DOM içinde.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var PANO_YOLU = /^\/r\/[a-f0-9]{24}\/dashboard\/orders\/?$/;
    var KAPATILAN = 'jba_firin_kapatilan';

    var etkin = false;
    var kap = null;
    var kok = null;
    var sonListe = [];

    var STIL = [
        ':host { all: initial; }',
        '.kart { position: fixed; top: 80px; right: 24px; z-index: 2147483000; width: 340px; max-width: calc(100vw - 32px);',
        '  box-sizing: border-box; padding: 16px; border-radius: 16px; background: #fff; color: #111827;',
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 18px;',
        '  box-shadow: 0 24px 60px rgba(16,24,40,.18), 0 0 0 1px rgba(217,119,6,.28); cursor: pointer;',
        '  animation: gir 220ms cubic-bezier(.22,1,.36,1); }',
        '.kart::before { content: ""; position: absolute; inset: -2px; border-radius: 18px; pointer-events: none;',
        '  box-shadow: 0 0 0 2px rgba(217,119,6,.55); animation: nabiz 1.8s ease-out infinite; }',
        '@keyframes gir { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }',
        '@keyframes nabiz { 0% { opacity: .9; transform: scale(1); } 70% { opacity: 0; transform: scale(1.035); } 100% { opacity: 0; transform: scale(1.035); } }',
        '.ust { display: flex; align-items: center; gap: 12px; }',
        '.ikon { position: relative; flex: none; width: 36px; height: 36px; border-radius: 12px; background: #fff6e8; color: #d97706; display: grid; place-items: center; }',
        '.ikon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }',
        '.ikon i { position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: 999px; background: #d92d20; box-shadow: 0 0 0 2px #fff; animation: nokta 1.2s ease-in-out infinite; }',
        '@keyframes nokta { 50% { transform: scale(.7); opacity: .6; } }',
        '.metin { flex: 1; min-width: 0; }',
        '.baslik { margin: 0; font-size: 15px; font-weight: 700; line-height: 20px; }',
        '.alt { margin: 2px 0 0; font-size: 12px; color: #667085; }',
        '.kapat { flex: none; width: 32px; height: 32px; margin: -6px -6px 0 0; border: 0; border-radius: 999px; background: transparent; color: #667085; cursor: pointer; display: grid; place-items: center; }',
        '.kapat:hover { background: #f4f6f9; color: #111827; }',
        '.kapat svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }',
        '.liste { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }',
        '.satir { display: flex; align-items: center; gap: 12px; }',
        '.satir img, .satir .bos { flex: none; width: 40px; height: 40px; border-radius: 9px; background: #f4f6f9; object-fit: contain; }',
        '.satir .ad { flex: 1; min-width: 0; }',
        '.satir .ad b { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
        '.satir .ad span { font-size: 12px; color: #667085; font-variant-numeric: tabular-nums; }',
        '.satir .ad span em { font-style: normal; font-weight: 700; color: #b42318; }',
        '.oneri { flex: none; min-width: 44px; padding: 4px 8px; border-radius: 999px; background: #111827; color: #fff; text-align: center; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }',
        '.oneri small { display: block; font-size: 10px; font-weight: 600; opacity: .7; line-height: 12px; }',
        '.daha { margin: 8px 0 0; font-size: 12px; color: #667085; }',
        '.git { width: 100%; height: 44px; margin-top: 12px; border: 0; border-radius: 9px; background: #d97706; color: #fff; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }',
        '.git:hover { background: #b45309; }',
        '.git svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }',
        '@media (prefers-reduced-motion: reduce) { .kart, .kart::before, .ikon i { animation: none; } .kart::before { opacity: .6; } }'
    ].join('\n');

    function kacir(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function imza(liste) {
        return liste.map(function (u) { return u.ad + ':' + u.raf; }).sort().join('|');
    }

    function kapatildiMi(liste) {
        try {
            var k = sessionStorage.getItem(KAPATILAN);
            if (!k) return false;
            // Kapatılan listede olmayan yeni bir ürün geldiyse yine göster
            var eski = k.split('|');
            return liste.every(function (u) { return eski.indexOf(u.ad + ':' + u.raf) > -1; });
        } catch (e) { return false; }
    }

    function kaldir() {
        if (kap) kap.remove();
        kap = null;
        kok = null;
    }

    function ciz(liste) {
        sonListe = liste || [];
        if (!etkin || !PANO_YOLU.test(location.pathname) || !sonListe.length || kapatildiMi(sonListe)) { kaldir(); return; }
        if (!kap) {
            kap = document.createElement('div');
            kap.id = 'jba-firin-uyari';
            kok = kap.attachShadow({ mode: 'closed' });
            document.documentElement.appendChild(kap);
        }
        var goster = sonListe.slice(0, 4);
        var bitti = sonListe.filter(function (u) { return u.raf <= 0; }).length;
        var alt = bitti
            ? bitti + ' ürün rafta bitti' + (sonListe.length > bitti ? ', ' + (sonListe.length - bitti) + ' ürün azaldı' : '') + ' · donukta var'
            : sonListe.length + ' ürün rafta azaldı · donukta var';
        kok.innerHTML = '<style>' + STIL + '</style>' +
            '<div class="kart" role="alert" aria-live="polite" title="Fırın sayfasını aç">' +
                '<div class="ust">' +
                    '<span class="ikon"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0v6H4z"/><path d="M8 18v-3M12 18v-4M16 18v-3"/></svg><i></i></span>' +
                    '<div class="metin"><p class="baslik">Pişirme Zamanı</p><p class="alt">' + kacir(alt) + '</p></div>' +
                    '<button type="button" class="kapat" aria-label="Kapat"><svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg></button>' +
                '</div>' +
                '<ul class="liste">' + goster.map(function (u) {
                    var gorsel = /^https:\/\//.test(u.gorsel || '') ? '<img src="' + kacir(u.gorsel) + '" alt="">' : '<span class="bos"></span>';
                    return '<li class="satir">' + gorsel +
                        '<div class="ad"><b>' + kacir(u.ad) + '</b><span>Raf <em>' + kacir(u.raf) + '</em> · Donuk ' + kacir(u.donuk) + '</span></div>' +
                        '<span class="oneri"><small>Öneri</small>' + kacir(u.oneri) + '</span></li>';
                }).join('') + '</ul>' +
                (sonListe.length > goster.length ? '<p class="daha">+' + (sonListe.length - goster.length) + ' ürün daha</p>' : '') +
                '<button type="button" class="git"><span>Fırın Sayfasını Aç</span><svg viewBox="0 0 20 20"><path d="M8 5h7v7M15 5l-9 9"/></svg></button>' +
            '</div>';
        var kart = kok.querySelector('.kart');
        kok.querySelector('.kapat').addEventListener('click', function (e) {
            e.stopPropagation();
            try { sessionStorage.setItem(KAPATILAN, imza(sonListe)); } catch (x) { /* sessiz */ }
            kaldir();
        });
        kart.addEventListener('click', function () {
            try { chrome.runtime.sendMessage({ type: 'JBA_FIRIN_AC' }, function () { void chrome.runtime.lastError; }); }
            catch (e) { /* yetim bağlam */ }
        });
    }

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
                son(d.sonuc || { ok: false });
            }
            function son(v) {
                if (bitti) return;
                bitti = true;
                window.removeEventListener('message', dinle);
                coz(v);
            }
            window.addEventListener('message', dinle);
            setTimeout(function () { son({ ok: false, sebep: 'zaman aşımı' }); }, 20000);
            window.postMessage({ type: 'JB_FIRIN_TAHMIN_SOR', no: no }, location.origin);
        });
    }

    try {
        chrome.runtime.onMessage.addListener(function (m, gonderen, cevapla) {
            if (m && m.type === 'JBA_FIRIN_SOR') {
                if (!etkin) { cevapla({ ok: false, sebep: 'kapalı' }); return false; }
                tahminSor().then(cevapla);
                return true;
            }
            if (!m || m.type !== 'JBA_FIRIN_UYARI') return false;
            var liste = Array.isArray(m.liste) ? m.liste.filter(function (u) { return u && typeof u.ad === 'string'; }) : [];
            // Liste boşaldıysa (pişirme yapıldı) kapatma kaydı da sıfırlansın
            if (!liste.length) { try { sessionStorage.removeItem(KAPATILAN); } catch (e) { /* sessiz */ } }
            ciz(liste);
            return false;
        });
    } catch (e) { /* yetim bağlam */ }

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
            ciz(sonListe);
        },

        durdur: function () {
            etkin = false;
            kaldir();
        }
    });
})(window);
