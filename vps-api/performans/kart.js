/**
 * Performans raporu kartları (1080 px genişlik, boy içeriğe göre)
 * ============================================================================
 *
 *   dpsKarti      Depo Performans Sistemi: Bayi, Kurye ve Picker DPS (harf
 *                 notuyla), kriter tablosu (ağırlık, performans %, puan) ve
 *                 denetimler. Adlar panelin sayfasındakiyle aynı.
 *   kuryeKartlari Kurye Performansı: özet ve kurye başına seçilen ölçüler.
 *                 Uzun liste ~2200 px'lik kartlara bölünür.
 *
 * Kurye fotoğrafı yalnız çizim için bellekte (diske yazılmaz).
 * Yazı tipleri, logo ve çizim yardımcıları Satıştan Kaldırma kartından.
 * ============================================================================
 */
'use strict';

const { Resvg } = require('@resvg/resvg-js');
const { araclar } = require('../kaldirma/kart');

const { kacir, genislik, kirp, yazi, veriUri, OLCU, LOGO, R, FONT_DOSYALARI } = araclar;

const G = 1080;
const P = 56;
const IC = G - 2 * P;
const AZAMI_BOY = 2200;
const RK = {
    ...R,
    mavi: '#2357e8', maviZemin: '#eef4ff', yesilYazi: '#067647', yesilZemin: '#ecfdf3',
    turuncu: '#b54708', turuncuZemin: '#fffaeb', kirmiziZemin: '#fef3f2', mor: '#6941c6', morZemin: '#f4f3ff',
};

const ondalik = (n, basamak = 2) => (n == null || !Number.isFinite(n) ? '-' : n.toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak }));
const yuzde = (n) => (n == null || !Number.isFinite(n) ? '-' : '%' + n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const dakika = (n) => (n == null || !Number.isFinite(n) ? '-' : n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' dk');

/** Puan rengi: panelin yeşil/sarı/kırmızı ayrımı */
function puanRengi(p) {
    if (p == null) return RK.sonuk;
    if (p >= 95) return RK.yesilYazi;
    if (p >= 85) return RK.turuncu;
    return RK.kirmizi;
}

function harfRengi(h) {
    if (!h) return { renk: RK.sonuk, zemin: RK.zemin };
    if (/^A/.test(h)) return { renk: RK.yesilYazi, zemin: RK.yesilZemin };
    if (/^B/.test(h)) return { renk: RK.mavi, zemin: RK.maviZemin };
    if (/^C/.test(h)) return { renk: RK.turuncu, zemin: RK.turuncuZemin };
    return { renk: RK.kirmizi, zemin: RK.kirmiziZemin };
}

function tarihAraligi(bas, son) {
    const ad = (g, yil) => {
        const [y, m, d] = String(g).split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', ...(yil ? { year: 'numeric' } : {}) });
    };
    return bas === son ? ad(bas, true) : ad(bas, false) + ' - ' + ad(son, true);
}

function gunEtiketi(bas, son) {
    const [y, m, d] = String(son).split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d, 12));
    if (bas === son) return t.toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long' });
    const [y0, m0, d0] = String(bas).split('-').map(Number);
    return d0 + (m0 === m ? '' : '.' + m0) + '-' + t.toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' }) + (y0 !== y ? ' ' + y : '');
}

function svgPng(parcalar, H) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${H}" viewBox="0 0 ${G} ${H}">${parcalar.join('')}</svg>`;
    return new Resvg(svg, {
        fitTo: { mode: 'width', value: G },
        font: { fontFiles: FONT_DOSYALARI, loadSystemFonts: false, defaultFontFamily: 'DM Sans' },
    }).render().asPng();
}

