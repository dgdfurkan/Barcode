-- struckPrice kalıcılığı + API tekrarını önleyen flag
ALTER TABLE counting_items
    ADD COLUMN IF NOT EXISTS struck_price NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS struck_price_text TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS no_struck_price BOOLEAN DEFAULT FALSE;
