#!/usr/bin/env node
'use strict';

/**
 * veri-guncelle.js
 * ============================================================================
 * Admin panelde (jetbarkod.com.tr) "warehouse etiketlerini çek" işlemi bitince
 * inen products.json'u projedeki TÜM gerekli yerlere dağıtır ve sayfaların
 * yüklediği temp_products.js'i yeniden üretir. Elle kopyalamaya son.
 *
 * Tek kaynak products.json'dur; temp_products.js ondan türetilir
 * (const PRODUCTS_DATA = {...}). İnen temp_products.js'e gerek yok.
 *
 * Kullanım:
 *   node araclar/veri-guncelle.js [products.json yolu]
 *     yol verilmezse ~/Downloads içindeki en yeni products*.json alınır.
 *
 * Bayraklar:
 *   --kuru      hiçbir şey yazmaz, ne yapacağını listeler (önizleme)
 *   --zorla     yeni ürün sayısı mevcudun yarısından azsa bile yazar
 *   --yayinla   bitince değişenleri git add + commit + push eder
 *
 * GÜVENLİK: Yarım/bozuk bir indirmeyle iyi veriyi ezmemek için, yeni ürün
 * sayısı mevcudun yarısından azsa --zorla olmadan durur.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const KOK = path.resolve(__dirname, '..');
const arg = process.argv.slice(2);
const KURU = arg.includes('--kuru');
const ZORLA = arg.includes('--zorla');
const YAYINLA = arg.includes('--yayinla');
const yolArg = arg.find((a) => !a.startsWith('--'));

// products.json kopyaları (mevcut düzenle birebir; yeni yer eklenmez)
const PRODUCTS_HEDEF = [
    'products.json',
    'pages/products.json',
    'raftaki eksik ürünler/RafEksik/products.json',
];
// temp_products.js kopyaları: ilki sayfaların <script> ile yüklediği CANLI dosya
const TEMP_HEDEF = [
    'veri/temp_products.js',
    'pages/temp_products.js',
    'temp_products.js',
];

function cik(msg) { console.error('❌ ' + msg); process.exit(1); }

/** Kaynak products.json yolunu bul: arg > ~/Downloads en yeni products*.json */
function kaynakBul() {
    if (yolArg) {
        const p = path.resolve(yolArg);
        if (!fs.existsSync(p)) cik('Verilen yol yok: ' + p);
        return p;
    }
    const indir = path.join(os.homedir(), 'Downloads');
    if (!fs.existsSync(indir)) cik('İndirilenler klasörü yok, yolu elle ver: node araclar/veri-guncelle.js <yol>');
    const adaylar = fs.readdirSync(indir)
        .filter((f) => /^products.*\.json$/i.test(f))
        .map((f) => ({ f, p: path.join(indir, f), t: fs.statSync(path.join(indir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
    if (!adaylar.length) cik('İndirilenler içinde products*.json yok, yolu elle ver: node araclar/veri-guncelle.js <yol>');
    return adaylar[0].p;
}

/** YYYYMMDD */
function bugun() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** temp_products.js'i yükleyen html'lerdeki ?v= sürümünü bumplar. Yeni sürümü döndürür. */
function surumBumpla(yaz) {
    const htmller = [];
    (function tara(dizin) {
        for (const ad of fs.readdirSync(dizin)) {
            if (ad === 'node_modules' || ad === '.git') continue;
            const tam = path.join(dizin, ad);
            const st = fs.statSync(tam);
            if (st.isDirectory()) tara(tam);
            else if (ad.endsWith('.html')) htmller.push(tam);
        }
    })(KOK);

    const re = /veri\/temp_products\.js\?v=(\d{8})([a-z]*)/g;
    const mevcut = new Set();
    const dokunulan = [];
    for (const h of htmller) {
        const s = fs.readFileSync(h, 'utf8');
        let m; re.lastIndex = 0;
        let bulundu = false;
        while ((m = re.exec(s)) !== null) { mevcut.add(m[1] + m[2]); bulundu = true; }
        if (bulundu) dokunulan.push(h);
    }
    // Yeni sürüm: bugün + mevcutta olmayan ilk harf (aynı gün tekrar çalışınca b, c...)
    const g = bugun();
    let harf = 'a';
    while (mevcut.has(g + harf)) harf = String.fromCharCode(harf.charCodeAt(0) + 1);
    const yeni = g + harf;

    const yazilan = [];
    for (const h of dokunulan) {
        const s = fs.readFileSync(h, 'utf8');
        const s2 = s.replace(/veri\/temp_products\.js\?v=\d{8}[a-z]*/g, 'veri/temp_products.js?v=' + yeni);
        if (s2 !== s) { if (yaz) fs.writeFileSync(h, s2, 'utf8'); yazilan.push(path.relative(KOK, h)); }
    }
    return { yeni, yazilan };
}

// --- akış ---
const kaynak = kaynakBul();
let veri;
try {
    veri = JSON.parse(fs.readFileSync(kaynak, 'utf8'));
} catch (e) { cik('Kaynak JSON çözülemedi: ' + e.message); }
if (!veri || !Array.isArray(veri.products) || !veri.products.length) {
    cik("Kaynak geçersiz: beklenen biçim { products: [...] }");
}
const yeniSayi = veri.products.length;

// Güvenlik: mevcut root products.json ürün sayısıyla kıyasla
let mevcutSayi = 0;
try {
    const r = JSON.parse(fs.readFileSync(path.join(KOK, 'products.json'), 'utf8'));
    mevcutSayi = Array.isArray(r.products) ? r.products.length : 0;
} catch (_) { /* yoksa 0 */ }
if (mevcutSayi && yeniSayi < mevcutSayi / 2 && !ZORLA) {
    cik(`Yeni ürün sayısı (${yeniSayi}) mevcudun (${mevcutSayi}) yarısından az. ` +
        `Yarım indirme olabilir. Yine de yazmak için --zorla ekle.`);
}

const jsonMetin = JSON.stringify(veri, null, 2);
const tempMetin = `const PRODUCTS_DATA = ${jsonMetin};`;

console.log(`📦 Kaynak: ${kaynak}`);
console.log(`📊 Ürün: ${yeniSayi}${mevcutSayi ? ` (mevcut ${mevcutSayi})` : ''}`);
console.log(KURU ? '— KURU ÇALIŞMA: hiçbir şey yazılmıyor —' : '— Yazılıyor —');

for (const rel of PRODUCTS_HEDEF) {
    const p = path.join(KOK, rel);
    if (!KURU) fs.writeFileSync(p, jsonMetin, 'utf8');
    console.log(`  products.json → ${rel}`);
}
for (const rel of TEMP_HEDEF) {
    const p = path.join(KOK, rel);
    if (!KURU) fs.writeFileSync(p, tempMetin, 'utf8');
    console.log(`  temp_products.js → ${rel}`);
}

const { yeni, yazilan } = surumBumpla(!KURU);
console.log(`  sürüm → ?v=${yeni} (${yazilan.length} html)`);

if (KURU) { console.log('✅ Önizleme bitti. Gerçek güncelleme için --kuru olmadan çalıştır.'); process.exit(0); }

if (YAYINLA) {
    try {
        // .gitignore'daki kopyalar (pages/*, root temp_products.js) eklenemez; ayıkla
        const aday = [...PRODUCTS_HEDEF, ...TEMP_HEDEF, ...yazilan];
        const yoksay = new Set();
        try {
            const o = execSync(`git -C '${KOK}' check-ignore ${aday.map((r) => `'${r}'`).join(' ')}`, { encoding: 'utf8' });
            o.split('\n').map((s) => s.trim()).filter(Boolean).forEach((s) => yoksay.add(s));
        } catch (e) {
            // check-ignore hiçbiri yok sayılmıyorsa 1 döner; eşleşenler yine stdout'ta
            if (e.stdout) String(e.stdout).split('\n').map((s) => s.trim()).filter(Boolean).forEach((s) => yoksay.add(s));
        }
        const eklenecek = aday.filter((r) => !yoksay.has(r));
        const dosyalar = eklenecek.map((r) => `'${r}'`).join(' ');
        execSync(`git -C '${KOK}' add ${dosyalar}`, { stdio: 'inherit' });
        execSync(`git -C '${KOK}' commit -m "🗂️ Ürün verisi güncellendi: ${yeniSayi} ürün, temp_products.js yeniden üretildi, sürüm ?v=${yeni}"`, { stdio: 'inherit' });
        execSync(`git -C '${KOK}' push origin main`, { stdio: 'inherit' });
        console.log('🚀 Yayınlandı.');
    } catch (e) { cik('git adımı başarısız: ' + e.message); }
} else {
    console.log('✅ Dosyalar güncellendi. Yayınlamak için: git add -A && git commit && git push  (ya da --yayinla ile çalıştır)');
}
