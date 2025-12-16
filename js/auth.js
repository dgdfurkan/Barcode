// Supabase Configuration
const SUPABASE_URL = 'https://ytekbbxvfdheiexsojpx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZWtiYnh2ZmRoZWlleHNvanB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMTgzMDcsImV4cCI6MjA3Mzg5NDMwN30.J4jvfRg2j6UOumDSqOyvYs3Iza8VX0SnNU_7wE41Tdg';

// Initialize Supabase
function initSupabase() {
    try {
        // Wait for Supabase to be loaded from CDN (index.html loads it)
        const checkSupabase = setInterval(() => {
            if (typeof window.supabase !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
                clearInterval(checkSupabase);
                
                // Create Supabase client
                window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('Supabase initialized successfully');
            }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkSupabase);
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                console.error('Supabase initialization failed: Supabase not loaded from CDN');
                console.log('Running in demo mode - Supabase not configured');
            }
        }, 5000);
    } catch (error) {
        console.error('Supabase initialization failed:', error);
        console.log('Running in demo mode - Supabase not configured');
    }
}

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

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// Show loading state
function showLoading(show = true) {
    const loginText = document.getElementById('loginText');
    const loginSpinner = document.getElementById('loginSpinner');
    const submitBtn = document.querySelector('#loginForm button');
    
    if (show) {
        loginText.classList.add('hidden');
        loginSpinner.classList.remove('hidden');
        submitBtn.disabled = true;
    } else {
        loginText.classList.remove('hidden');
        loginSpinner.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

// Validate IP address
function validateIP(userIP, allowedIPs) {
    if (!allowedIPs || allowedIPs.length === 0) return true;
    if (allowedIPs.includes('*')) return true;
    return allowedIPs.includes(userIP);
}

// Check trial expiry
function checkTrialExpiry(trialEnd) {
    if (!trialEnd) return true;
    return new Date() <= new Date(trialEnd);
}

// Rate limiting
const RATE_LIMIT = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 dakika
    getKey: (ip) => `rate_limit_${ip}`,
    check: (ip) => {
        const key = RATE_LIMIT.getKey(ip);
        const attempts = JSON.parse(localStorage.getItem(key) || '[]');
        const now = Date.now();
        
        // Remove old attempts
        const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT.windowMs);
        
        if (recentAttempts.length >= RATE_LIMIT.maxAttempts) {
            return false;
        }
        
        return true;
    },
    record: (ip) => {
        const key = RATE_LIMIT.getKey(ip);
        const attempts = JSON.parse(localStorage.getItem(key) || '[]');
        attempts.push(Date.now());
        localStorage.setItem(key, JSON.stringify(attempts));
    }
};

