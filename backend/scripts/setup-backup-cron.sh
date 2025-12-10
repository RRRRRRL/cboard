#!/bin/bash
# Setup cron job for automated database backups

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "Backup cron job already exists."
    exit 0
fi

# Add cron job (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_SCRIPT >> /var/log/cboard-backup.log 2>&1") | crontab -

echo "Backup cron job added successfully!"
echo "Backups will run daily at 2:00 AM"
echo "Logs will be written to: /var/log/cboard-backup.log"

