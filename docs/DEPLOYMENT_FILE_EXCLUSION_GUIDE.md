# Deployment File Exclusion Guide

This document explains which files and directories are excluded from deployment to the production server (`r77.igt.com.hk:/var/www/aac.uplifor.org`) and why.

## Quick Summary

Files that **DO NOT** need to be uploaded to the server (handled by `.deployignore` and `deploy-to-server.ps1`):

| Category               | Examples                                        | Reason                                              |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------- |
| **Dependencies**       | `node_modules/`, `backend/vendor/`              | Regenerated via `npm install` or `composer install` |
| **Build Artifacts**    | `dist/`, `*.map`                                | Temporary files from development build process      |
| **Git**                | `.git/`, `.gitignore`, `.gitattributes`         | Version control - not needed on server              |
| **Credentials**        | `.env`, `.env.local`, `.env.development`        | **CRITICAL** - contains DB passwords & API keys     |
| **Development Config** | `nginx-dev.conf`, `setup-*.sh`, `test-*.sh`     | Only for local development                          |
| **Tests**              | `tests/`, `*.test.js`, `*.spec.ts`, `coverage/` | Not needed in production                            |
| **IDE Files**          | `.vscode/`, `.idea/`, `*.sublime-project`       | IDE-specific, waste space                           |
| **Windows Binaries**   | `*.dll`, `*.exe`, `*.pdb`                       | Wrong architecture for Linux server                 |
| **Visual Studio**      | `*.vcxproj`, `*.sln`, `bin/`, `obj/`, `Debug/`  | Windows development only                            |
| **Temporary**          | `*.log`, `*.tmp`, `*.bak`, `*.cache`            | Development artifacts                               |
| **OS Files**           | `Thumbs.db`, `.DS_Store`                        | Windows/macOS metadata                              |

## Files That **ARE** Deployed

| Category          | What Gets Uploaded                                     | Notes                                                            |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| **Frontend**      | `build/` folder                                        | React compiled output - **must be included**                     |
| **Backend**       | `backend/api/`, `backend/config/`, `backend/database/` | All PHP code and configuration                                   |
| **Database**      | `backend/database/schema.sql`                          | Deployed for initial setup via deployment script                 |
| **Nginx Config**  | `nginx-production.conf`                                | Specific to production environment                               |
| **Documentation** | `*.md` files in root                                   | Optional but recommended (can be commented out in .deployignore) |
| **Public Assets** | `public/images/`, `public/symbols/`, `public/videos/`  | Shared media resources                                           |

## Exclusion Rules by Category

### 1. **Credentials & Secrets** (🔴 CRITICAL)

```
.env
.env.local
.env.development
.env.test
```

**Why exclude:** These contain:

- Database password: `DB_PASS`
- MySQL root credentials
- JWT_SECRET (must be random on server)
- API keys and tokens

**Server action:** Deployment script creates `.env` on server via `backend/env.example.txt` and updates with actual credentials.

---

### 2. **Node.js Dependencies**

```
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

**Why exclude:**

- Size: 500+ MB
- Easily regenerated: Run `npm install` on server
- Platform-specific: Modules compiled for Windows won't work on Linux

**Server action:** Server runs `npm install` after file upload.

---

### 3. **PHP Dependencies**

```
backend/vendor/
```

**Why exclude:**

- Size: 100+ MB
- Easily regenerated: Run `composer install` on server
- Platform-specific concerns

**Server action:** Server runs `composer install` (if needed).

---

### 4. **Build Artifacts**

```
build/                    # ❌ DO NOT EXCLUDE - React compiled output MUST be deployed
dist/
*.map                     # Source maps (optional to exclude)
```

**Special Case - `build/` folder:**

- ✅ **MUST BE INCLUDED** - Contains compiled React frontend
- Excludes in `.deployignore` are commented out appropriately
- Deployment uses pre-built `build/` folder to avoid server build complexity

---

### 5. **Version Control**

```
.git/
.gitignore
.gitattributes
```

**Why exclude:**

- Not needed on server
- Adds unnecessary size
- Security risk to expose entire history

---

### 6. **Development Scripts**

```
# WSL/Development specific
nginx-dev.conf
setup-*.sh
fix-*.sh
update-*.sh
start-*.sh
test-*.sh

# PowerShell scripts for local development
setup.ps1
setup-wsl2-*.ps1
cleanup-*.ps1

