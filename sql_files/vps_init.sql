-- Jet Barkod VPS PostgreSQL init schema
-- Supabase RLS / anon / realtime yok — güvenlik API katmanında.
-- Çalıştır: sudo -u postgres psql -d jetbarkod -f vps_init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    company VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    trial_end TIMESTAMPTZ NOT NULL,
    allowed_ips TEXT[] DEFAULT ARRAY['*'],
    tracked_ips TEXT[] DEFAULT '{}',
    max_ip_count INTEGER DEFAULT 5,
    ip_tracking_enabled BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    premium_features JSONB DEFAULT '{}'::jsonb,
    counting_data JSONB DEFAULT '{}'::jsonb,
    chat_messages TEXT DEFAULT '[]',
    last_chat_update TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_premium_features ON users USING GIN (premium_features);
CREATE INDEX IF NOT EXISTS idx_users_counting_data ON users USING GIN (counting_data);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- user_data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    custom_products JSONB DEFAULT '[]'::jsonb NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_username_unique ON user_data(username);
CREATE INDEX IF NOT EXISTS idx_user_data_custom_products ON user_data USING GIN (custom_products);
CREATE INDEX IF NOT EXISTS idx_user_data_settings ON user_data USING GIN (settings);

DROP TRIGGER IF EXISTS update_user_data_updated_at ON user_data;
CREATE TRIGGER update_user_data_updated_at
    BEFORE UPDATE ON user_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- ip_logs / rate_limits / blocked_ips
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ip_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    login_time TIMESTAMPTZ DEFAULT NOW(),
    logout_time TIMESTAMPTZ,
    session_duration INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ip_logs_username ON ip_logs(username);
CREATE INDEX IF NOT EXISTS idx_ip_logs_ip ON ip_logs(ip_address);

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address INET NOT NULL,
    attempts INTEGER DEFAULT 1,
    last_attempt TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address);

CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);

-- ---------------------------------------------------------------------------
-- counting_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS counting_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL,
    table_name TEXT NOT NULL,
    product_id TEXT NOT NULL,
    warehouse_stock NUMERIC DEFAULT NULL,
    system_stock NUMERIC DEFAULT NULL,
    price NUMERIC DEFAULT NULL,
    price_text TEXT DEFAULT NULL,
    reserved_stock NUMERIC DEFAULT NULL,
    history JSONB DEFAULT '[]'::jsonb,
    api_fetch_failed BOOLEAN DEFAULT FALSE,
    struck_price NUMERIC DEFAULT NULL,
    struck_price_text TEXT DEFAULT NULL,
    no_struck_price BOOLEAN DEFAULT FALSE,
    updated_by TEXT DEFAULT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (username, table_name, product_id)
);

CREATE INDEX IF NOT EXISTS idx_ci_username ON counting_items(username);
CREATE INDEX IF NOT EXISTS idx_ci_user_table ON counting_items(username, table_name);
CREATE INDEX IF NOT EXISTS idx_ci_user_table_pid ON counting_items(username, table_name, product_id);

-- ---------------------------------------------------------------------------
-- dispatch_agenda_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispatch_agenda_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_image TEXT,
    barcodes JSONB DEFAULT '[]'::jsonb,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    reason_preset TEXT NOT NULL DEFAULT 'Eksik ürün',
    reason_note TEXT,
    pickup_required BOOLEAN NOT NULL DEFAULT FALSE,
    address TEXT,
    event_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dai_username ON dispatch_agenda_items(username);
CREATE INDEX IF NOT EXISTS idx_dai_user_created ON dispatch_agenda_items(username, created_at DESC);

DROP TRIGGER IF EXISTS update_dispatch_agenda_items_updated_at ON dispatch_agenda_items;
CREATE TRIGGER update_dispatch_agenda_items_updated_at
    BEFORE UPDATE ON dispatch_agenda_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- guest_chats
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guest_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    ip_address INET NOT NULL,
    chat_messages TEXT DEFAULT '[]',
    last_chat_update TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_chats_username ON guest_chats(username);
CREATE INDEX IF NOT EXISTS idx_guest_chats_ip ON guest_chats(ip_address);
CREATE INDEX IF NOT EXISTS idx_guest_chats_last_update ON guest_chats(last_chat_update);

