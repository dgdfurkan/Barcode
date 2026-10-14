/**
 * Modül: Fırın Bildirimi (kontrol panelinde)
 * ============================================================================
 *
 * Arka plandaki fırın nöbetçisi (arka-plan/firin-nobet.js) belli aralıklarla
 * buraya `JBA_FIRIN_SOR` der; burası sayfa köprüsünden (sayfa-koprusu.js)
 * panelin fırın tahminini ister ve cevabı geri verir. Yeni sekme açılmaz.
 *
 * Pişirilmesi gereken ürün varsa nöbetçi `JBA_FIRIN_UYARI` yollar.
 * Siparişler ekranının sağ üstünde hafifçe nabız atan bir panel çıkar.
 * İçindeki kartlar pişirme panelindeki kartların küçüğü: görsel, ad, durum
 * etiketi, kaç adet pişirileceği, dört dilimin önerisi, mevcut ve donuk.
 * Yalnız pişirilecek ürünler gelir. Panele dokununca fırın sayfası yeni
 * sekmede açılır. Liste boş gelince (pişirme yapıldı) panel kapanır.
 *
 * Kapatılan panel aynı liste için bir daha çıkmaz; listeye yeni ürün girerse
 * yeniden çıkar. Simülasyonda üstte "Simülasyon" yazar, 10 sn sonra kapanır.
 * Panelin stilleriyle karışmasın diye gölge DOM içinde.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var PANO_YOLU = /^\/r\/[a-f0-9]{24}\/dashboard\/orders\/?$/;
    var KAPATILAN = 'jba_firin_kapatilan';
    var EN_COK_KART = 3;

    var etkin = false;
    var kap = null;
    var kok = null;
    var son = { liste: [] };
    var simZamanlayici = null;

    var STIL = [
        ':host { all: initial; }',
        '.pano { position: fixed; top: 80px; right: 24px; z-index: 2147483000; width: 400px; max-width: calc(100vw - 32px);',
        '  box-sizing: border-box; padding: 16px; border-radius: 16px; background: #fff; color: #111827; overflow: hidden;',
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 18px;',
        '  box-shadow: 0 24px 60px rgba(16,24,40,.18), 0 0 0 1px rgba(217,119,6,.28); cursor: pointer;',
        '  animation: gir 220ms cubic-bezier(.22,1,.36,1); display: flex; flex-direction: column; max-height: calc(100vh - 104px); }',
        '.pano *, .pano *::before { box-sizing: border-box; }',
        '.pano::before { content: ""; position: absolute; inset: 0; border-radius: 16px; pointer-events: none;',
        '  box-shadow: inset 0 0 0 2px rgba(217,119,6,.55); animation: nabiz 1.8s ease-out infinite; }',
        '@keyframes gir { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }',
        '@keyframes nabiz { 0% { opacity: 1; } 70% { opacity: 0; } 100% { opacity: 0; } }',

        '.ust { display: flex; align-items: center; gap: 12px; }',
        '.ikon { position: relative; flex: none; width: 36px; height: 36px; border-radius: 12px; background: #fff6e8; color: #d97706; display: grid; place-items: center; }',
        '.ikon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }',
        '.ikon i { position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; border-radius: 999px; background: #d92d20; box-shadow: 0 0 0 2px #fff; animation: nokta 1.2s ease-in-out infinite; }',
        '@keyframes nokta { 50% { transform: scale(.7); opacity: .6; } }',
        '.metin { flex: 1; min-width: 0; }',
        '.baslik { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; line-height: 20px; }',
        '.sim { padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; line-height: 14px; }',
        '.alt { margin: 2px 0 0; font-size: 12px; color: #667085; }',
        '.kapat { flex: none; width: 32px; height: 32px; margin: -4px -4px 0 0; border: 0; border-radius: 999px; background: transparent; color: #667085; cursor: pointer; display: grid; place-items: center; }',
        '.kapat:hover { background: #f4f6f9; color: #111827; }',
        '.kapat svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }',

        '.liste { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }',
        '.ust, .daha, .git, .kart { flex: none; }',
        '.kart { display: flex; align-items: stretch; gap: 12px; padding: 12px; border-radius: 12px; border-left: 6px solid var(--kenar); background: var(--zemin); }',
        '.kart.acil { --kenar: #ef4444; --zemin: #fef2f2; --hap: #fee2e2; --hap-yazi: #b42318; }',
        '.kart.kritik { --kenar: #f59e0b; --zemin: #fffbeb; --hap: #fef3c7; --hap-yazi: #b45309; }',
        '.gorsel { flex: none; width: 56px; height: 56px; border-radius: 9px; background: #fff; object-fit: cover; }',
        '.orta { flex: 1; min-width: 0; }',
        '.ad { margin: 0; font-size: 13px; font-weight: 600; line-height: 18px; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }',
        '.miktar { margin: 4px 0 0; font-size: 18px; font-weight: 700; line-height: 24px; color: #111827; font-variant-numeric: tabular-nums; }',
        '.sebep { margin: 4px 0 0; display: flex; align-items: center; gap: 8px; font-size: 11px; color: #4b5563; }',
        '.hap { flex: none; padding: 2px 8px; border-radius: 999px; background: var(--hap); color: var(--hap-yazi); font-size: 10px; font-weight: 700; line-height: 14px; }',
        '.dilimler { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(17,24,39,.08); display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; text-align: center; color: #6b7280; }',
        '.dilimler b { display: block; font-size: 12px; font-weight: 600; color: #374151; font-variant-numeric: tabular-nums; }',
        '.dilimler span { font-size: 10px; }',
        '.dilimler .su b, .dilimler .su span { color: #16a34a; font-weight: 700; }',
        '.sag { flex: none; width: 56px; padding-left: 12px; border-left: 1px solid rgba(17,24,39,.08); display: flex; flex-direction: column; justify-content: center; text-align: center; gap: 8px; }',
        '.sag span { display: block; font-size: 10px; font-weight: 600; color: #4b5563; letter-spacing: .02em; }',
        '.sag b { display: block; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }',
        '.daha { margin: 8px 0 0; font-size: 12px; color: #667085; }',

        '.git { width: 100%; height: 44px; margin-top: 12px; border: 0; border-radius: 9px; background: #d97706; color: #fff; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }',
        '.git:hover { background: #b45309; }',
        '.git svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }',
        '.sure { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #6366f1; transform-origin: left; animation: sure linear forwards; }',
        '@keyframes sure { from { transform: scaleX(1); } to { transform: scaleX(0); } }',
        '@media (prefers-reduced-motion: reduce) { .pano, .pano::before, .ikon i { animation: none; } .pano::before { opacity: .6; } }'
    ].join('\n');

    function kacir(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function sayi(v) {
        var n = Number(v);
        return Number.isFinite(n) ? Math.round(n) : 0;
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
        clearTimeout(simZamanlayici);
        simZamanlayici = null;
        if (kap) kap.remove();
        kap = null;
        kok = null;
    }

    /** Pişirme panelindeki kartın küçüğü */
    function kartHtml(u, dilimler, simdiki) {
        var raf = sayi(u.raf);
        var oneri = sayi(u.oneri);
        var acil = raf <= 0;
        var gorsel = /^https:\/\//.test(u.gorsel || '')
            ? '<img class="gorsel" src="' + kacir(u.gorsel) + '" alt="">'
            : '<span class="gorsel"></span>';
        var oneriler = Array.isArray(u.oneriler) ? u.oneriler : [];
        var dilimHtml = (dilimler || []).slice(0, 4).map(function (et, i) {
            return '<div' + (i === simdiki ? ' class="su"' : '') + '><b>' + sayi(oneriler[i]) + '</b>' +
                '<span>' + kacir(String(et).replace(/:00/g, '')) + '</span></div>';
        }).join('');
        return '<li class="kart ' + (acil ? 'acil' : 'kritik') + '">' + gorsel +
            '<div class="orta">' +
                '<p class="ad" title="' + kacir(u.ad) + '">' + kacir(u.ad) + '</p>' +
                '<p class="miktar">' + sayi(u.pisir) + ' Adet Pişirilecek</p>' +
                '<p class="sebep"><span class="hap">' + (acil ? 'ACİL PİŞİR' : 'STOK KRİTİK') + '</span>' +
                '<span>' + (acil ? 'Rafta yok, hedef ' + oneri : 'Rafta ' + raf + ', hedef ' + oneri) + '</span></p>' +
                (dilimHtml ? '<div class="dilimler">' + dilimHtml + '</div>' : '') +
            '</div>' +
            '<div class="sag"><div><span>MEVCUT</span><b>' + raf + '</b></div><div><span>DONUK</span><b>' + sayi(u.donuk) + '</b></div></div>' +
        '</li>';
    }

    function ciz(m) {
        son = m || { liste: [] };
        var liste = son.liste || [];
        kaldir();
        if (!etkin || !PANO_YOLU.test(location.pathname) || !liste.length) return;
        if (!son.sim && kapatildiMi(liste)) return;

        kap = document.createElement('div');
        kap.id = 'jba-firin-uyari';
        kok = kap.attachShadow({ mode: 'closed' });
        document.documentElement.appendChild(kap);

        var dilimler = Array.isArray(son.dilimler) ? son.dilimler : [];
        var simdiki = typeof son.simdiki === 'number' ? son.simdiki : -1;
        var goster = liste.slice(0, EN_COK_KART);
        var alt = (simdiki > -1 && dilimler[simdiki] ? dilimler[simdiki] + ' dilimi · ' : '') +
            liste.length + ' ürün pişirilecek';
        var sure = son.sim ? Math.max(1000, Math.min(60000, sayi(son.sure) || 10000)) : 0;

        kok.innerHTML = '<style>' + STIL + '</style>' +
            '<div class="pano" role="alert" aria-live="polite" title="Fırın sayfasını aç">' +
                '<div class="ust">' +
                    '<span class="ikon"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0v6H4z"/><path d="M8 18v-3M12 18v-4M16 18v-3"/></svg><i></i></span>' +
                    '<div class="metin"><p class="baslik">Pişirme Zamanı' + (son.sim ? '<span class="sim">Simülasyon</span>' : '') + '</p>' +
                    '<p class="alt">' + kacir(alt) + '</p></div>' +
                    '<button type="button" class="kapat" aria-label="Kapat"><svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg></button>' +
                '</div>' +
                '<ul class="liste">' + goster.map(function (u) { return kartHtml(u, dilimler, simdiki); }).join('') + '</ul>' +
                (liste.length > goster.length ? '<p class="daha">+' + (liste.length - goster.length) + ' ürün daha</p>' : '') +
                '<button type="button" class="git"><span>Fırın Sayfasını Aç</span><svg viewBox="0 0 20 20"><path d="M8 5h7v7M15 5l-9 9"/></svg></button>' +
                (sure ? '<span class="sure" style="animation-duration:' + sure + 'ms"></span>' : '') +
            '</div>';

        kok.querySelector('.kapat').addEventListener('click', function (e) {
            e.stopPropagation();
            if (!son.sim) {
                try { sessionStorage.setItem(KAPATILAN, imza(liste)); } catch (x) { /* sessiz */ }
            }
            kaldir();
        });
        kok.querySelector('.pano').addEventListener('click', function () {
            try { chrome.runtime.sendMessage({ type: 'JBA_FIRIN_AC' }, function () { void chrome.runtime.lastError; }); }
            catch (e) { /* yetim bağlam */ }
        });
        if (sure) simZamanlayici = setTimeout(kaldir, sure);
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

    try {
        chrome.runtime.onMessage.addListener(function (m, gonderen, cevapla) {
            if (m && m.type === 'JBA_FIRIN_SOR') {
                if (!etkin) { cevapla({ ok: false, sebep: 'kapalı' }); return false; }
                tahminSor().then(cevapla);
                return true;
            }
            if (!m || m.type !== 'JBA_FIRIN_UYARI') return false;
            var liste = Array.isArray(m.liste) ? m.liste.filter(function (u) { return u && typeof u.ad === 'string'; }) : [];
            // Gerçek liste boşaldıysa (pişirme yapıldı) kapatma kaydı da sıfırlansın
            if (!liste.length && !m.sim) { try { sessionStorage.removeItem(KAPATILAN); } catch (e) { /* sessiz */ } }
            ciz({ liste: liste, dilimler: m.dilimler, simdiki: m.simdiki, sim: !!m.sim, sure: m.sure });
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
            // Simülasyon kartı geri dönüşte yeniden çıkmasın
            if (!son.sim) ciz(son);
        },

        durdur: function () {
            etkin = false;
            kaldir();
        }
    });
})(window);
