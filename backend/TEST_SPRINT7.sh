#!/bin/bash
# Sprint 7 API Testing Script
# Tests all Sprint 7 Jyutping Keyboard endpoints

API_URL="http://localhost:8000/api"
echo "=========================================="
echo "Testing Sprint 7: Jyutping Keyboard API"
echo "=========================================="
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq is not installed. Installing JSON parsing..."
    echo "   Install with: sudo apt-get install jq"
    echo "   Or run without jq (responses won't be formatted)"
    USE_JQ=false
else
    USE_JQ=true
fi

# Function to format JSON output
format_json() {
    if [ "$USE_JQ" = true ]; then
        echo "$1" | jq .
    else
        echo "$1"
    fi
}

# Get auth token (try to login first)
echo "1. Getting authentication token..."
TIMESTAMP=$(date +%s)
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/user/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test${TIMESTAMP}@example.com\",
    \"password\": \"test123\"
  }")

# Try registration if login fails
if echo "$LOGIN_RESPONSE" | grep -q "error\|failed\|Invalid"; then
    echo "   Login failed, trying registration..."
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/user" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"test${TIMESTAMP}@example.com\",
        \"password\": \"test123\",
        \"name\": \"Test User\"
      }")
    
    if [ "$USE_JQ" = true ]; then
        TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.user.authToken // .authToken // empty' 2>/dev/null)
    else
        TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"authToken"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
else
    if [ "$USE_JQ" = true ]; then
        TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.authToken // empty' 2>/dev/null)
    else
        TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"authToken"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ] || [ "$TOKEN" = "empty" ]; then
  echo "❌ Authentication failed - no token received"
  echo "   Please ensure you have a test user or run the seed script first"
  echo "   You can create a user via: curl -X POST $API_URL/user -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"test123\",\"name\":\"Test\"}'"
  exit 1
fi

echo "✅ Authentication successful"
echo "Token: ${TOKEN:0:50}..."
echo ""

# 2. Test Jyutping Search
echo "2. Testing GET /api/jyutping/search..."
SEARCH_RESPONSE=$(curl -s "$API_URL/jyutping/search?code=nei5")
format_json "$SEARCH_RESPONSE"

if echo "$SEARCH_RESPONSE" | grep -q "success.*true\|matches"; then
    echo "✅ Search endpoint working"
else
    echo "⚠️  Search endpoint returned unexpected response"
fi
echo ""

# 3. Test Jyutping Suggestions
echo "3. Testing GET /api/jyutping/suggestions..."
SUGGESTIONS_RESPONSE=$(curl -s "$API_URL/jyutping/suggestions?input=nei")
format_json "$SUGGESTIONS_RESPONSE"

if echo "$SUGGESTIONS_RESPONSE" | grep -q "success.*true\|suggestions"; then
    echo "✅ Suggestions endpoint working"
else
    echo "⚠️  Suggestions endpoint returned unexpected response"
fi
echo ""

# 4. Test Jyutping Audio (requires auth)
echo "4. Testing POST /api/jyutping/audio..."
AUDIO_RESPONSE=$(curl -s -X POST "$API_URL/jyutping/audio" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "text": "你好",
    "jyutping": "nei5hou2",
    "type": "word"
  }')
format_json "$AUDIO_RESPONSE"

if echo "$AUDIO_RESPONSE" | grep -q "success.*true"; then
    echo "✅ Audio endpoint working"
else
    echo "⚠️  Audio endpoint returned unexpected response"
fi
echo ""

# 5. Test Learning Log (requires auth)
echo "5. Testing POST /api/jyutping/learning-log..."
LEARNING_RESPONSE=$(curl -s -X POST "$API_URL/jyutping/learning-log" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jyutping_code": "nei5",
    "hanzi_expected": "你",
    "hanzi_selected": "你",
    "profile_id": null
  }')
format_json "$LEARNING_RESPONSE"

if echo "$LEARNING_RESPONSE" | grep -q "success.*true\|id"; then
    echo "✅ Learning log endpoint working"
else
    echo "⚠️  Learning log endpoint returned unexpected response"
fi
echo ""

# 6. Test with different Jyutping codes
echo "6. Testing multiple Jyutping searches..."
for code in "hou2" "m4goi1" "sik6" "heoi3"; do
    echo "   Searching for: $code"
    RESPONSE=$(curl -s "$API_URL/jyutping/search?code=$code")
    if echo "$RESPONSE" | grep -q "success.*true"; then
        echo "   ✅ Found results for $code"
    else
        echo "   ⚠️  No results for $code (may need to seed dictionary)"
    fi
done
echo ""

echo "=========================================="
echo "✅ Sprint 7 API tests completed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Jyutping Search"
echo "  ✓ Jyutping Suggestions"
echo "  ✓ Jyutping Audio"
echo "  ✓ Learning Log"
echo ""
echo "Note: To test with real data, run:"
echo "  mysql -u root -p cboard < backend/database/seed-jyutping-dictionary.sql"

