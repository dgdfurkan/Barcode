(function () {
  'use strict';

  const HOST = 'franchise.getir.com';
  const API_MARK = 'franchise-api-gateway.getirapi.com';

  if ((window.location.hostname || '') !== HOST) return;

  let lastAuthorization = '';
  let lastStocksUrl = '';
  let lastStocksBody = '';
  let copyButtonInserted = false;
  let debugSession = false;

  function dbg() {
    if (!debugSession) {
      try {
        if (window.localStorage && window.localStorage.getItem('getirBarcodeDebug') === '1') {
          /* ok */
        } else return;
      } catch (_) {
        return;
      }
    }
    try {
      console.log.apply(console, ['[Getir Barkodlar]'].concat([].slice.call(arguments)));
    } catch (_) {}
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#222;color:#fff;padding:10px 14px;border-radius:8px;font:13px system-ui;max-width:340px;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 3200);
  }

  document.addEventListener(
    'keydown',
    function (ev) {
      if (ev.altKey && ev.shiftKey && (ev.key === 'b' || ev.key === 'B')) {
        ev.preventDefault();
        debugSession = !debugSession;
        toast(debugSession ? 'Debug açık' : 'Debug kapalı');
      }
    },
    true
  );

  function isStocksPost(url, method) {
    if (!url || String(url).indexOf(API_MARK) === -1) return false;
    if (String(url).indexOf('stock-movements') !== -1) return false;
    const m = (method || 'GET').toUpperCase();
    if (m !== 'POST') return false;
    try {
      const p = new URL(url.indexOf('http') === 0 ? url : new URL(url, 'https://franchise.getir.com').href);
      return (p.pathname || '').replace(/\/$/, '') === '/stocks';
    } catch (_) {
      return /\/stocks(\?|#|$)/.test(url);
    }
  }

  function readFetchHeaders(h) {
    if (!h) return '';
    if (typeof h.get === 'function') {
      return h.get('Authorization') || h.get('authorization') || '';
    }
    const o = h;
    return o.Authorization || o.authorization || '';
  }

  function serializeBody(body) {
    if (body == null) return '';
    if (typeof body === 'string') return body;
    if (typeof body === 'object' && typeof Blob !== 'undefined' && body instanceof Blob) {
      return '';
    }
    try {
      return JSON.stringify(body);
    } catch (_) {
      return '';
    }
  }

  function captureFromFetch(url, method, init) {
    if (!isStocksPost(url, method)) return;
    const auth = readFetchHeaders(init && init.headers);
    if (auth) lastAuthorization = auth;
    lastStocksUrl = url;
    const b = init && Object.prototype.hasOwnProperty.call(init, 'body') ? serializeBody(init.body) : '';
    if (b) lastStocksBody = b;
    dbg('Yakalandı: POST /stocks', url.slice(-80), 'bodyLen', (lastStocksBody || '').length);
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

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = '';
    var method = 'GET';
    var headers = null;
    var body;

    if (typeof input === 'string') {
      url = resolveFetchUrl(input);
      method = ((init && init.method) || 'GET').toUpperCase();
      headers = init && init.headers;
      body = init && init.body;
    } else if (input && typeof input === 'object' && input.url) {
      url = resolveFetchUrl(input.url);
      method = ((init && init.method) || input.method || 'GET').toUpperCase();
      headers = (init && init.headers) || input.headers;
      body = init && Object.prototype.hasOwnProperty.call(init, 'body') ? init.body : input.body;
    } else {
      url = resolveFetchUrl(input);
      method = ((init && init.method) || 'GET').toUpperCase();
      headers = init && init.headers;
      body = init && init.body;
    }

    captureFromFetch(url, method, { headers: headers, body: body });
    return origFetch.apply(this, arguments);
  };

  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    let reqUrl = '';
    let reqMethod = 'GET';
    const hdr = {};

    const oOpen = xhr.open;
    xhr.open = function (method, url) {
      reqMethod = (method || 'GET').toUpperCase();
      reqUrl = typeof url === 'string' ? resolveXhrUrl(url) : '';
      return oOpen.apply(this, arguments);
    };

    const oSet = xhr.setRequestHeader;
    xhr.setRequestHeader = function (name, value) {
      try {
        hdr[String(name).toLowerCase()] = value;
      } catch (_) {}
      return oSet.apply(this, arguments);
    };

    const oSend = xhr.send;
    xhr.send = function (body) {
      if (isStocksPost(reqUrl, reqMethod)) {
        const a = hdr.authorization || hdr.Authorization;
        if (a) lastAuthorization = a;
        lastStocksUrl = reqUrl;
        if (body != null) {
          if (typeof body === 'string') lastStocksBody = body;
          else lastStocksBody = serializeBody(body);
        }
        dbg('Yakalandı (XHR): POST /stocks');
      }
      return oSend.apply(this, arguments);
    };

    return xhr;
  };

  function resolveXhrUrl(url) {
    if (typeof url !== 'string') return '';
    return url.indexOf('http') === 0 ? url : new URL(url, window.location.href).href;
  }

  function showResultModal(text, title) {
    var old = document.getElementById('getir-barcode-result-modal');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'getir-barcode-result-modal';
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;';
    var box = document.createElement('div');
    box.style.cssText =
      'background:#fff;color:#111;border-radius:10px;max-width:94vw;width:580px;box-shadow:0 8px 32px rgba(0,0,0,.25);padding:16px;font:14px system-ui,sans-serif;';
    var p = document.createElement('p');
    p.style.margin = '0 0 8px';
    p.textContent = title || 'Barkodlar (virgülle). Cmd+C / Ctrl+C ile kopyala.';
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'width:100%;height:160px;font-size:12px;box-sizing:border-box;padding:8px;margin:0 0 12px;';
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

  function syncCopyExec(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
    return ok;
  }

  function syncButtonState() {
    const btn = document.getElementById('getir-stock-barcodes-copy-btn');
    const st = document.getElementById('getir-stock-barcodes-status');
    if (btn) {
      btn.style.opacity = lastAuthorization ? '0.95' : '0.5';
      btn.title = lastAuthorization
        ? 'API’den barkodları çek (token hazır)'
        : 'Önce sayfada stok yüklensin (POST /stocks ile token yakala)';
    }
    if (st) {
      st.textContent = lastAuthorization ? 'Token hazır' : 'Token bekleniyor…';
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
    const status = document.createElement('span');
    status.id = 'getir-stock-barcodes-status';
    status.style.cssText = 'font-size:11px;opacity:.7;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    Object.assign(btn.style, {
      fontSize: '12px',
      lineHeight: '1.2',
      padding: '4px 10px',
      cursor: 'pointer',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.04)',
      color: 'inherit'
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      const payload = {
        type: 'GET_STOCK_BARCODES',
        authorization: lastAuthorization,
        body: lastStocksBody || '{}',
        url:
          lastStocksUrl ||
          'https://franchise-api-gateway.getirapi.com/stocks?limit=100&offset=0'
      };

      dbg('Gönderiliyor:', { hasAuth: !!payload.authorization, url: payload.url, bodyLen: payload.body.length });

      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = 'Yükleniyor…';

      try {
        chrome.runtime.sendMessage(payload, function (res) {
          btn.disabled = false;
          btn.textContent = oldText;

          if (chrome.runtime.lastError) {
            toast('Eklenti hatası: ' + chrome.runtime.lastError.message);
            showResultModal('', 'Hata: ' + chrome.runtime.lastError.message);
            return;
          }

          if (!res || !res.ok) {
            const err = (res && res.error) || 'Bilinmeyen hata';
            toast(err);
            showResultModal('', err);
            return;
          }

          const csv = res.csv || '';
          const c = typeof res.count === 'number' ? res.count : 0;
          toast(c + ' barkod alındı');

          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(csv).then(
              function () {
                btn.textContent = 'Kopyalandı';
                setTimeout(function () {
                  btn.textContent = oldText;
                }, 1500);
              },
              function () {
                if (syncCopyExec(csv)) {
                  btn.textContent = 'Kopyalandı';
                  setTimeout(function () {
                    btn.textContent = oldText;
                  }, 1500);
                } else {
                  showResultModal(csv, c + ' barkod — otomatik pano olmadı, aşağıdan kopyala:');
                }
              }
            );
          } else if (syncCopyExec(csv)) {
            btn.textContent = 'Kopyalandı';
            setTimeout(function () {
              btn.textContent = oldText;
            }, 1500);
          } else {
            showResultModal(csv, c + ' barkod:');
          }
        });
      } catch (err) {
        btn.disabled = false;
        btn.textContent = oldText;
        toast(String(err));
      }
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
})();
