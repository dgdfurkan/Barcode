/**
 * Modül: Hızlı Bul (sipariş içi ürün arama)
 * ============================================================================
 *
 * warehouse.getir.com sipariş panelinde arama çubuğu açar. Kart içindeki
 * ürünleri arar, kategori renkleriyle boyar, sipariş içeriklerini yerel
 * önbellekte tutar.
 *
 * Kaynağı `getir_hizli_bulucu/content.js`. Gövde birebir kopyalandı.
 * Önceki turda yanlış eklenti (`getir-warehouse-orders-search-extension`)
 * taşınmıştı, o modül silindi.
 *
 * SAYFA KISITI
 * Yalnızca sipariş listesi sayfasında uyanıyor:
 *   /r/<depoKimligi>/dashboard/orders
 * Depo kimliği sabit değil, depodan depoya değişiyor; adresten okunuyor.
 *
 * GETİR'İ YORMUYOR
 * Kaynaktaki hız sınırları olduğu gibi korundu: sipariş detayları tek tek
 * ve aralarında 1,5 saniye beklemeyle çekiliyor, çekilen sipariş yerel
 * önbelleğe yazılıp bir daha istenmiyor. Paralel istek yok, yeniden deneme
 * döngüsü yok.
 *
 * JETON YAKALAMA
 * Eskiden `inject.js` sayfaya script etiketiyle enjekte ediliyordu. Artık
 * `sayfa-koprusu.js` manifest üzerinden sayfanın dünyasında çalışıyor;
 * `GETIR_TOKEN_CAPTURED` ve `GETIR_DATA_RECEIVED` mesajlarını o yayınlıyor.
 * Böylece `web_accessible_resources` gerekmiyor, eklentinin dosyaları
 * dışarıya hiç açılmıyor.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var JBA = global.JBA;
    if (!JBA) return;

    var STIL = `#getir-fab-container {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

#getir-fab-container #getir-fab {
    width: 56px;
    height: 56px;
    background: #5d3ebc;
    color: #ffd300;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 4px 16px rgba(93,62,188,0.45);
    cursor: pointer;
    font-size: 22px;
    transition: transform 0.15s ease;
}
#getir-fab-container #getir-fab:hover { transform: scale(1.08); }

#getir-fab-container #getir-panel {
    width: 360px;
    background: #fff;
    border: 1.5px solid #5d3ebc;
    border-radius: 14px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.18);
    display: flex;
    flex-direction: column;
    max-height: 620px;
    overflow: hidden;
}

#getir-fab-container .panel-header {
    background: linear-gradient(135deg, #5d3ebc, #7b5ce6);
    padding: 11px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
}
#getir-fab-container .header-buttons { display: flex; gap: 8px; }
#getir-fab-container .icon-btn { background: transparent; border: none; color: white; cursor: pointer; font-size: 17px; opacity: 0.9; }
#getir-fab-container .icon-btn:hover { opacity: 1; }

#getir-fab-container .panel-body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 9px;
}

#getir-fab-container .token-expiry-badge {
    font-size: 12px;
    text-align: center;
    font-weight: 700;
    color: #5d3ebc;
    background: #f0ecff;
    border-radius: 8px;
    padding: 5px 8px;
}

#getir-fab-container .auto-token-note {
    font-size: 10px;
    text-align: center;
    color: #28a745;
    margin-top: -4px;
}

#getir-fab-container .search-input {
    border: 2px solid #5d3ebc !important;
    font-size: 14px !important;
    padding: 9px 10px !important;
}

#getir-fab-container .search-results {
    background: #f7f5ff;
    border: 1px solid #d8d0f5;
    border-radius: 8px;
    overflow: hidden;
    font-size: 12px;
}
#getir-fab-container .sr-header {
    background: #5d3ebc;
    color: white;
    padding: 5px 10px;
    font-weight: 600;
    font-size: 11px;
}
#getir-fab-container .sr-row {
    display: flex;
    flex-direction: column;
    padding: 7px 10px;
    border-bottom: 1px solid #ede9ff;
    transition: filter 0.15s ease;
}
#getir-fab-container .sr-row:hover { filter: brightness(0.95); }
#getir-fab-container .sr-row:last-child { border-bottom: none; }
#getir-fab-container .sr-bnk {
    font-weight: 700;
    color: #5d3ebc;
    background: #ede9ff;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 11px;
}
#getir-fab-container .sr-count { color: #555; font-size: 11px; }
#getir-fab-container .sr-empty { padding: 8px 10px; color: #999; text-align: center; font-size: 11px; }

#getir-fab-container .queue-status-text {
    font-size: 11px;
    color: #888;
    text-align: center;
}

/* AYARLAR */
#getir-fab-container .settings-body {
    display: none;
    flex-direction: column;
    max-height: 580px;
}
#getir-fab-container .settings-form {
    padding: 14px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
}
#getir-fab-container #category-list {
    padding: 10px 12px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #f3f3f3;
}

