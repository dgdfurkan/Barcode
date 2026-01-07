// Terminal Scanner for Physical Barcode Scanner Devices (HID mode)
class TerminalScanner {
    constructor() {
        this.isActive = false;
        this.inputElement = null;
        this.modal = null;
        this.lastScannedCode = null;
        this.lastScanTime = 0;
        this.inputHandler = null;
        this.keydownHandler = null;
    }

    startScanning() {
        try {
            // Open modal
            this.modal = document.getElementById('terminalScannerModal');
            if (!this.modal) {
                console.error('Terminal scanner modal not found');
                return;
            }
            this.modal.classList.remove('hidden');

            // Get input element
            this.inputElement = document.getElementById('terminalBarcodeInput');
            if (!this.inputElement) {
                console.error('Terminal barcode input element not found');
                return;
            }

            // Clear input
            this.inputElement.value = '';
            
            // Focus input (for terminal devices)
            setTimeout(() => {
                this.inputElement.focus();
            }, 100);

            // Setup event listeners
            this.setupEventListeners();

            this.isActive = true;
            console.log('✅ Terminal scanner started');
        } catch (error) {
            console.error('❌ Terminal scanner start error:', error);
        }
    }

    stopScanning() {
        try {
            // Remove event listeners
            this.removeEventListeners();

            // Close modal
            if (this.modal) {
                this.modal.classList.add('hidden');
            }

            // Clear input
            if (this.inputElement) {
                this.inputElement.value = '';
                this.inputElement.blur();
            }

            // Reset state
            this.isActive = false;
            this.lastScannedCode = null;
            this.lastScanTime = 0;

            console.log('✅ Terminal scanner stopped');
        } catch (error) {
            console.error('❌ Terminal scanner stop error:', error);
        }
    }

    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('closeTerminalScannerModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.stopScanning());
        }

        // Input handler - captures barcode when Enter is pressed
        this.inputHandler = (e) => {
            if (!this.isActive) return;

            // Terminal devices send Enter after barcode
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                const barcode = this.inputElement.value.trim();
                
                if (barcode) {
                    this.handleBarcodeScanned(barcode);
                    // Clear input for next scan
                    this.inputElement.value = '';
                }
            }
        };

        // Keydown handler for better compatibility
        this.keydownHandler = (e) => {
            if (!this.isActive) return;

            // Some terminals might send different key codes
            if (e.key === 'Enter' || e.keyCode === 13) {
                const barcode = this.inputElement.value.trim();
                
                if (barcode && barcode.length > 0) {
                    // Prevent default Enter behavior
                    e.preventDefault();
                    this.handleBarcodeScanned(barcode);
                    // Clear input for next scan
                    this.inputElement.value = '';
                }
            }
        };

        // Add listeners
        if (this.inputElement) {
            this.inputElement.addEventListener('keypress', this.inputHandler);
            this.inputElement.addEventListener('keydown', this.keydownHandler);
        }

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.stopScanning();
            }
        });
    }

    removeEventListeners() {
        if (this.inputElement && this.inputHandler) {
            this.inputElement.removeEventListener('keypress', this.inputHandler);
        }
        if (this.inputElement && this.keydownHandler) {
            this.inputElement.removeEventListener('keydown', this.keydownHandler);
        }
    }

    handleBarcodeScanned(barcode) {
        if (!barcode || barcode.length === 0) {
            return;
        }

        // Debounce: prevent duplicate scans within 1 second
        const now = Date.now();
        if (this.lastScannedCode === barcode && (now - this.lastScanTime) < 1000) {
            console.log('⚠️ Duplicate barcode ignored:', barcode);
            return;
        }

        this.lastScannedCode = barcode;
        this.lastScanTime = now;

        console.log('📦 Terminal barcode scanned:', barcode);

        // Find product by barcode
        if (window.countingSystem) {
            const product = window.countingSystem.findProductByBarcode(barcode);
            if (product && product.productId) {
                // Check if product already exists in counting data
                const existingProduct = window.countingSystem.countingData[product.productId];
                if (existingProduct) {
                    // Product already added, show warning
                    if (window.countingSystem.showToast) {
                        window.countingSystem.showToast('Bu ürün zaten sayım tablosunda!', 'warning', 2000);
                    }
                    this.playWarningSound();
                    this.showWarningFlash();
                    return; // Don't add again
                }

                // Add product to counting
                window.countingSystem.addProductToCounting({
                    id: product.productId,
                    name: product.name,
                    barcode: product.barcode || barcode
                });
                
                // Success feedback
                this.playSuccessSound();
                this.showSuccessFlash();
                
                // Toast notification
                if (window.countingSystem.showToast) {
                    window.countingSystem.showToast(`${product.name || 'Ürün'} eklendi`, 'success', 2000);
                }
            } else {
                // Product not found
                if (window.countingSystem.showToast) {
                    window.countingSystem.showToast(`Barkod "${barcode}" için ürün bulunamadı`, 'error', 3000);
                }
                // Error feedback
                this.playErrorSound();
                this.showErrorFlash();
            }
        } else {
            console.warn('Counting system not found');
        }

        // Keep modal open for continuous scanning
        // Input will be cleared and ready for next scan
    }

    showSuccessFlash() {
        const overlay = document.getElementById('terminalFlashOverlay');
        if (!overlay) return;

        overlay.className = 'fixed inset-0 z-50 pointer-events-none transition-opacity duration-200 flash-green';
        overlay.style.opacity = '0.8';
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.className = 'fixed inset-0 z-50 pointer-events-none transition-opacity duration-200 opacity-0';
            }, 200);
        }, 200);
    }

    showErrorFlash() {
        const overlay = document.getElementById('terminalFlashOverlay');
        if (!overlay) return;

        overlay.className = 'fixed inset-0 z-50 pointer-events-none transition-opacity duration-200 flash-red';
        overlay.style.opacity = '0.8';
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.className = 'fixed inset-0 z-50 pointer-events-none transition-opacity duration-200 opacity-0';
            }, 200);
        }, 200);
    }

    showWarningFlash() {
        const overlay = document.getElementById('terminalFlashOverlay');
        if (!overlay) return;

        overlay.className = 'fixed inset-0 z-50 pointer-events-none transition-opacity duration-200 flash-orange';
        overlay.style.opacity = '0.8';
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.className = 'fixed inset-0 z-50 pointer-events-none transition-opacity duration-200 opacity-0';
            }, 200);
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
            if (window.DEBUG_TERMINAL_SCANNER) {
                console.warn('⚠️ Ses çalınamadı:', error);
            }
        }
    }

    playErrorSound() {
        try {
            // Hata sesi: Düşük frekans, kısa süre
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 300; // Düşük frekans
            oscillator.type = 'sine';
            
            const startTime = audioContext.currentTime;
            const duration = 0.3; // 300ms
            const endTime = startTime + duration;
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
            
            oscillator.start(startTime);
            oscillator.stop(endTime);
        } catch (error) {
            // Web Audio API desteklenmiyorsa sessizce devam et
            if (window.DEBUG_TERMINAL_SCANNER) {
                console.warn('⚠️ Hata sesi çalınamadı:', error);
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
            if (window.DEBUG_TERMINAL_SCANNER) {
                console.warn('⚠️ Uyarı sesi çalınamadı:', error);
            }
        }
    }
}

// Global instance
window.terminalScanner = new TerminalScanner();

