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
 *   - Saatte bir (alarm). Panel açılınca, son aktarım bir saatten eskiyse
 *     birkaç saniye sonra bir kez.
 *   - Jet Barkod'daki Satıştan Kaldırma sayfasında "Şimdi Güncelle"
 *     (en az 2 dk arayla).
 * Getir'e giden istek: 14 günlük liste, sayfa başına 100 kayıt, sayfalar
 * arası 350 ms. Saatte bir.
 * ============================================================================
 */

const KALDIRMA_ALARM = 'jba-kaldirma';
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
    if (sebep !== 'elle') {
        try {
            const r = await chrome.storage.local.get(KALDIRMA_SON);
            const son = Number(r && r[KALDIRMA_SON]) || 0;
            if (simdi - son < KALDIRMA_ARALIK_MS - 5 * 60 * 1000) return { ok: true, metin: 'Güncel.' };
        } catch (e) { /* okunamadı: devam */ }
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
        try { cevap = await chrome.tabs.sendMessage(sekme.id, { type: 'JBA_KALDIRMA_SOR', gun: KALDIRMA_GUN }); } catch (e) { cevap = null; }
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
        await chrome.storage.local.set({ [KALDIRMA_SON]: Date.now() });
        const metin = (cevap.kayitlar || []).length + ' kayıt aktarıldı' + (cevap.firin ? ' (' + cevap.firin + ' fırın çıkışı hariç)' : '') + '.';
        kaldirmaDurumYaz(true, metin);
        return { ok: true, metin, sayi: (cevap.kayitlar || []).length };
    } finally {
        kaldirmaCalisiyor = false;
    }
}

async function kaldirmaAlarmKur() {
    try {
        const var_ = await chrome.alarms.get(KALDIRMA_ALARM);
        if (!var_) chrome.alarms.create(KALDIRMA_ALARM, { periodInMinutes: 60, delayInMinutes: 1 });
    } catch (e) { /* sessiz */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === KALDIRMA_ALARM) kaldirmaCalistir('periyot'); });
chrome.runtime.onStartup.addListener(kaldirmaAlarmKur);
chrome.runtime.onInstalled.addListener(kaldirmaAlarmKur);

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek) return false;
    if (istek.type === 'JBA_KALDIRMA_PANO_HAZIR') {
        // Köprü panelin ilk isteklerini (başlıkları) yakalasın
        setTimeout(() => kaldirmaCalistir('pano'), 8000);
        return false;
    }
    if (istek.type === 'JBA_KALDIRMA_TAZELE') {
        kaldirmaCalistir('elle').then(cevapla, () => cevapla({ ok: false, metin: 'Aktarım çalışmadı.' }));
        return true;
    }
    return false;
});

kaldirmaAlarmKur();