// Login function
async function login(username, password) {
    showLoading(true);
    
    try {
        const clientIP = await getClientIP();
        console.log('Client IP:', clientIP);
        
        // Rate limiting check
        if (!RATE_LIMIT.check(clientIP)) {
            throw new Error('Çok fazla başarısız giriş denemesi! 15 dakika sonra tekrar deneyin.');
        }
        
        let user = null;
        
        // Try Supabase first
        if (supabase) {
            try {
                // Set current user context for RLS
                await supabase.rpc('set_current_user', { user_name: username });
                
                const { data, error } = await supabase
                    .from('users')
                    .select('id, username, password, company, contact_email, trial_end, allowed_ips, is_active, is_admin, premium_features, created_at, updated_at')
                    .eq('username', username)
                    .single();
                
                if (!error && data) {
                    user = data;
                    console.log('User found in Supabase:', user);
                }
            } catch (error) {
                console.warn('Supabase error:', error);
            }
        }
        
        // Fallback: Check localStorage for admin user
        if (!user) {
            const localUsersData = localStorage.getItem('LOCAL_USERS');
            if (localUsersData) {
                const localUsers = JSON.parse(localUsersData);
                if (localUsers[username]) {
                    user = localUsers[username];
                }
            }
        }
        
        if (!user) {
            throw new Error('Kullanıcı bulunamadı!');
        }
        
        // Check password
        if (user.password !== password) {
            RATE_LIMIT.record(clientIP); // Record failed attempt
            throw new Error('Hatalı şifre!');
        }
        
        // Check if user is active (handle both camelCase and snake_case)
        if (!user.isActive && !user.is_active) {
            throw new Error('Hesabınız deaktif edilmiş!');
        }
        
        // Check IP whitelist (handle both camelCase and snake_case)
        const allowedIPs = user.allowedIPs || user.allowed_ips;
        if (!validateIP(clientIP, allowedIPs)) {
            throw new Error(`Bu IP adresinden giriş yapılamaz! (${clientIP})`);
        }
        
        // Check trial expiry (handle both camelCase and snake_case)
        const trialEnd = user.trialEnd || user.trial_end;
        if (!checkTrialExpiry(trialEnd)) {
            // Show trial expired notification on login page
            if (window.showTrialExpiredLoginNotification) {
                window.showTrialExpiredLoginNotification();
            }
            // Open chat with username after showing error
            setTimeout(() => {
                openChatWithUsernameForTrialExpired(username);
            }, 1500);
            throw new Error('Test süreniz dolmuş! Lütfen destek ile iletişime geçin.');
        }

        // IP Ban Check - Check if IP is blocked before allowing login
        if (window.ipBanChecker) {
            const ipBanStatus = await window.ipBanChecker.checkIPBanStatus(clientIP);
            if (ipBanStatus.isBlocked) {
                console.log('🚫 IP is blocked, preventing login:', clientIP);
                
                // Show inline message
                const ipBanMessage = document.getElementById('ipBanMessage');
                if (ipBanMessage) {
                    ipBanMessage.classList.remove('hidden');
                    const ipBanText = ipBanMessage.querySelector('span');
                    if (ipBanText) {
                        ipBanText.textContent = 'Bu IP adresi sistem tarafından engellenmiştir. Kullanım şartlarımıza göre, bir hesabın birden fazla farklı cihazda kullanımı yasaktır. Lütfen destek ekibimizle iletişime geçerek ödeminizi tamamlayınız.';
                    }
                }
                
                // Open anonymous chat with username
                setTimeout(async () => {
                    await openChatForBlockedIP(clientIP, username);
                }, 1000);
                
                // Sadece inline mesaj göster, throw error yapma (tekrar mesaj göstermemek için)
                return;
            }
        }

        // IP Tracking Check
        if (user.ip_tracking_enabled !== false) {
            console.log('IP Tracking Check:', {
                userId: user.id,
                username: user.username,
                clientIP: clientIP,
                maxIPCount: user.max_ip_count || 5
            });
            
            const ipTrackingResult = await checkIPTracking(user.id, clientIP, user.max_ip_count || 5);
            console.log('IP Tracking Result:', ipTrackingResult);
            
            if (!ipTrackingResult.success) {
                throw new Error(`IP sınırı aşıldı! Maksimum ${user.max_ip_count || 5} farklı IP kullanabilirsiniz.`);
            }
        }
        
        // Log IP (if Supabase available)
        if (supabase && user.id) {
            try {
                await supabase
                    .from('ip_logs')
                    .insert({
                        user_id: user.id,
                        ip_address: clientIP,
                        user_agent: navigator.userAgent
                    });
            } catch (error) {
                console.warn('IP log error:', error);
            }
        }
        
        // Always log to local storage as backup
        try {
            const ipLogs = JSON.parse(localStorage.getItem('ipLogs') || '[]');
            ipLogs.push({
                id: Date.now(),
                user_id: username,
                ip_address: clientIP,
                user_agent: navigator.userAgent,
                login_time: new Date().toISOString()
            });
            
            // Keep only last 1000 logs
            if (ipLogs.length > 1000) {
                ipLogs.splice(0, ipLogs.length - 1000);
            }
            
            localStorage.setItem('ipLogs', JSON.stringify(ipLogs));
        } catch (error) {
            console.warn('Local IP log error:', error);
        }
        
        // Store user session (handle both camelCase and snake_case)
        const sessionData = {
            username: username,
            company: user.company,
            trialEnd: user.trialEnd || user.trial_end,
            isAdmin: user.isAdmin || user.is_admin || false,
            loginTime: new Date().toISOString(),
            clientIP: clientIP
        };
        
        localStorage.setItem('userSession', JSON.stringify(sessionData));
        localStorage.setItem('authToken', btoa(unescape(encodeURIComponent(JSON.stringify(sessionData))))); // Safe base64 encoding
        
        // Redirect to dashboard or admin panel
        const isAdmin = user.isAdmin || user.is_admin || false;
        if (isAdmin) {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'pages/product_search.html';
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// Check if user is logged in (sync version - for backward compatibility)
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    
    try {
        const sessionData = JSON.parse(decodeURIComponent(escape(atob(token))));
        const now = new Date();
        const loginTime = new Date(sessionData.loginTime);
        
        // Check if session is older than 24 hours
        if (now - loginTime > 24 * 60 * 60 * 1000) {
            logout();
            return false;
        }
        
        // Check trial expiry (sync check)
        if (sessionData.trialEnd) {
            const trialEnd = new Date(sessionData.trialEnd);
            if (now > trialEnd) {
                // Trial expired - show notification and logout immediately
                if (window.showTrialExpiredNotification) {
                    window.showTrialExpiredNotification();
                }
                // Logout immediately
                logout();
                return false;
            }
        }
        
        return sessionData;
    } catch (error) {
        console.error('Token decode error:', error);
        logout();
        return false;
    }
}

// Check if user is logged in (async version for IP ban check)
async function checkAuthAsync() {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    
    try {
        const sessionData = JSON.parse(decodeURIComponent(escape(atob(token))));
        const now = new Date();
        const loginTime = new Date(sessionData.loginTime);
        
        // Check if session is older than 24 hours
        if (now - loginTime > 24 * 60 * 60 * 1000) {
            logout();
            return false;
        }
        
        // Check IP ban status (async check)
        if (sessionData.clientIP && window.ipBanChecker) {
            const ipBanStatus = await window.ipBanChecker.checkIPBanStatus(sessionData.clientIP);
            if (ipBanStatus.isBlocked) {
                console.log('🚫 IP is blocked, checking if user should be logged out:', sessionData.clientIP);
                
                // Kullanıcının birden fazla IP ile giriş yapıp yapmadığını kontrol et
                const hasMultipleIPs = await window.ipBanChecker.checkUserHasMultipleIPs(sessionData.username);
                
                if (hasMultipleIPs) {
                    console.log(`ℹ️ User ${sessionData.username} has multiple IPs, not logging out`);
                    // Birden fazla IP varsa logout yapma, ama yine de false dön (güvenlik için)
                    // return false; // Bu satırı kaldırdık, çünkü kullanıcı giriş yapmaya devam edebilir
                } else {
                    // Sadece bu IP ile giriş yapılmış, logout yap
                    console.log('🚫 IP is blocked and user has only this IP, logging out user:', sessionData.clientIP);
                    
                    // Logout immediately
                    logout();
                    
                    // Show notification (if on product_search page)
                    if (window.showIPBannedNotification) {
                        window.showIPBannedNotification();
                    }
                    
                    // Open anonymous chat with username
                    setTimeout(async () => {
                        await openChatForBlockedIP(sessionData.clientIP, sessionData.username);
                    }, 1000);
                    
                    return false;
                }
            }
        }
        
        // Check trial expiry
        if (sessionData.trialEnd) {
            const trialEnd = new Date(sessionData.trialEnd);
            if (now > trialEnd) {
                // Trial expired - show notification and logout immediately
                if (window.showTrialExpiredNotification) {
                    window.showTrialExpiredNotification();
                }
                // Logout immediately
                logout();
                return false;
            }
        }
        
        return sessionData;
    } catch (error) {
        console.error('Token decode error:', error);
        logout();
        return false;
    }
}

// Logout function
function logout() {
    // Get current session for logging
    const session = JSON.parse(localStorage.getItem('userSession') || '{}');
    
    // Log logout time to IP logs
    if (session.username) {
        try {
            const ipLogs = JSON.parse(localStorage.getItem('ipLogs') || '[]');
            const lastLog = ipLogs.find(log => 
                log.user_id === session.username && 
                !log.logout_time
            );
            
            if (lastLog) {
                const logoutTime = new Date();
                const loginTime = new Date(lastLog.login_time);
                const sessionDuration = Math.floor((logoutTime - loginTime) / 1000); // seconds
                
                lastLog.logout_time = logoutTime.toISOString();
                lastLog.session_duration = sessionDuration;
                
                localStorage.setItem('ipLogs', JSON.stringify(ipLogs));
                
                // Also update Supabase if available
                if (window.supabase && lastLog.id) {
                    window.supabase
                        .from('ip_logs')
                        .update({
                            logout_time: logoutTime.toISOString(),
                            session_duration: sessionDuration
                        })
                        .eq('id', lastLog.id)
                        .then(() => console.log('Logout logged to Supabase'))
                        .catch(err => console.warn('Supabase logout log error:', err));
                }
            }
        } catch (error) {
            console.warn('Logout logging error:', error);
        }
    }
    
    localStorage.removeItem('userSession');
    localStorage.removeItem('authToken');
    
    // Determine correct path based on current location
    if (window.location.pathname.includes('/pages/')) {
        window.location.href = '../index.html';
    } else if (window.location.pathname.includes('/admin')) {
        window.location.href = 'index.html';
    } else {
        window.location.href = 'index.html';
    }
}

// Show user info on index page
function showUserInfo(session) {
    // Hide login form
    document.getElementById('loginForm').classList.add('hidden');
    
    // Show user info
    document.getElementById('userInfo').classList.remove('hidden');
    
    // Update user info
    document.getElementById('loggedInUser').textContent = session.username;
    document.getElementById('loggedInCompany').textContent = session.company;
    
    // Add event listeners for the newly shown buttons
    const goToAppBtn = document.getElementById('goToApp');
    const logoutFromIndexBtn = document.getElementById('logoutFromIndex');
    
    if (goToAppBtn) {
        goToAppBtn.onclick = () => {
            const currentSession = checkAuth();
            if (currentSession) {
                if (currentSession.isAdmin) {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'pages/product_search.html';
                }
            }
        };
    }
    
    if (logoutFromIndexBtn) {
        logoutFromIndexBtn.onclick = () => {
            logout();
        };
    }
}

// Make logout function available globally
window.authUtils = {
    checkAuth: checkAuth,
    checkAuthAsync: checkAuthAsync,
    logout: logout,
    getClientIP: getClientIP,
    openChatForBlockedIP: openChatForBlockedIP
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    
    // Check if already logged in (only on index.html)
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        const session = checkAuth();
        if (session) {
            // Show user info instead of login form
            showUserInfo(session);
            return;
        }
    }
    
    // Add event listeners for user info buttons
    const goToAppBtn = document.getElementById('goToApp');
    const logoutFromIndexBtn = document.getElementById('logoutFromIndex');
    
    if (goToAppBtn) {
        goToAppBtn.addEventListener('click', () => {
            const session = checkAuth();
            if (session) {
                if (session.isAdmin) {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'pages/product_search.html';
                }
            }
        });
    }
    
    if (logoutFromIndexBtn) {
        logoutFromIndexBtn.addEventListener('click', () => {
            logout();
        });
    }
    
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                showError('Lütfen tüm alanları doldurun!');
                return;
            }
            
            await login(username, password);
        });
    }
    
    // Enter key handler - only for login form
    document.addEventListener('keypress', (e) => {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        
        // Only if login form inputs are focused
        if (e.key === 'Enter' && (document.activeElement === usernameInput || document.activeElement === passwordInput)) {
            if (loginForm) {
                loginForm.dispatchEvent(new Event('submit'));
            }
        }
    });
});

