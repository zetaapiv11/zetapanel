import { prisma } from '../utils/prisma.js';
import { generateApiKey } from '../utils/crypto.js';
import { createApiKeySchema } from '../validators/schemas.js';
import { logActivity } from '../utils/activity.js';

export const AVAILABLE_PERMISSIONS = [
  'servers.read',
  'servers.create',
  'servers.update',
  'servers.delete',
  'servers.deploy',
  'servers.restart',
  'servers.logs',
  'servers.env',
  'files.read',
  'files.write',
];

export async function listApiKeys(req, res, next) {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user.id },
      select: { id: true, name: true, keyPrefix: true, permissions: true, lastUsedAt: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ apiKeys: keys });
  } catch (err) {
    next(err);
  }
}

export async function createApiKey(req, res, next) {
  try {
    const { name, permissions } = createApiKeySchema.parse(req.body);
    const invalid = permissions.filter((p) => !AVAILABLE_PERMISSIONS.includes(p));
    if (invalid.length) {
      return res.status(400).json({ error: { message: `Unknown permissions: ${invalid.join(', ')}` } });
    }

    const { key, keyHash, keyPrefix } = generateApiKey();
    const record = await prisma.apiKey.create({
      data: { userId: req.user.id, name, permissions, keyHash, keyPrefix },
    });

    await logActivity({ userId: req.user.id, action: 'apikey.created', metadata: { apiKeyId: record.id, name }, ip: req.ip });

    // The full key is only ever shown here, once.
    res.status(201).json({ apiKey: { id: record.id, name: record.name, keyPrefix: record.keyPrefix, permissions: record.permissions }, key });
  } catch (err) {
    next(err);
  }
}

export async function revokeApiKey(req, res, next) {
  try {
    const record = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ error: { message: 'API key not found.' } });

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    if (record.userId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: { message: 'You do not have permission to perform this action.' } });
    }

    await prisma.apiKey.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    await logActivity({ userId: req.user.id, action: 'apikey.revoked', metadata: { apiKeyId: record.id }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
