
/** @file server/services/score.service.js — personal score + leaderboard. */
 
import * as submissionRepository from '../repositories/submission.repository.js';
 
export async function getMyScore(userId) {
  return submissionRepository.scoreForUser(userId);
}
 
export async function getLeaderboard(limit = 50) {
  return submissionRepository.leaderboard(limit);
}
 