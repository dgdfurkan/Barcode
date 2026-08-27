/**
 * Jet Barkod API
 *
 * GÜVENLİK MODELİ
 * ---------------
 * - Bu servis veritabanına tablo SAHİBİ (jetbarkod) rolüyle bağlanır, yani
 *   RLS'i bypass eder. Bu bilinçlidir: login, admin ve misafir sohbeti gibi
 *   işlemler için gereklidir. Bu yüzden BURADAKİ HER ENDPOINT kendi yetki
 *   kontrolünü yapmak zorundadır.
 * - Tarayıcının doğrudan veritabanına eriştiği yol (PostgREST /rest/v1)
 *   ayrı ve kısıtlı rollerle (web_anon / web_user / web_admin) çalışır ve
 *   RLS ile satır bazında sınırlanır. Bkz. sql_files/security_01_roles_and_rls.sql
 * - İstemciden gelen HİÇBİR kimlik iddiasına güvenilmez: IP, kullanıcı adı,
 *   admin bayrağı — hepsi ya sunucuda üretilir ya da imzalı JWT'den okunur.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT || '/var/www/jetbarkod-storage');
const refreshSignals = new Map();

// ---------------------------------------------------------------------
// Zorunlu sırlar — eksikse servis hiç açılmaz (sessizce güvensiz çalışmaz)
// ---------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error(
        'FATAL: JWT_SECRET tanımlı değil veya 32 karakterden kısa.\n' +
        'Üretmek için: openssl rand -base64 48\n' +
        've .env dosyasına JWT_SECRET=... olarak ekleyin. ' +
        'Aynı değer postgrest.env içindeki jwt-secret ile AYNI olmalıdır.'
    );
    process.exit(1);
}

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 24 * 60 * 60);
const GUEST_TTL_SECONDS = Number(process.env.GUEST_TTL_SECONDS || 30 * 24 * 60 * 60);

const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'jetbarkod',
    user: process.env.DB_USER || 'jetbarkod',
    password: process.env.DB_PASSWORD,
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Apache/Nginx arkasındayız: gerçek istemci IP'si X-Forwarded-For'dan gelir.
// Bu ayar olmadan req.ip her zaman 127.0.0.1 olur.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

app.use(
    cors({
        origin(origin, callback) {
            // Origin yoksa (curl, sunucu-sunucu) izin ver; yetkilendirme zaten
            // Authorization başlığına bağlı, CORS bir yetki katmanı değildir.
            if (!origin) return callback(null, true);
            if (allowedOrigins.length === 0) {
                // Yapılandırma eksikse KAPALI davran (önceden herkese açıktı).
                console.warn('ALLOWED_ORIGINS boş — tarayıcı isteği reddedildi:', origin);
                return callback(null, false);
            }
            return callback(null, allowedOrigins.includes(origin));
        },
        credentials: false,
    })
);

// =====================================================================
// Yardımcılar
// =====================================================================

/** Gerçek istemci IP'si. İstemcinin gönderdiği gövdeye ASLA bakılmaz. */
function clientIpOf(req) {
    return String(req.ip || '').replace('::ffff:', '') || 'unknown';
}

