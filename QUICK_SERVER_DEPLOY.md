# Quick Server Deployment - aac.uplifor.org

## Server Details
- **Domain**: https://aac.uplifor.org/
- **SSH**: `ssh root@r77.igt.com.hk` (password: yyTTr437)
- **Web Path**: `/var/www/aac.uplifor.org`
- **MySQL**: `r79.igt.com.hk` (root/yyTTr437)
- **phpMyAdmin**: https://r79.igt.com.hk/phpmyadmin/

## Quick Deploy (Windows)

### Option 1: Automated Script
```powershell
.\deploy-to-server.ps1
```

### Option 2: Manual Steps

#### 1. Prepare .env file
```powershell
Copy-Item .env.example .env
# Edit .env and set:
# DB_HOST=r79.igt.com.hk
# DB_PASS=yyTTr437
# JWT_SECRET=<generate with: openssl rand -base64 32>
# REACT_APP_API_URL=https://aac.uplifor.org/api
```

#### 2. Upload files
```powershell
# Using SCP (Windows 10+)
scp -r * root@r77.igt.com.hk:/var/www/aac.uplifor.org/

# Or using PSCP (PuTTY)
pscp -pw yyTTr437 -r * root@r77.igt.com.hk:/var/www/aac.uplifor.org/
```

#### 3. SSH and deploy
```bash
ssh root@r77.igt.com.hk
cd /var/www/aac.uplifor.org

# Update .env
nano .env  # Set DB_HOST=r79.igt.com.hk, DB_PASS=yyTTr437

# Build and start
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose ps
docker-compose logs -f
```

## Initialize Database

### Via phpMyAdmin
1. Go to https://r79.igt.com.hk/phpmyadmin/
2. Login: root / yyTTr437
3. Create database: `cboard`
4. Import: `backend/database/schema.sql`

### Via Command Line
```bash
ssh root@r77.igt.com.hk
mysql -h r79.igt.com.hk -u root -pyyTTr437 -e "CREATE DATABASE IF NOT EXISTS cboard;"
mysql -h r79.igt.com.hk -u root -pyyTTr437 cboard < backend/database/schema.sql
```

## Verify Deployment

- ✅ Frontend: https://aac.uplifor.org/
- ✅ API: https://aac.uplifor.org/api
- ✅ Test login/registration
- ✅ Test file upload

## Common Commands

```bash
# View logs
ssh root@r77.igt.com.hk 'cd /var/www/aac.uplifor.org && docker-compose logs -f'

# Restart services
ssh root@r77.igt.com.hk 'cd /var/www/aac.uplifor.org && docker-compose restart'

# Update application
git pull  # or upload new files
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

## Troubleshooting

### Cannot connect to MySQL
```bash
# Test connection
mysql -h r79.igt.com.hk -u root -pyyTTr437 -e "SELECT 1;"
```

### Services won't start
```bash
# Check Docker
systemctl status docker

# Check logs
docker-compose logs backend
docker-compose logs frontend
```

### Permission issues
```bash
chown -R www-data:www-data /var/www/aac.uplifor.org
chmod -R 755 /var/www/aac.uplifor.org
```

## Full Documentation
- Detailed guide: `SERVER_DEPLOYMENT.md`
- General deployment: `DEPLOYMENT.md`

