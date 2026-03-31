'use strict';

const BASE = 'https://warehouse-panel-api-gateway.getirapi.com';
const DELAY_MS = 350;

function getCookieHeader(cookies) {
  if (!cookies || !cookies.length) return '';
  return cookies.map(c => c.name + '=' + c.value).join('; ');
}

function getProductsFromDetailOrder(order) {
  const prods = order && order.products;
  if (!Array.isArray(prods)) return [];
  return prods.map(p => {
    const name = (p.name && (p.name.tr || p.name.en || '')) || '';
    return { name: String(name).trim() || '-', barcode: '' };
  }).filter(p => p.name !== '-');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'FETCH_ORDERS' || !msg.warehouseId) {
    sendResponse({ error: 'warehouseId yok' });
    return true;
  }

  const tabId = sender.tab && sender.tab.id;
  const warehouseId = msg.warehouseId;
  const extraHeaders = msg.headers || {};

  function sendResultToTab(dataOrError, isError = false) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'GWS_FETCH_ORDERS_RESULT',
        data: isError ? [] : dataOrError,
        error: isError ? dataOrError : undefined
      }).catch(() => {});
    }
  }

  chrome.cookies.getAll({ url: BASE }, (cookies) => {
    const cookieStr = getCookieHeader(cookies);
    const headers = {
      'Accept': 'application/json',
      ...extraHeaders
    };
    if (cookieStr) headers['Cookie'] = cookieStr;

    const listUrl = `${BASE}/warehouse/${warehouseId}/orders`;
    fetch(listUrl, { method: 'GET', headers })
      .then(r => {
        if (!r.ok) {
          return r.text().then(t => {
            throw new Error('HTTP ' + r.status + (t ? ': ' + t.slice(0, 80) : ''));
          });
        }
        return r.json();
      })
      .then(listRes => {
        const orders = listRes.data && listRes.data.orders;
        if (!Array.isArray(orders) || orders.length === 0) {
          if (tabId) chrome.tabs.sendMessage(tabId, { type: 'GWS_FETCH_ORDERS_RESULT', data: [] });
          sendResponse({ ok: true });
          return;
        }

        const results = [];
        let done = 0;
        const total = orders.length;

        function sendProgress() {
          if (tabId) chrome.tabs.sendMessage(tabId, { type: 'GWS_FETCH_PROGRESS', current: done, total }).catch(() => {});
        }

        function next(i) {
          if (i >= total) {
            if (tabId) chrome.tabs.sendMessage(tabId, { type: 'GWS_FETCH_ORDERS_RESULT', data: results }).catch(() => {});
            sendResponse({ ok: true });
            return;
          }
          const order = orders[i];
          const detailUrl = `${BASE}/warehouse/${warehouseId}/orders/${order.id}?domainType=1`;
          fetch(detailUrl, { method: 'GET', headers })
            .then(r => r.json())
            .then(detailRes => {
              const o = detailRes.data && detailRes.data.order;
              if (o) {
                const products = getProductsFromDetailOrder(o);
                results.push({
                  orderId: o.id,
                  orderLabel: (o.clientName || '') + ' - ' + (o.id ? o.id.slice(-4) : ''),
                  products
                });
              }
              done++;
              sendProgress();
              setTimeout(() => next(i + 1), DELAY_MS);
            })
            .catch(() => {
              done++;
              sendProgress();
              setTimeout(() => next(i + 1), DELAY_MS);
            });
        }
        next(0);
      })
      .catch(err => {
        const msg = (err && err.message) || 'İstek başarısız';
        sendResultToTab(msg, true);
        sendResponse({ error: msg });
      });
  });

  return true;
});
