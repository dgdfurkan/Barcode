/**
 * Performans raporları: DPS ve Kurye CDI, her biri kendi saatlerinde Telegram'a
 * ============================================================================
 *
 * AYAR (Jet Barkod > Yardımcılar > Telegram Raporları > Performans)
 *   GET /api/performans/ayar 15 dakikada bir okunur: saatler, eşik, erteleme.
 *
 * AKIŞ (5 dakikada bir bakılır)
 *   Bugünün seçili saati geldiyse dünün verisi franchise panelinin kendi
 *   istekleriyle okunur (sayim-hazirligi.js'in yakaladığı jeton):
 *     GET  /wps/criteria          Depo Performans Sistemi (DPS)
 *     POST /courier/v2/metrics    Kurye Performansı (100'er; tek istek)
 *   Dünün sipariş toplamı eşiğin altındaysa veri henüz tamamlanmamıştır
 *   (yalnız gece yarısından sonraki birkaç sipariş görünür): erteleme
 *   süresi kadar sonra yeniden denenir, en çok seçilen kez. Son denemede de
 *   tamamlanmadıysa ayara göre yine gönderilir ya da o gün vazgeçilir.
 *   Jeton yoksa Getir'e istek atılmaz, aynı erteleme kuralı uygulanır.
 *   Veri Jet Barkod'a (/api/performans/gonder) bırakılır; kartları sunucu
 *   çizip Telegram'a yollar. Aynı saat iki bilgisayardan bir kez gider.
 *   Başka bir bilgisayar o saatin raporunu göndermişse (sunucu ertelemede
 *   zatenGitti döner) bu bilgisayar not atmaz, o saati bitmiş sayar.
 *
 * Getir'e giden yük: rapor başına 1 DPS + 1-2 kurye isteği; ertelemede aynısı.
 * ============================================================================
 */

const PF_ALARM = 'jba-performans';
const PF_API = 'https://api.flowcobalt.com';
const PF_GETIR = 'https://franchise-api-gateway.getirapi.com';
const PF_AYAR = 'jbaPerformansAyar';      // { pf, zaman }
const PF_DURUM = 'jbaPerformansDurum';    // { 'dps|kurye:YYYY-MM-DD:dakika': { deneme, sonraki, bitti, hata } }
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
    // 100'erli: bir depoda kurye sayısı 100'ü geçmez, liste tek istekte gelir
    for (let s = 0; s < 5; s++) {
      if (s) await new Promise((r) => setTimeout(r, 400));
      const j = await pfGetir(o, '/courier/v2/metrics', {
        startDate: gun + 'T00:00:00.000Z', endDate: gun + 'T23:59:59.999Z', courierIds: [], warehouseIds: [o.depo],
        metricGroups: PF_METRIK, vehicleTypes: [], limit: 100, offset: s * 100,
      });
      const parcaL = Array.isArray(j && j.data) ? j.data : [];
      liste.push(...parcaL);
      if (parcaL.length < 100 || liste.length >= (Number(j && j.total_count) || 0)) break;
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
  Object.keys(d).forEach((k) => { const g = (k.split(':')[1] || ''); if (!g || g < sinir) delete d[k]; });
  try { await chrome.storage.local.set({ [PF_DURUM]: d }); } catch (e) { /* sessiz */ }
}

/**
 * Her raporun (DPS, Kurye CDI) bugünkü ilk bitmemiş saati. Aynı turda ikisi
 * de gelmişse veri bir kez okunur, erteleme notu tek mesaj olur.
 */
