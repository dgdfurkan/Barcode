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

    function initClient() {
        const createClient = window.supabase?.createClient;
        if (typeof createClient !== 'function') {
            setTimeout(initClient, 50);
            return;
        }

        const cfg = getConfig();
        let client = createClient(cfg.url, cfg.key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
        });

        if (cfg.mode === 'vps' && typeof window.wrapVpsSupabaseClient === 'function') {
            client = window.wrapVpsSupabaseClient(client, cfg.url);
        }

        window.supabase = client;
        window.__jetbarkodDbMode = cfg.mode;
        console.log(`✅ DB client hazir (${cfg.mode}):`, cfg.url);
        window.dispatchEvent(new CustomEvent('jetbarkod-supabase-ready', { detail: { mode: cfg.mode } }));
    }

    initClient();
})();
