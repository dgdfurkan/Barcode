/**
 * Sayım v2 — yalnızca sunum katmanı davranışları.
 *
 * counting.js'e HİÇ dokunmaz; onun genel API'sini kullanır.
 * v1 sayfasında bu dosya yüklenmez, dolayısıyla v1 etkilenmez.
 */
(function () {
    'use strict';

    var TOKEN_ACIK_KEY = 'jb_v2_token_acik';

    function el(id) {
        return document.getElementById(id);
    }

    function sistem() {
        return window.countingSystem || null;
    }

    /* ---------------- Token paneli ---------------- */

    function tokenPaneliKur() {
        var panel = el('v2TokenPanel');
        var toggle = el('v2TokenToggle');
        var body = el('v2TokenBody');
        if (!panel || !toggle || !body) return;

        // Tercih hatırlanır; varsayılan KAPALI (yer kaplamasın)
        var acik = false;
        try { acik = localStorage.getItem(TOKEN_ACIK_KEY) === '1'; } catch (e) {}
        panel.classList.toggle('is-open', acik);
        toggle.setAttribute('aria-expanded', acik ? 'true' : 'false');

        toggle.addEventListener('click', function (e) {
            // Panodan-al butonu paneli açıp kapatmasın
            if (e.target.closest('#v2TokenPasteBtn')) return;
            var yeni = !panel.classList.contains('is-open');
            panel.classList.toggle('is-open', yeni);
            toggle.setAttribute('aria-expanded', yeni ? 'true' : 'false');
            try { localStorage.setItem(TOKEN_ACIK_KEY, yeni ? '1' : '0'); } catch (err) {}
        });

        var paste = el('v2TokenPasteBtn');
        if (paste) paste.addEventListener('click', panodanTokenAl);

        durumuTazele();
        setInterval(durumuTazele, 30000);
    }

    /** Metin içinden JWT'yi ayıklar (Bearer öneki, tırnak, boşluk toleranslı). */
    function tokenAyikla(metin) {
        if (!metin) return '';
        var temiz = String(metin).replace(/^\s*["']|["']\s*$/g, '').trim();
        var m = temiz.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/);
        return m ? m[0] : '';
    }

    async function panodanTokenAl() {
        var btn = el('v2TokenPasteBtn');
        var input = el('manualTokenInput');
        var cs = sistem();
        if (!input || !cs) return;

        var eskiHtml = btn ? btn.innerHTML : '';
        var yaz = function (t) { if (btn) btn.textContent = t; };

        try {
            var pano = await navigator.clipboard.readText();
            var token = tokenAyikla(pano);

            if (!token) {
                yaz('Token bulunamadı');
                cs.showToast?.(
                    'Panoda geçerli bir token yok. Franchise sayfasından token\'ı kopyalayıp tekrar deneyin.',
                    'warning',
                    4000
                );
                setTimeout(function () { if (btn) btn.innerHTML = eskiHtml; }, 2000);
                return;
            }

            input.value = token;
            cs.updateManualTokenPreview?.();
            await cs.applyManualTokenFromInput?.();

            yaz('✓ Kaydedildi');
            durumuTazele();
            setTimeout(function () { if (btn) btn.innerHTML = eskiHtml; }, 1800);
        } catch (e) {
            // Pano izni yoksa paneli açıp elle yapıştırmasını sağla
            var panel = el('v2TokenPanel');
            if (panel) panel.classList.add('is-open');
            input.focus();
            cs.showToast?.('Panoya erişilemedi. Token\'ı aşağıya yapıştırın.', 'warning', 4000);
            if (btn) btn.innerHTML = eskiHtml;
        }
    }

    /** Token durumunu noktaya ve ipucu metnine yansıtır. */
    function durumuTazele() {
        var dot = el('v2TokenDot');
        var hint = el('v2TokenHint');
        var cs = sistem();
        if (!dot || !hint) return;

        var info = cs && cs.cachedFullData && cs.cachedFullData._api_info;
        var sonMs = 0;
        try { sonMs = cs && cs.getEffectiveExpiryMs ? cs.getEffectiveExpiryMs(info || {}) : 0; } catch (e) {}

        dot.className = 'v2-token-dot';

        if (!info || !info.token) {
            dot.classList.add('v2-token-dot--bad');
            hint.textContent = '— tanımlı değil, stok çekilemez';
            return;
        }
        if (sonMs && sonMs < Date.now()) {
            dot.classList.add('v2-token-dot--bad');
            hint.textContent = '— süresi dolmuş, yenileyin';
            return;
        }
        if (sonMs) {
            var kalanDk = Math.round((sonMs - Date.now()) / 60000);
            if (kalanDk < 30) {
                dot.classList.add('v2-token-dot--warn');
                hint.textContent = '— ' + kalanDk + ' dk sonra doluyor';
                return;
            }
            dot.classList.add('v2-token-dot--ok');
            var saat = Math.round(kalanDk / 60);
            hint.textContent = '— geçerli, ' + (saat >= 1 ? saat + ' sa' : kalanDk + ' dk') + ' kaldı';
            return;
        }
        dot.classList.add('v2-token-dot--ok');
        hint.textContent = '— tanımlı';
    }

    /* ---------------- Başlat ---------------- */

    function baslat() {
        tokenPaneliKur();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', baslat);
    } else {
        baslat();
    }

    window.CountingV2 = { durumuTazele: durumuTazele, tokenAyikla: tokenAyikla };
})();
