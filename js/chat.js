// Sohbet Sistemi JavaScript
class ChatSystem {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.currentUser = null;
        this.chatSubscription = null;
        this.hasUnreadMessages = false;
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
                if (e.key === 'Enter') this.sendMessage();
            });
        }

        // Ensure chat button is always visible
        this.ensureChatButtonVisible();

        // Check if user is logged in
        this.checkUserStatus();
        
        // Load chat history
        this.loadChatHistory();
        
        // Set up real-time updates
        this.setupRealTimeUpdates();
        this.setupChatRealtime();
    }

    ensureChatButtonVisible() {
        const openChatBtn = document.getElementById('openChat');
        if (openChatBtn) {
            console.log('✅ Chat button found, ensuring visibility...');
            
            // Remove any hidden classes
            openChatBtn.classList.remove('hidden');
            
            // Force visibility with inline styles
            openChatBtn.style.position = 'fixed';
            openChatBtn.style.bottom = '1rem';
            openChatBtn.style.right = '1rem';
            openChatBtn.style.zIndex = '9999';
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

    checkUserStatus() {
        const session = window.authUtils?.checkAuth();
        if (session && session.username) {
            this.currentUser = session.username;
            this.updateChatHeader();
            console.log('🔍 Using authenticated user:', this.currentUser);
        } else {
            // Try to get username from localStorage or URL
            const storedUsername = localStorage.getItem('currentUser') || localStorage.getItem('username');
            const sessionData = JSON.parse(localStorage.getItem('session') || '{}');
            
            if (sessionData.username) {
                this.currentUser = sessionData.username;
                console.log('🔍 Using session username:', this.currentUser);
            } else if (storedUsername) {
                this.currentUser = storedUsername;
                console.log('🔍 Using stored username:', this.currentUser);
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

    openChat() {
        console.log('🔍 Opening chat...');
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
        
        // Mark messages as read
        this.hasUnreadMessages = false;
        this.stopChatButtonAnimation();
        
        // Focus on message input
        setTimeout(() => {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.focus();
            }
        }, 100);
        
        // Scroll to bottom
        this.scrollToBottom();
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
        this.addMessage(message, 'user', null, 'sent');
        if (messageInput) {
            messageInput.value = '';
        }
        
        // Save to Supabase and localStorage
        await this.saveMessageToSupabase(message);
        
        // Also save to localStorage as backup
        this.saveToLocalStorage(message);
    }

    addMessage(text, sender, timestamp = null, status = 'sent') {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        
        const time = timestamp || new Date().toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Get status icon (WhatsApp style)
        const getStatusIcon = (status) => {
            switch(status) {
                case 'pending': return '☑️'; // Gray checkbox
                case 'sent': return '☑️'; // Gray checkbox
                case 'delivered': return '☑️'; // Gray checkbox
                case 'read': return '✅'; // Green checkmark
                default: return '☑️';
            }
        };
        
        const statusIcon = getStatusIcon(status);
        const isRead = status === 'read';
        
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
                    status: 'sent'
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
            if (window.supabase && this.currentUser) {
                console.log('💬 Loading chat history from Supabase for user:', this.currentUser);
                
                // First check if user exists in Supabase
                const { data: userData, error: userError } = await window.supabase
                    .from('users')
                    .select('username, chat_messages')
                    .eq('username', this.currentUser)
                    .single();

                console.log('🔍 Supabase user lookup result:', { userData, userError });

                if (userError) {
                    console.error('❌ Error loading user from Supabase:', userError);
                    console.log('💬 User not found in Supabase, using localStorage');
                    this.loadChatHistoryFromLocalStorage();
                    return;
                }

                if (userData) {
                    console.log('✅ User found in Supabase:', userData.username);
                    
                    if (userData.chat_messages) {
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
                            
                            // Render all messages
                            chatMessages.forEach(msg => {
                                if (msg.sender === 'user') {
                                    this.addMessage(msg.message, 'user', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), msg.status);
                                } else if (msg.sender === 'admin') {
                                    this.addMessage(msg.message, 'admin', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), msg.status);
                                }
                            });
                            
                            // Scroll to bottom
                            this.scrollToBottom();
                            
                            console.log('✅ Rendered', chatMessages.length, 'messages from Supabase');
                            return; // Success, don't load from localStorage
                        } catch (parseError) {
                            console.error('❌ Error parsing chat messages:', parseError);
                            console.log('💬 Fallback to localStorage due to parse error');
                        }
                    } else {
                        console.log('⚠️ User exists but no chat_messages, trying localStorage');
                    }
                } else {
                    console.log('⚠️ No user data returned from Supabase');
                }
            } else {
                console.log('💬 Supabase not available, using localStorage for chat history');
            }
            
            // Fallback to localStorage
            this.loadChatHistoryFromLocalStorage();
            
        } catch (error) {
            console.error('❌ Error loading chat history:', error);
            this.loadChatHistoryFromLocalStorage();
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
        // More frequent real-time updates for better performance
        setInterval(() => {
            if (this.currentUser) {
                this.checkForNewMessages();
            }
        }, 10000); // Check every 10 seconds instead of 30
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
        
        // Play notification sound (if supported)
        this.playNotificationSound();
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

    async checkForNewMessages() {
        try {
            if (window.supabase) {
                console.log('💬 Checking for new messages');
                
                // Get user's chat messages from users table
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
                    const chatMessages = JSON.parse(data.chat_messages);
                    
                    // Check if there are new admin messages
                    const adminMessages = chatMessages.filter(msg => 
                        msg.sender === 'admin' && 
                        new Date(msg.timestamp) > new Date(Date.now() - 30000)
                    );
                    
                    if (adminMessages.length > 0) {
                        console.log('✅ New admin messages found:', adminMessages);
                        adminMessages.forEach(msg => {
                            this.addMessage(msg.message, 'admin', new Date(msg.timestamp).toLocaleTimeString('tr-TR'), msg.status);
                        });
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
            badge.className = 'absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold';
            badge.style.position = 'absolute';
            badge.style.top = '-8px';
            badge.style.right = '-8px';
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
            badge.style.zIndex = '10000';
            badge.textContent = '!';
            
            // Make button container relative
            openChatBtn.style.position = 'relative';
            openChatBtn.appendChild(badge);
        }
    }

    hideUnreadMessageBadge() {
        const badge = document.getElementById('unread-badge');
        if (badge) {
            badge.remove();
        }
    }
}

// Initialize chat system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 DOM Content Loaded - Initializing ChatSystem...');
    window.chatSystem = new ChatSystem();
});