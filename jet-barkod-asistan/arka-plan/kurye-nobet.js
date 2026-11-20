/**
 * Kurye nöbetçisi: kurye eksiği ve uzun mola uyarısı
 * ============================================================================
 *
 * NE YAPIYOR
 * Seçilen sıklıkla (15/20/30/60 sn) franchise panelinin "Siparişler &
 * Operasyon > Canlı Harita" sayfasının kendi attığı üç isteğin aynısını
 * atar (franchise jetonu sayim-hazirligi.js'in yakaladığı getir_api_info'dan,
 * Performans raporuyla aynı yol):
 *   GET  /users/warehouses/                     depo → şehir (günde bir)
 *   GET  /warehouses/courier-plan/<şehir>       o saatin planı
 *   POST /courier/filter {isLoggedIn:true}      giriş yapmış kuryeler
 *
 * HESAP (Getir panelinin kendi hesabı, canlı harita kodundan)
 *   Planlanan   courierPlanByCourierType değerlerinin toplamı
 *   Müsait      durum 100        Meşgul      200 ya da 4000-4200 (dolum)
 *   Siparişte   400-800          Geri dönen  900
 *   Toplam      bütün giriş yapmış kuryeler
 * Aktif = müsait + siparişte + geri dönen (meşgul hariç). Planlanan > aktif
 * ise kurye eksiği var. Bir adımda (meşgul, toplamada, yolda, adreste, geri
 * dönüyor, siparişte) kullanıcının yazdığı dakikadan uzun kalan kurye ayrıca
 * bildirilir. Tek kodlu adımda süre statusLastChangedAt'ten; "siparişte" bir
 * kod aralığı (400-800), oraya girişi kendimiz izliyoruz (storage.session).
 *
 * Uyarı depo panelinin sipariş ekranında sol üstte (moduller/kurye-uyari.js).
 * Ertele: eksik için, her kurye için ayrı; 15/30/45/60 dk. Ses: uyarı başlayınca
 * ve sürdükçe seçilen aralıkla, ertelenmişse çalmaz. Mesai 08:00-01:00.
 * ============================================================================
 */

const KN_AYAR = 'jbaKurye';
const KN_ERTELE = 'jbaKuryeErtele';
const KN_DURUM = 'jbaKuryeDurum';
const KN_SEHIR = 'jbaKuryeSehir';
const KN_GETIR = 'https://franchise-api-gateway.getirapi.com';
const KN_PANO = 'https://warehouse.getir.com/r/*/dashboard/orders*';
const KN_KIMLIK = /^[0-9a-f]{24}$/;
const KN_VARSAYILAN = { acik: true, sn: 15, eksik: true, mola: true, esik: { mesgul: 60 }, ses: 'kampana', sesAcik: true, sesAralik: 2 };
const KN_SIM_MS = 10 * 60 * 1000; // simülasyon çarpıya basılana kadar; en çok 10 dk
const KN_GRUP = 'jbaKuryeGrup';
/* Süre eşiği adımları. Sıra önemli: bir kurye için ilk tutan adım bildirilir
   (toplamadaki kurye "siparişte" eşiğine de girer, tek kart yeter). */
const KN_ADIMLAR = [
    { ad: 'mesgul', fiil: 'meşgulde', tut: (s) => s === 200 || (s >= 4000 && s <= 4200) },
    { ad: 'toplama', fiil: 'toplamada', tut: (s) => s === 600 },
    { ad: 'yolda', fiil: 'yolda', tut: (s) => s === 700 },
    { ad: 'adreste', fiil: 'adreste', tut: (s) => s === 800 },
    { ad: 'donen', fiil: 'geri dönüyor', tut: (s) => s === 900 },
    { ad: 'sipariste', fiil: 'siparişte', tut: (s) => s >= 400 && s <= 800, grup: true },
];

let knAyar = Object.assign({}, KN_VARSAYILAN);
let knSonKontrol = 0;
let knCalisiyor = false;
let knSon = null;            // son sonuç (sekme yeniden açılınca hemen çizilsin)
let knSonSes = 0;
let knOncekiImza = '';

