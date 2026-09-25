import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as apiKeysController from '../controllers/apikeys.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', apiKeysController.listApiKeys);
router.post('/', apiKeysController.createApiKey);
router.delete('/:id', apiKeysController.revokeApiKey);

export default router;
