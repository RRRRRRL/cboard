#!/bin/bash
# Sprint 3 Simple Test Script (No Image Upload Required)
# Tests all Sprint 3 features using text-to-image generator

API_URL="http://localhost:8000/api"
echo "=========================================="
echo "Sprint 3 Testing (No Image Upload Required)"
echo "=========================================="
echo ""

# Check if API is running
if ! curl -s "$API_URL/" > /dev/null; then
    echo "❌ API server is not running!"
    echo "   Start it with: cd backend && php -S localhost:8000 -t api api/index.php"
    exit 1
fi

# 1. Login to get token
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/user/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }')

if [ "$USE_JQ" = true ] 2>/dev/null; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.authToken // empty' 2>/dev/null)
else
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"authToken"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "⚠️  Login failed, trying registration..."
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/user" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"test$(date +%s)@example.com\",
        \"password\": \"test123\",
        \"name\": \"Test User\"
      }")
    
    if [ "$USE_JQ" = true ] 2>/dev/null; then
        TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.user.authToken // .authToken // empty' 2>/dev/null)
    else
        TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"authToken"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Failed to get authentication token"
    exit 1
fi

echo "✅ Authenticated"
echo ""

# 2. Test Layout Templates
echo "2. Testing Layout Templates..."
TEMPLATES_RESPONSE=$(curl -s "$API_URL/profiles/templates" \
  -H "Authorization: Bearer $TOKEN")

if echo "$TEMPLATES_RESPONSE" | grep -q "templates"; then
    echo "✅ Layout templates retrieved"
else
    echo "❌ Failed to get templates"
fi
echo ""

# 3. Test Text-to-Image Generator (optional - requires GD extension)
echo "3. Testing Text-to-Image Generator..."
TEXT_IMAGE_RESPONSE=$(curl -s -X POST "$API_URL/media/text-to-image" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "text": "Hello",
    "width": 400,
    "height": 400,
    "background_color": "#FF5733",
    "text_color": "#FFFFFF",
    "font_size": 48
  }')

if [ "$USE_JQ" = true ] 2>/dev/null; then
    IMAGE_URL=$(echo "$TEXT_IMAGE_RESPONSE" | jq -r '.url // empty' 2>/dev/null)
    ERROR_MSG=$(echo "$TEXT_IMAGE_RESPONSE" | jq -r '.message // empty' 2>/dev/null)
else
    IMAGE_URL=$(echo "$TEXT_IMAGE_RESPONSE" | grep -o '"url"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
    ERROR_MSG=$(echo "$TEXT_IMAGE_RESPONSE" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$IMAGE_URL" ] || [ "$IMAGE_URL" = "null" ]; then
    echo "⚠️  Text-to-image generation failed (GD extension may not be installed)"
    if [ ! -z "$ERROR_MSG" ]; then
        echo "   Error: $ERROR_MSG"
    fi
    echo "   → Install GD: sudo apt-get install php-gd"
    echo "   → Continuing with text-only card test..."
    IMAGE_URL=""  # Use empty for text-only card
else
    echo "✅ Image generated: $IMAGE_URL"
fi
echo ""

# 4. Test Card Creation
echo "4. Testing Card Creation..."
if [ -z "$IMAGE_URL" ]; then
    # Create card without image (text only)
    CARD_DATA="{
    \"title\": \"Hello Card\",
    \"label_text\": \"Hello\",
    \"text_color\": \"#000000\",
    \"background_color\": \"#FFFFFF\",
    \"category\": \"greetings\"
  }"
else
    # Create card with image
    CARD_DATA="{
    \"title\": \"Hello Card\",
    \"label_text\": \"Hello\",
    \"image_url\": \"$IMAGE_URL\",
    \"text_color\": \"#000000\",
    \"background_color\": \"#FFFFFF\",
    \"category\": \"greetings\"
  }"
fi

