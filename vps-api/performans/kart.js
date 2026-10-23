/**
 * Performans raporu kartları: yatay, tek sayfa, yüksek çözünürlük
 * ============================================================================
 *
 * Tasarım 1920 birim genişlikte, 3840 px'e çizilir (yazılar vektör: telefonda
 * yakınlaştırınca bozulmaz). Telegram fotoğrafları küçülttüğü için istenirse
 * aynı kart tam kalite dosya olarak da gider (paylas.belgeGonder).
 *
 *   dpsKarti    Depo Performans Sistemi: solda Bayi / Kurye / Picker DPS ve
 *               denetimler, sağda panelin kriter tablosu.
 *   kuryeKarti  Kurye CDI: tek tablo, kurye başına bir satır. Sütunlar
 *               kullanıcının seçtiği sırada (sutunlar.js), üstte renkli grup
 *               bandı. Kurye ve sütun sayısı ne olursa olsun tek görsel:
 *               sütunlar genişliğe, satırlar kurye sayısına göre sıkışır.
 *
 * Kurye fotoğrafı yalnız çizim için bellekte (diske yazılmaz).
 * ============================================================================
 */
'use strict';

const { Resvg } = require('@resvg/resvg-js');
const { araclar } = require('../kaldirma/kart');
const { GRUPLAR, SUTUN, sutunlariDuzelt, OZETLER, ozetDuzelt } = require('./sutunlar');

const { genislik, kirp, ikiSatir, yazi, veriUri, OLCU, LOGO, FONT_DOSYALARI } = araclar;

// Varsayılan tasarım genişliği; çok sütunlu kurye kartında genişler (yatay kalır)
const TASARIM = 1920;
const P = 64;
const OLCEK = 2;            // çıktı = tasarım × 2 (1920 → 3840 px)
const EN_DAR_KOLON = 116;   // kurye tablosunda bir sütunun en az genişliği
let W = TASARIM;
let IC = W - 2 * P;
function genislikKur(w) { W = w; IC = W - 2 * P; }

const C = {
    zemin: '#f5f7fa', kart: '#ffffff', cizgi: '#e2e8f0', cizgiAcik: '#eef2f6',
    yazi: '#0f172a', orta: '#334155', sonuk: '#64748b', soluk: '#94a3b8',
    mavi: '#2357e8', maviZemin: '#eef4ff', maviCizgi: '#c7d7fe',
    yesil: '#047857', yesilZemin: '#ecfdf5', kirmizi: '#be123c', kirmiziZemin: '#fff1f2',
    turuncu: '#b45309', turuncuZemin: '#fffbeb', mor: '#5b21b6', morZemin: '#f5f3ff',
};

// Sıra rozetleri: abartısız altın, gümüş, bronz
const SIRA_RENK = {
    1: { zemin: '#f8ecc4', yazi: '#7a5c00', cizgi: '#e9cf7a' },
    2: { zemin: '#e9edf2', yazi: '#4b5565', cizgi: '#c9d1dc' },
    3: { zemin: '#f3e1d3', yazi: '#7c4321', cizgi: '#deb89b' },
};

const TR_AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TR_GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const sayiYaz = (n, basamak = 1) => (n == null || !Number.isFinite(n) ? '-'
    : n.toLocaleString('tr-TR', { minimumFractionDigits: Math.abs(n) >= 100 ? 0 : basamak, maximumFractionDigits: Math.abs(n) >= 100 ? 0 : basamak }));
const ondalik = (n, b = 2) => sayiYaz(n, b);

function gunParca(g) {
    const [y, m, d] = String(g).split('-').map(Number);
    return { y, m, d, t: new Date(Date.UTC(y, m - 1, d, 12)) };
}

/** Tarih: "22 Ekim 2026" ya da "16 - 22 Ekim 2026" / "28 Eylül - 4 Ekim 2026" */
function tarihAraligi(bas, son) {
    const a = gunParca(bas);
    const b = gunParca(son);
    if (bas === son) return b.d + ' ' + TR_AY[b.m - 1] + ' ' + b.y;
    if (a.y === b.y && a.m === b.m) return a.d + ' - ' + b.d + ' ' + TR_AY[b.m - 1] + ' ' + b.y;
    if (a.y === b.y) return a.d + ' ' + TR_AY[a.m - 1] + ' - ' + b.d + ' ' + TR_AY[b.m - 1] + ' ' + b.y;
    return a.d + ' ' + TR_AY[a.m - 1] + ' ' + a.y + ' - ' + b.d + ' ' + TR_AY[b.m - 1] + ' ' + b.y;
}

