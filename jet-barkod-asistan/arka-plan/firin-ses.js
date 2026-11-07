/**
 * Fırın sesi: satışta, kritik stokta ve gün sonunda yüksek sesli uyarı
 * ============================================================================
 *
 * SATIŞ
 * Sipariş köprüsü yeni siparişi yazınca (firin-nobet.js jbaFirinSatis) sepette
 * fırın ürünü varsa satış sesi çalar. Taze üretim ekmek ("Ekmek (200 g)",
 * "Ramazan Pidesi (300 g)" gibi markasız gramajlılar) sayılmaz; kural pişirme
 * panelinin kendi ayrımı (moduller/firin-hesap.js isBreadProduct).
 * Fırın ürünü = fırın sayfasının listesindeki ad. Liste son kontrolde
 * (firin-uyari.js hesapla → adlar) saklanır; henüz yoksa ad ve kategoriden.
 * Peş peşe satışlarda 6 sn içinde ikinci kez çalmaz; başka ses çalarken de
 * çalmaz (sesler üst üste binmez, kritik alarm satış sesi bitince çalar).
 *
 * KRİTİK STOK ALARMI
 * Satılan ürün sonraki fırın kontrollerinde (satıştan 15 sn - 3 dk sonra)
 * pişirme bildirimine düşerse (panelin acil/kritik satırı) alarm başlar:
 * uzun ses (3/5/10 sn), 1-3 kez, seçilen aralıkla tekrar. Ürün pişirilip rafa
 * eklenince bildirimden çıkar ve alarm o ürün için biter. Bildirim kartından
 * ertelenen ya da Asistan penceresinden susturulan ürün de çalmaz. "En çok"
 * süresi seçildiyse o kadar sonra durur. Fırın bildirimi açık olmalı: karar
 * onun kontrolünden gelir; son kontrol 2 dk'dan eskiyse alarm beklemede kalır.
 *
 * GÜN SONU
 * 23:30'da "fırın ürünlerini çıkar" sesi: seçilen ses, uzunluk (3/5/10 sn) ve
 * kaç kez. Duyulmazsa 23:40/45/50'de bir daha ya da 23:35-23:55 arası 5 dk'da
 * bir. Hatırlatma yalnız rafta hâlâ fırın ürünü görünüyorsa (son gün sonu
 * kontrolü) ya da bu bilinmiyorsa çalar; raf boşalınca susar.
 *
 * Satış ve kritik sesler 08:00-23:30, hepsi yalnız depo paneli açık
 * bilgisayarda. Ses chrome.offscreen belgesinde (arayuz/ses.html) üretilir;
 * müzik çalarken de üstüne çalar. Bilgisayarın ana ses düzeyini eklenti
 * değiştiremez; ses düzeyi ayarı eklentinin kendi sesi içindir.
 * ============================================================================
 */

import '../ortak/ses-sentez.js';

const ANAHTAR = 'jbaFirinSes';
const SESLER = globalThis.JBASes.SESLER.map((x) => x.ad);
/* hatirlat: dakika (23:40/45/50), 5 = 23:35-23:55 arası 5 dk'da bir, 0 = yok */
const HER_5 = 5;
const HER_5_DAKIKALAR = [35, 40, 45, 50, 55];
const VARSAYILAN = {
    duzey: 100,
    satis: 'her', ses: 'zil', tekrar: 1,
    kritik: true, kritikSes: 'siren', kritikSure: 5, kritikTekrar: 2, kritikAralik: 30, kritikEnCok: 0,
    cikis: true, cikisSes: 'alarm', cikisSure: 5, cikisTekrar: 2, hatirlat: 50,
};
const ALARM_CIKIS = 'jba-firin-ses-cikis';
const ALARM_HATIRLAT = 'jba-firin-ses-hatirlat';
const PANEL = 'https://warehouse.getir.com/*';
const SATIS_ARA_MS = 6 * 1000;
const KRITIK_EN_ERKEN_MS = 15 * 1000;
const KRITIK_EN_GEC_MS = 3 * 60 * 1000;
const KONTROL_TAZE_MS = 2 * 60 * 1000;
const ADLAR_ANAHTARI = 'jbaFirinAdlari';
const DURUM_ANAHTARI = 'jbaFirinAlarm';
const FIRIN_URUNU = /f[ıi]r[ıi]n|unlu|simit|po[ğg]a[çc]a|b[öo]rek|kruvasan|croissant|pi[şs]i|açma|acma|kek\b|muffin|baget|pide/i;

