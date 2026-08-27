// Notification System for Premium Features
class NotificationSystem {
    constructor() {
        this.currentUser = null;
        this.subscription = null;
        this.reloadTimer = null;
        this.pollingInterval = null;
        this.lastKnownFeatures = null;
        this._realtimeSubscribed = false;
        this._initialFeaturesLoaded = false;
    }

    // Initialize notification system
    async init() {
        const session = window.authUtils?.checkAuth();
        if (!session) {
            // Misafir sayfalarında beklenen durum — sessiz geç.
            return;
        }
        
        this.currentUser = session;
        this.setupRealtimeSubscription();
    }

    // Setup Supabase Realtime subscription for premium features changes
    setupRealtimeSubscription() {
        if (!window.supabase || !this.currentUser) {
            console.warn('⚠️ Supabase or user not available for realtime');
            // Fallback to polling
            this.setupPollingFallback();
            return;
        }

        console.log('🔔 Setting up premium features realtime subscription for:', this.currentUser.username);

        // Check if we're on file:// protocol (realtime won't work)
        const isFileProtocol = window.location.protocol === 'file:';
        if (isFileProtocol) {
            console.warn('⚠️ File protocol detected - using polling fallback');
            this.setupPollingFallback();
            return;
        }

        // Load initial premium features to compare later
        this.loadInitialPremiumFeatures();

        try {
            // Subscribe to users table changes for this specific user's premium_features
            this.subscription = window.supabase
                .channel('premium-features-updates')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `username=eq.${this.currentUser.username}`
                }, (payload) => {
                    console.log('🔔 Premium features update received via Realtime:', payload);
                    this.handlePremiumFeaturesUpdate(payload);
                })
                .subscribe((status) => {
                    console.log('🔔 Subscription status:', status);
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Premium features realtime subscription established');
                        this._realtimeSubscribed = true;
                        if (this.pollingInterval) {
                            clearInterval(this.pollingInterval);
                            this.pollingInterval = null;
                        }
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        console.warn('⚠️ Realtime subscription failed, falling back to polling only');
                        this._realtimeSubscribed = false;
                        this.setupPollingFallback();
                    }
                });
        } catch (error) {
            console.error('❌ Error setting up realtime subscription:', error);
            this.setupPollingFallback();
        }
    }

    // Fallback polling — yalnızca Realtime yoksa (egress tasarrufu)
    setupPollingFallback() {
        if (this._realtimeSubscribed) return;
        if (this.pollingInterval) return;

        console.log('🔄 Premium features polling fallback (60s)');

        if (!this._initialFeaturesLoaded) {
            void this.loadInitialPremiumFeatures();
        }

        this.pollingInterval = setInterval(async () => {
            if (this._realtimeSubscribed) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
                return;
            }
            await this.checkPremiumFeaturesChanges();
        }, 60000);
    }

    // Load initial premium features state
    async loadInitialPremiumFeatures() {
        try {
            if (!window.supabase || !this.currentUser) return;
            
            const { data, error } = await window.supabase
                .from('users')
                .select('premium_features')
                .eq('username', this.currentUser.username)
                .single();
            
            if (!error && data) {
                const currentFeatures = data.premium_features || {};
                
                this.lastKnownFeatures = currentFeatures;
                this._initialFeaturesLoaded = true;
                
                // Update premium features cache
                if (window.premiumFeatures) {
                    window.premiumFeatures.premiumFeatures = this.lastKnownFeatures;
                    if (this.currentUser?.username) {
                        window.premiumFeatures._writePremiumCache?.(
                            this.currentUser.username,
                            this.lastKnownFeatures
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Error loading initial premium features:', error);
        }
    }

    // Check for premium features changes (polling)
    async checkPremiumFeaturesChanges() {
        try {
            if (!window.supabase || !this.currentUser) return;
            
            const { data, error } = await window.supabase
                .from('users')
                .select('premium_features')
                .eq('username', this.currentUser.username)
                .single();
            
            if (error || !data) return;
            
            const currentFeatures = data.premium_features || {};
            const oldFeatures = this.lastKnownFeatures || {};
            
            // Değişiklik var mı kontrol et
            const changedFeatures = this.detectFeatureChanges(oldFeatures, currentFeatures);
            
            if (changedFeatures.length > 0) {
                console.log('🔔 Premium features changed (via polling):', changedFeatures);
                
                // Cache'i güncelle
                this.lastKnownFeatures = currentFeatures;
                if (window.premiumFeatures) {
                    window.premiumFeatures.premiumFeatures = currentFeatures;
                }
                
                // Bildirim göster
                this.showPremiumFeaturesNotification(changedFeatures);
            } else {
                // Değişiklik yok, sadece cache'i güncelle
                this.lastKnownFeatures = currentFeatures;
                if (window.premiumFeatures) {
                    window.premiumFeatures.premiumFeatures = currentFeatures;
                }
            }
        } catch (error) {
            console.error('Error checking premium features changes:', error);
        }
    }

    // Handle premium features update from realtime
    handlePremiumFeaturesUpdate(payload) {
        if (!payload.new) return;

        const newFeatures = payload.new.premium_features || {};
        const oldFeatures = payload.old?.premium_features || this.lastKnownFeatures || {};

        if (JSON.stringify(newFeatures) === JSON.stringify(oldFeatures)) {
            return;
        }

        // Detect which features changed
        const changedFeatures = this.detectFeatureChanges(oldFeatures, newFeatures);
        
        if (changedFeatures.length === 0) {
            console.log('📋 No feature changes detected');
            // Still update cache
            this.lastKnownFeatures = newFeatures;
            if (window.premiumFeatures) {
                window.premiumFeatures.premiumFeatures = newFeatures;
            }
            return;
        }

        console.log('🔔 Premium features changed:', changedFeatures);

        // Update cache
        this.lastKnownFeatures = newFeatures;
        if (window.premiumFeatures) {
            window.premiumFeatures.premiumFeatures = newFeatures;
        }

        // Clear keyboard shortcuts cache if keyboardShortcuts feature changed
        const keyboardShortcutsChanged = changedFeatures.some(f => f.name === 'keyboardShortcuts');
        if (keyboardShortcutsChanged) {
            this.clearKeyboardShortcutsCache();
        }
        
        // Clear feature preferences cache if any feature was disabled
        const anyDisabled = changedFeatures.some(f => f.newValue === false);
        if (anyDisabled && window.premiumFeatures) {
            window.premiumFeatures.clearCache();
            console.log('🧹 Feature preferences cache cleared (admin disabled features)');
        }

        // Show notification for feature changes
        this.showPremiumFeaturesNotification(changedFeatures);
    }
    
    // Clear keyboard shortcuts cache
    clearKeyboardShortcutsCache() {
        if (!this.currentUser) return;
        
        const username = this.currentUser.username;
        const cacheKey = `keyboardShortcuts_${username}`;
        
        try {
            localStorage.removeItem(cacheKey);
            console.log('🗑️ Keyboard shortcuts cache cleared for', username);
        } catch (error) {
            console.warn('Error clearing keyboard shortcuts cache:', error);
        }
    }

    // Detect which features changed
    detectFeatureChanges(oldFeatures, newFeatures) {
        const changed = [];
        const allFeatureNames = new Set([
            ...Object.keys(oldFeatures || {}),
            ...Object.keys(newFeatures || {})
        ]);

        allFeatureNames.forEach(featureName => {
            const oldValue = oldFeatures[featureName] || false;
            const newValue = newFeatures[featureName] || false;
            
            if (oldValue !== newValue) {
                changed.push({
                    name: featureName,
                    oldValue: oldValue,
                    newValue: newValue,
                    enabled: newValue
                });
            }
        });

        return changed;
    }

    // Show notification about premium features change
    showPremiumFeaturesNotification(changedFeatures) {
        const enabledFeatures = changedFeatures.filter(f => f.enabled);
        const disabledFeatures = changedFeatures.filter(f => !f.enabled);

        // Show notification for enabled features (new premium features)
        if (enabledFeatures.length > 0) {
            const shouldShow = this.shouldShowNotification(enabledFeatures);
            if (!shouldShow) {
                console.log('⏭️ Notification already shown for these features, skipping');
                return;
            }
            this.markNotificationAsShown(enabledFeatures);
            const featureNames = enabledFeatures.map(f => this.getFeatureName(f.name)).join(', ');
            // Sadece sitede bildirim; tarayıcı popup bildirimi yok
            this.showInPageNotificationWithModal(enabledFeatures);
        }
        
        // Show notification for disabled features (premium features removed)
        if (disabledFeatures.length > 0) {
            const shouldShowDisabled = this.shouldShowDisabledNotification(disabledFeatures);
            if (!shouldShowDisabled) {
                console.log('⏭️ Disabled notification already shown for these features, skipping');
                this.reloadCurrentPage();
                return;
            }
            this.markDisabledNotificationAsShown(disabledFeatures);
            const featureNames = disabledFeatures.map(f => this.getFeatureName(f.name)).join(', ');
            // Sadece sitede bildirim; tarayıcı popup bildirimi yok
            this.showDisabledFeaturesNotification(disabledFeatures);
        }
    }

    // Check if notification should be shown (only once per feature)
    shouldShowNotification(enabledFeatures) {
        if (!this.currentUser) return true;
        
        const notificationKey = `premium_notification_shown_${this.currentUser.username}`;
        const shownFeatures = JSON.parse(localStorage.getItem(notificationKey) || '{}');
        
        // Check if any of the enabled features haven't been shown yet
        return enabledFeatures.some(feature => {
            const featureKey = feature.name;
            return !shownFeatures[featureKey];
        });
    }

    // Mark notification as shown
    markNotificationAsShown(enabledFeatures) {
        if (!this.currentUser) return;
        
        const notificationKey = `premium_notification_shown_${this.currentUser.username}`;
        const shownFeatures = JSON.parse(localStorage.getItem(notificationKey) || '{}');
        
        enabledFeatures.forEach(feature => {
            shownFeatures[feature.name] = true;
        });
        
        localStorage.setItem(notificationKey, JSON.stringify(shownFeatures));
    }

    // Check if disabled notification should be shown (only once per feature)
    shouldShowDisabledNotification(disabledFeatures) {
        if (!this.currentUser) return true;
        
        const notificationKey = `premium_notification_disabled_shown_${this.currentUser.username}`;
        const shownFeatures = JSON.parse(localStorage.getItem(notificationKey) || '{}');
        
        // Check if any of the disabled features haven't been shown yet
        return disabledFeatures.some(feature => {
            const featureKey = feature.name;
            return !shownFeatures[featureKey];
        });
    }

    // Mark disabled notification as shown
    markDisabledNotificationAsShown(disabledFeatures) {
        if (!this.currentUser) return;
        
        const notificationKey = `premium_notification_disabled_shown_${this.currentUser.username}`;
        const shownFeatures = JSON.parse(localStorage.getItem(notificationKey) || '{}');
        
        disabledFeatures.forEach(feature => {
            shownFeatures[feature.name] = true;
        });
        
        localStorage.setItem(notificationKey, JSON.stringify(shownFeatures));
    }

    // Get user-friendly feature name
    getFeatureName(featureName) {
        const featureNames = {
            'autoPaste': 'Otomatik Yapıştır',
            'keyboardShortcuts': 'Klavye Kısayolları',
            'bulkCopy': 'Toplu Kopyalama',
            'imageSearch': 'Görsel Link Arama',
            'darkMode': 'Karanlık Mod',
            'offlineMode': 'Çevrimdışı Mod',
            'advancedFilters': 'Gelişmiş Filtreler',
            'unlimitedHistory': 'Sınırsız Geçmiş',
            'favorites': 'Favoriler',
            'stokSayimi': 'Stok Sayımı',
            'lowStockAlert': 'Düşük Stok Uyarısı',
            'urunAjandasi': 'Ürün Ajandası',
            'raftakiEksikler': 'Raftaki Eksikler'
        };
        return featureNames[featureName] || featureName;
    }

    // Get feature emoji
    getFeatureEmoji(featureName) {
        const emojis = {
            'autoPaste': '📋',
            'keyboardShortcuts': '⌨️',
            'bulkCopy': '📦',
            'imageSearch': '🖼️',
            'darkMode': '🌙',
            'offlineMode': '📡',
            'advancedFilters': '🔍',
            'unlimitedHistory': '📜',
            'favorites': '⭐',
            'stokSayimi': '📊',
            'lowStockAlert': '🔔',
            'urunAjandasi': '📒',
            'raftakiEksikler': '📋'
        };
        return emojis[featureName] || '✨';
    }

    // Get full feature description
    getFeatureFullDescription(featureName) {
        const descriptions = {
            'autoPaste': 'Terminal cihazınızdan kopyaladığınız barkodları, sayfaya geri döndüğünüzde otomatik olarak arama kutusuna yapıştırır. Bu sayede tekrar tekrar kopyala-yapıştır yapmadan hızlıca arama yapabilirsiniz.',
            'keyboardShortcuts': 'Klavye kısayolları ile sistemi daha hızlı kullanabilirsiniz. Örneğin Ctrl+K ile arama kutusuna odaklanabilir, Enter ile ilk sonuca geçebilirsiniz.',
            'bulkCopy': 'Birden fazla ürünün barkodlarını seçip tek seferde kopyalayabilirsiniz. Terminalde hızlıca okutabilmek için tüm barkodları toplu olarak alabilirsiniz.',
            'imageSearch': 'HTML tablolarından otomatik olarak ürün görsellerinin linklerini çıkarır ve hem ürün adına hem de görsel linkine göre arama yapar. Bu sayede daha doğru eşleşmeler bulabilirsiniz. Direkt görsel linki ile de arama yapabilirsiniz.',
            'darkMode': 'Göz yormayan karanlık tema ile daha uzun süre rahatlıkla çalışabilirsiniz. Özellikle düşük ışıklı ortamlarda ideal.',
            'offlineMode': 'İnternet bağlantınız olmasa bile sık kullandığınız ürünleri arayabilirsiniz. Çevrimdışı mod ile kesintisiz çalışma devam eder.',
            'advancedFilters': 'Gelişmiş filtreleme seçenekleri ile ürünleri kategori, marka, stok durumu gibi kriterlere göre filtreleyebilirsiniz.',
            'unlimitedHistory': 'Arama geçmişiniz sınırsız saklanır. Daha önce aradığınız ürünleri kolayca tekrar bulabilirsiniz.',
            'favorites': 'Sık kullandığınız ürünleri favorilere ekleyip hızlı erişim sağlayabilirsiniz. Zaman kazandıran pratik bir özellik.',
            'stokSayimi': 'Getir franchise depolarında fiziksel stok sayımını dijitalleştirin. Depo stoklarınızı girin, sistem Getir API\'den otomatik olarak mevcut stok bilgisini çeker ve farkları gösterir. Mobil, tablet ve PC\'de çalışır, birden fazla sayım tablosu oluşturabilirsiniz.',
            'lowStockAlert': 'Stok hareketlerine göre eşiğin altına düşen ürünlerde sesli/görsel uyarı alırsınız. Liste Stoğu Düşük sayfasında güncel tutulur; Chrome eklentisi ile franchise sayfasında anlık bildirim alabilirsiniz.',
            'urunAjandasi': 'Müşterinin eksik bildirdiği ürünleri ajandaya kaydedin. Eksik adet, sebep ve not ile takip edin; tamamlanan kayıtları silebilirsiniz.',
            'raftakiEksikler': 'Depo raflarınızı oluşturun, eksik ürünleri işaretleyin ve sepetten toplama yapın. PC ve telefon arasında anlık senkron.'
        };
        return descriptions[featureName] || 'Bu özellik çalışma verimliliğinizi artırır.';
    }

    // Show in-page notification with modal option
    showInPageNotificationWithModal(enabledFeatures) {
        // Remove existing notification if any
        const existingNotification = document.getElementById('premium-features-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const featureNames = enabledFeatures.map(f => this.getFeatureName(f.name)).join(', ');

        console.log('📢 Showing premium features notification for:', enabledFeatures);
        
        // Create notification element with click handler
        const notification = document.createElement('div');
        notification.id = 'premium-features-notification';
        notification.className = 'fixed top-4 right-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-4 rounded-lg shadow-lg max-w-md cursor-pointer hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105';
        notification.style.zIndex = '9998'; // High z-index, but lower than modal
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="text-2xl">✨</div>
                <div class="flex-1">
                    <p class="font-semibold text-lg">Yeni Premium Özellikler!</p>
                    <p class="text-sm mt-1 opacity-95">${featureNames}</p>
                    <p class="text-xs mt-2 opacity-80">📋 Detaylar için tıklayın</p>
                </div>
                <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </div>
        `;

        // Add click handler to show modal
        notification.addEventListener('click', () => {
            this.showPremiumFeaturesModal(enabledFeatures);
            notification.remove();
        });

        document.body.appendChild(notification);

        // Don't auto-remove - let user click or close manually
        // Add close button (will reload page when clicked)
        const closeBtn = document.createElement('button');
        closeBtn.className = 'absolute top-2 right-2 text-white opacity-70 hover:opacity-100';
        closeBtn.innerHTML = '×';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.lineHeight = '1';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notification.remove();
            // Reload page after closing
            this.reloadCurrentPage();
        });
        notification.appendChild(closeBtn);
    }

    // Show premium features information modal
    showPremiumFeaturesModal(enabledFeatures) {
        console.log('📋 Showing premium features modal for:', enabledFeatures);
        
        // Remove existing modal if any
        const existingModal = document.getElementById('premium-features-info-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal - using very high z-index to ensure it's on top
        const modal = document.createElement('div');
        modal.id = 'premium-features-info-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4';
        modal.style.zIndex = '9999'; // Very high z-index to ensure visibility
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-t-xl">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="text-4xl">✨</div>
                            <div>
                                <h3 class="text-2xl font-bold">Yeni Premium Özellikler!</h3>
                                <p class="text-purple-100 text-sm mt-1">Artık bu özelliklere erişebilirsiniz</p>
                            </div>
                        </div>
                        <button id="closePremiumModal" class="text-white hover:text-purple-200 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="p-6">
                    <div class="space-y-4">
                        ${enabledFeatures.map(feature => `
                            <div class="border border-purple-100 rounded-lg p-4 hover:bg-purple-50 transition-colors">
                                <div class="flex items-start space-x-3">
                                    <div class="text-2xl mt-1">${this.getFeatureEmoji(feature.name)}</div>
                                    <div class="flex-1">
                                        <h4 class="font-semibold text-lg text-gray-900">${this.getFeatureName(feature.name)}</h4>
                                        <p class="text-gray-600 text-sm mt-1">${this.getFeatureFullDescription(feature.name)}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div class="flex items-start space-x-3">
                            <div class="text-xl">⚙️</div>
                            <div>
                                <p class="font-semibold text-gray-900">Nasıl Kullanılır?</p>
                                <p class="text-gray-700 text-sm mt-1">
                                    Bu premium özellikler şu anda aktif! Ancak isterseniz <strong>Ayarlar</strong> bölümünden 
                                    her bir özelliği açıp kapatabilirsiniz. Bu sayede size en uygun deneyimi oluşturabilirsiniz.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-6 flex justify-end space-x-3">
                        <button id="goToSettings" class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                            ⚙️ Ayarlara Git
                        </button>
                        <button id="closePremiumModalBtn" class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                            Anladım
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        const closeModal = () => {
            modal.remove();
        };

        const handleModalClose = () => {
            closeModal();
            // Reload page after closing modal
            this.reloadCurrentPage();
        };

        document.getElementById('closePremiumModal')?.addEventListener('click', handleModalClose);
        document.getElementById('closePremiumModalBtn')?.addEventListener('click', handleModalClose);
        document.getElementById('goToSettings')?.addEventListener('click', () => {
            closeModal();
            // Reload page first, then settings will be available on reload
            this.reloadCurrentPage();
        });

        // Close on overlay click (will reload page)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleModalClose();
            }
        });
    }

    // Show notification for disabled features (premium features removed)
    showDisabledFeaturesNotification(disabledFeatures) {
        const featureNames = disabledFeatures.map(f => this.getFeatureName(f.name)).join(', ');
        
        console.log('⚠️ Showing disabled features notification for:', disabledFeatures);
        
        // Remove existing notification if any
        const existingNotification = document.getElementById('premium-features-disabled-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'premium-features-disabled-notification';
        notification.className = 'fixed top-4 right-4 bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-4 rounded-lg shadow-lg max-w-md z-[9998]';
        notification.style.zIndex = '9998';
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="text-2xl">⚠️</div>
                <div class="flex-1">
                    <p class="font-semibold text-lg">Bilgilendirme!</p>
                    <p class="text-sm mt-1 opacity-95">Artık bu özelliklere erişemeyeceksiniz: ${featureNames}</p>
                    <p class="text-xs mt-2 opacity-80">📋 Tıklayınca sayfa yenilenecek...</p>
                </div>
                <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
        `;

        // Add click handler to reload page
        notification.addEventListener('click', () => {
            notification.remove();
            this.reloadCurrentPage();
        });

        document.body.appendChild(notification);

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'absolute top-2 right-2 text-white opacity-70 hover:opacity-100';
        closeBtn.innerHTML = '×';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.lineHeight = '1';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notification.remove();
            // Reload current page (F5 equivalent)
            this.reloadCurrentPage();
        });
        notification.appendChild(closeBtn);

        // Don't auto-reload - wait for user click
    }

    // Reload current page (F5 equivalent)
    reloadCurrentPage() {
        console.log('🔄 Reloading current page:', window.location.href);
        // Reload the current page - equivalent to F5
        window.location.reload();
    }

    // No auto-reload needed - user controls through settings (except for disabled features)

    // Cleanup subscription
    cleanup() {
        if (this.subscription) {
            window.supabase?.removeChannel(this.subscription);
            this.subscription = null;
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
            this.reloadTimer = null;
        }
    }
}

// Global notification system instance
window.notificationSystem = new NotificationSystem();

// Initialize when auth is ready (aggressive initialization like update-notifications.js)
async function initializeNotificationSystem() {
    // Wait for auth to be ready (max 10 seconds)
    let attempts = 0;
    const maxAttempts = 20; // 20 * 500ms = 10 seconds
    
    const checkAuth = setInterval(() => {
        attempts++;
        
        if (window.authUtils?.checkAuth()) {
            clearInterval(checkAuth);
            console.log('✅ Auth ready, initializing NotificationSystem...');
            window.notificationSystem.init();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkAuth);
            // Giriş yapmamış ziyaretçide bu normal — uyarı basma.
            window.notificationSystem.init();
        }
    }, 500);
}

// Start initialization immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotificationSystem);
} else {
    // DOM already loaded, start immediately
    initializeNotificationSystem();
}

