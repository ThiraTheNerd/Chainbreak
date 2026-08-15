import { Router } from 'express';
import authRoutes from './auth.js';
import challengeRoutes from './challenges.js';
import flagRoutes from './flags.js';
import scoreRoutes from './scores.js';
import sessionRoutes from './session.routes.js';
import assessmentRoutes from './assessment.js';
import hintRoutes from './hints.js';
import securityRoutes from './security.js';
import progressRoutes from './progress.js';
import adminRoutes from './admin.js';
import consentRoutes from './consent.js';


const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/sessions', sessionRoutes);
router.use('/challenges', challengeRoutes);
router.use('/flags', flagRoutes);
router.use('/scores', scoreRoutes);
router.use('/assessment', assessmentRoutes);
router.use('/hints', hintRoutes);
router.use('/security', securityRoutes);
router.use('/progress', progressRoutes);
router.use('/admin', adminRoutes);
router.use('/consent', consentRoutes);

export default router;
 