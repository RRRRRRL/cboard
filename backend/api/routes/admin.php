<?php
/**
 * Enhanced Admin Panel API Routes
 * Role-based access control with organization management
 */

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../middleware/role-access.php';

function handleAdminRoutes($method, $pathParts, $data, $authToken) {
    $user = requireAuth($authToken);

/**
 * GET /admin/dashboard - Get admin dashboard data
 */
if ($method === 'GET' && $pathParts[1] === 'dashboard') {
    if ($user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        // System-wide statistics
        $stats = [];

        // User statistics
        $stmt = $db->prepare("SELECT role, COUNT(*) as count FROM users GROUP BY role");
        $stmt->execute();
        $userStats = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $stats['users'] = $userStats;

        // Organization statistics
        $stmt = $db->prepare("SELECT COUNT(*) as total_orgs FROM organizations WHERE is_active = 1");
        $stmt->execute();
        $orgResult = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['organizations'] = $orgResult['total_orgs'];

        // Active classes
        $stmt = $db->prepare("SELECT COUNT(*) as total_classes FROM classes WHERE is_active = 1");
        $stmt->execute();
        $classResult = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['classes'] = $classResult['total_classes'];

        // Recent activities
        $stmt = $db->prepare("
            SELECT al.*, u.name as user_name, p.display_name as profile_name
            FROM action_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN profiles p ON al.profile_id = p.id
            ORDER BY al.created_at DESC LIMIT 20
        ");
        $stmt->execute();
        $stats['recent_activities'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return successResponse(['stats' => $stats]);

    } catch (Exception $e) {
        return errorResponse('Failed to load dashboard: ' . $e->getMessage(), 500);
    }
}

/**
 * GET /admin/organizations - List all organizations (system admin only)
 */
if ($method === 'GET' && $pathParts[1] === 'organizations') {
    if (!requireRole($user, 'system_admin')) {
        return errorResponse('Access denied', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            SELECT o.*,
                   COUNT(DISTINCT uor.user_id) as total_users,
                   COUNT(DISTINCT c.id) as total_classes
            FROM organizations o
            LEFT JOIN user_organization_roles uor ON o.id = uor.organization_id AND uor.is_active = 1
            LEFT JOIN classes c ON o.id = c.organization_id AND c.is_active = 1
            GROUP BY o.id
            ORDER BY o.name
        ");
        $stmt->execute();
        $organizations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return successResponse(['organizations' => $organizations]);

    } catch (Exception $e) {
        return errorResponse('Failed to load organizations: ' . $e->getMessage(), 500);
    }
}

/**
 * POST /admin/organizations - Create new organization
 */
if ($method === 'POST' && $pathParts[1] === 'organizations') {
    requireRole($user, 'system_admin');

    // Request body is provided via the $data parameter
    if (!$data || !isset($data['name'])) {
        return errorResponse('Organization name is required', 400);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            INSERT INTO organizations (name, description, contact_email, contact_phone, address, subscription_type, max_users)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $data['name'],
            $data['description'] ?? null,
            $data['contact_email'] ?? null,
            $data['contact_phone'] ?? null,
            $data['address'] ?? null,
            $data['subscription_type'] ?? 'free',
            $data['max_users'] ?? 100
        ]);

        $orgId = $db->lastInsertId();

        return successResponse([
            'organization_id' => $orgId,
            'message' => 'Organization created successfully'
        ], 201);

    } catch (Exception $e) {
        return errorResponse('Failed to create organization: ' . $e->getMessage(), 500);
    }
}

/**
 * GET /admin/organizations/{id}/classes - Get classes for an organization
 */
if ($method === 'GET' && $pathParts[1] === 'organizations' && isset($pathParts[2]) && isset($pathParts[3]) && $pathParts[3] === 'classes') {
    $orgId = (int)$pathParts[2];

    // Check if user can access this organization
    if (!isSystemAdmin($user['id']) && !isOrgAdmin($user['id'], $orgId)) {
        return errorResponse('Access denied', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            SELECT c.*,
                   COUNT(DISTINCT sta.student_user_id) as student_count,
                   COUNT(DISTINCT sta.teacher_user_id) as teacher_count
            FROM classes c
            LEFT JOIN student_teacher_assignments sta ON c.id = sta.class_id
                AND (sta.end_date IS NULL OR sta.end_date >= CURDATE())
            WHERE c.organization_id = ? AND c.is_active = 1
            GROUP BY c.id
            ORDER BY c.name
        ");
        $stmt->execute([$orgId]);
        $classes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return successResponse(['classes' => $classes]);

    } catch (Exception $e) {
        return errorResponse('Failed to load classes: ' . $e->getMessage(), 500);
    }
}

/**
 * POST /admin/organizations/{id}/classes - Create class in organization
 */
if ($method === 'POST' && $pathParts[1] === 'organizations' && isset($pathParts[2]) && isset($pathParts[3]) && $pathParts[3] === 'classes') {
    $orgId = (int)$pathParts[2];

    if (!isSystemAdmin($user['id']) && !isOrgAdmin($user['id'], $orgId)) {
        return errorResponse('Access denied', 403);
    }

    // Request body is provided via the $data parameter
    if (!$data || !isset($data['name'])) {
        return errorResponse('Class name is required', 400);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            INSERT INTO classes (organization_id, name, description, class_code, academic_year, max_students)
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $orgId,
            $data['name'],
            $data['description'] ?? null,
            $data['class_code'] ?? null,
            $data['academic_year'] ?? date('Y') . '-' . (date('Y') + 1),
            $data['max_students'] ?? 30
        ]);

        $classId = $db->lastInsertId();

        return successResponse([
            'class_id' => $classId,
            'message' => 'Class created successfully'
        ], 201);

    } catch (Exception $e) {
        return errorResponse('Failed to create class: ' . $e->getMessage(), 500);
    }
}

/**
 * GET /admin/organizations/{id}/users - Get users in an organization
 */
if ($method === 'GET' && $pathParts[1] === 'organizations' && isset($pathParts[2]) && isset($pathParts[3]) && $pathParts[3] === 'users') {
    $orgId = (int)$pathParts[2];

    if (!isSystemAdmin($user['id']) && !isOrgAdmin($user['id'], $orgId)) {
        return errorResponse('Access denied', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            SELECT u.id, u.name, u.email, u.role as legacy_role, u.is_active,
                   uor.role as org_role, uor.class_id, c.name as class_name,
                   uor.is_primary, uor.assigned_at
            FROM users u
            JOIN user_organization_roles uor ON u.id = uor.user_id
            LEFT JOIN classes c ON uor.class_id = c.id
            WHERE uor.organization_id = ? AND uor.is_active = 1
            ORDER BY uor.role, u.name
        ");
        $stmt->execute([$orgId]);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return successResponse(['users' => $users]);

    } catch (Exception $e) {
        return errorResponse('Failed to load users: ' . $e->getMessage(), 500);
    }
}

/**
 * POST /admin/organizations/{id}/users - Assign user to organization
 */
if ($method === 'POST' && $pathParts[1] === 'organizations' && isset($pathParts[2]) && isset($pathParts[3]) && $pathParts[3] === 'users') {
    $orgId = (int)$pathParts[2];

    if (!isSystemAdmin($user['id']) && !isOrgAdmin($user['id'], $orgId)) {
        return errorResponse('Access denied', 403);
    }

    // Request body is provided via the $data parameter
    if (!$data || !isset($data['user_id']) || !isset($data['role'])) {
        return errorResponse('User ID and role are required', 400);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            INSERT INTO user_organization_roles (user_id, organization_id, role, class_id, assigned_by)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                role = VALUES(role),
                class_id = VALUES(class_id),
                assigned_by = VALUES(assigned_by)
        ");

        $stmt->execute([
            $data['user_id'],
            $orgId,
            $data['role'],
            $data['class_id'] ?? null,
            $user['id']
        ]);

        return successResponse(['message' => 'User assigned to organization successfully']);

    } catch (Exception $e) {
        return errorResponse('Failed to assign user: ' . $e->getMessage(), 500);
    }
}



/**
 * GET /admin/parent/children - Get children accessible by current parent
 */
if ($method === 'GET' && $pathParts[1] === 'parent' && $pathParts[2] === 'children') {
    // Check if user is a parent
    $userRoles = getUserRoles($user['id']);
    $isParent = array_filter($userRoles, fn($r) => $r['role'] === 'parent');

    if (empty($isParent) && !isSystemAdmin($user['id'])) {
        return errorResponse('Access denied - parent role required', 403);
    }

    $children = getAccessibleChildren($user['id']);

    return successResponse(['children' => $children]);
}

/**
 * GET /admin/student/progress/{student_id} - Get student progress (for teachers/parents)
 */
if ($method === 'GET' && $pathParts[1] === 'student' && $pathParts[2] === 'progress' && isset($pathParts[3])) {
    $studentId = (int)$pathParts[3];

    if (!canAccessStudentData($user['id'], $studentId)) {
        return errorResponse('Access denied', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        // Get learning objectives
        $stmt = $db->prepare("
            SELECT lo.*, u.name as teacher_name
            FROM learning_objectives lo
            JOIN users u ON lo.teacher_user_id = u.id
            WHERE lo.student_user_id = ?
            ORDER BY lo.created_at DESC
        ");
        $stmt->execute([$studentId]);
        $objectives = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get recent game results
        $stmt = $db->prepare("
            SELECT gr.*, u.name as user_name, p.display_name as profile_name
            FROM games_results gr
            LEFT JOIN users u ON gr.user_id = u.id
            LEFT JOIN profiles p ON gr.profile_id = p.id
            WHERE gr.user_id = ?
            ORDER BY gr.completed_at DESC LIMIT 10
        ");
        $stmt->execute([$studentId]);
        $gameResults = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get recent Jyutping learning logs
        $stmt = $db->prepare("
            SELECT jll.*, u.name as user_name
            FROM jyutping_learning_log jll
            LEFT JOIN users u ON jll.user_id = u.id
            WHERE jll.user_id = ?
            ORDER BY jll.created_at DESC LIMIT 20
        ");
        $stmt->execute([$studentId]);
        $jyutpingLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return successResponse([
            'objectives' => $objectives,
            'game_results' => $gameResults,
            'jyutping_logs' => $jyutpingLogs
        ]);

    } catch (Exception $e) {
        return errorResponse('Failed to load progress: ' . $e->getMessage(), 500);
    }
}

/**
 * POST /admin/learning-objectives - Create learning objective (for teachers)
 */
if ($method === 'POST' && $pathParts[1] === 'learning-objectives') {
    // Check if user is a teacher
    $userRoles = getUserRoles($user['id']);
    $isTeacher = array_filter($userRoles, fn($r) => in_array($r['role'], ['teacher', 'therapist']));

    if (empty($isTeacher) && !isSystemAdmin($user['id'])) {
        return errorResponse('Access denied - teacher role required', 403);
    }

    // Request body is provided via the $data parameter
    if (!$data || !isset($data['student_user_id']) || !isset($data['title'])) {
        return errorResponse('Student ID and objective title are required', 400);
    }

    // Verify teacher can access this student
    if (!canAccessStudentData($user['id'], $data['student_user_id'])) {
        return errorResponse('Access denied to this student', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            INSERT INTO learning_objectives
            (student_user_id, teacher_user_id, objective_type, title, description, target_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $data['student_user_id'],
            $user['id'],
            $data['objective_type'] ?? 'communication',
            $data['title'],
            $data['description'] ?? null,
            $data['target_date'] ?? null,
            $data['status'] ?? 'active'
        ]);

        $objectiveId = $db->lastInsertId();

        return successResponse([
            'objective_id' => $objectiveId,
            'message' => 'Learning objective created successfully'
        ], 201);

    } catch (Exception $e) {
        return errorResponse('Failed to create objective: ' . $e->getMessage(), 500);
    }
}

/**
 * PUT /admin/learning-objectives/{id} - Update learning objective progress
 */
if ($method === 'PUT' && $pathParts[1] === 'learning-objectives' && isset($pathParts[2])) {
    $objectiveId = (int)$pathParts[2];

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    // Check if user owns this objective or is a teacher of the student
    $stmt = $db->prepare("
        SELECT lo.* FROM learning_objectives lo
        WHERE lo.id = ?
    ");
    $stmt->execute([$objectiveId]);
    $objective = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$objective) {
        return errorResponse('Objective not found', 404);
    }

    $canEdit = $objective['teacher_user_id'] == $user['id'] ||
               canAccessStudentData($user['id'], $objective['student_user_id']);

    if (!$canEdit) {
        return errorResponse('Access denied', 403);
    }

    // Request body is provided via the $data parameter
    if (!$data) {
        return errorResponse('Invalid data', 400);
    }

    try {
        $updates = [];
        $params = [];

        // Allow updating core objective fields
        if (isset($data['title'])) {
            $updates[] = 'title = ?';
            $params[] = trim($data['title']);
        }

        if (isset($data['description'])) {
            $updates[] = 'description = ?';
            $params[] = $data['description'];
        }

        if (isset($data['objective_type'])) {
            $updates[] = 'objective_type = ?';
            $params[] = $data['objective_type'];
        }

        if (isset($data['target_date'])) {
            $updates[] = 'target_date = ?';
            $params[] = $data['target_date'];
        }

        // Allow updating progress fields
        if (isset($data['progress_percentage'])) {
            $updates[] = 'progress_percentage = ?';
            $params[] = (int)$data['progress_percentage'];
        }

        if (isset($data['status'])) {
            $updates[] = 'status = ?';
            $params[] = $data['status'];
        }

        if (isset($data['notes'])) {
            $updates[] = 'notes = ?';
            $params[] = $data['notes'];
        }

        if (empty($updates)) {
            return errorResponse('No valid updates provided', 400);
        }

        $updates[] = 'updated_at = NOW()';
        $params[] = $objectiveId;

        $sql = "UPDATE learning_objectives SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return successResponse(['message' => 'Objective updated successfully']);

    } catch (Exception $e) {
        return errorResponse('Failed to update objective: ' . $e->getMessage(), 500);
    }
}

/**
 * DELETE /admin/learning-objectives/{id} - Delete learning objective
 */
if ($method === 'DELETE' && $pathParts[1] === 'learning-objectives' && isset($pathParts[2])) {
    $objectiveId = (int)$pathParts[2];

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    // Check if user owns this objective or is a teacher of the student
    $stmt = $db->prepare("
        SELECT lo.* FROM learning_objectives lo
        WHERE lo.id = ?
    ");
    $stmt->execute([$objectiveId]);
    $objective = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$objective) {
        return errorResponse('Objective not found', 404);
    }

    $canDelete = $objective['teacher_user_id'] == $user['id'] ||
                 canAccessStudentData($user['id'], $objective['student_user_id']);

    if (!$canDelete) {
        return errorResponse('Access denied', 403);
    }

    try {
        $stmt = $db->prepare("DELETE FROM learning_objectives WHERE id = ?");
        $stmt->execute([$objectiveId]);

        if ($stmt->rowCount() === 0) {
            return errorResponse('Objective not found', 404);
        }

        return successResponse(['message' => 'Learning objective deleted successfully']);

    } catch (Exception $e) {
        return errorResponse('Failed to delete objective: ' . $e->getMessage(), 500);
    }
}

/**
 * GET /admin/users - Get all users (admin only)
 */
if ($method === 'GET' && $pathParts[1] === 'users' && (count($pathParts) === 2 || empty($pathParts[2]))) {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        // Get query parameters and enforce sane bounds
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        if ($page < 1) $page = 1;

        $MAX_LIMIT = 100;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        if ($limit < 1) $limit = 1;
        if ($limit > $MAX_LIMIT) $limit = $MAX_LIMIT;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $role = isset($_GET['role']) ? trim($_GET['role']) : '';
        $is_active = isset($_GET['is_active']) ? $_GET['is_active'] : null;

        $offset = ($page - 1) * $limit;

        // Build WHERE conditions
        $whereConditions = [];
        $params = [];

        if (!empty($search)) {
            $whereConditions[] = "(u.name LIKE ? OR u.email LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if (!empty($role)) {
            $whereConditions[] = "u.role = ?";
            $params[] = $role;
        }

        if ($is_active !== null) {
            $whereConditions[] = "u.is_active = ?";
            $params[] = $is_active ? 1 : 0;
        }

        $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

        // Get total count
        $countStmt = $db->prepare("SELECT COUNT(*) as total FROM users u $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

        // Get users with pagination
        $stmt = $db->prepare("
            SELECT u.id, u.name, u.email, u.role, u.is_active, u.is_verified,
                   u.created_at, u.last_login,
                   COUNT(DISTINCT p.id) as profiles_count
            FROM users u
            LEFT JOIN profiles p ON u.id = p.user_id
            $whereClause
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return successResponse([
            'users' => $users,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => (int)$total,
                'pages' => ceil($total / $limit)
            ]
        ]);

    } catch (Exception $e) {
        return errorResponse('Failed to load users: ' . $e->getMessage(), 500);
    }
}

/**
 * GET /admin/users/{id} - Get user details (admin only)
 */
if ($method === 'GET' && $pathParts[1] === 'users' && isset($pathParts[2])) {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $userId = (int)$pathParts[2];

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            SELECT u.*, COUNT(DISTINCT p.id) as profiles_count
            FROM users u
            LEFT JOIN profiles p ON u.id = p.user_id
            WHERE u.id = ?
            GROUP BY u.id
        ");
        $stmt->execute([$userId]);
        $targetUser = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$targetUser) {
            return errorResponse('User not found', 404);
        }

        return successResponse(['user' => $targetUser]);

    } catch (Exception $e) {
        return errorResponse('Failed to load user: ' . $e->getMessage(), 500);
    }
}

/**
 * PUT /admin/users/{id} - Update user (admin only)
 */
if ($method === 'PUT' && $pathParts[1] === 'users' && isset($pathParts[2])) {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $userId = (int)$pathParts[2];
    // Request body is provided via the $data parameter

    if (!$data) {
        return errorResponse('Invalid data', 400);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $updates = [];
        $params = [];

        if (isset($data['name'])) {
            $updates[] = 'name = ?';
            $params[] = trim($data['name']);
        }

        if (isset($data['role'])) {
            $updates[] = 'role = ?';
            $params[] = trim($data['role']);
        }

        if (isset($data['is_active'])) {
            $updates[] = 'is_active = ?';
            $params[] = $data['is_active'] ? 1 : 0;
        }

        if (isset($data['is_verified'])) {
            $updates[] = 'is_verified = ?';
            $params[] = $data['is_verified'] ? 1 : 0;
        }

        if (isset($data['password']) && !empty($data['password'])) {
            $updates[] = 'password = ?';
            $params[] = password_hash($data['password'], PASSWORD_DEFAULT);
        }

        if (empty($updates)) {
            return errorResponse('No valid updates provided', 400);
        }

        $updates[] = 'updated_at = NOW()';
        $params[] = $userId;

        $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return successResponse(['message' => 'User updated successfully']);

    } catch (Exception $e) {
        return errorResponse('Failed to update user: ' . $e->getMessage(), 500);
    }
}

/**
 * DELETE /admin/users/{id} - Delete/deactivate user (admin only)
 */
if ($method === 'DELETE' && $pathParts[1] === 'users' && isset($pathParts[2])) {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $userId = (int)$pathParts[2];

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        // Soft delete - just deactivate
        $stmt = $db->prepare("UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$userId]);

        return successResponse(['message' => 'User deactivated successfully']);

    } catch (Exception $e) {
        return errorResponse('Failed to deactivate user: ' . $e->getMessage(), 500);
    }
}

/**
 * GET /admin/parent-child - Get all parent-child relationships (admin only)
 */
if ($method === 'GET' && $pathParts[1] === 'parent-child') {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("
            SELECT pcr.*,
                   p.name as parent_name, p.email as parent_email,
                   c.name as child_name, c.email as child_email,
                   u.name as verified_by_name
            FROM parent_child_relationships pcr
            JOIN users p ON pcr.parent_user_id = p.id
            JOIN users c ON pcr.child_user_id = c.id
            LEFT JOIN users u ON pcr.verified_by = u.id
            ORDER BY pcr.created_at DESC
        ");
        $stmt->execute();
        $relationships = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return successResponse(['relationships' => $relationships]);

    } catch (Exception $e) {
        return errorResponse('Failed to load parent-child relationships: ' . $e->getMessage(), 500);
    }
}

/**
 * POST /admin/parent-child - Create parent-child relationship
 */
if ($method === 'POST' && $pathParts[1] === 'parent-child') {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    // Request body is provided via the $data parameter
    if (!$data || !isset($data['parent_user_id']) || !isset($data['child_user_id'])) {
        return errorResponse('Parent and child user IDs are required', 400);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        // Check if relationship already exists
        $stmt = $db->prepare("
            SELECT id FROM parent_child_relationships
            WHERE parent_user_id = ? AND child_user_id = ?
        ");
        $stmt->execute([$data['parent_user_id'], $data['child_user_id']]);
        if ($stmt->fetch()) {
            return errorResponse('Relationship already exists', 409);
        }

        // Create relationship
        $stmt = $db->prepare("
            INSERT INTO parent_child_relationships
            (parent_user_id, child_user_id, relationship_type, custody_type,
             can_manage_profile, can_view_progress, can_receive_notifications,
             emergency_contact, notes, verified_at, verified_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        ");

        $stmt->execute([
            $data['parent_user_id'],
            $data['child_user_id'],
            $data['relationship_type'] ?? 'guardian',
            $data['custody_type'] ?? 'full',
            isset($data['can_manage_profile']) ? ($data['can_manage_profile'] ? 1 : 0) : 1,
            isset($data['can_view_progress']) ? ($data['can_view_progress'] ? 1 : 0) : 1,
            isset($data['can_receive_notifications']) ? ($data['can_receive_notifications'] ? 1 : 0) : 1,
            isset($data['emergency_contact']) ? ($data['emergency_contact'] ? 1 : 0) : 0,
            $data['notes'] ?? null,
            $user['id']
        ]);

        $relationshipId = $db->lastInsertId();

        return successResponse([
            'relationship_id' => $relationshipId,
            'message' => 'Parent-child relationship created successfully'
        ], 201);

    } catch (Exception $e) {
        return errorResponse('Failed to create relationship: ' . $e->getMessage(), 500);
    }
}

/**
 * PUT /admin/parent-child/{id} - Update parent-child relationship
 */
if ($method === 'PUT' && $pathParts[1] === 'parent-child' && isset($pathParts[2])) {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $relationshipId = (int)$pathParts[2];
    // Request body is provided via the $data parameter

    if (!$data) {
        return errorResponse('Invalid data', 400);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $updates = [];
        $params = [];

        if (isset($data['relationship_type'])) {
            $updates[] = 'relationship_type = ?';
            $params[] = $data['relationship_type'];
        }

        if (isset($data['custody_type'])) {
            $updates[] = 'custody_type = ?';
            $params[] = $data['custody_type'];
        }

        if (isset($data['can_manage_profile'])) {
            $updates[] = 'can_manage_profile = ?';
            $params[] = $data['can_manage_profile'] ? 1 : 0;
        }

        if (isset($data['can_view_progress'])) {
            $updates[] = 'can_view_progress = ?';
            $params[] = $data['can_view_progress'] ? 1 : 0;
        }

        if (isset($data['can_receive_notifications'])) {
            $updates[] = 'can_receive_notifications = ?';
            $params[] = $data['can_receive_notifications'] ? 1 : 0;
        }

        if (isset($data['emergency_contact'])) {
            $updates[] = 'emergency_contact = ?';
            $params[] = $data['emergency_contact'] ? 1 : 0;
        }

        if (isset($data['notes'])) {
            $updates[] = 'notes = ?';
            $params[] = $data['notes'];
        }

        if (empty($updates)) {
            return errorResponse('No valid updates provided', 400);
        }

        $updates[] = 'updated_at = NOW()';
        $params[] = $relationshipId;

        $sql = "UPDATE parent_child_relationships SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return successResponse(['message' => 'Relationship updated successfully']);

    } catch (Exception $e) {
        return errorResponse('Failed to update relationship: ' . $e->getMessage(), 500);
    }
}

/**
 * DELETE /admin/parent-child/{id} - Delete parent-child relationship
 */
if ($method === 'DELETE' && $pathParts[1] === 'parent-child' && isset($pathParts[2])) {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $relationshipId = (int)$pathParts[2];

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stmt = $db->prepare("DELETE FROM parent_child_relationships WHERE id = ?");
        $stmt->execute([$relationshipId]);

        if ($stmt->rowCount() === 0) {
            return errorResponse('Relationship not found', 404);
        }

        return successResponse(['message' => 'Relationship deleted successfully']);

    } catch (Exception $e) {
        return errorResponse('Failed to delete relationship: ' . $e->getMessage(), 500);
    }
}

/**
 * GET /admin/statistics - Get admin statistics (admin only)
 */
if ($method === 'GET' && $pathParts[1] === 'statistics') {
    if (!isSystemAdmin($user['id']) && $user['role'] !== 'admin') {
        return errorResponse('Access denied', 403);
    }

    $db = getDB();
    if (!$db) return errorResponse('Database connection failed', 500);

    try {
        $stats = [];

        // User statistics
        $stmt = $db->prepare("
            SELECT
                COUNT(*) as total_users,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as recent_registrations
            FROM users
        ");
        $stmt->execute();
        $userStats = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['user_stats'] = $userStats;

        // Profile statistics
        $stmt = $db->prepare("
            SELECT
                COUNT(*) as total_profiles,
                SUM(CASE WHEN is_public = 1 THEN 1 ELSE 0 END) as public_profiles
            FROM profiles
        ");
        $stmt->execute();
        $profileStats = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['profile_stats'] = $profileStats;

        // Game statistics
        $stmt = $db->prepare("
            SELECT COUNT(*) as total_games_played
            FROM games_results
            WHERE completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        $stmt->execute();
        $gameStats = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['game_stats'] = $gameStats;

        // Jyutping learning statistics
        $stmt = $db->prepare("
            SELECT COUNT(*) as total_jyutping_sessions
            FROM jyutping_learning_log
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        $stmt->execute();
        $jyutpingStats = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['jyutping_stats'] = $jyutpingStats;

        // Action log statistics (recent activity)
        $stmt = $db->prepare("
            SELECT COUNT(*) as total_actions_today
            FROM action_logs
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        ");
        $stmt->execute();
        $actionStats = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['action_stats'] = $actionStats;

        return successResponse(['statistics' => $stats]);

    } catch (Exception $e) {
        return errorResponse('Failed to load statistics: ' . $e->getMessage(), 500);
    }
}

return errorResponse('Admin route not found', 404);
}