# Conversion scripts (one-time use)
convert-*.js
check-*.js
find-*.js
download-*.js
comprehensive-*.js
```

**Why exclude:**

- Only useful during local development
- Not needed on production server
- May contain hardcoded local paths

---

### 7. **Tests**

```
tests/
__tests__/
*.test.js
*.test.ts
*.spec.js
*.spec.ts
coverage/
.nyc_output/
```

**Why exclude:**

- Not needed in production
- Wastes space: 50-100 MB
- No value once code is deployed

**Server verification:** Deployment script tests PHP-FPM, Nginx, and database connectivity instead.

---

### 8. **IDE & Editor Files**

```
# IDE files
.vscode/
.idea/
.vs/
*.swp
*.swo
*~

# VS Code specific
Welcome.*
welcome.ico
VisualStudio.png

# Sublime Text
*.sublime-project
*.sublime-workspace
```

**Why exclude:**

- IDE-specific settings don't apply to server
- Wastes space
- Could expose development paths

---

### 9. **Windows-Specific Files**

```
# Visual Studio files
*.vcxproj
*.vcxproj.filters
*.sln
*.suo
*.user
*.userosscache
*.sdf
*.opensdf
*.db
*.opendb
*.VC.db
*.VC.VC.opendb

# Windows binaries
*.dll
*.exe
*.pdb
*.ilk
*.exp
*.lib
*.obj
*.manifest

# Visual Studio build directories
bin/
obj/
Debug/
Release/
x64/
x86/
ARM/

# Debugger files
msvsmon.*
vsdebugeng.*
DiagnosticsHub.*
Microsoft.VisualStudio.*
System.*.dll
api-ms-win-*
vcruntime*.dll
msvcp*.dll
```

**Why exclude:**

- Wrong architecture for Linux server
- Waste of bandwidth
- Not needed on Linux

---

### 10. **Logs & Temporary Files**

```
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Temporary files
tmp/
temp/
*.tmp
*.bak
*.cache
```

**Why exclude:**

- Development artifacts from local builds
- Not needed on clean server deployment
- Server will generate its own logs

**Note:** Server logs (`/var/log/nginx/`, `/var/log/php-fpm/`) are stored separately and persist.

---

### 11. **OS Metadata**

```
.DS_Store           # macOS
Thumbs.db          # Windows
Desktop.ini        # Windows
```

**Why exclude:**

- OS-specific metadata
- No functional value
- Wastes space

---

### 12. **Deployment Scripts** (Optional)

```
# deploy-to-server.ps1
# deploy-to-server.sh
# check-deployment-status.ps1
```

**Why exclude (optional):**

- Not needed on server
- Security: Don't expose deployment credentials
- Can be commented out in `.deployignore` if needed

---

## What Gets Deployed - Checklist

Before uploading, verify these are included:

```
✅ build/                              (React compiled frontend)
✅ backend/api/                        (PHP API routes)
✅ backend/config/                     (Database & app config templates)
✅ backend/database/                   (Schema & migration scripts)
✅ nginx-production.conf               (Production Nginx config)
✅ public/images/                      (Shared images)
✅ public/symbols/                     (AAC symbols)
✅ public/videos/                      (Videos)
✅ .env.example / backend/env.example.txt  (Template for .env)
✅ DEPLOYMENT_RUNBOOK_r77.igt.md       (Deployment docs)
✅ README.md                           (Project info)
```

## Exclusion Configuration

### `.deployignore` File

The repository includes a `.deployignore` file that follows `.gitignore` syntax:

**Location:** [.deployignore](./.deployignore)

**Usage:** Processed by `deploy-to-server.ps1` to filter files before upload.

**Key sections:**

1. IDE and editor files (vscode, IntelliJ, Sublime)
2. Visual Studio project files (Windows-only development)
3. Development files (.env, logs, temporary)
4. Build outputs (dist/, node_modules/ - but NOT build/)
5. Dependencies (node_modules/, vendor/)
6. Git (version control)
7. Tests (not needed in production)
8. Temporary/cache files
9. OS metadata (macOS, Windows)
10. Development scripts (setup, fix, convert scripts)
11. OpenCC dictionaries (optional)

### PowerShell Script Logic

`deploy-to-server.ps1` applies exclusions in this order:

1. **Parse `.deployignore`** - Reads patterns from file
2. **Check hardcoded exclusions** - Arrays in script:
   - `excludeDirs` (node_modules, .git, dist, tests, coverage, etc.)
   - `excludeFiles` (_.log, _.test.js, \*.dll, .DS_Store, etc.)
3. **Check file extensions** - Excludes binary files (.dll, .exe, .pdb)
4. **Check directory paths** - Skips Visual Studio paths (bin/, obj/, Debug/)
5. **Never exclude** - `build/` folder (React frontend)

**Result:** Uploads only 50-100 MB of necessary files instead of 500-700 MB

---

## Deployment Command

```powershell
# Run from Windows/WSL
.\deploy-to-server.ps1 -verbose
```

**What it does:**

1. Reads configuration (server, credentials)
2. Builds React frontend: `npm run build`
3. Creates temporary directory with filtered files
4. Counts files: "Uploading 847 files, skipping 4,203 files"
5. Transfers via PSCP or SCP
6. Runs remote deployment script:
   - Sets file permissions
   - Creates/updates `.env`
   - Tests MySQL connection
   - Reloads PHP-FPM & Nginx
7. Cleans up temporary directory

**Output example:**

```
[OK] Filtered files for deployment
   Total files checked: 5,050
   Files to upload: 847 (95 MB)
   Files excluded: 4,203 (605 MB)

