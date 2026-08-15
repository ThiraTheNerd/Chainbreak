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
