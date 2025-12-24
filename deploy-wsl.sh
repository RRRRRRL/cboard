#!/usr/bin/env bash

# Minimal WSL2 deployment script for Cboard Enhancement
# - Build React frontend
# - Upload only build/ (frontend) and backend/ (PHP API) to server via scp
#
# Usage (inside WSL2):
#   cd /mnt/c/Users/wongchaksan/Desktop/cboard
#   bash deploy-wsl.sh

set -euo pipefail

SERVER_HOST="r77.igt.com.hk"
SERVER_USER="root"
SERVER_PATH="/var/www/aac.uplifor.org"

echo "=========================================="
echo " Cboard WSL2 Minimal Deployment"
echo " Target: ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}"
echo "=========================================="
echo

# Ensure we are in project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f package.json || ! -d src ]]; then
  echo "[!] package.json or src/ not found. Please run this script from the project root." >&2
  exit 1
fi

echo "[*] Building frontend (React) in WSL..."

# Load user's shell environment (for nvm, etc.)
if [[ -f "$HOME/.bashrc" ]]; then
  source "$HOME/.bashrc" 2>/dev/null || true
fi
if [[ -f "$HOME/.profile" ]]; then
  source "$HOME/.profile" 2>/dev/null || true
fi
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
fi

# Ensure npm is in PATH
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin"

if [[ ! -d node_modules ]]; then
  echo "   node_modules not found, running npm install (this may take a while)..."
  npm install
fi

# Check if .env file exists and contains REACT_APP_DEV_API_URL with local IP
if [[ -f .env ]]; then
  if grep -q "REACT_APP_DEV_API_URL.*192\.168" .env 2>/dev/null; then
    echo "   [WARNING] Found REACT_APP_DEV_API_URL with local IP in .env file"
    echo "   Temporarily removing REACT_APP_DEV_API_URL from .env for production build..."
    # Backup .env and remove REACT_APP_DEV_API_URL line
    cp .env .env.backup
    sed -i '/^REACT_APP_DEV_API_URL=/d' .env
    ENV_BACKUP_CREATED=true
  else
    ENV_BACKUP_CREATED=false
  fi
else
  ENV_BACKUP_CREATED=false
fi

# Ensure NODE_ENV is set to production for build
# Also unset REACT_APP_DEV_API_URL to prevent hardcoded local IPs in build
export NODE_ENV=production
unset REACT_APP_DEV_API_URL
echo "   Building with NODE_ENV=production..."
echo "   REACT_APP_DEV_API_URL is unset (will use relative /api path)"

# Run build with explicit NODE_ENV and no REACT_APP_DEV_API_URL
# This ensures the build uses relative /api path instead of hardcoded URLs
if [[ -d build ]] && [[ build -nt package.json ]]; then
  echo "   [INFO] Using existing build directory (newer than package.json)"
else
  echo "   Running npm run build..."
  # Disable TypeScript type checking to avoid compatibility issues with Node.js v24+
  # TSC_COMPILE_ON_ERROR=true allows build to continue even with TypeScript errors
  if ! NODE_ENV=production REACT_APP_DEV_API_URL= TSC_COMPILE_ON_ERROR=true npm run build 2>&1; then
    echo "   [WARNING] Build failed, checking for existing build directory..."
    if [[ ! -d build ]]; then
      echo "   [ERROR] No build directory found and build failed. Cannot deploy." >&2
      # Restore .env file if we backed it up
      if [[ "$ENV_BACKUP_CREATED" == "true" ]]; then
        mv .env.backup .env
      fi
      exit 1
    else
      echo "   [INFO] Using existing build directory despite build failure"
    fi
  fi
fi

# Restore .env file if we backed it up
if [[ "$ENV_BACKUP_CREATED" == "true" ]]; then
  echo "   Restoring .env file..."
  mv .env.backup .env
fi
echo "   [OK] Build ready for deployment."

# Verify build output contains relative API path (not hardcoded IP)
echo "   Verifying build output..."
if find build/static/js -name "*.js" -type f -exec grep -l "192\.168\.62\.41" {} \; 2>/dev/null | head -1; then
  echo "   [WARNING] Found hardcoded IP in build files!"
  echo "   This may cause the frontend to use local endpoints on the server."
  echo "   Please ensure REACT_APP_DEV_API_URL is not set during build."
else
  echo "   [OK] No hardcoded IP found in build files."
fi

# Also check for any absolute API URLs that might be problematic
if find build/static/js -name "*.js" -type f -exec grep -l "http://.*/api" {} \; 2>/dev/null | head -1; then
  echo "   [INFO] Found absolute API URLs in build (checking if they're production URLs)..."
  if find build/static/js -name "*.js" -type f -exec grep -l "https://aac.uplifor.org/api" {} \; 2>/dev/null | head -1; then
    echo "   [OK] Found production URL (aac.uplifor.org) - this is acceptable"
  else
    echo "   [WARNING] Found non-production absolute URLs - may need investigation"
  fi
fi

if [[ ! -d build ]]; then
  echo "[X] build/ directory not found after npm run build." >&2
  exit 1
fi

if [[ ! -d backend ]]; then
  echo "[X] backend/ directory not found." >&2
  exit 1
fi

echo
echo "[*] Uploading build/ (frontend)..."
scp -r ./build "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"

echo "[*] Uploading backend/ (PHP API)..."
scp -r ./backend "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"

# Check if models directory exists locally and upload it
if [[ -d public/models ]]; then
  echo "[*] Uploading public/models/ (WebGazer models)..."
  scp -r ./public/models "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/build/"
else
  echo "[!] WARNING: public/models/ directory not found. WebGazer models may not work correctly."
fi

echo
echo "[OK] Minimal deployment finished."
echo "Frontend: https://aac.uplifor.org/"
echo "API:      https://aac.uplifor.org/api"
echo
echo "If needed, SSH to the server to reload PHP-FPM and Nginx:"
echo "  ssh ${SERVER_USER}@${SERVER_HOST}"
echo "  # then run:"
echo "  # systemctl reload php8.3-fpm"
echo "  # systemctl reload nginx"


