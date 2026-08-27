// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.currentTab = 'users';
        this.users = [];
        this.messages = [];
        this.logs = [];
        this.currentMessageFilter = 'all';
        this.ipTrackingData = [];
        this.blockedIPsData = [];
        this.ipAnalysis = null;
        this.currentIPDetailsSortDirection = 'asc';
        this.currentIPDetailsSortColumn = null;
        this.currentIPTrackingSortDirection = 'asc';
        this.currentIPTrackingSortColumn = null;
        this.selectedChatUser = null;
        this.chatMessages = [];
        this.chatSubscription = null;
        this.updates = [];
        this.currentUpdateSteps = [];
        this.editingUpdateId = null;
        this.adminSettings = null;
    }

    async init() {
        // Check if user is admin
        const session = window.authUtils.checkAuth();
        if (!session || !session.isAdmin) {
            alert('Bu sayfaya erişim yetkiniz yok!');
            // Use replace() to prevent Safari UI from showing during navigation in standalone mode
            window.location.replace('index.html');
            return;
        }

        // Update admin user info
        const adminUserEl = document.getElementById('adminUser');
        if (adminUserEl) adminUserEl.textContent = session.username;

        this._initAdminShellUI();

        // Add logout functionality
        const logoutHandler = () => {
            if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                window.authUtils.logout();
            }
        };
        document.getElementById('logoutBtn')?.addEventListener('click', logoutHandler);
        document.getElementById('logoutBtnMobile')?.addEventListener('click', logoutHandler);

        // Initialize tabs
        this.initTabs();

        // Load admin settings once on init (tab switch refreshes again)
        await this.loadAdminSettings();

        // Setup realtime chat updates
        this.setupChatRealtime();

        // Load initial data
        await this.loadUsers();
        await this.loadMessages();
        await this.loadIPTracking();

        // Update stats
        this.updateStats();
    }

    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const tabName = button.dataset.tab;
                await this.switchTab(tabName);
            });
        });

        // Add user modal
        document.getElementById('addUserBtn').addEventListener('click', () => {
            document.getElementById('addUserModal').classList.remove('hidden');
        });

        document.getElementById('closeAddUserModal').addEventListener('click', () => {
            document.getElementById('addUserModal').classList.add('hidden');
        });

        document.getElementById('cancelAddUser').addEventListener('click', () => {
            document.getElementById('addUserModal').classList.add('hidden');
        });

        // Add user form
        document.getElementById('addUserForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addUser();
        });

        // Product Import Tab Event Listeners
        this.initProductImportTab();

        // Extend Trial Modal
        document.getElementById('closeExtendTrialModal').addEventListener('click', () => {
            document.getElementById('extendTrialModal').classList.add('hidden');
        });

        document.getElementById('cancelExtendTrial').addEventListener('click', () => {
            document.getElementById('extendTrialModal').classList.add('hidden');
        });

        document.getElementById('confirmExtendTrial').addEventListener('click', () => {
            this.confirmExtendTrial();
        });

        // Quick duration buttons
        document.querySelectorAll('.quick-duration-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setQuickDuration(btn);
            });
        });

        // Edit User Modal
        document.getElementById('closeEditUserModal').addEventListener('click', () => {
            document.getElementById('editUserModal').classList.add('hidden');
        });

        document.getElementById('cancelEditUser').addEventListener('click', () => {
            document.getElementById('editUserModal').classList.add('hidden');
        });

        document.getElementById('editUserForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateUser();
        });

        document.getElementById('refreshUserPage').addEventListener('click', () => {
            this.refreshUserPage();
        });

        // Toggle password visibility
        document.getElementById('toggleEditPassword').addEventListener('click', () => {
            this.togglePasswordVisibility('editPassword', 'toggleEditPassword');
        });

        // Message filter buttons
        document.getElementById('filterAllMessages').addEventListener('click', () => {
            this.filterMessages('all');
        });

        document.getElementById('filterPendingMessages').addEventListener('click', () => {
            this.filterMessages('pending');
        });

        document.getElementById('filterApprovedMessages').addEventListener('click', () => {
            this.filterMessages('approved');
        });

        document.getElementById('filterRejectedMessages').addEventListener('click', () => {
            this.filterMessages('rejected');
        });

        // IP Analysis filter buttons
        document.getElementById('filterAllIPs').addEventListener('click', () => {
            this.filterIPs('all');
        });

        document.getElementById('filterTodayIPs').addEventListener('click', () => {
            this.filterIPs('today');
        });

        document.getElementById('filterWeekIPs').addEventListener('click', () => {
            this.filterIPs('week');
        });

        document.getElementById('filterMonthIPs').addEventListener('click', () => {
            this.filterIPs('month');
        });

        // IP Analysis sort
        document.getElementById('ipSortBy').addEventListener('change', (e) => {
            this.sortIPs(e.target.value);
        });

        // IP Search
        document.getElementById('ipSearchInput').addEventListener('input', (e) => {
            this.searchIPs(e.target.value);
        });

        // Test data button (Export IP Data button)
        document.getElementById('exportIPData').addEventListener('click', () => {
            this.addTestIPData();
        });

        // Debug button for testing
        document.getElementById('refreshIPTrackingBtn').addEventListener('click', () => {
            console.log('🔍 Debug: Current IP tracking data:', this.ipTrackingData);
            console.log('🔍 Debug: Current IP analysis:', this.ipAnalysis);
            console.log('🔍 Debug: Supabase status:', !!window.jbDb);
            this.testDbConnection();
            this.loadIPTracking();
        });

        // Refresh blocked IPs button
        document.getElementById('refreshBlockedIPsBtn')?.addEventListener('click', async () => {
            await this.loadBlockedIPs();
        });

        // Chat event listeners
        document.getElementById('refreshChat').addEventListener('click', () => this.loadChatUsers());
        document.getElementById('clearChatBtn').addEventListener('click', () => this.clearChat());
        document.getElementById('chatBackBtn')?.addEventListener('click', () => this.backChatToList());
        document.getElementById('sendAdminMessage').addEventListener('click', () => this.sendAdminMessage());
        document.getElementById('adminMessageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendAdminMessage();
        });
        
        // Setup message shortcuts system
        this.setupMessageShortcuts();
        
        // New Chat Modal event listeners
        document.getElementById('newChatBtn').addEventListener('click', () => this.openNewChatModal());
        document.getElementById('closeNewChatModal').addEventListener('click', () => this.closeNewChatModal());
        document.getElementById('cancelNewChatBtn').addEventListener('click', () => this.closeNewChatModal());
        document.getElementById('newChatSearchInput').addEventListener('input', (e) => this.filterNewChatUsers(e.target.value));

        // Premium Features Modal
        document.getElementById('closePremiumFeaturesModal')?.addEventListener('click', () => {
            document.getElementById('premiumFeaturesModal').classList.add('hidden');
        });

        document.getElementById('cancelPremiumFeatures')?.addEventListener('click', () => {
            document.getElementById('premiumFeaturesModal').classList.add('hidden');
        });

        document.getElementById('savePremiumFeatures')?.addEventListener('click', () => {
            this.savePremiumFeatures();
        });

        // Updates Management
        document.getElementById('createUpdateBtn')?.addEventListener('click', () => {
            this.openUpdateModal();
        });

        document.getElementById('closeUpdateModal')?.addEventListener('click', () => {
            document.getElementById('updateModal').classList.add('hidden');
        });

        document.getElementById('cancelUpdateBtn')?.addEventListener('click', () => {
            document.getElementById('updateModal').classList.add('hidden');
        });

        document.getElementById('addStepBtn')?.addEventListener('click', () => {
            this.addStep();
        });

        document.getElementById('addFeatureChangeBtn')?.addEventListener('click', () => {
            this.addFeatureChange();
        });

        document.getElementById('updateForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUpdate();
        });

        document.getElementById('previewUpdateBtn')?.addEventListener('click', () => {
            this.previewUpdate();
        });

        document.getElementById('closePreviewModal')?.addEventListener('click', () => {
            document.getElementById('previewModal').classList.add('hidden');
        });

        document.getElementById('refreshUpdatesBtn')?.addEventListener('click', () => {
            this.loadUpdates();
        });

        document.getElementById('updateFilter')?.addEventListener('change', (e) => {
            this.filterUpdates(e.target.value);
        });

        // Gemini AI Modal
        document.getElementById('openGeminiModalBtn')?.addEventListener('click', () => {
            this.openGeminiModal();
        });

        document.getElementById('closeGeminiModal')?.addEventListener('click', () => {
            this.closeGeminiModal();
        });

        document.getElementById('cancelGeminiBtn')?.addEventListener('click', () => {
            this.closeGeminiModal();
        });

        document.getElementById('generateGeminiBtn')?.addEventListener('click', () => {
            this.generateWithGemini();
        });

        document.getElementById('saveAdminSettingsBtn')?.addEventListener('click', () => {
            this.saveAdminSettings();
        });
        document.getElementById('sendTelegramTestBtn')?.addEventListener('click', () => {
            this.sendTelegramTestMessage();
        });
        document.querySelectorAll('[data-toggle-password]')?.forEach(toggleBtn => {
            toggleBtn.addEventListener('click', () => {
                const targetId = toggleBtn.getAttribute('data-toggle-password');
                const input = document.getElementById(targetId);
                if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                    toggleBtn.textContent = input.type === 'password' ? 'Göster' : 'Gizle';
                }
            });
        });
    }

    _userActionIcons() {
        return {
            edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
            extend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
            premium: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.8 6.7 18.1l1-5.8-4.2-4.1 5.9-.9L12 3z"/></svg>',
            toggleOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="3"/><path d="M22 11l-4 4"/><path d="M18 11l4 4"/></svg>',
            toggleOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="3"/><path d="M22 11h-4"/><path d="M18 11h4"/></svg>',
            delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        };
    }

    _initAdminShellUI() {
        const sidebar = document.getElementById('admSidebar');
        const overlay = document.getElementById('admSidebarOverlay');
        const menuBtn = document.getElementById('admMenuBtn');

        const closeNav = () => {
            sidebar?.classList.remove('is-open');
            overlay?.classList.remove('is-visible');
            document.body.classList.remove('adm-nav-open');
            menuBtn?.setAttribute('aria-expanded', 'false');
        };

        const openNav = () => {
            sidebar?.classList.add('is-open');
            overlay?.classList.add('is-visible');
            document.body.classList.add('adm-nav-open');
            menuBtn?.setAttribute('aria-expanded', 'true');
        };

        menuBtn?.addEventListener('click', () => {
            if (sidebar?.classList.contains('is-open')) closeNav();
            else openNav();
        });

        overlay?.addEventListener('click', closeNav);

        document.querySelectorAll('.tab-button').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (window.matchMedia('(max-width: 1023px)').matches) closeNav();
            });
        });

        window.addEventListener('resize', () => {
            if (window.matchMedia('(min-width: 1024px)').matches) closeNav();
        });
    }

    async switchTab(tabName) {
        document.querySelectorAll('.tab-button').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        document.getElementById(`${tabName}-tab`).classList.remove('hidden');

        const titles = {
            users: 'Kullanıcılar',
            messages: 'Mesajlar',
            chat: 'Sohbet',
            ipAnalysis: 'IP Analizi',
            updates: 'Güncellemeler',
            config: 'Config',
            'product-import': 'Ürün İçe Aktarma',
            settings: 'Ayarlar',
        };
        const topTitle = document.querySelector('.adm-topbar-title');
        if (topTitle) topTitle.textContent = titles[tabName] || 'Admin Panel';

        this.currentTab = tabName;
        
        // Load data when switching to specific tabs
        if (tabName === 'ipAnalysis') {
            await this.loadIPAnalysis();
            await this.loadIPTracking();
            await this.loadBlockedIPs();
        } else if (tabName === 'chat') {
            await this.loadChatUsers();
        } else if (tabName === 'updates') {
            await this.loadUpdates();
        } else if (tabName === 'config') {
            await this.loadConfigTab();
        } else if (tabName === 'product-import') {
            await this.loadProductImportTab();
        } else if (tabName === 'settings') {
            await this.loadAdminSettings();
        }
    }

    async loadUsers() {
        try {
            // Try Supabase first
            if (window.jbDb) {
                const { data, error } = await window.jbDb
                    .from('users')
                    // password/password_hash BİLEREK yok: parolalar artık kimseye okunmuyor
                    .select('id, username, company, contact_email, trial_end, is_active, is_admin, premium_features, created_at, updated_at, chat_messages, last_chat_update, max_ip_count, ip_tracking_enabled')
                    .order('created_at', { ascending: false });
                
                if (!error && data) {
                    this.users = data;
                    this.renderUsers();
                    return;
                }
            }

            // Fallback: Create default admin user if no data
            if (this.users.length === 0) {
                this.users = [{
                    username: 'admin.test',
                    company: 'Admin Panel',
                    trial_end: '2025-12-31T23:59:59Z',
                    is_active: true,
                    allowed_ips: ['*'],
                    is_admin: true,
                    created_at: new Date().toISOString()
                }];
                
                // Save to localStorage for persistence
                const localUsers = {
                    'admin.test': {
                        password: 'admin123',
                        company: 'Admin Panel',
                        trialEnd: '2025-12-31',
                        allowedIPs: ['*'],
                        isActive: true,
                        isAdmin: true
                    }
                };
                localStorage.setItem('LOCAL_USERS', JSON.stringify(localUsers));
            }

            this.renderUsers();
            this.updateStats();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    renderUsers() {
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = '';
        const icons = this._userActionIcons();

        this.users.forEach(user => {
            const row = document.createElement('tr');
            const safeUser = String(user.username).replace(/'/g, "\\'");
            const toggleIcon = user.is_active ? icons.toggleOn : icons.toggleOff;
            const toggleLabel = user.is_active ? 'Deaktif et' : 'Aktif et';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap" data-label="Kullanıcı">
                    <div class="adm-user-cell-name text-sm font-medium text-gray-900">${user.username}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap" data-label="Şirket">
                    <div class="text-sm text-gray-500">${user.company || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap" data-label="Test Süresi">
                    <div class="text-sm text-gray-500">${user.trial_end ? new Date(user.trial_end).toLocaleString('tr-TR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap" data-label="Durum">
                    <span class="text-sm font-medium ${this.getTrialStatusClass(user.trial_end)}">${this.getTrialStatusText(user.trial_end)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" data-label="İşlemler">
                    <div class="adm-action-bar">
                        <button type="button" onclick="adminPanel.editUser('${safeUser}')" class="adm-action-btn adm-action-edit" title="Düzenle" aria-label="Düzenle">${icons.edit}</button>
                        <button type="button" onclick="adminPanel.extendTrial('${safeUser}')" class="adm-action-btn adm-action-extend" title="Uzat" aria-label="Uzat">${icons.extend}</button>
                        <button type="button" onclick="adminPanel.managePremiumFeatures('${safeUser}')" class="adm-action-btn adm-action-premium" title="Premium" aria-label="Premium">${icons.premium}</button>
                        <button type="button" onclick="adminPanel.toggleUser('${safeUser}')" class="adm-action-btn adm-action-toggle" title="${toggleLabel}" aria-label="${toggleLabel}">${toggleIcon}</button>
                        <button type="button" onclick="adminPanel.deleteUser('${safeUser}')" class="adm-action-btn adm-action-delete" title="Sil" aria-label="Sil">${icons.delete}</button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    getTrialDaysLeft(trialEnd) {
        if (!trialEnd) return null;
        
        const now = new Date();
        const end = new Date(trialEnd);
        const diffTime = end - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays);
    }

    async addUser() {
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;
        const company = document.getElementById('newCompany').value;
        const email = document.getElementById('newEmail').value;
        const trialDays = parseInt(document.getElementById('newTrialDays').value);
        const trialEndInput = document.getElementById('newTrialEnd').value;
        const maxIPCount = parseInt(document.getElementById('newMaxIPCount').value) || 5;
        const ipTrackingEnabled = document.getElementById('newIPTrackingEnabled').checked;

        try {
            let trialEnd;
            
            // Use datetime-local input if provided, otherwise use trial days
            if (trialEndInput) {
                // datetime-local input yerel saat formatında gelir, direkt kullan
                trialEnd = new Date(trialEndInput);
            } else {
                trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + trialDays);
            }

            // password BURADA YOK: düz metin parola veritabanına yazılmıyor.
            // Kullanıcı oluşturulduktan sonra API üzerinden bcrypt'lenip
            // password_hash'e konuyor (aşağıda).
            const newUser = {
                username: username,
                company: company,
                contact_email: email,
                trial_end: trialEnd.toISOString(),
                max_ip_count: maxIPCount,
                ip_tracking_enabled: ipTrackingEnabled,
                is_active: true,
                created_at: new Date().toISOString()
            };

            // Try Supabase first
            if (window.jbDb) {
                const { error } = await window.jbDb
                    .from('users')
                    .insert([newUser]);
                
                if (error) throw error;

                // Parolayı API üzerinden bcrypt'le. Düz metin hiçbir zaman
                // veritabanına yazılmıyor.
                const pwRes = await window.jetbarkodAuth.apiFetch('/api/admin/users/password', {
                    method: 'POST',
                    body: JSON.stringify({ username, password })
                });
                if (!pwRes.ok) {
                    const d = await pwRes.json().catch(() => ({}));
                    throw new Error(
                        d.error === 'password_too_short'
                            ? 'Şifre en az 6 karakter olmalı.'
                            : 'Kullanıcı oluşturuldu ama şifre kaydedilemedi. Düzenle ekranından şifre belirleyin.'
                    );
                }

                const { error: userDataError } = await window.jbDb.from('user_data').insert({
                    username,
                    custom_products: [],
                    settings: {
                        showDuplicates: false,
                        theme: 'light',
                        searchHistory: [],
                        showDefaultProducts: true,
                    },
                });
                if (userDataError && !String(userDataError.message || '').includes('duplicate')) {
                    throw userDataError;
                }
            } else {
                // Fallback: Save to localStorage for demo
                const localUsers = JSON.parse(localStorage.getItem('LOCAL_USERS') || '{}');
                localUsers[username] = {
                    company: company,
                    trialEnd: trialEnd.toISOString(),
                    allowedIPs: ips.length > 0 ? ips : ['*'],
                    isActive: true
                };
                localStorage.setItem('LOCAL_USERS', JSON.stringify(localUsers));
            }

            this.users.unshift(newUser);
            this.renderUsers();
            this.updateStats();

            // Close modal and reset form
            document.getElementById('addUserModal').classList.add('hidden');
            document.getElementById('addUserForm').reset();

            alert('Kullanıcı başarıyla oluşturuldu!');
        } catch (error) {
            console.error('Error adding user:', error);
            alert('Kullanıcı oluşturulurken hata oluştu: ' + error.message);
        }
    }

    extendTrial(username) {
        const user = this.users.find(u => u.username === username);
        if (!user) return;

        // Store current username for modal
        this.currentExtendUser = username;

        const currentEnd = user.trial_end ? new Date(user.trial_end) : new Date();
        
        // Mevcut tarihi yerel saat olarak göster (datetime-local input için)
        const localTime = new Date(currentEnd.getTime() - (currentEnd.getTimezoneOffset() * 60000));
        const currentEndString = localTime.toISOString().slice(0, 16);

        // Update modal content
        document.getElementById('extendTrialUsername').textContent = username;
        document.getElementById('extendTrialCurrentEnd').textContent = currentEnd.toLocaleString('tr-TR');
        document.getElementById('extendTrialNewEnd').value = currentEndString;

        // Show modal
        document.getElementById('extendTrialModal').classList.remove('hidden');
    }

    setQuickDuration(button) {
        const username = this.currentExtendUser;
        if (!username) return;

        const user = this.users.find(u => u.username === username);
        if (!user) return;

        // Mevcut bitiş tarihini al
        const currentEnd = user.trial_end ? new Date(user.trial_end) : new Date();
        const newEnd = new Date(currentEnd);

        // Get duration from button data attributes
        const hours = button.dataset.hours;
        const days = button.dataset.days;

        if (hours) {
            // Mevcut bitiş tarihine saat ekle (millisecond cinsinden)
            newEnd.setTime(newEnd.getTime() + (parseInt(hours) * 60 * 60 * 1000));
        } else if (days) {
            // Mevcut bitiş tarihine gün ekle (millisecond cinsinden)
            newEnd.setTime(newEnd.getTime() + (parseInt(days) * 24 * 60 * 60 * 1000));
        }

        // Yerel saat olarak göster (datetime-local input için)
        const localTime = new Date(newEnd.getTime() - (newEnd.getTimezoneOffset() * 60000));
        const newEndString = localTime.toISOString().slice(0, 16);
        document.getElementById('extendTrialNewEnd').value = newEndString;

        // Visual feedback - highlight the clicked button
        document.querySelectorAll('.quick-duration-btn').forEach(btn => {
            btn.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-200');
        });
        button.classList.add('ring-2', 'ring-blue-500', 'bg-blue-200');
    }

    async confirmExtendTrial() {
        const username = this.currentExtendUser;
        if (!username) return;

        const newEndString = document.getElementById('extendTrialNewEnd').value;
        if (!newEndString) {
            alert('Lütfen yeni bitiş tarihi seçin!');
            return;
        }

        try {
            // datetime-local input yerel saat formatında gelir, UTC'ye çevir
            const newEnd = new Date(newEndString);
            if (isNaN(newEnd.getTime())) {
                alert('Geçersiz tarih formatı!');
                return;
            }

            const user = this.users.find(u => u.username === username);
            if (!user) return;

            // Update in Supabase
            if (window.jbDb) {
                await window.jbDb
                    .from('users')
                    .update({ trial_end: newEnd.toISOString() })
                    .eq('username', username);
            }

            // Update local
            const localUsers = JSON.parse(localStorage.getItem('LOCAL_USERS') || '{}');
            if (localUsers[username]) {
                localUsers[username].trialEnd = newEnd.toISOString();
                localStorage.setItem('LOCAL_USERS', JSON.stringify(localUsers));
            }

            // Update in memory
            user.trial_end = newEnd.toISOString();
            this.renderUsers();
            this.updateStats();

            // Close modal
            document.getElementById('extendTrialModal').classList.add('hidden');

            alert(`Test süresi ${newEnd.toLocaleString('tr-TR')} olarak güncellendi!`);
        } catch (error) {
            console.error('Error extending trial:', error);
            alert('Süre uzatılırken hata oluştu: ' + error.message);
        }
    }

    editUser(username) {
        const user = this.users.find(u => u.username === username);
        if (!user) return;

        // Store current username for modal
        this.currentEditUser = username;

        // Fill form with user data
        document.getElementById('editUsername').value = user.username;
        // Parola artık okunamıyor (bcrypt hash'i). Boş bırakılırsa değişmez.
        const editPasswordEl = document.getElementById('editPassword');
        if (editPasswordEl) {
            editPasswordEl.value = '';
            editPasswordEl.placeholder = 'Değiştirmek için yeni şifre girin';
        }
        document.getElementById('editCompany').value = user.company || '';
        document.getElementById('editEmail').value = user.contact_email || '';
        
        // Set trial end date
        if (user.trial_end) {
            const trialEnd = new Date(user.trial_end);
            const localTime = new Date(trialEnd.getTime() - (trialEnd.getTimezoneOffset() * 60000));
            document.getElementById('editTrialEnd').value = localTime.toISOString().slice(0, 16);
        }
        
        document.getElementById('editIPs').value = (user.allowed_ips || user.allowedIPs || []).join(', ');
        document.getElementById('editMaxIPCount').value = user.max_ip_count || 5;
        document.getElementById('editIPTrackingEnabled').checked = user.ip_tracking_enabled !== false;
        document.getElementById('editIsActive').checked = user.is_active || user.isActive || false;

        // Show modal
        document.getElementById('editUserModal').classList.remove('hidden');
    }

    async refreshUserPage() {
        const username = this.currentEditUser;
        if (!username) {
            alert('❌ Kullanıcı seçilmedi!');
            return;
        }

        if (!confirm(`⚠️ ${username} kullanıcısının sayfasını yenilemek istediğinizden emin misiniz?`)) {
            return;
        }

        try {
            if (!window.jbDb) {
                alert('❌ Supabase bağlantısı yok!');
                return;
            }

            // Use Supabase Broadcast channel to send refresh command to user
            // This is more reliable than updating database fields
            const channelName = `user-refresh-${username}`;
            const channel = window.jbDb.channel(channelName);
            
            // Subscribe to channel first (required for broadcast)
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Send broadcast message
                    channel.send({
                        type: 'broadcast',
                        event: 'refresh-page',
                        payload: { 
                            username: username,
                            timestamp: new Date().toISOString()
                        }
                    }).then(() => {
                        console.log('✅ Refresh command sent via broadcast');
                        alert(`✅ ${username} kullanıcısına sayfa yenileme komutu gönderildi!\n\nKullanıcı aktif bir oturumda ise sayfası otomatik olarak yenilenecektir.`);
                        
                        // Cleanup channel after sending
                        setTimeout(() => {
                            window.jbDb.removeChannel(channel);
                        }, 1000);
                    }).catch((error) => {
                        console.error('❌ Error sending refresh command:', error);
                        window.jbDb.removeChannel(channel);
                        alert('❌ Sayfa yenileme komutu gönderilirken hata oluştu: ' + error.message);
                    });
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('❌ Channel subscription failed:', status);
                    window.jbDb.removeChannel(channel);
                    alert('❌ Sayfa yenileme komutu gönderilirken hata oluştu: Channel bağlantı hatası');
                }
            });

        } catch (error) {
            console.error('❌ Error refreshing user page:', error);
            alert('❌ Sayfa yenileme komutu gönderilirken hata oluştu: ' + error.message);
        }
    }

    async updateUser() {
        const username = this.currentEditUser;
        if (!username) return;

        const password = document.getElementById('editPassword').value;
        const company = document.getElementById('editCompany').value;
        const email = document.getElementById('editEmail').value;
        const trialEndInput = document.getElementById('editTrialEnd').value;
        const ips = document.getElementById('editIPs').value.split(',').map(ip => ip.trim()).filter(ip => ip);
        const maxIPCount = parseInt(document.getElementById('editMaxIPCount').value) || 5;
        const ipTrackingEnabled = document.getElementById('editIPTrackingEnabled').checked;
        const isActive = document.getElementById('editIsActive').checked;

        try {
            let trialEnd;
            if (trialEndInput) {
                trialEnd = new Date(trialEndInput);
            } else {
                trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + 30); // Default 30 days
            }

            const updatedUser = {
                company: company,
                contact_email: email,
                trial_end: trialEnd.toISOString(),
                allowed_ips: ips.length > 0 ? ips : ['*'],
                max_ip_count: maxIPCount,
                ip_tracking_enabled: ipTrackingEnabled,
                is_active: isActive
            };
            // Parola BURADA güncellenmiyor — aşağıda API üzerinden bcrypt'lenir.

            // Update in Supabase
            if (window.jbDb) {
                const { error } = await window.jbDb
                    .from('users')
                    .update(updatedUser)
                    .eq('username', username);
                if (error) {
                    const msg = error.message || '';
                    if (msg.includes('allowed_ips') || (msg.includes('column') && (msg.includes('max_ip_count') || msg.includes('ip_tracking_enabled')))) {
                        const which = msg.includes('allowed_ips')
                            ? 'allowed_ips kolonu için sql_files/add_allowed_ips_to_users.sql'
                            : 'max_ip_count/ip_tracking_enabled için sql_files/supabase_ip_tracking.sql';
                        throw new Error('Supabase\'de migration gerekli. SQL Editor\'da ' + which + ' dosyasını çalıştırın.');
                    }
                    throw error;
                }
            }

            // Parola girildiyse API üzerinden bcrypt'le (boşsa değişmez)
            if (password && String(password).trim() !== '') {
                const pwRes = await window.jetbarkodAuth.apiFetch('/api/admin/users/password', {
                    method: 'POST',
                    body: JSON.stringify({ username, password: String(password).trim() })
                });
                if (!pwRes.ok) {
                    const d = await pwRes.json().catch(() => ({}));
                    throw new Error(
                        d.error === 'password_too_short'
                            ? 'Şifre en az 6 karakter olmalı.'
                            : 'Şifre güncellenemedi.'
                    );
                }
            }

            // Update local
            const localUsers = JSON.parse(localStorage.getItem('LOCAL_USERS') || '{}');
            if (localUsers[username]) {
                localUsers[username] = {
                    ...localUsers[username],
                    company: company,
                    trialEnd: trialEnd.toISOString(),
                    allowedIPs: ips.length > 0 ? ips : ['*'],
                    isActive: isActive
                };
                localStorage.setItem('LOCAL_USERS', JSON.stringify(localUsers));
            }

            // Update in memory
            const user = this.users.find(u => u.username === username);
            if (user) {
                Object.assign(user, updatedUser);
            }

            this.renderUsers();
            this.updateStats();

            // Close modal
            document.getElementById('editUserModal').classList.add('hidden');

            alert('Kullanıcı başarıyla güncellendi!');
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Kullanıcı güncellenirken hata oluştu: ' + error.message);
        }
    }

    togglePasswordVisibility(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        
        if (input.type === 'password') {
            input.type = 'text';
            button.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                </svg>
            `;
        } else {
            input.type = 'password';
            button.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
            `;
        }
    }

    async toggleUser(username) {
        try {
            const user = this.users.find(u => u.username === username);
            if (!user) return;

            const newStatus = !user.is_active;

            // Update in Supabase
            if (window.jbDb) {
                await window.jbDb
                    .from('users')
                    .update({ is_active: newStatus })
                    .eq('username', username);
            }

            // Update local
            if (window.LOCAL_USERS && window.LOCAL_USERS[username]) {
                window.LOCAL_USERS[username].isActive = newStatus;
            }

            // Update in memory
            user.is_active = newStatus;
            this.renderUsers();
            this.updateStats();

            alert(`Kullanıcı ${newStatus ? 'aktif' : 'deaktif'} edildi!`);
        } catch (error) {
            console.error('Error toggling user:', error);
            alert('Kullanıcı durumu değiştirilirken hata oluştu: ' + error.message);
        }
    }

    async deleteUser(username) {
        if (!confirm(`${username} kullanıcısını silmek istediğinizden emin misiniz?`)) return;

        try {
            // Delete from Supabase
            if (window.jbDb) {
                await window.jbDb
                    .from('users')
                    .delete()
                    .eq('username', username);
            }

            // Delete from local
            if (window.LOCAL_USERS && window.LOCAL_USERS[username]) {
                delete window.LOCAL_USERS[username];
            }

            // Remove from memory
            this.users = this.users.filter(u => u.username !== username);
            this.renderUsers();
            this.updateStats();

            alert('Kullanıcı silindi!');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Kullanıcı silinirken hata oluştu: ' + error.message);
        }
    }

    async loadMessages() {
        try {
            // Always load from global messages (since Supabase is not configured)
            const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
            console.log('Loading global messages from local storage:', globalMessages);
            this.messages = globalMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            console.log('Sorted messages:', this.messages);

            this.renderMessages();
            this.updateStats();
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    renderMessages() {
        const container = document.getElementById('messagesList');
        container.innerHTML = '';

        console.log('Rendering messages:', this.messages);

        if (this.messages.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Henüz mesaj bulunmuyor.</p>';
            return;
        }

        // Filter messages based on current filter
        let filteredMessages = this.messages;
        if (this.currentMessageFilter && this.currentMessageFilter !== 'all') {
            filteredMessages = this.messages.filter(message => message.status === this.currentMessageFilter);
        }

        if (filteredMessages.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Bu kategoride mesaj bulunmuyor.</p>';
            return;
        }

        filteredMessages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'bg-white border border-gray-200 rounded-lg p-4';
            
            messageDiv.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-medium text-gray-900">${message.message_type || 'Genel'}</h4>
                        <p class="text-sm text-gray-500">${message.user_id}</p>
                    </div>
                    <span class="text-xs text-gray-400">${new Date(message.created_at).toLocaleString('tr-TR')}</span>
                </div>
                <p class="text-gray-700 mb-3">${message.content}</p>
                <div class="flex justify-between items-center">
                    <span class="px-2 py-1 rounded-full text-xs ${
                        message.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        message.status === 'approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                    }">
                        ${message.status === 'pending' ? 'Bekliyor' :
                          message.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                    </span>
                    <div class="flex space-x-2">
                        ${message.status === 'pending' ? `
                            <button onclick="adminPanel.updateMessageStatus('${message.id}', 'approved')" class="text-green-600 hover:text-green-800 text-sm">Onayla</button>
                            <button onclick="adminPanel.updateMessageStatus('${message.id}', 'rejected')" class="text-red-600 hover:text-red-800 text-sm">Reddet</button>
                        ` : `
                            <button onclick="adminPanel.updateMessageStatus('${message.id}', 'pending')" class="text-blue-600 hover:text-blue-800 text-sm">Bekletmeye Al</button>
                        `}
                    </div>
                </div>
            `;
            
            container.appendChild(messageDiv);
        });
    }

    async updateMessageStatus(messageId, status) {
        try {
            // Update in Supabase
            if (window.jbDb) {
                await window.jbDb
                    .from('messages')
                    .update({ status: status })
                    .eq('id', messageId);
            }

            // Update in global messages
            const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
            const messageIndex = globalMessages.findIndex(m => m.id == messageId);
            if (messageIndex !== -1) {
                globalMessages[messageIndex].status = status;
                localStorage.setItem('globalMessages', JSON.stringify(globalMessages));
            }

            // Update in memory
            const message = this.messages.find(m => m.id == messageId);
            if (message) {
                message.status = status;
            }

            this.renderMessages();
            this.updateStats();

            alert(`Mesaj ${status === 'approved' ? 'onaylandı' : 'reddedildi'}!`);
        } catch (error) {
            console.error('Error updating message status:', error);
            alert('Mesaj durumu güncellenirken hata oluştu: ' + error.message);
        }
    }

    filterMessages(filter) {
        this.currentMessageFilter = filter;
        
        // Update filter button states
        document.querySelectorAll('.filter-btn').forEach((btn) => {
            btn.classList.remove('is-active');
        });

        const activeButton = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}Messages`);
        if (activeButton) activeButton.classList.add('is-active');
        
        this.renderMessages();
    }



    async loadIPAnalysis() {
        try {
            // Load IP tracking data
            await this.loadIPTracking();
            
            // Analyze IP data
            this.analyzeIPData();
        } catch (error) {
            console.error('Error loading IP analysis:', error);
        }
    }

    analyzeIPData() {
        if (!this.ipTrackingData || this.ipTrackingData.length === 0) {
            this.renderIPAnalysis();
            return;
        }

        const ipStats = {};
        let totalSessions = 0;
        let totalDuration = 0;
        let suspiciousCount = 0;

        this.ipTrackingData.forEach(ip => {
            const ipAddress = ip.ip_address;
            if (!ipStats[ipAddress]) {
                ipStats[ipAddress] = {
                    ip: ipAddress,
                    sessions: 0,
                    totalDuration: 0,
                    lastSeen: null,
                    users: new Set(),
                    isSuspicious: false
                };
            }
            ipStats[ipAddress].sessions += 1;
            totalSessions += 1;
            if (ip.username) ipStats[ipAddress].users.add(ip.username);
            if (ipStats[ipAddress].sessions > 10 || ipStats[ipAddress].users.size > 3) {
                ipStats[ipAddress].isSuspicious = true;
                suspiciousCount++;
            }
        });

        this.ipAnalysis = {
            uniqueIPs: Object.keys(ipStats).length,
            totalSessions: totalSessions,
            avgSessionDuration: totalSessions > 0 ? Math.round(totalDuration / totalSessions / 60) : 0,
            suspiciousIPs: suspiciousCount,
            topIPs: Object.values(ipStats)
                .sort((a, b) => b.sessions - a.sessions),
            timeline: [...this.ipTrackingData].slice(0, 50)
        };

        this.renderIPAnalysis();
    }

    renderIPAnalysis() {
        console.log('Rendering IP Analysis:', this.ipAnalysis);
        
        // Update statistics
        document.getElementById('uniqueIPCount').textContent = this.ipAnalysis ? this.ipAnalysis.uniqueIPs : '-';
        document.getElementById('totalSessions').textContent = this.ipAnalysis ? this.ipAnalysis.totalSessions : '-';
        document.getElementById('avgSessionDuration').textContent = this.ipAnalysis ? this.ipAnalysis.avgSessionDuration + ' dk' : '-';
        document.getElementById('suspiciousIPs').textContent = this.ipAnalysis ? this.ipAnalysis.suspiciousIPs : '-';

        // Render IP Details Table
        const ipDetailsTable = document.getElementById('ipDetailsTable');
        if (ipDetailsTable) {
            if (this.ipAnalysis && this.ipAnalysis.topIPs && this.ipAnalysis.topIPs.length > 0) {
                ipDetailsTable.innerHTML = this.ipAnalysis.topIPs.map(ip => `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center">
                                <div class="flex-shrink-0 h-8 w-8">
                                    <div class="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                        <span class="text-xs font-medium text-white">${ip.ip.split('.').pop()}</span>
                                    </div>
                                </div>
                                <div class="ml-3">
                                    <div class="font-mono text-sm font-semibold text-gray-900">${ip.ip}</div>
                                    <div class="text-xs text-gray-500">${ip.isSuspicious ? '⚠️ Şüpheli' : '✅ Normal'}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex flex-wrap gap-1">
                                ${Array.from(ip.users).slice(0, 2).map(user => `
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        ${user}
                                    </span>
                                `).join('')}
                                ${ip.users.size > 2 ? `<span class="text-xs text-gray-500">+${ip.users.size - 2} daha</span>` : ''}
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ${ip.sessions} oturum
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${Math.round(ip.totalDuration / 60)} dakika
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${new Date(ip.lastSeen).toLocaleString('tr-TR')}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ip.isSuspicious ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                                ${ip.isSuspicious ? '🚨 Şüpheli' : '✅ Güvenli'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div class="flex space-x-2">
                                <button onclick="adminPanel.blockIP('${ip.ip}')" class="text-red-600 hover:text-red-900 text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded">
                                    🚫 Engelle
                                </button>
                                <button onclick="adminPanel.viewIPDetails('${ip.ip}')" class="text-blue-600 hover:text-blue-900 text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded">
                                    👁️ Detay
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            } else {
                ipDetailsTable.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                            <div class="flex flex-col items-center space-y-2">
                                <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <div class="text-lg font-medium">Henüz IP verisi yok</div>
                                <div class="text-sm">Kullanıcılar giriş yaptıkça burada görünecek</div>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

    }

    filterIPs(filter) {
        console.log('Filtering IPs:', filter);
        
        // Update button styles
        document.querySelectorAll('.ip-filter-btn').forEach((btn) => {
            btn.classList.remove('is-active');
        });

        const activeButton = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}IPs`);
        if (activeButton) activeButton.classList.add('is-active');

        // Filter data based on filter type
        let filteredData = this.ipTrackingData || [];
        
        if (filter !== 'all') {
            const now = new Date();
            const filterDate = new Date();
            
            switch (filter) {
                case 'today':
                    filterDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    filterDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    filterDate.setMonth(now.getMonth() - 1);
                    break;
            }
            
            filteredData = filteredData.filter(ip => {
                const lastSeen = new Date(ip.last_seen);
                return lastSeen >= filterDate;
            });
        }

        // Re-analyze with filtered data
        this.analyzeIPDataWithFilter(filteredData);
    }

    analyzeIPDataWithFilter(filteredData) {
        if (!filteredData || filteredData.length === 0) {
            this.ipAnalysis = {
                uniqueIPs: 0,
                totalSessions: 0,
                avgSessionDuration: 0,
                suspiciousIPs: 0,
                topIPs: [],
                timeline: []
            };
            this.renderIPAnalysis();
            return;
        }

        const ipStats = {};
        let totalSessions = 0;
        let totalDuration = 0;
        let suspiciousCount = 0;

        filteredData.forEach(ip => {
            const ipAddress = ip.ip_address;
            if (!ipStats[ipAddress]) {
                ipStats[ipAddress] = {
                    ip: ipAddress,
                    sessions: 0,
                    totalDuration: 0,
                    lastSeen: ip.last_seen,
                    users: new Set(),
                    isSuspicious: false
                };
            }
            
            ipStats[ipAddress].sessions += ip.login_count || 1;
            totalSessions += ip.login_count || 1;
            
            if (ip.username) {
                ipStats[ipAddress].users.add(ip.username);
            }
            
            if (new Date(ip.last_seen) > new Date(ipStats[ipAddress].lastSeen)) {
                ipStats[ipAddress].lastSeen = ip.last_seen;
            }

            // Detect suspicious activity
            if (ipStats[ipAddress].sessions > 10 || ipStats[ipAddress].users.size > 3) {
                ipStats[ipAddress].isSuspicious = true;
                suspiciousCount++;
            }
        });

        this.ipAnalysis = {
            uniqueIPs: Object.keys(ipStats).length,
            totalSessions: totalSessions,
            avgSessionDuration: totalSessions > 0 ? Math.round(totalDuration / totalSessions / 60) : 0,
            suspiciousIPs: suspiciousCount,
            topIPs: Object.values(ipStats)
                .sort((a, b) => b.sessions - a.sessions),
            timeline: filteredData
                .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
                .slice(0, 50)
        };

        this.renderIPAnalysis();
    }

    sortIPs(sortBy) {
        console.log('Sorting IPs by:', sortBy);
        
        if (!this.ipAnalysis || !this.ipAnalysis.topIPs) return;
        
        let sortedIPs = [...this.ipAnalysis.topIPs];
        
        switch (sortBy) {
            case 'sessions':
                sortedIPs.sort((a, b) => b.sessions - a.sessions);
                break;
            case 'lastSeen':
                sortedIPs.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
                break;
            case 'users':
                sortedIPs.sort((a, b) => b.users.size - a.users.size);
                break;
            case 'suspicious':
                sortedIPs.sort((a, b) => {
                    if (a.isSuspicious && !b.isSuspicious) return -1;
                    if (!a.isSuspicious && b.isSuspicious) return 1;
                    return 0;
                });
                break;
        }
        
        this.ipAnalysis.topIPs = sortedIPs;
        this.renderIPAnalysis();
    }

    searchIPs(searchTerm) {
        console.log('Searching IPs:', searchTerm);
        
        if (!searchTerm.trim()) {
            // Reset to original data
            this.analyzeIPData();
            return;
        }
        
        const filteredData = (this.ipTrackingData || []).filter(ip => {
            const searchLower = searchTerm.toLowerCase();
            return (
                ip.ip_address.toLowerCase().includes(searchLower) ||
                (ip.username && ip.username.toLowerCase().includes(searchLower))
            );
        });
        
        this.analyzeIPDataWithFilter(filteredData);
    }

    exportIPData() {
        console.log('Exporting IP Data');
        
        if (!this.ipTrackingData || this.ipTrackingData.length === 0) {
            alert('Dışa aktarılacak veri bulunamadı');
            return;
        }
        
        const csvContent = [
            ['Kullanıcı', 'IP Adresi', 'Durum'],
            ...this.ipTrackingData.map(ip => [
                ip.username || 'Bilinmeyen',
                ip.ip_address,
                ip.is_blocked ? 'Engelli' : 'Aktif'
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `ip_tracking_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async addTestIPData() {
        console.log('🧪 Adding test IP data (users.tracked_ips)...');
        try {
            const { data: users, error: usersError } = await window.jbDb
                .from('users')
                .select('id, username, tracked_ips')
                .limit(1);
            if (usersError || !users || users.length === 0) {
                alert('Önce bir kullanıcı eklemeniz gerekiyor!');
                return;
            }
            const u = users[0];
            const current = Array.isArray(u.tracked_ips) ? u.tracked_ips : [];
            const testIPs = ['192.168.1.100', '192.168.1.101', '192.168.1.102'];
            const added = testIPs.filter(ip => !current.includes(ip));
            const newList = [...current];
            added.forEach(ip => newList.push(ip));
            const { error } = await window.jbDb
                .from('users')
                .update({ tracked_ips: newList })
                .eq('id', u.id);
            if (error) throw error;
            alert('✅ Test IP adresleri kullanıcıya eklendi: ' + (added.length ? added.join(', ') : 'zaten vardı'));
            this.loadIPTracking();
        } catch (error) {
            console.error('❌ Error adding test IP data:', error);
            alert('Hata: ' + (error?.message || error));
        }
    }

    async testDbConnection() {
        console.log('🧪 Testing Supabase connection...');
        
        if (!window.jbDb) {
            console.error('❌ Supabase not available!');
            return;
        }
        
        try {
            // Test 1: Check users table
            console.log('🔍 Test 1: Checking users table...');
            const { data: users, error: usersError } = await window.jbDb
                .from('users')
                .select('id, username')
                .limit(1);
            
            if (usersError) {
                console.error('❌ Users table error:', usersError);
            } else {
                console.log('✅ Users table OK:', users);
            }
            
            // Test 2: Check blocked_ips table
            console.log('🔍 Test 2: Checking blocked_ips table...');
            const { data: blockedCheck, error: blockedError } = await window.jbDb
                .from('blocked_ips')
                .select('id')
                .limit(1);
            if (blockedError) {
                console.error('❌ blocked_ips table error:', blockedError);
            } else {
                console.log('✅ blocked_ips table OK:', blockedCheck);
            }
            
            // Test 3: Users.tracked_ips (read-only check)
            console.log('🔍 Test 3: Checking users.tracked_ips...');
            const { data: usersWithIPs, error: usersIPError } = await window.jbDb
                .from('users')
                .select('id, username, tracked_ips')
                .limit(1);
            if (usersIPError) {
                console.error('❌ users.tracked_ips error:', usersIPError);
            } else {
                console.log('✅ users.tracked_ips OK:', usersWithIPs);
            }
            
        } catch (error) {
            console.error('❌ Supabase connection test failed:', error);
        }
    }

    // IP Details Table Sorting with proper A-Z/Z-A toggle
    sortIPDetailsTable(column, direction = null) {
        console.log('🔄 Sorting IP Details by:', column, direction);
        
        if (!this.ipAnalysis || !this.ipAnalysis.topIPs) return;
        
        // If no direction provided, toggle from current
        if (!direction) {
            direction = this.currentIPDetailsSortDirection === 'asc' ? 'desc' : 'asc';
        }
        
        this.currentIPDetailsSortDirection = direction;
        this.currentIPDetailsSortColumn = column;
        
        let sortedIPs = [...this.ipAnalysis.topIPs];
        
        switch (column) {
            case 'ip':
                sortedIPs.sort((a, b) => {
                    const aIP = a.ip.split('.').map(num => parseInt(num));
                    const bIP = b.ip.split('.').map(num => parseInt(num));
                    for (let i = 0; i < 4; i++) {
                        if (aIP[i] !== bIP[i]) {
                            return direction === 'asc' ? aIP[i] - bIP[i] : bIP[i] - aIP[i];
                        }
                    }
                    return 0;
                });
                break;
            case 'users':
                sortedIPs.sort((a, b) => {
                    // Convert Set to Array and get first user name for sorting
                    const aFirstUser = Array.from(a.users)[0] || '';
                    const bFirstUser = Array.from(b.users)[0] || '';
                    return direction === 'asc' ? aFirstUser.localeCompare(bFirstUser) : bFirstUser.localeCompare(aFirstUser);
                });
                break;
            case 'sessions':
                sortedIPs.sort((a, b) => {
                    return direction === 'asc' ? a.sessions - b.sessions : b.sessions - a.sessions;
                });
                break;
            case 'duration':
                sortedIPs.sort((a, b) => {
                    return direction === 'asc' ? a.totalDuration - b.totalDuration : b.totalDuration - a.totalDuration;
                });
                break;
            case 'lastSeen':
                sortedIPs.sort((a, b) => {
                    const aDate = new Date(a.lastSeen);
                    const bDate = new Date(b.lastSeen);
                    return direction === 'asc' ? aDate - bDate : bDate - aDate;
                });
                break;
            case 'status':
                sortedIPs.sort((a, b) => {
                    if (a.isSuspicious === b.isSuspicious) return 0;
                    return direction === 'asc' ? 
                        (a.isSuspicious ? 1 : -1) : 
                        (a.isSuspicious ? -1 : 1);
                });
                break;
        }
        
        this.ipAnalysis.topIPs = sortedIPs;
        this.renderIPAnalysis();
    }

    // IP Tracking Table Sorting with proper A-Z/Z-A toggle
    sortIPTrackingTable(column, direction = null) {
        console.log('🔄 Sorting IP Tracking by:', column, direction);
        
        if (!this.ipTrackingData) return;
        
        // If no direction provided, toggle from current
        if (!direction) {
            direction = this.currentIPTrackingSortDirection === 'asc' ? 'desc' : 'asc';
        }
        
        this.currentIPTrackingSortDirection = direction;
        this.currentIPTrackingSortColumn = column;
        
        let sortedData = [...this.ipTrackingData];
        
        switch (column) {
            case 'username':
                sortedData.sort((a, b) => {
                    const aUser = a.username || '';
                    const bUser = b.username || '';
                    return direction === 'asc' ? aUser.localeCompare(bUser) : bUser.localeCompare(aUser);
                });
                break;
            case 'ip':
                sortedData.sort((a, b) => {
                    const aIP = a.ip_address.split('.').map(num => parseInt(num));
                    const bIP = b.ip_address.split('.').map(num => parseInt(num));
                    for (let i = 0; i < 4; i++) {
                        if (aIP[i] !== bIP[i]) {
                            return direction === 'asc' ? aIP[i] - bIP[i] : bIP[i] - aIP[i];
                        }
                    }
                    return 0;
                });
                break;
            case 'firstSeen':
                sortedData.sort((a, b) => {
                    const aDate = new Date(a.first_seen);
                    const bDate = new Date(b.first_seen);
                    return direction === 'asc' ? aDate - bDate : bDate - aDate;
                });
                break;
            case 'lastSeen':
                sortedData.sort((a, b) => {
                    const aDate = new Date(a.last_seen);
                    const bDate = new Date(b.last_seen);
                    return direction === 'asc' ? aDate - bDate : bDate - aDate;
                });
                break;
            case 'loginCount':
                sortedData.sort((a, b) => {
                    return direction === 'asc' ? a.login_count - b.login_count : b.login_count - a.login_count;
                });
                break;
            case 'status':
                sortedData.sort((a, b) => {
                    if (a.is_blocked === b.is_blocked) return 0;
                    return direction === 'asc' ? 
                        (a.is_blocked ? 1 : -1) : 
                        (a.is_blocked ? -1 : 1);
                });
                break;
        }
        
        this.ipTrackingData = sortedData;
        this.renderIPTracking();
    }

    // Helper function to toggle sort direction
    toggleSortDirection(currentDirection) {
        return currentDirection === 'asc' ? 'desc' : 'asc';
    }

    updateStats() {
        const totalUsers = this.users.length;
        const activeUsers = this.users.filter(u => u.is_active).length;
        const expiringUsers = this.users.filter(u => {
            const daysLeft = this.getTrialDaysLeft(u.trial_end);
            return daysLeft !== null && daysLeft <= 3 && daysLeft > 0;
        }).length;
        const pendingMessages = this.messages.filter(m => m.status === 'pending').length;

        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('activeUsers').textContent = activeUsers;
        document.getElementById('expiringUsers').textContent = expiringUsers;
        document.getElementById('pendingMessages').textContent = pendingMessages;
    }

    getTrialStatusText(trialEnd) {
        if (!trialEnd) return 'Süresiz';
        
        const daysLeft = this.getTrialDaysLeft(trialEnd);
        
        if (daysLeft === null) return 'Geçersiz';
        if (daysLeft <= 0) return 'Süresi Doldu';
        
        const now = new Date();
        const endDate = new Date(trialEnd);
        const diffTime = endDate - now;
        
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `${days} gün ${hours} saat`;
        } else if (hours > 0) {
            return `${hours} saat ${minutes} dakika`;
        } else {
            return `${minutes} dakika`;
        }
    }

    getTrialStatusClass(trialEnd) {
        if (!trialEnd) return 'text-gray-500';
        
        const daysLeft = this.getTrialDaysLeft(trialEnd);
        
        if (daysLeft === null) return 'text-gray-500';
        if (daysLeft <= 0) return 'text-red-600';
        if (daysLeft <= 1) return 'text-red-600';
        if (daysLeft <= 3) return 'text-orange-600';
        
        return 'text-green-600';
    }

    // IP Tracking Functions
    async loadIPTracking() {
        try {
            console.log('🔄 Loading IP tracking data (users.tracked_ips)...');
            if (!window.jbDb) {
                this.ipTrackingData = [];
                this.renderIPTracking();
                return;
            }
            const { data: usersData, error: usersError } = await window.jbDb
                .from('users')
                .select('id, username, tracked_ips');
            if (usersError) {
                console.error('❌ Users/tracked_ips error:', usersError);
                this.ipTrackingData = [];
                this.renderIPTracking();
                return;
            }
            const { data: blockedRows } = await window.jbDb
                .from('blocked_ips')
                .select('ip_address');
            const blockedSet = new Set((blockedRows || []).map(r => r.ip_address));
            const flat = [];
            (usersData || []).forEach(u => {
                const ips = Array.isArray(u.tracked_ips) ? u.tracked_ips : [];
                ips.forEach(ip => {
                    flat.push({
                        user_id: u.id,
                        username: u.username || 'Bilinmeyen',
                        ip_address: ip,
                        is_blocked: blockedSet.has(ip),
                        first_seen: null,
                        last_seen: null,
                        login_count: null
                    });
                });
            });
            this.ipTrackingData = flat;
            console.log('📊 Total IP tracking records:', this.ipTrackingData.length);
            this.renderIPTracking();
            if (this.currentTab === 'ipAnalysis') {
                this.analyzeIPData();
            }
        } catch (error) {
            console.error('❌ Error loading IP tracking:', error);
            this.ipTrackingData = [];
            this.renderIPTracking();
        }
    }

    renderIPTracking() {
        // Update statistics
        const totalTracked = this.ipTrackingData.length;
        const blockedCount = this.ipTrackingData.filter(ip => ip.is_blocked).length;
        const violationsCount = this.ipTrackingData.filter(ip => ip.login_count > 10).length;

        document.getElementById('totalTrackedIPs').textContent = totalTracked;
        document.getElementById('blockedIPs').textContent = blockedCount;
        document.getElementById('maxIPViolations').textContent = violationsCount;

        // Render table
        const tbody = document.getElementById('ipTrackingTable');
        tbody.innerHTML = '';

        this.ipTrackingData.forEach(ip => {
            const row = document.createElement('tr');
            const statusClass = ip.is_blocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            const statusText = ip.is_blocked ? 'Engellenen' : 'Aktif';
            const ipEsc = (ip.ip_address || '').replace(/'/g, "\\'");
            const userIdEsc = (ip.user_id || '').replace(/'/g, "\\'");
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${ip.username || 'Bilinmeyen'}</div>
                    <div class="text-sm text-gray-500">${ip.user_id || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${ip.ip_address}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">—</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">—</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">—</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        ${ip.is_blocked ?
                            `<button onclick="adminPanel.unblockIPByAddress('${ipEsc}')" class="text-green-600 hover:text-green-900">Engeli Kaldır</button>` :
                            `<button onclick="adminPanel.blockIPTracking('${ipEsc}')" class="text-red-600 hover:text-red-900">Engelle</button>`
                        }
                        <button onclick="adminPanel.deleteIPTracking('${userIdEsc}','${ipEsc}')" class="text-gray-600 hover:text-gray-900">Sil</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async blockIPTracking(ipAddress) {
        if (!ipAddress || !confirm('Bu IP adresini engellemek istediğinizden emin misiniz?')) return;
        try {
            const { error } = await window.jbDb
                .from('blocked_ips')
                .upsert({ ip_address: ipAddress }, { onConflict: 'ip_address' });
            if (error) throw error;
            await this.loadIPTracking();
            await this.loadBlockedIPs();
            alert('IP adresi engellendi!');
        } catch (error) {
            console.error('Error blocking IP:', error);
            alert('IP engellenirken hata oluştu!');
        }
    }

    async unblockIP(blockedId) {
        try {
            const { error } = await window.jbDb
                .from('blocked_ips')
                .delete()
                .eq('id', blockedId);
            if (error) throw error;
            await this.loadIPTracking();
            await this.loadBlockedIPs();
            alert('IP engeli kaldırıldı!');
        } catch (error) {
            console.error('Error unblocking IP:', error);
            alert('IP engeli kaldırılırken hata oluştu!');
        }
    }

    async unblockIPByAddress(ipAddress) {
        if (!ipAddress) return;
        try {
            const { error } = await window.jbDb
                .from('blocked_ips')
                .delete()
                .eq('ip_address', ipAddress);
            if (error) throw error;
            await this.loadIPTracking();
            await this.loadBlockedIPs();
            alert('IP engeli kaldırıldı!');
        } catch (error) {
            console.error('Error unblocking IP:', error);
            alert('IP engeli kaldırılırken hata oluştu!');
        }
    }

    async loadBlockedIPs() {
        try {
            if (!window.jbDb) return;
            const { data, error } = await window.jbDb
                .from('blocked_ips')
                .select('id, ip_address, created_at')
                .order('created_at', { ascending: false });
            if (error) throw error;
            this.blockedIPsData = data || [];
            this.renderBlockedIPs();
        } catch (error) {
            console.error('Error loading blocked IPs:', error);
        }
    }

    // Render blocked IPs table
    renderBlockedIPs() {
        const tbody = document.getElementById('blockedIPsTableBody');
        if (!tbody) return;

        if (!this.blockedIPsData || this.blockedIPsData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">Engellenen IP bulunmuyor</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        this.blockedIPsData.forEach(ip => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            const banDate = new Date(ip.created_at || 0);
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <span class="text-sm font-medium text-gray-900">${ip.ip_address}</span>
                        <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Engelli</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-500">—</div></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${banDate.toLocaleDateString('tr-TR')} ${banDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">—</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="adminPanel.unblockIP('${ip.id}')" class="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded text-xs">Engeli Kaldır</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async deleteIPTracking(userId, ipAddress) {
        if (!userId || !ipAddress || !confirm('Bu IP kaydını kullanıcıdan kaldırmak istediğinizden emin misiniz?')) return;
        try {
            const { data: u, error: fetchErr } = await window.jbDb
                .from('users')
                .select('tracked_ips')
                .eq('id', userId)
                .single();
            if (fetchErr || !u) {
                throw new Error(fetchErr?.message || 'Kullanıcı bulunamadı');
            }
            const current = Array.isArray(u.tracked_ips) ? u.tracked_ips : [];
            const updated = current.filter(ip => ip !== ipAddress);
            const { error } = await window.jbDb
                .from('users')
                .update({ tracked_ips: updated })
                .eq('id', userId);
            if (error) throw error;
            await this.loadIPTracking();
            alert('IP kaydı kaldırıldı!');
        } catch (error) {
            console.error('Error removing IP from user:', error);
            alert('IP kaldırılırken hata oluştu!');
        }
    }
}

// Initialize admin panel
let adminPanel;
document.addEventListener('DOMContentLoaded', async () => {
    adminPanel = new AdminPanel();
    await adminPanel.init();
    
    // Set default trial end date (3 days from now)
    const defaultTrialEnd = new Date();
    defaultTrialEnd.setDate(defaultTrialEnd.getDate() + 3);
    document.getElementById('newTrialEnd').value = defaultTrialEnd.toISOString().slice(0, 16);
    
    // Add event listeners for refresh buttons
    document.getElementById('refreshMessagesBtn').addEventListener('click', async () => {
        await adminPanel.loadMessages();
    });

    // Config Tab Event Listeners
    const refreshConfigBtn = document.getElementById('refreshConfigBtn');
    if (refreshConfigBtn) {
        refreshConfigBtn.addEventListener('click', async () => {
            await adminPanel.loadConfigTab();
        });
    }

    // Config Search
    const configSearchInput = document.getElementById('configSearchInput');
    if (configSearchInput) {
        configSearchInput.addEventListener('input', (e) => {
            adminPanel.filterConfigTable(e.target.value);
        });
    }

    // Edit Feature Modal
    const closeEditFeatureModal = document.getElementById('closeEditFeatureModal');
    if (closeEditFeatureModal) {
        closeEditFeatureModal.addEventListener('click', () => {
            document.getElementById('editFeatureModal').classList.add('hidden');
        });
    }

    const cancelEditFeature = document.getElementById('cancelEditFeature');
    if (cancelEditFeature) {
        cancelEditFeature.addEventListener('click', () => {
            document.getElementById('editFeatureModal').classList.add('hidden');
        });
    }

    const editFeatureForm = document.getElementById('editFeatureForm');
    if (editFeatureForm) {
        editFeatureForm.addEventListener('submit', (e) => {
            e.preventDefault();
            adminPanel.updateFeatureValue();
        });
    }
    
    // IP Analysis refresh button
    const refreshIPAnalysisBtn = document.getElementById('refreshIPAnalysisBtn');
    if (refreshIPAnalysisBtn) {
        refreshIPAnalysisBtn.addEventListener('click', async () => {
            await adminPanel.loadIPAnalysis();
        });
    }
});

// Chat Functions for AdminPanel
AdminPanel.prototype.setupChatRealtime = function() {
    if (!window.jbDb) return;
    
    console.log('🔔 Setting up chat realtime subscription');
    
    // Subscribe to users table changes for chat_messages
    this.chatSubscription = window.jbDb
        .channel('chat-updates')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: 'chat_messages=not.is.null'
        }, (payload) => {
            console.log('🔔 Chat update received:', payload);
            this.handleChatUpdate(payload);
        })
        .subscribe();
    
    console.log('✅ Chat realtime subscription established');
};

AdminPanel.prototype.handleChatUpdate = function(payload) {
    console.log('🔔 Handling chat update for user:', payload.new.username);
    
    // If we're currently viewing this user's chat, reload messages
    if (this.selectedChatUser === payload.new.username) {
        console.log('🔄 Reloading messages for current user');
        this.loadChatMessages(payload.new.username);
    }
    
    // Reload chat users list to show updated preview
    console.log('🔄 Reloading chat users list');
    this.loadChatUsers();
    
    // Show notification for new messages
    if (payload.new.chat_messages) {
        try {
            const chatMessages = JSON.parse(payload.new.chat_messages);
            const lastMessage = chatMessages[chatMessages.length - 1];
            
            if (lastMessage && lastMessage.sender === 'user') {
                this.showAdminNotification(payload.new.username, lastMessage.message);
            }
        } catch (error) {
            console.error('❌ Error parsing chat messages for notification:', error);
        }
    }
};

AdminPanel.prototype.triggerRealtimeUpdate = function(username) {
    console.log('🔔 Triggering realtime update for user:', username);
    
    if (window.jbDb) {
        // Update last_chat_update to trigger realtime
        window.jbDb
            .from('users')
            .update({ 
                last_chat_update: new Date().toISOString()
            })
            .eq('username', username)
            .then(({ error }) => {
                if (error) {
                    console.error('❌ Error triggering realtime update:', error);
                } else {
                    console.log('✅ Realtime update triggered for user:', username);
                }
            });
    }
};

AdminPanel.prototype.loadChatUsers = async function() {
    console.log('💬 Loading chat users...');
    try {
        const allUsers = [];
        
        if (window.jbDb) {
            console.log('💬 Using Supabase for chat users');
            
            // Load regular users with chat messages
            const { data: usersData, error: usersError } = await window.jbDb
                .from('users')
                .select('username, chat_messages, last_chat_update')
                .not('chat_messages', 'is', null);

            if (!usersError && usersData) {
                // Filter users who have chat messages
                const usersWithChat = usersData.filter(user => {
                    try {
                        const chatMessages = JSON.parse(user.chat_messages || '[]');
                        return chatMessages.length > 0;
                    } catch {
                        return false;
                    }
                });
                
                usersWithChat.forEach(user => {
                    allUsers.push({
                        username: user.username,
                        isGuest: false,
                        lastUpdate: user.last_chat_update
                    });
                });
            }
            
            // Load guest users with chat messages
            try {
                const { data: guestChatsData, error: guestError } = await window.jbDb
                    .from('guest_chats')
                    .select('username, chat_messages, last_chat_update')
                    .not('chat_messages', 'is', null)
                    .order('last_chat_update', { ascending: false });

                if (!guestError && guestChatsData) {
                    guestChatsData.forEach(guest => {
                        try {
                            const chatMessages = JSON.parse(guest.chat_messages || '[]');
                            if (chatMessages.length > 0) {
                                allUsers.push({
                                    username: guest.username,
                                    isGuest: true,
                                    lastUpdate: guest.last_chat_update
                                });
                            }
                        } catch (e) {
                            console.warn('Error parsing guest chat messages:', e);
                        }
                    });
                }
            } catch (guestTableError) {
                console.log('⚠️ guest_chats table might not exist yet:', guestTableError);
            }
            
            // Sort by last update (most recent first)
            allUsers.sort((a, b) => {
                const dateA = new Date(a.lastUpdate || 0);
                const dateB = new Date(b.lastUpdate || 0);
                return dateB - dateA;
            });
            
            if (allUsers.length > 0) {
                const uniqueUsers = allUsers.map(u => u.username);
                console.log('✅ Unique users with chat messages:', uniqueUsers);
                this.renderChatUsers(uniqueUsers);
                return;
            }
        }
        
        // Fallback to localStorage
        console.log('💬 Loading from localStorage...');
        this.loadChatUsersFromLocalStorage();
    } catch (error) {
        console.error('❌ Error loading chat users:', error);
        this.loadChatUsersFromLocalStorage();
    }
};

// Get all users (registered + guests) who haven't started a chat yet
AdminPanel.prototype.getAllUsersForChat = async function() {
    console.log('💬 Getting all users for new chat...');
    try {
        const allUsers = [];
        const usersWithChat = new Set();
        
        // Get usernames of users who already have chat messages
        if (window.jbDb) {
            // Get registered users with chat messages
            const { data: usersWithChatData } = await window.jbDb
                .from('users')
                .select('username, chat_messages')
                .not('chat_messages', 'is', null);
            
            if (usersWithChatData) {
                usersWithChatData.forEach(user => {
                    try {
                        const chatMessages = JSON.parse(user.chat_messages || '[]');
                        if (chatMessages.length > 0) {
                            usersWithChat.add(user.username);
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                });
            }
            
            // Get guest users with chat messages
            try {
                const { data: guestChatsData } = await window.jbDb
                    .from('guest_chats')
                    .select('username, chat_messages')
                    .not('chat_messages', 'is', null);
                
                if (guestChatsData) {
                    guestChatsData.forEach(guest => {
                        try {
                            const chatMessages = JSON.parse(guest.chat_messages || '[]');
                            if (chatMessages.length > 0) {
                                usersWithChat.add(guest.username);
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    });
                }
            } catch (guestError) {
                console.log('⚠️ guest_chats table might not exist:', guestError);
            }
            
            // Get all registered users (excluding those with chat)
            const { data: allRegisteredUsers, error: regError } = await window.jbDb
                .from('users')
                .select('username, company, is_active')
                .eq('is_active', true)
                .order('username', { ascending: true });
            
            if (!regError && allRegisteredUsers) {
                allRegisteredUsers.forEach(user => {
                    if (!usersWithChat.has(user.username)) {
                        allUsers.push({
                            username: user.username,
                            company: user.company || '',
                            isGuest: false,
                            isActive: user.is_active
                        });
                    }
                });
            }
            
            // Get all guest users (excluding those with chat)
            try {
                const { data: allGuestUsers, error: guestError } = await window.jbDb
                    .from('guest_chats')
                    .select('username, ip_address, created_at')
                    .order('username', { ascending: true });
                
                if (!guestError && allGuestUsers) {
                    allGuestUsers.forEach(guest => {
                        if (!usersWithChat.has(guest.username)) {
                            allUsers.push({
                                username: guest.username,
                                company: 'Misafir Kullanıcı',
                                isGuest: true,
                                isActive: true
                            });
                        }
                    });
                }
            } catch (guestTableError) {
                console.log('⚠️ guest_chats table might not exist:', guestTableError);
            }
        }
        
        // Sort alphabetically by username
        allUsers.sort((a, b) => a.username.localeCompare(b.username));
        
        console.log(`✅ Found ${allUsers.length} users without chat history`);
        return allUsers;
    } catch (error) {
        console.error('❌ Error getting all users for chat:', error);
        return [];
    }
};

AdminPanel.prototype.loadChatUsersFromLocalStorage = function() {
    console.log('💬 Loading chat users from localStorage');
    const messages = JSON.parse(localStorage.getItem('messages') || '[]');
    const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
    const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
    const userMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
    
    const allMessages = [...messages, ...chatMessages, ...globalMessages, ...userMessages];
    console.log('💬 All messages from localStorage:', allMessages);
    
    const uniqueUsers = [...new Set(allMessages.map(msg => msg.username))];
    console.log('💬 Unique users from localStorage:', uniqueUsers);
    this.renderChatUsers(uniqueUsers);
};

AdminPanel.prototype.renderChatUsers = async function(users) {
    console.log('💬 Rendering chat users:', users);
    const chatUsersList = document.getElementById('chatUsersList');
    if (!chatUsersList) {
        console.error('💬 chatUsersList element not found!');
        return;
    }

    if (users.length === 0) {
        console.log('💬 No users to render, showing empty state');
        chatUsersList.innerHTML = `
            <div class="p-4 text-center text-gray-500">
                <svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <p class="text-sm">Aktif sohbet yok</p>
            </div>
        `;
        return;
    }

    console.log('💬 Rendering', users.length, 'users');
    
    // Render users with async message previews
    const userElements = await Promise.all(users.map(async (username) => {
        const messageData = await this.getLastMessagePreview(username);
        let lastMessage = messageData.preview || messageData; // Backward compatibility
        const unreadCount = messageData.unreadCount || 0;
        
        // Escape HTML to prevent XSS and broken HTML
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        lastMessage = escapeHtml(String(lastMessage));
        
        // Escape username for onclick attribute
        const escapedUsername = String(username).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        // Modern badge design - only show if there are unread messages
        const badgeHtml = unreadCount > 0 ? `
            <div class="relative">
                <div class="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                ${unreadCount > 1 ? `
                    <div class="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                        ${unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                ` : ''}
            </div>
        ` : '';
        
        return `
            <div class="adm-chat-user-item${this.selectedChatUser === username ? ' is-active' : ''}" onclick="adminPanel.selectChatUser('${escapedUsername}')">
                <div class="adm-chat-user-avatar">${escapeHtml(username.charAt(0).toUpperCase())}</div>
                <div class="adm-chat-user-body">
                    <h4>${escapeHtml(username)}</h4>
                    <p>${lastMessage}</p>
                </div>
                ${badgeHtml}
            </div>
        `;
    }));
    
    chatUsersList.innerHTML = userElements.join('');
    console.log('💬 Chat users rendered successfully');
};

// Open new chat modal and load users without chat history
AdminPanel.prototype.openNewChatModal = async function() {
    console.log('💬 Opening new chat modal...');
    const modal = document.getElementById('newChatModal');
    const userList = document.getElementById('newChatUserList');
    const searchInput = document.getElementById('newChatSearchInput');
    
    if (!modal || !userList) {
        console.error('❌ New chat modal elements not found');
        return;
    }
    
    // Show modal
    modal.classList.remove('hidden');
    searchInput.value = '';
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            this.closeNewChatModal();
        }
    });
    
    // Close modal on ESC key
    const escHandler = (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            this.closeNewChatModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Show loading state
    userList.innerHTML = `
        <div class="text-center text-gray-500 py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
            <p>Kullanıcılar yükleniyor...</p>
        </div>
    `;
    
    // Load users
    try {
        const users = await this.getAllUsersForChat();
        this.newChatUsers = users; // Store for filtering
        this.renderNewChatUsers(users);
    } catch (error) {
        console.error('❌ Error loading users for new chat:', error);
        userList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <p class="text-red-500">Kullanıcılar yüklenirken hata oluştu</p>
            </div>
        `;
    }
};

// Close new chat modal
AdminPanel.prototype.closeNewChatModal = function() {
    const modal = document.getElementById('newChatModal');
    if (modal) {
        modal.classList.add('hidden');
        this.newChatUsers = null;
    }
};

// Render users in new chat modal
AdminPanel.prototype.renderNewChatUsers = function(users) {
    const userList = document.getElementById('newChatUserList');
    if (!userList) return;
    
    if (users.length === 0) {
        userList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                <p class="text-sm">Henüz sohbet etmediğiniz kullanıcı bulunmuyor</p>
            </div>
        `;
        return;
    }
    
    const userElements = users.map(user => {
        const initial = user.username.charAt(0).toUpperCase();
        const guestBadge = user.isGuest ? `
            <span class="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Misafir</span>
        ` : '';
        
        return `
            <div class="p-3 border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors rounded-lg mb-2" onclick="adminPanel.startNewChat('${user.username}')">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-md">
                        ${initial}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2">
                            <h4 class="font-medium text-gray-900 truncate">${user.username}</h4>
                            ${guestBadge}
                        </div>
                        <p class="text-xs text-gray-500 truncate">${user.company || 'Kullanıcı'}</p>
                    </div>
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </div>
        `;
    });
    
    userList.innerHTML = userElements.join('');
};

// Filter users in new chat modal
AdminPanel.prototype.filterNewChatUsers = function(searchTerm) {
    if (!this.newChatUsers) return;
    
    const term = searchTerm.toLowerCase().trim();
    
    if (term === '') {
        this.renderNewChatUsers(this.newChatUsers);
        return;
    }
    
    const filtered = this.newChatUsers.filter(user => 
        user.username.toLowerCase().includes(term) ||
        (user.company && user.company.toLowerCase().includes(term))
    );
    
    this.renderNewChatUsers(filtered);
};

// Start new chat with selected user
AdminPanel.prototype.startNewChat = function(username) {
    console.log('💬 Starting new chat with:', username);
    
    // Close modal
    this.closeNewChatModal();
    
    // Select user (this will open chat area and show input)
    this.selectChatUser(username);
    
    // Focus on message input
    setTimeout(() => {
        const messageInput = document.getElementById('adminMessageInput');
        if (messageInput) {
            messageInput.focus();
        }
    }, 300);
};

AdminPanel.prototype.getLastMessagePreview = async function(username) {
    // Get last message and unread count for this user
    try {
        const isGuest = username && (username.startsWith('Kullanıcı') || /^Guest/.test(username));
        
        if (window.jbDb) {
            let chatMessages = [];
            
            if (isGuest) {
                // Load guest chat messages
                const { data: guestChatData, error: guestError } = await window.jbDb
                    .from('guest_chats')
                    .select('chat_messages')
                    .eq('username', username)
                    .single();

                if (!guestError && guestChatData && guestChatData.chat_messages) {
                    chatMessages = JSON.parse(guestChatData.chat_messages);
                }
            } else {
                // Load regular user chat messages
                const { data, error } = await window.jbDb
                    .from('users')
                    .select('chat_messages')
                    .eq('username', username)
                    .single();

                if (!error && data && data.chat_messages) {
                    chatMessages = JSON.parse(data.chat_messages);
                }
            }
            
            if (chatMessages.length > 0) {
                const lastMessage = chatMessages[chatMessages.length - 1];
                let messageText = lastMessage.message || lastMessage.content || lastMessage.text || 'Mesaj içeriği bulunamadı';
                
                // Check if message contains image
                const isImageMessage = window.ImageUtils && window.ImageUtils.isImageMessage(messageText);
                if (isImageMessage) {
                    messageText = '[Görsel]';
                } else {
                    // Remove HTML tags and escape special characters
                    const tempDiv = document.createElement('div');
                    tempDiv.textContent = messageText;
                    messageText = tempDiv.textContent || tempDiv.innerText || messageText;
                    // Also remove any remaining HTML entities
                    messageText = messageText.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                    // Remove HTML tags
                    messageText = messageText.replace(/<[^>]*>/g, '');
                }
                
                const preview = messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;
                
                // Count unread messages (adminStatus: 'unread' for user messages)
                const unreadCount = chatMessages.filter(msg => 
                    msg.sender === 'user' && msg.adminStatus === 'unread'
                ).length;
                
                return {
                    preview: preview,
                    unreadCount: unreadCount
                };
            }
        }
        
        // Fallback to localStorage
        if (isGuest) {
            const guestChats = JSON.parse(localStorage.getItem('guestChats') || '{}');
            if (guestChats[username] && guestChats[username].chat_messages) {
                const chatMessages = guestChats[username].chat_messages;
                if (chatMessages.length > 0) {
                    const lastMessage = chatMessages[chatMessages.length - 1];
                    let messageText = lastMessage.message || lastMessage.content || lastMessage.text || 'Mesaj içeriği bulunamadı';
                    
                    // Check if message contains image
                    const isImageMessage = window.ImageUtils && window.ImageUtils.isImageMessage(messageText);
                    if (isImageMessage) {
                        messageText = '[Görsel]';
                    } else {
                        // Remove HTML tags and escape special characters
                        const tempDiv = document.createElement('div');
                        tempDiv.textContent = messageText;
                        messageText = tempDiv.textContent || tempDiv.innerText || messageText;
                        // Also remove any remaining HTML entities
                        messageText = messageText.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                        // Remove HTML tags
                        messageText = messageText.replace(/<[^>]*>/g, '');
                    }
                    
                    const preview = messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;
                    const unreadCount = chatMessages.filter(msg => 
                        msg.sender === 'user' && msg.adminStatus === 'unread'
                    ).length;
                    return {
                        preview: preview,
                        unreadCount: unreadCount
                    };
                }
            }
        } else {
            const messages = JSON.parse(localStorage.getItem('messages') || '[]');
            const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
            const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
            const userMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
            
            const allMessages = [...messages, ...chatMessages, ...globalMessages, ...userMessages];
            const userMessagesFiltered = allMessages.filter(msg => msg.username === username);
            
            if (userMessagesFiltered.length > 0) {
                const lastMessage = userMessagesFiltered[userMessagesFiltered.length - 1];
                let messageText = lastMessage.message || lastMessage.content || lastMessage.text || 'Mesaj içeriği bulunamadı';
                
                // Check if message contains image
                const isImageMessage = window.ImageUtils && window.ImageUtils.isImageMessage(messageText);
                if (isImageMessage) {
                    messageText = '[Görsel]';
                } else {
                    // Remove HTML tags and escape special characters
                    const tempDiv = document.createElement('div');
                    tempDiv.textContent = messageText;
                    messageText = tempDiv.textContent || tempDiv.innerText || messageText;
                    // Also remove any remaining HTML entities
                    messageText = messageText.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                    // Remove HTML tags
                    messageText = messageText.replace(/<[^>]*>/g, '');
                }
                
                const preview = messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;
                
                // Count unread messages from localStorage
                const unreadCount = userMessagesFiltered.filter(msg => 
                    msg.sender === 'user' && (msg.adminStatus === 'unread' || (!msg.adminStatus && msg.status !== 'read'))
                ).length;
                
                return {
                    preview: preview,
                    unreadCount: unreadCount
                };
            }
        }
    } catch (error) {
        console.error('Error getting last message preview:', error);
    }
    return {
        preview: 'Henüz mesaj yok',
        unreadCount: 0
    };
};

AdminPanel.prototype.clearChat = async function() {
    if (!this.selectedChatUser) {
        alert('Lütfen önce bir kullanıcı seçin!');
        return;
    }

    if (!confirm(`${this.selectedChatUser} kullanıcısının tüm sohbet geçmişini silmek istediğinizden emin misiniz?`)) {
        return;
    }

    try {
        console.log('🗑️ Clearing chat for user:', this.selectedChatUser);
        
        // Delete from Supabase first
        if (window.jbDb) {
            console.log('🗑️ Deleting messages from Supabase for:', this.selectedChatUser);
            const { error } = await window.jbDb
                .from('messages')
                .delete()
                .eq('username', this.selectedChatUser);

            if (error) {
                console.error('❌ Error deleting messages from Supabase:', error);
                alert('Supabase\'den mesajlar silinirken hata oluştu: ' + error.message);
                return;
            } else {
                console.log('✅ Messages deleted from Supabase successfully');
            }
        }

        // Delete from localStorage
        console.log('🗑️ Deleting messages from localStorage for:', this.selectedChatUser);
        const messages = JSON.parse(localStorage.getItem('messages') || '[]');
        const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
        const userMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
        
        const filteredMessages = messages.filter(msg => msg.username !== this.selectedChatUser);
        const filteredChatMessages = chatMessages.filter(msg => msg.username !== this.selectedChatUser);
        const filteredGlobalMessages = globalMessages.filter(msg => msg.username !== this.selectedChatUser);
        const filteredUserMessages = userMessages.filter(msg => msg.username !== this.selectedChatUser);
        
        localStorage.setItem('messages', JSON.stringify(filteredMessages));
        localStorage.setItem('chatMessages', JSON.stringify(filteredChatMessages));
        localStorage.setItem('globalMessages', JSON.stringify(filteredGlobalMessages));
        localStorage.setItem('userMessages', JSON.stringify(filteredUserMessages));
        
        console.log('✅ Messages deleted from localStorage successfully');

        // Clear UI
        const chatMessagesArea = document.getElementById('chatMessagesArea');
        if (chatMessagesArea) {
            chatMessagesArea.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                    </svg>
                    <p>Sohbet geçmişi temizlendi</p>
                </div>
            `;
        }

        // Reload chat users to update the list
        await this.loadChatUsers();
        
        // Trigger realtime update for user
        this.triggerRealtimeUpdate(this.selectedChatUser);
        
        alert('✅ Sohbet geçmişi başarıyla temizlendi!');
        
    } catch (error) {
        console.error('❌ Error clearing chat:', error);
        alert('Sohbet temizlenirken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.selectChatUser = function(username) {
    this.selectedChatUser = username;
    this.loadChatMessages(username);
    this.updateSelectedUserInfo(username);
    this.showChatInput();
    document.getElementById('admChatLayout')?.classList.add('has-thread');
    
    // Admin is viewing this user's chat - mark user messages as read
    this.markUserMessagesAsReadByAdmin(username);
};

AdminPanel.prototype.backChatToList = function() {
    document.getElementById('admChatLayout')?.classList.remove('has-thread');
    document.getElementById('selectedUserInfo')?.classList.add('hidden');
    document.getElementById('chatInputArea')?.classList.add('hidden');
    this.selectedChatUser = null;
};

AdminPanel.prototype.updateSelectedUserInfo = function(username) {
    const selectedUserInfo = document.getElementById('selectedUserInfo');
    const selectedUserInitial = document.getElementById('selectedUserInitial');
    const selectedUserName = document.getElementById('selectedUserName');
    const selectedUserStatus = document.getElementById('selectedUserStatus');

    selectedUserInitial.textContent = username.charAt(0).toUpperCase();
    selectedUserName.textContent = username;
    selectedUserStatus.textContent = 'Çevrimiçi';
    selectedUserInfo.classList.remove('hidden');
};

AdminPanel.prototype.showChatInput = function() {
    const chatInputArea = document.getElementById('chatInputArea');
    chatInputArea.classList.remove('hidden');
    document.getElementById('adminMessageInput').focus();
};

AdminPanel.prototype.loadChatMessages = async function(username) {
    console.log('💬 Loading chat messages for:', username);
    try {
        // Check if guest user
        const isGuest = username && username.startsWith('Kullanıcı') && /^\d+$/.test(username.replace('Kullanıcı', ''));
        
        if (window.jbDb) {
            console.log('💬 Using Supabase for chat messages');
            
            if (isGuest) {
                // Load guest chat messages
                const { data: guestChatData, error: guestError } = await window.jbDb
                    .from('guest_chats')
                    .select('chat_messages')
                    .eq('username', username)
                    .single();

                if (!guestError && guestChatData && guestChatData.chat_messages) {
                    const chatMessages = JSON.parse(guestChatData.chat_messages);
                    console.log('✅ Parsed guest chat messages:', chatMessages);
                    this.renderChatMessages(chatMessages);
                    return;
                } else if (guestError && guestError.code === 'PGRST116') {
                    // Guest chat doesn't exist, check localStorage
                    console.log('⚠️ Guest chat not found in Supabase, checking localStorage');
                    this.loadChatMessagesFromLocalStorage(username);
                    return;
                }
            } else {
                // Load regular user chat messages
                const { data, error } = await window.jbDb
                    .from('users')
                    .select('chat_messages')
                    .eq('username', username)
                    .single();

                if (error && error.code === '42703') {
                    console.log('⚠️ chat_messages column does not exist, using messages table');
                    // Fallback to messages table
                    const { data: messagesData, error: messagesError } = await window.jbDb
                        .from('messages')
                        .select('*')
                        .eq('username', username)
                        .order('created_at', { ascending: true });

                    if (messagesError) {
                        console.error('❌ Supabase error loading chat messages:', messagesError);
                        this.loadChatMessagesFromLocalStorage(username);
                        return;
                    }

                    console.log('✅ Messages for', username, 'from messages table:', messagesData);
                    this.renderChatMessages(messagesData);
                    return;
                } else if (error) {
                    console.error('❌ Supabase error loading chat messages:', error);
                    this.loadChatMessagesFromLocalStorage(username);
                    return;
                } else if (data && data.chat_messages) {
                    const chatMessages = JSON.parse(data.chat_messages);
                    console.log('✅ Parsed chat messages:', chatMessages);
                    this.renderChatMessages(chatMessages);
                    return;
                }
            }
            
            console.log('⚠️ No chat messages in Supabase for', username, ', checking localStorage');
            this.loadChatMessagesFromLocalStorage(username);
        } else {
            console.log('💬 Supabase not available, using localStorage');
            this.loadChatMessagesFromLocalStorage(username);
        }
    } catch (error) {
        console.error('❌ Error loading chat messages:', error);
        this.loadChatMessagesFromLocalStorage(username);
    }
};

AdminPanel.prototype.loadChatMessagesFromLocalStorage = function(username) {
    console.log('💬 Loading chat messages from localStorage for:', username);
    
    // Check if guest user
    const isGuest = username && username.startsWith('Kullanıcı') && /^\d+$/.test(username.replace('Kullanıcı', ''));
    
    if (isGuest) {
        // Load guest chat from localStorage
        const guestChats = JSON.parse(localStorage.getItem('guestChats') || '{}');
        if (guestChats[username] && guestChats[username].chat_messages) {
            const chatMessages = guestChats[username].chat_messages;
            console.log('✅ Loaded guest chat messages from localStorage:', chatMessages);
            this.renderChatMessages(chatMessages);
            return;
        }
    }
    
    const messages = JSON.parse(localStorage.getItem('messages') || '[]');
    const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
    const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
    const userMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
    
    console.log('💬 All localStorage data:', {
        messages: messages.length,
        chatMessages: chatMessages.length,
        globalMessages: globalMessages.length,
        userMessages: userMessages.length
    });
    
    const allMessages = [...messages, ...chatMessages, ...globalMessages, ...userMessages];
    console.log('💬 Combined messages:', allMessages);
    
    const userMessagesFiltered = allMessages.filter(msg => msg.username === username);
    console.log('💬 Filtered messages for', username, ':', userMessagesFiltered);
    
    this.renderChatMessages(userMessagesFiltered);
};

// Tarih formatlama utility fonksiyonu - WhatsApp tarzı
AdminPanel.prototype.formatChatDate = function(dateString) {
    if (!dateString) return '';
    
    const messageDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset time to compare only dates
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    // Bugün
    if (messageDateOnly.getTime() === todayOnly.getTime()) {
        return 'Bugün';
    }
    
    // Dün
    if (messageDateOnly.getTime() === yesterdayOnly.getTime()) {
        return 'Dün';
    }
    
    // Son 1 hafta içinde (bugün ve dün hariç)
    const daysDiff = Math.floor((todayOnly - messageDateOnly) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 2 && daysDiff <= 7) {
        // Sadece gün ismi
        const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return dayNames[messageDate.getDay()];
    }
    
    // 1 haftadan eski - tam tarih formatı
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    
    let formattedDate = `${messageDate.getDate()} ${monthNames[messageDate.getMonth()]} ${dayNames[messageDate.getDay()]}`;
    
    // Yılı sadece mevcut yıldan farklıysa ekle
    if (messageDate.getFullYear() !== today.getFullYear()) {
        formattedDate += ` ${messageDate.getFullYear()}`;
    }
    
    return formattedDate;
};

// Tarih karşılaştırma için yardımcı fonksiyon (sadece tarih, saat değil)
AdminPanel.prototype.isSameDate = function(date1, date2) {
    if (!date1 || !date2) return false;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
};

AdminPanel.prototype.renderChatMessages = function(messages) {
    const chatMessagesArea = document.getElementById('chatMessagesArea');
    if (!chatMessagesArea) return;

    if (messages.length === 0) {
        chatMessagesArea.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <p>Henüz mesaj yok</p>
            </div>
        `;
        return;
    }

    let html = '';
    let previousDate = null;
    
    messages.forEach((msg, index) => {
        const msgDate = msg.timestamp || msg.created_at;
        const currentDate = msgDate ? new Date(msgDate).toDateString() : null;
        
        // Tarih değiştiyse tarih ayracı ekle
        if (currentDate && previousDate !== currentDate) {
            const formattedDate = this.formatChatDate(msgDate);
            html += `
                <div class="flex justify-center my-4">
                    <div class="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                        ${formattedDate}
                    </div>
                </div>
            `;
            previousDate = currentDate;
        }
        
        const time = new Date(msgDate).toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Get message content
        const messageContent = msg.message || msg.content || msg.text || 'Mesaj içeriği bulunamadı';
        
        // Check if message contains image
        const isImageMessage = window.ImageUtils && window.ImageUtils.isImageMessage(messageContent);
        const imageData = isImageMessage ? window.ImageUtils.detectImageInMessage(messageContent) : null;
        
        if (msg.sender === 'admin') {
            // Render image message
            if (isImageMessage && imageData) {
                html += `
                    <div class="flex justify-end mb-3 group" data-message-date="${currentDate || ''}" data-message-timestamp="${msgDate || ''}">
                        <div class="max-w-xs">
                            <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onclick="if(window.imageLightbox) window.imageLightbox.open('${imageData.imageUrl.replace(/'/g, "\\'")}', '${imageData.alt.replace(/'/g, "\\'")}')">
                                <img src="${imageData.imageUrl}" alt="${imageData.alt || 'Görsel'}" class="w-full h-auto max-h-48 object-contain" style="max-width: 280px;" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'p-3 text-white text-sm\\'>Görsel yüklenemedi</div>'">
                            </div>
                            ${imageData.alt ? `<div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 text-xs">${imageData.alt}</div>` : ''}
                            <div class="text-xs text-gray-500 mt-1 text-right">Admin • ${time}</div>
                        </div>
                    </div>
                `;
            } else {
                // Regular text message
                html += `
                    <div class="flex justify-end mb-3 group" data-message-date="${currentDate || ''}" data-message-timestamp="${msgDate || ''}">
                        <div class="max-w-xs">
                            <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-2 rounded-lg text-sm">
                                ${messageContent}
                            </div>
                            <div class="text-xs text-gray-500 mt-1 text-right flex items-center justify-end space-x-2">
                                <span>Admin • ${time}</span>
                                <button onclick="adminPanel.deleteMessage(${index})" class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            // User message - check if image
            const isUserImageMessage = window.ImageUtils && window.ImageUtils.isImageMessage(messageContent);
            const userImageData = isUserImageMessage ? window.ImageUtils.detectImageInMessage(messageContent) : null;
            
            if (isUserImageMessage && userImageData) {
                // Render user image message
                html += `
                    <div class="flex justify-start mb-3 group" data-message-date="${currentDate || ''}" data-message-timestamp="${msgDate || ''}">
                        <div class="max-w-xs">
                            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity shadow-sm" onclick="if(window.imageLightbox) window.imageLightbox.open('${userImageData.imageUrl.replace(/'/g, "\\'")}', '${userImageData.alt.replace(/'/g, "\\'")}')">
                                <img src="${userImageData.imageUrl}" alt="${userImageData.alt || 'Görsel'}" class="w-full h-auto max-h-48 object-contain" style="max-width: 280px;" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'p-3 text-gray-700 text-sm\\'>Görsel yüklenemedi</div>'">
                            </div>
                            ${userImageData.alt ? `<div class="bg-white border border-gray-200 px-3 py-1 text-xs">${userImageData.alt}</div>` : ''}
                            <div class="text-xs text-gray-500 mt-1">${msg.username || 'Kullanıcı'} • ${time}</div>
                        </div>
                    </div>
                `;
            } else {
                // Regular user text message
                html += `
                    <div class="flex justify-start mb-3 group" data-message-date="${currentDate || ''}" data-message-timestamp="${msgDate || ''}">
                        <div class="max-w-xs">
                            <div class="bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm shadow-sm">
                                ${messageContent}
                            </div>
                            <div class="text-xs text-gray-500 mt-1 flex items-center space-x-2">
                                <span>${msg.username || 'Kullanıcı'} • ${time}</span>
                                <button onclick="adminPanel.deleteMessage(${index})" class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    });
    
    chatMessagesArea.innerHTML = html;

    // Scroll to bottom
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
    
    // Setup sticky date header with scroll listener
    this.setupStickyDateHeader(chatMessagesArea);
};

// Sticky tarih header için scroll event listener
AdminPanel.prototype.setupStickyDateHeader = function(chatMessagesArea) {
    const dateHeader = document.getElementById('chatDateHeader');
    const dateHeaderText = document.getElementById('chatDateHeaderText');
    
    if (!dateHeader || !dateHeaderText || !chatMessagesArea) return;
    
    // Önceki scroll handler'ı temizle
    if (this.chatScrollHandler) {
        chatMessagesArea.removeEventListener('scroll', this.chatScrollHandler);
    }
    
    // Throttled scroll handler
    let ticking = false;
    this.chatScrollHandler = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                this.updateStickyDateHeader(chatMessagesArea, dateHeader, dateHeaderText);
                ticking = false;
            });
            ticking = true;
        }
    };
    
    chatMessagesArea.addEventListener('scroll', this.chatScrollHandler);
    
    // İlk yüklemede header'ı göster
    this.updateStickyDateHeader(chatMessagesArea, dateHeader, dateHeaderText);
};

// Sticky header'ı görünen mesajların tarihine göre güncelle
AdminPanel.prototype.updateStickyDateHeader = function(chatMessagesArea, dateHeader, dateHeaderText) {
    const messages = chatMessagesArea.querySelectorAll('[data-message-timestamp]');
    if (messages.length === 0) {
        dateHeader.classList.add('hidden');
        return;
    }
    
    // Scroll pozisyonuna göre görünen mesajları bul
    const containerTop = chatMessagesArea.scrollTop;
    const containerHeight = chatMessagesArea.clientHeight;
    const viewportTop = containerTop;
    const viewportBottom = containerTop + containerHeight;
    
    let visibleMessage = null;
    let minDistance = Infinity;
    
    messages.forEach((msgElement) => {
        const rect = msgElement.getBoundingClientRect();
        const containerRect = chatMessagesArea.getBoundingClientRect();
        const elementTop = rect.top - containerRect.top + chatMessagesArea.scrollTop;
        const elementBottom = elementTop + rect.height;
        
        // Mesaj görünür alanda mı?
        if (elementTop <= viewportBottom && elementBottom >= viewportTop) {
            // En üstteki görünen mesajı bul
            const distance = Math.abs(elementTop - viewportTop);
            if (distance < minDistance) {
                minDistance = distance;
                visibleMessage = msgElement;
            }
        }
    });
    
    if (visibleMessage) {
        const timestamp = visibleMessage.getAttribute('data-message-timestamp');
        if (timestamp) {
            try {
                const formattedDate = this.formatChatDate(timestamp);
                dateHeaderText.textContent = formattedDate;
                dateHeader.classList.remove('hidden');
                return;
            } catch (e) {
                console.error('Error formatting date:', e);
            }
        }
    }
    
    // Eğer görünen mesaj bulunamazsa veya en üstteyse header'ı gizle
    if (chatMessagesArea.scrollTop < 50) {
        dateHeader.classList.add('hidden');
    }
};

AdminPanel.prototype.deleteMessage = async function(messageIndex) {
    if (!this.selectedChatUser) {
        alert('Lütfen önce bir kullanıcı seçin!');
        return;
    }

    if (!confirm('Bu mesajı silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        console.log('🗑️ Deleting message at index:', messageIndex);
        
        // Get all messages from localStorage
        const messages = JSON.parse(localStorage.getItem('messages') || '[]');
        const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
        const userMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
        
        const allMessages = [...messages, ...chatMessages, ...globalMessages, ...userMessages];
        const userMessagesFiltered = allMessages.filter(msg => msg.username === this.selectedChatUser);
        const messageToDelete = userMessagesFiltered[messageIndex];
        
        if (!messageToDelete) {
            alert('Mesaj bulunamadı!');
            return;
        }
        
        console.log('🗑️ Message to delete:', messageToDelete);
        
        // Delete from Supabase first
        if (window.jbDb && messageToDelete.id) {
            console.log('🗑️ Deleting message from Supabase with ID:', messageToDelete.id);
            const { error } = await window.jbDb
                .from('messages')
                .delete()
                .eq('id', messageToDelete.id);
                
            if (error) {
                console.error('❌ Error deleting message from Supabase:', error);
                alert('Supabase\'den mesaj silinirken hata oluştu: ' + error.message);
                return;
            } else {
                console.log('✅ Message deleted from Supabase successfully');
            }
        }
        
        // Delete from localStorage
        console.log('🗑️ Deleting message from localStorage');
        const filteredMessages = messages.filter(msg => msg !== messageToDelete);
        const filteredChatMessages = chatMessages.filter(msg => msg !== messageToDelete);
        const filteredGlobalMessages = globalMessages.filter(msg => msg !== messageToDelete);
        const filteredUserMessages = userMessages.filter(msg => msg !== messageToDelete);
        
        localStorage.setItem('messages', JSON.stringify(filteredMessages));
        localStorage.setItem('chatMessages', JSON.stringify(filteredChatMessages));
        localStorage.setItem('globalMessages', JSON.stringify(filteredGlobalMessages));
        localStorage.setItem('userMessages', JSON.stringify(filteredUserMessages));
        
        console.log('✅ Message deleted from localStorage successfully');
        
        // Reload messages
        await this.loadChatMessages(this.selectedChatUser);
        
        // Trigger realtime update for user
        this.triggerRealtimeUpdate(this.selectedChatUser);
        
        alert('✅ Mesaj başarıyla silindi!');
        
    } catch (error) {
        console.error('❌ Error deleting message:', error);
        alert('Mesaj silinirken hata oluştu: ' + error.message);
    }
};

// Message shortcuts configuration
AdminPanel.prototype.messageShortcuts = {
    'Abonelik Ücretleri': '<img src="https://i.ibb.co/prhvYM8J/Abonelik-Ucretleri.png" alt="Abonelik Ücretleri" border="0">',
    'mrhb': 'Merhabalar, umarım iyisinizdir.'
    // İleride buraya daha fazla kısayol eklenebilir
    // Örnek: 'Fiyat Listesi': '<img src="..." alt="Fiyat Listesi" border="0">'
};

AdminPanel.prototype.setupMessageShortcuts = function() {
    const messageInput = document.getElementById('adminMessageInput');
    if (!messageInput) return;
    
    // Create shortcut preview container
    const inputContainer = messageInput.parentElement;
    const previewContainer = document.createElement('div');
    previewContainer.id = 'shortcutPreview';
    previewContainer.className = 'hidden mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm';
    inputContainer.appendChild(previewContainer);
    
    // Listen for input changes
    messageInput.addEventListener('input', (e) => {
        const inputValue = e.target.value.trim();
        this.checkMessageShortcuts(inputValue, previewContainer);
    });
    
    // Clear preview on blur (optional - can be removed if you want preview to stay)
    messageInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.activeElement !== messageInput) {
                previewContainer.classList.add('hidden');
            }
        }, 200);
    });
};

AdminPanel.prototype.checkMessageShortcuts = function(inputValue, previewContainer) {
    // Check if input matches any shortcut
    for (const [shortcut, replacement] of Object.entries(this.messageShortcuts)) {
        if (inputValue === shortcut) {
            // Show preview with confirmation
            previewContainer.innerHTML = `
                <div class="flex items-start space-x-2">
                    <div class="flex-1">
                        <p class="text-blue-800 font-medium mb-1">📋 Kısayol Tespit Edildi!</p>
                        <p class="text-blue-700 text-xs mb-2">"${shortcut}" → HTML görsel kodu</p>
                        <div class="bg-white p-2 rounded border border-blue-300 text-xs font-mono text-gray-700 break-all mb-2">
                            ${replacement}
                        </div>
                        <div class="flex space-x-2">
                            <button id="confirmShortcut" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium">
                                ✅ Kullan
                            </button>
                            <button id="cancelShortcut" class="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-xs font-medium">
                                ❌ İptal
                            </button>
                        </div>
                    </div>
                </div>
            `;
            previewContainer.classList.remove('hidden');
            
            // Setup confirm button
            const confirmBtn = previewContainer.querySelector('#confirmShortcut');
            const cancelBtn = previewContainer.querySelector('#cancelShortcut');
            
            confirmBtn.addEventListener('click', () => {
                const messageInput = document.getElementById('adminMessageInput');
                messageInput.value = replacement;
                previewContainer.classList.add('hidden');
                messageInput.focus();
            });
            
            cancelBtn.addEventListener('click', () => {
                previewContainer.classList.add('hidden');
            });
            
            return;
        }
    }
    
    // No shortcut found, hide preview
    previewContainer.classList.add('hidden');
};

AdminPanel.prototype.sendAdminMessage = async function() {
    const messageInput = document.getElementById('adminMessageInput');
    let message = messageInput.value.trim();
    
    if (!message || !this.selectedChatUser) return;
    
    // Check if message is a shortcut and replace it
    if (this.messageShortcuts[message]) {
        message = this.messageShortcuts[message];
    }

    // Add message to UI immediately
    this.addAdminMessageToUI(message);
    messageInput.value = '';
    
    // Hide shortcut preview if visible
    const previewContainer = document.getElementById('shortcutPreview');
    if (previewContainer) {
        previewContainer.classList.add('hidden');
    }

    // Save to Supabase
    await this.saveAdminMessageToDb(message);
};

AdminPanel.prototype.addAdminMessageToUI = function(message) {
    const chatMessagesArea = document.getElementById('chatMessagesArea');
    const time = new Date().toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Check if message contains image
    const isImageMessage = window.ImageUtils && window.ImageUtils.isImageMessage(message);
    const imageData = isImageMessage ? window.ImageUtils.detectImageInMessage(message) : null;
    
    const messageDiv = document.createElement('div');
    
    if (isImageMessage && imageData) {
        // Render image message
        messageDiv.innerHTML = `
            <div class="flex justify-end mb-3">
                <div class="max-w-xs">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onclick="if(window.imageLightbox) window.imageLightbox.open('${imageData.imageUrl.replace(/'/g, "\\'")}', '${imageData.alt.replace(/'/g, "\\'")}')">
                        <img src="${imageData.imageUrl}" alt="${imageData.alt || 'Görsel'}" class="w-full h-auto max-h-48 object-contain" style="max-width: 280px;" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'p-3 text-white text-sm\\'>Görsel yüklenemedi</div>'">
                    </div>
                    ${imageData.alt ? `<div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 text-xs">${imageData.alt}</div>` : ''}
                    <div class="text-xs text-gray-500 mt-1 text-right">Admin • ${time}</div>
                </div>
            </div>
        `;
    } else {
        // Regular text message
        messageDiv.innerHTML = `
            <div class="flex justify-end mb-3">
                <div class="max-w-xs">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-2 rounded-lg text-sm">
                        ${message}
                    </div>
                    <div class="text-xs text-gray-500 mt-1 text-right">Admin • ${time}</div>
                </div>
            </div>
        `;
    }
    
    chatMessagesArea.appendChild(messageDiv);
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
};

AdminPanel.prototype.saveAdminMessageToDb = async function(message) {
    try {
        if (window.jbDb) {
            console.log('💬 Saving admin message to Supabase:', message);
            
            // Check if guest user
            const isGuest = this.selectedChatUser && this.selectedChatUser.startsWith('Kullanıcı') && /^\d+$/.test(this.selectedChatUser.replace('Kullanıcı', ''));
            
            if (isGuest) {
                // Save to guest_chats table
                const { data: guestChatData, error: guestError } = await window.jbDb
                    .from('guest_chats')
                    .select('chat_messages')
                    .eq('username', this.selectedChatUser)
                    .single();

                let chatMessages = [];
                
                if (guestError && guestError.code === 'PGRST116') {
                    // Guest chat doesn't exist, create new one
                    chatMessages = [{
                        message: message,
                        sender: 'admin',
                        timestamp: new Date().toISOString(),
                        adminStatus: 'sent',
                        userStatus: 'unread'
                    }];
                    
                    const { error: insertError } = await window.jbDb
                        .from('guest_chats')
                        .insert([{
                            username: this.selectedChatUser,
                            ip_address: '0.0.0.0', // Will be updated if needed
                            chat_messages: JSON.stringify(chatMessages),
                            last_chat_update: new Date().toISOString()
                        }]);

                    if (insertError) {
                        console.error('❌ Error creating guest chat:', insertError);
                        this.saveAdminMessageToLocalStorage(message);
                        return;
                    }
                } else if (guestError) {
                    console.error('❌ Error getting guest chat:', guestError);
                    this.saveAdminMessageToLocalStorage(message);
                    return;
                } else {
                    // Guest chat exists, update it
                    chatMessages = guestChatData.chat_messages ? JSON.parse(guestChatData.chat_messages) : [];
                    
                    chatMessages.push({
                        message: message,
                        sender: 'admin',
                        timestamp: new Date().toISOString(),
                        adminStatus: 'sent',
                        userStatus: 'unread'
                    });

                    const { error: updateError } = await window.jbDb
                        .from('guest_chats')
                        .update({
                            chat_messages: JSON.stringify(chatMessages),
                            last_chat_update: new Date().toISOString()
                        })
                        .eq('username', this.selectedChatUser);

                    if (updateError) {
                        console.error('❌ Error updating guest chat:', updateError);
                        this.saveAdminMessageToLocalStorage(message);
                        return;
                    }
                }
                
                console.log('✅ Admin message saved to guest chat successfully');
                this.showAdminNotification(this.selectedChatUser, message);
                return;
            }
            
            // Regular user
            // Get current user's chat messages
            const { data: userData, error: userError } = await window.jbDb
                .from('users')
                .select('chat_messages')
                .eq('username', this.selectedChatUser)
                .single();

            if (userError) {
                console.error('❌ Error getting user chat messages:', userError);
                return;
            }

            // Parse existing chat messages or create new array
            let chatMessages = userData.chat_messages ? JSON.parse(userData.chat_messages) : [];
            
            // Add admin message with new dual status system
            chatMessages.push({
                message: message,
                sender: 'admin',
                timestamp: new Date().toISOString(),
                adminStatus: 'sent',    // Admin gönderdi
                userStatus: 'unread'    // User henüz okumadı
            });

            // Update user's chat messages
            const { error: updateError } = await window.jbDb
                .from('users')
                .update({ 
                    chat_messages: JSON.stringify(chatMessages),
                    last_chat_update: new Date().toISOString()
                })
                .eq('username', this.selectedChatUser);

            if (updateError) {
                console.error('❌ Error updating user chat messages:', updateError);
                // Fallback to localStorage
                this.saveAdminMessageToLocalStorage(message);
            } else {
                console.log('✅ Admin message saved to user chat successfully');
                
                // Show success notification with faster delivery
                this.showAdminNotification(this.selectedChatUser, message);
            }
        } else {
            console.log('💬 Supabase not available, saving to localStorage');
            // Fallback to localStorage
            this.saveAdminMessageToLocalStorage(message);
        }
    } catch (error) {
        console.error('❌ Error saving admin message:', error);
        this.saveAdminMessageToLocalStorage(message);
    }
};

AdminPanel.prototype.saveAdminMessageToLocalStorage = function(message) {
    console.log('💬 Saving admin message to localStorage:', message);
    
    // Check if guest user
    const isGuest = this.selectedChatUser && this.selectedChatUser.startsWith('Kullanıcı') && /^\d+$/.test(this.selectedChatUser.replace('Kullanıcı', ''));
    
    if (isGuest) {
        // Save to guestChats
        const guestChats = JSON.parse(localStorage.getItem('guestChats') || '{}');
        
        if (!guestChats[this.selectedChatUser]) {
            guestChats[this.selectedChatUser] = {
                username: this.selectedChatUser,
                chat_messages: [],
                created_at: new Date().toISOString()
            };
        }

        guestChats[this.selectedChatUser].chat_messages.push({
            message: message,
            sender: 'admin',
            timestamp: new Date().toISOString(),
            adminStatus: 'sent',
            userStatus: 'unread'
        });

        guestChats[this.selectedChatUser].last_chat_update = new Date().toISOString();
        
        localStorage.setItem('guestChats', JSON.stringify(guestChats));
        console.log('✅ Admin message saved to guest chat localStorage');
        this.showAdminNotification(this.selectedChatUser, message);
        return;
    }
    
    const messages = JSON.parse(localStorage.getItem('messages') || '[]');
    messages.push({
        username: this.selectedChatUser,
        message: message,
        sender: 'admin',
        status: 'approved',
        created_at: new Date().toISOString()
    });
    localStorage.setItem('messages', JSON.stringify(messages));
    console.log('✅ Admin message saved to localStorage successfully');
};

AdminPanel.prototype.markUserMessagesAsReadByAdmin = async function(username) {
    if (!username) return;
    
    // Check if guest user
    const isGuest = username && username.startsWith('Kullanıcı') && /^\d+$/.test(username.replace('Kullanıcı', ''));
    
    try {
        console.log('✅ Admin viewing chat - marking user messages as read for:', username, isGuest ? '(guest)' : '');
        
        if (isGuest) {
            // Handle guest user
            if (window.jbDb) {
                const { data: guestChatData, error: guestError } = await window.jbDb
                    .from('guest_chats')
                    .select('chat_messages')
                    .eq('username', username)
                    .single();

                if (!guestError && guestChatData && guestChatData.chat_messages) {
                    let chatMessages = JSON.parse(guestChatData.chat_messages);
                    let hasChanges = false;
                    
                    // Mark all user messages as read by admin
                    chatMessages.forEach(msg => {
                        if (msg.sender === 'user' && msg.adminStatus !== 'read') {
                            msg.adminStatus = 'read'; // Admin okudu
                            hasChanges = true;
                        }
                    });
                    
                    if (hasChanges) {
                        // Update in Supabase
                        await window.jbDb
                            .from('guest_chats')
                            .update({ 
                                chat_messages: JSON.stringify(chatMessages),
                                last_chat_update: new Date().toISOString()
                            })
                            .eq('username', username);
                        
                        console.log('✅ Guest user messages marked as read by admin');
                        
                        // Refresh the chat display
                        this.renderChatMessages(chatMessages);
                    }
                }
            } else {
                // Fallback to localStorage
                const guestChats = JSON.parse(localStorage.getItem('guestChats') || '{}');
                if (guestChats[username] && guestChats[username].chat_messages) {
                    let chatMessages = guestChats[username].chat_messages;
                    let hasChanges = false;
                    
                    chatMessages.forEach(msg => {
                        if (msg.sender === 'user' && msg.adminStatus !== 'read') {
                            msg.adminStatus = 'read';
                            hasChanges = true;
                        }
                    });
                    
                    if (hasChanges) {
                        guestChats[username].chat_messages = chatMessages;
                        guestChats[username].last_chat_update = new Date().toISOString();
                        localStorage.setItem('guestChats', JSON.stringify(guestChats));
                        
                        this.renderChatMessages(chatMessages);
                    }
                }
            }
            return;
        }
        
        // Regular user
        if (!window.jbDb) return;
        
        // Get current messages
        const { data: userData, error: userError } = await window.jbDb
            .from('users')
            .select('chat_messages')
            .eq('username', username)
            .single();

        if (!userError && userData && userData.chat_messages) {
            let chatMessages = JSON.parse(userData.chat_messages);
            let hasChanges = false;
            
            // Mark all user messages as read by admin
            chatMessages.forEach(msg => {
                if (msg.sender === 'user' && msg.adminStatus !== 'read') {
                    msg.adminStatus = 'read'; // Admin okudu
                    hasChanges = true;
                }
            });
            
            if (hasChanges) {
                // Update in Supabase
                await window.jbDb
                    .from('users')
                    .update({ 
                        chat_messages: JSON.stringify(chatMessages),
                        last_chat_update: new Date().toISOString()
                    })
                    .eq('username', username);
                
                console.log('✅ User messages marked as read by admin');
                
                // Refresh the chat display
                this.renderChatMessages(chatMessages);
            }
        }
    } catch (error) {
        console.error('❌ Error marking messages as read:', error);
    }
};

AdminPanel.prototype.showAdminNotification = function(username, message) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.admin-chat-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Show a professional notification
    const notification = document.createElement('div');
    notification.className = 'admin-chat-notification fixed top-4 right-4 bg-gradient-to-r from-green-500 to-blue-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 transform transition-all duration-300 ease-in-out';
    notification.style.transform = 'translateX(100%)';
    notification.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L3 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"></path>
                </svg>
            </div>
            <div>
                <h4 class="font-semibold text-sm">Mesaj Gönderildi!</h4>
                <p class="text-xs opacity-90">${username} kullanıcısına gönderildi</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Add click to open chat tab
    notification.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SVG' && e.target.tagName !== 'PATH') {
            this.switchTab('chat');
            notification.remove();
        }
    });
    
    // Remove notification after 8 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 8000);
    
    // Play notification sound
    this.playAdminNotificationSound();
};

AdminPanel.prototype.playAdminNotificationSound = function() {
    try {
        // Create a different notification sound for admin
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.log('Admin notification sound not supported');
    }
};

// Premium Features Management Functions
AdminPanel.prototype.managePremiumFeatures = async function(username) {
    console.log('⭐ Managing premium features for user:', username);
    
    // Set current user for premium features modal
    this.currentPremiumUser = username;
    
    // Load user's premium features
    await this.loadPremiumFeatures(username);
    
    // Show modal
    const modal = document.getElementById('premiumFeaturesModal');
    if (modal) {
        document.getElementById('premiumFeaturesUsername').textContent = username;
        modal.classList.remove('hidden');
    }
};

AdminPanel.prototype.loadPremiumFeatures = async function(username) {
    try {
        let premiumFeatures = {};
        
        // Try Supabase first
        if (window.jbDb) {
            const { data, error } = await window.jbDb
                .from('users')
                .select('premium_features')
                .eq('username', username)
                .single();
            
            if (!error && data && data.premium_features) {
                premiumFeatures = data.premium_features;
            }
        }
        
        // Define available premium features (ORDERED - imageSearch is 4th)
        const availableFeatures = {
            'autoPaste': 'Otomatik Yapıştır',
            'keyboardShortcuts': 'Klavye Kısayolları',
            'bulkCopy': 'Toplu Kopyalama',
            'imageSearch': 'Görsel Link Arama',
            'stokSayimi': 'Stok Sayımı',
            'lowStockAlert': 'Düşük Stok Uyarısı',
            'urunAjandasi': 'Ürün Ajandası',
            'raftakiEksikler': 'Raftaki Eksikler',
            'getirStockBarcodesExtension': 'Getir Stok Barkodları (Chrome)',
            'darkMode': 'Karanlık Mod',
            'offlineMode': 'Çevrimdışı Mod',
            'advancedFilters': 'Gelişmiş Filtreler',
            'unlimitedHistory': 'Sınırsız Geçmiş',
            'favorites': 'Favoriler'
        };
        
        console.log('🖼️ Loading premium features, available:', Object.keys(availableFeatures));
        console.log('🖼️ imageSearch in list:', 'imageSearch' in availableFeatures);
        
        // Render premium features list
        const featuresList = document.getElementById('premiumFeaturesList');
        if (featuresList) {
            featuresList.innerHTML = '';
            
            // Render each feature
            Object.keys(availableFeatures).forEach(featureKey => {
                const feature = premiumFeatures[featureKey];
                // Support both old format (true/false) and new format ({enabled: true, limit: 3})
                const featureEnabled = typeof feature === 'boolean' 
                    ? feature === true 
                    : (typeof feature === 'object' && feature !== null ? feature.enabled === true : false);
                const featureLimit = typeof feature === 'object' && feature !== null && typeof feature.limit === 'number'
                    ? feature.limit
                    : null;
                const featureName = availableFeatures[featureKey];
                
                console.log(`🖼️ Rendering feature: ${featureKey} - ${featureName} (enabled: ${featureEnabled}, limit: ${featureLimit})`);
                
                const featureItem = document.createElement('div');
                featureItem.className = 'flex flex-col p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3';
                
                // Main row: feature name and toggle
                const mainRow = document.createElement('div');
                mainRow.className = 'flex items-center justify-between';
                mainRow.innerHTML = `
                    <div class="flex-1">
                        <h4 class="text-sm font-medium text-gray-900">${featureName}</h4>
                        <p class="text-xs text-gray-500 mt-1">${this.getFeatureDescription(featureKey)}</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer ml-4">
                        <input type="checkbox" 
                               data-feature="${featureKey}" 
                               class="sr-only peer feature-toggle" 
                               ${featureEnabled ? 'checked' : ''}>
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                `;
                featureItem.appendChild(mainRow);
                
                // Limit input row (only for keyboardShortcuts)
                if (featureKey === 'keyboardShortcuts') {
                    const limitRow = document.createElement('div');
                    limitRow.className = 'flex items-center space-x-3 mt-2 pt-2 border-t border-gray-200';
                    limitRow.innerHTML = `
                        <label class="text-xs font-medium text-gray-700 whitespace-nowrap">
                            İzin Verilen Kısayol Sayısı:
                        </label>
                        <input type="number" 
                               data-feature-limit="${featureKey}" 
                               min="0" 
                               placeholder="Sınırsız için boş bırakın"
                               class="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                               value="${featureLimit !== null ? featureLimit : ''}"
                               ${!featureEnabled ? 'disabled' : ''}>
                        <span class="text-xs text-gray-500">
                            (Boş bırakılırsa sınırsız olur)
                        </span>
                    `;
                    featureItem.appendChild(limitRow);
                    
                    // Enable/disable limit input based on toggle
                    const toggle = mainRow.querySelector('.feature-toggle');
                    const limitInput = limitRow.querySelector(`[data-feature-limit="${featureKey}"]`);
                    toggle.addEventListener('change', (e) => {
                        limitInput.disabled = !e.target.checked;
                        if (!e.target.checked) {
                            limitInput.value = '';
                        }
                    });
                }
                
                featuresList.appendChild(featureItem);
            });
            
            console.log('🖼️ Total features rendered:', featuresList.children.length);
        } else {
            console.error('🖼️ premiumFeaturesList element not found!');
        }
    } catch (error) {
        console.error('Error loading premium features:', error);
        alert('Premium özellikler yüklenirken hata oluştu.');
    }
};

AdminPanel.prototype.getFeatureDescription = function(featureKey) {
    const descriptions = {
        'autoPaste': 'Terminalden kopyalanan barkodları otomatik yapıştırır',
        'keyboardShortcuts': 'Klavye kısayolları ile hızlı erişim',
        'bulkCopy': 'Birden fazla barkodu tek seferde kopyala',
        'imageSearch': 'HTML tablolardan görsel linklerini çıkarıp görsel linkine göre arama yap',
        'stokSayimi': 'Stok sayımı sayfası ve Getir franchise stok senkronizasyonu',
        'lowStockAlert': 'Stok hareketlerine göre eşiğin altına düşen ürünlerde sesli/görsel uyarı ve liste',
        'urunAjandasi': 'Müşteri eksik bildirimlerini takip — gönderim ajandası',
        'raftakiEksikler': 'Depo raflarında eksik ürün takibi — sepet ve cihazlar arası senkron',
        'getirStockBarcodesExtension': 'Franchise sayfasında görsel URL’lerini kopyalayan Chrome eklentisi (ZIP)',
        'darkMode': 'Göz yormayan karanlık tema',
        'offlineMode': 'İnternet olmadan da çalışma',
        'advancedFilters': 'Gelişmiş filtreleme seçenekleri',
        'unlimitedHistory': 'Sınırsız arama geçmişi',
        'favorites': 'Sık kullanılan ürünleri favorilere ekle'
    };
    return descriptions[featureKey] || '';
};

AdminPanel.prototype.savePremiumFeatures = async function() {
    if (!this.currentPremiumUser) {
        alert('Kullanıcı seçilmedi!');
        return;
    }
    
    try {
        // Collect feature states from checkboxes and limit inputs
        const premiumFeatures = {};
        const checkboxes = document.querySelectorAll('#premiumFeaturesList input[type="checkbox"].feature-toggle');
        
        checkboxes.forEach(checkbox => {
            const featureKey = checkbox.dataset.feature;
            if (featureKey) {
                const isEnabled = checkbox.checked;
                
                // For keyboardShortcuts, check if there's a limit input
                if (featureKey === 'keyboardShortcuts') {
                    const limitInput = document.querySelector(`input[data-feature-limit="${featureKey}"]`);
                    const limitValue = limitInput ? limitInput.value.trim() : '';
                    
                    if (limitValue !== '' && !isNaN(limitValue) && parseInt(limitValue) >= 0) {
                        // New format: {enabled: true, limit: 3}
                        premiumFeatures[featureKey] = {
                            enabled: isEnabled,
                            limit: parseInt(limitValue)
                        };
                    } else {
                        // Enabled but no limit (unlimited) or disabled
                        premiumFeatures[featureKey] = isEnabled ? { enabled: true } : false;
                    }
                } else {
                    // Other features: simple boolean (for backward compatibility)
                    premiumFeatures[featureKey] = isEnabled;
                }
            }
        });
        
        // Update in Supabase
        if (window.jbDb) {
            const { data, error } = await window.jbDb
                .from('users')
                .update({ 
                    premium_features: premiumFeatures,
                    updated_at: new Date().toISOString()
                })
                .eq('username', this.currentPremiumUser);
            
            if (error) {
                throw error;
            }
            
            console.log('✅ Premium features updated for:', this.currentPremiumUser);
            
            // Show success message
            alert(`Premium özellikler başarıyla güncellendi. Kullanıcıya bildirim gönderildi ve sayfa otomatik yenilenecek.`);
            
            // Close modal
            document.getElementById('premiumFeaturesModal').classList.add('hidden');
            
            // Reload users to reflect changes
            await this.loadUsers();
            
            // Trigger realtime update for user
            await this.triggerPremiumFeaturesRealtimeUpdate(this.currentPremiumUser);
        } else {
            alert('Supabase bağlantısı yok!');
        }
    } catch (error) {
        console.error('Error saving premium features:', error);
        alert('Premium özellikler kaydedilirken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.triggerPremiumFeaturesRealtimeUpdate = async function(username) {
    if (!window.jbDb) return;
    
    console.log('🔔 Triggering premium features realtime update for:', username);
    
    // Update a timestamp field to trigger realtime subscription
    // Since we're updating premium_features, the realtime subscription should catch it
    // But we can also update updated_at to ensure the change is detected
    try {
        const { error } = await window.jbDb
            .from('users')
            .update({ 
                updated_at: new Date().toISOString()
            })
            .eq('username', username);
        
        if (error) {
            console.error('❌ Error triggering realtime update:', error);
        } else {
            console.log('✅ Premium features realtime update triggered for:', username);
        }
    } catch (error) {
        console.error('❌ Error triggering premium features realtime update:', error);
    }
};

// ==================== CONFIG TAB METHODS ====================

AdminPanel.prototype.loadConfigTab = async function() {
    try {
        console.log('🔄 Loading config tab...');
        
        // ÖNCE: feature-definitions.js'deki tüm özellikleri Supabase'e ekle (eksik olanlar)
        await this.syncFeatureDefinitionsToDb();
        
        // Load system features
        const { data: features, error: featuresError } = await window.jbDb
            .from('system_features')
            .select('*')
            .eq('is_active', true)
            .order('feature_key', { ascending: true });

        if (featuresError) {
            console.error('❌ Error loading system features:', featuresError);
            alert('Özellikler yüklenirken hata oluştu: ' + featuresError.message);
            return;
        }

        // Load scheduled feature changes
        const scheduledChanges = await this.getScheduledFeatureChanges();

        // Store for filtering
        this.configFeatures = features || [];
        this.configScheduledChanges = scheduledChanges;

        // Render table
        this.renderConfigTable();
    } catch (error) {
        console.error('❌ Error loading config tab:', error);
        alert('Config sekmesi yüklenirken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.syncFeatureDefinitionsToDb = async function() {
    try {
        if (!window.jbDb) {
            console.warn('⚠️ Supabase not available, cannot sync feature definitions');
            return;
        }

        if (!window.getAllFeatureDefinitions) {
            console.warn('⚠️ getAllFeatureDefinitions not available');
            return;
        }

        const definitions = window.getAllFeatureDefinitions();
        console.log('🔄 Syncing feature definitions to Supabase...', Object.keys(definitions).length, 'features');

        // Mevcut özellikleri getir
        const { data: existingFeatures, error: fetchError } = await window.jbDb
            .from('system_features')
            .select('feature_key');

        if (fetchError) {
            console.error('❌ Error fetching existing features:', fetchError);
            return;
        }

        const existingKeys = new Set((existingFeatures || []).map(f => f.feature_key));
        const featuresToInsert = [];

        // Her definition için kontrol et
        for (const [featureKey, definition] of Object.entries(definitions)) {
            if (!existingKeys.has(featureKey)) {
                // Supabase'de yok, ekle
                featuresToInsert.push({
                    feature_key: featureKey,
                    feature_name: definition.name,
                    current_value: definition.defaultValue,
                    default_value: definition.defaultValue,
                    value_type: definition.valueType,
                    description: definition.description || null,
                    is_active: true
                });
                console.log(`➕ Will insert feature: ${featureKey} (${definition.name})`);
            }
        }

        // Eksik özellikleri ekle
        if (featuresToInsert.length > 0) {
            const { error: insertError } = await window.jbDb
                .from('system_features')
                .insert(featuresToInsert);

            if (insertError) {
                console.error('❌ Error inserting features:', insertError);
                alert(`⚠️ ${featuresToInsert.length} özellik eklenirken hata oluştu: ${insertError.message}`);
            } else {
                console.log(`✅ Successfully inserted ${featuresToInsert.length} features to Supabase`);
            }
        } else {
            console.log('✅ All features already exist in Supabase');
        }
    } catch (error) {
        console.error('❌ Error syncing feature definitions:', error);
    }
};

AdminPanel.prototype.getScheduledFeatureChanges = async function() {
    try {
        const now = new Date().toISOString();
        
        // Get scheduled updates (is_active = false, scheduled_at > now)
        const { data: scheduledUpdates, error } = await window.jbDb
            .from('updates')
            .select('update_number, scheduled_at, feature_changes')
            .eq('is_active', false)
            .gt('scheduled_at', now)
            .order('scheduled_at', { ascending: true });

        if (error) {
            console.error('❌ Error loading scheduled updates:', error);
            return {};
        }

        // Create a map: feature_key -> { update_number, scheduled_at, new_value }
        const changesMap = {};
        
        if (scheduledUpdates) {
            for (const update of scheduledUpdates) {
                if (update.feature_changes && Array.isArray(update.feature_changes)) {
                    for (const change of update.feature_changes) {
                        if (change.feature_key) {
                            changesMap[change.feature_key] = {
                                update_number: update.update_number,
                                scheduled_at: update.scheduled_at,
                                new_value: change.new_value
                            };
                        }
                    }
                }
            }
        }

        return changesMap;
    } catch (error) {
        console.error('❌ Error getting scheduled feature changes:', error);
        return {};
    }
};

AdminPanel.prototype.renderConfigTable = function() {
    const tbody = document.getElementById('configTableBody');
    if (!tbody) return;

    // Hem Supabase'deki hem de feature-definitions.js'deki özellikleri birleştir
    const allFeatures = this.mergeFeaturesWithDefinitions();

    if (!allFeatures || allFeatures.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">Özellik bulunamadı</td></tr>';
        return;
    }

    tbody.innerHTML = allFeatures.map(feature => {
        const scheduledChange = this.configScheduledChanges[feature.feature_key];
        const scheduledInfo = scheduledChange 
            ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800" title="v ${scheduledChange.update_number} - ${new Date(scheduledChange.scheduled_at).toLocaleString('tr-TR')}">
                📅 v ${scheduledChange.update_number}
              </span>`
            : '<span class="text-gray-400">-</span>';

        // Eğer Supabase'de yoksa, uyarı göster
        const notInDb = feature._from_definition ? '<div class="text-xs text-orange-600 font-medium mt-1">⚠️ Supabase\'de yok</div>' : '';

        // Format value based on type
        const formatValue = (value, type) => {
            if (value === null || value === undefined) return '-';
            if (type === 'boolean') {
                return value ? '<span class="text-green-600 font-medium">✓ True</span>' : '<span class="text-red-600 font-medium">✗ False</span>';
            }
            if (type === 'object') {
                return '<code class="text-xs bg-gray-100 px-2 py-1 rounded">' + JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '') + '</code>';
            }
            return String(value);
        };

        const lastUpdated = feature.updated_at 
            ? new Date(feature.updated_at).toLocaleString('tr-TR')
            : '-';

        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <code class="text-sm font-mono text-gray-900">${feature.feature_key}</code>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${feature.feature_name}</div>
                    ${feature.description ? `<div class="text-xs text-gray-500">${feature.description}</div>` : ''}
                    ${notInDb}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${
                        feature.value_type === 'boolean' ? 'bg-purple-100 text-purple-800' :
                        feature.value_type === 'number' ? 'bg-blue-100 text-blue-800' :
                        feature.value_type === 'string' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                    }">${feature.value_type}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${formatValue(feature.default_value, feature.value_type)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${formatValue(feature.current_value, feature.value_type)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${lastUpdated}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    ${scheduledInfo}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="adminPanel.openEditFeatureModal('${feature.feature_key}')" 
                            class="text-blue-600 hover:text-blue-900">
                        Düzenle
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

AdminPanel.prototype.mergeFeaturesWithDefinitions = function() {
    // Supabase'deki özellikler
    const dbFeatures = this.configFeatures || [];
    const dbKeys = new Set(dbFeatures.map(f => f.feature_key));

    // feature-definitions.js'deki tüm özellikler
    const definitions = window.getAllFeatureDefinitions?.() || {};
    const allFeatures = [...dbFeatures];

    // feature-definitions.js'de olup Supabase'de olmayanları ekle
    for (const [featureKey, definition] of Object.entries(definitions)) {
        if (!dbKeys.has(featureKey)) {
            // Supabase'de yok, definition'dan oluştur
            allFeatures.push({
                feature_key: featureKey,
                feature_name: definition.name,
                current_value: definition.defaultValue,
                default_value: definition.defaultValue,
                value_type: definition.valueType,
                description: definition.description || null,
                is_active: true,
                created_at: null,
                updated_at: null,
                _from_definition: true // Flag: Supabase'de henüz yok
            });
        }
    }

    return allFeatures.sort((a, b) => a.feature_key.localeCompare(b.feature_key));
};

AdminPanel.prototype.filterConfigTable = function(searchTerm) {
    if (!this.configFeatures) return;
    
    const tbody = document.getElementById('configTableBody');
    if (!tbody) return;

    if (!searchTerm || searchTerm.trim() === '') {
        // No filter, show all
        this.renderConfigTable();
        return;
    }

    // Merge features with definitions first
    const allFeatures = this.mergeFeaturesWithDefinitions();
    const filtered = allFeatures.filter(feature => {
        const term = searchTerm.toLowerCase();
        return feature.feature_key.toLowerCase().includes(term) ||
               feature.feature_name.toLowerCase().includes(term) ||
               (feature.description && feature.description.toLowerCase().includes(term));
    });

    // Render filtered results
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">Arama sonucu bulunamadı</td></tr>';
        return;
    }

    // Temporarily store filtered features for rendering
    const originalFeatures = this.configFeatures;
    this.configFeatures = filtered;
    this.renderConfigTable();
    this.configFeatures = originalFeatures;
};

AdminPanel.prototype.openEditFeatureModal = async function(featureKey) {
    try {
        // Find feature (hem Supabase'deki hem de definition'daki)
        const allFeatures = this.mergeFeaturesWithDefinitions();
        const feature = allFeatures.find(f => f.feature_key === featureKey);
        
        if (!feature) {
            alert('Özellik bulunamadı!');
            return;
        }

        // Eğer Supabase'de yoksa, önce ekle
        if (feature._from_definition) {
            console.log(`➕ Feature ${featureKey} not in Supabase, inserting...`);
            await this.syncFeatureDefinitionsToDb();
            // Reload to get the newly inserted feature
            await this.loadConfigTab();
            // Find again after reload
            const reloadedFeatures = this.mergeFeaturesWithDefinitions();
            const reloadedFeature = reloadedFeatures.find(f => f.feature_key === featureKey);
            if (reloadedFeature) {
                // Use reloaded feature
                Object.assign(feature, reloadedFeature);
            }
        }

        // Populate modal
        document.getElementById('editFeatureKey').value = feature.feature_key;
        document.getElementById('editFeatureKeyDisplay').value = feature.feature_key;
        document.getElementById('editFeatureName').value = feature.feature_name;
        document.getElementById('editFeatureType').value = feature.value_type;
        document.getElementById('editFeatureDescription').value = feature.description || '';

        // Create dynamic inputs based on value type
        const defaultContainer = document.getElementById('editDefaultValueContainer');
        const currentContainer = document.getElementById('editCurrentValueContainer');

        defaultContainer.innerHTML = this.createValueInput('editDefaultValue', feature.value_type, feature.default_value);
        currentContainer.innerHTML = this.createValueInput('editCurrentValue', feature.value_type, feature.current_value);

        // Show modal
        document.getElementById('editFeatureModal').classList.remove('hidden');
    } catch (error) {
        console.error('❌ Error opening edit feature modal:', error);
        alert('Modal açılırken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.createValueInput = function(inputId, valueType, currentValue) {
    switch (valueType) {
        case 'boolean':
            return `
                <label class="flex items-center space-x-3">
                    <input type="checkbox" id="${inputId}" 
                           ${currentValue === true ? 'checked' : ''}
                           class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                    <span class="text-sm text-gray-700">${currentValue === true ? 'True (Aktif)' : 'False (Pasif)'}</span>
                </label>
            `;
        case 'number':
            return `
                <input type="number" id="${inputId}" 
                       value="${currentValue}" 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
            `;
        case 'string':
            return `
                <input type="text" id="${inputId}" 
                       value="${String(currentValue)}" 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
            `;
        case 'object':
            return `
                <textarea id="${inputId}" 
                          rows="6" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500">${JSON.stringify(currentValue, null, 2)}</textarea>
                <p class="text-xs text-gray-500 mt-1">JSON formatında girin</p>
            `;
        default:
            return `<input type="text" id="${inputId}" value="${String(currentValue)}" class="w-full px-3 py-2 border border-gray-300 rounded-md">`;
    }
};

AdminPanel.prototype.updateFeatureValue = async function() {
    try {
        const featureKey = document.getElementById('editFeatureKey').value;
        const valueType = document.getElementById('editFeatureType').value;

        // Get values from inputs
        let newDefaultValue, newCurrentValue;

        if (valueType === 'boolean') {
            newDefaultValue = document.getElementById('editDefaultValue').checked;
            newCurrentValue = document.getElementById('editCurrentValue').checked;
        } else if (valueType === 'number') {
            newDefaultValue = parseFloat(document.getElementById('editDefaultValue').value);
            newCurrentValue = parseFloat(document.getElementById('editCurrentValue').value);
            if (isNaN(newDefaultValue) || isNaN(newCurrentValue)) {
                alert('Geçerli bir sayı girin!');
                return;
            }
        } else if (valueType === 'string') {
            newDefaultValue = document.getElementById('editDefaultValue').value;
            newCurrentValue = document.getElementById('editCurrentValue').value;
        } else if (valueType === 'object') {
            try {
                newDefaultValue = JSON.parse(document.getElementById('editDefaultValue').value);
                newCurrentValue = JSON.parse(document.getElementById('editCurrentValue').value);
            } catch (e) {
                alert('Geçerli bir JSON formatı girin!');
                return;
            }
        } else {
            alert('Bilinmeyen değer tipi!');
            return;
        }

        // Get current feature to compare
        const feature = this.configFeatures.find(f => f.feature_key === featureKey);
        if (!feature) {
            alert('Özellik bulunamadı!');
            return;
        }

        // Update system_features
        const { error: updateError } = await window.jbDb
            .from('system_features')
            .update({
                default_value: newDefaultValue,
                current_value: newCurrentValue,
                updated_at: new Date().toISOString()
            })
            .eq('feature_key', featureKey);

        if (updateError) {
            console.error('❌ Error updating feature:', updateError);
            alert('Özellik güncellenirken hata oluştu: ' + updateError.message);
            return;
        }

        // Save to feature_history if current_value changed
        if (window.featureManager && !window.featureManager.valuesEqual(feature.current_value, newCurrentValue)) {
            const adminUser = document.getElementById('adminUser')?.textContent || 'admin';
            await window.featureManager.saveFeatureHistory(
                featureKey,
                feature.current_value,
                newCurrentValue,
                null, // update_number = null for manual changes
                adminUser
            );
        }

        // Close modal
        document.getElementById('editFeatureModal').classList.add('hidden');

        // Reload config tab
        await this.loadConfigTab();

        alert('✅ Özellik başarıyla güncellendi!');
    } catch (error) {
        console.error('❌ Error updating feature value:', error);
        alert('Özellik güncellenirken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.initProductImportTab = function() {
    // Analyze button
    const analyzeBtn = document.getElementById('analyzeProductsBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            await this.analyzeProducts();
        });
    }

    // Clear input button
    const clearBtn = document.getElementById('clearInputBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.getElementById('htmlTableInput').value = '';
            document.getElementById('analysisResults').classList.add('hidden');
        });
    }

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('#analysisResultsBody input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });
    }

    // Select all new products button
    const selectAllNewBtn = document.getElementById('selectAllNewBtn');
    if (selectAllNewBtn) {
        selectAllNewBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#analysisResultsBody tr[data-status="new"] input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
        });
    }

    // Deselect all button
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#analysisResultsBody input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
        });
    }

    // Add selected products button
    const addSelectedBtn = document.getElementById('addSelectedProductsBtn');
    if (addSelectedBtn) {
        addSelectedBtn.addEventListener('click', async () => {
            await this.addSelectedProducts();
        });
    }

    // Export all products button
    const exportAllBtn = document.getElementById('exportAllProductsBtn');
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', () => {
            this.exportAllProducts();
        });
    }

    // Clear all results button
    const clearAllBtn = document.getElementById('clearAllResultsBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Tüm analiz sonuçlarını temizlemek istediğinizden emin misiniz?')) {
                window.productImporter.clearAllAnalysisResults();
                document.getElementById('analysisResults').classList.add('hidden');
                document.getElementById('htmlTableInput').value = '';
                alert('✅ Tüm analiz sonuçları temizlendi!');
            }
        });
    }

    // Barcode search input (debounce)
    const barcodeSearchInput = document.getElementById('barcodeSearchInput');
    if (barcodeSearchInput) {
        barcodeSearchInput.addEventListener('input', (e) => {
            clearTimeout(window.productImporter.searchDebounceTimer);
            window.productImporter.searchDebounceTimer = setTimeout(() => {
                this.searchBarcode(e.target.value);
            }, 300);
        });
    }

    // Products.json file input
    const selectProductsJsonBtn = document.getElementById('selectProductsJsonBtn');
    const productsJsonFileInput = document.getElementById('productsJsonFileInput');
    if (selectProductsJsonBtn && productsJsonFileInput) {
        selectProductsJsonBtn.addEventListener('click', () => {
            productsJsonFileInput.click();
        });

        productsJsonFileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const fileName = e.target.files[0].name;
                const fileNameSpan = document.getElementById('productsJsonFileName');
                if (fileNameSpan) {
                    fileNameSpan.textContent = `⏳ ${fileName} yükleniyor...`;
                }
                
                try {
                    await window.productImporter.loadProductsJSON(e.target);
                    if (fileNameSpan) {
                        fileNameSpan.textContent = `✅ ${fileName} yüklendi`;
                    }
                    // Cache'i zorla yenile (bir sonraki karşılaştırmada güncel veri kullanılsın)
                    window.productImporter.productsCacheTimestamp = null;
                    alert('✅ Products.json başarıyla yüklendi! Artık "Products.json ile Karşılaştır" butonunu kullanarak karşılaştırma yapabilirsiniz.');
                } catch (error) {
                    console.error('Error loading file:', error);
                    if (fileNameSpan) {
                        fileNameSpan.textContent = `❌ Hata: ${error.message}`;
                    }
                    alert('❌ Dosya yüklenirken hata oluştu: ' + error.message);
                }
            }
        });
    }

    // Getir API'den ürün çekme butonu
    const fetchAllProductsBtn = document.getElementById('fetchAllProductsBtn');
    if (fetchAllProductsBtn) {
        fetchAllProductsBtn.addEventListener('click', async () => {
            await this.fetchAllProductsFromGetir();
        });
    }

    // Yavaş mod checkbox'ı için ayarlar bölümünü göster/gizle
    const slowModeCheckbox = document.getElementById('slowModeCheckbox');
    const slowModeSettings = document.getElementById('slowModeSettings');
    if (slowModeCheckbox && slowModeSettings) {
        slowModeCheckbox.addEventListener('change', () => {
            if (slowModeCheckbox.checked) {
                slowModeSettings.classList.remove('hidden');
            } else {
                slowModeSettings.classList.add('hidden');
            }
        });
    }
    
    // Warehouse raf etiketlerini çekme butonu
    const fetchShelfLabelsBtn = document.getElementById('fetchShelfLabelsBtn');
    if (fetchShelfLabelsBtn) {
        fetchShelfLabelsBtn.addEventListener('click', async () => {
            try {
                await window.productImporter.fetchShelfLabelsFromWarehouse();
            } catch (error) {
                console.error('Error fetching shelf labels from Warehouse:', error);
                alert('Raf etiketleri çekilemedi: ' + error.message);
            }
        });
    }
    
    // Manuel HTML modal butonları
    const openManualHtmlModalBtn = document.getElementById('openManualHtmlModalBtn');
    const closeManualHtmlModal = document.getElementById('closeManualHtmlModal');
    const cancelManualHtml = document.getElementById('cancelManualHtml');
    const analyzeManualHtmlBtn = document.getElementById('analyzeManualHtml');
    
    if (openManualHtmlModalBtn) {
        openManualHtmlModalBtn.addEventListener('click', () => {
            window.productImporter.openManualHtmlModal(null);
        });
    }
    
    if (closeManualHtmlModal) {
        closeManualHtmlModal.addEventListener('click', () => {
            const modal = document.getElementById('manualHtmlModal');
            if (modal) {
                modal.classList.add('hidden');
            }
        });
    }
    
    if (cancelManualHtml) {
        cancelManualHtml.addEventListener('click', () => {
            const modal = document.getElementById('manualHtmlModal');
            if (modal) {
                modal.classList.add('hidden');
            }
        });
    }
    
    if (analyzeManualHtmlBtn) {
        analyzeManualHtmlBtn.addEventListener('click', async () => {
            const htmlContent = document.getElementById('manualHtmlContent').value.trim();
            const pageNumber = parseInt(document.getElementById('manualHtmlPageNumber').value);
            
            if (!htmlContent) {
                alert('Lütfen HTML içeriğini girin.');
                return;
            }
            
            if (!pageNumber || isNaN(pageNumber) || pageNumber < 1) {
                alert('Lütfen geçerli bir sayfa numarası girin.');
                return;
            }
            
            try {
                await window.productImporter.analyzeManualHtml(htmlContent, pageNumber);
                
                // Modal'ı kapat
                const modal = document.getElementById('manualHtmlModal');
                if (modal) {
                    modal.classList.add('hidden');
                }
                
                // Formu temizle
                document.getElementById('manualHtmlContent').value = '';
                document.getElementById('manualHtmlPageNumber').value = '';
                
                alert(`✅ Sayfa ${pageNumber} başarıyla analiz edildi ve eklendi!`);
            } catch (error) {
                console.error('Error analyzing manual HTML:', error);
                alert('HTML analiz edilemedi: ' + error.message);
            }
        });
    }

    // Warehouse raf etiketlerini indirme butonu
    const downloadShelfLabelsBtn = document.getElementById('downloadShelfLabelsBtn');
    if (downloadShelfLabelsBtn) {
        downloadShelfLabelsBtn.addEventListener('click', () => {
            try {
                window.productImporter.downloadShelfLabelsJSON();
                alert('✅ Raf etiketleri JSON olarak indirildi!');
            } catch (error) {
                console.error('Error downloading shelf labels:', error);
                alert('❌ İndirme hatası: ' + error.message);
            }
        });
    }
    
    // Warehouse verisini direkt products.json'a aktar butonu
    const importWarehouseToProductsBtn = document.getElementById('importWarehouseToProductsBtn');
    if (importWarehouseToProductsBtn) {
        importWarehouseToProductsBtn.addEventListener('click', async () => {
            try {
                await window.productImporter.importWarehouseToProducts();
            } catch (error) {
                console.error('Error importing warehouse to products:', error);
                alert('❌ Aktarım hatası: ' + error.message);
            }
        });
    }
    
    // Temp Products güncelle butonu
    const updateTempProductsBtn = document.getElementById('updateTempProductsBtn');
    if (updateTempProductsBtn) {
        updateTempProductsBtn.addEventListener('click', async () => {
            try {
                await window.productImporter.updateTempProducts();
            } catch (error) {
                console.error('Error updating temp products:', error);
                alert('❌ Temp products güncelleme hatası: ' + error.message);
            }
        });
    }

    // Warehouse raf etiketlerini karşılaştırma butonu
    const compareShelfLabelsBtn = document.getElementById('compareShelfLabelsBtn');
    if (compareShelfLabelsBtn) {
        compareShelfLabelsBtn.addEventListener('click', async () => {
            try {
                const result = await window.productImporter.compareShelfLabelsWithProducts();
                // Alert artık gerekli değil, sonuçlar sayfanın altında gösteriliyor
            } catch (error) {
                console.error('Error comparing shelf labels:', error);
                alert('❌ Karşılaştırma hatası: ' + error.message);
            }
        });
    }

    // Manuel raf etiketi dosyası seçme
    const selectManualShelfLabelBtn = document.getElementById('selectManualShelfLabelBtn');
    const manualShelfLabelFileInput = document.getElementById('manualShelfLabelFileInput');
    const manualShelfLabelFileName = document.getElementById('manualShelfLabelFileName');
    
    if (selectManualShelfLabelBtn && manualShelfLabelFileInput) {
        selectManualShelfLabelBtn.addEventListener('click', () => {
            manualShelfLabelFileInput.click();
        });
        
        manualShelfLabelFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                manualShelfLabelFileName.textContent = file.name;
                const text = await file.text();
                const data = JSON.parse(text);
                
                // Products.json formatında mı kontrol et
                let products = [];
                if (data.products && Array.isArray(data.products)) {
                    products = data.products;
                } else if (Array.isArray(data)) {
                    products = data;
                } else {
                    throw new Error('Geçersiz JSON formatı. Products.json formatında olmalı.');
                }
                
                // Manuel dosyayı hafızada tut
                window.productImporter.manualShelfLabels = products;
                
                // Otomatik karşılaştırma yapma, sadece dosyayı yükle
                // Kullanıcı "Karşılaştır" butonuna tıklayarak karşılaştırma yapabilir
                alert(`✅ ${products.length} ürün yüklendi! Şimdi "Products.json ile Karşılaştır" butonuna tıklayarak karşılaştırma yapabilirsiniz.`);
            } catch (error) {
                console.error('Error loading manual shelf label file:', error);
                alert('❌ Dosya yükleme hatası: ' + error.message);
                manualShelfLabelFileName.textContent = 'JSON dosyası seçin';
                window.productImporter.manualShelfLabels = null;
            }
        });
    }

    // Karşılaştırma sonuçları - Tümünü seç/Kaldır
    const selectAllMissingBtn = document.getElementById('selectAllMissingBtn');
    const deselectAllMissingBtn = document.getElementById('deselectAllMissingBtn');
    
    if (selectAllMissingBtn) {
        selectAllMissingBtn.addEventListener('click', () => {
            document.querySelectorAll('.missing-product-checkbox').forEach(cb => cb.checked = true);
        });
    }
    
    if (deselectAllMissingBtn) {
        deselectAllMissingBtn.addEventListener('click', () => {
            document.querySelectorAll('.missing-product-checkbox').forEach(cb => cb.checked = false);
        });
    }

    // Seçili ürünleri ekle butonu
    const addSelectedProductsBtn = document.getElementById('addSelectedProductsBtn');
    if (addSelectedProductsBtn) {
        addSelectedProductsBtn.addEventListener('click', async () => {
            try {
                await window.productImporter.addSelectedProductsToJSON();
            } catch (error) {
                console.error('Error adding selected products:', error);
                alert('❌ Ürün ekleme hatası: ' + error.message);
            }
        });
    }
    
    // Güncelleme için JSON kopyala butonu
    const copyProductsForUpdateBtn = document.getElementById('copyProductsForUpdateBtn');
    if (copyProductsForUpdateBtn) {
        copyProductsForUpdateBtn.addEventListener('click', async () => {
            try {
                const jsonString = window.productImporter.exportSelectedProductsAsJSON();
                
                // Clipboard'a kopyala
                await navigator.clipboard.writeText(jsonString);
                
                // Başarı mesajı göster
                const originalText = copyProductsForUpdateBtn.textContent;
                copyProductsForUpdateBtn.textContent = '✅ Kopyalandı!';
                copyProductsForUpdateBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                copyProductsForUpdateBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                
                setTimeout(() => {
                    copyProductsForUpdateBtn.textContent = originalText;
                    copyProductsForUpdateBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                    copyProductsForUpdateBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                }, 2000);
                
                alert(`✅ Başarılı!\n\n${JSON.parse(jsonString).products.length} ürün JSON formatında kopyalandı.\n\nGüncelleme adımının açıklama alanına yapıştırabilirsiniz.`);
            } catch (error) {
                console.error('Error copying products JSON:', error);
                alert('❌ Kopyalama hatası: ' + error.message);
            }
        });
    }

    // Karşılaştırma sonuçlarını kapat
    const closeComparisonResultsBtn = document.getElementById('closeComparisonResultsBtn');
    if (closeComparisonResultsBtn) {
        closeComparisonResultsBtn.addEventListener('click', () => {
            const resultsDiv = document.getElementById('shelfLabelComparisonResults');
            if (resultsDiv) {
                resultsDiv.classList.add('hidden');
            }
        });
    }

    // JSON indirme butonu
    const downloadProductsJSONBtn = document.getElementById('downloadProductsJSONBtn');
    if (downloadProductsJSONBtn) {
        downloadProductsJSONBtn.addEventListener('click', () => {
            try {
                window.productImporter.downloadProductsAsJSON();
                alert('✅ Ürünler JSON olarak indirildi!');
            } catch (error) {
                alert('❌ İndirme hatası: ' + error.message);
            }
        });
    }

    // Eksik ürünleri bul butonu
    const analyzeFetchedProductsBtn = document.getElementById('analyzeFetchedProductsBtn');
    if (analyzeFetchedProductsBtn) {
        analyzeFetchedProductsBtn.addEventListener('click', async () => {
            await this.findMissingProductsFromGetir();
        });
    }
};

