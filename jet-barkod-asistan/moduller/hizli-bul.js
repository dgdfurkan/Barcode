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

    /*
     * Palet Jet Barkod'un kendi paleti: mürekkep siyahı yüzey, kırık beyaz
     * kağıt, logo mavisi tek vurgu. Getir'in moru ve sarısı kaldırıldı; iki
     * renk arası degrade yok. Simgeler emoji değil, satır içi SVG.
     */
    var STIL = `#jba-hb {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

    /* Kurye adının üstüne denk gelip göz yorduğu için sönük duruyor.
       Fare yaklaşınca, içine odaklanınca ya da panel açıkken tam görünür. */
    opacity: 0.32;
    transition: opacity 0.18s ease;

    --mrk: #131720;
    --mrk-2: #1c2230;
    --cizgi: #2a3242;
    --yazi: #f2f4f8;
    --sonuk: #98a2b3;
    --mavi: #135bec;
    --mavi-ac: #3b82f6;
    --yesil: #16a34a;
    --kirmizi: #dc2626;
}
#jba-hb:hover,
#jba-hb:focus-within,
#jba-hb.jba-hb--acik { opacity: 1; }

/* [hidden] tek başına yetmiyor: aşağıda display veren kurallar var ve
   belirlilik yarışını onlar kazanıyor. Bu satır olmazsa hiç kapanmaz. */
#jba-hb [hidden] { display: none !important; }

#jba-hb button { font-family: inherit; }
#jba-hb svg { display: block; flex: none; }

/* ---------------- AÇMA DÜĞMESİ ---------------- */
#jba-hb #jba-hb-fab {
    width: 48px;
    height: 48px;
    background: var(--mrk);
    color: var(--yazi);
    border-radius: 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 6px 20px rgba(0,0,0,0.28);
    cursor: pointer;
    border: 1px solid var(--cizgi);
    transition: transform 0.15s ease, background 0.15s ease;
}
#jba-hb #jba-hb-fab:hover { transform: translateY(-1px); background: var(--mrk-2); }

/* ---------------- PANEL ---------------- */
#jba-hb #jba-hb-panel {
    width: 372px;
    background: var(--mrk);
    border: 1px solid var(--cizgi);
    border-radius: 16px;
    box-shadow: 0 20px 48px rgba(0,0,0,0.42);
    display: flex;
    flex-direction: column;
    max-height: 620px;
    color: var(--yazi);
    /* Menü ve açılır parçalar kırpılmasın diye taşma serbest. */
    overflow: visible;
}

#jba-hb .panel-header {
    background: transparent;
    border-bottom: 1px solid var(--cizgi);
    padding: 13px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 14px;
    letter-spacing: -0.01em;
    flex-shrink: 0;
}
#jba-hb .panel-header > span { display: flex; align-items: center; gap: 8px; }
#jba-hb .header-buttons { display: flex; gap: 4px; }
#jba-hb .icon-btn {
    background: transparent;
    border: 0;
    color: var(--sonuk);
    cursor: pointer;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 8px;
    padding: 0;
}
#jba-hb .icon-btn:hover { background: var(--mrk-2); color: var(--yazi); }

#jba-hb .panel-body {
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

#jba-hb .token-expiry-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--sonuk);
    display: flex;
    align-items: center;
    gap: 6px;
}
#jba-hb .token-expiry-badge::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--yesil);
    flex: none;
}
#jba-hb .auto-token-note { display: none; }

/* ---------------- KAPSAM: BÖLMELİ DÜĞME ---------------- */
/* Açılır menü panelin içinde kırpılıyordu ve dört seçenek için fazla
   ağırdı. Dört kısa seçenek tek satırda dursun, tek dokunuşla değişsin. */
#jba-hb .kapsam {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    background: var(--mrk-2);
    border: 1px solid var(--cizgi);
    border-radius: 10px;
    padding: 2px;
}
#jba-hb .kapsam button {
    border: 0;
    background: transparent;
    color: var(--sonuk);
    font: 600 11.5px inherit;
    padding: 6px 0;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
}
#jba-hb .kapsam button:hover { color: var(--yazi); }
#jba-hb .kapsam button[aria-selected="true"] {
    background: var(--mavi);
    color: #fff;
}

#jba-hb .arama-kutu { position: relative; }
#jba-hb .arama-kutu svg {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--sonuk);
}
#jba-hb .search-input {
    padding-left: 34px !important;
    font-size: 13px !important;
}

/* ---------------- SONUÇLAR ---------------- */
#jba-hb .search-results {
    background: var(--mrk-2);
    border: 1px solid var(--cizgi);
    border-radius: 10px;
    overflow: hidden auto;
    max-height: 260px;
    font-size: 12px;
}
#jba-hb .sr-header {
    padding: 7px 11px;
    font-weight: 600;
    font-size: 11px;
    color: var(--sonuk);
    border-bottom: 1px solid var(--cizgi);
    position: sticky;
    top: 0;
    background: var(--mrk-2);
}
#jba-hb .sr-empty { padding: 14px 11px; color: var(--sonuk); text-align: center; }
#jba-hb .sr-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 9px 11px;
    min-height: 44px;
    border-bottom: 1px solid var(--cizgi);
    cursor: pointer;
    transition: background 0.12s ease;
}
#jba-hb .sr-row:hover { background: rgba(255,255,255,0.045); }
#jba-hb .sr-row:last-child { border-bottom: none; }
#jba-hb .sr-ust { display: flex; align-items: center; gap: 8px; }
#jba-hb .sr-ust .sr-courier { margin-left: auto; }
#jba-hb .sr-alt { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; color: var(--sonuk); }
#jba-hb .sr-bnk {
    font-weight: 700;
    font-size: 12px;
    color: var(--yazi);
    letter-spacing: 0.02em;
}
#jba-hb .sr-courier,
#jba-hb .sr-bnk,
#jba-hb .sr-count {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 170px;
}
#jba-hb .sr-courier { font-size: 11px; color: var(--sonuk); }
/* Kategori renkleri. Koyu yüzeyde soluk arka plan okunmuyordu; renk artık
   satırın içinde küçük noktalar hâlinde. */
#jba-hb .sr-noktalar { display: flex; gap: 3px; flex: none; }
#jba-hb .sr-noktalar i {
    width: 7px; height: 7px;
    border-radius: 50%;
    display: block;
}
#jba-hb .sr-adet { color: var(--mavi-ac); font-weight: 600; }

#jba-hb .queue-status-text {
    font-size: 10.5px;
    color: var(--sonuk);
    text-align: right;
}

/* ---------------- ORTAK KONTROLLER ---------------- */
#jba-hb .custom-input {
    width: 100%;
    padding: 9px 10px;
    background: var(--mrk-2);
    border: 1px solid var(--cizgi);
    border-radius: 10px;
    color: var(--yazi);
    font-size: 13px;
    box-sizing: border-box;
    font-family: inherit;
}
#jba-hb .custom-input::placeholder { color: #6b7480; }
#jba-hb .custom-input:focus {
    outline: none;
    border-color: var(--mavi);
    box-shadow: 0 0 0 3px rgba(19,91,236,0.18);
}
#jba-hb textarea.custom-input { resize: vertical; min-height: 54px; }

#jba-hb .btn-primary {
    background: var(--mavi);
    color: #fff;
    border: none;
    padding: 10px;
    font-weight: 600;
    font-size: 13px;
    border-radius: 10px;
    cursor: pointer;
    width: 100%;
    min-height: 38px;
}
#jba-hb .btn-primary:hover { background: #0f4bc4; }
#jba-hb .btn-danger {
    background: transparent;
    color: #f87171;
    border: 1px solid #4c2323;
    padding: 8px;
    font-weight: 600;
    font-size: 12px;
    border-radius: 10px;
    cursor: pointer;
    min-height: 38px;
}
#jba-hb .btn-danger:hover { background: rgba(220,38,38,0.12); }
#jba-hb .btn-vazgec {
    background: transparent;
    border: 1px solid var(--cizgi);
    border-radius: 10px;
    color: var(--sonuk);
    font: 600 12px inherit;
    cursor: pointer;
    min-height: 38px;
}
#jba-hb .btn-vazgec:hover { background: var(--mrk-2); color: var(--yazi); }
#jba-hb .btn-secondary-sm {
    width: 100%;
    background: transparent;
    border: 1px solid var(--cizgi);
    border-radius: 10px;
    padding: 9px 10px;
    font-size: 12px;
    cursor: pointer;
    color: var(--sonuk);
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 38px;
}
#jba-hb .btn-secondary-sm:hover { background: var(--mrk-2); color: var(--yazi); }

/* ---------------- AYARLAR ---------------- */
#jba-hb .settings-body {
    display: none;
    flex-direction: column;
    max-height: 560px;
}
#jba-hb .settings-form {
    padding: 12px 14px;
    border-bottom: 1px solid var(--cizgi);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}
#jba-hb .ekle-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background: transparent;
    border: 1px dashed var(--cizgi);
    border-radius: 10px;
    color: var(--sonuk);
    font: 600 12px inherit;
    padding: 10px;
    cursor: pointer;
}
#jba-hb .ekle-btn:hover { border-color: var(--mavi); color: var(--yazi); }
#jba-hb #jba-hb-form-govde { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }

#jba-hb .ayar-baslik { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
#jba-hb .ayar-baslik h4 { margin: 0; font-size: 13px; font-weight: 600; color: var(--yazi); }
#jba-hb .ayar-baslik span { font-size: 10.5px; color: var(--sonuk); }
#jba-hb .alan { display: flex; flex-direction: column; gap: 4px; }
#jba-hb .alan > label {
    font-size: 10px;
    font-weight: 600;
    color: var(--sonuk);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
#jba-hb .alan > small { font-size: 10.5px; color: #6b7480; }
#jba-hb .renk-satiri {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--mrk-2);
    border: 1px solid var(--cizgi);
    border-radius: 10px;
    padding: 8px 10px;
}
#jba-hb .renk-satiri label { flex: 1; font-size: 11.5px; font-weight: 600; color: var(--sonuk); }
#jba-hb .renk-satiri input[type="color"] {
    border: none;
    background: none;
    width: 36px;
    height: 26px;
    padding: 0;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
}
#jba-hb .form-dugmeler { display: grid; grid-template-columns: 1fr; gap: 8px; }
#jba-hb .form-dugmeler.duzenleme { grid-template-columns: 1fr 92px; }

#jba-hb #jba-hb-kat-liste {
    padding: 12px 14px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
#jba-hb .kat-bos {
    text-align: center;
    color: var(--sonuk);
    font-size: 12px;
    line-height: 1.6;
    padding: 22px 12px;
    border: 1px dashed var(--cizgi);
    border-radius: 10px;
}
#jba-hb .category-card {
    background: var(--mrk-2);
    border: 1px solid var(--cizgi);
    border-left: 3px solid;
    padding: 11px 12px;
    border-radius: 10px;
}
#jba-hb .kat-ust { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
#jba-hb .kat-ad {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--yazi);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#jba-hb .kat-rozetler { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
#jba-hb .action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--sonuk);
    width: 26px; height: 26px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 7px;
    padding: 0;
}
#jba-hb .action-btn:hover { background: rgba(255,255,255,0.07); color: var(--yazi); }
#jba-hb .action-btn.sil-btn:hover { color: #f87171; }

#jba-hb .badge {
    padding: 3px 8px;
    border-radius: 7px;
    font-size: 10.5px;
    font-weight: 500;
    display: inline-block;
    border: 1px solid;
}
#jba-hb .badge.inc { color: #4ade80; border-color: rgba(74,222,128,0.28); background: rgba(22,163,74,0.12); }
#jba-hb .badge.exc { color: #f87171; border-color: rgba(248,113,113,0.28); background: rgba(220,38,38,0.12); }
#jba-hb .badge::before { font-weight: 700; margin-right: 4px; opacity: 0.7; }
#jba-hb .badge.inc::before { content: '+'; }
#jba-hb .badge.exc::before { content: '-'; }

/* ---------------- GELİŞMİŞ ---------------- */
#jba-hb .advanced-section {
    padding: 12px 14px;
    border-top: 1px solid var(--cizgi);
    flex-shrink: 0;
}
#jba-hb .advanced-note {
    font-size: 11px;
    color: #fbbf24;
    margin: 0 0 8px 0;
    background: rgba(251,191,36,0.1);
    border: 1px solid rgba(251,191,36,0.22);
    padding: 7px 9px;
    border-radius: 8px;
    line-height: 1.45;
}

/* Kart üstüne konan parça sayısı rozeti (panelin dışında, Getir'in kartında) */
.g-count-badge {
    display: inline-block;
    background: #131720;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 6px;
    margin-right: 6px;
    letter-spacing: 0.02em;
}`;

    function stilKur() {
        if (document.getElementById('jba-hizli-bul-stil')) return;
        var s = document.createElement('style');
        s.id = 'jba-hizli-bul-stil';
        s.textContent = STIL;
        (document.head || document.documentElement).appendChild(s);
    }

    /* Emoji yerine satır içi SVG. Emoji her işletim sisteminde başka
       görünüyor ve panelin dilini bozuyordu. */
    var SVG = {
        ara: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
        araBuyuk: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
        ayar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h8M17 6h3M4 12h3M12 12h8M4 18h8M17 18h3"/><circle cx="14.5" cy="6" r="2"/><circle cx="9.5" cy="12" r="2"/><circle cx="14.5" cy="18" r="2"/></svg>',
        kapat: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        kalem: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
        cop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
        kilit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
    };

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
            if (!token) return 'Oturum anahtarı yok';
            try {
                const raw = token.replace(/^Bearer\s+/i, '');
                const payload = JSON.parse(atob(raw.split('.')[1]));
                const timeLeft = Math.floor((payload.exp * 1000 - Date.now()) / 60000);
                if (timeLeft <= 0) return 'Oturum süresi doldu';
                return `Oturum ${timeLeft} dk geçerli`;
            } catch (e) { return 'Oturum aktif'; }
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
                el.innerHTML = `<div class="sr-empty">Eşleşen sipariş yok</div>`;
                return;
            }

            el.innerHTML = `<div class="sr-header">${matches.length} siparişte bulundu</div>` +
                matches.map((m, i) => `
                    <div class="sr-row" data-idx="${i}">
                        <div class="sr-ust">
                            <span class="sr-bnk">${m.bnk}</span>
                            <span class="sr-noktalar">${(m.colors || []).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
                            <span class="sr-courier">${m.courier}</span>
                        </div>
                        <div class="sr-alt">
                            <span class="sr-adet">${m.count !== null ? m.count + ' parça' : 'parça bilinmiyor'}</span>
                            <span class="sr-count">${m.hitCount ? m.hitCount + ' ürün eşleşti' : ''}</span>
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
        const KAPSAM_ADI = { hepsi: 'Hepsi', urun: 'Ürün', kurye: 'Kurye', banko: 'Banko' };
        let kapsamDeger = localStorage.getItem('getir_hb_kapsam') || 'hepsi';
        if (!KAPSAM_ADI[kapsamDeger]) kapsamDeger = 'hepsi';

        const kapsamOku = () => kapsamDeger;

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
                    matches.push({ card, bnk, courier, hitCount, count, bgColor: newBg, colors });
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

        /**
         * Detay yanıtının ALAN ADLARINI bir kez yerel depoya yazar. Değer
         * değil, yalnız ad. Ürün kimliği ve görsel alanının adı belgelenmiş
         * değil; tahmin edip yanlış alan okumaktansa gerçek yanıttan
         * öğreniyoruz. Kayıt bir kez yazılıyor.
         *
         * Sayfa köprüsündeki `JB_SIPARIS_GETIR` yolu bu iş için kullanılamadı:
         * o yol sayfanın attığı bir `/orders` isteğini şablon alıyor, panel
         * ise sipariş listesini soketten aldığı için öyle bir istek hiç
         * geçmiyor ve çağrı "Failed to fetch" ile düşüyor. Buradaki kuyruk
         * yakalanan jetonla çalışıyor ve sorunsuz dönüyor.
         */
        const semayiKaydet = (siparis) => {
            try {
                if (!siparis || localStorage.getItem('jba_detay_sema')) return;
                const p0 = (Array.isArray(siparis.products) && siparis.products[0]) || null;
                const altlar = {};
                if (p0) {
                    Object.keys(p0).forEach((k) => {
                        const v = p0[k];
                        if (v && typeof v === 'object' && !Array.isArray(v)) altlar[k] = Object.keys(v);
                    });
                }
                localStorage.setItem('jba_detay_sema', JSON.stringify({
                    siparisAlanlari: Object.keys(siparis),
                    urunAlanlari: p0 ? Object.keys(p0) : null,
                    urunAltNesneler: altlar,
                    urunSatiri: Array.isArray(siparis.products) ? siparis.products.length : 0,
                    zaman: new Date().toISOString()
                }));
            } catch (e) { /* sessiz */ }
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
                    semayiKaydet(order);
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
                <div id="jba-hb-fab" title="Hızlı Bul">${SVG.araBuyuk}</div>
                <div id="jba-hb-panel" style="display:none;">
                    <div class="panel-header">
                        <span>Hızlı Bul</span>
                        <div class="header-buttons">
                            <button id="jba-hb-ayar-btn" class="icon-btn" title="Ayarlar">${SVG.ayar}</button>
                            <button id="jba-hb-kapat" class="icon-btn" title="Kapat">${SVG.kapat}</button>
                        </div>
                    </div>

                    <div class="panel-body" id="jba-hb-ana">
                        <div id="jba-hb-jeton-durum" class="token-expiry-badge">${getTokenExpiry(userToken)}</div>
                        <div class="kapsam" id="jba-hb-kapsam">
                            <button type="button" data-deger="hepsi">Hepsi</button>
                            <button type="button" data-deger="urun">Ürün</button>
                            <button type="button" data-deger="kurye">Kurye</button>
                            <button type="button" data-deger="banko">Banko</button>
                        </div>
                        <div class="arama-kutu">
                            ${SVG.ara}
                            <input type="text" id="jba-hb-girdi" class="custom-input search-input" placeholder="Ara">
                        </div>
                        <div id="jba-hb-sonuc" class="search-results" style="display:none;"></div>
                        <div id="jba-hb-kuyruk" class="jba-hb-kuyruk-text">Kuyruk: 0 | Hafıza: 0 sipariş</div>
                    </div>

                    <div class="settings-body" id="jba-hb-ayar" style="display:none;">
                        <div class="settings-form">
                            <button type="button" class="ekle-btn" id="jba-hb-form-ac">
                                <span id="jba-hb-form-ac-yazi">Yeni kategori ekle</span>
                                <span class="isaret" id="jba-hb-form-ac-isaret">+</span>
                            </button>
                            <div id="jba-hb-form-govde" hidden>
                            <div class="ayar-baslik">
                                <h4>Kategori</h4>
                                <span>Kart arka planını boyar</span>
                            </div>
                            <div class="alan">
                                <label for="jba-hb-kat-ad">Başlık</label>
                                <input type="text" id="jba-hb-kat-ad" class="custom-input" placeholder="Örnek: Sular">
                            </div>
                            <div class="alan">
                                <label for="jba-hb-kat-dahil">Dahil edilecek kelimeler</label>
                                <textarea id="jba-hb-kat-dahil" class="custom-input" placeholder="erikli, hayat su" rows="2"></textarea>
                                <small>Virgülle ayır. Biri geçiyorsa kart boyanır.</small>
                            </div>
                            <div class="alan">
                                <label for="jba-hb-kat-haric">Hariç tutulacaklar</label>
                                <textarea id="jba-hb-kat-haric" class="custom-input" placeholder="cam, 1 lt" rows="2"></textarea>
                                <small>İsteğe bağlı. Bunlardan biri geçiyorsa boyanmaz.</small>
                            </div>
                            <div class="renk-satiri">
                                <label for="jba-hb-kat-renk">Kart rengi</label>
                                <input type="color" id="jba-hb-kat-renk" value="#0088ff">
                            </div>
                            <div class="form-dugmeler" id="jba-hb-form-dugmeler">
                                <button id="jba-hb-kat-kaydet" class="btn-primary">Kategoriyi Kaydet</button>
                                <button id="jba-hb-kat-vazgec" class="btn-vazgec" hidden>Vazgeç</button>
                            </div>
                            </div>
                        </div>
                        <div id="jba-hb-kat-liste"></div>
                        <div class="advanced-section">
                            <button id="jba-hb-gelismis" class="btn-secondary-sm">${SVG.kilit}<span>Gelişmiş ayarlar</span></button>
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
                document.getElementById('jba-hb-gelismis').innerHTML =
                    SVG.kilit + '<span>' + (open ? 'Gelişmiş ayarlar' : 'Gizle') + '</span>';
            };
            document.getElementById('jba-hb-jeton-kaydet').onclick = () => {
                const val = document.getElementById('jba-hb-jeton-girdi').value;
                if (val) {
                    userToken = val.trim();
                    localStorage.setItem('getir_manual_token', userToken);
                    document.getElementById('jba-hb-jeton-durum').innerText = getTokenExpiry(userToken);
                    const btn = document.getElementById('jba-hb-jeton-kaydet');
                    btn.innerText = 'Kaydedildi';
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
                    duzenlemeyiBitir();
                    renderCategories();
                    applyUI();
                }
            };
            document.getElementById('jba-hb-kat-vazgec').onclick = duzenlemeyiBitir;
            document.getElementById('jba-hb-form-ac').onclick = () => {
                const govde = document.getElementById('jba-hb-form-govde');
                const acilacak = govde.hidden;
                formuAc(acilacak);
                if (acilacak) document.getElementById('jba-hb-kat-ad').focus();
                else duzenlemeyiBitir();
            };
            /* Her tuşta sekiz kartı yeniden tarayıp yeniden çizmek yerine
               120 ms bekleniyor ve çizim tek kareye toplanıyor. */
            let aramaZaman = null;
            let cizimKare = 0;
            const aramaDegisti = () => {
                clearTimeout(aramaZaman);
                aramaZaman = setTimeout(() => {
                    /* Sekme arka plandayken requestAnimationFrame hiç
                       çalışmıyor; kuyruğa atılan çizim orada asılı kalıyordu.
                       Görünmezken doğrudan çiziliyor. */
                    if (document.visibilityState !== 'visible') { applyUI(); return; }
                    if (cizimKare) return;
                    cizimKare = requestAnimationFrame(() => { cizimKare = 0; applyUI(); });
                }, 120);
            };
            document.getElementById('jba-hb-girdi').oninput = aramaDegisti;

            kapsamKur();
        };

        /* === KAPSAM SEÇİCİ ===
           Açılır menüydü: panelin içinde kırpılıyordu ve dört kısa seçenek
           için fazla ağırdı. Dört bölmeli tek satır oldu, tek dokunuş. */
        const kapsamYaz = () => {
            const kap = document.getElementById('jba-hb-kapsam');
            if (!kap) return;
            kap.querySelectorAll('button').forEach((b) => {
                b.setAttribute('aria-selected', String(b.getAttribute('data-deger') === kapsamDeger));
            });
        };

        const kapsamKur = () => {
            const kap = document.getElementById('jba-hb-kapsam');
            if (!kap) return;
            kapsamYaz();
            kap.querySelectorAll('button').forEach((b) => {
                b.onclick = () => {
                    kapsamDeger = b.getAttribute('data-deger');
                    localStorage.setItem('getir_hb_kapsam', kapsamDeger);
                    kapsamYaz();
                    applyUI();
                    document.getElementById('jba-hb-girdi')?.focus();
                };
            });
        };

        /* Kullanıcı metni HTML'e gömülüyor; kaçırılmazsa kendi ayar yazısı
           paneli bozabilir. */
        const kacir = (t) => String(t == null ? '' : t)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const formuAc = (ac) => {
            const govde = document.getElementById('jba-hb-form-govde');
            const yazi = document.getElementById('jba-hb-form-ac-yazi');
            const isaret = document.getElementById('jba-hb-form-ac-isaret');
            if (!govde) return;
            govde.hidden = !ac;
            if (yazi) yazi.textContent = ac ? 'Formu kapat' : 'Yeni kategori ekle';
            if (isaret) isaret.textContent = ac ? '−' : '+';
        };

        const duzenlemeyiBitir = () => {
            editingCategoryIndex = -1;
            formuAc(false);
            const kaydet = document.getElementById('jba-hb-kat-kaydet');
            const vazgec = document.getElementById('jba-hb-kat-vazgec');
            const kap = document.getElementById('jba-hb-form-dugmeler');
            if (kaydet) kaydet.innerText = 'Kategoriyi Kaydet';
            if (vazgec) vazgec.hidden = true;
            if (kap) kap.classList.remove('duzenleme');
            ['jba-hb-kat-ad', 'jba-hb-kat-dahil', 'jba-hb-kat-haric'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        };

        const renderCategories = () => {
            const list = document.getElementById('jba-hb-kat-liste');
            if (!list) return;
            if (userSettings.length === 0) {
                list.innerHTML = `<div class="kat-bos">Henüz kategori yok.<br>Yukarıdan ekleyebilirsin.</div>`;
                return;
            }
            list.innerHTML = userSettings.map((cat, idx) => `
                <div class="category-card" style="border-left-color:${kacir(cat.color)};background:${hexToRgba(cat.color, 0.07)}">
                    <div class="kat-ust">
                        <span class="kat-ad">${kacir(cat.name)}</span>
                        <div style="display:flex;gap:2px;flex-shrink:0;">
                            <button class="action-btn edit-btn" data-idx="${idx}" title="Düzenle">${SVG.kalem}</button>
                            <button class="action-btn del-btn sil-btn" data-idx="${idx}" title="Sil">${SVG.cop}</button>
                        </div>
                    </div>
                    <div class="kat-rozetler">
                        ${cat.includes.map(k => `<span class="badge inc">${kacir(k)}</span>`).join('')}
                        ${(cat.excludes || []).map(k => `<span class="badge exc">${kacir(k)}</span>`).join('')}
                    </div>
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
                    formuAc(true);
                    document.getElementById('jba-hb-kat-kaydet').innerText = 'Güncelle';
                    document.getElementById('jba-hb-kat-vazgec').hidden = false;
                    document.getElementById('jba-hb-form-dugmeler').classList.add('duzenleme');
                    document.getElementById('jba-hb-ayar').scrollTop = 0;
                    document.getElementById('jba-hb-kat-ad').focus();
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
            if (!kap) return;
            if (kap.contains(e.target)) return;
            paneliKapat();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !panelAcikMi()) return;
            paneliKapat();
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
