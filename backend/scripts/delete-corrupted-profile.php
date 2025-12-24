<?php
/**
 * Script to delete a corrupted profile and all its associated data
 * Usage: php delete-corrupted-profile.php [profile_id]
 * Example: php delete-corrupted-profile.php 49
 */

require_once __DIR__ . '/../database/init.php';

// Get profile ID from command line argument
$profileId = isset($argv[1]) ? (int)$argv[1] : null;

if (!$profileId) {
    echo "Usage: php delete-corrupted-profile.php [profile_id]\n";
    echo "Example: php delete-corrupted-profile.php 49\n";
    exit(1);
}

try {
    $db = getDB();
    if (!$db) {
        die("Database connection failed\n");
    }
    
    echo "Deleting corrupted profile ID: {$profileId}\n";
    echo "==========================================\n\n";
    
    // Start transaction
    $db->beginTransaction();
    
    // Step 1: Get profile info first
    $stmt = $db->prepare("SELECT id, user_id, display_name FROM profiles WHERE id = ?");
    $stmt->execute([$profileId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$profile) {
        echo "❌ Profile with ID {$profileId} not found.\n";
        $db->rollBack();
        exit(1);
    }
    
    echo "Profile found: {$profile['display_name']} (User ID: {$profile['user_id']})\n\n";
    
    // Step 2: Delete profile_cards
    $stmt = $db->prepare("DELETE FROM profile_cards WHERE profile_id = ?");
    $stmt->execute([$profileId]);
    $deletedProfileCards = $stmt->rowCount();
    echo "✓ Deleted {$deletedProfileCards} profile_cards entries\n";
    
    // Step 3: Delete action_logs
    $stmt = $db->prepare("DELETE FROM action_logs WHERE profile_id = ?");
    $stmt->execute([$profileId]);
    $deletedLogs = $stmt->rowCount();
    echo "✓ Deleted {$deletedLogs} action_logs entries\n";
    
    // Step 4: Delete profile_transfer_tokens
    $stmt = $db->prepare("DELETE FROM profile_transfer_tokens WHERE profile_id = ?");
    $stmt->execute([$profileId]);
    $deletedTokens = $stmt->rowCount();
    echo "✓ Deleted {$deletedTokens} profile_transfer_tokens entries\n";
    
    // Step 5: Delete ocr_history
    $stmt = $db->prepare("DELETE FROM ocr_history WHERE profile_id = ?");
    $stmt->execute([$profileId]);
    $deletedOcr = $stmt->rowCount();
    echo "✓ Deleted {$deletedOcr} ocr_history entries\n";
    
    // Step 6: Delete games_results
    $stmt = $db->prepare("DELETE FROM games_results WHERE profile_id = ?");
    $stmt->execute([$profileId]);
    $deletedGames = $stmt->rowCount();
    echo "✓ Deleted {$deletedGames} games_results entries\n";
    
    // Step 7: Delete settings
    $stmt = $db->prepare("DELETE FROM settings WHERE profile_id = ?");
    $stmt->execute([$profileId]);
    $deletedSettings = $stmt->rowCount();
    echo "✓ Deleted {$deletedSettings} settings entries\n";
    
    // Step 8: Delete the profile itself
    $stmt = $db->prepare("DELETE FROM profiles WHERE id = ?");
    $stmt->execute([$profileId]);
    $deletedProfile = $stmt->rowCount();
    
    if ($deletedProfile > 0) {
        echo "✓ Deleted profile ID {$profileId}\n\n";
        
        // Commit transaction
        $db->commit();
        
        echo "==========================================\n";
        echo "✅ Successfully deleted corrupted profile ID: {$profileId}\n";
        echo "   Profile: {$profile['display_name']}\n";
        echo "   User ID: {$profile['user_id']}\n";
        echo "==========================================\n";
    } else {
        echo "❌ Failed to delete profile ID {$profileId}\n";
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

