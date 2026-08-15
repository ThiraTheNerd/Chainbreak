
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
