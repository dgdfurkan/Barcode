/**
 * Getir Depo — Sayım listesi (kontrol paneli tablosu) için yapılandırılmış pano kopyası.
 * BARCODE_SAYIM_V1 + JSON — sayım sayfasında «Panodan İçe Aktar» ile işlenir.
 */
(function () {
    'use strict';

    var CLIP_HEADER = 'BARCODE_SAYIM_V1';

    function trimInner(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
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

    function findSayimTables() {
        var out = [];
        var tables = document.querySelectorAll('table');
        for (var i = 0; i < tables.length; i++) {
            var table = tables[i];
            var thead = table.querySelector('thead tr');
            if (!thead) continue;
            var ths = thead.querySelectorAll('th');
            var headers = [];
            for (var h = 0; h < ths.length; h++) {
                headers.push(trimInner(ths[h].textContent));
            }
            var hasName = headers.some(function (x) { return x.indexOf('Ürün Adı') !== -1; });
            var hasBc = headers.some(function (x) { return x.indexOf('Barkod') !== -1; });
            if (hasName && hasBc) out.push(table);
        }
        return out;
    }

    function extractItems(table) {
        var thead = table.querySelector('thead tr');
        if (!thead) return [];
        var ths = thead.querySelectorAll('th');
        var headers = [];
        for (var h = 0; h < ths.length; h++) {
            headers.push(trimInner(ths[h].textContent));
        }
        var nameIdx = -1;
        var barcodeIdx = -1;
        for (var j = 0; j < headers.length; j++) {
            if (headers[j].indexOf('Ürün Adı') !== -1) nameIdx = j;
            if (headers[j].indexOf('Barkod') !== -1) barcodeIdx = j;
        }
        if (nameIdx < 0 || barcodeIdx < 0) return [];
        var items = [];
        var rows = table.querySelectorAll('tbody tr.ant-table-row');
        for (var r = 0; r < rows.length; r++) {
            var tr = rows[r];
            if (tr.classList.contains('ant-table-measure-row')) continue;
            var tds = tr.querySelectorAll('td');
            if (!tds.length) continue;
            var name = tds[nameIdx] ? trimInner(tds[nameIdx].textContent) : '';
            var bcCell = tds[barcodeIdx];
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

    function showToast(msg, ok) {
        var el = document.createElement('div');
        el.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:2147483647;padding:12px 16px;border-radius:8px;font-size:14px;max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,.15);' +
            (ok ? 'background:#059669;color:#fff;' : 'background:#b91c1c;color:#fff;');
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function () {
            el.remove();
        }, 3500);
    }

    var injected = new WeakSet();

    function injectForTable(table) {
        if (injected.has(table)) return;
        var wrapper =
            table.closest('.ant-table-wrapper') ||
            table.closest('.ant-spin-container') ||
            table.parentElement;
        if (!wrapper || !wrapper.parentElement) return;
        if (wrapper.parentElement.querySelector('.getir-sayim-copy-banner')) return;

        var banner = document.createElement('div');
        banner.className = 'getir-sayim-copy-banner';
        banner.style.cssText =
            'display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '📋 Sayım Listesini Kopyala';
        btn.style.cssText =
            'padding:8px 14px;font-size:13px;font-weight:600;border:1px solid #4f46e5;background:#eef2ff;color:#3730a3;border-radius:8px;cursor:pointer;';
        btn.onmouseover = function () {
            btn.style.background = '#4f46e5';
            btn.style.color = '#fff';
        };
        btn.onmouseout = function () {
            btn.style.background = '#eef2ff';
            btn.style.color = '#3730a3';
        };
        btn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            var items = extractItems(table);
            if (!items.length) {
                showToast('Tabloda ürün satırı bulunamadı.', false);
                return;
            }
            var payload = buildPayload(items);
            copyToClipboard(payload).then(function (ok) {
                if (ok) {
                    showToast(items.length + ' ürün panoya kopyalandı. Sayım sayfasında «Panodan İçe Aktar» kullanın.', true);
                } else {
                    showToast('Kopyalama başarısız.', false);
                }
            });
        };

        banner.appendChild(btn);
        wrapper.parentElement.insertBefore(banner, wrapper);
        injected.add(table);
    }

    function scan() {
        var tables = findSayimTables();
        for (var i = 0; i < tables.length; i++) {
            injectForTable(tables[i]);
        }
    }

    function init() {
        scan();
        var obs = new MutationObserver(function () {
            scan();
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
