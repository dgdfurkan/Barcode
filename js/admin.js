// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.currentTab = 'users';
        this.users = [];
        this.messages = [];
        this.logs = [];
        this.currentMessageFilter = 'all';
        this.ipTrackingData = [];
        this.ipAnalysis = null;
        this.currentIPDetailsSortDirection = 'asc';
        this.currentIPDetailsSortColumn = null;
        this.currentIPTrackingSortDirection = 'asc';
        this.currentIPTrackingSortColumn = null;
        this.selectedChatUser = null;
        this.chatMessages = [];
        this.chatSubscription = null;
    }

    async init() {
        // Check if user is admin
        const session = window.authUtils.checkAuth();
        if (!session || !session.isAdmin) {
            alert('Bu sayfaya erişim yetkiniz yok!');
            window.location.href = 'index.html';
            return;
        }

        // Update admin user info
        document.getElementById('adminUser').textContent = session.username;

        // Add logout functionality
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                window.authUtils.logout();
            }
        });

        // Initialize tabs
        this.initTabs();

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
            console.log('🔍 Debug: Supabase status:', !!window.supabase);
            this.testSupabaseConnection();
            this.loadIPTracking();
        });

        // Chat event listeners
        document.getElementById('refreshChat').addEventListener('click', () => this.loadChatUsers());
        document.getElementById('clearChatBtn').addEventListener('click', () => this.clearChat());
        document.getElementById('sendAdminMessage').addEventListener('click', () => this.sendAdminMessage());
        document.getElementById('adminMessageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendAdminMessage();
        });
    }

    async switchTab(tabName) {
        // Update button states
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active', 'border-blue-500', 'text-blue-600');
        document.querySelector(`[data-tab="${tabName}"]`).classList.remove('border-transparent', 'text-gray-500');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        document.getElementById(`${tabName}-tab`).classList.remove('hidden');

        this.currentTab = tabName;
        
        // Load data when switching to specific tabs
        if (tabName === 'ipAnalysis') {
            await this.loadIPAnalysis();
            await this.loadIPTracking();
        } else if (tabName === 'chat') {
            await this.loadChatUsers();
        }
    }

    async loadUsers() {
        try {
            // Try Supabase first
            if (window.supabase) {
                const { data, error } = await window.supabase
                    .from('users')
                    .select('*')
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

        this.users.forEach(user => {
            const row = document.createElement('tr');
            
            const trialDaysLeft = this.getTrialDaysLeft(user.trial_end);
            const statusClass = user.is_active ? 
                (trialDaysLeft > 0 ? 'text-green-600' : 'text-red-600') : 
                'text-gray-500';
            
            const statusText = user.is_active ? 
                (trialDaysLeft > 0 ? `${trialDaysLeft} gün kaldı` : 'Süre doldu') : 
                'Deaktif';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${user.username}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${user.company || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${user.trial_end ? new Date(user.trial_end).toLocaleString('tr-TR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm font-medium ${this.getTrialStatusClass(user.trial_end)}">${this.getTrialStatusText(user.trial_end)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="adminPanel.editUser('${user.username}')" class="text-green-600 hover:text-green-900">Düzenle</button>
                        <button onclick="adminPanel.extendTrial('${user.username}')" class="text-blue-600 hover:text-blue-900">Uzat</button>
                        <button onclick="adminPanel.toggleUser('${user.username}')" class="text-yellow-600 hover:text-yellow-900">
                            ${user.is_active ? 'Deaktif Et' : 'Aktif Et'}
                        </button>
                        <button onclick="adminPanel.deleteUser('${user.username}')" class="text-red-600 hover:text-red-900">Sil</button>
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

            const newUser = {
                username: username,
                password: password,
                company: company,
                contact_email: email,
                trial_end: trialEnd.toISOString(),
                max_ip_count: maxIPCount,
                ip_tracking_enabled: ipTrackingEnabled,
                is_active: true,
                created_at: new Date().toISOString()
            };

            // Try Supabase first
            if (window.supabase) {
                const { error } = await window.supabase
                    .from('users')
                    .insert([newUser]);
                
                if (error) throw error;
            } else {
                // Fallback: Save to localStorage for demo
                const localUsers = JSON.parse(localStorage.getItem('LOCAL_USERS') || '{}');
                localUsers[username] = {
                    password: password,
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
            if (window.supabase) {
                await window.supabase
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
        document.getElementById('editPassword').value = user.password || '';
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
                password: password,
                company: company,
                contact_email: email,
                trial_end: trialEnd.toISOString(),
                allowed_ips: ips.length > 0 ? ips : ['*'],
                max_ip_count: maxIPCount,
                ip_tracking_enabled: ipTrackingEnabled,
                is_active: isActive
            };

            // Update in Supabase
            if (window.supabase) {
                await window.supabase
                    .from('users')
                    .update(updatedUser)
                    .eq('username', username);
            }

            // Update local
            const localUsers = JSON.parse(localStorage.getItem('LOCAL_USERS') || '{}');
            if (localUsers[username]) {
                localUsers[username] = {
                    ...localUsers[username],
                    password: password,
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
            if (window.supabase) {
                await window.supabase
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
            if (window.supabase) {
                await window.supabase
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
            if (window.supabase) {
                await window.supabase
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
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-300', 'text-gray-700');
        });
        
        // Highlight active filter
        const activeButton = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}Messages`);
        if (activeButton) {
            activeButton.classList.remove('bg-gray-300', 'text-gray-700');
            activeButton.classList.add('bg-blue-600', 'text-white');
        }
        
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
            timeline: this.ipTrackingData
                .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
                .slice(0, 50)
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
        document.querySelectorAll('[id^="filter"]').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
        });
        
        const activeButton = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}IPs`);
        if (activeButton) {
            activeButton.classList.remove('bg-gray-200', 'text-gray-700');
            activeButton.classList.add('bg-blue-600', 'text-white');
        }

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
            ['Kullanıcı', 'IP Adresi', 'İlk Görülme', 'Son Görülme', 'Giriş Sayısı', 'Durum'],
            ...this.ipTrackingData.map(ip => [
                ip.username || 'Bilinmeyen',
                ip.ip_address,
                new Date(ip.first_seen).toLocaleString('tr-TR'),
                new Date(ip.last_seen).toLocaleString('tr-TR'),
                ip.login_count || 1,
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
        console.log('🧪 Adding test IP data...');
        
        try {
            // Get first user for testing
            const { data: users, error: usersError } = await window.supabase
                .from('users')
                .select('id, username')
                .limit(1);
            
            if (usersError || !users || users.length === 0) {
                console.error('❌ No users found for test data');
                alert('Önce bir kullanıcı eklemeniz gerekiyor!');
                return;
            }
            
            const testUser = users[0];
            console.log('👤 Using test user:', testUser);
            
            const testData = [
                {
                    user_id: testUser.id,
                    ip_address: '192.168.1.100',
                    username: testUser.username,
                    first_seen: new Date().toISOString(),
                    last_seen: new Date().toISOString(),
                    login_count: 5,
                    is_blocked: false
                },
                {
                    user_id: testUser.id,
                    ip_address: '192.168.1.101',
                    username: testUser.username,
                    first_seen: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                    last_seen: new Date().toISOString(),
                    login_count: 12,
                    is_blocked: false
                },
                {
                    user_id: testUser.id,
                    ip_address: '192.168.1.102',
                    username: testUser.username,
                    first_seen: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                    last_seen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                    login_count: 3,
                    is_blocked: true
                }
            ];
            
            console.log('📝 Inserting test data:', testData);
            
            const { data: insertData, error: insertError } = await window.supabase
                .from('user_ip_tracking')
                .insert(testData)
                .select();
            
            if (insertError) {
                console.error('❌ Error inserting test data:', insertError);
                alert('Test verisi eklenirken hata oluştu: ' + insertError.message);
            } else {
                console.log('✅ Test data inserted:', insertData);
                alert('✅ Test verisi başarıyla eklendi! (' + insertData.length + ' kayıt)');
                this.loadIPTracking(); // Reload data
            }
            
        } catch (error) {
            console.error('❌ Error adding test data:', error);
            alert('Hata: ' + error.message);
        }
    }

    async testSupabaseConnection() {
        console.log('🧪 Testing Supabase connection...');
        
        if (!window.supabase) {
            console.error('❌ Supabase not available!');
            return;
        }
        
        try {
            // Test 1: Check users table
            console.log('🔍 Test 1: Checking users table...');
            const { data: users, error: usersError } = await window.supabase
                .from('users')
                .select('id, username')
                .limit(1);
            
            if (usersError) {
                console.error('❌ Users table error:', usersError);
            } else {
                console.log('✅ Users table OK:', users);
            }
            
            // Test 2: Check user_ip_tracking table
            console.log('🔍 Test 2: Checking user_ip_tracking table...');
            const { data: ipTracking, error: ipError } = await window.supabase
                .from('user_ip_tracking')
                .select('*')
                .limit(1);
            
            if (ipError) {
                console.error('❌ user_ip_tracking table error:', ipError);
            } else {
                console.log('✅ user_ip_tracking table OK:', ipTracking);
            }
            
            // Test 3: Check if we can insert test data
            console.log('🔍 Test 3: Testing insert capability...');
            const testData = {
                user_id: users?.[0]?.id || '00000000-0000-0000-0000-000000000000',
                ip_address: '127.0.0.1',
                username: 'test_user',
                first_seen: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                login_count: 1,
                is_blocked: false
            };
            
            const { data: insertData, error: insertError } = await window.supabase
                .from('user_ip_tracking')
                .insert([testData])
                .select();
            
            if (insertError) {
                console.error('❌ Insert test error:', insertError);
            } else {
                console.log('✅ Insert test OK:', insertData);
                
                // Clean up test data
                if (insertData && insertData[0]) {
                    await window.supabase
                        .from('user_ip_tracking')
                        .delete()
                        .eq('id', insertData[0].id);
                    console.log('🧹 Test data cleaned up');
                }
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
            console.log('🔄 Loading IP tracking data...');
            console.log('🔍 Supabase available:', !!window.supabase);
            console.log('🔍 Supabase URL:', window.supabase?.supabaseUrl);
            
            if (window.supabase) {
                console.log('📡 Fetching from Supabase...');
                
                // First, let's check if the table exists
                const { data: tableCheck, error: tableError } = await window.supabase
                    .from('user_ip_tracking')
                    .select('count')
                    .limit(1);
                
                if (tableError) {
                    console.error('❌ Table check error:', tableError);
                    console.log('💾 Falling back to local storage...');
                    this.ipTrackingData = JSON.parse(localStorage.getItem('ipTrackingData') || '[]');
                    console.log('📦 Local storage IP tracking data:', this.ipTrackingData);
                    this.renderIPTracking();
                    return;
                }
                
                console.log('✅ Table exists, fetching data...');
                
                const { data, error } = await window.supabase
                    .from('user_ip_tracking')
                    .select(`
                        *,
                        users!inner(username)
                    `)
                    .order('last_seen', { ascending: false });

                if (error) {
                    console.error('❌ Supabase IP tracking error:', error);
                    console.log('💾 Falling back to local storage...');
                    this.ipTrackingData = JSON.parse(localStorage.getItem('ipTrackingData') || '[]');
                    console.log('📦 Local storage IP tracking data:', this.ipTrackingData);
                } else {
                    console.log('✅ IP tracking data loaded from Supabase:', data);
                    this.ipTrackingData = data || [];
                }
            } else {
                // Fallback to local storage
                console.log('💾 Supabase not available, using local storage...');
                this.ipTrackingData = JSON.parse(localStorage.getItem('ipTrackingData') || '[]');
                console.log('📦 Local storage IP tracking data:', this.ipTrackingData);
            }

            console.log('📊 Total IP tracking records:', this.ipTrackingData.length);
            this.renderIPTracking();
            
            // Also trigger IP analysis if we're on the IP Analysis tab
            if (this.currentTab === 'ipAnalysis') {
                console.log('🔍 Triggering IP analysis...');
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
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${ip.username || 'Bilinmeyen'}</div>
                    <div class="text-sm text-gray-500">${ip.user_id || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${ip.ip_address}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${new Date(ip.first_seen).toLocaleString('tr-TR')}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${new Date(ip.last_seen).toLocaleString('tr-TR')}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${ip.login_count}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        ${ip.is_blocked ? 
                            `<button onclick="adminPanel.unblockIP('${ip.id}')" class="text-green-600 hover:text-green-900">Engeli Kaldır</button>` :
                            `<button onclick="adminPanel.blockIPTracking('${ip.id}')" class="text-red-600 hover:text-red-900">Engelle</button>`
                        }
                        <button onclick="adminPanel.deleteIPTracking('${ip.id}')" class="text-gray-600 hover:text-gray-900">Sil</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async blockIPTracking(ipId) {
        if (confirm('Bu IP adresini engellemek istediğinizden emin misiniz?')) {
            try {
                if (window.supabase) {
                    const { error } = await window.supabase
                        .from('user_ip_tracking')
                        .update({ is_blocked: true })
                        .eq('id', ipId);

                    if (error) throw error;
                } else {
                    // Local storage fallback
                    const index = this.ipTrackingData.findIndex(ip => ip.id === ipId);
                    if (index !== -1) {
                        this.ipTrackingData[index].is_blocked = true;
                        localStorage.setItem('ipTrackingData', JSON.stringify(this.ipTrackingData));
                    }
                }

                await this.loadIPTracking();
                alert('IP adresi engellendi!');
            } catch (error) {
                console.error('Error blocking IP:', error);
                alert('IP engellenirken hata oluştu!');
            }
        }
    }

    async unblockIP(ipId) {
        try {
            if (window.supabase) {
                const { error } = await window.supabase
                    .from('user_ip_tracking')
                    .update({ is_blocked: false })
                    .eq('id', ipId);

                if (error) throw error;
            } else {
                // Local storage fallback
                const index = this.ipTrackingData.findIndex(ip => ip.id === ipId);
                if (index !== -1) {
                    this.ipTrackingData[index].is_blocked = false;
                    localStorage.setItem('ipTrackingData', JSON.stringify(this.ipTrackingData));
                }
            }

            await this.loadIPTracking();
            alert('IP engeli kaldırıldı!');
        } catch (error) {
            console.error('Error unblocking IP:', error);
            alert('IP engeli kaldırılırken hata oluştu!');
        }
    }

    async deleteIPTracking(ipId) {
        if (confirm('Bu IP kaydını silmek istediğinizden emin misiniz?')) {
            try {
                if (window.supabase) {
                    const { error } = await window.supabase
                        .from('user_ip_tracking')
                        .delete()
                        .eq('id', ipId);

                    if (error) throw error;
                } else {
                    // Local storage fallback
                    this.ipTrackingData = this.ipTrackingData.filter(ip => ip.id !== ipId);
                    localStorage.setItem('ipTrackingData', JSON.stringify(this.ipTrackingData));
                }

                await this.loadIPTracking();
                alert('IP kaydı silindi!');
            } catch (error) {
                console.error('Error deleting IP tracking:', error);
                alert('IP kaydı silinirken hata oluştu!');
            }
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
    if (!window.supabase) return;
    
    console.log('🔔 Setting up chat realtime subscription');
    
    // Subscribe to users table changes for chat_messages
    this.chatSubscription = window.supabase
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
    
    if (window.supabase) {
        // Update last_chat_update to trigger realtime
        window.supabase
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
        if (window.supabase) {
            console.log('💬 Using Supabase for chat users');
            
            // First try to get users with chat_messages column
            const { data: usersData, error: usersError } = await window.supabase
                .from('users')
                .select('username, chat_messages, last_chat_update')
                .not('chat_messages', 'is', null);

            if (usersError && usersError.code === '42703') {
                console.log('⚠️ chat_messages column does not exist, using messages table');
                // Fallback to messages table
                const { data, error } = await window.supabase
                    .from('messages')
                    .select('username, status, created_at, message')
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('❌ Supabase error loading chat users:', error);
                    this.loadChatUsersFromLocalStorage();
                    return;
                }

                const uniqueUsers = [...new Set(data.map(msg => msg.username))];
                console.log('✅ Unique users from messages table:', uniqueUsers);
                this.renderChatUsers(uniqueUsers);
            } else if (usersData) {
                // Filter users who have chat messages
                const usersWithChat = usersData.filter(user => {
                    try {
                        const chatMessages = JSON.parse(user.chat_messages || '[]');
                        return chatMessages.length > 0;
                    } catch {
                        return false;
                    }
                });
                
                const uniqueUsers = usersWithChat.map(user => user.username);
                console.log('✅ Unique users with chat messages:', uniqueUsers);
                this.renderChatUsers(uniqueUsers);
            } else {
                console.log('⚠️ No users found, checking localStorage...');
                this.loadChatUsersFromLocalStorage();
            }
        } else {
            console.log('💬 Supabase not available, using localStorage');
            this.loadChatUsersFromLocalStorage();
        }
    } catch (error) {
        console.error('❌ Error loading chat users:', error);
        this.loadChatUsersFromLocalStorage();
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
        const lastMessage = await this.getLastMessagePreview(username);
        return `
            <div class="p-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors" onclick="adminPanel.selectChatUser('${username}')">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        ${username.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${username}</h4>
                        <p class="text-xs text-gray-500">${lastMessage}</p>
                    </div>
                    <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
            </div>
        `;
    }));
    
    chatUsersList.innerHTML = userElements.join('');
    console.log('💬 Chat users rendered successfully');
};

AdminPanel.prototype.getLastMessagePreview = async function(username) {
    // Get last message for this user from Supabase
    try {
        if (window.supabase) {
            const { data, error } = await window.supabase
                .from('users')
                .select('chat_messages')
                .eq('username', username)
                .single();

            if (!error && data && data.chat_messages) {
                const chatMessages = JSON.parse(data.chat_messages);
                if (chatMessages.length > 0) {
                    const lastMessage = chatMessages[chatMessages.length - 1];
                    const messageText = lastMessage.message || lastMessage.content || lastMessage.text || 'Mesaj içeriği bulunamadı';
                    return messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;
                }
            }
        }
        
        // Fallback to localStorage
        const messages = JSON.parse(localStorage.getItem('messages') || '[]');
        const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
        const userMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
        
        const allMessages = [...messages, ...chatMessages, ...globalMessages, ...userMessages];
        const userMessagesFiltered = allMessages.filter(msg => msg.username === username);
        
        if (userMessagesFiltered.length > 0) {
            const lastMessage = userMessagesFiltered[userMessagesFiltered.length - 1];
            const messageText = lastMessage.message || lastMessage.content || lastMessage.text || 'Mesaj içeriği bulunamadı';
            return messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;
        }
    } catch (error) {
        console.error('Error getting last message preview:', error);
    }
    return 'Henüz mesaj yok';
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
        if (window.supabase) {
            console.log('🗑️ Deleting messages from Supabase for:', this.selectedChatUser);
            const { error } = await window.supabase
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
        if (window.supabase) {
            console.log('💬 Using Supabase for chat messages');
            
            // First try to get user's chat messages from users table
            const { data, error } = await window.supabase
                .from('users')
                .select('chat_messages')
                .eq('username', username)
                .single();

            if (error && error.code === '42703') {
                console.log('⚠️ chat_messages column does not exist, using messages table');
                // Fallback to messages table
                const { data: messagesData, error: messagesError } = await window.supabase
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
            } else if (error) {
                console.error('❌ Supabase error loading chat messages:', error);
                this.loadChatMessagesFromLocalStorage(username);
            } else if (data && data.chat_messages) {
                const chatMessages = JSON.parse(data.chat_messages);
                console.log('✅ Parsed chat messages:', chatMessages);
                this.renderChatMessages(chatMessages);
            } else {
                console.log('⚠️ No chat messages in Supabase for', username, ', checking localStorage');
                this.loadChatMessagesFromLocalStorage(username);
            }
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

    chatMessagesArea.innerHTML = messages.map((msg, index) => {
        const time = new Date(msg.timestamp || msg.created_at).toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Get message content
        const messageContent = msg.message || msg.content || msg.text || 'Mesaj içeriği bulunamadı';
        
        if (msg.sender === 'admin') {
            return `
                <div class="flex justify-end mb-3 group">
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
        } else {
            return `
                <div class="flex justify-start mb-3 group">
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
    }).join('');

    // Scroll to bottom
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
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
        if (window.supabase && messageToDelete.id) {
            console.log('🗑️ Deleting message from Supabase with ID:', messageToDelete.id);
            const { error } = await window.supabase
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

AdminPanel.prototype.sendAdminMessage = async function() {
    const messageInput = document.getElementById('adminMessageInput');
    const message = messageInput.value.trim();
    
    if (!message || !this.selectedChatUser) return;

    // Add message to UI immediately
    this.addAdminMessageToUI(message);
    messageInput.value = '';

    // Save to Supabase
    await this.saveAdminMessageToSupabase(message);
};

AdminPanel.prototype.addAdminMessageToUI = function(message) {
    const chatMessagesArea = document.getElementById('chatMessagesArea');
    const time = new Date().toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const messageDiv = document.createElement('div');
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
    
    chatMessagesArea.appendChild(messageDiv);
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
};

AdminPanel.prototype.saveAdminMessageToSupabase = async function(message) {
    try {
        if (window.supabase) {
            console.log('💬 Saving admin message to Supabase:', message);
            
            // Get current user's chat messages
            const { data: userData, error: userError } = await window.supabase
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
            
            // Add admin message with read status (admin messages are immediately read by admin)
            chatMessages.push({
                message: message,
                sender: 'admin',
                timestamp: new Date().toISOString(),
                status: 'read'
            });

            // Update user's chat messages
            const { error: updateError } = await window.supabase
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
