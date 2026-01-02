-- Counting Data Setup for Supabase
-- Bu SQL, counting_data'nın user_data.settings içinde saklanması için gerekli yapıyı sağlar

-- ============================================
-- MEVCUT YAPI (Önerilen - Zaten Var)
-- ============================================
-- counting_data, user_data tablosunun settings JSONB kolonu içinde saklanıyor
-- Yapı: user_data.settings.counting_data
-- 
-- Örnek yapı:
-- {
--   "counting_data": {
--     "productId1": {
--       "warehouseStock": 10,
--       "systemStock": 8,
--       "lastUpdated": "2025-01-15T10:30:00.000Z",
--       "history": [...]
--     },
--     "productId2": {...}
--   }
-- }

-- ============================================
-- KONTROL: Mevcut user_data yapısını kontrol et
-- ============================================
-- Bu sorguları çalıştırarak mevcut yapıyı kontrol edebilirsiniz:

-- 1. user_data tablosunun yapısını kontrol et
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_data'
ORDER BY ordinal_position;

-- 2. settings kolonunun var olduğunu kontrol et
SELECT 
    EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_data' 
        AND column_name = 'settings'
    ) as settings_column_exists;

-- ============================================
-- SONUÇ:
-- ============================================
-- ✅ EĞER TRUE DÖNÜYORSA: 
--    → Kolon zaten mevcut, HİÇBİR ŞEY YAPMAYA GEREK YOK!
--    → counting.html sayfasını direkt kullanabilirsiniz
--
-- ❌ EĞER FALSE DÖNÜYORSA:
--    → Aşağıdaki "EĞER settings KOLONU YOKSA" bölümündeki migration'ı çalıştırın
-- ============================================

-- 3. Mevcut settings yapısını örnek olarak göster
SELECT 
    username,
    settings->'counting_data' as counting_data_sample
FROM user_data
WHERE settings->'counting_data' IS NOT NULL
LIMIT 1;

-- ============================================
-- EĞER settings KOLONU YOKSA (Migration)
-- ============================================
-- ⚠️ SADECE YUKARIDAKI KONTROL FALSE DÖNÜYORSA ÇALIŞTIRIN!
-- Eğer user_data tablosunda settings kolonu yoksa, bu migration'ı çalıştırın:

-- Step 1: settings kolonunu ekle (eğer yoksa)
ALTER TABLE user_data
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Step 2: Index oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_user_data_settings ON user_data USING GIN (settings);

-- Step 3: Mevcut verileri koru (eğer data kolonundan migration yapıyorsanız)
-- Bu adım sadece eski yapıdan migration yapıyorsanız gerekli
UPDATE user_data
SET settings = COALESCE(
    settings,
    COALESCE(
        jsonb_build_object(
            'showDuplicates', COALESCE(data->'settings'->>'showDuplicates', 'false'),
            'theme', COALESCE(data->'settings'->>'theme', 'light'),
            'showDefaultProducts', COALESCE(data->'settings'->>'showDefaultProducts', 'true'),
            'counting_data', '{}'::jsonb
        ),
        '{"counting_data": {}}'::jsonb
    )
)
WHERE settings IS NULL OR settings = '{}'::jsonb;

-- Step 4: settings kolonunu NOT NULL yap (opsiyonel)
ALTER TABLE user_data
ALTER COLUMN settings SET NOT NULL,
ALTER COLUMN settings SET DEFAULT '{}'::jsonb;

-- ============================================
-- ALTERNATIF: AYRI TABLO İSTERSENİZ (Önerilmez)
-- ============================================
-- Eğer counting_data için ayrı bir tablo isterseniz (önerilmez, ama hazır):

/*
CREATE TABLE counting_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    warehouse_stock INTEGER,
    system_stock INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, product_id)
);

-- Index'ler
CREATE INDEX idx_counting_data_username ON counting_data(username);
CREATE INDEX idx_counting_data_product_id ON counting_data(product_id);
CREATE INDEX idx_counting_data_username_product ON counting_data(username, product_id);

-- RLS (Row Level Security)
ALTER TABLE counting_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own counting data" ON counting_data
    FOR ALL USING (username = current_setting('app.current_user', true));

-- Trigger for updated_at
CREATE TRIGGER update_counting_data_updated_at BEFORE UPDATE ON counting_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
*/

-- ============================================
-- ÖRNEK QUERY'LER
-- ============================================

-- 1. Bir kullanıcının counting_data'sını getir
SELECT 
    username,
    settings->'counting_data' as counting_data
FROM user_data
WHERE username = 'kullanici_adi';

-- 2. Belirli bir ürünün counting_data'sını getir
SELECT 
    username,
    settings->'counting_data'->'productId' as product_data
FROM user_data
WHERE username = 'kullanici_adi'
AND settings->'counting_data'->'productId' IS NOT NULL;

-- 3. Tüm kullanıcıların counting_data sayısını göster
SELECT 
    username,
    jsonb_object_keys(settings->'counting_data') as product_ids
FROM user_data
WHERE settings->'counting_data' IS NOT NULL
AND settings->'counting_data' != '{}'::jsonb;

-- 4. Counting data'sı olan kullanıcı sayısı
SELECT COUNT(*) as users_with_counting_data
FROM user_data
WHERE settings->'counting_data' IS NOT NULL
AND settings->'counting_data' != '{}'::jsonb;

-- ============================================
-- NOTLAR
-- ============================================
-- 1. counting_data, user_data.settings JSONB kolonu içinde saklanıyor
-- 2. Yeni tablo oluşturmaya gerek yok (mevcut yapı yeterli)
-- 3. Her kullanıcı için ayrı counting_data objesi var
-- 4. Farklı cihazlardan erişim için Supabase kullanılıyor
-- 5. localStorage yedek olarak kullanılıyor

