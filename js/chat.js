// Sohbet Sistemi JavaScript
class ChatSystem {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.currentUser = null;
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
        
        // Set up real-time updates (simulated)
        this.setupRealTimeUpdates();
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
                openChatBtn.style.transform = 'scale(1.1)';
                openChatBtn.style.backgroundColor = 'rgb(37 99 235)';
            });
            
            openChatBtn.addEventListener('mouseleave', () => {
                openChatBtn.style.transform = 'scale(1)';
                openChatBtn.style.backgroundColor = 'rgb(59 130 246)';
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
        } else {
            // For product search page, use a default user
            this.currentUser = 'ProductSearchUser';
            console.log('🔍 Using default user for product search page');
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

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput?.value?.trim();
        
        if (!message) return;
        
        console.log('🔍 Sending message:', message);

        // Add message to UI immediately with pending status
        this.addMessage(message, 'user', null, 'pending');
        if (messageInput) {
            messageInput.value = '';
        }
        
        // Save to Supabase
        await this.saveMessageToSupabase(message);
        
        // Show estimated response time message
        setTimeout(() => {
            this.showEstimatedResponseTime();
        }, 1000);
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
                case 'pending': return '⏳'; // Clock icon
                case 'sent': return '✓'; // Single gray tick
                case 'delivered': return '✓✓'; // Double gray tick
                case 'read': return '✓✓'; // Double green tick (will be styled green)
                default: return '✓';
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
                const { data, error } = await window.supabase
                    .from('messages')
                    .insert([{
                        username: this.currentUser,
                        message: message,
                        subject: 'Sohbet Mesajı', // Add required subject field
                        status: 'pending',
                        created_at: new Date().toISOString()
                    }]);

                if (error) {
                    console.error('Error saving message:', error);
                    // Fallback to localStorage
                    this.saveToLocalStorage(message);
                }
            } else {
                // Fallback to localStorage
                this.saveToLocalStorage(message);
            }
        } catch (error) {
            console.error('Error saving message:', error);
            this.saveToLocalStorage(message);
        }
    }

    showEstimatedResponseTime() {
        const responses = [
            "⏰ Tahmini dönüş süremiz: 15-30 dakika",
            "📞 Destek ekibimiz mesajınızı gördüğünde dönecektir",
            "🕐 Ortalama yanıt süremiz: 20 dakika",
            "💬 Destek ekibimiz şu anda aktif, en kısa sürede dönüş yapacağız",
            "⏱️ Mesajınız alındı, destek ekibimiz size dönecek"
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        this.addMessage(response, 'system');
    }

    saveToLocalStorage(message) {
        const messages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        messages.push({
            username: this.currentUser,
            message: message,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        localStorage.setItem('chatMessages', JSON.stringify(messages));
    }

    async loadChatHistory() {
        try {
            if (window.supabase) {
                const { data, error } = await window.supabase
                    .from('messages')
                    .select('*')
                    .eq('username', this.currentUser)
                    .order('created_at', { ascending: true });

                if (!error && data) {
                    data.forEach(msg => {
                        if (msg.status === 'approved') {
                            this.addMessage(msg.message, 'user', new Date(msg.created_at).toLocaleTimeString('tr-TR'));
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    setupRealTimeUpdates() {
        // Simulate real-time updates every 30 seconds
        setInterval(() => {
            if (this.isOpen && this.currentUser) {
                this.checkForNewMessages();
            }
        }, 30000);
    }

    async checkForNewMessages() {
        try {
            if (window.supabase) {
                const { data, error } = await window.supabase
                    .from('messages')
                    .select('*')
                    .eq('username', this.currentUser)
                    .eq('status', 'approved')
                    .gte('created_at', new Date(Date.now() - 30000).toISOString());

                if (!error && data && data.length > 0) {
                    data.forEach(msg => {
                        this.addMessage(msg.message, 'admin', new Date(msg.created_at).toLocaleTimeString('tr-TR'));
                    });
                }
            }
        } catch (error) {
            console.error('Error checking for new messages:', error);
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}

// Initialize chat system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 DOM Content Loaded - Initializing ChatSystem...');
    window.chatSystem = new ChatSystem();
});