/** Eşikler kullanıcının yazdığı dakika (1-600); boş ya da 0 kapalı.
    0.57'deki tek "meşgul eşiği" (molaDk) varsa ona taşınır. */
function knEsikOku(a) {
    const kaynak = a && a.esik && typeof a.esik === 'object' ? a.esik : { mesgul: Number(a && a.molaDk) || 60 };
    const e = {};
    KN_ADIMLAR.forEach((x) => {
        const n = Math.round(Number(kaynak[x.ad]));
        if (n >= 1 && n <= 600) e[x.ad] = n;
    });
    return e;
}

async function knAyarOku() {
    try {
        const a = (await chrome.storage.local.get(KN_AYAR))[KN_AYAR] || {};
        knAyar = {
            acik: a.acik !== false,
            sn: [15, 20, 30, 60].includes(Number(a.sn)) ? Number(a.sn) : KN_VARSAYILAN.sn,
            eksik: a.eksik !== false,
            mola: a.mola !== false,
            esik: knEsikOku(a),
            ses: typeof a.ses === 'string' && a.ses ? a.ses : KN_VARSAYILAN.ses,
            sesAcik: a.sesAcik !== false,
            sesAralik: [1, 2, 5, 10].includes(Number(a.sesAralik)) ? Number(a.sesAralik) : KN_VARSAYILAN.sesAralik,
        };
    } catch (e) { knAyar = Object.assign({}, KN_VARSAYILAN); }
    return knAyar;
}

/** Depo 08:00-01:00 açık */
function knMesaiMi(d = new Date()) {
    const h = d.getHours();
    return h >= 8 || h < 1;
}

function knJwtBitis(jeton) {
    try {
        const p = String(jeton).replace(/^Bearer\s+/i, '').split('.')[1];
        const y = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
        return Number.isFinite(y.exp) ? y.exp * 1000 : 0;
    } catch (e) { return 0; }
}

async function knPanoSekmeleri() {
    try { return await chrome.tabs.query({ url: KN_PANO }); } catch (e) { return []; }
}

/** Franchise jetonu ve izlenecek depo (açık panel sekmesinin adresinden) */
async function knOturum(sekmeler) {
    let bilgi = null;
    try { bilgi = (await chrome.storage.local.get('getir_api_info')).getir_api_info; } catch (e) { bilgi = null; }
    const jeton = bilgi && typeof bilgi.token === 'string' ? bilgi.token : '';
    if (!jeton) return { hata: 'Franchise oturumu yok: franchise-v2.getir.com bir kez açılmalı.' };
    if (knJwtBitis(jeton) < Date.now() + 30000) return { hata: 'Franchise oturumu süresi doldu: franchise-v2.getir.com sekmesini yenile.' };
    let depo = null;
    for (const t of sekmeler || []) {
        const m = /\/r\/([0-9a-f]{24})\//.exec(t.url || '');
        if (m) { depo = m[1]; break; }
    }
    if (!depo && KN_KIMLIK.test(String(bilgi.warehouseId || ''))) depo = bilgi.warehouseId;
    if (!depo) { try { const v = (await chrome.storage.local.get('jbaSonDepo')).jbaSonDepo; if (KN_KIMLIK.test(String(v || ''))) depo = v; } catch (e) { /* yok */ } }
    if (!depo) return { hata: 'Depo bilinmiyor: depo panelinin sipariş ekranını aç.' };
    return { yetki: /^Bearer /.test(jeton) ? jeton : 'Bearer ' + jeton, depo };
}

async function knGetir(o, yol, govde) {
    const r = await fetch(KN_GETIR + yol, {
        method: govde ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: o.yetki },
        body: govde ? JSON.stringify(govde) : undefined,
    });
    if (r.status === 401 || r.status === 403) { const h = new Error('oturum'); h.kod = 'oturum'; throw h; }
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
}

