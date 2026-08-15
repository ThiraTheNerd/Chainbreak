import { Router } from 'express';
import * as scoreController from '../controllers/score.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireConsent } from '../middleware/consent.js';

const router = Router();
router.use(authenticate, requireConsent);
 
router.get('/me', scoreController.me);
router.get('/leaderboard', scoreController.leaderboard);
 
export default router;
 