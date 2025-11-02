-- Migration: Separate user_data.data JSONB into custom_products and settings columns
-- This migration is backward compatible - old 'data' column remains, new columns added

-- Step 1: Add new columns (nullable first, will be populated from existing data)
ALTER TABLE user_data
ADD COLUMN IF NOT EXISTS custom_products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Step 2: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_user_data_custom_products ON user_data USING GIN (custom_products);
CREATE INDEX IF NOT EXISTS idx_user_data_settings ON user_data USING GIN (settings);

-- Step 3: Migrate existing data from 'data' column to new columns
-- Extract custom products (filter out isDefault=true products)
UPDATE user_data
SET 
    custom_products = COALESCE(
        (
            SELECT jsonb_agg(product)
            FROM jsonb_array_elements(data->'products') AS product
            WHERE product->>'isDefault' != 'true' OR product->>'isDefault' IS NULL
        ),
        '[]'::jsonb
    ),
    settings = COALESCE(data->'settings', '{}'::jsonb)
WHERE data IS NOT NULL
  AND (custom_products IS NULL OR custom_products = '[]'::jsonb OR settings IS NULL OR settings = '{}'::jsonb);

-- Step 4: Make columns NOT NULL after migration (optional, safer to keep nullable for now)
-- ALTER TABLE user_data
-- ALTER COLUMN custom_products SET NOT NULL,
-- ALTER COLUMN settings SET NOT NULL;

-- Note: The old 'data' column is kept for backward compatibility
-- It can be dropped later after confirming all clients are updated
-- DROP COLUMN data; -- DO NOT RUN THIS YET, keep for backward compatibility

