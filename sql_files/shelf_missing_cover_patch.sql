-- Raf kapağı (cover_image) — mevcut kuruluma patch
-- VPS: sudo -u postgres psql jetbarkod -f /opt/jetbarkod-api/shelf_missing_cover_patch.sql

ALTER TABLE shelf_missing_shelves
    ADD COLUMN IF NOT EXISTS cover_image TEXT;

NOTIFY pgrst, 'reload schema';