function gunSayisi(bas, son) { return Math.round((gunParca(son).t - gunParca(bas).t) / 864e5) + 1; }

/** Tarihin altındaki açıklama: gün adı ya da dönem uzunluğu */
function tarihAlti(bas, son) {
    if (bas === son) return TR_GUN[gunParca(bas).t.getUTCDay()];
    const n = gunSayisi(bas, son);
    return n + ' günlük dönem';
}

/** Dönem adı: Günlük / Haftalık / Aylık / N Günlük */
function donemAdi(bas, son) {
    const n = gunSayisi(bas, son);
    if (n === 1) return 'Günlük';
    if (n === 7) return 'Haftalık';
    if (n >= 28 && n <= 31 && gunParca(bas).d === 1) return 'Aylık';
    return n + ' Günlük';
}

function svgPng(parcalar, H) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parcalar.join('')}</svg>`;
    return new Resvg(svg, {
        fitTo: { mode: 'width', value: W * OLCEK },
        font: { fontFiles: FONT_DOSYALARI, loadSystemFonts: false, defaultFontFamily: 'DM Sans' },
    }).render().asPng();
}

/** Üst bant: solda logo, etiket ve başlık; sağda büyük tarih. Dönen y: içeriğin başı */
function ustBant(p, { etiket, baslik, bas, son }) {
    const y = 56;
    p.push(`<rect x="${P}" y="${y}" width="88" height="88" rx="24" fill="#ffffff" stroke="${C.cizgi}"/>`);
    p.push(`<image href="${LOGO}" x="${P + 8}" y="${y + 8}" width="72" height="72"/>`);
    // Sağda tarih (ön planda)
    const tarih = tarihAraligi(bas, son);
    const tarihBoy = genislik(OLCU.baslik, tarih, 56) > 820 ? 44 : 56;
    p.push(yazi(W - P, y + 52, tarih, { boy: tarihBoy, aile: 'Manrope', agirlik: 800, renk: C.yazi, hiza: 'end' }));
    const alt = tarihAlti(bas, son);
    const altG = genislik(OLCU.govdeKalin, alt, 20) + 32;
    p.push(`<rect x="${W - P - altG}" y="${y + 66}" width="${altG}" height="36" rx="18" fill="${C.maviZemin}"/>`);
    p.push(yazi(W - P - altG / 2, y + 91, alt, { boy: 20, agirlik: 600, renk: C.mavi, hiza: 'middle' }));
    // Solda etiket ve başlık
    const solX = P + 112;
    const solG = W - P - Math.max(genislik(OLCU.baslik, tarih, tarihBoy), altG) - 48 - solX;
    p.push(yazi(solX, y + 30, etiket, { boy: 18, agirlik: 700, renk: C.mavi, aralik: 2.4 }));
    p.push(yazi(solX, y + 82, kirp(OLCU.baslik, baslik, 48, solG), { boy: 48, aile: 'Manrope', agirlik: 800, renk: C.yazi }));
    p.push(`<rect x="${P}" y="${y + 128}" width="${IC}" height="2" fill="${C.cizgi}"/>`);
    return y + 128 + 32;
}

function altBant(p, H, sol, sag) {
    p.push(`<rect x="${P}" y="${H - 72}" width="${IC}" height="2" fill="${C.cizgi}"/>`);
    p.push(yazi(P, H - 30, sol, { boy: 20, agirlik: 600, renk: C.sonuk }));
    p.push(yazi(W - P, H - 30, sag, { boy: 20, renk: C.sonuk, hiza: 'end' }));
}

function harfRenk(h) {
    const v = String(h || '').trim();
    if (v === 'A++') return { zemin: '#047857', yazi: '#ffffff' };
    if (v === 'A+') return { zemin: '#059669', yazi: '#ffffff' };
    if (/^A/.test(v)) return { zemin: '#34d399', yazi: '#064e3b' };
    if (/^B/.test(v)) return { zemin: '#93c5fd', yazi: '#1e3a8a' };
    if (/^C/.test(v)) return { zemin: '#fbbf24', yazi: '#451a03' };
    if (/^[DE]/.test(v)) return { zemin: '#cbd5e1', yazi: '#334155' };
    if (v === 'F') return { zemin: '#e11d48', yazi: '#ffffff' };
    return { zemin: C.cizgiAcik, yazi: C.sonuk };
}

function harfRozeti(p, cx, cy, harf, boy) {
    const h = harf || '-';
    const r = harfRenk(harf);
    const w = Math.max(boy * 2.4, genislik(OLCU.baslik, h, boy) + boy * 1.1);
    const hh = boy + boy * 0.75;
    p.push(`<rect x="${cx - w / 2}" y="${cy - hh / 2}" width="${w}" height="${hh}" rx="${hh / 2}" fill="${r.zemin}"/>`);
    p.push(yazi(cx, cy + boy * 0.36, h, { boy, aile: 'Manrope', agirlik: 800, renk: r.yazi, hiza: 'middle' }));
}

function puanRenk(n, iyi = 85, kotu = 75) {
    if (n == null || !Number.isFinite(n)) return { renk: C.soluk, agirlik: 400 };
    if (n >= iyi) return { renk: C.yesil, agirlik: 800 };
    if (n < kotu) return { renk: C.kirmizi, agirlik: 800 };
    return { renk: C.orta, agirlik: 600 };
}

// ---------------------------------------------------------------------
// DPS
// ---------------------------------------------------------------------

/** d: veriDuzelt().dps ; s: { kurye, depocu, denetim, bas, son, uyari } */
function dpsKarti(d, s = {}) {
    genislikKur(TASARIM);
    const p = [''];
    let y = ustBant(p, { etiket: 'DEPO PERFORMANS SİSTEMİ', baslik: d.depoAd ? d.depoAd + ' · DPS' : 'Depo Puanı (DPS)', bas: s.bas, son: s.son });
    if (s.uyari) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="64" rx="18" fill="${C.turuncuZemin}" stroke="#fcd34d"/>`);
        p.push(yazi(P + 28, y + 41, kirp(OLCU.govde, s.uyari, 22, IC - 56), { boy: 22, renk: C.turuncu }));
        y += 64 + 24;
    }
    const ustY = y;

    // Sol sütun: Bayi DPS büyük, altında Kurye ve Picker DPS, en altta denetimler
    const SOL = 560;
    const kutu = (x, ky, w, h, ad, o, buyuk) => {
        p.push(`<rect x="${x}" y="${ky}" width="${w}" height="${h}" rx="28" fill="${buyuk ? C.maviZemin : C.kart}" stroke="${buyuk ? C.maviCizgi : C.cizgi}"/>`);
        p.push(yazi(x + 32, ky + 48, ad, { boy: buyuk ? 22 : 19, agirlik: 700, renk: buyuk ? C.mavi : C.sonuk, aralik: 1.6 }));
        const boy = buyuk ? 104 : 64;
        p.push(yazi(x + 32, ky + (buyuk ? 166 : 124), ondalik(o.puan), { boy, aile: 'Manrope', agirlik: 800, renk: C.yazi }));
        harfRozeti(p, x + w - 32 - (buyuk ? 52 : 38), ky + (buyuk ? 60 : 44), o.harf, buyuk ? 34 : 24);
    };
    kutu(P, y, SOL, 216, 'BAYİ DPS', d.bayi, true);
    const yarim = (SOL - 20) / 2;
    kutu(P, y + 236, yarim, 160, 'KURYE DPS', d.kurye, false);
    kutu(P + yarim + 20, y + 236, yarim, 160, 'PICKER DPS', d.depocu, false);
    let solAlt = y + 236 + 160;
    if (s.denetim !== false) {
        const dn = d.denetim || {};
        const parca = [['Denetim', dn.bayi], ['Filo Denetimi', dn.filo], ['Kalite Denetimi', dn.kalite]];
        const dG = (SOL - 2 * 16) / 3;
        parca.forEach(([ad, v], i) => {
            const x = P + i * (dG + 16);
            p.push(`<rect x="${x}" y="${solAlt + 20}" width="${dG}" height="104" rx="22" fill="${C.kart}" stroke="${C.cizgi}"/>`);
            p.push(yazi(x + 22, solAlt + 58, ad, { boy: 18, agirlik: 600, renk: C.sonuk }));
            p.push(yazi(x + 22, solAlt + 104, v == null ? '-' : ondalik(v), { boy: 32, aile: 'Manrope', agirlik: 800, renk: C.yazi }));
        });
        solAlt += 20 + 104;
    }

    // Sağ: kriter tablosu (panelin tablosu)
    const TX = P + SOL + 32;
    const TG = W - P - TX;
    const kurye = s.kurye !== false;
    const depocu = s.depocu !== false;
    const kolonlar = [{ ad: 'Kriter Ağırlığı %', grup: 'bayi', deger: (k) => k.agirlik, sade: true }];
    if (kurye) kolonlar.push({ ad: 'Performans %', grup: 'kurye', deger: (k) => k.kurye && k.kurye.perf }, { ad: 'Puan', grup: 'kurye', deger: (k) => k.kurye && k.kurye.puan, puan: true });
    if (depocu) kolonlar.push({ ad: 'Performans %', grup: 'depocu', deger: (k) => k.depocu && k.depocu.perf }, { ad: 'Puan', grup: 'depocu', deger: (k) => k.depocu && k.depocu.puan, puan: true });
    const ADG = 380;
    const kG = (TG - ADG) / kolonlar.length;
    const SATIR = 60;
    const BANT = 48;
    const BASLIK = 56;
    const tabloH = BANT + BASLIK + d.kriterler.length * SATIR + 16;
    p.push(`<rect x="${TX}" y="${y}" width="${TG}" height="${tabloH}" rx="28" fill="${C.kart}" stroke="${C.cizgi}"/>`);
    // Grup bandı
    const gruplar = [['bayi', 'BAYİ PERFORMANSI', C.mavi, C.maviZemin, 'BAYİ'], ['kurye', 'KURYE PERFORMANSI', '#047857', '#d1fae5', 'KURYE'], ['depocu', 'DEPOCU PERFORMANSI', '#5b21b6', '#ede9fe', 'DEPOCU']];
    let gx = TX + ADG;
    p.push(yazi(TX + 32, y + 33, 'KRİTER', { boy: 17, agirlik: 700, renk: C.sonuk, aralik: 1.6 }));
    gruplar.forEach(([g, ad, renk, zemin, kisa]) => {
        const n = kolonlar.filter((k) => k.grup === g).length;
        if (!n) return;
        const w = n * kG;
        const metin = genislik(OLCU.govdeKalin, ad, 16) + 24 <= w - 24 ? ad : kisa;
        p.push(`<rect x="${gx + 6}" y="${y + 10}" width="${w - 12}" height="${BANT - 14}" rx="12" fill="${zemin}"/>`);
        p.push(yazi(gx + w / 2, y + 33, metin, { boy: 16, agirlik: 700, renk, hiza: 'middle', aralik: 1.2 }));
        gx += w;
    });
    let ty = y + BANT;
    kolonlar.forEach((k, i) => p.push(yazi(TX + ADG + i * kG + kG / 2, ty + 34, k.ad, { boy: 17, agirlik: 600, renk: C.sonuk, hiza: 'middle' })));
    ty += BASLIK;
    d.kriterler.forEach((k, i) => {
        if (i % 2 === 0) p.push(`<rect x="${TX + 10}" y="${ty}" width="${TG - 20}" height="${SATIR}" rx="14" fill="${C.zemin}"/>`);
        p.push(yazi(TX + 32, ty + 39, kirp(OLCU.govde, k.ad, 24, ADG - 48), { boy: 24, renk: C.yazi }));
        kolonlar.forEach((kol, j) => {
            const v = kol.deger(k);
            const metin = v == null ? '-' : kol.sade ? v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : ondalik(v);
            const r = kol.puan ? puanRenk(v, 95, 85) : { renk: v == null ? C.soluk : C.orta, agirlik: 400 };
            p.push(yazi(TX + ADG + j * kG + kG / 2, ty + 39, metin, { boy: 24, aile: kol.puan ? 'Manrope' : 'DM Sans', agirlik: r.agirlik, renk: r.renk, hiza: 'middle' }));
        });
        ty += SATIR;
    });
    const govdeAlt = Math.max(solAlt, y + tabloH);
    const H = govdeAlt + 40 + 72 + 24;
    p[0] = `<rect width="${W}" height="${H}" fill="${C.zemin}"/>`;
    altBant(p, H, 'Jet Barkod · DPS Raporu', 'jetbarkod.com.tr');
    return svgPng(p, H);
}

