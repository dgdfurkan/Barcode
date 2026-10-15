/**
 * Fırın nöbetçisi: pişirilmesi gereken ürün varsa kontrol panelinde bildirim
 * ============================================================================
 *
 * SORUN
 * Pişirme bazen atlanıyor: fırın sayfasına gidip panele bakmak gerekiyor.
 *
 * ÇÖZÜM
 * Kontrol panelinin siparişler ekranı açıkken, belli aralıklarla (varsayılan
 * 15 sn, Asistan simgesinden ayarlanır) panel sekmesine `JBA_FIRIN_SOR`
 * gidiyor. Sekmedeki sayfa köprüsü fırın sayfasının attığı isteğin aynısını
 * (`GET /heating-estimations`) panelin kendi başlıklarıyla atıyor; sekmedeki
 * bildirim modülü pişirme panelinin KENDİ hesabıyla (moduller/firin-hesap.js)
 * neyin pişeceğini buluyor. Yeni sekme açılmıyor, jeton sayfadan çıkmıyor.
 * Liste boşalınca (pişirme yapıldı) kart kendiliğinden kalkıyor.
 *
 * ZAMANLAMA
 * Chrome alarmı en az 30 sn. 15 sn için sipariş panosu nöbetçisinin
 * (pano-nobet.js) 2 sn'lik nabzına bağlanıyor: her nabızda süre dolmuş mu
 * diye bakılıyor. Alarm yalnız hizmet işçisi uyursa uyandırmak için.
 * Dükkân 08:00'de açılıyor: 00:00-08:00 arası hiç istek atılmıyor.
 *
 * GETİR'İ YORMAMA
 *   - Yalnız siparişler ekranı açıkken, tek GET; birden çok panel sekmesi
 *     açıksa yalnız biri soruluyor. Sayfa köprüsü de 10 sn içinde ikinci
 *     isteği atmıyor.
 *   - Getir hata dönerse 2 dk beklenir.
 *   - Sonuç Asistan simgesinde "Son kontrol" olarak görünüyor.
 * ============================================================================
 */

const AYAR_ANAHTARI = 'jbaFirinNobet';
const VARSAYILAN = { acik: true, sn: 15 };
const ALARM = 'jba-firin-nobet';
const PANO = 'https://warehouse.getir.com/r/*/dashboard/orders*';
const EN_AZ_ARA_MS = 10 * 1000;
const HATA_BEKLEME_MS = 2 * 60 * 1000;
const SATIS_GECIKMESI_MS = 20 * 1000;
const SIM_SURE_MS = 10 * 1000;
const ACILIS_SAATI = 8;
const FIRIN_URUNU = /f[ıi]r[ıi]n|unlu|simit|po[ğg]a[çc]a|b[öo]rek|kruvasan|croissant|pi[şs]i|açma|acma|kek\b|muffin|ekmek|baget|pide/i;

let calisiyor = false;
let sonKontrol = 0;
let sonHata = 0;
let satisZamanlayici = null;
let ayar = Object.assign({}, VARSAYILAN);
let geceTemizlendi = false;

async function ayarOku() {
    try {
        const r = await chrome.storage.local.get(AYAR_ANAHTARI);
        const k = (r && r[AYAR_ANAHTARI]) || {};
        // Eski kayıtlar dakika tutuyordu ({dk}); yeni varsayılan 15 sn
        const sn = Number(k.sn) > 0 ? Number(k.sn) : VARSAYILAN.sn;
        ayar = { acik: k.acik !== false, sn: Math.max(15, Math.min(600, sn)) };
    } catch (e) {
        ayar = Object.assign({}, VARSAYILAN);
    }
    return ayar;
}

async function alarmKur() {
    const a = await ayarOku();
    await chrome.alarms.clear(ALARM);
    // Uyandırıcı: nabız durursa (hizmet işçisi uyudu) en geç 30 sn'de bir
    if (a.acik) chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
    return a;
}

/** Son kontrolün sonucu; Asistan simgesindeki pencere gösteriyor */
function durumYaz(metin) {
    chrome.storage.local.set({ jbaFirinDurum: { zaman: Date.now(), metin } }).catch(() => {});
}

