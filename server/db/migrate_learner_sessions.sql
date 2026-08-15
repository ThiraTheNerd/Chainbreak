USE chainbreak;

CREATE TABLE IF NOT EXISTS learner_sessions (
  id                       CHAR(36)     NOT NULL,        -- UUID (crypto.randomUUID), same convention as sessions.id
  environment_session_id   CHAR(36)     NOT NULL,        -- the Docker/infra `sessions` row this connection was made against
  user_id                  INT UNSIGNED NOT NULL,
  connected_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at                 TIMESTAMP    NULL DEFAULT NULL,
  end_reason               ENUM('disconnect','expired','pty_exit','server_shutdown','manual') NULL DEFAULT NULL,
  status                   ENUM('active','ended') NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  KEY idx_learner_sessions_env  (environment_session_id, status),  -- reaper: find active learner sessions for an expiring environment
  KEY idx_learner_sessions_user (user_id, status),
  CONSTRAINT fk_learner_sessions_env
    FOREIGN KEY (environment_session_id) REFERENCES sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_learner_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