/** Deponun şehri (courier-plan bunu istiyor); günde bir okunur */
async function knSehir(o) {
    const gun = new Date().toDateString();
    try {
        const k = (await chrome.storage.local.get(KN_SEHIR))[KN_SEHIR];
        if (k && k.depo === o.depo && k.gun === gun && KN_KIMLIK.test(k.sehir)) return k.sehir;
    } catch (e) { /* yok */ }
    const liste = await knGetir(o, '/users/warehouses/');
    const w = (Array.isArray(liste) ? liste : []).find((x) => (x._id || x.id) === o.depo);
    const sehir = w && ((w.city && (w.city._id || w.city)) || (w.region && w.region.city));
    if (!KN_KIMLIK.test(String(sehir || ''))) throw new Error('şehir yok');
    try { await chrome.storage.local.set({ [KN_SEHIR]: { depo: o.depo, sehir, gun } }); } catch (e) { /* sessiz */ }
    return sehir;
}

/** Meşgul nedeni: panelin seçeneği (Yemek Molası, Yakıt Alımı...) + varsa not */
function knNeden(c) {
    const o = c && c.lastBusyOption;
    if (!o || typeof o !== 'object') return Number(c && c.status) >= 4000 ? 'Depo İkmali' : '';
    const ad = String(o.tr || o.en || '').trim();
    const not = String(o.comment || '').trim();
    return (ad + (not && not !== ad ? ': ' + not : '')).slice(0, 60);
}

function knDurumGrubu(s) {
    s = Number(s) || 0;
    if (s === 100) return 'musait';
    if (s === 200 || (s >= 4000 && s <= 4200)) return 'mesgul';
    if (s >= 400 && s <= 800) return 'sipariste';
    if (s === 900) return 'donen';
    return 'diger';
}

/** Ham yanıtlardan uyarı verisi (Getir panelinin kendi sayımıyla) */
function knHesapla(plan, kuryeler, depo, simdi) {
    const adaylar = (plan && Array.isArray(plan.warehouse) ? plan.warehouse : []).filter((x) => (x.warehouseId || (x.warehouse && x.warehouse._id) || x.warehouse) === depo);
    const p = adaylar.find((x) => Date.parse(x.startDate) <= simdi && simdi < Date.parse(x.endDate)) || adaylar[0];
    const planlanan = p && p.courierPlanByCourierType
        ? Object.values(p.courierPlanByCourierType).reduce((t, v) => t + (Number(v) || 0), 0) : 0;
    const liste = [];
    (Array.isArray(kuryeler) ? kuryeler : []).forEach((k) => {
        const c = k && k.courier ? k.courier : k;
        if (!c || c.warehouse !== depo) return;
        const bas = Date.parse(c.statusLastChangedAt || '');
        liste.push({ id: String(c._id || ''), ad: String(c.name || 'Kurye').slice(0, 60),
            foto: /^https:\/\//.test(c.picURL || '') ? c.picURL : '', status: Number(c.status) || 0,
            bas: Number.isFinite(bas) ? bas : null, neden: knNeden(c) });
    });
    return knOzet(planlanan, liste, simdi);
}

/** Kurye listesinden sayılar ve meşgul listesi (gerçek ve simülasyon ortak) */
function knOzet(planlanan, liste, simdi) {
    const sayi = { toplam: 0, musait: 0, sipariste: 0, donen: 0, mesgul: 0 };
    const mola = [];
    liste.forEach((k) => {
        k.dk = k.bas != null ? Math.max(0, Math.floor((simdi - k.bas) / 60000)) : null;
        if (k.grupBas != null) k.dkGrup = Math.max(0, Math.floor((simdi - k.grupBas) / 60000));
        sayi.toplam++;
        const g = knDurumGrubu(k.status);
        if (g !== 'diger') sayi[g]++;
        if (g === 'mesgul') mola.push({ id: k.id, ad: k.ad, foto: k.foto, dk: k.dk, neden: k.neden });
    });
    const aktif = sayi.musait + sayi.sipariste + sayi.donen;
    return { planlanan, aktif, eksik: Math.max(0, planlanan - aktif), sayi, mola, kuryeler: liste, zaman: simdi };
}

