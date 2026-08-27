/**
 * Jet Barkod — Sayım v2 arayüzü
 * ============================================================================
 *
 * counting.js'e HİÇ dokunmaz. Var olan DOM düğümlerini (ID'leriyle birlikte)
 * yeni bir kabuğa TAŞIR — kopyalamaz. Düğüm taşımak olay dinleyicilerini
 * bozmadığı için motorun tüm bağları çalışmaya devam eder.
 *
 * ---------------------------------------------------------------------------
 * NEDEN BÖYLE BİR YENİDEN DÜZENLEME
 * ---------------------------------------------------------------------------
 * v1'de her şey aynı anda ekrandaydı: aktif tablo kartı, tür sekmeleri,
 * 131 tablonun yatay şeridi, ürün ekleme kutusu, kamera/terminal/pano
 * düğmeleri, token paneli, senkron satırı, istatistikler ve ürün listesi —
 * alt alta. Göz nereye bakacağını bilemiyordu ve tablo aramak yatay
 * kaydırmayla yapılıyordu.
 *
 * v2'de ekranda aynı anda TEK bir iş var:
 *
 *   üst bar        → kimlik + aktif tablo çipi + token rozeti + kullanıcı
 *   komut çubuğu   → ürün arama (birincil) + araçlar + Senkronize Et + taşma
 *   özet şerit     → 4 metrik, tek satır (4.'sü v2'nin eklediği ilerleme)
 *   ana alan       → ürün listesi / grid (ekranın çoğu)
 *   çekmece        → tablo yönetimi (sağdan açılır, işi bitince kapanır)
 *   popover        → token (üst bardaki rozetten, tek tıkla panodan yapıştır)
 *
 * ---------------------------------------------------------------------------
 * KAYMA (LAYOUT SHIFT) SÖZÜ
 * ---------------------------------------------------------------------------
 * Tüm taşıma işi açılış perdesi (app-boot) hâlâ ekrandayken, ilk boyamadan
 * önce biter. Sonrasında çalışan hiçbir kod düzen değiştirmez: çekmece ve
 * popover fixed/absolute katmanlardır, sayıların yeri `tabular-nums` ve sabit
 * min genişliklerle korunur, grid kartlarında fark etiketi için yer baştan
 * ayrılmıştır.
 * ============================================================================
 */
