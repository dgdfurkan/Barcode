// Barcode Scanner using Camera
class BarcodeScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.scanning = false;
        this.scanInterval = null;
        this.codeReader = null;
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

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            // Set video source
            this.video.srcObject = this.stream;
            await this.video.play();

            // Start scanning
            this.scanning = true;
            this.startScanLoop();

            console.log('✅ Camera started');
        } catch (error) {
            console.error('Error starting camera:', error);
            alert('Kamera erişimi başarısız. Lütfen kamera izinlerini kontrol edin.');
            this.stopScanning();
        }
    }

    startScanLoop() {
        // Try to use ZXing library if available
        if (typeof ZXing !== 'undefined') {
            this.scanWithZXing();
        } else {
            // Fallback: Try to load ZXing from CDN
            this.loadZXingLibrary();
        }
    }

    async loadZXingLibrary() {
        try {
            // Load ZXing from CDN
            if (!window.ZXing) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@latest';
                script.onload = () => {
                    this.scanWithZXing();
                };
                script.onerror = () => {
                    console.warn('ZXing library failed to load, using fallback method');
                    this.scanWithFallback();
                };
                document.head.appendChild(script);
            } else {
                this.scanWithZXing();
            }
        } catch (error) {
            console.error('Error loading ZXing:', error);
            this.scanWithFallback();
        }
    }

    scanWithZXing() {
        if (!this.scanning || !this.video) return;

        try {
            const codeReader = new ZXing.BrowserMultiFormatReader();
            // Use video element directly
            codeReader.decodeFromVideoElement(this.video, (result, err) => {
                if (result) {
                    const code = result.getText();
                    console.log('Barcode detected:', code);
                    this.handleBarcodeDetected(code);
                }
                if (err && err.name !== 'NotFoundException') {
                    // Ignore NotFoundException (no barcode found yet)
                    console.warn('Scan error:', err);
                }
            });
            this.codeReader = codeReader;
        } catch (error) {
            console.error('Error with ZXing:', error);
            this.scanWithFallback();
        }
    }

    scanWithFallback() {
        // Simple fallback: Check video frame periodically
        // This is a basic implementation - for production, use a proper library
        console.warn('Using fallback scanning method (limited functionality)');
        
        // For now, we'll just show a message that manual input is needed
        // In a real implementation, you would use a library like QuaggaJS or ZXing
        alert('Gelişmiş barkod okuma için lütfen ürün adı veya barkod ile manuel ekleme yapın.');
        this.stopScanning();
    }

    handleBarcodeDetected(code) {
        if (!code) return;

        // Stop scanning
        this.stopScanning();

        // Find product by barcode
        if (window.countingSystem) {
            const product = window.countingSystem.findProduct(code);
            if (product) {
                window.countingSystem.addProductToCounting(product);
                window.countingSystem.showNotification('Ürün eklendi', 'success');
            } else {
                window.countingSystem.showNotification('Barkod için ürün bulunamadı', 'error');
            }
        } else {
            alert(`Barkod okundu: ${code}\nÜrün bulunamadı.`);
        }
    }

    stopScanning() {
        this.scanning = false;

        // Stop code reader
        if (this.codeReader) {
            try {
                this.codeReader.reset();
            } catch (error) {
                console.warn('Error resetting code reader:', error);
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

