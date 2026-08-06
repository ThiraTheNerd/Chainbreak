/** @file server/controllers/score.controller.js */
 
import * as scoreService from '../services/score.service.js';
 
export async function me(req, res) {
  const result = await scoreService.getMyScore(req.user.id);
  res.json(result);
}
 
export async function leaderboard(_req, res) {
  const entries = await scoreService.getLeaderboard();
  res.json({ leaderboard: entries });
}
 