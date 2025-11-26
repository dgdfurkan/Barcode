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
        this.init();
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
        const session = window.authUtils?.checkAuth();
        if (session && session.username) {
            this.currentUser = session.username;
            this.updateChatHeader();
            console.log('🔍 Using authenticated user:', this.currentUser);
        } else {
            // Try to get username from localStorage or URL
            const storedUsername = localStorage.getItem('currentUser') || localStorage.getItem('username');
            const tempChatUser = localStorage.getItem('tempChatUser'); // For trial expired users
            const sessionData = JSON.parse(localStorage.getItem('session') || '{}');
            
            if (sessionData.username) {
                this.currentUser = sessionData.username;
                console.log('🔍 Using session username:', this.currentUser);
            } else if (tempChatUser) {
                this.currentUser = tempChatUser;
                console.log('🔍 Using temp chat user (trial expired):', this.currentUser);
            } else if (storedUsername) {
                this.currentUser = storedUsername;
                console.log('🔍 Using stored username:', this.currentUser);
            } else {
                // Check for guest user (IP-based)
                if (window.guestUserManager) {
                    try {
                        const guestUser = await window.guestUserManager.getOrCreateGuestUser();
                        this.currentUser = guestUser;
                        this.isGuest = true;
                        console.log('🔍 Using guest user:', this.currentUser);
                    } catch (error) {
                        console.error('Error getting guest user:', error);
                        this.currentUser = 'ProductSearchUser';
                    }
                } else {
                    // Last resort: try to get from any auth-related localStorage
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
                    console.log('🔍 Final username resolution:', this.currentUser);
                }
            }
            this.updateChatHeader();
        }
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

    addMessage(text, sender, timestamp = null, messageData = null) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        
        const time = timestamp || new Date().toLocaleTimeString('tr-TR', { 
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
                <div class="flex justify-end">
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
                <div class="flex justify-center">
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
                <div class="flex justify-start">
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
        
        // Add to messages array
        this.messages.push({
            text,
            sender,
            timestamp: timestamp || new Date().toISOString(),
            user: this.currentUser,
            status: status
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
                    
                    // Update messages array
                    this.messages = chatMessages;
                    
                    // Render all messages
                    chatMessages.forEach(msg => {
                        if (msg.sender === 'user') {
                            this.addMessage(msg.message, 'user', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), {
                                adminStatus: msg.adminStatus || 'unread',
                                userStatus: msg.userStatus || 'sent'
                            });
                        } else if (msg.sender === 'admin') {
                            this.addMessage(msg.message, 'admin', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), {
                                adminStatus: msg.adminStatus || 'sent',
                                userStatus: msg.userStatus || 'unread'
                            });
                        }
                    });
                    
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
                
                // Update messages array
                this.messages = chatMessages;
                
                // Render all messages
                chatMessages.forEach(msg => {
                    if (msg.sender === 'user') {
                        this.addMessage(msg.message, 'user', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), {
                            adminStatus: msg.adminStatus || 'unread',
                            userStatus: msg.userStatus || 'sent'
                        });
                    } else if (msg.sender === 'admin') {
                        this.addMessage(msg.message, 'admin', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), {
                            adminStatus: msg.adminStatus || 'sent',
                            userStatus: msg.userStatus || 'unread'
                        });
                    }
                });
                
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
            } else {
                // No chat history
                const messagesContainer = document.getElementById('chatMessages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
                this.messages = [];
            }
        } catch (error) {
            console.error('❌ Error loading guest chat history:', error);
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
            this.messages = [];
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
                    
                    // Update messages array
                    this.messages = chatMessages;
                    
                        // Render all messages with correct status
                        chatMessages.forEach(msg => {
                            if (msg.sender === 'user') {
                                this.addMessage(msg.message, 'user', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), {
                                    adminStatus: msg.adminStatus || 'unread',
                                    userStatus: msg.userStatus || 'sent'
                                });
                            } else if (msg.sender === 'admin') {
                                this.addMessage(msg.message, 'admin', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), {
                                    adminStatus: msg.adminStatus || 'sent',
                                    userStatus: msg.userStatus || 'unread'
                                });
                            }
                        });
                    
                    // Scroll to bottom
                    this.scrollToBottom();
                        
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
                }
            } else {
                console.log('💬 No Supabase or user, clearing chat');
                const messagesContainer = document.getElementById('chatMessages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
                this.messages = [];
            }
            
        } catch (error) {
            console.error('❌ Error loading chat history:', error);
            // Clear on error
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
            this.messages = [];
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
        if (!window.supabase) return;
        
        console.log('🔔 Setting up chat realtime subscription for user:', this.currentUser);
        
        // Subscribe to users table changes for this specific user
        this.chatSubscription = window.supabase
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
                        this.addMessage(msg.message, 'admin', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), msg.status);
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
                // Get user's current chat messages from Supabase
                const { data, error } = await window.supabase
                    .from('users')
                    .select('chat_messages, last_chat_update')
                    .eq('username', this.currentUser)
                    .single();

                if (error) {
                    console.error('❌ Error checking for new messages:', error);
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
}

// Initialize chat system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 DOM Content Loaded - Initializing ChatSystem...');
    window.chatSystem = new ChatSystem();
});