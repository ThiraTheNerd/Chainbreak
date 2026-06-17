-- ChainBreak schema. Applied automatically by `npm run db:seed`.
CREATE DATABASE IF NOT EXISTS chainbreak
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE chainbreak;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('participant','admin') NOT NULL DEFAULT 'participant',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

-- Forgot-password flow. Stores only a SHA-256 hash of the reset token —
-- never the raw token — so a leaked row (backup, SQL injection dump) can't
-- be replayed; the raw token exists only in the emailed/logged reset link.
-- One row per requested reset; `used_at` marks it consumed so a token
-- cannot be replayed after a successful reset. See
-- server/services/auth.service.js for expiry (30 min) and single-use logic.
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  used_at    TIMESTAMP    NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_token_hash (token_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenges (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  title       VARCHAR(120) NOT NULL,
  description TEXT         NULL,
  layer       ENUM('owasp','docker','aws') NOT NULL,
  category      VARCHAR(60) NOT NULL,
  difficulty  ENUM('easy','medium','hard') NOT NULL DEFAULT 'easy',
  flag_hash   VARCHAR(255) NOT NULL,
  points      INT UNSIGNED NOT NULL DEFAULT 100,
  docker_image  VARCHAR(200) NULL,
  network_alias VARCHAR(100) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_challenges_title (title)
);

CREATE TABLE IF NOT EXISTS submissions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  challenge_id INT UNSIGNED NOT NULL,
  correct      TINYINT(1)   NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_submissions_user (user_id),
  KEY idx_submissions_challenge (challenge_id),
  CONSTRAINT fk_sub_user      FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_sub_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id                       CHAR(36)     NOT NULL,        -- UUID (crypto.randomUUID)
  user_id                  INT UNSIGNED NOT NULL,        -- UNSIGNED to match users.id
  challenge_id             INT UNSIGNED NOT NULL,        -- UNSIGNED to match challenges.id
  container_id             VARCHAR(64)  DEFAULT NULL,    -- the target; null until provisioned
  workstation_container_id VARCHAR(64)  DEFAULT NULL,    -- the attacker box
  network_id               VARCHAR(64)  DEFAULT NULL,
  status                   ENUM('provisioning','running','ended','failed', 'expired')
                                        NOT NULL DEFAULT 'provisioning',
  created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at               TIMESTAMP    NOT NULL,        -- what the countdown timer reads
  ended_at                 TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_active_lookup (user_id, challenge_id, status),  -- idempotency query
  KEY idx_reaper        (status, expires_at),             -- cleanup sweep
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_challenge
    FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Attempts-log model: every submission is its own row, nothing is ever
-- overwritten (previously UNIQUE(user_id, type) + ON DUPLICATE KEY UPDATE
-- meant a second 'pre' or 'post' submission silently destroyed the first —
-- unacceptable for a pre/post research study). attempt_number = 1 is the
-- CANONICAL attempt for analysis — see server/routes/assessment.js.
-- Existing databases: apply server/db/migrate_assessments_attempts_log.sql
-- (this CREATE TABLE only affects a fresh install).
--
-- confidence_ratings / sus_responses / sus_score: two additional research
-- instruments carried on the SAME row as the knowledge answers (not a
-- separate table) so the attempts-log model above covers them for free.
-- confidence_ratings is populated on both 'pre' and 'post' rows; sus_* only
-- on 'post' rows (SUS is administered post-session only). Existing
-- databases: apply server/db/migrate_assessment_instruments.sql.
CREATE TABLE IF NOT EXISTS assessments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  type         ENUM('pre','post') NOT NULL,
  answers      JSON NOT NULL,
  score_web    TINYINT UNSIGNED DEFAULT 0,
  score_container TINYINT UNSIGNED DEFAULT 0,
  score_cloud  TINYINT UNSIGNED DEFAULT 0,
  attempt_number INT UNSIGNED NOT NULL DEFAULT 1,
  confidence_ratings JSON NULL,
  sus_responses      JSON NULL,
  sus_score          TINYINT UNSIGNED NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_user_type_attempt (user_id, type, attempt_number)
);

