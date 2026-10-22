/**
 * Satıştan Kaldırma nöbetçisi: depo panelindeki listeyi saatte bir aktarır
 * ============================================================================
 *
 * Depo panelinin herhangi bir sekmesi açıksa, saatte bir oradaki modüle
 * (moduller/kaldirma.js) `JBA_KALDIRMA_SOR` gider. Sayfa köprüsü panelin
 * "Satıştan Kaldırma Listesi" isteğini panelin kendi başlıklarıyla atar
 * (son 14 gün, fırın çıkışları hariç). Kayıtlar Jet Barkod API'sine
 * (/api/kaldirma/yaz) 150'şerli parçalarla yazılır; durumu İptal Edildi'ye
 * dönen kaydı sunucu Telegram'a bildirir.
 *
 * NE ZAMAN
 *   - 10 dakikada bir hızlı tur: yalnız son 2 gün (tek liste isteği). Panelin
 *     hasar fotoğrafı linkleri ~15 dk geçerli; son kayıtların fotoğrafı
 *     sitede böylece hep açılır. Detay isteği yalnız yeni ya da durumu
 *     değişen kayıtlar için.
 *   - Saatte bir tam tur (son 14 gün). Panel açılınca, son aktarım bir
 *     saatten eskiyse birkaç saniye sonra bir kez.
 *   - Jet Barkod'daki Satıştan Kaldırma sayfasında "Şimdi Güncelle"
 *     (en az 2 dk arayla).
 * Getir'e giden istek: 14 günlük liste, sayfa başına 100 kayıt, sayfalar
 * arası 350 ms. Saatte bir.
 * ============================================================================
 */

const KALDIRMA_ALARM = 'jba-kaldirma-10';
const KALDIRMA_ESKI_ALARM = 'jba-kaldirma';
const KALDIRMA_SON_TAM = 'jbaKaldirmaSonTam';
const KALDIRMA_HIZLI_GUN = 2;
const KALDIRMA_HIZLI_ARA_MS = 9 * 60 * 1000;
const KALDIRMA_API = 'https://api.flowcobalt.com/api/kaldirma/yaz';
const KALDIRMA_DURUM = 'jbaKaldirmaDurum';
const KALDIRMA_SON = 'jbaKaldirmaSon';
const KALDIRMA_ARALIK_MS = 60 * 60 * 1000;
const KALDIRMA_ELLE_ARA_MS = 2 * 60 * 1000;
const KALDIRMA_PARCA = 150;
const KALDIRMA_AZAMI_BAYT = 180 * 1024;
const KALDIRMA_GUN = 14;

let kaldirmaCalisiyor = false;
let kaldirmaSonDeneme = 0;

function kaldirmaDurumYaz(ok, metin) {
    chrome.storage.local.set({ [KALDIRMA_DURUM]: { ok: !!ok, metin, zaman: Date.now() } }).catch(() => {});
}

async function kaldirmaHakVar() {
    try {
        const r = await chrome.storage.local.get('jbaAcikModuller');
        const l = r && r.jbaAcikModuller;
        return !Array.isArray(l) || l.indexOf('kaldirma') !== -1;
    } catch (e) { return true; }
}

async function kaldirmaSekmesi() {
    let sekmeler = [];
    try { sekmeler = await chrome.tabs.query({ url: 'https://warehouse.getir.com/r/*' }); } catch (e) { return null; }
    const hazir = sekmeler.filter((t) => t.status === 'complete' && !t.discarded);
    return hazir.find((t) => t.active) || hazir.find((t) => /\/dashboard\//.test(t.url || '')) || hazir[0] || null;
}

async function kaldirmaYaz(kayitlar) {
    const al = globalThis.jbaYetkiAl;
    if (typeof al !== 'function') return { ok: false, metin: 'Oturum okunamadı.' };
    let yetki = await al(false);
    if (!yetki) return { ok: false, metin: 'Jet Barkod oturumu yok; siteye bir kez girin.' };
    let bildirilecek = 0;
    // Parçalar hem sayıyla hem boyutla sınırlı: hasar fotoğrafı adresleri uzun,
    // sunucu gövdesi 256 KB
    const parcalar = [];
    let parca0 = [];
    let boy = 0;
    kayitlar.forEach((k) => {
        const b = JSON.stringify(k).length;
        if (parca0.length && (parca0.length >= KALDIRMA_PARCA || boy + b > KALDIRMA_AZAMI_BAYT)) { parcalar.push(parca0); parca0 = []; boy = 0; }
        parca0.push(k);
        boy += b;
    });
    parcalar.push(parca0);
    for (let i = 0; i < parcalar.length; i++) {
        const parca = parcalar[i];
        let r = null;
        for (let deneme = 0; deneme < 2; deneme++) {
            try {
                r = await fetch(KALDIRMA_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + yetki.token },
                    body: JSON.stringify({ kayitlar: parca })
                });
            } catch (e) {
                r = null;
            }
            if (r && r.status === 401 && deneme === 0) {
                yetki = await al(true);
                if (!yetki) return { ok: false, metin: 'Jet Barkod oturumu doldu; siteye bir kez girin.' };
                continue;
            }
            break;
        }
        if (!r) return { ok: false, metin: 'Jet Barkod sunucusuna ulaşılamadı.' };
        let j = null;
        try { j = await r.json(); } catch (e) { /* gövde yok */ }
        if (r.status === 503 && j && j.error === 'kurulum_bekleniyor') return { ok: false, metin: 'Sunucu güncellemesi bekleniyor.' };
        if (r.status === 404) return { ok: false, metin: 'Sunucu güncellemesi bekleniyor.' };
        if (!r.ok) return { ok: false, metin: 'Sunucu hatası (' + r.status + ').' };
        bildirilecek += (j && j.bildirilecek) || 0;
        if (i + 1 < parcalar.length) await new Promise((x) => setTimeout(x, 300));
    }
    return { ok: true, bildirilecek };
}

