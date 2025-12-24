#!/usr/bin/env bash

# Import Database to Server Script
# This script imports the project database schema and seed data to the server
#
# Usage:
#   bash backend/scripts/import-database-to-server.sh
#
# Or via SSH:
#   ssh root@r77.igt.com.hk "bash -s" < backend/scripts/import-database-to-server.sh

set -euo pipefail

# Server database configuration
# These can be overridden via environment variables
DB_HOST="${DB_HOST:-r77.igt.com.hk}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-cboard}"
DB_PASS="${DB_PASS:-yyTTr437}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DB_DIR="$PROJECT_ROOT/backend/database"

echo "=========================================="
echo " Import Database to Server"
echo "=========================================="
echo
echo "Target Server: ${DB_HOST}"
echo "Database: ${DB_NAME}"
echo "User: ${DB_USER}"
echo

# Check if we're running locally or on server
if [[ "$DB_HOST" == "localhost" ]] || [[ "$DB_HOST" == "127.0.0.1" ]]; then
    echo "[*] Running on local server..."
    MYSQL_CMD="mysql"
else
    echo "[*] Connecting to remote server: ${DB_HOST}..."
    MYSQL_CMD="mysql -h ${DB_HOST} -u ${DB_USER}"
    if [[ -n "$DB_PASS" ]]; then
        MYSQL_CMD="$MYSQL_CMD -p${DB_PASS}"
    fi
fi

# Check if database files exist
if [[ ! -f "$DB_DIR/schema.sql" ]]; then
    echo "[X] Error: schema.sql not found at $DB_DIR/schema.sql" >&2
    exit 1
fi

echo
echo "[*] Step 1: Creating database (if not exists)..."
$MYSQL_CMD <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` 
    DEFAULT CHARACTER SET utf8mb4 
    DEFAULT COLLATE utf8mb4_unicode_ci;
EOF
echo "   [OK] Database created/verified"

echo
echo "[*] Step 2: Importing schema..."
$MYSQL_CMD "$DB_NAME" < "$DB_DIR/schema.sql"
echo "   [OK] Schema imported"

echo
echo "[*] Step 3: Importing seed data..."

# Import seed files in order
SEED_FILES=(
    "seed-system-user.sql"
    "seed-preset-profiles.sql"
    "seed-jyutping-dictionary.sql"
    "seed-jyutping-dictionary-extended.sql"
)

for seed_file in "${SEED_FILES[@]}"; do
    if [[ -f "$DB_DIR/$seed_file" ]]; then
        echo "   Importing $seed_file..."
        $MYSQL_CMD "$DB_NAME" < "$DB_DIR/$seed_file" || {
            echo "   [WARNING] Failed to import $seed_file (may already exist)"
        }
    else
        echo "   [SKIP] $seed_file not found"
    fi
done

echo
echo "[*] Step 4: Creating admin user..."
if [[ -f "$DB_DIR/create-admin-user.sql" ]]; then
    $MYSQL_CMD "$DB_NAME" < "$DB_DIR/create-admin-user.sql" || {
        echo "   [WARNING] Failed to create admin user (may already exist)"
    }
    echo "   [OK] Admin user created/updated"
else
    echo "   [SKIP] create-admin-user.sql not found"
fi

echo
echo "[*] Step 5: Verifying database..."
$MYSQL_CMD "$DB_NAME" <<EOF
SELECT 
    'Tables' as Type,
    COUNT(*) as Count
FROM information_schema.tables 
WHERE table_schema = '${DB_NAME}';

SELECT 
    'Users' as Type,
    COUNT(*) as Count
FROM users;

SELECT 
    'Profiles' as Type,
    COUNT(*) as Count
FROM profiles;

SELECT 
    'Boards' as Type,
    COUNT(*) as Count
FROM boards;

SELECT 
    'Jyutping Dictionary' as Type,
    COUNT(*) as Count
FROM jyutping_dictionary;
EOF

echo
echo "=========================================="
echo " [OK] Database import completed!"
echo "=========================================="
echo
echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}"
echo
echo "Next steps:"
echo "  1. Verify the data was imported correctly"
echo "  2. Update backend/.env with correct database credentials"
echo "  3. Test the API endpoints"
echo

