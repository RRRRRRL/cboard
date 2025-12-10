# Cboard Deployment Guide

This guide covers deployment of the Cboard Enhancement project using Docker Compose.

## Architecture

The application consists of three main containers:

- **Frontend**: React SPA served by Nginx
- **Backend**: PHP-FPM API server
- **Database**: MySQL 8.0

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM
- 10GB+ disk space

## Quick Start

### 1. Environment Configuration

Create a `.env` file in the project root:

```bash
# Database Configuration
DB_NAME=cboard
DB_USER=cboard_user
DB_PASS=your_secure_password_here
MYSQL_ROOT_PASSWORD=your_root_password_here

# JWT Secret (generate a random string)
JWT_SECRET=your-random-secret-key-min-32-chars

# Azure TTS (Optional)
AZURE_TTS_KEY=your_azure_key
AZURE_TTS_REGION=eastasia
```

### 2. Build and Start Containers

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 3. Initialize Database

The database schema will be automatically imported on first startup. To manually import:

```bash
docker-compose exec database mysql -u root -p$MYSQL_ROOT_PASSWORD cboard < backend/database/schema.sql
```

### 4. Access the Application

- **Frontend**: http://localhost
- **API**: http://localhost/api
- **Database**: localhost:3306

## Production Deployment

### 1. HTTPS Configuration

1. Obtain SSL certificates (Let's Encrypt recommended)
2. Place certificates in `rootfs/etc/nginx/ssl/`:
   - `cert.pem` (certificate)
   - `key.pem` (private key)
3. Uncomment SSL configuration in `rootfs/etc/nginx/conf.d/default.conf`

### 2. Security Hardening

- Change all default passwords
- Use strong JWT secret (minimum 32 characters)
- Enable firewall rules
- Restrict database access to backend container only
- Review and adjust rate limiting limits

### 3. Backup Configuration

#### Automated Backups

```bash
# Setup daily backup cron job
docker-compose exec backend bash /var/www/html/scripts/setup-backup-cron.sh
```

Backups are stored in `/var/backups/cboard/` inside the backend container.

#### Manual Backup

```bash
docker-compose exec backend bash /var/www/html/scripts/backup-database.sh
```

#### Restore from Backup

```bash
# Copy backup file to container
docker cp backup_file.sql.gz cboard-backend:/tmp/

# Restore
docker-compose exec backend bash /var/www/html/scripts/restore-database.sh /tmp/backup_file.sql.gz
```

### 4. Monitoring

#### Health Checks

All services include health checks:

- Frontend: HTTP check on port 80
- Backend: PHP-FPM process check
- Database: MySQL ping check

#### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

## Rate Limiting

Rate limiting is enabled by default with the following limits:

- **Authentication endpoints** (`/api/user/login`, `/api/user/register`): 10 requests/minute
- **Registration**: 5 requests/minute
- **TTS endpoints**: 50 requests/minute
- **All other endpoints**: 100 requests/minute

Rate limit headers are included in all responses:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Scaling

### Horizontal Scaling

To scale the backend:

```bash
docker-compose up -d --scale backend=3
```

Update Nginx configuration to use load balancing:

```nginx
upstream backend {
    least_conn;
    server backend:9000;
    server backend_2:9000;
    server backend_3:9000;
}
```

### Database Replication

For production, set up MySQL master-replica replication:

1. Configure master database
2. Create replica containers
3. Update application to use read replicas for read-heavy operations

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs [service_name]

# Check container status
docker-compose ps

# Restart service
docker-compose restart [service_name]
```

### Database Connection Issues

```bash
# Test database connection
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

# Check rate limiting
curl -v http://localhost/api/user/login
```

## Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild containers
docker-compose build

# Restart services
docker-compose up -d
```

### Database Migrations

```bash
# Run migrations
docker-compose exec backend php /var/www/html/scripts/migrate.php
```

### Clean Up

```bash
# Remove stopped containers
docker-compose down

# Remove volumes (WARNING: Deletes data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Security Checklist

- [ ] SSL certificates configured
- [ ] Strong passwords set
- [ ] JWT secret changed
- [ ] Rate limiting configured
- [ ] Database backups automated
- [ ] Firewall rules configured
- [ ] Security headers enabled
- [ ] Regular security updates applied

## Support

For issues or questions:

- Check logs: `docker-compose logs`
- Review documentation: `README.md`
- Check architecture: `ARCHITECTURE_COMPLIANCE_REPORT.md`
