if (window.location.href.includes('/dashboard/orders')) {

    // === INJECT ===
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    (document.head || document.documentElement).appendChild(script);

    // === STATE ===
    let orderCache = {};
    try { orderCache = JSON.parse(localStorage.getItem('getir_order_cache')) || {}; } catch (e) {}

    let idMap = {};
    let fetchQueue = [];
    let fetchQueueSet = new Set(); // O(1) lookup — performans iyileştirmesi
    let isFetching = false;
    let isRadarActive = false;
    let isSettingsOpen = false;
    let editingCategoryIndex = -1;

    const DEFAULT_CATEGORIES = [
        {
            name: 'Su',
            includes: ['erikli doğal kaynak suyu', 'hayat su', 'kuzeyden doğal mineralli su', 'damla su'],
            excludes: ['kuzeyden cam', 'erikli cam'],
            color: '#0088ff'
        },
        {
            name: 'Fırın',
            includes: ['ekmek', 'la lorraine'],
            excludes: ['uno', 'untad'],
            color: '#ffff00'
        },
        {
            name: 'Dondurma',
            includes: ['cornetto', 'golf', 'buz küpü', 'algida', 'carte', 'feast', 'superfresh', 'donuk', 'dondurulmuş', 'magnum', 'eti alaska frigo', 'pela', 'dondurmalı', 'mochiko', 'mars snickers', 'bauvian', 'panda', 'dondurma', 'porsi10'],
            excludes: [],
            color: '#bb00ff'
        }
    ];

    let userSettings = [];
    try {
        const saved = localStorage.getItem('getir_settings');
        userSettings = saved ? (JSON.parse(saved) || []) : DEFAULT_CATEGORIES;
        // İlk kez yükleniyorsa default'ları kaydet
        if (!saved) localStorage.setItem('getir_settings', JSON.stringify(DEFAULT_CATEGORIES));
    } catch (e) { userSettings = DEFAULT_CATEGORIES; }

    let userToken = localStorage.getItem('getir_manual_token') || '';
    let warehouseId = '';
    const urlMatch = window.location.href.match(/\/r\/([a-f0-9]+)\//);
    if (urlMatch) warehouseId = urlMatch[1];

    // === HELPERS ===
    const saveCache = () => {
        try { localStorage.setItem('getir_order_cache', JSON.stringify(orderCache)); } catch (e) {}
    };

    const getTokenExpiry = (token) => {
        if (!token) return '⚠️ Token Yok';
        try {
            const raw = token.replace(/^Bearer\s+/i, '');
            const payload = JSON.parse(atob(raw.split('.')[1]));
            const timeLeft = Math.floor((payload.exp * 1000 - Date.now()) / 60000);
            if (timeLeft <= 0) return '⚠️ Süresi Doldu!';
            if (timeLeft < 3) return `⚠️ ${timeLeft} dk kaldı`;
            return `✅ ${timeLeft} dk kaldı`;
        } catch (e) { return '✅ Token Aktif'; }
    };

    const findOrderIds = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(findOrderIds); return; }
        if (obj.id && typeof obj.id === 'string' && obj.id.length === 24) {
            idMap[obj.id.slice(-4)] = obj.id;
        }
        Object.values(obj).forEach(findOrderIds);
    };

    // Hex → rgba dönüşümü (soft boyama için)
    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    // Cache backward compatibility (eski format: array, yeni: {products, count})
    const getProducts = (entry) => Array.isArray(entry) ? entry : (entry?.products || []);
    const getCount = (entry) => Array.isArray(entry) ? null : (entry?.count ?? null);

    // Kelime bazlı eşleşme: İ/i, I/ı ve diğer Türkçe karakterler dahil tam harf duyarsız arama
    const normalizeStr = (str) => {
        if (!str) return '';
        return str.toLocaleLowerCase('tr-TR')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/i̇/g, 'i');
    };

    const wordsMatch = (targetText, keyword) => {
        if (!targetText || !keyword) return false;
        const normTarget = normalizeStr(targetText);
        return normalizeStr(keyword).split(/\s+/).filter(Boolean).every(w => normTarget.includes(w));
    };

    // Sipariş kodu: barcode ikonlu ilk span
    const getShortCode = (card) => {
        const firstSpan = card.querySelector('.textWithIcons--hkMjY span.ant-typography');
        if (firstSpan) {
            const t = firstSpan.innerText?.trim();
            if (t && t.length === 4) return t;
        }
        // Fallback
        const span = Array.from(card.querySelectorAll('span')).find(s => {
            const t = s.innerText?.trim();
            return t && t.length === 4 && /^[a-f0-9]+$/i.test(t);
        });
        return span ? span.innerText.trim() : null;
    };

    // BNK kodu
    const getBnkCode = (card) => {
        const tag = card.querySelector('.locationContainer--PWiXO .ant-tag');
        return tag ? tag.innerText?.trim() : null;
    };

    // Bearer prefix
    const bearer = (t) => t.startsWith('Bearer') ? t : `Bearer ${t}`;
    const API_HEADERS = () => ({
        'Authorization': bearer(userToken),
        'Accept': 'application/json',
        'Countrycode': 'TR',
        'Language': 'tr',
        'X-Requester-Client': 'warehouse-panel-frontend'
    });

    // === RADAR ===
    const forceRadarFetch = async () => {
        if (isRadarActive || !userToken || !warehouseId) return;
        isRadarActive = true;
        try {
            const res = await fetch(`https://warehouse-panel-api-gateway.getirapi.com/warehouse/${warehouseId}/orders?domainType=1`, { headers: API_HEADERS() });
            if (res.ok) findOrderIds(await res.json());
        } catch (e) {}
        setTimeout(() => { isRadarActive = false; }, 5000);
    };

    // === ARAMA SONUÇLARI ===
    const renderSearchResults = (term, matches) => {
        const el = document.getElementById('getir-search-results');
        if (!el) return;
        if (!term) { el.style.display = 'none'; el.innerHTML = ''; return; }

        el.style.display = 'block';
        if (matches.length === 0) {
            el.innerHTML = `<div class="sr-empty">Hiçbir siparişte bulunamadı</div>`;
            return;
        }

        el.innerHTML = `<div class="sr-header">🔍 ${matches.length} siparişte bulundu</div>` +
            matches.map((m, i) => `
                <div class="sr-row" data-idx="${i}" style="cursor: pointer; background: ${m.bgColor || 'transparent'};">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span class="sr-bnk">${m.bnk}</span>
                        <span class="sr-courier" style="font-weight:600; color:#444; font-size:11px;">🏍️ ${m.courier}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#666;">
                        <span style="font-weight:600; color:#5d3ebc;">📦 Sipariş: ${m.count !== null ? m.count + ' Adet' : '? Adet'}</span>
                        <span class="sr-count">🔍 ${m.hitCount} ürün eşleşti</span>
                    </div>
                </div>`).join('');

        el.querySelectorAll('.sr-row').forEach(row => {
            row.addEventListener('click', () => {
                const idx = row.getAttribute('data-idx');
                const match = matches[idx];
                if (match && match.card) {
                    match.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    match.card.click();
                }
            });
        });
    };

    // === UI GÜNCELLEME ===
    const applyUI = () => {
        const term = document.getElementById('getir-search-input')?.value?.trim?.() || '';
        const cards = document.querySelectorAll('.orderCard--LDG_w');
        const matches = [];

        cards.forEach(card => {
            const code = getShortCode(card);
            if (!code) return;

            const entry = orderCache[code];
            const products = getProducts(entry);
            const count = getCount(entry);
            let colors = [];
            let isMatch = false;
            let hitCount = 0;

            if (products.length > 0) {
                userSettings.forEach(cat => {
                    const hit = products.some(p =>
                        (cat.includes || []).some(inc => wordsMatch(p, inc)) &&
                        !(cat.excludes || []).some(exc => wordsMatch(p, exc))
                    );
                    if (hit) colors.push(cat.color);
                });
                if (term) {
                    hitCount = products.filter(p => wordsMatch(p, term)).length;
                    if (hitCount > 0) isMatch = true;
                }
            }

            // Kurye, müşteri ve BNK isimlerinde ara
            const nameElements = Array.from(card.querySelectorAll('.textWithIcons--hkMjY span.ant-typography'));
            const nameTexts = nameElements.map(s => s.innerText?.trim() || '');
            const bnk = getBnkCode(card) || 'BNK.?';
            
            if (term) {
                if (nameTexts.some(t => wordsMatch(t, term))) isMatch = true;
                if (wordsMatch(bnk, term)) isMatch = true;
            }

            // --- Soft arka plan boyama hesaplaması ---
            let newBg = '';
            if (colors.length === 1) {
                newBg = hexToRgba(colors[0], 0.10);
            } else if (colors.length > 1) {
                const stops = colors.flatMap((c, i) => {
                    const p1 = Math.round((i / colors.length) * 100);
                    const p2 = Math.round(((i + 1) / colors.length) * 100);
                    return [`${hexToRgba(c, 0.12)} ${p1}%`, `${hexToRgba(c, 0.12)} ${p2}%`];
                });
                newBg = `linear-gradient(to right, ${stops.join(', ')})`;
            }

            // Eşleşenleri listeye ekle
            if (term && isMatch) {
                const courier = nameTexts.length >= 3 ? nameTexts[2] : 'Bilinmiyor';
                matches.push({ card, bnk, courier, hitCount, count, bgColor: newBg });
            }

            if (card.dataset.gBg !== newBg) {
                card.style.background = newBg;
                card.dataset.gBg = newBg;
            }

            // --- Parça sayısı badge (BNK soluna) ---
            const locationDiv = card.querySelector('.locationContainer--PWiXO');
            if (locationDiv && count !== null) {
                let badge = locationDiv.querySelector('.g-count-badge');
                const txt = `×${count}`;
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'g-count-badge';
                    locationDiv.insertBefore(badge, locationDiv.firstChild);
                }
                if (badge.innerText !== txt) badge.innerText = txt;
            }

            // --- Arama opacity ---
            const newOp = term ? (isMatch ? '1' : '0.18') : '1';
            if (card.dataset.gOpacity !== newOp) {
                card.style.opacity = newOp;
                card.dataset.gOpacity = newOp;
            }
        });

        renderSearchResults(term, matches);
    };

    // === SYNC ===
    const updateQueueStatus = () => {
        const el = document.getElementById('queue-status');
        if (el) el.innerText = `Kuyruk: ${fetchQueue.length} | Hafıza: ${Object.keys(orderCache).length} sipariş`;
    };

    const checkAndSync = () => {
        const cards = document.querySelectorAll('.orderCard--LDG_w');
        if (cards.length === 0) return;
        const visible = new Set();
        let needsRadar = false;

        cards.forEach(card => {
            const code = getShortCode(card);
            if (!code) return;
            visible.add(code);
            if (!orderCache[code]) {
                const longId = idMap[code];
                if (longId) {
                    if (!fetchQueueSet.has(longId)) {
                        fetchQueue.push(longId);
                        fetchQueueSet.add(longId);
                        if (!isFetching) processQueue();
                    }
                } else { needsRadar = true; }
            }
        });

        let deleted = false;
        Object.keys(orderCache).forEach(k => { if (!visible.has(k)) { delete orderCache[k]; deleted = true; } });
        if (deleted) saveCache();
        if (needsRadar) forceRadarFetch();
        updateQueueStatus();
    };

    // === KUYRUK İŞLEMCİ ===
    const processQueue = async () => {
        if (isFetching || fetchQueue.length === 0 || !userToken || !warehouseId) return;
        isFetching = true;
        const oId = fetchQueue.shift();
        fetchQueueSet.delete(oId);

        try {
            const res = await fetch(
                `https://warehouse-panel-api-gateway.getirapi.com/warehouse/${warehouseId}/orders/${oId}?domainType=1`,
                { headers: API_HEADERS() }
            );
            if (res.ok) {
                const d = await res.json();
                const order = d?.data?.order;
                if (order?.products && Array.isArray(order.products)) {
                    orderCache[oId.slice(-4)] = {
                        products: order.products.map(p => {
                            const n = p?.name?.tr || p?.name?.en || '';
                            return typeof n === 'string' ? n.toLowerCase() : '';
                        }).filter(Boolean),
                        count: order.basketProductCount ?? null
                    };
                    saveCache();
                    applyUI();
                }
            } else if (res.status === 401) {
                fetchQueue.unshift(oId);
                fetchQueueSet.add(oId);
                isFetching = false;
                updateQueueStatus();
                return;
            }
        } catch (e) {}

        isFetching = false;
        updateQueueStatus();
        if (fetchQueue.length > 0) setTimeout(processQueue, 1500);
    };

    // === WIDGET ===
    const buildWidget = () => {
        if (document.getElementById('getir-fab-container')) return;
        const container = document.createElement('div');
        container.id = 'getir-fab-container';
        container.innerHTML = `
            <div id="getir-fab">🔍</div>
            <div id="getir-panel" style="display:none;">
                <div class="panel-header">
                    <span>🚀 Hızlı Bul</span>
                    <div class="header-buttons">
                        <button id="getir-settings-btn" class="icon-btn">⚙️</button>
                        <button id="getir-close" class="icon-btn">✖</button>
                    </div>
                </div>

                <div class="panel-body" id="getir-main-view">
                    <div id="token-status" class="token-expiry-badge">${getTokenExpiry(userToken)}</div>
                    <div class="auto-token-note">🔄 Token otomatik alınıyor</div>
                    <input type="text" id="getir-search-input" class="custom-input search-input" placeholder="🔍 Ürün Ara...">
                    <div id="getir-search-results" class="search-results" style="display:none;"></div>
                    <div id="queue-status" class="queue-status-text">Kuyruk: 0 | Hafıza: 0 sipariş</div>
                </div>

                <div class="settings-body" id="getir-settings-view" style="display:none;">
                    <div class="settings-form">
                        <h4 style="margin:0; color:#5d3ebc;">Kategori Düzenleyici</h4>
                        <input type="text" id="cat-name" class="custom-input" placeholder="Başlık (Örn: Sular)">
                        <textarea id="cat-inc" class="custom-input" placeholder="Dahil (erikli, hayat)" rows="2"></textarea>
                        <textarea id="cat-exc" class="custom-input" placeholder="Hariç (cam, 1lt)" rows="2"></textarea>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label style="font-size:11px; font-weight:bold;">Renk:</label>
                            <input type="color" id="cat-color" value="#0088ff" style="border:none; width:40px; height:25px; cursor:pointer;">
                        </div>
                        <button id="add-category-btn" class="btn-primary">Kategoriyi Kaydet</button>
                    </div>
                    <div id="category-list"></div>
                    <div class="advanced-section">
                        <button id="toggle-advanced" class="btn-secondary-sm">🔐 Gelişmiş Ayarlar</button>
                        <div id="advanced-content" style="display:none; padding:10px; border-top:1px solid #eee;">
                            <p class="advanced-note">Token otomatik alınmaktadır. Gerekmedikçe kullanmayın.</p>
                            <input type="password" id="getir-token-input" class="custom-input" placeholder="Manuel Token">
                            <div style="display:flex; gap:5px; margin-top:6px;">
                                <button id="getir-save-token" class="btn-primary" style="flex:2">Kaydet</button>
                                <button id="getir-reset-token" class="btn-danger" style="flex:1">Sıfırla</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        document.getElementById('getir-fab').onclick = () => {
            document.getElementById('getir-fab').style.display = 'none';
            document.getElementById('getir-panel').style.display = 'flex';
            setTimeout(() => {
                document.getElementById('getir-search-input')?.focus();
            }, 50);
        };
        document.getElementById('getir-close').onclick = () => {
            document.getElementById('getir-panel').style.display = 'none';
            document.getElementById('getir-fab').style.display = 'flex';
            isSettingsOpen = false;
            document.getElementById('getir-main-view').style.display = 'flex';
            document.getElementById('getir-settings-view').style.display = 'none';
            
            const searchInput = document.getElementById('getir-search-input');
            if (searchInput) {
                searchInput.value = '';
                applyUI();
            }
        };
        document.getElementById('getir-settings-btn').onclick = () => {
            isSettingsOpen = !isSettingsOpen;
            document.getElementById('getir-main-view').style.display = isSettingsOpen ? 'none' : 'flex';
            document.getElementById('getir-settings-view').style.display = isSettingsOpen ? 'flex' : 'none';
            if (isSettingsOpen) renderCategories();
        };
        document.getElementById('toggle-advanced').onclick = () => {
            const c = document.getElementById('advanced-content');
            const open = c.style.display !== 'none';
            c.style.display = open ? 'none' : 'block';
            document.getElementById('toggle-advanced').innerText = open ? '🔐 Gelişmiş Ayarlar' : '🔐 Gizle';
        };
        document.getElementById('getir-save-token').onclick = () => {
            const val = document.getElementById('getir-token-input').value;
            if (val) {
                userToken = val.trim();
                localStorage.setItem('getir_manual_token', userToken);
                document.getElementById('token-status').innerText = getTokenExpiry(userToken);
                const btn = document.getElementById('getir-save-token');
                btn.innerText = '✅ Kaydedildi';
                setTimeout(() => { btn.innerText = 'Kaydet'; }, 2000);
                if (!isFetching && fetchQueue.length > 0) processQueue();
            }
        };
        document.getElementById('getir-reset-token').onclick = () => {
            if (confirm('Tüm hafıza silinsin mi?')) {
                ['getir_order_cache', 'getir_settings', 'getir_manual_token'].forEach(k => localStorage.removeItem(k));
                window.location.reload();
            }
        };
        document.getElementById('add-category-btn').onclick = () => {
            const name = document.getElementById('cat-name').value.trim();
            const inc = document.getElementById('cat-inc').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const exc = document.getElementById('cat-exc').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const color = document.getElementById('cat-color').value;
            if (name && inc.length > 0) {
                const cat = { name, includes: inc, excludes: exc, color };
                const idx = Number(editingCategoryIndex);
                if (idx > -1) userSettings[idx] = cat;
                else userSettings.push(cat);
                localStorage.setItem('getir_settings', JSON.stringify(userSettings));
                ['cat-name', 'cat-inc', 'cat-exc'].forEach(id => { document.getElementById(id).value = ''; });
                editingCategoryIndex = -1;
                document.getElementById('add-category-btn').innerText = 'Kategoriyi Kaydet';
                renderCategories();
                applyUI();
            }
        };
        document.getElementById('getir-search-input').oninput = () => applyUI();
    };

    const renderCategories = () => {
        const list = document.getElementById('category-list');
        if (!list) return;
        if (userSettings.length === 0) {
            list.innerHTML = `<div style="text-align:center;color:#999;font-size:12px;padding:10px;">Henüz kategori yok.</div>`;
            return;
        }
        list.innerHTML = userSettings.map((cat, idx) => `
            <div class="category-card" style="border-left-color:${cat.color};background:${hexToRgba(cat.color, 0.07)}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <strong style="font-size:13px;">${cat.name}</strong>
                    <div style="display:flex;gap:4px;">
                        <button class="action-btn edit-btn" data-idx="${idx}">✏️</button>
                        <button class="action-btn del-btn" data-idx="${idx}">🗑️</button>
                    </div>
                </div>
                <div style="margin-top:5px;">${cat.includes.map(k => `<span class="badge inc">+ ${k}</span>`).join('')}</div>
                ${(cat.excludes || []).length > 0 ? `<div>${cat.excludes.map(k => `<span class="badge exc">- ${k}</span>`).join('')}</div>` : ''}
            </div>
        `).join('');

        list.querySelectorAll('.del-btn').forEach(btn => {
            btn.onclick = (e) => {
                userSettings.splice(Number(e.currentTarget.getAttribute('data-idx')), 1);
                localStorage.setItem('getir_settings', JSON.stringify(userSettings));
                renderCategories(); applyUI();
            };
        });
        list.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = Number(e.currentTarget.getAttribute('data-idx'));
                const cat = userSettings[idx];
                document.getElementById('cat-name').value = cat.name;
                document.getElementById('cat-inc').value = cat.includes.join(', ');
                document.getElementById('cat-exc').value = (cat.excludes || []).join(', ');
                document.getElementById('cat-color').value = cat.color;
                editingCategoryIndex = idx;
                document.getElementById('add-category-btn').innerText = 'Güncelle';
                document.getElementById('getir-settings-view').scrollTop = 0;
            };
        });
    };

    // === MESAJ DİNLEYİCİ ===
    window.addEventListener('message', (event) => {
        if (!event.data || event.source !== window) return;
        if (event.data.type === 'GETIR_DATA_RECEIVED') findOrderIds(event.data.payload);
        if (event.data.type === 'GETIR_TOKEN_CAPTURED') {
            const t = event.data.token;
            if (t && t !== userToken) {
                userToken = t;
                localStorage.setItem('getir_manual_token', t);
                const el = document.getElementById('token-status');
                if (el) el.innerText = getTokenExpiry(t);
                if (!isFetching && fetchQueue.length > 0) processQueue();
            }
        }
    });

    // === OBSERVER (debounce + widget-dışı filtre) ===
    let obDebounce = null;
    const observer = new MutationObserver((mutations) => {
        const hasExternal = mutations.some(m => {
            if (m.type !== 'childList') return false;
            let node = m.target;
            while (node && node !== document.body) {
                if (node.id === 'getir-fab-container') return false;
                node = node.parentNode;
            }
            return true;
        });
        if (!hasExternal) return;
        clearTimeout(obDebounce);
        obDebounce = setTimeout(() => { checkAndSync(); applyUI(); }, 300);
    });

    // === INIT ===
    const init = () => {
        buildWidget();
        observer.observe(document.body, { childList: true, subtree: true });
        setInterval(() => {
            checkAndSync();
            applyUI();
            const el = document.getElementById('token-status');
            if (el) el.innerText = getTokenExpiry(userToken);
        }, 5000);
    };

    setTimeout(init, 1500);
}