/**
 * Performans raporu: DPS ve kurye performansı, seçilen saatlerde Telegram'a
 * ============================================================================
 *
 * AYAR (Jet Barkod > Yardımcılar > Telegram Raporları > Performans)
 *   GET /api/performans/ayar 15 dakikada bir okunur: saatler, eşik, erteleme.
 *
 * AKIŞ (5 dakikada bir bakılır)
 *   Bugünün seçili saati geldiyse dünün verisi franchise panelinin kendi
 *   istekleriyle okunur (sayim-hazirligi.js'in yakaladığı jeton):
 *     GET  /wps/criteria          Depo Performans Sistemi (DPS)
 *     POST /courier/v2/metrics    Kurye Performansı (10'ar, sayfalar arası 400 ms)
 *   Dünün sipariş toplamı eşiğin altındaysa veri henüz tamamlanmamıştır
 *   (yalnız gece yarısından sonraki birkaç sipariş görünür): erteleme
 *   süresi kadar sonra yeniden denenir, en çok seçilen kez. Son denemede de
 *   tamamlanmadıysa ayara göre yine gönderilir ya da o gün vazgeçilir.
 *   Jeton yoksa Getir'e istek atılmaz, aynı erteleme kuralı uygulanır.
 *   Veri Jet Barkod'a (/api/performans/gonder) bırakılır; kartları sunucu
 *   çizip Telegram'a yollar. Aynı saat iki bilgisayardan bir kez gider.
 *
 * Getir'e giden yük: rapor başına 1 DPS + 1-2 kurye isteği; ertelemede aynısı.
 * ============================================================================
 */

const PF_ALARM = 'jba-performans';
const PF_API = 'https://api.flowcobalt.com';
const PF_GETIR = 'https://franchise-api-gateway.getirapi.com';
const PF_AYAR = 'jbaPerformansAyar';      // { pf, zaman }
const PF_DURUM = 'jbaPerformansDurum';    // { 'YYYY-MM-DD:dakika': { deneme, sonraki, bitti, hata } }
const PF_AYAR_MS = 15 * 60 * 1000;
const PF_KIMLIK = /^[0-9a-f]{24}$/;
// Panelin Kurye Performansı sayfasının istediği ölçü grupları
const PF_METRIK = ['406', '21', '403', '407', '22', '404', '111', '405', '410', '412', '520', '11', '12', '16', '112', '23', '409', '408', '25', '26', '510', '514'];

let pfCalisiyor = false;

function pfSaat(t = Date.now()) {
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
  return { gun: `${p.year}-${p.month}-${p.day}`, dk: Number(p.hour) * 60 + Number(p.minute) };
}

