<?php
/**
 * Simple API Test Script
 * 
 * Run this to verify the API is working:
 * php test-api.php
 */

echo "Testing Cboard API Setup...\n\n";

// Test 1: Check PHP version
echo "1. PHP Version: " . phpversion() . "\n";
if (version_compare(phpversion(), '7.4.0', '>=')) {
    echo "   ✓ PHP version is sufficient\n";
} else {
    echo "   ✗ PHP 7.4+ required\n";
}

// Test 2: Check required extensions
echo "\n2. Checking PHP Extensions:\n";
$required = ['pdo', 'pdo_mysql', 'json', 'mbstring'];
foreach ($required as $ext) {
    if (extension_loaded($ext)) {
        echo "   ✓ $ext extension loaded\n";
    } else {
        echo "   ✗ $ext extension missing\n";
    }
}

// Test 3: Check database connection
echo "\n3. Testing Database Connection:\n";
try {
    require_once __DIR__ . '/config/database.php';
    $dbConfig = require __DIR__ . '/config/database.php';
    
    $dsn = sprintf(
        "mysql:host=%s;port=%s;dbname=%s;charset=%s",
        $dbConfig['host'],
        $dbConfig['port'],
        $dbConfig['database'],
        $dbConfig['charset']
    );
    
    $pdo = new PDO(
        $dsn,
        $dbConfig['username'],
        $dbConfig['password'],
        $dbConfig['options']
    );
    
    echo "   ✓ Database connection successful\n";
    
    // Test 4: Check if tables exist
    echo "\n4. Checking Database Tables:\n";
    $tables = ['users', 'profiles', 'boards', 'cards', 'settings', 'media'];
    $stmt = $pdo->query("SHOW TABLES");
    $existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    foreach ($tables as $table) {
        if (in_array($table, $existingTables)) {
            echo "   ✓ Table '$table' exists\n";
        } else {
            echo "   ✗ Table '$table' missing\n";
        }
    }
    
} catch (Exception $e) {
    echo "   ✗ Database connection failed: " . $e->getMessage() . "\n";
    echo "   → Make sure MySQL is running and database is created\n";
    echo "   → Run: mysql -u root -p cboard < database/schema.sql\n";
}

// Test 5: Check API files
echo "\n5. Checking API Files:\n";
$files = [
    'api/index.php',
    'api/helpers.php',
    'api/routes/user.php',
    'api/routes/board.php',
    'config/config.php',
    'config/database.php',
    'database/init.php',
    'database/schema.sql'
];

foreach ($files as $file) {
    if (file_exists(__DIR__ . '/' . $file)) {
        echo "   ✓ $file exists\n";
    } else {
        echo "   ✗ $file missing\n";
    }
}

echo "\n=== Test Complete ===\n";
echo "If all tests pass, you can start the API server with:\n";
echo "  php -S localhost:8000 -t api api/index.php\n";
echo "\nThen test the API with:\n";
echo "  curl http://localhost:8000/\n";

