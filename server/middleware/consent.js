import * as consentRepository from '../repositories/consent.repository.js';
import { ForbiddenError } from '../utils/errors.js';

export async function requireConsent(req, _res, next) {

  if (req.user?.role === 'admin') return next();

  const ctx = await consentRepository.findAccessContext(req.user.id);


  
  if (ctx?.cohort === 'original') return next();


  const hasActiveConsent = !!ctx && !!ctx.consented && !ctx.withdrawn_at;
  if (!hasActiveConsent) {
    return next(new ForbiddenError('Study access requires completed research consent'));
  }

  next();
}
