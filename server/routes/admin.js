/** @file server/routes/admin.js — /api/admin (auth + admin role required for every route). */

import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
router.use(authenticate, requireAdmin);

// Aggregate-only research analytics for the admin Research Analytics
// dashboard — see server/services/analytics.service.js for the metrics
// (mirrors analysis/*.py) and the anonymisation guarantee (no
// per-participant identifiers ever leave that service).
router.get('/analytics', analyticsController.research);

export default router;
