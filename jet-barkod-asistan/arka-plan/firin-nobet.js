/**
 * Fırın nöbetçisi: pişirilmesi gereken ürün varsa kontrol panelinde bildirim
 * ============================================================================
 *
 * SORUN
 * Pişirme bazen atlanıyor: fırın sayfasına gidip panele bakmak gerekiyor.
 *
 * ÇÖZÜM
 * Kontrol panelinin siparişler ekranı açıkken, belli aralıklarla (varsayılan
 * 3 dk, Asistan simgesinden ayarlanır) panel sekmesine `JBA_FIRIN_SOR`
 * gidiyor. Sekmedeki sayfa köprüsü fırın sayfasının attığı isteğin aynısını
 * (`GET /heating-estimations`) panelin kendi başlıklarıyla atıyor; dilim
 * dilim pişirme önerisi ve o anki dilimde raf ile donuk stok geliyor.
 * Yeni sekme açılmıyor, jeton sayfadan çıkmıyor.
 *
 * Bildirim yalnız şu ürünler için:
 *   - şu anki saat diliminde pişirme önerisi var,
 *   - rafta hiç yok ya da öneriye göre çok az (raf × 5 ≤ öneri; öneri 10, raf 1),
 *   - donukta var (donukta yoksa pişirilemez, göstermeye gerek yok),
 *   - taze üretim ekmek değil (o donuktan pişmiyor).
 * Pişirme yapılınca sonraki kontrolde liste boşalır, bildirim kapanır.
 *
 * GETİR'İ YORMAMA
 *   - Yalnız siparişler ekranı açıkken; iki kontrol arası en az 1 dk
 *     (sayfa köprüsü de 50 sn içinde ikinci isteği atmıyor).
 *   - Uyarı yoksa, fırın ürünü satılmadıysa ve saat dilimi değişmediyse
 *     dönem atlanıyor; en geç 15 dk'da bir yine bakılıyor.
 *   - Birden çok panel sekmesi açıksa yalnız biri soruluyor.
 *   - İstek başarısızsa (oturum yok vb.) 10 dk beklenir.
 * ============================================================================
 */

const AYAR_ANAHTARI = 'jbaFirinNobet';
const VARSAYILAN = { acik: true, dk: 3 };
const ALARM = 'jba-firin-nobet';
const PANO = 'https://warehouse.getir.com/r/*/dashboard/orders*';
const EN_AZ_ARA_MS = 60 * 1000;
const EN_GEC_MS = 15 * 60 * 1000;
const HATA_BEKLEME_MS = 10 * 60 * 1000;
const SATIS_GECIKMESI_MS = 45 * 1000;
const FIRIN_URUNU = /f[ıi]r[ıi]n|unlu|simit|po[ğg]a[çc]a|b[öo]rek|kruvasan|croissant|pi[şs]i|açma|acma|kek\b|muffin|ekmek|baget|pide/i;

let calisiyor = false;
let sonKontrol = 0;
let dilimBitis = 0;
let sonHata = 0;
let satisOldu = false;
let aktifUyari = false;
let satisZamanlayici = null;


async function ayarOku() {
    try {
        const r = await chrome.storage.local.get(AYAR_ANAHTARI);
        return Object.assign({}, VARSAYILAN, r && r[AYAR_ANAHTARI]);
    } catch (e) {
        return Object.assign({}, VARSAYILAN);
    }
}

async function alarmKur() {
    const a = await ayarOku();
    await chrome.alarms.clear(ALARM);
    if (!a.acik) return;
    const dk = Math.max(1, Math.min(30, Number(a.dk) || 3));
    chrome.alarms.create(ALARM, { periodInMinutes: dk });
}

/** Panelin saatleri yerel ve saat dilimi eki yok ("2026-01-01T12:00:00") */
function zaman(metin) {
    const t = new Date(metin).getTime();
    return Number.isFinite(t) ? t : NaN;
}

/** Şu anın içinde olduğu dilim; yoksa (gece) null */
function simdikiDilim(dilimler, simdi) {
    return (dilimler || []).find((d) => zaman(d.bas) <= simdi && simdi < zaman(d.son)) || null;
}

function ekmekMi(ad) {
    return /^\s*(ekmek|ramazan\s+pidesi)\s*\(\s*\d+\s*(g|gr)\s*\)\s*$/i.test(ad || '');
}

function etiket(d) {
    return String(d.bas).slice(11, 16) + '-' + String(d.son).slice(11, 16).replace('00:00', '24:00');
}