function ust(p, baslik, alt, etiket) {
    const y = P;
    p.push(`<rect x="${P}" y="${y}" width="64" height="64" rx="18" fill="#ffffff" stroke="${RK.cizgi}"/>`);
    p.push(`<image href="${LOGO}" x="${P + 6}" y="${y + 6}" width="52" height="52"/>`);
    const eG = etiket ? genislik(OLCU.govdeKalin, etiket, 20) + 36 : 0;
    p.push(yazi(P + 84, y + 30, kirp(OLCU.baslik, baslik, 30, IC - 84 - eG - 16), { boy: 30, aile: 'Manrope', agirlik: 800 }));
    p.push(yazi(P + 84, y + 58, kirp(OLCU.govde, alt, 19, IC - 84 - eG - 16), { boy: 19, renk: RK.sonuk }));
    if (etiket) {
        p.push(`<rect x="${G - P - eG}" y="${y + 12}" width="${eG}" height="40" rx="20" fill="#ffffff" stroke="${RK.cizgi}"/>`);
        p.push(yazi(G - P - eG / 2, y + 39, etiket, { boy: 20, agirlik: 600, hiza: 'middle' }));
    }
    return y + 64 + 36;
}

function alt(p, H, sayfa) {
    p.push(`<rect x="${P}" y="${H - 80}" width="${IC}" height="2" fill="${RK.cizgi}"/>`);
    p.push(yazi(P, H - 38, 'Jet Barkod · Performans Raporu', { boy: 19, agirlik: 600, renk: RK.sonuk }));
    p.push(yazi(G - P, H - 38, sayfa || 'jetbarkod.com.tr', { boy: 19, renk: RK.sonuk, hiza: 'end' }));
}

function harfRozeti(p, x, y, harf, boy = 22) {
    const h = harf || '-';
    const r = harfRengi(harf);
    const w = Math.max(boy * 2.2, genislik(OLCU.baslik, h, boy) + 24);
    p.push(`<rect x="${x}" y="${y}" width="${w}" height="${boy + 18}" rx="${(boy + 18) / 2}" fill="${r.zemin}"/>`);
    p.push(yazi(x + w / 2, y + boy + 4, h, { boy, aile: 'Manrope', agirlik: 800, renk: r.renk, hiza: 'middle' }));
    return w;
}

function uyariSeridi(p, y, metin) {
    p.push(`<rect x="${P}" y="${y}" width="${IC}" height="64" rx="18" fill="${RK.turuncuZemin}" stroke="#fedf89"/>`);
    p.push(yazi(P + 24, y + 40, kirp(OLCU.govde, metin, 19, IC - 48), { boy: 19, renk: RK.turuncu }));
    return y + 64 + 24;
}

// ---------------------------------------------------------------------
// DPS
// ---------------------------------------------------------------------

/**
 * d: veriDuzelt().dps ; secenek: { kurye, depocu, denetim (bool), bas, son, uyari }
 */
