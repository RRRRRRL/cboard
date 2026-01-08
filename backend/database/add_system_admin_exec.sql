-- Add default system admin for aac.uplifor
-- Password: Admin@2026

START TRANSACTION;

SET @admin_email := 'admin@aac.uplifor.org';
SET @admin_name  := 'System Admin';
SET @admin_password_hash := '$2y$10$TzpMAVFTFrJMYFjj4LxgVO4cvVcHviYdl4DMpgI/piN6VMWUdo2Qu';

-- Ensure organization exists
INSERT INTO organizations (name, description, is_active, subscription_type, created_at, updated_at)
SELECT 'aac.uplifor', 'Default org for aac.uplifor', 1, 'enterprise', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE name = 'aac.uplifor'
);
SET @org_id := (SELECT id FROM organizations WHERE name = 'aac.uplifor' ORDER BY id LIMIT 1);

-- Ensure admin user exists with BINARY comparison to avoid collation issues
INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at, updated_at)
SELECT @admin_email, @admin_password_hash, @admin_name, 'admin', 1, 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE BINARY email = BINARY @admin_email
);
SET @user_id := (SELECT id FROM users WHERE BINARY email = BINARY @admin_email);

-- Grant system_admin role for this org
INSERT INTO user_organization_roles (user_id, organization_id, role, is_primary, assigned_at, is_active)
SELECT @user_id, @org_id, 'system_admin', 1, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM user_organization_roles
  WHERE user_id = @user_id AND organization_id = @org_id AND role = 'system_admin'
);

COMMIT;