function pfDun(gun) {
  const d = new Date(gun + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function pfApi(yol, govde) {
  const al = globalThis.jbaYetkiAl;
  if (typeof al !== 'function') return { kod: 0, j: {} };
  let yetki = await al(false);
  if (!yetki) return { kod: 401, j: {} };
  for (let deneme = 0; deneme < 2; deneme++) {
    let r = null;
    try {
      r = await fetch(PF_API + yol, {
        method: govde ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + yetki.token },
        body: govde ? JSON.stringify(govde) : undefined,
      });
    } catch (e) { return { kod: 0, j: {} }; }
    if (r.status === 401 && deneme === 0) { yetki = await al(true); if (!yetki) return { kod: 401, j: {} }; continue; }
    let j = {};
    try { j = await r.json(); } catch (e) { /* gövde yok */ }
    return { kod: r.status, j };
  }
  return { kod: 401, j: {} };
}

async function pfAyar() {
  let v = null;
  try { v = (await chrome.storage.local.get(PF_AYAR))[PF_AYAR]; } catch (e) { v = null; }
  if (v && Date.now() - (v.zaman || 0) < PF_AYAR_MS) return v.pf;
  const c = await pfApi('/api/performans/ayar');
  if (c.kod === 200 && c.j && c.j.performans) {
    try { await chrome.storage.local.set({ [PF_AYAR]: { pf: c.j.performans, zaman: Date.now() } }); } catch (e) { /* sessiz */ }
    return c.j.performans;
  }
  // Okunamadı: eldekiyle devam, bir saat sonra yeniden sorulur
  if (v) { try { await chrome.storage.local.set({ [PF_AYAR]: { pf: v.pf, zaman: Date.now() } }); } catch (e) { /* sessiz */ } return v.pf; }
  return null;
}

function pfJwtBitis(jeton) {
  try {
    const p = String(jeton).replace(/^Bearer\s+/i, '').split('.')[1];
    const y = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    return Number.isFinite(y.exp) ? y.exp * 1000 : 0;
  } catch (e) { return 0; }
}

/** Franchise jetonu ve depo kimliği; yoksa null (istek atılmaz) */
async function pfOturum() {
  let bilgi = null;
  try { bilgi = (await chrome.storage.local.get('getir_api_info')).getir_api_info; } catch (e) { bilgi = null; }
  const jeton = bilgi && typeof bilgi.token === 'string' ? bilgi.token : '';
  if (!jeton || pfJwtBitis(jeton) < Date.now() + 60000) return null;
  let depo = bilgi && PF_KIMLIK.test(String(bilgi.warehouseId || '')) ? bilgi.warehouseId : null;
  if (!depo) { try { const v = (await chrome.storage.local.get('jbaSonDepo')).jbaSonDepo; if (PF_KIMLIK.test(String(v || ''))) depo = v; } catch (e) { /* yok */ } }
  if (!depo) return null;
  return { yetki: /^Bearer /.test(jeton) ? jeton : 'Bearer ' + jeton, depo };
}

async function pfGetir(o, yol, govde) {
  const r = await fetch(PF_GETIR + yol, {
    method: govde ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: o.yetki },
    body: govde ? JSON.stringify(govde) : undefined,
  });
  if (r.status === 401 || r.status === 403) { const h = new Error('oturum'); h.kod = 'oturum'; throw h; }
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

/** Bir günün DPS ve kurye verisi; parca: { dps, kurye } */
async function pfVeri(o, gun, parca) {
  const veri = { bas: gun, son: gun };
  if (parca.kurye) {
    const liste = [];
    for (let s = 0; s < 10; s++) {
      if (s) await new Promise((r) => setTimeout(r, 400));
      const j = await pfGetir(o, '/courier/v2/metrics', {
        startDate: gun + 'T00:00:00.000Z', endDate: gun + 'T23:59:59.999Z', courierIds: [], warehouseIds: [o.depo],
        metricGroups: PF_METRIK, vehicleTypes: [], limit: 10, offset: s * 10,
      });
      const parcaL = Array.isArray(j && j.data) ? j.data : [];
      liste.push(...parcaL);
      if (parcaL.length < 10 || liste.length >= (Number(j && j.total_count) || 0)) break;
    }
    veri.kurye = liste;
  }
  if (parca.dps) {
    if (parca.kurye) await new Promise((r) => setTimeout(r, 400));
    veri.dps = await pfGetir(o, '/wps/criteria?startDate=' + gun + '&endDate=' + gun + '&warehouseId=' + o.depo + '&isRanked=false');
  }
  return veri;
}

async function pfDurumOku() {
  try { return (await chrome.storage.local.get(PF_DURUM))[PF_DURUM] || {}; } catch (e) { return {}; }
}

async function pfDurumYaz(d) {
  // İki günden eski kayıtlar silinir
  const sinir = pfDun(pfDun(pfSaat().gun));
  Object.keys(d).forEach((k) => { if (k.slice(0, 10) < sinir) delete d[k]; });
  try { await chrome.storage.local.set({ [PF_DURUM]: d }); } catch (e) { /* sessiz */ }
}

async function pfTur() {
  if (pfCalisiyor) return;
  pfCalisiyor = true;
  try {
    const pf = await pfAyar();
    if (!pf || !pf.acik || !Array.isArray(pf.saatler) || !pf.saatler.length) return;
    const z = pfSaat();
    const durum = await pfDurumOku();
    // Bugünün geçmiş saatlerinden ilk bitmeyeni
    const dakika = pf.saatler.filter((s) => Number.isInteger(s) && s <= z.dk).sort((a, b) => a - b)
      .find((s) => !(durum[z.gun + ':' + s] && durum[z.gun + ':' + s].bitti));
    if (dakika == null) return;
    const anahtar = z.gun + ':' + dakika;
    const st = durum[anahtar] || { deneme: 0, sonraki: 0, hata: 0 };
    if (st.sonraki && Date.now() < st.sonraki) return;

    const hedefGun = pfDun(z.gun);
    const esik = Number(pf.esik) || 0;
    const kez = Number(pf.erteleme && pf.erteleme.kez) || 0;
    const araDk = Number(pf.erteleme && pf.erteleme.dakika) || 30;

    const ertele = async (sebep, siparis) => {
      if (st.deneme < kez) {
        st.deneme += 1;
        st.sonraki = Date.now() + araDk * 60000;
        durum[anahtar] = st;
        await pfDurumYaz(durum);
        await pfApi('/api/performans/ertele', { deneme: st.deneme, kez, siparis, sonrakiDk: araDk, sebep });
        return true;
      }
      return false;
    };

    const o = await pfOturum();
    if (!o) {
      if (await ertele('oturum', null)) return;
      st.bitti = true; durum[anahtar] = st; await pfDurumYaz(durum);
      await pfApi('/api/performans/ertele', { vazgecildi: true, sebep: 'oturum' });
      return;
    }

    // Önce kurye verisi (hazır mı ölçüsü); DPS yalnız gönderilecekse istenir
    let veri;
    try {
      veri = await pfVeri(o, hedefGun, { dps: false, kurye: pf.kurye || esik > 0 });
    } catch (e) {
      if (e && e.kod === 'oturum') {
        if (await ertele('oturum', null)) return;
        st.bitti = true; durum[anahtar] = st; await pfDurumYaz(durum);
        await pfApi('/api/performans/ertele', { vazgecildi: true, sebep: 'oturum' });
        return;
      }
      // Ağ ya da panel hatası: bir sonraki turda yeniden (en çok 3 kez)
      st.hata = (st.hata || 0) + 1;
      if (st.hata >= 3) st.bitti = true;
      durum[anahtar] = st; await pfDurumYaz(durum);
      return;
    }

    const siparis = (veri.kurye || []).reduce((t, k) => t + (Number(k && k.order_count) || 0), 0);
    let eksik = null;
    if (esik > 0 && siparis < esik) {
      if (await ertele('veri', siparis)) return;
      if (!pf.sonDenemedeGonder) {
        st.bitti = true; durum[anahtar] = st; await pfDurumYaz(durum);
        await pfApi('/api/performans/ertele', { vazgecildi: true, sebep: 'veri', siparis });
        return;
      }
      eksik = siparis;
    }
    if (!pf.kurye) delete veri.kurye;
    if (pf.dps) {
      try {
        const d = await pfVeri(o, hedefGun, { dps: true, kurye: false });
        veri.dps = d.dps;
      } catch (e) {
        st.hata = (st.hata || 0) + 1;
        if (st.hata >= 3) st.bitti = true;
        durum[anahtar] = st; await pfDurumYaz(durum);
        return;
      }
    }
    const c = await pfApi('/api/performans/gonder', { veri, otomatik: { gun: z.gun, dakika, ...(eksik != null ? { eksik } : {}) } });
    if (c.kod === 200 || c.kod === 409 || c.kod === 400) {
      st.bitti = true;
    } else {
      st.hata = (st.hata || 0) + 1;
      if (st.hata >= 3) st.bitti = true;
    }
    durum[anahtar] = st;
    await pfDurumYaz(durum);
  } finally {
    pfCalisiyor = false;
  }
}

async function pfAlarmKur() {
  try {
    const var_ = await chrome.alarms.get(PF_ALARM);
    if (!var_) chrome.alarms.create(PF_ALARM, { periodInMinutes: 5, delayInMinutes: 1 });
  } catch (e) { /* sessiz */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === PF_ALARM) pfTur().catch(() => {}); });
chrome.runtime.onStartup.addListener(pfAlarmKur);
chrome.runtime.onInstalled.addListener(pfAlarmKur);

pfAlarmKur();
