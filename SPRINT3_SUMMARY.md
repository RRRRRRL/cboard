# Sprint 3 - Card Editing Mode - COMPLETE

## ✅ Completed Features

### 1. Card CRUD Operations

- ✅ **Create Card** - POST /api/cards

  - Title, label, image, audio, colors, category
  - Stores in `cards` table

- ✅ **List Cards** - GET /api/cards

  - Optional filtering by profile_id
  - Optional filtering by category
  - Returns all card details

- ✅ **Get Card** - GET /api/cards/{id}

  - Returns single card details

- ✅ **Update Card** - PUT /api/cards/{id}

  - Update any card field
  - Maintains image_url/audio_url aliases

- ✅ **Delete Card** - DELETE /api/cards/{id}
  - Removes card and profile associations

### 2. Profile-Card Junction Operations

- ✅ **Add Card to Profile** - POST /api/profile-cards

  - Links card to profile with position (row, col, page)
  - Validates ownership
  - Prevents duplicates

- ✅ **Update Card Position** - PUT /api/profile-cards/{id}

  - Change row/col/page position
  - Toggle visibility

- ✅ **Remove Card from Profile** - DELETE /api/profile-cards/{id}

  - Removes card from profile (card remains in database)

- ✅ **Get Profile Cards** - GET /api/profile-cards?profile_id={id}
  - Returns all cards for a profile with positions
  - Ordered by page, row, column

### 3. Image Upload & Processing

- ✅ **File Upload** - POST /api/media

  - Handles image and audio files
  - Creates user-specific directories
  - Stores file metadata in database
  - Returns file URL

- ✅ **Image Compression** - POST /api/media/compress

  - Resizes images while maintaining aspect ratio
  - Configurable quality and max dimensions
  - Supports JPEG, PNG, GIF
  - Returns compression statistics

- ✅ **Auto Square Formatting** - POST /api/media/square
  - Converts images to square format
  - Centers image with white background
  - Configurable size
  - Maintains aspect ratio

### 4. Text-to-Image Generator

- ✅ **Generate Image from Text** - POST /api/media/text-to-image
  - Creates PNG image with text
  - Configurable dimensions, colors, font size
  - Saves to user directory
  - Returns image URL

### 5. Layout Template Support

- ✅ **Layout Templates** - GET /api/profiles/templates

  - Returns available layout templates
  - Includes: 1x1, 1x5, 4x6, 6x6, etc.
  - Helper functions for layout validation

- ✅ **Layout Validation**
  - Validates card positions against layout
  - Prevents invalid row/col indices

### 6. Voice Recording Support

- ✅ **Audio Upload** - POST /api/media
  - Handles audio file uploads
  - Stores in user directory
  - Links to cards via audio_path

## Files Created/Modified

### New Files:

1. `backend/api/routes/card.php` - Card CRUD operations
2. `backend/api/routes/profile-card.php` - Profile-card junction operations
3. `backend/api/helpers-layout.php` - Layout template helpers
4. `backend/uploads/.gitkeep` - Upload directory structure

### Modified Files:

1. `backend/api/routes/media.php` - Complete rewrite with file upload, compression, square formatting, text-to-image
2. `backend/api/routes/profile.php` - Added layout templates endpoint
3. `backend/api/index.php` - Added card and profile-card routes

## API Endpoints Implemented

### Card Endpoints:

- `GET /api/cards` - List cards (with optional filters)
- `GET /api/cards/{id}` - Get card details
- `POST /api/cards` - Create card
- `PUT /api/cards/{id}` - Update card
- `DELETE /api/cards/{id}` - Delete card

### Profile-Card Endpoints:

- `GET /api/profile-cards?profile_id={id}` - Get cards for profile
- `POST /api/profile-cards` - Add card to profile
- `PUT /api/profile-cards/{id}` - Update card position
- `DELETE /api/profile-cards/{id}` - Remove card from profile

### Media Endpoints:

- `POST /api/media` - Upload file (image/audio)
- `POST /api/media/compress` - Compress image
- `POST /api/media/square` - Make image square
- `POST /api/media/text-to-image` - Generate image from text

