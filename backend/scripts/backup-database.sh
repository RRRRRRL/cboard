#!/bin/bash
# MySQL Database Backup Script
# Creates daily backups with retention policy

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-cboard}"
DB_USER="${DB_USER:-cboard_user}"
DB_PASS="${DB_PASS:-cboard_pass}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/cboard}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/cboard_backup_$TIMESTAMP.sql.gz"

# Perform backup
echo "Starting database backup: $BACKUP_FILE"
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --quick \
    --lock-tables=false \
    "$DB_NAME" | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_FILE"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup size: $BACKUP_SIZE"
    
    # Clean old backups (keep last N days)
    echo "Cleaning backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "cboard_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # List remaining backups
    echo "Remaining backups:"
    ls -lh "$BACKUP_DIR"/cboard_backup_*.sql.gz 2>/dev/null | tail -5
    
    exit 0
else
    echo "ERROR: Backup failed!"
    exit 1
fi

