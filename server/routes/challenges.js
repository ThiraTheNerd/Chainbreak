import { Router } from 'express';
import * as challengeController from '../controllers/challenge.controller.js';
import * as sessionController from '../controllers/session.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { rateLimit }    from '../middleware/rateLimit.js';

const router = Router();
router.use(authenticate);

router.get('/', challengeController.listChallenges); // ?layer=owasp|docker|aws
router.get('/:id', challengeController.getOne);
router.get('/:id/progress', challengeController.getProgress);

// Pay-to-unlock solution walkthrough — one-time per (user, module).
router.get('/:id/solution-unlock', challengeController.getSolutionUnlockStatus);
router.post('/:id/solution-unlock', challengeController.unlockSolution);

// AI-generated progressive hints — one-time per (user, challenge, tier).
// Rate-limited (not just cost-gated): the reveal endpoint calls the
// Anthropic API and shouldn't be hammered even by someone who can afford
// every tier of every flag.
router.get('/:id/hints', challengeController.getHintStatus);
router.post(
  '/:id/hints/:tier',
  rateLimit({ windowMs: 5 * 60_000, max: 10 }),
  challengeController.revealHint
);

router.post('/:id/start', sessionController.startChallenge);

// Admin-only management (requireAdmin runs AFTER requireAuth, so req.user exists)
router.post('/', requireAdmin, challengeController.create);
router.delete('/:id', requireAdmin, challengeController.archive);
 
export default router;
 