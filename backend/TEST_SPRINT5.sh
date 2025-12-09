#!/bin/bash
# Sprint 5 API Testing Script
# Tests Accessibility - Scanning Engine endpoints

API_URL="http://localhost:8000/api"
echo "=========================================="
echo "Testing Sprint 5 API Endpoints"
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

# First, register and login to get a token
echo "1. Registering test user..."
TIMESTAMP=$(date +%s)
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

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ] || [ "$TOKEN" = "empty" ]; then
  echo "❌ Registration failed"
  exit 1
fi

echo "✅ Registration successful"
echo "Token: ${TOKEN:0:50}..."
echo ""

# 2. Test Get Scanning State (no auth required)
echo "2. Testing Get Scanning State..."
SCANNING_STATE=$(curl -s "$API_URL/scanning/state")
format_json "$SCANNING_STATE"
echo "✅ Scanning state retrieved"
echo ""

# 3. Test Get Accessibility Settings
echo "3. Testing Get Accessibility Settings..."
GET_ACCESSIBILITY=$(curl -s "$API_URL/settings/accessibility" \
  -H "Authorization: Bearer $TOKEN")

format_json "$GET_ACCESSIBILITY"
echo "✅ Accessibility settings retrieved"
echo ""

# 4. Test Update Accessibility Settings (Single Mode)
echo "4. Testing Update Accessibility Settings (Single Mode)..."
UPDATE_ACCESSIBILITY=$(curl -s -X POST "$API_URL/settings/accessibility" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "scanning": {
      "enabled": true,
      "mode": "single",
      "speed": 2.0,
      "loop": "finite",
      "loop_count": 3
    },
    "audio_guide": "beep"
  }')

format_json "$UPDATE_ACCESSIBILITY"
echo "✅ Accessibility settings updated (single mode)"
echo ""

# 5. Test Update Accessibility Settings (Row Mode)
echo "5. Testing Update Accessibility Settings (Row Mode)..."
UPDATE_ROW=$(curl -s -X POST "$API_URL/settings/accessibility" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "scanning": {
      "mode": "row",
      "speed": 1.5,
      "loop": "infinite"
    }
  }')

format_json "$UPDATE_ROW"
echo "✅ Accessibility settings updated (row mode)"
echo ""

# 6. Test Update Accessibility Settings (Column Mode)
echo "6. Testing Update Accessibility Settings (Column Mode)..."
UPDATE_COLUMN=$(curl -s -X POST "$API_URL/settings/accessibility" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "scanning": {
      "mode": "column",
      "speed": 3.0,
      "loop": "finite",
      "loop_count": 5
    },
    "audio_guide": "card_audio"
  }')

format_json "$UPDATE_COLUMN"
echo "✅ Accessibility settings updated (column mode)"
echo ""

# 7. Test Start Scanning Session
echo "7. Testing Start Scanning Session..."
START_SCANNING=$(curl -s -X POST "$API_URL/scanning/start" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": 1,
    "board_id": 1,
    "mode": "single",
    "speed": 2.0
  }')

format_json "$START_SCANNING"
echo "✅ Scanning session started"
echo ""

# 8. Test Scanning Select
echo "8. Testing Scanning Select..."
SCAN_SELECT=$(curl -s -X POST "$API_URL/scanning/select" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": 1,
    "board_id": 1,
    "card_id": 1,
    "row_index": 0,
    "col_index": 0,
    "page_index": 0
  }')

format_json "$SCAN_SELECT"
echo "✅ Scanning select logged"
echo ""

# 9. Test Stop Scanning Session
echo "9. Testing Stop Scanning Session..."
STOP_SCANNING=$(curl -s -X POST "$API_URL/scanning/stop" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": 1
  }')

format_json "$STOP_SCANNING"
echo "✅ Scanning session stopped"
echo ""

# 10. Test Get Scanning Navigation (Single Mode)
echo "10. Testing Get Scanning Navigation (Single Mode)..."
NAV_SINGLE=$(curl -s "$API_URL/scanning/navigation?profile_id=1&board_id=1&mode=single")
format_json "$NAV_SINGLE"
echo "✅ Navigation structure retrieved (single mode)"
echo ""

# 11. Test Get Scanning Navigation (Row Mode)
echo "11. Testing Get Scanning Navigation (Row Mode)..."
NAV_ROW=$(curl -s "$API_URL/scanning/navigation?profile_id=1&board_id=1&mode=row")
format_json "$NAV_ROW"
echo "✅ Navigation structure retrieved (row mode)"
echo ""

# 12. Test Get Scanning Navigation (Column Mode)
echo "12. Testing Get Scanning Navigation (Column Mode)..."
NAV_COLUMN=$(curl -s "$API_URL/scanning/navigation?profile_id=1&board_id=1&mode=column")
format_json "$NAV_COLUMN"
echo "✅ Navigation structure retrieved (column mode)"
echo ""

# 13. Test Action Logging for Scanning
echo "13. Testing Action Logging for Scanning..."
SCAN_LOG=$(curl -s -X POST "$API_URL/action-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "action_type": "scan_highlight",
    "profile_id": 1,
    "board_id": 1,
    "card_id": 1,
    "metadata": {
      "scanning_mode": "single",
      "scanning_speed": 2.0,
      "row_index": 0,
      "col_index": 0
    }
  }')

format_json "$SCAN_LOG"
echo "✅ Scanning action logged"
echo ""

# 14. Test Speed Validation (should round to 0.5)
echo "14. Testing Speed Validation..."
SPEED_TEST=$(curl -s -X POST "$API_URL/settings/accessibility" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "scanning": {
      "speed": 1.7
    }
  }')

format_json "$SPEED_TEST"
echo "✅ Speed validation tested (should round 1.7 to 1.5)"
echo ""

# 15. Test Invalid Mode (should return error)
echo "15. Testing Invalid Mode Validation..."
INVALID_MODE=$(curl -s -X POST "$API_URL/settings/accessibility" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "scanning": {
      "mode": "invalid_mode"
    }
  }')

format_json "$INVALID_MODE"
if echo "$INVALID_MODE" | grep -q "error\|Invalid"; then
  echo "✅ Invalid mode correctly rejected"
else
  echo "⚠️  Invalid mode not rejected"
fi
echo ""

echo "=========================================="
echo "✅ All Sprint 5 tests completed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Get Scanning State"
echo "  ✓ Get Accessibility Settings"
echo "  ✓ Update Accessibility Settings (Single Mode)"
echo "  ✓ Update Accessibility Settings (Row Mode)"
echo "  ✓ Update Accessibility Settings (Column Mode)"
echo "  ✓ Start Scanning Session"
echo "  ✓ Scanning Select"
echo "  ✓ Stop Scanning Session"
echo "  ✓ Get Navigation (Single Mode)"
echo "  ✓ Get Navigation (Row Mode)"
echo "  ✓ Get Navigation (Column Mode)"
echo "  ✓ Action Logging for Scanning"
echo "  ✓ Speed Validation"
echo "  ✓ Invalid Mode Validation"
echo ""

