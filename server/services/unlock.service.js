/** @file server/services/unlock.service.js — solution access: free-on-completion, or pay-to-unlock. */

import * as challengeRepository from '../repositories/challenge.repository.js';
import * as unlockRepository from '../repositories/unlock.repository.js';
import * as completionRepository from '../repositories/completion.repository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

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

async function isModuleCompleted(userId, dockerImage) {
  const siblings = await challengeRepository.findByDockerImage(dockerImage);
  if (siblings.length === 0) return false;
  const solvedFlags = await Promise.all(
    siblings.map((s) => completionRepository.hasCompleted(userId, s.id))
  );
  return solvedFlags.every(Boolean);
}


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

  const { score } = await completionRepository.scoreForUser(userId);
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
