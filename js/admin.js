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
        await this.loadLogs();

        // Update stats
        this.updateStats();
    }

    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                this.switchTab(tabName);
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
    }

    switchTab(tabName) {
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

            // Fallback: Load from localStorage for demo
            const localUsersData = localStorage.getItem('LOCAL_USERS');
            if (localUsersData) {
                const localUsers = JSON.parse(localUsersData);
                this.users = Object.keys(localUsers).map(username => ({
                    username: username,
                    company: localUsers[username].company,
                    trial_end: localUsers[username].trialEnd,
                    is_active: localUsers[username].isActive,
                    allowed_ips: localUsers[username].allowedIPs,
                    created_at: new Date().toISOString()
                }));
            }

            this.renderUsers();
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
                    <div class="text-sm text-gray-500">${user.trial_end ? new Date(user.trial_end).toLocaleDateString('tr-TR') : '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm font-medium ${statusClass}">${statusText}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
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
        const ips = document.getElementById('newIPs').value.split(',').map(ip => ip.trim()).filter(ip => ip);

        try {
            let trialEnd;
            
            // Use datetime-local input if provided, otherwise use trial days
            if (trialEndInput) {
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
                allowed_ips: ips.length > 0 ? ips : ['*'],
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

    async extendTrial(username) {
        const days = prompt(`${username} kullanıcısı için kaç gün uzatmak istiyorsunuz?`, '7');
        if (!days || isNaN(days)) return;

        try {
            const user = this.users.find(u => u.username === username);
            if (!user) return;

            const currentEnd = user.trial_end ? new Date(user.trial_end) : new Date();
            const newEnd = new Date(currentEnd);
            newEnd.setDate(newEnd.getDate() + parseInt(days));

            // Update in Supabase
            if (window.supabase) {
                await window.supabase
                    .from('users')
                    .update({ trial_end: newEnd.toISOString() })
                    .eq('username', username);
            }

            // Update local
            if (window.LOCAL_USERS && window.LOCAL_USERS[username]) {
                window.LOCAL_USERS[username].trialEnd = newEnd.toISOString();
            }

            // Update in memory
            user.trial_end = newEnd.toISOString();
            this.renderUsers();
            this.updateStats();

            alert(`Test süresi ${days} gün uzatıldı!`);
        } catch (error) {
            console.error('Error extending trial:', error);
            alert('Süre uzatılırken hata oluştu: ' + error.message);
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

        this.messages.forEach(message => {
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
                        <button onclick="adminPanel.updateMessageStatus('${message.id}', 'approved')" class="text-green-600 hover:text-green-800 text-sm">Onayla</button>
                        <button onclick="adminPanel.updateMessageStatus('${message.id}', 'rejected')" class="text-red-600 hover:text-red-800 text-sm">Reddet</button>
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

    async loadLogs() {
        try {
            // Try Supabase first
            if (window.supabase) {
                const { data, error } = await window.supabase
                    .from('ip_logs')
                    .select('*')
                    .order('login_time', { ascending: false })
                    .limit(100);
                
                if (!error && data) {
                    this.logs = data;
                }
            }

            // Fallback to local storage
            if (this.logs.length === 0) {
                const localLogs = JSON.parse(localStorage.getItem('ipLogs') || '[]');
                this.logs = localLogs.slice(-100); // Son 100 log
            }

            this.renderLogs();
        } catch (error) {
            console.error('Error loading logs:', error);
        }
    }

    renderLogs() {
        const container = document.getElementById('logsList');
        container.innerHTML = '';

        if (this.logs.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-8">Henüz IP log kaydı bulunmuyor.</div>';
            return;
        }

        this.logs.forEach(log => {
            const logDiv = document.createElement('div');
            logDiv.className = 'bg-white rounded-lg shadow p-4 mb-3';
            
            const loginTime = new Date(log.login_time).toLocaleString('tr-TR');
            const userAgent = log.user_agent ? log.user_agent.substring(0, 60) + '...' : 'Bilinmiyor';
            
            logDiv.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                ${log.username || log.user_id || 'Bilinmeyen'}
                            </span>
                            <span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                ${log.ip_address}
                            </span>
                        </div>
                        <div class="text-sm text-gray-600 mb-1">
                            <strong>Giriş Zamanı:</strong> ${loginTime}
                        </div>
                        <div class="text-sm text-gray-600 mb-1">
                            <strong>User Agent:</strong> ${userAgent}
                        </div>
                        ${log.logout_time ? `
                            <div class="text-sm text-gray-600 mb-1">
                                <strong>Çıkış Zamanı:</strong> ${new Date(log.logout_time).toLocaleString('tr-TR')}
                            </div>
                        ` : ''}
                        ${log.session_duration ? `
                            <div class="text-sm text-gray-600">
                                <strong>Oturum Süresi:</strong> ${Math.floor(log.session_duration / 60)} dakika
                            </div>
                        ` : ''}
                    </div>
                    <div class="text-right">
                        <span class="text-xs text-gray-500">
                            ID: ${log.id ? log.id.substring(0, 8) : 'N/A'}
                        </span>
                    </div>
                </div>
            `;
            
            container.appendChild(logDiv);
        });
    }

    async loadIPAnalysis() {
        try {
            // Load logs first
            await this.loadLogs();
            
            // Analyze IP data
            this.analyzeIPData();
        } catch (error) {
            console.error('Error loading IP analysis:', error);
        }
    }

    analyzeIPData() {
        if (this.logs.length === 0) {
            this.renderIPAnalysis();
            return;
        }

        // Calculate statistics
        const uniqueIPs = new Set(this.logs.map(log => log.ip_address));
        const totalSessions = this.logs.length;
        
        // Calculate average session duration
        const sessionsWithDuration = this.logs.filter(log => log.session_duration);
        const avgDuration = sessionsWithDuration.length > 0 
            ? sessionsWithDuration.reduce((sum, log) => sum + log.session_duration, 0) / sessionsWithDuration.length
            : 0;

        // Count IP usage
        const ipCounts = {};
        this.logs.forEach(log => {
            ipCounts[log.ip_address] = (ipCounts[log.ip_address] || 0) + 1;
        });

        // Sort IPs by usage
        const topIPs = Object.entries(ipCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        // Create timeline data
        const timeline = this.logs
            .sort((a, b) => new Date(a.login_time) - new Date(b.login_time))
            .slice(-20); // Last 20 sessions

        this.renderIPAnalysis({
            uniqueIPCount: uniqueIPs.size,
            totalSessions: totalSessions,
            avgSessionDuration: Math.round(avgDuration / 60), // minutes
            topIPs: topIPs,
            timeline: timeline
        });
    }

    renderIPAnalysis(data = null) {
        // Update statistics
        document.getElementById('uniqueIPCount').textContent = data ? data.uniqueIPCount : '-';
        document.getElementById('totalSessions').textContent = data ? data.totalSessions : '-';
        document.getElementById('avgSessionDuration').textContent = data ? `${data.avgSessionDuration} dk` : '-';

        // Render top IPs
        const topIPsContainer = document.getElementById('topIPsList');
        if (data && data.topIPs.length > 0) {
            topIPsContainer.innerHTML = data.topIPs.map(([ip, count]) => `
                <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span class="font-mono text-sm">${ip}</span>
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        ${count} oturum
                    </span>
                </div>
            `).join('');
        } else {
            topIPsContainer.innerHTML = '<div class="text-center text-gray-500 py-4">Veri bulunamadı</div>';
        }

        // Render timeline
        const timelineContainer = document.getElementById('ipTimeline');
        if (data && data.timeline.length > 0) {
            timelineContainer.innerHTML = data.timeline.map(log => {
                const loginTime = new Date(log.login_time).toLocaleString('tr-TR');
                const duration = log.session_duration ? `${Math.round(log.session_duration / 60)} dk` : 'Devam ediyor';
                
                return `
                    <div class="flex justify-between items-center p-2 border-l-4 border-blue-500 bg-blue-50">
                        <div class="flex-1">
                            <div class="font-mono text-sm">${log.ip_address}</div>
                            <div class="text-xs text-gray-600">${log.username || log.user_id}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-600">${loginTime}</div>
                            <div class="text-xs text-gray-500">${duration}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            timelineContainer.innerHTML = '<div class="text-center text-gray-500 py-4">Timeline verisi bulunamadı</div>';
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
