/**
 * Gece raporu kartları (1080 px genişlik, boy içeriğe göre)
 *
 * Telegram tek uzun görseli küçültüp okunmaz yapıyor; rapor bölüm bölüm
 * kartlara ayrılıp albüm olarak gidiyor. Her kart en fazla ~2200 px.
 *
 *   ozetKarti       Dört kutu: reddedilen kaldırma, bekleyen itiraz,
 *                   sonuçlanan itiraz, sayım farkı. Hiçbiri yoksa "Temiz gece".
 *   kaldirmaKartlari  Reddedilen / iptal edilen satıştan kaldırmalar: görsel,
 *                   adet, sebep, red sebebi ve açıklaması.
 *   itirazKartlari  İtiraz bekleyenler (son tarihle) ve sonuçlananlar
 *                   (kabul / red, gönderilen metin).
 *   sayimKartlari   Sayım başına farklı ürünler: sistem, sayılan, fark.
 *
 * Fontlar, logo ve çizim yardımcıları Satıştan Kaldırma kartından.
 */
'use strict';

const { Resvg } = require('@resvg/resvg-js');
const { araclar } = require('../kaldirma/kart');

const { kacir, genislik, kirp, ikiSatir, yazi, veriUri, adetYaz, OLCU, LOGO, R, FONT_DOSYALARI } = araclar;

const G = 1080;
const P = 56;
const IC = G - 2 * P;
const AZAMI_BOY = 2200;
const R2 = { ...R, mavi: '#2357e8', maviZemin: '#eef4ff', yesilZemin: '#ecfdf3', turuncu: '#c4320a', turuncuZemin: '#fff4ed' };

function tarihSaat(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    return new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function gunAd(gun) {
    const [y, m, d] = String(gun).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', weekday: 'long' });
}

function svgPng(parcalar, H) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${H}" viewBox="0 0 ${G} ${H}">${parcalar.join('')}</svg>`;
    const r = new Resvg(svg, {
        fitTo: { mode: 'width', value: G },
        font: { fontFiles: FONT_DOSYALARI, loadSystemFonts: false, defaultFontFamily: 'DM Sans' },
    });
    return r.render().asPng();
}

/** Kartın üst bilgisi; dönen y bir sonraki içeriğin başı */
function ust(p, baslik, alt, etiket) {
    let y = P;
    p.push(`<rect x="${P}" y="${y}" width="64" height="64" rx="18" fill="#ffffff" stroke="${R.cizgi}"/>`);
    p.push(`<image href="${LOGO}" x="${P + 6}" y="${y + 6}" width="52" height="52"/>`);
    const eG = etiket ? genislik(OLCU.govdeKalin, etiket, 20) + 36 : 0;
    p.push(yazi(P + 84, y + 30, kirp(OLCU.baslik, baslik, 30, IC - 84 - eG - 16), { boy: 30, aile: 'Manrope', agirlik: 800 }));
    p.push(yazi(P + 84, y + 58, kirp(OLCU.govde, alt, 19, IC - 84 - eG - 16), { boy: 19, renk: R.sonuk }));
    if (etiket) {
        p.push(`<rect x="${G - P - eG}" y="${y + 12}" width="${eG}" height="40" rx="20" fill="#ffffff" stroke="${R.cizgi}"/>`);
        p.push(yazi(G - P - eG / 2, y + 39, etiket, { boy: 20, agirlik: 600, hiza: 'middle' }));
    }
    return y + 64 + 36;
}

function bolumBasligi(p, y, metin, sayi) {
    p.push(yazi(P, y + 18, metin + (sayi != null ? ' · ' + sayi : ''), { boy: 17, agirlik: 600, renk: R.sonuk, aralik: 1.4 }));
    return y + 34;
}

function cip(p, x, y, metin, renk, zemin, boy = 17) {
    const w = genislik(OLCU.govdeKalin, metin, boy) + 24;
    p.push(`<rect x="${x}" y="${y}" width="${w}" height="${boy + 15}" rx="${(boy + 15) / 2}" fill="${zemin}"/>`);
    // Taban çizgisi: yazının x yüksekliği kutunun ortasına otursun
    p.push(yazi(x + w / 2, Math.round(y + (boy + 15) / 2 + boy * 0.36), metin, { boy, agirlik: 600, renk, hiza: 'middle' }));
    return w;
}

