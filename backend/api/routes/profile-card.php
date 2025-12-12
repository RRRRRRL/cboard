<?php
/**
 * Profile-Card Junction Routes Handler
 * Sprint 3: Manage card positioning in profiles
 */

require_once __DIR__ . '/../auth.php';

function handleProfileCardRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    $user = requireAuth($authToken);
    
    // POST /profile-cards (add card to profile with position)
    if ($method === 'POST' && count($pathParts) === 1) {
        $profileId = $data['profile_id'] ?? null;
        $cardId = $data['card_id'] ?? null;
        $rowIndex = isset($data['row_index']) ? (int)$data['row_index'] : 0;
        $colIndex = isset($data['col_index']) ? (int)$data['col_index'] : 0;
        $pageIndex = isset($data['page_index']) ? (int)$data['page_index'] : 0;
        $isVisible = isset($data['is_visible']) ? (int)$data['is_visible'] : 1;
        
        if (!$profileId || !$cardId) {
            return errorResponse('profile_id and card_id are required', 400);
        }
        
        try {
            // Verify profile ownership
            $stmt = $db->prepare("SELECT user_id FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found', 404);
            }
            
            if ($profile['user_id'] != $user['id']) {
                return errorResponse('Unauthorized', 403);
            }
            
            // Check if card exists
            $stmt = $db->prepare("SELECT id FROM cards WHERE id = ?");
            $stmt->execute([$cardId]);
            if (!$stmt->fetch()) {
                return errorResponse('Card not found', 404);
            }
            
            // Check if already exists at this position
            $stmt = $db->prepare("
                SELECT id FROM profile_cards 
                WHERE profile_id = ? AND card_id = ? AND page_index = ? AND row_index = ? AND col_index = ?
            ");
            $stmt->execute([$profileId, $cardId, $pageIndex, $rowIndex, $colIndex]);
            if ($stmt->fetch()) {
                return errorResponse('Card already exists at this position', 409);
            }
            
            // Insert
            $stmt = $db->prepare("
                INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmt->execute([$profileId, $cardId, $rowIndex, $colIndex, $pageIndex, $isVisible]);
            
            $id = $db->lastInsertId();
            
            // Fetch created record
            $stmt = $db->prepare("SELECT * FROM profile_cards WHERE id = ?");
            $stmt->execute([$id]);
            $profileCard = $stmt->fetch();
            
            return successResponse($profileCard, 201);
            
        } catch (Exception $e) {
            error_log("Create profile-card error: " . $e->getMessage());
            return errorResponse('Failed to add card to profile', 500);
        }
    }
    
    // PUT /profile-cards/{id} (update position)
    if ($method === 'PUT' && count($pathParts) === 2) {
        $id = $pathParts[1];
        
        try {
            // Verify ownership
            $stmt = $db->prepare("
                SELECT pc.id, p.user_id 
                FROM profile_cards pc
                INNER JOIN profiles p ON pc.profile_id = p.id
                WHERE pc.id = ?
            ");
            $stmt->execute([$id]);
            $profileCard = $stmt->fetch();
            
            if (!$profileCard) {
                return errorResponse('Profile-card not found', 404);
            }
            
            if ($profileCard['user_id'] != $user['id']) {
                return errorResponse('Unauthorized', 403);
            }
            
            // Build update query
            $updates = [];
            $params = [];
            
            if (isset($data['row_index'])) {
                $updates[] = "row_index = ?";
                $params[] = (int)$data['row_index'];
            }
            
            if (isset($data['col_index'])) {
                $updates[] = "col_index = ?";
                $params[] = (int)$data['col_index'];
            }
            
            if (isset($data['page_index'])) {
                $updates[] = "page_index = ?";
                $params[] = (int)$data['page_index'];
            }
            
            if (isset($data['is_visible'])) {
                $updates[] = "is_visible = ?";
                $params[] = (int)$data['is_visible'];
            }
            
            if (empty($updates)) {
                return errorResponse('No fields to update', 400);
            }
            
            $updates[] = "updated_at = NOW()";
            $params[] = $id;
            
            $sql = "UPDATE profile_cards SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            // Fetch updated record
            $stmt = $db->prepare("SELECT * FROM profile_cards WHERE id = ?");
            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            
            return successResponse($updated);
            
        } catch (Exception $e) {
            error_log("Update profile-card error: " . $e->getMessage());
            return errorResponse('Failed to update profile-card', 500);
        }
    }
    
    // DELETE /profile-cards/{id} (remove card from profile)
    if ($method === 'DELETE' && count($pathParts) === 2) {
        $id = $pathParts[1];
        
        try {
            // Verify ownership
            $stmt = $db->prepare("
                SELECT pc.id, p.user_id 
                FROM profile_cards pc
                INNER JOIN profiles p ON pc.profile_id = p.id
                WHERE pc.id = ?
            ");
            $stmt->execute([$id]);
            $profileCard = $stmt->fetch();
            
            if (!$profileCard) {
                return errorResponse('Profile-card not found', 404);
            }
            
            if ($profileCard['user_id'] != $user['id']) {
                return errorResponse('Unauthorized', 403);
            }
            
            $stmt = $db->prepare("DELETE FROM profile_cards WHERE id = ?");
            $stmt->execute([$id]);
            
            return successResponse(['success' => true, 'message' => 'Card removed from profile']);
            
        } catch (Exception $e) {
            error_log("Delete profile-card error: " . $e->getMessage());
            return errorResponse('Failed to remove card from profile', 500);
        }
    }
    
    // GET /profile-cards?profile_id={id} (get all cards for a profile)
    if ($method === 'GET' && count($pathParts) === 1) {
        $profileId = $_GET['profile_id'] ?? null;
        
        if (!$profileId) {
            return errorResponse('profile_id parameter is required', 400);
        }
        
        try {
            // Verify profile ownership or public access
            $stmt = $db->prepare("SELECT user_id, is_public FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found', 404);
            }
            
            if ($profile['user_id'] != $user['id'] && !$profile['is_public']) {
                return errorResponse('Unauthorized', 403);
            }
            
            // Get cards with positions
            $stmt = $db->prepare("
                SELECT pc.id, pc.profile_id, pc.card_id, pc.row_index, pc.col_index, pc.page_index, pc.is_visible,
                       c.title, c.label_text, c.image_path, c.audio_path, c.image_url, c.sound_url,
                       c.text_color, c.background_color, c.category, c.card_data
                FROM profile_cards pc
                INNER JOIN cards c ON pc.card_id = c.id
                WHERE pc.profile_id = ?
                ORDER BY pc.page_index, pc.row_index, pc.col_index
            ");
            $stmt->execute([$profileId]);
            $cards = $stmt->fetchAll();
            
            return successResponse(['cards' => $cards]);
            
        } catch (Exception $e) {
            error_log("Get profile-cards error: " . $e->getMessage());
            return errorResponse('Failed to fetch profile cards', 500);
        }
    }
    
    return errorResponse('Profile-card route not found', 404);
}

