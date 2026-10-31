/**
 * Jet Barkod'un kendi ürün kataloğu (herkese açık products.json)
 * ============================================================================
 * Ürün kimliği ve adıyla görsel adresi; kimlikle barkod ve kategori. Gece raporu ve İtiraz Yazıcı ortak
 * kullanır; bellekte tek kopya. 12 saatte bir tazelenir; alınamazsa bir
 * saat sonra yeniden denenir.
 * ============================================================================
 */
const KATALOG = 'https://jetbarkod.com.tr/products.json';
const KIMLIK = /^[0-9a-f]{24}$/;

const sadeAd = (s) => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

let katalog = { zaman: 0, id: new Map(), ad: new Map(), bilgi: new Map() };
let suruyor = null;

async function yukle() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
        const r = await fetch(KATALOG, { signal: ctrl.signal });
        if (!r.ok) throw new Error('http ' + r.status);
        const j = await r.json();
        const liste = Array.isArray(j && j.products) ? j.products : [];
        const id = new Map();
        const ad = new Map();
        const bilgi = new Map();   // kimlik → { barkod, kategori } (Sayım Farkı kartı)
        liste.forEach((u) => {
            if (u && KIMLIK.test(String(u.id || ''))) {
                const b = Array.isArray(u.barcodes) && u.barcodes[0] && u.barcodes[0].code;
                bilgi.set(String(u.id), { barkod: b ? String(b).slice(0, 40) : '', kategori: String(u.category || '').slice(0, 80) });
            }
            if (!u || typeof u.image !== 'string' || !/^https:\/\//.test(u.image)) return;
            if (KIMLIK.test(String(u.id || ''))) id.set(String(u.id), u.image);
            if (u.name) ad.set(sadeAd(u.name), { id: String(u.id || ''), image: u.image, ad: String(u.name).slice(0, 200) });
        });
        katalog = { zaman: Date.now(), id, ad, bilgi };
    } catch (e) {
        katalog.zaman = Date.now() - 11 * 3600 * 1000;
    } finally {
        clearTimeout(t);
    }
    return katalog;
}

async function katalogAl() {
    if (Date.now() - katalog.zaman < 12 * 3600 * 1000) return katalog;
    if (!suruyor) suruyor = yukle().finally(() => { suruyor = null; });
    return suruyor;
}

module.exports = { katalogAl, sadeAd, KIMLIK };