/**
 * Bildirimde gösterilecek ürünler: önerisi var, rafta yok ya da çok az,
 * donukta var. Kart pişirme panelindeki gibi çizildiği için her ürünle
 * dört dilimin önerisi ve pişirilecek adet de gidiyor.
 */
function uyarilar(dilimler, dilim) {
    if (!dilim) return [];
    return (dilim.urunler || [])
        .filter((u) => u && typeof u.ad === 'string' && typeof u.raf === 'number' && typeof u.donuk === 'number' && !ekmekMi(u.ad))
        .map((u) => {
            const oneri = Number(u.oneri) || 0;
            const raf = Math.max(0, u.raf);
            const donuk = Math.max(0, u.donuk);
            return {
                ad: u.ad,
                gorsel: u.gorsel,
                raf,
                donuk,
                oneri,
                pisir: Math.max(0, Math.min(oneri - raf, donuk)),
                oneriler: dilimler.map((d) => {
                    const x = (d.urunler || []).find((y) => y && y.ad === u.ad);
                    return x ? Number(x.oneri) || 0 : 0;
                })
            };
        })
        .filter((u) => u.oneri > 0 && u.donuk > 0 && u.pisir > 0 && (u.raf <= 0 || u.raf * 5 <= u.oneri))
        .sort((a, b) => (a.raf - b.raf) || (b.oneri - a.oneri))
        .slice(0, 12);
}

async function panolar() {
    try { return await chrome.tabs.query({ url: PANO }); } catch (e) { return []; }
}

async function yay(sekmeler, liste, ek) {
    if (!(ek && ek.sim)) aktifUyari = liste.length > 0;
    const mesaj = Object.assign({ type: 'JBA_FIRIN_UYARI', liste, zaman: Date.now() }, ek || {});
    for (const t of sekmeler) {
        chrome.tabs.sendMessage(t.id, mesaj).catch(() => {});
    }
}

/** Yüklenmiş, uyumayan bir panel sekmesi; öndeki varsa o */
function hedefSekme(sekmeler) {
    const hazir = sekmeler.filter((t) => t.status === 'complete' && !t.discarded);
    return hazir.find((t) => t.active) || hazir[0] || null;
}

// ==================================================================
// Simülasyon (Asistan simgesi > Fırın Bildirimi > Simülasyon)
//
// Gerçek ürün listesi bir kez okunuyor (5 dk saklanıyor, Getir'e her
// turda istek gitmiyor), içinden rastgele 1-4 ürün seçilip raf düşürülüyor.
// Kart gerçek kartın aynısı, üstünde "Simülasyon" yazıyor, 10 sn sonra
// kendiliğinden kapanıyor. Gerçek uyarı durumuna dokunmuyor.
// ==================================================================

const SIM_VERI_MS = 5 * 60 * 1000;
const SIM_SURE_MS = 10 * 1000;
let simVeri = null;

