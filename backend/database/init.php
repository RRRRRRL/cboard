<?php
/**
 * Database Initialization Script
 * 
 * Run this script to initialize the database connection
 * Usage: require_once 'database/init.php';
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/config.php';

class Database {
    private static $instance = null;
    private $connection = null;
    
    private function __construct() {
        $config = require __DIR__ . '/../config/database.php';
        
        $dsn = sprintf(
            "mysql:host=%s;port=%s;dbname=%s;charset=%s",
            $config['host'],
            $config['port'],
            $config['database'],
            $config['charset']
        );
        
        try {
            $this->connection = new PDO(
                $dsn,
                $config['username'],
                $config['password'],
                $config['options']
            );
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            // Don't throw exception immediately - allow placeholder endpoints to work
            // Throw only when actually trying to use the connection
            $this->connection = null;
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    public function query($sql, $params = []) {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            error_log("Query failed: " . $e->getMessage());
            throw new Exception("Database query failed");
        }
    }
    
    public function lastInsertId() {
        return $this->connection->lastInsertId();
    }
}

// Helper function for easy access
function getDB() {
    $db = Database::getInstance();
    $conn = $db->getConnection();
    
    if ($conn === null) {
        // Database not connected - log error and throw exception
        $config = require __DIR__ . '/../config/database.php';
        error_log("Database connection failed. Host: {$config['host']}, Database: {$config['database']}, User: {$config['username']}");
        throw new Exception("Database connection failed. Please check server configuration.");
    }
    
    return $conn;
}