function alt(p, H, sayfa) {
    p.push(`<rect x="${P}" y="${H - 80}" width="${IC}" height="2" fill="${R.cizgi}"/>`);
    p.push(yazi(P, H - 38, 'Jet Barkod · Gece Raporu', { boy: 19, agirlik: 600, renk: R.sonuk }));
    p.push(yazi(G - P, H - 38, sayfa || 'jetbarkod.com.tr', { boy: 19, renk: R.sonuk, hiza: 'end' }));
}

// ---------------------------------------------------------------------
// Özet
// ---------------------------------------------------------------------

/**
 * o: { gun, pencere: {bas, son}, kaldirmaRed, itirazBekleyen, itirazKabul, itirazRed,
 *      sayimSayisi, sayimUrun, farkUrun, gunluk: {urun, fark} | null }
 */
function ozetKarti(o) {
    const p = [];
    const H0 = 1080;
    p.push(`<rect width="${G}" height="${H0}" fill="${R.zemin}"/>`);
    let y = ust(p, 'Gece Raporu', 'Son 24 saat · ' + tarihSaat(o.pencere.bas) + ' - ' + tarihSaat(o.pencere.son), gunAd(o.gun).split(' ').slice(0, 2).join(' '));

    const temiz = !o.kaldirmaRed && !o.itirazBekleyen && !(o.itirazKabul + o.itirazRed) && !o.farkUrun;
    if (temiz) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="200" rx="24" fill="${R2.yesilZemin}" stroke="#abefc6"/>`);
        p.push(`<circle cx="${P + 76}" cy="${y + 100}" r="36" fill="${R.yesil}"/>`);
        p.push(`<path d="M${P + 58} ${y + 101} l12 12 l24 -26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`);
        p.push(yazi(P + 136, y + 92, 'Temiz gece', { boy: 36, aile: 'Manrope', agirlik: 800, renk: '#067647' }));
        p.push(yazi(P + 136, y + 132, 'Reddedilen kaldırma, bekleyen itiraz ve sayım farkı yok.', { boy: 21, renk: R.orta }));
        y += 200 + 32;
    }

    const kutular = [
        ['REDDEDİLEN KALDIRMA', o.kaldirmaRed, o.kaldirmaRed ? R.kirmizi : R.yazi, o.kaldirmaRed ? 'Red ya da iptal' : 'Yok'],
        ['İTİRAZ BEKLEYEN', o.itirazBekleyen, o.itirazBekleyen ? R2.turuncu : R.yazi, o.itirazBekleyen ? 'Süresi dolmamış kayıt' : 'Yok'],
        ['SONUÇLANAN İTİRAZ', o.itirazKabul + o.itirazRed, R.yazi, (o.itirazKabul + o.itirazRed) ? o.itirazKabul + ' kabul · ' + o.itirazRed + ' red' : 'Yok'],
        ['SAYIM FARKI', o.farkUrun, o.farkUrun ? R.kirmizi : R.yazi, o.sayimSayisi ? o.sayimSayisi + ' sayım · ' + o.sayimUrun + ' ürün' : 'Sayım yok'],
    ];
    const kG = Math.floor((IC - 20) / 2);
    kutular.forEach(([ad, deger, renk, not], i) => {
        const x = P + (i % 2) * (kG + 20);
        const ky = y + Math.floor(i / 2) * (176 + 20);
        p.push(`<rect x="${x}" y="${ky}" width="${kG}" height="176" rx="24" fill="${R.kart}" stroke="${R.cizgi}"/>`);
        p.push(yazi(x + 28, ky + 44, ad, { boy: 17, agirlik: 600, renk: R.sonuk, aralik: 1.4 }));
        p.push(yazi(x + 28, ky + 112, String(deger), { boy: 60, aile: 'Manrope', agirlik: 800, renk }));
        p.push(yazi(x + 28, ky + 148, kirp(OLCU.govde, not, 19, kG - 56), { boy: 19, renk: R.sonuk }));
    });
    y += 2 * 176 + 20 + 32;

    if (o.gunluk) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="88" rx="20" fill="${R2.maviZemin}"/>`);
        p.push(yazi(P + 28, y + 38, 'Günlük sayım', { boy: 19, agirlik: 600, renk: R2.mavi }));
        const m = o.gunluk.urun + ' ürün sayıldı · ' + (o.gunluk.fark ? o.gunluk.fark + ' üründe fark var' : 'fark yok');
        p.push(yazi(P + 28, y + 66, m, { boy: 21, renk: R.yazi }));
        y += 88 + 32;
    }

    const H = Math.max(y + 104, 760);
    p[0] = `<rect width="${G}" height="${H}" fill="${R.zemin}"/>`;
    alt(p, H);
    return svgPng(p, H);
}

// ---------------------------------------------------------------------
// Satıştan kaldırma: reddedilen ve iptal edilenler
// ---------------------------------------------------------------------

const KALDIRMA_SATIR = 196;

/** k: { urun:{id,ad}, adet, sebep, altNeden, red:{baslik,aciklama}, durum, yeniden, zaman } */
function kaldirmaKartlari(liste, gorseller, gun) {
    const kartlar = [];
    const sigan = Math.max(1, Math.floor((AZAMI_BOY - P - 100 - 34 - 104) / (KALDIRMA_SATIR + 16)));
    for (let bas = 0; bas < liste.length; bas += sigan) {
        const parca = liste.slice(bas, bas + sigan);
        const p = [''];
        let y = ust(p, 'Reddedilen Satıştan Kaldırmalar', 'Son 24 saatte reddedilen ya da iptal edilen kayıtlar', gunAd(gun).split(' ').slice(0, 2).join(' '));
        y = bolumBasligi(p, y, 'KAYITLAR', liste.length);
        parca.forEach((k, i) => {
            const x = P;
            const h = KALDIRMA_SATIR;
            const sinir = k.yeniden ? R.cizgi : '#fda29b';
            p.push(`<rect x="${x}" y="${y}" width="${IC}" height="${h}" rx="22" fill="${R.kart}" stroke="${sinir}"/>`);
            const id = 'g' + bas + '_' + i;
            p.push(`<clipPath id="${id}"><rect x="${x + 20}" y="${y + 20}" width="120" height="120" rx="16"/></clipPath>`);
            const img = veriUri(gorseller.get(k.urun && k.urun.id));
            if (img) p.push(`<image href="${img}" x="${x + 20}" y="${y + 20}" width="120" height="120" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/>`);
            else p.push(`<rect x="${x + 20}" y="${y + 20}" width="120" height="120" rx="16" fill="${R.zemin}"/>`);
            // adet rozeti görselin altında
            const etiket = '×' + adetYaz(Number(k.adet) || 0);
            const rG = genislik(OLCU.baslik, etiket, 20) + 24;
            p.push(`<rect x="${x + 80 - rG / 2}" y="${y + 148}" width="${rG}" height="32" rx="16" fill="#111827"/>`);
            p.push(yazi(x + 80, y + 171, etiket, { boy: 20, aile: 'Manrope', agirlik: 800, renk: '#ffffff', hiza: 'middle' }));

            const mx = x + 164;
            const mG = IC - 164 - 24;
            const durumYazi = k.yeniden ? 'Yeniden girildi' : k.durum === 700 ? 'İptal edildi' : 'Reddedildi';
            const dG = genislik(OLCU.govdeKalin, durumYazi, 16) + 24;
            cip(p, x + IC - 20 - dG, y + 20, durumYazi, k.yeniden ? R.sonuk : R.kirmizi, k.yeniden ? R.zemin : R.kirmiziZemin, 16);
            const ad = ikiSatir(OLCU.govdeKalin, (k.urun && k.urun.ad) || 'Ürün', 22, mG - dG - 16);
            ad.forEach((s, j) => p.push(yazi(mx, y + 44 + j * 28, s, { boy: 22, agirlik: 600 })));
            let ly = y + 44 + ad.length * 28 + 4;
            const sebep = [k.sebep, k.altNeden].filter(Boolean).join(' · ');
            if (sebep) { p.push(yazi(mx, ly, kirp(OLCU.govde, sebep, 18, mG), { boy: 18, renk: R.sonuk })); ly += 30; }
            if (k.red && (k.red.baslik || k.red.aciklama)) {
                p.push(yazi(mx, ly + 4, kirp(OLCU.govdeKalin, k.red.baslik || 'Red sebebi', 19, mG), { boy: 19, agirlik: 600, renk: R.kirmizi }));
                if (k.red.aciklama) p.push(yazi(mx, ly + 30, kirp(OLCU.govde, k.red.aciklama, 17, mG), { boy: 17, renk: R.orta }));
            }
            if (k.zaman) p.push(yazi(x + IC - 20, y + h - 18, tarihSaat(k.zaman), { boy: 16, renk: R.sonuk, hiza: 'end' }));
            y += h + 16;
        });
        const H = y + 104 - 16;
        p[0] = `<rect width="${G}" height="${H}" fill="${R.zemin}"/>`;
        const toplamSayfa = Math.ceil(liste.length / sigan);
        alt(p, H, toplamSayfa > 1 ? (Math.floor(bas / sigan) + 1) + ' / ' + toplamSayfa : null);
        kartlar.push(svgPng(p, H));
    }
    return kartlar;
}

// ---------------------------------------------------------------------
// İtirazlar
// ---------------------------------------------------------------------

/**
 * bekleyen: [{urun, sikayet, musteriNotu, sonTarih, taslak}]
 * sonuc:    [{urun, sikayet, durum: 300|400, itirazMetni}]
 */
function itirazKartlari(bekleyen, sonuc, gun) {
    const satirlar = [];
    if (bekleyen.length) satirlar.push({ tur: 'baslik', metin: 'İTİRAZ BEKLEYEN', sayi: bekleyen.length });
    bekleyen.forEach((k) => satirlar.push({ tur: 'bekleyen', k, h: 132 }));
    if (sonuc.length) satirlar.push({ tur: 'baslik', metin: 'SON 24 SAATTE SONUÇLANAN', sayi: sonuc.length });
    sonuc.forEach((k) => {
        const satir = k.itirazMetni ? ikiSatir(OLCU.govde, k.itirazMetni, 18, IC - 48).length : 0;
        satirlar.push({ tur: 'sonuc', k, h: satir ? 100 + satir * 26 + 14 : 112 });
    });

    const kartlar = [];
    let p = null;
    let y = 0;
    const yeniKart = () => {
        p = [''];
        y = ust(p, 'İtirazlar', 'Depo değerlendirme kayıtları', gunAd(gun).split(' ').slice(0, 2).join(' '));
    };
    const bitir = () => {
        const H = y + 104 - 16;
        p[0] = `<rect width="${G}" height="${H}" fill="${R.zemin}"/>`;
        kartlar.push({ p, H });
    };
    yeniKart();
    satirlar.forEach((s) => {
        const h = s.tur === 'baslik' ? 34 : s.h + 16;
        if (y + h + 104 > AZAMI_BOY) { bitir(); yeniKart(); }
        if (s.tur === 'baslik') { y = bolumBasligi(p, y, s.metin, s.sayi); return; }
        const k = s.k;
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="${s.h}" rx="22" fill="${R.kart}" stroke="${R.cizgi}"/>`);
        let x = P + 24;
        if (s.tur === 'bekleyen') {
            const kalanSaat = (Date.parse(k.sonTarih) - Date.now()) / 3600000;
            const acil = kalanSaat < 12;
            x += cip(p, x, y + 20, k.sikayet || 'Kayıt', R.orta, R.zemin, 16) + 10;
            const son = 'Son: ' + tarihSaat(k.sonTarih);
            const sG = genislik(OLCU.govdeKalin, son, 16) + 24;
            cip(p, P + IC - 24 - sG, y + 20, son, acil ? R.kirmizi : R2.turuncu, acil ? R.kirmiziZemin : R2.turuncuZemin, 16);
            if (k.taslak) cip(p, x, y + 20, 'Taslak hazır', R2.mavi, R2.maviZemin, 16);
            p.push(yazi(P + 24, y + 84, kirp(OLCU.govdeKalin, k.urun || 'Ürün', 22, IC - 48), { boy: 22, agirlik: 600 }));
            p.push(yazi(P + 24, y + 114, kirp(OLCU.govde, k.musteriNotu ? '"' + k.musteriNotu + '"' : 'Müşteri not bırakmamış', 18, IC - 48), { boy: 18, renk: R.sonuk }));
        } else {
            const kabul = k.durum === 300;
            x += cip(p, x, y + 20, kabul ? 'Kabul edildi' : 'Reddedildi', kabul ? '#067647' : R.kirmizi, kabul ? R2.yesilZemin : R.kirmiziZemin, 16) + 10;
            cip(p, x, y + 20, k.sikayet || 'Kayıt', R.orta, R.zemin, 16);
            p.push(yazi(P + 24, y + 84, kirp(OLCU.govdeKalin, k.urun || 'Ürün', 22, IC - 48), { boy: 22, agirlik: 600 }));
            if (k.itirazMetni) {
                ikiSatir(OLCU.govde, k.itirazMetni, 18, IC - 48).forEach((t, j) => p.push(yazi(P + 24, y + 116 + j * 26, t, { boy: 18, renk: R.orta })));
            }
        }
        y += s.h + 16;
    });
    bitir();
    return kartlar.map((k, i) => {
        alt(k.p, k.H, kartlar.length > 1 ? (i + 1) + ' / ' + kartlar.length : null);
        return svgPng(k.p, k.H);
    });
}