/** "Siparişte" bir kod aralığı: kuryenin aralığa girdiği an izlenir */
async function knGrupTakip(sonuc) {
    let eski = {};
    try { eski = (await chrome.storage.session.get(KN_GRUP))[KN_GRUP] || {}; } catch (e) { eski = {}; }
    const yeni = {};
    const simdi = sonuc.zaman;
    sonuc.kuryeler.forEach((k) => {
        if (!(k.status >= 400 && k.status <= 800)) return;
        const o = eski[k.id];
        k.grupBas = o && Number.isFinite(o) ? o : (k.bas != null ? k.bas : simdi);
        yeni[k.id] = k.grupBas;
        k.dkGrup = Math.max(0, Math.floor((simdi - k.grupBas) / 60000));
    });
    try { await chrome.storage.session.set({ [KN_GRUP]: yeni }); } catch (e) { /* sessiz */ }
}

async function knErteleOku() {
    try { return (await chrome.storage.local.get(KN_ERTELE))[KN_ERTELE] || { eksik: 0, mola: {} }; } catch (e) { return { eksik: 0, mola: {} }; }
}

/** Sekmelere gidecek uyarı: ayar ve ertelemeler uygulanmış hali */
async function knUyari(sonuc, sim) {
    const e = await knErteleOku();
    const simdi = Date.now();
    const eksikGoster = !!sonuc && knAyar.eksik && sonuc.eksik > 0 && (sim || !(e.eksik > simdi));
    const uzun = [];
    if (sonuc && knAyar.mola) {
        (sonuc.kuryeler || []).forEach((k) => {
            for (const x of KN_ADIMLAR) {
                const esik = knAyar.esik[x.ad];
                if (!esik || !x.tut(k.status)) continue;
                const dk = x.grup ? k.dkGrup : k.dk;
                if (dk == null || dk < esik) continue;
                const id = k.id + ':' + x.ad;
                if (!sim && (e.mola || {})[id] > simdi) break;
                uzun.push({ id, ad: k.ad, foto: k.foto, dk, fiil: x.fiil, neden: x.ad === 'mesgul' ? k.neden : '' });
                break;
            }
        });
    }
    uzun.sort((a, b) => b.dk - a.dk);
    return {
        type: 'JBA_KURYE_UYARI', sim: !!sim,
        eksik: eksikGoster ? { planlanan: sonuc.planlanan, aktif: sonuc.aktif, eksik: sonuc.eksik, sayi: sonuc.sayi,
            mesgul: sonuc.mola.slice().sort((a, b) => (b.dk || 0) - (a.dk || 0)) } : null,
        mola: uzun, zaman: simdi,
    };
}

async function knYay(mesaj, sekmeler) {
    for (const t of sekmeler || (await knPanoSekmeleri())) chrome.tabs.sendMessage(t.id, mesaj).catch(() => {});
}

/* Ses: uyarı yeni başladıysa hemen, sürüyorsa seçilen aralıkla */
async function knSes(mesaj) {
    if (!knAyar.sesAcik || mesaj.sim) return;
    const imza = (mesaj.eksik ? 'e' + mesaj.eksik.eksik : '') + '|' + mesaj.mola.map((m) => m.id).join(',');
    const var_ = !!(mesaj.eksik || mesaj.mola.length);
    if (!var_) { knOncekiImza = ''; return; }
    const yeni = imza !== knOncekiImza;
    knOncekiImza = imza;
    if (!yeni && Date.now() - knSonSes < knAyar.sesAralik * 60000) return;
    knSonSes = Date.now();
    if (typeof globalThis.jbaSesCal === 'function') globalThis.jbaSesCal(knAyar.ses, 2, 0);
}

async function knDurumYaz(d) {
    try { await chrome.storage.local.set({ [KN_DURUM]: Object.assign({ zaman: Date.now() }, d) }); } catch (e) { /* sessiz */ }
}

