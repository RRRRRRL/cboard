# How to Enable the Immediate Actions - Step-by-Step Guide

This guide walks you through enabling and using all the implemented features.

---

## Prerequisites

1. **Docker & Docker Compose** installed
   ```bash
   # Check if installed
   docker --version
   docker-compose --version
   ```

2. **Git** (if cloning repository)

---

## Step 1: Environment Configuration

### Create `.env` File

Create a `.env` file in the project root directory:

```bash
# Copy from example (if exists) or create new
cp backend/env.example.txt .env
```

### Edit `.env` with your configuration:

```env
# Database Configuration
DB_NAME=cboard
DB_USER=cboard_user
DB_PASS=your_secure_password_here_change_this
MYSQL_ROOT_PASSWORD=your_root_password_here_change_this

# JWT Secret (generate a random 32+ character string)
JWT_SECRET=your-random-secret-key-minimum-32-characters-long-change-this

# Azure TTS (Optional - leave empty if not using)
AZURE_TTS_KEY=your_azure_key_here
AZURE_TTS_REGION=eastasia
```

**Important:**
- Use strong, unique passwords
- Generate a secure JWT secret (you can use: `openssl rand -base64 32`)
- Never commit `.env` file to git

---

## Step 2: Start the Application

### Build and Start All Services

```bash
# Build images and start containers
docker-compose up -d

# View logs to ensure everything starts correctly
docker-compose logs -f
```

**Expected Output:**
- ✅ Frontend container running
- ✅ Backend container running
- ✅ Database container running

### Verify Services are Running

```bash
# Check container status
docker-compose ps

# Should show all 3 containers as "Up"
```

---

## Step 3: Initialize Database

The database schema should auto-import on first startup. To verify:

```bash
# Check if database was created
docker-compose exec database mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SHOW DATABASES;"

# Check if tables exist
docker-compose exec database mysql -u root -p$MYSQL_ROOT_PASSWORD cboard -e "SHOW TABLES;"
```

**If tables don't exist, manually import:**

```bash
# Import schema
docker-compose exec -T database mysql -u root -p$MYSQL_ROOT_PASSWORD cboard < backend/database/schema.sql

# Import Jyutping dictionary (if exists)
docker-compose exec -T database mysql -u root -p$MYSQL_ROOT_PASSWORD cboard < backend/database/seed-jyutping-dictionary.sql
```

---

## Step 4: Test the Application

### Test Frontend

```bash
# Open in browser
http://localhost
```

### Test API

```bash
# Health check
curl http://localhost/api

# Should return: {"message":"Cboard API is running","version":"1.0.0"}
```

### Test Rate Limiting

```bash
# Make multiple requests quickly
for i in {1..15}; do curl -s http://localhost/api/user/login -o /dev/null -w "%{http_code}\n"; done

# After 10 requests, you should see 429 (Too Many Requests)
```

---

## Step 5: Enable HTTPS (Production)

### Option A: Let's Encrypt (Recommended - Free)

1. **Install Certbot** (on your server, not in container):
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install certbot
   ```

2. **Obtain Certificate**:
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```

3. **Copy Certificates to Container**:
   ```bash
   # Create SSL directory
   mkdir -p rootfs/etc/nginx/ssl
   
   # Copy certificates
   sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem rootfs/etc/nginx/ssl/cert.pem
   sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem rootfs/etc/nginx/ssl/key.pem
   
   # Set permissions
   sudo chmod 644 rootfs/etc/nginx/ssl/cert.pem
   sudo chmod 600 rootfs/etc/nginx/ssl/key.pem
   ```

4. **Enable HTTPS in Nginx Config**:
   
   Edit `rootfs/etc/nginx/conf.d/default.conf`:
   
   ```nginx
   # Uncomment these lines:
   ssl_certificate /etc/nginx/ssl/cert.pem;
   ssl_certificate_key /etc/nginx/ssl/key.pem;
   ssl_protocols TLSv1.2 TLSv1.3;
   ssl_ciphers HIGH:!aNULL:!MD5;
   ssl_prefer_server_ciphers on;
   ```

5. **Restart Frontend Container**:
   ```bash
   docker-compose restart frontend
   ```

### Option B: Self-Signed Certificate (Development Only)

```bash
# Generate self-signed certificate
mkdir -p rootfs/etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout rootfs/etc/nginx/ssl/key.pem \
  -out rootfs/etc/nginx/ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Uncomment SSL config in default.conf (same as Option A)
# Restart container
docker-compose restart frontend
```

**Note:** Self-signed certificates will show browser warnings. Only use for development.

---

