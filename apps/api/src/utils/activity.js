import { prisma } from './prisma.js';
import { logger } from './logger.js';

export async function logActivity({ userId, action, metadata, ip }) {
  try {
    await prisma.activityLog.create({ data: { userId, action, metadata, ip } });
  } catch (err) {
    // Activity logging must never break the primary operation.
    logger.error({ err, action }, 'Failed to write activity log');
  }
}

export async function logAudit({ actorId, actorEmail, action, targetType, targetId, before, after }) {
  try {
    await prisma.auditLog.create({
      data: { actorId, actorEmail, action, targetType, targetId, before, after },
    });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write audit log');
  }
}
