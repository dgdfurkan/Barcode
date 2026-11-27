/**
 * Fırın tedariki: pişirme önerisinden düşen La Lorraine ürünü ve haftalık plan
 * ============================================================================
 *
 * SORUN
 * Donuk stoğu 0 olan La Lorraine ürünü ertesi gün pişirme önerisinden
 * siliniyor. Ürün yeniden geldiğinde (mal kabul) öneriye dönmüyor, oysa
 * donukta stok var ve pişirilmesi gerekiyor.
 *
 * ÇÖZÜM
 *   - Öneri listesinde görülen her La Lorraine ürünü (ad, dört dilimin
 *     önerisi, son görülme) saklanır: jbaFirinBilinen.
 *   - Depo panelinin tedarik listesi 30 dk'da bir (07:00-24:00) ve gün sonu
 *     çıkışından sonra 23:35'te kendiliğinden, açık bir depo paneli
 *     sekmesine sorulur (sayfa-koprusu.js tedarikListesi): jbaFirinTedarik.
 *     Panel açık değilse istek atılmaz.
 *   - "Geldi" sayılan yalnız mal kabulü tamamlanmış teslimattaki alınan adet
 *     (acceptedCount). Siparişte olup gelmeyen ürün (alınan 0) gelmiş sayılmaz.
 *   - Asistan > Fırın > La Lorraine Takibi kapalıysa hiçbiri çalışmaz.
 *   - Bilinen ürün listede yoksa ve son görülmesinden SONRA kabul edilmiş
 *     bir teslimatta geldiyse donukta stok var demektir. Hiç görülmemiş La
 *     Lorraine ürünü son 3 günde geldiyse o da sayılır. Raf stoğu franchise
 *     panelinin Mevcut stok isteğinden (POST /stocks, productIds) okunur;
 *     rafta 0 ise ACİL, dilim önerisinin altındaysa PİŞİRME GEREKLİ.
 *   - Fırın sayfasındaki pişirme paneli önümüzdeki 7 günün La Lorraine
 *     teslimatlarını ve listeden düşen ürünleri gösterir.
 * ============================================================================
 */

const FT_BILINEN = 'jbaFirinBilinen';
const FT_TEDARIK = 'jbaFirinTedarik';
const FT_TEDARIK_MS = 30 * 60 * 1000;
const FT_AYAR = 'jbaLaLorraine';
const FT_DURUM = 'jbaLaLorraineDurum';
const FT_ALARM = 'jba-lalorraine';
const FT_ALARM_GECE = 'jba-lalorraine-gece';
const FT_BILINEN_GUN = 21;
const FT_YENI_GUN = 3;
const FT_STOK_MS = 60 * 1000;
const FT_GETIR = 'https://franchise-api-gateway.getirapi.com';
const FT_KIMLIK = /^[0-9a-f]{24}$/;
const FT_PANEL = 'https://warehouse.getir.com/r/*';

const ftSade = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const ftLaLorraine = (ad) => /^\s*la\s+lorraine\b/i.test(ad || '');

let ftBilinen = null;
let ftBilinenYazildi = 0;
let ftTedarikSuruyor = null;
let ftStok = { zaman: 0, anahtar: '', degerler: {} };

async function ftBilinenOku() {
    if (ftBilinen) return ftBilinen;
    try { ftBilinen = (await chrome.storage.local.get(FT_BILINEN))[FT_BILINEN] || {}; } catch (e) { ftBilinen = {}; }
    return ftBilinen;
}

/** firin-nobet.js her başarılı pişirme kontrolünden sonra: listede görülen La Lorraine ürünleri */
globalThis.jbaFirinBilinenYaz = async function (liste) {
    if (!Array.isArray(liste) || !liste.length) return;
    const b = await ftBilinenOku();
    const simdi = Date.now();
    let yeni = false;
    liste.forEach((u) => {
        if (!u || !ftLaLorraine(u.ad)) return;
        const k = ftSade(u.ad);
        if (!b[k]) yeni = true;
        const oneriler = (Array.isArray(u.oneriler) ? u.oneriler : []).slice(0, 4).map((x) => Math.max(0, Number(x) || 0));
        b[k] = {
            ad: String(u.ad).slice(0, 120),
            gorsel: /^https:\/\//.test(u.gorsel || '') ? u.gorsel : (b[k] && b[k].gorsel) || '',
            // Öneri 0 gelen günde son bilinen dolu öneri kalsın
            oneriler: oneriler.some((x) => x > 0) ? oneriler : (b[k] && b[k].oneriler) || oneriler,
            son: simdi,
        };
    });
    // Eskiyenleri at; yazma 5 dk'da bir (yeni ürün hemen)
    Object.keys(b).forEach((k) => { if (simdi - (b[k].son || 0) > FT_BILINEN_GUN * 864e5) delete b[k]; });
    if (yeni || simdi - ftBilinenYazildi > 5 * 60 * 1000) {
        ftBilinenYazildi = simdi;
        chrome.storage.local.set({ [FT_BILINEN]: b }).catch(() => {});
    }
};