// ---------------------------------------------------------------------
// Sayım farkları
// ---------------------------------------------------------------------

/** gruplar: [{ad, zaman, urun, farklar: [{ad, sistem, fiziksel, fark}]}] */
function sayimKartlari(gruplar, gun) {
    const satirlar = [];
    gruplar.forEach((gr) => {
        satirlar.push({ tur: 'grup', gr });
        if (!gr.farklar.length) satirlar.push({ tur: 'farksiz' });
        else {
            satirlar.push({ tur: 'kolon' });
            gr.farklar.forEach((f) => satirlar.push({ tur: 'fark', f }));
        }
        satirlar.push({ tur: 'bosluk' });
    });
    const yuk = { grup: 64, farksiz: 56, kolon: 36, fark: 52, bosluk: 20 };
    const kartlar = [];
    let p = null;
    let y = 0;
    const kolonX = { sistem: G - P - 300, sayilan: G - P - 170, fark: G - P - 24 };
    const yeniKart = () => {
        p = [''];
        y = ust(p, 'Sayım Farkları', 'Son 24 saatte tamamlanan sayımlar', gunAd(gun).split(' ').slice(0, 2).join(' '));
    };
    const bitir = () => {
        const H = y + 104;
        p[0] = `<rect width="${G}" height="${H}" fill="${R.zemin}"/>`;
        kartlar.push({ p, H });
    };
    yeniKart();
    satirlar.forEach((s) => {
        const h = yuk[s.tur];
        if (y + h + 104 > AZAMI_BOY) { bitir(); yeniKart(); }
        if (s.tur === 'grup') {
            const gr = s.gr;
            p.push(`<rect x="${P}" y="${y}" width="${IC}" height="52" rx="16" fill="${gr.otomatik ? R2.maviZemin : R.kart}" stroke="${gr.otomatik ? '#c7d7fe' : R.cizgi}"/>`);
            p.push(yazi(P + 20, y + 34, gr.ad, { boy: 20, agirlik: 600, renk: gr.otomatik ? R2.mavi : R.yazi }));
            const m = gr.urun + ' ürün · ' + (gr.farklar.length ? gr.farklar.length + ' fark' : 'farksız');
            p.push(yazi(G - P - 20, y + 34, m, { boy: 18, renk: R.sonuk, hiza: 'end' }));
        } else if (s.tur === 'farksiz') {
            p.push(yazi(P + 20, y + 34, 'Bütün ürünler sistemle aynı sayıldı.', { boy: 19, renk: '#067647' }));
        } else if (s.tur === 'kolon') {
            p.push(yazi(P + 20, y + 24, 'ÜRÜN', { boy: 15, agirlik: 600, renk: R.sonuk, aralik: 1.2 }));
            p.push(yazi(kolonX.sistem, y + 24, 'SİSTEM', { boy: 15, agirlik: 600, renk: R.sonuk, hiza: 'end', aralik: 1.2 }));
            p.push(yazi(kolonX.sayilan, y + 24, 'SAYILAN', { boy: 15, agirlik: 600, renk: R.sonuk, hiza: 'end', aralik: 1.2 }));
            p.push(yazi(kolonX.fark, y + 24, 'FARK', { boy: 15, agirlik: 600, renk: R.sonuk, hiza: 'end', aralik: 1.2 }));
        } else if (s.tur === 'fark') {
            const f = s.f;
            p.push(`<rect x="${P}" y="${y}" width="${IC}" height="44" rx="12" fill="${R.kart}"/>`);
            p.push(yazi(P + 20, y + 29, kirp(OLCU.govde, f.ad || 'Ürün', 19, kolonX.sistem - 90 - P - 20), { boy: 19 }));
            p.push(yazi(kolonX.sistem, y + 29, adetYaz(f.sistem), { boy: 19, renk: R.orta, hiza: 'end' }));
            p.push(yazi(kolonX.sayilan, y + 29, adetYaz(f.fiziksel), { boy: 19, agirlik: 600, hiza: 'end' }));
            const art = f.fark > 0;
            p.push(yazi(kolonX.fark, y + 29, (art ? '+' : '−') + adetYaz(Math.abs(f.fark)), { boy: 20, aile: 'Manrope', agirlik: 800, renk: art ? '#067647' : R.kirmizi, hiza: 'end' }));
        }
        y += h;
    });
    bitir();
    return kartlar.map((k, i) => {
        alt(k.p, k.H, kartlar.length > 1 ? (i + 1) + ' / ' + kartlar.length : null);
        return svgPng(k.p, k.H);
    });
}

module.exports = { ozetKarti, kaldirmaKartlari, itirazKartlari, sayimKartlari };
