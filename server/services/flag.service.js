
/** @file server/services/flag.service.js — flag verification + scoring. */
 
import bcrypt from 'bcrypt';
import * as challengeRepository from '../repositories/challenge.repository.js';
import * as submissionRepository from '../repositories/submission.repository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
 
/**
 * Flags are stored as bcrypt hashes, so bcrypt.compare gives a constant-time
 * check for free and a DB leak doesn't hand out every answer.
 * Points are awarded only on the FIRST correct solve.
 */
const FLAG_RE = /^flag\{[A-Za-z0-9_-]{4,64}\}$/;

export async function submitFlag({ userId, challengeId, submittedFlag }) {
  // Reject malformed input BEFORE the expensive bcrypt compare.
  if (typeof submittedFlag !== 'string' || !FLAG_RE.test(submittedFlag.trim())) {
    throw new ValidationError('Malformed flag');
  }
  const challenge = await challengeRepository.findByIdWithFlag(challengeId);
  if (!challenge) throw new NotFoundError('Challenge not found');
 
  const correct = await bcrypt.compare(submittedFlag.trim(), challenge.flag_hash);
  const alreadySolved = correct
    ? await submissionRepository.hasSolved(userId, challengeId)
    : false;
 
  await submissionRepository.record({ userId, challengeId, correct });
 
  return {
    correct,
    alreadySolved,
    pointsAwarded: correct && !alreadySolved ? challenge.points : 0,
  };
}
// function compareFlag(submitted, expectedHash) {
//   const a = createHash('sha256').update(submitted).digest();
//   const b = Buffer.from(expectedHash, 'hex');
//   return a.length === b.length && timingSafeEqual(a, b);
// }