(function () {
  'use strict';

  const HOST = 'franchise.getir.com';
  const API_MARK = 'franchise-api-gateway.getirapi.com';

  if ((window.location.hostname || '') !== HOST) return;

  let lastBarcodeCsv = '';
  let lastCount = 0;
  let copyButtonInserted = false;
  /** Service Worker’da localStorage yok; bu bayrak sadece content script içinde / klavye ile. */
  let debugSession = false;

  function isDebug() {
    if (debugSession) return true;
    try {
      if (window.localStorage && window.localStorage.getItem('getirBarcodeDebug') === '1') return true;
    } catch (_) {}
    return false;
  }

  function dbg() {
    if (!isDebug()) return;
    try {
      console.log.apply(console, ['[Getir Barkodlar]'].concat([].slice.call(arguments)));
    } catch (_) {}
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#222;color:#fff;padding:10px 14px;border-radius:8px;font:13px system-ui;max-width:320px;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2800);
  }

  document.addEventListener(
    'keydown',
    function (ev) {
      if (ev.altKey && ev.shiftKey && (ev.key === 'b' || ev.key === 'B')) {
        ev.preventDefault();
        debugSession = !debugSession;
        toast(debugSession ? 'Debug: AÇIK (konsol)' : 'Debug: KAPALI');
        dbg('debugSession =', debugSession);
      }
    },
    true
  );

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
    dbg('stocks yanıtı işlendi:', lastCount, 'barkod, örnek:', lastBarcodeCsv.slice(0, 80));
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
    if (!isStocksInventoryUrl(url)) {
      if (isDebug() && url.indexOf('stock') !== -1) {
        dbg('stocks eşleşmedi (path kontrol):', url.slice(0, 160));
      }
      return;
    }

    dbg('stocks yanıtı parse ediliyor:', url);
    const json = safeParse(text);
    if (json) ingestStocksPayload(json);
  }

  function syncCopyExecCommandNoReadonly(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
    return ok;
  }

  function showManualCopyModal(text) {
    var old = document.getElementById('getir-barcode-fallback-modal');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'getir-barcode-fallback-modal';
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;';
    var box = document.createElement('div');
    box.style.cssText =
      'background:#fff;color:#111;border-radius:10px;max-width:92vw;width:560px;box-shadow:0 8px 32px rgba(0,0,0,.25);padding:16px;font:14px system-ui,sans-serif;';
    var p = document.createElement('p');
    p.style.margin = '0 0 10px';
    p.innerHTML =
      'Otomatik pano engellendi. Metin seçili — <b>Cmd+C</b> (Mac) veya <b>Ctrl+C</b> (Windows) ile kopyala.';
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'width:100%;height:140px;font-size:12px;box-sizing:border-box;padding:8px;margin:0 0 12px;';
    var row = document.createElement('div');
    row.style.textAlign = 'right';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Kapat';
    closeBtn.style.cssText = 'padding:8px 18px;cursor:pointer;border-radius:6px;border:1px solid #ccc;background:#f5f5f5;';
    closeBtn.onclick = function () {
      wrap.remove();
    };
    row.appendChild(closeBtn);
    box.appendChild(p);
    box.appendChild(ta);
    box.appendChild(row);
    wrap.appendChild(box);
    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) wrap.remove();
    });
    document.body.appendChild(wrap);
    setTimeout(function () {
      ta.focus();
      ta.select();
    }, 0);
  }

  function syncButtonState() {
    const btn = document.getElementById('getir-stock-barcodes-copy-btn');
    const st = document.getElementById('getir-stock-barcodes-status');
    if (btn) {
      btn.style.opacity = lastBarcodeCsv ? '0.9' : '0.45';
      btn.title = lastBarcodeCsv
        ? lastCount + ' barkod — tıkla (veya otomatik olmazsa açılan kutudan Cmd+C)'
        : 'Önce POST /stocks yanıtı gerekli';
    }
    if (st) {
      st.textContent = lastBarcodeCsv ? lastCount + ' barkod hazır' : '';
    }
  }

  function insertCopyButton() {
    if (copyButtonInserted) return;
    const anchor =
      document.getElementById('BRING_BUTTON') ||
      document.querySelector('[class^="flexContainer-"] button.ant-btn-primary');
    if (!anchor || !anchor.parentNode) return;

    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;vertical-align:middle;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'getir-stock-barcodes-copy-btn';
    btn.textContent = 'Barkodları kopyala';
    btn.setAttribute('aria-label', 'Listedeki barkodları virgülle panoya kopyala');

    const status = document.createElement('span');
    status.id = 'getir-stock-barcodes-status';
    status.style.cssText = 'font-size:11px;opacity:.65;white-space:nowrap;';

    Object.assign(btn.style, {
      fontSize: '12px',
      lineHeight: '1.2',
      padding: '4px 10px',
      cursor: 'pointer',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.04)',
      color: 'inherit',
      verticalAlign: 'middle'
    });

    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!lastBarcodeCsv) {
        window.alert(
          'Henüz barkod yakalanmadı.\n\n' +
            '• Ağ sekmesinde POST …/stocks isteğini kontrol et.\n' +
            '• Debug log için franchise sekmesinde Alt+Shift+B (konsola bak).\n\n' +
            'Not: Eklenti Service Worker konsolunda localStorage çalışmaz; komutu franchise.getir.com sekmesinin konsolunda çalıştır.'
        );
        return;
      }

      const label = btn.textContent;
      var text = lastBarcodeCsv;

      try {
        if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          dbg('navigator.clipboard.writeText OK');
          btn.textContent = 'Kopyalandı';
          toast('Panoya kopyalandı');
          setTimeout(function () {
            btn.textContent = label;
          }, 1600);
          return;
        }
      } catch (err) {
        dbg('clipboard.writeText hata:', err);
      }

      if (syncCopyExecCommandNoReadonly(text)) {
        dbg('execCommand (content script) OK');
        btn.textContent = 'Kopyalandı';
        toast('Panoya kopyalandı');
        setTimeout(function () {
          btn.textContent = label;
        }, 1600);
        return;
      }

      dbg('otomatik kopya yok — manuel kutu');
      toast('Aşağıdaki kutudan Cmd+C / Ctrl+C');
      showManualCopyModal(text);
    });

    wrap.appendChild(btn);
    wrap.appendChild(status);
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
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

  function resolveFetchUrl(input) {
    try {
      if (typeof input === 'string') {
        return input.indexOf('http') === 0 ? input : new URL(input, window.location.href).href;
      }
      if (input && typeof input.url === 'string') {
        return input.url.indexOf('http') === 0 ? input.url : new URL(input.url, window.location.href).href;
      }
    } catch (_) {}
    return '';
  }

  function resolveXhrUrl(url) {
    if (typeof url !== 'string') return '';
    return url.indexOf('http') === 0 ? url : new URL(url, window.location.href).href;
  }

  const origFetch = window.fetch;
  window.fetch = function () {
    const out = origFetch.apply(this, arguments);
    var url = '';
    try {
      url = resolveFetchUrl(arguments[0]);
    } catch (_) {
      url = '';
    }

    if (!url || url.indexOf(API_MARK) === -1) return out;

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
      reqUrl = resolveXhrUrl(typeof url === 'string' ? url : '');
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
