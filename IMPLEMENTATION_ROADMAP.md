# Cboard Enhancement - Implementation Roadmap

## Overview
This roadmap maps all 14 requirement categories to specific sprints and implementation tasks.

## Sprint Breakdown with Requirements Mapping

### ✅ Sprint 1: Environment Setup & Base Architecture (COMPLETE)

**Requirements Covered:**
- ✅ General System: Replace Firebase with PHP/MySQL
- ✅ Database schema for all requirements

**Deliverables:**
- ✅ PHP backend structure
- ✅ MySQL schema
- ✅ Placeholder API endpoints
- ✅ Configuration system

**Status:** ✅ Complete

---

### Sprint 2: User Profiles & Database Backbone

**Requirements Covered:**
- General System: Multi-profile support
- User Account System: Registration/login
- Editing Mode: Profile search + list, create/edit profiles

**Tasks:**
1. Implement user registration API
2. Implement user login with JWT
3. Implement profile CRUD operations
4. Connect frontend to backend
5. Add profile search functionality

**Database Tables:**
- `users` - User accounts
- `profiles` - User profiles

**API Endpoints:**
- `POST /api/user/register`
- `POST /api/user/login`
- `GET /api/profiles` (with search)
- `POST /api/profiles`
- `PUT /api/profiles/{id}`
- `DELETE /api/profiles/{id}`

**Deliverable:** Profile creation + editing persisted in MySQL

---

### Sprint 3: Card Editing Mode

**Requirements Covered:**
- Editing Mode: All features
  - Layout templates (1x1, 1x5, 4x6)
  - Card editing (titles, font size, colors)
  - Auto square-image formatting
  - Image compression
  - Text-to-image generator
  - Voice recording per card

**Tasks:**
1. Implement layout template system
2. Create card CRUD API
3. Implement image upload and processing
4. Add image compression
5. Integrate text-to-image API
6. Add voice recording upload
7. Build card editing UI

**Database Tables:**
- `cards` - Card definitions
- `profile_cards` - Card positioning
- `media` - Image/audio files

**API Endpoints:**
- `GET /api/cards`
- `POST /api/cards`
- `PUT /api/cards/{id}`
- `DELETE /api/cards/{id}`
- `POST /api/media` (upload)
- `POST /api/media/compress`
- `POST /api/media/text-to-image`

**Deliverable:** Full Editing Mode working with backend

---

### Sprint 4: Communication Mode

**Requirements Covered:**
- Communication Mode: All features
  - ≥10 preset profiles
  - View-only mode
  - Cantonese + English voices (≥6 types)
  - Variable speech rate
  - Visual card feedback
  - Sentence bar with playback + deletion
  - Cross-profile sentence composition
  - Swipe navigation

**Tasks:**
1. Create preset profiles (seed data)
2. Implement view-only mode
3. Integrate TTS service (Cantonese + English)
4. Add speech rate control
5. Build sentence bar UI
6. Implement sentence playback
7. Add action logging
8. Implement swipe navigation

**Database Tables:**
- `profiles` - Preset profiles
- `action_logs` - Sentence composition
- `settings` - Voice settings

**API Endpoints:**
- `GET /api/profiles/public` (preset profiles)
- `POST /api/settings` (voice settings)
- `POST /api/action-logs` (log actions)
- `GET /api/tts/speak` (text-to-speech)

**Deliverable:** Communication Mode fully functional

---

### Sprint 5: Accessibility - Scanning Engine

**Requirements Covered:**
- Accessibility Support: Scanning features
  - Single-card scanning
  - Row/column scanning
  - Operation button scanning
  - Adjustable scanning speed (0.5s increments)
  - Adjustable loops / infinite loop
  - Audio guide modes (off/beep/card audio)

**Tasks:**
1. Implement scanning highlight logic
2. Add single-card scanning
3. Add row/column scanning
4. Add operation button scanning
5. Implement speed control (0.5s increments)
6. Add loop settings
7. Implement audio guide modes
8. Store settings in database

**Database Tables:**
- `settings` - Scanning settings (JSON)

**API Endpoints:**
- `GET /api/settings/accessibility`
- `POST /api/settings/accessibility`
- `POST /api/action-logs` (scanning actions)

**Deliverable:** Scanning engine works across pages

---

### Sprint 6: External Switch + Eye Tracking

