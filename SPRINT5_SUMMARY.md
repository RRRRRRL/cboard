# Sprint 5 - Accessibility: Scanning Engine - COMPLETE

## ✅ Completed Features

### 1. Scanning Engine API Endpoints

- ✅ **GET /api/scanning/state** - Get current scanning state and configuration
- ✅ **POST /api/scanning/start** - Start a scanning session
- ✅ **POST /api/scanning/stop** - Stop a scanning session
- ✅ **POST /api/scanning/select** - Log item selection during scanning
- ✅ **GET /api/scanning/navigation** - Get navigation structure for scanning modes

### 2. Scanning Modes

- ✅ **Single-card scanning** - Scan through individual cards one by one
- ✅ **Row scanning** - Scan through rows, then cards within rows
- ✅ **Column scanning** - Scan through columns, then cards within columns
- ✅ **Operation button scanning** - Scan through operation buttons

### 3. Scanning Speed Control

- ✅ **Adjustable speed** - 0.5 to 10.0 seconds
- ✅ **0.5 second increments** - Speed rounded to nearest 0.5s
- ✅ **Validation** - Speed automatically clamped to valid range

### 4. Loop Settings

- ✅ **Finite loops** - Set number of loops (1-100)
- ✅ **Infinite loops** - Continuous scanning until stopped
- ✅ **Default loop count** - 3 loops for finite mode

### 5. Audio Guide Modes

- ✅ **Off** - No audio feedback
- ✅ **Beep** - Audio beep on highlight
- ✅ **Card audio** - Play card audio on highlight
- ✅ **Settings storage** - Audio guide preference saved

### 6. Accessibility Settings API

- ✅ **GET /api/settings/accessibility** - Get all accessibility settings
- ✅ **POST /api/settings/accessibility** - Update accessibility settings
- ✅ **Settings validation** - Validates all scanning parameters
- ✅ **Settings merge** - Preserves existing settings when updating

### 7. Action Logging for Scanning

- ✅ **scan_start** - Log when scanning starts
- ✅ **scan_stop** - Log when scanning stops
- ✅ **scan_select** - Log item selections
- ✅ **scan_highlight** - Log highlight events (via action-logs)
- ✅ **scan_navigate** - Log navigation events (via action-logs)
- ✅ **Metadata tracking** - Stores scanning mode, speed, position

## Files Created/Modified

### New Files:

1. `backend/api/routes/scanning.php` - Scanning engine routes

### Modified Files:

1. `backend/api/routes/settings.php` - Added accessibility endpoints
2. `backend/api/routes/action-log.php` - Enhanced for scanning actions
3. `backend/api/index.php` - Added scanning route handler

## API Endpoints Implemented

### Scanning Engine:

- `GET /api/scanning/state` - Get scanning state and available options
- `POST /api/scanning/start` - Start scanning session
- `POST /api/scanning/stop` - Stop scanning session
- `POST /api/scanning/select` - Select item during scanning
- `GET /api/scanning/navigation` - Get navigation structure

### Accessibility Settings:

- `GET /api/settings/accessibility` - Get accessibility settings
- `POST /api/settings/accessibility` - Update accessibility settings

## Scanning Configuration Structure

```json
{
  "accessibility": {
    "scanning": {
      "enabled": true,
      "mode": "single",
      "speed": 2.0,
      "loop": "finite",
      "loop_count": 3
    },
    "audio_guide": "beep",
    "switch": {
      "type": null,
      "device_id": null
    },
    "eye_tracking": {
      "enabled": false,
      "device": null
    }
  }
}
```

## Scanning Modes

### Single-Card Scanning

- Scans through all cards sequentially
- One card highlighted at a time
- Navigation returns flat list of cards

### Row Scanning

- Scans through rows first
- Then scans cards within selected row
- Navigation returns cards grouped by rows

### Column Scanning

- Scans through columns first
- Then scans cards within selected column
- Navigation returns cards grouped by columns

### Operation Button Scanning

- Scans through operation buttons
- Separate from card scanning
- For navigation controls, clear, backspace, etc.

## Speed Control

- **Range**: 0.5 to 10.0 seconds
- **Increment**: 0.5 seconds
- **Default**: 2.0 seconds
- **Validation**: Automatically rounded to nearest 0.5s

## Loop Settings

### Finite Loop

- **Range**: 1 to 100 loops
- **Default**: 3 loops
- **Behavior**: Stops after specified number of loops

### Infinite Loop

- **Behavior**: Continues until manually stopped
- **Use case**: Continuous scanning for users who need more time

## Audio Guide Modes

1. **off** - No audio feedback
2. **beep** - Plays beep sound when item is highlighted
3. **card_audio** - Plays card's audio file when highlighted

## Navigation Structure

The navigation endpoint returns different structures based on scanning mode:

### Single Mode:

