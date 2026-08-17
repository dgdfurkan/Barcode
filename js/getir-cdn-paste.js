/**
 * Getir market ürün görsel CDN adreslerini metinden çıkarır ve katalogda ürün eşlemesi yapar.
 * pages/product_search.html ve js/counting.js tarafından paylaşılır.
 */
(function (global) {
    'use strict';

    /** Yeni market görselleri: …/market/product/{uuid}.jpg */
    var RE_CDN_IMAGE =
        /https?:\/\/cdn-image\.getir\.com\/market\/product\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|gif|webp)/gi;

    /** Eski görseller: cdn.getir.com/product/{id}_tr_{ts}.jpeg */
    var RE_CDN_LEGACY = /https?:\/\/cdn\.getir\.com\/product\/[^\s,?#"']+\.(?:jpe?g|png|gif|webp)/gi;

    /** Placeholder: cdn.getir.com/misc/product_placeholder_….jpeg */
    var RE_CDN_MISC = /https?:\/\/cdn\.getir\.com\/misc\/[^\s,?#"']+\.(?:jpe?g|png|gif|webp)/gi;

    /** Franchise ERP yüklemeleri: vsrm-cdn.erp.getirapi.com/docs/… */
    var RE_ERP_DOCS =
        /https?:\/\/vsrm-cdn\.erp\.getirapi\.com\/docs\/[^\s,?#"']+\.(?:jpe?g|png|gif|webp)/gi;

    /** BİRLEŞTİRİLMİŞ regex — metni TEK SEFERDE soldan sağa tarayıp sıra korur.
     *  Eski yaklaşımda her pattern tüm metni baştan tarıyordu → URL'ler pattern gruplarına göre sıralanıyordu (sıra bozuk). */
    var RE_GETIR_ALL = new RegExp(
        '(?:' +
            'https?:\\/\\/cdn-image\\.getir\\.com\\/market\\/product\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:jpe?g|png|gif|webp)' +
            '|https?:\\/\\/cdn\\.getir\\.com\\/product\\/[^\\s,?#"\']+?\\.(?:jpe?g|png|gif|webp)' +
            '|https?:\\/\\/cdn\\.getir\\.com\\/misc\\/[^\\s,?#"\']+?\\.(?:jpe?g|png|gif|webp)' +
            '|https?:\\/\\/vsrm-cdn\\.erp\\.getirapi\\.com\\/docs\\/[^\\s,?#"\']+?\\.(?:jpe?g|png|gif|webp)' +
        ')',
        'gi'
    );

    function normalizeGetirImageFileKey(filename) {
        if (!filename) return '';
        var base = filename.split('?')[0].split('#')[0];
        base = base.replace(/\.(jpe?g|png|gif|webp)$/i, '');
        base = base.replace(/_[a-z]{2}_\d+$/i, '');
        return base.toLowerCase();
    }

    /** ERP dosya adı veya URL içindeki ürün UUID’si (market görseli ile köprü). */
    function extractEmbeddedProductUuid(s) {
        if (!s) return null;
        var m = String(s).match(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
        );
        return m ? m[0].toLowerCase() : null;
    }

    /**
     * Virgül, boşluk veya satır sonlarıyla ayrılmış metinden Getir ürün görsel URL'lerini SIRAYLA döner.
     * KRİTİK: Tüm pattern'leri TEK regex ile soldan sağa tarar — yapıştırma sırası birebir korunur.
     * @param {string} text
     * @returns {string[]}
     */
    function extractGetirCdnProductImageUrlsFromText(text) {
        if (!text || typeof text !== 'string') return [];
        var seen = new Set();
        var out = [];
        RE_GETIR_ALL.lastIndex = 0;
        var m;
        while ((m = RE_GETIR_ALL.exec(text)) !== null) {
            var u = m[0];
            var key = u.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                out.push(u);
            }
        }
        return out;
    }

    /**
     * @param {Array<{ image?: string, barcodes?: Array<{ code?: string }> }>} products
     * @param {string} imageUrl
     * @returns {object|null}
     */
    /**
     * Toplu yapıştırma için O(1) görsel → ürün indeksi (tek seferlik kurulur).
     * @param {Array} products
     * @returns {{ byFullUrl: Map, byFileKey: Map, byUuid: Map }}
     */
    function buildGetirImageProductIndex(products) {
        var byFullUrl = new Map();
        var byFileKey = new Map();
        var byUuid = new Map();
        if (!products || !products.length) return { byFullUrl: byFullUrl, byFileKey: byFileKey, byUuid: byUuid };
        for (var i = 0; i < products.length; i++) {
            var product = products[i];
            if (!product || !product.image) continue;
            var pi = String(product.image).toLowerCase().trim();
            if (!byFullUrl.has(pi)) byFullUrl.set(pi, product);
            var pf = pi.split('/').pop().split('?')[0];
            if (!pf) continue;
            var fk = normalizeGetirImageFileKey(pf);
            if (fk && !byFileKey.has(fk)) byFileKey.set(fk, product);
            var uuid = extractEmbeddedProductUuid(pf + ' ' + pi);
            if (uuid && !byUuid.has(uuid)) byUuid.set(uuid, product);
        }
        return { byFullUrl: byFullUrl, byFileKey: byFileKey, byUuid: byUuid };
    }

    function findProductByGetirImageUrlFromIndex(index, imageUrl) {
        if (!index || !imageUrl || typeof imageUrl !== 'string') return null;
        var searchLower = imageUrl.toLowerCase().trim();
        var direct = index.byFullUrl.get(searchLower);
        if (direct) return direct;
        var searchFile = searchLower.split('/').pop().split('?')[0];
        var searchKey = normalizeGetirImageFileKey(searchFile);
        if (searchKey) {
            var byKey = index.byFileKey.get(searchKey);
            if (byKey) return byKey;
        }
        var searchUuid = extractEmbeddedProductUuid(searchFile + ' ' + imageUrl);
        if (searchUuid) {
            var byUuidHit = index.byUuid.get(searchUuid);
            if (byUuidHit) return byUuidHit;
        }
        return null;
    }

    function findProductByGetirImageUrl(products, imageUrl) {
        if (!products || !imageUrl || typeof imageUrl !== 'string') return null;
        return findProductByGetirImageUrlFromIndex(buildGetirImageProductIndex(products), imageUrl);
    }

    function cleanUiNoiseFromProductName(text) {
        if (!text || typeof text !== 'string') return '';
        var s = text.replace(/\u200B/g, '').replace(/\s*\u{1F4CB}\s*/gu, ' ').trim();
        s = s.replace(/[\uFE0F\u200D]/g, '');
        s = s.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').trim();
        return s.replace(/\s+/g, ' ').trim();
    }

    function isGetirStyleProductHtml(s) {
        if (!s || typeof s !== 'string') return false;
        var lower = s.toLowerCase();
        if (!/<tr\b/i.test(s)) return false;
        var getirRow = /ant-table-row|getir-copy-btn|getir-copy-all/i.test(s);
        var getirImg = /<img[^>]+src=["'][^"']*getir\.com/i.test(s);
        var fullTableMarkers =
            lower.indexOf('ürün adı') !== -1 &&
            lower.indexOf('adet') !== -1 &&
            (lower.indexOf('önizleme') !== -1 || getirImg);
        return getirRow || getirImg || fullTableMarkers;
    }

    /**
     * Getir HTML'den satır sırasıyla { name, imageUrl } listesi.
     * @param {string} html
     * @returns {Array<{ name: string, imageUrl: string|null }>}
     */
    function extractGetirRowsFromHtml(html) {
        if (!html || typeof html !== 'string') return [];
        try {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var out = [];
            var seen = new Set();
            Array.from(doc.querySelectorAll('tr')).forEach(function (tr) {
                if (tr.closest('thead')) return;
                var cells = tr.querySelectorAll('td');
                if (cells.length < 2) return;
                var img = cells[0].querySelector('img');
                if (!img) return;
                var name = cleanUiNoiseFromProductName((cells[1].textContent || '').trim());
                if (!name || name.replace(/\s/g, '').length < 2) return;
                if (/^[\d\s]+$/u.test(name)) return;
                if (/^[\p{Extended_Pictographic}\s]+$/u.test(name)) return;
                var imageUrl = img.src && String(img.src).trim();
                if (imageUrl && !/^https?:\/\//i.test(imageUrl)) imageUrl = null;
                var key = (name.toLowerCase() + '|' + (imageUrl || '')).toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                out.push({ name: name, imageUrl: imageUrl || null });
            });
            return out;
        } catch (e) {
            return [];
        }
    }

    function normalizeNameForMatch(name) {
        return cleanUiNoiseFromProductName(name).toLowerCase().trim();
    }

    function stripParens(name) {
        return String(name || '')
            .replace(/\s*\([^)]*\)\s*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Görsel eşleşmezse ürün adıyla bul (tek satır yapıştırmada çalışan yol).
     * @param {Array} products
     * @param {string} name
     * @returns {object|null}
     */
    function findProductByNameForGetirPaste(products, name) {
        if (!products || !name) return null;
        var normalizedName = normalizeNameForMatch(name);
        var normalizedNameClean = stripParens(normalizedName);
        if (!normalizedName) return null;

        var exact = products.find(function (p) {
            if (!p || !p.name) return false;
            var pName = normalizeNameForMatch(p.name);
            var pNameClean = stripParens(pName);
            return (
                pName === normalizedName ||
                pNameClean === normalizedName ||
                pName === normalizedNameClean ||
                pNameClean === normalizedNameClean
            );
        });
        if (exact) return exact;

        if (normalizedNameClean.length <= 3) return null;
        var generic = ['ekmek', 'süt', 'su', 'peynir', 'yumurta'];
        if (generic.indexOf(normalizedNameClean) !== -1) return null;

        return (
            products.find(function (p) {
                if (!p || !p.name) return false;
                var pName = normalizeNameForMatch(p.name);
                var pNameClean = stripParens(pName);
                return (
                    pName.indexOf(normalizedNameClean) !== -1 ||
                    normalizedNameClean.indexOf(pNameClean) !== -1 ||
                    pNameClean.indexOf(normalizedNameClean) !== -1 ||
                    normalizedNameClean.indexOf(pName) !== -1
                );
            }) || null
        );
    }

    /**
     * Getir HTML → katalog ürünleri (satır sırası korunur, görsel + isim fallback).
     * @param {string} html
     * @param {Array} products
     * @returns {object[]}
     */
    function resolveProductsFromGetirHtml(html, products) {
        var rows = extractGetirRowsFromHtml(html);
        if (!rows.length || !products || !products.length) return [];

        var index = buildGetirImageProductIndex(products);
        var resolved = [];
        var seenIds = new Set();

        rows.forEach(function (row) {
            var product = null;
            if (row.imageUrl) {
                product = findProductByGetirImageUrlFromIndex(index, row.imageUrl);
            }
            if (!product && row.name) {
                product = findProductByNameForGetirPaste(products, row.name);
            }
            if (!product || !product.id || seenIds.has(product.id)) return;
            seenIds.add(product.id);
            resolved.push(product);
        });

        return resolved;
    }

    /**
     * Panodan Getir eklenti çıktısını okur (HTML öncelikli — URL'ler kaybolmaz).
     * @returns {Promise<string>}
     */
    async function readClipboardTextForImport() {
        try {
            if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
                var items = await navigator.clipboard.read();
                for (var hi = 0; hi < items.length; hi++) {
                    var item = items[hi];
                    var types = item.types || [];
                    if (types.indexOf('text/html') === -1) continue;
                    var html = await (await item.getType('text/html')).text();
                    if (html && typeof html === 'string' && html.trim()) {
                        return html.trim();
                    }
                }
                for (var pi = 0; pi < items.length; pi++) {
                    var item2 = items[pi];
                    var types2 = item2.types || [];
                    if (types2.indexOf('text/plain') === -1) continue;
                    var plain = await (await item2.getType('text/plain')).text();
                    if (plain && typeof plain === 'string' && plain.trim()) {
                        return plain.trim();
                    }
                }
            }
        } catch (e) {
            /* izin yok veya read() desteklenmiyor */
        }
        try {
            if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
                var t = await navigator.clipboard.readText();
                if (t && typeof t === 'string' && t.trim()) return t.trim();
            }
        } catch (e2) {
            /* izin reddedildi */
        }
        return '';
    }

    global.GetirCdnPaste = {
        extractGetirCdnProductImageUrlsFromText: extractGetirCdnProductImageUrlsFromText,
        buildGetirImageProductIndex: buildGetirImageProductIndex,
        findProductByGetirImageUrlFromIndex: findProductByGetirImageUrlFromIndex,
        findProductByGetirImageUrl: findProductByGetirImageUrl,
        readClipboardTextForImport: readClipboardTextForImport,
        cleanUiNoiseFromProductName: cleanUiNoiseFromProductName,
        isGetirStyleProductHtml: isGetirStyleProductHtml,
        extractGetirRowsFromHtml: extractGetirRowsFromHtml,
        findProductByNameForGetirPaste: findProductByNameForGetirPaste,
        resolveProductsFromGetirHtml: resolveProductsFromGetirHtml,
    };
})(typeof window !== 'undefined' ? window : globalThis);
