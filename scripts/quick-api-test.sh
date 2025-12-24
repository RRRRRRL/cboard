#!/bin/bash
# Quick API test script
# Tests the user registration endpoint

API_URL="https://aac.uplifor.org/api"

echo "=========================================="
echo " Quick API Test"
echo "=========================================="
echo ""

echo "[*] Testing API health check..."
response=$(curl -s -w "\n%{http_code}" "${API_URL}")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Code: $http_code"
echo "Response: $body"
echo ""

if [ "$http_code" = "200" ]; then
    echo "[OK] API is responding"
else
    echo "[ERROR] API returned $http_code"
fi

echo ""
echo "[*] Testing user registration endpoint..."
test_email="test_$(date +%s)@example.com"
response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/user" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$test_email\",\"password\":\"test123456\",\"name\":\"Test User\"}")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Code: $http_code"
echo "Response: $body"
echo ""

if [ "$http_code" = "201" ]; then
    echo "[OK] User registration successful"
elif [ "$http_code" = "500" ]; then
    echo "[ERROR] Internal server error - check server logs"
    echo "Run on server: php /var/www/aac.uplifor.org/backend/scripts/check-server-api.php"
else
    echo "[INFO] Registration returned $http_code"
fi

echo ""
echo "=========================================="
echo " Test complete"
echo "=========================================="

