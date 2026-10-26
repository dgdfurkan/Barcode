/**
 * Satıştan kaldırma ve itiraz raporları: DPS / Kurye CDI görünümünde yatay kartlar
 * ============================================================================
 *
 * Tasarım 1920 birim, çıktı 3840 px (performans/kart.js ile aynı üst bant,
 * özet şeridi ve alt bant). Her kayıt bir satır kartı; satırlar sığmazsa
 * yeni sayfa (albümde ayrı kart). Özet şeridi yalnız ilk sayfada.
 *
 *   kaldirmaKartlari  Reddedilen / iptal / onay bekleyen / tamamlanan:
 *                     ürün, adet, sebep ve red gerekçesi, durum, zaman,
 *                     hasar fotoğrafları.
 *   itirazKartlari    İtiraz bekleyenler ve sonuçlananlar: ürün, şikâyet,
 *                     müşteri notu ya da gönderilen metin, kalan süre,
 *                     siparişin içeriği (şikâyet edilen ürün işaretli),
 *                     kurye ve toplayıcı.
 *
 * Görseller (ürün, hasar, kişi) yalnız çizim için bellekte gelir.
 * ============================================================================
 */
'use strict';

const { araclar } = require('../kaldirma/kart');
const { yatay } = require('../performans/kart');

const { genislik, kirp, ikiSatir, yazi, veriUri, adetYaz, OLCU } = araclar;
const { C, P, TASARIM, genislikKur, svgPng, ustBant, altBant, kuryeFoto } = yatay;

const W = TASARIM;
const IC = W - 2 * P;
const AZAMI_H = 2400;     // tasarım birimi; çıktı 4800 px (Telegram sınırının altında)
const ARA = 12;           // satır kartları arası

let kirpNo = 0;

/** En çok n satıra böler; sonuncusu sığmazsa kırpılır */
function satirlar(font, metin, boy, azami, n) {
    const kelime = String(metin || '').split(/\s+/).filter(Boolean);
    const l = [];
    let i = 0;
    while (i < kelime.length && l.length < n) {
        let s = '';
        while (i < kelime.length && genislik(font, s ? s + ' ' + kelime[i] : kelime[i], boy) <= azami) { s = s ? s + ' ' + kelime[i] : kelime[i]; i++; }
        if (!s) { s = kirp(font, kelime[i], boy, azami); i++; }
        l.push(s);
    }
    if (i < kelime.length && l.length) l[l.length - 1] = kirp(font, l[l.length - 1] + ' ' + kelime.slice(i).join(' '), boy, azami);
    return l;
}

function cip(p, x, y, metin, renk, zemin, boy = 18) {
    const w = genislik(OLCU.govdeKalin, metin, boy) + 28;
    const h = boy + 16;
    p.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${zemin}"/>`);
    p.push(yazi(x + w / 2, Math.round(y + h / 2 + boy * 0.36), metin, { boy, agirlik: 600, renk, hiza: 'middle' }));
    return w;
}

function gorselKutu(p, x, y, boy, buf, { doldur = false, rx = 18, cizgi = C.cizgi, kalin = 1 } = {}) {
    const id = 'yk' + (kirpNo++);
    const img = veriUri(buf);
    p.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${boy}" height="${boy}" rx="${rx}"/></clipPath>`);
    if (img && doldur) {
        p.push(`<image href="${img}" x="${x}" y="${y}" width="${boy}" height="${boy}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`);
    } else {
        p.push(`<rect x="${x}" y="${y}" width="${boy}" height="${boy}" rx="${rx}" fill="${img ? '#ffffff' : C.zemin}"/>`);
        if (img) {
            const ic = Math.round(boy * 0.08);
            p.push(`<image href="${img}" x="${x + ic}" y="${y + ic}" width="${boy - 2 * ic}" height="${boy - 2 * ic}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/>`);
        }
    }
    p.push(`<rect x="${x}" y="${y}" width="${boy}" height="${boy}" rx="${rx}" fill="none" stroke="${cizgi}" stroke-width="${kalin}"/>`);
}

function tarihSaat(iso, ayir) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return ayir ? ['', ''] : '';
    const d = new Date(t);
    const gun = d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' });
    const saat = d.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    return ayir ? [gun, saat] : gun + ' ' + saat;
}

