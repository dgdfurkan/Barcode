/**
 * Satıştan Kaldırma: görsel rapor (1080 px genişlik, boy içeriğe göre)
 *
 * Gruba atılacak tek görsel: hangi üründen kaç adet, hangi sebeple
 * satıştan kaldırıldı. SVG olarak kuruluyor, resvg ile PNG'ye çevriliyor;
 * fontlar ve logo sayım raporunun klasöründen (vps-api/sayim-raporu).
 *
 * Bölümler: üst bilgi, dört özet kutusu, sebeplere göre çubuklar, ürün
 * ızgarası (görsel, ×adet, ad, sebep, durum). En fazla 24 ürün; fazlası
 * "+N ürün daha" diye yazılıyor, görsel hiçbir içerikte taşmıyor.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');
const { Resvg } = require('@resvg/resvg-js');

const KAYNAK = path.join(__dirname, '..', 'sayim-raporu');
const FONT_DOSYALARI = ['DMSans-Regular', 'DMSans-SemiBold', 'Manrope-Bold', 'Manrope-ExtraBold']
    .map((f) => path.join(KAYNAK, 'fontlar', f + '.ttf'));
const OLCU = {
    govde: fontkit.openSync(FONT_DOSYALARI[0]),
    govdeKalin: fontkit.openSync(FONT_DOSYALARI[1]),
    baslik: fontkit.openSync(FONT_DOSYALARI[3]),
};
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(KAYNAK, 'logo.png')).toString('base64');

/* Depo panelindeki durum ve sonuç tipi kodları (panelin filtresinden ölçüldü) */
const DURUMLAR = {
    100: 'Oluşturuldu',
    150: 'Bekliyor',
    160: 'Depo Aksiyonu Bekleniyor',
    200: 'Onay Bekliyor',
    210: 'Onaylandı',
    300: 'Transfer Edilecek',
    350: 'Transfer Tamamlandı',
    500: 'Sonuçlandı',
    600: 'Tamamlandı',
    700: 'İptal Edildi',
};
const SONUC_TIPLERI = { 10: 'İade', 20: 'İmha', 30: 'Transfer', 40: 'Kurumsal Satış' };
const BITMIS = new Set([210, 350, 500, 600]);

const G = 1080;
const P = 64;
const IC = G - 2 * P;
const SUTUN = 4;
const ARA = 24;
const KUTU = Math.floor((IC - ARA * (SUTUN - 1)) / SUTUN);
const AZAMI_URUN = 24;

const R = {
    zemin: '#f6f7f9', kart: '#ffffff', cizgi: '#e4e7ec', yazi: '#111827', orta: '#344054', sonuk: '#667085',
    vurgu: '#2357e8', kirmizi: '#d92d20', kirmiziZemin: '#fef3f2', yesil: '#079455', sari: '#b54708', sariZemin: '#fffaeb',
};
/* ×N rengi, siparişlerdeki tik efektiyle aynı dil */
const ADET_RENK = { 1: '#111827', 2: '#2563eb', 3: '#7c3aed', 4: '#d97706', 5: '#d92d20' };

