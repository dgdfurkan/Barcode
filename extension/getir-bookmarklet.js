// Getir Warehouse Bookmarklet
// This bookmarklet adds copy buttons to product rows on Getir warehouse site
// Usage: Add as bookmarklet and click on warehouse.getir.com pages

(function() {
    'use strict';
    
    // Check if already initialized
    if (window.getirBookmarkletLoaded) {
        console.log('Getir Bookmarklet already loaded');
        return;
    }
    window.getirBookmarkletLoaded = true;
    
    // Configuration
    const BARCODE_SITE_URL = 'https://dgdfurkan.github.io/Barcode/pages/product_search.html';
    const STORAGE_KEY = 'getirAutoRedirect';
    
    // Styles
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
    
    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    
    // Get setting from localStorage
    function getAutoRedirect() {
        try {
            return localStorage.getItem(STORAGE_KEY) !== '0';
        } catch (e) {
            return true; // Default to enabled
        }
    }
    
    // Copy to clipboard
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
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
    
    // Navigate to barcode site (switch to existing tab if open, otherwise open new tab)
    function navigateToBarcodeSite() {
        // Try BroadcastChannel first to check if page is already open
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const channel = new BroadcastChannel('barcode_site_nav');
                let responded = false;
                
                // Send ping message
                channel.postMessage({ type: 'ping', url: BARCODE_SITE_URL });
                
                // Listen for response (page is open)
                const messageHandler = (e) => {
                    if (e.data && e.data.type === 'pong' && !responded) {
                        responded = true;
                        // Page is open, try to focus it
                        // Use window.open with target name to reuse existing tab
                        const targetWindow = window.open(BARCODE_SITE_URL, 'barcode_site');
                        if (targetWindow) {
                            try {
                                targetWindow.focus();
                            } catch (err) {
                                // Cross-origin restriction, ignore
                            }
                        }
                        channel.close();
                    }
                };
                
                channel.addEventListener('message', messageHandler);
                
                // If no response in 100ms, open new tab
                setTimeout(() => {
                    if (!responded) {
                        channel.removeEventListener('message', messageHandler);
                        window.open(BARCODE_SITE_URL, 'barcode_site');
                        channel.close();
                    }
                }, 100);
                
                return;
            }
        } catch (e) {
            // BroadcastChannel not supported, fall through
        }
        
        // Fallback: Use window.open with target name (will reuse tab if exists)
        window.open(BARCODE_SITE_URL, 'barcode_site');
    }
    
    // Copy single row HTML
    async function copyRow(tr) {
        // Copy only the <tr> element (single product row)
        const html = tr.outerHTML;
        const success = await copyToClipboard(html);
        
        if (success) {
            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#4CAF50;color:white;padding:10px 15px;border-radius:4px;z-index:10000;box-shadow:0 2px 5px rgba(0,0,0,0.2);';
            notification.textContent = '✓ HTML kopyalandı!';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 2000);
            
            // Auto redirect if enabled
            if (getAutoRedirect()) {
                setTimeout(() => {
                    navigateToBarcodeSite();
                }, 500);
            }
        } else {
            alert('Kopyalama başarısız. Lütfen tekrar deneyin.');
        }
    }
    
    // Copy all rows HTML (only the ant-row container with product tables, excluding customer info)
    async function copyAllRows() {
        // Find the ant-row container that contains all product tables
        // Look for ant-row that contains multiple ant-col with tables inside
        let rowContainer = null;
        
        // First try: Find ant-row with ant-col containers that have tables
        const allRows = document.querySelectorAll('.ant-row');
        for (const row of allRows) {
            // Check if this row has columns with product tables
            const cols = row.querySelectorAll('.ant-col');
            let hasProductTables = false;
            
            for (const col of cols) {
                const tables = col.querySelectorAll('table');
                if (tables.length > 0) {
                    // Check if tables have product rows (tbody tr with images or product names)
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
                
                if (getAutoRedirect()) {
                    setTimeout(() => {
                        navigateToBarcodeSite();
                    }, 500);
                }
            } else {
                alert('Kopyalama başarısız. Lütfen tekrar deneyin.');
            }
        } else {
            alert('Kopyalanacak ürün tablosu bulunamadı.');
        }
    }
    
    // Check if a table is a product table (not descriptions table, customer info, etc.)
    function isProductTable(table) {
        // Skip ant-descriptions tables (customer info, address, etc.)
        if (table.closest('.ant-descriptions')) {
            return false;
        }
        
        // Skip if table is inside ant-descriptions-view
        if (table.closest('.ant-descriptions-view')) {
            return false;
        }
        
        // Must be inside ant-table-wrapper or have ant-table class
        const wrapper = table.closest('.ant-table-wrapper, .ant-table-container');
        if (!wrapper && !table.classList.contains('ant-table')) {
            // Check if it's inside ant-row with ant-col (product tables structure)
            const rowContainer = table.closest('.ant-row .ant-col');
            if (!rowContainer) {
                return false;
            }
        }
        
        return true;
    }
    
    // Check if a row is a product row (not customer info, address, etc.)
    function isProductRow(tr) {
        // Skip if inside ant-descriptions (customer info table)
        if (tr.closest('.ant-descriptions')) {
            return false;
        }
        
        // Skip ant-descriptions-row
        if (tr.classList.contains('ant-descriptions-row')) {
            return false;
        }
        
        // Skip if row is inside ant-descriptions-view
        if (tr.closest('.ant-descriptions-view')) {
            return false;
        }
        
        const cells = tr.querySelectorAll('td');
        const cellTexts = Array.from(cells).map(cell => cell.textContent.trim()).join(' ').toLowerCase();
        
        // Skip rows with customer info, address, collector, courier, etc.
        const skipPatterns = [
            'müşteri adı', 'müşteri notu', 'teslimat adresi', 'adres açıklaması',
            'toplayıcı adı', 'kurye adı', 'poşet kullanımı', 'durum', 'lokasyonlar',
            'müşteri', 'kurye', 'toplayıcı', 'adres', 'teslimat', 'notu'
        ];
        
        // Check if row contains any skip patterns
        for (const pattern of skipPatterns) {
            if (cellTexts.includes(pattern.toLowerCase())) {
                return false;
            }
        }
        
        // Must have an image (product images) to be a product row
        // Product images are in product URLs
        const hasImage = tr.querySelector('img[src*="product"], img[src*="getir.com/product"]');
        if (!hasImage) {
            return false;
        }
        
        // Must have product name (not just numbers)
        const hasProductName = Array.from(cells).some(cell => {
            const text = cell.textContent.trim();
            return text && 
                   text.length > 2 && 
                   !text.match(/^\d+$/) && 
                   !text.match(/^[0-9]+$/);
        });
        
        return hasProductName;
    }
    
    // Add button to row
    function addButtonToRow(tr) {
        // Check if button already exists
        if (tr.querySelector('.getir-copy-btn')) {
            return;
        }
        
        // Only add button if it's a product row
        if (!isProductRow(tr)) {
            return;
        }
        
        // Create button
        const btn = document.createElement('button');
        btn.className = 'getir-copy-btn';
        btn.textContent = '📋';
        btn.title = 'Bu ürünün HTML\'ini kopyala';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyRow(tr);
        };
        
        // Add to last cell
        if (cells.length > 0) {
            const lastCell = cells[cells.length - 1];
            // Check if last cell already has a button
            if (!lastCell.querySelector('.getir-copy-btn')) {
                lastCell.style.position = 'relative';
                lastCell.appendChild(btn);
            }
        } else {
            // Create new cell if no cells exist
            const newCell = document.createElement('td');
            newCell.appendChild(btn);
            tr.appendChild(newCell);
        }
    }
    
    // Add "Copy All" button only to the product tables container (ant-row)
    // This function is called once per product container, not per table
    function addCopyAllButton() {
        // Check if button already exists
        if (document.querySelector('.getir-copy-all-container')) {
            return;
        }
        
        // Find the ant-row container with product tables (skip descriptions tables)
        let rowContainer = null;
        const allRows = document.querySelectorAll('.ant-row');
        
        for (const row of allRows) {
            // Skip if inside ant-descriptions
            if (row.closest('.ant-descriptions')) {
                continue;
            }
            
            const cols = row.querySelectorAll('.ant-col');
            let hasProductTables = false;
            
            for (const col of cols) {
                const tables = col.querySelectorAll('table');
                if (tables.length > 0) {
                    for (const table of tables) {
                        // Skip descriptions tables
                        if (!isProductTable(table)) {
                            continue;
                        }
                        
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
        
        if (!rowContainer) {
            return;
        }
        
        // Create container
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
        
        // Insert before the rowContainer
        if (rowContainer.parentNode) {
            rowContainer.parentNode.insertBefore(container, rowContainer);
        }
    }
    
    // Initialize: Find product tables and add buttons
    function init() {
        console.log('🔧 Getir Bookmarklet: Initializing...');
        
        // First, add "Copy All" button once to the product container
        addCopyAllButton();
        
        // Find all tables within the product container (ant-row with ant-col)
        // Skip ant-descriptions tables
        const allRows = document.querySelectorAll('.ant-row');
        let processedTables = new Set();
        
        for (const row of allRows) {
            // Skip if inside ant-descriptions
            if (row.closest('.ant-descriptions')) {
                continue;
            }
            
            const cols = row.querySelectorAll('.ant-col');
            for (const col of cols) {
                const tables = col.querySelectorAll('table');
                tables.forEach(table => {
                    // Skip if already processed
                    if (processedTables.has(table)) {
                        return;
                    }
                    
                    // Skip descriptions tables
                    if (!isProductTable(table)) {
                        return;
                    }
                    
                    processedTables.add(table);
                    
                    // Add buttons only to product rows in product tables
                    const rows = table.querySelectorAll('tbody tr');
                    rows.forEach((tr) => {
                        if (isProductRow(tr)) {
                            addButtonToRow(tr);
                        }
                    });
                });
            }
        }
        
        console.log('🔧 Getir Bookmarklet: Initialization complete');
        
        // Watch for dynamically added rows (if page uses AJAX)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check for new rows
                        if (node.tagName === 'TR' || node.querySelector && node.querySelector('tr')) {
                            const rows = node.tagName === 'TR' ? [node] : node.querySelectorAll('tr');
                            rows.forEach(row => {
                                if (row.closest('tbody') && isProductRow(row)) {
                                    addButtonToRow(row);
                                }
                            });
                        }
                        // Check for new tables
                        if (node.tagName === 'TABLE' || (node.querySelector && node.querySelector('table'))) {
                            // Re-add "Copy All" button (in case product container was just added)
                            addCopyAllButton();
                            const tables = node.tagName === 'TABLE' ? [node] : node.querySelectorAll('table');
                            tables.forEach(table => {
                                const rows = table.querySelectorAll('tbody tr');
                                rows.forEach(row => {
                                    if (isProductRow(row)) {
                                        addButtonToRow(row);
                                    }
                                });
                            });
                        }
                        // Check for table wrapper changes (modal opening, etc.)
                        if (node.classList && (
                            node.classList.contains('ant-modal-body') ||
                            node.classList.contains('ant-table-wrapper') ||
                            node.classList.contains('ant-table-container')
                        )) {
                            // Re-initialize when modal opens
                            setTimeout(() => {
                                addCopyAllButton();
                                const tables = document.querySelectorAll('table');
                                tables.forEach(table => {
                                    const rows = table.querySelectorAll('tbody tr');
                                    rows.forEach(row => {
                                        if (isProductRow(row)) {
                                            addButtonToRow(row);
                                        }
                                    });
                                });
                            }, 100);
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
