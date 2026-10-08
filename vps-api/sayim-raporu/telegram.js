/**
 * Sayım raporu: Telegram botu
 *
 * JETON
 * Bot jetonu yalnız sunucunun .env dosyasında (TELEGRAM_RAPOR_BOT_TOKEN).
 * Tarayıcıya, veritabanına ve loga hiçbir zaman çıkmıyor: hata metinleri
 * dışarı verilmeden önce jetondan temizleniyor.
 *
 * BAĞLAMA
 * Kullanıcı kimlik numarası yazmıyor. Site tek kullanımlık bir kod üretip
 * t.me/<bot>?start=<kod> bağlantısını açıyor; kullanıcı Telegram'da
 * Başlat'a basınca bot /start <kod> mesajını alıyor ve sohbet kimliğini
 * o hesaba yazıyor. Kodu yalnız siteye girmiş kişi görebildiği için
 * başkasının sohbetine rapor yönlendirmek mümkün değil.
 *
 * GÜNCELLEMELER
 * Webhook yerine uzun yoklama (getUpdates): sunucuya dışarıdan açılan
 * yeni bir kapı yok. Boşta 50 saniyede bir istek.
 */
'use strict';

const crypto = require('crypto');

const JETON = String(process.env.TELEGRAM_RAPOR_BOT_TOKEN || '').trim();
// Değiştirmek yalnız yerel deneme içindir; canlıda tanımlanmaz
const API = process.env.TELEGRAM_API_KOKU || 'https://api.telegram.org';
const KOD_OMRU_MS = 10 * 60 * 1000;

let botAdi = '';
let calisiyor = false;
let sonGuncelleme = 0;
const kodlar = new Map(); // kod -> { username, bitis }
const yanitSiniri = new Map(); // chat -> son yanıt anı

function hazirMi() {
    return /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(JETON);
}

/** Hata metninden jetonu sil; log ve kullanıcıya giden her şey buradan geçer */
function temizle(metin) {
    let s = String(metin == null ? '' : metin);
    if (JETON) s = s.split(JETON).join('***');
    return s.replace(/bot\d{5,}:[A-Za-z0-9_-]+/g, 'bot***').slice(0, 500);
}

class TelegramHatasi extends Error {
    constructor(kod, aciklama, bekle) {
        super(temizle(aciklama));
        this.kod = kod;
        this.bekle = bekle || 0;
    }
}

/**
 * Bot API çağrısı. JSON ya da FormData gövde.
 * @returns {Promise<any>} result alanı
 */
async function cagir(metod, govde, zamanAsimiMs = 20000) {
    if (!hazirMi()) throw new TelegramHatasi(0, 'bot ayarli degil');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), zamanAsimiMs);
    try {
        const form = typeof FormData !== 'undefined' && govde instanceof FormData;
        const res = await fetch(`${API}/bot${JETON}/${metod}`, {
            method: 'POST',
            headers: form ? undefined : { 'Content-Type': 'application/json' },
            body: form ? govde : JSON.stringify(govde || {}),
            signal: ctrl.signal,
        });
        let veri = null;
        try { veri = await res.json(); } catch (e) { /* gövde yok */ }
        if (!veri || !veri.ok) {
            const bekle = Number(veri?.parameters?.retry_after || 0);
            throw new TelegramHatasi(Number(veri?.error_code || res.status), veri?.description || 'HTTP ' + res.status, bekle);
        }
        return veri.result;
    } catch (e) {
        if (e instanceof TelegramHatasi) throw e;
        throw new TelegramHatasi(0, e.name === 'AbortError' ? 'zaman asimi' : e.message);
    } finally {
        clearTimeout(t);
    }
}

/** Kalıcı hata mı (tekrar denemek boşuna)? */
function kaliciMi(hata) {
    return hata && (hata.kod === 400 || hata.kod === 401 || hata.kod === 403 || hata.kod === 404);
}

// ---------------------------------------------------------------------
// Bağlama kodları
// ---------------------------------------------------------------------
function kodUret(username) {
    const simdi = Date.now();
    for (const [k, v] of kodlar) {
        if (v.bitis < simdi || v.username === username) kodlar.delete(k);
    }
    // Bellek tavanı: binlerce kod birikemesin
    if (kodlar.size > 5000) kodlar.clear();
    const kod = crypto.randomBytes(18).toString('base64url');
    kodlar.set(kod, { username, bitis: simdi + KOD_OMRU_MS });
    return { kod, bitis: simdi + KOD_OMRU_MS };
}

function koduKullan(kod) {
    const v = kodlar.get(kod);
    if (!v) return null;
    kodlar.delete(kod);
    return v.bitis >= Date.now() ? v.username : null;
}

function baglantiAdresi(kod) {
    return botAdi ? `https://t.me/${botAdi}?start=${kod}` : '';
}

// ---------------------------------------------------------------------
// Mesajlar
// ---------------------------------------------------------------------
async function mesaj(chatId, metin) {
    return cagir('sendMessage', { chat_id: chatId, text: metin, disable_web_page_preview: true });
}