function sebepMetni(c) {
    const s = c && c.sebep;
    if (s === 'oturum') return 'Panel oturumu bekleniyor; birkaç saniye içinde yakalanır.';
    if (s === 'kapalı') return 'Fırın bildirimi bu sekmede kapalı.';
    if (s === 'zaman aşımı') return 'Panel cevap vermedi.';
    if (s) return 'Fırın verisi okunamadı (' + s + ').';
    return 'Panel sekmesi cevap vermedi; sekmeyi yenile.';
}

function mesaiDisi() {
    return new Date().getHours() < ACILIS_SAATI;
}

async function panolar() {
    try { return await chrome.tabs.query({ url: PANO }); } catch (e) { return []; }
}

async function yay(sekmeler, sonuc, ek) {
    const mesaj = Object.assign({
        type: 'JBA_FIRIN_UYARI',
        liste: (sonuc && sonuc.liste) || [],
        dilimler: sonuc && sonuc.dilimler,
        simdiki: sonuc && sonuc.simdiki,
        zaman: Date.now()
    }, ek || {});
    for (const t of sekmeler) {
        chrome.tabs.sendMessage(t.id, mesaj).catch(() => {});
    }
}

/** Yüklenmiş, uyumayan bir panel sekmesi; öndeki varsa o */
function hedefSekme(sekmeler) {
    const hazir = sekmeler.filter((t) => t.status === 'complete' && !t.discarded);
    return hazir.find((t) => t.active) || hazir[0] || null;
}

async function hakVarMi() {
    try {
        const r = await chrome.storage.local.get('jbaAcikModuller');
        const l = r && r.jbaAcikModuller;
        return !Array.isArray(l) || l.indexOf('firinUyari') !== -1 || l.indexOf('firinPisirme') !== -1;
    } catch (e) { return true; }
}

async function kontrol(sebep) {
    if (calisiyor) return;
    if (!ayar.acik) return;
    if (!(await hakVarMi())) { durumYaz('Fırın hakkı bu hesapta kapalı.'); return; }
    const sekmeler = await panolar();
    if (!sekmeler.length) return;

    // 00:00-08:00: dükkân kapalı, istek yok; varsa kart kalkar
    if (mesaiDisi()) {
        if (!geceTemizlendi) {
            geceTemizlendi = true;
            await yay(sekmeler, null);
            durumYaz('Mesai dışı; 08:00\'de başlar.');
        }
        return;
    }
    geceTemizlendi = false;

    const hedef = hedefSekme(sekmeler);
    if (!hedef) return;
    const simdi = Date.now();
    if (simdi - sonKontrol < EN_AZ_ARA_MS) return;
    if (simdi - sonHata < HATA_BEKLEME_MS) return;

    calisiyor = true;
    sonKontrol = simdi;
    try {
        const cevap = await chrome.tabs.sendMessage(hedef.id, { type: 'JBA_FIRIN_SOR' });
        if (!cevap || !cevap.ok) {
            // Yalnız Getir'in hata döndüğü durum bekletir; oturum henüz
            // yakalanmadıysa ya da sekme cevap vermediyse sonraki turda yine denenir
            if (cevap && /^(http|ağ)/.test(cevap.sebep || '')) sonHata = Date.now();
            durumYaz(sebepMetni(cevap));
            return;
        }
        await yay(await panolar(), cevap);
        const n = typeof cevap.gorunenSayisi === 'number' ? cevap.gorunenSayisi : (cevap.liste || []).length;
        const ert = cevap.ertelenenSayisi ? ' ' + cevap.ertelenenSayisi + ' ürün ertelendi.' : '';
        durumYaz(cevap.stokluSayisi === 0 && cevap.urunSayisi > 0
            ? 'Stok sayıları gelmedi, bildirim gösterilemiyor.'
            : n ? n + ' ürün için bildirim gösterildi.' + ert
            : 'Acil pişirme yok (' + (cevap.stokluSayisi || 0) + ' ürün okundu).' + ert);
    } catch (e) {
        // Sekmede betik yok (yeni yüklendi, eski sürüm)
        durumYaz(sebepMetni(null));
    } finally {
        calisiyor = false;
    }
}

