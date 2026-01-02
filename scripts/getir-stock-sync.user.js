// ==UserScript==
// @name         Getir Stok Senkronizasyonu
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Getir franchise stok sayfasından stok verilerini senkronize eder
// @author       GunduzDev
// @match        https://franchise.getir.com/stock/current
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('✅ Getir Stok Senkronizasyonu scripti yüklendi');

    // Polling mechanism - localStorage'dan istekleri kontrol et
    setInterval(async function() {
        try {
            const requestKey = 'getir_stock_request';
            const request = localStorage.getItem(requestKey);
            
            if (request) {
                const requestData = JSON.parse(request);
                console.log('📦 Stok isteği alındı:', requestData);
                
                // İsteği sil
                localStorage.removeItem(requestKey);
                
                try {
                    const stockValue = await getStockFromPage(requestData.productName, requestData.barcode);
                    
                    // Sonucu localStorage'a yaz
                    const responseKey = 'getir_stock_response_' + requestData.requestId;
                    localStorage.setItem(responseKey, JSON.stringify({
                        success: true,
                        productName: requestData.productName || requestData.barcode,
                        stock: stockValue,
                        timestamp: Date.now()
                    }));
                    
                    console.log('✅ Stok değeri alındı:', stockValue);
                } catch (error) {
                    console.error('❌ Stok alınırken hata:', error);
                    
                    // Hata sonucunu localStorage'a yaz
                    const responseKey = 'getir_stock_response_' + requestData.requestId;
                    localStorage.setItem(responseKey, JSON.stringify({
                        success: false,
                        productName: requestData.productName || requestData.barcode,
                        error: error.message,
                        timestamp: Date.now()
                    }));
                }
            }
        } catch (error) {
            console.error('Error checking stock requests:', error);
        }
    }, 1000); // Her saniye kontrol et

    // Stok değerini sayfadan al
    async function getStockFromPage(productName, barcode) {
        return new Promise((resolve, reject) => {
            try {
                const searchTerm = productName || barcode;
                console.log('🔍 Ürün aranıyor:', searchTerm);

                // PRODUCT_SELECT dropdown'ını bul
                const productSelect = document.querySelector('#PRODUCT_SELECT');
                if (!productSelect) {
                    reject(new Error('Ürün seçim alanı bulunamadı'));
                    return;
                }

                // React Select control'ünü bul ve tıkla
                const reactSelectControl = productSelect.querySelector('.css-13cymwt-control, .css-t3ip-control, [class*="control"]');
                if (!reactSelectControl) {
                    reject(new Error('Ürün seçim bileşeni bulunamadı'));
                    return;
                }

                // Dropdown'u aç
                reactSelectControl.click();
                
                // Input alanını bul ve ürün adı/barkod yaz
                setTimeout(() => {
                    // React Select'in input'unu bul
                    const reactInput = productSelect.querySelector('input[type="text"], input[class*="input"], input');
                    if (!reactInput) {
                        reject(new Error('Ürün arama inputu bulunamadı'));
                        return;
                    }
                    
                    // Input'u temizle ve değer yaz
                    reactInput.focus();
                    reactInput.value = '';
                    
                    // React için native setter kullan
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(reactInput, searchTerm);
                    
                    // Event'leri tetikle
                    reactInput.dispatchEvent(new Event('input', { bubbles: true }));
                    reactInput.dispatchEvent(new Event('change', { bubbles: true }));
                    reactInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
                    
                    console.log('✍️ Ürün adı yazıldı:', searchTerm);
                    
                    // Sonuçları bekle ve seç
                    setTimeout(() => {
                        selectProductFromDropdown(searchTerm).then(() => {
                            console.log('✅ Ürün seçildi');
                            
                            // Getir butonuna tıkla
                            setTimeout(() => {
                                clickBringButton().then(() => {
                                    console.log('✅ Getir butonuna tıklandı');
                                    
                                    // Stok değerini bekle ve al
                                    setTimeout(() => {
                                        getStockValue().then((stock) => {
                                            console.log('✅ Stok değeri alındı:', stock);
                                            resolve(stock);
                                        }).catch(reject);
                                    }, 3000); // Tablo yüklenmesi için bekleme
                                }).catch(reject);
                            }, 1500); // Ürün seçimi için bekleme
                        }).catch(reject);
                    }, 1000); // Arama sonuçları için bekleme
                }, 500); // Dropdown açılması için bekleme
            } catch (error) {
                reject(error);
            }
        });
    }

    // Dropdown'dan ürün seç
    async function selectProductFromDropdown(searchTerm) {
        return new Promise((resolve, reject) => {
            // React Select menüsünü bul - birkaç farklı selector dene
            let menu = document.querySelector('#PRODUCT_SELECT + div [class*="menu"], .css-1nmdiq5-menu, [class*="menu"]');
            
            // Eğer menu bulunamazsa, biraz bekle ve tekrar dene
            if (!menu) {
                setTimeout(() => {
                    menu = document.querySelector('#PRODUCT_SELECT + div [class*="menu"], .css-1nmdiq5-menu, [class*="menu"]');
                    if (!menu) {
                        // Son çare: tüm option'ları bul
                        const allOptions = document.querySelectorAll('[class*="option"], [role="option"], div[class*="Option"]');
                        if (allOptions.length > 0) {
                            allOptions[0].click();
                            setTimeout(resolve, 500);
                        } else {
                            reject(new Error('Ürün seçeneği bulunamadı'));
                        }
                        return;
                    }
                    
                    // Seçenekleri bul
                    const options = menu.querySelectorAll('[class*="option"], [role="option"], div[class*="Option"]');
                    if (options.length === 0) {
                        reject(new Error('Ürün seçeneği bulunamadı'));
                        return;
                    }

                    // İlk seçeneği seç
                    options[0].click();
                    setTimeout(resolve, 500);
                }, 500);
                return;
            }

            // Seçenekleri bul
            const options = menu.querySelectorAll('[class*="option"], [role="option"], div[class*="Option"]');
            if (options.length === 0) {
                reject(new Error('Ürün seçeneği bulunamadı'));
                return;
            }

            // İlk seçeneği seç (tam eşleşme için)
            options[0].click();
            setTimeout(resolve, 500);
        });
    }

    // Getir butonuna tıkla
    async function clickBringButton() {
        return new Promise((resolve, reject) => {
            const bringButton = document.querySelector('#BRING_BUTTON');
            if (!bringButton) {
                reject(new Error('Getir butonu bulunamadı'));
                return;
            }

            bringButton.click();
            setTimeout(resolve, 1000); // Buton tıklaması için bekleme
        });
    }

    // Stok değerini tablodan al
    async function getStockValue() {
        return new Promise((resolve, reject) => {
            // Stok kolonunu bul - tüm header'ları kontrol et
            const headers = document.querySelectorAll('th.ant-table-cell');
            let stockIndex = -1;
            
            headers.forEach((header, index) => {
                const text = header.textContent.trim();
                const ariaLabel = header.getAttribute('aria-label');
                if (text === 'Stok' || ariaLabel === 'Stok') {
                    stockIndex = index;
                }
            });

            if (stockIndex === -1) {
                reject(new Error('Stok kolonu bulunamadı'));
                return;
            }

            // İlk satırdaki stok değerini al
            const rows = document.querySelectorAll('tbody.ant-table-tbody tr');
            if (rows.length === 0) {
                reject(new Error('Stok tablosu bulunamadı'));
                return;
            }

            const firstRow = rows[0];
            const cells = firstRow.querySelectorAll('td.ant-table-cell');
            if (cells.length <= stockIndex) {
                reject(new Error('Stok hücresi bulunamadı'));
                return;
            }

            const stockCell = cells[stockIndex];
            const stockText = stockCell.textContent.trim();
            const stockValue = parseInt(stockText, 10);

            if (isNaN(stockValue)) {
                reject(new Error('Geçersiz stok değeri: ' + stockText));
                return;
            }

            resolve(stockValue);
        });
    }

    // Helper: contains selector (jQuery benzeri)
    function findElementByText(selector, text) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
            if (el.textContent.includes(text)) {
                return el;
            }
        }
        return null;
    }

    console.log('✅ Getir Stok Senkronizasyonu scripti hazır');
})();

