<?php
/**
 * Ollama AI Service Helper
 *
 * Integrates with DuckBot Ollama middleware for text-related AI features.
 *
 * Configuration via environment variables (with safe defaults):
 * - DUCKBOT_API_URL     default: https://portal.duckbot.hk/api/
 * - DUCKBOT_APP_ID      default: aac
 * - DUCKBOT_ORIGIN      default: https://portal.duckbot.hk
 * - OLLAMA_SHARED_SECRET default: anything
 * - OLLAMA_MODEL        default: llama3:latest  (normalized if needed)
 *
 * Notes:
 * - Avoid "llama2" (not installed on your Ollama host). Use one of:
 *   - llama3:latest, llama3.1:8b, mistral:7b, gemma2:9b, deepseek-r1:7b, qwen2.5-coder:7b
 * - Embedding-only models (bge-*, mxbai-embed-*) are not suitable for chat/text generation.
 */

function _env(string $key, $default = null) {
    $val = getenv($key);
    return ($val !== false && $val !== null && $val !== '') ? $val : $default;
}

/**
 * Normalize/upgrade model names to valid Ollama tags present on your host.
 * - Maps deprecated or tag-less names to installed tags
 * - You can extend this map as your fleet changes
 */
function normalizeModel(?string $model): string {
    $preferred = $model ?: _env('OLLAMA_MODEL', 'llama3:latest');

    // Strong map for known cases
    $map = [
        'llama2'       => 'llama3:latest',  // upgrade away from missing llama2
        'llama3'       => 'llama3:latest',
        'llama3.1'     => 'llama3.1:8b',
        'llama3.1:8b'  => 'llama3.1:8b',
        'llama3:latest'=> 'llama3:latest',
        'mistral'      => 'mistral:7b',
        'mistral:7b'   => 'mistral:7b',
        'gemma2'       => 'gemma2:9b',
        'gemma2:9b'    => 'gemma2:9b',
        'deepseek-r1'  => 'deepseek-r1:7b',
        'deepseek-r1:7b'=>'deepseek-r1:7b',
        'qwen2.5-coder'=> 'qwen2.5-coder:7b',
        'qwen2.5-coder:7b'=> 'qwen2.5-coder:7b',
    ];

    // If it's an embedding model, fall back to a chat model
    $embeddings = ['bge-m3', 'bge-m3:latest', 'bge-large', 'bge-large:latest', 'mxbai-embed-large', 'mxbai-embed-large:latest'];

    if (isset($map[$preferred])) {
        return $map[$preferred];
    }

    if (in_array($preferred, $embeddings, true)) {
        return 'llama3:latest';
    }

    // If it already looks like a valid tag (has ":"), pass through, otherwise prefer llama3:latest
    if (strpos($preferred, ':') !== false) {
        return $preferred;
    }
    return 'llama3:latest';
}

/**
 * Call Ollama AI service via DuckBot middleware
 *
 * @param string $question The prompt/question to send to AI
 * @param string|null $model The model name; if null, uses env OLLAMA_MODEL or default
 * @param string|null $clientIp Client IP address for logging
 * @param array $options Extra generation options: temperature, top_p, max_tokens
 * @return array Response with 'success', 'content', 'duration', and optional error/meta
 */
