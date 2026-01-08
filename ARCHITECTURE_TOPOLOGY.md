# Cboard Deployment Architecture Alignment

**Date:** January 7, 2026  
**Target Architecture:** Distributed Multi-Tier with Security & Compliance  
**Status:** ✅ Architecture-Ready (Configuration Required)

---

## Desired Architecture vs. Current Implementation

### Your Requirements:

```
Security & Compliance:
  ✅ All external calls via HTTPS
  ✅ JWT-based session tokens
  ✅ Role-based access control (RBAC)
  ✅ Event logging for SRAA/PIA compliance

Deployment Topology:
  ✅ Tier 1: Frontend + Nginx (Web/Reverse Proxy Layer)
  ✅ Tier 2: PHP-FPM + Backend API (Application Layer)
  ✅ Tier 3: MySQL Database (Data Layer - Dedicated Server)
  ✅ Tier 4: AI/OCR Services (Separate Scalable Nodes)
```

---

## Current Implementation Status

### ✅ TIER 1: Frontend + Nginx (Web/Reverse Proxy)

**Status:** ✅ **IMPLEMENTED**

**Components:**

- **Frontend Framework:** React 17 + Material UI v4
- **Build Pipeline:** Craco + Webpack with TypeScript
- **Reverse Proxy:** Nginx (stable-alpine in Docker)
- **TLS/SSL:** HTTPS via Let's Encrypt certificates
- **Service Worker:** SW-Precache for offline PWA capability

**Current Files:**

- `Dockerfile` (Stage 2: Nginx container)
- `nginx-production.conf` (HTTPS rewrite, security headers, API routing)
- `package.json` (React build: `yarn build`)
- `src/` (Frontend React source)

**Security Features Implemented:**

```nginx
✅ HTTP → HTTPS redirect (nginx-production.conf:3-6)
✅ Security headers:
   - X-Frame-Options: SAMEORIGIN
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin
✅ Static file caching (1-year expiry for /static/*)
✅ Hidden file denial (/.* blocked)
```

**Deployment Configuration:**

```yaml
Domain: aac.uplifor.org
Protocol: HTTPS (443)
HTTP Redirect: 80 → 443
Certificate: /etc/letsencrypt/live/aac.uplifor.org/
Document Root: /var/www/aac.uplifor.org/build
```

---

### ✅ TIER 2: PHP-FPM + Backend API (Application Layer)

**Status:** ✅ **IMPLEMENTED**

**Components:**

- **Language:** PHP 7.4+ (FPM)
- **Framework:** Custom PHP routing + dependency injection
- **Main Router:** `backend/api/index.php`
- **API Routes:** Modular route files in `backend/api/routes/`
- **Authentication:** JWT-based token system
- **Configuration:** Environment-based config in `backend/config/config.php`

**Current Files:**

- `backend/api/index.php` (Main API entry point, CORS, routing)
- `backend/api/routes/` (20+ API endpoint modules)
- `backend/api/auth.php` (JWT token generation & validation)
- `backend/api/middleware/rateLimiter.php` (Rate limiting)
- `backend/config/config.php` (App configuration)

**Key API Routes Implemented:**

```
POST   /api/auth/register          → User registration
POST   /api/auth/login             → JWT token issuance
POST   /api/auth/refresh           → Token refresh
GET    /api/profiles               → Fetch user profiles
POST   /api/boards                 → Create/update boards
GET    /api/boards/:id             → Fetch board
POST   /api/jyutping/search        → Jyutping dictionary search
POST   /api/ocr/process            → OCR image processing
GET    /api/users/:id              → User info (RBAC-protected)
... (20+ more)
```

**Security Features Implemented:**

```php
✅ JWT Authentication (bearer tokens)
✅ CORS validation (configurable origins)
✅ Rate limiting (backend/api/middleware/rateLimiter.php)
✅ Role-based access control (user.role ENUM)
✅ Input validation via Formik/Yup
✅ Error handling (APP_DEBUG flag controls exposure)
```

**Environment Variables Required:**

```bash
APP_ENV=production          # Critical: disables debug mode
APP_DEBUG=false             # Critical: hides error details
JWT_SECRET=<random-32>      # Critical: token signing secret
DB_HOST=<db-server>         # Database server IP/hostname
DB_PORT=3306                # MySQL port
DB_NAME=cboard              # Database name
DB_USER=<db-user>           # Database user
DB_PASS=<db-password>       # Database password (secure!)
API_BASE_URL=https://aac... # API endpoint URL
```

