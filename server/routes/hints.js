import { Router } from 'express';
import * as hintRepository from '../repositories/hint.repository.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(authenticate);

// A separate top-level route (not nested under /challenges/:id) since this
// export is cross-user, not scoped to one learner's own progress.
router.get('/research', requireAdmin, async (_req, res) => {
  const reveals = await hintRepository.allHintReveals();
  res.json({ hintReveals: reveals });
});

export default router;
