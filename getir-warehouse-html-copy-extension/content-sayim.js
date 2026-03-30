/**
 * Sayım ekranı (sayim.md benzeri Ant tablolar) — sipariş sayfasındaki
 * «Tümünü Kopyala» ile aynı yerleşim: getir-copy-all-container + insertBefore(ant-row).
 * Panoya BARCODE_SAYIM_V1 + JSON (HTML değil).
 */
(function () {
    'use strict';

    var CLIP_HEADER = 'BARCODE_SAYIM_V1';
    var MARKER_CLASS = 'getir-sayim-copy-marker';

    var styles =
        '\n        .getir-copy-all-container.' +
        MARKER_CLASS +
        ' {\n            display: flex;\n            justify-content: flex-end;\n            padding: 5px;\n            margin-bottom: 10px;\n        }\n        .getir-copy-all-btn.' +
        MARKER_CLASS +
        ' {\n            opacity: 0.6;\n            padding: 4px 10px;\n            font-size: 12px;\n            border: 1px solid #4a90e2;\n            background: #e8f4f8;\n            color: #4a90e2;\n            border-radius: 4px;\n            cursor: pointer;\n            margin: 5px;\n            font-weight: 500;\n        }\n        .getir-copy-all-btn.' +
        MARKER_CLASS +
        ':hover {\n            opacity: 1;\n            background: #4a90e2;\n            color: white;\n        }\n    ';
    var styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    function trimInner(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }

    function normHeader(s) {
        return trimInner(s).toLocaleLowerCase('tr-TR');
    }

    function getColumnHeaders(table) {
        var thead = table.querySelector('thead');
        if (!thead) return [];
        var ths = thead.querySelectorAll('th');
        var headers = [];
        for (var h = 0; h < ths.length; h++) {
            headers.push(trimInner(ths[h].textContent));
        }
        return headers;
    }

    function isSayimTable(table) {
        var headers = getColumnHeaders(table);
        if (!headers.length) return false;
        var lower = headers.map(normHeader);
        var hasName = lower.some(function (x) {
            return x.indexOf('ürün adı') !== -1 || x.indexOf('urun adi') !== -1;
        });
        var hasBc = lower.some(function (x) {
            return x.indexOf('barkod') !== -1;
        });
        return hasName && hasBc;
    }

    function columnIndices(table) {
        var headers = getColumnHeaders(table);
        var lower = headers.map(normHeader);
        var nameIdx = -1;
        var barcodeIdx = -1;
        for (var j = 0; j < lower.length; j++) {
            if (nameIdx < 0 && (lower[j].indexOf('ürün adı') !== -1 || lower[j].indexOf('urun adi') !== -1)) {
                nameIdx = j;
            }
            if (barcodeIdx < 0 && lower[j].indexOf('barkod') !== -1) {
                barcodeIdx = j;
            }
        }
        return { nameIdx: nameIdx, barcodeIdx: barcodeIdx };
    }

    function extractItems(table) {
        var idx = columnIndices(table);
        if (idx.nameIdx < 0 || idx.barcodeIdx < 0) return [];
        var items = [];
        var rows = table.querySelectorAll('tbody tr.ant-table-row');
        for (var r = 0; r < rows.length; r++) {
            var tr = rows[r];
            if (tr.classList.contains('ant-table-measure-row')) continue;
            var tds = tr.querySelectorAll('td');
            if (!tds.length) continue;
            var name = tds[idx.nameIdx] ? trimInner(tds[idx.nameIdx].textContent) : '';
            var bcCell = tds[idx.barcodeIdx];
            var barcodes = [];
            if (bcCell) {
                var tags = bcCell.querySelectorAll('.ant-tag, span[class*="tag"]');
                for (var t = 0; t < tags.length; t++) {
                    var tx = trimInner(tags[t].textContent);
                    if (/^\d{8,14}$/.test(tx)) barcodes.push(tx);
                }
            }
            var barcode = barcodes.length ? barcodes[0] : '';
            if (name || barcode) {
                items.push({
                    name: name,
                    barcode: barcode,
                    barcodes: barcodes.length ? barcodes : undefined,
                });
            }
        }
        return items;
    }

    function buildPayload(items) {
        return (
            CLIP_HEADER +
            '\n' +
            JSON.stringify({
                version: 1,
                source: 'getir-warehouse-sayim',
                generatedAt: new Date().toISOString(),
                itemCount: items.length,
                items: items,
            })
        );
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return fallbackCopy(text); });
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch (e) {
            document.body.removeChild(ta);
            return false;
        }
    }

    function showToast(msg, ok) {
        var el = document.createElement('div');
        el.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:2147483647;padding:10px 15px;border-radius:4px;font-size:14px;max-width:340px;box-shadow:0 2px 5px rgba(0,0,0,0.2);' +
            (ok ? 'background:#4CAF50;color:white;' : 'background:#b91c1c;color:#fff;');
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function () {
            el.remove();
        }, 2500);
    }

    /** content.js findRowContainer ile aynı: tablonun doğrudan saran ant-row’u */
    function findRowContainerForTable(table) {
        var el = table;
        while (el && el !== document.body) {
            if (el.classList && el.classList.contains('ant-row')) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    /**
     * Sipariş sayfası addCopyAllButton ile aynı: parent.insertBefore(container, row)
     * Her sayım tablosu için yalnızca en içteki ant-row’a bir buton (iç içe row çiftlemesini önler).
     */
    function addSayimCopyAllButton() {
        var seenRows = {};
        var tables = document.querySelectorAll('table');
        for (var i = 0; i < tables.length; i++) {
            var table = tables[i];
            if (!isSayimTable(table)) continue;
            if (table.closest('.ant-descriptions')) continue;

            var row = findRowContainerForTable(table);
            if (!row) continue;
            if (seenRows[row]) continue;
            seenRows[row] = true;

            if (row.previousElementSibling && row.previousElementSibling.classList.contains(MARKER_CLASS)) {
                continue;
            }

            var parent = row.parentNode;
            if (!parent) continue;

            var container = document.createElement('div');
            container.className = 'getir-copy-all-container ' + MARKER_CLASS;

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'getir-copy-all-btn ' + MARKER_CLASS;
            btn.textContent = '📋 Sayım Listesini Kopyala';
            btn.title = 'Sayım ürünlerini panoya alır (Barcode sayfasında Panodan İçe Aktar)';

            (function (tbl) {
                btn.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var items = extractItems(tbl);
                    if (!items.length) {
                        showToast('Tabloda ürün satırı bulunamadı.', false);
                        return;
                    }
                    copyToClipboard(buildPayload(items)).then(function (ok) {
                        if (ok) {
                            showToast('✓ ' + items.length + ' ürün kopyalandı! Sayım sayfasında «Panodan İçe Aktar» kullanın.', true);
                        } else {
                            showToast('Kopyalama başarısız.', false);
                        }
                    });
                };
            })(table);

            container.appendChild(btn);
            parent.insertBefore(container, row);
        }
    }

    function processSayimTables() {
        addSayimCopyAllButton();
    }

    function init() {
        processSayimTables();
        var obs = new MutationObserver(function () {
            processSayimTables();
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(processSayimTables, 400);
        setTimeout(processSayimTables, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
