/**
 * Ürün Ajandası — müşteri eksik / gönderim takibi (premium: urunAjandasi)
 */
class DispatchAgendaApp {
    constructor() {
        this.REASON_PRESETS = ['Eksik Ürün', 'Yanlış Adet', 'Hasarlı', 'Diğer'];
        this.items = [];
        this.allProducts = [];
        this.productIndex = new Map();
        this.selectedProduct = null;
        this.detailItem = null;
        this._username = null;
        this._searchDebounce = null;
        this._eventsBound = false;
        this._ready = false;
        this._toastTimer = null;
        this._searchHighlight = -1;
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
            if (window.premiumFeatures) {
                await window.premiumFeatures.init();
            }
        } catch (e) {
            console.error('Premium yüklenemedi:', e);
        }

        if (!window.premiumFeatures?.checkPremiumFeature('urunAjandasi')) {
            try {
                await window.premiumFeatures?.loadPremiumFeatures();
            } catch (e) { /* ignore */ }
        }

        if (!window.premiumFeatures?.checkPremiumFeature('urunAjandasi')) {
            this._show('noPremium');
            return;
        }

        this._ready = true;
        this._show('mainContent');

        await this._loadProducts();
        await this.loadItems();
        this._setDefaultDate();
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
            void this.loadItems();
        });
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

    _productBarcode(p) {
        const barcodes = Array.isArray(p?.barcodes) ? p.barcodes : [];
        const first = barcodes[0];
        if (!first) return '';
        return typeof first === 'object' ? first.code || '' : String(first);
    }

    async _loadProducts() {
        try {
            if (window.userDataManager) {
                await window.userDataManager.init();
                this.allProducts = window.userDataManager.getAllProducts(true) || [];
            }
            if ((!this.allProducts || !this.allProducts.length) && typeof PRODUCTS_DATA !== 'undefined') {
                this.allProducts = PRODUCTS_DATA.products || [];
            } else if (typeof activeResults !== 'undefined') {
                const fallback = [...(activeResults || []), ...(outOfStockResults || [])];
                if (fallback.length) this.allProducts = fallback;
            }
            this._rebuildProductIndex();
        } catch (e) {
            console.error('Ürün kataloğu yüklenemedi:', e);
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

    _searchProducts(query, limit = 30) {
        const q = (query || '').trim().toLocaleLowerCase('tr');
        if (q.length < 2) return [];
        const tokens = q.split(/\s+/).filter(Boolean);
        const results = [];

        for (const p of this.allProducts || []) {
            const id = this._productId(p);
            if (!id) continue;
            const name = this._productName(p).toLocaleLowerCase('tr');
            const barcodeStr = (Array.isArray(p.barcodes) ? p.barcodes : [])
                .map((b) => (typeof b === 'object' ? b.code : b))
                .filter(Boolean)
                .join(' ')
                .toLocaleLowerCase('tr');
            const haystack = `${name} ${barcodeStr} ${String(id).toLocaleLowerCase('tr')}`;
            const hit = tokens.every((t) => haystack.includes(t));
            if (hit) results.push(p);
            if (results.length >= limit) break;
        }
        return results;
    }

    async loadItems(retry = 0) {
        const listEl = document.getElementById('agendaCardStrip');
        const emptyEl = document.getElementById('agendaEmpty');
        const countEl = document.getElementById('agendaCountBadge');
        if (!this._username) return;
        if (!window.supabase?.from) {
            if (retry < 3) {
                await this._waitForDb(3000);
                return this.loadItems(retry + 1);
            }
            this._toast('Ajanda yüklenemedi — bağlantı yok', 'error');
            return;
        }

        try {
            const { data, error } = await window.supabase
                .from('dispatch_agenda_items')
                .select('*')
                .eq('username', this._username)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.items = Array.isArray(data) ? data : [];
        } catch (e) {
            console.error('Ajanda yüklenemedi:', e);
            this.items = [];
            this._toast('Kayıtlar yüklenemedi', 'error');
        }

        if (countEl) countEl.textContent = String(this.items.length);

        if (!this.items.length) {
            if (listEl) listEl.innerHTML = '';
            emptyEl?.classList.remove('hidden');
            return;
        }
        emptyEl?.classList.add('hidden');
        if (listEl) {
            listEl.innerHTML = this.items.map((item) => this._renderCard(item)).join('');
        }
    }

    _renderCard(item) {
        const img = this._esc(item.product_image || '../assets/logo.png');
        const name = this._esc(item.product_name || 'Ürün');
        const qty = Number(item.quantity) || 1;
        const dateStr = this._formatDate(item.event_date || item.created_at);
        const pickup = item.pickup_required
            ? '<span class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-800">Alınacak</span>'
            : '';
        return `
            <button type="button" class="agenda-card" data-item-id="${this._esc(item.id)}" aria-label="${name}">
                <div class="relative">
                    <img src="${img}" alt="" class="agenda-card-img" loading="lazy" />
                    <span class="agenda-qty-badge">−${qty}</span>
                </div>
                <p class="agenda-card-title">${name}</p>
                <div class="flex flex-wrap items-center gap-1 mt-1.5">
                    <span class="text-[10px] text-text-secondary">${this._esc(dateStr)}</span>
                    ${pickup}
                </div>
            </button>`;
    }

    _bindEvents() {
        if (this._eventsBound) return;
        this._eventsBound = true;

        const openAdd = () => {
            if (!this._ready) {
                this._toast('Bu özellik için yetkiniz yok', 'warning');
                return;
            }
            this.openAddModal();
        };

        document.getElementById('agendaAddBtn')?.addEventListener('click', openAdd);
        document.getElementById('agendaEmptyAddBtn')?.addEventListener('click', openAdd);
        document.getElementById('addModalClose')?.addEventListener('click', () => this.closeAddModal());
        document.getElementById('addModalCancel')?.addEventListener('click', () => this.closeAddModal());
        document.getElementById('addModalSave')?.addEventListener('click', () => void this.saveNewItem());
        document.getElementById('addClearProductBtn')?.addEventListener('click', () => this._clearSelectedProduct());
        document.getElementById('addSearchClearBtn')?.addEventListener('click', () => this._clearSearchInput());
        document.getElementById('detailCloseBtn')?.addEventListener('click', () => this.closeDetailSheet());
        document.getElementById('detailDeleteBtn')?.addEventListener('click', () => this.openDeleteConfirmModal());
        document.getElementById('detailSheetBackdrop')?.addEventListener('click', () => this.closeDetailSheet());

        document.getElementById('agendaDeleteConfirmClose')?.addEventListener('click', () => this.closeDeleteConfirmModal());
        document.getElementById('agendaDeleteConfirmCancel')?.addEventListener('click', () => this.closeDeleteConfirmModal());
        document.getElementById('agendaDeleteConfirmConfirm')?.addEventListener('click', () => void this.completeAndDelete());
        document.getElementById('agendaDeleteConfirmModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'agendaDeleteConfirmModal') this.closeDeleteConfirmModal();
        });

        document.getElementById('headerLogoutBtn')?.addEventListener('click', () => {
            window.authUtils?.logout?.();
            window.location.href = '../index.html';
        });

        document.querySelectorAll('#addReasonPills .agenda-reason-pill').forEach((pill) => {
            pill.addEventListener('click', () => this._setReasonPreset(pill.getAttribute('data-reason')));
        });

        const searchInput = document.getElementById('addProductSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this._updateSearchClearBtn(searchInput.value);
                clearTimeout(this._searchDebounce);
                this._searchDebounce = setTimeout(() => this._renderProductSearchResults(searchInput.value), 120);
            });
            searchInput.addEventListener('keydown', (e) => this._handleSearchKeydown(e));
        }

        const strip = document.getElementById('agendaCardStrip');
        strip?.addEventListener('click', (e) => {
            const card = e.target.closest('[data-item-id]');
            if (!card) return;
            const id = card.getAttribute('data-item-id');
            const item = this.items.find((x) => String(x.id) === String(id));
            if (item) this.openDetailSheet(item);
        });

        document.getElementById('addAgendaModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'addAgendaModal') this.closeAddModal();
        });

        document.getElementById('addProductResults')?.addEventListener('click', (e) => {
            const row = e.target.closest('[data-pick-id]');
            if (!row) return;
            const pid = row.getAttribute('data-pick-id');
            const product = this.productIndex.get(String(pid));
            if (product) this._selectProduct(product);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const deleteModal = document.getElementById('agendaDeleteConfirmModal');
                if (deleteModal?.classList.contains('agenda-modal-open')) {
                    this.closeDeleteConfirmModal();
                    return;
                }
                const modal = document.getElementById('addAgendaModal');
                if (modal?.classList.contains('agenda-modal-open')) {
                    this.closeAddModal();
                } else if (document.getElementById('detailSheet')?.classList.contains('agenda-sheet-open')) {
                    this.closeDetailSheet();
                }
            }
        });
    }

    _updateSearchClearBtn(value) {
        const btn = document.getElementById('addSearchClearBtn');
        if (btn) btn.classList.toggle('hidden', !(value || '').trim());
    }

    _clearSearchInput() {
        const search = document.getElementById('addProductSearch');
        if (search) {
            search.value = '';
            search.focus();
        }
        this._updateSearchClearBtn('');
        this._renderProductSearchResults('');
    }

    _setReasonPreset(reason) {
        const preset = reason || this.REASON_PRESETS[0];
        document.querySelectorAll('#addReasonPills .agenda-reason-pill').forEach((pill) => {
            pill.classList.toggle('is-active', pill.getAttribute('data-reason') === preset);
        });
        const select = document.getElementById('addReasonPreset');
        if (select) select.value = preset;
    }

    _getReasonPreset() {
        const active = document.querySelector('#addReasonPills .agenda-reason-pill.is-active');
        return active?.getAttribute('data-reason') || this.REASON_PRESETS[0];
    }

    _showFormSection(show) {
        const section = document.getElementById('addFormSection');
        const saveBtn = document.getElementById('addModalSave');
        if (section) section.classList.toggle('is-visible', show);
        if (saveBtn) saveBtn.disabled = !show;
    }

    openAddModal() {
        this.selectedProduct = null;
        this._searchHighlight = -1;
        const modal = document.getElementById('addAgendaModal');
        const search = document.getElementById('addProductSearch');
        const picked = document.getElementById('addSelectedProduct');
        const results = document.getElementById('addProductResults');
        const hint = document.getElementById('addSearchHint');

        if (search) search.value = '';
        this._updateSearchClearBtn('');
        picked?.classList.add('hidden');
        if (results) {
            results.innerHTML = '';
            results.classList.add('hidden');
        }
        hint?.classList.remove('hidden');
        this._showFormSection(false);

        const qtyEl = document.getElementById('addQuantity');
        const noteEl = document.getElementById('addReasonNote');
        const addrEl = document.getElementById('addAddress');
        const pickupEl = document.getElementById('addPickupRequired');
        if (qtyEl) qtyEl.value = '1';
        if (noteEl) noteEl.value = '';
        if (addrEl) addrEl.value = '';
        if (pickupEl) pickupEl.checked = false;
        this._setReasonPreset(this.REASON_PRESETS[0]);
        this._setDefaultDate('addEventDate');

        if (modal) {
            modal.classList.add('agenda-modal-open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }
        setTimeout(() => search?.focus(), 80);
    }

    closeAddModal() {
        const modal = document.getElementById('addAgendaModal');
        if (modal) {
            modal.classList.remove('agenda-modal-open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }

    _clearSelectedProduct() {
        this.selectedProduct = null;
        const picked = document.getElementById('addSelectedProduct');
        picked?.classList.add('hidden');
        this._showFormSection(false);
        document.getElementById('addSearchHint')?.classList.remove('hidden');
        document.getElementById('addProductSearch')?.focus();
    }

    _selectProduct(product) {
        this.selectedProduct = product;
        const picked = document.getElementById('addSelectedProduct');
        const nameEl = document.getElementById('addSelectedName');
        const imgEl = document.getElementById('addSelectedImg');
        const barcodeEl = document.getElementById('addSelectedBarcode');
        const results = document.getElementById('addProductResults');
        const hint = document.getElementById('addSearchHint');

        if (nameEl) nameEl.textContent = this._productName(product);
        if (imgEl) imgEl.src = this._productImage(product);
        if (barcodeEl) {
            const bc = this._productBarcode(product);
            barcodeEl.textContent = bc ? `Barkod: ${bc}` : '';
            barcodeEl.classList.toggle('hidden', !bc);
        }
        picked?.classList.remove('hidden');
        if (results) {
            results.innerHTML = '';
            results.classList.add('hidden');
        }
        hint?.classList.add('hidden');
        this._showFormSection(true);
        document.getElementById('addQuantity')?.focus();
    }

    _handleSearchKeydown(e) {
        const container = document.getElementById('addProductResults');
        const hits = container ? [...container.querySelectorAll('[data-pick-id]')] : [];
        if (!hits.length) {
            if (e.key === 'Enter') e.preventDefault();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._searchHighlight = Math.min(this._searchHighlight + 1, hits.length - 1);
            this._updateSearchHighlight(hits);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._searchHighlight = Math.max(this._searchHighlight - 1, 0);
            this._updateSearchHighlight(hits);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const target = hits[this._searchHighlight >= 0 ? this._searchHighlight : 0];
            target?.click();
        }
    }

    _updateSearchHighlight(hits) {
        hits.forEach((el, i) => {
            el.setAttribute('aria-selected', i === this._searchHighlight ? 'true' : 'false');
            if (i === this._searchHighlight) el.scrollIntoView({ block: 'nearest' });
        });
    }

    _renderProductSearchResults(query) {
        const container = document.getElementById('addProductResults');
        if (!container) return;

        this._searchHighlight = -1;
        const q = (query || '').trim();

        if (q.length < 2) {
            container.innerHTML = '';
            container.classList.add('hidden');
            return;
        }

        if (!this.allProducts.length) {
            container.innerHTML =
                '<p class="px-4 py-4 text-sm text-center text-amber-700">Ürün kataloğu yüklenemedi. Sayfayı yenileyin.</p>';
            container.classList.remove('hidden');
            return;
        }

        const matches = this._searchProducts(q);
        if (!matches.length) {
            container.innerHTML =
                '<p class="px-4 py-6 text-sm text-center text-slate-500">Eşleşen ürün bulunamadı</p>';
            container.classList.remove('hidden');
            return;
        }

        container.innerHTML = matches
            .map((p) => {
                const id = this._esc(this._productId(p));
                const name = this._esc(this._productName(p));
                const img = this._esc(this._productImage(p));
                const barcode = this._esc(this._productBarcode(p));
                const brand = this._esc(p.brand || '');
                const meta = [brand, barcode ? `Barkod: ${barcode}` : ''].filter(Boolean).join(' · ');
                return `
            <button type="button" class="agenda-search-hit" data-pick-id="${id}" aria-selected="false">
                <img src="${img}" alt="" class="h-12 w-12 shrink-0 rounded-xl border border-slate-100 object-cover bg-slate-50" loading="lazy" />
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere] leading-snug">${name}</p>
                    ${meta ? `<p class="mt-0.5 text-xs text-slate-500 truncate">${meta}</p>` : ''}
                </div>
                <span class="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">Seç</span>
            </button>`;
            })
            .join('');

        container.classList.remove('hidden');
    }

    async saveNewItem() {
        if (!this.selectedProduct || !this._productId(this.selectedProduct)) {
            this._toast('Önce bir ürün seçin', 'warning');
            document.getElementById('addProductSearch')?.focus();
            return;
        }

        const qty = parseInt(document.getElementById('addQuantity')?.value, 10);
        if (!qty || qty < 1) {
            this._toast('Geçerli adet girin', 'warning');
            return;
        }

        const reasonPreset = this._getReasonPreset();
        const reasonNote = (document.getElementById('addReasonNote')?.value || '').trim();
        const pickupRequired = !!document.getElementById('addPickupRequired')?.checked;
        const address = (document.getElementById('addAddress')?.value || '').trim();
        const eventDate = document.getElementById('addEventDate')?.value || null;

        const barcodes = Array.isArray(this.selectedProduct.barcodes) ? this.selectedProduct.barcodes : [];
        const row = {
            username: this._username,
            product_id: String(this._productId(this.selectedProduct)),
            product_name: this._productName(this.selectedProduct),
            product_image: this._productImage(this.selectedProduct),
            barcodes,
            quantity: qty,
            reason_preset: reasonPreset,
            reason_note: reasonNote || null,
            pickup_required: pickupRequired,
            address: address || null,
            event_date: eventDate,
            updated_at: new Date().toISOString(),
        };

        const saveBtn = document.getElementById('addModalSave');
        if (saveBtn) saveBtn.disabled = true;

        try {
            const { error } = await window.supabase.from('dispatch_agenda_items').insert(row);
            if (error) throw error;
            this._toast('Kayıt eklendi', 'success');
            this.closeAddModal();
            await this.loadItems();
        } catch (e) {
            console.error(e);
            this._toast(e.message || 'Kayıt eklenemedi', 'error');
        } finally {
            if (saveBtn) saveBtn.disabled = !this.selectedProduct;
        }
    }

    openDetailSheet(item) {
        this.detailItem = item;
        const sheet = document.getElementById('detailSheet');
        const body = document.getElementById('detailSheetBody');
        if (!sheet || !body) return;

        const barcodes = Array.isArray(item.barcodes) ? item.barcodes : [];
        const barcodeText = barcodes
            .map((b) => (typeof b === 'object' ? b.code : b))
            .filter(Boolean)
            .join(', ');

        body.innerHTML = `
            <div class="flex items-start gap-3.5 rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/40 p-3.5">
                <img src="${this._esc(item.product_image || '../assets/logo.png')}" alt="" class="h-16 w-16 shrink-0 rounded-xl border-2 border-white object-cover shadow-sm" />
                <div class="min-w-0 flex-1">
                    <h3 class="text-base font-bold text-slate-900 [overflow-wrap:anywhere] leading-snug">${this._esc(item.product_name)}</h3>
                    <p class="mt-1.5 inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">−${Number(item.quantity) || 1} Adet Eksik</p>
                </div>
            </div>
            <dl class="mt-4 space-y-0 text-sm">
                <div class="flex justify-between gap-3 border-b border-slate-100 py-2.5">
                    <dt class="text-slate-500 shrink-0">Sebep</dt>
                    <dd class="text-right font-semibold text-slate-900">${this._esc(item.reason_preset || '—')}</dd>
                </div>
                ${item.reason_note ? `<div class="flex justify-between gap-3 border-b border-slate-100 py-2.5"><dt class="text-slate-500 shrink-0">Not</dt><dd class="text-right text-slate-800 [overflow-wrap:anywhere]">${this._esc(item.reason_note)}</dd></div>` : ''}
                <div class="flex justify-between gap-3 border-b border-slate-100 py-2.5">
                    <dt class="text-slate-500 shrink-0">Tarih</dt>
                    <dd class="text-right text-slate-900">${this._esc(this._formatDate(item.event_date || item.created_at))}</dd>
                </div>
                <div class="flex justify-between gap-3 border-b border-slate-100 py-2.5">
                    <dt class="text-slate-500 shrink-0">Müşteriden Alınacak</dt>
                    <dd class="text-right font-semibold ${item.pickup_required ? 'text-blue-700' : 'text-slate-400'}">${item.pickup_required ? 'Evet' : 'Hayır'}</dd>
                </div>
                ${item.address ? `<div class="flex justify-between gap-3 border-b border-slate-100 py-2.5"><dt class="text-slate-500 shrink-0">Adres</dt><dd class="text-right text-slate-800 [overflow-wrap:anywhere]">${this._esc(item.address)}</dd></div>` : ''}
                ${barcodeText ? `<div class="flex justify-between gap-3 py-2.5"><dt class="text-slate-500 shrink-0">Barkod</dt><dd class="text-right text-xs font-mono text-slate-600 [overflow-wrap:anywhere]">${this._esc(barcodeText)}</dd></div>` : ''}
            </dl>`;

        sheet.classList.remove('hidden');
        sheet.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => sheet.classList.add('agenda-sheet-open'));
    }

    closeDetailSheet() {
        const sheet = document.getElementById('detailSheet');
        if (!sheet) return;
        sheet.classList.remove('agenda-sheet-open');
        sheet.setAttribute('aria-hidden', 'true');
        setTimeout(() => sheet.classList.add('hidden'), 280);
        this.detailItem = null;
    }

    openDeleteConfirmModal() {
        if (!this.detailItem?.id) return;
        const modal = document.getElementById('agendaDeleteConfirmModal');
        const nameEl = document.getElementById('agendaDeleteConfirmProduct');
        if (nameEl) nameEl.textContent = this.detailItem.product_name || 'Bu';
        if (modal) {
            modal.classList.add('agenda-modal-open');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    closeDeleteConfirmModal() {
        const modal = document.getElementById('agendaDeleteConfirmModal');
        if (modal) {
            modal.classList.remove('agenda-modal-open');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    async completeAndDelete() {
        if (!this.detailItem?.id) return;

        const confirmBtn = document.getElementById('agendaDeleteConfirmConfirm');
        if (confirmBtn) confirmBtn.disabled = true;

        try {
            const { error } = await window.supabase
                .from('dispatch_agenda_items')
                .delete()
                .eq('id', this.detailItem.id)
                .eq('username', this._username);
            if (error) throw error;
            this.closeDeleteConfirmModal();
            this._toast('Kayıt silindi', 'success');
            this.closeDetailSheet();
            await this.loadItems();
        } catch (e) {
            console.error(e);
            this._toast(e.message || 'Silinemedi', 'error');
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
        }
    }

    _setDefaultDate(inputId = 'addEventDate') {
        const el = document.getElementById(inputId);
        if (!el) return;
        const d = new Date();
        el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _formatDate(val) {
        if (!val) return '—';
        try {
            const d = new Date(val);
            if (Number.isNaN(d.getTime())) return String(val).split('T')[0];
            return d.toLocaleDateString('tr-TR');
        } catch {
            return String(val);
        }
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
        const el = document.getElementById('agendaToast');
        if (!el) {
            if (type === 'error') alert(msg);
            return;
        }
        const colors = {
            success: 'bg-emerald-600',
            error: 'bg-rose-600',
            warning: 'bg-amber-600',
            info: 'bg-slate-800',
        };
        el.textContent = msg;
        el.className = `fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 max-w-[90vw] rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-xl ${colors[type] || colors.info}`;
        el.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.add('hidden'), type === 'error' ? 4500 : 2800);
    }
}

window.dispatchAgendaApp = new DispatchAgendaApp();
