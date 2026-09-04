/**
 * Arka plan işi: Sipariş Köprüsü
 * ============================================================================
 *
 * Depo panelinden toplanan siparişleri Jet Barkod'a yazar.
 *
 * NEDEN ARKA PLANDA
 * İçerik betiği warehouse.getir.com kaynağında çalışıyor; oradan
 * api.flowcobalt.com'a atılan istek CORS'a takılır. Arka plan hizmet
 * işçisinin kaynak kısıtı yok, host izni yeterli.
 *
 * YETKİ
 * Jet Barkod jetonunu biz aramıyoruz. Kullanıcı jetbarkod.com.tr'ye
 * girdiğinde site köprüsü jetonu ve kullanıcı adını buraya aktarıyor
 * (JBA_SIPARIS_YETKI). Saklanan jeton yalnız kendi API'mize gidiyor.
 * Jeton yoksa hiçbir istek atılmıyor, sessizce bekleniyor.
 *
 * SIRA VE HIZ
 * Siparişler tek tek, aralarında bekleme ile yazılıyor. Aynı sipariş
 * değişmediyse tekrar yazılmıyor; imza karşılaştırması bunun için.
 *
 * MÜŞTERİ VERİSİ
 * Panelin detay yanıtı `clientName` ve `clientNote` taşıyor. Bunlar hiçbir
 * yere yazılmıyor, gövdeye hiç girmiyor.
 * ============================================================================
 */

const SIPARIS_API = 'https://api.flowcobalt.com';
const SIPARIS_ARA_MS = 400;
const YETKI_ANAHTARI = 'jbaSiparisYetki';
const IMZA_ANAHTARI = 'jbaSiparisImzalari';

let siparisKuyrugu = [];
let siparisIsliyor = false;

// ==================================================================
// Yetki
// ==================================================================

async function yetkiOku() {
    try {
        const r = await chrome.storage.local.get(YETKI_ANAHTARI);
        const y = r && r[YETKI_ANAHTARI];
        if (y && y.token && y.username) return y;
    } catch (e) { /* sessiz */ }
    return null;
}

async function yetkiYaz(token, username) {
    const y = { token: String(token || ''), username: String(username || ''), zaman: Date.now() };
    if (!y.token || !y.username) return false;
    try {
        await chrome.storage.local.set({ [YETKI_ANAHTARI]: y });
        return true;
    } catch (e) {
        return false;
    }
}

// ==================================================================
// İmza: aynı siparişi boşuna tekrar yazma
// ==================================================================

async function imzalariOku() {
    try {
        const r = await chrome.storage.local.get(IMZA_ANAHTARI);
        return (r && r[IMZA_ANAHTARI]) || {};
    } catch (e) {
        return {};
    }
}

async function imzalariYaz(imzalar) {
    // Sınırsız büyümesin; en yeni iki yüz sipariş yeter.
    const anahtarlar = Object.keys(imzalar);
    if (anahtarlar.length > 200) {
        const kirp = {};
        anahtarlar.slice(-200).forEach((k) => { kirp[k] = imzalar[k]; });
        imzalar = kirp;
    }
    try { await chrome.storage.local.set({ [IMZA_ANAHTARI]: imzalar }); } catch (e) { /* sessiz */ }
}

function siparisImzasi(s) {
    const urun = (s.urunler || [])
        .map((u) => u.sira + ':' + u.adet + ':' + (u.ad || ''))
        .join('|');
    return [s.durum, s.banko, s.toplamAdet, s.posetSayisi, s.toplayici, s.kurye,
            s.toplayiciFoto, s.kuryeFoto, urun].join('~');
}

// ==================================================================
// PostgREST
// ==================================================================

function apiBasliklari(yetki, ekstra) {
    const h = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + yetki.token
    };
    if (ekstra) Object.keys(ekstra).forEach((k) => { h[k] = ekstra[k]; });
    return h;
}

