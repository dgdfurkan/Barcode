// Getir Warehouse HTML Kopyalayıcı - Chrome Extension
// warehouse.getir.com sayfasında ürün listelerine 📋 butonları ekler
// Sayfa yenilense bile otomatik çalışır (bookmarklet gibi tekrar tıklamaya gerek yok)

(function() {
    'use strict';

    const BARCODE_SITE_URL = 'https://dgdfurkan.github.io/Barcode/pages/product_search.html';
    const STORAGE_KEY = 'getirAutoRedirect';

    const styles = `
        .getir-copy-btn {
            opacity: 0.4;
            transition: opacity 0.2s;
            font-size: 11px;
            padding: 2px 6px;
            border: 1px solid #ddd;
            background: #f5f5f5;
            border-radius: 3px;
            cursor: pointer;
            margin-left: 5px;
            color: #666;
            font-weight: normal;
        }
        .getir-copy-btn:hover {
            opacity: 1;
            background: #e8f4f8;
            border-color: #4a90e2;
            color: #4a90e2;
        }
        .getir-copy-all-btn {
            opacity: 0.6;
            padding: 4px 10px;
            font-size: 12px;
            border: 1px solid #4a90e2;
            background: #e8f4f8;
            color: #4a90e2;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
            font-weight: 500;
        }
        .getir-copy-all-btn:hover {
            opacity: 1;
            background: #4a90e2;
            color: white;
        }
        .getir-copy-all-container {
            display: flex;
            justify-content: flex-end;
            padding: 5px;
            margin-bottom: 10px;
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    async function getAutoRedirect() {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            return result[STORAGE_KEY] === true || result[STORAGE_KEY] === 'true';
        } catch (e) {
            return false;
        }
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (e) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    }

    function navigateToBarcodeSite() {
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const channel = new BroadcastChannel('barcode_site_nav');
                let responded = false;
                channel.postMessage({ type: 'ping', url: BARCODE_SITE_URL });
                const messageHandler = (e) => {
                    if (e.data && e.data.type === 'pong' && !responded) {
                        responded = true;
                        channel.close();
                        return;
                    }
                };
                channel.addEventListener('message', messageHandler);
                setTimeout(() => {
                    if (!responded) {
                        channel.removeEventListener('message', messageHandler);
                        channel.close();
                        window.open(BARCODE_SITE_URL, '_blank');
                    }
                }, 500);
                return;
            }
        } catch (e) {}
        window.open(BARCODE_SITE_URL, '_blank');
    }

    async function copyRow(tr) {
        const html = tr.outerHTML;
        const success = await copyToClipboard(html);
        if (success) {
            const notification = document.createElement('div');
            notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#4CAF50;color:white;padding:10px 15px;border-radius:4px;z-index:10000;box-shadow:0 2px 5px rgba(0,0,0,0.2);';
            notification.textContent = '✓ HTML kopyalandı!';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 2000);
            if (await getAutoRedirect()) {
                setTimeout(navigateToBarcodeSite, 500);
            }
        } else {
            alert('Kopyalama başarısız. Lütfen tekrar deneyin.');
        }
    }

    async function copyAllRows() {
        let rowContainer = null;
        const allRows = document.querySelectorAll('.ant-row');
        for (const row of allRows) {
            const cols = row.querySelectorAll('.ant-col');
            let hasProductTables = false;
            for (const col of cols) {
                const tables = col.querySelectorAll('table');
                if (tables.length > 0) {
                    for (const table of tables) {
                        const productRows = table.querySelectorAll('tbody tr');
                        for (const tr of productRows) {
                            const hasImage = tr.querySelector('img');
                            const cells = tr.querySelectorAll('td');
                            const hasProductName = Array.from(cells).some(cell => {
                                const text = cell.textContent.trim();
                                return text && text.length > 2 && !text.match(/^\d+$/) && !text.includes('#') && !text.includes('Ürün Adı') && !text.includes('Adet');
                            });
                            if (hasImage || hasProductName) {
                                hasProductTables = true;
                                break;
                            }
                        }
                        if (hasProductTables) break;
                    }
                }
                if (hasProductTables) break;
            }
            if (hasProductTables) {
                rowContainer = row;
                break;
            }
        }
        if (rowContainer) {
            const html = rowContainer.outerHTML;
            const success = await copyToClipboard(html);
            if (success) {
                const notification = document.createElement('div');
                notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#4CAF50;color:white;padding:10px 15px;border-radius:4px;z-index:10000;box-shadow:0 2px 5px rgba(0,0,0,0.2);';
                const productCount = rowContainer.querySelectorAll('tbody tr.ant-table-row').length;
                notification.textContent = `✓ ${productCount} ürün kopyalandı!`;
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 2000);
                if (await getAutoRedirect()) {
                    setTimeout(navigateToBarcodeSite, 500);
                }
            } else {
                alert('Kopyalama başarısız. Lütfen tekrar deneyin.');
            }
        } else {
            alert('Kopyalanacak ürün tablosu bulunamadı.');
        }
    }

    function isProductTable(table) {
        if (table.closest('.ant-descriptions')) return false;
        if (table.closest('.ant-descriptions-view')) return false;
        const wrapper = table.closest('.ant-table-wrapper, .ant-table-container');
        if (!wrapper && !table.classList.contains('ant-table')) {
            const rowContainer = table.closest('.ant-row .ant-col');
            if (!rowContainer) return false;
        }
        return true;
    }

    function isProductRow(tr) {
        if (tr.closest('.ant-descriptions')) return false;
        if (tr.classList.contains('ant-descriptions-row')) return false;
        if (tr.closest('.ant-descriptions-view')) return false;
        const cells = tr.querySelectorAll('td');
        const cellTexts = Array.from(cells).map(cell => cell.textContent.trim()).join(' ').toLowerCase();
        const skipPatterns = ['müşteri adı', 'müşteri notu', 'teslimat adresi', 'adres açıklaması', 'toplayıcı adı', 'kurye adı', 'poşet kullanımı', 'durum', 'lokasyonlar', 'müşteri', 'kurye', 'toplayıcı', 'adres', 'teslimat', 'notu'];
        for (const pattern of skipPatterns) {
            if (cellTexts.includes(pattern.toLowerCase())) return false;
        }
        const hasImage = tr.querySelector('img[src*="product"], img[src*="getir.com/product"], img[src*="getir.com/market/product"], img[src*="market/product"], img[src*="cdn-image.getir.com"]');
        if (hasImage) {}
        else {
            const antImage = tr.querySelector('.ant-image img');
            if (!antImage) return false;
            if (!antImage.src || (!antImage.src.includes('product') && !antImage.src.includes('getir'))) return false;
        }
        const hasProductName = Array.from(cells).some(cell => {
            const text = cell.textContent.trim();
            return text && text.length > 2 && !text.match(/^\d+$/) && !text.match(/^[0-9]+$/);
        });
        return hasProductName;
    }

    function addButtonToRow(tr) {
        if (tr.querySelector('.getir-copy-btn')) return;
        if (!isProductRow(tr)) return;
        const btn = document.createElement('button');
        btn.className = 'getir-copy-btn';
        btn.textContent = '📋';
        btn.title = 'Bu ürünün HTML\'ini kopyala';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyRow(tr);
        };
        const cells = tr.querySelectorAll('td');
        if (cells.length > 0) {
            const lastCell = cells[cells.length - 1];
            if (!lastCell.querySelector('.getir-copy-btn')) {
                lastCell.style.position = 'relative';
                lastCell.appendChild(btn);
            }
        } else {
            const newCell = document.createElement('td');
            newCell.appendChild(btn);
            tr.appendChild(newCell);
        }
    }

    function addCopyAllButton() {
        if (document.querySelector('.getir-copy-all-container')) return;
        let rowContainer = null;
        const allRows = document.querySelectorAll('.ant-row');
        for (const row of allRows) {
            if (row.closest('.ant-descriptions')) continue;
            const cols = row.querySelectorAll('.ant-col');
            let hasProductTables = false;
            for (const col of cols) {
                const tables = col.querySelectorAll('table');
                if (tables.length > 0) {
                    for (const table of tables) {
                        if (!isProductTable(table)) continue;
                        const productRows = table.querySelectorAll('tbody tr');
                        for (const tr of productRows) {
                            if (isProductRow(tr)) {
                                hasProductTables = true;
                                break;
                            }
                        }
                        if (hasProductTables) break;
                    }
                }
                if (hasProductTables) break;
            }
            if (hasProductTables) {
                rowContainer = row;
                break;
            }
        }
        if (!rowContainer) return;
        const container = document.createElement('div');
        container.className = 'getir-copy-all-container';
        const btn = document.createElement('button');
        btn.className = 'getir-copy-all-btn';
        btn.textContent = '📋 Tümünü Kopyala';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyAllRows();
        };
        container.appendChild(btn);
        if (rowContainer.parentNode) {
            rowContainer.parentNode.insertBefore(container, rowContainer);
        }
    }

    function processTables() {
        addCopyAllButton();
        const allRows = document.querySelectorAll('.ant-row');
        let processedTables = new Set();
        for (const row of allRows) {
            if (row.closest('.ant-descriptions')) continue;
            const cols = row.querySelectorAll('.ant-col');
            for (const col of cols) {
                const tables = col.querySelectorAll('table');
                tables.forEach(table => {
                    if (processedTables.has(table)) return;
                    if (!isProductTable(table)) return;
                    processedTables.add(table);
                    const rows = table.querySelectorAll('tbody tr');
                    rows.forEach(tr => {
                        if (isProductRow(tr)) addButtonToRow(tr);
                    });
                });
            }
        }
    }

    function init() {
        processTables();
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    if (node.tagName === 'TR' || (node.querySelector && node.querySelector('tr'))) {
                        const rows = node.tagName === 'TR' ? [node] : node.querySelectorAll('tr');
                        rows.forEach(row => {
                            if (row.closest('.ant-descriptions')) return;
                            if (row.closest('tbody') && isProductRow(row)) addButtonToRow(row);
                        });
                    }
                    if (node.tagName === 'TABLE' || (node.querySelector && node.querySelector('table'))) {
                        const tables = node.tagName === 'TABLE' ? [node] : node.querySelectorAll('table');
                        tables.forEach(table => {
                            if (!isProductTable(table)) return;
                            addCopyAllButton();
                            const rows = table.querySelectorAll('tbody tr');
                            rows.forEach(row => {
                                if (isProductRow(row)) addButtonToRow(row);
                            });
                        });
                    }
                    if (node.classList && (node.classList.contains('ant-modal-body') || node.classList.contains('ant-table-wrapper') || node.classList.contains('ant-table-container') || node.classList.contains('ant-modal-content'))) {
                        setTimeout(processTables, 200);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        const modalRoot = document.querySelector('.ant-modal-root') || document.body;
        const modalObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('ant-modal')) {
                        setTimeout(processTables, 300);
                    }
                });
            });
        });
        modalObserver.observe(modalRoot, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
