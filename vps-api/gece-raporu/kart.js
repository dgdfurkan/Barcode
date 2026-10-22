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

function alt(p, H, sayfa, etiket) {
    p.push(`<rect x="${P}" y="${H - 80}" width="${IC}" height="2" fill="${R.cizgi}"/>`);
    p.push(yazi(P, H - 38, 'Jet Barkod · ' + (etiket || 'Gece Raporu'), { boy: 19, agirlik: 600, renk: R.sonuk }));
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
    let y = ust(p, o.baslik || 'Gece Raporu', (o.pencereYazi || 'Son 24 saat') + ' · ' + tarihSaat(o.pencere.bas) + ' - ' + tarihSaat(o.pencere.son), gunAd(o.gun).split(' ').slice(0, 2).join(' '));

    const temiz = !o.kaldirmaRed && !o.itirazBekleyen && !(o.itirazKabul + o.itirazRed) && !o.farkUrun;
    if (temiz) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="200" rx="24" fill="${R2.yesilZemin}" stroke="#abefc6"/>`);
        p.push(`<circle cx="${P + 76}" cy="${y + 100}" r="36" fill="${R.yesil}"/>`);
        p.push(`<path d="M${P + 58} ${y + 101} l12 12 l24 -26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`);
        p.push(yazi(P + 136, y + 92, o.gece === false ? 'Her şey yolunda' : 'Temiz gece', { boy: 36, aile: 'Manrope', agirlik: 800, renk: '#067647' }));
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

    // İtirazlar en son ne zaman eşitlendi; 3 saatten eskiyse uyar (sayılar eski olabilir)
    if (o.itirazSon && Date.now() - Date.parse(o.itirazSon) > 3 * 3600 * 1000) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="72" rx="20" fill="${R.sariZemin}" stroke="#fedf89"/>`);
        p.push(yazi(P + 28, y + 44, kirp(OLCU.govde, 'İtirazlar en son ' + tarihSaat(o.itirazSon) + '\'de güncellendi; franchise paneli kapalıydı.', 19, IC - 56), { boy: 19, renk: R.sari }));
        y += 72 + 24;
    }

    if (o.gunluk) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="88" rx="20" fill="${R2.maviZemin}"/>`);
        p.push(yazi(P + 28, y + 38, 'Günlük sayım', { boy: 19, agirlik: 600, renk: R2.mavi }));
        const m = o.gunluk.urun + ' ürün sayıldı · ' + (o.gunluk.fark ? o.gunluk.fark + ' üründe fark var' : 'fark yok');
        p.push(yazi(P + 28, y + 66, m, { boy: 21, renk: R.yazi }));
        // Depo panelindeki durum: kaç görev tamamlandı
        const pn = o.gunluk.panel;
        if (pn && pn.toplam) {
            const bitti = pn.bitti || pn.tamam >= pn.toplam;
            const etiket = bitti ? 'Panelde tamamlandı' : 'Panelde ' + pn.tamam + ' / ' + pn.toplam;
            const eG = genislik(OLCU.govdeKalin, etiket, 17) + 24;
            cip(p, G - P - 28 - eG, y + 28, etiket, bitti ? '#067647' : R2.turuncu, bitti ? R2.yesilZemin : R2.turuncuZemin, 17);
        }
        y += 88 + 32;
    }

    const H = Math.max(y + 104, 760);
    p[0] = `<rect width="${G}" height="${H}" fill="${R.zemin}"/>`;
    alt(p, H, null, o.baslik);
    return svgPng(p, H);
}

// ---------------------------------------------------------------------
// Ortak: ürün görseli kutusu, kalan süre
// ---------------------------------------------------------------------

let kirpSayac = 0;
function urunGorseli(p, x, y, boy, buf, doldur) {
    const id = 'kg' + (kirpSayac++);
    p.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${boy}" height="${boy}" rx="16"/></clipPath>`);
    const img = veriUri(buf);
    if (img && doldur) {
        // Fotoğraf: kutuyu doldurur (kırpılarak)
        p.push(`<image href="${img}" x="${x}" y="${y}" width="${boy}" height="${boy}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`);
        p.push(`<rect x="${x}" y="${y}" width="${boy}" height="${boy}" rx="16" fill="none" stroke="${R.cizgi}"/>`);
    } else if (img) {
        p.push(`<rect x="${x}" y="${y}" width="${boy}" height="${boy}" rx="16" fill="#ffffff" stroke="${R.cizgi}"/>`);
        p.push(`<image href="${img}" x="${x + 6}" y="${y + 6}" width="${boy - 12}" height="${boy - 12}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/>`);
    } else {
        p.push(`<rect x="${x}" y="${y}" width="${boy}" height="${boy}" rx="16" fill="${R.zemin}"/>`);
    }
}

