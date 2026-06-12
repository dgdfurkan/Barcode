/**
 * Jet Barkod / localhost sayfaları için hafif köprü.
 * Sayfa script'leri (counting.js) isolated world'de chrome API göremez;
 * postMessage + chrome.runtime.sendMessage ile SKT isteği background'a iletilir.
 */
(function () {
    'use strict';

    const EXTENSION_ID = 'dhgdhdnnpeakmomlgpgmokecmdmeoebn';

    function postToPage(payload) {
        window.postMessage(payload, '*');
    }

    function relayExpiryToBackground(productIds, warehouseId, endDate) {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            postToPage({
                type: 'WAREHOUSE_EXPIRY_RESPONSE',
                success: false,
                error:
                    'Chrome eklentisi bağlantısı yok. «Getir Stok Senkronizasyonu» v1.1.1+ etkin mi? Sayfayı yenileyin (F5).',
                byProductId: {},
            });
            return;
        }

        chrome.runtime.sendMessage(
            {
                type: 'FETCH_EXPIRY_PRODUCTS',
                productIds: productIds || [],
                warehouseId: warehouseId || '5dcafe6ae2c61b1e52cf1704',
                endDate: endDate || '2030-07-31',
            },
            () => {
                if (chrome.runtime.lastError) {
                    postToPage({
                        type: 'WAREHOUSE_EXPIRY_RESPONSE',
                        success: false,
                        error: chrome.runtime.lastError.message,
                        byProductId: {},
                    });
                }
            }
        );
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data) return;

        if (event.data.type === 'GETIR_EXTENSION_PING') {
            postToPage({ type: 'GETIR_EXTENSION_PONG', extensionId: EXTENSION_ID });
            return;
        }

        if (event.data.type === 'GETIR_FETCH_EXPIRY_REQUEST') {
            relayExpiryToBackground(event.data.productIds, event.data.warehouseId, event.data.endDate);
        }
    });

    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'WAREHOUSE_EXPIRY_PROGRESS') {
            postToPage({ type: 'WAREHOUSE_EXPIRY_PROGRESS', message: request.message || '' });
        } else if (request.type === 'WAREHOUSE_EXPIRY_RESPONSE') {
            postToPage({
                type: 'WAREHOUSE_EXPIRY_RESPONSE',
                success: request.success,
                byProductId: request.byProductId,
                error: request.error,
                total: request.total,
                withData: request.withData,
            });
        }
    });

    window.getirExtensionHelper = {
        extensionId: EXTENSION_ID,
        isAvailable() {
            return typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage;
        },
        fetchExpiryProducts(productIds, options = {}) {
            return new Promise((resolve, reject) => {
                const ids = Array.isArray(productIds) ? productIds.filter(Boolean) : [];
                if (!ids.length) {
                    reject(new Error('Ürün listesi boş'));
                    return;
                }
                let settled = false;
                const finish = (ok, payload) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    if (ok) resolve(payload);
                    else reject(new Error(payload || 'SKT alınamadı'));
                };
                const onResponse = (e) => {
                    if (e?.data?.type !== 'WAREHOUSE_EXPIRY_RESPONSE') return;
                    if (e.data.success) finish(true, e.data);
                    else finish(false, e.data.error || 'SKT alınamadı');
                };
                const cleanup = () => window.removeEventListener('message', onResponse);
                window.addEventListener('message', onResponse);
                relayExpiryToBackground(ids, options.warehouseId, options.endDate);
                setTimeout(() => finish(false, 'SKT isteği zaman aşımına uğradı'), 120000);
            });
        },
    };

    postToPage({ type: 'GETIR_EXTENSION_READY', extensionId: EXTENSION_ID });
})();
