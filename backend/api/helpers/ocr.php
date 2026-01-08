<?php
/**
 * OCR Helper Functions
 * Uses Photocen AI for OCR processing
 */

require_once __DIR__ . '/../auth.php';

/**
 * Get OCR configuration from environment
 */
function getOCRConfig() {
    $envVal = getenv('PHOTOCEN_OCR_ENABLED');

    // If the env var is not set, default to enabled (true).
    if ($envVal === false || $envVal === null) {
        $photocen_enabled = true;
    } else {
        // Parse boolean strings like "true"/"false" correctly.
        $parsed = filter_var($envVal, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        // If parsing fails (invalid value), treat as false to avoid accidental enablement.
        $photocen_enabled = ($parsed === null) ? false : $parsed;
    }

    return [
        'photocen_enabled' => $photocen_enabled,
        'photocen_api_url' => getenv('PHOTOCEN_API_URL') ?: 'https://ai.photocen.com/api',
        'photocen_token' => getenv('PHOTOCEN_OCR_TOKEN') ?: null,
        'timeout' => getenv('OCR_TIMEOUT') ?: 120 // 2 minutes timeout
    ];
}

/**
 * Perform OCR using Photocen AI
 * Directly uploads image to OCR endpoint
 *
 * @param string $imageData - Base64 encoded image data
 * @return array - OCR result
 */
function performPhotocenOCR($imageData) {
    $config = getOCRConfig();

    

    if (!$config['photocen_enabled']) {
        
        return [
            'success' => false,
            'error' => 'Photocen OCR is disabled'
        ];
    }

    try {
        // Create temp file from base64
        $tempFile = createTempImageFromBase64($imageData);
        if (!$tempFile) {
            
            return [
                'success' => false,
                'error' => 'Failed to create image file'
            ];
        }

        

        try {
            // Prepare multipart form data using CURLFile so libcurl handles boundaries
            $cfile = curl_file_create($tempFile, mime_content_type($tempFile), basename($tempFile));
            $postFields = ['image' => $cfile];

            

            // Make HTTP request to OCR endpoint
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $config['photocen_api_url'] . '/ocr');
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);

            // Set headers; include Authorization if token present
            $headers = [];
            if (!empty($config['photocen_token'])) {
                $headers[] = 'Authorization: Bearer ' . $config['photocen_token'];
            }
            if (!empty($headers)) {
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            }

            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, $config['timeout']);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            

            if ($curlError) {
                
                return [
                    'success' => false,
                    'error' => 'OCR request failed: ' . $curlError
                ];
            }

            if ($httpCode !== 200) {
                
                return [
                    'success' => false,
                    'error' => 'OCR request failed with HTTP ' . $httpCode
                ];
            }

            $responseData = json_decode($response, true);
            if (!$responseData) {
                
                return [
                    'success' => false,
                    'error' => 'Invalid OCR response'
                ];
            }

                

        // Check if it's a timeout response with status URL
        if (isset($responseData['error']) && isset($responseData['check_status_url'])) {
            return [
                'success' => false,
                'error' => $responseData['error'],
                'check_status_url' => $responseData['check_status_url'],
                'timeout' => true
            ];
        }

        // Check for successful OCR response
        if (!isset($responseData['original_text'])) {
            return [
                'success' => false,
                'error' => 'OCR response missing text data'
            ];
        }

        return [
            'success' => true,
            'text' => $responseData['original_text'] ?? '',
            'corrected_text' => $responseData['corrected_text'] ?? $responseData['original_text'],
            'confidence' => 0.9, // Photocen doesn't provide confidence, assume high
            'language' => detectLanguage($responseData['original_text'] ?? ''),
            'provider' => 'photocen'
        ];

        } finally {
            if (isset($tempFile) && file_exists($tempFile)) {
                @unlink($tempFile);
            }
        }

    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => 'OCR exception: ' . $e->getMessage()
        ];
    }
}