## Step 6: Setup Automated Backups

### Enable Daily Backups

```bash
# Setup cron job inside backend container
docker-compose exec backend bash /var/www/html/scripts/setup-backup-cron.sh
```

### Manual Backup

```bash
# Run backup manually
docker-compose exec backend bash /var/www/html/scripts/backup-database.sh

# Backups are stored in: /var/backups/cboard/ (inside container)
```

### Access Backups from Host

To access backups from your host machine:

1. **Mount backup directory** in `docker-compose.yml`:
   ```yaml
   backend:
     volumes:
       - ./backend:/var/www/html
       - ./backend/uploads:/var/www/html/uploads
       - ./backups:/var/backups/cboard  # Add this line
   ```

2. **Restart container**:
   ```bash
   docker-compose restart backend
   ```

3. **Backups will now be in** `./backups/` directory on your host

### Restore from Backup

```bash
# Copy backup to container (if not mounted)
docker cp ./backups/cboard_backup_20240101_120000.sql.gz cboard-backend:/tmp/

# Restore
docker-compose exec backend bash /var/www/html/scripts/restore-database.sh /tmp/cboard_backup_20240101_120000.sql.gz
```

---

## Step 7: Configure Rate Limiting (Optional)

Rate limiting is **already enabled** by default. To customize limits:

Edit `backend/api/middleware/rateLimiter.php`:

```php
public static function getConfigForEndpoint($endpoint) {
    // Customize limits here
    if (strpos($endpoint, '/auth') !== false) {
        return [20, 60]; // Change from 10 to 20 requests/minute
    }
    // ... etc
}
```

**Restart backend** after changes:
```bash
docker-compose restart backend
```

---

## Step 8: Verify Security Headers

### Test Security Headers

```bash
# Check headers
curl -I http://localhost/

# Should see:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
```

---

## Step 9: Monitor and Maintain

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

### Check Health Status

```bash
# Container health
docker-compose ps

# Test API health
curl http://localhost/api
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild containers
docker-compose build

# Restart services
docker-compose up -d
```

---

## Troubleshooting

### Containers Won't Start

```bash
# Check logs
docker-compose logs

# Check if ports are in use
netstat -an | grep :80
netstat -an | grep :3306

# Stop conflicting services or change ports in docker-compose.yml
```

### Database Connection Errors

```bash
# Check database is running
docker-compose ps database

# Test connection
docker-compose exec backend php -r "require '/var/www/html/config/database.php';"

# Check database logs
docker-compose logs database
```

### API Not Responding

```bash
# Check backend logs
docker-compose logs backend

# Test API directly
curl http://localhost/api

# Check if rate limiting is blocking
curl -v http://localhost/api/user/login
```

### Rate Limiting Too Strict

```bash
# Check rate limit headers
curl -v http://localhost/api/user/login

# Adjust limits in backend/api/middleware/rateLimiter.php
# Restart backend
docker-compose restart backend
```

### Backup Issues

```bash
# Check backup script permissions (inside container)
docker-compose exec backend ls -la /var/www/html/scripts/

# Run backup manually to see errors
docker-compose exec backend bash /var/www/html/scripts/backup-database.sh

# Check disk space
docker-compose exec backend df -h
```

---

## Quick Reference Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs -f

# Execute command in container
docker-compose exec backend bash

# Backup database
docker-compose exec backend bash /var/www/html/scripts/backup-database.sh

# Restore database
docker-compose exec backend bash /var/www/html/scripts/restore-database.sh <backup_file>

# Check status
docker-compose ps

# Rebuild after code changes
docker-compose build && docker-compose up -d
```

---

## Production Checklist

Before going to production:

- [ ] Strong passwords set in `.env`
- [ ] JWT secret changed (32+ characters)
- [ ] SSL certificates installed and HTTPS enabled
- [ ] Automated backups configured
- [ ] Rate limiting limits reviewed
- [ ] Security headers verified
- [ ] Database backups tested
- [ ] Logs monitoring setup
- [ ] Firewall rules configured
- [ ] Domain name configured
- [ ] DNS records set up

---

## Next Steps

After enabling all features:

1. **Test thoroughly** in development environment
2. **Review security** settings
3. **Setup monitoring** and alerts
4. **Document** your specific configuration
5. **Plan** for scaling if needed

---

## Support

If you encounter issues:

1. Check logs: `docker-compose logs`
2. Review documentation: `DEPLOYMENT.md`
3. Check architecture: `ARCHITECTURE_COMPLIANCE_REPORT.md`
4. Verify configuration files

---

**All features are now ready to use!** 🎉

