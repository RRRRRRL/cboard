<?php
/**
 * Board Routes Handler
 */

require_once __DIR__ . '/../auth.php';

function handleBoardRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    $pagination = getPaginationParams();
    
    // GET /board (public boards)
    if ($method === 'GET' && count($pathParts) === 1) {
        try {
            $stmt = $db->prepare("
                SELECT id, board_id, name, description, is_public, last_edited, created_at
                FROM boards 
                WHERE is_public = 1
                ORDER BY last_edited DESC
                LIMIT ? OFFSET ?
            ");
            $limit = $pagination['limit'];
            $offset = ($pagination['page'] - 1) * $limit;
            $stmt->execute([$limit, $offset]);
            $boards = $stmt->fetchAll();
            
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM boards WHERE is_public = 1");
            $stmt->execute();
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'boards' => $boards,
                'total' => (int)$total,
                'page' => $pagination['page'],
                'limit' => $pagination['limit']
            ]);
        } catch (Exception $e) {
            error_log("Get public boards error: " . $e->getMessage());
            return errorResponse('Failed to fetch public boards', 500);
        }
    }
    
    // GET /board/public
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'public') {
        try {
            $stmt = $db->prepare("
                SELECT id, board_id, name, description, is_public, last_edited, created_at
                FROM boards 
                WHERE is_public = 1
                ORDER BY last_edited DESC
                LIMIT ? OFFSET ?
            ");
            $limit = $pagination['limit'];
            $offset = ($pagination['page'] - 1) * $limit;
            $stmt->execute([$limit, $offset]);
            $boards = $stmt->fetchAll();
            
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM boards WHERE is_public = 1");
            $stmt->execute();
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'boards' => $boards,
                'total' => (int)$total,
                'page' => $pagination['page'],
                'limit' => $pagination['limit']
            ]);
        } catch (Exception $e) {
            error_log("Get public boards error: " . $e->getMessage());
            return errorResponse('Failed to fetch public boards', 500);
        }
    }
    
    // GET /board/my - Get boards for authenticated user (recommended, token-based)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'my') {
        $user = requireAuth($authToken);
        
        try {
            $stmt = $db->prepare("
                SELECT id, board_id, name, description, is_public, last_edited, created_at
                FROM boards 
                WHERE user_id = ?
                ORDER BY last_edited DESC
                LIMIT ? OFFSET ?
            ");
            $limit = $pagination['limit'];
            $offset = ($pagination['page'] - 1) * $limit;
            $stmt->execute([$user['id'], $limit, $offset]);
            $boards = $stmt->fetchAll();
            
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM boards WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'boards' => $boards,
                'total' => (int)$total,
                'page' => $pagination['page'],
                'limit' => $pagination['limit']
            ]);
        } catch (Exception $e) {
            error_log("Get user boards error: " . $e->getMessage());
            return errorResponse('Failed to fetch user boards', 500);
        }
    }
    
    // GET /board/byemail/{email} - Legacy endpoint (deprecated, kept for backward compatibility)
    // NOTE: This endpoint is less secure as it exposes email in URL. Use /board/my instead.
    if ($method === 'GET' && count($pathParts) >= 3 && $pathParts[1] === 'byemail') {
        $user = requireAuth($authToken);
        
        // Handle URL-encoded email (email might be split across path parts if @ is not encoded)
        // Join all parts after 'byemail' to handle cases where email contains special chars
        $emailParts = array_slice($pathParts, 2);
        $email = urldecode(implode('/', $emailParts));
        
        // Verify the email matches the authenticated user (case-insensitive comparison)
        if (strtolower($user['email']) !== strtolower($email)) {
            error_log("Email mismatch - user email: {$user['email']}, requested email: $email");
            return errorResponse('Unauthorized: email mismatch', 403);
        }
        
        // Log deprecation warning
        error_log("WARNING: Using deprecated endpoint /board/byemail/{email}. Use /board/my instead.");
        
        try {
            $stmt = $db->prepare("
                SELECT id, board_id, name, description, is_public, last_edited, created_at
                FROM boards 
                WHERE user_id = ?
                ORDER BY last_edited DESC
                LIMIT ? OFFSET ?
            ");
            $limit = $pagination['limit'];
            $offset = ($pagination['page'] - 1) * $limit;
            $stmt->execute([$user['id'], $limit, $offset]);
            $boards = $stmt->fetchAll();
            
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM boards WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'boards' => $boards,
                'total' => (int)$total,
                'page' => $pagination['page'],
                'limit' => $pagination['limit'],
                'deprecated' => true,
                'message' => 'This endpoint is deprecated. Please use /board/my instead.'
            ]);
        } catch (Exception $e) {
            error_log("Get user boards error: " . $e->getMessage());
            return errorResponse('Failed to fetch user boards', 500);
        }
    }
    
    // GET /board/{id}
    if ($method === 'GET' && count($pathParts) === 2) {
        $boardId = $pathParts[1];
        
        try {
            error_log("Getting board - board_id: $boardId");
            $stmt = $db->prepare("
                SELECT id, board_id, name, description, board_data, is_public, is_fixed, last_edited, created_at, updated_at
                FROM boards 
                WHERE board_id = ?
            ");
            $stmt->execute([$boardId]);
            $row = $stmt->fetch();
            
            if (!$row) {
                error_log("Board not found - board_id: $boardId");
                return errorResponse('Board not found', 404);
            }
            
            // Parse board_data JSON
            $boardData = $row['board_data'] ? json_decode($row['board_data'], true) : null;
            
            // If board_data exists, merge it with the board metadata
            // Frontend expects the full board object with tiles, grid, etc.
            $board = [
                'id' => $row['board_id'],
                'name' => $row['name'],
                'description' => $row['description'],
                'isPublic' => (bool)$row['is_public'],
                'isFixed' => (bool)$row['is_fixed'],
                'lastEdited' => $row['last_edited'],
                'createdAt' => $row['created_at'],
                'updatedAt' => $row['updated_at']
            ];
            
            // Merge board_data if it exists
            if ($boardData && is_array($boardData)) {
                $board = array_merge($board, $boardData);
                error_log("Board loaded - board_id: $boardId, tiles count: " . (isset($board['tiles']) ? count($board['tiles']) : 0));
            } else {
                error_log("Board loaded but no board_data - board_id: $boardId");
            }
            
            return successResponse($board);
        } catch (Exception $e) {
            error_log("Get board error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Failed to fetch board', 500);
        }
    }
    
    // GET /board/cbuilder/{id}
    if ($method === 'GET' && count($pathParts) === 3 && $pathParts[1] === 'cbuilder') {
        $user = requireAuth($authToken);
        $boardId = $pathParts[2];
        
        try {
            $stmt = $db->prepare("
                SELECT id, board_id, name, description, board_data, is_public, is_fixed, last_edited
                FROM boards 
                WHERE board_id = ? AND (user_id = ? OR is_public = 1)
            ");
            $stmt->execute([$boardId, $user['id']]);
            $row = $stmt->fetch();
            
            if (!$row) {
                return errorResponse('Board not found', 404);
            }
            
            $boardData = $row['board_data'] ? json_decode($row['board_data'], true) : null;
            
            $board = [
                'id' => $row['board_id'],
                'name' => $row['name'],
                'boardData' => $boardData ?: []
            ];
            
            return successResponse($board);
        } catch (Exception $e) {
            error_log("Get board for builder error: " . $e->getMessage());
            return errorResponse('Failed to fetch board', 500);
        }
    }
    
    // POST /board
    if ($method === 'POST' && count($pathParts) === 1) {
        $user = requireAuth($authToken);
        
        try {
            $originalBoardId = $data['id'] ?? null;
            $name = trim($data['name'] ?? 'New Board');
            $description = trim($data['description'] ?? '');
            $isPublic = isset($data['isPublic']) ? (int)$data['isPublic'] : 0;
            $isFixed = isset($data['isFixed']) ? (int)$data['isFixed'] : 0;
            
            // Generate board_id if not provided or if it's too short (local ID)
            $boardId = $originalBoardId;
            if (!$boardId || strlen($boardId) < 14) {
                $boardId = bin2hex(random_bytes(12)); // 24 character hex string
                error_log("Generated new board_id: $boardId (original was: " . ($originalBoardId ?: 'null') . ")");
            }
            
            // Prepare board_data JSON - store the entire board object
            // Remove id from board_data since we store it separately as board_id
            $boardData = $data;
            unset($boardData['id']); // Remove id, we use board_id instead
            // Ensure board_id is set in board_data for consistency
            $boardData['id'] = $boardId;
            $boardDataJson = json_encode($boardData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            error_log("Creating board - user_id: {$user['id']}, board_id: $boardId, name: $name, tiles count: " . (isset($data['tiles']) ? count($data['tiles']) : 0));
            
            $stmt = $db->prepare("
                INSERT INTO boards (user_id, board_id, name, description, board_data, is_public, is_fixed, last_edited, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
            ");
            $stmt->execute([
                $user['id'],
                $boardId,
                $name,
                $description,
                $boardDataJson,
                $isPublic,
                $isFixed
            ]);
            
            $insertedId = $db->lastInsertId();
            error_log("Board created successfully - DB id: $insertedId, board_id: $boardId");
            
            // Return the board with the generated/used board_id
            return successResponse([
                'id' => $boardId,
                'name' => $name,
                'description' => $description,
                'isPublic' => (bool)$isPublic,
                'isFixed' => (bool)$isFixed
            ], 201);
        } catch (Exception $e) {
            error_log("Create board error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Failed to create board: ' . $e->getMessage(), 500);
        }
    }
    
    // PUT /board/{id}
    if ($method === 'PUT' && count($pathParts) === 2) {
        $user = requireAuth($authToken);
        $boardId = $pathParts[1];
        
        try {
            // Check if board exists and belongs to user
            $stmt = $db->prepare("
                SELECT id, user_id FROM boards WHERE board_id = ?
            ");
            $stmt->execute([$boardId]);
            $existing = $stmt->fetch();
            
            if (!$existing) {
                error_log("Update board - Board not found: $boardId");
                return errorResponse('Board not found', 404);
            }
            
            if ($existing['user_id'] != $user['id']) {
                error_log("Update board - Unauthorized: board $boardId belongs to user {$existing['user_id']}, but request from user {$user['id']}");
                return errorResponse('Unauthorized: board does not belong to user', 403);
            }
            
            $name = trim($data['name'] ?? '');
            $description = trim($data['description'] ?? '');
            $isPublic = isset($data['isPublic']) ? (int)$data['isPublic'] : 0;
            $isFixed = isset($data['isFixed']) ? (int)$data['isFixed'] : 0;
            
            // Prepare board_data JSON - store the entire board object
            $boardData = $data;
            unset($boardData['id']); // Remove id, we use board_id instead
            // Ensure board_id is set in board_data for consistency
            $boardData['id'] = $boardId;
            $boardDataJson = json_encode($boardData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            error_log("Updating board - board_id: $boardId, name: $name, tiles count: " . (isset($data['tiles']) ? count($data['tiles']) : 0));
            
            $stmt = $db->prepare("
                UPDATE boards 
                SET name = ?, description = ?, board_data = ?, is_public = ?, is_fixed = ?, last_edited = NOW(), updated_at = NOW()
                WHERE board_id = ?
            ");
            $stmt->execute([
                $name,
                $description,
                $boardDataJson,
                $isPublic,
                $isFixed,
                $boardId
            ]);
            
            error_log("Board updated successfully - board_id: $boardId");
            
            return successResponse([
                'id' => $boardId,
                'name' => $name,
                'description' => $description,
                'isPublic' => (bool)$isPublic,
                'isFixed' => (bool)$isFixed
            ]);
        } catch (Exception $e) {
            error_log("Update board error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Failed to update board: ' . $e->getMessage(), 500);
        }
    }
    
    // DELETE /board/{id}
    if ($method === 'DELETE' && count($pathParts) === 2) {
        $user = requireAuth($authToken);
        $boardId = $pathParts[1];
        
        try {
            // Check if board exists and belongs to user
            $stmt = $db->prepare("
                SELECT id, user_id FROM boards WHERE board_id = ?
            ");
            $stmt->execute([$boardId]);
            $existing = $stmt->fetch();
            
            if (!$existing) {
                return errorResponse('Board not found', 404);
            }
            
            if ($existing['user_id'] != $user['id']) {
                return errorResponse('Unauthorized: board does not belong to user', 403);
            }
            
            $stmt = $db->prepare("DELETE FROM boards WHERE board_id = ?");
            $stmt->execute([$boardId]);
            
            return successResponse(['success' => true, 'message' => 'Board deleted']);
        } catch (Exception $e) {
            error_log("Delete board error: " . $e->getMessage());
            return errorResponse('Failed to delete board', 500);
        }
    }
    
    // POST /board/report
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'report') {
        $user = requireAuth($authToken);
        
        // TODO: Handle board report
        return successResponse(['success' => true, 'message' => 'Board reported']);
    }
    
    return errorResponse('Board route not found', 404);
}

