// Warehouse SKT (get-expiring-products) — warehouse sekmesinden token ile çeker

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function resolveCallerTabs(sender) {
  if (sender?.tab?.id) return [sender.tab];
  try {
    return await chrome.tabs.query({
      url: [
        'http://localhost/*',
        'http://127.0.0.1/*',
        'https://jetbarkod.com.tr/*',
        'https://www.jetbarkod.com.tr/*'
      ]
    });
  } catch (e) {
    return [];
  }
}

async function postMessageToTabMainWorld(tabId, payload) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (data) => {
        window.postMessage(data, '*');
      },
      args: [payload]
    });
  } catch (e) {
    /* content bridge veya izin yok */
  }
}

function sendExpiryProgress(callerTabs, message) {
  const payload = { type: 'WAREHOUSE_EXPIRY_PROGRESS', message };
  for (const tab of callerTabs) {
    chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
    void postMessageToTabMainWorld(tab.id, payload);
  }
}

function sendExpiryResponse(callerTabs, payload) {
  const msg = { type: 'WAREHOUSE_EXPIRY_RESPONSE', ...payload };
  for (const tab of callerTabs) {
    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    void postMessageToTabMainWorld(tab.id, msg);
  }
}

async function findWarehouseTab() {
  let warehouseTabs = await chrome.tabs.query({ url: 'https://warehouse.getir.com/*' });
  if (warehouseTabs?.length) return warehouseTabs[0];
  const allTabs = await chrome.tabs.query({});
  warehouseTabs = (allTabs || []).filter((t) => {
    const u = (t.url || '').toLowerCase();
    return u.includes('warehouse') && u.includes('getir');
  });
  return warehouseTabs?.[0] || null;
}

async function fetchExpiryBatchInWarehouseTab(tabId, warehouseId, endDateStr, productIds) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [warehouseId, endDateStr, productIds],
    func: async function (warehouseIdParam, endDateStrParam, productIdsParam) {
      function formatTrDate(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) {
          const raw = String(iso || '').split('T')[0];
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [y, m, day] = raw.split('-');
            return `${day}.${m}.${y}`;
          }
          return raw;
        }
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
      }

      function findWarehouseToken() {
        const stores = [localStorage, sessionStorage];
        for (const store of stores) {
          for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            const value = store.getItem(key);
            if (value && value.startsWith('eyJ') && value.length > 500) {
              const lowerKey = (key || '').toLowerCase();
              if (lowerKey.includes('access') || lowerKey.includes('token') || value.length > 800) {
                return value;
              }
            }
          }
        }
        let best = null;
        for (const store of stores) {
          for (let i = 0; i < store.length; i++) {
            const value = store.getItem(store.key(i));
            if (value && value.startsWith('eyJ') && value.length > 500) {
              if (!best || value.length > best.length) best = value;
            }
          }
        }
        return best;
      }

      function buildDateRange(endDateStr) {
        const tzOffsetHours = 3;
        const now = new Date();
        const localNow = new Date(now.getTime() + tzOffsetHours * 3600000);
        const localStart = new Date(
          Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 0, 0, 0, 0)
        );
        const startDate = new Date(localStart.getTime() - tzOffsetHours * 3600000);
        const endParts = String(endDateStr || '2030-07-31').split('-');
        const localEnd = new Date(
          Date.UTC(+endParts[0], +endParts[1] - 1, +endParts[2], 23, 59, 59, 999)
        );
        const endDate = new Date(localEnd.getTime() - tzOffsetHours * 3600000);
        return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
      }

      function parseItems(json, requestedIds) {
        const byProductId = {};
        requestedIds.forEach((id) => {
          byProductId[id] = [];
        });

        let items = [];
        if (json?.data?.items && Array.isArray(json.data.items)) items = json.data.items;
        else if (json?.data && Array.isArray(json.data)) items = json.data;
        else if (Array.isArray(json)) items = json;

        for (const item of items) {
          const pid =
            item.productId ||
            item.product_id ||
            item.product?.id ||
            item.product?._id ||
            (requestedIds.length === 1 ? requestedIds[0] : null);
          if (!pid || !requestedIds.includes(String(pid))) continue;
          const exp = item.expiryDate || item.expirationDate;
          const removeRaw = item.removeFromSaleDate || item.removeFromSaleDateTime;
          const count = Number(item.count ?? item.quantity ?? 0);
          if (!exp || !count) continue;
          const dateStr = formatTrDate(exp);
          const removeDateStr = removeRaw ? formatTrDate(removeRaw) : null;
          const sid = String(pid);
          if (!byProductId[sid]) byProductId[sid] = [];
          const existing = byProductId[sid].find((e) => e.date === dateStr && e.removeDate === removeDateStr);
          if (existing) existing.qty += count;
          else byProductId[sid].push({ date: dateStr, qty: count, removeDate: removeDateStr });
        }

        Object.keys(byProductId).forEach((pid) => {
          byProductId[pid].sort((a, b) => {
            const [da, ma, ya] = a.date.split('.').map(Number);
            const [db, mb, yb] = b.date.split('.').map(Number);
            return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
          });
        });
        return byProductId;
      }

      try {
        const token = findWarehouseToken();
        if (!token) {
          return {
            success: false,
            error: 'Warehouse oturumu bulunamadı. warehouse.getir.com sekmesini bir kez yenileyin.'
          };
        }

        const pathMatch = window.location.pathname.match(/\/r\/([a-f0-9]{24})\//i);
        const whId = pathMatch ? pathMatch[1] : warehouseIdParam;
        const range = buildDateRange(endDateStrParam);
        const url = `https://warehouse-panel-api-gateway.getirapi.com/warehouse/${whId}/get-expiring-products`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            Authorization: `Bearer ${token}`,
            Origin: 'https://warehouse.getir.com',
            Referer: `https://warehouse.getir.com/r/${whId}/stock/stock-management/product/expiration/list`,
            'x-requester-client': 'warehouse-panel-frontend',
            language: 'tr',
            countryCode: 'TR'
          },
          body: JSON.stringify({
            removeFromSaleDateRange: {
              startDate: range.startDate,
              endDate: range.endDate
            },
            productIds: productIdsParam
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return {
            success: false,
            error: `SKT API HTTP ${response.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`
          };
        }

        const json = await response.json();
        return { success: true, byProductId: parseItems(json, productIdsParam.map(String)) };
      } catch (error) {
        return { success: false, error: error.message || 'SKT isteği başarısız' };
      }
    }
  });

  if (!results?.[0]?.result) {
    return { success: false, error: 'Warehouse sekmesinde SKT script çalıştırılamadı' };
  }
  return results[0].result;
}

