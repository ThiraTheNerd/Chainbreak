
USE chainbreak;

ALTER TABLE users
  ADD COLUMN cohort ENUM('original','remote') NOT NULL DEFAULT 'remote';

UPDATE users SET cohort = 'original';