function callOllamaAI(string $question, ?string $model = null, ?string $clientIp = null, array $options = []): array {
    // Configuration
    $appId        = _env('DUCKBOT_APP_ID', 'aac');
    $apiUrl       = rtrim(_env('DUCKBOT_API_URL', 'https://portal.duckbot.hk/api/'), '/') . '/';
    $origin       = _env('DUCKBOT_ORIGIN', 'https://portal.duckbot.hk');
    $sharedSecret = _env('OLLAMA_SHARED_SECRET', 'anything');

    // Model normalization (avoid llama2)
    $model = normalizeModel($model);

    // Client IP fallback
    if ($clientIp === null) {
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $forwarded = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $clientIp = trim($forwarded[0]);
        }
    }

    // HMAC signature over timestamp (adjust if your portal requires a different string-to-sign)
    $timestamp = time();
    $signature = base64_encode(hash_hmac('sha256', (string)$timestamp, $sharedSecret, true));

    // Optional generation parameters
    $gen = [];
    if (isset($options['temperature'])) $gen['temperature'] = (float)$options['temperature'];
    if (isset($options['top_p']))      $gen['top_p']       = (float)$options['top_p'];
    if (isset($options['max_tokens'])) $gen['max_tokens']  = (int)$options['max_tokens'];

    // Build payload (OpenAI-style chat.completions)
    $payload = array_merge([
        'model'    => $model,
        'messages' => [
            ['role' => 'user', 'content' => $question]
        ],
        'stream'   => false,
    ], $gen);

    $requestData = [
        'path'      => '/v1/chat/completions',
        'payload'   => $payload,
        'app_id'    => $appId,
        'client_ip' => $clientIp,
        'ai_type'   => 'ollama',
    ];

    // Execute request
    $startTime = microtime(true);
    $ch = curl_init($apiUrl);

    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Origin: ' . $origin,
            'X-Portal-Ts: ' . $timestamp,
            'X-Portal-Sign: ' . $signature,
            'Content-Type: application/json',
            'User-Agent: aac-app/1.0',
        ],
        CURLOPT_POSTFIELDS     => json_encode($requestData, JSON_UNESCAPED_UNICODE),
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT        => 120, // Increased to 120 seconds for AI processing
        CURLOPT_CONNECTTIMEOUT => 30,  // Increased connection timeout
    ]);

    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $duration  = round((microtime(true) - $startTime) * 1000, 2);
    curl_close($ch);

    if ($response === false) {
        error_log("Ollama API curl error: $curlError");
        return [
            'success'  => false,
            'error'    => 'Failed to connect to AI service: ' . $curlError,
            'duration' => $duration,
        ];
    }

    // Try to decode JSON
    $responseData = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("Ollama API JSON decode error: " . json_last_error_msg() . " | Raw: " . substr($response, 0, 500));
        return [
            'success'      => false,
            'error'        => 'Failed to parse AI service response',
            'raw_response' => $response,
            'http_code'    => $httpCode,
            'duration'     => $duration,
        ];
    }

    // Non-200 HTTP
    if ($httpCode !== 200) {
        // If portal returns structured error
        $errMsg = $responseData['error']['message'] ?? $responseData['message'] ?? 'Unknown error';
        error_log("Ollama API HTTP error: $httpCode, Message: $errMsg, Response: $response");
        return [
            'success'   => false,
            'error'     => $errMsg,
            'http_code' => $httpCode,
            'response'  => $responseData,
            'duration'  => $duration,
        ];
    }

    // Portal-side error object even with 200
    if (isset($responseData['error'])) {
        $errMsg = is_array($responseData['error'])
            ? ($responseData['error']['message'] ?? json_encode($responseData['error']))
            : (string)$responseData['error'];
        return [
            'success'  => false,
            'error'    => $errMsg,
            'response' => $responseData,
            'duration' => $duration,
        ];
    }

    // Extract text content (OpenAI-style)
    $content = $responseData['choices'][0]['message']['content']
        ?? $responseData['choices'][0]['text']
        ?? $responseData['message']['content']
        ?? $responseData['content']
        ?? '';

    return [
        'success'      => true,
        'content'      => trim((string)$content),
        'raw_response' => $responseData,
        'model_used'   => $model,
        'duration'     => $duration,
    ];
}

/**
 * Generate card suggestions based on context using AI
 *
 * @param string $context User's context or previous conversation
 * @param array $availableCards List of available cards with their labels
 * @param int $limit Number of suggestions to return
 * @return array Array of suggested card labels
 */
