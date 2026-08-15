USE chainbreak;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_scans' AND COLUMN_NAME = 'urls_discovered'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE security_scans ADD COLUMN urls_discovered INT UNSIGNED NOT NULL DEFAULT 0 AFTER endpoints_found',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
