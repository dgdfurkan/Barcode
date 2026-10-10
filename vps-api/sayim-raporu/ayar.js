/**
 * Sayım raporu: gönderim ayarı
 *
 * Tarayıcının seçtiği şablon ve ayrıntılar buraya düz bir nesne olarak
 * geliyor. Hiçbir alana güvenilmiyor: bilinmeyen alan atılıyor, her değer
 * izinli listeden ya da tipine göre düzeltiliyor. Şablonların kendisi
 * tarayıcıda (js/sayim-rapor.js); sunucu yalnız sonucu doğruluyor.
 */
'use strict';

const VARSAYILAN = Object.freeze({
    sablon: 'tam',
    bicim: 'pdf', // pdf | kart | ikisi
    ozet: true,
    grafik: true,
    eksik: true,
    fazla: true,
    sayilmayan: true,
    gorsel: true,
    fiyat: true,
    barkod: true,
    sinir: 0, // liste başına en fazla ürün; 0 = sığdığı kadar
    kartTema: 'mavi', // acik | koyu | mavi
    kartUrunler: true, // kartta en çok eksik 3 ürün
    not: '',
    alicilar: [], // boşsa bağlı bütün Telegram hesapları
});

const BICIM = new Set(['pdf', 'kart', 'ikisi']);
const TEMA = new Set(['acik', 'koyu', 'mavi']);
const SINIR = new Set([0, 10, 25, 50]);
const MANTIK = ['ozet', 'grafik', 'eksik', 'fazla', 'sayilmayan', 'gorsel', 'fiyat', 'barkod', 'kartUrunler'];

function ayarDuzelt(ham) {
    const g = ham && typeof ham === 'object' && !Array.isArray(ham) ? ham : {};
    const a = { ...VARSAYILAN };
    if (typeof g.sablon === 'string' && /^[A-Za-z]{1,20}$/.test(g.sablon)) a.sablon = g.sablon;
    if (BICIM.has(g.bicim)) a.bicim = g.bicim;
    for (const k of MANTIK) if (typeof g[k] === 'boolean') a[k] = g[k];
    if (SINIR.has(Number(g.sinir))) a.sinir = Number(g.sinir);
    if (TEMA.has(g.kartTema)) a.kartTema = g.kartTema;
    if (typeof g.not === 'string') {
        a.not = g.not.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    }
    if (Array.isArray(g.alicilar)) {
        a.alicilar = [...new Set(g.alicilar.filter((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 5);
    } else {
        a.alicilar = [];
    }
    // Boş PDF olmasın: hiçbir bölüm seçilmediyse özet açık
    if (!a.ozet && !a.grafik && !a.eksik && !a.fazla && !a.sayilmayan) a.ozet = true;
    return a;
}

/**
 * Döngü özeti: tarayıcı sayım döngüsünün durumunu sayılarla gönderir
 * (toplam alt kategori ve duruma göre dağılım). Yalnız Döngü tablosunda
 * kullanılır; her alan tam sayıya ve toplamın içine sıkıştırılır.
 * @returns {{toplam:number, sayildi:number, suruyor:number, gecikti:number, yok:number, sure:number}|null}
 */
function donguDuzelt(ham) {
    if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return null;
    const sayi = (v, ust) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n > 0 ? Math.min(n, ust) : 0;
    };
    const toplam = sayi(ham.toplam, 2000);
    if (!toplam) return null;
    let kalan = toplam;
    const al = (v) => { const n = Math.min(sayi(v, 2000), kalan); kalan -= n; return n; };
    const sayildi = al(ham.sayildi);
    const suruyor = al(ham.suruyor);
    const gecikti = al(ham.gecikti);
    return { toplam, sayildi, suruyor, gecikti, yok: kalan, sure: sayi(ham.sure, 365) || 30 };
}

const donguMu = (tablo) => /^Döngü\|/.test(String(tablo || ''));

const pdfVar = (a) => a.bicim === 'pdf' || a.bicim === 'ikisi';
const kartVar = (a) => a.bicim === 'kart' || a.bicim === 'ikisi';

module.exports = { VARSAYILAN, ayarDuzelt, donguDuzelt, donguMu, pdfVar, kartVar };
