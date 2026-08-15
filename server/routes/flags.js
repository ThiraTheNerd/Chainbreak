import { Router } from 'express';
import * as flagController from '../controllers/flag.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireConsent } from '../middleware/consent.js';

const router = Router();
router.post('/', authenticate, requireConsent, flagController.submitFlag);
 
export default router;
 