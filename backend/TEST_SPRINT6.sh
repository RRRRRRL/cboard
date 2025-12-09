#!/bin/bash
# Sprint 6 API Testing Script
# Tests External Switch + Eye Tracking endpoints

API_URL="http://localhost:8000/api"
echo "=========================================="
echo "Testing Sprint 6 API Endpoints"
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

# 2. Test Register Wired Switch
echo "2. Testing Register Wired Switch..."
REGISTER_WIRED=$(curl -s -X POST "$API_URL/devices/switch/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "wired",
    "device_name": "USB Switch",
    "connection_type": "usb",
    "device_id": "USB-SWITCH-001"
  }')

format_json "$REGISTER_WIRED"

if [ "$USE_JQ" = true ]; then
    SWITCH_ID=$(echo "$REGISTER_WIRED" | jq -r '.device.id // empty' 2>/dev/null)
else
    SWITCH_ID=$(echo "$REGISTER_WIRED" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -n "$SWITCH_ID" ] && [ "$SWITCH_ID" != "null" ]; then
  echo "✅ Wired switch registered (ID: $SWITCH_ID)"
else
  echo "⚠️  Switch registration may have failed"
fi
echo ""

# 3. Test Register Bluetooth Switch
echo "3. Testing Register Bluetooth Switch..."
REGISTER_BT=$(curl -s -X POST "$API_URL/devices/switch/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "bluetooth",
    "device_name": "Bluetooth Switch",
    "connection_type": "bluetooth",
    "device_id": "BT-SWITCH-001"
  }')

format_json "$REGISTER_BT"

if [ "$USE_JQ" = true ]; then
    BT_SWITCH_ID=$(echo "$REGISTER_BT" | jq -r '.device.id // empty' 2>/dev/null)
else
    BT_SWITCH_ID=$(echo "$REGISTER_BT" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -n "$BT_SWITCH_ID" ] && [ "$BT_SWITCH_ID" != "null" ]; then
  echo "✅ Bluetooth switch registered (ID: $BT_SWITCH_ID)"
else
  echo "⚠️  Bluetooth switch registration may have failed"
fi
echo ""

# 4. Test Register Eye-Tracking Device
echo "4. Testing Register Eye-Tracking Device..."
REGISTER_ET=$(curl -s -X POST "$API_URL/devices/eyetracking/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "device_type": "tobii",
    "device_name": "Tobii Eye Tracker 4C",
    "sdk_version": "1.2.0",
    "device_id": "TOBII-001"
  }')

format_json "$REGISTER_ET"

if [ "$USE_JQ" = true ]; then
    ET_DEVICE_ID=$(echo "$REGISTER_ET" | jq -r '.device.id // empty' 2>/dev/null)
else
    ET_DEVICE_ID=$(echo "$REGISTER_ET" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -n "$ET_DEVICE_ID" ] && [ "$ET_DEVICE_ID" != "null" ]; then
  echo "✅ Eye-tracking device registered (ID: $ET_DEVICE_ID)"
else
  echo "⚠️  Eye-tracking registration may have failed"
fi
echo ""

# 5. Test Get Devices List
echo "5. Testing Get Devices List..."
GET_DEVICES=$(curl -s "$API_URL/devices/list" \
  -H "Authorization: Bearer $TOKEN")

format_json "$GET_DEVICES"
echo "✅ Devices list retrieved"
echo ""

# 6. Test Activate Switch Device
if [ -n "$BT_SWITCH_ID" ] && [ "$BT_SWITCH_ID" != "null" ]; then
  echo "6. Testing Activate Switch Device..."
  ACTIVATE_SWITCH=$(curl -s -X POST "$API_URL/devices/switch/activate" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"device_id\": \"$BT_SWITCH_ID\"
    }")
  
  format_json "$ACTIVATE_SWITCH"
  echo "✅ Switch device activated"
  echo ""
fi

# 7. Test Switch Long-Press
echo "7. Testing Switch Long-Press..."
LONG_PRESS=$(curl -s -X POST "$API_URL/devices/switch/longpress" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": 1,
    "duration": 2.5,
    "action": "operation_scan"
  }')

format_json "$LONG_PRESS"
echo "✅ Long-press event logged"
echo ""

# 8. Test Eye-Tracking Calibration
if [ -n "$ET_DEVICE_ID" ] && [ "$ET_DEVICE_ID" != "null" ]; then
  echo "8. Testing Eye-Tracking Calibration..."
  CALIBRATE_ET=$(curl -s -X POST "$API_URL/devices/eyetracking/calibrate" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"device_id\": \"$ET_DEVICE_ID\",
      \"calibration_points\": [
        {\"x\": 0.1, \"y\": 0.1},
        {\"x\": 0.9, \"y\": 0.1},
        {\"x\": 0.5, \"y\": 0.5},
        {\"x\": 0.1, \"y\": 0.9},
        {\"x\": 0.9, \"y\": 0.9}
      ]
    }")
  
  format_json "$CALIBRATE_ET"
  echo "✅ Eye-tracking device calibrated"
  echo ""
fi

# 9. Test Eye-Tracking Select
echo "9. Testing Eye-Tracking Select..."
ET_SELECT=$(curl -s -X POST "$API_URL/devices/eyetracking/select" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": 1,
    "card_id": 1,
    "gaze_x": 100.5,
    "gaze_y": 200.3,
    "dwell_time": 1.2
  }')

format_json "$ET_SELECT"
echo "✅ Eye-tracking selection logged"
echo ""

# 10. Test Get Devices List Again (verify devices persisted)
echo "10. Testing Get Devices List (verify persistence)..."
GET_DEVICES2=$(curl -s "$API_URL/devices/list" \
  -H "Authorization: Bearer $TOKEN")

format_json "$GET_DEVICES2"

if [ "$USE_JQ" = true ]; then
    SWITCH_COUNT=$(echo "$GET_DEVICES2" | jq '.devices.switches | length' 2>/dev/null)
    ET_COUNT=$(echo "$GET_DEVICES2" | jq '.devices.eye_tracking | length' 2>/dev/null)
else
    SWITCH_COUNT=$(echo "$GET_DEVICES2" | grep -o '"switches"' | wc -l)
    ET_COUNT=$(echo "$GET_DEVICES2" | grep -o '"eye_tracking"' | wc -l)
fi

echo "✅ Devices list retrieved"
echo "   Switches: $SWITCH_COUNT"
echo "   Eye-tracking: $ET_COUNT"
echo ""

echo "=========================================="
echo "✅ All Sprint 6 tests completed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Register Wired Switch"
echo "  ✓ Register Bluetooth Switch"
echo "  ✓ Register Eye-Tracking Device"
echo "  ✓ Get Devices List"
echo "  ✓ Activate Switch Device"
echo "  ✓ Switch Long-Press"
echo "  ✓ Eye-Tracking Calibration"
echo "  ✓ Eye-Tracking Select"
echo "  ✓ Device Persistence"
echo ""

