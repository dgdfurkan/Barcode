/**
 * Sayım v2 — yeniden düzenlenmiş arayüz.
 *
 * counting.js'e HİÇ dokunmaz. Var olan DOM düğümlerini (ID'leriyle birlikte)
 * yeni bir kabuğa TAŞIR — kopyalamaz. Düğüm taşımak olay dinleyicilerini
 * bozmadığı için motorun tüm bağları çalışmaya devam eder.
 *
 * TASARIM KARARI — v1'in sorunu her şeyin aynı anda ekranda olmasıydı:
 * aktif tablo, alt sekmeler, 131 tablonun listesi, ürün ekleme, kamera,
 * token paneli, istatistikler ve ürün listesi alt alta. Göz nereye
 * bakacağını bilemiyordu.
 *
 * v2'de ekranda aynı anda TEK bir iş var:
 *   üst bar   → kimlik + aktif tablo + token durumu (hepsi tek satır)
 *   özet şerit → 4 metrik, tek satır
 *   eylem çubuğu → ürün ekleme yolları + arama + görünüm
 *   ana alan  → ürün listesi (ekranın çoğu)
 *   çekmece   → tablo yönetimi (sağdan açılır, işi bitince kapanır)
 *   popover   → token (üst bardaki noktadan)
 */
(function () {
    'use strict';

    var TOKEN_ACIK_KEY = 'jb_v2_token_acik';

    function el(id) { return document.getElementById(id); }
    function sistem() { return window.countingSystem || null; }

    function yap(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    /** Düğümü hedefe TAŞIR (dinleyiciler korunur). Yoksa sessizce geçer. */
    function tasi(id, hedef) {
        var n = el(id);
        if (n && hedef) hedef.appendChild(n);
        return n;
    }

    // ================================================================
    // 1) Kabuk: çekmece + popover + eylem çubuğu
    // ================================================================

    function kabukKur() {
        var main = document.querySelector('main');
        if (!main || el('v2Shell')) return null;

        var shell = yap('div', 'v2-shell');
        shell.id = 'v2Shell';

        // --- Özet şerit ---
        var ozet = yap('div', 'v2-summary');
        ozet.id = 'v2Summary';

        // --- Eylem çubuğu ---
        var eylem = yap('div', 'v2-actions');
        eylem.id = 'v2Actions';

        // --- Ana alan (ürün listesi buraya taşınır) ---
        var govde = yap('div', 'v2-body');
        govde.id = 'v2Body';

        shell.appendChild(ozet);
        shell.appendChild(eylem);
        shell.appendChild(govde);

        // Sekme şeridinden hemen sonra
        var sekmeSerit = main.firstElementChild;
        if (sekmeSerit && sekmeSerit.nextSibling) {
            main.insertBefore(shell, sekmeSerit.nextSibling);
        } else {
            main.appendChild(shell);
        }
        return shell;
    }

    function cekmeceKur() {
        if (el('v2Drawer')) return;

        var backdrop = yap('div', 'v2-drawer-backdrop');
        backdrop.id = 'v2DrawerBackdrop';

        var drawer = yap('aside', 'v2-drawer');
        drawer.id = 'v2Drawer';
        drawer.setAttribute('aria-hidden', 'true');
        drawer.innerHTML =
            '<div class="v2-drawer__head">' +
            '  <div>' +
            '    <p class="v2-drawer__eyebrow">Tablolar</p>' +
            '    <h2 class="v2-drawer__title">Sayım tablonu seç</h2>' +
            '  </div>' +
            '  <button type="button" class="v2-iconbtn" id="v2DrawerClose" aria-label="Kapat">' +
            '    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
            '      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
            '  </button>' +
            '</div>' +
            '<div class="v2-drawer__scope" id="v2DrawerScope"></div>' +
            '<div class="v2-drawer__body" id="v2DrawerBody"></div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);

        backdrop.addEventListener('click', cekmeceKapat);
        el('v2DrawerClose').addEventListener('click', cekmeceKapat);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && document.body.classList.contains('v2-drawer-open')) {
                e.stopPropagation();
                cekmeceKapat();
            }
        }, true);
    }

    function cekmeceAc() {
        document.body.classList.add('v2-drawer-open');
        el('v2Drawer')?.setAttribute('aria-hidden', 'false');
        // Odak aramaya gitsin — kullanıcı 131 tablo arasında yazarak bulsun
        setTimeout(function () {
            var q = document.querySelector('#v2DrawerBody input[type="text"], #v2DrawerBody input[type="search"]');
            if (q) q.focus();
        }, 220);
    }

    function cekmeceKapat() {
        document.body.classList.remove('v2-drawer-open');
        el('v2Drawer')?.setAttribute('aria-hidden', 'true');
    }

    // ================================================================
    // 2) Düğümleri yeni yerlerine taşı
    // ================================================================

    function yerlesimiKur() {
        var shell = kabukKur();
        if (!shell) return;
        cekmeceKur();

        var ozet = el('v2Summary');
        var eylem = el('v2Actions');
        var govde = el('v2Body');
        var drawerScope = el('v2DrawerScope');
        var drawerBody = el('v2DrawerBody');

        // --- Tablo yönetimi çekmeceye ---
        var genelBtn = el('sayimTabGeneralBtn');
        var gunlukBtn = el('sayimTabDailyBtn');
        if (genelBtn && gunlukBtn) {
            var scope = yap('div', 'v2-scope');
            scope.appendChild(genelBtn);
            scope.appendChild(gunlukBtn);
            drawerScope.appendChild(scope);
        }
        tasi('sayimPanelGeneral', drawerBody);
        tasi('sayimPanelDaily', drawerBody);
        // Aktif tablo kartının ayrıntıları da çekmecede dursun; üst bardaki
        // çip zaten özetini gösteriyor, sayfada iki kez yer kaplamasın.
        tasi('sayimActiveTableHost', drawerBody);

        // --- İstatistikler özet şeride ---
        tasi('countingStatsHost', ozet);

        // --- Ürün ekleme kontrolleri eylem çubuğuna ---
        var sol = yap('div', 'v2-actions__left');
        var sag = yap('div', 'v2-actions__right');
        var giris = el('manualProductInputWrapper');
        if (giris) sol.appendChild(giris);
        ['searchProductBtn', 'addProductBtn'].forEach(function (id) { tasi(id, sol); });
        ['cameraScanBtn', 'terminalScanBtn', 'getirCdnPasteBtn'].forEach(function (id) { tasi(id, sag); });
        eylem.appendChild(sol);
        eylem.appendChild(sag);
        // Arama sonuçları giriş kutusunun hemen altında kalmalı
        var sonuc = el('manualInputResults');
        if (sonuc && giris) giris.appendChild(sonuc);

        // --- Ürün listesi ana alana ---
        tasi('countingTableContainer', govde);

        // --- Aktif tablo: üst bara özet çip ---
        aktifTabloCipiKur();

        // --- Token: üst barda nokta + popover ---
        tokenPopoverKur();

        // --- Artık boşalan v1 kabuklarını gizle ---
        bosKabuklariGizle();
    }

    /** Üst barda aktif tabloyu gösteren ve çekmeceyi açan çip. */
    function aktifTabloCipiKur() {
        if (el('v2TableChip')) return;
        var header = document.querySelector('header .max-w-7xl > div, header > div > div');
        if (!header) return;

        var chip = yap('button', 'v2-table-chip');
        chip.id = 'v2TableChip';
        chip.type = 'button';
        chip.innerHTML =
            '<span class="v2-table-chip__eyebrow">Aktif tablo</span>' +
            '<span class="v2-table-chip__name" id="v2TableChipName">—</span>' +
            '<svg class="v2-table-chip__caret" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
            '  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';
        chip.addEventListener('click', cekmeceAc);

        var kullanici = header.querySelector('#countingHeaderUserHost');
        if (kullanici && kullanici.parentNode) kullanici.parentNode.insertBefore(chip, kullanici);
        else header.appendChild(chip);

        cipiTazele();
        setInterval(cipiTazele, 1200);
    }

    function cipiTazele() {
        var cs = sistem();
        var ad = el('v2TableChipName');
        if (!cs || !ad) return;
        var isim = cs.currentTableName || '—';
        var gosterim = cs.formatTableDisplayName ? cs.formatTableDisplayName(isim) : isim;
        if (ad.textContent !== gosterim) ad.textContent = gosterim;
        var chip = el('v2TableChip');
        if (chip) {
            var gunluk = cs.isDailyTableName && cs.isDailyTableName(isim);
            chip.classList.toggle('is-daily', !!gunluk);
        }
    }

    /** v1'in artık içi boşalmış dekoratif kutularını gizler. */
    function bosKabuklariGizle() {
        var main = document.querySelector('main');
        if (!main) return;
        Array.prototype.forEach.call(main.children, function (c) {
            if (c.id === 'v2Shell') return;
            if (c.classList.contains('tab-content')) return;
            if (c.id === 'sayimAuditLogOverlay') return;
            if (c === main.firstElementChild) return; // sekme şeridi
            // İçinde görünür içerik kalmadıysa gizle
            if (!c.querySelector('input, button, table, canvas, [id]')) {
                c.style.display = 'none';
            }
        });
        // Sayım sekmesi kabuğunun tüm içeriği çekmeceye/eylem çubuğuna taşındı.
        // İçinde artık yalnızca boş sarmalayıcılar kaldığı için gizliyoruz;
        // motor bu düğümlere ID ile eriştiğinden gizli olmaları sorun değil.
        var st = el('sayimTabContent');
        if (st) st.style.display = 'none';
    }

    // ================================================================
    // 3) Token popover
    // ================================================================

    function tokenPopoverKur() {
        if (el('v2TokenBtn')) return;
        var header = document.querySelector('header .max-w-7xl > div, header > div > div');
        if (!header) return;

        var wrap = yap('div', 'v2-token');
        wrap.id = 'v2Token';
        wrap.innerHTML =
            '<button type="button" class="v2-token-btn" id="v2TokenBtn" aria-expanded="false" title="Franchise token durumu">' +
            '  <span class="v2-token-dot" id="v2TokenDot"></span>' +
            '  <span class="v2-token-btn__label" id="v2TokenHint">Token</span>' +
            '</button>' +
            '<div class="v2-token-pop" id="v2TokenPop" hidden>' +
            '  <div class="v2-token-pop__head">' +
            '    <strong>Franchise token</strong>' +
            '    <button type="button" class="v2-token-paste" id="v2TokenPasteBtn">Panodan al</button>' +
            '  </div>' +
            '  <div class="v2-token-pop__body" id="v2TokenPopBody"></div>' +
            '</div>';

        var kullanici = header.querySelector('#countingHeaderUserHost') || header.lastElementChild;
        if (kullanici && kullanici.parentNode) kullanici.parentNode.insertBefore(wrap, kullanici);
        else header.appendChild(wrap);

        // Mevcut token kartını popover'a taşı (ID'ler korunur)
        tasi('apiStatusCard', el('v2TokenPopBody'));
        tasi('manualTokenPanel', el('v2TokenPopBody'));

        var btn = el('v2TokenBtn');
        var pop = el('v2TokenPop');
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var acik = pop.hasAttribute('hidden');
            pop.toggleAttribute('hidden', !acik);
            btn.setAttribute('aria-expanded', acik ? 'true' : 'false');
        });
        document.addEventListener('click', function (e) {
            if (!pop.hasAttribute('hidden') && !wrap.contains(e.target)) {
                pop.setAttribute('hidden', '');
                btn.setAttribute('aria-expanded', 'false');
            }
        });

        el('v2TokenPasteBtn').addEventListener('click', panodanTokenAl);

        durumuTazele();
        setInterval(durumuTazele, 30000);
    }

    /** Metin içinden JWT'yi ayıklar (Bearer öneki/tırnak/boşluk toleranslı). */
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
        if (!btn) return;
        var eski = btn.textContent;

        try {
            var pano = await navigator.clipboard.readText();
            var token = tokenAyikla(pano);
            if (!token) {
                btn.textContent = 'Token bulunamadı';
                setTimeout(function () { btn.textContent = eski; }, 2000);
                return;
            }
            if (input) input.value = token;
            cs?.updateManualTokenPreview?.();
            await cs?.applyManualTokenFromInput?.();
            btn.textContent = '✓ Kaydedildi';
            durumuTazele();
            setTimeout(function () { btn.textContent = eski; }, 1800);
        } catch (e) {
            btn.textContent = 'Panoya erişilemedi';
            if (input) input.focus();
            setTimeout(function () { btn.textContent = eski; }, 2200);
        }
    }

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
            dot.classList.add('is-bad');
            hint.textContent = 'Token yok';
        } else if (sonMs && sonMs < Date.now()) {
            dot.classList.add('is-bad');
            hint.textContent = 'Süresi doldu';
        } else if (sonMs && (sonMs - Date.now()) < 30 * 60000) {
            dot.classList.add('is-warn');
            hint.textContent = Math.round((sonMs - Date.now()) / 60000) + ' dk';
        } else {
            dot.classList.add('is-ok');
            hint.textContent = 'Token';
        }
    }

    // ================================================================
    function baslat() {
        try {
            yerlesimiKur();
            document.body.classList.add('v2-ready');
        } catch (e) {
            console.error('v2 yerleşimi kurulamadı, v1 düzeni korunuyor:', e);
        }
    }

    // counting.js ilk render'ını yaptıktan sonra düzenle
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(baslat, 0); });
    } else {
        setTimeout(baslat, 0);
    }

    window.CountingV2 = {
        cekmeceAc: cekmeceAc,
        cekmeceKapat: cekmeceKapat,
        durumuTazele: durumuTazele,
        tokenAyikla: tokenAyikla,
    };
})();