[*] Uploading files to r77.igt.com.hk...
   [OK] File upload complete (95 MB)
```

---

## Security Considerations

### 🔴 Critical: Never Upload Credentials

```bash
# These MUST be excluded:
.env
.env.local
.env.development
.env.production
```

Deployment script ensures:

1. `.env` is excluded from upload
2. `.env.example` is included
3. Server creates `.env` from template
4. Credentials injected securely via deployment script

### ✅ Verify After Upload

```bash
# SSH to server
ssh root@r77.igt.com.hk

# Check frontend is deployed
ls -la /var/www/aac.uplifor.org/build/

# Verify no development files
ls -la /var/www/aac.uplifor.org/ | grep -E "node_modules|\.git|test|\.env"
# Should return nothing

# Check .env exists and is readable only by web server
ls -la /var/www/aac.uplifor.org/.env
# Should show: -rw------- (600)
```

---

## FAQ

**Q: Why exclude `build/` from .deployignore is commented out?**
A: Because `build/` is the compiled React frontend and MUST be deployed. The script intentionally keeps it.

**Q: Can I include documentation files (.md)?**
A: Yes, they're useful for server deployment history. Uncomment in `.deployignore` if desired:

```
# *.md
# docs/
```

**Q: What if I accidentally included node_modules?**
A: No problem - the script filters it out automatically.

**Q: Does the server regenerate node_modules?**
A: No, because `build/` (compiled frontend) is already included. Server only needs PHP dependencies if using `composer`.

**Q: How large is the upload without exclusions?**
A: ~600 MB (node_modules + build + test files)
With exclusions: ~95 MB (essential code only)

**Q: Can I deploy without the build/ folder?**
A: Not recommended. Either:

- Option A: Include `build/` (current approach)
- Option B: Server runs `npm run build` after upload (slower, requires Node.js on server)

---

## Summary Table

| Component         | Upload? | Why                                 | Size   |
| ----------------- | ------- | ----------------------------------- | ------ |
| Frontend (build/) | ✅ YES  | Compiled React app                  | 20 MB  |
| Backend API       | ✅ YES  | PHP routes & config                 | 5 MB   |
| Database schema   | ✅ YES  | SQL migrations                      | 500 KB |
| node_modules      | ❌ NO   | Dependencies (regenerate on demand) | 500 MB |
| .git              | ❌ NO   | Version control (not needed)        | 50 MB  |
| tests/            | ❌ NO   | Testing code (not in production)    | 30 MB  |
| .env              | ❌ NO   | Credentials (generated on server)   | 1 KB   |
| .vscode/          | ❌ NO   | IDE settings (not needed)           | 5 MB   |
| Windows binaries  | ❌ NO   | Wrong architecture                  | -      |

---

## Related Documentation

- [DEPLOYMENT_RUNBOOK_r77.igt.md](./DEPLOYMENT_RUNBOOK_r77.igt.md) - Step-by-step deployment guide
- [.deployignore](./.deployignore) - Actual exclusion patterns
- [deploy-to-server.ps1](../deploy-to-server.ps1) - PowerShell deployment script
- [backend/env.example.txt](../backend/env.example.txt) - Environment template
