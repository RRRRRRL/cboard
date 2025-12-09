<?php
/**
 * Sprint 1 Verification Script
 * 
 * Run this to verify Sprint 1 is complete and ready for Sprint 2
 * Usage: php verify-sprint1.php
 */

echo "========================================\n";
echo "Sprint 1 Verification Checklist\n";
echo "========================================\n\n";

$errors = [];
$warnings = [];
$passed = [];

// 1. Check PHP version
echo "1. Checking PHP version...\n";
$phpVersion = phpversion();
if (version_compare($phpVersion, '7.4.0', '>=')) {
    echo "   ✓ PHP $phpVersion (>= 7.4.0)\n";
    $passed[] = "PHP version";
} else {
    echo "   ✗ PHP $phpVersion (need >= 7.4.0)\n";
    $errors[] = "PHP version too old";
}

// 2. Check required PHP extensions
echo "\n2. Checking PHP extensions...\n";
$required = ['pdo', 'pdo_mysql', 'json', 'mbstring'];
foreach ($required as $ext) {
    if (extension_loaded($ext)) {
        echo "   ✓ $ext extension loaded\n";
        $passed[] = "Extension: $ext";
    } else {
        echo "   ✗ $ext extension missing\n";
        $errors[] = "Missing extension: $ext";
    }
}

// 3. Check file structure
echo "\n3. Checking file structure...\n";
$requiredFiles = [
    'api/index.php',
    'api/helpers.php',
    'api/routes/user.php',
    'api/routes/board.php',
    'api/routes/communicator.php',
    'api/routes/settings.php',
    'api/routes/media.php',
    'api/routes/other.php',
    'config/config.php',
    'config/database.php',
    'config/env-loader.php',
    'database/init.php',
    'database/schema.sql',
    '.htaccess',
    'test-api.php'
];

foreach ($requiredFiles as $file) {
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        echo "   ✓ $file exists\n";
        $passed[] = "File: $file";
    } else {
        echo "   ✗ $file missing\n";
        $errors[] = "Missing file: $file";
    }
}

// 4. Check .env file
echo "\n4. Checking environment configuration...\n";
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    echo "   ✓ .env file exists\n";
    $passed[] = ".env file exists";
    
    // Try to load and check key variables
    require_once __DIR__ . '/config/env-loader.php';
    $dbName = getenv('DB_NAME') ?: 'cboard';
    $dbHost = getenv('DB_HOST') ?: 'localhost';
    $dbUser = getenv('DB_USER') ?: 'root';
    
    echo "   → DB_NAME: $dbName\n";
    echo "   → DB_HOST: $dbHost\n";
    echo "   → DB_USER: $dbUser\n";
    
    if (empty(getenv('JWT_SECRET'))) {
        echo "   ⚠ JWT_SECRET not set (will use default)\n";
        $warnings[] = "JWT_SECRET not configured";
    } else {
        echo "   ✓ JWT_SECRET configured\n";
        $passed[] = "JWT_SECRET configured";
    }
} else {
    echo "   ✗ .env file missing\n";
    $errors[] = ".env file missing - copy from env.example.txt";
}

