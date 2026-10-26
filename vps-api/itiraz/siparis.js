/**
 * İtiraz kaydının sipariş özeti (itiraz.kayitlar.siparis)
 * ============================================================================
 *
 * Panelin "Sipariş Detayı" yanıtından yalnız ürünler (ad, adet, kimlik,
 * görsel adresi), teslim süresi, sipariş zamanı, kurye ve toplayıcının adı
 * ve profil fotoğrafının adresi. Müşteri adı, adresi ve telefonu hiç gelmez;
 * gelse de burada atılır. Fotoğraf indirilmez, yalnız adres saklanır.
 * ============================================================================
 */
'use strict';

const KIMLIK = /^[0-9a-f]{24}$/;
const KISI_FOTO = /^https:\/\/cdn\.getir\.com\/person\/[A-Za-z0-9._-]+\.(?:png|jpe?g)(?:\?[0-9]+)?$/;
const URUN_GORSEL = /^https:\/\/(?:cdn-image\.getir\.com|cdn\.getir\.com|images\.getir\.com)\/[A-Za-z0-9._~%/-]{1,300}$/;

const metin = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');

function kisi(v) {
    if (!v || typeof v !== 'object') return null;
    const ad = metin(v.ad, 60);
    const foto = typeof v.foto === 'string' && KISI_FOTO.test(v.foto) ? v.foto : '';
    return ad || foto ? { ad, foto } : null;
}

/** Tarayıcıdan ya da veritabanından gelen özeti izinli biçime çevirir; geçersizse null */
function siparisDuzelt(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const urunler = (Array.isArray(v.urunler) ? v.urunler : []).slice(0, 60).map((u) => {
        if (!u || typeof u !== 'object') return null;
        const adet = Number(u.adet);
        return {
            ad: metin(u.ad, 120),
            adet: Number.isFinite(adet) && adet > 0 && adet < 1000 ? Math.round(adet * 1000) / 1000 : 1,
            id: KIMLIK.test(String(u.id || '')) ? String(u.id) : '',
            gorsel: typeof u.gorsel === 'string' && URUN_GORSEL.test(u.gorsel) ? u.gorsel : '',
        };
    }).filter((u) => u && u.ad);
    if (!urunler.length) return null;
    const dk = Number(v.teslimDk);
    const t = Date.parse(v.tarih);
    return {
        urunler,
        kalem: urunler.length,
        adet: Math.round(urunler.reduce((a, u) => a + u.adet, 0) * 1000) / 1000,
        teslimDk: Number.isInteger(dk) && dk > 0 && dk <= 600 ? dk : null,
        tarih: Number.isFinite(t) ? new Date(t).toISOString() : null,
        kurye: kisi(v.kurye),
        toplayici: kisi(v.toplayici),
    };
}

module.exports = { siparisDuzelt, KISI_FOTO };
