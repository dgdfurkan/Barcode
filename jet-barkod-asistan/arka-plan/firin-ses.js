/**
 * Fırın sesi: satışta ve gün sonunda yüksek sesli uyarı
 * ============================================================================
 *
 * SATIŞ
 * Sipariş köprüsü yeni siparişi yazınca (firin-nobet.js jbaFirinSatis) sepette
 * fırın ürünü varsa ses çalar. Taze üretim ekmek ("Ekmek (200 g)", "Ramazan
 * Pidesi (300 g)" gibi markasız gramajlılar) sayılmaz; kural pişirme panelinin
 * kendi ayrımı (moduller/firin-hesap.js isBreadProduct).
 * Fırın ürünü = fırın sayfasının listesindeki ad. Liste son kontrolde
 * (firin-uyari.js hesapla → adlar) saklanır; henüz yoksa ad ve kategoriden.
 *   her     her fırın satışında
 *   kritik  satılan ürün pişirme bildirimine düşerse (panelin acil/kritik
 *           satırı). Satıştan sonraki ilk fırın kontrolüne bakılır; fırın
 *           bildirimi kapalıysa kontrol olmadığı için çalmaz.
 *   kapali
 * Yalnız 08:00-23:30. Peş peşe satışlarda 6 sn içinde ikinci kez çalmaz.
 *
 * GÜN SONU
 * 23:30'da "fırın ürünlerini çıkar" sesi; seçilirse 23:40/45/50'de bir daha.
 * Hatırlatma yalnız rafta hâlâ fırın ürünü görünüyorsa (son gün sonu
 * kontrolü) ya da bu bilinmiyorsa çalar.
 *
 * Her iki ses de yalnız bu bilgisayarda depo paneli açıkken çalar (evdeki
 * bilgisayar ötmesin). Ses chrome.offscreen belgesinde (arayuz/ses.html)
 * üretilir; müzik çalarken de üstüne çalar. Bilgisayarın ana ses düzeyini
 * eklenti değiştiremez.
 * ============================================================================
 */

const ANAHTAR = 'jbaFirinSes';
const VARSAYILAN = { satis: 'her', ses: 'zil', tekrar: 1, cikis: true, cikisSes: 'alarm', hatirlat: 50 };
const SESLER = ['zil', 'can', 'melodi', 'kampana', 'alarm'];
const ALARM_CIKIS = 'jba-firin-ses-cikis';
const ALARM_HATIRLAT = 'jba-firin-ses-hatirlat';
const PANEL = 'https://warehouse.getir.com/*';
const SATIS_ARA_MS = 6 * 1000;
const KRITIK_EN_ERKEN_MS = 15 * 1000;
const KRITIK_EN_GEC_MS = 3 * 60 * 1000;
const ADLAR_ANAHTARI = 'jbaFirinAdlari';
const FIRIN_URUNU = /f[ıi]r[ıi]n|unlu|simit|po[ğg]a[çc]a|b[öo]rek|kruvasan|croissant|pi[şs]i|açma|acma|kek\b|muffin|baget|pide/i;

let ayar = Object.assign({}, VARSAYILAN);
let firinAdlari = new Set();
let sonSatisSesi = 0;
let kritikBekleyen = null; // { zaman, adlar: Set }
let sonCikar = null; // { zaman, sayi }

const sade = (s) => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

/* Pişirme panelinin taze üretim ayrımı (firin-hesap.js isBreadProduct) */
function tazeEkmekMi(ad) {
    return /^\s*(ekmek|ramazan\s+pidesi)\s*\(\s*\d+\s*(g|gr)\s*\)\s*$/i.test(ad || '');
}

function firinUrunuMu(u) {
    if (!u || !u.ad || tazeEkmekMi(u.ad)) return false;
    if (firinAdlari.size) return firinAdlari.has(sade(u.ad));
    return FIRIN_URUNU.test([u.ad, u.anaKategori, u.sinif, u.altSinif].join(' '));
}

