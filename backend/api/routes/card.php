<?php
/**
 * Card Routes Handler
 * Sprint 3: Card CRUD operations
 */

require_once __DIR__ . '/../auth.php';

function handleCardRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    $user = requireAuth($authToken);
    
    // GET /cards (list cards - optionally filtered by profile)
    if ($method === 'GET' && count($pathParts) === 1) {
        try {
            $profileId = $_GET['profile_id'] ?? null;
            $category = $_GET['category'] ?? null;
            
            $sql = "SELECT id, title, label_text, image_path, audio_path, image_url, sound_url, 
                           text_color, background_color, category, card_data, created_at, updated_at
                    FROM cards";
            $params = [];
            $conditions = [];
            
            // If profile_id provided, get cards for that profile
            if ($profileId) {
                $sql = "SELECT c.id, c.title, c.label_text, c.image_path, c.audio_path, c.image_url, c.sound_url,
                               c.text_color, c.background_color, c.category, c.card_data,
                               pc.row_index, pc.col_index, pc.page_index, pc.is_visible,
                               c.created_at, c.updated_at
                        FROM cards c
                        INNER JOIN profile_cards pc ON c.id = pc.card_id
                        WHERE pc.profile_id = ?";
                $params[] = $profileId;
            }
            
            if ($category) {
                $conditions[] = "category = ?";
                $params[] = $category;
            }
            
            if (!empty($conditions)) {
                $sql .= " WHERE " . implode(" AND ", $conditions);
            }
            
            $sql .= " ORDER BY c.created_at DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $cards = $stmt->fetchAll();
            
            return successResponse(['cards' => $cards]);
            
        } catch (Exception $e) {
            error_log("List cards error: " . $e->getMessage());
            return errorResponse('Failed to fetch cards', 500);
        }
    }
    
    // GET /cards/{id}
    if ($method === 'GET' && count($pathParts) === 2) {
        $cardId = $pathParts[1];
        
        try {
            $stmt = $db->prepare("
                SELECT id, title, label_text, image_path, audio_path, image_url, sound_url,
                       text_color, background_color, category, card_data, created_at, updated_at
                FROM cards 
                WHERE id = ?
            ");
            $stmt->execute([$cardId]);
            $card = $stmt->fetch();
            
            if (!$card) {
                return errorResponse('Card not found', 404);
            }
            
            return successResponse($card);
            
        } catch (Exception $e) {
            error_log("Get card error: " . $e->getMessage());
            return errorResponse('Failed to fetch card', 500);
        }
    }
    
    // POST /cards (create)
    if ($method === 'POST' && count($pathParts) === 1) {
        $title = trim($data['title'] ?? '');
        $labelText = trim($data['label_text'] ?? $data['label'] ?? '');
        $imagePath = $data['image_path'] ?? $data['image_url'] ?? null;
        $audioPath = $data['audio_path'] ?? $data['sound_url'] ?? null;
        $textColor = $data['text_color'] ?? null;
        $backgroundColor = $data['background_color'] ?? null;
        $category = $data['category'] ?? null;
        $cardData = isset($data['card_data']) ? json_encode($data['card_data']) : null;
        
        if (empty($title)) {
            return errorResponse('Card title is required', 400);
        }
        
        try {
            // Set image_url and sound_url as aliases
            $imageUrl = $imagePath;
            $soundUrl = $audioPath;
            
            $stmt = $db->prepare("
                INSERT INTO cards (title, label_text, image_path, audio_path, image_url, sound_url,
                                  text_color, background_color, category, card_data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmt->execute([
                $title,
                $labelText,
                $imagePath,
                $audioPath,
                $imageUrl,
                $soundUrl,
                $textColor,
                $backgroundColor,
                $category,
                $cardData
            ]);
            
            $cardId = $db->lastInsertId();
            
            // Fetch created card
            $stmt = $db->prepare("SELECT * FROM cards WHERE id = ?");
            $stmt->execute([$cardId]);
            $card = $stmt->fetch();
            
            return successResponse($card, 201);
            
        } catch (Exception $e) {
            error_log("Create card error: " . $e->getMessage());
            return errorResponse('Failed to create card', 500);
        }
    }
    
    // PUT /cards/{id} (update)
    if ($method === 'PUT' && count($pathParts) === 2) {
        $cardId = $pathParts[1];
        
        try {
            // Build update query
            $updates = [];
            $params = [];
            
            if (isset($data['title'])) {
                $updates[] = "title = ?";
                $params[] = trim($data['title']);
            }
            
            if (isset($data['label_text']) || isset($data['label'])) {
                $updates[] = "label_text = ?";
                $params[] = trim($data['label_text'] ?? $data['label']);
            }
            
            if (isset($data['image_path']) || isset($data['image_url'])) {
                $imagePath = $data['image_path'] ?? $data['image_url'];
                $updates[] = "image_path = ?";
                $updates[] = "image_url = ?";
                $params[] = $imagePath;
                $params[] = $imagePath;
            }
            
            if (isset($data['audio_path']) || isset($data['sound_url'])) {
                $audioPath = $data['audio_path'] ?? $data['sound_url'];
                $updates[] = "audio_path = ?";
                $updates[] = "sound_url = ?";
                $params[] = $audioPath;
                $params[] = $audioPath;
            }
            
            if (isset($data['text_color'])) {
                $updates[] = "text_color = ?";
                $params[] = $data['text_color'];
            }
            
            if (isset($data['background_color'])) {
                $updates[] = "background_color = ?";
                $params[] = $data['background_color'];
            }
            
            if (isset($data['category'])) {
                $updates[] = "category = ?";
                $params[] = $data['category'];
            }
            
            if (isset($data['card_data'])) {
                $updates[] = "card_data = ?";
                $params[] = json_encode($data['card_data']);
            }
            
            if (empty($updates)) {
                return errorResponse('No fields to update', 400);
            }
            
            $updates[] = "updated_at = NOW()";
            $params[] = $cardId;
            
            $sql = "UPDATE cards SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            // Fetch updated card
            $stmt = $db->prepare("SELECT * FROM cards WHERE id = ?");
            $stmt->execute([$cardId]);
            $updatedCard = $stmt->fetch();
            
            return successResponse($updatedCard);
            
        } catch (Exception $e) {
            error_log("Update card error: " . $e->getMessage());
            return errorResponse('Failed to update card', 500);
        }
    }
    
    // DELETE /cards/{id}
    if ($method === 'DELETE' && count($pathParts) === 2) {
        $cardId = $pathParts[1];
        
        try {
            // Check if card exists
            $stmt = $db->prepare("SELECT id FROM cards WHERE id = ?");
            $stmt->execute([$cardId]);
            if (!$stmt->fetch()) {
                return errorResponse('Card not found', 404);
            }
            
            // Delete from profile_cards first (cascade will handle it, but explicit is better)
            $stmt = $db->prepare("DELETE FROM profile_cards WHERE card_id = ?");
            $stmt->execute([$cardId]);
            
            // Delete card
            $stmt = $db->prepare("DELETE FROM cards WHERE id = ?");
            $stmt->execute([$cardId]);
            
            return successResponse(['success' => true, 'message' => 'Card deleted successfully']);
            
        } catch (Exception $e) {
            error_log("Delete card error: " . $e->getMessage());
            return errorResponse('Failed to delete card', 500);
        }
    }
    
    return errorResponse('Card route not found', 404);
}

