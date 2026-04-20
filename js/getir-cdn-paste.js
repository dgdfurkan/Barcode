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

    function normalizeGetirImageFileKey(filename) {
        if (!filename) return '';
        var base = filename.split('?')[0].split('#')[0];
        base = base.replace(/\.(jpe?g|png|gif|webp)$/i, '');
        base = base.replace(/_[a-z]{2}_\d+$/i, '');
        return base.toLowerCase();
    }

    /**
     * Virgül, boşluk veya satır sonlarıyla ayrılmış metinden Getir ürün görsel URL'lerini sırayla döner (yinelenenleri atar).
     * @param {string} text
     * @returns {string[]}
     */
    function extractGetirCdnProductImageUrlsFromText(text) {
        if (!text || typeof text !== 'string') return [];
        var seen = new Set();
        var out = [];
        var patterns = [RE_CDN_IMAGE, RE_CDN_LEGACY];
        var pi;
        var m;
        for (pi = 0; pi < patterns.length; pi++) {
            patterns[pi].lastIndex = 0;
            while ((m = patterns[pi].exec(text)) !== null) {
                var u = m[0];
                var key = u.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    out.push(u);
                }
            }
        }
        return out;
    }

    /**
     * @param {Array<{ image?: string, barcodes?: Array<{ code?: string }> }>} products
     * @param {string} imageUrl
     * @returns {object|null}
     */
    function findProductByGetirImageUrl(products, imageUrl) {
        if (!products || !imageUrl || typeof imageUrl !== 'string') return null;
        var searchLower = imageUrl.toLowerCase().trim();
        var searchFile = searchLower.split('/').pop().split('?')[0];
        var searchKey = normalizeGetirImageFileKey(searchFile);
        var i;
        var product;
        var pi;
        var pf;
        var pfKey;
        for (i = 0; i < products.length; i++) {
            product = products[i];
            if (!product || !product.image) continue;
            pi = String(product.image).toLowerCase().trim();
            if (pi === searchLower) return product;
            pf = pi.split('/').pop().split('?')[0];
            if (pf && pf === searchFile) return product;
            pfKey = normalizeGetirImageFileKey(pf);
            if (searchKey && pfKey && searchKey === pfKey) return product;
        }
        return null;
    }

    global.GetirCdnPaste = {
        extractGetirCdnProductImageUrlsFromText: extractGetirCdnProductImageUrlsFromText,
        findProductByGetirImageUrl: findProductByGetirImageUrl,
    };
})(typeof window !== 'undefined' ? window : globalThis);
