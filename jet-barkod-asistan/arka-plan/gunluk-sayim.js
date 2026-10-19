/**
 * Günlük sayım: 50'lik otomatik sayım kendiliğinden Jet Barkod'a
 * ============================================================================
 *
 * SABAH (06:00-07:59, İstanbul)
 *   Depo paneli açık bilgisayarda, günün otomatik sayımı (isAutoInventoryCheck)
 *   depo panelinden okunur: Sayım Geçmişi'nin yöntemi (öne çıkmayan sekmede
 *   panelin kendi istekleri, iş bitince sekme kapanır). Ürün listesi Jet Barkod
 *   API'sine (/api/gunluk-sayim) bırakılır; sayım sayfası `Günlük|<gün>`
 *   tablosunu oradan kendisi kurar. Panel sayımı henüz üretmediyse 08:00'e
 *   kadar 20 dakikada bir yeniden bakılır. Hafta sonu sayım yoksa sessiz geçer.
 *
 * GECE (00:00-00:59)
 *   Dünkü tabloda sayılmamış ürün sayısı Jet Barkod'dan sorulur (Getir'e istek
 *   yok); kontrol panelindeki kart (moduller/gunluk-sayim.js) bunu gösterir.
 *
 * Getir'e giden yük: günde bir sayım listesi + bir görev listesi (birkaç sayfa).
 * Görev listesinde ürün kimliği yoksa yalnız eksikler için görev detayı.
 * ============================================================================
 */

const GS_ALARM = 'jba-gunluk-sayim';
const GS_DURUM = 'jbaGunlukSayim';          // { gun, durum: 'eklendi'|'yok'|'hata', adet, zaman, metin }
const GS_GECE = 'jbaGunlukGece';            // { gun, kalan, toplam, zaman }
const GS_API = 'https://api.flowcobalt.com/api/gunluk-sayim';
const GS_TEKRAR_MS = 20 * 60 * 1000;
const GS_GECE_ARA_MS = 4 * 60 * 1000;
const GS_KIMLIK = /^[0-9a-f]{24}$/;

let gsCalisiyor = false;

/** İstanbul saatine göre gün (YYYY-MM-DD), saat ve dakika */
function gsSaat(t = Date.now()) {
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
  return { gun: `${p.year}-${p.month}-${p.day}`, saat: Number(p.hour), dakika: Number(p.minute) };
}