async function siparisYaz(yetki, s) {
    const govde = {
        username: yetki.username,
        order_id: s.siparisId,
        banko: s.banko || null,
        kolon: s.kolon || null,
        durum: typeof s.durum === 'number' ? s.durum : null,
        toplam_adet: typeof s.toplamAdet === 'number' ? s.toplamAdet : null,
        poset_sayisi: typeof s.posetSayisi === 'number' ? s.posetSayisi : null,
        eksik_urun_var: !!s.eksikUrunVar,
        toplayici: s.toplayici || null,
        kurye: s.kurye || null,
        toplayici_foto: s.toplayiciFoto || null,
        kurye_foto: s.kuryeFoto || null,
        sepet_zamani: s.sepetZamani || null,
        updated_at: new Date().toISOString()
    };

    const yanit = await fetch(
        SIPARIS_API + '/rest/v1/orders?on_conflict=username,order_id',
        {
            method: 'POST',
            headers: apiBasliklari(yetki, {
                'Prefer': 'resolution=merge-duplicates,return=representation'
            }),
            body: JSON.stringify([govde])
        }
    );

    const metin = await yanit.text();
    if (!yanit.ok) throw new Error('orders ' + yanit.status + ': ' + metin.slice(0, 160));

    let satir = null;
    try { satir = JSON.parse(metin)[0]; } catch (e) { /* sessiz */ }
    if (!satir || !satir.id) throw new Error('orders: kimlik dönmedi');
    return satir.id;
}

async function satirlariYaz(yetki, siparisUuid, urunler) {
    if (!urunler.length) return;

    const govde = urunler.map((u) => ({
        order_uuid: siparisUuid,
        sira: u.sira,
        urun_id: u.urunId || null,
        urun_adi: u.ad || null,
        gorsel_id: u.gorsel || null,
        adet: typeof u.adet === 'number' ? u.adet : 1,
        birim: u.birim || null,
        ana_kategori: u.anaKategori || null,
        sinif: u.sinif || null,
        alt_sinif: u.altSinif || null
    }));

    const yanit = await fetch(
        SIPARIS_API + '/rest/v1/order_items?on_conflict=order_uuid,sira',
        {
            method: 'POST',
            headers: apiBasliklari(yetki, {
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            }),
            body: JSON.stringify(govde)
        }
    );

    if (!yanit.ok) {
        const metin = await yanit.text();
        throw new Error('order_items ' + yanit.status + ': ' + metin.slice(0, 160));
    }
}

/**
 * Yalnız kolon bilgisini günceller.
 *
 * Sipariş gövdesi bir kez yazılıyor (kullanıcı karta girdiğinde) ve orada
 * kalıyordu. Sipariş panelde "Hazırlandı"dan "El Değiştiriliyor"a geçince
 * bizim kaydımız eskiyordu; Jet Barkod'da bitmiş siparişler listede
 * duruyordu. Panel listesi zaten elimizde, Getir'e ek istek gitmiyor;
 * yalnız değişen kolonlar için küçük bir PATCH atılıyor.
 *
 * Kaydı olmayan sipariş için PATCH hiçbir satır bulmuyor, zararsız.
 */
/* Kurye alıp gittiyse kayıt yer kaplamasın. "El değiştiriliyor" değil:
   kurye o aşamada hâlâ depoda olabiliyor, sipariş kapananlarda dursun.
   `order_items` foreign key'de ON DELETE CASCADE, ürün satırları
   siparişle birlikte gidiyor. */
const GIDEN_KOLON = /(teslim|iptal|tamamlan|ulast)/i;

const ESKIME_MS = 3 * 60 * 60 * 1000;

function gitmisMi(s) {
    var k = String(s && s.kolon || '').toLocaleLowerCase('tr').replace(/ş/g, 's').replace(/ı/g, 'i');
    if (GIDEN_KOLON.test(k)) return true;
    var t = s && (s.sepetZamani || s.sepet_zamani);
    if (!t) return false;
    var ms = Date.now() - new Date(t).getTime();
    return isFinite(ms) && ms > ESKIME_MS;
}

async function siparisSil(yetki, siparisId) {
    const adres = SIPARIS_API + '/rest/v1/orders' +
        '?username=eq.' + encodeURIComponent(yetki.username) +
        '&order_id=eq.' + encodeURIComponent(siparisId);
    try {
        const yanit = await fetch(adres, {
            method: 'DELETE',
            headers: apiBasliklari(yetki, { 'Prefer': 'return=minimal' })
        });
        return yanit.ok;
    } catch (e) {
        return false;
    }
}