function dpsKarti(d, secenek = {}) {
    const p = [''];
    let y = ust(p, 'Depo Performans Sistemi', 'DPS · ' + tarihAraligi(secenek.bas, secenek.son) + (d.depoAd ? ' · ' + d.depoAd : ''), gunEtiketi(secenek.bas, secenek.son));
    if (secenek.uyari) y = uyariSeridi(p, y, secenek.uyari);

    // Üç özet: Bayi, Kurye, Picker DPS
    const kutular = [['BAYİ DPS', d.bayi], ['KURYE DPS', d.kurye], ['PICKER DPS', d.depocu]];
    const kG = Math.floor((IC - 2 * 20) / 3);
    kutular.forEach(([ad, o], i) => {
        const x = P + i * (kG + 20);
        const ana = i === 0;
        p.push(`<rect x="${x}" y="${y}" width="${kG}" height="176" rx="24" fill="${ana ? RK.maviZemin : RK.kart}" stroke="${ana ? '#c7d7fe' : RK.cizgi}"/>`);
        p.push(yazi(x + 28, y + 44, ad, { boy: 17, agirlik: 600, renk: ana ? RK.mavi : RK.sonuk, aralik: 1.4 }));
        p.push(yazi(x + 28, y + 118, ondalik(o.puan), { boy: 54, aile: 'Manrope', agirlik: 800, renk: RK.yazi }));
        harfRozeti(p, x + 28, y + 132, o.harf, 18);
    });
    y += 176 + 32;

    // Kriter tablosu (panelin tablosu): Ağırlık | Kurye perf/puan | Depocu perf/puan
    const kurye = secenek.kurye !== false;
    const depocu = secenek.depocu !== false;
    const kolon = [];
    let sag = G - P - 24;
    const ekle = (ad, deger, renkli, sade) => { kolon.unshift({ ad, deger, renkli, sade, x: sag }); sag -= 128; };
    if (depocu) { ekle('PUAN', (k) => k.depocu && k.depocu.puan, true); ekle('PERF. %', (k) => k.depocu && k.depocu.perf, false); }
    if (kurye) { ekle('PUAN', (k) => k.kurye && k.kurye.puan, true); ekle('PERF. %', (k) => k.kurye && k.kurye.perf, false); }
    ekle('AĞIRLIK %', (k) => k.agirlik, false, true);
    const adG = sag + 128 - 24 - (P + 24) - 16;

    // Grup başlıkları
    p.push(`<rect x="${P}" y="${y}" width="${IC}" height="${(d.kriterler.length + 2) * 52 + 12}" rx="24" fill="${RK.kart}" stroke="${RK.cizgi}"/>`);
    let ty = y + 40;
    p.push(yazi(P + 24, ty, 'KRİTER', { boy: 15, agirlik: 600, renk: RK.sonuk, aralik: 1.2 }));
    const grupAd = [];
    if (kurye) grupAd.push({ ad: 'KURYE', x1: kolon[kolon.length - (depocu ? 4 : 2)].x, x2: kolon[kolon.length - (depocu ? 3 : 1)].x });
    if (depocu) grupAd.push({ ad: 'DEPOCU', x1: kolon[kolon.length - 2].x, x2: kolon[kolon.length - 1].x });
    grupAd.forEach((g) => p.push(yazi((g.x1 + g.x2) / 2 - 40, ty, g.ad, { boy: 15, agirlik: 700, renk: RK.mavi, aralik: 1.2, hiza: 'middle' })));
    ty += 34;
    kolon.forEach((c) => p.push(yazi(c.x, ty, c.ad, { boy: 13, agirlik: 600, renk: RK.sonuk, hiza: 'end', aralik: 0.8 })));
    ty += 8;
    d.kriterler.forEach((k, i) => {
        if (i % 2 === 0) p.push(`<rect x="${P + 8}" y="${ty + 4}" width="${IC - 16}" height="48" rx="12" fill="${RK.zemin}"/>`);
        const satirY = ty + 36;
        p.push(yazi(P + 24, satirY, kirp(OLCU.govde, k.ad, 20, adG), { boy: 20, renk: RK.yazi }));
        kolon.forEach((c) => {
            const v = c.deger(k);
            // Ağırlık panelde olduğu gibi: 25, 7,5
            const metinV = v == null ? '-' : c.sade ? v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : ondalik(v);
            p.push(yazi(c.x, satirY, metinV, { boy: 20, aile: c.renkli ? 'Manrope' : 'DM Sans', agirlik: c.renkli ? 800 : 400, renk: c.renkli ? puanRengi(v) : RK.orta, hiza: 'end' }));
        });
        ty += 52;
    });
    y += (d.kriterler.length + 2) * 52 + 12 + 24;

    if (secenek.denetim !== false) {
        const dn = d.denetim || {};
        const parca = [['Denetim', dn.bayi], ['Filo Denetimi', dn.filo], ['Kalite Denetimi', dn.kalite]];
        const dG = Math.floor((IC - 2 * 16) / 3);
        parca.forEach(([ad, v], i) => {
            const x = P + i * (dG + 16);
            p.push(`<rect x="${x}" y="${y}" width="${dG}" height="88" rx="20" fill="${RK.kart}" stroke="${RK.cizgi}"/>`);
            p.push(yazi(x + 24, y + 36, ad, { boy: 17, agirlik: 600, renk: RK.sonuk }));
            p.push(yazi(x + 24, y + 70, v == null ? '-' : ondalik(v), { boy: 26, aile: 'Manrope', agirlik: 800, renk: RK.yazi }));
        });
        y += 88 + 24;
    }

    const H = y + 104 - 16;
    p[0] = `<rect width="${G}" height="${H}" fill="${RK.zemin}"/>`;
    alt(p, H);
    return svgPng(p, H);
}

