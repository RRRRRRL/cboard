# Backend Routes Testing Guide

## Sprint 8-12 API Routes Testing

This document provides a testing checklist for all new backend routes implemented in Sprints 8-12.

### Prerequisites

1. Database is initialized and running
2. At least one user account exists (preferably with admin role for admin routes)
3. Backend server is running (PHP-FPM or built-in server)

### Testing Tools

You can use:
- Postman
- curl
- Browser (for GET requests)
- Frontend application

### Sprint 8 - Profile Transfer Routes

#### Base URL: `/api/transfer`

**1. Export Profile**
```bash
POST /api/transfer/export
Headers: Authorization: Bearer {token}
Body: { "profile_id": 1, "format": "json" }
Expected: 200, profile data in JSON format
```

**2. Import Profile**
```bash
POST /api/transfer/import
Headers: Authorization: Bearer {token}
Body: { "data": {...}, "format": "json" }
Expected: 200, success message with new profile_id
```

**3. Generate QR Code**
```bash
POST /api/transfer/qr/generate
Headers: Authorization: Bearer {token}
Body: { "profile_id": 1, "expires_in": 24 }
Expected: 200, token and QR data
```

**4. Redeem QR Token**
```bash
POST /api/transfer/qr/redeem
Headers: Authorization: Bearer {token}
Body: { "token": "..." }
Expected: 200, success message
```

**5. Generate Cloud Code**
```bash
POST /api/transfer/cloud/generate
Headers: Authorization: Bearer {token}
Body: { "profile_id": 1, "expires_in": 168 }
Expected: 200, cloud code
```

**6. Redeem Cloud Code**
```bash
POST /api/transfer/cloud/redeem
Headers: Authorization: Bearer {token}
Body: { "code": "ABC-123-XYZ" }
Expected: 200, success message
```

**7. Generate Email Transfer**
```bash
POST /api/transfer/email/generate
Headers: Authorization: Bearer {token}
Body: { "profile_id": 1, "email": "user@example.com", "expires_in": 168 }
Expected: 200, success message
```

**8. Validate Transfer Token**
```bash
GET /api/transfer/validate/{token}
Expected: 200, token validation result
```

### Sprint 9-10 - AI Routes

#### Base URL: `/api/ai`

**1. Get Card Suggestions**
```bash
POST /api/ai/suggest-cards
Headers: Authorization: Bearer {token}
Body: { "context": "hello", "profile_id": 1, "limit": 10 }
Expected: 200, array of suggested cards
```

**2. Get Typing Predictions**
```bash
POST /api/ai/typing-prediction
Headers: Authorization: Bearer {token}
Body: { "input": "hel", "language": "en", "limit": 5 }
Expected: 200, array of predictions
```

**3. Get Jyutping Predictions**
```bash
POST /api/ai/jyutping-prediction
Headers: Authorization: Bearer {token}
Body: { "input": "ngo", "limit": 10 }
Expected: 200, array of Jyutping predictions
```

**4. Update Adaptive Learning**
```bash
POST /api/ai/adaptive-learning
Headers: Authorization: Bearer {token}
Body: { "profile_id": 1, "card_id": 1, "difficulty": "medium", "performance": "correct" }
Expected: 200, success message
```

**5. Get Learning Statistics**
```bash
GET /api/ai/learning-stats?profile_id=1
Headers: Authorization: Bearer {token}
Expected: 200, learning statistics object
```

### Sprint 11 - Learning Games Routes

#### Base URL: `/api/games`

**1. Get Spelling Game**
```bash
GET /api/games/spelling?difficulty=medium&limit=10
Headers: Authorization: Bearer {token}
Expected: 200, game questions array
```

**2. Get Matching Game**
```bash
GET /api/games/matching?type=word-picture&limit=8
Headers: Authorization: Bearer {token}
Expected: 200, game pairs array
```

