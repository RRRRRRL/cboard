<?php
/**
 * Admin Routes Handler
 * Admin Panel - User Management
 * 
 * Handles:
 * - List all users (with pagination and filters)
 * - Get user details
 * - Update user (role, status, etc.)
 * - Delete/deactivate users
 * - User statistics
 */

require_once __DIR__ . '/../auth.php';

function handleAdminRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    
    if ($db === null) {
        error_log("Database connection failed in handleAdminRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    // All admin routes require authentication
    $user = requireAuth($authToken);
    
    // All admin routes require admin role
    requireAdmin($user);
    
    // GET /admin/users - List all users with pagination and filters
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'users') {
        try {
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
            $offset = ($page - 1) * $limit;
            
            $search = $_GET['search'] ?? '';
            $role = $_GET['role'] ?? '';
            $isActive = isset($_GET['is_active']) ? (int)$_GET['is_active'] : null;
            
            // Build query
            $sql = "SELECT id, email, name, role, is_active, is_verified, created_at, last_login 
                    FROM users WHERE 1=1";
            $params = [];
            
            if (!empty($search)) {
                $sql .= " AND (email LIKE ? OR name LIKE ?)";
                $searchTerm = "%{$search}%";
                $params[] = $searchTerm;
                $params[] = $searchTerm;
            }
            
            if (!empty($role)) {
                $sql .= " AND role = ?";
                $params[] = $role;
            }
            
            if ($isActive !== null) {
                $sql .= " AND is_active = ?";
                $params[] = $isActive;
            }
            
            // Get total count
            $countSql = "SELECT COUNT(*) as total FROM users WHERE 1=1";
            $countParams = [];
            
            if (!empty($search)) {
                $countSql .= " AND (email LIKE ? OR name LIKE ?)";
                $countParams[] = "%{$search}%";
                $countParams[] = "%{$search}%";
            }
            
            if (!empty($role)) {
                $countSql .= " AND role = ?";
                $countParams[] = $role;
            }
            
            if ($isActive !== null) {
                $countSql .= " AND is_active = ?";
                $countParams[] = $isActive;
            }
            
            $stmt = $db->prepare($countSql);
            $stmt->execute($countParams);
            $total = $stmt->fetch()['total'];
            
            // Get users with pagination
            $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $users = $stmt->fetchAll();
            
            // Get profile count for each user
            foreach ($users as &$userData) {
                $stmt = $db->prepare("SELECT COUNT(*) as count FROM profiles WHERE user_id = ?");
                $stmt->execute([$userData['id']]);
                $userData['profile_count'] = (int)$stmt->fetch()['count'];
            }
            
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
            error_log("Admin list users error: " . $e->getMessage());
            return errorResponse('Failed to fetch users', 500);
        }
    }
    
    // GET /admin/users/{userId} - Get user details
    if ($method === 'GET' && count($pathParts) === 3 && $pathParts[1] === 'users') {
        $userId = (int)$pathParts[2];
        
        try {
            $stmt = $db->prepare("
                SELECT id, email, name, role, is_active, is_verified, created_at, updated_at, last_login
                FROM users 
                WHERE id = ?
            ");
            $stmt->execute([$userId]);
            $userData = $stmt->fetch();
            
            if (!$userData) {
                return errorResponse('User not found', 404);
            }
            
            // Get user's profiles
            $stmt = $db->prepare("
                SELECT id, display_name, description, is_public, created_at
                FROM profiles 
                WHERE user_id = ?
                ORDER BY created_at DESC
            ");
            $stmt->execute([$userId]);
            $profiles = $stmt->fetchAll();
            
            // Get statistics
            $stmt = $db->prepare("SELECT COUNT(*) as count FROM action_logs WHERE user_id = ?");
            $stmt->execute([$userId]);
            $actionLogCount = (int)$stmt->fetch()['count'];
            
            return successResponse([
                'user' => $userData,
                'profiles' => $profiles,
                'statistics' => [
                    'profile_count' => count($profiles),
                    'action_log_count' => $actionLogCount
                ]
            ]);
            
        } catch (Exception $e) {
            error_log("Admin get user error: " . $e->getMessage());
            return errorResponse('Failed to fetch user details', 500);
        }
    }
    
    // PUT /admin/users/{userId} - Update user
    if ($method === 'PUT' && count($pathParts) === 3 && $pathParts[1] === 'users') {
        $userId = (int)$pathParts[2];
        
        try {
            // Check if user exists
            $stmt = $db->prepare("SELECT id FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            if (!$stmt->fetch()) {
                return errorResponse('User not found', 404);
            }
            
            $updates = [];
            $params = [];
            
            // Update name
            if (isset($data['name'])) {
                $updates[] = "name = ?";
                $params[] = $data['name'];
            }
            
            // Update role (admin only)
            if (isset($data['role'])) {
                $allowedRoles = ['admin', 'teacher', 'therapist', 'parent', 'student'];
                if (in_array($data['role'], $allowedRoles)) {
                    $updates[] = "role = ?";
                    $params[] = $data['role'];
                }
            }
            
            // Update is_active
            if (isset($data['is_active'])) {
                $updates[] = "is_active = ?";
                $params[] = (int)$data['is_active'];
            }
            
            // Update is_verified
            if (isset($data['is_verified'])) {
                $updates[] = "is_verified = ?";
                $params[] = (int)$data['is_verified'];
            }
            
            // Update password (if provided)
            if (isset($data['password']) && !empty($data['password'])) {
                require_once __DIR__ . '/../auth.php';
                $passwordHash = Password::hash($data['password']);
                $updates[] = "password_hash = ?";
                $params[] = $passwordHash;
            }
            
            if (empty($updates)) {
                return errorResponse('No fields to update', 400);
            }
            
            $updates[] = "updated_at = NOW()";
            $params[] = $userId;
            
            $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            // Get updated user
            $stmt = $db->prepare("SELECT id, email, name, role, is_active, is_verified, updated_at FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $updatedUser = $stmt->fetch();
            
            return successResponse([
                'success' => true,
                'message' => 'User updated successfully',
                'user' => $updatedUser
            ]);
            
        } catch (Exception $e) {
            error_log("Admin update user error: " . $e->getMessage());
            return errorResponse('Failed to update user', 500);
        }
    }
    
    // DELETE /admin/users/{userId} - Delete/deactivate user
    if ($method === 'DELETE' && count($pathParts) === 3 && $pathParts[1] === 'users') {
        $userId = (int)$pathParts[2];
        
        // Prevent deleting yourself
        if ($userId == $user['id']) {
            return errorResponse('Cannot delete your own account', 400);
        }
        
        try {
            // Check if user exists
            $stmt = $db->prepare("SELECT id, email FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $userData = $stmt->fetch();
            
            if (!$userData) {
                return errorResponse('User not found', 404);
            }
            
            // Soft delete: set is_active = 0 instead of actually deleting
            $stmt = $db->prepare("UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$userId]);
            
            return successResponse([
                'success' => true,
                'message' => 'User deactivated successfully'
            ]);
            
        } catch (Exception $e) {
            error_log("Admin delete user error: " . $e->getMessage());
            return errorResponse('Failed to delete user', 500);
        }
    }
    
    // GET /admin/statistics - Get admin statistics
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'statistics') {
        try {
            // Total users
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM users");
            $stmt->execute();
            $totalUsers = (int)$stmt->fetch()['total'];
            
            // Active users
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM users WHERE is_active = 1");
            $stmt->execute();
            $activeUsers = (int)$stmt->fetch()['total'];
            
            // Users by role
            $stmt = $db->prepare("SELECT role, COUNT(*) as count FROM users GROUP BY role");
            $stmt->execute();
            $usersByRole = [];
            while ($row = $stmt->fetch()) {
                $usersByRole[$row['role']] = (int)$row['count'];
            }
            
            // Total profiles
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM profiles");
            $stmt->execute();
            $totalProfiles = (int)$stmt->fetch()['total'];
            
            // Total action logs
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM action_logs");
            $stmt->execute();
            $totalLogs = (int)$stmt->fetch()['total'];
            
            // Recent registrations (last 30 days)
            $stmt = $db->prepare("
                SELECT COUNT(*) as total 
                FROM users 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ");
            $stmt->execute();
            $recentRegistrations = (int)$stmt->fetch()['total'];
            
            return successResponse([
                'statistics' => [
                    'total_users' => $totalUsers,
                    'active_users' => $activeUsers,
                    'inactive_users' => $totalUsers - $activeUsers,
                    'users_by_role' => $usersByRole,
                    'total_profiles' => $totalProfiles,
                    'total_logs' => $totalLogs,
                    'recent_registrations' => $recentRegistrations
                ]
            ]);
            
        } catch (Exception $e) {
            error_log("Admin statistics error: " . $e->getMessage());
            return errorResponse('Failed to fetch statistics', 500);
        }
    }
    
    return errorResponse('Admin route not found', 404);
}

