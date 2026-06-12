/**
 * Ürün Ajandası — müşteri eksik / gönderim takibi (premium: urunAjandasi)
 */
class DispatchAgendaApp {
    constructor() {
        this.REASON_PRESETS = ['Eksik ürün', 'Yanlış adet', 'Hasarlı', 'Diğer'];
        this.items = [];
        this.allProducts = [];
        this.productIndex = new Map();
        this.selectedProduct = null;
        this.detailItem = null;
        this._username = null;
        this._searchDebounce = null;
    }

    async init() {
        const session = window.authUtils?.checkAuth();
        if (!session) {
            this._show('noAuth');
            return;
        }
        this._username = session.username;

        if (window.premiumFeatures) {
            await window.premiumFeatures.init();
        }
        if (!window.premiumFeatures?.checkPremiumFeature('urunAjandasi')) {
            this._show('noPremium');
            return;
        }

        this._show('mainContent');
        const nameEl = document.getElementById('headerUserName');
        if (nameEl) nameEl.textContent = session.username || '';

        await this._loadProducts();
        await this.loadItems();
        this._bindEvents();
        this._setDefaultDate();
    }

    _show(id) {
        ['noAuth', 'noPremium', 'mainContent'].forEach((k) => {
            const el = document.getElementById(k);
            if (el) el.classList.toggle('hidden', k !== id);
        });
    }

    async _loadProducts() {
        try {
            if (window.userDataManager) {
                await window.userDataManager.init();
                this.allProducts = window.userDataManager.getAllProducts() || [];
            } else if (typeof activeResults !== 'undefined') {
                this.allProducts = [...(activeResults || []), ...(outOfStockResults || [])];
            } else {
                this.allProducts = [];
            }
            this.productIndex = new Map(
                this.allProducts.filter((p) => p?.id).map((p) => [String(p.id), p])
            );
        } catch (e) {
            console.error('Ürün kataloğu yüklenemedi:', e);
            this.allProducts = [];
        }
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
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');
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
            ? '<span class="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800">Alınacak</span>'
            : '';
        return `
            <button type="button" class="agenda-card shrink-0 snap-start" data-item-id="${this._esc(item.id)}" aria-label="${name}">
                <div class="relative">
                    <img src="${img}" alt="" class="agenda-card-img" loading="lazy" />
                    <span class="agenda-qty-badge">−${qty}</span>
                </div>
                <p class="agenda-card-title">${name}</p>
                <div class="flex flex-wrap items-center gap-1 mt-1">
                    <span class="text-[10px] text-slate-500">${this._esc(dateStr)}</span>
                    ${pickup}
                </div>
            </button>`;
    }

