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

    /*
     * Getir'in CSS sınıf adlarında karma var (orderCard--LDG_w gibi). Karma
     * her yayında değişebiliyor ve değiştiği gün eklenti sessizce ölürdü.
     * Seçiciler artık öneke bakıyor, karmaya değil.
     */

    /**
     * Yalnız sipariş listesi sayfası. Depo kimliği 24 haneli onaltılık ve
     * her depoda farklı, o yüzden desende sabit değil kalıp var.
     */
    var SIPARIS_YOLU = /^\/r\/[a-f0-9]{24}\/dashboard\/orders\/?$/;

    var STIL = `#jba-hb {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

    /* Kurye adının üstüne denk gelip göz yorduğu için sönük duruyor.
       Fare yaklaşınca, içine odaklanınca ya da panel açıkken tam görünür. */
    opacity: 0.32;
    transition: opacity 0.18s ease;
}
#jba-hb:hover,
#jba-hb:focus-within,
#jba-hb.jba-hb--acik { opacity: 1; }

/* Yerleşim sertleştirme: taşan metin kırpılıyor, düğmeler tek ızgarada,
   satır yükseklikleri sabit. Yarım kalan düğme ve okunmayan yazı kalmasın. */
#jba-hb .sr-row { min-height: 42px; }
#jba-hb .sr-bnk,
#jba-hb .sr-courier {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
}
#jba-hb .search-results { max-height: 260px; overflow-y: auto; }
#jba-hb .header-buttons button {
    width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px; padding: 0;
}
#jba-hb .header-buttons button:hover { background: rgba(255,255,255,0.16); }
#jba-hb .btn-primary,
#jba-hb .btn-danger,
#jba-hb .btn-secondary-sm {
    min-height: 34px;
    line-height: 1.15;
    display: inline-flex; align-items: center; justify-content: center;
}
#jba-hb .action-btn { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }

/* Arama satırı: kapsam seçici + kutu */
#jba-hb .jba-hb-arama {
    display: grid;
    grid-template-columns: 92px 1fr;
    gap: 6px;
    align-items: stretch;
}
#jba-hb .jba-hb-kapsam {
    border: 2px solid #5d3ebc;
    border-radius: 6px;
    background: #fff;
    color: #5d3ebc;
    font-weight: 700;
    font-size: 12px;
    padding: 0 6px;
    cursor: pointer;
}
#jba-hb .jba-hb-ipucu {
    font-size: 10px;
    color: #8b83a8;
    margin-top: -4px;
}

#jba-hb #jba-hb-fab {
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
#jba-hb #jba-hb-fab:hover { transform: scale(1.08); }

#jba-hb #jba-hb-panel {
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

#jba-hb .panel-header {
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
#jba-hb .header-buttons { display: flex; gap: 8px; }
#jba-hb .icon-btn { background: transparent; border: none; color: white; cursor: pointer; font-size: 17px; opacity: 0.9; }
#jba-hb .icon-btn:hover { opacity: 1; }

#jba-hb .panel-body {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 9px;
}

#jba-hb .token-expiry-badge {
    font-size: 12px;
    text-align: center;
    font-weight: 700;
    color: #5d3ebc;
    background: #f0ecff;
    border-radius: 8px;
    padding: 5px 8px;
}

#jba-hb .auto-token-note {
    font-size: 10px;
    text-align: center;
    color: #28a745;
    margin-top: -4px;
}

#jba-hb .search-input {
    border: 2px solid #5d3ebc !important;
    font-size: 14px !important;
    padding: 9px 10px !important;
}

#jba-hb .search-results {
    background: #f7f5ff;
    border: 1px solid #d8d0f5;
    border-radius: 8px;
    overflow: hidden;
    font-size: 12px;
}
#jba-hb .sr-header {
    background: #5d3ebc;
    color: white;
    padding: 5px 10px;
    font-weight: 600;
    font-size: 11px;
}
#jba-hb .sr-row {
    display: flex;
    flex-direction: column;
    padding: 7px 10px;
    border-bottom: 1px solid #ede9ff;
    transition: filter 0.15s ease;
}
#jba-hb .sr-row:hover { filter: brightness(0.95); }
#jba-hb .sr-row:last-child { border-bottom: none; }
#jba-hb .sr-bnk {
    font-weight: 700;
    color: #5d3ebc;
    background: #ede9ff;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 11px;
}
#jba-hb .sr-count { color: #555; font-size: 11px; }
#jba-hb .sr-empty { padding: 8px 10px; color: #999; text-align: center; font-size: 11px; }

#jba-hb .jba-hb-kuyruk-text {
    font-size: 11px;
    color: #888;
    text-align: center;
}

/* AYARLAR */
#jba-hb .settings-body {
    display: none;
    flex-direction: column;
    max-height: 580px;
}
#jba-hb .settings-form {
    padding: 14px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
}
#jba-hb #jba-hb-kat-liste {
    padding: 10px 12px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #f3f3f3;
}

/* GELİŞMİŞ AYARLAR */
#jba-hb .advanced-section {
    padding: 10px 12px;
    background: #fafafa;
    border-top: 1px solid #eee;
    flex-shrink: 0;
}
#jba-hb .btn-secondary-sm {
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
#jba-hb .btn-secondary-sm:hover { background: #f0ecff; border-color: #5d3ebc; color: #5d3ebc; }
#jba-hb .advanced-note {
    font-size: 11px;
    color: #f57c00;
    margin: 0 0 8px 0;
    background: #fff8e1;
    padding: 5px 8px;
    border-radius: 6px;
}

#jba-hb .custom-input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 13px;
    box-sizing: border-box;
    font-family: inherit;
}

#jba-hb .btn-primary { background: #ffd300; color: #5d3ebc; border: none; padding: 9px; font-weight: 700; border-radius: 6px; cursor: pointer; width: 100%; }
#jba-hb .btn-primary:hover { background: #f5c800; }
#jba-hb .btn-danger { background: #dc3545; color: white; border: none; padding: 6px; font-weight: 700; border-radius: 6px; cursor: pointer; }

#jba-hb .category-card {
    background: #fff;
    border: 1px solid #ddd;
    border-left: 5px solid;
    padding: 9px 10px;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
#jba-hb .action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 5px;
    border-radius: 4px;
}
#jba-hb .action-btn:hover { background: #f0f0f0; }

#jba-hb .badge {
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 10px;
    color: white;
    margin-right: 3px;
    display: inline-block;
    margin-top: 3px;
}
#jba-hb .badge.inc { background: #28a745; }
#jba-hb .badge.exc { background: #dc3545; }

/* Parça sayısı badge — BNK etiketinin soluna */
#jba-hb .g-count-badge {
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
            const firstSpan = card.querySelector('[class*="textWithIcons--"] span.ant-typography');
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
            const tag = card.querySelector('[class*="locationContainer--"] .ant-tag');
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
            const el = document.getElementById('jba-hb-sonuc');
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

        /* Arama kapsamı. Tek kutu hem ürün hem kurye hem banko içinde arayınca
           kurye adı yazan ürün sonucu, ürün adı yazan kurye sonucu görüyordu.
           Artık nerede aranacağı seçili. */
        const kapsamOku = () => {
            const el = document.getElementById('jba-hb-kapsam');
            return (el && el.value) || localStorage.getItem('getir_hb_kapsam') || 'urun';
        };

        /* "BNK.008" ya da "8" gibi bir şey yazıldıysa kapsam ürün olsa bile
           bankoya da bakılıyor. Bu sürpriz üretmiyor, yalnız ekliyor. */
        const bankoyaBenzer = (t) => /^bnk/i.test(t) || /^\d{1,3}$/.test(t);

        // === UI GÜNCELLEME ===
        const applyUI = () => {
            const term = document.getElementById('jba-hb-girdi')?.value?.trim?.() || '';
            const kapsam = kapsamOku();
            const urunAra = kapsam === 'urun' || kapsam === 'hepsi';
            const kuryeAra = kapsam === 'kurye' || kapsam === 'hepsi';
            const bankoAra = kapsam === 'banko' || kapsam === 'hepsi' || bankoyaBenzer(term);
            const cards = document.querySelectorAll('[class*="orderCard--"]');
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
                    if (term && urunAra) {
                        hitCount = products.filter(p => wordsMatch(p, term)).length;
                        if (hitCount > 0) isMatch = true;
                    }
                }

                // Kurye, müşteri ve BNK isimlerinde ara
                const nameElements = Array.from(card.querySelectorAll('[class*="textWithIcons--"] span.ant-typography'));
                const nameTexts = nameElements.map(s => s.innerText?.trim() || '');
                const bnk = getBnkCode(card) || 'BNK.?';
            
                if (term) {
                    if (kuryeAra && nameTexts.some(t => wordsMatch(t, term))) isMatch = true;
                    if (bankoAra && wordsMatch(bnk, term)) isMatch = true;
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
                const locationDiv = card.querySelector('[class*="locationContainer--"]');
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
            const el = document.getElementById('jba-hb-kuyruk');
            if (el) el.innerText = `Kuyruk: ${fetchQueue.length} | Hafıza: ${Object.keys(orderCache).length} sipariş`;
        };

        const checkAndSync = () => {
            const cards = document.querySelectorAll('[class*="orderCard--"]');
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

        // === PANEL AÇ / KAPA ===
        const panelAcikMi = () => {
            const p = document.getElementById('jba-hb-panel');
            return !!p && p.style.display !== 'none';
        };

        const paneliAc = () => {
            const kap = document.getElementById('jba-hb');
            if (!kap) return;
            document.getElementById('jba-hb-fab').style.display = 'none';
            document.getElementById('jba-hb-panel').style.display = 'flex';
            kap.classList.add('jba-hb--acik');
            setTimeout(() => { document.getElementById('jba-hb-girdi')?.focus(); }, 50);
        };

        const paneliKapat = () => {
            const kap = document.getElementById('jba-hb');
            if (!kap) return;
            document.getElementById('jba-hb-panel').style.display = 'none';
            document.getElementById('jba-hb-fab').style.display = 'flex';
            kap.classList.remove('jba-hb--acik');
            isSettingsOpen = false;
            document.getElementById('jba-hb-ana').style.display = 'flex';
            document.getElementById('jba-hb-ayar').style.display = 'none';

            const g = document.getElementById('jba-hb-girdi');
            if (g) { g.value = ''; applyUI(); }
        };

        // === WIDGET ===
        const buildWidget = () => {
            if (document.getElementById('jba-hb')) return;
            const container = document.createElement('div');
            container.id = 'jba-hb';
            container.innerHTML = `
                <div id="jba-hb-fab">🔍</div>
                <div id="jba-hb-panel" style="display:none;">
                    <div class="panel-header">
                        <span>🚀 Hızlı Bul</span>
                        <div class="header-buttons">
                            <button id="jba-hb-ayar-btn" class="icon-btn">⚙️</button>
                            <button id="jba-hb-kapat" class="icon-btn">✖</button>
                        </div>
                    </div>

                    <div class="panel-body" id="jba-hb-ana">
                        <div id="jba-hb-jeton-durum" class="token-expiry-badge">${getTokenExpiry(userToken)}</div>
                        <div class="auto-token-note">🔄 Token otomatik alınıyor</div>
                        <div class="jba-hb-arama">
                            <select id="jba-hb-kapsam" class="jba-hb-kapsam" title="Nerede aransın">
                                <option value="urun">Ürün</option>
                                <option value="kurye">Kurye</option>
                                <option value="banko">Banko</option>
                                <option value="hepsi">Hepsi</option>
                            </select>
                            <input type="text" id="jba-hb-girdi" class="custom-input search-input" placeholder="🔍 Ara...">
                        </div>
                        <div class="jba-hb-ipucu">Kapsam seçili değilse ürün adında aranır.</div>
                        <div id="jba-hb-sonuc" class="search-results" style="display:none;"></div>
                        <div id="jba-hb-kuyruk" class="jba-hb-kuyruk-text">Kuyruk: 0 | Hafıza: 0 sipariş</div>
                    </div>

                    <div class="settings-body" id="jba-hb-ayar" style="display:none;">
                        <div class="settings-form">
                            <h4 style="margin:0; color:#5d3ebc;">Kategori Düzenleyici</h4>
                            <input type="text" id="jba-hb-kat-ad" class="custom-input" placeholder="Başlık (Örn: Sular)">
                            <textarea id="jba-hb-kat-dahil" class="custom-input" placeholder="Dahil (erikli, hayat)" rows="2"></textarea>
                            <textarea id="jba-hb-kat-haric" class="custom-input" placeholder="Hariç (cam, 1lt)" rows="2"></textarea>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <label style="font-size:11px; font-weight:bold;">Renk:</label>
                                <input type="color" id="jba-hb-kat-renk" value="#0088ff" style="border:none; width:40px; height:25px; cursor:pointer;">
                            </div>
                            <button id="jba-hb-kat-kaydet" class="btn-primary">Kategoriyi Kaydet</button>
                        </div>
                        <div id="jba-hb-kat-liste"></div>
                        <div class="advanced-section">
                            <button id="jba-hb-gelismis" class="btn-secondary-sm">🔐 Gelişmiş Ayarlar</button>
                            <div id="jba-hb-gelismis-icerik" style="display:none; padding:10px; border-top:1px solid #eee;">
                                <p class="advanced-note">Token otomatik alınmaktadır. Gerekmedikçe kullanmayın.</p>
                                <input type="password" id="jba-hb-jeton-girdi" class="custom-input" placeholder="Manuel Token">
                                <div style="display:flex; gap:5px; margin-top:6px;">
                                    <button id="jba-hb-jeton-kaydet" class="btn-primary" style="flex:2">Kaydet</button>
                                    <button id="jba-hb-jeton-sifirla" class="btn-danger" style="flex:1">Sıfırla</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(container);

            document.getElementById('jba-hb-fab').onclick = paneliAc;
            document.getElementById('jba-hb-kapat').onclick = paneliKapat;
            document.getElementById('jba-hb-ayar-btn').onclick = () => {
                isSettingsOpen = !isSettingsOpen;
                document.getElementById('jba-hb-ana').style.display = isSettingsOpen ? 'none' : 'flex';
                document.getElementById('jba-hb-ayar').style.display = isSettingsOpen ? 'flex' : 'none';
                if (isSettingsOpen) renderCategories();
            };
            document.getElementById('jba-hb-gelismis').onclick = () => {
                const c = document.getElementById('jba-hb-gelismis-icerik');
                const open = c.style.display !== 'none';
                c.style.display = open ? 'none' : 'block';
                document.getElementById('jba-hb-gelismis').innerText = open ? '🔐 Gelişmiş Ayarlar' : '🔐 Gizle';
            };
            document.getElementById('jba-hb-jeton-kaydet').onclick = () => {
                const val = document.getElementById('jba-hb-jeton-girdi').value;
                if (val) {
                    userToken = val.trim();
                    localStorage.setItem('getir_manual_token', userToken);
                    document.getElementById('jba-hb-jeton-durum').innerText = getTokenExpiry(userToken);
                    const btn = document.getElementById('jba-hb-jeton-kaydet');
                    btn.innerText = '✅ Kaydedildi';
                    setTimeout(() => { btn.innerText = 'Kaydet'; }, 2000);
                    if (!isFetching && fetchQueue.length > 0) processQueue();
                }
            };
            document.getElementById('jba-hb-jeton-sifirla').onclick = () => {
                if (confirm('Tüm hafıza silinsin mi?')) {
                    ['getir_order_cache', 'getir_settings', 'getir_manual_token'].forEach(k => localStorage.removeItem(k));
                    window.location.reload();
                }
            };
            document.getElementById('jba-hb-kat-kaydet').onclick = () => {
                const name = document.getElementById('jba-hb-kat-ad').value.trim();
                const inc = document.getElementById('jba-hb-kat-dahil').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                const exc = document.getElementById('jba-hb-kat-haric').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                const color = document.getElementById('jba-hb-kat-renk').value;
                if (name && inc.length > 0) {
                    const cat = { name, includes: inc, excludes: exc, color };
                    const idx = Number(editingCategoryIndex);
                    if (idx > -1) userSettings[idx] = cat;
                    else userSettings.push(cat);
                    localStorage.setItem('getir_settings', JSON.stringify(userSettings));
                    ['jba-hb-kat-ad', 'jba-hb-kat-dahil', 'jba-hb-kat-haric'].forEach(id => { document.getElementById(id).value = ''; });
                    editingCategoryIndex = -1;
                    document.getElementById('jba-hb-kat-kaydet').innerText = 'Kategoriyi Kaydet';
                    renderCategories();
                    applyUI();
                }
            };
            /* Her tuşta sekiz kartı yeniden tarayıp yeniden çizmek yerine
               120 ms bekleniyor ve çizim tek kareye toplanıyor. */
            let aramaZaman = null;
            let cizimKare = 0;
            const aramaDegisti = () => {
                clearTimeout(aramaZaman);
                aramaZaman = setTimeout(() => {
                    if (cizimKare) return;
                    cizimKare = requestAnimationFrame(() => { cizimKare = 0; applyUI(); });
                }, 120);
            };
            document.getElementById('jba-hb-girdi').oninput = aramaDegisti;

            const kapsamEl = document.getElementById('jba-hb-kapsam');
            kapsamEl.value = localStorage.getItem('getir_hb_kapsam') || 'urun';
            kapsamEl.onchange = () => {
                localStorage.setItem('getir_hb_kapsam', kapsamEl.value);
                applyUI();
            };
        };

        const renderCategories = () => {
            const list = document.getElementById('jba-hb-kat-liste');
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
                    document.getElementById('jba-hb-kat-ad').value = cat.name;
                    document.getElementById('jba-hb-kat-dahil').value = cat.includes.join(', ');
                    document.getElementById('jba-hb-kat-haric').value = (cat.excludes || []).join(', ');
                    document.getElementById('jba-hb-kat-renk').value = cat.color;
                    editingCategoryIndex = idx;
                    document.getElementById('jba-hb-kat-kaydet').innerText = 'Güncelle';
                    document.getElementById('jba-hb-ayar').scrollTop = 0;
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
                    const el = document.getElementById('jba-hb-jeton-durum');
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
                    if (node.id === 'jba-hb') return false;
                    node = node.parentNode;
                }
                return true;
            });
            if (!hasExternal) return;
            clearTimeout(obDebounce);
            obDebounce = setTimeout(() => { checkAndSync(); applyUI(); }, 300);
        });

        // === DIŞARI TIKLAMA / ESC ===
        /* Aramadan siparişe geçince panel açık kalıyordu. Kartın kendisine
           tıklamak da dışarı tıklamak sayılıyor, o yüzden sonuçtan siparişe
           gidince panel kendiliğinden kapanıyor. */
        document.addEventListener('click', (e) => {
            if (!panelAcikMi()) return;
            const kap = document.getElementById('jba-hb');
            if (!kap || kap.contains(e.target)) return;
            paneliKapat();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panelAcikMi()) paneliKapat();
        });

        // === YAŞAM DÖNGÜSÜ ===
        /*
         * Eklenti başka sekmeye gidip dönünce ölüyordu. Sebep tarayıcı sekmesi
         * değil, panelin kendi içindeki gezinme: içerik betiği sayfa başına bir
         * kez çalışıyor, React sipariş ekranından çıkınca kabuğu söküyor ve
         * geri dönüldüğünde kimse yeniden kurmuyordu. Nöbetçi hem adresi hem
         * kabuğun varlığını denetliyor.
         */
        const yolUygun = () => SIPARIS_YOLU.test(location.pathname);

        const nobet = () => {
            if (!yolUygun()) {
                const k = document.getElementById('jba-hb');
                if (k) k.style.display = 'none';
                return false;
            }
            if (!document.getElementById('jba-hb')) buildWidget();
            const k = document.getElementById('jba-hb');
            if (k) k.style.display = '';
            return true;
        };

        /* Sipariş ekranına dönüldüğü an yeni siparişleri de yakala; kullanıcı
           akışı kaybetmesin diye radar bir kez zorlanıyor. */
        const geriDondu = () => {
            if (!nobet()) return;
            checkAndSync();
            applyUI();
            forceRadarFetch();
        };

        const adresiIzle = () => {
            var sonYol = location.pathname;
            const bak = () => {
                if (location.pathname === sonYol) return;
                sonYol = location.pathname;
                geriDondu();
            };
            ['pushState', 'replaceState'].forEach((ad) => {
                const asil = history[ad];
                if (typeof asil !== 'function' || asil.__jbSarildi) return;
                const sarmal = function () {
                    const r = asil.apply(this, arguments);
                    setTimeout(bak, 0);
                    return r;
                };
                sarmal.__jbSarildi = true;
                history[ad] = sarmal;
            });
            window.addEventListener('popstate', () => setTimeout(bak, 0));
            setInterval(bak, 1000);   // yalnız dize karşılaştırması, ölçülebilir yük yok
        };

        // === INIT ===
        const init = () => {
            nobet();
            observer.observe(document.body, { childList: true, subtree: true });
            adresiIzle();

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') geriDondu();
            });
            window.addEventListener('focus', geriDondu);

            setInterval(() => {
                if (!nobet()) return;
                checkAndSync();
                applyUI();
                const el = document.getElementById('jba-hb-jeton-durum');
                if (el) el.innerText = getTokenExpiry(userToken);
            }, 5000);
        };

        setTimeout(init, 1500);
    }

    JBA.kayit({
        kimlik: 'hizliBul',
        ad: 'Hızlı Bul',
        ozet: 'Sipariş kartlarının içindeki ürünleri anında arar, kategorilere göre renklendirir.',
        hostlar: ['warehouse.getir.com'],
        /* Yol kapısı kaldırıldı. Kullanıcı panelin başka bir sekmesinde
           açılıp sonra siparişlere geçtiğinde modül hiç kurulmuyordu; artık
           kurulup görünürlüğü kendi yönetiyor. */

        baslat: function () {
            calistir();
        },

        durdur: function () {
            var w = document.getElementById('jba-hb');
            if (w) w.remove();
            JBA.bildir('Hızlı Bul kapandı, sayfayı yenile.', null);
        },

        eylemler: [
            { ad: 'Arama kutusuna git', calistir: function () {
                var g = document.getElementById('jba-hb-girdi');
                if (g) { g.scrollIntoView({ block: 'center' }); g.focus(); }
                else JBA.bildir('Arama kutusu bu sayfada yok.', 'olumsuz');
            } }
        ]
    });
})(window);
