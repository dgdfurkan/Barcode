(function () {
    'use strict';

    function getConfig() {
        const vps = window.JETBARKOD_VPS_API || {};
        const legacy = window.JETBARKOD_SUPABASE_LEGACY || {};
        if (vps.enabled) {
            return {
                url: (vps.baseUrl || '').replace(/\/$/, ''),
                key: 'vps-public-anon-key',
                mode: 'vps',
            };
        }
        return {
            url: legacy.url,
            key: legacy.anonKey,
            mode: 'supabase',
        };
    }

    function createVpsRestFetch(baseUrl) {
        const root = (baseUrl || '').replace(/\/$/, '');
        return function vpsRestFetch(input, init) {
            const url =
                typeof input === 'string'
                    ? input
                    : input && typeof input.url === 'string'
                      ? input.url
                      : '';
            const isRestCall =
                url.includes('/rest/v1/') ||
                (root && url.startsWith(root) && url.includes('/rest/'));

            if (!isRestCall) {
                return fetch(input, init);
            }

            const nextInit = init ? { ...init } : {};
            const headers = new Headers(
                nextInit.headers ||
                    (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
            );
            headers.delete('Authorization');
            nextInit.headers = headers;
            return fetch(input, nextInit);
        };
    }

    function initClient() {
        const createClient = window.supabase?.createClient;
        if (typeof createClient !== 'function') {
            setTimeout(initClient, 50);
            return;
        }

        const cfg = getConfig();
        const clientOptions = {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
        };

        if (cfg.mode === 'vps') {
            clientOptions.global = { fetch: createVpsRestFetch(cfg.url) };
        }

        let client = createClient(cfg.url, cfg.key, clientOptions);

        if (cfg.mode === 'vps' && typeof window.wrapVpsSupabaseClient === 'function') {
            client = window.wrapVpsSupabaseClient(client, cfg.url);
        }

        window.supabase = client;
        window.__jetbarkodDbMode = cfg.mode;
        console.log(`✅ DB client hazir (${cfg.mode}):`, cfg.url);
        window.dispatchEvent(new CustomEvent('jetbarkod-supabase-ready', { detail: { mode: cfg.mode } }));
    }

    window.jetbarkodWaitForSupabase = function waitForSupabase(maxWait = 10000) {
        return new Promise((resolve) => {
            if (window.supabase && typeof window.supabase.from === 'function') {
                resolve(window.supabase);
                return;
            }
            let settled = false;
            const done = (client) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(client || null);
            };
            const timer = setTimeout(() => done(window.supabase || null), maxWait);
            window.addEventListener('jetbarkod-supabase-ready', () => done(window.supabase), { once: true });
        });
    };

    initClient();
})();
