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
     * Tablo seçilince çekmece KENDİ KAPANIR.
     *
     * Tıklamayı dinlemek kırılgandı: liste öğelerinin işaretlemesi tabloya
     * göre değişiyor ve bazı tıklamalar seçim sayılmıyordu. Bunun yerine
     * sonucu izliyoruz — aktif tablo başlığı değiştiyse seçim OLMUŞTUR.
     * Ayrıca seçimin görüldüğünü belli etmek için başlık kısa bir an
     * vurgulanıyor, sonra çekmece kapanıyor.
     */
    function cekmeceOtomatikKapanma() {
        var kaynak = el('sayimActiveTableTitle');
        if (!kaynak || !('MutationObserver' in window)) return;

        var sonAd = (kaynak.textContent || '').trim();

        new MutationObserver(function () {
            var ad = (kaynak.textContent || '').trim();
            if (ad === sonAd) return;
            sonAd = ad;
            cipiTazele();
            if (!document.body.classList.contains('v2-drawer-open')) return;

            var kart = el('sayimActiveTableHost');
            if (kart) {
                kart.classList.add('is-secildi');
                setTimeout(function () { kart.classList.remove('is-secildi'); }, 600);
            }
            setTimeout(cekmeceKapat, 260);
        }).observe(kaynak, { childList: true, characterData: true, subtree: true });
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

        // Dört araç da AYNI kutuda, aynı ölçüde: kamera, terminal, pano, senkron.
        // Senkron eskiden yazılı ve iri bir düğmeydi; sırıtıyordu.
        var araclar = yap('div', 'v2-cmd__tools');
        ['cameraScanBtn', 'terminalScanBtn', 'getirCdnPasteBtn', 'syncStocksBtn'].forEach(function (id) {
            var b = tasi(id, araclar);
            if (b) b.classList.add('v2-tool');
        });

        var anaEylem = yap('div', 'v2-cmd__main');
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
        listeBasligiSikistir();
        yogunlukKontroluKur();
        renkAnahtariKur();

        // ---- Üst bar
        aktifTabloCipiKur();
        tokenRozetiKur();

        // ---- Boşalan v1 kabuklarını kaldır
        bosalanlariTemizle();
        bosKabuklariGizle();
        sekmeGorunurluguIzle();
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

    /**
     * Sayım sekmesinin içeriği v2'de `#v2Shell` içinde yaşıyor. counting.js
     * sekme değişiminde yalnızca `#sayimTabContent`'e `hidden` ekliyor; kabuk
     * onun DIŞINDA olduğu için Finans / Stok farkı sekmelerine geçildiğinde
     * sayım tablosu ekranda kalıyor ve diğer sekme onun altına düşüyordu.
     * Motorun bayrağını izleyip kabuğu birlikte gizliyoruz.
     */
    function sekmeGorunurluguIzle() {
        var kaynak = el('sayimTabContent');
        var shell = el('v2Shell');
        if (!kaynak || !shell) return;

        function esitle() {
            var sayimda = !kaynak.classList.contains('hidden');
            shell.classList.toggle('v2-hidden', !sayimda);
        }

        if ('MutationObserver' in window) {
            new MutationObserver(esitle).observe(kaynak, { attributes: true, attributeFilter: ['class'] });
        }
        esitle();
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
            '<button type="button" class="v2-token-btn" id="v2TokenBtn" aria-expanded="false" aria-haspopup="dialog" title="Token durumu">' +
            '  <span class="v2-token-dot" id="v2TokenDot" aria-hidden="true"></span>' +
            '  <span class="v2-token-btn__label" id="v2TokenHint">Token</span>' +
            '</button>' +
            '<div class="v2-token-pop" id="v2TokenPop" role="dialog" aria-label="Token durumu" hidden>' +
            '  <div class="v2-token-pop__head">' +
            '    <span class="v2-token-dot" id="v2TokenPopDot" aria-hidden="true"></span>' +
            '    <div class="v2-token-pop__text">' +
            '      <p class="v2-token-pop__title" id="v2TokenSub">Kontrol ediliyor</p>' +
            '      <p class="v2-token-pop__depo" id="v2TokenWarehouse"></p>' +
            '    </div>' +
            '    <div class="v2-token-pop__araclar" id="v2TokenTools"></div>' +
            '  </div>' +
            '  <div class="v2-token-pop__body">' +
            '    <dl class="v2-token-facts" id="v2TokenFacts">' +
            '      <dt>Kalan süre</dt><dd id="v2TokenLeft">—</dd>' +
            '      <dt>Bitiş</dt><dd id="v2TokenExpiry">—</dd>' +
            '    </dl>' +
            '    <button type="button" class="v2-paste" id="v2TokenPasteBtn">' + ikon.pano +
            '      <span id="v2TokenPasteLabel">Panodan yapıştır</span></button>' +
            '    <p class="v2-token-hint" id="v2TokenIpucu">Getir sayfasındaki token’ı kopyala, buraya bas.</p>' +
            '    <details class="v2-token-elle" id="v2TokenElle">' +
            '      <summary>Elle gir</summary>' +
            '      <div id="v2TokenPopBody"></div>' +
            '    </details>' +
            '  </div>' +
            '</div>';

        var kullanici = header.querySelector('#countingHeaderUserHost');
        var sagBlok = kullanici ? kullanici.parentNode : null;
        if (sagBlok) sagBlok.insertBefore(wrap, kullanici);
        else header.appendChild(wrap);

        /*
         * v1'in API durum kartı popover'a taşınıyor ama GÖRÜNMÜYOR (CSS'te
         * gizli). İki nedenle DOM'da duruyor:
         *   1. counting.js oraya yazmaya devam ediyor — kaldırsak motor kırılır.
         *   2. Aynı bilgiyi bizim satırlarımız zaten gösteriyor; iki kez
         *      göstermek paneli kalabalıklaştırıyordu.
         * Ayrıca güvenilir bir YEDEK KAYNAK: cachedFullData._api_info bir
         * sebeple boş kalırsa durumu bu karttan okuyoruz.
         */
        tasi('apiStatusCard', el('v2TokenPopBody'));
        tasi('manualTokenPanel', el('v2TokenPopBody'));
        // Yenile düğmesi kartın içinde kalırsa gizlenir; başlığa alınıyor
        var yenile = tasi('refreshTokenBtn', el('v2TokenTools'));
        if (yenile) {
            yenile.className = 'v2-iconbtn';
            yenile.addEventListener('click', function () { setTimeout(durumuTazele, 1200); });
        }

        var kapatBtn = yap('button', 'v2-iconbtn');
        kapatBtn.type = 'button';
        kapatBtn.id = 'v2TokenClose';
        kapatBtn.setAttribute('aria-label', 'Kapat');
        kapatBtn.innerHTML = ikon.kapat;
        el('v2TokenTools').appendChild(kapatBtn);

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
            var d = el('v2TokenElle');
            if (d) d.open = false;
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (pop.hidden) ac(); else kapat();
        });
        kapatBtn.addEventListener('click', kapat);
        document.addEventListener('click', function (e) {
            if (!pop.hidden && !wrap.contains(e.target)) kapat();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); kapat(); btn.focus(); }
        });

        el('v2TokenPasteBtn').addEventListener('click', panodanTokenAl);
        genelYapistirmayiDinle();
        motoraBaglan();

        durumuTazele();
        setInterval(durumuTazele, 20000);
    }

    /**
     * counting.js token durumunu her tazelediğinde biz de tazeleyelim.
     * Yoklamaya güvenmek yetmiyordu: motor kartı 500 ms'de bir kez, sonra
     * 30 sn'de bir güncelliyor; bizim 20 sn'lik turumuzla kayıyordu ve
     * rozet "Token yok" derken kart "9 saat kaldı" diyebiliyordu.
     */
    function motoraBaglan() {
        var cs = sistem();
        if (!cs || cs.__v2TokenWrapped || typeof cs.updateAPIStatusCard !== 'function') return false;
        var orijinal = cs.updateAPIStatusCard.bind(cs);
        cs.__v2TokenWrapped = true;
        cs.updateAPIStatusCard = function () {
            var sonuc = orijinal();
            Promise.resolve(sonuc).then(durumuTazele, durumuTazele);
            return sonuc;
        };
        return true;
    }

    /** Metin içinden JWT'yi ayıklar (Bearer öneki / tırnak / boşluk toleranslı). */
    function tokenAyikla(metin) {
        if (!metin) return '';
        var temiz = String(metin).replace(/^\s*["']|["']\s*$/g, '').trim();
        var m = temiz.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/);
        return m ? m[0] : '';
    }

    /** Bulunan token'ı motora verir. Hem düğme hem Ctrl+V buradan geçer. */
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
        lbl.textContent = metin;
        btn.classList.remove('is-ok', 'is-bad');
        if (sinif) btn.classList.add(sinif);
        setTimeout(function () {
            lbl.textContent = 'Panodan yapıştır';
            btn.classList.remove('is-ok', 'is-bad');
        }, 2200);
    }

    async function panodanTokenAl() {
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
            // Tarayıcı pano iznini vermedi — elle girme yolunu aç
            pasteDurumu('Panoya erişilemedi', 'is-bad');
            var d = el('v2TokenElle');
            if (d) d.open = true;
            el('manualTokenInput')?.focus();
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

    function sureMetni(ms) {
        if (!ms || ms <= 0) return null;
        var dk = Math.floor(ms / 60000);
        var sa = Math.floor(dk / 60);
        var gun = Math.floor(sa / 24);
        if (gun > 0) return gun + ' gün ' + (sa % 24) + ' sa';
        if (sa > 0) return sa + ' sa ' + (dk % 60) + ' dk';
        return dk + ' dk';
    }

    /**
     * Token durumunu çözer.
     *
     * Birincil kaynak motorun `cachedFullData._api_info` nesnesi. O bir
     * sebeple boşsa (tablo değişiminde cache yenilenebiliyor) v1'in durum
     * kartından okuyoruz — motor oraya yazmayı hiç bırakmıyor, dolayısıyla
     * ekranda görünen doğru bilgiyle rozet asla çelişmiyor.
     */
    function tokenDurumu() {
        var cs = sistem();
        var info = cs && cs.cachedFullData && cs.cachedFullData._api_info;

        if (info && info.token) {
            var son = 0;
            try { son = cs.getEffectiveExpiryMs(info) || 0; } catch (e) { son = 0; }
            var kalan = son ? son - Date.now() : null;
            return {
                varMi: true,
                depo: info.warehouseName || (info.warehouseId ? String(info.warehouseId).slice(0, 8) + '…' : ''),
                kalanMs: kalan,
                bitis: son ? new Date(son).toLocaleString('tr-TR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : null
            };
        }

        // --- Yedek: v1 durum kartı ---
        var kart = el('apiStatusCard');
        if (!kart || kart.classList.contains('hidden')) return { varMi: false };

        var metin = (el('apiStatusText')?.textContent || '').trim();
        var depoHam = (el('apiWarehouseName')?.textContent || '').replace(/^Depo:\s*/, '').trim();
        var sureHam = (el('apiExpiryTime')?.textContent || '').replace(/\s+/g, ' ').trim();

        var kalanEsl = sureHam.match(/Kalan süre:\s*([^S]+?)(?:\s*Son kullanma|$)/);
        var bitisEsl = sureHam.match(/Son kullanma:\s*(.+)$/);

        return {
            varMi: true,
            suresizMi: metin === 'Token bilgisi eksik',
            doldu: metin === 'Token süresi dolmuş',
            bitmekUzere: metin === 'Token yakında dolacak',
            depo: depoHam && depoHam !== 'Depo bilgisi yok' ? depoHam : '',
            kalanMetin: kalanEsl ? kalanEsl[1].trim() : null,
            bitis: bitisEsl ? bitisEsl[1].trim() : null
        };
    }

    /** Rozet + popover metinlerini tazeler. */
    function durumuTazele() {
        var dot = el('v2TokenDot');
        var hint = el('v2TokenHint');
        if (!dot || !hint) return;

        var d = tokenDurumu();
        var durum, etiket, baslik;

        if (!d.varMi) {
            durum = 'is-bad'; etiket = 'Token yok';
            baslik = 'Token yok';
        } else if (d.doldu || (d.kalanMs != null && d.kalanMs <= 0)) {
            durum = 'is-bad'; etiket = 'Süresi doldu';
            baslik = 'Süresi doldu';
        } else if (d.suresizMi) {
            durum = 'is-warn'; etiket = 'Süre yok';
            baslik = 'Süre bilgisi okunamadı';
        } else if (d.bitmekUzere || (d.kalanMs != null && d.kalanMs < 30 * 60000)) {
            durum = 'is-warn';
            etiket = d.kalanMs != null ? sureMetni(d.kalanMs) : (d.kalanMetin || 'Az kaldı');
            baslik = 'Yakında dolacak';
        } else {
            durum = 'is-ok'; etiket = 'Token';
            baslik = 'Token geçerli';
        }

        dot.className = 'v2-token-dot ' + durum;
        if (hint.textContent !== etiket) hint.textContent = etiket;
        el('v2TokenBtn')?.classList.toggle('is-bad', durum === 'is-bad');

        var popDot = el('v2TokenPopDot');
        if (popDot) popDot.className = 'v2-token-dot ' + durum;

        yazDegistiyse('v2TokenSub', baslik);
        yazDegistiyse('v2TokenWarehouse', d.depo || '');
        yazDegistiyse('v2TokenLeft', d.kalanMs != null ? (sureMetni(d.kalanMs) || 'doldu') : (d.kalanMetin || '—'));
        yazDegistiyse('v2TokenExpiry', d.bitis || '—');

        var facts = el('v2TokenFacts');
        if (facts) facts.hidden = !d.varMi;

        yazDegistiyse('v2TokenIpucu', d.varMi
            ? 'Yeni token için Getir sayfasındaki değeri kopyalayıp buraya bas.'
            : 'Getir franchise sayfasındaki token’ı kopyala, buraya bas.');
    }

    function yazDegistiyse(id, metin) {
        var n = el(id);
        if (n && n.textContent !== metin) n.textContent = metin;
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

    /**
     * Liste başlığını tek satıra indirir.
     *
     * Bu şerit yapışkan; üç satır yüksekliğinde olması telefonda ekranın
     * beşte birini yiyordu. "Sayım Tablosu" başlığı zaten bilinen bir şeyi
     * söylüyor (CSS'te gizleniyor); arama ile görünüm anahtarı aynı satıra
     * alınıyor.
     */
    function listeBasligiSikistir() {
        var kap = el('countingTableContainer');
        if (!kap) return;
        var serit = kap.firstElementChild;
        if (!serit) return;

        var ustSatir = serit.querySelector('.flex.items-center.justify-between');
        var arama = el('countingTableSearchWrapper');
        if (!ustSatir || !arama) return;

        ustSatir.classList.add('v2-listhead');
        // Arama, görünüm anahtarının SOLUNA girsin
        ustSatir.insertBefore(arama, ustSatir.lastElementChild);
    }

    // ==================================================================
    // GRID YOĞUNLUĞU — kart boyutu / sütun sayısı
    // ------------------------------------------------------------------
    // Tek bir "sütun sayısı" ayarı her ekranda çalışmaz: telefonda 4 iyi
    // gelirken masaüstünde 4 sütun kartları devleştirir. O yüzden kullanıcı
    // bir SEVİYE seçiyor ("kartlar ne kadar büyük olsun"), o seviyenin her
    // ekran genişliğindeki sütun karşılığını CSS'teki tablo veriyor.
    // Seviye cihaz başına localStorage'da kalıyor.
    // ==================================================================

    var YOGUNLUK_KEY = 'jb_v2_grid_yogunluk';
    var YOGUNLUK_ADLARI = ['Çok büyük', 'Büyük', 'Orta', 'Küçük'];
    var YOGUNLUK_VARSAYILAN = 2; // "Orta"

    function yogunlukOku() {
        var v = parseInt(localStorage.getItem(YOGUNLUK_KEY), 10);
        return (v >= 0 && v < YOGUNLUK_ADLARI.length) ? v : YOGUNLUK_VARSAYILAN;
    }

    function yogunlukYaz(v) {
        try { localStorage.setItem(YOGUNLUK_KEY, String(v)); } catch (e) { /* özel mod */ }
    }

    /**
     * O anki gerçek sütun sayısı.
     *
     * Grid görünürken tarayıcı `gridTemplateColumns`'ı piksellere çözer ve
     * parça saymak yeterlidir. Ama grid GİZLİYKEN (tablo görünümündeyken)
     * çözmez, yazdığımız `repeat(4, minmax(0, 1fr))` metnini aynen döner —
     * onu boşluktan bölünce 3 çıkıyordu. Bu yüzden önce repeat() okunuyor.
     */
    function sutunSayisi() {
        var kap = el('rapidCountingGridContainer');
        if (!kap) return 0;
        var sablon = getComputedStyle(kap).gridTemplateColumns || '';
        if (!sablon || sablon === 'none') return 0;
        var m = sablon.match(/repeat\(\s*(\d+)/);
        if (m) return parseInt(m[1], 10);
        return sablon.trim().split(/\s+/).length;
    }

    function yogunlukUygula(v, bildirsin) {
        var kap = el('rapidCountingGridContainer');
        if (kap) kap.setAttribute('data-yogunluk', String(v));
        yogunlukYaz(v);
        // Sütun sayısı bir sonraki düzen hesabından sonra okunmalı
        requestAnimationFrame(function () {
            yogunlukEtiketiTazele();
            if (bildirsin) bildir(YOGUNLUK_ADLARI[v] + ' · ' + sutunSayisi() + ' sütun', 'info', 1600);
        });
    }

    function yogunlukEtiketiTazele() {
        var sayi = el('v2YogunlukSayi');
        var btn = el('v2YogunlukBtn');
        if (!sayi || !btn) return;
        var n = sutunSayisi();
        var metin = n ? String(n) : '—';
        if (sayi.textContent !== metin) sayi.textContent = metin;
        btn.title = 'Kart boyutu: ' + YOGUNLUK_ADLARI[yogunlukOku()] + ' (' + metin + ' sütun) — değiştirmek için tıkla';
    }

    function yogunlukKontroluKur() {
        if (el('v2YogunlukBtn')) return;
        var baslik = document.querySelector('.v2-listhead');
        if (!baslik) return;

        var btn = yap('button', 'v2-yogunluk');
        btn.type = 'button';
        btn.id = 'v2YogunlukBtn';
        btn.innerHTML =
            '<svg class="v2-yogunluk__ikon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">' +
            '  <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
            '  <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' +
            '<span class="v2-yogunluk__sayi" id="v2YogunlukSayi">—</span>';

        btn.addEventListener('click', function () {
            var sonraki = (yogunlukOku() + 1) % YOGUNLUK_ADLARI.length;
            yogunlukUygula(sonraki, true);
        });

        // Görünüm anahtarının soluna
        var anahtar = baslik.lastElementChild;
        baslik.insertBefore(btn, anahtar);

        yogunlukUygula(yogunlukOku(), false);

        // Ekran döndüğünde / pencere boyu değiştiğinde sayı güncel kalsın
        var zamanlayici;
        window.addEventListener('resize', function () {
            clearTimeout(zamanlayici);
            zamanlayici = setTimeout(yogunlukEtiketiTazele, 160);
        }, { passive: true });

        // Grid moduna girip çıkınca da: gizliyken sayı okunamıyor
        if ('MutationObserver' in window) {
            new MutationObserver(function () {
                requestAnimationFrame(yogunlukEtiketiTazele);
            }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }
    }

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
        }).join('') +
            '<span class="v2-legend__anahtar">Kart altı: <b>depo</b> · fark · <b>sistem</b></span>';

        grid.insertBefore(legend, grid.firstChild);
    }

    /**
     * Bir ürünün sayım durumunu kartın alt şeridine çevirir.
     *
     * Şerit üç bölmeli: SOL depo (elle sayılan), ORTA sonuç, SAĞ sistem.
     * Böylece stoklar çekildiği anda kart açmadan üç şeyi birden görüyorsun:
     * ne saydın, sistem ne diyor, arada ne var.
     */
    function farkEtiketi(cs, data) {
        var d = data || {};
        var varDepo = d.warehouseStock !== null && d.warehouseStock !== undefined;
        var varSistem = d.systemStock !== null && d.systemStock !== undefined;

        var depo = varDepo ? String(d.warehouseStock) : '·';
        var sistem = varSistem ? String(d.systemStock) : '·';

        if (!varDepo && !varSistem) return { depo: depo, orta: '—', sistem: sistem, sinif: 'bekleyen' };
        if (!varDepo || !varSistem) return { depo: depo, orta: '?', sistem: sistem, sinif: 'yarim' };

        var fark = cs.calculateDifference(d.warehouseStock, d.systemStock);
        if (fark.type === 'positive') return { depo: depo, orta: '+' + fark.value, sistem: sistem, sinif: 'fazla' };
        if (fark.type === 'negative') return { depo: depo, orta: '−' + fark.value, sistem: sistem, sinif: 'eksik' };
        return { depo: depo, orta: '✓', sistem: sistem, sinif: 'tam' };
    }

    /**
     * Grid kartlarının altına depo · fark · sistem şeridini yazar.
     *
     * counting.js'e dokunmamak için `renderRapidCountingMode`'u ÖRNEK ÜZERİNDE
     * sarmalıyoruz (dosya değişmiyor, v1 etkilenmiyor). Her render'dan sonra
     * yalnızca DEĞİŞEN şeritler yeniden yazılıyor; kartın son çocuğuna bakmak
     * O(1), değişiklik kontrolü de tek bir dizge karşılaştırması.
     */
    function farkEtiketleriniKur() {
        var cs = sistem();
        if (!cs || typeof cs.renderRapidCountingMode !== 'function' || cs.__v2DiffWrapped) return false;

        var orijinal = cs.renderRapidCountingMode.bind(cs);
        cs.__v2DiffWrapped = true;
        cs.renderRapidCountingMode = function () {
            orijinal();
            try { etiketleriYaz(); } catch (e) { /* şerit kozmetiktir, render'ı düşürmesin */ }
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

            var e = farkEtiketi(cs, cs.countingData[pid]);
            var imza = e.depo + '|' + e.orta + '|' + e.sistem + '|' + e.sinif;

            var serit = kart.lastElementChild;
            if (!serit || !serit.classList.contains('v2-diff')) {
                serit = yap('div', 'v2-diff');
                serit.innerHTML =
                    '<span class="v2-diff__yan v2-diff__depo"></span>' +
                    '<span class="v2-diff__orta"></span>' +
                    '<span class="v2-diff__yan v2-diff__sistem"></span>';
                kart.appendChild(serit);
            } else if (serit.dataset.imza === imza) {
                continue;
            }

            serit.className = 'v2-diff v2-diff--' + e.sinif;
            serit.dataset.imza = imza;
            serit.title = 'Depo ' + e.depo + ' · Sistem ' + e.sistem;
            serit.children[0].textContent = e.depo;
            serit.children[1].textContent = e.orta;
            serit.children[2].textContent = e.sistem;
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
            motoraBaglan();
            if (farkEtiketleriniKur() || deneme > 40) {
                clearInterval(t);
                ilerlemeyiTazele();
                durumuTazele();
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
        yogunlukUygula: yogunlukUygula,
        tokenAyikla: tokenAyikla
    };
})();
