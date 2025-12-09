# Cboard Enhancement Requirements Mapping

## Overview
This document maps all project requirements to database schema, API endpoints, and implementation sprints.

## 1. GENERAL SYSTEM REQUIREMENTS

| Requirement | Status | Implementation | Notes |
|------------|--------|---------------|-------|
| Use Cboard open-source as base (React frontend) | ✅ | Sprint 1 | Existing codebase |
| Replace Firebase backend with PHP/MySQL | ✅ | Sprint 1 | Backend API created |
| Mobile/tablet responsive interface | ✅ | Existing | Cboard already responsive |
| Multi-profile support | ✅ | Sprint 2 | `profiles` table with `user_id` FK |
| 1500+ built-in images | ⏳ | Sprint 3 | Media table + file storage |
| Full switch scanning + accessibility | ⏳ | Sprint 5-6 | Accessibility tables needed |

**Database Support:**
- ✅ `users` table - Multi-user support
- ✅ `profiles` table - Multi-profile per user
- ✅ `media` table - Image storage
- ⏳ Need: Accessibility settings table

## 2. MAIN INTERFACE REQUIREMENTS

| Requirement | Status | Sprint | Database/API |
|------------|--------|--------|--------------|
| Editing Mode | ⏳ | Sprint 3 | `profiles`, `cards`, `profile_cards` |
| Communication Mode | ⏳ | Sprint 4 | `profiles`, `cards`, `action_logs` |
| Profile Transfer | ⏳ | Sprint 8 | `profile_transfer_tokens` |
| Jyutping Keyboard | ⏳ | Sprint 7 | `jyutping_dictionary` |
| Jyutping Learning Game | ⏳ | Sprint 11 | `games_results`, `jyutping_learning_log` |
| Jyutping Translator | ⏳ | Sprint 11 | `ocr_history` |

**Database Support:**
- ✅ All required tables exist in schema

## 3. EDITING MODE FEATURES

| Requirement | Status | Database Fields | API Endpoints |
|------------|--------|-----------------|---------------|
| Profile search + list | ⏳ | `profiles.display_name`, `profiles.description` | `GET /api/profiles` |
| Create/edit profiles | ⏳ | `profiles` table | `POST /api/profiles`, `PUT /api/profiles/{id}` |
| Layout templates (1x1, 1x5, 4x6) | ⏳ | `profiles.layout_type` | Profile creation/update |
| Card editing: titles, font size, colors | ⏳ | `cards.title`, `cards.text_color`, `cards.background_color` | `POST /api/cards`, `PUT /api/cards/{id}` |
| Auto square-image formatting | ⏳ | `cards.image_path` | Image processing API |
| Image compression | ⏳ | `media.file_size`, `media.file_path` | Media upload API |
| Text-to-image generator | ⏳ | `cards.image_path` | AI/image generation API |
| Voice recording per card | ⏳ | `cards.audio_path` | Media upload API |

**Database Support:**
- ✅ `profiles.layout_type` - Layout templates
- ✅ `cards.title`, `cards.text_color`, `cards.background_color` - Card styling
- ✅ `cards.image_path`, `cards.audio_path` - Media storage
- ✅ `profile_cards.row_index`, `col_index`, `page_index` - Layout positioning

**API Endpoints Needed:**
- `GET /api/profiles` - List profiles with search
- `POST /api/profiles` - Create profile
- `PUT /api/profiles/{id}` - Update profile
- `DELETE /api/profiles/{id}` - Delete profile
- `GET /api/cards` - List cards
- `POST /api/cards` - Create card
- `PUT /api/cards/{id}` - Update card
- `POST /api/media` - Upload image/audio
- `POST /api/media/compress` - Compress image

## 4. COMMUNICATION MODE FEATURES