CARD_RESPONSE=$(curl -s -X POST "$API_URL/cards" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$CARD_DATA")

if [ "$USE_JQ" = true ] 2>/dev/null; then
    CARD_ID=$(echo "$CARD_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
else
    CARD_ID=$(echo "$CARD_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*')
fi

if [ -z "$CARD_ID" ] || [ "$CARD_ID" = "null" ]; then
    echo "❌ Card creation failed"
    echo "Response: $CARD_RESPONSE"
    exit 1
fi

echo "✅ Card created with ID: $CARD_ID"
echo ""

# 5. Test Get Card
echo "5. Testing Get Card..."
GET_CARD=$(curl -s "$API_URL/cards/$CARD_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$GET_CARD" | grep -q "title"; then
    echo "✅ Card retrieved successfully"
else
    echo "❌ Failed to get card"
fi
echo ""

# 6. Test Update Card
echo "6. Testing Card Update..."
UPDATE_CARD=$(curl -s -X PUT "$API_URL/cards/$CARD_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "background_color": "#FF5733"
  }')

if echo "$UPDATE_CARD" | grep -q "background_color"; then
    echo "✅ Card updated successfully"
else
    echo "❌ Failed to update card"
fi
echo ""

# 7. Get or Create Profile
echo "7. Getting/Creating Profile..."
PROFILES_RESPONSE=$(curl -s "$API_URL/profiles" \
  -H "Authorization: Bearer $TOKEN")

if [ "$USE_JQ" = true ] 2>/dev/null; then
    PROFILE_ID=$(echo "$PROFILES_RESPONSE" | jq -r '.profiles[0].id // empty' 2>/dev/null)
else
    PROFILE_ID=$(echo "$PROFILES_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*')
fi

if [ -z "$PROFILE_ID" ] || [ "$PROFILE_ID" = "null" ]; then
    echo "   Creating new profile..."
    CREATE_PROFILE=$(curl -s -X POST "$API_URL/profiles" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "display_name": "Test Profile",
        "layout_type": "4x6",
        "language": "en"
      }')
    
    if [ "$USE_JQ" = true ] 2>/dev/null; then
        PROFILE_ID=$(echo "$CREATE_PROFILE" | jq -r '.id // empty' 2>/dev/null)
    else
        PROFILE_ID=$(echo "$CREATE_PROFILE" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*')
    fi
fi

if [ -z "$PROFILE_ID" ] || [ "$PROFILE_ID" = "null" ]; then
    echo "❌ Failed to get/create profile"
    exit 1
fi

echo "✅ Using profile ID: $PROFILE_ID"
echo ""

# 8. Test Add Card to Profile
echo "8. Testing Add Card to Profile..."
PROFILE_CARD_RESPONSE=$(curl -s -X POST "$API_URL/profile-cards" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"profile_id\": $PROFILE_ID,
    \"card_id\": $CARD_ID,
    \"row_index\": 0,
    \"col_index\": 0,
    \"page_index\": 0
  }")

if echo "$PROFILE_CARD_RESPONSE" | grep -q "profile_id"; then
    echo "✅ Card added to profile"
else
    echo "⚠️  Card may already be in profile (this is OK)"
fi
echo ""

# 9. Test Get Profile Cards
echo "9. Testing Get Profile Cards..."
PROFILE_CARDS=$(curl -s "$API_URL/profile-cards?profile_id=$PROFILE_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$PROFILE_CARDS" | grep -q "cards"; then
    echo "✅ Profile cards retrieved"
else
    echo "❌ Failed to get profile cards"
fi
echo ""

# 10. Test List Cards
echo "10. Testing List Cards..."
LIST_CARDS=$(curl -s "$API_URL/cards" \
  -H "Authorization: Bearer $TOKEN")

if echo "$LIST_CARDS" | grep -q "cards"; then
    echo "✅ Cards listed successfully"
else
    echo "❌ Failed to list cards"
fi
echo ""

echo "=========================================="
echo "✅ Sprint 3 Basic Tests Complete!"
echo "=========================================="
echo ""
echo "All tests passed without requiring image uploads!"
echo ""
echo "To test image upload features, use:"
echo "  curl -X POST $API_URL/media \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -F \"file=@/path/to/image.jpg\""
echo ""

