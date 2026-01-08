# Cboard 4-Tier Architecture Quick Reference

**Architecture Type:** Distributed Multi-Tier with Security & Compliance  
**Deployment Target:** aac.uplifor.org (HTTPS)  
**Status:** ✅ Fully Aligned

---

## Architecture Summary

```
REQUIREMENT                          CURRENT IMPLEMENTATION
────────────────────────────────────────────────────────────────

TIER 1: Web & Reverse Proxy Layer
├─ Frontend + Nginx              ✅ React 17 + nginx:stable-alpine
├─ HTTPS/TLS                     ✅ Let's Encrypt (aac.uplifor.org)
├─ Security Headers              ✅ X-Frame-Options, X-Content-Type-Options, etc.
└─ Static Asset Serving          ✅ /build/ with 1-year cache

TIER 2: Application Layer
├─ PHP-FPM                       ✅ PHP 7.4+ (FPM mode)
├─ API Routes (20+)              ✅ backend/api/routes/*.php
├─ JWT Authentication            ✅ 24-hour tokens, bearer scheme
├─ Role-Based Access Control     ✅ 7 roles (admin, teacher, therapist, parent, student)
├─ Rate Limiting                 ✅ middleware/rateLimiter.php
└─ CORS Validation               ✅ config/config.php whitelist

TIER 3: Database Layer
├─ MySQL Server                  ✅ Dedicated (separate from app server)
├─ Tables (24 total)             ✅ Core + Jyutping + RBAC + Compliance
├─ Migrations                    ✅ Schema + role-based system
├─ Backups                       ✅ Setup required (daily minimum)
└─ Replication (Optional)        ✅ Read replicas supported

TIER 4: AI/OCR Services
├─ OCR Provider                  ✅ Photocen AI (external API)
├─ Integration Point             ✅ backend/api/routes/ocr.php
├─ Async Processing              ✅ Message queue compatible (future)
└─ Scalability                   ✅ External service = horizontal scaling

SECURITY & COMPLIANCE
├─ All External Calls HTTPS      ✅ Enforced via nginx redirect
├─ JWT Tokens                    ✅ HS256 signed, env-based secret
├─ Role-Based Access             ✅ Database + middleware validation
├─ Event Logging                 ✅ action_logs + card_logs tables
├─ SRAA Compliance               ✅ Access logs + audit trail
└─ PIA Compliance                ✅ Data permissions + retention policy
```

---

## Deployment Checklist (Summary)

### Before Deploying:

- [ ] Generate strong `JWT_SECRET` (min 32 chars)
- [ ] Set `APP_ENV=production` and `APP_DEBUG=false`
- [ ] Verify MySQL on separate server
- [ ] Verify PHP-FPM socket path
- [ ] Apply `combined_schema_matched.sql` to database
- [ ] Create `uploads/` directory with `www-data:www-data` ownership
- [ ] Confirm SSL certificates (Let's Encrypt)
- [ ] Update CORS whitelist (remove dev domains)

### After Deploying:

- [ ] Frontend loads at `https://aac.uplifor.org`
- [ ] API responds to `POST /api/auth/login`
- [ ] JWT tokens validate on protected routes
- [ ] Database tables present: `SHOW TABLES;` (24 tables)
- [ ] Action logs recorded: `SELECT * FROM action_logs LIMIT 10;`
- [ ] No 500 errors in logs
- [ ] HTTPS enforced (HTTP → 301 redirect)

---

## Key Files by Tier

### Tier 1: Web Layer

```
Dockerfile                      → Build: Node → Nginx
nginx-production.conf           → HTTPS config, reverse proxy, security headers
rootfs/                         → Docker overlay files
```

### Tier 2: Application Layer

```
backend/api/index.php           → Main API entry, CORS, JWT validation
backend/api/routes/*.php        → 20+ endpoint modules
backend/api/auth.php            → JWT generation & validation
backend/config/config.php       → App settings (CORS, JWT, timezone)
backend/env.example.txt         → Environment variable template
```

### Tier 3: Database Layer

```
backend/database/schema.sql                         → Core + Jyutping + Files
backend/database/combined_schema_matched.sql        → Ready-to-apply merged schema
backend/database/migrations/                        → Role-based system + others
```

### Tier 4: AI/OCR Layer

```
backend/api/routes/ocr.php      → OCR endpoint (image → text)
backend/env.example.txt         → PHOTOCEN_API_URL config
```

---

## Critical Environment Variables

| Variable       | Example                       | Purpose                                    |
| -------------- | ----------------------------- | ------------------------------------------ |
| `APP_ENV`      | `production`                  | Disables debug, enables optimizations      |
| `APP_DEBUG`    | `false`                       | Hides error details from users             |
| `JWT_SECRET`   | `<random-32+>`                | Signs/validates JWT tokens (generate new!) |
| `DB_HOST`      | `db.example.com`              | Separate MySQL server IP/hostname          |
| `DB_USER`      | `cboard_user`                 | Database user (NOT root)                   |
| `DB_PASS`      | `<strong-pwd>`                | Database password (20+ chars)              |
| `API_BASE_URL` | `https://aac.uplifor.org/api` | Frontend knows where API is                |

---

## Database Tables (24 Total)

**Core:**

```
users, profiles, boards, cards, profile_cards
```

**Jyutping (Cantonese):**

```
jyutping_dictionary, jyutping_learning_log
jyutping_matching_rules, jyutping_exception_rules
```

**Role-Based Access Control:**

```
organizations, classes, user_organization_roles
student_teacher_assignments, parent_child_relationships
data_sharing_permissions, learning_objectives
```

**Compliance & Logging:**

```
action_logs, card_logs, notifications
ocr_history, profile_transfer_tokens, transfer_codes
```

**Utility:**

```
settings, media, games_results, ai_cache
```

---

## API Endpoints (by Category)

**Authentication:**

```
POST   /api/auth/register         → Create user
POST   /api/auth/login            → Get JWT token
POST   /api/auth/refresh          → Renew token (24h)
POST   /api/auth/logout           → Invalidate token
```

**Profiles:**

```
GET    /api/profiles              → List user's profiles
POST   /api/profiles              → Create profile
GET    /api/profiles/:id          → Get profile
PUT    /api/profiles/:id          → Update profile
DELETE /api/profiles/:id          → Delete profile
```

**Boards & Cards:**

```
GET    /api/boards                → List boards
POST   /api/boards                → Create board
GET    /api/boards/:id            → Get board
PUT    /api/boards/:id            → Update board
POST   /api/cards                 → Create card
GET    /api/cards/:id             → Get card
```

**Jyutping (Cantonese):**

```
POST   /api/jyutping/search       → Dictionary search
POST   /api/jyutping/suggestions  → Typeahead suggestions
POST   /api/jyutping/rules        → Matching rules
```

**OCR (Image → Text):**

```
POST   /api/ocr/process           → Upload image, get text + jyutping
GET    /api/ocr/history           → View past OCR requests
```

**Users (RBAC Protected):**

```
GET    /api/users                 → List users (admin only)
GET    /api/users/:id             → Get user (authorized users only)
POST   /api/users/:id/role        → Assign role (admin only)
```

---

## Security Model

### Authentication Flow:

```
User Input Credentials
    ↓
POST /api/auth/login (HTTPS)
    ↓
Validate email + password (bcrypt hashed)
    ↓
Generate JWT token: {user_id, role, exp=24h}
    ↓
Sign with JWT_SECRET (HS256)
    ↓
Return Authorization: Bearer <token>
    ↓
Frontend stores token (localStorage/sessionStorage)
    ↓
All API requests include: Authorization: Bearer <token>
    ↓
Backend validates token on every request
    ↓
If valid & not expired: execute action
    ↓
If invalid/expired: return 401 Unauthorized
```

### Authorization Flow:

```
Request arrives with JWT token
    ↓
Extract user_id, role from token
    ↓
Check role ENUM (admin, teacher, therapist, parent, student)
    ↓
For sensitive operations, also check:
  - user_organization_roles (org-scoped roles)
  - student_teacher_assignments (class assignments)
  - data_sharing_permissions (privacy settings)
    ↓
If authorized: execute, log action
    ↓
If denied: return 403 Forbidden, log security event
```

---

## Logging & Compliance

**What Gets Logged (action_logs table):**

```
- User login/logout
- Card clicks and board navigation
- Board creation, modification, deletion
- Profile creation, modification, deletion
- Profile sharing and access grants
- Data exports and sensitive operations
- API calls from external services
```

**Logged Data:**

```
{
  user_id,              → Who did it
  action_type,          → What action (e.g., 'card_click', 'board_edit')
  created_at,           → When
  profile_id,           → Which profile (if applicable)
  board_id, card_id,    → Which items (if applicable)
  organization_id,      → Organization context (RBAC)
  class_id,             → Class context (RBAC)
  metadata: {...}       → Extra context (e.g., scanning speed, device)
}
```

---

## Deployment Commands

### Build Docker Image:

```bash
docker build -t cboard:latest .
```

### Run Container (with env vars):

```bash
docker run -d \
  -e APP_ENV=production \
  -e APP_DEBUG=false \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e DB_HOST=<your-db-server> \
  -e DB_USER=<user> \
  -e DB_PASS=<password> \
  -e API_BASE_URL=https://aac.uplifor.org/api \
  -p 80:80 \
  -p 443:443 \
  --name cboard \
  cboard:latest
```

### Apply Database Migrations:

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME \
  < backend/database/combined_schema_matched.sql
```

### Verify Deployment:

```bash
# Check frontend
curl -I https://aac.uplifor.org

# Check API
curl -X POST https://aac.uplifor.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Check database
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME \
  -e "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='cboard';"
```

---

## Common Issues & Solutions

| Problem                        | Solution                                                  |
| ------------------------------ | --------------------------------------------------------- |
| `502 Bad Gateway`              | PHP-FPM socket path wrong in nginx config                 |
| `403 Forbidden` on API         | JWT token missing or invalid (check Authorization header) |
| `CORS Error`                   | Domain not in `backend/config/config.php` cors_origins    |
| `JWT token invalid`            | JWT_SECRET not set or changed (regenerate tokens)         |
| `Permission denied` on uploads | Uploads dir not owned by `www-data:www-data`              |
| `SSL cert not found`           | Let's Encrypt path wrong, or cert expired (renew)         |
| `No tables in DB`              | Migrations not applied (run combined_schema_matched.sql)  |

---

## Support Documents

- **`DEPLOYMENT_CHECKLIST.md`** — Full pre-deployment checklist with all issues & fixes
- **`ARCHITECTURE_TOPOLOGY.md`** — Detailed tier-by-tier breakdown with diagrams
- **`DEPLOYMENT_SUMMARY.md`** — Quick summary with action items

---

**Status:** ✅ Ready for Production Deployment (January 7, 2026)
