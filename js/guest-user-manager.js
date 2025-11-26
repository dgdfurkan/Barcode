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

    // Get or create guest user for current IP
    async function getOrCreateGuestUser() {
        const clientIP = await getClientIP();
        
        // Check if IP already has a guest user assigned
        const ipMapping = JSON.parse(localStorage.getItem(IP_USER_MAPPING_KEY) || '{}');
        
        if (ipMapping[clientIP]) {
            const guestUsername = ipMapping[clientIP];
            console.log('✅ Existing guest user found for IP:', clientIP, '->', guestUsername);
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

        console.log('✅ New guest user created:', guestUsername, 'for IP:', clientIP);
        
        return guestUsername;
    }

    // Update guest user last seen
    async function updateGuestUserLastSeen(username) {
        const guestUsers = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) || '{}');
        if (guestUsers[username]) {
            guestUsers[username].lastSeen = new Date().toISOString();
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUsers));
        }
    }

    // Get guest user by IP
    async function getGuestUserByIP() {
        const clientIP = await getClientIP();
        const ipMapping = JSON.parse(localStorage.getItem(IP_USER_MAPPING_KEY) || '{}');
        return ipMapping[clientIP] || null;
    }

    // Check if user is guest
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
        getClientIP
    };

    console.log('✅ Guest User Manager initialized');
})();

