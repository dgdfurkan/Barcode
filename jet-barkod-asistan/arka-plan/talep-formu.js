/**
 * Mal Kabul Talebi: Jet Barkod'da hazırlanan talebi Depo Talep Merkezi'ne taşır
 * ============================================================================
 *
 * Jet Barkod > Yardımcılar > Mal Kabul Talepleri'nde "Talep Formunda Hazırla"ya
 * basılınca site köprüsü `JBA_TALEP_DOLDUR` gönderir. Taslak saklanır, Depo
 * Talep Merkezi'nin (getir2.my.site.com) talep formu yan sekmede açılır ve
 * sayfa yüklenince form doldurulur: Departman, Domain, Telefon, Tedarik
 * Kategorisi, Alt Kategori, Palet Barkodu, Transfer ID, Ürün Barkodu,
 * Araç Plakası, Açıklama.
 *
 * GÖNDER'e ASLA basılmaz. Kullanıcı formu görür, isterse düzeltir, kendisi
 * gönderir. Getir'e istek atılmaz; yalnız sekme açılır ve form alanlarına
 * yazılır. Katalogda olmayan ürünün adı açık depo paneli sekmesine sorulur.
 * ============================================================================
 */

const TALEP_TASLAK = 'jbaTalepTaslak';
const TALEP_ADRES = 'https://getir2.my.site.com/Depo/s/flow/Depo_Talep_Formu_ForCommunityUsers';
const TALEP_ALT = [
    'Palet Mal Kabulü Yapılamaması', 'Transfer Dışı Gelen Ürün', 'Palet Kalite/Hasar Problemleri',
    'Merkez Depo İrsaliye Problemleri', 'Hatalı Teslimat', 'Birleştirilmiş Palet'
];
const TALEP_DOMAIN = ['Getir10/GetirBüyük', 'GetirSu'];

const kes = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function talepTemizle(m) {
    const t = m && m.taslak && typeof m.taslak === 'object' ? m.taslak : {};
    const alt = TALEP_ALT.indexOf(t.alt) !== -1 ? t.alt : '';
    const taslak = {
        alt,
        domain: TALEP_DOMAIN.indexOf(t.domain) !== -1 ? t.domain : TALEP_DOMAIN[0],
        telefon: kes(t.telefon, 20).replace(/[^\d+ ]/g, ''),
        palet: kes(t.palet, 60),
        transferId: /^[0-9a-f]{24}$/i.test(String(t.transferId || '')) ? String(t.transferId).toLowerCase() : '',
        urunBarkod: kes(t.urunBarkod, 255),
        plaka: kes(t.plaka, 20),
        aciklama: kes(t.aciklama, 4000)
    };
    if (!alt || !taslak.aciklama) return null;
    return taslak;
}

/*
 * Sayfanın kendi dünyasında çalışır (chrome.scripting, world: MAIN). Kendi
 * başına yeterli olmalı: dışarıdaki hiçbir değişkeni göremez.
 * Akış (Salesforce Flow) alanları her seçimden sonra yeniden çiziliyor; her
 * adım bir önceki seçimin açtığı alanı bekler.
 */
