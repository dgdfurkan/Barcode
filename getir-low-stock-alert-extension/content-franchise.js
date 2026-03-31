// Franchise sayfasında çalışır.
// Bearer token: Sayfanın yaptığı fetch ve XMLHttpRequest isteklerini izleyerek
// Authorization header'ından alınır (birçok SPA XHR kullanır).
(function () {
  if (window.location.hostname !== 'franchise.getir.com') return;

  let token = null;
  let lastMovementsBody = null;
  const MOVEMENTS_BASE = 'https://franchise-api-gateway.getirapi.com/stocks/stock-movements';
  const DEFAULT_WAREHOUSE_ID = '5dcafe6ae2c61b1e52cf1704'; // Göksu Park - şimdilik sabit, istenirse ayarlara alınabilir.
  const MAX_PAGES = 3;
  const PAGE_DELAY_MS = 2000;

  function buildDefaultMovementsBody() {
    try {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      return JSON.stringify({
        warehouseIds: [DEFAULT_WAREHOUSE_ID],
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });
    } catch (_) {
      return JSON.stringify({});
    }
  }

  function captureToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return;
    token = authHeader;
    try {
      chrome.runtime.sendMessage({ type: 'TOKEN_FROM_FRANCHISE', token: authHeader }).catch(() => {});
    } catch (_) {}
  }

  function captureTokenFromRequest(url, headers) {
    if (!url || !url.includes('getirapi.com')) return;
    const auth = headers && (headers.Authorization || headers.authorization);
    if (auth) captureToken(auth);
  }

  const origFetch = window.fetch;
  window.fetch = function (url, opts) {
    const u = typeof url === 'string' ? url : (url && url.url);
    const headers = (opts && opts.headers) || (url && url.headers);
    if (headers && headers.get) {
      const auth = headers.get('Authorization') || headers.get('authorization');
      if (auth) captureTokenFromRequest(u, { Authorization: auth });
    } else if (headers && (headers.Authorization || headers.authorization)) {
      captureTokenFromRequest(u, headers);
    }
    try {
      const method = (opts && opts.method ? String(opts.method) : 'GET').toUpperCase();
      if (u && typeof u === 'string' && u.includes('/stocks/stock-movements') && method === 'POST') {
        let bodyStr = null;
        if (opts && Object.prototype.hasOwnProperty.call(opts, 'body')) {
          const b = opts.body;
          if (typeof b === 'string') bodyStr = b;
          else if (b && typeof b === 'object') {
            try { bodyStr = JSON.stringify(b); } catch (_) {}
          }
        }
        if (bodyStr) lastMovementsBody = bodyStr;
      }
    } catch (_) {}
    return origFetch.apply(this, arguments);
  };

  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    let currentUrl = '';
    let currentMethod = 'GET';
    const origOpen = xhr.open;
    xhr.open = function (method, url) {
      currentMethod = (method || 'GET').toString().toUpperCase();
      currentUrl = typeof url === 'string' ? url : '';
      return origOpen.apply(this, arguments);
    };
    const origSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function (name, value) {
      if (currentUrl.includes('getirapi.com') && (name === 'Authorization' || name === 'authorization') && value) {
        captureToken(value);
      }
      return origSetRequestHeader.apply(this, arguments);
    };
    const origSend = xhr.send;
    xhr.send = function (body) {
      try {
        if (currentUrl.includes('/stocks/stock-movements') && currentMethod === 'POST') {
          let bodyStr = null;
          if (typeof body === 'string') bodyStr = body;
          else if (body && typeof body === 'object') {
            try { bodyStr = JSON.stringify(body); } catch (_) {}
          }
          if (bodyStr) lastMovementsBody = bodyStr;
        }
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
    return xhr;
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type !== 'FETCH_MOVEMENTS_FOR_POLL') return;
    const maxPages = typeof msg.maxPages === 'number' ? msg.maxPages : MAX_PAGES;
    const effectiveToken = (typeof msg.manualToken === 'string' && msg.manualToken.trim()) ? msg.manualToken.trim() : token;
    (async function () {
      if (!effectiveToken) return { error: 'TOKEN_NOT_CAPTURED' };
      const bodyToUse = msg.bodyTemplate || lastMovementsBody || buildDefaultMovementsBody();
      try {
        const allData = [];
        let offset = 0;
        let hasNext = true;
        let pages = 0;
        while (hasNext && pages < maxPages) {
          const url = MOVEMENTS_BASE + '?limit=100&offset=' + offset;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': effectiveToken
            },
            body: bodyToUse
          });
          const text = await res.text();
          if (!res.ok) {
            const detail = text && text.length > 0 ? (text.length > 300 ? text.slice(0, 300) + '...' : text) : undefined;
            return { error: 'API ' + res.status, errorDetail: detail };
          }
          let json;
          try {
            json = JSON.parse(text);
          } catch (_) {
            return { error: 'API yanıtı geçersiz' };
          }
          const list = json.data || [];
          allData.push(...list);
          hasNext = json.hasNext === true;
          offset += 100;
          pages++;
          if (hasNext && pages < maxPages) await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
        }
        return { data: allData };
      } catch (e) {
        return { error: 'İstek hatası: ' + (e && e.message ? e.message : 'Bilinmeyen') };
      }
    })().then(sendResponse).catch((e) => {
      try { sendResponse({ error: 'İstek hatası: ' + (e && e.message ? e.message : 'Bilinmeyen') }); } catch (_) {}
    });
    return true;
  });
})();
