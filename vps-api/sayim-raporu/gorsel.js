/**
 * Sayım raporu: ürün görselleri
 *
 * PDF ve bilgi kartı için ürün görseli (480 px: PDF'te yakınlaştırınca da
 * net). Görseller katalogdaki herkese açık CDN adreslerinden alınıyor;
 * Getir API'sine istek yok.
 *
 * - cdn-image.getir.com: sunucu boyutlandırıyor (?width=480&format=jpeg),
 *   gelen dosya ~20-40 KB JPEG.
 * - Diğer izinli adresler tam boy JPEG/PNG veriyor; burada resvg ile
 *   480 px PNG'ye küçültülüyor.
 * - Her görsel bir kez indirilip diske yazılıyor; sonraki raporlar ağa
 *   çıkmıyor. Başarısız adres bir saat tekrar denenmiyor.
 * - Yalnız izinli alan adları, yalnız https, boyut ve süre sınırlı:
 *   katalogdaki bir adres sunucuyu başka bir yere istek atmaya zorlayamaz.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Klasör adı boyutla değişir: eski 160 px önbellek kullanılmaz
const KLASOR = path.join(__dirname, '..', 'veri', 'gorsel-480');
const BOY = 480;
const AZAMI_INDIRME = 3 * 1024 * 1024;
const ZAMAN_ASIMI_MS = 8000;
const AYNI_ANDA = 4;
const IZINLI = new Set(['cdn-image.getir.com', 'cdn.getir.com', 'vsrm-cdn.erp.getirapi.com']);

const basarisiz = new Map(); // id -> an
let Resvg = null;
try { ({ Resvg } = require('@resvg/resvg-js')); } catch (e) { /* küçültme kapalı, yalnız hazır JPEG */ }

try { fs.mkdirSync(KLASOR, { recursive: true }); } catch (e) { /* yazılamazsa önbelleksiz çalışır */ }
// Eski 160 px önbellek artık kullanılmıyor; diskte yer tutmasın
try { fs.rmSync(path.join(__dirname, '..', 'veri', 'gorsel'), { recursive: true, force: true }); } catch (e) { /* yoksa geç */ }

function jpegMi(b) { return b && b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; }
function pngMi(b) { return b && b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47; }

function dosyaYolu(id) {
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? path.join(KLASOR, id + '.img') : null;
}

function kucult(buf, tur) {
    if (!Resvg) return null;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BOY}" height="${BOY}">` +
        `<rect width="${BOY}" height="${BOY}" fill="#fff"/>` +
        `<image href="data:image/${tur};base64,${buf.toString('base64')}" width="${BOY}" height="${BOY}" preserveAspectRatio="xMidYMid meet"/></svg>`;
    try {
        return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
    } catch (e) {
        return null;
    }
}

async function indir(url) {
    let u;
    try { u = new URL(url); } catch (e) { return null; }
    if (u.protocol !== 'https:' || !IZINLI.has(u.hostname)) return null;
    if (u.hostname === 'cdn-image.getir.com') {
        u.search = `?width=${BOY}&format=jpeg`;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ZAMAN_ASIMI_MS);
    try {
        const res = await fetch(u.toString(), { signal: ctrl.signal, redirect: 'error' });
        if (!res.ok) return null;
        if (Number(res.headers.get('content-length') || 0) > AZAMI_INDIRME) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > AZAMI_INDIRME) return null;
        if (u.hostname === 'cdn-image.getir.com' && jpegMi(buf) && buf.length < 600 * 1024) return buf;
        if (jpegMi(buf)) return kucult(buf, 'jpeg');
        if (pngMi(buf)) return kucult(buf, 'png');
        return null;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(t);
    }
}

async function tekGetir(id, url) {
    const yol = dosyaYolu(id);
    if (!yol || !url) return null;
    try {
        const b = fs.readFileSync(yol);
        if (jpegMi(b) || pngMi(b)) return b;
    } catch (e) { /* önbellekte yok */ }
    const son = basarisiz.get(id);
    if (son && Date.now() - son < 3600 * 1000) return null;
    const b = await indir(url);
    if (!b) {
        basarisiz.set(id, Date.now());
        if (basarisiz.size > 20000) basarisiz.clear();
        return null;
    }
    try { fs.writeFileSync(yol, b); } catch (e) { /* önbelleksiz devam */ }
    return b;
}

/**
 * Birden çok ürünün görseli. Süre bütçesi dolarsa kalanlar görselsiz.
 * @param {Array<{id:string, gorsel:string}>} urunler
 * @returns {Promise<Map<string, Buffer>>}
 */
async function topluGetir(urunler, butceMs = 25000) {
    const sonuc = new Map();
    const kuyruk = urunler.filter((u, i, a) => u && u.id && u.gorsel && a.findIndex((x) => x.id === u.id) === i);
    const bitis = Date.now() + butceMs;
    let sira = 0;
    async function isci() {
        while (sira < kuyruk.length && Date.now() < bitis) {
            const u = kuyruk[sira++];
            const b = await tekGetir(u.id, u.gorsel);
            if (b) sonuc.set(u.id, b);
        }
    }
    await Promise.all(Array.from({ length: Math.min(AYNI_ANDA, kuyruk.length) }, isci));
    return sonuc;
}

/** Önbellek tavanı: en eski dosyalardan sil (günde bir) */
/** Görsel 480 px (~30 KB): 6000 dosya ~180 MB */
function budama(tavan = 6000) {
    try {
        const dosyalar = fs.readdirSync(KLASOR);
        if (dosyalar.length <= tavan) return;
        const bilgi = dosyalar
            .map((d) => {
                try { return { d, t: fs.statSync(path.join(KLASOR, d)).mtimeMs }; } catch (e) { return null; }
            })
            .filter(Boolean)
            .sort((a, b) => a.t - b.t);
        for (const x of bilgi.slice(0, bilgi.length - tavan)) {
            try { fs.unlinkSync(path.join(KLASOR, x.d)); } catch (e) { /* geç */ }
        }
    } catch (e) { /* klasör yok */ }
}

module.exports = { topluGetir, budama, kucultmeVar: () => !!Resvg };