DROP TRIGGER IF EXISTS update_guest_chats_updated_at ON guest_chats;
CREATE TRIGGER update_guest_chats_updated_at
    BEFORE UPDATE ON guest_chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- system_features / feature_history / updates / user_update_status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_key VARCHAR(100) UNIQUE NOT NULL,
    feature_name VARCHAR(200) NOT NULL,
    current_value JSONB NOT NULL,
    default_value JSONB NOT NULL,
    value_type VARCHAR(20) NOT NULL CHECK (value_type IN ('boolean', 'string', 'number', 'object')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_features_feature_key ON system_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_system_features_is_active ON system_features(is_active);

DROP TRIGGER IF EXISTS update_system_features_updated_at ON system_features;
CREATE TRIGGER update_system_features_updated_at
    BEFORE UPDATE ON system_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS feature_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_key VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    update_number VARCHAR(50),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_feature_history_feature_key ON feature_history(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_history_update_number ON feature_history(update_number);
CREATE INDEX IF NOT EXISTS idx_feature_history_changed_at ON feature_history(changed_at);

CREATE TABLE IF NOT EXISTS updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    update_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    feature_changes JSONB DEFAULT '[]'::jsonb,
    scheduled_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_updates_update_number ON updates(update_number);
CREATE INDEX IF NOT EXISTS idx_updates_is_active ON updates(is_active);
CREATE INDEX IF NOT EXISTS idx_updates_scheduled_at ON updates(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_updates_created_at ON updates(created_at);
CREATE INDEX IF NOT EXISTS idx_updates_feature_changes ON updates USING GIN (feature_changes);

DROP TRIGGER IF EXISTS update_updates_updated_at ON updates;
CREATE TRIGGER update_updates_updated_at
    BEFORE UPDATE ON updates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS user_update_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    update_number VARCHAR(50) NOT NULL,
    is_seen BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    seen_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(username, update_number)
);

CREATE INDEX IF NOT EXISTS idx_user_update_status_username ON user_update_status(username);
CREATE INDEX IF NOT EXISTS idx_user_update_status_update_number ON user_update_status(update_number);

DROP TRIGGER IF EXISTS update_user_update_status_updated_at ON user_update_status;
CREATE TRIGGER update_user_update_status_updated_at
    BEFORE UPDATE ON user_update_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- stock_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_requests (
    username VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    requests JSONB DEFAULT '{"pending": [], "processing": [], "completed": [], "failed": []}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_requests_username ON stock_requests(username);
CREATE INDEX IF NOT EXISTS idx_stock_requests_updated_at ON stock_requests(updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_requests_requests ON stock_requests USING GIN (requests);

CREATE OR REPLACE FUNCTION update_stock_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stock_requests_updated_at ON stock_requests;
CREATE TRIGGER update_stock_requests_updated_at
    BEFORE UPDATE ON stock_requests
    FOR EACH ROW EXECUTE FUNCTION update_stock_requests_updated_at();

-- ---------------------------------------------------------------------------
-- premium feature RPC (API tarafında da kullanılabilir)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_premium_feature(
    p_username VARCHAR(50),
    p_feature_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_premium_features JSONB;
    v_feature JSONB;
BEGIN
    SELECT premium_features INTO v_premium_features
    FROM users
    WHERE username = p_username
      AND is_active = TRUE;

    IF v_premium_features IS NULL THEN
        RETURN FALSE;
    END IF;

    v_feature := v_premium_features -> p_feature_name;

    IF jsonb_typeof(v_feature) = 'boolean' THEN
        RETURN v_feature::boolean;
    ELSIF jsonb_typeof(v_feature) = 'object' THEN
        RETURN COALESCE((v_feature ->> 'enabled')::boolean, FALSE);
    END IF;

    RETURN FALSE;
END;
$$;

-- ---------------------------------------------------------------------------
-- jetbarkod DB kullanıcı izinleri
-- ---------------------------------------------------------------------------
GRANT CONNECT ON DATABASE jetbarkod TO jetbarkod;
GRANT USAGE ON SCHEMA public TO jetbarkod;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jetbarkod;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jetbarkod;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO jetbarkod;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jetbarkod;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO jetbarkod;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO jetbarkod;