/** sebep: 'periyot' | 'pano' | 'elle' */
async function kaldirmaCalistir(sebep) {
    if (kaldirmaCalisiyor) return { ok: false, metin: 'Aktarım zaten sürüyor.' };
    if (!(await kaldirmaHakVar())) return { ok: false, metin: 'Satıştan Kaldırma bu hesapta kapalı.' };
    const simdi = Date.now();
    if (sebep === 'elle' && simdi - kaldirmaSonDeneme < KALDIRMA_ELLE_ARA_MS) {
        return { ok: false, metin: 'Az önce güncellendi; biraz sonra tekrar deneyin.' };
    }
    // Tam tur (14 gün) saatte bir ve elle; arada 10 dakikada bir hızlı tur (2 gün)
    let gun = KALDIRMA_GUN;
    let tam = true;
    if (sebep !== 'elle') {
        try {
            const r = await chrome.storage.local.get([KALDIRMA_SON, KALDIRMA_SON_TAM]);
            const son = Number(r && r[KALDIRMA_SON]) || 0;
            const sonTam = Number(r && r[KALDIRMA_SON_TAM]) || 0;
            if (simdi - son < KALDIRMA_HIZLI_ARA_MS) return { ok: true, metin: 'Güncel.' };
            if (simdi - sonTam < KALDIRMA_ARALIK_MS - 5 * 60 * 1000) { gun = KALDIRMA_HIZLI_GUN; tam = false; }
        } catch (e) { /* okunamadı: tam tur */ }
    }
    const sekme = await kaldirmaSekmesi();
    if (!sekme) {
        const m = { ok: false, metin: 'Depo paneli açık değil.' };
        if (sebep === 'elle') kaldirmaDurumYaz(false, m.metin);
        return m;
    }

    kaldirmaCalisiyor = true;
    kaldirmaSonDeneme = simdi;
    try {
        let cevap = null;
        try { cevap = await chrome.tabs.sendMessage(sekme.id, { type: 'JBA_KALDIRMA_SOR', gun }); } catch (e) { cevap = null; }
        if (!cevap || !cevap.ok) {
            const s = cevap && cevap.sebep;
            const metin = s === 'oturum' ? 'Depo paneli oturumu bekleniyor; paneli bir kez yenileyin.'
                : s === 'kapalı' ? 'Satıştan Kaldırma bu sekmede kapalı.'
                : s ? 'Liste okunamadı (' + s + ').' : 'Depo paneli sekmesi cevap vermedi; sekmeyi yenileyin.';
            kaldirmaDurumYaz(false, metin);
            return { ok: false, metin };
        }
        const yazma = await kaldirmaYaz(cevap.kayitlar || []);
        if (!yazma.ok) { kaldirmaDurumYaz(false, yazma.metin); return yazma; }
        await chrome.storage.local.set(tam ? { [KALDIRMA_SON]: Date.now(), [KALDIRMA_SON_TAM]: Date.now() } : { [KALDIRMA_SON]: Date.now() });
        const metin = (cevap.kayitlar || []).length + ' kayıt aktarıldı' + (cevap.firin ? ' (' + cevap.firin + ' fırın çıkışı hariç)' : '') + '.';
        kaldirmaDurumYaz(true, metin);
        return { ok: true, metin, sayi: (cevap.kayitlar || []).length };
    } finally {
        kaldirmaCalisiyor = false;
    }
}