function signSessionToken(user) {
    const isAdmin = !!user.is_admin;
    return jwt.sign(
        {
            role: isAdmin ? 'web_admin' : 'web_user',
            username: user.username,
            is_admin: isAdmin,
        },
        JWT_SECRET,
        { expiresIn: SESSION_TTL_SECONDS, algorithm: 'HS256' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
        return null;
    }
}

function bearerOf(req) {
    const h = req.headers.authorization || '';
    return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/** Giriş yapmış kullanıcı zorunlu. */
function requireUser(req, res, next) {
    const claims = verifyToken(bearerOf(req));
    if (!claims || !claims.username) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    req.auth = claims;
    next();
}

/** Admin zorunlu — is_admin İMZALI token'dan okunur, istemci iddiasından değil. */
function requireAdmin(req, res, next) {
    const claims = verifyToken(bearerOf(req));
    if (!claims || !claims.username) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!claims.is_admin) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    req.auth = claims;
    next();
}

function validateIP(clientIP, allowedIPs) {
    if (!allowedIPs || allowedIPs.length === 0) return true;
    if (allowedIPs.includes('*')) return true;
    return allowedIPs.includes(clientIP);
}

function checkTrialExpiry(trialEnd) {
    if (!trialEnd) return true;
    return new Date() <= new Date(trialEnd);
}

async function isIPBlocked(clientIP) {
    const result = await pool.query(
        'SELECT 1 FROM blocked_ips WHERE ip_address = $1 LIMIT 1',
        [clientIP]
    );
    return result.rowCount > 0;
}

// =====================================================================
// Parola: düz metinden bcrypt'e sessiz geçiş
// =====================================================================
// Mevcut kayıtlar düz metin. Kullanıcı ilk girişinde parolası hash'lenip
// password_hash'e yazılır, düz metin kolonu NULL'lanır. Kimse fark etmez,
// kimse dışarıda kalmaz. Herkes bir kez girdikten sonra password kolonu
// security_02 ile düşürülebilir.
const BCRYPT_ROUNDS = 12;

async function verifyAndUpgradePassword(user, plainPassword) {
    if (user.password_hash) {
        return bcrypt.compare(plainPassword, user.password_hash);
    }

    // Henüz hash'lenmemiş eski kayıt
    if (typeof user.password === 'string' && user.password.length > 0) {
        // Zamanlama farkını sızdırmamak için sabit süreli karşılaştırma
        const a = Buffer.from(user.password);
        const b = Buffer.from(plainPassword);
        const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
        if (!ok) return false;

        try {
            const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
            await pool.query(
                'UPDATE users SET password_hash = $1, password = NULL, updated_at = NOW() WHERE id = $2',
                [hash, user.id]
            );
            console.log(`parola bcrypt'e taşındı: ${user.username}`);
        } catch (e) {
            console.error('parola hash yazılamadı:', e.message);
        }
        return true;
    }

    return false;
}

// =====================================================================
// Oran sınırlama — GERÇEK IP ile (eskiden istemcinin gönderdiği IP idi)
// =====================================================================
async function checkRateLimit(clientIP) {
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 5;
    const now = new Date();
    const cutoff = new Date(now.getTime() - windowMs);

    const existing = await pool.query(
        'SELECT id, attempts, blocked_until, last_attempt FROM rate_limits WHERE ip_address = $1::inet ORDER BY last_attempt DESC LIMIT 1',
        [clientIP]
    );

    if (existing.rowCount > 0) {
        const row = existing.rows[0];
        if (row.blocked_until && new Date(row.blocked_until) > now) return false;
        if (row.attempts >= maxAttempts && new Date(row.last_attempt || 0) > cutoff) return false;
    }
    return true;
}

async function recordFailedAttempt(clientIP) {
    const now = new Date();
    const blockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
    const existing = await pool.query(
        'SELECT id, attempts FROM rate_limits WHERE ip_address = $1::inet ORDER BY last_attempt DESC LIMIT 1',
        [clientIP]
    );
    if (existing.rowCount === 0) {
        await pool.query(
            'INSERT INTO rate_limits (ip_address, attempts, last_attempt) VALUES ($1::inet, 1, $2)',
            [clientIP, now]
        );
        return;
    }
    const attempts = (existing.rows[0].attempts || 0) + 1;
    await pool.query(
        `UPDATE rate_limits
         SET attempts = $2, last_attempt = $3,
             blocked_until = CASE WHEN $2 >= 5 THEN $4 ELSE blocked_until END
         WHERE id = $1`,
        [existing.rows[0].id, attempts, now, blockedUntil]
    );
}

async function clearRateLimit(clientIP) {
    try {
        await pool.query('DELETE FROM rate_limits WHERE ip_address = $1::inet', [clientIP]);
    } catch (e) { /* kritik değil */ }
}

async function updateTrackedIPs(user, clientIP) {
    if (user.ip_tracking_enabled === false) return { success: true };
    const tracked = Array.isArray(user.tracked_ips) ? user.tracked_ips.filter(Boolean) : [];
    if (tracked.includes(clientIP)) return { success: true };
    const maxCount = user.max_ip_count || 5;
    if (tracked.length >= maxCount) return { success: false };
    await pool.query('UPDATE users SET tracked_ips = $1, updated_at = NOW() WHERE id = $2', [
        [...tracked, clientIP],
        user.id,
    ]);
    return { success: true };
}

// =====================================================================
// Sağlık
// =====================================================================
app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'jetbarkod-api', time: new Date().toISOString() });
});

