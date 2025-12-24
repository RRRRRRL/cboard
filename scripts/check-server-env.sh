#!/bin/bash
# Check server environment configuration
# Usage: bash scripts/check-server-env.sh

SERVER_HOST="r77.igt.com.hk"
SERVER_USER="root"
SERVER_PATH="/var/www/aac.uplifor.org"

echo "=========================================="
echo " Checking Server Environment Configuration"
echo "=========================================="
echo ""

echo "[*] Checking backend/.env file on server..."
ssh "${SERVER_USER}@${SERVER_HOST}" "cat ${SERVER_PATH}/backend/.env 2>/dev/null || echo 'No .env file found'"

echo ""
echo "[*] Checking for hardcoded IPs in backend files..."
ssh "${SERVER_USER}@${SERVER_HOST}" "grep -r '192\.168\.62\.41' ${SERVER_PATH}/backend/ 2>/dev/null | head -10 || echo 'No hardcoded IPs found'"

echo ""
echo "[*] Checking Nginx configuration..."
ssh "${SERVER_USER}@${SERVER_HOST}" "grep -A 5 'location /api' /etc/nginx/sites-enabled/* 2>/dev/null | head -20 || echo 'Nginx config not found'"

echo ""
echo "[*] Checking PHP-FPM status..."
ssh "${SERVER_USER}@${SERVER_HOST}" "systemctl status php8.3-fpm --no-pager | head -10"

echo ""
echo "[*] Checking environment variables..."
ssh "${SERVER_USER}@${SERVER_HOST}" "cd ${SERVER_PATH}/backend && php -r \"require 'config/env-loader.php'; echo 'APP_ENV: ' . getenv('APP_ENV') . PHP_EOL; echo 'API_BASE_URL: ' . getenv('API_BASE_URL') . PHP_EOL;\""

echo ""
echo "=========================================="
echo " Check complete"
echo "=========================================="