async function ftAcik() {
    try { return ((await chrome.storage.local.get(FT_AYAR))[FT_AYAR] || {}).acik !== false; } catch (e) { return true; }
}

async function ftTedarikOku() {
    try { return (await chrome.storage.local.get(FT_TEDARIK))[FT_TEDARIK] || null; } catch (e) { return null; }
}

/** Tedarik listesi; bayatsa verilen ya da açık bir panel sekmesine sorulur.
    zorla: sayfa köprüsünün 10 dk'lık önbelleği de atlanır. */
let ftSonDeneme = { zaman: 0, ok: false, sebep: '' };
async function ftTedarik(sekmeId, zorla) {
    const eski = await ftTedarikOku();
    if (!zorla && eski && Date.now() - eski.zaman < FT_TEDARIK_MS) return eski;
    if (ftTedarikSuruyor) return ftTedarikSuruyor;
    ftTedarikSuruyor = (async () => {
        let hedefler = [];
        if (sekmeId) hedefler.push(sekmeId);
        try {
            (await chrome.tabs.query({ url: FT_PANEL })).forEach((t) => {
                if (t.status === 'complete' && !t.discarded && hedefler.indexOf(t.id) < 0) hedefler.push(t.id);
            });
        } catch (e) { /* sekme yok */ }
        let sebep = hedefler.length ? 'Panel cevap vermedi; sekmeyi yenile.' : 'Depo paneli açık değil.';
        for (const id of hedefler.slice(0, 3)) {
            let c = null;
            try { c = await chrome.tabs.sendMessage(id, { type: 'JBA_TEDARIK_SOR', zorla: !!zorla }); } catch (e) { c = null; }
            if (c && c.ok && Array.isArray(c.teslimatlar)) {
                const kayit = { zaman: Date.now(), teslimatlar: c.teslimatlar };
                chrome.storage.local.set({ [FT_TEDARIK]: kayit }).catch(() => {});
                ftSonDeneme = { zaman: Date.now(), ok: true, sebep: '' };
                return kayit;
            }
            if (c && c.sebep === 'oturum') sebep = 'Panel oturumu bekleniyor.';
            else if (c && c.sebep) sebep = 'Tedarik listesi okunamadı (' + c.sebep + ').';
        }
        ftSonDeneme = { zaman: Date.now(), ok: false, sebep };
        return eski;
    })();
    try { return await ftTedarikSuruyor; } finally { ftTedarikSuruyor = null; }
}

/* Depo: açık depo paneli sekmesinin adresinden. Franchise oturum kaydındaki
   depo kimliği başka bir depoya ait olabiliyor (birden çok depo), ona güvenilmez. */
async function ftDepo(bilgi) {
    try {
        for (const t of await chrome.tabs.query({ url: FT_PANEL })) {
            const m = /\/r\/([0-9a-f]{24})\//.exec(t.url || '');
            if (m) return m[1];
        }
    } catch (e) { /* sekme yok */ }
    try { const v = (await chrome.storage.local.get('jbaSonDepo')).jbaSonDepo; if (FT_KIMLIK.test(String(v || ''))) return v; } catch (e) { /* yok */ }
    return bilgi && FT_KIMLIK.test(String(bilgi.warehouseId || '')) ? bilgi.warehouseId : null;
}

/**
 * Franchise Mevcut stok: ürün kimliği → { raf, aktif }. Aynı adla iki ürün
 * olabiliyor (biri inaktif, status 0); karar kimlikle verilir.
 * @returns {Promise<{ok:boolean, degerler:Object}>}
 */