async function ayarOku() {
    try {
        const r = await chrome.storage.local.get([ANAHTAR, ADLAR_ANAHTARI]);
        const k = (r && r[ANAHTAR]) || {};
        ayar = {
            satis: ['her', 'kritik', 'kapali'].includes(k.satis) ? k.satis : VARSAYILAN.satis,
            ses: SESLER.includes(k.ses) ? k.ses : VARSAYILAN.ses,
            tekrar: k.tekrar === 3 ? 3 : 1,
            cikis: k.cikis !== false,
            cikisSes: SESLER.includes(k.cikisSes) ? k.cikisSes : VARSAYILAN.cikisSes,
            hatirlat: [0, 40, 45, 50].includes(k.hatirlat) ? k.hatirlat : VARSAYILAN.hatirlat,
        };
        const a = r && r[ADLAR_ANAHTARI];
        if (a && Array.isArray(a.adlar) && !firinAdlari.size) firinAdlari = new Set(a.adlar);
    } catch (e) {
        ayar = Object.assign({}, VARSAYILAN);
    }
    return ayar;
}

// ------------------------------------------------------------------
// Çalma
// ------------------------------------------------------------------

let belgeSozu = null;
async function sesBelgesi() {
    if (!chrome.offscreen) return false;
    try {
        const var_ = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
        if (var_.length) return true;
    } catch (e) { /* eski Chrome: oluşturmayı dene */ }
    if (!belgeSozu) {
        belgeSozu = chrome.offscreen.createDocument({
            url: 'arayuz/ses.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Fırın satışı ve gün sonu bildirim sesi',
        }).catch((e) => {
            if (!/single offscreen|already/i.test(String(e && e.message))) throw e;
        });
    }
    const s = belgeSozu;
    try { await s; } finally { if (belgeSozu === s) belgeSozu = null; }
    return true;
}

async function panelAcikMi() {
    try { return (await chrome.tabs.query({ url: PANEL })).length > 0; } catch (e) { return false; }
}

async function cal(ses, tekrar, metin) {
    try {
        if (!(await sesBelgesi())) return false;
        const c = await chrome.runtime.sendMessage({ type: 'JBA_SES_CAL', hedef: 'ses-belgesi', ses, tekrar });
        if (c && c.ok) {
            chrome.storage.local.set({ jbaFirinSesSon: { zaman: Date.now(), metin } }).catch(() => {});
            return true;
        }
    } catch (e) {
        console.warn('Fırın sesi çalınamadı:', e && e.message);
    }
    return false;
}

/** Dakika cinsinden saat (yerel) */
function gunDakikasi(d = new Date()) {
    return d.getHours() * 60 + d.getMinutes();
}

const satisSaatiMi = () => { const m = gunDakikasi(); return m >= 8 * 60 && m < 23 * 60 + 30; };

// ------------------------------------------------------------------
// Satış
// ------------------------------------------------------------------

/** firin-nobet.js jbaFirinSatis çağırır: yeni siparişin ürünleri */
globalThis.jbaFirinSatisSesi = async function (urunler) {
    await ayarOku();
    if (ayar.satis === 'kapali' || !satisSaatiMi()) return;
    const satilan = (urunler || []).filter(firinUrunuMu).map((u) => u.ad);
    if (!satilan.length) return;
    if (ayar.satis === 'kritik') {
        // Satış panelin stoğuna birkaç saniyede düşer: sonraki fırın kontrolü karar verir
        const eski = kritikBekleyen && Date.now() - kritikBekleyen.zaman < KRITIK_EN_GEC_MS ? kritikBekleyen.adlar : new Set();
        satilan.forEach((a) => eski.add(sade(a)));
        kritikBekleyen = { zaman: Date.now(), adlar: eski };
        return;
    }
    if (Date.now() - sonSatisSesi < SATIS_ARA_MS) return;
    if (!(await panelAcikMi())) return;
    sonSatisSesi = Date.now();
    await cal(ayar.ses, ayar.tekrar, 'Satış: ' + satilan.slice(0, 2).join(', ') + (satilan.length > 2 ? ' +' + (satilan.length - 2) : ''));
};