async function knKontrol(zorla) {
    if (knCalisiyor) return;
    await knAyarOku();
    if (!knAyar.acik) return;
    if (!zorla && !knMesaiMi()) return;
    if (!zorla && Date.now() - knSonKontrol < knAyar.sn * 1000) return;
    const sekmeler = await knPanoSekmeleri();
    if (!sekmeler.length) return; // uyarı gösterilecek yer yoksa istek de yok
    knCalisiyor = true;
    knSonKontrol = Date.now();
    try {
        const o = await knOturum(sekmeler);
        if (o.hata) { await knDurumYaz({ hata: o.hata }); return; }
        const sehir = await knSehir(o);
        // Plan saatlik; panel yalnız saat başını kabul ediyor, anlık zamanla boş dönüyor
        const saatBasi = new Date(); saatBasi.setMinutes(0, 0, 0);
        const plan = await knGetir(o, '/warehouses/courier-plan/' + sehir + '?currentDate=' + saatBasi.getTime());
        const kur = await knGetir(o, '/courier/filter', { isLoggedIn: true });
        knSon = knHesapla(plan, kur && kur.couriers, o.depo, Date.now());
        await knGrupTakip(knSon);
        const mesaj = await knUyari(knSon, false);
        await knYay(mesaj, sekmeler);
        await knSes(mesaj);
        await knDurumYaz({ planlanan: knSon.planlanan, aktif: knSon.aktif, eksik: knSon.eksik, sayi: knSon.sayi, uzunMola: mesaj.mola.length });
    } catch (e) {
        await knDurumYaz({ hata: e && e.kod === 'oturum' ? 'Franchise oturumu geçersiz: franchise-v2.getir.com sekmesini yenile.' : 'Okunamadı (' + String(e && e.message || e).slice(0, 40) + ')' });
    } finally {
        knCalisiyor = false;
    }
}

/* Sipariş panosu nöbetçisi her 2 sn çağırır (arka-plan/pano-nobet.js) */
globalThis.jbaKuryeNabiz = function () { knKontrol(false); };

/* Simülasyon: her basışta rastgele bir durum. Oturum varsa depodaki gerçek
   kuryelerin ad ve fotoğrafı kullanılır (yalnız ekranda, hiçbir yere yazılmaz),
   durum, süre ve neden uydurulur. Kart çarpıya basılana kadar durur. */
const KN_SIM_NEDEN = ['Yemek Molası', 'Yakıt Alımı', 'Kısa Mola', 'Araç Bakımı'];
const KN_SIM_AD = ['Örnek Kurye', 'Deneme Kurye', 'Test Kurye', 'Yedek Kurye', 'Gece Kurye', 'Hafta Sonu Kurye'];
const knRast = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const knSec = (d) => d[Math.floor(Math.random() * d.length)];

