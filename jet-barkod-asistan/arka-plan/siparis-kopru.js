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
    /* UPSERT yalnız DOLU alanları gönderir; kısmi paket (cache-only,
       kunye yok) mevcut DB verisini null'lamaz. sonuçta orders satırı
       kesin oluşur (order_id gerekli), diğer alanlar yavaş yavaş
       birleşir: kunyeYaz kolon/banko/toplayıcı, siparisYaz foto/ürün. */
    const govde = {
        username: yetki.username,
        order_id: s.siparisId,
        updated_at: new Date().toISOString()
    };
    if (s.banko) govde.banko = s.banko;
    if (s.kolon) govde.kolon = s.kolon;
    if (typeof s.durum === 'number') govde.durum = s.durum;
    if (typeof s.toplamAdet === 'number') govde.toplam_adet = s.toplamAdet;
    if (typeof s.posetSayisi === 'number') govde.poset_sayisi = s.posetSayisi;
    if (s.eksikUrunVar !== undefined) govde.eksik_urun_var = !!s.eksikUrunVar;
    if (s.toplayici) govde.toplayici = s.toplayici;
    if (s.kurye) govde.kurye = s.kurye;
    if (s.toplayiciFoto) govde.toplayici_foto = s.toplayiciFoto;
    if (s.kuryeFoto) govde.kurye_foto = s.kuryeFoto;
    if (s.sepetZamani) govde.sepet_zamani = s.sepetZamani;

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
const GIDEN_KOLON = /(teslim|iptal|tamamlan)/i;

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

        /* UPSERT: kayıt yoksa oluştur, varsa güncelle. Önceden PATCH idi,
           yalnız var olan kaydı güncelliyordu ve panelin yeni siparişi
           bize hiç gelmiyordu. Artık Hazırlanıyor'a düşen sipariş anında
           burada beliriyor. Ürünler kullanıcı karta girdiğinde geliyor. */
        const govde = {
            username: yetki.username,
            order_id: s.siparisId,
            banko: s.banko || null,
            kolon: s.kolon || null,
            durum: typeof s.durum === 'number' ? s.durum : null,
            toplayici: s.toplayici || null,
            kurye: s.kurye || null,
            toplam_adet: typeof s.toplamAdet === 'number' ? s.toplamAdet : null,
            poset_sayisi: typeof s.posetSayisi === 'number' ? s.posetSayisi : null,
            updated_at: new Date().toISOString()
        };
        /* Foto YALNIZ doluyken UPSERT'e girsin: panel künyesinde çoğu
           zaman picURL yok, detay yanıtından siparisYaz doğru fotoyu
           yazıyor. Boş fotoyu buradan yazmak o veriyi siler. */
        if (s.toplayiciFoto) govde.toplayici_foto = s.toplayiciFoto;
        if (s.kuryeFoto) govde.kurye_foto = s.kuryeFoto;

        try {
            const yanit = await fetch(
                SIPARIS_API + '/rest/v1/orders?on_conflict=username,order_id',
                {
                    method: 'POST',
                    headers: apiBasliklari(yetki, {
                        'Prefer': 'resolution=merge-duplicates,return=minimal'
                    }),
                    body: JSON.stringify([govde])
                }
            );
            if (yanit.status === 401) break;
        } catch (e) { /* ağ yoksa sonraki listede yine denenir */ }

        if (i < liste.length - 1) await bekle(SIPARIS_ARA_MS);
    }
}

