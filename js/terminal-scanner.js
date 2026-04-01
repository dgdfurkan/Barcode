// Terminal Scanner for Physical Barcode Scanner Devices (HID mode)
// HID cihazlar klavye gibi yazar; odak kaybında bile document capture ile yakalanır.
class TerminalScanner {
    constructor() {
        this.isActive = false;
        this.inputElement = null;
        this.modal = null;
        this.lastScannedCode = null;
        this.lastScanTime = 0;
        /** @type {string} */
        this.barcodeBuffer = '';
        /** @type {ReturnType<typeof setTimeout> | null} */
        this.idleTimer = null;
        this.listenersBound = false;
        this.closeBtnHandler = null;
        this.escapeHandler = null;
        this.bufferCaptureHandler = null;
        this.inputSyncHandler = null;
    }

    clearIdleTimer() {
        if (this.idleTimer != null) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    scheduleIdleCommit() {
        this.clearIdleTimer();
        this.idleTimer = setTimeout(() => {
            this.idleTimer = null;
            const code = (this.barcodeBuffer || '').trim();
            // Enter göndermeyen okuyucular; kısa kodlar Enter/Tab ile gelsin (yanlış kesmesin diye min 8)
            if (code.length >= 8) {
                this.flushBarcodeBuffer();
            }
        }, 300);
    }

    flushBarcodeBuffer() {
        this.clearIdleTimer();
        const code = (this.barcodeBuffer || '').trim();
        this.barcodeBuffer = '';
        if (this.inputElement) {
            this.inputElement.value = '';
        }
        if (code) {
            this.handleBarcodeScanned(code);
        }
    }

    startScanning() {
        try {
            this.removeEventListeners();

            this.modal = document.getElementById('terminalScannerModal');
            if (!this.modal) {
                console.error('Terminal scanner modal not found');
                return;
            }

            this.inputElement = document.getElementById('terminalBarcodeInput');
            if (!this.inputElement) {
                console.error('Terminal barcode input element not found');
                return;
            }

            this.barcodeBuffer = '';
            this.inputElement.value = '';
            this.inputElement.removeAttribute('readonly');

            this.modal.classList.remove('hidden');
            this.isActive = true;

            this.setupEventListeners();

            const focusInput = () => {
                try {
                    this.inputElement.focus({ preventScroll: true });
                } catch {
                    this.inputElement.focus();
                }
            };
            requestAnimationFrame(() => {
                focusInput();
                setTimeout(focusInput, 50);
                setTimeout(focusInput, 200);
            });

            console.log('✅ Terminal scanner started');
        } catch (error) {
            console.error('❌ Terminal scanner start error:', error);
        }
    }

    stopScanning() {
        try {
            this.removeEventListeners();

            if (this.modal) {
                this.modal.classList.add('hidden');
            }

            if (this.inputElement) {
                this.inputElement.value = '';
                this.inputElement.blur();
            }

            this.barcodeBuffer = '';
            this.clearIdleTimer();
            this.isActive = false;
            this.lastScannedCode = null;
            this.lastScanTime = 0;

            console.log('✅ Terminal scanner stopped');
        } catch (error) {
            console.error('❌ Terminal scanner stop error:', error);
        }
    }

    setupEventListeners() {
        this.closeBtnHandler = () => this.stopScanning();
        const closeBtn = document.getElementById('closeTerminalScannerModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeBtnHandler);
        }

        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.isActive) {
                e.preventDefault();
                this.stopScanning();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);

        // Document capture: odak input’ta olmasa bile HID barkod dizisini yakala
        this.bufferCaptureHandler = (e) => {
            if (!this.isActive) return;

            const t = e.target;
            if (t && (t.closest && (t.closest('#closeTerminalScannerModal') || t.closest('#terminalScannerModal button')))) {
                if (e.key === 'Enter' || e.key === ' ') {
                    return;
                }
            }

            if (e.key === 'Escape') {
                return;
            }

            if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                const pending = (this.barcodeBuffer || '').trim();
                if (pending.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.flushBarcodeBuffer();
                }
                return;
            }

            if (e.key === 'Tab') {
                const pending = (this.barcodeBuffer || '').trim();
                if (pending.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.flushBarcodeBuffer();
                }
                return;
            }

            if (e.ctrlKey || e.metaKey || e.altKey) return;

            if (e.key && e.key.length === 1) {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.barcodeBuffer = (this.barcodeBuffer || '') + e.key;
                if (this.inputElement) {
                    this.inputElement.value = this.barcodeBuffer;
                }
                this.scheduleIdleCommit();
            }
        };
        document.addEventListener('keydown', this.bufferCaptureHandler, true);

