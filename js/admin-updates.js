// Updates Management Functions for Admin Panel
// This file contains all update management functionality

// Ensure AdminPanel is defined
if (typeof AdminPanel === 'undefined') {
    console.error('AdminPanel is not defined. Make sure admin.js is loaded before admin-updates.js');
}

// Available icons for steps
const AVAILABLE_ICONS = [
    { name: 'Roket', value: '🚀' },
    { name: 'Yıldız', value: '⭐' },
    { name: 'Mega', value: '📢' },
    { name: 'Kilit', value: '🔒' },
    { name: 'Kilit Açık', value: '🔓' },
    { name: 'Kalp', value: '❤️' },
    { name: 'Zap', value: '⚡' },
    { name: 'Güneş', value: '☀️' },
    { name: 'Ay', value: '🌙' },
    { name: 'Ateş', value: '🔥' },
    { name: 'Trophy', value: '🏆' },
    { name: 'Check', value: '✅' },
    { name: 'Gift', value: '🎁' },
    { name: 'Sparkles', value: '✨' },
    { name: 'Bell', value: '🔔' }
];

// Available colors for steps
const AVAILABLE_COLORS = [
    { name: 'Mor', value: 'purple', class: 'from-purple-500 to-purple-600' },
    { name: 'Pembe', value: 'pink', class: 'from-pink-500 to-pink-600' },
    { name: 'Mavi', value: 'blue', class: 'from-blue-500 to-blue-600' },
    { name: 'Yeşil', value: 'green', class: 'from-green-500 to-green-600' },
    { name: 'Turuncu', value: 'orange', class: 'from-orange-500 to-orange-600' },
    { name: 'Kırmızı', value: 'red', class: 'from-red-500 to-red-600' },
    { name: 'İndigo', value: 'indigo', class: 'from-indigo-500 to-indigo-600' },
    { name: 'Teal', value: 'teal', class: 'from-teal-500 to-teal-600' }
];

AdminPanel.prototype.loadUpdates = async function() {
    try {
        if (!window.supabase) {
            console.warn('Supabase not available');
            document.getElementById('updatesTable').innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Supabase bağlantısı yok</td></tr>';
            return;
        }

        const { data, error } = await window.supabase
            .from('updates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        this.updates = data || [];
        this.renderUpdates();
    } catch (error) {
        console.error('Error loading updates:', error);
        document.getElementById('updatesTable').innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Hata: ${error.message}</td></tr>`;
    }
};

AdminPanel.prototype.renderUpdates = async function() {
    const tbody = document.getElementById('updatesTable');
    if (!tbody) return;

    if (this.updates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Henüz güncelleme yok</td></tr>';
        return;
    }

    // Get statistics for all updates
    const updateStats = {};
    try {
        if (window.supabase) {
            const { data: statuses } = await window.supabase
                .from('user_update_status')
                .select('*');
            
            if (statuses) {
                statuses.forEach(status => {
                    if (!updateStats[status.update_number]) {
                        updateStats[status.update_number] = {
                            seen: [],
                            completed: []
                        };
                    }
                    if (status.is_seen) {
                        updateStats[status.update_number].seen.push({
                            username: status.username,
                            seen_at: status.seen_at
                        });
                    }
                    if (status.is_completed) {
                        updateStats[status.update_number].completed.push({
                            username: status.username,
                            completed_at: status.completed_at
                        });
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading update statistics:', error);
    }

    tbody.innerHTML = this.updates.map(update => {
        // Convert UTC to Istanbul time for display
        let scheduledDate = 'Hemen';
        if (update.scheduled_at) {
            const utcDate = new Date(update.scheduled_at);
            scheduledDate = utcDate.toLocaleString('tr-TR', { 
                timeZone: 'Europe/Istanbul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        const statusBadge = update.is_active 
            ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Aktif</span>'
            : '<span class="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">Pasif</span>';
        
        const stats = updateStats[update.update_number] || { seen: [], completed: [] };
        const seenCount = stats.seen.length;
        const completedCount = stats.completed.length;

        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${update.update_number}</td>
                <td class="px-6 py-4 text-sm text-gray-900">${update.title}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${scheduledDate}</td>
                <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button onclick="adminPanel.showUpdateStats('${update.id}', '${update.update_number}')" 
                            class="text-blue-600 hover:text-blue-900 underline">
                        👁️ ${seenCount} / ✅ ${completedCount}
                    </button>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="adminPanel.editUpdate('${update.id}')" class="text-blue-600 hover:text-blue-900 mr-3">Düzenle</button>
                    <button onclick="adminPanel.toggleUpdateStatus('${update.id}', ${!update.is_active})" class="text-green-600 hover:text-green-900 mr-3">
                        ${update.is_active ? 'Pasif Et' : 'Aktif Et'}
                    </button>
                    <button onclick="adminPanel.deleteUpdate('${update.id}')" class="text-red-600 hover:text-red-900">Sil</button>
                </td>
            </tr>
        `;
    }).join('');
};

AdminPanel.prototype.getLatestVersion = function() {
    // Get latest version from updates (format: "v x.y.z")
    if (!this.updates || this.updates.length === 0) {
        return { major: 1, minor: 0, patch: 0 };
    }
    
    // Extract version numbers from update_number field
    const versions = this.updates
        .map(u => {
            const match = u.update_number?.match(/^v\s*(\d+)\.(\d+)\.(\d+)$/i);
            if (match) {
                return {
                    major: parseInt(match[1]),
                    minor: parseInt(match[2]),
                    patch: parseInt(match[3])
                };
            }
            return null;
        })
        .filter(v => v !== null);
    
    if (versions.length === 0) {
        return { major: 1, minor: 0, patch: 0 };
    }
    
    // Find latest version
    const latest = versions.reduce((latest, current) => {
        if (current.major > latest.major) return current;
        if (current.major === latest.major && current.minor > latest.minor) return current;
        if (current.major === latest.major && current.minor === latest.minor && current.patch > latest.patch) return current;
        return latest;
    }, versions[0]);
    
    return latest;
};

AdminPanel.prototype.getNextVersion = function() {
    const latest = this.getLatestVersion();
    // Increment patch version by default
    return {
        major: latest.major,
        minor: latest.minor,
        patch: latest.patch + 1
    };
};

AdminPanel.prototype.formatVersion = function(version) {
    return `v ${version.major}.${version.minor}.${version.patch}`;
};

AdminPanel.prototype.openUpdateModal = function(updateId = null) {
    this.editingUpdateId = updateId;
    this.currentUpdateSteps = [];
    this.currentFeatureChanges = [];
    
    const modal = document.getElementById('updateModal');
    const title = document.getElementById('updateModalTitle');
    const form = document.getElementById('updateForm');
    const updateNumberMajorInput = document.getElementById('updateNumberMajor');
    const updateNumberMinorInput = document.getElementById('updateNumberMinor');
    const updateNumberPatchInput = document.getElementById('updateNumberPatch');
    
        if (updateId) {
            const update = this.updates.find(u => u.id === updateId);
            if (update) {
                title.textContent = 'Güncelleme Düzenle';
                // Parse version number from "v x.y.z" format
                const versionMatch = update.update_number?.match(/^v\s*(\d+)\.(\d+)\.(\d+)$/i);
                if (versionMatch) {
                    updateNumberMajorInput.value = versionMatch[1];
                    updateNumberMinorInput.value = versionMatch[2];
                    updateNumberPatchInput.value = versionMatch[3];
                }
                document.getElementById('updateTitle').value = update.title;
                document.getElementById('updateDescription').value = update.description || '';
                
                // Convert UTC to Istanbul time for datetime-local input
                if (update.scheduled_at) {
                    const utcDate = new Date(update.scheduled_at);
                    const istanbulDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
                    const localDate = new Date(istanbulDate.getTime() - istanbulDate.getTimezoneOffset() * 60000);
                    document.getElementById('updateScheduledAt').value = localDate.toISOString().slice(0, 16);
                } else {
                    document.getElementById('updateScheduledAt').value = '';
                }
                
                this.currentUpdateSteps = update.steps || [];
                this.currentFeatureChanges = update.feature_changes || [];
                this.renderSteps();
                this.renderFeatureChanges();
            }
        } else {
            // New update - suggest next version
            title.textContent = 'Yeni Güncelleme';
            form.reset();
            document.getElementById('updateScheduledAt').value = '';
            this.currentUpdateSteps = [];
            this.currentFeatureChanges = [];
            
            // Auto-fill next version number
            const nextVersion = this.getNextVersion();
            updateNumberMajorInput.value = nextVersion.major;
            updateNumberMinorInput.value = nextVersion.minor;
            updateNumberPatchInput.value = nextVersion.patch;
            
            this.renderSteps();
            this.renderFeatureChanges();
        }
    
    modal.classList.remove('hidden');
};

AdminPanel.prototype.addStep = function() {
    const stepIndex = this.currentUpdateSteps.length;
    this.currentUpdateSteps.push({
        title: '',
        description: '',
        image_url: '',
        icon: '🚀',
        color: 'purple',
        is_video: false
    });
    this.renderSteps();
};

AdminPanel.prototype.removeStep = function(index) {
    this.currentUpdateSteps.splice(index, 1);
    this.renderSteps();
};

