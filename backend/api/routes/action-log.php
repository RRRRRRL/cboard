<?php
/**
 * Action Log Routes Handler
 * Sprint 4: Log card clicks, sentence composition, and communication actions
 */

require_once __DIR__ . '/../auth.php';

function handleActionLogRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    // POST /action-logs (create log entry)
    if ($method === 'POST' && count($pathParts) === 1) {
        // Action logs can be created by authenticated users or anonymously (for view-only mode)
        $user = null;
        if ($authToken) {
            $user = verifyAuth($authToken);
        }
        
        $userId = $user ? $user['id'] : null;
        $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
        $boardId = isset($data['board_id']) ? (int)$data['board_id'] : null;
        $cardId = isset($data['card_id']) ? (int)$data['card_id'] : null;
        $actionType = $data['action_type'] ?? 'card_click';
        $metadata = isset($data['metadata']) ? json_encode($data['metadata']) : null;
        
        if (empty($actionType)) {
            return errorResponse('action_type is required', 400);
        }
        
        // Validate action types for scanning
        $scanningActions = ['scan_start', 'scan_stop', 'scan_select', 'scan_highlight', 'scan_navigate'];
        if (in_array($actionType, $scanningActions)) {
            // Ensure metadata includes scanning info
            $metadataArray = isset($data['metadata']) ? $data['metadata'] : [];
            if (!isset($metadataArray['scanning_mode'])) {
                $metadataArray['scanning_mode'] = 'single';
            }
            if (!isset($metadataArray['scanning_speed'])) {
                $metadataArray['scanning_speed'] = 2.0;
            }
            $metadata = json_encode($metadataArray);
        }
        
        // Validate action types for devices (Sprint 6)
        $deviceActions = ['device_register', 'switch_longpress', 'eyetracking_select', 'eyetracking_calibrate'];
        if (in_array($actionType, $deviceActions)) {
            // Ensure metadata includes device info
            $metadataArray = isset($data['metadata']) ? $data['metadata'] : [];
            if (!isset($metadataArray['device_type'])) {
                $metadataArray['device_type'] = 'unknown';
            }
            $metadata = json_encode($metadataArray);
        }
        
        try {
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$userId, $profileId, $boardId, $cardId, $actionType, $metadata]);
            
            $logId = $db->lastInsertId();
            
            return successResponse([
                'id' => (int)$logId,
                'success' => true,
                'message' => 'Action logged'
            ], 201);
            
        } catch (Exception $e) {
            error_log("Action log error: " . $e->getMessage());
            return errorResponse('Failed to log action', 500);
        }
    }
    
    // GET /action-logs (get logs with filters)
    if ($method === 'GET' && count($pathParts) === 1) {
        $user = requireAuth($authToken);
        
        try {
            $profileId = $_GET['profile_id'] ?? null;
            $actionType = $_GET['action_type'] ?? null;
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
            
            $sql = "SELECT id, user_id, profile_id, board_id, card_id, action_type, metadata, created_at
                    FROM action_logs
                    WHERE user_id = ?";
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND profile_id = ?";
                $params[] = $profileId;
            }
            
            if ($actionType) {
                $sql .= " AND action_type = ?";
                $params[] = $actionType;
            }
            
            if ($startDate) {
                $sql .= " AND created_at >= ?";
                $params[] = $startDate;
            }
            
            if ($endDate) {
                $sql .= " AND created_at <= ?";
                $params[] = $endDate;
            }
            
            $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll();
            
            // Process logs: extract important info from metadata and format response
            // Metadata is still included in response, but we extract key fields for easy display
            $processedLogs = [];
            foreach ($logs as $log) {
                $metadata = null;
                if ($log['metadata']) {
                    $metadata = json_decode($log['metadata'], true);
                }
                
                // Extract important information from metadata for display
                $processedLog = [
                    'id' => (int)$log['id'],
                    'created_at' => $log['created_at'],
                    'action_type' => $log['action_type'],
                    'sentence' => $metadata['sentence'] ?? $metadata['text'] ?? null,
                    'device' => $metadata['device_type'] ?? $metadata['device'] ?? null,
                    'score' => isset($metadata['score']) ? (int)$metadata['score'] : null,
                    'game_type' => $metadata['game_type'] ?? $metadata['gameType'] ?? null,
                    'total_questions' => isset($metadata['total_questions']) ? (int)$metadata['total_questions'] : null,
                    'accuracy' => isset($metadata['accuracy']) ? (float)$metadata['accuracy'] : null,
                    'metadata' => $metadata // Keep full metadata for export/advanced use
                ];
                
                $processedLogs[] = $processedLog;
            }
            
            // Get total count
            $countSql = "SELECT COUNT(*) as total FROM action_logs WHERE user_id = ?";
            $countParams = [$user['id']];
            if ($profileId) {
                $countSql .= " AND profile_id = ?";
                $countParams[] = $profileId;
            }
            if ($actionType) {
                $countSql .= " AND action_type = ?";
                $countParams[] = $actionType;
            }
            $stmt = $db->prepare($countSql);
            $stmt->execute($countParams);
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'logs' => $processedLogs,
                'total' => (int)$total,
                'limit' => $limit,
                'offset' => $offset
            ]);
            
        } catch (Exception $e) {
            error_log("Get action logs error: " . $e->getMessage());
            return errorResponse('Failed to fetch action logs', 500);
        }
    }
    
    // GET /action-logs/export (export to Excel format - CSV for now)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'export') {
        $user = requireAuth($authToken);
        
        try {
            $profileId = $_GET['profile_id'] ?? null;
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;
            
            $sql = "SELECT al.created_at, al.action_type, 
                           p.display_name as profile_name,
                           c.title as card_title,
                           al.metadata
                    FROM action_logs al
                    LEFT JOIN profiles p ON al.profile_id = p.id
                    LEFT JOIN cards c ON al.card_id = c.id
                    WHERE al.user_id = ?";
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND al.profile_id = ?";
                $params[] = $profileId;
            }
            
            if ($startDate) {
                $sql .= " AND al.created_at >= ?";
                $params[] = $startDate;
            }
            
            if ($endDate) {
                $sql .= " AND al.created_at <= ?";
                $params[] = $endDate;
            }
            
            $sql .= " ORDER BY al.created_at DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll();
            
            // Generate CSV with important information (metadata still included in raw data)
            $csv = "Date,Time,Action Type,Sentence,Device,Score,Game Type,Metadata\n";
            foreach ($logs as $log) {
                $date = date('Y-m-d', strtotime($log['created_at']));
                $time = date('H:i:s', strtotime($log['created_at']));
                
                // Extract important info from metadata
                $metadata = $log['metadata'] ? json_decode($log['metadata'], true) : [];
                $sentence = $metadata['sentence'] ?? $metadata['text'] ?? '';
                $device = $metadata['device_type'] ?? $metadata['device'] ?? '';
                $score = '';
                if (isset($metadata['score'])) {
                    $score = isset($metadata['total_questions']) 
                        ? $metadata['score'] . '/' . $metadata['total_questions']
                        : (string)$metadata['score'];
                }
                $gameType = $metadata['game_type'] ?? $metadata['gameType'] ?? '';
                $metadataJson = $log['metadata'] ? $log['metadata'] : '';
                
                $csv .= sprintf(
                    "%s,%s,%s,%s,%s,%s,%s,%s\n",
                    $date,
                    $time,
                    $log['action_type'],
                    $sentence,
                    $device,
                    $score,
                    $gameType,
                    $metadataJson
                );
            }
            
            // Return CSV as download
            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="action_logs_' . date('Y-m-d') . '.csv"');
            echo $csv;
            exit;
            
        } catch (Exception $e) {
            error_log("Export action logs error: " . $e->getMessage());
            return errorResponse('Failed to export action logs', 500);
        }
    }
    
    return errorResponse('Action log route not found', 404);
}

