import { Router } from 'express';
import {authenticate} from '../middleware/auth.js';
import * as sessionController from '../controllers/session.controller.js';

const router = Router();
router.post('/challenges/:id/session', authenticate, sessionController.startChallenge);
router.delete('/challenges/:id/session', authenticate, sessionController.stopChallenge);
export default router;