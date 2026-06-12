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
    }

    async init() {
        this._bindEvents();

        const session = window.authUtils?.checkAuth();
        if (!session) {
            this._show('noAuth');
            return;
        }
        this._username = session.username;
        const nameEl = document.getElementById('headerUserName');
        if (nameEl) nameEl.textContent = session.username || '—';

        try {
            if (window.premiumFeatures) {
                await window.premiumFeatures.init();
            }
        } catch (e) {
            console.error('Premium yüklenemedi:', e);
        }

        if (!window.premiumFeatures?.checkPremiumFeature('urunAjandasi')) {
            this._show('noPremium');
            return;
        }

        this._ready = true;
        this._show('mainContent');
        document.getElementById('agendaAddBtn')?.classList.remove('hidden');
        document.getElementById('agendaRefreshBtn')?.classList.remove('hidden');

        await this._loadProducts();
        await this.loadItems();
        this._setDefaultDate();
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

    _searchProducts(query, limit = 24) {
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

    async loadItems() {
        const listEl = document.getElementById('agendaCardStrip');
        const emptyEl = document.getElementById('agendaEmpty');
        const countEl = document.getElementById('agendaCountBadge');
        if (!window.supabase || !this._username) return;

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
                <div class="flex flex-wrap items-center gap-1 mt-1">
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
        document.getElementById('agendaAddBtnMain')?.addEventListener('click', openAdd);
        document.getElementById('agendaEmptyAddBtn')?.addEventListener('click', openAdd);
        document.getElementById('agendaRefreshBtn')?.addEventListener('click', () => void this.loadItems());
        document.getElementById('addModalClose')?.addEventListener('click', () => this.closeAddModal());
        document.getElementById('addModalCancel')?.addEventListener('click', () => this.closeAddModal());
        document.getElementById('addModalSave')?.addEventListener('click', () => void this.saveNewItem());
        document.getElementById('addClearProductBtn')?.addEventListener('click', () => this._clearSelectedProduct());
        document.getElementById('detailCloseBtn')?.addEventListener('click', () => this.closeDetailSheet());
        document.getElementById('detailDeleteBtn')?.addEventListener('click', () => void this.completeAndDelete());
        document.getElementById('detailSheetBackdrop')?.addEventListener('click', () => this.closeDetailSheet());

        document.getElementById('backToSearchBtn')?.addEventListener('click', () => {
            window.location.href = 'product_search.html';
        });
        document.getElementById('headerLogoutBtn')?.addEventListener('click', () => {
            window.authUtils?.logout?.();
            window.location.href = '../index.html';
        });

        const searchInput = document.getElementById('addProductSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._searchDebounce);
                this._searchDebounce = setTimeout(() => this._renderProductSearchResults(searchInput.value), 150);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const first = document.querySelector('#addProductResults [data-pick-id]');
                    if (first) first.click();
                }
            });
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
                if (!document.getElementById('addAgendaModal')?.classList.contains('hidden')) {
                    this.closeAddModal();
                } else if (document.getElementById('detailSheet')?.classList.contains('agenda-sheet-open')) {
                    this.closeDetailSheet();
                }
            }
        });
    }

    openAddModal() {
        this.selectedProduct = null;
        const modal = document.getElementById('addAgendaModal');
        const search = document.getElementById('addProductSearch');
        const picked = document.getElementById('addSelectedProduct');
        const results = document.getElementById('addProductResults');

        if (search) search.value = '';
        picked?.classList.add('hidden');
        picked?.classList.remove('flex');
        if (results) {
            results.innerHTML =
                '<p class="px-3 py-3 text-xs text-text-secondary">En az 2 karakter yazın (ürün adı veya barkod)</p>';
        }
        document.getElementById('addQuantity')?.value = '1';
        document.getElementById('addReasonNote')?.value = '';
        document.getElementById('addAddress')?.value = '';
        document.getElementById('addPickupRequired')?.checked = false;
        const reason = document.getElementById('addReasonPreset');
        if (reason) reason.value = this.REASON_PRESETS[0];
        this._setDefaultDate('addEventDate');

        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            modal.setAttribute('aria-hidden', 'false');
        }
        setTimeout(() => search?.focus(), 50);
    }

    closeAddModal() {
        const modal = document.getElementById('addAgendaModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    _clearSelectedProduct() {
        this.selectedProduct = null;
        const picked = document.getElementById('addSelectedProduct');
        picked?.classList.add('hidden');
        picked?.classList.remove('flex');
        document.getElementById('addProductSearch')?.focus();
    }

    _selectProduct(product) {
        this.selectedProduct = product;
        const picked = document.getElementById('addSelectedProduct');
        const nameEl = document.getElementById('addSelectedName');
        const imgEl = document.getElementById('addSelectedImg');
        if (nameEl) nameEl.textContent = this._productName(product);
        if (imgEl) imgEl.src = this._productImage(product);
        if (picked) {
            picked.classList.remove('hidden');
            picked.classList.add('flex');
        }
        const results = document.getElementById('addProductResults');
        if (results) results.innerHTML = '';
        document.getElementById('addQuantity')?.focus();
    }

    _renderProductSearchResults(query) {
        const container = document.getElementById('addProductResults');
        if (!container) return;

        const q = (query || '').trim();
        if (q.length < 2) {
            container.innerHTML =
                '<p class="px-3 py-3 text-xs text-text-secondary">En az 2 karakter yazın (ürün adı veya barkod)</p>';
            return;
        }

        if (!this.allProducts.length) {
            container.innerHTML =
                '<p class="px-3 py-3 text-xs text-amber-700">Ürün kataloğu yüklenemedi. Sayfayı yenileyin.</p>';
            return;
        }

        const matches = this._searchProducts(q);
        if (!matches.length) {
            container.innerHTML = '<p class="px-3 py-3 text-xs text-text-secondary">Eşleşen ürün bulunamadı</p>';
            return;
        }

        container.innerHTML = matches
            .map(
                (p) => `
            <button type="button" class="agenda-search-hit flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left" data-pick-id="${this._esc(this._productId(p))}">
                <img src="${this._esc(this._productImage(p))}" alt="" class="h-9 w-9 shrink-0 rounded-md border border-border object-cover" loading="lazy" />
                <span class="min-w-0 flex-1 text-sm text-text-primary [overflow-wrap:anywhere]">${this._esc(this._productName(p))}</span>
            </button>`
            )
            .join('');
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

        const reasonPreset = document.getElementById('addReasonPreset')?.value || this.REASON_PRESETS[0];
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
            if (saveBtn) saveBtn.disabled = false;
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
            <div class="flex items-start gap-3">
                <img src="${this._esc(item.product_image || '../assets/logo.png')}" alt="" class="h-14 w-14 shrink-0 rounded-xl border border-border object-cover" />
                <div class="min-w-0 flex-1">
                    <h3 class="text-base font-semibold text-text-primary [overflow-wrap:anywhere]">${this._esc(item.product_name)}</h3>
                    <p class="mt-1 text-sm font-bold text-rose-700">−${Number(item.quantity) || 1} Adet</p>
                </div>
            </div>
            <dl class="mt-4 space-y-2.5 text-sm">
                <div class="flex justify-between gap-3 border-b border-border pb-2">
                    <dt class="text-text-secondary shrink-0">Sebep</dt>
                    <dd class="text-right font-medium text-text-primary">${this._esc(item.reason_preset || '—')}</dd>
                </div>
                ${item.reason_note ? `<div class="flex justify-between gap-3 border-b border-border pb-2"><dt class="text-text-secondary shrink-0">Not</dt><dd class="text-right text-text-primary [overflow-wrap:anywhere]">${this._esc(item.reason_note)}</dd></div>` : ''}
                <div class="flex justify-between gap-3 border-b border-border pb-2">
                    <dt class="text-text-secondary shrink-0">Tarih</dt>
                    <dd class="text-right text-text-primary">${this._esc(this._formatDate(item.event_date || item.created_at))}</dd>
                </div>
                <div class="flex justify-between gap-3 border-b border-border pb-2">
                    <dt class="text-text-secondary shrink-0">Müşteriden Alınacak</dt>
                    <dd class="text-right font-medium ${item.pickup_required ? 'text-blue-700' : 'text-text-secondary'}">${item.pickup_required ? 'Evet' : 'Hayır'}</dd>
                </div>
                ${item.address ? `<div class="flex justify-between gap-3 border-b border-border pb-2"><dt class="text-text-secondary shrink-0">Adres</dt><dd class="text-right text-text-primary [overflow-wrap:anywhere]">${this._esc(item.address)}</dd></div>` : ''}
                ${barcodeText ? `<div class="flex justify-between gap-3"><dt class="text-text-secondary shrink-0">Barkod</dt><dd class="text-right text-xs text-text-secondary [overflow-wrap:anywhere]">${this._esc(barcodeText)}</dd></div>` : ''}
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
        setTimeout(() => sheet.classList.add('hidden'), 220);
        this.detailItem = null;
    }

    async completeAndDelete() {
        if (!this.detailItem?.id) return;
        if (!confirm('Bu kaydı tamamlandı olarak silmek istiyor musunuz?')) return;

        try {
            const { error } = await window.supabase
                .from('dispatch_agenda_items')
                .delete()
                .eq('id', this.detailItem.id)
                .eq('username', this._username);
            if (error) throw error;
            this._toast('Kayıt silindi', 'success');
            this.closeDetailSheet();
            await this.loadItems();
        } catch (e) {
            console.error(e);
            this._toast(e.message || 'Silinemedi', 'error');
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
        el.className = `fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 max-w-[90vw] rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${colors[type] || colors.info}`;
        el.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.add('hidden'), type === 'error' ? 4500 : 2800);
    }
}

window.dispatchAgendaApp = new DispatchAgendaApp();
