/**
 * Gece raporu için veri tazeliği (rapor sunucuda, 01:00'de Telegram'a)
 * ============================================================================
 *
 * İTİRAZLAR (2 saatte bir, ayrıca 00:40'ta)
 *   Franchise oturumu (sayim-hazirligi.js'in yakaladığı jeton) geçerliyse
 *   Depo Değerlendirme listesi son 30 gün için okunur, Jet Barkod'a
 *   (/api/itiraz/kayitlar) yazılır. Panelin kendi isteği; 1-2 sayfa.
 *   Böylece rapor İtiraz Yazıcı sayfası açılmadan da güncel olur.
 *
 * SAYIM SONUÇLARI (00:30-00:55, günde bir)
 *   Depo paneli açık bilgisayarda dün ve bugünün tamamlanmış sayımları
 *   Sayım Geçmişi'nin yöntemiyle okunur (öne çıkmayan sekme, iş bitince
 *   kapanır) ve /api/sayim-gecmisi/yaz ile bırakılır.
 *
 * ASİSTAN PENCERESİ
 *   JBA_GECE_AYAR (oku/yaz) ve JBA_GECE_SIMDI (raporu şimdi gönder).
 * ============================================================================
 */

const GR_ALARM = 'jba-gece-raporu';
const GR_API = 'https://api.flowcobalt.com';
const GR_DDS = 'https://franchise-api-gateway.getirapi.com/dds100/logs/filter';
const GR_ITIRAZ_SON = 'jbaItirazEsitlemeSon';
const GR_SAYIM_SON = 'jbaGeceSayimSon';     // { gun, zaman, adet, ok }
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
  };
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
  for (let i = 0; i < kayitlar.length; i += 60) {
    const c = await grApi('/api/itiraz/kayitlar', { method: 'POST', govde: { kayitlar: kayitlar.slice(i, i + 60) } });
    if (c.kod !== 200) return { ok: false, metin: 'Jet Barkod\'a yazılamadı (' + c.kod + ').' };
  }
  try { await chrome.storage.local.set({ [GR_ITIRAZ_SON]: Date.now() }); } catch (e) { /* sessiz */ }
  return { ok: true, metin: kayitlar.length + ' itiraz kaydı eşitlendi.' };
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

async function grTur() {
  if (grCalisiyor) return;
  grCalisiyor = true;
  try {
    const z = grSaat();
    // Sayım sonuçları: 00:30-00:55, günde bir (rapor 01:00'de)
    if (z.saat === 0 && z.dakika >= 30 && z.dakika < 56 && await grModulAcik('gunlukSayim')) {
      let son = null;
      try { son = (await chrome.storage.local.get(GR_SAYIM_SON))[GR_SAYIM_SON]; } catch (e) { son = null; }
      if (!son || son.gun !== z.gun || (!son.ok && Date.now() - son.zaman > 10 * 60 * 1000)) {
        const s = await grSayimOku().catch((e) => ({ ok: false, metin: e && e.message }));
        try { await chrome.storage.local.set({ [GR_SAYIM_SON]: { gun: z.gun, zaman: Date.now(), ok: !!s.ok, metin: s.metin } }); } catch (e) { /* sessiz */ }
      }
    }
    // İtirazlar: 2 saatte bir; 00:40'tan sonra rapordan önce bir kez daha
    const geceOncesi = z.saat === 0 && z.dakika >= 40;
    let son = 0;
    try { son = Number((await chrome.storage.local.get(GR_ITIRAZ_SON))[GR_ITIRAZ_SON]) || 0; } catch (e) { son = 0; }
    const bugun0040 = geceOncesi && Date.now() - son > 15 * 60 * 1000;
    await grItirazEsitle(bugun0040).catch(() => {});
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

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
  if (!istek || typeof istek.type !== 'string') return false;
  if (istek.type === 'JBA_GECE_AYAR') {
    const govde = {};
    ['acik', 'bekleyen', 'foto'].forEach((k) => { if (typeof istek[k] === 'boolean') govde[k] = istek[k]; });
    const yaz = Object.keys(govde).length > 0;
    grApi('/api/gece-raporu/ayar', yaz ? { method: 'POST', govde } : {})
      .then((c) => cevapla(c.kod === 200 ? { ok: true, ...c.j } : { ok: false, kod: c.kod, hata: c.j && c.j.error }))
      .catch(() => cevapla({ ok: false }));
    return true;
  }
  if (istek.type === 'JBA_GECE_SIMDI') {
    (async () => {
      // Önce veriyi tazele: itirazlar hemen, sayımlar panel açıksa
      await grItirazEsitle(true).catch(() => {});
      const c = await grApi('/api/gece-raporu/simdi', { method: 'POST', govde: {} });
      if (c.kod === 200) return { ok: true, metin: c.j.kart + ' kart Telegram\'a gönderildi.' };
      const h = c.j && c.j.error;
      return {
        ok: false,
        metin: h === 'baglanti_yok' ? 'Telegram bağlı değil. Sayım raporundan bir kez bağla.'
          : h === 'cok_sik' ? '2 dakika sonra tekrar dene.'
          : h === 'bot_hazir_degil' ? 'Telegram botu hazır değil.'
          : c.kod === 404 || c.kod === 503 ? 'Sunucu güncellemesi bekleniyor.'
          : 'Gönderilemedi (' + c.kod + ').',
      };
    })().then(cevapla, () => cevapla({ ok: false, metin: 'Gönderilemedi.' }));
    return true;
  }
  return false;
});

grAlarmKur();
