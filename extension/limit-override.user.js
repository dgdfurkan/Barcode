// ==UserScript==
// @name         Mevcut Stok - Limit Override
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Mevcut Stok sayfasında limit input field'ına dönüştür ve API çağrılarını intercept et
// @author       You
// @match        *://*/*stock*
// @match        *://*/*Mevcut*Stok*
// @match        *://*/*current*stock*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // API çağrılarını intercept et - ÖNCE ÇALIŞMALI (document-start'ta)
    function interceptAPICalls() {
        const savedLimit = parseInt(localStorage.getItem('customLimit')) || 8408;

        // fetch API'yi intercept et
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            if (typeof url === 'string' && url.includes('/stocks') && url.includes('limit=')) {
                // URL'deki limit parametresini değiştir
                const newUrl = url.replace(/limit=\d+/g, `limit=${savedLimit}`);
                args[0] = newUrl;
                console.log('[Limit Override] API çağrısı intercept edildi:', newUrl);
            } else if (url instanceof Request) {
                const requestUrl = url.url;
                if (requestUrl.includes('/stocks') && requestUrl.includes('limit=')) {
                    const newUrl = requestUrl.replace(/limit=\d+/g, `limit=${savedLimit}`);
                    args[0] = new Request(newUrl, url);
                    console.log('[Limit Override] Request intercept edildi:', newUrl);
                }
            }
            return originalFetch.apply(this, args);
        };

        // XMLHttpRequest'i intercept et (eski tarayıcılar için)
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && url.includes('/stocks') && url.includes('limit=')) {
                const newUrl = url.replace(/limit=\d+/g, `limit=${savedLimit}`);
                console.log('[Limit Override] XHR intercept edildi:', newUrl);
                return originalXHROpen.call(this, method, newUrl, ...rest);
            }
            return originalXHROpen.call(this, method, url, ...rest);
        };

        // Axios veya diğer HTTP kütüphaneleri için URL parametrelerini değiştir
        const originalURLSearchParams = window.URLSearchParams;
        window.URLSearchParams = class extends originalURLSearchParams {
            set(name, value) {
                if (name === 'limit' && window.location.href.includes('stocks')) {
                    const customLimit = parseInt(localStorage.getItem('customLimit')) || savedLimit;
                    return super.set(name, customLimit.toString());
                }
                return super.set(name, value);
            }
        };
    }

    // Sayfa yüklemeden önce API intercept'lerini kur
    interceptAPICalls();

    // Input field oluşturma fonksiyonu
    function initLimitOverride() {
        // Limit select box'ı bul
        const limitContainer = document.getElementById('LIMIT_SELECT');
        const paginationSelect = document.getElementById('PAGINATION_SELECT');
        
        if (!limitContainer) {
            // Element henüz yüklenmemiş, biraz bekle
            setTimeout(initLimitOverride, 500);
            return;
        }

        // Eğer zaten dönüştürülmüşse tekrar çalıştırma
        if (document.getElementById('CUSTOM_LIMIT_INPUT')) {
            return;
        }

        // Ant Design select box'ı bul ve input field'a dönüştür
        const antSelect = limitContainer.querySelector('.ant-select');
        if (antSelect) {
            // Mevcut değeri al (100 gibi)
            const currentValue = antSelect.querySelector('.ant-select-selection-item')?.textContent || '100';
            const currentLimit = parseInt(currentValue) || 100;
            
            // Select box'ı gizle
            antSelect.style.display = 'none';
            
            // Yeni input field oluştur
            const input = document.createElement('input');
            input.type = 'number';
            input.id = 'CUSTOM_LIMIT_INPUT';
            input.className = 'ant-input ant-input-sm limitSelectBox-0-2-82';
            input.value = localStorage.getItem('customLimit') || '8408';
            input.min = '1';
            input.max = '100000';
            input.placeholder = 'Limit';
            input.style.cssText = 'width: 65px; height: 32px; padding: 4px 11px; border: 1px solid #d9d9d9; border-radius: 6px; text-align: center;';
            input.title = 'İstediğiniz limit değerini giriniz (Tüm ürünler için 8408 veya daha fazla)';
            
            // Input'u container'a ekle
            limitContainer.appendChild(input);
            
            // Pagination'ı kontrol et ve gizle
            const limitValue = parseInt(input.value) || 8408;
            if (limitValue >= 8408 && paginationSelect) {
                paginationSelect.style.display = 'none';
            }
            
            // Input değiştiğinde değeri kaydet ve pagination'ı güncelle
            input.addEventListener('change', function() {
                const value = parseInt(this.value);
                if (value && value > 0) {
                    localStorage.setItem('customLimit', value);
                    
                    // Limit 8408 veya daha fazlaysa pagination'ı gizle
                    if (value >= 8408 && paginationSelect) {
                        paginationSelect.style.display = 'none';
                    } else if (paginationSelect) {
                        paginationSelect.style.display = '';
                    }
                    
                    // API intercept fonksiyonunu yeniden kur (yeni limit değeriyle)
                    interceptAPICalls();
                    
                    // Sayfadaki mevcut API çağrısını yeniden tetikle (Getir butonuna tıkla)
                    const bringButton = document.getElementById('BRING_BUTTON');
                    if (bringButton) {
                        console.log('[Limit Override] Getir butonuna otomatik tıklanıyor...');
                        // Biraz bekle ki input değişikliği kaydedilsin
                        setTimeout(() => {
                            bringButton.click();
                        }, 100);
                    }
                }
            });
            
            // Input'a focus olduğunda sayıyı seç
            input.addEventListener('focus', function() {
                this.select();
            });
        }
    }

    // Sayfa yüklendiğinde çalıştır (document-start'ta çalıştığımız için DOM hazır olmayabilir)
    function waitForDOM() {
        if (document.body) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initLimitOverride);
            } else {
                initLimitOverride();
            }
        } else {
            setTimeout(waitForDOM, 100);
        }
    }
    waitForDOM();

    // React uygulaması için MutationObserver ekle
    const observer = new MutationObserver(function(mutations) {
        // LIMIT_SELECT elementi eklendiğinde veya değiştiğinde çalıştır
        if (document.getElementById('LIMIT_SELECT') && !document.getElementById('CUSTOM_LIMIT_INPUT')) {
            initLimitOverride();
        }
    });

    // Body hazır olduğunda observer'ı başlat
    function startObserver() {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            setTimeout(startObserver, 100);
        }
    }
    startObserver();

})();

