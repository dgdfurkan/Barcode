/**
 * Sayım raporu: ürün katalogu
 *
 * Sayım satırında yalnız ürün kimliği var; ad, barkod ve kategori sitenin
 * yayımladığı products.json'dan geliyor. Katalog sitede zaten herkese açık.
 *
 * - Bellekte yalnız rapora gereken üç alan tutuluyor (yaklaşık 1 MB).
 * - 6 saatte bir ETag ile soruluyor; değişmediyse 304, gövde inmiyor.
 * - Son başarılı kopya diske yazılıyor; servis yeniden başlayınca ağ
 *   beklemeden açılıyor, site o an erişilemese bile rapor çıkıyor.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const KATALOG_URL = process.env.RAPOR_KATALOG_URL || 'https://jetbarkod.com.tr/products.json';
const TAZELEME_MS = 6 * 60 * 60 * 1000;
const ZAMAN_ASIMI_MS = 30000;
const AZAMI_BOYUT = 40 * 1024 * 1024;
const DISK = path.join(__dirname, '..', 'veri', 'katalog-ozet.json');

let urunler = new Map();
let etag = '';
let sonDeneme = 0;
let yukleniyor = null;

function ozetle(json) {
    const liste = Array.isArray(json) ? json : json && Array.isArray(json.products) ? json.products : [];
    const m = new Map();
    for (const p of liste) {
        if (!p || p.id == null) continue;
        const bk = Array.isArray(p.barcodes) ? p.barcodes.find((b) => b && b.code) : null;
        m.set(String(p.id), {
            ad: String(p.name || '').slice(0, 200),
            barkod: bk ? String(bk.code).slice(0, 40) : '',
            kategori: String(p.category || '').slice(0, 80),
        });
    }
    return m;
}

function diskOku() {
    try {
        const ham = JSON.parse(fs.readFileSync(DISK, 'utf8'));
        if (ham && Array.isArray(ham.u)) {
            urunler = new Map(ham.u);
            etag = ham.etag || '';
        }
    } catch (e) { /* ilk açılış, dosya yok */ }
}

function diskeYaz() {
    try {
        fs.mkdirSync(path.dirname(DISK), { recursive: true });
        const gecici = DISK + '.yeni';
        fs.writeFileSync(gecici, JSON.stringify({ etag, u: [...urunler] }));
        fs.renameSync(gecici, DISK);
    } catch (e) {
        console.warn('katalog diske yazilamadi:', e.message);
    }
}

async function indir() {
    sonDeneme = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ZAMAN_ASIMI_MS);
    try {
        const res = await fetch(KATALOG_URL, {
            headers: etag && urunler.size ? { 'If-None-Match': etag } : {},
            signal: ctrl.signal,
        });
        if (res.status === 304) return;
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const boy = Number(res.headers.get('content-length') || 0);
        if (boy > AZAMI_BOYUT) throw new Error('katalog cok buyuk');
        const metin = await res.text();
        if (metin.length > AZAMI_BOYUT) throw new Error('katalog cok buyuk');
        const yeni = ozetle(JSON.parse(metin));
        if (yeni.size === 0) throw new Error('katalog bos');
        urunler = yeni;
        etag = res.headers.get('etag') || '';
        diskeYaz();
        console.log('katalog yuklendi:', urunler.size, 'urun');
    } finally {
        clearTimeout(t);
    }
}

/** Katalogu hazır et. Eldeki kopya tazeyse hemen döner. */
async function hazirla() {
    if (urunler.size === 0) diskOku();
    const bayat = Date.now() - sonDeneme > TAZELEME_MS;
    if (!bayat && urunler.size) return;
    if (!yukleniyor) {
        yukleniyor = indir()
            .catch((e) => console.warn('katalog indirilemedi:', e.message))
            .finally(() => { yukleniyor = null; });
    }
    // Elde kopya varsa bekleme; tazeleme arkada sürsün
    if (urunler.size === 0) await yukleniyor;
}

function bul(id) {
    return urunler.get(String(id)) || null;
}

module.exports = { hazirla, bul, ozetle };
