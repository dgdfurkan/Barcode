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
    }

    async init() {
        this._bindEvents();

        const session = window.authUtils?.checkAuth();
        if (!session) {
            this._updateHeaderUser(null);
            this._show('noAuth');
            return;
        }
        this._username = session.username;
        this._updateHeaderUser(session);

        try {
            if (window.premiumFeatures) await window.premiumFeatures.init();
        } catch (e) {
            console.error('Premium yüklenemedi:', e);
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
        if (shelf?.cover_image) return shelf.cover_image;
        const first = this._itemsForShelf(shelf.id).find((i) => i.product_image);
        return first?.product_image || null;
    }

    _shelfCoverHtml(shelf) {
        const url = this._shelfCoverUrl(shelf);
        if (url) {
            return `<div class="sm-shelf-icon-wrap sm-shelf-icon-wrap--img"><img src="${this._esc(url)}" alt="" loading="lazy" /></div>`;
        }
        return '<div class="sm-shelf-icon-wrap">📦</div>';
    }

    async loadShelves() {
        if (!window.supabase || !this._username) return;
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

    async loadItems() {
        if (!window.supabase || !this._username) return;
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
            : '<p class="sm-item-needed-label" style="color:rgb(100 116 139);font-weight:600">Stokta var</p>';
        return `
            <div class="sm-item-card${neededClass}" data-item-id="${this._esc(item.id)}" draggable="false">
                <button type="button" class="sm-item-delete" data-delete-item="${this._esc(item.id)}" aria-label="Raftan kaldır" title="Kaldır">
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <img src="${img}" alt="" class="sm-item-img" loading="lazy" />
                <p class="sm-item-name">${name}</p>
                ${neededLabel}
                <div class="sm-stepper">
                    <button type="button" class="sm-stepper-btn" data-action="dec" data-item-id="${this._esc(item.id)}" aria-label="Azalt">−</button>
                    <span class="sm-stepper-val">${needed}</span>
                    <button type="button" class="sm-stepper-btn" data-action="inc" data-item-id="${this._esc(item.id)}" aria-label="Artır">+</button>
                </div>
            </div>`;
    }

    _renderBasket() {
        const container = document.getElementById('basketGroups');
        const empty = document.getElementById('basketEmpty');
        if (!container) return;

        const basket = this._basketItems();
        if (!basket.length) {
            container.innerHTML = '';
            empty?.classList.remove('hidden');
            this._updateSummaries();
            return;
        }
        empty?.classList.add('hidden');

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
                const needed = Number(item.needed) || 0;
                const img = this._esc(item.product_image || '../assets/logo.png');
                const name = this._esc(item.product_name || 'Ürün');
                const barcode = this._esc(this._firstBarcode(item));
                return `
                    <div class="sm-basket-row" data-item-id="${this._esc(item.id)}">
                        <img src="${img}" alt="" class="sm-basket-img" loading="lazy" />
                        <div class="sm-basket-info">
                            <p class="sm-basket-name">${name}</p>
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
            }).join('');

            html.push(`
                <section class="sm-basket-section">
                    <div class="sm-basket-section-head">
                        <h3 class="sm-basket-section-title">${this._esc(shelfName)}</h3>
                    </div>
                    <div class="sm-basket-rows">${rows}</div>
                </section>`);
        }
        container.innerHTML = html.join('');
        this._updateSummaries();
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

    async saveShelfEdit(shelfId, name, coverImage) {
        const trimmed = (name || '').trim();
        if (!trimmed || !window.supabase) return false;
        const payload = { name: trimmed };
        if (coverImage !== undefined) payload.cover_image = coverImage || null;
        try {
            const { error } = await window.supabase
                .from('shelf_missing_shelves')
                .update(payload)
                .eq('id', shelfId)
                .eq('username', this._username);
            if (error) throw error;
            const shelf = this.shelves.find((s) => s.id === shelfId);
            if (shelf) {
                shelf.name = trimmed;
                if (coverImage !== undefined) shelf.cover_image = coverImage || null;
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
        return this.saveShelfEdit(shelfId, newName, undefined);
    }

    async deleteItem(itemId) {
        const item = this.items.find((i) => i.id === itemId);
        if (!item || !window.supabase) return false;

        const shelf = this.shelves.find((s) => s.id === item.shelf_id);
        const wasCover = shelf && shelf.cover_image && shelf.cover_image === item.product_image;

        try {
            const { error } = await window.supabase
                .from('shelf_missing_items')
                .delete()
                .eq('id', itemId)
                .eq('username', this._username);
            if (error) throw error;

            this.items = this.items.filter((i) => i.id !== itemId);

            if (wasCover && shelf) {
                const nextCover = this._itemsForShelf(shelf.id).find((i) => i.product_image)?.product_image || null;
                shelf.cover_image = nextCover;
                await window.supabase
                    .from('shelf_missing_shelves')
                    .update({ cover_image: nextCover })
                    .eq('id', shelf.id)
                    .eq('username', this._username);
            }

            if (this._activeShelfId) this._renderShelfDetail();
            this._renderShelvesView();
            if (this._activeTab === 'basket') this._renderBasket();
            this._updateBasketBadge();
            if (this._lastSearchQuery.length >= 2) this._renderSearchResults(this._lastSearchQuery);
            this._toast('Ürün raftan kaldırıldı', 'success');
            return true;
        } catch (e) {
            console.error('Ürün silinemedi:', e);
            this._toast('Ürün kaldırılamadı', 'error');
            return false;
        }
    }

    async toggleProductOnShelf(product) {
        if (!this._activeShelfId) return;
        const productId = String(this._productId(product));
        const existing = this._itemOnShelf(this._activeShelfId, productId);
        if (existing) {
            await this.deleteItem(existing.id);
            return;
        }
        await this.upsertItem(this._activeShelfId, product);
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

    async upsertItem(shelfId, product) {
        const productId = String(this._productId(product));
        if (!productId || !window.supabase) return;

        const existing = this.items.find((i) => i.shelf_id === shelfId && i.product_id === productId);
        if (existing) {
            this._toast('Ürün zaten bu rafta', 'warning');
            return;
        }

        const maxOrder = this._itemsForShelf(shelfId).reduce((m, i) => Math.max(m, i.sort_order || 0), -1);
        const row = {
            username: this._username,
            shelf_id: shelfId,
            product_id: productId,
            product_name: this._productName(product),
            product_image: this._productImage(product),
            barcodes: this._normalizeBarcodes(product),
            sort_order: maxOrder + 1,
            needed: 0
        };

        try {
            const { data, error } = await window.supabase
                .from('shelf_missing_items')
                .insert(row)
                .select('*')
                .maybeSingle();
            if (error) throw error;
            if (data) this.items.push(data);
            this._renderShelfDetail();
            this._renderShelvesView();
            if (this._lastSearchQuery.length >= 2) this._renderSearchResults(this._lastSearchQuery);
            this._toast('Ürün eklendi', 'success');
        } catch (e) {
            console.error('Ürün eklenemedi:', e);
            this._toast('Ürün eklenemedi', 'error');
        }
    }

    setNeeded(itemId, delta) {
        const item = this.items.find((i) => i.id === itemId);
        if (!item) return;

        const prev = Number(item.needed) || 0;
        const next = Math.max(0, prev + delta);
        if (next === prev) return;

        item.needed = next;
        if (this._activeShelfId) this._renderShelfDetail();
        if (this._activeTab === 'basket') this._renderBasket();
        this._renderShelvesView();
        this._updateBasketBadge();

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
            ghostClass: 'sm-sort-ghost',
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
                    ${onShelf
                        ? '<span class="sm-search-remove">✓ Rafta · Kaldır</span>'
                        : '<span class="sm-search-add">+ Ekle</span>'}
                </button>`;
        }).join('');
    }

    _renderCoverPicker(shelfId) {
        const picker = document.getElementById('editShelfCoverPicker');
        if (!picker) return;
        const shelf = this.shelves.find((s) => s.id === shelfId);
        const items = this._itemsForShelf(shelfId);
        const selected = this._pendingCoverImage !== undefined
            ? this._pendingCoverImage
            : (shelf?.cover_image || null);

        let html = `<button type="button" class="sm-cover-option sm-cover-option--default${!selected ? ' is-selected' : ''}" data-cover="" title="Varsayılan">📦</button>`;
        const seen = new Set();
        for (const item of items) {
            const url = item.product_image;
            if (!url || seen.has(url)) continue;
            seen.add(url);
            html += `<button type="button" class="sm-cover-option${selected === url ? ' is-selected' : ''}" data-cover="${this._esc(url)}" title="Kapak yap"><img src="${this._esc(url)}" alt="" loading="lazy" /></button>`;
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
        this._pendingCoverImage = shelf?.cover_image ?? null;
        this._renderCoverPicker(this._activeShelfId);
        this._openModal('editShelfModal');
    }

    _openModal(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('sm-modal-open');
            el.setAttribute('aria-hidden', 'false');
        }
    }

    _closeModal(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('sm-modal-open');
            el.setAttribute('aria-hidden', 'true');
        }
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
            const ok = await this.saveShelfEdit(
                this._activeShelfId,
                input?.value,
                this._pendingCoverImage
            );
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
            const del = e.target.closest('[data-delete-item]');
            if (del?.dataset.deleteItem) {
                void this.deleteItem(del.dataset.deleteItem);
                return;
            }
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const itemId = btn.dataset.itemId;
            if (btn.dataset.action === 'inc') this.setNeeded(itemId, 1);
            if (btn.dataset.action === 'dec') this.setNeeded(itemId, -1);
        });

        document.getElementById('basketGroups')?.addEventListener('click', (e) => {
            const stepBtn = e.target.closest('[data-action]');
            if (stepBtn?.dataset.itemId) {
                if (stepBtn.dataset.action === 'inc') this.setNeeded(stepBtn.dataset.itemId, 1);
                if (stepBtn.dataset.action === 'dec') this.setNeeded(stepBtn.dataset.itemId, -1);
                return;
            }
            const pickBtn = e.target.closest('[data-pick-id]');
            if (pickBtn?.dataset.pickId) this.openPickModal(pickBtn.dataset.pickId);
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
                if (e.target === backdrop) backdrop.classList.remove('sm-modal-open');
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
