(function () {
  'use strict';

  if (!window.location.pathname.includes('/dashboard/orders')) return;

  const CARD_SELECTOR = '.orderCard--LDG_w';
  const MODAL_BODY_SELECTOR = '.ant-modal-body';
  const MODAL_CLOSE_SELECTOR = '.ant-modal-close, [aria-label="Kapat"]';
  const WAIT_FOR_PRODUCTS_MS = 6000;
  const POLL_INTERVAL_MS = 120;
  const AFTER_CLOSE_DELAY_MS = 500;
  const API_RESPONSE_WAIT_MS = 5000;

  /** Sayfa bağlamında API ile sipariş listesi + detayları al (postMessage -> inject-page). */
  function fetchOrdersViaApi(warehouseId, onProgress) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Zaman aşımı')), 120000);
      const handler = (e) => {
        if (e.source !== window || !e.data) return;
        if (e.data.type === 'GWS_FETCH_PROGRESS' && onProgress) {
          onProgress(e.data.current, e.data.total);
        }
        if (e.data.type === 'GWS_FETCH_ORDERS_RESULT') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          if (e.data.error) return reject(new Error(e.data.error));
          resolve(e.data.data || []);
        }
      };
      window.addEventListener('message', handler);
      window.postMessage({ type: 'GWS_FETCH_ORDERS', warehouseId }, '*');
    });
  }

  /** URL'den warehouse id çıkar: /r/5dcafe6ae2c61b1e52cf1704/dashboard/orders -> 5dcafe6ae2c61b1e52cf1704 */
  function getWarehouseIdFromUrl() {
    const m = window.location.pathname.match(/\/r\/([a-f0-9]+)\//);
    return m ? m[1] : null;
  }

  /** API yanıtından ürün listesi çıkar (detay API: data.order.products[].name.tr). */
  function extractProductsFromApiData(data) {
    if (!data || typeof data !== 'object') return [];
    const items =
      data.data?.order?.products ??
      data.data?.order?.items ??
      data.data?.items ??
      data.order?.items ??
      data.items ??
      data.products ??
      data.data?.products ??
      (Array.isArray(data.data) ? data.data : []);
    if (!Array.isArray(items)) return [];
    return items.map((it) => {
      const nameObj = it.name;
      const name = typeof nameObj === 'string' ? nameObj : (nameObj && (nameObj.tr || nameObj.en || '')) || it.productName || it.title || '';
      const barcode = it.barcode ?? it.ean ?? it.ean13 ?? it.code ?? '';
      return { name: String(name || '').trim() || '-', barcode: String(barcode || '').trim() };
    }).filter((p) => p.name !== '-' || p.barcode);
  }

  function isProductRow(tr) {
    if (!tr || tr.nodeType !== 1) return false;
    if (tr.closest('.ant-descriptions')) return false;
    if (tr.classList.contains('ant-descriptions-row')) return false;
    if (tr.closest('.ant-descriptions-view')) return false;
    const cells = tr.querySelectorAll('td');
    const cellTexts = Array.from(cells).map(c => (c.textContent || '').trim()).join(' ').toLowerCase();
    const skipPatterns = ['müşteri adı', 'müşteri notu', 'teslimat adresi', 'adres açıklaması', 'toplayıcı adı', 'kurye adı', 'poşet kullanımı', 'durum', 'lokasyonlar', 'müşteri', 'kurye', 'toplayıcı', 'adres', 'teslimat', 'notu'];
    for (const p of skipPatterns) {
      if (cellTexts.includes(p)) return false;
    }
    const hasImage = tr.querySelector('img[src*="product"], img[src*="getir"], img[src*="cdn-image"]') || tr.querySelector('.ant-image img');
    if (!hasImage) return false;
    const hasName = Array.from(cells).some(c => {
      const t = (c.textContent || '').trim();
      return t.length > 2 && !/^\d+$/.test(t);
    });
    return hasName;
  }

  function getProductsFromModalBody(body) {
    const products = [];
    const tables = body.querySelectorAll('table');
    for (const table of tables) {
      if (table.closest('.ant-descriptions')) continue;
      const rows = table.querySelectorAll('tbody tr');
      for (const tr of rows) {
        if (!isProductRow(tr)) continue;
        const cells = tr.querySelectorAll('td');
        let name = '';
        let barcode = '';
        for (const cell of cells) {
          const text = (cell.textContent || '').trim();
          if (text.length > 2 && !/^\d{8,}$/.test(text)) name = name || text;
          if (/^\d{8,14}$/.test(text)) barcode = barcode || text;
        }
        if (name || barcode) products.push({ name: name || barcode || '-', barcode });
      }
    }
    return products;
  }

  function getModalBody() {
    const modal = document.querySelector('.ant-modal-wrap .ant-modal');
    if (!modal) return null;
    return modal.querySelector(MODAL_BODY_SELECTOR);
  }

  function hasProductRowsInBody(body) {
    if (!body) return false;
    const tables = body.querySelectorAll('table');
    for (const table of tables) {
      if (table.closest('.ant-descriptions')) continue;
      const rows = table.querySelectorAll('tbody tr');
      for (const tr of rows) {
        if (isProductRow(tr)) return true;
      }
    }
    return false;
  }

  /** Modal açıldıktan sonra ürün tablosu gerçekten yüklenene kadar bekler. */
  function waitForProductTableInModal() {
    return new Promise((resolve) => {
      const body = getModalBody();
      if (body && hasProductRowsInBody(body)) {
        resolve(body);
        return;
      }
      const start = Date.now();
      const iv = setInterval(() => {
        const b = getModalBody();
        if (b && hasProductRowsInBody(b)) {
          clearInterval(iv);
          resolve(b);
          return;
        }
        if (Date.now() - start >= WAIT_FOR_PRODUCTS_MS) {
          clearInterval(iv);
          resolve(getModalBody());
        }
      }, POLL_INTERVAL_MS);
    });
  }

  function closeModal() {
    const closeBtn = document.querySelector(MODAL_CLOSE_SELECTOR);
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    const wrap = document.querySelector('.ant-modal-wrap');
    if (wrap) {
      const closeIcon = wrap.querySelector('.ant-modal-close');
      if (closeIcon) closeIcon.click();
      else wrap.click();
      return true;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    return false;
  }

  function getOrderCards() {
    return Array.from(document.querySelectorAll(CARD_SELECTOR));
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function injectUI() {
    const breadcrumb = document.querySelector('nav.ant-breadcrumb') || document.querySelector('[class*="breadcrumb"]');
    if (!breadcrumb) return null;

    const container = document.createElement('div');
    container.className = 'gws-order-search-root';
    container.id = 'gws-order-search-root';

    const wrap = document.createElement('div');
    wrap.className = 'gws-order-search-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Ürün veya barkod ara...';
    input.className = 'gws-order-search-input';
    input.autocomplete = 'off';

    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'gws-order-search-btn gws-order-search-btn--scan';
    searchBtn.textContent = 'Ara';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'gws-order-search-btn gws-order-search-btn--clear';
    clearBtn.textContent = 'Temizle';

    const status = document.createElement('span');
    status.className = 'gws-order-search-status';

    const resultsPanel = document.createElement('div');
    resultsPanel.className = 'gws-order-search-results';
    resultsPanel.hidden = true;
    resultsPanel.innerHTML = '<div class="gws-order-search-results--empty">Ürün adı veya barkod yazıp Ara\'ya basın.</div>';

    wrap.appendChild(input);
    wrap.appendChild(searchBtn);
    wrap.appendChild(clearBtn);
    container.appendChild(wrap);
    container.appendChild(status);

    const barWrap = document.createElement('div');
    barWrap.className = 'gws-order-search-bar-wrap';
    barWrap.appendChild(container);
    barWrap.appendChild(resultsPanel);

    const parent = breadcrumb.parentElement;
    if (parent) {
      const rowWrap = document.createElement('div');
      rowWrap.className = 'gws-order-search-row';
      parent.insertBefore(rowWrap, breadcrumb);
      rowWrap.appendChild(breadcrumb);
      rowWrap.appendChild(barWrap);
    } else {
      document.body.insertBefore(barWrap, document.body.firstChild);
    }

    function setStatus(text) {
      status.textContent = text;
    }

    function showResults(matches, fromApi) {
      resultsPanel.hidden = false;
      resultsPanel.innerHTML = '';

      if (!matches || matches.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'gws-order-search-results--empty';
        empty.textContent = 'Eşleşen sipariş bulunamadı.';
        resultsPanel.appendChild(empty);
        return;
      }

      const header = document.createElement('div');
      header.className = 'gws-order-search-results-header';
      header.textContent = `${matches.length} sipariş bulundu`;
      resultsPanel.appendChild(header);

      const list = document.createElement('div');
      list.className = 'gws-order-search-results-list';

      for (const m of matches) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gws-order-search-result-item';
        btn.innerHTML = `
          <div class="gws-order-search-result-order-id">${escapeHtml(m.orderLabel || m.orderId)}</div>
          <div class="gws-order-search-result-products">${escapeHtml((m.products || []).slice(0, 3).map(p => p.name).join(' · '))}${(m.products && m.products.length > 3) ? ' ...' : ''}</div>
        `;
        btn.dataset.orderId = m.orderId;
        btn.dataset.orderLabel = m.orderLabel || '';
        btn.addEventListener('click', () => {
          let card = null;
          if (fromApi && m.orderId) {
            const suffix = m.orderId.slice(-4);
            const cards = document.querySelectorAll(CARD_SELECTOR);
            for (const c of cards) {
              if ((c.textContent || '').includes(suffix) || (m.orderLabel && (c.textContent || '').includes(m.orderLabel.split(' - ')[0]))) {
                card = c;
                break;
              }
            }
          }
          if (!card) card = document.querySelector(`${CARD_SELECTOR}[data-testid="${m.orderId}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => card.click(), 300);
          }
        });
        list.appendChild(btn);
      }

      resultsPanel.appendChild(list);
    }

    searchBtn.addEventListener('click', runSearch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch();
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      resultsPanel.hidden = true;
      setStatus('');
    });

    async function runSearch() {
      const query = (input.value || '').trim();
      if (!query) {
        setStatus('Lütfen ürün adı veya barkod girin.');
        return;
      }

      const warehouseId = getWarehouseIdFromUrl();
      if (!warehouseId) {
        setStatus('Bu sayfada arama yapılamıyor (depo bilgisi bulunamadı).');
        return;
      }

      searchBtn.disabled = true;
      resultsPanel.hidden = true;
      setStatus('Siparişler API ile alınıyor...');

      try {
        const progressEl = document.createElement('div');
        progressEl.className = 'gws-order-search-progress';
        resultsPanel.innerHTML = '';
        resultsPanel.appendChild(progressEl);
        resultsPanel.hidden = false;

        const allOrders = await fetchOrdersViaApi(warehouseId, (current, total) => {
          progressEl.textContent = total ? `Siparişler alınıyor (${current}/${total})...` : 'Siparişler alınıyor...';
        });

        const lower = query.toLowerCase();
        const matches = (allOrders || []).filter((o) => {
          const products = o.products || [];
          return products.some(
            (p) =>
              (p.name && p.name.toLowerCase().includes(lower)) ||
              (p.barcode && String(p.barcode).includes(query))
          );
        });

        setStatus(matches.length ? `${matches.length} sipariş bulundu.` : 'Eşleşme yok.');
        showResults(matches, true);
      } catch (e) {
        const errMsg = (e && e.message) || 'Bilinmeyen hata';
        setStatus('Veri alınamadı.');
        resultsPanel.innerHTML =
          '<div class="gws-order-search-results--empty">' +
          'Siparişler alınamadı: ' + escapeHtml(errMsg) + '<br><small>Sayfayı yenileyip tekrar deneyin (sayfa yüklenirken istek kopyalanır).</small>' +
          '</div>';
        resultsPanel.hidden = false;
      }
      searchBtn.disabled = false;
    }

    async function runSearchByClickingCards(query, resultsPanel, progressElArg, setStatus, showResults) {
      const cards = getOrderCards();
      if (!cards.length) {
        setStatus('Sayfada sipariş kartı bulunamadı.');
        return;
      }

      searchBtn.disabled = true;
      const matches = [];
      const lower = query.toLowerCase();
      resultsPanel.hidden = false;
      resultsPanel.innerHTML = '<div class="gws-order-search-progress">Aranıyor...</div>';

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const orderId = card.getAttribute('data-testid') || card.getAttribute('data-cursor-element-id') || String(i);
        const orderLabel = (card.textContent || '').trim().slice(0, 80);
        const progressEl = progressElArg || resultsPanel.querySelector('.gws-order-search-progress');
        if (progressEl) progressEl.textContent = `Aranıyor (${i + 1}/${cards.length})...`;
        try {
          card.click();
          let products = [];
          const apiData = await waitForOrderApiResponse(API_RESPONSE_WAIT_MS);
          if (apiData && extractProductsFromApiData(apiData).length > 0) {
            products = extractProductsFromApiData(apiData);
          } else {
            const body = await waitForProductTableInModal();
            if (body) products = getProductsFromModalBody(body);
          }
          const hasMatch = products.some(p =>
            (p.name && p.name.toLowerCase().includes(lower)) ||
            (p.barcode && p.barcode.includes(query))
          );
          if (hasMatch) matches.push({ orderId, orderLabel, products });
        } catch (err) {
          console.warn('GWS Order Search: modal error', err);
        }
        closeModal();
        await new Promise((r) => setTimeout(r, AFTER_CLOSE_DELAY_MS));
      }

      searchBtn.disabled = false;
      setStatus(matches.length ? `${matches.length} sipariş bulundu.` : 'Eşleşme yok.');
      showResults(matches, false);
    }

    return container;
  }

  function init() {
    if (document.getElementById('gws-order-search-root')) return;
    if (!document.querySelector('nav.ant-breadcrumb') && !document.querySelector('[class*="breadcrumb"]')) {
      setTimeout(init, 500);
      return;
    }
    injectUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById('gws-order-search-root') && (document.querySelector('nav.ant-breadcrumb') || document.querySelector('[class*="breadcrumb"]'))) {
      init();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
