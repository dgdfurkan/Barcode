/**
 * Ajanda: müşteriye eksik giden ve fazla giden/gelen ürünler (premium: urunAjandasi)
 * ============================================================================
 *
 * Kart Ürün Arama'daki kartın sade hâli:
 *   sol üst  stok düğmesi (js/urun-stok.js), basınca anlık stok
 *   sağ üst  eksik (−3) ya da fazla (+2) adet
 *   sağ alt  ürün hareketi (js/urun-hareketi.js): son transfer, son satış, bugün gelen paletler
 *   fotoğraf büyür (js/urun-foto.js); ad ve barkoda basınca kayıt düzenlenir
 *
 * Eksik/fazla ayrımı ayrı bir sütun değil: fazla kayıtlarda reason_preset
 * "Fazla Ürün". Şema değişmeden eski kayıtlar eksik olarak okunuyor.
 * Düzenlemede adet, durum (eksik ↔ fazla), tarih, sebep ve not değişir;
 * "Tamamlandı" kaydı siler.
 * ============================================================================
 */
class DispatchAgendaApp {
    constructor() {
        this.EKSIK_SEBEPLER = ['Eksik Ürün', 'Yanlış Adet', 'Hasarlı', 'Diğer'];
        this.FAZLA = 'Fazla Ürün';
        this.items = [];
        this.allProducts = [];
        this.productIndex = new Map();
        this.suzgec = 'hepsi';
        this.form = null;          // { mod: 'ekle' | 'duzenle', item, urun, tur, sebep, ilk }
        this._username = null;
        this._eventsBound = false;
        this._ready = false;
        this._searchDebounce = null;
        this._searchHighlight = -1;
        this._yuklemeHatali = false;
    }

