-- Raftaki Eksikler — premium özellik tabloları
-- VPS: sudo -u postgres psql jetbarkod -f /opt/jetbarkod-api/shelf_missing_setup.sql

CREATE TABLE IF NOT EXISTS shelf_missing_shelves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (username, name)
);

CREATE INDEX IF NOT EXISTS idx_sms_username ON shelf_missing_shelves(username);
CREATE INDEX IF NOT EXISTS idx_sms_user_sort ON shelf_missing_shelves(username, sort_order);

DROP TRIGGER IF EXISTS update_shelf_missing_shelves_updated_at ON shelf_missing_shelves;
CREATE TRIGGER update_shelf_missing_shelves_updated_at
    BEFORE UPDATE ON shelf_missing_shelves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS shelf_missing_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL,
    shelf_id UUID NOT NULL REFERENCES shelf_missing_shelves(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_image TEXT,
    barcodes JSONB DEFAULT '[]'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    needed INTEGER NOT NULL DEFAULT 0 CHECK (needed >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (username, shelf_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_smi_username ON shelf_missing_items(username);
CREATE INDEX IF NOT EXISTS idx_smi_shelf ON shelf_missing_items(shelf_id);
CREATE INDEX IF NOT EXISTS idx_smi_user_needed ON shelf_missing_items(username, needed) WHERE needed > 0;
CREATE INDEX IF NOT EXISTS idx_smi_user_shelf_sort ON shelf_missing_items(username, shelf_id, sort_order);

DROP TRIGGER IF EXISTS update_shelf_missing_items_updated_at ON shelf_missing_items;
CREATE TRIGGER update_shelf_missing_items_updated_at
    BEFORE UPDATE ON shelf_missing_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON shelf_missing_shelves TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON shelf_missing_items TO jetbarkod;

NOTIFY pgrst, 'reload schema';
