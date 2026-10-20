/**
 * Günlük sayım: 50'lik otomatik sayım kendiliğinden Jet Barkod'a
 * ============================================================================
 *
 * SABAH (06:00'dan gün sonuna, İstanbul)
 *   Depo paneli açık bilgisayarda günün otomatik sayımı (isAutoInventoryCheck)
 *   açık panel sekmesinden okunur: sayfa köprüsü panelin kendi başlıklarıyla
 *   sayım listesini ve sayımın detayını ister, yeni sekme açılmaz. Bu
 *   olmazsa (sekme eski Asistan'la açık, oturum yok) Sayım Geçmişi'nin
 *   yöntemine düşülür (öne çıkmayan sekme, iş bitince kapanır).
 *   Ürün listesi Jet Barkod API'sine (/api/gunluk-sayim) bırakılır; sayım
 *   sayfası `Günlük|<gün>` tablosunu oradan kendisi kurar.
 *   Panel sayımı henüz üretmediyse 08:00'e kadar 20 dakikada, sonra saatte
 *   bir yeniden bakılır. Bilgisayar geç açılırsa panel açılınca hemen alınır.
 *   Hafta sonu sayım yoksa sessiz geçer.
 *
 * GECE (00:00-00:59)
 *   Dünkü tabloda sayılmamış ürün sayısı Jet Barkod'dan sorulur (Getir'e istek
 *   yok); kontrol panelindeki kart (moduller/gunluk-sayim.js) bunu gösterir.
 *
 * Getir'e giden yük: günde bir sayım listesi + bir sayım detayı (gerekirse
 * görev listesi). Liste bulununca o gün bir daha istek atılmaz.
 * ============================================================================
 */

const GS_ALARM = 'jba-gunluk-sayim';
const GS_DURUM = 'jbaGunlukSayim';          // { gun, durum: 'eklendi'|'yok'|'hata', adet, zaman, metin }
const GS_GECE = 'jbaGunlukGece';            // { gun, kalan, toplam, zaman }
const GS_AYAR = 'jbaGunlukAyar';            // { ekle, sabah, gece } varsayılan hepsi açık
const GS_API = 'https://api.flowcobalt.com/api/gunluk-sayim';
const GS_TEKRAR_MS = 20 * 60 * 1000;
const GS_GEC_TEKRAR_MS = 60 * 60 * 1000;
const GS_SITE = 'https://jetbarkod.com.tr/sayim/?gunluk=';
const GS_GUN = /^\d{4}-\d{2}-\d{2}$/;
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

/** Gece uyarısının günü: 00:00-00:59 arası dün, gün içinde bugün */
function gsUyariGunu() {
  const { gun, saat } = gsSaat();
  return saat === 0 ? gsDun(gun) : gun;
}

