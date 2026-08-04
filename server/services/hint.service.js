/** @file server/services/hint.service.js — progressive AI hints, one-time-per-tier. */

import * as challengeRepository from '../repositories/challenge.repository.js';
import * as hintRepository from '../repositories/hint.repository.js';
import * as submissionRepository from '../repositories/submission.repository.js';
import { getHintContext } from '../lib/hintContext.js';
import { generateHint } from './ai.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

// Escalating, one-time-per-tier cost. Chosen to stay well under the
// solution-unlock cost (340 XP for Challenge 1, 290 XP for Challenge 2 —
// see server/services/unlock.service.js): all 3 tiers together cost 95 XP,
// under a third of either module's full unlock price, so hints stay a
// cheaper (if less complete) form of help than paying for the whole
// walkthrough — while tier 1 alone (15 XP) is still real money, not free.
export const HINT_TIER_COSTS = { 1: 15, 2: 30, 3: 50 };
const TIERS = [1, 2, 3];

async function resolveChallenge(challengeId) {
  const challenge = await challengeRepository.findById(challengeId);
  if (!challenge) throw new NotFoundError('Challenge not found');
  return challenge;
}

/** This user's hint ladder for one challenge — all 3 tiers, revealed or not. */
export async function getHintStatus(userId, challengeId) {
  const challenge = await resolveChallenge(challengeId);
  const existing = await hintRepository.findUnlocksForChallenge(userId, challengeId);
  const byTier = new Map(existing.map((r) => [r.tier, r]));

  const tiers = TIERS.map((tier) => {
    const row = byTier.get(tier);
    return {
      tier,
      cost: HINT_TIER_COSTS[tier],
      unlocked: Boolean(row),
      hint: row ? row.hint_text : null,
      source: row ? row.source : null,
      unlockedAt: row ? row.created_at : null,
    };
  });

  return { challengeId: challenge.id, slug: challenge.slug, tiers };
}

/**
 * Reveals one tier: charges once (idempotent — see
 * hintRepository.recordUnlock's ER_DUP_ENTRY handling), generates (or falls
 * back to) the hint text, and persists it. Tiers must be taken in order —
 * tier 2 requires tier 1 already revealed, tier 3 requires tier 2 — so a
 * learner can't skip straight to the near-explicit hint.
 */
export async function revealHint(userId, challengeId, tier) {
  if (!TIERS.includes(tier)) {
    throw new BadRequestError('tier must be 1, 2, or 3');
  }

  const challenge = await resolveChallenge(challengeId);

  const existing = await hintRepository.findUnlock(userId, challengeId, tier);
  if (existing) {
    return {
      tier,
      cost: existing.cost,
      hint: existing.hint_text,
      source: existing.source,
      unlockedAt: existing.created_at,
      alreadyUnlocked: true,
    };
  }

  if (tier > 1) {
    const priorTier = await hintRepository.findUnlock(userId, challengeId, tier - 1);
    if (!priorTier) {
      throw new BadRequestError(`Reveal tier ${tier - 1} before tier ${tier}`);
    }
  }

  const cost = HINT_TIER_COSTS[tier];

  // Enforce affordability so a fresh reveal can never itself drive a
  // user's score negative — scoreForUser() floors at 0 defensively too,
  // same pattern as unlock.service.js's solution-unlock check.
  const { score } = await submissionRepository.scoreForUser(userId);
  if (score < cost) {
    throw new BadRequestError(`Not enough XP for this hint (need ${cost}, have ${score})`);
  }

  const context = getHintContext(challenge.slug);
  const { text, source } = await generateHint({ challenge, context, tier });

  const result = await hintRepository.recordUnlock({
    userId, challengeId, tier, cost, hintText: text, source,
  });

  return {
    tier,
    cost: result.cost,
    hint: result.hintText,
    source: result.source,
    unlockedAt: new Date().toISOString(),
    alreadyUnlocked: result.alreadyUnlocked,
  };
}
