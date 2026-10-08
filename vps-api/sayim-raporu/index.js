/**
 * Sayım raporu: uçlar ve arka plan işçisi
 *
 * AKIŞ
 * 1. Tarayıcı POST /api/rapor/sayim ile isteği bırakır. Sunucu hız
 *    sınırını kontrol edip satırı kuyruğa yazar ve hemen 202 döner.
 * 2. İşçi kuyruğu sırayla işler: sayım satırlarını veritabanından okur,
 *    hesaplar, PDF'i bellekte üretir, Telegram'a gönderir. Kullanıcı
 *    sayfayı kapatsa da iş biter; servis yeniden başlarsa yarım kalan
 *    iş kuyruktan devam eder.
 * 3. PDF diske yazılmaz. Telegram'ın verdiği dosya kimliği saklanır,
 *    "Tekrar gönder" PDF'i yeniden üretmeden o kimlikle gönderir.
 *
 * KÖTÜYE KULLANIM SINIRLARI (kullanıcı başına, veritabanında; servis
 * yeniden başlasa da sıfırlanmaz)
 * - İki istek arası en az 60 saniye
 * - Aynı anda en fazla 1 bekleyen iş
 * - Saatte 20, günde 60 istek. Gerçek kullanımda bu tavana varılmaz;
 *   ama biri her dakika basan bir betik yazsa bile günde 60'ı geçemez.
 * - Bütün kullanıcılar için kuyrukta en fazla 200 iş; işçi tek sıra.
 */
'use strict';

const telegram = require('./telegram');
const katalog = require('./katalog');
const { raporHesapla } = require('./hesap');
const { pdfUret, tabloAdi, tl, adet } = require('./pdf');

const SINIR = {
    araSn: 60,
    saatte: 20,
    gunde: 60,
    kuyruk: 200,
    bagla: 6, // 10 dakikada bağlantı kodu
    istek: 90, // dakikada toplam uç çağrısı
};
const AZAMI_DENEME = 4;
const TAKILMA_DK = 3;

