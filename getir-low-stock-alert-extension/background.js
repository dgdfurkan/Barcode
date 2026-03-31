// Getir Düşük Stok Uyarısı - Background
//
// TOKEN NASIL ALINIYOR?
// İstek biz background'dan token ile atılmıyor. Franchise.getir.com sekmesinde çalışan
// content-franchise.js, sayfanın kendi yaptığı fetch isteklerini (window.fetch override) izleyip
// Authorization: Bearer ... header'ını yakalar. Yani token, kullanıcı franchise sayfasında
// giriş yaptığında sayfanın kullandığı token. Stok hareketi isteği de aynı franchise sekmesinde
// (content script içinde) yapılıyor ve bu yakalanan token kullanılıyor. Yani istek token'sız
// atılmıyor; token franchise sekmesi açıkken sayfanın kendi isteklerinden alınıyor.
//
// MESAİ: Sadece 08:00 - 01:00 arası otomatik poll çalışır (barkod sayfası açık/kapalı fark etmez).
// Liste extension storage'da tutulur; Stoğu düşük sayfası açıldığında oradan okunur.
// Eşik ve özel eşikler barkod sayfasından (LOW_STOCK_INIT) alınır.

const MOVEMENTS_BASE = 'https://franchise-api-gateway.getirapi.com/stocks/stock-movements';
const POLL_INTERVAL_MINUTES = 1;
const MAX_PAGES_PER_POLL = 3;
const PAGE_DELAY_MS = 2000;
let movementsFetchInFlight = false;

// Mesai: 08:00 - 01:00 (gece yarısından 01:00'e kadar dahil)
function isWithinWorkHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 8 || hour < 1;
}

function getThresholdForProduct(productId, barcode, defaultThreshold, overrides) {
  if (overrides && overrides[productId] !== undefined) return overrides[productId];
  if (barcode && overrides && overrides[barcode] !== undefined) return overrides[barcode];
  return defaultThreshold;
}

// İstek dönüşündeki fullName kullanılır (gramaj/ml dahil tam isim).
function getProductDisplayName(product) {
  if (!product || typeof product !== 'object') return '';
  const fn = product.fullName;
  if (fn && typeof fn === 'object') {
    const name = fn.tr || fn.en || '';
    if (name) return name;
  }
  const sn = product.shortName;
  if (sn && typeof sn === 'object') return sn.tr || sn.en || '';
  const n = product.name;
  if (n && typeof n === 'object') return n.tr || n.en || '';
  return '';
}

// İstek dönüşündeki picURLs.tr'den ilk görsel linki alınır.
function getProductImageUrl(product) {
  if (!product || typeof product !== 'object') return '';
  const pics = product.picURLs;
  if (!pics || typeof pics !== 'object') return '';
  const tr = pics.tr;
  if (Array.isArray(tr) && tr.length) {
    const first = tr[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && first.picURL) {
      const p = first.picURL;
      return (typeof p === 'string' ? p : (p.tr || p.en || '')) || '';
    }
  }
  return '';
}

function getProductPriceInfo(product) {
  if (!product || typeof product !== 'object') return { price: null, priceText: '' };
  const price = typeof product.price === 'number' ? product.price : null;
  const priceText =
    (typeof product.priceText === 'string' && product.priceText) ||
    (price != null ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(price) : '');
  return { price, priceText };
}

function getMovementTimestamp(row) {
  if (!row || typeof row !== 'object') return { movementAt: null, movementTs: null };
  let movementAt =
    row.movementDate ||
    row.date ||
    row.createdAt ||
    row.updatedAt ||
    (row.meta && (row.meta.movementDate || row.meta.createdAt || row.meta.updatedAt)) ||
    null;
  if (movementAt && typeof movementAt === 'object' && movementAt.$date) {
    movementAt = movementAt.$date;
  }
  const movementTs = movementAt ? Date.parse(movementAt) || null : null;
  return { movementAt, movementTs };
}

function processMovementsToLowStockList(data, defaultThreshold, overrides) {
  const byProduct = new Map();
  for (const row of data) {
    const product = row.product;
    const productId = product && (product.id || product._id);
    const productStock = row.productStock;
    if (!productId || !productStock) continue;
    if (byProduct.has(productId)) continue;
    const available = productStock.available;
    if (typeof available !== 'number') continue;
    const name = getProductDisplayName(product);
    let barcode = '';
    try {
      const pi = product.packagingInfo && product.packagingInfo['1'];
      if (pi && pi.barcodes && pi.barcodes[0]) barcode = String(pi.barcodes[0]);
    } catch (_) {}
    const threshold = getThresholdForProduct(productId, barcode, defaultThreshold, overrides || {});
    if (available < threshold) {
      const { price, priceText } = getProductPriceInfo(product);
      const imageUrl = getProductImageUrl(product);
      const { movementAt, movementTs } = getMovementTimestamp(row);
      byProduct.set(productId, {
        productId,
        name,
        barcode,
        available,
        threshold,
        price,
        priceText,
        imageUrl,
        movementAt,
        movementTs
      });
    }
  }
  return Array.from(byProduct.values());
}

