-- Add data retention policy table
-- This table stores the data retention policy configuration

CREATE TABLE IF NOT EXISTS `data_retention_policy` (
    `id` INT UNSIGNED NOT NULL DEFAULT 1,
    `action_logs_retention_days` INT UNSIGNED NULL COMMENT 'Number of days to retain action_logs. NULL means never delete.',
    `learning_logs_retention_days` INT UNSIGNED NULL COMMENT 'Number of days to retain jyutping_learning_log. NULL means never delete.',
    `ocr_history_retention_days` INT UNSIGNED NULL COMMENT 'Number of days to retain ocr_history. NULL means never delete.',
    `last_cleanup_at` DATETIME NULL COMMENT 'Timestamp of last automatic cleanup',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_single_row` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default settings (30 days retention)
INSERT INTO `data_retention_policy` (
    `id`,
    `action_logs_retention_days`,
    `learning_logs_retention_days`,
    `ocr_history_retention_days`,
    `last_cleanup_at`
) VALUES (
    1,
    30,
    30,
    30,
    NULL
) ON DUPLICATE KEY UPDATE
    `action_logs_retention_days` = 30,
    `learning_logs_retention_days` = 30,
    `ocr_history_retention_days` = 30;

