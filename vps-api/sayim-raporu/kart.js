/**
 * Sayım raporu: kare bilgi kartı (1080 × 1080 PNG)
 *
 * WhatsApp'a ya da bir gruba "şu tablonun sayımı yapıldı" diye iletmek
 * için tek görsel. SVG olarak kuruluyor, resvg ile PNG'ye çevriliyor
 * (sistem kütüphanesi gerekmiyor, fontlar modül klasöründen).
 *
 * Metin ölçümü fontkit ile: uzun tablo adı iki satıra bölünüyor, sığmayan
 * yer üç noktayla kesiliyor. Ürün satırı sayısı kalan yere göre
 * hesaplanıyor; kart hiçbir içerikte taşmıyor.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');
const { Resvg } = require('@resvg/resvg-js');
const { VARSAYILAN } = require('./ayar');
const { tabloAdi, tl, adet, yuzde } = require('./pdf');

const KLASOR = __dirname;
const FONT_DOSYALARI = ['DMSans-Regular', 'DMSans-SemiBold', 'Manrope-Bold', 'Manrope-ExtraBold']
    .map((f) => path.join(KLASOR, 'fontlar', f + '.ttf'));
const OLCU = {
    govde: fontkit.openSync(FONT_DOSYALARI[0]),
    govdeKalin: fontkit.openSync(FONT_DOSYALARI[1]),
    baslik: fontkit.openSync(FONT_DOSYALARI[3]),
};
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(KLASOR, 'logo.png')).toString('base64');

const S = 1080;
const P = 72;
const IC = S - 2 * P;

const TEMALAR = {
    mavi: {
        zemin: '#2357e8', desen: '#ffffff', desenOpak: 0.07, yazi: '#ffffff', sonuk: 'rgba(255,255,255,0.72)',
        kutu: 'rgba(255,255,255,0.12)', cizgi: 'rgba(255,255,255,0.22)', serit: 'rgba(255,255,255,0.22)', dolgu: '#ffffff',
        eksik: '#ffd2cc', fazla: '#b9f3d6', logoZemin: '#ffffff', urunZemin: 'rgba(255,255,255,0.10)',
    },
    koyu: {
        zemin: '#0f1729', desen: '#2563eb', desenOpak: 0.16, yazi: '#ffffff', sonuk: 'rgba(255,255,255,0.64)',
        kutu: 'rgba(255,255,255,0.07)', cizgi: 'rgba(255,255,255,0.14)', serit: 'rgba(255,255,255,0.14)', dolgu: '#4f86ff',
        eksik: '#ff9b8f', fazla: '#6ee7b0', logoZemin: '#ffffff', urunZemin: 'rgba(255,255,255,0.05)',
    },
    acik: {
        zemin: '#f7f6f2', desen: '#2563eb', desenOpak: 0.06, yazi: '#111827', sonuk: '#667085',
        kutu: '#ffffff', cizgi: '#e4e7ec', serit: '#e4e7ec', dolgu: '#2563eb',
        eksik: '#b42318', fazla: '#047857', logoZemin: '#ffffff', urunZemin: '#ffffff',
    },
};

function kacir(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function genislik(font, metin, boy) {
    try {
        return (font.layout(String(metin)).advanceWidth / font.unitsPerEm) * boy;
    } catch (e) {
        return String(metin).length * boy * 0.55;
    }
}

function kirp(font, metin, boy, azami) {
    const s = String(metin || '');
    if (genislik(font, s, boy) <= azami) return s;
    let a = 0;
    let b = s.length;
    while (a < b) {
        const o = Math.ceil((a + b) / 2);
        if (genislik(font, s.slice(0, o) + '…', boy) <= azami) a = o;
        else b = o - 1;
    }
    return s.slice(0, a).trimEnd() + '…';
}

/** En fazla iki satır; ikinci satır sığmazsa üç nokta */
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

function metin(x, y, icerik, { boy, aile = 'DM Sans', agirlik = 400, renk, hiza = 'start', aralik = 0 }) {
    return `<text x="${x}" y="${y}" font-family="${aile}" font-weight="${agirlik}" font-size="${boy}" fill="${renk}"` +
        ` text-anchor="${hiza}"${aralik ? ` letter-spacing="${aralik}"` : ''}>${kacir(icerik)}</text>`;
}