function kacir(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function genislik(font, metin, boy) {
    try { return (font.layout(String(metin)).advanceWidth / font.unitsPerEm) * boy; } catch (e) { return String(metin).length * boy * 0.55; }
}

function kirp(font, metin, boy, azami) {
    const s = String(metin || '');
    if (genislik(font, s, boy) <= azami) return s;
    let a = 0;
    let b = s.length;
    while (a < b) {
        const o = Math.ceil((a + b) / 2);
        if (genislik(font, s.slice(0, o) + '…', boy) <= azami) a = o; else b = o - 1;
    }
    return s.slice(0, a).trimEnd() + '…';
}

function ikiSatir(font, metin, boy, azami) {
    const kelimeler = String(metin || '').split(/\s+/).filter(Boolean);
    let ilk = '';
    let i = 0;
    for (; i < kelimeler.length; i++) {
        const deneme = ilk ? ilk + ' ' + kelimeler[i] : kelimeler[i];
        if (genislik(font, deneme, boy) > azami) break;
        ilk = deneme;
    }
    if (!ilk) return [kirp(font, metin, boy, azami)];
    if (i >= kelimeler.length) return [ilk];
    return [ilk, kirp(font, kelimeler.slice(i).join(' '), boy, azami)];
}

function yazi(x, y, icerik, { boy, aile = 'DM Sans', agirlik = 400, renk = R.yazi, hiza = 'start', aralik = 0 }) {
    return `<text x="${x}" y="${y}" font-family="${aile}" font-weight="${agirlik}" font-size="${boy}" fill="${renk}"` +
        ` text-anchor="${hiza}"${aralik ? ` letter-spacing="${aralik}"` : ''}>${kacir(icerik)}</text>`;
}

function veriUri(buf) {
    if (!buf) return '';
    return `data:image/${buf[0] === 0x89 ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
}

const adetYaz = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

function tarihEtiketi(a) {
    const g = (s) => {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long' });
    };
    return a.bas === a.son ? g(a.bas) : g(a.bas) + ' - ' + g(a.son);
}

/** Ürün başına toplam: adet, sebepler, en kötü durum */
function urunlereTopla(kayitlar) {
    const harita = new Map();
    for (const k of kayitlar) {
        const u = k.urun || {};
        const anahtar = u.id || u.ad || k.id;
        let x = harita.get(anahtar);
        if (!x) {
            x = { id: u.id, ad: u.ad || 'Ürün', adet: 0, sebepler: new Map(), iptal: 0, bekleyen: 0 };
            harita.set(anahtar, x);
        }
        x.adet += Number(k.adet) || 0;
        if (k.sebep) x.sebepler.set(k.sebep, (x.sebepler.get(k.sebep) || 0) + (Number(k.adet) || 0));
        if (k.durum === 700) x.iptal++;
        else if (!BITMIS.has(k.durum)) x.bekleyen++;
    }
    return [...harita.values()].sort((a, b) => b.adet - a.adet || a.ad.localeCompare(b.ad, 'tr'));
}

/**
 * @param {Array} kayitlar  /api/kaldirma/liste biçiminde
 * @param {{bas:string, son:string}} a
 * @param {Map<string, Buffer>} gorseller  ürün kimliği → görsel
 * @returns {Buffer} PNG
 */
function kartUret(kayitlar, a, gorseller) {
    const urunler = urunlereTopla(kayitlar);
    const toplamAdet = kayitlar.reduce((t, k) => t + (Number(k.adet) || 0), 0);
    const iptal = kayitlar.filter((k) => k.durum === 700).length;
    const bekleyen = kayitlar.filter((k) => k.durum !== 700 && !BITMIS.has(k.durum)).length;

    const sebepler = new Map();
    kayitlar.forEach((k) => {
        const s = k.sebep || 'Sebep yok';
        sebepler.set(s, (sebepler.get(s) || 0) + (Number(k.adet) || 0));
    });
    const sebepListesi = [...sebepler.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6);
    const enCok = sebepListesi.length ? sebepListesi[0][1] : 1;

    const gosterilen = urunler.slice(0, AZAMI_URUN);
    const satir = Math.ceil(gosterilen.length / SUTUN);
    const URUN_Y = KUTU + 112;

    // Boy: üst 160, özet 168, sebep 60+52/satır, ürün 60+satır, fazla 48, alt 96
    let H = P + 160 + 168;
    if (sebepListesi.length) H += 60 + sebepListesi.length * 52 + 24;
    H += gosterilen.length ? 60 + satir * (URUN_Y + ARA) : 120;
    if (urunler.length > gosterilen.length) H += 40;
    H += 96;
    H = Math.max(H, 1080);

    const p = [];
    p.push(`<rect width="${G}" height="${H}" fill="${R.zemin}"/>`);

    // Üst bilgi
    let y = P;
    p.push(`<rect x="${P}" y="${y}" width="72" height="72" rx="20" fill="#ffffff" stroke="${R.cizgi}"/>`);
    p.push(`<image href="${LOGO}" x="${P + 6}" y="${y + 6}" width="60" height="60"/>`);
    p.push(yazi(P + 92, y + 34, 'Satıştan Kaldırma', { boy: 34, aile: 'Manrope', agirlik: 800 }));
    p.push(yazi(P + 92, y + 64, 'Jet Barkod · fırın çıkışları hariç', { boy: 20, renk: R.sonuk }));
    const t = tarihEtiketi(a);
    const tG = genislik(OLCU.govdeKalin, t, 22) + 40;
    p.push(`<rect x="${G - P - tG}" y="${y + 14}" width="${tG}" height="44" rx="22" fill="#ffffff" stroke="${R.cizgi}"/>`);
    p.push(yazi(G - P - tG / 2, y + 43, t, { boy: 22, agirlik: 600, hiza: 'middle' }));
    y += 72 + 48;

    // Özet kutuları
    const kutular = [
        ['KAYIT', String(kayitlar.length), R.yazi],
        ['ADET', adetYaz(toplamAdet), R.yazi],
        ['BEKLEYEN', String(bekleyen), bekleyen ? R.sari : R.yazi],
        ['İPTAL', String(iptal), iptal ? R.kirmizi : R.yazi],
    ];
    const kG = Math.floor((IC - 3 * 16) / 4);
    kutular.forEach(([ad, deger, renk], i) => {
        const x = P + i * (kG + 16);
        p.push(`<rect x="${x}" y="${y}" width="${kG}" height="128" rx="20" fill="${R.kart}" stroke="${R.cizgi}"/>`);
        p.push(yazi(x + 24, y + 40, ad, { boy: 18, agirlik: 600, renk: R.sonuk, aralik: 1.5 }));
        p.push(yazi(x + 24, y + 100, deger, { boy: 48, aile: 'Manrope', agirlik: 800, renk }));
    });
    y += 128 + 40;

    // Sebepler
    if (sebepListesi.length) {
        p.push(yazi(P, y + 20, 'SEBEPLERE GÖRE ADET', { boy: 18, agirlik: 600, renk: R.sonuk, aralik: 1.5 }));
        y += 44;
        sebepListesi.forEach(([ad, n]) => {
            const deger = adetYaz(n);
            const dG = genislik(OLCU.govdeKalin, deger, 22);
            p.push(yazi(P, y + 22, kirp(OLCU.govde, ad, 22, IC - dG - 24), { boy: 22, renk: R.orta }));
            p.push(yazi(G - P, y + 22, deger, { boy: 22, agirlik: 600, hiza: 'end' }));
            p.push(`<rect x="${P}" y="${y + 34}" width="${IC}" height="8" rx="4" fill="${R.cizgi}"/>`);
            p.push(`<rect x="${P}" y="${y + 34}" width="${Math.max(8, (n / enCok) * IC)}" height="8" rx="4" fill="${R.vurgu}"/>`);
            y += 52;
        });
        y += 24;
    }

    // Ürün ızgarası
    p.push(yazi(P, y + 20, 'ÜRÜNLER', { boy: 18, agirlik: 600, renk: R.sonuk, aralik: 1.5 }));
    y += 44;
    if (!gosterilen.length) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="88" rx="20" fill="${R.kart}" stroke="${R.cizgi}"/>`);
        p.push(yazi(G / 2, y + 52, 'Bu aralıkta kayıt yok', { boy: 24, renk: R.sonuk, hiza: 'middle' }));
        y += 120;
    }
    gosterilen.forEach((u, i) => {
        const x = P + (i % SUTUN) * (KUTU + ARA);
        const uy = y + Math.floor(i / SUTUN) * (URUN_Y + ARA);
        const kid = 'k' + i;
        p.push(`<rect x="${x}" y="${uy}" width="${KUTU}" height="${URUN_Y}" rx="20" fill="${R.kart}" stroke="${R.cizgi}"/>`);
        p.push(`<clipPath id="${kid}"><rect x="${x + 12}" y="${uy + 12}" width="${KUTU - 24}" height="${KUTU - 24}" rx="14"/></clipPath>`);
        const img = veriUri(gorseller.get(u.id));
        if (img) {
            p.push(`<image href="${img}" x="${x + 12}" y="${uy + 12}" width="${KUTU - 24}" height="${KUTU - 24}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${kid})"/>`);
        } else {
            p.push(`<rect x="${x + 12}" y="${uy + 12}" width="${KUTU - 24}" height="${KUTU - 24}" rx="14" fill="${R.zemin}"/>`);
        }
        // ×adet rozeti
        const etiket = '×' + adetYaz(u.adet);
        const rG = genislik(OLCU.baslik, etiket, 26) + 28;
        const renk = ADET_RENK[Math.min(5, Math.max(1, Math.floor(u.adet)))] || ADET_RENK[1];
        p.push(`<rect x="${x + KUTU - 12 - rG}" y="${uy + 20}" width="${rG}" height="44" rx="22" fill="${renk}"/>`);
        p.push(yazi(x + KUTU - 12 - rG / 2, uy + 51, etiket, { boy: 26, aile: 'Manrope', agirlik: 800, renk: '#ffffff', hiza: 'middle' }));
        // Ad (iki satır) ve sebep
        const adSatir = ikiSatir(OLCU.govdeKalin, u.ad, 20, KUTU - 32);
        adSatir.forEach((s, j) => p.push(yazi(x + 16, uy + KUTU + 18 + j * 24, s, { boy: 20, agirlik: 600 })));
        const sebep = [...u.sebepler.entries()].sort((m, n) => n[1] - m[1]).map((e) => e[0])[0] || '';
        let alt = sebep;
        let altRenk = R.sonuk;
        if (u.iptal) { alt = 'İptal Edildi'; altRenk = R.kirmizi; } else if (u.bekleyen) { alt = 'Bekliyor · ' + sebep; altRenk = R.sari; }
        p.push(yazi(x + 16, uy + KUTU + 18 + adSatir.length * 24 + 8, kirp(OLCU.govde, alt, 17, KUTU - 32), { boy: 17, renk: altRenk }));
    });
    if (gosterilen.length) y += satir * (URUN_Y + ARA);
    if (urunler.length > gosterilen.length) {
        p.push(yazi(P, y + 20, '+' + (urunler.length - gosterilen.length) + ' ürün daha', { boy: 22, agirlik: 600, renk: R.sonuk }));
        y += 40;
    }

    // Altlık
    p.push(`<rect x="${P}" y="${H - 96}" width="${IC}" height="2" fill="${R.cizgi}"/>`);
    p.push(yazi(P, H - 52, 'Jet Barkod', { boy: 22, agirlik: 600, renk: R.sonuk }));
    p.push(yazi(G - P, H - 52, 'jetbarkod.com.tr', { boy: 22, renk: R.sonuk, hiza: 'end' }));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${H}" viewBox="0 0 ${G} ${H}">${p.join('')}</svg>`;
    const r = new Resvg(svg, {
        fitTo: { mode: 'width', value: G },
        font: { fontFiles: FONT_DOSYALARI, loadSystemFonts: false, defaultFontFamily: 'DM Sans' },
    });
    return r.render().asPng();
}

/* Gece raporu (vps-api/gece-raporu/kart.js) aynı fontları ve çizim yardımcılarını kullanır */
const araclar = { kacir, genislik, kirp, ikiSatir, yazi, veriUri, adetYaz, OLCU, LOGO, R, FONT_DOSYALARI, tarihEtiketi };

module.exports = { kartUret, DURUMLAR, SONUC_TIPLERI, araclar };
