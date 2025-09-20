// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.currentTab = 'users';
        this.users = [];
        this.messages = [];
        this.logs = [];
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

        // Export IP Data
        document.getElementById('exportIPData').addEventListener('click', () => {
            this.exportIPData();
        });

        // Debug button for testing
        document.getElementById('refreshIPTrackingBtn').addEventListener('click', () => {
            console.log('🔍 Debug: Current IP tracking data:', this.ipTrackingData);
            console.log('🔍 Debug: Current IP analysis:', this.ipAnalysis);
            this.loadIPTracking();
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

        // Render top IPs
        const topIPsContainer = document.getElementById('topIPsList');
        if (topIPsContainer) {
            if (this.ipAnalysis && this.ipAnalysis.topIPs && this.ipAnalysis.topIPs.length > 0) {
                topIPsContainer.innerHTML = this.ipAnalysis.topIPs.slice(0, 10).map(ip => `
                    <div class="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg mb-2">
                        <div class="flex-1">
                            <div class="font-mono text-sm font-semibold text-gray-900">${ip.ip}</div>
                            <div class="text-xs text-gray-600">${ip.sessions} oturum • ${Array.from(ip.users).join(', ')}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">${new Date(ip.lastSeen).toLocaleDateString('tr-TR')}</div>
                            ${ip.isSuspicious ? '<div class="text-xs text-red-600 font-semibold">⚠️ Şüpheli</div>' : ''}
                        </div>
                    </div>
                `).join('');
            } else {
                topIPsContainer.innerHTML = '<div class="text-center text-gray-500 py-8">Henüz IP verisi bulunamadı</div>';
            }
        }

        // Render timeline
        const timelineContainer = document.getElementById('ipTimeline');
        if (timelineContainer) {
            if (this.ipAnalysis && this.ipAnalysis.timeline && this.ipAnalysis.timeline.length > 0) {
                timelineContainer.innerHTML = this.ipAnalysis.timeline.slice(0, 20).map(ip => {
                    const lastSeen = new Date(ip.last_seen).toLocaleString('tr-TR');
                    return `
                        <div class="flex justify-between items-center p-3 border-b border-gray-200 hover:bg-gray-50">
                            <div class="flex-1">
                                <div class="font-mono text-sm font-semibold text-gray-900">${ip.ip_address}</div>
                                <div class="text-xs text-gray-600">${ip.username || 'Bilinmeyen'} • ${ip.login_count || 1} giriş</div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-gray-500">${lastSeen}</div>
                                ${ip.is_blocked ? '<div class="text-xs text-red-600 font-semibold">🚫 Engelli</div>' : '<div class="text-xs text-green-600 font-semibold">✅ Aktif</div>'}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                timelineContainer.innerHTML = '<div class="text-center text-gray-500 py-8">Henüz aktivite verisi bulunamadı</div>';
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
            
            if (window.supabase) {
                console.log('📡 Fetching from Supabase...');
                const { data, error } = await window.supabase
                    .from('user_ip_tracking')
                    .select(`
                        *,
                        users!inner(username)
                    `)
                    .order('last_seen', { ascending: false });

                if (error) {
                    console.error('❌ Supabase IP tracking error:', error);
                    throw error;
                }
                
                console.log('✅ IP tracking data loaded from Supabase:', data);
                this.ipTrackingData = data || [];
            } else {
                // Fallback to local storage
                console.log('💾 Using local storage fallback...');
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
    
    document.getElementById('refreshLogsBtn').addEventListener('click', async () => {
        await adminPanel.loadLogs();
    });
    
    document.getElementById('refreshIPAnalysisBtn').addEventListener('click', async () => {
        await adminPanel.loadIPAnalysis();
    });
});
