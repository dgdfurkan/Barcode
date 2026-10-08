/**
 * Sayım raporu: hesap
 *
 * Saf fonksiyon. Veritabanından gelen sayım satırlarını, katalogu ve
 * tarayıcının bildirdiği yedek fiyatları alıp raporun bütün sayılarını
 * üretir. Ağ ya da dosya erişimi yok; birim testi doğrudan çağırır.
 *
 * KURALLAR (sayım sayfasındaki tablo kar/zararıyla aynı)
 * - Fiyat: orijinal (üstü çizili) fiyat varsa o, yoksa satış fiyatı.
 * - Fark yalnız hem depo hem sistem stoğu bilinen üründe hesaplanır.
 * - Sayılmayan ürün eksik sayılmaz; ayrı listelenir. Sayım yarımsa da
 *   rapor yalnız sayılanı anlatır.
 * - Fiyatı bilinmeyen ürünün adet farkı yazılır, TL toplamına girmez.
 */
'use strict';

function sayi(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function pozitif(v) {
    const n = sayi(v);
    return n !== null && n > 0 ? n : null;
}

/** Kayan nokta artığını temizle (0.1 + 0.2 gibi) */
function yuvarla(n, hane = 2) {
    const k = 10 ** hane;
    return Math.round((n + Number.EPSILON) * k) / k;
}

/**
 * @param {Array<{product_id:string, warehouse_stock:any, system_stock:any, price:any, struck_price:any}>} satirlar
 * @param {(id:string)=>({ad:string, barkod:string, kategori:string}|null)} urunBul
 * @param {Object<string,[number|null, number|null]>} [yedekFiyat] id -> [satış, orijinal]
 */
function raporHesapla(satirlar, urunBul, yedekFiyat) {
    const yedek = yedekFiyat || {};
    const eksik = [];
    const fazla = [];
    const sayilmayan = [];
    let esit = 0;
    let sistemsiz = 0;
    let fiyatsiz = 0;
    let sistemDeger = 0;
    let sayilanDeger = 0;

    for (const s of satirlar) {
        const id = String(s.product_id);
        const k = urunBul(id);
        const urun = {
            id,
            ad: (k && k.ad) || 'Katalogda olmayan ürün',
            barkod: (k && k.barkod) || '',
            kategori: (k && k.kategori) || '',
        };
        const depo = sayi(s.warehouse_stock);
        const sistem = sayi(s.system_stock);

        if (depo === null) {
            sayilmayan.push(urun);
            continue;
        }
        if (sistem === null) {
            sistemsiz++;
            continue;
        }

        const y = Array.isArray(yedek[id]) ? yedek[id] : [];
        const orijinal = pozitif(s.struck_price) ?? pozitif(y[1]);
        const satis = pozitif(s.price) ?? pozitif(y[0]);
        const fiyat = orijinal ?? satis;

        const fark = yuvarla(depo - sistem, 3);
        if (fiyat !== null) {
            sistemDeger += sistem * fiyat;
            sayilanDeger += depo * fiyat;
        }

        if (fark === 0) {
            esit++;
            continue;
        }
        if (fiyat === null) fiyatsiz++;

        const satir = {
            ...urun,
            depo,
            sistem,
            fark,
            fiyat,
            tl: fiyat === null ? null : yuvarla(fark * fiyat),
        };
        (fark < 0 ? eksik : fazla).push(satir);
    }

    // TL etkisi büyükten küçüğe; fiyatsızlar adet farkına göre sona
    const sirala = (a, b) => {
        if (a.tl === null && b.tl === null) return Math.abs(b.fark) - Math.abs(a.fark);
        if (a.tl === null) return 1;
        if (b.tl === null) return -1;
        return Math.abs(b.tl) - Math.abs(a.tl);
    };
    eksik.sort(sirala);
    fazla.sort(sirala);
    sayilmayan.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

    const topla = (liste) => ({
        urun: liste.length,
        adet: yuvarla(liste.reduce((t, p) => t + Math.abs(p.fark), 0), 3),
        tl: yuvarla(liste.reduce((t, p) => t + (p.tl || 0), 0)),
    });
    const e = topla(eksik);
    const f = topla(fazla);
    const karsilastirilan = eksik.length + fazla.length + esit;

    return {
        ozet: {
            urun: satirlar.length,
            sayilan: satirlar.length - sayilmayan.length,
            sayilmayan: sayilmayan.length,
            sistemsiz,
            esit,
            fiyatsiz,
            eksik: e,
            fazla: f,
            net: yuvarla(e.tl + f.tl),
            sistemDeger: yuvarla(sistemDeger),
            sayilanDeger: yuvarla(sayilanDeger),
            dogruluk: karsilastirilan ? Math.round((esit / karsilastirilan) * 1000) / 10 : null,
        },
        eksik,
        fazla,
        sayilmayan,
    };
}

module.exports = { raporHesapla, yuvarla };
