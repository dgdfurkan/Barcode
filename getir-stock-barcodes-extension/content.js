(function () {
  'use strict';

  const HOST = 'franchise.getir.com';
  const API_MARK = 'franchise-api-gateway.getirapi.com';

  if ((window.location.hostname || '') !== HOST) return;

  let lastBarcodeCsv = '';
  let lastCount = 0;
  let copyButtonInserted = false;

  function normalizeBarcodeEntry(b) {
    if (b == null) return '';
    if (typeof b === 'object') {
      return String(b.code || b.barcode || b.value || '').trim();
    }
    return String(b).trim();
  }

  /** packagingInfo anahtarları: önce "1" (perakende), pickingType atlanır. */
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

  /** Her ürün satırı için tek barkod (çoğulda ilk). */
  function firstBarcodeFromProduct(p) {
    if (!p || typeof p !== 'object') return '';

    if (p.packagingInfo && typeof p.packagingInfo === 'object') {
      const keys = sortedPackagingKeys(p.packagingInfo);
      for (let i = 0; i < keys.length; i++) {
        const pkg = p.packagingInfo[keys[i]];
        if (pkg.barcodes.length) {
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

  function extractRows(payload) {
    if (payload == null) return [];
    if (Array.isArray(payload)) return payload;

    const tryKeys = ['products', 'items', 'stocks', 'data', 'result', 'body'];
    for (let i = 0; i < tryKeys.length; i++) {
      const key = tryKeys[i];
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
      const keys = Object.keys(payload);
      for (let i = 0; i < keys.length; i++) {
        const v = payload[keys[i]];
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
      return firstBarcodeFromProduct(row.product);
    }

    return '';
  }

  function isStocksInventoryUrl(url) {
    const u = String(url);
    if (!u.includes(API_MARK) || u.includes('stock-movements')) return false;
    try {
      const path = new URL(u).pathname.replace(/\/$/, '') || '';
      return path === '/stocks';
    } catch (_) {
      return /\/stocks(\?|#|$)/.test(u);
    }
  }

  function ingestStocksPayload(json) {
    if (!json || typeof json !== 'object') return;

    const rows = extractRows(json);
    if (!rows.length) return;

    const codes = [];
    for (let i = 0; i < rows.length; i++) {
      const code = barcodeFromRow(rows[i]);
      if (code) codes.push(code);
    }

    if (!codes.length) return;

    lastBarcodeCsv = codes.join(', ');
    lastCount = codes.length;
    syncButtonState();
  }

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function handleMaybeApiResponse(url, text) {
    if (!url || typeof url !== 'string') return;
    if (!isStocksInventoryUrl(url)) return;

    const json = safeParse(text);
    if (json) ingestStocksPayload(json);
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        fallbackCopyText(text);
      });
    }
    fallbackCopyText(text);
    return Promise.resolve();
  }

  function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-10000px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  }

  function syncButtonState() {
    const btn = document.getElementById('getir-stock-barcodes-copy-btn');
    if (!btn) return;
    btn.disabled = !lastBarcodeCsv;
    btn.title = lastBarcodeCsv
      ? lastCount + ' barkod (stocks API) — tıkla, panoya kopyala'
      : 'Stok listesi yüklenince dolar (POST /stocks)';
  }

  function insertCopyButton() {
    if (copyButtonInserted) return;
    const anchor =
      document.getElementById('BRING_BUTTON') ||
      document.querySelector('[class^="flexContainer-"] button.ant-btn-primary');
    if (!anchor || !anchor.parentNode) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'getir-stock-barcodes-copy-btn';
    btn.textContent = 'Barkodları kopyala';
    btn.setAttribute('aria-label', 'Listedeki barkodları virgülle panoya kopyala');

    Object.assign(btn.style, {
      marginLeft: '8px',
      fontSize: '12px',
      lineHeight: '1.2',
      padding: '4px 10px',
      opacity: '0.72',
      cursor: 'pointer',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.04)',
      color: 'inherit',
      verticalAlign: 'middle'
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!lastBarcodeCsv) return;
      const label = btn.textContent;
      copyTextToClipboard(lastBarcodeCsv).then(function () {
        btn.textContent = 'Kopyalandı';
        setTimeout(function () {
          btn.textContent = label;
        }, 1600);
      });
    });

    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    copyButtonInserted = true;
    syncButtonState();
  }

  function watchForAnchor() {
    insertCopyButton();
    if (copyButtonInserted) return;

    const obs = new MutationObserver(function () {
      insertCopyButton();
      if (copyButtonInserted) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () {
      obs.disconnect();
    }, 90000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchForAnchor);
  } else {
    watchForAnchor();
  }

  const origFetch = window.fetch;
  window.fetch = function () {
    const out = origFetch.apply(this, arguments);
    let url = '';
    try {
      const input = arguments[0];
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
