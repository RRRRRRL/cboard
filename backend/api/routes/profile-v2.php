<?php
/**
 * Profile Routes Handler - Profile-Centric Version (No Boards Table)
 * 
 * This version uses only profiles + profile_cards + cards structure.
 * No dependency on boards table or root_board_id.
 */

require_once __DIR__ . '/../helpers-layout.php';
require_once __DIR__ . '/../auth.php';

/**
 * Build board data structure from profile_cards + cards
 * This replaces the old board_data JSON from boards table
 */
function buildBoardDataFromProfile($db, $profileId) {
    // Get profile info
    $stmt = $db->prepare("
        SELECT id, user_id, display_name, description, layout_type, language, is_public, created_at, updated_at
        FROM profiles
        WHERE id = ?
    ");
    $stmt->execute([$profileId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$profile) {
        return null;
    }
    
    // Get all cards for this profile with their positions
    $stmt = $db->prepare("
        SELECT 
            c.id as card_id,
            c.title,
            c.label_text,
            c.image_path,
            c.image_url,
            c.audio_path,
            c.sound_url,
            c.text_color,
            c.background_color,
            c.category,
            pc.row_index,
            pc.col_index,
            pc.page_index,
            pc.is_visible
        FROM profile_cards pc
        INNER JOIN cards c ON pc.card_id = c.id
        WHERE pc.profile_id = ?
        ORDER BY pc.page_index, pc.row_index, pc.col_index
    ");
    $stmt->execute([$profileId]);
    $profileCards = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Build tiles array (compatible with Cboard format)
    $tiles = [];
    foreach ($profileCards as $pc) {
        $tile = [
            'id' => 'card_' . $pc['card_id'],
            'label' => $pc['label_text'] ?: $pc['title'],
            'labelKey' => $pc['label_text'] ?: $pc['title'],
            'image' => $pc['image_path'] ?: $pc['image_url'],
            'image_url' => $pc['image_path'] ?: $pc['image_url'],
            'sound' => $pc['audio_path'] ?: $pc['sound_url'],
            'sound_url' => $pc['audio_path'] ?: $pc['sound_url'],
            'text_color' => $pc['text_color'],
            'background_color' => $pc['background_color'],
            'category' => $pc['category'],
            'row' => (int)$pc['row_index'],
            'col' => (int)$pc['col_index'],
            'page' => (int)$pc['page_index'],
            'row_index' => (int)$pc['row_index'],
            'col_index' => (int)$pc['col_index'],
            'page_index' => (int)$pc['page_index'],
            'hidden' => !$pc['is_visible'],
            'is_visible' => (bool)$pc['is_visible']
        ];
        $tiles[] = $tile;
    }
    
    // Build board structure (compatible with Cboard format)
    $board = [
        'id' => (string)$profile['id'],
        'name' => $profile['display_name'],
        'description' => $profile['description'],
        'isPublic' => (bool)$profile['is_public'],
        'isFixed' => false,
        'profileId' => (int)$profile['id'],
        'tiles' => $tiles,
        'grid' => [
            'rows' => $profile['layout_type'] ? extractRowsFromLayoutType($profile['layout_type']) : 4,
            'columns' => $profile['layout_type'] ? extractColumnsFromLayoutType($profile['layout_type']) : 6
        ],
        'language' => $profile['language'],
        'layout_type' => $profile['layout_type'],
        'createdAt' => $profile['created_at'],
        'updatedAt' => $profile['updated_at']
    ];
    
    return $board;
}

/**
 * Save board data to profile_cards + cards
 * This replaces saving to boards table
 */
function saveBoardDataToProfile($db, $profileId, $boardData) {
    $db->beginTransaction();
    
    try {
        // Update profile metadata
        $displayName = trim($boardData['name'] ?? '');
        $description = trim($boardData['description'] ?? '');
        $isPublic = isset($boardData['isPublic']) ? (int)$boardData['isPublic'] : 0;
        $layoutType = $boardData['layout_type'] ?? $boardData['layoutType'] ?? null;
        $language = $boardData['language'] ?? null;
        
        $stmt = $db->prepare("
            UPDATE profiles
            SET display_name = ?, description = ?, is_public = ?, layout_type = ?, language = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$displayName, $description, $isPublic, $layoutType, $language, $profileId]);
        
        // Remove all existing profile_cards for this profile
        $stmt = $db->prepare("DELETE FROM profile_cards WHERE profile_id = ?");
        $stmt->execute([$profileId]);
        
        // Process tiles from boardData
        $tiles = $boardData['tiles'] ?? [];
        if (is_array($tiles) && !empty($tiles)) {
            foreach ($tiles as $tile) {
                if (!is_array($tile)) {
                    continue;
                }
                
                // Extract tile data
                $title = $tile['label'] ?? $tile['title'] ?? $tile['labelKey'] ?? '';
                $labelText = $tile['label'] ?? $tile['label_text'] ?? $tile['labelKey'] ?? '';
                $imagePath = $tile['image'] ?? $tile['image_path'] ?? $tile['image_url'] ?? null;
                $audioPath = $tile['sound'] ?? $tile['sound_url'] ?? $tile['audio_path'] ?? null;
                $textColor = $tile['text_color'] ?? null;
                $backgroundColor = $tile['background_color'] ?? null;
                $category = $tile['category'] ?? 'general';
                
                // Get position
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
                
                // Try to find existing card by image_path
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
                }
                
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
            }
        }
        
        $db->commit();
        return true;
        
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

/**
 * Helper functions for layout type parsing
 */
function extractRowsFromLayoutType($layoutType) {
    if (preg_match('/(\d+)x\d+/', $layoutType, $matches)) {
        return (int)$matches[1];
    }
    return 4; // default
}

function extractColumnsFromLayoutType($layoutType) {
    if (preg_match('/\d+x(\d+)/', $layoutType, $matches)) {
        return (int)$matches[1];
    }
    return 6; // default
}

// Helper function to get public profiles (same as before)
function getPublicProfilesHelper($db, $language = null, $layoutType = null, $limit = 50, $offset = 0, $pagination = null) {
    // Use pagination if provided, otherwise use limit/offset
    if ($pagination) {
        $limit = $pagination['limit'];
        $offset = ($pagination['page'] - 1) * $limit;
    }
    
    // 只返回「真實使用者的公開 profile」，避免把系統預設模板 (user_id = 1) 混入公共庫
    $sql = "SELECT id, user_id, display_name, description, layout_type, language, is_public, created_at, updated_at
            FROM profiles 
            WHERE is_public = 1
              AND user_id <> 1";
    $params = [];
    
    if ($language) {
        $sql .= " AND language = ?";
        $params[] = $language;
    }
    
    if ($layoutType) {
        $sql .= " AND layout_type = ?";
        $params[] = $layoutType;
    }
    
    $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $profiles = $stmt->fetchAll();
    
    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM profiles WHERE is_public = 1 AND user_id <> 1";
    $countParams = [];
    if ($language) {
        $countSql .= " AND language = ?";
        $countParams[] = $language;
    }
    if ($layoutType) {
        $countSql .= " AND layout_type = ?";
        $countParams[] = $layoutType;
    }
    $stmt = $db->prepare($countSql);
    $stmt->execute($countParams);
    $total = $stmt->fetch()['total'];
    
    return [
        'profiles' => $profiles,
        'total' => (int)$total,
        'limit' => $limit,
        'offset' => $offset,
        'page' => $pagination ? $pagination['page'] : (int)($offset / $limit) + 1
    ];
}

// Note: The rest of the route handlers would be similar to profile.php
// but without any references to boards table or root_board_id
// This is a template - you'll need to integrate these functions into profile.php

