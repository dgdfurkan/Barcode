-- Supabase Database Schema for Product Barcode Search System

-- Users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    company VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    trial_end TIMESTAMP WITH TIME ZONE NOT NULL,
    allowed_ips TEXT[] DEFAULT ARRAY['*'],
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User data table (for products, settings, etc.)
CREATE TABLE user_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, read, resolved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IP logs table
CREATE TABLE ip_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    logout_time TIMESTAMP WITH TIME ZONE,
    session_duration INTEGER -- in seconds
);

-- Rate limiting table
CREATE TABLE rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address INET NOT NULL,
    attempts INTEGER DEFAULT 1,
    last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_user_data_username ON user_data(username);
CREATE INDEX idx_messages_username ON messages(username);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_ip_logs_username ON ip_logs(username);
CREATE INDEX idx_ip_logs_ip ON ip_logs(ip_address);
CREATE INDEX idx_rate_limits_ip ON rate_limits(ip_address);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (username = current_setting('app.current_user', true));

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE username = current_setting('app.current_user', true) 
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE username = current_setting('app.current_user', true) 
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can update users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE username = current_setting('app.current_user', true) 
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can delete users" ON users
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE username = current_setting('app.current_user', true) 
            AND is_admin = true
        )
    );

-- Policies for user_data table
CREATE POLICY "Users can manage their own data" ON user_data
    FOR ALL USING (username = current_setting('app.current_user', true));

-- Policies for messages table
CREATE POLICY "Users can create messages" ON messages
    FOR INSERT WITH CHECK (username = current_setting('app.current_user', true));

CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (username = current_setting('app.current_user', true));

CREATE POLICY "Admins can view all messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE username = current_setting('app.current_user', true) 
            AND is_admin = true
        )
    );

-- Insert demo users
-- Insert sample users (remove these in production)
INSERT INTO users (username, password, company, trial_end, is_admin) VALUES
('sample.user', 'secure_password_123', 'Sample Company', '2025-12-31 23:59:59+00', false),
('admin.user', 'admin_secure_password_456', 'Admin Company', '2025-12-31 23:59:59+00', true);

-- Insert sample user data
INSERT INTO user_data (username, data) VALUES
('sample.user', '{"products": [], "settings": {"showDuplicates": false, "theme": "light", "searchHistory": [], "showDefaultProducts": true}, "statistics": {"totalSearches": 0, "totalProducts": 0, "lastLogin": null}}'),
('admin.user', '{"products": [], "settings": {"showDuplicates": false, "theme": "light", "searchHistory": [], "showDefaultProducts": true}, "statistics": {"totalSearches": 0, "totalProducts": 0, "lastLogin": null}}');

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_data_updated_at BEFORE UPDATE ON user_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