// IP Tracking Functions
async function checkIPTracking(userId, clientIP, maxIPCount) {
    try {
        console.log('checkIPTracking called with:', { userId, clientIP, maxIPCount });
        
        if (supabase) {
            // Use Supabase function
            const { data, error } = await supabase.rpc('track_user_ip', {
                p_user_id: userId,
                p_ip_address: clientIP
            });

            if (error) {
                console.error('Supabase IP tracking error:', error);
                throw error;
            }
            
            console.log('Supabase IP tracking result:', data);
            return data;
        } else {
            // Fallback to local storage
            const ipTrackingData = JSON.parse(localStorage.getItem('ipTrackingData') || '[]');
            
            // Check if IP already exists for this user
            const existingIP = ipTrackingData.find(ip => 
                ip.user_id === userId && ip.ip_address === clientIP
            );

            if (existingIP) {
                // Update existing IP
                existingIP.last_seen = new Date().toISOString();
                existingIP.login_count = (existingIP.login_count || 0) + 1;
                localStorage.setItem('ipTrackingData', JSON.stringify(ipTrackingData));
                
                return {
                    success: true,
                    message: 'IP güncellendi',
                    is_new: false
                };
            } else {
                // Check if user has reached max IP count
                const userIPs = ipTrackingData.filter(ip => 
                    ip.user_id === userId && !ip.is_blocked
                );

                if (userIPs.length >= maxIPCount) {
                    return {
                        success: false,
                        message: 'Maksimum IP sayısı aşıldı',
                        ip_count: userIPs.length,
                        max_ip: maxIPCount,
                        is_new: false
                    };
                }

                // Add new IP
                const newIP = {
                    id: Date.now().toString(),
                    user_id: userId,
                    ip_address: clientIP,
                    first_seen: new Date().toISOString(),
                    last_seen: new Date().toISOString(),
                    login_count: 1,
                    is_blocked: false
                };

                ipTrackingData.push(newIP);
                localStorage.setItem('ipTrackingData', JSON.stringify(ipTrackingData));

                return {
                    success: true,
                    message: 'Yeni IP eklendi',
                    ip_count: userIPs.length + 1,
                    max_ip: maxIPCount,
                    is_new: true
                };
            }
        }
    } catch (error) {
        console.error('IP tracking error:', error);
        return {
            success: false,
            message: 'IP takibi hatası',
            is_new: false
        };
    }
}

