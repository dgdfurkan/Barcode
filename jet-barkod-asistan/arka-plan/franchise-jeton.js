/**
 * Franchise oturumunu Jet Barkod hesabına taşır
 * ============================================================================
 *
 * Franchise panelinin herhangi bir sayfası (Mevcut Stok dahil) istek
 * attığında sayim-hazirligi.js jetonu `getir_api_info`ya yazıyor. Burası o
 * değişikliği izler ve jetonu Jet Barkod API'sine (/api/franchise-jeton)
 * bırakır. Böylece telefondaki stok sorgusu için bilgisayarda sayım
 * sayfasını açmak gerekmez.
 *
 * Getir'e istek atmaz. Kendi sunucumuza: jeton değişince, değişmese de en
 * fazla 10 dakikada bir. Sunucu daha eski jetonu yazmaz.
 * ============================================================================
 */

const FJ_API = 'https://api.flowcobalt.com/api/franchise-jeton';
const FJ_SON = 'jbaFranchiseJetonSon';
const FJ_TEKRAR_MS = 10 * 60 * 1000;
const FJ_GECIKME_MS = 3000;

let fjZamanlayici = null;
let fjCalisiyor = false;

async function fjGonder() {
    if (fjCalisiyor) return;
    fjCalisiyor = true;
    try {
        const r = await chrome.storage.local.get(['getir_api_info', FJ_SON]);
        const bilgi = r && r.getir_api_info;
        if (!bilgi || typeof bilgi.token !== 'string' || !bilgi.token) return;
        const son = r[FJ_SON] || {};
        if (son.token === bilgi.token && Date.now() - (son.zaman || 0) < FJ_TEKRAR_MS) return;

        const al = globalThis.jbaYetkiAl;
        if (typeof al !== 'function') return;
        let yetki = await al(false);
        if (!yetki) return;
        const govde = JSON.stringify({
            token: bilgi.token,
            tokenExpiry: bilgi.tokenExpiry || null,
            warehouseId: typeof bilgi.warehouseId === 'string' ? bilgi.warehouseId : null
        });
        let cevap = null;
        for (let deneme = 0; deneme < 2; deneme++) {
            try {
                cevap = await fetch(FJ_API, {
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
        // 404: sunucu henüz güncellenmedi. 400: jeton geçersiz ya da süresi
        // dolmuş. İkisinde de aynı jetonu yeniden göndermenin anlamı yok.
        if (cevap && (cevap.ok || cevap.status === 400 || cevap.status === 404)) {
            await chrome.storage.local.set({ [FJ_SON]: { token: bilgi.token, zaman: Date.now() } });
        }
    } catch (e) {
        /* sessiz: bir sonraki jetonda tekrar denenir */
    } finally {
        fjCalisiyor = false;
    }
}

function fjPlanla() {
    if (fjZamanlayici) clearTimeout(fjZamanlayici);
    fjZamanlayici = setTimeout(() => { fjZamanlayici = null; fjGonder(); }, FJ_GECIKME_MS);
}

chrome.storage.onChanged.addListener((degisen, alan) => {
    if (alan === 'local' && degisen.getir_api_info) fjPlanla();
});
