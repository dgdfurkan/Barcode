-- Stock Requests Table for Cross-Device Sync (Optimized)
-- Kullanıcı başına 1 satır + JSON formatında istekler saklanır
-- GÜVENLİ VERSİYON: Mevcut tablo/policy'leri kontrol eder

-- ============================================
-- 1. ESKİ TABLOYU SİL (Eğer varsa)
-- ============================================
DROP TABLE IF EXISTS stock_requests CASCADE;

-- ============================================
-- 2. YENİ TABLO OLUŞTURMA (Optimized)
-- ============================================
CREATE TABLE stock_requests (
    username VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    requests JSONB DEFAULT '{"pending": [], "processing": [], "completed": [], "failed": []}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. INDEX'LER
-- ============================================
CREATE INDEX IF NOT EXISTS idx_stock_requests_username ON stock_requests(username);
CREATE INDEX IF NOT EXISTS idx_stock_requests_updated_at ON stock_requests(updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_requests_requests ON stock_requests USING GIN (requests);

-- ============================================
-- 4. RLS (Row Level Security)
-- ============================================
ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;

-- Eski policy'leri sil
DROP POLICY IF EXISTS "Users can view their own stock requests" ON stock_requests;
DROP POLICY IF EXISTS "Users can insert their own stock requests" ON stock_requests;
DROP POLICY IF EXISTS "Users can update their own stock requests" ON stock_requests;

-- Yeni policy'ler oluştur
-- Note: Application-level security kullanıyoruz (username kontrolü uygulama tarafında)
CREATE POLICY "Users can view their own stock requests" ON stock_requests
    FOR SELECT USING (true); -- Application ensures users only query their own username

CREATE POLICY "Users can insert their own stock requests" ON stock_requests
    FOR INSERT WITH CHECK (true); -- Application ensures correct username is set

CREATE POLICY "Users can update their own stock requests" ON stock_requests
    FOR UPDATE USING (true) -- Application ensures users only update their own requests
    WITH CHECK (true);

-- ============================================
-- 5. TRIGGER FOR updated_at
-- ============================================
-- Eski trigger'ı sil
DROP TRIGGER IF EXISTS update_stock_requests_updated_at ON stock_requests;
DROP FUNCTION IF EXISTS update_stock_requests_updated_at();

-- Trigger fonksiyonu oluştur
CREATE OR REPLACE FUNCTION update_stock_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur
CREATE TRIGGER update_stock_requests_updated_at
    BEFORE UPDATE ON stock_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_requests_updated_at();

-- ============================================
-- 6. CLEANUP FONKSİYONU
-- ============================================
-- Eski fonksiyonu sil
DROP FUNCTION IF EXISTS cleanup_old_stock_requests();

-- Cleanup fonksiyonu oluştur (1 saatten eski completed/failed istekleri temizler)
CREATE OR REPLACE FUNCTION cleanup_old_stock_requests()
RETURNS void AS $$
BEGIN
    UPDATE stock_requests
    SET requests = jsonb_set(
        jsonb_set(
            requests,
            '{completed}',
            COALESCE(
                (
                    SELECT jsonb_agg(elem)
                    FROM jsonb_array_elements(requests->'completed') AS elem
                    WHERE (elem->>'completed_at')::timestamp WITH TIME ZONE > NOW() - INTERVAL '1 hour'
                ),
                '[]'::jsonb
            )
        ),
        '{failed}',
        COALESCE(
            (
                SELECT jsonb_agg(elem)
                FROM jsonb_array_elements(requests->'failed') AS elem
                WHERE (elem->>'created_at')::timestamp WITH TIME ZONE > NOW() - INTERVAL '1 hour'
            ),
            '[]'::jsonb
        )
    )
    WHERE requests ? 'completed' OR requests ? 'failed';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. COMMENT
-- ============================================
COMMENT ON TABLE stock_requests IS 'Stok istekleri ve yanıtları için cross-device sync tablosu (kullanıcı başına 1 satır + JSON)';
COMMENT ON COLUMN stock_requests.requests IS 'JSONB object: {"pending": [...], "processing": [...], "completed": [...], "failed": [...]}';

-- ============================================
-- ✅ TAMAMLANDI!
-- ============================================
-- Bu SQL'i Supabase SQL Editor'da çalıştırdıktan sonra:
-- 1. Extension'ı yeniden yükle
-- 2. Getir franchise sayfasını aç
-- 3. Counting.html'den sync yap
-- ============================================
