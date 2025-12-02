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
                                <p class="text-gray-700 text-lg leading-relaxed whitespace-pre-line">${currentStep.description}</p>
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

