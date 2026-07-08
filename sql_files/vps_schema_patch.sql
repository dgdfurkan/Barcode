-- VPS şema yaması — vps_init.sql sonrası bir kez çalıştırın
-- sudo -u postgres psql -d jetbarkod -f /opt/jetbarkod-api/vps_schema_patch.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS keyboard_shortcuts JSONB DEFAULT '{}'::jsonb;
UPDATE users SET keyboard_shortcuts = '{}'::jsonb WHERE keyboard_shortcuts IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_keyboard_shortcuts ON users USING GIN (keyboard_shortcuts);

CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    gemini_api_key TEXT,
    cloudinary_cloud_name TEXT,
    cloudinary_api_key TEXT,
    cloudinary_upload_preset TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO admin_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON admin_settings TO jetbarkod;
