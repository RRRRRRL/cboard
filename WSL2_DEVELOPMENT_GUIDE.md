# WSL2 Development Guide - Compatibility Notes

## Changes Made and WSL2 Compatibility

### ✅ All Changes Are WSL2-Compatible

The changes I made are **fully compatible** with WSL2/Ubuntu development:

1. **Dockerfile Update (Node.js 20.18.1)**

   - ✅ Works perfectly in WSL2
   - ✅ Docker in WSL2 is the recommended setup
   - ✅ No conflicts with local development

2. **Import Path Fix (`../../../api`)**
   - ✅ This is a code fix that's needed everywhere
   - ✅ Works in WSL2, Docker, and any environment
   - ✅ Corrects a bug that would fail in all environments

---

## Development Options in WSL2

You have **two options** for development:

### Option 1: Docker Development (Recommended)

**What it means:**

- All code runs inside Docker containers
- No need to install Node.js, PHP, MySQL locally
- Consistent environment across all machines

**Setup:**

```bash
# Already done! Just use:
docker-compose up -d

# Your code is mounted, so changes reflect immediately
# Frontend: http://localhost
# Backend API: http://localhost/api
```

**Advantages:**

- ✅ No local Node.js/PHP/MySQL installation needed
- ✅ Same environment as production
- ✅ Easy to reset/clean
- ✅ Works on any machine with Docker

**File Changes:**

- Code changes in `src/` are immediately available (volume mounted)
- Backend changes in `backend/` are immediately available
- Just refresh browser to see changes

---

### Option 2: Local Development (Traditional)

**What it means:**

- Install Node.js, PHP, MySQL directly in WSL2
- Run `yarn start` for frontend
- Run PHP built-in server for backend

**Setup:**

```bash
# Install Node.js 20+ (required for cheerio dependency)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PHP and MySQL
sudo apt-get install php php-fpm php-mysql mysql-server

# Install dependencies
yarn install

# Start frontend (development mode)
yarn start

# Start backend (in another terminal)
cd backend
php -S localhost:8000 -t api api/index.php
```

**Advantages:**

- ✅ Faster hot-reload for frontend
- ✅ Better debugging experience
- ✅ No Docker overhead

**Disadvantages:**

- ❌ Need to install and maintain Node.js, PHP, MySQL
- ❌ Environment differences between dev and production
- ❌ More setup required

---

## Recommended Approach: Hybrid

**Best of both worlds:**

1. **Use Docker for:**

   - Database (MySQL)
   - Backend API (PHP-FPM)
   - Production-like testing

2. **Use Local for:**
   - Frontend development (`yarn start`)
   - Faster iteration
   - Better debugging

**Setup:**

```bash
# Start only database and backend in Docker
docker-compose up -d database backend

# Run frontend locally
yarn start

# Frontend connects to: http://localhost/api (Docker backend)
# Database: localhost:3306 (Docker)
```

**docker-compose.override.yml:**

```yaml
version: '3.8'
services:
  frontend:
    # Don't start frontend container when developing locally
    profiles: ['production']
```

---

## What You Need to Know

### Node.js Version Requirement

**Important:** The project now requires Node.js 20.18.1+ because of `cheerio@1.1.2` dependency.

**If developing locally (not Docker):**

```bash
# Check your Node.js version
node --version

# If < 20.18.1, upgrade:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or use nvm (recommended):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**If using Docker only:**

- ✅ No action needed - Dockerfile handles it

### Import Path Fix

The import path fix (`../../../api`) is **required** and works in:

- ✅ Docker builds
- ✅ Local development
- ✅ WSL2
- ✅ Any environment

This was a bug that would have failed everywhere, so fixing it helps all environments.

---

## File Structure Compatibility

All file paths work the same in WSL2:

- ✅ Windows paths: `C:\Users\...` → WSL2: `/mnt/c/Users/...`
- ✅ WSL2 native paths: `/home/username/...`
- ✅ Docker volumes: Same in both

**Recommendation:** Work directly in WSL2 filesystem (`~/projects/cboard`) for better performance:

```bash
# Instead of: /mnt/c/Users/wongchaksan/Desktop/cboard
# Use: ~/projects/cboard

# Copy project to WSL2 filesystem
cp -r /mnt/c/Users/wongchaksan/Desktop/cboard ~/projects/cboard
cd ~/projects/cboard
```

---

## Development Workflow

### Docker-Only Development

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Make code changes
# Changes are live (volumes are mounted)

# Rebuild if needed
docker-compose build frontend
docker-compose restart frontend
```

### Local Development

```bash
# Install dependencies
yarn install

# Start frontend dev server
yarn start
# Opens http://localhost:3000

# Backend (another terminal)
cd backend
php -S localhost:8000 -t api api/index.php
```

### Hybrid Development

```bash
# Start backend services in Docker
docker-compose up -d database backend

# Run frontend locally
yarn start

# Frontend connects to Docker backend at http://localhost/api
```

---

## Performance Tips for WSL2

1. **Work in WSL2 filesystem** (not Windows filesystem):

   ```bash
   # Fast: ~/projects/cboard
   # Slow: /mnt/c/Users/.../cboard
   ```

2. **Increase WSL2 memory** (if needed):

   ```ini
   # Create/edit %UserProfile%\.wslconfig in Windows
   [wsl2]
   memory=8GB
   processors=4
   ```

3. **Use Docker Desktop** (recommended):
   - Better performance than Docker in WSL2
   - Easier to manage
   - Better integration

---

## Summary

✅ **No conflicts** - All changes work perfectly in WSL2
✅ **Docker recommended** - Easiest setup, production-like
✅ **Local development** - Also supported, just need Node.js 20+
✅ **Hybrid approach** - Best of both worlds

**The changes I made are environment-agnostic and work everywhere!**

Choose the development approach that suits your workflow best.
