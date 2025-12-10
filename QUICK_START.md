# Quick Start Guide - Get Running in 5 Minutes

## Step 1: Create Environment File

Create `.env` file in project root:

```bash
# Linux/WSL2/Mac
JWT_SECRET=$(openssl rand -base64 32)
cat > .env << EOF
DB_NAME=cboard
DB_USER=cboard_user
DB_PASS=ChangeThisPassword123!
MYSQL_ROOT_PASSWORD=ChangeThisRootPassword123!
JWT_SECRET=$JWT_SECRET
AZURE_TTS_KEY=
AZURE_TTS_REGION=eastasia
EOF
```

**Or use the setup script:**
```bash
chmod +x setup.sh
./setup.sh
```

**Or manually create `.env` file with:**
```
DB_NAME=cboard
DB_USER=cboard_user
DB_PASS=your_secure_password
MYSQL_ROOT_PASSWORD=your_root_password
JWT_SECRET=your-random-32-character-secret-key
AZURE_TTS_KEY=
AZURE_TTS_REGION=eastasia
```

## Step 2: Start Everything

```bash
docker-compose up -d
```

## Step 3: Wait for Database to Initialize

```bash
# Check logs
docker-compose logs -f database

# Wait until you see: "ready for connections"
# Press Ctrl+C to exit logs
```

## Step 4: Verify It's Working

```bash
# Test API
curl http://localhost/api

# Should return: {"message":"Cboard API is running","version":"1.0.0"}

# Open in browser
# http://localhost
```

## ✅ Done!

Your application is now running with:
- ✅ Frontend at http://localhost
- ✅ API at http://localhost/api
- ✅ Rate limiting enabled
- ✅ Security headers enabled
- ✅ Backups ready (run manually or setup cron)

---

## Next Steps

### Enable HTTPS (Production)
See `ENABLE_FEATURES_GUIDE.md` Step 5

### Setup Automated Backups
```bash
docker-compose exec backend bash /var/www/html/scripts/setup-backup-cron.sh
```

### View Logs
```bash
docker-compose logs -f
```

### Stop Everything
```bash
docker-compose down
```

---

## Troubleshooting

**Port already in use?**
- Change ports in `docker-compose.yml` (e.g., `"8080:80"`)

**Database won't start?**
- Check logs: `docker-compose logs database`
- Ensure MySQL port 3306 is not in use

**API not responding?**
- Check backend logs: `docker-compose logs backend`
- Verify database is running: `docker-compose ps`

---

For detailed instructions, see `ENABLE_FEATURES_GUIDE.md`

