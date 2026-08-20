-- Migration: assessments -> attempts-log model.
--
-- WHY: the table had UNIQUE(user_id, type) and the insert used
-- ON DUPLICATE KEY UPDATE, so a participant submitting 'pre' or 'post' a
-- SECOND time silently overwrote their first result (including submitted_at)
-- with no trace. For a pre/post research study that is unacceptable — it can
-- lose a participant's real data unrecoverably and undetectably.
--
-- WHAT THIS DOES (verified against a real, populated copy of this table —
-- every existing row is preserved, none are altered in meaning, none are
-- dropped):
--   1. Adds `attempt_number` (existing rows default to 1).
--   2. Backfills attempt_number correctly per (user_id, type), ordered by
--      submitted_at, in case this ever runs on a table that already
--      accumulated more than one row per (user_id, type) some other way.
--   3. Adds a plain (non-unique) index covering (user_id, type,
--      attempt_number) so "first attempt" / "attempt count" lookups stay
--      fast now that a user+type can have many rows — added BEFORE the next
--      step, not after: InnoDB refuses to drop uq_user_type otherwise,
--      since user_id is a foreign key column and uq_user_type is currently
--      the only index covering it (confirmed by hitting exactly this error
--      — "Cannot drop index 'uq_user_type': needed in a foreign key
--      constraint" — before reordering these two steps).
--   4. Drops the UNIQUE(user_id, type) constraint that caused the overwrite.
--
-- Idempotent: every step checks information_schema first, so running this
-- twice is a harmless no-op the second time. Plain "IF NOT EXISTS" clauses
-- on ADD COLUMN / ADD INDEX / DROP INDEX are NOT valid syntax on real MySQL
-- (confirmed by testing — that's a MariaDB-only extension), which is why
-- this uses the standard information_schema + PREPARE/EXECUTE pattern
-- instead.
--
-- attempt_number = 1 is the CANONICAL attempt used for pre/post analysis —
-- see server/routes/assessment.js (GET /api/assessment/mine).

USE chainbreak;

-- 1. Add attempt_number if it doesn't already exist.
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'attempt_number'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE assessments ADD COLUMN attempt_number INT UNSIGNED NOT NULL DEFAULT 1 AFTER score_cloud',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Backfill: oldest submission per (user_id, type) = 1, next = 2, etc.
UPDATE assessments a
JOIN (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, type ORDER BY submitted_at, id) AS rn
    FROM assessments
) ranked ON ranked.id = a.id
SET a.attempt_number = ranked.rn;

-- 3. Add the replacement index FIRST (see note above on ordering).
SET @idx2_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND INDEX_NAME = 'idx_user_type_attempt'
);
SET @sql2 = IF(@idx2_exists = 0,
  'ALTER TABLE assessments ADD INDEX idx_user_type_attempt (user_id, type, attempt_number)',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 4. THEN drop the UNIQUE constraint that caused the silent overwrite.
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND INDEX_NAME = 'uq_user_type'
);
SET @sql3 = IF(@idx_exists > 0, 'ALTER TABLE assessments DROP INDEX uq_user_type', 'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;