/** "5 sa 20 dk kaldı", "40 dk kaldı", "1 gün 3 sa kaldı" */
function kalanYazi(iso) {
    const ms = Date.parse(iso) - Date.now();
    if (!Number.isFinite(ms)) return '';
    if (ms <= 0) return 'Süre doldu';
    const dk = Math.floor(ms / 60000);
    const gun = Math.floor(dk / 1440);
    const sa = Math.floor((dk % 1440) / 60);
    if (gun) return gun + ' gün ' + (sa ? sa + ' sa ' : '') + 'kaldı';
    if (sa) return sa + ' sa ' + (dk % 60 ? (dk % 60) + ' dk ' : '') + 'kaldı';
    return Math.max(1, dk) + ' dk kaldı';
}

/** Özet şeridi: [{ ad, deger, renk?, vurgu? }] (en çok 6) */
function ozetSeridi(p, y, kutular) {
    const n = kutular.length;
    const oG = (IC - (n - 1) * 16) / n;
    kutular.forEach((k, i) => {
        const x = P + i * (oG + 16);
        p.push(`<rect x="${x}" y="${y}" width="${oG}" height="112" rx="22" fill="${k.vurgu ? C.maviZemin : C.kart}" stroke="${k.vurgu ? C.maviCizgi : C.cizgi}"/>`);
        p.push(yazi(x + 24, y + 38, kirp(OLCU.govdeKalin, k.ad, 16, oG - 40), { boy: 16, agirlik: 700, renk: k.vurgu ? C.mavi : C.sonuk, aralik: 1.4 }));
        const d = String(k.deger);
        let boy = 44;
        while (boy > 22 && genislik(OLCU.baslik, d, boy) > oG - 48) boy--;
        p.push(yazi(x + 24, y + 92, d, { boy, aile: 'Manrope', agirlik: 800, renk: k.renk || C.yazi }));
    });
    return y + 112 + 32;
}

/** Bölüm bandı: renkli başlık ve sayı; ardından sütun adları (varsa) */
function bolumBandi(p, y, metin, sayi, renk, zemin, kolonlar) {
    const w = genislik(OLCU.govdeKalin, metin, 17) + 40;
    p.push(`<rect x="${P}" y="${y}" width="${w}" height="40" rx="12" fill="${zemin}"/>`);
    p.push(yazi(P + w / 2, y + 27, metin, { boy: 17, agirlik: 700, renk, hiza: 'middle', aralik: 1.4 }));
    p.push(yazi(P + w + 16, y + 29, String(sayi), { boy: 24, aile: 'Manrope', agirlik: 800, renk }));
    let ys = y + 40 + 14;
    if (kolonlar && kolonlar.length) {
        kolonlar.forEach(([ad, x, hiza]) => p.push(yazi(x, ys + 16, ad, { boy: 15, agirlik: 700, renk: C.soluk, aralik: 1.4, hiza: hiza || 'start' })));
        ys += 30;
    }
    return ys;
}

/**
 * Sayfalar: ogeler [{ h, ciz(p, y), baslik?: true }] art arda; sığmayınca yeni kart.
 * ust(p, ilk) → içeriğin başladığı y. Bölüm başlığı sayfanın son ögesi olmaz.
 */
function sayfala(ogeler, ust, altSol, altSag) {
    const sayfalar = [];
    let p = null;
    let y = 0;
    const yeni = (ilk) => { p = ['']; y = ust(p, ilk); };
    const bitir = () => { sayfalar.push({ p, H: y + 16 + 72 + 24 }); };
    yeni(true);
    ogeler.forEach((o, i) => {
        const sonraki = ogeler[i + 1];
        const gerek = o.baslik && sonraki ? o.h + sonraki.h : o.h;
        if (y + gerek + 112 > AZAMI_H && !o.ilkSatir) { bitir(); yeni(false); }
        o.ciz(p, y);
        y += o.h;
    });
    bitir();
    genislikKur(TASARIM);
    return sayfalar.map((s, i) => {
        s.p[0] = `<rect width="${W}" height="${s.H}" fill="${C.zemin}"/>`;
        altBant(s.p, s.H, altSol, (sayfalar.length > 1 ? (i + 1) + ' / ' + sayfalar.length + ' · ' : '') + altSag);
        return svgPng(s.p, s.H);
    });
}

// ---------------------------------------------------------------------
// Satıştan kaldırma
// ---------------------------------------------------------------------

const KALDIRMA_GRUP = {
    red: { ad: 'REDDEDİLEN VE İPTAL EDİLEN', renk: C.kirmizi, zemin: '#ffe4e6' },
    bekleyen: { ad: 'ONAY BEKLEYEN', renk: C.turuncu, zemin: '#fef3c7' },
    tamam: { ad: 'TAMAMLANAN', renk: C.yesil, zemin: '#d1fae5' },
};

