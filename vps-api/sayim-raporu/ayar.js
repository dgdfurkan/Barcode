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
    // Boş PDF olmasın: hiçbir bölüm seçilmediyse özet açık
    if (!a.ozet && !a.grafik && !a.eksik && !a.fazla && !a.sayilmayan) a.ozet = true;
    return a;
}

const pdfVar = (a) => a.bicim === 'pdf' || a.bicim === 'ikisi';
const kartVar = (a) => a.bicim === 'kart' || a.bicim === 'ikisi';

module.exports = { VARSAYILAN, ayarDuzelt, pdfVar, kartVar };
