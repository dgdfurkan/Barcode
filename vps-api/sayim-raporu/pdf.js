/**
 * Sayım raporu: A4 PDF
 *
 * İlk sayfa özet: tablo adı, sayım ilerlemesi, eksik / fazla / net fark
 * kartları ve değer satırı. Altında ayrıntı: eksik ürünler, fazla ürünler,
 * sayılmayan ürünler. Belge en fazla 4 sayfa; sığmayan satırlar
 * "ve N ürün daha" satırına toplanıyor, toplam TL etkisi kaybolmuyor.
 *
 * Fontlar ve logo modül klasöründe; ağdan hiçbir şey indirilmiyor.
 */
'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');

const KLASOR = __dirname;
const FONT = {
    govde: path.join(KLASOR, 'fontlar', 'DMSans-Regular.ttf'),
    govdeKalin: path.join(KLASOR, 'fontlar', 'DMSans-SemiBold.ttf'),
    baslikFont: path.join(KLASOR, 'fontlar', 'Manrope-Bold.ttf'),
    baslikKalin: path.join(KLASOR, 'fontlar', 'Manrope-ExtraBold.ttf'),
};
const LOGO = path.join(KLASOR, 'logo.png');

const AZAMI_SAYFA = 4;
const W = 595.28;
const H = 841.89;
const M = 40;
const CW = W - 2 * M;
const ALT = H - 46; // içerik sınırı, altında sayfa altlığı

const R = {
    yazi: '#111827',
    orta: '#344054',
    sonuk: '#667085',
    soluk: '#98a2b3',
    cizgi: '#e4e7ec',
    kagit: '#f4f6f9',
    mavi: '#2563eb',
    maviAcik: '#e8effd',
    kirmizi: '#b42318',
    kirmiziAcik: '#fdecec',
    yesil: '#047857',
    yesilAcik: '#e7f6ef',
};

// ---------------------------------------------------------------------
// Biçimler
// ---------------------------------------------------------------------
const tlBicim = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const adetBicim = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 });

function tl(n, isaretli = false) {
    if (n === null || n === undefined) return '-';
    const mutlak = tlBicim.format(Math.abs(n));
    const isaret = n < 0 ? '−' : isaretli && n > 0 ? '+' : '';
    return `${isaret}₺${mutlak}`;
}

function adet(n, isaretli = false) {
    if (n === null || n === undefined) return '-';
    const isaret = n < 0 ? '−' : isaretli && n > 0 ? '+' : '';
    return isaret + adetBicim.format(Math.abs(n));
}