function kur(app, { pool, verifyToken, bearerOf }) {
    // -----------------------------------------------------------------
    // Kimlik: yalnız gerçek hesap (misafir jetonu geçmez), hesap açık olmalı
    // -----------------------------------------------------------------
    const istekSayaci = new Map();
    const baglaSayaci = new Map();

    function pencere(harita, anahtar, sinir, ms) {
        const simdi = Date.now();
        const liste = (harita.get(anahtar) || []).filter((t) => simdi - t < ms);
        if (liste.length >= sinir) {
            harita.set(anahtar, liste);
            return false;
        }
        liste.push(simdi);
        harita.set(anahtar, liste);
        if (harita.size > 10000) harita.clear();
        return true;
    }

    async function uye(req, res, next) {
        const c = verifyToken(bearerOf(req));
        if (!c || !c.username || (c.role !== 'web_user' && c.role !== 'web_admin')) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
        if (!pencere(istekSayaci, c.username, SINIR.istek, 60000)) {
            return res.status(429).json({ ok: false, error: 'cok_istek' });
        }
        try {
            const r = await pool.query('SELECT is_active, trial_end FROM users WHERE username = $1 LIMIT 1', [c.username]);
            const u = r.rows[0];
            if (!u || !u.is_active || (u.trial_end && new Date() > new Date(u.trial_end))) {
                return res.status(403).json({ ok: false, error: 'hesap_kapali' });
            }
        } catch (e) {
            console.error('rapor uye kontrolu:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
        req.auth = c;
        next();
    }

    async function baglantiOku(username) {
        const r = await pool.query(
            `SELECT chat_id, tg_ad, tg_kullanici_adi, durum, baglandi_at
             FROM rapor.telegram_baglantilari WHERE username = $1`,
            [username]
        );
        return r.rows[0] || null;
    }

    // -----------------------------------------------------------------
    // Durum ve bağlantı
    // -----------------------------------------------------------------
    app.get('/api/rapor/durum', uye, async (req, res) => {
        try {
            const [b, s] = await Promise.all([
                baglantiOku(req.auth.username),
                pool.query(
                    `SELECT max(istendi_at) AS son FROM rapor.sayim_raporlari
                     WHERE username = $1 AND istendi_at > now() - interval '1 day'`,
                    [req.auth.username]
                ),
            ]);
            const son = s.rows[0]?.son ? new Date(s.rows[0].son).getTime() : 0;
            const kalanSn = Math.max(0, Math.ceil((son + SINIR.araSn * 1000 - Date.now()) / 1000));
            return res.json({
                ok: true,
                bot: telegram.botBilgisi(),
                baglanti: b
                    ? {
                          id: String(b.chat_id),
                          ad: b.tg_ad || '',
                          kullaniciAdi: b.tg_kullanici_adi || '',
                          durum: b.durum,
                          baglandi: b.baglandi_at,
                      }
                    : null,
                sinir: { araSn: SINIR.araSn, kalanSn },
            });
        } catch (e) {
            console.error('rapor durum:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    app.post('/api/rapor/bagla', uye, (req, res) => {
        if (!telegram.botBilgisi().hazir) return res.status(503).json({ ok: false, error: 'bot_hazir_degil' });
        if (!pencere(baglaSayaci, req.auth.username, SINIR.bagla, 10 * 60000)) {
            return res.status(429).json({ ok: false, error: 'cok_istek' });
        }
        const { kod, bitis } = telegram.kodUret(req.auth.username);
        return res.json({ ok: true, adres: telegram.baglantiAdresi(kod), bitis });
    });

    app.delete('/api/rapor/bagla', uye, async (req, res) => {
        try {
            await pool.query('DELETE FROM rapor.telegram_baglantilari WHERE username = $1', [req.auth.username]);
            return res.json({ ok: true });
        } catch (e) {
            console.error('rapor baglanti silme:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    // -----------------------------------------------------------------
    // İstek bırakma (yeni rapor ya da tekrar gönderim)
    // -----------------------------------------------------------------
    function yedekFiyatDogrula(ham) {
        if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return null;
        const out = {};
        let n = 0;
        const fiyat = (v) => {
            const x = Number(v);
            return Number.isFinite(x) && x > 0 && x < 1e7 ? Math.round(x * 100) / 100 : null;
        };
        for (const [k, v] of Object.entries(ham)) {
            if (++n > 5000) break;
            if (!/^[A-Za-z0-9_-]{1,64}$/.test(k) || !Array.isArray(v)) continue;
            const s = fiyat(v[0]);
            const o = fiyat(v[1]);
            if (s !== null || o !== null) out[k] = [s, o];
        }
        return Object.keys(out).length ? out : null;
    }

    /**
     * Sınırları kontrol edip kuyruğa yazar. Aynı kullanıcının çift tıklaması
     * yarışmasın diye kullanıcıya özel işlem kilidi tutulur.
     * @returns {Promise<{kod:number, govde:object}>}
     */
    async function kuyrugaYaz(username, alanlar) {
        const istemci = await pool.connect();
        try {
            await istemci.query('BEGIN');
            await istemci.query("SELECT pg_advisory_xact_lock(hashtext('jb-rapor:' || $1))", [username]);
            const s = (
                await istemci.query(
                    `SELECT max(istendi_at) AS son,
                            count(*) FILTER (WHERE istendi_at > now() - interval '1 hour') AS saat,
                            count(*) AS gun,
                            count(*) FILTER (WHERE durum IN ('bekliyor', 'hazirlaniyor')) AS bekleyen
                     FROM rapor.sayim_raporlari
                     WHERE username = $1 AND istendi_at > now() - interval '1 day'`,
                    [username]
                )
            ).rows[0];
            const son = s.son ? new Date(s.son).getTime() : 0;
            const kalanSn = Math.ceil((son + SINIR.araSn * 1000 - Date.now()) / 1000);
            let red = null;
            if (Number(s.bekleyen) > 0) red = { kod: 409, govde: { ok: false, error: 'bekleyen_var' } };
            else if (kalanSn > 0) red = { kod: 429, govde: { ok: false, error: 'cok_sik', bekleSn: kalanSn } };
            else if (Number(s.saat) >= SINIR.saatte) red = { kod: 429, govde: { ok: false, error: 'saatlik_sinir' } };
            else if (Number(s.gun) >= SINIR.gunde) red = { kod: 429, govde: { ok: false, error: 'gunluk_sinir' } };
            if (!red) {
                const g = await istemci.query(
                    `SELECT count(*) AS n FROM rapor.sayim_raporlari WHERE durum IN ('bekliyor', 'hazirlaniyor')`
                );
                if (Number(g.rows[0].n) >= SINIR.kuyruk) red = { kod: 503, govde: { ok: false, error: 'yogun' } };
            }
            if (red) {
                await istemci.query('ROLLBACK');
                return red;
            }
            const r = await istemci.query(
                `INSERT INTO rapor.sayim_raporlari (username, tablo, yedek_fiyat, tg_dosya_id, ozet, sayfa, boyut)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, no`,
                [username, alanlar.tablo, alanlar.yedekFiyat || null, alanlar.dosyaId || null,
                    alanlar.ozet || null, alanlar.sayfa || null, alanlar.boyut || null]
            );
            await istemci.query('COMMIT');
            return { kod: 202, govde: { ok: true, id: r.rows[0].id, no: Number(r.rows[0].no) } };
        } catch (e) {
            await istemci.query('ROLLBACK').catch(() => {});
            throw e;
        } finally {
            istemci.release();
        }
    }

    async function gonderilebilirMi(username) {
        if (!telegram.botBilgisi().hazir) return { kod: 503, govde: { ok: false, error: 'bot_hazir_degil' } };
        const b = await baglantiOku(username);
        if (!b) return { kod: 409, govde: { ok: false, error: 'baglanti_yok' } };
        if (b.durum !== 'aktif') return { kod: 409, govde: { ok: false, error: 'bot_engelli' } };
        return null;
    }

    app.post('/api/rapor/sayim', uye, async (req, res) => {
        const tablo = String(req.body?.tablo || '').trim();
        if (!tablo || tablo.length > 200) return res.status(400).json({ ok: false, error: 'tablo_gecersiz' });
        try {
            const engel = await gonderilebilirMi(req.auth.username);
            if (engel) return res.status(engel.kod).json(engel.govde);
            const v = await pool.query(
                'SELECT count(*) AS n, count(warehouse_stock) AS sayilan FROM rapor.sayim_satirlari($1, $2)',
                [req.auth.username, tablo]
            );
            if (Number(v.rows[0].n) === 0) return res.status(404).json({ ok: false, error: 'tablo_bos' });
            if (Number(v.rows[0].sayilan) === 0) return res.status(409).json({ ok: false, error: 'sayim_yok' });
            const sonuc = await kuyrugaYaz(req.auth.username, { tablo, yedekFiyat: yedekFiyatDogrula(req.body?.fiyatlar) });
            if (sonuc.kod === 202) setImmediate(isciyiDurt);
            return res.status(sonuc.kod).json(sonuc.govde);
        } catch (e) {
            console.error('rapor istegi:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    app.get('/api/rapor/gecmis', uye, async (req, res) => {
        try {
            const r = await pool.query(
                `SELECT id, no, tablo, durum, hata, ozet, sayfa, istendi_at, gonderildi_at,
                        (tg_dosya_id IS NOT NULL) AS tekrar_olur
                 FROM rapor.sayim_raporlari
                 WHERE username = $1
                 ORDER BY istendi_at DESC
                 LIMIT 20`,
                [req.auth.username]
            );
            return res.json({
                ok: true,
                liste: r.rows.map((x) => ({
                    id: x.id,
                    no: Number(x.no),
                    tablo: x.tablo,
                    tabloAd: tabloAdi(x.tablo),
                    durum: x.durum,
                    hata: x.hata || '',
                    ozet: x.ozet
                        ? { net: x.ozet.net, sayilan: x.ozet.sayilan, urun: x.ozet.urun, eksik: x.ozet.eksik?.urun, fazla: x.ozet.fazla?.urun }
                        : null,
                    sayfa: x.sayfa,
                    istendi: x.istendi_at,
                    gonderildi: x.gonderildi_at,
                    tekrar: x.durum === 'gonderildi' && x.tekrar_olur,
                })),
            });
        } catch (e) {
            console.error('rapor gecmis:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    app.post('/api/rapor/gecmis/:id/tekrar', uye, async (req, res) => {
        const id = String(req.params.id || '');
        if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            const r = await pool.query(
                `SELECT tablo, ozet, sayfa, boyut, tg_dosya_id FROM rapor.sayim_raporlari
                 WHERE id = $1 AND username = $2 AND durum = 'gonderildi' AND tg_dosya_id IS NOT NULL`,
                [id, req.auth.username]
            );
            const eski = r.rows[0];
            if (!eski) return res.status(404).json({ ok: false, error: 'bulunamadi' });
            const engel = await gonderilebilirMi(req.auth.username);
            if (engel) return res.status(engel.kod).json(engel.govde);
            const sonuc = await kuyrugaYaz(req.auth.username, {
                tablo: eski.tablo, dosyaId: eski.tg_dosya_id, ozet: eski.ozet, sayfa: eski.sayfa, boyut: eski.boyut,
            });
            if (sonuc.kod === 202) setImmediate(isciyiDurt);
            return res.status(sonuc.kod).json(sonuc.govde);
        } catch (e) {
            console.error('rapor tekrar:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    // -----------------------------------------------------------------
    // İşçi
    // -----------------------------------------------------------------
    let isciCalisiyor = false;

    async function isAl() {
        const r = await pool.query(
            `UPDATE rapor.sayim_raporlari
             SET durum = 'hazirlaniyor', deneme = deneme + 1, basladi_at = now()
             WHERE id = (
                 SELECT id FROM rapor.sayim_raporlari
                 WHERE durum = 'bekliyor' AND (sonraki_deneme IS NULL OR sonraki_deneme <= now())
                 ORDER BY istendi_at
                 LIMIT 1
                 FOR UPDATE SKIP LOCKED
             )
             RETURNING *`
        );
        return r.rows[0] || null;
    }

    function dosyaAdi(tablo, tarih) {
        const harf = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
        const kisa = tabloAdi(tablo)
            .replace(/[çğıöşüÇĞİÖŞÜ]/g, (h) => harf[h])
            .replace(/[^A-Za-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'Tablo';
        const gun = tarih.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
        return `Sayim-Raporu-${kisa}-${gun}.pdf`;
    }

    function aciklama(tablo, o) {
        if (!o) return `Sayım raporu: ${tabloAdi(tablo)}`;
        return [
            `Sayım raporu: ${tabloAdi(tablo)}`,
            `Sayılan ${adet(o.sayilan)} / ${adet(o.urun)} ürün`,
            `Eksik ${adet(o.eksik?.urun || 0)} ürün (${tl(o.eksik?.tl || 0, true)}) · Fazla ${adet(o.fazla?.urun || 0)} ürün (${tl(o.fazla?.tl || 0, true)})`,
            `Net fark: ${tl(o.net, true)}`,
        ].join('\n').slice(0, 1000);
    }

    async function hataYaz(is, metin) {
        await pool.query(
            `UPDATE rapor.sayim_raporlari SET durum = 'hata', hata = $2, yedek_fiyat = NULL WHERE id = $1`,
            [is.id, String(metin).slice(0, 300)]
        );
    }

    async function isle(is) {
        const u = (await pool.query('SELECT is_active, trial_end FROM users WHERE username = $1', [is.username])).rows[0];
        if (!u || !u.is_active || (u.trial_end && new Date() > new Date(u.trial_end))) {
            return hataYaz(is, 'Hesap kapalı.');
        }
        const b = await baglantiOku(is.username);
        if (!b || b.durum !== 'aktif') return hataYaz(is, 'Telegram bağlı değil.');

        try {
            let sonuc;
            let ozet = is.ozet;
            let sayfa = is.sayfa;
            let boyut = is.boyut;
            if (is.tg_dosya_id) {
                sonuc = await telegram.cagir('sendDocument', {
                    chat_id: b.chat_id,
                    document: is.tg_dosya_id,
                    caption: aciklama(is.tablo, ozet),
                });
            } else {
                await katalog.hazirla();
                const satirlar = (await pool.query('SELECT * FROM rapor.sayim_satirlari($1, $2)', [is.username, is.tablo])).rows;
                if (!satirlar.length) return hataYaz(is, 'Tablo boş ya da silinmiş.');
                const veri = raporHesapla(satirlar, katalog.bul, is.yedek_fiyat || {});
                const tarih = new Date();
                const pdf = await pdfUret(veri, {
                    tablo: is.tablo,
                    kullanici: is.username,
                    tarih,
                    no: 'SR-' + String(is.no).padStart(6, '0'),
                });
                ozet = veri.ozet;
                sayfa = pdf.sayfa;
                boyut = pdf.buffer.length;
                const form = new FormData();
                form.append('chat_id', String(b.chat_id));
                form.append('caption', aciklama(is.tablo, ozet));
                form.append('document', new Blob([pdf.buffer], { type: 'application/pdf' }), dosyaAdi(is.tablo, tarih));
                sonuc = await telegram.cagir('sendDocument', form, 60000);
            }
            await pool.query(
                `UPDATE rapor.sayim_raporlari
                 SET durum = 'gonderildi', hata = NULL, ozet = $2, sayfa = $3, boyut = $4,
                     tg_dosya_id = $5, gonderildi_at = now(), yedek_fiyat = NULL
                 WHERE id = $1`,
                [is.id, ozet, sayfa, boyut, sonuc?.document?.file_id || is.tg_dosya_id || null]
            );
        } catch (e) {
            const tg = e instanceof telegram.TelegramHatasi;
            if (tg && telegram.kaliciMi(e)) {
                if (e.kod === 403) {
                    await pool.query(
                        `UPDATE rapor.telegram_baglantilari SET durum = 'engelli' WHERE username = $1`,
                        [is.username]
                    );
                    return hataYaz(is, 'Bot Telegram\'da engellenmiş. Ayarlardan yeniden bağlayın.');
                }
                console.warn('rapor kalici hata:', telegram.temizle(e.message));
                return hataYaz(is, 'Telegram belgeyi kabul etmedi.');
            }
            console.warn('rapor gecici hata:', telegram.temizle(e.message));
            if (is.deneme >= AZAMI_DENEME) return hataYaz(is, 'Gönderilemedi, birkaç kez denendi.');
            const bekle = Math.max(e.bekle || 0, 15 * 2 ** (is.deneme - 1));
            await pool.query(
                `UPDATE rapor.sayim_raporlari
                 SET durum = 'bekliyor', sonraki_deneme = now() + make_interval(secs => $2)
                 WHERE id = $1`,
                [is.id, Math.min(bekle, 600)]
            );
        }
    }

    async function isciyiDurt() {
        if (isciCalisiyor) return;
        isciCalisiyor = true;
        try {
            for (;;) {
                const is = await isAl();
                if (!is) break;
                await isle(is).catch(async (e) => {
                    console.error('rapor isi:', telegram.temizle(e.message));
                    await hataYaz(is, 'Rapor hazırlanamadı.').catch(() => {});
                });
            }
        } catch (e) {
            console.error('rapor iscisi:', e.message);
        } finally {
            isciCalisiyor = false;
        }
    }

    let sonTemizlik = 0;
    async function bakim() {
        try {
            // Servis iş ortasında kapandıysa: yarım işi kuyruğa geri koy
            await pool.query(
                `UPDATE rapor.sayim_raporlari
                 SET durum = CASE WHEN deneme >= $1 THEN 'hata' ELSE 'bekliyor' END,
                     hata = CASE WHEN deneme >= $1 THEN 'Gönderilemedi, birkaç kez denendi.' ELSE hata END
                 WHERE durum = 'hazirlaniyor' AND basladi_at < now() - make_interval(mins => $2)`,
                [AZAMI_DENEME, TAKILMA_DK]
            );
            // 6 saattir gönderilemeyen iş artık anlamsız
            await pool.query(
                `UPDATE rapor.sayim_raporlari SET durum = 'hata', hata = 'Zaman aşımı.', yedek_fiyat = NULL
                 WHERE durum = 'bekliyor' AND istendi_at < now() - interval '6 hours'`
            );
            if (Date.now() - sonTemizlik > 24 * 3600 * 1000) {
                sonTemizlik = Date.now();
                await pool.query(`DELETE FROM rapor.sayim_raporlari WHERE istendi_at < now() - interval '180 days'`);
            }
        } catch (e) {
            // Tablo henüz yoksa (SQL çalışmadıysa) sessiz kal
            if (!/does not exist/.test(e.message)) console.warn('rapor bakim:', e.message);
            return;
        }
        isciyiDurt();
    }

    // -----------------------------------------------------------------
    // Telegram'dan gelen /start <kod>
    // -----------------------------------------------------------------
    async function baglan({ username, chatId, ad, kullaniciAdi }) {
        try {
            await pool.query(
                `INSERT INTO rapor.telegram_baglantilari (username, chat_id, tg_ad, tg_kullanici_adi, durum, baglandi_at)
                 VALUES ($1, $2, $3, $4, 'aktif', now())
                 ON CONFLICT (username) DO UPDATE SET
                    chat_id = EXCLUDED.chat_id, tg_ad = EXCLUDED.tg_ad,
                    tg_kullanici_adi = EXCLUDED.tg_kullanici_adi, durum = 'aktif', baglandi_at = now()`,
                [username, chatId, ad || null, kullaniciAdi || null]
            );
            console.log('telegram baglandi:', username);
            return true;
        } catch (e) {
            console.error('telegram baglama:', e.message);
            return false;
        }
    }

    if (telegram.hazirMi()) {
        telegram.dinle(baglan);
        setTimeout(() => katalog.hazirla().catch(() => {}), 5000).unref();
    } else {
        console.log('rapor botu kapali: TELEGRAM_RAPOR_BOT_TOKEN tanimli degil');
    }
    setInterval(bakim, 20000).unref();
    setTimeout(bakim, 3000).unref();
}

module.exports = { kur };
