-- Migration: add urls_discovered to security_scans.
--
-- WHY: endpoints_found counts URLs that produced at least one ZAP alert, not
-- URLs the crawl actually reached — a scan that crawls 200 pages and finds
-- issues on 12 reports endpoints_found = 12, which also makes the "did the
-- scanner ever reach the target" guard unreliable (a clean scan of a
-- healthy app looks identical to a scan that never left the ground). See
-- server/services/security.service.js (runScan) — urls_discovered is
-- populated from ZAP's site tree size after both spiders complete and is
-- the correct signal for that guard; endpoints_found is unchanged.
--
-- Idempotent: information_schema-guarded, safe to run more than once.

USE chainbreak;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'security_scans' AND COLUMN_NAME = 'urls_discovered'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE security_scans ADD COLUMN urls_discovered INT UNSIGNED NOT NULL DEFAULT 0 AFTER endpoints_found',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
