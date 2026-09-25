import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as adminController from '../controllers/admin.controller.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));

router.get('/overview', adminController.overview);
router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/suspend', adminController.setSuspended);
router.patch('/users/:id/role', adminController.setRole);
router.patch('/users/:id/limits', adminController.updateLimits);
router.delete('/users/:id', adminController.deleteUser);

router.get('/activity', adminController.listAllActivity);
router.post('/render/test-connection', adminController.testRenderConnection);
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);

export default router;