**Requirements Covered:**
- Accessibility Support: Hardware integration
  - External switches (wired/wireless/Bluetooth)
  - Eye-tracking support
  - Long-press logic for Operation Button Scanning

**Tasks:**
1. Implement switch detection API
2. Add wired switch support
3. Add wireless/Bluetooth switch support
4. Integrate eye-tracking SDK
5. Map eye-tracking events to card selection
6. Implement long-press logic
7. Add device configuration UI

**Database Tables:**
- `settings` - Device settings (JSON)

**API Endpoints:**
- `POST /api/devices/switch/register`
- `POST /api/devices/eyetracking/register`
- `GET /api/devices/list`
- `POST /api/action-logs` (device actions)

**Deliverable:** Tool usable entirely via switch or eye-tracking

---

### Sprint 7: Jyutping Keyboard

**Requirements Covered:**
- Jyutping Keyboard: All features
  - Two Jyutping layouts + QWERTY + numeric
  - Display Jyutping live as typed
  - Strict matching rules + exceptions
  - Audio playback per key + character
  - Related word suggestions
  - Batch pronunciation playback
  - Full text editing controls
  - Text sharing
  - ≤100ms key response

**Tasks:**
1. Populate Jyutping dictionary
2. Implement Jyutping input logic
3. Build matching engine
4. Add audio playback
5. Implement word suggestions
6. Add batch pronunciation
7. Build text editor
8. Add sharing functionality
9. Optimize for <100ms response

**Database Tables:**
- `jyutping_dictionary` - Dictionary data
- `jyutping_learning_log` - Learning tracking

**API Endpoints:**
- `GET /api/jyutping/search?code={code}`
- `GET /api/jyutping/suggestions?input={input}`
- `POST /api/jyutping/audio`
- `POST /api/jyutping/learning-log`

**Deliverable:** Fully functional Jyutping Communication Keyboard

---

### Sprint 8: Profile Transfer Engine

**Requirements Covered:**
- Profile Transfer System: All methods
  - QR code transfer
  - Cloud code transfer
  - Email ZIP transfer
  - Public profile library
  - Wireless device-to-device transfer
  - Import/export profiles
  - Cross-app compatibility

**Tasks:**
1. Implement QR code generation
2. Create cloud code system
3. Add email ZIP export/import
4. Build public profile library
5. Implement profile export (JSON/OBF)
6. Implement profile import
7. Add transfer token validation
8. Build transfer UI

**Database Tables:**
- `profile_transfer_tokens` - Transfer tokens
- `profiles` - Public profiles

**API Endpoints:**
- `POST /api/profiles/{id}/transfer/qr`
- `POST /api/profiles/{id}/transfer/cloud`
- `POST /api/profiles/{id}/transfer/email`
- `GET /api/profiles/transfer/{token}`
- `GET /api/profiles/{id}/export`
- `POST /api/profiles/import`
- `GET /api/profiles/public`

**Deliverable:** Cross-device profile transfer completed

---

### Sprint 9: AI Engine Phase 1

**Requirements Covered:**
- AI Functionality: Predictive features
  - AI card suggestion
  - AI typing prediction
  - Predictive Jyutping suggestions

**Tasks:**
1. Integrate AI service (OpenAI/Claude)
2. Implement card suggestion algorithm
3. Build typing prediction model
4. Add Jyutping prediction
5. Implement caching system
6. Add AI settings UI

**Database Tables:**
- `ai_cache` - AI response cache
- `action_logs` - Training data

**API Endpoints:**
- `POST /api/ai/card-suggestion`
- `POST /api/ai/predict-text`
- `POST /api/ai/predict-jyutping`
- `GET /api/ai/cache/clear`

**Deliverable:** AI-enhanced typing + AI card selection

---

### Sprint 10: AI Engine Phase 2

**Requirements Covered:**
- AI Functionality: Adaptive learning
  - AI Jyutping adaptive learning system
  - User-level learning model
  - Difficulty adjustment engine

**Tasks:**
1. Build learning model from logs
2. Implement difficulty adjustment
3. Create personalized suggestions
4. Add learning analytics
5. Implement adaptive algorithms

**Database Tables:**
- `jyutping_learning_log` - Learning data
- `ai_cache` - Model cache

