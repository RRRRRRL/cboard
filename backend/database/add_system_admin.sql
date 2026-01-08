-- Add default system admin for aac.uplifor
-- Usage: mysql -u <db_user> -p cboard < backend/database/add_system_admin.sql
-- Before running, replace the password hash below with a bcrypt hash:
--   php -r "echo password_hash('YourStrongPasswordHere', PASSWORD_BCRYPT), "\n";"

START TRANSACTION;

SET @admin_email := 'admin@aac.uplifor.org';
SET @admin_name  := 'System Admin';
SET @admin_password_hash := '$2y$10$REPLACE_WITH_YOUR_BCRYPT_HASH';

-- Ensure organization exists
INSERT INTO organizations (name, description, is_active, subscription_type, created_at, updated_at)
SELECT 'aac.uplifor', 'Default org for aac.uplifor', 1, 'enterprise', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE name = 'aac.uplifor'
);
SET @org_id := (SELECT id FROM organizations WHERE name = 'aac.uplifor' ORDER BY id LIMIT 1);

-- Ensure admin user exists
INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at, updated_at)
SELECT @admin_email, @admin_password_hash, @admin_name, 'admin', 1, 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = @admin_email
);
SET @user_id := (SELECT id FROM users WHERE email = @admin_email);

-- Grant system_admin role for this org
INSERT INTO user_organization_roles (user_id, organization_id, role, is_primary, assigned_at, is_active)
SELECT @user_id, @org_id, 'system_admin', 1, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM user_organization_roles
  WHERE user_id = @user_id AND organization_id = @org_id AND role = 'system_admin'
);

COMMIT;
