<?php
/**
 * Jyutping Matching Rules API Routes Handler
 * 
 * Endpoints:
 * - GET /api/jyutping-rules/matching/{userId} - Get matching rules for a student
 * - PUT /api/jyutping-rules/matching/{userId} - Update matching rules for a student
 * - GET /api/jyutping-rules/exceptions - List all available exception rules
 * - GET /api/jyutping-rules/exceptions/{userId} - Get enabled exception rules for a student
 * - PUT /api/jyutping-rules/exceptions/{userId} - Update exception rules for a student
 */

require_once __DIR__ . '/../auth.php';

function handleJyutpingRulesRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }

    // All routes require authentication
    $user = requireAuth($authToken);
    
    // Check if user has permission (admin, teacher, or therapist)
    $allowedRoles = ['admin', 'teacher', 'therapist'];
    if (!in_array($user['role'], $allowedRoles)) {
        return errorResponse('Insufficient permissions', 403);
    }

    // GET /jyutping-rules/matching/{userId} - Get matching rules for a student
    if ($method === 'GET' && count($pathParts) === 3 && $pathParts[1] === 'matching') {
        $userId = (int)$pathParts[2];
        
        try {
            $profileId = isset($_GET['profile_id']) ? (int)$_GET['profile_id'] : null;
            
            $sql = "SELECT * FROM jyutping_matching_rules 
                    WHERE user_id = ? 
                      AND (profile_id = ? OR (profile_id IS NULL AND ? IS NULL))
                    ORDER BY profile_id DESC
                    LIMIT 1";
            $stmt = $db->prepare($sql);
            $stmt->execute([$userId, $profileId, $profileId]);
            $rule = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$rule) {
                // Return default rules
                return successResponse([
                    'user_id' => $userId,
                    'profile_id' => $profileId,
                    'frequency_threshold' => 50,
                    'allow_exact_match' => true,
                    'allow_substring_match' => true,
                    'allow_single_char_match' => true,
                    'require_ai_correction' => false,
                    'ai_confidence_threshold' => 0.50,
                    'enabled' => true,
                    'is_default' => true,
                    // Phonological adaptation rules (defaults)
                    'merge_n_ng_finals' => false,
                    'allow_coda_simplification' => false,
                    'ignore_tones' => false,
                    'allow_fuzzy_tones' => false,
                    'fuzzy_tone_pairs' => null,
                    'allow_ng_zero_confusion' => false,
                    'allow_n_l_confusion' => false
                ]);
            }
            
            // Convert to boolean
            $rule['allow_exact_match'] = (bool)$rule['allow_exact_match'];
            $rule['allow_substring_match'] = (bool)$rule['allow_substring_match'];
            $rule['allow_single_char_match'] = (bool)$rule['allow_single_char_match'];
            $rule['require_ai_correction'] = (bool)$rule['require_ai_correction'];
            $rule['enabled'] = (bool)$rule['enabled'];
            $rule['is_default'] = false;
            // Phonological adaptation rules
            $rule['merge_n_ng_finals'] = isset($rule['merge_n_ng_finals']) ? (bool)$rule['merge_n_ng_finals'] : false;
            $rule['allow_coda_simplification'] = isset($rule['allow_coda_simplification']) ? (bool)$rule['allow_coda_simplification'] : false;
            $rule['ignore_tones'] = isset($rule['ignore_tones']) ? (bool)$rule['ignore_tones'] : false;
            $rule['allow_fuzzy_tones'] = isset($rule['allow_fuzzy_tones']) ? (bool)$rule['allow_fuzzy_tones'] : false;
            $rule['fuzzy_tone_pairs'] = isset($rule['fuzzy_tone_pairs']) ? $rule['fuzzy_tone_pairs'] : null;
            $rule['allow_ng_zero_confusion'] = isset($rule['allow_ng_zero_confusion']) ? (bool)$rule['allow_ng_zero_confusion'] : false;
            $rule['allow_n_l_confusion'] = isset($rule['allow_n_l_confusion']) ? (bool)$rule['allow_n_l_confusion'] : false;
            
            return successResponse($rule);
            
        } catch (Exception $e) {
            error_log("Get matching rules error: " . $e->getMessage());
            return errorResponse('Failed to get matching rules', 500);
        }
    }

    // PUT /jyutping-rules/matching/{userId} - Update matching rules for a student
    if ($method === 'PUT' && count($pathParts) === 3 && $pathParts[1] === 'matching') {
        $userId = (int)$pathParts[2];
        error_log('Matching rules PUT payload: ' . json_encode($data));
        try {
            // Verify student exists
            $stmt = $db->prepare("SELECT id, role FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$student) {
                return errorResponse('Student not found', 404);
            }
            
            if ($student['role'] !== 'student') {
                return errorResponse('User is not a student', 400);
            }
            
            $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
            
            // Check if rule exists
            $stmt = $db->prepare("SELECT id FROM jyutping_matching_rules 
                                 WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? IS NULL))");
            $stmt->execute([$userId, $profileId, $profileId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existing) {
                // Update existing rule
                $updates = [];
                $params = [];
                
                if (isset($data['frequency_threshold'])) {
                    $updates[] = "frequency_threshold = ?";
                    $params[] = (int)$data['frequency_threshold'];
                }
                if (isset($data['allow_exact_match'])) {
                    $updates[] = "allow_exact_match = ?";
                    $params[] = (int)$data['allow_exact_match'];
                }
                if (isset($data['allow_substring_match'])) {
                    $updates[] = "allow_substring_match = ?";
                    $params[] = (int)$data['allow_substring_match'];
                }
                if (isset($data['allow_single_char_match'])) {
                    $updates[] = "allow_single_char_match = ?";
                    $params[] = (int)$data['allow_single_char_match'];
                }
                if (isset($data['require_ai_correction'])) {
                    $updates[] = "require_ai_correction = ?";
                    $params[] = (int)$data['require_ai_correction'];
                }
                if (isset($data['ai_confidence_threshold'])) {
                    $updates[] = "ai_confidence_threshold = ?";
                    $params[] = (float)$data['ai_confidence_threshold'];
                }
                if (isset($data['enabled'])) {
                    $updates[] = "enabled = ?";
                    $params[] = (int)$data['enabled'];
                }
                // Phonological adaptation rules
                if (isset($data['merge_n_ng_finals'])) {
                    $updates[] = "merge_n_ng_finals = ?";
                    $params[] = (int)$data['merge_n_ng_finals'];
                }
                if (isset($data['allow_coda_simplification'])) {
                    $updates[] = "allow_coda_simplification = ?";
                    $params[] = (int)$data['allow_coda_simplification'];
                }
                if (isset($data['ignore_tones'])) {
                    $updates[] = "ignore_tones = ?";
                    $params[] = (int)$data['ignore_tones'];
                }
                if (isset($data['allow_fuzzy_tones'])) {
                    $updates[] = "allow_fuzzy_tones = ?";
                    $params[] = (int)$data['allow_fuzzy_tones'];
                }
                if (isset($data['fuzzy_tone_pairs'])) {
                    $updates[] = "fuzzy_tone_pairs = ?";
                    $params[] = $data['fuzzy_tone_pairs'];
                }
                if (isset($data['allow_ng_zero_confusion'])) {
                    $updates[] = "allow_ng_zero_confusion = ?";
                    $params[] = (int)$data['allow_ng_zero_confusion'];
                }
                if (isset($data['allow_n_l_confusion'])) {
                    $updates[] = "allow_n_l_confusion = ?";
                    $params[] = (int)$data['allow_n_l_confusion'];
                }
                
                if (empty($updates)) {
                    return errorResponse('No fields to update', 400);
                }
                
                $updates[] = "updated_at = NOW()";
                $params[] = $existing['id'];
                
                $sql = "UPDATE jyutping_matching_rules SET " . implode(', ', $updates) . " WHERE id = ?";
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                
            } else {
                // Create new rule
                $sql = "INSERT INTO jyutping_matching_rules 
                        (user_id, profile_id, frequency_threshold, allow_exact_match, allow_substring_match, 
                        allow_single_char_match, require_ai_correction, ai_confidence_threshold, enabled, created_by,
                        merge_n_ng_finals, allow_coda_simplification, ignore_tones, allow_fuzzy_tones,
                        fuzzy_tone_pairs, allow_ng_zero_confusion, allow_n_l_confusion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $db->prepare($sql);
                $stmt->execute([
                    $userId,
                    $profileId,
                    isset($data['frequency_threshold']) ? (int)$data['frequency_threshold'] : 50,
                    isset($data['allow_exact_match']) ? (int)!empty($data['allow_exact_match']) : 1,
                    isset($data['allow_substring_match']) ? (int)!empty($data['allow_substring_match']) : 1,
                    isset($data['allow_single_char_match']) ? (int)!empty($data['allow_single_char_match']) : 1,
                    isset($data['require_ai_correction']) ? (int)!empty($data['require_ai_correction']) : 0,
                    isset($data['ai_confidence_threshold']) ? (float)$data['ai_confidence_threshold'] : 0.50,
                    isset($data['enabled']) ? (int)!empty($data['enabled']) : 1,
                    $user['id'],
                    isset($data['merge_n_ng_finals']) ? (int)!empty($data['merge_n_ng_finals']) : 0,
                    isset($data['allow_coda_simplification']) ? (int)!empty($data['allow_coda_simplification']) : 0,
                    isset($data['ignore_tones']) ? (int)!empty($data['ignore_tones']) : 0,
                    isset($data['allow_fuzzy_tones']) ? (int)!empty($data['allow_fuzzy_tones']) : 0,
                    array_key_exists('fuzzy_tone_pairs', $data) ? $data['fuzzy_tone_pairs'] : null,
                    isset($data['allow_ng_zero_confusion']) ? (int)!empty($data['allow_ng_zero_confusion']) : 0,
                    isset($data['allow_n_l_confusion']) ? (int)!empty($data['allow_n_l_confusion']) : 0,
                ]);
            }

            
            return successResponse(['message' => 'Matching rules updated successfully']);
            
        } catch (Exception $e) {
            error_log("Update matching rules error: " . $e->getMessage());
            return errorResponse('Failed to update matching rules', 500);
        }
    }

    // GET /jyutping-rules/exceptions - List all available exception rules
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'exceptions') {
        try {
            $category = isset($_GET['category']) ? $_GET['category'] : null;
            
            $sql = "SELECT * FROM jyutping_exception_rules";
            $params = [];
            
            if ($category) {
                $sql .= " WHERE rule_category = ?";
                $params[] = $category;
            }
            
            $sql .= " ORDER BY rule_category, rule_name";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Convert to boolean
            foreach ($rules as &$rule) {
                $rule['default_enabled'] = (bool)$rule['default_enabled'];
                $rule['is_system_rule'] = (bool)$rule['is_system_rule'];
            }
            
            return successResponse(['rules' => $rules]);
            
        } catch (Exception $e) {
            error_log("Get exception rules error: " . $e->getMessage());
            return errorResponse('Failed to get exception rules', 500);
        }
    }

    // GET /jyutping-rules/exceptions/{userId} - Get enabled exception rules for a student
    if ($method === 'GET' && count($pathParts) === 3 && $pathParts[1] === 'exceptions') {
        $userId = (int)$pathParts[2];
        
        try {
            $profileId = isset($_GET['profile_id']) ? (int)$_GET['profile_id'] : null;
            
            // Get all exception rules with their enabled status for this student
            $sql = "SELECT 
                        er.id,
                        er.rule_key,
                        er.rule_name,
                        er.rule_description,
                        er.rule_category,
                        er.default_enabled,
                        er.is_system_rule,
                        COALESCE(ser.enabled, er.default_enabled) as enabled,
                        ser.id as student_rule_id
                    FROM jyutping_exception_rules er
                    LEFT JOIN jyutping_student_exception_rules ser 
                        ON ser.rule_id = er.id 
                        AND ser.user_id = ?
                        AND (ser.profile_id = ? OR (ser.profile_id IS NULL AND ? IS NULL))
                    ORDER BY er.rule_category, er.rule_name";
            
            $stmt = $db->prepare($sql);
            $stmt->execute([$userId, $profileId, $profileId]);
            $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Convert to boolean
            foreach ($rules as &$rule) {
                $rule['default_enabled'] = (bool)$rule['default_enabled'];
                $rule['is_system_rule'] = (bool)$rule['is_system_rule'];
                $rule['enabled'] = (bool)$rule['enabled'];
            }
            
            return successResponse(['rules' => $rules]);
            
        } catch (Exception $e) {
            error_log("Get student exception rules error: " . $e->getMessage());
            return errorResponse('Failed to get student exception rules', 500);
        }
    }

    // PUT /jyutping-rules/exceptions/{userId} - Update exception rules for a student
    if ($method === 'PUT' && count($pathParts) === 3 && $pathParts[1] === 'exceptions') {
        $userId = (int)$pathParts[2];
        
        try {
            // Verify student exists
            $stmt = $db->prepare("SELECT id, role FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$student) {
                return errorResponse('Student not found', 404);
            }
            
            if ($student['role'] !== 'student') {
                return errorResponse('User is not a student', 400);
            }
            
            if (!isset($data['rules']) || !is_array($data['rules'])) {
                return errorResponse('Rules array is required', 400);
            }
            
            $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
            
            $db->beginTransaction();
            
            try {
                foreach ($data['rules'] as $ruleData) {
                    if (!isset($ruleData['rule_id']) || !isset($ruleData['enabled'])) {
                        continue;
                    }
                    
                    $ruleId = (int)$ruleData['rule_id'];
                    $enabled = (int)$ruleData['enabled'];
                    
                    // Check if rule exists
                    $stmt = $db->prepare("SELECT id FROM jyutping_exception_rules WHERE id = ?");
                    $stmt->execute([$ruleId]);
                    if (!$stmt->fetch()) {
                        continue; // Skip invalid rule
                    }
                    
                    // Check if student rule exists
                    $stmt = $db->prepare("SELECT id FROM jyutping_student_exception_rules 
                                         WHERE user_id = ? AND rule_id = ? 
                                         AND (profile_id = ? OR (profile_id IS NULL AND ? IS NULL))");
                    $stmt->execute([$userId, $ruleId, $profileId, $profileId]);
                    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($existing) {
                        // Update existing
                        $stmt = $db->prepare("UPDATE jyutping_student_exception_rules 
                                             SET enabled = ?, updated_at = NOW() 
                                             WHERE id = ?");
                        $stmt->execute([$enabled, $existing['id']]);
                    } else {
                        // Create new
                        $stmt = $db->prepare("INSERT INTO jyutping_student_exception_rules 
                                             (user_id, profile_id, rule_id, enabled, created_by)
                                             VALUES (?, ?, ?, ?, ?)");
                        $stmt->execute([$userId, $profileId, $ruleId, $enabled, $user['id']]);
                    }
                }
                
                $db->commit();
                return successResponse(['message' => 'Exception rules updated successfully']);
                
            } catch (Exception $e) {
                $db->rollBack();
                throw $e;
            }
            
        } catch (Exception $e) {
            error_log("Update exception rules error: " . $e->getMessage());
            return errorResponse('Failed to update exception rules', 500);
        }
    }

    return errorResponse('Route not found', 404);
}

