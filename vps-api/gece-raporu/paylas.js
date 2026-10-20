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

async function albumGonder(pool, hedefler, kartlar, baslik, ad) {
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

module.exports = { S3, hasarFotosu, albumGonder };
