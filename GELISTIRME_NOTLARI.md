# Geliştirme Notları - Yapılmaması Gerekenler ve Çözümler

Bu dosya, proje geliştirme sürecinde karşılaşılan sorunlar ve çözümlerini içerir. Gelecekte benzer hataları tekrarlamamak için referans olarak kullanılmalıdır.

---

## ❌ Script Yükleme Sırası Hatası - DOMContentLoaded İçinde Global Fonksiyon Tanımlama

### 🔴 Sorun

**Tarih:** 2025-11-29  
**Etkilenen Özellik:** Scan Effect Visibility Kontrolü

#### Sorun Açıklaması

`loadScanEffectVisibility()` fonksiyonu `DOMContentLoaded` event listener içinde tanımlanmıştı. Ancak `feature-manager.js` script'i sayfa yüklenirken hemen çalışıyor ve bu fonksiyonu çağırmaya çalışıyordu. `DOMContentLoaded` henüz tetiklenmediği için fonksiyon `undefined` oluyordu.

#### Hatalı Kod Yapısı

```javascript
// ❌ YANLIŞ: DOMContentLoaded içinde tanımlama
document.addEventListener('DOMContentLoaded', () => {
    async function loadScanEffectVisibility() {
        // ... fonksiyon içeriği
    }
    window.loadScanEffectVisibility = loadScanEffectVisibility;
});

// feature-manager.js (sayfa yüklenirken hemen çalışıyor)
// checkAndApplyFeatureChanges() içinde:
if (typeof window.loadScanEffectVisibility === 'function') {
    await window.loadScanEffectVisibility(); // ❌ undefined hatası!
}
```

#### Script Yükleme Sırası (Hatalı)

1. `feature-manager.js` yükleniyor → hemen çalışıyor
2. `checkAndApplyFeatureChanges()` çağrılıyor
3. `window.loadScanEffectVisibility()` çağrılıyor → **`undefined`** (henüz tanımlı değil!)
4. `DOMContentLoaded` tetikleniyor → fonksiyon tanımlanıyor (ama çok geç)

#### Console Hatası

```
🔍 [FEATURE-MANAGER] window.loadScanEffectVisibility type: undefined
⚠️ [FEATURE-MANAGER] loadScanEffectVisibility is not a function! undefined
```

---

### ✅ Çözüm

#### Doğru Kod Yapısı

```javascript
// ✅ DOĞRU: Script'in en üstünde, feature-manager.js'den ÖNCE tanımlama
<script>
    // ===== SCAN EFFECT VISIBILITY FUNCTION - MUST BE DEFINED BEFORE feature-manager.js LOADS =====
    async function loadScanEffectVisibility() {
        // ... fonksiyon içeriği
    }
    
    // Make function globally available IMMEDIATELY (before feature-manager.js loads)
    window.loadScanEffectVisibility = loadScanEffectVisibility;
    console.log('✅ [SCAN] loadScanEffectVisibility function defined and exposed to window');
</script>

<!-- feature-manager.js buradan sonra yükleniyor -->
<script src="../js/feature-manager.js"></script>
```

#### Script Yükleme Sırası (Doğru)

1. `loadScanEffectVisibility()` tanımlanıyor → `window.loadScanEffectVisibility` atanıyor ✅
2. `feature-manager.js` yükleniyor → hemen çalışıyor
3. `checkAndApplyFeatureChanges()` çağrılıyor
4. `window.loadScanEffectVisibility()` çağrılıyor → **fonksiyon mevcut** → çalışıyor ✅

---

### 📚 Ders Çıkarılacak Noktalar

#### ❌ YAPILMAMASI GEREKENLER

1. **Global fonksiyonları `DOMContentLoaded` içinde tanımlama**
   - Eğer bir fonksiyon başka script'ler tarafından çağrılacaksa, `DOMContentLoaded` içinde tanımlanmamalı
   - Script yükleme sırası belirsiz olduğu için hata oluşabilir

2. **Script yükleme sırasını göz ardı etme**
   - Hangi script'in ne zaman çalıştığını bilmek kritik
   - `feature-manager.js`, `update-notifications.js` gibi script'ler sayfa yüklenirken hemen çalışabilir

3. **Bağımlılıkları kontrol etmeden fonksiyon çağırma**
   - `typeof window.functionName === 'function'` kontrolü yapılsa bile, fonksiyon henüz tanımlanmamış olabilir

#### ✅ YAPILMASI GEREKENLER

1. **Global fonksiyonları script'in en üstünde tanımla**
   - Başka script'ler tarafından kullanılacak fonksiyonlar, script yükleme sırasına göre en üste konulmalı
   - `DOMContentLoaded` içinde değil, doğrudan script bloğu içinde tanımlanmalı

2. **Script yükleme sırasını kontrol et**
   - HTML'deki `<script>` tag'lerinin sırası önemli
   - Bağımlılıkları olan script'ler, bağımlı oldukları script'lerden SONRA yüklenmeli

3. **Fonksiyon tanımlamalarını log'la**
   - `console.log('✅ Function defined')` gibi log'lar ekleyerek fonksiyonun tanımlandığını doğrula
   - Debug sırasında script yükleme sırasını takip etmek kolaylaşır

4. **Bağımlılık kontrolü yap**
   - Fonksiyon çağrılmadan önce tanımlı olduğundan emin ol
   - `typeof window.functionName === 'function'` kontrolü yap, ama fonksiyonun gerçekten tanımlı olduğundan emin ol

---

### 🔍 Nasıl Tespit Edilir?

1. **Console'da `undefined` hatası görülürse**
   - `window.functionName type: undefined` gibi log'lar
   - `functionName is not a function` hataları

2. **Fonksiyon çağrıldığında çalışmıyorsa**
   - Script yükleme sırasını kontrol et
   - Fonksiyonun tanımlandığı yeri kontrol et

3. **Sayfa yenilendiğinde bazen çalışıp bazen çalışmıyorsa**
   - Race condition (yarış durumu) olabilir
   - Script yükleme sırası belirsiz olabilir

---

### 📝 Genel Kural

> **Eğer bir fonksiyon başka script'ler tarafından çağrılacaksa, o fonksiyonun tanımlandığı script bloğu, çağıran script'lerden ÖNCE yüklenmelidir.**

---

## 🔄 Güncelleme Geçmişi

- **2025-11-29**: Script yükleme sırası hatası eklendi (Scan Effect Visibility)

---

## 📌 Notlar

- Bu dosya sürekli güncellenmelidir
- Yeni sorunlar ve çözümler eklendikçe buraya eklenmelidir
- Her sorun için tarih, etkilenen özellik ve detaylı açıklama eklenmelidir