**3. Submit Game Result**
```bash
POST /api/games/submit
Headers: Authorization: Bearer {token}
Body: { "game_type": "spelling", "score": 8, "total_questions": 10, "time_spent": 120, "difficulty": "medium" }
Expected: 200, success with stats
```

**4. Get Game History**
```bash
GET /api/games/history?game_type=spelling&limit=20
Headers: Authorization: Bearer {token}
Expected: 200, game history array
```

### Sprint 11 - OCR Routes

#### Base URL: `/api/ocr`

**1. Recognize Image**
```bash
POST /api/ocr/recognize
Headers: Authorization: Bearer {token}
Body: { "image": "base64...", "image_url": "..." }
Expected: 200, recognized text
```

**2. Convert to Jyutping**
```bash
POST /api/ocr/convert-to-jyutping
Headers: Authorization: Bearer {token}
Body: { "text": "你好" }
Expected: 200, Jyutping conversion result
```

**3. Annotate Image**
```bash
POST /api/ocr/annotate
Headers: Authorization: Bearer {token}
Body: { "image": "base64...", "annotations": [...] }
Expected: 200, annotated image URL
```

**4. Get OCR History**
```bash
GET /api/ocr/history?limit=20&offset=0
Headers: Authorization: Bearer {token}
Expected: 200, history array
```

**5. Delete OCR History**
```bash
DELETE /api/ocr/history/{id}
Headers: Authorization: Bearer {token}
Expected: 200, success message
```

### Sprint 12 - Admin Routes

#### Base URL: `/api/admin` (Admin only)

**1. Get All Users**
```bash
GET /api/admin/users?page=1&limit=20&search=&role=&is_active=
Headers: Authorization: Bearer {admin_token}
Expected: 200, users array with pagination
```

**2. Get User Details**
```bash
GET /api/admin/users/{userId}
Headers: Authorization: Bearer {admin_token}
Expected: 200, user details with profiles and stats
```

**3. Update User**
```bash
PUT /api/admin/users/{userId}
Headers: Authorization: Bearer {admin_token}
Body: { "name": "...", "role": "teacher", "is_active": 1, "is_verified": 1 }
Expected: 200, updated user object
```

**4. Delete User**
```bash
DELETE /api/admin/users/{userId}
Headers: Authorization: Bearer {admin_token}
Expected: 200, success message
```

**5. Get Statistics**
```bash
GET /api/admin/statistics
Headers: Authorization: Bearer {admin_token}
Expected: 200, statistics object
```

### Sprint 12 - Action Logs Routes

#### Base URL: `/api/action-logs`

**1. Get Logs**
```bash
GET /api/action-logs?profile_id=1&action_type=card_click&start_date=&end_date=&limit=100&offset=0
Headers: Authorization: Bearer {token}
Expected: 200, logs array with pagination
```

**2. Export Logs**
```bash
GET /api/action-logs/export?profile_id=1&start_date=&end_date=
Headers: Authorization: Bearer {token}
Expected: 200, CSV file download
```

### Testing Checklist

- [ ] All transfer routes work correctly
- [ ] All AI routes return expected data
- [ ] All games routes function properly
- [ ] All OCR routes handle image processing
- [ ] Admin routes require admin role (403 for non-admin)
- [ ] Action logs routes return filtered data
- [ ] All routes handle authentication correctly (401 for no token)
- [ ] Error handling works for invalid inputs
- [ ] Pagination works correctly
- [ ] Filters work as expected

### Common Issues

1. **401 Unauthorized**: Check token is valid and included in Authorization header
2. **403 Forbidden**: User doesn't have required role (admin routes)
3. **404 Not Found**: Check route path is correct
4. **500 Internal Server Error**: Check database connection and PHP error logs
5. **CORS Errors**: Check CORS headers in index.php

### Quick Test Script

```bash
# Test health check
curl http://localhost/api

# Test authentication
curl -X POST http://localhost/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test transfer route (replace TOKEN)
curl -X POST http://localhost/api/transfer/qr/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"profile_id":1,"expires_in":24}'
```