| Requirement | Status | Database Fields | Implementation |
|------------|--------|-----------------|----------------|
| ≥10 preset profiles | ⏳ | `profiles.is_public = 1` | Seed data |
| View-only mode | ⏳ | User permissions | Frontend + API |
| Cantonese + English voices (≥6 types) | ⏳ | `settings.settings_data` (JSON) | Speech API integration |
| Variable speech rate | ⏳ | `settings.settings_data` | Settings API |
| Visual card feedback | ⏳ | Frontend | UI implementation |
| Sentence bar with playback + deletion | ⏳ | Frontend + `action_logs` | Frontend + logging |
| Cross-profile sentence composition | ⏳ | `action_logs.profile_id` | Logging system |
| Swipe navigation with toggle | ⏳ | Frontend | UI implementation |

**Database Support:**
- ✅ `profiles.is_public` - Public profiles
- ✅ `settings.settings_data` (JSON) - Voice settings, speech rate
- ✅ `action_logs` - Sentence composition tracking

**API Endpoints Needed:**
- `GET /api/profiles/public` - Get public profiles
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Update settings (voice, speech rate)
- `POST /api/action-logs` - Log card actions

## 5. ACCESSIBILITY SUPPORT

| Requirement | Status | Database Fields | Implementation |
|------------|--------|-----------------|----------------|
| External switches (wired/wireless/Bluetooth) | ⏳ | `settings.settings_data` | Device detection API |
| Single-card scanning | ⏳ | Frontend | UI implementation |
| Row/column scanning | ⏳ | Frontend | UI implementation |
| Operation button scanning | ⏳ | Frontend | UI implementation |
| Adjustable scanning speed (0.5s increments) | ⏳ | `settings.settings_data` | Settings API |
| Adjustable loops / infinite loop | ⏳ | `settings.settings_data` | Settings API |
| Audio guide modes (off/beep/card audio) | ⏳ | `settings.settings_data` | Settings API |
| Eye-tracking support | ⏳ | `settings.settings_data` | Device integration |

**Database Support:**
- ✅ `settings.settings_data` (JSON) - All accessibility settings
- ⏳ Need: Separate accessibility_settings table for better structure

**Settings JSON Structure:**
```json
{
  "accessibility": {
    "scanning": {
      "mode": "single|row|column|operation",
      "speed": 1.0,
      "loop": "finite|infinite",
      "loop_count": 3
    },
    "audio_guide": "off|beep|card_audio",
    "switch": {
      "type": "wired|wireless|bluetooth",
      "device_id": "..."
    },
    "eye_tracking": {
      "enabled": false,
      "device": "..."
    }
  }
}
```

## 6. PROFILE TRANSFER SYSTEM

| Requirement | Status | Database Table | API Endpoints |
|------------|--------|----------------|---------------|
| Wireless device-to-device transfer | ⏳ | `profile_transfer_tokens` | `POST /api/profiles/{id}/transfer` |
| Import/export profiles | ⏳ | `profiles`, `cards`, `profile_cards` | `GET /api/profiles/{id}/export` |
| Cross-app compatibility | ⏳ | Export format | Standard format (JSON/OBF) |
| QR code transfer | ⏳ | `profile_transfer_tokens` | `POST /api/profiles/{id}/transfer/qr` |
| Cloud code transfer | ⏳ | `profile_transfer_tokens` | `POST /api/profiles/{id}/transfer/cloud` |
| Email ZIP transfer | ⏳ | `profile_transfer_tokens` | `POST /api/profiles/{id}/transfer/email` |
| Public profile library | ⏳ | `profiles.is_public` | `GET /api/profiles/public` |

**Database Support:**
- ✅ `profile_transfer_tokens` - All transfer methods
- ✅ `profiles.is_public` - Public library

**API Endpoints Needed:**
- `POST /api/profiles/{id}/transfer` - Create transfer token
- `GET /api/profiles/transfer/{token}` - Retrieve profile by token
- `GET /api/profiles/{id}/export` - Export profile (JSON/ZIP)
- `POST /api/profiles/import` - Import profile
- `GET /api/profiles/public` - Public profile library

## 7. JYUTPING KEYBOARD REQUIREMENTS

