import { prisma } from '../utils/prisma.js';
import { hashPassword } from '../utils/crypto.js';
import { adminCreateUserSchema, adminUpdateLimitsSchema } from '../validators/schemas.js';
import { logAudit, logActivity } from '../utils/activity.js';
import { renderRequest } from '../services/render/renderClient.js';

export async function overview(req, res, next) {
  try {
    const [userCount, serverCount, apiKeyCount] = await Promise.all([
      prisma.user.count(),
      prisma.server.count(),
      prisma.apiKey.count({ where: { revokedAt: null } }),
    ]);
    const statusBreakdown = await prisma.server.groupBy({ by: ['status'], _count: true });
    res.json({ userCount, serverCount, apiKeyCount, statusBreakdown });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, suspended: true, verified: true, maxServers: true, maxStorageMb: true, createdAt: true, _count: { select: { servers: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const { email, password, role } = adminCreateUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: { message: 'A user with this email already exists.' } });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, passwordHash, role, verified: true } });

    await logAudit({ actorId: req.user.id, actorEmail: req.user.email, action: 'admin.user_created', targetType: 'User', targetId: user.id, after: { email, role } });
    res.status(201).json({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

export async function setSuspended(req, res, next) {
  try {
    const suspended = !!req.body.suspended;
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { suspended } });
    await logAudit({ actorId: req.user.id, actorEmail: req.user.email, action: suspended ? 'admin.user_suspended' : 'admin.user_unsuspended', targetType: 'User', targetId: user.id });
    res.json({ user: { id: user.id, suspended: user.suspended } });
  } catch (err) {
    next(err);
  }
}

export async function setRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return res.status(400).json({ error: { message: 'Invalid role.' } });
    }
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: { message: 'Only a super admin can change roles.' } });
    }
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    await logAudit({ actorId: req.user.id, actorEmail: req.user.email, action: 'admin.role_changed', targetType: 'User', targetId: user.id, before: { role: before.role }, after: { role } });
    res.json({ user: { id: user.id, role: user.role } });
  } catch (err) {
    next(err);
  }
}

export async function updateLimits(req, res, next) {
  try {
    const patch = adminUpdateLimitsSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.params.id }, data: patch });
    await logAudit({ actorId: req.user.id, actorEmail: req.user.email, action: 'admin.limits_updated', targetType: 'User', targetId: user.id, after: patch });
    res.json({ user: { id: user.id, maxServers: user.maxServers, maxStorageMb: user.maxStorageMb } });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    if (req.user.id === req.params.id) return res.status(400).json({ error: { message: 'You cannot delete your own account.' } });
    await prisma.user.delete({ where: { id: req.params.id } });
    await logAudit({ actorId: req.user.id, actorEmail: req.user.email, action: 'admin.user_deleted', targetType: 'User', targetId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function listAllActivity(req, res, next) {
  try {
    const logs = await prisma.activityLog.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } },
    });
    res.json({ activity: logs });
  } catch (err) {
    next(err);
  }
}

/**
 * Real connectivity test against Render: calls GET /v1/users (or /v1/owners)
 * with the configured key so "Test Connection" reflects an actual API
 * response, not a hardcoded "Connected" string.
 */
export async function testRenderConnection(req, res, next) {
  try {
    const { data } = await renderRequest('/owners', { query: { limit: 1 } });
    res.json({ connected: true, owners: data });
  } catch (err) {
    res.status(200).json({ connected: false, error: err.message });
  }
}

export async function getSettings(req, res, next) {
  try {
    const rows = await prisma.systemSetting.findMany();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const entries = Object.entries(req.body || {});
    for (const [key, value] of entries) {
      await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    await logAudit({ actorId: req.user.id, actorEmail: req.user.email, action: 'admin.settings_updated', after: req.body });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