/* GELİŞMİŞ AYARLAR */
#getir-fab-container .advanced-section {
    padding: 10px 12px;
    background: #fafafa;
    border-top: 1px solid #eee;
    flex-shrink: 0;
}
#getir-fab-container .btn-secondary-sm {
    width: 100%;
    background: transparent;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    color: #666;
    text-align: left;
}
#getir-fab-container .btn-secondary-sm:hover { background: #f0ecff; border-color: #5d3ebc; color: #5d3ebc; }
#getir-fab-container .advanced-note {
    font-size: 11px;
    color: #f57c00;
    margin: 0 0 8px 0;
    background: #fff8e1;
    padding: 5px 8px;
    border-radius: 6px;
}

#getir-fab-container .custom-input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 13px;
    box-sizing: border-box;
    font-family: inherit;
}

#getir-fab-container .btn-primary { background: #ffd300; color: #5d3ebc; border: none; padding: 9px; font-weight: 700; border-radius: 6px; cursor: pointer; width: 100%; }
#getir-fab-container .btn-primary:hover { background: #f5c800; }
#getir-fab-container .btn-danger { background: #dc3545; color: white; border: none; padding: 6px; font-weight: 700; border-radius: 6px; cursor: pointer; }

#getir-fab-container .category-card {
    background: #fff;
    border: 1px solid #ddd;
    border-left: 5px solid;
    padding: 9px 10px;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
#getir-fab-container .action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 5px;
    border-radius: 4px;
}
#getir-fab-container .action-btn:hover { background: #f0f0f0; }

#getir-fab-container .badge {
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 10px;
    color: white;
    margin-right: 3px;
    display: inline-block;
    margin-top: 3px;
}
#getir-fab-container .badge.inc { background: #28a745; }
#getir-fab-container .badge.exc { background: #dc3545; }

/* Parça sayısı badge — BNK etiketinin soluna */
#getir-fab-container .g-count-badge {
    display: inline-flex;
    align-items: center;
    background: #5d3ebc;
    color: #ffd300;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    margin-right: 5px;
    line-height: 1.6;
    letter-spacing: 0.3px;
    vertical-align: middle;
}`;

    function stilKur() {
        if (document.getElementById('jba-hizli-bul-stil')) return;
        var s = document.createElement('style');
        s.id = 'jba-hizli-bul-stil';
        s.textContent = STIL;
        (document.head || document.documentElement).appendChild(s);
    }

    var kuruldu = false;

    function calistir() {
        if (kuruldu) return;
        kuruldu = true;
        stilKur();


        // Jeton ve API yanıtı yakalama artık `sayfa-koprusu.js` içinde
        // (manifest'te world: MAIN). Buraya betik enjekte etmeye ve
        // web_accessible_resources'a gerek kalmadı.

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

    /**
     * Yalnız sipariş listesi sayfası. Depo kimliği 24 haneli onaltılık ve
     * her depoda farklı, o yüzden desende sabit değil kalıp var.
     */
    var SIPARIS_YOLU = /^\/r\/[a-f0-9]{24}\/dashboard\/orders\/?$/;

    JBA.kayit({
        kimlik: 'hizliBul',
        ad: 'Hızlı Bul',
        ozet: 'Sipariş kartlarının içindeki ürünleri anında arar, kategorilere göre renklendirir.',
        hostlar: ['warehouse.getir.com'],
        yol: function (yol) { return SIPARIS_YOLU.test(yol); },

        baslat: function () {
            calistir();
        },

        durdur: function () {
            var w = document.getElementById('getir-fab-container');
            if (w) w.remove();
            JBA.bildir('Hızlı Bul kapandı, sayfayı yenile.', null);
        },

        eylemler: [
            { ad: 'Arama kutusuna git', calistir: function () {
                var g = document.getElementById('getir-search-input');
                if (g) { g.scrollIntoView({ block: 'center' }); g.focus(); }
                else JBA.bildir('Arama kutusu bu sayfada yok.', 'olumsuz');
            } }
        ]
    });
})(window);
