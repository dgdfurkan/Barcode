/**
 * Sayım / depo tabloları — sipariş panelindeki ile aynı buton:
 * <div class="getir-copy-all-container"><button class="getir-copy-all-btn">📋 Tümünü Kopyala</button></div>
 * Tıklanınca panoya BARCODE_SAYIM_V1 + JSON (HTML değil).
 * Not: Tablo çoğu ekranda ant-row DIŞINDA (sadece ant-table-wrapper); bu yüzden insertBefore ant-row’a bağlı kalmıyoruz.
 */
(function () {
    'use strict';

    var CLIP_HEADER = 'BARCODE_SAYIM_V1';

    // content.js ile birebir aynı stiller (sipariş sayfası bu scripti çalıştırmadığı için burada da enjekte edilir)
    var styles =
        '\n        .getir-copy-all-btn {\n            opacity: 0.6;\n            padding: 4px 10px;\n            font-size: 12px;\n            border: 1px solid #4a90e2;\n            background: #e8f4f8;\n            color: #4a90e2;\n            border-radius: 4px;\n            cursor: pointer;\n            margin: 5px;\n            font-weight: 500;\n        }\n        .getir-copy-all-btn:hover {\n            opacity: 1;\n            background: #4a90e2;\n            color: white;\n        }\n        .getir-copy-all-container {\n            display: flex;\n            justify-content: flex-end;\n            padding: 5px;\n            margin-bottom: 10px;\n        }\n    ';
    if (!document.getElementById('getir-sayim-copy-styles')) {
        var styleEl = document.createElement('style');
        styleEl.id = 'getir-sayim-copy-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    function trimInner(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }

    function normHeader(s) {
        return trimInner(s).toLocaleLowerCase('tr-TR');
    }

    function headerTextsFromThead(table) {
        var thead = table.querySelector('thead');
        if (!thead) return [];
        var ths = thead.querySelectorAll('th');
        var headers = [];
        for (var h = 0; h < ths.length; h++) {
            var t = ths[h].querySelector('.ant-table-column-title');
            headers.push(trimInner(t ? t.textContent : ths[h].textContent));
        }
        return headers;
    }

    /** Bazı sürümlerde başlık ilk tbody satırında */
    function headerTextsFallback(table) {
        var tr = table.querySelector('tbody tr');
        if (!tr) return [];
        var cells = tr.querySelectorAll('th, td');
        var out = [];
        for (var c = 0; c < cells.length; c++) {
            out.push(trimInner(cells[c].textContent));
        }
        return out;
    }

    function getColumnHeaders(table) {
        var fromThead = headerTextsFromThead(table);
        if (fromThead.length) return fromThead;
        return headerTextsFallback(table);
    }

    function headerLooksLikeSayim(headers) {
        var lower = headers.map(normHeader);
        var hasName = lower.some(function (x) {
            return (
                x.indexOf('ürün adı') !== -1 ||
                x.indexOf('urun adi') !== -1 ||
                (x.indexOf('ürün') !== -1 && x.length < 20) ||
                x === 'ürün' ||
                x.indexOf('product') !== -1
            );
        });
        var hasBc = lower.some(function (x) {
            return x.indexOf('barkod') !== -1 || x.indexOf('barcode') !== -1;
        });
        return hasName && hasBc;
    }

    /** Satırlarda barkod + isim benzeri içerik (başlık farklı dildeyse) */
    function bodyLooksLikeSayim(table) {
        var rows = table.querySelectorAll('tbody tr');
        var ok = 0;
        for (var r = 0; r < rows.length && r < 8; r++) {
            var tr = rows[r];
            if (tr.classList.contains('ant-table-measure-row')) continue;
            var text = trimInner(tr.textContent);
            if (!text) continue;
            if (/\b\d{8,14}\b/.test(text) && text.length > 5) ok++;
        }
        return ok >= 2;
    }

    function isSayimTable(table) {
        if (table.closest('.ant-descriptions')) return false;
        var headers = getColumnHeaders(table);
        if (headers.length >= 2 && headerLooksLikeSayim(headers)) return true;
        return bodyLooksLikeSayim(table);
    }

    function columnIndices(table) {
        var headers = getColumnHeaders(table);
        var lower = headers.map(normHeader);
        var nameIdx = -1;
        var barcodeIdx = -1;
        for (var j = 0; j < lower.length; j++) {
            if (nameIdx < 0) {
                if (
                    lower[j].indexOf('ürün adı') !== -1 ||
                    lower[j].indexOf('urun adi') !== -1 ||
                    (lower[j].indexOf('ürün') !== -1 && lower[j].indexOf('barkod') === -1) ||
                    lower[j].indexOf('product') !== -1
                ) {
                    nameIdx = j;
                }
            }
            if (barcodeIdx < 0 && (lower[j].indexOf('barkod') !== -1 || lower[j].indexOf('barcode') !== -1)) {
                barcodeIdx = j;
            }
        }
        if (nameIdx < 0 || barcodeIdx < 0) {
            return guessIndicesFromBody(table);
        }
        return { nameIdx: nameIdx, barcodeIdx: barcodeIdx };
    }

    function guessIndicesFromBody(table) {
        var tr = table.querySelector('tbody tr:not(.ant-table-measure-row)');
        if (!tr) return { nameIdx: -1, barcodeIdx: -1 };
        var tds = tr.querySelectorAll('td');
        var nameIdx = -1;
        var barcodeIdx = -1;
        for (var i = 0; i < tds.length; i++) {
            var cell = tds[i];
            var tx = trimInner(cell.textContent);
            if (barcodeIdx < 0 && /\d{8,14}/.test(tx)) barcodeIdx = i;
            if (nameIdx < 0 && tx.length > 2 && !/^\d{8,14}$/.test(tx) && !/^\d+$/.test(tx)) nameIdx = i;
        }
        return { nameIdx: nameIdx, barcodeIdx: barcodeIdx };
    }

    function extractItems(table) {
        var idx = columnIndices(table);
        if (idx.nameIdx < 0 || idx.barcodeIdx < 0) return [];
        var items = [];
        var rowSel = 'tbody tr.ant-table-row';
        var rows = table.querySelectorAll(rowSel);
        if (!rows.length) {
            rows = table.querySelectorAll('tbody tr:not(.ant-table-measure-row)');
        }
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
                if (!barcodes.length) {
                    var m = trimInner(bcCell.textContent).match(/\d{8,14}/g);
                    if (m) barcodes = m;
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
     * Sipariş: parent.insertBefore(container, ant-row)
     * Sayım çoğu zaman: parent.insertBefore(container, .ant-table-wrapper) — tablo ant-row içinde değil
     */
    function findInsertBefore(table) {
        var row = findRowContainerForTable(table);
        if (row && row.contains(table)) {
            return { parent: row.parentNode, before: row };
        }
        var wrap = table.closest('.ant-table-wrapper');
        if (wrap && wrap.parentNode) {
            return { parent: wrap.parentNode, before: wrap };
        }
        var container = table.closest('.ant-table-container');
        if (container && container.parentNode) {
            return { parent: container.parentNode, before: container };
        }
        var spin = table.closest('.ant-spin-container');
        if (spin && spin.parentNode) {
            return { parent: spin.parentNode, before: spin };
        }
        return null;
    }

    function alreadyHasSayimButton(beforeEl) {
        var prev = beforeEl && beforeEl.previousElementSibling;
        return prev && prev.classList && prev.classList.contains('getir-copy-all-container') && prev.getAttribute('data-getir-sayim') === '1';
    }

    function addSayimCopyAllButton() {
        var tables = document.querySelectorAll('table');
        for (var i = 0; i < tables.length; i++) {
            var table = tables[i];
            if (!isSayimTable(table)) continue;

            var ins = findInsertBefore(table);
            if (!ins || !ins.parent || !ins.before) continue;

            if (alreadyHasSayimButton(ins.before)) continue;

            var container = document.createElement('div');
            container.className = 'getir-copy-all-container';
            container.setAttribute('data-getir-sayim', '1');

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'getir-copy-all-btn';
            btn.textContent = '📋 Tümünü Kopyala';
            btn.title = 'Sayım listesini panoya kopyala (Barcode → Sayım → Panodan İçe Aktar)';

            (function (tbl) {
                btn.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var items = extractItems(tbl);
                    if (!items.length) {
                        showToast('Bu tabloda ürün / barkod satırı bulunamadı.', false);
                        return;
                    }
                    copyToClipboard(buildPayload(items)).then(function (ok) {
                        if (ok) {
                            showToast('✓ ' + items.length + ' kalem kopyalandı.', true);
                        } else {
                            showToast('Kopyalama başarısız.', false);
                        }
                    });
                };
            })(table);

            container.appendChild(btn);
            ins.parent.insertBefore(container, ins.before);
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
        setTimeout(processSayimTables, 300);
        setTimeout(processSayimTables, 1200);
        setTimeout(processSayimTables, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
