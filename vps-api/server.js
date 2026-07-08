const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

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

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Jet Barkod API calisiyor: 127.0.0.1:${PORT}`);
});
