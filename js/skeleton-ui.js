/**
 * Skeleton UI — yalnızca göster/gizle ve aria-busy (animasyon saf CSS)
 */
(function (global) {
    'use strict';

    function resolveHost(host) {
        if (!host) return null;
        if (typeof host === 'string') return document.getElementById(host) || document.querySelector(host);
        if (host instanceof Element) return host;
        return null;
    }

    function enter(host) {
        const el = resolveHost(host);
        if (!el) return false;
        el.classList.add('is-loading');
        el.setAttribute('aria-busy', 'true');
        return true;
    }

    function leave(host) {
        const el = resolveHost(host);
        if (!el) return false;
        el.classList.remove('is-loading');
        el.setAttribute('aria-busy', 'false');
        return true;
    }

    function toggle(host, loading) {
        return loading ? enter(host) : leave(host);
    }

    function enterMany(hosts) {
        (hosts || []).forEach((h) => enter(h));
    }

    function leaveMany(hosts) {
        (hosts || []).forEach((h) => leave(h));
    }

    global.SkeletonUI = {
        enter,
        leave,
        toggle,
        enterMany,
        leaveMany,
    };
})(typeof window !== 'undefined' ? window : globalThis);