// ---------------------------------------------------------------------
// Kurye CDI
// ---------------------------------------------------------------------

const HARF_SIRA = ['A++', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E', 'F'];
const harfSira = (h) => { const i = HARF_SIRA.indexOf(String(h || '').trim()); return i === -1 ? 99 : i; };
/* Notun alt sınırı (CDI %). Aynı rapordaki kuryelerden öğrenilemezse bu kullanılır. */
const HARF_ESIK = { 'A++': 95, 'A+': 90, 'A': 85, 'A-': 82, 'B+': 80, 'B': 75, 'B-': 72, 'C+': 70, 'C': 65, 'C-': 62, 'D+': 60, 'D': 55, 'D-': 52, 'E': 45, 'F': 0 };

/**
 * Panel bazen CDI'ı boş, bazen notu boş bırakır. Sıralama için eksik olan
 * diğerinden tahmin edilir (kartta yine "-" görünür, yalnız sırası doğru olur):
 *   not var, CDI yok  → o notun alt sınırı (A++ → %95); notunun en altına düşer
 *   CDI var, not yok  → CDI'ın düştüğü en iyi not
 * Eşikler önce aynı rapordaki notu ve CDI'ı belli kuryelerden (o notun en düşük
 * CDI'ı) alınır, yoksa HARF_ESIK. İkisi de yoksa kurye en sona.
 */
function siraOlcusu(liste) {
    const esik = { ...HARF_ESIK };
    const gorulen = {};
    liste.forEach((k) => {
        const h = String(k.d.harf || '').trim();
        if (k.d.cdiPuan == null || !(h in esik)) return;
        gorulen[h] = Math.min(gorulen[h] == null ? Infinity : gorulen[h], k.d.cdiPuan);
    });
    Object.assign(esik, gorulen);
    const harfBul = (v) => HARF_SIRA.find((h) => v >= esik[h]) || 'F';
    const m = new Map();
    liste.forEach((k) => {
        const h = String(k.d.harf || '').trim();
        const harfVar = harfSira(h) !== 99;
        const cdiVar = k.d.cdiPuan != null;
        const harf = harfVar ? h : cdiVar ? harfBul(k.d.cdiPuan) : null;
        const cdi = cdiVar ? k.d.cdiPuan : harfVar ? HARF_ESIK[h] : null;
        m.set(k, {
            sira: harf == null ? 99 : harfSira(harf),
            cdi: cdi == null ? -1 : cdi,
            gercek: (harfVar ? 1 : 0) + (cdiVar ? 1 : 0),
        });
    });
    return m;
}

/** Sıralama: not (harf, sonra CDI, sonra sipariş) | cdi | siparis | ad. Eksik CDI/not tahminle (siraOlcusu). */
function sirala(liste, siralama) {
    const l = liste.slice();
    if (siralama === 'ad') return l.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    const o = siraOlcusu(l);
    const A = (k) => o.get(k);
    // Eşitlikte bilgisi tam olan önce
    const gercek = (a, b) => A(b).gercek - A(a).gercek;
    if (siralama === 'siparis') return l.sort((a, b) => b.siparis - a.siparis || A(b).cdi - A(a).cdi);
    if (siralama === 'cdi') return l.sort((a, b) => A(b).cdi - A(a).cdi || A(a).sira - A(b).sira || gercek(a, b) || b.siparis - a.siparis);
    return l.sort((a, b) => A(a).sira - A(b).sira || A(b).cdi - A(a).cdi || gercek(a, b) || b.siparis - a.siparis);
}

function hucreMetni(tanim, v) {
    if (v == null || v === '') return '-';
    if (tanim.bicim === 'sayi') return String(Math.round(v));
    if (tanim.bicim === 'yuzde') return '%' + sayiYaz(v, 1);
    if (tanim.bicim === 'dk') return sayiYaz(v, 1);
    return String(v);
}

function kuryeFoto(p, x, y, boy, buf, ad) {
    const id = 'kf' + Math.random().toString(36).slice(2, 9);
    const img = veriUri(buf);
    if (img) {
        p.push(`<clipPath id="${id}"><circle cx="${x + boy / 2}" cy="${y + boy / 2}" r="${boy / 2}"/></clipPath>`);
        p.push(`<circle cx="${x + boy / 2}" cy="${y + boy / 2}" r="${boy / 2}" fill="${C.cizgiAcik}"/>`);
        p.push(`<image href="${img}" x="${x}" y="${y}" width="${boy}" height="${boy}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`);
        p.push(`<circle cx="${x + boy / 2}" cy="${y + boy / 2}" r="${boy / 2 - 1}" fill="none" stroke="${C.cizgi}" stroke-width="2"/>`);
    } else {
        const bas = String(ad || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((t) => t[0].toLocaleUpperCase('tr')).join('');
        p.push(`<circle cx="${x + boy / 2}" cy="${y + boy / 2}" r="${boy / 2}" fill="${C.morZemin}"/>`);
        p.push(yazi(x + boy / 2, y + boy / 2 + boy * 0.17, bas, { boy: boy * 0.4, aile: 'Manrope', agirlik: 800, renk: C.mor, hiza: 'middle' }));
    }
}

/** Özet kutusunun değeri ve rengi. Ortalamalar sipariş ağırlıklı (Genel CDI dahil); Ort. CDI kurye başına düz ortalama. */
function ozetDegeri(k, kuryeler) {
    const top = (f) => kuryeler.reduce((t, x) => t + (x.d[f] || 0), 0);
    const agirlikli = (f) => {
        const l = kuryeler.filter((x) => x.d[f] != null && x.siparis);
        const pay = l.reduce((t, x) => t + x.siparis, 0);
        return pay ? l.reduce((t, x) => t + x.d[f] * x.siparis, 0) / pay : null;
    };
    if (k === 'toplamSiparis') return [String(kuryeler.reduce((t, x) => t + x.siparis, 0)), C.yazi];
    if (k === 'kurye') return [String(kuryeler.length), C.yazi];
    if (k === 'ortTeslimat') { const v = agirlikli('ortTeslimat'); return [v == null ? '-' : sayiYaz(v, 1) + ' dk', C.yazi]; }
    if (k === 'ortCdi') {
        const l = kuryeler.filter((x) => x.d.cdiPuan != null);
        const v = l.length ? l.reduce((t, x) => t + x.d.cdiPuan, 0) / l.length : null;
        return [v == null ? '-' : '%' + sayiYaz(v, 1), puanRenk(v).renk];
    }
    if (k === 'genelCdi') { const v = agirlikli('cdiPuan'); return [v == null ? '-' : '%' + sayiYaz(v, 1), puanRenk(v).renk]; }
    if (k === 'teslimatPuan' || k === 'donusPuan') { const v = agirlikli(k); return [v == null ? '-' : '%' + sayiYaz(v, 1), puanRenk(v).renk]; }
    if (k === 'app') { const n = kuryeler.filter((x) => String(x.d.harf || '').trim() === 'A++').length; return [String(n), n ? C.yesil : C.yazi]; }
    if (k === 'problemli') { const n = top('problemli'); return [String(n), n ? C.kirmizi : C.yazi]; }
    return [String(top(k)), C.yazi];
}

/**
 * liste: veriDuzelt().kurye ; s: { baslik, siralama, enAzSiparis, foto, sutunlar, bas, son, uyari, fotolar: Map }
 */
function kuryeKarti(liste, s = {}) {
    const sutunlar = sutunlariDuzelt(s.sutunlar).map((k) => SUTUN.get(k));
    const enAz = Number(s.enAzSiparis) || 0;
    const kuryeler = sirala(liste.filter((k) => k.siparis >= Math.max(enAz, 0) && (enAz > 0 || k.siparis > 0 || k.toplamSiparis > 0)), s.siralama);
    const fotolar = s.fotolar || new Map();
    const n = Math.max(kuryeler.length, 1);
    // Çok sütun seçildiyse kart genişler: her sütun en az EN_DAR_KOLON (yatay, tek parça)
    const adG0 = sutunlar.length > 14 ? 380 : 460;
    genislikKur(Math.max(TASARIM, Math.ceil(2 * P + adG0 + sutunlar.length * EN_DAR_KOLON)));

    const p = [''];
    let y = ustBant(p, { etiket: 'KURYE PERFORMANSI · ' + donemAdi(s.bas, s.son).toLocaleUpperCase('tr') + ' CDI', baslik: s.baslik || 'Kurye CDI Tablosu', bas: s.bas, son: s.son });
    if (s.uyari) {
        p.push(`<rect x="${P}" y="${y}" width="${IC}" height="64" rx="18" fill="${C.turuncuZemin}" stroke="#fcd34d"/>`);
        p.push(yazi(P + 28, y + 41, kirp(OLCU.govde, s.uyari, 22, IC - 56), { boy: 22, renk: C.turuncu }));
        y += 64 + 24;
    }

    // Özet şeridi: seçilen kutular seçilen sırayla (en çok 6)
    const ozetler = ozetDuzelt(s.ozet).map((k) => [k, OZETLER.find((o) => o.anahtar === k)]);
    const oG = (IC - (ozetler.length - 1) * 16) / ozetler.length;
    ozetler.forEach(([k, o], i) => {
        const [deger, renk] = ozetDegeri(k, kuryeler);
        const x = P + i * (oG + 16);
        p.push(`<rect x="${x}" y="${y}" width="${oG}" height="104" rx="22" fill="${i === 0 ? C.maviZemin : C.kart}" stroke="${i === 0 ? C.maviCizgi : C.cizgi}"/>`);
        p.push(yazi(x + 24, y + 36, kirp(OLCU.govdeKalin, o.ad.toLocaleUpperCase('tr'), 16, oG - 40), { boy: 16, agirlik: 700, renk: i === 0 ? C.mavi : C.sonuk, aralik: 1.4 }));
        let boy = 38;
        while (boy > 22 && genislik(OLCU.baslik, deger, boy) > oG - 48) boy--;
        p.push(yazi(x + 24, y + 84, deger, { boy, aile: 'Manrope', agirlik: 800, renk }));
    });
    y += 104 + 28;

    // Tablo ölçüleri: sütunlar genişliğe, satırlar kurye sayısına göre
    const ADG = adG0;
    const kG = (IC - ADG) / Math.max(sutunlar.length, 1);
    const SATIR = n > 24 ? 60 : n > 16 ? 68 : 80;
    const BANT = 44;
    const BASLIK = 72;
    const degerBoy = Math.max(18, Math.min(28, Math.floor(kG * 0.3)));
    const baslikBoy = kG < 96 ? 15 : 17;
    const tabloH = BANT + BASLIK + n * SATIR + 12;
    p.push(`<rect x="${P}" y="${y}" width="${IC}" height="${tabloH}" rx="28" fill="${C.kart}" stroke="${C.cizgi}"/>`);

    // Sütun zeminleri (grup rengi) ve üst bant: art arda aynı grup tek bant
    const kumeler = [];
    sutunlar.forEach((t, i) => {
        const son = kumeler[kumeler.length - 1];
        if (son && son.grup === t.grup) son.n++;
        else kumeler.push({ grup: t.grup, bas: i, n: 1 });
    });
    p.push(yazi(P + 32, y + 30, 'KURYE', { boy: 16, agirlik: 700, renk: C.sonuk, aralik: 1.6 }));
    kumeler.forEach((k) => {
        const g = GRUPLAR[k.grup];
        const x = P + ADG + k.bas * kG;
        const w = k.n * kG;
        p.push(`<rect x="${x + 3}" y="${y + BANT}" width="${w - 6}" height="${tabloH - BANT - 10}" rx="14" fill="${g.hucre}"/>`);
        p.push(`<rect x="${x + 3}" y="${y + 8}" width="${w - 6}" height="${BANT - 12}" rx="10" fill="${g.zemin}"/>`);
        const bant = genislik(OLCU.govdeKalin, g.ad, 15) + 20 <= w - 16 ? g.ad : g.kisa;
        p.push(yazi(x + w / 2, y + 30, kirp(OLCU.govdeKalin, bant, 15, w - 16), { boy: 15, agirlik: 700, renk: g.renk, hiza: 'middle', aralik: 1.2 }));
    });
    // Sütun başlıkları (en çok iki satır)
    let ty = y + BANT;
    sutunlar.forEach((t, i) => {
        const cx = P + ADG + i * kG + kG / 2;
        const satirlar = ikiSatir(OLCU.govdeKalin, t.ad, baslikBoy, kG - 12);
        const bas = satirlar.length > 1 ? ty + 30 : ty + 42;
        satirlar.forEach((m, j) => p.push(yazi(cx, bas + j * (baslikBoy + 4), m, { boy: baslikBoy, agirlik: 600, renk: C.orta, hiza: 'middle' })));
    });
    ty += BASLIK;
    p.push(`<rect x="${P + 16}" y="${ty - 2}" width="${IC - 32}" height="2" fill="${C.cizgi}"/>`);

    if (!kuryeler.length) {
        p.push(yazi(W / 2, ty + SATIR / 2 + 9, 'Bu tarihlerde sipariş taşıyan kurye görünmüyor.', { boy: 24, renk: C.sonuk, hiza: 'middle' }));
    }
    const fotoBoy = Math.round(SATIR * 0.66);
    kuryeler.forEach((k, i) => {
        const sy = ty + i * SATIR;
        if (i) p.push(`<rect x="${P + 16}" y="${sy}" width="${IC - 32}" height="1" fill="${C.cizgiAcik}"/>`);
        const orta = sy + SATIR / 2;
        // Sıra rozeti
        const sira = i + 1;
        const sr = SIRA_RENK[sira];
        const rx = P + 24;
        const rBoy = Math.round(SATIR * 0.5);
        if (sr) {
            p.push(`<circle cx="${rx + rBoy / 2}" cy="${orta}" r="${rBoy / 2}" fill="${sr.zemin}" stroke="${sr.cizgi}" stroke-width="2"/>`);
            p.push(yazi(rx + rBoy / 2, orta + rBoy * 0.18, String(sira), { boy: Math.round(rBoy * 0.5), aile: 'Manrope', agirlik: 800, renk: sr.yazi, hiza: 'middle' }));
        } else {
            p.push(yazi(rx + rBoy / 2, orta + rBoy * 0.18, String(sira), { boy: Math.round(rBoy * 0.5), aile: 'Manrope', agirlik: 800, renk: C.soluk, hiza: 'middle' }));
        }
        let ax = rx + rBoy + 18;
        if (s.foto !== false) { kuryeFoto(p, ax, orta - fotoBoy / 2, fotoBoy, fotolar.get(k.id), k.ad); ax += fotoBoy + 16; }
        const adBoy = SATIR >= 80 ? 24 : 21;
        p.push(yazi(ax, orta + adBoy * 0.36, kirp(OLCU.govdeKalin, k.ad, adBoy, P + ADG - 16 - ax), { boy: adBoy, agirlik: 600, renk: C.yazi }));
        // Değerler
        sutunlar.forEach((t, j) => {
            const cx = P + ADG + j * kG + kG / 2;
            const v = k.d[t.anahtar];
            if (t.bicim === 'harf') { harfRozeti(p, cx, orta, v, Math.round(degerBoy * 0.85)); return; }
            let r = { renk: v == null ? C.soluk : C.yazi, agirlik: 600 };
            if (t.renk === 'puan') r = puanRenk(v);
            if (t.renk === 'problem') r = v == null ? { renk: C.soluk, agirlik: 400 } : v > 0 ? { renk: C.kirmizi, agirlik: 800 } : { renk: C.yesil, agirlik: 700 };
            const metin = hucreMetni(t, v);
            // Sığmazsa kesilmez, küçülür
            let boy = degerBoy;
            while (boy > 14 && genislik(OLCU.baslik, metin, boy) > kG - 14) boy--;
            p.push(yazi(cx, orta + boy * 0.36, metin, { boy, aile: 'Manrope', agirlik: r.agirlik, renk: r.renk, hiza: 'middle' }));
        });
    });

    const H = y + tabloH + 40 + 72 + 24;
    p[0] = `<rect width="${W}" height="${H}" fill="${C.zemin}"/>`;
    const siraAd = { not: 'CDI notu', cdi: 'CDI puanı', siparis: 'sipariş sayısı', ad: 'ad' }[s.siralama] || 'CDI notu';
    altBant(p, H, 'Jet Barkod · Kurye CDI', 'Sıralama: ' + siraAd + (enAz > 1 ? ' · en az ' + enAz + ' sipariş' : '') + ' · jetbarkod.com.tr');
    return svgPng(p, H);
}

/** Kurye fotoğrafları: yalnız bellekte, özgün boyutuyla (keskin kalsın); diske yazılmaz */
async function kuryeFotolari(liste, butceMs = 8000) {
    const sonuc = new Map();
    const bitis = Date.now() + butceMs;
    const kuyruk = liste.filter((k) => k.foto).slice(0, 80);
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
                if (!b.length || b.length > 1536 * 1024) continue;
                if (!((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50))) continue;
                sonuc.set(k.id, b);
            } catch (e) { /* fotoğrafsız */ } finally { clearTimeout(t); }
        }
    }
    await Promise.all(Array.from({ length: Math.min(4, kuyruk.length) }, isci));
    return sonuc;
}

module.exports = { dpsKarti, kuryeKarti, kuryeFotolari, tarihAraligi, donemAdi, ondalik };