function gsDun(gun) {
  const d = new Date(gun + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function gsHakVar() {
  try {
    const r = await chrome.storage.local.get('jbaAcikModuller');
    const l = r && r.jbaAcikModuller;
    return !Array.isArray(l) || l.indexOf('gunlukSayim') !== -1;
  } catch (e) { return true; }
}

async function gsDepo() {
  let sekmeler = [];
  try { sekmeler = await chrome.tabs.query({ url: 'https://warehouse.getir.com/r/*' }); } catch (e) { return null; }
  for (const t of sekmeler) {
    const m = /\/r\/([0-9a-f]{24})\//.exec(t.url || '');
    if (m && !t.discarded) return { depo: m[1], pencere: t.windowId };
  }
  return null;
}

async function gsApi(yol, secenek = {}) {
  const al = globalThis.jbaYetkiAl;
  if (typeof al !== 'function') return { kod: 0, j: {} };
  let yetki = await al(false);
  if (!yetki) return { kod: 401, j: {} };
  for (let deneme = 0; deneme < 2; deneme++) {
    let r = null;
    try {
      r = await fetch(GS_API + yol, {
        method: secenek.method || 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + yetki.token },
        body: secenek.govde ? JSON.stringify(secenek.govde) : undefined,
      });
    } catch (e) { return { kod: 0, j: {} }; }
    if (r.status === 401 && deneme === 0) {
      yetki = await al(true);
      if (!yetki) return { kod: 401, j: {} };
      continue;
    }
    let j = {};
    try { j = await r.json(); } catch (e) { /* gövde yok */ }
    return { kod: r.status, j };
  }
  return { kod: 401, j: {} };
}

async function gsDurumYaz(v) {
  try { await chrome.storage.local.set({ [GS_DURUM]: { ...v, zaman: Date.now() } }); } catch (e) { /* sessiz */ }
}

/** Görevden ürün kimliği: listede yoksa detaya bakılır */
function gsGorevUrunu(g) {
  const v = (g && g.data) || {};
  const id = String(v.productId || (v.product && (v.product.id || v.product._id)) || (typeof v.product === 'string' ? v.product : '') || '');
  return { id: GS_KIMLIK.test(id) ? id : null, ad: (globalThis.jbaSayimPanel && globalThis.jbaSayimPanel.urunAdi(v)) || '' };
}

/**
 * Günün otomatik sayımını depo panelinden okuyup Jet Barkod'a bırakır.
 * sebep: 'periyot' | 'elle'
 */
async function gsEkle(sebep) {
  const P = globalThis.jbaSayimPanel;
  if (!P) return { ok: false, metin: 'Asistan hazır değil.' };
  if (gsCalisiyor) return { ok: false, metin: 'Zaten okunuyor.' };
  if (P.mesgulMu()) return { ok: false, metin: 'Sayım Geçmişi okunuyor; biraz sonra tekrar denenecek.' };
  if (!(await gsHakVar())) return { ok: false, metin: 'Günlük sayım bu hesapta kapalı.' };
  const yer = await gsDepo();
  if (!yer) return { ok: false, metin: 'Depo paneli açık değil.' };

  const { gun } = gsSaat();
  gsCalisiyor = true;
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({
      url: `https://warehouse.getir.com/r/${yer.depo}/stock/gstore-inventory-check/list`,
      active: false,
      windowId: yer.pencere,
    });
    tabId = tab.id;
    const hazir = await P.sekmeHazirBekle(tabId);
    if (!hazir.ok) { await gsDurumYaz({ gun, durum: 'hata', metin: hazir.hata }); return { ok: false, metin: hazir.hata }; }
    await P.bekle(800);

    const liste = await P.sayimListesi(tabId, yer.depo, gun, gun);
    if (!liste.ok) {
      const m = liste.hata || 'Sayım listesi alınamadı.';
      await gsDurumYaz({ gun, durum: 'hata', metin: m });
      return { ok: false, metin: m };
    }
    // Günün otomatik sayımı; birden çoksa en yenisi
    const oto = liste.sayimlar
      .filter((s) => s && s.isAutoInventoryCheck === true && gsSaat(Date.parse(s.createdAt)).gun === gun)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (!oto) {
      await gsDurumYaz({ gun, durum: 'yok', metin: 'Bugünün otomatik sayımı panelde henüz yok.' });
      return { ok: true, metin: 'Bugünün otomatik sayımı panelde henüz yok.' };
    }

    const gl = await P.gorevListesi(tabId, yer.depo, oto);
    if (!gl.ok || !gl.gorevler.length) {
      await gsDurumYaz({ gun, durum: 'hata', metin: 'Sayımın ürün listesi okunamadı.' });
      return { ok: false, metin: 'Sayımın ürün listesi okunamadı.' };
    }

    const urunler = [];
    const eksik = [];
    for (const g of gl.gorevler) {
      const u = gsGorevUrunu(g);
      if (u.id) urunler.push(u); else eksik.push(g);
    }
    // Görev listesinde ürün kimliği yoksa detaydan (yalnız eksikler, sırayla)
    if (eksik.length && GS_KIMLIK.test(String(oto.job || ''))) {
      for (const g of eksik.slice(0, 120)) {
        await P.bekle(300);
        const r = await P.israrla(tabId, { adres: P.gorevYolu(yer.depo, oto.id, oto.job, g.id), desen: `/tasks/${g.id}(?:\\?|$)` });
        const v = r.ok && r.veri && r.veri.data && r.veri.data.data;
        const id = v && String(v.productId || '');
        if (GS_KIMLIK.test(id || '')) urunler.push({ id, ad: P.urunAdi(v) || '' });
      }
    }
    if (!urunler.length) {
      await gsDurumYaz({ gun, durum: 'hata', metin: 'Sayımdaki ürünler tanınamadı.' });
      return { ok: false, metin: 'Sayımdaki ürünler tanınamadı.' };
    }

    const c = await gsApi('', { method: 'POST', govde: { gun, sayimId: oto.id, urunler } });
    if (c.kod === 200 && c.j.ok) {
      await gsDurumYaz({ gun, durum: 'eklendi', adet: urunler.length, metin: urunler.length + ' ürün eklendi.' });
      return { ok: true, metin: urunler.length + ' ürün eklendi.', adet: urunler.length };
    }
    const m = c.kod === 503 || c.kod === 404 ? 'Sunucu güncellemesi bekleniyor.'
      : c.kod === 401 ? 'Jet Barkod oturumu yok; siteye bir kez girin.' : 'Jet Barkod\'a yazılamadı (' + c.kod + ').';
    await gsDurumYaz({ gun, durum: 'hata', metin: m });
    return { ok: false, metin: m };
  } catch (e) {
    const m = (e && e.message) || 'Günlük sayım alınamadı.';
    await gsDurumYaz({ gun, durum: 'hata', metin: m });
    return { ok: false, metin: m };
  } finally {
    gsCalisiyor = false;
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch (e) { /* kapalı */ } }
  }
}

