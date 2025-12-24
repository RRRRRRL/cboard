<?php
/**
 * OpenCC Service Helper
 * 
 * Provides integration with OpenCC API for Simplified to Traditional Chinese conversion.
 * 
 * Configuration:
 * - API URL: Can be configured via OPENCC_API_URL environment variable
 * - Default: http://localhost:8080/api/convert (if using local OpenCC service)
 */

/**
 * Convert Simplified Chinese to Traditional Chinese using OpenCC API
 * 
 * @param string $text The text to convert
 * @param string $config Conversion config (default: 's2twp' for Simplified to Traditional with phrases)
 * @return array Response with 'success', 'text', 'error' keys
 */
function convertToTraditionalChinese($text, $config = 's2twp') {
    // Configuration
    $apiUrl = getenv('OPENCC_API_URL') ?: 'http://localhost:8080/api/convert';
    
    if (empty($text)) {
        return [
            'success' => true,
            'text' => '',
            'error' => null
        ];
    }
    
    // Prepare request data
    $requestData = [
        'text' => $text,
        'config' => $config // s2twp = Simplified to Traditional (with phrases)
    ];
    
    // Make request to API
    $startTime = microtime(true);
    $ch = curl_init($apiUrl);
    
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($requestData),
        CURLOPT_SSL_VERIFYPEER => false, // Adjust based on your API setup
        CURLOPT_TIMEOUT => 30
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $duration = round((microtime(true) - $startTime) * 1000, 2);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    // Handle errors
    if ($response === false) {
        error_log("OpenCC API curl error: $curlError");
        return [
            'success' => false,
            'text' => $text, // Return original text on error
            'error' => 'Failed to connect to OpenCC service: ' . $curlError,
            'duration' => $duration
        ];
    }
    
    if ($httpCode !== 200) {
        error_log("OpenCC API HTTP error: $httpCode, Response: $response");
        return [
            'success' => false,
            'text' => $text, // Return original text on error
            'error' => "OpenCC service returned error code: $httpCode",
            'http_code' => $httpCode,
            'response' => $response,
            'duration' => $duration
        ];
    }
    
    // Parse response
    $responseData = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("OpenCC API JSON decode error: " . json_last_error_msg());
        return [
            'success' => false,
            'text' => $text, // Return original text on error
            'error' => 'Failed to parse OpenCC service response',
            'raw_response' => $response,
            'duration' => $duration
        ];
    }
    
    // Extract converted text from response
    $convertedText = '';
    if (isset($responseData['text'])) {
        $convertedText = $responseData['text'];
    } elseif (isset($responseData['result'])) {
        $convertedText = $responseData['result'];
    } elseif (isset($responseData['converted'])) {
        $convertedText = $responseData['converted'];
    } elseif (is_string($responseData)) {
        $convertedText = $responseData;
    }
    
    if (empty($convertedText)) {
        // If no converted text found, return original
        return [
            'success' => false,
            'text' => $text,
            'error' => 'No converted text in response',
            'raw_response' => $responseData,
            'duration' => $duration
        ];
    }
    
    return [
        'success' => true,
        'text' => trim($convertedText),
        'raw_response' => $responseData,
        'duration' => $duration
    ];
}

