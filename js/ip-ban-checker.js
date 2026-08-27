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

                // API'den kontrol et.
                // Eskiden tarayıcı blocked_ips tablosunu doğrudan okuyordu;
                // bu, engelli IP listesinin tamamının dışarıdan çekilebilmesi
                // demekti. Artık sunucu yalnızca "senin IP'n engelli mi"
                // sorusuna cevap veriyor, liste dışarı çıkmıyor.
                const api = window.jetbarkodAuth;
                if (!api || !api.apiBase()) {
                    return { isBlocked: false, reason: null, cached: false };
                }

                let isBlocked = false;
                try {
                    const res = await fetch(`${api.apiBase()}/api/ip/status`);
                    if (!res.ok) {
                        return { isBlocked: false, reason: null, cached: false };
                    }
                    const data = await res.json();
                    isBlocked = !!data.blocked;
                } catch (e) {
                    console.warn('IP durumu sorgulanamadı:', e?.message);
                    return { isBlocked: false, reason: null, cached: false };
                }

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

                // users.tracked_ips'ten kontrol et
                // Önce username'e göre user_id bul
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

                // users.tracked_ips'ten bu kullanıcının IP sayısını al
                const { data: userRow, error } = await window.supabase
                    .from('users')
                    .select('tracked_ips')
                    .eq('id', userId)
                    .maybeSingle();

                if (error) {
                    console.error('Error checking user tracked_ips:', error);
                    const ipLogs = JSON.parse(localStorage.getItem('ipLogs') || '[]');
                    const userIPs = new Set();
                    ipLogs.forEach(log => {
                        if (log.user_id === username && log.logout_time === undefined) {
                            userIPs.add(log.ip_address);
                        }
                    });
                    return userIPs.size > 1;
                }

                const tracked = Array.isArray(userRow?.tracked_ips) ? userRow.tracked_ips : [];
                return tracked.length > 1;

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

                // blocked_ips tablosu artık tarayıcıya kapalı; realtime aboneliği
                // VPS modunda bu tabloyu 4 saniyede bir yokluyordu ve sürekli
                // yetki hatası verirdi. Onun yerine sunucuya "benim IP'm
                // engellendi mi" diye soruyoruz — engelli listesi dışarı çıkmıyor.
                if (this._banPollTimer) {
                    clearInterval(this._banPollTimer);
                    this._banPollTimer = null;
                }

                const api = window.jetbarkodAuth;
                if (!api || !api.apiBase()) return;

                const poll = async () => {
                    try {
                        const res = await fetch(`${api.apiBase()}/api/ip/status`);
                        if (!res.ok) return;
                        const data = await res.json();
                        if (data.blocked && data.ip) {
                            this.clearCache(data.ip);
                            await this.checkAndLogoutBannedIP(data.ip);
                            await this.triggerBanChangeCallbacks(data.ip, true);
                        }
                    } catch (e) { /* ağ hatası — sessiz geç */ }
                };

                this._banPollTimer = setInterval(poll, 60000);
                void poll();

            } catch (error) {
                console.error('Error setting up realtime subscription:', error);
            }
        }

        // Realtime subscription'ı kapat
        async cleanupRealtimeSubscription() {
            if (this._banPollTimer) {
                clearInterval(this._banPollTimer);
                this._banPollTimer = null;
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