/** Gece: dünkü tabloda kalan ürün (Jet Barkod'dan) */
async function gsGeceDurumu(zorla) {
  const { gun, saat } = gsSaat();
  if (saat !== 0 && !zorla) return null;
  const dun = gsDun(gun);
  try {
    const r = await chrome.storage.local.get(GS_GECE);
    const v = r && r[GS_GECE];
    if (!zorla && v && v.gun === dun && Date.now() - (v.zaman || 0) < GS_GECE_ARA_MS) return v;
  } catch (e) { /* yok */ }
  const c = await gsApi('/durum?gun=' + dun);
  if (c.kod !== 200 || !c.j.ok) return null;
  const v = { gun: dun, kalan: Number(c.j.kalan) || 0, toplam: Number(c.j.toplam) || 0, var: !!c.j.var, zaman: Date.now() };
  try { await chrome.storage.local.set({ [GS_GECE]: v }); } catch (e) { /* sessiz */ }
  return v;
}

async function gsTur() {
  if (!(await gsHakVar())) return;
  const { gun, saat } = gsSaat();
  if (saat >= 6 && saat < 8) {
    let d = null;
    try { d = (await chrome.storage.local.get(GS_DURUM))[GS_DURUM]; } catch (e) { d = null; }
    const bugunEklendi = d && d.gun === gun && d.durum === 'eklendi';
    const yakinda = d && d.gun === gun && Date.now() - (d.zaman || 0) < GS_TEKRAR_MS;
    if (!bugunEklendi && !yakinda) await gsEkle('periyot');
  }
  if (saat === 0) await gsGeceDurumu(false);
}

async function gsAlarmKur() {
  try {
    const var_ = await chrome.alarms.get(GS_ALARM);
    if (!var_) chrome.alarms.create(GS_ALARM, { periodInMinutes: 5, delayInMinutes: 1 });
  } catch (e) { /* sessiz */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === GS_ALARM) gsTur(); });
chrome.runtime.onStartup.addListener(gsAlarmKur);
chrome.runtime.onInstalled.addListener(gsAlarmKur);

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
  if (!istek || typeof istek.type !== 'string') return false;
  if (istek.type === 'JBA_GUNLUK_EKLE') {
    gsEkle('elle').then(cevapla, () => cevapla({ ok: false, metin: 'Alınamadı.' }));
    return true;
  }
  // Asistan penceresindeki simülasyon: kartı kontrol panelinde 20 sn göster
  if (istek.type === 'JBA_GUNLUK_SIM') {
    (async () => {
      let sekmeler = [];
      try { sekmeler = await chrome.tabs.query({ url: 'https://warehouse.getir.com/r/*/dashboard/orders*' }); } catch (e) { sekmeler = []; }
      const hedef = sekmeler.find((t) => t.active) || sekmeler[0];
      if (!hedef) return { ok: false, metin: 'Kontrol paneli açık değil.' };
      const { gun } = gsSaat();
      const m = { type: 'JBA_GUNLUK_KART', tur: istek.tur === 'gece' ? 'gece' : 'sabah' };
      if (m.tur === 'gece') {
        const v = await gsGeceDurumu(true).catch(() => null);
        m.gun = gsDun(gun);
        m.kalan = v && v.kalan > 0 ? v.kalan : 3;
      } else {
        let d = null;
        try { d = (await chrome.storage.local.get(GS_DURUM))[GS_DURUM]; } catch (e) { d = null; }
        m.gun = gun;
        m.adet = d && d.gun === gun && d.adet ? d.adet : 50;
      }
      try { await chrome.tabs.sendMessage(hedef.id, m); } catch (e) { return { ok: false, metin: 'Kontrol paneli sekmesini yenileyin.' }; }
      try { await chrome.tabs.update(hedef.id, { active: true }); await chrome.windows.update(hedef.windowId, { focused: true }); } catch (e) { /* sessiz */ }
      return { ok: true };
    })().then(cevapla, () => cevapla({ ok: false, metin: 'Gösterilemedi.' }));
    return true;
  }
  if (istek.type === 'JBA_GUNLUK_GECE') {
    gsGeceDurumu(false).then((v) => cevapla({ ok: true, durum: v }), () => cevapla({ ok: false }));
    return true;
  }
  return false;
});

gsAlarmKur();
