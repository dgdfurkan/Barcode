-- Add feature_changes column to updates table
-- Supabase SQL Editor'da çalıştır

ALTER TABLE updates ADD COLUMN IF NOT EXISTS feature_changes JSONB DEFAULT '[]'::jsonb;

-- Index for feature_changes queries
CREATE INDEX IF NOT EXISTS idx_updates_feature_changes ON updates USING GIN (feature_changes);

-- Comment
COMMENT ON COLUMN updates.feature_changes IS 'Bu güncelleme ile değiştirilecek özellikler: [{feature_key, new_value, value_type}]';

