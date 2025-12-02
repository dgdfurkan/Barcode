-- Migration: Separate user_data.data JSONB into custom_products and settings columns
-- IMPORTANT: After migration, 'data' column will NOT be used anymore
-- All writes will go to 'custom_products' and 'settings' columns only

-- Step 1: Add new columns (nullable first, will be populated from existing data)
ALTER TABLE user_data
ADD COLUMN IF NOT EXISTS custom_products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Step 2: Create indexes for new columns (for better query performance)
CREATE INDEX IF NOT EXISTS idx_user_data_custom_products ON user_data USING GIN (custom_products);
CREATE INDEX IF NOT EXISTS idx_user_data_settings ON user_data USING GIN (settings);

-- Step 3: Migrate existing data from 'data' column to new columns
-- Extract ONLY custom products (filter out isDefault=true products, those come from PRODUCTS_DATA)
UPDATE user_data
SET 
    custom_products = COALESCE(
        (
            SELECT jsonb_agg(product)
            FROM jsonb_array_elements(data->'products') AS product
            WHERE (product->>'isDefault' IS NULL OR product->>'isDefault' != 'true')
        ),
        '[]'::jsonb
    ),
    settings = COALESCE(
        jsonb_build_object(
            'showDuplicates', COALESCE(data->'settings'->>'showDuplicates', 'false'),
            'theme', COALESCE(data->'settings'->>'theme', 'light'),
            'showDefaultProducts', COALESCE(data->'settings'->>'showDefaultProducts', 'true')
        ),
        '{}'::jsonb
    )
WHERE data IS NOT NULL
  AND (
      custom_products IS NULL 
      OR custom_products = '[]'::jsonb 
      OR settings IS NULL 
      OR settings = '{}'::jsonb
  );

-- Step 4: For rows without 'data' column, set defaults
UPDATE user_data
SET 
    custom_products = COALESCE(custom_products, '[]'::jsonb),
    settings = COALESCE(
        settings,
        '{"showDuplicates": false, "theme": "light", "showDefaultProducts": true}'::jsonb
    )
WHERE custom_products IS NULL OR settings IS NULL;

-- Step 5: Make columns NOT NULL (after migration is complete)
ALTER TABLE user_data
ALTER COLUMN custom_products SET NOT NULL,
ALTER COLUMN custom_products SET DEFAULT '[]'::jsonb,
ALTER COLUMN settings SET NOT NULL,
ALTER COLUMN settings SET DEFAULT '{}'::jsonb;

-- Step 6: Drop the old 'data' column (no longer needed)
-- IMPORTANT: Make sure all data is migrated before dropping!
ALTER TABLE user_data DROP COLUMN IF EXISTS data;

-- IMPORTANT NOTES:
-- 1. The 'data' column has been DROPPED - it is no longer in the table
-- 2. All future writes go ONLY to 'custom_products' and 'settings' columns
-- 3. Statistics and searchHistory are removed - they will be added later if needed
-- 4. Default products (isDefault=true) are NOT stored - they come from PRODUCTS_DATA
-- 5. Migration is complete - old 'data' column structure is removed

