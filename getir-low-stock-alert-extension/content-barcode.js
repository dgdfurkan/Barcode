// Barkod sitesinde çalışır: sayfadan LOW_STOCK_INIT alır, background'a iletir; listeyi sayfaya postMessage ile gönderir; MARK_DONE iletir. Listeyi yenile = REQUEST_LOW_STOCK_REFRESH (anında son 100 hareket).
(function () {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'LOW_STOCK_LIST_UPDATE') {
      window.postMessage({ type: 'LOW_STOCK_LIST_UPDATE', list: msg.list || [], username: msg.username }, '*');
    }
  });

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.type === 'LOW_STOCK_INIT' && e.data.payload) {
      chrome.runtime.sendMessage({ type: 'LOW_STOCK_INIT', payload: e.data.payload }, (response) => {
        if (response && response.username !== undefined) {
          window.postMessage({ type: 'LOW_STOCK_LIST_UPDATE', list: response.list || [], username: response.username }, '*');
        }
      });
    }
    if (e.data.type === 'REQUEST_LOW_STOCK_REFRESH' && e.data.username) {
      chrome.runtime.sendMessage({
        type: 'REQUEST_LOW_STOCK_REFRESH',
        username: e.data.username,
        payload: e.data.payload || null
      }, (response) => {
        if (response && response.error) {
          window.postMessage({ type: 'LOW_STOCK_REFRESH_RESULT', error: response.error, username: e.data.username }, '*');
        } else if (response && response.ok && response.list) {
          window.postMessage({ type: 'LOW_STOCK_REFRESH_RESULT', list: response.list, username: e.data.username }, '*');
        } else {
          window.postMessage({ type: 'LOW_STOCK_REFRESH_RESULT', error: 'Yanıt alınamadı', username: e.data.username }, '*');
        }
      });
    }
    if (e.data.type === 'CLEAR_LOW_STOCK' && e.data.username) {
      chrome.runtime.sendMessage({ type: 'CLEAR_LOW_STOCK', username: e.data.username }, (response) => {
        if (response && response.error) {
          window.postMessage({ type: 'LOW_STOCK_CLEAR_RESULT', ok: false, error: response.error, username: e.data.username }, '*');
        } else {
          window.postMessage({ type: 'LOW_STOCK_CLEAR_RESULT', ok: true, username: e.data.username }, '*');
        }
      });
    }
    if (e.data.type === 'SAVE_MANUAL_TOKEN' && e.data.username !== undefined) {
      chrome.runtime.sendMessage({ type: 'SAVE_MANUAL_TOKEN', username: e.data.username, token: e.data.token }, (response) => {
        window.postMessage({
          type: 'MANUAL_TOKEN_SAVED',
          ok: !!response && response.ok,
          expiry: response && response.expiry
        }, '*');
      });
    }
    if (e.data.type === 'GET_MANUAL_TOKEN_STATUS' && e.data.username) {
      chrome.runtime.sendMessage({ type: 'GET_MANUAL_TOKEN_STATUS', username: e.data.username }, (response) => {
        window.postMessage({
          type: 'MANUAL_TOKEN_STATUS',
          hasToken: !!(response && response.hasToken),
          expiry: response && response.expiry
        }, '*');
      });
    }
    if (e.data.type === 'LOW_STOCK_MARK_DONE' && e.data.productId) {
      const username = (window.authUtils && window.authUtils.checkAuth && window.authUtils.checkAuth())?.username;
      if (username) {
        chrome.runtime.sendMessage({ type: 'MARK_DONE', username, productId: e.data.productId }, () => {});
      }
    }
  });
})();