    _bindEvents() {
        document.getElementById('agendaAddBtn')?.addEventListener('click', () => this.openAddModal());
        document.getElementById('agendaRefreshBtn')?.addEventListener('click', () => void this.loadItems());
        document.getElementById('addModalClose')?.addEventListener('click', () => this.closeAddModal());
        document.getElementById('addModalCancel')?.addEventListener('click', () => this.closeAddModal());
        document.getElementById('addModalSave')?.addEventListener('click', () => void this.saveNewItem());
        document.getElementById('detailCloseBtn')?.addEventListener('click', () => this.closeDetailSheet());
        document.getElementById('detailDeleteBtn')?.addEventListener('click', () => void this.completeAndDelete());
        document.getElementById('detailSheetBackdrop')?.addEventListener('click', () => this.closeDetailSheet());

        const searchInput = document.getElementById('addProductSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._searchDebounce);
                this._searchDebounce = setTimeout(() => this._renderProductSearchResults(searchInput.value), 120);
            });
        }

        const strip = document.getElementById('agendaCardStrip');
        if (strip) {
            strip.addEventListener('click', (e) => {
                const card = e.target.closest('[data-item-id]');
                if (!card) return;
                const id = card.getAttribute('data-item-id');
                const item = this.items.find((x) => String(x.id) === String(id));
                if (item) this.openDetailSheet(item);
            });
        }

        document.getElementById('addAgendaModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'addAgendaModal') this.closeAddModal();
        });

        const results = document.getElementById('addProductResults');
        if (results) {
            results.addEventListener('click', (e) => {
                const row = e.target.closest('[data-pick-id]');
                if (!row) return;
                const pid = row.getAttribute('data-pick-id');
                const product = this.productIndex.get(String(pid));
                if (product) this._selectProduct(product);
            });
        }
    }

    openAddModal() {
        this.selectedProduct = null;
        const modal = document.getElementById('addAgendaModal');
        const search = document.getElementById('addProductSearch');
        const picked = document.getElementById('addSelectedProduct');
        const results = document.getElementById('addProductResults');
        if (search) search.value = '';
        if (picked) picked.classList.add('hidden');
        if (results) results.innerHTML = '';
        document.getElementById('addQuantity')?.value = '1';
        document.getElementById('addReasonNote')?.value = '';
        document.getElementById('addAddress')?.value = '';
        document.getElementById('addPickupRequired')?.checked = false;
        const reason = document.getElementById('addReasonPreset');
        if (reason) reason.value = this.REASON_PRESETS[0];
        this._setDefaultDate('addEventDate');
        if (modal) modal.classList.remove('hidden');
        search?.focus();
    }

    closeAddModal() {
        document.getElementById('addAgendaModal')?.classList.add('hidden');
    }

    _selectProduct(product) {
        this.selectedProduct = product;
        const picked = document.getElementById('addSelectedProduct');
        const nameEl = document.getElementById('addSelectedName');
        const imgEl = document.getElementById('addSelectedImg');
        if (nameEl) nameEl.textContent = product.name || '';
        if (imgEl) imgEl.src = product.image || '../assets/logo.png';
        if (picked) picked.classList.remove('hidden');
        document.getElementById('addProductResults')?.replaceChildren();
    }

    _renderProductSearchResults(query) {
        const container = document.getElementById('addProductResults');
        if (!container) return;
        const q = (query || '').trim().toLocaleLowerCase('tr');
        if (q.length < 2) {
            container.innerHTML = '<p class="px-2 py-3 text-xs text-slate-400">En az 2 karakter yazın (ad veya barkod)</p>';
            return;
        }

        const matches = [];
        for (const p of this.allProducts) {
            if (!p?.id) continue;
            const name = (p.name || '').toLocaleLowerCase('tr');
            let hit = name.includes(q);
            if (!hit && Array.isArray(p.barcodes)) {
                hit = p.barcodes.some((b) => {
                    const code = typeof b === 'object' ? b.code : b;
                    return code && String(code).includes(q);
                });
            }
            if (hit) matches.push(p);
            if (matches.length >= 24) break;
        }

        if (!matches.length) {
            container.innerHTML = '<p class="px-2 py-3 text-xs text-slate-500">Eşleşen ürün yok</p>';
            return;
        }

        container.innerHTML = matches
            .map(
                (p) => `
            <button type="button" class="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50" data-pick-id="${this._esc(p.id)}">
                <img src="${this._esc(p.image || '../assets/logo.png')}" alt="" class="h-9 w-9 shrink-0 rounded-md border border-slate-100 object-cover" loading="lazy" />
                <span class="min-w-0 flex-1 text-sm text-slate-800 [overflow-wrap:anywhere]">${this._esc(p.name)}</span>
            </button>`
            )
            .join('');
    }

    async saveNewItem() {
        if (!this.selectedProduct?.id) {
            this._toast('Önce ürün seçin', 'warning');
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
            product_id: String(this.selectedProduct.id),
            product_name: this.selectedProduct.name || '',
            product_image: this.selectedProduct.image || null,
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
            this._toast('Ajandaya eklendi', 'success');
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
                <img src="${this._esc(item.product_image || '../assets/logo.png')}" alt="" class="h-14 w-14 shrink-0 rounded-xl border border-slate-100 object-cover" />
                <div class="min-w-0 flex-1">
                    <h3 class="text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">${this._esc(item.product_name)}</h3>
                    <p class="mt-1 text-sm font-bold text-rose-700">−${Number(item.quantity) || 1} adet</p>
                </div>
            </div>
            <dl class="mt-4 space-y-2.5 text-sm">
                <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
                    <dt class="text-slate-500 shrink-0">Sebep</dt>
                    <dd class="text-right font-medium text-slate-800">${this._esc(item.reason_preset || '—')}</dd>
                </div>
                ${item.reason_note ? `<div class="flex justify-between gap-3 border-b border-slate-100 pb-2"><dt class="text-slate-500 shrink-0">Not</dt><dd class="text-right text-slate-800 [overflow-wrap:anywhere]">${this._esc(item.reason_note)}</dd></div>` : ''}
                <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
                    <dt class="text-slate-500 shrink-0">Tarih</dt>
                    <dd class="text-right text-slate-800">${this._esc(this._formatDate(item.event_date || item.created_at))}</dd>
                </div>
                <div class="flex justify-between gap-3 border-b border-slate-100 pb-2">
                    <dt class="text-slate-500 shrink-0">Alınacak mı?</dt>
                    <dd class="text-right font-medium ${item.pickup_required ? 'text-violet-700' : 'text-slate-600'}">${item.pickup_required ? 'Evet' : 'Hayır'}</dd>
                </div>
                ${item.address ? `<div class="flex justify-between gap-3 border-b border-slate-100 pb-2"><dt class="text-slate-500 shrink-0">Adres</dt><dd class="text-right text-slate-800 [overflow-wrap:anywhere]">${this._esc(item.address)}</dd></div>` : ''}
                ${barcodeText ? `<div class="flex justify-between gap-3"><dt class="text-slate-500 shrink-0">Barkod</dt><dd class="text-right text-xs text-slate-600 [overflow-wrap:anywhere]">${this._esc(barcodeText)}</dd></div>` : ''}
            </dl>`;

        sheet.classList.remove('hidden');
        requestAnimationFrame(() => sheet.classList.add('agenda-sheet-open'));
    }

    closeDetailSheet() {
        const sheet = document.getElementById('detailSheet');
        if (!sheet) return;
        sheet.classList.remove('agenda-sheet-open');
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
        if (window.showToast) window.showToast(msg, type);
        else if (type === 'error') alert(msg);
    }
}

window.dispatchAgendaApp = new DispatchAgendaApp();
