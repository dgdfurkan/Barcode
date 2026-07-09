/**
 * Raftaki Eksikler — premium: raftakiEksikler
 */
class ShelfMissingApp {
    constructor() {
        this.shelves = [];
        this.items = [];
        this.allProducts = [];
        this.productIndex = new Map();
        this._username = null;
        this._ready = false;
        this._eventsBound = false;
        this._activeTab = 'shelves';
        this._activeShelfId = null;
        this._searchDebounce = null;
        this._neededTimers = new Map();
        this._neededPending = new Map();
        this._sortable = null;
        this._pickItemId = null;
        this._toastTimer = null;
        this._pendingCoverImage = undefined;
        this._lastSearchQuery = '';
        this._pendingDeleteItemId = null;
        this._pendingClearShelfId = undefined;
        this._modalOpenCount = 0;
        this._scrollLockY = 0;
    }

    async init() {
        this._bindEvents();
        this._bindVisibilityRefresh();

        const session = window.authUtils?.checkAuth();
        if (!session) {
            this._updateHeaderUser(null);
            this._show('noAuth');
            return;
        }
        this._username = session.username;
        this._updateHeaderUser(session);

        await this._waitForDb();

        try {
            if (window.premiumFeatures) await window.premiumFeatures.init();
        } catch (e) {
            console.error('Premium yüklenemedi:', e);
        }

        if (!window.premiumFeatures?.checkPremiumFeature('raftakiEksikler')) {
            try {
                await window.premiumFeatures?.loadPremiumFeatures();
            } catch (e) { /* ignore */ }
        }

        if (!window.premiumFeatures?.checkPremiumFeature('raftakiEksikler')) {
            this._show('noPremium');
            return;
        }

        this._ready = true;
        this._show('mainContent');
        this._updateChrome();

        await this._loadCatalog();
        await this.loadShelves();
        await this.loadItems();
        this._switchTab('shelves');
        this._updateBasketBadge();
        this._initViewPrefs();
    }

