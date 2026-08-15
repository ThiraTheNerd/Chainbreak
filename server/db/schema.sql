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
  cohort        ENUM('original','remote') NOT NULL DEFAULT 'remote',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE IF NOT EXISTS consent_records (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id                 INT UNSIGNED NOT NULL,
  consented               BOOLEAN      NOT NULL DEFAULT FALSE,
  consent_version         VARCHAR(50)  NOT NULL,  -- which PIS/consent wording was shown
  consent_items           JSON         NOT NULL,  -- { itemKey: true|false, ... } — mirrors the paper form's tick-boxes
  audio_recording_consent ENUM('consented','declined','not_applicable') NOT NULL,
  typed_name               VARCHAR(255) NOT NULL,
  consented_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at            TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_consent_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            VARCHAR(64)  NOT NULL,
  label           VARCHAR(255) NULL,          -- e.g. a participant reference code, not their name
  status          ENUM('unused','used','revoked') NOT NULL DEFAULT 'unused',
  created_by      INT UNSIGNED NOT NULL,      -- admin user id who generated it
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP    NULL,
  used_at         TIMESTAMP    NULL,
  used_by_user_id INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invite_codes_code (code),
  FOREIGN KEY (created_by)      REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS learner_sessions (
  id                     CHAR(36)     NOT NULL,
  environment_session_id CHAR(36)     NOT NULL,
  user_id                INT UNSIGNED NOT NULL,
  connected_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at               TIMESTAMP    NULL DEFAULT NULL,
  end_reason             ENUM('disconnect','expired','pty_exit','server_shutdown','manual') NULL DEFAULT NULL,
  status                 ENUM('active','ended') NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  KEY idx_learner_sessions_env  (environment_session_id, status),
  KEY idx_learner_sessions_user (user_id, status),
  CONSTRAINT fk_learner_sessions_env
    FOREIGN KEY (environment_session_id) REFERENCES sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_learner_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS submissions (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id            INT UNSIGNED NOT NULL,
  challenge_id       INT UNSIGNED NOT NULL,
  learner_session_id CHAR(36)     NULL DEFAULT NULL,
  correct            TINYINT(1)   NOT NULL DEFAULT 0,
  attempt_source     ENUM('user_attempt','challenge_resolution') NOT NULL DEFAULT 'user_attempt',
  submitted_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_submissions_user (user_id),
  KEY idx_submissions_challenge (challenge_id),
  KEY idx_submissions_learner_session (learner_session_id),
  CONSTRAINT fk_sub_user      FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_sub_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_learner_session
    FOREIGN KEY (learner_session_id) REFERENCES learner_sessions(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS completions (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            INT UNSIGNED NOT NULL,
  challenge_id       INT UNSIGNED NOT NULL,
  learner_session_id CHAR(36)     NULL DEFAULT NULL,
  submission_id      INT UNSIGNED NOT NULL,
  points_awarded     INT UNSIGNED NOT NULL,
  completed_at       TIMESTAMP    NOT NULL,
  CONSTRAINT fk_completions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_completions_challenge
    FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE,
  CONSTRAINT fk_completions_learner_session
    FOREIGN KEY (learner_session_id) REFERENCES learner_sessions (id) ON DELETE SET NULL,
  CONSTRAINT fk_completions_submission
    FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_completion_user_challenge (user_id, challenge_id)
) ENGINE=InnoDB;

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


CREATE TABLE IF NOT EXISTS solution_unlocks (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  docker_image VARCHAR(200) NOT NULL,
  cost         INT UNSIGNED NOT NULL,
  unlocked_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_module (user_id, docker_image)
);


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