<?php
/**
 * Seed Preset Profiles Script
 * Sprint 4: Creates ≥10 public preset profiles
 * 
 * Usage: php seed-preset-profiles.php
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/database/init.php';

$db = getDB();
if (!$db) {
    die("❌ Database connection failed\n");
}

echo "Seeding Preset Profiles...\n\n";

// Get or create system user
$stmt = $db->prepare("SELECT id FROM users WHERE email = 'system@cboard.local' OR role = 'admin' LIMIT 1");
$stmt->execute();
$systemUser = $stmt->fetch();

if (!$systemUser) {
    // Create system user
    $stmt = $db->prepare("
        INSERT INTO users (email, name, role, is_active, is_verified, created_at, updated_at)
        VALUES ('system@cboard.local', 'System', 'admin', 1, 1, NOW(), NOW())
    ");
    $stmt->execute();
    $systemUserId = $db->lastInsertId();
    echo "✅ Created system user (ID: $systemUserId)\n";
} else {
    $systemUserId = $systemUser['id'];
    echo "✅ Using system user (ID: $systemUserId)\n";
}

echo "\n";

// Preset profiles to create
$presetProfiles = [
    ['display_name' => 'Basic Communication', 'description' => 'Essential communication cards for daily needs', 'layout_type' => '4x6', 'language' => 'en'],
    ['display_name' => 'Food & Drinks', 'description' => 'Cards for ordering food and drinks', 'layout_type' => '4x6', 'language' => 'en'],
    ['display_name' => 'Emotions & Feelings', 'description' => 'Express emotions and feelings', 'layout_type' => '3x4', 'language' => 'en'],
    ['display_name' => 'Activities', 'description' => 'Common activities and hobbies', 'layout_type' => '4x6', 'language' => 'en'],
    ['display_name' => 'School', 'description' => 'School-related communication cards', 'layout_type' => '4x6', 'language' => 'en'],
    ['display_name' => 'Home & Family', 'description' => 'Family and home activities', 'layout_type' => '4x6', 'language' => 'en'],
    ['display_name' => 'Health & Medical', 'description' => 'Medical and health communication', 'layout_type' => '3x4', 'language' => 'en'],
    ['display_name' => 'Shopping', 'description' => 'Shopping and purchasing cards', 'layout_type' => '4x6', 'language' => 'en'],
    ['display_name' => 'Transportation', 'description' => 'Transportation and travel cards', 'layout_type' => '3x4', 'language' => 'en'],
    ['display_name' => 'Social & Greetings', 'description' => 'Social interactions and greetings', 'layout_type' => '2x3', 'language' => 'en'],
    ['display_name' => '粵語基本溝通', 'description' => 'Basic Cantonese communication cards', 'layout_type' => '4x6', 'language' => 'zh-HK'],
    ['display_name' => '粵語飲食', 'description' => 'Cantonese food and drink cards', 'layout_type' => '4x6', 'language' => 'zh-HK']
];

$created = 0;
$skipped = 0;

foreach ($presetProfiles as $profile) {
    // Check if already exists
    $stmt = $db->prepare("SELECT id FROM profiles WHERE display_name = ? AND language = ? AND is_public = 1");
    $stmt->execute([$profile['display_name'], $profile['language']]);
    if ($stmt->fetch()) {
        echo "⏭️  Skipped: {$profile['display_name']} (already exists)\n";
        $skipped++;
        continue;
    }
    
    // Create profile
    $stmt = $db->prepare("
        INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())
    ");
    $stmt->execute([
        $systemUserId,
        $profile['display_name'],
        $profile['display_name'],
        $profile['description'],
        $profile['layout_type'],
        $profile['language']
    ]);
    
    $profileId = $db->lastInsertId();
    echo "✅ Created: {$profile['display_name']} (ID: $profileId, Language: {$profile['language']})\n";
    $created++;
}

echo "\n========================================\n";
echo "Summary:\n";
echo "  ✅ Created: $created profiles\n";
echo "  ⏭️  Skipped: $skipped profiles\n";
echo "  📊 Total preset profiles: " . ($created + $skipped) . "\n";
echo "========================================\n";

// Verify
$stmt = $db->prepare("SELECT COUNT(*) as total FROM profiles WHERE is_public = 1");
$stmt->execute();
$total = $stmt->fetch()['total'];
echo "\n✅ Total public profiles in database: $total\n";

