/**
 * Hasar fotoğrafı deposu (Satıştan Kaldırma)
 * ============================================================================
 *
 * NEDEN
 *   Panelin hasar fotoğrafı linkleri ~15 dk geçerli imzalı S3 adresi; yenisi
 *   yalnız panelin kendi oturumuyla alınabiliyor. Fotoğraf değişmediği için
 *   Asistan linki ilk getirdiğinde (taze iken) bir kez indirilip burada
 *   saklanır; sonra her cihaz buradan görür, Getir'e yeniden gidilmez.
 *
 * NEREDE
 *   HASAR_DIZIN (varsayılan: uygulama klasöründe veri/hasar). Herkese açık
 *   depolama klasörü (STORAGE_ROOT) DEĞİL. Dosya adı S3 nesne yolunun
 *   özetidir (sorgu kısmı hariç): aynı fotoğraf bir kez inir.
 *
 * SUNUM
 *   Sahibine imzalı, süreli adresle: /api/kaldirma/hasar/<anahtar>?Expires=..&imza=..
 *   İmza JWT_SECRET'tan türetilen anahtarla (HMAC). Adresi yalnız kaydın
 *   sahibi alır (GET /api/kaldirma/fotolar/:id hesabı denetler).
 *
 * SINIRLAR
 *   Dosya başına 8 MB, yalnız JPEG ya da PNG. Aynı anda en çok 2 indirme.
 *   120 günden eski dosyalar günde bir silinir.
 * ============================================================================
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DIZIN = path.resolve(process.env.HASAR_DIZIN || path.join(__dirname, '..', 'veri', 'hasar'));
const S3 = /^https:\/\/getir-stock\.s3\.[a-z0-9-]+\.amazonaws\.com\/(?:blocked-stock|transfer)\/[^\s"'<>]+$/;
const ANAHTAR = /^[a-f0-9]{40}$/;
const AZAMI_BAYT = 8 * 1024 * 1024;
const SAKLAMA_MS = 120 * 24 * 3600 * 1000;
const LINK_MS = 6 * 3600 * 1000;

const imzaAnahtari = crypto.createHash('sha256')
    .update('hasar-foto|' + (process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')))
    .digest();

let dizinHazir = null;
function dizinKur() {
    if (!dizinHazir) dizinHazir = fsp.mkdir(DIZIN, { recursive: true, mode: 0o750 }).catch((e) => { dizinHazir = null; throw e; });
    return dizinHazir;
}

/** S3 adresinin kalıcı anahtarı: nesne yolu (imza sorgusu hariç) */
function anahtar(adres) {
    if (!S3.test(String(adres || ''))) return null;
    try {
        const u = new URL(adres);
        return crypto.createHash('sha1').update(u.origin + u.pathname).digest('hex');
    } catch (e) { return null; }
}

const dosyaYolu = (a) => path.join(DIZIN, a.slice(0, 2), a + '.img');

function varMi(a) {
    return !!a && ANAHTAR.test(a) && fs.existsSync(dosyaYolu(a));
}

async function oku(a) {
    if (!a || !ANAHTAR.test(a)) return null;
    try { return await fsp.readFile(dosyaYolu(a)); } catch (e) { return null; }
}

function tur(b) {
    if (b && b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
    if (b && b[0] === 0x89 && b[1] === 0x50) return 'image/png';
    return null;
}

/** Süreli linkten indirir ve saklar. Dönüş: Buffer | null */
async function indir(adres) {
    const a = anahtar(adres);
    if (!a) return null;
    if (varMi(a)) return oku(a);
    try {
        const bitis = Number(new URL(adres).searchParams.get('Expires'));
        if (bitis && bitis * 1000 < Date.now() + 3000) return null;
    } catch (e) { return null; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
        const r = await fetch(adres, { signal: ctrl.signal, redirect: 'error' });
        if (!r.ok) return null;
        const b = Buffer.from(await r.arrayBuffer());
        if (!b.length || b.length > AZAMI_BAYT || !tur(b)) return null;
        await dizinKur();
        const yol = dosyaYolu(a);
        await fsp.mkdir(path.dirname(yol), { recursive: true, mode: 0o750 });
        const gecici = yol + '.' + process.pid + '.' + Date.now();
        await fsp.writeFile(gecici, b, { mode: 0o640 });
        await fsp.rename(gecici, yol);
        return b;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(t);
    }
}

// Arka plan kuyruğu: Asistan'ın yazdığı taze linkler sırayla, aynı anda en çok 2
const kuyruk = [];
const kuyrukta = new Set();
let calisan = 0;

function sirayaAl(adresler) {
    for (const adres of adresler || []) {
        const a = anahtar(adres);
        if (!a || kuyrukta.has(a) || varMi(a)) continue;
        if (kuyruk.length > 2000) break;
        kuyrukta.add(a);
        kuyruk.push({ a, adres });
    }
    while (calisan < 2 && kuyruk.length) {
        const is = kuyruk.shift();
        calisan++;
        indir(is.adres).catch(() => null).finally(() => {
            calisan--;
            kuyrukta.delete(is.a);
            sirayaAl([]);
        });
    }
}

function imza(a, son) {
    return crypto.createHmac('sha256', imzaAnahtari).update(a + '|' + son).digest('hex').slice(0, 32);
}

/** Sahibine verilen süreli adres (göreli; sayfa API köküne ekler) */
function imzaliAdres(a, kok) {
    const son = Math.floor((Date.now() + LINK_MS) / 1000);
    return kok + '/api/kaldirma/hasar/' + a + '?Expires=' + son + '&imza=' + imza(a, son);
}

function imzaDogru(a, son, verilen) {
    if (!ANAHTAR.test(String(a || '')) || !/^[0-9]{9,11}$/.test(String(son || '')) || !/^[a-f0-9]{32}$/.test(String(verilen || ''))) return false;
    if (Number(son) * 1000 < Date.now()) return false;
    const beklenen = Buffer.from(imza(a, son));
    const gelen = Buffer.from(String(verilen));
    return beklenen.length === gelen.length && crypto.timingSafeEqual(beklenen, gelen);
}

/** 120 günden eski dosyaları siler (günde bir) */
async function temizle() {
    let altlar = [];
    try { altlar = await fsp.readdir(DIZIN); } catch (e) { return; }
    const sinir = Date.now() - SAKLAMA_MS;
    for (const alt of altlar) {
        if (!/^[a-f0-9]{2}$/.test(alt)) continue;
        let dosyalar = [];
        try { dosyalar = await fsp.readdir(path.join(DIZIN, alt)); } catch (e) { continue; }
        for (const d of dosyalar) {
            const yol = path.join(DIZIN, alt, d);
            try {
                const st = await fsp.stat(yol);
                if (st.mtimeMs < sinir || /\.\d+\.\d+$/.test(d) && st.mtimeMs < Date.now() - 3600000) await fsp.unlink(yol);
            } catch (e) { /* silinmiş */ }
        }
    }
}
setInterval(() => { temizle().catch(() => {}); }, 24 * 3600 * 1000).unref();
setTimeout(() => { temizle().catch(() => {}); }, 60 * 1000).unref();

module.exports = { anahtar, varMi, oku, indir, sirayaAl, imzaliAdres, imzaDogru, tur, DIZIN };
