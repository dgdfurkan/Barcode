/**
 * İtiraz Yazıcı: taslağı panele taşır
 * ============================================================================
 *
 * Jet Barkod'daki İtiraz Yazıcı'da "Panelde Doldur"a basılınca site köprüsü
 * `JBA_ITIRAZ_DOLDUR` gönderir. Taslak `jbaItirazTaslak`a yazılır ve kaydın
 * franchise-v2 detay sayfası açılır (açık bir franchise-v2 sekmesi varsa o
 * kullanılır). Sayfadaki modül (moduller/itiraz.js) kartı gösterir; formu
 * kullanıcı isteyince doldurur, Kaydet'e kullanıcı basar.
 *
 * Getir'e istek atmaz; yalnız sekme açar.
 * ============================================================================
 */

const ITIRAZ_TASLAK = 'jbaItirazTaslak';

async function itirazHakVar() {
    try {
        const r = await chrome.storage.local.get('jbaAcikModuller');
        const l = r && r.jbaAcikModuller;
        return !Array.isArray(l) || l.indexOf('itiraz') !== -1;
    } catch (e) { return true; }
}

async function itirazDoldur(m) {
    const kayitId = String(m.kayitId || '');
    const metin = typeof m.metin === 'string' ? m.metin.trim().slice(0, 2000) : '';
    const sebep = typeof m.sebep === 'string' ? m.sebep.trim().slice(0, 140) : '';
    if (!/^[a-f0-9]{24}$/.test(kayitId) || !metin) return { ok: false, metin: 'Taslak eksik.' };
    if (!(await itirazHakVar())) return { ok: false, metin: 'İtiraz Taslağı bu hesapta kapalı.' };

    await chrome.storage.local.set({ [ITIRAZ_TASLAK]: { kayitId, metin, sebep, zaman: Date.now() } });
    const adres = 'https://franchise-v2.getir.com/dys/dds100/log/detail/' + kayitId;
    let sekmeler = [];
    try { sekmeler = await chrome.tabs.query({ url: 'https://franchise-v2.getir.com/*' }); } catch (e) { sekmeler = []; }
    const sekme = sekmeler.find((t) => (t.url || '').indexOf('/log/detail/' + kayitId) !== -1) || sekmeler[0];
    try {
        if (sekme) {
            if ((sekme.url || '').indexOf('/log/detail/' + kayitId) === -1) await chrome.tabs.update(sekme.id, { url: adres, active: true });
            else await chrome.tabs.update(sekme.id, { active: true });
            await chrome.windows.update(sekme.windowId, { focused: true });
        } else {
            await chrome.tabs.create({ url: adres, active: true });
        }
    } catch (e) {
        return { ok: false, metin: 'Panel sekmesi açılamadı.' };
    }
    return { ok: true, metin: 'Panel açıldı. Karttaki "Forma Yerleştir"e bas.' };
}

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek || istek.type !== 'JBA_ITIRAZ_DOLDUR') return false;
    itirazDoldur(istek).then(cevapla, () => cevapla({ ok: false, metin: 'Taslak aktarılamadı.' }));
    return true;
});
