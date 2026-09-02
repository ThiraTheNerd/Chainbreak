-- Migration: add the solution_unlocks table (pay-to-unlock solution
-- walkthroughs, one-time per user per module).
--
-- See the CREATE TABLE comment in server/db/schema.sql for the full design
-- rationale (why docker_image not challenge_id, why cost is stored per-row).
--
-- Unlike the assessments migrations, this needs no information_schema/
-- PREPARE dance — CREATE TABLE IF NOT EXISTS is valid, idempotent, native
-- MySQL syntax (only ALTER TABLE ... ADD/DROP COLUMN IF NOT EXISTS is not).

USE chainbreak;

CREATE TABLE IF NOT EXISTS solution_unlocks (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  docker_image VARCHAR(200) NOT NULL,
  cost         INT UNSIGNED NOT NULL,
  unlocked_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_module (user_id, docker_image)
);
