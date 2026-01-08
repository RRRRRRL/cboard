# DEPLOY.ps1 - Ready-to-Run Deployment Script

## What It Does

This is a complete, production-ready deployment script that handles everything in one command:

1. ✅ Pre-deployment checks (Node.js, npm, SSH tools)
2. ✅ Builds React frontend (`npm run build`)
3. ✅ Stages files with automatic exclusions (node_modules, tests, .env, etc.)
4. ✅ Uploads to server via SCP/PSCP
5. ✅ Configures server (permissions, .env, database, PHP-FPM, Nginx)
6. ✅ Verification and cleanup

## One-Command Deployment

Simply run:

```powershell
.\DEPLOY.ps1
```

That's it! The script will:

- Check all dependencies
- Build your frontend
- Upload to r77.igt.com.hk
- Configure everything on the server
- Test connectivity
- Show deployment status

## What Gets Deployed

### ✅ Uploaded

- `build/` — React compiled frontend
- `backend/api/` — PHP routes
- `backend/config/` — Configuration
- `backend/database/` — Database schemas
- `public/` — Images, symbols, videos
- `nginx-production.conf` — Nginx configuration

### ❌ Excluded (Not Uploaded)

- `node_modules/` — Dependencies (large, not needed)
- `.git/` — Version control (not needed)
- `.env` — Credentials (created on server)
- `tests/` — Test files (not in production)
- `*.log` — Development logs
- `*.dll`, `*.exe` — Windows binaries
- `.vscode/`, `.idea/` — IDE files

**Total size:** ~95 MB (vs. 500+ MB with exclusions)

## Prerequisites

Before running the script, ensure you have:

### 1. Node.js & npm

```powershell
# Check if installed
node --version
npm --version

# If not installed, download from:
# https://nodejs.org/ (Recommended: LTS version)
```

### 2. SSH/SCP Tools

```powershell
# For Windows 10+, install OpenSSH:
Add-WindowsCapability -Online -Name OpenSSH.Client

# Or use PuTTY:
# https://www.putty.org/
```

### 3. Project Root

Make sure you're in the Cboard project root directory:

```powershell
cd C:\Users\wongchaksan\Desktop\cboard
```

## Running the Script

```powershell
# Step 1: Navigate to project
cd C:\Users\wongchaksan\Desktop\cboard

# Step 2: Run deployment script
.\DEPLOY.ps1

# Step 3: Watch the output
# [✓] Node.js 18.x found
# [✓] npm 9.x found
# [✓] OpenSSH found
# [✓] Project structure OK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ▶ BUILDING FRONTEND
# ...
# [✓] Frontend build complete (21.5 MB)
# ...
# ║                  DEPLOYMENT SUCCESSFUL!                    ║
```

## Deployment Timeline

- **Pre-checks:** 10-20 seconds
- **npm install:** 1-2 minutes (first time only)
- **npm run build:** 1-2 minutes
- **Upload:** 1-2 minutes (95 MB, depends on internet)
- **Server config:** 30-60 seconds
- **Total:** 4-7 minutes

## What Happens Step-by-Step

### 1. Pre-Deployment Checks

```
✓ Node.js 18.19.0 found
✓ npm 10.2.3 found
✓ OpenSSH found
✓ Project structure OK
```

### 2. Frontend Build

```
Installing dependencies...
  npm install (1-2 min)
Building React frontend...
  npm run build (1-2 min)
✓ Frontend build complete (21.5 MB)
```

### 3. File Staging

```
Files to upload: 847 files (95.2 MB)
Files excluded: 4,203 files (605 MB)
  - node_modules/ (500 MB)
  - .git/ (50 MB)
  - tests/ (30 MB)
  - coverage/ (20 MB)
  - other dev files (5 MB)
```

### 4. Server Upload

```
Uploading to: r77.igt.com.hk:/var/www/aac.uplifor.org
  ▶ Frontend: 21.5 MB
  ▶ Backend: 5.2 MB
  ▶ Config: 2.1 MB
  ▶ Database: 0.5 MB
  ▶ Other: 65.9 MB
✓ Upload complete (95.2 MB in 1-2 min)
```

### 5. Server Configuration

```
[*] Setting file permissions...
   ✓ Permissions set
[*] Creating .env file...
   ✓ .env configured
[*] Testing MySQL connection...
   ✓ MySQL connection successful
   ✓ Database 'cboard' ready
[*] Reloading PHP-FPM...
   ✓ PHP-FPM reloaded
[*] Reloading Nginx...
   ✓ Nginx reloaded
```

### 6. Completion

