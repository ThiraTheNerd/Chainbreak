USE chainbreak;

CREATE TABLE IF NOT EXISTS invite_codes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            VARCHAR(64)  NOT NULL,
  label           VARCHAR(255) NULL,
  status          ENUM('unused','used','revoked') NOT NULL DEFAULT 'unused',
  created_by      INT UNSIGNED NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP    NULL,
  used_at         TIMESTAMP    NULL,
  used_by_user_id INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invite_codes_code (code),
  FOREIGN KEY (created_by)      REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