/**
 * Check OCR job status
 *
 * @param string $jobId - Job ID from Photocen
 * @return array - Job status
 */
function checkOCRJobStatus($jobId) {
    $config = getOCRConfig();

    try {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $config['photocen_api_url'] . '/job/' . $jobId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            return [
                'success' => false,
                'error' => 'Status check failed: ' . $curlError
            ];
        }

        if ($httpCode !== 200) {
            return [
                'success' => false,
                'error' => 'Status check failed with HTTP ' . $httpCode
            ];
        }

        $responseData = json_decode($response, true);
        if (!$responseData) {
            return [
                'success' => false,
                'error' => 'Invalid status response'
            ];
        }

        return [
            'success' => true,
            'status' => $responseData['status'] ?? 'unknown',
            'progress' => $responseData['progress'] ?? 0,
            'result' => $responseData
        ];

    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => 'Status check exception: ' . $e->getMessage()
        ];
    }
}

/**
 * Main OCR recognition function
 * Uses Photocen AI for OCR processing
 *
 * @param string $imagePath - Path to image file (unused, kept for compatibility)
 * @param string $imageData - Base64 encoded image data
 * @return array - OCR result with text, confidence, provider info
 */
function recognizeText($imagePath = null, $imageData = null) {
    $config = getOCRConfig();

    // Validate input
    if (!$imageData) {
        return [
            'success' => false,
            'error' => 'No image data provided',
            'text' => '',
            'confidence' => 0.0,
            'provider' => 'none'
        ];
    }

    if (!$config['photocen_enabled']) {
        return [
            'success' => false,
            'error' => 'OCR is disabled',
            'text' => '',
            'confidence' => 0.0,
            'provider' => 'disabled'
        ];
    }

    try {
        // Perform OCR directly with Photocen
        $ocrResult = performPhotocenOCR($imageData);

        // Handle timeout case
        if (isset($ocrResult['timeout']) && $ocrResult['timeout']) {
            return [
                'success' => false,
                'error' => $ocrResult['error'] ?? 'OCR job timed out',
                'check_status_url' => $ocrResult['check_status_url'] ?? null,
                'timeout' => true,
                'provider' => 'photocen'
            ];
        }

        return $ocrResult;

    } catch (Exception $e) {
        error_log("OCR recognition error: " . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage(),
            'text' => '',
            'confidence' => 0.0,
            'provider' => 'photocen'
        ];
    }
}

/**
 * Detect language of text
 *
 * @param string $text - Text to analyze
 * @return string - Language code
 */
function detectLanguage($text) {
    if (empty($text)) return 'unknown';

    // Count Chinese characters
    $chineseChars = preg_match_all('/\p{Han}/u', $text, $matches);
    $totalChars = mb_strlen($text);

    if ($chineseChars > 0) {
        $chineseRatio = $chineseChars / $totalChars;
        if ($chineseRatio > 0.3) {
            return 'zh'; // Chinese
        }
    }

    // Default to English for now
    return 'en';
}

/**
 * Create temporary image file from base64 data
 *
 * @param string $base64Data - Base64 encoded image data
 * @return string|null - Path to temporary file or null on failure
 */
function createTempImageFromBase64($base64Data) {
    // Remove data URL prefix if present
    $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $base64Data);
    $imageData = base64_decode($base64Data);

    if ($imageData === false) {
        return null;
    }

    $tempFile = sys_get_temp_dir() . '/ocr_image_' . uniqid() . '.png';
    if (file_put_contents($tempFile, $imageData) === false) {
        return null;
    }

    return $tempFile;
}

/**
 * Check if Photocen OCR is available
 *
 * @return bool - True if available
 */
function isPhotocenOCRAvailable() {
    $config = getOCRConfig();
    return $config['photocen_enabled'];
}

/**
 * Get OCR status information
 *
 * @return array - Status information
 */
function getOCRStatus() {
    return [
        'photocen_available' => isPhotocenOCRAvailable(),
        'config' => getOCRConfig()
    ];
}
