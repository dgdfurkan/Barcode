/**
 * Sayım raporu: A4 PDF
 *
 * Sıra: üst bant, başlık, özet (ilerleme + kartlar + değer şeridi), genel
 * bakış grafikleri, eksik ürünler, fazla ürünler, sayılmayan ürünler. Her
 * bölüm gönderim ayarıyla (ayar.js) açılıp kapanıyor; fiyat kapalıysa TL
 * hiçbir yerde yazılmıyor, hesap adet üzerinden yapılıyor.
 *
 * Belge en fazla 4 sayfa. Sığmayan satırlar "ve N ürün daha" satırına
 * toplanıyor, toplam etkisi kaybolmuyor. Ürün görselleri sabit 24 px
 * kutuda; görseli olmayan üründe aynı boyda boş kutu, satır hizası oynamıyor.
 *
 * Fontlar ve logo modül klasöründe; PDF üretilirken ağa çıkılmıyor.
 */
'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');
const { VARSAYILAN } = require('./ayar');

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
const ALT = H - 46;

const R = {
    yazi: '#111827',
    orta: '#344054',
    sonuk: '#667085',
    soluk: '#98a2b3',
    cizgi: '#e4e7ec',
    kagit: '#f4f6f9',
    mavi: '#2563eb',
    kirmizi: '#b42318',
    kirmiziCubuk: '#e5484d',
    kirmiziAcik: '#fdecec',
    yesil: '#047857',
    yesilCubuk: '#12b76a',
    yesilAcik: '#e7f6ef',
    gri: '#d0d5dd',
};

// ---------------------------------------------------------------------
// Biçimler
// ---------------------------------------------------------------------
const tlBicim = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const adetBicim = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 });

function tl(n, isaretli = false) {
    if (n === null || n === undefined) return '-';
    const isaret = n < 0 ? '−' : isaretli && n > 0 ? '+' : '';
    return `${isaret}₺${tlBicim.format(Math.abs(n))}`;
}

function adet(n, isaretli = false) {
    if (n === null || n === undefined) return '-';
    const isaret = n < 0 ? '−' : isaretli && n > 0 ? '+' : '';
    return isaret + adetBicim.format(Math.abs(n));
}

function yuzde(n) {
    return '%' + adetBicim.format(Math.round(n * 10) / 10);
}

