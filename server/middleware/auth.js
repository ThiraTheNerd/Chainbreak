/** @file server/middleware/auth.js — verifies the Bearer JWT, attaches req.user. */
 
import * as authService from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';
 
export function authenticate(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }
  try {
    const payload = authService.verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
 