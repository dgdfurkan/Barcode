// Test script for Counting Data Supabase Integration
// Bu script'i browser console'da çalıştırarak Supabase entegrasyonunu test edebilirsiniz

async function testCountingDataDb() {
    console.log('🧪 Counting Data Supabase Test Başlatılıyor...\n');
    
    const results = {
        dbConnection: false,
        userAuthenticated: false,
        countingDataColumnExists: false,
        canReadCountingData: false,
        canWriteCountingData: false,
        countingDataStructure: null,
        errors: []
    };

    try {
        // 1. Supabase bağlantısını kontrol et
        console.log('1️⃣ Supabase bağlantısı kontrol ediliyor...');
        if (typeof window.jbDb === 'undefined' || !window.jbDb) {
            results.errors.push('Supabase client bulunamadı');
            console.error('❌ Supabase client bulunamadı');
            return results;
        }
        results.dbConnection = true;
        console.log('✅ Supabase client mevcut');

        // 2. Kullanıcı authentication kontrolü
        console.log('\n2️⃣ Kullanıcı authentication kontrol ediliyor...');
        if (!window.authUtils || !window.authUtils.checkAuth) {
            results.errors.push('Auth utils bulunamadı');
            console.error('❌ Auth utils bulunamadı');
            return results;
        }

        const session = window.authUtils.checkAuth();
        if (!session || !session.username) {
            results.errors.push('Kullanıcı giriş yapmamış');
            console.error('❌ Kullanıcı giriş yapmamış');
            return results;
        }
        results.userAuthenticated = true;
        console.log('✅ Kullanıcı giriş yapmış:', session.username);

        // 3. counting_data kolonunun varlığını kontrol et (users tablosunda)
        console.log('\n3️⃣ counting_data kolonu kontrol ediliyor (users tablosunda)...');
        try {
            const { data, error } = await window.jbDb
                .from('users')
                .select('counting_data')
                .eq('username', session.username)
                .maybeSingle();

            if (error) {
                if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
                    results.errors.push('counting_data kolonu bulunamadı - Migration gerekli');
                    console.error('❌ counting_data kolonu bulunamadı');
                    console.log('💡 Çözüm: sql_files/counting_data_migration.sql dosyasındaki migration\'ı çalıştırın');
                    return results;
                } else {
                    results.errors.push('Veri okuma hatası: ' + error.message);
                    console.error('❌ Veri okuma hatası:', error);
                    return results;
                }
            }

            results.countingDataColumnExists = true;
            results.canReadCountingData = true;
            console.log('✅ counting_data kolonu mevcut');
            console.log('📦 Mevcut counting_data:', data.counting_data);

            // 4. counting_data yapısını kontrol et
            console.log('\n4️⃣ counting_data yapısı kontrol ediliyor...');
            if (data && data.counting_data && typeof data.counting_data === 'object') {
                results.countingDataStructure = {
                    exists: true,
                    type: typeof data.counting_data,
                    isObject: typeof data.counting_data === 'object',
                    productCount: data.counting_data ? Object.keys(data.counting_data).length : 0
                };
                console.log('✅ counting_data mevcut');
                console.log('📊 Ürün sayısı:', results.countingDataStructure.productCount);
            } else {
                results.countingDataStructure = {
                    exists: false,
                    message: 'counting_data henüz oluşturulmamış'
                };
                console.log('ℹ️ counting_data henüz oluşturulmamış (normal)');
            }

            // 5. Yazma testi
            console.log('\n5️⃣ Yazma testi yapılıyor...');
            const testCountingData = {
                ...(data.counting_data || {}),
                test_product_123: {
                    warehouseStock: 10,
                    systemStock: 8,
                    lastUpdated: new Date().toISOString(),
                    history: []
                }
            };

            // Test verisi yaz (users tablosuna)
            const { error: writeError } = await window.jbDb
                .from('users')
                .update({ counting_data: testCountingData })
                .eq('username', session.username);

            if (writeError) {
                results.errors.push('Yazma hatası: ' + writeError.message);
                console.error('❌ Yazma hatası:', writeError);
            } else {
                results.canWriteCountingData = true;
                console.log('✅ Yazma testi başarılı');

                // Test verisini temizle
                console.log('\n6️⃣ Test verisi temizleniyor...');
                const cleanedCountingData = data.counting_data || {};
                // Test ürününü sil
                if (cleanedCountingData.test_product_123) {
                    delete cleanedCountingData.test_product_123;
                }

                await window.jbDb
                    .from('users')
                    .update({ counting_data: cleanedCountingData })
                    .eq('username', session.username);

                console.log('✅ Test verisi temizlendi');
            }

        } catch (error) {
            results.errors.push('Test sırasında hata: ' + error.message);
            console.error('❌ Test sırasında hata:', error);
        }

    } catch (error) {
        results.errors.push('Genel hata: ' + error.message);
        console.error('❌ Genel hata:', error);
    }

    // Sonuçları göster
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SONUÇLARI');
    console.log('='.repeat(50));
    console.log('Veritabanı bağlantısı:', results.dbConnection ? '✅' : '❌');
    console.log('Kullanıcı Girişi:', results.userAuthenticated ? '✅' : '❌');
    console.log('counting_data Kolonu:', results.countingDataColumnExists ? '✅' : '❌');
    console.log('Okuma Yetkisi:', results.canReadCountingData ? '✅' : '❌');
    console.log('Yazma Yetkisi:', results.canWriteCountingData ? '✅' : '❌');
    
    if (results.countingDataStructure) {
        console.log('counting_data Durumu:', results.countingDataStructure.exists ? '✅ Mevcut' : 'ℹ️ Henüz oluşturulmamış');
        if (results.countingDataStructure.productCount !== undefined) {
            console.log('Ürün Sayısı:', results.countingDataStructure.productCount);
        }
    }

    if (results.errors.length > 0) {
        console.log('\n⚠️ HATALAR:');
        results.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }

    console.log('\n' + '='.repeat(50));

    // Final durum
    const allTestsPassed = 
        results.dbConnection &&
        results.userAuthenticated &&
        results.countingDataColumnExists &&
        results.canReadCountingData &&
        results.canWriteCountingData;

    if (allTestsPassed) {
        console.log('🎉 TÜM TESTLER BAŞARILI! Counting data Supabase\'e yazılabilir.');
        console.log('✅ counting.html sayfasını kullanabilirsiniz.');
    } else {
        console.log('⚠️ BAZI TESTLER BAŞARISIZ!');
        if (!results.countingDataColumnExists) {
            console.log('💡 Çözüm: sql_files/counting_data_migration.sql dosyasındaki migration\'ı çalıştırın');
        }
    }

    return results;
}

// Otomatik çalıştır (eğer counting.html sayfasındaysak)
if (window.location.pathname.includes('counting.html')) {
    console.log('🔍 Counting sayfası tespit edildi, test otomatik çalıştırılıyor...');
    testCountingDataDb().then(results => {
        window.testCountingResults = results;
        console.log('\n💡 Sonuçlar window.testCountingResults değişkeninde saklandı');
    });
}

// Global olarak erişilebilir yap
window.testCountingDataDb = testCountingDataDb;

console.log('✅ Test fonksiyonu yüklendi. Kullanım: testCountingDataDb()');

