import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createServerLimiter, deployLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import * as serversController from '../controllers/servers.controller.js';
import * as filesController from '../controllers/files.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', serversController.listServers);
router.post('/', createServerLimiter, serversController.createServer);
router.get('/:id', serversController.getServer);
router.patch('/:id/startup', serversController.updateStartup);
router.delete('/:id', serversController.deleteServer);

router.post('/:id/restart', deployLimiter, serversController.restartServer);
router.post('/:id/deploy', deployLimiter, serversController.deployServer);
router.get('/:id/deployments', serversController.listServerDeployments);
router.get('/:id/deployments/:deployId', serversController.getServerDeployment);
router.get('/:id/status', serversController.getStatus);
router.get('/:id/logs', serversController.getLogs);

router.get('/:id/env', serversController.listEnv);
router.post('/:id/env', serversController.setEnv);
router.delete('/:id/env/:key', serversController.removeEnv);

router.get('/:id/files', filesController.listServerFiles);
router.post('/:id/files/upload-url', uploadLimiter, filesController.requestUpload);
router.get('/:id/files/download-url', filesController.requestDownload);
router.post('/:id/files/delete', filesController.removeFile);
router.post('/:id/files/rename', filesController.rename);
router.post('/:id/files/folder', filesController.createFolder);
router.get('/:id/files/read', filesController.readFile);
router.post('/:id/files/write', filesController.writeFile);
router.post('/:id/files/extract', filesController.extract);
router.post('/:id/files/compress', filesController.compress);

export default router;
