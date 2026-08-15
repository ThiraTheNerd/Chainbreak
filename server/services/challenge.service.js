import * as challengeRepository from '../repositories/challenge.repository.js';
import * as completionRepository from '../repositories/completion.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

const VALID_LAYERS = ['owasp', 'docker', 'aws'];

export async function listChallenges({ userId, layer }) {
  if (layer && !VALID_LAYERS.includes(layer)) {
    throw new BadRequestError(`layer must be one of: ${VALID_LAYERS.join(', ')}`);
  }
  return challengeRepository.findAll({ userId, layer: layer || null });
}

export async function getChallenge(id) {
  const challenge = await challengeRepository.findById(id);
  if (!challenge) throw new NotFoundError('Challenge not found');
  return challenge;
}


export async function getChallengeProgress(userId, challengeId) {
  const target = await challengeRepository.findById(challengeId);
  if (!target) throw new NotFoundError('Challenge not found');

  const siblings = target.docker_image
    ? await challengeRepository.findByDockerImage(target.docker_image)
    : [{ id: target.id, layer: target.layer }];

  const layerChallengeIds = { owasp: null, docker: null, aws: null };
  for (const s of siblings) {
    if (VALID_LAYERS.includes(s.layer)) layerChallengeIds[s.layer] = s.id;
  }

  const solved = { owasp: false, docker: false, aws: false };
  // Flags are stored as bcrypt hashes (one-way) — a solved flag can only
  // be reported as "captured", never reproduced.
  const capturedFlagValues = { owasp: null, docker: null, aws: null };

  await Promise.all(
    VALID_LAYERS.map(async (layer) => {
      const id = layerChallengeIds[layer];
      if (!id) return;
      const isSolved = await completionRepository.hasCompleted(userId, id);
      solved[layer] = isSolved;
      capturedFlagValues[layer] = isSolved ? '[already captured]' : null;
    })
  );

  const moduleChallengeIds = Object.values(layerChallengeIds).filter(Boolean);
  const activeSessions = await Promise.all(
    moduleChallengeIds.map((id) => sessionRepository.findActiveByUserAndChallenge(userId, id))
  );

  return {
    challengeId: target.id,
    solved,
    capturedFlagValues,
    hasActiveSession: activeSessions.some(Boolean),
  };
}