// Function to check if trial expired message exists in chat history
async function checkTrialExpiredMessageInHistory(username) {
    try {
        if (window.supabase && username) {
            // Get user's chat messages from Supabase
            const { data: userData, error } = await window.supabase
                .from('users')
                .select('chat_messages')
                .eq('username', username)
                .single();

            if (error || !userData || !userData.chat_messages) {
                return false; // No messages found, can add
            }

            const chatMessages = JSON.parse(userData.chat_messages);
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            
            const expectedMessage = `Merhaba, ben ${username}. Hesap sürem doldu, ödeme yapmak istiyorum.`;
            
            // Check if message exists in last 1 day
            const hasMessage = chatMessages.some(msg => {
                if (msg.sender === 'user' && msg.message === expectedMessage) {
                    const msgDate = new Date(msg.timestamp);
                    return msgDate >= oneDayAgo;
                }
                return false;
            });
            
            return hasMessage;
        }
        
        // Fallback: check localStorage
        const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const expectedMessage = `Merhaba, ben ${username}. Hesap sürem doldu, ödeme yapmak istiyorum.`;
        
        const hasMessage = chatMessages.some(msg => {
            if (msg.username === username && msg.message === expectedMessage) {
                const msgDate = new Date(msg.timestamp || msg.created_at);
                return msgDate >= oneDayAgo;
            }
            return false;
        });
        
        return hasMessage;
    } catch (error) {
        console.error('Error checking trial expired message:', error);
        return false; // On error, allow adding message
    }
}

