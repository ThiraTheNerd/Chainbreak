
USE chainbreak;

CREATE TABLE IF NOT EXISTS consent_records (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id                 INT UNSIGNED NOT NULL,
  consented               BOOLEAN      NOT NULL DEFAULT FALSE,
  consent_version         VARCHAR(50)  NOT NULL,
  consent_items           JSON         NOT NULL,
  audio_recording_consent ENUM('consented','declined','not_applicable') NOT NULL,
  typed_name               VARCHAR(255) NOT NULL,
  consented_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at            TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_consent_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
