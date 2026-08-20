-- Migration: add confidence/self-efficacy and SUS instrument columns to
-- assessments.
--
-- WHY: extending the Assessment feature with two more research instruments
-- alongside the existing 30-question knowledge test — a 5-item
-- confidence/self-efficacy Likert (administered pre AND post) and the
-- standard 10-item System Usability Scale (administered post only, scored
-- 0-100). Both are kept on the SAME assessments row as the knowledge
-- answers, not a separate table, so the attempts-log model already in place
-- (every submission its own row; attempt_number = 1 is the canonical
-- first-of-type) covers all three instruments with no change to that model.
-- See server/routes/assessment.js.
--
-- Idempotent: information_schema-guarded, safe to run more than once.
-- (Plain "ADD COLUMN IF NOT EXISTS" is not valid syntax on real MySQL —
-- confirmed while building the prior attempts-log migration — hence the
-- same information_schema + PREPARE/EXECUTE pattern here.)

USE chainbreak;

-- 1. confidence_ratings — populated on both 'pre' and 'post' rows.
SET @col1_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'confidence_ratings'
);
SET @sql1 = IF(@col1_exists = 0,
  'ALTER TABLE assessments ADD COLUMN confidence_ratings JSON NULL AFTER attempt_number',
  'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

-- 2. sus_responses — populated only on 'post' rows.
SET @col2_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'sus_responses'
);
SET @sql2 = IF(@col2_exists = 0,
  'ALTER TABLE assessments ADD COLUMN sus_responses JSON NULL AFTER confidence_ratings',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 3. sus_score — the standard 0-100 SUS score computed server-side, 'post' rows only.
SET @col3_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessments' AND COLUMN_NAME = 'sus_score'
);
SET @sql3 = IF(@col3_exists = 0,
  'ALTER TABLE assessments ADD COLUMN sus_score TINYINT UNSIGNED NULL AFTER sus_responses',
  'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;
