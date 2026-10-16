/**
 * İtiraz Yazıcı: Depo Değerlendirme kayıtlarına itiraz metni
 * ============================================================================
 *
 * AKIŞ
 * 1. Site sayfası (/itiraz/) franchise panelinin kendi liste isteğini atar ve
 *    kayıtları POST /api/itiraz/kayitlar ile buraya bırakır. Sonuçlanan
 *    itirazlar (300 kabul, 400 red) yapay zekânın örnek hafızası olur.
 * 2. POST /api/itiraz/yaz: kayıt + işaretli depo olguları + geçmiş örnekler
 *    ile Gemini'ye gider; üç farklı taslak ve panelin sebep listesinden bir
 *    sebep döner. Gemini anahtarı kullanıcınındır, burada şifreli durur,
 *    tarayıcıya hiç geri dönmez.
 * 3. POST /api/itiraz/sec: kullanıcının seçip düzenlediği son metin saklanır;
 *    sonraki taslaklarda üslup örneği olur.
 *
 * Getir'e buradan hiçbir istek gitmez.
 *
 * SINIRLAR (kullanıcı başına)
 * - genel: dakikada 60 istek
 * - yaz: dakikada 6, günde 80
 * ============================================================================
 */
'use strict';

const crypto = require('crypto');

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const MODELLER = [process.env.ITIRAZ_MODEL || 'gemini-flash-latest', 'gemini-2.5-flash'];
const GUNLUK_YAZ = 80;
const HAK = 'itirazYazici';

/** Şifreleme anahtarı: ITIRAZ_SIFRE (64 hex) varsa o, yoksa JWT_SECRET'tan türetilir. */
function sifreAnahtari() {
    const ozel = process.env.ITIRAZ_SIFRE || '';
    if (/^[0-9a-f]{64}$/i.test(ozel)) return Buffer.from(ozel, 'hex');
    const kok = process.env.JWT_SECRET || '';
    if (kok.length < 32) return null;
    return Buffer.from(crypto.hkdfSync('sha256', kok, 'jetbarkod', 'itiraz-gemini-anahtari', 32));
}

function sifrele(metin) {
    const a = sifreAnahtari();
    if (!a) throw new Error('sifre_anahtari_yok');
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', a, iv);
    const veri = Buffer.concat([c.update(metin, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), veri].map((b) => b.toString('base64')).join('.');
}

function coz(paket) {
    const a = sifreAnahtari();
    if (!a || typeof paket !== 'string') return null;
    try {
        const [iv, etiket, veri] = paket.split('.').map((s) => Buffer.from(s, 'base64'));
        const d = crypto.createDecipheriv('aes-256-gcm', a, iv);
        d.setAuthTag(etiket);
        return Buffer.concat([d.update(veri), d.final()]).toString('utf8');
    } catch (e) {
        return null;
    }
}

const metin = (v, azami) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, azami) : '');
const tarih = (v) => {
    const t = typeof v === 'string' ? Date.parse(v) : NaN;
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

function hakAcik(pf) {
    const f = pf && typeof pf === 'object' ? pf[HAK] : undefined;
    return f === true || (f && typeof f === 'object' && f.enabled === true);
}

async function gemini(anahtar, govde) {
    let son = null;
    for (const model of MODELLER) {
        const ctrl = new AbortController();
        const zaman = setTimeout(() => ctrl.abort(), 45000);
        let r;
        try {
            r = await fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': anahtar },
                body: JSON.stringify(govde),
                signal: ctrl.signal,
            });
        } catch (e) {
            clearTimeout(zaman);
            return { hata: 'gemini_ulasilamadi' };
        }
        clearTimeout(zaman);
        if (r.status === 404) { son = { hata: 'model_yok' }; continue; }
        let j = null;
        try { j = await r.json(); } catch (e) { /* gövde yok */ }
        if (r.status === 400 && /API_KEY_INVALID|API key not valid/i.test(JSON.stringify(j || ''))) return { hata: 'anahtar_gecersiz' };
        if (r.status === 401 || r.status === 403) return { hata: 'anahtar_gecersiz' };
        if (r.status === 429) return { hata: 'gemini_kota' };
        if (!r.ok) return { hata: 'gemini_hata' };
        const parca = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
        const yazi = Array.isArray(parca) ? parca.map((p) => p.text || '').join('') : '';
        try { return { veri: JSON.parse(yazi) }; } catch (e) { return { hata: 'gemini_bicim' }; }
    }
    return son || { hata: 'gemini_hata' };
}