async function knSimKuryeler() {
    try {
        const sekmeler = await knPanoSekmeleri();
        const o = await knOturum(sekmeler);
        if (o.hata) return [];
        const kur = await knGetir(o, '/courier/filter', { isLoggedIn: true });
        return (kur && Array.isArray(kur.couriers) ? kur.couriers : []).map((k) => (k && k.courier) || k)
            .filter((c) => c && c.warehouse === o.depo)
            .map((c) => ({ id: String(c._id || ''), ad: String(c.name || 'Kurye').slice(0, 60), foto: /^https:\/\//.test(c.picURL || '') ? c.picURL : '' }));
    } catch (e) { return []; }
}

async function knSimulasyon() {
    await knAyarOku();
    const sekmeler = await knPanoSekmeleri();
    if (!sekmeler.length) return { ok: false, metin: 'Depo panelinin sipariş ekranı açık değil.' };
    let kisiler = await knSimKuryeler();
    if (kisiler.length < 3) kisiler = kisiler.concat(KN_SIM_AD.map((ad, i) => ({ id: 'sim-' + i, ad, foto: '' })));
    kisiler = kisiler.sort(() => Math.random() - 0.5).slice(0, knRast(3, Math.min(8, kisiler.length)));
    const simdi = Date.now();
    // Açık eşiklerden birkaçını aşan kurye olsun, gerisi rastgele
    const acikAdim = KN_ADIMLAR.filter((x) => knAyar.esik[x.ad]).sort(() => Math.random() - 0.5);
    const kodu = { mesgul: 200, toplama: 600, yolda: 700, adreste: 800, donen: 900, sipariste: knSec([400, 600, 700, 800]) };
    const liste = kisiler.map((k, i) => {
        let status, dk;
        const asan = i < Math.min(acikAdim.length, knRast(1, 2)) ? acikAdim[i] : null;
        if (asan) { status = kodu[asan.ad]; dk = knAyar.esik[asan.ad] + knRast(1, 25); }
        else { status = knSec([100, 100, 200, 600, 700, 800, 900]); dk = knRast(1, 9); }
        const kayit = Object.assign({}, k, { status, bas: simdi - dk * 60000, neden: status === 200 ? knSec(KN_SIM_NEDEN) : '' });
        if (status >= 400 && status <= 800) kayit.grupBas = kayit.bas;
        return kayit;
    });
    // En az bir meşgul olsun ki kartta meşgul listesi görünsün
    if (!liste.some((k) => k.status === 200)) { const k = liste[liste.length - 1]; k.status = 200; k.neden = knSec(KN_SIM_NEDEN); }
    const ozet = knOzet(0, liste, simdi);
    ozet.planlanan = ozet.aktif + knRast(1, 2);
    ozet.eksik = ozet.planlanan - ozet.aktif;
    const mesaj = await knUyari(ozet, true);
    mesaj.sure = KN_SIM_MS;
    await knYay(mesaj, sekmeler);
    if (knAyar.sesAcik && typeof globalThis.jbaSesCal === 'function') globalThis.jbaSesCal(knAyar.ses, 2, 0);
    return { ok: true };
}

chrome.runtime.onMessage.addListener((m, gonderen, cevapla) => {
    if (!m || typeof m.type !== 'string') return false;
    if (m.type === 'JBA_KURYE_ERTELE') {
        (async () => {
            const e = await knErteleOku();
            const bitis = Date.now() + Math.max(5, Math.min(240, Number(m.dk) || 15)) * 60000;
            if (m.tur === 'eksik') e.eksik = bitis;
            else if (m.tur === 'mola' && m.id) {
                e.mola = e.mola || {};
                Object.keys(e.mola).forEach((k) => { if (e.mola[k] < Date.now()) delete e.mola[k]; });
                e.mola[m.id] = bitis;
            }
            await chrome.storage.local.set({ [KN_ERTELE]: e });
            if (knSon) await knYay(await knUyari(knSon, false));
            cevapla({ ok: true });
        })();
        return true;
    }
    if (m.type === 'JBA_KURYE_PANO_HAZIR') {
        (async () => { if (knSon && Date.now() - knSon.zaman < 5 * 60000) await knYay(await knUyari(knSon, false), gonderen.tab ? [gonderen.tab] : null); })();
        return false;
    }
    if (m.type === 'JBA_KURYE_SIM') { knSimulasyon().then(cevapla, () => cevapla({ ok: false })); return true; }
    if (m.type === 'JBA_KURYE_SIMDI') {
        (async () => {
            await knAyarOku();
            if (!knAyar.acik) { cevapla({ ok: false, metin: 'Kurye uyarısı kapalı.' }); return; }
            if (!(await knPanoSekmeleri()).length) { cevapla({ ok: false, metin: 'Depo panelinin sipariş ekranı açık değil.' }); return; }
            knSonKontrol = 0;
            await knKontrol(true);
            cevapla({ ok: true });
        })();
        return true;
    }
    return false;
});

chrome.storage.onChanged.addListener((d, alan) => {
    if (alan !== 'local' || !d[KN_AYAR]) return;
    knAyarOku().then(() => {
        if (!knAyar.acik) knYay({ type: 'JBA_KURYE_UYARI', eksik: null, mola: [], zaman: Date.now() });
        else { knSonKontrol = 0; knKontrol(false); }
    });
});

// Hizmet işçisi uyursa diye dakikalık alarm (asıl tempo pano nabzı)
chrome.alarms.create('jba-kurye-nobet', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'jba-kurye-nobet') knKontrol(false); });