async function talepFormuDoldur(t) {
    const bekle = (ms) => new Promise((c) => setTimeout(c, ms));
    function derin(kok, sec, out) {
        kok.querySelectorAll(sec).forEach((e) => out.push(e));
        kok.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) derin(e.shadowRoot, sec, out); });
        return out;
    }
    const sade = (s) => String(s || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
    function etiket(e) {
        const kok = e.getRootNode();
        if (e.id && kok.querySelector) {
            const l = kok.querySelector('label[for="' + CSS.escape(e.id) + '"]');
            if (l && sade(l.textContent)) return sade(l.textContent);
        }
        const by = e.getAttribute('aria-labelledby');
        if (by && kok.querySelector) {
            // Salesforce gölge kökte getElementById'yi yasaklıyor; querySelector serbest
            const m = by.split(/\s+/).map((i) => { try { return kok.querySelector('#' + CSS.escape(i)); } catch (e) { return null; } })
                .filter(Boolean).map((x) => x.textContent).join(' ');
            if (sade(m)) return sade(m);
        }
        return sade(e.getAttribute('aria-label') || e.name || '');
    }
    // "Ürün Barkodu" ile alanın adı "UrunBarkodu" aynı sayılsın: etiketi yalnız
    // yıldız olan alanlar var, onlar adından tanınıyor.
    const kat = (s) => sade(s).replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o')
        .replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]/g, '');
    function alan(ad) {
        const a = kat(ad);
        return derin(document, 'select, input, textarea', [])
            .filter((e) => e.type !== 'hidden' && e.type !== 'file')
            .find((e) => kat(etiket(e)) === a || kat(e.name) === a) || null;
    }
    async function alanBekle(ad, ms) {
        const son = Date.now() + (ms || 8000);
        while (Date.now() < son) {
            const e = alan(ad);
            if (e) return e;
            await bekle(150);
        }
        return null;
    }
    const olay = (e, tur) => e.dispatchEvent(new Event(tur, { bubbles: true, composed: true }));
    async function sec(ad, metin) {
        const s = await alanBekle(ad);
        if (!s || s.tagName !== 'SELECT') return false;
        const o = [...s.options].find((x) => sade(x.text) === sade(metin));
        if (!o) return false;
        if (s.value !== o.value) {
            s.value = o.value;
            olay(s, 'change');
            await bekle(400);
        }
        return true;
    }
    async function yaz(ad, deger) {
        if (!deger) return true;
        const e = await alanBekle(ad, 4000);
        if (!e) return false;
        e.focus();
        e.value = deger;
        olay(e, 'input');
        olay(e, 'change');
        e.blur();
        return true;
    }

    const eksik = [];
    if (!(await alanBekle('Departman', 20000))) return { ok: false, metin: 'Talep formu açılmadı.' };
    if (!(await sec('Departman', 'Tedarik'))) eksik.push('Departman');
    if (!(await sec('Domain Nedir', t.domain))) eksik.push('Domain');
    if (!(await sec('Tedarik Kategorisi', 'Merkez Depo Transfer'))) eksik.push('Tedarik Kategorisi');
    if (!(await sec('Tedarik Alt Kategorisi', t.alt))) eksik.push('Alt Kategori');
    await bekle(300);
    if (!(await yaz('Telefon Numarası', t.telefon))) eksik.push('Telefon');
    if (!(await yaz('Palet Barkodu', t.palet))) eksik.push('Palet Barkodu');
    if (!(await yaz('Transfer ID', t.transferId))) eksik.push('Transfer ID');
    if (!(await yaz('Ürün Barkodu', t.urunBarkod))) eksik.push('Ürün Barkodu');
    if (t.plaka && alan('Araç Plakası') && !(await yaz('Araç Plakası', t.plaka))) eksik.push('Araç Plakası');
    if (!(await yaz('Açıklama', t.aciklama))) eksik.push('Açıklama');

    const bos = [];
    if (!t.telefon && alan('Telefon Numarası')) bos.push('telefon');
    if (!t.plaka && alan('Araç Plakası')) bos.push('araç plakası');

    // Kullanıcıya küçük bir not: ne yapıldı, ne kaldı. GÖNDER'e kullanıcı basar.
    try {
        const eski = document.getElementById('jba-talep-not');
        if (eski) eski.remove();
        const n = document.createElement('div');
        n.id = 'jba-talep-not';
        n.setAttribute('role', 'status');
        n.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;max-width:340px;padding:12px 16px;border-radius:12px;' +
            'background:#1e293b;color:#fff;font:13px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 12px 32px rgba(15,23,42,.28)';
        const b = document.createElement('strong');
        b.style.cssText = 'display:block;font-size:13px;margin-bottom:4px';
        b.textContent = eksik.length ? 'Form kısmen dolduruldu' : 'Jet Barkod formu doldurdu';
        const p = document.createElement('span');
        p.textContent = eksik.length
            ? 'Doldurulamayan: ' + eksik.join(', ') + '. Bunları elle seç, sonra GÖNDER\'e bas.'
            : (bos.length ? 'Eksik kalan: ' + bos.join(', ') + '. Yazıp GÖNDER\'e bas.' : 'Kontrol et, sonra GÖNDER\'e bas.');
        const x = document.createElement('button');
        x.type = 'button';
        x.textContent = 'Kapat';
        x.style.cssText = 'display:block;margin-top:8px;padding:4px 12px;border:0;border-radius:9px;background:rgba(255,255,255,.14);color:#fff;font:inherit;cursor:pointer';
        x.addEventListener('click', () => n.remove());
        n.append(b, p, x);
        document.body.appendChild(n);
    } catch (e) { /* not çizilemedi */ }
    return { ok: eksik.length === 0, eksik, bos };
}

