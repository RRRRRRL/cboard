<?php
/**
 * Create Admin User Script
 * 
 * This PHP script creates a default admin account for Cboard.
 * Run this from command line: php create-admin-user.php
 * 
 * Default Admin Credentials:
 *   Email: admin@aac.uplifor.org
 *   Password: Admin123! (CHANGE THIS AFTER FIRST LOGIN)
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../database/init.php';
require_once __DIR__ . '/../api/auth.php';

$db = getDB();

if (!$db) {
    die("Error: Database connection failed.\n");
}

$adminEmail = 'admin@aac.uplifor.org';
$adminPassword = 'Admin123!'; // CHANGE THIS AFTER FIRST LOGIN
$adminName = 'Administrator';

echo "========================================\n";
echo "Creating Admin User Account\n";
echo "========================================\n\n";

// Check if admin user already exists
$stmt = $db->prepare("SELECT id, email, role FROM users WHERE email = ?");
$stmt->execute([$adminEmail]);
$existingUser = $stmt->fetch();

if ($existingUser) {
    echo "User with email '{$adminEmail}' already exists.\n";
    echo "Updating to admin role...\n";
    
    // Update existing user to admin
    $passwordHash = Password::hash($adminPassword);
    $stmt = $db->prepare("
        UPDATE users 
        SET password_hash = ?,
            name = ?,
            role = 'admin',
            is_active = 1,
            is_verified = 1,
            updated_at = NOW()
        WHERE email = ?
    ");
    $stmt->execute([$passwordHash, $adminName, $adminEmail]);
    
    echo "✓ User updated to admin role.\n\n";
} else {
    echo "Creating new admin user...\n";
    
    // Create new admin user
    $passwordHash = Password::hash($adminPassword);
    $stmt = $db->prepare("
        INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at, updated_at)
        VALUES (?, ?, ?, 'admin', 1, 1, NOW(), NOW())
    ");
    $stmt->execute([$adminEmail, $passwordHash, $adminName]);
    
    echo "✓ Admin user created successfully.\n\n";
}

// Verify admin user
$stmt = $db->prepare("
    SELECT id, email, name, role, is_active, is_verified, created_at
    FROM users 
    WHERE email = ? AND role = 'admin'
");
$stmt->execute([$adminEmail]);
$admin = $stmt->fetch();

if ($admin) {
    echo "========================================\n";
    echo "Admin Account Details:\n";
    echo "========================================\n";
    echo "ID:        {$admin['id']}\n";
    echo "Email:     {$admin['email']}\n";
    echo "Name:      {$admin['name']}\n";
    echo "Role:      {$admin['role']}\n";
    echo "Active:    " . ($admin['is_active'] ? 'Yes' : 'No') . "\n";
    echo "Verified:  " . ($admin['is_verified'] ? 'Yes' : 'No') . "\n";
    echo "Created:   {$admin['created_at']}\n";
    echo "\n";
    echo "========================================\n";
    echo "Login Credentials:\n";
    echo "========================================\n";
    echo "Email:     {$adminEmail}\n";
    echo "Password:  {$adminPassword}\n";
    echo "\n";
    echo "⚠️  IMPORTANT: Change the password immediately after first login!\n";
    echo "\n";
    echo "Admin Panel Location:\n";
    echo "  - Login to the application\n";
    echo "  - Go to Settings (gear icon)\n";
    echo "  - Look for 'Admin Panel' option in the settings menu\n";
    echo "  - Or navigate directly to: /settings/admin\n";
    echo "\n";
} else {
    echo "✗ Error: Failed to create/verify admin user.\n";
    exit(1);
}

// List all admin users
$stmt = $db->prepare("
    SELECT id, email, name, role, is_active, created_at
    FROM users 
    WHERE role = 'admin'
    ORDER BY created_at DESC
");
$stmt->execute();
$allAdmins = $stmt->fetchAll();

if (count($allAdmins) > 0) {
    echo "========================================\n";
    echo "All Admin Users:\n";
    echo "========================================\n";
    foreach ($allAdmins as $admin) {
        echo sprintf(
            "ID: %-5d | Email: %-30s | Name: %-20s | Active: %s\n",
            $admin['id'],
            $admin['email'],
            $admin['name'],
            $admin['is_active'] ? 'Yes' : 'No'
        );
    }
    echo "\n";
}

echo "Done!\n";

