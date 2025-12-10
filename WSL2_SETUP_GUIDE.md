# WSL2 Setup Guide - Complete Instructions

Since you're working in WSL2, follow these Linux-specific instructions.

---

## Prerequisites Check

### 1. Verify WSL2 is Running

```bash
# Check WSL version
wsl --version

# Check if Docker is accessible
docker --version
docker-compose --version
```

### 2. Install Docker in WSL2 (if not installed)

```bash
# Update package list
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io docker-compose

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker

# Verify Docker works
docker ps
```

**Note:** If you're using Docker Desktop for Windows, make sure WSL2 integration is enabled:
- Docker Desktop → Settings → Resources → WSL Integration
- Enable integration with your WSL2 distro

---

## Quick Setup (Recommended)

### Option 1: Use the Setup Script

```bash
# Make script executable
chmod +x setup.sh

# Run setup script
./setup.sh
```

The script will:
- ✅ Check Docker installation
- ✅ Create `.env` file with auto-generated JWT secret
- ✅ Create backups directory
- ✅ Start all containers

### Option 2: Manual Setup

Follow the steps below.

---

## Manual Setup Steps

### Step 1: Create Environment File

```bash
# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
# Database Configuration
DB_NAME=cboard
DB_USER=cboard_user
DB_PASS=ChangeThisPassword123!
MYSQL_ROOT_PASSWORD=ChangeThisRootPassword123!

# JWT Secret
JWT_SECRET=$JWT_SECRET

# Azure TTS (Optional)
AZURE_TTS_KEY=
AZURE_TTS_REGION=eastasia
EOF

# Verify .env was created
cat .env
```

**Important:** Edit `.env` and change the default passwords!

### Step 2: Create Backups Directory

```bash
mkdir -p backups
```

### Step 3: Start All Services

```bash
# Build and start containers
docker-compose up -d

# View logs to monitor startup
docker-compose logs -f
```

**Wait for database initialization** (30-60 seconds). You'll see:
```
database_1  | [Note] [Entrypoint]: Database initialized
database_1  | [Note] [Entrypoint]: ready for connections
```

Press `Ctrl+C` to exit logs view.

### Step 4: Verify Everything is Running

```bash
# Check container status
docker-compose ps

# Should show all 3 containers as "Up (healthy)"
```

### Step 5: Test the Application

```bash
# Test API health endpoint
curl http://localhost/api

# Expected response:
# {"message":"Cboard API is running","version":"1.0.0"}

# Test rate limiting headers
curl -I http://localhost/api/user/login

# Should see X-RateLimit headers
```

### Step 6: Access in Browser

Open your browser and navigate to:
- **Frontend**: http://localhost
- **API**: http://localhost/api

**Note:** If using WSL2, `localhost` should work. If not, use:
- `http://127.0.0.1` or
- `http://$(hostname -I | awk '{print $1}')`

---

## Enable Additional Features

### 1. Setup Automated Backups

```bash
# Setup daily backup cron job
docker-compose exec backend bash /var/www/html/scripts/setup-backup-cron.sh

# Or run backup manually
docker-compose exec backend bash /var/www/html/scripts/backup-database.sh

# Backups are stored in: ./backups/ (on your WSL2 filesystem)
ls -lh backups/
```

### 2. Enable HTTPS (Production)

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot (on your WSL2, not in container)
sudo apt-get update
sudo apt-get install certbot

# Stop containers temporarily
docker-compose down

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo mkdir -p rootfs/etc/nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem rootfs/etc/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem rootfs/etc/nginx/ssl/key.pem
sudo chmod 644 rootfs/etc/nginx/ssl/cert.pem
sudo chmod 600 rootfs/etc/nginx/ssl/key.pem

# Edit Nginx config to enable HTTPS
nano rootfs/etc/nginx/conf.d/default.conf
# Uncomment SSL configuration lines

# Restart containers
docker-compose up -d
```

#### Option B: Self-Signed Certificate (Development Only)

```bash
# Generate self-signed certificate
mkdir -p rootfs/etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout rootfs/etc/nginx/ssl/key.pem \
  -out rootfs/etc/nginx/ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Edit Nginx config
nano rootfs/etc/nginx/conf.d/default.conf
# Uncomment SSL configuration lines

# Restart frontend
docker-compose restart frontend
```

---

## Common WSL2 Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database

# Last 100 lines
docker-compose logs --tail=100
```

### Container Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart specific service
docker-compose restart backend

# Rebuild after code changes
docker-compose build && docker-compose up -d

# View running containers
docker-compose ps

