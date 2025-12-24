<?php
/**
 * Data Retention Policy Routes Handler
 * Handles data retention policy configuration and cleanup operations
 */

require_once __DIR__ . '/../auth.php';

function handleDataRetentionRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    $user = requireAuth($authToken);
    
    // Ensure user is admin (data retention is admin-only)
    if ($user['role'] !== 'admin') {
        return errorResponse('Unauthorized: Admin access required', 403);
    }
    
    // GET /data-retention - Get current data retention settings
    if ($method === 'GET' && count($pathParts) === 1) {
        try {
            // Get settings from database
            $stmt = $db->prepare("
                SELECT 
                    action_logs_retention_days,
                    learning_logs_retention_days,
                    ocr_history_retention_days,
                    last_cleanup_at,
                    updated_at
                FROM data_retention_policy
                WHERE id = 1
            ");
            $stmt->execute();
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$settings) {
                // Return default settings if not configured
                $defaultSettings = [
                    'retention_period' => '30_days',
                    'action_logs_retention_days' => 30,
                    'learning_logs_retention_days' => 30,
                    'ocr_history_retention_days' => 30,
                    'last_cleanup' => null,
                    'last_cleanup_at' => null
                ];
                return successResponse(['settings' => $defaultSettings]);
            }
            
            // Map database fields to frontend format
            $retentionPeriod = '30_days';
            if ($settings['action_logs_retention_days'] === null) {
                $retentionPeriod = 'never';
            } elseif ($settings['action_logs_retention_days'] === 90) {
                $retentionPeriod = '90_days';
            } elseif ($settings['action_logs_retention_days'] === 365) {
                $retentionPeriod = '1_year';
            } elseif ($settings['action_logs_retention_days'] === 1095) {
                $retentionPeriod = '3_years';
            }
            
            return successResponse([
                'settings' => [
                    'retention_period' => $retentionPeriod,
                    'action_logs_retention_days' => $settings['action_logs_retention_days'],
                    'learning_logs_retention_days' => $settings['learning_logs_retention_days'],
                    'ocr_history_retention_days' => $settings['ocr_history_retention_days'],
                    'last_cleanup' => $settings['last_cleanup_at'],
                    'last_cleanup_at' => $settings['last_cleanup_at']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log("Get data retention settings error: " . $e->getMessage());
            return errorResponse('Failed to fetch data retention settings', 500);
        }
    }
    
    // PUT /data-retention - Update data retention settings
    if ($method === 'PUT' && count($pathParts) === 1) {
        try {
            // Accept either retention_period (single value for all) or individual day values
            $actionLogsDays = null;
            $learningLogsDays = null;
            $ocrHistoryDays = null;
            
            if (isset($data['retention_period'])) {
                // Single retention_period for all log types
                $validPeriods = ['30_days', '90_days', '1_year', '3_years', 'never'];
                $retentionPeriod = $data['retention_period'];
                
                if (!in_array($retentionPeriod, $validPeriods)) {
                    return errorResponse('Invalid retention period. Must be one of: ' . implode(', ', $validPeriods), 400);
                }
                
                // Map retention_period to days
                $days = null;
                switch ($retentionPeriod) {
                    case '30_days':
                        $days = 30;
                        break;
                    case '90_days':
                        $days = 90;
                        break;
                    case '1_year':
                        $days = 365;
                        break;
                    case '3_years':
                        $days = 1095;
                        break;
                    case 'never':
                        $days = null;
                        break;
                }
                
                $actionLogsDays = $days;
                $learningLogsDays = $days;
                $ocrHistoryDays = $days;
            } else {
                // Individual day values for each log type
                $actionLogsDays = isset($data['action_logs_retention_days']) 
                    ? ($data['action_logs_retention_days'] === 0 ? null : (int)$data['action_logs_retention_days'])
                    : null;
                $learningLogsDays = isset($data['learning_logs_retention_days']) 
                    ? ($data['learning_logs_retention_days'] === 0 ? null : (int)$data['learning_logs_retention_days'])
                    : null;
                $ocrHistoryDays = isset($data['ocr_history_retention_days']) 
                    ? ($data['ocr_history_retention_days'] === 0 ? null : (int)$data['ocr_history_retention_days'])
                    : null;
            }
            
            // Update or insert settings
            $stmt = $db->prepare("
                INSERT INTO data_retention_policy (
                    id,
                    action_logs_retention_days,
                    learning_logs_retention_days,
                    ocr_history_retention_days,
                    updated_at
                ) VALUES (
                    1,
                    ?,
                    ?,
                    ?,
                    NOW()
                )
                ON DUPLICATE KEY UPDATE
                    action_logs_retention_days = ?,
                    learning_logs_retention_days = ?,
                    ocr_history_retention_days = ?,
                    updated_at = NOW()
            ");
            $stmt->execute([$actionLogsDays, $learningLogsDays, $ocrHistoryDays, $actionLogsDays, $learningLogsDays, $ocrHistoryDays]);
            
            // Get updated settings
            $stmt = $db->prepare("
                SELECT 
                    action_logs_retention_days,
                    learning_logs_retention_days,
                    ocr_history_retention_days,
                    last_cleanup_at,
                    updated_at
                FROM data_retention_policy
                WHERE id = 1
            ");
            $stmt->execute();
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return successResponse([
                'success' => true,
                'message' => 'Data retention settings updated',
                'settings' => [
                    'retention_period' => $retentionPeriod,
                    'action_logs_retention_days' => $settings['action_logs_retention_days'],
                    'learning_logs_retention_days' => $settings['learning_logs_retention_days'],
                    'ocr_history_retention_days' => $settings['ocr_history_retention_days'],
                    'last_cleanup' => $settings['last_cleanup_at'],
                    'last_cleanup_at' => $settings['last_cleanup_at']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log("Update data retention settings error: " . $e->getMessage());
            return errorResponse('Failed to update data retention settings', 500);
        }
    }
    
    // POST /data-retention/cleanup - Manually trigger cleanup
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'cleanup') {
        try {
            // Get current retention settings
            $stmt = $db->prepare("
                SELECT 
                    action_logs_retention_days,
                    learning_logs_retention_days,
                    ocr_history_retention_days
                FROM data_retention_policy
                WHERE id = 1
            ");
            $stmt->execute();
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$settings) {
                // Use defaults if not configured
                $actionLogsDays = 30;
                $learningLogsDays = 30;
                $ocrHistoryDays = 30;
            } else {
                $actionLogsDays = $settings['action_logs_retention_days'];
                $learningLogsDays = $settings['learning_logs_retention_days'];
                $ocrHistoryDays = $settings['ocr_history_retention_days'];
            }
            
            $stats = [
                'action_logs_deleted' => 0,
                'learning_logs_deleted' => 0,
                'ocr_history_deleted' => 0
            ];
            
            // Clean up action_logs
            if ($actionLogsDays !== null) {
                $stmt = $db->prepare("
                    DELETE FROM action_logs
                    WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                ");
                $stmt->execute([$actionLogsDays]);
                $stats['action_logs_deleted'] = $stmt->rowCount();
            }
            
            // Clean up jyutping_learning_log
            if ($learningLogsDays !== null) {
                $stmt = $db->prepare("
                    DELETE FROM jyutping_learning_log
                    WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                ");
                $stmt->execute([$learningLogsDays]);
                $stats['learning_logs_deleted'] = $stmt->rowCount();
            }
            
            // Clean up ocr_history
            if ($ocrHistoryDays !== null) {
                $stmt = $db->prepare("
                    DELETE FROM ocr_history
                    WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                ");
                $stmt->execute([$ocrHistoryDays]);
                $stats['ocr_history_deleted'] = $stmt->rowCount();
            }
            
            // Update last_cleanup_at
            $stmt = $db->prepare("
                UPDATE data_retention_policy
                SET last_cleanup_at = NOW()
                WHERE id = 1
            ");
            $stmt->execute();
            
            // If no row exists, create one
            if ($stmt->rowCount() === 0) {
                $stmt = $db->prepare("
                    INSERT INTO data_retention_policy (
                        id,
                        action_logs_retention_days,
                        learning_logs_retention_days,
                        ocr_history_retention_days,
                        last_cleanup_at,
                        updated_at
                    ) VALUES (
                        1,
                        ?,
                        ?,
                        ?,
                        NOW(),
                        NOW()
                    )
                ");
                $stmt->execute([
                    $actionLogsDays ?? 30,
                    $learningLogsDays ?? 30,
                    $ocrHistoryDays ?? 30
                ]);
            }
            
            return successResponse([
                'success' => true,
                'message' => 'Data cleanup completed',
                'stats' => $stats
            ]);
            
        } catch (Exception $e) {
            error_log("Data retention cleanup error: " . $e->getMessage());
            return errorResponse('Failed to run data cleanup', 500);
        }
    }
    
    return errorResponse('Data retention route not found', 404);
}