async function getStoredList(username) {
  const key = 'lowStockList_' + username;
  const out = await chrome.storage.local.get(key);
  return out[key] || [];
}

async function setStoredList(username, list) {
  const key = 'lowStockList_' + username;
  await chrome.storage.local.set({ [key]: list });
}

async function getMarkedDoneSet(username) {
  const key = 'lowStockMarkedDone_' + username;
  const out = await chrome.storage.local.get(key);
  return out[key] || {};
}

async function setMarkedDone(username, productId, done) {
  const key = 'lowStockMarkedDone_' + username;
  const obj = await getMarkedDoneSet(username);
  if (done) obj[productId] = true;
  else delete obj[productId];
  await chrome.storage.local.set({ [key]: obj });
}

const MANUAL_TOKEN_PREFIX = 'manualToken_';
function getJwtExpiry(tokenStr) {
  try {
    const t = typeof tokenStr === 'string' ? tokenStr.trim() : '';
    const bearer = t.startsWith('Bearer ') ? t.slice(7) : t;
    const parts = bearer.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '===='.slice(0, 4 - pad);
    const json = atob(base64);
    const obj = JSON.parse(json);
    return typeof obj.exp === 'number' ? obj.exp : null;
  } catch (_) {
    return null;
  }
}

async function getManualToken(username) {
  const key = MANUAL_TOKEN_PREFIX + username;
  const out = await chrome.storage.local.get(key);
  const t = out[key];
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}
async function setManualToken(username, token) {
  const key = MANUAL_TOKEN_PREFIX + username;
  const val = typeof token === 'string' ? token.trim() : '';
  if (!val) {
    await chrome.storage.local.remove(key);
    return null;
  }
  await chrome.storage.local.set({ [key]: val });
  return getJwtExpiry(val);
}

const userConfigByUsername = {};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'LOW_STOCK_INIT' && msg.payload) {
    const p = msg.payload;
    if (p.username) {
      userConfigByUsername[p.username] = {
        threshold: p.threshold,
        overrides: p.overrides || {},
        soundEnabled: p.soundEnabled !== false,
        featureEnabled: p.featureEnabled === true
      };
      getStoredList(p.username).then(list => {
        sendResponse({ ok: true, list, username: p.username });
      });
    } else sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'GET_LOW_STOCK_LIST' && msg.username) {
    getStoredList(msg.username).then(sendResponse);
    return true;
  }
  if (msg.type === 'MARK_DONE' && msg.username && msg.productId) {
    (async () => {
      const list = await getStoredList(msg.username);
      const next = list.filter(item => item.productId !== msg.productId);
      await setStoredList(msg.username, next);
      await setMarkedDone(msg.username, msg.productId, true);
      return { ok: true };
    })().then(sendResponse);
    return true;
  }
  if (msg.type === 'CLEAR_LOW_STOCK' && msg.username) {
    (async () => {
      const listKey = 'lowStockList_' + msg.username;
      const doneKey = 'lowStockMarkedDone_' + msg.username;
      await chrome.storage.local.set({ [listKey]: [], [doneKey]: {} });
      return { ok: true };
    })()
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e && e.message ? e.message : 'Silme hatası' }));
    return true;
  }
  if (msg.type === 'SAVE_MANUAL_TOKEN' && msg.username !== undefined) {
    setManualToken(msg.username, msg.token || '').then((expiry) => {
      sendResponse({ ok: true, expiry: expiry || undefined });
    });
    return true;
  }
  if (msg.type === 'GET_MANUAL_TOKEN_STATUS' && msg.username) {
    getManualToken(msg.username).then((t) => {
      const expiry = t ? getJwtExpiry(t) : null;
      sendResponse({ hasToken: !!t, expiry: expiry || undefined });
    });
    return true;
  }
  if (msg.type === 'MOVEMENTS_RESULT') {
    handleMovementsResult(msg).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  // Listeyi yenile butonu: mesaiye bakmadan anında son 100 hareketi çek (1 sayfa)
  if (msg.type === 'REQUEST_LOW_STOCK_REFRESH' && msg.username) {
    (async () => {
      if (movementsFetchInFlight) {
        return { error: 'Şu anda stok kontrolü yapılıyor. Lütfen birkaç saniye sonra tekrar deneyin.' };
      }
      if (msg.payload) {
        userConfigByUsername[msg.username] = {
          threshold: msg.payload.threshold,
          overrides: msg.payload.overrides || {},
          soundEnabled: msg.payload.soundEnabled !== false,
          featureEnabled: msg.payload.featureEnabled === true
        };
      }
      const tabs = await chrome.tabs.query({ url: 'https://franchise.getir.com/*' });
      if (!tabs.length) return { error: 'Franchise sekmesi açık değil. franchise.getir.com açıp giriş yapın.' };
      const manualToken = await getManualToken(msg.username);
      const tabId = tabs[0].id;
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content-franchise.js'] });
        await new Promise((r) => setTimeout(r, 150));
      } catch (_) {}
      movementsFetchInFlight = true;
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: 'FETCH_MOVEMENTS_FOR_POLL', maxPages: 1, manualToken: manualToken || undefined }, async (res) => {
          movementsFetchInFlight = false;
          if (chrome.runtime.lastError) return resolve({ error: 'Franchise sekmesi yanıt vermedi. Sekmeyi yenileyin (F5) ve tekrar "Listeyi yenile"ye tıklayın.' });
          if (!res || res.error) {
            const err = res && res.error ? res.error : 'İstek başarısız';
            if (err === 'TOKEN_NOT_CAPTURED') {
              return resolve({
                error: 'Token henüz yakalanmadı. Franchise sekmesinde stok veya hareketler sayfasına gidin (örn. Stok > Hareketler), sayfa tam yüklensin, birkaç saniye bekleyin; sonra tekrar "Listeyi yenile"ye tıklayın.'
              });
            }
            const detail = res && res.errorDetail ? res.errorDetail : '';
            return resolve({ error: detail ? err + ': ' + detail : err });
          }
          const data = res.data || [];
          await handleMovementsResult({ username: msg.username, data });
          const list = await getStoredList(msg.username);
          resolve({ ok: true, list });
        });
      });
    })().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

