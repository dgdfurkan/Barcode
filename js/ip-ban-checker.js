// IP Ban Checker - IP ban durumunu kontrol eden modül
// Supabase'den IP ban durumunu kontrol eder ve cache'ler

(function() {
    'use strict';

    class IPBanChecker {
        constructor() {
            this.banCache = {}; // { ip: { isBlocked: boolean, timestamp: number } }
            this.CACHE_DURATION = 5 * 60 * 1000; // 5 dakika
            this.realtimeSubscription = null;
            this.onBanChangeCallbacks = []; // IP ban değişikliği callback'leri
        }

        // IP ban durumunu kontrol et
        async checkIPBanStatus(clientIP, forceRefresh = false) {
            try {
                // Cache kontrolü (forceRefresh true ise cache'i atla)
                if (!forceRefresh) {
                    const cached = this.banCache[clientIP];
                    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                        return {
                            isBlocked: cached.isBlocked,
                            reason: cached.reason || 'IP adresi engellenmiştir',
                            cached: true
                        };
                    }
                }

                // Supabase'den kontrol et
                if (!window.supabase) {
                    return {
                        isBlocked: false,
                        reason: null,
                        cached: false
                    };
                }

                const { data, error } = await window.supabase
                    .from('user_ip_tracking')
                    .select('is_blocked, ip_address, user_id')
                    .eq('ip_address', clientIP)
                    .eq('is_blocked', true)
                    .limit(1);

                if (error) {
                    console.error('Error checking IP ban status:', error);
                    return {
                        isBlocked: false,
                        reason: null,
                        cached: false
                    };
                }

                const isBlocked = data && data.length > 0;

                // Cache'e kaydet
                this.banCache[clientIP] = {
                    isBlocked: isBlocked,
                    reason: isBlocked ? 'Bu IP adresi sistem tarafından engellenmiştir. Kullanım şartlarımıza göre, bir hesabın birden fazla farklı cihazda kullanımı yasaktır.' : null,
                    timestamp: Date.now()
                };

                return {
                    isBlocked: isBlocked,
                    reason: isBlocked ? 'Bu IP adresi sistem tarafından engellenmiştir. Kullanım şartlarımıza göre, bir hesabın birden fazla farklı cihazda kullanımı yasaktır.' : null,
                    cached: false
                };
            } catch (error) {
                console.error('Error checking IP ban status:', error);
                return {
                    isBlocked: false,
                    reason: null,
                    cached: false
                };
            }
        }

        // Cache'i temizle (belirli IP için veya tümü)
        clearCache(ip = null) {
            if (ip) {
                delete this.banCache[ip];
            } else {
                this.banCache = {};
            }
        }

        // IP ban değişikliği callback'i kaydet
        onBanChange(callback) {
            if (typeof callback === 'function') {
                this.onBanChangeCallbacks.push(callback);
            }
        }

        // IP ban değişikliği callback'lerini çağır
        async triggerBanChangeCallbacks(ip, isBlocked) {
            // Cache'i temizle
            this.clearCache(ip);
            
            // Eğer IP banlandıysa, aktif oturumları kontrol et (callback'lerden ÖNCE)
            if (isBlocked) {
                await this.checkAndLogoutBannedIP(ip);
            }
            
            // Callback'leri çağır
            for (const callback of this.onBanChangeCallbacks) {
                try {
                    await callback(ip, isBlocked);
                } catch (error) {
                    console.error('Error in IP ban change callback:', error);
                }
            }
        }

        // Banlanan IP ile giriş yapılmış aktif oturumları kontrol et ve sadece o IP ile giriş yapılmışsa at
        async checkAndLogoutBannedIP(bannedIP) {
            try {
                // Aktif oturum bilgisini al
                const token = localStorage.getItem('authToken');
                if (!token) {
                    return; // Oturum yok, işlem yapma
                }

                let sessionData;
                try {
                    sessionData = JSON.parse(decodeURIComponent(escape(atob(token))));
                } catch (e) {
                    console.error('❌ Error parsing session data:', e);
                    return;
                }

                const currentIP = sessionData.clientIP;

                // Eğer banlanan IP, mevcut oturumun IP'si değilse işlem yapma
                if (!currentIP || currentIP !== bannedIP) {
                    return;
                }

                // Kullanıcının birden fazla IP ile giriş yapıp yapmadığını kontrol et
                const hasMultipleIPs = await this.checkUserHasMultipleIPs(sessionData.username);
                
                if (hasMultipleIPs) {
                    return;
                }

                // Sadece bu IP ile giriş yapılmış, logout yap
                // Banlı IP bilgisini localStorage'a kaydet (index.html'de sohbet açmak için)
                localStorage.setItem('blockedIPInfo', JSON.stringify({
                    ip: bannedIP,
                    username: sessionData.username,
                    timestamp: Date.now()
                }));

                // Bildirim göster (logout'tan önce)
                if (window.showIPBannedNotification) {
                    window.showIPBannedNotification();
                } else {
                    alert('Bu IP adresi sistem tarafından engellenmiştir. Kullanım şartlarımıza göre, bir hesabın birden fazla farklı cihazda kullanımı yasaktır. Lütfen destek ekibimizle iletişime geçerek ödeminizi tamamlayınız.');
                }

                // Logout
                if (window.authUtils?.logout) {
                    window.authUtils.logout();
                } else {
                    // Fallback logout
                    localStorage.removeItem('userSession');
                    localStorage.removeItem('authToken');
                    // Use replace() to prevent Safari UI from showing during navigation in standalone mode
                    if (window.location.pathname.includes('/pages/')) {
                        window.location.replace('../index.html');
                    } else {
                        window.location.replace('index.html');
                    }
                }

            } catch (error) {
                console.error('❌ Error in checkAndLogoutBannedIP:', error);
            }
        }

        // Kullanıcının birden fazla IP ile giriş yapıp yapmadığını kontrol et
        async checkUserHasMultipleIPs(username) {
            try {
                if (!window.supabase) {
                    // Supabase yoksa localStorage'dan kontrol et
                    const ipLogs = JSON.parse(localStorage.getItem('ipLogs') || '[]');
                    const userIPs = new Set();
                    
                    ipLogs.forEach(log => {
                        if (log.user_id === username && log.logout_time === undefined) {
                            userIPs.add(log.ip_address);
                        }
                    });
                    
                    return userIPs.size > 1;
                }

                // Supabase'den kontrol et - user_ip_tracking tablosundan
                // Önce username'e göre user_id bulmaya çalışalım
                let userId = null;
                
                // Eğer username bir ID ise direkt kullan
                // Değilse users tablosundan ID'yi bul
                try {
                    const { data: userData, error: userError } = await window.supabase
                        .from('users')
                        .select('id')
                        .eq('username', username)
                        .limit(1);
                    
                    if (!userError && userData && userData.length > 0) {
                        userId = userData[0].id;
                    } else {
                        // Username bulunamadı, username'i direkt ID olarak kullanmayı dene
                        userId = username;
                    }
                } catch (e) {
                    // Users tablosu yoksa veya hata varsa, username'i direkt kullan
                    userId = username;
                }

                // user_ip_tracking tablosundan aktif IP'leri al
                // NOT: user_id alanı UUID olabilir, ama username string olabilir
                // Bu yüzden hem user_id hem de username ile arama yapalım
                const { data, error } = await window.supabase
                    .from('user_ip_tracking')
                    .select('ip_address, is_blocked, user_id')
                    .or(`user_id.eq.${userId},user_id.eq.${username}`)
                    .eq('is_blocked', false); // Sadece banlanmamış IP'leri say

                if (error) {
                    console.error('Error checking user IPs:', error);
                    // Hata durumunda localStorage'dan kontrol et
                    const ipLogs = JSON.parse(localStorage.getItem('ipLogs') || '[]');
                    const userIPs = new Set();
                    
                    ipLogs.forEach(log => {
                        if (log.user_id === username && log.logout_time === undefined) {
                            userIPs.add(log.ip_address);
                        }
                    });
                    
                    return userIPs.size > 1;
                }

                // Banlanmamış ve aktif IP'leri filtrele
                const activeIPs = (data || []).filter(ip => !ip.is_blocked);
                const uniqueIPs = new Set(activeIPs.map(ip => ip.ip_address));
                
                return uniqueIPs.size > 1;

            } catch (error) {
                console.error('Error checking user multiple IPs:', error);
                return false; // Hata durumunda güvenli tarafta kal
            }
        }

        // Supabase realtime subscription başlat
        async setupRealtimeSubscription() {
            try {
                // Wait for Supabase to be ready
                let supabaseClient = window.supabase;
                if (!supabaseClient) {
                    return;
                }

                // Check if supabase is a client instance (has channel method)
                if (typeof supabaseClient.channel !== 'function') {
                    // If window.supabase is the createClient function, we need to create a client
                    if (typeof supabaseClient.createClient === 'function') {
                        return;
                    }
                    // If it's already a client but channel doesn't exist, wait a bit
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    supabaseClient = window.supabase;
                    if (!supabaseClient || typeof supabaseClient.channel !== 'function') {
                        return;
                    }
                }

                // Önceki subscription'ı kapat
                if (this.realtimeSubscription && typeof supabaseClient.removeChannel === 'function') {
                    await supabaseClient.removeChannel(this.realtimeSubscription);
                }

                // Yeni subscription oluştur
                const channelName = 'ip_ban_changes_' + Date.now();
                
                this.realtimeSubscription = supabaseClient
                    .channel(channelName)
                    .on('postgres_changes', {
                        event: '*', // INSERT, UPDATE, DELETE
                        schema: 'public',
                        table: 'user_ip_tracking'
                        // Filter kaldırıldı - tüm değişiklikleri dinle, sonra is_blocked kontrolü yap
                    }, async (payload) => {
                        // Payload yapısını kontrol et - Supabase farklı formatlar kullanabilir
                        const newData = payload.new || payload.record || {};
                        const oldData = payload.old || {};
                        
                        const ip = newData.ip_address || oldData.ip_address;
                        const isBlocked = newData.is_blocked === true;
                        const wasBlocked = oldData.is_blocked === true;

                        // Sadece is_blocked true olan ve yeni banlanan IP'leri işle
                        if (ip && isBlocked && !wasBlocked) {
                            // Cache'i temizle (hemen temizle ki bir sonraki kontrol güncel veriyi alsın)
                            this.clearCache(ip);
                            
                            // Anlık olarak banlanan IP ile giriş yapılmış oturumları kontrol et ve at
                            await this.checkAndLogoutBannedIP(ip);
                            
                            // Callback'leri çağır
                            await this.triggerBanChangeCallbacks(ip, isBlocked);
                        } else if (ip && !isBlocked && wasBlocked) {
                            // IP ban kaldırıldıysa sadece cache'i temizle
                            this.clearCache(ip);
                        }
                    })
                    .subscribe((status) => {
                        if (status === 'CHANNEL_ERROR') {
                            console.error('❌ Realtime subscription error for IP bans');
                        } else if (status === 'TIMED_OUT') {
                            console.error('⏱️ Realtime subscription timed out for IP bans');
                        }
                    });

            } catch (error) {
                console.error('Error setting up realtime subscription:', error);
            }
        }

        // Realtime subscription'ı kapat
        async cleanupRealtimeSubscription() {
            if (this.realtimeSubscription && window.supabase) {
                await window.supabase.removeChannel(this.realtimeSubscription);
                this.realtimeSubscription = null;
            }
        }
    }

    // Initialize IPBanChecker
    if (typeof window !== 'undefined') {
        window.ipBanChecker = new IPBanChecker();
        
        // Sayfa yüklendiğinde realtime subscription başlat
        async function initializeIPBanChecker() {
            // Realtime subscription başlat (Supabase hazır olduğunda)
            if (window.supabase) {
                await window.ipBanChecker.setupRealtimeSubscription();
            } else {
                // Supabase henüz hazır değilse bekle
                let attempts = 0;
                const maxAttempts = 20; // 10 saniye (20 * 500ms)
                const checkSupabase = setInterval(() => {
                    attempts++;
                    
                    if (window.supabase) {
                        clearInterval(checkSupabase);
                        window.ipBanChecker.setupRealtimeSubscription();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkSupabase);
                    }
                }, 500);
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initializeIPBanChecker();
            });
        } else {
            // DOM zaten yüklenmişse hemen başlat
            setTimeout(() => {
                initializeIPBanChecker();
            }, 100);
        }
    }
})();