| Requirement | Status | Database Table | Implementation |
|------------|--------|----------------|----------------|
| Two Jyutping layouts + QWERTY + numeric | ⏳ | Frontend | UI layouts |
| Display Jyutping live as typed | ⏳ | Frontend | Real-time display |
| Strict matching rules + exceptions | ⏳ | `jyutping_dictionary` | Dictionary lookup |
| Audio playback per key + character | ⏳ | `jyutping_dictionary` | TTS integration |
| Related word suggestions | ⏳ | `jyutping_dictionary.frequency` | AI/ranking |
| Batch pronunciation playback | ⏳ | Frontend | TTS batch |
| Full text editing controls | ⏳ | Frontend | Text editor |
| Text sharing to browser/social | ⏳ | Frontend | Share API |
| ≤100ms key response | ⏳ | Performance | Optimization |

**Database Support:**
- ✅ `jyutping_dictionary` - All Jyutping data
- ✅ `jyutping_dictionary.frequency` - For ranking suggestions
- ✅ `jyutping_dictionary.tags` - For categorization

**API Endpoints Needed:**
- `GET /api/jyutping/search?code={code}` - Search Jyutping
- `GET /api/jyutping/suggestions?input={input}` - Get suggestions
- `POST /api/jyutping/audio` - Generate audio

## 8. OPTIONAL LEARNING GAME REQUIREMENTS

| Requirement | Status | Database Table | Implementation |
|------------|--------|----------------|----------------|
| Jyutping spelling game | ⏳ | `games_results` | Game logic |
| Word-picture matching | ⏳ | `games_results` | Game logic |
| Jyutping-picture matching | ⏳ | `games_results` | Game logic |
| Game scoring and history | ⏳ | `games_results` | Scoring system |

**Database Support:**
- ✅ `games_results` - All game data
- ✅ `jyutping_learning_log` - Learning progress

**API Endpoints Needed:**
- `POST /api/games/start` - Start game
- `POST /api/games/submit` - Submit answer
- `GET /api/games/results` - Get game history
- `GET /api/games/leaderboard` - Leaderboard

## 9. OPTIONAL JYUTPING TRANSLATOR

| Requirement | Status | Database Table | Implementation |
|------------|--------|----------------|----------------|
| OCR image text recognition | ⏳ | `ocr_history` | OCR API integration |
| Convert Chinese to Jyutping | ⏳ | `ocr_history.jyutping_result` | Conversion logic |
| Editable Jyutping text | ⏳ | Frontend | Text editor |
| Download annotated image | ⏳ | `ocr_history.source_image_path` | Image processing |
| Save and review past translations | ⏳ | `ocr_history` | History API |
| Cantonese playback word-by-word | ⏳ | `ocr_history.jyutping_result` | TTS integration |

**Database Support:**
- ✅ `ocr_history` - All OCR data

**API Endpoints Needed:**
- `POST /api/ocr/recognize` - OCR image
- `POST /api/ocr/convert` - Convert to Jyutping
- `GET /api/ocr/history` - Get history
- `GET /api/ocr/{id}/download` - Download annotated image

## 10. USER ACCOUNT SYSTEM (OPTIONAL)

| Requirement | Status | Database Table | Implementation |
|------------|--------|----------------|----------------|
| Username/password registration | ⏳ | `users` | Registration API |
| Multi-device sync when online | ⏳ | `users`, `profiles` | Sync API |
| Offline restrictions | ⏳ | Frontend | Offline detection |

**Database Support:**
- ✅ `users` - All user data
- ✅ `users.password_hash` - Password storage
- ✅ `users.is_verified` - Email verification

**API Endpoints Needed:**
- `POST /api/user/register` - Register user
- `POST /api/user/login` - Login
- `POST /api/sync` - Sync data
- `GET /api/sync/status` - Sync status

## 11. AI FUNCTIONALITY

| Requirement | Status | Database Table | Implementation |
|------------|--------|----------------|----------------|
| AI card suggestion | ⏳ | `ai_cache` | AI API integration |
| AI typing prediction | ⏳ | `ai_cache` | AI API integration |
| AI Jyutping adaptive learning | ⏳ | `jyutping_learning_log`, `ai_cache` | ML model |

**Database Support:**
- ✅ `ai_cache` - AI response caching
- ✅ `jyutping_learning_log` - Learning data for ML

