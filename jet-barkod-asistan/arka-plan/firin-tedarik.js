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
 *   - Depo panelinin tedarik listesi 15 dk'da bir panel sekmesine sorulur
 *     (sayfa-koprusu.js tedarikListesi): jbaFirinTedarik.
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
const FT_TEDARIK_MS = 15 * 60 * 1000;
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

async function ftTedarikOku() {
    try { return (await chrome.storage.local.get(FT_TEDARIK))[FT_TEDARIK] || null; } catch (e) { return null; }
}

/** Tedarik listesi; bayatsa verilen ya da açık bir panel sekmesine sorulur */
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
        for (const id of hedefler.slice(0, 3)) {
            let c = null;
            try { c = await chrome.tabs.sendMessage(id, { type: 'JBA_TEDARIK_SOR' }); } catch (e) { c = null; }
            if (c && c.ok && Array.isArray(c.teslimatlar)) {
                const kayit = { zaman: Date.now(), teslimatlar: c.teslimatlar };
                chrome.storage.local.set({ [FT_TEDARIK]: kayit }).catch(() => {});
                return kayit;
            }
        }
        return eski;
    })();
    try { return await ftTedarikSuruyor; } finally { ftTedarikSuruyor = null; }
}

/** Franchise Mevcut stok: ürün kimliği → raf (available). Okunamazsa {} */
async function ftRafStoklari(idler) {
    const temiz = [...new Set(idler.filter((x) => FT_KIMLIK.test(x)))].slice(0, 40);
    if (!temiz.length) return {};
    const anahtar = temiz.slice().sort().join(',');
    if (ftStok.anahtar === anahtar && Date.now() - ftStok.zaman < FT_STOK_MS) return ftStok.degerler;
    let bilgi = null;
    try { bilgi = (await chrome.storage.local.get('getir_api_info')).getir_api_info; } catch (e) { bilgi = null; }
    const jeton = bilgi && typeof bilgi.token === 'string' ? bilgi.token : '';
    const depo = bilgi && FT_KIMLIK.test(String(bilgi.warehouseId || '')) ? bilgi.warehouseId : null;
    if (!jeton || !depo) return {};
    const degerler = {};
    try {
        const r = await fetch(FT_GETIR + '/stocks?offset=0&limit=' + temiz.length, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: /^Bearer /.test(jeton) ? jeton : 'Bearer ' + jeton },
            body: JSON.stringify({ productIds: temiz, warehouseIds: [depo] }),
        });
        if (!r.ok) return {};
        const j = await r.json();
        ((j && j.data) || []).forEach((x) => {
            const id = String(x.product || x.id || x._id || '');
            if (typeof x.available === 'number') degerler[id] = Math.max(0, x.available);
        });
    } catch (e) {
        return {};
    }
    ftStok = { zaman: Date.now(), anahtar, degerler };
    return degerler;
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
        if (!t || Date.now() - t.zaman >= FT_TEDARIK_MS) ftTedarik(sekmeId, false).catch(() => {});
    }
    if (!t || !Array.isArray(t.teslimatlar)) return [];
    const simdi = Date.now();
    // Ürün başına en son kabul edilen teslimat
    const gelen = {};
    t.teslimatlar.forEach((x) => {
        if (!x || !x.kabul || !/^(COMPLETED|CLOSED)$/.test(x.durum || '')) return;
        (x.urunler || []).forEach((u) => {
            if (!ftLaLorraine(u.ad) || !(u.alinan > 0)) return;
            const k = ftSade(u.ad);
            if (!gelen[k] || gelen[k].kabul < x.kabul) gelen[k] = { ad: u.ad, id: u.id, gorsel: u.gorsel, alinan: u.alinan, kabul: x.kabul };
        });
    });
    const adaylar = [];
    Object.keys(gelen).forEach((k) => {
        if (varOlan.has(k)) return;
        const g = gelen[k];
        const bil = b[k];
        if (bil && !(g.kabul > bil.son)) return; // geldikten sonra listede görüldü, donuğu bitti
        if (!bil && simdi - g.kabul > FT_YENI_GUN * 864e5) return;
        adaylar.push({ k, g, bil });
    });
    if (!adaylar.length) return [];
    const raf = await ftRafStoklari(adaylar.map((a) => a.g.id));
    const suan = ftDilim(new Date().getHours());
    const satirlar = [];
    adaylar.forEach(({ g, bil }) => {
        const oneriler = bil && Array.isArray(bil.oneriler) ? bil.oneriler : [0, 0, 0, 0];
        const hedef = oneriler[suan] || Math.max(0, ...oneriler) || 2;
        const r = Object.prototype.hasOwnProperty.call(raf, g.id) ? raf[g.id] : null;
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

/** firin-nobet.js: bildirim listesine listeden düşen La Lorraine ürünlerini ekler */
globalThis.jbaFirinListeDisi = async function (cevap, sekmeId) {
    if (!cevap || !cevap.ok) return cevap;
    try {
        if (cevap.laLorraine) await globalThis.jbaFirinBilinenYaz(cevap.laLorraine);
        const ek = await ftListeDisi(cevap.adlar || [], sekmeId, false);
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

/** Önümüzdeki 7 günün (bugün dahil) gelmemiş La Lorraine teslimatları */
function ftPlan(t) {
    if (!t || !Array.isArray(t.teslimatlar)) return [];
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const son = bugun.getTime() + 8 * 864e5;
    return t.teslimatlar
        .filter((x) => x && x.beklenen && x.beklenen >= bugun.getTime() && x.beklenen < son && !/^(COMPLETED|CLOSED)$/.test(x.durum || ''))
        .sort((a, b) => a.beklenen - b.beklenen)
        .map((x) => ({
            beklenen: x.beklenen,
            urunler: (x.urunler || []).filter((u) => ftLaLorraine(u.ad)).map((u) => ({ ad: u.ad, siparis: u.siparis })),
        }))
        .filter((x) => x.urunler.length);
}

chrome.runtime.onMessage.addListener((m, gonderen, cevapla) => {
    if (!m || m.type !== 'JBA_FIRIN_LALORRAINE') return false;
    (async () => {
        const sekme = gonderen && gonderen.tab ? gonderen.tab.id : null;
        if (Array.isArray(m.bilinen) && m.bilinen.length) await globalThis.jbaFirinBilinenYaz(m.bilinen);
        const t = await ftTedarik(sekme, !!m.tazele);
        const eksik = await ftListeDisi(Array.isArray(m.adlar) ? m.adlar : [], sekme, true);
        cevapla({ ok: !!t, zaman: t ? t.zaman : 0, plan: ftPlan(t), eksik });
    })().catch(() => cevapla({ ok: false, plan: [], eksik: [] }));
    return true;
});
