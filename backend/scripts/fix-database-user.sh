#!/bin/bash
# Script to fix database user permissions
# Usage: bash backend/scripts/fix-database-user.sh

echo "=========================================="
echo " Database User Configuration Fix"
echo "=========================================="
echo ""

# Read database config from .env
ENV_FILE="/var/www/aac.uplifor.org/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "[ERROR] .env file not found at: $ENV_FILE"
    exit 1
fi

source <(grep -E '^DB_' "$ENV_FILE" | sed 's/^/export /')
source <(grep -E '^JWT_SECRET' "$ENV_FILE" | sed 's/^/export /')

echo "[*] Database Configuration:"
echo "    DB_HOST: ${DB_HOST:-localhost}"
echo "    DB_NAME: ${DB_NAME:-cboard}"
echo "    DB_USER: ${DB_USER:-cboard_user}"
echo "    DB_PASS: [hidden]"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "[ERROR] This script must be run as root"
    echo "Please run: sudo bash $0"
    exit 1
fi

echo ""
echo "[*] Options to fix database access:"
echo ""
echo "Option 1: Create/Update database user"
echo "  Run the following SQL commands as MySQL root:"
echo ""
echo "  mysql -u root -p"
echo "  CREATE DATABASE IF NOT EXISTS ${DB_NAME:-cboard} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "  CREATE USER IF NOT EXISTS '${DB_USER:-cboard_user}'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';"
echo "  GRANT ALL PRIVILEGES ON ${DB_NAME:-cboard}.* TO '${DB_USER:-cboard_user}'@'localhost';"
echo "  FLUSH PRIVILEGES;"
echo "  EXIT;"
echo ""
echo "Option 2: Update .env file with correct credentials"
echo "  Edit: $ENV_FILE"
echo "  Update DB_USER and DB_PASS with correct values"
echo ""
echo "Option 3: Use existing MySQL root user"
echo "  Edit: $ENV_FILE"
echo "  Set: DB_USER=root"
echo "  Set: DB_PASS=your_root_password"
echo ""
echo "=========================================="
echo " After fixing, test with:"
echo "  php /var/www/aac.uplifor.org/backend/scripts/check-server-api.php"
echo "=========================================="