        // Yedek: odak input’ta ise input olayı (yapıştırma / IME)
        this.inputSyncHandler = () => {
            if (!this.isActive || !this.inputElement) return;
            this.barcodeBuffer = this.inputElement.value;
            if (this.barcodeBuffer.length > 0) {
                this.scheduleIdleCommit();
            }
        };
        this.inputElement.addEventListener('input', this.inputSyncHandler);

        this.listenersBound = true;
    }

    removeEventListeners() {
        const closeBtn = document.getElementById('closeTerminalScannerModal');
        if (closeBtn && this.closeBtnHandler) {
            closeBtn.removeEventListener('click', this.closeBtnHandler);
        }
        this.closeBtnHandler = null;

        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }

        if (this.bufferCaptureHandler) {
            document.removeEventListener('keydown', this.bufferCaptureHandler, true);
            this.bufferCaptureHandler = null;
        }

        if (this.inputElement && this.inputSyncHandler) {
            this.inputElement.removeEventListener('input', this.inputSyncHandler);
            this.inputSyncHandler = null;
        }

        this.listenersBound = false;
    }

    handleBarcodeScanned(barcode) {
        if (!barcode || barcode.length === 0) {
            return;
        }

        const now = Date.now();
        if (this.lastScannedCode === barcode && now - this.lastScanTime < 1000) {
            console.log('⚠️ Duplicate barcode ignored:', barcode);
            return;
        }

        this.lastScannedCode = barcode;
        this.lastScanTime = now;

        console.log('📦 Terminal barcode scanned:', barcode);

        const cs = window.countingSystem;
        if (!cs || typeof cs.findProductByBarcode !== 'function') {
            console.warn('Counting system not ready');
            if (cs && cs.showToast) {
                cs.showToast('Sayım sistemi hazır değil; sayfayı yenileyin.', 'error', 3000);
            }
            return;
        }

        const product = cs.findProductByBarcode(barcode);
        if (product && product.productId) {
            const existingProduct = cs.countingData[product.productId];
            if (existingProduct) {
                console.log('⚠️ Ürün zaten ekli:', product.name);
                if (cs.showToast) {
                    cs.showToast('Bu ürün zaten sayım tablosunda!', 'warning', 2000);
                }
                this.playWarningSound();
                this.showWarningFlash();
                return;
            }

            cs.addProductToCounting({
                id: product.productId,
                name: product.name,
                barcode: product.barcode || barcode
            });

            console.log('✅ Ürün eklendi:', product.name);
            this.playSuccessSound();
            this.showSuccessFlash();

            if (cs.showToast) {
                cs.showToast(`${product.name || 'Ürün'} eklendi`, 'success', 2000);
            }
        } else {
            console.log('❌ Ürün bulunamadı:', barcode);
            if (cs.showToast) {
                cs.showToast(`Barkod "${barcode}" için ürün bulunamadı`, 'error', 3000);
            }
            this.playErrorSound();
            this.showErrorFlash();
        }
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
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const audioContext = new AudioCtx();
            const duration = 0.3;
            const volume = 0.3;
            const frequencies = [523.25, 659.25, 783.99];

            frequencies.forEach((freq, index) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = 'sine';

                const startTime = audioContext.currentTime + index * 0.05;
                const endTime = startTime + duration;

                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

                oscillator.start(startTime);
                oscillator.stop(endTime);
            });
        } catch (error) {
            if (window.DEBUG_TERMINAL_SCANNER) {
                console.warn('⚠️ Ses çalınamadı:', error);
            }
        }
    }

    playErrorSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const audioContext = new AudioCtx();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 300;
            oscillator.type = 'sine';

            const startTime = audioContext.currentTime;
            const duration = 0.3;
            const endTime = startTime + duration;

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

            oscillator.start(startTime);
            oscillator.stop(endTime);
        } catch (error) {
            if (window.DEBUG_TERMINAL_SCANNER) {
                console.warn('⚠️ Hata sesi çalınamadı:', error);
            }
        }
    }

    playWarningSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const audioContext = new AudioCtx();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 400;
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
            if (window.DEBUG_TERMINAL_SCANNER) {
                console.warn('⚠️ Uyarı sesi çalınamadı:', error);
            }
        }
    }
}

window.terminalScanner = new TerminalScanner();