/** Aynı sohbete 5 saniyeden sık kendiliğinden yanıt verme */
function yanitlayabilirMi(chatId) {
    const simdi = Date.now();
    const son = yanitSiniri.get(chatId) || 0;
    if (simdi - son < 5000) return false;
    yanitSiniri.set(chatId, simdi);
    if (yanitSiniri.size > 5000) yanitSiniri.clear();
    return true;
}

/**
 * Uzun yoklama döngüsü.
 * @param {(arg:{username:string, chatId:number, ad:string, kullaniciAdi:string})=>Promise<boolean>} baglan
 */
async function dinle(baglan) {
    if (!hazirMi() || calisiyor) return;
    calisiyor = true;
    try {
        const ben = await cagir('getMe', {});
        botAdi = String(ben.username || '');
        // Önceden webhook kurulduysa getUpdates 409 döner
        await cagir('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
        console.log('rapor botu hazir: @' + botAdi);
    } catch (e) {
        calisiyor = false;
        console.error('rapor botu acilamadi:', temizle(e.message));
        setTimeout(() => dinle(baglan), 60000).unref();
        return;
    }

    let bekleme = 1000;
    for (;;) {
        try {
            const guncel = await cagir(
                'getUpdates',
                { offset: sonGuncelleme + 1, timeout: 50, allowed_updates: ['message'] },
                65000
            );
            bekleme = 1000;
            for (const g of guncel) {
                sonGuncelleme = Math.max(sonGuncelleme, g.update_id);
                await isle(g.message, baglan).catch((e) => console.warn('bot mesaji islenemedi:', temizle(e.message)));
            }
        } catch (e) {
            console.warn('getUpdates:', temizle(e.message));
            await new Promise((r) => setTimeout(r, bekleme));
            bekleme = Math.min(bekleme * 2, 60000);
        }
    }
}

async function isle(m, baglan) {
    if (!m || !m.chat || m.chat.type !== 'private' || typeof m.text !== 'string') return;
    const chatId = m.chat.id;
    const metin = m.text.trim();
    const eslesme = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{16,64})$/.exec(metin);

    if (eslesme) {
        const username = koduKullan(eslesme[1]);
        if (!username) {
            if (yanitlayabilirMi(chatId)) {
                await mesaj(chatId, 'Bu bağlantının süresi dolmuş. Jet Barkod\'da Sayım > Finans > Sayım Raporu ekranından "Telegram\'ı bağla" düğmesine yeniden basın.');
            }
            return;
        }
        const ad = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ').slice(0, 120);
        const sonuc = await baglan({
            username,
            chatId,
            ad,
            kullaniciAdi: String(m.from?.username || '').slice(0, 64),
        });
        if (sonuc === 'sinir') {
            await mesaj(chatId, 'Bu Jet Barkod hesabına en fazla 5 Telegram hesabı bağlanabilir. Önce Jet Barkod\'dan birini kaldırın.');
        } else if (sonuc) {
            await mesaj(chatId, `Bağlandı. Jet Barkod hesabınız (${username}) için sayım raporları artık buraya da gelecek.`);
        }
        return;
    }

    if (yanitlayabilirMi(chatId)) {
        await mesaj(chatId, 'Bu bot Jet Barkod sayım raporlarını PDF olarak gönderir.\n\nBağlamak için: Jet Barkod > Sayım > Finans > Sayım Raporu > "Telegram\'ı bağla".');
    }
}

/**
 * Gönderilmiş bir dosyayı Telegram'dan geri indir (sitede görüntülemek için).
 * Bot API en fazla 20 MB veriyor; bizim dosyalar 2 MB'ın altında.
 */
async function dosyaIndir(dosyaId) {
    const f = await cagir('getFile', { file_id: dosyaId });
    if (!f || !f.file_path || !/^[A-Za-z0-9_./-]{1,200}$/.test(f.file_path)) throw new TelegramHatasi(404, 'dosya yok');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
        const res = await fetch(`${API}/file/bot${JETON}/${f.file_path}`, { signal: ctrl.signal });
        if (!res.ok) throw new TelegramHatasi(res.status, 'HTTP ' + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 20 * 1024 * 1024) throw new TelegramHatasi(413, 'dosya cok buyuk');
        return buf;
    } catch (e) {
        if (e instanceof TelegramHatasi) throw e;
        throw new TelegramHatasi(0, e.name === 'AbortError' ? 'zaman asimi' : e.message);
    } finally {
        clearTimeout(t);
    }
}

function botBilgisi() {
    return { hazir: hazirMi() && !!botAdi, ad: botAdi };
}

module.exports = {
    hazirMi,
    cagir,
    mesaj,
    kaliciMi,
    kodUret,
    baglantiAdresi,
    dinle,
    botBilgisi,
    dosyaIndir,
    temizle,
    TelegramHatasi,
};
