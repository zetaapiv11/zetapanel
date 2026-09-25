import { Router } from 'express';
import { requireApiKey, requirePermission } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import * as serversController from '../controllers/servers.controller.js';
import * as filesController from '../controllers/files.controller.js';

const router = Router();
router.use(requireApiKey, apiLimiter);

router.get('/user', (req, res) => res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role } }));

router.get('/servers', requirePermission('servers.read'), serversController.listServers);
router.post('/servers', requirePermission('servers.create'), serversController.createServer);
router.get('/servers/:id', requirePermission('servers.read'), serversController.getServer);
router.patch('/servers/:id', requirePermission('servers.update'), serversController.updateStartup);
router.delete('/servers/:id', requirePermission('servers.delete'), serversController.deleteServer);

router.post('/servers/:id/deploy', requirePermission('servers.deploy'), serversController.deployServer);
router.post('/servers/:id/restart', requirePermission('servers.restart'), serversController.restartServer);
router.get('/servers/:id/status', requirePermission('servers.read'), serversController.getStatus);
router.get('/servers/:id/logs', requirePermission('servers.logs'), serversController.getLogs);

router.get('/servers/:id/env', requirePermission('servers.env'), serversController.listEnv);
router.post('/servers/:id/env', requirePermission('servers.env'), serversController.setEnv);
router.patch('/servers/:id/env/:key', requirePermission('servers.env'), (req, res, next) => {
  req.body = { key: req.params.key, value: req.body.value };
  return serversController.setEnv(req, res, next);
});
router.delete('/servers/:id/env/:key', requirePermission('servers.env'), serversController.removeEnv);

router.get('/servers/:id/files', requirePermission('files.read'), filesController.listServerFiles);
router.post('/servers/:id/files/upload', requirePermission('files.write'), filesController.requestUpload);
router.delete('/servers/:id/files', requirePermission('files.write'), filesController.removeFile);
router.post('/servers/:id/files/extract', requirePermission('files.write'), filesController.extract);
router.post('/servers/:id/files/compress', requirePermission('files.write'), filesController.compress);

export default router;