const talepBekleyen = new Map();   // sekme kimliği → taslak

async function talepEnjekte(sekmeId, taslak) {
    try {
        const s = await chrome.scripting.executeScript({ target: { tabId: sekmeId }, world: 'MAIN', func: talepFormuDoldur, args: [taslak] });
        return (s && s[0] && s[0].result) || null;
    } catch (e) {
        return null;
    }
}

chrome.tabs.onUpdated.addListener((sekmeId, degisim, sekme) => {
    if (degisim.status !== 'complete' || !talepBekleyen.has(sekmeId)) return;
    if (!/^https:\/\/getir2\.my\.site\.com\/Depo\/s\/flow\/Depo_Talep_Formu/.test((sekme && sekme.url) || '')) return;
    const taslak = talepBekleyen.get(sekmeId);
    talepBekleyen.delete(sekmeId);
    talepEnjekte(sekmeId, taslak);
});
chrome.tabs.onRemoved.addListener((sekmeId) => { talepBekleyen.delete(sekmeId); });

async function talepAc(m, gonderen) {
    const taslak = talepTemizle(m);
    if (!taslak) return { ok: false, metin: 'Taslak eksik.' };
    await chrome.storage.local.set({ [TALEP_TASLAK]: { ...taslak, zaman: Date.now() } });
    let sekme;
    try {
        const yer = gonderen && gonderen.tab;
        sekme = await chrome.tabs.create({
            url: TALEP_ADRES,
            active: true,
            ...(yer ? { index: yer.index + 1, windowId: yer.windowId, openerTabId: yer.id } : {})
        });
    } catch (e) {
        return { ok: false, metin: 'Talep formu açılamadı.' };
    }
    talepBekleyen.set(sekme.id, taslak);
    return { ok: true, metin: 'Talep formu açıldı, dolduruluyor.' };
}

/*
 * Katalogda olmayan ürünlerin adı ve barkodu: açık depo paneli sekmesine
 * sorulur (moduller/depo-jeton.js → sayfa köprüsü → POST /products/filter-by-id,
 * panelin Transfer Teslimat detayında attığı istek). Sekme yoksa sayfa elle
 * girdi ister.
 */
async function urunBilgisi(m) {
    const idler = (Array.isArray(m && m.idler) ? m.idler : []).map(String).filter((i) => /^[a-f0-9]{24}$/i.test(i)).slice(0, 100);
    if (!idler.length) return { ok: true, urunler: [] };
    let sekmeler = [];
    try {
        sekmeler = (await chrome.tabs.query({ url: 'https://warehouse.getir.com/*' }))
            .filter((t) => t.status === 'complete' && !t.discarded);
    } catch (e) { sekmeler = []; }
    if (!sekmeler.length) return { ok: false, sebep: 'Depo paneli bu bilgisayarda açık değil.' };
    let sebep = 'Depo paneli cevap vermedi; panel sekmesini yenile.';
    for (const t of sekmeler.slice(0, 3)) {
        let c = null;
        try { c = await chrome.tabs.sendMessage(t.id, { type: 'JBA_URUN_BILGI_SOR', idler }); } catch (e) { c = null; }
        if (c && c.ok && Array.isArray(c.urunler)) return { ok: true, urunler: c.urunler.slice(0, 100) };
        if (c && c.sebep === 'oturum') sebep = 'Depo paneli oturumu bekleniyor; panelde bir sayfa aç.';
    }
    return { ok: false, sebep };
}

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek || istek.type !== 'JBA_URUN_BILGI') return false;
    urunBilgisi(istek).then(cevapla, () => cevapla({ ok: false, sebep: 'Ürün bilgisi okunamadı.' }));
    return true;
});

chrome.runtime.onMessage.addListener((istek, gonderen, cevapla) => {
    if (!istek || istek.type !== 'JBA_TALEP_DOLDUR') return false;
    talepAc(istek, gonderen).then(cevapla, () => cevapla({ ok: false, metin: 'Taslak aktarılamadı.' }));
    return true;
});

