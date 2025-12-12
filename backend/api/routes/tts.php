<?php
/**
 * Text-to-Speech (TTS) Routes Handler
 * Sprint 4: TTS integration for Cantonese + English voices
 */

require_once __DIR__ . '/../auth.php';

function handleTTSRoutes($method, $pathParts, $data, $authToken) {
    // GET /tts/voices (get available voices)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'voices') {
        $language = $_GET['language'] ?? 'en';
        
        // Available voices (≥6 types for Cantonese + English)
        $voices = [
            'en' => [
                ['id' => 'en-US-Neural-A', 'name' => 'English (US) - Female', 'language' => 'en-US', 'gender' => 'female'],
                ['id' => 'en-US-Neural-B', 'name' => 'English (US) - Male', 'language' => 'en-US', 'gender' => 'male'],
                ['id' => 'en-GB-Neural-A', 'name' => 'English (UK) - Female', 'language' => 'en-GB', 'gender' => 'female'],
                ['id' => 'en-GB-Neural-B', 'name' => 'English (UK) - Male', 'language' => 'en-GB', 'gender' => 'male'],
                ['id' => 'en-AU-Neural-A', 'name' => 'English (AU) - Female', 'language' => 'en-AU', 'gender' => 'female'],
                ['id' => 'en-AU-Neural-B', 'name' => 'English (AU) - Male', 'language' => 'en-AU', 'gender' => 'male']
            ],
            'zh-HK' => [
                ['id' => 'zh-HK-Standard-A', 'name' => 'Cantonese - Female 1', 'language' => 'zh-HK', 'gender' => 'female'],
                ['id' => 'zh-HK-Standard-B', 'name' => 'Cantonese - Male 1', 'language' => 'zh-HK', 'gender' => 'male'],
                ['id' => 'zh-HK-Standard-C', 'name' => 'Cantonese - Female 2', 'language' => 'zh-HK', 'gender' => 'female'],
                ['id' => 'zh-HK-Standard-D', 'name' => 'Cantonese - Male 2', 'language' => 'zh-HK', 'gender' => 'male'],
                ['id' => 'zh-HK-Wavenet-A', 'name' => 'Cantonese - Premium Female', 'language' => 'zh-HK', 'gender' => 'female'],
                ['id' => 'zh-HK-Wavenet-B', 'name' => 'Cantonese - Premium Male', 'language' => 'zh-HK', 'gender' => 'male']
            ]
        ];
        
        $availableVoices = $voices[$language] ?? array_merge($voices['en'], $voices['zh-HK']);
        
        return successResponse([
            'voices' => $availableVoices,
            'language' => $language
        ]);
    }
    
    // POST /tts/speak (generate speech)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'speak') {
        $text = $data['text'] ?? '';
        $language = $data['language'] ?? 'en';
        $voiceId = $data['voice_id'] ?? null;
        $rate = isset($data['rate']) ? (float)$data['rate'] : 1.0; // 0.5 to 2.0
        $pitch = isset($data['pitch']) ? (float)$data['pitch'] : 1.0; // 0.5 to 2.0
        
        if (empty($text)) {
            return errorResponse('text is required', 400);
        }
        
        // Validate rate (0.5 to 2.0)
        $rate = max(0.5, min(2.0, $rate));
        $pitch = max(0.5, min(2.0, $pitch));
        
        try {
            // Get Azure TTS credentials from config
            $azureKey = getenv('AZURE_TTS_KEY') ?: '';
            $azureRegion = getenv('AZURE_TTS_REGION') ?: 'eastasia';
            
            if (empty($azureKey)) {
                // Fallback to browser TTS
                return successResponse([
                    'text' => $text,
                    'language' => $language,
                    'voice_id' => $voiceId,
                    'rate' => $rate,
                    'pitch' => $pitch,
                    'audio_url' => null,
                    'method' => 'browser_tts',
                    'message' => 'Azure TTS not configured, using browser TTS'
                ]);
            }
            
            // Map language codes to Azure locale
            $localeMap = [
                'en' => 'en-US',
                'en-US' => 'en-US',
                'en-GB' => 'en-GB',
                'en-AU' => 'en-AU',
                'zh-HK' => 'zh-HK',
                'zh' => 'zh-HK'
            ];
            $locale = $localeMap[$language] ?? 'en-US';
            
            // Map voice IDs to Azure voice names
            $voiceMap = [
                'en-US-Neural-A' => 'en-US-AriaNeural',
                'en-US-Neural-B' => 'en-US-GuyNeural',
                'en-GB-Neural-A' => 'en-GB-SoniaNeural',
                'en-GB-Neural-B' => 'en-GB-RyanNeural',
                'en-AU-Neural-A' => 'en-AU-NatashaNeural',
                'en-AU-Neural-B' => 'en-AU-WilliamNeural',
                'zh-HK-Standard-A' => 'zh-HK-HiuGaaiNeural',
                'zh-HK-Standard-B' => 'zh-HK-WanLungNeural',
                'zh-HK-Standard-C' => 'zh-HK-HiuMaanNeural',
                'zh-HK-Standard-D' => 'zh-HK-HiuMaanNeural',
                'zh-HK-Wavenet-A' => 'zh-HK-HiuGaaiNeural',
                'zh-HK-Wavenet-B' => 'zh-HK-WanLungNeural'
            ];
            $azureVoice = $voiceMap[$voiceId] ?? ($locale === 'zh-HK' ? 'zh-HK-HiuGaaiNeural' : 'en-US-AriaNeural');
            
            // Generate SSML
            $ssml = sprintf(
                '<speak version="1.0" xml:lang="%s"><voice xml:lang="%s" name="%s"><prosody rate="%.1f" pitch="%.1f%%">%s</prosody></voice></speak>',
                $locale,
                $locale,
                $azureVoice,
                $rate,
                ($pitch - 1.0) * 100,
                htmlspecialchars($text, ENT_XML1, 'UTF-8')
            );
            
            // Call Azure TTS API
            $url = "https://{$azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1";
            $headers = [
                'Ocp-Apim-Subscription-Key: ' . $azureKey,
                'Content-Type: application/ssml+xml',
                'X-Microsoft-OutputFormat: audio-16khz-128kbitrate-mono-mp3',
                'User-Agent: Cboard-TTS'
            ];
            
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $ssml);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            
            $audioData = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            
            if ($httpCode !== 200 || empty($audioData)) {
                error_log("Azure TTS API error: HTTP $httpCode, Error: $curlError");
                // Fallback to browser TTS
                return successResponse([
                    'text' => $text,
                    'language' => $language,
                    'voice_id' => $voiceId,
                    'rate' => $rate,
                    'pitch' => $pitch,
                    'audio_url' => null,
                    'method' => 'browser_tts',
                    'message' => 'Azure TTS API error, using browser TTS fallback'
                ]);
            }
            
            // Save audio file
            $user = verifyAuth($authToken);
            $userId = $user ? $user['id'] : 0;
            $filename = 'tts_' . md5($text . $voiceId . time()) . '.mp3';
            $uploadDir = __DIR__ . '/../../uploads/user_' . $userId;
            
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $filePath = $uploadDir . '/' . $filename;
            file_put_contents($filePath, $audioData);
            $fileUrl = '/uploads/user_' . $userId . '/' . $filename;
            
            return successResponse([
                'text' => $text,
                'language' => $language,
                'voice_id' => $voiceId,
                'rate' => $rate,
                'pitch' => $pitch,
                'audio_url' => $fileUrl,
                'method' => 'azure_tts'
            ]);
            
        } catch (Exception $e) {
            error_log("TTS error: " . $e->getMessage());
            return errorResponse('TTS generation failed', 500);
        }
    }
    
    return errorResponse('TTS route not found', 404);
}