/** "5 sa 20 dk kaldı", "40 dk kaldı", "1 gün 3 sa kaldı" */
function kalanYazi(iso) {
    const ms = Date.parse(iso) - Date.now();
    if (!Number.isFinite(ms)) return '';
    if (ms <= 0) return 'Süre doldu';
    const dk = Math.floor(ms / 60000);
    const gun = Math.floor(dk / 1440);
    const sa = Math.floor((dk % 1440) / 60);
    const kdk = dk % 60;
    if (gun) return gun + ' gün ' + (sa ? sa + ' sa ' : '') + 'kaldı';
    if (sa) return sa + ' sa ' + (kdk ? kdk + ' dk ' : '') + 'kaldı';
    return Math.max(1, kdk) + ' dk kaldı';
}

/** Satırları sayfalara böler; her sayfa ayrı kart. satir: {tur:'baslik'|'oge', h, ciz(p, y)} */
function sayfala(satirlar, baslik, altBaslik, gun, etiket, altEtiket) {
    const kartlar = [];
    let p = null;
    let y = 0;
    const yeni = () => { p = ['']; y = ust(p, baslik, altBaslik, etiket || gunAd(gun).split(' ').slice(0, 2).join(' ')); };
    const bitir = () => { const H = y + 104 - 16; p[0] = `<rect width="${G}" height="${H}" fill="${R.zemin}"/>`; kartlar.push({ p, H }); };
    yeni();
    satirlar.forEach((s, i) => {
        // Başlık sayfanın son satırı olmasın
        const sonraki = satirlar[i + 1];
        const gerek = s.tur === 'baslik' && sonraki ? s.h + sonraki.h : s.h;
        if (y + gerek + 104 > AZAMI_BOY && y > P + 120) { bitir(); yeni(); }
        s.ciz(p, y);
        y += s.h;
    });
    bitir();
    return kartlar.map((k, i) => {
        alt(k.p, k.H, kartlar.length > 1 ? (i + 1) + ' / ' + kartlar.length : null, altEtiket);
        return svgPng(k.p, k.H);
    });
}

// ---------------------------------------------------------------------
// Satıştan kaldırma: reddedilen, iptal edilen ve (seçiliyse) bekleyenler
// ---------------------------------------------------------------------

const FOTO_BOY = 128;

/**
 * k: { urun:{id,ad}, adet, sebep, altNeden, red:{baslik,aciklama}, durum, yeniden, bekliyor, zaman, fotolar:[Buffer] }
 */
