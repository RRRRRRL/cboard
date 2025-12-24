# Admin Account Setup Guide

This guide explains how to create an admin account and access the admin panel in Cboard.

## Creating an Admin Account

There are two ways to create an admin account:

### Method 1: Using PHP Script (Recommended)

1. Navigate to the backend database directory:
   ```bash
   cd backend/database
   ```

2. Run the PHP script:
   ```bash
   php create-admin-user.php
   ```

3. The script will create an admin account with the following default credentials:
   - **Email**: `admin@aac.uplifor.org`
   - **Password**: `Admin123!`
   - **Name**: Administrator
   - **Role**: admin

4. **⚠️ IMPORTANT**: Change the password immediately after first login!

### Method 2: Using SQL Script

1. Navigate to the backend database directory:
   ```bash
   cd backend/database
   ```

2. Run the SQL script:
   ```bash
   mysql -u root -p cboard < create-admin-user.sql
   ```

3. Or execute the SQL directly in your MySQL client:
   ```sql
   USE cboard;
   -- Copy and paste the contents of create-admin-user.sql
   ```

## Default Admin Credentials

- **Email**: `admin@aac.uplifor.org`
- **Password**: `Admin123!` (CHANGE THIS AFTER FIRST LOGIN!)

## Accessing the Admin Panel

Once you have created an admin account and logged in:

1. **Login** to the application using the admin credentials
2. Click on the **Settings** icon (gear icon) in the top navigation
3. Look for **"Admin Panel"** option in the settings menu
   - It will only appear if you are logged in as an admin user
   - The option has a security/shield icon
4. Click on **"Admin Panel"** to access the admin interface

### Direct URL Access

You can also access the admin panel directly via URL:
- **URL**: `/settings/admin`
- **Full URL**: `https://aac.uplifor.org/settings/admin`

**Note**: You must be logged in as an admin user to access this page.

## Admin Panel Features

The admin panel provides the following features:

1. **User Management**
   - View all users with pagination
   - Search users by email or name
   - Filter users by role or status
   - View user details
   - Update user information (name, role, status)
   - Deactivate users

2. **Statistics Dashboard**
   - Total users count
   - Active/Inactive users
   - Users by role
   - Total profiles
   - Total action logs
   - Recent registrations (last 30 days)

## Creating Additional Admin Accounts

You can create additional admin accounts in two ways:

### Option 1: Through Admin Panel

1. Log in as an existing admin
2. Go to Admin Panel
3. Find the user you want to make an admin
4. Click "Edit" on that user
5. Change their role to "admin"
6. Save changes

### Option 2: Using SQL

```sql
USE cboard;

-- Update existing user to admin
UPDATE users 
SET role = 'admin', 
    updated_at = NOW() 
WHERE email = 'user@example.com';

-- Or create a new admin user
INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at, updated_at)
VALUES (
    'newadmin@example.com',
    '$2y$10$...', -- Generate using PHP: password_hash('YourPassword', PASSWORD_BCRYPT)
    'New Admin',
    'admin',
    1,
    1,
    NOW(),
    NOW()
);
```

## Security Best Practices

1. **Change Default Password**: Always change the default password immediately after first login
2. **Use Strong Passwords**: Admin accounts should use strong, unique passwords
3. **Limit Admin Accounts**: Only create admin accounts for trusted users
4. **Regular Audits**: Periodically review admin accounts and remove unnecessary ones
5. **Monitor Activity**: Check the action logs regularly for suspicious activity

## Troubleshooting

### Admin Panel Not Showing

If the admin panel option is not visible in settings:

1. **Check User Role**: Verify that your user account has `role = 'admin'` in the database:
   ```sql
   SELECT id, email, name, role FROM users WHERE email = 'your-email@example.com';
   ```

2. **Check Login Status**: Make sure you are logged in (not in guest mode)

3. **Clear Browser Cache**: Try clearing your browser cache and cookies, then log in again

4. **Check Redux State**: In development, check the browser console for user data:
   ```javascript
   // In browser console
   window.__REDUX_STORE__.getState().app.userData
   ```
   The `role` field should be `'admin'`

### Cannot Access Admin Panel

If you get a 403 Forbidden error when accessing the admin panel:

1. Verify your user role in the database
2. Log out and log back in to refresh your session
3. Check that the backend API is correctly checking the admin role

## Database Schema

The `users` table has the following role-related fields:

- `role`: ENUM('admin','teacher','therapist','parent','student') - User's role
- `is_active`: TINYINT(1) - Whether the account is active
- `is_verified`: TINYINT(1) - Whether the email is verified

## Support

For issues or questions about admin functionality, please check:
- Backend API logs: `backend/api/routes/admin.php`
- Frontend component: `src/components/Settings/AdminPanel/`
- Database schema: `backend/database/schema.sql`

