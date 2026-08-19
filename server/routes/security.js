import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import * as securityService from '../services/security.service.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/zap/status', (_req, res) => res.json({ configured: Boolean(process.env.ZAP_API_KEY), target: process.env.ZAP_TARGET || 'http://nginx' }));
router.post('/zap/scan', async (req, res, next) => {
  try { res.status(202).json({ scan: await securityService.startScan({ target: req.body.target, scanType: req.body.scanType, authToken: req.body.authToken }) }); } catch (error) { next(error); }
});
router.get('/zap/scans', async (_req, res, next) => { try { res.json({ scans: await securityService.listScans() }); } catch (error) { next(error); } });
router.get('/zap/scans/:id', async (req, res, next) => { try { const scan = await securityService.getScan(req.params.id); if (!scan) return res.status(404).json({ error: 'Scan not found' }); res.json({ scan }); } catch (error) { next(error); } });
router.get('/zap/scans/:id/findings', async (req, res, next) => { try { res.json({ findings: await securityService.getFindings(req.params.id) }); } catch (error) { next(error); } });
router.get('/zap/scans/:id/evaluation', async (req, res, next) => { try { res.json(await securityService.evaluation(req.params.id)); } catch (error) { next(error); } });
router.get('/zap/owasp', (_req, res) => res.json({ owasp: securityService.metadata().owasp }));
router.get('/zap/ground-truth', (_req, res) => res.json({ groundTruth: securityService.metadata().groundTruth }));
router.get('/zap/evaluation', (_req, res) => res.json({ limitations: securityService.metadata().limitations }));

export default router;