AdminPanel.prototype.renderSteps = function() {
    const container = document.getElementById('stepsContainer');
    if (!container) return;

    if (this.currentUpdateSteps.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Henüz adım eklenmedi. "Adım Ekle" butonuna tıklayın.</p>';
        return;
    }

    container.innerHTML = this.currentUpdateSteps.map((step, index) => `
        <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-medium text-gray-700">Adım ${index + 1}</h4>
                <button type="button" onclick="adminPanel.removeStep(${index})" class="text-red-600 hover:text-red-800 text-sm">
                    ✕ Sil
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Başlık *</label>
                    <input type="text" class="step-title w-full border-gray-300 rounded-md shadow-sm text-sm" 
                           value="${step.title || ''}" 
                           onchange="adminPanel.currentUpdateSteps[${index}].title = this.value"
                           placeholder="Adım başlığı">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Emoji</label>
                    <input type="text" 
                           class="step-icon w-full border-gray-300 rounded-md shadow-sm text-sm" 
                           value="${step.icon || '🚀'}" 
                           maxlength="2"
                           placeholder="Emoji girin (örn: 🚀)"
                           onchange="adminPanel.currentUpdateSteps[${index}].icon = this.value"
                           oninput="adminPanel.currentUpdateSteps[${index}].icon = this.value">
                    <p class="text-xs text-gray-500 mt-1">Herhangi bir emoji girebilirsiniz</p>
                </div>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-medium text-gray-700 mb-1">Açıklama *</label>
                <textarea class="step-description w-full border-gray-300 rounded-md shadow-sm text-sm" 
                          rows="2"
                          onchange="adminPanel.currentUpdateSteps[${index}].description = this.value"
                          placeholder="Adım açıklaması">${step.description || ''}</textarea>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Renk</label>
                    <select class="step-color w-full border-gray-300 rounded-md shadow-sm text-sm" 
                            onchange="adminPanel.currentUpdateSteps[${index}].color = this.value">
                        ${AVAILABLE_COLORS.map(color => 
                            `<option value="${color.value}" ${step.color === color.value ? 'selected' : ''}>${color.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Görsel/Video</label>
                    <div class="flex space-x-2">
                        <input type="text" 
                               id="stepImageInput_${index}"
                               class="step-image flex-1 border-gray-300 rounded-md shadow-sm text-sm" 
                               value="${step.image_url || ''}" 
                               onchange="adminPanel.currentUpdateSteps[${index}].image_url = this.value"
                               oninput="adminPanel.handleImageUrlChange(${index}, this.value)"
                               placeholder="Cloudinary URL, Google Drive linki veya direkt URL">
                        <input type="file" 
                               id="stepImageFile_${index}"
                               class="hidden"
                               accept="image/*,video/*"
                               onchange="adminPanel.handleFileUpload(${index}, this.files[0])">
                        <button type="button"
                                onclick="document.getElementById('stepImageFile_${index}').click()"
                                class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm whitespace-nowrap">
                            📤 Yükle
                        </button>
                    </div>
                    <div id="mediaTypeIndicator_${index}" class="text-xs mt-1 hidden">
                        <span class="text-blue-600">🔍 Algılanıyor...</span>
                    </div>
                    <div id="uploadProgress_${index}" class="text-xs mt-1 hidden">
                        <span class="text-blue-600">⏳ Yükleniyor...</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">💡 Cloudinary'e yükle veya direkt URL kullan</p>
                </div>
            </div>
        </div>
    `).join('');
};

AdminPanel.prototype.uploadStepImage = async function(stepIndex) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (!window.supabase) {
                alert('Supabase bağlantısı yok!');
                return;
            }

            // Check if user is admin (client-side check)
            const session = window.authUtils?.checkAuth();
            if (!session || !session.isAdmin) {
                alert('Bu işlem için admin yetkisi gereklidir!');
                return;
            }

            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert('Dosya boyutu 10MB\'dan büyük olamaz!');
                return;
            }

            // Get version from separate inputs
            const major = parseInt(document.getElementById('updateNumberMajor').value) || 0;
            const minor = parseInt(document.getElementById('updateNumberMinor').value) || 0;
            const patch = parseInt(document.getElementById('updateNumberPatch').value) || 0;
            const updateNumber = `v ${major}.${minor}.${patch}`;
            // Sanitize update number for file path
            const sanitizedUpdateNumber = updateNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileExtension = file.name.split('.').pop();
            const fileName = `${sanitizedUpdateNumber}/step_${stepIndex}_${Date.now()}.${fileExtension}`;
            const filePath = `updates/${fileName}`;

            // Show loading state
            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg z-50 shadow-lg';
            loadingMsg.textContent = '📤 Görsel yükleniyor...';
            document.body.appendChild(loadingMsg);

            console.log('📤 Uploading file:', {
                bucket: 'update-images',
                path: filePath,
                size: file.size,
                type: file.type
            });

            // Try to upload
            // Note: Using anon key, so RLS must allow anonymous uploads
            console.log('🔍 Upload attempt:', {
                bucket: 'update-images',
                path: filePath,
                fileSize: file.size,
                fileType: file.type,
                supabaseUrl: window.supabase?.supabaseUrl,
                hasAnonKey: !!window.supabase?.supabaseKey
            });

            const { data, error } = await window.supabase.storage
                .from('update-images')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type || 'image/png'
                });

            loadingMsg.remove();

            if (error) {
                console.error('❌ Storage upload error:', error);
                console.error('Error details:', {
                    message: error.message,
                    statusCode: error.statusCode,
                    error: error.error
                });

                let errorMessage = 'Görsel yüklenirken hata oluştu: ' + error.message;
                
                if (error.message.includes('row-level security') || error.message.includes('RLS') || error.statusCode === '403' || error.statusCode === 403) {
                    errorMessage = '🔒 RLS Politikası Hatası!\n\n' +
                        'ÇÖZÜM:\n' +
                        '1. Supabase Dashboard → SQL Editor\'a gidin\n' +
                        '2. sql_files/update_images_storage_anonymous.sql dosyasını çalıştırın\n\n' +
                        'VEYA Supabase Dashboard\'dan:\n' +
                        '1. Storage → update-images bucket → Settings\n' +
                        '2. "Public bucket" seçeneğini açın\n' +
                        '3. Policies sekmesinde tüm politikaları silin\n' +
                        '4. Yeni policy ekleyin: bucket_id = \'update-images\' için tüm işlemlere izin verin';
                } else if (error.message.includes('already exists')) {
                    errorMessage = 'Bu dosya zaten mevcut. Farklı bir isim deneyin.';
                }

                alert(errorMessage);
                return;
            }

            console.log('✅ File uploaded successfully:', data);

            // Get public URL
            const { data: { publicUrl } } = window.supabase.storage
                .from('update-images')
                .getPublicUrl(filePath);

            console.log('📎 Public URL:', publicUrl);

            this.currentUpdateSteps[stepIndex].image_url = publicUrl;
            this.renderSteps();
            
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50 shadow-lg';
            successMsg.textContent = '✅ Görsel başarıyla yüklendi!';
            document.body.appendChild(successMsg);
            setTimeout(() => successMsg.remove(), 3000);
        } catch (error) {
            console.error('❌ Error uploading image:', error);
            alert('Görsel yüklenirken hata oluştu: ' + error.message);
        }
    };
    input.click();
};

AdminPanel.prototype.saveUpdate = async function() {
    try {
        // Get version numbers from separate inputs
        const major = parseInt(document.getElementById('updateNumberMajor').value) || 0;
        const minor = parseInt(document.getElementById('updateNumberMinor').value) || 0;
        const patch = parseInt(document.getElementById('updateNumberPatch').value) || 0;
        const updateNumber = `v ${major}.${minor}.${patch}`;
        
        const title = document.getElementById('updateTitle').value.trim();
        const description = document.getElementById('updateDescription').value.trim();
        const scheduledAt = document.getElementById('updateScheduledAt').value;

        if (!updateNumber || !title) {
            alert('Güncelleme numarası ve başlık zorunludur!');
            return;
        }

        if (this.currentUpdateSteps.length === 0) {
            alert('En az bir adım eklemelisiniz!');
            return;
        }

        if (this.currentUpdateSteps.some(step => !step.title || !step.description)) {
            alert('Tüm adımların başlık ve açıklaması doldurulmalıdır!');
            return;
        }

        // Validate feature changes
        const featureChangesValid = this.validateFeatureChanges();
        if (!featureChangesValid.valid) {
            alert(featureChangesValid.error);
            return;
        }

        if (!window.supabase) {
            alert('Supabase bağlantısı yok!');
            return;
        }

        // Convert Istanbul time to UTC for storage
        let scheduledAtUTC = null;
        if (scheduledAt) {
            // datetime-local input gives us local time string (YYYY-MM-DDTHH:mm)
            // We need to interpret this as Istanbul time and convert to UTC
            // Format: "2024-01-15T14:10" should be treated as 14:10 Istanbul time
            
            // Parse the datetime-local value as if it's in Istanbul timezone
            const [datePart, timePart] = scheduledAt.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            
            // Create date string in ISO format, treating it as Istanbul time
            // Istanbul is UTC+3, so we need to subtract 3 hours to get UTC
            const istanbulDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+03:00`;
            const istanbulDate = new Date(istanbulDateString);
            
            // Convert to UTC
            scheduledAtUTC = istanbulDate.toISOString();
            
            console.log('📅 Scheduled time conversion:', {
                input: scheduledAt,
                istanbul: istanbulDateString,
                utc: scheduledAtUTC
            });
        }

        const updateData = {
            update_number: updateNumber,
            title: title,
            description: description,
            steps: this.currentUpdateSteps,
            feature_changes: this.currentFeatureChanges && this.currentFeatureChanges.length > 0 ? this.currentFeatureChanges : null,
            scheduled_at: scheduledAtUTC,
            is_active: false // New updates start as inactive
        };

        let result;
        if (this.editingUpdateId) {
            // Update existing
            const { data, error } = await window.supabase
                .from('updates')
                .update(updateData)
                .eq('id', this.editingUpdateId)
                .select();
            
            if (error) throw error;
            result = data[0];
        } else {
            // Check if update_number already exists
            const { data: existing } = await window.supabase
                .from('updates')
                .select('id')
                .eq('update_number', updateNumber)
                .single();

            if (existing) {
                alert('Bu güncelleme numarası zaten kullanılıyor!');
                return;
            }

            // Create new
            const { data, error } = await window.supabase
                .from('updates')
                .insert(updateData)
                .select();
            
            if (error) throw error;
            result = data[0];
        }

        alert('Güncelleme başarıyla kaydedildi!');
        document.getElementById('updateModal').classList.add('hidden');
        await this.loadUpdates();
    } catch (error) {
        console.error('Error saving update:', error);
        alert('Güncelleme kaydedilirken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.editUpdate = function(updateId) {
    this.openUpdateModal(updateId);
};

AdminPanel.prototype.toggleUpdateStatus = async function(updateId, newStatus) {
    try {
        if (!window.supabase) {
            alert('Supabase bağlantısı yok!');
            return;
        }

        const { error } = await window.supabase
            .from('updates')
            .update({ is_active: newStatus })
            .eq('id', updateId);

        if (error) throw error;

        await this.loadUpdates();
    } catch (error) {
        console.error('Error toggling update status:', error);
        alert('Durum güncellenirken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.deleteUpdate = async function(updateId) {
    if (!confirm('Bu güncellemeyi silmek istediğinizden emin misiniz?\n\nBu işlem şunları da silecektir:\n- Bu güncellemeye ait feature history kayıtları\n- Bu güncellemeye ait kullanıcı durumları\n- Eğer bu güncelleme özellik değerlerini değiştirdiyse, önceki değerlere geri dönecektir')) {
        return;
    }

    try {
        if (!window.supabase) {
            alert('Supabase bağlantısı yok!');
            return;
        }

        // Önce silinecek güncellemeyi al (update_number ve feature_changes bilgisi için)
        const { data: updateToDelete, error: fetchError } = await window.supabase
            .from('updates')
            .select('id, update_number, feature_changes')
            .eq('id', updateId)
            .single();

        if (fetchError) throw fetchError;
        if (!updateToDelete) {
            alert('Güncelleme bulunamadı!');
            return;
        }

        const updateNumber = updateToDelete.update_number;
        const featureChanges = updateToDelete.feature_changes || [];

        console.log('🗑️ Deleting update:', updateNumber, 'with feature changes:', featureChanges);

        // ÖNEMLİ: Önce system_features'i geri al, SONRA feature_history'yi sil
        // Çünkü bir önceki değeri bulmak için feature_history'ye ihtiyacımız var
        
        // 1. system_features'i güncelle - eğer bu güncelleme özellik değerlerini değiştirdiyse
        // ÖNCE: Bir önceki değeri bul (feature_history silinmeden önce)
        if (featureChanges && Array.isArray(featureChanges) && featureChanges.length > 0) {
            console.log('🔄 Reverting system_features for deleted update...');
            
            for (const change of featureChanges) {
                if (!change.feature_key) continue;

                try {
                    // ÖNCE: Bu özellik için bir önceki güncellemenin değerini bul (feature_history silinmeden önce)
                    // Bu güncelleme hariç, en son değişikliği bul
                    let revertValue = null;
                    
                    try {
                        const { data: previousHistoryList, error: historyError } = await window.supabase
                            .from('feature_history')
                            .select('new_value, update_number, old_value')
                            .eq('feature_key', change.feature_key)
                            .neq('update_number', updateNumber) // Bu güncelleme hariç
                            .order('changed_at', { ascending: false })
                            .limit(1);

                        if (!historyError && previousHistoryList && previousHistoryList.length > 0) {
                            const previousHistory = previousHistoryList[0];
                            // Bir önceki güncellemenin değerini kullan
                            revertValue = previousHistory.new_value;
                            console.log(`🔄 Feature ${change.feature_key}: Found previous value from update ${previousHistory.update_number}:`, revertValue);
                        } else {
                            // Önceki güncelleme yoksa, default değere dön
                            const definition = window.getFeatureDefinition?.(change.feature_key);
                            if (definition && definition.defaultValue !== undefined) {
                                revertValue = definition.defaultValue;
                                console.log(`🔄 Feature ${change.feature_key}: No previous history found, using default value:`, revertValue);
                            } else {
                                console.warn(`⚠️ Feature ${change.feature_key}: No previous value or default found, cannot revert`);
                                continue; // Değer bulunamadı, atla
                            }
                        }
                    } catch (historyErr) {
                        console.error(`❌ Error fetching previous history for ${change.feature_key}:`, historyErr);
                        // Hata durumunda default değere dön
                        const definition = window.getFeatureDefinition?.(change.feature_key);
                        if (definition && definition.defaultValue !== undefined) {
                            revertValue = definition.defaultValue;
                            console.log(`🔄 Feature ${change.feature_key}: Error fetching history, using default value:`, revertValue);
                        } else {
                            console.warn(`⚠️ Feature ${change.feature_key}: Cannot revert, skipping`);
                            continue;
                        }
                    }

                    // system_features'i her zaman geri al (koşulsuz)
                    // Çünkü bu güncelleme silindiğinde, özellik değeri bir önceki haline dönmeli
                    if (revertValue !== null) {
                        const definition = window.getFeatureDefinition?.(change.feature_key);
                        if (definition) {
                            const { error: updateError } = await window.supabase
                                .from('system_features')
                                .update({
                                    current_value: revertValue,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('feature_key', change.feature_key);

                            if (updateError) {
                                console.error(`❌ Error reverting system_features for ${change.feature_key}:`, updateError);
                            } else {
                                console.log(`✅ Feature ${change.feature_key} reverted from "${change.new_value}" to "${revertValue}"`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error processing feature ${change.feature_key} for deleted update:`, error);
                    // Devam et, bir özellik hatası diğerlerini engellemez
                }
            }
        }

        // 2. feature_history'den bu güncellemeye ait kayıtları sil (artık güvenle silebiliriz)
        if (updateNumber) {
            console.log('🗑️ Deleting feature_history records for update:', updateNumber);
            
            try {
                // Önce tüm kayıtları getir
                const { data: historyRecords, error: fetchError } = await window.supabase
                    .from('feature_history')
                    .select('id, feature_key, update_number')
                    .eq('update_number', updateNumber);
                
                if (fetchError) {
                    console.error('❌ Error fetching feature_history records:', fetchError);
                } else {
                    const recordCount = historyRecords?.length || 0;
                    console.log(`📊 Found ${recordCount} feature_history records for update ${updateNumber}`);
                    
                    if (recordCount > 0) {
                        // Her kaydı tek tek sil (RLS policy sorunlarını önlemek için)
                        let deletedCount = 0;
                        for (const record of historyRecords) {
                            const { error: deleteError } = await window.supabase
                                .from('feature_history')
                                .delete()
                                .eq('id', record.id);
                            
                            if (deleteError) {
                                console.error(`❌ Error deleting feature_history record ${record.id} for feature ${record.feature_key}:`, deleteError);
                            } else {
                                deletedCount++;
                            }
                        }
                        
                        if (deletedCount === recordCount) {
                            console.log(`✅ Successfully deleted all ${deletedCount} feature_history records`);
                        } else {
                            console.warn(`⚠️ Only ${deletedCount} out of ${recordCount} feature_history records were deleted`);
                            alert(`⚠️ Uyarı: ${recordCount - deletedCount} feature_history kaydı silinemedi. Lütfen manuel olarak kontrol edin.`);
                        }
                    } else {
                        console.log('ℹ️ No feature_history records found for this update');
                    }
                }
            } catch (error) {
                console.error('❌ Unexpected error deleting feature_history:', error);
                alert('⚠️ Uyarı: feature_history kayıtları silinirken beklenmeyen hata oluştu: ' + error.message);
            }
        }

        // 3. user_update_status'den bu güncellemeye ait kayıtları sil
        // ÖNEMLİ: Bu işlem mutlaka yapılmalı, kullanıcılar silinen güncellemeyi görmüş gibi görünmemeli
        // Eğer silinemiyorsa, en azından is_seen ve is_completed değerlerini false yap
        if (updateNumber) {
            console.log('🗑️ Deleting user_update_status records for update:', updateNumber);
            
            try {
                // Önce tüm kayıtları getir (RLS policy sorunlarını önlemek için)
                const { data: statusRecords, error: fetchError } = await window.supabase
                    .from('user_update_status')
                    .select('id, username, update_number, is_seen, is_completed')
                    .eq('update_number', updateNumber);
                
                if (fetchError) {
                    console.error('❌ Error fetching user_update_status records:', fetchError);
                    alert('⚠️ Uyarı: user_update_status kayıtları alınırken hata oluştu: ' + fetchError.message);
                } else {
                    const recordCount = statusRecords?.length || 0;
                    console.log(`📊 Found ${recordCount} user_update_status records for update ${updateNumber}`);
                    
                    if (recordCount > 0) {
                        // Her kaydı tek tek sil (RLS policy sorunlarını önlemek için)
                        let deletedCount = 0;
                        let failedRecords = [];
                        
                        for (const record of statusRecords) {
                            const { error: deleteError } = await window.supabase
                                .from('user_update_status')
                                .delete()
                                .eq('id', record.id);
                            
                            if (deleteError) {
                                console.error(`❌ Error deleting user_update_status record ${record.id} for user ${record.username}:`, deleteError);
                                failedRecords.push(record);
                            } else {
                                deletedCount++;
                            }
                        }
                        
                        // Silinemeyen kayıtlar varsa, en azından is_seen ve is_completed değerlerini false yap
                        if (failedRecords.length > 0) {
                            console.warn(`⚠️ ${failedRecords.length} user_update_status records could not be deleted, resetting is_seen and is_completed to false`);
                            
                            for (const record of failedRecords) {
                                const { error: updateError } = await window.supabase
                                    .from('user_update_status')
                                    .update({
                                        is_seen: false,
                                        is_completed: false
                                    })
                                    .eq('id', record.id);
                                
                                if (updateError) {
                                    console.error(`❌ Error updating user_update_status record ${record.id}:`, updateError);
                                } else {
                                    console.log(`✅ Reset is_seen and is_completed to false for record ${record.id} (user: ${record.username})`);
                                }
                            }
                            
                            alert(`⚠️ Uyarı: ${failedRecords.length} user_update_status kaydı silinemedi, ancak is_seen ve is_completed değerleri false yapıldı.`);
                        }
                        
                        if (deletedCount === recordCount) {
                            console.log(`✅ Successfully deleted all ${deletedCount} user_update_status records`);
                        } else if (deletedCount > 0) {
                            console.log(`✅ Deleted ${deletedCount} user_update_status records, ${failedRecords.length} records were reset instead`);
                        } else {
                            console.warn(`⚠️ Could not delete any user_update_status records, but reset ${failedRecords.length} records`);
                        }
                    } else {
                        console.log('ℹ️ No user_update_status records found for this update');
                    }
                }
            } catch (error) {
                console.error('❌ Unexpected error deleting user_update_status:', error);
                alert('⚠️ Uyarı: user_update_status kayıtları silinirken beklenmeyen hata oluştu: ' + error.message);
            }
        }

        // 4. Son olarak güncellemeyi sil
        console.log('🗑️ Deleting update from updates table...');
        const { error } = await window.supabase
            .from('updates')
            .delete()
            .eq('id', updateId);

        if (error) throw error;

        console.log('✅ Update deleted successfully');
        await this.loadUpdates();
        alert('✅ Güncelleme ve ilgili tüm kayıtlar başarıyla silindi!');
    } catch (error) {
        console.error('Error deleting update:', error);
        alert('Güncelleme silinirken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.filterUpdates = function(filter) {
    // This will be implemented when we add filtering logic
    this.renderUpdates();
};

AdminPanel.prototype.showUpdateStats = async function(updateId, updateNumber) {
    try {
        if (!window.supabase) {
            alert('Supabase bağlantısı yok!');
            return;
        }

        // Get all user statuses for this update
        const { data: statuses, error } = await window.supabase
            .from('user_update_status')
            .select('*')
            .eq('update_number', updateNumber)
            .order('seen_at', { ascending: false });

        if (error) throw error;

        const seenUsers = (statuses || []).filter(s => s.is_seen).map(s => ({
            username: s.username,
            seen_at: s.seen_at ? new Date(s.seen_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '-'
        }));

        const completedUsers = (statuses || []).filter(s => s.is_completed).map(s => ({
            username: s.username,
            completed_at: s.completed_at ? new Date(s.completed_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '-'
        }));

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4';
        modal.style.backdropFilter = 'blur(4px)';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-2xl font-bold mb-1">Güncelleme İstatistikleri</h3>
                            <p class="text-green-100 text-sm">${updateNumber}</p>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="text-white hover:text-gray-200 transition-colors p-2 rounded-lg hover:bg-white hover:bg-opacity-20">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Stats Cards -->
                <div class="p-6 bg-gray-50">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <!-- Seen Stats Card -->
                        <div class="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-sm font-medium">Görüntüleyenler</p>
                                    <p class="text-3xl font-bold text-gray-900 mt-1">${seenUsers.length}</p>
                                </div>
                                <div class="bg-blue-100 rounded-full p-3">
                                    <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Completed Stats Card -->
                        <div class="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-sm font-medium">Tamamlayanlar</p>
                                    <p class="text-3xl font-bold text-gray-900 mt-1">${completedUsers.length}</p>
                                </div>
                                <div class="bg-green-100 rounded-full p-3">
                                    <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="flex-1 overflow-y-auto p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Seen Users List -->
                        <div>
                            <h4 class="font-semibold text-gray-900 mb-4 flex items-center text-lg">
                                <div class="bg-blue-100 rounded-lg p-2 mr-3">
                                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                </div>
                                Görüntüleyenler
                            </h4>
                            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 max-h-80 overflow-y-auto border border-blue-100">
                                ${seenUsers.length === 0 ? 
                                    '<div class="text-center py-8"><p class="text-gray-500 text-sm">Henüz kimse görüntülemedi</p></div>' :
                                    seenUsers.map((u, index) => `
                                        <div class="bg-white rounded-lg p-3 mb-2 shadow-sm hover:shadow-md transition-shadow ${index === seenUsers.length - 1 ? 'mb-0' : ''}">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center space-x-3">
                                                    <div class="bg-blue-100 rounded-full w-8 h-8 flex items-center justify-center">
                                                        <span class="text-blue-600 font-semibold text-xs">${u.username.charAt(0).toUpperCase()}</span>
                                                    </div>
                                                    <div>
                                                        <p class="font-semibold text-sm text-gray-900">${u.username}</p>
                                                        <p class="text-xs text-gray-500 flex items-center mt-1">
                                                            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                            </svg>
                                                            ${u.seen_at}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>
                        
                        <!-- Completed Users List -->
                        <div>
                            <h4 class="font-semibold text-gray-900 mb-4 flex items-center text-lg">
                                <div class="bg-green-100 rounded-lg p-2 mr-3">
                                    <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </div>
                                Tamamlayanlar
                            </h4>
                            <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 max-h-80 overflow-y-auto border border-green-100">
                                ${completedUsers.length === 0 ? 
                                    '<div class="text-center py-8"><p class="text-gray-500 text-sm">Henüz kimse tamamlamadı</p></div>' :
                                    completedUsers.map((u, index) => `
                                        <div class="bg-white rounded-lg p-3 mb-2 shadow-sm hover:shadow-md transition-shadow ${index === completedUsers.length - 1 ? 'mb-0' : ''}">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center space-x-3">
                                                    <div class="bg-green-100 rounded-full w-8 h-8 flex items-center justify-center">
                                                        <span class="text-green-600 font-semibold text-xs">${u.username.charAt(0).toUpperCase()}</span>
                                                    </div>
                                                    <div>
                                                        <p class="font-semibold text-sm text-gray-900">${u.username}</p>
                                                        <p class="text-xs text-gray-500 flex items-center mt-1">
                                                            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                                            </svg>
                                                            ${u.completed_at}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div class="bg-green-100 rounded-full p-1.5">
                                                    <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="border-t border-gray-200 p-4 bg-gray-50 flex justify-end rounded-b-2xl">
                    <button onclick="this.closest('.fixed').remove()" class="px-6 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all shadow-md font-medium">
                        Kapat
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error loading update stats:', error);
        alert('İstatistikler yüklenirken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.renderFeatureChanges = function() {
    const container = document.getElementById('featureChangesContainer');
    if (!container) return;

    if (!this.currentFeatureChanges || this.currentFeatureChanges.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 italic">Henüz özellik değişikliği eklenmedi</p>';
        return;
    }

    container.innerHTML = this.currentFeatureChanges.map((change, index) => {
        const definition = window.getFeatureDefinition?.(change.feature_key);
        const featureName = definition?.name || change.feature_key;
        const valueType = definition?.valueType || change.value_type || 'boolean';

        let valueInput = '';
        if (valueType === 'boolean') {
            valueInput = `
                <select class="feature-value-input w-full border-gray-300 rounded-md shadow-sm text-sm" 
                        onchange="adminPanel.currentFeatureChanges[${index}].new_value = this.value === 'true'">
                    <option value="false" ${change.new_value === false ? 'selected' : ''}>False</option>
                    <option value="true" ${change.new_value === true ? 'selected' : ''}>True</option>
                </select>
            `;
        } else if (valueType === 'number') {
            valueInput = `
                <input type="number" class="feature-value-input w-full border-gray-300 rounded-md shadow-sm text-sm" 
                       value="${change.new_value}" 
                       onchange="adminPanel.currentFeatureChanges[${index}].new_value = parseFloat(this.value) || 0">
            `;
        } else if (valueType === 'string') {
            valueInput = `
                <input type="text" class="feature-value-input w-full border-gray-300 rounded-md shadow-sm text-sm" 
                       value="${String(change.new_value).replace(/"/g, '&quot;')}" 
                       onchange="adminPanel.currentFeatureChanges[${index}].new_value = this.value">
            `;
        } else if (valueType === 'object') {
            valueInput = `
                <textarea class="feature-value-input w-full border-gray-300 rounded-md shadow-sm text-sm font-mono text-xs" 
                          rows="3" 
                          onchange="try { adminPanel.currentFeatureChanges[${index}].new_value = JSON.parse(this.value); } catch(e) { alert('Geçersiz JSON'); }">${JSON.stringify(change.new_value, null, 2)}</textarea>
            `;
        }

        return `
            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-700 mb-1">Özellik</label>
                        <select class="feature-key-input w-full border-gray-300 rounded-md shadow-sm text-sm" 
                                onchange="adminPanel.currentFeatureChanges[${index}].feature_key = this.value; const def = window.getFeatureDefinition(this.value); if(def) { adminPanel.currentFeatureChanges[${index}].value_type = def.valueType; adminPanel.currentFeatureChanges[${index}].new_value = def.defaultValue; } adminPanel.renderFeatureChanges();">
                            ${Object.keys(window.getAllFeatureDefinitions?.() || {}).map(key => {
                                const def = window.getFeatureDefinition(key);
                                return `<option value="${key}" ${change.feature_key === key ? 'selected' : ''}>${def.name}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <button type="button" onclick="adminPanel.removeFeatureChange(${index})" 
                            class="ml-2 text-red-600 hover:text-red-800 text-sm">
                        ✕
                    </button>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Yeni Değer</label>
                    ${valueInput}
                    <input type="hidden" class="feature-type-input" value="${valueType}">
                </div>
            </div>
        `;
    }).join('');
};

AdminPanel.prototype.addFeatureChange = function() {
    if (!this.currentFeatureChanges) {
        this.currentFeatureChanges = [];
    }

    const allFeatures = window.getAllFeatureDefinitions?.() || {};
    const firstFeatureKey = Object.keys(allFeatures)[0];
    const firstFeature = allFeatures[firstFeatureKey];

    if (!firstFeatureKey) {
        alert('Henüz özellik tanımı yok! Önce js/feature-definitions.js dosyasına özellik ekleyin.');
        return;
    }

    this.currentFeatureChanges.push({
        feature_key: firstFeatureKey,
        new_value: firstFeature?.defaultValue || false,
        value_type: firstFeature?.valueType || 'boolean'
    });

    this.renderFeatureChanges();
};

AdminPanel.prototype.removeFeatureChange = function(index) {
    if (this.currentFeatureChanges && this.currentFeatureChanges[index]) {
        this.currentFeatureChanges.splice(index, 1);
        this.renderFeatureChanges();
    }
};

AdminPanel.prototype.validateFeatureChanges = function() {
    if (!this.currentFeatureChanges || this.currentFeatureChanges.length === 0) {
        return { valid: true };
    }

    for (let i = 0; i < this.currentFeatureChanges.length; i++) {
        const change = this.currentFeatureChanges[i];
        
        if (!change.feature_key) {
            return { valid: false, error: `Özellik değişikliği ${i + 1}: Özellik seçilmedi` };
        }

        if (change.new_value === undefined || change.new_value === null) {
            return { valid: false, error: `Özellik değişikliği ${i + 1}: Değer belirtilmedi` };
        }

        const definition = window.getFeatureDefinition?.(change.feature_key);
        if (!definition) {
            return { valid: false, error: `Özellik değişikliği ${i + 1}: Geçersiz özellik anahtarı` };
        }

        if (!window.validateFeatureValue?.(change.new_value, definition.valueType)) {
            return { valid: false, error: `Özellik değişikliği ${i + 1}: Geçersiz değer tipi. Beklenen: ${definition.valueType}` };
        }

        // value_type'ı güncelle
        change.value_type = definition.valueType;
    }

    return { valid: true };
};

AdminPanel.prototype.previewUpdate = function() {
    // Get version numbers from separate inputs
    const major = parseInt(document.getElementById('updateNumberMajor').value) || 0;
    const minor = parseInt(document.getElementById('updateNumberMinor').value) || 0;
    const patch = parseInt(document.getElementById('updateNumberPatch').value) || 0;
    const updateNumber = `v ${major}.${minor}.${patch}`;
    
    const title = document.getElementById('updateTitle').value.trim();
    const description = document.getElementById('updateDescription').value.trim();
    const steps = this.currentUpdateSteps;

    if (!updateNumber || !title || steps.length === 0) {
        alert('Önizleme için güncelleme numarası, başlık ve en az bir adım gerekli!');
        return;
    }

    // Preview state
    this.previewState = {
        currentStepIndex: 0,
        steps: steps,
        title: title,
        description: description
    };

    // Update preview modal structure to match user side exactly
    const previewModal = document.getElementById('previewModal');
    previewModal.className = 'fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4';
    previewModal.style.backdropFilter = 'blur(4px)';
    
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = this.renderPreviewContent();

    // Attach event listeners
    this.attachPreviewListeners();

    previewModal.classList.remove('hidden');
};

// Product Update JSON Parse Fonksiyonu
AdminPanel.prototype.parseProductUpdateJSON = function(description) {
    if (!description || !description.trim()) return null;
    
    try {
        // Description'dan JSON'u bul (tüm satırları kontrol et)
        const lines = description.split('\n');
        let jsonStart = -1;
        let jsonEnd = -1;
        let braceCount = 0;
        
        // JSON'un başlangıç ve bitişini bul
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('"type"') && line.includes('"product_update"')) {
                jsonStart = i;
                braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                if (braceCount === 0 && line.endsWith('}')) {
                    // Tek satırda JSON
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.type === 'product_update' && Array.isArray(parsed.products)) {
                            return {
                                products: parsed.products,
                                display_type: parsed.display_type || 'grid'
                            };
                        }
                    } catch (e) {
                        // Devam et
                    }
                }
            } else if (jsonStart !== -1) {
                braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                if (braceCount === 0 && line.includes('}')) {
                    jsonEnd = i;
                    break;
                }
            }
        }
        
        // JSON'u parse et
        if (jsonStart !== -1) {
            const jsonLines = jsonEnd !== -1 
                ? lines.slice(jsonStart, jsonEnd + 1)
                : lines.slice(jsonStart);
            const jsonString = jsonLines.join('\n');
            
            try {
                const parsed = JSON.parse(jsonString);
                if (parsed.type === 'product_update' && Array.isArray(parsed.products)) {
                    return {
                        products: parsed.products,
                        display_type: parsed.display_type || 'grid'
                    };
                }
            } catch (e) {
                // JSON parse hatası, description'ın tamamını kontrol et
                try {
                    const fullParsed = JSON.parse(description.trim());
                    if (fullParsed.type === 'product_update' && Array.isArray(fullParsed.products)) {
                        return {
                            products: fullParsed.products,
                            display_type: fullParsed.display_type || 'grid'
                        };
                    }
                } catch (e2) {
                    // JSON değil, null döndür
                }
            }
        }
    } catch (error) {
        console.warn('Product update JSON parse hatası:', error);
    }
    
    return null;
};

// Product Update Render Fonksiyonu (Grid, List, Carousel, Orbit)
AdminPanel.prototype.renderProductUpdate = function(products, showAll = false, displayType = 'grid') {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return '';
    }
    
    // Display type'a göre farklı render fonksiyonlarını çağır
    switch(displayType) {
        case 'list':
            return this.renderProductUpdateList(products, showAll);
        case 'carousel':
            return this.renderProductUpdateCarousel(products, showAll);
        case 'orbit':
            return this.renderProductUpdateOrbit(products, showAll);
        case 'grid':
        default:
            return this.renderProductUpdateGrid(products, showAll);
    }
};

// Grid Görünümü
AdminPanel.prototype.renderProductUpdateGrid = function(products, showAll = false) {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return '';
    }
    
    // Responsive grid: Ekran boyutuna göre kaç ürün gösterileceğini hesapla
    // Varsayılan: 2 sütun (mobil), 3 sütun (tablet), 4-6 sütun (desktop)
    // İlk görünümde ekranın izin verdiği kadar göster (yaklaşık 2-3 satır)
    let initialDisplayCount = 12; // Varsayılan: 3 sütun x 4 satır = 12
    if (typeof window !== 'undefined' && window.innerWidth) {
        if (window.innerWidth < 768) {
            initialDisplayCount = 6; // Mobil: 2 sütun x 3 satır
        } else if (window.innerWidth < 1024) {
            initialDisplayCount = 12; // Tablet: 3 sütun x 4 satır
        } else if (window.innerWidth < 1280) {
            initialDisplayCount = 16; // Desktop: 4 sütun x 4 satır
        } else {
            initialDisplayCount = 18; // Büyük ekran: 6 sütun x 3 satır
        }
    }
    
    const shouldShowAll = showAll || products.length <= initialDisplayCount;
    const displayProducts = shouldShowAll ? products : products.slice(0, initialDisplayCount);
    const remainingCount = products.length - initialDisplayCount;
    const uniqueId = 'product-update-' + Math.random().toString(36).substr(2, 9);
    
    // Products'ı string olarak sakla (onclick için) - UTF-8 uyumlu Base64 encode
    const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
    
    return `
        <div class="product-update-grid mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="grid">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                ${displayProducts.map(product => {
                    const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;');
                    const barcode = product.barcode || 'Barkod yok';
                    const image = product.image || '';
                    
                    return `
                        <div class="product-card bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex flex-col">
                            <div class="product-card-image-container bg-gray-100 flex items-center justify-center flex-shrink-0" style="height: 120px; overflow: hidden;">
                                ${image ? `
                                    <img src="${image}" 
                                         alt="${productName}" 
                                         class="product-card-image w-full h-full object-cover"
                                         onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs\\'>Görsel Yok</div>';"
                                         loading="lazy">
                                ` : `
                                    <div class="text-gray-400 text-xs">Görsel Yok</div>
                                `}
                            </div>
                            <div class="p-2 flex-1 flex flex-col">
                                <div class="product-card-name font-medium text-xs text-gray-900 mb-1 flex-1" style="word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;">
                                    ${productName}
                                </div>
                                <div class="product-card-barcode text-xs text-gray-600 font-mono mt-auto">
                                    ${barcode}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${remainingCount > 0 && !shouldShowAll ? `
                <div class="mt-4 text-center">
                    <button onclick="
                        (function() {
                            const container = document.getElementById('${uniqueId}');
                            if (!container) return;
                            const productsBase64 = container.getAttribute('data-products');
                            if (!productsBase64) return;
                            try {
                                const products = JSON.parse(decodeURIComponent(atob(productsBase64)));
                                const displayType = container.getAttribute('data-display-type') || 'grid';
                                if (window.adminPanel) {
                                    container.innerHTML = window.adminPanel.renderProductUpdate(products, true, displayType);
                                }
                            } catch(e) {
                                console.error('Product update render error:', e);
                            }
                        })();
                    " class="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer transition-colors px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 inline-block">
                        <span class="font-semibold">+${remainingCount} ürün daha</span> görmek için tıklayın
                    </button>
                </div>
            ` : ''}
        </div>
    `;
};

// List Görünümü
AdminPanel.prototype.renderProductUpdateList = function(products, showAll = false) {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return '';
    }
    
    let initialDisplayCount = 10;
    if (typeof window !== 'undefined' && window.innerWidth) {
        if (window.innerWidth < 768) {
            initialDisplayCount = 5;
        } else if (window.innerWidth < 1024) {
            initialDisplayCount = 8;
        } else {
            initialDisplayCount = 10;
        }
    }
    
    const shouldShowAll = showAll || products.length <= initialDisplayCount;
    const displayProducts = shouldShowAll ? products : products.slice(0, initialDisplayCount);
    const remainingCount = products.length - initialDisplayCount;
    const uniqueId = 'product-update-list-' + Math.random().toString(36).substr(2, 9);
    const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
    
    return `
        <div class="product-update-list mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="list">
            <div class="space-y-3">
                ${displayProducts.map(product => {
                    const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;');
                    const barcode = product.barcode || 'Barkod yok';
                    const image = product.image || '';
                    
                    return `
                        <div class="product-list-item bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300 flex items-center gap-4 p-3">
                            <div class="product-list-image flex-shrink-0" style="width: 80px; height: 80px; overflow: hidden; border-radius: 8px; background: #f3f4f6;">
                                ${image ? `
                                    <img src="${image}" 
                                         alt="${productName}" 
                                         class="w-full h-full object-cover"
                                         onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs flex items-center justify-center h-full\\'>Görsel Yok</div>';"
                                         loading="lazy">
                                ` : `
                                    <div class="text-gray-400 text-xs flex items-center justify-center h-full">Görsel Yok</div>
                                `}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="product-list-name font-medium text-sm text-gray-900 mb-1" style="word-wrap: break-word; overflow-wrap: break-word;">
                                    ${productName}
                                </div>
                                <div class="product-list-barcode text-xs text-gray-600 font-mono">
                                    ${barcode}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${remainingCount > 0 && !shouldShowAll ? `
                <div class="mt-4 text-center">
                    <button onclick="
                        (function() {
                            const container = document.getElementById('${uniqueId}');
                            if (!container) return;
                            const productsBase64 = container.getAttribute('data-products');
                            if (!productsBase64) return;
                            try {
                                const products = JSON.parse(decodeURIComponent(atob(productsBase64)));
                                const displayType = container.getAttribute('data-display-type') || 'list';
                                if (window.adminPanel) {
                                    container.innerHTML = window.adminPanel.renderProductUpdate(products, true, displayType);
                                }
                            } catch(e) {
                                console.error('Product update render error:', e);
                            }
                        })();
                    " class="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer transition-colors px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 inline-block">
                        <span class="font-semibold">+${remainingCount} ürün daha</span> görmek için tıklayın
                    </button>
                </div>
            ` : ''}
        </div>
    `;
};

// Carousel Görünümü
AdminPanel.prototype.renderProductUpdateCarousel = function(products, showAll = false) {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return '';
    }
    
    const uniqueId = 'product-update-carousel-' + Math.random().toString(36).substr(2, 9);
    const carouselId = 'carousel-' + uniqueId;
    const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
    const displayProducts = products;
    
    return `
        <div class="product-update-carousel mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="carousel">
            <div class="relative">
                <div id="${carouselId}" class="overflow-hidden rounded-lg">
                    <div class="flex transition-transform duration-500 ease-in-out" style="transform: translateX(0px);">
                        ${displayProducts.map((product, index) => {
                            const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;');
                            const barcode = product.barcode || 'Barkod yok';
                            const image = product.image || '';
                            
                            return `
                                <div class="carousel-slide flex-shrink-0 w-full px-2">
                                    <div class="product-card bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col mx-auto" style="max-width: 300px;">
                                        <div class="product-card-image-container bg-gray-100 flex items-center justify-center flex-shrink-0" style="height: 200px; overflow: hidden;">
                                            ${image ? `
                                                <img src="${image}" 
                                                     alt="${productName}" 
                                                     class="product-card-image w-full h-full object-cover"
                                                     onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-sm\\'>Görsel Yok</div>';"
                                                     loading="lazy">
                                            ` : `
                                                <div class="text-gray-400 text-sm">Görsel Yok</div>
                                            `}
                                        </div>
                                        <div class="p-4 flex-1 flex flex-col">
                                            <div class="product-card-name font-medium text-base text-gray-900 mb-2 flex-1" style="word-wrap: break-word; overflow-wrap: break-word;">
                                                ${productName}
                                            </div>
                                            <div class="product-card-barcode text-sm text-gray-600 font-mono mt-auto">
                                                ${barcode}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                ${displayProducts.length > 1 ? `
                    <button onclick="
                        (function() {
                            const carousel = document.getElementById('${carouselId}');
                            const slides = carousel.querySelector('.flex');
                            const currentTransform = slides.style.transform.match(/translateX\\((-?\\d+)px\\)/);
                            const currentX = currentTransform ? parseInt(currentTransform[1]) : 0;
                            const slideWidth = carousel.offsetWidth;
                            const newX = Math.max(currentX - slideWidth, -(slideWidth * (${displayProducts.length} - 1)));
                            slides.style.transform = 'translateX(' + newX + 'px)';
                        })();
                    " class="absolute left-0 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all z-10">
                        <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <button onclick="
                        (function() {
                            const carousel = document.getElementById('${carouselId}');
                            const slides = carousel.querySelector('.flex');
                            const currentTransform = slides.style.transform.match(/translateX\\((-?\\d+)px\\)/);
                            const currentX = currentTransform ? parseInt(currentTransform[1]) : 0;
                            const slideWidth = carousel.offsetWidth;
                            const newX = Math.min(currentX + slideWidth, 0);
                            slides.style.transform = 'translateX(' + newX + 'px)';
                        })();
                    " class="absolute right-0 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all z-10">
                        <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </button>
                    <div class="flex justify-center mt-4 gap-2">
                        ${displayProducts.map((_, index) => `
                            <button onclick="
                                (function() {
                                    const carousel = document.getElementById('${carouselId}');
                                    const slides = carousel.querySelector('.flex');
                                    const slideWidth = carousel.offsetWidth;
                                    slides.style.transform = 'translateX(' + (-slideWidth * ${index}) + 'px)';
                                })();
                            " class="carousel-dot w-2 h-2 rounded-full bg-gray-300 hover:bg-gray-400 transition-all ${index === 0 ? 'bg-blue-500' : ''}"></button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
};

// Orbit Görünümü (Apple Watch tarzı - spiral düzenleme, zoom efekti)
AdminPanel.prototype.renderProductUpdateOrbit = function(products, showAll = false) {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return '';
    }
    
    // Orbit modunda her zaman tüm ürünleri göster
    const displayProducts = products;
    const uniqueId = 'product-update-orbit-' + Math.random().toString(36).substr(2, 9);
    const productsJson = btoa(encodeURIComponent(JSON.stringify(products)));
    
    // Apple Watch tarzı spiral düzenleme
    // Ürünler merkezden dışarı doğru spiral şeklinde yerleştirilir
    const centerX = 50;
    const centerY = 50;
    const baseRadius = 20; // Minimum radius
    const radiusStep = 8; // Her spiral turunda radius artışı
    const angleStep = Math.PI / 6; // Her ürün arası açı (30 derece)
    const totalItems = displayProducts.length;
    
    // Spiral pozisyonları hesapla
    const positions = [];
    let currentRadius = baseRadius;
    let currentAngle = 0;
    
    for (let i = 0; i < totalItems; i++) {
        const x = centerX + currentRadius * Math.cos(currentAngle);
        const y = centerY + currentRadius * Math.sin(currentAngle);
        positions.push({ x, y, radius: currentRadius, angle: currentAngle });
        
        currentAngle += angleStep;
        // Her 12 üründe bir (360 derece) radius'u artır
        if ((i + 1) % 12 === 0) {
            currentRadius += radiusStep;
        }
    }
    
    return `
        <div class="product-update-orbit mt-4 mb-4" id="${uniqueId}" data-products="${productsJson}" data-display-type="orbit" data-total-items="${totalItems}">
            <div class="relative orbit-wrapper" style="min-height: 600px; padding: 50px; cursor: grab; overflow: hidden;">
                <div class="orbit-container relative w-full h-full" style="position: relative; transform-origin: center center;">
                    ${displayProducts.map((product, index) => {
                        const pos = positions[index];
                        const productName = (product.name || 'İsimsiz Ürün').replace(/"/g, '&quot;');
                        const barcode = product.barcode || 'Barkod yok';
                        const image = product.image || '';
                        
                        // Merkeze uzaklığa göre boyut hesapla (3D perspektif)
                        const distanceFromCenter = pos.radius;
                        const maxDistance = Math.max(...positions.map(p => p.radius));
                        const scale = 0.6 + (1 - distanceFromCenter / maxDistance) * 0.4; // 0.6x - 1.0x arası
                        const opacity = 0.7 + (1 - distanceFromCenter / maxDistance) * 0.3; // 0.7 - 1.0 arası
                        const zIndex = Math.floor(100 - (distanceFromCenter / maxDistance) * 50);
                        
                        return `
                            <div class="orbit-item absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-150 hover:z-50" 
                                 style="left: ${pos.x}%; top: ${pos.y}%; will-change: transform; transform: translate(-50%, -50%) scale(${scale}); opacity: ${opacity}; z-index: ${zIndex};">
                                <div class="product-orbit-card bg-white border-2 border-gray-200 rounded-full overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer" 
                                     style="width: 90px; height: 90px; position: relative;">
                                    ${image ? `
                                        <img src="${image}" 
                                             alt="${productName}" 
                                             class="w-full h-full object-cover rounded-full"
                                             onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div class=\\'text-gray-400 text-xs flex items-center justify-center h-full\\'>?</div>';"
                                             loading="lazy">
                                    ` : `
                                        <div class="text-gray-400 text-xs flex items-center justify-center h-full rounded-full bg-gray-100">?</div>
                                    `}
                                    <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 rounded-full flex items-center justify-center">
                                        <div class="opacity-0 hover:opacity-100 transition-opacity duration-300 text-white text-xs font-medium text-center px-2" style="text-shadow: 0 2px 4px rgba(0,0,0,0.7);">
                                            ${productName.length > 20 ? productName.substring(0, 20) + '...' : productName}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-50 pointer-events-none">
                        <div class="bg-white rounded-full p-4 shadow-lg border-2 border-gray-200">
                            <div class="text-2xl font-bold text-gray-800">${displayProducts.length}</div>
                            <div class="text-xs text-gray-600">Ürün</div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                (function() {
                    const orbit = document.getElementById('${uniqueId}');
                    if (!orbit) return;
                    const wrapper = orbit.querySelector('.orbit-wrapper');
                    const container = orbit.querySelector('.orbit-container');
                    const items = orbit.querySelectorAll('.orbit-item');
                    const totalItems = parseInt(orbit.getAttribute('data-total-items'));
                    
                    // Spiral pozisyonları (render sırasında hesaplanan)
                    const positions = ${JSON.stringify(positions)};
                    
                    let currentRotation = 0;
                    let currentZoom = 1;
                    let baseRotation = 0;
                    let baseZoom = 1;
                    
                    // Mouse pozisyonuna göre rotation ve zoom
                    wrapper.addEventListener('mousemove', function(e) {
                        const rect = wrapper.getBoundingClientRect();
                        const centerX_px = rect.left + rect.width / 2;
                        const centerY_px = rect.top + rect.height / 2;
                        
                        const mouseX = e.clientX - centerX_px;
                        const mouseY = e.clientY - centerY_px;
                        
                        // Mouse pozisyonuna göre açı hesapla (rotation)
                        const angle = Math.atan2(mouseY, mouseX);
                        const targetRotation = angle + Math.PI / 2;
                        const rotationSensitivity = 0.3;
                        currentRotation += (targetRotation - currentRotation) * rotationSensitivity;
                        
                        // Mouse merkeze uzaklığına göre zoom hesapla
                        const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
                        const maxDistance = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
                        const normalizedDistance = Math.min(distance / maxDistance, 1);
                        
                        // Uzaklığa göre zoom: merkeze yakın = zoom in, uzak = zoom out
                        const targetZoom = 0.7 + (1 - normalizedDistance) * 0.6; // 0.7x - 1.3x arası
                        const zoomSensitivity = 0.2;
                        currentZoom += (targetZoom - currentZoom) * zoomSensitivity;
                        
                        // Container'a rotation ve zoom uygula
                        container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                        
                        // Her ürünü spiral pozisyonuna göre güncelle (rotation ile birlikte)
                        items.forEach((item, index) => {
                            const pos = positions[index];
                            const rotatedAngle = pos.angle + currentRotation;
                            const rotatedRadius = pos.radius * currentZoom;
                            const x = 50 + rotatedRadius * Math.cos(rotatedAngle);
                            const y = 50 + rotatedRadius * Math.sin(rotatedAngle);
                            
                            // Merkeze uzaklığa göre scale ve opacity
                            const maxRadius = Math.max(...positions.map(p => p.radius));
                            const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                            const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                            
                            item.style.left = x + '%';
                            item.style.top = y + '%';
                            item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                            item.style.opacity = itemOpacity;
                        });
                    });
                    
                    // Mouse çıkınca başlangıç pozisyonuna dön
                    wrapper.addEventListener('mouseleave', function() {
                        const resetSpeed = 0.15;
                        const resetInterval = setInterval(() => {
                            const rotationDiff = Math.abs(currentRotation);
                            const zoomDiff = Math.abs(currentZoom - 1);
                            
                            if (rotationDiff < 0.01 && zoomDiff < 0.01) {
                                currentRotation = 0;
                                currentZoom = 1;
                                container.style.transform = 'rotate(0rad) scale(1)';
                                clearInterval(resetInterval);
                                
                                // Pozisyonları sıfırla
                                items.forEach((item, index) => {
                                    const pos = positions[index];
                                    const maxRadius = Math.max(...positions.map(p => p.radius));
                                    const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                                    const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                                    
                                    item.style.left = pos.x + '%';
                                    item.style.top = pos.y + '%';
                                    item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                                    item.style.opacity = itemOpacity;
                                });
                            } else {
                                currentRotation *= (1 - resetSpeed);
                                currentZoom += (1 - currentZoom) * resetSpeed;
                                container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                                
                                items.forEach((item, index) => {
                                    const pos = positions[index];
                                    const rotatedAngle = pos.angle + currentRotation;
                                    const rotatedRadius = pos.radius * currentZoom;
                                    const x = 50 + rotatedRadius * Math.cos(rotatedAngle);
                                    const y = 50 + rotatedRadius * Math.sin(rotatedAngle);
                                    const maxRadius = Math.max(...positions.map(p => p.radius));
                                    const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                                    const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                                    
                                    item.style.left = x + '%';
                                    item.style.top = y + '%';
                                    item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                                    item.style.opacity = itemOpacity;
                                });
                            }
                        }, 16);
                    });
                    
                    // Wheel ile zoom (Apple Watch Digital Crown benzeri)
                    wrapper.addEventListener('wheel', function(e) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -0.1 : 0.1;
                        baseZoom = Math.max(0.5, Math.min(2.0, baseZoom + delta));
                        currentZoom = baseZoom;
                        
                        container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                        
                        items.forEach((item, index) => {
                            const pos = positions[index];
                            const rotatedAngle = pos.angle + currentRotation;
                            const rotatedRadius = pos.radius * currentZoom;
                            const x = 50 + rotatedRadius * Math.cos(rotatedAngle);
                            const y = 50 + rotatedRadius * Math.sin(rotatedAngle);
                            const maxRadius = Math.max(...positions.map(p => p.radius));
                            const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                            const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                            
                            item.style.left = x + '%';
                            item.style.top = y + '%';
                            item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                            item.style.opacity = itemOpacity;
                        });
                    });
                    
                    // Touch desteği (pinch to zoom)
                    let touchStartDistance = 0;
                    let touchStartZoom = 1;
                    
                    wrapper.addEventListener('touchstart', function(e) {
                        if (e.touches.length === 2) {
                            const touch1 = e.touches[0];
                            const touch2 = e.touches[1];
                            touchStartDistance = Math.sqrt(
                                Math.pow(touch2.clientX - touch1.clientX, 2) +
                                Math.pow(touch2.clientY - touch1.clientY, 2)
                            );
                            touchStartZoom = currentZoom;
                        } else if (e.touches.length === 1) {
                            const rect = wrapper.getBoundingClientRect();
                            const centerX_px = rect.left + rect.width / 2;
                            const centerY_px = rect.top + rect.height / 2;
                            
                            const touchX = e.touches[0].clientX - centerX_px;
                            const touchY = e.touches[0].clientY - centerY_px;
                            const touchAngle = Math.atan2(touchY, touchX);
                            baseRotation = touchAngle + Math.PI / 2 - currentRotation;
                        }
                    });
                    
                    wrapper.addEventListener('touchmove', function(e) {
                        e.preventDefault();
                        
                        if (e.touches.length === 2) {
                            // Pinch to zoom
                            const touch1 = e.touches[0];
                            const touch2 = e.touches[1];
                            const currentDistance = Math.sqrt(
                                Math.pow(touch2.clientX - touch1.clientX, 2) +
                                Math.pow(touch2.clientY - touch1.clientY, 2)
                            );
                            const zoomFactor = currentDistance / touchStartDistance;
                            currentZoom = Math.max(0.5, Math.min(2.0, touchStartZoom * zoomFactor));
                            
                            container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                        } else if (e.touches.length === 1) {
                            // Rotation
                            const rect = wrapper.getBoundingClientRect();
                            const centerX_px = rect.left + rect.width / 2;
                            const centerY_px = rect.top + rect.height / 2;
                            
                            const touchX = e.touches[0].clientX - centerX_px;
                            const touchY = e.touches[0].clientY - centerY_px;
                            const currentAngle = Math.atan2(touchY, touchX);
                            currentRotation = currentAngle + Math.PI / 2 - baseRotation;
                            
                            container.style.transform = 'rotate(' + currentRotation + 'rad) scale(' + currentZoom + ')';
                        }
                        
                        // Pozisyonları güncelle
                        items.forEach((item, index) => {
                            const pos = positions[index];
                            const rotatedAngle = pos.angle + currentRotation;
                            const rotatedRadius = pos.radius * currentZoom;
                            const x = 50 + rotatedRadius * Math.cos(rotatedAngle);
                            const y = 50 + rotatedRadius * Math.sin(rotatedAngle);
                            const maxRadius = Math.max(...positions.map(p => p.radius));
                            const itemScale = 0.5 + (1 - pos.radius / maxRadius) * 0.5;
                            const itemOpacity = 0.6 + (1 - pos.radius / maxRadius) * 0.4;
                            
                            item.style.left = x + '%';
                            item.style.top = y + '%';
                            item.style.transform = 'translate(-50%, -50%) scale(' + itemScale + ')';
                            item.style.opacity = itemOpacity;
                        });
                    });
                })();
            </script>
        </div>
    `;
};

AdminPanel.prototype.renderPreviewContent = function() {
    if (!this.previewState || !this.previewState.steps || this.previewState.steps.length === 0) {
        return '<div class="p-6">Güncelleme yükleniyor...</div>';
    }

    const steps = this.previewState.steps;
    const currentStep = steps[this.previewState.currentStepIndex];
    const totalSteps = steps.length;
    const progress = ((this.previewState.currentStepIndex + 1) / totalSteps) * 100;

    // Use green gradient for update notifications (same as user side)
    const stepColor = 'from-green-500 to-emerald-600';
    
    // Product update JSON'unu kontrol et
    const productUpdateData = this.parseProductUpdateJSON(currentStep.description);
    const hasProductUpdate = productUpdateData !== null;
    const productUpdateProducts = hasProductUpdate ? productUpdateData.products : null;
    const displayType = hasProductUpdate ? (productUpdateData.display_type || 'grid') : 'grid';
    
    // Description'dan JSON'u çıkar (eğer varsa)
    let displayDescription = currentStep.description || '';
    if (hasProductUpdate) {
        // JSON'u description'dan çıkar, sadece diğer text'i göster
        try {
            const jsonMatch = displayDescription.match(/\{[\s\S]*"type"\s*:\s*"product_update"[\s\S]*\}/);
            if (jsonMatch) {
                displayDescription = displayDescription.replace(jsonMatch[0], '').trim();
            }
        } catch (e) {
            // Hata durumunda tüm description'ı göster
        }
    }

    return `
        <div class="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div class="flex flex-col h-full min-h-0">
                <!-- Header -->
                <div class="bg-gradient-to-r ${stepColor} text-white py-3 px-4 flex-shrink-0">
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <h2 class="text-xl font-bold">${this.previewState.title}</h2>
                            ${this.previewState.description ? `<p class="text-white opacity-90 mt-0.5 text-sm">${this.previewState.description}</p>` : ''}
                        </div>
                        <button id="closePreviewModalBtn" class="text-white hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-white hover:bg-opacity-20">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <!-- Progress Bar -->
                    <div class="w-full bg-white bg-opacity-30 rounded-full h-1.5">
                        <div class="bg-white rounded-full h-1.5 transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                    <div class="text-xs text-white opacity-90 mt-1">
                        Adım ${this.previewState.currentStepIndex + 1} / ${totalSteps}
                    </div>
                </div>

                <!-- Step Content -->
                <div class="flex-1 overflow-y-auto p-6 min-h-0">
                    <div class="flex items-start space-x-4 mb-6">
                        <div class="text-5xl">${currentStep.icon || '🚀'}</div>
                        <div class="flex-1">
                            <h3 class="text-2xl font-bold text-gray-900 mb-3">${currentStep.title || 'Adım ' + (this.previewState.currentStepIndex + 1)}</h3>
                            ${displayDescription ? `<p class="text-gray-700 text-lg leading-relaxed whitespace-pre-line mb-4">${displayDescription}</p>` : ''}
                            ${hasProductUpdate ? this.renderProductUpdate(productUpdateProducts, false, displayType) : ''}
                        </div>
                    </div>
                    
                    ${currentStep.image_url ? this.renderMediaContent(currentStep) : ''}
                </div>
                
                <script>
                    // Video autoplay için ek script
                    setTimeout(() => {
                        const videos = document.querySelectorAll('#previewContent video');
                        videos.forEach(video => {
                            video.setAttribute('autoplay', '');
                            video.setAttribute('loop', '');
                            video.setAttribute('muted', '');
                            video.setAttribute('playsinline', '');
                            video.muted = true;
                            video.loop = true;
                            video.play().catch(e => {
                                console.log('Video autoplay prevented:', e);
                            });
                        });
                    }, 100);
                </script>

                <!-- Footer Navigation -->
                <div class="border-t border-gray-200 py-3 px-4 bg-gray-50 flex-shrink-0">
                    <!-- Step Dots Indicator -->
                    <div class="flex items-center justify-center space-x-2 mb-3">
                        ${steps.map((_, index) => `
                            <div class="w-2.5 h-2.5 rounded-full transition-all ${
                                index === this.previewState.currentStepIndex 
                                    ? 'bg-green-600 scale-125' 
                                    : index < this.previewState.currentStepIndex 
                                        ? 'bg-green-400' 
                                        : 'bg-gray-300'
                            }"></div>
                        `).join('')}
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <button id="previewPrevStepBtn" 
                                class="flex items-center space-x-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-400 transition-colors ${this.previewState.currentStepIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                                ${this.previewState.currentStepIndex === 0 ? 'disabled' : ''}>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                            </svg>
                            <span>Geri</span>
                        </button>
                        
                        ${this.previewState.currentStepIndex === totalSteps - 1 ? `
                            <button id="previewCompleteBtn" 
                                    class="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg">
                                ✅ Tamam
                            </button>
                        ` : `
                            <button id="previewNextStepBtn" 
                                    class="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-emerald-700 transition-all">
                                <span>İleri</span>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
};

AdminPanel.prototype.isGoogleDriveUrl = function(url) {
    if (!url) return false;
    return url.includes('drive.google.com');
};

AdminPanel.prototype.isCloudinaryUrl = function(url) {
    if (!url) return false;
    return url.includes('res.cloudinary.com');
};

// Detect Google Drive file type (video/image) via backend API
AdminPanel.prototype.detectDriveFileKind = async function(fileId) {
    if (!fileId) {
        return { kind: 'unknown', contentType: null };
    }

    try {
        const res = await fetch(`/api/gdrive/meta?fileId=${encodeURIComponent(fileId)}`);
        
        if (!res.ok) {
            console.warn('Failed to detect file kind:', res.status);
            return { kind: 'unknown', contentType: null };
        }

        const data = await res.json();
        
        return {
            kind: data.kind || 'unknown',
            contentType: data.contentType || null
        };
    } catch (error) {
        console.error('Error detecting drive file kind:', error);
        return { kind: 'unknown', contentType: null };
    }
};

// Cloudinary Upload Function
AdminPanel.prototype.uploadToCloudinary = async function(file, stepIndex) {
    const cloudName = this.getCloudinaryCloudName();
    const uploadPreset = this.getCloudinaryUploadPreset();
    
    if (!cloudName || !uploadPreset) {
        alert('⚠️ Cloudinary ayarları eksik! Lütfen Sistem Ayarları\'ndan Cloud Name ve Upload Preset bilgilerini girin.\n\nAPI Key opsiyoneldir, gerekli değil.');
        return null;
    }
    
    // Check file size limits
    const maxImageSize = 10 * 1024 * 1024; // 10 MB
    const maxVideoSize = 100 * 1024 * 1024; // 100 MB
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? maxVideoSize : maxImageSize;
    
    if (file.size > maxSize) {
        const maxSizeMB = isVideo ? 100 : 10;
        alert(`❌ Dosya çok büyük! Maksimum boyut: ${maxSizeMB} MB\n\nDosya boyutu: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        return null;
    }
    
    // Show upload progress
    const progressIndicator = document.getElementById(`uploadProgress_${stepIndex}`);
    if (progressIndicator) {
        progressIndicator.classList.remove('hidden');
        progressIndicator.innerHTML = '<span class="text-blue-600">⏳ Yükleniyor...</span>';
    }
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', 'updates');
        
        // Determine resource type
        const isVideo = file.type.startsWith('video/');
        const resourceType = isVideo ? 'video' : 'image';
        
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
        
        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Hide progress indicator
        if (progressIndicator) {
            progressIndicator.classList.add('hidden');
        }
        
        // Return Cloudinary URL
        return data.secure_url;
        
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        
        // Hide progress indicator
        if (progressIndicator) {
            progressIndicator.classList.add('hidden');
        }
        
        alert(`❌ Yükleme hatası: ${error.message}`);
        return null;
    }
};

// Handle File Upload
AdminPanel.prototype.handleFileUpload = async function(stepIndex, file) {
    if (!file) return;
    
    const uploadedUrl = await this.uploadToCloudinary(file, stepIndex);
    
    if (uploadedUrl) {
        // Determine if it's a video (before updating step)
        const isVideo = file.type.startsWith('video/');
        
        // Update step image_url
        if (this.currentUpdateSteps[stepIndex]) {
            this.currentUpdateSteps[stepIndex].image_url = uploadedUrl;
            this.currentUpdateSteps[stepIndex].is_video = isVideo;
        }
        
        // Update input field
        const input = document.getElementById(`stepImageInput_${stepIndex}`);
        if (input) {
            input.value = uploadedUrl;
        }
        
        // Show success indicator
        const indicator = document.getElementById(`mediaTypeIndicator_${stepIndex}`);
        if (indicator) {
            indicator.classList.remove('hidden');
            if (isVideo) {
                indicator.innerHTML = '<span class="text-green-600">✅ Video yüklendi</span>';
            } else {
                indicator.innerHTML = '<span class="text-green-600">✅ Görsel yüklendi</span>';
            }
            
            setTimeout(() => {
                indicator.classList.add('hidden');
            }, 2000);
        }
        
        // Refresh preview if modal is open
        const previewContent = document.getElementById('previewContent');
        if (previewContent) {
            previewContent.innerHTML = this.renderPreviewContent();
            this.setupPreviewVideoAutoplay();
        }
    }
};

AdminPanel.prototype.detectDriveMediaType = async function(url) {
    if (!this.isGoogleDriveUrl(url)) {
        // Not a Google Drive URL, try to detect from extension
        const urlLower = url.toLowerCase();
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
        const isVideo = videoExtensions.some(ext => urlLower.includes(ext)) || 
                       urlLower.includes('video') ||
                       urlLower.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i);
        return isVideo ? 'video' : 'image';
    }

    const fileId = this.extractGoogleDriveFileId(url);
    if (!fileId) {
        console.warn('⚠️ Could not extract Google Drive file ID');
        return 'video'; // Google Drive linklerini varsayılan olarak video kabul et
    }

    // Google Drive linklerini varsayılan olarak video kabul et
    // Video yüklenemezse Safe Player fallback mekanizması devreye girecek
    return 'video';
};

AdminPanel.prototype.handleImageUrlChange = async function(stepIndex, url) {
    if (!url || !url.trim()) {
        // Clear the media type indicator
        const indicator = document.getElementById(`mediaTypeIndicator_${stepIndex}`);
        if (indicator) {
            indicator.classList.add('hidden');
        }
        return;
    }

    // Show checking indicator
    const indicator = document.getElementById(`mediaTypeIndicator_${stepIndex}`);
    if (indicator) {
        indicator.classList.remove('hidden');
        indicator.innerHTML = '<span class="text-blue-600">🔍 Algılanıyor...</span>';
    }

    try {
        // Check if it's a Google Drive URL
        const isDrive = this.isGoogleDriveUrl(url);
        
        if (isDrive) {
            // Extract file ID and detect type via backend API
            const fileId = this.extractGoogleDriveFileId(url);
            if (fileId) {
                const { kind } = await this.detectDriveFileKind(fileId);
                
                // Update step state
                if (this.currentUpdateSteps[stepIndex]) {
                    this.currentUpdateSteps[stepIndex].is_video = (kind === 'video');
                }

                // Update indicator
                if (indicator) {
                    if (kind === 'video') {
                        indicator.innerHTML = '<span class="text-green-600">✅ Video algılandı</span>';
                    } else if (kind === 'image') {
                        indicator.innerHTML = '<span class="text-purple-600">🖼️ Görsel algılandı</span>';
                    } else {
                        indicator.innerHTML = '<span class="text-gray-500">⚠️ Algılanamadı</span>';
                    }
                    
                    // Hide after 2 seconds
                    setTimeout(() => {
                        indicator.classList.add('hidden');
                    }, 2000);
                }
                return;
            }
        }
        
        // For non-Drive URLs, use existing detection
        const mediaType = await this.detectDriveMediaType(url);
        
        // Update step state
        if (this.currentUpdateSteps[stepIndex]) {
            this.currentUpdateSteps[stepIndex].is_video = (mediaType === 'video');
        }

        // Update indicator
        if (indicator) {
            if (mediaType === 'video') {
                indicator.innerHTML = '<span class="text-green-600">✅ Video algılandı</span>';
            } else {
                indicator.innerHTML = '<span class="text-purple-600">🖼️ Görsel algılandı</span>';
            }
            
            // Hide after 2 seconds
            setTimeout(() => {
                indicator.classList.add('hidden');
            }, 2000);
        }
    } catch (error) {
        console.error('Error detecting media type:', error);
        if (indicator) {
            indicator.innerHTML = '<span class="text-gray-500">⚠️ Algılanamadı</span>';
            setTimeout(() => {
                indicator.classList.add('hidden');
            }, 2000);
        }
    }
};

AdminPanel.prototype.extractGoogleDriveFileId = function(url) {
    if (!url) return null;
    
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /\/uc\?id=([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
};

AdminPanel.prototype.convertGoogleDriveUrl = function(url, isVideo) {
    if (!this.isGoogleDriveUrl(url)) {
        return url;
    }

    const fileId = this.extractGoogleDriveFileId(url);
    if (!fileId) {
        console.warn('⚠️ Could not extract Google Drive file ID from:', url);
        return url;
    }

    if (isVideo) {
        // Google Drive video için embed linki kullan
        // Bu link video tag'inde çalışır
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    } else {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
};

AdminPanel.prototype.renderMediaContent = function(step) {
    if (!step.image_url) return '';
    
    const originalUrl = step.image_url;
    const url = originalUrl.toLowerCase();
    const isDriveUrl = this.isGoogleDriveUrl(originalUrl);
    const isCloudinaryUrl = this.isCloudinaryUrl(originalUrl);
    
    // isVideo: önce step.is_video flag'i, sonra URL kontrolü
    let isVideo = step.is_video === true || step.is_video === 'true';
    
    if (!isVideo && !isDriveUrl && !isCloudinaryUrl) {
        // Drive ve Cloudinary dışı URL'ler için uzantı kontrolü
        isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg') || 
                  url.endsWith('.mov') || url.endsWith('.avi') || url.endsWith('.mkv') ||
                  url.endsWith('.flv') || url.endsWith('.wmv') || url.includes('video') ||
                  url.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i);
    }
    
    // Cloudinary URL'lerini kontrol et
    if (isCloudinaryUrl && !isVideo) {
        isVideo = originalUrl.includes('/video/upload/');
    }
    
    // Google Drive URL'ini dönüştür
    let mediaUrl = originalUrl;
    if (isDriveUrl) {
        mediaUrl = this.convertGoogleDriveUrl(originalUrl, isVideo);
    }

    const containerId = 'media-container-' + Math.random().toString(36).substr(2, 9);

    if (isVideo) {
        let videoUrl = mediaUrl;
        let imageUrl = mediaUrl;
        let fileId = '';
        
        // For Google Drive videos, use proxy endpoint
        if (isDriveUrl) {
            fileId = this.extractGoogleDriveFileId(originalUrl);
            if (fileId) {
                videoUrl = `/api/gdrive/video?fileId=${encodeURIComponent(fileId)}`;
                imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
            }
        } else if (isCloudinaryUrl) {
            // Cloudinary video - orijinal URL'i kullan
            // Loop HTML5 video tag'inde yapılacak, transform gerekmez
            videoUrl = originalUrl;
            // Poster için - video URL'ini kullan (tarayıcı otomatik poster oluşturur)
            imageUrl = videoUrl;
        }
        
        const uniqueId = fileId || Math.random().toString(36).substr(2, 9);
        return `
            <div class="mt-6" id="${containerId}">
                <video 
                    id="preview-video-${uniqueId}"
                    src="${videoUrl}" 
                    poster="${imageUrl}"
                    class="w-full rounded-lg preview-video"
                    style="filter: none; opacity: 1; background: transparent; object-fit: contain; pointer-events: none; width: 100%; border-radius: 8px;"
                    autoplay
                    loop
                    muted
                    playsinline
                    preload="auto"
                    disablePictureInPicture
                    controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
                    oncontextmenu="return false;"
                    onended="this.currentTime=0;this.play()"
                    onerror="this.style.display='none';const img=this.nextElementSibling;if(img){img.style.display='block';}">
                    Tarayıcınız video oynatmayı desteklemiyor.
                </video>
                <img 
                    id="preview-fallback-${uniqueId}"
                    src="${imageUrl}" 
                    alt="${step.title || 'Görsel'}" 
                    class="w-full rounded-lg"
                    style="display: none; width: 100%; border-radius: 8px;"
                    onerror="this.onerror=null;this.src='${originalUrl}';">
                <script>
                    (function() {
                        const video = document.getElementById('preview-video-${uniqueId}');
                        if (video) {
                            video.addEventListener('ended', function() {
                                this.currentTime = 0;
                                this.play().catch(() => {});
                            });
                            video.controls = false;
                            video.removeAttribute('controls');
                            // Force autoplay
                            video.play().catch(() => {});
                        }
                    })();
                </script>
            </div>
        `;
    } else {
        // Resim veya belirsiz (Google Drive linki ama video flag yok)
        // Fallback mekanizması: Önce resim olarak dene, hata verirse videoya çevir
        
        // Video player template'i (string olarak sakla, hata durumunda kullanacağız)
        let videoFallbackHtml = '';
        if (isDriveUrl) {
            const fileId = this.extractGoogleDriveFileId(originalUrl);
            if (fileId) {
                const videoUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                // Video HTML stringini oluştur (escape edilmiş tırnaklara dikkat)
                videoFallbackHtml = `<video src="${videoUrl}" class="w-full rounded-lg preview-video" style="filter: none; opacity: 1; background: transparent; object-fit: contain; pointer-events: none;" autoplay muted playsinline preload="auto" disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback" oncontextmenu="return false;" onended="this.currentTime=0; this.play();"></video>`;
            }
        }

        return `
            <div class="mt-6" id="${containerId}">
                <img src="${mediaUrl}" alt="${step.title || 'Görsel'}" 
                     class="w-full rounded-lg"
                     onerror="
                        console.log('Gorsel yuklenemedi, video olarak deneniyor...');
                        const container = document.getElementById('${containerId}');
                        if (container && '${videoFallbackHtml}') {
                            container.innerHTML = '${videoFallbackHtml}';
                            const video = container.querySelector('video');
                            if (video) {
                                video.addEventListener('ended', function() { this.currentTime = 0; this.play().catch(() => {}); });
                                video.controls = false;
                                video.play().catch(() => {});
                            }
                        } else {
                            this.onerror = null; 
                            this.src='${originalUrl}';
                        }
                     ">
            </div>
        `;
    }
};

const ADMIN_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

function emptyAdminSettingsRow() {
    return {
        id: ADMIN_SETTINGS_ID,
        telegram_bot_token: null,
        telegram_chat_id: null,
        gemini_api_key: null,
        cloudinary_cloud_name: null,
        cloudinary_api_key: null,
        cloudinary_upload_preset: null,
        updated_at: null,
    };
}

AdminPanel.prototype.getAdminSettingsRow = async function(forceRefresh = false) {
    if (this._adminSettingsTableMissing) {
        return emptyAdminSettingsRow();
    }

    if (this.adminSettings && !forceRefresh) {
        return this.adminSettings;
    }

    if (!window.supabase) {
        return null;
    }

    // admin_settings tablosu tarayıcıya TAMAMEN kapalı (içinde Telegram bot
    // token'ı, Gemini ve Cloudinary anahtarları var). API üzerinden okunur ve
    // API sırların DEĞERİNİ döndürmez — yalnızca "tanımlı mı" bilgisini verir.
    const _api = window.jetbarkodAuth;
    if (!_api || !_api.apiBase()) {
        return emptyAdminSettingsRow();
    }

    try {
        const _res = await _api.apiFetch('/api/admin/settings', { method: 'GET' });
        if (!_res.ok) {
            console.error('Admin ayarları alınamadı:', _res.status);
            return emptyAdminSettingsRow();
        }
        const _d = await _res.json();
        this.adminSettings = {
            id: ADMIN_SETTINGS_ID,
            telegram_chat_id: _d.telegram_chat_id || '',
            cloudinary_cloud_name: _d.cloudinary_cloud_name || '',
            cloudinary_upload_preset: _d.cloudinary_upload_preset || '',
            // Sırlar geri gelmez; yalnızca tanımlı olup olmadıkları bilinir.
            _configured: _d.configured || {},
            telegram_bot_token: '',
            gemini_api_key: '',
            cloudinary_api_key: ''
        };
        return this.adminSettings;
    } catch (e) {
        console.error('Admin ayarları alınamadı:', e);
        return emptyAdminSettingsRow();
    }
};

AdminPanel.prototype.getGeminiApiKey = function() {
    return (this.adminSettings && this.adminSettings.gemini_api_key) || '';
};

AdminPanel.prototype.setGeminiApiKey = function(apiKey) {
    this.adminSettings = {
        ...(this.adminSettings || {}),
        gemini_api_key: apiKey
    };
};

// Cloudinary Settings
AdminPanel.prototype.getCloudinaryCloudName = function() {
    return (this.adminSettings && this.adminSettings.cloudinary_cloud_name) || '';
};

AdminPanel.prototype.setCloudinaryCloudName = function(cloudName) {
    this.adminSettings = {
        ...(this.adminSettings || {}),
        cloudinary_cloud_name: cloudName
    };
};

AdminPanel.prototype.getCloudinaryApiKey = function() {
    return (this.adminSettings && this.adminSettings.cloudinary_api_key) || '';
};

AdminPanel.prototype.setCloudinaryApiKey = function(apiKey) {
    this.adminSettings = {
        ...(this.adminSettings || {}),
        cloudinary_api_key: apiKey
    };
};

AdminPanel.prototype.getCloudinaryUploadPreset = function() {
    return (this.adminSettings && this.adminSettings.cloudinary_upload_preset) || '';
};

AdminPanel.prototype.setCloudinaryUploadPreset = function(preset) {
    this.adminSettings = {
        ...(this.adminSettings || {}),
        cloudinary_upload_preset: preset
    };
};

AdminPanel.prototype.loadAdminSettings = async function() {
    try {
        const settings = await this.getAdminSettingsRow(true);

        const apiKeyInput = document.getElementById('geminiApiKey');
        if (apiKeyInput) {
            apiKeyInput.value = settings?.gemini_api_key || '';
        }

        const cloudNameInput = document.getElementById('cloudinaryCloudName');
        if (cloudNameInput) {
            cloudNameInput.value = settings?.cloudinary_cloud_name || '';
        }

        const cloudinaryApiKeyInput = document.getElementById('cloudinaryApiKey');
        if (cloudinaryApiKeyInput) {
            cloudinaryApiKeyInput.value = settings?.cloudinary_api_key || '';
        }

        const uploadPresetInput = document.getElementById('cloudinaryUploadPreset');
        if (uploadPresetInput) {
            uploadPresetInput.value = settings?.cloudinary_upload_preset || '';
        }

        // Sırlar sunucudan geri GELMEZ. Alanı boş bırakıp "kayıtlı" bilgisini
        // placeholder ile gösteriyoruz; boş kaydedilirse mevcut değer korunur.
        const cfg = settings?._configured || {};

        const telegramTokenInput = document.getElementById('telegramBotToken');
        if (telegramTokenInput) {
            telegramTokenInput.value = '';
            telegramTokenInput.placeholder = cfg.telegram_bot_token
                ? '•••••••• kayıtlı — değiştirmek için yeni token girin'
                : 'Bot token girin';
        }

        const telegramChatInput = document.getElementById('telegramChatId');
        if (telegramChatInput) {
            telegramChatInput.value = settings?.telegram_chat_id || '';
        }

        applySecretPlaceholder('geminiApiKey', cfg.gemini_api_key);
        applySecretPlaceholder('cloudinaryApiKey', cfg.cloudinary_api_key);

        // DİKKAT: token değeri hiç dönmediği için "dolu mu" kontrolü
        // _configured bayrağına bakmalı, alanın kendisine değil.
        const testBtn = document.getElementById('sendTelegramTestBtn');
        if (testBtn) {
            testBtn.disabled = !(cfg.telegram_bot_token && settings?.telegram_chat_id);
        }

        return settings;
    } catch (error) {
        console.error('Admin ayarları yüklenirken hata:', error);
        return null;
    }
};

/** Kayıtlı bir sır alanını boş bırakıp durumunu placeholder'da gösterir. */
function applySecretPlaceholder(elementId, isConfigured) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.value = '';
    el.placeholder = isConfigured
        ? '•••••••• kayıtlı — değiştirmek için yeni değer girin'
        : '';
}

AdminPanel.prototype.saveAdminSettings = async function() {
    try {
        const api = window.jetbarkodAuth;
        if (!api || !api.apiBase()) {
            alert('API yapılandırması bulunamadı.');
            return;
        }

        // Sır alanları BOŞ bırakılırsa sunucu mevcut değeri korur; böylece
        // admin, token'ı ekranda görmeden diğer ayarları kaydedebilir.
        const payload = {
            gemini_api_key: document.getElementById('geminiApiKey')?.value.trim() || '',
            cloudinary_cloud_name: document.getElementById('cloudinaryCloudName')?.value.trim() || '',
            cloudinary_api_key: document.getElementById('cloudinaryApiKey')?.value.trim() || '',
            cloudinary_upload_preset: document.getElementById('cloudinaryUploadPreset')?.value.trim() || '',
            telegram_bot_token: document.getElementById('telegramBotToken')?.value.trim() || '',
            telegram_chat_id: document.getElementById('telegramChatId')?.value.trim() || ''
        };

        const res = await api.apiFetch('/api/admin/settings', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('Admin ayarları kaydedilemedi:', res.status);
            alert('Ayarlar kaydedilemedi, lütfen tekrar deneyin.');
            return;
        }

        // Önbelleği düşür ki tazeleme sunucuya gitsin
        this.adminSettings = null;
        await this.loadAdminSettings();

        alert('Ayarlar kaydedildi.');
    } catch (error) {
        console.error('Admin ayarları kaydedilirken hata:', error);
    }
};

AdminPanel.prototype.sendTelegramTestMessage = async function() {
    try {
        const settings = await this.getAdminSettingsRow(true);
        // Token değeri sunucudan hiç dönmez; kayıtlı olup olmadığına bakılır.
        if (!settings?._configured?.telegram_bot_token || !settings?.telegram_chat_id) {
            alert('Önce Telegram Bot Token ve Chat ID girip kaydedin.');
            return;
        }

        const cfg = window.JETBARKOD_VPS_API || {};
        const baseUrl = (cfg.baseUrl || '').replace(/\/$/, '');
        if (!baseUrl) throw new Error('API adresi tanımlı değil.');
        const endpoint = `${baseUrl}/api/telegram/notify`;

        const headers = { 'Content-Type': 'application/json' };
        const adminToken = window.jetbarkodAuth?.get?.();
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: 'Test başarılı!',
                isTest: true
            })
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(detail || 'Telegram test mesajı gönderilemedi');
        }

        const data = await response.json().catch(() => ({}));
        if (data.skipped) {
            throw new Error('Telegram ayarları eksik. Token ve Chat ID kayıtlı mı kontrol edin.');
        }

        console.log('✅ Telegram test mesajı gönderildi');
        alert('Test mesajı Telegram botuna gönderildi.');
    } catch (error) {
        console.error('Telegram test mesajı hatası:', error);
        alert('Test mesajı gönderilemedi: ' + error.message);
    }
};

AdminPanel.prototype.callGeminiAI = async function(userText) {
    try {
        const apiKey = this.getGeminiApiKey();
        
        if (!apiKey) {
            throw new Error('Gemini API Key bulunamadı! Lütfen Admin Panel → Ayarlar bölümünden API key\'inizi girin.');
        }

        if (!userText || userText.trim().length === 0) {
            throw new Error('Lütfen güncelleme içeriğini girin!');
        }

        const prompt = `Sen bir yazılım güncelleme notları oluşturma asistanısın. Kullanıcının verdiği ham metni analiz et ve aşağıdaki JSON formatında yanıt ver. SADECE JSON döndür, başka hiçbir metin ekleme.

Kurallar:
1. title: Güncelleme için çekici ve kısa bir başlık (maksimum 100 karakter)
2. description: Kısa ve net bir açıklama (maksimum 200 karakter)
3. steps: Güncelleme adımlarını içeren bir array. Adım sayısı kullanıcının metnine göre dinamik olmalı.
   - step_title: Adım başlığı (kısa ve açıklayıcı)
   - step_description: Adım açıklaması (detaylı)
   - icon: İçeriğe en uygun TEK bir emoji karakter (sadece emoji, başka karakter yok)
   - color: purple, pink, blue, green, orange, red, indigo, teal arasından içeriğe uygun olanı
   - image_url: Her zaman boş string ""

Kullanıcı metni:
${userText}

Yanıt formatı (SADECE JSON):
{
  "title": "...",
  "description": "...",
  "steps": [
    {
      "step_title": "...",
      "step_description": "...",
      "icon": "🚀",
      "color": "purple",
      "image_url": ""
    }
  ]
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Hatası: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
            throw new Error('AI yanıtı beklenmeyen formatta!');
        }

        const responseText = data.candidates[0].content.parts[0].text.trim();
        
        // JSON'u extract et (eğer markdown code block içindeyse)
        let jsonText = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1];
        } else {
            // Eğer code block yoksa, sadece JSON'u bul
            const jsonStart = responseText.indexOf('{');
            const jsonEnd = responseText.lastIndexOf('}') + 1;
            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                jsonText = responseText.substring(jsonStart, jsonEnd);
            }
        }

        const result = JSON.parse(jsonText);
        
        // Validate result
        if (!result.title || !result.steps || !Array.isArray(result.steps)) {
            throw new Error('AI yanıtı geçersiz format!');
        }

        return result;
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
};

AdminPanel.prototype.fillFormFromAI = function(aiResult) {
    try {
        // Fill title and description
        const titleInput = document.getElementById('updateTitle');
        const descriptionInput = document.getElementById('updateDescription');
        
        if (titleInput) {
            titleInput.value = aiResult.title || '';
        }
        
        if (descriptionInput) {
            descriptionInput.value = aiResult.description || '';
        }

        // Clear existing steps
        this.currentUpdateSteps = [];
        
        // Create steps from AI result
        if (aiResult.steps && Array.isArray(aiResult.steps)) {
            this.currentUpdateSteps = aiResult.steps.map(step => ({
                title: step.step_title || '',
                description: step.step_description || '',
                icon: step.icon || '🚀',
                color: step.color || 'purple',
                image_url: step.image_url || '',
                is_video: step.is_video || false
            }));
        }

        // Render steps
        this.renderSteps();
        
        console.log('✅ Form filled from AI result:', {
            title: aiResult.title,
            stepsCount: this.currentUpdateSteps.length
        });
    } catch (error) {
        console.error('Error filling form from AI:', error);
        throw new Error('Form doldurulurken hata oluştu: ' + error.message);
    }
};

AdminPanel.prototype.openGeminiModal = function() {
    const modal = document.getElementById('geminiInputModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Clear previous input
        const input = document.getElementById('geminiInputText');
        if (input) {
            input.value = '';
        }
        // Hide error state
        const errorState = document.getElementById('geminiErrorState');
        if (errorState) {
            errorState.classList.add('hidden');
        }
        // Focus input
        setTimeout(() => {
            if (input) {
                input.focus();
            }
        }, 100);
    }
};

AdminPanel.prototype.closeGeminiModal = function() {
    const modal = document.getElementById('geminiInputModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

AdminPanel.prototype.generateWithGemini = async function() {
    const inputText = document.getElementById('geminiInputText')?.value.trim();
    const loadingState = document.getElementById('geminiLoadingState');
    const errorState = document.getElementById('geminiErrorState');
    const errorText = document.getElementById('geminiErrorText');
    const generateBtn = document.getElementById('generateGeminiBtn');
    
    if (!inputText) {
        alert('Lütfen güncelleme içeriğini girin!');
        return;
    }

    // Show loading
    if (loadingState) loadingState.classList.remove('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (generateBtn) generateBtn.disabled = true;

    try {
        const aiResult = await this.callGeminiAI(inputText);
        
        // Fill form
        this.fillFormFromAI(aiResult);
        
        // Close modal
        this.closeGeminiModal();
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg z-50 shadow-lg';
        successMsg.textContent = '✅ Güncelleme başarıyla oluşturuldu!';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
        
    } catch (error) {
        console.error('Gemini generation error:', error);
        
        // Show error
        if (errorState) {
            errorState.classList.remove('hidden');
        }
        if (errorText) {
            errorText.textContent = error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.';
        }
    } finally {
        // Hide loading
        if (loadingState) loadingState.classList.add('hidden');
        if (generateBtn) generateBtn.disabled = false;
    }
};

AdminPanel.prototype.setupPreviewVideoAutoplay = function() {
    setTimeout(() => {
        const previewContent = document.getElementById('previewContent');
        if (!previewContent) return;
        
        const videos = previewContent.querySelectorAll('video.preview-video');
        videos.forEach(video => {
            // GIF gibi davranması için tüm kontrolleri kapat
            video.removeAttribute('controls');
            video.setAttribute('autoplay', '');
            video.setAttribute('muted', '');
            video.setAttribute('playsinline', '');
            video.setAttribute('preload', 'auto');
            video.setAttribute('disablePictureInPicture', '');
            video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
            
            // Set properties
            video.muted = true;
            video.controls = false;
            
            // Loop için event listener (loop attribute yerine manuel kontrol - daha güvenilir)
            video.addEventListener('ended', function() {
                this.currentTime = 0;
                this.play().catch(() => {});
            }, { once: false });
            
            // Video yüklenene kadar bekle, sonra oynat (load() çağrısını kaldırdık - play() ile çakışıyor)
            const tryPlay = () => {
                if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            // Sessizce hata yok say (tarayıcı politikaları)
                        });
                    }
                } else {
                    // Video henüz yüklenmedi, bekle
                    video.addEventListener('loadeddata', tryPlay, { once: true });
                    video.addEventListener('canplay', tryPlay, { once: true });
                }
            };
            
            // Video zaten yüklenmişse hemen oynat
            if (video.readyState >= 2) {
                tryPlay();
            } else {
                video.addEventListener('loadeddata', tryPlay, { once: true });
                video.addEventListener('canplay', tryPlay, { once: true });
            }
        });
    }, 200);
};

AdminPanel.prototype.attachPreviewListeners = function() {
    const previewModal = document.getElementById('previewModal');
    
    // Close button
    const closeBtn = previewModal.querySelector('#closePreviewModalBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            previewModal.classList.add('hidden');
        });
    }

    // Previous button
    const prevBtn = previewModal.querySelector('#previewPrevStepBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (this.previewState.currentStepIndex > 0) {
                this.previewState.currentStepIndex--;
                const previewContent = document.getElementById('previewContent');
                previewContent.innerHTML = this.renderPreviewContent();
                this.attachPreviewListeners();
                // Setup video autoplay after step change
                this.setupPreviewVideoAutoplay();
            }
        });
    }

    // Next button
    const nextBtn = previewModal.querySelector('#previewNextStepBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (this.previewState.currentStepIndex < this.previewState.steps.length - 1) {
                this.previewState.currentStepIndex++;
                const previewContent = document.getElementById('previewContent');
                previewContent.innerHTML = this.renderPreviewContent();
                this.attachPreviewListeners();
                // Setup video autoplay after step change
                this.setupPreviewVideoAutoplay();
            }
        });
    }
    
    // Setup video autoplay for current step
    this.setupPreviewVideoAutoplay();

    // Complete button
    const completeBtn = previewModal.querySelector('#previewCompleteBtn');
    if (completeBtn) {
        completeBtn.addEventListener('click', () => {
            previewModal.classList.add('hidden');
        });
    }

    // Close on overlay click
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            previewModal.classList.add('hidden');
        }
    });
};

