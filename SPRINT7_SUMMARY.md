# Sprint 7: Jyutping Keyboard - COMPLETE

## ✅ Completed Features

### 1. Jyutping Dictionary API Endpoints

- ✅ **GET /api/jyutping/search?code={code}** - Search Jyutping dictionary

  - Exact match search
  - Partial match (starts with) if no exact match
  - Returns matches ordered by frequency
  - No authentication required (public dictionary)

- ✅ **GET /api/jyutping/suggestions?input={input}** - Get word suggestions

  - Searches by Jyutping code, Hanzi, or word
  - Priority ordering: exact match > starts with > contains
  - Ordered by frequency for ranking
  - Supports limit parameter

- ✅ **POST /api/jyutping/audio** - Generate audio for Jyutping

  - Requires authentication
  - Accepts text and/or Jyutping code
  - Supports character or word type
  - Ready for TTS integration

- ✅ **POST /api/jyutping/learning-log** - Log learning progress
  - Requires authentication
  - Tracks user attempts
  - Updates existing entries for same day
  - Records correct/incorrect selections
  - Links to user and profile

### 2. Database Support

- ✅ **jyutping_dictionary** table exists in schema

  - Stores Jyutping codes, Hanzi characters, words
  - Frequency field for ranking suggestions
  - Tags for categorization
  - Indexed for fast lookups

- ✅ **jyutping_learning_log** table exists in schema
  - Tracks user learning progress
  - Records attempts and correctness
  - Links to user and profile
  - Indexed for analytics

### 3. Seed Data Script

- ✅ **seed-jyutping-dictionary.sql** - Sample dictionary data
  - Common greetings (你好, 唔該, etc.)
  - Common verbs (食, 飲, 去, etc.)
  - Common nouns (人, 水, 飯, etc.)
  - Numbers (一 through 十)
  - Common phrases
  - School and family terms
  - Total: ~50 sample entries

## Files Created/Modified

### New Files:

1. `backend/api/routes/jyutping.php` - Jyutping API routes handler
2. `backend/database/seed-jyutping-dictionary.sql` - Sample dictionary data
3. `backend/TEST_SPRINT7.sh` - Test script for Sprint 7 endpoints
4. `SPRINT7_SUMMARY.md` - This file

### Modified Files:

1. `backend/api/index.php` - Added Jyutping route handler

## API Endpoints Implemented

### Jyutping Dictionary:

- `GET /api/jyutping/search?code={code}` - Search dictionary

  - Query params: `code` (required)
  - Returns: Array of matches with Jyutping code, Hanzi, word, frequency

- `GET /api/jyutping/suggestions?input={input}` - Get suggestions
  - Query params: `input` (required), `limit` (optional, default 10)
  - Returns: Array of suggestions ordered by relevance and frequency

### Jyutping Audio:

- `POST /api/jyutping/audio` - Generate audio
  - Body: `{ "text": "...", "jyutping": "...", "type": "character|word" }`
  - Requires: Authentication
  - Returns: Audio generation response (ready for TTS integration)

### Learning Tracking:

- `POST /api/jyutping/learning-log` - Log learning progress
  - Body: `{ "jyutping_code": "...", "hanzi_expected": "...", "hanzi_selected": "...", "profile_id": ... }`
  - Requires: Authentication
  - Returns: Log entry with ID and correctness status

## Database Schema

### jyutping_dictionary Table:

```sql
CREATE TABLE `jyutping_dictionary` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `jyutping_code` VARCHAR(50) NOT NULL,  -- e.g., 'nei5', 'hou2'
    `hanzi` VARCHAR(10) NULL,  -- Single character
    `word` VARCHAR(50) NULL,  -- Optional multi-character word
    `frequency` INT DEFAULT 0,  -- Usage frequency for ranking
    `tags` VARCHAR(191) NULL,  -- e.g., 'daily,school'
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_jyutping_code` (`jyutping_code`),
    INDEX `idx_hanzi` (`hanzi`),
    INDEX `idx_word` (`word`),
    INDEX `idx_frequency` (`frequency`)
);
```

### jyutping_learning_log Table:

```sql
CREATE TABLE `jyutping_learning_log` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `profile_id` INT UNSIGNED NULL,
    `jyutping_code` VARCHAR(50) NOT NULL,
    `hanzi_expected` VARCHAR(10) NULL,
    `hanzi_selected` VARCHAR(10) NULL,
    `is_correct` TINYINT(1) DEFAULT 0,
    `attempt_count` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL,
    INDEX `idx_user_profile` (`user_id`, `profile_id`, `created_at`),
    INDEX `idx_jyutping_code` (`jyutping_code`)
);
```

## Testing

### Run Test Script:

```bash
cd backend
bash TEST_SPRINT7.sh
```

### Seed Dictionary Data:

```bash
mysql -u root -p cboard < backend/database/seed-jyutping-dictionary.sql
```

### Manual Testing:

```bash
# Search Jyutping
curl "http://localhost:8000/api/jyutping/search?code=nei5"

# Get suggestions
curl "http://localhost:8000/api/jyutping/suggestions?input=nei"

# Generate audio (requires auth)
curl -X POST http://localhost:8000/api/jyutping/audio \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjUyNjQ5ODMsImV4cCI6MTc2NTM1MTM4M30.P8t4Ohpwfsn2NE-hLfHX_kN-Esc-qM6LA6QjdDffWV4" \
  -H "Content-Type: application/json" \
  -d '{"text":"你好","jyutping":"nei5hou2","type":"word"}'

# Log learning (requires auth)
curl -X POST http://localhost:8000/api/jyutping/learning-log \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjUyNjQ5ODMsImV4cCI6MTc2NTM1MTM4M30.P8t4Ohpwfsn2NE-hLfHX_kN-Esc-qM6LA6QjdDffWV4" \
  -H "Content-Type: application/json" \
  -d '{"jyutping_code":"nei5","hanzi_expected":"你","hanzi_selected":"你"}'
```

## Next Steps (Frontend Implementation)

The backend API is complete. Frontend implementation needed:

1. **Jyutping Keyboard UI**

   - Two Jyutping layouts
   - QWERTY layout
   - Numeric layout
   - Layout switching

2. **Real-time Display**

   - Display Jyutping as typed
   - Show matched Hanzi
   - Show word suggestions

3. **Audio Integration**

   - Per-key audio playback
   - Per-character audio playback
   - Batch pronunciation

4. **Text Editor**

   - Full editing controls
   - Text sharing functionality

5. **Performance Optimization**
   - <100ms key response time
   - Caching for dictionary lookups
   - Optimized suggestion queries

## Status

✅ **Backend API Complete**

- All 4 endpoints implemented
- Database tables ready
- Seed data script provided
- Test script available

⏳ **Frontend Implementation Pending**

- Keyboard UI components
- Real-time display
- Audio integration
- Text editor

## Notes

- Dictionary search is public (no auth required)
- Audio and learning log require authentication
- Learning log automatically updates existing entries for same day
- Suggestions are ordered by relevance and frequency
- Ready for TTS service integration (audio endpoint placeholder)