function kaldirmaKartlari(red, gorseller, gun, bekleyen = [], secenek = {}) {
    const tamam = Array.isArray(secenek.tamam) ? secenek.tamam : [];
    const satir = (k) => {
        const fotolu = Array.isArray(k.fotolar) && k.fotolar.length;
        const redli = k.red && (k.red.baslik || k.red.aciklama);
        const h = 196 + (fotolu ? FOTO_BOY + 20 : 0) + 16;
        return {
            tur: 'oge', h,
            ciz: (p, y) => {
                const x = P;
                const kutuH = h - 16;
                const sinir = k.tamam ? '#abefc6' : k.bekliyor ? '#fedf89' : k.yeniden ? R.cizgi : '#fda29b';
                p.push(`<rect x="${x}" y="${y}" width="${IC}" height="${kutuH}" rx="22" fill="${R.kart}" stroke="${sinir}"/>`);
                urunGorseli(p, x + 20, y + 20, 120, gorseller.get(k.urun && k.urun.id));
                const etiket = '×' + adetYaz(Number(k.adet) || 0);
                const rG = genislik(OLCU.baslik, etiket, 20) + 24;
                p.push(`<rect x="${x + 80 - rG / 2}" y="${y + 148}" width="${rG}" height="32" rx="16" fill="#111827"/>`);
                p.push(yazi(x + 80, y + 171, etiket, { boy: 20, aile: 'Manrope', agirlik: 800, renk: '#ffffff', hiza: 'middle' }));

                const mx = x + 164;
                const mG = IC - 164 - 24;
                const durumYazi = k.tamam ? 'Tamamlandı' : k.bekliyor ? 'Bekliyor' : k.yeniden ? 'Yeniden girildi' : k.durum === 700 ? 'İptal edildi' : 'Reddedildi';
                const renk = k.tamam ? '#067647' : k.bekliyor ? R.sari : k.yeniden ? R.sonuk : R.kirmizi;
                const zemin = k.tamam ? R2.yesilZemin : k.bekliyor ? R.sariZemin : k.yeniden ? R.zemin : R.kirmiziZemin;
                const dG = genislik(OLCU.govdeKalin, durumYazi, 16) + 24;
                cip(p, x + IC - 20 - dG, y + 20, durumYazi, renk, zemin, 16);
                const ad = ikiSatir(OLCU.govdeKalin, (k.urun && k.urun.ad) || 'Ürün', 22, mG - dG - 16);
                ad.forEach((t, j) => p.push(yazi(mx, y + 44 + j * 28, t, { boy: 22, agirlik: 600 })));
                let ly = y + 44 + ad.length * 28 + 4;
                const sebep = [k.sebep, k.altNeden].filter(Boolean).join(' · ');
                if (sebep) { p.push(yazi(mx, ly, kirp(OLCU.govde, sebep, 18, mG), { boy: 18, renk: R.sonuk })); ly += 30; }
                if (redli) {
                    p.push(yazi(mx, ly + 4, kirp(OLCU.govdeKalin, k.red.baslik || 'Red sebebi', 19, mG), { boy: 19, agirlik: 600, renk: R.kirmizi }));
                    if (k.red.aciklama) p.push(yazi(mx, ly + 30, kirp(OLCU.govde, k.red.aciklama, 17, mG), { boy: 17, renk: R.orta }));
                }
                if (k.zaman) p.push(yazi(x + IC - 20, y + 196 - 18, (k.bekliyor || k.tamam ? 'Oluşturuldu ' : '') + tarihSaat(k.zaman), { boy: 16, renk: R.sonuk, hiza: 'end' }));
                if (fotolu) {
                    const fy = y + 196;
                    p.push(yazi(x + 20, fy + 4, 'HASAR FOTOĞRAFLARI', { boy: 14, agirlik: 600, renk: R.sonuk, aralik: 1.2 }));
                    k.fotolar.slice(0, 3).forEach((f, j) => urunGorseli(p, x + 20 + j * (FOTO_BOY + 12), fy + 14, FOTO_BOY, f, true));
                }
            },
        };
    };
    const satirlar = [];
    const baslik = (metin, n) => ({ tur: 'baslik', h: 34, ciz: (p, y) => bolumBasligi(p, y, metin, n) });
    if (red.length) { satirlar.push(baslik('REDDEDİLEN VE İPTAL EDİLEN', red.length)); red.forEach((k) => satirlar.push(satir(k))); }
    if (bekleyen.length) { satirlar.push(baslik('ONAY BEKLEYEN', bekleyen.length)); bekleyen.forEach((k) => satirlar.push(satir(k))); }
    if (tamam.length) { satirlar.push(baslik('TAMAMLANAN', tamam.length)); tamam.forEach((k) => satirlar.push(satir(k))); }
    const altBaslik = secenek.altBaslik || (bekleyen.length && red.length ? 'Son 24 saatte reddedilenler ve onay bekleyenler'
        : bekleyen.length ? 'Onay bekleyen kayıtlar' : 'Son 24 saatte reddedilen ya da iptal edilen kayıtlar');
    return sayfala(satirlar, 'Satıştan Kaldırma', altBaslik, gun, secenek.etiket, secenek.altEtiket);
}

// ---------------------------------------------------------------------
// İtirazlar
// ---------------------------------------------------------------------

/**
 * bekleyen: [{urun, gorselId, sikayet, musteriNotu, sonTarih, taslak}]
 * sonuc:    [{urun, gorselId, sikayet, durum: 300|400, itirazMetni}]
 */