// ---------------------------------------------------------------------
// Uzaktan fotoğraf tazeleme: başka cihaz (telefon) süresi geçmiş hasar
// fotoğrafını istediyse, depo paneli bu bilgisayarda açıkken 30 sn'de bir
// Jet Barkod'a sorulur; istek varsa panelin kendi isteğiyle taze link alınıp
// yazılır. Panel kapalıysa hiç sorulmaz. Getir'e yalnız istek varken gider.
// ---------------------------------------------------------------------

const KALDIRMA_FOTO_ALARM = 'jba-kaldirma-foto';
const KALDIRMA_KOK = 'https://api.flowcobalt.com';
let kaldirmaFotoCalisiyor = false;

async function kaldirmaApi(yol, govde) {
    const al = globalThis.jbaYetkiAl;
    if (typeof al !== 'function') return null;
    let yetki = await al(false);
    if (!yetki) return null;
    for (let deneme = 0; deneme < 2; deneme++) {
        let r = null;
        try {
            r = await fetch(KALDIRMA_KOK + yol, {
                method: govde ? 'POST' : 'GET',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + yetki.token },
                body: govde ? JSON.stringify(govde) : undefined,
            });
        } catch (e) { return null; }
        if (r.status === 401 && deneme === 0) { yetki = await al(true); if (!yetki) return null; continue; }
        if (!r.ok) return null;
        try { return await r.json(); } catch (e) { return null; }
    }
    return null;
}

async function kaldirmaFotoTuru() {
    if (kaldirmaFotoCalisiyor) return;
    kaldirmaFotoCalisiyor = true;
    try {
        if (!(await kaldirmaHakVar())) return;
        const sekme = await kaldirmaSekmesi();
        if (!sekme) return;
        const j = await kaldirmaApi('/api/kaldirma/foto-istekleri');
        const idler = j && Array.isArray(j.idler) ? j.idler.filter((x) => /^[a-f0-9]{24}$/.test(x)).slice(0, 10) : [];
        for (const id of idler) {
            let c = null;
            try { c = await chrome.tabs.sendMessage(sekme.id, { type: 'JBA_KALDIRMA_FOTO_SOR', id }); } catch (e) { c = null; }
            const adresler = c && Array.isArray(c.adresler) ? c.adresler : [];
            await kaldirmaApi('/api/kaldirma/fotolar/' + id, { adresler });
            await new Promise((x) => setTimeout(x, 300));
        }
    } finally {
        kaldirmaFotoCalisiyor = false;
    }
}

async function kaldirmaAlarmKur() {
    try {
        await chrome.alarms.clear(KALDIRMA_ESKI_ALARM);
        const var_ = await chrome.alarms.get(KALDIRMA_ALARM);
        if (!var_) chrome.alarms.create(KALDIRMA_ALARM, { periodInMinutes: 10, delayInMinutes: 1 });
        const foto = await chrome.alarms.get(KALDIRMA_FOTO_ALARM);
        if (!foto) chrome.alarms.create(KALDIRMA_FOTO_ALARM, { periodInMinutes: 0.5, delayInMinutes: 0.5 });
    } catch (e) { /* sessiz */ }
}

chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === KALDIRMA_ALARM) kaldirmaCalistir('periyot');
    else if (a.name === KALDIRMA_FOTO_ALARM) kaldirmaFotoTuru().catch(() => {});
});
chrome.runtime.onStartup.addListener(kaldirmaAlarmKur);
chrome.runtime.onInstalled.addListener(kaldirmaAlarmKur);

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek) return false;
    if (istek.type === 'JBA_KALDIRMA_PANO_HAZIR') {
        // Köprü panelin ilk isteklerini (başlıkları) yakalasın
        setTimeout(() => kaldirmaCalistir('pano'), 8000);
        return false;
    }
    if (istek.type === 'JBA_KALDIRMA_FOTO') {
        const id = String(istek.id || '');
        if (!/^[a-f0-9]{24}$/.test(id)) { cevapla({ adresler: null }); return false; }
        (async () => {
            if (!(await kaldirmaHakVar())) return { adresler: null };
            const sekme = await kaldirmaSekmesi();
            if (!sekme) return { adresler: null, sebep: 'panel' };
            try { return await chrome.tabs.sendMessage(sekme.id, { type: 'JBA_KALDIRMA_FOTO_SOR', id }); }
            catch (e) { return { adresler: null }; }
        })().then(cevapla, () => cevapla({ adresler: null }));
        return true;
    }
    if (istek.type === 'JBA_KALDIRMA_TAZELE') {
        kaldirmaCalistir('elle').then(cevapla, () => cevapla({ ok: false, metin: 'Aktarım çalışmadı.' }));
        return true;
    }
    return false;
});

kaldirmaAlarmKur();