function tarihBicim(d) {
    return d.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Günlük tablo adı "Günlük|2026-10-08" -> "8 Ekim 2026 günlük sayımı" */
function tabloAdi(ad) {
    const m = /^Günlük\|(\d{4})-(\d{2})-(\d{2})$/.exec(String(ad || ''));
    if (!m) return String(ad || 'Adsız tablo');
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    return d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' }) + ' günlük sayımı';
}

// ---------------------------------------------------------------------
// Çizim yardımcıları
// ---------------------------------------------------------------------
function kirp(doc, metin, genislik) {
    const s = String(metin || '');
    if (doc.widthOfString(s) <= genislik) return s;
    let a = 0;
    let b = s.length;
    while (a < b) {
        const o = Math.ceil((a + b) / 2);
        if (doc.widthOfString(s.slice(0, o) + '…') <= genislik) a = o;
        else b = o - 1;
    }
    return s.slice(0, a).trimEnd() + '…';
}

function yaz(doc, metin, x, y, { font = 'govde', boy = 9, renk = R.yazi, genislik, hiza = 'left', aralik = 0 } = {}) {
    doc.font(font).fontSize(boy).fillColor(renk);
    const s = genislik ? kirp(doc, metin, genislik - aralik * String(metin || '').length) : String(metin);
    doc.text(s, x, y, { width: genislik, align: hiza, lineBreak: false, characterSpacing: aralik });
}

/**
 * @param {object} veri raporHesapla çıktısı
 * @param {{tablo:string, kullanici:string, tarih:Date, no:string}} bilgi
 * @returns {Promise<{buffer:Buffer, sayfa:number}>}
 */
function pdfUret(veri, bilgi) {
    return new Promise((resolve, reject) => {
        const baslik = tabloAdi(bilgi.tablo);
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: M, bottom: 0, left: M, right: M },
            bufferPages: true,
            compress: true,
            info: {
                Title: `Sayım Raporu: ${baslik}`,
                Author: 'Jet Barkod',
                Creator: 'Jet Barkod',
                Producer: 'Jet Barkod',
                Subject: 'Sayım raporu',
            },
        });
        for (const [ad, yol] of Object.entries(FONT)) doc.registerFont(ad, yol);

        const parcalar = [];
        doc.on('data', (p) => parcalar.push(p));
        doc.on('error', reject);
        doc.on('end', () => resolve({ buffer: Buffer.concat(parcalar), sayfa: sayfaSayisi }));

        let sayfaSayisi = 1;
        let y = M;

        // ---- Sayfa yönetimi -------------------------------------------
        function devamBasligi() {
            doc.image(LOGO, M, M - 4, { width: 16, height: 16 });
            yaz(doc, 'Jet Barkod', M + 22, M - 1, { font: 'baslikKalin', boy: 9 });
            yaz(doc, baslik, M + 90, M - 0.5, { boy: 8.5, renk: R.sonuk, genislik: CW - 90, hiza: 'right' });
            doc.moveTo(M, M + 20).lineTo(W - M, M + 20).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            y = M + 34;
        }

        /** h kadar yer aç; 4. sayfa doluysa false (son satır için not payı bırakılır) */
        function yer(h, notPayi = 22) {
            if (y + h <= ALT - (sayfaSayisi === AZAMI_SAYFA ? notPayi : 0)) return true;
            if (sayfaSayisi >= AZAMI_SAYFA) return false;
            doc.addPage();
            sayfaSayisi++;
            devamBasligi();
            return true;
        }

        // ---- Üst bant ---------------------------------------------------
        doc.image(LOGO, M, M - 6, { width: 36, height: 36 });
        yaz(doc, 'Jet Barkod', M + 44, M - 3, { font: 'baslikKalin', boy: 16 });
        yaz(doc, 'Sayım Raporu', M + 44, M + 16, { boy: 9, renk: R.sonuk });
        yaz(doc, 'OLUŞTURULDU', W - M - 200, M - 1, { boy: 7, renk: R.soluk, genislik: 200, hiza: 'right', aralik: 0.6 });
        yaz(doc, tarihBicim(bilgi.tarih), W - M - 200, M + 9, { font: 'govdeKalin', boy: 9.5, renk: R.orta, genislik: 200, hiza: 'right' });
        yaz(doc, `Rapor no ${bilgi.no}`, W - M - 200, M + 22, { boy: 7.5, renk: R.soluk, genislik: 200, hiza: 'right' });
        doc.moveTo(M, M + 42).lineTo(W - M, M + 42).lineWidth(0.6).strokeColor(R.cizgi).stroke();
        y = M + 60;

        // ---- Başlık -----------------------------------------------------
        const o = veri.ozet;
        yaz(doc, 'SAYIM TABLOSU', M, y, { boy: 7.5, renk: R.sonuk, aralik: 0.8 });
        y += 12;
        doc.font('baslikFont').fontSize(21).fillColor(R.yazi);
        const baslikMetni = kirp(doc, baslik, CW * 2 - 40);
        doc.text(baslikMetni, M, y, { width: CW, height: 56, ellipsis: true, lineGap: 1 });
        y = Math.min(doc.y, y + 56) + 4;
        yaz(doc, `${bilgi.kullanici}  ·  ${adet(o.urun)} ürün  ·  Fiyatlar orijinal (üstü çizili) fiyattan`, M, y, {
            boy: 8.5, renk: R.sonuk, genislik: CW,
        });
        y += 22;

        // ---- Sayım ilerlemesi ------------------------------------------
        const oran = o.urun ? o.sayilan / o.urun : 0;
        yaz(doc, 'Sayım ilerlemesi', M, y, { font: 'govdeKalin', boy: 9, renk: R.orta });
        yaz(doc, `${adet(o.sayilan)} / ${adet(o.urun)} ürün sayıldı  ·  %${adetBicim.format(Math.round(oran * 1000) / 10)}`, M, y, {
            boy: 9, renk: R.sonuk, genislik: CW, hiza: 'right',
        });
        y += 15;
        doc.roundedRect(M, y, CW, 7, 3.5).fill(R.kagit);
        if (oran > 0) doc.roundedRect(M, y, Math.max(7, CW * oran), 7, 3.5).fill(R.mavi);
        y += 22;

        // ---- Kartlar ----------------------------------------------------
        const kartG = (CW - 16) / 3;
        const kartH = 78;
        function kart(x, etiket, deger, alt, renkler) {
            doc.roundedRect(x, y, kartG, kartH, 10).fill(renkler.zemin);
            yaz(doc, etiket, x + 14, y + 12, { boy: 7.5, renk: renkler.etiket, aralik: 0.6 });
            doc.font('baslikKalin').fontSize(18);
            const deger2 = kirp(doc, deger, kartG - 28);
            yaz(doc, deger2, x + 14, y + 27, { font: 'baslikKalin', boy: 18, renk: renkler.deger });
            yaz(doc, alt, x + 14, y + 55, { boy: 8.5, renk: renkler.alt, genislik: kartG - 28 });
        }
        kart(M, 'EKSİK', tl(-Math.abs(o.eksik.tl)), `${adet(o.eksik.urun)} ürün  ·  ${adet(o.eksik.adet)} adet`, {
            zemin: R.kirmiziAcik, etiket: R.kirmizi, deger: R.kirmizi, alt: R.orta,
        });
        kart(M + kartG + 8, 'FAZLA', tl(o.fazla.tl, true), `${adet(o.fazla.urun)} ürün  ·  ${adet(o.fazla.adet)} adet`, {
            zemin: R.yesilAcik, etiket: R.yesil, deger: R.yesil, alt: R.orta,
        });
        kart(M + 2 * (kartG + 8), 'NET FARK', tl(o.net, true),
            o.dogruluk === null ? 'Karşılaştırılan ürün yok' : `Sayım doğruluğu %${adetBicim.format(o.dogruluk)}`, {
                zemin: R.yazi, etiket: '#c7cdd8', deger: o.net < 0 ? '#ffb4ab' : o.net > 0 ? '#8ce0b8' : '#ffffff', alt: '#d0d5dd',
            });
        y += kartH + 12;

        // ---- Değer şeridi ---------------------------------------------
        const seritH = 40;
        doc.roundedRect(M, y, CW, seritH, 9).lineWidth(0.6).strokeColor(R.cizgi).stroke();
        const hucreler = [
            ['Sistem değeri', tl(o.sistemDeger)],
            ['Sayılan değer', tl(o.sayilanDeger)],
            ['Fark yok', `${adet(o.esit)} ürün`],
            ['Sayılmayan', `${adet(o.sayilmayan)} ürün`],
        ];
        const hG = CW / hucreler.length;
        hucreler.forEach(([e, d], i) => {
            const x = M + i * hG;
            if (i) doc.moveTo(x, y + 9).lineTo(x, y + seritH - 9).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            yaz(doc, e, x + 12, y + 8, { boy: 7.5, renk: R.sonuk, genislik: hG - 20 });
            yaz(doc, d, x + 12, y + 20, { font: 'govdeKalin', boy: 10, renk: R.yazi, genislik: hG - 20 });
        });
        y += seritH + 8;

        const notlar = [];
        if (o.fiyatsiz) notlar.push(`${adet(o.fiyatsiz)} farklı ürünün fiyatı bilinmiyor; adet farkı listede, TL toplamında yok.`);
        if (o.sistemsiz) notlar.push(`${adet(o.sistemsiz)} ürün sayıldı ama sistem stoğu alınmamış; karşılaştırılamadı.`);
        if (o.sayilmayan) notlar.push('Sayılmayan ürünler eksik sayılmadı, en sonda ayrıca listelendi.');
        for (const n of notlar) {
            yaz(doc, '•  ' + n, M + 2, y, { boy: 8, renk: R.sonuk, genislik: CW });
            y += 12;
        }
        y += 14;

        // ---- Ayrıntı tabloları -----------------------------------------
        const K = [
            { b: '#', g: 22, h: 'left' },
            { b: 'ÜRÜN', g: 211, h: 'left' },
            { b: 'SİSTEM', g: 50, h: 'right' },
            { b: 'SAYILAN', g: 52, h: 'right' },
            { b: 'FARK', g: 50, h: 'right' },
            { b: 'BİRİM', g: 62, h: 'right' },
            { b: 'TL ETKİSİ', g: 68, h: 'right' },
        ];
        const SATIR = 24;

        function tabloBasligi() {
            let x = M;
            for (const k of K) {
                const pad = k.h === 'right' ? 8 : 6;
                yaz(doc, k.b, x + (k.h === 'left' ? pad : 0), y, { boy: 7, renk: R.soluk, genislik: k.g - pad, hiza: k.h, aralik: 0.5 });
                x += k.g;
            }
            y += 12;
            doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            y += 2;
        }

        function bolumBasligi(ad, sayiMetni, renk) {
            doc.circle(M + 4, y + 6.5, 3.5).fill(renk);
            yaz(doc, ad, M + 14, y, { font: 'baslikFont', boy: 12.5 });
            yaz(doc, sayiMetni, M, y + 2, { boy: 8.5, renk: R.sonuk, genislik: CW, hiza: 'right' });
            y += 24;
        }

        /** Sığdığı kadar satır; sığmayanlar tek satırda toplanır */
        function urunTablosu(ad, liste, renk, tavan) {
            if (!liste.length) return;
            if (!yer(24 + 14 + SATIR * Math.min(2, liste.length))) return kesildi(liste, 0, ad + ':');
            const toplamTl = liste.reduce((t, p) => t + (p.tl || 0), 0);
            bolumBasligi(ad, `${adet(liste.length)} ürün  ·  ${tl(toplamTl, true)}`, renk);
            tabloBasligi();
            const sinir = Math.min(liste.length, tavan);
            let i = 0;
            for (; i < sinir; i++) {
                const once = sayfaSayisi;
                if (!yer(SATIR)) break;
                if (sayfaSayisi !== once) tabloBasligi();
                satir(liste[i], i, renk);
            }
            if (i < liste.length) kesildi(liste, i, i ? 've' : ad + ':');
            y += 18;
        }

        function satir(p, i, renk) {
            if (i % 2 === 1) doc.rect(M, y, CW, SATIR).fill('#fafbfc');
            let x = M;
            const orta = y + 8.5;
            yaz(doc, String(i + 1), x + 6, orta, { boy: 8, renk: R.soluk, genislik: K[0].g - 6 });
            x += K[0].g;
            yaz(doc, p.ad, x + 6, y + 4.5, { font: 'govdeKalin', boy: 8.5, genislik: K[1].g - 10 });
            yaz(doc, [p.barkod, p.kategori].filter(Boolean).join('  ·  ') || 'Barkod yok', x + 6, y + 14.5, {
                boy: 7, renk: R.soluk, genislik: K[1].g - 10,
            });
            x += K[1].g;
            const hucre = (metin, k, secenek = {}) => {
                yaz(doc, metin, x, orta, { boy: 8.5, renk: R.orta, genislik: k.g - 8, hiza: 'right', ...secenek });
                x += k.g;
            };
            hucre(adet(p.sistem), K[2]);
            hucre(adet(p.depo), K[3]);
            hucre(adet(p.fark, true), K[4], { font: 'govdeKalin', renk });
            hucre(p.fiyat === null ? 'fiyat yok' : tl(p.fiyat), K[5], { renk: p.fiyat === null ? R.soluk : R.orta });
            hucre(p.tl === null ? '-' : tl(p.tl, true), K[6], { font: 'govdeKalin', renk: p.tl === null ? R.soluk : renk });
            y += SATIR;
            doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.4).strokeColor('#eef0f3').stroke();
        }

        function kesildi(liste, i, onEk) {
            const kalan = liste.slice(i);
            if (!kalan.length) return;
            const t = kalan.reduce((s, p) => s + (p.tl || 0), 0);
            y += 6;
            yaz(doc, `${onEk} ${adet(kalan.length)} ürün daha  ·  toplam etkisi ${tl(t, true)}  ·  tamamı Jet Barkod Finans ekranında`, M + 6, y, {
                boy: 8, renk: R.sonuk, genislik: CW - 12,
            });
            y += 14;
        }

        urunTablosu('Eksik ürünler', veri.eksik, R.kirmizi, 60);
        urunTablosu('Fazla ürünler', veri.fazla, R.yesil, 30);

        // ---- Sayılmayanlar: iki sütun, yalnız ad ------------------------
        if (veri.sayilmayan.length && yer(24 + 14 * 3)) {
            bolumBasligi('Sayılmayan ürünler', `${adet(veri.sayilmayan.length)} ürün`, R.soluk);
            const SG = (CW - 16) / 2;
            const AD_SATIR = 14;
            const tavan = Math.min(veri.sayilmayan.length, 60);
            let i = 0;
            while (i < tavan) {
                if (!yer(AD_SATIR)) break;
                for (let s = 0; s < 2 && i < tavan; s++, i++) {
                    yaz(doc, '·  ' + veri.sayilmayan[i].ad, M + s * (SG + 16), y, { boy: 8, renk: R.orta, genislik: SG });
                }
                y += AD_SATIR;
            }
            if (i < veri.sayilmayan.length) {
                y += 4;
                yaz(doc, `ve ${adet(veri.sayilmayan.length - i)} ürün daha`, M, y, { boy: 8, renk: R.sonuk });
                y += 14;
            }
        }

        if (!veri.eksik.length && !veri.fazla.length) {
            if (yer(60)) {
                doc.roundedRect(M, y, CW, 52, 10).fill(R.kagit);
                yaz(doc, o.sayilan ? 'Sayılan ürünlerin hepsi sistemle aynı.' : 'Bu tabloda henüz sayılan ürün yok.', M + 16, y + 13, {
                    font: 'govdeKalin', boy: 10.5,
                });
                yaz(doc, o.sayilan ? 'Eksik ya da fazla ürün bulunmadı.' : 'Sayım yapıldıkça rapor dolar.', M + 16, y + 30, {
                    boy: 8.5, renk: R.sonuk,
                });
                y += 60;
            }
        }

        // ---- Sayfa altlıkları ------------------------------------------
        const aralik = doc.bufferedPageRange();
        for (let s = aralik.start; s < aralik.start + aralik.count; s++) {
            doc.switchToPage(s);
            const yy = H - 30;
            doc.moveTo(M, yy - 8).lineTo(W - M, yy - 8).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            yaz(doc, 'Jet Barkod  ·  jetbarkod.com.tr  ·  Bu rapor sayım verisinden otomatik oluşturuldu.', M, yy, {
                boy: 7.5, renk: R.soluk, genislik: CW - 80,
            });
            yaz(doc, `Sayfa ${s + 1} / ${aralik.count}`, W - M - 80, yy, { boy: 7.5, renk: R.sonuk, genislik: 80, hiza: 'right' });
        }
        sayfaSayisi = aralik.count;
        doc.end();
    });
}

module.exports = { pdfUret, tabloAdi, tl, adet };