async function anahtarDogrula(anahtar) {
    try {
        const r = await fetch(`${GEMINI}/models?pageSize=1`, { headers: { 'x-goog-api-key': anahtar } });
        if (r.ok) return 'tamam';
        if (r.status === 400 || r.status === 401 || r.status === 403) return 'gecersiz';
        return 'bilinmiyor';
    } catch (e) {
        return 'bilinmiyor';
    }
}

const TALIMAT = [
    'Bir market deposunun sorumlusu adına, depo değerlendirme sistemine düşen müşteri şikâyeti kayıtlarına itiraz metni yazıyorsun.',
    'Metni okuyan kişi kaydı inceleyip itirazı kabul ya da reddeden bir operasyon çalışanı.',
    '',
    'KURALLAR',
    '- Müşterinin şikâyetine ve notuna doğrudan cevap ver. Genel "eksiksiz hazırladık" cümlesi tek başına reddediliyor.',
    '- Yalnız verilen bilgileri ve işaretli depo olgularını kullan. Kamera kaydı, saat, kişi, sayı, ölçüm gibi verilmemiş hiçbir şey uydurma.',
    '- Doğal, sakin, kendinden emin yaz. Abartma, yalvarma, suçlama yok. "Saygılarımızla", "arz ederiz", "değerli ekip" gibi resmî kalıplar yok.',
    '- Müşteriyi küçümseme; olası açıklamayı nazikçe söyle (poşette gözden kaçmış olabilir, benzer ürünle karışmış olabilir gibi).',
    '- Kurye, toplayıcı ya da müşteri adı yazma. Emoji ve madde işareti yok. Uzun tire (—) kullanma.',
    '- Her taslak 2 ile 4 cümle, en fazla 450 karakter, düzgün Türkçe.',
    '- Üç taslak birbirinden gerçekten farklı açıdan yaklaşsın (ör. süreç ve kontrol, olası açıklama, ürünün niteliği).',
    '- "sebep" alanına verilen sebep listesinden, metinle aynı şeyi söyleyen TEK bir sebebi harfi harfine yaz.',
    '- Örneklerde kabul edilen itirazların yaklaşımını izle, reddedilenlerin hatasından kaçın, kullanıcının seçtiği metinlerin üslubuna yaklaş. Örnekleri kopyalama.',
].join('\n');

const SEMA = {
    type: 'OBJECT',
    properties: {
        sebep: { type: 'STRING' },
        taslaklar: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: { aci: { type: 'STRING' }, metin: { type: 'STRING' } },
                required: ['aci', 'metin'],
            },
        },
    },
    required: ['sebep', 'taslaklar'],
};