export async function handleFetchExpiryProducts(message, sendResponse, sender = null) {
  sendResponse({ success: true, message: 'SKT çekimi başlatıldı' });

  const productIds = Array.isArray(message.productIds)
    ? [...new Set(message.productIds.map(String).filter(Boolean))]
    : [];
  // Sabit depo kimliği kaldırıldı. Bilinmeyen depoya istek atmak hem yanlış
  // veri getirir hem Getir tarafında açıklanamaz trafik olur.
  const warehouseId = message.warehouseId || null;
  const endDate = message.endDate || '2030-07-31';
  const batchSize = Math.min(Math.max(Number(message.batchSize) || 12, 1), 30);
  const callerTabs = await resolveCallerTabs(sender);

  if (!warehouseId) {
    sendExpiryResponse(callerTabs, {
      success: false,
      error: 'Depo bilgisi yok. Franchise stok sayfasını bir kez aç, depo kimliği oradan yakalanıyor.',
      byProductId: {}
    });
    return;
  }

  if (!productIds.length) {
    sendExpiryResponse(callerTabs, { success: false, error: 'Ürün listesi boş', byProductId: {} });
    return;
  }

  try {
    sendExpiryProgress(callerTabs, '🔍 Warehouse sekmesi aranıyor…');
    const tab = await findWarehouseTab();
    if (!tab) {
      sendExpiryResponse(callerTabs, {
        success: false,
        error: 'warehouse.getir.com sekmesi açık değil. SKT sayfasını aynı tarayıcıda açık tutun.',
        byProductId: {}
      });
      return;
    }

    const batches = chunkArray(productIds, batchSize);
    const merged = {};
    productIds.forEach((id) => {
      merged[id] = [];
    });

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      sendExpiryProgress(
        callerTabs,
        `📅 SKT alınıyor… ${Math.min((i + 1) * batchSize, productIds.length)}/${productIds.length} ürün`
      );

      const batchResult = await fetchExpiryBatchInWarehouseTab(tab.id, warehouseId, endDate, batch);
      if (!batchResult.success) {
        sendExpiryResponse(callerTabs, {
          success: false,
          error: batchResult.error || 'SKT alınamadı',
          byProductId: merged
        });
        return;
      }

      Object.entries(batchResult.byProductId || {}).forEach(([pid, entries]) => {
        if (!merged[pid]) merged[pid] = [];
        (entries || []).forEach((entry) => {
          const existing = merged[pid].find((e) => e.date === entry.date);
          if (existing) existing.qty += entry.qty;
          else merged[pid].push({ ...entry });
        });
        merged[pid].sort((a, b) => {
          const [da, ma, ya] = a.date.split('.').map(Number);
          const [db, mb, yb] = b.date.split('.').map(Number);
          return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
        });
      });

      if (i < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    const withData = Object.values(merged).filter((arr) => arr.length > 0).length;
    sendExpiryProgress(callerTabs, `✅ ${withData}/${productIds.length} ürün için SKT bulundu`);
    sendExpiryResponse(callerTabs, {
      success: true,
      byProductId: merged,
      total: productIds.length,
      withData
    });
  } catch (error) {
    sendExpiryResponse(callerTabs, {
      success: false,
      error: error.message || 'SKT çekimi başarısız',
      byProductId: {}
    });
  }
}
