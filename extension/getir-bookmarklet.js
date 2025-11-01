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
    
    // Copy single row HTML
    async function copyRow(tr) {
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
                    window.location.href = BARCODE_SITE_URL;
                }, 500);
            }
        } else {
            alert('Kopyalama başarısız. Lütfen tekrar deneyin.');
        }
    }
    
    // Copy all rows HTML
    async function copyAllRows() {
        const tables = document.querySelectorAll('table');
        let allRows = [];
        
        tables.forEach(table => {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                allRows.push(row.outerHTML);
            });
        });
        
        if (allRows.length === 0) {
            alert('Kopyalanacak ürün bulunamadı.');
            return;
        }
        
        const html = allRows.join('\n');
        const success = await copyToClipboard(html);
        
        if (success) {
            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#4CAF50;color:white;padding:10px 15px;border-radius:4px;z-index:10000;box-shadow:0 2px 5px rgba(0,0,0,0.2);';
            notification.textContent = `✓ ${allRows.length} ürün kopyalandı!`;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 2000);
            
            // Auto redirect if enabled
            if (getAutoRedirect()) {
                setTimeout(() => {
                    window.location.href = BARCODE_SITE_URL;
                }, 500);
            }
        } else {
            alert('Kopyalama başarısız. Lütfen tekrar deneyin.');
        }
    }
    
    // Add button to row
    function addButtonToRow(tr) {
        // Check if button already exists
        if (tr.querySelector('.getir-copy-btn')) {
            return;
        }
        
        // Create button
        const btn = document.createElement('button');
        btn.className = 'getir-copy-btn';
        btn.textContent = '📋';
        btn.title = 'Bu ürünün HTML\'ini kopyala';
        btn.onclick = (e) => {
            e.stopPropagation();
            copyRow(tr);
        };
        
        // Add to last cell or create new cell
        const cells = tr.querySelectorAll('td');
        if (cells.length > 0) {
            const lastCell = cells[cells.length - 1];
            // Check if last cell already has a button
            if (!lastCell.querySelector('.getir-copy-btn')) {
                lastCell.appendChild(btn);
            }
        } else {
            // Create new cell if no cells exist
            const newCell = document.createElement('td');
            newCell.appendChild(btn);
            tr.appendChild(newCell);
        }
    }
    
    // Add "Copy All" button to table
    function addCopyAllButton(table) {
        // Check if button already exists
        if (table.querySelector('.getir-copy-all-container')) {
            return;
        }
        
        // Create container
        const container = document.createElement('div');
        container.className = 'getir-copy-all-container';
        
        const btn = document.createElement('button');
        btn.className = 'getir-copy-all-btn';
        btn.textContent = '📋 Tümünü Kopyala';
        btn.onclick = () => copyAllRows();
        
        container.appendChild(btn);
        
        // Insert before table
        if (table.parentNode) {
            table.parentNode.insertBefore(container, table);
        }
    }
    
    // Initialize: Find all tables and add buttons
    function init() {
        const tables = document.querySelectorAll('table');
        
        tables.forEach(table => {
            // Add "Copy All" button
            addCopyAllButton(table);
            
            // Add buttons to each row
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                addButtonToRow(row);
            });
        });
        
        // Watch for dynamically added rows (if page uses AJAX)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'TR' || node.querySelector('tr')) {
                            const rows = node.tagName === 'TR' ? [node] : node.querySelectorAll('tr');
                            rows.forEach(row => {
                                if (row.closest('tbody')) {
                                    addButtonToRow(row);
                                }
                            });
                        }
                        if (node.tagName === 'TABLE' || node.querySelector('table')) {
                            const tables = node.tagName === 'TABLE' ? [node] : node.querySelectorAll('table');
                            tables.forEach(table => {
                                addCopyAllButton(table);
                                const rows = table.querySelectorAll('tbody tr');
                                rows.forEach(row => addButtonToRow(row));
                            });
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
