// Barcode Scanner using Camera
class BarcodeScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.scanning = false;
        this.scanInterval = null;
        this.codeReader = null;
        this.continuousMode = false; // Seri okuma modu
        this.lastScannedCode = null; // Son okunan barkod (tekrar okumayı önlemek için)
        this.lastScanTime = 0; // Son okuma zamanı
    }

    async startScanning() {
        try {
            // Check if browser supports getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Tarayıcınız kamera erişimini desteklemiyor');
                return;
            }

            // Open modal
            const modal = document.getElementById('cameraScannerModal');
            if (!modal) {
                console.error('Camera scanner modal not found');
                return;
            }
            modal.classList.remove('hidden');

            // Get video element
            this.video = document.getElementById('cameraVideo');
            if (!this.video) {
                console.error('Camera video element not found');
                return;
            }

            // Request camera access (telefon için optimize edilmiş - esnek constraints)
            let constraints = {
                video: {
                    facingMode: 'environment' // Use back camera on mobile
                }
            };

            // Önce basit constraints ile dene
            try {
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {
                // Eğer environment kamera bulunamazsa, herhangi bir kamerayı dene
                if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
                    console.log('⚠️ Back camera bulunamadı, herhangi bir kamera deneniyor...');
                    constraints = {
                        video: true // En basit constraint - cihaz ne destekliyorsa onu kullan
                    };
                    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                } else {
                    throw error; // Diğer hataları yukarı fırlat
                }
            }

            // Set video source
            this.video.srcObject = this.stream;
            
            // Video element'in metadata yüklenmesini bekle
            await new Promise((resolve) => {
                if (this.video.readyState >= 2) {
                    resolve();
                } else {
                    this.video.addEventListener('loadedmetadata', resolve, { once: true });
                    // Timeout: 3 saniye
                    setTimeout(resolve, 3000);
                }
            });
            
            await this.video.play();
            
            console.log('✅ Video oynatılıyor:', {
                readyState: this.video.readyState,
                videoWidth: this.video.videoWidth,
                videoHeight: this.video.videoHeight,
                paused: this.video.paused
            });

            // Start scanning
            this.scanning = true;
            await this.startScanLoop();

            console.log('✅ Camera started');
        } catch (error) {
            console.error('❌ Kamera başlatma hatası:', error);
            
            // Daha açıklayıcı hata mesajları
            let errorMessage = 'Kamera erişimi başarısız. ';
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += 'Lütfen tarayıcı ayarlarından kamera izinlerini açın.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage += 'Kamera bulunamadı. Lütfen cihazınızda kamera olduğundan emin olun.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage += 'Kamera başka bir uygulama tarafından kullanılıyor olabilir.';
            } else {
                errorMessage += 'Lütfen kamera izinlerini kontrol edin.';
            }
            
            // Toast bildirimi göster (eğer varsa)
            if (window.countingSystem && window.countingSystem.showToast) {
                window.countingSystem.showToast(errorMessage, 'error', 5000);
            } else {
                alert(errorMessage);
            }
            
            this.stopScanning();
        }
    }

    async startScanLoop() {
        // Try to use ZXing library if available
        if (typeof ZXing !== 'undefined' && window.ZXing) {
            this.scanWithZXing();
        } else {
            // Fallback: Try to load ZXing from CDN
            await this.loadZXingLibrary();
        }
    }

    async loadZXingLibrary() {
        try {
            // Load ZXing from CDN
            if (!window.ZXing) {
                // ZXing yüklenene kadar bekle (timeout ile)
                return new Promise((resolve, reject) => {
                    // Timeout: 10 saniye içinde yüklenmezse fallback'e geç
                    const timeout = setTimeout(() => {
                        console.warn('⚠️ ZXing yükleme zaman aşımı, fallback kullanılıyor');
                        this.scanWithFallback();
                        reject(new Error('ZXing load timeout'));
                    }, 10000);

                    const script = document.createElement('script');
                    // Daha güvenilir CDN linki kullan (spesifik versiyon - daha stabil)
                    script.src = 'https://unpkg.com/@zxing/library@0.20.0';
                    script.async = true;
                    script.crossOrigin = 'anonymous';
                    
                    script.onload = () => {
                        clearTimeout(timeout);
                        // ZXing yüklendi, biraz bekle ve kontrol et
                        setTimeout(() => {
                            if (window.ZXing) {
                                console.log('✅ ZXing library yüklendi');
                                this.scanWithZXing();
                                resolve();
                            } else {
                                console.warn('⚠️ ZXing yüklendi ama window.ZXing bulunamadı, fallback kullanılıyor');
                                this.scanWithFallback();
                                reject(new Error('ZXing not available'));
                            }
                        }, 500);
                    };
                    
                    script.onerror = () => {
                        clearTimeout(timeout);
                        console.warn('⚠️ ZXing library yüklenemedi, fallback kullanılıyor');
                        this.scanWithFallback();
                        reject(new Error('ZXing load failed'));
                    };
                    
                    document.head.appendChild(script);
                });
            } else {
                this.scanWithZXing();
            }
        } catch (error) {
            console.error('❌ ZXing yükleme hatası:', error);
            this.scanWithFallback();
        }
    }

    scanWithZXing() {
        if (!this.scanning || !this.video) {
            console.warn('⚠️ scanWithZXing: scanning veya video yok', { scanning: this.scanning, video: !!this.video });
            return;
        }

        console.log('🔍 ZXing ile tarama başlatılıyor...', {
            videoReadyState: this.video.readyState,
            videoWidth: this.video.videoWidth,
            videoHeight: this.video.videoHeight,
            videoSrcObject: !!this.video.srcObject
        });

        try {
            // ZXing'in doğru API'sini kullan
            if (!window.ZXing || !window.ZXing.BrowserMultiFormatReader) {
                console.error('❌ ZXing.BrowserMultiFormatReader bulunamadı');
                this.scanWithFallback();
                return;
            }

            const codeReader = new ZXing.BrowserMultiFormatReader();
            console.log('✅ ZXing BrowserMultiFormatReader oluşturuldu');
            
            // Video element'in hazır olmasını bekle
            const startDecoding = () => {
                console.log('📹 Video hazır, decoding başlatılıyor...', {
                    readyState: this.video.readyState,
                    videoWidth: this.video.videoWidth,
                    videoHeight: this.video.videoHeight
                });
                this.startZXingDecoding(codeReader);
            };

            if (this.video.readyState >= 2) {
                // Video zaten hazır
                startDecoding();
            } else {
                // Video hazır olana kadar bekle
                console.log('⏳ Video hazır olması bekleniyor...');
                this.video.addEventListener('loadedmetadata', startDecoding, { once: true });
                this.video.addEventListener('loadeddata', startDecoding, { once: true });
                this.video.addEventListener('canplay', startDecoding, { once: true });
                
                // Timeout: 5 saniye içinde hazır olmazsa hata ver
                setTimeout(() => {
                    if (this.video.readyState < 2) {
                        console.warn('⚠️ Video hazır olmadı, yine de decoding başlatılıyor...');
                        startDecoding();
                    }
                }, 5000);
            }
        } catch (error) {
            console.error('❌ ZXing hatası:', error);
            this.scanWithFallback();
        }
    }

    startZXingDecoding(codeReader) {
        if (!this.scanning || !this.video) {
            console.warn('⚠️ startZXingDecoding: scanning veya video yok');
            return;
        }

        try {
            console.log('🎯 ZXing decoding başlatılıyor...', {
                hasDecodeFromVideoElement: typeof codeReader.decodeFromVideoElement === 'function',
                hasDecodeFromVideoDevice: typeof codeReader.decodeFromVideoDevice === 'function',
                hasDecodeFromVideoStream: typeof codeReader.decodeFromVideoStream === 'function',
                videoReady: this.video.readyState >= 2
            });
            
            // Canvas üzerinden frame okuma (daha güvenilir, özellikle cross-origin için)
            console.log('📹 Canvas üzerinden frame okuma kullanılıyor (daha güvenilir)...');
            this.startCanvasDecoding(codeReader);
            return;
            
            // NOT: decodeFromVideoElement Mac kamerası ile PC'den bağlanırken çalışmayabilir
            // Bu yüzden direkt canvas decoding kullanıyoruz
            /*
            if (typeof codeReader.decodeFromVideoElement === 'function') {
                console.log('📹 decodeFromVideoElement kullanılıyor...');
                codeReader.decodeFromVideoElement(this.video, (result, err) => {
                    if (!this.scanning) {
                        console.log('⏸️ Scanning durdu, decode durduruldu');
                        return;
                    }

                    if (result) {
                        const code = result.getText();
                        console.log('✅ Barcode detected (ZXing):', code);
                        this.handleBarcodeDetected(code);
                    }
                    
                    if (err) {
                        // NotFoundException normal (henüz barkod bulunamadı)
                        if (err.name === 'NotFoundException') {
                            // Her 100 NotFoundException'da bir log (spam önleme)
                            if (Math.random() < 0.01) {
                                console.log('🔍 Barkod aranıyor...');
                            }
                        } else if (err.name !== 'NoImageException' && err.name !== 'FormatException') {
                            // Diğer hataları logla
                            console.warn('⚠️ ZXing scan error:', err.name, err.message);
                        }
                    }
                });
                this.codeReader = codeReader;
                console.log('✅ ZXing decodeFromVideoElement başlatıldı');
                return;
            }
            */
            
            // decodeFromVideoDevice dene (stream'den)
            if (typeof codeReader.decodeFromVideoDevice === 'function' && this.stream) {
                console.log('📹 decodeFromVideoDevice kullanılıyor...');
                const videoTrack = this.stream.getVideoTracks()[0];
                if (videoTrack) {
                    const deviceId = videoTrack.getSettings().deviceId;
                    if (deviceId) {
                        codeReader.decodeFromVideoDevice(deviceId, this.video, (result, err) => {
                            if (!this.scanning) return;

                            if (result) {
                                const code = result.getText();
                                console.log('✅ Barcode detected (ZXing device):', code);
                                this.handleBarcodeDetected(code);
                            }
                            
                            if (err && err.name !== 'NotFoundException') {
                                if (err.name !== 'NoImageException' && err.name !== 'FormatException') {
                                    console.warn('⚠️ ZXing scan error:', err);
                                }
                            }
                        });
                        this.codeReader = codeReader;
                        console.log('✅ ZXing decodeFromVideoDevice başlatıldı');
                        return;
                    }
                }
            }
            
            // Canvas üzerinden frame okuma (fallback)
            console.log('📹 Canvas üzerinden frame okuma deneniyor...');
            this.startCanvasDecoding(codeReader);
            
        } catch (error) {
            console.error('❌ ZXing decoding başlatma hatası:', error);
            this.scanWithFallback();
        }
    }

    startCanvasDecoding(codeReader) {
        if (!this.scanning || !this.video) {
            console.warn('⚠️ startCanvasDecoding: scanning veya video yok');
            return;
        }

        // Canvas oluştur
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvasContext = this.canvas.getContext('2d', { willReadFrequently: true });
        }

        let frameCount = 0;
        let lastLogTime = Date.now();
        let lastDecodeTime = 0;

        const scanFrame = () => {
            if (!this.scanning || !this.video) {
                return;
            }

            // Video hazır değilse bekle
            if (this.video.readyState < 2) {
                setTimeout(scanFrame, 100);
                return;
            }

            try {
                // Canvas boyutlarını video'ya göre ayarla
                const videoWidth = this.video.videoWidth || 640;
                const videoHeight = this.video.videoHeight || 480;
                
                if (videoWidth === 0 || videoHeight === 0) {
                    setTimeout(scanFrame, 100);
                    return;
                }

                this.canvas.width = videoWidth;
                this.canvas.height = videoHeight;

                // Video frame'ini canvas'a çiz
                this.canvasContext.drawImage(this.video, 0, 0, videoWidth, videoHeight);

                // Canvas'tan image data al
                const imageData = this.canvasContext.getImageData(0, 0, videoWidth, videoHeight);
                
                // ZXing ile decode et - decodeFromImageElement kullan (daha güvenilir)
                // decodeFromImageData genelde çalışmıyor, bu yüzden direkt decodeFromImageElement kullanıyoruz

                // Progress log (her 2 saniyede bir) - frame okuma başlamadan önce
                frameCount++;
                const now = Date.now();
                if (now - lastLogTime > 2000) {
                    console.log('🔍 Barkod aranıyor...', {
                        frameCount,
                        videoSize: `${videoWidth}x${videoHeight}`,
                        readyState: this.video.readyState
                    });
                    lastLogTime = now;
                    frameCount = 0;
                }

                // Decode işlemini throttle et (her 100ms'de bir decode et, performans için)
                if (now - lastDecodeTime < 100) {
                    // Çok sık decode etme, sadece frame'i atla
                    if (this.scanning) {
                        requestAnimationFrame(scanFrame);
                    }
                    return;
                }
                lastDecodeTime = now;

                // decodeFromImageElement kullan (canvas'tan image oluştur)
                const img = new Image();
                img.onload = () => {
                    if (!this.scanning) return;

                    try {
                        if (typeof codeReader.decodeFromImageElement === 'function') {
                            // ZXing'in decodeFromImageElement'i promise döndürüyor
                            const decodePromise = codeReader.decodeFromImageElement(img);
                            
                            // Promise ise
                            if (decodePromise && typeof decodePromise.then === 'function') {
                                decodePromise
                                    .then((result) => {
                                        if (!this.scanning) return;
                                        
                                        if (result) {
                                            const code = result.getText();
                                            console.log('✅ Barcode detected:', code);
                                            this.handleBarcodeDetected(code);
                                        }
                                        
                                        // Devam et (her zaman)
                                        if (this.scanning) {
                                            requestAnimationFrame(scanFrame);
                                        }
                                    })
                                    .catch((err) => {
                                        // Tüm hataları sessizce geç (barkod bulunamadı normal)
                                        // "No MultiFormat Readers were able to detect the code" normal bir durum
                                        // Devam et
                                        if (this.scanning) {
                                            requestAnimationFrame(scanFrame);
                                        }
                                    });
                            } else {
                                // Callback versiyonu (eski API - genelde kullanılmaz)
                                codeReader.decodeFromImageElement(img, (result, err) => {
                                    if (!this.scanning) return;

                                    if (result) {
                                        const code = result.getText();
                                        console.log('✅ Barcode detected (Callback):', code);
                                        this.handleBarcodeDetected(code);
                                    }
                                    
                                    // Devam et
                                    if (this.scanning) {
                                        requestAnimationFrame(scanFrame);
                                    }
                                });
                            }
                        } else {
                            // ZXing API'si bulunamadı
                            if (this.scanning) {
                                requestAnimationFrame(scanFrame);
                            }
                        }
                    } catch (error) {
                        // Sessizce devam et (hata normal - barkod bulunamadı)
                        if (this.scanning) {
                            requestAnimationFrame(scanFrame);
                        }
                    }
                };
                img.onerror = () => {
                    if (this.scanning) {
                        requestAnimationFrame(scanFrame);
                    }
                };
                img.src = this.canvas.toDataURL('image/png');

            } catch (error) {
                console.warn('⚠️ Canvas decoding hatası:', error);
                if (this.scanning) {
                    setTimeout(scanFrame, 100);
                }
            }
        };

        // İlk frame'i oku (requestAnimationFrame kullan - daha smooth)
        requestAnimationFrame(scanFrame);
        this.codeReader = codeReader;
        console.log('✅ Canvas decoding başlatıldı (requestAnimationFrame ile)');
    }

    decodeFromCanvasDirect(codeReader, imageData) {
        // Bu metod şu an kullanılmıyor, decodeFromImageElement yeterli
        // Gelecekte düşük seviye API gerekirse buraya eklenebilir
    }

    scanWithFallback() {
        // ZXing yüklenemedi, alternatif bir kütüphane dene veya kullanıcıya bilgi ver
        console.warn('⚠️ ZXing yüklenemedi, alternatif yöntem deneniyor...');
        
        // QuaggaJS veya başka bir kütüphane yüklemeyi dene
        this.loadQuaggaJS();
    }

    async loadQuaggaJS() {
        try {
            // QuaggaJS'i yükle
            if (!window.Quagga) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/quagga@latest/dist/quagga.min.js';
                script.async = true;
                
                await new Promise((resolve, reject) => {
                    script.onload = () => {
                        console.log('✅ QuaggaJS yüklendi');
                        this.scanWithQuagga();
                        resolve();
                    };
                    script.onerror = () => {
                        console.warn('⚠️ QuaggaJS yüklenemedi');
                        this.showManualInputMessage();
                        reject(new Error('QuaggaJS load failed'));
                    };
                    document.head.appendChild(script);
                });
            } else {
                this.scanWithQuagga();
            }
        } catch (error) {
            console.error('❌ QuaggaJS yükleme hatası:', error);
            this.showManualInputMessage();
        }
    }

    scanWithQuagga() {
        if (!this.scanning || !this.video) return;

        try {
            // QuaggaJS kendi stream'ini oluşturur, mevcut video element'ini kullanamaz
            // Bu yüzden QuaggaJS için ayrı bir container oluştur
            const quaggaContainer = document.createElement('div');
            quaggaContainer.id = 'quagga-container';
            quaggaContainer.style.position = 'absolute';
            quaggaContainer.style.top = '-9999px';
            quaggaContainer.style.left = '-9999px';
            quaggaContainer.style.width = '640px';
            quaggaContainer.style.height = '480px';
            document.body.appendChild(quaggaContainer);

            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: quaggaContainer,
                    constraints: {
                        width: { min: 640 },
                        height: { min: 480 },
                        facingMode: "environment"
                    }
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: 2,
                decoder: {
                    readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "upc_reader", "upc_e_reader"]
                },
                locate: true
            }, (err) => {
                if (err) {
                    console.error('❌ Quagga başlatma hatası:', err);
                    // Quagga başlatılamazsa, kullanıcıya bilgi ver ama kamerayı kapatma (seri okuma modu aktifse)
                    if (!this.continuousMode) {
                        this.showManualInputMessage();
                    } else {
                        if (window.countingSystem && window.countingSystem.showToast) {
                            window.countingSystem.showToast('Barkod okuma başlatılamadı. Lütfen sayfayı yenileyin.', 'warning', 3000);
                        }
                    }
                    // Container'ı temizle
                    if (quaggaContainer.parentNode) {
                        quaggaContainer.parentNode.removeChild(quaggaContainer);
                    }
                    return;
                }
                console.log('✅ Quagga başlatıldı');
                Quagga.start();
            });

            Quagga.onDetected((result) => {
                if (!this.scanning) return; // Scanning durduysa devam etme
                
                if (result && result.codeResult) {
                    const code = result.codeResult.code;
                    console.log('✅ Barcode detected (Quagga):', code);
                    this.handleBarcodeDetected(code);
                }
            });

            this.quaggaInstance = Quagga;
            this.quaggaContainer = quaggaContainer;
        } catch (error) {
            console.error('❌ Quagga hatası:', error);
            this.showManualInputMessage();
        }
    }

    showManualInputMessage() {
        // Toast bildirimi göster (alert yerine)
        if (window.countingSystem && window.countingSystem.showToast) {
            window.countingSystem.showToast('Barkod okuma kütüphanesi yüklenemedi. Lütfen ürün adı veya barkod ile manuel ekleme yapın.', 'warning', 5000);
        } else {
            alert('Barkod okuma kütüphanesi yüklenemedi. Lütfen ürün adı veya barkod ile manuel ekleme yapın.');
        }
        
        // Seri okuma modu aktif değilse kamerayı kapat
        if (!this.continuousMode) {
            setTimeout(() => {
                this.stopScanning();
            }, 2000);
        }
    }

    handleBarcodeDetected(code) {
        if (!code) return;

        // Aynı barkodu kısa süre içinde tekrar okumayı önle (1 saniye)
        const now = Date.now();
        if (code === this.lastScannedCode && (now - this.lastScanTime) < 1000) {
            return; // Aynı barkod, atla
        }

        this.lastScannedCode = code;
        this.lastScanTime = now;

        // Yeşil yanıp sönme efekti
        this.showSuccessFlash();

        // Find product by barcode
        if (window.countingSystem) {
            const product = window.countingSystem.findProductByBarcode(code);
            if (product && product.productId) {
                // Ürünü ekle (addProductToCounting id bekliyor)
                window.countingSystem.addProductToCounting({
                    id: product.productId,
                    name: product.name,
                    barcode: product.barcode || code
                });
                
                // Toast bildirimi göster (browser notification değil)
                if (window.countingSystem.showToast) {
                    window.countingSystem.showToast(`${product.name || 'Ürün'} eklendi`, 'success', 2000);
                }
            } else {
                // Ürün bulunamadı
                if (window.countingSystem.showToast) {
                    window.countingSystem.showToast(`Barkod "${code}" için ürün bulunamadı`, 'error', 3000);
                }
            }
        } else {
            console.warn('Counting system not found');
        }

        // Seri okuma modu aktif değilse kamerayı kapat
        if (!this.continuousMode) {
            this.stopScanning();
        }
    }

    showSuccessFlash() {
        const modal = document.getElementById('cameraScannerModal');
        if (!modal) return;

        // Flash overlay oluştur veya kullan
        let flashOverlay = document.getElementById('cameraFlashOverlay');
        if (!flashOverlay) {
            flashOverlay = document.createElement('div');
            flashOverlay.id = 'cameraFlashOverlay';
            flashOverlay.className = 'fixed inset-0 bg-green-500 bg-opacity-50 z-50 pointer-events-none transition-opacity duration-200';
            modal.appendChild(flashOverlay);
        }

        // Yeşil yanıp sönme efekti
        flashOverlay.style.opacity = '0.8';
        setTimeout(() => {
            flashOverlay.style.opacity = '0';
        }, 200);
    }

    setContinuousMode(enabled) {
        this.continuousMode = enabled;
        console.log('🔄 Seri okuma modu:', enabled ? 'Aktif' : 'Kapalı');
    }

    stopScanning() {
        this.scanning = false;

        // Stop QuaggaJS if running
        if (this.quaggaInstance && typeof this.quaggaInstance.stop === 'function') {
            try {
                this.quaggaInstance.stop();
                console.log('✅ QuaggaJS durduruldu');
            } catch (error) {
                console.warn('⚠️ QuaggaJS durdurma hatası:', error);
            }
            this.quaggaInstance = null;
        }

        // QuaggaJS container'ını temizle
        if (this.quaggaContainer && this.quaggaContainer.parentNode) {
            try {
                this.quaggaContainer.parentNode.removeChild(this.quaggaContainer);
            } catch (error) {
                console.warn('⚠️ QuaggaJS container temizleme hatası:', error);
            }
            this.quaggaContainer = null;
        }

        // Stop code reader (ZXing)
        if (this.codeReader) {
            try {
                this.codeReader.reset();
            } catch (error) {
                console.warn('⚠️ Code reader reset hatası:', error);
            }
            this.codeReader = null;
        }

        // Stop video stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Clear video source
        if (this.video) {
            this.video.srcObject = null;
        }

        // Close modal
        const modal = document.getElementById('cameraScannerModal');
        if (modal) {
            modal.classList.add('hidden');
        }

        console.log('✅ Camera stopped');
    }
}

// Global instance
window.barcodeScanner = new BarcodeScanner();

