// Sohbet Sistemi JavaScript
class ChatSystem {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.currentUser = null;
        this.isGuest = false; // Guest user flag
        this.chatSubscription = null;
        this.hasUnreadMessages = false;
        this.initialLoadComplete = false; // İlk yükleme tamamlandı mı
        this.lastKnownMessageIds = new Set(); // Bilinen mesaj ID'leri
        this.lastRenderedDate = null; // Son render edilen tarih (tarih ayraçları için)
        this.chatScrollHandler = null; // Scroll handler reference
        this.init();
    }
    
    // Tarih formatlama utility fonksiyonu - WhatsApp tarzı
    formatChatDate(dateString) {
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
    }
    
    // Tarih karşılaştırma için yardımcı fonksiyon (sadece tarih, saat değil)
    isSameDate(date1, date2) {
        if (!date1 || !date2) return false;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    init() {
        console.log('🔍 ChatSystem initializing...');
        
        // Event listeners
        const openChatBtn = document.getElementById('openChat');
        const closeChatBtn = document.getElementById('closeChat');
        const sendMessageBtn = document.getElementById('sendMessage');
        const messageInput = document.getElementById('messageInput');
        
        console.log('🔍 Elements found:', {
            openChatBtn: !!openChatBtn,
            closeChatBtn: !!closeChatBtn,
            sendMessageBtn: !!sendMessageBtn,
            messageInput: !!messageInput
        });
        
        if (openChatBtn) {
            openChatBtn.addEventListener('click', () => this.openChat());
        }
        
        if (closeChatBtn) {
            closeChatBtn.addEventListener('click', () => this.closeChat());
        }
        
        if (sendMessageBtn) {
            sendMessageBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission
                    e.stopPropagation(); // Stop event bubbling
                    this.sendMessage();
                }
            });
        }

        // Ensure chat button is always visible
        this.ensureChatButtonVisible();

        // Check if user is logged in (async for guest users)
        this.checkUserStatus().then(() => {
            console.log('✅ User status checked:', this.currentUser, 'isGuest:', this.isGuest);
        });
        
        // Clean up any existing notifications from previous session
        this.cleanupExistingNotifications();
        
        // Set up real-time updates
        this.setupRealTimeUpdates();
        this.setupChatRealtime();
        
        // Load chat history AFTER everything is set up (with delay for Supabase)
        setTimeout(() => {
            console.log('💬 Sayfa yüklendiğinde chat geçmişi yükleniyor (delayed)...');
            this.loadChatHistory();
        }, 1000);
    }

    ensureChatButtonVisible() {
        const openChatBtn = document.getElementById('openChat');
        if (openChatBtn) {
            console.log('✅ Chat button found, ensuring visibility...');
            
            // Remove any hidden classes
            openChatBtn.classList.remove('hidden');
            
            // Force visibility with inline styles - SAĞ ALTTA SABİT!
            openChatBtn.style.position = 'fixed';
            openChatBtn.style.bottom = '1rem';
            openChatBtn.style.right = '1rem';
            openChatBtn.style.zIndex = '9999';
            openChatBtn.style.left = 'auto'; // Sol taraf override etme
            openChatBtn.style.width = '3.5rem';
            openChatBtn.style.height = '3.5rem';
            openChatBtn.style.backgroundColor = 'rgb(59 130 246)';
            openChatBtn.style.borderRadius = '50%';
            openChatBtn.style.display = 'flex';
            openChatBtn.style.alignItems = 'center';
            openChatBtn.style.justifyContent = 'center';
            openChatBtn.style.color = 'white';
            openChatBtn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            openChatBtn.style.cursor = 'pointer';
            openChatBtn.style.transition = 'all 0.3s ease';
            
            // Add hover effect
            openChatBtn.addEventListener('mouseenter', () => {
                if (!this.hasUnreadMessages) {
                openChatBtn.style.transform = 'scale(1.1)';
                openChatBtn.style.backgroundColor = 'rgb(37 99 235)';
                }
            });
            
            openChatBtn.addEventListener('mouseleave', () => {
                if (!this.hasUnreadMessages) {
                openChatBtn.style.transform = 'scale(1)';
                openChatBtn.style.backgroundColor = 'rgb(59 130 246)';
                }
            });
            
            console.log('✅ Chat button visibility ensured with inline styles');
        } else {
            console.error('❌ Chat button not found in ensureChatButtonVisible');
        }
    }

    async checkUserStatus() {
        // Öncelik 1: Aktif oturum kontrolü
        const session = window.authUtils?.checkAuth();
        if (session && session.username) {
            this.currentUser = session.username;
            this.isGuest = false;
            this.updateChatHeader();
            console.log('🔍 Using authenticated user:', this.currentUser);
            return;
        }

        // Öncelik 2: IP'ye göre en son giriş yapılan kayıtlı kullanıcıyı bul
        if (window.supabase && window.guestUserManager) {
            try {
                const clientIP = await window.guestUserManager.getClientIP();
                
                // user_ip_tracking tablosundan IP'ye göre en son giriş yapan kullanıcıyı bul
                const { data: ipTracking, error: ipError } = await window.supabase
                    .from('user_ip_tracking')
                    .select(`
                        user_id,
                        last_seen,
                        users!inner(username)
                    `)
                    .eq('ip_address', clientIP)
                    .eq('is_blocked', false)
                    .order('last_seen', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!ipError && ipTracking && ipTracking.users && ipTracking.users.username) {
                    this.currentUser = ipTracking.users.username;
                    this.isGuest = false;
                    this.updateChatHeader();
                    console.log('🔍 Using registered user from IP tracking:', this.currentUser, 'for IP:', clientIP);
                    return;
                }
            } catch (error) {
                console.error('❌ Error checking IP tracking:', error);
            }
        }

        // Öncelik 3: localStorage'dan geçici kullanıcı bilgileri
        const storedUsername = localStorage.getItem('currentUser') || localStorage.getItem('username');
        const tempChatUser = localStorage.getItem('tempChatUser'); // For trial expired users
        const sessionData = JSON.parse(localStorage.getItem('session') || '{}');
        
        if (sessionData.username) {
            this.currentUser = sessionData.username;
            this.isGuest = false;
            this.updateChatHeader();
            console.log('🔍 Using session username:', this.currentUser);
            return;
        } else if (tempChatUser) {
            this.currentUser = tempChatUser;
            this.isGuest = false;
            this.updateChatHeader();
            console.log('🔍 Using temp chat user (trial expired):', this.currentUser);
            return;
        } else if (storedUsername) {
            this.currentUser = storedUsername;
            this.isGuest = false;
            this.updateChatHeader();
            console.log('🔍 Using stored username:', this.currentUser);
            return;
        }

        // Öncelik 4: Guest kullanıcı (IP bazlı)
        if (window.guestUserManager) {
            try {
                const guestUser = await window.guestUserManager.getOrCreateGuestUser();
                this.currentUser = guestUser;
                this.isGuest = true;
                this.updateChatHeader();
                console.log('🔍 Using guest user:', this.currentUser);
                return;
            } catch (error) {
                console.error('❌ Error getting guest user:', error);
            }
        }

        // Son çare: localStorage'dan herhangi bir kullanıcı bilgisi
        const authKeys = ['user', 'authUser', 'loggedInUser'];
        let foundUser = null;
        
        for (const key of authKeys) {
            const userData = localStorage.getItem(key);
            if (userData) {
                try {
                    const parsed = JSON.parse(userData);
                    if (parsed.username) {
                        foundUser = parsed.username;
                        break;
                    }
                } catch (e) {
                    if (typeof userData === 'string' && userData.length > 0) {
                        foundUser = userData;
                        break;
                    }
                }
            }
        }
        
        this.currentUser = foundUser || 'ProductSearchUser';
        this.isGuest = false;
        this.updateChatHeader();
        console.log('🔍 Final username resolution:', this.currentUser);
    }

    updateChatHeader() {
        const header = document.querySelector('#chatInterface .bg-gradient-to-r');
        if (this.currentUser && header) {
            header.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="font-semibold">Destek Sohbeti</h3>
                            <p class="text-xs opacity-90">Merhaba ${this.currentUser}! 👋</p>
                        </div>
                    </div>
                    <button id="closeChat" class="text-white hover:text-gray-200 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            `;
            
            // Re-attach close button event
            const newCloseBtn = document.getElementById('closeChat');
            if (newCloseBtn) {
                newCloseBtn.addEventListener('click', () => this.closeChat());
            }
        }
    }

    async openChat() {
        console.log('🔍 Opening chat...');
        
        // Check for temp chat user (for trial expired users)
        const tempChatUser = localStorage.getItem('tempChatUser');
        if (tempChatUser && !this.currentUser) {
            this.currentUser = tempChatUser;
            console.log('🔍 Using temp chat user:', this.currentUser);
        }
        
        // If no user, get or create guest user
        if (!this.currentUser && window.guestUserManager) {
            try {
                this.currentUser = await window.guestUserManager.getOrCreateGuestUser();
                this.isGuest = true;
                console.log('🔍 Using guest user:', this.currentUser);
            } catch (error) {
                console.error('Error getting guest user:', error);
            }
        }
        
        const chatInterface = document.getElementById('chatInterface');
        const openButton = document.getElementById('openChat');
        
        if (chatInterface) {
            chatInterface.classList.remove('hidden');
            chatInterface.style.display = 'block';
            chatInterface.style.position = 'fixed';
            chatInterface.style.bottom = '1rem';
            chatInterface.style.right = '1rem';
            chatInterface.style.zIndex = '10000';
        }
        
        if (openButton) {
            openButton.style.display = 'none';
        }
        
        this.isOpen = true;
        
        // Update chat header with current user
        this.updateChatHeader();
        
        // Mark messages as read
        this.hasUnreadMessages = false;
        this.stopChatButtonAnimation();
        
        // KULLANICI CHAT'İ AÇTIĞINDA TÜM ESKİ MESAJLARI YÜKLE!
        console.log('💬 Chat açıldı - tüm eski mesajları yükleniyor...');
        this.loadChatHistory();
        
        // Kullanıcı chat'i açtı - admin mesajlarını okudu olarak işaretle
        setTimeout(() => {
            this.markAdminMessagesAsReadByUser();
        }, 500);
        
        // Focus on message input
        setTimeout(() => {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.focus();
            }
        }, 100);
        
        // Scroll to bottom after loading
        setTimeout(() => {
        this.scrollToBottom();
        }, 200);
    }

    closeChat() {
        console.log('🔍 Closing chat...');
        const chatInterface = document.getElementById('chatInterface');
        const openButton = document.getElementById('openChat');
        
        if (chatInterface) {
            chatInterface.classList.add('hidden');
            chatInterface.style.display = 'none';
        }
        
        if (openButton) {
            openButton.style.display = 'flex';
        }
        
        this.isOpen = false;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput?.value?.trim();
        
        if (!message) return;
        
        console.log('🔍 Sending message:', message);

        // Add message to UI immediately with pending status
        this.addMessage(message, 'user', null, { adminStatus: 'unread', userStatus: 'sent' });
        if (messageInput) {
            messageInput.value = '';
        }
        
        // Save ONLY to Supabase - it's the single source of truth
        await this.saveMessageToSupabase(message);
    }

    showEmptyState() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        // Placeholder mesajı zaten varsa ekleme
        if (messagesContainer.querySelector('#chatEmptyState')) return;
        
        const emptyState = document.createElement('div');
        emptyState.id = 'chatEmptyState';
        emptyState.className = 'flex flex-col items-center justify-center h-full text-center px-4 py-8';
        emptyState.innerHTML = `
            <div class="relative mb-6">
                <div class="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                    <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                </div>
                <div class="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
                    <svg class="w-4 h-4 text-yellow-800" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                    </svg>
                </div>
            </div>
            <h3 class="text-gray-700 text-lg font-bold mb-2">Merhaba! 👋</h3>
            <p class="text-gray-600 text-sm mb-1 font-medium">Sohbet başlatmak için ilk mesajınızı yazın</p>
            <p class="text-gray-500 text-xs">Destek ekibimiz size yardımcı olmak için burada</p>
        `;
        messagesContainer.appendChild(emptyState);
    }

    hideEmptyState() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        const emptyState = messagesContainer.querySelector('#chatEmptyState');
        if (emptyState) {
            emptyState.remove();
        }
    }

    addMessage(text, sender, timestamp = null, messageData = null) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        // Placeholder'ı kaldır
        this.hideEmptyState();
        
        const msgTimestamp = timestamp ? (typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString()) : new Date().toISOString();
        const msgDate = new Date(msgTimestamp);
        const currentDate = msgDate.toDateString();
        
        // Tarih değiştiyse tarih ayracı ekle
        if (this.lastRenderedDate !== currentDate) {
            const dateDivider = document.createElement('div');
            const formattedDate = this.formatChatDate(msgTimestamp);
            dateDivider.className = 'flex justify-center my-4';
            dateDivider.innerHTML = `
                <div class="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                    ${formattedDate}
                </div>
            `;
            messagesContainer.appendChild(dateDivider);
            this.lastRenderedDate = currentDate;
        }
        
        const messageDiv = document.createElement('div');
        
        // Saat formatı - saniye yok, sadece saat:dakika
        const time = timestamp ? 
            (typeof timestamp === 'string' ? 
                new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) :
                timestamp) :
            new Date().toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        
        // Get status icon (WhatsApp style) with new dual status system
        const getStatusIcon = () => {
            if (sender === 'user') {
                // Kullanıcı mesajı için admin'in okumuş mu kontrolü
                const adminStatus = messageData?.adminStatus || 'unread';
                return adminStatus === 'read' ? '✅' : '☑️';
            } else if (sender === 'admin') {
                // Admin mesajı için kullanıcının okumuş mu kontrolü
                const userStatus = messageData?.userStatus || 'unread';
                return userStatus === 'read' ? '✅' : '☑️';
            }
            return '☑️';
        };
        
        const statusIcon = getStatusIcon();
        const isRead = (sender === 'user' && messageData?.adminStatus === 'read') || 
                      (sender === 'admin' && messageData?.userStatus === 'read');
        
        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="flex justify-end mb-3" data-message-timestamp="${msgTimestamp}">
                    <div class="max-w-xs">
                        <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-2 rounded-lg text-sm">
                            ${text}
                        </div>
                        <div class="text-xs text-gray-500 mt-1 text-right flex items-center justify-end space-x-1">
                            <span>${time}</span>
                            <span class="${isRead ? 'text-green-500' : 'text-gray-400'}">${statusIcon}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (sender === 'system') {
            messageDiv.innerHTML = `
                <div class="flex justify-center mb-3" data-message-timestamp="${msgTimestamp}">
                    <div class="max-w-xs">
                        <div class="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm text-center">
                            ${text}
                        </div>
                        <div class="text-xs text-gray-500 mt-1 text-center">Sistem • ${time}</div>
                    </div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="flex justify-start mb-3" data-message-timestamp="${msgTimestamp}">
                    <div class="max-w-xs">
                        <div class="bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm shadow-sm">
                            ${text}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">Destek • ${time}</div>
                    </div>
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Sticky header'ı güncelle
        this.updateStickyDateHeader();
        
        // Add to messages array
        this.messages.push({
            text,
            sender,
            timestamp: msgTimestamp,
            user: this.currentUser,
            status: messageData?.adminStatus || messageData?.userStatus || 'sent'
        });
    }

    async saveMessageToSupabase(message) {
        try {
            if (window.supabase) {
                console.log('💬 Saving user message to Supabase:', message);
                
                // Check if guest user
                if (this.isGuest || (window.guestUserManager && window.guestUserManager.isGuestUser(this.currentUser))) {
                    // Save guest user message
                    await this.saveGuestMessageToSupabase(message);
                    return;
                }
                
                // Get current user's chat messages
                const { data: userData, error: userError } = await window.supabase
                    .from('users')
                    .select('chat_messages')
                    .eq('username', this.currentUser)
                    .single();

                if (userError) {
                    console.error('❌ Error getting user chat messages:', userError);
                    // Fallback to localStorage
                    this.saveToLocalStorage(message);
                    return;
                }

                // Parse existing chat messages or create new array
                let chatMessages = userData.chat_messages ? JSON.parse(userData.chat_messages) : [];
                
                // Add user message
                chatMessages.push({
                    message: message,
                    sender: 'user',
                    timestamp: new Date().toISOString(),
                    adminStatus: 'unread', // Admin henüz okumadı
                    userStatus: 'sent'     // User gönderdi
                });

                // Update user's chat messages
                const { error: updateError } = await window.supabase
                    .from('users')
                    .update({ 
                        chat_messages: JSON.stringify(chatMessages),
                        last_chat_update: new Date().toISOString()
                    })
                    .eq('username', this.currentUser);

                if (updateError) {
                    console.error('❌ Error updating user chat messages:', updateError);
                    // Fallback to localStorage
                    this.saveToLocalStorage(message);
                } else {
                    console.log('✅ User message saved to chat successfully');
                    
                    // Update local messages array
                    this.messages = chatMessages;
                }
            } else {
                // Fallback to localStorage
                this.saveToLocalStorage(message);
            }
        } catch (error) {
            console.error('❌ Error saving message:', error);
            this.saveToLocalStorage(message);
        }
    }

    async saveGuestMessageToSupabase(message) {
        try {
            if (!window.supabase) {
                this.saveGuestMessageToLocalStorage(message);
                return;
            }

            console.log('💬 Saving guest user message to Supabase:', message);
            
            // Get client IP
            const clientIP = await window.guestUserManager.getClientIP();
            
            // Try to get guest chat from guest_chats table
            const { data: guestChatData, error: getError } = await window.supabase
                .from('guest_chats')
                .select('*')
                .eq('username', this.currentUser)
                .single();

            let chatMessages = [];
            
            if (getError && getError.code === 'PGRST116') {
                // Guest chat doesn't exist, create new one
                const newGuestChat = {
                    username: this.currentUser,
                    ip_address: clientIP,
                    chat_messages: JSON.stringify([{
                        message: message,
                        sender: 'user',
                        timestamp: new Date().toISOString(),
                        adminStatus: 'unread',
                        userStatus: 'sent'
                    }]),
                    last_chat_update: new Date().toISOString(),
                    created_at: new Date().toISOString()
                };

                const { error: insertError } = await window.supabase
                    .from('guest_chats')
                    .insert([newGuestChat]);

                if (insertError) {
                    console.error('❌ Error creating guest chat:', insertError);
                    this.saveGuestMessageToLocalStorage(message);
                    return;
                }

                chatMessages = [newGuestChat.chat_messages];
            } else if (getError) {
                console.error('❌ Error getting guest chat:', getError);
                this.saveGuestMessageToLocalStorage(message);
                return;
            } else {
                // Guest chat exists, update it
                chatMessages = guestChatData.chat_messages ? JSON.parse(guestChatData.chat_messages) : [];
                
                chatMessages.push({
                    message: message,
                    sender: 'user',
                    timestamp: new Date().toISOString(),
                    adminStatus: 'unread',
                    userStatus: 'sent'
                });

                const { error: updateError } = await window.supabase
                    .from('guest_chats')
                    .update({
                        chat_messages: JSON.stringify(chatMessages),
                        last_chat_update: new Date().toISOString()
                    })
                    .eq('username', this.currentUser);

                if (updateError) {
                    console.error('❌ Error updating guest chat:', updateError);
                    this.saveGuestMessageToLocalStorage(message);
                    return;
                }
            }

            console.log('✅ Guest message saved successfully');
            this.messages = chatMessages;
            
            // Update last seen
            if (window.guestUserManager) {
                await window.guestUserManager.updateGuestUserLastSeen(this.currentUser);
            }
        } catch (error) {
            console.error('❌ Error saving guest message:', error);
            this.saveGuestMessageToLocalStorage(message);
        }
    }

    saveGuestMessageToLocalStorage(message) {
        const guestChats = JSON.parse(localStorage.getItem('guestChats') || '{}');
        
        if (!guestChats[this.currentUser]) {
            guestChats[this.currentUser] = {
                username: this.currentUser,
                chat_messages: [],
                created_at: new Date().toISOString()
            };
        }

        guestChats[this.currentUser].chat_messages.push({
            message: message,
            sender: 'user',
            timestamp: new Date().toISOString(),
            adminStatus: 'unread',
            userStatus: 'sent'
        });

        guestChats[this.currentUser].last_chat_update = new Date().toISOString();
        
        localStorage.setItem('guestChats', JSON.stringify(guestChats));
        console.log('✅ Guest message saved to localStorage');
    }

    async loadGuestChatHistory() {
        try {
            console.log('💬 Loading guest chat history for:', this.currentUser);
            
            if (window.supabase && this.currentUser) {
                // Try to load from Supabase guest_chats table
                const { data: guestChatData, error } = await window.supabase
                    .from('guest_chats')
                    .select('*')
                    .eq('username', this.currentUser)
                    .single();

                if (!error && guestChatData && guestChatData.chat_messages) {
                    const chatMessages = JSON.parse(guestChatData.chat_messages);
                    console.log('✅ Loaded guest chat messages from Supabase:', chatMessages);
                    
                    // Clear existing messages
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '';
                    }
                    
                    // Reset last rendered date
                    this.lastRenderedDate = null;
                    
                    // Update messages array
                    this.messages = chatMessages;
                    
                    // Render all messages
                    if (chatMessages.length === 0) {
                        this.showEmptyState();
                    } else {
                        chatMessages.forEach(msg => {
                            if (msg.sender === 'user') {
                                this.addMessage(msg.message, 'user', msg.timestamp, {
                                    adminStatus: msg.adminStatus || 'unread',
                                    userStatus: msg.userStatus || 'sent'
                                });
                            } else if (msg.sender === 'admin') {
                                this.addMessage(msg.message, 'admin', msg.timestamp, {
                                    adminStatus: msg.adminStatus || 'sent',
                                    userStatus: msg.userStatus || 'unread'
                                });
                            }
                        });
                    }
                    
                    // Scroll to bottom
                    this.scrollToBottom();
                    
                    // Record existing messages
                    if (!this.initialLoadComplete) {
                        this.recordExistingMessages(chatMessages);
                        this.checkForOfflineMessages(chatMessages);
                        this.initialLoadComplete = true;
                    } else {
                        this.checkForNewAdminMessages(chatMessages);
                    }
                    return;
                }
            }
            
            // Fallback to localStorage
            const guestChats = JSON.parse(localStorage.getItem('guestChats') || '{}');
            if (guestChats[this.currentUser] && guestChats[this.currentUser].chat_messages) {
                const chatMessages = guestChats[this.currentUser].chat_messages;
                console.log('✅ Loaded guest chat messages from localStorage:', chatMessages);
                
                // Clear existing messages
                const messagesContainer = document.getElementById('chatMessages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
                
                // Reset last rendered date
                this.lastRenderedDate = null;
                
                // Update messages array
                this.messages = chatMessages;
                
                // Render all messages
                if (chatMessages.length === 0) {
                    this.showEmptyState();
                } else {
                    chatMessages.forEach(msg => {
                        if (msg.sender === 'user') {
                            this.addMessage(msg.message, 'user', msg.timestamp, {
                                adminStatus: msg.adminStatus || 'unread',
                                userStatus: msg.userStatus || 'sent'
                            });
                        } else if (msg.sender === 'admin') {
                            this.addMessage(msg.message, 'admin', msg.timestamp, {
                                adminStatus: msg.adminStatus || 'sent',
                                userStatus: msg.userStatus || 'unread'
                            });
                        }
                    });
                }
                
                // Scroll to bottom
                this.scrollToBottom();
                
                // Setup sticky header
                this.setupStickyDateHeader();
                
                // Record existing messages
                if (!this.initialLoadComplete) {
                    this.recordExistingMessages(chatMessages);
                    this.checkForOfflineMessages(chatMessages);
                    this.initialLoadComplete = true;
                } else {
                    this.checkForNewAdminMessages(chatMessages);
                }
            } else {
                // No chat history
                const messagesContainer = document.getElementById('chatMessages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
                this.messages = [];
                // Show empty state
                this.showEmptyState();
            }
        } catch (error) {
            console.error('❌ Error loading guest chat history:', error);
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
            this.messages = [];
            // Show empty state
            this.showEmptyState();
        }
    }

    saveToLocalStorage(message) {
        const messages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        messages.push({
            username: this.currentUser,
            message: message,
            sender: 'user',
            status: 'sent',
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString()
        });
        localStorage.setItem('chatMessages', JSON.stringify(messages));
        console.log('✅ Message saved to localStorage:', message);
    }

    async loadChatHistory() {
        try {
            console.log('🔄 LOADING CHAT HISTORY - Current user:', this.currentUser, 'isGuest:', this.isGuest);
            console.log('🔄 Supabase available:', !!window.supabase);
            
            // Check if guest user
            if (this.isGuest || (window.guestUserManager && window.guestUserManager.isGuestUser(this.currentUser))) {
                await this.loadGuestChatHistory();
                return;
            }
            
            if (window.supabase && this.currentUser) {
                console.log('💬 Loading chat history from Supabase ONLY for user:', this.currentUser);
                
                // Get user's chat messages from Supabase - ONLY SOURCE OF TRUTH
                const { data: userData, error: userError } = await window.supabase
                    .from('users')
                    .select('username, chat_messages')
                    .eq('username', this.currentUser)
                    .single();

                console.log('🔍 Supabase user lookup result:', { userData, userError });
                console.log('🔍 Raw chat_messages:', userData?.chat_messages);

                if (userError) {
                    console.error('❌ User not found in Supabase:', userError);
                    // Clear messages - no fallback to localStorage
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '';
                    }
                    this.messages = [];
                    return;
                }

                if (userData && userData.chat_messages) {
                    try {
                        const chatMessages = JSON.parse(userData.chat_messages);
                        console.log('✅ Loaded chat messages from Supabase:', chatMessages);
                    
                    // Clear existing messages
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '';
                    }
                    
                    // Reset last rendered date
                    this.lastRenderedDate = null;
                    
                    // Update messages array
                    this.messages = chatMessages;
                    
                        // Render all messages with correct status
                        if (chatMessages.length === 0) {
                            this.showEmptyState();
                        } else {
                            chatMessages.forEach(msg => {
                                if (msg.sender === 'user') {
                                    this.addMessage(msg.message, 'user', msg.timestamp, {
                                        adminStatus: msg.adminStatus || 'unread',
                                        userStatus: msg.userStatus || 'sent'
                                    });
                                } else if (msg.sender === 'admin') {
                                    this.addMessage(msg.message, 'admin', msg.timestamp, {
                                        adminStatus: msg.adminStatus || 'sent',
                                        userStatus: msg.userStatus || 'unread'
                                    });
                                }
                            });
                        }
                    
                    // Scroll to bottom
                    this.scrollToBottom();
                    
                    // Setup sticky header
                    this.setupStickyDateHeader();
                        
                        console.log('✅ Rendered', chatMessages.length, 'messages from Supabase');
                        
                        // İlk yükleme ise mevcut mesajları kaydet ama kullanıcı offline'ken gelen mesajları kontrol et
                        if (!this.initialLoadComplete) {
                            console.log('🔍 INITIAL LOAD - Recording existing messages, checking for offline messages');
                            this.recordExistingMessages(chatMessages);
                            this.checkForOfflineMessages(chatMessages);
                            this.initialLoadComplete = true;
                        } else {
                            // Sonraki yüklemeler - yeni mesajları kontrol et
                            this.checkForNewAdminMessages(chatMessages);
                        }
                        
                    } catch (parseError) {
                        console.error('❌ Error parsing chat messages:', parseError);
                        // Clear on error
                        const messagesContainer = document.getElementById('chatMessages');
                        if (messagesContainer) {
                            messagesContainer.innerHTML = '';
                        }
                        this.messages = [];
                    }
                } else {
                    console.log('⚠️ User exists but no chat_messages');
                    // Clear messages
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '';
                    }
                    this.messages = [];
                    // Show empty state
                    this.showEmptyState();
                }
            } else {
                console.log('💬 No Supabase or user, clearing chat');
                const messagesContainer = document.getElementById('chatMessages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
                this.messages = [];
                // Show empty state
                this.showEmptyState();
            }
            
        } catch (error) {
            console.error('❌ Error loading chat history:', error);
            // Clear on error
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
            this.messages = [];
            // Show empty state
            this.showEmptyState();
        }
    }

    recordExistingMessages(chatMessages) {
        // Mevcut tüm mesajları kaydet - bu mesajlar için BİLDİRİM YOK
        this.lastKnownMessageIds.clear();
        chatMessages.forEach(msg => {
            const msgId = msg.timestamp + msg.sender + msg.message;
            this.lastKnownMessageIds.add(msgId);
        });
        console.log('📝 Recorded', this.lastKnownMessageIds.size, 'existing messages');
    }

    checkForNewAdminMessages(chatMessages) {
        // Gerçekten YENİ olan admin mesajları bul
        const newAdminMessages = chatMessages.filter(msg => {
            const msgId = msg.timestamp + msg.sender + msg.message;
            return msg.sender === 'admin' && !this.lastKnownMessageIds.has(msgId);
        });
        
        if (newAdminMessages.length > 0) {
            console.log('🔔 GERÇEK YENİ admin mesajları:', newAdminMessages);
            
            // Yeni mesajları kaydet
            newAdminMessages.forEach(msg => {
                const msgId = msg.timestamp + msg.sender + msg.message;
                this.lastKnownMessageIds.add(msgId);
            });
            
            // Bildirim göster (sadece chat kapalıysa)
            if (!this.isOpen) {
                console.log('🔔 Chat kapalı, bildirim gösteriliyor');
                this.hasUnreadMessages = true;
                this.startChatButtonAnimation();
                this.showUnreadMessageBadge();
                this.showChatNotification();
                this.playEnhancedNotificationSound();
            } else {
                console.log('🔔 Chat açık, sadece refresh');
            }
        } else {
            console.log('✅ Yeni admin mesajı yok');
        }
        
        // Tüm mesajları güncelle
        chatMessages.forEach(msg => {
            const msgId = msg.timestamp + msg.sender + msg.message;
            this.lastKnownMessageIds.add(msgId);
        });
    }

    checkForOfflineMessages(chatMessages) {
        console.log('🔍 OFFLINE MESAJ KONTROLÜ başlatılıyor...');
        
        // Kullanıcı offline'ken gelen admin mesajları kontrol et
        const adminMessages = chatMessages.filter(msg => msg.sender === 'admin');
        
        console.log('🔍 Toplam admin mesajı:', adminMessages.length);
        
        if (adminMessages.length > 0) {
            // UNREAD olan admin mesajlarını bul - BASİT KONTROL!
            const unreadAdminMessages = adminMessages.filter(msg => msg.userStatus === 'unread');
            
            console.log('🔔 UNREAD admin mesajları:', unreadAdminMessages.length);
            
            if (unreadAdminMessages.length > 0) {
                console.log('🔔 UNREAD MESAJ VAR - BİLDİRİM GÖSTERİLİYOR!');
                console.log('🔔 Unread mesaj:', unreadAdminMessages[unreadAdminMessages.length - 1].message);
                
                // UNREAD mesaj varsa KESINLIKLE bildirim göster!
                this.hasUnreadMessages = true;
                this.startChatButtonAnimation();
                this.showUnreadMessageBadge();
                this.showChatNotification();
                this.playEnhancedNotificationSound();
            } else {
                console.log('✅ Tüm admin mesajları read, bildirim yok');
            }
        } else {
            console.log('✅ Admin mesajı yok');
        }
    }

    async markUserMessagesAsRead() {
        // Admin opened chat - mark all user messages as read (green tick)
        if (!window.supabase || !this.currentUser) return;
        
        try {
            console.log('✅ Admin viewing chat - marking user messages as read');
            
            // Get current messages
            const { data: userData, error: userError } = await window.supabase
                .from('users')
                .select('chat_messages')
                .eq('username', this.currentUser)
                .single();

            if (!userError && userData && userData.chat_messages) {
                let chatMessages = JSON.parse(userData.chat_messages);
                
                // Mark all user messages as read by admin
                chatMessages.forEach(msg => {
                    if (msg.sender === 'user') {
                        msg.adminStatus = 'read'; // Admin okudu
                    }
                });
                
                // Update in Supabase
                await window.supabase
                    .from('users')
                    .update({ 
                        chat_messages: JSON.stringify(chatMessages),
                        last_chat_update: new Date().toISOString()
                    })
                    .eq('username', this.currentUser);
                
                console.log('✅ User messages marked as read');
                
                // Refresh chat to show green ticks
                this.loadChatHistory();
            }
        } catch (error) {
            console.error('❌ Error marking messages as read:', error);
        }
    }

    loadChatHistoryFromLocalStorage() {
        console.log('💬 Loading chat history from localStorage for user:', this.currentUser);
        
        // Debug: Check all localStorage keys
        console.log('🔍 All localStorage keys:');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            console.log(`  ${key}:`, value?.substring(0, 100) + (value?.length > 100 ? '...' : ''));
        }
        
        // Try different localStorage keys where messages might be stored
        const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        const messages = JSON.parse(localStorage.getItem('messages') || '[]');
        const globalMessages = JSON.parse(localStorage.getItem('globalMessages') || '[]');
        const userMessages = JSON.parse(localStorage.getItem('userMessages') || '[]');
        const adminMessages = JSON.parse(localStorage.getItem('adminMessages') || '[]');
        
        console.log('💬 Raw localStorage data:', {
            chatMessages: chatMessages,
            messages: messages,
            globalMessages: globalMessages,
            userMessages: userMessages,
            adminMessages: adminMessages
        });
        
        // Filter messages for current user
        const userChatMessages = chatMessages.filter(msg => msg.username === this.currentUser);
        const userFilteredMessages = messages.filter(msg => msg.username === this.currentUser);
        const globalFilteredMessages = globalMessages.filter(msg => msg.username === this.currentUser);
        const filteredUserMessages = userMessages.filter(msg => msg.username === this.currentUser);
        const filteredAdminMessages = adminMessages.filter(msg => msg.username === this.currentUser);
        
        console.log('💬 Filtered messages for user:', this.currentUser, {
            chatMessages: userChatMessages.length,
            messages: userFilteredMessages.length,
            globalMessages: globalFilteredMessages.length,
            userMessages: filteredUserMessages.length,
            adminMessages: filteredAdminMessages.length
        });
        
        // Also check if there are messages without username filter (current user might be stored differently)
        console.log('💬 All messages without username filter:', {
            chatMessagesTotal: chatMessages.length,
            messagesTotal: messages.length,
            globalMessagesTotal: globalMessages.length,
            userMessagesTotal: userMessages.length,
            adminMessagesTotal: adminMessages.length
        });
        
        // Combine and sort all messages
        const allMessages = [...userChatMessages, ...userFilteredMessages, ...globalFilteredMessages, ...filteredUserMessages, ...filteredAdminMessages];
        const sortedMessages = allMessages.sort((a, b) => new Date(a.created_at || a.timestamp) - new Date(b.created_at || b.timestamp));
        
        // Clear existing messages
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        // Render all messages
        sortedMessages.forEach(msg => {
            const sender = msg.sender || (msg.message ? 'user' : 'admin');
            const messageText = msg.message || msg.content;
            const timestamp = msg.timestamp || msg.created_at;
            
            if (messageText) {
                this.addMessage(
                    messageText, 
                    sender, 
                    new Date(timestamp).toLocaleTimeString('tr-TR'), 
                    msg.status || 'sent'
                );
            }
        });
        
        // Scroll to bottom
        this.scrollToBottom();
        
        console.log('✅ Loaded', sortedMessages.length, 'messages from localStorage');
    }

    setupRealTimeUpdates() {
        // Aggressive real-time updates for instant messaging experience
        setInterval(() => {
            if (this.currentUser) {
                this.checkForNewMessages();
            }
        }, 3000); // Check every 3 seconds for near real-time
    }

    setupChatRealtime() {
        if (!window.supabase) {
            console.warn('⚠️ Supabase not available for realtime');
            return;
        }

        // Check if supabase is a client instance (has channel method)
        let supabaseClient = window.supabase;
        if (typeof supabaseClient.channel !== 'function') {
            console.warn('⚠️ Supabase client channel method not available');
            return;
        }
        
        console.log('🔔 Setting up chat realtime subscription for user:', this.currentUser);
        
        // Remove existing subscription if any
        if (this.chatSubscription && typeof supabaseClient.removeChannel === 'function') {
            supabaseClient.removeChannel(this.chatSubscription);
        }
        
        // Subscribe to users table changes for this specific user
        this.chatSubscription = supabaseClient
            .channel('user-chat-updates')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'users',
                filter: `username=eq.${this.currentUser}`
            }, (payload) => {
                console.log('🔔 Chat update received for user:', payload);
                this.handleChatUpdate(payload);
            })
            .subscribe();
        
        console.log('✅ User chat realtime subscription established');
    }

    handleChatUpdate(payload) {
        console.log('🔔 Handling chat update for user:', payload.new.username);
        
        if (payload.new.chat_messages) {
            try {
                const chatMessages = JSON.parse(payload.new.chat_messages);
                console.log('✅ New chat messages:', chatMessages);
                
                // Check if there are new admin messages
                const currentMessages = this.messages.length;
                const newAdminMessages = chatMessages.filter(msg => 
                    msg.sender === 'admin' && 
                    !this.messages.some(existingMsg => 
                        existingMsg.message === msg.message && 
                        existingMsg.timestamp === msg.timestamp
                    )
                );
                
                if (newAdminMessages.length > 0) {
                    console.log('🔔 New admin messages detected:', newAdminMessages);
                    
                    // Add new admin messages to UI
                    newAdminMessages.forEach(msg => {
                        this.addMessage(msg.message, 'admin', msg.timestamp, msg.status);
                    });
                    
                    // Mark as unread and show notification
                    this.hasUnreadMessages = true;
                    this.startChatButtonAnimation();
                    
                    // Show notification if chat is closed
                    if (!this.isOpen) {
                        this.showChatNotification();
                        this.showUnreadMessageBadge();
                    }
                }
                
                // Update messages array
                this.messages = chatMessages;
                
            } catch (error) {
                console.error('❌ Error parsing chat messages:', error);
            }
        }
    }

    showChatNotification() {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.chat-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        // Show a professional notification that new message arrived
        const notification = document.createElement('div');
        notification.className = 'chat-notification fixed top-4 right-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 transform transition-all duration-300 ease-in-out';
        notification.style.transform = 'translateX(100%)';
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L3 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <div>
                    <h4 class="font-semibold text-sm">Yeni Mesaj!</h4>
                    <p class="text-xs opacity-90">Destek ekibinden mesajınız var</p>
                </div>
                <button onclick="event.stopPropagation(); this.parentElement.parentElement.remove();" class="ml-2 text-white hover:text-gray-200 transition-colors">
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
        
        // Add click to open chat
        notification.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SVG' && e.target.tagName !== 'PATH') {
                this.openChat();
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
        
        // Sound will be played by caller, don't duplicate here
    }

    playNotificationSound() {
        try {
            // Create a simple notification sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.log('Notification sound not supported');
        }
    }

    playEnhancedNotificationSound() {
        try {
            // Admin paneldeki ile AYNI ses - 3 tonlu güzel bildirim
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
            
            console.log('🔊 Enhanced notification sound played (same as admin)');
        } catch (error) {
            console.log('Enhanced notification sound not supported');
            // Fallback to simple sound
            this.playNotificationSound();
        }
    }

    async checkForNewMessages() {
        try {
            if (window.supabase && this.currentUser) {
                // Check if guest user
                const isGuest = this.isGuest || (window.guestUserManager && window.guestUserManager.isGuestUser(this.currentUser));
                
                let data = null;
                let error = null;
                
                if (isGuest) {
                    // Guest kullanıcı için guest_chats tablosunu kontrol et
                    const { data: guestData, error: guestError } = await window.supabase
                        .from('guest_chats')
                        .select('chat_messages, last_chat_update')
                        .eq('username', this.currentUser)
                        .maybeSingle();
                    
                    data = guestData;
                    error = guestError;
                } else {
                    // Kayıtlı kullanıcı için users tablosunu kontrol et
                    const { data: userData, error: userError } = await window.supabase
                        .from('users')
                        .select('chat_messages, last_chat_update')
                        .eq('username', this.currentUser)
                        .maybeSingle();
                    
                    data = userData;
                    error = userError;
                }

                if (error) {
                    // PGRST116 = no rows found, bu normal (guest user için)
                    if (error.code !== 'PGRST116') {
                        console.error('❌ Error checking for new messages:', error);
                    }
                    return;
                }

                if (data && data.chat_messages) {
                    const latestMessages = JSON.parse(data.chat_messages);
                    
                    // Compare with current messages to find new ones
                    const currentMessageCount = this.messages.length;
                    const latestMessageCount = latestMessages.length;
                    
                    // İlk yükleme tamamlanmışsa yeni mesajları kontrol et
                    if (this.initialLoadComplete) {
                        // Gerçekten yeni admin mesajları var mı kontrol et
                        const reallyNewAdminMessages = latestMessages.filter(msg => {
                            const msgId = msg.timestamp + msg.sender + msg.message;
                            return msg.sender === 'admin' && !this.lastKnownMessageIds.has(msgId);
                        });
                        
                        if (reallyNewAdminMessages.length > 0) {
                            console.log('🔔 REAL-TIME: NEW admin messages found!', reallyNewAdminMessages);
                            
                            // Yeni mesajları kaydet
                            reallyNewAdminMessages.forEach(msg => {
                                const msgId = msg.timestamp + msg.sender + msg.message;
                                this.lastKnownMessageIds.add(msgId);
                            });
                            
                            // Show notification if chat is closed
                            if (!this.isOpen) {
                                console.log('🔔 Chat kapalı, real-time bildirim gösteriliyor');
                                this.hasUnreadMessages = true;
                                this.startChatButtonAnimation();
                                this.showUnreadMessageBadge();
                                this.showChatNotification();
                                this.playEnhancedNotificationSound();
                            }
                            
                            // Refresh entire chat to maintain correct order and status
                            this.loadChatHistory();
                        }
                    } else {
                        console.log('🔍 Initial load not complete, skipping real-time check');
                    }
                    
                    // Also check for status updates (green tick changes)
                    if (this.messages.length === latestMessages.length) {
                        let statusChanged = false;
                        for (let i = 0; i < this.messages.length; i++) {
                            if (this.messages[i].status !== latestMessages[i].status) {
                                statusChanged = true;
                                break;
                            }
                        }
                        
                        if (statusChanged) {
                            console.log('🔄 Message status updated, refreshing chat');
                            this.loadChatHistory();
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error checking for new messages:', error);
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    startChatButtonAnimation() {
        const openChatBtn = document.getElementById('openChat');
        if (openChatBtn) {
            // ÖNCE POSİTİON'I SABİTLE!
            this.ensureChatButtonPosition();
            
            // Add pulsing animation
            openChatBtn.style.animation = 'pulse-notification 1.5s infinite';
            openChatBtn.style.backgroundColor = 'rgb(239 68 68)'; // Red color for notification
            openChatBtn.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.5)';
            
            // Add CSS animation if not exists
            if (!document.getElementById('chat-animation-styles')) {
                const style = document.createElement('style');
                style.id = 'chat-animation-styles';
                style.textContent = `
                    @keyframes pulse-notification {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                        100% { transform: scale(1); }
                    }
                    @keyframes shake {
                        0%, 100% { transform: translateX(0); }
                        25% { transform: translateX(-5px); }
                        75% { transform: translateX(5px); }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    stopChatButtonAnimation() {
        const openChatBtn = document.getElementById('openChat');
        if (openChatBtn) {
            // ÖNCE POSİTİON'I SABİTLE!
            this.ensureChatButtonPosition();
            
            openChatBtn.style.animation = '';
            openChatBtn.style.backgroundColor = 'rgb(59 130 246)'; // Original blue
            openChatBtn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
        }
        this.hideUnreadMessageBadge();
    }

    showUnreadMessageBadge() {
        const openChatBtn = document.getElementById('openChat');
        if (openChatBtn && !document.getElementById('unread-badge')) {
            const badge = document.createElement('div');
            badge.id = 'unread-badge';
            badge.style.position = 'fixed'; // FIXED kullan, relative değil!
            badge.style.bottom = 'calc(1rem + 50px)'; // Butonun üstünde
            badge.style.right = 'calc(1rem + 10px)'; // Butonun sağında
            badge.style.width = '24px';
            badge.style.height = '24px';
            badge.style.backgroundColor = 'rgb(239 68 68)';
            badge.style.borderRadius = '50%';
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.justifyContent = 'center';
            badge.style.color = 'white';
            badge.style.fontSize = '12px';
            badge.style.fontWeight = 'bold';
            badge.style.border = '2px solid white';
            badge.style.zIndex = '10001'; // Butondan daha yüksek
            badge.textContent = '!';
            
            // Badge'i body'e ekle, butona değil!
            document.body.appendChild(badge);
        }
    }

    hideUnreadMessageBadge() {
        const badge = document.getElementById('unread-badge');
        if (badge) {
            badge.remove();
        }
    }

    cleanupExistingNotifications() {
        // Remove any existing chat notifications
        const existingNotifications = document.querySelectorAll('.chat-notification');
        existingNotifications.forEach(notification => {
            console.log('🧹 Cleaning up existing notification');
            notification.remove();
        });
        
        // Remove any existing badges
        this.hideUnreadMessageBadge();
        
        console.log('🧹 Cleaned up existing notifications');
    }

    async markAdminMessagesAsReadByUser() {
        // Kullanıcı chat'i açtı - admin mesajlarını okudu
        if (!this.currentUser) return;
        
        // Check if guest user
        const isGuest = this.isGuest || (window.guestUserManager && window.guestUserManager.isGuestUser(this.currentUser));
        
        try {
            console.log('✅ User viewing chat - marking admin messages as read', isGuest ? '(guest)' : '');
            
            if (isGuest) {
                // Handle guest user
                if (window.supabase) {
                    const { data: guestChatData, error: guestError } = await window.supabase
                        .from('guest_chats')
                        .select('chat_messages')
                        .eq('username', this.currentUser)
                        .single();

                    if (!guestError && guestChatData && guestChatData.chat_messages) {
                        let chatMessages = JSON.parse(guestChatData.chat_messages);
                        let hasChanges = false;
                        
                        // Mark all admin messages as read by user
                        chatMessages.forEach(msg => {
                            if (msg.sender === 'admin' && msg.userStatus !== 'read') {
                                msg.userStatus = 'read'; // User okudu
                                hasChanges = true;
                            }
                        });
                        
                        if (hasChanges) {
                            // Update in Supabase
                            await window.supabase
                                .from('guest_chats')
                                .update({ 
                                    chat_messages: JSON.stringify(chatMessages),
                                    last_chat_update: new Date().toISOString()
                                })
                                .eq('username', this.currentUser);
                            
                            console.log('✅ Admin messages marked as read by guest user');
                            
                            // Refresh the chat display to show green ticks
                            setTimeout(() => {
                                this.loadChatHistory();
                            }, 200);
                        }
                    }
                } else {
                    // Fallback to localStorage
                    const guestChats = JSON.parse(localStorage.getItem('guestChats') || '{}');
                    if (guestChats[this.currentUser] && guestChats[this.currentUser].chat_messages) {
                        let chatMessages = guestChats[this.currentUser].chat_messages;
                        let hasChanges = false;
                        
                        chatMessages.forEach(msg => {
                            if (msg.sender === 'admin' && msg.userStatus !== 'read') {
                                msg.userStatus = 'read';
                                hasChanges = true;
                            }
                        });
                        
                        if (hasChanges) {
                            guestChats[this.currentUser].chat_messages = chatMessages;
                            guestChats[this.currentUser].last_chat_update = new Date().toISOString();
                            localStorage.setItem('guestChats', JSON.stringify(guestChats));
                            
                            setTimeout(() => {
                                this.loadChatHistory();
                            }, 200);
                        }
                    }
                }
                return;
            }
            
            // Regular user
            if (!window.supabase) return;
            
            // Get current messages
            const { data: userData, error: userError } = await window.supabase
                .from('users')
                .select('chat_messages')
                .eq('username', this.currentUser)
                .single();

            if (!userError && userData && userData.chat_messages) {
                let chatMessages = JSON.parse(userData.chat_messages);
                let hasChanges = false;
                
                // Mark all admin messages as read by user
                chatMessages.forEach(msg => {
                    if (msg.sender === 'admin' && msg.userStatus !== 'read') {
                        msg.userStatus = 'read'; // User okudu
                        hasChanges = true;
                    }
                });
                
                if (hasChanges) {
                    // Update in Supabase
                    await window.supabase
                        .from('users')
                        .update({ 
                            chat_messages: JSON.stringify(chatMessages),
                            last_chat_update: new Date().toISOString()
                        })
                        .eq('username', this.currentUser);
                    
                    console.log('✅ Admin messages marked as read by user');
                    
                    // Refresh the chat display to show green ticks
                    setTimeout(() => {
                        this.loadChatHistory();
                    }, 200);
                }
            }
        } catch (error) {
            console.error('❌ Error marking admin messages as read:', error);
        }
    }

    ensureChatButtonPosition() {
        // BUTONUN POSİTİONU HER ZAMAN SAĞ ALT KÖŞEDE OLMALI!
        const openChatBtn = document.getElementById('openChat');
        if (openChatBtn) {
            openChatBtn.style.position = 'fixed';
            openChatBtn.style.bottom = '1rem';
            openChatBtn.style.right = '1rem';
            openChatBtn.style.left = 'auto';
            openChatBtn.style.top = 'auto';
            openChatBtn.style.zIndex = '9999';
            console.log('🔧 Chat button position fixed to bottom-right');
        }
    }
    
    // Sticky tarih header için scroll event listener
    setupStickyDateHeader() {
        const chatMessagesArea = document.getElementById('chatMessages');
        const dateHeader = document.getElementById('chatDateHeader');
        
        if (!chatMessagesArea || !dateHeader) return;
        
        // Önceki scroll handler'ı temizle
        if (this.chatScrollHandler) {
            chatMessagesArea.removeEventListener('scroll', this.chatScrollHandler);
        }
        
        // Throttled scroll handler
        let ticking = false;
        this.chatScrollHandler = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.updateStickyDateHeader();
                    ticking = false;
                });
                ticking = true;
            }
        };
        
        chatMessagesArea.addEventListener('scroll', this.chatScrollHandler);
        
        // İlk yüklemede header'ı göster
        this.updateStickyDateHeader();
    }
    
    // Sticky header'ı görünen mesajların tarihine göre güncelle
    updateStickyDateHeader() {
        const chatMessagesArea = document.getElementById('chatMessages');
        const dateHeader = document.getElementById('chatDateHeader');
        const dateHeaderText = document.getElementById('chatDateHeaderText');
        
        if (!chatMessagesArea || !dateHeader || !dateHeaderText) {
            console.log('❌ Chat elements not found for sticky header');
            return;
        }
        
        const messages = chatMessagesArea.querySelectorAll('[data-message-timestamp]');
        console.log('🔍 Found messages:', messages.length);
        
        if (messages.length === 0) {
            dateHeader.classList.add('hidden');
            return;
        }
        
        // Scroll pozisyonuna göre görünen mesajları bul
        const scrollTop = chatMessagesArea.scrollTop;
        const containerHeight = chatMessagesArea.clientHeight;
        
        // En üstteki görünen mesajı bul
        let visibleMessage = null;
        let minDistance = Infinity;
        
        messages.forEach((msgElement) => {
            const rect = msgElement.getBoundingClientRect();
            const containerRect = chatMessagesArea.getBoundingClientRect();
            const elementTop = rect.top - containerRect.top + scrollTop;
            const elementBottom = elementTop + rect.height;
            
            // Mesaj görünür alanda mı? (viewport içinde)
            if (elementTop <= scrollTop + containerHeight && elementBottom >= scrollTop) {
                // En üstteki görünen mesajı bul
                const distance = Math.abs(elementTop - scrollTop);
                if (distance < minDistance) {
                    minDistance = distance;
                    visibleMessage = msgElement;
                }
            }
        });
        
        // Görünen mesaj bulunduysa header'ı göster
        if (visibleMessage) {
            const timestamp = visibleMessage.getAttribute('data-message-timestamp');
            if (timestamp) {
                try {
                    const formattedDate = this.formatChatDate(timestamp);
                    dateHeaderText.textContent = formattedDate;
                    dateHeader.classList.remove('hidden');
                    console.log('✅ Sticky header updated:', formattedDate);
                    return;
                } catch (e) {
                    console.error('❌ Error formatting date:', e);
                }
            }
        }
        
        // Fallback: İlk mesajın tarihini göster ve header'ı açık tut
        const firstMessage = messages[0];
        const timestamp = firstMessage.getAttribute('data-message-timestamp');
        if (timestamp) {
            try {
                const formattedDate = this.formatChatDate(timestamp);
                dateHeaderText.textContent = formattedDate;
                dateHeader.classList.remove('hidden');
                console.log('✅ Sticky header updated (fallback):', formattedDate);
            } catch (e) {
                console.error('❌ Error formatting date (fallback):', e);
            }
        } else {
            dateHeader.classList.add('hidden');
        }
    }
}

// Initialize chat system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 DOM Content Loaded - Initializing ChatSystem...');
    window.chatSystem = new ChatSystem();
});