// ==UserScript==
// @name         Mevcut Stok - Excel Export with Images
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Mevcut Stok verilerini Excel'e görsellerle birlikte aktar (görseller direkt gömülü, uyarı yok)
// @author       You
// @match        *://*/*stock*
// @match        *://*/*Mevcut*Stok*
// @match        *://*/*current*stock*
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ExcelJS yüklendiğinde çalışacak fonksiyon
    function initExcelExport(retryCount = 0) {
        const maxRetries = 20; // 20 deneme (toplam ~10 saniye)

        // Eğer buton zaten varsa çık
        if (document.getElementById('EXCEL_EXPORT_BUTTON')) {
            return;
        }

        // Mevcut Stok sayfasında değilsek ve retry sayısı dolmadıysa tekrar dene
        const isStockPage = document.getElementById('LIMIT_SELECT') || document.querySelector('.ant-table-tbody');
        if (!isStockPage) {
            if (retryCount < maxRetries) {
                setTimeout(() => initExcelExport(retryCount + 1), 500);
            }
            return;
        }

        // Header'ı eski yöntemle bul (önce eski selector'ları dene)
        let header = document.querySelector('.header-0-2-69') || document.querySelector('.header-d0-0-2-76');
        
        // Eğer eski header bulunamazsa, alternatif yöntemler dene
        if (!header) {
            const headerSelectors = [
                '[class*="header"]',
                'header',
                '.ant-layout-header'
            ];
            for (const selector of headerSelectors) {
                const found = document.querySelector(selector);
                if (found) {
                    header = found;
                    break;
                }
            }
        }

        // rightContainer'ı eski yöntemle bul (önce eski selector'ı dene)
        let rightContainer = null;
        if (header) {
            rightContainer = header.querySelector('.rightContainer-0-2-71');
        }

        // Eğer eski rightContainer bulunamazsa, alternatif yöntemler dene
        if (!rightContainer && header) {
            const containerSelectors = [
                '[class*="rightContainer"]',
                '[class*="right-container"]'
            ];
            for (const selector of containerSelectors) {
                const found = header.querySelector(selector);
                if (found) {
                    rightContainer = found;
                    break;
                }
            }
        }

        // Buton oluştur ve ekle
        if (rightContainer) {
            try {
                const exportBtn = document.createElement('button');
                exportBtn.id = 'EXCEL_EXPORT_BUTTON';
                exportBtn.type = 'button';
                exportBtn.className = 'ant-btn ant-btn-primary';
                exportBtn.innerHTML = '<span role="img" aria-label="export" class="anticon"><svg viewBox="64 64 896 896" focusable="false" data-icon="download" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M505.7 661a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"></path></svg></span> Excel\'e Aktar';
                exportBtn.style.marginLeft = '8px';
                exportBtn.onclick = exportToExcel;
                
                rightContainer.appendChild(exportBtn);
                console.log('[Excel Export] Buton başarıyla eklendi');
                return;
            } catch (error) {
                console.error('[Excel Export] Buton eklenirken hata:', error);
            }
        }

        // Buton eklenemediyse, retry yap
        if (retryCount < maxRetries) {
            setTimeout(() => initExcelExport(retryCount + 1), 500);
        } else {
            console.warn('[Excel Export] Buton eklenemedi: Max retry sayısına ulaşıldı');
        }
    }


    // Tablo verilerini topla
    async function collectTableData() {
        const tbody = document.querySelector('.ant-table-tbody');
        if (!tbody) {
            throw new Error('Tablo bulunamadı!');
        }

        const rows = tbody.querySelectorAll('tr[data-row-key]');
        const data = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td');

            if (cells.length < 10) continue;

            // Görsel - tam URL'yi al
            const imgCell = cells[0];
            const img = imgCell.querySelector('img');
            let imageUrl = '';
            if (img) {
                // Önce currentSrc dene (yüklenmiş görsel için)
                imageUrl = img.currentSrc || img.src || img.getAttribute('src') || '';
                // Relative URL ise tam URL'ye çevir
                if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                    try {
                        imageUrl = new URL(imageUrl, window.location.origin).href;
                    } catch (e) {
                        // Hata varsa orijinal URL'yi kullan
                    }
                }
                // Boş veya data URL ise görmezden gel
                if (imageUrl.startsWith('data:') || !imageUrl) {
                    imageUrl = '';
                }
            }

            // Ürün Adı
            const productName = cells[1]?.textContent?.trim() || '';

            // Kategori
            const category = cells[2]?.textContent?.trim() || '';

            // Alt Kategori
            const subCategory = cells[3]?.textContent?.trim() || '';

            // Stok
            const stock = cells[6]?.textContent?.trim() || '0';

            // Fiyat
            const price = cells[8]?.textContent?.trim() || '';

            // Statü
            const status = cells[9]?.querySelector('.ant-tag')?.textContent?.trim() || '';

            data.push({
                imageUrl,
                productName,
                category,
                subCategory,
                stock,
                price,
                status
            });
        }

        return data;
    }

    // Görsel ekleme yöntemi seçeneği göster
    function showImageMethodDialog() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
            
            const dialog = document.createElement('div');
            dialog.style.cssText = 'background:white;padding:24px;border-radius:8px;max-width:450px;width:90%;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            
            dialog.innerHTML = `
                <h3 style="margin:0 0 16px 0;font-size:16px;font-weight:600;">Görsel Ekleme Yöntemi Seçin</h3>
                <div style="margin-bottom:16px;">
                    <label style="display:flex;align-items:flex-start;margin-bottom:12px;cursor:pointer;padding:8px;border-radius:4px;transition:background 0.2s;">
                        <input type="radio" name="imageMethod" value="formula" checked style="margin-right:8px;margin-top:2px;">
                        <div>
                            <strong>IMAGE() Formülü (Hızlı):</strong><br>
                            <small style="color:#666;">Görseller harici link olarak eklenir. Excel uyarı verebilir. Daha hızlıdır.</small>
                        </div>
                    </label>
                    <label style="display:flex;align-items:flex-start;cursor:pointer;padding:8px;border-radius:4px;transition:background 0.2s;">
                        <input type="radio" name="imageMethod" value="embedded" style="margin-right:8px;margin-top:2px;">
                        <div>
                            <strong>Görselleri Göm (Uyarı Yok):</strong><br>
                            <small style="color:#666;">Görseller direkt Excel dosyasına gömülür. Uyarı yok ama daha yavaştır.</small>
                        </div>
                    </label>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button id="cancelImageMethod" style="padding:6px 16px;border:1px solid #d9d9d9;background:white;border-radius:4px;cursor:pointer;">İptal</button>
                    <button id="confirmImageMethod" style="padding:6px 16px;border:none;background:#1890ff;color:white;border-radius:4px;cursor:pointer;">Devam Et</button>
                </div>
            `;
            
            const labels = dialog.querySelectorAll('label');
            labels.forEach(label => {
                label.onmouseenter = () => label.style.background = '#f5f5f5';
                label.onmouseleave = () => label.style.background = '';
            });
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            document.getElementById('confirmImageMethod').onclick = () => {
                const selected = document.querySelector('input[name="imageMethod"]:checked').value;
                document.body.removeChild(modal);
                resolve(selected);
            };
            
            document.getElementById('cancelImageMethod').onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };
            
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', handleEsc);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }

    // Sütun sıralaması seçeneği göster
    function showColumnOrderDialog() {
        return new Promise((resolve) => {
            // Modal dialog oluştur
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
            
            const dialog = document.createElement('div');
            dialog.style.cssText = 'background:white;padding:24px;border-radius:8px;max-width:400px;width:90%;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            
            dialog.innerHTML = `
                <h3 style="margin:0 0 16px 0;font-size:16px;font-weight:600;">Sütun Sıralaması Seçin</h3>
                <div style="margin-bottom:16px;">
                    <label style="display:flex;align-items:flex-start;margin-bottom:12px;cursor:pointer;padding:8px;border-radius:4px;transition:background 0.2s;">
                        <input type="radio" name="columnOrder" value="default" checked style="margin-right:8px;margin-top:2px;">
                        <div>
                            <strong>Varsayılan:</strong><br>
                            Görsel → Ürün Adı → Stok → Kategori → Alt Kategori → Fiyat → Statü
                        </div>
                    </label>
                    <label style="display:flex;align-items:flex-start;cursor:pointer;padding:8px;border-radius:4px;transition:background 0.2s;">
                        <input type="radio" name="columnOrder" value="stockMiddle" style="margin-right:8px;margin-top:2px;">
                        <div>
                            <strong>Stok Ortada:</strong><br>
                            Görsel → Stok → Ürün Adı → Kategori → Alt Kategori → Fiyat → Statü
                        </div>
                    </label>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button id="cancelExport" style="padding:6px 16px;border:1px solid #d9d9d9;background:white;border-radius:4px;cursor:pointer;">İptal</button>
                    <button id="confirmExport" style="padding:6px 16px;border:none;background:#1890ff;color:white;border-radius:4px;cursor:pointer;">Devam Et</button>
                </div>
            `;
            
            // Hover efektleri
            const labels = dialog.querySelectorAll('label');
            labels.forEach(label => {
                label.onmouseenter = () => label.style.background = '#f5f5f5';
                label.onmouseleave = () => label.style.background = '';
            });
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            document.getElementById('confirmExport').onclick = () => {
                const selected = document.querySelector('input[name="columnOrder"]:checked').value;
                document.body.removeChild(modal);
                resolve(selected);
            };
            
            document.getElementById('cancelExport').onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };
            
            // ESC tuşu ile kapat
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', handleEsc);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }

    // Excel'e export (IMAGE() formülü kullanarak)
    async function exportToExcel() {
        const btn = document.getElementById('EXCEL_EXPORT_BUTTON');
        if (btn.disabled) return;

        btn.disabled = true;
        btn.textContent = 'Veriler toplanıyor...';

        try {
            // XLSX kütüphanesi yüklendi mi kontrol et
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX kütüphanesi yüklenmedi. Sayfayı yenileyin.');
            }

            // Verileri topla
            const data = await collectTableData();
            
            if (data.length === 0) {
                alert('Export edilecek veri bulunamadı!');
                btn.disabled = false;
                btn.textContent = 'Excel\'e Aktar';
                return;
            }

            // Önce görsel ekleme yöntemi seçeneği göster
            const imageMethod = await showImageMethodDialog();
            if (imageMethod === null) {
                btn.disabled = false;
                btn.textContent = 'Excel\'e Aktar';
                return;
            }

            // Sonra sütun sıralaması seçeneği göster
            const columnOrder = await showColumnOrderDialog();
            if (columnOrder === null) {
                btn.disabled = false;
                btn.textContent = 'Excel\'e Aktar';
                return;
            }

            btn.textContent = `Excel oluşturuluyor... (${data.length} ürün)`;

            // Görsel ekleme yöntemine göre farklı işlem
            if (imageMethod === 'embedded') {
                // Görselleri direkt göm (ExcelJS kullanarak)
                await exportWithEmbeddedImages(data, columnOrder, btn);
                return;
            }
            
            // IMAGE() formülü kullanarak (XLSX ile)
            await exportWithImageFormula(data, columnOrder, btn);
        } catch (error) {
            console.error('Excel export hatası:', error);
            alert('Export sırasında hata oluştu: ' + error.message);
            btn.disabled = false;
            btn.textContent = 'Excel\'e Aktar';
        }
    }

    // IMAGE() formülü kullanarak export
    async function exportWithImageFormula(data, columnOrder, btn) {
        // XLSX kütüphanesi yüklendi mi kontrol et
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX kütüphanesi yüklenmedi. Sayfayı yenileyin.');
        }

        // Workbook oluştur
        const wb = XLSX.utils.book_new();
        
        // Sütun sıralamasına göre başlıklar ve veriler
        let headers, columnWidths, imageColumnIndex;
        
        if (columnOrder === 'stockMiddle') {
            // Stok ortada: Görsel → Stok → Ürün Adı → Kategori → Alt Kategori → Fiyat → Statü
            headers = ['Ürün Görseli', 'Stok', 'Ürün Adı', 'Kategori', 'Alt Kategori', 'Fiyat', 'Statü'];
            columnWidths = [
                { wch: 7 },   // Görsel
                { wch: 10 },  // Stok
                { wch: 50 },  // Ürün Adı
                { wch: 20 },  // Kategori
                { wch: 20 },  // Alt Kategori
                { wch: 15 },  // Fiyat
                { wch: 12 }   // Statü
            ];
            imageColumnIndex = 0;
        } else {
            // Varsayılan: Görsel → Ürün Adı → Stok → Kategori → Alt Kategori → Fiyat → Statü
            headers = ['Ürün Görseli', 'Ürün Adı', 'Stok', 'Kategori', 'Alt Kategori', 'Fiyat', 'Statü'];
            columnWidths = [
                { wch: 7 },   // Görsel
                { wch: 50 },  // Ürün Adı
                { wch: 10 },  // Stok
                { wch: 20 },  // Kategori
                { wch: 20 },  // Alt Kategori
                { wch: 15 },  // Fiyat
                { wch: 12 }   // Statü
            ];
            imageColumnIndex = 0;
        }
        
        // Veri array'i oluştur (başlıklar + veriler)
        const wsData = [headers];

        // Her satır için veri ekle
        data.forEach(item => {
            if (columnOrder === 'stockMiddle') {
                // Stok ortada sıralama
                wsData.push([
                    '',  // Görsel - formül sonra eklenecek
                    item.stock || '0',
                    item.productName || '',
                    item.category || '',
                    item.subCategory || '',
                    item.price || '',
                    item.status || ''
                ]);
            } else {
                // Varsayılan sıralama
                wsData.push([
                    '',  // Görsel - formül sonra eklenecek
                    item.productName || '',
                    item.stock || '0',
                    item.category || '',
                    item.subCategory || '',
                    item.price || '',
                    item.status || ''
                ]);
            }
        });

        // Worksheet oluştur
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Sütun genişliklerini ayarla
        ws['!cols'] = columnWidths;

        // Satır yüksekliklerini ayarla (görseller için)
        if (!ws['!rows']) ws['!rows'] = [];
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = 1; R <= range.e.r; R++) {
            if (!ws['!rows'][R]) ws['!rows'][R] = {};
            ws['!rows'][R].hpt = 27; // Pixel height (80/3 ≈ 27px, daha kompakt)
        }

        // Görsel sütunundaki hücrelere IMAGE() formülü ekle
        for (let i = 1; i <= data.length; i++) {
            const cellAddress = XLSX.utils.encode_cell({ r: i, c: imageColumnIndex });
            if (data[i - 1].imageUrl) {
                // URL'yi temizle ve doğrula
                let imageUrl = data[i - 1].imageUrl.trim();
                
                // Relative URL ise tam URL'ye çevir
                if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                    try {
                        imageUrl = new URL(imageUrl, window.location.origin).href;
                    } catch (e) {
                        console.warn('Geçersiz URL:', imageUrl);
                        continue;
                    }
                }
                
                // IMAGE() formülü ekle
                // Format: =IMAGE("url",1) - 1 = orijinal boyut, 2 = fit, 3 = resize
                // URL'deki tırnakları çift tırnakla escape et (Excel formatı için)
                const escapedUrl = imageUrl.replace(/"/g, '""');
                
                ws[cellAddress] = {
                    f: `IMAGE("${escapedUrl}",1)`,
                    t: 'n' // Formula type
                };
                
                console.log(`[Excel Export] Görsel eklendi: ${imageUrl}`);
            }
        }

        // Başlık satırını vurgula ve filtre ekle
        const headerRange = XLSX.utils.decode_range(ws['!ref']);
        for (let C = 0; C <= headerRange.e.c; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' };
            ws[cellAddress].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: 'D3D3D3' } }
            };
        }
        
        // Filtre ekle (autofilter) - Excel'de başlık satırında filtre okları görünecek
        if (headerRange.e.c >= 0 && headerRange.e.r >= 0) {
            const filterRange = XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: { r: headerRange.e.r, c: headerRange.e.c }
            });
            ws['!autofilter'] = { ref: filterRange };
        }

        // Worksheet'i workbook'a ekle
        XLSX.utils.book_append_sheet(wb, ws, 'Mevcut Stok');

        // Excel dosyasını oluştur ve indir
        const wbout = XLSX.write(wb, { 
            bookType: 'xlsx', 
            type: 'array',
            cellStyles: true 
        });
        
        const blob = new Blob([wbout], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Mevcut_Stok_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        btn.textContent = 'Excel\'e Aktar ✓';
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<span role="img" aria-label="export" class="anticon"><svg viewBox="64 64 896 896" focusable="false" data-icon="download" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M505.7 661a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"></path></svg></span> Excel\'e Aktar';
        }, 2000);
    }

    // Görselleri direkt gömülü olarak export (ExcelJS ile)
    async function exportWithEmbeddedImages(data, columnOrder, btn) {
        if (typeof ExcelJS === 'undefined') {
            throw new Error('ExcelJS kütüphanesi yüklenmedi. Sayfayı yenileyin.');
        }

        btn.textContent = `Görseller indiriliyor... (0/${data.length})`;

        // ExcelJS workbook oluştur
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Mevcut Stok');

        // Sütun sıralamasına göre başlıklar
        let headers, imageColumnIndex;
        if (columnOrder === 'stockMiddle') {
            headers = ['Ürün Görseli', 'Stok', 'Ürün Adı', 'Kategori', 'Alt Kategori', 'Fiyat', 'Statü'];
            imageColumnIndex = 0;
        } else {
            headers = ['Ürün Görseli', 'Ürün Adı', 'Stok', 'Kategori', 'Alt Kategori', 'Fiyat', 'Statü'];
            imageColumnIndex = 0;
        }

        // Başlık satırı ekle
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };

        // Sütun genişliklerini ayarla
        worksheet.getColumn(1).width = 7;   // Görsel
        worksheet.getColumn(2).width = columnOrder === 'stockMiddle' ? 10 : 50;
        worksheet.getColumn(3).width = columnOrder === 'stockMiddle' ? 50 : 10;
        worksheet.getColumn(4).width = 20;
        worksheet.getColumn(5).width = 20;
        worksheet.getColumn(6).width = 15;
        worksheet.getColumn(7).width = 12;

        // Satır yüksekliklerini ayarla
        for (let i = 2; i <= data.length + 1; i++) {
            worksheet.getRow(i).height = 27;
        }

        // Verileri ve görselleri ekle
        for (let i = 0; i < data.length; i++) {
            btn.textContent = `Görseller indiriliyor... (${i + 1}/${data.length})`;

            const item = data[i];
            const rowData = [];

            if (columnOrder === 'stockMiddle') {
                rowData.push(''); // Görsel - sonra eklenecek
                rowData.push(item.stock || '0');
                rowData.push(item.productName || '');
                rowData.push(item.category || '');
                rowData.push(item.subCategory || '');
                rowData.push(item.price || '');
                rowData.push(item.status || '');
            } else {
                rowData.push(''); // Görsel - sonra eklenecek
                rowData.push(item.productName || '');
                rowData.push(item.stock || '0');
                rowData.push(item.category || '');
                rowData.push(item.subCategory || '');
                rowData.push(item.price || '');
                rowData.push(item.status || '');
            }

            const row = worksheet.addRow(rowData);

            // Görsel varsa ekle
            if (item.imageUrl) {
                try {
                    let imageUrl = item.imageUrl.trim();
                    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                        imageUrl = new URL(imageUrl, window.location.origin).href;
                    }

                    // Görseli indir ve base64'e çevir
                    const response = await fetch(imageUrl, { mode: 'cors' });
                    if (response.ok) {
                        const blob = await response.blob();
                        const arrayBuffer = await blob.arrayBuffer();
                        
                        // Görsel tipini belirle
                        let extension = 'png';
                        if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) extension = 'jpeg';
                        else if (imageUrl.includes('.png')) extension = 'png';
                        else if (imageUrl.includes('.gif')) extension = 'gif';

                        // Görseli workbook'a ekle
                        const imageId = workbook.addImage({
                            buffer: arrayBuffer,
                            extension: extension
                        });

                        // Görseli hücreye ekle (0-based index: row=1 (başlık), col=0 (ilk sütun))
                        worksheet.addImage(imageId, {
                            tl: { col: imageColumnIndex, row: i + 1 }, // +1 çünkü başlık satırı var
                            ext: { width: 50, height: 50 } // Görsel boyutu
                        });
                    }
                } catch (error) {
                    console.warn('Görsel eklenemedi:', item.imageUrl, error);
                }
            }
        }

        // Filtre ekle
        worksheet.autoFilter = {
            from: 'A1',
            to: { row: data.length + 1, column: headers.length }
        };

        btn.textContent = `Excel dosyası oluşturuluyor...`;

        // Excel dosyasını oluştur ve indir
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Mevcut_Stok_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        btn.textContent = 'Excel\'e Aktar ✓';
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<span role="img" aria-label="export" class="anticon"><svg viewBox="64 64 896 896" focusable="false" data-icon="download" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M505.7 661a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"></path></svg></span> Excel\'e Aktar';
        }, 2000);
    }

    // Sayfa yüklendiğinde çalıştır
    function waitForPage() {
        if (document.body) {
            // Hem XLSX hem ExcelJS kütüphaneleri yüklendikten sonra çalıştır
            const checkLibs = setInterval(() => {
                if (typeof XLSX !== 'undefined' && typeof ExcelJS !== 'undefined') {
                    clearInterval(checkLibs);
                    initExcelExport();
                }
            }, 500);

            // 15 saniye sonra durdur
            setTimeout(() => clearInterval(checkLibs), 15000);
        } else {
            setTimeout(waitForPage, 100);
        }
    }

    // MutationObserver ile sayfa değişikliklerini izle
    const observer = new MutationObserver(function(mutations) {
        // LIMIT_SELECT var ama buton yoksa tekrar dene
        const limitSelect = document.getElementById('LIMIT_SELECT');
        const exportButton = document.getElementById('EXCEL_EXPORT_BUTTON');
        const tableBody = document.querySelector('.ant-table-tbody');
        
        if ((limitSelect || tableBody) && !exportButton) {
            // Kütüphaneler yüklüyse direkt init et
            if (typeof XLSX !== 'undefined' && typeof ExcelJS !== 'undefined') {
                initExcelExport();
            } else {
                waitForPage();
            }
        }
    });

    // Periyodik kontrol ekle (her 3 saniyede bir)
    const periodicCheck = setInterval(() => {
        const limitSelect = document.getElementById('LIMIT_SELECT');
        const exportButton = document.getElementById('EXCEL_EXPORT_BUTTON');
        const tableBody = document.querySelector('.ant-table-tbody');
        
        // Sayfa yüklü ve buton yoksa tekrar dene
        if ((limitSelect || tableBody) && !exportButton) {
            if (typeof XLSX !== 'undefined' && typeof ExcelJS !== 'undefined') {
                initExcelExport();
            }
        }
    }, 3000);

    if (document.body) {
        waitForPage();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        setTimeout(() => {
            waitForPage();
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        }, 100);
    }

})();

