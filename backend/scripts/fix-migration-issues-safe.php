<?php
/**
 * Safe Migration Fix Script
 * 
 * This script safely removes foreign keys and columns without using
 * unsupported MySQL syntax like "IF EXISTS"
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();
if (!$db) {
    die("Database connection failed\n");
}

echo "=== Safe Migration Fix Script ===\n\n";

// Step 1: Remove foreign key constraints
echo "Step 1: Removing foreign key constraints...\n";

// Remove action_logs foreign key to boards
try {
    $stmt = $db->query("
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'action_logs' 
        AND REFERENCED_TABLE_NAME = 'boards'
    ");
    $fks = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($fks as $fk) {
        $constraintName = $fk['CONSTRAINT_NAME'];
        try {
            $db->exec("ALTER TABLE action_logs DROP FOREIGN KEY `{$constraintName}`");
            echo "  ✓ Removed foreign key: {$constraintName}\n";
        } catch (Exception $e) {
            echo "  ⚠️  Could not remove {$constraintName}: " . $e->getMessage() . "\n";
        }
    }
    if (empty($fks)) {
        echo "  ℹ️  No foreign keys found in action_logs referencing boards\n";
    }
} catch (Exception $e) {
    echo "  ⚠️  Error checking action_logs foreign keys: " . $e->getMessage() . "\n";
}

// Remove card_logs foreign key to boards (if table exists)
try {
    $stmt = $db->query("SHOW TABLES LIKE 'card_logs'");
    if ($stmt->rowCount() > 0) {
        $stmt = $db->query("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'card_logs' 
            AND REFERENCED_TABLE_NAME = 'boards'
        ");
        $fks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($fks as $fk) {
            $constraintName = $fk['CONSTRAINT_NAME'];
            try {
                $db->exec("ALTER TABLE card_logs DROP FOREIGN KEY `{$constraintName}`");
                echo "  ✓ Removed foreign key from card_logs: {$constraintName}\n";
            } catch (Exception $e) {
                echo "  ⚠️  Could not remove {$constraintName}: " . $e->getMessage() . "\n";
            }
        }
    }
} catch (Exception $e) {
    echo "  ℹ️  card_logs table check: " . $e->getMessage() . "\n";
}

// Step 2: Remove board_id column from action_logs
echo "\nStep 2: Removing board_id column from action_logs...\n";
try {
    $stmt = $db->query("SHOW COLUMNS FROM action_logs LIKE 'board_id'");
    if ($stmt->rowCount() > 0) {
        $db->exec("ALTER TABLE action_logs DROP COLUMN board_id");
        echo "  ✓ Removed board_id column from action_logs\n";
    } else {
        echo "  ℹ️  board_id column does not exist in action_logs\n";
    }
} catch (Exception $e) {
    echo "  ⚠️  Error: " . $e->getMessage() . "\n";
}

// Step 3: Drop boards table
echo "\nStep 3: Dropping boards table...\n";
try {
    $stmt = $db->query("SHOW TABLES LIKE 'boards'");
    if ($stmt->rowCount() > 0) {
        $db->exec("DROP TABLE boards");
        echo "  ✓ Boards table dropped\n";
    } else {
        echo "  ℹ️  Boards table does not exist\n";
    }
} catch (Exception $e) {
    echo "  ✗ Error dropping boards table: " . $e->getMessage() . "\n";
    echo "  You may need to manually check for remaining foreign keys\n";
}

// Step 4: Remove columns from profiles table
echo "\nStep 4: Removing columns from profiles table...\n";

// Remove root_board_id
try {
    $stmt = $db->query("SHOW COLUMNS FROM profiles LIKE 'root_board_id'");
    if ($stmt->rowCount() > 0) {
        $db->exec("ALTER TABLE profiles DROP COLUMN root_board_id");
        echo "  ✓ Removed root_board_id column\n";
    } else {
        echo "  ℹ️  root_board_id column does not exist\n";
    }
} catch (Exception $e) {
    echo "  ⚠️  Error removing root_board_id: " . $e->getMessage() . "\n";
}

// Remove name column
try {
    $stmt = $db->query("SHOW COLUMNS FROM profiles LIKE 'name'");
    if ($stmt->rowCount() > 0) {
        $db->exec("ALTER TABLE profiles DROP COLUMN name");
        echo "  ✓ Removed name column\n";
    } else {
        echo "  ℹ️  name column does not exist\n";
    }
} catch (Exception $e) {
    echo "  ⚠️  Error removing name: " . $e->getMessage() . "\n";
}

// Remove is_default column
try {
    $stmt = $db->query("SHOW COLUMNS FROM profiles LIKE 'is_default'");
    if ($stmt->rowCount() > 0) {
        $db->exec("ALTER TABLE profiles DROP COLUMN is_default");
        echo "  ✓ Removed is_default column\n";
    } else {
        echo "  ℹ️  is_default column does not exist\n";
    }
} catch (Exception $e) {
    echo "  ⚠️  Error removing is_default: " . $e->getMessage() . "\n";
}

echo "\n=== Fix Complete ===\n";
echo "If you still see errors, you may need to manually run SQL commands.\n";
echo "See fix-migration-issues.sql for manual SQL commands.\n";

