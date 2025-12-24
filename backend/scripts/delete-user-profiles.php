<?php
/**
 * Script to delete ALL profiles for a specific user
 * 
 * WARNING: This script will permanently delete ALL profiles for the specified user!
 * This includes:
 * - All profiles owned by the user
 * - All profile_cards
 * - All action_logs
 * - All profile_transfer_tokens
 * - All ocr_history
 * - All games_results
 * - All settings
 * - All boards linked to profiles
 * 
 * Usage: php delete-user-profiles.php <user_email> [--confirm]
 * 
 * Example: php delete-user-profiles.php user@example.com --confirm
 * 
 * Without --confirm flag, the script will only show what would be deleted.
 */

require_once __DIR__ . '/../database/init.php';

// Check arguments
if ($argc < 2) {
    echo "==========================================\n";
    echo "⚠️  DELETE USER PROFILES SCRIPT\n";
    echo "==========================================\n\n";
    echo "Usage: php delete-user-profiles.php <user_email> [--confirm]\n\n";
    echo "Example:\n";
    echo "  php delete-user-profiles.php user@example.com\n";
    echo "  php delete-user-profiles.php user@example.com --confirm\n\n";
    echo "This script will delete ALL profiles and their associated data for the specified user.\n";
    echo "==========================================\n";
    exit(1);
}

$userEmail = $argv[1];
$confirm = isset($argv[2]) && $argv[2] === '--confirm';

if (!$confirm) {
    echo "==========================================\n";
    echo "⚠️  WARNING: DELETE USER PROFILES SCRIPT\n";
    echo "==========================================\n\n";
    echo "This script will permanently delete ALL profiles for user: {$userEmail}\n\n";
    echo "This includes:\n";
    echo "  - All profiles owned by this user\n";
    echo "  - All profile_cards\n";
    echo "  - All action_logs\n";
    echo "  - All profile_transfer_tokens\n";
    echo "  - All ocr_history\n";
    echo "  - All games_results\n";
    echo "  - All settings\n";
    echo "  - All boards linked to profiles\n\n";
    echo "To proceed, run: php delete-user-profiles.php {$userEmail} --confirm\n";
    echo "==========================================\n";
    exit(0);
}

