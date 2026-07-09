const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const STORAGE_ROOT = process.env.STORAGE_ROOT || '/var/www/jetbarkod-storage';
const refreshSignals = new Map();

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

app.use(express.json({ limit: '1mb' }));
app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error('CORS blocked'));
        },
    })
);

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
        if (row.blocked_until && new Date(row.blocked_until) > now) {
            return false;
        }
        if (row.attempts >= maxAttempts && new Date(existing.rows[0].last_attempt || 0) > cutoff) {
            return false;
        }
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
         SET attempts = $2,
             last_attempt = $3,
             blocked_until = CASE WHEN $2 >= 5 THEN $4 ELSE blocked_until END
         WHERE id = $1`,
        [existing.rows[0].id, attempts, now, blockedUntil]
    );
}

async function updateTrackedIPs(user, clientIP) {
    if (user.ip_tracking_enabled === false) return { success: true };

    const tracked = Array.isArray(user.tracked_ips) ? user.tracked_ips.filter(Boolean) : [];
    if (tracked.includes(clientIP)) return { success: true };

    const maxCount = user.max_ip_count || 5;
    if (tracked.length >= maxCount) {
        return { success: false };
    }

    const next = [...tracked, clientIP];
    await pool.query('UPDATE users SET tracked_ips = $1, updated_at = NOW() WHERE id = $2', [
        next,
        user.id,
    ]);
    return { success: true };
}

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

app.post('/api/auth/login', async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const clientIP = String(req.body?.clientIP || req.headers['x-client-ip'] || req.ip || 'unknown')
        .replace('::ffff:', '');

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
            `SELECT id, username, password, company, contact_email, trial_end, is_active, is_admin,
                    premium_features, max_ip_count, ip_tracking_enabled, allowed_ips, tracked_ips
             FROM users
             WHERE username = $1
             LIMIT 1`,
            [username]
        );

        if (userResult.rowCount === 0) {
            await recordFailedAttempt(clientIP);
            return res.status(401).json({ ok: false, error: 'Kullanıcı bulunamadı!' });
        }

        const user = userResult.rows[0];

        if (user.password !== password) {
            await recordFailedAttempt(clientIP);
            return res.status(401).json({ ok: false, error: 'Hatalı şifre!' });
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

        try {
            await pool.query(
                `INSERT INTO ip_logs (username, ip_address, user_agent, login_time)
                 VALUES ($1, $2::inet, $3, NOW())`,
                [username, clientIP, req.headers['user-agent'] || '']
            );
        } catch (logErr) {
            console.warn('ip_logs insert failed:', logErr.message);
        }

        const session = {
            username: user.username,
            company: user.company || '',
            trialEnd: user.trial_end,
            isAdmin: !!user.is_admin,
            loginTime: new Date().toISOString(),
            clientIP,
        };

        return res.json({
            ok: true,
            session,
            premiumFeatures: user.premium_features || {},
        });
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ ok: false, error: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

app.post('/api/broadcast/refresh', async (req, res) => {
    const username = String(req.body?.username || '').trim();
    if (!username) {
        return res.status(400).json({ ok: false, error: 'username required' });
    }
    refreshSignals.set(username, {
        at: Date.now(),
        payload: { username, timestamp: new Date().toISOString() },
    });
    return res.json({ ok: true });
});

app.get('/api/broadcast/refresh/:username', (req, res) => {
    const username = req.params.username;
    const sig = refreshSignals.get(username);
    if (!sig || Date.now() - sig.at > 60000) {
        return res.json({ pending: false });
    }
    refreshSignals.delete(username);
    return res.json({ pending: true, payload: sig.payload });
});

const ADMIN_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';
const TELEGRAM_TIMEOUT_MS = 8000;
const telegramRateMap = new Map();
const TELEGRAM_RATE_WINDOW_MS = 60 * 1000;
const TELEGRAM_RATE_MAX = 20;

function checkTelegramRate(clientIP) {
    const now = Date.now();
    const entry = telegramRateMap.get(clientIP) || { count: 0, start: now };
    if (now - entry.start > TELEGRAM_RATE_WINDOW_MS) {
        entry.count = 0;
        entry.start = now;
    }
    entry.count += 1;
    telegramRateMap.set(clientIP, entry);
    return entry.count <= TELEGRAM_RATE_MAX;
}

async function loadTelegramSettings() {
    const result = await pool.query(
        `SELECT telegram_bot_token, telegram_chat_id
         FROM admin_settings
         WHERE id = $1
         LIMIT 1`,
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
        const telegramResp = await fetch(
            `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: settings.telegram_chat_id,
                    text,
                }),
                signal: controller.signal,
            }
        );

        clearTimeout(timeout);

        if (!telegramResp.ok) {
            const detail = await telegramResp.text().catch(() => 'unknown');
            return { ok: false, error: 'telegram_error', detail };
        }

        return { ok: true };
    } catch (error) {
        clearTimeout(timeout);
        return { ok: false, error: 'exception', detail: String(error) };
    }
}

app.post('/api/telegram/notify', async (req, res) => {
    const clientIP = String(req.headers['x-client-ip'] || req.headers['x-forwarded-for'] || req.ip || 'unknown')
        .split(',')[0]
        .trim()
        .replace('::ffff:', '');

    if (!checkTelegramRate(clientIP)) {
        return res.status(429).json({ ok: false, error: 'rate_limited' });
    }

    const username = String(req.body?.username || 'Bilinmiyor').trim().slice(0, 120);
    const message = String(req.body?.message || '').trim().slice(0, 2000);
    const isTest = Boolean(req.body?.isTest);

    if (!isTest && !message) {
        return res.status(400).json({ ok: false, error: 'message_required' });
    }

    try {
        const result = await dispatchTelegramMessage({ username, message, isTest });
        if (result.skipped) {
            return res.json(result);
        }
        if (!result.ok) {
            console.error('telegram notify failed:', result);
            return res.status(500).json(result);
        }
        return res.json({ ok: true });
    } catch (err) {
        console.error('telegram notify error:', err);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

app.post(
    '/storage/v1/object/*',
    express.raw({ type: '*/*', limit: '12mb' }),
    (req, res) => {
        try {
            const rest = req.params[0] || '';
            const slash = rest.indexOf('/');
            if (slash < 1) {
                return res.status(400).json({ error: 'invalid storage path' });
            }
            const bucket = rest.slice(0, slash);
            const filePath = rest.slice(slash + 1);
            const target = path.join(STORAGE_ROOT, bucket, filePath);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, req.body);
            return res.status(200).json({ Key: filePath });
        } catch (e) {
            console.error('storage upload error:', e);
            return res.status(500).json({ error: e.message });
        }
    }
);

app.use('/storage/v1/object/public', express.static(STORAGE_ROOT));

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Jet Barkod API calisiyor: 127.0.0.1:${PORT}`);
});