function generateCardSuggestions(string $context, array $availableCards = [], int $limit = 10): array {
    if ($context === '') {
        return [];
    }

    $cardList = '';
    if (!empty($availableCards)) {
        $cardLabels = array_slice(array_column($availableCards, 'label_text'), 0, 50);
        if (!empty($cardLabels)) {
            $cardList = "\nAvailable cards: " . implode(', ', $cardLabels);
        }
    }

    $prompt = "Based on this context: \"$context\"$cardList\n\n" .
              "Suggest the most relevant communication cards (symbols/pictures) that would help the user express themselves. " .
              "Return only a comma-separated list of card labels or keywords, maximum $limit items. " .
              "Focus on practical, commonly used communication symbols.";

    // Use env model if set; normalize to a valid tag
    $model = normalizeModel(_env('OLLAMA_MODEL', 'llama3.1:8b'));

    $result = callOllamaAI($prompt, $model, null, ['temperature' => 0.4]);

    if (!$result['success'] || empty($result['content'])) {
        return [];
    }

    $suggestions = [];
    $lines = explode("\n", $result['content']);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') continue;

        // Strip numbering/bullets
        $line = preg_replace('/^[\d\-\.\)\s]+/', '', $line);

        // Split by commas
        foreach (explode(',', $line) as $item) {
            $item = trim($item);
            if ($item !== '' && count($suggestions) < $limit) {
                $suggestions[] = $item;
            }
        }
        if (count($suggestions) >= $limit) break;
    }

    return array_slice($suggestions, 0, $limit);
}

/**
 * Improve or complete a phrase using AI
 *
 * @param string $phrase The phrase to improve
 * @param string $language Language code (en, zh, yue)
 * @return string Improved phrase
 */
function improvePhrase(string $phrase, string $language = 'en'): string {
    if ($phrase === '') {
        return $phrase;
    }

    $langPrompt = '';
    if ($language === 'zh' || $language === 'yue') {
        $langPrompt = "The phrase is in Traditional Chinese (繁體中文). ";
    }

    $prompt = "Improve this communication phrase to make it more natural and clear: \"$phrase\"\n\n" .
              $langPrompt .
              "Return only the improved phrase, without explanations or additional text.";

    // Use a valid generative model (avoid llama2)
    $model = normalizeModel(_env('OLLAMA_MODEL', 'llama3.1:8b'));
    $result = callOllamaAI($prompt, $model, null, ['temperature' => 0.3]);

    if (!$result['success'] || empty($result['content'])) {
        return $phrase;
    }

    return trim($result['content']);
}

/**
 * Predict next words or complete text using AI
 *
 * @param string $input Partial text input
 * @param string $language Language code
 * @param int $limit Number of predictions
 * @param array $context Optional context (previous_words, user_history)
 * @return array Array of prediction strings
 */