let ayar = Object.assign({}, VARSAYILAN);
let firinAdlari = new Set();
let sonSatisSesi = 0;
let calmaBitis = 0;
let sonCikar = null; // { zaman, sayi }
let sonKontrol = 0;
/* Satılıp kararı beklenen ürünler: sade ad -> satış zamanı */
const adaylar = new Map();
/* Kritik alarmı çalan ürünler: sade ad -> { ad, bas } */
const aktif = new Map();
/* Susturulanlar: bildirimden çıkana kadar çalmaz */
const susturulan = new Set();
let sonAlarm = 0;

/* Karşılaştırma için ad: küçük harf, noktalama yok. Sipariş detayı ürünün
   kısa adını (name), fırın listesi tam adını (fullName) verebiliyor. */
const sade = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const secim = (v, liste, varsayilan) => (liste.includes(v) ? v : varsayilan);

/* Pişirme panelinin taze üretim ayrımı (firin-hesap.js isBreadProduct) */
function tazeEkmekMi(ad) {
    return /^\s*(ekmek|ramazan\s+pidesi)\s*\(\s*\d+\s*(g|gr)\s*\)\s*$/i.test(ad || '');
}

/* Fırın listesindeki karşılığı (sade ad) ya da ''. Biri ötekinin başıysa
   da sayılır: "Simit" ile "Simit 110 g" aynı ürün. */
function firinAdi(u) {
    if (!u || !u.ad || tazeEkmekMi(u.ad)) return '';
    const n = sade(u.ad);
    if (!n) return '';
    if (firinAdlari.size) {
        if (firinAdlari.has(n)) return n;
        for (const f of firinAdlari) if (n.startsWith(f + ' ') || f.startsWith(n + ' ')) return f;
        return '';
    }
    return FIRIN_URUNU.test([u.ad, u.anaKategori, u.sinif, u.altSinif].join(' ')) ? n : '';
}
const firinUrunuMu = (u) => !!firinAdi(u);

