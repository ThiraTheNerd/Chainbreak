USE chainbreak;
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'attempt_source'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE submissions ADD COLUMN attempt_source ENUM('user_attempt','challenge_resolution') NOT NULL DEFAULT 'user_attempt' AFTER correct",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @col2_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'learner_session_id'
);
SET @sql2 = IF(@col2_exists = 0,
  'ALTER TABLE submissions ADD COLUMN learner_session_id CHAR(36) NULL DEFAULT NULL AFTER challenge_id',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_submissions_learner_session'
);
SET @sql3 = IF(@idx_exists = 0,
  'ALTER TABLE submissions ADD INDEX idx_submissions_learner_session (learner_session_id)',
  'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND CONSTRAINT_NAME = 'fk_submissions_learner_session'
);
SET @sql4 = IF(@fk_exists = 0,
  'ALTER TABLE submissions ADD CONSTRAINT fk_submissions_learner_session FOREIGN KEY (learner_session_id) REFERENCES learner_sessions(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;
