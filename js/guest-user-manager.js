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

    // Get or create guest user for current IP (Supabase-based)
    async function getOrCreateGuestUser() {
        const clientIP = await getClientIP();
        
        // Önce Supabase'de bu IP'ye ait guest user var mı kontrol et
        if (window.supabase) {
            try {
                // IP'ye göre guest_chats tablosunda arama yap
                const { data: existingGuestChat, error: searchError } = await window.supabase
                    .from('guest_chats')
                    .select('username')
                    .eq('ip_address', clientIP)
                    .order('last_chat_update', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!searchError && existingGuestChat && existingGuestChat.username) {
                    console.log('✅ Existing guest user found in Supabase for IP:', clientIP, '->', existingGuestChat.username);
                    return existingGuestChat.username;
                }

                // Guest user yoksa, yeni bir tane oluştur
                // Önce maksimum numarayı bul (performanslı yöntem)
                const { data: allGuests, error: fetchError } = await window.supabase
                    .from('guest_chats')
                    .select('username')
                    .like('username', `${GUEST_USER_PREFIX}%`);

                if (fetchError) {
                    console.error('❌ Error fetching guest users:', fetchError);
                    // Fallback to localStorage
                    return await getOrCreateGuestUserLocalStorage(clientIP);
                }

                // Maksimum numarayı bul
                let maxNumber = GUEST_START_NUMBER - 1;
                if (allGuests && allGuests.length > 0) {
                    const numbers = allGuests
                        .map(guest => {
                            const match = guest.username.match(/^Kullanıcı(\d+)$/);
                            return match ? parseInt(match[1]) : null;
                        })
                        .filter(num => num !== null);
                    
                    if (numbers.length > 0) {
                        maxNumber = Math.max(...numbers);
                    }
                }

                const nextNumber = maxNumber + 1;
                const guestUsername = `${GUEST_USER_PREFIX}${nextNumber}`;

                // Yeni guest_chats kaydı oluştur
                const { data: newGuestChat, error: insertError } = await window.supabase
                    .from('guest_chats')
                    .insert([{
                        username: guestUsername,
                        ip_address: clientIP,
                        chat_messages: '[]',
                        last_chat_update: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error('❌ Error creating guest user in Supabase:', insertError);
                    // Fallback to localStorage
                    return await getOrCreateGuestUserLocalStorage(clientIP);
                }

                console.log('✅ New guest user created in Supabase:', guestUsername, 'for IP:', clientIP);
                return guestUsername;

            } catch (error) {
                console.error('❌ Exception in getOrCreateGuestUser:', error);
                // Fallback to localStorage
                return await getOrCreateGuestUserLocalStorage(clientIP);
            }
        } else {
            // Supabase yoksa localStorage'a fallback
            console.warn('⚠️ Supabase not available, using localStorage fallback');
            return await getOrCreateGuestUserLocalStorage(clientIP);
        }
    }

    // Fallback: localStorage tabanlı guest user oluşturma (eski yöntem)
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
    async function updateGuestUserLastSeen(username) {
        if (window.supabase) {
            try {
                // Supabase'de guest_chats tablosunda updated_at otomatik güncelleniyor
                // Ama last_chat_update'ı da güncelleyelim
                const { error } = await window.supabase
                    .from('guest_chats')
                    .update({ 
                        updated_at: new Date().toISOString()
                    })
                    .eq('username', username);

                if (error) {
                    console.error('❌ Error updating guest user last seen in Supabase:', error);
                }
            } catch (error) {
                console.error('❌ Exception updating guest user last seen:', error);
            }
        }
        
        // Fallback to localStorage
        const guestUsers = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) || '{}');
        if (guestUsers[username]) {
            guestUsers[username].lastSeen = new Date().toISOString();
            localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUsers));
        }
    }

    // Get guest user by IP (Supabase-based)
    async function getGuestUserByIP() {
        const clientIP = await getClientIP();
        
        // Önce Supabase'de ara
        if (window.supabase) {
            try {
                const { data: guestChat, error } = await window.supabase
                    .from('guest_chats')
                    .select('username')
                    .eq('ip_address', clientIP)
                    .order('last_chat_update', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!error && guestChat && guestChat.username) {
                    return guestChat.username;
                }
            } catch (error) {
                console.error('❌ Error getting guest user by IP from Supabase:', error);
            }
        }
        
        // Fallback to localStorage
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