async function ayarOku() {
    try {
        const r = await chrome.storage.local.get([ANAHTAR, ADLAR_ANAHTARI]);
        const k = (r && r[ANAHTAR]) || {};
        // 0.49.0'daki "yalnız kritik stokta" satış seçeneği: satış sesi kapalı, kritik alarm açık
        const eskiKritik = k.satis === 'kritik';
        ayar = {
            duzey: Math.max(10, Math.min(100, Math.round(Number(k.duzey) || VARSAYILAN.duzey))),
            satis: eskiKritik ? 'kapali' : secim(k.satis, ['her', 'kapali'], VARSAYILAN.satis),
            ses: secim(k.ses, SESLER, VARSAYILAN.ses),
            tekrar: secim(Number(k.tekrar), [1, 2, 3], VARSAYILAN.tekrar),
            kritik: eskiKritik || (k.kritik !== undefined ? k.kritik !== false : VARSAYILAN.kritik),
            kritikSes: secim(k.kritikSes, SESLER, VARSAYILAN.kritikSes),
            kritikSure: secim(Number(k.kritikSure), [3, 5, 10], VARSAYILAN.kritikSure),
            kritikTekrar: secim(Number(k.kritikTekrar), [1, 2, 3], VARSAYILAN.kritikTekrar),
            kritikAralik: secim(Number(k.kritikAralik), [15, 30, 60, 120], VARSAYILAN.kritikAralik),
            kritikEnCok: secim(Number(k.kritikEnCok), [0, 5, 15, 30], VARSAYILAN.kritikEnCok),
            cikis: k.cikis !== false,
            cikisSes: secim(k.cikisSes, SESLER, VARSAYILAN.cikisSes),
            cikisSure: secim(Number(k.cikisSure), [3, 5, 10], VARSAYILAN.cikisSure),
            cikisTekrar: secim(Number(k.cikisTekrar), [1, 2, 3], VARSAYILAN.cikisTekrar),
            hatirlat: secim(Number(k.hatirlat), [0, 40, 45, 50, HER_5], VARSAYILAN.hatirlat),
        };
        const a = r && r[ADLAR_ANAHTARI];
        if (a && Array.isArray(a.adlar) && !firinAdlari.size) firinAdlari = new Set(a.adlar.map(sade).filter(Boolean));
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
            justification: 'Fırın satışı, kritik stok ve gün sonu bildirim sesi',
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

async function cal(ses, tekrar, sure, metin) {
    try {
        if (!(await sesBelgesi())) return false;
        const c = await chrome.runtime.sendMessage({ type: 'JBA_SES_CAL', hedef: 'ses-belgesi', ses, tekrar, sure, duzey: ayar.duzey });
        if (c && c.ok) {
            calmaBitis = Date.now() + (Number(c.sure) || 0);
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

const kisaListe = (adlar) => adlar.slice(0, 2).join(', ') + (adlar.length > 2 ? ' +' + (adlar.length - 2) : '');

// ------------------------------------------------------------------
// Satış
// ------------------------------------------------------------------

/** firin-nobet.js jbaFirinSatis çağırır: yeni siparişin ürünleri */
globalThis.jbaFirinSatisSesi = async function (urunler) {
    await ayarOku();
    if (!satisSaatiMi()) return;
    const satilan = [];
    (urunler || []).forEach((u) => {
        const k = firinAdi(u);
        if (!k) return;
        satilan.push(u.ad);
        if (ayar.kritik) adaylar.set(k, { ad: u.ad, zaman: Date.now() });
    });
    if (!satilan.length) return;
    if (ayar.satis !== 'her') return;
    if (Date.now() - sonSatisSesi < SATIS_ARA_MS) return;
    // Başka ses (uzun satış sesi, kritik alarm) çalarken üstüne binmesin
    if (Date.now() < calmaBitis) return;
    if (!(await panelAcikMi())) return;
    sonSatisSesi = Date.now();
    await cal(ayar.ses, ayar.tekrar, 0, 'Satış: ' + kisaListe(satilan));
};

/** Sipariş satırı fırın ürünü mü (firin-nobet.js kontrolü tetiklerken de bakar) */
globalThis.jbaFirinAdiMi = function (u) { return firinUrunuMu(u); };

// ------------------------------------------------------------------
// Kritik stok alarmı
// ------------------------------------------------------------------

function durumYaz() {
    const liste = [...aktif.values()].filter((x) => !susturulan.has(sade(x.ad))).map((x) => x.ad);
    chrome.storage.local.set({ [DURUM_ANAHTARI]: { zaman: Date.now(), adlar: liste } }).catch(() => {});
}

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
        if (aktif.size) { aktif.clear(); durumYaz(); }
        return;
    }
    sonKontrol = Date.now();
    // Pişirme bildirimindeki ürünler; ertelenen sayılmaz
    const kritik = new Map();
    (cevap.liste || []).forEach((u) => {
        if (u && u.ad && !u.ertelendi && !tazeEkmekMi(u.ad)) kritik.set(sade(u.ad), u.ad);
    });
    const once = aktif.size;
    // Eklendi / pişirildi / ertelendi: alarm o ürün için biter
    for (const k of [...aktif.keys()]) if (!kritik.has(k)) aktif.delete(k);
    for (const k of [...susturulan]) if (!kritik.has(k)) susturulan.delete(k);
    // Satıştan sonra kritiğe düşenler
    const simdi = Date.now();
    for (const [k, a] of [...adaylar]) {
        const gecen = simdi - a.zaman;
        if (gecen > KRITIK_EN_GEC_MS) { adaylar.delete(k); continue; }
        if (gecen < KRITIK_EN_ERKEN_MS) continue;
        if (kritik.has(k)) {
            adaylar.delete(k);
            if (!aktif.has(k)) aktif.set(k, { ad: kritik.get(k), bas: simdi });
        }
    }
    if (aktif.size !== once || once) durumYaz();
    if (aktif.size > once) sonAlarm = 0; // yeni ürün: aralığı beklemeden çal
    globalThis.jbaFirinSesNabiz();
};

let nabizCalisiyor = false;
/** Sipariş panosu nöbetçisi her 2 sn'de bir çağırır */
globalThis.jbaFirinSesNabiz = async function () {
    if (nabizCalisiyor || !aktif.size) return;
    nabizCalisiyor = true;
    try {
        await ayarOku();
        const simdi = Date.now();
        if (!ayar.kritik || !satisSaatiMi()) { aktif.clear(); durumYaz(); return; }
        // "En çok" süresi dolanlar
        if (ayar.kritikEnCok) {
            for (const [k, a] of [...aktif]) if (simdi - a.bas > ayar.kritikEnCok * 60000) { aktif.delete(k); susturulan.delete(k); }
        }
        const calacak = [...aktif.entries()].filter(([k]) => !susturulan.has(k)).map(([, a]) => a.ad);
        if (!calacak.length) return;
        if (simdi - sonKontrol > KONTROL_TAZE_MS) return; // karar bayat: fırın kontrolü dönmüyor
        if (simdi < calmaBitis) return;
        if (sonAlarm && simdi - sonAlarm < ayar.kritikAralik * 1000) return;
        if (!(await panelAcikMi())) return;
        sonAlarm = simdi;
        await cal(ayar.kritikSes, ayar.kritikTekrar, ayar.kritikSure, 'Kritik stok: ' + kisaListe(calacak));
    } finally {
        nabizCalisiyor = false;
    }
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
    const eski = await chrome.alarms.getAll().catch(() => []);
    await Promise.all((eski || []).filter((a) => a.name.startsWith(ALARM_HATIRLAT)).map((a) => chrome.alarms.clear(a.name)));
    if (!ayar.cikis) return;
    chrome.alarms.create(ALARM_CIKIS, { when: sonrakiZaman(23, 30), periodInMinutes: 1440 });
    const dakikalar = ayar.hatirlat === HER_5 ? HER_5_DAKIKALAR : ayar.hatirlat ? [ayar.hatirlat] : [];
    for (const d of dakikalar) {
        chrome.alarms.create(ALARM_HATIRLAT + '-' + d, { when: sonrakiZaman(23, d), periodInMinutes: 1440 });
    }
}

async function gunSonuSesi(hatirlatma) {
    await ayarOku();
    if (!ayar.cikis) return;
    if (hatirlatma && !ayar.hatirlat) return;
    const m = gunDakikasi();
    // Bilgisayar uykudaydı, alarm geç geldi: saati geçtiyse çalmaz
    const bas = 23 * 60 + (hatirlatma || 30);
    if (m < bas || m > bas + 4) return;
    if (!(await panelAcikMi())) return;
    if (hatirlatma && sonCikar && Date.now() - sonCikar.zaman < 2 * 60 * 1000 && sonCikar.sayi === 0) return;
    await cal(ayar.cikisSes, ayar.cikisTekrar, ayar.cikisSure, hatirlatma ? 'Hatırlatma: fırın ürünlerini çıkar' : '23:30 fırın ürünlerini çıkar');
}

chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARM_CIKIS) gunSonuSesi(false);
    else if (a.name.startsWith(ALARM_HATIRLAT + '-')) gunSonuSesi(Number(a.name.slice(ALARM_HATIRLAT.length + 1)) || 0);
});
chrome.runtime.onStartup.addListener(alarmlariKur);
chrome.runtime.onInstalled.addListener(alarmlariKur);
chrome.storage.onChanged.addListener((d, alan) => {
    if (alan === 'local' && d[ANAHTAR]) alarmlariKur();
});

// Asistan penceresi: çalan kritik alarmı sustur (ürün bildirimden çıkınca yeniden çalabilir)
chrome.runtime.onMessage.addListener((m, gonderen, cevapla) => {
    if (!m || m.type !== 'JBA_FIRIN_SES_SUSTUR') return false;
    aktif.forEach((a, k) => susturulan.add(k));
    durumYaz();
    cevapla({ ok: true });
    return false;
});

alarmlariKur();
chrome.storage.local.set({ [DURUM_ANAHTARI]: { zaman: Date.now(), adlar: [] } }).catch(() => {});