app.get('/health/db', async (req, res) => {
    try {
        const r = await pool.query('SELECT NOW() as now');
        res.json({ ok: true, db: 'connected', server_time: r.rows[0].now });
    } catch (e) {
        res.status(500).json({ ok: false, error: 'db_connection_failed' });
    }
});

// =====================================================================
// Giriş
// =====================================================================
app.post('/api/auth/login', async (req, res) => {
    const username = String(req.body?.username || '').trim().slice(0, 64);
    const password = String(req.body?.password || '').slice(0, 256);
    // DİKKAT: IP artık gövdeden DEĞİL, bağlantıdan alınır.
    const clientIP = clientIpOf(req);

    if (!username || !password) {
        return res.status(400).json({ ok: false, error: 'Kullanıcı adı ve şifre gerekli.' });
    }

    try {
        if (!(await checkRateLimit(clientIP))) {
            return res.status(429).json({
                ok: false,
                error: 'Çok fazla başarısız giriş denemesi! 15 dakika sonra tekrar deneyin.',
            });
        }

        if (await isIPBlocked(clientIP)) {
            return res.status(403).json({
                ok: false,
                error: 'Bu IP adresi engellenmiştir.',
                code: 'ip_blocked',
            });
        }

        const userResult = await pool.query(
            `SELECT id, username, password, password_hash, company, contact_email, trial_end,
                    is_active, is_admin, premium_features, max_ip_count, ip_tracking_enabled,
                    allowed_ips, tracked_ips
             FROM users WHERE username = $1 LIMIT 1`,
            [username]
        );

        // Kullanıcı adı sızdırmamak için "yok" ve "yanlış parola" aynı mesajı döner.
        if (userResult.rowCount === 0) {
            await bcrypt.hash(password, BCRYPT_ROUNDS).catch(() => {}); // zamanlama eşitleme
            await recordFailedAttempt(clientIP);
            return res.status(401).json({ ok: false, error: 'Kullanıcı adı veya şifre hatalı!' });
        }

        const user = userResult.rows[0];

        if (!(await verifyAndUpgradePassword(user, password))) {
            await recordFailedAttempt(clientIP);
            return res.status(401).json({ ok: false, error: 'Kullanıcı adı veya şifre hatalı!' });
        }

        if (!user.is_active) {
            return res.status(403).json({ ok: false, error: 'Hesabınız deaktif edilmiş!' });
        }

        if (!validateIP(clientIP, user.allowed_ips)) {
            return res.status(403).json({
                ok: false,
                error: `Bu IP adresinden giriş yapılamaz! (${clientIP})`,
            });
        }

        if (!checkTrialExpiry(user.trial_end)) {
            return res.status(403).json({
                ok: false,
                error: 'Test süreniz dolmuş! Lütfen destek ile iletişime geçin.',
                code: 'trial_expired',
            });
        }

        const ipTrack = await updateTrackedIPs(user, clientIP);
        if (!ipTrack.success) {
            return res.status(403).json({
                ok: false,
                error: `IP sınırı aşıldı! Maksimum ${user.max_ip_count || 5} farklı IP kullanabilirsiniz.`,
            });
        }

        await clearRateLimit(clientIP);

        try {
            await pool.query(
                `INSERT INTO ip_logs (username, ip_address, user_agent, login_time)
                 VALUES ($1, $2::inet, $3, NOW())`,
                [username, clientIP, String(req.headers['user-agent'] || '').slice(0, 500)]
            );
        } catch (logErr) {
            console.warn('ip_logs insert failed:', logErr.message);
        }

        const token = signSessionToken(user);
        const decoded = jwt.decode(token);

        return res.json({
            ok: true,
            token,
            expiresAt: new Date(decoded.exp * 1000).toISOString(),
            session: {
                username: user.username,
                company: user.company || '',
                trialEnd: user.trial_end,
                isAdmin: !!user.is_admin,
                loginTime: new Date().toISOString(),
                clientIP,
                exp: decoded.exp,
            },
            premiumFeatures: user.premium_features || {},
        });
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ ok: false, error: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

/** Oturumun hâlâ geçerli olup olmadığını sunucuya sordurur.
 *  "localde girili görünüyor ama aslında düşmüş" durumunu bitirir. */
app.get('/api/auth/session', async (req, res) => {
    const claims = verifyToken(bearerOf(req));
    if (!claims) return res.status(401).json({ ok: false, error: 'invalid_token' });

    try {
        const r = await pool.query(
            `SELECT username, company, trial_end, is_active, is_admin, premium_features
             FROM users WHERE username = $1 LIMIT 1`,
            [claims.username]
        );
        if (r.rowCount === 0) return res.status(401).json({ ok: false, error: 'user_gone' });

        const u = r.rows[0];
        if (!u.is_active) return res.status(403).json({ ok: false, error: 'inactive', code: 'inactive' });
        if (!checkTrialExpiry(u.trial_end)) {
            return res.status(403).json({ ok: false, error: 'trial_expired', code: 'trial_expired' });
        }

        return res.json({
            ok: true,
            session: {
                username: u.username,
                company: u.company || '',
                trialEnd: u.trial_end,
                isAdmin: !!u.is_admin,
                exp: claims.exp,
            },
            premiumFeatures: u.premium_features || {},
        });
    } catch (e) {
        console.error('session check error:', e);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

/** Kendi IP'nin engelli olup olmadığını söyler.
 *  (Eskiden tarayıcı blocked_ips tablosunu okuyordu; artık okuyamıyor.) */
app.get('/api/ip/status', async (req, res) => {
    const clientIP = clientIpOf(req);
    try {
        const blocked = await isIPBlocked(clientIP);
        return res.json({ ok: true, ip: clientIP, blocked });
    } catch (e) {
        return res.json({ ok: true, ip: clientIP, blocked: false });
    }
});

// =====================================================================
// Misafir sohbeti — tamamen sunucu tarafında
// =====================================================================
// guest_chats tablosuna tarayıcıdan HİÇBİR erişim yok. Ziyaretçi imzalı bir
// misafir token'ı alır ve yalnızca kendi konuşmasını okuyup yazabilir.
// Böylece "Kullanıcı101, Kullanıcı102..." diye sırayla deneyerek başkalarının
// destek yazışmalarını okumak imkânsız hale gelir.

function signGuestToken(guestId, username) {
    return jwt.sign(
        { role: 'guest', guest_id: guestId, username },
        JWT_SECRET,
        { expiresIn: GUEST_TTL_SECONDS, algorithm: 'HS256' }
    );
}

function guestClaimsOf(req) {
    const claims = verifyToken(bearerOf(req));
    if (!claims || claims.role !== 'guest' || !claims.username) return null;
    return claims;
}

const GUEST_PREFIX = 'Kullanıcı';

app.post('/api/guest/session', async (req, res) => {
    const clientIP = clientIpOf(req);

    // Geçerli token varsa aynı kimliği koru
    const existingClaims = guestClaimsOf(req);
    if (existingClaims) {
        return res.json({
            ok: true,
            username: existingClaims.username,
            token: bearerOf(req),
            reused: true,
        });
    }

    try {
        // Aynı IP'den daha önce gelmişse aynı misafir kimliğini ver
        const prior = await pool.query(
            `SELECT id, username FROM guest_chats
             WHERE ip_address = $1 AND username LIKE $2
             ORDER BY last_chat_update DESC NULLS LAST LIMIT 1`,
            [clientIP, GUEST_PREFIX + '%']
        );

        if (prior.rowCount > 0) {
            const row = prior.rows[0];
            return res.json({
                ok: true,
                username: row.username,
                token: signGuestToken(row.id, row.username),
                reused: true,
            });
        }

        // Yeni misafir numarası — yarış durumuna karşı tek sorguda
        const next = await pool.query(
            `SELECT COALESCE(MAX(NULLIF(regexp_replace(username, '\\D', '', 'g'), '')::int), 99) + 1 AS n
             FROM guest_chats WHERE username LIKE $1`,
            [GUEST_PREFIX + '%']
        );
        const username = GUEST_PREFIX + next.rows[0].n;

        const ins = await pool.query(
            `INSERT INTO guest_chats (username, ip_address, chat_messages, last_chat_update)
             VALUES ($1, $2, '[]', NOW())
             ON CONFLICT (username) DO UPDATE SET ip_address = EXCLUDED.ip_address
             RETURNING id, username`,
            [username, clientIP]
        );
        const row = ins.rows[0];

        return res.json({
            ok: true,
            username: row.username,
            token: signGuestToken(row.id, row.username),
            reused: false,
        });
    } catch (e) {
        console.error('guest session error:', e);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

app.get('/api/guest/chat', async (req, res) => {
    const claims = guestClaimsOf(req);
    if (!claims) return res.status(401).json({ ok: false, error: 'unauthorized' });

    try {
        const r = await pool.query(
            'SELECT chat_messages, last_chat_update FROM guest_chats WHERE username = $1 LIMIT 1',
            [claims.username]
        );
        if (r.rowCount === 0) return res.json({ ok: true, messages: [] });

        let messages = [];
        try {
            messages = JSON.parse(r.rows[0].chat_messages || '[]');
        } catch (e) { messages = []; }

        return res.json({ ok: true, messages, lastUpdate: r.rows[0].last_chat_update });
    } catch (e) {
        console.error('guest chat read error:', e);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

const GUEST_MSG_MAX = 2000;
const GUEST_THREAD_MAX = 200;
const guestWriteRate = new Map();

function guestWriteAllowed(key) {
    const now = Date.now();
    const e = guestWriteRate.get(key) || { count: 0, start: now };
    if (now - e.start > 60_000) { e.count = 0; e.start = now; }
    e.count += 1;
    guestWriteRate.set(key, e);
    return e.count <= 15;
}

app.post('/api/guest/chat', async (req, res) => {
    const claims = guestClaimsOf(req);
    if (!claims) return res.status(401).json({ ok: false, error: 'unauthorized' });

    if (!guestWriteAllowed(claims.username)) {
        return res.status(429).json({ ok: false, error: 'rate_limited' });
    }

    const text = String(req.body?.message || '').trim().slice(0, GUEST_MSG_MAX);
    if (!text) return res.status(400).json({ ok: false, error: 'message_required' });

    try {
        const r = await pool.query(
            'SELECT chat_messages FROM guest_chats WHERE username = $1 LIMIT 1',
            [claims.username]
        );
        if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'guest_not_found' });

        let messages = [];
        try { messages = JSON.parse(r.rows[0].chat_messages || '[]'); } catch (e) { messages = []; }
        if (!Array.isArray(messages)) messages = [];

        // sender DAİMA 'user' — istemci 'admin' gibi davranamaz
        messages.push({
            sender: 'user',
            message: text,
            timestamp: new Date().toISOString(),
        });
        if (messages.length > GUEST_THREAD_MAX) {
            messages = messages.slice(-GUEST_THREAD_MAX);
        }

        await pool.query(
            'UPDATE guest_chats SET chat_messages = $1, last_chat_update = NOW() WHERE username = $2',
            [JSON.stringify(messages), claims.username]
        );

        dispatchTelegramMessage({ username: claims.username, message: text })
            .catch((e) => console.warn('telegram bildirimi atlandı:', e?.message));

        return res.json({ ok: true, messages });
    } catch (e) {
        console.error('guest chat write error:', e);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

// =====================================================================
// Yenileme sinyali (admin -> kullanıcı sayfasını tazele)
// =====================================================================
app.post('/api/broadcast/refresh', requireAdmin, async (req, res) => {
    const username = String(req.body?.username || '').trim().slice(0, 64);
    if (!username) return res.status(400).json({ ok: false, error: 'username required' });
    refreshSignals.set(username, {
        at: Date.now(),
        payload: { username, timestamp: new Date().toISOString() },
    });
    return res.json({ ok: true });
});

app.get('/api/broadcast/refresh/:username', requireUser, (req, res) => {
    // Yalnızca kendi sinyalini sorgulayabilir
    if (req.params.username !== req.auth.username && !req.auth.is_admin) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    const sig = refreshSignals.get(req.params.username);
    if (!sig || Date.now() - sig.at > 60000) return res.json({ pending: false });
    refreshSignals.delete(req.params.username);
    return res.json({ pending: true, payload: sig.payload });
});

// =====================================================================
// Telegram
// =====================================================================
const ADMIN_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';
const TELEGRAM_TIMEOUT_MS = 8000;
const telegramRateMap = new Map();

function checkTelegramRate(key) {
    const now = Date.now();
    const entry = telegramRateMap.get(key) || { count: 0, start: now };
    if (now - entry.start > 60_000) { entry.count = 0; entry.start = now; }
    entry.count += 1;
    telegramRateMap.set(key, entry);
    return entry.count <= 20;
}

async function loadTelegramSettings() {
    const result = await pool.query(
        `SELECT telegram_bot_token, telegram_chat_id FROM admin_settings WHERE id = $1 LIMIT 1`,
        [ADMIN_SETTINGS_ID]
    );
    return result.rows[0] || null;
}

async function dispatchTelegramMessage({ username, message, isTest = false }) {
    const settings = await loadTelegramSettings();
    if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) {
        return { skipped: true, reason: 'missing_settings' };
    }

    const text = isTest
        ? 'Test başarılı!'
        : `📩 Yeni Destek Mesajı!\nKimden: ${username}\nMesaj: ${message}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    try {
        const resp = await fetch(
            `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: settings.telegram_chat_id, text }),
                signal: controller.signal,
            }
        );
        clearTimeout(timeout);
        if (!resp.ok) {
            const detail = await resp.text().catch(() => 'unknown');
            return { ok: false, error: 'telegram_error', detail };
        }
        return { ok: true };
    } catch (error) {
        clearTimeout(timeout);
        return { ok: false, error: 'exception', detail: String(error) };
    }
}

// Artık kimlik doğrulaması zorunlu: eskiden internetteki herkes
// buradan bot'a mesaj gönderebiliyordu.
app.post('/api/telegram/notify', requireUser, async (req, res) => {
    if (!checkTelegramRate(req.auth.username)) {
        return res.status(429).json({ ok: false, error: 'rate_limited' });
    }
    const message = String(req.body?.message || '').trim().slice(0, 2000);
    const isTest = Boolean(req.body?.isTest) && req.auth.is_admin;
    if (!isTest && !message) {
        return res.status(400).json({ ok: false, error: 'message_required' });
    }
    try {
        // Gönderen adı token'dan gelir — taklit edilemez
        const result = await dispatchTelegramMessage({ username: req.auth.username, message, isTest });
        if (result.skipped) return res.json(result);
        if (!result.ok) {
            console.error('telegram notify failed:', result);
            return res.status(500).json({ ok: false, error: 'telegram_error' });
        }
        return res.json({ ok: true });
    } catch (err) {
        console.error('telegram notify error:', err);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

/**
 * Admin ayarları — admin_settings tablosu tarayıcıya TAMAMEN kapalı.
 * Bu tablo Telegram bot token'ı, Gemini ve Cloudinary anahtarlarını tutuyor.
 *
 * GET  sırların DEĞERİNİ döndürmez; yalnızca "tanımlı mı" bilgisini ve
 *      gizli olmayan alanları (chat id, cloud adı) döndürür.
 * POST boş bırakılan sır alanlarını DEĞİŞTİRMEZ (COALESCE/NULLIF) —
 *      böylece admin, mevcut token'ı görmeden diğer ayarları kaydedebilir.
 */
const SECRET_SETTING_FIELDS = ['telegram_bot_token', 'gemini_api_key', 'cloudinary_api_key'];
const PLAIN_SETTING_FIELDS = ['telegram_chat_id', 'cloudinary_cloud_name', 'cloudinary_upload_preset'];

app.get('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM admin_settings WHERE id = $1 LIMIT 1', [ADMIN_SETTINGS_ID]);
        const row = r.rows[0] || {};
        const out = { ok: true, configured: {} };
        for (const f of SECRET_SETTING_FIELDS) {
            out.configured[f] = !!(row[f] && String(row[f]).length);
        }
        for (const f of PLAIN_SETTING_FIELDS) {
            out[f] = row[f] || '';
        }
        return res.json(out);
    } catch (e) {
        console.error('admin settings read error:', e);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

app.post('/api/admin/settings', requireAdmin, async (req, res) => {
    const body = req.body || {};
    const vals = {};
    for (const f of [...SECRET_SETTING_FIELDS, ...PLAIN_SETTING_FIELDS]) {
        vals[f] = String(body[f] ?? '').trim().slice(0, 500);
    }
    try {
        await pool.query(
            `INSERT INTO admin_settings
                (id, telegram_bot_token, telegram_chat_id, gemini_api_key,
                 cloudinary_api_key, cloudinary_cloud_name, cloudinary_upload_preset)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (id) DO UPDATE SET
                telegram_bot_token       = COALESCE(NULLIF(EXCLUDED.telegram_bot_token,''),       admin_settings.telegram_bot_token),
                gemini_api_key           = COALESCE(NULLIF(EXCLUDED.gemini_api_key,''),           admin_settings.gemini_api_key),
                cloudinary_api_key       = COALESCE(NULLIF(EXCLUDED.cloudinary_api_key,''),       admin_settings.cloudinary_api_key),
                telegram_chat_id         = NULLIF(EXCLUDED.telegram_chat_id,''),
                cloudinary_cloud_name    = NULLIF(EXCLUDED.cloudinary_cloud_name,''),
                cloudinary_upload_preset = NULLIF(EXCLUDED.cloudinary_upload_preset,'')`,
            [
                ADMIN_SETTINGS_ID,
                vals.telegram_bot_token, vals.telegram_chat_id, vals.gemini_api_key,
                vals.cloudinary_api_key, vals.cloudinary_cloud_name, vals.cloudinary_upload_preset,
            ]
        );
        return res.json({ ok: true });
    } catch (e) {
        console.error('admin settings save error:', e);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

// =====================================================================
// Depolama — kimlik doğrulamalı, dizin dışına çıkış imkânsız
// =====================================================================
const STORAGE_MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_UPLOAD_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.pdf']);
const ALLOWED_BUCKETS = new Set(['update-images']);

app.post(
    '/storage/v1/object/*',
    requireAdmin, // yükleme yalnızca admin
    express.raw({ type: '*/*', limit: STORAGE_MAX_BYTES }),
    (req, res) => {
        try {
            const rest = req.params[0] || '';
            const slash = rest.indexOf('/');
            if (slash < 1) return res.status(400).json({ error: 'invalid storage path' });

            const bucket = rest.slice(0, slash);
            const filePath = rest.slice(slash + 1);

            if (!ALLOWED_BUCKETS.has(bucket)) {
                return res.status(400).json({ error: 'invalid bucket' });
            }

            // Yol parçalarını tek tek doğrula: '..', '.', boş ve ayraç içerenler reddedilir.
            const segments = filePath.split('/').filter(Boolean);
            if (segments.length === 0 || segments.length > 4) {
                return res.status(400).json({ error: 'invalid path' });
            }
            for (const seg of segments) {
                if (seg === '.' || seg === '..' || !/^[A-Za-z0-9._-]+$/.test(seg)) {
                    return res.status(400).json({ error: 'invalid path segment' });
                }
            }

            const ext = path.extname(segments[segments.length - 1]).toLowerCase();
            if (!ALLOWED_UPLOAD_EXT.has(ext)) {
                return res.status(400).json({ error: 'file type not allowed' });
            }

            const bucketRoot = path.resolve(STORAGE_ROOT, bucket);
            const target = path.resolve(bucketRoot, ...segments);

            // Son savunma: hedef gerçekten bucket kökünün içinde mi?
            if (target !== bucketRoot && !target.startsWith(bucketRoot + path.sep)) {
                console.warn('storage traversal denied:', rest);
                return res.status(400).json({ error: 'invalid path' });
            }

            if (!req.body || !req.body.length) {
                return res.status(400).json({ error: 'empty body' });
            }

            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, req.body);
            return res.status(200).json({ Key: segments.join('/') });
        } catch (e) {
            console.error('storage upload error:', e.message);
            return res.status(500).json({ error: 'upload_failed' });
        }
    }
);

app.use(
    '/storage/v1/object/public',
    express.static(STORAGE_ROOT, {
        dotfiles: 'deny',
        index: false,
        setHeaders(res) {
            // Yüklenen dosya tarayıcıda script olarak yorumlanmasın
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        },
    })
);

app.use((req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Jet Barkod API calisiyor: 127.0.0.1:${PORT}`);
    console.log(`  CORS izinli origin sayisi: ${allowedOrigins.length}`);
    console.log(`  Oturum suresi: ${SESSION_TTL_SECONDS}s`);
});
