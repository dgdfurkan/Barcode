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

/*
 * SKT, warehouse panelinin KENDİ isteğiyle alınıyor. Panelin oturumu 15
 * dakikalık ve yalnız panel açıkken yenileniyor; bu oturumu dışarıdan
 * yenilemek ya da isteği taklit etmek güvenlik çizgimizin dışında. Bunun
 * yerine öne çıkmayan bir sekmede SKT listesi sayfası açılıyor, adresteki
 * ürün kimlikleri değiştirilerek panelin isteği yeniden attırılıyor ve
 * sayfa köprüsünün duyurduğu yanıt okunuyor. İş bitince sekme kapanıyor.
 */
const SKT_LISTE = (depo) => `https://warehouse.getir.com/r/${depo}/stock/stock-management/product/expiration/list`;
const PARCA_URUN = 40;
const PARCA_ARASI_MS = 700;

function bugunIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bekle(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Sekme yüklenip panel uygulaması SKT sayfasında hazır olana kadar bekler */
async function sekmeHazirBekle(tabId, zamanAsimiMs = 30000) {
  const bitis = Date.now() + zamanAsimiMs;
  while (Date.now() < bitis) {
    let tab = null;
    try { tab = await chrome.tabs.get(tabId); } catch (e) { return { ok: false, hata: 'Warehouse sekmesi kapandı.' }; }
    const url = tab.url || tab.pendingUrl || '';
    // Oturum yoksa giriş sayfasında kalır (sessiz giriş denemesi prompt=none ile geçer)
    if (/stockid\.getirapi\.com/.test(url) && !/prompt=none/.test(url) && tab.status === 'complete') {
      return { ok: false, hata: 'Warehouse paneline giriş yapılmamış. warehouse.getir.com\'a bir kez giriş yapın.' };
    }
    if (tab.status === 'complete' && /\/expiration\/list/.test(url)) {
      try {
        const [r] = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: () => !!(window.__jbSayfaKoprusu && document.querySelector('#root, #app, [id*="root"]') && /\/expiration\/list/.test(location.pathname) && document.querySelector('button')),
        });
        if (r && r.result) return { ok: true };
      } catch (e) { /* sayfa yükleniyor */ }
    }
    await bekle(400);
  }
  return { ok: false, hata: 'Warehouse paneli yanıt vermedi. Biraz sonra tekrar deneyin.' };
}

/**
 * Panelin adresindeki ürün kimliklerini değiştirip panelin kendi isteğini
 * attırır, sayfa köprüsünün duyurduğu yanıtı döndürür.
 */
async function panelIstegiYaptir(tabId, depo, ids) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [depo, ids, bugunIso()],
    func: (depoP, idsP, bugunP) => new Promise((coz) => {
      let bitti = false;
      const son = (v) => { if (bitti) return; bitti = true; window.removeEventListener('message', dinle); clearTimeout(zaman); coz(v); };
      const dinle = (e) => {
        const d = e.data;
        if (!d || d.type !== 'GETIR_DATA_RECEIVED' || !/\/get-expiring-products/.test(d.url || '')) return;
        const veri = d.payload && Array.isArray(d.payload.data) ? d.payload.data : null;
        if (!veri) return son({ ok: false, hata: 'SKT yanıtı okunamadı' });
        // Bu parçanın yanıtı mı: dönen ürünler istenenlerin içinde olmalı
        const istenen = new Set(idsP);
        if (veri.some((x) => x && x.id && !istenen.has(String(x.id)))) return;
        son({ ok: true, data: veri });
      };
      window.addEventListener('message', dinle);
      const zaman = setTimeout(() => son({ ok: false, hata: 'Panel SKT listesini getirmedi (zaman aşımı)' }), 20000);
      const adres = `/r/${depoP}/stock/stock-management/product/expiration/list?offset=1&productIds=${idsP.join(',')}&startDate=${bugunP}&endDate=2030-07-31`;
      try {
        history.pushState({}, '', adres);
        dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      } catch (err) {
        son({ ok: false, hata: 'Panel adresi değiştirilemedi' });
      }
    }),
  });
  return (r && r.result) || { ok: false, hata: 'Warehouse sekmesinde betik çalıştırılamadı' };
}

/** Panel yanıtı -> ürün kimliği başına partiler (tarih, adet, satıştan kalkış, raf) */
function partileriAyikla(veri, birlesik) {
  const trTarih = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || '').slice(0, 10);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };
  for (const item of veri) {
    const pid = item && (item.id || item.productId);
    const adet = Number(item && (item.count ?? item.quantity));
    if (!pid || !item.expiryDate || !adet) continue;
    const sid = String(pid);
    if (!birlesik[sid]) birlesik[sid] = [];
    const date = trTarih(item.expiryDate);
    const removeDate = item.removeFromSaleDate ? trTarih(item.removeFromSaleDate) : null;
    const raf = item.location && item.location.barcode ? String(item.location.barcode).slice(0, 40) : null;
    const var_ = birlesik[sid].find((e) => e.date === date && e.raf === raf);
    if (var_) var_.qty += adet;
    else birlesik[sid].push({ date, qty: adet, removeDate, raf });
  }
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

  let tabId = null;
  try {
    sendExpiryProgress(callerTabs, 'Warehouse paneli açılıyor');
    const pencere = callerTabs[0] && callerTabs[0].windowId;
    const tab = await chrome.tabs.create({ url: SKT_LISTE(warehouseId), active: false, ...(pencere ? { windowId: pencere } : {}) });
    tabId = tab.id;
    const hazir = await sekmeHazirBekle(tabId);
    if (!hazir.ok) {
      sendExpiryResponse(callerTabs, { success: false, error: hazir.hata, byProductId: {} });
      return;
    }

    const parcalar = chunkArray(productIds, PARCA_URUN);
    const merged = {};
    productIds.forEach((id) => { merged[id] = []; });

    for (let i = 0; i < parcalar.length; i++) {
      sendExpiryProgress(callerTabs, `SKT alınıyor ${Math.min((i + 1) * PARCA_URUN, productIds.length)} / ${productIds.length} ürün`);
      let sonuc = await panelIstegiYaptir(tabId, warehouseId, parcalar[i]);
      // Panel ilk açılışta oturumu tazeliyor olabilir: bir kez daha dene
      if (!sonuc.ok) { await bekle(1500); sonuc = await panelIstegiYaptir(tabId, warehouseId, parcalar[i]); }
      if (!sonuc.ok) {
        sendExpiryResponse(callerTabs, { success: false, error: sonuc.hata || 'SKT alınamadı', byProductId: merged });
        return;
      }
      partileriAyikla(sonuc.data, merged);
      if (i < parcalar.length - 1) await bekle(PARCA_ARASI_MS);
    }

    Object.keys(merged).forEach((pid) => {
      merged[pid].sort((a, b) => {
        const [da, ma, ya] = a.date.split('.').map(Number);
        const [db, mb, yb] = b.date.split('.').map(Number);
        return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
      });
    });
    const withData = Object.values(merged).filter((arr) => arr.length > 0).length;
    sendExpiryProgress(callerTabs, `${withData} / ${productIds.length} üründe SKT bulundu`);
    sendExpiryResponse(callerTabs, { success: true, byProductId: merged, total: productIds.length, withData });
  } catch (error) {
    sendExpiryResponse(callerTabs, {
      success: false,
      error: error.message || 'SKT çekimi başarısız',
      byProductId: {}
    });
  } finally {
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch (e) { /* zaten kapalı */ } }
  }
}