try {
    $db = getDB();
    if (!$db) {
        die("❌ Database connection failed\n");
    }
    
    echo "==========================================\n";
    echo "🗑️  DELETING USER PROFILES\n";
    echo "==========================================\n\n";
    echo "Target user: {$userEmail}\n\n";
    
    // Step 1: Find the user
    echo "Step 1: Finding user...\n";
    $stmt = $db->prepare("SELECT id, email, name FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$userEmail]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        echo "❌ User not found: {$userEmail}\n";
        exit(1);
    }
    
    $userId = (int)$user['id'];
    echo "  ✓ Found user: {$user['name']} (ID: {$userId})\n\n";
    
    // Step 2: Get all profiles for this user
    echo "Step 2: Finding user profiles...\n";
    $stmt = $db->prepare("SELECT id, display_name FROM profiles WHERE user_id = ?");
    $stmt->execute([$userId]);
    $profiles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $totalProfiles = count($profiles);
    
    if ($totalProfiles === 0) {
        echo "  ✓ No profiles found for this user. Nothing to delete.\n";
        exit(0);
    }
    
    echo "  ✓ Found {$totalProfiles} profiles:\n";
    foreach ($profiles as $profile) {
        echo "    - Profile ID: {$profile['id']}, Name: {$profile['display_name']}\n";
    }
    echo "\n";
    
    // Step 3: Get profile IDs for deletion
    $profileIds = array_column($profiles, 'id');
    $idsPlaceholders = implode(',', array_fill(0, count($profileIds), '?'));
    
    // Start transaction
    $db->beginTransaction();
    
    // Step 4: Delete profile_cards
    echo "Step 3: Deleting profile_cards...\n";
    $stmt = $db->prepare("DELETE FROM profile_cards WHERE profile_id IN ({$idsPlaceholders})");
    $stmt->execute($profileIds);
    $deletedProfileCards = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedProfileCards} profile_cards entries\n\n";
    
    // Step 5: Delete action_logs
    echo "Step 4: Deleting action_logs...\n";
    $stmt = $db->prepare("DELETE FROM action_logs WHERE profile_id IN ({$idsPlaceholders})");
    $stmt->execute($profileIds);
    $deletedLogs = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedLogs} action_logs entries\n\n";
    
    // Step 6: Delete profile_transfer_tokens
    echo "Step 5: Deleting profile_transfer_tokens...\n";
    $stmt = $db->prepare("DELETE FROM profile_transfer_tokens WHERE profile_id IN ({$idsPlaceholders})");
    $stmt->execute($profileIds);
    $deletedTokens = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedTokens} profile_transfer_tokens entries\n\n";
    
    // Step 7: Delete ocr_history
    echo "Step 6: Deleting ocr_history...\n";
    $stmt = $db->prepare("DELETE FROM ocr_history WHERE profile_id IN ({$idsPlaceholders})");
    $stmt->execute($profileIds);
    $deletedOcr = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedOcr} ocr_history entries\n\n";
    
    // Step 8: Delete games_results
    echo "Step 7: Deleting games_results...\n";
    $stmt = $db->prepare("DELETE FROM games_results WHERE profile_id IN ({$idsPlaceholders})");
    $stmt->execute($profileIds);
    $deletedGames = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedGames} games_results entries\n\n";
    
    // Step 9: Delete settings
    echo "Step 8: Deleting settings...\n";
    $stmt = $db->prepare("DELETE FROM settings WHERE profile_id IN ({$idsPlaceholders})");
    $stmt->execute($profileIds);
    $deletedSettings = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedSettings} settings entries\n\n";
    
    // Step 10: Delete boards linked to profiles (if boards table exists)
    echo "Step 9: Deleting boards linked to profiles...\n";
    $deletedBoards = 0;
    try {
        // Check if boards table exists
        $stmt = $db->query("SHOW TABLES LIKE 'boards'");
        $tableExists = $stmt->rowCount() > 0;
        
        if ($tableExists) {
            $stmt = $db->prepare("DELETE FROM boards WHERE profile_id IN ({$idsPlaceholders})");
            $stmt->execute($profileIds);
            $deletedBoards = $stmt->rowCount();
            echo "  ✓ Deleted {$deletedBoards} boards entries\n\n";
        } else {
            echo "  ⚠ Boards table does not exist (profile-centric architecture), skipping...\n\n";
        }
    } catch (PDOException $e) {
        // If table doesn't exist, just skip this step
        if (strpos($e->getMessage(), "doesn't exist") !== false) {
            echo "  ⚠ Boards table does not exist (profile-centric architecture), skipping...\n\n";
        } else {
            throw $e; // Re-throw if it's a different error
        }
    }
    
    // Step 11: Delete all profiles
    echo "Step 10: Deleting all profiles...\n";
    $stmt = $db->prepare("DELETE FROM profiles WHERE id IN ({$idsPlaceholders})");
    $stmt->execute($profileIds);
    $deletedProfiles = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedProfiles} profiles\n\n";
    
    // Verify deletion
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM profiles WHERE user_id = ?");
    $stmt->execute([$userId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $remainingProfiles = (int)$result['count'];
    
    if ($remainingProfiles === 0 && $deletedProfiles > 0) {
        // Commit transaction
        $db->commit();
        
        echo "==========================================\n";
        echo "✅ Successfully deleted all profiles for user!\n";
        echo "==========================================\n";
        echo "User: {$user['name']} ({$userEmail})\n";
        echo "Summary:\n";
        echo "  - Profiles deleted: {$deletedProfiles}\n";
        echo "  - Profile cards deleted: {$deletedProfileCards}\n";
        echo "  - Action logs deleted: {$deletedLogs}\n";
        echo "  - Transfer tokens deleted: {$deletedTokens}\n";
        echo "  - OCR history deleted: {$deletedOcr}\n";
        echo "  - Games results deleted: {$deletedGames}\n";
        echo "  - Settings deleted: {$deletedSettings}\n";
        echo "  - Boards deleted: {$deletedBoards}\n";
        echo "==========================================\n";
    } else {
        echo "❌ Warning: Expected to delete {$totalProfiles} profiles, but {$remainingProfiles} remain.\n";
        $db->rollBack();
        exit(1);
    }
    
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
    exit(1);
}

