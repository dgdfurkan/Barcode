/**
 * Jet Barkod Asistan. Arka plan.
 *
 * Şimdilik işi az: kurulumda varsayılanı hazırlıyor. Modül listesini
 * site köprüsü doğrudan chrome.storage'a yazıyor, yükleyici de oradan
 * okuyor; arada mesajlaşmaya gerek yok.
 *
 * Sonraki modüller (token yakalama, bildirim, alarm) buraya eklenecek.
 * O yüzden dosya boş görünse de yerinde duruyor.
 */
chrome.runtime.onInstalled.addListener(function (ayrinti) {
    if (ayrinti.reason === 'install') {
        console.log('[Jet Barkod] Asistan kuruldu.');
    }
});