function rastgele(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function karistir(dizi) {
    const d = dizi.slice();
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

function simSenaryo(dilimler, an) {
    if (!dilimler || !dilimler.length) return null;
    // Gece dilim yoksa ilk dilim varmış gibi
    let i = dilimler.findIndex((d) => zaman(d.bas) <= an && an < zaman(d.son));
    if (i < 0) i = 0;
    const kopya = JSON.parse(JSON.stringify(dilimler));
    const dilim = kopya[i];
    const adaylar = (dilim.urunler || []).filter((u) => u && u.ad && !ekmekMi(u.ad));
    if (!adaylar.length) return null;
    const secilen = new Set(karistir(adaylar).slice(0, rastgele(1, Math.min(4, adaylar.length))).map((u) => u.ad));
    dilim.urunler.forEach((u) => {
        if (!secilen.has(u.ad)) { u.raf = typeof u.raf === 'number' ? Math.max(u.raf, 999) : 999; return; }
        u.oneri = Math.max(Number(u.oneri) || 0, rastgele(4, 12));
        u.raf = Math.random() < 0.5 ? 0 : Math.floor(u.oneri / 5);
        u.donuk = typeof u.donuk === 'number' && u.donuk > 0 ? u.donuk : rastgele(6, 40);
    });
    return { dilimler: kopya, dilim, i };
}

async function simKontrol(hedef) {
    if (!simVeri || Date.now() - simVeri.zaman > SIM_VERI_MS) {
        const cevap = await chrome.tabs.sendMessage(hedef.id, { type: 'JBA_FIRIN_SOR' });
        if (!cevap || !cevap.ok) return;
        simVeri = { zaman: Date.now(), dilimler: cevap.dilimler || [] };
    }
    const an = Date.now();
    const sen = simSenaryo(simVeri.dilimler, an);
    if (!sen) return;
    await yay(await panolar(), uyarilar(sen.dilimler, sen.dilim), {
        sim: true, sure: SIM_SURE_MS, dilimler: sen.dilimler.map(etiket), simdiki: sen.i
    });
}

async function kontrol(sebep) {
    if (calisiyor) return;
    const ayar = await ayarOku();
    if (!ayar.acik) return;
    // Modül hesabında kapalıysa (fırın hakkı yok) hiç bakılmaz
    try {
        const r = await chrome.storage.local.get('jbaAcikModuller');
        const l = r && r.jbaAcikModuller;
        if (Array.isArray(l) && l.indexOf('firinUyari') === -1 && l.indexOf('firinPisirme') === -1) return;
    } catch (e) { /* liste yoksa açık say */ }
    const sekmeler = await panolar();
    if (!sekmeler.length) return;
    const hedef = hedefSekme(sekmeler);
    if (!hedef) return;

    if (ayar.simule) {
        calisiyor = true;
        try { await simKontrol(hedef); } catch (e) { /* sonraki tur */ } finally { calisiyor = false; }
        return;
    }

    const simdi = Date.now();
    if (simdi - sonKontrol < EN_AZ_ARA_MS) return;
    if (simdi - sonHata < HATA_BEKLEME_MS) return;
    // Gereksiz kontrolü atla: uyarı yok, satış yok, dilim bitmedi, 15 dk dolmadı
    if (sebep === 'periyot' && !aktifUyari && !satisOldu && simdi < dilimBitis && simdi - sonKontrol < EN_GEC_MS) return;

    calisiyor = true;
    sonKontrol = simdi;
    satisOldu = false;
    try {
        const cevap = await chrome.tabs.sendMessage(hedef.id, { type: 'JBA_FIRIN_SOR' });
        if (!cevap || !cevap.ok) {
            // Modül o sekmede kapalıysa hata sayılmaz; oturum/ağ sorunu 10 dk bekletir
            if (!cevap || cevap.sebep !== 'kapalı') sonHata = Date.now();
            return;
        }
        const an = Date.now();
        const dilimler = cevap.dilimler || [];
        const dilim = simdikiDilim(dilimler, an);
        // Gece (dilim yok): 15 dk sonra yine bakılır
        dilimBitis = dilim ? zaman(dilim.son) : an + EN_GEC_MS;
        await yay(await panolar(), uyarilar(dilimler, dilim), {
            dilimler: dilimler.map(etiket), simdiki: dilim ? dilimler.indexOf(dilim) : -1
        });
    } catch (e) {
        // Sekmede betik yok (yeni yüklendi, eski sürüm): sessizce sonraki tura
    } finally {
        calisiyor = false;
    }
}

/** Sipariş köprüsü yeni sipariş yazınca çağırır: fırın ürünü satıldıysa kısa süre sonra bak */
globalThis.jbaFirinSatis = function (urunler) {
    const firinVar = (urunler || []).some((u) => u && FIRIN_URUNU.test([u.ad, u.anaKategori, u.sinif, u.altSinif].join(' ')));
    if (!firinVar) return;
    satisOldu = true;
    clearTimeout(satisZamanlayici);
    satisZamanlayici = setTimeout(() => kontrol('satis'), SATIS_GECIKMESI_MS);
};

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) kontrol('periyot'); });
chrome.runtime.onStartup.addListener(alarmKur);
chrome.runtime.onInstalled.addListener(alarmKur);
chrome.storage.onChanged.addListener((d, alan) => {
    if (alan === 'local' && d[AYAR_ANAHTARI]) {
        alarmKur();
        const eski = d[AYAR_ANAHTARI].oldValue || {};
        ayarOku().then((a) => {
            // Kapandı ya da simülasyondan çıkıldı: kart temizlensin, gerçek kontrol baştan
            if (!a.acik || (eski.simule && !a.simule)) {
                sonKontrol = 0;
                dilimBitis = 0;
                panolar().then((s) => yay(s, []));
            }
            if (a.acik && a.simule) kontrol('sim');
            else if (a.acik) setTimeout(() => kontrol('ayar'), 1000);
        });
    }
});

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek) return false;
    // Kontrol paneli açıldı: biraz sonra bir kez bak
    if (istek.type === 'JBA_FIRIN_PANO_HAZIR') {
        // Köprünün panelin ilk sipariş isteğini yakalamasına zaman tanı
        setTimeout(() => kontrol('pano'), 10000);
        return false;
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
