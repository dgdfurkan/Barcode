// Image Detection and Validation Utilities
const ImageUtils = {
    // Allowed image domains
    allowedDomains: ['freeimage.host', 'imgbb.com', 'iili.io', 'i.ibb.co'],
    
    // Detect if message contains image HTML
    detectImageInMessage(message) {
        if (!message || typeof message !== 'string') return null;
        
        // Check for <a><img> format
        const imgLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>\s*<img\s+[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>\s*<\/a>/i;
        const match = message.match(imgLinkRegex);
        
        if (match) {
            return {
                type: 'image',
                imageUrl: match[2], // img src
                linkUrl: match[1],  // a href
                alt: match[3] || ''
            };
        }
        
        // Also check for direct <img> tag
        const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/i;
        const imgMatch = message.match(imgRegex);
        
        if (imgMatch) {
            return {
                type: 'image',
                imageUrl: imgMatch[1],
                linkUrl: imgMatch[1],
                alt: imgMatch[2] || ''
            };
        }
        
        return null;
    },
    
    // Validate if image URL is from allowed domain
    isAllowedImageDomain(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // Check if hostname matches any allowed domain
            return this.allowedDomains.some(domain => {
                return hostname === domain || hostname.endsWith('.' + domain);
            });
        } catch (e) {
            // Invalid URL
            return false;
        }
    },
    
    // Extract image URL from HTML
    extractImageUrl(html) {
        const imageData = this.detectImageInMessage(html);
        return imageData ? imageData.imageUrl : null;
    },
    
    // Sanitize HTML to prevent XSS
    sanitizeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },
    
    // Check if message is an image message
    isImageMessage(message) {
        const imageData = this.detectImageInMessage(message);
        if (!imageData) return false;
        return this.isAllowedImageDomain(imageData.imageUrl);
    }
};

// WhatsApp-style Image Lightbox System
class ImageLightbox {
    constructor() {
        this.isOpen = false;
        this.currentImageUrl = null;
        this.currentImageAlt = null;
        this.zoomLevel = 1;
        this.minZoom = 0.5;
        this.maxZoom = 5;
        this.panStart = { x: 0, y: 0 };
        this.panOffset = { x: 0, y: 0 };
        this.isPanning = false;
        
        this.init();
    }
    
    init() {
        // Create lightbox modal if it doesn't exist
        if (!document.getElementById('imageLightbox')) {
            this.createLightbox();
        }
        
        // Event listeners
        this.setupEventListeners();
    }
    
