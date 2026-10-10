/**
 * Sayım raporu: uçlar ve arka plan işçisi
 *
 * AKIŞ
 * 1. Tarayıcı POST /api/rapor/sayim ile isteği ve seçilen ayarı (şablon,
 *    bölümler, biçim) bırakır. Sunucu hız sınırını kontrol edip satırı
 *    kuyruğa yazar, ayarı kullanıcının tercihi olarak saklar, hemen 202 döner.
 * 2. İşçi kuyruğu sırayla işler: sayım satırlarını veritabanından okur,
 *    hesaplar, istenen biçimde (PDF, kare kart ya da ikisi) bellekte üretir,
 *    Telegram'a gönderir. Kullanıcı sayfayı kapatsa da iş biter; servis
 *    yeniden başlarsa yarım kalan iş kuyruktan devam eder. Kart gittikten
 *    sonra PDF'te geçici hata olursa yeniden denemede kart tekrar gitmez.
 * 3. Dosyalar diske yazılmaz. Telegram'ın verdiği dosya kimlikleri
 *    saklanır, "Tekrar gönder" yeniden üretmeden o kimliklerle gönderir.
 *
 * KÖTÜYE KULLANIM SINIRLARI (kullanıcı başına, veritabanında; servis
 * yeniden başlasa da sıfırlanmaz)
 * - İki istek arası en az 15 saniye
 * - Aynı anda en fazla 1 bekleyen iş
 * - Saatte 40, günde 150 istek. Gerçek kullanımda bu tavana varılmaz;
 *   ama biri sürekli basan bir betik yazsa bile saatte 40'ı geçemez.
 * - Bütün kullanıcılar için kuyrukta en fazla 200 iş; işçi tek sıra.
 */
'use strict';

const telegram = require('./telegram');
const katalog = require('./katalog');
const gorsel = require('./gorsel');
const { raporHesapla } = require('./hesap');
const { ayarDuzelt, donguDuzelt, donguMu, pdfVar, kartVar } = require('./ayar');
const { pdfUret, gorselGerekenler, tabloAdi, tl, adet } = require('./pdf');
const { kartUret, kartGorselleri } = require('./kart');

