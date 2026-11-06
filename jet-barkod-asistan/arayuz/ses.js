/* Görünmez ses belgesi (chrome.offscreen): arka plan JBA_SES_CAL gönderir */
chrome.runtime.onMessage.addListener(function (m, gonderen, cevapla) {
    if (!m || m.type !== 'JBA_SES_CAL' || m.hedef !== 'ses-belgesi') return false;
    try {
        cevapla({ ok: true, sure: globalThis.JBASes.cal(m.ses, m.tekrar) });
    } catch (e) {
        cevapla({ ok: false });
    }
    return false;
});
