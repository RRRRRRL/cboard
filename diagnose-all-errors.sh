#!/bin/bash
# Comprehensive Error Diagnostic Script for Cboard
# This script checks all possible error sources

echo "=========================================="
echo "Cboard Server Diagnostic Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check and report
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[OK]${NC} $1"
    else
        echo -e "${RED}[ERROR]${NC} $1"
        ((ERRORS++))
    fi
}

check_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    ((WARNINGS++))
}

echo "=== 1. PHP Syntax Check ==="
echo ""

echo "Checking backend/api/index.php..."
php -l /var/www/aac.uplifor.org/backend/api/index.php 2>&1
check_status "index.php syntax"

echo ""
echo "Checking backend/api/routes/user.php..."
php -l /var/www/aac.uplifor.org/backend/api/routes/user.php 2>&1
check_status "user.php syntax"

echo ""
echo "Checking backend/database/init.php..."
php -l /var/www/aac.uplifor.org/backend/database/init.php 2>&1
check_status "init.php syntax"

echo ""
echo "=== 2. Environment Configuration ==="
echo ""

if [ -f /var/www/aac.uplifor.org/.env ]; then
    echo -e "${GREEN}[OK]${NC} .env file exists"
    echo ""
    echo "Database Configuration:"
    grep -E "^DB_" /var/www/aac.uplifor.org/.env | while IFS= read -r line; do
        key=$(echo "$line" | cut -d'=' -f1)
        value=$(echo "$line" | cut -d'=' -f2)
        if [ "$key" = "DB_PASS" ]; then
            echo "  $key=***hidden***"
        else
            echo "  $key=$value"
        fi
    done
    echo ""
    
    # Check if all required vars are set
    if ! grep -q "^DB_HOST=" /var/www/aac.uplifor.org/.env; then
        check_warning "DB_HOST not set in .env"
    fi
    if ! grep -q "^DB_NAME=" /var/www/aac.uplifor.org/.env; then
        check_warning "DB_NAME not set in .env"
    fi
    if ! grep -q "^DB_USER=" /var/www/aac.uplifor.org/.env; then
        check_warning "DB_USER not set in .env"
    fi
    if ! grep -q "^DB_PASS=" /var/www/aac.uplifor.org/.env; then
        check_warning "DB_PASS not set in .env"
    fi
    if ! grep -q "^JWT_SECRET=" /var/www/aac.uplifor.org/.env; then
        check_warning "JWT_SECRET not set in .env"
    fi
else
    echo -e "${RED}[ERROR]${NC} .env file not found"
    ((ERRORS++))
fi

echo ""
echo "=== 3. Database Connection Test ==="
echo ""

php -r "
require '/var/www/aac.uplifor.org/backend/config/database.php';
\$config = require '/var/www/aac.uplifor.org/backend/config/database.php';

echo 'Configuration loaded:' . PHP_EOL;
echo '  Host: ' . \$config['host'] . PHP_EOL;
echo '  Database: ' . \$config['database'] . PHP_EOL;
echo '  User: ' . \$config['username'] . PHP_EOL;
echo '  Port: ' . \$config['port'] . PHP_EOL;
echo PHP_EOL;

try {
    \$pdo = new PDO(
        'mysql:host=' . \$config['host'] . ';port=' . \$config['port'] . ';dbname=' . \$config['database'] . ';charset=utf8mb4',
        \$config['username'],
        \$config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]
    );
    echo '[OK] Database connection successful!' . PHP_EOL;
    
    // Test query
    \$stmt = \$pdo->query('SELECT 1 as test');
    \$result = \$stmt->fetch();
    if (\$result && \$result['test'] == 1) {
        echo '[OK] Database query test successful!' . PHP_EOL;
    }
    
    // Check if users table exists
    \$stmt = \$pdo->query('SHOW TABLES LIKE \"users\"');
    if (\$stmt->rowCount() > 0) {
        echo '[OK] Users table exists' . PHP_EOL;
        
        // Count users
        \$stmt = \$pdo->query('SELECT COUNT(*) as count FROM users');
        \$result = \$stmt->fetch();
        echo '  Users in database: ' . \$result['count'] . PHP_EOL;
    } else {
        echo '[WARNING] Users table does not exist' . PHP_EOL;
    }
    
} catch (PDOException \$e) {
    echo '[ERROR] Database connection failed!' . PHP_EOL;
    echo '  Error: ' . \$e->getMessage() . PHP_EOL;
    echo PHP_EOL;
    echo 'Troubleshooting steps:' . PHP_EOL;
    echo '  1. Check if MySQL server is running: systemctl status mysql' . PHP_EOL;
    echo '  2. Test connection manually: mysql -h ' . \$config['host'] . ' -P ' . \$config['port'] . ' -u ' . \$config['username'] . ' -p' . PHP_EOL;
    echo '  3. Check firewall: iptables -L | grep 3306' . PHP_EOL;
    echo '  4. Verify database exists: mysql -h ' . \$config['host'] . ' -u ' . \$config['username'] . ' -p -e \"SHOW DATABASES;\"' . PHP_EOL;
    exit(1);
}
" 2>&1

if [ $? -eq 0 ]; then
    check_status "Database connection"
else
    ((ERRORS++))
fi

