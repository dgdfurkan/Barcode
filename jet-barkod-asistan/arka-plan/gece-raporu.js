/**
 * Telegram raporları için veri tazeliği (raporlar sunucuda, hesabın seçtiği saatlerde)
 * ============================================================================
 *
 * İTİRAZLAR (2 saatte bir, ayrıca her itiraz raporundan önceki 20 dakikada)
 *   Franchise oturumu (sayim-hazirligi.js'in yakaladığı jeton) geçerliyse
 *   Depo Değerlendirme listesi son 30 gün için okunur, Jet Barkod'a
 *   (/api/itiraz/kayitlar) yazılır. Panelin kendi isteği; 1-2 sayfa.
 *   Sunucu siparişi henüz okunmamış kayıtları döner (siparisEksik); her
 *   turda en çok 10 tanesinin "Sipariş Detayı" okunur ve yalnız ürünler,
 *   süreler, kurye ve toplayıcı /api/itiraz/siparis ile bırakılır. Müşteri
 *   bilgisi okunmaz. Böylece rapor İtiraz Yazıcı sayfası açılmadan da güncel.
 *
 * SAYIM SONUÇLARI (her rapor saatinden 30-5 dk önce, saat başına bir kez)
 *   Depo paneli açık bilgisayarda dün ve bugünün tamamlanmış sayımları
 *   Sayım Geçmişi'nin yöntemiyle okunur (öne çıkmayan sekme, iş bitince
 *   kapanır) ve /api/sayim-gecmisi/yaz ile bırakılır. Aynı anda günlük
 *   sayımın paneldeki durumu (toplam / tamamlanan) sekme açmadan okunup
 *   /api/gece-raporu/gunluk-durum ile bırakılır.
 *
 * RAPOR SAATLERİ
 *   Sunucudan (GET /api/gece-raporu/ayar) saatte bir alınır: saatler (gece
 *   raporu, sayımlar ondan önce) ve itirazSaatler; bilinmiyorsa 01:00.
 *   Ayar ve elle gönderim Telegram Raporları sayfasında (/telegram/).
 * ============================================================================
 */

const GR_ALARM = 'jba-gece-raporu';
const GR_API = 'https://api.flowcobalt.com';
const GR_DDS = 'https://franchise-api-gateway.getirapi.com/dds100/logs/filter';
const GR_ITIRAZ_SON = 'jbaItirazEsitlemeSon';
const GR_SAYIM_SON = 'jbaGeceSayimSon';     // { anahtar: 'gün:dakika', zaman, ok, metin }
const GR_SAATLER = 'jbaRaporSaatleri';      // { saatler: [dakika], zaman }
const GR_SAAT_ARA_MS = 60 * 60 * 1000;
const GR_SIPARIS_TUR = 10;                  // bir turda en çok okunan sipariş
const GR_KOK = 'https://franchise-api-gateway.getirapi.com';
const GR_URUN_GORSEL = /^https:\/\/(?:cdn-image\.getir\.com|cdn\.getir\.com|images\.getir\.com)\/[A-Za-z0-9._~%\/-]{1,300}$/;
const GR_KISI_FOTO = /^https:\/\/cdn\.getir\.com\/person\/[A-Za-z0-9._-]+\.(?:png|jpe?g)(?:\?[0-9]+)?$/;
const GR_ITIRAZ_ARA_MS = 2 * 60 * 60 * 1000;
const GR_KIMLIK = /^[0-9a-f]{24}$/;

let grCalisiyor = false;

function grSaat(t = Date.now()) {
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
  return { gun: `${p.year}-${p.month}-${p.day}`, saat: Number(p.hour), dakika: Number(p.minute) };
}

