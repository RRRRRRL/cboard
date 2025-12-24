<?php
/**
 * Server API Diagnostic Script
 * 
 * This script checks the server configuration and API setup
 * Usage: php backend/scripts/check-server-api.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "==========================================\n";
echo " Server API Diagnostic Check\n";
echo "==========================================\n\n";

// 1. Check PHP version
echo "[1] PHP Version: " . PHP_VERSION . "\n";
if (version_compare(PHP_VERSION, '7.4.0', '<')) {
    echo "    [WARNING] PHP 7.4+ recommended\n";
} else {
    echo "    [OK] PHP version is acceptable\n";
}

// 2. Check required PHP extensions
echo "\n[2] PHP Extensions:\n";
$requiredExtensions = ['pdo', 'pdo_mysql', 'json', 'mbstring'];
foreach ($requiredExtensions as $ext) {
    if (extension_loaded($ext)) {
        echo "    [OK] $ext\n";
    } else {
        echo "    [ERROR] $ext is NOT loaded\n";
    }
}

// 3. Check .env file
echo "\n[3] Environment Configuration:\n";
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    echo "    [OK] .env file exists\n";
    require_once __DIR__ . '/../config/env-loader.php';
    
    $envVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET'];
    foreach ($envVars as $var) {
        $value = getenv($var);
        if ($value) {
            // Mask sensitive values
            if (in_array($var, ['DB_PASS', 'JWT_SECRET'])) {
                echo "    [OK] $var is set (value hidden)\n";
            } else {
                echo "    [OK] $var = $value\n";
            }
        } else {
            echo "    [WARNING] $var is not set\n";
        }
    }
} else {
    echo "    [WARNING] .env file not found at: $envFile\n";
}

// 4. Check database connection
echo "\n[4] Database Connection:\n";
try {
    // Load required files in correct order
    require_once __DIR__ . '/../config/config.php';
    require_once __DIR__ . '/../database/init.php';
    require_once __DIR__ . '/../api/auth.php'; // Load auth.php to make classes available
    $db = getDB();
    if ($db) {
        echo "    [OK] Database connection successful\n";
        
        // Test query
        $stmt = $db->query("SELECT 1");
        if ($stmt) {
            echo "    [OK] Database query test successful\n";
        }
        
        // Check if users table exists
        $stmt = $db->query("SHOW TABLES LIKE 'users'");
        if ($stmt->rowCount() > 0) {
            echo "    [OK] Users table exists\n";
            
            // Check table structure
            $stmt = $db->query("DESCRIBE users");
            $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
            $requiredColumns = ['id', 'email', 'password_hash', 'name', 'role', 'auth_token'];
            $missingColumns = array_diff($requiredColumns, $columns);
            if (empty($missingColumns)) {
                echo "    [OK] Users table has all required columns\n";
            } else {
                echo "    [ERROR] Users table missing columns: " . implode(', ', $missingColumns) . "\n";
            }
        } else {
            echo "    [ERROR] Users table does not exist\n";
        }
    } else {
        echo "    [ERROR] Database connection returned null\n";
    }
} catch (Exception $e) {
    echo "    [ERROR] Database connection failed: " . $e->getMessage() . "\n";
    echo "    Error trace: " . $e->getTraceAsString() . "\n";
}

// 5. Check required classes
echo "\n[5] Required Classes:\n";
// Load auth.php if not already loaded
if (!class_exists('JWT')) {
    $authFile = __DIR__ . '/../api/auth.php';
    if (file_exists($authFile)) {
        require_once $authFile;
        echo "    [INFO] Loaded auth.php\n";
    } else {
        echo "    [ERROR] auth.php not found at: $authFile\n";
    }
}
$requiredClasses = ['JWT', 'Password'];
foreach ($requiredClasses as $class) {
    if (class_exists($class)) {
        echo "    [OK] $class class exists\n";
    } else {
        echo "    [ERROR] $class class NOT found\n";
        if ($class === 'JWT') {
            $authFile = __DIR__ . '/../api/auth.php';
            if (file_exists($authFile)) {
                echo "    [INFO] auth.php exists but class not loaded\n";
            } else {
                echo "    [ERROR] auth.php NOT found at: $authFile\n";
            }
        }
    }
}

// 6. Check file permissions
echo "\n[6] File Permissions:\n";
$importantDirs = [
    __DIR__ . '/../uploads' => 'uploads directory',
    __DIR__ . '/../api' => 'api directory'
];
foreach ($importantDirs as $dir => $desc) {
    if (is_dir($dir)) {
        if (is_writable($dir)) {
            echo "    [OK] $desc is writable\n";
        } else {
            echo "    [WARNING] $desc is NOT writable\n";
        }
    } else {
        echo "    [WARNING] $desc does not exist\n";
    }
}

// 7. Test API endpoint
echo "\n[7] API Endpoint Test:\n";
$apiIndex = __DIR__ . '/../api/index.php';
if (file_exists($apiIndex)) {
    echo "    [OK] API index.php exists\n";
    
    // Check if it can be included (syntax check)
    $output = [];
    $returnCode = 0;
    exec("php -l $apiIndex 2>&1", $output, $returnCode);
    if ($returnCode === 0) {
        echo "    [OK] API index.php syntax is valid\n";
    } else {
        echo "    [ERROR] API index.php has syntax errors:\n";
        echo "    " . implode("\n    ", $output) . "\n";
    }
} else {
    echo "    [ERROR] API index.php not found\n";
}

echo "\n==========================================\n";
echo " Diagnostic check complete\n";
echo "==========================================\n";

