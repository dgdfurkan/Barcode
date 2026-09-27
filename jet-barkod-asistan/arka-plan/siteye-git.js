/**
 * Jet Barkod Asistan. Siteye geçiş.
 * ============================================================================
 *
 * NE İŞE YARIYOR
 * Toplu Kopyalama'da kopyalayan kullanıcı Jet Barkod'a geçmek istiyor. Site
 * zaten bir sekmede açıksa o sekme öne alınıyor; açık değilse yeni sekme
 * açılıyor.
 *
 * NEDEN ARKA PLANDA
 * Eskiden bu iş sayfanın içinde BroadcastChannel ile yapılıyordu: siteye
 * "ping" atılıyor, yarım saniye içinde "pong" gelmezse yeni sekme açılıyordu.
 * Üç sorunu vardı:
 *   1) Chrome sekmeyi bellek için kapattıysa sekme JS çalıştırmıyor, cevap
 *      gelmiyor ve İKİNCİ bir sekme açılıyordu.
 *   2) Sekme diriyken bile ana iş parçacığı meşgulse yarım saniye yetmiyor,
 *      yine ikinci sekme açılıyordu.
 *   3) `window.open` bir tıklamadan yarım saniye sonra çağrıldığı için
 *      açılır pencere engeline yakalanabiliyordu.
 * Arka plan `tabs` yetkisiyle sekmeyi doğrudan görüyor; beklemeye ve tahmine
 * gerek kalmıyor.
 *
 * SEÇİM SIRASI
 * Ürün arama sayfası açık bir sekme > herhangi bir Jet Barkod sekmesi > yeni
 * sekme. Bulunan sekme öne alınıyor ve penceresi odaklanıyor.
 * ============================================================================
 */

const SITE_KALIPLARI = [
    'https://jetbarkod.com.tr/*',
    'https://www.jetbarkod.com.tr/*',
];

function aramaSayfasiMi(url) {
    return typeof url === 'string' && /jetbarkod\.com\.tr\/arama(\/|$|\?)/i.test(url);
}

async function siteyeGit(istenenUrl) {
    const url = typeof istenenUrl === 'string' && istenenUrl
        ? istenenUrl
        : 'https://jetbarkod.com.tr/arama/';

    let sekmeler = [];
    try {
        sekmeler = await chrome.tabs.query({ url: SITE_KALIPLARI });
    } catch (e) {
        sekmeler = [];
    }

    const hedef = sekmeler.find((t) => aramaSayfasiMi(t.url)) || sekmeler[0] || null;

    if (hedef) {
        try {
            await chrome.tabs.update(hedef.id, { active: true });
            if (hedef.windowId != null) {
                try {
                    await chrome.windows.update(hedef.windowId, { focused: true });
                } catch (e) { /* pencere gitmiş olabilir, sekme yine öne alındı */ }
            }
            return { ok: true, acikSekme: true };
        } catch (e) {
            /* Sekme aradaki sürede kapanmış olabilir; aşağıda yenisi açılır. */
        }
    }

    try {
        await chrome.tabs.create({ url, active: true });
        return { ok: true, acikSekme: false };
    } catch (e) {
        return { ok: false, hata: e && e.message ? e.message : 'sekme açılamadı' };
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'JBA_SITEYE_GIT') return;
    siteyeGit(message.url).then(sendResponse, function (e) {
        sendResponse({ ok: false, hata: e && e.message ? e.message : 'bilinmeyen hata' });
    });
    return true; // asenkron cevap
});