async function ftRafStoklari(idler) {
    const temiz = [...new Set(idler.filter((x) => FT_KIMLIK.test(x)))].slice(0, 40);
    if (!temiz.length) return { ok: true, degerler: {} };
    const anahtar = temiz.slice().sort().join(',');
    if (ftStok.anahtar === anahtar && Date.now() - ftStok.zaman < FT_STOK_MS) return { ok: true, degerler: ftStok.degerler };
    let bilgi = null;
    try { bilgi = (await chrome.storage.local.get('getir_api_info')).getir_api_info; } catch (e) { bilgi = null; }
    const jeton = bilgi && typeof bilgi.token === 'string' ? bilgi.token : '';
    const depo = await ftDepo(bilgi);
    if (!jeton || !depo) return { ok: false, degerler: {} };
    const degerler = {};
    try {
        const r = await fetch(FT_GETIR + '/stocks?offset=0&limit=' + temiz.length, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: /^Bearer /.test(jeton) ? jeton : 'Bearer ' + jeton },
            body: JSON.stringify({ productIds: temiz, warehouseIds: [depo] }),
        });
        if (!r.ok) return { ok: false, degerler: {} };
        const j = await r.json();
        ((j && j.data) || []).forEach((x) => {
            const id = String(x.product || x.id || x._id || '');
            degerler[id] = {
                raf: typeof x.available === 'number' ? Math.max(0, x.available) : null,
                aktif: x.status === undefined ? true : Number(x.status) === 1,
            };
        });
    } catch (e) {
        return { ok: false, degerler: {} };
    }
    ftStok = { zaman: Date.now(), anahtar, degerler };
    return { ok: true, degerler };
}

function ftDilim(saat) {
    if (saat < 12) return 0;
    if (saat < 16) return 1;
    if (saat < 20) return 2;
    return 3;
}

