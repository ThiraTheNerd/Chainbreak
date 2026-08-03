/** @file server/controllers/flag.controller.js — submit a flag for a challenge. */
 
import * as flagService from '../services/flag.service.js';
import { BadRequestError } from '../utils/errors.js';
 
export async function submitFlag(req, res) {
  const { challengeId, flag } = req.body || {};
  if (!challengeId || !flag) throw new BadRequestError('challengeId and flag are required');
 
  const result = await flagService.submitFlag({
    userId: req.user.id,
    challengeId: Number(challengeId),
    submittedFlag: flag,
  });
  res.json(result);
}
 