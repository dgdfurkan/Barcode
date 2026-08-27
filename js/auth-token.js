/**
 * Jet Barkod — merkezi oturum token'ı yönetimi
 *
 * Sunucu girişte HS256 ile İMZALI bir JWT üretir. Bu token:
 *   - her PostgREST isteğine Authorization başlığı olarak eklenir,
 *   - veritabanında RLS politikalarını sürer (username / is_admin claim'leri),
 *   - süresi dolduğunda veritabanı tarafından reddedilir.
 *
 * Eskiden oturum, imzasız base64 idi; tarayıcıda `isAdmin:true` yazan herkes
 * admin oluyordu. Artık claim'ler imzalı olduğu için taklit edilemez.
 *
 * NOT: Buradaki süre kontrolü yalnızca ARAYÜZ içindir (kullanıcıyı zamanında
 * giriş ekranına almak için). Gerçek yetki kararı her zaman sunucuda ve
 * veritabanındadır — token'ı elle değiştirmek hiçbir kapı açmaz.
 */
(function () {
    'use strict';

    const TOKEN_KEY = 'jb_token';

    function get() {
        try {
            return localStorage.getItem(TOKEN_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function set(token) {
        try {
            if (token) localStorage.setItem(TOKEN_KEY, token);
            else localStorage.removeItem(TOKEN_KEY);
        } catch (e) { /* ignore */ }
    }

    function clear() {
        try {
            localStorage.removeItem(TOKEN_KEY);
        } catch (e) { /* ignore */ }
    }

    /** JWT gövdesini çözer (doğrulamaz — doğrulama sunucuda yapılır). */
    function decode(token) {
        const t = token || get();
        if (!t) return null;
        const parts = t.split('.');
        if (parts.length !== 3) return null;
        try {
            const json = decodeURIComponent(
                atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    /** Token yok veya süresi dolmuş mu? */
    function isExpired() {
        const claims = decode();
        if (!claims || !claims.exp) return true;
        return Date.now() >= claims.exp * 1000;
    }

    /** Süre dolmasına kaç saniye kaldı (yoksa 0). */
    function secondsLeft() {
        const claims = decode();
        if (!claims || !claims.exp) return 0;
        return Math.max(0, Math.floor(claims.exp - Date.now() / 1000));
    }

    function apiBase() {
        const cfg = window.JETBARKOD_VPS_API || {};
        return (cfg.baseUrl || '').replace(/\/$/, '');
    }

    /** Authorization başlığı otomatik eklenmiş fetch. */
    async function apiFetch(pathOrUrl, options = {}) {
        const url = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : apiBase() + pathOrUrl;
        const headers = new Headers(options.headers || {});
        const token = get();
        if (token) headers.set('Authorization', 'Bearer ' + token);
        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        return fetch(url, { ...options, headers });
    }

    /**
     * Oturumun GERÇEKTEN geçerli olduğunu sunucuya sorar.
     *
     * "Süre dolduğu halde tarayıcıda hâlâ girili görünüyor, uygulamaya git
     * diyor" sorununu bitiren yer burasıdır: trial bitmiş, hesap kapatılmış
     * veya token süresi geçmişse sunucu 401/403 döner ve oturum temizlenir.
     *
     * @returns {Promise<{ok:boolean, session?:object, code?:string}>}
     */
    async function validateWithServer() {
        if (!get()) return { ok: false, code: 'no_token' };
        if (isExpired()) return { ok: false, code: 'expired' };
        if (!apiBase()) return { ok: true, skipped: true };

        try {
            const res = await apiFetch('/api/auth/session', { method: 'GET' });
            if (res.ok) {
                const data = await res.json();
                return { ok: true, session: data.session, premiumFeatures: data.premiumFeatures };
            }
            let code = 'invalid';
            try {
                code = (await res.json())?.code || 'invalid';
            } catch (e) { /* ignore */ }
            return { ok: false, code, status: res.status };
        } catch (e) {
            // Ağ hatası oturumu düşürmemeli — kullanıcı çevrimdışı olabilir.
            console.warn('Oturum doğrulanamadı (ağ):', e?.message);
            return { ok: true, offline: true };
        }
    }

    window.jetbarkodAuth = {
        get,
        set,
        clear,
        decode,
        isExpired,
        secondsLeft,
        apiBase,
        apiFetch,
        validateWithServer,
    };
})();
