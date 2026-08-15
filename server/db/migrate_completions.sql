
USE chainbreak;

CREATE TABLE IF NOT EXISTS completions (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            INT UNSIGNED NOT NULL,
  challenge_id       INT UNSIGNED NOT NULL,
  learner_session_id CHAR(36)     NULL DEFAULT NULL,
  submission_id      INT UNSIGNED NOT NULL,
  points_awarded     INT UNSIGNED NOT NULL,   -- frozen at completion time; a later change to challenges.points never retroactively rewrites history (same principle as solution_unlocks.cost)
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


INSERT IGNORE INTO completions (user_id, challenge_id, learner_session_id, submission_id, points_awarded, completed_at)
SELECT
  s.user_id,
  s.challenge_id,
  NULL,
  s.id,
  c.points,
  s.submitted_at
FROM submissions s
JOIN challenges c ON c.id = s.challenge_id
JOIN (
  SELECT user_id, challenge_id, MIN(submitted_at) AS first_correct_at
    FROM submissions
   WHERE correct = 1
   GROUP BY user_id, challenge_id
) earliest
  ON earliest.user_id = s.user_id
 AND earliest.challenge_id = s.challenge_id
 AND earliest.first_correct_at = s.submitted_at
WHERE s.correct = 1;