// Function to open chat with username pre-filled when trial expired
// Open chat for blocked IP (anonymous)
async function openChatForBlockedIP(clientIP, username = null) {
    try {
        // Get or create guest user
        if (window.guestUserManager) {
            const guestUsername = await window.guestUserManager.getOrCreateGuestUser();
            
            // Open chat system
            if (window.chatSystem) {
                // Set current user to guest username
                window.chatSystem.currentUser = guestUsername;
                window.chatSystem.isGuest = true;
                
                // Open chat
                window.chatSystem.openChat();
                
                // Pre-fill message about IP ban with username and IP if available
                setTimeout(() => {
                    const messageInput = document.getElementById('messageInput');
                    if (messageInput) {
                        let message = 'Merhaba, IP adresim banlandı. Ödeme yapmak istiyorum.';
                        if (username) {
                            message += `\nKullanıcı adı olarak "${username}" kullanıyordum.`;
                        }
                        message += `\nIP adresim de budur: ${clientIP}`;
                        messageInput.value = message;
                        messageInput.focus();
                    }
                }, 500);
            }
        }
    } catch (error) {
        console.error('Error opening chat for blocked IP:', error);
    }
}

async function openChatWithUsernameForTrialExpired(username) {
    // Store username temporarily for chat system
    localStorage.setItem('tempChatUser', username);
    
    // Set current user for chat system if it exists
    if (window.chatSystem) {
        window.chatSystem.currentUser = username;
        // Update chat header immediately
        window.chatSystem.updateChatHeader();
    }
    
    // Open chat
    if (window.chatSystem && typeof window.chatSystem.openChat === 'function') {
        window.chatSystem.openChat();
    } else if (document.getElementById('openChat')) {
        document.getElementById('openChat').click();
    }
    
    // Wait a bit for chat to open, then check history and fill message input
    setTimeout(async () => {
        // Update chat system user if chat system exists
        if (window.chatSystem) {
            window.chatSystem.currentUser = username;
            window.chatSystem.updateChatHeader();
        }
        
        // Check if message already exists in chat history (last 1 day)
        const messageExists = await checkTrialExpiredMessageInHistory(username);
        
        const messageInput = document.getElementById('messageInput');
        if (messageInput && !messageExists) {
            const message = `Merhaba, ben ${username}. Hesap sürem doldu, ödeme yapmak istiyorum.`;
            messageInput.value = message;
            messageInput.focus();
            // Scroll message input into view
            messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (messageInput && messageExists) {
            // Just focus if message already exists
            messageInput.focus();
        }
    }, 1000); // Increased timeout to ensure chat is fully loaded and history checked
}

// Export functions for use in other pages
// window.authUtils already defined above