async function handleMovementsResult(msg) {
  const username = msg.username;
  const config = userConfigByUsername[username];
  if (!config || !config.featureEnabled) return { ok: true };
  const data = msg.data || [];
  const scanAt = new Date().toISOString();
  const baseList = processMovementsToLowStockList(data, config.threshold, config.overrides);
  const list = baseList.map(item => ({ ...item, scanAt }));
  const markedDone = await getMarkedDoneSet(username);
  const filtered = list.filter(item => !markedDone[item.productId]);
  filtered.sort((a, b) => {
    const ta = typeof a.movementTs === 'number' ? a.movementTs : 0;
    const tb = typeof b.movementTs === 'number' ? b.movementTs : 0;
    if (tb !== ta) return tb - ta;
    const na = (a.name || '').toString();
    const nb = (b.name || '').toString();
    return na.localeCompare(nb, 'tr-TR');
  });
  const prev = await getStoredList(username);
  await setStoredList(username, filtered);

  const prevById = new Map(prev.map(p => [p.productId, p]));
  for (const item of filtered) {
    const prevItem = prevById.get(item.productId);
    const isNew = !prevItem;
    const countDropped = prevItem && prevItem.available !== item.available;
    if (isNew || countDropped) {
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Düşük stok uyarısı',
          message: (item.name || item.productId) + ': kalan ' + item.available + ' (eşik: ' + item.threshold + ')'
        });
      } catch (_) {}
      if (config.soundEnabled) {
        try {
          const a = new Audio(chrome.runtime.getURL('notification.mp3'));
          a.volume = 0.5;
          a.play().catch(() => {});
        } catch (_) {}
      }
    }
  }

  chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*', 'https://jetbarkod.com.tr/*', 'https://www.jetbarkod.com.tr/*'] }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'LOW_STOCK_LIST_UPDATE', username, list: filtered }).catch(() => {});
    });
  });
  return { ok: true };
}

chrome.alarms.create('pollLowStock', { periodInMinutes: POLL_INTERVAL_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'pollLowStock') return;
  if (!isWithinWorkHours()) return;
  chrome.tabs.query({ url: 'https://franchise.getir.com/*' }, async (tabs) => {
    if (!tabs.length) return;
    if (movementsFetchInFlight) return;
    const usernames = Object.keys(userConfigByUsername);
    let manualToken = null;
    if (usernames.length) manualToken = await getManualToken(usernames[0]);
    movementsFetchInFlight = true;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'FETCH_MOVEMENTS_FOR_POLL', manualToken: manualToken || undefined }, (res) => {
      movementsFetchInFlight = false;
      if (!res || res.error || !res.data) return;
      const data = res.data;
      Object.keys(userConfigByUsername).forEach((username) => {
        handleMovementsResult({ username, data }).catch(() => {});
      });
    });
  });
});
