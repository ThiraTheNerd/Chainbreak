// Derived from `completions` (one row per solved challenge, ever) rather
// than `submissions` (every attempt, including repeats) — verified before
// this cutover to produce identical results for all 16 users with
// historical data (see SESSION_ATTEMPT_COMPLETION_MIGRATION_PLAN.md
// section 6). completions is now the authoritative "solved" source; the
// equivalent submissions-based queries remain in submission.repository.js
// for reference/comparison but are no longer used for scoring.
import * as completionRepository from '../repositories/completion.repository.js';

export async function getMyScore(userId) {
  return completionRepository.scoreForUser(userId);
}

export async function getLeaderboard(limit = 50) {
  return completionRepository.leaderboard(limit);
}