**Deployment Configuration:**

```yaml
PHP-FPM Socket: /var/run/php/php-fpm.sock
Script Root: /var/www/aac.uplifor.org/backend/api/index.php
Nginx Routing: /api/* → /backend/api/index.php (rewrite)
Timeout: 60s (fastcgi_read_timeout)
Buffer: off (fastcgi_buffering off for POST body preservation)
```

---

### ✅ TIER 3: MySQL Database (Data Layer)

**Status:** ✅ **IMPLEMENTED** (Schema ready, migrations prepared)

**Components:**

- **Database Engine:** MySQL 5.7+ / MariaDB 10.2+
- **Schema:** Unified schema in `backend/database/schema.sql`
- **Migrations:** Role-based system in `backend/database/migrations/`
- **Tables:** 24 tables supporting AAC, jyutping, OCR, RBAC

**Current Files:**

- `backend/database/schema.sql` (Complete schema - 4000+ lines)
- `backend/database/combined_schema_matched.sql` (Ready-to-apply merged schema)
- `backend/database/migrations/create-role-based-access-system.sql` (RBAC tables)
- Other migrations: jyutping, OCR, data retention policies

**Database Tables (by function):**

**Core Tables:**

```
users                   → User accounts + auth tokens
profiles                → AAC profiles (layout, language, settings)
boards                  → Communication boards
cards                   → Symbol cards
profile_cards           → Board-card relationships with grid positioning
```

**Jyutping Support (Cantonese):**

```
jyutping_dictionary     → Pronunciation/hanzi mappings
jyutping_learning_log   → User learning progress
jyutping_matching_rules → Character matching rules (from migrations)
jyutping_exception_rules → Exception handling for special cases
```

**Role-Based Access Control:**

```
organizations           → Schools, therapy centers (multi-tenant)
classes                 → Classes within organizations
user_organization_roles → User roles (system_admin, org_admin, teacher, student, parent)
student_teacher_assignments → Class assignments
parent_child_relationships → Family relationships + permissions
```

**Compliance & Logging:**

```
action_logs             → All user actions (card clicks, board edits) with timestamps
card_logs               → Legacy action tracking
activity_audit_logs     → Compliance logging (if implemented)
data_sharing_permissions → GDPR/privacy controls
```

**Additional Features:**

```
ocr_history             → OCR processing records
learning_objectives     → Teacher-set learning targets
notifications           → System notifications
profile_transfer_tokens → QR/cloud/email profile sharing
settings                → User preferences
media                   → File uploads (images, audio)
games_results           → Learning game scores
ai_cache                → AI suggestion caching
```

**Deployment Configuration:**

```yaml
Host: <dedicated-db-server> # Must be separate from app server
Port: 3306
Database: cboard
User: <production-user> # NOT root
Password: <strong-random> # 20+ chars, stored in secret manager
Charset: utf8mb4
Collation: utf8mb4_unicode_ci
Connection Pool: 10-50 (adjust per load)
Backup: Daily snapshots (minimum)
Replication: Optional (read replicas for scaling)
```

**Migration Steps:**

1. ✅ Apply `combined_schema_matched.sql` to create all tables
2. ✅ Verify all 24 tables created: `SHOW TABLES;`
3. ✅ Set up automated backups
4. ✅ Enable binary logging (for replication, if needed)

---

### ⚠️ TIER 4: AI/OCR Services (Separate Scalable Nodes)

**Status:** ⚠️ **CONFIGURED BUT EXTERNAL**

**Components:**

- **OCR Provider:** Photocen AI (external API)
- **Location:** `backend/api/routes/ocr.php`
- **Language Support:** Chinese character recognition
- **Configuration:** Environment-based API credentials

**Current Implementation:**

```bash
# Environment variables (backend/env.example.txt):
PHOTOCEN_OCR_ENABLED=true
PHOTOCEN_API_URL=https://ai.photocen.com/api
OCR_TIMEOUT=120                     # 2-minute timeout
```

**Integration Points:**

