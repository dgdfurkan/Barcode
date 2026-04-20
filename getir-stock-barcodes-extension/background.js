/* global chrome */
(function () {
  'use strict';

  const STOCKS_HOST = 'franchise-api-gateway.getirapi.com';

  function normalizeBarcodeEntry(b) {
    if (b == null) return '';
    if (typeof b === 'object') {
      return String(b.code || b.barcode || b.value || '').trim();
    }
    return String(b).trim();
  }

  function sortedPackagingKeys(packagingInfo) {
    const keys = Object.keys(packagingInfo).filter(function (k) {
      if (k === 'pickingType') return false;
      const pkg = packagingInfo[k];
      return pkg && typeof pkg === 'object' && Array.isArray(pkg.barcodes);
    });
    keys.sort(function (a, b) {
      if (a === '1') return -1;
      if (b === '1') return 1;
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
    return keys;
  }

  function firstBarcodeFromRow(p) {
    if (!p || typeof p !== 'object') return '';

    if (p.packagingInfo && typeof p.packagingInfo === 'object') {
      const keys = sortedPackagingKeys(p.packagingInfo);
      for (let i = 0; i < keys.length; i++) {
        const pkg = p.packagingInfo[keys[i]];
        if (pkg.barcodes && pkg.barcodes.length) {
          const c = normalizeBarcodeEntry(pkg.barcodes[0]);
          if (c) return c;
        }
      }
    }

    if (Array.isArray(p.barcodes) && p.barcodes.length) {
      return normalizeBarcodeEntry(p.barcodes[0]);
    }

    if (p.product && typeof p.product === 'object') {
      return firstBarcodeFromRow(p.product);
    }

    return '';
  }

  function barcodesFromResponseJson(json) {
    const rows = json && json.data && Array.isArray(json.data) ? json.data : [];
    const codes = [];
    for (let i = 0; i < rows.length; i++) {
      const c = firstBarcodeFromRow(rows[i]);
      if (c) codes.push(c);
    }
    return codes;
  }

  function normalizeAuth(auth) {
    if (!auth || typeof auth !== 'string') return '';
    const t = auth.trim();
    if (t.toLowerCase().indexOf('bearer ') === 0) return t;
    return 'Bearer ' + t;
  }

  /**
   * POST /stocks — sayfadaki ile aynı gövde ve token; tüm sayfalar (offset) döner.
   */
  async function fetchAllBarcodes(authorization, bodyString, stocksUrl) {
    const auth = normalizeAuth(authorization);
    if (!auth) {
      throw new Error('Authorization yok. Sayfayı yenileyip stok listesinin yüklenmesini bekle.');
    }

    const defaultUrl = 'https://' + STOCKS_HOST + '/stocks?limit=100&offset=0';
    let baseUrl = stocksUrl && String(stocksUrl).trim() ? String(stocksUrl).trim() : defaultUrl;

    let parsed;
    try {
      parsed = new URL(baseUrl.indexOf('http') === 0 ? baseUrl : 'https://' + STOCKS_HOST + baseUrl);
    } catch (_) {
      parsed = new URL(defaultUrl);
    }

    if (parsed.hostname.indexOf(STOCKS_HOST) === -1) {
      parsed = new URL(defaultUrl);
    }

    const limit = Math.min(Math.max(parseInt(parsed.searchParams.get('limit') || '100', 10) || 100, 1), 500);
    let offset = Math.max(parseInt(parsed.searchParams.get('offset') || '0', 10) || 0, 0);

    const body =
      bodyString && typeof bodyString === 'string' && bodyString.trim()
        ? bodyString.trim()
        : '{}';

    const allCodes = [];
    let guard = 0;

    while (guard < 200) {
      guard++;
      parsed.searchParams.set('limit', String(limit));
      parsed.searchParams.set('offset', String(offset));

      const res = await fetch(parsed.href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: auth
        },
        body: body
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' — ' + text.slice(0, 240));
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error('JSON parse hatası');
      }

      const batch = barcodesFromResponseJson(json);
      for (let i = 0; i < batch.length; i++) allCodes.push(batch[i]);

      const rows = json.data && Array.isArray(json.data) ? json.data.length : 0;
      if (typeof json.total === 'number') {
        total = json.total;
      }

      if (rows === 0) break;
      if (rows < limit) break;
      if (typeof json.total === 'number' && offset + rows >= json.total) break;

      offset += limit;
    }

    return {
      csv: allCodes.join(', '),
      count: allCodes.length
    };
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== 'GET_STOCK_BARCODES') {
      return;
    }

    fetchAllBarcodes(msg.authorization, msg.body, msg.url)
      .then(function (r) {
        sendResponse({ ok: true, csv: r.csv, count: r.count });
      })
      .catch(function (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
      });

    return true;
  });
})();