const ftTarih = (ms) => {
    const d = new Date(ms);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

/**
 * Pişirme önerisinde olmayan ama donuğu gelmiş La Lorraine ürünleri.
 * @param {string[]} mevcut öneri listesindeki adlar
 * @returns {Promise<Array>} bildirim satırları (firin-uyari.js biçimi)
 */
async function ftListeDisi(mevcut, sekmeId, bekle) {
    const varOlan = new Set((mevcut || []).map(ftSade));
    const b = await ftBilinenOku();
    let t;
    if (bekle) t = await ftTedarik(sekmeId, false);
    else {
        // Bildirim beklemesin: eldeki liste kullanılır, bayatsa arkada tazelenir
        t = await ftTedarikOku();
        if (!t || Date.now() - t.zaman >= FT_TEDARIK_MS) ftTedarik(sekmeId, false).then(ftDurumYaz).catch(() => {});
    }
    if (!t || !Array.isArray(t.teslimatlar)) return [];
    const simdi = Date.now();
    // Mal kabulle gelmiş, öneri listesinde olmayan La Lorraine kalemleri (kimlik bazında)
    const kalemler = [];
    t.teslimatlar.forEach((x) => {
        if (!x || !x.kabul || !/^(COMPLETED|CLOSED)$/.test(x.durum || '')) return;
        (x.urunler || []).forEach((u) => {
            if (!ftLaLorraine(u.ad) || !(u.alinan > 0) || !FT_KIMLIK.test(u.id || '')) return;
            if (varOlan.has(ftSade(u.ad))) return;
            kalemler.push({ ad: u.ad, id: u.id, gorsel: u.gorsel, alinan: u.alinan, kabul: x.kabul });
        });
    });
    if (!kalemler.length) return [];
    // Aynı adlı inaktif ürün (status 0) karışmasın: stok kaydı kimlikle okunur, inaktif ve
    // bu depoda olmayan kimlik elenir. Stok okunamadıysa eleme yapılamaz, hepsi kalır.
    const stok = await ftRafStoklari(kalemler.map((g) => g.id));
    const gelen = {};
    kalemler.forEach((g) => {
        const s = stok.degerler[g.id];
        if (stok.ok && (!s || !s.aktif)) return;
        const k = ftSade(g.ad);
        if (!gelen[k] || gelen[k].kabul < g.kabul) gelen[k] = g;
    });
    const adaylar = [];
    Object.keys(gelen).forEach((k) => {
        const g = gelen[k];
        const bil = b[k];
        if (bil && !(g.kabul > bil.son)) return; // geldikten sonra listede görüldü, donuğu bitti
        if (!bil && simdi - g.kabul > FT_YENI_GUN * 864e5) return;
        adaylar.push({ k, g, bil });
    });
    if (!adaylar.length) return [];
    const suan = ftDilim(new Date().getHours());
    const satirlar = [];
    adaylar.forEach(({ g, bil }) => {
        const oneriler = bil && Array.isArray(bil.oneriler) ? bil.oneriler : [0, 0, 0, 0];
        const hedef = oneriler[suan] || Math.max(0, ...oneriler) || 2;
        const s = stok.degerler[g.id];
        const r = s && typeof s.raf === 'number' ? s.raf : null;
        if (r !== null && r >= hedef) return;
        const pisir = Math.max(1, Math.min(g.alinan, hedef - (r || 0)));
        satirlar.push({
            ad: (bil && bil.ad) || g.ad,
            gorsel: (bil && bil.gorsel) || g.gorsel || '',
            raf: r === null ? 0 : r,
            donuk: g.alinan,
            oneri: hedef,
            pisir,
            seviye: r === 0 || r === null ? 'danger' : 'warning',
            hafif: r !== null && r > 0,
            listeDisi: true,
            sebep: 'Pişirme önerisinde yok. ' + ftTarih(g.kabul) + ' mal kabulde ' + g.alinan + ' adet geldi, ' +
                (r === null ? 'raf stoğu okunamadı.' : 'rafta ' + r + '.'),
            oneriler: oneriler.slice(0, 4),
        });
    });
    return satirlar;
}

/**
 * Rafta olup pişirme önerisinde (dolayısıyla eldeki stok özetinde ve 23:30
 * çıkış listesinde) görünmeyen La Lorraine ürünleri: son 14 günde mal kabulle
 * gelmiş, aktif (status 1), franchise raf stoğu 0'dan büyük. Aynı adlı inaktif
 * ürün kimlikle elenir. Barkod teslimat kaydından.
 */
async function ftStoktakiler(mevcut) {
    const varOlan = new Set((mevcut || []).map(ftSade));
    const t = await ftTedarikOku();
    if (!t || !Array.isArray(t.teslimatlar)) return [];
    const sinir = Date.now() - 14 * 864e5;
    const kalem = {};
    t.teslimatlar.forEach((x) => {
        if (!x || !x.kabul || x.kabul < sinir || !/^(COMPLETED|CLOSED)$/.test(x.durum || '')) return;
        (x.urunler || []).forEach((u) => {
            if (!ftLaLorraine(u.ad) || !(u.alinan > 0) || !FT_KIMLIK.test(u.id || '') || varOlan.has(ftSade(u.ad))) return;
            if (!kalem[u.id] || kalem[u.id].kabul < x.kabul) kalem[u.id] = Object.assign({}, u, { kabul: x.kabul });
        });
    });
    const idler = Object.keys(kalem);
    if (!idler.length) return [];
    const stok = await ftRafStoklari(idler);
    if (!stok.ok) return [];
    const b = await ftBilinenOku();
    const ada = {};
    idler.forEach((id) => {
        const s = stok.degerler[id];
        if (!s || !s.aktif || !(s.raf > 0)) return;
        const u = kalem[id];
        const k = ftSade(u.ad);
        if (ada[k] && ada[k].kabul >= u.kabul) return;
        ada[k] = {
            ad: u.ad, gorsel: u.gorsel || (b[k] && b[k].gorsel) || '', raf: s.raf,
            barkod: (u.barkodlar || [])[0] || '', kabul: u.kabul, alinan: u.alinan,
            oneriler: b[k] && Array.isArray(b[k].oneriler) ? b[k].oneriler.slice(0, 4) : null,
        };
    });
    return Object.values(ada).sort((x, y) => y.raf - x.raf);
}

/** firin-nobet.js 23:30-23:59: rafta kalan, öneri listesinde olmayan La Lorraine ürünleri de çıkarılsın */
globalThis.jbaFirinCikarEk = async function (cevap) {
    if (!cevap || !cevap.ok || !(await ftAcik())) return cevap;
    try {
        const ek = await ftStoktakiler(cevap.adlar || []);
        if (!ek.length) return cevap;
        const listede = new Set((cevap.liste || []).map((u) => ftSade(u.ad)));
        const yeni = ek.filter((u) => !listede.has(ftSade(u.ad))).map((u) => ({
            ad: u.ad, gorsel: u.gorsel, raf: u.raf, donuk: null, oneri: 0, pisir: u.raf, seviye: 'cikar', cikar: true,
            sebep: 'Gün sonu: rafta ' + u.raf + ' adet var. Tedarikten geldi, pişirme önerisinde yok.',
            oneriler: u.oneriler || [0, 0, 0, 0],
        }));
        if (!yeni.length) return cevap;
        cevap.liste = (cevap.liste || []).concat(yeni).sort((x, y) => (y.raf || 0) - (x.raf || 0));
        if (typeof cevap.gorunenSayisi === 'number') cevap.gorunenSayisi += yeni.length;
    } catch (e) { /* yan iş: çıkış uyarısını bozmasın */ }
    return cevap;
};

/** firin-nobet.js: bildirim listesine listeden düşen La Lorraine ürünlerini ekler */
globalThis.jbaFirinListeDisi = async function (cevap, sekmeId) {
    if (!cevap || !cevap.ok) return cevap;
    if (!(await ftAcik())) return cevap;
    try {
        if (cevap.laLorraine) await globalThis.jbaFirinBilinenYaz(cevap.laLorraine);
        let ek = await ftListeDisi(cevap.adlar || [], sekmeId, false);
        // PİŞİRME GEREKLİ (rafta var ama hedefin altında) yalnız tik açıksa bildirilir
        let gerekli = false;
        try { gerekli = ((await chrome.storage.local.get('jbaFirinGerekli')).jbaFirinGerekli || {}).acik === true; } catch (e) { gerekli = false; }
        if (!gerekli) ek = ek.filter((u) => u.seviye !== 'warning');
        if (!ek.length) return cevap;
        const listede = new Set((cevap.liste || []).map((u) => ftSade(u.ad)));
        const yeni = ek.filter((u) => !listede.has(ftSade(u.ad)));
        if (!yeni.length) return cevap;
        // Bildirim kartından ertelenen ürün (firin-uyari.js jbaFirinErtele): kart göstermez, alarm çalmaz
        let ertele = {};
        try { ertele = (await chrome.storage.local.get('jbaFirinErtele')).jbaFirinErtele || {}; } catch (e) { ertele = {}; }
        let gorunen = 0;
        yeni.forEach((u) => { if (Number(ertele[u.ad]) > Date.now()) u.ertelendi = true; else gorunen++; });
        cevap.liste = yeni.concat(cevap.liste || []);
        if (typeof cevap.gorunenSayisi === 'number') cevap.gorunenSayisi += gorunen;
    } catch (e) { /* yan iş: bildirimi bozmasın */ }
    return cevap;
};

/**
 * La Lorraine teslimatları: önümüzdeki 7 günün planlıları (sipariş adedi) ve
 * son 36 saatte mal kabulü bitenler (alınan / sipariş; alınan 0 = gelmedi).
 */
function ftPlan(t) {
    if (!t || !Array.isArray(t.teslimatlar)) return [];
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const son = bugun.getTime() + 8 * 864e5;
    const yakin = Date.now() - 36 * 3600 * 1000;
    const bitti = (x) => /^(COMPLETED|CLOSED)$/.test(x.durum || '') && !!x.kabul;
    return t.teslimatlar
        .filter((x) => x && (bitti(x) ? x.kabul >= yakin : (x.beklenen && x.beklenen >= bugun.getTime() && x.beklenen < son)))
        .map((x) => ({
            id: x.id,
            durum: bitti(x) ? 'geldi' : 'planli',
            beklenen: x.beklenen,
            kabul: bitti(x) ? x.kabul : null,
            urunler: (x.urunler || []).filter((u) => ftLaLorraine(u.ad))
                .map((u) => ({ ad: u.ad, gorsel: u.gorsel || '', siparis: u.siparis, alinan: bitti(x) ? u.alinan : null })),
        }))
        .filter((x) => x.urunler.length)
        .sort((a, b) => (a.kabul || a.beklenen || 0) - (b.kabul || b.beklenen || 0));
}

/** Asistan penceresindeki durum satırı */
function ftDurumYaz(t) {
    const plan = ftPlan(t);
    const parca = [];
    const geldi = plan.filter((x) => x.durum === 'geldi');
    if (geldi.length) {
        const u = geldi.flatMap((x) => x.urunler);
        const gelmeyen = u.filter((x) => !(x.alinan > 0)).length;
        parca.push('Son gelen: ' + (u.length - gelmeyen) + ' ürün' + (gelmeyen ? ', ' + gelmeyen + ' ürün gelmedi' : ''));
    }
    const planli = plan.filter((x) => x.durum === 'planli');
    if (planli.length) {
        const ilk = planli[0];
        const d = new Date(ilk.beklenen); d.setHours(0, 0, 0, 0);
        const b = new Date(); b.setHours(0, 0, 0, 0);
        const fark = Math.round((d - b) / 864e5);
        const gun = fark <= 0 ? 'Bugün' : fark === 1 ? 'Yarın' : new Date(ilk.beklenen).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        parca.push(gun + ' ' + ilk.urunler.length + ' ürün planlı');
    } else parca.push('7 gün içinde planlı teslimat yok');
    const metin = ftSonDeneme.ok || !ftSonDeneme.zaman ? parca.join(' · ') : ftSonDeneme.sebep + (t ? ' Son liste: ' + parca.join(' · ') : '');
    chrome.storage.local.set({ [FT_DURUM]: { zaman: ftSonDeneme.ok ? (t && t.zaman) : ftSonDeneme.zaman, ok: ftSonDeneme.ok, metin } }).catch(() => {});
}

/** 30 dk'da bir ve 23:35: panel açıksa tedarik listesi tazelenir */
async function ftOtomatik(gece) {
    if (!(await ftAcik())) return;
    const saat = new Date().getHours();
    if (!gece && saat < 7) return;
    const t = await ftTedarik(null, true);
    ftDurumYaz(t);
}

async function ftAlarmKur() {
    // Var olan alarm yeniden kurulmaz: hizmet işçisi her uyandığında sayaç sıfırlanmasın
    const var30 = await chrome.alarms.get(FT_ALARM).catch(() => null);
    if (!var30) chrome.alarms.create(FT_ALARM, { delayInMinutes: 1, periodInMinutes: 30 });
    const varGece = await chrome.alarms.get(FT_ALARM_GECE).catch(() => null);
    if (!varGece) {
        const d = new Date(); d.setHours(23, 35, 0, 0);
        if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        chrome.alarms.create(FT_ALARM_GECE, { when: d.getTime(), periodInMinutes: 1440 });
    }
}

chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === FT_ALARM) ftOtomatik(false).catch(() => {});
    else if (a.name === FT_ALARM_GECE) ftOtomatik(true).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => { ftAlarmKur().catch(() => {}); });