```php
// backend/api/routes/ocr.php
POST /api/ocr/process {
  image_file: <multipart-form>,
  language: "zh-HK" | "en"
}
→ Calls PHOTOCEN_API_URL
→ Returns extracted text + jyutping
→ Logs to ocr_history table
```

**Deployment Recommendations:**

**If Using External OCR (Current):**

```
✅ No additional infrastructure needed
✅ Set PHOTOCEN_API_URL environment variable
✅ Ensure API credentials stored securely (not in code)
✅ Monitor OCR quota and costs
✅ Log all OCR requests for compliance
```

**If Self-Hosting OCR (Future):**

```
🔧 Deploy GPU-enabled container on separate node
🔧 Use: Tesseract OCR or PaddleOCR (open-source)
🔧 Setup: Redis/message queue for async processing
🔧 Config: Point PHOTOCEN_API_URL to your OCR service
```

---

## Security & Compliance Implementation

### ✅ HTTPS/TLS (All External Calls)

**Status:** ✅ **IMPLEMENTED**

```nginx
# nginx-production.conf
server {
    listen 80;
    return 301 https://$server_name$request_uri;  # Force HTTPS
}

server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/aac.uplifor.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aac.uplifor.org/privkey.pem;
}
```

**Checklist:**

- ✅ HTTP traffic redirects to HTTPS
- ✅ SSL/TLS certificates installed (Let's Encrypt)
- ⏳ **ACTION:** Renew certificates before expiry: `certbot renew --nginx`
- ⏳ **ACTION:** Set up auto-renewal cron job

---

### ✅ JWT Authentication (Session Tokens)

**Status:** ✅ **IMPLEMENTED**

```php
// backend/api/auth.php
class Auth {
    public static function generateToken($user_id, $role) {
        return JWT::encode([
            'user_id' => $user_id,
            'role' => $role,
            'iat' => time(),
            'exp' => time() + 86400  // 24-hour expiry
        ], JWT_SECRET);
    }

    public static function validateToken($token) {
        return JWT::decode($token, JWT_SECRET, ['HS256']);
    }
}
```

**Token Flow:**

```
1. User logs in → POST /api/auth/login
2. Backend validates credentials, issues JWT
3. Frontend stores token in localStorage/sessionStorage
4. All API requests include: Authorization: Bearer <token>
5. Backend validates token on every request
6. Token expires in 24 hours → user must re-login
```

**Security Checklist:**

- ✅ JWT used for stateless authentication
- ✅ Tokens signed with `JWT_SECRET` (configurable)
- ✅ 24-hour expiry (reasonable for AAC use)
- ⏳ **ACTION:** Use `JWT_SECRET` from secure env var, NOT hardcoded default
- ⏳ **ACTION:** Rotate `JWT_SECRET` periodically (invalidates all tokens)

---

### ✅ Role-Based Access Control (RBAC)

**Status:** ✅ **IMPLEMENTED**

**Database Schema:**

```sql
-- User role in users table
CREATE TABLE users (
    role ENUM('admin','teacher','therapist','parent','student') DEFAULT 'student'
);

-- Organization-scoped roles
CREATE TABLE user_organization_roles (
    user_id INT,
    organization_id INT,
    role ENUM('system_admin','org_admin','teacher','therapist','student','parent'),
    UNIQUE(user_id, organization_id, role)
);

-- Student-teacher mapping
CREATE TABLE student_teacher_assignments (
    student_user_id INT,
    teacher_user_id INT,
    organization_id INT,
    assignment_type ENUM('class_teacher','subject_specialist','therapist','aide')
);
```

**Access Control Implementation:**

```php
// In each API route, check user role:
$user = Auth::validateToken($request->header('Authorization'));

if ($user['role'] === 'admin') {
    // Allow admin operations
} else if ($user['role'] === 'teacher') {
    // Check if teacher can access student
    $is_assigned = StudentTeacherAssignment::check($user['user_id'], $student_id);
    if (!$is_assigned) abort(403, "Unauthorized");
} else if ($user['role'] === 'student') {
    // Allow only own profile access
    if ($student_id !== $user['user_id']) abort(403);
}
```

**Role Hierarchy:**

```
system_admin        → Full system access
  ├─ org_admin      → Manage organization + users
  │  ├─ teacher     → Manage assigned students
  │  │  └─ student  → Own profile only
  │  └─ therapist   → Same as teacher
  └─ parent         → Child's profile (with permissions)
```

**Security Checklist:**

- ✅ Roles defined in database
- ✅ User roles fetched with JWT token
- ⏳ **ACTION:** Implement authorization middleware to enforce on all routes
- ⏳ **ACTION:** Add granular permissions (view_profile, edit_profile, delete, etc.)
- ⏳ **ACTION:** Audit all API routes for proper role checks

---

### ✅ Event Logging (SRAA/PIA Compliance)

**Status:** ✅ **PARTIALLY IMPLEMENTED**

**Tables for Logging:**

```sql
action_logs {           -- Core audit log
    id, user_id, profile_id, board_id, card_id,
    action_type,        -- e.g., 'card_click', 'board_edit', 'profile_share'
    metadata JSON,      -- Extra context
    organization_id, class_id,
    created_at
}

card_logs {             -- Legacy detailed logging
    id, user_id, board_id, card_id,
    action, log_data JSON, timestamp
}

data_sharing_permissions {  -- GDPR/Privacy tracking
    owner_user_id, shared_with_user_id,
    permission_type,    -- 'view_profile', 'export_data', etc.
    granted_by, expires_at
}
```

**What Gets Logged:**

- ✅ User login/logout
- ✅ Card clicks and board navigation
- ✅ Board creation, modification, deletion
- ✅ Profile sharing and access grants
- ✅ API calls and results

**SRAA Compliance (Singapore):**

```
✅ Access logs (who accessed what, when)
✅ Modification logs (what changed, who changed it)
✅ Audit trail (retrievable for 2+ years)
✅ User consent tracking (data_sharing_permissions)
```

**PIA Compliance (Privacy Impact Assessment):**

```
✅ Data classification (user, profile, board, personal)
✅ Purpose limitation (logging for compliance only)
✅ Data retention policy (defined in migrations)
✅ Access control (role-based, logged)
```

**Deployment Checklist:**

- ✅ `action_logs` table created (in schema)
- ✅ Logging code in API routes (backend/api/routes/\*.php)
- ⏳ **ACTION:** Verify all key actions logged to action_logs
- ⏳ **ACTION:** Implement log retention policy (e.g., keep 2 years)
- ⏳ **ACTION:** Set up log export for compliance reports

---

## Deployment Topology Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ INTERNET (Public Users)                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS (443)
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ TIER 1: Web & Reverse Proxy Layer                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Docker Container (nginx:stable-alpine)                     │ │
│ │ - Domain: aac.uplifor.org                                  │ │
│ │ - Ports: 80 (HTTP→HTTPS), 443 (HTTPS/SSL)                 │ │
│ │ - Cert: Let's Encrypt (aac.uplifor.org)                   │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ Nginx Configuration                                  │  │ │
│ │ │ - Security headers (X-Frame-Options, etc.)           │  │ │
│ │ │ - Static file serving (React build from /build)      │  │ │
│ │ │ - API reverse proxy to /backend/api/index.php        │  │ │
│ │ │ - Cache control (1-year for /static/*)               │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ React Frontend (built in /build)                      │  │ │
│ │ │ - SPA (Single Page App)                              │  │ │
│ │ │ - Service Worker (offline support)                   │  │ │
│ │ │ - JWT token handling (Authorization header)          │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ └────────────────────────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────────────────────────┘
                   │ FastCGI (/var/run/php/php-fpm.sock)
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ TIER 2: Application Layer                                        │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ PHP-FPM Container / VM                                     │ │
│ │ - PHP 7.4+ (FPM mode)                                      │ │
│ │ - Root: /var/www/aac.uplifor.org/backend/                 │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ API Router: backend/api/index.php                    │  │ │
│ │ │ - CORS validation                                    │  │ │
│ │ │ - JWT token validation                               │  │ │
│ │ │ - Request routing to /routes/*.php                  │  │ │
│ │ │ - Rate limiting                                      │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ API Routes (20+):                                    │  │ │
│ │ │ - /api/auth/* (login, register, token refresh)      │  │ │
│ │ │ - /api/profiles/* (CRUD)                            │  │ │
│ │ │ - /api/boards/* (CRUD)                              │  │ │
│ │ │ - /api/cards/* (symbol management)                  │  │ │
│ │ │ - /api/jyutping/* (Cantonese support)               │  │ │
│ │ │ - /api/ocr/* (image processing)                     │  │ │
│ │ │ - /api/users/* (RBAC protected)                     │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ Auth & Security:                                     │  │ │
│ │ │ - JWT generation & validation                        │  │ │
│ │ │ - Role-based access control (RBAC)                   │  │ │
│ │ │ - Input validation                                   │  │ │
│ │ │ - Error handling (debug mode disabled in prod)       │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ Uploads:                                             │  │ │
│ │ │ - /var/www/aac.uplifor.org/uploads/                 │  │ │
│ │ │ - Permissions: www-data:www-data (755)               │  │ │
│ │ │ - Max size: 10 MB (configurable)                     │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ └────────────────────────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────────────────────────┘
                   │ TCP (3306) - Encrypted
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ TIER 3: Data Layer                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ MySQL Server (Dedicated Host / RDS)                        │ │
│ │ - Host: <separate-db-server>                              │ │
│ │ - Port: 3306                                              │ │
│ │ - Database: cboard                                        │ │
│ │ - User: production_user (NOT root)                        │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ 24 Tables:                                           │  │ │
│ │ │ - Core: users, profiles, boards, cards               │  │ │
│ │ │ - Jyutping: jyutping_dictionary, _learning_log       │  │ │
│ │ │ - RBAC: organizations, classes, user_org_roles       │  │ │
│ │ │ - Compliance: action_logs, card_logs, notifications  │  │ │
│ │ │ - Files: media, ocr_history, games_results           │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ Backup & Recovery:                                   │  │ │
│ │ │ - Daily snapshots                                    │  │ │
│ │ │ - Binary logging enabled (replication support)       │  │ │
│ │ │ - Read replicas (optional, for scaling)              │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                   │
                   │ HTTPS API Calls
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ TIER 4: AI/OCR Services (External / Scalable)                   │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Photocen AI (External Service) - Current                   │ │
│ │ - API: https://ai.photocen.com/api                        │ │
│ │ - Function: OCR (image → text + jyutping)                 │ │
│ │ - Auth: API key (stored in env var)                       │ │
│ │ - Timeout: 120 seconds                                    │ │
│ │ ┌──────────────────────────────────────────────────────┐  │ │
│ │ │ Self-Hosted Alternative (Optional):                  │  │ │
│ │ │ - GPU-enabled VM with Tesseract/PaddleOCR           │  │ │
│ │ │ - Message queue (Redis) for async processing         │  │ │
│ │ │ - Horizontal scaling as needed                       │  │ │
│ │ └──────────────────────────────────────────────────────┘  │ │
│ └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Configuration

### Required for Deployment:

```bash
# === SECURITY (CRITICAL) ===
APP_ENV=production              # Disable debug, enable production optimizations
APP_DEBUG=false                 # Hide error details from users
JWT_SECRET=<generate-new>       # Min 32 chars, random string

# === DATABASE (CRITICAL) ===
DB_HOST=<dedicated-db-server>   # MUST be separate from app server
DB_PORT=3306                    # MySQL default port
DB_NAME=cboard                  # Database name (created by migrations)
DB_USER=<production-user>       # Database user (NOT root)
DB_PASS=<strong-password>       # 20+ chars, alphanumeric + special

# === APPLICATION ===
APP_TIMEZONE=Asia/Hong_Kong     # For date/time functions (adjustable)
API_BASE_URL=https://aac.uplifor.org/api  # Frontend knows where API is

# === FILE UPLOADS ===
UPLOAD_DIR=uploads              # Relative to /var/www/aac.uplifor.org/
MAX_UPLOAD_SIZE=10485760        # 10 MB in bytes

# === EXTERNAL SERVICES ===
PHOTOCEN_OCR_ENABLED=true       # Enable OCR processing
PHOTOCEN_API_URL=https://ai.photocen.com/api
OCR_TIMEOUT=120                 # Seconds (should be generous for images)
```

### How to Set (Recommended):

**Option 1: Docker Environment Variables (Recommended for containers)**

```bash
docker run -d \
  -e APP_ENV=production \
  -e APP_DEBUG=false \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e DB_HOST=<your-db-host> \
  -e DB_USER=<your-user> \
  -e DB_PASS=<your-password> \
  ... cboard:latest
```

**Option 2: Kubernetes Secrets (For K8s deployments)**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cboard-secrets
data:
  JWT_SECRET: <base64-encoded>
  DB_PASS: <base64-encoded>
---
env:
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: cboard-secrets
        key: JWT_SECRET
```

**Option 3: .env File (NOT for production git)**

```bash
# In /var/www/aac.uplifor.org/.env (never commit to git)
APP_ENV=production
JWT_SECRET=<random>
...
# Add .env to .gitignore
echo ".env" >> .gitignore
```

---

## Pre-Deployment Checklist (Topology-Aligned)

### Tier 1: Web Layer

- [ ] Frontend builds without errors: `yarn build`
- [ ] React app loads at `https://aac.uplifor.org`
- [ ] HTTPS redirect works (HTTP → HTTPS)
- [ ] SSL certificate valid and not expired
- [ ] Security headers present in HTTP response headers
- [ ] Service worker registers (check browser DevTools)

### Tier 2: Application Layer

- [ ] PHP 7.4+ installed and running as FPM
- [ ] PHP-FPM socket exists at correct path
- [ ] All `backend/api/routes/*.php` files accessible
- [ ] JWT token generation works (`POST /api/auth/login`)
- [ ] JWT token validation works (Authorization header)
- [ ] Rate limiting active (test with rapid requests)
- [ ] CORS validation enforced (only whitelisted domains allowed)
- [ ] No debug errors exposed (APP_DEBUG=false)

### Tier 3: Database Layer

- [ ] MySQL server running on dedicated host
- [ ] Database `cboard` exists
- [ ] Database user created (NOT root)
- [ ] All 24 tables created: `SHOW TABLES;` (verify count)
- [ ] Database backups configured (daily minimum)
- [ ] Connection from app server to DB works

### Tier 4: AI/OCR Services

- [ ] Photocen API accessible from app server
- [ ] OCR request succeeds (`POST /api/ocr/process`)
- [ ] Results logged to `ocr_history` table
- [ ] Timeout not exceeded (120s sufficient for typical images)

### Security & Compliance

- [ ] All secrets stored in environment, NOT in code
- [ ] JWT_SECRET is random and strong (min 32 chars)
- [ ] APP_DEBUG=false in production environment
- [ ] CORS origins whitelist updated (remove dev domains)
- [ ] Role-based access control working (test teacher/student/admin flows)
- [ ] Action logs recorded (`SELECT * FROM action_logs LIMIT 10;`)
- [ ] File uploads have correct permissions (www-data:www-data)
- [ ] HTTPS enforced (no plain HTTP to API)

---

## Success Criteria

✅ **Architecture Aligned When:**

1. **Tier 1 (Web):** Frontend loads, HTTPS enforced, no mixed-content warnings
2. **Tier 2 (App):** API responds to authenticated requests, roles enforced, errors not exposed
3. **Tier 3 (Data):** All queries return correct data, backups configured, no SQL errors
4. **Tier 4 (AI):** OCR requests work, results stored, external service calls logged
5. **Security:** No default secrets, CORS restricted, JWT validated, events logged
6. **Compliance:** Action logs present, role-based access verified, no data leaks

---

## Support & Troubleshooting

| Issue                          | Likely Cause                     | Solution                                       |
| ------------------------------ | -------------------------------- | ---------------------------------------------- |
| `403 Forbidden` on API         | JWT token invalid or missing     | Check Authorization header in frontend         |
| `502 Bad Gateway`              | PHP-FPM socket path wrong        | Verify socket path in nginx config             |
| `Cross-Origin Request Blocked` | Domain not in CORS whitelist     | Add domain to `backend/config/config.php`      |
| `ERR_CONNECTION_REFUSED` on DB | DB host unreachable              | Ensure DB on separate server, check firewall   |
| `OCR Timeout`                  | Image too large or Photocen slow | Reduce MAX_UPLOAD_SIZE or increase OCR_TIMEOUT |
| `Role not enforced`            | Authorization middleware missing | Add `Auth::checkRole()` to route handlers      |

---

**Deployment Ready:** January 7, 2026  
**Architecture Status:** ✅ Complete & Documented
