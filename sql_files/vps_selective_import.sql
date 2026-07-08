-- Jet Barkod — Supabase'den VPS'e seçici veri aktarımı
-- Öncelik: users → user_data → counting_items → premium (users.premium_features içinde)
--
-- ADIM 1 — Supabase Dashboard (eski proje)
--   Table Editor → users → Export CSV
--   Table Editor → user_data → Export CSV
--   Table Editor → counting_items → Export CSV (varsa)
--
-- ADIM 2 — CSV'leri VPS'e kopyala (Mac terminali)
--   scp users.csv user_data.csv counting_items.csv root@198.55.109.160:/tmp/
--
-- ADIM 3 — VPS'te import (ssh root@flowcobalt)
--   sudo -u postgres psql jetbarkod -f /opt/jetbarkod-api/vps_selective_import.sql
--   (veya psql içinde bu dosyadaki komutları sırayla çalıştır)

-- Geçici staging tabloları (bir kez oluştur)
CREATE TABLE IF NOT EXISTS staging_users (LIKE users INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS staging_user_data (LIKE user_data INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS staging_counting_items (LIKE counting_items INCLUDING DEFAULTS);

TRUNCATE staging_users;
TRUNCATE staging_user_data;
TRUNCATE staging_counting_items;

-- CSV yükleme (psql içindeyken):
-- \copy staging_users FROM '/tmp/users.csv' WITH (FORMAT csv, HEADER true, NULL '');
-- \copy staging_user_data FROM '/tmp/user_data.csv' WITH (FORMAT csv, HEADER true, NULL '');
-- \copy staging_counting_items FROM '/tmp/counting_items.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- users aktar (mevcut adminfurer vb. korunur)
INSERT INTO users (
    id, username, password, company, contact_email, trial_end,
    allowed_ips, tracked_ips, max_ip_count, ip_tracking_enabled,
    is_active, is_admin, premium_features, counting_data,
    chat_messages, last_chat_update, created_at, updated_at
)
SELECT
    id, username, password, company, contact_email, trial_end,
    allowed_ips, tracked_ips, max_ip_count, ip_tracking_enabled,
    is_active, is_admin, premium_features, counting_data,
    chat_messages, last_chat_update, created_at, updated_at
FROM staging_users
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    company = EXCLUDED.company,
    contact_email = EXCLUDED.contact_email,
    trial_end = EXCLUDED.trial_end,
    allowed_ips = EXCLUDED.allowed_ips,
    is_active = EXCLUDED.is_active,
    is_admin = EXCLUDED.is_admin,
    premium_features = EXCLUDED.premium_features,
    updated_at = NOW();

-- user_data aktar
INSERT INTO user_data (id, username, custom_products, settings, created_at, updated_at)
SELECT id, username, custom_products, settings, created_at, updated_at
FROM staging_user_data
ON CONFLICT (username) DO UPDATE SET
    custom_products = EXCLUDED.custom_products,
    settings = EXCLUDED.settings,
    updated_at = NOW();

-- counting_items aktar (username FK yok ama users'ta olmalı — önce users import edilmeli)
INSERT INTO counting_items (
    id, username, table_name, product_id, warehouse_stock, system_stock,
    price, price_text, reserved_stock, history, api_fetch_failed,
    struck_price, struck_price_text, no_struck_price, updated_by,
    last_updated, created_at
)
SELECT
    id, username, table_name, product_id, warehouse_stock, system_stock,
    price, price_text, reserved_stock, history, api_fetch_failed,
    struck_price, struck_price_text, no_struck_price, updated_by,
    last_updated, created_at
FROM staging_counting_items
ON CONFLICT (username, table_name, product_id) DO UPDATE SET
    warehouse_stock = EXCLUDED.warehouse_stock,
    system_stock = EXCLUDED.system_stock,
    price = EXCLUDED.price,
    price_text = EXCLUDED.price_text,
    reserved_stock = EXCLUDED.reserved_stock,
    history = EXCLUDED.history,
    struck_price = EXCLUDED.struck_price,
    struck_price_text = EXCLUDED.struck_price_text,
    no_struck_price = EXCLUDED.no_struck_price,
    updated_by = EXCLUDED.updated_by,
    last_updated = EXCLUDED.last_updated;

-- Kontrol
SELECT username, company, is_admin, is_active FROM users ORDER BY created_at DESC LIMIT 20;
SELECT username FROM user_data ORDER BY username LIMIT 20;
SELECT COUNT(*) AS counting_rows FROM counting_items;