/* ==================================================================
   Panel = tek gerçek kaynak
   ------------------------------------------------------------------
   Getir panelinde o an ne varsa DB'de o olmalı. Panelde olmayan kayıt
   çöptür ve anında gitmeli.

   ESKİ YÖNTEM NEDEN YETMİYORDU
   Her çöp sipariş için ayrı DELETE + storage okuma + storage yazma +
   400 ms bekleme yapılıyordu. 50 kalıntı ≈ 30 saniye. MV3 hizmet işçisi
   o süre dolmadan uyuyabiliyor, döngü yarıda kalıyor ve kalanlar bir
   sonraki tura kalıyordu. Kullanıcı saatler sonra döndüğünde ekranda
   50 tane teslim edilmiş sipariş görüyordu.

   YENİ YÖNTEM
   Silinecekler tek `order_id=in.(...)` isteğiyle gidiyor. 80'lik
   parçalara bölünüyor ki URL uzunluk sınırına takılmasın. İmzalar tek
   storage yazımıyla temizleniyor. 50 kalıntı ≈ 1 istek, ~200 ms.
   ================================================================== */
let sonTemizlik = 0;
const TEMIZLIK_ARALIK = 8 * 1000;
const SILME_PARCA = 80;

/* PostgREST `in.(...)` listesine yalnız güvenli kimlikler giriyor.
   Getir'in sipariş kimliği hex; virgül/parantez taşıyan bir değer
   sorguyu bozabilir, o yüzden desen dışındakiler atlanıyor. */
function guvenliKimlik(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(id);
}

/* ÇOK CİHAZ KORUMASI
   Aynı hesapla iki yerde panel açık olabiliyor: depoda sürekli açık duran
   bilgisayar ve evde deneme yapılan ikinci makine. İkisi de aynı
   veritabanına yazıp siliyor.

   Tehlike şu: ikinci makinede panel henüz çizilmemişken "panelde sipariş
   yok" kararı verilirse, birinci makinenin taze kayıtları silinir.

   Eşik YALNIZ "panel tamamen boş" dalında uygulanıyor. Panel doluyken
   zaten kimlik karşılaştırması var: panelde duran sipariş silinmiyor,
   panelden düşen anında siliniyor. Oraya da tazelik eşiği koysaydık
   teslim edilen sipariş eşik süresi kadar ekranda kalırdı; kullanıcının
   açıkça istemediği şey bu.

   Boş panel kararı ise geri dönüşü olmayan bir silme başlattığı için
   ek koruma hak ediyor. Nabız aralığından geniş tutuluyor ki aktif
   cihazın kayıtları iki nabız arasında yanlışlıkla eskimiş sayılmasın. */
const CANLI_ESIK_MS = 90 * 1000;

function tazelikSuzgeci() {
    const sinir = new Date(Date.now() - CANLI_ESIK_MS).toISOString();
    return '&updated_at=lt.' + encodeURIComponent(sinir);
}

/* NABIZ
   `kunyeYaz` yalnız DEĞİŞEN siparişi yazıyor. Panelde öylece duran ama
   künyesi oynamayan bir sipariş dakikalarca `updated_at` almıyordu. Bu
   iki yerde yanlış sonuç veriyor:

   1. Tazelik süzgeci onu "eski" sayıp başka cihazın silmesine izin verir.
   2. Site başlığındaki canlılık göstergesi verinin donduğunu sanıp
      haksız yere "bağlantı kesik" der.

   Bu yüzden panelde duran bütün siparişlerin damgası tek PATCH ile
   tazeleniyor. Dakikada bir yeterli; künye akışının kendisi zaten 20
   saniyede bir dönüyor. */
let sonNabiz = 0;
const NABIZ_ARALIK = 60 * 1000;

async function nabizAt(yetki, panelIdleri) {
    const idler = panelIdleri.filter(guvenliKimlik);
    if (!idler.length) return;
    if (Date.now() - sonNabiz < NABIZ_ARALIK) return;
    sonNabiz = Date.now();

    for (let i = 0; i < idler.length; i += SILME_PARCA) {
        const parca = idler.slice(i, i + SILME_PARCA);
        const adres = SIPARIS_API + '/rest/v1/orders' +
            '?username=eq.' + encodeURIComponent(yetki.username) +
            '&order_id=in.(' + parca.join(',') + ')';
        try {
            await fetch(adres, {
                method: 'PATCH',
                headers: apiBasliklari(yetki, { 'Prefer': 'return=minimal' }),
                body: JSON.stringify({ updated_at: new Date().toISOString() })
            });
        } catch (e) { /* ağ yoksa bir sonraki turda */ }
        if (i + SILME_PARCA < idler.length) await bekle(SIPARIS_ARA_MS);
    }
}

