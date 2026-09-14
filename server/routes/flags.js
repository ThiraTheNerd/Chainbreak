import { Router } from 'express';
import * as flagController from '../controllers/flag.controller.js';
import { authenticate } from '../middleware/auth.js';
 
const router = Router();
router.post('/', authenticate, flagController.submitFlag);
 
export default router;
 