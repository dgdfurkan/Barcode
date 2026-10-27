/**
 * Satıştan Kaldırma ve gece raporunun ortak parçaları
 *
 *   hasarFotosu  Panelin süreli hasar fotoğrafı linkini yalnız karta çizmek için
 *                indirir (diske yazılmaz), 360 px'e küçültür.
 *   albumGonder  Kartları Telegram'a gönderir: tek kartsa fotoğraf, çoksa albüm
 *                (en çok 10). İlk alıcıdan sonra aynı dosya kimlikleriyle.
 */
'use strict';

const { Resvg } = require('@resvg/resvg-js');
const telegram = require('../sayim-raporu/telegram');

/* Hasar fotoğrafı: blocked-stock/ (satıştan kaldırma) ya da transfer/ (merkez depodan hasarlı) */
const S3 = /^https:\/\/getir-stock\.s3\.[a-z0-9-]+\.amazonaws\.com\/(?:blocked-stock|transfer)\/[^\s"'<>]+$/;

/* Hasar fotoğrafı: panelin süreli linki; yalnız karta çizmek için indirilir,
   diske yazılmaz. 360 px'e küçültülür. */
async function hasarFotosu(adres) {
    if (!S3.test(adres || '')) return null;
    try {
        const bitis = Number(new URL(adres).searchParams.get('Expires'));
        if (bitis && bitis * 1000 < Date.now() + 5000) return null;
    } catch (e) { return null; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
        const r = await fetch(adres, { signal: ctrl.signal, redirect: 'error' });
        if (!r.ok) return null;
        const b = Buffer.from(await r.arrayBuffer());
        if (!b.length || b.length > 8 * 1024 * 1024) return null;
        const tur = b[0] === 0xff && b[1] === 0xd8 ? 'jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'png' : null;
        if (!tur) return null;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><rect width="360" height="360" fill="#fff"/>` +
            `<image href="data:image/${tur};base64,${b.toString('base64')}" width="360" height="360" preserveAspectRatio="xMidYMid slice"/></svg>`;
        return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
    } catch (e) {
        return null;
    } finally {
        clearTimeout(t);
    }
}

/** Önizleme için kartı küçültür (varsayılan 720 px); hata olursa olduğu gibi */
function kucult(png, genislik = 720) {
    try {
        // Boy kartın kendi oranından: PNG başlığındaki genişlik ve yükseklik
        const g = png.readUInt32BE(16);
        const y = png.readUInt32BE(20);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${g}" height="${y}" viewBox="0 0 ${g} ${y}"><image href="data:image/png;base64,${png.toString('base64')}" width="${g}" height="${y}"/></svg>`;
        return new Resvg(svg, { fitTo: { mode: 'width', value: genislik }, font: { loadSystemFonts: false } }).render().asPng();
    } catch (e) {
        return png;
    }
}

/**
 * Kartlar 10'arlı albümlerle (Telegram'ın sınırı); yazı ilk albümde,
 * sonrakilerde "devam 2/3". Dönüş: ilk albümün ulaştığı hesap sayısı.
 */
async function albumGonder(pool, hedefler, kartlar, baslik, ad) {
    const parcalar = [];
    for (let i = 0; i < kartlar.length; i += 10) parcalar.push(kartlar.slice(i, i + 10));
    let ilk = { giden: 0 };
    for (let i = 0; i < parcalar.length; i++) {
        const yazi = i === 0 ? baslik : (String(baslik || '').split('\n')[0] + ' · devam ' + (i + 1) + '/' + parcalar.length);
        const s = await albumParcasi(pool, hedefler, parcalar[i], yazi, parcalar.length > 1 ? ad + '-' + (i + 1) : ad);
        if (i === 0) ilk = s;
        if (!s.giden) break;
    }
    return ilk;
}

async function albumParcasi(pool, hedefler, kartlar, baslik, ad) {
    const liste = kartlar.slice(0, 10);
    let giden = 0;
    let kimlikler = null;
    for (const h of hedefler) {
        try {
            if (liste.length === 1) {
                if (kimlikler) {
                    await telegram.cagir('sendPhoto', { chat_id: h.chat_id, photo: kimlikler[0], caption: baslik });
                } else {
                    const form = new FormData();
                    form.append('chat_id', String(h.chat_id));
                    form.append('caption', baslik);
                    form.append('photo', new Blob([liste[0]], { type: 'image/png' }), ad + '.png');
                    const s = await telegram.cagir('sendPhoto', form, 60000);
                    const f = Array.isArray(s && s.photo) ? s.photo[s.photo.length - 1] : null;
                    if (f && f.file_id) kimlikler = [f.file_id];
                }
            } else if (kimlikler) {
                await telegram.cagir('sendMediaGroup', {
                    chat_id: h.chat_id,
                    media: kimlikler.map((id, i) => ({ type: 'photo', media: id, ...(i === 0 ? { caption: baslik } : {}) })),
                }, 60000);
            } else {
                const form = new FormData();
                form.append('chat_id', String(h.chat_id));
                form.append('media', JSON.stringify(liste.map((_, i) => ({
                    type: 'photo', media: 'attach://kart' + i, ...(i === 0 ? { caption: baslik } : {}),
                }))));
                liste.forEach((png, i) => form.append('kart' + i, new Blob([png], { type: 'image/png' }), ad + '-' + (i + 1) + '.png'));
                const s = await telegram.cagir('sendMediaGroup', form, 90000);
                if (Array.isArray(s) && s.length === liste.length) {
                    const ids = s.map((m) => Array.isArray(m.photo) && m.photo.length ? m.photo[m.photo.length - 1].file_id : null);
                    if (ids.every(Boolean)) kimlikler = ids;
                }
            }
            giden++;
        } catch (e) {
            console.warn(ad + ' gonder:', telegram.temizle(e && e.message));
            if (e instanceof telegram.TelegramHatasi && e.kod === 403) {
                await pool.query(`UPDATE rapor.telegram_baglantilari SET durum = 'engelli' WHERE id = $1`, [h.id]).catch(() => {});
            }
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    return { giden };
}

/**
 * Kartları tam kalite dosya (belge) olarak gönderir: Telegram fotoğrafı
 * küçültüyor, dosya özgün çözünürlükte kalır (yakınlaştırınca bozulmaz).
 * Sessiz gider (bildirim sesi yok); ilk alıcıdan sonra dosya kimliğiyle.
 */
async function belgeGonder(pool, hedefler, kartlar, ad) {
    let ilk = { giden: 0 };
    for (let i = 0; i < kartlar.length; i += 10) {
        const s = await belgeParcasi(pool, hedefler, kartlar.slice(i, i + 10), kartlar.length > 10 ? ad + '-' + (i / 10 + 1) : ad);
        if (i === 0) ilk = s;
    }
    return ilk;
}

async function belgeParcasi(pool, hedefler, kartlar, ad) {
    const liste = kartlar.slice(0, 10);
    let giden = 0;
    let kimlikler = null;
    for (const h of hedefler) {
        try {
            if (kimlikler) {
                if (kimlikler.length === 1) await telegram.cagir('sendDocument', { chat_id: h.chat_id, document: kimlikler[0], disable_notification: true });
                else await telegram.cagir('sendMediaGroup', { chat_id: h.chat_id, media: kimlikler.map((id) => ({ type: 'document', media: id })), disable_notification: true }, 60000);
            } else if (liste.length === 1) {
                const form = new FormData();
                form.append('chat_id', String(h.chat_id));
                form.append('disable_notification', 'true');
                form.append('document', new Blob([liste[0]], { type: 'image/png' }), ad + '.png');
                const s = await telegram.cagir('sendDocument', form, 90000);
                if (s && s.document && s.document.file_id) kimlikler = [s.document.file_id];
            } else {
                const form = new FormData();
                form.append('chat_id', String(h.chat_id));
                form.append('disable_notification', 'true');
                form.append('media', JSON.stringify(liste.map((_, i) => ({ type: 'document', media: 'attach://belge' + i }))));
                liste.forEach((png, i) => form.append('belge' + i, new Blob([png], { type: 'image/png' }), ad + '-' + (i + 1) + '.png'));
                const s = await telegram.cagir('sendMediaGroup', form, 120000);
                if (Array.isArray(s) && s.length === liste.length) {
                    const ids = s.map((m) => m.document && m.document.file_id);
                    if (ids.every(Boolean)) kimlikler = ids;
                }
            }
            giden++;
        } catch (e) {
            console.warn(ad + ' belge:', telegram.temizle(e && e.message));
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    return { giden };
}

module.exports = { kucult, S3, hasarFotosu, albumGonder, belgeGonder };
