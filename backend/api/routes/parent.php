<?php
/**
 * Parent API Routes
 * Handles parent-specific operations
 */

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../middleware/role-access.php';

function handleParentRoutes($method, $pathParts, $data, $authToken) {
    error_log('DEBUG: handleParentRoutes called with method=' . $method . ', pathParts=' . json_encode($pathParts));

    $user = requireAuth($authToken);
    error_log('DEBUG: User authenticated: ' . json_encode(['id' => $user['id'], 'name' => $user['name'], 'role' => $user['role']]));

    // Check if user has parent role (legacy role check)
    $isLegacyParent = isset($user['role']) && $user['role'] === 'parent';
    error_log('DEBUG: isLegacyParent=' . ($isLegacyParent ? 'true' : 'false') . ', user role=' . ($user['role'] ?? 'null'));

    if (!$isLegacyParent && !isSystemAdmin($user['id'])) {
        error_log('DEBUG: Access denied - parent role required');
        return errorResponse('Access denied - parent role required', 403);
    }

    error_log('DEBUG: Parent role check passed, proceeding with route handling');

    /**
     * GET /parent/children - Get children for the current parent
     */
    /**
     * GET /parent/messages - Get messages for the current parent
     */
    if ($method === 'GET' && $pathParts[1] === 'messages') {
        error_log('DEBUG: Parent messages endpoint called for user ID: ' . $user['id']);

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        try {
            // Check if messages table exists
            $checkTableStmt = $db->prepare("SHOW TABLES LIKE 'messages'");
            $checkTableStmt->execute();
            $tableExists = $checkTableStmt->fetch();

            if (!$tableExists) {
                // Return available teachers instead of empty messages
                return successResponse([
                    'success' => true,
                    'data' => [
                        'messages' => [],
                        'teachers' => [], // Will be populated below
                        'total' => 0,
                        'message' => 'Messaging system not available. Please run database migrations.'
                    ]
                ]);
            }

            // Get messages where parent is recipient or sender
            $stmt = $db->prepare("
                SELECT
                    m.id,
                    m.sender_user_id,
                    m.recipient_user_id,
                    m.student_user_id,
                    m.subject,
                    m.message_body,
                    m.message_type,
                    m.priority,
                    m.is_read,
                    m.created_at,
                    su.name as sender_name,
                    ru.name as recipient_name,
                    stu.name as student_name
                FROM messages m
                LEFT JOIN users su ON m.sender_user_id = su.id
                LEFT JOIN users ru ON m.recipient_user_id = ru.id
                LEFT JOIN users stu ON m.student_user_id = stu.id
                WHERE (m.sender_user_id = ? OR m.recipient_user_id = ?)
                  AND (m.message_type IN ('parent_teacher', 'teacher_parent', 'admin_parent'))
                ORDER BY m.created_at DESC
                LIMIT 50
            ");

            $stmt->execute([$user['id'], $user['id']]);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Always try to get available teachers for messaging
            $teachers = [];
            try {
                // Get teachers associated with parent's children
                $teacherStmt = $db->prepare("
                    SELECT DISTINCT
                        u.id,
                        u.name,
                        u.email,
                        sta.class_id,
                        c.name as class_name
                    FROM users u
                    JOIN student_teacher_assignments sta ON u.id = sta.teacher_user_id
                    LEFT JOIN classes c ON sta.class_id = c.id
                    JOIN parent_child_relationships pcr ON sta.student_user_id = pcr.child_user_id
                    WHERE pcr.parent_user_id = ?
                      AND u.role = 'teacher'
                      AND (sta.end_date IS NULL OR sta.end_date >= CURDATE())
                    ORDER BY u.name
                ");
                $teacherStmt->execute([$user['id']]);
                $teachers = $teacherStmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) {
                error_log('DEBUG: Could not fetch teachers: ' . $e->getMessage());
                // Try fallback - get all teachers
                try {
                    $fallbackStmt = $db->prepare("
                        SELECT DISTINCT u.id, u.name, u.email
                        FROM users u
                        WHERE u.role = 'teacher'
                        ORDER BY u.name
                        LIMIT 20
                    ");
                    $fallbackStmt->execute();
                    $teachers = $fallbackStmt->fetchAll(PDO::FETCH_ASSOC);
                } catch (Exception $e2) {
                    error_log('DEBUG: Could not fetch teachers fallback: ' . $e2->getMessage());
                }
            }

            return successResponse([
                'success' => true,
                'data' => [
                    'messages' => $messages,
                    'teachers' => $teachers,
                    'total' => count($messages)
                ]
            ]);

        } catch (Exception $e) {
            error_log('DEBUG: Exception in parent messages endpoint: ' . $e->getMessage());
            return errorResponse('Failed to load messages: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /parent/progress-reports - Get progress reports for parent's children
     */
    if ($method === 'GET' && $pathParts[1] === 'progress-reports') {
        error_log('DEBUG: Parent progress reports endpoint called for user ID: ' . $user['id']);

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        try {
            // Check if progress_reports table exists
            $checkTableStmt = $db->prepare("SHOW TABLES LIKE 'progress_reports'");
            $checkTableStmt->execute();
            $tableExists = $checkTableStmt->fetch();

            if (!$tableExists) {
                return successResponse([
                    'success' => true,
                    'data' => [
                        'reports' => [],
                        'total' => 0,
                        'message' => 'Progress reporting system not available. Please run database migrations.'
                    ]
                ]);
            }

            // Get progress reports for all of parent's children
            $stmt = $db->prepare("
                SELECT
                    pr.id,
                    pr.student_user_id,
                    pr.teacher_user_id,
                    pr.parent_user_id,
                    pr.report_type,
                    pr.report_period_start,
                    pr.report_period_end,
                    pr.report_data,
                    pr.is_downloaded,
                    pr.generated_at,
                    pr.viewed_at,
                    su.name as student_name,
                    tu.name as teacher_name
                FROM progress_reports pr
                JOIN users su ON pr.student_user_id = su.id
                LEFT JOIN users tu ON pr.teacher_user_id = tu.id
                WHERE pr.parent_user_id = ?
                ORDER BY pr.generated_at DESC
                LIMIT 20
            ");

            $stmt->execute([$user['id']]);
            $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return successResponse([
                'success' => true,
                'data' => [
                    'reports' => $reports,
                    'total' => count($reports)
                ]
            ]);

        } catch (Exception $e) {
            error_log('DEBUG: Exception in parent progress reports endpoint: ' . $e->getMessage());
            return errorResponse('Failed to load progress reports: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /parent/child-progress/{childId} - Get detailed progress for a specific child
     */
    if ($method === 'GET' && $pathParts[1] === 'child-progress' && isset($pathParts[2])) {
        $childId = (int)$pathParts[2];
        error_log('DEBUG: Parent child progress endpoint called for child ID: ' . $childId . ', pathParts: ' . json_encode($pathParts));

        // Verify the child belongs to this parent
        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        try {
            $verifyStmt = $db->prepare("
                SELECT 1 FROM parent_child_relationships
                WHERE parent_user_id = ? AND child_user_id = ?
            ");
            $verifyStmt->execute([$user['id'], $childId]);
            $isParent = $verifyStmt->fetch(PDO::FETCH_ASSOC);

            if (!$isParent) {
                return errorResponse('Access denied. Child not found or not your child.', 403);
            }

            // Get learning objectives for this child
            $objectives = [];
            $checkTableStmt = $db->prepare("SHOW TABLES LIKE 'learning_objectives'");
            $checkTableStmt->execute();
            if ($checkTableStmt->fetch()) {
                $objStmt = $db->prepare("
                    SELECT
                        id,
                        objective_type,
                        title,
                        description,
                        target_date,
                        status,
                        progress_percentage,
                        created_at,
                        updated_at
                    FROM learning_objectives
                    WHERE student_user_id = ?
                    ORDER BY created_at DESC
                ");
                $objStmt->execute([$childId]);
                $objectives = $objStmt->fetchAll(PDO::FETCH_ASSOC);
            }

            // Get recent activity (games, etc.)
            $activity = [];
            $checkGamesStmt = $db->prepare("SHOW TABLES LIKE 'games_results'");
            $checkGamesStmt->execute();
            if ($checkGamesStmt->fetch()) {
                $gameStmt = $db->prepare("
                    SELECT
                        id,
                        score,
                        completed_at,
                        created_at
                    FROM games_results
                    WHERE user_id = ?
                    ORDER BY completed_at DESC
                    LIMIT 10
                ");
                $gameStmt->execute([$childId]);
                $activity = $gameStmt->fetchAll(PDO::FETCH_ASSOC);
            }

            return successResponse([
                'success' => true,
                'data' => [
                    'child_id' => $childId,
                    'learning_objectives' => $objectives,
                    'recent_activity' => $activity,
                    'objectives_count' => count($objectives),
                    'activity_count' => count($activity)
                ]
            ]);

        } catch (Exception $e) {
            error_log('DEBUG: Exception in parent child progress endpoint: ' . $e->getMessage());
            return errorResponse('Failed to load child progress: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /parent/send-message - Send a message to a teacher
     */
    if ($method === 'POST' && $pathParts[1] === 'send-message') {
        error_log('DEBUG: Parent send message endpoint called');

        $recipientId = $data['recipient_id'] ?? null;
        $studentId = $data['student_id'] ?? null;
        $subject = $data['subject'] ?? '';
        $messageBody = $data['message'] ?? '';

        if (!$recipientId || !$subject || !$messageBody) {
            return errorResponse('Recipient ID, subject, and message are required', 400);
        }

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        try {
            // Check if messages table exists
            $checkTableStmt = $db->prepare("SHOW TABLES LIKE 'messages'");
            $checkTableStmt->execute();
            if (!$checkTableStmt->fetch()) {
                return errorResponse('Messaging system not available', 503);
            }

            // If student_id provided, verify parent-child relationship
            if ($studentId) {
                $verifyStmt = $db->prepare("
                    SELECT 1 FROM parent_child_relationships
                    WHERE parent_user_id = ? AND child_user_id = ?
                ");
                $verifyStmt->execute([$user['id'], $studentId]);
                if (!$verifyStmt->fetch()) {
                    return errorResponse('Access denied. Student not found or not your child.', 403);
                }
            }

            // Insert the message
            $stmt = $db->prepare("
                INSERT INTO messages
                (sender_user_id, recipient_user_id, student_user_id, subject, message_body,
                 message_type, priority, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, 'parent_teacher', 'normal', 0, NOW())
            ");

            $stmt->execute([$user['id'], $recipientId, $studentId, $subject, $messageBody]);

            return successResponse([
                'success' => true,
                'message' => 'Message sent successfully',
                'message_id' => $db->lastInsertId()
            ]);

        } catch (Exception $e) {
            error_log('DEBUG: Exception in parent send message endpoint: ' . $e->getMessage());
            return errorResponse('Failed to send message: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /parent/children - Get children for the current parent
     */
    if ($method === 'GET' && $pathParts[1] === 'children') {
        error_log('DEBUG: Parent children endpoint called for user ID: ' . $user['id']);

        $db = getDB();
        if (!$db) {
            error_log('DEBUG: Database connection failed');
            return errorResponse('Database connection failed', 500);
        }

        try {
            // First, check if parent_child_relationships table exists
            error_log('DEBUG: Checking if parent_child_relationships table exists');
            $checkTableStmt = $db->prepare("SHOW TABLES LIKE 'parent_child_relationships'");
            $checkTableStmt->execute();
            $tableExists = $checkTableStmt->fetch();

            if (!$tableExists) {
                error_log('DEBUG: parent_child_relationships table does not exist');
                // Table doesn't exist, return empty result with message
                return successResponse([
                    'success' => true,
                    'data' => [
                        'children' => [],
                        'total' => 0,
                        'message' => 'Parent-child relationships table not found. Please run database migrations.'
                    ]
                ]);
            }

            error_log('DEBUG: parent_child_relationships table exists, executing query');

            // Get all children linked to this parent
            $stmt = $db->prepare("
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.created_at,
                    u.last_login,
                    pcr.relationship_type,
                    pcr.custody_type,
                    pcr.can_manage_profile,
                    pcr.can_view_progress,
                    pcr.can_receive_notifications,
                    pcr.emergency_contact,
                    pcr.notes,
                    pcr.created_at as relationship_created_at
                FROM parent_child_relationships pcr
                JOIN users u ON pcr.child_user_id = u.id
                WHERE pcr.parent_user_id = ?
                ORDER BY u.name
            ");

            $stmt->execute([$user['id']]);
            $children = $stmt->fetchAll(PDO::FETCH_ASSOC);

            error_log('DEBUG: Query executed successfully, found ' . count($children) . ' children');

            // Add basic statistics for each child
            foreach ($children as &$child) {
                $child['learning_objectives'] = [
                    'count' => 0,
                    'average_progress' => 0
                ];
                $child['recent_activity'] = [
                    'games_played' => 0,
                    'average_score' => 0
                ];
            }

            return successResponse([
                'success' => true,
                'data' => [
                    'children' => $children,
                    'total' => count($children)
                ]
            ]);

        } catch (Exception $e) {
            error_log('DEBUG: Exception in parent children endpoint: ' . $e->getMessage());
            error_log('DEBUG: Exception trace: ' . $e->getTraceAsString());
            return errorResponse('Failed to load children: ' . $e->getMessage(), 500);
        }
    }

    return errorResponse('Parent route not found', 404);
}
?>
