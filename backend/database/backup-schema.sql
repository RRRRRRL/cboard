-- Database Backup Configuration
-- This file documents the backup and recovery strategy

-- Point-in-Time Recovery Setup
-- To enable point-in-time recovery, configure MySQL with binary logging:

-- 1. Edit MySQL configuration (my.cnf or my.ini):
--    [mysqld]
--    log-bin=mysql-bin
--    binlog-format=ROW
--    expire_logs_days=7
--    max_binlog_size=100M

-- 2. Restart MySQL server

-- 3. Create initial full backup:
--    mysqldump --single-transaction --master-data=2 --all-databases > full_backup.sql

-- 4. For point-in-time recovery:
--    mysqlbinlog --start-datetime="2024-01-01 12:00:00" \
--                --stop-datetime="2024-01-01 13:00:00" \
--                mysql-bin.000001 | mysql -u root -p cboard

-- Backup Retention Policy:
-- - Daily backups: Keep for 30 days
-- - Weekly backups: Keep for 12 weeks
-- - Monthly backups: Keep for 12 months

-- Backup Script Location: backend/scripts/backup-database.sh
-- Restore Script Location: backend/scripts/restore-database.sh

