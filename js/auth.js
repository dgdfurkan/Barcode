// Supabase Configuration
const SUPABASE_URL = 'https://ytekbbxvfdheiexsojpx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZWtiYnh2ZmRoZWlleHNvanB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMTgzMDcsImV4cCI6MjA3Mzg5NDMwN30.J4jvfRg2j6UOumDSqOyvYs3Iza8VX0SnNU_7wE41Tdg';

// Supabase client
let supabase;

// Initialize Supabase
function initSupabase() {
    try {
        // Load Supabase from CDN if not already loaded
        if (typeof window.supabase === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                supabase = window.supabase;
                console.log('Supabase initialized successfully');
            };
            document.head.appendChild(script);
        } else {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            window.supabase = supabase;
            console.log('Supabase initialized successfully');
        }
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
                    .select('*')
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
            throw new Error('Test süreniz dolmuş! Lütfen destek ile iletişime geçin.');
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

// Check if user is logged in
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
    logout: logout
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
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showError('Lütfen tüm alanları doldurun!');
            return;
        }
        
        await login(username, password);
    });
    
    // Enter key handler
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('loginForm').dispatchEvent(new Event('submit'));
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

// Export functions for use in other pages
window.authUtils = {
    checkAuth,
    logout,
    getClientIP
};
