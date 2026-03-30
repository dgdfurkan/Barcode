/**
 * Getir Depo — Sayım tablosu: BARCODE_SAYIM_V1 + JSON pano.
 */
(function () {
    'use strict';

    var CLIP_HEADER = 'BARCODE_SAYIM_V1';

    function trimInner(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }

    function normHeader(s) {
        return trimInner(s).toLocaleLowerCase('tr-TR');
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

    /** thead içindeki tüm th metinleri (çok satırlı başlık için) */
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

    function findSayimTables() {
        var out = [];
        var tables = document.querySelectorAll('table');
        for (var i = 0; i < tables.length; i++) {
            if (isSayimTable(tables[i])) out.push(tables[i]);
        }
        return out;
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

    function showToast(msg, ok) {
        var el = document.createElement('div');
        el.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:2147483647;padding:12px 16px;border-radius:8px;font-size:14px;max-width:340px;box-shadow:0 4px 12px rgba(0,0,0,.15);' +
            (ok ? 'background:#059669;color:#fff;' : 'background:#b91c1c;color:#fff;');
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function () {
            el.remove();
        }, 3500);
    }

    var injectedTables = new WeakSet();

    function getTableToolbarHost(table) {
        var w = table.closest('.ant-table-wrapper');
        if (w) return w;
        var c = table.closest('.ant-table');
        if (c && c.parentElement) return c.parentElement;
        return table.parentElement;
    }

    function injectBannerForTable(table) {
        if (injectedTables.has(table)) return;
        var host = getTableToolbarHost(table);
        if (!host) return;

        if (host.querySelector('.getir-sayim-copy-banner')) {
            injectedTables.add(table);
            return;
        }

        var banner = document.createElement('div');
        banner.className = 'getir-sayim-copy-banner';
        banner.style.cssText =
            'display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:0 0 10px 0;padding:4px 0;flex-wrap:wrap;';

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
        host.insertBefore(banner, host.firstChild);
        injectedTables.add(table);
    }

    var floatingBtn = null;

    function ensureFloatingFallback() {
        if (floatingBtn && document.body.contains(floatingBtn)) return;
        var tables = findSayimTables();
        if (!tables.length) return;

        floatingBtn = document.createElement('button');
        floatingBtn.type = 'button';
        floatingBtn.className = 'getir-sayim-floating-btn';
        floatingBtn.textContent = '📋 Sayımı kopyala';
        floatingBtn.title = 'Sayım tablosunu panoya alır (üstteki buton görünmüyorsa bunu kullanın)';
        floatingBtn.style.cssText =
            'position:fixed;bottom:24px;right:24px;z-index:2147483646;padding:12px 16px;font-size:13px;font-weight:700;border:2px solid #4f46e5;background:#eef2ff;color:#312e81;border-radius:12px;cursor:pointer;box-shadow:0 4px 14px rgba(79,70,229,.35);';
        floatingBtn.onmouseover = function () {
            floatingBtn.style.background = '#4f46e5';
            floatingBtn.style.color = '#fff';
        };
        floatingBtn.onmouseout = function () {
            floatingBtn.style.background = '#eef2ff';
            floatingBtn.style.color = '#312e81';
        };
        floatingBtn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            var list = findSayimTables();
            if (!list.length) {
                showToast('Sayım tablosu bulunamadı.', false);
                return;
            }
            var items = extractItems(list[0]);
            if (!items.length) {
                showToast('Ürün satırı yok.', false);
                return;
            }
            copyToClipboard(buildPayload(items)).then(function (ok) {
                if (ok) {
                    showToast(items.length + ' ürün kopyalandı.', true);
                } else {
                    showToast('Kopyalama başarısız.', false);
                }
            });
        };
        document.body.appendChild(floatingBtn);
    }

    function removeFloatingFallback() {
        if (floatingBtn && floatingBtn.parentNode) {
            floatingBtn.parentNode.removeChild(floatingBtn);
        }
        floatingBtn = null;
    }

    function scan() {
        var tables = findSayimTables();
        if (!tables.length) {
            removeFloatingFallback();
            return;
        }
        for (var i = 0; i < tables.length; i++) {
            injectBannerForTable(tables[i]);
        }
        ensureFloatingFallback();
    }

    function init() {
        scan();
        setTimeout(scan, 500);
        setTimeout(scan, 2000);
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
