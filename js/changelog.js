// Changelog System - Güncelleme Geçmişi Sistemi
// Supabase'den güncellemeleri çekerek timeline görünümünde gösterir

(function() {
    'use strict';

    class ChangelogSystem {
        constructor() {
            this.updates = [];
            this.isModalOpen = false;
        }

        async init() {
            console.log('📋 Changelog System initialized');
            
            // Wait for Supabase to be ready
            await this.waitForDb();
            
            // Load updates
            await this.loadUpdates();
        }

        async waitForDb(maxWait = 5000) {
            const startTime = Date.now();
            while (Date.now() - startTime < maxWait) {
                if (window.jbDb) {
                    console.log('✅ Supabase ready for changelog');
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.warn('⚠️ Supabase not available for changelog');
            return false;
        }

        async loadUpdates() {
            try {
                if (!window.jbDb) {
                    console.warn('Supabase not available');
                    return;
                }

                const { data, error } = await window.jbDb
                    .from('updates')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error loading updates:', error);
                    this.updates = [];
                    return;
                }

                this.updates = data || [];
                console.log(`📦 Loaded ${this.updates.length} updates for changelog`);
            } catch (error) {
                console.error('Error in loadUpdates:', error);
                this.updates = [];
            }
        }

        formatDate(dateString) {
            if (!dateString) return '';
            
            const date = new Date(dateString);
            const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
            
            const day = date.getDate();
            const month = months[date.getMonth()];
            const year = date.getFullYear();
            
            return `${day} ${month}, ${year}`;
        }

        isVideoUrl(url) {
            if (!url) return false;
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
            const lowerUrl = url.toLowerCase();
            return videoExtensions.some(ext => lowerUrl.includes(ext)) || 
                   lowerUrl.includes('video') || 
                   lowerUrl.match(/\.(mp4|webm|ogg|mov|avi)$/i);
        }

        isGoogleDriveUrl(url) {
            if (!url) return false;
            return url.includes('drive.google.com');
        }

        extractGoogleDriveFileId(url) {
            if (!url) return null;
            
            // Format 1: https://drive.google.com/file/d/FILE_ID/view
            // Format 2: https://drive.google.com/open?id=FILE_ID
            // Format 3: https://drive.google.com/uc?id=FILE_ID
            // Format 4: https://drive.google.com/file/d/FILE_ID/preview
            
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
                return url; // Normal URL, değiştirme
            }

            const fileId = this.extractGoogleDriveFileId(url);
            if (!fileId) {
                console.warn('⚠️ Could not extract Google Drive file ID from:', url);
                return url; // Fallback to original URL
            }

            if (isVideo) {
                // Google Drive video için alternatif linkler dene
                // Önce view linki, sonra download linki
                return `https://drive.google.com/uc?export=view&id=${fileId}`;
            } else {
                // Görsel için thumbnail linki (yüksek kalite)
                return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
            }
        }

        isCloudinaryUrl(url) {
            if (!url) return false;
            return url.includes('res.cloudinary.com');
        }

        renderMedia(step) {
            if (!step.image_url) return '';
            
            const originalUrl = step.image_url;
            const isDriveUrl = this.isGoogleDriveUrl(originalUrl);
            const isCloudinaryUrl = this.isCloudinaryUrl(originalUrl);
            
            // isVideo: önce step.is_video flag'i, sonra URL kontrolü
            let isVideo = step.is_video === true || step.is_video === 'true';
            
            if (!isVideo && !isDriveUrl && !isCloudinaryUrl) {
                // Drive ve Cloudinary dışı URL'ler için uzantı kontrolü
                isVideo = this.isVideoUrl(originalUrl);
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
                    <div class="changelog-media-container mt-4" id="changelog-media-${uniqueId}">
                        <video 
                            id="changelog-video-${uniqueId}"
                            src="${videoUrl}" 
                            poster="${imageUrl}"
                            class="changelog-video w-full rounded-lg shadow-md"
                            style="object-fit: contain; pointer-events: none; width: 100%; border-radius: 8px;"
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
                            id="changelog-fallback-${uniqueId}"
                            src="${imageUrl}" 
                            alt="${step.title || 'Görsel'}" 
                            class="changelog-image w-full rounded-lg shadow-md"
                            style="display: none; width: 100%; border-radius: 8px;"
                            loading="lazy"
                            onerror="this.onerror=null;this.src='${originalUrl}';">
                        <script>
                            (function() {
                                const video = document.getElementById('changelog-video-${uniqueId}');
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
                // Görsel için: Drive'dan thumbnail olarak göster
                return `
                    <div class="changelog-media-container mt-4">
                        <img 
                            src="${imageUrl}" 
                            alt="${step.title || 'Görsel'}" 
                            class="changelog-image w-full rounded-lg shadow-md"
                            loading="lazy"
                            onerror="this.onerror=null; this.src='${originalUrl}';">
                    </div>
                `;
            }
        }

        // Product Update JSON Parse Fonksiyonu
        parseProductUpdateJSON(description) {
            if (!description || !description.trim()) return null;
            
            try {
                // Description'dan JSON'u bul (tüm satırları kontrol et)
                const lines = description.split('\n');
                let jsonStart = -1;
                let jsonEnd = -1;
                let braceCount = 0;
                
                // JSON'un başlangıç ve bitişini bul
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.includes('"type"') && line.includes('"product_update"')) {
                        jsonStart = i;
                        braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                        if (braceCount === 0 && line.endsWith('}')) {
                            // Tek satırda JSON
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.type === 'product_update' && Array.isArray(parsed.products)) {
                                    return {
                                        products: parsed.products,
                                        display_type: parsed.display_type || 'grid'
                                    };
                                }
                            } catch (e) {
                                // Devam et
                            }
                        }
                    } else if (jsonStart !== -1) {
                        braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                        if (braceCount === 0 && line.includes('}')) {
                            jsonEnd = i;
                            break;
                        }
                    }
                }
                
                // JSON'u parse et
                if (jsonStart !== -1) {
                    const jsonLines = jsonEnd !== -1 
                        ? lines.slice(jsonStart, jsonEnd + 1)
                        : lines.slice(jsonStart);
                    const jsonString = jsonLines.join('\n');
                    
                    try {
                        const parsed = JSON.parse(jsonString);
                        if (parsed.type === 'product_update' && Array.isArray(parsed.products)) {
                            return {
                                products: parsed.products,
                                display_type: parsed.display_type || 'grid'
                            };
                        }
                    } catch (e) {
                        // JSON parse hatası, description'ın tamamını kontrol et
                        try {
                            const fullParsed = JSON.parse(description.trim());
                            if (fullParsed.type === 'product_update' && Array.isArray(fullParsed.products)) {
                                return {
                                    products: fullParsed.products,
                                    display_type: fullParsed.display_type || 'grid'
                                };
                            }
                        } catch (e2) {
                            // JSON değil, null döndür
                        }
                    }
                }
            } catch (error) {
                console.warn('Product update JSON parse hatası:', error);
            }
            
            return null;
        }

        // Product Update Render Fonksiyonu (Grid, List, Carousel, Orbit)
        renderProductUpdate(products, showAll = false, displayType = 'grid') {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            // Display type'a göre farklı render fonksiyonlarını çağır
            switch(displayType) {
                case 'list':
                    return this.renderProductUpdateList(products, showAll);
                case 'carousel':
                    return this.renderProductUpdateCarousel(products, showAll);
                case 'orbit':
                    return this.renderProductUpdateOrbit(products, showAll);
                case 'grid':
                default:
                    return this.renderProductUpdateGrid(products, showAll);
            }
        }

        // Grid Görünümü
        renderProductUpdateGrid(products, showAll = false) {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            // Responsive grid: Ekran boyutuna göre kaç ürün gösterileceğini hesapla
            let initialDisplayCount = 12; // Varsayılan: 3 sütun x 4 satır = 12
            if (typeof window !== 'undefined' && window.innerWidth) {
                if (window.innerWidth < 768) {
                    initialDisplayCount = 6; // Mobil: 2 sütun x 3 satır
                } else if (window.innerWidth < 1024) {
                    initialDisplayCount = 12; // Tablet: 3 sütun x 4 satır
                } else if (window.innerWidth < 1280) {
                    initialDisplayCount = 16; // Desktop: 4 sütun x 4 satır
                } else {
                    initialDisplayCount = 18; // Büyük ekran: 6 sütun x 3 satır
                }
            }
            
            const shouldShowAll = showAll || products.length <= initialDisplayCount;
            const displayProducts = shouldShowAll ? products : products.slice(0, initialDisplayCount);
            const remainingCount = products.length - initialDisplayCount;
            const uniqueId = 'product-update-' + Math.random().toString(36).substr(2, 9);
            
            // Products'ı string olarak sakla (onclick için) - UTF-8 uyumlu Base64 encode
            const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
            
            return `
                <div class="product-update-grid mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="grid">
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        ${displayProducts.map(product => {
                            const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                            const barcode = product.barcode || 'Barkod yok';
                            const image = product.image || '';
                            
                            return `
                                <div class="product-card bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex flex-col">
                                    <div class="product-card-image-container bg-gray-100 flex items-center justify-center flex-shrink-0" style="height: 120px; overflow: hidden;">
                                        ${image ? `
                                            <img src="${image}" 
                                                 alt="${productName}" 
                                                 class="product-card-image w-full h-full object-cover"
                                                 onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs\\'>Görsel Yok</div>';"
                                                 loading="lazy">
                                        ` : `
                                            <div class="text-gray-400 text-xs">Görsel Yok</div>
                                        `}
                                    </div>
                                    <div class="p-2 flex-1 flex flex-col">
                                        <div class="product-card-name font-medium text-xs text-gray-900 mb-1 flex-1" style="word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;">
                                            ${productName}
                                        </div>
                                        <div class="product-card-barcode text-xs text-gray-600 font-mono mt-auto">
                                            ${barcode}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${remainingCount > 0 && !shouldShowAll ? `
                        <div class="mt-4 text-center">
                            <button onclick="
                                (function() {
                                    const container = document.getElementById('${uniqueId}');
                                    if (!container) return;
                                    const productsBase64 = container.getAttribute('data-products');
                                    if (!productsBase64) return;
                                    try {
                                        const products = JSON.parse(decodeURIComponent(atob(productsBase64)));
                                        const displayType = container.getAttribute('data-display-type') || 'grid';
                                        if (window.changelogSystem) {
                                            container.innerHTML = window.changelogSystem.renderProductUpdate(products, true, displayType);
                                        }
                                    } catch(e) {
                                        console.error('Product update render error:', e);
                                    }
                                })();
                            " class="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer transition-colors px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 inline-block">
                                <span class="font-semibold">+${remainingCount} ürün daha</span> görmek için tıklayın
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // List Görünümü
        renderProductUpdateList(products, showAll = false) {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            let initialDisplayCount = 10;
            if (typeof window !== 'undefined' && window.innerWidth) {
                if (window.innerWidth < 768) {
                    initialDisplayCount = 5;
                } else if (window.innerWidth < 1024) {
                    initialDisplayCount = 8;
                } else {
                    initialDisplayCount = 10;
                }
            }
            
            const shouldShowAll = showAll || products.length <= initialDisplayCount;
            const displayProducts = shouldShowAll ? products : products.slice(0, initialDisplayCount);
            const remainingCount = products.length - initialDisplayCount;
            const uniqueId = 'product-update-list-' + Math.random().toString(36).substr(2, 9);
            const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
            
            return `
                <div class="product-update-list mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="list">
                    <div class="space-y-3">
                        ${displayProducts.map(product => {
                            const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                            const barcode = product.barcode || 'Barkod yok';
                            const image = product.image || '';
                            
                            return `
                                <div class="product-list-item bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300 flex items-center gap-4 p-3">
                                    <div class="product-list-image flex-shrink-0" style="width: 80px; height: 80px; overflow: hidden; border-radius: 8px; background: #f3f4f6;">
                                        ${image ? `
                                            <img src="${image}" 
                                                 alt="${productName}" 
                                                 class="w-full h-full object-cover"
                                                 onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs flex items-center justify-center h-full\\'>Görsel Yok</div>';"
                                                 loading="lazy">
                                        ` : `
                                            <div class="text-gray-400 text-xs flex items-center justify-center h-full">Görsel Yok</div>
                                        `}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="product-list-name font-medium text-sm text-gray-900 mb-1" style="word-wrap: break-word; overflow-wrap: break-word;">
                                            ${productName}
                                        </div>
                                        <div class="product-list-barcode text-xs text-gray-600 font-mono">
                                            ${barcode}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${remainingCount > 0 && !shouldShowAll ? `
                        <div class="mt-4 text-center">
                            <button onclick="
                                (function() {
                                    const container = document.getElementById('${uniqueId}');
                                    if (!container) return;
                                    const productsBase64 = container.getAttribute('data-products');
                                    if (!productsBase64) return;
                                    try {
                                        const products = JSON.parse(decodeURIComponent(atob(productsBase64)));
                                        const displayType = container.getAttribute('data-display-type') || 'list';
                                        if (window.changelogSystem) {
                                            container.innerHTML = window.changelogSystem.renderProductUpdate(products, true, displayType);
                                        }
                                    } catch(e) {
                                        console.error('Product update render error:', e);
                                    }
                                })();
                            " class="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer transition-colors px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 inline-block">
                                <span class="font-semibold">+${remainingCount} ürün daha</span> görmek için tıklayın
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Carousel Görünümü
        renderProductUpdateCarousel(products, showAll = false) {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            const uniqueId = 'product-update-carousel-' + Math.random().toString(36).substr(2, 9);
            const carouselId = 'carousel-' + uniqueId;
            const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
            const displayProducts = products;
            
            return `
                <div class="product-update-carousel mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="carousel">
                    <div class="relative">
                        <div id="${carouselId}" class="overflow-hidden rounded-lg">
                            <div class="flex transition-transform duration-500 ease-in-out" style="transform: translateX(0px);">
                                ${displayProducts.map((product, index) => {
                                    const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                                    const barcode = product.barcode || 'Barkod yok';
                                    const image = product.image || '';
                                    
                                    return `
                                        <div class="carousel-slide flex-shrink-0 w-full px-2">
                                            <div class="product-card bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col mx-auto" style="max-width: 300px;">
                                                <div class="product-card-image-container bg-gray-100 flex items-center justify-center flex-shrink-0" style="height: 200px; overflow: hidden;">
                                                    ${image ? `
                                                        <img src="${image}" 
                                                             alt="${productName}" 
                                                             class="product-card-image w-full h-full object-cover"
                                                             onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-sm\\'>Görsel Yok</div>';"
                                                             loading="lazy">
                                                    ` : `
                                                        <div class="text-gray-400 text-sm">Görsel Yok</div>
                                                    `}
                                                </div>
                                                <div class="p-4 flex-1 flex flex-col">
                                                    <div class="product-card-name font-medium text-base text-gray-900 mb-2 flex-1" style="word-wrap: break-word; overflow-wrap: break-word;">
                                                        ${productName}
                                                    </div>
                                                    <div class="product-card-barcode text-sm text-gray-600 font-mono mt-auto">
                                                        ${barcode}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        ${displayProducts.length > 1 ? `
                            <button onclick="
                                (function() {
                                    const carousel = document.getElementById('${carouselId}');
                                    const slides = carousel.querySelector('.flex');
                                    const currentTransform = slides.style.transform.match(/translateX\\((-?\\d+)px\\)/);
                                    const currentX = currentTransform ? parseInt(currentTransform[1]) : 0;
                                    const slideWidth = carousel.offsetWidth;
                                    const newX = Math.max(currentX - slideWidth, -(slideWidth * (${displayProducts.length} - 1)));
                                    slides.style.transform = 'translateX(' + newX + 'px)';
                                })();
                            " class="absolute left-0 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all z-10">
                                <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                </svg>
                            </button>
                            <button onclick="
                                (function() {
                                    const carousel = document.getElementById('${carouselId}');
                                    const slides = carousel.querySelector('.flex');
                                    const currentTransform = slides.style.transform.match(/translateX\\((-?\\d+)px\\)/);
                                    const currentX = currentTransform ? parseInt(currentTransform[1]) : 0;
                                    const slideWidth = carousel.offsetWidth;
                                    const newX = Math.min(currentX + slideWidth, 0);
                                    slides.style.transform = 'translateX(' + newX + 'px)';
                                })();
                            " class="absolute right-0 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all z-10">
                                <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                            <div class="flex justify-center mt-4 gap-2">
                                ${displayProducts.map((_, index) => `
                                    <button onclick="
                                        (function() {
                                            const carousel = document.getElementById('${carouselId}');
                                            const slides = carousel.querySelector('.flex');
                                            const slideWidth = carousel.offsetWidth;
                                            slides.style.transform = 'translateX(' + (-slideWidth * ${index}) + 'px)';
                                        })();
                                    " class="carousel-dot w-2 h-2 rounded-full bg-gray-300 hover:bg-gray-400 transition-all ${index === 0 ? 'bg-blue-500' : ''}"></button>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // Orbit Görünümü (Apple Watch tarzı - spiral düzenleme, zoom efekti)
        renderProductUpdateOrbit(products, showAll = false) {
            if (!products || !Array.isArray(products) || products.length === 0) {
                return '';
            }
            
            // Orbit modunda her zaman tüm ürünleri göster
            const displayProducts = products;
            const uniqueId = 'product-update-orbit-' + Math.random().toString(36).substr(2, 9);
            const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
            
            // Apple Watch tarzı spiral düzenleme
            const centerX = 50;
            const centerY = 50;
            const baseRadius = 18;
            const radiusStep = 7;
            const angleStep = Math.PI / 6;
            const totalItems = displayProducts.length;
            
            // Spiral pozisyonları hesapla
            const positions = [];
            let currentRadius = baseRadius;
            let currentAngle = 0;
            
            for (let i = 0; i < totalItems; i++) {
                const x = centerX + currentRadius * Math.cos(currentAngle);
                const y = centerY + currentRadius * Math.sin(currentAngle);
                positions.push({ x, y, radius: currentRadius, angle: currentAngle });
                
                currentAngle += angleStep;
                if ((i + 1) % 12 === 0) {
                    currentRadius += radiusStep;
                }
            }
            
            return `
                <div class="product-update-orbit mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="orbit" data-total-items="${totalItems}">
                    <div class="relative orbit-wrapper" style="min-height: 600px; padding: 50px; cursor: grab; overflow: hidden;">
                        <div class="orbit-container relative w-full h-full" style="position: relative; transform-origin: center center;">
                            ${displayProducts.map((product, index) => {
                                const pos = positions[index];
                                const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                                const barcode = product.barcode || 'Barkod yok';
                                const image = product.image || '';
                                
                                const distanceFromCenter = pos.radius;
                                const maxDistance = Math.max(...positions.map(p => p.radius));
                                const scale = 0.5 + (1 - distanceFromCenter / maxDistance) * 0.5;
                                const opacity = 0.6 + (1 - distanceFromCenter / maxDistance) * 0.4;
                                const zIndex = Math.floor(100 - (distanceFromCenter / maxDistance) * 50);
                                
                                return `
                                    <div class="orbit-item absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-150 hover:z-50" 
                                         style="left: ${pos.x}%; top: ${pos.y}%; will-change: transform; transform: translate(-50%, -50%) scale(${scale}); opacity: ${opacity}; z-index: ${zIndex};">
                                        <div class="product-orbit-card bg-white border-2 border-gray-200 rounded-full overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer" 
                                             style="width: 85px; height: 85px; position: relative;">
                                            ${image ? `
                                                <img src="${image}" 
                                                     alt="${productName}" 
                                                     class="w-full h-full object-cover rounded-full"
                                                     onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs flex items-center justify-center h-full\\'>?</div>';"
                                                     loading="lazy">
                                            ` : `
                                                <div class="text-gray-400 text-xs flex items-center justify-center h-full rounded-full bg-gray-100">?</div>
                                            `}
                                            <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 rounded-full flex items-center justify-center">
                                                <div class="opacity-0 hover:opacity-100 transition-opacity duration-300 text-white text-xs font-medium text-center px-2" style="text-shadow: 0 2px 4px rgba(0,0,0,0.7);">
                                                    ${productName.length > 20 ? productName.substring(0, 20) + '...' : productName}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-50 pointer-events-none">
                                <div class="bg-white rounded-full p-4 shadow-lg border-2 border-gray-200">
                                    <div class="text-2xl font-bold text-gray-800">${displayProducts.length}</div>
                                    <div class="text-xs text-gray-600">Ürün</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <script>
                        (function() {
                            const orbit = document.getElementById('${uniqueId}');
                            if (!orbit) return;
                            const wrapper = orbit.querySelector('.orbit-wrapper');
                            const container = orbit.querySelector('.orbit-container');
                            const items = orbit.querySelectorAll('.orbit-item');
                            const totalItems = parseInt(orbit.getAttribute('data-total-items'));
                            
                            const positions = ${JSON.stringify(positions)};
                            
                            let currentRotation = 0;
                            let currentZoom = 1;
                            let baseRotation = 0;
                            let baseZoom = 1;
                            
                            wrapper.addEventListener('mousemove', function(e) {
                                const rect = wrapper.getBoundingClientRect();
                                const centerX_px = rect.left + rect.width / 2;
                                const centerY_px = rect.top + rect.height / 2;
                                
                                const mouseX = e.clientX - centerX_px;
                                const mouseY = e.clientY - centerY_px;
                                
                                const angle = Math.atan2(mouseY, mouseX);
                                const targetRotation = angle + Math.PI / 2;
                                const rotationSensitivity = 0.3;
                                currentRotation += (targetRotation - currentRotation) * rotationSensitivity;
                                
                                const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
                                const maxDistance = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
                                const normalizedDistance = Math.min(distance / maxDistance, 1);
                                
                                const targetZoom = 0.7 + (1 - normalizedDistance) * 0.6;
                                const zoomSensitivity = 0.2;
                                currentZoom += (targetZoom - currentZoom) * zoomSensitivity;
                                
                                container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                                
                                items.forEach((item, index) => {
                                    const pos = positions[index];
                                    const rotatedAngle = pos.angle + currentRotation;
                                    const rotatedRadius = pos.radius * currentZoom;
                                    const x = 50 + rotatedRadius * Math.cos(rotatedAngle);
                                    const y = 50 + rotatedRadius * Math.sin(rotatedAngle);
                                    
                                    const maxRadius = Math.max(...positions.map(p => p.radius));
                                    const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                                    const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                                    
                                    item.style.left = x + '%';
                                    item.style.top = y + '%';
                                    item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                                    item.style.opacity = itemOpacity;
                                });
                            });
                            
                            wrapper.addEventListener('mouseleave', function() {
                                const resetSpeed = 0.15;
                                const resetInterval = setInterval(() => {
                                    const rotationDiff = Math.abs(currentRotation);
                                    const zoomDiff = Math.abs(currentZoom - 1);
                                    
                                    if (rotationDiff < 0.01 && zoomDiff < 0.01) {
                                        currentRotation = 0;
                                        currentZoom = 1;
                                        container.style.transform = 'rotate(0rad) scale(1)';
                                        clearInterval(resetInterval);
                                        
                                        items.forEach((item, index) => {
                                            const pos = positions[index];
                                            const maxRadius = Math.max(...positions.map(p => p.radius));
                                            const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                                            const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                                            
                                            item.style.left = pos.x + '%';
                                            item.style.top = pos.y + '%';
                                            item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                                            item.style.opacity = itemOpacity;
                                        });
                                    } else {
                                        currentRotation *= (1 - resetSpeed);
                                        currentZoom += (1 - currentZoom) * resetSpeed;
                                        container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                                        
                                        items.forEach((item, index) => {
                                            const pos = positions[index];
                                            const rotatedAngle = pos.angle + currentRotation;
                                            const rotatedRadius = pos.radius * currentZoom;
                                            const x = 50 + rotatedRadius * Math.cos(rotatedAngle);
                                            const y = 50 + rotatedRadius * Math.sin(rotatedAngle);
                                            const maxRadius = Math.max(...positions.map(p => p.radius));
                                            const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                                            const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                                            
                                            item.style.left = x + '%';
                                            item.style.top = y + '%';
                                            item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                                            item.style.opacity = itemOpacity;
                                        });
                                    }
                                }, 16);
                            });
                            
                            wrapper.addEventListener('wheel', function(e) {
                                e.preventDefault();
                                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                                baseZoom = Math.max(0.5, Math.min(2.0, baseZoom + delta));
                                currentZoom = baseZoom;
                                
                                container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                                
                                items.forEach((item, index) => {
                                    const pos = positions[index];
                                    const rotatedAngle = pos.angle + currentRotation;
                                    const rotatedRadius = pos.radius * currentZoom;
                                    const x = 50 + rotatedRadius * Math.cos(rotatedAngle);
                                    const y = 50 + rotatedRadius * Math.sin(rotatedAngle);
                                    const maxRadius = Math.max(...positions.map(p => p.radius));
                                    const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                                    const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                                    
                                    item.style.left = x + '%';
                                    item.style.top = y + '%';
                                    item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                                    item.style.opacity = itemOpacity;
                                });
                            });
                            
                            let touchStartDistance = 0;
                            let touchStartZoom = 1;
                            
                            wrapper.addEventListener('touchstart', function(e) {
                                if (e.touches.length === 2) {
                                    const touch1 = e.touches[0];
                                    const touch2 = e.touches[1];
                                    touchStartDistance = Math.sqrt(
                                        Math.pow(touch2.clientX - touch1.clientX, 2) +
                                        Math.pow(touch2.clientY - touch1.clientY, 2)
                                    );
                                    touchStartZoom = currentZoom;
                                } else if (e.touches.length === 1) {
                                    const rect = wrapper.getBoundingClientRect();
                                    const centerX_px = rect.left + rect.width / 2;
                                    const centerY_px = rect.top + rect.height / 2;
                                    
                                    const touchX = e.touches[0].clientX - centerX_px;
                                    const touchY = e.touches[0].clientY - centerY_px;
                                    const touchAngle = Math.atan2(touchY, touchX);
                                    baseRotation = touchAngle + Math.PI / 2 - currentRotation;
                                }
                            });
                            
                            wrapper.addEventListener('touchmove', function(e) {
                                e.preventDefault();
                                
                                if (e.touches.length === 2) {
                                    const touch1 = e.touches[0];
                                    const touch2 = e.touches[1];
                                    const currentDistance = Math.sqrt(
                                        Math.pow(touch2.clientX - touch1.clientX, 2) +
                                        Math.pow(touch2.clientY - touch1.clientY, 2)
                                    );
                                    const zoomFactor = currentDistance / touchStartDistance;
                                    currentZoom = Math.max(0.5, Math.min(2.0, touchStartZoom * zoomFactor));
                                    
                                    container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                                } else if (e.touches.length === 1) {
                                    const rect = wrapper.getBoundingClientRect();
                                    const centerX_px = rect.left + rect.width / 2;
                                    const centerY_px = rect.top + rect.height / 2;
                                    
                                    const touchX = e.touches[0].clientX - centerX_px;
                                    const touchY = e.touches[0].clientY - centerY_px;
                                    const currentAngle = Math.atan2(touchY, touchX);
                                    currentRotation = currentAngle + Math.PI / 2 - baseRotation;
                                    
                                    container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                                }
                                
                                items.forEach((item, index) => {
                                    const pos = positions[index];
                                    const rotatedAngle = pos.angle + currentRotation;
                                    const rotatedRadius = pos.radius * currentZoom;
                                    const x = 50 + rotatedRadius * Math.cos(rotatedAngle);
                                    const y = 50 + rotatedRadius * Math.sin(rotatedAngle);
                                    const maxRadius = Math.max(...positions.map(p => p.radius));
                                    const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                                    const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                                    
                                    item.style.left = x + '%';
                                    item.style.top = y + '%';
                                    item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                                    item.style.opacity = itemOpacity;
                                });
                            });
                        })();
                    </script>
                </div>
            `;
        }

        renderStep(step, index) {
            // Product update JSON'unu kontrol et
            const productUpdateData = this.parseProductUpdateJSON(step.description);
            const hasProductUpdate = productUpdateData !== null;
            const productUpdateProducts = hasProductUpdate ? productUpdateData.products : null;
            const displayType = hasProductUpdate ? (productUpdateData.display_type || 'grid') : 'grid';
            
            // Description'dan JSON'u çıkar (eğer varsa)
            let displayDescription = step.description || '';
            if (hasProductUpdate) {
                // JSON'u description'dan çıkar, sadece diğer text'i göster
                try {
                    const jsonMatch = displayDescription.match(/\{[\s\S]*"type"\s*:\s*"product_update"[\s\S]*\}/);
                    if (jsonMatch) {
                        displayDescription = displayDescription.replace(jsonMatch[0], '').trim();
                    }
                } catch (e) {
                    // Hata durumunda tüm description'ı göster
                }
            }
            
            return `
                <div class="changelog-step fade-in-up" style="animation-delay: ${index * 0.1}s">
                    <div class="flex items-start space-x-3">
                        <div class="changelog-step-icon flex-shrink-0">
                            <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                                ${step.icon || '📌'}
                            </div>
                        </div>
                        <div class="flex-1">
                            <h4>${step.title || 'Güncelleme'}</h4>
                            ${displayDescription ? `<p class="whitespace-pre-line mb-3">${displayDescription}</p>` : ''}
                            ${hasProductUpdate ? this.renderProductUpdate(productUpdateProducts, false, displayType) : ''}
                            ${this.renderMedia(step)}
                        </div>
                    </div>
                </div>
            `;
        }

        renderUpdate(update, index) {
            const date = this.formatDate(update.created_at);
            const steps = update.steps || [];
            const stepsHtml = steps.map((step, stepIndex) => 
                this.renderStep(step, stepIndex)
            ).join('');

            return `
                <div class="changelog-block fade-in-up" style="animation-delay: ${index * 0.1}s">
                    <div class="changelog-content">
                        <div class="changelog-icon">
                            <svg class="changelog-icon-svg" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                                <path d="M504 255.531c.253 136.64-111.18 248.372-247.82 248.468-59.015.042-113.223-20.53-155.822-54.911-11.077-8.94-11.905-25.541-1.839-35.607l11.267-11.267c8.609-8.609 22.353-9.551 31.891-1.984C173.062 425.135 212.781 440 256 440c101.705 0 184-82.311 184-184 0-101.705-82.311-184-184-184-48.814 0-93.149 18.969-126.068 49.932l50.754 50.754c10.08 10.08 2.941 27.314-11.313 27.314H24c-8.837 0-16-7.163-16-16V38.627c0-14.254 17.234-21.393 27.314-11.314l49.372 49.372C129.209 34.136 189.552 8 256 8c136.81 0 247.747 110.78 248 247.531zm-180.912 78.784l9.823-12.63c8.138-10.463 6.253-25.542-4.21-33.679L288 256.349V152c0-13.255-10.745-24-24-24h-16c-13.255 0-24 10.745-24 24v135.651l65.409 50.874c10.463 8.137 25.541 6.253 33.679-4.21z"></path>
                            </svg>
                        </div>
                        <div class="changelog-block-content">
                            <span class="changelog-date">${date}</span>
                            <h2 class="changelog-title">${update.update_number || 'Güncelleme'}</h2>
                            ${update.title ? `<h3 class="changelog-subtitle">${update.title}</h3>` : ''}
                            ${update.description ? `<p class="changelog-description">${update.description}</p>` : ''}
                            ${stepsHtml ? `<div class="changelog-steps">${stepsHtml}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        renderModal() {
            if (this.updates.length === 0) {
                return `
                    <div class="changelog-empty">
                        <div class="text-center py-12">
                            <div class="text-6xl mb-4">📋</div>
                            <h3 class="text-xl font-semibold text-gray-700 mb-2">Henüz güncelleme yok</h3>
                            <p class="text-gray-500">Güncellemeler burada görünecek.</p>
                        </div>
                    </div>
                `;
            }

            const updatesHtml = this.updates.map((update, index) => 
                this.renderUpdate(update, index)
            ).join('');

            return `
                <div class="changelog-container">
                    <div class="changelog-header">
                        <h2 class="changelog-main-title">Güncelleme Geçmişi</h2>
                        <p class="changelog-subtitle-text">Tüm sistem güncellemeleri ve yenilikler</p>
                    </div>
                    <div class="changelog-timeline">
                        <div class="changelog-timeline-line">
                            <div class="changelog-timeline-line-progress" id="changelogProgressLine"></div>
                        </div>
                        ${updatesHtml}
                    </div>
                </div>
            `;
        }

        async showModal() {
            if (this.isModalOpen) return;

            // Reload updates before showing
            await this.loadUpdates();

            this.isModalOpen = true;
            document.body.style.overflow = 'hidden';

            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.id = 'changelogModalOverlay';
            overlay.className = 'changelog-modal-overlay';
            overlay.innerHTML = `
                <div class="changelog-modal">
                    <div class="changelog-progress-bar"></div>
                    <div class="changelog-modal-header">
                        <h2 class="changelog-modal-title">Güncelleme Geçmişi</h2>
                        <button id="closeChangelogModal" class="changelog-close-btn">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <div class="changelog-modal-content">
                        <div id="changelogContent" class="changelog-content-wrapper">
                            <div class="changelog-loading">
                                <div class="spinner"></div>
                                <p>Güncellemeler yükleniyor...</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Render content
            const contentWrapper = overlay.querySelector('#changelogContent');
            contentWrapper.innerHTML = this.renderModal();

            // Force autoplay for all videos after render
            setTimeout(() => {
                const videos = overlay.querySelectorAll('video.changelog-video');
                videos.forEach(video => {
                    video.play().catch(() => {});
                });
            }, 300);

            // Setup event listeners
            const closeBtn = overlay.querySelector('#closeChangelogModal');
            closeBtn.addEventListener('click', () => this.closeModal());

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal();
                }
            });

            // Close on Escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape' && this.isModalOpen) {
                    this.closeModal();
                }
            };
            document.addEventListener('keydown', escapeHandler);
            overlay._escapeHandler = escapeHandler;

            // Setup scroll progress bar
            const modalContent = overlay.querySelector('.changelog-modal-content');
            const progressLine = overlay.querySelector('#changelogProgressLine');
            const progressBar = overlay.querySelector('.changelog-progress-bar');
            
            if (modalContent && progressLine && progressBar) {
                const updateProgress = () => {
                    const scrollTop = modalContent.scrollTop;
                    const scrollHeight = modalContent.scrollHeight - modalContent.clientHeight;
                    const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
                    
                    progressBar.style.width = `${progress}%`;
                    progressLine.style.height = `${progress}%`;
                };

                modalContent.addEventListener('scroll', updateProgress);
                updateProgress(); // Initial update
            }

            // Trigger scroll animations
            setTimeout(() => {
                this.triggerScrollAnimations(overlay);
            }, 100);
        }

        triggerScrollAnimations(container) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });

            const animatedElements = container.querySelectorAll('.changelog-block, .changelog-step');
            animatedElements.forEach(el => observer.observe(el));
        }

        closeModal() {
            if (!this.isModalOpen) return;

            const overlay = document.getElementById('changelogModalOverlay');
            if (overlay) {
                // Remove escape handler
                if (overlay._escapeHandler) {
                    document.removeEventListener('keydown', overlay._escapeHandler);
                }
                overlay.remove();
            }

            document.body.style.overflow = '';
            this.isModalOpen = false;
        }
    }

    // Initialize
    window.changelogSystem = new ChangelogSystem();
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.changelogSystem.init();
        });
    } else {
        window.changelogSystem.init();
    }
})();

