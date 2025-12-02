#!/usr/bin/env node

/**
 * products.json dosyasından temp_products.js dosyasını oluşturur
 * Kullanım: node update_temp_products.js
 */

const fs = require('fs');
const path = require('path');

const productsJsonPath = path.join(__dirname, 'products.json');
const tempProductsJsPath = path.join(__dirname, 'pages', 'temp_products.js');

try {
    console.log('📖 products.json dosyası okunuyor...');
    const productsData = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));
    
    if (!productsData.products || !Array.isArray(productsData.products)) {
        throw new Error('products.json geçersiz format!');
    }
    
    console.log(`✅ ${productsData.products.length} ürün bulundu`);
    
    // temp_products.js içeriğini oluştur
    const jsContent = `const PRODUCTS_DATA = ${JSON.stringify(productsData, null, 2)};`;
    
    // Dosyayı yaz
    fs.writeFileSync(tempProductsJsPath, jsContent, 'utf8');
    
    console.log(`✅ temp_products.js dosyası güncellendi!`);
    console.log(`📁 Dosya yolu: ${tempProductsJsPath}`);
    console.log(`📊 Toplam ürün sayısı: ${productsData.products.length}`);
    
} catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
}