    async _waitForDb(maxWait = 10000) {
        if (typeof window.jetbarkodWaitForSupabase === 'function') {
            await window.jetbarkodWaitForSupabase(maxWait);
            return;
        }
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            if (window.supabase?.from) return;
            await new Promise((r) => setTimeout(r, 100));
        }
    }

    _bindVisibilityRefresh() {
        if (this._visibilityBound) return;
        this._visibilityBound = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' || !this._ready) return;
            void this._refreshFromServer();
        });
    }

    async _refreshFromServer() {
        await this._waitForDb(5000);
        await this.loadShelves();
        await this.loadItems();
    }

    _lsKey(suffix) {
        return `sm_${suffix}_${this._username || 'guest'}`;
    }

    _getLocal(key, fallback = null) {
        try {
            const v = localStorage.getItem(this._lsKey(key));
            return v == null ? fallback : v;
        } catch {
            return fallback;
        }
    }

    _setLocal(key, value) {
        try {
            if (value == null || value === '') localStorage.removeItem(this._lsKey(key));
            else localStorage.setItem(this._lsKey(key), String(value));
        } catch { /* ignore */ }
    }

    _getShelfIconUrl(shelfId) {
        return this._getLocal(`icon_${shelfId}`, null);
    }

    _setShelfIconUrl(shelfId, url) {
        this._setLocal(`icon_${shelfId}`, url || null);
    }

    _getShelfGridCols() {
        const n = parseInt(this._getLocal('shelf_grid_cols', '3'), 10);
        return [2, 3, 4].includes(n) ? n : 3;
    }

    _cycleShelfGridCols() {
        const order = [3, 4, 2];
        const cur = this._getShelfGridCols();
        const next = order[(order.indexOf(cur) + 1) % order.length];
        this._setLocal('shelf_grid_cols', String(next));
        this._applyShelfGridCols();
    }

    _getBasketLayout() {
        const v = this._getLocal('basket_layout', null);
        if (v === 'list' || v === 'grid-2' || v === 'grid-3' || v === 'grid-4') return v;
        const legacyView = this._getLocal('basket_view', 'list');
        if (legacyView === 'list') return 'list';
        const legacyCols = parseInt(this._getLocal('basket_grid_cols', '3'), 10);
        const cols = [2, 3, 4].includes(legacyCols) ? legacyCols : 3;
        return `grid-${cols}`;
    }

    _cycleBasketLayout() {
        const order = ['list', 'grid-3', 'grid-4', 'grid-2'];
        const cur = this._getBasketLayout();
        const idx = Math.max(0, order.indexOf(cur));
        const next = order[(idx + 1) % order.length];
        this._setLocal('basket_layout', next);
        this._applyBasketViewPrefs();
        if (this._activeTab === 'basket') this._renderBasket();
    }

    _gridIconSvg(cols) {
        const n = cols || 3;
        let rects = '';
        const size = 16;
        const pad = 1.5;
        const cell = (size - pad * (n + 1)) / n;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const x = pad + c * (cell + pad);
                const y = pad + r * (cell + pad);
                rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" rx="1" fill="currentColor"/>`;
            }
        }
        return `<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">${rects}</svg>`;
    }

    _listIconSvg() {
        return `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>`;
    }

    _initViewPrefs() {
        this._applyShelfGridCols();
        this._applyBasketViewPrefs();
    }

    _applyShelfGridCols() {
        const cols = this._getShelfGridCols();
        const grid = document.getElementById('shelfItemGrid');
        if (grid) {
            grid.classList.remove('sm-cols-2', 'sm-cols-3', 'sm-cols-4');
            grid.classList.add(`sm-cols-${cols}`);
        }
        const btn = document.getElementById('shelfGridColsBtn');
        const icon = document.getElementById('shelfGridColsIcon');
        if (btn) btn.title = `${cols} sütun`;
        if (icon) icon.innerHTML = this._gridIconSvg(cols);
    }

    _applyBasketViewPrefs() {
        const layout = this._getBasketLayout();
        const btn = document.getElementById('basketLayoutBtn');
        const icon = document.getElementById('basketLayoutIcon');
        if (layout === 'list') {
            if (icon) icon.innerHTML = this._listIconSvg();
            if (btn) {
                btn.title = 'Liste görünümü · tıkla: grid';
                btn.setAttribute('aria-label', btn.title);
            }
        } else {
            const cols = parseInt(layout.replace('grid-', ''), 10) || 3;
            if (icon) icon.innerHTML = this._gridIconSvg(cols);
            if (btn) {
                btn.title = `Grid: ${cols} sütun · tıkla: değiştir`;
                btn.setAttribute('aria-label', btn.title);
            }
        }
    }

    _allBarcodes(item) {
        const codes = Array.isArray(item?.barcodes) ? item.barcodes : [];
        return codes.map((b) => (typeof b === 'object' && b?.code ? b.code : String(b))).filter(Boolean);
    }

    _updateHeaderUser(session) {
        const nameEl = document.getElementById('headerUserName');
        const companyEl = document.getElementById('headerUserCompany');
        if (!session) {
            if (nameEl) nameEl.textContent = 'Misafir';
            if (companyEl) companyEl.textContent = '';
            return;
        }
        if (nameEl) nameEl.textContent = session.username || session.user_id || 'Kullanıcı';
        if (companyEl) companyEl.textContent = session.company || '';
    }

    _show(id) {
        ['noAuth', 'noPremium', 'mainContent'].forEach((k) => {
            const el = document.getElementById(k);
            if (el) el.classList.toggle('hidden', k !== id);
        });
    }

    _productId(p) {
        return p?.id || p?.productId || null;
    }

    _productName(p) {
        return p?.name || p?.productName || 'Ürün';
    }

    _productImage(p) {
        return p?.image || p?.imageUrl || '../assets/logo.png';
    }

    _normalizeBarcodes(p) {
        const raw = Array.isArray(p?.barcodes) ? p.barcodes : [];
        return raw.map((b) => (typeof b === 'object' && b?.code ? b.code : String(b))).filter(Boolean);
    }

    _firstBarcode(item) {
        const codes = Array.isArray(item?.barcodes) ? item.barcodes : [];
        if (!codes.length) return '';
        const first = codes[0];
        return typeof first === 'object' ? first.code || '' : String(first);
    }

    async _loadCatalog() {
        try {
            if (window.userDataManager) {
                await window.userDataManager.init();
                this.allProducts = window.userDataManager.getAllProducts(true) || [];
            }
            if ((!this.allProducts || !this.allProducts.length) && typeof PRODUCTS_DATA !== 'undefined') {
                this.allProducts = PRODUCTS_DATA.products || [];
            }
            this._rebuildProductIndex();
        } catch (e) {
            console.error('Katalog yüklenemedi:', e);
            this.allProducts = typeof PRODUCTS_DATA !== 'undefined' ? PRODUCTS_DATA.products || [] : [];
            this._rebuildProductIndex();
        }
    }

    _rebuildProductIndex() {
        this.productIndex = new Map();
        for (const p of this.allProducts || []) {
            const id = this._productId(p);
            if (id) this.productIndex.set(String(id), p);
        }
    }

    _normSearch(text) {
        return String(text || '')
            .toLocaleLowerCase('tr')
            .replace(/(\d)\s*(l|lt|litre|ml|g|kg|gr|gram)\b/gi, (_, n, u) => `${n}${String(u).charAt(0).toLowerCase()}`)
            .replace(/\s+/g, ' ')
            .trim();
    }

    _compactSearch(text) {
        return this._normSearch(text).replace(/\s/g, '');
    }

    _searchProducts(query, limit = 40) {
        const q = (query || '').trim();
        if (q.length < 2) return [];
        const tokens = this._normSearch(q).split(/\s+/).filter(Boolean);
        const scored = [];

        for (const p of this.allProducts || []) {
            const id = this._productId(p);
            if (!id) continue;

            const name = this._normSearch(this._productName(p));
            const nameCompact = name.replace(/\s/g, '');
            const barcodeStr = this._normalizeBarcodes(p).join(' ').toLocaleLowerCase('tr');
            const idStr = String(id).toLocaleLowerCase('tr');

            let score = 0;
            let allMatch = true;

            for (const token of tokens) {
                const tokenCompact = token.replace(/\s/g, '');
                const inName = name.includes(token) || nameCompact.includes(tokenCompact);
                const inBarcode = barcodeStr.includes(token);
                const inId = idStr.includes(token);

                if (!inName && !inBarcode && !inId) {
                    allMatch = false;
                    break;
                }

                if (name.includes(token)) score += 12;
                else if (nameCompact.includes(tokenCompact)) score += 10;
                else if (inBarcode) score += 4;
                else score += 1;

                if (name.startsWith(token)) score += 6;
                if (name.split(/\s+/).some((w) => w.startsWith(token))) score += 4;
            }

            if (allMatch) scored.push({ p, score });
        }

        scored.sort((a, b) => b.score - a.score || this._productName(a.p).localeCompare(this._productName(b.p), 'tr'));
        return scored.slice(0, limit).map((x) => x.p);
    }

    _itemOnShelf(shelfId, productId) {
        return this.items.find((i) => i.shelf_id === shelfId && String(i.product_id) === String(productId));
    }

    _shelfCoverUrl(shelf) {
        return this._getShelfIconUrl(shelf?.id) || null;
    }

    _shelfCoverHtml(shelf) {
        const url = this._shelfCoverUrl(shelf);
        if (url) {
            return `<div class="sm-shelf-icon-wrap sm-shelf-icon-wrap--img"><img src="${this._esc(url)}" alt="" loading="lazy" /></div>`;
        }
        return '<div class="sm-shelf-icon-wrap">📦</div>';
    }

    async loadShelves(retry = 0) {
        if (!this._username) return;
        if (!window.supabase?.from) {
            if (retry < 3) {
                await this._waitForDb(3000);
                return this.loadShelves(retry + 1);
            }
            this._toast('Veritabanı bağlantısı kurulamadı', 'error');
            return;
        }
        try {
            const { data, error } = await window.supabase
                .from('shelf_missing_shelves')
                .select('*')
                .eq('username', this._username)
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true });
            if (error) throw error;
            this.shelves = Array.isArray(data) ? data : [];
        } catch (e) {
            console.error('Raflar yüklenemedi:', e);
            this.shelves = [];
            this._toast('Raflar yüklenemedi', 'error');
        }
        this._renderShelvesView();
    }

    async loadItems(retry = 0) {
        if (!this._username) return;
        if (!window.supabase?.from) {
            if (retry < 3) {
                await this._waitForDb(3000);
                return this.loadItems(retry + 1);
            }
            this._toast('Ürünler yüklenemedi — bağlantı yok', 'error');
            return;
        }
        try {
            const { data, error } = await window.supabase
                .from('shelf_missing_items')
                .select('*')
                .eq('username', this._username)
                .order('sort_order', { ascending: true });
            if (error) throw error;
            this.items = Array.isArray(data) ? data : [];
        } catch (e) {
            console.error('Ürünler yüklenemedi:', e);
            this.items = [];
            this._toast('Ürünler yüklenemedi', 'error');
        }
        if (this._activeTab === 'basket') this._renderBasket();
        if (this._activeShelfId) this._renderShelfDetail();
        this._renderShelvesView();
        this._updateBasketBadge();
    }

    _shelfNeededSum(shelfId) {
        return this.items
            .filter((i) => i.shelf_id === shelfId)
            .reduce((sum, i) => sum + (Number(i.needed) || 0), 0);
    }

    _itemsForShelf(shelfId) {
        return this.items.filter((i) => i.shelf_id === shelfId);
    }

    _basketItems() {
        return this.items.filter((i) => (Number(i.needed) || 0) > 0);
    }

    _switchTab(tab) {
        this._activeTab = tab;
        document.querySelectorAll('[data-sm-tab]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.smTab === tab);
        });
        const shelvesPanel = document.getElementById('shelvesPanel');
        const basketPanel = document.getElementById('basketPanel');
        if (shelvesPanel) shelvesPanel.classList.toggle('hidden', tab !== 'shelves');
        if (basketPanel) basketPanel.classList.toggle('hidden', tab !== 'basket');

        if (tab === 'basket') {
            this._activeShelfId = null;
            this._hideShelfDetail();
            this._renderBasket();
        } else {
            this._renderShelvesView();
        }
        this._updateChrome();
    }

    _updateChrome() {
        const fab = document.getElementById('addShelfBtn');
        const onShelfList = this._ready && this._activeTab === 'shelves' && !this._activeShelfId;
        if (fab) fab.classList.toggle('hidden', !onShelfList);
    }

    _openNewShelfModal() {
        const input = document.getElementById('newShelfNameInput');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 120);
        }
        this._openModal('newShelfModal');
    }

    _updateSummaries() {
        const shelfSummary = document.getElementById('shelfListSummary');
        const basketSummary = document.getElementById('basketSummary');
        const totalNeeded = this._basketItems().reduce((s, i) => s + (Number(i.needed) || 0), 0);
        if (shelfSummary) {
            const n = this.shelves.length;
            shelfSummary.textContent = n === 0
                ? '0 raf'
                : `${n} raf${totalNeeded > 0 ? ` · ${totalNeeded} eksik` : ''}`;
        }
        if (basketSummary) {
            const count = this._basketItems().length;
            basketSummary.textContent = count === 0
                ? '0 eksik ürün'
                : `${count} ürün · ${totalNeeded} adet`;
        }
    }

    _renderShelvesView() {
        const grid = document.getElementById('shelfGrid');
        const empty = document.getElementById('shelfEmpty');
        if (!grid) return;

        if (!this.shelves.length) {
            grid.innerHTML = '';
            empty?.classList.remove('hidden');
            this._updateSummaries();
            return;
        }
        empty?.classList.add('hidden');

        const cards = this.shelves.map((s) => {
            const needed = this._shelfNeededSum(s.id);
            const count = this._itemsForShelf(s.id).length;
            const badge = needed > 0 ? `<span class="sm-shelf-badge">${needed}</span>` : '';
            return `
                <button type="button" class="sm-shelf-card" data-shelf-id="${this._esc(s.id)}" aria-label="${this._esc(s.name)}">
                    ${this._shelfCoverHtml(s)}
                    <p class="sm-shelf-name">${this._esc(s.name)}</p>
                    <p class="sm-shelf-meta">${count} ürün${needed > 0 ? ' · ' + needed + ' eksik' : ''}</p>
                    ${badge}
                </button>`;
        }).join('');

        grid.innerHTML = cards + `
            <button type="button" class="sm-add-shelf-card" id="gridAddShelfBtn" aria-label="Yeni raf ekle">
                <div class="sm-add-shelf-plus">+</div>
                <span class="sm-add-shelf-label">Yeni Raf</span>
            </button>`;
        this._updateSummaries();
    }

    _openShelfDetail(shelfId) {
        this._activeShelfId = shelfId;
        const shelf = this.shelves.find((s) => s.id === shelfId);
        const title = document.getElementById('shelfDetailTitle');
        if (title && shelf) title.textContent = shelf.name;

        const listView = document.getElementById('shelfListView');
        const detailView = document.getElementById('shelfDetailView');
        listView?.classList.add('hidden');
        detailView?.classList.remove('hidden');

        const search = document.getElementById('shelfProductSearch');
        if (search) search.value = '';
        document.getElementById('shelfSearchResults')?.replaceChildren();

        this._renderShelfDetail();
        this._applyShelfGridCols();
        this._updateChrome();
    }

    _hideShelfDetail() {
        this._activeShelfId = null;
        document.getElementById('shelfListView')?.classList.remove('hidden');
        document.getElementById('shelfDetailView')?.classList.add('hidden');
        this._destroySortable();
        this._updateChrome();
    }

    _renderShelfDetail() {
        const grid = document.getElementById('shelfItemGrid');
        if (!grid || !this._activeShelfId) return;

        const items = this._itemsForShelf(this._activeShelfId);
        if (!items.length) {
            grid.innerHTML = '<p class="sm-detail-empty">Bu rafta henüz ürün yok. Yukarıdan arayıp ekleyin.</p>';
            this._destroySortable();
            return;
        }

        grid.innerHTML = items.map((item) => this._renderItemCard(item)).join('');
        this._initSortable(grid);
    }

    _renderItemCard(item) {
        const needed = Number(item.needed) || 0;
        const img = this._esc(item.product_image || '../assets/logo.png');
        const name = this._esc(item.product_name || 'Ürün');
        const neededClass = needed > 0 ? ' has-needed' : '';
        const neededLabel = needed > 0
            ? `<p class="sm-item-needed-label">${needed} eksik</p>`
            : '<p class="sm-item-needed-label is-ok">Stokta var</p>';
        return `
            <div class="sm-item-card${neededClass}" data-item-id="${this._esc(item.id)}" draggable="false">
                <button type="button" class="sm-item-delete" data-delete-item="${this._esc(item.id)}" aria-label="Raftan kaldır" title="Kaldır">
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <img src="${img}" alt="" class="sm-item-img" loading="lazy" data-preview-item="${this._esc(item.id)}" role="button" tabindex="0" />
                <p class="sm-item-name" title="${name}">${name}</p>
                <div class="sm-item-card-footer">
                    ${neededLabel}
                    <div class="sm-stepper">
                        <button type="button" class="sm-stepper-btn" data-action="dec" data-item-id="${this._esc(item.id)}" aria-label="Azalt">−</button>
                        <span class="sm-stepper-val">${needed}</span>
                        <button type="button" class="sm-stepper-btn" data-action="inc" data-item-id="${this._esc(item.id)}" aria-label="Artır">+</button>
                    </div>
                    <button type="button" class="sm-item-drag-handle" aria-label="Sıralamak için sürükle" title="Sürükle">
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                    </button>
                </div>
            </div>`;
    }

    _renderBasket() {
        const container = document.getElementById('basketGroups');
        const empty = document.getElementById('basketEmpty');
        if (!container) return;

        const basket = this._basketItems();
        const clearBtn = document.getElementById('basketClearBtn');
        if (!basket.length) {
            container.innerHTML = '';
            empty?.classList.remove('hidden');
            if (clearBtn) clearBtn.classList.add('hidden');
            this._updateSummaries();
            return;
        }
        empty?.classList.add('hidden');
        if (clearBtn) clearBtn.classList.remove('hidden');

        const layout = this._getBasketLayout();
        const viewMode = layout === 'list' ? 'list' : 'grid';
        const gridCols = layout === 'list' ? 3 : (parseInt(layout.replace('grid-', ''), 10) || 3);
        const byShelf = new Map();
        for (const item of basket) {
            if (!byShelf.has(item.shelf_id)) byShelf.set(item.shelf_id, []);
            byShelf.get(item.shelf_id).push(item);
        }

        const html = [];
        for (const [shelfId, items] of byShelf) {
            const shelf = this.shelves.find((s) => s.id === shelfId);
            const shelfName = shelf?.name || 'Raf';
            const rows = items.map((item) => {
                if (viewMode === 'grid') return this._renderBasketCard(item);
                return this._renderBasketRow(item);
            }).join('');

            const rowsClass = viewMode === 'grid'
                ? `sm-basket-rows sm-basket-grid sm-cols-${gridCols}`
                : 'sm-basket-rows';

            html.push(`
                <section class="sm-basket-section">
                    <div class="sm-basket-section-head">
                        <h3 class="sm-basket-section-title">${this._esc(shelfName)}</h3>
                    </div>
                    <div class="${rowsClass}">${rows}</div>
                </section>`);
        }
        container.innerHTML = html.join('');
        this._applyBasketViewPrefs();
        this._updateSummaries();
    }

    _renderBasketRow(item) {
        const needed = Number(item.needed) || 0;
        const img = this._esc(item.product_image || '../assets/logo.png');
        const name = this._esc(item.product_name || 'Ürün');
        const barcode = this._esc(this._firstBarcode(item));
        return `
            <div class="sm-basket-row" data-item-id="${this._esc(item.id)}">
                <img src="${img}" alt="" class="sm-basket-img" loading="lazy" data-preview-item="${this._esc(item.id)}" role="button" tabindex="0" />
                <div class="sm-basket-info">
                    <p class="sm-basket-name" title="${name}">${name}</p>
                    ${barcode ? `<p class="sm-basket-barcode">${barcode}</p>` : ''}
                </div>
                <div class="sm-basket-inline">
                    <span class="sm-basket-qty">×${needed}</span>
                    <div class="sm-stepper sm-stepper--mini">
                        <button type="button" class="sm-stepper-btn" data-action="dec" data-item-id="${this._esc(item.id)}" aria-label="Azalt">−</button>
                        <button type="button" class="sm-stepper-btn" data-action="inc" data-item-id="${this._esc(item.id)}" aria-label="Artır">+</button>
                    </div>
                    <button type="button" class="sm-pick-btn" data-pick-id="${this._esc(item.id)}" aria-label="Aldım" title="Aldım">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    </button>
                </div>
            </div>`;
    }

    _renderBasketCard(item) {
        const needed = Number(item.needed) || 0;
        const img = this._esc(item.product_image || '../assets/logo.png');
        const name = this._esc(item.product_name || 'Ürün');
        return `
            <div class="sm-basket-card" data-item-id="${this._esc(item.id)}">
                <img src="${img}" alt="" class="sm-basket-img" loading="lazy" data-preview-item="${this._esc(item.id)}" role="button" tabindex="0" />
                <p class="sm-basket-name" title="${name}">${name}</p>
                <div class="sm-basket-inline">
                    <span class="sm-basket-qty">×${needed}</span>
                    <div class="sm-stepper sm-stepper--mini">
                        <button type="button" class="sm-stepper-btn" data-action="dec" data-item-id="${this._esc(item.id)}" aria-label="Azalt">−</button>
                        <button type="button" class="sm-stepper-btn" data-action="inc" data-item-id="${this._esc(item.id)}" aria-label="Artır">+</button>
                    </div>
                    <button type="button" class="sm-pick-btn" data-pick-id="${this._esc(item.id)}" aria-label="Aldım" title="Aldım">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    </button>
                </div>
            </div>`;
    }

    _updateBasketBadge() {
        const total = this._basketItems().reduce((s, i) => s + (Number(i.needed) || 0), 0);
        const badge = document.getElementById('basketTabBadge');
        const mobileBadges = document.querySelectorAll('.basket-mobile-badge');
        const show = total > 0;
        if (badge) {
            badge.textContent = String(total);
            badge.classList.toggle('hidden', !show);
        }
        mobileBadges.forEach((el) => {
            el.textContent = String(total);
            el.classList.toggle('hidden', !show);
        });
    }

    async createShelf(name) {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            this._toast('Raf adı girin', 'warning');
            return false;
        }
        if (!window.supabase || !this._username) return false;

        const maxOrder = this.shelves.reduce((m, s) => Math.max(m, s.sort_order || 0), -1);
        try {
            const { data, error } = await window.supabase
                .from('shelf_missing_shelves')
                .insert({ username: this._username, name: trimmed, sort_order: maxOrder + 1 })
                .select('*')
                .maybeSingle();
            if (error) throw error;
            if (data) this.shelves.push(data);
            this._renderShelvesView();
            this._toast('Raf oluşturuldu', 'success');
            return true;
        } catch (e) {
            console.error('Raf oluşturulamadı:', e);
            this._toast(e.message?.includes('unique') ? 'Bu isimde raf zaten var' : 'Raf oluşturulamadı', 'error');
            return false;
        }
    }

    async saveShelfEdit(shelfId, name) {
        const trimmed = (name || '').trim();
        if (!trimmed || !window.supabase) return false;
        try {
            const { error } = await window.supabase
                .from('shelf_missing_shelves')
                .update({ name: trimmed })
                .eq('id', shelfId)
                .eq('username', this._username);
            if (error) throw error;
            const shelf = this.shelves.find((s) => s.id === shelfId);
            if (shelf) shelf.name = trimmed;
            if (this._pendingCoverImage !== undefined) {
                this._setShelfIconUrl(shelfId, this._pendingCoverImage || null);
            }
            const title = document.getElementById('shelfDetailTitle');
            if (title && this._activeShelfId === shelfId) title.textContent = trimmed;
            this._renderShelvesView();
            if (this._activeTab === 'basket') this._renderBasket();
            this._toast('Raf güncellendi', 'success');
            return true;
        } catch (e) {
            console.error('Raf güncellenemedi:', e);
            this._toast(e.message?.includes('unique') ? 'Bu isimde raf zaten var' : 'Raf güncellenemedi', 'error');
            return false;
        }
    }

    async renameShelf(shelfId, newName) {
        return this.saveShelfEdit(shelfId, newName);
    }

    _requestDeleteItem(itemId) {
        const item = this.items.find((i) => i.id === itemId);
        if (!item) return;
        this._pendingDeleteItemId = itemId;
        const nameEl = document.getElementById('deleteItemName');
        if (nameEl) nameEl.textContent = item.product_name || 'Ürün';
        this._openModal('deleteItemModal');
    }

    async _executeDeleteItem(itemId) {
        const item = this.items.find((i) => i.id === itemId);
        if (!item || !window.supabase) return false;

        const productId = String(item.product_id);
        const shelfId = item.shelf_id;
        const snapshot = { ...item };
        const iconUrl = this._getShelfIconUrl(shelfId);

        this.items = this.items.filter((i) => i.id !== itemId);
        if (iconUrl && iconUrl === item.product_image) {
            this._setShelfIconUrl(shelfId, null);
        }
        this._patchSearchHit(productId, false);
        if (this._activeShelfId) this._renderShelfDetail();
        this._renderShelvesView();
        if (this._activeTab === 'basket') this._renderBasket();
        this._updateBasketBadge();

        try {
            const { error } = await window.supabase
                .from('shelf_missing_items')
                .delete()
                .eq('id', itemId)
                .eq('username', this._username);
            if (error) throw error;
            this._toast('Ürün raftan kaldırıldı', 'success');
            return true;
        } catch (e) {
            console.error('Ürün silinemedi:', e);
            this.items.push(snapshot);
            this._patchSearchHit(productId, true);
            if (iconUrl && iconUrl === snapshot.product_image) {
                this._setShelfIconUrl(shelfId, iconUrl);
            }
            if (this._activeShelfId) this._renderShelfDetail();
            this._renderShelvesView();
            if (this._activeTab === 'basket') this._renderBasket();
            this._updateBasketBadge();
            this._toast('Ürün kaldırılamadı', 'error');
            return false;
        }
    }

    async deleteItem(itemId) {
        this._requestDeleteItem(itemId);
        return false;
    }

    async toggleProductOnShelf(product) {
        if (!this._activeShelfId) return;
        const productId = String(this._productId(product));
        const existing = this._itemOnShelf(this._activeShelfId, productId);
        if (existing) {
            this._requestDeleteItem(existing.id);
            return;
        }
        this._patchSearchHit(productId, true);
        await this.upsertItem(this._activeShelfId, product, { skipSearchPatch: true });
    }

    async deleteShelf(shelfId) {
        if (!window.supabase) return false;
        try {
            const { error } = await window.supabase
                .from('shelf_missing_shelves')
                .delete()
                .eq('id', shelfId)
                .eq('username', this._username);
            if (error) throw error;
            this._setShelfIconUrl(shelfId, null);
            this.shelves = this.shelves.filter((s) => s.id !== shelfId);
            this.items = this.items.filter((i) => i.shelf_id !== shelfId);
            if (this._activeShelfId === shelfId) this._hideShelfDetail();
            this._renderShelvesView();
            if (this._activeTab === 'basket') this._renderBasket();
            this._updateBasketBadge();
            this._toast('Raf silindi', 'success');
            return true;
        } catch (e) {
            this._toast('Raf silinemedi', 'error');
            return false;
        }
    }

    async upsertItem(shelfId, product, opts = {}) {
        const productId = String(this._productId(product));
        if (!productId || !window.supabase) return;

        const existing = this.items.find((i) => i.shelf_id === shelfId && i.product_id === productId);
        if (existing) {
            this._toast('Ürün zaten bu rafta', 'warning');
            return;
        }

        if (!opts.skipSearchPatch) this._patchSearchHit(productId, true);

        const maxOrder = this._itemsForShelf(shelfId).reduce((m, i) => Math.max(m, i.sort_order || 0), -1);
        const tempId = `opt-${Date.now()}`;
        const optimistic = {
            id: tempId,
            username: this._username,
            shelf_id: shelfId,
            product_id: productId,
            product_name: this._productName(product),
            product_image: this._productImage(product),
            barcodes: this._normalizeBarcodes(product),
            sort_order: maxOrder + 1,
            needed: 0
        };
        this.items.push(optimistic);
        this._renderShelfDetail();
        this._renderShelvesView();

        const row = {
            username: this._username,
            shelf_id: shelfId,
            product_id: productId,
            product_name: optimistic.product_name,
            product_image: optimistic.product_image,
            barcodes: optimistic.barcodes,
            sort_order: optimistic.sort_order,
            needed: 0
        };

        try {
            const { data, error } = await window.supabase
                .from('shelf_missing_items')
                .insert(row)
                .select('*')
                .maybeSingle();
            if (error) throw error;
            this.items = this.items.filter((i) => i.id !== tempId);
            if (data) this.items.push(data);
            this._renderShelfDetail();
            this._renderShelvesView();
            if (!opts.silent) this._toast('Ürün eklendi', 'success');
        } catch (e) {
            console.error('Ürün eklenemedi:', e);
            this.items = this.items.filter((i) => i.id !== tempId);
            this._patchSearchHit(productId, false);
            this._renderShelfDetail();
            this._renderShelvesView();
            this._toast('Ürün eklenemedi', 'error');
        }
    }

    _patchShelfBadges() {
        for (const s of this.shelves) {
            const needed = this._shelfNeededSum(s.id);
            const card = document.querySelector(`[data-shelf-id="${CSS.escape(String(s.id))}"]`);
            if (!card) continue;
            let badge = card.querySelector('.sm-shelf-badge');
            if (needed > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'sm-shelf-badge';
                    card.appendChild(badge);
                }
                badge.textContent = String(needed);
            } else if (badge) {
                badge.remove();
            }
            const meta = card.querySelector('.sm-shelf-meta');
            if (meta) {
                const count = this._itemsForShelf(s.id).length;
                meta.textContent = `${count} ürün${needed > 0 ? ` · ${needed} eksik` : ''}`;
            }
        }
        this._updateSummaries();
        this._updateBasketBadge();
    }

    _patchItemNeeded(itemId) {
        const item = this.items.find((i) => i.id === itemId);
        if (!item) return;
        const needed = Number(item.needed) || 0;
        const sel = `[data-item-id="${CSS.escape(String(itemId))}"]`;
        document.querySelectorAll(sel).forEach((el) => {
            if (el.classList.contains('sm-item-card')) {
                el.classList.toggle('has-needed', needed > 0);
                const label = el.querySelector('.sm-item-needed-label');
                if (label) {
                    label.classList.toggle('is-ok', needed === 0);
                    label.textContent = needed > 0 ? `${needed} eksik` : 'Stokta var';
                }
            }
            const val = el.querySelector('.sm-stepper-val');
            if (val) val.textContent = String(needed);
            const qty = el.querySelector('.sm-basket-qty');
            if (qty) qty.textContent = `×${needed}`;
        });
        this._patchShelfBadges();
    }

    setNeeded(itemId, delta) {
        const item = this.items.find((i) => i.id === itemId);
        if (!item) return;

        const prev = Number(item.needed) || 0;
        const next = Math.max(0, prev + delta);
        if (next === prev) return;

        item.needed = next;

        const leftBasket = prev > 0 && next === 0;
        const enteredBasket = prev === 0 && next > 0;

        if (leftBasket || enteredBasket) {
            if (this._activeShelfId) this._renderShelfDetail();
            if (this._activeTab === 'basket') this._renderBasket();
            else this._patchShelfBadges();
        } else {
            this._patchItemNeeded(itemId);
        }

        this._neededPending.set(itemId, next);
        clearTimeout(this._neededTimers.get(itemId));
        this._neededTimers.set(itemId, setTimeout(() => this._flushNeeded(itemId, prev), 300));
    }

    async _flushNeeded(itemId, rollbackValue) {
        const needed = this._neededPending.get(itemId);
        this._neededPending.delete(itemId);
        if (needed === undefined || !window.supabase) return;

        try {
            const { error } = await window.supabase
                .from('shelf_missing_items')
                .update({ needed })
                .eq('id', itemId)
                .eq('username', this._username);
            if (error) throw error;
        } catch (e) {
            const item = this.items.find((i) => i.id === itemId);
            if (item) item.needed = rollbackValue;
            if (this._activeShelfId) this._renderShelfDetail();
            if (this._activeTab === 'basket') this._renderBasket();
            this._renderShelvesView();
            this._updateBasketBadge();
            this._toast('Kaydedilemedi', 'error');
        }
    }

    openPickModal(itemId) {
        const item = this.items.find((i) => i.id === itemId);
        if (!item) return;
        this._pickItemId = itemId;
        const max = Number(item.needed) || 0;
        const nameEl = document.getElementById('pickProductName');
        const imgEl = document.getElementById('pickProductImg');
        const qtyEl = document.getElementById('pickQtyInput');
        const maxEl = document.getElementById('pickQtyMax');
        if (nameEl) nameEl.textContent = item.product_name || 'Ürün';
        if (imgEl) imgEl.src = item.product_image || '../assets/logo.png';
        if (qtyEl) {
            qtyEl.value = String(max);
            qtyEl.max = String(max);
            qtyEl.min = '1';
        }
        if (maxEl) maxEl.textContent = String(max);
        this._openModal('pickModal');
    }

    async markPicked(qty) {
        const itemId = this._pickItemId;
        const item = this.items.find((i) => i.id === itemId);
        if (!item) return;

        const max = Number(item.needed) || 0;
        let n = parseInt(qty, 10);
        if (!Number.isFinite(n) || n < 1) n = max;
        if (n > max) n = max;

        const prev = max;
        const next = Math.max(0, prev - n);
        item.needed = next;

        this._closeModal('pickModal');
        if (this._activeShelfId) this._renderShelfDetail();
        if (this._activeTab === 'basket') this._renderBasket();
        this._renderShelvesView();
        this._updateBasketBadge();

        try {
            const { error } = await window.supabase
                .from('shelf_missing_items')
                .update({ needed: next })
                .eq('id', itemId)
                .eq('username', this._username);
            if (error) throw error;
            this._toast(n >= prev ? 'Tamamlandı' : `${n} adet alındı`, 'success');
        } catch (e) {
            item.needed = prev;
            if (this._activeShelfId) this._renderShelfDetail();
            if (this._activeTab === 'basket') this._renderBasket();
            this._renderShelvesView();
            this._updateBasketBadge();
            this._toast('Kaydedilemedi', 'error');
        }
    }

    async reorderItems(shelfId, orderedIds) {
        if (!window.supabase) return;
        const updates = orderedIds.map((id, idx) => {
            const item = this.items.find((i) => i.id === id);
            if (item) item.sort_order = idx;
            return window.supabase
                .from('shelf_missing_items')
                .update({ sort_order: idx })
                .eq('id', id)
                .eq('username', this._username);
        });
        try {
            await Promise.all(updates);
        } catch (e) {
            console.error('Sıralama kaydedilemedi:', e);
            await this.loadItems();
        }
    }

    _initSortable(grid) {
        this._destroySortable();
        if (typeof Sortable === 'undefined' || !this._activeShelfId) return;
        this._sortable = Sortable.create(grid, {
            animation: 150,
            draggable: '.sm-item-card',
            handle: '.sm-item-drag-handle',
            ghostClass: 'sm-sort-ghost',
            chosenClass: 'sm-sort-chosen',
            delay: 120,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            forceFallback: false,
            onEnd: () => {
                const ids = [...grid.querySelectorAll('.sm-item-card')].map((el) => el.dataset.itemId);
                void this.reorderItems(this._activeShelfId, ids);
            }
        });
    }

    _destroySortable() {
        if (this._sortable) {
            this._sortable.destroy();
            this._sortable = null;
        }
    }

    _searchActionHtml(onShelf) {
        return onShelf
            ? '<span class="sm-search-action sm-search-action--remove">✓ Rafta</span>'
            : '<span class="sm-search-action sm-search-action--add">+ Ekle</span>';
    }

    _patchSearchHit(productId, onShelf) {
        const box = document.getElementById('shelfSearchResults');
        if (!box) return;
        const hit = box.querySelector(`[data-product-id="${CSS.escape(String(productId))}"]`);
        if (!hit) return;
        hit.classList.toggle('is-on-shelf', onShelf);
        let action = hit.querySelector('.sm-search-action');
        if (!action) {
            action = document.createElement('span');
            hit.appendChild(action);
        }
        action.className = onShelf
            ? 'sm-search-action sm-search-action--remove'
            : 'sm-search-action sm-search-action--add';
        action.textContent = onShelf ? '✓ Rafta' : '+ Ekle';
    }

    _renderSearchResults(query) {
        this._lastSearchQuery = query || '';
        const box = document.getElementById('shelfSearchResults');
        if (!box || !this._activeShelfId) return;
        const hits = this._searchProducts(query);
        if (!hits.length) {
            box.innerHTML = query.length >= 2
                ? '<p class="sm-search-empty">Sonuç bulunamadı</p>'
                : '';
            return;
        }
        box.innerHTML = hits.map((p) => {
            const id = this._esc(this._productId(p));
            const onShelf = !!this._itemOnShelf(this._activeShelfId, this._productId(p));
            return `
                <button type="button" class="sm-search-hit${onShelf ? ' is-on-shelf' : ''}" data-product-id="${id}">
                    <img src="${this._esc(this._productImage(p))}" alt="" class="sm-search-img" loading="lazy" />
                    <span class="sm-search-name">${this._esc(this._productName(p))}</span>
                    ${this._searchActionHtml(onShelf)}
                </button>`;
        }).join('');
    }

    _renderPreviewBarcodeRow(code, index) {
        const esc = this._esc(code);
        return `
            <div class="sm-preview-barcode-row">
                <div class="sm-preview-barcode-strip">
                    <svg class="sm-preview-barcode-svg" data-barcode-index="${index}" role="img" aria-label="Barkod ${esc}"></svg>
                </div>
                <div class="sm-preview-barcode-foot">
                    <span class="sm-preview-barcode-code">${esc}</span>
                    <button type="button" class="sm-preview-barcode-copy" data-copy-barcode="${esc}" aria-label="Barkodu kopyala" title="Kopyala">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                </div>
            </div>`;
    }

    _drawPreviewBarcodes(codes) {
        if (typeof JsBarcode === 'undefined') return;
        const box = document.getElementById('productPreviewBarcodes');
        if (!box) return;
        box.querySelectorAll('.sm-preview-barcode-svg').forEach((svg, i) => {
            const code = codes[i];
            if (!code) return;
            const digits = String(code).replace(/\D/g, '');
            try {
                if (digits.length === 12 || digits.length === 13) {
                    JsBarcode(svg, digits.length === 12 ? `0${digits}` : digits, {
                        format: 'EAN13',
                        lineColor: '#0f172a',
                        width: 1.5,
                        height: 44,
                        displayValue: false,
                        margin: 2
                    });
                } else {
                    JsBarcode(svg, String(code), {
                        format: 'CODE128',
                        lineColor: '#0f172a',
                        width: 1.4,
                        height: 44,
                        displayValue: false,
                        margin: 2
                    });
                }
            } catch (e) {
                console.warn('Barkod çizilemedi:', code, e);
            }
        });
    }

    _openProductPreview(itemId) {
        const item = this.items.find((i) => i.id === itemId);
        if (!item) return;
        const imgEl = document.getElementById('productPreviewImg');
        const nameEl = document.getElementById('productPreviewName');
        const barcodesEl = document.getElementById('productPreviewBarcodes');
        if (imgEl) imgEl.src = item.product_image || '../assets/logo.png';
        if (nameEl) nameEl.textContent = item.product_name || 'Ürün';
        const codes = this._allBarcodes(item);
        if (barcodesEl) {
            barcodesEl.innerHTML = codes.length
                ? codes.map((c, i) => this._renderPreviewBarcodeRow(c, i)).join('')
                : '<p class="sm-preview-empty">Kayıtlı barkod yok</p>';
        }
        this._openModal('productPreviewModal');
        requestAnimationFrame(() => this._drawPreviewBarcodes(codes));
    }

    _renderCoverPicker(shelfId) {
        const picker = document.getElementById('editShelfCoverPicker');
        if (!picker) return;
        const shelf = this.shelves.find((s) => s.id === shelfId);
        const items = this._itemsForShelf(shelfId);
        const selected = this._pendingCoverImage !== undefined
            ? this._pendingCoverImage
            : this._getShelfIconUrl(shelfId);

        let html = `<button type="button" class="sm-cover-option sm-cover-option--default${!selected ? ' is-selected' : ''}" data-cover="" title="Varsayılan">📦</button>`;
        const seen = new Set();
        for (const item of items) {
            const url = item.product_image;
            if (!url || seen.has(url)) continue;
            seen.add(url);
            html += `<button type="button" class="sm-cover-option${selected === url ? ' is-selected' : ''}" data-cover="${this._esc(url)}" title="İkon yap"><img src="${this._esc(url)}" alt="" loading="lazy" /></button>`;
        }
        if (!items.length) {
            html += '<p class="text-xs text-slate-500 w-full">Kapak için önce rafa ürün ekleyin.</p>';
        }
        picker.innerHTML = html;
    }

    _openEditShelfModal() {
        const shelf = this.shelves.find((s) => s.id === this._activeShelfId);
        const input = document.getElementById('editShelfNameInput');
        if (input && shelf) input.value = shelf.name;
        this._pendingCoverImage = this._getShelfIconUrl(this._activeShelfId);
        this._renderCoverPicker(this._activeShelfId);
        this._openModal('editShelfModal');
    }

    _openClearBasketModal() {
        const basket = this._basketItems();
        if (!basket.length) {
            this._toast('Sepet zaten boş', 'warning');
            return;
        }
        const byShelf = new Map();
        for (const item of basket) {
            if (!byShelf.has(item.shelf_id)) byShelf.set(item.shelf_id, []);
            byShelf.get(item.shelf_id).push(item);
        }
        const list = document.getElementById('clearBasketShelfList');
        if (list) {
            const rows = [];
            for (const [shelfId, items] of byShelf) {
                const shelf = this.shelves.find((s) => s.id === shelfId);
                const name = shelf?.name || 'Raf';
                const qty = items.reduce((s, i) => s + (Number(i.needed) || 0), 0);
                rows.push(`
                    <button type="button" class="sm-clear-shelf-opt" data-clear-shelf="${this._esc(shelfId)}">
                        ${this._esc(name)}
                        <span>${items.length} ürün · ${qty} adet</span>
                    </button>`);
            }
            list.innerHTML = rows.join('');
        }
        this._openModal('clearBasketModal');
    }

    _requestClearBasketConfirm(shelfId = null) {
        const targets = shelfId
            ? this.items.filter((i) => i.shelf_id === shelfId && (Number(i.needed) || 0) > 0)
            : this._basketItems();
        if (!targets.length) {
            this._toast('Sepet zaten boş', 'warning');
            return;
        }

        const productCount = targets.length;
        const qty = targets.reduce((s, i) => s + (Number(i.needed) || 0), 0);
        const shelfName = shelfId
            ? (this.shelves.find((s) => s.id === shelfId)?.name || 'Raf')
            : null;
        const label = shelfName
            ? `${shelfName} rafı sepetindeki ${productCount} ürün (${qty} adet) temizlenecek.`
            : `Tüm sepetteki ${productCount} ürün (${qty} adet) temizlenecek.`;

        this._pendingClearShelfId = shelfId;
        const labelEl = document.getElementById('clearBasketConfirmLabel');
        if (labelEl) labelEl.textContent = label;

        this._closeModal('clearBasketModal');
        this._openModal('clearBasketConfirmModal');
    }

    async clearBasketNeeded(shelfId = null) {
        const targets = shelfId
            ? this.items.filter((i) => i.shelf_id === shelfId && (Number(i.needed) || 0) > 0)
            : this._basketItems();
        if (!targets.length) return;

        const prev = new Map(targets.map((i) => [i.id, Number(i.needed) || 0]));
        for (const item of targets) item.needed = 0;

        this._closeModal('clearBasketConfirmModal');
        if (this._activeShelfId) this._renderShelfDetail();
        this._renderShelvesView();
        if (this._activeTab === 'basket') this._renderBasket();
        this._updateBasketBadge();
        this._patchShelfBadges();

        if (!window.supabase) return;

        try {
            await Promise.all(targets.map((item) =>
                window.supabase
                    .from('shelf_missing_items')
                    .update({ needed: 0 })
                    .eq('id', item.id)
                    .eq('username', this._username)
            ));
            const label = shelfId
                ? (this.shelves.find((s) => s.id === shelfId)?.name || 'Raf')
                : 'Sepet';
            this._toast(shelfId ? `${label} sepeti temizlendi` : 'Sepet temizlendi', 'success');
        } catch (e) {
            console.error('Sepet temizlenemedi:', e);
            for (const item of targets) {
                const p = prev.get(item.id);
                if (p !== undefined) item.needed = p;
            }
            if (this._activeShelfId) this._renderShelfDetail();
            this._renderShelvesView();
            if (this._activeTab === 'basket') this._renderBasket();
            this._updateBasketBadge();
            this._patchShelfBadges();
            this._toast('Sepet temizlenemedi', 'error');
        }
    }

    _lockBodyScroll() {
        this._modalOpenCount += 1;
        if (this._modalOpenCount !== 1) return;
        this._scrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
        document.body.classList.add('sm-modal-locked');
        document.body.style.top = `-${this._scrollLockY}px`;
    }

    _unlockBodyScroll() {
        this._modalOpenCount = Math.max(0, this._modalOpenCount - 1);
        if (this._modalOpenCount !== 0) return;
        document.body.classList.remove('sm-modal-locked');
        document.body.style.top = '';
        window.scrollTo(0, this._scrollLockY || 0);
    }

    _syncScrollLock() {
        const openCount = document.querySelectorAll('.sm-modal-backdrop.sm-modal-open').length;
        if (openCount === 0 && this._modalOpenCount > 0) {
            this._modalOpenCount = 1;
            this._unlockBodyScroll();
        }
    }

    _openModal(id) {
        const el = document.getElementById(id);
        if (!el || el.classList.contains('sm-modal-open')) return;
        el.classList.add('sm-modal-open');
        el.setAttribute('aria-hidden', 'false');
        this._lockBodyScroll();
    }

    _closeModal(id) {
        const el = document.getElementById(id);
        if (!el || !el.classList.contains('sm-modal-open')) return;
        el.classList.remove('sm-modal-open');
        el.setAttribute('aria-hidden', 'true');
        this._unlockBodyScroll();
    }

    _bindEvents() {
        if (this._eventsBound) return;
        this._eventsBound = true;

        document.querySelectorAll('[data-sm-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (!this._ready) return;
                this._switchTab(btn.dataset.smTab);
            });
        });

        document.getElementById('addShelfBtn')?.addEventListener('click', () => this._openNewShelfModal());
        document.getElementById('listAddShelfBtn')?.addEventListener('click', () => this._openNewShelfModal());
        document.getElementById('emptyAddShelfBtn')?.addEventListener('click', () => this._openNewShelfModal());
        document.getElementById('basketGoShelvesBtn')?.addEventListener('click', () => this._switchTab('shelves'));

        document.getElementById('newShelfNameInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('newShelfSave')?.click();
        });
        document.getElementById('newShelfClose')?.addEventListener('click', () => this._closeModal('newShelfModal'));
        document.getElementById('newShelfCancel')?.addEventListener('click', () => this._closeModal('newShelfModal'));
        document.getElementById('newShelfSave')?.addEventListener('click', async () => {
            const input = document.getElementById('newShelfNameInput');
            const ok = await this.createShelf(input?.value);
            if (ok) {
                if (input) input.value = '';
                this._closeModal('newShelfModal');
            }
        });

        document.getElementById('shelfGrid')?.addEventListener('click', (e) => {
            if (e.target.closest('#gridAddShelfBtn')) {
                this._openNewShelfModal();
                return;
            }
            const card = e.target.closest('[data-shelf-id]');
            if (card?.dataset.shelfId) this._openShelfDetail(card.dataset.shelfId);
        });

        document.getElementById('shelfDetailBack')?.addEventListener('click', () => this._hideShelfDetail());
        document.getElementById('shelfEditBtn')?.addEventListener('click', () => this._openEditShelfModal());
        document.getElementById('shelfDeleteBtn')?.addEventListener('click', () => this._openModal('deleteShelfModal'));
        document.getElementById('editShelfClose')?.addEventListener('click', () => this._closeModal('editShelfModal'));
        document.getElementById('editShelfCancel')?.addEventListener('click', () => this._closeModal('editShelfModal'));
        document.getElementById('editShelfSave')?.addEventListener('click', async () => {
            const input = document.getElementById('editShelfNameInput');
            const ok = await this.saveShelfEdit(this._activeShelfId, input?.value);
            if (ok) this._closeModal('editShelfModal');
        });

        document.getElementById('editShelfCoverPicker')?.addEventListener('click', (e) => {
            const opt = e.target.closest('[data-cover]');
            if (!opt) return;
            this._pendingCoverImage = opt.dataset.cover || null;
            this._renderCoverPicker(this._activeShelfId);
        });
        document.getElementById('deleteShelfClose')?.addEventListener('click', () => this._closeModal('deleteShelfModal'));
        document.getElementById('deleteShelfCancel')?.addEventListener('click', () => this._closeModal('deleteShelfModal'));
        document.getElementById('deleteShelfConfirm')?.addEventListener('click', async () => {
            const ok = await this.deleteShelf(this._activeShelfId);
            if (ok) this._closeModal('deleteShelfModal');
        });

        document.getElementById('shelfGridColsBtn')?.addEventListener('click', () => this._cycleShelfGridCols());
        document.getElementById('basketLayoutBtn')?.addEventListener('click', () => this._cycleBasketLayout());

        document.getElementById('deleteItemCancel')?.addEventListener('click', () => {
            this._pendingDeleteItemId = null;
            this._closeModal('deleteItemModal');
        });
        document.getElementById('deleteItemConfirm')?.addEventListener('click', async () => {
            const id = this._pendingDeleteItemId;
            this._pendingDeleteItemId = null;
            this._closeModal('deleteItemModal');
            if (id) await this._executeDeleteItem(id);
        });

        document.getElementById('productPreviewClose')?.addEventListener('click', () => this._closeModal('productPreviewModal'));
        document.getElementById('productPreviewBarcodes')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-copy-barcode]');
            if (!btn?.dataset.copyBarcode) return;
            const code = btn.dataset.copyBarcode;
            const done = () => this._toast('Barkod kopyalandı', 'success');
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(code).then(done).catch(() => this._toast('Kopyalanamadı', 'error'));
            } else {
                this._toast('Kopyalanamadı', 'error');
            }
        });

        const searchInput = document.getElementById('shelfProductSearch');
        searchInput?.addEventListener('input', () => {
            clearTimeout(this._searchDebounce);
            const q = searchInput.value;
            this._searchDebounce = setTimeout(() => this._renderSearchResults(q), 200);
        });

        document.getElementById('shelfSearchResults')?.addEventListener('click', (e) => {
            const hit = e.target.closest('[data-product-id]');
            if (!hit || !this._activeShelfId) return;
            const product = this.productIndex.get(hit.dataset.productId);
            if (product) void this.toggleProductOnShelf(product);
        });

        document.getElementById('shelfItemGrid')?.addEventListener('click', (e) => {
            const preview = e.target.closest('[data-preview-item]');
            if (preview?.dataset.previewItem) {
                this._openProductPreview(preview.dataset.previewItem);
                return;
            }
            const del = e.target.closest('[data-delete-item]');
            if (del?.dataset.deleteItem) {
                this._requestDeleteItem(del.dataset.deleteItem);
                return;
            }
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const itemId = btn.dataset.itemId;
            if (btn.dataset.action === 'inc') this.setNeeded(itemId, 1);
            if (btn.dataset.action === 'dec') this.setNeeded(itemId, -1);
        });

        document.getElementById('basketGroups')?.addEventListener('click', (e) => {
            const preview = e.target.closest('[data-preview-item]');
            if (preview?.dataset.previewItem) {
                this._openProductPreview(preview.dataset.previewItem);
                return;
            }
            const stepBtn = e.target.closest('[data-action]');
            if (stepBtn?.dataset.itemId) {
                if (stepBtn.dataset.action === 'inc') this.setNeeded(stepBtn.dataset.itemId, 1);
                if (stepBtn.dataset.action === 'dec') this.setNeeded(stepBtn.dataset.itemId, -1);
                return;
            }
            const pickBtn = e.target.closest('[data-pick-id]');
            if (pickBtn?.dataset.pickId) this.openPickModal(pickBtn.dataset.pickId);
        });

        document.getElementById('basketClearBtn')?.addEventListener('click', () => this._openClearBasketModal());
        document.getElementById('clearBasketClose')?.addEventListener('click', () => this._closeModal('clearBasketModal'));
        document.getElementById('clearBasketCancel')?.addEventListener('click', () => this._closeModal('clearBasketModal'));
        document.getElementById('clearBasketAllBtn')?.addEventListener('click', () => this._requestClearBasketConfirm(null));
        document.getElementById('clearBasketShelfList')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-clear-shelf]');
            if (btn?.dataset.clearShelf) this._requestClearBasketConfirm(btn.dataset.clearShelf);
        });
        document.getElementById('clearBasketConfirmCancel')?.addEventListener('click', () => {
            this._pendingClearShelfId = undefined;
            this._closeModal('clearBasketConfirmModal');
        });
        document.getElementById('clearBasketConfirmBtn')?.addEventListener('click', () => {
            const shelfId = this._pendingClearShelfId === undefined ? null : this._pendingClearShelfId;
            this._pendingClearShelfId = undefined;
            void this.clearBasketNeeded(shelfId);
        });

        document.getElementById('pickModalClose')?.addEventListener('click', () => this._closeModal('pickModal'));
        document.getElementById('pickModalCancel')?.addEventListener('click', () => this._closeModal('pickModal'));
        document.getElementById('pickFullBtn')?.addEventListener('click', () => {
            const item = this.items.find((i) => i.id === this._pickItemId);
            if (item) void this.markPicked(Number(item.needed) || 0);
        });
        document.getElementById('pickPartialBtn')?.addEventListener('click', () => {
            const qty = document.getElementById('pickQtyInput')?.value;
            void this.markPicked(qty);
        });

        document.getElementById('headerLogoutBtn')?.addEventListener('click', () => {
            window.authUtils?.logout?.();
            window.location.href = '../index.html';
        });

        document.querySelectorAll('.sm-modal-backdrop').forEach((backdrop) => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop && backdrop.id) this._closeModal(backdrop.id);
            });
        });
    }

    _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _toast(msg, type = 'info') {
        let el = document.getElementById('smToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'smToast';
            el.className = 'sm-toast hidden';
            document.body.appendChild(el);
        }
        const colors = {
            success: 'sm-toast-success',
            error: 'sm-toast-error',
            warning: 'sm-toast-warning',
            info: 'sm-toast-info'
        };
        el.className = `sm-toast ${colors[type] || colors.info}`;
        el.textContent = msg;
        el.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.add('hidden'), type === 'error' ? 4500 : 2800);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.shelfMissingApp = new ShelfMissingApp();
    void window.shelfMissingApp.init();
});
