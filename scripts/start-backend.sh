#!/bin/bash
# Start backend server for local development
# Usage: bash scripts/start-backend.sh

cd "$(dirname "$0")/../backend" || exit 1

echo "=========================================="
echo " Starting Cboard Backend Server"
echo "=========================================="
echo ""
echo "Backend will be available at: http://localhost:8000/api"
echo "Press Ctrl+C to stop the server"
echo ""

# Check if PHP is available
if ! command -v php &> /dev/null; then
    echo "Error: PHP is not installed or not in PATH" >&2
    exit 1
fi

# Start PHP built-in server with router
php -S localhost:8000 router.php

