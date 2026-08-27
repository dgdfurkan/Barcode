// Guest User Management System
// Handles IP-based guest users for chat system

(function() {
    'use strict';

    const GUEST_USER_PREFIX = 'Kullanıcı';
    const GUEST_START_NUMBER = 100;
    const GUEST_STORAGE_KEY = 'guestUsers';
    const IP_USER_MAPPING_KEY = 'ipUserMapping';

    // Get client IP address
    async function getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.warn('IP detection failed:', error);
            return 'unknown';
        }
    }

    const GUEST_TOKEN_KEY = 'jb_guest_token';
    const GUEST_NAME_KEY = 'jb_guest_username';

    function getGuestToken() {
        try { return localStorage.getItem(GUEST_TOKEN_KEY) || ''; } catch (e) { return ''; }
    }

    function setGuestSession(token, username) {
        try {
            if (token) localStorage.setItem(GUEST_TOKEN_KEY, token);
            if (username) localStorage.setItem(GUEST_NAME_KEY, username);
        } catch (e) { /* ignore */ }
    }

    function clearGuestSession() {
        try {
            localStorage.removeItem(GUEST_TOKEN_KEY);
            localStorage.removeItem(GUEST_NAME_KEY);
        } catch (e) { /* ignore */ }
    }

    /**
     * Misafir kimliğini SUNUCUDAN alır.
     *
     * Eskiden tarayıcı guest_chats tablosunu doğrudan okuyup yazıyordu; tablo
     * herkese açık olduğu için başkalarının destek yazışmaları okunabiliyordu.
     * Artık sunucu, IP'ye göre kimliği belirleyip İMZALI bir misafir token'ı
     * veriyor. Ziyaretçi yalnızca kendi konuşmasına erişebiliyor.
     */
    async function getOrCreateGuestUser() {
        const api = window.jetbarkodAuth;
        if (!api || !api.apiBase()) {
            return await getOrCreateGuestUserLocalStorage(await getClientIP());
        }

        try {
            const headers = { 'Content-Type': 'application/json' };
            const existing = getGuestToken();
            if (existing) headers.Authorization = 'Bearer ' + existing;

            const res = await fetch(`${api.apiBase()}/api/guest/session`, {
                method: 'POST',
                headers,
                body: '{}',
            });

            if (!res.ok) {
                console.warn('Misafir oturumu alınamadı, yerel yedeğe düşülüyor:', res.status);
                return await getOrCreateGuestUserLocalStorage(await getClientIP());
            }

            const data = await res.json();
            if (data?.ok && data.username) {
                setGuestSession(data.token, data.username);
                console.log('✅ Misafir kimliği:', data.username, data.reused ? '(mevcut)' : '(yeni)');
                return data.username;
            }

            return await getOrCreateGuestUserLocalStorage(await getClientIP());
        } catch (e) {
            console.warn('Misafir oturumu hatası:', e?.message);
            return await getOrCreateGuestUserLocalStorage(await getClientIP());
        }
    }

    async function getOrCreateGuestUserLocalStorage(clientIP) {
        // Check if IP already has a guest user assigned
        const ipMapping = JSON.parse(localStorage.getItem(IP_USER_MAPPING_KEY) || '{}');
        
        if (ipMapping[clientIP]) {
            const guestUsername = ipMapping[clientIP];
            console.log('✅ Existing guest user found in localStorage for IP:', clientIP, '->', guestUsername);
            return guestUsername;
        }

        // Get all guest users
        const guestUsers = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) || '{}');
        
        // Find next available number
        let nextNumber = GUEST_START_NUMBER;
        const existingNumbers = Object.values(guestUsers).map(user => {
            const match = user.username.match(/^Kullanıcı(\d+)$/);
            return match ? parseInt(match[1]) : null;
        }).filter(num => num !== null).sort((a, b) => b - a);
        
        if (existingNumbers.length > 0) {
            nextNumber = existingNumbers[0] + 1;
        }

        const guestUsername = `${GUEST_USER_PREFIX}${nextNumber}`;
        
        // Create guest user record
        const guestUser = {
            username: guestUsername,
            ip: clientIP,
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            isGuest: true
        };

        // Save guest user
        guestUsers[guestUsername] = guestUser;
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUsers));

        // Map IP to username
        ipMapping[clientIP] = guestUsername;
        localStorage.setItem(IP_USER_MAPPING_KEY, JSON.stringify(ipMapping));

        console.log('✅ New guest user created in localStorage:', guestUsername, 'for IP:', clientIP);
        
        return guestUsername;
    }

    // Update guest user last seen (Supabase-based)
    /** Sunucu son görülmeyi kendi güncelliyor (mesaj yazıldığında). */
    async function updateGuestUserLastSeen() {
        return true;
    }

    /** Misafir kimliği artık sunucudan geliyor; yerelde saklanan ada bakılır. */
    async function getGuestUserByIP() {
        try { return localStorage.getItem(GUEST_NAME_KEY) || null; } catch (e) { return null; }
    }

    function isGuestUser(username) {
        if (!username) return false;
        return username.startsWith(GUEST_USER_PREFIX) && /^\d+$/.test(username.replace(GUEST_USER_PREFIX, ''));
    }

    // Export functions
    window.guestUserManager = {
        getOrCreateGuestUser,
        getGuestUserByIP,
        updateGuestUserLastSeen,
        isGuestUser,
        getClientIP,
        getGuestToken,
        clearGuestSession
    };

    console.log('✅ Guest User Manager initialized');
})();

