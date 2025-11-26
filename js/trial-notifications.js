// Trial Notification System
// Handles trial expiry warnings and notifications

(function() {
    'use strict';

    // Format time remaining
    function formatTimeRemaining(days, hours, minutes, seconds) {
        const parts = [];
        if (days > 0) parts.push(`${days} gün`);
        if (hours > 0 || days > 0) parts.push(`${hours} saat`);
        if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes} dakika`);
        parts.push(`${seconds} saniye`);
        return parts.join(' ');
    }

    // Create notification container if it doesn't exist
    function createNotificationContainer() {
        if (document.getElementById('trialNotificationContainer')) {
            return;
        }

        const container = document.createElement('div');
        container.id = 'trialNotificationContainer';
        container.className = 'fixed top-4 right-4 z-50 space-y-3';
        container.style.cssText = 'max-width: 420px; pointer-events: none;';
        document.body.appendChild(container);
    }

    // Create minimized notification badge
    function createMinimizedBadge(trialEnd) {
        const badgeId = 'trialMinimizedBadge';
        let badge = document.getElementById(badgeId);
        
        if (!badge) {
            badge = document.createElement('div');
            badge.id = badgeId;
            badge.className = 'fixed top-4 right-4 z-40 cursor-pointer transition-all duration-300';
            badge.style.cssText = 'pointer-events: auto;';
            
            const updateBadgeTime = () => {
                const now = new Date();
                const trialEndDate = new Date(trialEnd);
                const timeLeft = trialEndDate - now;
                
                if (timeLeft <= 0) {
                    timeSpan.textContent = 'Süre Doldu';
                    // Clear interval and logout
                    if (badge.dataset.intervalId) {
                        clearInterval(parseInt(badge.dataset.intervalId));
                    }
                    // Logout after showing notification
                    if (window.authUtils && window.authUtils.logout) {
                        showTrialNotification(trialEnd, true);
                        setTimeout(() => {
                            window.authUtils.logout();
                        }, 2000);
                    }
                    return;
                }
                
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                
                timeSpan.textContent = formatTimeRemaining(days, hours, minutes, seconds);
            };
            
            badge.innerHTML = `
                <div class="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:shadow-xl hover:scale-105 transition-all">
                    <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <span class="text-sm font-semibold">Trial: </span>
                    <span id="trialBadgeTime" class="text-sm font-mono font-bold"></span>
                </div>
            `;
            
            const timeSpan = badge.querySelector('#trialBadgeTime');
            updateBadgeTime();
            
            // Update every second
            const badgeInterval = setInterval(() => {
                updateBadgeTime();
            }, 1000);
            
            // Store interval ID for cleanup
            badge.dataset.intervalId = badgeInterval;
            
            badge.addEventListener('click', () => {
                showTrialNotification(trialEnd, true);
            });
            
            document.body.appendChild(badge);
        }
        
        return badge;
    }

    // Show trial notification card
    function showTrialNotification(trialEnd, forceShow = false) {
        createNotificationContainer();
        
        const container = document.getElementById('trialNotificationContainer');
        const notificationId = 'trialNotificationCard';
        
        // Check if notification was dismissed by user today
        const dismissedKey = `trialNotificationDismissed_${trialEnd}`;
        const dismissedData = localStorage.getItem(dismissedKey);
        let wasDismissed = false;
        
        if (dismissedData) {
            try {
                const dismissed = JSON.parse(dismissedData);
                const dismissedDate = new Date(dismissed.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dismissedDate.setHours(0, 0, 0, 0);
                
                // Check if dismissed today
                wasDismissed = dismissedDate.getTime() === today.getTime();
            } catch (e) {
                // If old format, treat as dismissed
                wasDismissed = dismissedData === 'true';
            }
        }
        
        // Remove existing notification if forceShow is true
        if (forceShow) {
            const existing = document.getElementById(notificationId);
            if (existing) {
                existing.remove();
            }
            // Clear dismissed flag when forcing show
            localStorage.removeItem(dismissedKey);
        } else {
            // Check if already shown and not dismissed
            if (document.getElementById(notificationId)) {
                return;
            }
            // Don't show if user dismissed it (unless expired)
            if (wasDismissed) {
                const now = new Date();
                const trialEndDate = new Date(trialEnd);
                const timeLeft = trialEndDate - now;
                // Only show again if expired
                if (timeLeft > 0) {
                    return;
                }
            }
        }

        const now = new Date();
        const trialEndDate = new Date(trialEnd);
        const timeLeft = trialEndDate - now;
        const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const secondsLeft = Math.floor((timeLeft % (1000 * 60)) / 1000);

        // Only show if 1 day or less remaining
        if (daysLeft > 1 && !forceShow) {
            return;
        }

        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.className = 'trial-notification-card bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform transition-all duration-300';
        notification.style.cssText = 'pointer-events: auto; animation: slideInRight 0.3s ease-out;';
        
        // Determine notification type
        let bgGradient = '';
        let icon = '';
        let title = '';
        let message = '';
        let isExpired = timeLeft <= 0;

        if (isExpired) {
            bgGradient = 'from-red-500 to-red-600';
            icon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>`;
            title = 'Hesap Süresi Doldu';
            message = 'Üzgünüz, hesap süreniz dolmuştur. Hesabınızı aktif tutmak için lütfen yetkili ile iletişime geçerek ödemenizi tamamlayın.';
        } else if (daysLeft === 1) {
            bgGradient = 'from-orange-500 to-red-500';
            icon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>`;
            title = 'Son 24 Saat';
            message = `Hesap sürenizin bitmesine sadece 1 gün kaldı. Hesabınızın kesintisiz devam etmesi için lütfen yetkili ile iletişime geçerek ödemenizi tamamlayın. Aksi takdirde hesabınız otomatik olarak kapatılacaktır.`;
        } else if (daysLeft === 0 && hoursLeft <= 24) {
            bgGradient = 'from-red-500 to-red-600';
            icon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>`;
            title = 'Son Saatler';
            message = `Hesap sürenizin bitmesine sadece ${hoursLeft} saat kaldı. Hesabınızın kesintisiz devam etmesi için lütfen yetkili ile iletişime geçerek ödemenizi tamamlayın.`;
        } else {
            return; // Don't show if more than 1 day left
        }

        notification.innerHTML = `
            <div class="bg-gradient-to-r ${bgGradient} text-white p-5">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-3">
                        <div class="bg-white/20 p-2 rounded-lg">
                            ${icon}
                        </div>
                        <div>
                            <h3 class="text-lg font-bold">${title}</h3>
                            <p class="text-sm opacity-90 mt-1">${isExpired ? 'Hesap Durumu' : 'Önemli Bilgilendirme'}</p>
                        </div>
                    </div>
                    <button id="closeTrialNotification" class="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="p-5 bg-gray-50">
                <p class="text-gray-700 text-sm leading-relaxed mb-4">
                    ${message}
                </p>
                ${!isExpired ? `
                    <div class="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                        <svg class="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <div class="flex-1">
                            <div class="font-semibold mb-1">Kalan Süre:</div>
                            <div id="trialTimeRemaining" class="font-mono text-base text-gray-800">
                                ${formatTimeRemaining(daysLeft, hoursLeft, minutesLeft, secondsLeft)}
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="mt-4 flex gap-2">
                    <button id="contactSupport" class="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 text-sm">
                        Destek ile İletişim
                    </button>
                    ${isExpired ? '' : `
                        <button id="dismissTrialNotification" class="px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 font-medium rounded-lg transition-all duration-200 text-sm">
                            Daha Sonra
                        </button>
                    `}
                </div>
            </div>
        `;

        container.appendChild(notification);

        // Update time remaining every second
        let timeUpdateInterval = null;
        if (!isExpired) {
            const timeRemainingElement = notification.querySelector('#trialTimeRemaining');
            timeUpdateInterval = setInterval(() => {
                const now = new Date();
                const trialEndDate = new Date(trialEnd);
                const timeLeft = trialEndDate - now;
                
                if (timeLeft <= 0) {
                    clearInterval(timeUpdateInterval);
                    // Trial expired - logout immediately
                    if (window.authUtils && window.authUtils.logout) {
                        // Show notification first, then logout
                        notification.remove();
                        showTrialNotification(trialEnd, true);
                        setTimeout(() => {
                            window.authUtils.logout();
                        }, 2000); // Give 2 seconds to see the notification
                    }
                    return;
                }
                
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                
                if (timeRemainingElement) {
                    timeRemainingElement.textContent = formatTimeRemaining(days, hours, minutes, seconds);
                }
            }, 1000);
        }

        // Close button handler
        const closeBtn = notification.querySelector('#closeTrialNotification');
        const laterBtn = notification.querySelector('#dismissTrialNotification');
        
        const dismissNotification = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            if (timeUpdateInterval) {
                clearInterval(timeUpdateInterval);
            }
            
            // Mark as dismissed in localStorage (only if not expired)
            if (!isExpired) {
                const dismissedKey = `trialNotificationDismissed_${trialEnd}`;
                const dismissedData = {
                    date: new Date().toISOString(),
                    dismissed: true
                };
                localStorage.setItem(dismissedKey, JSON.stringify(dismissedData));
            }
            
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
                // Show minimized badge
                if (!isExpired) {
                    createMinimizedBadge(trialEnd);
                }
            }, 300);
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', dismissNotification);
            // Prevent event bubbling
            closeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        }

        if (laterBtn && !isExpired) {
            laterBtn.addEventListener('click', dismissNotification);
            // Prevent event bubbling
            laterBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        }
        
        // Also close when clicking outside (optional - can be removed if not desired)
        // notification.addEventListener('click', (e) => {
        //     if (e.target === notification) {
        //         dismissNotification(e);
        //     }
        // });

        // Contact support button
        const contactBtn = notification.querySelector('#contactSupport');
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                openChatWithUsername();
                dismissNotification();
            });
        }

        // Auto dismiss after 10 seconds if expired (but don't open chat automatically)
        if (isExpired) {
            setTimeout(() => {
                if (document.getElementById(notificationId)) {
                    dismissNotification();
                }
            }, 10000);
        }
    }

    // Check trial status periodically
    function checkTrialStatus() {
        const session = window.authUtils?.checkAuth();
        if (!session || !session.trialEnd) {
            return;
        }

        // Don't show notifications for admin users
        if (session.isAdmin) {
            return;
        }

        const now = new Date();
        const trialEndDate = new Date(session.trialEnd);
        const timeLeft = trialEndDate - now;
        const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));

        // If trial expired, logout immediately
        if (timeLeft <= 0) {
            if (window.authUtils && window.authUtils.logout) {
                showTrialNotification(session.trialEnd, true);
                // Logout after showing notification
                setTimeout(() => {
                    window.authUtils.logout();
                }, 3000); // Give 3 seconds to see the notification
            }
            return;
        }

        // Check if notification is already shown
        const notificationId = 'trialNotificationCard';
        const isAlreadyShown = document.getElementById(notificationId) !== null;
        
        // Don't show if already shown
        if (isAlreadyShown) {
            return;
        }

        // Only show notification if 1 day or less remaining
        if (daysLeft <= 1) {
            // Check if user dismissed it today
            const dismissedKey = `trialNotificationDismissed_${session.trialEnd}`;
            const dismissedData = localStorage.getItem(dismissedKey);
            
            if (dismissedData) {
                try {
                    const dismissed = JSON.parse(dismissedData);
                    const dismissedDate = new Date(dismissed.date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dismissedDate.setHours(0, 0, 0, 0);
                    
                    // If dismissed today, don't show again
                    if (dismissedDate.getTime() === today.getTime()) {
                        return;
                    }
                } catch (e) {
                    // If parsing fails, treat as old format and clear it
                    localStorage.removeItem(dismissedKey);
                }
            }
            
            // Show notification
            showTrialNotification(session.trialEnd);
        }
    }

    // Function to open chat with username pre-filled
    function openChatWithUsername() {
        // Get username from session
        const session = window.authUtils?.checkAuth();
        let username = 'Kullanıcı';
        
        if (session && session.username) {
            username = session.username;
        } else {
            // Try to get from localStorage
            try {
                const userSession = JSON.parse(localStorage.getItem('userSession') || '{}');
                if (userSession.username) {
                    username = userSession.username;
                }
            } catch (e) {
                console.warn('Could not get username from session');
            }
        }
        
        // Open chat
        if (window.chatSystem && typeof window.chatSystem.openChat === 'function') {
            window.chatSystem.openChat();
        } else if (document.getElementById('openChat')) {
            document.getElementById('openChat').click();
        }
        
        // Wait a bit for chat to open, then fill message input
        setTimeout(() => {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                const message = `Merhaba, ben ${username}. Hesap sürem doldu, ödeme yapmak istiyorum.`;
                messageInput.value = message;
                messageInput.focus();
                // Scroll message input into view
                messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500);
    }

    // Show trial expired notification (for active sessions)
    window.showTrialExpiredNotification = function() {
        const session = window.authUtils?.checkAuth();
        if (!session || !session.trialEnd) {
            return;
        }
        showTrialNotification(session.trialEnd, true);
        // Don't auto open chat - user will be logged out anyway
    };

    // Show trial expired notification on login page
    window.showTrialExpiredLoginNotification = function() {
        // This will be called from login function
        // We'll show a notification on the login page
        setTimeout(() => {
            const errorDiv = document.getElementById('errorMessage');
            if (errorDiv) {
                errorDiv.classList.remove('hidden');
                const errorText = document.getElementById('errorText');
                if (errorText) {
                    errorText.innerHTML = `
                        <div class="flex items-start gap-3">
                            <svg class="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                            <div>
                                <p class="font-semibold mb-1">Hesap Süresi Doldu</p>
                                <p class="text-sm">Üzgünüz, hesap süreniz dolmuştur. Hesabınızı aktif tutmak için lütfen yetkili ile iletişime geçerek ödemenizi tamamlayın.</p>
                            </div>
                        </div>
                    `;
                }
            }
        }, 100);
    };

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Check immediately
            checkTrialStatus();
            // Check every 10 seconds for more responsive logout
            setInterval(checkTrialStatus, 10000);
        });
    } else {
        // Check immediately
        checkTrialStatus();
        // Check every 10 seconds for more responsive logout
        setInterval(checkTrialStatus, 10000);
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .trial-notification-card {
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
    `;
    document.head.appendChild(style);

})();

