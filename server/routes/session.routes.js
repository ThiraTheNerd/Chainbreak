import { Router } from 'express';
import {authenticate} from '../middleware/auth.js';
import { requireConsent } from '../middleware/consent.js';
import * as sessionController from '../controllers/session.controller.js';

const router = Router();
router.post('/challenges/:id/session', authenticate, requireConsent, sessionController.startChallenge);
router.delete('/challenges/:id/session', authenticate, requireConsent, sessionController.stopChallenge);
export default router;