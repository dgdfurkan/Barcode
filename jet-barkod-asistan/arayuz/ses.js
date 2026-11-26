/* Görünmez ses belgesi (chrome.offscreen): arka plan JBA_SES_CAL gönderir */
chrome.runtime.onMessage.addListener(function (m, gonderen, cevapla) {
    if (m && m.type === 'JBA_SES_DUR' && m.hedef === 'ses-belgesi') {
        try { globalThis.JBASes.dur(); } catch (e) { /* çalan yok */ }
        cevapla({ ok: true });
        return false;
    }
    if (!m || m.type !== 'JBA_SES_CAL' || m.hedef !== 'ses-belgesi') return false;
    try {
        cevapla({ ok: true, sure: globalThis.JBASes.cal(m.ses, { tekrar: m.tekrar, sure: m.sure, duzey: m.duzey }) });
    } catch (e) {
        cevapla({ ok: false });
    }
    return false;
});
