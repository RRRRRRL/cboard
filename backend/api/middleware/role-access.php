<?php
/**
 * Role-Based Access Control Middleware
 * Comprehensive RBAC system for Cboard AAC application
 */

require_once __DIR__ . '/../../config/database.php';

/**
 * Get user's roles and permissions for a specific organization
 */
function getUserRoles($userId, $organizationId = null) {
    $db = getDB();
    if (!$db) return [];

    $sql = "
        SELECT uor.*, o.name as organization_name, c.name as class_name
        FROM user_organization_roles uor
        LEFT JOIN organizations o ON uor.organization_id = o.id
        LEFT JOIN classes c ON uor.class_id = c.id
        WHERE uor.user_id = ? AND uor.is_active = 1
    ";

    $params = [$userId];

    if ($organizationId) {
        $sql .= " AND uor.organization_id = ?";
        $params[] = $organizationId;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Check if user has a specific role in an organization
 */
function hasRole($userId, $role, $organizationId = null) {
    $roles = getUserRoles($userId, $organizationId);
    return array_filter($roles, fn($r) => $r['role'] === $role);
}

/**
 * Check if user is system admin (global access)
 */
function isSystemAdmin($userId) {
    return !empty(hasRole($userId, 'system_admin'));
}

/**
 * Check if user is organization admin
 */
function isOrgAdmin($userId, $organizationId) {
    return !empty(hasRole($userId, 'org_admin', $organizationId));
}

/**
 * Check if user can access a specific student's data
 */
function canAccessStudentData($userId, $studentUserId, $organizationId = null) {
    $db = getDB();
    if (!$db) return false;

    // System admins can access everything
    if (isSystemAdmin($userId)) return true;

    // Users can access their own data
    if ($userId == $studentUserId) return true;

    try {
        // Check teacher-student relationships (with graceful error handling)
        $checkTableStmt = $db->prepare("SHOW TABLES LIKE 'student_teacher_assignments'");
        $checkTableStmt->execute();
        if ($checkTableStmt->fetch()) {
            // Table exists, check for teacher-student relationship
            $teacherQuery = "
                SELECT 1 FROM student_teacher_assignments
                WHERE teacher_user_id = ? AND student_user_id = ?
                  AND (end_date IS NULL OR end_date >= CURDATE())
            ";
            $params = [$userId, $studentUserId];

            // Only add organization filter if organization_id column exists
            $checkColumnStmt = $db->prepare("SHOW COLUMNS FROM student_teacher_assignments LIKE 'organization_id'");
            $checkColumnStmt->execute();
            if ($checkColumnStmt->fetch() && $organizationId) {
                $teacherQuery .= " AND (organization_id = ? OR ? IS NULL)";
                $params[] = $organizationId;
                $params[] = $organizationId;
            }

            $stmt = $db->prepare($teacherQuery);
            $stmt->execute($params);
            if ($stmt->fetch()) return true;
        }
    } catch (Exception $e) {
        // If there's any error with teacher-student checking, continue to parent-child check
        error_log('Teacher-student access check failed: ' . $e->getMessage());
    }

    try {
        // Check parent-child relationships
        $checkTableStmt = $db->prepare("SHOW TABLES LIKE 'parent_child_relationships'");
        $checkTableStmt->execute();
        if ($checkTableStmt->fetch()) {
            $stmt = $db->prepare("
                SELECT 1 FROM parent_child_relationships
                WHERE parent_user_id = ? AND child_user_id = ?
            ");
            $stmt->execute([$userId, $studentUserId]);
            if ($stmt->fetch()) return true;
        }
    } catch (Exception $e) {
        // If there's any error with parent-child checking, continue
        error_log('Parent-child access check failed: ' . $e->getMessage());
    }

    // Check organization admin access (with error handling)
    try {
        if ($organizationId && isOrgAdmin($userId, $organizationId)) return true;
    } catch (Exception $e) {
        error_log('Organization admin access check failed: ' . $e->getMessage());
    }

    return false;
}

/**
 * Check if user can manage a specific profile
 */
function canManageProfile($userId, $profileId) {
    $db = getDB();
    if (!$db) return false;

    // System admins can manage everything
    if (isSystemAdmin($userId)) return true;

    // Get profile owner
    $stmt = $db->prepare("SELECT user_id FROM profiles WHERE id = ?");
    $stmt->execute([$profileId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) return false;

    $profileOwnerId = $profile['user_id'];

    // Profile owner can manage their own profiles
    if ($userId == $profileOwnerId) return true;

    // Check parent permissions
    $stmt = $db->prepare("
        SELECT can_manage_profile FROM parent_child_relationships
        WHERE parent_user_id = ? AND child_user_id = ?
    ");
    $stmt->execute([$userId, $profileOwnerId]);
    $parentAccess = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($parentAccess && $parentAccess['can_manage_profile']) return true;

    // Check teacher permissions (teachers can manage student profiles in their classes)
    return canAccessStudentData($userId, $profileOwnerId);
}

/**
 * Get students accessible by a teacher/therapist
 */
function getAccessibleStudents($userId, $organizationId = null, $classId = null) {
    $db = getDB();
    if (!$db) return [];

    // System admins see all students
    if (isSystemAdmin($userId)) {
        $sql = "SELECT DISTINCT u.id, u.name, u.email FROM users u
                JOIN user_organization_roles uor ON u.id = uor.user_id
                WHERE uor.role IN ('student') AND uor.is_active = 1";
        $params = [];

        if ($organizationId) {
            $sql .= " AND uor.organization_id = ?";
            $params[] = $organizationId;
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Get students through teacher assignments
    $sql = "SELECT DISTINCT u.id, u.name, u.email, sta.class_id, c.name as class_name
            FROM users u
            JOIN student_teacher_assignments sta ON u.id = sta.student_user_id
            LEFT JOIN classes c ON sta.class_id = c.id
            WHERE sta.teacher_user_id = ?
              AND (sta.end_date IS NULL OR sta.end_date >= CURDATE())";

    $params = [$userId];

    if ($organizationId) {
        $sql .= " AND sta.organization_id = ?";
        $params[] = $organizationId;
    }

    if ($classId) {
        $sql .= " AND sta.class_id = ?";
        $params[] = $classId;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Get children accessible by a parent
 */
function getAccessibleChildren($userId) {
    $db = getDB();
    if (!$db) return [];

    $stmt = $db->prepare("
        SELECT DISTINCT u.id, u.name, u.email, pcr.relationship_type,
               pcr.can_manage_profile, pcr.can_view_progress
        FROM users u
        JOIN parent_child_relationships pcr ON u.id = pcr.child_user_id
        WHERE pcr.parent_user_id = ?
    ");

    $stmt->execute([$userId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Filter data based on user permissions
 */
function filterDataByPermissions($userId, $data, $dataType = 'profiles') {
    if (isSystemAdmin($userId)) return $data;

    $filtered = [];

    foreach ($data as $item) {
        $canAccess = false;

        switch ($dataType) {
            case 'profiles':
                $canAccess = canManageProfile($userId, $item['id']);
                break;
            case 'users':
                $canAccess = canAccessStudentData($userId, $item['id']);
                break;
            case 'action_logs':
                $canAccess = canAccessStudentData($userId, $item['user_id']);
                break;
            default:
                $canAccess = true; // Default allow for unknown types
        }

        if ($canAccess) {
            $filtered[] = $item;
        }
    }

    return $filtered;
}



/**
 * Check if user can access a specific resource
 */
function canAccessResource($userId, $resourceType, $resourceId, $action = 'view') {
    switch ($resourceType) {
        case 'profile':
            return canManageProfile($userId, $resourceId);
        case 'user':
            return canAccessStudentData($userId, $resourceId);
        case 'organization':
            return isSystemAdmin($userId) || isOrgAdmin($userId, $resourceId);
        case 'class':
            // Check if user is assigned to this class
            $roles = getUserRoles($userId);
            return array_filter($roles, fn($r) => $r['class_id'] == $resourceId);
        default:
            return false;
    }
}
