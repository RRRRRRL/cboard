<?php
/**
 * Parent-Teacher Messaging API Routes
 * Handles communication between parents and teachers
 */

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../middleware/role-access.php';

function handleMessagingRoutes($method, $pathParts, $data, $authToken) {
    $user = requireAuth($authToken);

    // Helper function to get teachers for a parent
    function getTeachersForParent($parentId) {
        $db = getDB();
        if (!$db) return [];

        $stmt = $db->prepare("
            SELECT DISTINCT u.id, u.name, u.email,
                   sta.class_id, c.name as class_name,
                   o.id as organization_id, o.name as organization_name
            FROM users u
            JOIN student_teacher_assignments sta ON u.id = sta.teacher_user_id
            JOIN parent_child_relationships pcr ON sta.student_user_id = pcr.child_user_id
            LEFT JOIN classes c ON sta.class_id = c.id
            LEFT JOIN organizations o ON sta.organization_id = o.id
            WHERE pcr.parent_user_id = ? AND sta.end_date IS NULL
            ORDER BY u.name
        ");
        $stmt->execute([$parentId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Helper function to get parents for a teacher
    function getParentsForTeacher($teacherId) {
        $db = getDB();
        if (!$db) return [];

        $stmt = $db->prepare("
            SELECT DISTINCT u.id, u.name, u.email,
                   pcr.child_user_id, cu.name as child_name,
                   sta.class_id, c.name as class_name,
                   o.id as organization_id, o.name as organization_name
            FROM users u
            JOIN parent_child_relationships pcr ON u.id = pcr.parent_user_id
            JOIN student_teacher_assignments sta ON pcr.child_user_id = sta.student_user_id
            JOIN users cu ON pcr.child_user_id = cu.id
            LEFT JOIN classes c ON sta.class_id = c.id
            LEFT JOIN organizations o ON sta.organization_id = o.id
            WHERE sta.teacher_user_id = ? AND sta.end_date IS NULL
            ORDER BY u.name
        ");
        $stmt->execute([$teacherId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Helper function to check if user can message another user about a student
    function canMessageAboutStudent($senderId, $recipientId, $studentId = null) {
        $db = getDB();
        if (!$db) return false;

        // If no specific student, check general relationship
        if (!$studentId) {
            // Check if they have any shared students
            $stmt = $db->prepare("
                SELECT COUNT(*) as shared_students
                FROM parent_child_relationships pcr1
                JOIN parent_child_relationships pcr2 ON pcr1.child_user_id = pcr2.child_user_id
                JOIN student_teacher_assignments sta ON pcr1.child_user_id = sta.student_user_id
                WHERE pcr1.parent_user_id = ? AND pcr2.parent_user_id = ?
                AND sta.teacher_user_id IN (?, ?)
                AND sta.end_date IS NULL
            ");
            $stmt->execute([$senderId, $recipientId, $senderId, $recipientId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result['shared_students'] > 0;
        }

        // Check specific student relationship
        $stmt = $db->prepare("
            SELECT
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM parent_child_relationships
                        WHERE parent_user_id = ? AND child_user_id = ?
                    ) AND EXISTS (
                        SELECT 1 FROM student_teacher_assignments
                        WHERE teacher_user_id = ? AND student_user_id = ?
                        AND end_date IS NULL
                    ) THEN 1
                    WHEN EXISTS (
                        SELECT 1 FROM parent_child_relationships
                        WHERE parent_user_id = ? AND child_user_id = ?
                    ) AND EXISTS (
                        SELECT 1 FROM student_teacher_assignments
                        WHERE teacher_user_id = ? AND student_user_id = ?
                        AND end_date IS NULL
                    ) THEN 1
                    ELSE 0
                END as can_message
        ");
        $stmt->execute([$senderId, $studentId, $recipientId, $studentId, $recipientId, $studentId, $senderId, $studentId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['can_message'] == 1;
    }

    /**
     * GET /messaging/contacts - Get available messaging contacts
     */
    if ($method === 'GET' && $pathParts[1] === 'contacts') {
        $userRoles = getUserRoles($user['id']);
        $contacts = [];

        // Check if user is a parent
        $isParent = array_filter($userRoles, fn($r) => $r['role'] === 'parent');
        if (!empty($isParent)) {
            $contacts = getTeachersForParent($user['id']);
        }

        // Check if user is a teacher
        $isTeacher = array_filter($userRoles, fn($r) => in_array($r['role'], ['teacher', 'therapist']));
        if (!empty($isTeacher)) {
            $contacts = getParentsForTeacher($user['id']);
        }

        return successResponse(['contacts' => $contacts]);
    }

    /**
     * GET /messaging/conversations - Get user's message conversations
     */
    if ($method === 'GET' && $pathParts[1] === 'conversations') {
        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = ($page - 1) * $limit;

        try {
            // Get conversations (latest message per conversation)
            $stmt = $db->prepare("
                SELECT
                    LEAST(m.sender_user_id, m.recipient_user_id) as user1_id,
                    GREATEST(m.sender_user_id, m.recipient_user_id) as user2_id,
                    m.student_user_id,
                    MAX(m.created_at) as last_message_at,
                    COUNT(CASE WHEN m.is_read = 0 AND m.recipient_user_id = ? THEN 1 END) as unread_count,
                    (
                        SELECT message_body
                        FROM messages m2
                        WHERE LEAST(m2.sender_user_id, m2.recipient_user_id) = LEAST(m.sender_user_id, m.recipient_user_id)
                        AND GREATEST(m2.sender_user_id, m2.recipient_user_id) = GREATEST(m.sender_user_id, m.recipient_user_id)
                        AND (m2.student_user_id = m.student_user_id OR (m2.student_user_id IS NULL AND m.student_user_id IS NULL))
                        ORDER BY m2.created_at DESC
                        LIMIT 1
                    ) as last_message_preview,
                    su.name as student_name,
                    cu.name as other_user_name,
                    cu.email as other_user_email
                FROM messages m
                LEFT JOIN users su ON m.student_user_id = su.id
                LEFT JOIN users cu ON (
                    CASE
                        WHEN m.sender_user_id = ? THEN m.recipient_user_id
                        ELSE m.sender_user_id
                    END
                ) = cu.id
                WHERE m.sender_user_id = ? OR m.recipient_user_id = ?
                GROUP BY LEAST(m.sender_user_id, m.recipient_user_id),
                         GREATEST(m.sender_user_id, m.recipient_user_id),
                         m.student_user_id
                ORDER BY last_message_at DESC
                LIMIT ? OFFSET ?
            ");

            $stmt->execute([$user['id'], $user['id'], $user['id'], $user['id'], $limit, $offset]);
            $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return successResponse([
                'conversations' => $conversations,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => count($conversations) // Simplified - would need separate count query for full pagination
                ]
            ]);

        } catch (Exception $e) {
            return errorResponse('Failed to load conversations: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /messaging/messages/{other_user_id} - Get messages with specific user
     */
    if ($method === 'GET' && $pathParts[1] === 'messages' && isset($pathParts[2])) {
        $otherUserId = (int)$pathParts[2];
        $studentId = isset($_GET['student_id']) ? (int)$_GET['student_id'] : null;

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        // Verify messaging permission
        if (!canMessageAboutStudent($user['id'], $otherUserId, $studentId)) {
            return errorResponse('Access denied', 403);
        }

        try {
            $whereConditions = ["((m.sender_user_id = ? AND m.recipient_user_id = ?) OR (m.sender_user_id = ? AND m.recipient_user_id = ?))"];
            $params = [$user['id'], $otherUserId, $otherUserId, $user['id']];

            if ($studentId) {
                $whereConditions[] = "m.student_user_id = ?";
                $params[] = $studentId;
            }

            $whereClause = implode(' AND ', $whereConditions);

            // Mark messages as read
            $updateStmt = $db->prepare("
                UPDATE messages SET is_read = 1
                WHERE recipient_user_id = ? AND sender_user_id = ? AND is_read = 0
                " . ($studentId ? " AND student_user_id = ?" : "")
            );
            $updateParams = [$user['id'], $otherUserId];
            if ($studentId) $updateParams[] = $studentId;
            $updateStmt->execute($updateParams);

            // Get messages
            $stmt = $db->prepare("
                SELECT m.*,
                       su.name as sender_name,
                       ru.name as recipient_name,
                       stu.name as student_name
                FROM messages m
                LEFT JOIN users su ON m.sender_user_id = su.id
                LEFT JOIN users ru ON m.recipient_user_id = ru.id
                LEFT JOIN users stu ON m.student_user_id = stu.id
                WHERE $whereClause
                ORDER BY m.created_at ASC
            ");

            $stmt->execute($params);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return successResponse(['messages' => $messages]);

        } catch (Exception $e) {
            return errorResponse('Failed to load messages: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /messaging/send - Send a message
     */
    if ($method === 'POST' && $pathParts[1] === 'send') {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || !isset($data['recipient_user_id']) || !isset($data['subject']) || !isset($data['message_body'])) {
            return errorResponse('Recipient, subject, and message body are required', 400);
        }

        $recipientId = (int)$data['recipient_user_id'];
        $studentId = isset($data['student_user_id']) ? (int)$data['student_user_id'] : null;

        // Verify messaging permission
        if (!canMessageAboutStudent($user['id'], $recipientId, $studentId)) {
            return errorResponse('Access denied', 403);
        }

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        try {
            // Determine message type
            $userRoles = getUserRoles($user['id']);
            $recipientRoles = getUserRoles($recipientId);

            $isParent = !empty(array_filter($userRoles, fn($r) => $r['role'] === 'parent'));
            $recipientIsTeacher = !empty(array_filter($recipientRoles, fn($r) => in_array($r['role'], ['teacher', 'therapist'])));

            $messageType = $isParent && $recipientIsTeacher ? 'parent_teacher' : 'teacher_parent';

            // Insert message
            $stmt = $db->prepare("
                INSERT INTO messages
                (sender_user_id, recipient_user_id, student_user_id, subject, message_body,
                 message_type, priority, parent_message_id, organization_id, class_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            // Get organization/class context if student specified
            $orgId = null;
            $classId = null;
            if ($studentId) {
                $contextStmt = $db->prepare("
                    SELECT sta.organization_id, sta.class_id
                    FROM student_teacher_assignments sta
                    WHERE sta.student_user_id = ? AND sta.teacher_user_id = ?
                    AND sta.end_date IS NULL
                    LIMIT 1
                ");
                $contextStmt->execute([$studentId, $recipientId]);
                $context = $contextStmt->fetch(PDO::FETCH_ASSOC);
                if ($context) {
                    $orgId = $context['organization_id'];
                    $classId = $context['class_id'];
                }
            }

            $stmt->execute([
                $user['id'],
                $recipientId,
                $studentId,
                $data['subject'],
                $data['message_body'],
                $messageType,
                $data['priority'] ?? 'normal',
                $data['parent_message_id'] ?? null,
                $orgId,
                $classId
            ]);

            $messageId = $db->lastInsertId();

            // Create notification
            $notifStmt = $db->prepare("
                INSERT INTO notifications
                (sender_user_id, recipient_user_id, notification_type, title, message, related_student_id, priority)
                VALUES (?, ?, 'parent_teacher_communication', ?, ?, ?, 'normal')
            ");

            $studentName = '';
            if ($studentId) {
                $studentStmt = $db->prepare("SELECT name FROM users WHERE id = ?");
                $studentStmt->execute([$studentId]);
                $student = $studentStmt->fetch(PDO::FETCH_ASSOC);
                $studentName = $student ? $student['name'] : '';
            }

            $notifStmt->execute([
                $user['id'],
                $recipientId,
                $data['subject'],
                "New message" . ($studentName ? " about $studentName" : ""),
                $studentId
            ]);

            return successResponse([
                'message_id' => $messageId,
                'message' => 'Message sent successfully'
            ], 201);

        } catch (Exception $e) {
            return errorResponse('Failed to send message: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /messaging/mark-read/{message_id} - Mark message as read
     */
    if ($method === 'PUT' && $pathParts[1] === 'mark-read' && isset($pathParts[2])) {
        $messageId = (int)$pathParts[2];

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        try {
            // Verify user can access this message
            $stmt = $db->prepare("
                UPDATE messages
                SET is_read = 1, updated_at = NOW()
                WHERE id = ? AND recipient_user_id = ?
            ");

            $stmt->execute([$messageId, $user['id']]);

            if ($stmt->rowCount() === 0) {
                return errorResponse('Message not found or access denied', 404);
            }

            return successResponse(['message' => 'Message marked as read']);

        } catch (Exception $e) {
            return errorResponse('Failed to mark message as read: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /messaging/child-settings/{child_user_id} - Get child settings managed by parent
     */
    if ($method === 'GET' && $pathParts[1] === 'child-settings' && isset($pathParts[2])) {
        $childId = (int)$pathParts[2];

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        // Verify parent can manage this child
        $stmt = $db->prepare("
            SELECT pcr.id FROM parent_child_relationships pcr
            WHERE pcr.parent_user_id = ? AND pcr.child_user_id = ?
        ");
        $stmt->execute([$user['id'], $childId]);
        if (!$stmt->fetch()) {
            return errorResponse('Access denied', 403);
        }

        try {
            $stmt = $db->prepare("
                SELECT cs.* FROM child_settings cs
                WHERE cs.child_user_id = ? AND cs.parent_user_id = ? AND cs.is_active = 1
                ORDER BY cs.updated_at DESC LIMIT 1
            ");
            $stmt->execute([$childId, $user['id']]);
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($settings) {
                $settings['settings_data'] = json_decode($settings['settings_data'], true);
                return successResponse(['settings' => $settings]);
            } else {
                // Return default settings
                return successResponse(['settings' => [
                    'child_user_id' => $childId,
                    'parent_user_id' => $user['id'],
                    'settings_data' => [
                        'notifications_enabled' => true,
                        'language_preference' => 'zh-HK',
                        'accessibility_features' => [
                            'high_contrast' => false,
                            'large_text' => false,
                            'simplified_interface' => false
                        ]
                    ],
                    'is_active' => 1
                ]]);
            }
        } catch (Exception $e) {
            return errorResponse('Failed to load child settings: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /messaging/child-settings - Save child settings
     */
    if ($method === 'POST' && $pathParts[1] === 'child-settings') {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || !isset($data['child_user_id']) || !isset($data['settings_data'])) {
            return errorResponse('Child user ID and settings data are required', 400);
        }

        $childId = (int)$data['child_user_id'];

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        // Verify parent can manage this child
        $stmt = $db->prepare("
            SELECT pcr.id FROM parent_child_relationships pcr
            WHERE pcr.parent_user_id = ? AND pcr.child_user_id = ?
        ");
        $stmt->execute([$user['id'], $childId]);
        if (!$stmt->fetch()) {
            return errorResponse('Access denied', 403);
        }

        try {
            $settingsJson = json_encode($data['settings_data']);

            // Insert or update settings
            $stmt = $db->prepare("
                INSERT INTO child_settings
                (child_user_id, parent_user_id, settings_data, is_active)
                VALUES (?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    settings_data = VALUES(settings_data),
                    updated_at = NOW()
            ");

            $stmt->execute([$childId, $user['id'], $settingsJson]);

            return successResponse(['message' => 'Child settings saved successfully']);

        } catch (Exception $e) {
            return errorResponse('Failed to save child settings: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /messaging/progress-reports/{child_user_id} - Get progress reports for child
     */
    if ($method === 'GET' && $pathParts[1] === 'progress-reports' && isset($pathParts[2])) {
        $childId = (int)$pathParts[2];

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        // Verify parent can access this child
        $stmt = $db->prepare("
            SELECT pcr.id FROM parent_child_relationships pcr
            WHERE pcr.parent_user_id = ? AND pcr.child_user_id = ?
        ");
        $stmt->execute([$user['id'], $childId]);
        if (!$stmt->fetch()) {
            return errorResponse('Access denied', 403);
        }

        try {
            $stmt = $db->prepare("
                SELECT pr.*,
                       tu.name as teacher_name,
                       cu.name as child_name
                FROM progress_reports pr
                LEFT JOIN users tu ON pr.teacher_user_id = tu.id
                LEFT JOIN users cu ON pr.student_user_id = cu.id
                WHERE pr.student_user_id = ? AND pr.parent_user_id = ?
                ORDER BY pr.generated_at DESC
            ");
            $stmt->execute([$childId, $user['id']]);
            $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Decode JSON data
            foreach ($reports as &$report) {
                $report['report_data'] = json_decode($report['report_data'], true);
            }

            return successResponse(['reports' => $reports]);

        } catch (Exception $e) {
            return errorResponse('Failed to load progress reports: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /messaging/progress-reports - Generate progress report
     */
    if ($method === 'POST' && $pathParts[1] === 'progress-reports') {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || !isset($data['student_user_id'])) {
            return errorResponse('Student user ID is required', 400);
        }

        $childId = (int)$data['student_user_id'];
        $reportType = $data['report_type'] ?? 'monthly';
        $periodStart = $data['period_start'] ?? date('Y-m-d', strtotime('-30 days'));
        $periodEnd = $data['period_end'] ?? date('Y-m-d');

        $db = getDB();
        if (!$db) return errorResponse('Database connection failed', 500);

        // Verify parent can access this child
        $stmt = $db->prepare("
            SELECT pcr.id FROM parent_child_relationships pcr
            WHERE pcr.parent_user_id = ? AND pcr.child_user_id = ?
        ");
        $stmt->execute([$user['id'], $childId]);
        if (!$stmt->fetch()) {
            return errorResponse('Access denied', 403);
        }

        try {
            // Generate report data
            $reportData = generateProgressReportData($childId, $periodStart, $periodEnd);

            // Insert report
            $stmt = $db->prepare("
                INSERT INTO progress_reports
                (student_user_id, teacher_user_id, parent_user_id, report_type,
                 report_period_start, report_period_end, report_data)
                VALUES (?, NULL, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $childId,
                $user['id'],
                $reportType,
                $periodStart,
                $periodEnd,
                json_encode($reportData)
            ]);

            $reportId = $db->lastInsertId();

            return successResponse([
                'report_id' => $reportId,
                'message' => 'Progress report generated successfully',
                'report_data' => $reportData
            ], 201);

        } catch (Exception $e) {
            return errorResponse('Failed to generate progress report: ' . $e->getMessage(), 500);
        }
    }

    return errorResponse('Messaging route not found', 404);
}

/**
 * Generate progress report data for a student
 */
function generateProgressReportData($studentId, $periodStart, $periodEnd) {
    $db = getDB();
    if (!$db) return [];

    $report = [
        'period' => [
            'start' => $periodStart,
            'end' => $periodEnd
        ],
        'learning_objectives' => [],
        'game_results' => [],
        'jyutping_progress' => [],
        'overall_progress' => 0
    ];

    // Get learning objectives progress
    $stmt = $db->prepare("
        SELECT lo.*, u.name as teacher_name
        FROM learning_objectives lo
        LEFT JOIN users u ON lo.teacher_user_id = u.id
        WHERE lo.student_user_id = ? AND lo.created_at BETWEEN ? AND ?
        ORDER BY lo.created_at DESC
    ");
    $stmt->execute([$studentId, $periodStart . ' 00:00:00', $periodEnd . ' 23:59:59']);
    $objectives = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalProgress = 0;
    $objectiveCount = 0;

    foreach ($objectives as $obj) {
        $report['learning_objectives'][] = [
            'id' => $obj['id'],
            'title' => $obj['title'],
            'objective_type' => $obj['objective_type'],
            'progress_percentage' => $obj['progress_percentage'],
            'status' => $obj['status'],
            'target_date' => $obj['target_date'],
            'teacher_name' => $obj['teacher_name']
        ];

        $totalProgress += $obj['progress_percentage'] ?? 0;
        $objectiveCount++;
    }

    // Get game results
    $stmt = $db->prepare("
        SELECT gr.*, u.name as user_name
        FROM games_results gr
        LEFT JOIN users u ON gr.user_id = u.id
        WHERE gr.user_id = ? AND gr.completed_at BETWEEN ? AND ?
        ORDER BY gr.completed_at DESC
    ");
    $stmt->execute([$studentId, $periodStart . ' 00:00:00', $periodEnd . ' 23:59:59']);
    $games = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($games as $game) {
        $report['game_results'][] = [
            'game_type' => $game['game_type'],
            'score' => $game['score'],
            'level' => $game['level'],
            'completed_at' => $game['completed_at']
        ];
    }

    // Get Jyutping learning progress
    $stmt = $db->prepare("
        SELECT COUNT(*) as total_sessions,
               SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_sessions,
               AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) * 100 as accuracy_percentage
        FROM jyutping_learning_log
        WHERE user_id = ? AND created_at BETWEEN ? AND ?
    ");
    $stmt->execute([$studentId, $periodStart . ' 00:00:00', $periodEnd . ' 23:59:59']);
    $jyutpingStats = $stmt->fetch(PDO::FETCH_ASSOC);

    $report['jyutping_progress'] = [
        'total_sessions' => (int)$jyutpingStats['total_sessions'],
        'correct_sessions' => (int)$jyutpingStats['correct_sessions'],
        'accuracy_percentage' => round($jyutpingStats['accuracy_percentage'] ?? 0, 1)
    ];

    // Calculate overall progress
    if ($objectiveCount > 0) {
        $report['overall_progress'] = round($totalProgress / $objectiveCount, 1);
    }

    return $report;
}
