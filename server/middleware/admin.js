/** @file server/middleware/admin.js — role gate. MUST run AFTER authenticate,
 *  which is what puts req.user on the request. */

import { ForbiddenError } from '../utils/errors.js';

export function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError('Administrator access required'));
  }
  next();
}