async function pfTur() {
  if (pfCalisiyor) return;
  pfCalisiyor = true;
  try {
    const pf = await pfAyar();
    if (!pf || !pf.kontrol) return;
    const z = pfSaat();
    const durum = await pfDurumOku();
    const simdi = Date.now();
    const sirada = [];
    for (const rapor of ['dps', 'kurye']) {
      const r = pf[rapor];
      if (!r || !r.acik || !Array.isArray(r.saatler)) continue;
      const saat = r.saatler.filter((s) => Number.isInteger(s) && s <= z.dk).sort((a, b) => a - b)
        .find((s) => !(durum[rapor + ':' + z.gun + ':' + s] && durum[rapor + ':' + z.gun + ':' + s].bitti));
      if (saat == null) continue;
      const anahtar = rapor + ':' + z.gun + ':' + saat;
      const st = durum[anahtar] || { deneme: 0, sonraki: 0, hata: 0 };
      if (st.sonraki && simdi < st.sonraki) continue;
      sirada.push({ rapor, dakika: saat, anahtar, st });
    }
    if (!sirada.length) return;

    const k = pf.kontrol;
    const esik = Number(k.esik) || 0;
    const kez = Number(k.erteleme && k.erteleme.kez) || 0;
    const araDk = Number(k.erteleme && k.erteleme.dakika) || 30;
    const hedefGun = pfDun(z.gun);
    const kaydet = async () => { sirada.forEach((x) => { durum[x.anahtar] = x.st; }); await pfDurumYaz(durum); };

    /* Veri yok ya da eksik: erteleme hakkı olanlar ertelenir (tek not), olmayanlar
       ayara göre eksik gönderilir ya da o gün vazgeçilir. Dönen: gönderilecekler */
    const ertele = async (sebep, siparis, sonDenemedeGonder) => {
      const ertelenen = sirada.filter((x) => x.st.deneme < kez);
      const biten = sirada.filter((x) => x.st.deneme >= kez);
      ertelenen.forEach((x) => { x.st.deneme += 1; x.st.sonraki = Date.now() + araDk * 60000; });
      const gidecek = sonDenemedeGonder ? biten : [];
      const vazgecilen = sonDenemedeGonder ? [] : biten;
      vazgecilen.forEach((x) => { x.st.bitti = true; });
      // Sunucu başka bilgisayarın gönderdiğini bildirirse o rapor bu bilgisayarda da bitti
      const bildir = async (liste, ek) => {
        if (!liste.length) return;
        const dakikalar = {};
        liste.forEach((x) => { dakikalar[x.rapor] = x.dakika; });
        const c = await pfApi('/api/performans/ertele', { rapor: liste.length > 1 ? 'ikisi' : liste[0].rapor, gun: z.gun, dakikalar, sebep, siparis, ...ek });
        const giden = c && c.j && Array.isArray(c.j.zatenGitti) ? c.j.zatenGitti : [];
        sirada.filter((x) => giden.includes(x.rapor)).forEach((x) => { x.st.bitti = true; });
      };
      await bildir(ertelenen, { deneme: ertelenen.length ? ertelenen[0].st.deneme : 0, kez, sonrakiDk: araDk });
      await bildir(vazgecilen, { vazgecildi: true });
      await kaydet();
      return gidecek.filter((x) => !x.st.bitti);
    };

    const o = await pfOturum();
    if (!o) { await ertele('oturum', null, false); return; }

    let kurye = null;
    try {
      kurye = (await pfVeri(o, hedefGun, { dps: false, kurye: true })).kurye;
    } catch (e) {
      if (e && e.kod === 'oturum') { await ertele('oturum', null, false); return; }
      sirada.forEach((x) => { x.st.hata = (x.st.hata || 0) + 1; if (x.st.hata >= 3) x.st.bitti = true; });
      await kaydet();
      return;
    }

    const siparis = kurye.reduce((t, x) => t + (Number(x && x.order_count) || 0), 0);
    let gidecek = sirada;
    let eksik = null;
    if (esik > 0 && siparis < esik) {
      gidecek = await ertele('veri', siparis, !!k.sonDenemedeGonder);
      eksik = siparis;
      if (!gidecek.length) return;
    }

    let dps = null;
    if (gidecek.some((x) => x.rapor === 'dps')) {
      try {
        dps = (await pfVeri(o, hedefGun, { dps: true, kurye: false })).dps;
      } catch (e) {
        gidecek.filter((x) => x.rapor === 'dps').forEach((x) => { x.st.hata = (x.st.hata || 0) + 1; if (x.st.hata >= 3) x.st.bitti = true; });
        gidecek = gidecek.filter((x) => x.rapor !== 'dps');
      }
    }
    for (const x of gidecek) {
      const veri = { bas: hedefGun, son: hedefGun, ...(x.rapor === 'dps' ? { dps } : { kurye }) };
      const c = await pfApi('/api/performans/gonder', { rapor: x.rapor, veri, otomatik: { gun: z.gun, dakika: x.dakika, ...(eksik != null ? { eksik } : {}) } });
      if (c.kod === 200 || c.kod === 409 || c.kod === 400) x.st.bitti = true;
      else { x.st.hata = (x.st.hata || 0) + 1; if (x.st.hata >= 3) x.st.bitti = true; }
    }
    await kaydet();
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
