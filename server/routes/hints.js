/** @file server/routes/hints.js — /api/hints (auth required; research export is admin-only). */

import { Router } from 'express';
import * as hintRepository from '../repositories/hint.repository.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(authenticate);

// Research export: every hint reveal, across every user — who took which
// hint, at which tier, when, for what cost, and whether Claude actually
// generated it or the fallback fired. This IS the hint-usage research log
// (see server/db/schema.sql's hint_unlocks comment) — a separate top-level
// route (not nested under /challenges/:id) since it's cross-user, not
// scoped to one learner's own progress.
router.get('/research', requireAdmin, async (_req, res) => {
  const reveals = await hintRepository.allHintReveals();
  res.json({ hintReveals: reveals });
});

export default router;