function predictText(string $input, string $language = 'en', int $limit = 5, array $context = []): array {
    if ($input === '') {
        return [];
    }

    $langContext = ($language === 'zh' || $language === 'yue')
        ? "Traditional Chinese (繁體中文)"
        : "English";

    $contextStr = '';
    if (!empty($context)) {
        if (!empty($context['previous_words']) && is_array($context['previous_words'])) {
            $contextStr .= "Previous words: " . implode(' ', array_slice($context['previous_words'], -5)) . "\n";
        }
        if (!empty($context['user_history']) && is_array($context['user_history'])) {
            $recentHistory = array_slice($context['user_history'], -3);
            if (!empty($recentHistory)) {
                $contextStr .= "Recent usage: " . implode(', ', $recentHistory) . "\n";
            }
        }
    }

    // Build enhanced context string
    $selectedWord = $context['selected_word'] ?? '';
    $currentInput = $context['current_input'] ?? '';
    
    $enhancedContext = $contextStr;
    if ($selectedWord) {
        $enhancedContext .= "User just selected: \"$selectedWord\"\n";
    }
    if ($currentInput) {
        $enhancedContext .= "User is currently typing: \"$currentInput\"\n";
    }
    
    // Guidelines for understanding - based on FULL CONTEXT
    $examples = "Guidelines for predictions based on FULL CONTEXT:\n";
    $examples .= "- Analyze the COMPLETE sentence meaning, not just individual words\n";
    $examples .= "- Predict words that logically complete the sentence based on context\n";
    $examples .= "- For place-related contexts (去, 到), suggest relevant location words\n";
    $examples .= "- For question contexts (你想, 你要), suggest appropriate question words\n";
    $examples .= "- Focus on words that complete the MEANING of the FULL SENTENCE\n";
    
    // Build exclusion list to prevent repeating selected word
    $excludeWords = [];
    if ($selectedWord) {
        $excludeWords[] = $selectedWord;
    }
    if ($currentInput) {
        $excludeWords[] = $currentInput;
    }
    $excludeStr = !empty($excludeWords) ? "DO NOT include these words in predictions: " . implode(', ', $excludeWords) . "\n" : "";
    
    $prompt = "You are a text input prediction assistant for an AAC (Augmentative and Alternative Communication) system.\n\n" .
              ($enhancedContext ?: "") .
              "FULL CONTEXT (complete sentence so far): \"$input\"\n\n" .
              "$excludeStr" .
              "$examples\n" .
              "Task: Predict the next $limit most likely WORDS or PHRASES (1-4 words) that logically complete the FULL SENTENCE in $langContext.\n\n" .
              "CRITICAL REQUIREMENTS:\n" .
              "1. Each prediction can be a SINGLE WORD (1-4 characters) OR a PHRASE (2-4 words), but should be meaningful and contextually relevant\n" .
              "2. DO NOT include words already in the context. Predict NEW words/phrases that complete the sentence\n" .
              "3. Predict words/phrases that COMPLETE THE MEANING of the FULL SENTENCE, not just the last word\n" .
              "4. For place-related contexts (去, 到), suggest relevant location words/phrases based on context\n" .
              "5. For question contexts (你想, 你要), suggest appropriate question words/phrases based on context\n" .
              "6. Focus on practical, daily communication words (verbs, common nouns, particles, conjunctions, places)\n" .
              "7. Consider natural language flow and context - predict words/phrases that make the sentence complete and meaningful\n" .
              "8. For Traditional Chinese, prioritize commonly used characters that form natural phrases\n" .
              "9. Do NOT repeat words already in the context. Predict LOGICAL NEXT WORDS/PHRASES that complete the sentence\n" .
              "10. Prioritize high-frequency words/phrases used in daily life, school, and home/community contexts\n" .
              "11. Only predict if you are CONFIDENT the prediction is relevant and makes logical sense. Quality over quantity.\n" .
              "12. DO NOT predict random or unrelated words. Each prediction must logically follow from the context.\n" .
              "13. Return ONLY a comma-separated list of WORDS or PHRASES, no explanations, no numbering\n\n" .
              "Format: word1, phrase1, word2, phrase2, ...";

    // Use a valid model; low temperature for predictive behavior
    $model = normalizeModel(_env('OLLAMA_MODEL', 'llama3:latest'));
    $result = callOllamaAI($prompt, $model, null, ['temperature' => 0.2, 'max_tokens' => 64]);

    if (!$result['success'] || empty($result['content'])) {
        return [];
    }

    // Robust parsing of comma-separated output
    $predictions = [];
    $content = trim($result['content']);
    $content = preg_replace('/^(predictions?|suggestions?|results?):\s*/i', '', $content);
    $content = preg_replace('/^[\d\-\.\)\s]+/', '', $content);

    $items = preg_split('/[,，;；\n]/u', $content);
    $lowerInput = mb_strtolower(trim($input));
    $lowerSelectedWord = $selectedWord ? mb_strtolower(trim($selectedWord)) : '';

    foreach ($items as $item) {
        $item = trim($item, " \t\n\r\0\x0B\"'「」『』");
        if ($item === '' || mb_strlen($item) > 50) continue;

        $lowerItem = mb_strtolower($item);

        // Skip suggestions that are exactly the same as the current input
        if ($lowerItem === $lowerInput) {
            continue;
        }
        
        // Skip suggestions that contain the selected word
        if ($lowerSelectedWord && mb_strpos($lowerItem, $lowerSelectedWord) !== false) {
            // If item starts with selected word, extract the part after it
            if (mb_strpos($lowerItem, $lowerSelectedWord) === 0) {
                $remaining = mb_substr($item, mb_strlen($selectedWord));
                if (empty($remaining)) {
                    continue; // Item is exactly the selected word
                }
                // Use remaining part (can be a phrase, not just single word)
                // Trim any leading spaces or punctuation
                $remaining = trim($remaining, " \t\n\r\0\x0B，,、");
                if (empty($remaining)) {
                    continue;
                }
                $item = $remaining;
            } else {
                // Selected word is in the middle or end, skip this item
                continue;
            }
        }

        // Skip meta/explanatory lines like "based on the input \"we are hav\"..."
        if (strpos($lowerItem, 'based on the input') !== false ||
            strpos($lowerItem, 'based on your input') !== false ||
            strpos($lowerItem, 'given the input') !== false ||
            strpos($lowerItem, 'input "') !== false) {
            continue;
        }

        // Remove trailing explanations like "foo — reason"
        if (preg_match('/^(.+?)(?:\s*[-–—]\s*.+)$/u', $item, $m)) {
            $item = trim($m[1]);
        }
        if ($item !== '' && !in_array($item, $predictions, true)) {
            $predictions[] = $item;
        }
        if (count($predictions) >= $limit) break;
    }

    return array_slice($predictions, 0, $limit);
}