function tarihBicim(d) {
    return d.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

/** Günlük tablo adı "Günlük|2026-10-08" -> "8 Ekim 2026 günlük sayımı", Döngü önekiyle gelen alt kategori adı yalın */
function tabloAdi(ad) {
    const dg = /^Döngü\|(.+)$/.exec(String(ad || ''));
    if (dg) return dg[1];
    const m = /^Günlük\|(\d{4})-(\d{2})-(\d{2})$/.exec(String(ad || ''));
    if (!m) return String(ad || 'Adsız tablo');
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    return d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' }) + ' günlük sayımı';
}

/** Fiyat kapalıysa sıralama ve grafik adet farkıyla */
function etki(p, fiyatli) {
    return fiyatli ? Math.abs(p.tl ?? 0) || Math.abs(p.fark) / 1e6 : Math.abs(p.fark);
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

/** Sabit kutuda ürün görseli; yoksa aynı boyda boş kutu */
function urunGorseli(doc, buf, x, y, boy) {
    doc.roundedRect(x, y, boy, boy, Math.round(boy / 5)).lineWidth(0.6).fillAndStroke('#ffffff', '#e8ebf0');
    if (buf) {
        try {
            const ic = boy - 2;
            doc.image(buf, x + 1, y + 1, { fit: [ic, ic], align: 'center', valign: 'center' });
            return;
        } catch (e) { /* bozuk görsel: boş kutu kalır */ }
    }
    doc.roundedRect(x + boy * 0.3, y + boy * 0.3, boy * 0.4, boy * 0.4, 2).fill('#eef0f3');
}

/** Halka dilimi (açılar radyan, 0 = saat 12) */
function halkaDilimi(doc, cx, cy, r, bas, son, kalinlik, renk) {
    if (son - bas <= 0.0001) return;
    if (son - bas >= Math.PI * 2 - 0.0001) {
        doc.circle(cx, cy, r).lineWidth(kalinlik).strokeColor(renk).stroke();
        return;
    }
    const nokta = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const [x1, y1] = nokta(bas);
    const [x2, y2] = nokta(son);
    const buyuk = son - bas > Math.PI ? 1 : 0;
    doc.path(`M ${x1} ${y1} A ${r} ${r} 0 ${buyuk} 1 ${x2} ${y2}`).lineWidth(kalinlik).lineCap('butt').strokeColor(renk).stroke();
}

/**
 * @param {object} veri raporHesapla çıktısı
 * @param {{tablo:string, kullanici:string, tarih:Date, no:string}} bilgi
 * @param {object} [ayarGirdi] ayarDuzelt çıktısı
 * @param {Map<string,Buffer>} [gorseller] ürün id -> küçük görsel
 * @returns {Promise<{buffer:Buffer, sayfa:number}>}
 */
function pdfUret(veri, bilgi, ayarGirdi, gorseller) {
    const ayar = { ...VARSAYILAN, ...(ayarGirdi || {}) };
    const fiyatli = ayar.fiyat;
    const resimli = ayar.gorsel;
    const gorsel = gorseller || new Map();

    return new Promise((resolve, reject) => {
        const baslik = tabloAdi(bilgi.tablo);
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: M, bottom: 0, left: M, right: M },
            bufferPages: true,
            compress: true,
            info: { Title: `Sayım Raporu: ${baslik}`, Author: 'Jet Barkod', Creator: 'Jet Barkod', Producer: 'Jet Barkod', Subject: 'Sayım Raporu' },
        });
        for (const [ad, yol] of Object.entries(FONT)) doc.registerFont(ad, yol);

        const parcalar = [];
        let sayfaSayisi = 1;
        doc.on('data', (p) => parcalar.push(p));
        doc.on('error', reject);
        doc.on('end', () => resolve({ buffer: Buffer.concat(parcalar), sayfa: sayfaSayisi }));

        let y = M;
        const o = veri.ozet;
        const dongu = bilgi.dongu || null;

        function devamBasligi() {
            doc.image(LOGO, M, M - 4, { width: 16, height: 16 });
            yaz(doc, 'Jet Barkod', M + 22, M - 1, { font: 'baslikKalin', boy: 9 });
            yaz(doc, baslik, M + 90, M - 0.5, { boy: 8.5, renk: R.sonuk, genislik: CW - 90, hiza: 'right' });
            doc.moveTo(M, M + 20).lineTo(W - M, M + 20).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            y = M + 34;
        }

        function yer(h, notPayi = 22) {
            if (y + h <= ALT - (sayfaSayisi === AZAMI_SAYFA ? notPayi : 0)) return true;
            if (sayfaSayisi >= AZAMI_SAYFA) return false;
            doc.addPage();
            sayfaSayisi++;
            devamBasligi();
            return true;
        }

        function bolumBasligi(ad, sagMetin, renk) {
            doc.circle(M + 4, y + 7, 3.5).fill(renk);
            yaz(doc, ad, M + 14, y, { font: 'baslikFont', boy: 12.5 });
            if (sagMetin) yaz(doc, sagMetin, M, y + 2, { boy: 8.5, renk: R.sonuk, genislik: CW, hiza: 'right' });
            y += 24;
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
        yaz(doc, dongu ? 'DÖNGÜ · ALT KATEGORİ' : 'SAYIM TABLOSU', M, y, { boy: 7.5, renk: R.sonuk, aralik: 0.8 });
        y += 12;
        doc.font('baslikFont').fontSize(21).fillColor(R.yazi);
        doc.text(kirp(doc, baslik, CW * 2 - 40), M, y, { width: CW, height: 56, ellipsis: true, lineGap: 1 });
        y = Math.min(doc.y, y + 56) + 4;
        yaz(doc, `Hazırlayan: ${bilgi.kullanici}  ·  ${adet(o.urun)} ürün`, M, y, { boy: 8.5, renk: R.sonuk, genislik: CW });
        y += 16;
        if (ayar.not) {
            doc.roundedRect(M, y, CW, 24, 6).fill(R.kagit);
            yaz(doc, ayar.not, M + 10, y + 7, { boy: 8.5, renk: R.orta, genislik: CW - 20 });
            y += 32;
        } else {
            y += 6;
        }

        // ---- Sayım ilerlemesi (her zaman) -----------------------------
        const oran = o.urun ? o.sayilan / o.urun : 0;
        yaz(doc, 'Sayım ilerlemesi', M, y, { font: 'govdeKalin', boy: 9, renk: R.orta });
        yaz(doc, `${adet(o.sayilan)} / ${adet(o.urun)} ürün sayıldı  ·  ${yuzde(oran * 100)}`, M, y, { boy: 9, renk: R.sonuk, genislik: CW, hiza: 'right' });
        y += 15;
        doc.roundedRect(M, y, CW, 7, 3.5).fill(R.kagit);
        if (oran > 0) doc.roundedRect(M, y, Math.max(7, CW * oran), 7, 3.5).fill(R.mavi);
        y += 22;

        // ---- Döngü ilerlemesi (Döngü tablosunda) ------------------------
        if (dongu) {
            const dOran = dongu.toplam ? dongu.sayildi / dongu.toplam : 0;
            const kutuH = 74;
            doc.roundedRect(M, y, CW, kutuH, 10).lineWidth(0.6).fillAndStroke('#fbfcfe', R.cizgi);
            yaz(doc, 'DÖNGÜ İLERLEMESİ', M + 14, y + 12, { boy: 7, renk: R.sonuk, aralik: 0.6 });
            yaz(doc, `${adet(dongu.sayildi)} / ${adet(dongu.toplam)}`, M + 14, y + 24, { font: 'baslikKalin', boy: 15, genislik: 120 });
            const solG = doc.font('baslikKalin').fontSize(15).widthOfString(`${adet(dongu.sayildi)} / ${adet(dongu.toplam)}`);
            yaz(doc, `alt kategori sayıldı  ·  ${yuzde(dOran * 100)}`, M + 20 + solG, y + 29, { boy: 9, renk: R.orta, genislik: CW - 40 - solG });
            const dilimler = [
                ['Sayıldı', dongu.sayildi, R.yesilCubuk],
                ['Sürüyor', dongu.suruyor, R.mavi],
                ['Gecikti', dongu.gecikti, R.kirmiziCubuk],
                ['Hiç sayılmadı', dongu.yok, R.gri],
            ];
            const sx = M + 14;
            const sG = CW - 28;
            const sy = y + 46;
            doc.save();
            doc.roundedRect(sx, sy, sG, 6, 3).clip();
            doc.rect(sx, sy, sG, 6).fill(R.kagit);
            let dx = sx;
            for (const [, n, renk] of dilimler) {
                const g = (n / dongu.toplam) * sG;
                if (g > 0) doc.rect(dx, sy, g + 0.4, 6).fill(renk);
                dx += g;
            }
            doc.restore();
            let lx = sx;
            for (const [ad, n, renk] of dilimler) {
                doc.roundedRect(lx, sy + 13.5, 6, 6, 1.5).fill(renk);
                const etiket = `${ad} ${adet(n)}`;
                yaz(doc, etiket, lx + 10, sy + 12, { boy: 7.5, renk: R.orta });
                lx += 10 + doc.font('govde').fontSize(7.5).widthOfString(etiket) + 16;
            }
            y += kutuH + 14;
        }

        // ---- Özet kartları ---------------------------------------------
        if (ayar.ozet) {
            const kartG = (CW - 16) / 3;
            const kartH = 78;
            const kart = (x, etiket, deger, alt, r) => {
                doc.roundedRect(x, y, kartG, kartH, 10).fill(r.zemin);
                yaz(doc, etiket, x + 14, y + 12, { boy: 7.5, renk: r.etiket, aralik: 0.6 });
                yaz(doc, deger, x + 14, y + 27, { font: 'baslikKalin', boy: 18, renk: r.deger, genislik: kartG - 28 });
                yaz(doc, alt, x + 14, y + 55, { boy: 8.5, renk: r.alt, genislik: kartG - 28 });
            };
            const netAdet = Math.round(((o.fazla.adet || 0) - (o.eksik.adet || 0)) * 1000) / 1000;
            const dogrulukMetni = o.dogruluk === null ? 'Karşılaştırılan ürün yok' : `Sayım doğruluğu ${yuzde(o.dogruluk)}`;
            const netDeger = fiyatli ? o.net : netAdet;
            kart(M, 'EKSİK', fiyatli ? tl(-Math.abs(o.eksik.tl)) : adet(-o.eksik.adet) + ' adet',
                fiyatli ? `${adet(o.eksik.urun)} ürün  ·  ${adet(o.eksik.adet)} adet` : `${adet(o.eksik.urun)} ürün`,
                { zemin: R.kirmiziAcik, etiket: R.kirmizi, deger: R.kirmizi, alt: R.orta });
            kart(M + kartG + 8, 'FAZLA', fiyatli ? tl(o.fazla.tl, true) : adet(o.fazla.adet, true) + ' adet',
                fiyatli ? `${adet(o.fazla.urun)} ürün  ·  ${adet(o.fazla.adet)} adet` : `${adet(o.fazla.urun)} ürün`,
                { zemin: R.yesilAcik, etiket: R.yesil, deger: R.yesil, alt: R.orta });
            kart(M + 2 * (kartG + 8), 'NET FARK', fiyatli ? tl(o.net, true) : adet(netAdet, true) + ' adet', dogrulukMetni, {
                zemin: R.yazi, etiket: '#c7cdd8', deger: netDeger < 0 ? '#ffb4ab' : netDeger > 0 ? '#8ce0b8' : '#ffffff', alt: '#d0d5dd',
            });
            y += kartH + 12;

            const seritH = 40;
            doc.roundedRect(M, y, CW, seritH, 9).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            const hucreler = fiyatli
                ? [['Sistem değeri', tl(o.sistemDeger)], ['Sayılan değer', tl(o.sayilanDeger)], ['Fark yok', `${adet(o.esit)} ürün`], ['Sayılmayan', `${adet(o.sayilmayan)} ürün`]]
                : [['Sayılan', `${adet(o.sayilan)} ürün`], ['Fark yok', `${adet(o.esit)} ürün`], ['Farklı çıkan', `${adet(o.eksik.urun + o.fazla.urun)} ürün`], ['Sayılmayan', `${adet(o.sayilmayan)} ürün`]];
            const hG = CW / hucreler.length;
            hucreler.forEach(([e, d], i) => {
                const x = M + i * hG;
                if (i) doc.moveTo(x, y + 9).lineTo(x, y + seritH - 9).lineWidth(0.6).strokeColor(R.cizgi).stroke();
                yaz(doc, e, x + 12, y + 8, { boy: 7.5, renk: R.sonuk, genislik: hG - 20 });
                yaz(doc, d, x + 12, y + 20, { font: 'govdeKalin', boy: 10, renk: R.yazi, genislik: hG - 20 });
            });
            y += seritH + 8;

            const notlar = [];
            if (o.fiyatsiz && fiyatli) notlar.push(`${adet(o.fiyatsiz)} ürünün fiyatı bilinmiyor; adet farkı listede, TL toplamında yok.`);
            if (o.sistemsiz) notlar.push(`${adet(o.sistemsiz)} ürün sayıldı ama sistem stoğu alınmamış; karşılaştırılamadı.`);
            if (o.sayilmayan) notlar.push('Sayılmayan ürünler eksik sayılmadı.');
            for (const n of notlar) {
                yaz(doc, '•  ' + n, M + 2, y, { boy: 8, renk: R.sonuk, genislik: CW });
                y += 12;
            }
            y += 12;
        }

        // ---- Genel bakış: iki küçük grafik ------------------------------
        if (ayar.grafik && yer(24 + 132)) {
            bolumBasligi('Genel bakış', '', R.mavi);
            const pH = 120;
            const solG = 228;
            const sagX = M + solG + 12;
            const sagG = CW - solG - 12;
            doc.roundedRect(M, y, solG, pH, 10).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            doc.roundedRect(sagX, y, sagG, pH, 10).lineWidth(0.6).strokeColor(R.cizgi).stroke();

            // Sol: ürün durumu halkası
            const dilimler = [
                ['Fark yok', o.esit, R.mavi],
                ['Eksik', o.eksik.urun, R.kirmiziCubuk],
                ['Fazla', o.fazla.urun, R.yesilCubuk],
                ['Sayılmayan', o.sayilmayan, R.gri],
            ];
            if (o.sistemsiz) dilimler.push(['Sistem yok', o.sistemsiz, '#f79009']);
            const toplam = dilimler.reduce((t, d) => t + d[1], 0) || 1;
            const cx = M + 58;
            const cy = y + pH / 2 + 6;
            const r = 33;
            yaz(doc, 'ÜRÜN DURUMU', M + 14, y + 11, { boy: 7, renk: R.sonuk, aralik: 0.6 });
            doc.circle(cx, cy, r).lineWidth(11).strokeColor('#f2f4f7').stroke();
            let aci = 0;
            for (const [, n, renk] of dilimler) {
                const pay = (n / toplam) * Math.PI * 2;
                halkaDilimi(doc, cx, cy, r, aci, aci + pay, 11, renk);
                aci += pay;
            }
            yaz(doc, yuzde(oran * 100), cx - 30, cy - 9, { font: 'baslikKalin', boy: 12, genislik: 60, hiza: 'center' });
            yaz(doc, 'sayıldı', cx - 30, cy + 5, { boy: 7, renk: R.sonuk, genislik: 60, hiza: 'center' });
            let ly = y + 32 + (5 - dilimler.length) * 7;
            for (const [ad, n, renk] of dilimler) {
                doc.roundedRect(M + 112, ly + 1.5, 7, 7, 2).fill(renk);
                yaz(doc, ad, M + 124, ly, { boy: 8, renk: R.orta, genislik: 60 });
                yaz(doc, adet(n), M + 112, ly, { font: 'govdeKalin', boy: 8, genislik: solG - 112 - 14, hiza: 'right' });
                ly += 15;
            }

            // Sağ: en çok etkileyen 5 ürün
            const etkili = [...veri.eksik, ...veri.fazla]
                .filter((p) => !fiyatli || p.tl !== null)
                .sort((a, b) => etki(b, fiyatli) - etki(a, fiyatli))
                .slice(0, 5);
            yaz(doc, fiyatli ? 'EN ÇOK ETKİLEYEN ÜRÜNLER (TL)' : 'EN ÇOK FARK ÇIKAN ÜRÜNLER (ADET)', sagX + 14, y + 11, { boy: 7, renk: R.sonuk, aralik: 0.6 });
            if (!etkili.length) {
                yaz(doc, 'Farklı çıkan ürün yok.', sagX + 14, y + 54, { boy: 9, renk: R.sonuk });
            } else {
                const enBuyuk = Math.max(...etkili.map((p) => etki(p, fiyatli))) || 1;
                const adG = 108;
                const degG = 62;
                const cubukX = sagX + 14 + (resimli ? 18 : 0) + adG + 6;
                const cubukG = sagG - (cubukX - sagX) - degG - 14;
                let by = y + 29;
                for (const p of etkili) {
                    let x = sagX + 14;
                    if (resimli) { urunGorseli(doc, gorsel.get(p.id), x, by - 1, 14); x += 18; }
                    yaz(doc, p.ad, x, by + 1.5, { boy: 7.5, renk: R.orta, genislik: adG });
                    const g = Math.max(3, (etki(p, fiyatli) / enBuyuk) * cubukG);
                    doc.roundedRect(cubukX, by + 2, g, 8, 2).fill(p.fark < 0 ? R.kirmiziCubuk : R.yesilCubuk);
                    yaz(doc, fiyatli ? tl(p.tl, true) : adet(p.fark, true), cubukX + cubukG + 4, by + 1.5, {
                        font: 'govdeKalin', boy: 7.5, renk: p.fark < 0 ? R.kirmizi : R.yesil, genislik: degG, hiza: 'right',
                    });
                    by += 17.5;
                }
            }
            y += pH + 22;
        }

        // ---- Ürün tabloları ----------------------------------------------
        const SATIR = resimli ? 30 : 24;
        const GORSEL = 24;
        const K = (() => {
            const sutun = [{ b: '#', g: 22, h: 'left', k: 'no' }];
            if (resimli) sutun.push({ b: '', g: GORSEL + 8, h: 'left', k: 'gorsel' });
            sutun.push({ b: 'ÜRÜN', g: 0, h: 'left', k: 'ad' });
            sutun.push({ b: 'SİSTEM', g: 48, h: 'right', k: 'sistem' });
            sutun.push({ b: 'SAYILAN', g: 52, h: 'right', k: 'depo' });
            sutun.push({ b: 'FARK', g: 46, h: 'right', k: 'fark' });
            if (fiyatli) {
                sutun.push({ b: 'BİRİM', g: 62, h: 'right', k: 'birim' });
                sutun.push({ b: 'TL ETKİSİ', g: 68, h: 'right', k: 'tl' });
            }
            const dolu = sutun.reduce((t, s) => t + s.g, 0);
            sutun.find((s) => s.k === 'ad').g = CW - dolu;
            return sutun;
        })();

        function tabloBasligi() {
            let x = M;
            for (const k of K) {
                if (k.b) {
                    const pad = k.h === 'right' ? 8 : 6;
                    yaz(doc, k.b, x + (k.h === 'left' ? pad : 0), y, { boy: 7, renk: R.soluk, genislik: k.g - pad, hiza: k.h, aralik: 0.5 });
                }
                x += k.g;
            }
            y += 12;
            doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            y += 2;
        }

        function satir(p, i, renk) {
            if (i % 2 === 1) doc.rect(M, y, CW, SATIR).fill('#fafbfc');
            const orta = y + SATIR / 2 - 4.5;
            let x = M;
            for (const k of K) {
                const sag = (metin, secenek = {}) =>
                    yaz(doc, metin, x, orta, { boy: 8.5, renk: R.orta, genislik: k.g - 8, hiza: 'right', ...secenek });
                switch (k.k) {
                    case 'no': yaz(doc, String(i + 1), x + 6, orta, { boy: 8, renk: R.soluk, genislik: k.g - 6 }); break;
                    case 'gorsel': urunGorseli(doc, gorsel.get(p.id), x + 4, y + (SATIR - GORSEL) / 2, GORSEL); break;
                    case 'ad': {
                        const alt = [ayar.barkod ? p.barkod : '', p.kategori].filter(Boolean).join('  ·  ');
                        const ust = alt ? y + SATIR / 2 - 10 : orta;
                        yaz(doc, p.ad, x + 6, ust, { font: 'govdeKalin', boy: 8.5, genislik: k.g - 10 });
                        if (alt) yaz(doc, alt, x + 6, ust + 10.5, { boy: 7, renk: R.soluk, genislik: k.g - 10 });
                        break;
                    }
                    case 'sistem': sag(adet(p.sistem)); break;
                    case 'depo': sag(adet(p.depo)); break;
                    case 'fark': sag(adet(p.fark, true), { font: 'govdeKalin', renk }); break;
                    case 'birim': sag(p.fiyat === null ? 'fiyat yok' : tl(p.fiyat), { renk: p.fiyat === null ? R.soluk : R.orta }); break;
                    case 'tl': sag(p.tl === null ? '-' : tl(p.tl, true), { font: 'govdeKalin', renk: p.tl === null ? R.soluk : renk }); break;
                    default: break;
                }
                x += k.g;
            }
            y += SATIR;
            doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.4).strokeColor('#eef0f3').stroke();
        }

        function kesildi(liste, i, onEk) {
            const kalan = liste.slice(i);
            if (!kalan.length) return;
            const parca = [`${onEk} ${adet(kalan.length)} ürün daha`];
            if (fiyatli) parca.push(`toplam etkisi ${tl(kalan.reduce((s, p) => s + (p.tl || 0), 0), true)}`);
            else parca.push(`toplam ${adet(kalan.reduce((s, p) => s + p.fark, 0), true)} adet`);
            parca.push('tamamı Jet Barkod Finans ekranında');
            y += 6;
            yaz(doc, parca.join('  ·  '), M + 6, y, { boy: 8, renk: R.sonuk, genislik: CW - 12 });
            y += 14;
        }

        function urunTablosu(ad, listeHam, renk, tavan) {
            if (!listeHam.length) return;
            const liste = fiyatli ? listeHam : [...listeHam].sort((a, b) => Math.abs(b.fark) - Math.abs(a.fark));
            if (!yer(24 + 14 + SATIR * Math.min(2, liste.length))) return kesildi(liste, 0, ad + ':');
            const sag = fiyatli
                ? `${adet(liste.length)} ürün  ·  ${tl(liste.reduce((t, p) => t + (p.tl || 0), 0), true)}`
                : `${adet(liste.length)} ürün  ·  ${adet(liste.reduce((t, p) => t + p.fark, 0), true)} adet`;
            bolumBasligi(ad, sag, renk);
            tabloBasligi();
            const sinir = Math.min(liste.length, ayar.sinir || tavan);
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

        if (ayar.eksik) urunTablosu('Eksik ürünler', veri.eksik, R.kirmizi, 60);
        if (ayar.fazla) urunTablosu('Fazla ürünler', veri.fazla, R.yesil, 30);

        // ---- Sayılmayanlar: iki sütun ------------------------------------
        if (ayar.sayilmayan && veri.sayilmayan.length && yer(24 + 20 * 3)) {
            bolumBasligi('Sayılmayan ürünler', `${adet(veri.sayilmayan.length)} ürün`, R.soluk);
            const SG = (CW - 16) / 2;
            const AD_SATIR = resimli ? 22 : 14;
            const tavan = Math.min(veri.sayilmayan.length, ayar.sinir || 60);
            let i = 0;
            while (i < tavan) {
                if (!yer(AD_SATIR)) break;
                for (let s = 0; s < 2 && i < tavan; s++, i++) {
                    const p = veri.sayilmayan[i];
                    const x = M + s * (SG + 16);
                    if (resimli) {
                        urunGorseli(doc, gorsel.get(p.id), x, y, 16);
                        yaz(doc, p.ad, x + 22, y + 4, { boy: 8, renk: R.orta, genislik: SG - 22 });
                    } else {
                        yaz(doc, '·  ' + p.ad, x, y, { boy: 8, renk: R.orta, genislik: SG });
                    }
                }
                y += AD_SATIR;
            }
            if (i < veri.sayilmayan.length) {
                y += 4;
                yaz(doc, `ve ${adet(veri.sayilmayan.length - i)} ürün daha`, M, y, { boy: 8, renk: R.sonuk });
                y += 14;
            }
        }

        if ((ayar.eksik || ayar.fazla) && !veri.eksik.length && !veri.fazla.length && yer(60)) {
            doc.roundedRect(M, y, CW, 52, 10).fill(R.kagit);
            yaz(doc, o.sayilan ? 'Sayılan ürünlerin hepsi sistemle aynı.' : 'Bu tabloda henüz sayılan ürün yok.', M + 16, y + 13, { font: 'govdeKalin', boy: 10.5 });
            yaz(doc, o.sayilan ? 'Eksik ya da fazla ürün bulunmadı.' : 'Sayım yapıldıkça rapor dolar.', M + 16, y + 30, { boy: 8.5, renk: R.sonuk });
            y += 60;
        }

        // ---- Sayfa altlıkları ------------------------------------------
        const aralik = doc.bufferedPageRange();
        for (let s = aralik.start; s < aralik.start + aralik.count; s++) {
            doc.switchToPage(s);
            const yy = H - 30;
            doc.moveTo(M, yy - 8).lineTo(W - M, yy - 8).lineWidth(0.6).strokeColor(R.cizgi).stroke();
            yaz(doc, 'Jet Barkod  ·  jetbarkod.com.tr  ·  Bu rapor sayım verisinden otomatik oluşturuldu.', M, yy, { boy: 7.5, renk: R.soluk, genislik: CW - 80 });
            yaz(doc, `Sayfa ${s + 1} / ${aralik.count}`, W - M - 80, yy, { boy: 7.5, renk: R.sonuk, genislik: 80, hiza: 'right' });
        }
        sayfaSayisi = aralik.count;
        doc.end();
    });
}

/** PDF'te görünebilecek ürünler: görselleri önceden toplamak için */
function gorselGerekenler(veri, ayarGirdi) {
    const ayar = { ...VARSAYILAN, ...(ayarGirdi || {}) };
    if (!ayar.gorsel) return [];
    const sec = (liste, tavan) => liste.slice(0, Math.min(liste.length, ayar.sinir || tavan));
    const out = [];
    if (ayar.eksik) out.push(...sec(veri.eksik, 60));
    if (ayar.fazla) out.push(...sec(veri.fazla, 30));
    if (ayar.sayilmayan) out.push(...sec(veri.sayilmayan, 60));
    if (ayar.grafik) out.push(...[...veri.eksik, ...veri.fazla].sort((a, b) => etki(b, ayar.fiyat) - etki(a, ayar.fiyat)).slice(0, 5));
    return out;
}

module.exports = { pdfUret, gorselGerekenler, tabloAdi, tl, adet, yuzde, etki };