echo ""
echo "=== 4. PHP-FPM Status ==="
echo ""

systemctl status php8.3-fpm --no-pager -l 2>/dev/null || systemctl status php-fpm --no-pager -l 2>/dev/null
if [ $? -eq 0 ]; then
    check_status "PHP-FPM service"
else
    ((ERRORS++))
fi

echo ""
echo "=== 5. Nginx Status ==="
echo ""

systemctl status nginx --no-pager -l | head -20
if systemctl is-active --quiet nginx; then
    check_status "Nginx service"
else
    ((ERRORS++))
fi

echo ""
echo "Testing Nginx configuration..."
nginx -t 2>&1
check_status "Nginx configuration"

echo ""
echo "=== 6. File Permissions ==="
echo ""

WEB_USER="www-data"
if [ -d /var/www/aac.uplifor.org ]; then
    echo "Checking ownership..."
    ls -ld /var/www/aac.uplifor.org | awk '{print "  " $0}'
    
    echo ""
    echo "Checking key directories..."
    for dir in backend/api backend/config backend/database; do
        if [ -d "/var/www/aac.uplifor.org/$dir" ]; then
            perms=$(stat -c "%a" "/var/www/aac.uplifor.org/$dir" 2>/dev/null)
            echo "  $dir: $perms"
        fi
    done
    
    echo ""
    echo "Checking key files..."
    for file in backend/api/index.php backend/api/routes/user.php .env; do
        if [ -f "/var/www/aac.uplifor.org/$file" ]; then
            perms=$(stat -c "%a" "/var/www/aac.uplifor.org/$file" 2>/dev/null)
            echo "  $file: $perms"
        else
            check_warning "$file not found"
        fi
    done
fi

echo ""
echo "=== 7. Error Logs ==="
echo ""

echo "Recent PHP-FPM errors:"
tail -10 /var/log/php8.3-fpm.log 2>/dev/null || tail -10 /var/log/php-fpm.log 2>/dev/null || echo "  No PHP-FPM log found"

echo ""
echo "Recent Nginx errors:"
tail -10 /var/log/nginx/aac.uplifor.org.error.log 2>/dev/null || tail -10 /var/log/nginx/error.log 2>/dev/null || echo "  No Nginx error log found"

echo ""
echo "=== 8. API Endpoint Test ==="
echo ""

echo "Testing root API endpoint..."
ROOT_RESPONSE=$(curl -k -s -w "\nHTTP_CODE:%{http_code}" https://localhost/api 2>&1)
HTTP_CODE=$(echo "$ROOT_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
BODY=$(echo "$ROOT_RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}[OK]${NC} Root API endpoint responds"
    echo "  Response: $BODY"
else
    echo -e "${RED}[ERROR]${NC} Root API endpoint failed (HTTP $HTTP_CODE)"
    echo "  Response: $BODY"
    ((ERRORS++))
fi

echo ""
echo "Testing login endpoint..."
LOGIN_RESPONSE=$(curl -k -s -w "\nHTTP_CODE:%{http_code}" -X POST https://localhost/api/user/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com","password":"test123"}' 2>&1)
LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | grep -v "HTTP_CODE")

echo "  HTTP Status: $LOGIN_HTTP_CODE"
echo "  Response: $LOGIN_BODY"

if [ "$LOGIN_HTTP_CODE" = "500" ]; then
    echo -e "${RED}[ERROR]${NC} Login endpoint returns 500 - check error logs above"
    ((ERRORS++))
elif [ "$LOGIN_HTTP_CODE" = "400" ] || [ "$LOGIN_HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}[OK]${NC} Login endpoint responds (expected error for test credentials)"
else
    echo -e "${YELLOW}[WARNING]${NC} Unexpected HTTP code: $LOGIN_HTTP_CODE"
fi

echo ""
echo "=== 9. Network Connectivity ==="
echo ""

# Extract DB_HOST from .env
if [ -f /var/www/aac.uplifor.org/.env ]; then
    DB_HOST=$(grep "^DB_HOST=" /var/www/aac.uplifor.org/.env | cut -d'=' -f2)
    if [ -n "$DB_HOST" ]; then
        echo "Testing connection to database server: $DB_HOST"
        if timeout 3 bash -c "echo > /dev/tcp/$DB_HOST/3306" 2>/dev/null; then
            echo -e "${GREEN}[OK]${NC} Database server $DB_HOST:3306 is reachable"
        else
            echo -e "${RED}[ERROR]${NC} Cannot reach database server $DB_HOST:3306"
            echo "  Check firewall rules and network connectivity"
            ((ERRORS++))
        fi
    fi
fi

echo ""
echo "=== 10. Required PHP Extensions ==="
echo ""

REQUIRED_EXTENSIONS=("pdo" "pdo_mysql" "json" "mbstring" "openssl")
for ext in "${REQUIRED_EXTENSIONS[@]}"; do
    if php -m | grep -q "^$ext$"; then
        echo -e "${GREEN}[OK]${NC} PHP extension $ext is loaded"
    else
        echo -e "${RED}[ERROR]${NC} PHP extension $ext is NOT loaded"
        ((ERRORS++))
    fi
done

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found, but no critical errors${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Please review the errors above and fix them."
    exit 1
fi