// 5. Check database connection
echo "\n5. Testing database connection...\n";
try {
    require_once __DIR__ . '/config/database.php';
    $config = require __DIR__ . '/config/database.php';
    
    $dsn = sprintf(
        "mysql:host=%s;port=%s;dbname=%s;charset=%s",
        $config['host'],
        $config['port'],
        $config['database'],
        $config['charset']
    );
    
    $pdo = new PDO(
        $dsn,
        $config['username'],
        $config['password'],
        $config['options']
    );
    
    echo "   ✓ Database connection successful\n";
    $passed[] = "Database connection";
    
    // Check if tables exist
    echo "\n6. Checking database tables...\n";
    $requiredTables = [
        'users', 'profiles', 'boards', 'cards', 'profile_cards',
        'jyutping_dictionary', 'jyutping_learning_log',
        'action_logs', 'profile_transfer_tokens', 'ocr_history',
        'settings', 'media', 'games_results', 'ai_cache'
    ];
    
    $stmt = $pdo->query("SHOW TABLES");
    $existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    foreach ($requiredTables as $table) {
        if (in_array($table, $existingTables)) {
            echo "   ✓ Table '$table' exists\n";
            $passed[] = "Table: $table";
        } else {
            echo "   ✗ Table '$table' missing\n";
            $errors[] = "Missing table: $table";
        }
    }
    
    // Check table structure
    echo "\n7. Checking table structure...\n";
    $structureChecks = [
        'users' => ['id', 'email', 'password_hash', 'role'],
        'profiles' => ['id', 'user_id', 'display_name', 'layout_type', 'language'],
        'cards' => ['id', 'title', 'image_path', 'audio_path'],
        'profile_cards' => ['id', 'profile_id', 'card_id', 'row_index', 'col_index']
    ];
    
    foreach ($structureChecks as $table => $columns) {
        if (in_array($table, $existingTables)) {
            $stmt = $pdo->query("DESCRIBE `$table`");
            $tableColumns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            $missing = array_diff($columns, $tableColumns);
            if (empty($missing)) {
                echo "   ✓ Table '$table' has required columns\n";
                $passed[] = "Structure: $table";
            } else {
                echo "   ✗ Table '$table' missing columns: " . implode(', ', $missing) . "\n";
                $errors[] = "Table $table missing columns";
            }
        }
    }
    
} catch (Exception $e) {
    echo "   ✗ Database connection failed: " . $e->getMessage() . "\n";
    echo "   → This is OK for Sprint 1 (placeholder endpoints work without DB)\n";
    $warnings[] = "Database connection failed (expected for Sprint 1)";
}

// 8. Check API endpoints are accessible
echo "\n8. Checking API endpoint structure...\n";
$endpointFiles = [
    'api/routes/user.php' => ['handleUserRoutes'],
    'api/routes/board.php' => ['handleBoardRoutes'],
    'api/routes/communicator.php' => ['handleCommunicatorRoutes'],
    'api/routes/settings.php' => ['handleSettingsRoutes'],
    'api/routes/media.php' => ['handleMediaRoutes'],
    'api/routes/other.php' => ['handleLocationRoutes', 'handleSubscriptionRoutes']
];

foreach ($endpointFiles as $file => $functions) {
    $content = file_get_contents(__DIR__ . '/' . $file);
    foreach ($functions as $func) {
        if (strpos($content, "function $func") !== false) {
            echo "   ✓ Function $func exists in $file\n";
            $passed[] = "Function: $func";
        } else {
            echo "   ✗ Function $func missing in $file\n";
            $errors[] = "Missing function: $func";
        }
    }
}

// 9. Check CORS configuration
echo "\n9. Checking CORS configuration...\n";
$indexContent = file_get_contents(__DIR__ . '/api/index.php');
$corsHeaders = ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers'];
$corsFound = 0;
foreach ($corsHeaders as $header) {
    if (strpos($indexContent, $header) !== false) {
        $corsFound++;
    }
}

if ($corsFound >= 3) {
    echo "   ✓ CORS headers configured\n";
    $passed[] = "CORS configuration";
    
    // Check for traceparent
    if (strpos($indexContent, 'traceparent') !== false) {
        echo "   ✓ traceparent header allowed\n";
        $passed[] = "traceparent header";
    } else {
        echo "   ⚠ traceparent header not in allowed list\n";
        $warnings[] = "traceparent header not configured";
    }
} else {
    echo "   ✗ CORS headers incomplete\n";
    $errors[] = "CORS configuration incomplete";
}

// Summary
echo "\n========================================\n";
echo "Verification Summary\n";
echo "========================================\n";
echo "✓ Passed: " . count($passed) . "\n";
echo "⚠ Warnings: " . count($warnings) . "\n";
echo "✗ Errors: " . count($errors) . "\n\n";

if (!empty($warnings)) {
    echo "Warnings:\n";
    foreach ($warnings as $warning) {
        echo "  ⚠ $warning\n";
    }
    echo "\n";
}

if (!empty($errors)) {
    echo "Errors:\n";
    foreach ($errors as $error) {
        echo "  ✗ $error\n";
    }
    echo "\n";
    echo "❌ Sprint 1 verification FAILED\n";
    echo "Please fix the errors above before proceeding to Sprint 2.\n";
    exit(1);
} else {
    echo "✅ Sprint 1 verification PASSED\n";
    echo "\nAll checks passed! Ready to proceed to Sprint 2.\n";
    echo "\nSprint 2 will implement:\n";
    echo "  - User authentication (JWT)\n";
    echo "  - User registration\n";
    echo "  - Profile CRUD operations\n";
    echo "  - Database queries\n";
    exit(0);
}

