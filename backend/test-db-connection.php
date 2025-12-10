<?php
/**
 * Test Database Connection
 * Run: php test-db-connection.php
 */

require_once __DIR__ . '/database/init.php';
require_once __DIR__ . '/config/database.php';

echo "🔍 Testing database connection...\n\n";

$config = require __DIR__ . '/config/database.php';

echo "Configuration:\n";
echo "  Host: " . $config['host'] . "\n";
echo "  Port: " . $config['port'] . "\n";
echo "  Database: " . $config['database'] . "\n";
echo "  User: " . $config['username'] . "\n";
echo "\n";

try {
    $db = getDB();
    
    if ($db) {
        echo "✅ Database connection successful!\n\n";
        
        // Test query
        $stmt = $db->query("SELECT COUNT(*) as count FROM users");
        $result = $stmt->fetch();
        echo "✅ Test query successful!\n";
        echo "   Users table exists (count: " . $result['count'] . ")\n\n";
        
        // Show tables
        $stmt = $db->query("SHOW TABLES");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo "📋 Available tables (" . count($tables) . "):\n";
        foreach ($tables as $table) {
            echo "   - $table\n";
        }
        
        echo "\n✅ Database is ready for use!\n";
        exit(0);
    } else {
        echo "❌ Database connection failed: getDB() returned null\n";
        echo "\n💡 Make sure:\n";
        echo "   1. Database is running\n";
        echo "   2. backend/.env file exists with correct credentials\n";
        echo "   3. DB_PORT=3307 (if using Docker MySQL)\n";
        exit(1);
    }
} catch (Exception $e) {
    echo "❌ Database connection failed!\n";
    echo "   Error: " . $e->getMessage() . "\n";
    echo "\n💡 Troubleshooting:\n";
    echo "   1. Check if database is running:\n";
    echo "      docker ps --filter name=cboard-database\n";
    echo "   2. Verify backend/.env has:\n";
    echo "      DB_HOST=localhost\n";
    echo "      DB_PORT=3307\n";
    echo "      DB_NAME=cboard\n";
    echo "      DB_USER=cboard_user\n";
    echo "      DB_PASS=Igear\n";
    exit(1);
}

