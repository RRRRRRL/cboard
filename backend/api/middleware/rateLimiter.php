<?php
/**
 * Rate Limiting Middleware
 * 
 * Implements token bucket algorithm for API rate limiting
 * Prevents DDoS attacks and API abuse
 */

class RateLimiter {
    private $db;
    private $maxRequests;
    private $windowSeconds;
    private $identifier;
    
    /**
     * Constructor
     * 
     * @param PDO $db Database connection
     * @param int $maxRequests Maximum requests per window
     * @param int $windowSeconds Time window in seconds
     */
    public function __construct($db, $maxRequests = 100, $windowSeconds = 60) {
        $this->db = $db;
        $this->maxRequests = $maxRequests;
        $this->windowSeconds = $windowSeconds;
        $this->identifier = $this->getIdentifier();
    }
    
    /**
     * Get client identifier (IP address or user ID)
     */
    private function getIdentifier() {
        // Try to get user ID from token first
        $headers = getallheaders();
        $authToken = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        
        if ($authToken) {
            $authToken = str_replace('Bearer ', '', $authToken);
            require_once __DIR__ . '/../auth.php';
            $payload = JWT::decode($authToken);
            if ($payload && isset($payload['user_id'])) {
                return 'user_' . $payload['user_id'];
            }
        }
        
        // Fallback to IP address
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        return 'ip_' . $ip;
    }
    
    /**
     * Check if request is allowed
     * 
     * @return array ['allowed' => bool, 'remaining' => int, 'reset' => int]
     */
    public function check() {
        try {
            // Create rate_limit_logs table if it doesn't exist
            $this->createTableIfNotExists();
            
            // Clean old entries
            $this->cleanOldEntries();
            
            // Get current count for this identifier in the time window
            $windowStart = time() - $this->windowSeconds;
            $stmt = $this->db->prepare("
                SELECT COUNT(*) as count 
                FROM rate_limit_logs 
                WHERE identifier = ? AND created_at > FROM_UNIXTIME(?)
            ");
            $stmt->execute([$this->identifier, $windowStart]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $currentCount = (int)$result['count'];
            
            // Check if limit exceeded
            if ($currentCount >= $this->maxRequests) {
                // Get reset time (oldest entry in window + window duration)
                $stmt = $this->db->prepare("
                    SELECT UNIX_TIMESTAMP(MIN(created_at)) + ? as reset_time
                    FROM rate_limit_logs
                    WHERE identifier = ? AND created_at > FROM_UNIXTIME(?)
                ");
                $stmt->execute([$this->windowSeconds, $this->identifier, $windowStart]);
                $resetResult = $stmt->fetch(PDO::FETCH_ASSOC);
                $resetTime = (int)$resetResult['reset_time'];
                
                return [
                    'allowed' => false,
                    'remaining' => 0,
                    'reset' => $resetTime,
                    'limit' => $this->maxRequests,
                    'window' => $this->windowSeconds
                ];
            }
            
            // Log this request
            $stmt = $this->db->prepare("
                INSERT INTO rate_limit_logs (identifier, created_at) 
                VALUES (?, NOW())
            ");
            $stmt->execute([$this->identifier]);
            
            $remaining = $this->maxRequests - $currentCount - 1;
            $resetTime = time() + $this->windowSeconds;
            
            return [
                'allowed' => true,
                'remaining' => max(0, $remaining),
                'reset' => $resetTime,
                'limit' => $this->maxRequests,
                'window' => $this->windowSeconds
            ];
            
        } catch (Exception $e) {
            error_log("Rate limiter error: " . $e->getMessage());
            // On error, allow request (fail open)
            return [
                'allowed' => true,
                'remaining' => $this->maxRequests,
                'reset' => time() + $this->windowSeconds,
                'limit' => $this->maxRequests,
                'window' => $this->windowSeconds
            ];
        }
    }
    
    /**
     * Create rate_limit_logs table if it doesn't exist
     */
    private function createTableIfNotExists() {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS rate_limit_logs (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                identifier VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                INDEX idx_identifier_created (identifier, created_at),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
    
    /**
     * Clean old entries (older than 2x window duration)
     */
    private function cleanOldEntries() {
        $cutoffTime = time() - ($this->windowSeconds * 2);
        $stmt = $this->db->prepare("
            DELETE FROM rate_limit_logs 
            WHERE created_at < FROM_UNIXTIME(?)
        ");
        $stmt->execute([$cutoffTime]);
    }
    
    /**
     * Get rate limit configuration for different endpoint types
     * 
     * @param string $endpoint Endpoint path
     * @return array [maxRequests, windowSeconds]
     */
    public static function getConfigForEndpoint($endpoint) {
        // Stricter limits for authentication endpoints
        if (strpos($endpoint, '/auth') !== false || strpos($endpoint, '/login') !== false) {
            return [10, 60]; // 10 requests per minute
        }
        
        // Stricter limits for registration
        if (strpos($endpoint, '/register') !== false) {
            return [5, 60]; // 5 requests per minute
        }
        
        // Moderate limits for TTS (resource-intensive)
        if (strpos($endpoint, '/tts') !== false) {
            return [50, 60]; // 50 requests per minute
        }
        
        // Default limits
        return [100, 60]; // 100 requests per minute
    }
}

/**
 * Apply rate limiting to request
 * 
 * @param string $endpoint Request endpoint
 * @return bool True if allowed, false if rate limited
 */
function applyRateLimit($endpoint) {
    try {
        $db = getDB();
        if (!$db) {
            return true; // Fail open if DB unavailable
        }
        
        list($maxRequests, $windowSeconds) = RateLimiter::getConfigForEndpoint($endpoint);
        $limiter = new RateLimiter($db, $maxRequests, $windowSeconds);
        $result = $limiter->check();
        
        // Set rate limit headers
        header('X-RateLimit-Limit: ' . $result['limit']);
        header('X-RateLimit-Remaining: ' . $result['remaining']);
        header('X-RateLimit-Reset: ' . $result['reset']);
        
        if (!$result['allowed']) {
            http_response_code(429);
            echo json_encode([
                'success' => false,
                'error' => 'rate_limit_exceeded',
                'message' => 'Too many requests. Please try again later.',
                'retry_after' => $result['reset'] - time()
            ]);
            return false;
        }
        
        return true;
    } catch (Exception $e) {
        error_log("Rate limit error: " . $e->getMessage());
        return true; // Fail open
    }
}

