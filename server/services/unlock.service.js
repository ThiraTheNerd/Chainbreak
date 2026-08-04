/** @file server/services/unlock.service.js — solution access: free-on-completion, or pay-to-unlock. */

import * as challengeRepository from '../repositories/challenge.repository.js';
import * as unlockRepository from '../repositories/unlock.repository.js';
import * as submissionRepository from '../repositories/submission.repository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

// The unlock cost is a FRACTION of the module's total points — data-driven
// (derived from whatever challenges/points exist for that docker_image, not
// a hardcoded per-module number), so it scales automatically as challenges
// are added or repointed. 0.4 was chosen so the cost sits between "more
// than any single flag" and "less than the whole module": for Challenge 1
// (850 total points across 6 flags, biggest single flag 200) that's 340 XP;
// for Challenge 2 (725 points across 5 flags, biggest single flag 200)
// that's 290 XP. Both are a real trade-off — a learner needs several
// solved flags' worth of XP to afford it, but it never costs as much as
// finishing the module legitimately would earn. (A learner who finishes
// legitimately doesn't pay at all — see isModuleCompleted below.)
export const SOLUTION_UNLOCK_FRACTION = 0.4;

async function resolveModule(challengeId) {
  const challenge = await challengeRepository.findById(challengeId);
  if (!challenge) throw new NotFoundError('Challenge not found');
  if (!challenge.docker_image) {
    throw new BadRequestError('This challenge has no solution module to unlock');
  }
  return challenge;
}

export async function computeUnlockCost(dockerImage) {
  const totalPoints = await challengeRepository.sumPointsByDockerImage(dockerImage);
  return Math.round(totalPoints * SOLUTION_UNLOCK_FRACTION);
}

/**
 * True module completion: EVERY challenge sharing this docker_image is
 * solved by this user — not the per-layer `solved` object in
 * challenge.service.js's getChallengeProgress, which collapses each layer
 * to whichever sibling challenge id it last iterated and so silently
 * ignores extra flags in a multi-flag layer (challenge-1's docker layer
 * alone has three: sqli-ssh-pivot, sqli-privesc-root, sqli-docker-misconfig).
 * This instead composes the same underlying per-challenge solved signal
 * (submissionRepository.hasSolved — the exact primitive
 * challengeRepository.findAll()'s `solved` column and the kill-chain's
 * COMPROMISED state both ultimately rest on) across ALL siblings, which is
 * the actually-correct "has this learner captured every flag" check.
 */
async function isModuleCompleted(userId, dockerImage) {
  const siblings = await challengeRepository.findByDockerImage(dockerImage);
  if (siblings.length === 0) return false;
  const solvedFlags = await Promise.all(
    siblings.map((s) => submissionRepository.hasSolved(userId, s.id))
  );
  return solvedFlags.every(Boolean);
}

/**
 * Status for the Solution tab. `access` is the single source of truth the
 * client renders off:
 *   'completed' — every flag in the module is solved; free, permanent,
 *                  no lock icon, no charge, regardless of whether a paid
 *                  unlock also exists (completing later never refunds one,
 *                  see unlockSolution below — but it also never needs to).
 *   'paid'      — not (yet) completed, but a solution_unlocks row exists.
 *   'locked'    — neither; show the pay-to-unlock panel.
 * `cost` is always returned (even when access is 'completed') so the UI
 * can show "you'd have paid N XP for this" as a small positive-reinforcement
 * detail if it wants to — it never implies a charge happened.
 */
export async function getUnlockStatus(userId, challengeId) {
  const challenge = await resolveModule(challengeId);
  const [cost, existing, completed] = await Promise.all([
    computeUnlockCost(challenge.docker_image),
    unlockRepository.findUnlock(userId, challenge.docker_image),
    isModuleCompleted(userId, challenge.docker_image),
  ]);

  const access = completed ? 'completed' : existing ? 'paid' : 'locked';

  return {
    dockerImage: challenge.docker_image,
    access,
    cost,
    unlockedAt: existing?.unlocked_at ?? null,
  };
}

/**
 * Spend the cost and unlock. Three cases, checked in the same priority
 * order as getUnlockStatus:
 *   1. Already completed — access is already free. Never charge, never
 *      write a solution_unlocks row for this (there is nothing to "pay
 *      for" and doing so would falsely record a cost-bearing purchase for
 *      access the user already had for free).
 *   2. Already paid — idempotent, matches the "never charged again"
 *      guarantee even under a double-click race (see
 *      unlockRepository.recordUnlock's ER_DUP_ENTRY handling).
 *   3. Neither — charge, provided the user can afford it.
 * Paying early and completing the module later does NOT retroactively
 * refund the paid row — solution_unlocks is an immutable purchase log, and
 * getUnlockStatus already reports 'completed' (not 'paid') once the module
 * is finished, so the UI stops mentioning the old payment without needing
 * to alter or delete it. scoreForUser only ever sums real solution_unlocks
 * rows, so a completion never adds spend, and an existing paid row is never
 * double-counted or removed by completing later.
 */
export async function unlockSolution(userId, challengeId) {
  const challenge = await resolveModule(challengeId);

  const [completed, existing] = await Promise.all([
    isModuleCompleted(userId, challenge.docker_image),
    unlockRepository.findUnlock(userId, challenge.docker_image),
  ]);

  if (completed) {
    const cost = await computeUnlockCost(challenge.docker_image);
    return { access: 'completed', cost, unlockedAt: existing?.unlocked_at ?? null };
  }

  if (existing) {
    return { access: 'paid', alreadyUnlocked: true, cost: existing.cost, unlockedAt: existing.unlocked_at };
  }

  const cost = await computeUnlockCost(challenge.docker_image);

  // Enforce affordability so a fresh unlock can never itself be the thing
  // that drives a user's score negative — scoreForUser() floors at 0
  // defensively too, but this stops it from happening in the first place.
  const { score } = await submissionRepository.scoreForUser(userId);
  if (score < cost) {
    throw new BadRequestError(`Not enough XP to unlock this solution (need ${cost}, have ${score})`);
  }

  const result = await unlockRepository.recordUnlock({ userId, dockerImage: challenge.docker_image, cost });
  return {
    access: 'paid',
    alreadyUnlocked: result.alreadyUnlocked,
    cost: result.cost,
    unlockedAt: new Date().toISOString(),
  };
}
