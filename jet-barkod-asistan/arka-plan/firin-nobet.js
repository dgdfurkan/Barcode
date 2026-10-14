/**
 * Fırın nöbetçisi: pişirilmesi gereken ürün varsa kontrol panelinde bildirim
 * ============================================================================
 *
 * SORUN
 * Pişirme bazen atlanıyor: fırın sayfasına gidip panele bakmak gerekiyor.
 *
 * ÇÖZÜM
 * Kontrol panelinin siparişler ekranı açıkken, belli aralıklarla (varsayılan
 * 3 dk, Asistan simgesinden ayarlanır) fırın sayfası öne çıkmayan bir sekmede
 * açılıyor; pişirme paneli her zamanki hesabıyla çalışıyor
 * (moduller/firin-pisirme.js `JBA_FIRIN_OKU`), sonuç alınıp sekme kapanıyor.
 *
 * Bildirim yalnız şu ürünler için:
 *   - şu anki saat diliminde pişirme önerisi var,
 *   - rafta hiç yok ya da öneriye göre çok az (raf × 5 ≤ öneri; öneri 10, raf 1),
 *   - donukta var (donukta yoksa pişirilemez, göstermeye gerek yok),
 *   - taze üretim ekmek değil (o donuktan pişmiyor).
 * Pişirme yapılınca sonraki kontrolde liste boşalır, bildirim kapanır.
 *
 * GETİR'İ YORMAMA
 *   - Yalnız siparişler ekranı açıkken; iki kontrol arası en az 1 dk.
 *   - Uyarı yoksa, fırın ürünü satılmadıysa ve saat dilimi değişmediyse
 *     dönem atlanıyor; en geç 15 dk'da bir yine bakılıyor.
 *   - Fırın sayfası panelin kendi isteğiyle okunuyor; ek istek yok.
 *   - Okuma başarısızsa (oturum yok vb.) 10 dk beklenir.
 * ============================================================================
 */

const AYAR_ANAHTARI = 'jbaFirinNobet';
const VARSAYILAN = { acik: true, dk: 3 };
const ALARM = 'jba-firin-nobet';
const PANO = 'https://warehouse.getir.com/r/*/dashboard/orders*';
const EN_AZ_ARA_MS = 60 * 1000;
const EN_GEC_MS = 15 * 60 * 1000;
const HATA_BEKLEME_MS = 10 * 60 * 1000;
const SATIS_GECIKMESI_MS = 45 * 1000;
const FIRIN_URUNU = /f[ıi]r[ıi]n|unlu|simit|po[ğg]a[çc]a|b[öo]rek|kruvasan|croissant|pi[şs]i|açma|acma|kek\b|muffin|ekmek|baget|pide/i;

let calisiyor = false;
let sonKontrol = 0;
let sonDilim = -1;
let sonHata = 0;
let satisOldu = false;
let aktifUyari = false;
let satisZamanlayici = null;