// ---------------------------------------------------------------------
// Kurye
// ---------------------------------------------------------------------

const ALANLAR = [
    ['birlesen', 'Birleşen', (k) => (k.birlesen == null ? '-' : String(k.birlesen)), () => RK.yazi],
    ['ortTeslimat', 'Ort. Teslimat', (k) => dakika(k.ortTeslimat), () => RK.yazi],
    ['yoldaSure', 'Yolda Geçen', (k) => dakika(k.yoldaSure), () => RK.yazi],
    ['ulasmaTeslim', 'Ulaşma-Teslim', (k) => dakika(k.ulasmaTeslim), () => RK.yazi],
    ['donusSure', 'Depoya Dönüş', (k) => dakika(k.donusSure), () => RK.yazi],
    ['yoldaPuan', 'Yolda Puanı', (k) => yuzde(k.yoldaPuan), (k) => puanRengi(k.yoldaPuan)],
    ['teslimatPuan', 'Teslimat Puanı', (k) => yuzde(k.teslimatPuan), (k) => puanRengi(k.teslimatPuan)],
    ['donusPuan', 'Dönüş Puanı', (k) => yuzde(k.donusPuan), (k) => (k.donusPuan == null ? RK.sonuk : k.donusPuan >= 70 ? RK.yesilYazi : k.donusPuan >= 50 ? RK.turuncu : RK.kirmizi)],
    ['cdiPuan', 'CDI Puanı', (k) => yuzde(k.cdiPuan), (k) => puanRengi(k.cdiPuan)],
    ['problemli', 'Problemli', (k) => (k.problemli == null ? '-' : String(k.problemli)), (k) => (k.problemli ? RK.kirmizi : RK.yazi)],
];