AdminPanel.prototype.analyzeProducts = async function() {
    try {
        const htmlContent = document.getElementById('htmlTableInput').value.trim();
        if (!htmlContent) {
            alert('Lütfen HTML tablo verisini girin!');
            return;
        }

        const analyzeBtn = document.getElementById('analyzeProductsBtn');
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '⏳ Analiz ediliyor...';

        const results = await window.productImporter.analyzeProducts(htmlContent);

        // Sonuçları göster
        this.renderAnalysisResults(results);

        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '🔍 Analiz Et';
    } catch (error) {
        console.error('❌ Error analyzing products:', error);
        alert('Analiz sırasında hata oluştu: ' + error.message);
        const analyzeBtn = document.getElementById('analyzeProductsBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🔍 Analiz Et';
        }
    }
};

AdminPanel.prototype.renderAnalysisResults = function(results) {
    const tbody = document.getElementById('analysisResultsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    // Counts
    const newCountEl = document.getElementById('newProductsCount');
    const existingCountEl = document.getElementById('existingProductsCount');
    const errorCountEl = document.getElementById('errorProductsCount');
    
    if (newCountEl) newCountEl.textContent = `${results.new.length} yeni ürün`;
    if (existingCountEl) existingCountEl.textContent = `${results.existing.length} zaten var (gösterilmiyor)`;
    if (errorCountEl) errorCountEl.textContent = `${results.errors.length} hata`;

    // New products (sadece yeni ürünleri göster)
    results.new.forEach((product, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-status', 'new');
        row.className = 'bg-green-50';
        row.innerHTML = `
            <td class="px-4 py-3">
                <input type="checkbox" class="product-checkbox rounded" data-index="${index}" data-type="new">
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Yeni</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">${product.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${product.barcodes[0]?.code || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${product.category || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${product.brand || '-'}</td>
        `;
        tbody.appendChild(row);
    });

    // Existing products - GÖSTERME (kullanıcı istemedi)
    // Sadece sayı olarak gösteriliyor

    // Errors
    results.errors.forEach((item) => {
        const row = document.createElement('tr');
        row.setAttribute('data-status', 'error');
        row.className = 'bg-red-50';
        row.innerHTML = `
            <td class="px-4 py-3"></td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Hata</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">${item.product.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-900">-</td>
            <td class="px-4 py-3 text-sm text-gray-900">-</td>
            <td class="px-4 py-3 text-sm text-red-600">${item.error}</td>
        `;
        tbody.appendChild(row);
    });

    // Show results
    const resultsDiv = document.getElementById('analysisResults');
    if (resultsDiv) {
        resultsDiv.classList.remove('hidden');
    }
};

AdminPanel.prototype.addSelectedProducts = async function() {
    try {
        const checkboxes = document.querySelectorAll('#analysisResultsBody tr[data-status="new"] input.product-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Lütfen eklemek istediğiniz ürünleri seçin!');
            return;
        }

        const addBtn = document.getElementById('addSelectedProductsBtn');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = '⏳ Ekleniyor...';
        }

        const selectedProducts = [];
        checkboxes.forEach(cb => {
            const index = parseInt(cb.dataset.index);
            if (window.productImporter.analysisResults && window.productImporter.analysisResults.new) {
                selectedProducts.push(window.productImporter.analysisResults.new[index]);
            }
        });

        // Hafızaya ekle (dosya indirme yok)
        const result = window.productImporter.addProductsToMemory(selectedProducts);

        alert(`✅ ${selectedProducts.length} ürün hafızaya eklendi!\n\nToplam hafızadaki ürün sayısı: ${result.totalInMemory}\n\nTüm ürünleri dışa aktarmak için "Tümünü Dışa Aktar" butonunu kullanın.`);

        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = '✅ Seçili Ürünleri Hafızaya Ekle';
        }
    } catch (error) {
        console.error('❌ Error adding products:', error);
        alert('Ürünler eklenirken hata oluştu: ' + error.message);
        const addBtn = document.getElementById('addSelectedProductsBtn');
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = '✅ Seçili Ürünleri Hafızaya Ekle';
        }
    }
};