/** Sipariş satırı fırın ürünü mü (firin-nobet.js kontrolü tetiklerken de bakar) */
globalThis.jbaFirinAdiMi = function (u) { return firinUrunuMu(u); };

/** firin-nobet.js her başarılı kontrolden sonra çağırır */
globalThis.jbaFirinKontrolSonucu = function (cevap, mod) {
    if (!cevap) return;
    if (Array.isArray(cevap.adlar) && cevap.adlar.length) {
        const yeni = new Set(cevap.adlar.map(sade));
        if (yeni.size !== firinAdlari.size || [...yeni].some((a) => !firinAdlari.has(a))) {
            firinAdlari = yeni;
            chrome.storage.local.set({ [ADLAR_ANAHTARI]: { zaman: Date.now(), adlar: [...yeni] } }).catch(() => {});
        }
    }
    if (mod === 'cikar') {
        const n = typeof cevap.gorunenSayisi === 'number' ? cevap.gorunenSayisi : (cevap.liste || []).length;
        sonCikar = { zaman: Date.now(), sayi: n };
        return;
    }
    const k = kritikBekleyen;
    if (!k) return;
    const gecen = Date.now() - k.zaman;
    if (gecen < KRITIK_EN_ERKEN_MS) return;
    kritikBekleyen = null;
    if (gecen > KRITIK_EN_GEC_MS || ayar.satis !== 'kritik' || !satisSaatiMi()) return;
    const kritik = (cevap.liste || []).filter((u) => u && k.adlar.has(sade(u.ad))).map((u) => u.ad);
    if (!kritik.length) return;
    sonSatisSesi = Date.now();
    cal(ayar.ses, ayar.tekrar, 'Kritik stok: ' + kritik.slice(0, 2).join(', ') + (kritik.length > 2 ? ' +' + (kritik.length - 2) : ''));
};

// ------------------------------------------------------------------
// Gün sonu: 23:30 ve hatırlatma
// ------------------------------------------------------------------

function sonrakiZaman(saat, dakika) {
    const d = new Date();
    d.setHours(saat, dakika, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
}

async function alarmlariKur() {
    await ayarOku();
    await chrome.alarms.clear(ALARM_CIKIS);
    await chrome.alarms.clear(ALARM_HATIRLAT);
    if (!ayar.cikis) return;
    chrome.alarms.create(ALARM_CIKIS, { when: sonrakiZaman(23, 30), periodInMinutes: 1440 });
    if (ayar.hatirlat) chrome.alarms.create(ALARM_HATIRLAT, { when: sonrakiZaman(23, ayar.hatirlat), periodInMinutes: 1440 });
}

async function gunSonuSesi(hatirlatma) {
    await ayarOku();
    if (!ayar.cikis) return;
    const m = gunDakikasi();
    // Bilgisayar uykudaydı, alarm geç geldi: saati geçtiyse çalmaz
    const bas = hatirlatma ? 23 * 60 + ayar.hatirlat : 23 * 60 + 30;
    if (m < bas || m > bas + 5) return;
    if (!(await panelAcikMi())) return;
    if (hatirlatma && sonCikar && Date.now() - sonCikar.zaman < 2 * 60 * 1000 && sonCikar.sayi === 0) return;
    await cal(ayar.cikisSes, 3, hatirlatma ? 'Hatırlatma: fırın ürünlerini çıkar' : '23:30 fırın ürünlerini çıkar');
}

chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM_CIKIS) gunSonuSesi(false);
    else if (a.name === ALARM_HATIRLAT) gunSonuSesi(true);
});
chrome.runtime.onStartup.addListener(alarmlariKur);
chrome.runtime.onInstalled.addListener(alarmlariKur);
chrome.storage.onChanged.addListener((d, alan) => {
    if (alan === 'local' && d[ANAHTAR]) alarmlariKur();
});

alarmlariKur();