/**
 * Predict Cantonese Jyutping (with tone numbers) for a given Chinese text.
 * 用於低置信度或缺失的粵拼情況，僅在遊戲等非關鍵場景中作為 fallback。
 *
 * 安全策略：
 * - 僅接受形如 "hok6 haau6" 這種由若干個「字母+聲調數字」組成、以空格分隔的串
 * - 若 AI 回覆不符合格式，直接返回 null，不使用
 *
 * @param string $chineseText 需要轉成粵拼的中文（通常是短詞或單字）
 * @return string|null 合法的 Jyutping 串，或 null（表示不可靠 / 無法判斷）
 */
function predictJyutpingForChinese(string $chineseText): ?string {
    $chineseText = trim($chineseText);
    if ($chineseText === '' || mb_strlen($chineseText) > 20) {
        return null;
    }

    $prompt = "你是一個粵語粵拼標註專家，使用「粵拼 Jyutping」方案並帶數字聲調。\n\n" .
              "請將下面的中文詞語或短句轉換為「粵拼（帶聲調數字）」：\n" .
              "【{$chineseText}】\n\n" .
              "嚴格要求：\n" .
              "1. 只輸出粵拼，不要輸出中文、解釋或其他符號。\n" .
              "2. 多個音節之間用單一空格分隔，例如：hok6 haau6。\n" .
              "3. 每個音節必須由小寫英文字母開頭，結尾是 1–6 的數字聲調，例如: ngo5, hok6, haau6。\n" .
              "4. 不要加標點符號，不要加引號，不要加前綴或後綴文字。\n" .
              "5. 如果無法確定正確粵拼，就直接回答一個字：\"NA\"。\n\n" .
              "只輸出粵拼本身，例如：ngo5, hok6 haau6。";

    $model = normalizeModel(_env('OLLAMA_MODEL', 'llama3:latest'));
    $result = callOllamaAI($prompt, $model, null, ['temperature' => 0.1, 'max_tokens' => 32]);

    if (!$result['success'] || empty($result['content'])) {
        return null;
    }

    $raw = trim($result['content']);
    // 移除可能的引號或前綴
    $raw = trim($raw, " \t\n\r\0\x0B\"'「」『』");
    if ($raw === '' || strcasecmp($raw, 'NA') === 0) {
        return null;
    }

    // 只保留第一行（有些模型可能會換行）
    $lines = preg_split('/\R/u', $raw);
    $candidate = trim($lines[0]);

    // 格式驗證：一個或多個「字母+聲調數字」，以空格分隔
    // 例：ngo5、hok6 haau6、zi1 gwaa3 等
    if (!preg_match('/^[a-z]+[1-6](\s+[a-z]+[1-6])*$/i', $candidate)) {
        return null;
    }

    // 正規化：轉小寫，壓縮多餘空格
    $candidate = strtolower($candidate);
    $candidate = preg_replace('/\s+/', ' ', $candidate);

    return $candidate !== '' ? $candidate : null;
}