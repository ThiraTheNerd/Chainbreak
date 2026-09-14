import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register',        authController.register);
router.post('/login',           authController.login);
router.get('/me',               authenticate, authController.me);
router.post('/logout',          authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password',  authController.resetPassword);

export default router;