AdminPanel.prototype.exportAllProducts = function() {
    try {
        const allData = window.productImporter.getAllProductsFromMemory();

        // Yedekleme oluştur
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupData = JSON.stringify({ products: window.productImporter.productsCache }, null, 2);
        const backupBlob = new Blob([backupData], { type: 'application/json' });
        const backupUrl = URL.createObjectURL(backupBlob);
        const backupLink = document.createElement('a');
        backupLink.href = backupUrl;
        backupLink.download = `products_backup_${timestamp}.json`;
        backupLink.click();
        URL.revokeObjectURL(backupUrl);

        // Yeni JSON'u indir
        const jsonBlob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = 'products.json';
        jsonLink.click();
        URL.revokeObjectURL(jsonUrl);

        alert(`✅ Tüm ürünler dışa aktarıldı!\n\nYeni ürün sayısı: ${allData.newProducts.length}\nMevcut ürün sayısı: ${allData.existingProducts}\nToplam ürün sayısı: ${allData.totalProducts}\n\nYedek ve yeni products.json dosyaları indirildi.`);
    } catch (error) {
        console.error('❌ Error exporting products:', error);
        alert('Ürünler dışa aktarılırken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.searchBarcode = async function(barcode) {
    try {
        if (!barcode || !barcode.trim()) {
            const resultsDiv = document.getElementById('barcodeSearchResults');
            const noResultsDiv = document.getElementById('barcodeSearchNoResults');
            if (resultsDiv) resultsDiv.classList.add('hidden');
            if (noResultsDiv) noResultsDiv.classList.add('hidden');
            return;
        }

        // Products.json'u yükle
        const fileInput = document.getElementById('productsJsonFileInput');
        const products = await window.productImporter.loadProductsJSON(fileInput);

        // Arama yap
        const results = window.productImporter.searchByBarcode(barcode.trim(), products);

        // Sonuçları göster
        const tbody = document.getElementById('barcodeSearchResultsBody');
        const resultsDiv = document.getElementById('barcodeSearchResults');
        const noResultsDiv = document.getElementById('barcodeSearchNoResults');
        
        if (!tbody) return;

        tbody.innerHTML = '';

        if (results.length === 0) {
            if (resultsDiv) resultsDiv.classList.add('hidden');
            if (noResultsDiv) noResultsDiv.classList.remove('hidden');
            return;
        }

        if (noResultsDiv) noResultsDiv.classList.add('hidden');
        const countEl = document.getElementById('searchResultsCount');
        if (countEl) countEl.textContent = results.length;
        if (resultsDiv) resultsDiv.classList.remove('hidden');

        results.forEach(result => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-4 py-3 text-sm text-gray-900">${result.product.name || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-900 font-mono">${result.barcode.code || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-900">${result.barcode.variant || '-'} ${result.barcode.size || ''}</td>
                <td class="px-4 py-3 text-sm text-gray-900">${result.product.category || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-900">${result.product.brand || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('❌ Error searching barcode:', error);
        const resultsDiv = document.getElementById('barcodeSearchResults');
        const noResultsDiv = document.getElementById('barcodeSearchNoResults');
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (noResultsDiv) noResultsDiv.classList.remove('hidden');
    }
};

AdminPanel.prototype.loadProductImportTab = async function() {
    try {
        console.log('🔄 Loading product import tab...');
        
        // Products.json'u yükle ve cache'le (hata olursa kullanıcı dosya seçecek)
        if (window.productImporter) {
            try {
                const fileInput = document.getElementById('productsJsonFileInput');
                await window.productImporter.loadProductsJSON(fileInput);
                console.log('✅ Products loaded and cached');
            } catch (error) {
                console.warn('⚠️ Products not loaded yet, user will select file:', error.message);
                // Hata olursa kullanıcıya dosya seçtirilecek, alert gösterme
            }
        }
    } catch (error) {
        console.error('❌ Error loading product import tab:', error);
    }
};

AdminPanel.prototype.fetchAllProductsFromGetir = async function() {
    try {
        const fetchBtn = document.getElementById('fetchAllProductsBtn');
        if (fetchBtn) {
            fetchBtn.disabled = true;
            fetchBtn.innerHTML = '<svg class="w-5 h-5 animate-spin inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Çekiliyor...';
        }

        const products = await window.productImporter.fetchAllProductsFromGetirAPI();
        
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.innerHTML = '<svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Ürünleri Çek';
        }

        alert(`✅ ${products.length} ürün başarıyla çekildi!\n\nArtık JSON olarak indirebilir veya eksik ürünleri bulabilirsiniz.`);
    } catch (error) {
        console.error('❌ Error fetching products from Getir API:', error);
        alert('❌ Ürünler çekilirken hata oluştu: ' + error.message + '\n\n💡 Lütfen:\n1. Python bot\'un çalıştığından emin olun (localhost:8765)\n2. Getir sitesine giriş yapıp extension\'ın token gönderdiğinden emin olun');
        
        const fetchBtn = document.getElementById('fetchAllProductsBtn');
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.innerHTML = '<svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Ürünleri Çek';
        }
    }
};

AdminPanel.prototype.findMissingProductsFromGetir = async function() {
    try {
        const analyzeBtn = document.getElementById('analyzeFetchedProductsBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '⏳ Aranıyor...';
        }

        const result = await window.productImporter.findMissingProducts();
        
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🔍 Eksik Ürünleri Bul';
        }

        alert(`✅ Analiz tamamlandı!\n\nEksik ürün sayısı: ${result.missing.length}\nMevcut ürün sayısı: ${result.existing}\nToplam ürün sayısı: ${result.total}\n\nEksik ürünler tabloda gösterildi.`);
    } catch (error) {
        console.error('❌ Error finding missing products:', error);
        alert('❌ Eksik ürünler aranırken hata oluştu: ' + error.message);
        
        const analyzeBtn = document.getElementById('analyzeFetchedProductsBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '🔍 Eksik Ürünleri Bul';
        }
    }
};