    async init() {
        this._bindEvents();

        const session = window.authUtils?.checkAuth();
        if (!session) {
            this._show('noAuth');
            return;
        }
        this._username = session.username;
        const hesap = document.getElementById('headerUserName');
        if (hesap) hesap.textContent = session.username || '';

        await this._waitForDb();

        try {
            if (window.premiumFeatures) await window.premiumFeatures.init();
        } catch (e) {
            console.error('Premium yüklenemedi:', e);
        }
        if (!window.premiumFeatures?.checkPremiumFeature('urunAjandasi')) {
            try { await window.premiumFeatures?.loadPremiumFeatures(); } catch (e) { /* ignore */ }
        }
        if (!window.premiumFeatures?.checkPremiumFeature('urunAjandasi')) {
            this._show('noPremium');
            return;
        }

        this._ready = true;
        this._show('mainContent');
        this._iskeletCiz();

        window.JBUrunHareketi?.saglayici((id) => this._hareketUrunu(id));

        await this._loadProducts();
        await this.loadItems();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this._ready && !this.form && !this._yaziyor) void this.loadItems();
        });
    }

    async _waitForDb(maxWait = 10000) {
        if (typeof window.jetbarkodWaitForDb === 'function') {
            await window.jetbarkodWaitForDb(maxWait);
            return;
        }
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            if (window.jbDb?.from) return;
            await new Promise((r) => setTimeout(r, 100));
        }
    }

    _show(id) {
        ['noAuth', 'noPremium', 'mainContent'].forEach((k) => {
            const el = document.getElementById(k);
            if (el) el.hidden = k !== id;
        });
    }

    // ==================================================================
    // Ürün kataloğu ve arama
    // ==================================================================

    _productId(p) { return p?.id || p?.productId || null; }
    _productName(p) { return p?.name || p?.productName || 'Ürün'; }
    _productImage(p) { return p?.image || p?.imageUrl || ''; }

    _barkodlar(liste) {
        return (Array.isArray(liste) ? liste : [])
            .map((b) => (b && typeof b === 'object' ? b.code : b))
            .filter(Boolean)
            .map(String);
    }

    _productBarcode(p) { return this._barkodlar(p?.barcodes)[0] || ''; }

    async _loadProducts() {
        try {
            if (window.userDataManager) {
                await window.userDataManager.init();
                this.allProducts = window.userDataManager.getAllProducts(true) || [];
            }
            if ((!this.allProducts || !this.allProducts.length) && typeof PRODUCTS_DATA !== 'undefined') {
                this.allProducts = PRODUCTS_DATA.products || [];
            }
        } catch (e) {
            console.error('Ürün kataloğu yüklenemedi:', e);
            this.allProducts = typeof PRODUCTS_DATA !== 'undefined' ? PRODUCTS_DATA.products || [] : [];
        }
        this.productIndex = new Map();
        for (const p of this.allProducts || []) {
            const id = this._productId(p);
            if (id) this.productIndex.set(String(id), p);
        }
    }

    /*
     * Arama metnini sadeleştirir: Türkçe harfler karşılıklarına iner, noktalama
     * boşluğa döner. "sutas" yazan "Sütaş"ı bulur. Arama ve sayım sayfasıyla
     * aynı kural.
     */
    _sadelestir(metin) {
        if (!metin) return '';
        if (!this._sadeOnbellek) this._sadeOnbellek = new Map();
        const hazir = this._sadeOnbellek.get(metin);
        if (hazir !== undefined) return hazir;
        const HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };
        const sonuc = String(metin)
            .toLocaleLowerCase('tr')
            .replace(/[ığüşöçâîû]/g, (h) => HARF[h] || h)
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (this._sadeOnbellek.size < 40000) this._sadeOnbellek.set(metin, sonuc);
        return sonuc;
    }

    _urunMetni(p) {
        if (!this._urunMetinleri) this._urunMetinleri = new WeakMap();
        const hazir = this._urunMetinleri.get(p);
        if (hazir !== undefined) return hazir;
        const metin = this._sadelestir(`${this._productName(p)} ${p.brand || ''} ${this._barkodlar(p.barcodes).join(' ')} ${this._productId(p)}`);
        this._urunMetinleri.set(p, metin);
        return metin;
    }

    _searchProducts(query, limit = 30) {
        const sade = this._sadelestir(query);
        const enAz = /^\d/.test(sade) ? 1 : 2;
        if (sade.length < enAz) return [];
        const tokens = sade.split(' ').filter(Boolean);
        if (!tokens.length) return [];
        const results = [];
        for (const p of this.allProducts || []) {
            if (!this._productId(p)) continue;
            const metin = this._urunMetni(p);
            if (tokens.every((t) => metin.indexOf(t) !== -1)) results.push(p);
            if (results.length >= limit) break;
        }
        return results;
    }

    /* Aynı ürünler tekrar tekrar giriliyor; kutu boşken son eklenenler duruyor */
    _sonEklenenler(adet = 6) {
        const gorulen = new Set();
        const cikti = [];
        for (const item of this.items || []) {
            const pid = String(item.product_id || '');
            if (!pid || gorulen.has(pid)) continue;
            const p = this.productIndex.get(pid);
            if (!p) continue;
            gorulen.add(pid);
            cikti.push(p);
            if (cikti.length >= adet) break;
        }
        return cikti;
    }

    /* Eşleşen parçayı işaretler. Sadeleştirmede uzunluk değiştiği için konum haritası tutulur. */
    _sadeHarita(metin) {
        const HARF = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };
        let sade = '';
        const konum = [];
        let bosluktaydi = true;
        for (let i = 0; i < metin.length; i++) {
            let ch = metin[i].toLocaleLowerCase('tr');
            ch = HARF[ch] || ch;
            if (/[a-z0-9]/.test(ch)) {
                sade += ch; konum.push(i); bosluktaydi = false;
            } else if (!bosluktaydi) {
                sade += ' '; konum.push(i); bosluktaydi = true;
            }
        }
        while (sade.endsWith(' ')) { sade = sade.slice(0, -1); konum.pop(); }
        return { sade, konum };
    }

    _vurgula(ad, sorgu) {
        const tokens = this._sadelestir(sorgu).split(' ').filter(Boolean);
        if (!tokens.length) return this._esc(ad);
        const { sade, konum } = this._sadeHarita(ad);
        const isaret = new Array(ad.length).fill(false);
        for (const t of tokens) {
            let bas = sade.indexOf(t);
            while (bas !== -1) {
                for (let i = bas; i < bas + t.length && i < konum.length; i++) isaret[konum[i]] = true;
                bas = sade.indexOf(t, bas + t.length);
            }
        }
        let cikti = '';
        let acik = false;
        for (let i = 0; i < ad.length; i++) {
            if (isaret[i] && !acik) { cikti += '<mark>'; acik = true; }
            else if (!isaret[i] && acik) { cikti += '</mark>'; acik = false; }
            cikti += this._esc(ad[i]);
        }
        if (acik) cikti += '</mark>';
        return cikti;
    }

    // ==================================================================
    // Kayıtlar
    // ==================================================================

    _fazlaMi(item) { return /^fazla/i.test(String(item?.reason_preset || '')); }

    async loadItems(retry = 0) {
        if (!this._username) return;
        if (!window.jbDb?.from) {
            if (retry < 3) {
                await this._waitForDb(3000);
                return this.loadItems(retry + 1);
            }
            this._yuklemeHatali = true;
            this._listeCiz();
            return;
        }
        try {
            const { data, error } = await window.jbDb
                .from('dispatch_agenda_items')
                .select('*')
                .eq('username', this._username)
                .order('created_at', { ascending: false });
            if (error) throw error;
            this.items = Array.isArray(data) ? data : [];
            this._yuklemeHatali = false;
            await this._hatirlaticiyiEsitle();
        } catch (e) {
            console.error('Ajanda yüklenemedi:', e);
            this._yuklemeHatali = true;
        }
        this._listeCiz();
        this._derinBaglantiyiAc();
    }

    _dateKey(item) {
        const raw = item?.event_date || item?.created_at;
        if (!raw) return '0000-00-00';
        const s = String(raw);
        if (/^\d{4}-\d{2}-\d{2}/.test(s) && !s.includes('T')) return s.slice(0, 10);
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return s.slice(0, 10);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _gunBasligi(key) {
        const d = new Date(`${key}T12:00:00`);
        if (Number.isNaN(d.getTime())) return { ad: 'Tarihsiz', alt: '' };
        const bugun = new Date(); bugun.setHours(12, 0, 0, 0);
        const fark = Math.round((bugun - d) / 86400000);
        const tam = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
        if (fark === 0) return { ad: 'Bugün', alt: tam };
        if (fark === 1) return { ad: 'Dün', alt: tam };
        return { ad: tam, alt: d.getFullYear() !== bugun.getFullYear() ? String(d.getFullYear()) : '' };
    }

    _gruplar(liste) {
        const sirali = [...liste].sort((a, b) => {
            const ka = this._dateKey(a);
            const kb = this._dateKey(b);
            if (ka !== kb) return kb.localeCompare(ka);
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        const gruplar = new Map();
        for (const item of sirali) {
            const k = this._dateKey(item);
            if (!gruplar.has(k)) gruplar.set(k, []);
            gruplar.get(k).push(item);
        }
        return [...gruplar.entries()];
    }

    _iskeletCiz() {
        const el = document.getElementById('agendaCardStrip');
        if (!el) return;
        const kart = `<div class="aj-kart aj-iskelet" aria-hidden="true">
                <div class="aj-kart__gorsel"><span class="aj-isk aj-isk--gorsel"></span></div>
                <div class="aj-kart__govde"><span class="aj-isk aj-isk--satir"></span><span class="aj-isk aj-isk--satir aj-isk--kisa"></span></div>
            </div>`;
        el.setAttribute('aria-busy', 'true');
        el.innerHTML = `<section class="aj-gun"><div class="aj-gun__bas"><span class="aj-isk aj-isk--satir" style="width:96px"></span></div><div class="aj-izgara">${kart.repeat(6)}</div></section>`;
    }

    _listeCiz() {
        const el = document.getElementById('agendaCardStrip');
        if (!el) return;
        el.setAttribute('aria-busy', 'false');

        const eksik = this.items.filter((x) => !this._fazlaMi(x));
        const fazla = this.items.filter((x) => this._fazlaMi(x));
        const say = { hepsi: this.items.length, eksik: eksik.length, fazla: fazla.length };
        document.querySelectorAll('[data-say]').forEach((b) => { b.textContent = String(say[b.getAttribute('data-say')] || 0); });
        const ozet = document.getElementById('ajOzet');
        if (ozet) {
            ozet.textContent = this.items.length
                ? [eksik.length ? `${eksik.length} eksik` : '', fazla.length ? `${fazla.length} fazla` : ''].filter(Boolean).join(' · ') + ' kayıt açık.'
                : 'Müşteriye eksik giden ve fazla gelen ürünler.';
        }

        if (this._yuklemeHatali && !this.items.length) {
            el.innerHTML = `<div class="aj-bos aj-bos--hata">
                <span class="aj-bos__im"><svg viewBox="0 0 24 24"><path d="M10.3 4.3 2.5 18a1.5 1.5 0 0 0 1.3 2.2h16.4A1.5 1.5 0 0 0 21.5 18L13.7 4.3a1.5 1.5 0 0 0-2.6 0z"/><path d="M12 9.5v4M12 17h.01"/></svg></span>
                <strong>Kayıtlar yüklenemedi</strong><p>Bağlantı koptu ya da sunucu cevap vermedi.</p>
                <button type="button" class="aj-dugme" data-aj-yenile>Tekrar Dene</button></div>`;
            return;
        }

        const liste = this.suzgec === 'eksik' ? eksik : this.suzgec === 'fazla' ? fazla : this.items;
        if (!liste.length) {
            const bos = this.items.length
                ? { b: this.suzgec === 'eksik' ? 'Eksik kayıt yok' : 'Fazla kayıt yok', p: 'Bu süzgeçte gösterilecek ürün kalmadı.', d: '' }
                : { b: 'Ajanda boş', p: 'Müşteriye eksik ya da fazla giden ürünü ekle, bulununca Tamamlandı de.', d: '<button type="button" class="aj-dugme aj-dugme--ana" data-aj-ekle><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg><span>Ürün Ekle</span></button>' };
            el.innerHTML = `<div class="aj-bos">
                <span class="aj-bos__im"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg></span>
                <strong>${bos.b}</strong><p>${bos.p}</p>${bos.d}</div>`;
            return;
        }

        el.innerHTML = this._gruplar(liste).map(([key, kayitlar]) => {
            const g = this._gunBasligi(key);
            return `<section class="aj-gun" data-date-key="${this._esc(key)}">
                <div class="aj-gun__bas"><h2>${this._esc(g.ad)}</h2><span>${this._esc([g.alt, `${kayitlar.length} ürün`].filter(Boolean).join(' · '))}</span></div>
                <div class="aj-izgara" role="list">${kayitlar.map((it) => this._kart(it)).join('')}</div>
            </section>`;
        }).join('');
    }

    _kartBarkodu(item) {
        const kayitli = this._barkodlar(item.barcodes)[0];
        if (kayitli) return kayitli;
        return this._productBarcode(this.productIndex.get(String(item.product_id)));
    }

    _kartGorseli(item) {
        return item.product_image || this._productImage(this.productIndex.get(String(item.product_id))) || '';
    }

    _kart(item) {
        const id = this._esc(item.id);
        const ad = this._esc(item.product_name || 'Ürün');
        const adet = Number(item.quantity) || 1;
        const fazla = this._fazlaMi(item);
        const gorsel = this._kartGorseli(item);
        const barkod = this._kartBarkodu(item);
        const pid = String(item.product_id || '');
        const isaretler = [];
        if (this._hatirlaticiAcikMi(item)) isaretler.push(`<span class="aj-isaret aj-isaret--zil">${this._zilSvg()}Hatırlatıcı</span>`);
        if (item.pickup_required) isaretler.push('<span class="aj-isaret aj-isaret--al">Alınacak</span>');
        const sebep = String(item.reason_preset || '');
        if (!fazla && sebep && !/^eksik ürün$/i.test(sebep)) isaretler.push(`<span class="aj-isaret">${this._esc(sebep)}</span>`);
        return `
            <article class="aj-kart" data-item-id="${id}" role="listitem">
                <div class="aj-kart__gorsel">
                    <button type="button" class="aj-kart__foto" data-aj-foto="${id}" aria-label="${ad} fotoğrafını büyüt" ${gorsel ? '' : 'disabled'}>
                        <img src="${this._esc(gorsel || '../assets/logo.png')}" alt="" loading="lazy" decoding="async">
                    </button>
                    ${window.JBUrunStok ? window.JBUrunStok.dugme(pid) : ''}
                    <span class="aj-adet${fazla ? ' is-fazla' : ''}" aria-label="${adet} adet ${fazla ? 'fazla' : 'eksik'}">${fazla ? '+' : '−'}${adet}</span>
                    ${window.JBUrunHareketi ? window.JBUrunHareketi.dugme({ id: pid }) : ''}
                </div>
                <button type="button" class="aj-kart__govde" data-aj-duzenle="${id}" aria-label="${ad}, düzenle">
                    <span class="aj-kart__ad">${ad}</span>
                    <span class="aj-kart__barkod">${this._esc(barkod || 'Barkod yok')}</span>
                    ${isaretler.length ? `<span class="aj-kart__isaret">${isaretler.join('')}</span>` : ''}
                </button>
            </article>`;
    }

    _hareketUrunu(id) {
        const item = this.items.find((x) => String(x.product_id) === String(id));
        const p = this.productIndex.get(String(id));
        return {
            id,
            ad: item?.product_name || this._productName(p),
            gorsel: item ? this._kartGorseli(item) : this._productImage(p),
            barkod: item ? this._kartBarkodu(item) : this._productBarcode(p)
        };
    }

    // ==================================================================
    // Olaylar
    // ==================================================================

    _bindEvents() {
        if (this._eventsBound) return;
        this._eventsBound = true;

        document.getElementById('agendaAddBtn')?.addEventListener('click', () => this.openAddModal());

        document.getElementById('ajSuzgec')?.addEventListener('click', (e) => {
            const b = e.target.closest('[data-suzgec]');
            if (!b) return;
            this.suzgec = b.getAttribute('data-suzgec');
            document.querySelectorAll('#ajSuzgec [data-suzgec]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
            this._listeCiz();
        });

        document.getElementById('agendaCardStrip')?.addEventListener('click', (e) => {
            if (e.target.closest('[data-aj-ekle]')) { this.openAddModal(); return; }
            if (e.target.closest('[data-aj-yenile]')) { this._iskeletCiz(); void this.loadItems(); return; }
            const foto = e.target.closest('[data-aj-foto]');
            if (foto) {
                const item = this.items.find((x) => String(x.id) === foto.getAttribute('data-aj-foto'));
                const g = item && this._kartGorseli(item);
                if (g && window.JBUrunFoto) window.JBUrunFoto.ac(g, item.product_name || '');
                return;
            }
            const d = e.target.closest('[data-aj-duzenle]');
            if (d) {
                const item = this.items.find((x) => String(x.id) === d.getAttribute('data-aj-duzenle'));
                if (item) this.openDetailSheet(item);
            }
        });

        const perde = document.getElementById('ajForm');
        perde?.addEventListener('click', (e) => {
            if (e.target === perde || e.target.closest('[data-aj-kapat]')) { void this.formKapat(); return; }
            const tur = e.target.closest('[data-tur]');
            if (tur) { this._turSec(tur.getAttribute('data-tur')); return; }
            const cip = e.target.closest('#addReasonPills [data-reason]');
            if (cip) { this._sebepSec(cip.getAttribute('data-reason')); return; }
            const adim = e.target.closest('[data-adim]');
            if (adim) { this._adimla(Number(adim.getAttribute('data-adim'))); return; }
            const sonuc = e.target.closest('[data-pick-id]');
            if (sonuc) {
                const p = this.productIndex.get(String(sonuc.getAttribute('data-pick-id')));
                if (p) this._urunSec(p);
            }
        });
        perde?.addEventListener('input', () => this._degisimDenetle());
        perde?.addEventListener('change', () => this._degisimDenetle());

        document.getElementById('addClearProductBtn')?.addEventListener('click', () => this._urunBirak());
        document.getElementById('addModalSave')?.addEventListener('click', () => void this.kaydet());
        document.getElementById('detailDeleteBtn')?.addEventListener('click', () => void this.completeAndDelete());
        document.getElementById('ajUrunFoto')?.addEventListener('click', () => {
            const u = this.form?.urun;
            if (u?.gorsel && window.JBUrunFoto) window.JBUrunFoto.ac(u.gorsel, u.ad);
        });
        document.getElementById('addSelectedBarcode')?.addEventListener('click', (e) => {
            const t = e.currentTarget.textContent.trim();
            if (!t) return;
            navigator.clipboard?.writeText(t).then(() => window.JBDiyalog?.bildir('Barkod kopyalandı', 'basari', 1800), () => {});
        });
        document.getElementById('addPickupRequired')?.addEventListener('change', (e) => {
            document.getElementById('ajAdresAlan').hidden = !e.target.checked;
        });

        const ara = document.getElementById('addProductSearch');
        if (ara) {
            ara.addEventListener('input', () => {
                clearTimeout(this._searchDebounce);
                this._searchDebounce = setTimeout(() => this._sonuclariCiz(ara.value), 120);
            });
            ara.addEventListener('keydown', (e) => this._handleSearchKeydown(e));
        }

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !this.form) return;
            if (document.querySelector('.uf-perde') || document.body.classList.contains('jbd-acik')) return;
            void this.formKapat();
        });
    }

    // ==================================================================
    // Form: ekle ve düzenle tek pencerede
    // ==================================================================

    _formAc(baslik) {
        const perde = document.getElementById('ajForm');
        document.getElementById('ajFormBaslik').textContent = baslik;
        perde.hidden = false;
        document.documentElement.classList.add('aj-acik');
        requestAnimationFrame(() => perde.classList.add('is-acik'));
    }

    async formKapat(zorla) {
        if (!this.form) return;
        if (!zorla && this.form.mod === 'duzenle' && this._degistiMi()) {
            const tamam = await window.JBDiyalog?.onay('Yaptığın değişiklikler kaydedilmedi.', { baslik: 'Kaydetmeden çıkılsın mı?', onayYazi: 'Çık', vazgecYazi: 'Kal' });
            if (!tamam) return;
        }
        this.form = null;
        const perde = document.getElementById('ajForm');
        perde.classList.remove('is-acik');
        document.documentElement.classList.remove('aj-acik');
        let bitti = false;
        const bitir = () => { if (bitti) return; bitti = true; if (!this.form) perde.hidden = true; };
        perde.addEventListener('transitionend', bitir, { once: true });
        setTimeout(bitir, 260);
    }

    openAddModal() {
        if (!this._ready) return;
        this.form = { mod: 'ekle', item: null, urun: null, tur: 'eksik', sebep: this.EKSIK_SEBEPLER[0], ilk: null };
        document.getElementById('ajAra').hidden = false;
        document.getElementById('ajFormAlan').hidden = true;
        document.getElementById('ajFormAyak').hidden = true;
        document.getElementById('detailDeleteBtn').hidden = true;
        document.getElementById('addClearProductBtn').hidden = false;
        const ara = document.getElementById('addProductSearch');
        ara.value = '';
        this._sonuclariCiz('');
        this._formAc('Ürün Ekle');
        document.getElementById('ajFormGovde').scrollTop = 0;
        setTimeout(() => ara.focus(), 60);
    }

    openDetailSheet(item) {
        const p = this.productIndex.get(String(item.product_id));
        const fazla = this._fazlaMi(item);
        this.form = {
            mod: 'duzenle',
            item,
            urun: { id: String(item.product_id), ad: item.product_name || this._productName(p), gorsel: this._kartGorseli(item), barkod: this._kartBarkodu(item) },
            tur: fazla ? 'fazla' : 'eksik',
            sebep: fazla ? this.EKSIK_SEBEPLER[0] : (this.EKSIK_SEBEPLER.find((s) => s.toLocaleLowerCase('tr') === String(item.reason_preset || '').toLocaleLowerCase('tr')) || this.EKSIK_SEBEPLER[0]),
            ilk: null
        };
        document.getElementById('ajAra').hidden = true;
        document.getElementById('addClearProductBtn').hidden = true;
        this._formDoldur({
            adet: Number(item.quantity) || 1,
            tarih: this._dateKey(item),
            not: item.reason_note || '',
            al: !!item.pickup_required,
            adres: item.address || '',
            zil: this._hatirlaticiAcikMi(item)
        });
        document.getElementById('detailDeleteBtn').hidden = false;
        this._formAc('Kaydı Düzenle');
        document.getElementById('ajFormGovde').scrollTop = 0;
        this.form.ilk = this._formDegeri();
        this._degisimDenetle();
    }

    _formDoldur(v) {
        const u = this.form.urun;
        document.getElementById('addSelectedImg').src = u.gorsel || '../assets/logo.png';
        document.getElementById('ajUrunFoto').disabled = !u.gorsel;
        document.getElementById('addSelectedName').textContent = u.ad || 'Ürün';
        document.getElementById('addSelectedBarcode').textContent = u.barkod || '';
        document.getElementById('addQuantity').value = String(v.adet);
        document.getElementById('addEventDate').value = v.tarih;
        document.getElementById('addReasonNote').value = v.not;
        document.getElementById('addPickupRequired').checked = v.al;
        document.getElementById('addAddress').value = v.adres;
        document.getElementById('ajAdresAlan').hidden = !v.al;
        document.getElementById('addReminder').checked = v.zil;
        this._turSec(this.form.tur);
        this._sebepSec(this.form.sebep);
        document.getElementById('ajFormAlan').hidden = false;
        document.getElementById('ajFormAyak').hidden = false;
    }

    _bugun() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _urunSec(p) {
        if (!this.form) return;
        this.form.urun = { id: String(this._productId(p)), ad: this._productName(p), gorsel: this._productImage(p), barkod: this._productBarcode(p), barkodlar: Array.isArray(p.barcodes) ? p.barcodes : [] };
        document.getElementById('ajAra').hidden = true;
        this._formDoldur({ adet: 1, tarih: this._bugun(), not: '', al: false, adres: '', zil: false });
        this._degisimDenetle();
        setTimeout(() => { const q = document.getElementById('addQuantity'); q.focus(); q.select(); }, 60);
    }

    _urunBirak() {
        if (!this.form || this.form.mod !== 'ekle') return;
        this.form.urun = null;
        document.getElementById('ajFormAlan').hidden = true;
        document.getElementById('ajFormAyak').hidden = true;
        document.getElementById('ajAra').hidden = false;
        const ara = document.getElementById('addProductSearch');
        this._sonuclariCiz(ara.value);
        ara.focus();
    }

    _turSec(tur) {
        if (!this.form) return;
        this.form.tur = tur === 'fazla' ? 'fazla' : 'eksik';
        document.querySelectorAll('#ajForm [data-tur]').forEach((b) => b.setAttribute('aria-checked', String(b.getAttribute('data-tur') === this.form.tur)));
        document.getElementById('ajSebepAlan').hidden = this.form.tur === 'fazla';
        this._degisimDenetle();
    }

    _sebepSec(sebep) {
        if (!this.form) return;
        this.form.sebep = this.EKSIK_SEBEPLER.includes(sebep) ? sebep : this.EKSIK_SEBEPLER[0];
        document.querySelectorAll('#addReasonPills [data-reason]').forEach((b) => {
            const secili = b.getAttribute('data-reason') === this.form.sebep;
            b.classList.toggle('is-active', secili);
            b.setAttribute('aria-pressed', String(secili));
        });
        this._degisimDenetle();
    }

    _adimla(fark) {
        const q = document.getElementById('addQuantity');
        const n = Math.min(999, Math.max(1, (parseInt(q.value, 10) || 1) + fark));
        q.value = String(n);
        this._degisimDenetle();
    }

    _formDegeri() {
        return {
            adet: parseInt(document.getElementById('addQuantity').value, 10) || 0,
            tur: this.form.tur,
            sebep: this.form.tur === 'fazla' ? this.FAZLA : this.form.sebep,
            tarih: document.getElementById('addEventDate').value || null,
            not: (document.getElementById('addReasonNote').value || '').trim(),
            al: document.getElementById('addPickupRequired').checked,
            adres: (document.getElementById('addAddress').value || '').trim(),
            zil: document.getElementById('addReminder').checked
        };
    }

    _degistiMi() {
        if (!this.form?.ilk) return true;
        return JSON.stringify(this._formDegeri()) !== JSON.stringify(this.form.ilk);
    }

    _degisimDenetle() {
        const btn = document.getElementById('addModalSave');
        if (!btn || !this.form) return;
        const v = this.form.urun ? this._formDegeri() : null;
        const gecerli = !!v && v.adet >= 1 && v.adet <= 999;
        btn.disabled = !gecerli || (this.form.mod === 'duzenle' && !this._degistiMi());
    }

    /**
     * Ekle, güncelle ve Tamamlandı ekranı beklemez: liste hemen değişir,
     * pencere hemen kapanır, yazma arkada gider. Yazma düşerse kayıt eski
     * hâline döner ve uyarı çıkar. Kimliği tarayıcı üretir (sütun UUID).
     */
    _yeniKimlik() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        const b = window.crypto.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 15) | 64;
        b[8] = (b[8] & 63) | 128;
        const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }

    /** Arama sayfasındaki zilin okuduğu önbellek; ağ yok. */
    _zilOnbellegi() {
        const H = window.JBAjandaHatirlatici;
        if (H) H.onbellekYaz(this.items.filter((it) => H.aciklarMi(it, this._username)), this._username);
    }

    async _arkadaYaz(is, geriAl, hataYazi) {
        this._yaziyor = (this._yaziyor || 0) + 1;
        try {
            await is();
        } catch (e) {
            console.error(e);
            geriAl();
            this._listeCiz();
            this._zilOnbellegi();
            window.JBDiyalog?.bildir(hataYazi, 'hata');
        } finally {
            this._yaziyor--;
        }
    }

    kaydet() {
        if (!this.form?.urun) return;
        const v = this._formDegeri();
        if (v.adet < 1 || v.adet > 999) {
            window.JBDiyalog?.bildir('Adet 1 ile 999 arasında olmalı', 'uyari');
            return;
        }
        const H = window.JBAjandaHatirlatici;
        const ortak = {
            quantity: v.adet,
            reason_preset: v.sebep,
            reason_note: v.not || null,
            pickup_required: v.al,
            address: v.al ? (v.adres || null) : null,
            event_date: v.tarih,
            updated_at: new Date().toISOString()
        };
        const mod = this.form.mod;
        const ilkZil = this.form.ilk?.zil;
        const u = this.form.urun;
        const eski = this.form.item;
        void this.formKapat(true);

        if (mod === 'ekle') {
            const row = {
                id: this._yeniKimlik(),
                username: this._username,
                product_id: u.id,
                product_name: u.ad,
                product_image: u.gorsel || null,
                barcodes: u.barkodlar || [],
                ...ortak
            };
            this.items.unshift({ ...row, created_at: ortak.updated_at, ...(v.zil ? { reminder: true } : {}) });
            if (H) H.eklendi(row.id, v.zil);
            this._listeCiz();
            this._zilOnbellegi();
            window.JBDiyalog?.bildir(`${v.tur === 'fazla' ? 'Fazla' : 'Eksik'} kaydı eklendi`, 'basari');
            void this._arkadaYaz(async () => {
                if (v.zil && H) await H.kolonVarMi();
                const { error } = await window.jbDb.from('dispatch_agenda_items').insert({ ...row, ...(H ? H.eklemeAlani(v.zil) : {}) });
                if (error) throw error;
            }, () => {
                this.items = this.items.filter((x) => x.id !== row.id);
                if (H) H.kaldirildi(row.id);
            }, 'Kayıt eklenemedi');
            return;
        }

        const once = { ...eski };
        Object.assign(eski, ortak);
        if (v.zil !== ilkZil) eski.reminder = v.zil;
        this._listeCiz();
        this._zilOnbellegi();
        window.JBDiyalog?.bildir('Kayıt güncellendi', 'basari');
        void this._arkadaYaz(async () => {
            const { error } = await window.jbDb.from('dispatch_agenda_items').update(ortak).eq('id', eski.id).eq('username', this._username);
            if (error) throw error;
            if (H && v.zil !== ilkZil) await H.ayarla(eski.id, v.zil);
        }, () => {
            Object.keys(eski).forEach((k) => { delete eski[k]; });
            Object.assign(eski, once);
        }, 'Kayıt güncellenemedi');
    }

    async completeAndDelete() {
        const item = this.form?.item;
        if (!item?.id) return;
        const tamam = await window.JBDiyalog?.onay(`${item.product_name || 'Bu ürün'} ajandadan kaldırılacak.`, { baslik: 'Tamamlandı mı?', onayYazi: 'Tamamlandı', vazgecYazi: 'Vazgeç' });
        if (!tamam || this.form?.item !== item) return;
        const sira = this.items.indexOf(item);
        this.items = this.items.filter((x) => x !== item);
        void this.formKapat(true);
        this._listeCiz();
        window.JBAjandaHatirlatici?.kaldirildi(item.id);
        this._zilOnbellegi();
        window.JBDiyalog?.bildir('Kayıt kapatıldı', 'basari');
        void this._arkadaYaz(async () => {
            const { error } = await window.jbDb.from('dispatch_agenda_items').delete().eq('id', item.id).eq('username', this._username);
            if (error) throw error;
        }, () => {
            this.items.splice(Math.max(0, Math.min(sira, this.items.length)), 0, item);
            if (item.reminder) window.JBAjandaHatirlatici?.eklendi(item.id, true);
        }, 'Kayıt kapatılamadı');
    }

    // Ürün arama sonuçları

    _sonuclariCiz(sorgu) {
        const kap = document.getElementById('addProductResults');
        if (!kap) return;
        this._searchHighlight = -1;
        const q = (sorgu || '').trim();
        if (!q) {
            const son = this._sonEklenenler(6);
            kap.innerHTML = son.length
                ? '<p class="aj-sonuclar__bas">Son eklediklerin</p>' + son.map((p) => this._sonucSatiri(p, '')).join('')
                : '<p class="aj-sonuclar__bos">Ürün adı ya da barkodla ara.</p>';
            return;
        }
        if (q.length < 2 && !/^\d/.test(q)) { kap.innerHTML = '<p class="aj-sonuclar__bos">En az 2 harf yaz.</p>'; return; }
        if (!this.allProducts.length) { kap.innerHTML = '<p class="aj-sonuclar__bos">Ürün kataloğu yüklenemedi. Sayfayı yenile.</p>'; return; }
        const bulunan = this._searchProducts(q);
        if (!bulunan.length) { kap.innerHTML = '<p class="aj-sonuclar__bos">Eşleşen ürün yok.</p>'; return; }
        kap.innerHTML = `<p class="aj-sonuclar__bas">${bulunan.length >= 30 ? 'İlk 30 sonuç' : `${bulunan.length} sonuç`}</p>` + bulunan.map((p) => this._sonucSatiri(p, q)).join('');
    }

    _sonucSatiri(p, sorgu) {
        const barkod = this._productBarcode(p);
        return `<button type="button" class="aj-sonuc" role="option" data-pick-id="${this._esc(this._productId(p))}" aria-selected="false">
                <img src="${this._esc(this._productImage(p) || '../assets/logo.png')}" alt="" loading="lazy">
                <span><b>${this._vurgula(this._productName(p), sorgu)}</b>${barkod ? `<small>${this._esc(barkod)}</small>` : ''}</span>
            </button>`;
    }

    _handleSearchKeydown(e) {
        const hits = [...document.querySelectorAll('#addProductResults [data-pick-id]')];
        if (!hits.length) { if (e.key === 'Enter') e.preventDefault(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            this._searchHighlight = e.key === 'ArrowDown'
                ? Math.min(this._searchHighlight + 1, hits.length - 1)
                : Math.max(this._searchHighlight - 1, 0);
            hits.forEach((el, i) => {
                el.setAttribute('aria-selected', String(i === this._searchHighlight));
                if (i === this._searchHighlight) el.scrollIntoView({ block: 'nearest' });
            });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            hits[this._searchHighlight >= 0 ? this._searchHighlight : 0]?.click();
        }
    }

    // ==================================================================
    // Hatırlatıcı
    // ==================================================================

    _hatirlaticiAcikMi(item) {
        const H = window.JBAjandaHatirlatici;
        return !!(H && H.aciklarMi(item, this._username));
    }

    _zilSvg() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>';
    }

    /** Sütun durumunu öğren, arama sayfasının okuduğu önbelleği tazele. */
    async _hatirlaticiyiEsitle() {
        const H = window.JBAjandaHatirlatici;
        if (!H) return;
        try { await H.esitle(this.items); } catch (e) { /* ağ: yerel iz geçerli kalır */ }
        H.onbellekYaz(this.items.filter((it) => H.aciklarMi(it, this._username)), this._username);
    }

    /**
     * Arama sayfasındaki zilden ya da Ürün Hareketi penceresinden gelindiyse
     * (?kayit=<id>) o kaydı aç. Bir kez çalışır; parametre adresten silinir.
     */
    _derinBaglantiyiAc() {
        if (this._derinBaglantiBitti || this._yuklemeHatali) return;
        let id = null;
        try { id = new URLSearchParams(window.location.search).get('kayit'); } catch (e) { id = null; }
        this._derinBaglantiBitti = true;
        if (!id) return;
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('kayit');
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        } catch (e) { /* ignore */ }
        const item = this.items.find((x) => String(x.id) === String(id));
        if (!item) {
            window.JBDiyalog?.bildir('Bu kayıt artık yok', 'bilgi');
            return;
        }
        const kart = document.querySelector(`.aj-kart[data-item-id="${CSS.escape(String(id))}"]`);
        if (kart) {
            kart.scrollIntoView({ block: 'center' });
            kart.classList.add('is-vurgu');
            setTimeout(() => kart.classList.remove('is-vurgu'), 1600);
        }
        this.openDetailSheet(item);
    }

    _esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

window.dispatchAgendaApp = new DispatchAgendaApp();