# Execute command in container
docker-compose exec backend bash
docker-compose exec database mysql -u root -p
```

### Database Operations

```bash
# Access MySQL shell
docker-compose exec database mysql -u root -p$MYSQL_ROOT_PASSWORD cboard

# Backup database
docker-compose exec backend bash /var/www/html/scripts/backup-database.sh

# Restore database
docker-compose exec backend bash /var/www/html/scripts/restore-database.sh /var/backups/cboard/backup_file.sql.gz

# Check database size
docker-compose exec database mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT table_schema AS 'Database', ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' FROM information_schema.TABLES WHERE table_schema = 'cboard';"
```

### File Permissions (WSL2 Specific)

```bash
# If you encounter permission issues with backups
sudo chown -R $USER:$USER backups/

# Make scripts executable (if needed)
chmod +x backend/scripts/*.sh
```

---

## Troubleshooting for WSL2

### Port Already in Use

```bash
# Check what's using port 80
sudo netstat -tulpn | grep :80

# Or use ss
sudo ss -tulpn | grep :80

# Kill process if needed (replace PID)
sudo kill -9 <PID>

# Or change ports in docker-compose.yml
nano docker-compose.yml
# Change "80:80" to "8080:80"
```

### Docker Daemon Not Running

```bash
# Start Docker service
sudo service docker start

# Or if using Docker Desktop, ensure it's running in Windows
# Check WSL2 integration is enabled
```

### Permission Denied Errors

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or:
newgrp docker

# Verify
docker ps
```

### Cannot Access localhost from Windows Browser

If `localhost` doesn't work from Windows browser:

1. **Find WSL2 IP address:**
   ```bash
   hostname -I | awk '{print $1}'
   ```

2. **Use that IP in browser:**
   ```
   http://<WSL2_IP>
   ```

3. **Or use port forwarding:**
   ```bash
   # In Windows PowerShell (as Administrator)
   netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=80 connectaddress=<WSL2_IP>
   ```

### Database Connection Issues

```bash
# Check database is running
docker-compose ps database

# Check database logs
docker-compose logs database

# Test connection from backend
docker-compose exec backend php -r "require '/var/www/html/config/database.php';"

# Verify environment variables
docker-compose exec backend env | grep DB_
```

### Rate Limiting Too Strict

```bash
# Check current rate limit headers
curl -v http://localhost/api/user/login

# Edit rate limiter config
nano backend/api/middleware/rateLimiter.php

# Adjust limits in getConfigForEndpoint() method
# Restart backend
docker-compose restart backend
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean Docker system
docker system prune -a

# Remove unused volumes
docker volume prune

# Check container sizes
docker system df
```

---

## Performance Optimization for WSL2

### 1. Increase WSL2 Memory Limit

Create/edit `%UserProfile%\.wslconfig` in Windows:

```ini
[wsl2]
memory=4GB
processors=2
swap=2GB
```

Restart WSL2:
```powershell
# In Windows PowerShell
wsl --shutdown
```

### 2. Store Docker Data on WSL2 Filesystem

Docker volumes are already optimized, but ensure you're not storing data on Windows filesystem (`/mnt/c/`) as it's slower.

### 3. Use Docker BuildKit

```bash
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Or add to ~/.bashrc
echo 'export DOCKER_BUILDKIT=1' >> ~/.bashrc
echo 'export COMPOSE_DOCKER_CLI_BUILD=1' >> ~/.bashrc
```

---

## Production Checklist

Before deploying to production:

- [ ] Strong passwords in `.env`
- [ ] JWT secret changed (32+ characters)
- [ ] SSL certificates installed
- [ ] HTTPS enabled in Nginx config
- [ ] Automated backups configured
- [ ] Rate limiting limits reviewed
- [ ] Security headers verified
- [ ] Database backups tested
- [ ] Logs monitoring setup
- [ ] Firewall rules configured
- [ ] Domain name configured

---

## Quick Reference

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Backup database
docker-compose exec backend bash /var/www/html/scripts/backup-database.sh

# Restart service
docker-compose restart backend

# Rebuild after changes
docker-compose build && docker-compose up -d
```

---

## Getting Help

If you encounter issues:

1. **Check logs:**
   ```bash
   docker-compose logs
   ```

2. **Verify containers are running:**
   ```bash
   docker-compose ps
   ```

3. **Check Docker is working:**
   ```bash
   docker ps
   docker info
   ```

4. **Review documentation:**
   - `QUICK_START.md` - Quick setup
   - `ENABLE_FEATURES_GUIDE.md` - Detailed feature guide
   - `DEPLOYMENT.md` - Full deployment guide

---

**You're all set!** Your application should now be running in WSL2. 🎉