function grDun(gun) {
  const d = new Date(gun + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function grModulAcik(ad) {
  try {
    const r = await chrome.storage.local.get('jbaAcikModuller');
    const l = r && r.jbaAcikModuller;
    if (!Array.isArray(l) || l.indexOf(ad) !== -1) return true;
    // Günlük Sayım listeye sonradan eklendi; eski listede tam hak modülleri varsa açık say
    return ad === 'gunlukSayim' && ['kaldirma', 'itiraz', 'sayimHazirligi'].some((m) => l.indexOf(m) !== -1);
  } catch (e) { return true; }
}

/** Jet Barkod API'si (oturum siparis-kopru.js'ten) */
async function grApi(yol, secenek = {}) {
  const al = globalThis.jbaYetkiAl;
  if (typeof al !== 'function') return { kod: 0, j: {} };
  let yetki = await al(false);
  if (!yetki) return { kod: 401, j: {} };
  for (let deneme = 0; deneme < 2; deneme++) {
    let r = null;
    try {
      r = await fetch(GR_API + yol, {
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

// ---------------------------------------------------------------------
// İtirazlar
// ---------------------------------------------------------------------

function grJwtBitis(jeton) {
  try {
    const p = String(jeton).replace(/^Bearer\s+/i, '').split('.')[1];
    const y = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    return Number.isFinite(y.exp) ? y.exp * 1000 : 0;
  } catch (e) { return 0; }
}

function grItirazSade(o) {
  const veri = (o && o.data) || {};
  const fb = veri.feedback || {};
  const ac = typeof veri.description === 'string' && veri.description !== 'description' ? veri.description : '';
  const it = o.objection || {};
  return {
    id: String(o._id || ''),
    durum: Number(o.status),
    kayitTarihi: o.recordDate || null,
    sonTarih: o.deadlineForObjection || null,
    kriter: (o.criteria && o.criteria.name && o.criteria.name.tr) || '',
    sikayet: (fb.feedback && fb.feedback.tr) || ac || '',
    aciklama: ac,
    musteriNotu: typeof fb.note === 'string' ? fb.note : '',
    urun: (veri.product && veri.product.fullName && veri.product.fullName.tr) || '',
    urunId: veri.product && GR_KIMLIK.test(String(veri.product.id || '')) ? String(veri.product.id) : '',
    itirazMetni: typeof it.description === 'string' ? it.description : '',
    itirazSebepId: typeof it.reasonId === 'string' ? it.reasonId : '',
    siparisId: veri.order && GR_KIMLIK.test(String(veri.order.id || '')) ? String(veri.order.id) : '',
    siparisTur: Number.isFinite(parseInt(veri.domainType, 10)) ? parseInt(veri.domainType, 10) : null,
  };
}

function grGorsel(p) {
  if (!p || typeof p !== 'object') return '';
  let x = p.picURL || p.picUrl || p.picURLs || p.image || '';
  if (Array.isArray(x)) x = x[0];
  if (x && typeof x === 'object') x = x.tr || x.en || x['en-US'] || Object.values(x).find((v) => typeof v === 'string') || '';
  if (Array.isArray(x)) x = x[0];
  return typeof x === 'string' && GR_URUN_GORSEL.test(x) ? x : '';
}

function grKisi(k) {
  if (!k || typeof k !== 'object') return null;
  const ad = String(typeof k.name === 'string' ? k.name : typeof k.fullName === 'string' ? k.fullName : '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const foto = typeof k.picURL === 'string' && GR_KISI_FOTO.test(k.picURL) ? k.picURL : '';
  return ad || foto ? { ad, foto } : null;
}

/** Panelin "Sipariş Detayı" isteği: yalnız ürünler, süreler, kurye ve toplayıcı (müşteri bilgisi alınmaz) */
async function grSiparisOzeti(jeton, id, tur) {
  const r = await fetch(GR_KOK + '/orders/' + id + (tur != null ? '?domainType=' + Number(tur) : ''), {
    headers: { Accept: 'application/json', Authorization: /^Bearer /.test(jeton) ? jeton : 'Bearer ' + jeton },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const o = j && j.basket ? j : j && j.data && j.data.basket ? j.data : j && j.data && j.data.order ? j.data.order : j;
  const ham = o && o.basket && Array.isArray(o.basket.products) ? o.basket.products : o && Array.isArray(o.products) ? o.products : [];
  const urunler = ham.map((u) => {
    let ad = u && u.name && typeof u.name === 'object' ? (u.name.tr || u.name.en || '') : (u && (u.name || u.fullName)) || '';
    if (ad && typeof ad === 'object') ad = ad.tr || ad.en || '';
    const pid = u && (u.product && typeof u.product === 'object' ? (u.product.id || u.product._id) : (u.product || u.productId || u.id || u._id));
    return {
      ad: String(ad || '').slice(0, 120), adet: Number(u && u.count) || 1,
      id: GR_KIMLIK.test(String(pid || '')) ? String(pid) : '',
      gorsel: grGorsel(u) || grGorsel(u && u.product),
    };
  }).filter((u) => u.ad);
  if (!urunler.length) return null;
  const zaman = (yol) => { const ms = Date.parse(o && o[yol] && o[yol].date); return Number.isFinite(ms) ? ms : null; };
  const bas = zaman('checkout') || Date.parse(o && o.checkoutDate) || null;
  const teslim = zaman('deliver');
  return {
    urunler,
    teslimDk: bas && teslim && teslim > bas ? Math.round((teslim - bas) / 60000) : null,
    tarih: bas ? new Date(bas).toISOString() : null,
    kurye: grKisi(o && o.courier),
    toplayici: grKisi(o && o.picker),
  };
}

/** Siparişi henüz okunmamış itiraz kayıtları: en çok GR_SIPARIS_TUR tane, panelin hızında */
async function grSiparisleriOku(jeton, eksik) {
  const liste = [];
  for (const x of eksik.slice(0, GR_SIPARIS_TUR)) {
    if (!GR_KIMLIK.test(String(x && x.id)) || !GR_KIMLIK.test(String(x && x.siparisId))) continue;
    if (liste.length) await new Promise((r) => setTimeout(r, 700));
    let sp = null;
    try { sp = await grSiparisOzeti(jeton, x.siparisId, x.siparisTur); } catch (e) { sp = null; }
    liste.push({ id: x.id, siparis: sp });
  }
  if (liste.length) await grApi('/api/itiraz/siparis', { method: 'POST', govde: { liste } }).catch(() => null);
  return liste.filter((x) => x.siparis).length;
}

async function grItirazEsitle(zorla) {
  if (!(await grModulAcik('itiraz'))) return { ok: false, metin: 'İtiraz Yazıcı kapalı.' };
  let son = 0;
  try { son = Number((await chrome.storage.local.get(GR_ITIRAZ_SON))[GR_ITIRAZ_SON]) || 0; } catch (e) { son = 0; }
  if (!zorla && Date.now() - son < GR_ITIRAZ_ARA_MS) return { ok: true, metin: 'Güncel.' };
  let bilgi = null;
  try { bilgi = (await chrome.storage.local.get('getir_api_info')).getir_api_info; } catch (e) { bilgi = null; }
  const jeton = bilgi && typeof bilgi.token === 'string' ? bilgi.token : '';
  // Depo kimliği franchise oturumunda olmayabilir: açık depo paneli sekmesinden,
  // o da yoksa en son görülenden (iki panelde aynı depo kimliği)
  let depo = bilgi && GR_KIMLIK.test(String(bilgi.warehouseId || '')) ? bilgi.warehouseId : null;
  if (!depo) { const yer = await grDepo(); if (yer) depo = yer.depo; }
  if (!depo) { try { const v = (await chrome.storage.local.get('jbaSonDepo')).jbaSonDepo; if (GR_KIMLIK.test(String(v || ''))) depo = v; } catch (e) { /* yok */ } }
  if (depo) { try { await chrome.storage.local.set({ jbaSonDepo: depo }); } catch (e) { /* sessiz */ } }
  if (!jeton || grJwtBitis(jeton) < Date.now() + 60000) return { ok: false, metin: 'Franchise oturumu yok; franchise panelini bir kez açın.' };
  if (!depo) return { ok: false, metin: 'Depo bilgisi yok; depo panelini bir kez açın.' };

  const bit = new Date(); bit.setHours(23, 59, 59, 999);
  const bas = new Date(); bas.setHours(0, 0, 0, 0); bas.setDate(bas.getDate() - 30);
  const hepsi = [];
  for (let s = 0; s < 3; s++) {
    if (s) await new Promise((r) => setTimeout(r, 600));
    let r;
    try {
      r = await fetch(GR_DDS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: /^Bearer /.test(jeton) ? jeton : 'Bearer ' + jeton },
        body: JSON.stringify({ startDate: bas.toISOString(), endDate: bit.toISOString(), limit: 50, offset: s * 50, warehouseIds: [depo] }),
      });
    } catch (e) { return { ok: false, metin: 'Panele ulaşılamadı.' }; }
    if (!r.ok) return { ok: false, metin: 'Liste okunamadı (' + r.status + ').' };
    const j = await r.json().catch(() => null);
    const parca = Array.isArray(j && j.ddsObjections) ? j.ddsObjections : [];
    hepsi.push(...parca);
    if (parca.length < 50 || hepsi.length >= (Number(j.totalCount) || 0)) break;
  }
  const kayitlar = hepsi.map(grItirazSade).filter((k) => GR_KIMLIK.test(k.id));
  const eksik = [];
  for (let i = 0; i < kayitlar.length; i += 60) {
    const c = await grApi('/api/itiraz/kayitlar', { method: 'POST', govde: { kayitlar: kayitlar.slice(i, i + 60) } });
    if (c.kod !== 200) return { ok: false, metin: 'Jet Barkod\'a yazılamadı (' + c.kod + ').' };
    if (Array.isArray(c.j && c.j.siparisEksik)) eksik.push(...c.j.siparisEksik);
  }
  try { await chrome.storage.local.set({ [GR_ITIRAZ_SON]: Date.now() }); } catch (e) { /* sessiz */ }
  const okunan = eksik.length ? await grSiparisleriOku(jeton, eksik).catch(() => 0) : 0;
  return { ok: true, metin: kayitlar.length + ' itiraz kaydı eşitlendi' + (okunan ? ', ' + okunan + ' siparişin özeti okundu.' : '.') };
}

// ---------------------------------------------------------------------
// Sayım sonuçları (gece 00:30)
// ---------------------------------------------------------------------

async function grDepo() {
  let sekmeler = [];
  try { sekmeler = await chrome.tabs.query({ url: 'https://warehouse.getir.com/r/*' }); } catch (e) { return null; }
  for (const t of sekmeler) {
    const m = /\/r\/([0-9a-f]{24})\//.exec(t.url || '');
    if (m && !t.discarded) return { depo: m[1], pencere: t.windowId };
  }
  return null;
}

async function grSayimOku() {
  const P = globalThis.jbaSayimPanel;
  if (!P || !P.sonuclariTopla) return { ok: false, metin: 'Asistan hazır değil.' };
  if (P.mesgulMu()) return { ok: false, metin: 'Sayım geçmişi meşgul.' };
  const yer = await grDepo();
  if (!yer) return { ok: false, metin: 'Depo paneli açık değil.' };
  const { gun } = grSaat();
  const r = await P.sonuclariTopla({ depo: yer.depo, bas: grDun(gun), bit: gun, pencere: yer.pencere });
  if (!r.ok && !r.kayitlar.length) return { ok: false, metin: r.hata || 'Sayımlar okunamadı.' };
  let yazilan = 0;
  for (let i = 0; i < r.kayitlar.length; i += 300) {
    const c = await grApi('/api/sayim-gecmisi/yaz', { method: 'POST', govde: { kayitlar: r.kayitlar.slice(i, i + 300) } });
    if (c.kod !== 200) return { ok: false, metin: c.kod === 503 ? 'Sunucu güncellemesi bekleniyor.' : 'Jet Barkod\'a yazılamadı (' + c.kod + ').' };
    yazilan += r.kayitlar.slice(i, i + 300).length;
  }
  return { ok: true, metin: yazilan + ' sayım sonucu aktarıldı.', adet: yazilan };
}

/** Rapor saatleri (gün içinde dakika); 6 saatte bir sunucudan tazelenir */
async function grSaatler() {
  let v = null;
  try { v = (await chrome.storage.local.get(GR_SAATLER))[GR_SAATLER]; } catch (e) { v = null; }
  if (!v || Date.now() - (v.zaman || 0) > GR_SAAT_ARA_MS) {
    const c = await grApi('/api/gece-raporu/ayar').catch(() => null);
    if (c && c.kod === 200 && c.j && Array.isArray(c.j.saatler)) {
      v = { saatler: c.j.saatler, itiraz: Array.isArray(c.j.itirazSaatler) ? c.j.itirazSaatler : null, zaman: Date.now() };
      try { await chrome.storage.local.set({ [GR_SAATLER]: v }); } catch (e) { /* sessiz */ }
    } else if (v) {
      // Okunamadı: eldekini kullan, bir saat sonra yeniden dene
      try { await chrome.storage.local.set({ [GR_SAATLER]: { ...v, zaman: Date.now() - GR_SAAT_ARA_MS + 3600000 } }); } catch (e) { /* sessiz */ }
    }
  }
  const temiz = (x) => (Array.isArray(x) ? x.filter((n) => Number.isInteger(n) && n >= 0 && n < 1440) : []);
  const l = temiz(v && v.saatler);
  // itiraz: eski sunucu göndermiyorsa gece raporunun saatleri
  return { gece: l.length ? l : [60], itiraz: v && Array.isArray(v.itiraz) ? temiz(v.itiraz) : (l.length ? l : [60]) };
}

/** Şu an hangi rapor saatine kaç dakika var (en yakın gelecekteki) */
function grSiradaki(saatler) {
  const z = grSaat();
  const simdi = z.saat * 60 + z.dakika;
  let en = null;
  for (const s of saatler) {
    const kalan = (s - simdi + 1440) % 1440;
    if (!en || kalan < en.kalan) en = { dakika: s, kalan };
  }
  return en;
}

/** Günlük sayımın paneldeki durumu (bugün ve dün): sekme açmadan, panelin kendi oturumuyla */
async function grGunlukDurumYaz() {
  let sekmeler = [];
  try { sekmeler = await chrome.tabs.query({ url: 'https://warehouse.getir.com/r/*' }); } catch (e) { return; }
  const tab = sekmeler.filter((t) => t.status === 'complete' && !t.discarded).find((t) => /\/dashboard\//.test(t.url || ''))
    || sekmeler.find((t) => t.status === 'complete' && !t.discarded);
  if (!tab) return;
  const { gun } = grSaat();
  for (const g of [grDun(gun), gun]) {
    let c = null;
    try { c = await chrome.tabs.sendMessage(tab.id, { type: 'JBA_GUNLUK_OZET', gun: g }); } catch (e) { c = null; }
    if (!c || !c.ok || c.yok || !(c.toplam > 0)) continue;
    await grApi('/api/gece-raporu/gunluk-durum', { method: 'POST', govde: { gun: g, toplam: c.toplam, tamam: c.tamam, bitti: !!c.bitti } }).catch(() => {});
  }
}

async function grTur() {
  if (grCalisiyor) return;
  grCalisiyor = true;
  try {
    const saatler = await grSaatler();
    const sira = grSiradaki(saatler.gece);
    // Sayım sonuçları: her rapor saatinden 30-5 dk önce, o saat için bir kez
    if (sira && sira.kalan >= 5 && sira.kalan <= 30 && await grModulAcik('gunlukSayim')) {
      const anahtar = grSaat(Date.now() + sira.kalan * 60000).gun + ':' + sira.dakika;
      let son = null;
      try { son = (await chrome.storage.local.get(GR_SAYIM_SON))[GR_SAYIM_SON]; } catch (e) { son = null; }
      if (!son || son.anahtar !== anahtar || (!son.ok && Date.now() - son.zaman > 10 * 60 * 1000)) {
        await grGunlukDurumYaz().catch(() => {});
        const s = await grSayimOku().catch((e) => ({ ok: false, metin: e && e.message }));
        try { await chrome.storage.local.set({ [GR_SAYIM_SON]: { anahtar, zaman: Date.now(), ok: !!s.ok, metin: s.metin } }); } catch (e) { /* sessiz */ }
      }
    }
    // İtirazlar: 2 saatte bir; itiraz raporundan önceki 20 dakikada bir kez daha
    const itSira = saatler.itiraz.length ? grSiradaki(saatler.itiraz) : null;
    const raporOncesi = itSira && itSira.kalan <= 20;
    let son = 0;
    try { son = Number((await chrome.storage.local.get(GR_ITIRAZ_SON))[GR_ITIRAZ_SON]) || 0; } catch (e) { son = 0; }
    const zorla = raporOncesi && Date.now() - son > 15 * 60 * 1000;
    await grItirazEsitle(zorla).catch(() => {});
  } finally {
    grCalisiyor = false;
  }
}

async function grAlarmKur() {
  try {
    const var_ = await chrome.alarms.get(GR_ALARM);
    if (!var_) chrome.alarms.create(GR_ALARM, { periodInMinutes: 5, delayInMinutes: 2 });
  } catch (e) { /* sessiz */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === GR_ALARM) grTur(); });
chrome.runtime.onStartup.addListener(grAlarmKur);
chrome.runtime.onInstalled.addListener(grAlarmKur);

grAlarmKur();
