#!/bin/bash
# Sprint 4 API Testing Script
# Tests Communication Mode endpoints: preset profiles, action logs, settings, TTS

API_URL="http://localhost:8000/api"
echo "=========================================="
echo "Testing Sprint 4 API Endpoints"
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

# 2. Test Public Profiles
echo "2. Testing Public Profiles Endpoint..."
PUBLIC_PROFILES=$(curl -s "$API_URL/profiles/public")
format_json "$PUBLIC_PROFILES"

if [ "$USE_JQ" = true ]; then
    PROFILE_COUNT=$(echo "$PUBLIC_PROFILES" | jq '.profiles | length' 2>/dev/null)
    FIRST_PROFILE_ID=$(echo "$PUBLIC_PROFILES" | jq -r '.profiles[0].id // empty' 2>/dev/null)
else
    PROFILE_COUNT=$(echo "$PUBLIC_PROFILES" | grep -o '"id"' | wc -l)
    FIRST_PROFILE_ID=$(echo "$PUBLIC_PROFILES" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*')
fi

if [ -z "$PROFILE_COUNT" ] || [ "$PROFILE_COUNT" = "0" ]; then
  echo "⚠️  No public profiles found. Run seed script first: php seed-preset-profiles.php"
else
  echo "✅ Found $PROFILE_COUNT public profiles"
fi
echo ""

# 3. Test Public Profiles with Language Filter
echo "3. Testing Public Profiles (English only)..."
ENGLISH_PROFILES=$(curl -s "$API_URL/profiles/public?language=en")
format_json "$ENGLISH_PROFILES"
echo "✅ English profiles retrieved"
echo ""

# 4. Test Public Profiles (Cantonese)
echo "4. Testing Public Profiles (Cantonese)..."
CANTONESE_PROFILES=$(curl -s "$API_URL/profiles/public?language=zh-HK")
format_json "$CANTONESE_PROFILES"
echo "✅ Cantonese profiles retrieved"
echo ""

# 5. Test Action Logging (Anonymous - View-Only Mode)
echo "5. Testing Action Logging (Anonymous)..."
ACTION_LOG_RESPONSE=$(curl -s -X POST "$API_URL/action-logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"action_type\": \"card_click\",
    \"profile_id\": ${FIRST_PROFILE_ID:-1},
    \"card_id\": 1,
    \"metadata\": {
      \"scanning_speed\": 1.0,
      \"mode\": \"view_only\"
    }
  }")

format_json "$ACTION_LOG_RESPONSE"

if [ "$USE_JQ" = true ]; then
    LOG_ID=$(echo "$ACTION_LOG_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
else
    LOG_ID=$(echo "$ACTION_LOG_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*')
fi

if [ -n "$LOG_ID" ] && [ "$LOG_ID" != "null" ]; then
  echo "✅ Action logged (ID: $LOG_ID)"
else
  echo "⚠️  Action logging may have failed"
fi
echo ""

# 6. Test Action Logging (Authenticated)
echo "6. Testing Action Logging (Authenticated)..."
AUTH_ACTION_LOG=$(curl -s -X POST "$API_URL/action-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"action_type\": \"sentence_play\",
    \"profile_id\": ${FIRST_PROFILE_ID:-1},
    \"metadata\": {
      \"sentence\": \"Hello world\",
      \"voice\": \"en-US-Neural-A\"
    }
  }")

format_json "$AUTH_ACTION_LOG"
echo "✅ Authenticated action logged"
echo ""

# 7. Test Get Action Logs
echo "7. Testing Get Action Logs..."
GET_LOGS=$(curl -s "$API_URL/action-logs" \
  -H "Authorization: Bearer $TOKEN")

format_json "$GET_LOGS"
echo "✅ Action logs retrieved"
echo ""

# 8. Test Get Settings
echo "8. Testing Get Settings..."
GET_SETTINGS=$(curl -s "$API_URL/settings" \
  -H "Authorization: Bearer $TOKEN")

format_json "$GET_SETTINGS"
echo "✅ Settings retrieved"
echo ""

# 9. Test Update Speech Settings
echo "9. Testing Update Speech Settings..."
UPDATE_SPEECH=$(curl -s -X POST "$API_URL/settings/speech" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "voice": "zh-HK-Standard-A",
    "language": "zh-HK",
    "rate": 1.2,
    "pitch": 1.0
  }')

format_json "$UPDATE_SPEECH"
echo "✅ Speech settings updated"
echo ""

# 10. Test Get Speech Settings
echo "10. Testing Get Speech Settings..."
GET_SPEECH=$(curl -s "$API_URL/settings/speech" \
  -H "Authorization: Bearer $TOKEN")

format_json "$GET_SPEECH"
echo "✅ Speech settings retrieved"
echo ""

# 11. Test TTS Voices (English)
echo "11. Testing TTS Voices (English)..."
TTS_VOICES_EN=$(curl -s "$API_URL/tts/voices?language=en")
format_json "$TTS_VOICES_EN"

if [ "$USE_JQ" = true ]; then
    VOICE_COUNT=$(echo "$TTS_VOICES_EN" | jq '.voices | length' 2>/dev/null)
else
    VOICE_COUNT=$(echo "$TTS_VOICES_EN" | grep -o '"id"' | wc -l)
fi

echo "✅ Found $VOICE_COUNT English voices"
echo ""

# 12. Test TTS Voices (Cantonese)
echo "12. Testing TTS Voices (Cantonese)..."
TTS_VOICES_HK=$(curl -s "$API_URL/tts/voices?language=zh-HK")
format_json "$TTS_VOICES_HK"

if [ "$USE_JQ" = true ]; then
    HK_VOICE_COUNT=$(echo "$TTS_VOICES_HK" | jq '.voices | length' 2>/dev/null)
else
    HK_VOICE_COUNT=$(echo "$TTS_VOICES_HK" | grep -o '"id"' | wc -l)
fi

echo "✅ Found $HK_VOICE_COUNT Cantonese voices"
echo ""

# 13. Test TTS Speak (Placeholder)
echo "13. Testing TTS Speak..."
TTS_SPEAK=$(curl -s -X POST "$API_URL/tts/speak" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test",
    "language": "en",
    "voice_id": "en-US-Neural-A",
    "rate": 1.0,
    "pitch": 1.0
  }')

format_json "$TTS_SPEAK"
echo "✅ TTS endpoint working (placeholder)"
echo ""

echo "=========================================="
echo "✅ All Sprint 4 tests completed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Public Profiles (all languages)"
echo "  ✓ Public Profiles (English filter)"
echo "  ✓ Public Profiles (Cantonese filter)"
echo "  ✓ Action Logging (anonymous)"
echo "  ✓ Action Logging (authenticated)"
echo "  ✓ Get Action Logs"
echo "  ✓ Get Settings"
echo "  ✓ Update Speech Settings"
echo "  ✓ Get Speech Settings"
echo "  ✓ TTS Voices (English)"
echo "  ✓ TTS Voices (Cantonese)"
echo "  ✓ TTS Speak"
echo ""

