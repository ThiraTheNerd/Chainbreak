import { Router } from 'express';
import * as progressController from '../controllers/progress.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireConsent } from '../middleware/consent.js';

const router = Router();
router.use(authenticate, requireConsent);

router.get('/me', progressController.me);

export default router;