**API Endpoints Needed:**
- `POST /api/ai/card-suggestion` - Suggest cards
- `POST /api/ai/predict-text` - Predict text
- `POST /api/ai/adaptive-learning` - Adaptive learning

## 12. DATA LOGGING REQUIREMENTS

| Requirement | Status | Database Table | Implementation |
|------------|--------|----------------|----------------|
| Log card clicks: date, time, profile, card | ⏳ | `action_logs` | Logging API |
| In-app log viewer | ⏳ | `action_logs` | Log viewer API |
| Excel export | ⏳ | `action_logs` | Export API |
| Configurable data retention | ⏳ | `action_logs` | Retention policy |

**Database Support:**
- ✅ `action_logs` - All logging data
- ✅ `action_logs.created_at` - Timestamp
- ✅ `action_logs.metadata` (JSON) - Additional data

**API Endpoints Needed:**
- `POST /api/logs` - Create log entry
- `GET /api/logs` - Get logs (filtered)
- `GET /api/logs/export` - Export to Excel
- `DELETE /api/logs/cleanup` - Cleanup old logs

## 13. WEBSITE REQUIREMENTS

| Requirement | Status | Implementation | Notes |
|------------|--------|-----------------|-------|
| Tool introduction page | ⏳ | Sprint 12 | Static site |
| News/updates page | ⏳ | Sprint 12 | CMS or static |
| User guides (video + document) | ⏳ | Sprint 12 | Media hosting |
| FAQ section | ⏳ | Sprint 12 | Static or CMS |
| UX/UI designed website | ⏳ | Sprint 12 | Design required |
| 3-year maintenance | ⏳ | Post-launch | Ongoing |

**Database Support:**
- ⏳ May need: `website_content` table for CMS
- ⏳ May need: `faq` table for FAQ management

## 14. SECURITY & COMPLIANCE

| Requirement | Status | Implementation | Notes |
|------------|--------|-----------------|-------|
| Pass SRAA (Security Risk Assessment) | ⏳ | Sprint 12 | Security audit |
| Pass PIA (Personal Information Assessment) | ⏳ | Sprint 12 | Privacy audit |
| Support data export in open formats | ⏳ | All sprints | JSON/CSV export |
| PDPO compliance | ⏳ | All sprints | Hong Kong privacy law |

**Database Support:**
- ✅ All tables support data export
- ✅ User data can be anonymized
- ✅ Logs can be purged per retention policy

**Security Features Needed:**
- Password hashing (bcrypt/argon2)
- JWT token authentication
- HTTPS enforcement
- SQL injection prevention (PDO prepared statements)
- XSS prevention
- CSRF protection
- Rate limiting
- Data encryption at rest
- Audit logging

## Implementation Priority

### Phase 1 (Sprint 1-2): Foundation ✅
- ✅ Database schema
- ✅ API structure
- ✅ User authentication

### Phase 2 (Sprint 3-4): Core Features
- Editing Mode
- Communication Mode

### Phase 3 (Sprint 5-6): Accessibility
- Switch support
- Eye tracking
- Scanning modes

### Phase 4 (Sprint 7-8): Advanced Features
- Jyutping Keyboard
- Profile Transfer

### Phase 5 (Sprint 9-10): AI Features
- AI suggestions
- Adaptive learning

### Phase 6 (Sprint 11): Optional Modules
- Learning games
- OCR translator

### Phase 7 (Sprint 12): Polish & Compliance
- Website
- Logging
- Security compliance

## Gaps Identified

### Missing Database Tables
- ⏳ `accessibility_settings` - Could be separate table instead of JSON
- ⏳ `website_content` - For CMS functionality
- ⏳ `faq` - For FAQ management

### Missing API Endpoints
- All endpoints are placeholders - need full implementation in Sprint 2+

### Missing Features
- Image processing library integration
- OCR service integration
- TTS service integration
- AI service integration
- File compression
- QR code generation
- Email service

## Next Steps

1. ✅ Database schema complete
2. ⏳ Implement core API endpoints (Sprint 2)
3. ⏳ Add missing tables if needed
4. ⏳ Integrate external services
5. ⏳ Security hardening
6. ⏳ Performance optimization

