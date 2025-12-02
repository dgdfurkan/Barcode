-- Premium Features RPC Function for Backend Validation
-- This function validates premium features server-side for security

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
BEGIN
    -- Get user's premium features
    SELECT premium_features INTO v_premium_features
    FROM users
    WHERE username = p_username
    AND is_active = true;
    
    -- If no user found or features is null, return false
    IF v_premium_features IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if the feature is enabled (equals true)
    RETURN COALESCE((v_premium_features->>p_feature_name)::boolean, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_premium_feature(VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_premium_feature(VARCHAR, TEXT) TO anon;

-- Add comment
COMMENT ON FUNCTION check_premium_feature IS 'Validates if a user has a specific premium feature enabled. Returns true if feature is enabled, false otherwise.';