function kur(app, { pool, verifyToken, bearerOf }) {
    const sayac = new Map();

    function pencere(anahtar, sinir, ms) {
        const simdi = Date.now();
        const liste = (sayac.get(anahtar) || []).filter((t) => simdi - t < ms);
        if (liste.length >= sinir) { sayac.set(anahtar, liste); return false; }
        liste.push(simdi);
        sayac.set(anahtar, liste);
        if (sayac.size > 20000) sayac.clear();
        return true;
    }

    const semaYok = (e) => e && (e.code === '3F000' || e.code === '42P01');

    function hata(res, e, yer) {
        if (semaYok(e)) return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
        console.error('itiraz ' + yer + ':', e.message);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }

    async function uye(req, res, next) {
        const c = verifyToken(bearerOf(req));
        if (!c || !c.username || (c.role !== 'web_user' && c.role !== 'web_admin')) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
        if (!pencere('istek:' + c.username, 60, 60000)) {
            return res.status(429).json({ ok: false, error: 'cok_istek' });
        }
        try {
            const r = await pool.query(
                'SELECT is_active, is_admin, trial_end, premium_features FROM users WHERE username = $1 LIMIT 1',
                [c.username]
            );
            const u = r.rows[0];
            if (!u || !u.is_active || (u.trial_end && new Date() > new Date(u.trial_end))) {
                return res.status(403).json({ ok: false, error: 'hesap_kapali' });
            }
            if (!u.is_admin && !hakAcik(u.premium_features)) {
                return res.status(403).json({ ok: false, error: 'hak_yok' });
            }
        } catch (e) {
            console.error('itiraz uye kontrolu:', e.message);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }
        req.auth = c;
        next();
    }

    // -----------------------------------------------------------------
    // Ayarlar: Gemini anahtarı ve depo olguları
    // -----------------------------------------------------------------

    app.get('/api/itiraz/ayar', uye, async (req, res) => {
        try {
            const r = await pool.query(
                'SELECT anahtar_sifreli IS NOT NULL AS var, anahtar_son4, olgular FROM itiraz.ayarlar WHERE username = $1',
                [req.auth.username]
            );
            const a = r.rows[0];
            res.json({ ok: true, anahtar: !!(a && a.var), son4: (a && a.var && a.anahtar_son4) || '', olgular: (a && a.olgular) || [] });
        } catch (e) { hata(res, e, 'ayar oku'); }
    });

    app.post('/api/itiraz/ayar', uye, async (req, res) => {
        const b = req.body || {};
        const kim = req.auth.username;
        try {
            if (Array.isArray(b.olgular)) {
                const olgular = [...new Set(b.olgular.map((o) => metin(o, 200)).filter(Boolean))].slice(0, 20);
                await pool.query(
                    `INSERT INTO itiraz.ayarlar (username, olgular) VALUES ($1, $2::jsonb)
                     ON CONFLICT (username) DO UPDATE SET olgular = EXCLUDED.olgular, guncelleme = now()`,
                    [kim, JSON.stringify(olgular)]
                );
            }
            if (b.anahtar === null) {
                await pool.query(
                    'UPDATE itiraz.ayarlar SET anahtar_sifreli = NULL, anahtar_son4 = NULL, guncelleme = now() WHERE username = $1',
                    [kim]
                );
            } else if (typeof b.anahtar === 'string') {
                const anahtar = b.anahtar.trim();
                if (!/^[A-Za-z0-9_-]{30,80}$/.test(anahtar)) return res.status(400).json({ ok: false, error: 'anahtar_gecersiz' });
                if (!pencere('anahtar:' + kim, 5, 600000)) return res.status(429).json({ ok: false, error: 'cok_istek' });
                const d = await anahtarDogrula(anahtar);
                if (d === 'gecersiz') return res.status(400).json({ ok: false, error: 'anahtar_gecersiz' });
                await pool.query(
                    `INSERT INTO itiraz.ayarlar (username, anahtar_sifreli, anahtar_son4) VALUES ($1, $2, $3)
                     ON CONFLICT (username) DO UPDATE SET anahtar_sifreli = EXCLUDED.anahtar_sifreli,
                         anahtar_son4 = EXCLUDED.anahtar_son4, guncelleme = now()`,
                    [kim, sifrele(anahtar), anahtar.slice(-4)]
                );
            }
            res.json({ ok: true });
        } catch (e) {
            if (e.message === 'sifre_anahtari_yok') return res.status(503).json({ ok: false, error: 'kurulum_bekleniyor' });
            hata(res, e, 'ayar yaz');
        }
    });

    // -----------------------------------------------------------------
    // Kayıtlar: panel listesinin kopyası
    // -----------------------------------------------------------------

    function kayitDuzelt(k) {
        if (!k || typeof k !== 'object') return null;
        const id = metin(k.id, 40);
        if (!/^[a-f0-9]{24}$/.test(id)) return null;
        const durum = Number(k.durum);
        if (![100, 200, 300, 400].includes(durum)) return null;
        return {
            id,
            durum,
            kayitTarihi: tarih(k.kayitTarihi),
            sonTarih: tarih(k.sonTarih),
            kriter: metin(k.kriter, 120),
            sikayet: metin(k.sikayet, 120),
            aciklama: metin(k.aciklama, 400),
            musteriNotu: metin(k.musteriNotu, 1200),
            urun: metin(k.urun, 240),
            itirazMetni: metin(k.itirazMetni, 2000),
            itirazSebepId: metin(k.itirazSebepId, 40),
        };
    }

    app.post('/api/itiraz/kayitlar', uye, async (req, res) => {
        const ham = Array.isArray(req.body && req.body.kayitlar) ? req.body.kayitlar.slice(0, 300) : [];
        const kayitlar = ham.map(kayitDuzelt).filter(Boolean);
        const kim = req.auth.username;
        try {
            if (kayitlar.length) {
                await pool.query(
                    `INSERT INTO itiraz.kayitlar
                        (username, kayit_id, durum, kayit_tarihi, son_tarih, kriter, sikayet, aciklama,
                         musteri_notu, urun, itiraz_metni, itiraz_sebep_id)
                     SELECT $1, x.id, x.durum, x."kayitTarihi"::timestamptz, x."sonTarih"::timestamptz, x.kriter,
                            x.sikayet, x.aciklama, x."musteriNotu", x.urun,
                            NULLIF(x."itirazMetni", ''), NULLIF(x."itirazSebepId", '')
                       FROM jsonb_to_recordset($2::jsonb) AS x(
                            id text, durum int, "kayitTarihi" text, "sonTarih" text, kriter text, sikayet text,
                            aciklama text, "musteriNotu" text, urun text, "itirazMetni" text, "itirazSebepId" text)
                     ON CONFLICT (username, kayit_id) DO UPDATE SET
                        durum = EXCLUDED.durum, kayit_tarihi = EXCLUDED.kayit_tarihi, son_tarih = EXCLUDED.son_tarih,
                        kriter = EXCLUDED.kriter, sikayet = EXCLUDED.sikayet, aciklama = EXCLUDED.aciklama,
                        musteri_notu = EXCLUDED.musteri_notu, urun = EXCLUDED.urun,
                        itiraz_metni = COALESCE(EXCLUDED.itiraz_metni, itiraz.kayitlar.itiraz_metni),
                        itiraz_sebep_id = COALESCE(EXCLUDED.itiraz_sebep_id, itiraz.kayitlar.itiraz_sebep_id),
                        son_gorulme = now()`,
                    [kim, JSON.stringify(kayitlar)]
                );
            }
            const r = await pool.query(
                `SELECT kayit_id, secilen_metin, secilen_sebep FROM itiraz.kayitlar
                  WHERE username = $1 AND kayit_id = ANY($2::text[]) AND secilen_metin IS NOT NULL`,
                [kim, kayitlar.map((k) => k.id)]
            );
            const secilenler = {};
            r.rows.forEach((s) => { secilenler[s.kayit_id] = { metin: s.secilen_metin, sebep: s.secilen_sebep || '' }; });
            res.json({ ok: true, secilenler });
        } catch (e) { hata(res, e, 'kayit yaz'); }
    });

    // -----------------------------------------------------------------
    // Yaz: Gemini ile üç taslak
    // -----------------------------------------------------------------

    function ornekSatiri(o) {
        const parca = [
            o.sikayet && 'Şikâyet: ' + o.sikayet,
            o.musteri_notu && 'Müşteri notu: ' + o.musteri_notu.slice(0, 300),
            'İtiraz: ' + (o.metin || '').slice(0, 600),
        ].filter(Boolean);
        return '- ' + parca.join(' | ');
    }

    app.post('/api/itiraz/yaz', uye, async (req, res) => {
        const kim = req.auth.username;
        const b = req.body || {};
        const id = metin(b.kayit_id, 40);
        if (!/^[a-f0-9]{24}$/.test(id)) return res.status(400).json({ ok: false, error: 'gecersiz' });
        const sebepler = Array.isArray(b.sebepler)
            ? [...new Set(b.sebepler.map((s) => metin(s, 140)).filter(Boolean))].slice(0, 25) : [];
        if (!sebepler.length) return res.status(400).json({ ok: false, error: 'sebep_listesi_yok' });
        const ekNot = metin(b.ek_not, 400);
        if (!pencere('yaz:' + kim, 6, 60000)) return res.status(429).json({ ok: false, error: 'cok_istek' });

        try {
            const ay = await pool.query('SELECT anahtar_sifreli, olgular FROM itiraz.ayarlar WHERE username = $1', [kim]);
            const anahtar = ay.rows[0] && coz(ay.rows[0].anahtar_sifreli);
            if (!anahtar) return res.status(400).json({ ok: false, error: 'anahtar_yok' });
            const olgular = (ay.rows[0].olgular || []).filter((o) => typeof o === 'string');

            const kr = await pool.query('SELECT * FROM itiraz.kayitlar WHERE username = $1 AND kayit_id = $2', [kim, id]);
            const k = kr.rows[0];
            if (!k) return res.status(404).json({ ok: false, error: 'kayit_yok' });

            const sayim = await pool.query(
                `INSERT INTO itiraz.kullanim (username, gun, sayi) VALUES ($1, (now() AT TIME ZONE 'Europe/Istanbul')::date, 1)
                 ON CONFLICT (username, gun) DO UPDATE SET sayi = itiraz.kullanim.sayi + 1 RETURNING sayi`,
                [kim]
            );
            if (sayim.rows[0].sayi > GUNLUK_YAZ) return res.status(429).json({ ok: false, error: 'gunluk_sinir' });

            const ornek = await pool.query(
                `SELECT durum, sikayet, musteri_notu, itiraz_metni AS metin FROM itiraz.kayitlar
                  WHERE username = $1 AND kayit_id <> $2 AND durum IN (300, 400) AND itiraz_metni IS NOT NULL
                  ORDER BY (sikayet = $3) DESC, kayit_tarihi DESC NULLS LAST LIMIT 12`,
                [kim, id, k.sikayet || '']
            );
            const secilen = await pool.query(
                `SELECT secilen_metin AS metin, sikayet FROM itiraz.kayitlar
                  WHERE username = $1 AND kayit_id <> $2 AND secilen_metin IS NOT NULL
                  ORDER BY son_gorulme DESC LIMIT 4`,
                [kim, id]
            );
            const kabul = ornek.rows.filter((o) => o.durum === 300).slice(0, 6);
            const red = ornek.rows.filter((o) => o.durum === 400).slice(0, 3);

            const istem = [
                'KAYIT',
                '- Kriter: ' + (k.kriter || '-'),
                '- Şikâyet: ' + (k.sikayet || '-'),
                k.aciklama && k.aciklama !== 'description' ? '- Açıklama: ' + k.aciklama : null,
                '- Ürün: ' + (k.urun || '-'),
                '- Müşteri notu: ' + (k.musteri_notu || '(not yok)'),
                ekNot ? '- Depo sorumlusunun ek bilgisi (doğru kabul et): ' + ekNot : null,
                '',
                'İŞARETLİ DEPO OLGULARI (yalnız bunlar doğru kabul edilir)',
                olgular.length ? olgular.map((o) => '- ' + o).join('\n') : '- (işaretli olgu yok; yalnız kayıttaki bilgiyi kullan)',
                '',
                'SEBEP LİSTESİ',
                sebepler.map((s) => '- ' + s).join('\n'),
                '',
                'KABUL EDİLEN ESKİ İTİRAZLAR',
                kabul.length ? kabul.map(ornekSatiri).join('\n') : '- (henüz yok)',
                '',
                'REDDEDİLEN ESKİ İTİRAZLAR',
                red.length ? red.map(ornekSatiri).join('\n') : '- (henüz yok)',
                '',
                'KULLANICININ SEÇİP DÜZENLEDİĞİ METİNLER (üslup)',
                secilen.rows.length ? secilen.rows.map(ornekSatiri).join('\n') : '- (henüz yok)',
                '',
                'Üç taslak yaz. "aci" alanı taslağın yaklaşımını 2 ile 4 kelimeyle anlatsın.',
            ].filter((x) => x !== null).join('\n');

            const sonuc = await gemini(anahtar, {
                systemInstruction: { parts: [{ text: TALIMAT }] },
                contents: [{ role: 'user', parts: [{ text: istem }] }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json',
                    responseSchema: SEMA,
                },
            });
            if (sonuc.hata) {
                const kod = sonuc.hata === 'anahtar_gecersiz' ? 400 : sonuc.hata === 'gemini_kota' ? 429 : 502;
                return res.status(kod).json({ ok: false, error: sonuc.hata });
            }
            const v = sonuc.veri || {};
            const taslaklar = (Array.isArray(v.taslaklar) ? v.taslaklar : [])
                .map((t) => ({ aci: metin(t && t.aci, 60), metin: metin(t && t.metin, 900).replace(/\s*\u2014\s*/g, ', ') }))
                .filter((t) => t.metin)
                .slice(0, 3);
            if (!taslaklar.length) return res.status(502).json({ ok: false, error: 'gemini_bicim' });
            const sebep = sebepler.includes(v.sebep) ? v.sebep : '';
            res.json({ ok: true, sebep, taslaklar });
        } catch (e) { hata(res, e, 'yaz'); }
    });

    app.post('/api/itiraz/sec', uye, async (req, res) => {
        const b = req.body || {};
        const id = metin(b.kayit_id, 40);
        const m = metin(b.metin, 2000);
        if (!/^[a-f0-9]{24}$/.test(id) || !m) return res.status(400).json({ ok: false, error: 'gecersiz' });
        try {
            await pool.query(
                `UPDATE itiraz.kayitlar SET secilen_metin = $3, secilen_sebep = $4
                  WHERE username = $1 AND kayit_id = $2`,
                [req.auth.username, id, m, metin(b.sebep, 140) || null]
            );
            res.json({ ok: true });
        } catch (e) { hata(res, e, 'sec'); }
    });
}

module.exports = { kur };