function veriUri(buf) {
    if (!buf) return '';
    const png = buf[0] === 0x89;
    return `data:image/${png ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
}

/**
 * @returns {Buffer} PNG
 */
function kartUret(veri, bilgi, ayarGirdi, gorseller) {
    const ayar = { ...VARSAYILAN, ...(ayarGirdi || {}) };
    const T = TEMALAR[ayar.kartTema] || TEMALAR.mavi;
    const o = veri.ozet;
    const fiyatli = ayar.fiyat;
    const parca = [];
    const tamam = o.urun > 0 && o.sayilmayan === 0;

    // Zemin ve sade desen (iki büyük halka, köşede)
    parca.push(`<rect width="${S}" height="${S}" fill="${T.zemin}"/>`);
    parca.push(`<circle cx="${S - 40}" cy="80" r="300" fill="none" stroke="${T.desen}" stroke-opacity="${T.desenOpak}" stroke-width="90"/>`);
    parca.push(`<circle cx="${S - 40}" cy="80" r="470" fill="none" stroke="${T.desen}" stroke-opacity="${T.desenOpak * 0.6}" stroke-width="40"/>`);

    // Üst: logo, ad, tarih
    let y = P;
    parca.push(`<rect x="${P}" y="${y}" width="72" height="72" rx="20" fill="${T.logoZemin}"/>`);
    parca.push(`<image href="${LOGO}" x="${P + 6}" y="${y + 6}" width="60" height="60"/>`);
    parca.push(metin(P + 92, y + 34, 'Jet Barkod', { boy: 32, aile: 'Manrope', agirlik: 800, renk: T.yazi }));
    parca.push(metin(P + 92, y + 64, 'Sayım Raporu', { boy: 22, renk: T.sonuk }));
    const tarih = bilgi.tarih.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const tG = genislik(OLCU.govdeKalin, tarih, 22) + 40;
    parca.push(`<rect x="${S - P - tG}" y="${y + 14}" width="${tG}" height="44" rx="22" fill="${T.kutu}" stroke="${T.cizgi}"/>`);
    parca.push(metin(S - P - tG / 2, y + 43, tarih, { boy: 22, agirlik: 600, renk: T.yazi, hiza: 'middle' }));
    y += 72 + 64;
    const ortaBasi = parca.length;

    // Durum etiketi ve tablo adı
    const dongu = bilgi.dongu || null;
    parca.push(metin(P, y, dongu ? 'DÖNGÜ · ALT KATEGORİ' : tamam ? 'SAYIM TAMAMLANDI' : 'SAYIM DURUMU', { boy: 22, agirlik: 600, renk: T.sonuk, aralik: 3 }));
    y += 20;
    const satirlar = ikiSatir(OLCU.baslik, tabloAdi(bilgi.tablo), 66, IC);
    for (const s of satirlar) {
        y += 74;
        parca.push(metin(P, y, s, { boy: 66, aile: 'Manrope', agirlik: 800, renk: T.yazi }));
    }
    if (ayar.not) {
        y += 50;
        parca.push(metin(P, y, kirp(OLCU.govde, ayar.not, 28, IC), { boy: 28, renk: T.sonuk }));
    }
    y += 52;

    // İlerleme
    const oran = o.urun ? o.sayilan / o.urun : 0;
    parca.push(metin(P, y + 34, yuzde(oran * 100), { boy: 44, aile: 'Manrope', agirlik: 800, renk: T.yazi }));
    parca.push(metin(S - P, y + 30, `${adet(o.sayilan)} / ${adet(o.urun)} ürün sayıldı`, { boy: 26, renk: T.sonuk, hiza: 'end' }));
    y += 56;
    parca.push(`<rect x="${P}" y="${y}" width="${IC}" height="16" rx="8" fill="${T.serit}"/>`);
    if (oran > 0) parca.push(`<rect x="${P}" y="${y}" width="${Math.max(16, IC * oran)}" height="16" rx="8" fill="${T.dolgu}"/>`);
    y += 44;

    // Döngü ilerlemesi: kaç alt kategori sayıldı, dağılım şeridi
    if (dongu) {
        const dilimler = [
            [dongu.sayildi, T.fazla],
            [dongu.suruyor, T.dolgu],
            [dongu.gecikti, T.eksik],
        ];
        const kH = 156;
        parca.push(`<rect x="${P}" y="${y}" width="${IC}" height="${kH}" rx="28" fill="${T.kutu}" stroke="${T.cizgi}"/>`);
        parca.push(metin(P + 28, y + 44, 'DÖNGÜ', { boy: 20, agirlik: 600, renk: T.sonuk, aralik: 2 }));
        const sag = `${adet(dongu.sayildi)} / ${adet(dongu.toplam)} alt kategori sayıldı`;
        parca.push(metin(S - P - 28, y + 46, sag, { boy: 26, agirlik: 600, renk: T.yazi, hiza: 'end' }));
        const sx = P + 28;
        const sG = IC - 56;
        const sy = y + 70;
        parca.push(`<clipPath id="dongu"><rect x="${sx}" y="${sy}" width="${sG}" height="14" rx="7"/></clipPath>`);
        parca.push(`<rect x="${sx}" y="${sy}" width="${sG}" height="14" rx="7" fill="${T.serit}"/>`);
        let dx = sx;
        const dSvg = [];
        for (const [n, renk] of dilimler) {
            const g = (n / dongu.toplam) * sG;
            if (g > 0) dSvg.push(`<rect x="${dx}" y="${sy}" width="${g + 0.5}" height="14" fill="${renk}"/>`);
            dx += g;
        }
        parca.push(`<g clip-path="url(#dongu)">${dSvg.join('')}</g>`);
        // Renk açıklaması: sığmayan etiket yazılmaz, kart taşmaz
        const aciklama = [['Sayıldı', dongu.sayildi, T.fazla], ['Sürüyor', dongu.suruyor, T.dolgu], ['Gecikti', dongu.gecikti, T.eksik], ['Hiç sayılmadı', dongu.yok, T.serit]];
        let lx = sx;
        for (const [ad, n, renk] of aciklama) {
            const etiket = `${ad} ${adet(n)}`;
            const g = 26 + genislik(OLCU.govde, etiket, 22);
            if (lx + g > sx + sG) break;
            parca.push(`<rect x="${lx}" y="${sy + 34}" width="16" height="16" rx="5" fill="${renk}"/>`);
            parca.push(metin(lx + 26, sy + 49, etiket, { boy: 22, renk: T.yazi }));
            lx += g + 28;
        }
        y += kH + 24;
    }

    // Üç kutu
    const kG = (IC - 32) / 3;
    const kH = 172;
    const netAdet = Math.round(((o.fazla.adet || 0) - (o.eksik.adet || 0)) * 1000) / 1000;
    const kutular = [
        ['EKSİK', fiyatli ? tl(-Math.abs(o.eksik.tl)) : adet(-o.eksik.adet), fiyatli ? `${adet(o.eksik.urun)} ürün · ${adet(o.eksik.adet)} adet` : `${adet(o.eksik.urun)} ürün`, T.eksik],
        ['FAZLA', fiyatli ? tl(o.fazla.tl, true) : adet(o.fazla.adet, true), fiyatli ? `${adet(o.fazla.urun)} ürün · ${adet(o.fazla.adet)} adet` : `${adet(o.fazla.urun)} ürün`, T.fazla],
        ['NET FARK', fiyatli ? tl(o.net, true) : adet(netAdet, true), o.dogruluk === null ? 'Karşılaştırma yok' : `Doğruluk ${yuzde(o.dogruluk)}`, T.yazi],
    ];
    kutular.forEach(([etiket, deger, alt, renk], i) => {
        const x = P + i * (kG + 16);
        parca.push(`<rect x="${x}" y="${y}" width="${kG}" height="${kH}" rx="28" fill="${T.kutu}" stroke="${T.cizgi}"/>`);
        parca.push(metin(x + 28, y + 48, etiket, { boy: 20, agirlik: 600, renk: T.sonuk, aralik: 2 }));
        // Fiyat kapalıyken sayının yanında küçük "adet" birimi
        // (SVG baştaki boşluğu yuttuğu için birim 8 px kaydırılarak yazılıyor)
        const birim = fiyatli ? '' : 'adet';
        const birimG = birim ? genislik(OLCU.govdeKalin, birim, 24) + 8 : 0;
        let boy = 46;
        while (boy > 28 && genislik(OLCU.baslik, deger, boy) + birimG > kG - 56) boy -= 2;
        parca.push(metin(x + 28, y + 108, deger, { boy, aile: 'Manrope', agirlik: 800, renk }));
        if (birim) parca.push(metin(x + 28 + genislik(OLCU.baslik, deger, boy) + 8, y + 108, birim, { boy: 24, agirlik: 600, renk: T.sonuk }));
        parca.push(metin(x + 28, y + 146, kirp(OLCU.govde, alt, 22, kG - 56), { boy: 22, renk: T.sonuk }));
    });
    y += kH + 40;

    // Alt şerit: en çok eksik ürünler (yer kaldığı kadar)
    const altCizgi = S - P - 52;
    const SATIR = 84;
    if (ayar.kartUrunler && veri.eksik.length) {
        const sigan = Math.max(0, Math.min(3, Math.floor((altCizgi - y - 44) / SATIR)));
        const liste = veri.eksik.slice(0, sigan);
        if (liste.length) {
            parca.push(metin(P, y + 8, 'EN ÇOK EKSİK', { boy: 20, agirlik: 600, renk: T.sonuk, aralik: 2 }));
            y += 28;
            for (const p of liste) {
                parca.push(`<rect x="${P}" y="${y}" width="64" height="64" rx="16" fill="#ffffff"/>`);
                const g = gorseller && gorseller.get(p.id);
                if (g) parca.push(`<image href="${veriUri(g)}" x="${P + 4}" y="${y + 4}" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>`);
                else parca.push(`<rect x="${P + 20}" y="${y + 20}" width="24" height="24" rx="6" fill="#eef0f3"/>`);
                // Sağda iki satır: adet farkı (her zaman) ve fiyat açıksa TL etkisi
                const adetMetni = adet(p.fark, true) + ' adet';
                const tlMetni = fiyatli && p.tl !== null ? tl(p.tl, true) : '';
                const dG = Math.max(genislik(OLCU.govdeKalin, adetMetni, 26), tlMetni ? genislik(OLCU.govde, tlMetni, 22) : 0);
                parca.push(metin(P + 88, y + 42, kirp(OLCU.govdeKalin, p.ad, 28, IC - 88 - dG - 32), { boy: 28, agirlik: 600, renk: T.yazi }));
                if (tlMetni) {
                    parca.push(metin(S - P, y + 28, adetMetni, { boy: 26, agirlik: 600, renk: T.eksik, hiza: 'end' }));
                    parca.push(metin(S - P, y + 56, tlMetni, { boy: 22, renk: T.sonuk, hiza: 'end' }));
                } else {
                    parca.push(metin(S - P, y + 42, adetMetni, { boy: 26, agirlik: 600, renk: T.eksik, hiza: 'end' }));
                }
                y += SATIR;
            }
        }
    } else if (y + 110 < altCizgi) {
        // Ürün listesi yoksa: ürün durumu şeridi ve açıklaması
        const dilimler = [
            ['Aynı', o.esit, T.dolgu],
            ['Eksik', o.eksik.urun, T.eksik],
            ['Fazla', o.fazla.urun, T.fazla],
            ['Sayılmadı', o.sayilmayan, T.serit],
        ];
        const toplam = dilimler.reduce((t, d) => t + d[1], 0) || 1;
        parca.push(metin(P, y + 8, 'ÜRÜN DURUMU', { boy: 20, agirlik: 600, renk: T.sonuk, aralik: 2 }));
        y += 28;
        parca.push(`<clipPath id="serit"><rect x="${P}" y="${y}" width="${IC}" height="20" rx="10"/></clipPath>`);
        parca.push(`<rect x="${P}" y="${y}" width="${IC}" height="20" rx="10" fill="${T.serit}"/>`);
        let x = P;
        const dilimSvg = [];
        for (const [, n, renk] of dilimler) {
            const g = (n / toplam) * IC;
            if (g > 0) dilimSvg.push(`<rect x="${x}" y="${y}" width="${g + 0.5}" height="20" fill="${renk}"/>`);
            x += g;
        }
        parca.push(`<g clip-path="url(#serit)">${dilimSvg.join('')}</g>`);
        y += 56;
        let lx = P;
        for (const [ad, n, renk] of dilimler) {
            parca.push(`<rect x="${lx}" y="${y - 18}" width="18" height="18" rx="5" fill="${renk}"/>`);
            const etiket = `${ad} ${adet(n)}`;
            parca.push(metin(lx + 28, y - 2, etiket, { boy: 24, renk: T.yazi }));
            lx += 28 + genislik(OLCU.govde, etiket, 24) + 36;
        }
    }

    // Artan yer varsa orta bölümü dikeyde ortala; kart hiç boş durmasın
    const artan = altCizgi - 48 - y;
    if (artan > 24) {
        const orta = parca.splice(ortaBasi);
        parca.push(`<g transform="translate(0 ${Math.round(artan / 2)})">${orta.join('')}</g>`);
    }

    // Altlık
    parca.push(`<rect x="${P}" y="${altCizgi}" width="${IC}" height="2" fill="${T.cizgi}"/>`);
    parca.push(metin(P, S - P + 4, 'Jet Barkod ile sayıldı', { boy: 24, agirlik: 600, renk: T.sonuk }));
    parca.push(metin(S - P, S - P + 4, 'jetbarkod.com.tr', { boy: 24, renk: T.sonuk, hiza: 'end' }));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${parca.join('')}</svg>`;
    const r = new Resvg(svg, {
        fitTo: { mode: 'width', value: S },
        font: { fontFiles: FONT_DOSYALARI, loadSystemFonts: false, defaultFontFamily: 'DM Sans' },
    });
    return r.render().asPng();
}

/** Kartta görünebilecek ürünler */
function kartGorselleri(veri, ayarGirdi) {
    const ayar = { ...VARSAYILAN, ...(ayarGirdi || {}) };
    return ayar.kartUrunler ? veri.eksik.slice(0, 3) : [];
}

module.exports = { kartUret, kartGorselleri };