// Takip açılınca beklemeden bir kez bakılır
chrome.storage.onChanged.addListener((d, alan) => {
    if (alan === 'local' && d[FT_AYAR] && (d[FT_AYAR].newValue || {}).acik !== false) ftOtomatik(true).catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => { ftAlarmKur().catch(() => {}); });
ftAlarmKur().catch(() => {});

chrome.runtime.onMessage.addListener((m, gonderen, cevapla) => {
    if (m && m.type === 'JBA_LALORRAINE_SIMDI') {
        (async () => {
            if (!(await ftAcik())) { cevapla({ ok: false, metin: 'La Lorraine takibi kapalı.' }); return; }
            const t = await ftTedarik(null, true);
            ftDurumYaz(t);
            cevapla({ ok: ftSonDeneme.ok, metin: ftSonDeneme.sebep });
        })().catch(() => cevapla({ ok: false, metin: 'Kontrol edilemedi.' }));
        return true;
    }
    if (!m || m.type !== 'JBA_FIRIN_LALORRAINE') return false;
    (async () => {
        if (!(await ftAcik())) { cevapla({ ok: false, kapali: true, plan: [], eksik: [] }); return; }
        const sekme = gonderen && gonderen.tab ? gonderen.tab.id : null;
        if (Array.isArray(m.bilinen) && m.bilinen.length) await globalThis.jbaFirinBilinenYaz(m.bilinen);
        const t = await ftTedarik(sekme, !!m.tazele);
        const adlar = Array.isArray(m.adlar) ? m.adlar : [];
        const eksik = await ftListeDisi(adlar, sekme, true);
        const stokta = await ftStoktakiler(adlar);
        cevapla({ ok: !!t, zaman: t ? t.zaman : 0, plan: ftPlan(t), eksik, stokta });
    })().catch(() => cevapla({ ok: false, plan: [], eksik: [] }));
    return true;
});