const SINIR = {
    araSn: 15,
    saatte: 40,
    gunde: 150,
    kuyruk: 200,
    bagla: 10, // 10 dakikada bağlantı kodu (5 hesaba yetecek kadar)
    istek: 90, // dakikada toplam uç çağrısı
};
const AZAMI_DENEME = 4;
const AZAMI_HESAP = 5;
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

    /** Kullanıcının bağlı Telegram hesapları (en fazla 5), bağlanma sırasıyla */
    async function hesaplarOku(username) {
        const r = await pool.query(
            `SELECT id, chat_id, tg_ad, tg_kullanici_adi, durum, baglandi_at
             FROM rapor.telegram_baglantilari WHERE username = $1
             ORDER BY baglandi_at`,
            [username]
        );
        return r.rows;
    }

    const hesapJson = (b) => ({
        hesap: b.id, id: String(b.chat_id), ad: b.tg_ad || '', kullaniciAdi: b.tg_kullanici_adi || '', durum: b.durum, baglandi: b.baglandi_at,
    });

    async function tercihOku(username) {
        try {
            const r = await pool.query('SELECT ayar FROM rapor.tercihler WHERE username = $1', [username]);
            return r.rows[0] ? ayarDuzelt(r.rows[0].ayar) : null;
        } catch (e) {
            return null; // tablo henüz yoksa varsayılanla devam
        }
    }

    async function tercihYaz(username, ayar) {
        await pool.query(
            `INSERT INTO rapor.tercihler (username, ayar, guncellendi) VALUES ($1, $2, now())
             ON CONFLICT (username) DO UPDATE SET ayar = EXCLUDED.ayar, guncellendi = now()`,
            [username, ayar]
        );
    }

    // -----------------------------------------------------------------
    // Durum, bağlantı, tercih
    // -----------------------------------------------------------------
    app.get('/api/rapor/durum', uye, async (req, res) => {
        try {
            const [hesaplar, s, tercih] = await Promise.all([
                hesaplarOku(req.auth.username),
                pool.query(
                    `SELECT max(istendi_at) AS son FROM rapor.sayim_raporlari
                     WHERE username = $1 AND istendi_at > now() - interval '1 day'`,
                    [req.auth.username]
                ),
                tercihOku(req.auth.username),
            ]);
            const son = s.rows[0]?.son ? new Date(s.rows[0].son).getTime() : 0;
            const kalanSn = Math.max(0, Math.ceil((son + SINIR.araSn * 1000 - Date.now()) / 1000));
            return res.json({
                ok: true,
                bot: telegram.botBilgisi(),
                hesaplar: hesaplar.map(hesapJson),
                // Eski istemci için: ilk etkin hesap
                baglanti: hesaplar.length ? hesapJson(hesaplar.find((h) => h.durum === 'aktif') || hesaplar[0]) : null,
                azamiHesap: AZAMI_HESAP,
                tercih,
                sinir: { araSn: SINIR.araSn, kalanSn },
            });
        } catch (e) {
            console.error('rapor durum:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    app.put('/api/rapor/tercih', uye, async (req, res) => {
        try {
            const ayar = ayarDuzelt(req.body?.ayar);
            await tercihYaz(req.auth.username, ayar);
            return res.json({ ok: true, tercih: ayar });
        } catch (e) {
            console.error('rapor tercih:', e.message);
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

    app.delete('/api/rapor/bagla/:hesap', uye, async (req, res) => {
        const hesap = String(req.params.hesap || '');
        if (!/^[0-9a-f-]{36}$/i.test(hesap)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            await pool.query('DELETE FROM rapor.telegram_baglantilari WHERE username = $1 AND id = $2', [req.auth.username, hesap]);
            return res.json({ ok: true });
        } catch (e) {
            console.error('rapor baglanti silme:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
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
                `INSERT INTO rapor.sayim_raporlari (username, tablo, yedek_fiyat, ayar, kaynak, ozet, sayfa, boyut)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, no`,
                [username, alanlar.tablo, alanlar.yedekFiyat || null, alanlar.ayar || null, alanlar.kaynak || null,
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
        const h = await hesaplarOku(username);
        if (!h.length) return { kod: 409, govde: { ok: false, error: 'baglanti_yok' } };
        if (!h.some((x) => x.durum === 'aktif')) return { kod: 409, govde: { ok: false, error: 'bot_engelli' } };
        return null;
    }

    app.post('/api/rapor/sayim', uye, async (req, res) => {
        const tablo = String(req.body?.tablo || '').trim();
        if (!tablo || tablo.length > 200) return res.status(400).json({ ok: false, error: 'tablo_gecersiz' });
        const ayar = ayarDuzelt(req.body?.ayar);
        try {
            const engel = await gonderilebilirMi(req.auth.username);
            if (engel) return res.status(engel.kod).json(engel.govde);
            const v = await pool.query(
                'SELECT count(*) AS n, count(warehouse_stock) AS sayilan FROM rapor.sayim_satirlari($1, $2)',
                [req.auth.username, tablo]
            );
            if (Number(v.rows[0].n) === 0) return res.status(404).json({ ok: false, error: 'tablo_bos' });
            if (Number(v.rows[0].sayilan) === 0) return res.status(409).json({ ok: false, error: 'sayim_yok' });
            // Döngü özeti işin ayarıyla saklanır (kişisel tercihe yazılmaz)
            const dongu = donguMu(tablo) ? donguDuzelt(req.body?.dongu) : null;
            const isAyari = dongu ? { ...ayar, dongu } : ayar;
            const sonuc = await kuyrugaYaz(req.auth.username, { tablo, ayar: isAyari, yedekFiyat: yedekFiyatDogrula(req.body?.fiyatlar) });
            if (sonuc.kod === 202) {
                setImmediate(isciyiDurt);
                tercihYaz(req.auth.username, ayar).catch((e) => console.warn('rapor tercih yazilamadi:', e.message));
            }
            return res.status(sonuc.kod).json(sonuc.govde);
        } catch (e) {
            console.error('rapor istegi:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    app.get('/api/rapor/gecmis', uye, async (req, res) => {
        try {
            const r = await pool.query(
                `SELECT id, no, tablo, durum, hata, ozet, sayfa, ayar, istendi_at, gonderildi_at,
                        (tg_dosya_id IS NOT NULL) AS pdf_var, (tg_kart_id IS NOT NULL) AS kart_var,
                        (tg_dosya_id IS NOT NULL OR tg_kart_id IS NOT NULL) AS tekrar_olur
                 FROM rapor.sayim_raporlari
                 WHERE username = $1
                 ORDER BY istendi_at DESC
                 LIMIT 20`,
                [req.auth.username]
            );
            return res.json({
                ok: true,
                liste: r.rows.map((x) => {
                    const a = x.ayar ? ayarDuzelt(x.ayar) : null;
                    return {
                        id: x.id,
                        no: Number(x.no),
                        tablo: x.tablo,
                        tabloAd: tabloAdi(x.tablo),
                        durum: x.durum,
                        hata: x.hata || '',
                        bicim: a ? a.bicim : 'pdf',
                        sablon: a ? a.sablon : '',
                        ozet: x.ozet
                            ? { net: x.ozet.net, sayilan: x.ozet.sayilan, urun: x.ozet.urun, eksik: x.ozet.eksik?.urun, fazla: x.ozet.fazla?.urun, fiyatli: a ? a.fiyat : true }
                            : null,
                        sayfa: x.sayfa,
                        istendi: x.istendi_at,
                        gonderildi: x.gonderildi_at,
                        tekrar: x.durum === 'gonderildi' && x.tekrar_olur,
                        belge: { pdf: x.pdf_var, kart: x.kart_var },
                    };
                }),
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
                `SELECT id, tablo, ozet, sayfa, boyut, ayar FROM rapor.sayim_raporlari
                 WHERE id = $1 AND username = $2 AND durum = 'gonderildi'
                   AND (tg_dosya_id IS NOT NULL OR tg_kart_id IS NOT NULL)`,
                [id, req.auth.username]
            );
            const eski = r.rows[0];
            if (!eski) return res.status(404).json({ ok: false, error: 'bulunamadi' });
            const engel = await gonderilebilirMi(req.auth.username);
            if (engel) return res.status(engel.kod).json(engel.govde);
            const sonuc = await kuyrugaYaz(req.auth.username, {
                tablo: eski.tablo, kaynak: eski.id, ayar: eski.ayar, ozet: eski.ozet, sayfa: eski.sayfa, boyut: eski.boyut,
            });
            if (sonuc.kod === 202) setImmediate(isciyiDurt);
            return res.status(sonuc.kod).json(sonuc.govde);
        } catch (e) {
            console.error('rapor tekrar:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
    });

    // -----------------------------------------------------------------
    // Önizleme: göndermeden, aynı üreticiyle (PDF ya da kart)
    // -----------------------------------------------------------------
    // Kullanıcı başına aynı anda tek önizleme, dakikada 30; sunucu genelinde
    // aynı anda en fazla 3. Üretim ~200 ms, görseller önbellekten.
    const onizlemeSayaci = new Map();
    const onizlemeMesgul = new Set();
    let onizlemeAktif = 0;

    app.post('/api/rapor/onizleme', uye, async (req, res) => {
        const kullanici = req.auth.username;
        const tablo = String(req.body?.tablo || '').trim();
        if (!tablo || tablo.length > 200) return res.status(400).json({ ok: false, error: 'tablo_gecersiz' });
        const tur = req.body?.tur === 'kart' ? 'kart' : 'pdf';
        if (onizlemeMesgul.has(kullanici)) return res.status(429).json({ ok: false, error: 'mesgul' });
        if (!pencere(onizlemeSayaci, kullanici, 30, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
        if (onizlemeAktif >= 3) return res.status(503).json({ ok: false, error: 'yogun' });
        onizlemeMesgul.add(kullanici);
        onizlemeAktif++;
        try {
            const ayar = ayarDuzelt(req.body?.ayar);
            await katalog.hazirla();
            const satirlar = (await pool.query('SELECT * FROM rapor.sayim_satirlari($1, $2)', [kullanici, tablo])).rows;
            if (!satirlar.length) return res.status(404).json({ ok: false, error: 'tablo_bos' });
            const veri = raporHesapla(satirlar, katalog.bul, yedekFiyatDogrula(req.body?.fiyatlar) || {});
            const bilgi = { tablo, kullanici, tarih: new Date(), no: 'Önizleme', dongu: donguMu(tablo) ? donguDuzelt(req.body?.dongu) : null };
            const gorseller = await gorsel.topluGetir(tur === 'kart' ? kartGorselleri(veri, ayar) : gorselGerekenler(veri, ayar), 10000);
            res.set('Cache-Control', 'no-store');
            if (tur === 'kart') return res.type('image/png').send(kartUret(veri, bilgi, ayar, gorseller));
            const p = await pdfUret(veri, bilgi, ayar, gorseller);
            return res.type('application/pdf').send(p.buffer);
        } catch (e) {
            console.error('rapor onizleme:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        } finally {
            onizlemeMesgul.delete(kullanici);
            onizlemeAktif--;
        }
    });

    // -----------------------------------------------------------------
    // Gönderilmiş belgeyi sitede görmek: Telegram'dan geri indirip aktar
    // -----------------------------------------------------------------
    const belgeSayaci = new Map();

    app.get('/api/rapor/belge/:id/:tur', uye, async (req, res) => {
        const id = String(req.params.id || '');
        const tur = req.params.tur === 'kart' ? 'kart' : req.params.tur === 'pdf' ? 'pdf' : '';
        if (!/^[0-9a-f-]{36}$/i.test(id) || !tur) return res.status(400).json({ ok: false, error: 'gecersiz' });
        if (!pencere(belgeSayaci, req.auth.username, 20, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
        try {
            const r = await pool.query(
                'SELECT tg_dosya_id, tg_kart_id FROM rapor.sayim_raporlari WHERE id = $1 AND username = $2',
                [id, req.auth.username]
            );
            const satir = r.rows[0];
            const dosyaId = satir && (tur === 'pdf' ? satir.tg_dosya_id : satir.tg_kart_id);
            if (!dosyaId) return res.status(404).json({ ok: false, error: 'bulunamadi' });
            const buf = await telegram.dosyaIndir(dosyaId);
            const tip = buf[0] === 0x25 ? 'application/pdf' : buf[0] === 0x89 ? 'image/png' : 'image/jpeg';
            res.set('Cache-Control', 'private, max-age=300');
            return res.type(tip).send(buf);
        } catch (e) {
            console.warn('rapor belge:', telegram.temizle(e.message));
            return res.status(502).json({ ok: false, error: 'indirilemedi' });
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

    function aciklama(tablo, o, ayar, dongu) {
        const ad = (dongu || donguMu(tablo) ? 'Döngü · ' : '') + tabloAdi(tablo);
        if (!o) return `Sayım Raporu: ${ad}`;
        const fiyatli = !ayar || ayar.fiyat !== false;
        const satir = [`Sayım Raporu: ${ad}`, `Sayılan ${adet(o.sayilan)} / ${adet(o.urun)} ürün`];
        if (dongu) satir.push(`Döngü: ${adet(dongu.sayildi)} / ${adet(dongu.toplam)} alt kategori sayıldı`);
        if (fiyatli) {
            satir.push(`Eksik ${adet(o.eksik?.urun || 0)} ürün (${tl(o.eksik?.tl || 0, true)}) · Fazla ${adet(o.fazla?.urun || 0)} ürün (${tl(o.fazla?.tl || 0, true)})`);
            satir.push(`Net fark: ${tl(o.net, true)}`);
        } else {
            satir.push(`Eksik ${adet(o.eksik?.urun || 0)} ürün (${adet(o.eksik?.adet || 0)} adet) · Fazla ${adet(o.fazla?.urun || 0)} ürün (${adet(o.fazla?.adet || 0)} adet)`);
        }
        if (ayar && ayar.not) satir.push(ayar.not);
        return satir.join('\n').slice(0, 1000);
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
        const ayar = ayarDuzelt(is.ayar);
        const etkin = (await hesaplarOku(is.username)).filter((h) => h.durum === 'aktif');
        let alicilar = etkin;
        if (ayar.alicilar.length) {
            const secili = etkin.filter((h) => ayar.alicilar.includes(h.id));
            if (secili.length) alicilar = secili;
        }
        if (!alicilar.length) return hataYaz(is, 'Telegram hesabı bağlı değil.');

        // Hangi alıcıya hangi parça gitti: geçici hatada yeniden denenirken
        // aynı hesaba ikinci kez gitmesin
        const ilerleme = new Set(Array.isArray(is.ilerleme) ? is.ilerleme : []);
        const ilerlemeYaz = () => pool.query('UPDATE rapor.sayim_raporlari SET ilerleme = $2 WHERE id = $1', [is.id, JSON.stringify([...ilerleme])]);

        let ozet = is.ozet;
        let sayfa = is.sayfa;
        let boyut = is.boyut;
        let kartId = is.tg_kart_id || null;
        let dosyaId = is.tg_dosya_id || null;
        let kartIste = kartVar(ayar);
        let pdfIste = pdfVar(ayar);
        let png = null;
        let pdf = null;
        let tarih = new Date();

        if (is.kaynak) {
            // Tekrar gönderim: üretmeden, kayıtlı dosya kimlikleriyle
            const k = (await pool.query('SELECT tg_dosya_id, tg_kart_id FROM rapor.sayim_raporlari WHERE id = $1', [is.kaynak])).rows[0];
            if (!k || (!k.tg_dosya_id && !k.tg_kart_id)) return hataYaz(is, 'Önceki belge bulunamadı.');
            kartId = kartId || k.tg_kart_id;
            dosyaId = dosyaId || k.tg_dosya_id;
            kartIste = !!kartId;
            pdfIste = !!dosyaId;
        } else if ((kartIste && !kartId) || (pdfIste && !dosyaId)) {
            await katalog.hazirla();
            const satirlar = (await pool.query('SELECT * FROM rapor.sayim_satirlari($1, $2)', [is.username, is.tablo])).rows;
            if (!satirlar.length) return hataYaz(is, 'Tablo boş ya da silinmiş.');
            const veri = raporHesapla(satirlar, katalog.bul, is.yedek_fiyat || {});
            const bilgi = { tablo: is.tablo, kullanici: is.username, tarih, no: 'SR-' + String(is.no).padStart(6, '0'), dongu: donguMu(is.tablo) ? donguDuzelt(is.ayar && is.ayar.dongu) : null };
            ozet = veri.ozet;
            const istenen = [];
            if (kartIste && !kartId) istenen.push(...kartGorselleri(veri, ayar));
            if (pdfIste && !dosyaId) istenen.push(...gorselGerekenler(veri, ayar));
            const gorseller = istenen.length ? await gorsel.topluGetir(istenen) : new Map();
            if (kartIste && !kartId) png = kartUret(veri, bilgi, ayar, gorseller);
            if (pdfIste && !dosyaId) {
                const p = await pdfUret(veri, bilgi, ayar, gorseller);
                pdf = p.buffer;
                sayfa = p.sayfa;
                boyut = p.buffer.length;
            }
            await pool.query('UPDATE rapor.sayim_raporlari SET ozet = $2 WHERE id = $1', [is.id, ozet]);
        }

        const yazi = aciklama(is.tablo, ozet, ayar, donguMu(is.tablo) ? donguDuzelt(is.ayar && is.ayar.dongu) : null);
        const kalici = [];
        for (const h of alicilar) {
            try {
                if (kartIste && !ilerleme.has(h.id + ':kart')) {
                    let sonuc;
                    // Kart tek başına gidiyorsa açıklama kartta, PDF de varsa PDF'te
                    const baslik = pdfIste ? '' : yazi;
                    if (kartId) {
                        sonuc = await telegram.cagir('sendPhoto', { chat_id: h.chat_id, photo: kartId, caption: baslik });
                    } else {
                        const form = new FormData();
                        form.append('chat_id', String(h.chat_id));
                        if (baslik) form.append('caption', baslik);
                        form.append('photo', new Blob([png], { type: 'image/png' }), 'sayim-karti.png');
                        sonuc = await telegram.cagir('sendPhoto', form, 60000);
                        const foto = Array.isArray(sonuc?.photo) ? sonuc.photo[sonuc.photo.length - 1] : null;
                        if (foto?.file_id) {
                            kartId = foto.file_id;
                            await pool.query('UPDATE rapor.sayim_raporlari SET tg_kart_id = $2 WHERE id = $1', [is.id, kartId]);
                        }
                    }
                    ilerleme.add(h.id + ':kart');
                    await ilerlemeYaz();
                }
                if (pdfIste && !ilerleme.has(h.id + ':pdf')) {
                    if (dosyaId) {
                        await telegram.cagir('sendDocument', { chat_id: h.chat_id, document: dosyaId, caption: yazi });
                    } else {
                        const form = new FormData();
                        form.append('chat_id', String(h.chat_id));
                        form.append('caption', yazi);
                        form.append('document', new Blob([pdf], { type: 'application/pdf' }), dosyaAdi(is.tablo, tarih));
                        const sonuc = await telegram.cagir('sendDocument', form, 60000);
                        if (sonuc?.document?.file_id) {
                            dosyaId = sonuc.document.file_id;
                            await pool.query('UPDATE rapor.sayim_raporlari SET tg_dosya_id = $2 WHERE id = $1', [is.id, dosyaId]);
                        }
                    }
                    ilerleme.add(h.id + ':pdf');
                    await ilerlemeYaz();
                }
            } catch (e) {
                if (!(e instanceof telegram.TelegramHatasi) || !telegram.kaliciMi(e)) throw e; // geçici: iş yeniden denenir
                console.warn('rapor kalici hata:', telegram.temizle(e.message));
                if (e.kod === 403) {
                    await pool.query(`UPDATE rapor.telegram_baglantilari SET durum = 'engelli' WHERE id = $1`, [h.id]);
                }
                kalici.push(h);
            }
        }

        if (kalici.length === alicilar.length) {
            return hataYaz(is, kalici.length > 1
                ? 'Hiçbir hesaba gönderilemedi. Bot engellenmiş olabilir; hesapları yeniden bağlayın.'
                : 'Bot Telegram\'da engellenmiş ya da sohbet silinmiş. Hesabı yeniden bağlayın.');
        }
        const not = kalici.length
            ? `${kalici.map((h) => h.tg_ad || h.tg_kullanici_adi || 'Bir hesap').join(', ')} hesabına gönderilemedi.`
            : null;
        await pool.query(
            `UPDATE rapor.sayim_raporlari
             SET durum = 'gonderildi', hata = $7, ozet = $2, sayfa = $3, boyut = $4,
                 tg_dosya_id = $5, tg_kart_id = $6, gonderildi_at = now(), yedek_fiyat = NULL
             WHERE id = $1`,
            [is.id, ozet, sayfa, boyut, dosyaId, kartId, not]
        );
    }

    /** İşçinin hata sarmalayıcısı: geçici hatada iş kuyruğa geri döner */
    async function isleGuvenli(is) {
        try {
            await isle(is);
        } catch (e) {
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
                await isleGuvenli(is).catch(async (e) => {
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
                gorsel.budama();
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
            const sayim = await pool.query(
                `SELECT count(*) FILTER (WHERE chat_id = $2) AS ayni, count(*) AS toplam
                 FROM rapor.telegram_baglantilari WHERE username = $1`,
                [username, chatId]
            );
            if (Number(sayim.rows[0].ayni) === 0 && Number(sayim.rows[0].toplam) >= AZAMI_HESAP) return 'sinir';
            // Aynı sohbet yeniden bağlanırsa yeni satır açılmıyor, ad ve durum tazeleniyor
            await pool.query(
                `INSERT INTO rapor.telegram_baglantilari (username, chat_id, tg_ad, tg_kullanici_adi, durum, baglandi_at)
                 VALUES ($1, $2, $3, $4, 'aktif', now())
                 ON CONFLICT (username, chat_id) DO UPDATE SET
                    tg_ad = EXCLUDED.tg_ad, tg_kullanici_adi = EXCLUDED.tg_kullanici_adi, durum = 'aktif', baglandi_at = now()`,
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
