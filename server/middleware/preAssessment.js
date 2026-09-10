import pool from '../db/connection.js';
import { ForbiddenError } from '../utils/errors.js';

// Mirrors requireConsent's shape (server/middleware/consent.js) — same
// admin exemption, same "gate before the route runs" placement. Blocks
// challenge access until the learner has at least one pre-assessment row.
export async function requirePreAssessment(req, _res, next) {
  if (req.user?.role === 'admin') return next();

  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM assessments WHERE user_id = ? AND type = 'pre'`,
    [req.user.id]
  );

  if (count === 0) {
    return next(new ForbiddenError('Complete the pre-assessment to begin challenges'));
  }

  next();
}
