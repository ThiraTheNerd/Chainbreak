import { Router } from 'express';
import * as consentController from '../controllers/consent.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);


router.post('/',         consentController.record);
router.get('/me',        consentController.me);
router.post('/withdraw', consentController.withdraw);

export default router;