-- Pay-to-unlock solution walkthroughs. One row per (user, module) — the
-- UNIQUE key is what makes the unlock genuinely ONE-TIME: a second unlock
-- attempt for the same module hits a duplicate-key error, which the
-- repository treats as "already unlocked" rather than charging again.
-- Keyed by docker_image (the module identifier already used by
-- client/src/lib/solutions.js and MissionBrief.jsx's OBJECTIVES_BY_IMAGE),
-- not challenge_id, since a module spans several challenge rows (web/
-- container/cloud) and the unlock covers the whole module's walkthrough at
-- once. `cost` is stored per-row (not just derived from current challenge
-- points) so a later change to a challenge's points doesn't retroactively
-- alter what a past unlock is understood to have cost — see
-- server/services/unlock.service.js for how cost is computed at unlock time
-- and how it's subtracted from score (server/repositories/submission.repository.js).
CREATE TABLE IF NOT EXISTS solution_unlocks (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  docker_image VARCHAR(200) NOT NULL,
  cost         INT UNSIGNED NOT NULL,
  unlocked_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_module (user_id, docker_image)
);

-- AI-generated progressive hints (server/services/hint.service.js). One row
-- per (user, challenge, tier) unlocked — same one-time-per-tier shape as
-- solution_unlocks above, but keyed to a single CHALLENGE (one flag), not a
-- whole module, since a hint is requested per-flag. `hint_text` stores the
-- actual generated (or fallback) content so it's shown identically on every
-- future visit without re-calling Claude. `source` distinguishes a real
-- Claude response from the pre-written fallback (used when the API errors,
-- times out, or ANTHROPIC_API_KEY isn't configured) — genuine research
-- signal for "did the AI actually respond." This table doubles as the
-- research log itself: which learner took which hint, at which tier, when,
-- for what cost — see server/repositories/hint.repository.js's
-- allHintReveals(), exposed at GET /api/hints/research (admin-only).
CREATE TABLE IF NOT EXISTS hint_unlocks (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  challenge_id INT UNSIGNED NOT NULL,
  tier         TINYINT UNSIGNED NOT NULL,
  cost         INT UNSIGNED NOT NULL,
  hint_text    TEXT NOT NULL,
  source       ENUM('ai','fallback') NOT NULL DEFAULT 'ai',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_challenge_tier (user_id, challenge_id, tier)
);

CREATE TABLE IF NOT EXISTS security_scans (
  id CHAR(36) NOT NULL, target VARCHAR(255) NOT NULL,
  scan_type ENUM('passive','full','api') NOT NULL,
  status ENUM('queued','scanning','completed','failed','cancelled') NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP NULL,
  current_phase VARCHAR(80) NULL, endpoints_found INT UNSIGNED NOT NULL DEFAULT 0,
  urls_discovered INT UNSIGNED NOT NULL DEFAULT 0,
  requests_made INT UNSIGNED NOT NULL DEFAULT 0, total_findings INT UNSIGNED NOT NULL DEFAULT 0,
  critical_count INT UNSIGNED NOT NULL DEFAULT 0, high_count INT UNSIGNED NOT NULL DEFAULT 0,
  medium_count INT UNSIGNED NOT NULL DEFAULT 0, low_count INT UNSIGNED NOT NULL DEFAULT 0,
  informational_count INT UNSIGNED NOT NULL DEFAULT 0, score TINYINT UNSIGNED NULL,
  error_message TEXT NULL, PRIMARY KEY (id), KEY idx_security_scans_started (started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS security_findings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, scan_id CHAR(36) NOT NULL,
  alert_name VARCHAR(255) NOT NULL, risk VARCHAR(30) NOT NULL, confidence VARCHAR(30) NULL,
  url VARCHAR(2048) NOT NULL, method VARCHAR(12) NULL, parameter VARCHAR(255) NULL,
  evidence TEXT NULL, description TEXT NULL, solution TEXT NULL, reference_url TEXT NULL,
  owasp_category VARCHAR(10) NULL,
  owasp_mapping ENUM('direct','approximate','not_mapped') NOT NULL DEFAULT 'not_mapped',
  layer ENUM('web','container','cloud') NOT NULL DEFAULT 'web', challenge VARCHAR(100) NULL,
  ground_truth_status ENUM('true_positive','false_positive','unassessed','false_negative') NOT NULL DEFAULT 'unassessed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
  KEY idx_security_findings_scan (scan_id),
  CONSTRAINT fk_security_findings_scan FOREIGN KEY (scan_id) REFERENCES security_scans (id) ON DELETE CASCADE
) ENGINE=InnoDB;