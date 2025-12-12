<?php
/**
 * Media Routes Handler
 * Sprint 3: File upload, image processing, compression
 */

require_once __DIR__ . '/../auth.php';

function handleMediaRoutes($method, $pathParts, $data, $authToken) {
    $user = requireAuth($authToken);
    
    // Get DB connection (will be used later if needed)
    $db = getDB();
    
    // POST /media (file upload)
    if ($method === 'POST' && count($pathParts) === 1) {
        try {
            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                return errorResponse('No file uploaded or upload error', 400);
            }
            
            $file = $_FILES['file'];
            $uploadDir = __DIR__ . '/../../uploads/';
            $userId = $user['id'];
            
            // Create user-specific directory
            $userDir = $uploadDir . 'user_' . $userId . '/';
            if (!is_dir($userDir)) {
                mkdir($userDir, 0755, true);
            }
            
            // Generate unique filename
            $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = uniqid('media_', true) . '.' . $extension;
            $filePath = $userDir . $filename;
            
            // Move uploaded file
            if (!move_uploaded_file($file['tmp_name'], $filePath)) {
                return errorResponse('Failed to save file', 500);
            }
            
            // Get file info
            $fileSize = filesize($filePath);
            $mimeType = mime_content_type($filePath);
            $fileType = strpos($mimeType, 'image/') === 0 ? 'image' : 
                       (strpos($mimeType, 'audio/') === 0 ? 'audio' : 'other');
            
            // Generate URL (relative to backend root, without leading slash)
            $fileUrl = 'uploads/user_' . $userId . '/' . $filename;
            
            // Save to database
            $stmt = $db->prepare("
                INSERT INTO media (user_id, filename, original_filename, file_path, file_url, file_type, file_size, mime_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $userId,
                $filename,
                $file['name'],
                $filePath,
                $fileUrl,
                $fileType,
                $fileSize,
                $mimeType
            ]);
            
            $mediaId = $db->lastInsertId();
            
            return successResponse([
                'id' => (int)$mediaId,
                'url' => $fileUrl,
                'filename' => $filename,
                'original_filename' => $file['name'],
                'file_type' => $fileType,
                'file_size' => $fileSize,
                'mime_type' => $mimeType
            ], 201);
            
        } catch (Exception $e) {
            error_log("File upload error: " . $e->getMessage());
            return errorResponse('File upload failed', 500);
        }
    }
    
    // POST /media/compress (compress image)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'compress') {
        $imageUrl = $data['image_url'] ?? $data['url'] ?? null;
        $quality = isset($data['quality']) ? (int)$data['quality'] : 80;
        $maxWidth = isset($data['max_width']) ? (int)$data['max_width'] : 800;
        $maxHeight = isset($data['max_height']) ? (int)$data['max_height'] : 800;
        
        if (!$imageUrl) {
            return errorResponse('image_url is required', 400);
        }
        
        try {
            // Resolve file path
            $filePath = __DIR__ . '/../..' . $imageUrl;
            if (!file_exists($filePath)) {
                return errorResponse('Image file not found', 404);
            }
            
            // Get image info
            $imageInfo = getimagesize($filePath);
            if (!$imageInfo) {
                return errorResponse('Invalid image file', 400);
            }
            
            $width = $imageInfo[0];
            $height = $imageInfo[1];
            $mimeType = $imageInfo['mime'];
            
            // Calculate new dimensions (maintain aspect ratio)
            $ratio = min($maxWidth / $width, $maxHeight / $height, 1);
            $newWidth = (int)($width * $ratio);
            $newHeight = (int)($height * $ratio);
            
            // Create image resource
            switch ($mimeType) {
                case 'image/jpeg':
                    $source = imagecreatefromjpeg($filePath);
                    break;
                case 'image/png':
                    $source = imagecreatefrompng($filePath);
                    break;
                case 'image/gif':
                    $source = imagecreatefromgif($filePath);
                    break;
                default:
                    return errorResponse('Unsupported image type', 400);
            }
            
            // Create resized image
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            
            // Preserve transparency for PNG/GIF
            if ($mimeType === 'image/png' || $mimeType === 'image/gif') {
                imagealphablending($resized, false);
                imagesavealpha($resized, true);
                $transparent = imagecolorallocatealpha($resized, 255, 255, 255, 127);
                imagefilledrectangle($resized, 0, 0, $newWidth, $newHeight, $transparent);
            }
            
            imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            
            // Save compressed image
            $compressedPath = $filePath;
            switch ($mimeType) {
                case 'image/jpeg':
                    imagejpeg($resized, $compressedPath, $quality);
                    break;
                case 'image/png':
                    imagepng($resized, $compressedPath, 9);
                    break;
                case 'image/gif':
                    imagegif($resized, $compressedPath);
                    break;
            }
            
            imagedestroy($source);
            imagedestroy($resized);
            
            $newSize = filesize($compressedPath);
            
            return successResponse([
                'url' => $imageUrl,
                'original_size' => filesize($filePath),
                'compressed_size' => $newSize,
                'compression_ratio' => round((1 - $newSize / filesize($filePath)) * 100, 2) . '%',
                'dimensions' => ['width' => $newWidth, 'height' => $newHeight]
            ]);
            
        } catch (Exception $e) {
            error_log("Image compression error: " . $e->getMessage());
            return errorResponse('Image compression failed', 500);
        }
    }
    
    // POST /media/square (make image square)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'square') {
        $imageUrl = $data['image_url'] ?? $data['url'] ?? null;
        $size = isset($data['size']) ? (int)$data['size'] : 400;
        
        if (!$imageUrl) {
            return errorResponse('image_url is required', 400);
        }
        
        try {
            $filePath = __DIR__ . '/../..' . $imageUrl;
            if (!file_exists($filePath)) {
                return errorResponse('Image file not found', 404);
            }
            
            $imageInfo = getimagesize($filePath);
            if (!$imageInfo) {
                return errorResponse('Invalid image file', 400);
            }
            
            $width = $imageInfo[0];
            $height = $imageInfo[1];
            $mimeType = $imageInfo['mime'];
            
            // Create square image
            $square = imagecreatetruecolor($size, $size);
            
            // Fill with white background
            $white = imagecolorallocate($square, 255, 255, 255);
            imagefill($square, 0, 0, $white);
            
            // Load source image
            switch ($mimeType) {
                case 'image/jpeg':
                    $source = imagecreatefromjpeg($filePath);
                    break;
                case 'image/png':
                    $source = imagecreatefrompng($filePath);
                    imagealphablending($square, false);
                    imagesavealpha($square, true);
                    break;
                case 'image/gif':
                    $source = imagecreatefromgif($filePath);
                    break;
                default:
                    return errorResponse('Unsupported image type', 400);
            }
            
            // Calculate position to center image
            $scale = min($size / $width, $size / $height);
            $newWidth = (int)($width * $scale);
            $newHeight = (int)($height * $scale);
            $x = (int)(($size - $newWidth) / 2);
            $y = (int)(($size - $newHeight) / 2);
            
            imagecopyresampled($square, $source, $x, $y, 0, 0, $newWidth, $newHeight, $width, $height);
            
            // Save
            switch ($mimeType) {
                case 'image/jpeg':
                    imagejpeg($square, $filePath, 90);
                    break;
                case 'image/png':
                    imagepng($square, $filePath, 9);
                    break;
                case 'image/gif':
                    imagegif($square, $filePath);
                    break;
            }
            
            imagedestroy($source);
            imagedestroy($square);
            
            return successResponse([
                'url' => $imageUrl,
                'size' => $size,
                'dimensions' => ['width' => $size, 'height' => $size]
            ]);
            
        } catch (Exception $e) {
            error_log("Square image error: " . $e->getMessage());
            return errorResponse('Failed to create square image', 500);
        }
    }
    
    // POST /media/text-to-image (image search using photocen.com API)
    // Note: $pathParts includes 'media' as first element, so ['media', 'text-to-image']
    // Also handle if pathParts[0] is 'text-to-image' (in case routing is different)
    if ($method === 'POST' && (
        (count($pathParts) === 2 && isset($pathParts[1]) && $pathParts[1] === 'text-to-image') ||
        (count($pathParts) === 1 && isset($pathParts[0]) && $pathParts[0] === 'text-to-image')
    )) {
        // Check if curl extension is available
        if (!function_exists('curl_init')) {
            error_log("cURL extension is not available");
            return errorResponse('cURL extension is required for image search', 500);
        }
        
        $query = $data['query'] ?? $data['text'] ?? ''; // Support both 'query' and 'text' for backward compatibility
        
        if (empty($query)) {
            return errorResponse('query is required', 400);
        }
        
        // Validate user exists
        if (!isset($user['id'])) {
            error_log("User ID not found in user object");
            return errorResponse('User authentication error', 401);
        }
        
        try {
            // Call photocen.com API to get image based on query/keywords
            $photocenUrl = 'https://photocen.com/api.php';
            $encodedQuery = urlencode($query);
            
            // Use GET method first (simpler and more reliable)
            // Note: The API might be behind Cloudflare which could be blocking automated requests
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $photocenUrl . '?query=' . $encodedQuery,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 20, // Increased timeout for slow responses
                CURLOPT_CONNECTTIMEOUT => 10, // Increased connection timeout
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 5,
                CURLOPT_SSL_VERIFYPEER => true, // Enable SSL verification (proper setup)
                CURLOPT_SSL_VERIFYHOST => 2, // Verify hostname
                CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // Realistic user agent
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_2_0, // Try HTTP/2 (photocen.com supports it)
                CURLOPT_HTTPHEADER => [
                    'Accept: application/json, text/plain, */*',
                    'Accept-Language: en-US,en;q=0.9',
                    'Cache-Control: no-cache'
                ]
            ]);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            $curlInfo = curl_getinfo($ch);
            curl_close($ch);
            
            // Log detailed information for debugging
            error_log("Photocen API call - Query: $query, HTTP Code: $httpCode, Response length: " . strlen($response));
            if ($curlError) {
                error_log("Photocen API curl error: " . $curlError);
            }
            
            // If GET fails, try POST method
            if ($curlError || $httpCode !== 200) {
                error_log("GET method failed, trying POST method...");
                $postData = json_encode(['query' => $query]);
                
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => $photocenUrl,
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => $postData,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => [
                        'Content-Type: application/json',
                        'Accept: application/json',
                        'Accept-Language: en-US,en;q=0.9',
                        'Cache-Control: no-cache'
                    ],
                    CURLOPT_TIMEOUT => 20, // Increased timeout
                    CURLOPT_CONNECTTIMEOUT => 10, // Increased connection timeout
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS => 5,
                    CURLOPT_SSL_VERIFYPEER => true, // Enable SSL verification
                    CURLOPT_SSL_VERIFYHOST => 2, // Verify hostname
                    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_2_0 // Try HTTP/2
                ]);
                
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);
                
                error_log("Photocen API POST - HTTP Code: $httpCode, Response length: " . strlen($response));
            }
            
            if ($curlError || $httpCode !== 200) {
                error_log("Photocen API error: HTTP $httpCode, " . ($curlError ?: 'Unknown error') . ", Response: " . substr($response, 0, 200));
                
                // Provide more helpful error message
                if ($curlError && (strpos($curlError, 'timeout') !== false || strpos($curlError, 'timed out') !== false)) {
                    return errorResponse('The image search service (photocen.com) is currently unavailable or taking too long to respond. The API may be down, blocked, or require authentication. Please try again later or contact support if the issue persists.', 503);
                } elseif ($httpCode === 0) {
                    return errorResponse('Unable to connect to image search service. The service may be down, unreachable, or blocked by firewall. Please check your network connection and try again.', 503);
                } else {
                    return errorResponse('Failed to fetch image from photocen.com: ' . ($curlError ?: "HTTP $httpCode. The API may not be publicly available or may require authentication."), 500);
                }
            }
            
            if (empty($response)) {
                error_log("Photocen API returned empty response");
                return errorResponse('Empty response from photocen.com API', 500);
            }
            
            // Parse response - photocen.com returns JSON with image array
            // Expected format: {"success": true, "result": [{"previewUrl": "...", "originalUrl": "..."}, ...]}
            $imageUrl = null;
            $imageData = null;
            
            // Trim whitespace from response
            $response = trim($response);
            
            // Try to parse as JSON first
            $jsonResponse = json_decode($response, true);
            if (json_last_error() === JSON_ERROR_NONE && $jsonResponse) {
                error_log("Photocen API returned JSON response");
                
                // Check if API returned success with results
                if (isset($jsonResponse['success']) && $jsonResponse['success'] === true && isset($jsonResponse['result']) && is_array($jsonResponse['result']) && count($jsonResponse['result']) > 0) {
                    // Get the first image from results
                    $firstImage = $jsonResponse['result'][0];
                    
                    // Prefer originalUrl, fallback to previewUrl
                    if (isset($firstImage['originalUrl']) && !empty($firstImage['originalUrl'])) {
                        $imageUrl = $firstImage['originalUrl'];
                        error_log("Using originalUrl from Photocen API: " . substr($imageUrl, 0, 100));
                    } elseif (isset($firstImage['previewUrl']) && !empty($firstImage['previewUrl'])) {
                        $imageUrl = $firstImage['previewUrl'];
                        error_log("Using previewUrl from Photocen API: " . substr($imageUrl, 0, 100));
                    } else {
                        error_log("No URL found in first image result");
                    }
                } elseif (isset($jsonResponse['url'])) {
                    // Fallback: direct URL in response
                    $imageUrl = $jsonResponse['url'];
                } elseif (isset($jsonResponse['image'])) {
                    // Fallback: base64 image data
                    $imageData = $jsonResponse['image'];
                } elseif (isset($jsonResponse['data'])) {
                    // Fallback: data field
                    $imageData = $jsonResponse['data'];
                } else {
                    error_log("Photocen API JSON response format unexpected: " . substr($response, 0, 200));
                }
            } elseif (filter_var($response, FILTER_VALIDATE_URL)) {
                // Response is a direct URL (not JSON)
                error_log("Photocen API returned direct URL: " . substr($response, 0, 100));
                $imageUrl = $response;
            } elseif (preg_match('/^data:image\//', $response)) {
                // Response is data URI
                error_log("Photocen API returned data URI");
                $imageData = $response;
            } elseif (preg_match('/^https?:\/\//', $response)) {
                // Response looks like a URL (even if filter_var failed)
                error_log("Photocen API returned URL-like string: " . substr($response, 0, 100));
                $imageUrl = $response;
            } else {
                // Check if response is binary image data
                $imageMagicBytes = [
                    "\xFF\xD8\xFF", // JPEG
                    "\x89\x50\x4E\x47", // PNG
                    "GIF87a", // GIF
                    "GIF89a", // GIF
                    "RIFF" // WebP
                ];
                
                $isBinaryImage = false;
                foreach ($imageMagicBytes as $magic) {
                    if (substr($response, 0, strlen($magic)) === $magic) {
                        $isBinaryImage = true;
                        break;
                    }
                }
                
                if ($isBinaryImage) {
                    error_log("Photocen API returned binary image data");
                    $imageData = $response;
                } else {
                    error_log("Photocen API response format unknown: " . substr($response, 0, 200));
                }
            }
            
            // If we got an image URL, download it
            if ($imageUrl) {
                error_log("Downloading image from URL: " . substr($imageUrl, 0, 100));
                $ch = curl_init();
                curl_setopt_array($ch, [
                    CURLOPT_URL => $imageUrl,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 30,
                    CURLOPT_CONNECTTIMEOUT => 10,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS => 5,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => false
                ]);
                $imageData = curl_exec($ch);
                $imageHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $imageCurlError = curl_error($ch);
                curl_close($ch);
                
                if ($imageCurlError || $imageHttpCode !== 200 || !$imageData) {
                    error_log("Failed to download image from photocen.com: HTTP $imageHttpCode, " . ($imageCurlError ?: 'No data') . ", URL: " . substr($imageUrl, 0, 100));
                    return errorResponse('Failed to download image from photocen.com. HTTP ' . $imageHttpCode, 500);
                }
                
                error_log("Successfully downloaded image, size: " . strlen($imageData) . " bytes");
            }
            
            if (!$imageData) {
                error_log("No image data available. imageUrl: " . ($imageUrl ? 'set' : 'null') . ", imageData: " . ($imageData ? 'set' : 'null'));
                return errorResponse('No image data received from photocen.com. Please check server logs for details.', 500);
            }
            
            // Save image to user directory
            $uploadDir = __DIR__ . '/../../uploads/user_' . $user['id'] . '/';
            if (!is_dir($uploadDir)) {
                $created = @mkdir($uploadDir, 0755, true);
                if (!$created) {
                    error_log("Failed to create upload directory: $uploadDir");
                    return errorResponse('Failed to create upload directory. Check permissions.', 500);
                }
            }
            
            // Check if directory is writable
            if (!is_writable($uploadDir)) {
                error_log("Upload directory is not writable: $uploadDir");
                return errorResponse('Upload directory is not writable. Check permissions.', 500);
            }
            
            // Determine file extension from content or URL
            $extension = 'jpg'; // Default
            if ($imageUrl) {
                $parsedUrl = parse_url($imageUrl);
                $path = $parsedUrl['path'] ?? '';
                if (preg_match('/\.(jpg|jpeg|png|gif|webp)$/i', $path, $matches)) {
                    $extension = strtolower($matches[1]);
                    if ($extension === 'jpeg') $extension = 'jpg';
                }
            }
            
            $filename = 'photocen_' . uniqid() . '.' . $extension;
            $filePath = $uploadDir . $filename;
            
            // Save image data
            if (file_put_contents($filePath, $imageData) === false) {
                return errorResponse('Failed to save image file. Check directory permissions.', 500);
            }
            
            // Verify file was created
            if (!file_exists($filePath)) {
                return errorResponse('Image file was not created', 500);
            }
            
            $fileSize = filesize($filePath);
            // Return URL with /api/ prefix to ensure it works through nginx proxy
            // Frontend will handle URL construction properly
            $fileUrl = 'api/uploads/user_' . $user['id'] . '/' . $filename;
            
            // Save to database (optional - continue even if DB fails)
            if ($db) {
                try {
                    $mimeType = 'image/' . ($extension === 'jpg' ? 'jpeg' : $extension);
                    $stmt = $db->prepare("
                        INSERT INTO media (user_id, filename, original_filename, file_path, file_url, file_type, file_size, mime_type, created_at)
                        VALUES (?, ?, ?, ?, ?, 'image', ?, ?, NOW())
                    ");
                    $stmt->execute([
                        $user['id'],
                        $filename,
                        'photocen-' . $query . '.' . $extension,
                        $filePath,
                        $fileUrl,
                        $fileSize,
                        $mimeType
                    ]);
                } catch (Exception $dbError) {
                    // File was created but DB insert failed - still return success with URL
                    error_log("Media DB insert error: " . $dbError->getMessage());
                }
            } else {
                error_log("Database not available - skipping media table insert");
            }
            
            return successResponse([
                'url' => $fileUrl,
                'filename' => $filename,
                'query' => $query
            ], 201);
            
        } catch (Throwable $e) {
            // Catch both Exception and Error (PHP 7+)
            error_log("Photocen API error: " . $e->getMessage());
            error_log("Error type: " . get_class($e));
            error_log("File: " . $e->getFile() . " Line: " . $e->getLine());
            error_log("Stack trace: " . $e->getTraceAsString());
            
            $errorMessage = 'Image search failed: ' . $e->getMessage();
            return errorResponse($errorMessage, 500);
        } catch (Exception $e) {
            // Fallback for PHP < 7
            error_log("Photocen API error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Image search failed: ' . $e->getMessage(), 500);
        }
    }
    
    return errorResponse('Media route not found', 404);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb($hex) {
    $hex = ltrim($hex, '#');
    return [
        'r' => hexdec(substr($hex, 0, 2)),
        'g' => hexdec(substr($hex, 2, 2)),
        'b' => hexdec(substr($hex, 4, 2))
    ];
}