```json
{
  "mode": "single",
  "navigation": [
    {
      "card_id": 1,
      "title": "Hello",
      "image_url": "...",
      "position": { "row": 0, "col": 0, "page": 0 }
    }
  ]
}
```

### Row Mode:

```json
{
  "mode": "row",
  "navigation": {
    "0": {
      "0": [{ "card_id": 1, "title": "Hello", "col": 0 }],
      "1": [{ "card_id": 2, "title": "World", "col": 0 }]
    }
  }
}
```

### Column Mode:

```json
{
  "mode": "column",
  "navigation": {
    "0": {
      "0": [{ "card_id": 1, "title": "Hello", "row": 0 }],
      "1": [{ "card_id": 2, "title": "World", "row": 0 }]
    }
  }
}
```

## Testing

### Test Scanning State:

```bash
curl http://localhost:8000/api/scanning/state
```

### Test Start Scanning:

```bash
curl -X POST http://localhost:8000/api/scanning/start \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": 1,
    "board_id": 1,
    "mode": "single",
    "speed": 2.0
  }'
```

### Test Get Accessibility Settings:

```bash
curl http://localhost:8000/api/settings/accessibility \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjUyNjQ5ODMsImV4cCI6MTc2NTM1MTM4M30.P8t4Ohpwfsn2NE-hLfHX_kN-Esc-qM6LA6QjdDffWV4"
```

### Test Update Accessibility Settings:

```bash
curl -X POST http://localhost:8000/api/settings/accessibility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjUyNjQ5ODMsImV4cCI6MTc2NTM1MTM4M30.P8t4Ohpwfsn2NE-hLfHX_kN-Esc-qM6LA6QjdDffWV4" \
  -d '{
    "scanning": {
      "enabled": true,
      "mode": "row",
      "speed": 1.5,
      "loop": "finite",
      "loop_count": 5
    },
    "audio_guide": "beep"
  }'
```

### Test Scanning Navigation:

```bash
curl "http://localhost:8000/api/scanning/navigation?profile_id=1&board_id=1&mode=single"
```

## Validation Rules

### Scanning Mode:

- Must be one of: `single`, `row`, `column`, `operation`
- Returns 400 error if invalid

### Scanning Speed:

- Must be between 0.5 and 10.0 seconds
- Automatically rounded to nearest 0.5s
- Returns 400 error if out of range

### Loop Settings:

- Loop must be `finite` or `infinite`
- Loop count must be 1-100 for finite loops
- Returns 400 error if invalid

### Audio Guide:

- Must be one of: `off`, `beep`, `card_audio`
- Returns 400 error if invalid

## Action Logging

All scanning actions are logged with metadata:

- **scan_start**: Logs when scanning begins

  - Metadata: mode, speed, profile_id, board_id

- **scan_stop**: Logs when scanning stops

  - Metadata: profile_id

- **scan_select**: Logs item selections

  - Metadata: row_index, col_index, page_index, card_id

- **scan_highlight**: Logs highlight events (via action-logs endpoint)

  - Metadata: scanning_mode, scanning_speed, position

- **scan_navigate**: Logs navigation events (via action-logs endpoint)
  - Metadata: navigation_type, direction

## Frontend Integration Notes

### Starting Scanning:

1. Call `POST /api/scanning/start` with mode and speed
2. Get navigation structure via `GET /api/scanning/navigation`
3. Implement highlight logic based on mode
4. Use speed setting for timing

### During Scanning:

1. Log highlights via `POST /api/action-logs` with action_type `scan_highlight`
2. Log selections via `POST /api/scanning/select`
3. Play audio guide based on settings
4. Handle loop logic (finite vs infinite)

### Stopping Scanning:

1. Call `POST /api/scanning/stop`
2. Clear highlight state
3. Reset navigation

### Settings Management:

1. Load settings via `GET /api/settings/accessibility`
2. Update settings via `POST /api/settings/accessibility`
3. Settings persist across sessions

## Deliverable Status

✅ **Sprint 5 Deliverable Achieved:**

> "Scanning engine works across pages"

- ✅ All scanning modes implemented
- ✅ Speed control with 0.5s increments
- ✅ Loop settings (finite/infinite)
- ✅ Audio guide modes
- ✅ Navigation structure for all modes
- ✅ Action logging for scanning
- ✅ Settings persistence
- ✅ Cross-page navigation support

## Requirements Met

- ✅ Single-card scanning
- ✅ Row/column scanning
- ✅ Operation button scanning
- ✅ Adjustable scanning speed (0.5s increments)
- ✅ Adjustable loops / infinite loop
- ✅ Audio guide modes (off/beep/card audio)
- ✅ Settings stored in database
- ✅ Action logging for scanning events

## Next Steps (Sprint 6)

Sprint 6 will implement:

- External switch support (wired/wireless/Bluetooth)
- Eye-tracking support
- Long-press logic for Operation Button Scanning
- Hardware device detection and configuration
