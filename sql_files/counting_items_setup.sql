-- =============================================================
-- counting_items tablosu: her ürün ayrı bir satır
-- Birden fazla cihaz aynı anda sayım yaparken çakışma olmaz.
-- Her UPSERT yalnızca o ürünün satırını değiştirir.
-- =============================================================

-- 1. Tablo oluştur
CREATE TABLE IF NOT EXISTS counting_items (
    id              UUID                     DEFAULT gen_random_uuid() PRIMARY KEY,
    username        TEXT                     NOT NULL,
    table_name      TEXT                     NOT NULL,
    product_id      TEXT                     NOT NULL,
    warehouse_stock NUMERIC                  DEFAULT NULL,
    system_stock    NUMERIC                  DEFAULT NULL,
    price           NUMERIC                  DEFAULT NULL,
    price_text      TEXT                     DEFAULT NULL,
    reserved_stock  NUMERIC                  DEFAULT NULL,
    history         JSONB                    DEFAULT '[]'::jsonb,
    api_fetch_failed BOOLEAN                 DEFAULT FALSE,
    struck_price         NUMERIC                  DEFAULT NULL,
    struck_price_text    TEXT                     DEFAULT NULL,
    no_struck_price      BOOLEAN                  DEFAULT FALSE,
    updated_by      TEXT                     DEFAULT NULL,  -- device_id (echo filtreleme için)
    last_updated    TIMESTAMPTZ              DEFAULT NOW(),
    created_at      TIMESTAMPTZ              DEFAULT NOW(),

    UNIQUE (username, table_name, product_id)
);

-- 2. İndeksler (performans)
CREATE INDEX IF NOT EXISTS idx_ci_username       ON counting_items (username);
CREATE INDEX IF NOT EXISTS idx_ci_user_table     ON counting_items (username, table_name);
CREATE INDEX IF NOT EXISTS idx_ci_user_table_pid ON counting_items (username, table_name, product_id);

-- 3. RLS (Row Level Security) — anonKey ile erişimde gerekli
ALTER TABLE counting_items ENABLE ROW LEVEL SECURITY;

-- Herkese okuma+yazma (auth.uid() yerine app-level username ile çalışıyoruz)
-- Eğer zaten başka RLS politikanız varsa bu adımı atlayın.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'counting_items'
        AND policyname = 'counting_items_open_access'
    ) THEN
        CREATE POLICY counting_items_open_access ON counting_items
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Role izinleri — anon/authenticated ile erişim için ZORUNLU
-- Supabase'de RLS politikası yetmez; rolün tabloya erişim izni de olmalı.
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON counting_items TO anon;
GRANT ALL ON counting_items TO authenticated;

-- 5. Supabase Realtime için yayın (publication)
-- "supabase_realtime" publication'ına ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND tablename = 'counting_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE counting_items;
    END IF;
END $$;

-- =============================================================
-- MİGRASYON: Mevcut users.counting_data → counting_items
-- Bu sorguyu SADECE BİR KEZ çalıştırın.
-- counting.js zaten otomatik migration yapıyor ama SQL ile de
-- yapılabilir (daha hızlı / toplu).
-- =============================================================

-- Mevcut counting_data blob'undaki ürünleri counting_items'a taşır
-- (tablolar _tables altında, _tableMeta / _productOrder hariç gerçek ürünler)
INSERT INTO counting_items (
    username, table_name, product_id,
    warehouse_stock, system_stock, price, price_text,
    reserved_stock, history, api_fetch_failed,
    last_updated
)
SELECT
    u.username,
    tbl.key     AS table_name,
    prod.key    AS product_id,
    (prod.value->>'warehouseStock')::NUMERIC,
    (prod.value->>'systemStock')::NUMERIC,
    (prod.value->>'price')::NUMERIC,
    prod.value->>'priceText',
    (prod.value->>'reservedStock')::NUMERIC,
    COALESCE((prod.value->'history'), '[]'::jsonb),
    COALESCE((prod.value->>'apiFetchFailed')::BOOLEAN, FALSE),
    COALESCE(
        (prod.value->>'lastUpdated')::TIMESTAMPTZ,
        NOW()
    )
FROM
    users u,
    jsonb_each(u.counting_data->'_tables')  AS tbl,   -- her tablo
    jsonb_each(tbl.value)                   AS prod    -- her ürün
WHERE
    u.counting_data ? '_tables'
    AND prod.key NOT IN ('_tableMeta', '_productOrder', '_api_info', '_tables', '_currentTable')
    AND jsonb_typeof(prod.value) = 'object'
ON CONFLICT (username, table_name, product_id) DO NOTHING;

-- =============================================================
-- DOĞRULAMA: Tablo düzgün oluşturulmuş mu?
-- =============================================================
-- SELECT COUNT(*), username FROM counting_items GROUP BY username;
