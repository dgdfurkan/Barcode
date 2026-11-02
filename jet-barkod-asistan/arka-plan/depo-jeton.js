/**
 * Depo paneli oturumunu Jet Barkod hesabına taşır
 * ============================================================================
 *
 * Depo panelinin jetonu 15 dakika yaşıyor; panel açık durdukça kendisi
 * yeniliyor. İçerik betiği (moduller/depo-jeton.js) her yeni jetonu buraya
 * veriyor, burası Jet Barkod API'sine (/api/depo-jeton) bırakıyor. Ürün
 * aramadaki Ürün Hareketi penceresi telefonda da bu jetonla çalışıyor.
 *
 * Getir'e istek atmaz. Kendi sunucumuza: yalnız jeton değişince, en sık
 * 20 saniyede bir. Sunucu daha eski jetonu yazmaz.
 * ============================================================================
 */

const DJ_API = 'https://api.flowcobalt.com/api/depo-jeton';
const DJ_SON = 'jbaDepoJetonSon';
const DJ_ARA_MS = 20 * 1000;

let djBekleyen = null;
let djZamanlayici = null;
let djCalisiyor = false;

async function djGonder() {
    if (djCalisiyor || !djBekleyen) return;
    djCalisiyor = true;
    const is = djBekleyen;
    djBekleyen = null;
    try {
        const r = await chrome.storage.local.get(DJ_SON);
        const son = r[DJ_SON] || {};
        if (son.token === is.jeton) return;

        const al = globalThis.jbaYetkiAl;
        if (typeof al !== 'function') return;
        let yetki = await al(false);
        if (!yetki) return;
        const govde = JSON.stringify({ token: is.jeton, warehouseId: is.depo });
        let cevap = null;
        for (let deneme = 0; deneme < 2; deneme++) {
            try {
                cevap = await fetch(DJ_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + yetki.token },
                    body: govde
                });
            } catch (e) {
                cevap = null;
            }
            if (cevap && cevap.status === 401 && deneme === 0) {
                yetki = await al(true);
                if (!yetki) return;
                continue;
            }
            break;
        }
        // 400: jeton geçersiz, aynısını tekrar göndermeye gerek yok. 404 (sunucu
        // henüz güncellenmedi) sayılmaz: kurulunca aynı jeton yine gider.
        if (cevap && (cevap.ok || cevap.status === 400)) {
            await chrome.storage.local.set({ [DJ_SON]: { token: is.jeton, zaman: Date.now() } });
        }
    } catch (e) {
        /* sessiz: bir sonraki jetonda tekrar denenir */
    } finally {
        djCalisiyor = false;
        if (djBekleyen) djPlanla();
    }
}

function djPlanla() {
    if (djZamanlayici) return;
    chrome.storage.local.get(DJ_SON).then((r) => {
        const son = (r && r[DJ_SON]) || {};
        const bekle = Math.max(2000, (son.zaman || 0) + DJ_ARA_MS - Date.now());
        djZamanlayici = setTimeout(() => { djZamanlayici = null; djGonder(); }, bekle);
    }, () => {
        djZamanlayici = setTimeout(() => { djZamanlayici = null; djGonder(); }, 2000);
    });
}

chrome.runtime.onMessage.addListener((istek) => {
    if (!istek || istek.type !== 'JBA_DEPO_JETON') return false;
    const jeton = String(istek.jeton || '');
    const depo = String(istek.depo || '');
    if (jeton.indexOf('Bearer ') !== 0 || jeton.length > 4096 || !/^[a-f0-9]{24}$/.test(depo)) return false;
    djBekleyen = { jeton, depo };
    djPlanla();
    return false;
});

/* Chrome güncellenen eklentinin içerik betiğini önceden açık sekmelere
   sokmuyor. Depo paneli sekmesi güncellemeden önce açıldıysa jeton hiç
   gelmiyordu. Kurulum, güncelleme ve tarayıcı açılışında açık panel
   sekmelerine betik elle sokulur; betik iki kez çalışmaz (__jbaDepoJeton). */
async function djSekmelereSok() {
    let sekmeler = [];
    try { sekmeler = await chrome.tabs.query({ url: 'https://warehouse.getir.com/r/*' }); } catch (e) { return; }
    for (const t of sekmeler) {
        if (t.discarded || t.status !== 'complete') continue;
        try { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['moduller/depo-jeton.js'] }); }
        catch (e) { /* sekme kapanmış ya da izin yok */ }
    }
}

chrome.runtime.onInstalled.addListener(() => { djSekmelereSok(); });
chrome.runtime.onStartup.addListener(() => { djSekmelereSok(); });
