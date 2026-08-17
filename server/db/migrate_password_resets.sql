-- Migration: add the password_resets table (forgot-password flow).
--
-- See the CREATE TABLE comment in server/db/schema.sql for the full design
-- rationale (why only a token hash is stored, why one row per request).
--
-- CREATE TABLE IF NOT EXISTS is valid, idempotent, native MySQL syntax —
-- same pattern as migrate_solution_unlocks.sql.

USE chainbreak;

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