```
╔════════════════════════════════════════════════════════════╗
║                  DEPLOYMENT SUCCESSFUL!                    ║
╚════════════════════════════════════════════════════════════╝

📊 DEPLOYMENT SUMMARY
─────────────────────────────────────────────────────────
Server          : https://aac.uplifor.org
Hostname        : r77.igt.com.hk
Path            : /var/www/aac.uplifor.org
Database        : cboard @ r77.igt.com.hk
Files Uploaded  : 847 files (~95.2 MB)

🔗 NEXT STEPS
─────────────────────────────────────────────────────────
1. Verify frontend: https://aac.uplifor.org/
2. Test API: https://aac.uplifor.org/api
3. Check logs:
   - Nginx: ssh root@r77.igt.com.hk /var/log/nginx/error.log
   - PHP-FPM: ssh root@r77.igt.com.hk /var/log/php-fpm/
```

## Verification After Deployment

### 1. Check Frontend

```
https://aac.uplifor.org/
```

Should show the Cboard application loaded and ready.

### 2. Check API

```
https://aac.uplifor.org/api
```

Should return a JSON response (or 404 if no default endpoint).

### 3. SSH to Server & Verify Files

```powershell
# SSH to server
ssh root@r77.igt.com.hk

# Check frontend is there
ls -la /var/www/aac.uplifor.org/build/ | head

# Verify no development files
ls -la /var/www/aac.uplifor.org/ | grep -E "node_modules|\.git|test"
# Should return nothing

# Check .env exists
ls -la /var/www/aac.uplifor.org/.env

# Check logs
tail -50 /var/log/nginx/error.log
tail -50 /var/log/php-fpm/error.log
```

## Troubleshooting

### "Node.js not found"

```powershell
# Install Node.js from https://nodejs.org/
# Then restart PowerShell and try again
node --version
```

### "SCP not found"

```powershell
# Install OpenSSH:
Add-WindowsCapability -Online -Name OpenSSH.Client

# Or install PuTTY:
# https://www.putty.org/
```

### "npm install failed"

```powershell
# Clear npm cache
npm cache clean --force

# Remove node_modules and try again
Remove-Item -Recurse -Force node_modules
npm install
```

### "npm run build failed"

```powershell
# Check for build errors
npm run build

# Check public/index.html exists
ls public/index.html

# Ensure React dependencies are correct
npm update
npm run build
```

### "Upload failed"

```powershell
# Test SSH connectivity first
ssh root@r77.igt.com.hk

# Check if path exists
ssh root@r77.igt.com.hk "ls -la /var/www/aac.uplifor.org/"

# Check permissions
ssh root@r77.igt.com.hk "chmod 755 /var/www/aac.uplifor.org"
```

### "MySQL connection failed"

```powershell
# SSH and test from server
ssh root@r77.igt.com.hk
mysql -h r77.igt.com.hk -u root -pyyTTr437 -e "SELECT 1;"

# If failed, check MySQL is running
ssh root@r77.igt.com.hk "systemctl status mysql"
```

## Advanced Options

### To modify server/credentials

Edit `DEPLOY.ps1` lines 85-98:

```powershell
$config = @{
    ServerHost = "r77.igt.com.hk"      # Change here
    ServerUser = "root"                 # Change here
    ServerPass = "yyTTr437"             # Change here
    ServerPath = "/var/www/aac.uplifor.org"  # Change here
    # ... rest of config
}
```

### To skip frontend build

In `DEPLOY.ps1`, comment out lines around "BUILDING FRONTEND":

```powershell
# Write-Step "BUILDING FRONTEND"
# npm run build
```

(Only if you already have a recent `build/` folder)

### To dry-run without uploading

Stop the script after the file staging step by pressing `Ctrl+C` before the upload section.

## Related Documentation

- [DEPLOYMENT_RUNBOOK_r77.igt.md](./docs/DEPLOYMENT_RUNBOOK_r77.igt.md) — Detailed deployment guide
- [DEPLOYMENT_FILE_EXCLUSION_GUIDE.md](./docs/DEPLOYMENT_FILE_EXCLUSION_GUIDE.md) — What files are excluded and why
- [.deployignore](./.deployignore) — Exclusion patterns
- [ARCHITECTURE_TOPOLOGY.md](./docs/ARCHITECTURE_TOPOLOGY.md) — 4-tier architecture
- [backend/env.example.txt](./backend/env.example.txt) — Environment variables

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review [DEPLOYMENT_RUNBOOK_r77.igt.md](./docs/DEPLOYMENT_RUNBOOK_r77.igt.md)
3. Check server logs: `/var/log/nginx/error.log`, `/var/log/php-fpm/error.log`
4. SSH to server and verify manually using commands in the "Verification" section

---

**Last Updated:** January 7, 2026  
**Target:** aac.uplifor.org (r77.igt.com.hk)  
**Status:** Ready for Production
