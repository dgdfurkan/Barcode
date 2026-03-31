(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var BASE = 'https://warehouse-panel-api-gateway.getirapi.com';
  var DELAY_MS = 350;
  var capturedListInit = null;

  function isListUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.indexOf('getirapi.com') === -1) return false;
    if (url.indexOf('/orders') === -1) return false;
    return !url.match(/\/orders\/[a-f0-9]+(\?|$)/);
  }

  function deepCloneInit(init) {
    if (!init) return { credentials: 'include', method: 'GET' };
    var o = {};
    if (init.method) o.method = init.method;
    if (init.mode !== undefined) o.mode = init.mode;
    if (init.credentials !== undefined) o.credentials = init.credentials;
    if (init.cache !== undefined) o.cache = init.cache;
    if (init.headers) {
      o.headers = {};
      if (init.headers instanceof Headers) {
        init.headers.forEach(function (v, k) { o.headers[k] = v; });
      } else if (typeof init.headers === 'object') {
        for (var k in init.headers) if (init.headers.hasOwnProperty(k)) o.headers[k] = init.headers[k];
      }
    }
    return o;
  }

  function captureListInit(input, init) {
    if (!isListUrl(typeof input === 'string' ? input : (input && input.url))) return;
    try {
      capturedListInit = deepCloneInit(init);
      if (!capturedListInit.headers) capturedListInit.headers = {};
      if (!capturedListInit.method) capturedListInit.method = 'GET';
      if (capturedListInit.credentials === undefined) capturedListInit.credentials = 'include';
    } catch (e) {}
  }

  function getFetchOpts() {
    if (capturedListInit) return deepCloneInit(capturedListInit);
    return { credentials: 'include', method: 'GET' };
  }

  function getProductsFromDetailOrder(order) {
    var prods = order && order.products;
    if (!Array.isArray(prods)) return [];
    return prods.map(function (p) {
      var name = (p.name && (p.name.tr || p.name.en || '')) || '';
      return { name: String(name).trim() || '-', barcode: '' };
    }).filter(function (p) { return p.name !== '-'; });
  }

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      captureListInit(url, init);
      return origFetch.apply(this, arguments).then(function (res) {
        if (url.indexOf('order') !== -1 || url.indexOf('Order') !== -1) {
          try {
            var c = res.clone();
            c.json().then(function (data) {
              document.dispatchEvent(new CustomEvent('gws-order-api', { detail: { url: url, data: data } }));
            }).catch(function () {});
          } catch (e) {}
        }
        return res;
      });
    };
  }

  var origXHR = window.XMLHttpRequest;
  if (origXHR) {
    window.XMLHttpRequest = function () {
      var xhr = new origXHR();
      var origOpen = xhr.open;
      xhr.open = function (method, url) {
        if (url && isListUrl(url)) {
          try {
            capturedListInit = capturedListInit || { method: method, headers: {} };
            capturedListInit.method = method;
            if (!capturedListInit.headers) capturedListInit.headers = {};
            var origSetRequestHeader = xhr.setRequestHeader;
            xhr.setRequestHeader = function (k, v) {
              capturedListInit.headers[k] = v;
              return origSetRequestHeader.apply(this, arguments);
            };
          } catch (e) {}
        }
        return origOpen.apply(this, arguments);
      };
      return xhr;
    };
  }

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'GWS_FETCH_ORDERS') return;
    var wh = e.data.warehouseId;
    if (!wh) {
      window.postMessage({ type: 'GWS_FETCH_ORDERS_RESULT', error: 'warehouseId yok' }, '*');
      return;
    }
    var listUrl = BASE + '/warehouse/' + wh + '/orders';
    var opts = getFetchOpts();
    origFetch(listUrl, opts)
      .then(function (r) { return r.json(); })
      .then(function (listRes) {
        var orders = listRes.data && listRes.data.orders;
        if (!Array.isArray(orders) || orders.length === 0) {
          window.postMessage({ type: 'GWS_FETCH_ORDERS_RESULT', data: [] }, '*');
          return;
        }
        var done = 0;
        var total = orders.length;
        var results = [];
        function sendProgress() {
          window.postMessage({ type: 'GWS_FETCH_PROGRESS', current: done, total: total }, '*');
        }
        function next(i) {
          if (i >= total) {
            window.postMessage({ type: 'GWS_FETCH_ORDERS_RESULT', data: results }, '*');
            return;
          }
          var order = orders[i];
          var detailUrl = BASE + '/warehouse/' + wh + '/orders/' + order.id + '?domainType=1';
          origFetch(detailUrl, getFetchOpts())
            .then(function (r) { return r.json(); })
            .then(function (detailRes) {
              var o = detailRes.data && detailRes.data.order;
              if (o) {
                var products = getProductsFromDetailOrder(o);
                results.push({
                  orderId: o.id,
                  orderLabel: (o.clientName || '') + ' - ' + (o.id ? o.id.slice(-4) : ''),
                  products: products
                });
              }
              done++;
              sendProgress();
              setTimeout(function () { next(i + 1); }, DELAY_MS);
            })
            .catch(function (err) {
              done++;
              sendProgress();
              setTimeout(function () { next(i + 1); }, DELAY_MS);
            });
        }
        next(0);
      })
      .catch(function (err) {
        window.postMessage({ type: 'GWS_FETCH_ORDERS_RESULT', error: err && err.message, data: [] }, '*');
      });
  });
})();
