/* global chrome */
(function () {
  'use strict';

  const HOST = 'franchise.getir.com';
  const API_MARK = 'franchise-api-gateway.getirapi.com';

  if ((window.location.hostname || '') !== HOST) return;

  function persist(csv, count) {
    try {
      chrome.storage.local.set({
        getirBarcodeCsv: csv,
        getirBarcodeCount: count,
        getirBarcodeUpdated: Date.now()
      });
    } catch (_) {}
  }

  function normalizeBarcodeEntry(b) {
    if (b == null) return '';
    if (typeof b === 'object') {
      return String(b.code || b.barcode || b.value || '').trim();
    }
    return String(b).trim();
  }

  /** İlk barkodu döndürür (packagingInfo > barcodes sırası). */
  function firstBarcodeFromProduct(p) {
    if (!p || typeof p !== 'object') return '';

    if (p.packagingInfo && typeof p.packagingInfo === 'object') {
      for (const k of Object.keys(p.packagingInfo)) {
        const pkg = p.packagingInfo[k];
        if (pkg && Array.isArray(pkg.barcodes) && pkg.barcodes.length) {
          const c = normalizeBarcodeEntry(pkg.barcodes[0]);
          if (c) return c;
        }
      }
    }

    if (Array.isArray(p.barcodes) && p.barcodes.length) {
      return normalizeBarcodeEntry(p.barcodes[0]);
    }

    return '';
  }

  /** API gövdesinden ürün benzeri satırları çıkarır. */
  function extractRows(payload) {
    if (payload == null) return [];
    if (Array.isArray(payload)) return payload;

    const tryKeys = ['products', 'items', 'stocks', 'data', 'result', 'body'];
    for (const key of tryKeys) {
      if (payload[key] != null) {
        const inner = extractRows(payload[key]);
        if (inner.length) return inner;
      }
    }

    if (payload.data && typeof payload.data === 'object') {
      const inner = extractRows(payload.data);
      if (inner.length) return inner;
    }

    if (typeof payload === 'object') {
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
          const sample = v[0];
          if (
            sample.barcodes !== undefined ||
            sample.packagingInfo !== undefined ||
            sample.product !== undefined ||
            sample.fullName !== undefined ||
            sample.name !== undefined
          ) {
            return v;
          }
        }
      }
    }

    return [];
  }

  function barcodeFromRow(row) {
    if (!row || typeof row !== 'object') return '';

    const direct = firstBarcodeFromProduct(row);
    if (direct) return direct;

    if (row.product && typeof row.product === 'object') {
      const fromNested = firstBarcodeFromProduct(row.product);
      if (fromNested) return fromNested;
    }

    return '';
  }

  function ingestPayload(json) {
    if (!json || typeof json !== 'object') return;

    const rows = extractRows(json);
    if (!rows.length) return;

    const codes = [];
    for (const row of rows) {
      const code = barcodeFromRow(row);
      if (code) codes.push(code);
    }

    if (!codes.length) return;

    const csv = codes.join(', ');
    persist(csv, codes.length);
  }

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function shouldParseFranchiseInventoryUrl(url) {
    const u = String(url);
    if (!u.includes(API_MARK) || u.includes('stock-movements')) return false;
    if (u.includes('/products')) return true;
    try {
      const p = new URL(u);
      return p.pathname === '/stocks';
    } catch (_) {
      return /\/stocks(\?|$)/.test(u);
    }
  }

  function handleMaybeApiResponse(url, text) {
    if (!url || typeof url !== 'string') return;
    if (!shouldParseFranchiseInventoryUrl(url)) return;

    const json = safeParse(text);
    if (json) ingestPayload(json);
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const out = origFetch.apply(this, arguments);
    let url = '';
    try {
      url = typeof input === 'string' ? input : input && input.url;
    } catch (_) {
      url = '';
    }

    if (!url || !url.includes(API_MARK)) return out;

    return out.then(function (res) {
      try {
        res
          .clone()
          .text()
          .then(function (text) {
            handleMaybeApiResponse(url, text);
          });
      } catch (_) {}
      return res;
    });
  };

  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    let reqUrl = '';
    const oOpen = xhr.open;
    xhr.open = function (method, url) {
      reqUrl = typeof url === 'string' ? url : '';
      return oOpen.apply(this, arguments);
    };
    const oSend = xhr.send;
    xhr.send = function () {
      xhr.addEventListener('load', function () {
        try {
          if (xhr.responseType && xhr.responseType !== '' && xhr.responseType !== 'text') return;
          const t = xhr.responseText;
          if (t && reqUrl) handleMaybeApiResponse(reqUrl, t);
        } catch (_) {}
      });
      return oSend.apply(this, arguments);
    };
    return xhr;
  };
})();
