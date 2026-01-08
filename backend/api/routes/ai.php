<?php
/**
 * AI Routes Handler
 * Sprint 9-10: AI Functionality
 * 
 * Handles:
 * - AI card suggestion
 * - Typing prediction
 * - Jyutping prediction
 * - Adaptive learning system
 * 
 * Current Implementation:
 * - Uses database-based keyword matching (not true AI API)
 * - Can be enhanced with OpenAI, Google Cloud AI, or Azure Cognitive Services
 * - See AI_API_IMPLEMENTATION.md for integration guide
 */

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/ollama.php';

function handleAIRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    
    if ($db === null) {
        error_log("Database connection failed in handleAIRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    /**
     * Helper: Generate a Photocen image for a given user + query and return the stored file URL.
     * This is based on the text-to-image implementation in media.php, but simplified for AI usage.
     *
     * @param array $user Authenticated user array (must contain 'id')
     * @param string $query Text query / context
     * @param PDO|null $db Optional DB connection for media table logging
     * @return string|null Relative URL to stored image (e.g. "api/uploads/user_1/filename.jpg") or null on failure
     */
    function aiGeneratePhotocenImageForUser($user, $query, $db = null) {
        if (!isset($user['id']) || !$user['id']) {
            error_log("aiGeneratePhotocenImageForUser: Missing user ID");
            return null;
        }

        if (!function_exists('curl_init')) {
            error_log("aiGeneratePhotocenImageForUser: cURL extension is not available");
            return null;
        }

        $query = trim($query);
        if ($query === '') {
            return null;
        }

        try {
            $photocenUrl   = 'https://photocen.com/api.php';
            $encodedQuery  = urlencode($query);

            // First try simple GET ?query=... (same approach as media.php)
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL            => $photocenUrl . '?query=' . $encodedQuery,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 60, // Increased to 60 seconds for image generation
                CURLOPT_CONNECTTIMEOUT => 20, // Increased connection timeout
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 5,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_2_0,
                CURLOPT_HTTPHEADER     => [
                    'Accept: application/json, text/plain, */*',
                    'Accept-Language: en-US,en;q=0.9',
                    'Cache-Control: no-cache'
                ]
            ]);

            $response  = curl_exec($ch);
            $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError || $httpCode !== 200 || !$response) {
                error_log("aiGeneratePhotocenImageForUser GET failed: HTTP $httpCode, " . ($curlError ?: 'Unknown error'));
                return null;
            }

            $response  = trim($response);
            $imageUrl  = null;
            $imageData = null;

            // Try JSON format first
            $jsonResponse = json_decode($response, true);
            if (json_last_error() === JSON_ERROR_NONE && $jsonResponse) {
                if (isset($jsonResponse['success']) && $jsonResponse['success'] === true &&
                    isset($jsonResponse['result']) && is_array($jsonResponse['result']) && count($jsonResponse['result']) > 0) {
                    $firstImage = $jsonResponse['result'][0];
                    if (!empty($firstImage['originalUrl'])) {
                        $imageUrl = $firstImage['originalUrl'];
                    } elseif (!empty($firstImage['previewUrl'])) {
                        $imageUrl = $firstImage['previewUrl'];
                    }
                } elseif (!empty($jsonResponse['url'])) {
                    $imageUrl = $jsonResponse['url'];
                } elseif (!empty($jsonResponse['image']) || !empty($jsonResponse['data'])) {
                    $imageData = $jsonResponse['image'] ?? $jsonResponse['data'];
                }
            } elseif (filter_var($response, FILTER_VALIDATE_URL)) {
                $imageUrl = $response;
            } elseif (preg_match('/^data:image\//', $response)) {
                $imageData = $response;
            }

            // Download image if we only have URL
            if ($imageUrl && !$imageData) {
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL            => $imageUrl,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT        => 60, // Increased to 60 seconds for image download
                    CURLOPT_CONNECTTIMEOUT => 20, // Increased connection timeout
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS      => 5,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => false
                ]);
                $imageData    = curl_exec($ch);
                $imageHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $imageCurlError = curl_error($ch);
                curl_close($ch);

                if ($imageCurlError || $imageHttpCode !== 200 || !$imageData) {
                    error_log("aiGeneratePhotocenImageForUser: Failed to download image: HTTP $imageHttpCode, " . ($imageCurlError ?: 'No data'));
                    return null;
                }
            }

            if (!$imageData) {
                error_log("aiGeneratePhotocenImageForUser: No image data received for query '$query'");
                return null;
            }

            // Save image under user uploads
            $userId    = (int)$user['id'];
            $uploadDir = __DIR__ . '/../../uploads/user_' . $userId . '/';

            if (!is_dir($uploadDir)) {
                if (!@mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
                    error_log("aiGeneratePhotocenImageForUser: Failed to create upload directory $uploadDir");
                    return null;
                }
            }

            if (!is_writable($uploadDir)) {
                error_log("aiGeneratePhotocenImageForUser: Upload directory not writable: $uploadDir");
                return null;
            }

            // Guess extension from URL or default to jpg
            $extension = 'jpg';
            if ($imageUrl) {
                $parsedUrl = parse_url($imageUrl);
                $path      = $parsedUrl['path'] ?? '';
                if (preg_match('/\.(jpg|jpeg|png|gif|webp)$/i', $path, $matches)) {
                    $extension = strtolower($matches[1]);
                    if ($extension === 'jpeg') {
                        $extension = 'jpg';
                    }
                }
            }

            $filename = 'photocen_ai_' . uniqid() . '.' . $extension;
            $filePath = $uploadDir . $filename;

            if (file_put_contents($filePath, $imageData) === false) {
                error_log("aiGeneratePhotocenImageForUser: Failed to save image $filePath");
                return null;
            }

            if (!file_exists($filePath)) {
                error_log("aiGeneratePhotocenImageForUser: File not found after write $filePath");
                return null;
            }

            $fileUrl = 'api/uploads/user_' . $userId . '/' . $filename;

            // Optional: log into media table (non-fatal if it fails)
            if ($db) {
                try {
                    $fileSize = filesize($filePath);
                    $mimeType = 'image/' . ($extension === 'jpg' ? 'jpeg' : $extension);
                    $stmt = $db->prepare("
                        INSERT INTO media (user_id, filename, original_filename, file_path, file_url, file_type, file_size, mime_type, created_at)
                        VALUES (?, ?, ?, ?, ?, 'image', ?, ?, NOW())
                    ");
                    $stmt->execute([
                        $userId,
                        $filename,
                        'photocen-ai-' . $query . '.' . $extension,
                        $filePath,
                        $fileUrl,
                        $fileSize,
                        $mimeType
                    ]);
                } catch (Exception $e) {
                    error_log("aiGeneratePhotocenImageForUser: media insert error: " . $e->getMessage());
                }
            }

            return $fileUrl;
        } catch (Exception $e) {
            error_log("aiGeneratePhotocenImageForUser: Exception " . $e->getMessage());
            return null;
        }
    }

    // POST /ai/suggest-cards - AI card suggestion based on context
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'suggest-cards') {
        $user = requireAuth($authToken);
        $context = $data['context'] ?? ''; // Text context or previous cards
        // 原設計使用 profile_id，現新增 board_id，優先以 board 維度作為「溝通 profile」
        $profileId = $data['profile_id'] ?? null;
        $boardId = $data['board_id'] ?? null;
        $limit = isset($data['limit']) ? (int)$data['limit'] : 10;
        
        try {
            // Get user's frequently used cards for context
            $frequentCards = [];
            if ($boardId) {
                // 以板(board)為單位統計常用卡
                $stmt = $db->prepare("
                    SELECT c.id, c.title, c.label_text, c.category, COUNT(al.id) as usage_count
                    FROM cards c
                    INNER JOIN profile_cards pc ON c.id = pc.card_id
                    LEFT JOIN action_logs al ON c.id = al.card_id AND al.board_id = ?
                    WHERE pc.board_id = ?
                    GROUP BY c.id
                    ORDER BY usage_count DESC, c.title ASC
                    LIMIT ?
                ");
                $stmt->execute([$boardId, $boardId, $limit * 2]);
                $frequentCards = $stmt->fetchAll();
            } elseif ($profileId) {
                // 兼容舊邏輯：以 profile_id 為單位
                $stmt = $db->prepare("
                    SELECT c.id, c.title, c.label_text, c.category, COUNT(al.id) as usage_count
                    FROM cards c
                    INNER JOIN profile_cards pc ON c.id = pc.card_id
                    LEFT JOIN action_logs al ON c.id = al.card_id AND al.profile_id = ?
                    WHERE pc.profile_id = ?
                    GROUP BY c.id
                    ORDER BY usage_count DESC, c.title ASC
                    LIMIT ?
                ");
                $stmt->execute([$profileId, $profileId, $limit * 2]);
                $frequentCards = $stmt->fetchAll();
            }
            
            // Use AI to generate card suggestions based on context
            $suggestions = [];
            if (!empty($context)) {
                // First, get available cards for the profile/board
                $availableCards = [];
                if ($boardId) {
                    $stmt = $db->prepare("
                        SELECT DISTINCT c.id, c.title, c.label_text, c.category, c.image_path
                        FROM cards c
                        INNER JOIN profile_cards pc ON c.id = pc.card_id
                        WHERE pc.board_id = ?
                        LIMIT 200
                    ");
                    $stmt->execute([$boardId]);
                    $availableCards = $stmt->fetchAll();
                } elseif ($profileId) {
                    $stmt = $db->prepare("
                        SELECT DISTINCT c.id, c.title, c.label_text, c.category, c.image_path
                        FROM cards c
                        INNER JOIN profile_cards pc ON c.id = pc.card_id
                        WHERE pc.profile_id = ?
                        LIMIT 200
                    ");
                    $stmt->execute([$profileId]);
                    $availableCards = $stmt->fetchAll();
                }
                
                // NOTE: Removed old AI suggestion matching logic that would return existing profile cards
                // We now use Photocen to generate NEW cards, so we don't want to match existing cards
                // The Photocen flow below will generate fresh card suggestions
            }
            
            // NEW: Enhanced Photocen flow with Llama translation and keyword generation
            // If we still have room and there is context, use Llama to translate and generate keywords
            if (!empty($context) && count($suggestions) < $limit) {
                $processStartTime = microtime(true);
                error_log("[AI SUGGESTION] ===== Starting enhanced Photocen flow =====");
                error_log("[AI SUGGESTION] Input context: " . substr($context, 0, 200));
                error_log("[AI SUGGESTION] Profile ID: " . ($profileId ?? 'N/A'));
                error_log("[AI SUGGESTION] User ID: " . ($user['id'] ?? 'N/A'));
                
                try {
                    // Step 1: Get meaning/gloss in English (preserve idioms) using Llama
                    error_log("[AI SUGGESTION] Step 1: Getting English gloss/meaning...");
                    $translationStartTime = microtime(true);
                    $translationPrompt = "Provide a concise English meaning/gloss for the following text. Assume it may be Cantonese. If it is an idiom/proverb/歇後語/俚語/俗語/set phrase/proper noun, return the established English gloss (the meaning). If no common gloss exists, return the original text unchanged. Do NOT literalize component words and do NOT add explanations. Return only the meaning/gloss or the original text:\n\n" . $context;
                    $translationResult = callOllamaAI($translationPrompt, null, null, ['temperature' => 0.3]);
                    $translationDuration = round((microtime(true) - $translationStartTime) * 1000, 2);
                    
                    error_log("[AI SUGGESTION] Translation completed in {$translationDuration}ms");
                    error_log("[AI SUGGESTION] Translation result success: " . ($translationResult['success'] ? 'true' : 'false'));
                    if (isset($translationResult['duration'])) {
                        error_log("[AI SUGGESTION] Translation API duration: {$translationResult['duration']}ms");
                    }
                    if (isset($translationResult['error'])) {
                        error_log("[AI SUGGESTION] Translation error: " . $translationResult['error']);
                    }
                    
                    $englishContext = $context; // Fallback to original if translation fails
                    if ($translationResult['success'] && !empty($translationResult['content'])) {
                        $englishContext = trim($translationResult['content']);
                        error_log("[AI SUGGESTION] ✓ English gloss: '{$context}' -> '{$englishContext}'");
                    } else {
                        error_log("[AI SUGGESTION] ✗ Gloss failed, using original context");
                    }

                    // Preserve original CJK text alongside gloss to help keyword generation
                    $hasCjk = preg_match('/[\x{4e00}-\x{9fff}]/u', $context) === 1;
                    if ($hasCjk && mb_strpos($englishContext, $context) === false) {
                        $englishContext = trim($englishContext . ' / ' . $context);
                        error_log("[AI SUGGESTION] Appended original CJK text to gloss for richer context");
                    }
                    
                    // Step 2: Generate 3 keywords using Llama
                    error_log("[AI SUGGESTION] Step 2: Generating keywords...");
                    $keywordStartTime = microtime(true);
                    $keywordPrompt = "Based on the following context, generate exactly 3 relevant keywords or short phrases (each 1-3 words) that would be useful for generating images. Return only the keywords, one per line, no numbering or bullets:\n\nContext: {$englishContext}\n\nUser prompt: {$context}";
                    $keywordResult = callOllamaAI($keywordPrompt, null, null, ['temperature' => 0.7, 'max_tokens' => 100]);
                    $keywordDuration = round((microtime(true) - $keywordStartTime) * 1000, 2);
                    
                    error_log("[AI SUGGESTION] Keyword generation completed in {$keywordDuration}ms");
                    error_log("[AI SUGGESTION] Keyword result success: " . ($keywordResult['success'] ? 'true' : 'false'));
                    if (isset($keywordResult['duration'])) {
                        error_log("[AI SUGGESTION] Keyword API duration: {$keywordResult['duration']}ms");
                    }
                    if (isset($keywordResult['error'])) {
                        error_log("[AI SUGGESTION] Keyword generation error: " . $keywordResult['error']);
                    }
                    
                    $keywords = [];
                    if ($keywordResult['success'] && !empty($keywordResult['content'])) {
                        error_log("[AI SUGGESTION] Raw keyword response: " . substr($keywordResult['content'], 0, 200));
                        $lines = explode("\n", trim($keywordResult['content']));
                        foreach ($lines as $line) {
                            $line = trim($line);
                            // Remove numbering, bullets, dashes
                            $line = preg_replace('/^[\d\-\*\.\s]+/', '', $line);
                            $line = trim($line);
                            if (!empty($line) && strlen($line) <= 50) {
                                $keywords[] = $line;
                            }
                            if (count($keywords) >= 3) break;
                        }
                        error_log("[AI SUGGESTION] ✓ Generated keywords: " . json_encode($keywords));
                    } else {
                        error_log("[AI SUGGESTION] ✗ Keyword generation failed or empty");
                    }
                    
                    // If no keywords generated, use English context as single keyword
                    if (empty($keywords)) {
                        $keywords = [mb_substr($englishContext, 0, 30)];
                        error_log("[AI SUGGESTION] Using fallback keyword: " . $keywords[0]);
                    }
                    
                    // Step 3: Get user language from profile or settings
                    error_log("[AI SUGGESTION] Step 3: Detecting user language...");
                    $userLanguage = 'en'; // Default
                    if ($profileId) {
                        $stmt = $db->prepare("SELECT language FROM profiles WHERE id = ?");
                        $stmt->execute([$profileId]);
                        $profile = $stmt->fetch();
                        if ($profile && !empty($profile['language'])) {
                            $userLanguage = $profile['language'];
                            error_log("[AI SUGGESTION] User language from profile: {$userLanguage}");
                        }
                    }
                    if ($userLanguage === 'en') {
                        // Try to get from user settings
                        $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
                        $stmt->execute([$user['id']]);
                        $settingsRow = $stmt->fetch();
                        if ($settingsRow && $settingsRow['settings_data']) {
                            $settings = json_decode($settingsRow['settings_data'], true);
                            if (isset($settings['language']['lang'])) {
                                $userLanguage = $settings['language']['lang'];
                                error_log("[AI SUGGESTION] User language from settings: {$userLanguage}");
                            } elseif (isset($settings['speech']['language'])) {
                                $userLanguage = $settings['speech']['language'];
                                error_log("[AI SUGGESTION] User language from speech settings: {$userLanguage}");
                            }
                        }
                    }
                    error_log("[AI SUGGESTION] Final user language: {$userLanguage}");
                    
                    // Step 4: Generate Photocen images for each keyword
                    error_log("[AI SUGGESTION] Step 4: Generating Photocen images for " . count($keywords) . " keywords...");
                    $remaining = $limit - count($suggestions);
                    $photocenSuggestions = [];
                    
                    foreach (array_slice($keywords, 0, min(3, $remaining)) as $index => $keyword) {
                        error_log("[AI SUGGESTION] Processing keyword " . ($index + 1) . "/" . min(3, $remaining) . ": '{$keyword}'");
                        $imageStartTime = microtime(true);
                        $imageUrl = aiGeneratePhotocenImageForUser($user, $keyword, $db);
                        $imageDuration = round((microtime(true) - $imageStartTime) * 1000, 2);
                        
                        if ($imageUrl) {
                            error_log("[AI SUGGESTION] ✓ Image generated for '{$keyword}' in {$imageDuration}ms: {$imageUrl}");
                            
                            // Step 5: Translate keyword back to user language if needed
                            $displayTitle = $keyword;
                            if ($userLanguage !== 'en' && $userLanguage !== 'en-US' && $userLanguage !== 'en-GB') {
                                error_log("[AI SUGGESTION] Step 5: Translating title to {$userLanguage}...");
                                $titleStartTime = microtime(true);
                                $titleTranslationPrompt = "Translate the following English word or phrase to the user's language. Only return the translation, nothing else. User language code: {$userLanguage}\n\nEnglish: {$keyword}";
                                $titleResult = callOllamaAI($titleTranslationPrompt, null, null, ['temperature' => 0.3]);
                                $titleDuration = round((microtime(true) - $titleStartTime) * 1000, 2);
                                
                                error_log("[AI SUGGESTION] Title translation completed in {$titleDuration}ms");
                                if ($titleResult['success'] && !empty($titleResult['content'])) {
                                    $displayTitle = trim($titleResult['content']);
                                    error_log("[AI SUGGESTION] ✓ Translated title: '{$keyword}' -> '{$displayTitle}' (lang: {$userLanguage})");
                                } else {
                                    error_log("[AI SUGGESTION] ✗ Title translation failed, using original keyword");
                                }
                            } else {
                                error_log("[AI SUGGESTION] Skipping title translation (user language is English)");
                            }
                            
                            $photocenSuggestions[] = [
                                'id'         => null,
                                'title'      => $displayTitle,
                                'label_text' => $displayTitle,
                                'keyword'    => $keyword, // Keep original English keyword for backend reference
                                'translated_keyword' => $displayTitle, // Translated keyword in user language
                                'image_path' => $imageUrl,
                                'source'     => 'photocen'
                            ];
                        } else {
                            error_log("[AI SUGGESTION] ✗ Failed to generate image for '{$keyword}' after {$imageDuration}ms");
                        }
                    }
                    
                    // Merge photocen suggestions
                    $suggestions = array_merge($suggestions, $photocenSuggestions);
                    $totalDuration = round((microtime(true) - $processStartTime) * 1000, 2);
                    error_log("[AI SUGGESTION] ===== Enhanced Photocen flow completed in {$totalDuration}ms =====");
                    error_log("[AI SUGGESTION] Total suggestions generated: " . count($photocenSuggestions));
                    
                } catch (Exception $e) {
                    $totalDuration = round((microtime(true) - $processStartTime) * 1000, 2);
                    error_log("[AI SUGGESTION] ✗✗✗ Enhanced Photocen flow error after {$totalDuration}ms: " . $e->getMessage());
                    error_log("[AI SUGGESTION] Stack trace: " . $e->getTraceAsString());
                    // Fallback to simple Photocen call
                    error_log("[AI SUGGESTION] Falling back to simple Photocen call...");
                    $imageUrl = aiGeneratePhotocenImageForUser($user, $context, $db);
                    if ($imageUrl) {
                        $suggestions[] = [
                            'id'         => null,
                            'title'      => mb_substr($context, 0, 80),
                            'label_text' => $context,
                            'category'   => 'AI Proposal (Photocen)',
                            'image_path' => $imageUrl,
                            'source'     => 'photocen'
                        ];
                        error_log("[AI SUGGESTION] Fallback Photocen call succeeded");
                    } else {
                        error_log("[AI SUGGESTION] Fallback Photocen call also failed");
                    }
                }
            }

            // If no context-based suggestions at all, use frequent cards
            if (empty($suggestions) && !empty($frequentCards)) {
                $suggestions = array_slice($frequentCards, 0, $limit);
            }
            
            // If still no suggestions, get popular cards
            if (empty($suggestions)) {
                $stmt = $db->prepare("
                    SELECT DISTINCT c.id, c.title, c.label_text, c.category, c.image_path
                    FROM cards c
                    INNER JOIN action_logs al ON c.id = al.card_id
                    GROUP BY c.id
                    ORDER BY COUNT(al.id) DESC
                    LIMIT ?
                ");
                $stmt->execute([$limit]);
                $suggestions = $stmt->fetchAll();
            }
            
            return successResponse([
                'suggestions' => $suggestions,
                'count' => count($suggestions)
            ]);
            
        } catch (Exception $e) {
            error_log("AI card suggestion error: " . $e->getMessage());
            return errorResponse('Failed to get card suggestions', 500);
        }
    }
    
    // POST /ai/typing-prediction - Predict next characters/words while typing
    // Note: This endpoint is allowed for unauthenticated users (guests) so that
    // typing prediction can work without login. When no user is available, user
    // history is simply not used in the context.
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'typing-prediction') {
        $user = null;
        if ($authToken) {
            try {
                $user = requireAuth($authToken);
            } catch (Exception $e) {
                // If authentication fails, continue as guest (no user context)
                error_log("Typing prediction guest mode (auth failed): " . $e->getMessage());
                $user = null;
            }
        }
        $input = $data['input'] ?? ''; // Current typed text
        $language = $data['language'] ?? 'en';
        $limit = isset($data['limit']) ? (int)$data['limit'] : 5;
        $context = $data['context'] ?? []; // Optional context (previous words, history, etc.)
        
        if (empty($input)) {
            return errorResponse('Input text is required', 400);
        }
        
        try {
            $predictions = [];
            
            // Try AI prediction first using middleware API for better results
            try {
                // Build context from user history if available
                $predictionContext = [];
                if (!empty($context)) {
                    $predictionContext = $context;
                } else if ($user && isset($user['id'])) {
                    // Try to get recent user input history from database
                    try {
                        // Include created_at in SELECT to satisfy MySQL strict mode with ORDER BY
                        $stmt = $db->prepare("
                            SELECT DISTINCT metadata, created_at
                            FROM action_logs
                            WHERE user_id = ? 
                            AND action_type IN ('card_select', 'phrase_speak')
                            AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                            ORDER BY created_at DESC
                            LIMIT 10
                        ");
                        $stmt->execute([$user['id']]);
                        $recentActions = $stmt->fetchAll();
                        
                        if (!empty($recentActions)) {
                            $userHistory = [];
                            foreach ($recentActions as $action) {
                                $metadata = json_decode($action['metadata'], true);
                                if (isset($metadata['text']) || isset($metadata['label_text'])) {
                                    $userHistory[] = $metadata['text'] ?? $metadata['label_text'] ?? '';
                                }
                            }
                            if (!empty($userHistory)) {
                                $predictionContext['user_history'] = array_filter($userHistory);
                            }
                        }
                    } catch (Exception $e) {
                        // Ignore history fetch errors
                        error_log("Failed to fetch user history: " . $e->getMessage());
                    }
                }
                
                $aiPredictions = predictText($input, $language, $limit, $predictionContext);
                if (!empty($aiPredictions)) {
                    foreach ($aiPredictions as $pred) {
                        $predictions[] = [
                            'text' => $pred,
                            'confidence' => 0.85, // AI predictions have high confidence
                            'source' => 'ai'
                        ];
                    }
                }
            } catch (Exception $e) {
                error_log("AI prediction error: " . $e->getMessage());
                // Fall through to database-based prediction
            }
            
            // Fallback to database-based prediction ONLY for Chinese/Cantonese (Jyutping).
            // For other languages (e.g. English), we rely solely on the middleware AI
            // and do NOT use user card data for predictions, as requested.
            if (count($predictions) < $limit && ($language === 'zh' || $language === 'yue')) {
                // For Chinese/Cantonese, use Jyutping dictionary
                $stmt = $db->prepare("
                    SELECT DISTINCT hanzi, jyutping_code, word, frequency
                    FROM jyutping_dictionary
                    WHERE jyutping_code LIKE ?
                    ORDER BY frequency DESC
                    LIMIT ?
                ");
                $searchTerm = $input . '%';
                $stmt->execute([$searchTerm, $limit]);
                $jyutpingResults = $stmt->fetchAll();
                
                $existingTexts = array_column($predictions, 'text');
                foreach ($jyutpingResults as $result) {
                    $text = $result['hanzi'] ?? $result['word'] ?? '';
                    if (!in_array($text, $existingTexts) && count($predictions) < $limit) {
                        $predictions[] = [
                            'text' => $text,
                            'jyutping' => $result['jyutping_code'],
                            'confidence' => min(1.0, $result['frequency'] / 1000),
                            'source' => 'database'
                        ];
                    }
                }
            }
            
            return successResponse([
                'input' => $input,
                'predictions' => $predictions,
                'count' => count($predictions)
            ]);
            
        } catch (Exception $e) {
            error_log("Typing prediction error: " . $e->getMessage());
            return errorResponse('Failed to get typing predictions', 500);
        }
    }
    
    // POST /ai/jyutping-prediction - Predict Jyutping from partial input
    // Uses Ollama (via predictText with language 'yue') as primary source,
    // and falls back to the jyutping_dictionary table when needed.
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'jyutping-prediction') {
        $user = requireAuth($authToken);
        $input = $data['input'] ?? ''; // Partial Jyutping input (e.g. "seoi", "seoi2")
        $limit = isset($data['limit']) ? (int)$data['limit'] : 10;
        
        if (empty($input)) {
            return errorResponse('Input is required', 400);
        }
        
        try {
            // Check if jyutping_dictionary table exists (needed for mapping)
            $stmt = $db->prepare("SHOW TABLES LIKE 'jyutping_dictionary'");
            $stmt->execute();
            $tableExists = $stmt->fetch();
            
            if (!$tableExists) {
                error_log("jyutping_dictionary table does not exist");
                return successResponse([
                    'input' => $input,
                    'predictions' => [],
                    'count' => 0,
                    'message' => 'Jyutping dictionary not available. Please initialize the database.'
                ]);
            }
            
            $predictions = [];
            
            // 1) Try AI-based prediction first, using language 'yue' so the model
            // knows to work with Cantonese / Traditional Chinese context.
            try {
                $predictionContext = [];
                if ($user && isset($user['id'])) {
                    // Optionally include recent user history as context (text, not Jyutping codes)
                    try {
                        $stmt = $db->prepare("
                            SELECT DISTINCT metadata, created_at
                            FROM action_logs
                            WHERE user_id = ? 
                              AND action_type IN ('card_select', 'phrase_speak')
                              AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                            ORDER BY created_at DESC
                            LIMIT 10
                        ");
                        $stmt->execute([$user['id']]);
                        $recentActions = $stmt->fetchAll();
                        
                        if (!empty($recentActions)) {
                            $userHistory = [];
                            foreach ($recentActions as $action) {
                                $metadata = json_decode($action['metadata'], true);
                                if (isset($metadata['text']) || isset($metadata['label_text'])) {
                                    $userHistory[] = $metadata['text'] ?? $metadata['label_text'] ?? '';
                                }
                            }
                            if (!empty($userHistory)) {
                                $predictionContext['user_history'] = array_filter($userHistory);
                            }
                        }
                    } catch (Exception $e) {
                        error_log("Failed to fetch user history for Jyutping prediction: " . $e->getMessage());
                    }
                }
                
                // Ask AI for likely words/phrases given partial Jyutping
                $aiTexts = predictText($input, 'yue', $limit, $predictionContext);
                
                if (!empty($aiTexts)) {
                    foreach ($aiTexts as $text) {
                        // Try to map AI-suggested Hanzi/word back to our jyutping_dictionary
                        $stmt = $db->prepare("
                            SELECT hanzi, jyutping_code, word, frequency
                            FROM jyutping_dictionary
                            WHERE hanzi = ? OR word = ?
                            ORDER BY frequency DESC
                            LIMIT 1
                        ");
                        $stmt->execute([$text, $text]);
                        $row = $stmt->fetch();
                        
                        // Only accept rows that have a non-empty Jyutping code with tone (letter+digit)
                        if ($row && !empty($row['jyutping_code']) && preg_match('/[1-6]$/', $row['jyutping_code'])) {
                            $predictions[] = [
                                'character' => $row['hanzi'] ?? $row['word'] ?? $text,
                                'jyutping'  => $row['jyutping_code'],
                                'meaning'   => $row['word'] ?? $row['hanzi'] ?? '',
                                'frequency' => (int)$row['frequency']
                            ];
                        }
                        
                        if (count($predictions) >= $limit) {
                            break;
                        }
                    }
                }
            } catch (Exception $e) {
                // If AI fails, fall back to pure database prediction
                error_log("Jyutping AI prediction error: " . $e->getMessage());
            }
            
            // 2) Fallback / top-up from jyutping_dictionary based on partial Jyutping code
            if (count($predictions) < $limit) {
                $remaining = $limit - count($predictions);
                
                $stmt = $db->prepare("
                    SELECT hanzi, jyutping_code, word, frequency
                    FROM jyutping_dictionary
                    WHERE jyutping_code LIKE ?
                    ORDER BY frequency DESC, jyutping_code ASC
                    LIMIT ?
                ");
                $searchTerm = $input . '%';
                $stmt->execute([$searchTerm, $remaining]);
                $results = $stmt->fetchAll();
                
                // Avoid duplicates by (character + jyutping)
                $seenKeys = [];
                foreach ($predictions as $p) {
                    $key = ($p['character'] ?? '') . '|' . ($p['jyutping'] ?? '');
                    $seenKeys[$key] = true;
                }
                
                foreach ($results as $result) {
                    $char = $result['hanzi'] ?? $result['word'] ?? '';
                    $jyut = $result['jyutping_code'];
                    $key  = $char . '|' . $jyut;
                    if (isset($seenKeys[$key])) {
                        continue;
                    }
                    $seenKeys[$key] = true;
                    
                    $predictions[] = [
                        'character' => $char,
                        'jyutping'  => $jyut,
                        'meaning'   => $result['word'] ?? $result['hanzi'] ?? '',
                        'frequency' => (int)$result['frequency']
                    ];
                    
                    if (count($predictions) >= $limit) {
                        break;
                    }
                }
            }
            
            return successResponse([
                'input' => $input,
                'predictions' => $predictions,
                'count' => count($predictions)
            ]);
            
        } catch (Exception $e) {
            error_log("Jyutping prediction error: " . $e->getMessage());
            return errorResponse('Failed to get Jyutping predictions', 500);
        }
    }
    
    // POST /ai/adaptive-learning - Update adaptive learning data
    // Note: jyutping_learning_log table structure:
    // - attempt_count (not attempts)
    // - is_correct (not correct_count)
    // - No card_id or difficulty_level columns
    // This endpoint logs the data but doesn't update jyutping_learning_log directly
    // Adaptive learning difficulty is calculated from game results and jyutping_learning_log analysis
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'adaptive-learning') {
        $user = requireAuth($authToken);
        $profileId = $data['profile_id'] ?? null;
        $cardId = $data['card_id'] ?? null;
        $difficulty = $data['difficulty'] ?? null; // 'easy', 'medium', 'hard'
        $performance = $data['performance'] ?? null; // 'correct', 'incorrect', 'skipped'
        
        if (!$profileId || !$cardId) {
            return errorResponse('Profile ID and Card ID are required', 400);
        }
        
        try {
            // Log the adaptive learning data for analysis
            // The actual difficulty adjustment is handled by the difficulty-adjustment endpoint
            // which analyzes game results and jyutping_learning_log data
            error_log("Adaptive learning update: user_id={$user['id']}, profile_id=$profileId, card_id=$cardId, difficulty=$difficulty, performance=$performance");
            
            // Return success - difficulty adjustment is calculated dynamically from existing data
            return successResponse([
                'success' => true,
                'message' => 'Learning data logged (difficulty adjustment calculated from game results and learning log)'
            ]);
            
        } catch (Exception $e) {
            error_log("Adaptive learning update error: " . $e->getMessage());
            return errorResponse('Failed to update learning data', 500);
        }
    }
    
    // GET /ai/learning-stats - Get adaptive learning statistics
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'learning-stats') {
        $user = requireAuth($authToken);
        $profileId = $_GET['profile_id'] ?? null;
        
        try {
            // Use correct column names from jyutping_learning_log table:
            // - Each record represents one attempt (attempt_count = 1 for new records)
            // - is_correct indicates if the attempt was correct
            // - COUNT(*) = total attempts (each record is one attempt)
            $sql = "
                SELECT 
                    COUNT(DISTINCT jyutping_code) as total_codes,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as total_correct,
                    COUNT(*) as total_records,
                    ROUND(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as avg_accuracy
                FROM jyutping_learning_log
                WHERE user_id = ?
            ";
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND profile_id = ?";
                $params[] = $profileId;
            }
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $stats = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return successResponse([
                'stats' => [
                    'total_codes' => (int)($stats['total_codes'] ?? 0),
                    'total_attempts' => (int)($stats['total_attempts'] ?? 0),
                    'total_correct' => (int)($stats['total_correct'] ?? 0),
                    'total_records' => (int)($stats['total_records'] ?? 0),
                    'avg_accuracy' => round((float)($stats['avg_accuracy'] ?? 0), 2)
                ]
            ]);
            
        } catch (Exception $e) {
            error_log("Learning stats error: " . $e->getMessage());
            error_log("Learning stats SQL: " . $sql);
            error_log("Learning stats params: " . json_encode($params));
            return errorResponse('Failed to get learning stats: ' . $e->getMessage(), 500);
        }
    }
    
    // GET /ai/learning-model - Get user-level learning model (common mistakes tracking)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'learning-model') {
        $user = requireAuth($authToken);
        $profileId = $_GET['profile_id'] ?? null;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        
        try {
            // Get common mistakes from jyutping_learning_log
            // Each record represents one attempt, so COUNT(*) = number of attempts
            $sql = "
                SELECT 
                    jll.jyutping_code,
                    jll.hanzi_expected,
                    jll.hanzi_selected,
                    COUNT(*) as mistake_count,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN jll.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                    MAX(jll.created_at) as last_attempted
                FROM jyutping_learning_log jll
                WHERE jll.user_id = ?
                  AND jll.is_correct = 0
                  AND jll.hanzi_expected IS NOT NULL
                  AND jll.hanzi_selected IS NOT NULL
            ";
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND jll.profile_id = ?";
                $params[] = $profileId;
            }
            
            $sql .= "
                GROUP BY jll.jyutping_code, jll.hanzi_expected, jll.hanzi_selected
                ORDER BY mistake_count DESC, last_attempted DESC
                LIMIT ?
            ";
            $params[] = $limit;
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $commonMistakes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get overall accuracy by jyutping_code
            $sql2 = "
                SELECT 
                    jyutping_code,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                    ROUND(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as accuracy_percent
                FROM jyutping_learning_log
                WHERE user_id = ?
            ";
            $params2 = [$user['id']];
            
            if ($profileId) {
                $sql2 .= " AND profile_id = ?";
                $params2[] = $profileId;
            }
            
            $sql2 .= "
                GROUP BY jyutping_code
                HAVING total_attempts >= 3
                ORDER BY accuracy_percent ASC, total_attempts DESC
                LIMIT ?
            ";
            $params2[] = $limit;
            
            $stmt2 = $db->prepare($sql2);
            $stmt2->execute($params2);
            $weakAreas = $stmt2->fetchAll(PDO::FETCH_ASSOC);
            
            return successResponse([
                'common_mistakes' => $commonMistakes,
                'weak_areas' => $weakAreas,
                'model_updated_at' => date('Y-m-d H:i:s')
            ]);
            
        } catch (Exception $e) {
            error_log("Learning model error: " . $e->getMessage());
            return errorResponse('Failed to get learning model', 500);
        }
    }
    
    // GET /ai/difficulty-adjustment - Get recommended difficulty for learning games
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'difficulty-adjustment') {
        $user = requireAuth($authToken);
        $profileId = $_GET['profile_id'] ?? null;
        $gameType = $_GET['game_type'] ?? 'spelling';
        
        try {
            // Get recent game performance
            $sql = "
                SELECT 
                    CAST(JSON_EXTRACT(metadata, '$.accuracy') AS DECIMAL(5,2)) as accuracy,
                    JSON_EXTRACT(metadata, '$.difficulty') as difficulty,
                    JSON_EXTRACT(metadata, '$.score') as score,
                    JSON_EXTRACT(metadata, '$.total_questions') as total_questions,
                    created_at
                FROM action_logs
                WHERE user_id = ?
                  AND action_type = 'game_completed'
                  AND JSON_EXTRACT(metadata, '$.game_type') = ?
            ";
            $params = [$user['id'], $gameType];
            
            if ($profileId) {
                $sql .= " AND profile_id = ?";
                $params[] = $profileId;
            }
            
            $sql .= " ORDER BY created_at DESC LIMIT 10";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $recentGames = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get jyutping learning log performance
            $sql2 = "
                SELECT 
                    AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) * 100 as avg_accuracy,
                    COUNT(*) as total_attempts
                FROM jyutping_learning_log
                WHERE user_id = ?
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ";
            $params2 = [$user['id']];
            
            if ($profileId) {
                $sql2 .= " AND profile_id = ?";
                $params2[] = $profileId;
            }
            
            $stmt2 = $db->prepare($sql2);
            $stmt2->execute($params2);
            $learningStats = $stmt2->fetch(PDO::FETCH_ASSOC);
            
            // Calculate recommended difficulty
            $avgGameAccuracy = 0;
            if (!empty($recentGames)) {
                $totalAccuracy = 0;
                foreach ($recentGames as $game) {
                    $totalAccuracy += (float)$game['accuracy'];
                }
                $avgGameAccuracy = $totalAccuracy / count($recentGames);
            }
            
            $avgLearningAccuracy = (float)($learningStats['avg_accuracy'] ?? 0);
            $overallAccuracy = $avgGameAccuracy > 0 && $avgLearningAccuracy > 0 
                ? ($avgGameAccuracy + $avgLearningAccuracy) / 2 
                : ($avgGameAccuracy > 0 ? $avgGameAccuracy : $avgLearningAccuracy);
            
            // Determine recommended difficulty
            $recommendedDifficulty = 'medium';
            if ($overallAccuracy >= 80) {
                $recommendedDifficulty = 'hard';
            } elseif ($overallAccuracy < 50) {
                $recommendedDifficulty = 'easy';
            }
            
            // Get current difficulty trend
            $difficultyTrend = 'stable';
            if (count($recentGames) >= 3) {
                $recent3 = array_slice($recentGames, 0, 3);
                $older3 = array_slice($recentGames, 3, 3);
                if (count($older3) >= 3) {
                    $recentAvg = array_sum(array_column($recent3, 'accuracy')) / 3;
                    $olderAvg = array_sum(array_column($older3, 'accuracy')) / 3;
                    if ($recentAvg > $olderAvg + 10) {
                        $difficultyTrend = 'improving';
                    } elseif ($recentAvg < $olderAvg - 10) {
                        $difficultyTrend = 'declining';
                    }
                }
            }
            
            return successResponse([
                'recommended_difficulty' => $recommendedDifficulty,
                'current_performance' => [
                    'game_accuracy' => round($avgGameAccuracy, 2),
                    'learning_accuracy' => round($avgLearningAccuracy, 2),
                    'overall_accuracy' => round($overallAccuracy, 2)
                ],
                'difficulty_trend' => $difficultyTrend,
                'recent_games_count' => count($recentGames),
                'learning_attempts' => (int)($learningStats['total_attempts'] ?? 0)
            ]);
            
        } catch (Exception $e) {
            error_log("Difficulty adjustment error: " . $e->getMessage());
            return errorResponse('Failed to get difficulty adjustment', 500);
        }
    }
    
    // GET /ai/jyutping-assistant - Get personalized Jyutping assistant recommendations
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'jyutping-assistant') {
        $user = requireAuth($authToken);
        $profileId = $_GET['profile_id'] ?? null;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        
        try {
            // Get jyutping codes that need practice (low accuracy, recent mistakes)
            // Each record is one attempt, so COUNT(*) = total attempts
            $sql = "
                SELECT 
                    jll.jyutping_code,
                    COUNT(*) as mistake_count,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN jll.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                    ROUND(SUM(CASE WHEN jll.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as accuracy_percent,
                    MAX(jll.created_at) as last_practiced
                FROM jyutping_learning_log jll
                WHERE jll.user_id = ?
            ";
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND jll.profile_id = ?";
                $params[] = $profileId;
            }
            
            $sql .= "
                GROUP BY jll.jyutping_code
                HAVING total_attempts >= 2
                ORDER BY accuracy_percent ASC, mistake_count DESC, last_practiced DESC
                LIMIT ?
            ";
            $params[] = $limit;
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $needsPractice = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get most common mistakes for personalized suggestions
            $sql2 = "
                SELECT 
                    jll.jyutping_code,
                    jll.hanzi_expected,
                    jll.hanzi_selected,
                    COUNT(*) as frequency
                FROM jyutping_learning_log jll
                WHERE jll.user_id = ?
                  AND jll.is_correct = 0
                  AND jll.hanzi_expected IS NOT NULL
                  AND jll.hanzi_selected IS NOT NULL
            ";
            $params2 = [$user['id']];
            
            if ($profileId) {
                $sql2 .= " AND jll.profile_id = ?";
                $params2[] = $profileId;
            }
            
            $sql2 .= "
                GROUP BY jll.jyutping_code, jll.hanzi_expected, jll.hanzi_selected
                ORDER BY frequency DESC
                LIMIT 5
            ";
            
            $stmt2 = $db->prepare($sql2);
            $stmt2->execute($params2);
            $topMistakes = $stmt2->fetchAll(PDO::FETCH_ASSOC);
            
            // Get learning progress summary
            $sql3 = "
                SELECT 
                    COUNT(DISTINCT jyutping_code) as unique_codes_learned,
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as total_correct,
                    ROUND(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as overall_accuracy
                FROM jyutping_learning_log
                WHERE user_id = ?
            ";
            $params3 = [$user['id']];
            
            if ($profileId) {
                $sql3 .= " AND profile_id = ?";
                $params3[] = $profileId;
            }
            
            $stmt3 = $db->prepare($sql3);
            $stmt3->execute($params3);
            $progress = $stmt3->fetch(PDO::FETCH_ASSOC);
            
            // Generate personalized recommendations
            $recommendations = [];
            foreach ($needsPractice as $item) {
                if ((float)$item['accuracy_percent'] < 70) {
                    $recommendations[] = [
                        'type' => 'practice_needed',
                        'jyutping_code' => $item['jyutping_code'],
                        'reason' => 'Low accuracy: ' . $item['accuracy_percent'] . '%',
                        'priority' => 'high'
                    ];
                }
            }
            
            return successResponse([
                'needs_practice' => $needsPractice,
                'top_mistakes' => $topMistakes,
                'progress' => [
                    'unique_codes_learned' => (int)($progress['unique_codes_learned'] ?? 0),
                    'total_attempts' => (int)($progress['total_attempts'] ?? 0),
                    'total_correct' => (int)($progress['total_correct'] ?? 0),
                    'overall_accuracy' => round((float)($progress['overall_accuracy'] ?? 0), 2)
                ],
                'recommendations' => $recommendations,
                'generated_at' => date('Y-m-d H:i:s')
            ]);
            
        } catch (Exception $e) {
            error_log("Jyutping assistant error: " . $e->getMessage());
            return errorResponse('Failed to get Jyutping assistant data', 500);
        }
    }
    
    // GET /ai/learning-suggestions - Get AI-generated learning suggestions based on common mistakes
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'learning-suggestions') {
        $user = requireAuth($authToken);
        $profileId = $_GET['profile_id'] ?? null;
        $locale = $_GET['locale'] ?? null; // Get locale from frontend (user's selected language)

        error_log("[Learning Suggestions] ===== START REQUEST =====");
        error_log("[Learning Suggestions] Received locale: " . ($locale ?: 'null'));
        error_log("[Learning Suggestions] Profile ID: " . ($profileId ?: 'null'));
        error_log("[Learning Suggestions] User ID: " . ($user['id'] ?? 'unknown'));

        try {
            // Priority: 1. Frontend locale (user's selected language), 2. Profile language, 3. User settings, 4. Default
            $userLanguage = 'zh-TW'; // Default to Traditional Chinese

            // First priority: Use locale from frontend (user's selected language in UI)
            if ($locale) {
                // Normalize generic 'zh' to 'zh-CN' (can be overridden by user settings)
                if ($locale === 'zh' || $locale === 'zh-CN' || $locale === 'zh-Hans') {
                    $userLanguage = 'zh-CN';
                } elseif ($locale === 'zh-TW' || $locale === 'zh-HK' || $locale === 'zh-Hant') {
                    $userLanguage = 'zh-TW';
                } else {
                    $userLanguage = $locale;
                }
                error_log("[Learning Suggestions] User language from frontend locale: {$locale} -> normalized to: {$userLanguage}");
                
                // If locale is generic 'zh', try to get more specific from user settings
                if ($locale === 'zh') {
                    $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
                    $stmt->execute([$user['id']]);
                    $settingsRow = $stmt->fetch();
                    if ($settingsRow && $settingsRow['settings_data']) {
                        $settings = json_decode($settingsRow['settings_data'], true);
                        if (isset($settings['language']['lang'])) {
                            $langFromSettings = $settings['language']['lang'];
                            // Check if it's Traditional Chinese
                            if ($langFromSettings === 'zh-TW' || $langFromSettings === 'zh-HK' || $langFromSettings === 'zh-Hant') {
                                $userLanguage = 'zh-TW';
                                error_log("[Learning Suggestions] Override with Traditional Chinese from settings: {$userLanguage}");
                            } elseif ($langFromSettings === 'zh-CN' || $langFromSettings === 'zh-Hans' || $langFromSettings === 'zh') {
                                $userLanguage = 'zh-CN';
                                error_log("[Learning Suggestions] Override with Simplified Chinese from settings: {$userLanguage}");
                            }
                        }
                    }
                }
            } else {
                // Fallback: Get from profile
                if ($profileId) {
                    $stmt = $db->prepare("SELECT language FROM profiles WHERE id = ?");
                    $stmt->execute([$profileId]);
                    $profile = $stmt->fetch();
                    if ($profile && !empty($profile['language'])) {
                        $userLanguage = $profile['language'];
                        error_log("[Learning Suggestions] User language from profile: {$userLanguage}");
                    }
                }
                // Fallback: Get from user settings
                if ($userLanguage === 'zh-CN' || $userLanguage === 'en') {
                    $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
                    $stmt->execute([$user['id']]);
                    $settingsRow = $stmt->fetch();
                    if ($settingsRow && $settingsRow['settings_data']) {
                        $settings = json_decode($settingsRow['settings_data'], true);
                        if (isset($settings['language']['lang'])) {
                            $userLanguage = $settings['language']['lang'];
                            error_log("[Learning Suggestions] User language from settings: {$userLanguage}");
                        } elseif (isset($settings['speech']['language'])) {
                            $userLanguage = $settings['speech']['language'];
                            error_log("[Learning Suggestions] User language from speech settings: {$userLanguage}");
                        }
                    }
                }
            }
            error_log("[Learning Suggestions] Final user language: {$userLanguage}");
            
            // Determine language for prompt and response
            $isTraditionalChinese = ($userLanguage === 'zh-TW' || $userLanguage === 'zh-HK' || $userLanguage === 'zh-Hant');
            $isEnglish = ($userLanguage === 'en' || $userLanguage === 'en-US' || $userLanguage === 'en-GB');
            
            // Get common mistakes from jyutping_learning_log
            $sql = "
                SELECT 
                    jll.jyutping_code,
                    jll.hanzi_expected,
                    jll.hanzi_selected,
                    COUNT(*) as mistake_count,
                    MAX(jll.created_at) as last_attempted
                FROM jyutping_learning_log jll
                WHERE jll.user_id = ?
                  AND jll.is_correct = 0
                  AND jll.hanzi_expected IS NOT NULL
                  AND jll.hanzi_selected IS NOT NULL
            ";
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND jll.profile_id = ?";
                $params[] = $profileId;
            }
            
            $sql .= "
                GROUP BY jll.jyutping_code, jll.hanzi_expected, jll.hanzi_selected
                ORDER BY mistake_count DESC, last_attempted DESC
                LIMIT 10
            ";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $commonMistakes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($commonMistakes)) {
                $noMistakesMessage = $isTraditionalChinese 
                    ? '沒有發現常見錯誤。繼續保持！'
                    : ($isEnglish 
                        ? 'No common mistakes found. Keep up the good work!'
                        : '没有发现常见错误。继续保持！');
                return successResponse([
                    'suggestions' => [],
                    'message' => $noMistakesMessage
                ]);
            }
            
            // Build prompt for Ollama based on user language
            $mistakesText = '';
            foreach ($commonMistakes as $mistake) {
                if ($isTraditionalChinese) {
                    $mistakesText .= "- 粵拼: {$mistake['jyutping_code']}, 正確答案: {$mistake['hanzi_expected']}, 錯誤選擇: {$mistake['hanzi_selected']}, 錯誤次數: {$mistake['mistake_count']}\n";
                } elseif ($isEnglish) {
                    $mistakesText .= "- Jyutping: {$mistake['jyutping_code']}, Correct answer: {$mistake['hanzi_expected']}, Wrong selection: {$mistake['hanzi_selected']}, Mistake count: {$mistake['mistake_count']}\n";
                } else {
                    $mistakesText .= "- 粤拼: {$mistake['jyutping_code']}, 正确答案: {$mistake['hanzi_expected']}, 错误选择: {$mistake['hanzi_selected']}, 错误次数: {$mistake['mistake_count']}\n";
                }
            }
            
            if ($isTraditionalChinese) {
                $prompt = "You are a Cantonese learning assistant.The user cannot understand english.Please write in Traditional Chinese.";
                $prompt .= "你是一位專門教導粵語的學習助手。請根據以下學習者常犯的錯誤，請用繁體中文提供個人化的學習建議和練習方法。\n\n";
                $prompt .= "學習者常見錯誤記錄：\n";
                $prompt .= $mistakesText;
                $prompt .= "\n請用繁體中文提供以下內容：\n";
                $prompt .= "1. 針對這些錯誤的具體學習建議\n";
                $prompt .= "2. 幫助記憶的技巧或聯想方法\n";
                $prompt .= "3. 推薦的練習方式\n";
                $prompt .= "4. 鼓勵學習者的話語\n\n";
                $prompt .= "注意：你必須完全使用繁體中文回答。不要使用簡體中文或英文。使用這些繁體字詞：學習、建議、練習、錯誤、正確、方法、技巧等。";
            } elseif ($isEnglish) {
                $prompt = "You are a Cantonese learning assistant. Based on the following common mistakes made by the learner, provide personalized learning suggestions and practice methods.\n\n";
                $prompt .= "Common mistakes record:\n";
                $prompt .= $mistakesText;
                $prompt .= "\nPlease provide:\n";
                $prompt .= "1. Targeted learning suggestions for these mistakes\n";
                $prompt .= "2. Memory techniques or association methods\n";
                $prompt .= "3. Recommended practice methods\n";
                $prompt .= "4. Encouraging words\n\n";
                $prompt .= "Please answer in English, be friendly and encouraging, and provide practical advice.";
            } else {
                $prompt = "你是一位粤语学习助手。根据以下学习者的常见错误，提供个性化的学习建议和练习方法。\n\n";
                $prompt .= "常见错误记录：\n";
                $prompt .= $mistakesText;
                $prompt .= "\n请提供：\n";
                $prompt .= "1. 针对这些错误的针对性学习建议\n";
                $prompt .= "2. 记忆技巧或联想方法\n";
                $prompt .= "3. 推荐的练习方式\n";
                $prompt .= "4. 鼓励性的话语\n\n";
                $prompt .= "请用简体中文回答，语言要友好、鼓励，并提供实用的建议。";
            }
            
            error_log("[Learning Suggestions] AI Prompt: " . substr($prompt, 0, 500) . "...");

            // Call Ollama to generate suggestions
            require_once __DIR__ . '/../helpers/ollama.php';
            $ollamaResponse = callOllamaAI($prompt, null, null, [
                'temperature' => 0.7,
                'max_tokens' => 1000
            ]);

            error_log("[Learning Suggestions] AI Response success: " . ($ollamaResponse['success'] ? 'true' : 'false'));
            if (isset($ollamaResponse['error'])) {
                error_log("[Learning Suggestions] AI Error: " . $ollamaResponse['error']);
            }
            error_log("[Learning Suggestions] AI Response content preview: " . substr($ollamaResponse['content'] ?? '', 0, 200));

            $aiSuggestions = '';
            if ($ollamaResponse['success'] && !empty($ollamaResponse['content'])) {
                $aiSuggestions = trim($ollamaResponse['content']);

                // Post-process: For Traditional Chinese, filter out any English content
                if ($isTraditionalChinese) {
                    // Remove any lines that are entirely in English (contain only English letters, numbers, and punctuation)
                    $lines = explode("\n", $aiSuggestions);
                    $filteredLines = [];
                    foreach ($lines as $line) {
                        $trimmedLine = trim($line);
                        // If line contains Chinese characters, keep it
                        if (preg_match('/[\x{4e00}-\x{9fff}]/u', $trimmedLine)) {
                            $filteredLines[] = $line;
                        }
                        // If line is empty or contains only punctuation/whitespace, keep it
                        elseif (preg_match('/^[\s\p{P}]*$/u', $trimmedLine)) {
                            $filteredLines[] = $line;
                        }
                        // If line contains numbers or is very short, might be part of a list, keep it
                        elseif (preg_match('/^\d+\.?\s*/', $trimmedLine) || strlen($trimmedLine) < 10) {
                            $filteredLines[] = $line;
                        }
                        // Otherwise, it's likely pure English - skip it
                        else {
                            error_log("[Learning Suggestions] Filtered out English line: " . substr($trimmedLine, 0, 50));
                        }
                    }
                    $aiSuggestions = implode("\n", $filteredLines);
                    $aiSuggestions = trim($aiSuggestions);

                    // If filtering removed too much content, fall back to static response
                    if (strlen($aiSuggestions) < 50) {
                        error_log("[Learning Suggestions] AI response too short after filtering, using fallback");
                        $aiSuggestions = "建議：\n";
                        $aiSuggestions .= "1. 針對這些常見錯誤，建議多練習相關的粵拼代碼。\n";
                        $aiSuggestions .= "2. 可以嘗試將正確答案和錯誤答案進行對比記憶。\n";
                        $aiSuggestions .= "3. 建議每天花一些時間複習這些容易混淆的內容。\n";
                        $aiSuggestions .= "4. 保持練習，你會越來越好的！";
                    }
                }

                error_log("[Learning Suggestions] Using AI-generated suggestions (length: " . strlen($aiSuggestions) . ")");
            } else {
                // Fallback if Ollama fails
                if ($isTraditionalChinese) {
                    $aiSuggestions = "建議：\n";
                    $aiSuggestions .= "1. 針對這些常見錯誤，建議多練習相關的粵拼代碼。\n";
                    $aiSuggestions .= "2. 可以嘗試將正確答案和錯誤答案進行對比記憶。\n";
                    $aiSuggestions .= "3. 建議每天花一些時間複習這些容易混淆的內容。\n";
                    $aiSuggestions .= "4. 保持練習，你會越來越好的！";
                } elseif ($isEnglish) {
                    $aiSuggestions = "Suggestions:\n";
                    $aiSuggestions .= "1. For these common mistakes, it is recommended to practice the related Jyutping codes more.\n";
                    $aiSuggestions .= "2. Try to compare and memorize the correct and wrong answers.\n";
                    $aiSuggestions .= "3. It is recommended to spend some time reviewing these confusing contents every day.\n";
                    $aiSuggestions .= "4. Keep practicing, you will get better!";
                } else {
                    $aiSuggestions = "建议：\n";
                    $aiSuggestions .= "1. 针对这些常见错误，建议多练习相关的粤拼代码。\n";
                    $aiSuggestions .= "2. 可以尝试将正确答案和错误答案进行对比记忆。\n";
                    $aiSuggestions .= "3. 建议每天花一些时间复习这些容易混淆的内容。\n";
                    $aiSuggestions .= "4. 保持练习，你会越来越好的！";
                }
            }
            
            return successResponse([
                'common_mistakes' => $commonMistakes,
                'ai_suggestions' => $aiSuggestions,
                'generated_at' => date('Y-m-d H:i:s')
            ]);
            
        } catch (Exception $e) {
            error_log("Learning suggestions error: " . $e->getMessage());
            return errorResponse('Failed to get learning suggestions: ' . $e->getMessage(), 500);
        }
    }
    
    // POST /ai/cleanup-suggestions - Clean up unaccepted AI suggestion images
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'cleanup-suggestions') {
        $user = requireAuth($authToken);
        $imagePaths = $data['image_paths'] ?? [];
        
        if (!is_array($imagePaths) || empty($imagePaths)) {
            return successResponse(['deleted' => 0, 'message' => 'No images to clean up']);
        }
        
        try {
            $deleted = 0;
            $userId = (int)$user['id'];
            $uploadDir = __DIR__ . '/../../uploads/user_' . $userId . '/';
            
            foreach ($imagePaths as $imagePath) {
                // Validate path is a Photocen AI image from this user
                if (!preg_match('#^api/uploads/user_' . $userId . '/photocen_ai_[a-f0-9]+\.[a-z]+$#', $imagePath)) {
                    error_log("[AI CLEANUP] Skipping invalid path: $imagePath");
                    continue;
                }
                
                // Extract filename and build full path
                $filename = basename($imagePath);
                $filePath = $uploadDir . $filename;
                
                // Check if file exists and delete it
                if (file_exists($filePath)) {
                    if (@unlink($filePath)) {
                        $deleted++;
                        error_log("[AI CLEANUP] Deleted file: $filePath");
                        
                        // Also delete from media table if exists
                        try {
                            $stmt = $db->prepare("DELETE FROM media WHERE user_id = ? AND filename = ? AND file_path = ?");
                            $stmt->execute([$userId, $filename, $filePath]);
                        } catch (Exception $e) {
                            error_log("[AI CLEANUP] Failed to delete from media table: " . $e->getMessage());
                        }
                    } else {
                        error_log("[AI CLEANUP] Failed to delete file: $filePath");
                    }
                }
            }
            
            return successResponse([
                'deleted' => $deleted,
                'total' => count($imagePaths),
                'message' => "Cleaned up $deleted unaccepted suggestion images"
            ]);
            
        } catch (Exception $e) {
            error_log("AI cleanup suggestions error: " . $e->getMessage());
            return errorResponse('Failed to clean up suggestions: ' . $e->getMessage(), 500);
        }
    }
    
    return errorResponse('AI route not found', 404);
}