async function kunyeYaz(yetki, liste) {
    for (let i = 0; i < liste.length; i++) {
        const s = liste[i];
        if (!s || !s.siparisId) continue;

        /* Gitmişse güncellemeye gerek yok, siliniyor. İmzası da düşüyor ki
           aynı sipariş bir daha panelde görünürse yeniden yazılabilsin. */
        if (gitmisMi(s)) {
            await siparisSil(yetki, s.siparisId);
            const imzalar = await imzalariOku();
            if (imzalar[s.siparisId]) {
                delete imzalar[s.siparisId];
                await imzalariYaz(imzalar);
            }
            if (i < liste.length - 1) await bekle(SIPARIS_ARA_MS);
            continue;
        }

        const adres = SIPARIS_API + '/rest/v1/orders' +
            '?username=eq.' + encodeURIComponent(yetki.username) +
            '&order_id=eq.' + encodeURIComponent(s.siparisId);

        /* Ürün satırları burada yazılmıyor: onlar yalnız detay çekilince
           değişiyor, künye ise panelde sürekli oynuyor (banko atanıyor,
           toplayıcı değişiyor, kolon ilerliyor). */
        const govde = {
            kolon: s.kolon || null,
            durum: typeof s.durum === 'number' ? s.durum : null,
            updated_at: new Date().toISOString()
        };
        if (s.banko) govde.banko = s.banko;
        if (s.toplayici) govde.toplayici = s.toplayici;
        if (s.kurye) govde.kurye = s.kurye;
        if (s.toplayiciFoto) govde.toplayici_foto = s.toplayiciFoto;
        if (s.kuryeFoto) govde.kurye_foto = s.kuryeFoto;
        if (typeof s.toplamAdet === 'number') govde.toplam_adet = s.toplamAdet;
        if (typeof s.posetSayisi === 'number') govde.poset_sayisi = s.posetSayisi;

        try {
            const yanit = await fetch(adres, {
                method: 'PATCH',
                headers: apiBasliklari(yetki, { 'Prefer': 'return=minimal' }),
                body: JSON.stringify(govde)
            });
            if (yanit.status === 401) break;
        } catch (e) { /* ağ yoksa sonraki listede yine denenir */ }

        if (i < liste.length - 1) await bekle(SIPARIS_ARA_MS);
    }
}

/* Panelde artık olmayan siparişleri DB'den siler. Eklenti paneldeki
   tüm sipariş kimliklerini gönderir; DB'de olup panelde olmayan ve
   20 dakikadan eski kayıtlar temizlenir. Böylece panel ile DB
   birebir eşleşir. */
const TEMIZLIK_MS = 20 * 60 * 1000;
let sonTemizlik = 0;
const TEMIZLIK_ARALIK = 2 * 60 * 1000;

async function paneldeOlmayanlariSil(yetki, panelIdleri) {
    if (!panelIdleri.length) return;
    if (Date.now() - sonTemizlik < TEMIZLIK_ARALIK) return;
    sonTemizlik = Date.now();

    const adres = SIPARIS_API + '/rest/v1/orders' +
        '?username=eq.' + encodeURIComponent(yetki.username) +
        '&select=order_id,sepet_zamani';
    try {
        const yanit = await fetch(adres, { headers: apiBasliklari(yetki) });
        if (!yanit.ok) return;
        const dbListe = await yanit.json();
        const panelSet = new Set(panelIdleri);
        for (const s of dbListe) {
            if (panelSet.has(s.order_id)) continue;
            var t = s.sepet_zamani;
            if (t) {
                var ms = Date.now() - new Date(t).getTime();
                if (isFinite(ms) && ms < TEMIZLIK_MS) continue;
            }
            await siparisSil(yetki, s.order_id);
            await bekle(SIPARIS_ARA_MS);
        }
    } catch (e) { /* sessiz */ }
}

// ==================================================================
// Kuyruk
// ==================================================================

function bekle(ms) {
    return new Promise((c) => setTimeout(c, ms));
}