async function paneliSenkronla(yetki, panelIdleri, panelBos, zorla) {
    /* Panel boşsa (panelBos true) idler dizisi boş olsa da temizlik
       yapılır: DB'deki tüm kayıtlar gider. Aksi hâlde en az bir id
       gerekli, yoksa panel okunamamış demektir ve dokunmuyoruz. */
    if (!panelIdleri.length && !panelBos) return;
    if (!zorla && Date.now() - sonTemizlik < TEMIZLIK_ARALIK) return;
    sonTemizlik = Date.now();

    const temel = SIPARIS_API + '/rest/v1/orders' +
        '?username=eq.' + encodeURIComponent(yetki.username);

    try {
        /* Panel tamamen boş: tek istekte hepsini sil. Tazelik süzgeci
           burada da geçerli, yoksa ikinci makine birincinin işini siler.
           İmza defteri yalnız gerçekten hiç kayıt kalmadıysa sıfırlanır. */
        if (!panelIdleri.length) {
            const hepsi = await fetch(temel + tazelikSuzgeci(), {
                method: 'DELETE',
                headers: apiBasliklari(yetki, { 'Prefer': 'return=minimal' })
            });
            if (hepsi.ok) {
                const kalan = await fetch(temel + '&select=order_id&limit=1',
                    { headers: apiBasliklari(yetki) });
                if (kalan.ok) {
                    const k = await kalan.json();
                    if (!k.length) await imzalariYaz({});
                }
            }
            return;
        }

        /* Panel dolu: kimlik karşılaştırması yeterli. Panelde olmayan
           anında gidiyor, tazelik eşiği burada devrede değil. */
        const yanit = await fetch(temel + '&select=order_id', { headers: apiBasliklari(yetki) });
        if (!yanit.ok) return;
        const dbListe = await yanit.json();
        const panelSet = new Set(panelIdleri);
        const silinecek = dbListe
            .map((s) => s && s.order_id)
            .filter((id) => guvenliKimlik(id) && !panelSet.has(id));
        if (!silinecek.length) return;

        const silinen = [];
        for (let i = 0; i < silinecek.length; i += SILME_PARCA) {
            const parca = silinecek.slice(i, i + SILME_PARCA);
            const adres = temel + '&order_id=in.(' + parca.join(',') + ')';
            const cevap = await fetch(adres, {
                method: 'DELETE',
                headers: apiBasliklari(yetki, { 'Prefer': 'return=minimal' })
            });
            if (cevap.ok) parca.forEach((id) => silinen.push(id));
            if (i + SILME_PARCA < silinecek.length) await bekle(SIPARIS_ARA_MS);
        }

        /* İmzalar tek okuma-yazma turunda temizleniyor; silinen sipariş
           tekrar panele düşerse ürünleriyle yeniden yazılabilsin. */
        if (silinen.length) {
            const imzalar = await imzalariOku();
            let degisti = false;
            silinen.forEach((id) => {
                if (imzalar[id]) { delete imzalar[id]; degisti = true; }
            });
            if (degisti) await imzalariYaz(imzalar);
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
        const panelBos = !!istek.panelBos;
        /* `zorla`: panel sayfası yeni açıldı ya da sekmeye geri dönüldü.
           8 saniyelik temizlik kilidini atlayıp hemen tam senkron yapıyoruz;
           kullanıcı saatler sonra döndüğünde eski kayıtlar bir an bile
           ekranda kalmasın. */
        const zorla = !!istek.zorla;
        if (!liste.length && !tumIdler.length && !panelBos) { cevapla({ ok: false, sebep: 'liste boş' }); return true; }
        yetkiOku().then((y) => {
            if (!y) { cevapla({ ok: false, sebep: 'yetki yok' }); return; }
            kunyeYaz(y, liste)
                .then(() => nabizAt(y, tumIdler))
                .then(() => paneliSenkronla(y, tumIdler, panelBos, zorla))
                .then(
                () => cevapla({ ok: true, sayi: liste.length }),
                (e) => cevapla({ ok: false, sebep: (e && e.message) || 'hata' })
            );
        });
        return true;
    }

    /* Jet Barkod sitesi "şu siparişlerin ürünleri gelmemiş" diyor.
       İsteği açık depo paneli sekmelerine iletiyoruz; oradaki eklenti
       o siparişleri kuyruğun başına alıp detayını çekiyor.

       Site telefonda ya da eklentisiz bir bilgisayarda açık olabilir;
       orada Getir'e istek atma imkânı yok. Bu köprü sayesinde iş, depo
       panelinin açık olduğu makinede yapılıp sonuç veritabanı üzerinden
       bütün cihazlara ulaşıyor. Açık sekme yoksa istek sessizce düşer. */
    if (istek.type === 'JBA_SIPARIS_URUN_EKSIK') {
        const idler = Array.isArray(istek.siparisler) ? istek.siparisler.slice(0, 40) : [];
        if (!idler.length) { cevapla({ ok: false, sebep: 'liste boş' }); return true; }
        try {
            chrome.tabs.query({ url: 'https://warehouse.getir.com/*' }, (sekmeler) => {
                const liste = sekmeler || [];
                liste.forEach((t) => {
                    try {
                        chrome.tabs.sendMessage(t.id, { type: 'JBA_URUN_CEK', siparisler: idler },
                            () => { void chrome.runtime.lastError; });
                    } catch (e) { /* sekme kapanmış olabilir */ }
                });
                cevapla({ ok: true, sekme: liste.length });
            });
        } catch (e) {
            cevapla({ ok: false, sebep: (e && e.message) || 'hata' });
        }
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

    /* SIFIRLAMA
       Panelle veritabanı birbirine girdiğinde kullanılan acil düğme.
       Konsoldan `jbaTazele()` / `jbaSifirla(true)` ile tetikleniyor.

       İmza defteri her hâlükârda siliniyor: defter "bu siparişi zaten
       yazdım" dediği sürece aynı sipariş bir daha yazılmıyor, yani
       karışıklık kendi kendine düzelmiyordu.

       `dbdeSil` ayrı bir karar. Kayıtları silmek depocunun topladığı
       ürün işaretlerini de siler; panelden yeniden kurulan sipariş
       sıfırdan başlar. O yüzden çağıran tarafta ayrıca onay isteniyor. */
    if (istek.type === 'JBA_SIPARIS_SIFIRLA') {
        const dbdeSil = !!istek.dbdeSil;
        (async () => {
            siparisKuyrugu = [];
            siparisIsliyor = false;
            sonTemizlik = 0;
            sonNabiz = 0;
            await imzalariYaz({});
            if (!dbdeSil) return { ok: true, imza: true, db: false };

            const yetki = await yetkiOku();
            if (!yetki) return { ok: false, sebep: 'yetki yok' };
            const adres = SIPARIS_API + '/rest/v1/orders' +
                '?username=eq.' + encodeURIComponent(yetki.username);
            const yanit = await fetch(adres, {
                method: 'DELETE',
                headers: apiBasliklari(yetki, { 'Prefer': 'return=minimal' })
            });
            return { ok: yanit.ok, imza: true, db: true, durum: yanit.status };
        })().then(cevapla, (e) => cevapla({ ok: false, sebep: (e && e.message) || 'hata' }));
        return true;
    }

    if (istek.type === 'JBA_SIPARIS_DURUM') {
        yetkiOku().then((y) =>
            cevapla({ yetkiVar: !!y, kuyruk: siparisKuyrugu.length, isliyor: siparisIsliyor })
        );
        return true;
    }
});
