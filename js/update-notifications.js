// Update Notifications System for Users
// Handles displaying update notifications to users

(function() {
    'use strict';

    class UpdateNotificationSystem {
        constructor() {
            this.currentUpdate = null;
            this.currentStepIndex = 0;
            this.isModalOpen = false;
            this.latestVersion = null;
        }

        async init() {
            console.log('📢 Update Notification System initialized');
            
            // Wait for Supabase and authUtils to be ready, then check immediately
            await this.waitForDependencies();
            
            // Check for updates immediately when page loads
            await this.checkForUpdates();
            
            // Check feature changes immediately
            if (window.featureManager) {
                await window.featureManager.checkAndApplyFeatureChanges();
            }
            
            // Check more frequently (every 10 seconds) for real-time updates
            // This ensures scheduled updates are applied within 10 seconds of their scheduled time
            setInterval(async () => {
                await this.checkForUpdates();
                // Also check and apply feature changes every time we check for updates
                if (window.featureManager) {
                    await window.featureManager.checkAndApplyFeatureChanges();
                }
            }, 10 * 1000);
            
            // Also check when page becomes visible (user switches tabs back)
            document.addEventListener('visibilitychange', async () => {
                if (!document.hidden) {
                    console.log('👁️ Page visible, checking for updates...');
                    await this.checkForUpdates();
                    if (window.featureManager) {
                        await window.featureManager.checkAndApplyFeatureChanges();
                    }
                }
            });
            
            // Check on window focus
            window.addEventListener('focus', async () => {
                console.log('🎯 Window focused, checking for updates...');
                await this.checkForUpdates();
                if (window.featureManager) {
                    await window.featureManager.checkAndApplyFeatureChanges();
                }
            });
        }

        async waitForDependencies(maxWait = 5000) {
            const startTime = Date.now();
            while (Date.now() - startTime < maxWait) {
                if (window.supabase && window.authUtils) {
                    const session = window.authUtils?.checkAuth();
                    if (session && session.username) {
                        console.log('✅ Dependencies ready, checking updates immediately');
                        return true;
                    }
                }
                // Wait 100ms before checking again
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.warn('⚠️ Dependencies not ready after timeout');
            return false;
        }

        async checkForUpdates() {
            try {
                if (!window.supabase) {
                    console.log('⏳ Supabase not available yet');
                    return;
                }

                const session = window.authUtils?.checkAuth();
                if (!session || !session.username) {
                    console.log('⏳ User not logged in, skipping update check');
                    return; // Not logged in
                }

                console.log('🔍 Starting update check for user:', session.username);

                // Get active updates that are scheduled or already active
                // Compare UTC times directly (scheduled_at is stored in UTC)
                const nowUTC = new Date().toISOString();
                
                // First try to get all updates (without is_active filter) to debug RLS issues
                let updates = null;
                let error = null;
                
                // Try with is_active filter first
                const { data: activeUpdatesData, error: activeError } = await window.supabase
                    .from('updates')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (activeError) {
                    console.error('❌ Error fetching active updates:', activeError);
                    // Try without filter as fallback
                    const { data: allUpdatesData, error: allError } = await window.supabase
                        .from('updates')
                        .select('*')
                        .order('created_at', { ascending: false });
                    
                    if (allError) {
                        console.error('❌ Error fetching all updates:', allError);
                        error = allError;
                    } else {
                        console.log('⚠️ Got updates without is_active filter, filtering in code');
                        updates = allUpdatesData;
                        // Filter in code
                        updates = updates.filter(u => u.is_active === true);
                    }
                } else {
                    updates = activeUpdatesData;
                }

                if (error) {
                    console.error('❌ Error fetching updates:', error);
                    // Don't throw, try to get version number anyway (only for time-passed updates)
                    const { data: allUpdatesData } = await window.supabase
                        .from('updates')
                        .select('update_number, scheduled_at')
                        .eq('is_active', true)
                        .order('created_at', { ascending: false });
                    
                    if (allUpdatesData && allUpdatesData.length > 0) {
                        // Find latest update that has passed its scheduled time
                        const timePassedUpdate = allUpdatesData.find(update => {
                            if (!update.scheduled_at) return true; // No schedule, consider active
                            return update.scheduled_at <= nowUTC;
                        });
                        
                        if (timePassedUpdate) {
                            this.updateVersionDisplay(timePassedUpdate.update_number);
                        }
                    }
                    return;
                }

                // If no updates in database, exit early
                if (!updates || updates.length === 0) {
                    console.log('📭 No updates found in database');
                    // Don't show version number if no updates
                    return;
                }

                console.log('📦 Found updates:', updates.map(u => ({
                    number: u.update_number,
                    scheduled: u.scheduled_at,
                    title: u.title
                })));

                // Filter updates based on scheduled_at (direct UTC comparison)
                const activeUpdates = (updates || []).filter(update => {
                    if (!update.scheduled_at) {
                        console.log(`✅ Update ${update.update_number} has no schedule, considering active`);
                        return true; // No schedule, always active
                    }
                    // Direct UTC comparison (scheduled_at is already UTC)
                    const isActive = update.scheduled_at <= nowUTC;
                    console.log(`⏰ Update ${update.update_number}: scheduled_at=${update.scheduled_at}, nowUTC=${nowUTC}, isActive=${isActive}`);
                    return isActive;
                });
                
                console.log('🔍 Update check:', {
                    totalUpdates: updates?.length || 0,
                    activeUpdates: activeUpdates.length,
                    nowUTC: nowUTC,
                    updates: activeUpdates.map(u => ({ number: u.update_number, scheduled: u.scheduled_at, title: u.title }))
                });

                if (!activeUpdates || activeUpdates.length === 0) {
                    console.log('📭 No active updates at this time (scheduled time not yet passed)');
                    // Don't show version number if no updates have passed their scheduled time
                    // This ensures version number only shows when update is actually active
                    return; // No active updates
                }

                // Check which updates user hasn't completed
                const { data: userStatuses, error: statusError } = await window.supabase
                    .from('user_update_status')
                    .select('*')
                    .eq('username', session.username);

                if (statusError) {
                    console.error('❌ Error fetching user update statuses:', statusError);
                    throw statusError;
                }

                console.log('👤 User statuses:', userStatuses?.map(s => ({
                    update_number: s.update_number,
                    is_seen: s.is_seen,
                    is_completed: s.is_completed
                })) || []);

                const completedUpdateNumbers = new Set(
                    (userStatuses || [])
                        .filter(s => s.is_completed)
                        .map(s => s.update_number)
                );

                console.log('✅ Completed updates:', Array.from(completedUpdateNumbers));

                // Normalize update numbers for comparison (remove extra spaces)
                const normalizeUpdateNumber = (num) => {
                    if (!num) return '';
                    return num.replace(/\s+/g, ' ').trim().toLowerCase();
                };

                // Versiyon numarasını parse et (v 1.0.2 -> [1, 0, 2])
                const parseVersionNumber = (versionString) => {
                    if (!versionString) return [0, 0, 0];
                    const match = versionString.match(/v\s*(\d+)\.(\d+)\.(\d+)/i);
                    if (match) {
                        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
                    }
                    return [0, 0, 0];
                };

                // İki versiyon numarasını karşılaştır (a > b ise 1, a < b ise -1, a == b ise 0)
                const compareVersions = (versionA, versionB) => {
                    const vA = parseVersionNumber(versionA);
                    const vB = parseVersionNumber(versionB);
                    
                    for (let i = 0; i < 3; i++) {
                        if (vA[i] > vB[i]) return 1;
                        if (vA[i] < vB[i]) return -1;
                    }
                    return 0;
                };

                // Aktif güncellemeleri versiyon numarasına göre sırala (en yüksek önce, en güncel önce)
                activeUpdates.sort((a, b) => {
                    return compareVersions(b.update_number, a.update_number); // Descending order (yeni → eski)
                });

                console.log('📋 Active updates sorted (newest first):', activeUpdates.map(u => u.update_number));

                // En güncel (en yüksek versiyon) güncellemeyi bul
                const latestUpdate = activeUpdates[0];
                
                if (!latestUpdate) {
                    console.log('📭 No active updates found');
                    return;
                }

                // En güncel güncellemenin tamamlanıp tamamlanmadığını kontrol et
                const normalizedLatestUpdateNum = normalizeUpdateNumber(latestUpdate.update_number);
                const isLatestCompleted = Array.from(completedUpdateNumbers).some(completedNum => 
                    normalizeUpdateNumber(completedNum) === normalizedLatestUpdateNum
                );

                console.log(`🔍 Latest update ${latestUpdate.update_number}: isCompleted=${isLatestCompleted}`);

                let uncompletedUpdate = null;

                if (isLatestCompleted) {
                    // En güncel güncelleme tamamlanmışsa, önceki tüm güncellemeleri de otomatik tamamlanmış say
                    // Yeni kullanıcılar için: Sadece son güncellemeyi göster, öncekileri gösterme
                    // Eski kullanıcılar için: Son güncellemeyi tamamladıysa, öncekileri de tamamlanmış say
                    console.log('✅ Latest update is completed, considering all previous updates as completed too');
                    
                    // Önceki güncellemeleri otomatik olarak tamamlanmış olarak işaretle (sessizce)
                    // Bu sayede yeni kullanıcılar sadece son güncellemeyi görür
                    const previousUpdates = activeUpdates.slice(1); // En güncel hariç diğerleri
                    for (const prevUpdate of previousUpdates) {
                        const normalizedPrevUpdateNum = normalizeUpdateNumber(prevUpdate.update_number);
                        const isPrevCompleted = Array.from(completedUpdateNumbers).some(completedNum => 
                            normalizeUpdateNumber(completedNum) === normalizedPrevUpdateNum
                        );
                        
                        if (!isPrevCompleted) {
                            console.log(`🔄 Auto-completing previous update ${prevUpdate.update_number} (latest ${latestUpdate.update_number} is completed)`);
                            
                            // Önceki güncellemeyi otomatik tamamlanmış olarak işaretle
                            const { data: existingPrevStatus } = await window.supabase
                                .from('user_update_status')
                                .select('id')
                                .eq('username', session.username)
                                .eq('update_number', prevUpdate.update_number)
                                .single();
                            
                            if (existingPrevStatus) {
                                await window.supabase
                                    .from('user_update_status')
                                    .update({
                                        is_completed: true,
                                        completed_at: new Date().toISOString(),
                                        is_seen: true,
                                        seen_at: new Date().toISOString()
                                    })
                                    .eq('id', existingPrevStatus.id);
                            } else {
                                await window.supabase
                                    .from('user_update_status')
                                    .insert({
                                        username: session.username,
                                        update_number: prevUpdate.update_number,
                                        is_seen: true,
                                        seen_at: new Date().toISOString(),
                                        is_completed: true,
                                        completed_at: new Date().toISOString()
                                    });
                            }
                        }
                    }
                    
                    // Tüm güncellemeler tamamlanmış sayılır, bildirim gösterme
                    uncompletedUpdate = null;
                } else {
                    // En güncel güncelleme tamamlanmamışsa, sadece onu göster
                    console.log('📢 Latest update is not completed, showing only the latest update');
                    uncompletedUpdate = latestUpdate;
                }

                if (uncompletedUpdate) {
                    console.log('🎯 Found uncompleted update:', uncompletedUpdate.update_number);
                    
                    // Check if user has seen this update
                    const normalizedUpdateNum = normalizeUpdateNumber(uncompletedUpdate.update_number);
                    const userStatus = (userStatuses || []).find(s => 
                        normalizeUpdateNumber(s.update_number) === normalizedUpdateNum
                    );
                    const isSeen = userStatus?.is_seen || false;
                    
                    console.log('👁️ Update status:', {
                        update_number: uncompletedUpdate.update_number,
                        is_seen: isSeen,
                        is_completed: userStatus?.is_completed || false
                    });
                    
                    // Store latest version for footer display
                    this.updateVersionDisplay(uncompletedUpdate.update_number);
                    
                    // Always check and apply feature changes for ALL active updates (not just uncompleted)
                    // This ensures feature changes are applied immediately when scheduled time arrives
                    if (window.featureManager) {
                        await window.featureManager.checkAndApplyFeatureChanges();
                    }
                    
                    // Show notification badge (minimal if seen, full if not seen)
                    console.log('📢 Showing notification badge for update:', uncompletedUpdate.update_number);
                    this.showNotificationBadge(uncompletedUpdate, isSeen);
                } else {
                    console.log('✅ All active updates are completed by user');
                    // No uncompleted updates, but check for latest version anyway
                    if (activeUpdates.length > 0) {
                        const latestUpdate = activeUpdates[0];
                        this.updateVersionDisplay(latestUpdate.update_number);
                    }
                    
                    // Still check for feature changes even if no uncompleted updates
                    if (window.featureManager) {
                        await window.featureManager.checkAndApplyFeatureChanges();
                    }
                }
            } catch (error) {
                console.error('❌ Error checking for updates:', error);
                console.error('Error stack:', error.stack);
            }
        }

        updateVersionDisplay(updateNumber) {
            if (!updateNumber) {
                console.log('⚠️ No update number provided for version display');
                return;
            }
            
            // Extract version number from "v x.y.z" format
            const match = updateNumber?.match(/^v\s*(\d+)\.(\d+)\.(\d+)$/i);
            if (match) {
                const version = `${match[1]}.${match[2]}.${match[3]}`;
                const versionElement = document.getElementById('versionDisplay');
                if (versionElement) {
                    versionElement.textContent = `Versiyon ${version}`;
                    console.log('✅ Version display updated to:', version);
                } else {
                    console.warn('⚠️ Version display element not found (id="versionDisplay")');
                    // Try to find it after a delay (DOM might not be ready)
                    setTimeout(() => {
                        const delayedElement = document.getElementById('versionDisplay');
                        if (delayedElement) {
                            delayedElement.textContent = `Versiyon ${version}`;
                            console.log('✅ Version display updated (delayed) to:', version);
                        }
                    }, 1000);
                }
                this.latestVersion = version;
            } else {
                console.warn('⚠️ Invalid update number format:', updateNumber);
            }
        }

        async markUpdateAsSeen(updateNumber) {
            try {
                if (!window.supabase) return;

                const session = window.authUtils?.checkAuth();
                if (!session || !session.username) return;

                // Check if status already exists
                const { data: existing } = await window.supabase
                    .from('user_update_status')
                    .select('id, is_seen, seen_at')
                    .eq('username', session.username)
                    .eq('update_number', updateNumber)
                    .single();

                if (existing) {
                    // Only update if not already seen (preserve first seen_at time)
                    if (!existing.is_seen) {
                        // First time seeing - record the exact time
                        await window.supabase
                            .from('user_update_status')
                            .update({
                                is_seen: true,
                                seen_at: new Date().toISOString() // İlk görüldüğü anın saati
                            })
                            .eq('id', existing.id);
                    }
                    // If already seen, don't update seen_at - keep the original first time
                } else {
                    // Create new
                    await window.supabase
                        .from('user_update_status')
                        .insert({
                            username: session.username,
                            update_number: updateNumber,
                            is_seen: true,
                            seen_at: new Date().toISOString(),
                            is_completed: false
                        });
                }
            } catch (error) {
                console.error('Error marking update as seen:', error);
            }
        }

        showNotificationBadge(update, isSeen = false) {
            // Remove existing badge if any
            const existingBadge = document.getElementById('updateNotificationBadge');
            if (existingBadge) {
                existingBadge.remove();
            }

            // Create badge - minimal if seen, full if not seen
            const badge = document.createElement('div');
            badge.id = 'updateNotificationBadge';
            badge.className = `fixed top-4 right-4 z-50 ${isSeen ? '' : 'animate-pulse'}`;
            
            if (isSeen) {
                // Minimal badge for seen updates (much smaller, less prominent, no animation)
                badge.innerHTML = `
                    <div class="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-2.5 py-1.5 rounded-md shadow-sm cursor-pointer hover:from-green-500 hover:to-emerald-600 transition-all text-xs">
                        <div class="flex items-center space-x-1.5">
                            <div class="text-sm">📢</div>
                            <div class="flex-1 min-w-0">
                                <p class="font-medium text-xs leading-tight whitespace-nowrap">Güncelleme Detayları</p>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Full badge for unseen updates (green gradient for updates)
                badge.innerHTML = `
                    <div class="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-lg shadow-xl cursor-pointer hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105 max-w-sm">
                        <div class="flex items-center space-x-3">
                            <div class="text-2xl">📢</div>
                            <div class="flex-1">
                                <p class="font-semibold text-lg">Yeni Güncelleme!</p>
                                <p class="text-sm mt-1 opacity-90">${update.title}</p>
                                <p class="text-xs mt-2 opacity-80">Detaylar için tıklayın</p>
                            </div>
                            <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </div>
                    </div>
                `;
            }

            badge.addEventListener('click', async () => {
                // Mark as seen when user clicks
                await this.markUpdateAsSeen(update.update_number);
                // Hide badge while modal is open (don't remove, so we can show it again if modal closes without completion)
                badge.style.display = 'none';
                this.showUpdateModal(update);
            });

            document.body.appendChild(badge);

            // Auto-hide pulse animation after 10 seconds (but keep clickable)
            if (!isSeen) {
                setTimeout(() => {
                    if (badge.parentNode) {
                        badge.classList.remove('animate-pulse');
                    }
                }, 10000);
            }
        }

        // Product Update JSON Parse Fonksiyonu
        parseProductUpdateJSON(description) {
            if (!description || !description.trim()) return null;
            
            try {
                // Description'dan JSON'u bul (tüm satırları kontrol et)
                const lines = description.split('\n');
                let jsonStart = -1;
                let jsonEnd = -1;
                let braceCount = 0;
                
                // JSON'un başlangıç ve bitişini bul
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.includes('"type"') && line.includes('"product_update"')) {
                        jsonStart = i;
                        braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                        if (braceCount === 0 && line.endsWith('}')) {
                            // Tek satırda JSON
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.type === 'product_update' && Array.isArray(parsed.products)) {
                                    return {
                                        products: parsed.products,
                                        display_type: parsed.display_type || 'grid'
                                    };
                                }
                            } catch (e) {
                                // Devam et
                            }
                        }
                    } else if (jsonStart !== -1) {
                        braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                        if (braceCount === 0 && line.includes('}')) {
                            jsonEnd = i;
                            break;
                        }
                    }
                }
                
                // JSON'u parse et
                if (jsonStart !== -1) {
                    const jsonLines = jsonEnd !== -1 
                        ? lines.slice(jsonStart, jsonEnd + 1)
                        : lines.slice(jsonStart);
                    const jsonString = jsonLines.join('\n');
                    
                    try {
                        const parsed = JSON.parse(jsonString);
                        if (parsed.type === 'product_update' && Array.isArray(parsed.products)) {
                            return {
                                products: parsed.products,
                                display_type: parsed.display_type || 'grid'
                            };
                        }
                    } catch (e) {
                        // JSON parse hatası, description'ın tamamını kontrol et
                        try {
                            const fullParsed = JSON.parse(description.trim());
                            if (fullParsed.type === 'product_update' && Array.isArray(fullParsed.products)) {
                                return {
                                    products: fullParsed.products,
                                    display_type: fullParsed.display_type || 'grid'
                                };
                            }
                        } catch (e2) {
                            // JSON değil, null döndür
                        }
                    }
                }
            } catch (error) {
                console.warn('Product update JSON parse hatası:', error);
            }
            
            return null;
        }

        // Product Update Render Fonksiyonu (Grid, List, Carousel, Orbit)
        renderProductUpdate(products, showAll = false, displayType = 'grid') {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            // Display type'a göre farklı render fonksiyonlarını çağır
            switch(displayType) {
                case 'list':
                    return this.renderProductUpdateList(products, showAll);
                case 'carousel':
                    return this.renderProductUpdateCarousel(products, showAll);
                case 'orbit':
                    return this.renderProductUpdateOrbit(products, showAll);
                case 'grid':
                default:
                    return this.renderProductUpdateGrid(products, showAll);
            }
        }

        // Grid Görünümü
        renderProductUpdateGrid(products, showAll = false) {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            // Responsive grid: Ekran boyutuna göre kaç ürün gösterileceğini hesapla
            let initialDisplayCount = 12; // Varsayılan: 3 sütun x 4 satır = 12
            if (typeof window !== 'undefined' && window.innerWidth) {
                if (window.innerWidth < 768) {
                    initialDisplayCount = 6; // Mobil: 2 sütun x 3 satır
                } else if (window.innerWidth < 1024) {
                    initialDisplayCount = 12; // Tablet: 3 sütun x 4 satır
                } else if (window.innerWidth < 1280) {
                    initialDisplayCount = 16; // Desktop: 4 sütun x 4 satır
                } else {
                    initialDisplayCount = 18; // Büyük ekran: 6 sütun x 3 satır
                }
            }
            
            const shouldShowAll = showAll || products.length <= initialDisplayCount;
            const displayProducts = shouldShowAll ? products : products.slice(0, initialDisplayCount);
            const remainingCount = products.length - initialDisplayCount;
            const uniqueId = 'product-update-' + Math.random().toString(36).substr(2, 9);
            
            // Products'ı string olarak sakla (onclick için) - UTF-8 uyumlu Base64 encode
            const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
            
            return `
                <div class="product-update-grid mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="grid">
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        ${displayProducts.map(product => {
                            const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                            const barcode = product.barcode || 'Barkod yok';
                            const image = product.image || '';
                            
                            return `
                                <div class="product-card bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex flex-col">
                                    <div class="product-card-image-container bg-gray-100 flex items-center justify-center flex-shrink-0" style="height: 120px; overflow: hidden;">
                                        ${image ? `
                                            <img src="${image}" 
                                                 alt="${productName}" 
                                                 class="product-card-image w-full h-full object-cover"
                                                 onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs\\'>Görsel Yok</div>';"
                                                 loading="lazy">
                                        ` : `
                                            <div class="text-gray-400 text-xs">Görsel Yok</div>
                                        `}
                                    </div>
                                    <div class="p-2 flex-1 flex flex-col">
                                        <div class="product-card-name font-medium text-xs text-gray-900 mb-1 flex-1" style="word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;">
                                            ${productName}
                                        </div>
                                        <div class="product-card-barcode text-xs text-gray-600 font-mono mt-auto">
                                            ${barcode}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${remainingCount > 0 && !shouldShowAll ? `
                        <div class="mt-4 text-center">
                            <button onclick="
                                (function() {
                                    const container = document.getElementById('${uniqueId}');
                                    if (!container) return;
                                    const productsBase64 = container.getAttribute('data-products');
                                    if (!productsBase64) return;
                                    try {
                                        const products = JSON.parse(decodeURIComponent(atob(productsBase64)));
                                        const displayType = container.getAttribute('data-display-type') || 'grid';
                                        if (window.updateNotificationSystem) {
                                            container.innerHTML = window.updateNotificationSystem.renderProductUpdate(products, true, displayType);
                                        }
                                    } catch(e) {
                                        console.error('Product update render error:', e);
                                    }
                                })();
                            " class="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer transition-colors px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 inline-block">
                                <span class="font-semibold">+${remainingCount} ürün daha</span> görmek için tıklayın
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // List Görünümü
        renderProductUpdateList(products, showAll = false) {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            let initialDisplayCount = 10;
            if (typeof window !== 'undefined' && window.innerWidth) {
                if (window.innerWidth < 768) {
                    initialDisplayCount = 5;
                } else if (window.innerWidth < 1024) {
                    initialDisplayCount = 8;
                } else {
                    initialDisplayCount = 10;
                }
            }
            
            const shouldShowAll = showAll || products.length <= initialDisplayCount;
            const displayProducts = shouldShowAll ? products : products.slice(0, initialDisplayCount);
            const remainingCount = products.length - initialDisplayCount;
            const uniqueId = 'product-update-list-' + Math.random().toString(36).substr(2, 9);
            const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
            
            return `
                <div class="product-update-list mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="list">
                    <div class="space-y-3">
                        ${displayProducts.map(product => {
                            const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                            const barcode = product.barcode || 'Barkod yok';
                            const image = product.image || '';
                            
                            return `
                                <div class="product-list-item bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300 flex items-center gap-4 p-3">
                                    <div class="product-list-image flex-shrink-0" style="width: 80px; height: 80px; overflow: hidden; border-radius: 8px; background: #f3f4f6;">
                                        ${image ? `
                                            <img src="${image}" 
                                                 alt="${productName}" 
                                                 class="w-full h-full object-cover"
                                                 onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs flex items-center justify-center h-full\\'>Görsel Yok</div>';"
                                                 loading="lazy">
                                        ` : `
                                            <div class="text-gray-400 text-xs flex items-center justify-center h-full">Görsel Yok</div>
                                        `}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="product-list-name font-medium text-sm text-gray-900 mb-1" style="word-wrap: break-word; overflow-wrap: break-word;">
                                            ${productName}
                                        </div>
                                        <div class="product-list-barcode text-xs text-gray-600 font-mono">
                                            ${barcode}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${remainingCount > 0 && !shouldShowAll ? `
                        <div class="mt-4 text-center">
                            <button onclick="
                                (function() {
                                    const container = document.getElementById('${uniqueId}');
                                    if (!container) return;
                                    const productsBase64 = container.getAttribute('data-products');
                                    if (!productsBase64) return;
                                    try {
                                        const products = JSON.parse(decodeURIComponent(atob(productsBase64)));
                                        const displayType = container.getAttribute('data-display-type') || 'list';
                                        if (window.updateNotificationSystem) {
                                            container.innerHTML = window.updateNotificationSystem.renderProductUpdate(products, true, displayType);
                                        }
                                    } catch(e) {
                                        console.error('Product update render error:', e);
                                    }
                                })();
                            " class="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer transition-colors px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 inline-block">
                                <span class="font-semibold">+${remainingCount} ürün daha</span> görmek için tıklayın
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Carousel Görünümü
        renderProductUpdateCarousel(products, showAll = false) {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            const uniqueId = 'product-update-carousel-' + Math.random().toString(36).substr(2, 9);
            const carouselId = 'carousel-' + uniqueId;
            const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
            const displayProducts = products;
            
            return `
                <div class="product-update-carousel mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="carousel">
                    <div class="relative">
                        <div id="${carouselId}" class="overflow-hidden rounded-lg">
                            <div class="flex transition-transform duration-500 ease-in-out" style="transform: translateX(0px);">
                                ${displayProducts.map((product, index) => {
                                    const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                                    const barcode = product.barcode || 'Barkod yok';
                                    const image = product.image || '';
                                    
                                    return `
                                        <div class="carousel-slide flex-shrink-0 w-full px-2">
                                            <div class="product-card bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col mx-auto" style="max-width: 300px;">
                                                <div class="product-card-image-container bg-gray-100 flex items-center justify-center flex-shrink-0" style="height: 200px; overflow: hidden;">
                                                    ${image ? `
                                                        <img src="${image}" 
                                                             alt="${productName}" 
                                                             class="product-card-image w-full h-full object-cover"
                                                             onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-sm\\'>Görsel Yok</div>';"
                                                             loading="lazy">
                                                    ` : `
                                                        <div class="text-gray-400 text-sm">Görsel Yok</div>
                                                    `}
                                                </div>
                                                <div class="p-4 flex-1 flex flex-col">
                                                    <div class="product-card-name font-medium text-base text-gray-900 mb-2 flex-1" style="word-wrap: break-word; overflow-wrap: break-word;">
                                                        ${productName}
                                                    </div>
                                                    <div class="product-card-barcode text-sm text-gray-600 font-mono mt-auto">
                                                        ${barcode}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        ${displayProducts.length > 1 ? `
                            <button onclick="
                                (function() {
                                    const carousel = document.getElementById('${carouselId}');
                                    const slides = carousel.querySelector('.flex');
                                    const currentTransform = slides.style.transform.match(/translateX\\((-?\\d+)px\\)/);
                                    const currentX = currentTransform ? parseInt(currentTransform[1]) : 0;
                                    const slideWidth = carousel.offsetWidth;
                                    const newX = Math.max(currentX - slideWidth, -(slideWidth * (${displayProducts.length} - 1)));
                                    slides.style.transform = 'translateX(' + newX + 'px)';
                                })();
                            " class="absolute left-0 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all z-10">
                                <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                </svg>
                            </button>
                            <button onclick="
                                (function() {
                                    const carousel = document.getElementById('${carouselId}');
                                    const slides = carousel.querySelector('.flex');
                                    const currentTransform = slides.style.transform.match(/translateX\\((-?\\d+)px\\)/);
                                    const currentX = currentTransform ? parseInt(currentTransform[1]) : 0;
                                    const slideWidth = carousel.offsetWidth;
                                    const newX = Math.min(currentX + slideWidth, 0);
                                    slides.style.transform = 'translateX(' + newX + 'px)';
                                })();
                            " class="absolute right-0 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all z-10">
                                <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                            <div class="flex justify-center mt-4 gap-2">
                                ${displayProducts.map((_, index) => `
                                    <button onclick="
                                        (function() {
                                            const carousel = document.getElementById('${carouselId}');
                                            const slides = carousel.querySelector('.flex');
                                            const slideWidth = carousel.offsetWidth;
                                            slides.style.transform = 'translateX(' + (-slideWidth * ${index}) + 'px)';
                                        })();
                                    " class="carousel-dot w-2 h-2 rounded-full bg-gray-300 hover:bg-gray-400 transition-all ${index === 0 ? 'bg-blue-500' : ''}"></button>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Orbit Görünümü (Apple Watch tarzı circular - interaktif mouse kontrolü)
        renderProductUpdateOrbit(products, showAll = false) {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            // Orbit modunda her zaman tüm ürünleri göster
            const displayProducts = products;
            const uniqueId = 'product-update-orbit-' + Math.random().toString(36).substr(2, 9);
            const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
            
            const centerX = 50;
            const centerY = 50;
            const radius = 35;
            const totalItems = displayProducts.length;
            const angleStep = totalItems > 0 ? (2 * Math.PI) / totalItems : 0;
            
            return `
                <div class="product-update-orbit mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="orbit" data-total-items="${totalItems}" data-angle-step="${angleStep}" data-radius="${radius}">
                    <div class="relative orbit-wrapper" style="min-height: 500px; padding: 40px; cursor: grab;">
                        <div class="orbit-container relative w-full h-full" style="position: relative;">
                            ${displayProducts.map((product, index) => {
                                const angle = index * angleStep - Math.PI / 2;
                                const x = centerX + radius * Math.cos(angle);
                                const y = centerY + radius * Math.sin(angle);
                                const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                                const barcode = product.barcode || 'Barkod yok';
                                const image = product.image || '';
                                
                                return `
                                    <div class="orbit-item absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-125 hover:z-30" 
                                         style="left: ${x}%; top: ${y}%; will-change: transform;">
                                        <div class="product-orbit-card bg-white border-2 border-gray-200 rounded-full overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer" 
                                             style="width: 100px; height: 100px; position: relative;">
                                            ${image ? `
                                                <img src="${image}" 
                                                     alt="${productName}" 
                                                     class="w-full h-full object-cover rounded-full"
                                                     onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs flex items-center justify-center h-full\\'>?</div>';"
                                                     loading="lazy">
                                            ` : `
                                                <div class="text-gray-400 text-xs flex items-center justify-center h-full rounded-full bg-gray-100">?</div>
                                            `}
                                            <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 rounded-full flex items-center justify-center">
                                                <div class="opacity-0 hover:opacity-100 transition-opacity duration-300 text-white text-xs font-medium text-center px-2" style="text-shadow: 0 2px 4px rgba(0,0,0,0.7);">
                                                    ${productName.length > 25 ? productName.substring(0, 25) + '...' : productName}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10">
                                <div class="bg-white rounded-full p-4 shadow-lg border-2 border-gray-200">
                                    <div class="text-2xl font-bold text-gray-800">${displayProducts.length}</div>
                                    <div class="text-xs text-gray-600">Ürün</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <script>
                        (function() {
                            const orbit = document.getElementById('${uniqueId}');
                            if (!orbit) return;
                            const wrapper = orbit.querySelector('.orbit-wrapper');
                            const items = orbit.querySelectorAll('.orbit-item');
                            const totalItems = parseInt(orbit.getAttribute('data-total-items'));
                            const angleStep = parseFloat(orbit.getAttribute('data-angle-step'));
                            const radius = parseFloat(orbit.getAttribute('data-radius'));
                            const centerX = 50;
                            const centerY = 50;
                            
                            let currentRotation = 0;
                            
                            // Mouse pozisyonuna göre otomatik dönme
                            wrapper.addEventListener('mousemove', function(e) {
                                const rect = wrapper.getBoundingClientRect();
                                const centerX_px = rect.left + rect.width / 2;
                                const centerY_px = rect.top + rect.height / 2;
                                
                                const mouseX = e.clientX - centerX_px;
                                const mouseY = e.clientY - centerY_px;
                                
                                // Mouse pozisyonuna göre açı hesapla
                                const angle = Math.atan2(mouseY, mouseX);
                                
                                // Orbit'i mouse pozisyonuna göre döndür (smooth)
                                const targetRotation = angle + Math.PI / 2;
                                const sensitivity = 0.3;
                                currentRotation += (targetRotation - currentRotation) * sensitivity;
                                
                                items.forEach((item, index) => {
                                    const baseAngle = index * angleStep - Math.PI / 2;
                                    const newAngle = baseAngle + currentRotation;
                                    const x = centerX + radius * Math.cos(newAngle);
                                    const y = centerY + radius * Math.sin(newAngle);
                                    item.style.left = x + '%';
                                    item.style.top = y + '%';
                                });
                            });
                            
                            // Mouse çıkınca başlangıç pozisyonuna dön
                            wrapper.addEventListener('mouseleave', function() {
                                const resetSpeed = 0.1;
                                const resetInterval = setInterval(() => {
                                    if (Math.abs(currentRotation) < 0.01) {
                                        currentRotation = 0;
                                        clearInterval(resetInterval);
                                    } else {
                                        currentRotation *= (1 - resetSpeed);
                                        items.forEach((item, index) => {
                                            const baseAngle = index * angleStep - Math.PI / 2;
                                            const newAngle = baseAngle + currentRotation;
                                            const x = centerX + radius * Math.cos(newAngle);
                                            const y = centerY + radius * Math.sin(newAngle);
                                            item.style.left = x + '%';
                                            item.style.top = y + '%';
                                        });
                                    }
                                }, 16);
                            });
                            
                            // Touch desteği (mobil için)
                            let touchStartAngle = 0;
                            let touchStartRotation = 0;
                            
                            wrapper.addEventListener('touchstart', function(e) {
                                const rect = wrapper.getBoundingClientRect();
                                const centerX_px = rect.left + rect.width / 2;
                                const centerY_px = rect.top + rect.height / 2;
                                
                                const touchX = e.touches[0].clientX - centerX_px;
                                const touchY = e.touches[0].clientY - centerY_px;
                                touchStartAngle = Math.atan2(touchY, touchX);
                                touchStartRotation = currentRotation;
                            });
                            
                            wrapper.addEventListener('touchmove', function(e) {
                                e.preventDefault();
                                const rect = wrapper.getBoundingClientRect();
                                const centerX_px = rect.left + rect.width / 2;
                                const centerY_px = rect.top + rect.height / 2;
                                
                                const touchX = e.touches[0].clientX - centerX_px;
                                const touchY = e.touches[0].clientY - centerY_px;
                                const currentAngle = Math.atan2(touchY, touchX);
                                
                                const deltaAngle = currentAngle - touchStartAngle;
                                currentRotation = touchStartRotation + deltaAngle;
                                
                                items.forEach((item, index) => {
                                    const baseAngle = index * angleStep - Math.PI / 2;
                                    const newAngle = baseAngle + currentRotation;
                                    const x = centerX + radius * Math.cos(newAngle);
                                    const y = centerY + radius * Math.sin(newAngle);
                                    item.style.left = x + '%';
                                    item.style.top = y + '%';
                                });
                            });
                        })();
                    </script>
                </div>
            `;
        }

        // Step Description Render (Product Update desteği ile)
        renderStepDescription(step) {
            // Product update JSON'unu kontrol et
            const productUpdateData = this.parseProductUpdateJSON(step.description);
            const hasProductUpdate = productUpdateData !== null;
            const productUpdateProducts = hasProductUpdate ? productUpdateData.products : null;
            const displayType = hasProductUpdate ? (productUpdateData.display_type || 'grid') : 'grid';
            
            // Description'dan JSON'u çıkar (eğer varsa)
            let displayDescription = step.description || '';
            if (hasProductUpdate) {
                // JSON'u description'dan çıkar, sadece diğer text'i göster
                try {
                    const jsonMatch = displayDescription.match(/\{[\s\S]*"type"\s*:\s*"product_update"[\s\S]*\}/);
                    if (jsonMatch) {
                        displayDescription = displayDescription.replace(jsonMatch[0], '').trim();
                    }
                } catch (e) {
                    // Hata durumunda tüm description'ı göster
                }
            }
            
            return `
                ${displayDescription ? `<p class="text-gray-700 text-lg leading-relaxed whitespace-pre-line mb-4">${displayDescription}</p>` : ''}
                ${hasProductUpdate ? this.renderProductUpdate(productUpdateProducts, false, displayType) : ''}
            `;
        }

        async showUpdateModal(update) {
            if (this.isModalOpen) return;

            this.currentUpdate = update;
            this.currentStepIndex = 0;
            this.isModalOpen = true;

            // Prevent body scroll
            document.body.style.overflow = 'hidden';

            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.id = 'updateModalOverlay';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4';
            overlay.style.backdropFilter = 'blur(4px)';

            // Create modal content
            const modal = document.createElement('div');
            modal.className = 'bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col';
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.innerHTML = this.renderModalContent();

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Add event listeners
            this.attachModalListeners(overlay);
        }

        renderModalContent() {
            if (!this.currentUpdate || !this.currentUpdate.steps) {
                return '<div class="p-6">Güncelleme yükleniyor...</div>';
            }

            const steps = this.currentUpdate.steps;
            const currentStep = steps[this.currentStepIndex];
            const totalSteps = steps.length;
            const progress = ((this.currentStepIndex + 1) / totalSteps) * 100;

            // Get color class for current step
            const colorClasses = {
                purple: 'from-purple-500 to-purple-600',
                pink: 'from-pink-500 to-pink-600',
                blue: 'from-blue-500 to-blue-600',
                green: 'from-green-500 to-green-600',
                orange: 'from-orange-500 to-orange-600',
                red: 'from-red-500 to-red-600',
                indigo: 'from-indigo-500 to-indigo-600',
                teal: 'from-teal-500 to-teal-600'
            };

            // Use green gradient for update notifications (instead of step color)
            const stepColor = 'from-green-500 to-emerald-600';

            return `
                <div class="flex flex-col h-full min-h-0">
                    <!-- Header -->
                    <div class="bg-gradient-to-r ${stepColor} text-white py-3 px-4 flex-shrink-0">
                        <div class="flex items-center justify-between mb-2">
                            <div>
                                <h2 class="text-xl font-bold">${this.currentUpdate.title}</h2>
                                ${this.currentUpdate.description ? `<p class="text-white opacity-90 mt-0.5 text-sm">${this.currentUpdate.description}</p>` : ''}
                            </div>
                            <button id="closeUpdateModal" class="text-white hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-white hover:bg-opacity-20">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                        <!-- Progress Bar -->
                        <div class="w-full bg-white bg-opacity-30 rounded-full h-1.5">
                            <div class="bg-white rounded-full h-1.5 transition-all duration-300" style="width: ${progress}%"></div>
                        </div>
                        <div class="text-xs text-white opacity-90 mt-1">
                            Adım ${this.currentStepIndex + 1} / ${totalSteps}
                        </div>
                    </div>

                    <!-- Step Content -->
                    <div class="flex-1 overflow-y-auto p-6 min-h-0">
                        <div class="flex items-start space-x-4 mb-6">
                            <div class="text-5xl">${currentStep.icon || '🚀'}</div>
                            <div class="flex-1">
                                <h3 class="text-2xl font-bold text-gray-900 mb-3">${currentStep.title}</h3>
                                ${this.renderStepDescription(currentStep)}
                            </div>
                        </div>
                        
                        ${currentStep.image_url ? this.renderMediaContent(currentStep) : ''}
                    </div>

                    <!-- Footer Navigation -->
                    <div class="border-t border-gray-200 py-3 px-4 bg-gray-50 flex-shrink-0">
                        <!-- Step Dots Indicator -->
                        <div class="flex items-center justify-center space-x-2 mb-3">
                            ${steps.map((_, index) => `
                                <div class="w-2.5 h-2.5 rounded-full transition-all ${
                                    index === this.currentStepIndex 
                                        ? 'bg-green-600 scale-125' 
                                        : index < this.currentStepIndex 
                                            ? 'bg-green-400' 
                                            : 'bg-gray-300'
                                }"></div>
                            `).join('')}
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <button id="prevStepBtn" 
                                    class="flex items-center space-x-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-400 transition-colors ${this.currentStepIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                                    ${this.currentStepIndex === 0 ? 'disabled' : ''}>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                </svg>
                                <span>Geri</span>
                            </button>
                            
                            ${this.currentStepIndex === totalSteps - 1 ? `
                                <button id="completeUpdateBtn" 
                                        class="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">
                                    ✅ Tamam
                                </button>
                            ` : `
                                <button id="nextStepBtn" 
                                        class="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-emerald-700 transition-all">
                                    <span>İleri</span>
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                    </svg>
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }

        isGoogleDriveUrl(url) {
            if (!url) return false;
            return url.includes('drive.google.com');
        }

        extractGoogleDriveFileId(url) {
            if (!url) return null;
            
            const patterns = [
                /\/file\/d\/([a-zA-Z0-9_-]+)/,
                /[?&]id=([a-zA-Z0-9_-]+)/,
                /\/uc\?id=([a-zA-Z0-9_-]+)/
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            
            return null;
        }

        convertGoogleDriveUrl(url, isVideo = false) {
            if (!this.isGoogleDriveUrl(url)) {
                return url;
            }

            const fileId = this.extractGoogleDriveFileId(url);
            if (!fileId) {
                console.warn('⚠️ Could not extract Google Drive file ID from:', url);
                return url;
            }

            if (isVideo) {
                // Google Drive video için alternatif linkler dene
                // Önce view linki, sonra download linki
                return `https://drive.google.com/uc?export=view&id=${fileId}`;
            } else {
                return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
            }
        }

        isCloudinaryUrl(url) {
            if (!url) return false;
            return url.includes('res.cloudinary.com');
        }

        renderMediaContent(step) {
            if (!step.image_url) return '';
            
            const originalUrl = step.image_url;
            const url = originalUrl.toLowerCase();
            const isDriveUrl = this.isGoogleDriveUrl(originalUrl);
            const isCloudinaryUrl = this.isCloudinaryUrl(originalUrl);
            
            // isVideo: önce step.is_video flag'i, sonra URL kontrolü
            let isVideo = step.is_video === true || step.is_video === 'true';
            
            if (!isVideo && !isDriveUrl && !isCloudinaryUrl) {
                // Drive ve Cloudinary dışı URL'ler için uzantı kontrolü
                isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg') || 
                          url.endsWith('.mov') || url.endsWith('.avi') || url.endsWith('.mkv') ||
                          url.endsWith('.flv') || url.endsWith('.wmv') || url.includes('video') ||
                          url.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i);
            }
            
            // Cloudinary URL'lerini kontrol et
            if (isCloudinaryUrl && !isVideo) {
                isVideo = originalUrl.includes('/video/upload/');
            }
            
            // Google Drive ve Cloudinary URL'lerini dönüştür
            let videoUrl = originalUrl;
            let imageUrl = originalUrl;
            let fileId = '';
            
            if (isDriveUrl) {
                fileId = this.extractGoogleDriveFileId(originalUrl);
                if (fileId) {
                    if (isVideo) {
                        videoUrl = `/api/gdrive/video?fileId=${encodeURIComponent(fileId)}`;
                    }
                    imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
                }
            } else if (isCloudinaryUrl && isVideo) {
                // Cloudinary video - orijinal URL'i kullan
                // Loop HTML5 video tag'inde yapılacak, transform gerekmez
                videoUrl = originalUrl;
                // Poster için - video URL'ini kullan (tarayıcı otomatik poster oluşturur)
                imageUrl = videoUrl;
            } else if (isCloudinaryUrl && !isVideo) {
                // Cloudinary görsel - yüksek kalite
                if (!originalUrl.includes('w_1000')) {
                    imageUrl = originalUrl.replace('/image/upload/', '/image/upload/w_1000,q_auto/');
                } else {
                    imageUrl = originalUrl;
                }
            }
            
            if (isVideo) {
                // Safe Player: Video + Image Fallback
                const uniqueId = fileId || Math.random().toString(36).substr(2, 9);
                return `
                    <div class="mt-6" id="update-media-${uniqueId}">
                        <video 
                            id="update-video-${uniqueId}"
                            src="${videoUrl}" 
                            poster="${imageUrl}"
                            class="w-full rounded-lg"
                            style="filter: none; opacity: 1; background: transparent; object-fit: contain; pointer-events: none; width: 100%; border-radius: 8px;"
                            autoplay
                            loop
                            muted
                            playsinline
                            preload="auto"
                            disablePictureInPicture
                            controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                            oncontextmenu="return false;"
                            onended="this.currentTime=0;this.play()"
                            onerror="this.style.display='none';const img=this.nextElementSibling;if(img){img.style.display='block';}">
                            Tarayıcınız video oynatmayı desteklemiyor.
                        </video>
                        <img 
                            id="update-fallback-${uniqueId}"
                            src="${imageUrl}" 
                            alt="${step.title || 'Görsel'}" 
                            class="w-full rounded-lg"
                            style="display: none; width: 100%; border-radius: 8px;"
                            onerror="this.onerror=null;this.src='${originalUrl}';">
                        <script>
                            (function() {
                                const video = document.getElementById('update-video-${uniqueId}');
                                if (video) {
                                    // Loop için event listener
                                    video.addEventListener('ended', function() {
                                        this.currentTime = 0;
                                        this.play().catch(() => {});
                                    });
                                    // Kontrolleri tamamen kaldır
                                    video.controls = false;
                                    video.removeAttribute('controls');
                                    // Force autoplay
                                    video.play().catch(() => {});
                                }
                            })();
                        </script>
                    </div>
                `;
            } else {
                return `
                    <div class="mt-6">
                        <img src="${imageUrl}" alt="${step.title || 'Görsel'}" 
                             class="w-full rounded-lg"
                             onerror="this.onerror=null; this.src='${originalUrl}';">
                    </div>
                `;
            }
        }

        attachModalListeners(overlay) {
            // Force autoplay for all videos after render
            setTimeout(() => {
                const videos = overlay.querySelectorAll('video');
                videos.forEach(video => {
                    video.play().catch(() => {});
                });
            }, 300);
            
            const closeBtn = overlay.querySelector('#closeUpdateModal');
            const prevBtn = overlay.querySelector('#prevStepBtn');
            const nextBtn = overlay.querySelector('#nextStepBtn');
            const completeBtn = overlay.querySelector('#completeUpdateBtn');

            if (closeBtn) {
                closeBtn.addEventListener('click', async () => {
                    // Close modal but don't mark as completed
                    overlay.remove();
                    document.body.style.overflow = '';
                    this.isModalOpen = false;
                    
                    // Show minimal badge again if update is not completed
                    if (this.currentUpdate) {
                        const session = window.authUtils?.checkAuth();
                        if (session && session.username) {
                            const { data: userStatus } = await window.supabase
                                .from('user_update_status')
                                .select('is_completed, is_seen')
                                .eq('username', session.username)
                                .eq('update_number', this.currentUpdate.update_number)
                                .single();
                            
                            if (userStatus && !userStatus.is_completed) {
                                // Show minimal badge if seen but not completed
                                this.showNotificationBadge(this.currentUpdate, userStatus.is_seen || false);
                            }
                        }
                    }
                });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (this.currentStepIndex > 0) {
                        this.currentStepIndex--;
                        overlay.querySelector('.bg-white').innerHTML = this.renderModalContent();
                        this.attachModalListeners(overlay);
                    }
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    if (this.currentStepIndex < this.currentUpdate.steps.length - 1) {
                        this.currentStepIndex++;
                        overlay.querySelector('.bg-white').innerHTML = this.renderModalContent();
                        this.attachModalListeners(overlay);
                    }
                });
            }

            if (completeBtn) {
                completeBtn.addEventListener('click', () => {
                    this.completeUpdate();
                });
            }

            // Prevent closing by clicking outside (user must complete)
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    // Don't allow closing - user must complete
                    return;
                }
            });
        }

        async completeUpdate() {
            try {
                if (!window.supabase) {
                    alert('Supabase bağlantısı yok!');
                    return;
                }

                const session = window.authUtils?.checkAuth();
                if (!session || !session.username) {
                    alert('Oturum bulunamadı!');
                    return;
                }

                // Update user_update_status
                const { data: existing } = await window.supabase
                    .from('user_update_status')
                    .select('id')
                    .eq('username', session.username)
                    .eq('update_number', this.currentUpdate.update_number)
                    .single();

                if (existing) {
                    await window.supabase
                        .from('user_update_status')
                        .update({
                            is_completed: true,
                            completed_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                } else {
                    await window.supabase
                        .from('user_update_status')
                        .insert({
                            username: session.username,
                            update_number: this.currentUpdate.update_number,
                            is_seen: true,
                            seen_at: new Date().toISOString(),
                            is_completed: true,
                            completed_at: new Date().toISOString()
                        });
                }

                // Close modal
                const overlay = document.getElementById('updateModalOverlay');
                if (overlay) {
                    overlay.remove();
                }

                document.body.style.overflow = '';
                this.isModalOpen = false;

                // Remove badge completely after completion
                const badge = document.getElementById('updateNotificationBadge');
                if (badge) {
                    badge.remove();
                }

                // Eğer başka tamamlanmamış güncelleme varsa, onu göster (eskiden yeniye doğru)
                // Böylece kullanıcı 10 güncelleme boyunca tıklamasa bile, hepsini sırayla görebilir
                setTimeout(async () => {
                    console.log('🔄 Checking for next uncompleted update after completion...');
                    await this.checkForUpdates();
                }, 500); // Kısa bir delay ile bir sonraki güncellemeyi kontrol et

                // Apply feature changes for this update if any
                if (window.featureManager && this.currentUpdate.feature_changes && this.currentUpdate.feature_changes.length > 0) {
                    console.log('🔧 Applying feature changes for completed update:', this.currentUpdate.update_number);
                    // Always use "system" for update-triggered changes (admin created the update, system applies it)
                    const changedBy = 'system';
                    
                    for (const change of this.currentUpdate.feature_changes) {
                        if (!change.feature_key || change.new_value === undefined) {
                            console.warn('Invalid feature change:', change);
                            continue;
                        }
                        
                        try {
                            await window.featureManager.setFeatureValue(
                                change.feature_key,
                                change.new_value,
                                this.currentUpdate.update_number,
                                changedBy
                            );
                            console.log(`✅ Feature ${change.feature_key} set to ${change.new_value}`);
                        } catch (error) {
                            console.error(`❌ Error applying feature change for ${change.feature_key}:`, error);
                        }
                    }
                    
                    // Clear cache and reload features to ensure UI gets updated values
                    window.featureManager.featuresCache = null;
                    await window.featureManager.loadAllFeatures();
                    
                    // Trigger UI update for all changed features
                    console.log('🔄 Feature changes applied, updating UI...');
                    // Wait a bit for feature manager to update, then trigger UI update
                    setTimeout(async () => {
                        // Update UI for anti-glare mode if it was changed
                        const antiGlareChanged = this.currentUpdate.feature_changes.some(
                            change => change.feature_key === 'anti_glare_mode'
                        );
                        
                        if (antiGlareChanged) {
                            console.log('🔄 Anti-glare feature changed, updating UI...');
                            
                            // Update UI directly first
                            if (typeof window.updateAntiGlareSettingsUI === 'function') {
                                await window.updateAntiGlareSettingsUI();
                            }
                            if (typeof window.loadAntiGlareSetting === 'function') {
                                await window.loadAntiGlareSetting();
                            }
                        }
                        
                        // Trigger feature change callbacks for all changed features
                        if (window.featureManager && window.featureManager.triggerFeatureChangeCallbacks) {
                            for (const change of this.currentUpdate.feature_changes) {
                                try {
                                    // Trigger callback with new value (old value is not critical here)
                                    await window.featureManager.triggerFeatureChangeCallbacks(change.feature_key, null, change.new_value);
                                } catch (error) {
                                    console.error('Error triggering feature change callback:', error);
                                }
                            }
                        }
                    }, 500);
                }
                
                // Check for more updates
                await this.checkForUpdates();
            } catch (error) {
                console.error('Error completing update:', error);
                alert('Güncelleme tamamlanırken hata oluştu: ' + error.message);
            }
        }
    }

    // Initialize immediately when script loads (don't wait for DOMContentLoaded)
    // This ensures faster initialization
    window.updateNotificationSystem = new UpdateNotificationSystem();
    
    // Start initialization immediately
    window.updateNotificationSystem.init().catch(error => {
        console.error('❌ Error initializing update notification system:', error);
    });
})();