### Layout Endpoints:

- `GET /api/profiles/templates` - Get available layout templates

## Database Operations

All endpoints perform real database operations:

- ✅ Card creation, reading, updating, deletion
- ✅ Profile-card associations with positioning
- ✅ Media file metadata storage
- ✅ Layout template validation

## Image Processing Features

- ✅ **GD Library Integration**

  - Image resizing and compression
  - Format conversion support (JPEG, PNG, GIF)
  - Transparency preservation for PNG/GIF

- ✅ **Auto Square Formatting**

  - Centers image in square canvas
  - White background fill
  - Maintains aspect ratio

- ✅ **Text-to-Image**
  - Basic text rendering
  - Customizable colors and size
  - PNG output format

## Security Features

- ✅ User authentication required for all operations
- ✅ Ownership validation (users can only modify their own data)
- ✅ File upload validation
- ✅ SQL injection prevention
- ✅ User-specific file directories

## File Storage

- ✅ Files stored in `backend/uploads/user_{id}/`
- ✅ Unique filenames prevent conflicts
- ✅ File metadata in `media` table
- ✅ URLs relative to API base

## Layout Templates Supported

- 1x1, 1x2, 1x3, 1x4, 1x5
- 2x2, 2x3
- 3x3, 3x4
- 4x4, 4x5, 4x6
- 5x5, 6x6
- Grid (custom)

## Testing

### Test Card Creation:

```bash
curl -X POST http://localhost:8000/api/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjUyNjQ5ODMsImV4cCI6MTc2NTM1MTM4M30.P8t4Ohpwfsn2NE-hLfHX_kN-Esc-qM6LA6QjdDffWV4" \
  -d '{
    "title": "Hello",
    "label_text": "Hello",
    "text_color": "#000000",
    "background_color": "#FFFFFF",
    "category": "greetings"
  }'
```

### Test File Upload:

```bash
curl -X POST http://localhost:8000/api/media \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjUyNjQ5ODMsImV4cCI6MTc2NTM1MTM4M30.P8t4Ohpwfsn2NE-hLfHX_kN-Esc-qM6LA6QjdDffWV4" \
  -F "file=@/path/to/image.jpg"
```

### Test Image Compression:

```bash
curl -X POST http://localhost:8000/api/media/compress \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjUyNjQ5ODMsImV4cCI6MTc2NTM1MTM4M30.P8t4Ohpwfsn2NE-hLfHX_kN-Esc-qM6LA6QjdDffWV4" \
  -d '{
    "image_url": "/uploads/user_1/image.jpg",
    "max_width": 400,
    "max_height": 400,
    "quality": 80
  }'
```

### Test Add Card to Profile:

```bash
curl -X POST http://localhost:8000/api/profile-cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjUyNjQ5ODMsImV4cCI6MTc2NTM1MTM4M30.P8t4Ohpwfsn2NE-hLfHX_kN-Esc-qM6LA6QjdDffWV4" \
  -d '{
    "profile_id": 1,
    "card_id": 1,
    "row_index": 0,
    "col_index": 0,
    "page_index": 0
  }'
```

## Frontend Compatibility

The API maintains compatibility with existing Cboard structure:

- ✅ Card fields match frontend expectations
- ✅ Image/audio URL formats compatible
- ✅ Profile-card positioning structure
- ✅ Layout template support

## Next Steps (Sprint 4)

Sprint 4 will implement:

- Communication Mode
- Preset profiles
- TTS integration
- Sentence bar functionality
- Action logging

## Deliverable Status

✅ **Sprint 3 Deliverable Achieved:**

> "Full Editing Mode working with backend"

- ✅ Card CRUD operations complete
- ✅ Image upload and processing working
- ✅ Layout templates supported
- ✅ Profile-card positioning working
- ✅ All features integrated with database

## Requirements Met

- ✅ Layout templates (1x1, 1x5, 4x6, etc.)
- ✅ Card editing (titles, colors)
- ✅ Auto square-image formatting
- ✅ Image compression
- ✅ Text-to-image generator
- ✅ Voice recording upload support