/** Sipariş panosu nöbetçisi her 2 sn'de bir çağırır */
globalThis.jbaFirinNabiz = function () {
    if (!ayar.acik || calisiyor) return;
    if (Date.now() - sonKontrol < ayar.sn * 1000) return;
    kontrol('periyot');
};

// ==================================================================
// Simülasyon (Asistan simgesi > Simülasyonu Göster, tek sefer)
//
// Gerçek ürün listesi okunuyor; sekmedeki modül içinden rastgele 1-4
// ürünün rafını boşaltıp pişirme panelinin hesabıyla listeyi çıkarıyor.
// Kart gerçek kartın aynısı, üstünde "Simülasyon" yazıyor, 10 sn sonra
// kapanıyor; gerçek bir uyarı varsa o geri geliyor.
// ==================================================================

async function simulasyon() {
    const sekmeler = await panolar();
    if (!sekmeler.length) return { ok: false, metin: 'Önce depo panelinde Siparişler ekranını aç.' };
    const hedef = hedefSekme(sekmeler);
    if (!hedef) return { ok: false, metin: 'Siparişler sekmesi henüz yüklenmedi.' };
    let cevap = null;
    try { cevap = await chrome.tabs.sendMessage(hedef.id, { type: 'JBA_FIRIN_SOR', sim: true }); } catch (e) { cevap = null; }
    if (!cevap || !cevap.ok) {
        return { ok: false, metin: sebepMetni(cevap) };
    }
    if (!(cevap.liste || []).length) {
        return { ok: false, metin: cevap.urunSayisi ? 'Simülasyon üretilemedi, tekrar dene.' : 'Fırın listesi boş geldi (gece olabilir).' };
    }
    await yay(sekmeler, cevap, { sim: true, sure: SIM_SURE_MS });
    return { ok: true };
}

/** Sipariş köprüsü yeni sipariş yazınca çağırır: fırın ürünü satıldıysa kısa süre sonra bak */
globalThis.jbaFirinSatis = function (urunler) {
    const firinVar = (urunler || []).some((u) => u && FIRIN_URUNU.test([u.ad, u.anaKategori, u.sinif, u.altSinif].join(' ')));
    if (!firinVar) return;
    clearTimeout(satisZamanlayici);
    satisZamanlayici = setTimeout(() => kontrol('satis'), SATIS_GECIKMESI_MS);
};

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) globalThis.jbaFirinNabiz(); });
chrome.runtime.onStartup.addListener(alarmKur);
chrome.runtime.onInstalled.addListener(alarmKur);
chrome.storage.onChanged.addListener((d, alan) => {
    if (alan !== 'local' || !d[AYAR_ANAHTARI]) return;
    alarmKur().then((a) => {
        if (!a.acik) {
            panolar().then((s) => yay(s, null));
            durumYaz('Kapalı.');
            return;
        }
        // Sıklık değişti: hemen bir kez bak
        sonKontrol = 0;
        setTimeout(() => kontrol('ayar'), 1000);
    });
});

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek) return false;
    // Kontrol paneli açıldı: köprü panelin ilk isteklerini yakalasın, sonra bak
    if (istek.type === 'JBA_FIRIN_PANO_HAZIR') {
        setTimeout(() => { sonKontrol = 0; kontrol('pano'); }, 6000);
        return false;
    }
    // Asistan simgesindeki "Simülasyonu Göster"
    if (istek.type === 'JBA_FIRIN_SIM') {
        simulasyon().then(cevapla, () => cevapla({ ok: false, metin: 'Simülasyon çalışmadı.' }));
        return true;
    }
    // Bildirimdeki "Fırın Sayfasını Aç"
    if (istek.type === 'JBA_FIRIN_AC' && gonderen && gonderen.tab) {
        const m = /\/r\/([a-f0-9]{24})\//.exec(gonderen.tab.url || '');
        if (m) chrome.tabs.create({ url: `https://warehouse.getir.com/r/${m[1]}/stock/stock-management/product/bakery-estimation/list`, active: true, windowId: gonderen.tab.windowId });
        return false;
    }
    return false;
});

alarmKur();
