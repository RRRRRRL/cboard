<?php
/**
 * JWT Authentication Helper
 * 
 * Simple JWT implementation for authentication
 * Note: For production, consider using firebase/php-jwt library via Composer
 */

require_once __DIR__ . '/../config/config.php';

class JWT {
    private static $secret;
    
    public static function init() {
        $config = require __DIR__ . '/../config/config.php';
        self::$secret = getenv('JWT_SECRET') ?: $config['jwt_secret'] ?? 'default-secret-key-change-in-production';
    }
    
    /**
     * Create JWT token
     */
    public static function encode($payload, $expiration = 86400) {
        self::init();
        
        $header = [
            'typ' => 'JWT',
            'alg' => 'HS256'
        ];
        
        $payload['iat'] = time();
        $payload['exp'] = time() + $expiration;
        
        $headerEncoded = self::base64UrlEncode(json_encode($header));
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        
        $signature = hash_hmac('sha256', "$headerEncoded.$payloadEncoded", self::$secret, true);
        $signatureEncoded = self::base64UrlEncode($signature);
        
        return "$headerEncoded.$payloadEncoded.$signatureEncoded";
    }
    
    /**
     * Decode and verify JWT token
     */
    public static function decode($token) {
        self::init();
        
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        
        list($headerEncoded, $payloadEncoded, $signatureEncoded) = $parts;
        
        // Verify signature
        $signature = self::base64UrlDecode($signatureEncoded);
        $expectedSignature = hash_hmac('sha256', "$headerEncoded.$payloadEncoded", self::$secret, true);
        
        if (!hash_equals($signature, $expectedSignature)) {
            return null; // Invalid signature
        }
        
        $payload = json_decode(self::base64UrlDecode($payloadEncoded), true);
        
        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null; // Token expired
        }
        
        return $payload;
    }
    
    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private static function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

/**
 * Password hashing helper
 */
class Password {
    /**
     * Hash password using bcrypt
     */
    public static function hash($password) {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }
    
    /**
     * Verify password against hash
     */
    public static function verify($password, $hash) {
        return password_verify($password, $hash);
    }
}