/**
 * v: { red, bekleyen, tamam } her biri [{ urun:{id,ad}, adet, sebep, altNeden, red:{baslik,aciklama},
 *      durum, yeniden, zaman, fotolar:[Buffer] }]
 * s: { baslik, etiket, tarih, alt, gorseller: Map, gruplar: { red, bekleyen, tamam } (gösterilen gruplar),
 *      altSag }
 *
 * Hasar fotoğrafı varsa tablo (sütun başlıklı, tam genişlik satırlar); yoksa
 * kayıtlar iki sütunlu kartlar: fotoğraf sütununun yeri boş kalmaz.
 */
function kaldirmaKartlari(v, s = {}) {
    genislikKur(TASARIM);
    const g = s.gruplar || { red: true, bekleyen: true, tamam: true };
    const gorseller = s.gorseller || new Map();
    const tum = [].concat(v.red || [], v.bekleyen || [], v.tamam || []);
    const fotolu = tum.some((k) => Array.isArray(k.fotolar) && k.fotolar.length);

    // Sütunlar (satır kartının sol kenarına göre)
    const ekG = fotolu ? 0 : 290;
    const K = { gorsel: 20, ad: 136, adG: 420 + Math.round(ekG * 0.45) };
    K.adet = K.ad + K.adG + 20; K.adetG = 100;
    K.sebep = K.adet + K.adetG + 20; K.sebepG = 420 + Math.round(ekG * 0.55);
    K.durum = K.sebep + K.sebepG + 20; K.durumG = 170;
    K.zaman = K.durum + K.durumG + 20; K.zamanG = 140;
    K.foto = K.zaman + K.zamanG + 20;
    const SATIR = 136;
    const FOTO = 88;

    const satir = (k) => ({
        h: SATIR + ARA,
        ciz: (p, y) => {
            const x = P;
            const durumYazi = k.tamam ? 'Tamamlandı' : k.bekliyor ? 'Onay Bekliyor' : k.yeniden ? 'Yeniden Girildi' : k.durum === 700 ? 'İptal Edildi' : 'Reddedildi';
            const renk = k.tamam ? C.yesil : k.bekliyor ? C.turuncu : k.yeniden ? C.sonuk : C.kirmizi;
            const zemin = k.tamam ? C.yesilZemin : k.bekliyor ? C.turuncuZemin : k.yeniden ? C.cizgiAcik : C.kirmiziZemin;
            p.push(`<rect x="${x}" y="${y}" width="${IC}" height="${SATIR}" rx="22" fill="${C.kart}" stroke="${C.cizgi}"/>`);
            p.push(`<rect x="${x}" y="${y + 24}" width="6" height="${SATIR - 48}" rx="3" fill="${renk}"/>`);
            gorselKutu(p, x + K.gorsel, y + 20, 96, gorseller.get(k.urun && k.urun.id));
            const ad = ikiSatir(OLCU.govdeKalin, (k.urun && k.urun.ad) || 'Ürün', 24, K.adG);
            const adY = ad.length > 1 ? y + 56 : y + 76;
            ad.forEach((t, j) => p.push(yazi(x + K.ad, adY + j * 32, t, { boy: 24, agirlik: 600, renk: C.yazi })));
            p.push(yazi(x + K.adet + K.adetG / 2, y + 80, '×' + adetYaz(Number(k.adet) || 0), { boy: 34, aile: 'Manrope', agirlik: 800, renk: C.yazi, hiza: 'middle' }));
            // Sebep ve (varsa) red gerekçesi
            const redli = k.red && (k.red.baslik || k.red.aciklama);
            const alt = redli ? [[k.red.baslik || 'Red sebebi', 20, 600, C.kirmizi], [k.red.aciklama, 18, 400, C.orta]]
                : [[k.altNeden, 19, 400, C.sonuk]];
            const parca = [[k.sebep || 'Sebep yok', 22, 600, C.yazi]].concat(alt).filter((t) => t[0]);
            const toplamH = parca.reduce((t, q) => t + q[1] + 10, -10);
            let sy = y + SATIR / 2 - toplamH / 2;
            parca.forEach(([m, boy, agirlik, r]) => {
                sy += boy;
                p.push(yazi(x + K.sebep, sy - 4, kirp(agirlik > 400 ? OLCU.govdeKalin : OLCU.govde, m, boy, K.sebepG), { boy, agirlik, renk: r }));
                sy += 10;
            });
            const dG = genislik(OLCU.govdeKalin, durumYazi, 18) + 28;
            cip(p, x + K.durum + Math.max(0, (K.durumG - dG) / 2), y + SATIR / 2 - 17, durumYazi, renk, zemin, 18);
            const [gun, saat] = tarihSaat(k.zaman, true);
            p.push(yazi(x + K.zaman, y + 62, gun, { boy: 20, agirlik: 600, renk: C.orta }));
            p.push(yazi(x + K.zaman, y + 92, saat, { boy: 20, renk: C.sonuk }));
            (k.fotolar || []).slice(0, 3).forEach((f, j) => gorselKutu(p, x + K.foto + j * (FOTO + 11), y + 24, FOTO, f, { doldur: true, rx: 14 }));
        },
    });

    /** İki sütunlu kart (fotoğraf yokken): ürün, sebep ve gerekçe solda; adet, durum, zaman sağda */
    const KART_G = (IC - 20) / 2;
    function kartCiz(p, x, y, k) {
        const durumYazi = k.tamam ? 'Tamamlandı' : k.bekliyor ? 'Onay Bekliyor' : k.yeniden ? 'Yeniden Girildi' : k.durum === 700 ? 'İptal Edildi' : 'Reddedildi';
        const renk = k.tamam ? C.yesil : k.bekliyor ? C.turuncu : k.yeniden ? C.sonuk : C.kirmizi;
        const zemin = k.tamam ? C.yesilZemin : k.bekliyor ? C.turuncuZemin : k.yeniden ? C.cizgiAcik : C.kirmiziZemin;
        const H = 152;
        p.push(`<rect x="${x}" y="${y}" width="${KART_G}" height="${H}" rx="22" fill="${C.kart}" stroke="${C.cizgi}"/>`);
        p.push(`<rect x="${x}" y="${y + 24}" width="6" height="${H - 48}" rx="3" fill="${renk}"/>`);
        gorselKutu(p, x + 20, y + 20, 112, gorseller.get(k.urun && k.urun.id));
        const sagG = 200;
        const mx = x + 152;
        const mG = KART_G - 152 - 24 - sagG - 12;
        p.push(yazi(mx, y + 46, kirp(OLCU.govdeKalin, (k.urun && k.urun.ad) || 'Ürün', 23, mG), { boy: 23, agirlik: 600, renk: C.yazi }));
        p.push(yazi(mx, y + 82, kirp(OLCU.govdeKalin, k.sebep || 'Sebep yok', 20, mG), { boy: 20, agirlik: 600, renk: C.orta }));
        const redli = k.red && (k.red.baslik || k.red.aciklama);
        if (redli) {
            p.push(yazi(mx, y + 112, kirp(OLCU.govdeKalin, k.red.baslik || 'Red sebebi', 18, mG), { boy: 18, agirlik: 600, renk: C.kirmizi }));
            if (k.red.aciklama) p.push(yazi(mx, y + 136, kirp(OLCU.govde, k.red.aciklama, 17, mG), { boy: 17, renk: C.orta }));
        } else if (k.altNeden) {
            p.push(yazi(mx, y + 112, kirp(OLCU.govde, k.altNeden, 18, mG), { boy: 18, renk: C.sonuk }));
        }
        const sx = x + KART_G - 24;
        p.push(yazi(sx, y + 54, '×' + adetYaz(Number(k.adet) || 0), { boy: 34, aile: 'Manrope', agirlik: 800, renk: C.yazi, hiza: 'end' }));
        const dG = genislik(OLCU.govdeKalin, durumYazi, 17) + 28;
        cip(p, sx - dG, y + 70, durumYazi, renk, zemin, 17);
        p.push(yazi(sx, y + 132, tarihSaat(k.zaman), { boy: 18, renk: C.sonuk, hiza: 'end' }));
    }

    const kolonlar = [['ÜRÜN', P + K.ad], ['ADET', P + K.adet + K.adetG / 2, 'middle'], ['SEBEP', P + K.sebep], ['DURUM', P + K.durum + K.durumG / 2, 'middle'], ['ZAMAN', P + K.zaman]];
    if (fotolu) kolonlar.push(['HASAR FOTOĞRAFLARI', P + K.foto]);
    const ogeler = [];
    ['red', 'bekleyen', 'tamam'].forEach((ad) => {
        const l = v[ad] || [];
        if (!g[ad] || !l.length) return;
        const G = KALDIRMA_GRUP[ad];
        if (fotolu) {
            ogeler.push({ baslik: true, h: 40 + 14 + 30 + 4, ciz: (p, y) => bolumBandi(p, y, G.ad, l.length, G.renk, G.zemin, kolonlar) });
            l.forEach((k) => ogeler.push(satir(k)));
        } else {
            ogeler.push({ baslik: true, h: 40 + 14 + 4, ciz: (p, y) => bolumBandi(p, y, G.ad, l.length, G.renk, G.zemin) });
            for (let i = 0; i < l.length; i += 2) {
                const ikili = l.slice(i, i + 2);
                ogeler.push({ h: 152 + ARA + 8, ciz: (p, y) => ikili.forEach((k, j) => kartCiz(p, P + j * (KART_G + 20), y, k)) });
            }
        }
        ogeler.push({ h: 20, ciz: () => {} });
    });

    const red = (v.red || []).filter((k) => !k.yeniden);
    const kutular = [];
    if (g.red) {
        const r = red.filter((k) => k.durum !== 700).length;
        const ip = red.filter((k) => k.durum === 700).length;
        kutular.push({ ad: 'REDDEDİLEN', deger: r, renk: r ? C.kirmizi : C.yazi });
        kutular.push({ ad: 'İPTAL EDİLEN', deger: ip, renk: ip ? C.kirmizi : C.yazi });
    }
    if (g.bekleyen) kutular.push({ ad: 'ONAY BEKLEYEN', deger: (v.bekleyen || []).length, renk: (v.bekleyen || []).length ? C.turuncu : C.yazi });
    if (g.tamam) kutular.push({ ad: 'TAMAMLANAN', deger: (v.tamam || []).length, renk: (v.tamam || []).length ? C.yesil : C.yazi });
    kutular.push({ ad: 'TOPLAM ADET', deger: adetYaz(tum.reduce((t, k) => t + (Number(k.adet) || 0), 0)), vurgu: true });

    const ust = (p, ilk) => {
        let y = ustBant(p, { etiket: s.etiket || 'SATIŞTAN KALDIRMA RAPORU', baslik: (s.baslik || 'Satıştan Kaldırma') + (ilk ? '' : ' (devam)'), tarih: s.tarih, alt: s.alt });
        if (ilk) y = ozetSeridi(p, y, kutular);
        return y;
    };
    return sayfala(ogeler, ust, 'Jet Barkod · Satıştan Kaldırma', s.altSag || 'jetbarkod.com.tr');
}