**API Endpoints:**
- `POST /api/ai/adaptive-learning/analyze`
- `GET /api/ai/adaptive-learning/suggestions`
- `POST /api/ai/adaptive-learning/adjust-difficulty`

**Deliverable:** Personalized Jyutping assistant operational

---

### Sprint 11: Optional Modules

**Requirements Covered:**
- Learning Games:
  - Jyutping spelling game
  - Word-picture matching
  - Jyutping-picture matching
  - Game scoring and history
- OCR Translator:
  - OCR image recognition
  - Convert Chinese to Jyutping
  - Editable Jyutping text
  - Download annotated image
  - Save and review translations
  - Cantonese playback

**Tasks:**
1. Build Jyutping spelling game
2. Build word-picture matching game
3. Build Jyutping-picture matching game
4. Implement scoring system
5. Integrate OCR service
6. Build Chinese-to-Jyutping converter
7. Add image annotation
8. Implement translation history
9. Add playback functionality

**Database Tables:**
- `games_results` - Game scores
- `ocr_history` - OCR translations

**API Endpoints:**
- `POST /api/games/start`
- `POST /api/games/submit`
- `GET /api/games/results`
- `POST /api/ocr/recognize`
- `POST /api/ocr/convert`
- `GET /api/ocr/history`
- `GET /api/ocr/{id}/download`

**Deliverable:** Optional modules complete

---

### Sprint 12: Website + Logs + Final Integration + Security

**Requirements Covered:**
- Website Requirements:
  - Tool introduction page
  - News/updates page
  - User guides (video + document)
  - FAQ section
  - UX/UI designed website
  - 3-year maintenance plan
- Data Logging:
  - Log card clicks (date, time, profile, card)
  - In-app log viewer
  - Excel export
  - Configurable data retention
- Security & Compliance:
  - SRAA compliance
  - PIA compliance
  - Data export in open formats
  - PDPO compliance

**Tasks:**
1. Build website (introduction, news, guides, FAQ)
2. Implement comprehensive logging
3. Build log viewer UI
4. Add Excel export functionality
5. Implement data retention policies
6. Security audit and fixes
7. Privacy assessment
8. Data export features
9. Performance optimization
10. Final testing and QA

**Database Tables:**
- `action_logs` - All logging
- (Optional) `website_content` - CMS
- (Optional) `faq` - FAQ management

**API Endpoints:**
- `GET /api/logs` (with filters)
- `GET /api/logs/export` (Excel)
- `DELETE /api/logs/cleanup` (retention)
- `GET /api/export/user-data` (PDPO compliance)

**Deliverable:** Full release candidate build

---

## Requirements Coverage Summary

| Requirement Category | Sprint | Status |
|---------------------|--------|--------|
| 1. General System | 1-2 | ✅ |
| 2. Main Interface | 3-8, 11 | ⏳ |
| 3. Editing Mode | 3 | ⏳ |
| 4. Communication Mode | 4 | ⏳ |
| 5. Accessibility | 5-6 | ⏳ |
| 6. Profile Transfer | 8 | ⏳ |
| 7. Jyutping Keyboard | 7 | ⏳ |
| 8. Learning Games | 11 | ⏳ |
| 9. OCR Translator | 11 | ⏳ |
| 10. User Accounts | 2 | ⏳ |
| 11. AI Functionality | 9-10 | ⏳ |
| 12. Data Logging | 12 | ⏳ |
| 13. Website | 12 | ⏳ |
| 14. Security & Compliance | 12 | ⏳ |

## Critical Dependencies

1. **External Services:**
   - TTS service (Cantonese + English)
   - OCR service
   - AI service (OpenAI/Claude)
   - Image processing library
   - QR code generation

2. **Third-party Libraries:**
   - JWT for authentication
   - Image compression library
   - Excel export library
   - QR code library

3. **Hardware Integration:**
   - Switch device SDKs
   - Eye-tracking SDK

## Risk Mitigation

1. **Performance (<100ms keyboard):**
   - Database indexing
   - Response caching
   - Frontend optimization

2. **Security Compliance:**
   - Early security review
   - Regular audits
   - Penetration testing

3. **Data Privacy:**
   - Encryption at rest
   - Secure data export
   - Retention policies

## Success Metrics

- ✅ All 14 requirement categories covered
- ✅ Database schema supports all features
- ✅ API structure defined for all endpoints
- ⏳ Implementation in progress (Sprint 1 complete)

