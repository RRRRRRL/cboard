<?php
/**
 * Script to delete ALL profiles and all their associated data
 * 
 * WARNING: This script will permanently delete ALL profiles from the database!
 * This includes:
 * - All profiles
 * - All profile_cards
 * - All action_logs
 * - All profile_transfer_tokens
 * - All ocr_history
 * - All games_results
 * - All settings
 * - All boards linked to profiles
 * 
 * Usage: php delete-all-profiles.php [--confirm]
 * 
 * Example: php delete-all-profiles.php --confirm
 * 
 * Without --confirm flag, the script will only show what would be deleted.
 */

require_once __DIR__ . '/../database/init.php';

// Check for confirmation flag
$confirm = isset($argv[1]) && $argv[1] === '--confirm';

if (!$confirm) {
    echo "==========================================\n";
    echo "⚠️  WARNING: DELETE ALL PROFILES SCRIPT\n";
    echo "==========================================\n\n";
    echo "This script will permanently delete ALL profiles and their associated data:\n";
    echo "  - All profiles\n";
    echo "  - All profile_cards\n";
    echo "  - All action_logs\n";
    echo "  - All profile_transfer_tokens\n";
    echo "  - All ocr_history\n";
    echo "  - All games_results\n";
    echo "  - All settings\n";
    echo "  - All boards linked to profiles\n\n";
    echo "To proceed, run: php delete-all-profiles.php --confirm\n";
    echo "==========================================\n";
    exit(0);
}

try {
    $db = getDB();
    if (!$db) {
        die("❌ Database connection failed\n");
    }
    
    echo "==========================================\n";
    echo "🗑️  DELETING ALL PROFILES\n";
    echo "==========================================\n\n";
    
    // Start transaction
    $db->beginTransaction();
    
    // Step 1: Count profiles before deletion
    $stmt = $db->query("SELECT COUNT(*) as count FROM profiles");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $totalProfiles = (int)$result['count'];
    
    echo "Found {$totalProfiles} profiles to delete\n\n";
    
    if ($totalProfiles === 0) {
        echo "No profiles found. Nothing to delete.\n";
        $db->rollBack();
        exit(0);
    }
    
    // Step 2: Delete profile_cards (CASCADE should handle this, but we'll do it explicitly)
    echo "Step 1: Deleting profile_cards...\n";
    $stmt = $db->query("DELETE FROM profile_cards");
    $deletedProfileCards = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedProfileCards} profile_cards entries\n\n";
    
    // Step 3: Delete action_logs
    echo "Step 2: Deleting action_logs...\n";
    $stmt = $db->query("DELETE FROM action_logs WHERE profile_id IS NOT NULL");
    $deletedLogs = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedLogs} action_logs entries\n\n";
    
    // Step 4: Delete profile_transfer_tokens
    echo "Step 3: Deleting profile_transfer_tokens...\n";
    $stmt = $db->query("DELETE FROM profile_transfer_tokens");
    $deletedTokens = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedTokens} profile_transfer_tokens entries\n\n";
    
    // Step 5: Delete ocr_history
    echo "Step 4: Deleting ocr_history...\n";
    $stmt = $db->query("DELETE FROM ocr_history WHERE profile_id IS NOT NULL");
    $deletedOcr = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedOcr} ocr_history entries\n\n";
    
    // Step 6: Delete games_results
    echo "Step 5: Deleting games_results...\n";
    $stmt = $db->query("DELETE FROM games_results WHERE profile_id IS NOT NULL");
    $deletedGames = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedGames} games_results entries\n\n";
    
    // Step 7: Delete settings
    echo "Step 6: Deleting settings...\n";
    $stmt = $db->query("DELETE FROM settings WHERE profile_id IS NOT NULL");
    $deletedSettings = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedSettings} settings entries\n\n";
    
    // Step 8: Delete boards linked to profiles (if boards table exists)
    echo "Step 7: Deleting boards linked to profiles...\n";
    $deletedBoards = 0;
    try {
        // Check if boards table exists
        $stmt = $db->query("SHOW TABLES LIKE 'boards'");
        $tableExists = $stmt->rowCount() > 0;
        
        if ($tableExists) {
            $stmt = $db->query("DELETE FROM boards WHERE profile_id IS NOT NULL");
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
    
    // Step 9: Delete all profiles
    echo "Step 8: Deleting all profiles...\n";
    $stmt = $db->query("DELETE FROM profiles");
    $deletedProfiles = $stmt->rowCount();
    echo "  ✓ Deleted {$deletedProfiles} profiles\n\n";
    
    // Verify deletion
    $stmt = $db->query("SELECT COUNT(*) as count FROM profiles");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $remainingProfiles = (int)$result['count'];
    
    if ($remainingProfiles === 0 && $deletedProfiles > 0) {
        // Commit transaction
        $db->commit();
        
        echo "==========================================\n";
        echo "✅ Successfully deleted all profiles!\n";
        echo "==========================================\n";
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

