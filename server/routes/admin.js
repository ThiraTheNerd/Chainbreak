import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as inviteController from '../controllers/invite.controller.js';
import * as consentController from '../controllers/consent.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/analytics', analyticsController.research);

// Per-participant invite codes — registration admission control.
// See server/services/invite.service.js and server/services/auth.service.js.
router.post('/invites',            inviteController.generate);
router.get('/invites',             inviteController.list);
router.post('/invites/:id/revoke', inviteController.revoke);

// Consent status per participant — identified (username/email), but never
// joined to assessments/scores. See consent.repository.js's listAll().
router.get('/consent', consentController.adminList);

export default router;
