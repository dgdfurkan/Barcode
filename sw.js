/**
 * Jet Barkod service worker
 * ============================================================================
 *
 * Amaç: sayfalar telefonda uygulama gibi açılsın.
 *
 * Site GitHub Pages'te ve oradaki önbellek 10 dakika. Süre dolunca her
 * yenilemede otuza yakın betik sunucuya tek tek soruluyordu; telefonda ilk
 * boya 2,5 saniyeyi buluyordu. Dosyaların çoğu zaten sürümlü (`?v=...`):
 * sürüm değişince adres de değişiyor. Bu yüzden sürümlü dosya güvenle
 * telefonda saklanabilir.
 *
 *   Sayfa (HTML)          Önce ağ. Ağ 4 saniyede gelmezse son kopya açılır.
 *                         Yeni sürüm her zaman ağdan gelir.
 *   Sürümlü dosya         Önbellekten. Yoksa ağdan alınır, saklanır; aynı
 *                         dosyanın eski sürümleri silinir.
 *   Sürümsüz yerel dosya  Önbellekten anında, arkada tazelenir.
 *   Başka alan adı        Hiç dokunulmaz (API, ürün görselleri, eklenti).
 *
 * KAPATMAK GEREKİRSE: bu dosyanın içini yalnız şu satırla değiştirip yayınla:
 *   self.addEventListener('install',()=>self.skipWaiting());
 *   self.addEventListener('activate',e=>e.waitUntil(caches.keys()
 *     .then(a=>Promise.all(a.map(k=>caches.delete(k))))
 *     .then(()=>self.registration.unregister())));
 * ============================================================================
 */
'use strict';

const SURUM = 'jb-1';
const SAYFA = SURUM + '-sayfa';
const DOSYA = SURUM + '-dosya';
const SAYFA_BEKLEME_MS = 4000;
const DOSYA_UZANTILARI = /\.(js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|ico|json)$/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const adlar = await caches.keys();
        await Promise.all(
            adlar
                .filter((ad) => ad.startsWith('jb-') && ad !== SAYFA && ad !== DOSYA)
                .map((ad) => caches.delete(ad))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (e) => {
    const istek = e.request;
    if (istek.method !== 'GET') return;
    if (istek.headers.has('range')) return;

    const adres = new URL(istek.url);
    if (adres.origin !== self.location.origin) return;
    if (adres.pathname === '/sw.js') return;

    if (istek.mode === 'navigate') {
        e.respondWith(sayfaGetir(e));
        return;
    }
    if (!DOSYA_UZANTILARI.test(adres.pathname)) return;

    e.respondWith(adres.searchParams.has('v') ? surumluGetir(e, adres) : tazeleyerekGetir(e));
});

function zamanAsimi(soz, ms) {
    return new Promise((coz, reddet) => {
        const sayac = setTimeout(() => reddet(new Error('zaman-asimi')), ms);
        soz.then(
            (v) => { clearTimeout(sayac); coz(v); },
            (h) => { clearTimeout(sayac); reddet(h); }
        );
    });
}

async function sayfaGetir(e) {
    const istek = e.request;
    const kutu = await caches.open(SAYFA);
    const ag = fetch(istek).then((yanit) => {
        if (yanit && yanit.ok && yanit.type === 'basic') {
            kutu.put(istek, yanit.clone()).catch(() => {});
        }
        return yanit;
    });
    e.waitUntil(ag.catch(() => {}));

    try {
        return await zamanAsimi(ag, SAYFA_BEKLEME_MS);
    } catch (hata) {
        const eski = await kutu.match(istek, { ignoreSearch: true });
        if (eski) return eski;
        return ag;
    }
}

async function surumluGetir(e, adres) {
    const istek = e.request;
    const kutu = await caches.open(DOSYA);
    const var_ = await kutu.match(istek);
    if (var_) return var_;

    const yanit = await fetch(istek);
    if (yanit && yanit.ok && yanit.type === 'basic') {
        const kopya = yanit.clone();
        e.waitUntil((async () => {
            await kutu.put(istek, kopya);
            // Aynı dosyanın eski sürümleri yer kaplamasın
            const anahtarlar = await kutu.keys();
            await Promise.all(anahtarlar.map((k) => {
                const a = new URL(k.url);
                return a.pathname === adres.pathname && a.search !== adres.search
                    ? kutu.delete(k)
                    : null;
            }));
        })().catch(() => {}));
    }
    return yanit;
}

async function tazeleyerekGetir(e) {
    const istek = e.request;
    const kutu = await caches.open(DOSYA);
    const var_ = await kutu.match(istek);
    const ag = fetch(istek).then((yanit) => {
        if (yanit && yanit.ok && yanit.type === 'basic') {
            kutu.put(istek, yanit.clone()).catch(() => {});
        }
        return yanit;
    });
    if (var_) {
        e.waitUntil(ag.catch(() => {}));
        return var_;
    }
    return ag;
}
