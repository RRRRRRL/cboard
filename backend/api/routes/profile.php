<?php
/**
 * Profile Routes Handler
 * Sprint 2: Profile CRUD operations
 * Sprint 3: Added layout templates support
 */

require_once __DIR__ . '/../helpers-layout.php';
require_once __DIR__ . '/../auth.php';

// Helper function to get public profiles (used by both /profiles/public and legacy /board endpoints)
function getPublicProfilesHelper($db, $language = null, $layoutType = null, $limit = 50, $offset = 0, $pagination = null) {
        // Use pagination if provided, otherwise use limit/offset
        if ($pagination) {
            $limit = $pagination['limit'];
            $offset = ($pagination['page'] - 1) * $limit;
        }
        
        // 返回所有公開的 profiles，包括系統預設模板 (user_id = 1) 和真實使用者的公開 profile
        // 預設 profiles 應該顯示在公共庫中供用戶使用
        // 只返回有 tiles 的 profiles（通過 JOIN profile_cards 過濾）
        $sql = "SELECT 
                    p.id, 
                    p.user_id, 
                    p.display_name, 
                    p.description, 
                    p.layout_type, 
                    p.language, 
                    p.is_public, 
                    p.created_at, 
                    p.updated_at,
                    COUNT(pc.id) as tiles_count,
                    (SELECT c.image_path FROM profile_cards pc2 
                     JOIN cards c ON pc2.card_id = c.id 
                     WHERE pc2.profile_id = p.id AND pc2.is_visible = 1 
                     ORDER BY pc2.page_index, pc2.row_index, pc2.col_index 
                     LIMIT 1) as cover_image
                FROM profiles p
                LEFT JOIN profile_cards pc ON p.id = pc.profile_id AND pc.is_visible = 1
                WHERE p.is_public = 1
                GROUP BY p.id
                HAVING tiles_count > 0";
        $params = [];
        
        if ($language) {
            $sql = str_replace('HAVING tiles_count > 0', 'AND p.language = ? HAVING tiles_count > 0', $sql);
            $params[] = $language;
        }
        
        if ($layoutType) {
            $sql = str_replace('HAVING tiles_count > 0', 'AND p.layout_type = ? HAVING tiles_count > 0', $sql);
            $params[] = $layoutType;
        }
        
        // Order by: user profiles (non-preset) first by updated_at DESC (most recently published first),
        // then preset profiles (user_id = 1) by created_at DESC
        // This ensures newly published user profiles appear at the top
        $sql .= " ORDER BY CASE WHEN p.user_id = 1 THEN 1 ELSE 0 END, 
                  CASE WHEN p.user_id = 1 THEN p.created_at ELSE p.updated_at END DESC 
                  LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $profiles = $stmt->fetchAll();
        
        // Debug: Log query results
        error_log("[GET PUBLIC PROFILES] Found " . count($profiles) . " public profiles with tiles");
        if (count($profiles) > 0) {
            error_log("[GET PUBLIC PROFILES] First profile: " . json_encode([
                'id' => $profiles[0]['id'] ?? 'N/A',
                'display_name' => $profiles[0]['display_name'] ?? 'N/A',
                'is_public' => $profiles[0]['is_public'] ?? 'N/A',
                'tiles_count' => $profiles[0]['tiles_count'] ?? 'N/A',
                'user_id' => $profiles[0]['user_id'] ?? 'N/A'
            ]));
            // Log all profile IDs for debugging
            $profileIds = array_map(function($p) { return $p['id']; }, $profiles);
            error_log("[GET PUBLIC PROFILES] All profile IDs: " . json_encode($profileIds));
        } else {
            error_log("[GET PUBLIC PROFILES] No public profiles found with tiles_count > 0");
            // Check if there are any public profiles at all (even without tiles)
            $checkStmt = $db->prepare("SELECT id, display_name, is_public, user_id FROM profiles WHERE is_public = 1 LIMIT 10");
            $checkStmt->execute();
            $allPublic = $checkStmt->fetchAll();
            error_log("[GET PUBLIC PROFILES] All public profiles (including empty): " . json_encode(array_map(function($p) {
                return ['id' => $p['id'], 'name' => $p['display_name'], 'is_public' => $p['is_public'], 'user_id' => $p['user_id']];
            }, $allPublic)));
            
            // Also check tiles count for each public profile
            foreach ($allPublic as $pubProfile) {
                $tilesCheckStmt = $db->prepare("SELECT COUNT(*) as count FROM profile_cards WHERE profile_id = ? AND is_visible = 1");
                $tilesCheckStmt->execute([$pubProfile['id']]);
                $tilesCheckResult = $tilesCheckStmt->fetch();
                error_log("[GET PUBLIC PROFILES] Profile {$pubProfile['id']} ({$pubProfile['display_name']}): tiles_count = " . ($tilesCheckResult['count'] ?? 0));
            }
        }
        
        // Get total count (only profiles with tiles)
        $countSql = "SELECT COUNT(DISTINCT p.id) as total 
                     FROM profiles p
                     INNER JOIN profile_cards pc ON p.id = pc.profile_id AND pc.is_visible = 1
                     WHERE p.is_public = 1";
        $countParams = [];
        if ($language) {
            $countSql .= " AND p.language = ?";
            $countParams[] = $language;
        }
        if ($layoutType) {
            $countSql .= " AND p.layout_type = ?";
            $countParams[] = $layoutType;
        }
        $stmt = $db->prepare($countSql);
        $stmt->execute($countParams);
        $total = $stmt->fetch()['total'];
        
        // Transform profiles to include tiles array with correct length for frontend compatibility
        foreach ($profiles as &$profile) {
            $tilesCount = (int)$profile['tiles_count'];
            // Create a virtual tiles array with correct length for frontend compatibility
            // Frontend uses board.tiles.length to display count
            $profile['tiles'] = array_fill(0, $tilesCount, null); // Array with correct length
            $profile['tiles_count'] = $tilesCount;
            $profile['caption'] = $profile['cover_image']; // For frontend compatibility
        }
        
        return [
            'profiles' => $profiles,
            'total' => (int)$total,
            'limit' => $limit,
            'offset' => $offset,
            'page' => $pagination ? $pagination['page'] : (int)($offset / $limit) + 1
        ];
}

function handleProfileRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    $pagination = getPaginationParams();
    
    // Legacy board list endpoints - now profile-centric
    // These are called from index.php when route is 'board' but path is a list endpoint
    // GET /board (public profiles)
    if ($method === 'GET' && isset($pathParts[0]) && $pathParts[0] === 'board' && count($pathParts) === 1) {
        try {
            $result = getPublicProfilesHelper($db, null, null, $pagination['limit'] ?? 50, (($pagination['page'] ?? 1) - 1) * ($pagination['limit'] ?? 50), $pagination);
            return successResponse($result);
        } catch (Exception $e) {
            error_log("Get public profiles via /board error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Failed to fetch public profiles: ' . $e->getMessage(), 500);
        }
    }
    
    // GET /board/public (public profiles)
    if ($method === 'GET' && isset($pathParts[0]) && $pathParts[0] === 'board' && count($pathParts) === 2 && $pathParts[1] === 'public') {
        try {
            $result = getPublicProfilesHelper($db, null, null, $pagination['limit'] ?? 50, (($pagination['page'] ?? 1) - 1) * ($pagination['limit'] ?? 50), $pagination);
            return successResponse($result);
        } catch (Exception $e) {
            error_log("Get public profiles via /board/public error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Failed to fetch public profiles: ' . $e->getMessage(), 500);
        }
    }
    
    // GET /board/my (user's profiles)
    if ($method === 'GET' && isset($pathParts[0]) && $pathParts[0] === 'board' && count($pathParts) === 2 && $pathParts[1] === 'my') {
        $user = requireAuth($authToken);
        try {
            $limit = $pagination['limit'] ?? 50;
            $offset = (($pagination['page'] ?? 1) - 1) * $limit;
            
            // Get profiles with tiles count and cover image
            $stmt = $db->prepare("
                SELECT 
                    p.id, 
                    p.user_id, 
                    p.display_name, 
                    p.description, 
                    p.layout_type, 
                    p.language, 
                    p.is_public, 
                    p.created_at, 
                    p.updated_at,
                    COUNT(pc.id) as tiles_count,
                    (SELECT c.image_path FROM profile_cards pc2 
                     JOIN cards c ON pc2.card_id = c.id 
                     WHERE pc2.profile_id = p.id AND pc2.is_visible = 1 
                     ORDER BY pc2.page_index, pc2.row_index, pc2.col_index 
                     LIMIT 1) as cover_image,
                    (SELECT u.name FROM users u WHERE u.id = p.user_id) as author_name
                FROM profiles p
                LEFT JOIN profile_cards pc ON p.id = pc.profile_id AND pc.is_visible = 1
                WHERE p.user_id = ?
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?
            ");
            $stmt->execute([$user['id'], $limit, $offset]);
            $profiles = $stmt->fetchAll();
            
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM profiles WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $total = $stmt->fetch()['total'] ?? 0;
            
            // Transform profiles to include tiles array with correct length for frontend compatibility
            foreach ($profiles as &$profile) {
                $tilesCount = (int)$profile['tiles_count'];
                // Create a virtual tiles array with correct length for frontend compatibility
                // Frontend uses board.tiles.length to display count
                $profile['tiles'] = array_fill(0, $tilesCount, null); // Array with correct length
                $profile['tiles_count'] = $tilesCount;
                $profile['caption'] = $profile['cover_image']; // For frontend compatibility
                $profile['author'] = $profile['author_name']; // Author name
                $profile['locale'] = $profile['language']; // For frontend compatibility
            }
            
            return successResponse([
                'profiles' => $profiles,
                'total' => (int)$total,
                'page' => $pagination['page'] ?? 1,
                'limit' => $limit
            ]);
        } catch (Exception $e) {
            error_log("Get user profiles via /board/my error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Failed to fetch user profiles: ' . $e->getMessage(), 500);
        }
    }
    
    // GET /profiles/templates (get available layout templates) - No auth required
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'templates') {
        return successResponse(['templates' => getAvailableLayouts()]);
    }
    
    // GET /profiles/public (get public user profiles) - No auth required
    if ($method === 'GET' && count($pathParts) >= 2 && $pathParts[1] === 'public') {
        try {
            $language = $_GET['language'] ?? null;
            $layoutType = $_GET['layout_type'] ?? null;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
            
            $result = getPublicProfilesHelper($db, $language, $layoutType, $limit, $offset);
            
            return successResponse($result);
            
        } catch (Exception $e) {
            error_log("Get public profiles error: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
            return errorResponse('Failed to fetch public profiles: ' . $e->getMessage(), 500);
        }
    }
    
    // All other endpoints require authentication
    $user = requireAuth($authToken);
    $pagination = getPaginationParams();

    /**
     * Profile-centric board access
     * GET /profiles/{id}/board  - 取得此 profile 的主板 (root_board) 完整資料
     * PUT /profiles/{id}/board  - 更新此 profile 的主板 (root_board) board_data 等
     * 內部暫時仍然使用 boards 表，之後可以完全移除 board.php。
     */

    // GET /profiles/{id}/board
    // NEW: Build board data from profile_cards + cards (no boards table dependency)
    if ($method === 'GET' && count($pathParts) === 3 && $pathParts[2] === 'board') {
        $profileId = $pathParts[1];

        try {
            error_log("[PROFILE GET BOARD] Request received: " . json_encode([
                'profile_id' => $profileId,
                'requesting_user_id' => $user['id'] ?? 'N/A',
                'requesting_user_email' => $user['email'] ?? 'N/A'
            ]));
            
            // Get profile info
            $stmt = $db->prepare("
                SELECT id, user_id, display_name, description, layout_type, language, is_public, created_at, updated_at
                FROM profiles
                WHERE id = ?
            ");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();

            if (!$profile) {
                error_log("[PROFILE GET BOARD] Profile not found: {$profileId}");
                return errorResponse('Profile not found', 404);
            }

            error_log("[PROFILE GET BOARD] Profile found in database: " . json_encode([
                'profile_id' => $profile['id'],
                'user_id' => $profile['user_id'],
                'display_name' => $profile['display_name'],
                'is_public' => $profile['is_public'],
                'layout_type' => $profile['layout_type'],
                'language' => $profile['language']
            ]));

            if ($profile['user_id'] != $user['id'] && !$profile['is_public']) {
                error_log("[PROFILE GET BOARD] Unauthorized access attempt: " . json_encode([
                    'profile_user_id' => $profile['user_id'],
                    'requesting_user_id' => $user['id'],
                    'is_public' => $profile['is_public']
                ]));
                return errorResponse('Unauthorized', 403);
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
            $profileCards = $stmt->fetchAll();
            
            error_log("[PROFILE GET BOARD] Retrieved profile_cards: " . json_encode([
                'profile_id' => $profileId,
                'profile_cards_count' => count($profileCards),
                'first_3_cards' => array_slice($profileCards, 0, 3),
                'query_success' => $profileCards !== false
            ]));

            // Build tiles array (compatible with Cboard format)
            $tiles = [];
            
            // If no profile_cards found, return empty tiles array (not null)
            if (empty($profileCards)) {
                error_log("[PROFILE GET BOARD] No profile_cards found for profile {$profileId}, returning empty tiles array");
            }
            
            foreach ($profileCards as $pc) {
                // Validate that we have essential data
                if (empty($pc['card_id'])) {
                    error_log("[PROFILE GET BOARD] Skipping invalid profile_card: missing card_id");
                    continue;
                }
                // Check if label_text contains JSON metadata (for loadBoard)
                $rawLabelText = $pc['label_text'] ?: $pc['title'];
                $loadBoard = null;
                $actualLabel = $rawLabelText;
                $labelKey = null;
                
                // Try to parse label_text as JSON to extract loadBoard
                if ($pc['label_text'] && $pc['label_text'][0] === '{') {
                    $metadata = json_decode($pc['label_text'], true);
                    if ($metadata && isset($metadata['loadBoard']) && $metadata['loadBoard'] !== '') {
                        $loadBoard = $metadata['loadBoard'];
                        // Use title as the actual label if available
                        $actualLabel = $pc['title'] ?: $rawLabelText;
                    }
                } else {
                    // 如果 label_text 看起來像 cboard 的國際化 key，就當作 labelKey，
                    // 把真正文字交給前端根據語言包來解析。
                    if (preg_match('/^(cboard\.symbol\.|symbol\.)/i', (string)$rawLabelText)) {
                        $labelKey = $rawLabelText;
                        $actualLabel = '';
                    }
                }

                // 如果是資料裡的 title 長得像 key（部分遷移腳本會把 key 放到 title）
                if (!$labelKey && $pc['title'] && preg_match('/^(cboard\.symbol\.|symbol\.)/i', (string)$pc['title'])) {
                    $labelKey = $pc['title'];
                    // 只有在還沒有真正文字時才清空，避免覆蓋自訂文字
                    if ($actualLabel === $pc['title']) {
                        $actualLabel = '';
                    }
                }

                // 處理文字顏色 / 背景色；同時提供 snake_case + camelCase，方便前端使用
                $textColor = $pc['text_color'];
                // 處理背景色：如果沒存任何背景色，就給預設色
                $backgroundColor = $pc['background_color'];
                $folderBlue = 'rgb(187, 222, 251)';
                $cardYellow = 'rgb(255, 241, 118)';
                if (!$backgroundColor) {
                    // 有 loadBoard = folder → 預設藍色（和原版 Cboard 接近）
                    if ($loadBoard !== null) {
                        $backgroundColor = $folderBlue; // folder blue
                    } else {
                        // 普通卡片 → 預設黃色
                        $backgroundColor = $cardYellow; // card yellow
                    }
                } else {
                    // 舊資料裡把普通卡片也存成 folder 藍色的情況：如果不是資料夾（沒有 loadBoard），就糾正回黃底
                    if ($loadBoard === null && $backgroundColor === $folderBlue) {
                        $backgroundColor = $cardYellow;
                    }
                }
                
                $tile = [
                    'id' => 'card_' . $pc['card_id'],
                    'label' => $actualLabel,
                    'labelKey' => $labelKey,
                    'image' => $pc['image_path'] ?: $pc['image_url'],
                    'image_url' => $pc['image_path'] ?: $pc['image_url'],
                    'sound' => $pc['audio_path'] ?: $pc['sound_url'],
                    'sound_url' => $pc['audio_path'] ?: $pc['sound_url'],
                    // 同時輸出 snake_case + camelCase，確保前端舊邏輯都能吃到
                    'text_color' => $textColor,
                    'textColor' => $textColor,
                    'background_color' => $backgroundColor,
                    'backgroundColor' => $backgroundColor,
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
                
                // Add loadBoard if this is a folder tile
                if ($loadBoard !== null) {
                    $tile['loadBoard'] = $loadBoard;
                }
                
                $tiles[] = $tile;
            }

            // Extract grid dimensions from layout_type
            $rows = 4;
            $columns = 6;
            if ($profile['layout_type'] && preg_match('/(\d+)x(\d+)/', $profile['layout_type'], $matches)) {
                $rows = (int)$matches[1];
                $columns = (int)$matches[2];
            }

            error_log("[PROFILE GET BOARD] Building tiles array: " . json_encode([
                'profile_id' => $profileId,
                'tiles_count' => count($tiles),
                'grid_rows' => $rows,
                'grid_columns' => $columns,
                'first_3_tiles' => array_slice($tiles, 0, 3)
            ]));

            // Build grid.order 根據 row/col 還原原始順序
            // Handle overlapping positions by using the first tile found at each position
            $order = [];
            $positionUsed = []; // Track which positions are already used
            for ($r = 0; $r < $rows; $r++) {
                $order[$r] = array_fill(0, $columns, null);
            }
            
            foreach ($tiles as $tile) {
                $r = isset($tile['row']) ? (int)$tile['row'] : (isset($tile['row_index']) ? (int)$tile['row_index'] : 0);
                $c = isset($tile['col']) ? (int)$tile['col'] : (isset($tile['col_index']) ? (int)$tile['col_index'] : 0);
                
                // Validate position bounds
                if ($r >= 0 && $r < $rows && $c >= 0 && $c < $columns) {
                    $posKey = "{$r}_{$c}";
                    // If position already used, find next available position
                    if (isset($positionUsed[$posKey])) {
                        // Find next available position in the same row
                        $found = false;
                        for ($tryC = $c + 1; $tryC < $columns; $tryC++) {
                            $tryPosKey = "{$r}_{$tryC}";
                            if (!isset($positionUsed[$tryPosKey])) {
                                $c = $tryC;
                                $posKey = $tryPosKey;
                                $found = true;
                                break;
                            }
                        }
                        // If no space in current row, try next row
                        if (!$found) {
                            for ($tryR = $r + 1; $tryR < $rows; $tryR++) {
                                for ($tryC = 0; $tryC < $columns; $tryC++) {
                                    $tryPosKey = "{$tryR}_{$tryC}";
                                    if (!isset($positionUsed[$tryPosKey])) {
                                        $r = $tryR;
                                        $c = $tryC;
                                        $posKey = $tryPosKey;
                                        $found = true;
                                        break 2;
                                    }
                                }
                            }
                        }
                    }
                    
                    if (!isset($positionUsed[$posKey])) {
                        $order[$r][$c] = $tile['id'];
                        $positionUsed[$posKey] = true;
                    }
                }
            }
            
            error_log("[PROFILE GET BOARD] Grid order built: " . json_encode([
                'profile_id' => $profileId,
                'grid_rows' => $rows,
                'grid_columns' => $columns,
                'tiles_count' => count($tiles),
                'order_non_null_count' => array_reduce($order, function($carry, $row) {
                    return $carry + count(array_filter($row, function($val) { return $val !== null; }));
                }, 0)
            ]));

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
                    'rows' => $rows,
                    'columns' => $columns,
                    'order' => $order
                ],
                'language' => $profile['language'],
                'layout_type' => $profile['layout_type'],
                'createdAt' => $profile['created_at'],
                'updatedAt' => $profile['updated_at']
            ];
            
            error_log("[PROFILE GET BOARD] Returning board structure: " . json_encode([
                'profile_id' => $profileId,
                'board_id' => $board['id'],
                'board_name' => $board['name'],
                'tiles_count' => count($tiles),
                'grid_rows' => $rows,
                'grid_columns' => $columns,
                'user_id' => $profile['user_id'],
                'is_public' => $profile['is_public']
            ]));

            return successResponse($board);
        } catch (Exception $e) {
            error_log("[PROFILE GET BOARD] Error: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
            return errorResponse('Failed to fetch profile board', 500);
        }
    }

    // PUT /profiles/{id}/board
    // NEW: Save board data to profile_cards + cards (no boards table dependency)
    if ($method === 'PUT' && count($pathParts) === 3 && $pathParts[2] === 'board') {
        $profileId = $pathParts[1];
        // Ensure profileId is an integer for database query
        $profileId = (int)$profileId;
        
        // Increase execution time limit for board save operations (processing many tiles can take time)
        set_time_limit(120); // 2 minutes should be enough for even large boards

        error_log("[PROFILE SAVE BOARD] Route matched: " . json_encode([
            'method' => $method,
            'pathParts' => $pathParts,
            'pathParts_count' => count($pathParts),
            'pathParts[2]' => $pathParts[2] ?? 'N/A',
            'profileId_raw' => $pathParts[1] ?? 'N/A',
            'profileId_int' => $profileId,
            'requesting_user_id' => $user['id'] ?? 'N/A'
        ]));

        try {
            // Get profile and verify ownership
            $stmt = $db->prepare("
                SELECT id, user_id, display_name, description, layout_type, language, is_public
                FROM profiles
                WHERE id = ?
            ");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();

            if (!$profile) {
                error_log("[PROFILE SAVE BOARD] Profile not found in database: " . json_encode([
                    'profileId' => $profileId,
                    'profileId_type' => gettype($profileId),
                    'query_executed' => true
                ]));
                return errorResponse('Profile not found', 404);
            }

            if ($profile['user_id'] != $user['id']) {
                return errorResponse('Unauthorized', 403);
            }

            // Check tiles count in database
            $tilesCountStmt = $db->prepare("SELECT COUNT(*) as count FROM profile_cards WHERE profile_id = ? AND is_visible = 1");
            $tilesCountStmt->execute([$profileId]);
            $tilesCountResult = $tilesCountStmt->fetch();
            $currentTilesCount = (int)($tilesCountResult['count'] ?? 0);
            
            error_log("[PROFILE SAVE BOARD] Request received: " . json_encode([
                'profile_id' => $profileId,
                'requesting_user_id' => $user['id'] ?? 'N/A',
                'requesting_user_email' => $user['email'] ?? 'N/A',
                'profile_user_id' => $profile['user_id'] ?? 'N/A',
                'tiles_count_in_request' => is_array($data['tiles'] ?? null) ? count($data['tiles']) : 0,
                'tiles_count_in_db' => $currentTilesCount,
                'has_tiles' => !empty($data['tiles'] ?? null),
                'isPublic_in_request' => $data['isPublic'] ?? 'NOT_SET',
                'isPublic_type' => isset($data['isPublic']) ? gettype($data['isPublic']) : 'N/A',
                'current_is_public' => $profile['is_public'] ?? 'N/A',
                'will_be_public' => isset($data['isPublic']) ? (bool)$data['isPublic'] : (bool)$profile['is_public']
            ]));
            
            $db->beginTransaction();

            try {
                // Update profile metadata
                $displayName = trim($data['name'] ?? $profile['display_name'] ?? '');
                $description = trim($data['description'] ?? $profile['description'] ?? '');
                $isPublic = isset($data['isPublic']) ? (int)$data['isPublic'] : (int)$profile['is_public'];
                $layoutType = $data['layout_type'] ?? $data['layoutType'] ?? $profile['layout_type'];
                $language = $data['language'] ?? $profile['language'];

                error_log("[PROFILE SAVE BOARD] Profile metadata to update: " . json_encode([
                    'profile_id' => $profileId,
                    'display_name' => $displayName,
                    'description' => $description,
                    'is_public' => $isPublic,
                    'layout_type' => $layoutType,
                    'language' => $language
                ]));

                // Verify profile belongs to user before updating
                if ($profile['user_id'] != $user['id']) {
                    error_log("[PROFILE SAVE BOARD] Unauthorized: Profile user_id ({$profile['user_id']}) != requesting user_id ({$user['id']})");
                    $db->rollBack();
                    return errorResponse('Unauthorized: Profile does not belong to user', 403);
                }

                // Get profile before update to compare changes
                $stmt = $db->prepare("SELECT id, display_name, created_at, updated_at FROM profiles WHERE id = ?");
                $stmt->execute([$profileId]);
                $oldProfile = $stmt->fetch();
                
                // Update profiles table（只更新 metadata，不動 tiles）
                error_log("[PROFILE SAVE BOARD] Updating profile metadata for profile $profileId...");
                try {
                    // Double-check profile exists and belongs to user before update
                    $verifyStmt = $db->prepare("SELECT id, user_id FROM profiles WHERE id = ? AND user_id = ?");
                    $verifyStmt->execute([$profileId, $user['id']]);
                    $verifyProfile = $verifyStmt->fetch();
                    
                    if (!$verifyProfile) {
                        error_log("[PROFILE SAVE BOARD] Profile verification failed: profile $profileId does not exist or does not belong to user {$user['id']}");
                        $db->rollBack();
                        return errorResponse('Profile not found or unauthorized', 404);
                    }
                    
                    $stmt = $db->prepare("
                        UPDATE profiles
                        SET display_name = ?, description = ?, is_public = ?, layout_type = ?, language = ?, updated_at = NOW()
                        WHERE id = ? AND user_id = ?
                    ");
                    $stmt->execute([$displayName, $description, $isPublic, $layoutType, $language, $profileId, $user['id']]);
                    
                error_log("[PROFILE SAVE BOARD] Profile metadata update executed, rowCount: " . $stmt->rowCount());
                // Note: rowCount() may return 0 if values are unchanged, but that's OK
                // We already verified the profile exists and belongs to the user
                
                // Verify the update was successful by querying the profile again
                $verifyStmt = $db->prepare("SELECT id, is_public, display_name FROM profiles WHERE id = ?");
                $verifyStmt->execute([$profileId]);
                $verifiedProfile = $verifyStmt->fetch();
                // Check tiles count after update
                $tilesCountAfterStmt = $db->prepare("SELECT COUNT(*) as count FROM profile_cards WHERE profile_id = ? AND is_visible = 1");
                $tilesCountAfterStmt->execute([$profileId]);
                $tilesCountAfterResult = $tilesCountAfterStmt->fetch();
                $tilesCountAfter = (int)($tilesCountAfterResult['count'] ?? 0);
                
                error_log("[PROFILE SAVE BOARD] Profile metadata updated successfully. Verified: " . json_encode([
                    'profile_id' => $verifiedProfile['id'] ?? 'N/A',
                    'is_public' => $verifiedProfile['is_public'] ?? 'N/A',
                    'display_name' => $verifiedProfile['display_name'] ?? 'N/A',
                    'tiles_count' => $tilesCountAfter,
                    'will_appear_in_public_list' => ($verifiedProfile['is_public'] ?? 0) == 1 && $tilesCountAfter > 0
                ]));
                } catch (PDOException $e) {
                    error_log("[PROFILE SAVE BOARD] PDO error updating profile metadata: " . $e->getMessage());
                    error_log("[PROFILE SAVE BOARD] PDO error code: " . $e->getCode());
                    error_log("[PROFILE SAVE BOARD] PDO error info: " . json_encode($e->errorInfo ?? []));
                    $db->rollBack();
                    throw $e;
                }
                
                // Log profile update to action_logs using actual database timestamps
                try {
                    require_once __DIR__ . '/action-log.php';
                    // Fetch updated profile to get actual updated_at
                    $stmt = $db->prepare("SELECT id, display_name, created_at, updated_at FROM profiles WHERE id = ?");
                    $stmt->execute([$profileId]);
                    $updatedProfileMeta = $stmt->fetch();
                    
                    $metadata = json_encode([
                        'profile_name' => $updatedProfileMeta['display_name'] ?? $oldProfile['display_name'],
                        'created_at' => $oldProfile['created_at'] ?? null,
                        'updated_at' => $updatedProfileMeta['updated_at'] ?? null,
                        'changes' => []
                    ]);
                    insertActionLog($db, $user['id'], $profileId, null, 'profile_update', $metadata);
                } catch (Exception $e) {
                    // Log error but don't fail profile update
                    error_log("Failed to log profile update in PUT /profiles/{$profileId}/board: " . $e->getMessage());
                }

                // Process tiles from boardData
                // Check if tiles array is provided in request
                $hasTilesInRequest = isset($data['tiles']);
                $tiles = $data['tiles'] ?? [];
                // Log all request keys to debug what's being sent
                $requestKeys = array_keys($data);
                error_log("[PROFILE SAVE BOARD] Processing tiles for profile $profileId: " . json_encode([
                    'has_tiles_in_request' => $hasTilesInRequest,
                    'tiles_count' => count($tiles),
                    'tiles_is_array' => is_array($tiles),
                    'first_tile_sample' => isset($tiles[0]) ? array_keys($tiles[0]) : 'N/A',
                    'is_metadata_only_update' => !$hasTilesInRequest,
                    'request_keys' => $requestKeys,
                    'has_isPublic' => isset($data['isPublic']),
                    'isPublic_value' => $data['isPublic'] ?? 'NOT_SET',
                    'has_grid' => isset($data['grid']),
                    'has_grid_order' => isset($data['grid']['order'])
                ]));
                
                // Only filter tiles if they were provided in the request
                // If tiles were not provided, this is a metadata-only update - preserve existing tiles
                if ($hasTilesInRequest) {
                    // Filter out null/undefined tiles to prevent corruption
                    $tiles = array_filter($tiles, function($tile) {
                        return $tile !== null && is_array($tile);
                    });
                }
                
                // 從 grid.order 建立一個 tileId -> (row, col) 的映射，用來還原卡片順序
                $positionMap = [];
                if (isset($data['grid']['order']) && is_array($data['grid']['order'])) {
                    foreach ($data['grid']['order'] as $r => $rowArr) {
                        if (!is_array($rowArr)) {
                            continue;
                        }
                        foreach ($rowArr as $c => $tileId) {
                            if ($tileId === null || $tileId === '') {
                                continue;
                            }
                            $positionMap[(string)$tileId] = [
                                'row' => (int)$r,
                                'col' => (int)$c
                            ];
                        }
                    }
                    error_log("[PROFILE SAVE BOARD] Position map from grid.order: " . json_encode([
                        'profile_id' => $profileId,
                        'position_map_count' => count($positionMap),
                        'first_3_positions' => array_slice($positionMap, 0, 3, true)
                    ]));
                } else {
                    error_log("[PROFILE SAVE BOARD] No grid.order provided, will use tile row/col or existing positions");
                }

                // 讀取當前 profile_cards 的位置，用於沒有提供新順序時保留原有 row/col/page
                $existingPositions = [];
                $stmt = $db->prepare("
                    SELECT pc.card_id, pc.row_index, pc.col_index, pc.page_index
                    FROM profile_cards pc
                    WHERE pc.profile_id = ?
                ");
                $stmt->execute([$profileId]);
                $rowsExisting = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rowsExisting as $rowPos) {
                    $tileIdKey = 'card_' . $rowPos['card_id'];
                    $existingPositions[$tileIdKey] = [
                        'row' => (int)$rowPos['row_index'],
                        'col' => (int)$rowPos['col_index'],
                        'page' => (int)$rowPos['page_index']
                    ];
                }

                // IMPORTANT: Only rebuild profile_cards if tiles array is provided AND not empty
                // If tiles is not provided (null/undefined), preserve existing cards - this is a metadata-only update
                // If tiles is empty array [], check if this is a metadata-only update or intentional clearing
                // This allows updating only metadata (title/description/is_public) without clearing cards
                if ($hasTilesInRequest && is_array($tiles)) {
                    // Check if this is a metadata-only update (no tiles in request means preserve existing)
                    // Only process tiles if the array is non-empty
                    if (empty($tiles)) {
                        // Empty tiles array: Check if this is intentional (user wants to clear) or metadata-only update
                        // If only metadata fields are being updated (isPublic, name, description), preserve tiles
                        $isMetadataOnlyUpdate = !isset($data['grid']) && !isset($data['grid']['order']);
                        if ($isMetadataOnlyUpdate) {
                            error_log("[PROFILE SAVE BOARD] Empty tiles array in metadata-only update, preserving existing profile_cards for profile {$profileId}");
                            // Do NOT delete profile_cards - this is just a metadata update
                        } else {
                            // Empty tiles array with grid data means user wants to clear all cards
                            error_log("[PROFILE SAVE BOARD] Empty tiles array provided with grid data, clearing all profile_cards for profile {$profileId}");
                            $stmt = $db->prepare("DELETE FROM profile_cards WHERE profile_id = ?");
                            $stmt->execute([$profileId]);
                            $deletedCount = $stmt->rowCount();
                            error_log("[PROFILE SAVE BOARD] Cleared all profile_cards: {$deletedCount} links removed");
                        }
                    } else {
                        // Non-empty tiles array - process each tile
                        error_log("[PROFILE SAVE BOARD] Processing tiles: " . json_encode([
                            'profile_id' => $profileId,
                            'tiles_count' => count($tiles),
                            'first_3_tiles' => array_slice($tiles, 0, 3)
                        ]));
                        
                        // Remove all existing profile_cards for this profile
                        $stmt = $db->prepare("DELETE FROM profile_cards WHERE profile_id = ?");
                        $stmt->execute([$profileId]);
                        $deletedCount = $stmt->rowCount();
                        error_log("[PROFILE SAVE BOARD] Deleted existing profile_cards: {$deletedCount} links removed");

                        $tileIndex = 0; // Counter for sequential position calculation
                        foreach ($tiles as $tile) {
                        if (!is_array($tile)) {
                            continue;
                        }

                        // Extract tile data
                        $title = $tile['label'] ?? $tile['title'] ?? $tile['labelKey'] ?? '';
                        $labelText = $tile['label'] ?? $tile['label_text'] ?? $tile['labelKey'] ?? '';
                        $imagePath = $tile['image'] ?? $tile['image_path'] ?? $tile['image_url'] ?? null;
                        $audioPath = $tile['sound'] ?? $tile['sound_url'] ?? $tile['audio_path'] ?? null;
                        // 同時支援 snake_case / camelCase
                        $textColor = $tile['text_color'] ?? $tile['textColor'] ?? null;
                        $backgroundColor = $tile['background_color'] ?? $tile['backgroundColor'] ?? null;
                        $category = $tile['category'] ?? 'general';
                        // 對於 loadBoard，空字串視為沒有子板，避免被當成資料夾
                        $loadBoard = (isset($tile['loadBoard']) && $tile['loadBoard'] !== '') ? $tile['loadBoard'] : null; // For folder tiles

                        // Get position：優先使用 grid.order 中的座標，其次用 tile 上的 row/col，最後用原本 profile_cards 的位置
                        $rowIndex = 0;
                        $colIndex = 0;
                        $pageIndex = 0;
                        $tileIdForPos = $tile['id'] ?? null;
                        $positionSource = 'default';
                        
                        // Normalize tile ID for matching (handle both "card_123" and "123" formats)
                        $tileIdNormalized = null;
                        $tileIdWithoutPrefix = null;
                        if ($tileIdForPos) {
                            $tileIdNormalized = (string)$tileIdForPos;
                            // Extract numeric ID if format is "card_123"
                            if (strpos($tileIdNormalized, 'card_') === 0) {
                                $tileIdWithoutPrefix = substr($tileIdNormalized, 5);
                            } else {
                                $tileIdWithoutPrefix = $tileIdNormalized;
                            }
                        }
                        
                        // Priority 1: Use position from grid.order if available
                        // Try both formats: "card_123" and "123"
                        if ($tileIdForPos) {
                            if (isset($positionMap[$tileIdNormalized])) {
                                $rowIndex = $positionMap[$tileIdNormalized]['row'];
                                $colIndex = $positionMap[$tileIdNormalized]['col'];
                                $positionSource = 'grid.order';
                            } elseif ($tileIdWithoutPrefix && isset($positionMap[$tileIdWithoutPrefix])) {
                                $rowIndex = $positionMap[$tileIdWithoutPrefix]['row'];
                                $colIndex = $positionMap[$tileIdWithoutPrefix]['col'];
                                $positionSource = 'grid.order';
                            }
                        }
                        
                        // Priority 2: Use row/col from tile object (prefer row/col over row_index/col_index)
                        if ($positionSource === 'default' && (isset($tile['row']) || isset($tile['row_index']))) {
                            $rowIndex = isset($tile['row']) ? (int)$tile['row'] : (int)$tile['row_index'];
                            $colIndex = isset($tile['col']) ? (int)$tile['col'] : (isset($tile['col_index']) ? (int)$tile['col_index'] : 0);
                            $positionSource = 'tile.row/col';
                        }
                        
                        // Priority 3: Use existing position from database (only if tile ID matches)
                        // Try both formats: "card_123" and "123"
                        if ($positionSource === 'default' && $tileIdForPos) {
                            if (isset($existingPositions[$tileIdNormalized])) {
                                $rowIndex = $existingPositions[$tileIdNormalized]['row'];
                                $colIndex = $existingPositions[$tileIdNormalized]['col'];
                                $positionSource = 'existing_position';
                            } elseif ($tileIdWithoutPrefix && isset($existingPositions['card_' . $tileIdWithoutPrefix])) {
                                $rowIndex = $existingPositions['card_' . $tileIdWithoutPrefix]['row'];
                                $colIndex = $existingPositions['card_' . $tileIdWithoutPrefix]['col'];
                                $positionSource = 'existing_position';
                            }
                        }
                        
                        // Priority 4: Calculate sequential position if all else fails (prevent all tiles at 0,0)
                        if ($positionSource === 'default') {
                            // Calculate position based on tile index in array
                            // This prevents all tiles from being stored at (0,0)
                            // Assume 4x6 grid if layout_type not available
                            $maxCols = 6;
                            if (isset($layoutType) && preg_match('/(\d+)x(\d+)/', $layoutType, $matches)) {
                                $maxCols = (int)$matches[2];
                            }
                            $rowIndex = intdiv($tileIndex, $maxCols);
                            $colIndex = $tileIndex % $maxCols;
                            $positionSource = 'calculated_sequential';
                        }
                        
                        // Validate position bounds (prevent invalid positions)
                        $maxRows = 4;
                        $maxCols = 6;
                        if (isset($layoutType) && preg_match('/(\d+)x(\d+)/', $layoutType, $matches)) {
                            $maxRows = (int)$matches[1];
                            $maxCols = (int)$matches[2];
                        }
                        if ($rowIndex < 0 || $rowIndex >= $maxRows) {
                            error_log("[PROFILE SAVE BOARD] Invalid row_index {$rowIndex}, clamping to valid range");
                            $rowIndex = max(0, min($rowIndex, $maxRows - 1));
                        }
                        if ($colIndex < 0 || $colIndex >= $maxCols) {
                            error_log("[PROFILE SAVE BOARD] Invalid col_index {$colIndex}, clamping to valid range");
                            $colIndex = max(0, min($colIndex, $maxCols - 1));
                        }

                        // Get page index
                        if (isset($tile['page'])) {
                            $pageIndex = (int)$tile['page'];
                        } elseif (isset($tile['page_index'])) {
                            $pageIndex = (int)$tile['page_index'];
                        } elseif ($tileIdForPos && isset($existingPositions[(string)$tileIdForPos])) {
                            // If no page provided, use existing page_index
                            $pageIndex = $existingPositions[(string)$tileIdForPos]['page'];
                        }
                        
                        $isVisible = isset($tile['hidden']) ? !$tile['hidden'] : (isset($tile['is_visible']) ? (bool)$tile['is_visible'] : true);

                        // Skip if no title/label and no loadBoard (folder tiles need loadBoard)
                        // BUT: Allow tiles with just image (for image-only cards like yes/no)
                        // NOTE: Don't increment tileIndex here - we only increment after successful processing
                        if (empty($title) && empty($labelText) && empty($loadBoard) && empty($imagePath)) {
                            error_log("[PROFILE SAVE BOARD] Skipping tile with no title/label/loadBoard/image at index {$tileIndex}");
                            continue;
                        }
                        
                        // For tiles with only image (like yes/no cards), use image filename as title
                        if (empty($title) && empty($labelText) && $imagePath) {
                            // Extract filename from image path as fallback title
                            $imageFilename = basename($imagePath);
                            $title = pathinfo($imageFilename, PATHINFO_FILENAME);
                            $labelText = $title;
                            error_log("[PROFILE SAVE BOARD] Using image filename as title for tile at index {$tileIndex}: {$title}");
                        }
                        
                        // Log position assignment for debugging (first 5 tiles only)
                        if ($tileIndex < 5) {
                            error_log("[PROFILE SAVE BOARD] Tile position assigned: " . json_encode([
                                'tile_index' => $tileIndex,
                                'tile_id' => $tileIdForPos,
                                'title' => substr($title, 0, 30),
                                'row' => $rowIndex,
                                'col' => $colIndex,
                                'page' => $pageIndex,
                                'source' => $positionSource
                            ]));
                        }
                        
                        // For folder tiles with loadBoard, store loadBoard in label_text as JSON
                        if ($loadBoard !== null) {
                            // Store loadBoard metadata in label_text as JSON
                            $labelText = json_encode(['loadBoard' => $loadBoard]);
                            // Truncate if too long (VARCHAR(191) limit)
                            if (strlen($labelText) > 191) {
                                // If JSON is too long, truncate the loadBoard value itself
                                $loadBoardStr = (string)$loadBoard;
                                $maxLoadBoardLength = 191 - strlen('{"loadBoard":""}');
                                if (strlen($loadBoardStr) > $maxLoadBoardLength) {
                                    $loadBoardStr = substr($loadBoardStr, 0, $maxLoadBoardLength);
                                }
                                $labelText = json_encode(['loadBoard' => $loadBoardStr]);
                                error_log("Warning: loadBoard truncated for profile $profileId, original: " . (string)$loadBoard);
                            }
                            // Use title as the display label if available
                            if (empty($title)) {
                                $title = $tile['label'] ?? $tile['labelKey'] ?? '';
                            }
                        }

                        // Create or find card
                        $cardId = null;

                        // Try to find existing card by image_path AND label_text to ensure uniqueness
                        // This prevents sharing cards with different labels
                        if ($imagePath && $labelText) {
                            $stmt = $db->prepare("
                                SELECT id FROM cards 
                                WHERE image_path = ? AND label_text = ? 
                                LIMIT 1
                            ");
                            $stmt->execute([$imagePath, $labelText]);
                            $existingCard = $stmt->fetch(PDO::FETCH_ASSOC);
                            if ($existingCard) {
                                $cardId = $existingCard['id'];
                            }
                        } elseif ($imagePath) {
                            // Fallback: find by image_path only if no label_text
                            $stmt = $db->prepare("SELECT id FROM cards WHERE image_path = ? LIMIT 1");
                            $stmt->execute([$imagePath]);
                            $existingCard = $stmt->fetch(PDO::FETCH_ASSOC);
                            if ($existingCard) {
                                $cardId = $existingCard['id'];
                            }
                        }

                        // Create new card if not found
                        if (!$cardId) {
                            // Ensure title is not empty (cards.title is NOT NULL)
                            // Use image filename if available, otherwise use title/labelText
                            $cardTitle = trim($title ?: $labelText ?: '');
                            if (empty($cardTitle) && $imagePath) {
                                $imageFilename = basename($imagePath);
                                $cardTitle = pathinfo($imageFilename, PATHINFO_FILENAME);
                            }
                            if (empty($cardTitle)) {
                                $cardTitle = 'Untitled';
                            }
                            
                            // Truncate label_text if too long (VARCHAR(191) limit)
                            $cardLabelText = $labelText;
                            if (strlen($cardLabelText) > 191) {
                                $cardLabelText = substr($cardLabelText, 0, 188) . '...';
                                error_log("Warning: label_text truncated for profile $profileId, card title: $cardTitle");
                            }
                            
                            // Insert into cards table
                            try {
                                error_log("[PROFILE SAVE BOARD] Creating new card: " . json_encode([
                                    'profile_id' => $profileId,
                                    'title' => $cardTitle,
                                    'label_text' => substr($cardLabelText, 0, 50),
                                    'image_path' => $imagePath,
                                    'position' => "row={$rowIndex}, col={$colIndex}, page={$pageIndex}"
                                ]));
                                
                                $stmt = $db->prepare("
                                    INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                                ");
                                $stmt->execute([
                                    $cardTitle,
                                    $cardLabelText,
                                    $imagePath,
                                    $audioPath,
                                    $textColor,
                                    $backgroundColor,
                                    $category
                                ]);
                                $cardId = $db->lastInsertId();
                                
                                if (!$cardId) {
                                    error_log("[PROFILE SAVE BOARD] Failed to create card for profile $profileId: " . json_encode([
                                        'title' => $cardTitle,
                                        'label_text' => substr($cardLabelText, 0, 100),
                                        'image_path' => $imagePath
                                    ]));
                                    // Don't increment tileIndex on card creation failure
                                    // This ensures sequential positions remain accurate
                                    continue; // Skip this tile if card creation failed
                                }
                                
                                // Fetch created card to get actual created_at from database
                                $stmt = $db->prepare("SELECT * FROM cards WHERE id = ?");
                                $stmt->execute([$cardId]);
                                $createdCard = $stmt->fetch();
                                
                                // Log card creation to action_logs using actual database timestamps
                                try {
                                    require_once __DIR__ . '/action-log.php';
                                    $metadata = json_encode([
                                        'card_title' => $cardTitle,
                                        'label_text' => $cardLabelText,
                                        'category' => $category,
                                        'created_at' => $createdCard['created_at'] ?? date('Y-m-d H:i:s'),
                                        'updated_at' => $createdCard['updated_at'] ?? null
                                    ]);
                                    insertActionLog($db, $user['id'], null, $cardId, 'card_create', $metadata);
                                } catch (Exception $e) {
                                    // Log error but don't fail card creation
                                    error_log("Failed to log card creation in PUT /profiles/{$profileId}/board: " . $e->getMessage());
                                }
                                
                                error_log("[PROFILE SAVE BOARD] Card created in database: " . json_encode([
                                    'card_id' => $cardId,
                                    'title' => $cardTitle,
                                    'table' => 'cards'
                                ]));
                            } catch (PDOException $e) {
                                error_log("[PROFILE SAVE BOARD] PDO error creating card for profile $profileId: " . $e->getMessage());
                                error_log("[PROFILE SAVE BOARD] Card data: " . json_encode([
                                    'title' => $cardTitle,
                                    'label_text_length' => strlen($cardLabelText),
                                    'image_path' => $imagePath
                                ]));
                                continue; // Skip this tile if card creation failed
                            }
                        }

                        // Create profile_card link (insert into profile_cards table)
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
                        
                        if ($stmt->rowCount() === 0) {
                            error_log("[PROFILE SAVE BOARD] Failed to create profile_card link for profile $profileId, card $cardId");
                            // Continue processing other tiles even if one fails
                            // Don't increment tileIndex on failure to maintain accurate sequential positions
                        } else {
                            error_log("[PROFILE SAVE BOARD] Profile-card link created: " . json_encode([
                                'profile_id' => $profileId,
                                'card_id' => $cardId,
                                'position' => "row={$rowIndex}, col={$colIndex}, page={$pageIndex}",
                                'table' => 'profile_cards',
                                'tile_index' => $tileIndex
                            ]));
                            $tileIndex++; // Increment counter ONLY after successful tile processing
                        }
                        } // End of foreach loop
                    } // End of else block (non-empty tiles array)
                } else {
                    // Tiles not provided - preserve existing cards, only update metadata
                    error_log("[PROFILE SAVE BOARD] Tiles not provided, preserving existing profile_cards for profile {$profileId}");
                } // End of if (isset($data['tiles']) && is_array($tiles))

                error_log("[PROFILE SAVE BOARD] Committing transaction for profile $profileId...");
                $db->commit();
                error_log("[PROFILE SAVE BOARD] Transaction committed successfully for profile $profileId");
                
                // Log profile update AFTER transaction commit to ensure it's saved even if transaction fails
                // Note: profile_update log was already added before commit, but we ensure it's there
                // The card_create logs are inside the transaction, which is fine since they're part of the same operation

                // Return updated board structure (same as GET)
                error_log("[PROFILE SAVE BOARD] Fetching updated profile for response...");
                $stmt = $db->prepare("
                    SELECT id, user_id, display_name, description, layout_type, language, is_public, created_at, updated_at
                    FROM profiles
                    WHERE id = ?
                ");
                $stmt->execute([$profileId]);
                $updatedProfile = $stmt->fetch();
                
                if (!$updatedProfile) {
                    error_log("PUT /profiles/{$profileId}/board - Profile not found after commit");
                    return errorResponse('Profile not found after update', 404);
                }

                // Extract grid dimensions
                $rows = 4;
                $columns = 6;
                if ($layoutType && preg_match('/(\d+)x(\d+)/', $layoutType, $matches)) {
                    $rows = (int)$matches[1];
                    $columns = (int)$matches[2];
                }

                $board = [
                    'id' => (string)$profileId,
                    'name' => $updatedProfile['display_name'] ?: '',
                    'description' => $updatedProfile['description'] ?: '',
                    'isPublic' => (bool)$updatedProfile['is_public'],
                    'isFixed' => false,
                    'profileId' => (int)$profileId,
                    'grid' => [
                        'rows' => $rows,
                        'columns' => $columns,
                        'order' => [] // Will be populated from tiles
                    ],
                    'language' => $updatedProfile['language'] ?: 'en',
                    'layout_type' => $updatedProfile['layout_type'] ?: '4x6',
                    'createdAt' => $updatedProfile['created_at'] ?: date('Y-m-d H:i:s'),
                    'updatedAt' => $updatedProfile['updated_at'] ?: date('Y-m-d H:i:s'),
                    'tiles' => [] // Will be populated below
                ];

                // Get tiles for response
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
                $profileCards = $stmt->fetchAll();

                $tiles = [];
                $gridOrder = [];
                
                // Initialize grid order array
                for ($r = 0; $r < $rows; $r++) {
                    $gridOrder[$r] = [];
                    for ($c = 0; $c < $columns; $c++) {
                        $gridOrder[$r][$c] = null;
                    }
                }
                
                foreach ($profileCards as $pc) {
                    // Validate essential data
                    if (empty($pc['card_id'])) {
                        error_log("[PROFILE SAVE BOARD] Skipping invalid profile_card in response: missing card_id");
                        continue;
                    }
                    
                    // Check if label_text contains JSON metadata (for loadBoard)
                    $labelText = $pc['label_text'] ?: $pc['title'] ?: '';
                    $loadBoard = null;
                    $actualLabel = $labelText;
                    
                    // Try to parse label_text as JSON to extract loadBoard
                    if ($pc['label_text'] && $pc['label_text'][0] === '{') {
                        $metadata = json_decode($pc['label_text'], true);
                        if ($metadata && isset($metadata['loadBoard'])) {
                            $loadBoard = $metadata['loadBoard'];
                            // Use title as the actual label if available
                            $actualLabel = $pc['title'] ?: $labelText;
                        }
                    }
                    
                    $tileId = 'card_' . $pc['card_id'];
                    $rowIdx = (int)$pc['row_index'];
                    $colIdx = (int)$pc['col_index'];
                    
                    // Validate position bounds
                    if ($rowIdx < 0 || $rowIdx >= $rows) {
                        error_log("[PROFILE SAVE BOARD] Invalid row_index {$rowIdx} for card {$pc['card_id']}, clamping to valid range");
                        $rowIdx = max(0, min($rowIdx, $rows - 1));
                    }
                    if ($colIdx < 0 || $colIdx >= $columns) {
                        error_log("[PROFILE SAVE BOARD] Invalid col_index {$colIdx} for card {$pc['card_id']}, clamping to valid range");
                        $colIdx = max(0, min($colIdx, $columns - 1));
                    }
                    
                    // Update grid order
                    if (isset($gridOrder[$rowIdx][$colIdx])) {
                        $gridOrder[$rowIdx][$colIdx] = $tileId;
                    }
                    
                    $tile = [
                        'id' => $tileId,
                        'label' => $actualLabel ?: '',
                        'labelKey' => $actualLabel ?: '',
                        'image' => $pc['image_path'] ?: $pc['image_url'] ?: '',
                        'image_url' => $pc['image_path'] ?: $pc['image_url'] ?: '',
                        'sound' => $pc['audio_path'] ?: $pc['sound_url'] ?: '',
                        'sound_url' => $pc['audio_path'] ?: $pc['sound_url'] ?: '',
                        'text_color' => $pc['text_color'] ?: null,
                        'background_color' => $pc['background_color'] ?: null,
                        'category' => $pc['category'] ?: 'general',
                        'row' => $rowIdx,
                        'col' => $colIdx,
                        'page' => (int)$pc['page_index'],
                        'row_index' => $rowIdx,
                        'col_index' => $colIdx,
                        'page_index' => (int)$pc['page_index'],
                        'hidden' => !$pc['is_visible'],
                        'is_visible' => (bool)$pc['is_visible']
                    ];
                    
                    // Add loadBoard if this is a folder tile
                    if ($loadBoard !== null && $loadBoard !== '') {
                        $tile['loadBoard'] = $loadBoard;
                    }
                    
                    $tiles[] = $tile;
                }
                
                $board['tiles'] = $tiles;
                $board['grid']['order'] = $gridOrder;

                error_log("[PROFILE SAVE BOARD] Board structure prepared, returning response for profile $profileId");
                $response = successResponse($board);
                error_log("[PROFILE SAVE BOARD] Response prepared, status: " . ($response['status'] ?? 'N/A'));
                return $response;

            } catch (Exception $e) {
                $db->rollBack();
                error_log("Transaction error in update profile board: " . $e->getMessage());
                error_log("Stack trace: " . $e->getTraceAsString());
                error_log("Profile ID: " . ($profileId ?? 'N/A'));
                error_log("User ID: " . ($user['id'] ?? 'N/A'));
                error_log("Tiles count: " . (isset($data['tiles']) && is_array($data['tiles']) ? count($data['tiles']) : 'N/A'));
                throw $e;
            }

        } catch (Exception $e) {
            // Ensure transaction is rolled back
            try {
                if ($db->inTransaction()) {
                    $db->rollBack();
                    error_log("[PROFILE SAVE BOARD] Transaction rolled back due to error");
                }
            } catch (Exception $rollbackErr) {
                error_log("[PROFILE SAVE BOARD] Failed to rollback transaction: " . $rollbackErr->getMessage());
            }
            
            error_log("[PROFILE SAVE BOARD] Update profile board error: " . $e->getMessage());
            error_log("[PROFILE SAVE BOARD] Stack trace: " . $e->getTraceAsString());
            error_log("[PROFILE SAVE BOARD] Profile ID: " . ($profileId ?? 'N/A'));
            error_log("[PROFILE SAVE BOARD] User ID: " . ($user['id'] ?? 'N/A'));
            error_log("[PROFILE SAVE BOARD] Request data keys: " . (isset($data) ? implode(', ', array_keys($data)) : 'N/A'));
            error_log("[PROFILE SAVE BOARD] Tiles count: " . (isset($data['tiles']) && is_array($data['tiles']) ? count($data['tiles']) : 'N/A'));
            if (isset($data['tiles']) && is_array($data['tiles']) && count($data['tiles']) > 0) {
                error_log("[PROFILE SAVE BOARD] First tile sample: " . json_encode($data['tiles'][0]));
            }
            
            $errorResponse = errorResponse('Failed to update profile board: ' . $e->getMessage(), 500);
            error_log("[PROFILE SAVE BOARD] Returning error response: " . json_encode($errorResponse));
            return $errorResponse;
        }
    }

    // GET /profiles (list user's profiles with search)
    if ($method === 'GET' && count($pathParts) === 1) {
        try {
            $search = $pagination['search'];
            $offset = $pagination['offset'];
            $limit = $pagination['limit'];
            
            $sql = "SELECT id, display_name, description, layout_type, language, is_public, created_at, updated_at 
                    FROM profiles 
                    WHERE user_id = ?";
            $params = [$user['id']];
            
            if (!empty($search)) {
                $sql .= " AND (display_name LIKE ? OR description LIKE ?)";
                $searchTerm = "%$search%";
                $params[] = $searchTerm;
                $params[] = $searchTerm;
            }
            
            $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
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
                SELECT id, user_id, display_name, description, layout_type, language, is_public, created_at, updated_at
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
        $isPublic = isset($data['is_public']) ? (int)$data['is_public'] : 0;
        
        error_log("[PROFILE CREATE] Received data: " . json_encode([
            'display_name' => $displayName,
            'description' => $description,
            'layout_type' => $layoutType,
            'language' => $language,
            'is_public' => $isPublic,
            'user_id' => $user['id'] ?? 'N/A',
            'user_email' => $user['email'] ?? 'N/A'
        ]));
        
        if (empty($displayName)) {
            return errorResponse('Profile name is required', 400);
        }
        
        try {
            $stmt = $db->prepare("
                INSERT INTO profiles (user_id, display_name, description, layout_type, language, is_public, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmt->execute([
                $user['id'],
                $displayName,
                $description,
                $layoutType,
                $language,
                $isPublic
            ]);
            
            $profileId = $db->lastInsertId();
            
            error_log("[PROFILE CREATE] Profile created in database: " . json_encode([
                'profile_id' => $profileId,
                'user_id' => $user['id'],
                'display_name' => $displayName,
                'layout_type' => $layoutType,
                'language' => $language,
                'is_public' => $isPublic,
                'table' => 'profiles'
            ]));
            
            // Fetch created profile first to get actual created_at from database
            $stmt = $db->prepare("SELECT * FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();
            
            // Log profile creation to action_logs using actual database timestamps
            try {
                require_once __DIR__ . '/action-log.php';
                $metadata = json_encode([
                    'profile_name' => $displayName,
                    'layout_type' => $layoutType,
                    'language' => $language,
                    'is_public' => $isPublic,
                    'created_at' => $profile['created_at'] ?? date('Y-m-d H:i:s'),
                    'updated_at' => $profile['updated_at'] ?? null
                ]);
                insertActionLog($db, $user['id'], $profileId, null, 'profile_create', $metadata);
            } catch (Exception $e) {
                // Log error but don't fail profile creation
                error_log("Failed to log profile creation in POST /profiles: " . $e->getMessage());
            }
            
            error_log("[PROFILE CREATE] Profile retrieved from database: " . json_encode([
                'profile_id' => $profile['id'] ?? null,
                'user_id' => $profile['user_id'] ?? null,
                'display_name' => $profile['display_name'] ?? null
            ]));
            
            return successResponse($profile, 201);
            
        } catch (Exception $e) {
            error_log("[PROFILE CREATE] Error: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
            return errorResponse('Failed to create profile', 500);
        }
    }
    
    // POST /profiles/import-public/{id} - Import a public profile as a folder to user's root board
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[1] === 'import-public') {
        $sourceProfileId = (int)$pathParts[2];
        $targetRootBoardId = $data['rootBoardId'] ?? null; // Optional: target root board ID (profile ID)
        
        try {
            $db->beginTransaction();
            
            // Get source profile (must be public)
            $stmt = $db->prepare("SELECT * FROM profiles WHERE id = ? AND is_public = 1");
            $stmt->execute([$sourceProfileId]);
            $sourceProfile = $stmt->fetch();
            
            if (!$sourceProfile) {
                $db->rollBack();
                return errorResponse('Public profile not found', 404);
            }
            
            // Get source profile's cards (from profile_cards + cards)
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
            $stmt->execute([$sourceProfileId]);
            $sourceCards = $stmt->fetchAll();
            
            // Create a new profile for the imported board
            $newProfileDisplayName = ($sourceProfile['display_name'] ?? 'Imported Profile') . ' (Imported)';
            $stmt = $db->prepare("
                INSERT INTO profiles (user_id, display_name, description, layout_type, language, is_public, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())
            ");
            $stmt->execute([
                $user['id'],
                $newProfileDisplayName,
                $sourceProfile['description'] ?? '',
                $sourceProfile['layout_type'] ?? '4x6',
                $sourceProfile['language'] ?? 'en'
            ]);
            $newProfileId = $db->lastInsertId();
            
            // Copy cards and create profile_cards entries
            $importedCardsCount = 0;
            foreach ($sourceCards as $sourceCard) {
                // Create new card (copy of source card)
                $stmt = $db->prepare("
                    INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([
                    $sourceCard['title'],
                    $sourceCard['label_text'],
                    $sourceCard['image_path'],
                    $sourceCard['audio_path'],
                    $sourceCard['text_color'],
                    $sourceCard['background_color'],
                    $sourceCard['category']
                ]);
                $newCardId = $db->lastInsertId();
                
                // Link new card to new profile
                $stmt = $db->prepare("
                    INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([
                    $newProfileId,
                    $newCardId,
                    $sourceCard['row_index'],
                    $sourceCard['col_index'],
                    $sourceCard['page_index'],
                    $sourceCard['is_visible']
                ]);
                $importedCardsCount++;
            }
            
            // If targetRootBoardId is provided, add the imported profile as a folder tile to it
            $addedToRootBoard = false;
            if ($targetRootBoardId) {
                // Verify target root board is a valid profile owned by the user
                $stmt = $db->prepare("SELECT id, user_id FROM profiles WHERE id = ? AND user_id = ?");
                $stmt->execute([$targetRootBoardId, $user['id']]);
                $targetProfile = $stmt->fetch();
                
                if ($targetProfile) {
                    // Get target profile's cards to find an empty position
                    $stmt = $db->prepare("
                        SELECT MAX(row_index) as max_row, MAX(col_index) as max_col, MAX(page_index) as max_page
                        FROM profile_cards
                        WHERE profile_id = ?
                    ");
                    $stmt->execute([$targetRootBoardId]);
                    $maxPos = $stmt->fetch();
                    
                    $nextRow = 0;
                    $nextCol = 0;
                    $nextPage = 0;
                    
                    // Find next available position (simple: add to end of first page)
                    if ($maxPos && $maxPos['max_row'] !== null) {
                        $nextRow = (int)$maxPos['max_row'] + 1;
                        $nextCol = 0;
                        $nextPage = (int)($maxPos['max_page'] ?? 0);
                        
                        // If row exceeds grid, move to next column or page
                        $layoutType = $targetProfile['layout_type'] ?? '4x6';
                        preg_match('/(\d+)x(\d+)/', $layoutType, $matches);
                        $maxRows = isset($matches[1]) ? (int)$matches[1] : 4;
                        $maxCols = isset($matches[2]) ? (int)$matches[2] : 6;
                        
                        if ($nextRow >= $maxRows) {
                            $nextRow = 0;
                            $nextCol = (int)$maxPos['max_col'] + 1;
                            if ($nextCol >= $maxCols) {
                                $nextCol = 0;
                                $nextPage = $nextPage + 1;
                            }
                        }
                    }
                    
                    // Create a folder card that links to the imported profile
                    $folderCardTitle = $newProfileDisplayName;
                    // Store loadBoard metadata in label_text as JSON (temporary solution)
                    // TODO: Add load_board_id column to cards table for proper storage
                    $loadBoardMetadata = json_encode(['loadBoard' => (string)$newProfileId]);
                    
                    $stmt = $db->prepare("
                        INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                    ");
                    $stmt->execute([
                        $folderCardTitle,
                        $loadBoardMetadata, // Store JSON metadata in label_text
                        '/symbols/cboard/speech_bubble.svg', // Default folder icon
                        null,
                        null,
                        'rgb(187, 222, 251)', // Default folder color
                        'folder'
                    ]);
                    $folderCardId = $db->lastInsertId();
                    
                    // Create profile_card entry for the folder tile
                    $stmt = $db->prepare("
                        INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
                    ");
                    $stmt->execute([
                        $targetRootBoardId,
                        $folderCardId,
                        $nextRow,
                        $nextCol,
                        $nextPage
                    ]);
                    
                    $addedToRootBoard = true;
                }
            }
            
            $db->commit();
            
            return successResponse([
                'success' => true,
                'message' => 'Public profile imported successfully as folder',
                'profile_id' => $newProfileId,
                'profile_name' => $newProfileDisplayName,
                'cards_count' => $importedCardsCount,
                'added_to_root_board' => $addedToRootBoard
            ]);
            
        } catch (Exception $e) {
            $db->rollBack();
            error_log("Import public profile error: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
            return errorResponse('Failed to import public profile: ' . $e->getMessage(), 500);
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
            
            if (isset($data['is_public'])) {
                $updates[] = "is_public = ?";
                $params[] = (int)$data['is_public'];
            }
            
            if (empty($updates)) {
                return errorResponse('No fields to update', 400);
            }
            
            $updates[] = "updated_at = NOW()";
            $params[] = $profileId;
            
            // Get profile before update to compare changes (include created_at and updated_at)
            $stmt = $db->prepare("SELECT id, display_name, created_at, updated_at FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $oldProfile = $stmt->fetch();
            
            if (!$oldProfile) {
                return errorResponse('Profile not found', 404);
            }
            
            $sql = "UPDATE profiles SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            // Fetch updated profile (include created_at and updated_at)
            $stmt = $db->prepare("SELECT id, display_name, created_at, updated_at FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $updatedProfile = $stmt->fetch();
            
            // Log profile update to action_logs using actual database timestamps
            try {
                require_once __DIR__ . '/action-log.php';
                $metadata = json_encode([
                    'profile_name' => $updatedProfile['display_name'] ?? $oldProfile['display_name'],
                    'created_at' => $oldProfile['created_at'] ?? null,
                    'updated_at' => $updatedProfile['updated_at'] ?? null,
                    'changes' => array_keys($data)
                ]);
                insertActionLog($db, $user['id'], $profileId, null, 'profile_update', $metadata);
            } catch (Exception $e) {
                // Log error but don't fail profile update
                error_log("Failed to log profile update in PUT /profiles/{$profileId}: " . $e->getMessage());
            }
            
            // Fetch full updated profile for response
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
    if ($method === 'DELETE' && count($pathParts) === 2 && $pathParts[0] === 'profiles') {
        $profileId = $pathParts[1];
        
        error_log("Delete profile request - profileId: $profileId, pathParts: " . json_encode($pathParts));
        
        try {
            // Verify ownership and get profile info
            $stmt = $db->prepare("SELECT id, user_id FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                error_log("Delete profile - Profile not found: $profileId");
                return errorResponse('Profile not found', 404);
            }
            
            if ($profile['user_id'] != $user['id']) {
                error_log("Delete profile - Unauthorized: profile $profileId belongs to user {$profile['user_id']}, but request from user {$user['id']}");
                return errorResponse('Unauthorized', 403);
            }
            
            error_log("Delete profile - Deleting profile $profileId (user: {$user['id']})");
            
            // Delete the profile (this will cascade delete profile_cards due to ON DELETE CASCADE)
            $stmt = $db->prepare("DELETE FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            
            error_log("Delete profile - Successfully deleted profile $profileId");
            
            return successResponse(['success' => true, 'message' => 'Profile deleted successfully']);
            
        } catch (Exception $e) {
            error_log("Delete profile error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Failed to delete profile: ' . $e->getMessage(), 500);
        }
    }

    // POST /profiles/report - Report a profile/board (profile-centric)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'report') {
        // 後端目前只做記錄，不阻擋前端流程；未來可擴充寫入 logs 或發送通知
        try {
            $reported = $data ?? [];
            $reportedProfileId = $reported['profileId'] ?? $reported['boardId'] ?? null;
            error_log("Profile report received from user {$user['id']} for profile/board id={$reportedProfileId}");

            return successResponse([
                'success' => true,
                'message' => 'Profile report received'
            ]);
        } catch (Exception $e) {
            error_log("Profile report error: " . $e->getMessage());
            return errorResponse('Failed to report profile', 500);
        }
    }
    
    return errorResponse('Profile route not found', 404);
}

