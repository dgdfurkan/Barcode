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
        this.canvasInitialized = false; // Canvas boyutlandırma optimizasyonu için
        this.lastVideoWidth = 0; // Video boyut değişikliği kontrolü
        this.lastVideoHeight = 0;
        this.html5QrCodeInstance = null; // Html5-Qrcode instance
        this.nativeDetector = null; // Barcode Detection API detector
        this.scannerType = null; // Kullanılan tarayıcı tipi
    }

    detectBestScanner() {
        // 1. Barcode Detection API kontrolü (Chrome/Edge)
        if ('BarcodeDetector' in window) {
            return 'native'; // Chrome native API
        }
        // 2. Html5-Qrcode kontrolü
        if (window.Html5Qrcode) {
            return 'html5qrcode';
        }
        // 3. ZXing fallback (mevcut)
        if (window.ZXing) {
            return 'zxing';
        }
        return null;
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

            // En iyi tarayıcıyı önce tespit et
            this.scannerType = this.detectBestScanner();
            
            console.log('🔍 Tespit edilen tarayıcı tipi:', this.scannerType, {
                hasBarcodeDetector: 'BarcodeDetector' in window,
                hasHtml5Qrcode: !!window.Html5Qrcode,
                hasZXing: !!window.ZXing
            });
            
            // Html5-Qrcode kendi video stream'ini oluşturur, biz oluşturmayalım
            if (this.scannerType === 'html5qrcode') {
                console.log('📱 Html5-Qrcode kullanılacak, stream Html5-Qrcode tarafından oluşturulacak');
                this.scanning = true;
                await this.startScanLoop();
                return; // Html5-Qrcode kendi stream'ini oluşturacak
            }
            
            // Diğer tarayıcılar için biz stream oluşturuyoruz
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

            if (window.DEBUG_BARCODE_SCANNER) {
            console.log('✅ Camera started');
            }
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
        // En iyi tarayıcıyı kullan (detectBestScanner zaten çağrıldı)
        console.log('🎯 startScanLoop başlatılıyor, scannerType:', this.scannerType);
        
        switch(this.scannerType) {
            case 'native':
                console.log('📱 Native API kullanılıyor...');
                const nativeResult = await this.scanWithNativeAPI();
                if (!nativeResult) {
                    console.warn('⚠️ Native API başarısız, fallback deneniyor...');
                    this.scannerType = 'html5qrcode';
                    this.scanWithHtml5Qrcode();
                }
                break;
            case 'html5qrcode':
                console.log('📱 Html5-Qrcode kullanılıyor...');
                const html5Result = this.scanWithHtml5Qrcode();
                if (!html5Result) {
                    console.warn('⚠️ Html5-Qrcode başarısız, ZXing deneniyor...');
                    this.scannerType = 'zxing';
                    if (typeof ZXing !== 'undefined' && window.ZXing) {
                        this.scanWithZXing();
                    } else {
                        await this.loadZXingLibrary();
                    }
                }
                break;
            case 'zxing':
                console.log('📱 ZXing kullanılıyor...');
                if (typeof ZXing !== 'undefined' && window.ZXing) {
            this.scanWithZXing();
        } else {
            // Fallback: Try to load ZXing from CDN
                    console.log('📥 ZXing yükleniyor...');
                    await this.loadZXingLibrary();
                }
                break;
            default:
                // Hiçbir tarayıcı bulunamadı, ZXing'i yüklemeyi dene
                console.warn('⚠️ Hiçbir tarayıcı bulunamadı, ZXing yükleniyor...');
                await this.loadZXingLibrary();
        }
    }

    async scanWithNativeAPI() {
        if (!('BarcodeDetector' in window)) {
            console.warn('⚠️ Barcode Detection API desteklenmiyor');
            return false;
        }

        if (!this.scanning || !this.video) {
            console.warn('⚠️ scanWithNativeAPI: scanning veya video yok');
            return false;
        }

        try {
            console.log('📱 Native API başlatılıyor...');
            // BarcodeDetector oluştur
            if (!this.nativeDetector) {
                this.nativeDetector = new BarcodeDetector({
                    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
                });
            }

            // Video'dan frame oku ve tara (her 150ms'de bir)
            const scanFrame = async () => {
                if (!this.scanning || !this.video || this.video.readyState < 2) {
                    return;
                }

                try {
                    // Video'dan ImageBitmap oluştur
                    const imageBitmap = await createImageBitmap(this.video);
                    
                    // Barkodları tara
                    const barcodes = await this.nativeDetector.detect(imageBitmap);
                    
                    // ImageBitmap'i temizle
                    imageBitmap.close();
                    
                    if (barcodes.length > 0) {
                        const barcode = barcodes[0];
                        console.log('✅ Barkod bulundu (Native API):', barcode.rawValue);
                        
                        // Koordinat bilgilerini hazırla
                        const result = {
                            rawValue: barcode.rawValue,
                            boundingBox: barcode.boundingBox,
                            cornerPoints: barcode.cornerPoints || []
                        };
                        
                        this.handleBarcodeDetected(barcode.rawValue, result);
                    }
                } catch (error) {
                    // Hata normal (barkod bulunamadı veya frame okunamadı)
                    // Sessizce devam et
                }

                // Devam et
                if (this.scanning) {
                    setTimeout(scanFrame, 150); // 150ms throttle
                }
            };

            // İlk frame'i tara
            scanFrame();
            
            console.log('✅ Native Barcode Detection API başlatıldı');
            
            return true;
        } catch (error) {
            console.error('❌ Native API başlatma hatası:', error);
            return false;
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

    scanWithHtml5Qrcode() {
        if (!window.Html5Qrcode) {
            console.warn('⚠️ Html5-Qrcode bulunamadı');
            return false;
        }

        if (!this.scanning || !this.video) {
            console.warn('⚠️ scanWithHtml5Qrcode: scanning veya video yok');
            return false;
        }

        try {
            console.log('📱 Html5-Qrcode başlatılıyor...');
            
            // Safari için video element kontrolü
            const videoElement = document.getElementById("cameraVideo");
            if (!videoElement) {
                console.error('❌ cameraVideo elementi bulunamadı');
                return false;
            }
            
            // Html5-Qrcode kendi video stream'ini oluşturur
            // Mevcut stream'i durdur ve Html5-Qrcode'un kendi stream'ini kullanmasına izin ver
            if (this.stream) {
                console.log('🛑 Mevcut video stream durduruluyor...');
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            if (this.video && this.video.srcObject) {
                this.video.srcObject = null;
            }
            
            const html5QrCode = new Html5Qrcode("cameraVideo");
            
            // Safari için optimize edilmiş ayarlar
            const config = {
                fps: 10,
                qrbox: function(viewfinderWidth, viewfinderHeight) {
                    // Mobil için qrbox - minimum 50px olmalı
                    const minEdgePercentage = 0.7;
                    const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                    let qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
                    
                    // Minimum 50px kontrolü
                    if (qrboxSize < 50) {
                        qrboxSize = 50;
                    }
                    
                    // Maksimum viewfinder boyutunu aşmamalı
                    if (qrboxSize > viewfinderWidth) {
                        qrboxSize = viewfinderWidth;
                    }
                    if (qrboxSize > viewfinderHeight) {
                        qrboxSize = viewfinderHeight;
                    }
                    
                    console.log('📐 qrbox boyutu:', qrboxSize, 'viewfinder:', viewfinderWidth, 'x', viewfinderHeight);
                    
                    return {
                        width: qrboxSize,
                        height: qrboxSize
                    };
                },
                aspectRatio: 1.0,
                disableFlip: false // Açı düzeltme için
            };
            
            html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText, decodedResult) => {
                    if (!this.scanning) return;
                    
                    console.log('✅ Barkod bulundu (Html5-Qrcode):', decodedText);
                    
                    // Barkod bulundu
                    // decodedResult içinde koordinat bilgisi var
                    const result = {
                        rawValue: decodedText,
                        decodedResult: decodedResult
                    };
                    
                    this.handleBarcodeDetected(decodedText, result);
                },
                (errorMessage) => {
                    // Hata (normal - barkod bulunamadı)
                    // Sessizce devam et - sadece gerçek hataları logla
                    if (errorMessage && !errorMessage.includes('No QR code') && !errorMessage.includes('NotFoundException') && !errorMessage.includes('No MultiFormat')) {
                        // Gerçek hataları logla (spam önleme)
                        if (Math.random() < 0.01) {
                            console.warn('⚠️ Html5-Qrcode scan error:', errorMessage);
                        }
                    }
                }
            ).then(() => {
                console.log('✅ Html5-Qrcode başlatıldı');
                this.html5QrCodeInstance = html5QrCode;
            }).catch((err) => {
                console.error('❌ Html5-Qrcode başlatma hatası:', err);
                // Fallback'e geç
                if (this.scanning) {
                    console.log('🔄 ZXing fallback\'e geçiliyor...');
                    this.scannerType = 'zxing';
                    this.startScanLoop();
                }
            });
            
            return true;
        } catch (error) {
            console.error('❌ Html5-Qrcode hatası:', error);
            // Fallback'e geç
            if (this.scanning) {
                console.log('🔄 ZXing fallback\'e geçiliyor (catch)...');
                this.scannerType = 'zxing';
                this.startScanLoop();
            }
            return false;
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
                // Canvas boyutlarını video'ya göre ayarla (sadece gerektiğinde)
                const videoWidth = this.video.videoWidth || 640;
                const videoHeight = this.video.videoHeight || 480;
                
                if (videoWidth === 0 || videoHeight === 0) {
                    setTimeout(scanFrame, 100);
                    return;
                }

                // Canvas boyutunu sadece değiştiğinde ayarla (performans optimizasyonu)
                if (!this.canvasInitialized || this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
                    this.canvas.width = videoWidth;
                    this.canvas.height = videoHeight;
                    this.canvasInitialized = true;
                    this.lastVideoWidth = videoWidth;
                    this.lastVideoHeight = videoHeight;
                }

                // Video frame'ini canvas'a çiz
                this.canvasContext.drawImage(this.video, 0, 0, videoWidth, videoHeight);

                // Canvas'tan image data al
                const imageData = this.canvasContext.getImageData(0, 0, videoWidth, videoHeight);
                
                // ZXing ile decode et - decodeFromImageElement kullan (daha güvenilir)
                // decodeFromImageData genelde çalışmıyor, bu yüzden direkt decodeFromImageElement kullanıyoruz

                // Progress log (her 5 saniyede bir, performans için azaltıldı) - frame okuma başlamadan önce
                frameCount++;
                const now = Date.now();
                if (now - lastLogTime > 5000) {
                    // Sadece debug modunda log göster (production'da kapatılabilir)
                    if (window.DEBUG_BARCODE_SCANNER) {
                        console.log('🔍 Barkod aranıyor...', {
                            frameCount,
                            videoSize: `${videoWidth}x${videoHeight}`,
                            readyState: this.video.readyState
                        });
                    }
                    lastLogTime = now;
                    frameCount = 0;
                }

                // Decode işlemini throttle et (her 150ms'de bir decode et, performans için)
                if (now - lastDecodeTime < 150) {
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
                                            // Sadece debug modunda log göster
                                            if (window.DEBUG_BARCODE_SCANNER) {
                                                console.log('✅ Barcode detected:', code);
                                            }
                                            this.handleBarcodeDetected(code, result);
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
                                        // Sadece debug modunda log göster
                                        if (window.DEBUG_BARCODE_SCANNER) {
                                            console.log('✅ Barcode detected (Callback):', code);
                                        }
                                        this.handleBarcodeDetected(code, result);
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

    handleBarcodeDetected(code, result = null) {
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

        // Barkod çerçevesini göster (eğer result varsa)
        if (result) {
            this.showBarcodeFrame(result);
        }

        // Find product by barcode
        if (window.countingSystem) {
            const product = window.countingSystem.findProductByBarcode(code);
            if (product && product.productId) {
                // Ürün zaten sayım tablosunda mı kontrol et
                const existingProduct = window.countingSystem.countingData[product.productId];
                if (existingProduct) {
                    // Ürün zaten ekli, uyarı göster
                    if (window.countingSystem.showToast) {
                        window.countingSystem.showToast('Bu ürün zaten sayım tablosunda!', 'warning', 2000);
                    }
                    this.playWarningSound(); // Farklı bir ses
                    // Çerçeveyi temizle
                    setTimeout(() => this.hideBarcodeFrame(), 1000);
                    return; // Eklemeyi engelle
                }

                // Ürünü ekle (addProductToCounting id bekliyor)
                window.countingSystem.addProductToCounting({
                    id: product.productId,
                    name: product.name,
                    barcode: product.barcode || code
                });
                
                // Başarı sesi çal
                this.playSuccessSound();
                
                // Toast bildirimi göster (browser notification değil)
                if (window.countingSystem.showToast) {
                    window.countingSystem.showToast(`${product.name || 'Ürün'} eklendi`, 'success', 2000);
                }
            } else {
                // Ürün bulunamadı
                if (window.countingSystem.showToast) {
                    window.countingSystem.showToast(`Barkod "${code}" için ürün bulunamadı`, 'error', 3000);
                }
                // Error sesi çal
                this.playErrorSound();
                // Çerçeveyi temizle
                setTimeout(() => this.hideBarcodeFrame(), 1000);
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

    playSuccessSound() {
        try {
            // Web Audio API ile kısa, pozitif başarı melodisi
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const duration = 0.3; // 300ms
            const volume = 0.3; // Kafayı yormayan seviye
            
            // Major akor: C5 (523Hz), E5 (659Hz), G5 (784Hz)
            const frequencies = [523.25, 659.25, 783.99];
            
            frequencies.forEach((freq, index) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = freq;
                oscillator.type = 'sine';
                
                // Her nota biraz farklı zamanda başlasın (akor efekti)
                const startTime = audioContext.currentTime + (index * 0.05);
                const endTime = startTime + duration;
                
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
                
                oscillator.start(startTime);
                oscillator.stop(endTime);
            });
        } catch (error) {
            // Web Audio API desteklenmiyorsa sessizce devam et
            if (window.DEBUG_BARCODE_SCANNER) {
                console.warn('⚠️ Ses çalınamadı:', error);
            }
        }
    }

    playWarningSound() {
        try {
            // Uyarı sesi: Daha düşük, tek nota
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 400; // Daha düşük frekans
            oscillator.type = 'sine';
            
            const startTime = audioContext.currentTime;
            const duration = 0.2;
            const endTime = startTime + duration;
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
            
            oscillator.start(startTime);
            oscillator.stop(endTime);
        } catch (error) {
            // Web Audio API desteklenmiyorsa sessizce devam et
            if (window.DEBUG_BARCODE_SCANNER) {
                console.warn('⚠️ Uyarı sesi çalınamadı:', error);
            }
        }
    }

    showBarcodeFrame(result) {
        // HTML/CSS çerçeveyi göster (daha performanslı)
        const htmlFrame = document.getElementById('barcodeFrameOverlay');
        if (htmlFrame && this.video) {
            // Video boyutlarını al
            const videoRect = this.video.getBoundingClientRect();
            const videoWidth = this.video.videoWidth || 640;
            const videoHeight = this.video.videoHeight || 480;
            
            // Koordinatları hesapla (result'tan gelen koordinatlar video koordinatlarında)
            let boundingBox = null;
            
            if (result.boundingBox) {
                // Native API'den gelen boundingBox
                boundingBox = result.boundingBox;
            } else if (result.cornerPoints && result.cornerPoints.length >= 4) {
                // Corner points'ten bounding box hesapla
                const xs = result.cornerPoints.map(p => p.x || (typeof p.getX === 'function' ? p.getX() : 0));
                const ys = result.cornerPoints.map(p => p.y || (typeof p.getY === 'function' ? p.getY() : 0));
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                boundingBox = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
            } else if (result.decodedResult && result.decodedResult.resultPoints) {
                // Html5-Qrcode'dan gelen koordinatlar
                const points = result.decodedResult.resultPoints;
                if (points.length >= 4) {
                    const xs = points.map(p => p.x || 0);
                    const ys = points.map(p => p.y || 0);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    boundingBox = {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY
                    };
                }
            }
            
            if (boundingBox) {
                // Video koordinatlarını viewport koordinatlarına dönüştür
                const scaleX = videoRect.width / videoWidth;
                const scaleY = videoRect.height / videoHeight;
                
                // Çerçeveyi konumlandır
                htmlFrame.style.left = `${boundingBox.x * scaleX}px`;
                htmlFrame.style.top = `${boundingBox.y * scaleY}px`;
                htmlFrame.style.width = `${boundingBox.width * scaleX}px`;
                htmlFrame.style.height = `${boundingBox.height * scaleY}px`;
                htmlFrame.classList.remove('hidden');
                
                // 1 saniye sonra gizle
                setTimeout(() => {
                    this.hideBarcodeFrame();
                }, 1000);
            } else {
                // Koordinat yoksa, merkezde göster
                htmlFrame.style.left = '50%';
                htmlFrame.style.top = '50%';
                htmlFrame.style.width = '200px';
                htmlFrame.style.height = '200px';
                htmlFrame.style.transform = 'translate(-50%, -50%)';
                htmlFrame.classList.remove('hidden');
                
                setTimeout(() => {
                    this.hideBarcodeFrame();
                }, 1000);
            }
        }
        
        // Canvas çerçevesini de çiz (fallback)
        this.drawBarcodeBox(result);
    }

    hideBarcodeFrame() {
        const htmlFrame = document.getElementById('barcodeFrameOverlay');
        if (htmlFrame) {
            htmlFrame.classList.add('hidden');
        }
        // Canvas'ı da temizle
        this.clearBarcodeBoxCanvas();
    }

    drawBarcodeBox(result) {
        const overlayCanvas = document.getElementById('barcodeOverlayCanvas');
        if (!overlayCanvas || !this.video) return;
        
        const ctx = overlayCanvas.getContext('2d');
        if (!ctx) return;
        
        // Video boyutlarını al
        const videoWidth = this.video.videoWidth || 640;
        const videoHeight = this.video.videoHeight || 480;
        
        // Canvas boyutlarını video'ya göre ayarla
        const videoRect = this.video.getBoundingClientRect();
        overlayCanvas.width = videoWidth;
        overlayCanvas.height = videoHeight;
        
        // Canvas'ı temizle
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        try {
            // ZXing koordinatlarını al
            let points = null;
            
            // Farklı API'lerden koordinatları al
            if (result && result.cornerPoints && result.cornerPoints.length >= 4) {
                // Native API'den gelen cornerPoints
                points = result.cornerPoints.map(p => ({
                    getX: () => p.x || 0,
                    getY: () => p.y || 0
                }));
            } else if (result && result.boundingBox) {
                // Native API'den gelen boundingBox
                const box = result.boundingBox;
                points = [
                    { getX: () => box.x, getY: () => box.y },
                    { getX: () => box.x + box.width, getY: () => box.y },
                    { getX: () => box.x + box.width, getY: () => box.y + box.height },
                    { getX: () => box.x, getY: () => box.y + box.height }
                ];
            } else if (result && result.decodedResult && result.decodedResult.resultPoints) {
                // Html5-Qrcode'dan gelen koordinatlar
                points = result.decodedResult.resultPoints.map(p => ({
                    getX: () => p.x || 0,
                    getY: () => p.y || 0
                }));
            } else if (result && typeof result.getResultPoints === 'function') {
                // ZXing'den gelen koordinatlar
                points = result.getResultPoints();
            } else if (result && result.resultPoints) {
                points = result.resultPoints;
            } else if (result && typeof result.getBoundingBox === 'function') {
                // BoundingBox varsa onu kullan
                const box = result.getBoundingBox();
                if (box) {
                    // BoundingBox'tan köşe noktaları oluştur
                    points = [
                        { getX: () => box.x, getY: () => box.y },
                        { getX: () => box.x + box.width, getY: () => box.y },
                        { getX: () => box.x + box.width, getY: () => box.y + box.height },
                        { getX: () => box.x, getY: () => box.y + box.height }
                    ];
                }
            }
            
            if (!points || points.length < 2) {
                // Yeterli nokta yoksa, merkez noktası kullan (fallback)
                const centerX = videoWidth / 2;
                const centerY = videoHeight / 2;
                const boxSize = 100;
                ctx.strokeStyle = '#10b981'; // Yeşil
                ctx.lineWidth = 4;
                ctx.setLineDash([]);
                ctx.strokeRect(centerX - boxSize/2, centerY - boxSize/2, boxSize, boxSize);
            } else {
                // Çerçeve çiz
                ctx.strokeStyle = '#10b981'; // Yeşil
                ctx.lineWidth = 4;
                ctx.setLineDash([]);
                ctx.beginPath();
                
                // İlk noktaya git
                const firstPoint = points[0];
                const firstX = typeof firstPoint.getX === 'function' ? firstPoint.getX() : (firstPoint.x || 0);
                const firstY = typeof firstPoint.getY === 'function' ? firstPoint.getY() : (firstPoint.y || 0);
                ctx.moveTo(firstX, firstY);
                
                // Diğer noktaları birleştir
                for (let i = 1; i < points.length; i++) {
                    const point = points[i];
                    const x = typeof point.getX === 'function' ? point.getX() : (point.x || 0);
                    const y = typeof point.getY === 'function' ? point.getY() : (point.y || 0);
                    ctx.lineTo(x, y);
                }
                
                // Kapat
                ctx.closePath();
                ctx.stroke();
            }
            
            // Animasyon için CSS class ekle
            overlayCanvas.classList.add('barcode-detected');
            
            // 500ms sonra class'ı kaldır
            setTimeout(() => {
                overlayCanvas.classList.remove('barcode-detected');
            }, 500);
            
        } catch (error) {
            // Hata durumunda sessizce devam et
            if (window.DEBUG_BARCODE_SCANNER) {
                console.warn('⚠️ Barkod çerçevesi çizilemedi:', error);
            }
        }
    }

    clearBarcodeBox() {
        // HTML çerçeveyi gizle
        const htmlFrame = document.getElementById('barcodeFrameOverlay');
        if (htmlFrame) {
            htmlFrame.classList.add('hidden');
        }
        // Canvas'ı temizle
        this.clearBarcodeBoxCanvas();
    }

    clearBarcodeBoxCanvas() {
        const overlayCanvas = document.getElementById('barcodeOverlayCanvas');
        if (!overlayCanvas) return;
        
        const ctx = overlayCanvas.getContext('2d');
        if (!ctx) return;
        
        // Canvas'ı temizle
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // Animasyon class'ını kaldır
        overlayCanvas.classList.remove('barcode-detected');
    }

    setContinuousMode(enabled) {
        this.continuousMode = enabled;
        console.log('🔄 Seri okuma modu:', enabled ? 'Aktif' : 'Kapalı');
    }

    stopScanning() {
        this.scanning = false;

        // Html5-Qrcode'u durdur
        if (this.html5QrCodeInstance) {
            try {
                this.html5QrCodeInstance.stop().then(() => {
                    if (window.DEBUG_BARCODE_SCANNER) {
                        console.log('✅ Html5-Qrcode durduruldu');
                    }
                }).catch((err) => {
                    // Sessizce devam et
                });
            } catch (error) {
                // Sessizce devam et
            }
            this.html5QrCodeInstance = null;
        }

        // Barkod çerçevesini temizle
        this.hideBarcodeFrame();

        // Stop QuaggaJS if running
        if (this.quaggaInstance && typeof this.quaggaInstance.stop === 'function') {
            try {
                this.quaggaInstance.stop();
                if (window.DEBUG_BARCODE_SCANNER) {
                    console.log('✅ QuaggaJS durduruldu');
                }
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

        // Canvas'ı resetle
        this.canvasInitialized = false;
        this.lastVideoWidth = 0;
        this.lastVideoHeight = 0;

        // Close modal
        const modal = document.getElementById('cameraScannerModal');
        if (modal) {
            modal.classList.add('hidden');
        }

        if (window.DEBUG_BARCODE_SCANNER) {
        console.log('✅ Camera stopped');
        }
    }
}

// Global instance
window.barcodeScanner = new BarcodeScanner();