function itirazKartlari(bekleyen, sonuc, gun, gorseller = new Map(), secenek = {}) {
    const notGoster = secenek.not !== false;
    const metinGoster = secenek.metin !== false;
    const GB = 96;
    const metinX = P + 24 + GB + 20;
    const metinG = IC - 24 - GB - 20 - 24;
    const satirlar = [];
    const baslik = (metin, n) => ({ tur: 'baslik', h: 34, ciz: (p, y) => bolumBasligi(p, y, metin, n) });

    if (bekleyen.length) satirlar.push(baslik('İTİRAZ BEKLEYEN', bekleyen.length));
    bekleyen.forEach((k) => {
        const h = (notGoster ? 152 : 128) + 16;
        satirlar.push({ tur: 'oge', h, ciz: (p, y) => {
            p.push(`<rect x="${P}" y="${y}" width="${IC}" height="${h - 16}" rx="22" fill="${R.kart}" stroke="${R.cizgi}"/>`);
            urunGorseli(p, P + 24, y + 28, GB, gorseller.get(k.gorselId));
            const kalanSaat = (Date.parse(k.sonTarih) - Date.now()) / 3600000;
            const acil = kalanSaat < 12;
            const kalan = kalanYazi(k.sonTarih);
            const sG = genislik(OLCU.govdeKalin, kalan, 16) + 24;
            cip(p, P + IC - 24 - sG, y + 20, kalan, acil ? R.kirmizi : R2.turuncu, acil ? R.kirmiziZemin : R2.turuncuZemin, 16);
            let x = metinX;
            x += cip(p, x, y + 20, k.sikayet || 'Kayıt', R.orta, R.zemin, 16) + 10;
            if (k.taslak) cip(p, x, y + 20, 'Taslak hazır', R2.mavi, R2.maviZemin, 16);
            p.push(yazi(metinX, y + 84, kirp(OLCU.govdeKalin, k.urun || 'Ürün', 22, metinG), { boy: 22, agirlik: 600 }));
            if (notGoster) p.push(yazi(metinX, y + 116, kirp(OLCU.govde, k.musteriNotu ? '"' + k.musteriNotu + '"' : 'Müşteri not bırakmamış', 18, metinG), { boy: 18, renk: R.sonuk }));
        } });
    });
    if (sonuc.length) satirlar.push(baslik(secenek.sonucBaslik || 'SON 24 SAATTE SONUÇLANAN', sonuc.length));
    sonuc.forEach((k) => {
        const metinSatir = metinGoster && k.itirazMetni ? ikiSatir(OLCU.govde, k.itirazMetni, 18, metinG) : [];
        const h = Math.max(metinGoster ? 152 : 128, 100 + metinSatir.length * 26 + 20) + 16;
        satirlar.push({ tur: 'oge', h, ciz: (p, y) => {
            p.push(`<rect x="${P}" y="${y}" width="${IC}" height="${h - 16}" rx="22" fill="${R.kart}" stroke="${R.cizgi}"/>`);
            urunGorseli(p, P + 24, y + 28, GB, gorseller.get(k.gorselId));
            const kabul = k.durum === 300;
            let x = metinX;
            x += cip(p, x, y + 20, kabul ? 'Kabul edildi' : 'Reddedildi', kabul ? '#067647' : R.kirmizi, kabul ? R2.yesilZemin : R.kirmiziZemin, 16) + 10;
            cip(p, x, y + 20, k.sikayet || 'Kayıt', R.orta, R.zemin, 16);
            p.push(yazi(metinX, y + 84, kirp(OLCU.govdeKalin, k.urun || 'Ürün', 22, metinG), { boy: 22, agirlik: 600 }));
            metinSatir.forEach((t, j) => p.push(yazi(metinX, y + 116 + j * 26, t, { boy: 18, renk: R.orta })));
        } });
    });
    return sayfala(satirlar, 'İtirazlar', 'Depo değerlendirme kayıtları', gun, null, secenek.altEtiket);
}

// ---------------------------------------------------------------------
// Sayım farkları
// ---------------------------------------------------------------------