const HARF_SIRA = ['A++', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

function sirala(liste, siralama) {
    const l = liste.slice();
    if (siralama === 'ad') return l.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    if (siralama === 'teslimat') return l.sort((a, b) => (a.ortTeslimat == null) - (b.ortTeslimat == null) || (a.ortTeslimat - b.ortTeslimat) || b.siparis - a.siparis);
    if (siralama === 'not') {
        const s = (h) => { const i = HARF_SIRA.indexOf(h); return i === -1 ? 99 : i; };
        return l.sort((a, b) => s(a.harf) - s(b.harf) || b.siparis - a.siparis);
    }
    return l.sort((a, b) => b.siparis - a.siparis || a.ad.localeCompare(b.ad, 'tr'));
}

function kuryeFoto(p, x, y, boy, buf, ad) {
    const id = 'kf' + Math.random().toString(36).slice(2, 9);
    const img = veriUri(buf);
    if (img) {
        p.push(`<clipPath id="${id}"><circle cx="${x + boy / 2}" cy="${y + boy / 2}" r="${boy / 2}"/></clipPath>`);
        p.push(`<circle cx="${x + boy / 2}" cy="${y + boy / 2}" r="${boy / 2}" fill="${RK.zemin}"/>`);
        p.push(`<image href="${img}" x="${x}" y="${y}" width="${boy}" height="${boy}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`);
    } else {
        const bas = String(ad || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toLocaleUpperCase('tr')).join('');
        p.push(`<circle cx="${x + boy / 2}" cy="${y + boy / 2}" r="${boy / 2}" fill="${RK.morZemin}"/>`);
        p.push(yazi(x + boy / 2, y + boy / 2 + 9, bas, { boy: 24, aile: 'Manrope', agirlik: 800, renk: RK.mor, hiza: 'middle' }));
    }
}

/**
 * liste: veriDuzelt().kurye ; secenek: { siralama, foto, alanlar, bas, son, uyari, fotolar: Map(id -> Buffer) }
 */
function kuryeKartlari(liste, secenek = {}) {
    const secili = ALANLAR.filter(([k]) => !secenek.alanlar || secenek.alanlar[k] !== false);
    const sutun = 4;
    const satirSayisi = Math.max(1, Math.ceil(secili.length / sutun));
    // Kutu: üst bilgi 108 + ölçü satırları (56) + alt boşluk 14; satırlar arası 16
    const SATIR_H = 108 + satirSayisi * 56 + 14 + 16;
    const kuryeler = sirala(liste.filter((k) => k.siparis > 0 || k.toplamSiparis > 0), secenek.siralama);
    const toplam = kuryeler.reduce((t, k) => t + k.siparis, 0);
    const agirlikli = kuryeler.filter((k) => k.ortTeslimat != null && k.siparis);
    const ortalama = agirlikli.length ? agirlikli.reduce((t, k) => t + k.ortTeslimat * k.siparis, 0) / agirlikli.reduce((t, k) => t + k.siparis, 0) : null;
    const problemli = kuryeler.reduce((t, k) => t + (k.problemli || 0), 0);
    const fotolar = secenek.fotolar || new Map();

    const kartlar = [];
    let p = null;
    let y = 0;
    const yeni = (ilk) => {
        p = [''];
        y = ust(p, 'Kurye Performansı', tarihAraligi(secenek.bas, secenek.son) + ' · ' + kuryeler.length + ' kurye', gunEtiketi(secenek.bas, secenek.son));
        if (ilk && secenek.uyari) y = uyariSeridi(p, y, secenek.uyari);
        if (ilk) {
            const ozet = [['TOPLAM SİPARİŞ', String(toplam)], ['KURYE', String(kuryeler.length)], ['ORT. TESLİMAT', ortalama == null ? '-' : dakika(ortalama)], ['PROBLEMLİ', String(problemli)]];
            const kG = Math.floor((IC - 3 * 16) / 4);
            ozet.forEach(([ad, v], i) => {
                const x = P + i * (kG + 16);
                p.push(`<rect x="${x}" y="${y}" width="${kG}" height="120" rx="22" fill="${i === 0 ? RK.maviZemin : RK.kart}" stroke="${i === 0 ? '#c7d7fe' : RK.cizgi}"/>`);
                p.push(yazi(x + 22, y + 38, ad, { boy: 15, agirlik: 600, renk: i === 0 ? RK.mavi : RK.sonuk, aralik: 1.2 }));
                p.push(yazi(x + 22, y + 90, v, { boy: 38, aile: 'Manrope', agirlik: 800, renk: i === 3 && problemli ? RK.kirmizi : RK.yazi }));
            });
            y += 120 + 28;
        }
    };
    const bitir = () => { const H = y + 104 - 16; p[0] = `<rect width="${G}" height="${H}" fill="${RK.zemin}"/>`; kartlar.push({ p, H }); };
    yeni(true);
    if (!kuryeler.length) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="120" rx="24" fill="${RK.kart}" stroke="${RK.cizgi}"/>`);
        p.push(yazi(P + 28, y + 70, 'Bu tarihlerde sipariş taşıyan kurye görünmüyor.', { boy: 21, renk: RK.sonuk }));
        y += 120 + 24;
    }
    kuryeler.forEach((k) => {
        if (y + SATIR_H + 104 > AZAMI_BOY && y > P + 160) { bitir(); yeni(false); }
        const x = P;
        const kutuH = SATIR_H - 16;
        p.push(`<rect x="${x}" y="${y}" width="${IC}" height="${kutuH}" rx="22" fill="${RK.kart}" stroke="${RK.cizgi}"/>`);
        const FOTO = 64;
        let mx = x + 24;
        if (secenek.foto !== false) { kuryeFoto(p, x + 24, y + 22, FOTO, fotolar.get(k.id), k.ad); mx += FOTO + 18; }
        // Sağda sipariş sayısı
        const sipYazi = String(k.siparis);
        const sipG = genislik(OLCU.baslik, sipYazi, 40);
        p.push(yazi(G - P - 24, y + 58, sipYazi, { boy: 40, aile: 'Manrope', agirlik: 800, renk: RK.yazi, hiza: 'end' }));
        p.push(yazi(G - P - 24, y + 84, 'sipariş', { boy: 16, renk: RK.sonuk, hiza: 'end' }));
        const adG = G - P - 24 - Math.max(sipG, 60) - 24 - mx - 110;
        p.push(yazi(mx, y + 50, kirp(OLCU.govdeKalin, k.ad, 24, adG), { boy: 24, agirlik: 600 }));
        const adW = Math.min(adG, genislik(OLCU.govdeKalin, kirp(OLCU.govdeKalin, k.ad, 24, adG), 24));
        harfRozeti(p, mx + adW + 14, y + 25, k.harf, 16);
        p.push(yazi(mx, y + 80, (k.ilk != null ? k.ilk + ' ilk sipariş' : '') + (k.toplamSiparis && k.toplamSiparis !== k.siparis ? ' · toplam ' + k.toplamSiparis : ''), { boy: 16, renk: RK.sonuk }));
        // Ölçüler: 4 sütunlu ızgara
        const gx = x + 24;
        const gG = IC - 48;
        const hucre = Math.floor(gG / sutun);
        secili.forEach(([, ad, deger, renk], i) => {
            const cx = gx + (i % sutun) * hucre;
            const cy = y + 108 + Math.floor(i / sutun) * 56;
            p.push(`<rect x="${cx}" y="${cy}" width="${hucre - 10}" height="46" rx="12" fill="${RK.zemin}"/>`);
            p.push(yazi(cx + 14, cy + 29, ad, { boy: 15, renk: RK.sonuk }));
            p.push(yazi(cx + hucre - 24, cy + 30, deger(k), { boy: 18, aile: 'Manrope', agirlik: 800, renk: renk(k), hiza: 'end' }));
        });
        y += SATIR_H;
    });
    bitir();
    return kartlar.map((kk, i) => {
        alt(kk.p, kk.H, kartlar.length > 1 ? (i + 1) + ' / ' + kartlar.length : null);
        return svgPng(kk.p, kk.H);
    });
}

/** Kurye fotoğrafları: yalnız bellekte, 128 px; diske yazılmaz. 8 sn içinde gelenler. */
async function kuryeFotolari(liste, butceMs = 8000) {
    const sonuc = new Map();
    const bitis = Date.now() + butceMs;
    const kuyruk = liste.filter((k) => k.foto).slice(0, 60);
    let sira = 0;
    async function isci() {
        while (sira < kuyruk.length && Date.now() < bitis) {
            const k = kuyruk[sira++];
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), Math.max(500, bitis - Date.now()));
            try {
                const r = await fetch(k.foto, { signal: ctrl.signal, redirect: 'error' });
                if (!r.ok) continue;
                const b = Buffer.from(await r.arrayBuffer());
                if (!b.length || b.length > 2 * 1024 * 1024) continue;
                const tur = b[0] === 0xff && b[1] === 0xd8 ? 'jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'png' : null;
                if (!tur) continue;
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#fff"/>` +
                    `<image href="data:image/${tur};base64,${b.toString('base64')}" width="128" height="128" preserveAspectRatio="xMidYMid slice"/></svg>`;
                sonuc.set(k.id, new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng());
            } catch (e) { /* fotoğrafsız */ } finally { clearTimeout(t); }
        }
    }
    await Promise.all(Array.from({ length: Math.min(4, kuyruk.length) }, isci));
    return sonuc;
}

module.exports = { dpsKarti, kuryeKartlari, kuryeFotolari, tarihAraligi, ondalik, kacir };
