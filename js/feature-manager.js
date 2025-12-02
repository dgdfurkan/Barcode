// Feature Manager - Sistem özelliklerini yöneten ve kontrol eden sistem
// Özellikleri Supabase'den yükler, günceller ve geçmişi tutar

(function() {
    'use strict';

    class FeatureManager {
        constructor() {
            this.featuresCache = null;
            this.cacheTimestamp = null;
            this.CACHE_DURATION = 5 * 60 * 1000; // 5 dakika
            this.realtimeSubscription = null;
            this.onFeatureChangeCallbacks = []; // Feature değişikliği callback'leri
        }

        // Özellik değerini getir (cache'den veya Supabase'den)
        async getFeatureValue(featureKey) {
            try {
                // Cache kontrolü
                const now = Date.now();
                if (this.featuresCache && this.cacheTimestamp && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
                    const feature = this.featuresCache[featureKey];
                    if (feature) {
                        return feature.current_value;
                    }
                }

                // Supabase'den yükle
                if (!window.supabase) {
                    console.warn('Supabase not available, using default value');
                    return this.getDefaultValue(featureKey);
                }

                const { data, error } = await window.supabase
                    .from('system_features')
                    .select('current_value')
                    .eq('feature_key', featureKey)
                    .eq('is_active', true)
                    .single();

                if (error || !data) {
                    console.warn(`Feature ${featureKey} not found, using default value`);
                    return this.getDefaultValue(featureKey);
                }

                return data.current_value;
            } catch (error) {
                console.error(`Error getting feature value for ${featureKey}:`, error);
                return this.getDefaultValue(featureKey);
            }
        }

        // Varsayılan değeri getir
        getDefaultValue(featureKey) {
            const definition = window.getFeatureDefinition?.(featureKey);
            if (definition) {
                return definition.defaultValue;
            }
            return null;
        }

        // Tüm özellikleri yükle ve cache'le
        async loadAllFeatures() {
            try {
                if (!window.supabase) {
                    console.warn('Supabase not available');
                    return {};
                }

                const { data, error } = await window.supabase
                    .from('system_features')
                    .select('*')
                    .eq('is_active', true);

                if (error) throw error;

                const features = {};
                if (data) {
                    data.forEach(feature => {
                        features[feature.feature_key] = feature;
                    });
                }

                // Cache'le
                this.featuresCache = features;
                this.cacheTimestamp = Date.now();

                return features;
            } catch (error) {
                console.error('Error loading all features:', error);
                return {};
            }
        }

        // Özellik değerini ayarla
        async setFeatureValue(featureKey, newValue, updateNumber = null, changedBy = null) {
            try {
                if (!window.supabase) {
                    throw new Error('Supabase not available');
                }

                // Mevcut değeri al
                const { data: currentFeature } = await window.supabase
                    .from('system_features')
                    .select('current_value')
                    .eq('feature_key', featureKey)
                    .single();

                const oldValue = currentFeature?.current_value ?? null;

                // Değer değişmemişse history'ye yazma ve işlemi sonlandır
                if (this.valuesEqual(oldValue, newValue)) {
                    console.log(`ℹ️ Feature ${featureKey} value unchanged (${JSON.stringify(newValue)}), skipping history write`);
                    return false; // Değişiklik yok
                }

                // Özellik tanımını kontrol et
                const definition = window.getFeatureDefinition?.(featureKey);
                if (!definition) {
                    throw new Error(`Feature definition not found for ${featureKey}`);
                }

                // Değer validasyonu
                if (!window.validateFeatureValue?.(newValue, definition.valueType)) {
                    throw new Error(`Invalid value type for ${featureKey}. Expected ${definition.valueType}, got ${typeof newValue}`);
                }

                // system_features tablosunu güncelle veya oluştur
                const featureData = {
                    feature_key: featureKey,
                    feature_name: definition.name,
                    current_value: newValue,
                    default_value: definition.defaultValue,
                    value_type: definition.valueType,
                    description: definition.description,
                    is_active: true
                };

                const { error: upsertError } = await window.supabase
                    .from('system_features')
                    .upsert(featureData, {
                        onConflict: 'feature_key'
                    });

                if (upsertError) throw upsertError;

                // Sadece değer gerçekten değiştiyse geçmişe kaydet
                await this.saveFeatureHistory(featureKey, oldValue, newValue, updateNumber, changedBy);

                // Cache'i temizle
                this.featuresCache = null;

                console.log(`✅ Feature ${featureKey} updated:`, { oldValue, newValue, updateNumber });
                return true;
            } catch (error) {
                console.error(`Error setting feature value for ${featureKey}:`, error);
                throw error;
            }
        }

        // İki değerin eşit olup olmadığını kontrol et (deep comparison)
        valuesEqual(oldValue, newValue) {
            // Null/undefined kontrolü
            if (oldValue === null || oldValue === undefined) {
                return newValue === null || newValue === undefined;
            }
            if (newValue === null || newValue === undefined) {
                return false;
            }

            // Primitive değerler için direkt karşılaştırma
            if (typeof oldValue !== 'object' || typeof newValue !== 'object') {
                return oldValue === newValue;
            }

            // Object/Array için JSON karşılaştırması
            try {
                return JSON.stringify(oldValue) === JSON.stringify(newValue);
            } catch (e) {
                // JSON.stringify başarısız olursa (circular reference vs), false dön
                return false;
            }
        }

        // Özellik geçmişine kaydet
        // ÖNEMLİ: Eğer aynı feature_key + aynı update_number varsa, sadece tarihi güncelle (yeni kayıt ekleme)
        async saveFeatureHistory(featureKey, oldValue, newValue, updateNumber, changedBy) {
            try {
                if (!window.supabase) return;

                // Önce aynı feature_key + aynı update_number'a sahip kaydı kontrol et
                const { data: existingHistory } = await window.supabase
                    .from('feature_history')
                    .select('id, new_value, update_number')
                    .eq('feature_key', featureKey)
                    .eq('update_number', updateNumber) // Aynı versiyon numarası kontrolü
                    .order('changed_at', { ascending: false })
                    .limit(1)
                    .single();

                // Eğer aynı feature_key + aynı update_number varsa, sadece tarihi güncelle
                if (existingHistory) {
                    console.log(`🔄 Feature ${featureKey} history: Same feature_key + update_number (${updateNumber}) exists, updating timestamp only`);
                    await window.supabase
                        .from('feature_history')
                        .update({
                            old_value: oldValue,
                            new_value: newValue,
                            changed_by: changedBy,
                            changed_at: new Date().toISOString() // Sadece tarih güncellenir
                        })
                        .eq('id', existingHistory.id);
                    return; // Yeni kayıt ekleme, sadece tarihi güncelle
                }

                // Aynı feature_key + update_number yoksa, yeni kayıt ekle
                await window.supabase
                    .from('feature_history')
                    .insert({
                        feature_key: featureKey,
                        old_value: oldValue,
                        new_value: newValue,
                        update_number: updateNumber,
                        changed_by: changedBy
                    });
            } catch (error) {
                // Eğer kayıt bulunamadıysa (single() hatası), yeni kayıt ekle
                if (error.code === 'PGRST116') {
                    // Kayıt bulunamadı, yeni kayıt ekle
                    try {
                        await window.supabase
                            .from('feature_history')
                            .insert({
                                feature_key: featureKey,
                                old_value: oldValue,
                                new_value: newValue,
                                update_number: updateNumber,
                                changed_by: changedBy
                            });
                    } catch (insertError) {
                        console.error('Error inserting feature history:', insertError);
                    }
                } else {
                    console.error('Error saving feature history:', error);
                }
                // Geçmiş kaydı hatası kritik değil, devam et
            }
        }

        // Zamanlanmış güncellemeleri kontrol et ve özellik değişikliklerini uygula
        // Versiyon numarasını parse et (v 1.0.2 -> [1, 0, 2])
        parseVersionNumber(versionString) {
            if (!versionString) return [0, 0, 0];
            const match = versionString.match(/v\s*(\d+)\.(\d+)\.(\d+)/i);
            if (match) {
                return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
            }
            return [0, 0, 0];
        }

        // İki versiyon numarasını karşılaştır (a > b ise 1, a < b ise -1, a == b ise 0)
        compareVersions(versionA, versionB) {
            const vA = this.parseVersionNumber(versionA);
            const vB = this.parseVersionNumber(versionB);
            
            for (let i = 0; i < 3; i++) {
                if (vA[i] > vB[i]) return 1;
                if (vA[i] < vB[i]) return -1;
            }
            return 0;
        }

        async checkAndApplyFeatureChanges() {
            try {
                if (!window.supabase) {
                    console.warn('Supabase not available for feature changes');
                    return;
                }

                const nowUTC = new Date().toISOString();

                // Zamanlanmış ve aktif güncellemeleri getir
                const { data: updates, error } = await window.supabase
                    .from('updates')
                    .select('id, update_number, feature_changes, scheduled_at, is_active')
                    .eq('is_active', true)
                    .not('feature_changes', 'is', null);

                if (error) throw error;

                if (!updates || updates.length === 0) {
                    return; // Özellik değişikliği olan güncelleme yok
                }

                // Zamanlanmış tarihi geçen veya zamanlanmamış aktif güncellemeleri filtrele
                const applicableUpdates = updates.filter(update => {
                    // Eğer scheduled_at yoksa, güncelleme aktifse uygula
                    if (!update.scheduled_at) {
                        console.log(`✅ Update ${update.update_number} has no schedule, considering applicable`);
                        return true;
                    }
                    // Eğer scheduled_at varsa, zamanı geçmişse uygula
                    const isTimePassed = update.scheduled_at <= nowUTC;
                    console.log(`⏰ Update ${update.update_number}: scheduled_at=${update.scheduled_at}, nowUTC=${nowUTC}, isTimePassed=${isTimePassed}`);
                    return isTimePassed;
                });

                if (applicableUpdates.length === 0) {
                    console.log('📭 No applicable updates for feature changes');
                    return; // Henüz zamanı gelmemiş veya uygulanacak güncelleme yok
                }

                // Versiyon numarasına göre sırala (en yüksek versiyon önce)
                applicableUpdates.sort((a, b) => {
                    return this.compareVersions(b.update_number, a.update_number); // Descending order
                });

                console.log(`🔧 Checking feature changes for ${applicableUpdates.length} update(s) (sorted by version)`);
                console.log(`📋 Update order:`, applicableUpdates.map(u => u.update_number));

                // Her özellik için en yüksek versiyon numarasına sahip güncellemenin değerini kullan
                // Bu sayede aç-kapa-aç-kapa sorunu olmaz
                const featureChangesMap = new Map(); // feature_key -> { value, update_number, update }
                
                for (const update of applicableUpdates) {
                    if (!update.feature_changes || !Array.isArray(update.feature_changes)) {
                        continue;
                    }

                    for (const change of update.feature_changes) {
                        if (!change.feature_key || change.new_value === undefined) {
                            console.warn('Invalid feature change:', change);
                            continue;
                        }

                        // Eğer bu özellik için daha yüksek versiyonlu bir güncelleme yoksa veya
                        // Bu güncelleme daha yüksek versiyonlu ise, bu değeri kullan
                        if (!featureChangesMap.has(change.feature_key)) {
                            featureChangesMap.set(change.feature_key, {
                                value: change.new_value,
                                update_number: update.update_number,
                                update: update
                            });
                            console.log(`✅ Feature ${change.feature_key} = ${JSON.stringify(change.new_value)} from update ${update.update_number}`);
                        } else {
                            const existing = featureChangesMap.get(change.feature_key);
                            // Bu güncelleme daha yüksek versiyonlu mu?
                            if (this.compareVersions(update.update_number, existing.update_number) > 0) {
                                featureChangesMap.set(change.feature_key, {
                                    value: change.new_value,
                                    update_number: update.update_number,
                                    update: update
                                });
                                console.log(`🔄 Feature ${change.feature_key} updated to ${JSON.stringify(change.new_value)} from newer update ${update.update_number} (was ${JSON.stringify(existing.value)} from ${existing.update_number})`);
                            } else {
                                console.log(`⏭️ Feature ${change.feature_key} skipped (${update.update_number} is older than ${existing.update_number})`);
                            }
                        }
                    }
                }

                // Toplu olarak özellik değişikliklerini uygula (aç-kapa-aç-kapa yapmadan)
                // ÖNEMLİ: Eğer değer zaten doğruysa, setFeatureValue çağrılmasın (history'ye yazılmasın)
                const processedFeatures = new Set();
                const changedBy = 'system';

                console.log(`🎯 Applying ${featureChangesMap.size} feature change(s) from latest updates:`);
                for (const [featureKey, changeData] of featureChangesMap.entries()) {
                    console.log(`  - ${featureKey} = ${JSON.stringify(changeData.value)} (from ${changeData.update_number})`);
                    
                    try {
                        // Önce mevcut değeri kontrol et (cache'den veya Supabase'den)
                        const currentValue = await this.getFeatureValue(featureKey);
                        
                        // Eğer değer zaten aynıysa, setFeatureValue çağırma (history'ye yazma)
                        if (this.valuesEqual(currentValue, changeData.value)) {
                            console.log(`⏭️ Feature ${featureKey} already has value ${JSON.stringify(changeData.value)}, skipping update (no history write)`);
                            processedFeatures.add(featureKey); // UI güncellemesi için track et
                            continue; // Bir sonraki özelliğe geç
                        }
                        
                        // Değer farklıysa, güncelle
                        const wasChanged = await this.setFeatureValue(
                            featureKey,
                            changeData.value,
                            changeData.update_number,
                            changedBy
                        );
                        
                        if (!wasChanged) {
                            console.log(`ℹ️ Feature ${featureKey} update returned false (value unchanged)`);
                        }
                        
                        processedFeatures.add(featureKey);
                    } catch (error) {
                        console.error(`Error applying feature change for ${featureKey}:`, error);
                        // Bir özellik hatası diğerlerini engellemez
                    }
                }
                
                // If any features were processed, update UI immediately (even if value didn't change)
                // This ensures UI reflects the current state from database
                if (processedFeatures.size > 0) {
                    console.log('🔄 Features processed, updating UI:', Array.from(processedFeatures));
                    // Clear cache to ensure fresh data
                    this.featuresCache = null;
                    await this.loadAllFeatures();
                    
                    // Wait a bit for DOM to be ready, then update UI
                    setTimeout(async () => {
                        // Trigger UI update for anti-glare mode if it was processed
                        if (processedFeatures.has('anti_glare_mode')) {
                            console.log('🔄 Anti-glare mode processed, updating UI immediately...');
                            if (typeof window.updateAntiGlareSettingsUI === 'function') {
                                await window.updateAntiGlareSettingsUI();
                            }
                            if (typeof window.loadAntiGlareSetting === 'function') {
                                await window.loadAntiGlareSetting();
                            }
                        }
                        
                        // Trigger UI update for scan effect visibility if it was processed
                        if (processedFeatures.has('scan_effect_visible')) {
                            console.log('🔄 Scan effect visibility processed, updating UI immediately...');
                            console.log('🔍 [FEATURE-MANAGER] window.loadScanEffectVisibility type:', typeof window.loadScanEffectVisibility);
                            if (typeof window.loadScanEffectVisibility === 'function') {
                                console.log('✅ [FEATURE-MANAGER] Calling loadScanEffectVisibility...');
                                try {
                                    await window.loadScanEffectVisibility();
                                    console.log('✅ [FEATURE-MANAGER] loadScanEffectVisibility completed');
                                } catch (error) {
                                    console.error('❌ [FEATURE-MANAGER] Error calling loadScanEffectVisibility:', error);
                                }
                            } else {
                                console.warn('⚠️ [FEATURE-MANAGER] loadScanEffectVisibility is not a function!', typeof window.loadScanEffectVisibility);
                            }
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('Error checking and applying feature changes:', error);
            }
        }

        // Özellik geçmişini getir
        async getFeatureHistory(featureKey, limit = 50) {
            try {
                if (!window.supabase) return [];

                const { data, error } = await window.supabase
                    .from('feature_history')
                    .select('*')
                    .eq('feature_key', featureKey)
                    .order('changed_at', { ascending: false })
                    .limit(limit);

                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error(`Error getting feature history for ${featureKey}:`, error);
                return [];
            }
        }

        // Feature değişikliği callback'i kaydet
        onFeatureChange(callback) {
            if (typeof callback === 'function') {
                this.onFeatureChangeCallbacks.push(callback);
            }
        }

        // Feature değişikliği callback'lerini çağır
        async triggerFeatureChangeCallbacks(featureKey, oldValue, newValue) {
            console.log(`🔄 Feature changed: ${featureKey}`, { oldValue, newValue });
            
            // Cache'i temizle
            this.featuresCache = null;
            
            // Tüm özellikleri yeniden yükle
            await this.loadAllFeatures();
            
            // Callback'leri çağır
            for (const callback of this.onFeatureChangeCallbacks) {
                try {
                    await callback(featureKey, oldValue, newValue);
                } catch (error) {
                    console.error('Error in feature change callback:', error);
                }
            }
        }

        // Supabase realtime subscription başlat
        async setupRealtimeSubscription() {
            try {
                if (!window.supabase) {
                    console.warn('Supabase not available for realtime subscription');
                    return;
                }

                // Önceki subscription'ı kapat
                if (this.realtimeSubscription) {
                    await window.supabase.removeChannel(this.realtimeSubscription);
                }

                // Yeni subscription oluştur
                this.realtimeSubscription = window.supabase
                    .channel('system_features_changes')
                    .on('postgres_changes', {
                        event: '*', // INSERT, UPDATE, DELETE
                        schema: 'public',
                        table: 'system_features'
                    }, async (payload) => {
                        console.log('📡 System feature changed via realtime:', payload);
                        
                        const featureKey = payload.new?.feature_key || payload.old?.feature_key;
                        const oldValue = payload.old?.current_value ?? null;
                        const newValue = payload.new?.current_value ?? null;

                        if (featureKey) {
                            await this.triggerFeatureChangeCallbacks(featureKey, oldValue, newValue);
                        }
                    })
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            console.log('✅ Realtime subscription active for system_features');
                        } else if (status === 'CHANNEL_ERROR') {
                            // Sadece kritik hataları logla (bağlantı kapanması normal olabilir)
                            // console.error('❌ Realtime subscription error');
                        }
                    })
                    .on('error', (error) => {
                        // Sadece kritik hataları logla
                        if (error && error.message && !error.message.includes('close') && !error.message.includes('disconnect')) {
                            console.error('❌ Realtime subscription error', error);
                        }
                    });

            } catch (error) {
                console.error('Error setting up realtime subscription:', error);
            }
        }

        // Realtime subscription'ı kapat
        async cleanupRealtimeSubscription() {
            if (this.realtimeSubscription && window.supabase) {
                await window.supabase.removeChannel(this.realtimeSubscription);
                this.realtimeSubscription = null;
            }
        }
    }

    // Initialize FeatureManager
    if (typeof window !== 'undefined') {
        window.featureManager = new FeatureManager();
        
        // Sayfa yüklendiğinde özellikleri yükle ve realtime subscription başlat
        async function initializeFeatureManager() {
            await window.featureManager.loadAllFeatures();
            
            // Realtime subscription başlat (Supabase hazır olduğunda)
            if (window.supabase) {
                await window.featureManager.setupRealtimeSubscription();
            } else {
                // Supabase henüz hazır değilse bekle
                const checkSupabase = setInterval(() => {
                    if (window.supabase) {
                        clearInterval(checkSupabase);
                        window.featureManager.setupRealtimeSubscription();
                    }
                }, 500);
                
                // 10 saniye sonra timeout
                setTimeout(() => {
                    clearInterval(checkSupabase);
                }, 10000);
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeFeatureManager);
        } else {
            // DOM zaten yüklenmişse hemen başlat
            initializeFeatureManager();
        }
        
        console.log('✅ FeatureManager initialized');
    }
})();