function bekle(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function ayarOku() {
    try {
        const r = await chrome.storage.local.get(AYAR_ANAHTARI);
        return Object.assign({}, VARSAYILAN, r && r[AYAR_ANAHTARI]);
    } catch (e) {
        return Object.assign({}, VARSAYILAN);
    }
}

async function alarmKur() {
    const a = await ayarOku();
    await chrome.alarms.clear(ALARM);
    if (!a.acik) return;
    const dk = Math.max(1, Math.min(30, Number(a.dk) || 3));
    chrome.alarms.create(ALARM, { periodInMinutes: dk });
}

function dilim(saat) {
    if (saat < 12) return 0;
    if (saat < 16) return 1;
    if (saat < 20) return 2;
    return 3;
}

function ekmekMi(ad) {
    return /^\s*(ekmek|ramazan\s+pidesi)\s*\(\s*\d+\s*(g|gr)\s*\)\s*$/i.test(ad || '');
}

/** Bildirimde gösterilecek ürünler: önerisi var, rafta yok ya da çok az, donukta var */
function uyarilar(urunler, saat) {
    const d = dilim(saat);
    return (urunler || [])
        .filter((u) => u && u.stokOkundu !== false && !ekmekMi(u.ad))
        .map((u) => ({ ad: u.ad, gorsel: u.gorsel, raf: u.raf, donuk: u.donuk, oneri: Number(u.oneriler && u.oneriler[d]) || 0 }))
        .filter((u) => u.oneri > 0 && u.donuk > 0 && (u.raf <= 0 || u.raf * 5 <= u.oneri))
        .sort((a, b) => (a.raf - b.raf) || (b.oneri - a.oneri))
        .slice(0, 12);
}

async function panolar() {
    try { return await chrome.tabs.query({ url: PANO }); } catch (e) { return []; }
}

async function yay(sekmeler, liste, saat) {
    aktifUyari = liste.length > 0;
    for (const t of sekmeler) {
        chrome.tabs.sendMessage(t.id, { type: 'JBA_FIRIN_UYARI', liste, saat, zaman: Date.now() }).catch(() => {});
    }
}

/** Sekme yüklenip fırın modülü cevap verene kadar sorar */
async function okut(tabId) {
    const sinir = Date.now() + 75000;
    while (Date.now() < sinir) {
        let tab = null;
        try { tab = await chrome.tabs.get(tabId); } catch (e) { return null; }
        const url = tab.url || tab.pendingUrl || '';
        // Oturum düşmüş: giriş ekranında kaldı
        if (/stockid\.getirapi\.com/.test(url) && !/prompt=none/.test(url) && tab.status === 'complete') return null;
        if (tab.status === 'complete' && /bakery-estimation/.test(url)) {
            try {
                const cevap = await chrome.tabs.sendMessage(tabId, { type: 'JBA_FIRIN_OKU' });
                if (cevap) return cevap;
            } catch (e) { /* betik henüz yüklenmedi */ }
        }
        await bekle(1000);
    }
    return null;
}

async function kontrol(sebep) {
    if (calisiyor) return;
    const ayar = await ayarOku();
    if (!ayar.acik) return;
    // Modül hesabında kapalıysa (fırın hakkı yok) hiç bakılmaz
    try {
        const r = await chrome.storage.local.get('jbaAcikModuller');
        const l = r && r.jbaAcikModuller;
        if (Array.isArray(l) && l.indexOf('firinUyari') === -1) return;
    } catch (e) { /* liste yoksa açık say */ }
    const sekmeler = await panolar();
    if (!sekmeler.length) return;

    const simdi = Date.now();
    if (simdi - sonKontrol < EN_AZ_ARA_MS) return;
    if (simdi - sonHata < HATA_BEKLEME_MS) return;
    // Gereksiz kontrolü atla: uyarı yok, satış yok, dilim aynı, 15 dk dolmadı
    const d = dilim(new Date().getHours());
    if (sebep === 'periyot' && !aktifUyari && !satisOldu && d === sonDilim && simdi - sonKontrol < EN_GEC_MS) return;

    const m = /\/r\/([a-f0-9]{24})\//.exec(sekmeler[0].url || '');
    if (!m) return;

    calisiyor = true;
    sonKontrol = simdi;
    satisOldu = false;
    let tabId = null;
    try {
        const tab = await chrome.tabs.create({
            url: `https://warehouse.getir.com/r/${m[1]}/stock/stock-management/product/bakery-estimation/list`,
            active: false,
            windowId: sekmeler[0].windowId,
        });
        tabId = tab.id;
        const cevap = await okut(tabId);
        if (!cevap || !cevap.ok) { sonHata = Date.now(); return; }
        sonDilim = dilim(cevap.saat);
        await yay(await panolar(), uyarilar(cevap.urunler, cevap.saat), cevap.saat);
    } catch (e) {
        sonHata = Date.now();
    } finally {
        if (tabId) chrome.tabs.remove(tabId).catch(() => {});
        calisiyor = false;
    }
}

/** Sipariş köprüsü yeni sipariş yazınca çağırır: fırın ürünü satıldıysa kısa süre sonra bak */
globalThis.jbaFirinSatis = function (urunler) {
    const firinVar = (urunler || []).some((u) => u && FIRIN_URUNU.test([u.ad, u.anaKategori, u.sinif, u.altSinif].join(' ')));
    if (!firinVar) return;
    satisOldu = true;
    clearTimeout(satisZamanlayici);
    satisZamanlayici = setTimeout(() => kontrol('satis'), SATIS_GECIKMESI_MS);
};

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) kontrol('periyot'); });
chrome.runtime.onStartup.addListener(alarmKur);
chrome.runtime.onInstalled.addListener(alarmKur);
chrome.storage.onChanged.addListener((d, alan) => {
    if (alan === 'local' && d[AYAR_ANAHTARI]) {
        alarmKur();
        ayarOku().then((a) => { if (!a.acik) panolar().then((s) => yay(s, [], new Date().getHours())); });
    }
});

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek) return false;
    // Kontrol paneli açıldı: biraz sonra bir kez bak
    if (istek.type === 'JBA_FIRIN_PANO_HAZIR') {
        setTimeout(() => kontrol('pano'), 20000);
        return false;
    }
    // Bildirimdeki "Fırın Sayfasını Aç"
    if (istek.type === 'JBA_FIRIN_AC' && gonderen && gonderen.tab) {
        const m = /\/r\/([a-f0-9]{24})\//.exec(gonderen.tab.url || '');
        if (m) chrome.tabs.create({ url: `https://warehouse.getir.com/r/${m[1]}/stock/stock-management/product/bakery-estimation/list`, active: true, windowId: gonderen.tab.windowId });
        return false;
    }
    return false;
});

alarmKur();
