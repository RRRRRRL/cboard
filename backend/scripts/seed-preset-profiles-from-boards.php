<?php
/**
 * Seed Preset Profiles from boards.json
 * 
 * This script:
 * 1. Deletes all existing preset profiles (user_id = 1)
 * 2. Reads the first 10 root boards from boards.json
 * 3. Creates profiles for each board (is_public = 1)
 * 4. Creates cards for each tile in the board
 * 5. Links cards to profiles via profile_cards
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();
if (!$db) {
    die("Database connection failed\n");
}

// Load boards.json
$boardsJsonPath = __DIR__ . '/../../src/api/boards.json';
if (!file_exists($boardsJsonPath)) {
    die("Error: boards.json not found at {$boardsJsonPath}\n");
}

$boardsData = json_decode(file_get_contents($boardsJsonPath), true);
if (!$boardsData || !isset($boardsData['advanced'])) {
    die("Error: Invalid boards.json format\n");
}

// Define the 10 preset boards (first 10 root boards from root board tiles)
$presetBoardIds = [
    'BJgYav2vp-',  // quickChat
    'r1-FTvnvaW',  // food
    'HJmKTw2vT-',  // drinks
    'HkYF6DnP6-',  // emotions
    'BkmeFaw3DpZ', // activities
    'HkBY6DhwTW',  // snacks
    'BJRtpPnP6b',  // time
    'rJ3FTw2D6b',  // body
    'BJ5KawhwTZ',  // clothing
    'SkUlYTw3wT-', // people
];

// Profile name mapping (from nameKey to display name)
$profileNameMap = [
    'cboard.symbol.quickChat' => 'Quick Chat',
    'symbol.foodBreadsAndBaking.food' => 'Food',
    'symbol.drinkDescription.drinks' => 'Drinks',
    'cboard.symbol.emotions' => 'Emotions',
    'cboard.symbol.activities' => 'Activities',
    'cboard.symbol.snacks' => 'Snacks',
    'cboard.symbol.time' => 'Time',
    'cboard.symbol.body' => 'Body',
    'cboard.symbol.clothing' => 'Clothing',
    'cboard.symbol.people' => 'People',
];

echo "=== Seed Preset Profiles from boards.json ===\n\n";

// Step 1: Delete all existing preset public profiles (user_id = 1 AND is_public = 1) and related data
echo "Step 1: Deleting existing preset public profiles (user_id = 1 AND is_public = 1)...\n";
try {
    $db->beginTransaction();
    
    // Get profile IDs to delete first
    $stmt = $db->prepare("SELECT id FROM profiles WHERE user_id = 1 AND is_public = 1");
    $stmt->execute();
    $profileIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($profileIds)) {
        echo "  ✓ No preset public profiles found to delete\n";
    } else {
        $idsPlaceholder = implode(',', array_fill(0, count($profileIds), '?'));
        
        // First, delete profile_cards for these profiles
        $stmt = $db->prepare("DELETE FROM profile_cards WHERE profile_id IN ({$idsPlaceholder})");
        $stmt->execute($profileIds);
        $deletedProfileCards = $stmt->rowCount();
        echo "  ✓ Deleted {$deletedProfileCards} profile_cards entries\n";
        
        // Delete action_logs referencing these profiles
        $stmt = $db->prepare("DELETE FROM action_logs WHERE profile_id IN ({$idsPlaceholder})");
        $stmt->execute($profileIds);
        $deletedLogs = $stmt->rowCount();
        echo "  ✓ Deleted {$deletedLogs} action_logs entries\n";
        
        // Delete profile_transfer_tokens for these profiles
        $stmt = $db->prepare("DELETE FROM profile_transfer_tokens WHERE profile_id IN ({$idsPlaceholder})");
        $stmt->execute($profileIds);
        $deletedTokens = $stmt->rowCount();
        echo "  ✓ Deleted {$deletedTokens} profile_transfer_tokens entries\n";
        
        // Delete ocr_history for these profiles
        $stmt = $db->prepare("DELETE FROM ocr_history WHERE profile_id IN ({$idsPlaceholder})");
        $stmt->execute($profileIds);
        $deletedOcr = $stmt->rowCount();
        echo "  ✓ Deleted {$deletedOcr} ocr_history entries\n";
        
        // Delete games_results for these profiles
        $stmt = $db->prepare("DELETE FROM games_results WHERE profile_id IN ({$idsPlaceholder})");
        $stmt->execute($profileIds);
        $deletedGames = $stmt->rowCount();
        echo "  ✓ Deleted {$deletedGames} games_results entries\n";
        
        // Delete settings for these profiles
        $stmt = $db->prepare("DELETE FROM settings WHERE profile_id IN ({$idsPlaceholder})");
        $stmt->execute($profileIds);
        $deletedSettings = $stmt->rowCount();
        echo "  ✓ Deleted {$deletedSettings} settings entries\n";
        
        // Then delete the profiles
        $stmt = $db->prepare("DELETE FROM profiles WHERE user_id = 1 AND is_public = 1");
        $stmt->execute();
        $deletedProfiles = $stmt->rowCount();
        echo "  ✓ Deleted {$deletedProfiles} preset public profiles\n";
    }
    
    $db->commit();
} catch (Exception $e) {
    $db->rollBack();
    echo "  ✗ Error deleting preset profiles: " . $e->getMessage() . "\n";
    exit(1);
}

// Step 2: Find and process each preset board
echo "\nStep 2: Creating new preset profiles from boards.json...\n";

$createdProfiles = 0;
$createdCards = 0;
$createdProfileCards = 0;

foreach ($presetBoardIds as $boardId) {
    // Find the board in boards.json
    $board = null;
    foreach ($boardsData['advanced'] as $b) {
        if (isset($b['id']) && $b['id'] === $boardId) {
            $board = $b;
            break;
        }
    }
    
    if (!$board) {
        echo "  ⚠️  Board {$boardId} not found in boards.json, skipping...\n";
        continue;
    }
    
    // Get profile name
    $nameKey = $board['nameKey'] ?? '';
    $profileName = $profileNameMap[$nameKey] ?? ($board['name'] ?? 'Unknown');
    $description = $board['description'] ?? "Preset profile: {$profileName}";
    
    echo "\n  Processing: {$profileName} (ID: {$boardId})...\n";
    
    try {
        $db->beginTransaction();
        
        // Get layout from board grid
        $grid = $board['grid'] ?? ['rows' => 4, 'columns' => 6];
        $layoutType = (int)($grid['rows'] ?? 4) . 'x' . (int)($grid['columns'] ?? 6);
        $language = $board['language'] ?? 'en';
        
        // Create profile with correct data
        echo "    [DEBUG] Creating preset profile:\n";
        echo "      - Name: {$profileName}\n";
        echo "      - Description: {$description}\n";
        echo "      - Layout: {$layoutType}\n";
        echo "      - Language: {$language}\n";
        echo "      - User ID: 1 (system)\n";
        echo "      - Is Public: 1\n";
        
        $stmt = $db->prepare("
            INSERT INTO profiles (user_id, display_name, description, layout_type, language, is_public, created_at, updated_at)
            VALUES (1, ?, ?, ?, ?, 1, NOW(), NOW())
        ");
        $stmt->execute([$profileName, $description, $layoutType, $language]);
        $profileId = $db->lastInsertId();
        
        if (!$profileId) {
            echo "    ✗ Failed to create profile: {$profileName}\n";
            continue;
        }
        
        echo "    ✓ Created profile: {$profileName} (ID: {$profileId}, Layout: {$layoutType}, Language: {$language})\n";
        echo "    [DEBUG] Profile stored in database:\n";
        echo "      - Profile ID: {$profileId}\n";
        echo "      - User ID: 1\n";
        echo "      - Is Public: 1\n";
        $createdProfiles++;
        
        // Process tiles (cards)
        $tiles = $board['tiles'] ?? [];
        $grid = $board['grid'] ?? ['rows' => 4, 'columns' => 6];
        $maxRows = (int)($grid['rows'] ?? 4);
        $maxCols = (int)($grid['columns'] ?? 6);
        
        $tileIndex = 0;
        
        foreach ($tiles as $tile) {
            if (!is_array($tile)) {
                continue;
            }
            
            // Skip tiles that have loadBoard (sub-boards/folders)
            if (isset($tile['loadBoard']) && $tile['loadBoard'] !== '') {
                continue;
            }
            
            // Get tile data with proper fallbacks
            $labelKey = $tile['labelKey'] ?? '';
            $label = $tile['label'] ?? $labelKey;
            $title = $label ?: $labelKey ?: 'Untitled';
            $labelText = $labelKey ?: $label; // Store labelKey for i18n
            
            $image = $tile['image'] ?? $tile['image_url'] ?? null;
            $audio = $tile['sound'] ?? $tile['sound_url'] ?? $tile['audio'] ?? null;
            
            // Get colors with proper fallbacks
            $textColor = $tile['textColor'] ?? $tile['text_color'] ?? null;
            $backgroundColor = $tile['backgroundColor'] ?? $tile['background_color'] ?? null;
            
            // Default colors if not set
            $cardYellow = 'rgb(255, 241, 118)';
            if (!$backgroundColor) {
                $backgroundColor = $cardYellow;
            }
            
            // Get position from tile, or calculate from index
            $rowIndex = isset($tile['row']) ? (int)$tile['row'] : intdiv($tileIndex, $maxCols);
            $colIndex = isset($tile['col']) ? (int)$tile['col'] : ($tileIndex % $maxCols);
            $pageIndex = isset($tile['page']) ? (int)$tile['page'] : 0;
            $isVisible = isset($tile['hidden']) ? !$tile['hidden'] : true;
            
            // Create card
            if ($tileIndex < 3) { // Log first 3 tiles for debugging
                echo "      [DEBUG] Creating card for tile #{$tileIndex}:\n";
                echo "        - Title: {$title}\n";
                echo "        - LabelText: {$labelText}\n";
                echo "        - Image: {$image}\n";
                echo "        - Position: row={$rowIndex}, col={$colIndex}, page={$pageIndex}\n";
                echo "        - Colors: bg={$backgroundColor}, text={$textColor}\n";
            }
            
            $stmt = $db->prepare("
                INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'preset', NOW(), NOW())
            ");
            $stmt->execute([$title, $labelText, $image, $audio, $textColor, $backgroundColor]);
            $cardId = $db->lastInsertId();
            
            if (!$cardId) {
                echo "      ⚠️  Failed to create card for tile: {$title}\n";
                continue;
            }
            
            if ($tileIndex < 3) {
                echo "      [DEBUG] Card created in database:\n";
                echo "        - Card ID: {$cardId}\n";
                echo "        - Stored in: cards table\n";
            }
            
            $createdCards++;
            
            // Link card to profile with correct position
            $stmt = $db->prepare("
                INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmt->execute([$profileId, $cardId, $rowIndex, $colIndex, $pageIndex, $isVisible ? 1 : 0]);
            
            if ($tileIndex < 3) {
                echo "      [DEBUG] Profile-card link created:\n";
                echo "        - Profile ID: {$profileId}\n";
                echo "        - Card ID: {$cardId}\n";
                echo "        - Position: row={$rowIndex}, col={$colIndex}, page={$pageIndex}\n";
                echo "        - Stored in: profile_cards table\n";
            }
            
            $createdProfileCards++;
            
            $tileIndex++;
        }
        
        $validTilesCount = $tileIndex;
        echo "    ✓ Created {$validTilesCount} cards for profile {$profileName}\n";
        
        $db->commit();
        
    } catch (Exception $e) {
        $db->rollBack();
        echo "    ✗ Error processing {$profileName}: " . $e->getMessage() . "\n";
        echo "    Stack trace: " . $e->getTraceAsString() . "\n";
    }
}

echo "\n=== Summary ===\n";
echo "Profiles created: {$createdProfiles}\n";
echo "Cards created: {$createdCards}\n";
echo "Profile-cards links created: {$createdProfileCards}\n";
echo "\n✓ Preset profiles seeded successfully!\n";

