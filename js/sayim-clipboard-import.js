/**
 * Kontrol paneli → Sayım sayfası pano köprüsü.
 * Eklenti: BARCODE_SAYIM_V1 + JSON kopyalar; burada çözülür (HTML yedek).
 */
(function () {
    'use strict';

    var CLIP_HEADER = 'BARCODE_SAYIM_V1';

    function trimInner(s) {
        return (s || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * @param {string} text - Pano metni
     * @returns {{ ok: boolean, items?: Array<{barcode?: string, name?: string, barcodes?: string[], quantity?: number}>, error?: string }}
     */
    function parseClipboardText(text) {
        if (typeof text !== 'string' || !text.length) {
            return { ok: false, error: 'Pano boş.' };
        }
        var t = text.replace(/^\uFEFF/, '').trim();
        if (t.indexOf(CLIP_HEADER) === 0) {
            var rest = t.slice(CLIP_HEADER.length).trim();
            if (rest.charAt(0) === '\n') rest = rest.slice(1).trim();
            var data = null;
            try {
                data = JSON.parse(rest);
            } catch (e1) {
                var s = rest.indexOf('{');
                var e = rest.lastIndexOf('}');
                if (s >= 0 && e > s) {
                    try {
                        data = JSON.parse(rest.slice(s, e + 1));
                    } catch (e2) {
                        return { ok: false, error: 'JSON okunamadı.' };
                    }
                } else {
                    return { ok: false, error: 'JSON okunamadı.' };
                }
            }
            var items = data.items || data;
            if (!Array.isArray(items)) {
                return { ok: false, error: 'JSON içinde items dizisi yok.' };
            }
            return { ok: true, items: normalizeItems(items) };
        }
        if (t.indexOf('<table') !== -1 || t.indexOf('ant-table') !== -1) {
            return parseHtmlFragment(t);
        }
        return {
            ok: false,
            error: 'Tanınmayan format. Önce eklentiden «Sayım listesini kopyala» kullanın veya geçerli JSON yapıştırın.',
        };
    }

    function normalizeItems(items) {
        return items.map(function (raw) {
            if (!raw || typeof raw !== 'object') return { name: '', barcode: '' };
            var name = trimInner(raw.name || raw.productName || '');
            var barcode = trimInner(raw.barcode || raw.primaryBarcode || '');
            var barcodes = raw.barcodes;
            if (!Array.isArray(barcodes) && barcode) {
                barcodes = [barcode];
            }
            if (Array.isArray(barcodes)) {
                barcodes = barcodes.map(function (b) {
                    return String(b).trim();
                }).filter(Boolean);
            }
            if (!barcode && barcodes && barcodes.length) {
                barcode = barcodes[0];
            }
            var q = raw.quantity;
            var hasQty = q !== undefined && q !== null && q !== '';
            var quantity;
            if (hasQty) {
                quantity = Number(q);
                if (!Number.isFinite(quantity)) hasQty = false;
            }
            return {
                name: name,
                barcode: barcode,
                barcodes: barcodes && barcodes.length ? barcodes : undefined,
                quantity: hasQty ? quantity : undefined,
            };
        });
    }

    /**
     * @param {string} html
     */
    function parseHtmlFragment(html) {
        try {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var tables = doc.querySelectorAll('table');
            for (var i = 0; i < tables.length; i++) {
                var table = tables[i];
                var thead = table.querySelector('thead tr');
                if (!thead) continue;
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
                if (nameIdx < 0 || barcodeIdx < 0) continue;
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
                if (items.length) {
                    return { ok: true, items: items };
                }
            }
            return { ok: false, error: 'Tabloda «Ürün Adı» / «Barkod» sütunları bulunamadı.' };
        } catch (e) {
            return { ok: false, error: 'HTML çözümlenemedi.' };
        }
    }

    window.SayimClipboardImport = {
        CLIP_HEADER: CLIP_HEADER,
        parseClipboardText: parseClipboardText,
    };
})();
