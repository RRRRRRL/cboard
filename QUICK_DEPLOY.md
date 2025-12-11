# Quick Deployment Guide

## Prerequisites
- Docker 20.10+ and Docker Compose 2.0+
- 4GB+ RAM, 10GB+ disk space
- Ports 80 and 443 available

## Quick Start (5 Steps)

### 1. Clone and Configure
```bash
git clone <your-repo-url>
cd cboard
cp .env.example .env
nano .env  # Edit with your values
```

**Required in .env:**
- `DB_PASS` - Database password
- `MYSQL_ROOT_PASSWORD` - MySQL root password  
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`

### 2. Build and Start
```bash
docker-compose build
docker-compose up -d
```

### 3. Verify
```bash
# Check services
docker-compose ps

# View logs
docker-compose logs -f

# Test API
curl http://localhost/api
```

### 4. Access
- Frontend: http://your-server-ip
- API: http://your-server-ip/api

### 5. Setup Backups (Optional)
```bash
docker-compose exec backend bash /var/www/html/scripts/setup-backup-cron.sh
```

## Production HTTPS Setup

1. Get SSL certificates (Let's Encrypt recommended)
2. Place in `rootfs/etc/nginx/ssl/`:
   - `cert.pem`
   - `key.pem`
3. Uncomment SSL lines in `rootfs/etc/nginx/conf.d/default.conf`

## Common Commands

```bash
# View logs
docker-compose logs -f [service_name]

# Restart service
docker-compose restart [service_name]

# Update application
git pull && docker-compose build && docker-compose up -d

# Stop all
docker-compose down

# Backup database
docker-compose exec backend bash /var/www/html/scripts/backup-database.sh
```

## Full Documentation
- Detailed guide: `DEPLOYMENT.md`
- Checklist: `DEPLOYMENT_CHECKLIST.md`

