-- Migration: add the hint_unlocks table (AI-generated progressive hints,
-- one-time-per-tier, same purchase-log shape as solution_unlocks).
--
-- See the CREATE TABLE comment in server/db/schema.sql for the full design
-- rationale. Like migrate_solution_unlocks.sql, this needs no
-- information_schema/PREPARE dance — CREATE TABLE IF NOT EXISTS is valid,
-- idempotent, native MySQL syntax.

USE chainbreak;

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
