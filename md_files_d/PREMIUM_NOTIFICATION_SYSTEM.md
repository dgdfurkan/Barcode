# Premium Özellikler Bildirim Sistemi

## 📢 Sistem Nasıl Çalışıyor?

Bu sistem, **kullanıcılara premium özellikler açıldığında veya kapatıldığında** sağ üstte bildirim gösterir.

---

## 🎯 Ne Zaman Çalışır?

### 1. **Yeni Premium Özellik Açıldığında**

Admin panelden bir kullanıcının premium özelliğini açtığında:
- ✅ **Supabase Realtime** ile anında algılanır
- ✅ Sağ üstte **mor gradient** bildirim gösterilir
- ✅ Bildirim: **"Yeni Premium Özellikler!"**
- ✅ Hangi özelliklerin açıldığı listelenir
- ✅ Tıklayınca detay modal'ı açılır

### 2. **Premium Özellik Kapatıldığında**

Admin panelden bir kullanıcının premium özelliğini kapattığında:
- ✅ **Supabase Realtime** ile anında algılanır
- ✅ Sağ üstte **turuncu-kırmızı gradient** bildirim gösterilir
- ✅ Bildirim: **"Bilgilendirme!"**
- ✅ Hangi özelliklerin kapatıldığı belirtilir
- ✅ Tıklayınca sayfa yenilenir

---

## 🔧 Teknik Detaylar

### Dosya: `js/notifications.js`

**Ana Sınıf:** `NotificationSystem`

**Önemli Fonksiyonlar:**

1. **`init()`** - Sistemi başlatır, Realtime subscription kurar
2. **`setupRealtimeSubscription()`** - Supabase Realtime ile `users` tablosunu dinler
3. **`handlePremiumFeaturesUpdate(payload)`** - Premium özellik değişikliklerini işler
4. **`showInPageNotificationWithModal(enabledFeatures)`** - Yeni özellikler için bildirim gösterir
5. **`showDisabledFeaturesNotification(disabledFeatures)`** - Kapatılan özellikler için bildirim gösterir

### Realtime Subscription

```javascript
// users tablosundaki premium_features değişikliklerini dinler
this.subscription = window.supabase
    .channel('premium-features-updates')
    .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `username=eq.${this.currentUser.username}`
    }, (payload) => {
        this.handlePremiumFeaturesUpdate(payload);
    })
    .subscribe();
```

---

## 📍 Bildirim Konumu

**CSS Sınıfı:** `fixed top-4 right-4`

- **Konum:** Sağ üst köşe
- **Z-index:** 9998 (modal'dan düşük, diğer elementlerden yüksek)
- **Animasyon:** Hover'da scale efekti

---

## 🎨 Bildirim Tipleri

### 1. Yeni Premium Özellikler (Mor Gradient)

```javascript
className: 'fixed top-4 right-4 bg-gradient-to-r from-purple-500 to-purple-600'
```

**İçerik:**
- ✨ İkon
- "Yeni Premium Özellikler!" başlığı
- Açılan özelliklerin listesi
- "📋 Detaylar için tıklayın" mesajı
- Tıklayınca modal açılır

### 2. Premium Özellikler Kapatıldı (Turuncu-Kırmızı Gradient)

```javascript
className: 'fixed top-4 right-4 bg-gradient-to-r from-orange-500 to-red-600'
```

**İçerik:**
- ⚠️ İkon
- "Bilgilendirme!" başlığı
- Kapatılan özelliklerin listesi
- "📋 Tıklayınca sayfa yenilenecek..." mesajı
- Tıklayınca sayfa yenilenir

---

## 🔄 Çalışma Akışı

1. **Admin panelden premium özellik değiştirilir**
   - Admin panelde kullanıcının `premium_features` JSON'u güncellenir

2. **Supabase Realtime algılar**
   - `users` tablosunda UPDATE event'i tetiklenir
   - `NotificationSystem.handlePremiumFeaturesUpdate()` çağrılır

3. **Değişiklikler analiz edilir**
   - Eski ve yeni premium_features karşılaştırılır
   - Hangi özellikler açıldı/kapatıldı bulunur

4. **Bildirim gösterilir**
   - Yeni özellikler varsa → Mor bildirim
   - Kapatılan özellikler varsa → Turuncu bildirim

5. **Kullanıcı etkileşimi**
   - Bildirime tıklayınca modal açılır veya sayfa yenilenir
   - Bildirim localStorage'da işaretlenir (tekrar gösterilmez)

---

## 💾 LocalStorage Kullanımı

**Yeni Özellikler:**
```javascript
localStorage.setItem(`premium_notification_shown_${username}`, JSON.stringify({
    'feature_name': true
}));
```

**Kapatılan Özellikler:**
```javascript
localStorage.setItem(`premium_disabled_notification_shown_${username}`, JSON.stringify({
    'feature_name': true
}));
```

Bu sayede aynı özellik için bildirim sadece bir kez gösterilir.

---

## 🚀 Kullanım Senaryosu

**Örnek:**

1. Admin panelde "Ahmet" kullanıcısının `premium_features` JSON'unu güncelle:
   ```json
   {
     "advanced_search": true,
     "export_data": true
   }
   ```

2. Ahmet'in tarayıcısında:
   - Realtime subscription anında algılar
   - Sağ üstte mor bildirim görünür:
     - "Yeni Premium Özellikler!"
     - "Gelişmiş Arama, Veri Dışa Aktarma"
     - "📋 Detaylar için tıklayın"

3. Ahmet bildirime tıklar:
   - Modal açılır
   - Özelliklerin detayları gösterilir
   - Bildirim kapanır

---

## 📝 Önemli Notlar

1. **Realtime Fallback:** Eğer Realtime çalışmazsa, sistem polling yapmaz (devre dışı)

2. **Tek Seferlik Bildirim:** Aynı özellik için bildirim sadece bir kez gösterilir (localStorage kontrolü)

3. **Sayfa Yenileme:** Kapatılan özellikler için bildirim tıklanınca sayfa otomatik yenilenir

4. **Browser Notification:** Eğer kullanıcı izin vermişse, tarayıcı bildirimi de gösterilir

---

## 🎯 Özet

**Sistem:** Premium Özellikler Bildirim Sistemi  
**Dosya:** `js/notifications.js`  
**Konum:** Sağ üst köşe (`fixed top-4 right-4`)  
**Tetiklendiği Durum:** Admin panelden kullanıcının premium_features'ı değiştirildiğinde  
**Çalışma Şekli:** Supabase Realtime subscription ile anında algılama