function gsDun(gun) {
  const d = new Date(gun + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* Hak listesi siteden geliyor. Günlük Sayım eklenmeden önce kaydedilmiş bir
   listede yoksa, Asistan'ın tam hakkını gösteren modüller varsa açık sayılır
   (site bir sonraki açılışta listeyi zaten tazeler; sunucu hakkı ayrıca denetler). */
function gsListedeAcik(l) {
  if (!Array.isArray(l)) return true;
  if (l.indexOf('gunlukSayim') !== -1) return true;
  return ['kaldirma', 'itiraz', 'sayimHazirligi'].some((m) => l.indexOf(m) !== -1);
}

async function gsHakVar() {
  try {
    const r = await chrome.storage.local.get('jbaAcikModuller');
    return gsListedeAcik(r && r.jbaAcikModuller);
  } catch (e) { return true; }
}

/** Yüklenmiş, uyutulmamış panel sekmesi; kontrol paneli öncelikli */
async function gsPanelSekmesi() {
  let sekmeler = [];
  try { sekmeler = await chrome.tabs.query({ url: 'https://warehouse.getir.com/r/*' }); } catch (e) { return null; }
  const hazir = sekmeler.filter((t) => t.status === 'complete' && !t.discarded && /\/r\/[0-9a-f]{24}\//.test(t.url || ''));
  return hazir.find((t) => /\/dashboard\//.test(t.url || '')) || hazir.find((t) => t.active) || hazir[0] || null;
}

/** Açık panel sekmesinden, yeni sekme açmadan. null: bu yol kullanılamadı */
async function gsSekmesiz(gun) {
  const tab = await gsPanelSekmesi();
  if (!tab) return null;
  let c = null;
  try { c = await chrome.tabs.sendMessage(tab.id, { type: 'JBA_GUNLUK_OKU', gun }); } catch (e) { c = null; }
  if (!c) return null;
  if (c.ok && c.yok) return { ok: true, yok: true };
  if (!c.ok) { console.warn('[JBA] Günlük sayım sekmesiz okunamadı:', c.sebep || '?'); return null; }
  const urunler = (Array.isArray(c.urunler) ? c.urunler : [])
    .filter((u) => u && GS_KIMLIK.test(String(u.id || '')))
    .map((u) => ({ id: String(u.id), ad: String(u.ad || '').slice(0, 200) }));
  if (!urunler.length || !GS_KIMLIK.test(String(c.sayimId || ''))) return null;
  return { ok: true, sayimId: String(c.sayimId), urunler };
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
  if (gsCalisiyor) return { ok: false, metin: 'Zaten okunuyor.' };
  if (!(await gsHakVar())) return { ok: false, metin: 'Günlük sayım bu hesapta kapalı.' };
  const { gun } = gsSaat();
  gsCalisiyor = true;
  try {
    let oku = await gsSekmesiz(gun);
    if (!oku) oku = await gsSekmeyle(gun);
    if (!oku.ok) {
      // Panel kapalıyken durum yazılmaz; panel açılınca hemen denenir
      if (!oku.sessiz) await gsDurumYaz({ gun, durum: 'hata', metin: oku.metin });
      return { ok: false, metin: oku.metin };
    }
    if (oku.yok) {
      const m = 'Bugünün otomatik sayımı panelde henüz yok.';
      await gsDurumYaz({ gun, durum: 'yok', metin: m });
      return { ok: true, metin: m };
    }
    const urunler = oku.urunler;
    const c = await gsApi('', { method: 'POST', govde: { gun, sayimId: oku.sayimId, urunler, elle: sebep === 'elle' } });
    if (c.kod === 200 && c.j.ok) {
      // Sunucunun tablo kurulumu: kuruldu | vardi | silinmis | hata (eski sunucu yazmaz)
      const tablo = c.j.tablo;
      if (tablo === 'silinmis') {
        const m = 'Bugünün tablosu silinmiş; yeniden kurmak için Şimdi Ekle\'ye basın.';
        await gsDurumYaz({ gun, durum: 'silinmis', metin: m });
        return { ok: false, metin: m };
      }
      const m = tablo === 'vardi' ? 'Tablo zaten var · ' + urunler.length + ' ürün.'
        : tablo === 'hata' ? urunler.length + ' ürün alındı; tablo sayım sayfası açılınca kurulur.'
        : urunler.length + ' ürün eklendi.';
      await gsDurumYaz({ gun, durum: 'eklendi', adet: urunler.length, metin: m });
      return { ok: true, metin: m, adet: urunler.length };
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
  }
}

/**
 * Yedek yol: Sayım Geçmişi'nin yöntemi (öne çıkmayan sekmede panelin kendi
 * istekleri). Dönen: { ok, yok?, sayimId?, urunler?, metin?, sessiz? }
 */
async function gsSekmeyle(gun) {
  const P = globalThis.jbaSayimPanel;
  if (!P) return { ok: false, metin: 'Asistan hazır değil.' };
  if (P.mesgulMu()) return { ok: false, sessiz: true, metin: 'Sayım Geçmişi okunuyor; biraz sonra tekrar denenecek.' };
  const yer = await gsDepo();
  if (!yer) return { ok: false, sessiz: true, metin: 'Depo paneli açık değil.' };
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({
      url: `https://warehouse.getir.com/r/${yer.depo}/stock/gstore-inventory-check/list`,
      active: false,
      windowId: yer.pencere,
    });
    tabId = tab.id;
    const hazir = await P.sekmeHazirBekle(tabId);
    if (!hazir.ok) return { ok: false, metin: hazir.hata };
    await P.bekle(800);

    const liste = await P.sayimListesi(tabId, yer.depo, gun, gun);
    if (!liste.ok) return { ok: false, metin: liste.hata || 'Sayım listesi alınamadı.' };
    // Günün otomatik sayımı; birden çoksa en yenisi
    const oto = liste.sayimlar
      .filter((s) => s && s.isAutoInventoryCheck === true && gsSaat(Date.parse(s.createdAt)).gun === gun)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (!oto) return { ok: true, yok: true };

    const gl = await P.gorevListesi(tabId, yer.depo, oto);
    if (!gl.ok || !gl.gorevler.length) return { ok: false, metin: 'Sayımın ürün listesi okunamadı.' };

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
    if (!urunler.length) return { ok: false, metin: 'Sayımdaki ürünler tanınamadı.' };
    return { ok: true, sayimId: String(oto.id), urunler };
  } catch (e) {
    return { ok: false, metin: (e && e.message) || 'Günlük sayım alınamadı.' };
  } finally {
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch (e) { /* kapalı */ } }
  }
}

/** Gece: dünkü tabloda kalan ürün (Jet Barkod'dan) */
async function gsGeceDurumu(zorla) {
  const { saat } = gsSaat();
  if (saat !== 0 && !zorla) return null;
  const hedef = gsUyariGunu();
  try {
    const r = await chrome.storage.local.get(GS_GECE);
    const v = r && r[GS_GECE];
    if (!zorla && v && v.gun === hedef && Date.now() - (v.zaman || 0) < GS_GECE_ARA_MS) return v;
  } catch (e) { /* yok */ }
  const c = await gsApi('/durum?gun=' + hedef);
  if (c.kod !== 200 || !c.j.ok) return null;
  const v = { gun: hedef, kalan: Number(c.j.kalan) || 0, toplam: Number(c.j.toplam) || 0, var: !!c.j.var, zaman: Date.now() };
  try { await chrome.storage.local.set({ [GS_GECE]: v }); } catch (e) { /* sessiz */ }
  return v;
}

async function gsAyar() {
  try { return (await chrome.storage.local.get(GS_AYAR))[GS_AYAR] || {}; } catch (e) { return {}; }
}

async function gsTur() {
  if (!(await gsHakVar())) return;
  const ayar = await gsAyar();
  const { gun, saat } = gsSaat();
  if (ayar.ekle !== false && saat >= 6) {
    let d = null;
    try { d = (await chrome.storage.local.get(GS_DURUM))[GS_DURUM]; } catch (e) { d = null; }
    // Kullanıcı bugünün tablosunu sildiyse o gün kendiliğinden yeniden denenmez
    const bugunEklendi = d && d.gun === gun && (d.durum === 'eklendi' || d.durum === 'silinmis');
    const ara = saat < 8 ? GS_TEKRAR_MS : GS_GEC_TEKRAR_MS;
    const yakinda = d && d.gun === gun && Date.now() - (d.zaman || 0) < ara;
    if (!bugunEklendi && !yakinda) await gsEkle('periyot');
  }
  if (ayar.gece !== false && saat === 0) await gsGeceDurumu(false);
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
        m.gun = gsUyariGunu();
        m.kalan = v && v.kalan > 0 ? v.kalan : 3;
      } else {
        let d = null;
        try { d = (await chrome.storage.local.get(GS_DURUM))[GS_DURUM]; } catch (e) { d = null; }
        m.gun = gun;
        m.adet = d && d.gun === gun && d.adet ? d.adet : 50;
      }
      let c = null;
      try { c = await chrome.tabs.sendMessage(hedef.id, m); } catch (e) { c = null; }
      if (!c) return { ok: false, metin: 'Kontrol paneli sekmesini bir kez yenileyin (F5), sonra tekrar deneyin.' };
      if (!c.ok) return { ok: false, metin: 'Kontrol paneli sayfasında açın (Siparişler panosu).' };
      try { await chrome.tabs.update(hedef.id, { active: true }); await chrome.windows.update(hedef.windowId, { focused: true }); } catch (e) { /* sessiz */ }
      return { ok: true };
    })().then(cevapla, () => cevapla({ ok: false, metin: 'Gösterilemedi.' }));
    return true;
  }
  // Kart "Sayıma Başla": tarayıcıda, kartın penceresinde yeni sekme.
  // Sayfadan window.open yüklü Jet Barkod uygulamasının penceresine düşüyordu.
  if (istek.type === 'JBA_SAYIM_SEKMESI') {
    const gun = String(istek.gun || '');
    const tab = gonderen && gonderen.tab;
    if (!GS_GUN.test(gun) || !tab || !/^https:\/\/warehouse\.getir\.com\//.test(tab.url || '')) { cevapla({ ok: false }); return false; }
    const secenek = { url: GS_SITE + gun, active: true };
    if (tab.windowId != null) secenek.windowId = tab.windowId;
    if (typeof tab.index === 'number') secenek.index = tab.index + 1;
    if (tab.id != null) secenek.openerTabId = tab.id;
    chrome.tabs.create(secenek)
      .catch(() => chrome.tabs.create({ url: GS_SITE + gun, active: true }))
      .then(() => cevapla({ ok: true }), () => cevapla({ ok: false }));
    return true;
  }
  // Panel açıldı (bilgisayar geç açıldı ya da sekme yenilendi): eksikse hemen
  if (istek.type === 'JBA_GUNLUK_PANO_HAZIR') {
    setTimeout(() => { gsTur().catch(() => {}); }, 8000);
    return false;
  }
  if (istek.type === 'JBA_GUNLUK_GECE') {
    gsGeceDurumu(false).then((v) => cevapla({ ok: true, durum: v }), () => cevapla({ ok: false }));
    return true;
  }
  return false;
});

gsAlarmKur();
