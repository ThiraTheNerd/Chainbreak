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

export async function getProgress(req, res) {
  const progress = await challengeService.getChallengeProgress(req.user.id, Number(req.params.id));
  res.json(progress);
}

export async function getSolutionUnlockStatus(req, res) {
  const status = await unlockService.getUnlockStatus(req.user.id, Number(req.params.id));
  res.json(status);
}

export async function unlockSolution(req, res) {
  const result = await unlockService.unlockSolution(req.user.id, Number(req.params.id));
  res.json(result);
}

export async function getHintStatus(req, res) {
  const status = await hintService.getHintStatus(req.user.id, Number(req.params.id));
  res.json(status);
}

export async function revealHint(req, res) {
  const tier = Number(req.params.tier);
  const result = await hintService.revealHint(req.user.id, Number(req.params.id), tier);
  res.json(result);
}

export async function create(req, res) {
  const { valid, errors, value } = validateChallengePayload(req.body);
  if (!valid) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  const challenge = await challengeService.createChallenge(value);
  res.status(201).json({ challenge });
}

// Soft delete by default.
export async function archive(req, res) {
  const result = await challengeService.archiveChallenge(Number(req.params.id));
  res.json(result);
}
