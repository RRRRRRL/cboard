<?php
/**
 * 一次性迁移脚本：將現有 boards 表中的資料映射到 profiles，
 * 讓每個板（board）對應一個 profile（profile = board）。
 *
 * 使用方式（在伺服器上）：
 *   php backend/scripts/migrate-boards-to-profiles.php
 *
 * 建議步驟：
 *   1. 先備份資料庫。
 *   2. 執行此腳本，觀察輸出日誌。
 *   3. 確認 profiles 裡都有對應紀錄，前端使用正常。
 *   4. 確認沒再用到 boards 後，才考慮 DROP TABLE boards。
 */

declare(strict_types=1);

// 直接載入資料庫設定與初始化（比 index.php 更簡單、也符合其它 seed script 的寫法）
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

function migrateBoardsToProfiles(PDO $db): void
{
    echo "=== 開始將 boards 資料遷移為 profiles ===\n";

    // 1. 讀出所有 boards
    $sqlBoards = "
        SELECT id, user_id, board_id, name, description, is_public, created_at, updated_at
        FROM boards
        ORDER BY user_id, created_at ASC
    ";
    $stmt = $db->prepare($sqlBoards);
    $stmt->execute();
    $boards = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$boards) {
        echo "沒有任何 boards 可供遷移，結束。\n";
        return;
    }

    echo "共找到 " . count($boards) . " 筆 boards。\n";

    // 2. 建立現有 profiles 的 root_board_id 快取，避免重覆建立
    $stmt = $db->prepare("
        SELECT id, user_id, root_board_id
        FROM profiles
        WHERE root_board_id IS NOT NULL
    ");
    $stmt->execute();
    $existingProfiles = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $existingByUserAndBoard = [];
    foreach ($existingProfiles as $p) {
        $key = $p['user_id'] . '::' . $p['root_board_id'];
        $existingByUserAndBoard[$key] = (int)$p['id'];
    }

    echo "已載入 " . count($existingByUserAndBoard) . " 筆已存在的 profile-root_board 對應。\n";

    $createdCount = 0;
    $skippedExisting = 0;

    foreach ($boards as $board) {
        $userId = (int)$board['user_id'];
        $boardId = $board['board_id'];
        if (!$userId || !$boardId) {
            echo "略過無效 board (id={$board['id']} user_id={$board['user_id']} board_id={$board['board_id']})。\n";
            continue;
        }

        $key = $userId . '::' . $boardId;
        if (isset($existingByUserAndBoard[$key])) {
            // 這個 user + board 組合已經有 profile，略過
            $skippedExisting++;
            continue;
        }

        $displayName = $board['name'] ?: ('Board ' . $boardId);
        $description = $board['description'] ?? '';
        $isPublic = (int)($board['is_public'] ?? 0);

        // 3. 建立 profile 記錄
        $insert = $db->prepare("
            INSERT INTO profiles (
                user_id,
                display_name,
                name,
                description,
                layout_type,
                language,
                root_board_id,
                is_default,
                is_public,
                created_at,
                updated_at
            ) VALUES (
                :user_id,
                :display_name,
                :name,
                :description,
                :layout_type,
                :language,
                :root_board_id,
                :is_default,
                :is_public,
                :created_at,
                :updated_at
            )
        ");

        // layout_type / language 無法從 boards 得知，先給合理預設
        $params = [
            ':user_id'       => $userId,
            ':display_name'  => $displayName,
            ':name'          => $displayName,
            ':description'   => $description,
            ':layout_type'   => '4x6',
            ':language'      => 'zh-HK',
            ':root_board_id' => $boardId,
            // 是否 default：保守做法一律 0，讓使用者之後自行指定
            ':is_default'    => 0,
            ':is_public'     => $isPublic,
            ':created_at'    => $board['created_at'] ?: date('Y-m-d H:i:s'),
            ':updated_at'    => $board['updated_at'] ?: date('Y-m-d H:i:s'),
        ];

        try {
            $insert->execute($params);
            $newProfileId = (int)$db->lastInsertId();
            $createdCount++;
            $existingByUserAndBoard[$key] = $newProfileId;

            echo "已建立 profile #{$newProfileId} 對應 board_id={$boardId} (user_id={$userId}).\n";
        } catch (Exception $e) {
            echo "建立 profile 失敗 (board_id={$boardId}, user_id={$userId}): " . $e->getMessage() . "\n";
        }
    }

    echo "=== 遷移完成 ===\n";
    echo "新建 profiles：{$createdCount} 筆\n";
    echo "原本就已存在對應的 profiles：{$skippedExisting} 筆\n";
    echo "請檢查 profiles/root_board_id 是否已完整對應所有 boards，再考慮刪除 boards 表。\n";
}

try {
    $db = getDB();
    if (!$db) {
        echo "無法取得資料庫連線。\n";
        exit(1);
    }

    migrateBoardsToProfiles($db);
} catch (Exception $e) {
    echo "執行遷移時發生錯誤：" . $e->getMessage() . "\n";
    exit(1);
}