(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Küçük yardımcılar
    // ------------------------------------------------------------------

    function el(id) { return document.getElementById(id); }
    function sistem() { return window.countingSystem || null; }

    function yap(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    /**
     * Düğümü hedefe TAŞIR (dinleyiciler korunur). Yoksa sessizce geçer.
     *
     * Taşınan düğümün ESKİ kabuğu boşaldıysa onu da gizler: v1'in kutuları
     * kenarlıklı/gölgeli dekoratif sarmalayıcılar olduğu için, içi boşalınca
     * ekranda anlamsız gri dikdörtgenler olarak kalıyorlardı.
     */
    function tasi(id, hedef) {
        var n = el(id);
        if (!n || !hedef) return n;
        var eskiKabuk = n.parentElement;
        hedef.appendChild(n);
        if (eskiKabuk) bosalanKabuklar.add(eskiKabuk);
        return n;
    }

    var bosalanKabuklar = new Set();

    /** Taşımalar bittikten sonra çağrılır: gerçekten boşalanları gizler. */
    function bosalanlariTemizle() {
        bosalanKabuklar.forEach(function (k) {
            if (!k.isConnected) return;
            if (k.id === 'v2DrawerBody' || k.closest('.v2-cmd, .v2-summary, .v2-body')) return;
            // İçinde hâlâ görünür bir şey var mı?
            if (k.querySelector('input, select, textarea, button, table, canvas, img')) return;
            if ((k.textContent || '').trim().length > 0) return;
            k.classList.add('v2-hidden');
        });
        bosalanKabuklar.clear();
    }

    /** counting.js'in toast'ı varsa onu kullan; yoksa sessiz kal. */
    function bildir(mesaj, tur, sure) {
        var cs = sistem();
        if (cs && typeof cs.showToast === 'function') cs.showToast(mesaj, tur || 'info', sure || 3000);
    }

    var ikon = {
        tablo: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>',
        takvim: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
        kapat: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
        pano: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2"/></svg>',
        daha: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>'
    };

    // ==================================================================
    // 1) KABUK — komut çubuğu + özet şerit + ana alan
    // ==================================================================

    function kabukKur() {
        var main = document.querySelector('main');
        if (!main || el('v2Shell')) return null;

        var shell = yap('div', 'v2-shell');
        shell.id = 'v2Shell';

        var komut = yap('div', 'v2-cmd');
        komut.id = 'v2Command';

        var ozet = yap('div', 'v2-summary');
        ozet.id = 'v2Summary';

        var govde = yap('div', 'v2-body');
        govde.id = 'v2Body';

        shell.appendChild(komut);
        shell.appendChild(ozet);
        shell.appendChild(govde);

        // Sekme şeridinden hemen sonra
        var sekmeSerit = main.firstElementChild;
        if (sekmeSerit && sekmeSerit.nextSibling) main.insertBefore(shell, sekmeSerit.nextSibling);
        else main.appendChild(shell);

        return shell;
    }

    // ==================================================================
    // 2) ÇEKMECE — tablo yönetimi
    // ==================================================================

    function cekmeceKur() {
        if (el('v2Drawer')) return;

        var backdrop = yap('div', 'v2-drawer-backdrop');
        backdrop.id = 'v2DrawerBackdrop';

        var drawer = yap('aside', 'v2-drawer');
        drawer.id = 'v2Drawer';
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.setAttribute('aria-label', 'Sayım tabloları');
        drawer.innerHTML =
            '<div class="v2-drawer__head">' +
            '  <div>' +
            '    <p class="v2-drawer__eyebrow">Tablolar</p>' +
            '    <h2 class="v2-drawer__title">Sayım tablonu seç</h2>' +
            '  </div>' +
            '  <button type="button" class="v2-iconbtn" id="v2DrawerClose" aria-label="Çekmeceyi kapat">' + ikon.kapat + '</button>' +
            '</div>' +
            '<div class="v2-drawer__body" id="v2DrawerBody"></div>' +
            '<div class="v2-drawer__actions" id="v2DrawerActions"></div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);

        backdrop.addEventListener('click', cekmeceKapat);
        el('v2DrawerClose').addEventListener('click', cekmeceKapat);

        // ESC: çekmece açıkken önce onu kapat (alttaki modallara sızmasın)
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && document.body.classList.contains('v2-drawer-open')) {
                e.stopPropagation();
                cekmeceKapat();
            }
        }, true);
    }

    var sonOdak = null;

    function cekmeceAc() {
        if (document.body.classList.contains('v2-drawer-open')) return;
        sonOdak = document.activeElement;
        document.body.classList.add('v2-drawer-open');
        var d = el('v2Drawer');
        if (d) d.setAttribute('aria-hidden', 'false');
        el('v2TableChip')?.setAttribute('aria-expanded', 'true');

        // Odak doğrudan aramaya gitsin — 131 tablo arasında yazarak bulunur
        setTimeout(function () {
            var q = el('generalTableSearch');
            var gorunur = q && q.offsetParent !== null;
            (gorunur ? q : el('v2DrawerClose'))?.focus();
        }, 260);
    }

    function cekmeceKapat() {
        if (!document.body.classList.contains('v2-drawer-open')) return;
        document.body.classList.remove('v2-drawer-open');
        var d = el('v2Drawer');
        if (d) d.setAttribute('aria-hidden', 'true');
        var chip = el('v2TableChip');
        chip?.setAttribute('aria-expanded', 'false');
        if (sonOdak && document.contains(sonOdak)) sonOdak.focus();
        else chip?.focus();
        sonOdak = null;
    }

    /**
     * Tablo seçilince çekmece kapansın — iş bitti, ekranı işgal etmesin.
     * Yakalama aşamasında dinliyoruz ki counting.js'in kendi işleyicisi
     * çalışmadan önce kapanış animasyonu başlasın (algılanan hız).
     */
    function cekmeceOtomatikKapanma() {
        var body = el('v2DrawerBody');
        if (!body) return;
        body.addEventListener('click', function (e) {
            var hedef = e.target;
            if (!(hedef instanceof Element)) return;

            // Tablo seçimi: pill / liste satırı / günlük tarih
            var secim = hedef.closest('#generalTableList [role="listitem"], #generalTableList button, ' +
                '#sayimGeneralTableDropdownList button, #dailyTableList button');
            if (!secim) return;

            // Silme/menü düğmeleri seçim değildir; çekmece açık kalsın
            if (hedef.closest('[data-sayim-menu-action], [data-action="delete"], .sayim-chip__delete')) return;

            setTimeout(cekmeceKapat, 120);
        });
    }

    // ==================================================================
    // 3) YERLEŞİM — düğümleri yeni yerlerine taşı
    // ==================================================================

    function yerlesimiKur() {
        var shell = kabukKur();
        if (!shell) return;
        cekmeceKur();

        var komut = el('v2Command');
        var ozet = el('v2Summary');
        var govde = el('v2Body');
        var drawerBody = el('v2DrawerBody');
        var drawerActions = el('v2DrawerActions');

        // ---- Çekmece: önce aktif tablo kartı, sonra tür anahtarı, sonra liste
        tasi('sayimActiveTableHost', drawerBody);

        var genelBtn = el('sayimTabGeneralBtn');
        var gunlukBtn = el('sayimTabDailyBtn');
        if (genelBtn && gunlukBtn) {
            var scope = yap('div', 'v2-scope');
            scope.setAttribute('role', 'tablist');
            scope.setAttribute('aria-label', 'Sayım tablo türü');
            scope.appendChild(genelBtn);
            scope.appendChild(gunlukBtn);
            drawerBody.appendChild(scope);
        }
        tasi('sayimPanelGeneral', drawerBody);
        tasi('sayimPanelDaily', drawerBody);

        // Tablo eylemleri çekmecenin dibinde sabit şeride insin
        ['renameTableBtn', 'deleteTableBtn', 'createTableBtn'].forEach(function (id) {
            tasi(id, drawerActions);
        });

        cekmeceOtomatikKapanma();

        // ---- Komut çubuğu: arama (birincil) + araçlar + senkron + taşma
        var arama = yap('div', 'v2-cmd__search');
        var giris = el('manualProductInputWrapper');
        if (giris) arama.appendChild(giris);

        var araclar = yap('div', 'v2-cmd__tools');
        ['cameraScanBtn', 'terminalScanBtn', 'getirCdnPasteBtn'].forEach(function (id) {
            var b = tasi(id, araclar);
            if (b) b.classList.add('v2-tool');
        });

        var anaEylem = yap('div', 'v2-cmd__main');
        tasi('syncStocksBtn', anaEylem);
        anaEylem.appendChild(tasmaMenusuKur());

        komut.appendChild(arama);
        komut.appendChild(araclar);
        komut.appendChild(yap('div', 'v2-cmd__sep'));
        komut.appendChild(anaEylem);

        // Enter ile ekleme / programatik tetikleme düğmeleri arama kutusuyla kalsın
        ['addProductBtn', 'searchProductBtn'].forEach(function (id) { tasi(id, arama); });

        // ---- Özet şerit
        tasi('countingStatsHost', ozet);
        ilerlemeKutusuKur(ozet);

        // ---- Ana alan
        tasi('countingTableContainer', govde);
        renkAnahtariKur();

        // ---- Üst bar
        aktifTabloCipiKur();
        tokenRozetiKur();

        // ---- Boşalan v1 kabuklarını kaldır
        bosalanlariTemizle();
        bosKabuklariGizle();
    }

    /** Yıkıcı sıfırlama işlemleri taşma menüsüne — tek tık uzaklıkta olmasınlar. */
    function tasmaMenusuKur() {
        var sarmal = yap('div', 'v2-more');
        sarmal.id = 'v2More';

        var btn = yap('button', 'v2-tool');
        btn.type = 'button';
        btn.id = 'v2MoreBtn';
        btn.innerHTML = ikon.daha;
        btn.title = 'Diğer stok işlemleri';
        btn.setAttribute('aria-label', 'Diğer stok işlemleri');
        btn.setAttribute('aria-expanded', 'false');

        var menu = yap('div', 'v2-more__menu');
        menu.id = 'v2MoreMenu';
        menu.setAttribute('role', 'menu');
        menu.hidden = true;
        menu.appendChild(yap('p', 'v2-more__label', 'Toplu işlemler'));

        sarmal.appendChild(btn);
        sarmal.appendChild(menu);

        // Düğümler yerleşim bittikten sonra taşınır (o an DOM'da hazırlar)
        setTimeout(function () {
            ['resetWarehouseStocksBtn', 'resetSystemStocksBtn'].forEach(function (id) {
                var b = tasi(id, menu);
                if (b) b.setAttribute('role', 'menuitem');
            });
            bosalanlariTemizle();
        }, 0);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var acilacak = menu.hidden;
            menu.hidden = !acilacak;
            btn.setAttribute('aria-expanded', acilacak ? 'true' : 'false');
        });

        document.addEventListener('click', function (e) {
            if (!menu.hidden && !sarmal.contains(e.target)) {
                menu.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
            }
        });

        menu.addEventListener('click', function () {
            menu.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        });

        return sarmal;
    }

    /** v1'in artık içi boşalmış dekoratif kutularını DOM'da bırakıp gizler. */
    function bosKabuklariGizle() {
        var main = document.querySelector('main');
        if (!main) return;

        Array.prototype.forEach.call(main.children, function (c) {
            if (c.id === 'v2Shell') return;
            if (c.classList.contains('tab-content')) return;
            if (c.id === 'sayimAuditLogOverlay') return;
            if (c === main.firstElementChild) return; // sekme şeridi
            if (!c.querySelector('input, button, table, canvas, [id]')) c.classList.add('v2-hidden');
        });

        // Sayım sekmesinin kabuğundaki her şey taşındı. Motor bu düğümlere
        // ID ile eriştiği için gizli olmaları sorun değil; ama sekme değişimi
        // `hidden` sınıfıyla yapıldığından satır içi style yerine sınıf
        // kullanıyoruz ki iki mekanizma birbiriyle kavga etmesin.
        el('sayimTabContent')?.classList.add('v2-hidden');
    }

    // ==================================================================
    // 4) ÜST BAR — aktif tablo çipi
    // ==================================================================

    function ustBar() {
        return document.querySelector('header .max-w-7xl > div, header > div > div');
    }

    function aktifTabloCipiKur() {
        if (el('v2TableChip')) return;
        var header = ustBar();
        if (!header) return;

        var chip = yap('button', 'v2-chip');
        chip.id = 'v2TableChip';
        chip.type = 'button';
        chip.setAttribute('aria-haspopup', 'dialog');
        chip.setAttribute('aria-expanded', 'false');
        chip.title = 'Tablo değiştir';
        chip.innerHTML =
            '<span class="v2-chip__mark" id="v2ChipMark" aria-hidden="true">' + ikon.tablo + '</span>' +
            '<span class="v2-chip__text">' +
            '  <span class="v2-chip__eyebrow">Aktif tablo</span>' +
            '  <span class="v2-chip__name" id="v2TableChipName">—</span>' +
            '</span>' +
            '<svg class="v2-chip__caret" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">' +
            '  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';
        chip.addEventListener('click', function () {
            if (document.body.classList.contains('v2-drawer-open')) cekmeceKapat();
            else cekmeceAc();
        });

        // Ortadaki boşluk doldurucunun hemen ardına — sağ blokla arasında dursun
        var bosluk = header.querySelector('.flex-1');
        if (bosluk && bosluk.parentNode) bosluk.parentNode.insertBefore(chip, bosluk.nextSibling);
        else header.appendChild(chip);

        cipiTazele();
        cipiIzle();
    }

    function cipiTazele() {
        var cs = sistem();
        var ad = el('v2TableChipName');
        if (!cs || !ad) return;

        var isim = cs.currentTableName || '';
        var gosterim = (isim && cs.formatTableDisplayName) ? cs.formatTableDisplayName(isim) : (isim || '—');
        if (ad.textContent !== gosterim) ad.textContent = gosterim;

        var chip = el('v2TableChip');
        var mark = el('v2ChipMark');
        if (!chip || !mark) return;

        var gunluk = !!(isim && cs.isDailyTableName && cs.isDailyTableName(isim));
        if (chip.classList.contains('is-daily') !== gunluk) {
            chip.classList.toggle('is-daily', gunluk);
            mark.innerHTML = gunluk ? ikon.takvim : ikon.tablo;
        }
    }

    /**
     * Çip güncellemesi: yoklama (polling) yerine olay güdümlü.
     * counting.js aktif tablo adını `#sayimActiveTableTitle` içine yazıyor;
     * o düğümü izlemek 1.2 sn'lik setInterval'dan hem daha hızlı hem bedava.
     * Yine de tabloyu başka bir yol değiştirirse diye seyrek bir emniyet
     * kontrolü bırakıyoruz.
     */
    function cipiIzle() {
        var kaynak = el('sayimActiveTableTitle');
        if (kaynak && 'MutationObserver' in window) {
            new MutationObserver(cipiTazele).observe(kaynak, { childList: true, characterData: true, subtree: true });
        }
        setInterval(cipiTazele, 5000);
    }

    // ==================================================================
    // 5) TOKEN — üst sağda durum rozeti + tek tıkla panodan yapıştırma
    // ==================================================================

    function tokenRozetiKur() {
        if (el('v2TokenBtn')) return;
        var header = ustBar();
        if (!header) return;

        var wrap = yap('div', 'v2-token');
        wrap.id = 'v2Token';
        wrap.innerHTML =
            '<button type="button" class="v2-token-btn" id="v2TokenBtn" aria-expanded="false" aria-haspopup="dialog" title="Franchise token durumu">' +
            '  <span class="v2-token-dot" id="v2TokenDot" aria-hidden="true"></span>' +
            '  <span class="v2-token-btn__label" id="v2TokenHint">Token</span>' +
            '</button>' +
            '<div class="v2-token-pop" id="v2TokenPop" role="dialog" aria-label="Franchise token" hidden>' +
            '  <div class="v2-token-pop__head">' +
            '    <div>' +
            '      <p class="v2-token-pop__title">Franchise token</p>' +
            '      <p class="v2-token-pop__sub" id="v2TokenSub">Durum kontrol ediliyor…</p>' +
            '    </div>' +
            '    <button type="button" class="v2-iconbtn" id="v2TokenClose" aria-label="Kapat">' + ikon.kapat + '</button>' +
            '  </div>' +
            '  <div class="v2-token-pop__body">' +
            '    <button type="button" class="v2-paste" id="v2TokenPasteBtn">' + ikon.pano + '<span id="v2TokenPasteLabel">Panodan yapıştır</span></button>' +
            '    <p class="v2-token-hint">Token’ı kopyaladıysan bu düğme yeter. Sayfanın herhangi bir yerinde <kbd>Ctrl</kbd>+<kbd>V</kbd> de çalışır.</p>' +
            '    <dl class="v2-token-facts">' +
            '      <dt>Depo</dt><dd id="v2TokenWarehouse">—</dd>' +
            '      <dt>Bitiş</dt><dd id="v2TokenExpiry">—</dd>' +
            '    </dl>' +
            '    <div id="v2TokenPopBody"></div>' +
            '  </div>' +
            '</div>';

        // Kullanıcı bloğunun soluna — çıkış düğmesinden uzakta dursun
        var kullanici = header.querySelector('#countingHeaderUserHost');
        var sagBlok = kullanici ? kullanici.parentNode : null;
        if (sagBlok) sagBlok.insertBefore(wrap, kullanici);
        else header.appendChild(wrap);

        // v1'in token kutuları popover'a taşınır (ID'ler korunur)
        tasi('apiStatusCard', el('v2TokenPopBody'));
        tasi('manualTokenPanel', el('v2TokenPopBody'));

        var btn = el('v2TokenBtn');
        var pop = el('v2TokenPop');

        function ac() {
            pop.hidden = false;
            btn.setAttribute('aria-expanded', 'true');
            durumuTazele();
        }
        function kapat() {
            pop.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (pop.hidden) ac(); else kapat();
        });
        el('v2TokenClose').addEventListener('click', kapat);
        document.addEventListener('click', function (e) {
            if (!pop.hidden && !wrap.contains(e.target)) kapat();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); kapat(); btn.focus(); }
        });

        el('v2TokenPasteBtn').addEventListener('click', panodanTokenAl);
        genelYapistirmayiDinle();

        durumuTazele();
        setInterval(durumuTazele, 20000);
    }

    /** Metin içinden JWT'yi ayıklar (Bearer öneki / tırnak / boşluk toleranslı). */
    function tokenAyikla(metin) {
        if (!metin) return '';
        var temiz = String(metin).replace(/^\s*["']|["']\s*$/g, '').trim();
        var m = temiz.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/);
        return m ? m[0] : '';
    }

    /** Bulunan token'ı motora verir. Ortak yol: hem düğme hem Ctrl+V buradan geçer. */
    async function tokenUygula(token) {
        var cs = sistem();
        var input = el('manualTokenInput');
        if (input) input.value = token;
        cs?.updateManualTokenPreview?.();
        await cs?.applyManualTokenFromInput?.();
        durumuTazele();
    }

    function pasteDurumu(metin, sinif) {
        var btn = el('v2TokenPasteBtn');
        var lbl = el('v2TokenPasteLabel');
        if (!btn || !lbl) return;
        var eski = lbl.textContent;
        lbl.textContent = metin;
        btn.classList.remove('is-ok', 'is-bad');
        if (sinif) btn.classList.add(sinif);
        setTimeout(function () {
            lbl.textContent = 'Panodan yapıştır';
            btn.classList.remove('is-ok', 'is-bad');
        }, 2200);
        return eski;
    }

    async function panodanTokenAl() {
        var input = el('manualTokenInput');
        try {
            var pano = await navigator.clipboard.readText();
            var token = tokenAyikla(pano);
            if (!token) {
                pasteDurumu('Panoda token yok', 'is-bad');
                return;
            }
            await tokenUygula(token);
            pasteDurumu('Kaydedildi', 'is-ok');
        } catch (e) {
            // Tarayıcı pano iznini vermedi — elle yapıştırma yoluna yönlendir
            pasteDurumu('Panoya erişilemedi', 'is-bad');
            if (input) { input.focus(); input.select?.(); }
        }
    }

    /**
     * Sayfanın herhangi bir yerinde Ctrl+V: pano bir JWT içeriyorsa doğrudan
     * uygula. Bir metin kutusuna yapıştırılıyorsa karışmayız.
     */
    function genelYapistirmayiDinle() {
        document.addEventListener('paste', function (e) {
            var t = e.target;
            if (t instanceof Element && t.closest('input, textarea, [contenteditable="true"]')) return;

            var metin = e.clipboardData && e.clipboardData.getData('text');
            var token = tokenAyikla(metin);
            if (!token) return;

            e.preventDefault();
            tokenUygula(token).then(function () {
                bildir('Token panodan alındı ve kaydedildi', 'success', 3000);
            });
        });
    }

    /** Rozet + popover başlığındaki durum metinlerini tazeler. */
    function durumuTazele() {
        var dot = el('v2TokenDot');
        var hint = el('v2TokenHint');
        if (!dot || !hint) return;

        var cs = sistem();
        var btn = el('v2TokenBtn');
        var info = cs && cs.cachedFullData && cs.cachedFullData._api_info;
        var sonMs = 0;
        try { sonMs = (cs && cs.getEffectiveExpiryMs) ? cs.getEffectiveExpiryMs(info || {}) : 0; } catch (e) { sonMs = 0; }

        var durum, etiket, ozet;
        if (!info || !info.token) {
            durum = 'is-bad'; etiket = 'Token yok';
            ozet = 'Token bulunamadı — sistem stokları çekilemez.';
        } else if (sonMs && sonMs < Date.now()) {
            durum = 'is-bad'; etiket = 'Süresi doldu';
            ozet = 'Token süresi doldu — yenisini yapıştır.';
        } else if (sonMs && (sonMs - Date.now()) < 30 * 60000) {
            durum = 'is-warn';
            etiket = Math.max(1, Math.round((sonMs - Date.now()) / 60000)) + ' dk';
            ozet = 'Token birazdan dolacak.';
        } else {
            durum = 'is-ok'; etiket = 'Token';
            ozet = 'Token geçerli.';
        }

        dot.className = 'v2-token-dot ' + durum;
        if (hint.textContent !== etiket) hint.textContent = etiket;
        if (btn) btn.classList.toggle('is-bad', durum === 'is-bad');

        var sub = el('v2TokenSub');
        if (sub && sub.textContent !== ozet) sub.textContent = ozet;

        var depo = el('v2TokenWarehouse');
        if (depo) {
            var ad = (info && (info.warehouseName || info.warehouse_name)) || '—';
            if (depo.textContent !== ad) depo.textContent = ad;
        }

        var bitis = el('v2TokenExpiry');
        if (bitis) {
            var metin = sonMs ? new Date(sonMs).toLocaleString('tr-TR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            }) : '—';
            if (bitis.textContent !== metin) bitis.textContent = metin;
        }
    }

    // ==================================================================
    // 6) ÖZET ŞERİT — sayım ilerlemesi (v2'nin eklediği 4. metrik)
    // ==================================================================

    function ilerlemeKutusuKur(ozet) {
        if (!ozet || el('v2ProgressTile')) return;

        var tile = yap('div', 'v2-tile v2-tile--progress');
        tile.id = 'v2ProgressTile';
        tile.innerHTML =
            '<p class="v2-tile__label">Sayılan</p>' +
            '<p class="v2-tile__value" id="v2ProgressValue">%0</p>' +
            '<div class="v2-tile__meter"><div class="v2-tile__bar" id="v2ProgressBar"></div></div>' +
            '<p class="v2-tile__sub" id="v2ProgressSub">0 / 0 ürün</p>';
        ozet.appendChild(tile);

        ilerlemeyiTazele();

        // Motorun yazdığı toplam değiştiğinde tazele — yoklama yok
        var kaynak = el('totalProductsCount');
        if (kaynak && 'MutationObserver' in window) {
            new MutationObserver(ilerlemeyiTazele).observe(kaynak, { childList: true, characterData: true, subtree: true });
        }
    }

    function ilerlemeyiTazele() {
        var cs = sistem();
        var deger = el('v2ProgressValue');
        var bar = el('v2ProgressBar');
        var alt = el('v2ProgressSub');
        if (!cs || !deger || !bar || !alt) return;

        var veri = cs.countingData || {};
        var toplam = 0;
        var sayilan = 0;

        for (var id in veri) {
            if (!Object.prototype.hasOwnProperty.call(veri, id)) continue;
            if (cs.isReservedCountingKey && cs.isReservedCountingKey(id)) continue;
            var d = veri[id];
            if (!d || typeof d !== 'object') continue;
            toplam++;
            if (d.warehouseStock !== null && d.warehouseStock !== undefined) sayilan++;
        }

        var yuzde = toplam ? Math.round((sayilan / toplam) * 100) : 0;
        var y = '%' + yuzde;
        var a = sayilan + ' / ' + toplam + ' ürün';

        if (deger.textContent !== y) deger.textContent = y;
        if (alt.textContent !== a) alt.textContent = a;
        bar.style.width = yuzde + '%';
    }

    // ==================================================================
    // 7) GRID MODU — renk anahtarı + kart üstünde fark sayısı
    // ==================================================================

    function renkAnahtariKur() {
        if (el('v2Legend')) return;
        var grid = el('rapidCountingGrid');
        if (!grid) return;

        var legend = yap('div', 'v2-legend');
        legend.id = 'v2Legend';
        legend.setAttribute('aria-label', 'Renk anahtarı');
        legend.innerHTML = [
            ['tam', 'Fark yok'],
            ['fazla', 'Fazla'],
            ['eksik', 'Eksik'],
            ['yarim', 'Yarım'],
            ['bekleyen', 'Sayılmadı']
        ].map(function (p) {
            return '<span class="v2-legend__item"><span class="v2-legend__swatch v2-legend__swatch--' + p[0] + '"></span>' + p[1] + '</span>';
        }).join('');

        grid.insertBefore(legend, grid.firstChild);
    }

    /** Bir ürünün durumunu etikete çevirir. */
    function farkEtiketi(cs, data) {
        var varDepo = data && data.warehouseStock !== null && data.warehouseStock !== undefined;
        var varSistem = data && data.systemStock !== null && data.systemStock !== undefined;

        if (!varDepo && !varSistem) return { metin: '—', sinif: 'bekleyen' };
        if (!varDepo || !varSistem) return { metin: 'Yarım', sinif: 'yarim' };

        var fark = cs.calculateDifference(data.warehouseStock, data.systemStock);
        if (fark.type === 'positive') return { metin: '+' + fark.value, sinif: 'fazla' };
        if (fark.type === 'negative') return { metin: '−' + fark.value, sinif: 'eksik' };
        return { metin: '✓', sinif: 'tam' };
    }

    /**
     * Grid kartlarının altına fark sayısını yazar.
     *
     * counting.js'e dokunmamak için `renderRapidCountingMode`'u ÖRNEK ÜZERİNDE
     * sarmalıyoruz (dosya değişmiyor, v1 etkilenmiyor). Her render'dan sonra
     * yalnızca DEĞİŞEN etiketler yazılır; kartın son çocuğuna bakmak O(1).
     */
    function farkEtiketleriniKur() {
        var cs = sistem();
        if (!cs || typeof cs.renderRapidCountingMode !== 'function' || cs.__v2DiffWrapped) return false;

        var orijinal = cs.renderRapidCountingMode.bind(cs);
        cs.__v2DiffWrapped = true;
        cs.renderRapidCountingMode = function () {
            orijinal();
            try { etiketleriYaz(); } catch (e) { /* etiket kozmetiktir, render'ı düşürmesin */ }
        };

        try { etiketleriYaz(); } catch (e) {}
        return true;
    }

    function etiketleriYaz() {
        var cs = sistem();
        var kap = el('rapidCountingGridContainer');
        if (!cs || !kap) return;

        var kartlar = kap.children;
        for (var i = 0; i < kartlar.length; i++) {
            var kart = kartlar[i];
            var pid = kart.dataset && kart.dataset.productId;
            if (!pid) continue;

            var etiket = farkEtiketi(cs, cs.countingData[pid]);
            var son = kart.lastElementChild;

            if (!son || !son.classList.contains('v2-diff')) {
                son = yap('div', 'v2-diff');
                son.setAttribute('aria-hidden', 'true');
                kart.appendChild(son);
            }

            var sinif = 'v2-diff v2-diff--' + etiket.sinif;
            if (son.className !== sinif) son.className = sinif;
            if (son.textContent !== etiket.metin) son.textContent = etiket.metin;
        }
    }

    // ==================================================================
    // 8) BAŞLAT
    // ==================================================================

    function baslat() {
        try {
            yerlesimiKur();
            document.body.classList.add('v2-ready');
        } catch (e) {
            console.error('v2 yerleşimi kurulamadı, v1 düzeni korunuyor:', e);
            return;
        }

        // Motor hazır olur olmaz grid etiketlerini ve ilerlemeyi bağla.
        // counting.js senkron yüklendiği için genelde ilk denemede tutar;
        // tutmazsa kısa süre yoklar, sonra vazgeçer (sonsuz timer yok).
        var deneme = 0;
        var t = setInterval(function () {
            deneme++;
            if (farkEtiketleriniKur() || deneme > 40) {
                clearInterval(t);
                ilerlemeyiTazele();
            }
        }, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(baslat, 0); });
    } else {
        setTimeout(baslat, 0);
    }

    window.CountingV2 = {
        cekmeceAc: cekmeceAc,
        cekmeceKapat: cekmeceKapat,
        durumuTazele: durumuTazele,
        ilerlemeyiTazele: ilerlemeyiTazele,
        etiketleriYaz: etiketleriYaz,
        tokenAyikla: tokenAyikla
    };
})();
