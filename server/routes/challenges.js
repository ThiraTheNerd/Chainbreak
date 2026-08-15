import { Router } from 'express';
import * as challengeController from '../controllers/challenge.controller.js';
import * as sessionController from '../controllers/session.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { requireConsent } from '../middleware/consent.js';
import { rateLimit }    from '../middleware/rateLimit.js';

const router = Router();
// requireConsent bypasses admins (see middleware/consent.js), so the
// admin-only routes below (create/archive) are unaffected by this.
router.use(authenticate, requireConsent);

router.get('/', challengeController.listChallenges); // ?layer=owasp|docker|aws
router.get('/:id', challengeController.getOne);
router.get('/:id/progress', challengeController.getProgress);

// Pay-to-unlock solution walkthrough — one-time per (user, module).
router.get('/:id/solution-unlock', challengeController.getSolutionUnlockStatus);
router.post('/:id/solution-unlock', challengeController.unlockSolution);


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
 