// ---------------------------------------------------------------------
// İtirazlar
// ---------------------------------------------------------------------

/**
 * bekleyen: [{ id, urun, gorselId, sikayet, musteriNotu, sonTarih, taslak, siparis }]
 * sonuc:    [{ id, urun, gorselId, sikayet, durum: 300|400, itirazMetni, zaman, siparis }]
 * siparis:  { urunler:[{ad, adet, id}], kalem, adet, teslimDk, tarih, kurye:{ad}, toplayici:{ad} } | null
 * s: { not, metin, siparis, kurye, toplayici, gorseller: Map (ürün id → Buffer),
 *      kisiFoto: Map (kayıt id + ':k' / ':t' → Buffer), baslik, etiket, tarih, alt, sonucBaslik, altSag }
 *
 * Yerleşim içeriğe göre: bir bölüm ancak hem açık hem en az bir kayıtta doluysa
 * yer kaplar. Sipariş varsa her kayıt tam genişlikte bir satır (ürün, metin,
 * sipariş, kişiler, süre); yoksa kayıtlar iki sütunlu kartlar, kişiler kartın
 * altında ince bir şerit. Böylece kapatılan ya da boş gelen bölümün yeri boş kalmaz.
 */
function itirazKartlari(bekleyen, sonuc, s = {}) {
    genislikKur(TASARIM);
    const gorseller = s.gorseller || new Map();
    const kisiFoto = s.kisiFoto || new Map();
    const tum = bekleyen.concat(sonuc);
    const kisiAd = (k, t) => (k.siparis && k.siparis[t] && k.siparis[t].ad) || '';
    const siparisVar = s.siparis !== false && tum.some((k) => k.siparis && Array.isArray(k.siparis.urunler) && k.siparis.urunler.length);
    const kisiTurleri = [
        s.kurye !== false && tum.some((k) => kisiAd(k, 'kurye')) && ['KURYE', 'kurye', ':k'],
        s.toplayici !== false && tum.some((k) => kisiAd(k, 'toplayici')) && ['TOPLAYICI', 'toplayici', ':t'],
    ].filter(Boolean);
    const genis = siparisVar;

    const SATIR = 208;
    const GB = 120;
    const SAG_G = 176;
    const SIP_G = 568;
    const KISI_G = 300;
    // Geniş satırın sütunları (satırın sol kenarına göre)
    const K = { gorsel: 24, metin: 24 + GB + 24 };
    K.sag = IC - 24 - SAG_G;
    K.kisi = K.sag - 24 - KISI_G;
    K.siparis = (kisiTurleri.length ? K.kisi : K.sag) - 28 - SIP_G;
    K.metinG = K.siparis - 28 - K.metin;
    // İki sütunlu kart
    const KART_G = (IC - 20) / 2;
    const SERIT = kisiTurleri.length ? 76 : 0;

    const sadeAd = (x) => String(x || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
    const hedefMi = (k, u) => {
        if (k.gorselId && u.id && k.gorselId === u.id) return true;
        const a = sadeAd(u.ad);
        const b = sadeAd(k.urun);
        return a === b || (a.length > 8 && b.length > 8 && (a.indexOf(b) === 0 || b.indexOf(a) === 0));
    };

    /** Ad, çipler, müşteri notu ya da gönderilen metin */
    function metinCiz(p, mx, y, w, k, sonucMu) {
        const kabul = k.durum === 300;
        p.push(yazi(mx, y + 52, kirp(OLCU.govdeKalin, k.urun || 'Ürün', 25, w), { boy: 25, agirlik: 600, renk: C.yazi }));
        let cx = mx;
        if (sonucMu) cx += cip(p, cx, y + 70, kabul ? 'Kabul Edildi' : 'Reddedildi', kabul ? C.yesil : C.kirmizi, kabul ? C.yesilZemin : C.kirmiziZemin, 17) + 10;
        cx += cip(p, cx, y + 70, k.sikayet || 'Kayıt', C.orta, C.cizgiAcik, 17) + 10;
        if (!sonucMu && k.taslak) cip(p, cx, y + 70, 'Taslak Hazır', C.mavi, C.maviZemin, 17);
        if (sonucMu && s.metin !== false && k.itirazMetni) {
            satirlar(OLCU.govde, k.itirazMetni, 19, w, 3).forEach((t, j) => p.push(yazi(mx, y + 136 + j * 27, t, { boy: 19, renk: C.orta })));
        } else if (!sonucMu && s.not !== false) {
            const not = k.musteriNotu ? '"' + k.musteriNotu + '"' : 'Müşteri not bırakmamış';
            satirlar(OLCU.govde, not, 20, w, 2).forEach((t, j) => p.push(yazi(mx, y + 140 + j * 28, t, { boy: 20, renk: k.musteriNotu ? C.orta : C.soluk })));
        }
    }

    /** Sağ sütun: kalan süre çipi ve son tarih, ya da sonuç tarihi (sx: sağ kenar) */
    function sagCiz(p, sx, y, k, sonucMu) {
        let etiket = 'SON TARİH';
        let zaman = k.sonTarih;
        if (!sonucMu) {
            const acil = (Date.parse(k.sonTarih) - Date.now()) / 3600000 < 12;
            const m = kalanYazi(k.sonTarih);
            const w = genislik(OLCU.govdeKalin, m, 18) + 28;
            cip(p, sx - w, y + 28, m, acil ? C.kirmizi : C.turuncu, acil ? C.kirmiziZemin : C.turuncuZemin, 18);
        } else {
            etiket = 'SONUÇ';
            zaman = k.zaman;
        }
        if (!zaman) return;
        const [gun, saat] = tarihSaat(zaman, true);
        p.push(yazi(sx, y + 112, etiket, { boy: 14, agirlik: 700, renk: C.soluk, aralik: 1.4, hiza: 'end' }));
        p.push(yazi(sx, y + 142, gun, { boy: 20, agirlik: 600, renk: C.orta, hiza: 'end' }));
        p.push(yazi(sx, y + 170, saat, { boy: 20, renk: C.sonuk, hiza: 'end' }));
    }

    function siparisCiz(p, x, y, k) {
        const sp = k.siparis;
        p.push(yazi(x, y + 44, 'SİPARİŞ', { boy: 15, agirlik: 700, renk: C.soluk, aralik: 1.4 }));
        if (!sp || !Array.isArray(sp.urunler) || !sp.urunler.length) {
            p.push(yazi(x, y + 84, 'Bu kaydın siparişi okunamadı', { boy: 19, renk: C.soluk }));
            return;
        }
        const bilgi = [sp.kalem + ' ürün', sp.adet + ' adet', sp.teslimDk ? sp.teslimDk + ' dk teslim' : ''].filter(Boolean).join(' · ');
        p.push(yazi(x + genislik(OLCU.govdeKalin, 'SİPARİŞ', 15) + 22, y + 44, bilgi, { boy: 18, agirlik: 600, renk: C.orta }));
        const sirali = sp.urunler.slice().sort((a, b) => hedefMi(k, b) - hedefMi(k, a));
        const KB = 68;
        const ara = 10;
        const sig = Math.floor((SIP_G + ara) / (KB + ara));
        const goster = sirali.length > sig ? sirali.slice(0, sig - 1) : sirali;
        goster.forEach((u, j) => {
            const ux = x + j * (KB + ara);
            const hedef = hedefMi(k, u);
            gorselKutu(p, ux, y + 64, KB, gorseller.get(u.id), { rx: 14, cizgi: hedef ? C.kirmizi : C.cizgi, kalin: hedef ? 3 : 1 });
            if (u.adet > 1) {
                const m = '×' + u.adet;
                const mw = genislik(OLCU.baslik, m, 14) + 12;
                p.push(`<rect x="${ux + KB - mw - 4}" y="${y + 64 + KB - 26}" width="${mw}" height="22" rx="11" fill="#111827"/>`);
                p.push(yazi(ux + KB - 4 - mw / 2, y + 64 + KB - 10, m, { boy: 14, aile: 'Manrope', agirlik: 800, renk: '#ffffff', hiza: 'middle' }));
            }
        });
        if (sirali.length > goster.length) {
            const ux = x + goster.length * (KB + ara);
            p.push(`<rect x="${ux}" y="${y + 64}" width="${KB}" height="${KB}" rx="14" fill="${C.cizgiAcik}"/>`);
            p.push(yazi(ux + KB / 2, y + 64 + KB / 2 + 7, '+' + (sirali.length - goster.length), { boy: 20, aile: 'Manrope', agirlik: 800, renk: C.sonuk, hiza: 'middle' }));
        }
        const hedef = sirali.find((u) => hedefMi(k, u));
        const alt = hedef ? 'Şikâyet edilen ürün siparişte: ' + hedef.adet + ' adet' : 'Şikâyet edilen ürün listede eşleşmedi';
        const tarih = sp.tarih ? tarihSaat(sp.tarih) + ' · ' : '';
        p.push(yazi(x, y + 172, kirp(OLCU.govde, tarih + alt, 18, SIP_G), { boy: 18, renk: hedef ? C.orta : C.sonuk }));
    }

    /** Bir kişi: fotoğraf (yoksa baş harfler), etiket, ad */
    function kisiBlok(p, x, y, foto, etiket, ad, w, boy) {
        kuryeFoto(p, x, y, boy, foto, ad || '?');
        p.push(yazi(x + boy + 14, y + boy / 2 - 6, etiket, { boy: 13, agirlik: 700, renk: C.soluk, aralik: 1.4 }));
        p.push(yazi(x + boy + 14, y + boy / 2 + 22, kirp(OLCU.govdeKalin, ad || 'Bilgi yok', 20, w - boy - 14), { boy: 20, agirlik: 600, renk: ad ? C.yazi : C.soluk }));
    }

    /** Geniş satır: sipariş olduğunda */
    const satir = (k, sonucMu) => ({
        h: SATIR + ARA,
        ciz: (p, y) => {
            const x = P;
            const vurgu = sonucMu ? (k.durum === 300 ? C.yesil : C.kirmizi) : C.turuncu;
            p.push(`<rect x="${x}" y="${y}" width="${IC}" height="${SATIR}" rx="24" fill="${C.kart}" stroke="${C.cizgi}"/>`);
            p.push(`<rect x="${x}" y="${y + 28}" width="6" height="${SATIR - 56}" rx="3" fill="${vurgu}"/>`);
            gorselKutu(p, x + K.gorsel, y + 28, GB, gorseller.get(k.gorselId));
            metinCiz(p, x + K.metin, y, K.metinG, k, sonucMu);
            p.push(`<rect x="${x + K.siparis - 14}" y="${y + 28}" width="1.5" height="${SATIR - 56}" fill="${C.cizgiAcik}"/>`);
            siparisCiz(p, x + K.siparis, y, k);
            if (kisiTurleri.length) {
                p.push(`<rect x="${x + K.kisi - 14}" y="${y + 28}" width="1.5" height="${SATIR - 56}" fill="${C.cizgiAcik}"/>`);
                const blokH = 72;
                const bas = y + SATIR / 2 - (kisiTurleri.length * blokH + (kisiTurleri.length - 1) * 12) / 2;
                kisiTurleri.forEach(([etiket, alan, ek], i) => kisiBlok(p, x + K.kisi, bas + i * (blokH + 12) + 8, kisiFoto.get(k.id + ek), etiket, kisiAd(k, alan), KISI_G, 56));
            }
            sagCiz(p, x + K.sag + SAG_G, y, k, sonucMu);
        },
    });

    /** İki sütunlu kart: sipariş yokken */
    function kartCiz(p, x, y, k, sonucMu) {
        const H = SATIR + SERIT;
        const vurgu = sonucMu ? (k.durum === 300 ? C.yesil : C.kirmizi) : C.turuncu;
        p.push(`<rect x="${x}" y="${y}" width="${KART_G}" height="${H}" rx="24" fill="${C.kart}" stroke="${C.cizgi}"/>`);
        p.push(`<rect x="${x}" y="${y + 28}" width="6" height="${SATIR - 56}" rx="3" fill="${vurgu}"/>`);
        gorselKutu(p, x + 24, y + 28, 112, gorseller.get(k.gorselId));
        metinCiz(p, x + 160, y, KART_G - 160 - 24 - SAG_G - 16, k, sonucMu);
        sagCiz(p, x + KART_G - 24, y, k, sonucMu);
        if (SERIT) {
            const sy = y + SATIR;
            p.push(`<rect x="${x + 24}" y="${sy - 4}" width="${KART_G - 48}" height="1.5" fill="${C.cizgiAcik}"/>`);
            const bG = (KART_G - 48) / kisiTurleri.length;
            kisiTurleri.forEach(([etiket, alan, ek], i) => kisiBlok(p, x + 24 + i * bG, sy + 12, kisiFoto.get(k.id + ek), etiket, kisiAd(k, alan), bG - 16, 48));
        }
    }

    const ogeler = [];
    const bolum = (liste, sonucMu, baslik, renk, zemin) => {
        if (!liste.length) return;
        ogeler.push({ baslik: true, h: 40 + 14 + 4, ciz: (p, y) => bolumBandi(p, y, baslik, liste.length, renk, zemin) });
        if (genis) liste.forEach((k) => ogeler.push(satir(k, sonucMu)));
        else {
            for (let i = 0; i < liste.length; i += 2) {
                const ikili = liste.slice(i, i + 2);
                ogeler.push({ h: SATIR + SERIT + ARA + 8, ciz: (p, y) => ikili.forEach((k, j) => kartCiz(p, P + j * (KART_G + 20), y, k, sonucMu)) });
            }
        }
        ogeler.push({ h: 20, ciz: () => {} });
    };
    bolum(bekleyen, false, 'İTİRAZ BEKLEYEN', C.turuncu, '#fef3c7');
    bolum(sonuc, true, s.sonucBaslik || 'SONUÇLANAN', C.mor, '#ede9fe');

    const acil = bekleyen.filter((k) => (Date.parse(k.sonTarih) - Date.now()) / 3600000 < 12).length;
    const kabul = sonuc.filter((k) => k.durum === 300).length;
    const kutular = [
        { ad: 'İTİRAZ BEKLEYEN', deger: bekleyen.length, renk: bekleyen.length ? C.turuncu : C.yazi, vurgu: true },
        { ad: '12 SAATTEN AZ KALAN', deger: acil, renk: acil ? C.kirmizi : C.yazi },
        { ad: 'TASLAĞI HAZIR', deger: bekleyen.filter((k) => k.taslak).length },
    ];
    if (s.sonucAcik !== false) {
        kutular.push({ ad: 'KABUL EDİLEN', deger: kabul, renk: kabul ? C.yesil : C.yazi });
        kutular.push({ ad: 'REDDEDİLEN', deger: sonuc.length - kabul, renk: sonuc.length - kabul ? C.kirmizi : C.yazi });
    }

    const ust = (p, ilk) => {
        let y = ustBant(p, { etiket: s.etiket || 'İTİRAZ RAPORU · DEPO DEĞERLENDİRME', baslik: (s.baslik || 'İtirazlar') + (ilk ? '' : ' (devam)'), tarih: s.tarih, alt: s.alt });
        if (ilk) y = ozetSeridi(p, y, kutular);
        return y;
    };
    return sayfala(ogeler, ust, 'Jet Barkod · İtirazlar', s.altSag || 'jetbarkod.com.tr');
}

module.exports = { kaldirmaKartlari, itirazKartlari, kalanYazi };
