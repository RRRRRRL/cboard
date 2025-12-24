<?php
/**
 * Data Retention Cleanup Script
 * 
 * This script automatically cleans up old logs based on the data retention policy.
 * It should be run periodically (e.g., daily via cron job).
 * 
 * Usage:
 *   php cleanup-old-logs.php
 * 
 * Or via cron:
 *   0 2 * * * /usr/bin/php /path/to/backend/scripts/cleanup-old-logs.php
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../database/init.php';

function runDataRetentionCleanup() {
    $db = getDB();
    if (!$db) {
        error_log('[Data Retention Cleanup] Database connection failed');
        return false;
    }
    
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
            error_log('[Data Retention Cleanup] No retention policy found, using defaults (30 days)');
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
            error_log("[Data Retention Cleanup] Deleted {$stats['action_logs_deleted']} action_logs entries older than {$actionLogsDays} days");
        } else {
            error_log('[Data Retention Cleanup] action_logs retention is set to "never", skipping cleanup');
        }
        
        // Clean up jyutping_learning_log
        if ($learningLogsDays !== null) {
            $stmt = $db->prepare("
                DELETE FROM jyutping_learning_log
                WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            ");
            $stmt->execute([$learningLogsDays]);
            $stats['learning_logs_deleted'] = $stmt->rowCount();
            error_log("[Data Retention Cleanup] Deleted {$stats['learning_logs_deleted']} jyutping_learning_log entries older than {$learningLogsDays} days");
        } else {
            error_log('[Data Retention Cleanup] learning_logs retention is set to "never", skipping cleanup');
        }
        
        // Clean up ocr_history
        if ($ocrHistoryDays !== null) {
            $stmt = $db->prepare("
                DELETE FROM ocr_history
                WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            ");
            $stmt->execute([$ocrHistoryDays]);
            $stats['ocr_history_deleted'] = $stmt->rowCount();
            error_log("[Data Retention Cleanup] Deleted {$stats['ocr_history_deleted']} ocr_history entries older than {$ocrHistoryDays} days");
        } else {
            error_log('[Data Retention Cleanup] ocr_history retention is set to "never", skipping cleanup');
        }
        
        // Update last_cleanup_at
        $stmt = $db->prepare("
            UPDATE data_retention_policy
            SET last_cleanup_at = NOW()
            WHERE id = 1
        ");
        $stmt->execute();
        
        // If no row exists, create one with defaults
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
        
        $totalDeleted = $stats['action_logs_deleted'] + $stats['learning_logs_deleted'] + $stats['ocr_history_deleted'];
        error_log("[Data Retention Cleanup] Cleanup completed. Total entries deleted: {$totalDeleted}");
        
        return [
            'success' => true,
            'stats' => $stats,
            'total_deleted' => $totalDeleted
        ];
        
    } catch (Exception $e) {
        error_log("[Data Retention Cleanup] Error: " . $e->getMessage());
        error_log("[Data Retention Cleanup] Stack trace: " . $e->getTraceAsString());
        return false;
    }
}

// Run cleanup if called directly
if (php_sapi_name() === 'cli') {
    $result = runDataRetentionCleanup();
    if ($result) {
        echo "Data retention cleanup completed successfully.\n";
        echo "Action logs deleted: {$result['stats']['action_logs_deleted']}\n";
        echo "Learning logs deleted: {$result['stats']['learning_logs_deleted']}\n";
        echo "OCR history deleted: {$result['stats']['ocr_history_deleted']}\n";
        echo "Total deleted: {$result['total_deleted']}\n";
        exit(0);
    } else {
        echo "Data retention cleanup failed. Check error logs for details.\n";
        exit(1);
    }
}

