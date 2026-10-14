/**
 * Sipariş panosu nöbetçisi
 * ============================================================================
 *
 * SORUN
 * Depo panelinin siparişler ekranı ayrı bir sekmede açık duruyor. Sekme öne
 * gelmeyince Chrome:
 *   - sayfanın zamanlayıcılarını yavaşlatıyor (5 dakikadan sonra dakikada bir),
 *   - "Uyuyan sekme / Bellek tasarrufu" ile sayfayı tamamen kapatabiliyor.
 * Sipariş durumları ve ürünler Jet Barkod'a dakikalarca geç ya da hiç gitmiyordu.
 *
 * ÇÖZÜM
 * Eklentinin arka planı sekme kısıtına girmiyor. Buradan:
 *   - pano sekmesi "otomatik kapatılamaz" yapılıyor (Chrome'un kendi ayarı),
 *     kapatılmışsa yeniden yükleniyor;
 *   - 2 sn'de bir sekmeye nabız gidiyor. Nabız bir mesaj, zamanlayıcı değil;
 *     Chrome onu kısmıyor. Sekmedeki betik nabızla listeyi duyuruyor, kartları
 *     tarıyor, ürün kuyruğunu itiyor (moduller/hizli-bul.js);
 *   - panelin soketi koptuğu için kartlar donmuşsa sekme "pano bayat" der,
 *     burada yenilenir (en fazla 5 dakikada bir; sekme öndeyse yenilenmez).
 *
 * Getir'e ek istek yok: nabız yalnız sekmenin içindeki işleri tetikliyor.
 * Panelin listesi (radar) zaten var olan yolla, 20 sn'de bir okunuyor.
 * ============================================================================
 */

const PANO = 'https://warehouse.getir.com/r/*/dashboard/orders*';
const NABIZ_MS = 2000;
const YENILEME_ARASI_MS = 5 * 60 * 1000;
const ALARM = 'jba-pano-nobet';

let nabiz = null;
const sonYenileme = new Map();

async function tur() {
    let sekmeler = [];
    try { sekmeler = await chrome.tabs.query({ url: PANO }); } catch (e) { sekmeler = []; }
    if (!sekmeler.length) { durdur(); return; }
    for (const t of sekmeler) {
        // Chrome bu sekmeyi bellek için kapatmasın
        if (t.autoDiscardable !== false) chrome.tabs.update(t.id, { autoDiscardable: false }).catch(() => {});
        // Kapatılmış (uyuyan) sekme: yeniden yükle, panel kendini kurar
        if (t.discarded) {
            if (Date.now() - (sonYenileme.get(t.id) || 0) > 30000) {
                sonYenileme.set(t.id, Date.now());
                chrome.tabs.reload(t.id).catch(() => {});
            }
            continue;
        }
        if (t.status !== 'complete') continue;
        chrome.tabs.sendMessage(t.id, { type: 'JBA_PANO_TIK' }).catch(() => { /* betik henüz yok */ });
    }
    // Fırın bildirimi 15 sn'lik kontrolünü bu nabza bağlıyor (alarm en az 30 sn)
    if (typeof globalThis.jbaFirinNabiz === 'function') globalThis.jbaFirinNabiz();
}

function basla() {
    if (nabiz) return;
    nabiz = setInterval(tur, NABIZ_MS);
    tur();
}

function durdur() {
    if (!nabiz) return;
    clearInterval(nabiz);
    nabiz = null;
}

// Hizmet işçisi uyuyup uyanırsa nabız yeniden kurulsun (alarm en az 30 sn)
chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) basla(); });
chrome.runtime.onStartup.addListener(basla);
chrome.runtime.onInstalled.addListener(basla);
chrome.tabs.onUpdated.addListener((id, degisim, t) => {
    if (degisim.status === 'complete' && /^https:\/\/warehouse\.getir\.com\/r\/[a-f0-9]{24}\/dashboard\/orders/.test(t.url || '')) basla();
});

chrome.runtime.onMessage.addListener((istek, gonderen) => {
    if (!istek || istek.type !== 'JBA_PANO_BAYAT') return false;
    const t = gonderen && gonderen.tab;
    if (!t || !t.id) return false;
    // Kullanıcı panele bakıyorsa altından yenileme yapılmaz
    if (t.active) return false;
    if (Date.now() - (sonYenileme.get(t.id) || 0) < YENILEME_ARASI_MS) return false;
    sonYenileme.set(t.id, Date.now());
    chrome.tabs.reload(t.id).catch(() => {});
    return false;
});

basla();
