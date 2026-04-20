/**
 * Getir market ürün görsel CDN adreslerini metinden çıkarır ve katalogda ürün eşlemesi yapar.
 * pages/product_search.html ve js/counting.js tarafından paylaşılır.
 */
(function (global) {
    'use strict';

    var GETIR_PRODUCT_IMG_RE =
        /https?:\/\/cdn-image\.getir\.com\/market\/product\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|gif|webp)/gi;

    /**
     * Virgül, boşluk veya satır sonlarıyla ayrılmış metinden Getir ürün görsel URL'lerini sırayla döner (yinelenenleri atar).
     * @param {string} text
     * @returns {string[]}
     */
    function extractGetirCdnProductImageUrlsFromText(text) {
        if (!text || typeof text !== 'string') return [];
        var seen = new Set();
        var out = [];
        var m;
        GETIR_PRODUCT_IMG_RE.lastIndex = 0;
        while ((m = GETIR_PRODUCT_IMG_RE.exec(text)) !== null) {
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
    function findProductByGetirImageUrl(products, imageUrl) {
        if (!products || !imageUrl || typeof imageUrl !== 'string') return null;
        var searchLower = imageUrl.toLowerCase().trim();
        var searchFile = searchLower.split('/').pop().split('?')[0];
        for (var i = 0; i < products.length; i++) {
            var product = products[i];
            if (!product || !product.image) continue;
            var pi = String(product.image).toLowerCase().trim();
            if (pi === searchLower) return product;
            var pf = pi.split('/').pop().split('?')[0];
            if (pf && pf === searchFile) return product;
        }
        return null;
    }

    global.GetirCdnPaste = {
        extractGetirCdnProductImageUrlsFromText: extractGetirCdnProductImageUrlsFromText,
        findProductByGetirImageUrl: findProductByGetirImageUrl,
    };
})(typeof window !== 'undefined' ? window : globalThis);
