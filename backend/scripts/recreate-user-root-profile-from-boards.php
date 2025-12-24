<?php
/**
 * Recreate a clean "Cboard Classic Home" root profile for a specific user
 *
 * 用法（在 backend 目錄下）:
 *   php scripts/recreate-user-root-profile-from-boards.php user_email@example.com
 *
 * 說明：
 * - 根據 src/api/boards.json 裡的第一個 root board（DEFAULT_BOARDS.advanced[0]）
 *   幫指定使用者重建一個新的 profile（display_name = "Cboard Classic Home"）
 * - 會先刪掉該使用者現有名稱為 "Cboard Classic Home" 的 profile 及其 profile_cards
 * - 只影響指定使用者，不會動到其他人的資料
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

if ($argc < 2) {
    echo "Usage: php " . basename(__FILE__) . " user_email@example.com\n";
    exit(1);
}

$userEmail = $argv[1];

$db = getDB();
if (!$db) {
    die("Database connection failed\n");
}

echo "=== Recreate user root profile from boards.json ===\n";
echo "Target user email: {$userEmail}\n\n";

// 1. 找出目標使用者
$stmt = $db->prepare("SELECT id, email, name FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$userEmail]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo "✗ User not found for email: {$userEmail}\n";
    exit(1);
}

$userId = (int)$user['id'];
echo "✓ Found user ID: {$userId} ({$user['name']})\n";

// 2. 載入 boards.json，取第一個 root board（對應 Cboard Classic Home）
$boardsJsonPath = __DIR__ . '/../../src/api/boards.json';
if (!file_exists($boardsJsonPath)) {
    echo "✗ boards.json not found at {$boardsJsonPath}\n";
    exit(1);
}

$boardsData = json_decode(file_get_contents($boardsJsonPath), true);
if (!$boardsData || !isset($boardsData['advanced']) || !is_array($boardsData['advanced']) || count($boardsData['advanced']) === 0) {
    echo "✗ Invalid boards.json format: 'advanced' root boards not found\n";
    exit(1);
}

// 這裡假設 advanced[0] 就是 Cboard Classic Home（與前端 DEFAULT_BOARDS.advanced[0] 對應）
$rootBoard = $boardsData['advanced'][0];
$rootBoardName = $rootBoard['name'] ?? 'Cboard Classic Home';
$rootBoardLayoutRows = $rootBoard['grid']['rows'] ?? 4;
$rootBoardLayoutCols = $rootBoard['grid']['columns'] ?? 6;
$layoutType = "{$rootBoardLayoutRows}x{$rootBoardLayoutCols}";

echo "✓ Using root board from boards.json: {$rootBoardName} ({$layoutType})\n";

try {
    $db->beginTransaction();

    // 3. 刪除該使用者現有名稱為 Cboard Classic Home 的 profiles 及其 profile_cards
    echo "Step 1: Deleting existing 'Cboard Classic Home' profiles for this user...\n";

    // 找出這個使用者所有 display_name = 'Cboard Classic Home' 的 profile id
    $stmt = $db->prepare("
        SELECT id 
        FROM profiles 
        WHERE user_id = ? AND display_name = ?
    ");
    $stmt->execute([$userId, $rootBoardName]);
    $oldProfiles = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if ($oldProfiles && count($oldProfiles) > 0) {
        $idsPlaceholders = implode(',', array_fill(0, count($oldProfiles), '?'));

        // 先刪除 profile_cards
        $stmt = $db->prepare("DELETE FROM profile_cards WHERE profile_id IN ({$idsPlaceholders})");
        $stmt->execute($oldProfiles);
        $deletedPc = $stmt->rowCount();

        echo "  ✓ Deleted {$deletedPc} profile_cards rows for old root profiles\n";

        // 再刪除 profiles
        $stmt = $db->prepare("DELETE FROM profiles WHERE id IN ({$idsPlaceholders})");
        $stmt->execute($oldProfiles);
        $deletedProfiles = $stmt->rowCount();

        echo "  ✓ Deleted {$deletedProfiles} old root profiles\n";
    } else {
        echo "  ✓ No existing 'Cboard Classic Home' profiles found for this user\n";
    }

    // 4. 建立新的 profile
    echo "\nStep 2: Creating new root profile for this user...\n";

    $stmt = $db->prepare("
        INSERT INTO profiles (user_id, display_name, description, layout_type, language, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())
    ");

    // 嘗試從 rootBoard 取語言，沒有的話預設 zh-HK（你目前使用的語言）
    $language = $rootBoard['language'] ?? 'zh-HK';
    $description = $rootBoard['description'] ?? 'rootBoardDescription';

    $stmt->execute([
        $userId,
        $rootBoardName,
        $description,
        $layoutType,
        $language
    ]);

    $newProfileId = (int)$db->lastInsertId();
    echo "  ✓ Created new profile: {$rootBoardName} (ID: {$newProfileId})\n";

    // 5. 為這個 profile 建立 cards + profile_cards（包括文件夾 tiles）
    echo "\nStep 3: Creating tiles (cards + profile_cards) for the new root profile...\n";

$tiles = $rootBoard['tiles'] ?? [];
$createdCards = 0;
$createdProfileCards = 0;

// 根板預設 4x6，按 tiles 的順序從左到右、從上到下填滿
$maxCols = $rootBoardLayoutCols;
$index = 0;

foreach ($tiles as $tile) {
        if (!is_array($tile)) {
            continue;
        }

        // 判斷是否子板（文件夾）tile
        $loadBoard = isset($tile['loadBoard']) && $tile['loadBoard'] !== '' ? $tile['loadBoard'] : null;

        // 標籤 / 文本
        $labelKey = $tile['labelKey'] ?? null;
        $label = $tile['label'] ?? null;

        // 對於 preset root board：大多數是用 labelKey 做 i18n
        $title = $label ?: $labelKey ?: 'Untitled';
        $labelText = $label ?: $labelKey ?: 'Untitled';

        // 處理 image / sound
        $image = $tile['image'] ?? null;
        $audio = $tile['sound'] ?? null;

        // 顏色
        $textColor = $tile['textColor'] ?? $tile['text_color'] ?? null;
        $backgroundColor = $tile['backgroundColor'] ?? $tile['background_color'] ?? null;

        $folderBlue = 'rgb(187, 222, 251)';
        $cardYellow = 'rgb(255, 241, 118)';

        // 判斷是否為 YES/NO 卡片（前兩個 tile，通常是 cboard.symbol.yes 和 symbol.descriptiveState.no）
        $isYesNoCard = ($index < 2) && (
            ($labelKey === 'cboard.symbol.yes' || $labelKey === 'symbol.descriptiveState.no') ||
            ($title === 'cboard.symbol.yes' || $title === 'symbol.descriptiveState.no')
        );

        if (!$backgroundColor) {
            if ($loadBoard !== null) {
                $backgroundColor = $folderBlue;
            } else {
                $backgroundColor = $cardYellow;
            }
        } elseif ($isYesNoCard && $backgroundColor === $folderBlue) {
            // YES/NO 卡片不應該是藍色（文件夾色），強制改為黃色
            $backgroundColor = $cardYellow;
        } elseif ($backgroundColor === $folderBlue && $loadBoard === null) {
            // 如果顏色是藍色但沒有 loadBoard，改為黃色（修正誤分類）
            $backgroundColor = $cardYellow;
        }

        // 類別：yes/no 等原始 root 卡是 preset，其它一般用 general
        $category = $tile['category'] ?? ($loadBoard ? 'general' : 'preset');

    // 位置：boards.json 的 root board 沒有 row/col，我們用順序生成 4x6 版面
    // 前兩個 tile（YES/NO）強制放在 (0,0) 和 (0,1)
    if ($index < 2) {
        $rowIndex = 0;
        $colIndex = $index;
    } elseif (isset($tile['row']) || isset($tile['col'])) {
        $rowIndex = isset($tile['row']) ? (int)$tile['row'] : 0;
        $colIndex = isset($tile['col']) ? (int)$tile['col'] : 0;
    } else {
        // 從 index=2 開始，從 (0,2) 開始排列（跳過前兩格已被 YES/NO 佔用）
        $adjustedIndex = $index - 2;
        // 計算位置：第一行從 col=2 開始，填滿後換行
        $totalPositions = $adjustedIndex + 2; // 加上前兩格的位置偏移
        $rowIndex = intdiv($totalPositions, $maxCols);
        $colIndex = $totalPositions % $maxCols;
    }
    $pageIndex = isset($tile['page']) ? (int)$tile['page'] : 0;
        $isVisible = isset($tile['hidden']) ? !$tile['hidden'] : true;

        // 處理 label_text：如果是文件夾，按我們現在的規則存 JSON
        // YES/NO 卡片不應該有 loadBoard，所以 label_text 就是 labelKey
        if ($loadBoard !== null && !$isYesNoCard) {
            $labelText = json_encode(['loadBoard' => $loadBoard]);
        }

        // 建立 card
        $stmt = $db->prepare("
            INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([
            $title,
            $labelText,
            $image,
            $audio,
            $textColor,
            $backgroundColor,
            $category
        ]);

        $cardId = (int)$db->lastInsertId();
        if (!$cardId) {
            echo "  ⚠️  Failed to create card for tile (labelKey: {$labelKey})\n";
            continue;
        }
        $createdCards++;

        // 建立 profile_cards 關聯
        $stmt = $db->prepare("
            INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([
            $newProfileId,
            $cardId,
            $rowIndex,
            $colIndex,
            $pageIndex,
            $isVisible ? 1 : 0
        ]);
        $createdProfileCards++;
        $index++;
    }

    echo "  ✓ Created {$createdCards} cards and {$createdProfileCards} profile_cards for new root profile\n";

    $db->commit();

    echo "\n=== DONE ===\n";
    echo "New root profile ID for user {$userEmail}: {$newProfileId}\n";
    echo "你現在可以在前端打開 /profile/{$newProfileId}，這塊板的內容和順序會跟原始 Cboard Root 一樣，之後的修改也會正確保存。\n";

} catch (Exception $e) {
    $db->rollBack();
    echo "✗ Error recreating user root profile: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}


