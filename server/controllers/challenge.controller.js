/** @file server/controllers/challenge.controller.js */

import * as challengeService from '../services/challenge.service.js';
import * as unlockService    from '../services/unlock.service.js';
import * as hintService      from '../services/hint.service.js';
 
export async function listChallenges(req, res) {
  const challenges = await challengeService.listChallenges({
    userId: req.user.id,
    layer: req.query.layer,
  });
  res.json({ challenges });
}
 
export async function getOne(req, res) {
  const challenge = await challengeService.getChallenge(Number(req.params.id));
  res.json({ challenge });
}

/** GET /api/challenges/:id/progress — this user's permanent solve state for the module. */
export async function getProgress(req, res) {
  const progress = await challengeService.getChallengeProgress(req.user.id, Number(req.params.id));
  res.json(progress);
}

/** GET /api/challenges/:id/solution-unlock — is the solution unlocked, and what would it cost. */
export async function getSolutionUnlockStatus(req, res) {
  const status = await unlockService.getUnlockStatus(req.user.id, Number(req.params.id));
  res.json(status);
}

/** POST /api/challenges/:id/solution-unlock — spend XP to unlock (one-time; idempotent if already unlocked). */
export async function unlockSolution(req, res) {
  const result = await unlockService.unlockSolution(req.user.id, Number(req.params.id));
  res.json(result);
}

/** GET /api/challenges/:id/hints — this user's 3-tier hint ladder for one flag. */
export async function getHintStatus(req, res) {
  const status = await hintService.getHintStatus(req.user.id, Number(req.params.id));
  res.json(status);
}

/** POST /api/challenges/:id/hints/:tier — reveal a tier (one-time; idempotent if already revealed). */
export async function revealHint(req, res) {
  const tier = Number(req.params.tier);
  const result = await hintService.revealHint(req.user.id, Number(req.params.id), tier);
  res.json(result);
}

/** POST /api/challenges  (admin) */
export async function create(req, res) {
  const { valid, errors, value } = validateChallengePayload(req.body);
  if (!valid) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  const challenge = await challengeService.createChallenge(value);
  res.status(201).json({ challenge });
}

/** DELETE /api/challenges/:id  (admin) — soft delete by default. */
export async function archive(req, res) {
  const result = await challengeService.archiveChallenge(Number(req.params.id));
  res.json(result);
}
