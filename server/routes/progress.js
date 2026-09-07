import { Router } from 'express';
import * as progressController from '../controllers/progress.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/me', progressController.me);

export default router;