async function kuyrugaAl(siparisler) {
    if (!Array.isArray(siparisler) || !siparisler.length) return { ok: false, sebep: 'liste boş' };

    const yetki = await yetkiOku();
    if (!yetki) return { ok: false, sebep: 'yetki yok' };

    const imzalar = await imzalariOku();
    let eklenen = 0;

    siparisler.forEach((s) => {
        if (!s || !s.siparisId) return;
        const imza = siparisImzasi(s);
        if (imzalar[s.siparisId] === imza) return;
        // Kuyrukta aynı sipariş varsa yenisiyle değiştir.
        const yer = siparisKuyrugu.findIndex((x) => x.siparisId === s.siparisId);
        if (yer > -1) siparisKuyrugu[yer] = s;
        else siparisKuyrugu.push(s);
        eklenen++;
    });

    if (eklenen && !siparisIsliyor) kuyrugaBak();
    return { ok: true, eklenen: eklenen, kuyruk: siparisKuyrugu.length };
}

async function kuyrugaBak() {
    if (siparisIsliyor) return;
    siparisIsliyor = true;

    try {
        while (siparisKuyrugu.length) {
            const yetki = await yetkiOku();
            if (!yetki) break;

            const s = siparisKuyrugu.shift();
            try {
                const uuid = await siparisYaz(yetki, s);
                await satirlariYaz(yetki, uuid, s.urunler || []);

                const imzalar = await imzalariOku();
                imzalar[s.siparisId] = siparisImzasi(s);
                await imzalariYaz(imzalar);
            } catch (e) {
                console.warn('[Jet Barkod] Sipariş yazılamadı:', (e && e.message) || e);
                /* Yetki hatasıysa kuyruğu boşuna döndürmeyelim; jeton
                   yenilenene kadar duruyoruz. */
                if (String((e && e.message) || '').indexOf('401') !== -1) break;
            }

            if (siparisKuyrugu.length) await bekle(SIPARIS_ARA_MS);
        }
    } finally {
        siparisIsliyor = false;
    }
}

// ==================================================================
// Mesajlar
// ==================================================================

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek || typeof istek.type !== 'string') return;

    if (istek.type === 'JBA_SIPARIS_YETKI') {
        yetkiYaz(istek.token, istek.username).then((ok) => cevapla({ ok: ok }));
        return true;
    }

    if (istek.type === 'JBA_SIPARIS_YAZ') {
        kuyrugaAl(istek.siparisler).then(cevapla, (e) =>
            cevapla({ ok: false, sebep: (e && e.message) || 'hata' })
        );
        return true;
    }

    if (istek.type === 'JBA_SIPARIS_KUNYE') {
        const liste = Array.isArray(istek.siparisler) ? istek.siparisler.slice(0, 50) : [];
        const tumIdler = Array.isArray(istek.tumIdler) ? istek.tumIdler : [];
        if (!liste.length && !tumIdler.length) { cevapla({ ok: false, sebep: 'liste boş' }); return true; }
        yetkiOku().then((y) => {
            if (!y) { cevapla({ ok: false, sebep: 'yetki yok' }); return; }
            kunyeYaz(y, liste).then(() => paneldeOlmayanlariSil(y, tumIdler)).then(
                () => cevapla({ ok: true, sayi: liste.length }),
                (e) => cevapla({ ok: false, sebep: (e && e.message) || 'hata' })
            );
        });
        return true;
    }

    /* İçerik betiği "bu siparişler bende kayıtlı mı" diye soruyor. İmza
       kaydı zaten hangi siparişin yazıldığını tutuyor; ek istek atmadan
       cevaplanıyor. Sayfa yenilense de cevap aynı kalıyor, o yüzden aynı
       sipariş ikinci kez çekilmiyor. */
    if (istek.type === 'JBA_SIPARIS_BILINEN') {
        const sorulan = Array.isArray(istek.siparisler) ? istek.siparisler : [];
        imzalariOku().then((imzalar) => {
            cevapla({ ok: true, bilinen: sorulan.filter((id) => !!imzalar[id]) });
        });
        return true;
    }

    if (istek.type === 'JBA_SIPARIS_DURUM') {
        yetkiOku().then((y) =>
            cevapla({ yetkiVar: !!y, kuyruk: siparisKuyrugu.length, isliyor: siparisIsliyor })
        );
        return true;
    }
});