    createLightbox() {
        const lightbox = document.createElement('div');
        lightbox.id = 'imageLightbox';
        lightbox.className = 'hidden fixed inset-0 bg-black bg-opacity-90 z-[99999] flex items-center justify-center';
        lightbox.innerHTML = `
            <div id="lightboxWrapper" class="relative w-full h-full flex items-center justify-center p-4">
                <!-- Top Right Controls -->
                <div class="absolute top-2 md:top-4 right-2 md:right-4 z-20 flex items-center space-x-2">
                    <!-- Download Button -->
                    <button id="lightboxDownloadBtn" class="bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-lg p-2 md:p-2.5 transition-all duration-200 shadow-lg hover:scale-110 active:scale-95" title="İndir">
                        <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                    </button>
                    <!-- Close Button -->
                    <button id="lightboxCloseBtn" class="bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-lg p-2 md:p-2.5 transition-all duration-200 shadow-lg hover:scale-110 active:scale-95" title="Kapat">
                        <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <!-- Left Side Zoom Controls -->
                <div class="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 z-20 flex flex-col items-center space-y-2 md:space-y-3 bg-black/50 backdrop-blur-md rounded-xl md:rounded-2xl px-2 md:px-3 py-3 md:py-4 shadow-2xl">
                    <!-- Zoom In -->
                    <button id="lightboxZoomIn" class="text-white hover:text-blue-300 transition-all duration-200 hover:scale-110 active:scale-95" title="Büyüt">
                        <svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 8v6m3-3H7"></path>
                        </svg>
                    </button>
                    
                    <!-- Zoom Level Display -->
                    <div class="flex flex-col items-center space-y-1">
                        <span id="lightboxZoomLevel" class="text-white text-xs font-semibold bg-white/20 rounded-full px-2.5 py-1 min-w-[3.5rem] text-center">100%</span>
                    </div>
                    
                    <!-- Zoom Out -->
                    <button id="lightboxZoomOut" class="text-white hover:text-blue-300 transition-all duration-200 hover:scale-110 active:scale-95" title="Küçült">
                        <svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
                        </svg>
                    </button>
                    
                    <!-- Divider -->
                    <div class="w-8 h-px bg-white/30 my-1"></div>
                    
                    <!-- Reset Zoom -->
                    <button id="lightboxResetZoom" class="text-white hover:text-yellow-300 transition-all duration-200 hover:scale-110 active:scale-95" title="Sıfırla">
                        <svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                    </button>
                </div>
                
                <!-- Image Container -->
                <div id="lightboxImageContainer" class="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <img id="lightboxImage" src="" alt="" class="max-w-full max-h-full object-contain transition-transform duration-200 cursor-move" style="transform: scale(1) translate(0, 0); pointer-events: auto;">
                    <div id="lightboxLoading" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(lightbox);
    }
    
    setupEventListeners() {
        // Close button
        document.getElementById('lightboxCloseBtn')?.addEventListener('click', () => this.close());
        
        // Download button
        document.getElementById('lightboxDownloadBtn')?.addEventListener('click', () => this.downloadImage());
        
        // Zoom controls
        document.getElementById('lightboxZoomIn')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('lightboxZoomOut')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('lightboxResetZoom')?.addEventListener('click', () => this.resetZoom());
        
        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Click outside image to close (but not on the image itself or controls)
        const lightbox = document.getElementById('imageLightbox');
        if (lightbox) {
            lightbox.addEventListener('click', (e) => {
                // Get the clicked element
                const clickedElement = e.target;
                
                // Don't close if clicking on:
                // - The image itself
                // - Any control buttons or their children
                // - Loading spinner
                const isImage = clickedElement.id === 'lightboxImage';
                const isControl = clickedElement.closest('button') !== null;
                const isLoading = clickedElement.id === 'lightboxLoading' || 
                                 clickedElement.closest('#lightboxLoading') !== null;
                
                // Close if clicking on:
                // - Lightbox background itself
                // - Wrapper div (empty space)
                // - Image container (but NOT the image itself - this means clicking on empty space in container)
                const isWrapper = clickedElement.id === 'lightboxWrapper';
                const isImageContainer = clickedElement.id === 'lightboxImageContainer';
                
                // If clicking on image container but NOT on the image itself, it means clicking on empty space
                if (isImageContainer && !isImage) {
                    this.close();
                    return;
                }
                
                // Close if clicking on lightbox background or wrapper (empty space)
                if (!isImage && !isControl && !isLoading) {
                    if (clickedElement === lightbox || isWrapper) {
                        this.close();
                    }
                }
            });
        }
        
        // Mouse wheel zoom
        const imageContainer = document.getElementById('lightboxImageContainer');
        if (imageContainer) {
            imageContainer.addEventListener('wheel', (e) => {
                if (this.isOpen) {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    this.setZoom(this.zoomLevel + delta);
                }
            }, { passive: false });
        }
        
        // Pan (drag) functionality
        this.setupPanning();
        
        // Right-click download
        const lightboxImage = document.getElementById('lightboxImage');
        if (lightboxImage) {
            lightboxImage.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.downloadImage();
            });
        }
    }
    
    setupPanning() {
        const imageContainer = document.getElementById('lightboxImageContainer');
        const lightboxImage = document.getElementById('lightboxImage');
        
        if (!imageContainer || !lightboxImage) return;
        
        imageContainer.addEventListener('mousedown', (e) => {
            if (this.zoomLevel > 1) {
                this.isPanning = true;
                this.panStart.x = e.clientX - this.panOffset.x;
                this.panStart.y = e.clientY - this.panOffset.y;
                imageContainer.style.cursor = 'grabbing';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isPanning && this.isOpen) {
                this.panOffset.x = e.clientX - this.panStart.x;
                this.panOffset.y = e.clientY - this.panStart.y;
                this.updateImageTransform();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                imageContainer.style.cursor = this.zoomLevel > 1 ? 'grab' : 'move';
            }
        });
    }
    
    open(imageUrl, imageAlt = '') {
        if (!imageUrl) return;
        
        this.currentImageUrl = imageUrl;
        this.currentImageAlt = imageAlt;
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        
        const lightbox = document.getElementById('imageLightbox');
        const lightboxImage = document.getElementById('lightboxImage');
        const lightboxLoading = document.getElementById('lightboxLoading');
        
        if (!lightbox || !lightboxImage) return;
        
        // Show loading
        lightboxLoading?.classList.remove('hidden');
        lightboxImage.style.opacity = '0';
        
        // Set image
        lightboxImage.src = imageUrl;
        lightboxImage.alt = imageAlt || 'Görsel';
        
        // Hide chat interface if it exists
        const chatInterface = document.getElementById('chatInterface');
        if (chatInterface) {
            chatInterface.style.zIndex = '40';
        }
        const openChatBtn = document.getElementById('openChat');
        if (openChatBtn) {
            openChatBtn.style.zIndex = '30';
        }
        
        // Show lightbox
        lightbox.classList.remove('hidden');
        this.isOpen = true;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Load image
        lightboxImage.onload = () => {
            lightboxLoading?.classList.add('hidden');
            lightboxImage.style.opacity = '1';
            this.resetZoom();
        };
        
        lightboxImage.onerror = () => {
            lightboxLoading?.classList.add('hidden');
            lightboxImage.alt = 'Görsel yüklenemedi';
            alert('Görsel yüklenemedi. Lütfen bağlantıyı kontrol edin.');
        };
    }
    
    close() {
        const lightbox = document.getElementById('imageLightbox');
        if (lightbox) {
            lightbox.classList.add('hidden');
            this.isOpen = false;
            document.body.style.overflow = '';
            this.currentImageUrl = null;
            this.currentImageAlt = null;
            
            // Restore chat interface z-index
            const chatInterface = document.getElementById('chatInterface');
            if (chatInterface) {
                chatInterface.style.zIndex = '';
            }
            const openChatBtn = document.getElementById('openChat');
            if (openChatBtn) {
                openChatBtn.style.zIndex = '';
            }
        }
    }
    
    zoomIn() {
        this.setZoom(this.zoomLevel + 0.25);
    }
    
    zoomOut() {
        this.setZoom(this.zoomLevel - 0.25);
    }
    
    setZoom(level) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        this.updateImageTransform();
        this.updateZoomDisplay();
    }
    
    resetZoom() {
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.updateImageTransform();
        this.updateZoomDisplay();
    }
    
    updateImageTransform() {
        const lightboxImage = document.getElementById('lightboxImage');
        if (lightboxImage) {
            lightboxImage.style.transform = `scale(${this.zoomLevel}) translate(${this.panOffset.x / this.zoomLevel}px, ${this.panOffset.y / this.zoomLevel}px)`;
        }
    }
    
    updateZoomDisplay() {
        const zoomLevelDisplay = document.getElementById('lightboxZoomLevel');
        if (zoomLevelDisplay) {
            zoomLevelDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }
    
    downloadImage() {
        if (!this.currentImageUrl) return;
        
        const link = document.createElement('a');
        link.href = this.currentImageUrl;
        link.download = this.currentImageAlt || 'image';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Expose ImageUtils globally
window.ImageUtils = ImageUtils;

// Initialize lightbox when DOM is ready
let imageLightbox;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        imageLightbox = new ImageLightbox();
        window.imageLightbox = imageLightbox;
    });
} else {
    imageLightbox = new ImageLightbox();
    window.imageLightbox = imageLightbox;
}

