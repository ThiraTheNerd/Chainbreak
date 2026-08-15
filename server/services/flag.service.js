import bcrypt from 'bcrypt';
import * as challengeRepository from '../repositories/challenge.repository.js';
import * as submissionRepository from '../repositories/submission.repository.js';
import * as completionRepository from '../repositories/completion.repository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import pool from '../db/connection.js';

/**
 * Flags are stored as bcrypt hashes, so bcrypt.compare gives a constant-time
 * check for free and a DB leak doesn't hand out every answer.
 * Points are awarded only on the FIRST correct solve.
 */
const FLAG_RE = /^flag\{[A-Za-z0-9_-]{4,64}\}$/;

async function recordAttempt({ userId, challengeId, correct, learnerSessionId, points }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id: submissionId } = await submissionRepository.record(
      { userId, challengeId, correct, learnerSessionId },
      connection
    );

    let firstCompletion = false;
    if (correct) {
      firstCompletion = await completionRepository.createIfFirst(
        { userId, challengeId, learnerSessionId, submissionId, pointsAwarded: points },
        connection
      );
    }

    await connection.commit();

    return {
      correct,
      challengeId,
      alreadySolved: correct && !firstCompletion,
      pointsAwarded: firstCompletion ? points : 0,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

function assertWellFormed(submittedFlag) {
  if (typeof submittedFlag !== 'string' || !FLAG_RE.test(submittedFlag.trim())) {
    throw new ValidationError('Malformed flag');
  }
  return submittedFlag.trim();
}


export async function submitFlagForChallenge({ userId, challengeId, submittedFlag, learnerSessionId = null }) {
  const trimmed = assertWellFormed(submittedFlag);

  const challenge = await challengeRepository.findByIdWithFlag(challengeId);
  if (!challenge) throw new NotFoundError('Challenge not found');

  const correct = await bcrypt.compare(trimmed, challenge.flag_hash);
  return recordAttempt({ userId, challengeId, correct, learnerSessionId, points: challenge.points });
}


export async function submitFlagForSession({ userId, sessionChallengeId, submittedFlag, learnerSessionId = null }) {
  const trimmed = assertWellFormed(submittedFlag);

  const sessionChallenge = await challengeRepository.findByIdWithFlag(sessionChallengeId);
  if (!sessionChallenge) throw new NotFoundError('Challenge not found');

  const siblingIds = sessionChallenge.docker_image
    ? (await challengeRepository.findByDockerImage(sessionChallenge.docker_image)).map((c) => c.id)
    : [sessionChallengeId];

  const candidates = siblingIds.length
    ? await challengeRepository.findManyWithFlag(siblingIds)
    : [sessionChallenge];

  let matched = null;
  for (const candidate of candidates) {
    // Sequential and short-circuiting on purpose: bcrypt.compare is
    // deliberately slow, and at most one candidate is ever expected to
    // match a given flag string.
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(trimmed, candidate.flag_hash)) {
      matched = candidate;
      break;
    }
  }

  const correct = Boolean(matched);
  const targetChallengeId = matched ? matched.id : sessionChallengeId;
  const points = matched ? matched.points : 0;

  return recordAttempt({ userId, challengeId: targetChallengeId, correct, learnerSessionId, points });
}
