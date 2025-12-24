<?php
/**
 * Migration Script: Boards to Profiles (Complete Migration)
 * 
 * This script migrates all boards data to the new profile-centric structure:
 * - boards -> profiles (one board = one profile)
 * - board_data.tiles -> cards + profile_cards
 * 
 * Run this script after ensuring all boards have been migrated to profiles.
 * This script will:
 * 1. Extract tiles from board_data JSON
 * 2. Create cards for each tile
 * 3. Link cards to profiles via profile_cards
 * 4. Remove root_board_id from profiles
 * 5. Optionally drop the boards table
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();
if (!$db) {
    die("Database connection failed\n");
}

echo "=== Boards to Profiles Complete Migration ===\n\n";

// Step 1: Get all profiles that still have root_board_id
echo "Step 1: Finding profiles with root_board_id...\n";
$stmt = $db->prepare("
    SELECT id, user_id, display_name, root_board_id, is_public
    FROM profiles
    WHERE root_board_id IS NOT NULL
");
$stmt->execute();
$profilesWithBoards = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Found " . count($profilesWithBoards) . " profiles with root_board_id\n\n";

$migratedCount = 0;
$errorCount = 0;

foreach ($profilesWithBoards as $profile) {
    $profileId = $profile['id'];
    $rootBoardId = $profile['root_board_id'];
    
    echo "Processing profile ID {$profileId} (root_board_id: {$rootBoardId})...\n";
    
    try {
        // Get board data
        $stmt = $db->prepare("
            SELECT board_data, name, description, is_public
            FROM boards
            WHERE board_id = ?
        ");
        $stmt->execute([$rootBoardId]);
        $board = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$board || !$board['board_data']) {
            echo "  ⚠️  Board data not found, skipping...\n";
            continue;
        }
        
        $boardData = json_decode($board['board_data'], true);
        if (!$boardData || !is_array($boardData)) {
            echo "  ⚠️  Invalid board_data JSON, skipping...\n";
            continue;
        }
        
        // Extract tiles from board_data
        $tiles = $boardData['tiles'] ?? [];
        if (empty($tiles) || !is_array($tiles)) {
            echo "  ℹ️  No tiles found in board_data, removing root_board_id only...\n";
            // Just remove root_board_id, no cards to migrate
            $stmt = $db->prepare("UPDATE profiles SET root_board_id = NULL WHERE id = ?");
            $stmt->execute([$profileId]);
            $migratedCount++;
            continue;
        }
        
        echo "  Found " . count($tiles) . " tiles to migrate...\n";
        
        $cardsCreated = 0;
        $profileCardsCreated = 0;
        
        // Process each tile
        foreach ($tiles as $tile) {
            if (!is_array($tile)) {
                continue;
            }
            
            // Extract tile data
            $title = $tile['label'] ?? $tile['title'] ?? '';
            $labelText = $tile['label'] ?? $tile['label_text'] ?? '';
            $imagePath = $tile['image'] ?? $tile['image_path'] ?? $tile['image_url'] ?? null;
            $audioPath = $tile['sound'] ?? $tile['sound_url'] ?? $tile['audio_path'] ?? null;
            $textColor = $tile['text_color'] ?? null;
            $backgroundColor = $tile['background_color'] ?? null;
            $category = $tile['category'] ?? 'general';
            
            // Get position from tile
            $rowIndex = isset($tile['row']) ? (int)$tile['row'] : (isset($tile['row_index']) ? (int)$tile['row_index'] : 0);
            $colIndex = isset($tile['col']) ? (int)$tile['col'] : (isset($tile['col_index']) ? (int)$tile['col_index'] : 0);
            $pageIndex = isset($tile['page']) ? (int)$tile['page'] : (isset($tile['page_index']) ? (int)$tile['page_index'] : 0);
            $isVisible = isset($tile['hidden']) ? !$tile['hidden'] : (isset($tile['is_visible']) ? (bool)$tile['is_visible'] : true);
            
            // Skip if no title/label
            if (empty($title) && empty($labelText)) {
                continue;
            }
            
            // Create or find card
            $cardId = null;
            
            // Try to find existing card by image_path (if unique)
            if ($imagePath) {
                $stmt = $db->prepare("SELECT id FROM cards WHERE image_path = ? LIMIT 1");
                $stmt->execute([$imagePath]);
                $existingCard = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($existingCard) {
                    $cardId = $existingCard['id'];
                }
            }
            
            // Create new card if not found
            if (!$cardId) {
                $stmt = $db->prepare("
                    INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([
                    $title ?: $labelText,
                    $labelText,
                    $imagePath,
                    $audioPath,
                    $textColor,
                    $backgroundColor,
                    $category
                ]);
                $cardId = $db->lastInsertId();
                $cardsCreated++;
            }
            
            // Check if profile_card already exists
            $stmt = $db->prepare("
                SELECT id FROM profile_cards
                WHERE profile_id = ? AND card_id = ? AND page_index = ? AND row_index = ? AND col_index = ?
            ");
            $stmt->execute([$profileId, $cardId, $pageIndex, $rowIndex, $colIndex]);
            $existingProfileCard = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existingProfileCard) {
                // Create profile_card link
                $stmt = $db->prepare("
                    INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([
                    $profileId,
                    $cardId,
                    $rowIndex,
                    $colIndex,
                    $pageIndex,
                    $isVisible ? 1 : 0
                ]);
                $profileCardsCreated++;
            }
        }
        
        // Update profile: remove root_board_id
        $stmt = $db->prepare("UPDATE profiles SET root_board_id = NULL WHERE id = ?");
        $stmt->execute([$profileId]);
        
        echo "  ✓ Migrated: {$cardsCreated} cards created, {$profileCardsCreated} profile_cards created\n";
        $migratedCount++;
        
    } catch (Exception $e) {
        echo "  ✗ Error: " . $e->getMessage() . "\n";
        $errorCount++;
    }
}

echo "\n=== Migration Summary ===\n";
echo "Profiles migrated: {$migratedCount}\n";
echo "Errors: {$errorCount}\n\n";

// Step 2: Ask if user wants to drop boards table
echo "=== Cleanup ===\n";
echo "Do you want to drop the boards table? (This is irreversible!)\n";
echo "Type 'yes' to proceed: ";
$handle = fopen("php://stdin", "r");
$line = trim(fgets($handle));
fclose($handle);

if (strtolower($line) === 'yes') {
    echo "Dropping boards table...\n";
    try {
        // Step 1: Remove foreign key constraints that reference boards table
        echo "  Removing foreign key constraints...\n";
        
        // Check and remove action_logs foreign key to boards
        $stmt = $db->query("SHOW CREATE TABLE action_logs");
        $createTable = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($createTable && strpos($createTable['Create Table'], 'action_logs_ibfk_3') !== false) {
            $db->exec("ALTER TABLE action_logs DROP FOREIGN KEY action_logs_ibfk_3");
            echo "  ✓ Removed action_logs_ibfk_3 foreign key\n";
        }
        
        // Check and remove other foreign keys to boards if they exist
        $stmt = $db->query("SHOW CREATE TABLE card_logs");
        $createTable = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($createTable && strpos($createTable['Create Table'], 'card_logs_ibfk') !== false) {
            // Find the constraint name
            $stmt = $db->query("
                SELECT CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'card_logs' 
                AND REFERENCED_TABLE_NAME = 'boards'
            ");
            $fk = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($fk) {
                $db->exec("ALTER TABLE card_logs DROP FOREIGN KEY {$fk['CONSTRAINT_NAME']}");
                echo "  ✓ Removed card_logs foreign key to boards\n";
            }
        }
        
        // Now drop the boards table
        $db->exec("DROP TABLE IF EXISTS boards");
        echo "✓ Boards table dropped\n";
    } catch (Exception $e) {
        echo "✗ Error dropping boards table: " . $e->getMessage() . "\n";
        echo "  You may need to manually remove foreign keys and drop the table:\n";
        echo "  ALTER TABLE action_logs DROP FOREIGN KEY action_logs_ibfk_3;\n";
        echo "  DROP TABLE IF EXISTS boards;\n";
    }
} else {
    echo "Boards table kept (you can drop it manually later)\n";
}

// Step 3: Remove root_board_id column from profiles (MySQL doesn't support IF EXISTS)
echo "\nRemoving root_board_id column from profiles table...\n";
try {
    // Check if column exists first
    $stmt = $db->query("SHOW COLUMNS FROM profiles LIKE 'root_board_id'");
    if ($stmt->rowCount() > 0) {
        $db->exec("ALTER TABLE profiles DROP COLUMN root_board_id");
        echo "✓ root_board_id column removed\n";
    } else {
        echo "ℹ️  root_board_id column does not exist (already removed)\n";
    }
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "   You may need to manually remove the root_board_id column:\n";
    echo "   ALTER TABLE profiles DROP COLUMN root_board_id;\n";
}

// Step 4: Remove name column from profiles (MySQL doesn't support IF EXISTS)
echo "\nRemoving name column from profiles table (keeping only display_name)...\n";
try {
    // Check if column exists first
    $stmt = $db->query("SHOW COLUMNS FROM profiles LIKE 'name'");
    if ($stmt->rowCount() > 0) {
        $db->exec("ALTER TABLE profiles DROP COLUMN name");
        echo "✓ name column removed\n";
    } else {
        echo "ℹ️  name column does not exist (already removed)\n";
    }
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "   You may need to manually remove the name column:\n";
    echo "   ALTER TABLE profiles DROP COLUMN name;\n";
}

// Step 5: Remove is_default column from profiles (MySQL doesn't support IF EXISTS)
echo "\nRemoving is_default column from profiles table...\n";
try {
    // Check if column exists first
    $stmt = $db->query("SHOW COLUMNS FROM profiles LIKE 'is_default'");
    if ($stmt->rowCount() > 0) {
        $db->exec("ALTER TABLE profiles DROP COLUMN is_default");
        echo "✓ is_default column removed\n";
    } else {
        echo "ℹ️  is_default column does not exist (already removed)\n";
    }
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "   You may need to manually remove the is_default column:\n";
    echo "   ALTER TABLE profiles DROP COLUMN is_default;\n";
}

// Step 6: Remove board_id column from action_logs (if it exists)
echo "\nRemoving board_id column from action_logs table...\n";
try {
    // Check if column exists first
    $stmt = $db->query("SHOW COLUMNS FROM action_logs LIKE 'board_id'");
    if ($stmt->rowCount() > 0) {
        $db->exec("ALTER TABLE action_logs DROP COLUMN board_id");
        echo "✓ board_id column removed from action_logs\n";
    } else {
        echo "ℹ️  board_id column does not exist in action_logs (already removed)\n";
    }
} catch (Exception $e) {
    echo "ℹ️  Note: " . $e->getMessage() . "\n";
    echo "   You may need to manually remove the board_id column:\n";
    echo "   ALTER TABLE action_logs DROP COLUMN board_id;\n";
}

echo "\n=== Migration Complete ===\n";