/**
 * gruplar: [{ad, otomatik, urun, bas, bit, panel, farklar, satirlar: [{ad, sistem, fiziksel, fark}]}]
 * secenek: { saatler (başlama/bitiş), liste: 'fark' | 'hepsi', altBaslik, altEtiket }
 */
function sayimKartlari(gruplar, gun, secenek = {}) {
    const hepsi = secenek.liste === 'hepsi';
    const saatGoster = secenek.saatler !== false;
    const saat = (iso) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }) : '');
    const satirlar = [];
    gruplar.forEach((gr) => {
        const ek = [];
        if (saatGoster && gr.bas) ek.push('Başladı ' + saat(gr.bas) + (gr.bit ? ' · Bitti ' + saat(gr.bit) : ''));
        satirlar.push({ tur: ek.length ? 'grupUzun' : 'grup', gr, ek: ek.join('') });
        const liste = hepsi && Array.isArray(gr.satirlar) ? gr.satirlar : gr.farklar;
        if (!gr.farklar.length && !hepsi) satirlar.push({ tur: 'farksiz' });
        else {
            satirlar.push({ tur: 'kolon' });
            liste.forEach((f) => satirlar.push({ tur: 'fark', f }));
            if (hepsi && !gr.farklar.length) satirlar.push({ tur: 'farksiz' });
        }
        satirlar.push({ tur: 'bosluk' });
    });
    const yuk = { grup: 64, grupUzun: 92, farksiz: 56, kolon: 36, fark: 52, bosluk: 20 };
    const kartlar = [];
    let p = null;
    let y = 0;
    const kolonX = { sistem: G - P - 300, sayilan: G - P - 170, fark: G - P - 24 };
    const yeniKart = () => {
        p = [''];
        y = ust(p, hepsi ? 'Sayımlar' : 'Sayım Farkları', secenek.altBaslik || 'Son 24 saatte tamamlanan sayımlar', gunAd(gun).split(' ').slice(0, 2).join(' '));
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
        if (s.tur === 'grup' || s.tur === 'grupUzun') {
            const gr = s.gr;
            const kH = s.tur === 'grupUzun' ? 80 : 52;
            p.push(`<rect x="${P}" y="${y}" width="${IC}" height="${kH}" rx="16" fill="${gr.otomatik ? R2.maviZemin : R.kart}" stroke="${gr.otomatik ? '#c7d7fe' : R.cizgi}"/>`);
            p.push(yazi(P + 20, y + 34, gr.ad, { boy: 20, agirlik: 600, renk: gr.otomatik ? R2.mavi : R.yazi }));
            const m = gr.urun + ' ürün · ' + (gr.farklar.length ? gr.farklar.length + ' fark' : 'farksız');
            p.push(yazi(G - P - 20, y + 34, m, { boy: 18, renk: R.sonuk, hiza: 'end' }));
            if (s.tur === 'grupUzun') {
                p.push(yazi(P + 20, y + 64, s.ek, { boy: 17, renk: R.orta }));
                const pn = gr.panel;
                if (pn && pn.toplam) {
                    const bitti = pn.bitti || pn.tamam >= pn.toplam;
                    p.push(yazi(G - P - 20, y + 64, bitti ? 'Panelde tamamlandı' : 'Panelde ' + pn.tamam + ' / ' + pn.toplam, { boy: 17, agirlik: 600, renk: bitti ? '#067647' : R2.turuncu, hiza: 'end' }));
                }
            }
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
            if (!f.fark) p.push(yazi(kolonX.fark, y + 29, '0', { boy: 20, aile: 'Manrope', agirlik: 800, renk: R.sonuk, hiza: 'end' }));
            else p.push(yazi(kolonX.fark, y + 29, (art ? '+' : '−') + adetYaz(Math.abs(f.fark)), { boy: 20, aile: 'Manrope', agirlik: 800, renk: art ? '#067647' : R.kirmizi, hiza: 'end' }));
        }
        y += h;
    });
    bitir();
    return kartlar.map((k, i) => {
        alt(k.p, k.H, kartlar.length > 1 ? (i + 1) + ' / ' + kartlar.length : null, secenek.altEtiket);
        return svgPng(k.p, k.H);
    });
}

module.exports = { ozetKarti, kaldirmaKartlari, itirazKartlari, sayimKartlari };
