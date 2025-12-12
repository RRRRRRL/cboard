<?php
/**
 * Profile Routes Handler
 * Sprint 2: Profile CRUD operations
 * Sprint 3: Added layout templates support
 */

require_once __DIR__ . '/../helpers-layout.php';
require_once __DIR__ . '/../auth.php';

function handleProfileRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    // GET /profiles/templates (get available layout templates) - No auth required
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'templates') {
        return successResponse(['templates' => getAvailableLayouts()]);
    }
    
    // GET /profiles/public (get preset/public profiles) - No auth required
    if ($method === 'GET' && count($pathParts) >= 2 && $pathParts[1] === 'public') {
        try {
            $language = $_GET['language'] ?? null;
            $layoutType = $_GET['layout_type'] ?? null;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
            
            $sql = "SELECT id, display_name, name, description, layout_type, language, root_board_id, is_public, created_at, updated_at
                    FROM profiles 
                    WHERE is_public = 1";
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
            $countSql = "SELECT COUNT(*) as total FROM profiles WHERE is_public = 1";
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
            
            return successResponse([
                'profiles' => $profiles,
                'total' => (int)$total,
                'limit' => $limit,
                'offset' => $offset
            ]);
            
        } catch (Exception $e) {
            error_log("Get public profiles error: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
            return errorResponse('Failed to fetch public profiles: ' . $e->getMessage(), 500);
        }
    }
    
    // All other endpoints require authentication
    $user = requireAuth($authToken);
    $pagination = getPaginationParams();
    
    // GET /profiles (list user's profiles with search)
    if ($method === 'GET' && count($pathParts) === 1) {
        try {
            $search = $pagination['search'];
            $offset = $pagination['offset'];
            $limit = $pagination['limit'];
            
            $sql = "SELECT id, display_name, name, description, layout_type, language, root_board_id, is_default, is_public, created_at, updated_at 
                    FROM profiles 
                    WHERE user_id = ?";
            $params = [$user['id']];
            
            if (!empty($search)) {
                $sql .= " AND (display_name LIKE ? OR description LIKE ?)";
                $searchTerm = "%$search%";
                $params[] = $searchTerm;
                $params[] = $searchTerm;
            }
            
            $sql .= " ORDER BY is_default DESC, created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $profiles = $stmt->fetchAll();
            
            // Get total count
            $countSql = "SELECT COUNT(*) as total FROM profiles WHERE user_id = ?";
            $countParams = [$user['id']];
            if (!empty($search)) {
                $countSql .= " AND (display_name LIKE ? OR description LIKE ?)";
                $searchTerm = "%$search%";
                $countParams[] = $searchTerm;
                $countParams[] = $searchTerm;
            }
            $stmt = $db->prepare($countSql);
            $stmt->execute($countParams);
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'profiles' => $profiles,
                'total' => (int)$total,
                'page' => $pagination['page'],
                'limit' => $limit
            ]);
            
        } catch (Exception $e) {
            error_log("List profiles error: " . $e->getMessage());
            return errorResponse('Failed to fetch profiles', 500);
        }
    }
    
    // GET /profiles/{id}
    if ($method === 'GET' && count($pathParts) === 2) {
        $profileId = $pathParts[1];
        
        try {
            $stmt = $db->prepare("
                SELECT id, user_id, display_name, name, description, layout_type, language, root_board_id, is_default, is_public, created_at, updated_at
                FROM profiles 
                WHERE id = ?
            ");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found', 404);
            }
            
            // Check ownership (unless public)
            if ($profile['user_id'] != $user['id'] && !$profile['is_public']) {
                return errorResponse('Unauthorized', 403);
            }
            
            return successResponse($profile);
            
        } catch (Exception $e) {
            error_log("Get profile error: " . $e->getMessage());
            return errorResponse('Failed to fetch profile', 500);
        }
    }
    
    // POST /profiles (create)
    if ($method === 'POST' && count($pathParts) === 1) {
        $displayName = trim($data['display_name'] ?? $data['name'] ?? '');
        $description = trim($data['description'] ?? '');
        $layoutType = $data['layout_type'] ?? null;
        $language = $data['language'] ?? null;
        $rootBoardId = $data['root_board_id'] ?? null;
        $isPublic = isset($data['is_public']) ? (int)$data['is_public'] : 0;
        
        if (empty($displayName)) {
            return errorResponse('Profile name is required', 400);
        }
        
        try {
            // If this is the first profile, make it default
            $stmt = $db->prepare("SELECT COUNT(*) as count FROM profiles WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $isFirst = $stmt->fetch()['count'] == 0;
            $isDefault = $isFirst ? 1 : 0;
            
            $stmt = $db->prepare("
                INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, root_board_id, is_default, is_public, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmt->execute([
                $user['id'],
                $displayName,
                $displayName, // Also set name field for compatibility
                $description,
                $layoutType,
                $language,
                $rootBoardId,
                $isDefault,
                $isPublic
            ]);
            
            $profileId = $db->lastInsertId();
            
            // Fetch created profile
            $stmt = $db->prepare("SELECT * FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();
            
            return successResponse($profile, 201);
            
        } catch (Exception $e) {
            error_log("Create profile error: " . $e->getMessage());
            return errorResponse('Failed to create profile', 500);
        }
    }
    
    // PUT /profiles/{id} (update)
    if ($method === 'PUT' && count($pathParts) === 2) {
        $profileId = $pathParts[1];
        
        try {
            // Verify ownership
            $stmt = $db->prepare("SELECT user_id FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found', 404);
            }
            
            if ($profile['user_id'] != $user['id']) {
                return errorResponse('Unauthorized', 403);
            }
            
            // Build update query
            $updates = [];
            $params = [];
            
            if (isset($data['display_name']) || isset($data['name'])) {
                $name = trim($data['display_name'] ?? $data['name'] ?? '');
                if (!empty($name)) {
                    $updates[] = "display_name = ?";
                    $updates[] = "name = ?";
                    $params[] = $name;
                    $params[] = $name;
                }
            }
            
            if (isset($data['description'])) {
                $updates[] = "description = ?";
                $params[] = trim($data['description']);
            }
            
            if (isset($data['layout_type'])) {
                $updates[] = "layout_type = ?";
                $params[] = $data['layout_type'];
            }
            
            if (isset($data['language'])) {
                $updates[] = "language = ?";
                $params[] = $data['language'];
            }
            
            if (isset($data['root_board_id'])) {
                $updates[] = "root_board_id = ?";
                $params[] = $data['root_board_id'];
            }
            
            if (isset($data['is_public'])) {
                $updates[] = "is_public = ?";
                $params[] = (int)$data['is_public'];
            }
            
            if (isset($data['is_default']) && $data['is_default']) {
                // If setting as default, unset other defaults first
                $stmt = $db->prepare("UPDATE profiles SET is_default = 0 WHERE user_id = ?");
                $stmt->execute([$user['id']]);
                
                $updates[] = "is_default = 1";
            }
            
            if (empty($updates)) {
                return errorResponse('No fields to update', 400);
            }
            
            $updates[] = "updated_at = NOW()";
            $params[] = $profileId;
            
            $sql = "UPDATE profiles SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            // Fetch updated profile
            $stmt = $db->prepare("SELECT * FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $updatedProfile = $stmt->fetch();
            
            return successResponse($updatedProfile);
            
        } catch (Exception $e) {
            error_log("Update profile error: " . $e->getMessage());
            return errorResponse('Failed to update profile', 500);
        }
    }
    
    // DELETE /profiles/{id}
    if ($method === 'DELETE' && count($pathParts) === 2) {
        $profileId = $pathParts[1];
        
        try {
            // Verify ownership
            $stmt = $db->prepare("SELECT user_id FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found', 404);
            }
            
            if ($profile['user_id'] != $user['id']) {
                return errorResponse('Unauthorized', 403);
            }
            
            $stmt = $db->prepare("DELETE FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            
            return successResponse(['success' => true, 'message' => 'Profile deleted successfully']);
            
        } catch (Exception $e) {
            error_log("Delete profile error: " . $e->getMessage());
            return errorResponse('Failed to delete profile', 500);
        }
    }
    
    return errorResponse('Profile route not found', 404);
}

