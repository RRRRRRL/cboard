<?php
/**
 * Add missing YES / NO tiles to a given root profile.
 *
 * 用法（在 backend 目錄下）:
 *   php scripts/add-yes-no-to-profile.php 75
 *
 * 說明：
 * - 從 src/api/boards.json 的 root board（DEFAULT_BOARDS.advanced[0]）讀取前兩個 tile（YES / NO）
 * - 如果目標 profile 還沒有這兩張卡，就在 cards + profile_cards 中補上
 * - YES 放在 (row=0, col=0)，NO 放在 (row=0, col=1)，不改動現有其他 tiles 的位置
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

if ($argc < 2) {
    echo "Usage: php " . basename(__FILE__) . " PROFILE_ID\n";
    exit(1);
}

$profileId = (int)$argv[1];
if ($profileId <= 0) {
    echo "✗ Invalid profile id: {$argv[1]}\n";
    exit(1);
}

$db = getDB();
if (!$db) {
    die("Database connection failed\n");
}

echo "=== Add YES/NO tiles to profile {$profileId} ===\n";

// 1. 確認 profile 存在
$stmt = $db->prepare("SELECT id, user_id, display_name, language FROM profiles WHERE id = ?");
$stmt->execute([$profileId]);
$profile = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$profile) {
    echo "✗ Profile not found: {$profileId}\n";
    exit(1);
}

echo "✓ Found profile: {$profile['display_name']} (user_id={$profile['user_id']})\n";

// 2. 讀取 boards.json 裡的 root board，取前兩個 tiles（YES / NO）
$boardsJsonPath = __DIR__ . '/../../src/api/boards.json';
if (!file_exists($boardsJsonPath)) {
    echo "✗ boards.json not found at {$boardsJsonPath}\n";
    exit(1);
}

$boardsData = json_decode(file_get_contents($boardsJsonPath), true);
if (!$boardsData || !isset($boardsData['advanced'][0]['tiles'])) {
    echo "✗ Invalid boards.json format: advanced[0].tiles not found\n";
    exit(1);
}

$rootTiles = $boardsData['advanced'][0]['tiles'];
if (count($rootTiles) < 2) {
    echo "✗ Root board tiles count < 2, cannot locate YES/NO\n";
    exit(1);
}

$yesTile = $rootTiles[0];
$noTile  = $rootTiles[1];

// 防禦性檢查：確保這兩個確實是 YES / NO
if (($yesTile['labelKey'] ?? '') !== 'cboard.symbol.yes') {
    echo "⚠️  First tile in root is not cboard.symbol.yes, got: " . ($yesTile['labelKey'] ?? 'NULL') . "\n";
}
if (($noTile['labelKey'] ?? '') !== 'symbol.descriptiveState.no') {
    echo "⚠️  Second tile in root is not symbol.descriptiveState.no, got: " . ($noTile['labelKey'] ?? 'NULL') . "\n";
}

// 3. 檢查這個 profile 是否已經有 YES/NO（根據 label_text / title 判斷）
$stmt = $db->prepare("
    SELECT c.id, c.title, c.label_text, pc.row_index, pc.col_index
    FROM profile_cards pc
    JOIN cards c ON pc.card_id = c.id
    WHERE pc.profile_id = ?
      AND (c.label_text IN ('cboard.symbol.yes', 'symbol.descriptiveState.no')
           OR c.title IN ('cboard.symbol.yes', 'symbol.descriptiveState.no'))
");
$stmt->execute([$profileId]);
$existing = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($existing as $row) {
    echo "✓ Profile already has tile: {$row['label_text']} at ({$row['row_index']}, {$row['col_index']})\n";
}

$needYes = !array_filter($existing, function ($r) {
    return $r['label_text'] === 'cboard.symbol.yes' || $r['title'] === 'cboard.symbol.yes';
});
$needNo = !array_filter($existing, function ($r) {
    return $r['label_text'] === 'symbol.descriptiveState.no' || $r['title'] === 'symbol.descriptiveState.no';
});

if (!$needYes && !$needNo) {
    echo "✓ YES and NO tiles already exist for profile {$profileId}, nothing to do.\n";
    exit(0);
}

try {
    $db->beginTransaction();

    $folderBlue = 'rgb(187, 222, 251)';
    $cardYellow = 'rgb(255, 241, 118)';

    $created = 0;

    // Helper to create one tile
    $createTile = function ($tileDef, $labelKey, $targetRow, $targetCol) use (
        $db,
        $profileId,
        $cardYellow,
        &$created
    ) {
        $title = $labelKey;
        $labelText = $labelKey;
        $image = $tileDef['image'] ?? null;
        $audio = $tileDef['sound'] ?? null;
        $textColor = $tileDef['textColor'] ?? $tileDef['text_color'] ?? null;
        $backgroundColor = $tileDef['backgroundColor'] ?? $tileDef['background_color'] ?? $cardYellow;

        // 建立 card
        $stmt = $db->prepare("
            INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'preset', NOW(), NOW())
        ");
        $stmt->execute([
            $title,
            $labelText,
            $image,
            $audio,
            $textColor,
            $backgroundColor
        ]);
        $cardId = (int)$db->lastInsertId();
        if (!$cardId) {
            echo "  ⚠️  Failed to create card for labelKey={$labelKey}\n";
            return;
        }

        // 建立 profile_cards 關聯
        $stmt = $db->prepare("
            INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 1, NOW(), NOW())
        ");
        $stmt->execute([
            $profileId,
            $cardId,
            $targetRow,
            $targetCol
        ]);

        $created++;
        echo "  ✓ Added tile {$labelKey} at ({$targetRow}, {$targetCol})\n";
    };

    if ($needYes) {
        // YES 放在 (0,0)
        $createTile($yesTile, 'cboard.symbol.yes', 0, 0);
    }
    if ($needNo) {
        // NO 放在 (0,1)
        $createTile($noTile, 'symbol.descriptiveState.no', 0, 1);
    }

    $db->commit();

    echo "=== DONE ===\n";
    echo "Added {$created} YES/NO tiles to profile {$profileId}\n";

} catch (Exception $e) {
    $db->rollBack();
    echo "✗ Error adding YES/NO tiles: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}


